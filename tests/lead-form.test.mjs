import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement, loadBrowserScript } from './helpers/load-browser-script.mjs';
import fs from 'node:fs';

function response(status, body = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; },
    async text() { return JSON.stringify(body); }
  };
}

test('contact form exposes one accessible technical-file input with the approved limits', () => {
  const html = fs.readFileSync('modules/kontakt.html', 'utf8');
  assert.equal((html.match(/<input[^>]+type=["']file["']/gi) || []).length, 1);
  assert.match(html, /accept=["'][^"']*\.pdf[^"']*\.dxf[^"']*\.step[^"']*\.stp[^"']*\.jpe?g[^"']*\.png/i);
  assert.match(html, /multiple/i);
  assert.match(html, /5 Dateien|five files|cinque file/i);
  assert.match(html, /8 MiB|8 MB/i);
  assert.match(html, /16 MiB|16 MB/i);
});

test('Turnstile widget is explicitly initialized and clears expired tokens', () => {
  const source = fs.readFileSync('js/app.js', 'utf8');
  assert.match(source, /turnstile\.render/);
  assert.match(source, /expired-callback/);
  assert.match(source, /turnstile\.reset/);
  assert.match(source, /OSMP_TURNSTILE_SITE_KEY/);
});

test('initializes Turnstile at runtime, handles callbacks and fails closed without a site key', () => {
  const widget = createElement('div');
  widget.dataset.turnstileSitekey = 'site-key-test';
  const tokenInput = createElement('input');
  const elements = { 'turnstile-widget': widget, turnstile_token: tokenInput };
  let config;
  const context = loadBrowserScript('js/app.js', {
    elements,
    window: { turnstile: { render(_widget, options) { config = options; return 'widget-1'; } } }
  });
  context.initTurnstile();
  assert.equal(config.sitekey, 'site-key-test');
  config.callback('token-1');
  assert.equal(tokenInput.value, 'token-1');
  config['expired-callback']();
  assert.equal(tokenInput.value, '');
  config.callback('token-2');
  config['error-callback']();
  assert.equal(tokenInput.value, '');

  const noKeyWidget = createElement('div');
  const noKeyToken = createElement('input');
  const noKeyContext = loadBrowserScript('js/app.js', {
    elements: { 'turnstile-widget': noKeyWidget, turnstile_token: noKeyToken },
    fetch: async () => { throw new Error('fetch must not run'); },
    window: { turnstile: { render() { throw new Error('render must not run'); } } }
  });
  noKeyContext.initTurnstile();
  assert.equal(noKeyWidget.getAttribute('aria-disabled'), 'true');
});

test('German, Italian and English upload copy includes the same formats and limits', () => {
  const source = fs.readFileSync('js/translations.js', 'utf8');
  assert.equal((source.match(/upload_help:/g) || []).length >= 3, true);
  assert.equal((source.match(/turnstile_help:/g) || []).length >= 3, true);
  for (const term of ['PDF', 'DXF', 'STEP', 'STP', 'JPG', 'PNG', '8 MiB', '16 MiB']) assert.ok(source.includes(term), term);
});

test('creates a UUID request id and chooses JSON or multipart based on selected files', async () => {
  const calls = [];
  const fixture = makeFixture(async (url, options) => { calls.push({ url, options }); return response(200, { ok: true }); });
  assert.match(fixture.context.createRequestId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  await fixture.context.submitLead(fixture.form);
  assert.equal(calls[0].options.headers['Content-Type'], 'application/json');
  const file = new File([new Uint8Array([1])], 'part.pdf', { type: 'application/pdf' });
  fixture.context.document.getElementById('f_files').files = [file];
  await fixture.context.submitLead(fixture.form);
  assert.equal(calls[1].options.body instanceof FormData, true);
  assert.equal(calls[1].options.headers['X-Request-ID'].length, 36);
});

test('includes the current Turnstile token in JSON and multipart submissions', async () => {
  const calls = [];
  const fixture = makeFixture(async (url, options) => { calls.push(options); return response(200, { ok: true }); });
  fixture.context.window.turnstile = { getResponse() { return 'turnstile-test-token'; } };
  await fixture.context.submitLead(fixture.form);
  assert.equal(JSON.parse(calls[0].options?.body || calls[0].body).turnstile_token, 'turnstile-test-token');
  fixture.context.document.getElementById('f_files').files = [new File([new Uint8Array([1])], 'part.pdf')];
  await fixture.context.submitLead(fixture.form);
  assert.equal(calls[1].body.get('turnstile_token'), 'turnstile-test-token');
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function makeFixture(fetchImpl) {
  const submitButton = createElement('button');
  submitButton.textContent = 'Anfrage senden';
  const form = createElement('form');
  form.resetCount = 0;
  form.reset = () => { form.resetCount += 1; };
  form.querySelector = selector => selector === '[type="submit"]' ? submitButton : null;

  const successBanner = createElement('div');
  successBanner.hidden = true;
  const errorBanner = createElement('div');
  errorBanner.hidden = true;
  const values = {
    f_company: 'Muster GmbH',
    f_name: 'Erika Muster',
    f_email: 'einkauf@example.com',
    f_phone: '+49 123 456',
    f_service: 'cnc-drehen',
    f_msg: 'Bitte Machbarkeit prüfen.'
  };
  const elements = { leadForm: form, successBanner, errorBanner };
  for (const [id, value] of Object.entries(values)) elements[id] = { value };
  elements.f_files = { files: [] };
  elements.turnstile_token = { value: '' };

  const tracked = [];
  const context = loadBrowserScript('js/app.js', {
    elements,
    fetch: fetchImpl,
    window: { OSMPAnalytics: { track(name) { tracked.push(name); } }, turnstile: { getResponse() { return 'test-token'; } } }
  });
  const event = { target: form, preventDefault() {} };
  return { context, event, form, submitButton, successBanner, errorBanner, values, tracked };
}

test('shows success, tracks success and resets only after a 2xx response', async () => {
  const fixture = makeFixture(async () => response(201, { ok: true }));

  await fixture.context.submitForm(fixture.event);

  assert.equal(fixture.form.resetCount, 1);
  assert.deepEqual(fixture.tracked, ['lead_form_success']);
  assert.equal(fixture.successBanner.textContent, 'Anfrage gespeichert.');
  assert.equal(fixture.successBanner.hidden, false);
  assert.equal(fixture.errorBanner.textContent, '');
});

test('resets the Turnstile widget and clears its token after every submission attempt', async () => {
  const fixture = makeFixture(async () => response(400, { ok: false, error: 'invalid_request' }));
  let resets = 0;
  fixture.context.window.OSMP_TURNSTILE_WIDGET_ID = 'widget-1';
  fixture.context.window.turnstile.reset = id => { if (id === 'widget-1') resets += 1; };
  fixture.context.document.getElementById('turnstile_token').value = 'used-token';

  await fixture.context.submitForm(fixture.event);

  assert.equal(resets, 1);
  assert.equal(fixture.context.document.getElementById('turnstile_token').value, '');
});

test('keeps all values and shows a validation error after HTTP 400', async () => {
  const fixture = makeFixture(async () => response(400, { ok: false, error: 'invalid_email' }));

  await fixture.context.submitForm(fixture.event);

  assert.equal(fixture.form.resetCount, 0);
  assert.equal(fixture.errorBanner.textContent, 'Bitte prüfen Sie Ihre Angaben.');
  assert.deepEqual(fixture.tracked, []);
  assert.equal(fixture.context.document.getElementById('f_email').value, fixture.values.f_email);
});

test('shows a specific file-format error for invalid_file without resetting the form', async () => {
  const fixture = makeFixture(async () => response(400, { ok: false, error: 'invalid_file' }));
  fixture.errorBanner.focus = () => { fixture.errorBanner.focused = true; };

  await fixture.context.submitForm(fixture.event);

  assert.match(fixture.errorBanner.textContent, /Dateiformat|Dateiinhalt/i);
  assert.equal(fixture.errorBanner.hidden, false);
  assert.equal(fixture.errorBanner.focused, true);
  assert.equal(fixture.form.resetCount, 0);
});

test('keeps all values and shows a server error after HTTP 500', async () => {
  const fixture = makeFixture(async () => response(500, { ok: false, error: 'server_error' }));

  await fixture.context.submitForm(fixture.event);

  assert.equal(fixture.form.resetCount, 0);
  assert.equal(fixture.errorBanner.textContent, 'Die Anfrage konnte nicht gespeichert werden.');
  assert.deepEqual(fixture.tracked, []);
});

test('keeps all values and shows a network error when fetch rejects', async () => {
  const fixture = makeFixture(async () => { throw new TypeError('network down'); });

  await fixture.context.submitForm(fixture.event);

  assert.equal(fixture.form.resetCount, 0);
  assert.equal(fixture.errorBanner.textContent, 'Die Verbindung ist fehlgeschlagen.');
  assert.deepEqual(fixture.tracked, []);
});

test('ignores a second submit while the first request is pending', async () => {
  const pending = deferred();
  let requests = 0;
  const fixture = makeFixture(() => {
    requests += 1;
    return pending.promise;
  });

  const first = fixture.context.submitForm(fixture.event);
  const second = fixture.context.submitForm(fixture.event);
  assert.equal(requests, 1);
  pending.resolve(response(201, { ok: true }));
  await Promise.all([first, second]);
  assert.equal(requests, 1);
});

test('disables the submit button and exposes aria-busy only while pending', async () => {
  const pending = deferred();
  const fixture = makeFixture(() => pending.promise);

  const submission = fixture.context.submitForm(fixture.event);
  assert.equal(fixture.submitButton.disabled, true);
  assert.equal(fixture.form.getAttribute('aria-busy'), 'true');
  assert.equal(fixture.submitButton.textContent, 'Anfrage wird gesendet…');

  pending.resolve(response(201, { ok: true }));
  await submission;
  assert.equal(fixture.submitButton.disabled, false);
  assert.equal(fixture.form.getAttribute('aria-busy'), null);
  assert.equal(fixture.submitButton.textContent, 'Anfrage senden');
});

test('does not emit lead_form_success for any failed request', async () => {
  for (const status of [400, 404, 413, 500, 503]) {
    const fixture = makeFixture(async () => response(status, { ok: false, error: 'request_failed' }));
    await fixture.context.submitForm(fixture.event);
    assert.deepEqual(fixture.tracked, [], `unexpected success event for HTTP ${status}`);
  }
});

test('maps upload and rate-limit errors to focused accessible messages without resetting files', async () => {
  for (const [status, expected] of [[413, 'groß|größe'], [415, 'Format'], [422, 'prüfen'], [429, 'viele'], [500, 'gespeichert']]) {
    const fixture = makeFixture(async () => response(status, { ok: false, error: 'request_failed' }));
    fixture.errorBanner.focus = () => { fixture.errorBanner.focused = true; };
    await fixture.context.submitForm(fixture.event);
    assert.match(fixture.errorBanner.textContent, new RegExp(expected, 'i'), String(status));
    assert.equal(fixture.errorBanner.focused, true, String(status));
    assert.equal(fixture.form.resetCount, 0, String(status));
  }
});
