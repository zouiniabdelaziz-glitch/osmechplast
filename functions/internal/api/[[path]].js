import { withInternalHeaders } from '../security.mjs';

export function onRequest() {
  return withInternalHeaders(new Response(JSON.stringify({ ok: false, error: 'not_found' }), {
    status: 404,
    headers: { 'content-type': 'application/json' },
  }));
}
