import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { FakeR2Bucket } from './r2-fake.mjs';

async function loadApi() {
  return import(`${pathToFileURL(path.resolve('functions/api/leads.js')).href}?${Math.random()}`);
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
      return { bind(...values) { calls.push({ sql, values }); return { async run() { return { success: true, meta: { changes: insertedChanges, last_row_id: 7 } }; }, async first() { return rows.find(row => row.request_id === values[0]) || null; } }; } };
    }
  };
}

test('reserveRequest creates a processing row and exposes duplicate states', async () => {
  const api = await loadApi();
  const db = requestDb();
  assert.deepEqual(await api.reserveRequest(db, '123e4567-e89b-42d3-a456-426614174000', '2026-01-01'), { state: 'processing', fresh: true });
  const duplicateDb = requestDb([{ request_id: '123e4567-e89b-42d3-a456-426614174000', state: 'processing' }]);
  assert.deepEqual(await api.reserveRequest(duplicateDb, '123e4567-e89b-42d3-a456-426614174000', '2026-01-01'), { state: 'processing', fresh: false });
  assert.equal(duplicateDb.calls.filter(call => /INSERT INTO leads|INSERT INTO lead_uploads/i.test(call.sql)).length, 0);
});

test('reserveRequest replays a stored success and does not reopen failed work', async () => {
  const api = await loadApi(); const id = '123e4567-e89b-42d3-a456-426614174000';
  const succeeded = requestDb([{ request_id: id, state: 'succeeded', lead_id: 7, response_code: 200, response_body: '{"ok":true}' }]);
  assert.deepEqual(await api.reserveRequest(succeeded, id), { state: 'succeeded', leadId: 7, response: { code: 200, body: { ok: true } } });
  const failed = requestDb([{ request_id: id, state: 'failed', response_code: 400, response_body: '{"ok":false,"error":"invalid_request"}' }]);
  assert.deepEqual(await api.reserveRequest(failed, id), { state: 'failed', response: { code: 400, body: { ok: false, error: 'invalid_request' } } });
});

test('createR2Key uses private unique extension-only keys and fake bucket stores objects', async () => {
  const api = await loadApi();
  const key = api.createR2Key('lead-1', '123e4567-e89b-42d3-a456-426614174000', 'pdf');
  assert.match(key, /^leads\/lead-1\/[0-9a-f-]+\.pdf$/);
  assert.doesNotMatch(key, /original|\.pdf\.pdf/i);
  const bucket = new FakeR2Bucket();
  await bucket.put(key, new Uint8Array([1, 2, 3]));
  await assert.rejects(() => bucket.put(key, new Uint8Array([4])));
  assert.equal((await bucket.get(key)).body.length, 3);
  assert.equal((await bucket.list()).objects.length, 1);
  await bucket.delete(key);
  assert.equal((await bucket.get(key)), null);
});

test('storeLeadAndUploads persists metadata, private objects and quarantine state', async () => {
  const api = await loadApi();
  const calls = [];
  const db = { prepare(sql) { return { bind(...values) { calls.push({ sql, values }); return { async run() { return { meta: { last_row_id: 42, changes: 1 } }; } }; } }; } };
  const r2 = new FakeR2Bucket();
  const result = await api.storeLeadAndUploads({
    db,
    r2,
    lead: { company: 'ACME', name: 'Test', email: 'test@example.com' },
    files: [{ originalName: 'part.step', extension: 'step', detectedType: 'model/step', bytes: new Uint8Array([1, 2, 3]), sha256: 'abc123' }],
    requestId: '123e4567-e89b-42d3-a456-426614174000',
    now: '2026-01-01T00:00:00.000Z'
  });
  assert.equal(result.leadId, 42);
  assert.equal(result.uploads.length, 1);
  assert.equal(result.uploads[0].storage_status, 'stored');
  assert.equal(result.uploads[0].security_status, 'quarantine');
  assert.equal((await r2.list()).objects.length, 1);
  assert.ok(calls.some(call => /INSERT INTO leads/i.test(call.sql)));
  assert.ok(calls.some(call => /INSERT INTO lead_uploads/i.test(call.sql)));
  assert.ok(calls.some(call => /UPDATE lead_uploads/i.test(call.sql)));
});

test('storeLeadAndUploads marks R2 failure and removes objects when final D1 update fails', async () => {
  const api = await loadApi();
  const sqlCalls = [];
  let mode = 'ok';
  const db = { prepare(sql) { return { bind(...values) { sqlCalls.push({ sql, values }); return { async run() {
    if (mode === 'r2-failure' && /INSERT INTO lead_uploads/i.test(sql)) return { meta: { changes: 1 } };
    if (mode === 'd1-final-failure' && /UPDATE lead_uploads SET storage_status/i.test(sql)) throw new Error('d1_update_failed');
    return { meta: { last_row_id: 7, changes: 1 } };
  } }; } }; } };
  const failingR2 = new FakeR2Bucket({ failPut: true });
  await assert.rejects(() => api.storeLeadAndUploads({ db, r2: failingR2, lead: { company: 'A', name: 'B', email: 'a@b.test' }, files: [{ originalName: 'a.pdf', extension: 'pdf', detectedType: 'application/pdf', bytes: new Uint8Array([1]), sha256: 'h' }] }));
  assert.ok(sqlCalls.some(call => /storage_status = 'failed'/i.test(call.sql)));
  mode = 'd1-final-failure';
  const r2 = new FakeR2Bucket();
  await assert.rejects(() => api.storeLeadAndUploads({ db, r2, lead: { company: 'A', name: 'B', email: 'a@b.test' }, files: [{ originalName: 'a.pdf', extension: 'pdf', detectedType: 'application/pdf', bytes: new Uint8Array([1]), sha256: 'h' }] }));
  assert.equal((await r2.list()).objects.length, 0);
});

test('storeLeadAndUploads rolls back all prior objects when file two or three fails', async () => {
  const api = await loadApi();
  for (const failAt of [2, 3]) {
    let puts = 0; const deleted = []; const calls = [];
    const db = { prepare(sql) { return { bind(...values) { calls.push({ sql, values }); return { async run() { return { meta: { last_row_id: 9, changes: 1 } }; } }; } }; } };
    const r2 = { async put(key) { puts += 1; if (puts === failAt) throw new Error('put_failed'); }, async delete(key) { deleted.push(key); }, async list() { return { objects: [] }; } };
    await assert.rejects(() => api.storeLeadAndUploads({ db, r2, lead: { company: 'A', name: 'B', email: 'a@b.test' }, files: [1,2,3].map((n) => ({ originalName: `a${n}.pdf`, extension: 'pdf', detectedType: 'application/pdf', bytes: new Uint8Array([n]), sha256: `h${n}` })) }));
    assert.equal(deleted.length, failAt - 1);
    assert.ok(calls.some((call) => /UPDATE leads SET status = 'upload_failed'/i.test(call.sql)));
  }
});

test('multipart request is parsed and validated before upload transaction', async () => {
  const api = await loadApi();
  const form = new FormData();
  form.set('company', 'ACME'); form.set('name', 'Test'); form.set('email', 'test@example.com');
  form.set('turnstile_token', 'expected'); form.set('language', 'de'); form.set('service', 'cnc-drehen');
  form.append('files', new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x0a, 0x25, 0x25, 0x45, 0x4f, 0x46])], 'part.pdf', { type: 'application/pdf' }));
  const db = requestDb();
  const r2 = new FakeR2Bucket();
  const response = await api.onRequestPost({ request: new Request('http://localhost:8080/api/leads', { method: 'POST', body: form, headers: { 'X-Request-ID': '123e4567-e89b-42d3-a456-426614174000' } }), env: { DB: db, RFQ_UPLOADS: r2, TURNSTILE_TEST_MODE: '1', TURNSTILE_TEST_TOKEN: 'expected', RUNTIME_ENV: 'local', RATE_LIMIT_TEST_MODE: '1', rateLimitStore: new Map() } });
  assert.equal(response.status, 200);
  assert.equal((await r2.list()).objects.length, 1);
});
