import { verifyAccessJwt } from '../internal/access-jwt.mjs';
import { InternalSecurityError, readInternalJson, requireInternalMutationOrigin } from '../internal/security.mjs';
import { allowedUploadActions, transitionUpload, auditActionForTransition, validateRejectionReason } from './state.mjs';

const json = (body, status) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const DETAIL_CODES = new Set(['access_unconfigured','invalid_token','invalid_claims','jwks_unavailable','unknown_key','invalid_signature','not_employee','object_missing','employee_download','approved','rejected','invalid_state','method_not_allowed']);
function options(env) {
  return {
    teamDomain: env.ACCESS_TEAM_DOMAIN,
    policyAud: env.ACCESS_POLICY_AUD,
    jwksUrl: env.ACCESS_JWKS_URL,
    allowInsecureJwks: env.INTERNAL_LOCAL_TEST === '1',
    fetchImpl: env.fetchImpl || fetch,
    allowedSubjects: String(env.ACCESS_ALLOWED_SUBJECTS || '').split(',').map((v) => v.trim()).filter(Boolean),
    allowedGroups: String(env.ACCESS_ALLOWED_GROUPS || '').split(',').map((v) => v.trim()).filter(Boolean),
  };
}
async function actor(request, env) {
  const assertion = request.headers.get('Cf-Access-Jwt-Assertion');
  return verifyAccessJwt(assertion, options(env));
}
async function rowFor(env, leadId, uploadId) {
  return env.DB.prepare('SELECT * FROM lead_uploads WHERE id = ? AND lead_id = ?').bind(uploadId, Number(leadId)).first();
}
async function audit(env, row, actorId, action, result, detailCode) {
  try {
    await env.DB.prepare('INSERT INTO upload_audit_log (upload_id, lead_id, actor_type, actor_id, occurred_at, action, result, detail_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(row?.id || null, row?.lead_id || null, actorId ? 'employee' : 'unknown', actorId || null, new Date().toISOString(), action, result, DETAIL_CODES.has(detailCode) ? detailCode : 'invalid_state').run();
    return true;
  } catch {
    return false;
  }
}
async function successAuditFor(env, row, actorId, occurredAt, action, detailCode) {
  try {
    const auditRow = await env.DB.prepare(`SELECT upload_id, lead_id, actor_id, occurred_at, action, result, detail_code
      FROM upload_audit_log
      WHERE upload_id = ? AND lead_id = ? AND actor_id = ? AND occurred_at = ? AND action = ? AND result = 'success' AND detail_code = ?`)
      .bind(row.id, row.lead_id, actorId, occurredAt, action, detailCode).first();
    return Boolean(auditRow
      && auditRow.upload_id === row.id
      && Number(auditRow.lead_id) === Number(row.lead_id)
      && auditRow.actor_id === actorId
      && auditRow.occurred_at === occurredAt
      && auditRow.action === action
      && auditRow.result === 'success'
      && auditRow.detail_code === detailCode);
  } catch {
    return false;
  }
}
async function reviewGate(env) {
  try {
    const gate = await env.DB.prepare('SELECT enabled, protocol_version FROM internal_review_control WHERE id = 1').bind().first();
    return gate?.enabled === 1 && gate?.protocol_version === 2;
  } catch {
    return false;
  }
}

export async function onRequestGet({ request, env, params }) {
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
  const verified = await actor(request, env);
  if (!verified.ok) { await audit(env, null, null, 'download_denied', 'denied', verified.reason); return json({ error: 'unauthorized' }, 401); }
  const row = await rowFor(env, params.leadId, params.uploadId);
  if (!row) return json({ error: 'not_found' }, 404);
  if (!allowedUploadActions(row).includes('download')) {
    await audit(env, row, verified.subject, 'download_denied', 'denied', 'invalid_state');
    return json({ error: 'invalid_state' }, 409);
  }
  const object = await env.RFQ_UPLOADS?.get(row.r2_key);
  if (!object) { await audit(env, row, verified.subject, 'download_denied', 'failed', 'object_missing'); return json({ error: 'not_found' }, 404); }
  const current = await rowFor(env, params.leadId, params.uploadId);
  if (!current || !allowedUploadActions(current).includes('download')) {
    await audit(env, current || row, verified.subject, 'download_denied', 'denied', 'invalid_state');
    return json({ error: 'invalid_state' }, 409);
  }
  if (!await audit(env, current, verified.subject, 'download_allowed', 'success', 'employee_download')) return json({ error: 'temporarily_unavailable' }, 503);
  const headers = new Headers(object.httpMetadata || {});
  headers.set('Content-Type', row.detected_type || 'application/octet-stream');
  headers.set('Content-Disposition', `attachment; filename="${String(row.original_name).replace(/[^A-Za-z0-9._-]/g, '_')}"`);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Cache-Control', 'no-store');
  return new Response(object.body || object, { status: 200, headers });
}

export async function onRequestPost({ request, env, params, action = 'approve' }) {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  try { requireInternalMutationOrigin(request, env); } catch (error) {
    return json({ error: error instanceof InternalSecurityError ? 'forbidden' : 'forbidden' }, 403);
  }
  const verified = await actor(request, env);
  if (!verified.ok) { await audit(env, null, null, action === 'approve' ? 'file_approved' : 'file_rejected', 'denied', verified.reason); return json({ error: 'unauthorized' }, 401); }
  let body;
  try {
    body = await readInternalJson(request, { maxBytes: 4096, allowedFields: action === 'reject' ? ['reason'] : [] });
  } catch (error) {
    const code = error?.code || 'invalid_request';
    return json({ error: code }, code === 'payload_too_large' ? 413 : code === 'unsupported_media_type' ? 415 : 400);
  }
  const row = await rowFor(env, params.leadId, params.uploadId);
  if (!row) return json({ error: 'not_found' }, 404);
  if (!await reviewGate(env)) return json({ error: 'temporarily_unavailable' }, 503);
  if (!allowedUploadActions(row).includes(action)) {
    await audit(env, row, verified.subject, auditActionForTransition(action), 'denied', 'invalid_state');
    return json({ error: 'invalid_state' }, 409);
  }
  let next;
  try { next = transitionUpload(row.security_status, action, { type: 'employee', id: verified.subject }); } catch {
    await audit(env, row, verified.subject, auditActionForTransition(action), 'denied', 'invalid_state');
    return json({ error: 'invalid_state' }, 409);
  }
  let reason = null;
  if (action === 'reject') {
    try { reason = validateRejectionReason(body.reason); } catch { return json({ error: 'invalid_request' }, 400); }
  }
  const reviewRequestId = crypto.randomUUID();
  const reviewedAt = new Date().toISOString();
  const update = await env.DB.prepare("UPDATE lead_uploads SET security_status = ?, reviewed_at = ?, reviewed_by = ?, rejection_reason = ?, review_request_id = ? WHERE id = ? AND lead_id = ? AND storage_status = 'stored' AND security_status = 'quarantine'")
    .bind(next, reviewedAt, verified.subject, reason, reviewRequestId, params.uploadId, Number(params.leadId)).run();
  const current = await rowFor(env, params.leadId, params.uploadId);
  const applied = current?.security_status === next
    && current?.storage_status === 'stored'
    && current?.reviewed_by === verified.subject
    && current?.review_request_id === reviewRequestId
    && current?.reviewed_at === reviewedAt
    && await successAuditFor(env, current, verified.subject, reviewedAt, auditActionForTransition(action), next);
  if (!applied) {
    await audit(env, row, verified.subject, auditActionForTransition(action), 'denied', 'invalid_state');
    return json({ error: 'invalid_state' }, 409);
  }
  return json({ ok: true, security_status: next }, 200);
}
