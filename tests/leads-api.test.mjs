import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

async function loadApi() {
  const source = fs.readFileSync('functions/api/leads.js', 'utf8');
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${Math.random()}`;
  return import(url);
}

function makeDb({ error } = {}) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...values) {
          calls.push({ sql, values });
          return {
            async run() {
              if (error) throw error;
              return { success: true };
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
    ...overrides
  };
}

function requestWith(body, headers = {}) {
  return new Request('https://osmechplast.com/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://osmechplast.com', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
}

test('accepts one valid same-origin JSON lead and writes normalized values once', async () => {
  const api = await loadApi();
  const db = makeDb();

  const response = await api.onRequestPost({ request: requestWith(validLead()), env: { DB: db } });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { ok: true });
  assert.equal(db.calls.length, 1);
  assert.deepEqual(db.calls[0].values.slice(0, 6), [
    'Muster GmbH', 'Erika Muster', 'einkauf@example.com', '+49 123 456',
    'cnc-drehen', 'Bitte Machbarkeit prüfen.'
  ]);
  assert.equal(db.calls[0].values[7], 'de');
  assert.equal(db.calls[0].values[8], 'website');
  assert.equal(db.calls[0].values[9], 'new');
  assert.notEqual(db.calls[0].values[10], '2000-01-01T00:00:00.000Z');
});

test('rejects malformed JSON with 400 and a public error code', async () => {
  const api = await loadApi();
  const db = makeDb();

  const response = await api.onRequestPost({ request: requestWith('{broken'), env: { DB: db } });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { ok: false, error: 'invalid_request' });
  assert.equal(db.calls.length, 0);
});

test('rejects a missing or invalid email with 400 without touching D1', async () => {
  const api = await loadApi();
  for (const email of ['', 'not-an-email', 'name@', '@example.com']) {
    const db = makeDb();
    const response = await api.onRequestPost({ request: requestWith(validLead({ email })), env: { DB: db } });
    assert.equal(response.status, 400, email);
    assert.deepEqual(await response.json(), { ok: false, error: 'invalid_email' });
    assert.equal(db.calls.length, 0);
  }
});

test('rejects missing company or contact name with 400 without touching D1', async () => {
  const api = await loadApi();
  for (const values of [{ company: '' }, { name: '' }]) {
    const db = makeDb();
    const response = await api.onRequestPost({ request: requestWith(validLead(values)), env: { DB: db } });
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
    env: { DB: db }
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
    const response = await api.onRequestPost({ request: requestWith(validLead(values)), env: { DB: db } });
    assert.equal(response.status, 413, Object.keys(values)[0]);
    assert.deepEqual(await response.json(), { ok: false, error: 'payload_too_large' });
    assert.equal(db.calls.length, 0);
  }
});

test('rejects unsupported language and service values with 400', async () => {
  const api = await loadApi();
  for (const values of [{ language: 'xx' }, { service: 'laser-cutting' }]) {
    const db = makeDb();
    const response = await api.onRequestPost({ request: requestWith(validLead(values)), env: { DB: db } });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { ok: false, error: 'invalid_request' });
    assert.equal(db.calls.length, 0);
  }
});

test('returns a generic 500 response when D1 fails and does not expose err.message', async () => {
  const api = await loadApi();
  const db = makeDb({ error: new Error('secret D1 table name') });

  const response = await api.onRequestPost({ request: requestWith(validLead()), env: { DB: db } });
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
    env: { DB: db }
  });

  assert.notEqual(response.headers.get('Access-Control-Allow-Origin'), '*');
  assert.notEqual(response.headers.get('Access-Control-Allow-Origin'), 'https://attacker.example');
});
