UPDATE internal_review_control
SET enabled = 0, changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 1;

CREATE TRIGGER upload_review_guard
BEFORE UPDATE OF security_status ON lead_uploads
WHEN NEW.security_status IS NOT OLD.security_status
BEGIN
  SELECT (CASE WHEN COALESCE((SELECT enabled FROM internal_review_control WHERE id = 1), 0) <> 1
    THEN RAISE(ABORT, 'review_unavailable') END);
  SELECT (CASE WHEN COALESCE((SELECT protocol_version FROM internal_review_control WHERE id = 1), 0) <> 2
    THEN RAISE(ABORT, 'review_unavailable') END);
  SELECT (CASE WHEN OLD.storage_status <> 'stored' OR NEW.storage_status <> 'stored'
    THEN RAISE(ABORT, 'invalid_state') END);
  SELECT (CASE WHEN OLD.security_status <> 'quarantine'
    THEN RAISE(ABORT, 'invalid_state') END);
  SELECT (CASE WHEN NEW.security_status NOT IN ('approved', 'rejected')
    THEN RAISE(ABORT, 'invalid_state') END);
  SELECT (CASE WHEN NEW.reviewed_by IS NULL OR trim(NEW.reviewed_by) = '' OR NEW.reviewed_at IS NULL OR trim(NEW.reviewed_at) = ''
    THEN RAISE(ABORT, 'invalid_state') END);
  SELECT (CASE WHEN NEW.review_request_id IS NULL OR NEW.review_request_id = OLD.review_request_id
    THEN RAISE(ABORT, 'review_unavailable') END);
  SELECT (CASE WHEN NEW.security_status = 'rejected' AND (NEW.rejection_reason IS NULL OR trim(NEW.rejection_reason) = '' OR length(NEW.rejection_reason) > 200)
    THEN RAISE(ABORT, 'invalid_rejection_reason') END);
  SELECT (CASE WHEN NEW.security_status = 'approved' AND NEW.rejection_reason IS NOT NULL
    THEN RAISE(ABORT, 'invalid_state') END);
END;

CREATE TRIGGER upload_review_success_audit
AFTER UPDATE OF security_status ON lead_uploads
WHEN NEW.security_status IS NOT OLD.security_status
BEGIN
  INSERT INTO upload_audit_log (
    upload_id, lead_id, actor_type, actor_id, occurred_at, action, result, detail_code
  ) VALUES (
    NEW.id, NEW.lead_id, 'employee', NEW.reviewed_by, NEW.reviewed_at,
    CASE WHEN NEW.security_status = 'approved' THEN 'file_approved' ELSE 'file_rejected' END,
    'success', NEW.security_status
  );
END;

DROP TRIGGER upload_review_migration_block;
