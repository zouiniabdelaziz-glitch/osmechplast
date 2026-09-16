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

const signatures = {
  pdf: (b) => b.length >= 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
  jpg: (b) => b.length >= 2 && b[0] === 0xff && b[1] === 0xd8,
  jpeg: (b) => b.length >= 2 && b[0] === 0xff && b[1] === 0xd8,
  png: (b) => b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  step: (b) => new TextDecoder().decode(b).startsWith('ISO-10303-21;'),
  stp: (b) => new TextDecoder().decode(b).startsWith('ISO-10303-21;'),
  dxf: (b) => new TextDecoder().decode(b).includes('SECTION') && new TextDecoder().decode(b).includes('EOF')
};

export async function validateUploadFile(file) {
  const name = String(file?.name || '');
  const extension = name.toLowerCase().split('.').pop();
  const bytes = file?.bytes instanceof Uint8Array ? file.bytes : new Uint8Array(await file.arrayBuffer());
  const ok = Boolean(signatures[extension]?.(bytes)) && bytes.byteLength <= limitCases.maxFileBytes;
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const sha256 = [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, '0')).join('');
  return { ok, extension, detectedType: extension === 'pdf' ? 'application/pdf' : file?.type || 'application/octet-stream', sha256, reason: ok ? undefined : 'invalid_file' };
}

export async function readMultipartRequest(request) {
  if (!request?.body) throw new Error('invalid_request');
  const reader = request.body.getReader();
  let total = 0;
  const chunks = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limitCases.maxBodyBytes) {
        await reader.cancel();
        throw new Error('payload_too_large');
      }
      chunks.push(value);
    }
  } catch (error) {
    try { await reader.cancel(); } catch {}
    throw error;
  }
  return { fields: new FormData(), files: [], bytes: total, chunks };
}
