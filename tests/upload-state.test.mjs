import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedUploadActions, auditActionForTransition, transitionUpload, validateRejectionReason } from '../functions/upload/state.mjs';

test('permits employee approval from quarantine', () => {
  assert.equal(transitionUpload('quarantine', 'approve', { type: 'employee', id: 'u1' }), 'approved');
  assert.equal(auditActionForTransition('approve'), 'file_approved');
});

test('keeps download in quarantine and rejects reverse transitions', () => {
  assert.equal(transitionUpload('quarantine', 'download', { type: 'employee', id: 'u1' }), 'quarantine');
  assert.throws(() => transitionUpload('approved', 'reject', { type: 'employee', id: 'u1' }), /invalid_transition/);
});

test('derives server-side upload actions from storage and security state', () => {
  assert.deepEqual(allowedUploadActions({ storage_status: 'stored', security_status: 'quarantine' }), ['download', 'approve', 'reject']);
  assert.deepEqual(allowedUploadActions({ storage_status: 'stored', security_status: 'approved' }), ['download']);
  assert.deepEqual(allowedUploadActions({ storage_status: 'stored', security_status: 'rejected' }), ['download']);
  assert.deepEqual(allowedUploadActions({ storage_status: 'pending', security_status: 'quarantine' }), []);
  assert.deepEqual(allowedUploadActions({ storage_status: 'unknown', security_status: 'quarantine' }), []);
});

test('validates and normalizes a rejection reason without fallback or silent truncation', () => {
  assert.equal(validateRejectionReason('  Maß außerhalb der Spezifikation  '), 'Maß außerhalb der Spezifikation');
  assert.throws(() => validateRejectionReason(''), /invalid_rejection_reason/);
  assert.throws(() => validateRejectionReason('x'.repeat(201)), /invalid_rejection_reason/);
  assert.throws(() => validateRejectionReason('bad\u0000reason'), /invalid_rejection_reason/);
  assert.throws(() => validateRejectionReason('\uD800'), /invalid_rejection_reason/);
});
