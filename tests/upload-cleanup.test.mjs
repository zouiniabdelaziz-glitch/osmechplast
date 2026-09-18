import test from 'node:test';
import assert from 'node:assert/strict';
import { runUploadCleanup } from '../workers/upload-cleanup.js';

test('cleanup processes stale rows, orphans and missing objects in a bounded run', async () => {
  const deleted = [];
  const rows = [
    { id: 'old', lead_id: 1, r2_key: 'private/old', storage_status: 'pending', created_at: '2020-01-01T00:00:00Z' },
    { id: 'failed', lead_id: 1, r2_key: 'private/failed', storage_status: 'failed', created_at: '2020-01-01T00:00:00Z' },
  ];
  const env = { DB: { prepare(sql) { return { async all() { return { results: rows }; }, bind(...args) { return { async all() { return { results: rows }; }, async run() { return {}; } }; } }; } }, RFQ_UPLOADS: { async list() { return { objects: [{ key: 'private/orphan' }] }; }, async delete(key) { deleted.push(key); } } };
  const result = await runUploadCleanup(env, new Date('2025-01-01T00:00:00Z'));
  assert.ok(result.processed >= 2);
  assert.ok(deleted.includes('private/old') || deleted.includes('private/failed'));
});

test('cleanup queries expired idempotency and audits cleanup decisions', async () => {
  const sql = []; const env = { DB: { prepare(statement) { sql.push(statement); return { bind() { return { async all() { return { results: [] }; }, async run() { return {}; } }; }, async all() { return { results: [] }; } }; } }, RFQ_UPLOADS: { async list() { return { objects: [] }; } } };
  await runUploadCleanup(env, new Date('2025-01-01T00:00:00Z'));
  assert.ok(sql.some((statement) => /lead_requests/i.test(statement)));
  assert.ok(sql.some((statement) => /upload_audit_log/i.test(statement)));
  assert.ok(sql.some((statement) => /leads\//.test(statement) || /r2_key LIKE/i.test(statement)));
});
