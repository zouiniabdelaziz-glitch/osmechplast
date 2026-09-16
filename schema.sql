CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company TEXT,
  name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  service TEXT,
  message TEXT,
  ai_analysis TEXT,
  language TEXT DEFAULT 'de',
  source TEXT DEFAULT 'website',
  status TEXT DEFAULT 'new',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lead_uploads (
  id TEXT PRIMARY KEY,
  lead_id INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  original_name TEXT NOT NULL,
  extension TEXT NOT NULL,
  detected_type TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  byte_size INTEGER NOT NULL,
  storage_status TEXT NOT NULL CHECK (storage_status IN ('pending','stored','delete_pending','deleted','failed')),
  security_status TEXT NOT NULL CHECK (security_status IN ('quarantine','approved','rejected')),
  created_at TEXT NOT NULL,
  stored_at TEXT,
  reviewed_at TEXT,
  reviewed_by TEXT,
  rejection_reason TEXT,
  deleted_at TEXT,
  error_code TEXT,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);
CREATE INDEX IF NOT EXISTS idx_lead_uploads_lead ON lead_uploads(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_uploads_cleanup ON lead_uploads(storage_status, created_at);

CREATE TABLE IF NOT EXISTS lead_requests (
  request_id TEXT PRIMARY KEY,
  lead_id INTEGER,
  state TEXT NOT NULL CHECK (state IN ('processing','succeeded','failed')),
  response_code INTEGER,
  response_body TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);
CREATE INDEX IF NOT EXISTS idx_lead_requests_completed ON lead_requests(completed_at);
CREATE INDEX IF NOT EXISTS idx_lead_requests_cleanup ON lead_requests(state, completed_at);

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
CREATE INDEX IF NOT EXISTS idx_upload_audit_time ON upload_audit_log(occurred_at, action);
