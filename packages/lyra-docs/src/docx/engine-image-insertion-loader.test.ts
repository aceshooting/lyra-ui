import assert from 'node:assert/strict';
import test from 'node:test';
import type { OoxmlElement, OoxmlNode } from '@docx-editor.dev/core/store';
const store = await import('@docx-editor.dev/core/store');
const { blankDocumentBytes } = await import('@docx-editor.dev/core/editor');
import { deriveImageInsertionEngine } from './engine-image-insertion-loader.js';

type Store = Parameters<typeof deriveImageInsertionEngine>[1];
const engineStore: Store = {
  readZip: store.readZip, readOoxmlPart: store.readOoxmlPart,
  TreePackageStore: store.TreePackageStore, writeOoxmlPackage: store.writeOoxmlPackage,
};
const STYLES = '/word/styles.xml';
const STYLES_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml';
const stylesBytes = new TextEncoder().encode('<w:styles/>');

const zipOf = (entries: Record<string, Uint8Array>) =>
  (() => ({ ok: true, entries: new Map(Object.entries(entries)) })) as unknown as Store['readZip'];
const partOf = (root: OoxmlElement) => (() => ({ ok: true, part: { name: STYLES, contentType: STYLES_TYPE, root } })) as unknown as Store['readOoxmlPart'];
let identity = 0;
function element(children: readonly OoxmlNode[] = [], extra: { attributes?: readonly unknown[]; namespaceBindings?: readonly unknown[] } = {}): OoxmlElement {
  return { kind: 'generic', id: `node-${identity++}`, namespaceUri: '', localName: 'x', attributes: [], namespaceBindings: [], children, ...extra } as unknown as OoxmlElement;
}
function chain(depth: number): OoxmlElement {
  let node = element();
  for (let level = 0; level < depth; level++) node = element([node]);
  return node;
}
const derive = (root: OoxmlElement) => deriveImageInsertionEngine(() => new Uint8Array(1), {
  ...engineStore, readZip: zipOf({ [STYLES]: stylesBytes }), readOoxmlPart: partOf(root),
});

test('the derived capability exposes the engine functions and the blank document default styles', () => {
  const engine = deriveImageInsertionEngine(blankDocumentBytes, engineStore);
  assert(engine); assert(Object.isFrozen(engine));
  assert.equal(engine.readZip, store.readZip); assert.equal(engine.readOoxmlPart, store.readOoxmlPart);
  assert.equal(engine.TreePackageStore, store.TreePackageStore); assert.equal(engine.writeOoxmlPackage, store.writeOoxmlPackage);
  assert.equal(engine.defaultStylesPart.name, STYLES); assert.equal(engine.defaultStylesPart.contentType, STYLES_TYPE);
  assert.equal(engine.defaultStylesPart.root.localName, 'styles');
});

test('a missing or non-callable engine function leaves the capability absent', () => {
  for (const name of ['readZip', 'readOoxmlPart', 'TreePackageStore', 'writeOoxmlPackage'] as const) {
    for (const value of [undefined, null, {}, 'function']) {
      assert.equal(deriveImageInsertionEngine(blankDocumentBytes, { ...engineStore, [name]: value } as unknown as Store), undefined, `${name}: ${String(value)}`);
    }
  }
  for (const blank of [undefined, null, {}] as const) {
    assert.equal(deriveImageInsertionEngine(blank as unknown as () => Uint8Array, engineStore), undefined);
  }
});

test('oversized blank document bytes are refused before any archive reader runs', () => {
  let reads = 0;
  const readZip = (() => { reads++; return { ok: false }; }) as unknown as Store['readZip'];
  assert.equal(deriveImageInsertionEngine(() => new Uint8Array(65537), { ...engineStore, readZip }), undefined);
  assert.equal(reads, 0);
  assert.equal(deriveImageInsertionEngine(() => new Uint8Array(65536), { ...engineStore, readZip }), undefined);
  assert.equal(reads, 1);
});

test('a blank archive that cannot be read or lacks bounded default styles leaves the capability absent', () => {
  const calls: unknown[][] = [];
  const unusable = { name: STYLES, contentType: STYLES_TYPE, root: element() };
  // Unsuccessful results never yield a capability, even when they carry a usable-looking payload.
  const readOoxmlPart = ((...args: unknown[]) => { calls.push(args); return { ok: false, reason: 'invalid-xml', part: unusable }; }) as unknown as Store['readOoxmlPart'];
  const attempt = (readZip: Store['readZip']) => deriveImageInsertionEngine(() => new Uint8Array(1), { ...engineStore, readZip, readOoxmlPart });
  assert.equal(attempt((() => ({ ok: false, reason: 'not-a-zip', entries: new Map([[STYLES, stylesBytes]]) })) as unknown as Store['readZip']), undefined);
  assert.equal(attempt(zipOf({})), undefined);
  assert.equal(attempt(zipOf({ [STYLES]: new Uint8Array(32769) })), undefined);
  assert.equal(calls.length, 0);
  assert.equal(attempt(zipOf({ [STYLES]: new Uint8Array(32768).fill(32) })), undefined);
  assert.equal(calls.length, 1);
  assert.equal(attempt(zipOf({ [STYLES]: stylesBytes })), undefined);
  assert.equal(calls.length, 2);
  assert.equal(calls[1]![0], '<w:styles/>');
  assert.deepEqual(calls[1]![1], { name: STYLES, contentType: STYLES_TYPE });
  assert.deepEqual(calls[1]![2], { maxBytes: 32768, maxElements: 1024 });
});

test('default styles that exceed the tree bounds leave the capability absent', () => {
  const shared = element();
  const bindings = (count: number) => Array.from({ length: count }, (_, index) => ({ prefix: `p${index}`, namespaceUri: 'urn:binding' }));
  const attributes = (count: number) => Array.from({ length: count }, (_, index) => ({ namespaceUri: '', localName: `a${index}`, value: '' }));
  // Counts element reads, so a list refused by its length alone is shown never to be walked.
  const countedChildren = (count: number) => {
    let reads = 0;
    const children = Array.from({ length: count }, () => element());
    Object.defineProperty(children, 0, { get() { reads++; return element(); } });
    return { children, reads: () => reads };
  };
  const wide = countedChildren(1024), crowded = countedChildren(1023);
  const accepted: readonly (readonly [string, OoxmlElement])[] = [
    ['a small tree with a text value', element([{ kind: 'textValue', id: 'text', value: 'x' } as unknown as OoxmlNode, element()])],
    ['depth 32', chain(32)],
    ['64 attributes', element([], { attributes: attributes(64) })],
    ['16 namespace bindings', element([], { namespaceBindings: bindings(16) })],
    ['1023 children', element(Array.from({ length: 1023 }, () => element()))],
  ];
  const refused: readonly (readonly [string, OoxmlElement])[] = [
    ['depth 33', chain(33)],
    ['a node reachable twice', element([shared, shared])],
    ['65 attributes', element([], { attributes: attributes(65) })],
    ['17 namespace bindings', element([], { namespaceBindings: bindings(17) })],
    ['1024 children', element(wide.children)],
    ['children beyond the remaining node budget', element([element(crowded.children)])],
  ];
  for (const [label, root] of accepted) {
    const engine = derive(root);
    assert(engine, label); assert.equal(engine.defaultStylesPart.root, root, label);
  }
  for (const [label, root] of refused) assert.equal(derive(root), undefined, label);
  assert.equal(wide.reads(), 0, 'a child list over the budget is refused before it is walked');
  assert.equal(crowded.reads(), 0, 'a child list over the remaining budget is refused before it is walked');
});

test('a throwing engine function or undecodable default styles leave the capability absent', () => {
  const failing = (() => { throw new Error('engine failed'); });
  assert.equal(deriveImageInsertionEngine(failing as () => Uint8Array, engineStore), undefined);
  assert.equal(deriveImageInsertionEngine(() => new Uint8Array(1), { ...engineStore, readZip: failing as unknown as Store['readZip'] }), undefined);
  const invalidText = zipOf({ [STYLES]: Uint8Array.of(0xff, 0xfe, 0xfd) });
  assert.equal(deriveImageInsertionEngine(() => new Uint8Array(1), { ...engineStore, readZip: invalidText }), undefined);
});
