import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeImageInsertion } from './image-insertion-input.js';
import { imageFixture } from '../../test/corpus.js';
import { unzipSync } from 'fflate';
import type { DocxResult } from './types.js';

const png = () => Object.entries(unzipSync(imageFixture('image-simple'))).find(([name]) => name.endsWith('.png'))![1];
const source = () => ({ bytes: png(), widthPoints: 48, heightPoints: 24 });
const valid = (): DocxResult<void> => ({ ok: true, value: undefined });

test('insertion copies only intrinsic visible bytes and freezes copied scalar values before publication', () => {
  const bytes = png(), backing = new Uint8Array(bytes.length + 100);
  backing.set(bytes, 20);
  const visible = backing.subarray(20, 20 + bytes.length);
  Object.defineProperties(visible, { buffer: { get() { throw new Error('overridden buffer'); } },
    byteLength: { get() { throw new Error('overridden length'); } }, slice: { value() { throw new Error('overridden slice'); } } });
  const result = normalizeImageInsertion({ ...source(), bytes: visible, title: 'A & 😀', description: 'line\nnext\tline' }, {}, valid);
  assert(result.ok); assert.deepEqual(result.value.source.bytes, bytes);
  assert.equal(result.value.source.bytes.buffer.byteLength, bytes.length);
  backing.fill(0); assert.deepEqual(result.value.source.bytes, bytes);
  assert.equal(result.value.source.metadata.pixelWidth, 64); assert.equal(result.value.source.metadata.pixelHeight, 32);
  assert.equal(result.value.source.title, 'A & 😀'); assert(Object.isFrozen(result.value.source));
});

test('insertion rejects hostile shapes without invoking getters, coercions or custom byte methods', () => {
  let reads = 0;
  for (const value of [null, [], Object.assign(Object.create({}), source()), { ...source(), extra: 1 },
    { ...source(), [Symbol('hidden')]: 1 }, Object.defineProperty(source(), 'title', { get() { reads++; return ''; } }),
    { ...source(), widthPoints: { valueOf() { reads++; return 48; } } }, { ...source(), bytes: new Proxy(png(), {}) }]) {
    assert.deepEqual(normalizeImageInsertion(value, {}, valid), { ok: false, code: 'invalid-option' });
  }
  assert.equal(reads, 0);
});

test('every caller reflection boundary revalidates original intent before inspecting another descriptor', () => {
  for (const boundary of ['getPrototypeOf', 'ownKeys', 'getOwnPropertyDescriptor'] as const) {
    let stale = false, afterInvalidation = 0;
    const target = source();
    const proxy = new Proxy(target, {
      getPrototypeOf(object) { if (stale) afterInvalidation++; if (boundary === 'getPrototypeOf') stale = true; return Reflect.getPrototypeOf(object); },
      ownKeys(object) { if (stale) afterInvalidation++; if (boundary === 'ownKeys') stale = true; return Reflect.ownKeys(object); },
      getOwnPropertyDescriptor(object, key) { if (stale) afterInvalidation++; if (boundary === 'getOwnPropertyDescriptor') stale = true; return Reflect.getOwnPropertyDescriptor(object, key); }
    });
    assert.deepEqual(normalizeImageInsertion(proxy, {}, () => stale ? { ok: false, code: 'stale-selection' } : valid()),
      { ok: false, code: 'stale-selection' }, boundary);
    assert.equal(afterInvalidation, 0, boundary);
  }
  let destroyed = false;
  const throws = new Proxy({}, { ownKeys() { destroyed = true; throw new Error('caller'); } });
  assert.deepEqual(normalizeImageInsertion(source(), throws, () => destroyed ? { ok: false, code: 'destroyed' } : valid()),
    { ok: false, code: 'destroyed' });
});

test('insertion dimensions and metadata retain exact boundaries without CR normalization', () => {
  for (const axis of ['widthPoints', 'heightPoints']) for (const value of [undefined, 0, 1440.0001, NaN, Infinity, '12']) {
    assert.deepEqual(normalizeImageInsertion({ ...source(), [axis]: value }, {}, valid), { ok: false, code: 'invalid-option' });
  }
  for (const [key, maximum] of [['title', 256], ['description', 2048]] as const) {
    assert(normalizeImageInsertion({ ...source(), [key]: 'x'.repeat(maximum) }, {}, valid).ok);
    for (const value of [undefined, 'x'.repeat(maximum + 1), '\r', '\r\n', '\ud800', '\u0000']) {
      assert.deepEqual(normalizeImageInsertion({ ...source(), [key]: value }, {}, valid), { ok: false, code: 'invalid-option' });
    }
  }
  for (const value of [1, 1440, 120.123456]) assert(normalizeImageInsertion({ ...source(), widthPoints: value, heightPoints: value }, {}, valid).ok);
});

test('insertion brands native fixed buffers and signals without trusting caller properties', () => {
  for (const [bytes, code] of [
    [new Uint8Array(new SharedArrayBuffer(100)), 'invalid-option'],
    [new Uint8Array(Reflect.construct(ArrayBuffer, [100, { maxByteLength: 200 }])), 'invalid-option'],
    [new Uint16Array(100), 'invalid-option'], [new Uint8Array(0), 'resource-limit'], [new Uint8Array(4194305), 'resource-limit']
  ] as const) {
    const result = normalizeImageInsertion({ ...source(), bytes }, {}, valid); assert(!result.ok);
    assert.equal(result.code, code);
  }
  const detached = png(); structuredClone(detached.buffer, { transfer: [detached.buffer] });
  assert.deepEqual(normalizeImageInsertion({ ...source(), bytes: detached }, {}, valid), { ok: false, code: 'invalid-option' });
  const controller = new AbortController();
  assert(normalizeImageInsertion(source(), { signal: controller.signal }, valid).ok);
  controller.abort(); assert.deepEqual(normalizeImageInsertion(source(), { signal: controller.signal }, valid), { ok: false, code: 'aborted' });
  assert.deepEqual(normalizeImageInsertion(source(), { signal: { aborted: false } }, valid), { ok: false, code: 'invalid-option' });
});

test('insertion expected revision is an independently copied own-data record with guarded reflection', () => {
  const revision = { documentId: 'document', value: 3 };
  const accepted = normalizeImageInsertion(source(), { expectedRevision: revision }, valid); assert(accepted.ok);
  revision.value = 99; assert.deepEqual(accepted.value.options.expectedRevision, { documentId: 'document', value: 3 });
  assert(Object.isFrozen(accepted.value.options.expectedRevision));
  let sourceReads = 0;
  const guardedSource = new Proxy(source(), { ownKeys(target) { sourceReads++; return Reflect.ownKeys(target); } });
  for (const expectedRevision of [null, {}, { documentId: '', value: 0 }, { documentId: 'x'.repeat(129), value: 0 },
    { documentId: 'd', value: -1 }, { documentId: 'd', value: 1.5 }, { documentId: 'd', value: NaN },
    Object.defineProperty({ value: 1 }, 'documentId', { get() { throw new Error('must not read accessor'); } })]) {
    assert.deepEqual(normalizeImageInsertion(guardedSource, { expectedRevision }, valid), { ok: false, code: 'invalid-option' });
  }
  assert.equal(sourceReads, 0);
  let stale = false;
  const hostile = new Proxy({ documentId: 'd', value: 1 }, { getOwnPropertyDescriptor(target, key) {
    stale = true; return Reflect.getOwnPropertyDescriptor(target, key);
  } });
  assert.deepEqual(normalizeImageInsertion(guardedSource, { expectedRevision: hostile }, () => stale ? { ok: false, code: 'stale-selection' } : valid()), { ok: false, code: 'stale-selection' });
  assert.equal(sourceReads, 0);
});
