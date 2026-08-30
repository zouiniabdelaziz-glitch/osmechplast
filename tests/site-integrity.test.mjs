import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const canonicalPages = [
  'index.html',
  'leistungen/index.html',
  'werkstoffe/index.html',
  'qualitaet/index.html',
  'technologie/index.html',
  'unternehmen/index.html',
  'kontakt/index.html',
  'impressum/index.html'
];

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

test('contact output offers no drawing upload while the removal decision is active', () => {
  for (const file of ['modules/kontakt.html', 'kontakt/index.html']) {
    const html = read(file);
    assert.doesNotMatch(html, /<input[^>]+type=["']file["']/i, file);
    assert.doesNotMatch(html, /class=["'][^"']*upload-zone/i, file);
    assert.doesNotMatch(html, /Datei hierher|Drag file|Trascinate il file|Glissez le fichier/i, file);
  }
});

test('every canonical footer links to the privacy page without a visible placeholder', () => {
  for (const file of ['modules/footer.html', ...canonicalPages]) {
    const html = read(file);
    assert.match(html, /href=["']\/datenschutz\/["']/i, file);
    assert.doesNotMatch(html, /Datenschutz folgt/i, file);
  }
});

test('contact form links to the privacy page without a TODO privacy notice', () => {
  for (const file of ['modules/kontakt.html', 'kontakt/index.html']) {
    const html = read(file);
    assert.match(html, /form-privacy-note[\s\S]*href=["']\/datenschutz\/["']/i, file);
    assert.doesNotMatch(html, /TODO\s*[–-]\s*Datenschutzhinweis/i, file);
  }
});

test('privacy draft names every verified technical data flow and its review state', () => {
  const html = read('datenschutz/index.html');
  for (const expected of [
    'Entwurf', 'juristische Prüfung', 'Kontaktformular', 'Cloudflare', 'D1',
    'Google Analytics', 'Microsoft Clarity', 'Google Fonts', 'Local Storage',
    'Betroffenenrechte'
  ]) {
    assert.match(html, new RegExp(expected, 'i'), expected);
  }
});

test('service options use stable language-independent values', () => {
  const values = ['', 'cnc-drehen', 'drehfraesen', 'prototypen-serien', 'unsicher'];
  for (const file of ['modules/kontakt.html', 'kontakt/index.html']) {
    const html = read(file);
    for (const value of values) {
      assert.match(html, new RegExp(`<option value=["']${value}["']`, 'i'), `${file}: ${value}`);
    }
  }
});
