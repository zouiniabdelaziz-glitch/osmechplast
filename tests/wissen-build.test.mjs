import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');

test('Pages CMS exposes the approved knowledge collection and media directory', () => {
  const config = read('.pages.yml');
  assert.match(config, /name:\s*wissen/);
  assert.match(config, /path:\s*content\/wissen/);
  assert.match(config, /input:\s*assets\/images\/wissen/);
  assert.match(config, /output:\s*\/assets\/images\/wissen/);
  assert.match(config, /name:\s*body[\s\S]*type:\s*rich-text/);
  assert.match(config, /name:\s*draft[\s\S]*default:\s*true/);
  assert.match(config, /name:\s*related_articles[\s\S]*collection:\s*wissen/);

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

  for (const page of [
    'index.html',
    'leistungen/index.html',
    'werkstoffe/index.html',
    'qualitaet/index.html',
    'technologie/index.html',
    'unternehmen/index.html',
    'kontakt/index.html',
    'impressum/index.html',
  ]) {
    const html = read(page);
    assert.equal((html.match(/href="\/wissen\/"/g) || []).length, 3, `${page} needs two navigation links and one footer link`);
  }

  const privacyHtml = read('datenschutz/index.html');
  assert.equal((privacyHtml.match(/href="\/wissen\/"/g) || []).length, 2, 'Datenschutz has a compact static fallback and footer link');
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
