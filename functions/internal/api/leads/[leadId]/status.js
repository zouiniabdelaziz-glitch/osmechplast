import { changeLeadStatus } from '../../../lead-workflow.mjs';
import { InternalSecurityError, parseLeadId, readInternalJson, requireInternalActor, requireInternalMutationOrigin, withInternalHeaders } from '../../../security.mjs';

function json(body, status = 200) { return withInternalHeaders(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })); }
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export async function onRequest({ request, env, params }) {
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  if (env.INTERNAL_UI_ENABLED !== '1') return json({ ok: false, error: 'not_found' }, 404);
  let actor;
  try {
    actor = await requireInternalActor(request, env);
    requireInternalMutationOrigin(request, env);
  } catch (error) {
    const forbidden = error instanceof InternalSecurityError && error.code === 'not_employee';
    return json({ ok: false, error: forbidden ? 'forbidden' : error?.code === 'origin_denied' ? 'forbidden' : 'unauthorized' }, forbidden || error?.code === 'origin_denied' ? 403 : 401);
  }
  let leadId;
  try { leadId = parseLeadId(params?.leadId); } catch { return json({ ok: false, error: 'invalid_request' }, 400); }
  let body;
  try { body = await readInternalJson(request, { maxBytes: 4096, allowedFields: ['request_id', 'expected_status', 'expected_version', 'target_status'] }); } catch (error) { return json({ ok: false, error: error?.code || 'invalid_request' }, error?.code === 'payload_too_large' ? 413 : error?.code === 'unsupported_media_type' ? 415 : 400); }
  if (!uuidV4.test(body.request_id) || !['new', 'in_progress', 'completed'].includes(body.expected_status) || !['new', 'in_progress', 'completed'].includes(body.target_status) || !Number.isSafeInteger(body.expected_version) || body.expected_version < 0 || body.expected_version > 9007199254740990) return json({ ok: false, error: 'invalid_request' }, 400);
  try {
    const result = await changeLeadStatus(env.DB, {
      requestId: body.request_id,
      actorId: actor.subject,
      leadId,
      expectedStatus: body.expected_status,
      expectedVersion: body.expected_version,
      targetStatus: body.target_status,
      occurredAt: new Date().toISOString(),
    });
    return result.ok ? json({ ok: true, status: result.status, version: result.version }, 200) : json({ ok: false, error: result.error }, result.httpStatus);
  } catch {
    return json({ ok: false, error: 'temporarily_unavailable' }, 503);
  }
}
