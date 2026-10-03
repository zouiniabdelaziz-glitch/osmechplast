import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { onRequestGet, onRequestPost } from '../functions/upload/employee-route.mjs';

function env() {
  const row = { id: 'u1', lead_id: 7, r2_key: 'private/u1', original_name: 'part.pdf', detected_type: 'application/pdf', security_status: 'quarantine', storage_status: 'stored' };
  const calls = [];
  return { calls, row, env: {
    INTERNAL_ORIGIN: 'https://internal.example',
    ACCESS_TEAM_DOMAIN: 'team.example', ACCESS_POLICY_AUD: 'aud', ACCESS_ALLOWED_SUBJECTS: 'employee@example.com',
    DB: { prepare(sql) { return { bind(...args) { return { async first() { calls.push(['first', sql, args]); return /internal_review_control/.test(sql) ? { enabled: 1, protocol_version: 2 } : row; }, async run() { calls.push(['run', sql, args]); return {}; } }; } }; } },
    RFQ_UPLOADS: { async get(key) { calls.push(['get', key]); return new Response('data'); } },
  } };
}

function signedAssertion() {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'k1' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: 'https://team.example', aud: ['aud'], sub: 'employee@example.com', exp: Math.floor(Date.now()/1000)+60, nbf: Math.floor(Date.now()/1000)-1 })).toString('base64url');
  const input = `${header}.${payload}`; const token = `${input}.${sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')}`;
  return { token, jwk: publicKey.export({ format: 'jwk' }) };
}

test('download route is GET-only and returns safe attachment headers', async () => {
  const { env: e, calls } = env();
  const request = new Request('https://example/internal/leads/7/uploads/u1', { headers: { 'Cf-Access-Jwt-Assertion': 'invalid' } });
  const response = await onRequestGet({ request, env: e, params: { leadId: '7', uploadId: 'u1' } });
  assert.equal(response.status, 401);
  assert.equal(calls.some(([kind]) => kind === 'get'), false);
  const auditCall = calls.find(([kind, sql]) => kind === 'run' && /upload_audit_log/i.test(sql));
  assert.ok(auditCall);
  assert.equal(auditCall[2][2], 'unknown');
  assert.equal(auditCall[2][3], null);
});

test('action route rejects unsupported methods before writes', async () => {
  const { env: e, calls } = env();
  const response = await onRequestPost({ request: new Request('https://example', { method: 'GET' }), env: e, params: { leadId: '7', uploadId: 'u1' }, action: 'approve' });
  assert.equal(response.status, 405);
  assert.equal(calls.length, 0);
});

test('authorized employee receives the R2 body with safe download headers', async () => {
  const { env: e } = env(); const assertion = signedAssertion();
  e.ACCESS_TEAM_DOMAIN = 'team.example'; e.ACCESS_POLICY_AUD = 'aud'; e.ACCESS_ALLOWED_SUBJECTS = 'employee@example.com'; e.INTERNAL_LOCAL_TEST = '1'; e.ACCESS_JWKS_URL = 'http://local-jwks.test/cdn-cgi/access/certs';
  e.fetchImpl = async () => new Response(JSON.stringify({ keys: [{ ...assertion.jwk, kid: 'k1', alg: 'RS256', use: 'sig' }] }));
  const response = await onRequestGet({ request: new Request('https://example', { headers: { 'Cf-Access-Jwt-Assertion': assertion.token } }), env: e, params: { leadId: '7', uploadId: 'u1' } });
  assert.equal(response.status, 200); assert.equal(await response.text(), 'data');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.match(response.headers.get('Content-Disposition'), /attachment/);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('review action rejects a concurrent second transition when no row changed', async () => {
  const { env: e, calls } = env(); const assertion = signedAssertion();
  e.ACCESS_TEAM_DOMAIN = 'team.example'; e.ACCESS_POLICY_AUD = 'aud'; e.ACCESS_ALLOWED_SUBJECTS = 'employee@example.com';
  e.fetchImpl = async () => new Response(JSON.stringify({ keys: [{ ...assertion.jwk, kid: 'k1', alg: 'RS256', use: 'sig' }] }));
  e.DB = { prepare(sql) { return { bind(...args) { return { async first() { return /internal_review_control/.test(sql) ? { enabled: 1, protocol_version: 2 } : { id: 'u1', lead_id: 7, storage_status: 'stored', security_status: 'quarantine' }; }, async run() { calls.push(['run', sql, args]); return { meta: { changes: /UPDATE lead_uploads/.test(sql) ? 0 : 1 } }; } }; } }; } };
  const response = await onRequestPost({ request: new Request('https://example', { method: 'POST', headers: { origin: 'https://internal.example', 'content-type': 'application/json', 'Cf-Access-Jwt-Assertion': assertion.token }, body: '{}' }), env: e, params: { leadId: '7', uploadId: 'u1' }, action: 'approve' });
  assert.equal(response.status, 409);
  assert.ok(calls.some(([kind, sql, args]) => kind === 'run' && /upload_audit_log/i.test(sql) && args.includes('invalid_state')));
});

test('review action does not claim a concurrent winner with the same target status', async () => {
  const { env: e } = env(); const assertion = signedAssertion(); let rowReads = 0;
  e.fetchImpl = async () => new Response(JSON.stringify({ keys: [{ ...assertion.jwk, kid: 'k1', alg: 'RS256', use: 'sig' }] }));
  e.DB = {
    prepare(sql) {
      return {
        bind() {
          return {
            async first() {
              if (/internal_review_control/.test(sql)) return { enabled: 1, protocol_version: 2 };
              if (/upload_audit_log/.test(sql)) return null;
              rowReads += 1;
              return rowReads === 1
                ? { id: 'u1', lead_id: 7, storage_status: 'stored', security_status: 'quarantine' }
                : { id: 'u1', lead_id: 7, storage_status: 'stored', security_status: 'approved', reviewed_by: 'other-employee', review_request_id: 'winner-request', reviewed_at: '2026-09-28T00:00:00.000Z' };
            },
            async run() { return { meta: { changes: 2 } }; },
          };
        },
      };
    },
  };
  const response = await onRequestPost({ request: new Request('https://example', { method: 'POST', headers: { origin: 'https://internal.example', 'content-type': 'application/json', 'Cf-Access-Jwt-Assertion': assertion.token }, body: '{}' }), env: e, params: { leadId: '7', uploadId: 'u1' }, action: 'approve' });
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: 'invalid_state' });
});

test('review action audits an invalid transition from rejected state', async () => {
  const fixture = env();
  fixture.row.security_status = 'rejected';
  const assertion = signedAssertion();
  fixture.env.fetchImpl = async () => new Response(JSON.stringify({ keys: [{ ...assertion.jwk, kid: 'k1', alg: 'RS256', use: 'sig' }] }));
  const response = await onRequestPost({
    request: new Request('https://example', { method: 'POST', headers: { origin: 'https://internal.example', 'content-type': 'application/json', 'Cf-Access-Jwt-Assertion': assertion.token }, body: '{}' }),
    env: fixture.env,
    params: { leadId: '7', uploadId: 'u1' },
    action: 'approve'
  });
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: 'invalid_state' });
  const auditCall = fixture.calls.find(([kind, sql, args]) => kind === 'run' && /upload_audit_log/i.test(sql) && args.includes('invalid_state'));
  assert.ok(auditCall, 'invalid transition must be audited');
  assert.equal(auditCall[2][0], 'u1');
  assert.equal(auditCall[2][1], 7);
  assert.equal(auditCall[2][2], 'employee');
  assert.equal(auditCall[2][3], 'employee@example.com');
  assert.equal(auditCall[2][5], 'file_approved');
  assert.equal(auditCall[2][6], 'denied');
  assert.equal(auditCall[2][7], 'invalid_state');
});

test('review actions enforce same-origin JSON and bounded bodies before writes', async () => {
  const fixture = env(); const assertion = signedAssertion();
  fixture.env.fetchImpl = async () => new Response(JSON.stringify({ keys: [{ ...assertion.jwk, kid: 'k1', alg: 'RS256', use: 'sig' }] }));
  const headers = { origin: 'https://other.example', 'content-type': 'application/json', 'Cf-Access-Jwt-Assertion': assertion.token };
  const originDenied = await onRequestPost({ request: new Request('https://example', { method: 'POST', headers, body: '{}' }), env: fixture.env, params: { leadId: '7', uploadId: 'u1' }, action: 'approve' });
  assert.equal(originDenied.status, 403);
  assert.equal(fixture.calls.some(([kind]) => kind === 'run'), false);

  const unsupported = await onRequestPost({ request: new Request('https://example', { method: 'POST', headers: { origin: 'https://internal.example', 'Cf-Access-Jwt-Assertion': assertion.token }, body: '{}' }), env: fixture.env, params: { leadId: '7', uploadId: 'u1' }, action: 'approve' });
  assert.equal(unsupported.status, 415);

  const tooLarge = await onRequestPost({ request: new Request('https://example', { method: 'POST', headers: { origin: 'https://internal.example', 'content-type': 'application/json', 'Cf-Access-Jwt-Assertion': assertion.token }, body: JSON.stringify({ reason: 'x'.repeat(5000) }) }), env: fixture.env, params: { leadId: '7', uploadId: 'u1' }, action: 'reject' });
  assert.equal(tooLarge.status, 413);
});
