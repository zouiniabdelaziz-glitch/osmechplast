const textDecoder = new TextDecoder();

export function normalizeTeamDomain(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('invalid_team_domain');
  const raw = value.trim();
  const candidate = raw.includes('://') ? raw : `https://${raw}`;
  const url = new URL(candidate);
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash || url.username || url.password || !url.hostname) throw new Error('invalid_team_domain');
  return `https://${url.hostname.toLowerCase()}`;
}

function decodePart(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return JSON.parse(textDecoder.decode(Uint8Array.from(atob(normalized), (c) => c.charCodeAt(0))));
}

export async function verifyAccessJwt(assertion, options = {}) {
  const { teamDomain, policyAud, fetchImpl = fetch, now = Math.floor(Date.now() / 1000), allowedSubjects = [], allowedGroups = [] } = options;
  try {
    if (!assertion || !teamDomain || !policyAud || (!allowedSubjects.length && !allowedGroups.length)) return { ok: false, reason: 'access_unconfigured' };
    const normalizedTeamDomain = normalizeTeamDomain(teamDomain);
    const parts = assertion.split('.');
    if (parts.length !== 3) return { ok: false, reason: 'invalid_token' };
    const header = decodePart(parts[0]);
    const payload = decodePart(parts[1]);
    if (header.alg !== 'RS256' || !header.kid || typeof payload.iss !== 'string' || payload.iss !== normalizedTeamDomain) return { ok: false, reason: 'invalid_claims' };
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audiences.includes(policyAud) || !Number.isFinite(payload.exp) || payload.exp <= now || (payload.nbf != null && (!Number.isFinite(payload.nbf) || payload.nbf > now))) return { ok: false, reason: 'invalid_claims' };
    const response = await fetchImpl(`${normalizedTeamDomain}/cdn-cgi/access/certs`);
    if (!response.ok) return { ok: false, reason: 'jwks_unavailable' };
    const key = (await response.json()).keys?.find((candidate) => candidate.kid === header.kid && candidate.alg === 'RS256');
    if (!key) return { ok: false, reason: 'unknown_key' };
    const cryptoKey = await crypto.subtle.importKey('jwk', key, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const input = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const signature = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(parts[2].length / 4) * 4, '=')), (c) => c.charCodeAt(0));
    if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature, input)) return { ok: false, reason: 'invalid_signature' };
    const subject = payload.sub || payload.email;
    const groups = Array.isArray(payload.groups) ? payload.groups : [];
    if (!subject || (!allowedSubjects.includes(subject) && !allowedGroups.some((group) => groups.includes(group)))) return { ok: false, reason: 'not_employee' };
    return { ok: true, subject, groups };
  } catch { return { ok: false, reason: 'invalid_token' }; }
}
