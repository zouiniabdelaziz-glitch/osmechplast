import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

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
  db.exec(`CREATE TABLE leads (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, created_at TEXT NOT NULL);`);
  for (const file of ['migrations/0002_lead_uploads.sql', 'migrations/0003_lead_requests.sql', 'migrations/0004_upload_audit_log.sql']) db.exec(fs.readFileSync(file, 'utf8'));
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('lead_uploads','lead_requests','upload_audit_log') ORDER BY name").all().map(row => row.name);
  assert.deepEqual(tables, ['lead_requests', 'lead_uploads', 'upload_audit_log']);
});
