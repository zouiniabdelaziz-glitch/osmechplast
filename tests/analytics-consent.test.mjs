import test from 'node:test';
import assert from 'node:assert/strict';
import { createBasicDocument, loadBrowserScript } from './helpers/load-browser-script.mjs';

function loadWithChoice(choice) {
  const document = createBasicDocument();
  const localStorage = {
    getItem() { return choice; },
    setItem() {}
  };
  loadBrowserScript('js/analytics.js', { document, localStorage, window: {} });
  return document;
}

function externalScriptIds(document) {
  return document.head.children
    .filter(child => child.tagName === 'SCRIPT')
    .map(child => child.id)
    .sort();
}

test('loads no Google or Clarity script before a consent choice', () => {
  const document = loadWithChoice(null);
  assert.deepEqual(externalScriptIds(document), []);
});

test('loads no Google or Clarity script after consent is denied', () => {
  const document = loadWithChoice('denied');
  assert.deepEqual(externalScriptIds(document), []);
});

test('loads Google and Clarity exactly once after consent is granted', () => {
  const document = loadWithChoice('granted');
  assert.deepEqual(externalScriptIds(document), ['osmp-clarity-tag', 'osmp-google-tag']);
});
