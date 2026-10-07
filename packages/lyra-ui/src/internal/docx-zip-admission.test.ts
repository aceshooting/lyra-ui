import { expect } from '@open-wc/testing';
import { DocxZipAdmissionError, inspectDocxZip } from './docx-zip-admission.js';
import {
  centralRecord, concatBytes, endRecord, extraField, localRecord, zipEntry,
  type ZipFixtureEntry,
} from '../components/viewers/archive-viewer/fixtures/zip-builder.js';

function archive(entry: ZipFixtureEntry, extra: Uint8Array = new Uint8Array(0), descriptor?: Uint8Array): Uint8Array {
  const flags = descriptor ? 8 : 0;
  const local = concatBytes(localRecord(entry, {
    flags, extra,
    ...(descriptor ? { crc: 0, compressedSize: 0, uncompressedSize: 0 } : {}),
  }), descriptor ?? new Uint8Array(0));
  const directory = centralRecord(entry, 0, { flags, extra });
  return concatBytes(local, directory, endRecord({
    records: 1, directoryOffset: local.length, directorySize: directory.length,
  }));
}

describe('DOCX ZIP admission', () => {
  it('admits bounded ordinary and matching Unicode extra fields in both headers', async () => {
    const entry = await zipEntry('word/document.xml', '<document/>');
    const unicode = concatBytes(new Uint8Array([1, 0, 0, 0, 0]), new TextEncoder().encode(entry.name));
    const fields = concatBytes(extraField(0xcafe, new Uint8Array([1, 2])), extraField(0x7075, unicode));
    const entries = inspectDocxZip(archive(entry, fields), undefined, false);
    expect(entries.map(({ name, size }) => ({ name, size }))).to.deep.equal([
      { name: entry.name, size: entry.uncompressedSize },
    ]);
  });

  it('rejects truncated, unsupported, and conflicting Unicode extra fields', async () => {
    const entry = await zipEntry('word/document.xml', '<document/>');
    const unicode = concatBytes(new Uint8Array([1, 0, 0, 0, 0]), new TextEncoder().encode('word/other.xml'));
    const overrun = extraField(0xcafe, new Uint8Array([1]));
    new DataView(overrun.buffer).setUint16(2, 2, true);
    for (const extra of [
      new Uint8Array([1, 2, 3]), overrun,
      extraField(1, new Uint8Array(0)), extraField(0x9901, new Uint8Array(0)),
      extraField(0x7075, new Uint8Array([1, 0, 0, 0])),
      extraField(0x7075, unicode),
      extraField(0x7075, concatBytes(new Uint8Array([2, 0, 0, 0, 0]), new TextEncoder().encode(entry.name))),
    ]) {
      expect(() => inspectDocxZip(archive(entry, extra), undefined, false)).to.throw(DocxZipAdmissionError, 'invalid-document');
    }
  });

  it('accepts signed and unsigned data descriptors and rejects missing or inconsistent fields', async () => {
    const entry = await zipEntry('word/document.xml', '<document/>');
    const descriptor = new Uint8Array(12);
    const view = new DataView(descriptor.buffer);
    view.setUint32(0, entry.crc, true);
    view.setUint32(4, entry.compressedSize, true);
    view.setUint32(8, entry.uncompressedSize, true);
    const signature = new Uint8Array([0x50, 0x4b, 0x07, 0x08]);
    for (const valid of [descriptor, concatBytes(signature, descriptor)]) {
      const entries = inspectDocxZip(archive(entry, undefined, valid), undefined, false);
      expect(entries.map(({ crc, packed, size }) => ({ crc, packed, size }))).to.deep.equal([
        { crc: entry.crc, packed: entry.compressedSize, size: entry.uncompressedSize },
      ]);
    }
    const wrongCrc = descriptor.slice();
    wrongCrc[0] = wrongCrc[0]! ^ 1;
    for (const invalid of [new Uint8Array(0), descriptor.subarray(0, 11), concatBytes(signature, descriptor.subarray(0, 8)), wrongCrc]) {
      expect(() => inspectDocxZip(archive(entry, undefined, invalid), undefined, false)).to.throw(DocxZipAdmissionError, 'invalid-document');
    }
  });
});
