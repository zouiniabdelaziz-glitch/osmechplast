export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();

    const company = body.company || "";
    const name = body.name || "";
    const email = body.email || "";
    const phone = body.phone || "";
    const service = body.service || "";
    const message = body.message || "";
    const ai_analysis = body.ai_analysis || null;
    const language = body.language || "de";
    const source = "website";
    const status = "new";
    const created_at = new Date().toISOString();

    if (!email) {
      return json({ ok: false, error: "Email fehlt." }, 400);
    }

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
        ai_analysis,
        language,
        source,
        status,
        created_at
      )
      .run();

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders()
    }
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}