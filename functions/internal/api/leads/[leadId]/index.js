import { getLeadDetails } from '../../../leads-api.mjs';
import { InternalSecurityError, parseLeadId, requireInternalActor, withInternalHeaders } from '../../../security.mjs';

function json(body, status = 200) { return withInternalHeaders(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })); }

export async function onRequest({ request, env, params }) {
  if (request.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, 405);
  if (env.INTERNAL_UI_ENABLED !== '1') return json({ ok: false, error: 'not_found' }, 404);
  try { await requireInternalActor(request, env); } catch (error) { return json({ ok: false, error: error instanceof InternalSecurityError && error.code === 'not_employee' ? 'forbidden' : 'unauthorized' }, error instanceof InternalSecurityError && error.code === 'not_employee' ? 403 : 401); }
  let leadId;
  try { leadId = parseLeadId(params?.leadId); } catch { return json({ ok: false, error: 'invalid_request' }, 400); }
  try {
    const detail = await getLeadDetails(env.DB, leadId);
    return detail ? json(detail) : json({ ok: false, error: 'lead_not_found' }, 404);
  } catch { return json({ ok: false, error: 'temporarily_unavailable' }, 503); }
}
