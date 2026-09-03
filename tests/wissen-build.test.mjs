import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
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
import { get } from 'node:http';

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

test('production and localhost preview strictly separate published articles and drafts', async () => {
  const publishedSource = join(root, 'content', 'wissen', 'build-veroeffentlicht.md');
  const draftSource = join(root, 'content', 'wissen', 'build-entwurf.md');
  const heroSource = join(root, 'assets', 'images', 'wissen', 'build-testbild.png');
  let preview;

  for (const fixture of [publishedSource, draftSource, heroSource]) {
    assert.equal(existsSync(fixture), false, `Refusing to overwrite existing fixture path: ${fixture}`);
  }

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

    assert.equal(JSON.parse(read('package.json')).scripts['dev:preview'], 'node scripts/dev-preview.mjs');
    preview = spawn(process.execPath, ['scripts/dev-preview.mjs', '--port', '0'], {
      cwd: root,
      env: { ...process.env, npm_lifecycle_event: 'dev:preview' },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    let log = '';
    preview.stdout.on('data', (chunk) => { log += chunk; });
    preview.stderr.on('data', (chunk) => { log += chunk; });
    const address = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Preview timeout: ${log}`)), 60000);
      preview.once('error', reject);
      preview.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Preview exited ${code}: ${log}`)); });
      preview.once('message', (message) => { clearTimeout(timeout); resolve(message); });
    });
    assert.equal(address.host, '127.0.0.1');
    const url = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${url}/wissen/build-entwurf/`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
    const draft = await response.text();
    assert.match(draft, /ENTWURF – NICHT VERÖFFENTLICHT/);
    assert.match(draft, /<meta name="robots" content="noindex, nofollow">/);
    assert.match(draft, /Dieser Entwurf darf keine öffentliche Ausgabe erzeugen/);
    assert.doesNotMatch(draft, /rel="canonical"|datePublished|<script/);
    const listing = await (await fetch(`${url}/entwuerfe/`)).text();
    assert.match(listing, /href="\/wissen\/build-entwurf\/"/);
    assert.doesNotMatch(read('_preview/sitemap.xml'), /build-entwurf/);
    assert.equal(read('_preview/wissen/build-veroeffentlicht/index.html'), article);
    assert.equal(read('_site/wissen/build-veroeffentlicht/index.html'), article);
    assert.equal(existsSync(join(root, '_site/wissen/build-entwurf/index.html')), false);
    assert.equal(existsSync(join(root, '_site/entwuerfe/index.html')), false);
    assert.equal((await fetch(`${url}/.pages.yml`)).status, 404);
    const foreignHostStatus = await new Promise((resolve, reject) => {
      get(`${url}/entwuerfe/`, { headers: { Host: 'external.example' } }, (res) => {
        res.resume(); resolve(res.statusCode);
      }).on('error', reject);
    });
    assert.equal(foreignHostStatus, 403);
    assert.equal((await fetch(`${url}/api/leads`, { method: 'POST' })).status, 405);

    writeFileSync(draftSource, read('content/wissen/build-entwurf.md') + '\nVORSCHAU-SPEICHERTEST\n');
    let refreshed = '';
    for (let attempt = 0; attempt < 40; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      refreshed = await (await fetch(`${url}/wissen/build-entwurf/`)).text();
      if (refreshed.includes('VORSCHAU-SPEICHERTEST')) break;
    }
    assert.match(refreshed, /VORSCHAU-SPEICHERTEST/);

    // Even a inherited preview-looking environment must never enable drafts in build.
    execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm run build --silent'], {
      cwd: root,
      env: { ...process.env, KNOWLEDGE_PREVIEW: 'true', ELEVENTY_ENV: 'preview' },
      stdio: 'pipe',
    });
    assert.equal(existsSync(join(root, '_site/wissen/build-entwurf/index.html')), false);
    assert.equal(read('_site/wissen/build-veroeffentlicht/index.html'), article);
  } finally {
    if (preview && preview.exitCode === null) {
      const exited = new Promise((resolve) => preview.once('exit', resolve));
      if (preview.connected) preview.send('stop');
      else preview.kill();
      await exited;
    }
    rmSync(publishedSource, { force: true });
    rmSync(draftSource, { force: true });
    rmSync(heroSource, { force: true });
  }
});

test('preview refuses direct invocation and Cloudflare/CI environments', () => {
  for (const addition of [
    { npm_lifecycle_event: 'build' },
    { npm_lifecycle_event: 'dev:preview', CF_PAGES: '1' },
    { npm_lifecycle_event: 'dev:preview', CF_PAGES_BRANCH: 'main' },
    { npm_lifecycle_event: 'dev:preview', CI: 'true' },
  ]) {
    assert.throws(() => execFileSync(process.execPath, ['scripts/dev-preview.mjs'], {
      cwd: root, env: { ...process.env, ...addition }, stdio: 'pipe',
    }), (error) => {
      assert.match(error.stderr.toString(), /Local preview denied/);
      return true;
    });
  }
});
