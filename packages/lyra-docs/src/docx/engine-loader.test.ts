import assert from 'node:assert/strict';
import test from 'node:test';
const { blankDocumentBytes } = await import('@docx-editor.dev/core/editor');
const store = await import('@docx-editor.dev/core/store');
import { deriveImageInsertionEngine } from './engine-image-insertion-loader.js';

test('insertion dependencies retain only bounded public default styles and declared functions', () => {
  const result = deriveImageInsertionEngine(blankDocumentBytes, store); assert(result);
  assert.equal(result.defaultStylesPart.name, '/word/styles.xml'); assert.equal(result.defaultStylesPart.root.localName, 'styles');
  assert.deepEqual(Object.keys(result).sort(), ['TreePackageStore', 'defaultStylesPart', 'readOoxmlPart', 'readZip', 'writeOoxmlPackage']);
  assert.equal(result.readOoxmlPart, store.readOoxmlPart); assert(Object.isFrozen(result));
});

test('optional insertion template dependencies refuse boundedly before the next parser and preserve normal loader functions', () => {
  let zipCalls = 0, xmlCalls = 0;
  const readers = { ...store, readZip: (...args: Parameters<typeof store.readZip>) => { zipCalls++; return store.readZip(...args); },
    readOoxmlPart: (...args: Parameters<typeof store.readOoxmlPart>) => { xmlCalls++; return store.readOoxmlPart(...args); } };
  assert.equal(deriveImageInsertionEngine(() => new Uint8Array(65537), readers), undefined); assert.equal(zipCalls, 0);
  const oversized = { ...readers, readZip: () => ({ ok: true as const, entries: new Map([['/word/styles.xml', new Uint8Array(32769)]]) }) };
  assert.equal(deriveImageInsertionEngine(blankDocumentBytes, oversized), undefined); assert.equal(xmlCalls, 0);
  assert.equal(deriveImageInsertionEngine(() => new Uint8Array([1]), readers), undefined);
  assert.equal(deriveImageInsertionEngine(() => { throw new Error('template unavailable'); }, readers), undefined);
  const result = deriveImageInsertionEngine(blankDocumentBytes, readers); assert(result); assert.equal(xmlCalls, 1);
});
