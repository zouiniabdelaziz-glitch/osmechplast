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
    if (hostname.endsWith(".pages.dev")) {
      return json({ ok: false, error: "forbidden" }, 403);
    }

    const contentType = (request.headers.get("Content-Type") || "").split(";", 1)[0].trim().toLowerCase();
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

    const source = "website";
    const status = "new";
    const created_at = new Date().toISOString();

    await env.DB.prepare(`
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

    return json({ ok: true });
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
