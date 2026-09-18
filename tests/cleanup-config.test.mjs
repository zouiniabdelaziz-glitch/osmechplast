import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

test('cleanup config separates preview and production bindings and has daily cron', () => {
  assert.equal(existsSync('wrangler.cleanup.jsonc'), true);
  const text = readFileSync('wrangler.cleanup.jsonc', 'utf8');
  assert.match(text, /DB_PREVIEW/); assert.match(text, /RFQ_UPLOADS_PREVIEW/);
  assert.match(text, /"binding"\s*:\s*"DB"/); assert.match(text, /"binding"\s*:\s*"RFQ_UPLOADS"/);
  assert.match(text, /0 3 \* \* \*/);
});
