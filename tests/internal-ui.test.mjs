import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('productive internal UI has the accepted structure and safe DOM policy', () => {
  const html = readFileSync('internal/index.html', 'utf8');
  const script = readFileSync('internal/internal.js', 'utf8');
  assert.match(html, /id="internal-app"/u);
  assert.match(html, /internal\.css/u);
  assert.match(html, /internal\.js/u);
  assert.match(script, /export function createInternalApp/u);
  assert.match(script, /\$\{detail\.uploads\.length\} \$\{detail\.uploads\.length === 1 \? 'Datei' : 'Dateien'\}/u);
  assert.doesNotMatch(script, /innerHTML/u);
  assert.doesNotMatch(script, /localStorage|sessionStorage|indexedDB|analytics/u);
});
