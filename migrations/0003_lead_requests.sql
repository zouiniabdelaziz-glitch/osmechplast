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
