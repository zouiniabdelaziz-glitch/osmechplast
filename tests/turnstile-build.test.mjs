import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { injectTurnstileSiteKey, injectTurnstileSiteKeyIntoFiles } from '../scripts/turnstile-sitekey.mjs';

const widgetHtml = '<div id="turnstile-widget" data-turnstile-sitekey=""></div>';

test('build output injects a valid public Turnstile site key into contact artifacts', () => {
  const output = injectTurnstileSiteKey(widgetHtml, '1x00000000000000000000AA');
  assert.match(output, /data-turnstile-sitekey="1x00000000000000000000AA"/);
});

test('build output stays fail-closed without a site key', () => {
  assert.equal(injectTurnstileSiteKey(widgetHtml, ''), widgetHtml);
});

test('invalid site keys are not inserted into HTML', () => {
  assert.equal(injectTurnstileSiteKey(widgetHtml, '"><script>alert(1)</script>'), widgetHtml);
});

test('built contact artifacts receive the same public key without exposing the secret', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'osmp-turnstile-'));
  fs.mkdirSync(path.join(root, 'kontakt'), { recursive: true });
  fs.mkdirSync(path.join(root, 'modules'), { recursive: true });
  for (const file of ['kontakt/index.html', 'modules/kontakt.html']) fs.writeFileSync(path.join(root, file), widgetHtml);
  injectTurnstileSiteKeyIntoFiles(root, fs.readFileSync, fs.writeFileSync, fs.existsSync, '1x00000000000000000000AA');
  const outputs = ['kontakt/index.html', 'modules/kontakt.html'].map((file) => fs.readFileSync(path.join(root, file), 'utf8'));
  for (const output of outputs) {
    assert.equal((output.match(/id="turnstile-widget"/g) || []).length, 1);
    assert.match(output, /data-turnstile-sitekey="1x00000000000000000000AA"/);
    assert.doesNotMatch(output, /TURNSTILE_SECRET_KEY/);
  }
  assert.equal(outputs[0], outputs[1]);
  fs.rmSync(root, { recursive: true, force: true });
});
