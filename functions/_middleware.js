import { requireInternalActor, withInternalHeaders } from './internal/security.mjs';

function unauthorized() {
  return withInternalHeaders(new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } }));
}

export async function onRequest({ request, env, next }) {
  const pathname = new URL(request.url).pathname;
  if (pathname !== '/internal' && !pathname.startsWith('/internal/')) return next();
  try { await requireInternalActor(request, env); } catch { return unauthorized(); }
  return next();
}
