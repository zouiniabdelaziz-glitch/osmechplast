import { verifyAccessJwt } from './access-jwt.mjs';

class InternalSecurityError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

export function parseLeadId(value) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/u.test(value)) throw new InternalSecurityError('invalid_lead_id');
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new InternalSecurityError('invalid_lead_id');
  return parsed;
}

export function parseUploadId(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)) throw new InternalSecurityError('invalid_upload_id');
  return value.toLowerCase();
}

function originFrom(value) {
  if (typeof value !== 'string' || !value) throw new InternalSecurityError('origin_denied');
  const origin = new URL(value);
  if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) throw new InternalSecurityError('origin_denied');
  return origin.origin;
}

export function requireInternalMutationOrigin(request, env) {
  const expected = originFrom(env.INTERNAL_ORIGIN);
  const actual = request.headers.get('origin');
  if (!actual || originFrom(actual) !== expected) throw new InternalSecurityError('origin_denied');
}

export async function readInternalJson(request, { maxBytes = 4096, allowedFields } = {}) {
  const contentType = request.headers.get('content-type');
  const [mediaType, ...parameters] = (contentType || '').split(';');
  const validParameters = parameters.every((parameter) => {
    const [name, ...rawValue] = parameter.split('=');
    const value = rawValue.join('=').trim().replace(/^"|"$/gu, '').toLowerCase();
    return name.trim().toLowerCase() === 'charset' && value === 'utf-8';
  });
  if (mediaType.trim().toLowerCase() !== 'application/json' || !validParameters) throw new InternalSecurityError('unsupported_media_type');
  if (!request.body) throw new InternalSecurityError('invalid_request');
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel('payload_too_large');
        throw new InternalSecurityError('payload_too_large');
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error?.code === 'payload_too_large') throw error;
    throw new InternalSecurityError('invalid_request');
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let parsed;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new InternalSecurityError('invalid_request');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new InternalSecurityError('invalid_request');
  if (allowedFields) {
    const allowed = new Set(allowedFields);
    if (Object.keys(parsed).some((key) => !allowed.has(key))) throw new InternalSecurityError('invalid_request');
  }
  return parsed;
}

export async function requireInternalActor(request, env) {
  const result = await verifyAccessJwt(request.headers.get('Cf-Access-Jwt-Assertion'), {
    teamDomain: env.ACCESS_TEAM_DOMAIN,
    policyAud: env.ACCESS_POLICY_AUD,
    jwksUrl: env.ACCESS_JWKS_URL,
    allowInsecureJwks: env.INTERNAL_LOCAL_TEST === '1',
    fetchImpl: env.fetchImpl || fetch,
    allowedSubjects: String(env.ACCESS_ALLOWED_SUBJECTS || '').split(',').map((value) => value.trim()).filter(Boolean),
    allowedGroups: String(env.ACCESS_ALLOWED_GROUPS || '').split(',').map((value) => value.trim()).filter(Boolean),
  });
  if (!result.ok) throw new InternalSecurityError(result.reason || 'unauthorized');
  return { subject: result.subject, groups: result.groups };
}

export function withInternalHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('Content-Security-Policy', "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; connect-src 'self'; object-src 'none'");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export { InternalSecurityError };
