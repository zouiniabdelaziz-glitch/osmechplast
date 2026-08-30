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

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const contentType = (request.headers.get("Content-Type") || "").split(";", 1)[0].trim().toLowerCase();
    if (contentType !== "application/json") {
      return json({ ok: false, error: "invalid_request" }, 400);
    }

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
      return json({ ok: false, error: "payload_too_large" }, 413);
    }

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
