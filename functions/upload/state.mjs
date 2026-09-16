const auditActions = new Map([
  ['approve', 'file_approved'],
  ['reject', 'file_rejected'],
  ['download', 'download_allowed']
]);

export function transitionUpload(current, action, actor) {
  if (actor?.type !== 'employee' || !actor.id) throw new Error('unauthorized');
  if (current !== 'quarantine') throw new Error('invalid_transition');
  if (!auditActions.has(action)) throw new Error('invalid_action');
  if (action === 'approve') return 'approved';
  if (action === 'reject') return 'rejected';
  return 'quarantine';
}

export function auditActionForTransition(action) {
  const result = auditActions.get(action);
  if (!result) throw new Error('invalid_action');
  return result;
}
