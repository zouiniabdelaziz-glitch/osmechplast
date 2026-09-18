import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

async function loadApi() {
  return import(`${pathToFileURL(path.resolve('functions/api/leads.js')).href}?${Math.random()}`);
}

test('deterministic local limiter blocks repeated requests and exposes a retry window', async () => {
  const api = await loadApi();
  const env = { RATE_LIMIT_TEST_MODE: '1', RATE_LIMIT_TEST_MAX: '2', RATE_LIMIT_TEST_WINDOW_MS: '10000', rateLimitStore: new Map() };
  const request = new Request('http://localhost/api/leads', { headers: { 'CF-Connecting-IP': '127.0.0.1' } });
  assert.deepEqual(await api.checkUploadRateLimit({ request, env }), { allowed: true });
  assert.deepEqual(await api.checkUploadRateLimit({ request, env }), { allowed: true });
  const blocked = await api.checkUploadRateLimit({ request, env });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfter, 10);
});

test('production limiter fails closed without an approved binding or rule', async () => {
  const api = await loadApi();
  const result = await api.checkUploadRateLimit({ request: new Request('https://osmechplast.com/api/leads'), env: {} });
  assert.equal(result.allowed, false);
  assert.equal(result.retryAfter, 60);
});

test('blocked upload returns 429 before reading body or touching D1/R2', async () => {
  const api = await loadApi();
  const db = { prepare() { throw new Error('D1 must not be touched'); } };
  const request = { url: 'https://osmechplast.com/api/leads', headers: new Headers({ 'Content-Type': 'application/json', 'CF-Connecting-IP': '127.0.0.1' }), get body() { throw new Error('body must not be read'); } };
  const env = { DB: db, RATE_LIMIT_TEST_MODE: '1', RATE_LIMIT_TEST_MAX: '0', rateLimitStore: new Map([['127.0.0.1', { startedAt: Date.now(), count: 0 }]]) };
  const response = await api.onRequestPost({ request, env });
  assert.equal(response.status, 429);
  assert.deepEqual(await response.json(), { ok: false, error: 'rate_limited' });
});
