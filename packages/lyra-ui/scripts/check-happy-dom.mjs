#!/usr/bin/env node
// Consumer smoke gate: the public setup helper must support marked application shadow scopes.
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';

const { installHappyDomShims } = await import('../dist/testing/index.js');
installHappyDomShims();
assert.equal(typeof globalThis.ShadowRoot, 'undefined', 'plain Node gains no DOM globals');

const window = new Window({ url: 'http://localhost/' });
const replaced = new Set(['window', 'self', 'document', 'navigator', 'location', 'Event', 'EventTarget', 'CustomEvent', 'MessageEvent', 'DOMException', 'AbortController', 'AbortSignal']);
for (const key of Object.getOwnPropertyNames(window)) {
  if (key in globalThis && !replaced.has(key)) continue;
  Object.defineProperty(globalThis, key, { configurable: true, enumerable: false, get: () => window[key] });
}
const errors = [];
window.addEventListener('error', (event) => errors.push(event.error ?? event.message));
process.on('unhandledRejection', (error) => errors.push(error));

try {
  const authorDirection = document.createElement('style');
  authorDirection.textContent = 'div{direction:ltr}';
  document.head.append(authorDirection);
  const beforeDirectionInstall = new Set(document.head.querySelectorAll('style'));
  installHappyDomShims();
  const ownedDirection = [...document.head.querySelectorAll('style')].find((style) => !beforeDirectionInstall.has(style));
  assert.ok(ownedDirection, 'missing direction support installs a stylesheet despite author overrides');
  const descriptor = Object.getOwnPropertyDescriptor(ShadowRoot.prototype, 'styleSheets');
  const headNodes = document.head.childNodes.length;
  installHappyDomShims();
  assert.equal(document.head.childNodes.length, headNodes, 'installing twice adds no direction stylesheet');
  ownedDirection.remove();
  installHappyDomShims();
  assert.equal(document.head.childNodes.length, headNodes, 'a removed direction stylesheet is replaced exactly once');
  installHappyDomShims();
  assert.equal(document.head.childNodes.length, headNodes, 'the replacement remains idempotent under author overrides');
  authorDirection.remove();
  assert.equal(Object.getOwnPropertyDescriptor(ShadowRoot.prototype, 'styleSheets')?.get, descriptor?.get,
    'installing twice preserves the installed getter');

  const host = document.createElement('div');
  const root = host.attachShadow({ mode: 'open' });
  document.body.append(host);
  const { adoptLyraTokens } = await import('../dist/utilities/tokens.js');
  adoptLyraTokens(root);
  const sheets = root.styleSheets;
  assert.equal(sheets.length, 0, 'an application shadow root exposes an empty stylesheet collection');
  assert.equal(sheets.item(0), null, 'item() returns null outside the collection');
  const unloaded = document.createElement('link');
  unloaded.rel = 'stylesheet';
  root.append(unloaded);
  assert.equal(sheets.length, 0, 'a link without a loaded sheet is excluded');

  const style = document.createElement('style');
  style.textContent = ':host{color:red}';
  root.append(style);
  assert.equal(sheets.length, 1, 'the retained collection reflects an appended style');
  assert.equal(sheets[0], style.sheet, 'indexed access returns the owning stylesheet');
  assert.equal(sheets.item(0), style.sheet, 'item() returns the owning stylesheet');
  assert.deepEqual([...sheets], [style.sheet], 'the collection is iterable');
  const link = document.createElement('link');
  link.rel = 'alternate STYLESHEET';
  const linkedSheet = new CSSStyleSheet();
  Object.defineProperty(link, 'sheet', { value: linkedSheet });
  root.insertBefore(link, style);
  assert.deepEqual([...sheets], [linkedSheet, style.sheet], 'stylesheet rel tokens are case-insensitive and sheets follow tree order');
  link.remove();
  const nestedHost = document.createElement('div');
  root.append(nestedHost);
  nestedHost.attachShadow({ mode: 'open' }).append(document.createElement('style'));
  assert.equal(sheets.length, 1, 'nested shadow-root sheets belong to their own scope');
  style.remove();
  assert.equal(sheets.length, 0, 'the retained collection reflects removal');

  // Exercise the real v28 provider scan through its public utility and an actual component.
  adoptLyraTokens(root);
  assert.equal(root.adoptedStyleSheets.length, 1, 'the scope adopts its token provider');
  assert.equal(sheets.length, 0, 'constructed sheets are separate from linked stylesheets');
  await import('../dist/components/lr-card.js');
  const card = document.createElement('lr-card');
  card.setAttribute('data-lr-theme-scope', '');
  root.append(card);
  let timer;
  try {
    await Promise.race([
      card.updateComplete,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('marked card did not render')), 5000); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
  assert.ok(card.shadowRoot?.childNodes.length > 0, 'a scope-marked component renders in an application shadow root');
  assert.equal(root.adoptedStyleSheets.length, 1, 'the component reuses the root token provider');
  const directionHost = document.createElement('div');
  directionHost.dir = 'rtl';
  const directionCard = document.createElement('lr-card');
  directionHost.append(directionCard);
  document.body.append(directionHost);
  await directionCard.updateComplete;
  assert.equal(getComputedStyle(directionHost).direction, 'rtl', 'semantic dir supplies the platform direction hint');
  assert.equal(directionCard.effectiveDirection, 'rtl', 'components inherit semantic RTL direction');
  directionHost.dir = 'ltr';
  assert.equal(getComputedStyle(directionCard).direction, 'ltr', 'direction follows a changed ancestor attribute');
  directionCard.style.direction = 'rtl';
  assert.equal(getComputedStyle(directionCard).direction, 'rtl', 'explicit CSS direction overrides the attribute hint');
  directionCard.style.direction = '';
  directionHost.setAttribute('dir', 'RTL');
  assert.equal(getComputedStyle(directionCard).direction, 'rtl', 'HTML direction values are case-insensitive');
  directionCard.dir = 'ltr';
  assert.equal(getComputedStyle(directionCard).direction, 'ltr', 'a child direction hint overrides inherited direction');
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(errors.map(String), [], 'no synchronous or deferred Happy DOM errors');
  console.log('check-happy-dom: public shims support live shadow stylesheet lists and marked token scopes.');
} finally {
  document.body.innerHTML = '';
  await window.happyDOM.abort();
}
