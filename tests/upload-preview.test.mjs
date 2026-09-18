import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('local preview remains isolated and draft-only', () => {
  const source = readFileSync('scripts/dev-preview.mjs', 'utf8');
  assert.match(source, /127\.0\.0\.1/);
  assert.match(source, /'_preview'/);
  assert.match(source, /GET.*HEAD/);
  assert.match(source, /noindex, nofollow/);
  assert.doesNotMatch(source, /process\.env\.(DB|R2|TURNSTILE|ACCESS)/);
});
