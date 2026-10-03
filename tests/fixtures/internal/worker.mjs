import { changeLeadStatus } from '../../../functions/internal/lead-workflow.mjs';

export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname;
    if (pathname === '/__test/status' && request.method === 'POST') {
      const body = await request.json();
      const result = await changeLeadStatus(env.DB, {
        requestId: body.request_id,
        actorId: 'local-d1-employee',
        leadId: Number(body.lead_id || 1),
        expectedStatus: body.expected_status,
        expectedVersion: body.expected_version,
        targetStatus: body.target_status,
        occurredAt: '2026-09-25T04:01:00.000Z',
      });
      return new Response(JSON.stringify(result), { status: result.httpStatus, headers: { 'content-type': 'application/json' } });
    }
    if (pathname === '/__test/state' && request.method === 'GET') {
      const leadId = Number(new URL(request.url).searchParams.get('lead') || 1);
      const state = await env.DB.prepare('SELECT workflow_status, workflow_version FROM leads WHERE id = ?').bind(leadId).first();
      const counts = await env.DB.prepare('SELECT (SELECT COUNT(*) FROM lead_status_requests) AS requests, (SELECT COUNT(*) FROM lead_status_audit) AS audits').first();
      return Response.json({ ...state, ...counts });
    }
    if (pathname === '/__test/audits' && request.method === 'GET') {
      const audits = await env.DB.prepare('SELECT request_id, lead_id, result, detail_code FROM lead_status_audit ORDER BY id').all();
      return Response.json({ audits: audits.results });
    }
    if (pathname === '/__test/rollback' && request.method === 'POST') {
      try {
        await env.DB.batch([
          env.DB.prepare('UPDATE leads SET workflow_version = workflow_version + 1 WHERE id = 1'),
          env.DB.prepare('INSERT INTO missing_local_d1_table VALUES (1)'),
        ]);
      } catch {}
      const state = await env.DB.prepare('SELECT workflow_version FROM leads WHERE id = 1').first();
      return Response.json({ rolled_back: state.workflow_version === 1, version: state.workflow_version });
    }
    if (pathname === '/__test/audit-failure' && request.method === 'POST') {
      await env.DB.prepare(`
        CREATE TRIGGER local_force_lead_audit_failure
        BEFORE INSERT ON lead_status_audit
        BEGIN SELECT RAISE(ABORT, 'forced_audit_failure'); END
      `).run();
      let result;
      try {
        result = await changeLeadStatus(env.DB, {
          requestId: '00000000-0000-4000-8000-000000000303',
          actorId: 'local-d1-employee',
          leadId: 2,
          expectedStatus: 'new',
          expectedVersion: 0,
          targetStatus: 'in_progress',
          occurredAt: '2026-09-25T04:02:00.000Z',
        });
      } finally {
        await env.DB.prepare('DROP TRIGGER local_force_lead_audit_failure').run();
      }
      const state = await env.DB.prepare('SELECT workflow_status, workflow_version FROM leads WHERE id = 2').first();
      const counts = await env.DB.prepare('SELECT (SELECT COUNT(*) FROM lead_status_requests) AS requests, (SELECT COUNT(*) FROM lead_status_audit) AS audits').first();
      return Response.json({ result, state, ...counts });
    }
    if (pathname === '/__test/review-gate' && request.method === 'POST') {
      const uploads = [
        ['00000000-0000-0000-0000-000000000401', 'gate-approve.pdf'],
        ['00000000-0000-0000-0000-000000000402', 'gate-reject.pdf'],
      ];
      for (const [id, name] of uploads) {
        await env.DB.prepare(`
          INSERT INTO lead_uploads (id, lead_id, sha256, original_name, extension, detected_type, r2_key, byte_size, storage_status, security_status, created_at)
          VALUES (?, 1, ?, ?, 'pdf', 'application/pdf', ?, 4, 'stored', 'quarantine', '2026-09-25T04:03:00.000Z')
        `).bind(id, id, name, `leads/1/${name}`).run();
      }
      const errors = [];
      for (const [id, status] of [[uploads[0][0], 'approved'], [uploads[1][0], 'rejected']]) {
        try {
          await env.DB.prepare(`
            UPDATE lead_uploads
            SET security_status = ?, reviewed_by = 'local-d1-employee', reviewed_at = '2026-09-25T04:03:01.000Z', review_request_id = ?
            WHERE id = ?
          `).bind(status, `00000000-0000-0000-0000-0000000004${status === 'approved' ? '1' : '2'}`, id).run();
        } catch (error) { errors.push(error.message); }
      }
      const rows = await env.DB.prepare('SELECT security_status, review_request_id FROM lead_uploads WHERE id IN (?, ?) ORDER BY id').bind(...uploads.map(([id]) => id)).all();
      const auditCount = await env.DB.prepare('SELECT COUNT(*) AS count FROM upload_audit_log').first();
      return Response.json({ errors, rows: rows.results, auditCount: auditCount.count });
    }
    if (pathname === '/__test/migration-abort' && request.method === 'POST') {
      await env.DB.prepare(`CREATE TRIGGER local_migration_block BEFORE UPDATE OF security_status ON lead_uploads BEGIN SELECT RAISE(ABORT, 'review_unavailable'); END`).run();
      try {
        await env.DB.batch([
          env.DB.prepare(`CREATE TRIGGER local_required_audit AFTER BOGUS UPDATE OF security_status ON lead_uploads BEGIN SELECT 1; END`),
          env.DB.prepare('DROP TRIGGER local_migration_block'),
        ]);
      } catch {}
      const uploads = [
        ['00000000-0000-0000-0000-000000000403', 'abort-approve.pdf'],
        ['00000000-0000-0000-0000-000000000404', 'abort-reject.pdf'],
      ];
      for (const [id, name] of uploads) {
        await env.DB.prepare(`INSERT INTO lead_uploads (id, lead_id, sha256, original_name, extension, detected_type, r2_key, byte_size, storage_status, security_status, created_at) VALUES (?, 1, ?, ?, 'pdf', 'application/pdf', ?, 4, 'stored', 'quarantine', '2026-09-25T04:04:00.000Z')`).bind(id, id, name, `leads/1/${name}`).run();
      }
      const errors = [];
      for (const [id, status] of [[uploads[0][0], 'approved'], [uploads[1][0], 'rejected']]) {
        try {
          await env.DB.prepare(`UPDATE lead_uploads SET security_status = ?, reviewed_by = 'local-d1-employee', reviewed_at = '2026-09-25T04:04:01.000Z', review_request_id = ? WHERE id = ?`).bind(status, `00000000-0000-0000-0000-0000000004${status === 'approved' ? '3' : '4'}`, id).run();
        } catch (error) { errors.push(error.message); }
      }
      const blockCount = await env.DB.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'trigger' AND name = 'local_migration_block'").first();
      const rows = await env.DB.prepare('SELECT security_status, review_request_id FROM lead_uploads WHERE id IN (?, ?) ORDER BY id').bind(...uploads.map(([id]) => id)).all();
      const auditCount = await env.DB.prepare('SELECT COUNT(*) AS count FROM upload_audit_log').first();
      await env.DB.prepare('DROP TRIGGER local_migration_block').run();
      return Response.json({ errors, blockCount: blockCount.count, rows: rows.results, auditCount: auditCount.count });
    }
    return new Response('not found', { status: 404 });
  },
};
