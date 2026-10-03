import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const persist = mkdtempSync(path.join(root, '.tmp', 'internal-d1-'));
const config = 'tests/fixtures/internal/wrangler.jsonc';
const wrangler = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const env = { ...process.env, WRANGLER_WRITE_LOGS: 'false', XDG_CONFIG_HOME: path.join(root, '.wrangler', 'local-config') };
const run = (args) => execFileSync(process.execPath, [wrangler, ...args], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });

const port = 8795;
let child = null;
let logs = '';
try {
  run(['d1', 'migrations', 'apply', 'internal-leads-local', '--local', '--config', config, '--persist-to', persist]);
  run(['d1', 'execute', 'internal-leads-local', '--local', '--config', config, '--persist-to', persist, '--file', 'tests/fixtures/internal/seed.sql']);
  child = spawn(process.execPath, [wrangler, 'dev', '--config', config, '--local', '--ip', '127.0.0.1', '--port', String(port), '--persist-to', persist], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (chunk) => { logs += chunk; });
  child.stderr.on('data', (chunk) => { logs += chunk; });
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { await fetch(`http://127.0.0.1:${port}/__test/status`, { method: 'GET', signal: AbortSignal.timeout(1000) }); ready = true; break; } catch { await new Promise((resolve) => setTimeout(resolve, 250)); }
  }
  if (!ready) throw new Error(`wrangler dev did not start\n${logs}`);
  const endpoint = `http://127.0.0.1:${port}/__test/status`;
  const request = { request_id: '00000000-0000-4000-8000-000000000301', lead_id: 1, expected_status: 'new', expected_version: 0, target_status: 'in_progress' };
  const competingRequest = { ...request, request_id: '00000000-0000-4000-8000-000000000302' };
  const concurrent = await Promise.all([
    fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) }).then((response) => response.json()),
    fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(competingRequest) }).then((response) => response.json()),
  ]);
  const winnerIndex = concurrent.findIndex((result) => result.httpStatus === 200);
  const winnerRequest = [request, competingRequest][winnerIndex];
  const first = concurrent[winnerIndex];
  const conflict = concurrent.find((result) => result.httpStatus === 409);
  const replay = await (await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(winnerRequest) })).json();
  const mismatch = await (await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...winnerRequest, lead_id: 2 }) })).json();
  const state = await (await fetch(`http://127.0.0.1:${port}/__test/state?lead=1`)).json();
  const secondState = await (await fetch(`http://127.0.0.1:${port}/__test/state?lead=2`)).json();
  const audits = await (await fetch(`http://127.0.0.1:${port}/__test/audits`)).json();
  const auditFailure = await (await fetch(`http://127.0.0.1:${port}/__test/audit-failure`, { method: 'POST' })).json();
  const reviewGate = await (await fetch(`http://127.0.0.1:${port}/__test/review-gate`, { method: 'POST' })).json();
  const migrationAbort = await (await fetch(`http://127.0.0.1:${port}/__test/migration-abort`, { method: 'POST' })).json();
  const rollback = await (await fetch(`http://127.0.0.1:${port}/__test/rollback`, { method: 'POST' })).json();
  const auditShape = audits.audits.map(({ request_id, lead_id, result, detail_code }) => ({ request_id, lead_id, result, detail_code }));
  const expectedAuditShape = [
    { request_id: winnerRequest.request_id, lead_id: winnerRequest.lead_id, result: 'success', detail_code: 'status_changed' },
    { request_id: [request, competingRequest][1 - winnerIndex].request_id, lead_id: [request, competingRequest][1 - winnerIndex].lead_id, result: 'denied', detail_code: 'status_conflict' },
    { request_id: winnerRequest.request_id, lead_id: null, result: 'denied', detail_code: 'idempotency_conflict' },
  ];
  if (winnerIndex < 0 || !conflict || first.version !== 1 || conflict.error !== 'status_conflict' || JSON.stringify(first) !== JSON.stringify(replay) || mismatch.error !== 'idempotency_conflict' || state.workflow_version !== 1 || secondState.workflow_version !== 0 || state.requests !== 2 || state.audits !== 3 || JSON.stringify(auditShape) !== JSON.stringify(expectedAuditShape) || auditFailure.result?.httpStatus !== 503 || auditFailure.state.workflow_status !== 'new' || auditFailure.state.workflow_version !== 0 || auditFailure.requests !== 2 || auditFailure.audits !== 3 || reviewGate.errors.length !== 2 || reviewGate.rows.some((row) => row.security_status !== 'quarantine' || row.review_request_id !== null) || reviewGate.auditCount !== 0 || migrationAbort.blockCount !== 1 || migrationAbort.errors.length !== 2 || migrationAbort.rows.some((row) => row.security_status !== 'quarantine' || row.review_request_id !== null) || migrationAbort.auditCount !== 0 || rollback.rolled_back !== true) throw new Error(`D1 atomic checks failed: ${JSON.stringify({ concurrent, winnerRequest, replay, mismatch, state, secondState, audits, auditFailure, reviewGate, migrationAbort, rollback })}`);
  console.log('Local D1 workflow/audit-rollback/review-gate/migration-abort checks passed:', JSON.stringify({ concurrent, winnerRequest, replay, mismatch, state, secondState, audits, auditFailure, reviewGate, migrationAbort, rollback }));
} finally {
  if (child && !child.killed) child.kill();
  await new Promise((resolve) => setTimeout(resolve, 250));
  rmSync(persist, { recursive: true, force: true });
}
