import test from 'node:test';
import assert from 'node:assert/strict';
import { validFiles, invalidFiles, limitCases, multipartBodies, requestIds } from '../functions/upload/validation.mjs';

test('exports deterministic upload fixtures', () => {
  assert.ok(validFiles.pdf);
  assert.ok(validFiles.asciiDxf);
  assert.ok(invalidFiles.binaryDxf);
  assert.equal(limitCases.maxFiles, 5);
  assert.ok(multipartBodies.valid instanceof Uint8Array);
  assert.match(requestIds.valid, /^[0-9a-f-]{36}$/);
});
