import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

async function loadApi() {
  return import(`${pathToFileURL(path.resolve('functions/api/leads.js')).href}?${Math.random()}`);
}

function makeDb({ error } = {}) {
  const calls = [];
  const requests = new Map();
  let leadId = 0;
  return {
    calls,
    prepare(sql) {
      return {
        bind(...values) {
          calls.push({ sql, values });
          return {
            async run() {
              if (error) throw error;
              if (/INSERT INTO lead_requests/i.test(sql)) {
                const id = values[0];
                if (requests.has(id)) return { success: true, meta: { changes: 0 } };
                requests.set(id, { request_id: id, state: 'processing', created_at: values[1] });
                return { success: true, meta: { changes: 1 } };
              }
              if (/INSERT INTO leads/i.test(sql)) {
                leadId += 1;
                return { success: true, meta: { last_row_id: leadId, changes: 1 } };
              }
              if (/UPDATE lead_requests SET state/i.test(sql)) {
                const id = values[values.length - 2]; const row = requests.get(id);
                if (row) { row.state = values[0]; row.lead_id = values[1]; row.response_code = values[2]; row.response_body = values[3]; }
              }
              return { success: true };
            },
            async first() {
              return requests.get(values[0]) || null;
            }
          };
        }
      };
    }
  };
}

function validLead(overrides = {}) {
  return {
    company: '  Muster GmbH  ',
    name: '  Erika Muster  ',
    email: '  einkauf@example.com  ',
    phone: ' +49 123 456 ',
    service: 'cnc-drehen',
    message: ' Bitte Machbarkeit prüfen. ',
    language: 'de',
    source: 'manipulated-client-source',
    status: 'won',
    created_at: '2000-01-01T00:00:00.000Z',
    turnstile_token: 'expected',
    ...overrides
  };
}

function requestWith(body, headers = {}, url = 'https://osmechplast.com/api/leads') {
  const requestId = headers['X-Request-ID'] || headers['x-request-id'] || body?.request_id || '123e4567-e89b-42d3-a456-426614174000';
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://osmechplast.com', 'X-Request-ID': requestId, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
}

function testEnv(db, local = false) {
  return local
    ? { DB: db, TURNSTILE_TEST_MODE: '1', TURNSTILE_TEST_TOKEN: 'expected', RUNTIME_ENV: 'local', RATE_LIMIT_TEST_MODE: '1', rateLimitStore: new Map() }
    : { DB: db, TURNSTILE_SECRET_KEY: 'test-secret', fetchImpl: async () => new Response(JSON.stringify({ success: true }), { status: 200 }), RUNTIME_ENV: 'production', RATE_LIMIT_TEST_MODE: '1', rateLimitStore: new Map() };
}

function byteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

function bodyWithExactBytes(targetBytes) {
  const body = { ...validLead(), padding: '' };
  while (byteLength(JSON.stringify(body)) < targetBytes) body.padding += 'a';
  assert.equal(byteLength(JSON.stringify(body)), targetBytes);
  return JSON.stringify(body);
}

function streamRequest(chunks, headers = {}) {
  let index = 0;
  const stats = { reads: 0, readerCalls: 0, cancelled: false };
  const stream = new ReadableStream({
    pull(controller) {
      stats.reads += 1;
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(chunks[index++]);
    },
    cancel() {
      stats.cancelled = true;
    }
  });
  const body = {
    getReader() {
      stats.readerCalls += 1;
      const reader = stream.getReader();
      return { read: (...args) => reader.read(...args), releaseLock: () => reader.releaseLock(), cancel: async (...args) => { stats.cancelled = true; return reader.cancel(...args); } };
    }
  };
  const request = {
    url: 'https://osmechplast.com/api/leads',
    headers: new Headers({ 'Content-Type': 'application/json', Origin: 'https://osmechplast.com', ...headers }),
    body,
    text: async () => {
      stats.textCalled = true;
      return '';
    }
  };
  return { request, stats };
}

const allowedOrigins = [
  'https://osmechplast.com',
  'https://www.osmechplast.com',
  'http://localhost:8080',
  'http://127.0.0.1:8788',
  'http://[::1]:8788'
];
const blockedOrigins = [
  'https://osmechplast.pages.dev',
  'https://HASH.osmechplast.pages.dev',
  'https://OSMECHPLAST.PAGES.DEV',
  'https://osmechplast.pages.dev.'
];

for (const origin of allowedOrigins) {
  test(`accepts a valid POST on ${origin}`, async () => {
    const api = await loadApi();
    const db = makeDb();
    const response = await api.onRequestPost({
      request: requestWith(validLead(), {}, `${origin}/api/leads`), env: testEnv(db)
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(db.calls.filter((call) => /INSERT INTO leads/i.test(call.sql)).length, 1);
  });
}

for (const origin of blockedOrigins) {
  test(`rejects POST on ${origin} before reading the body or accessing D1`, async () => {
    const api = await loadApi();
    // Forged forwarding headers must not override the actual request URL.
    const request = requestWith(validLead(), {
      'X-Forwarded-Host': 'osmechplast.com', Host: 'osmechplast.com'
    }, `${origin}/api/leads`);
    let bodyReads = 0;
    request.text = async () => { bodyReads++; return JSON.stringify(validLead()); };
    let dbAccesses = 0;
    const db = makeDb();
    const env = { get DB() { dbAccesses++; return db; } };
    const response = await api.onRequestPost({ request, env });
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { ok: false, error: 'forbidden' });
    assert.equal(bodyReads, 0);
    assert.equal(dbAccesses, 0);
    assert.equal(db.calls.length, 0);
  });
}

test('keeps GET at 405 and OPTIONS at 204 on custom, local and pages.dev hosts', async () => {
  const api = await loadApi();
  for (const origin of [...allowedOrigins, ...blockedOrigins]) {
    const db = makeDb();
    const get = await api.onRequestGet({
      request: new Request(`${origin}/api/leads`), env: testEnv(db)
    });
    assert.equal(get.status, 405);
    assert.deepEqual(await get.json(), { ok: false, error: 'method_not_allowed' });
    const options = await api.onRequestOptions({
      request: new Request(`${origin}/api/leads`, { method: 'OPTIONS' }), env: testEnv(db)
    });
    assert.equal(options.status, 204);
    assert.equal(await options.text(), '');
    assert.equal(options.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS');
    assert.equal(db.calls.length, 0);
  }
});

test('accepts one valid same-origin JSON lead and writes normalized values once', async () => {
  const api = await loadApi();
  const db = makeDb();

  const response = await api.onRequestPost({ request: requestWith(validLead()), env: testEnv(db) });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { ok: true });
  const leadCall = db.calls.find((call) => /INSERT INTO leads/i.test(call.sql));
  assert.ok(leadCall);
  assert.deepEqual(leadCall.values.slice(0, 6), [
    'Muster GmbH', 'Erika Muster', 'einkauf@example.com', '+49 123 456',
    'cnc-drehen', 'Bitte Machbarkeit prüfen.'
  ]);
  assert.equal(leadCall.values[7], 'de');
  assert.equal(leadCall.values[8], 'website');
  assert.equal(leadCall.values[9], 'new');
  assert.notEqual(leadCall.values[10], '2000-01-01T00:00:00.000Z');
});

test('rejects malformed JSON with 400 and a public error code', async () => {
  const api = await loadApi();
  const db = makeDb();

  const response = await api.onRequestPost({ request: requestWith('{broken'), env: testEnv(db) });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { ok: false, error: 'invalid_request' });
  assert.equal(db.calls.length, 0);
});

test('rejects a missing or invalid email with 400 without touching D1', async () => {
  const api = await loadApi();
  for (const email of ['', 'not-an-email', 'name@', '@example.com']) {
    const db = makeDb();
    const response = await api.onRequestPost({ request: requestWith(validLead({ email })), env: testEnv(db) });
    assert.equal(response.status, 400, email);
    assert.deepEqual(await response.json(), { ok: false, error: 'invalid_email' });
    assert.equal(db.calls.length, 0);
  }
});

test('rejects missing company or contact name with 400 without touching D1', async () => {
  const api = await loadApi();
  for (const values of [{ company: '' }, { name: '' }]) {
    const db = makeDb();
    const response = await api.onRequestPost({ request: requestWith(validLead(values)), env: testEnv(db) });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { ok: false, error: 'invalid_request' });
    assert.equal(db.calls.length, 0);
  }
});

test('rejects non-JSON content types with 400 without touching D1', async () => {
  const api = await loadApi();
  const db = makeDb();
  const response = await api.onRequestPost({
    request: requestWith(validLead(), { 'Content-Type': 'text/plain' }),
    env: testEnv(db)
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { ok: false, error: 'invalid_request' });
  assert.equal(db.calls.length, 0);
});

test('rejects fields above their limits with 413 without touching D1', async () => {
  const api = await loadApi();
  const cases = [
    { company: 'a'.repeat(201) },
    { name: 'a'.repeat(151) },
    { email: `${'a'.repeat(245)}@example.com` },
    { phone: '1'.repeat(51) },
    { service: 'a'.repeat(81) },
    { message: 'a'.repeat(5001) }
  ];
  for (const values of cases) {
    const db = makeDb();
    const response = await api.onRequestPost({ request: requestWith(validLead(values)), env: testEnv(db) });
    assert.equal(response.status, 413, Object.keys(values)[0]);
    assert.deepEqual(await response.json(), { ok: false, error: 'payload_too_large' });
    assert.equal(db.calls.length, 0);
  }
});

test('JSON idempotency replays success without creating a second lead', async () => {
  const api = await loadApi(); const db = makeDb(); const env = testEnv(db);
  const requestId = '223e4567-e89b-42d3-a456-426614174000';
  const first = await api.onRequestPost({ request: requestWith(validLead(), { 'X-Request-ID': requestId }), env });
  const second = await api.onRequestPost({ request: requestWith(validLead(), { 'X-Request-ID': requestId }), env });
  assert.equal(first.status, 200); assert.equal(second.status, 200);
  assert.equal(db.calls.filter((call) => /INSERT INTO leads/i.test(call.sql)).length, 1);
});

test('local Turnstile test mode is rejected on production hosts', async () => {
  const api = await loadApi(); const db = makeDb();
  const response = await api.onRequestPost({ request: requestWith(validLead(), {}, 'https://osmechplast.com/api/leads'), env: { ...testEnv(db, true), RUNTIME_ENV: 'production' } });
  assert.equal(response.status, 403);
  assert.equal(db.calls.some((call) => /INSERT INTO leads/i.test(call.sql)), false);
});

test('rejects a JSON request without Turnstile before D1 access', async () => {
  const api = await loadApi();
  const db = makeDb();
  const response = await api.onRequestPost({ request: requestWith(validLead({ turnstile_token: '' })), env: { DB: db, TURNSTILE_TEST_MODE: '1', TURNSTILE_TEST_TOKEN: 'expected', RATE_LIMIT_TEST_MODE: '1', rateLimitStore: new Map() } });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { ok: false, error: 'verification_failed' });
  assert.equal(db.calls.length, 0);
});

test('rejects a declared body over 16 KiB before reading it or accessing D1', async () => {
  const api = await loadApi();
  const stream = streamRequest([new Uint8Array([123])], { 'Content-Length': '16385' });
  const db = makeDb();
  const response = await api.onRequestPost({ request: stream.request, env: testEnv(db) });

  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { ok: false, error: 'payload_too_large' });
  assert.equal(stream.stats.readerCalls, 0);
  assert.equal(stream.stats.textCalled, undefined);
  assert.equal(db.calls.length, 0);
});

test('counts streamed bytes and cancels after crossing 16 KiB', async () => {
  const api = await loadApi();
  const stream = streamRequest([
    new Uint8Array(16384),
    new Uint8Array([123])
  ]);
  const db = makeDb();
  const response = await api.onRequestPost({ request: stream.request, env: testEnv(db) });

  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { ok: false, error: 'payload_too_large' });
  assert.equal(stream.stats.readerCalls, 1);
  assert.ok(stream.stats.reads >= 2);
  assert.equal(stream.stats.cancelled, true);
  assert.equal(db.calls.length, 0);
});

test('does not trust a smaller Content-Length than the streamed body', async () => {
  const api = await loadApi();
  const stream = streamRequest([
    new Uint8Array(16384),
    new Uint8Array([123])
  ], { 'Content-Length': '1' });
  const db = makeDb();
  const response = await api.onRequestPost({ request: stream.request, env: testEnv(db) });

  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { ok: false, error: 'payload_too_large' });
  assert.equal(stream.stats.readerCalls, 1);
  assert.equal(stream.stats.cancelled, true);
  assert.equal(db.calls.length, 0);
});

test('accepts exactly 16 KiB and rejects 16 KiB plus one byte', async () => {
  const api = await loadApi();
  const exactDb = makeDb();
  const exact = bodyWithExactBytes(16384);
  const accepted = await api.onRequestPost({
    request: requestWith(exact, { 'Content-Length': '16384' }), env: testEnv(exactDb)
  });
  assert.equal(accepted.status, 200);
  assert.equal(exactDb.calls.filter((call) => /INSERT INTO leads/i.test(call.sql)).length, 1);

  const oversizedDb = makeDb();
  const oversized = bodyWithExactBytes(16385);
  const rejected = await api.onRequestPost({
    request: requestWith(oversized, { 'Content-Length': '16385' }), env: testEnv(oversizedDb)
  });
  assert.equal(rejected.status, 413);
  assert.deepEqual(await rejected.json(), { ok: false, error: 'payload_too_large' });
  assert.equal(oversizedDb.calls.length, 0);
});

test('uses UTF-8 byte length and does not allow invalid Content-Length values to bypass the stream limit', async () => {
  const api = await loadApi();
  const utf8 = JSON.stringify({ ...validLead(), padding: '€'.repeat(6000) });
  assert.ok(byteLength(utf8) > 16384);
  for (const contentLength of ['invalid', '-1']) {
    const stream = streamRequest([new TextEncoder().encode(utf8)], { 'Content-Length': contentLength });
    const db = makeDb();
    const response = await api.onRequestPost({ request: stream.request, env: testEnv(db) });
    assert.equal(response.status, 413, contentLength);
    assert.deepEqual(await response.json(), { ok: false, error: 'payload_too_large' });
    assert.equal(stream.stats.cancelled, true);
    assert.equal(db.calls.length, 0);
  }
});

test('rejects unsupported language and service values with 400', async () => {
  const api = await loadApi();
  for (const values of [{ language: 'xx' }, { service: 'laser-cutting' }]) {
    const db = makeDb();
    const response = await api.onRequestPost({ request: requestWith(validLead(values)), env: testEnv(db) });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { ok: false, error: 'invalid_request' });
    assert.equal(db.calls.length, 0);
  }
});

test('returns a generic 500 response when D1 fails and does not expose err.message', async () => {
  const api = await loadApi();
  const db = makeDb({ error: new Error('secret D1 table name') });

  const response = await api.onRequestPost({ request: requestWith(validLead()), env: testEnv(db) });
  const text = await response.text();

  assert.equal(response.status, 500);
  assert.deepEqual(JSON.parse(text), { ok: false, error: 'server_error' });
  assert.doesNotMatch(text, /secret D1 table name/);
});

test('does not reflect arbitrary Origin values in CORS headers', async () => {
  const api = await loadApi();
  const db = makeDb();
  const response = await api.onRequestPost({
    request: requestWith(validLead(), { Origin: 'https://attacker.example' }),
    env: testEnv(db)
  });

  assert.notEqual(response.headers.get('Access-Control-Allow-Origin'), '*');
  assert.notEqual(response.headers.get('Access-Control-Allow-Origin'), 'https://attacker.example');
});
