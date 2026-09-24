import { verifyAccessJwt } from '../internal/access-jwt.mjs';
import { transitionUpload, auditActionForTransition } from './state.mjs';

const json = (body, status) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const DETAIL_CODES = new Set(['access_unconfigured','invalid_token','invalid_claims','jwks_unavailable','unknown_key','invalid_signature','not_employee','object_missing','employee_download','approved','rejected','invalid_state','method_not_allowed']);
function options(env) {
  return {
    teamDomain: env.ACCESS_TEAM_DOMAIN,
    policyAud: env.ACCESS_POLICY_AUD,
    fetchImpl: env.fetchImpl || fetch,
    allowedSubjects: String(env.ACCESS_ALLOWED_SUBJECTS || '').split(',').map((v) => v.trim()).filter(Boolean),
    allowedGroups: String(env.ACCESS_ALLOWED_GROUPS || '').split(',').map((v) => v.trim()).filter(Boolean),
  };
}
async function actor(request, env) {
  const assertion = request.headers.get('Cf-Access-Jwt-Assertion');
  return verifyAccessJwt(assertion, options(env));
}
async function rowFor(env, leadId, uploadId) {
  return env.DB.prepare('SELECT * FROM lead_uploads WHERE id = ? AND lead_id = ?').bind(uploadId, Number(leadId)).first();
}
async function audit(env, row, actorId, action, result, detailCode) {
  await env.DB.prepare('INSERT INTO upload_audit_log (upload_id, lead_id, actor_type, actor_id, occurred_at, action, result, detail_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(row?.id || null, row?.lead_id || null, actorId ? 'employee' : 'unknown', actorId || null, new Date().toISOString(), action, result, DETAIL_CODES.has(detailCode) ? detailCode : 'invalid_state').run().catch(() => {});
}

export async function onRequestGet({ request, env, params }) {
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
  const verified = await actor(request, env);
  if (!verified.ok) { await audit(env, null, null, 'download_denied', 'denied', verified.reason); return json({ error: 'unauthorized' }, 401); }
  const row = await rowFor(env, params.leadId, params.uploadId);
  if (!row) return json({ error: 'not_found' }, 404);
  const object = await env.RFQ_UPLOADS?.get(row.r2_key);
  if (!object) { await audit(env, row, verified.subject, 'download_denied', 'failed', 'object_missing'); return json({ error: 'not_found' }, 404); }
  await audit(env, row, verified.subject, 'download_allowed', 'success', 'employee_download');
  const headers = new Headers(object.httpMetadata || {});
  headers.set('Content-Type', row.detected_type || 'application/octet-stream');
  headers.set('Content-Disposition', `attachment; filename="${String(row.original_name).replace(/[^A-Za-z0-9._-]/g, '_')}"`);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Cache-Control', 'no-store');
  return new Response(object.body || object, { status: 200, headers });
}

export async function onRequestPost({ request, env, params, action = 'approve' }) {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const verified = await actor(request, env);
  if (!verified.ok) { await audit(env, null, null, action === 'approve' ? 'file_approved' : 'file_rejected', 'denied', verified.reason); return json({ error: 'unauthorized' }, 401); }
  const row = await rowFor(env, params.leadId, params.uploadId);
  if (!row) return json({ error: 'not_found' }, 404);
  let next;
  try { next = transitionUpload(row.security_status, action, { type: 'employee', id: verified.subject }); } catch {
    await audit(env, row, verified.subject, auditActionForTransition(action), 'denied', 'invalid_state');
    return json({ error: 'invalid_state' }, 409);
  }
  const reason = action === 'reject' ? ((await request.json().catch(() => ({}))).reason || 'review_rejected').slice(0, 200) : null;
  const update = await env.DB.prepare("UPDATE lead_uploads SET security_status = ?, reviewed_at = ?, reviewed_by = ?, rejection_reason = ? WHERE id = ? AND lead_id = ? AND security_status = 'quarantine'")
    .bind(next, new Date().toISOString(), verified.subject, reason, params.uploadId, Number(params.leadId)).run();
  if (update?.meta?.changes !== 1) {
    await audit(env, row, verified.subject, auditActionForTransition(action), 'denied', 'invalid_state');
    return json({ error: 'invalid_state' }, 409);
  }
  await audit(env, row, verified.subject, auditActionForTransition(action), 'success', action === 'approve' ? 'approved' : 'rejected');
  return json({ ok: true, security_status: next }, 200);
}
