import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('upload migration defines required status columns', () => {
  const sql = fs.readFileSync('migrations/0002_lead_uploads.sql', 'utf8');
  assert.match(sql, /id TEXT PRIMARY KEY/);
  assert.match(sql, /storage_status/);
  assert.match(sql, /security_status/);
});

test('idempotency migration defines unique request state', () => {
  const sql = fs.readFileSync('migrations/0003_lead_requests.sql', 'utf8');
  assert.match(sql, /request_id TEXT PRIMARY KEY/);
  assert.match(sql, /processing/);
  assert.match(sql, /succeeded/);
  assert.match(sql, /failed/);
});
