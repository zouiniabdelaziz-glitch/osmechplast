import test from 'node:test';
import assert from 'node:assert/strict';
import { validFiles, invalidFiles, limitCases, multipartBodies, requestIds, parseRequestId, validateLeadFields } from '../functions/upload/validation.mjs';

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
