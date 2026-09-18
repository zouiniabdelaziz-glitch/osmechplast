import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

test('cleanup config separates preview and production bindings and has daily cron', () => {
  assert.equal(existsSync('wrangler.cleanup.jsonc'), true);
  const text = readFileSync('wrangler.cleanup.jsonc', 'utf8');
  const preview = text.match(/"preview"\s*:\s*\{([\s\S]*?)\n\s*\}/)?.[1] || '';
  const production = text.match(/"production"\s*:\s*\{([\s\S]*?)\n\s*\}/)?.[1] || '';
  assert.match(preview, /"binding"\s*:\s*"DB"/);
  assert.match(preview, /"binding"\s*:\s*"RFQ_UPLOADS"/);
  assert.match(production, /"binding"\s*:\s*"DB"/);
  assert.match(production, /"binding"\s*:\s*"RFQ_UPLOADS"/);
  assert.doesNotMatch(text, /UPLOAD_RETENTION_CONFIRMED\s*"?\s*:\s*"?1/);
  assert.match(text, /0 3 \* \* \*/);
});
