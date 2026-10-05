import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('build configuration publishes only the productive internal UI', () => {
  const config = readFileSync('eleventy.config.mjs', 'utf8');
  assert.match(config, /\n\s*'internal',/u);
  const routes = JSON.parse(readFileSync('_routes.json', 'utf8')).include;
  for (const route of ['/api/leads', '/internal/*']) {
    assert.equal(routes.includes(route), true, route);
  }
});

test('built internal UI contains no prototype assets', () => {
  assert.equal(existsSync('_site/internal/index.html'), true);
  assert.equal(existsSync('_site/internal/internal.js'), true);
  assert.equal(existsSync('_site/internal/design.js'), false);
  assert.equal(existsSync('_site/internal/screenshots.html'), false);
});
