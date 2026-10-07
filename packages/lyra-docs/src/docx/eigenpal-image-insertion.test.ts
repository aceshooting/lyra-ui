import assert from 'node:assert/strict';
import test from 'node:test';
import { crc32 } from 'node:zlib';
import type { OoxmlPackage } from '@docx-editor.dev/core/store';
const store = await import('@docx-editor.dev/core/store');
const { blankDocumentBytes } = await import('@docx-editor.dev/core/editor');
import { docxFixture } from '../../test/admission-fixtures.js';
import { imageInsertionBytes } from '../../test/corpus.js';
import { deriveImageInsertionEngine } from './engine-image-insertion-loader.js';
import { normalizeImageInsertion } from './image-insertion-input.js';
import { preflightImageInsertion } from './eigenpal-image-insertion.js';
import type { DocxResult } from './types.js';

const valid = (): DocxResult<void> => ({ ok: true, value: undefined });
function fixture() {
  const read = store.readOoxmlPackage(docxFixture({ 'word/document.xml': '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"><w:body><w:p w14:paraId="00000001" w14:textId="00000001"><w:r><w:t>alpha</w:t></w:r></w:p></w:body></w:document>' })); assert(read.ok);
  const pkg = read.package, body = pkg.parts.get(pkg.mainDocumentPart)!.root.children[0]!; assert(body.kind !== 'textValue');
  const paragraph = body.children[0]!;
  const dependencies = deriveImageInsertionEngine(blankDocumentBytes, store); assert(dependencies);
  return { pkg, dependencies, target: { paragraphId: paragraph.id, offset: 2 }, signal: new AbortController().signal };
}
const input = (kind: 'png' | 'jpeg' | 'gif' = 'png') => {
  const checked = normalizeImageInsertion({ bytes: imageInsertionBytes(kind), widthPoints: 48, heightPoints: 24, title: 'A & 😀', description: 'one\ntwo' }, {}, valid);
  assert(checked.ok); return checked.value.source;
};

test('isolated insertion preflight accepts declared raster paths and preserves the original package', async () => {
  for (const kind of ['png', 'jpeg', 'gif'] as const) {
    const h = fixture(), source = input(kind), before = structuredClone(h.pkg); let decodes = 0, writes = 0, zipReads = 0;
    const dependencies = { ...h.dependencies, writeOoxmlPackage: (pkg: OoxmlPackage) => { writes++; assert.notEqual(pkg, h.pkg); return store.writeOoxmlPackage(pkg); },
      readZip: (...args: Parameters<typeof store.readZip>) => { zipReads++; assert.equal(args.length, 1); return store.readZip(...args); } };
    const result = await preflightImageInsertion(h.pkg, h.target, source, dependencies, { async decode(bytes, mime) {
      decodes++; assert.deepEqual(bytes, source.bytes); assert.equal(mime, source.metadata.mimeType);
      return { pixelWidth: source.metadata.pixelWidth, pixelHeight: source.metadata.pixelHeight, dpiX: 96, dpiY: 96 };
    } }, valid, h.signal);
    assert.deepEqual(result, { ok: true, value: undefined }, kind);
    assert.equal(decodes, 1); assert.equal(writes, 1); assert.equal(zipReads, 1); assert.deepEqual(h.pkg, before);
  }
});

test('insertion profile and prospective bound refuse before candidate allocation, decode or serialization', async () => {
  const h = fixture(), source = input(); let constructors = 0, decodes = 0, writes = 0;
  class Candidate extends store.TreePackageStore { constructor(...args: ConstructorParameters<typeof store.TreePackageStore>) { constructors++; super(...args); } }
  const dependencies = { ...h.dependencies, TreePackageStore: Candidate, writeOoxmlPackage: (pkg: OoxmlPackage) => { writes++; return store.writeOoxmlPackage(pkg); } };
  const decodePort = { async decode() { decodes++; return { pixelWidth: 64, pixelHeight: 32, dpiX: 96, dpiY: 96 }; } };
  assert.deepEqual(await preflightImageInsertion(h.pkg, { ...h.target, offset: 999 }, source, dependencies, decodePort, valid, h.signal), { ok: false, code: 'unsupported' });
  const huge = { ...source, bytes: new Uint8Array(4194305) };
  assert.deepEqual(await preflightImageInsertion(h.pkg, h.target, huge, dependencies, decodePort, valid, h.signal), { ok: false, code: 'resource-limit' });
  assert.equal(constructors, 0); assert.equal(decodes, 0); assert.equal(writes, 0);
});

test('a candidate package over 4 MiB within the profiled package bound is accepted', async () => {
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length), view = new DataView(out.buffer);
    view.setUint32(0, data.length); out.set(new TextEncoder().encode(type), 4); out.set(data, 8);
    view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length))); return out;
  };
  const header = new Uint8Array(13), noise = new Uint8Array(4 * 1024 * 1024 - 128);
  new DataView(header.buffer).setUint32(0, 64); new DataView(header.buffer).setUint32(4, 32); header.set([8, 6], 8);
  for (let index = 0, state = 0x2468ace1; index < noise.length; index++) { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; noise[index] = state & 255; }
  noise.set([0x78, 0x9c]);
  const parts = [Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10), chunk('IHDR', header), chunk('IDAT', noise), chunk('IEND', new Uint8Array())];
  const png = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  parts.reduce((offset, part) => { png.set(part, offset); return offset + part.length; }, 0);
  const checked = normalizeImageInsertion({ bytes: png, widthPoints: 48, heightPoints: 24 }, {}, valid); assert(checked.ok);
  const h = fixture(); let written = 0;
  const dependencies = { ...h.dependencies, writeOoxmlPackage: (pkg: OoxmlPackage) => { const bytes = store.writeOoxmlPackage(pkg); written = bytes.length; return bytes; } };
  const result = await preflightImageInsertion(h.pkg, h.target, checked.value.source, dependencies,
    { async decode() { return { pixelWidth: 64, pixelHeight: 32, dpiX: 96, dpiY: 96 }; } }, valid, h.signal);
  assert.ok(written > 4 * 1024 * 1024, String(written));
  assert.deepEqual(result, { ok: true, value: undefined });
});

test('candidate decode failure and native intent changes never reach candidate serialization', async () => {
  const h = fixture(); let writes = 0, stale = false;
  const dependencies = { ...h.dependencies, writeOoxmlPackage: (pkg: OoxmlPackage) => { writes++; return store.writeOoxmlPackage(pkg); } };
  assert.deepEqual(await preflightImageInsertion(h.pkg, h.target, input(), dependencies,
    { async decode() { throw new Error('native decode'); } }, valid, h.signal), { ok: false, code: 'invalid-document' });
  const validate = (): DocxResult<void> => stale ? { ok: false, code: 'stale-selection' } : valid();
  assert.deepEqual(await preflightImageInsertion(h.pkg, h.target, input(), dependencies,
    { async decode() { stale = true; return { pixelWidth: 64, pixelHeight: 32, dpiX: 96, dpiY: 96 }; } }, validate, h.signal), { ok: false, code: 'stale-selection' });
  assert.equal(writes, 0);
});

test('candidate serializer and parser exceptions preserve original bytes and original-authority precedence', async () => {
  for (const phase of ['constructor', 'writer', 'reader']) for (const stale of [false, true]) {
    const h = fixture(), before = structuredClone(h.pkg); let invalid = false, decodes = 0;
    const fail = (): never => { invalid = stale; throw new Error('candidate dependency failed'); };
    class Candidate extends store.TreePackageStore { constructor(...args: ConstructorParameters<typeof store.TreePackageStore>) { if (phase === 'constructor') fail(); super(...args); } }
    const dependencies = { ...h.dependencies, TreePackageStore: Candidate,
      writeOoxmlPackage: phase === 'writer' ? fail : store.writeOoxmlPackage, readZip: phase === 'reader' ? fail : store.readZip };
    const result = await preflightImageInsertion(h.pkg, h.target, input(), dependencies, { async decode() {
      decodes++; return { pixelWidth: 64, pixelHeight: 32, dpiX: 96, dpiY: 96 };
    } }, () => invalid ? { ok: false, code: 'stale-selection' } : valid(), h.signal);
    assert.deepEqual(result, { ok: false, code: stale ? 'stale-selection' : 'engine-failed' }, `${phase}/${stale}`);
    assert.equal(decodes, phase === 'constructor' ? 0 : 1); assert.deepEqual(h.pkg, before);
  }
});
