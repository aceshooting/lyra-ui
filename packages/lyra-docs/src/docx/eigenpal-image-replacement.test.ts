import assert from 'node:assert/strict';
import test from 'node:test';
import type { OoxmlNode, OoxmlPackage } from '@docx-editor.dev/core/store';
const store = await import('@docx-editor.dev/core/store');
import { decodePort, engine as dependencies, replacementFixture as fixture, replacementSource as input, valid } from '../../test/image-preflight-harness.js';
import { imageInsertionBytes } from '../../test/corpus.js';
import { normalizeImageReplacement } from './image-insertion-input.js';
import { preflightImageReplacement } from './eigenpal-image-replacement.js';
import { imageCandidatesInPackage } from './eigenpal-images.js';
import type { DocxResult } from './types.js';
import { DRAWING_MAIN_NS, OFFICE_REL_NS, resolveOoxmlPart } from './ooxml.js';

function drawingMedia(pkg: OoxmlPackage, drawingId: string): Uint8Array {
  const part = pkg.parts.get(pkg.mainDocumentPart)!;
  const stack: { node: OoxmlNode; inside: boolean }[] = [{ node: part.root, inside: false }];
  while (stack.length) {
    const { node, inside } = stack.pop()!;
    if (node.kind === 'textValue') continue;
    if (inside && node.namespaceUri === DRAWING_MAIN_NS && node.localName === 'blip') {
      const id = node.attributes.find(attr => attr.namespaceUri === OFFICE_REL_NS && attr.localName === 'embed')?.value;
      const relation = pkg.relationships.get(part.name)!.find(value => value.id === id)!;
      const path = resolveOoxmlPart(part.name, relation.rawTarget); assert(path);
      const bytes = pkg.partBytes.get(path); assert(bytes); return bytes;
    }
    for (const child of node.children) stack.push({ node: child, inside: inside || node.id === drawingId });
  }
  throw new Error('missing drawing media');
}

test('replacement preflight preserves original package and picture metadata across raster formats', async () => {
  for (const kind of ['png', 'jpeg', 'gif'] as const) {
    const h = fixture(), before = structuredClone(h.pkg); let serialized: Uint8Array | undefined;
    const result = await preflightImageReplacement(h.pkg, h.target, input(kind), { ...dependencies,
      writeOoxmlPackage(pkg: OoxmlPackage) { serialized = store.writeOoxmlPackage(pkg); return serialized; }
    }, { async decode() { const source = input(kind); return { pixelWidth: source.metadata.pixelWidth, pixelHeight: source.metadata.pixelHeight, dpiX: 96, dpiY: 96 }; } }, valid, new AbortController().signal);
    assert.deepEqual(result, { ok: true, value: undefined }, kind); assert.deepEqual(h.pkg, before); assert(serialized);
    const reopened = store.readOoxmlPackage(serialized); assert(reopened.ok);
    const images = imageCandidatesInPackage(reopened.package, reopened.package.parts.get(reopened.package.mainDocumentPart)!); assert(images.ok);
    assert.equal(images.value[0]!.width, h.target.width); assert.equal(images.value[0]!.height, h.target.height);
    assert.equal(images.value[0]!.title, h.target.title); assert.equal(images.value[0]!.description, h.target.description);
    assert.deepEqual(drawingMedia(reopened.package, images.value[0]!.drawingId), input(kind).bytes);
    assert.deepEqual(drawingMedia(reopened.package, images.value[1]!.drawingId), drawingMedia(h.pkg, h.target.drawingId));
  }
});
test('replacement qualification refuses unsupported targets before decode and honors cancellation after decode', async () => {
  for (const kind of ['image-crop', 'image-rotation', 'image-hidden']) {
    const h = fixture(kind); let decodes = 0;
    assert.deepEqual(await preflightImageReplacement(h.pkg, h.target, input(), dependencies, { async decode() { decodes++; return decodePort.decode(); } }, valid, new AbortController().signal), { ok: false, code: 'unsupported' });
    assert.equal(decodes, 0);
  }
  const h = fixture(), abort = new AbortController(); let writes = 0;
  assert.deepEqual(await preflightImageReplacement(h.pkg, h.target, input(), { ...dependencies, writeOoxmlPackage() { writes++; throw new Error('unexpected'); } },
    { async decode() { abort.abort(); return decodePort.decode(); } }, valid, abort.signal), { ok: false, code: 'aborted' });
  assert.equal(writes, 0);
});

test('replacement resource limits refuse before allocation and serialization limits preserve original package', async () => {
  const h = fixture();
  const crowded = { ...h.pkg, partBytes: new Map(h.pkg.partBytes) };
  for (let index = crowded.partBytes.size; index < 2047; index++) crowded.partBytes.set(`/extra-${index}`, new Uint8Array());
  let allocations = 0;
  const CountingStore = class extends dependencies.TreePackageStore {
    constructor(...args: ConstructorParameters<typeof dependencies.TreePackageStore>) { allocations++; super(...args); }
  };
  assert.deepEqual(await preflightImageReplacement(crowded, h.target, input(), { ...dependencies, TreePackageStore: CountingStore },
    decodePort, valid, new AbortController().signal), { ok: false, code: 'resource-limit' });
  assert.equal(allocations, 0);
  const before = structuredClone(h.pkg);
  assert.deepEqual(await preflightImageReplacement(h.pkg, h.target, input(), {
    ...dependencies, writeOoxmlPackage: () => new Uint8Array(16 * 1024 * 1024 + 1),
    readZip() { throw new Error('oversized package must not reach ZIP reader'); },
  }, decodePort, valid, new AbortController().signal), { ok: false, code: 'resource-limit' });
  assert.deepEqual(h.pkg, before);
});

test('replacement refuses original-owner drift during decode before serializing the isolated candidate', async () => {
  const h = fixture(), before = structuredClone(h.pkg); let current = true, writes = 0;
  const authority = (): DocxResult<void> => current ? valid() : { ok: false, code: 'stale-selection' };
  const result = await preflightImageReplacement(h.pkg, h.target, input(), {
    ...dependencies, writeOoxmlPackage() { writes++; throw new Error('stale intent must not reach serialization'); },
  }, { async decode() { current = false; return decodePort.decode(); } }, authority, new AbortController().signal);
  assert.deepEqual(result, { ok: false, code: 'stale-selection' });
  assert.equal(writes, 0); assert.deepEqual(h.pkg, before);
});
test('replacement dependency exceptions preserve the original package and prefer current intent refusals', async t => {
  for (const stage of ['store', 'serialization', 'zip'] as const) {
    for (const intent of ['current', 'stale', 'aborted', 'stale-and-aborted'] as const) {
      await t.test(`${stage}: ${intent}`, async () => {
        const h = fixture(), before = structuredClone(h.pkg), abort = new AbortController();
        let current = true, failures = 0;
        const fail = (): never => {
          failures++;
          if (intent === 'stale' || intent === 'stale-and-aborted') current = false;
          if (intent === 'aborted' || intent === 'stale-and-aborted') abort.abort();
          throw new Error('dependency failed');
        };
        const ThrowingStore = class extends dependencies.TreePackageStore {
          constructor(...args: ConstructorParameters<typeof dependencies.TreePackageStore>) { super(...args); fail(); }
        };
        const result = await preflightImageReplacement(h.pkg, h.target, input(), {
          ...dependencies,
          ...(stage === 'store' ? { TreePackageStore: ThrowingStore } : {}),
          ...(stage === 'serialization' ? { writeOoxmlPackage: fail } : {}),
          ...(stage === 'zip' ? { readZip: fail } : {}),
        }, decodePort, () => current ? valid() : { ok: false, code: 'stale-selection' }, abort.signal);
        const code = intent === 'current' ? 'engine-failed' : intent === 'aborted' ? 'aborted' : 'stale-selection';
        assert.deepEqual(result, { ok: false, code });
        assert.equal(failures, 1); assert.deepEqual(h.pkg, before);
      });
    }
  }
});
test('replacement input copies only the visible byte range and refuses foreign or accessor-backed options', () => {
  const original = imageInsertionBytes('png'), backing = new Uint8Array(original.length + 8); backing.set(original, 4);
  const result = normalizeImageReplacement(backing.subarray(4, -4), {}, valid); assert(result.ok);
  backing.fill(0); assert.deepEqual(result.value.source.bytes, original); assert.deepEqual(Object.keys(result.value.source), ['bytes', 'metadata']);
  let reads = 0;
  assert.deepEqual(normalizeImageReplacement(original, { get signal() { reads++; return undefined; } }, valid), { ok: false, code: 'invalid-option' });
  assert.equal(reads, 0); assert.deepEqual(normalizeImageReplacement(new Uint16Array(2), {}, valid), { ok: false, code: 'invalid-option' });
});

test('the public core replacement preserves opaque parts and changes only one shared resource reference in one undo', async () => {
  const h = fixture(), source = input('jpeg'), before = store.writeOoxmlPackage(h.pkg);
  const engine = new store.TreePackageStore(h.pkg, h.pkg.parts.get(h.pkg.mainDocumentPart)!, { historyLimit: 10 });
  const result = await engine.replaceImage({ kind: 'body' }, h.target.drawingId, source.bytes, source.metadata.mimeType, decodePort, { expectedPackageRevision: 0 });
  assert(result.ok && result.change);
  const after = engine.currentPackage();
  for (const [name, bytes] of h.pkg.partBytes) if (name.startsWith('/custom')) assert.deepEqual(after.partBytes.get(name), bytes, name);
  const images = imageCandidatesInPackage(after, after.parts.get(after.mainDocumentPart)!); assert(images.ok);
  assert.equal(images.value.length, 2); assert.deepEqual(images.value[0], h.target);
  assert.deepEqual(drawingMedia(after, images.value[0]!.drawingId), source.bytes);
  assert.deepEqual(drawingMedia(after, images.value[1]!.drawingId), drawingMedia(h.pkg, h.target.drawingId));
  assert(engine.undo()); assert.deepEqual(store.writeOoxmlPackage(engine.currentPackage()), before); assert.equal(engine.undo(), null);
  assert(engine.redo()); assert.deepEqual(store.writeOoxmlPackage(engine.currentPackage()), store.writeOoxmlPackage(after));
});
