import { generateKeyPairSync, sign } from 'node:crypto';
import { createServer as createHttpServer } from 'node:http';
import { spawn } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const pagesPort = 8896;
const localHost = Object.values(os.networkInterfaces()).flat().find((entry) => entry.family === 'IPv4' && !entry.internal)?.address || '127.0.0.1';
const projectRoot = process.cwd();
const wranglerPath = path.join(projectRoot, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const testRoot = mkdtempSync(path.join(projectRoot, '.tmp', 'pages-auth-test-'));
cpSync(path.join(projectRoot, '_site'), path.join(testRoot, '_site'), { recursive: true });
cpSync(path.join(projectRoot, 'functions'), path.join(testRoot, 'functions'), { recursive: true });
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const header = b64({ alg: 'RS256', kid: 'local-pages-k1', typ: 'JWT' });
const payload = b64({ iss: 'https://team.example', aud: ['aud'], sub: 'local-employee', exp: Math.floor(Date.now() / 1000) + 300 });
const input = `${header}.${payload}`;
const token = `${input}.${sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')}`;

const jwks = createHttpServer((request, response) => {
  if (request.url !== '/cdn-cgi/access/certs') { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'local-pages-k1', alg: 'RS256', use: 'sig' }] }));
});

function startPages(port, enabled, jwksPort) {
  const envFile = path.join(testRoot, '.dev.vars');
  writeFileSync(envFile, [
    'ACCESS_TEAM_DOMAIN=team.example',
    'ACCESS_POLICY_AUD=aud',
    'ACCESS_ALLOWED_SUBJECTS=local-employee',
    `ACCESS_JWKS_URL=http://${localHost}:${jwksPort}/cdn-cgi/access/certs`,
    'INTERNAL_LOCAL_TEST=1',
    `INTERNAL_UI_ENABLED=${enabled ? '1' : '0'}`,
  ].join('\n'), 'utf8');
  const args = [
    wranglerPath, 'pages', 'dev', '_site', '--ip', '127.0.0.1', '--port', String(port),
    '--compatibility-date', '2026-09-25',
  ];
  const child = spawn(process.execPath, args, {
    cwd: testRoot,
    env: { ...process.env, WRANGLER_WRITE_LOGS: 'false', XDG_CONFIG_HOME: `${projectRoot}\\.wrangler\\local-config` },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  return { child, output: () => output };
}

async function waitFor(base, server) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try { await fetch(`${base}/`, { signal: AbortSignal.timeout(1000) }); return; } catch { await new Promise((resolve) => setTimeout(resolve, 250)); }
  }
  throw new Error(`wrangler pages dev did not start\n${server.output()}`);
}

async function stop(server) {
  if (!server?.child.killed) server?.child.kill();
  await new Promise((resolve) => setTimeout(resolve, 250));
}

async function request(base, path, options = {}) {
  return fetch(`${base}${path}`, { redirect: 'manual', ...options });
}

async function run() {
  await new Promise((resolve) => jwks.listen(0, localHost, resolve));
  const jwksPort = jwks.address().port;
  const active = [];
  try {
    const server = startPages(pagesPort, true, jwksPort);
    active.push(server);
    const base = `http://127.0.0.1:${pagesPort}`;
    await waitFor(base, server);
    const checks = [];

    const root = await request(base, '/internal');
    if (root.status >= 300 && root.status < 400) {
      const location = new URL(root.headers.get('location'), base).pathname;
      const protectedTarget = await request(base, location);
      if (protectedTarget.status !== 401) throw new Error(`/internal redirect target: expected 401, got ${protectedTarget.status}`);
      checks.push(`/internal=${root.status}->${location}=401`);
    } else {
      if (root.status !== 401) throw new Error(`/internal: expected 401 or redirect, got ${root.status}`);
      checks.push('/internal=401');
    }
    for (const path of ['/internal/', '/internal/internal.css', '/internal/api/unknown']) {
      const response = await request(base, path);
      if (response.status !== 401) throw new Error(`${path}: expected 401, got ${response.status}`);
      if (path.startsWith('/internal') && (await response.text()).includes('OSMPOS.MECHPLAST')) throw new Error(`${path}: leaked internal UI content`);
      checks.push(`${path}=401`);
    }
    const authHeaders = { 'Cf-Access-Jwt-Assertion': token };
    const authorizedRoot = await request(base, '/internal/', { headers: authHeaders });
    if (authorizedRoot.status !== 200) throw new Error(`/internal/ authorized: expected 200, got ${authorizedRoot.status}\n${server.output()}`);
    checks.push('/internal/ authorized=200');
    const asset = await request(base, '/internal/internal.css', { headers: authHeaders });
    if (asset.status !== 200 || asset.headers.get('x-content-type-options') !== 'nosniff' || asset.headers.get('cache-control') !== 'no-store') throw new Error('protected asset headers/status failed');
    checks.push('/internal/internal.css authorized=200+headers');
    for (const method of ['GET', 'POST', 'PUT']) {
      const unknown = await request(base, '/internal/api/unknown', { method, headers: authHeaders });
      if (unknown.status !== 404 && unknown.status !== 405) throw new Error(`/internal/api/unknown ${method}: expected 404/405, got ${unknown.status}`);
      checks.push(`/internal/api/unknown ${method}=${unknown.status}`);
    }
    await stop(server);
    active.shift();

    const disabledPort = 8897;
    const disabled = startPages(disabledPort, false, jwksPort);
    active.push(disabled);
    const disabledBase = `http://127.0.0.1:${disabledPort}`;
    await waitFor(disabledBase, disabled);
    const switchResponse = await request(disabledBase, '/internal/api/leads/1/status', { method: 'POST', headers: { ...authHeaders, origin: disabledBase, 'content-type': 'application/json' }, body: JSON.stringify({}) });
    if (switchResponse.status !== 404) throw new Error(`INTERNAL_UI_ENABLED=0: expected 404, got ${switchResponse.status}`);
    checks.push('INTERNAL_UI_ENABLED=0 status=404');
    await stop(disabled);
    active.shift();
    console.log('Pages auth/routing checks passed:', checks.join(', '));
  } finally {
    for (const server of active) await stop(server);
    rmSync(testRoot, { recursive: true, force: true });
    jwks.close();
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
