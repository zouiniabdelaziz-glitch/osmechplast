import test from 'node:test';
import assert from 'node:assert/strict';
import { readMultipartRequest, limitCases, validateUploadFile } from '../functions/upload/validation.mjs';

test('rejects a streamed multipart body beyond aggregate limit', async () => {
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(limitCases.maxBodyBytes + 1)); controller.close(); } });
  const request = new Request('https://osmechplast.com/api/leads', { method: 'POST', body: stream, headers: { 'Content-Type': 'multipart/form-data; boundary=x', 'Content-Length': '1' }, duplex: 'half' });
  await assert.rejects(() => readMultipartRequest(request), /payload_too_large/);
});

function multipart(parts, boundary = 'x') {
  return parts.map(({name,value,filename,type}) => `--${boundary}\r\nContent-Disposition: form-data; name="${name}"${filename ? `; filename="${filename}"` : ''}\r\n${filename ? `Content-Type: ${type}\r\n` : ''}\r\n${value}\r\n`).join('') + `--${boundary}--\r\n`;
}

test('parses fields and files when boundaries cross stream chunks', async () => {
  const raw = new TextEncoder().encode(multipart([{name:'company',value:'ACME'},{name:'upload',value:'%PDF-1.7\n%%EOF',filename:'a.pdf',type:'application/pdf'}]));
  const split = Math.floor(raw.length/2);
  const stream = new ReadableStream({ start(c){ c.enqueue(raw.slice(0,split)); c.enqueue(raw.slice(split)); c.close(); } });
  const parsed = await readMultipartRequest({ body: stream, headers: new Headers({'Content-Type':'multipart/form-data; boundary=x'}) });
  assert.equal(parsed.fields.get('company'),'ACME'); assert.equal(parsed.files.length,1); assert.equal(parsed.files[0].name,'a.pdf');
});

test('enforces five files and rejects malformed multipart', async () => {
  const body = multipart(Array.from({length:6},(_,i)=>({name:'file',value:'x',filename:`${i}.dxf`,type:'application/dxf'})));
  await assert.rejects(() => readMultipartRequest(new Request('https://osmechplast.com/api/leads',{method:'POST',body,headers:{'Content-Type':'multipart/form-data; boundary=x'}})), /too_many_files/);
  await assert.rejects(() => readMultipartRequest({body:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('bad'));c.close();}}),headers:new Headers({'Content-Type':'multipart/form-data'})}), /invalid_boundary/);
});

test('enforces the per-file byte limit and counts UTF-8 bytes', async () => {
  const make = (size) => {
    const head = new TextEncoder().encode('--x\r\nContent-Disposition: form-data; name="file"; filename="a.bin"\r\nContent-Type: application/octet-stream\r\n\r\n');
    const tail = new TextEncoder().encode('\r\n--x--\r\n');
    const out = new Uint8Array(head.length + size + tail.length); out.set(head); out.set(tail, head.length + size); return out;
  };
  const exact = await readMultipartRequest({ body: new ReadableStream({start(c){c.enqueue(make(limitCases.maxFileBytes));c.close();}}), headers: new Headers({'Content-Type':'multipart/form-data; boundary=x'}) });
  assert.equal(exact.files[0].bytes.byteLength, limitCases.maxFileBytes);
  await assert.rejects(() => readMultipartRequest({ body: new ReadableStream({start(c){c.enqueue(make(limitCases.maxFileBytes + 1));c.close();}}), headers: new Headers({'Content-Type':'multipart/form-data; boundary=x'}) }), /file_too_large/);
  const utf8 = new TextEncoder().encode('€'); assert.equal(utf8.byteLength, 3);
});

test('accepts a syntactically valid multipart body of exactly 16 MiB', async () => {
  const enc = new TextEncoder();
  const part = (name, size) => [enc.encode(`--x\r\nContent-Disposition: form-data; name="${name}"; filename="${name}.step"\r\nContent-Type: application/step\r\n\r\n`), new Uint8Array(size), enc.encode('\r\n')];
  const aHead = part('a', 0)[0], bHead = part('b', 0)[0], tail = enc.encode('--x--\r\n');
  const available = limitCases.maxBodyBytes - aHead.length - bHead.length - tail.length - 4;
  const aSize = Math.min(limitCases.maxFileBytes, Math.floor(available / 2));
  const bSize = available - aSize;
  const chunks = [...part('a', aSize), ...part('b', bSize), tail];
  const body = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0)); let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
  assert.equal(body.byteLength, limitCases.maxBodyBytes);
  const parsed = await readMultipartRequest({ body: new ReadableStream({ start(c) { c.enqueue(body); c.close(); } }), headers: new Headers({ 'Content-Type': 'multipart/form-data; boundary=x' }) });
  assert.equal(parsed.bytes, limitCases.maxBodyBytes); assert.equal(parsed.files.length, 2);
});

test('rejects a body at 16 MiB plus one byte', async () => {
  const body = new Uint8Array(limitCases.maxBodyBytes + 1);
  await assert.rejects(() => readMultipartRequest({ body: new ReadableStream({ start(c) { c.enqueue(body); c.close(); } }), headers: new Headers({ 'Content-Type': 'multipart/form-data; boundary=x' }) }), /payload_too_large/);
});

test('normalizes stream failures and returns no partial fields or files', async () => {
  const stream = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('--x\r\nContent-Disposition: form-data; name="company"\r\n\r\nACME')); c.error(new Error('secret stream detail')); } });
  await assert.rejects(() => readMultipartRequest({ body: stream, headers: new Headers({ 'Content-Type': 'multipart/form-data; boundary=x' }) }), error => error.message === 'invalid_multipart' && !error.message.includes('secret'));
});

test('stops reading immediately when one file exceeds 8 MiB', async () => {
  const enc = new TextEncoder(); const head = enc.encode('--x\r\nContent-Disposition: form-data; name="file"; filename="large.step"\r\nContent-Type: application/step\r\n\r\n');
  let reads = 0; let cancelled = false; const chunks = [head, new Uint8Array(limitCases.maxFileBytes), new Uint8Array(1)]; const reader = { async read() { if (reads >= chunks.length) return { done: true }; return { done: false, value: chunks[reads++] }; }, async cancel() { cancelled = true; }, releaseLock() {} };
  await assert.rejects(() => readMultipartRequest({ body: { getReader() { return reader; } }, headers: new Headers({ 'Content-Type': 'multipart/form-data; boundary=x' }) }), /file_too_large/);
  assert.equal(reads, 3); assert.equal(cancelled, true);
});

test('preserves binary PDF bytes through multipart parsing', async () => {
  const enc = new TextEncoder();
  const header = enc.encode('%PDF-1.7\r\n1 0 obj\r\nstream\r\n');
  const binaryStream = new Uint8Array([0xff, 0x00, 0x80, 0x91, 0xfe]);
  const trailer = enc.encode('\r\nendstream\r\nendobj\r\nstartxref\r\n0\r\n%%EOF\r\n');
  const pdf = new Uint8Array(header.length + binaryStream.length + trailer.length);
  pdf.set(header); pdf.set(binaryStream, header.length); pdf.set(trailer, header.length + binaryStream.length);
  const boundary = 'realistic';
  const multipartHeader = enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="Microsoft Print to PDF.pdf"\r\nContent-Type: application/pdf\r\n\r\n`);
  const multipartTail = enc.encode(`\r\n--${boundary}--\r\n`);
  const body = new Uint8Array(multipartHeader.length + pdf.length + multipartTail.length);
  body.set(multipartHeader); body.set(pdf, multipartHeader.length); body.set(multipartTail, multipartHeader.length + pdf.length);
  const parsed = await readMultipartRequest({ body: new ReadableStream({ start(controller) { controller.enqueue(body); controller.close(); } }), headers: new Headers({ 'Content-Type': `multipart/form-data; boundary=${boundary}` }) });
  assert.deepEqual(parsed.files[0].bytes, pdf);
  assert.equal((await validateUploadFile({ name: parsed.files[0].name, type: parsed.files[0].type, bytes: parsed.files[0].bytes })).ok, true);
});
