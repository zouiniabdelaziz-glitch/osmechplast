import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { verifyAccessJwt, normalizeTeamDomain } from '../functions/internal/access-jwt.mjs';

const b64 = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');

test('Access verifier rejects missing and malformed assertions', async () => {
  assert.equal((await verifyAccessJwt('', { teamDomain: 'team.example', policyAud: 'aud' })).ok, false);
  assert.equal((await verifyAccessJwt('a.b.c', { teamDomain: 'team.example', policyAud: 'aud' })).ok, false);
});

test('Access verifier validates signature, issuer, audience and employee claim', async () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = publicKey.export({ format: 'jwk' });
  const now = 1_700_000_000;
  const header = { alg: 'RS256', kid: 'k1', typ: 'JWT' };
  const payload = { iss: 'https://team.example', aud: ['aud'], sub: 'employee@example.com', email: 'employee@example.com', exp: now + 60, nbf: now - 1 };
  const input = `${b64(header)}.${b64(payload)}`;
  const signature = sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url');
  const result = await verifyAccessJwt(`${input}.${signature}`, {
    teamDomain: 'team.example', policyAud: 'aud', allowedSubjects: ['employee@example.com'], now,
    fetchImpl: async () => new Response(JSON.stringify({ keys: [{ ...jwk, kid: 'k1', alg: 'RS256', use: 'sig' }] }), { status: 200 }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.subject, 'employee@example.com');
});

test('Access verifier accepts HTTPS team URL and rejects unsafe variants', async () => {
  assert.equal(normalizeTeamDomain('https://team.example'), 'https://team.example');
  assert.equal(normalizeTeamDomain('team.example'), 'https://team.example');
  assert.throws(() => normalizeTeamDomain('http://team.example'));
  assert.throws(() => normalizeTeamDomain('https://team.example/path'));
  assert.throws(() => normalizeTeamDomain('https://team.example?x=1'));
});

test('Access verifier requires the signed subject and passes a bounded JWKS signal', async () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = publicKey.export({ format: 'jwk' });
  const now = 1_700_000_000;
  const header = { alg: 'RS256', kid: 'k1', typ: 'JWT' };
  const payload = { iss: 'https://team.example', aud: ['aud'], email: 'employee@example.com', exp: now + 60 };
  const input = `${b64(header)}.${b64(payload)}`;
  const signature = sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url');
  let sawSignal = false;
  const result = await verifyAccessJwt(`${input}.${signature}`, {
    teamDomain: 'team.example', policyAud: 'aud', allowedSubjects: ['employee@example.com'], now,
    fetchImpl: async (_url, options) => {
      sawSignal = options?.signal instanceof AbortSignal;
      return new Response(JSON.stringify({ keys: [{ ...jwk, kid: 'k1', alg: 'RS256', use: 'sig' }] }), { status: 200 });
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'not_employee');
  assert.equal(sawSignal, true);
});

test('Access verifier can use an explicitly configured local JWKS transport only in local-test mode', async () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = publicKey.export({ format: 'jwk' });
  const now = 1_700_000_000;
  const input = `${b64({ alg: 'RS256', kid: 'local-k1', typ: 'JWT' })}.${b64({ iss: 'https://team.example', aud: ['aud'], sub: 'employee@example.com', exp: now + 60 })}`;
  const signature = sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url');
  let requestedUrl = '';
  const result = await verifyAccessJwt(`${input}.${signature}`, {
    teamDomain: 'team.example', policyAud: 'aud', allowedSubjects: ['employee@example.com'], now,
    jwksUrl: 'http://127.0.0.1:9999/jwks', allowInsecureJwks: true,
    fetchImpl: async (url) => { requestedUrl = url; return new Response(JSON.stringify({ keys: [{ ...jwk, kid: 'local-k1', alg: 'RS256', use: 'sig' }] })); },
  });
  assert.equal(result.ok, true);
  assert.equal(requestedUrl, 'http://127.0.0.1:9999/jwks');
  assert.equal((await verifyAccessJwt(`${input}.${signature}`, { teamDomain: 'team.example', policyAud: 'aud', allowedSubjects: ['employee@example.com'], now, jwksUrl: 'http://127.0.0.1:9999/jwks', fetchImpl: async () => new Response('{}') })).ok, false);
});
