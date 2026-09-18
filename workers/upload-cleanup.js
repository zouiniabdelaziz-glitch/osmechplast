const BATCH_LIMIT = 100;
const STALE_MS = 24 * 60 * 60 * 1000;

async function rowsForCleanup(env) {
  const result = await env.DB.prepare("SELECT * FROM lead_uploads WHERE storage_status IN ('pending','failed','delete_pending') ORDER BY created_at LIMIT ?").bind(BATCH_LIMIT).all();
  return result.results || [];
}

async function allKnownKeys(env) {
  const result = await env.DB.prepare('SELECT r2_key FROM lead_uploads WHERE r2_key IS NOT NULL').all();
  return new Set((result.results || []).map((row) => row.r2_key));
}

export async function runUploadCleanup(env, now = new Date()) {
  const rows = await rowsForCleanup(env);
  const known = await allKnownKeys(env);
  const result = { processed: 0, deleted: 0, failed: 0 };
  for (const row of rows.slice(0, BATCH_LIMIT)) {
    result.processed += 1;
    if (Date.parse(row.created_at) > now.getTime() - STALE_MS && row.storage_status === 'pending') continue;
    try {
      if (row.r2_key) await env.RFQ_UPLOADS.delete(row.r2_key);
      await env.DB.prepare("UPDATE lead_uploads SET storage_status='deleted', deleted_at=? WHERE id=?").bind(now.toISOString(), row.id).run();
      result.deleted += 1;
    } catch {
      result.failed += 1;
      await env.DB.prepare("UPDATE lead_uploads SET storage_status='delete_pending', error_code='cleanup_failed' WHERE id=?").bind(row.id).run().catch(() => {});
    }
  }
  if (env.RFQ_UPLOADS?.list) {
    const objects = (await env.RFQ_UPLOADS.list({ limit: BATCH_LIMIT })).objects || [];
    for (const object of objects.slice(0, BATCH_LIMIT)) {
      if (known.has(object.key)) continue;
      try { await env.RFQ_UPLOADS.delete(object.key); result.deleted += 1; } catch { result.failed += 1; }
    }
  }
  return result;
}

export default { async scheduled(_event, env) { return runUploadCleanup(env); } };
