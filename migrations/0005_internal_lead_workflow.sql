ALTER TABLE leads ADD COLUMN workflow_status TEXT NOT NULL DEFAULT 'new'
  CHECK (workflow_status IN ('new', 'in_progress', 'completed'));
ALTER TABLE leads ADD COLUMN workflow_version INTEGER NOT NULL DEFAULT 0
  CHECK (typeof(workflow_version) = 'integer' AND workflow_version BETWEEN 0 AND 9007199254740991);

UPDATE leads
SET workflow_status = CASE
  WHEN status IN ('new', 'in_progress', 'completed') THEN status
  ELSE 'new'
END;

ALTER TABLE lead_uploads ADD COLUMN review_request_id TEXT;

CREATE TABLE internal_review_control (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  protocol_version INTEGER NOT NULL DEFAULT 2 CHECK (protocol_version = 2),
  changed_at TEXT NOT NULL
);
INSERT INTO internal_review_control (id, enabled, protocol_version, changed_at)
VALUES (1, 0, 2, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

CREATE TABLE lead_status_requests (
  request_id TEXT PRIMARY KEY NOT NULL,
  actor_id TEXT NOT NULL,
  requested_lead_id INTEGER NOT NULL CHECK (typeof(requested_lead_id) = 'integer' AND requested_lead_id > 0 AND requested_lead_id <= 9007199254740991),
  lead_id INTEGER,
  expected_status TEXT NOT NULL CHECK (expected_status IN ('new', 'in_progress', 'completed')),
  expected_version INTEGER NOT NULL CHECK (typeof(expected_version) = 'integer' AND expected_version BETWEEN 0 AND 9007199254740990),
  target_status TEXT NOT NULL CHECK (target_status IN ('new', 'in_progress', 'completed') AND (
    (expected_status = 'new' AND target_status IN ('in_progress', 'completed')) OR
    (expected_status = 'in_progress' AND target_status = 'completed') OR
    (expected_status = 'completed' AND target_status = 'in_progress')
  )),
  observed_status TEXT,
  observed_version INTEGER,
  response_code INTEGER NOT NULL CHECK (response_code IN (200, 404, 409)),
  detail_code TEXT NOT NULL CHECK (detail_code IN ('status_changed', 'lead_not_found', 'status_conflict')),
  result_version INTEGER,
  occurred_at TEXT NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
  CHECK ((observed_status IS NULL) = (observed_version IS NULL)),
  CHECK (response_code = 200 AND detail_code = 'status_changed' AND observed_status = expected_status AND observed_version = expected_version AND result_version = expected_version + 1
    OR response_code = 404 AND detail_code = 'lead_not_found' AND observed_status IS NULL AND observed_version IS NULL AND result_version IS NULL
    OR response_code = 409 AND detail_code = 'status_conflict' AND observed_status IS NOT NULL AND observed_version IS NOT NULL AND result_version IS NULL),
  CHECK (lead_id IS NULL OR lead_id = requested_lead_id)
);

CREATE TABLE lead_status_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT,
  lead_id INTEGER,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('employee', 'unknown')),
  actor_id TEXT,
  action TEXT NOT NULL CHECK (action = 'lead_status_change'),
  result TEXT NOT NULL CHECK (result IN ('success', 'denied')),
  detail_code TEXT NOT NULL CHECK (detail_code IN ('status_changed', 'lead_not_found', 'status_conflict', 'idempotency_conflict', 'invalid_request', 'invalid_transition', 'access_denied', 'origin_denied')),
  expected_status TEXT,
  expected_version INTEGER,
  from_status TEXT,
  from_version INTEGER,
  to_status TEXT,
  to_version INTEGER,
  occurred_at TEXT NOT NULL,
  FOREIGN KEY (request_id) REFERENCES lead_status_requests(request_id),
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
  CHECK (actor_type = 'employee' OR actor_id IS NULL),
  CHECK ((expected_status IS NULL) = (expected_version IS NULL)),
  CHECK ((from_status IS NULL) = (from_version IS NULL)),
  CHECK ((to_status IS NULL) = (to_version IS NULL)),
  CHECK (result = 'success' AND detail_code = 'status_changed' AND from_status IS NOT NULL AND to_status IS NOT NULL AND to_version = from_version + 1
    OR result = 'denied')
);

CREATE INDEX idx_leads_workflow_created ON leads(workflow_status, created_at, id);
CREATE INDEX idx_leads_created ON leads(created_at, id);
CREATE INDEX idx_lead_status_audit_lead_time ON lead_status_audit(lead_id, occurred_at);
CREATE INDEX idx_lead_status_audit_request ON lead_status_audit(request_id);
CREATE INDEX idx_lead_status_audit_time ON lead_status_audit(occurred_at);
CREATE INDEX idx_lead_status_requests_lead ON lead_status_requests(requested_lead_id, occurred_at);

CREATE TRIGGER upload_review_migration_block
BEFORE UPDATE OF security_status ON lead_uploads
WHEN NEW.security_status IS NOT OLD.security_status
BEGIN
  SELECT RAISE(ABORT, 'review_unavailable');
END;

CREATE TRIGGER lead_status_request_apply
AFTER INSERT ON lead_status_requests
BEGIN
  UPDATE leads
  SET workflow_status = NEW.target_status,
      workflow_version = workflow_version + 1
  WHERE NEW.response_code = 200
    AND id = NEW.lead_id
    AND workflow_status = NEW.expected_status
    AND workflow_version = NEW.expected_version;

  SELECT (CASE
    WHEN NEW.response_code = 200 AND changes() <> 1
    THEN RAISE(ABORT, 'status_write_conflict')
  END);

  INSERT INTO lead_status_audit (
    request_id, lead_id, actor_type, actor_id, action, result, detail_code,
    expected_status, expected_version, from_status, from_version,
    to_status, to_version, occurred_at
  )
  SELECT NEW.request_id, NEW.lead_id, 'employee', NEW.actor_id, 'lead_status_change',
    'success', 'status_changed', NEW.expected_status, NEW.expected_version,
    NEW.observed_status, NEW.observed_version, NEW.target_status, NEW.result_version,
    NEW.occurred_at
  WHERE NEW.response_code = 200;

  INSERT INTO lead_status_audit (
    request_id, lead_id, actor_type, actor_id, action, result, detail_code,
    expected_status, expected_version, from_status, from_version,
    to_status, to_version, occurred_at
  )
  SELECT NEW.request_id, NEW.lead_id, 'employee', NEW.actor_id, 'lead_status_change',
    'denied', NEW.detail_code, NEW.expected_status, NEW.expected_version,
    NEW.observed_status, NEW.observed_version, NULL, NULL,
    NEW.occurred_at
  WHERE NEW.response_code <> 200;
END;
