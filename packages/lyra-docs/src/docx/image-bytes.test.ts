import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crc32, deflateSync } from 'node:zlib';
import { inspectDocxImage } from './image-bytes.js';

const invalid = { ok: false, code: 'invalid-document' };
const signature = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
function chunk(name: string, data = new Uint8Array()): Uint8Array {
  const bytes = new Uint8Array(data.length + 12), view = new DataView(bytes.buffer);
  view.setUint32(0, data.length);
  bytes.set(new TextEncoder().encode(name), 4); bytes.set(data, 8);
  view.setUint32(bytes.length - 4, crc32(bytes.subarray(4, bytes.length - 4)));
  return bytes;
}
function header(depth = 8, color = 6, compression = 0, filter = 0, interlace = 0): Uint8Array {
  const data = Uint8Array.of(0, 0, 0, 1, 0, 0, 0, 1, depth, color, compression, filter, interlace);
  return chunk('IHDR', data);
}
const compressed = new Uint8Array(deflateSync(Uint8Array.of(0, 0, 0, 0, 255)));
const end = () => chunk('IEND');
function png(parts = [header(), chunk('IDAT', compressed), end()]): Uint8Array {
  return new Uint8Array(Buffer.concat([signature, ...parts]));
}
const accepted = { ok: true, value: { pixels: 1, mimeType: 'image/png' } };

test('checksummed static PNG inspection preserves a nonzero-offset input view', () => {
  const bytes = png(), backing = new Uint8Array(bytes.length + 12); backing.set(bytes, 5);
  const before = backing.slice();
  assert.deepEqual(inspectDocxImage(backing.subarray(5, 5 + bytes.length)), accepted);
  assert.deepEqual(backing, before);
  assert.deepEqual(inspectDocxImage(png([header(), chunk('tEXt', Uint8Array.of(65, 0, 66)), chunk('IDAT', compressed), end()])), accepted);
});

test('rejects corrupt CRC in every PNG chunk including opaque ancillary data', () => {
  const parts = [header(), chunk('tEXt', Uint8Array.of(65, 0, 66)), chunk('IDAT', compressed), end()];
  for (let index = 0; index < parts.length; index++) {
    const changed = parts.map(part => part.slice());
    const target = changed[index]!; target[target.length - 1] = target[target.length - 1]! ^ 1;
    assert.deepEqual(inspectDocxImage(png(changed)), invalid, `chunk ${index}`);
  }
});

test('validates IHDR length, uniqueness, fields and color-depth combinations', () => {
  const combinations: Record<number, readonly number[]> = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
  for (const color of [0, 1, 2, 3, 4, 5, 6, 7]) for (const depth of [0, 1, 2, 4, 8, 16, 32]) {
    const parts = [header(depth, color)];
    if (color === 3) parts.push(chunk('PLTE', Uint8Array.of(0, 0, 0)));
    parts.push(chunk('IDAT', compressed), end());
    assert.equal(inspectDocxImage(png(parts)).ok, combinations[color]?.includes(depth) ?? false, `${color}/${depth}`);
  }
  for (const length of [12, 14]) {
    const data = new Uint8Array(length); data.set(header().subarray(8, 8 + Math.min(length, 13)));
    assert.deepEqual(inspectDocxImage(png([chunk('IHDR', data), chunk('IDAT', compressed), end()])), invalid);
  }
  for (const fields of [[1, 0, 0], [0, 1, 0], [0, 0, 2]]) {
    assert.deepEqual(inspectDocxImage(png([header(8, 6, ...fields as [number, number, number]), chunk('IDAT', compressed), end()])), invalid);
  }
  assert.deepEqual(inspectDocxImage(png([header(), header(), chunk('IDAT', compressed), end()])), invalid);
  assert.deepEqual(inspectDocxImage(png([chunk('tEXt'), header(), chunk('IDAT', compressed), end()])), invalid);
  assert.deepEqual(inspectDocxImage(png([header(8, 6, 0, 0, 1), chunk('IDAT', compressed), end()])), accepted);
});

test('requires legal PLTE presence, size, order and indexed palette capacity', () => {
  const palette = chunk('PLTE', Uint8Array.of(0, 0, 0));
  for (const parts of [
    [header(1, 3), chunk('IDAT', compressed), end()],
    [header(), palette, palette, chunk('IDAT', compressed), end()],
    [header(), chunk('IDAT', compressed), palette, end()],
    [header(8, 0), palette, chunk('IDAT', compressed), end()],
    [header(8, 4), palette, chunk('IDAT', compressed), end()],
    ...[0, 2, 769].map(length => [header(), chunk('PLTE', new Uint8Array(length)), chunk('IDAT', compressed), end()]),
    [header(1, 3), chunk('PLTE', new Uint8Array(9)), chunk('IDAT', compressed), end()]
  ]) assert.deepEqual(inspectDocxImage(png(parts)), invalid);
  assert.deepEqual(inspectDocxImage(png([header(8, 2), palette, chunk('IDAT', compressed), end()])), accepted);
  assert.deepEqual(inspectDocxImage(png([header(8, 3), chunk('PLTE', new Uint8Array(768)), chunk('IDAT', compressed), end()])), accepted);
});

test('requires contiguous image data and an empty terminal IEND, refusing unknown critical chunks', () => {
  for (const parts of [
    [header(), end()], [header(), chunk('IDAT'), end()],
    [header(), chunk('IDAT', compressed), chunk('tEXt'), chunk('IDAT', compressed), end()],
    [header(), chunk('IDAT', compressed), chunk('IEND', Uint8Array.of(0))],
    [header(), chunk('IDAT', compressed), end(), end()],
    [header(), chunk('ABCD'), chunk('IDAT', compressed), end()],
    [header(), chunk('abca'), chunk('IDAT', compressed), end()],
    [header(), chunk('a1CD'), chunk('IDAT', compressed), end()],
    ...['acTL', 'fcTL', 'fdAT'].map(name => [header(), chunk(name), chunk('IDAT', compressed), end()])
  ]) assert.deepEqual(inspectDocxImage(png(parts)), invalid);
  assert.deepEqual(inspectDocxImage(png([header(), chunk('vpAg'), chunk('IDAT'), chunk('IDAT', compressed), chunk('IDAT'), end()])), accepted);
});

test('checks zlib header even when split across IDAT chunks without inflating pixels', () => {
  for (const [first, second] of [[0, 0], [0x88, 0x1c], [0x78, 0x00], [0x78, 0x20]]) {
    const data = compressed.slice(); data[0] = first!; data[1] = second!;
    assert.deepEqual(inspectDocxImage(png([header(), chunk('IDAT', data), end()])), invalid);
  }
  assert.deepEqual(inspectDocxImage(png([header(), chunk('IDAT', compressed.subarray(0, 1)), chunk('IDAT'), chunk('IDAT', compressed.subarray(1)), end()])), accepted);
  for (const length of [1, 2, 5]) assert.deepEqual(inspectDocxImage(png([header(), chunk('IDAT', compressed.subarray(0, length)), end()])), invalid);
});
