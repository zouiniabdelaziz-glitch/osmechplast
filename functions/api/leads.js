import { readMultipartRequest, validateUploadFile, validateLeadFields, parseRequestId } from "../upload/validation.mjs";

const MAX_BODY_BYTES = 16384;
const FIELD_LIMITS = {
  company: 200,
  name: 150,
  email: 254,
  phone: 50,
  service: 80,
  message: 5000
};
const ALLOWED_LANGUAGES = new Set(["de", "it", "en", "fr"]);
const ALLOWED_SERVICES = new Set(["", "cnc-drehen", "drehfraesen", "prototypen-serien", "unsicher"]);
const STABLE_PREVIEW_HOST = 'rfq-upload-preview.osmechplast.pages.dev';

export function isAllowedPagesHost(hostname, env = {}) {
  const normalizedHost = String(hostname || '').toLowerCase().replace(/\.$/, '');
  if (!normalizedHost.endsWith('.pages.dev')) return true;
  return normalizedHost === STABLE_PREVIEW_HOST
    && env.RUNTIME_ENV === 'preview'
    && env.PREVIEW_API_ENABLED === '1'
    && env.PREVIEW_API_HOST === STABLE_PREVIEW_HOST;
}

export function createR2Key(leadId, uploadId, extension) {
  const safeLeadId = String(leadId).replace(/[^A-Za-z0-9_-]/g, "-");
  const safeUploadId = String(uploadId).replace(/[^A-Za-z0-9_-]/g, "-");
  const safeExtension = String(extension).toLowerCase().replace(/[^a-z0-9]/g, "");
  return `leads/${safeLeadId}/${safeUploadId}.${safeExtension}`;
}

export async function storeLeadAndUploads({ db, r2, lead, files, requestId, now = new Date().toISOString() }) {
  const leadResult = await db.prepare(`
    INSERT INTO leads (company, name, email, phone, service, message, language, source, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    lead.company || '', lead.name || '', lead.email || '', lead.phone || '',
    lead.service || '', lead.message || '', lead.language || 'de', 'website', 'new', now
  ).run();
  const leadId = lead.id ?? leadResult?.meta?.last_row_id;
  if (leadId == null) throw new Error('lead_insert_failed');
  const uploads = [];
  const storedKeys = [];
  const auditedUploadIds = [];
  let currentUploadId = null;
  try {
    for (const file of files) {
      const uploadId = crypto.randomUUID();
      currentUploadId = uploadId;
      const key = createR2Key(leadId, uploadId, file.extension);
      await db.prepare(`
      INSERT INTO lead_uploads (
        id, lead_id, sha256, original_name, extension, detected_type, r2_key,
        byte_size, storage_status, security_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'quarantine', ?)
    `).bind(
      uploadId, leadId, file.sha256, file.originalName, file.extension,
      file.detectedType, key, file.bytes.byteLength, now
      ).run();
      await r2.put(key, file.bytes, { httpMetadata: { contentType: file.detectedType } });
      storedKeys.push({ key, uploadId });
      await db.prepare(`UPDATE lead_uploads SET storage_status = 'stored', stored_at = ? WHERE id = ?`)
        .bind(now, uploadId).run();
      await db.prepare(`
        INSERT INTO upload_audit_log (
          upload_id, lead_id, actor_type, actor_id, occurred_at, action, result, detail_code
        ) VALUES (?, ?, 'public', NULL, ?, 'upload_stored', 'success', 'stored')
      `).bind(uploadId, leadId, now).run();
      auditedUploadIds.push(uploadId);
      uploads.push({ id: uploadId, lead_id: leadId, r2_key: key, storage_status: 'stored', security_status: 'quarantine', sha256: file.sha256, byte_size: file.bytes.byteLength });
    }
  } catch {
    for (const uploadId of auditedUploadIds) {
      await db.prepare('DELETE FROM upload_audit_log WHERE upload_id = ?').bind(uploadId).run().catch(() => {});
    }
    if (currentUploadId) await db.prepare("UPDATE lead_uploads SET storage_status = 'failed', error_code = ? WHERE id = ?").bind('upload_failed', currentUploadId).run().catch(() => {});
    for (const stored of storedKeys) {
      try { await r2.delete(stored.key); }
      catch { await db.prepare("UPDATE lead_uploads SET storage_status = 'delete_pending', error_code = ? WHERE id = ?").bind('cleanup_required', stored.uploadId).run().catch(() => {}); }
      await db.prepare("UPDATE lead_uploads SET storage_status = 'failed', error_code = ? WHERE id = ? AND storage_status != 'delete_pending'").bind('upload_transaction_failed', stored.uploadId).run().catch(() => {});
    }
    await db.prepare("UPDATE leads SET status = 'upload_failed' WHERE id = ?").bind(leadId).run().catch(() => {});
    throw new Error('upload_failed');
  }
  return { leadId, requestId, uploads };
}

export async function verifyTurnstile(token, remoteIp, env = {}) {
  if (env.TURNSTILE_TEST_MODE === "1" && env.RUNTIME_ENV === 'local' && /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(String(env.requestHost || ''))) {
    return Boolean(env.TURNSTILE_TEST_TOKEN && token && token === env.TURNSTILE_TEST_TOKEN);
  }
  if (!token || !env.TURNSTILE_SECRET_KEY) return false;
  const fetchImpl = env.fetchImpl || fetch;
  try {
    const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
    if (remoteIp) body.set("remoteip", remoteIp);
    const response = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body
    });
    if (!response.ok) return false;
    const result = await response.json();
    return result?.success === true;
  } catch {
    return false;
  }
}

export async function checkUploadRateLimit({ request, env = {} }) {
  const clientIp = request?.headers?.get('CF-Connecting-IP')?.trim() || 'unknown-client';
  const key = `/api/leads:${clientIp}`;
  if (env.RATE_LIMIT_TEST_MODE === '1') {
    const now = Date.now();
    const windowMs = Number(env.RATE_LIMIT_TEST_WINDOW_MS || 10000);
    const max = Number(env.RATE_LIMIT_TEST_MAX || 5);
    const store = env.rateLimitStore || new Map();
    const entry = store.get(key);
    if (!entry || now - entry.startedAt >= windowMs) {
      store.set(key, { startedAt: now, count: 1 });
      return { allowed: true };
    }
    if (entry.count < max) { entry.count += 1; return { allowed: true }; }
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((windowMs - (now - entry.startedAt)) / 1000)) };
  }
  if (env.RATE_LIMIT_SERVICE?.fetch) {
    try {
      const serviceRequest = new Request('https://rate-limit.internal/check', {
        method: 'POST',
        headers: { 'X-Rate-Limit-Key': key }
      });
      const response = await env.RATE_LIMIT_SERVICE.fetch(serviceRequest);
      if (!response?.ok) return { allowed: false, retryAfter: 60 };
      const result = await response.json();
      if (result?.allowed === true) return { allowed: true };
      if (result?.allowed === false) {
        const retryAfter = Number(result.retryAfter);
        return { allowed: false, retryAfter: Number.isInteger(retryAfter) && retryAfter > 0 ? retryAfter : 10 };
      }
      return { allowed: false, retryAfter: 60 };
    } catch { return { allowed: false, retryAfter: 60 }; }
  }
  return { allowed: false, retryAfter: 60 };
}

export async function reserveRequest(db, requestId, now = new Date().toISOString()) {
  const inserted = await db.prepare(`
    INSERT INTO lead_requests (request_id, state, created_at)
    VALUES (?, 'processing', ?)
    ON CONFLICT(request_id) DO NOTHING
  `).bind(requestId, now).run();
  if (inserted?.meta?.changes === 1) return { state: 'processing', fresh: true };
  const row = await db.prepare('SELECT request_id, lead_id, state, response_code, response_body FROM lead_requests WHERE request_id = ?').bind(requestId).first();
  if (!row) return { state: 'failed' };
  if (row.state === 'succeeded') {
    let response;
    try { response = row.response_body ? JSON.parse(row.response_body) : undefined; } catch { response = undefined; }
    return { state: 'succeeded', leadId: row.lead_id, response: response == null ? undefined : { code: row.response_code, body: response } };
  }
  if (row.state === 'failed') {
    let response;
    try { response = row.response_body ? JSON.parse(row.response_body) : undefined; } catch { response = undefined; }
    return { state: 'failed', response: response == null ? undefined : { code: row.response_code, body: response } };
  }
  return { state: row.state, fresh: false };
}

export async function completeRequest(db, requestId, leadId, responseCode, responseBody, now = new Date().toISOString()) {
  await db.prepare('UPDATE lead_requests SET state = ?, lead_id = ?, response_code = ?, response_body = ?, completed_at = ? WHERE request_id = ? AND state = ?')
    .bind('succeeded', leadId, responseCode, JSON.stringify(responseBody), now, requestId, 'processing').run();
}

export async function failRequest(db, requestId, responseCode, responseBody, now = new Date().toISOString()) {
  await db.prepare('UPDATE lead_requests SET state = ?, response_code = ?, response_body = ?, completed_at = ? WHERE request_id = ? AND state = ?')
    .bind('failed', responseCode, JSON.stringify(responseBody), now, requestId, 'processing').run();
}

function declaredContentLength(request) {
  const value = request.headers.get("Content-Length");
  if (value == null || !/^\d+$/.test(value.trim())) return null;
  const length = Number(value.trim());
  return Number.isSafeInteger(length) ? length : null;
}

async function readBodyWithinLimit(request) {
  const declaredLength = declaredContentLength(request);
  if (declaredLength !== null && declaredLength > MAX_BODY_BYTES) {
    return { tooLarge: true };
  }

  if (!request.body) return { text: "" };

  const reader = request.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      totalBytes += chunk.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        try {
          await reader.cancel("payload_too_large");
        } catch {
          // The request is already rejected; cancellation is best effort.
        }
        return { tooLarge: true };
      }
      chunks.push(chunk);
    }
  } catch {
    try {
      await reader.cancel("invalid_request");
    } catch {
      // Keep stream errors neutral for the client.
    }
    return { error: true };
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { text: new TextDecoder().decode(bytes) };
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    // Prevent bypassing the custom-domain rate limit via Pages deployment URLs.
    const hostname = new URL(request.url).hostname.toLowerCase().replace(/\.$/, "");
    const verificationEnv = Object.create(env || null);
    verificationEnv.requestHost = new URL(request.url).host;
    if (!isAllowedPagesHost(hostname, env)) {
      return json({ ok: false, error: "forbidden" }, 403);
    }
    const rateLimit = await checkUploadRateLimit({ request, env });
    if (!rateLimit.allowed) {
      const response = json({ ok: false, error: "rate_limited" }, 429);
      if (rateLimit.retryAfter) response.headers.set('Retry-After', String(rateLimit.retryAfter));
      return response;
    }

    const contentType = (request.headers.get("Content-Type") || "").split(";", 1)[0].trim().toLowerCase();
    if (contentType.startsWith("multipart/form-data")) {
      if (!env.RFQ_UPLOADS) return json({ ok: false, error: "server_error" }, 500);
      let multipart;
      try { multipart = await readMultipartRequest(request); } catch (error) {
        const status = error?.message === 'payload_too_large' || error?.message === 'file_too_large' ? 413 : 400;
        return json({ ok: false, error: status === 413 ? 'payload_too_large' : 'invalid_request' }, status);
      }
      const token = multipart.fields.get('turnstile_token') || '';
      const remoteIp = request.headers.get("CF-Connecting-IP") || "";
      if (!(await verifyTurnstile(token, remoteIp, verificationEnv))) return json({ ok: false, error: "verification_failed" }, 403);
      const input = Object.fromEntries(multipart.fields.entries());
      const leadValidation = validateLeadFields(input);
      if (!leadValidation.ok) return json({ ok: false, error: leadValidation.errors.includes('payload_too_large') ? 'payload_too_large' : 'invalid_request' }, leadValidation.errors.includes('payload_too_large') ? 413 : 400);
      const requestIdValue = request.headers.get('X-Request-ID') || input.request_id;
      let requestId;
      try { requestId = parseRequestId(requestIdValue); } catch { return json({ ok: false, error: 'invalid_request' }, 400); }
      const reservation = await reserveRequest(env.DB, requestId);
      if (reservation.state === 'succeeded' && reservation.response) return json(reservation.response.body, reservation.response.code);
      if (reservation.state === 'failed' && reservation.response) return json(reservation.response.body, reservation.response.code);
      if (reservation.state !== 'processing' || reservation.fresh === false) return json({ ok: false, error: 'duplicate_request' }, 409);
      const files = [];
      for (const file of multipart.files) {
        const checked = await validateUploadFile({ name: file.name, type: file.type, bytes: file.bytes });
        if (!checked.ok) { await failRequest(env.DB, requestId, 400, { ok: false, error: 'invalid_file' }); return json({ ok: false, error: 'invalid_file' }, 400); }
        files.push({ originalName: file.name, extension: checked.extension, detectedType: checked.detectedType, bytes: file.bytes, sha256: checked.sha256 });
      }
      try {
        const stored = await storeLeadAndUploads({ db: env.DB, r2: env.RFQ_UPLOADS, lead: leadValidation.values, files, requestId });
        const responseBody = { ok: true, lead_id: stored.leadId };
        await completeRequest(env.DB, requestId, stored.leadId, 200, responseBody);
        return json(responseBody, 200);
      } catch {
        await failRequest(env.DB, requestId, 500, { ok: false, error: 'server_error' });
        return json({ ok: false, error: 'server_error' }, 500);
      }
    }
    if (contentType !== "application/json") {
      return json({ ok: false, error: "invalid_request" }, 400);
    }

    const bodyResult = await readBodyWithinLimit(request);
    if (bodyResult.tooLarge) {
      return json({ ok: false, error: "payload_too_large" }, 413);
    }
    if (bodyResult.error) {
      return json({ ok: false, error: "invalid_request" }, 400);
    }
    const rawBody = bodyResult.text;

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (error) {
      return json({ ok: false, error: "invalid_request" }, 400);
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ ok: false, error: "invalid_request" }, 400);
    }

    const turnstileToken = typeof body.turnstile_token === "string" ? body.turnstile_token : "";
    const remoteIp = request.headers.get("CF-Connecting-IP") || "";
    if (!(await verifyTurnstile(turnstileToken, remoteIp, verificationEnv))) {
      return json({ ok: false, error: "verification_failed" }, 403);
    }

    const fields = ["company", "name", "email", "phone", "service", "message", "language"];
    if (fields.some(field => body[field] != null && typeof body[field] !== "string")) {
      return json({ ok: false, error: "invalid_request" }, 400);
    }

    const company = (body.company || "").trim();
    const name = (body.name || "").trim();
    const email = (body.email || "").trim();
    const phone = (body.phone || "").trim();
    const service = (body.service || "").trim();
    const message = (body.message || "").trim();
    const language = (body.language || "de").trim();

    const values = { company, name, email, phone, service, message };
    if (Object.entries(FIELD_LIMITS).some(([field, limit]) => values[field].length > limit)) {
      return json({ ok: false, error: "payload_too_large" }, 413);
    }

    if (!company || !name) {
      return json({ ok: false, error: "invalid_request" }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ ok: false, error: "invalid_email" }, 400);
    }
    if (!ALLOWED_LANGUAGES.has(language) || !ALLOWED_SERVICES.has(service)) {
      return json({ ok: false, error: "invalid_request" }, 400);
    }

    const requestIdValue = request.headers.get('X-Request-ID') || body.request_id;
    let requestId;
    try { requestId = parseRequestId(requestIdValue); } catch { return json({ ok: false, error: 'invalid_request' }, 400); }
    const reservation = await reserveRequest(env.DB, requestId);
    if (reservation.state === 'succeeded' && reservation.response) return json(reservation.response.body, reservation.response.code);
    if (reservation.state === 'failed' && reservation.response) return json(reservation.response.body, reservation.response.code);
    if (reservation.state !== 'processing' || reservation.fresh === false) return json({ ok: false, error: 'duplicate_request' }, 409);

    const source = "website";
    const status = "new";
    const created_at = new Date().toISOString();

    try {
      const leadResult = await env.DB.prepare(`
      INSERT INTO leads (
        company,
        name,
        email,
        phone,
        service,
        message,
        ai_analysis,
        language,
        source,
        status,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        company,
        name,
        email,
        phone,
        service,
        message,
        null,
        language,
        source,
        status,
        created_at
      )
      .run();
      const responseBody = { ok: true };
      await completeRequest(env.DB, requestId, leadResult?.meta?.last_row_id ?? null, 200, responseBody);
      return json(responseBody);
    } catch {
      const responseBody = { ok: false, error: 'server_error' };
      await failRequest(env.DB, requestId, 500, responseBody).catch(() => {});
      return json(responseBody, 500);
    }
  } catch (error) {
    console.error("Lead API error", error);
    return json({ ok: false, error: "server_error" }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: responseHeaders()
  });
}

export async function onRequestGet() {
  return json({ ok: false, error: "method_not_allowed" }, 405);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...responseHeaders()
    }
  });
}

function responseHeaders() {
  return {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "X-Robots-Tag": "noindex, nofollow"
  };
}
