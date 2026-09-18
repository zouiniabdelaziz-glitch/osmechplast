import test from 'node:test';
import assert from 'node:assert/strict';
import { validFiles, invalidFiles, limitCases, multipartBodies, requestIds, parseRequestId, validateLeadFields, validateUploadFile } from '../functions/upload/validation.mjs';

test('exports deterministic upload fixtures', () => {
  assert.ok(validFiles.pdf);
  assert.ok(validFiles.asciiDxf);
  assert.ok(invalidFiles.binaryDxf);
  assert.equal(limitCases.maxFiles, 5);
  assert.ok(multipartBodies.valid instanceof Uint8Array);
  assert.match(requestIds.valid, /^[0-9a-f-]{36}$/);
});

test('validates request ids and lead fields', () => {
  assert.equal(parseRequestId(requestIds.valid), requestIds.valid);
  assert.throws(() => parseRequestId('not-a-uuid'), /invalid_request_id/);
  assert.equal(validateLeadFields({ company: 'ACME', name: 'A', email: 'a@example.com' }).ok, true);
  assert.equal(validateLeadFields({ company: '', name: 'A', email: 'bad' }).ok, false);
  assert.equal(validateLeadFields({ company: ' A ', name: ' N ', email: ' n@example.com ', phone: ' 1 ', service: ' cnc-drehen ', message: ' hi ', language: ' de ' }).values.company, 'A');
  assert.equal(validateLeadFields({ company: 'A', name: 'N', email: 'n@example.com', service: 'laser-cutting' }).ok, false);
  assert.equal(validateLeadFields({ company: 1, name: 'N', email: 'n@example.com' }).ok, false);
});

test('validates file signatures and returns sha256 metadata', async () => {
  const pdf = await validateUploadFile(validFiles.pdf);
  assert.equal(pdf.ok, true);
  assert.equal(pdf.extension, 'pdf');
  assert.equal(pdf.detectedType, 'application/pdf');
  assert.match(pdf.sha256, /^[0-9a-f]{64}$/);
  const binary = await validateUploadFile(invalidFiles.binaryDxf);
  assert.equal(binary.ok, false);
});

test('accepts every allowlisted format only with matching structure and MIME', async () => {
  const cases = [['pdf','application/pdf'],['jpg','image/jpeg'],['jpeg','image/jpeg'],['png','image/png'],['step','application/step'],['stp','application/step'],['dxf','application/dxf']];
  for (const [key, type] of cases) {
    const fixture = key === 'dxf' ? { ...validFiles.asciiDxf, name: 'part.dxf' } : validFiles[key];
    assert.equal((await validateUploadFile({ ...fixture, type })).ok, true, key);
  }
});

test('rejects mismatched MIME, executable headers, truncation and oversized files', async () => {
  assert.equal((await validateUploadFile({ ...validFiles.pdf, type: 'image/png' })).ok, false);
  for (const bytes of [new Uint8Array([0x4d,0x5a]), new Uint8Array([0x7f,0x45,0x4c,0x46]), new Uint8Array([0x50,0x4b,0x03,0x04]), new TextEncoder().encode('<script>')]) assert.equal((await validateUploadFile({ name:'x.pdf', type:'application/pdf', bytes })).ok, false);
  assert.equal((await validateUploadFile({ name:'x.jpg', type:'image/jpeg', bytes:new Uint8Array([0xff,0xd8]) })).ok, false);
  assert.equal((await validateUploadFile({ name:'x.pdf', type:'application/pdf', bytes:new Uint8Array(8*1024*1024+1) })).ok, false);
});

test('rejects simple appended archive, executable and script payloads in image/PDF fixtures', async () => {
  for (const key of ['pdf', 'jpg', 'png']) {
    const fixture = validFiles[key];
    for (const payload of [new Uint8Array([0x50, 0x4b, 3, 4]), new Uint8Array([0x4d, 0x5a]), new TextEncoder().encode('#!/bin/sh\necho x')]) {
      const bytes = new Uint8Array(fixture.bytes.length + payload.length);
      bytes.set(fixture.bytes); bytes.set(payload, fixture.bytes.length);
      const result = await validateUploadFile({ name: fixture.name, type: fixture.type, bytes });
      assert.equal(result.ok, false, `${key} accepted appended payload`);
    }
  }
});
