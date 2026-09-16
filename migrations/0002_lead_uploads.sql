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
