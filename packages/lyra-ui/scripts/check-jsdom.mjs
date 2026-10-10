#!/usr/bin/env node
// jsdom smoke gate (run after a build, part of `test:ssr`): the built `installJsdomShims()` lets the
// built components run under a real jsdom, the way a consumer's Vitest or Jest jsdom environment
// loads them. Run with `node --conditions=browser`, as those environments resolve Lit's browser build.
//
// 1. In plain Node (no DOM globals) the shim installs nothing.
// 2. Under jsdom it gives Document and ShadowRoot `adoptedStyleSheets`, so Lit adopts constructed
//    sheets instead of one `<style>` per shadow root, and Lyra constructs, fills (`replaceSync`)
//    and adopts its document token layer.
// 3. A few components register, connect and render without an error, with no `<style>` element in
//    their shadow roots; form controls construct through the completed ElementInternals and keep
//    their value and validity in sync.
// 4. The returned function removes what the shim added.
// The real-browser no-op is covered by `src/testing/jsdom-shims.test.ts` in all three engines.

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = (relative) => pathToFileURL(path.join(packageDir, 'dist', relative)).href;
if (!existsSync(path.join(packageDir, 'dist', 'testing', 'jsdom-shims.js'))) {
  console.error('check-jsdom: dist/ is missing; run the build first.');
  process.exit(1);
}

const { installJsdomShims } = await import(dist('testing/jsdom-shims.js'));

// 1. Plain Node.
assert.equal(typeof globalThis.Document, 'undefined', 'the check starts without DOM globals');
installJsdomShims()();
assert.equal(typeof globalThis.Document, 'undefined', 'the shim adds nothing outside jsdom');

// The globals a jsdom test environment exposes. Node's own Event, EventTarget, AbortSignal and
// navigator are replaced too: jsdom rejects foreign events and signals, and the shim detects jsdom
// from its navigator.
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
const { window } = dom;
const replaced = new Set(['window', 'self', 'document', 'navigator', 'location', 'Event', 'EventTarget', 'CustomEvent', 'MessageEvent', 'DOMException', 'AbortController', 'AbortSignal']);
for (const key of Object.getOwnPropertyNames(window)) {
  if (key in globalThis && !replaced.has(key)) continue;
  Object.defineProperty(globalThis, key, { configurable: true, enumerable: false, get: () => window[key] });
}
const errors = [];
window.addEventListener('error', (event) => errors.push(event.error ?? event.message));
process.on('unhandledRejection', (reason) => errors.push(reason));

const hadAdoption = 'adoptedStyleSheets' in window.Document.prototype;
const restore = installJsdomShims();
assert.ok('adoptedStyleSheets' in document, 'Document has adoptedStyleSheets');
assert.ok('adoptedStyleSheets' in window.ShadowRoot.prototype, 'ShadowRoot has adoptedStyleSheets');
assert.equal(typeof window.CSSStyleSheet.prototype.replaceSync, 'function', 'constructed sheets can be filled');
assert.equal(typeof window.ElementInternals.prototype.setFormValue, 'function', 'ElementInternals is form-associated');

// 2 and 3. Lit is first evaluated here, after the shim, as a setupFiles entry orders it.
const { DOCUMENT_TOKEN_SENTINEL } = await import(dist('internal/document-tokens.generated.js'));
for (const entry of ['lr-button', 'lr-card', 'lr-badge', 'lr-checkbox', 'lr-input']) await import(dist(`components/${entry}.js`));

const SHEET_TEXT = Symbol.for('lyra-ui.testing.jsdom-adopted-style-sheets.text');
function sheetText(sheet) {
  if (typeof sheet[SHEET_TEXT] === 'string') return sheet[SHEET_TEXT];
  try {
    return Array.from(sheet.cssRules, (rule) => rule.cssText).join('\n');
  } catch {
    return '';
  }
}

document.body.innerHTML = `
  <lr-card><span slot="header">Title</span>Body<lr-button slot="footer" variant="brand">Save</lr-button></lr-card>
  <lr-badge>New</lr-badge>
  <lr-checkbox>Accept</lr-checkbox>
  <lr-input label="Name"></lr-input>`;
const elements = ['lr-card', 'lr-button', 'lr-badge', 'lr-checkbox', 'lr-input'].map((name) => document.querySelector(name));
const settled = (promise, label) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} did not settle`)), 5000))]);
for (const element of elements) {
  assert.ok(element instanceof window.HTMLElement && element.constructor !== window.HTMLElement, `<${element?.localName}> upgraded`);
  await settled(element.updateComplete, `<${element.localName}> updateComplete`);
}
await new Promise((resolve) => setTimeout(resolve, 0));

assert.ok(document.adoptedStyleSheets.some((sheet) => sheetText(sheet).includes(DOCUMENT_TOKEN_SENTINEL)),
  'the document adopted the token layer it constructed and filled with replaceSync()');
for (const element of elements) {
  const root = element.shadowRoot;
  assert.ok(root && root.childNodes.length > 0, `<${element.localName}> rendered its shadow root`);
  assert.ok(root.adoptedStyleSheets.length > 0, `<${element.localName}> adopted its component styles`);
  assert.equal(root.querySelectorAll('style').length, 0, `<${element.localName}> has no per-root <style> element`);
}
assert.ok(elements[1].shadowRoot.querySelector('button, [part~="base"]'), 'lr-button rendered its control');
elements[1].click();
const input = elements[4];
input.required = true;
await settled(input.updateComplete, 'lr-input update');
assert.equal(input.checkValidity(), false, 'a required empty lr-input is invalid');
input.value = 'Ada';
await settled(input.updateComplete, 'lr-input update');
assert.equal(input.checkValidity(), true, 'a filled lr-input is valid');
assert.deepEqual(errors.map(String), [], 'no error under jsdom');

// 4. Restore.
restore();
if (!hadAdoption) assert.ok(!('adoptedStyleSheets' in window.Document.prototype), 'restore() removes the shim');
document.body.innerHTML = '';
window.close();
console.log(`check-jsdom: ${elements.length} components rendered under jsdom with the shim; token layer adopted.`);
