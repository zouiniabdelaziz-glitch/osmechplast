import test from 'node:test';
import assert from 'node:assert/strict';
import { readMultipartRequest, limitCases } from '../functions/upload/validation.mjs';

test('rejects a streamed multipart body beyond aggregate limit', async () => {
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(limitCases.maxBodyBytes + 1)); controller.close(); } });
  const request = new Request('https://osmechplast.com/api/leads', { method: 'POST', body: stream, headers: { 'Content-Type': 'multipart/form-data; boundary=x', 'Content-Length': '1' }, duplex: 'half' });
  await assert.rejects(() => readMultipartRequest(request), /payload_too_large/);
});
