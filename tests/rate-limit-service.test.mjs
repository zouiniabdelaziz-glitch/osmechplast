import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

async function loadApi() {
  return import(`${pathToFileURL(path.resolve('functions/api/leads.js')).href}?${Math.random()}`);
}

async function loadWorker() {
  return import(`${pathToFileURL(path.resolve('workers/rfq-rate-limit-preview.js')).href}?${Math.random()}`);
}

function request(ip = '203.0.113.10') {
  return new Request('https://rfq-upload-preview.osmechplast.pages.dev/api/leads', {
    method: 'POST',
    headers: { 'CF-Connecting-IP': ip }
  });
}

test('Pages service binding allows a request and sends route plus client IP', async () => {
  const api = await loadApi();
  let forwarded;
  const env = {
    RATE_LIMIT_SERVICE: {
      async fetch(serviceRequest) {
        forwarded = serviceRequest;
        return new Response(JSON.stringify({ allowed: true }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
    }
  };
  assert.deepEqual(await api.checkUploadRateLimit({ request: request(), env }), { allowed: true });
  assert.equal(forwarded.method, 'POST');
  assert.equal(forwarded.headers.get('X-Rate-Limit-Key'), '/api/leads:203.0.113.10');
});

test('Pages service binding blocks with neutral retry information', async () => {
  const api = await loadApi();
  const env = { RATE_LIMIT_SERVICE: { fetch: async () => new Response(JSON.stringify({ allowed: false, retryAfter: 10 }), { status: 200 }) } };
  assert.deepEqual(await api.checkUploadRateLimit({ request: request(), env }), { allowed: false, retryAfter: 10 });
});

test('missing, failing, or malformed service binding fails closed', async () => {
  const api = await loadApi();
  for (const env of [
    {},
    { RATE_LIMIT_SERVICE: { fetch: async () => { throw new Error('network'); } } },
    { RATE_LIMIT_SERVICE: { fetch: async () => new Response('not-json', { status: 200 }) } },
    { RATE_LIMIT_SERVICE: { fetch: async () => new Response(JSON.stringify({ allowed: true }), { status: 500 }) } }
  ]) {
    assert.deepEqual(await api.checkUploadRateLimit({ request: request(), env }), { allowed: false, retryAfter: 60 });
  }
  assert.deepEqual(await api.checkUploadRateLimit({ request: request(), env: { RATE_LIMIT_RULE_CONFIRMED: '1' } }), { allowed: false, retryAfter: 60 });
});

test('service rejection returns 429 before body, D1, or R2 access', async () => {
  const api = await loadApi();
  const requestWithUnreadableBody = {
    url: 'https://rfq-upload-preview.osmechplast.pages.dev/api/leads',
    method: 'POST',
    headers: new Headers({ 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.10' }),
    get body() { throw new Error('body must not be read'); }
  };
  const env = {
    RATE_LIMIT_SERVICE: { fetch: async () => new Response(JSON.stringify({ allowed: false, retryAfter: 10 })) },
    DB: { prepare() { throw new Error('D1 must not be touched'); } },
    RFQ_UPLOADS: { put() { throw new Error('R2 must not be touched'); } },
    RUNTIME_ENV: 'preview',
    PREVIEW_API_ENABLED: '1',
    PREVIEW_API_HOST: 'rfq-upload-preview.osmechplast.pages.dev'
  };
  const response = await api.onRequestPost({ request: requestWithUnreadableBody, env });
  assert.equal(response.status, 429);
  assert.deepEqual(await response.json(), { ok: false, error: 'rate_limited' });
});

test('missing client IP uses a fixed bounded key', async () => {
  const api = await loadApi();
  let key;
  const env = { RATE_LIMIT_SERVICE: { fetch: async (serviceRequest) => { key = serviceRequest.headers.get('X-Rate-Limit-Key'); return new Response(JSON.stringify({ allowed: true })); } } };
  assert.deepEqual(await api.checkUploadRateLimit({ request: request(''), env }), { allowed: true });
  assert.equal(key, '/api/leads:unknown-client');
});

test('rate-limit service worker calls RATE_LIMITER and returns neutral decisions', async () => {
  const worker = await loadWorker();
  const calls = [];
  const env = { RATE_LIMITER: { async limit(value) { calls.push(value); return { success: true }; } } };
  const response = await worker.default.fetch(new Request('https://internal/check', { method: 'POST', headers: { 'X-Rate-Limit-Key': '/api/leads:203.0.113.10' } }), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { allowed: true });
  assert.deepEqual(calls, [{ key: '/api/leads:203.0.113.10' }]);
  const blocked = await worker.default.fetch(new Request('https://internal/check', { method: 'POST', headers: { 'X-Rate-Limit-Key': '/api/leads:203.0.113.10' } }), { RATE_LIMITER: { limit: async () => ({ success: false }) } });
  assert.equal(blocked.status, 200);
  assert.deepEqual(await blocked.json(), { allowed: false, retryAfter: 10 });
});

test('rate-limit worker fails closed without binding or with invalid input', async () => {
  const worker = await loadWorker();
  for (const [requestValue, env] of [
    [new Request('https://internal/check'), {}],
    [new Request('https://internal/check', { headers: { 'X-Rate-Limit-Key': '' } }), { RATE_LIMITER: { limit: async () => ({ success: true }) } }],
    [new Request('https://internal/check', { headers: { 'X-Rate-Limit-Key': '/api/leads:x' } }), { RATE_LIMITER: { limit: async () => { throw new Error('failed'); } } }]
  ]) {
    const response = await worker.default.fetch(requestValue, env);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { allowed: false, retryAfter: 10 });
  }
});

test('preview worker is private and uses a distinct positive namespace from production placeholder', () => {
  const config = fs.readFileSync(path.resolve('wrangler.rate-limit.preview.jsonc'), 'utf8');
  assert.match(config, /"workers_dev"\s*:\s*false/);
  assert.match(config, /"name"\s*:\s*"RATE_LIMITER"/);
  assert.match(config, /"namespace_id"\s*:\s*"91001"/);
  assert.match(config, /"limit"\s*:\s*5/);
  assert.match(config, /"period"\s*:\s*10/);
  assert.doesNotMatch(config, /TODO_PRODUCTION_NAMESPACE_ID/);
  assert.match(config, /Production namespace must be different/i);
});
