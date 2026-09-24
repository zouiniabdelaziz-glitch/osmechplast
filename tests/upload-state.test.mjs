import test from 'node:test';
import assert from 'node:assert/strict';
import { transitionUpload, auditActionForTransition } from '../functions/upload/state.mjs';

test('permits employee approval from quarantine', () => {
  assert.equal(transitionUpload('quarantine', 'approve', { type: 'employee', id: 'u1' }), 'approved');
  assert.equal(auditActionForTransition('approve'), 'file_approved');
});

test('keeps download in quarantine and rejects reverse transitions', () => {
  assert.equal(transitionUpload('quarantine', 'download', { type: 'employee', id: 'u1' }), 'quarantine');
  assert.throws(() => transitionUpload('approved', 'reject', { type: 'employee', id: 'u1' }), /invalid_transition/);
});
