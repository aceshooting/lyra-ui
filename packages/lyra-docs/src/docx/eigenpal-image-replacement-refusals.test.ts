import assert from 'node:assert/strict';
import test from 'node:test';
import type { OoxmlElement, OoxmlNode, OoxmlPackage, OoxmlPart } from '@docx-editor.dev/core/store';
const store = await import('@docx-editor.dev/core/store');
import { docxFixture, relationship } from '../../test/admission-fixtures.js';
import { decodePort, engine, replacementFixture as fixture, replacementSource as input, valid } from '../../test/image-preflight-harness.js';
import { preflightImageReplacement } from './eigenpal-image-replacement.js';
import { WORD_NS } from './ooxml.js';
import type { DocxRefusalCode, DocxResult } from './types.js';

type Fixture = ReturnType<typeof fixture>;
type Replace = { store?: typeof store.TreePackageStore; write?: typeof store.writeOoxmlPackage; readZip?: typeof store.readZip };
const MAX_ZIP = 16 * 1024 * 1024;
const STYLES_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml';
const stale = (code: DocxRefusalCode = 'stale-selection'): DocxResult<void> => ({ ok: false, code });
const limited = { ok: false, code: 'resource-limit' } as const;

/** Synthetic canonical nodes and parts, detached from any parsed document. */
let identity = 0;
function node(children: readonly OoxmlNode[] = [], extra: Record<string, unknown> = {}): OoxmlElement {
  return { kind: 'generic', id: `synthetic-${identity++}`, namespaceUri: 'urn:synthetic', localName: 'x', attributes: [], namespaceBindings: [], children, ...extra } as unknown as OoxmlElement;
}
const part = (root: OoxmlElement, name = '/word/extra.xml', contentType = 'application/xml') => ({ id: name, name, contentType, root }) as unknown as OoxmlPart;
const withParts = (pkg: OoxmlPackage, ...extra: OoxmlPart[]): OoxmlPackage => ({ ...pkg, parts: new Map([...pkg.parts, ...extra.map(value => [value.name, value] as const)]) });
const withBytes = (pkg: OoxmlPackage, entries: Record<string, Uint8Array>): OoxmlPackage => ({ ...pkg, partBytes: new Map([...pkg.partBytes, ...Object.entries(entries)]) });
const hiddenStyles = () => part(node([], { namespaceUri: WORD_NS, localName: 'vanish' }), '/word/styles.xml', STYLES_TYPE);
const chain = (depth: number) => { let root = node(); for (let level = 1; level < depth; level++) root = node([root]); return root; };
const leaves = (count: number) => Array.from({ length: count }, () => node());
function countNodes(pkg: OoxmlPackage): number {
  let total = 0;
  for (const value of pkg.parts.values()) {
    const stack: OoxmlNode[] = [value.root];
    while (stack.length) { const next = stack.pop()!; total++; if (next.kind !== 'textValue') stack.push(...next.children); }
  }
  return total;
}

/** Counts the isolated work a preflight performs; any piece can be replaced. */
async function preflight(h: Fixture, options: { pkg?: OoxmlPackage; source?: ReturnType<typeof input>; replace?: Replace;
  validate?: () => DocxResult<void>; signal?: AbortSignal; port?: typeof decodePort; target?: Fixture['target'] } = {}) {
  const counts = { constructed: 0, written: 0, zipReads: 0 }, replace = options.replace ?? {};
  class Candidate extends (replace.store ?? store.TreePackageStore) {
    constructor(...args: ConstructorParameters<typeof store.TreePackageStore>) { counts.constructed++; super(...args); }
  }
  const dependencies = { ...engine, TreePackageStore: Candidate,
    writeOoxmlPackage: (pkg: OoxmlPackage) => { counts.written++; return (replace.write ?? store.writeOoxmlPackage)(pkg); },
    readZip: (...args: Parameters<typeof store.readZip>) => { counts.zipReads++; return (replace.readZip ?? store.readZip)(...args); } };
  const result = await preflightImageReplacement(options.pkg ?? h.pkg, options.target ?? h.target, options.source ?? input(), dependencies,
    options.port ?? decodePort, options.validate ?? valid, options.signal ?? new AbortController().signal);
  return { result, counts };
}
/** Whether the package passed the allocation bounds and reached the engine, which then refuses at once. */
class StopsAtEngine extends store.TreePackageStore {
  override async replaceImage() { return { ok: false, reason: 'package-changed' } as const; }
}
async function reachesEngine(h: Fixture, pkg: OoxmlPackage, source?: ReturnType<typeof input>): Promise<boolean> {
  const { counts, result } = await preflight(h, { pkg, ...(source ? { source } : {}), replace: { store: StopsAtEngine } });
  if (counts.constructed === 0) assert.deepEqual(result, limited);
  return counts.constructed === 1;
}

test('replacement bounds the package it will copy before qualifying or allocating anything', async () => {
  const h = fixture(), shared = new Uint8Array(MAX_ZIP);
  const parts = (count: number) => withParts(h.pkg, ...Array.from({ length: count }, (_, index) => part(node(), `/word/extra-${index}.xml`)));
  const total = countNodes(h.pkg), children = 19999 - total;
  const pairs: readonly (readonly [string, OoxmlPackage, OoxmlPackage])[] = [
    ['parts', parts(128 - h.pkg.parts.size), parts(129 - h.pkg.parts.size)],
    ['part byte entries', withBytes(h.pkg, Object.fromEntries(Array.from({ length: 2046 - h.pkg.partBytes.size }, (_, index) => [`/spare-${index}`, new Uint8Array()]))),
      withBytes(h.pkg, Object.fromEntries(Array.from({ length: 2047 - h.pkg.partBytes.size }, (_, index) => [`/spare-${index}`, new Uint8Array()])))],
    ['one entry', withBytes(h.pkg, { '/large': shared }), withBytes(h.pkg, { '/large': new Uint8Array(MAX_ZIP + 1) })],
    ['entry name length', withBytes(h.pkg, { [`/${'n'.repeat(1023)}`]: new Uint8Array() }), withBytes(h.pkg, { [`/${'n'.repeat(1024)}`]: new Uint8Array() })],
    ['all entries together', withBytes(h.pkg, { '/a': shared, '/b': shared, '/c': shared }), withBytes(h.pkg, { '/a': shared, '/b': shared, '/c': shared, '/d': shared })],
    ['nested depth', withParts(h.pkg, part(chain(64))), withParts(h.pkg, part(chain(65)))],
    ['attributes of one element', withParts(h.pkg, part(node([], { attributes: Array.from({ length: 64 }, (_, index) => ({ namespaceUri: '', localName: `a${index}`, value: '' })) }))),
      withParts(h.pkg, part(node([], { attributes: Array.from({ length: 65 }, (_, index) => ({ namespaceUri: '', localName: `a${index}`, value: '' })) })))],
    ['namespace bindings of one element', withParts(h.pkg, part(node([], { namespaceBindings: Array.from({ length: 64 }, (_, index) => ({ prefix: `p${index}`, namespaceUri: 'urn:binding' })) }))),
      withParts(h.pkg, part(node([], { namespaceBindings: Array.from({ length: 65 }, (_, index) => ({ prefix: `p${index}`, namespaceUri: 'urn:binding' })) })))],
    ['children of one element', withParts(h.pkg, part(node(leaves(children)))), withParts(h.pkg, part(node(leaves(children + 1))))],
    ['nodes across parts', withParts(h.pkg, part(node(leaves(children)))), withParts(h.pkg, part(node(leaves(children))), part(node(), '/word/last.xml'))],
    ['text of one part', withParts(h.pkg, part(node([{ kind: 'textValue', id: 'text-small', value: 'x'.repeat(1000) } as unknown as OoxmlNode]))),
      withParts(h.pkg, part(node([{ kind: 'textValue', id: 'text-large', value: 'x'.repeat(11_200_000) } as unknown as OoxmlNode])))],
    ['repeated identity in one part', withParts(h.pkg, part(node([node(), node()]))), withParts(h.pkg, part(node([node([], { id: 'twin' }), node([], { id: 'twin' })])))],
  ];
  for (const [label, within, beyond] of pairs) {
    assert.equal(await reachesEngine(h, within), true, `${label}: within the bound`);
    assert.equal(await reachesEngine(h, beyond), false, `${label}: beyond the bound`);
  }
  assert.equal(await reachesEngine(h, h.pkg, input()), true);
  assert.equal(await reachesEngine(h, h.pkg, { ...input(), bytes: new Uint8Array(4 * 1024 * 1024 + 1) }), false, 'replacement bytes');
});

test('replacement refuses a child list over the node budget without walking it', async () => {
  const h = fixture(), children = leaves(20000 - countNodes(h.pkg)); let reads = 0;
  Object.defineProperty(children, 0, { get() { reads++; return node(); } });
  assert.equal(await reachesEngine(h, withParts(h.pkg, part(node(children)))), false);
  assert.equal(reads, 0);
});

test('replacement stops at an owner refusal before qualifying or allocating', async () => {
  for (const [label, failFrom] of [['before the picture is qualified', 1], ['after the picture is qualified', 2]] as const) {
    const h = fixture(); let checks = 0;
    const { result, counts } = await preflight(h, { validate: () => ++checks >= failFrom ? stale('destroyed') : valid() });
    assert.deepEqual(result, { ok: false, code: 'destroyed' }, label);
    assert.equal(checks, failFrom, label); assert.deepEqual(counts, { constructed: 0, written: 0, zipReads: 0 }, label);
  }
});

test('replacement refuses a package without a main part, a package whose styles can hide content or a target that is not a qualified picture', async () => {
  const h = fixture(), unsupported = { ok: false, code: 'unsupported' } as const;
  for (const [label, options] of [
    ['a missing main document part', { pkg: { ...h.pkg, mainDocumentPart: '/word/missing.xml' } }],
    ['a package whose styles can hide content', { pkg: withParts(h.pkg, hiddenStyles()) }],
    ['a picture in another paragraph', { target: { ...h.target, paragraphId: 'another-paragraph' } }],
    ['a picture that does not exist', { target: { ...h.target, drawingId: 'another-drawing' } }],
  ] as const) {
    const { result, counts } = await preflight(h, options);
    assert.deepEqual(result, unsupported, label); assert.deepEqual(counts, { constructed: 0, written: 0, zipReads: 0 }, label);
  }
});

test('replacement maps engine refusals onto resource, document and engine failures', async () => {
  const outcomes = [
    ['a resource refusal', { ok: false, reason: 'resource-limit' }, 'resource-limit'],
    ['any other refusal', { ok: false, reason: 'package-changed' }, 'invalid-document'],
    ['a transaction that changed nothing', { ok: true, change: null }, 'engine-failed'],
  ] as const;
  for (const [label, outcome, code] of outcomes) {
    class Refusing extends store.TreePackageStore { override async replaceImage() { return outcome; } }
    const h = fixture(), { result, counts } = await preflight(h, { replace: { store: Refusing } });
    assert.deepEqual(result, { ok: false, code }, label); assert.equal(counts.written, 0, label);
  }
  const h = fixture();
  const failing = { async decode(): Promise<never> { throw new Error('native decode failed'); } };
  assert.deepEqual((await preflight(h, { port: failing })).result, { ok: false, code: 'invalid-document' });
});

test('replacement refuses an updated package that lost its main part, its qualification or the picture it should have kept', async () => {
  const unsupported = { ok: false, code: 'unsupported' } as const;
  // The engine's own result is replaced only once the replacement has settled, so the engine works on the real package.
  const updatedBy = (change: (updated: OoxmlPackage, target: Fixture['target']) => OoxmlPackage, target: Fixture['target']) =>
    class extends store.TreePackageStore {
      #settled = false;
      override async replaceImage(...args: Parameters<typeof store.TreePackageStore.prototype.replaceImage>) {
        const result = await super.replaceImage(...args); this.#settled = true; return result;
      }
      override currentPackage(): OoxmlPackage {
        const current = super.currentPackage();
        return this.#settled ? change(structuredClone(current), target) : current;
      }
    };
  const elementsUnder = (root: OoxmlNode) => {
    const found: OoxmlElement[] = [], stack: OoxmlNode[] = [root];
    while (stack.length) { const next = stack.pop()!; if (next.kind !== 'textValue') { found.push(next); stack.push(...next.children); } }
    return found;
  };
  const mainElements = (updated: OoxmlPackage) => elementsUnder(updated.parts.get(updated.mainDocumentPart)!.root);
  const within = (updated: OoxmlPackage, target: Fixture['target'], name: string) =>
    elementsUnder(mainElements(updated).find(value => value.id === target.drawingId)!).find(value => value.localName === name)!;
  const setAttribute = (value: OoxmlElement, name: string, text: string) => {
    (value.attributes as unknown as { localName: string; value: string }[]).find(attribute => attribute.localName === name)!.value = text;
  };
  const moveRun = (updated: OoxmlPackage, target: Fixture['target'], destination: boolean) => {
    const all = mainElements(updated), drawing = all.find(value => value.id === target.drawingId)!;
    const parentOf = (child: OoxmlNode) => all.find(value => (value.children as readonly OoxmlNode[]).includes(child))!;
    const run = parentOf(drawing), paragraph = parentOf(run), siblings = paragraph.children as OoxmlNode[];
    siblings.splice(siblings.indexOf(run), 1);
    if (destination) (all.find(value => value.localName === 'p' && value !== paragraph)!.children as OoxmlNode[]).push(run);
    return updated;
  };
  const cases: readonly (readonly [string, (updated: OoxmlPackage, target: Fixture['target']) => OoxmlPackage, { ok: false; code: DocxRefusalCode }])[] = [
    ['a missing main part', updated => ({ ...updated, mainDocumentPart: '/word/missing.xml' }), { ok: false, code: 'engine-failed' }],
    ['styles that can hide content', updated => withParts(updated, hiddenStyles()), unsupported],
    ['a changed width', (updated, target) => { setAttribute(within(updated, target, 'extent'), 'cx', String(target.width + 1)); return updated; }, unsupported],
    ['a changed height', (updated, target) => { setAttribute(within(updated, target, 'extent'), 'cy', String(target.height + 1)); return updated; }, unsupported],
    ['a changed title', (updated, target) => { setAttribute(within(updated, target, 'docPr'), 'title', 'Changed'); return updated; }, unsupported],
    ['a changed description', (updated, target) => { setAttribute(within(updated, target, 'docPr'), 'descr', 'Changed'); return updated; }, unsupported],
    ['a picture moved to another paragraph', (updated, target) => moveRun(updated, target, true), unsupported],
    ['a removed picture', (updated, target) => moveRun(updated, target, false), unsupported],
  ];
  const control = fixture();
  assert.deepEqual((await preflight(control, { replace: { store: updatedBy(updated => updated, control.target) } })).result, { ok: true, value: undefined });
  for (const [label, change, expected] of cases) {
    const h = fixture(), { result, counts } = await preflight(h, { replace: { store: updatedBy(change, h.target) } });
    assert.deepEqual(result, expected, label); assert.equal(counts.written, 0, label);
  }
});

test('replacement returns an owner refusal that arrives after serialization, admission or archive reading', async () => {
  for (const checkpoint of ['serialization', 'admission', 'archive'] as const) {
    const h = fixture(); let revoked = false, signalReads = 0;
    // The abort flag is only read here by admission, once the owner has already been refused.
    const signal = new AbortController().signal;
    Object.defineProperty(signal, 'aborted', { get() { if (revoked) signalReads++; return false; } });
    const { result, counts } = await preflight(h, { signal, validate: () => revoked ? stale() : valid(), replace: {
      write: pkg => {
        const bytes = store.writeOoxmlPackage(pkg);
        if (checkpoint === 'serialization') revoked = true;
        if (checkpoint === 'admission') queueMicrotask(() => { revoked = true; });
        return bytes;
      },
      readZip: (...args) => { const archive = store.readZip(...args); if (checkpoint === 'archive') revoked = true; return archive; },
    } });
    assert.deepEqual(result, { ok: false, code: 'stale-selection' }, checkpoint);
    assert.equal(counts.zipReads, checkpoint === 'archive' ? 1 : 0, checkpoint);
    if (checkpoint === 'serialization') assert.equal(signalReads, 0, 'a refused owner never reaches admission');
  }
});

test('replacement passes admission refusals through and maps archive reader refusals', async () => {
  const external = docxFixture({ 'word/_rels/document.xml.rels': relationship('https://example.test/object', 'oleObject') });
  for (const [label, bytes, code] of [
    ['an archive with an external object', external, 'external-resource'], ['not an archive', Uint8Array.of(1, 2, 3), 'invalid-document'],
  ] as const) {
    const h = fixture(), { result, counts } = await preflight(h, { replace: { write: () => bytes } });
    assert.deepEqual(result, { ok: false, code }, label); assert.equal(counts.zipReads, 0, label);
  }
  for (const [reason, code] of [['too-large', 'resource-limit'], ['too-many-entries', 'resource-limit'], ['bad-name', 'invalid-document'], ['inflate-error', 'invalid-document']] as const) {
    const h = fixture(), { result } = await preflight(h, { replace: { readZip: (() => ({ ok: false, reason })) as typeof store.readZip } });
    assert.deepEqual(result, { ok: false, code }, reason);
  }
});
