import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement, loadBrowserScript } from './helpers/load-browser-script.mjs';

function response(status, body = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; },
    async text() { return JSON.stringify(body); }
  };
}

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

  const tracked = [];
  const context = loadBrowserScript('js/app.js', {
    elements,
    fetch: fetchImpl,
    window: { OSMPAnalytics: { track(name) { tracked.push(name); } } }
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

test('keeps all values and shows a validation error after HTTP 400', async () => {
  const fixture = makeFixture(async () => response(400, { ok: false, error: 'invalid_email' }));

  await fixture.context.submitForm(fixture.event);

  assert.equal(fixture.form.resetCount, 0);
  assert.equal(fixture.errorBanner.textContent, 'Bitte prüfen Sie Ihre Angaben.');
  assert.deepEqual(fixture.tracked, []);
  assert.equal(fixture.context.document.getElementById('f_email').value, fixture.values.f_email);
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
