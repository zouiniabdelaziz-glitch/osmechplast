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
