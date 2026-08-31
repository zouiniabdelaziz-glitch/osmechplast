import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { renderKnowledgeImage } from '../scripts/wissen-image.mjs';

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

test('knowledge image pipeline creates responsive markup with stable dimensions', async (context) => {
  const root = mkdtempSync(join(tmpdir(), 'osmp-wissen-image-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const media = join(root, 'assets', 'images', 'wissen');
  mkdirSync(media, { recursive: true });
  writeFileSync(join(media, 'testbild.png'), onePixelPng);

  const hero = await renderKnowledgeImage(
    '/assets/images/wissen/testbild.png',
    'Technisches Testbild',
    'hero',
    { root, outputDir: join(root, '_site', 'assets', 'images', 'wissen', 'generated') },
  );
  assert.match(hero, /<picture>/);
  assert.match(hero, /type="image\/webp"/);
  assert.match(hero, /width="1"/);
  assert.match(hero, /height="1"/);
  assert.match(hero, /loading="eager"/);
  assert.match(hero, /fetchpriority="high"/);
  assert.match(hero, /alt="Technisches Testbild"/);

  const content = await renderKnowledgeImage(
    '/assets/images/wissen/testbild.png',
    'Detailansicht',
    'content',
    { root, outputDir: join(root, '_site', 'assets', 'images', 'wissen', 'generated') },
  );
  assert.match(content, /loading="lazy"/);
  assert.doesNotMatch(content, /fetchpriority=/);
});

test('knowledge image pipeline rejects files outside the approved media directory', async () => {
  await assert.rejects(
    () => renderKnowledgeImage('/assets/images/logo.png', 'Logo', 'content'),
    /assets\/images\/wissen/,
  );
});
