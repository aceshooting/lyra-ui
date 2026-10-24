import { expect } from '@open-wc/testing';
import { DOCX_ZIP_LIMITS, DocxZipAdmissionError, inspectDocxZip } from './docx-zip-admission.js';
import {
  assembleZip, centralRecord, concatBytes, endRecord, localRecord, zipEntry,
  type ZipFixtureEntry,
} from '../components/viewers/archive-viewer/fixtures/zip-builder.js';

function inspect(bytes: Uint8Array) {
  return inspectDocxZip(bytes, undefined, false);
}

function reject(bytes: Uint8Array, code: 'invalid-document' | 'resource-limit' = 'invalid-document'): void {
  expect(() => inspect(bytes)).to.throw(DocxZipAdmissionError, code);
}

function rewrite(bytes: Uint8Array, at: number, value: number, width: 2 | 4 = 4): Uint8Array {
  const changed = bytes.slice();
  const view = new DataView(changed.buffer);
  if (width === 2) view.setUint16(at, value, true);
  else view.setUint32(at, value, true);
  return changed;
}

function single(entry: ZipFixtureEntry, local = localRecord(entry), central = centralRecord(entry, 0)): Uint8Array {
  return concatBytes(local, central, endRecord({ records: 1, directoryOffset: local.length, directorySize: central.length }));
}

describe('DOCX ZIP record boundaries', () => {
  it('accepts reordered central records while requiring contiguous, non-overlapping local entries', async () => {
    const first = await zipEntry('word/document.xml', '<document/>');
    const second = await zipEntry('word/styles.xml', '<styles/>');
    const firstLocal = localRecord(first), secondLocal = localRecord(second);
    const local = concatBytes(firstLocal, secondLocal);
    const directory = concatBytes(centralRecord(second, firstLocal.length), centralRecord(first, 0));
    const valid = concatBytes(local, directory, endRecord({ records: 2, directoryOffset: local.length, directorySize: directory.length }));
    expect(inspect(valid).map(entry => entry.name)).to.deep.equal([second.name, first.name]);

    const prefixed = concatBytes(new Uint8Array([0]), firstLocal);
    reject(single(first, prefixed, centralRecord(first, 1)));
    const padding = concatBytes(firstLocal, new Uint8Array([0]));
    reject(single(first, padding));
    const duplicateOffset = rewrite(valid, local.length + directory.length - centralRecord(first, 0).length + 42, firstLocal.length);
    reject(duplicateOffset);
  });

  it('rejects multi-volume and ZIP64 directory declarations instead of treating them as ordinary archives', async () => {
    const bytes = single(await zipEntry('word/document.xml', '<document/>'));
    const end = bytes.length - 22;
    expect(inspect(bytes).map(entry => entry.name)).to.deep.equal(['word/document.xml']);
    for (const offset of [4, 6, 8]) reject(rewrite(bytes, end + offset, 2, 2));
    let zip64 = rewrite(bytes, end + 8, 65535, 2);
    zip64 = rewrite(zip64, end + 10, 65535, 2);
    reject(zip64);
    for (const offset of [12, 16]) reject(rewrite(bytes, end + offset, 0xffffffff));
    reject(rewrite(bytes, end + 12, 0));
  });

  it('rejects incomplete central records, incorrect signatures and trailing directory bytes', async () => {
    const entry = await zipEntry('word/document.xml', '<document/>');
    const local = localRecord(entry), directory = centralRecord(entry, 0);
    reject(single(entry, local, directory.subarray(0, 45)));
    reject(single(entry, local, rewrite(directory, 0, 0)));
    for (const offset of [28, 30, 32]) reject(single(entry, local, rewrite(directory, offset, 65535, 2)));
    reject(single(entry, local, concatBytes(directory, new Uint8Array([0]))));
  });

  it('rejects unsupported central entry flags, methods, disks and ZIP64 entry fields', async () => {
    const entry = await zipEntry('word/document.xml', '<document/>');
    const local = localRecord(entry), directory = centralRecord(entry, 0);
    for (const [offset, value] of [[8, 1], [10, 99], [34, 1]] as const) {
      reject(single(entry, local, rewrite(directory, offset, value, 2)));
    }
    for (const offset of [20, 24, 42]) reject(single(entry, local, rewrite(directory, offset, 0xffffffff)));
  });

  it('requires valid UTF-8 naming, unique case-insensitive paths and empty directory entries', async () => {
    const unicode = await zipEntry('word/résumé.xml', '<document/>');
    reject(single(unicode));
    const encoded = single(unicode, localRecord(unicode, { flags: 0x800 }), centralRecord(unicode, 0, { flags: 0x800 }));
    expect(inspect(encoded).map(entry => entry.name)).to.deep.equal([unicode.name]);
    for (const name of ['../document.xml', '/word/document.xml', 'word//document.xml', 'word/document.xml?query']) {
      reject(single(await zipEntry(name, '<document/>')));
    }
    const upper = await zipEntry('word/Document.xml', '<document/>');
    const lower = await zipEntry('word/document.xml', '<document/>');
    reject(new Uint8Array(assembleZip([upper, lower])));
    reject(single(await zipEntry('word/', 'unexpected data')));
    const directory = single(await zipEntry('word/', ''));
    expect(inspect(directory).map(entry => ({ name: entry.name, size: entry.size }))).to.deep.equal([{ name: 'word/', size: 0 }]);
  });

  it('requires the local header identity and declared extent to agree with the directory', async () => {
    const entry = await zipEntry('word/document.xml', '<document/>');
    const local = localRecord(entry), directory = centralRecord(entry, 0);
    reject(single(entry, local, rewrite(directory, 42, local.length)));
    reject(single(entry, rewrite(local, 0, 0)));
    reject(single(entry, rewrite(local, 6, 0x800, 2)));
    reject(single(entry, rewrite(local, 8, 8, 2)));
    reject(single(entry, localRecord(entry, { name: 'word/other.xml' })));
    reject(single(entry, localRecord(entry, { name: 'word/Document.xml' })));
    reject(single(entry, rewrite(local, 28, 65535, 2)));
    for (const offset of [14, 18, 22]) reject(single(entry, rewrite(local, offset, 1234)));
    const larger = { ...entry, compressedSize: entry.compressedSize + 1 };
    reject(single(larger));
    const unequal = { ...entry, uncompressedSize: entry.uncompressedSize + 1 };
    reject(single(unequal));
  });

  it('enforces input, entry-count, individual expansion and aggregate expansion limits before decoding payloads', async () => {
    reject(new Uint8Array(DOCX_ZIP_LIMITS.input + 1), 'resource-limit');
    const entry = await zipEntry('word/document.xml', '<document/>');
    const bytes = single(entry), end = bytes.length - 22;
    let many = rewrite(bytes, end + 8, DOCX_ZIP_LIMITS.entries + 1, 2);
    many = rewrite(many, end + 10, DOCX_ZIP_LIMITS.entries + 1, 2);
    reject(many, 'resource-limit');
    reject(single({ ...entry, method: 8, uncompressedSize: DOCX_ZIP_LIMITS.entry + 1 }), 'resource-limit');
    const expanded = Array.from({ length: 4 }, (_, index) => ({
      ...entry, name: `word/part-${index}.xml`, method: 8, uncompressedSize: DOCX_ZIP_LIMITS.entry,
    }));
    const atLimit = new Uint8Array(assembleZip(expanded));
    expect(inspect(atLimit).reduce((sum, item) => sum + item.size, 0)).to.equal(DOCX_ZIP_LIMITS.expanded);
    reject(new Uint8Array(assembleZip([...expanded, { ...entry, method: 8, name: 'word/overflow.xml', uncompressedSize: 1 }])), 'resource-limit');
  });
});
