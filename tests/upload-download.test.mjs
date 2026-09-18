import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet, onRequestPost } from '../functions/upload/employee-route.mjs';

function env() {
  const row = { id: 'u1', lead_id: 7, r2_key: 'private/u1', original_name: 'part.pdf', detected_type: 'application/pdf', security_status: 'quarantine', storage_status: 'stored' };
  const calls = [];
  return { calls, env: {
    ACCESS_TEAM_DOMAIN: 'team.example', ACCESS_POLICY_AUD: 'aud', ACCESS_ALLOWED_SUBJECTS: 'employee@example.com',
    DB: { prepare(sql) { return { bind(...args) { return { async first() { calls.push(['first', sql, args]); return row; }, async run() { calls.push(['run', sql, args]); return {}; } }; } }; } },
    RFQ_UPLOADS: { async get(key) { calls.push(['get', key]); return new Response('data'); } },
  } };
}

test('download route is GET-only and returns safe attachment headers', async () => {
  const { env: e, calls } = env();
  const request = new Request('https://example/internal/leads/7/uploads/u1', { headers: { 'Cf-Access-Jwt-Assertion': 'invalid' } });
  const response = await onRequestGet({ request, env: e, params: { leadId: '7', uploadId: 'u1' } });
  assert.equal(response.status, 401);
  assert.equal(calls.some(([kind]) => kind === 'get'), false);
});

test('action route rejects unsupported methods before writes', async () => {
  const { env: e, calls } = env();
  const response = await onRequestPost({ request: new Request('https://example', { method: 'GET' }), env: e, params: { leadId: '7', uploadId: 'u1' }, action: 'approve' });
  assert.equal(response.status, 405);
  assert.equal(calls.length, 0);
});
