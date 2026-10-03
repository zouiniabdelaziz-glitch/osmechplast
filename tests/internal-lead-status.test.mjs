import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';

import { closeInternalTestDb, openInternalTestDb } from './helpers/internal-sqlite.mjs';
import { seedInternalFixtures } from './internal-fixtures.mjs';
import { changeLeadStatus } from '../functions/internal/lead-workflow.mjs';
import { onRequest as onStatusRequest } from '../functions/internal/api/leads/[leadId]/status.js';

function signedAccess(env) {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = b64({ alg: 'RS256', kid: 'internal-test', typ: 'JWT' });
  const payload = b64({ iss: 'https://team.example', aud: ['aud'], sub: 'employee-subject', exp: Math.floor(Date.now() / 1000) + 60 });
  const input = `${header}.${payload}`;
  const token = `${input}.${sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')}`;
  env.fetchImpl = async () => new Response(JSON.stringify({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'internal-test', alg: 'RS256', use: 'sig' }] }));
  return token;
}

function d1Adapter(db) {
  return {
    prepare(sql) {
      return { bind(...values) {
        return {
          async first() { return db.prepare(sql).get(...values); },
          async all() { return { results: db.prepare(sql).all(...values) }; },
          async run() { const result = db.prepare(sql).run(...values); return { meta: { changes: Number(result.changes) } }; },
        };
      } };
    },
    async batch(statements) {
      db.exec('BEGIN');
      try { for (const statement of statements) await statement.run(); db.exec('COMMIT'); } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  };
}

function guardedD1Adapter(db, { failBatch = false } = {}) {
  let batched = false;
  let batchSql = [];
  return {
    prepare(sql) {
      return { bind(...values) {
        return {
          sql,
          async first() {
            if (!batched) throw new Error('D1 read occurred before atomic batch');
            return db.prepare(sql).get(...values);
          },
          async all() {
            if (!batched) throw new Error('D1 read occurred before atomic batch');
            return { results: db.prepare(sql).all(...values) };
          },
          async run() {
            if (!batched) throw new Error('D1 write occurred outside atomic batch');
            const result = db.prepare(sql).run(...values);
            return { meta: { changes: Number(result.changes) } };
          },
        };
      } };
    },
    async batch(statements) {
      if (statements.length !== 2) throw new Error('expected request insert and idempotency audit batch');
      batchSql = statements.map((statement) => statement.sql);
      if (batchSql.some((sql) => /UPDATE\s+leads/i.test(sql) || /status_changed/i.test(sql) && /INSERT\s+INTO\s+lead_status_audit/i.test(sql))) {
        throw new Error('status mutation and success audit must be provided by the migration trigger');
      }
      db.exec('BEGIN');
      batched = true;
      try {
        for (const statement of statements) {
          if (failBatch && statements.indexOf(statement) === 1) throw new Error('synthetic batch failure');
          await statement.run();
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    get batchSql() { return batchSql; },
  };
}

test('opens an isolated SQLite fixture with foreign keys through migration 0004', () => {
  const db = openInternalTestDb({ through: '0004' });

  try {
    assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
    assert.deepEqual(
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('leads', 'lead_uploads', 'lead_requests', 'upload_audit_log') ORDER BY name").all().map((row) => row.name),
      ['lead_requests', 'lead_uploads', 'leads', 'upload_audit_log'],
    );
  } finally {
    closeInternalTestDb(db);
  }
});

test('seeds only synthetic internal fixtures', () => {
  const db = openInternalTestDb({ through: '0004' });

  try {
    const fixtures = seedInternalFixtures(db);
    const lead = db.prepare('SELECT company, name, email FROM leads WHERE id = ?').get(fixtures.leadId);

    assert.equal(lead.company, 'Beispiel GmbH');
    assert.equal(lead.name, 'Mitarbeiter Test');
    assert.match(lead.email, /@example\.test$/u);
  } finally {
    closeInternalTestDb(db);
  }
});

test('changes a lead status atomically and stores one success audit', async () => {
  const db = openInternalTestDb({ through: '0005' });

  try {
    const { leadId } = seedInternalFixtures(db);
    const result = await changeLeadStatus(db, {
      requestId: '00000000-0000-4000-8000-000000000010',
      actorId: 'employee-subject',
      leadId,
      expectedStatus: 'new',
      expectedVersion: 0,
      targetStatus: 'in_progress',
      occurredAt: '2026-09-25T01:00:00.000Z',
    });

    assert.deepEqual(result, { httpStatus: 200, ok: true, status: 'in_progress', version: 1 });
    assert.deepEqual(
      { ...db.prepare('SELECT workflow_status, workflow_version FROM leads WHERE id = ?').get(leadId) },
      { workflow_status: 'in_progress', workflow_version: 1 },
    );
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM lead_status_audit WHERE result = 'success'").get().count, 1);
  } finally {
    closeInternalTestDb(db);
  }
});

test('replays a status request and records a stale-version conflict without a second transition', async () => {
  const db = openInternalTestDb({ through: '0005' });

  try {
    const { leadId } = seedInternalFixtures(db);
    const request = {
      requestId: '00000000-0000-4000-8000-000000000011',
      actorId: 'employee-subject',
      leadId,
      expectedStatus: 'new',
      expectedVersion: 0,
      targetStatus: 'in_progress',
      occurredAt: '2026-09-25T01:01:00.000Z',
    };
    const first = await changeLeadStatus(db, request);
    const replay = await changeLeadStatus(db, request);
    const conflict = await changeLeadStatus(db, {
      ...request,
      requestId: '00000000-0000-4000-8000-000000000012',
      targetStatus: 'completed',
    });

    assert.deepEqual(replay, first);
    assert.deepEqual(conflict, { httpStatus: 409, ok: false, error: 'status_conflict', observedStatus: 'in_progress', observedVersion: 1 });
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM lead_status_audit WHERE result = 'success'").get().count, 1);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM lead_status_audit WHERE detail_code = 'status_conflict'").get().count, 1);
  } finally {
    closeInternalTestDb(db);
  }
});

test('rejects a reused request id with different request data and replays after lead deletion', async () => {
  const db = openInternalTestDb({ through: '0005' });

  try {
    const { leadId } = seedInternalFixtures(db);
    const request = {
      requestId: '00000000-0000-4000-8000-000000000013',
      actorId: 'employee-subject',
      leadId,
      expectedStatus: 'new',
      expectedVersion: 0,
      targetStatus: 'completed',
      occurredAt: '2026-09-25T01:02:00.000Z',
    };
    const first = await changeLeadStatus(db, request);
    const mismatch = await changeLeadStatus(db, { ...request, actorId: 'other-subject' });
    db.prepare('DELETE FROM leads WHERE id = ?').run(leadId);
    const replay = await changeLeadStatus(db, request);

    assert.deepEqual(first, { httpStatus: 200, ok: true, status: 'completed', version: 1 });
    assert.deepEqual(mismatch, { httpStatus: 409, ok: false, error: 'idempotency_conflict' });
    assert.deepEqual(replay, first);
    assert.equal(db.prepare('SELECT lead_id FROM lead_status_requests WHERE request_id = ?').get(request.requestId).lead_id, null);
  } finally {
    closeInternalTestDb(db);
  }
});

test('status handler authenticates the actor, checks origin and returns the stored workflow result', async () => {
  const db = openInternalTestDb({ through: '0005' });
  try {
    const { leadId } = seedInternalFixtures(db);
    const env = {
      DB: db,
      INTERNAL_UI_ENABLED: '1',
      INTERNAL_ORIGIN: 'https://internal.example',
      ACCESS_TEAM_DOMAIN: 'team.example',
      ACCESS_POLICY_AUD: 'aud',
      ACCESS_ALLOWED_SUBJECTS: 'employee-subject',
    };
    const token = signedAccess(env);
    const response = await onStatusRequest({
      request: new Request(`https://internal.example/internal/api/leads/${leadId}/status`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://internal.example', 'Cf-Access-Jwt-Assertion': token },
        body: JSON.stringify({ request_id: '00000000-0000-4000-8000-000000000014', expected_status: 'new', expected_version: 0, target_status: 'in_progress' }),
      }),
      env,
      params: { leadId: String(leadId) },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, status: 'in_progress', version: 1 });
  } finally {
    closeInternalTestDb(db);
  }
});

test('uses D1 batch execution for the same atomic status protocol', async () => {
  const sqlite = openInternalTestDb({ through: '0005' });
  try {
    const { leadId } = seedInternalFixtures(sqlite);
    const result = await changeLeadStatus(d1Adapter(sqlite), {
      requestId: '00000000-0000-4000-8000-000000000015', actorId: 'employee-subject', leadId,
      expectedStatus: 'new', expectedVersion: 0, targetStatus: 'completed', occurredAt: '2026-09-25T01:03:00.000Z',
    });
    assert.deepEqual(result, { httpStatus: 200, ok: true, status: 'completed', version: 1 });
    assert.equal(sqlite.prepare('SELECT workflow_version FROM leads WHERE id = ?').get(leadId).workflow_version, 1);
  } finally { closeInternalTestDb(sqlite); }
});

test('D1 uses one atomic batch for result derivation, state update and audit', async () => {
  const sqlite = openInternalTestDb({ through: '0005' });
  try {
    const { leadId } = seedInternalFixtures(sqlite);
    const request = {
      requestId: '00000000-0000-4000-8000-000000000016', actorId: 'employee-subject', leadId,
      expectedStatus: 'new', expectedVersion: 0, targetStatus: 'in_progress', occurredAt: '2026-09-25T01:04:00.000Z',
    };
    const d1 = guardedD1Adapter(sqlite);
    assert.deepEqual(await changeLeadStatus(d1, request), { httpStatus: 200, ok: true, status: 'in_progress', version: 1 });
    assert.equal(d1.batchSql.length, 2);
    assert.match(d1.batchSql[0], /INSERT\s+INTO\s+lead_status_requests/i);
    assert.match(d1.batchSql[1], /idempotency_conflict/i);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM lead_status_audit WHERE result = \'success\'').get().count, 1);
    assert.deepEqual(await changeLeadStatus(d1, request), { httpStatus: 200, ok: true, status: 'in_progress', version: 1 });
    assert.deepEqual(await changeLeadStatus(d1, { ...request, actorId: 'other-subject' }), { httpStatus: 409, ok: false, error: 'idempotency_conflict' });
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM lead_status_audit WHERE detail_code = 'idempotency_conflict'").get().count, 1);
  } finally { closeInternalTestDb(sqlite); }
});

test('D1 batch rollback leaves no request, state or audit after a failure', async () => {
  const sqlite = openInternalTestDb({ through: '0005' });
  try {
    const { leadId } = seedInternalFixtures(sqlite);
    const requestId = '00000000-0000-4000-8000-000000000017';
    const result = await changeLeadStatus(guardedD1Adapter(sqlite, { failBatch: true }), {
      requestId, actorId: 'employee-subject', leadId, expectedStatus: 'new', expectedVersion: 0,
      targetStatus: 'completed', occurredAt: '2026-09-25T01:05:00.000Z',
    });
    assert.deepEqual(result, { httpStatus: 503, ok: false, error: 'temporarily_unavailable' });
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM lead_status_requests WHERE request_id = ?').get(requestId).count, 0);
    assert.equal(sqlite.prepare('SELECT workflow_status, workflow_version FROM leads WHERE id = ?').get(leadId).workflow_version, 0);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM lead_status_audit').get().count, 0);
  } finally { closeInternalTestDb(sqlite); }
});

test('D1 rejects request-id reuse for another lead before changing that lead', async () => {
  const sqlite = openInternalTestDb({ through: '0005' });
  try {
    const first = seedInternalFixtures(sqlite);
    const second = seedInternalFixtures(sqlite);
    const request = {
      requestId: '00000000-0000-4000-8000-000000000018', actorId: 'employee-subject', leadId: first.leadId,
      expectedStatus: 'new', expectedVersion: 0, targetStatus: 'in_progress', occurredAt: '2026-09-25T01:06:00.000Z',
    };
    const d1 = guardedD1Adapter(sqlite);
    assert.deepEqual(await changeLeadStatus(d1, request), { httpStatus: 200, ok: true, status: 'in_progress', version: 1 });
    const beforeSecond = { ...sqlite.prepare('SELECT workflow_status, workflow_version FROM leads WHERE id = ?').get(second.leadId) };
    const mismatch = await changeLeadStatus(d1, { ...request, leadId: second.leadId });
    assert.deepEqual(mismatch, { httpStatus: 409, ok: false, error: 'idempotency_conflict' });
    assert.deepEqual({ ...sqlite.prepare('SELECT workflow_status, workflow_version FROM leads WHERE id = ?').get(second.leadId) }, beforeSecond);
    assert.deepEqual({ ...sqlite.prepare('SELECT actor_id, lead_id, detail_code, result FROM lead_status_audit WHERE request_id = ? ORDER BY id DESC LIMIT 1').get(request.requestId) }, { actor_id: 'employee-subject', lead_id: null, detail_code: 'idempotency_conflict', result: 'denied' });
    assert.deepEqual({ ...sqlite.prepare('SELECT requested_lead_id, actor_id, target_status, expected_version FROM lead_status_requests WHERE request_id = ?').get(request.requestId) }, { requested_lead_id: first.leadId, actor_id: 'employee-subject', target_status: 'in_progress', expected_version: 0 });
    for (const variant of [{ actorId: 'other-subject' }, { targetStatus: 'completed' }, { expectedVersion: 1 }]) {
      assert.deepEqual(await changeLeadStatus(d1, { ...request, ...variant }), { httpStatus: 409, ok: false, error: 'idempotency_conflict' });
    }
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM lead_status_audit WHERE request_id = ? AND detail_code = 'idempotency_conflict'").get(request.requestId).count, 4);
  } finally { closeInternalTestDb(sqlite); }
});

test('status workflow rolls back when its success audit cannot be written', async () => {
  const db = openInternalTestDb({ through: '0005' });
  try {
    const { leadId } = seedInternalFixtures(db);
    db.exec('DROP TABLE lead_status_audit');
    const result = await changeLeadStatus(db, {
      requestId: '00000000-0000-4000-8000-000000000019', actorId: 'employee-subject', leadId,
      expectedStatus: 'new', expectedVersion: 0, targetStatus: 'in_progress', occurredAt: '2026-09-25T01:07:00.000Z',
    });
    assert.deepEqual(result, { httpStatus: 503, ok: false, error: 'temporarily_unavailable' });
    assert.deepEqual({ ...db.prepare('SELECT workflow_status, workflow_version FROM leads WHERE id = ?').get(leadId) }, { workflow_status: 'new', workflow_version: 0 });
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM lead_status_requests').get().count, 0);
  } finally { closeInternalTestDb(db); }
});
