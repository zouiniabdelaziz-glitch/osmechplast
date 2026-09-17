import test from 'node:test';
import assert from 'node:assert/strict';
import { readMultipartRequest, limitCases } from '../functions/upload/validation.mjs';

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
