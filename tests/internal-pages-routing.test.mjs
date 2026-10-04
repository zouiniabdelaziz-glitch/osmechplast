import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const routePath = path.resolve('functions/internal/api/leads/index.js');
const routesPath = path.resolve('_routes.json');

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

test('Pages routing explicitly includes the bare internal path and its descendants', () => {
  const routes = JSON.parse(readFileSync(routesPath, 'utf8'));
  assert.ok(Array.isArray(routes.include), `missing Pages include rules: ${routesPath}`);
  assert.ok(routes.include.includes('/internal'), 'bare /internal must be included in Pages Functions routing');
  assert.ok(routes.include.includes('/internal/*'), 'internal descendants must remain included in Pages Functions routing');
});

test('Pages lead overview route reaches the authenticated list handler', async () => {
  assert.equal(existsSync(routePath), true, `missing Pages route: ${routePath}`);

  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const header = base64url({ alg: 'RS256', kid: 'internal-routing-test', typ: 'JWT' });
  const payload = base64url({
    iss: 'https://team.example',
    aud: ['routing-aud'],
    sub: 'routing-employee',
    exp: Math.floor(Date.now() / 1000) + 300,
  });
  const unsigned = `${header}.${payload}`;
  const token = `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url')}`;
  const jwks = { keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'internal-routing-test', alg: 'RS256', use: 'sig' }] };
  const db = {
    prepare() {
      return { bind: () => ({ all: async () => ({ results: [{ id: 42, company: 'Synthetik GmbH', file_count: 0, workflow_status: 'new' }] }) }) };
    },
  };
  const route = await import(pathToFileURL(routePath).href);
  const response = await route.onRequest({
    request: new Request('https://internal.example/internal/api/leads', {
      headers: { 'Cf-Access-Jwt-Assertion': token },
    }),
    env: {
      DB: db,
      INTERNAL_UI_ENABLED: '1',
      ACCESS_TEAM_DOMAIN: 'team.example',
      ACCESS_POLICY_AUD: 'routing-aud',
      ACCESS_ALLOWED_SUBJECTS: 'routing-employee',
      ACCESS_JWKS_URL: 'http://local.test/cdn-cgi/access/certs',
      INTERNAL_LOCAL_TEST: '1',
      fetchImpl: async () => new Response(JSON.stringify(jwks), { status: 200 }),
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    items: [{
      id: 42,
      company: 'Synthetik GmbH',
      file_count: 0,
      file_status_summary: { quarantine: 0, approved: 0, rejected: 0 },
      workflow_status: 'new',
    }],
    page: 1,
    has_more: false,
  });
});
