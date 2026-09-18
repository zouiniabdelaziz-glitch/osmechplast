import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('privacy notice describes private quarantined uploads without claiming malware scanning', () => {
  const text = readFileSync('docs/PRIVACY_DATA_FLOW.md', 'utf8') + readFileSync('datenschutz/index.html', 'utf8');
  assert.match(text, /quarant/i);
  assert.match(text, /privat|private/i);
  assert.doesNotMatch(text, /malwarefrei|virenfrei|malware-free/i);
});
