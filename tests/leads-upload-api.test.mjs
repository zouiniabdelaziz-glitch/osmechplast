import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

async function loadApi() {
  const source = fs.readFileSync('functions/api/leads.js', 'utf8');
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${Math.random()}`);
}

test('verifyTurnstile fails closed without a token or secret', async () => {
  const api = await loadApi();
  assert.equal(await api.verifyTurnstile('', '', {}), false);
  assert.equal(await api.verifyTurnstile('token', '127.0.0.1', {}), false);
});

test('verifyTurnstile accepts only a successful Siteverify response', async () => {
  const api = await loadApi();
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };
  assert.equal(await api.verifyTurnstile('token', '127.0.0.1', { TURNSTILE_SECRET_KEY: 'secret', fetchImpl }), true);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /siteverify/);
  const body = calls[0].options.body.toString();
  assert.match(body, /secret/);
  assert.match(body, /token/);
});

function requestDb(rows = [], insertedChanges = rows.length ? 0 : 1) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return { bind(...values) { calls.push({ sql, values }); return { async run() { return { success: true, meta: { changes: insertedChanges } }; }, async first() { return rows.find(row => row.request_id === values[0]) || null; } }; } };
    }
  };
}

test('reserveRequest creates a processing row and exposes duplicate states', async () => {
  const api = await loadApi();
  const db = requestDb();
  assert.deepEqual(await api.reserveRequest(db, '123e4567-e89b-42d3-a456-426614174000', '2026-01-01'), { state: 'processing' });
  const duplicateDb = requestDb([{ request_id: '123e4567-e89b-42d3-a456-426614174000', state: 'processing' }]);
  assert.deepEqual(await api.reserveRequest(duplicateDb, '123e4567-e89b-42d3-a456-426614174000', '2026-01-01'), { state: 'processing' });
  assert.equal(duplicateDb.calls.filter(call => /INSERT INTO leads|INSERT INTO lead_uploads/i.test(call.sql)).length, 0);
});

test('reserveRequest replays a stored success and does not reopen failed work', async () => {
  const api = await loadApi(); const id = '123e4567-e89b-42d3-a456-426614174000';
  const succeeded = requestDb([{ request_id: id, state: 'succeeded', lead_id: 7, response_code: 200, response_body: '{"ok":true}' }]);
  assert.deepEqual(await api.reserveRequest(succeeded, id), { state: 'succeeded', leadId: 7, response: { code: 200, body: { ok: true } } });
  const failed = requestDb([{ request_id: id, state: 'failed', response_code: 400, response_body: '{"ok":false,"error":"invalid_request"}' }]);
  assert.deepEqual(await api.reserveRequest(failed, id), { state: 'failed', response: { code: 400, body: { ok: false, error: 'invalid_request' } } });
});
