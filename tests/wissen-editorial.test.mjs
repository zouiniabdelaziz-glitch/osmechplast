import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { installEditorial, tocFromHtml, serviceLabel, validateImageLayout, imageLayout, imageSize } from '../scripts/wissen-editorial.mjs';
const require = createRequire(import.meta.url);
const MarkdownIt = require(require.resolve('markdown-it', { paths: [require.resolve('@11ty/eleventy')] }));

test('actual article keeps all ten subject chapters but excludes only its contact heading from the TOC', () => {
  const source = readFileSync('content/wissen/cnc-angebot-richtig-anfragen.md', 'utf8');
  const body = source.split(/^---\s*$/m).slice(2).join('---');
  const md = new MarkdownIt({html:false}); installEditorial(md);
  const html = md.render(body);
  const toc = tocFromHtml(html);
  assert.equal(toc.length, 10);
  assert.deepEqual(toc.map(x => x.id), Array.from({length:10}, (_,i) => `abschnitt-${i+1}`));
  assert.equal(toc[0].label, '1. Die technische Zeichnung beschreibt die Anforderungen');
  assert.equal(toc[9].label, 'Was passiert bei einer Machbarkeitsprüfung?');
  assert.match(html, /<h2 id="abschnitt-11">CNC-Drehteile bei ONCC anfragen<\/h2>/);
  assert.doesNotMatch(toc.map(x=>x.label).join('\n'), /CNC-Drehteile bei ONCC anfragen/);
});

test('repeated headings have distinct targets and preserve the rendered wording', () => {
  const md = new MarkdownIt({ html: false });
  installEditorial(md);
  const html = md.render('## Prüfung\n\nText bleibt.\n\n## Prüfung\n\n## Prüfung 2');
  assert.match(html, /<h2 id="abschnitt-1">Prüfung<\/h2>/);
  assert.match(html, /<h2 id="abschnitt-2">Prüfung<\/h2>/);
  assert.match(html, /<p>Text bleibt\.<\/p>/);
  assert.deepEqual(tocFromHtml(html).map(x => [x.id, x.label]), [['abschnitt-1','Prüfung'],['abschnitt-2','Prüfung'],['abschnitt-3','Prüfung 2']]);
  assert.match(md.render('## Neuer Artikel'), /id="abschnitt-1"/);
});
test('table keeps cells and receives a keyboard-accessible scroll region', () => {
  const md = new MarkdownIt({ html: false }); installEditorial(md);
  const html = md.render('| Angabe | Zweck |\n| --- | --- |\n| Zeichnung | Prüfung |');
  assert.match(html, /class="knowledge-table-scroll" role="region" aria-label="Tabelle 1" tabindex="0"/);
  assert.match(html, /<td>Zeichnung<\/td>/);
  assert.match(html, /<\/table>\n<\/div>/);
  assert.doesNotMatch(md.render('<script>alert(1)</script>'), /<script>/);
});
test('service links describe their destination without arbitrary HTML', () => {
  assert.equal(serviceLabel('/leistungen/'), 'CNC-Drehen und Dreh-Fräsen');
  assert.equal(serviceLabel('/qualitaet/'), 'Messmittel und Qualitätsdokumentation');
});
test('CMS image options preserve legacy defaults and reject arbitrary presentation inputs', () => {
  assert.doesNotThrow(() => validateImageLayout({}));
  assert.doesNotThrow(() => validateImageLayout({layout:'left',size:'medium',text:'Begleittext'}));
  assert.throws(() => validateImageLayout({layout:'custom-css'}), /layout/);
  assert.throws(() => validateImageLayout({size:'999px'}), /size/);
  assert.equal(imageLayout('" onclick="alert(1)'), 'full');
  assert.equal(imageSize(undefined), 'large');
});
test('additional image text cannot reuse body heading IDs', () => {
  const md = new MarkdownIt({html:false}); installEditorial(md);
  assert.match(md.render('## Bildtext', {editorialPrefix:'bild-2'}), /id="bild-2-1"/);
});
