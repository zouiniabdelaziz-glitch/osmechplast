import test from 'node:test';
import assert from 'node:assert/strict';

import { closeInternalTestDb, openInternalTestDb } from './helpers/internal-sqlite.mjs';
import { listLeads, getLeadDetails } from '../functions/internal/leads-api.mjs';

function insertLead(db, index, status = 'new') {
  const result = db.prepare(`
    INSERT INTO leads (company, name, email, phone, service, message, language, source, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(`Firma ${index}`, `Person ${index}`, `person${index}@example.test`, '+49 0', 'turning', 'synthetic', 'de', 'test', 'new', `2026-09-25T${String(index % 24).padStart(2, '0')}:00:00.000Z`);
  const id = Number(result.lastInsertRowid);
  db.prepare('UPDATE leads SET workflow_status = ? WHERE id = ?').run(status, id);
  return id;
}

test('lists leads with 25-item pagination, stable ordering, status filtering and escaped search', async () => {
  const db = openInternalTestDb({ through: '0006' });

  try {
    for (let index = 0; index < 26; index += 1) insertLead(db, index, index === 0 ? 'completed' : 'new');
    const first = await listLeads(db, { page: 1 });
    const filtered = await listLeads(db, { page: 1, status: 'completed' });
    const searched = await listLeads(db, { page: 1, query: 'Firma 1%' });

    assert.equal(first.items.length, 25);
    assert.equal(first.has_more, true);
    assert.equal(first.page, 1);
    assert.equal(filtered.items.length, 1);
    assert.equal(filtered.items[0].workflow_status, 'completed');
    assert.equal(searched.items.length, 0);
    assert.equal(Object.hasOwn(first.items[0], 'message'), false);
    assert.equal(Object.hasOwn(first.items[0], 'r2_key'), false);
  } finally {
    closeInternalTestDb(db);
  }
});

test('returns detail metadata, allowed actions and only real status audit events', async () => {
  const db = openInternalTestDb({ through: '0006' });

  try {
    const leadId = insertLead(db, 99, 'in_progress');
    db.prepare(`
      INSERT INTO lead_uploads (id, lead_id, sha256, original_name, extension, detected_type, r2_key, byte_size, storage_status, security_status, created_at)
      VALUES (?, ?, 'hash', 'part.pdf', 'pdf', 'application/pdf', 'secret/r2', 4, 'stored', 'quarantine', '2026-09-25T03:00:00.000Z')
    `).run('00000000-0000-4000-8000-000000000201', leadId);
    const detail = await getLeadDetails(db, leadId);

    assert.equal(detail.id, leadId);
    assert.equal(detail.workflow_status, 'in_progress');
    assert.equal(detail.uploads[0].original_name, 'part.pdf');
    assert.deepEqual(detail.uploads[0].allowed_actions, ['download', 'approve', 'reject']);
    assert.equal(Object.hasOwn(detail.uploads[0], 'r2_key'), false);
    assert.equal(Object.hasOwn(detail, 'ai_analysis'), false);
    assert.deepEqual(detail.events, [{ type: 'received', occurred_at: detail.created_at }]);
  } finally {
    closeInternalTestDb(db);
  }
});
