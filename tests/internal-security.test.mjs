import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseLeadId,
  parseUploadId,
  readInternalJson,
  requireInternalMutationOrigin,
  withInternalHeaders,
} from '../functions/internal/security.mjs';
import { onRequest as internalMiddleware } from '../functions/internal/_middleware.js';
import { onRequest as rootMiddleware } from '../functions/_middleware.js';

test('parses only canonical safe internal identifiers', () => {
  assert.equal(parseLeadId('42'), 42);
  assert.throws(() => parseLeadId('042'), /invalid_lead_id/);
  assert.throws(() => parseLeadId('1e2'), /invalid_lead_id/);
  assert.throws(() => parseLeadId('9007199254740992'), /invalid_lead_id/);
  assert.equal(parseUploadId('00000000-0000-4000-8000-000000000001'), '00000000-0000-4000-8000-000000000001');
  assert.throws(() => parseUploadId('00000000-0000-0000-8000-000000000001'), /invalid_upload_id/);
});

test('reads bounded UTF-8 JSON and rejects media, unknown JSON and byte-limit violations', async () => {
  const valid = new Request('https://internal.example/internal/api', { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify({ target_status: 'completed' }) });
  assert.deepEqual(await readInternalJson(valid, { maxBytes: 4096, allowedFields: ['target_status'] }), { target_status: 'completed' });
  await assert.rejects(() => readInternalJson(new Request('https://internal.example', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' }), { maxBytes: 4096 }), /unsupported_media_type/);
  await assert.rejects(() => readInternalJson(new Request('https://internal.example', { method: 'POST', headers: { 'content-type': 'application/jsonBOGUS' }, body: '{}' }), { maxBytes: 4096 }), /unsupported_media_type/);
  await assert.rejects(() => readInternalJson(new Request('https://internal.example', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ unknown: true }) }), { maxBytes: 4096, allowedFields: ['target_status'] }), /invalid_request/);
  await assert.rejects(() => readInternalJson(new Request('https://internal.example', { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'x'.repeat(4097) }), { maxBytes: 4096 }), /payload_too_large/);
});

test('cancels an oversized JSON stream immediately after crossing the byte limit', async () => {
  let pulls = 0;
  let cancelled = false;
  const stream = new ReadableStream({
    pull(controller) {
      pulls += 1;
      if (pulls === 1) controller.enqueue(new Uint8Array(4096));
      else if (pulls === 2) controller.enqueue(new Uint8Array(1));
      else controller.enqueue(new Uint8Array(1));
    },
    cancel() { cancelled = true; },
  });
  const request = new Request('https://internal.example', { method: 'POST', headers: { 'content-type': 'application/json' }, body: stream, duplex: 'half' });
  await assert.rejects(() => readInternalJson(request, { maxBytes: 4096 }), /payload_too_large/);
  assert.equal(cancelled, true);
  assert.equal(pulls, 2);
});

test('requires the configured same-origin mutation context and applies internal response headers', () => {
  const request = new Request('https://internal.example/internal/api', { method: 'POST', headers: { origin: 'https://internal.example' } });
  assert.equal(requireInternalMutationOrigin(request, { INTERNAL_ORIGIN: 'https://internal.example' }), undefined);
  assert.throws(() => requireInternalMutationOrigin(new Request(request, { headers: { origin: 'https://evil.example' } }), { INTERNAL_ORIGIN: 'https://internal.example' }), /origin_denied/);
  const response = withInternalHeaders(new Response('{}', { status: 400 }));
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
});

test('middleware authenticates every internal path before forwarding and leaves public paths alone', async () => {
  let forwarded = 0;
  const next = async () => { forwarded += 1; return new Response('ok'); };
  const protectedResponse = await internalMiddleware({
    request: new Request('https://internal.example/internal/style.css'),
    env: { INTERNAL_UI_ENABLED: '1' },
    next,
  });
  assert.equal(protectedResponse.status, 401);
  assert.equal(forwarded, 0);
  const publicResponse = await internalMiddleware({
    request: new Request('https://internal.example/contact/'),
    env: {},
    next,
  });
  assert.equal(publicResponse.status, 200);
  assert.equal(forwarded, 1);
  const rootResponse = await rootMiddleware({ request: new Request('https://internal.example/internal/internal.css'), env: {}, next });
  assert.equal(rootResponse.status, 401);
});
