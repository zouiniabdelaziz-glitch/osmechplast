import { listLeads } from '../../leads-api.mjs';
import { InternalSecurityError, requireInternalActor, withInternalHeaders } from '../../security.mjs';

function json(body, status = 200, extra = {}) {
  return withInternalHeaders(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...extra } }));
}

function authStatus(error) { return error instanceof InternalSecurityError && error.code === 'not_employee' ? 403 : 401; }

export async function onRequestGet({ request, env }) {
  if (env.INTERNAL_UI_ENABLED !== '1') return json({ error: 'not_found' }, 404);
  try { await requireInternalActor(request, env); } catch (error) { return json({ error: authStatus(error) === 403 ? 'forbidden' : 'unauthorized' }, authStatus(error)); }
  const url = new URL(request.url);
  const allowed = new Set(['page', 'status', 'q']);
  const seen = new Set();
  for (const key of url.searchParams.keys()) {
    if (!allowed.has(key) || seen.has(key)) return json({ ok: false, error: 'invalid_request' }, 400);
    seen.add(key);
  }
  const pageValue = url.searchParams.get('page') || '1';
  if (!/^(?:[1-9]\d{0,3}|10000)$/u.test(pageValue)) return json({ ok: false, error: 'invalid_request' }, 400);
  const status = url.searchParams.get('status') || undefined;
  if (status && !['new', 'in_progress', 'completed'].includes(status)) return json({ ok: false, error: 'invalid_request' }, 400);
  const query = url.searchParams.get('q') || undefined;
  if (query && Array.from(query.trim()).length > 100) return json({ ok: false, error: 'invalid_request' }, 400);
  try { return json(await listLeads(env.DB, { page: Number(pageValue), status, query })); } catch { return json({ ok: false, error: 'temporarily_unavailable' }, 503); }
}

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, 405, { allow: 'GET' });
  return onRequestGet({ request, env });
}
