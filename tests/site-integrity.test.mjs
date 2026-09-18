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

test('contact output offers one bounded technical drawing upload', () => {
  for (const file of ['modules/kontakt.html', 'kontakt/index.html']) {
    const html = read(file);
    assert.equal((html.match(/<input[^>]+type=["']file["']/gi) || []).length, 1, file);
    assert.match(html, /accept=["'][^"']*\.pdf[^"']*\.dxf[^"']*\.step[^"']*\.stp[^"']*\.jpe?g[^"']*\.png/i, file);
    assert.match(html, /multiple/i, file);
    assert.match(html, /5 Dateien|5 file|5 file/i, file);
    assert.match(html, /8 MiB|8 MB/i, file);
    assert.match(html, /16 MiB|16 MB/i, file);
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

test('contact page has one inquiry form with unique IDs and bounded upload copy', () => {
  const html = read('kontakt/index.html');
  assert.equal((html.match(/<form\b/gi) || []).length, 1);
  assert.equal((html.match(/type=["']submit["']/gi) || []).length, 1);
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/gi)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'contact page contains duplicate IDs');
  assert.doesNotMatch(html, /TODO:\s*Reale Kontaktzeiten/i);
  assert.match(html, /PDF.*DXF.*STEP.*STP.*JPG.*PNG/i);
  assert.doesNotMatch(html, /data-key=["']hnav_cta["'][^>]*>Zeichnung senden</i);
  assert.doesNotMatch(html, /class=["'][^"']*btn[^"']*["'][^>]*>Zeichnung senden</i);
  assert.match(html, /PDF.*DXF.*STEP.*STP.*JPG.*PNG/i);
  assert.match(html, /href=["']\/datenschutz\/["']/i);
  assert.match(html, /id=["']leadForm["']/i);
  assert.match(read('js/app.js'), /fetch\(["']\/api\/leads["']/i);
});

test('services page renders each primary service block once', () => {
  const html = read('leistungen/index.html');
  for (const id of ['cnc-drehen', 'drehfraesen', 'prototypen', 'kleinserien', 'mittlere-serien', 'ersatzteile']) {
    assert.equal((html.match(new RegExp(`id=["']${id}["']`, 'gi')) || []).length, 1, `${id} is duplicated`);
  }
  assert.equal((html.match(/class=["']service-final-cta["']/gi) || []).length, 1);
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

test('contact form remains semantically usable without JavaScript', () => {
  for (const file of ['modules/kontakt.html', 'kontakt/index.html']) {
    const html = read(file);
    assert.match(html, /<form[^>]+action=["']\/api\/leads["']/i, file);
    assert.match(html, /method=["']post["']/i, file);
    assert.match(html, /enctype=["']multipart\/form-data["']/i, file);
    for (const name of ['company', 'name', 'email', 'phone', 'service', 'message']) assert.match(html, new RegExp(`name=["']${name}["']`, 'i'), `${file}:${name}`);
    assert.match(html, /Turnstile/i, file);
  }
});
