import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Zip, ZipPassThrough, unzipSync, zipSync } from 'fflate';
import { crc32 } from 'node:zlib';
import { admitDocx } from './admission.js';
import { docxFixture } from '../../test/admission-fixtures.js';

const accepted = { ok: true, value: undefined };
const invalid = { ok: false, code: 'invalid-document' };
const limited = { ok: false, code: 'resource-limit' };

function concatenate(chunks: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

function streamingArchive(): Uint8Array {
  const chunks: Uint8Array[] = [];
  const archive = new Zip((error, chunk) => {
    if (error) throw error;
    chunks.push(chunk);
  });
  for (const [name, bytes] of Object.entries(unzipSync(docxFixture()))) {
    const entry = new ZipPassThrough(name);
    archive.add(entry);
    entry.push(bytes, true);
  }
  archive.end();
  return concatenate(chunks);
}

function descriptors(bytes: Uint8Array): { central: number; records: { at: number; local: number; descriptor: number }[] } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const central = view.getUint32(bytes.length - 6, true);
  const records = [];
  let at = central;
  for (let count = view.getUint16(bytes.length - 12, true); count > 0; count--) {
    const local = view.getUint32(at + 42, true);
    const descriptor = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true) + view.getUint32(at + 20, true);
    records.push({ at, local, descriptor });
    at += 46 + view.getUint16(at + 28, true) + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  return { central, records };
}

function unsignedDescriptors(bytes: Uint8Array): Uint8Array {
  const { central, records } = descriptors(bytes);
  const starts = records.map(record => record.descriptor).sort((a, b) => a - b);
  const shifted = (offset: number) => offset - starts.filter(start => start < offset).length * 4;
  const chunks = [];
  let offset = 0;
  for (const start of starts) {
    assert.equal(new DataView(bytes.buffer).getUint32(start, true), 0x08074b50);
    chunks.push(bytes.subarray(offset, start));
    offset = start + 4;
  }
  chunks.push(bytes.subarray(offset));
  const result = concatenate(chunks);
  const view = new DataView(result.buffer);
  for (const record of records) view.setUint32(shifted(record.at) + 42, shifted(record.local), true);
  view.setUint32(result.length - 6, shifted(central), true);
  return result;
}

test('accepts streamed ZIP records with signed and unsigned data descriptors without changing bytes', async () => {
  for (const bytes of [streamingArchive(), unsignedDescriptors(streamingArchive())]) {
    const original = bytes.slice();
    assert.deepEqual(await admitDocx(bytes), accepted);
    assert.deepEqual(bytes, original);
  }
});

test('refuses a streamed ZIP descriptor whose CRC or lengths contradict the central record', async () => {
  for (const field of [4, 8, 12]) {
    const bytes = streamingArchive();
    const descriptor = descriptors(bytes).records[0]!.descriptor;
    bytes[descriptor + field] = (bytes[descriptor + field] ?? 0) ^ 1;
    assert.deepEqual(await admitDocx(bytes), invalid);
  }
});

test('accepts bounded unknown ZIP metadata and rejects alternate names and unsupported encrypted or ZIP64 extras', async () => {
  const entries = unzipSync(docxFixture());
  for (const id of [0x5455, 0xcafe, 0x7075, 0x9901, 1]) {
    const bytes = zipSync(Object.fromEntries(Object.entries(entries)
      .map(([name, value]) => [name, [value, { extra: { [id]: Uint8Array.from([1, 0, 0, 0, 0]) } }]])), { level: 0 });
    assert.deepEqual(await admitDocx(bytes), id === 0x5455 || id === 0xcafe ? accepted : invalid);
  }
});

test('refuses truncated ZIP extra records and extra lengths exceeding their own envelope', async () => {
  for (const short of [true, false]) {
    const bytes = zipSync(Object.fromEntries(Object.entries(unzipSync(docxFixture()))
      .map(([name, value]) => [name, [value, { extra: { 0xcafe: Uint8Array.from([1, 2, 3]) } }]])), { level: 0 });
    const view = new DataView(bytes.buffer);
    const central = view.getUint32(bytes.length - 6, true);
    const extra = central + 46 + view.getUint16(central + 28, true);
    if (short) view.setUint16(central + 30, 2, true);
    else view.setUint16(extra + 2, 0xffff, true);
    assert.deepEqual(await admitDocx(bytes), invalid);
  }
});

// A 2-by-2 black JPEG encoded by the browser canvas JPEG encoder.
const jpeg = Uint8Array.from(Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAACAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJVAA//Z', 'base64'));

test('accepts a JPEG with bounded decoded dimensions and legal marker padding', async () => {
  assert.deepEqual(await admitDocx(docxFixture({ 'word/media/image.jpg': jpeg })), accepted);
  const padded = concatenate([jpeg.subarray(0, 2), Uint8Array.from([255]), jpeg.subarray(2)]);
  assert.deepEqual(await admitDocx(docxFixture({ 'word/media/image.jpg': padded })), accepted);
});

test('refuses malformed JPEG markers, truncated headers, impossible segments and oversized decoded images', async () => {
  const noMarker = jpeg.slice(); noMarker[2] = 0;
  const shortSegment = jpeg.slice(); new DataView(shortSegment.buffer).setUint16(4, 1);
  const hugeSegment = jpeg.slice(); new DataView(hugeSegment.buffer).setUint16(4, 0xffff);
  for (const bytes of [jpeg.subarray(0, 2), jpeg.subarray(0, 5), noMarker, shortSegment, hugeSegment,
    Uint8Array.from([255, 216, 255, 217]), Uint8Array.from([255, 216, 255, 218])]) {
    assert.deepEqual(await admitDocx(docxFixture({ 'word/media/image.jpg': bytes })), invalid);
  }
  const frame = jpeg.findIndex((byte, index) => byte === 255 && jpeg[index + 1] === 0xc0);
  assert.ok(frame >= 0);
  const huge = jpeg.slice();
  new DataView(huge.buffer).setUint16(frame + 5, 8193);
  assert.deepEqual(await admitDocx(docxFixture({ 'word/media/image.jpg': huge })), limited);
  const malformedFrame = jpeg.slice();
  new DataView(malformedFrame.buffer).setUint16(frame + 2, 7);
  assert.deepEqual(await admitDocx(docxFixture({ 'word/media/image.jpg': malformedFrame })), invalid);
});

test('refuses GIF extension data without its terminating zero-length subblock', async () => {
  const bytes = Uint8Array.from(Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64'));
  const unfinished = concatenate([bytes.subarray(0, 19), Uint8Array.from([33, 254, 1, 65])]);
  assert.deepEqual(await admitDocx(docxFixture({ 'word/media/image.gif': unfinished })), invalid);
});

test('admits an Info-ZIP Unicode path only when it spells the validated entry name', async () => {
  const entries = unzipSync(docxFixture());
  const unicodePath = (name: string, spelled = name) => {
    const encoded = new TextEncoder().encode(spelled), field = new Uint8Array(5 + encoded.length);
    field[0] = 1; new DataView(field.buffer).setUint32(1, crc32(name), true); field.set(encoded, 5);
    return field;
  };
  const build = (spell: (name: string) => string) => zipSync(Object.fromEntries(Object.entries(entries)
    .map(([name, value]) => [name, [value, { extra: { 0x7075: unicodePath(name, spell(name)) } }]])), { level: 0 });
  assert.deepEqual(await admitDocx(build(name => name)), accepted);
  assert.deepEqual(await admitDocx(build(name => name.replace('word', 'other'))), invalid);
});
