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
  assert.ok(sql.some((statement) => /lead_uploads/i.test(statement)));
});

function cleanupFixture(objects, { retentionConfirmed = true, rows = [] } = {}) {
  const deleted = [];
  const audits = [];
  const listCalls = [];
  const env = {
    UPLOAD_RETENTION_CONFIRMED: retentionConfirmed ? '1' : '0',
    UPLOAD_ORPHAN_RETENTION_MS: String(7 * 24 * 60 * 60 * 1000),
    DB: { prepare(sql) {
      return {
        bind(...args) { return {
          async all() { return { results: sql.includes('storage_status IN') ? rows : [] }; },
          async first() { return null; },
          async run() { if (/upload_audit_log/i.test(sql)) audits.push({ sql, args }); return { meta: { changes: 1 } }; }
        }; },
        async all() { return { results: sql.includes('storage_status IN') ? rows : [] }; },
        async first() { return null; },
        async run() { if (/upload_audit_log/i.test(sql)) audits.push({ sql, args: [] }); return { meta: { changes: 1 } }; }
      };
    } },
    RFQ_UPLOADS: {
      async list(options = {}) { listCalls.push(options); return { objects, truncated: false }; },
      async delete(key) { deleted.push(key); }
    }
  };
  return { env, deleted, audits, listCalls };
}

test('young orphan remains and old orphan is deleted only after retention', async () => {
  const now = new Date('2026-09-18T00:00:00Z');
  const fixture = cleanupFixture([
    { key: 'leads/young/a.pdf', uploaded: new Date('2026-09-15T00:00:00Z') },
    { key: 'leads/old/b.pdf', uploaded: new Date('2026-09-01T00:00:00Z') }
  ]);
  await runUploadCleanup(fixture.env, now);
  assert.deepEqual(fixture.deleted, ['leads/old/b.pdf']);
  assert.ok(fixture.audits.length >= 2);
});

test('orphan with unknown age is not deleted and retention is fail-closed', async () => {
  const fixture = cleanupFixture([{ key: 'leads/unknown/a.pdf' }]);
  await runUploadCleanup(fixture.env, new Date('2026-09-18T00:00:00Z'));
  assert.deepEqual(fixture.deleted, []);
  assert.ok(fixture.audits.length >= 1);

  const disabled = cleanupFixture([{ key: 'leads/old/a.pdf', uploaded: new Date('2020-01-01T00:00:00Z') }], { retentionConfirmed: false });
  await runUploadCleanup(disabled.env, new Date('2026-09-18T00:00:00Z'));
  assert.deepEqual(disabled.deleted, []);
});

test('orphan cleanup uses a paginated namespace-limited batch', async () => {
  const calls = [];
  const deleted = [];
  let page = 0;
  const env = cleanupFixture([]).env;
  env.RFQ_UPLOADS.list = async options => {
    calls.push(options);
    page += 1;
    return page === 1
      ? { objects: Array.from({ length: 2 }, (_, i) => ({ key: `leads/p1/${i}.pdf`, uploaded: new Date('2020-01-01T00:00:00Z') })), truncated: true, cursor: 'next-page' }
      : { objects: [{ key: 'leads/p2/0.pdf', uploaded: new Date('2020-01-01T00:00:00Z') }], truncated: false };
  };
  env.RFQ_UPLOADS.delete = async key => deleted.push(key);
  await runUploadCleanup(env, new Date('2026-09-18T00:00:00Z'));
  assert.equal(calls[0].prefix, 'leads/');
  assert.equal(calls[1].cursor, 'next-page');
  assert.equal(deleted.length, 3);
});

test('failed orphan deletion is audited without exposing object data', async () => {
  const fixture = cleanupFixture([{ key: 'leads/fail/a.pdf', uploaded: new Date('2020-01-01T00:00:00Z') }]);
  fixture.env.RFQ_UPLOADS.delete = async () => { throw new Error('r2 failure'); };
  const result = await runUploadCleanup(fixture.env, new Date('2026-09-18T00:00:00Z'));
  assert.equal(result.failed, 1);
  assert.equal(fixture.audits.length >= 2, true);
  assert.equal(fixture.audits.some(entry => entry.args?.includes('orphan_delete_failed')), true);
  assert.equal(fixture.audits.some(entry => entry.args?.some(value => String(value).includes('leads/fail'))), false);
});
