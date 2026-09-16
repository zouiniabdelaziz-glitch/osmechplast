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
