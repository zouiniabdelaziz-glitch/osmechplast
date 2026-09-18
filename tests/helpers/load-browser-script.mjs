import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

function createElement(tagName = 'div') {
  const attributes = new Map();
  const listeners = new Map();
  return {
    tagName: tagName.toUpperCase(),
    id: '',
    type: '',
    className: '',
    textContent: '',
    innerHTML: '',
    hidden: false,
    disabled: false,
    dataset: {},
    style: {},
    children: [],
    classList: {
      add() {},
      remove() {},
      toggle() {}
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
      if (name === 'id') this.id = String(value);
    },
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
    removeAttribute(name) {
      attributes.delete(name);
    },
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    remove() {},
    querySelectorAll() { return []; },
    querySelector() { return null; },
    closest() { return null; },
    _attributes: attributes,
    _listeners: listeners
  };
}

export function createBasicDocument(elements = {}) {
  const listeners = new Map();
  const head = createElement('head');
  const body = createElement('body');
  const documentElement = createElement('html');
  documentElement.lang = 'de';

  return {
    cookie: '',
    head,
    body,
    documentElement,
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    getElementById(id) {
      return elements[id] || [...head.children, ...body.children].find(child => child.id === id) || null;
    },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    createElement,
    createTreeWalker() {
      return { nextNode() { return false; }, currentNode: null };
    },
    _listeners: listeners
  };
}

export function loadBrowserScript(relativePath, overrides = {}) {
  const elements = overrides.elements || {};
  const document = overrides.document || createBasicDocument(elements);
  const window = overrides.window || {};
  const context = vm.createContext({
    document,
    window,
    localStorage: overrides.localStorage || {
      getItem() { return null; },
      setItem() {}
    },
    location: overrides.location || {
      pathname: '/',
      hash: '',
      search: '',
      hostname: 'localhost'
    },
    fetch: overrides.fetch,
    setTimeout: overrides.setTimeout || (() => 0),
    clearTimeout() {},
    URLSearchParams,
    NodeFilter: { SHOW_TEXT: 4, FILTER_REJECT: 2, FILTER_ACCEPT: 1 },
    IntersectionObserver: class {
      observe() {}
      unobserve() {}
    },
    HTMLInputElement: class {},
    FormData,
    File,
    Blob,
    crypto: overrides.crypto || { randomUUID() { return '123e4567-e89b-42d3-a456-426614174000'; } },
    console: overrides.console || console,
    T: overrides.T || {
      de: {
        f_success: 'Anfrage gespeichert.',
        f_submitting: 'Anfrage wird gesendet…',
        f_error_validation: 'Bitte prüfen Sie Ihre Angaben.',
        f_error_network: 'Die Verbindung ist fehlgeschlagen.',
        f_error_server: 'Die Anfrage konnte nicht gespeichert werden.'
      }
    }
  });
  window.window = window;
  window.document = document;
  window.location = context.location;
  const source = fs.readFileSync(path.resolve(relativePath), 'utf8');
  vm.runInContext(source, context, { filename: relativePath });
  return context;
}

export { createElement };
