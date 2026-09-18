const BATCH_LIMIT = 100;
const STALE_MS = 24 * 60 * 60 * 1000;
const IDEMPOTENCY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_ORPHAN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

async function rowsForCleanup(env) {
  const result = await env.DB.prepare("SELECT * FROM lead_uploads WHERE storage_status IN ('pending','failed','delete_pending') ORDER BY created_at LIMIT ?").bind(BATCH_LIMIT).all();
  return result.results || [];
}

async function audit(env, action, result, detailCode, uploadId = null, leadId = null) {
  await env.DB.prepare('INSERT INTO upload_audit_log (upload_id, lead_id, actor_type, actor_id, occurred_at, action, result, detail_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(uploadId, leadId, 'cleanup', null, new Date().toISOString(), action, result, detailCode).run().catch(() => {});
}

export async function runUploadCleanup(env, now = new Date()) {
  const rows = await rowsForCleanup(env);
  const result = { processed: 0, deleted: 0, failed: 0 };
  for (const row of rows.slice(0, BATCH_LIMIT)) {
    result.processed += 1;
    if (Date.parse(row.created_at) > now.getTime() - STALE_MS && row.storage_status === 'pending') continue;
    try {
      if (row.r2_key) await env.RFQ_UPLOADS.delete(row.r2_key);
      await env.DB.prepare("UPDATE lead_uploads SET storage_status='deleted', deleted_at=? WHERE id=?").bind(now.toISOString(), row.id).run();
      await audit(env, 'file_deleted', 'success', 'cleanup_deleted', row.id, row.lead_id);
      result.deleted += 1;
    } catch {
      result.failed += 1;
      await env.DB.prepare("UPDATE lead_uploads SET storage_status='delete_pending', error_code='cleanup_failed' WHERE id=?").bind(row.id).run().catch(() => {});
      await audit(env, 'cleanup_failed', 'failed', 'cleanup_failed', row.id, row.lead_id);
    }
  }
  if (env.RFQ_UPLOADS?.get && result.processed < BATCH_LIMIT) {
    const storedRows = (await env.DB.prepare("SELECT id, lead_id, r2_key FROM lead_uploads WHERE storage_status = 'stored' ORDER BY created_at LIMIT ?").bind(BATCH_LIMIT - result.processed).all()).results || [];
    for (const row of storedRows) {
      if (result.processed >= BATCH_LIMIT) break;
      result.processed += 1;
      if (!row.r2_key?.startsWith('leads/')) continue;
      const object = await env.RFQ_UPLOADS.get(row.r2_key).catch(() => null);
      if (object) continue;
      await env.DB.prepare("UPDATE lead_uploads SET storage_status='delete_pending', error_code='r2_object_missing' WHERE id=?").bind(row.id).run().catch(() => {});
      await audit(env, 'cleanup_failed', 'failed', 'r2_object_missing', row.id, row.lead_id);
      result.failed += 1;
    }
  }
  if (env.RFQ_UPLOADS?.list) {
    const retentionConfirmed = env.UPLOAD_RETENTION_CONFIRMED === '1';
    const configuredRetention = Number(env.UPLOAD_ORPHAN_RETENTION_MS);
    const retentionMs = retentionConfirmed && Number.isSafeInteger(configuredRetention) && configuredRetention > 0
      ? configuredRetention
      : null;
    let cursor;
    let exhausted = false;
    while (!exhausted && result.processed < BATCH_LIMIT) {
      const remaining = BATCH_LIMIT - result.processed;
      const options = { prefix: 'leads/', limit: remaining };
      if (cursor) options.cursor = cursor;
      const page = await env.RFQ_UPLOADS.list(options);
      const objects = page.objects || [];
      for (const object of objects) {
        if (result.processed >= BATCH_LIMIT) break;
        result.processed += 1;
        const key = object?.key;
        if (typeof key !== 'string' || !key.startsWith('leads/')) continue;
        const known = await env.DB.prepare('SELECT 1 FROM lead_uploads WHERE r2_key = ? LIMIT 1').bind(key).first().catch(() => null);
        if (known) continue;
        const rawTime = object.uploaded ?? object.lastModified ?? object.metadata?.uploaded_at;
        const objectTime = rawTime instanceof Date ? rawTime.getTime() : Date.parse(String(rawTime ?? ''));
        if (!Number.isFinite(objectTime)) {
          await audit(env, 'cleanup_failed', 'skipped', 'orphan_age_unknown');
          continue;
        }
        if (retentionMs == null) {
          await audit(env, 'cleanup_failed', 'skipped', 'orphan_retention_unconfirmed');
          continue;
        }
        if (objectTime > now.getTime() - retentionMs) continue;
        try {
          await env.RFQ_UPLOADS.delete(key);
          await audit(env, 'file_deleted', 'success', 'orphan_deleted');
          result.deleted += 1;
        } catch {
          result.failed += 1;
          await audit(env, 'cleanup_failed', 'failed', 'orphan_delete_failed');
        }
      }
      if (!page.truncated || !page.cursor) exhausted = true;
      else cursor = page.cursor;
    }
  }
  const completedBefore = new Date(now.getTime() - IDEMPOTENCY_RETENTION_MS).toISOString();
  await env.DB.prepare("DELETE FROM lead_requests WHERE state IN ('succeeded','failed') AND completed_at IS NOT NULL AND completed_at < ?").bind(completedBefore).run().catch(() => {});
  await audit(env, 'file_deleted', 'success', 'cleanup_run');
  return result;
}

export default { async scheduled(_event, env) { return runUploadCleanup(env); } };
