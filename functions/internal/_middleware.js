import { requireInternalActor, withInternalHeaders } from './security.mjs';

function json(body, status) {
  return withInternalHeaders(new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  }));
}

export async function onRequest({ request, env, next }) {
  const pathname = new URL(request.url).pathname;
  if (pathname !== '/internal' && !pathname.startsWith('/internal/')) return next();
  try {
    await requireInternalActor(request, env);
  } catch {
    return json({ error: 'unauthorized' }, 401);
  }
  return next();
}
