const MB = 1024 * 1024;
export const validFiles = {
  pdf: { name: 'drawing.pdf', type: 'application/pdf', bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]) },
  asciiDxf: { name: 'part.dxf', type: 'application/dxf', bytes: new TextEncoder().encode('0\\nSECTION\\n2\\nHEADER\\n0\\nENDSEC\\n0\\nEOF\\n') },
  step: { name: 'part.step', type: 'application/step', bytes: new TextEncoder().encode('ISO-10303-21;') },
  stp: { name: 'part.stp', type: 'application/step', bytes: new TextEncoder().encode('ISO-10303-21;') },
  jpg: { name: 'part.jpg', type: 'image/jpeg', bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]) },
  jpeg: { name: 'part.jpeg', type: 'image/jpeg', bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]) },
  png: { name: 'part.png', type: 'image/png', bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) }
};
export const invalidFiles = { binaryDxf: { name: 'part.dxf', type: 'application/octet-stream', bytes: new Uint8Array([0, 1, 2, 3]) } };
export const limitCases = { maxFiles: 5, maxFileBytes: 8 * MB, maxBodyBytes: 16 * MB };
export const multipartBodies = { valid: new Uint8Array([45, 45, 98, 111, 117, 110, 100, 97, 114, 121]) };
export const requestIds = { valid: '123e4567-e89b-42d3-a456-426614174000' };

export function parseRequestId(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new Error('invalid_request_id');
  return value.toLowerCase();
}

export function validateLeadFields(input) {
  const errors = [];
  if (!input || typeof input !== 'object') errors.push('invalid_request');
  if (!String(input?.company || '').trim()) errors.push('company');
  if (!String(input?.name || '').trim()) errors.push('name');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(input?.email || '').trim())) errors.push('email');
  return { ok: errors.length === 0, errors };
}
