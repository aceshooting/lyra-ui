import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pngChunk, pngCompressed, pngEnd, pngFile, pngHeader } from '../../test/png-fixtures.js';
import { inspectDocxImage, inspectDocxImageForInsertion, isDocxMetafileSignature } from './image-bytes.js';

const invalid = { ok: false, code: 'invalid-document' } as const;
const limited = { ok: false, code: 'resource-limit' } as const;
const unsupported = { ok: false, code: 'unsupported' } as const;
const concat = (...parts: readonly Uint8Array[]) => Uint8Array.from(parts.flatMap(part => [...part]));
const zeros = (length: number) => new Uint8Array(length);

test('input beyond the byte ceiling is a limit while unreadable input is an invalid document', () => {
  assert.deepEqual(inspectDocxImage(zeros(4 * 1024 * 1024 + 1)), limited);
  assert.deepEqual(inspectDocxImage(zeros(4 * 1024 * 1024)), invalid);
  const detached = pngFile(); structuredClone(detached.buffer, { transfer: [detached.buffer] });
  assert.deepEqual(inspectDocxImage(detached), invalid);
  assert.deepEqual(inspectDocxImage(null as unknown as Uint8Array), invalid);
});

test('a well-formed PNG with a zero dimension is not an image', () => {
  const image = (width: number, height: number) => pngFile([pngHeader(8, 6, 0, 0, 0, width, height), pngChunk('IDAT', pngCompressed), pngEnd()]);
  assert.equal(inspectDocxImage(image(2, 3)).ok, true);
  for (const [width, height] of [[0, 1], [1, 0], [0, 0]] as const) assert.deepEqual(inspectDocxImage(image(width, height)), invalid, `${width}x${height}`);
});

// A GIF is a 13-byte screen descriptor, image descriptors (10 bytes with their separator), data blocks and a trailer.
const screen = (width = 3, height = 2, packed = 0) => Uint8Array.of(71, 73, 70, 56, 57, 97, width & 255, width >> 8, height & 255, height >> 8, packed, 0, 0);
const frame = (width = 3, height = 2, packed = 0) => Uint8Array.of(44, 0, 0, 0, 0, width & 255, width >> 8, height & 255, height >> 8, packed);
const pixels = Uint8Array.of(2, 1, 0, 0);
const trailer = Uint8Array.of(59);

test('GIF screen and frame descriptors must be complete, non-empty and inside the screen', () => {
  const accepted = { ok: true, value: { mimeType: 'image/gif', pixelWidth: 3, pixelHeight: 2, pixels: 6, hasJpegApp1: false } };
  assert.deepEqual(inspectDocxImage(concat(screen(), frame(), pixels, trailer)), accepted);
  assert.equal(inspectDocxImage(concat(screen(), frame(2, 1), pixels, trailer)).ok, true, 'a smaller frame is inside the screen');
  for (const length of [10, 12]) assert.deepEqual(inspectDocxImage(screen().subarray(0, length)), invalid, `${length}-byte header`);
  for (const [width, height] of [[0, 2], [3, 0], [4, 2], [3, 3]] as const) {
    assert.deepEqual(inspectDocxImage(concat(screen(), frame(width, height), pixels, trailer)), invalid, `${width}x${height} frame`);
  }
});

test('GIF data blocks must fit inside the file', () => {
  for (const blocks of [Uint8Array.of(2, 5, 1, 2), Uint8Array.of(2, 1)]) {
    assert.deepEqual(inspectDocxImage(concat(screen(), frame(), blocks)), invalid, `[${[...blocks]}]`);
  }
});

test('GIF local color tables are skipped by their declared size', () => {
  const accepted = (table: number, packed: number) => inspectDocxImage(concat(screen(), frame(3, 2, packed), zeros(table), pixels, trailer));
  assert.equal(accepted(6, 0x80).ok, true, 'two entries');
  assert.equal(accepted(12, 0x81).ok, true, 'four entries');
  assert.deepEqual(inspectDocxImage(concat(screen(), frame(3, 2, 0x87), zeros(6), pixels, trailer)), invalid, 'a table cut short');
  assert.deepEqual(inspectDocxImage(concat(screen(), frame(3, 2, 0x80), zeros(12), pixels, trailer)), invalid, 'a table larger than declared');
});

const segment = (marker: number, payload: readonly number[] | Uint8Array) =>
  Uint8Array.of(0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 255, ...payload);
const soi = Uint8Array.of(0xff, 0xd8), eoi = Uint8Array.of(0xff, 0xd9);
const exif = segment(0xe1, [69, 120, 105, 102, 0, 0]);
const frameHeader = segment(0xc0, [8, 0, 2, 0, 3, 1, 1, 0x11, 0]);
const scan = concat(segment(0xda, [1, 1, 0, 0, 63, 0]), Uint8Array.of(42));

test('metadata stripping refuses a JPEG whose framing it cannot walk like the inspector does', () => {
  const plain = concat(soi, exif, frameHeader, scan, eoi);
  const stripped = inspectDocxImageForInsertion(plain);
  assert(stripped.ok); assert.deepEqual(stripped.value.bytes, concat(soi, frameHeader, scan, eoi));
  // A standalone marker and 0xFF padding are legal framing the stripper does not understand.
  for (const framing of [Uint8Array.of(0xff, 0x01), Uint8Array.of(0xff)]) {
    const bytes = concat(soi, exif, framing, frameHeader, scan, eoi), inspected = inspectDocxImage(bytes);
    assert(inspected.ok); assert.equal(inspected.value.hasJpegApp1, true);
    assert.deepEqual(inspectDocxImageForInsertion(bytes), unsupported, `[${[...framing]}]`);
  }
});

// After the EXIF segment, a padded reserved marker (0xFF 0xFF 0x02 with one payload byte) is legal: the inspector skips the
// padding and steps over the 3-byte segment. The stripper reads 0xFF as the marker and 0x0200 as its length instead, so it
// continues 514 bytes after the padding, wherever that lands.
const padded = Uint8Array.of(0xff, 0xff, 0x02, 0x00, 0x03, 0x00);
const paddingStart = soi.length + exif.length;
const landing = paddingStart + 2 + 0x0200;
const commentStart = paddingStart + padded.length + 4;
const paddedJpeg = (comment: Uint8Array) => concat(soi, exif, padded, segment(0xfe, comment), frameHeader, scan, eoi);
const hiddenAtLanding = (...hidden: number[]) => { const comment = zeros(600); comment.set(hidden, landing - commentStart); return comment; };

test('metadata stripping refuses a JPEG whose padded marker sends its walk off a segment boundary', () => {
  const withoutComment = paddedJpeg(zeros(0)).length;
  const cases = [
    ['onto a byte that starts no segment', paddedJpeg(hiddenAtLanding(0x00, 0xda))],
    ['two bytes before the end of the file', paddedJpeg(zeros(landing + 2 - withoutComment))],
  ] as const;
  assert.equal(cases[1][1].length, landing + 2);
  for (const [label, bytes] of cases) {
    const inspected = inspectDocxImage(bytes);
    assert(inspected.ok, label); assert.equal(inspected.value.hasJpegApp1, true, label);
    assert.deepEqual(inspectDocxImageForInsertion(bytes), unsupported, label);
  }
});

test('metadata stripping that would cut inside another segment reports the damaged image', () => {
  // The comment hides bytes that look like an empty EXIF segment where the stripper lands, followed by a scan marker.
  const bytes = paddedJpeg(hiddenAtLanding(0xff, 0xe1, 0x00, 0x02, 0xff, 0xda));
  assert.equal(inspectDocxImage(bytes).ok, true);
  assert.deepEqual(inspectDocxImageForInsertion(bytes), invalid);
});

test('metafile signatures require their complete record header', () => {
  const emf = (patch: Record<number, number> = {}) => {
    const bytes = zeros(44); bytes.set([1, 0, 0, 0]); bytes.set([0x20, 0x45, 0x4d, 0x46], 40);
    for (const [index, value] of Object.entries(patch)) bytes[Number(index)] = value;
    return bytes;
  };
  assert.equal(isDocxMetafileSignature(emf()), true);
  for (const index of [0, 1, 2, 3, 40, 41, 42, 43]) assert.equal(isDocxMetafileSignature(emf({ [index]: 7 })), false, `EMF byte ${index}`);
  assert.equal(isDocxMetafileSignature(emf().subarray(0, 43)), false, 'a record header cut short');
  for (const header of [[0xd7, 0xcd, 0xc6, 0x9a], [1, 0, 9, 0], [2, 0, 9, 0], [0x1f, 0x8b]]) assert.equal(isDocxMetafileSignature(Uint8Array.from(header)), true, `[${header}]`);
  for (const header of [[0xd7, 0xcd, 0xc6, 0x9b], [3, 0, 9, 0], [1, 1, 9, 0], [1, 0, 8, 0], [1, 0, 9, 1], [0x1f, 0x8c], []]) {
    assert.equal(isDocxMetafileSignature(Uint8Array.from(header)), false, `[${header}]`);
  }
});
