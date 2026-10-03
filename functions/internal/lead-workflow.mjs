const allowedTransitions = new Set([
  'new:in_progress',
  'new:completed',
  'in_progress:completed',
  'completed:in_progress',
]);

function sameRequest(row, input) {
  return row.actor_id === input.actorId
    && row.requested_lead_id === input.leadId
    && row.expected_status === input.expectedStatus
    && row.expected_version === input.expectedVersion
    && row.target_status === input.targetStatus;
}

function storedResult(row) {
  if (row.response_code === 200) {
    return { httpStatus: 200, ok: true, status: row.target_status, version: row.result_version };
  }
  if (row.response_code === 404) {
    return { httpStatus: 404, ok: false, error: 'lead_not_found' };
  }
  return {
    httpStatus: 409,
    ok: false,
    error: 'status_conflict',
    observedStatus: row.observed_status,
    observedVersion: row.observed_version,
  };
}

function insertAudit(db, values) {
  db.prepare(`
    INSERT INTO lead_status_audit (
      request_id, lead_id, actor_type, actor_id, action, result, detail_code,
      expected_status, expected_version, from_status, from_version,
      to_status, to_version, occurred_at
    ) VALUES (?, ?, 'employee', ?, 'lead_status_change', 'denied', ?, ?, ?, ?, ?, NULL, NULL, ?)
  `).run(
    values.requestId,
    values.leadId,
    values.actorId,
    values.detailCode,
    values.expectedStatus,
    values.expectedVersion,
    values.observedStatus ?? null,
    values.observedVersion ?? null,
    values.occurredAt,
  );
}

export async function changeLeadStatus(db, input) {
  if (typeof db.batch === 'function') return changeLeadStatusD1(db, input);
  const transition = `${input.expectedStatus}:${input.targetStatus}`;
  if (!allowedTransitions.has(transition)) {
    return { httpStatus: 400, ok: false, error: 'invalid_transition' };
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    const existing = db.prepare(`
      SELECT request_id, actor_id, requested_lead_id, expected_status, expected_version,
        target_status, response_code, observed_status, observed_version, result_version
      FROM lead_status_requests WHERE request_id = ?
    `).get(input.requestId);

    if (existing) {
      if (!sameRequest(existing, input)) {
        insertAudit(db, {
          requestId: input.requestId,
          leadId: null,
          actorId: input.actorId,
          detailCode: 'idempotency_conflict',
          expectedStatus: input.expectedStatus,
          expectedVersion: input.expectedVersion,
          targetStatus: input.targetStatus,
          occurredAt: input.occurredAt,
        });
        db.exec('COMMIT');
        return { httpStatus: 409, ok: false, error: 'idempotency_conflict' };
      }
      db.exec('COMMIT');
      return storedResult(existing);
    }

    const lead = db.prepare('SELECT id, workflow_status, workflow_version FROM leads WHERE id = ?').get(input.leadId);
    const responseCode = lead === undefined
      ? 404
      : (lead.workflow_status === input.expectedStatus && lead.workflow_version === input.expectedVersion ? 200 : 409);
    const detailCode = responseCode === 200 ? 'status_changed' : responseCode === 404 ? 'lead_not_found' : 'status_conflict';
    const observedStatus = lead?.workflow_status ?? null;
    const observedVersion = lead?.workflow_version ?? null;
    const resultVersion = responseCode === 200 ? input.expectedVersion + 1 : null;

    db.prepare(`
      INSERT INTO lead_status_requests (
        request_id, actor_id, requested_lead_id, lead_id, expected_status, expected_version,
        target_status, observed_status, observed_version, response_code, detail_code,
        result_version, occurred_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.requestId,
      input.actorId,
      input.leadId,
      lead?.id ?? null,
      input.expectedStatus,
      input.expectedVersion,
      input.targetStatus,
      observedStatus,
      observedVersion,
      responseCode,
      detailCode,
      resultVersion,
      input.occurredAt,
    );

    db.exec('COMMIT');
    return responseCode === 200
      ? { httpStatus: 200, ok: true, status: input.targetStatus, version: resultVersion }
      : responseCode === 404
        ? { httpStatus: 404, ok: false, error: 'lead_not_found' }
        : { httpStatus: 409, ok: false, error: 'status_conflict', observedStatus, observedVersion };
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    return { httpStatus: 503, ok: false, error: 'temporarily_unavailable' };
  }
}

async function d1First(db, sql, values) {
  return db.prepare(sql).bind(...values).first();
}

async function changeLeadStatusD1(db, input) {
  const transition = `${input.expectedStatus}:${input.targetStatus}`;
  if (!allowedTransitions.has(transition)) return { httpStatus: 400, ok: false, error: 'invalid_transition' };
  try {
    await db.batch([
      db.prepare(`
        WITH current AS (
          SELECT ? AS requested_lead_id, leads.id, leads.workflow_status, leads.workflow_version
          FROM (SELECT 1) AS seed
          LEFT JOIN leads ON leads.id = ?
        )
        INSERT INTO lead_status_requests (
          request_id, actor_id, requested_lead_id, lead_id, expected_status, expected_version,
          target_status, observed_status, observed_version, response_code, detail_code,
          result_version, occurred_at
        )
        SELECT ?, ?, current.requested_lead_id, current.id, ?, ?, ?, current.workflow_status,
          current.workflow_version,
          CASE WHEN current.id IS NULL THEN 404
               WHEN current.workflow_status = ? AND current.workflow_version = ? THEN 200
               ELSE 409 END,
          CASE WHEN current.id IS NULL THEN 'lead_not_found'
               WHEN current.workflow_status = ? AND current.workflow_version = ? THEN 'status_changed'
               ELSE 'status_conflict' END,
          CASE WHEN current.id IS NOT NULL AND current.workflow_status = ? AND current.workflow_version = ? THEN ? ELSE NULL END,
          ?
        FROM current
        WHERE NOT EXISTS (SELECT 1 FROM lead_status_requests WHERE request_id = ?)
      `).bind(
        input.leadId, input.leadId, input.requestId, input.actorId, input.expectedStatus, input.expectedVersion,
        input.targetStatus, input.expectedStatus, input.expectedVersion, input.expectedStatus, input.expectedVersion,
        input.expectedStatus, input.expectedVersion, input.expectedVersion + 1, input.occurredAt, input.requestId,
      ),
      db.prepare(`
        INSERT INTO lead_status_audit (
          request_id, lead_id, actor_type, actor_id, action, result, detail_code,
          expected_status, expected_version, from_status, from_version,
          to_status, to_version, occurred_at
        )
        SELECT r.request_id, NULL, 'employee', ?, 'lead_status_change', 'denied', 'idempotency_conflict',
          ?, ?, NULL, NULL, NULL, NULL, ?
        FROM lead_status_requests r
        WHERE r.request_id = ?
          AND (r.actor_id <> ? OR r.requested_lead_id <> ? OR r.expected_status <> ?
               OR r.expected_version <> ? OR r.target_status <> ?)
      `).bind(
        input.actorId, input.expectedStatus, input.expectedVersion, input.occurredAt,
        input.requestId, input.actorId, input.leadId, input.expectedStatus, input.expectedVersion, input.targetStatus,
      ),
    ]);

    const existing = await d1First(db, `
      SELECT request_id, actor_id, requested_lead_id, expected_status, expected_version,
        target_status, response_code, observed_status, observed_version, result_version
      FROM lead_status_requests WHERE request_id = ?
    `, [input.requestId]);
    if (!existing) return { httpStatus: 503, ok: false, error: 'temporarily_unavailable' };
    if (!sameRequest(existing, input)) return { httpStatus: 409, ok: false, error: 'idempotency_conflict' };
    return storedResult(existing);
  } catch {
    return { httpStatus: 503, ok: false, error: 'temporarily_unavailable' };
  }
}
