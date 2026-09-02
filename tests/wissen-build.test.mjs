import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');
const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

test('Pages CMS exposes the approved knowledge collection and media directory', () => {
  const config = read('.pages.yml');
  assert.match(config, /name:\s*wissen/);
  assert.match(config, /path:\s*content\/wissen/);
  assert.match(config, /input:\s*assets\/images\/wissen/);
  assert.match(config, /output:\s*\/assets\/images\/wissen/);
  assert.match(config, /name:\s*body[\s\S]*type:\s*rich-text/);
  assert.match(config, /name:\s*draft[\s\S]*default:\s*true/);
  assert.match(config, /name:\s*related_articles[\s\S]*collection:\s*wissen/);
  assert.match(config, /filename:\s*["']\{fields\.slug\}\.md["']/);
  assert.match(config, /name:\s*slug[\s\S]*pattern:[\s\S]*\^\[a-z0-9\]/);
  assert.match(config, /view:[\s\S]*sort:\s*\[published_at[\s\S]*default:[\s\S]*sort:\s*published_at[\s\S]*order:\s*desc/);
  assert.match(config, /name:\s*published_at[\s\S]*format:\s*yyyy-MM-dd/);
  assert.match(config, /name:\s*updated_at[\s\S]*default:\s*["']["'][\s\S]*format:\s*yyyy-MM-dd/);

  for (const cluster of [
    'Fertigungsgerechte Konstruktion',
    'Werkstoffe für CNC-Drehteile',
    'CNC-Drehen und Dreh-Fräsen',
    'Toleranzen, Oberflächen und Qualität',
    'Prototypen, Serien und Fertigungsplanung',
    'CNC-Anfragen, Einkauf und Kosten',
  ]) {
    assert.ok(config.includes(cluster), `missing CMS cluster: ${cluster}`);
  }
});

test('knowledge content starts without a published or draft article', () => {
  const articleDirectory = join(root, 'content', 'wissen');
  assert.equal(existsSync(articleDirectory), true);
  const markdownFiles = readdirSync(articleDirectory).filter((name) => name.endsWith('.md'));
  assert.deepEqual(markdownFiles, []);
});

test('canonical navigation and footer expose Wissen without changing legacy pages', () => {
  const header = read('modules/header.html');
  const footer = read('modules/footer.html');
  assert.equal((header.match(/href="\/wissen\/"/g) || []).length, 2);
  assert.equal((footer.match(/href="\/wissen\/"/g) || []).length, 1);
  assert.equal((read('js/translations.js').match(/hnav_knowledge:/g) || []).length, 4);
});

test('production build creates the empty knowledge overview and preserves the static site', () => {
  execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm run build --silent'], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
  });

  const overview = read('_site/wissen/index.html');
  assert.match(overview, /<html lang="de">/);
  assert.match(overview, /<h1[^>]*>Wissen für CNC-Anfragen und Fertigung<\/h1>/);
  assert.match(overview, /Noch keine Fachartikel veröffentlicht/);
  assert.doesNotMatch(overview, /class="knowledge-card"/);
  assert.equal((overview.match(/href="\/wissen\/"/g) || []).length >= 3, true);
  for (const match of overview.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    assert.doesNotThrow(() => JSON.parse(match[1]));
  }

  for (const path of [
    '_site/index.html',
    '_site/leistungen/index.html',
    '_site/kontakt/index.html',
    '_site/css/main.css',
    '_site/js/app.js',
    '_site/modules/header.html',
    '_site/_headers',
    '_site/_redirects',
    '_site/robots.txt',
  ]) {
    assert.equal(existsSync(join(root, path)), true, `missing build output: ${path}`);
  }

  assert.equal(read('_site/css/main.css'), read('css/main.css'));
  assert.equal(read('_site/js/app.js'), read('js/app.js'));

  const sitemap = read('_site/sitemap.xml');
  assert.equal((sitemap.match(/https:\/\/osmechplast\.com\/wissen\//g) || []).length, 1);
  assert.match(sitemap, /<loc>https:\/\/osmechplast\.com\/wissen\/<\/loc>/);
  assert.doesNotMatch(sitemap, /https:\/\/osmechplast\.com\/wissen\/[^<]+\/<\/loc>/);
  assert.equal(existsSync(join(root, '_site', 'functions')), false, 'Cloudflare Functions remain at the project root');

  const outputFiles = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = join(directory, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else outputFiles.push(fullPath);
    }
  };
  walk(join(root, '_site'));
  assert.equal(outputFiles.some((path) => path.endsWith('.md')), false);
});

test('production build tolerates a missing root sitemap.xml file', () => {
  const rootSitemap = join(root, 'sitemap.xml');
  const backupSitemap = join(root, 'sitemap.xml.bak');
  const hadRootSitemap = existsSync(rootSitemap);

  if (hadRootSitemap) renameSync(rootSitemap, backupSitemap);

  try {
    execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm run build --silent'], {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
    });

    const sitemap = read('_site/sitemap.xml');
    assert.match(sitemap, /<loc>https:\/\/osmechplast\.com\/wissen\/<\/loc>/);
    assert.doesNotMatch(sitemap, /https:\/\/osmechplast\.com\/wissen\/[^<]+\/<\/loc>/);
  } finally {
    if (hadRootSitemap) {
      renameSync(backupSitemap, rootSitemap);
    } else {
      rmSync(rootSitemap, { force: true });
    }
  }
});

test('production build publishes only explicit non-drafts with complete article metadata', () => {
  const publishedSource = join(root, 'content', 'wissen', 'build-veroeffentlicht.md');
  const draftSource = join(root, 'content', 'wissen', 'build-entwurf.md');
  const heroSource = join(root, 'assets', 'images', 'wissen', 'build-testbild.png');

  writeFileSync(heroSource, onePixelPng);
  writeFileSync(publishedSource, `---
title: Veröffentlichtes Build-Testwissen
slug: build-veroeffentlicht
meta_description: Veröffentlichtes Testwissen prüft statische Ausgabe, Metadaten, Sitemap und strukturierte Artikeldaten im produktiven Eleventy-Build.
summary: Ein technischer Build-Test für die vollständige Veröffentlichungslogik.
cluster: CNC-Anfragen, Einkauf und Kosten
author: OS.MECHPLAST Redaktion
published_at: 2026-08-31
updated_at: 2026-09-01
hero_image: /assets/images/wissen/build-testbild.png
hero_alt: Technisches Testbild für den Wissensbereich
hero_approval: freigegeben
content_images: []
sources:
  - label: Technische Testquelle
    url: https://example.com/quelle
related_articles: []
service_link: /leistungen/
cta_label: Leistungen ansehen
cta_url: /leistungen/
draft: false
---

## Technischer Inhalt

Dieser Inhalt wird ausschließlich während des automatisierten Build-Tests erzeugt.
`);
  writeFileSync(draftSource, `---
title: Nicht öffentliches Build-Testwissen
slug: build-entwurf
draft: true
---

Dieser Entwurf darf keine öffentliche Ausgabe erzeugen.
`);

  try {
    execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm run build --silent'], {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
    });

    const article = read('_site/wissen/build-veroeffentlicht/index.html');
    assert.match(article, /<link rel="canonical" href="https:\/\/osmechplast\.com\/wissen\/build-veroeffentlicht\/">/);
    assert.match(article, /<meta property="og:type" content="article">/);
    assert.match(article, /<meta property="og:image" content="https:\/\/osmechplast\.com\/assets\/images\/wissen\/build-testbild\.png">/);
    assert.match(article, /<nav class="crumbs" aria-label="Breadcrumb">/);
    assert.match(article, /"@type":"Article"|"@type": "Article"/);
    for (const match of article.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      assert.doesNotThrow(() => JSON.parse(match[1]));
    }

    const overview = read('_site/wissen/index.html');
    assert.match(overview, /Veröffentlichtes Build-Testwissen/);
    assert.doesNotMatch(overview, /Nicht öffentliches Build-Testwissen/);

    const sitemap = read('_site/sitemap.xml');
    assert.match(sitemap, /https:\/\/osmechplast\.com\/wissen\/build-veroeffentlicht\//);
    assert.doesNotMatch(sitemap, /build-entwurf/);
    assert.equal(existsSync(join(root, '_site', 'wissen', 'build-entwurf', 'index.html')), false);
  } finally {
    rmSync(publishedSource, { force: true });
    rmSync(draftSource, { force: true });
    rmSync(heroSource, { force: true });
  }
});
