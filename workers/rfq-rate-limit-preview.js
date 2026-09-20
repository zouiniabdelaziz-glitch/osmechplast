const RETRY_AFTER_SECONDS = 10;

function denied() {
  return new Response(JSON.stringify({ allowed: false, retryAfter: RETRY_AFTER_SECONDS }), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

function decision(allowed) {
  return new Response(JSON.stringify(allowed ? { allowed: true } : { allowed: false, retryAfter: RETRY_AFTER_SECONDS }), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return denied();
    const key = request.headers.get('X-Rate-Limit-Key')?.trim();
    if (!key || !env.RATE_LIMITER?.limit) return denied();
    try {
      const result = await env.RATE_LIMITER.limit({ key });
      return decision(result?.success === true);
    } catch {
      return denied();
    }
  }
};
