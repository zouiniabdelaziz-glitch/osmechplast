import { allowedUploadActions } from '../upload/state.mjs';

async function rows(db, sql, values = []) {
  const statement = db.prepare(sql);
  if (typeof statement.bind === 'function') {
    const result = await statement.bind(...values).all();
    return result.results || [];
  }
  return statement.all(...values);
}

async function row(db, sql, values = []) {
  const statement = db.prepare(sql);
  if (typeof statement.bind === 'function') return statement.bind(...values).first();
  return statement.get(...values);
}

function escapeLike(value) {
  return value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
}

function plain(value) {
  return value ? { ...value } : value;
}

export async function listLeads(db, { page = 1, status, query } = {}) {
  const safePage = Number.isSafeInteger(page) && page >= 1 && page <= 10000 ? page : 1;
  const params = [];
  const conditions = [];
  if (status) {
    conditions.push('l.workflow_status = ?');
    params.push(status);
  }
  if (query) {
    const like = `%${escapeLike(String(query).trim())}%`;
    conditions.push("(l.company LIKE ? ESCAPE '\\' OR l.name LIKE ? ESCAPE '\\' OR l.email LIKE ? ESCAPE '\\')");
    params.push(like, like, like);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(26, (safePage - 1) * 25);
  const result = await rows(db, `
    SELECT l.id, l.company, l.name, l.email, l.phone, l.service, l.language, l.created_at,
      l.workflow_status, l.workflow_version,
      l.status AS intake_status,
      COUNT(u.id) AS file_count,
      SUM(CASE WHEN u.security_status = 'quarantine' THEN 1 ELSE 0 END) AS quarantine_count,
      SUM(CASE WHEN u.security_status = 'approved' THEN 1 ELSE 0 END) AS approved_count,
      SUM(CASE WHEN u.security_status = 'rejected' THEN 1 ELSE 0 END) AS rejected_count
    FROM leads l
    LEFT JOIN lead_uploads u ON u.lead_id = l.id
    ${where}
    GROUP BY l.id
    ORDER BY l.created_at DESC, l.id DESC
    LIMIT ? OFFSET ?
  `, params);
  const items = result.slice(0, 25).map((item) => ({
    ...plain(item),
    id: Number(item.id),
    file_count: Number(item.file_count || 0),
    file_status_summary: {
      quarantine: Number(item.quarantine_count || 0),
      approved: Number(item.approved_count || 0),
      rejected: Number(item.rejected_count || 0),
    },
  }));
  return { items, page: safePage, has_more: result.length > 25 };
}

export async function getLeadDetails(db, leadId) {
  const lead = await row(db, `
    SELECT id, company, name, email, phone, service, message, language, source,
      created_at, workflow_status, workflow_version, status AS intake_status
    FROM leads WHERE id = ?
  `, [leadId]);
  if (!lead) return null;
  const uploads = await rows(db, `
    SELECT id, original_name, extension, detected_type, byte_size, created_at, stored_at,
      reviewed_at, storage_status, security_status, rejection_reason
    FROM lead_uploads WHERE lead_id = ? ORDER BY created_at ASC, id ASC
  `, [leadId]);
  const audits = await rows(db, `
    SELECT occurred_at, from_status, from_version, to_status, to_version
    FROM lead_status_audit
    WHERE lead_id = ? AND result = 'success' AND detail_code = 'status_changed'
    ORDER BY occurred_at ASC, id ASC
  `, [leadId]);
  const detail = plain(lead);
  detail.id = Number(detail.id);
  detail.uploads = uploads.map((upload) => ({
    ...plain(upload),
    id: String(upload.id),
    byte_size: Number(upload.byte_size),
    allowed_actions: allowedUploadActions(upload),
  }));
  detail.events = [
    { type: 'received', occurred_at: detail.created_at },
    ...audits.map((audit) => ({
      type: 'status_changed',
      occurred_at: audit.occurred_at,
      from_status: audit.from_status,
      from_version: Number(audit.from_version),
      to_status: audit.to_status,
      to_version: Number(audit.to_version),
    })),
  ];
  return detail;
}
