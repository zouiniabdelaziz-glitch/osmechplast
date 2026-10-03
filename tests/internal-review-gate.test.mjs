import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { closeInternalTestDb, openInternalTestDb } from './helpers/internal-sqlite.mjs';
import { seedInternalFixtures } from './internal-fixtures.mjs';

function seedQuarantinedUpload(db, leadId) {
  db.prepare(`
    INSERT INTO lead_uploads (
      id, lead_id, sha256, original_name, extension, detected_type, r2_key, byte_size,
      storage_status, security_status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'stored', 'quarantine', ?)
  `).run(
    '00000000-0000-4000-8000-000000000101', leadId, 'hash', 'part.pdf', 'pdf',
    'application/pdf', 'leads/1/part.pdf', 4, '2026-09-25T02:00:00.000Z',
  );
}

test('0005 remains closed even when enabled is accidentally set to one', () => {
  const db = openInternalTestDb({ through: '0005' });

  try {
    const { leadId } = seedInternalFixtures(db);
    seedQuarantinedUpload(db, leadId);
    db.prepare('UPDATE internal_review_control SET enabled = 1 WHERE id = 1').run();

    assert.throws(() => db.prepare(`
      UPDATE lead_uploads
      SET security_status = 'approved', reviewed_by = 'employee-subject',
          reviewed_at = '2026-09-25T02:01:00.000Z', review_request_id = ?
      WHERE id = ?
    `).run('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000101'), /review_unavailable/u);
    assert.equal(db.prepare('SELECT security_status FROM lead_uploads WHERE id = ?').get('00000000-0000-4000-8000-000000000101').security_status, 'quarantine');
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM upload_audit_log WHERE action = 'file_approved'").get().count, 0);
  } finally {
    closeInternalTestDb(db);
  }
});

test('the independent migration block does not prevent cleanup storage transitions', () => {
  const db = openInternalTestDb({ through: '0005' });

  try {
    const { leadId } = seedInternalFixtures(db);
    seedQuarantinedUpload(db, leadId);
    db.prepare('UPDATE lead_uploads SET storage_status = ? WHERE id = ?').run('delete_pending', '00000000-0000-4000-8000-000000000101');
    assert.equal(db.prepare('SELECT storage_status FROM lead_uploads WHERE id = ?').get('00000000-0000-4000-8000-000000000101').storage_status, 'delete_pending');
  } finally {
    closeInternalTestDb(db);
  }
});

test('0006 replaces the migration block with a guarded atomic review audit', () => {
  const db = openInternalTestDb({ through: '0006' });

  try {
    const triggers = db.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' ORDER BY name").all().map((row) => row.name);
    assert.equal(triggers.includes('upload_review_migration_block'), false);
    assert.equal(triggers.includes('upload_review_guard'), true);
    assert.equal(triggers.includes('upload_review_success_audit'), true);

    const { leadId } = seedInternalFixtures(db);
    seedQuarantinedUpload(db, leadId);
    db.prepare('UPDATE internal_review_control SET enabled = 1 WHERE id = 1').run();
    db.prepare(`
      UPDATE lead_uploads
      SET security_status = 'approved', reviewed_by = 'employee-subject',
          reviewed_at = '2026-09-25T02:02:00.000Z', review_request_id = ?
      WHERE id = ?
    `).run('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000101');

    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM upload_audit_log WHERE action = 'file_approved' AND result = 'success'").get().count, 1);
  } finally {
    closeInternalTestDb(db);
  }
});

test('0006 remains closed when the control row is missing and rolls back both review actions', () => {
  const db = openInternalTestDb({ through: '0006' });
  try {
    const { leadId } = seedInternalFixtures(db);
    seedQuarantinedUpload(db, leadId);
    db.prepare('DELETE FROM internal_review_control WHERE id = 1').run();
    for (const status of ['approved', 'rejected']) {
      assert.throws(() => db.prepare(`
        UPDATE lead_uploads
        SET security_status = ?, reviewed_by = 'employee-subject', reviewed_at = '2026-09-25T02:03:00.000Z',
            review_request_id = ?, rejection_reason = ?
        WHERE id = ?
      `).run(status, `00000000-0000-4000-8000-00000000010${status === 'approved' ? '4' : '5'}`, status === 'rejected' ? 'reason' : null, '00000000-0000-4000-8000-000000000101'), /review_unavailable/u);
      const row = db.prepare('SELECT security_status, reviewed_by, review_request_id FROM lead_uploads WHERE id = ?').get('00000000-0000-4000-8000-000000000101');
      assert.deepEqual({ ...row }, { security_status: 'quarantine', reviewed_by: null, review_request_id: null });
    }
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM upload_audit_log').get().count, 0);
  } finally { closeInternalTestDb(db); }
});

test('0006 executes its control update, guard, audit trigger and migration-block removal', () => {
  const migration = readFileSync('migrations/0006_upload_review_audit.sql', 'utf8');
  const db = openInternalTestDb({ through: '0006' });
  try {
    assert.equal(db.prepare('SELECT enabled, protocol_version FROM internal_review_control WHERE id = 1').get().enabled, 0);
    const { leadId } = seedInternalFixtures(db);
    seedQuarantinedUpload(db, leadId);
    db.prepare('UPDATE internal_review_control SET enabled = 1 WHERE id = 1').run();
    db.prepare(`UPDATE lead_uploads SET security_status = 'approved', reviewed_by = 'employee-subject', reviewed_at = '2026-09-25T02:06:00.000Z', review_request_id = ? WHERE id = ?`).run('00000000-0000-4000-8000-000000000107', '00000000-0000-4000-8000-000000000101');
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM upload_audit_log WHERE action = 'file_approved' AND result = 'success'").get().count, 1);
    db.prepare('UPDATE lead_uploads SET storage_status = ? WHERE id = ?').run('delete_pending', '00000000-0000-4000-8000-000000000101');
    assert.equal(db.prepare('SELECT storage_status FROM lead_uploads WHERE id = ?').get('00000000-0000-4000-8000-000000000101').storage_status, 'delete_pending');
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'trigger' AND name = 'upload_review_migration_block'").get().count, 0);
  } finally { closeInternalTestDb(db); }
  const preMigration = openInternalTestDb({ through: '0004' });
  try { assert.throws(() => preMigration.exec(migration)); } finally { closeInternalTestDb(preMigration); }
});

test('old review handlers and audit failures cannot leave a partial review', () => {
  const db = openInternalTestDb({ through: '0006' });
  try {
    const { leadId } = seedInternalFixtures(db);
    seedQuarantinedUpload(db, leadId);
    db.prepare('UPDATE internal_review_control SET enabled = 1 WHERE id = 1').run();
    assert.throws(() => db.prepare(`UPDATE lead_uploads SET security_status = 'approved', reviewed_by = 'employee-subject', reviewed_at = '2026-09-25T02:04:00.000Z' WHERE id = ?`).run('00000000-0000-4000-8000-000000000101'), /review_unavailable/u);
    db.prepare('DROP TABLE upload_audit_log').run();
    assert.throws(() => db.prepare(`UPDATE lead_uploads SET security_status = 'approved', reviewed_by = 'employee-subject', reviewed_at = '2026-09-25T02:05:00.000Z', review_request_id = ? WHERE id = ?`).run('00000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-000000000101'));
    const row = db.prepare('SELECT security_status, reviewed_by, reviewed_at, review_request_id FROM lead_uploads WHERE id = ?').get('00000000-0000-4000-8000-000000000101');
    assert.deepEqual({ ...row }, { security_status: 'quarantine', reviewed_by: null, reviewed_at: null, review_request_id: null });
  } finally { closeInternalTestDb(db); }
});

test('every complete 0006 prefix keeps the open gate blocked before the final drop', () => {
  const statements = readFileSync('migrations/0006_upload_review_audit.sql', 'utf8')
    .split(/;\r?\n\r?\n/u)
    .map((statement) => statement.trim())
    .filter(Boolean);
  assert.equal(statements.length, 4);
  assert.match(statements.at(-1), /^DROP TRIGGER\s+upload_review_migration_block;?$/u);

  for (let prefixLength = 1; prefixLength < statements.length; prefixLength += 1) {
    const db = openInternalTestDb({ through: '0005' });
    try {
      db.exec(statements.slice(0, prefixLength).map((statement) => `${statement};`).join('\n'));
      const { leadId } = seedInternalFixtures(db);
      seedQuarantinedUpload(db, leadId);
      db.prepare('UPDATE internal_review_control SET enabled = 1 WHERE id = 1').run();
      for (const status of ['approved', 'rejected']) {
        assert.throws(() => db.prepare(`
          UPDATE lead_uploads
          SET security_status = ?, reviewed_by = 'employee-subject', reviewed_at = '2026-09-25T02:08:00.000Z',
              review_request_id = ?, rejection_reason = ?
          WHERE id = ?
        `).run(status, `00000000-0000-4000-8000-00000000020${prefixLength}${status === 'approved' ? '1' : '2'}`, status === 'rejected' ? 'reason' : null, '00000000-0000-4000-8000-000000000101'), /review_unavailable/u);
      }
      assert.equal(db.prepare('SELECT COUNT(*) AS count FROM upload_audit_log').get().count, 0);
      assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'trigger' AND name = 'upload_review_migration_block'").get().count, 1);
    } finally { closeInternalTestDb(db); }
  }
});

test('a required-trigger creation error stops the executor before the migration drop', () => {
  const statements = readFileSync('migrations/0006_upload_review_audit.sql', 'utf8')
    .split(/;\r?\n\r?\n/u).map((statement) => statement.trim()).filter(Boolean);
  const db = openInternalTestDb({ through: '0005' });
  try {
    const brokenExecutorInput = [
      statements[0],
      statements[1],
      statements[2].replace('AFTER UPDATE OF', 'AFTER BOGUS UPDATE OF'),
      statements[3],
    ].map((statement) => `${statement};`).join('\n');
    assert.throws(() => db.exec(brokenExecutorInput));
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'trigger' AND name = 'upload_review_migration_block'").get().count, 1);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'trigger' AND name = 'upload_review_success_audit'").get().count, 0);
  } finally { closeInternalTestDb(db); }

});
