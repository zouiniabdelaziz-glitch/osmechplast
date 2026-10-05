import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { openInternalTestDb, closeInternalTestDb } from './helpers/internal-sqlite.mjs';

test('upload migration defines required status columns', () => {
  const sql = fs.readFileSync('migrations/0002_lead_uploads.sql', 'utf8');
  assert.match(sql, /id TEXT PRIMARY KEY/);
  assert.match(sql, /storage_status/);
  assert.match(sql, /security_status/);
});

test('idempotency migration defines unique request state', () => {
  const sql = fs.readFileSync('migrations/0003_lead_requests.sql', 'utf8');
  assert.match(sql, /request_id TEXT PRIMARY KEY/);
  assert.match(sql, /processing/);
  assert.match(sql, /succeeded/);
  assert.match(sql, /failed/);
});

test('audit migration allows anonymous and orphan events without sensitive detail', () => {
  const sql = fs.readFileSync('migrations/0004_upload_audit_log.sql', 'utf8');
  assert.match(sql, /upload_id TEXT/);
  assert.match(sql, /lead_id INTEGER/);
  assert.match(sql, /actor_id TEXT/);
  assert.match(sql, /download_allowed/);
  assert.match(sql, /download_denied/);
  assert.match(sql, /cleanup_failed/);
  assert.match(sql, /ON DELETE SET NULL/);
});

test('migrations define bounded cleanup indexes', () => {
  const uploads = fs.readFileSync('migrations/0002_lead_uploads.sql', 'utf8');
  const requests = fs.readFileSync('migrations/0003_lead_requests.sql', 'utf8');
  const audit = fs.readFileSync('migrations/0004_upload_audit_log.sql', 'utf8');
  assert.match(uploads, /idx_lead_uploads_cleanup/);
  assert.match(requests, /idx_lead_requests_cleanup/);
  assert.match(audit, /idx_upload_audit_time/);
});

test('SQLite enforces status checks, nullable audit links and ON DELETE SET NULL', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(fs.readFileSync('schema.sql', 'utf8'));
  db.exec('PRAGMA foreign_keys = ON');
  db.prepare("INSERT INTO leads (email, created_at) VALUES ('x@example.com', '2026-01-01')").run();
  db.prepare("INSERT INTO lead_uploads (id, lead_id, sha256, original_name, extension, detected_type, r2_key, byte_size, storage_status, security_status, created_at) VALUES ('u1', 1, 'a', 'x.pdf', 'pdf', 'application/pdf', 'leads/1/u1.pdf', 1, 'pending', 'quarantine', '2026-01-01')").run();
  db.prepare("INSERT INTO upload_audit_log (actor_type, occurred_at, action, result, detail_code) VALUES ('unknown', '2026-01-01', 'validation_failed', 'denied', 'invalid_file')").run();
  assert.throws(() => db.prepare("INSERT INTO lead_uploads (id, lead_id, sha256, original_name, extension, detected_type, r2_key, byte_size, storage_status, security_status, created_at) VALUES ('u2', 1, 'a', 'x.pdf', 'pdf', 'application/pdf', 'leads/1/u2.pdf', 1, 'bad', 'quarantine', '2026-01-01')").run());
  assert.throws(() => db.prepare("INSERT INTO upload_audit_log (actor_type, occurred_at, action, result) VALUES ('unknown', '2026-01-01', 'not_allowed', 'denied')").run());
  db.prepare("INSERT INTO upload_audit_log (upload_id, lead_id, actor_type, occurred_at, action, result) VALUES ('u1', 1, 'employee', '2026-01-01', 'upload_stored', 'ok')").run();
  db.prepare("DELETE FROM lead_uploads WHERE id = 'u1'").run();
  db.prepare('DELETE FROM leads WHERE id = 1').run();
  const row = db.prepare('SELECT lead_id FROM upload_audit_log WHERE id = 1').get();
  assert.equal(row.lead_id, null);
});

test('numbered upload migrations execute together in SQLite', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const file of ['migrations/0001_leads.sql', 'migrations/0002_lead_uploads.sql', 'migrations/0003_lead_requests.sql', 'migrations/0004_upload_audit_log.sql']) db.exec(fs.readFileSync(file, 'utf8'));
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('leads','lead_uploads','lead_requests','upload_audit_log') ORDER BY name").all().map(row => row.name);
  assert.deepEqual(tables, ['lead_requests', 'lead_uploads', 'leads', 'upload_audit_log']);
  const leadColumns = db.prepare('PRAGMA table_info(leads)').all().map(row => row.name);
  assert.deepEqual(leadColumns, ['id', 'company', 'name', 'email', 'phone', 'service', 'message', 'ai_analysis', 'language', 'source', 'status', 'created_at']);
  const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' ORDER BY name").all().map(row => row.name);
  assert.ok(indexes.includes('idx_lead_uploads_cleanup'));
  assert.ok(indexes.includes('idx_lead_requests_cleanup'));
  assert.ok(indexes.includes('idx_upload_audit_time'));
  const uploadForeignKeys = db.prepare('PRAGMA foreign_key_list(lead_uploads)').all();
  const auditForeignKeys = db.prepare('PRAGMA foreign_key_list(upload_audit_log)').all();
  assert.equal(uploadForeignKeys.some((row) => row.table === 'leads'), true);
  assert.equal(auditForeignKeys.filter((row) => row.on_delete === 'SET NULL').length, 2);
  db.prepare("INSERT INTO leads (email, created_at) VALUES ('chain@example.com', '2026-01-01')").run();
  assert.throws(() => db.prepare("INSERT INTO lead_uploads (id, lead_id, sha256, original_name, extension, detected_type, r2_key, byte_size, storage_status, security_status, created_at) VALUES ('bad', 1, 'x', 'x.pdf', 'pdf', 'application/pdf', 'leads/1/bad.pdf', 1, 'invalid', 'quarantine', '2026-01-01')").run());
  const normalizeSql = (value) => value.replaceAll('\r\n', '\n').trim();
  const referenceLead = fs.readFileSync('schema.sql', 'utf8').split(/\n\s*CREATE TABLE IF NOT EXISTS lead_uploads/)[0];
  assert.equal(normalizeSql(fs.readFileSync('migrations/0001_leads.sql', 'utf8')), normalizeSql(referenceLead));
});

test('0005 defines workflow snapshots, request constraints, audit retention and a closed review gate', () => {
  const db = openInternalTestDb({ through: '0005' });

  try {
    const leadColumns = db.prepare('PRAGMA table_info(leads)').all().map((row) => row.name);
    assert.deepEqual(leadColumns.slice(-2), ['workflow_status', 'workflow_version']);

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('lead_status_requests', 'lead_status_audit', 'internal_review_control') ORDER BY name").all().map((row) => row.name);
    assert.deepEqual(tables, ['internal_review_control', 'lead_status_audit', 'lead_status_requests']);

    const gate = db.prepare('SELECT id, enabled, protocol_version FROM internal_review_control').get();
    assert.deepEqual({ id: gate.id, enabled: gate.enabled, protocol_version: gate.protocol_version }, { id: 1, enabled: 0, protocol_version: 2 });

    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all().map((row) => row.name);
    assert.ok(indexes.includes('idx_leads_workflow_created'));
    assert.ok(indexes.includes('idx_lead_status_audit_lead_time'));
    assert.ok(indexes.includes('idx_lead_status_requests_lead'));

    assert.throws(() => db.prepare(`
      INSERT INTO lead_status_requests
        (request_id, actor_id, requested_lead_id, expected_status, expected_version, target_status,
         observed_status, observed_version, response_code, detail_code, occurred_at)
      VALUES ('00000000-0000-4000-8000-000000000001', 'employee-test', 1, 'completed', 0, 'new',
        'completed', 0, 409, 'status_conflict', '2026-09-25T00:00:00.000Z')
    `).run());
  } finally {
    closeInternalTestDb(db);
  }
});

test('D1 trigger CASE expressions are parenthesized for remote statement splitting', () => {
  const workflow = fs.readFileSync('migrations/0005_internal_lead_workflow.sql', 'utf8');
  const review = fs.readFileSync('migrations/0006_upload_review_audit.sql', 'utf8');
  const workflowTrigger = workflow.slice(workflow.indexOf('CREATE TRIGGER lead_status_request_apply'));
  const reviewTrigger = review.slice(review.indexOf('CREATE TRIGGER upload_review_guard'));

  assert.doesNotMatch(workflowTrigger, /SELECT CASE\b/u);
  assert.doesNotMatch(reviewTrigger, /SELECT CASE\b/u);
  assert.match(workflowTrigger, /SELECT \(CASE[\s\S]+?END\);/u);
  assert.match(reviewTrigger, /SELECT \(CASE[\s\S]+?END\);/u);
});
