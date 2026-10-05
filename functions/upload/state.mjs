const auditActions = new Map([
  ['approve', 'file_approved'],
  ['reject', 'file_rejected'],
  ['download', 'download_allowed']
]);

export function allowedUploadActions(upload) {
  if (!upload || upload.storage_status !== 'stored') return [];
  if (upload.security_status === 'quarantine') return ['download', 'approve', 'reject'];
  if (upload.security_status === 'approved' || upload.security_status === 'rejected') return ['download'];
  return [];
}

export function validateRejectionReason(value) {
  if (typeof value !== 'string') throw new Error('invalid_rejection_reason');
  const normalized = value.normalize('NFC').trim();
  const codePoints = Array.from(normalized);
  if (codePoints.length < 1 || codePoints.length > 200) throw new Error('invalid_rejection_reason');
  for (const character of codePoints) {
    const codePoint = character.codePointAt(0);
    if ((codePoint >= 0 && codePoint <= 0x1f) || (codePoint >= 0x7f && codePoint <= 0x9f) || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
      throw new Error('invalid_rejection_reason');
    }
  }
  return normalized;
}

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
