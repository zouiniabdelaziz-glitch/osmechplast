CREATE TABLE IF NOT EXISTS upload_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  upload_id TEXT,
  lead_id INTEGER,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  occurred_at TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('upload_stored','validation_failed','file_approved','file_rejected','download_allowed','download_denied','deletion_requested','file_deleted','cleanup_failed')),
  result TEXT NOT NULL,
  detail_code TEXT,
  FOREIGN KEY (upload_id) REFERENCES lead_uploads(id) ON DELETE SET NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_upload_audit_upload ON upload_audit_log(upload_id, occurred_at);
