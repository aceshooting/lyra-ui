import { expect } from '@open-wc/testing';
import type { default as JSZipType } from 'jszip';
import { LyraResourceLimitError } from '../../../internal/resource-loader.js';
import {
  assertZipArchiveMetadataWithinLimits,
  assertZipArchiveWithinLimits,
  createXmlComplexityInspectorFactory,
  type ZipArchiveGuardOptions,
} from './zip-resource-guard.js';
import {
  centralRecord,
  concatBytes,
  crc32,
  endRecord,
  extraField,
  localRecord,
  toArrayBuffer,
  zipEntry,
} from './fixtures/zip-builder.js';

const CENTRAL_SIGNATURE = 0x02014b50;
const END_SIGNATURE = 0x06054b50;

async function buildZip(
  content = 'hello',
  compression: 'STORE' | 'DEFLATE' = 'STORE',
): Promise<ArrayBuffer> {
  const module = (await import('jszip')) as unknown as { default: new () => JSZipType };
  const zip = new module.default();
  zip.file('document.xml', content);
  const bytes = await zip.generateAsync({ type: 'uint8array', compression });
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function clone(source: ArrayBuffer): ArrayBuffer {
  return source.slice(0);
}

function findSignature(source: ArrayBuffer, signature: number, fromEnd = false): number {
  const view = new DataView(source);
  if (fromEnd) {
    for (let offset = source.byteLength - 4; offset >= 0; offset--) {
      if (view.getUint32(offset, true) === signature) return offset;
    }
  } else {
    for (let offset = 0; offset <= source.byteLength - 4; offset++) {
      if (view.getUint32(offset, true) === signature) return offset;
    }
  }
  throw new Error(`ZIP signature ${signature.toString(16)} was not found`);
}

function offsets(source: ArrayBuffer): { central: number; end: number; local: number } {
  const end = findSignature(source, END_SIGNATURE, true);
  const central = findSignature(source, CENTRAL_SIGNATURE);
  const local = new DataView(source).getUint32(central + 42, true);
  return { central, end, local };
}

const options: ZipArchiveGuardOptions = {
  description: 'test',
  maxEntries: 4,
  maxUncompressedBytes: 1_024,
};

async function expectLimit(
  source: ArrayBuffer,
  message: RegExp,
  overrides: Partial<ZipArchiveGuardOptions> = {},
): Promise<void> {
  try {
    await assertZipArchiveWithinLimits(source, { ...options, ...overrides });
    expect.fail('expected the ZIP guard to reject the archive');
  } catch (error) {
    expect(error).to.be.instanceOf(LyraResourceLimitError);
    expect((error as Error).message).to.match(message);
  }
}

describe('ZIP resource guard', () => {
  it('accepts a valid stored archive and streams its entry through an inspector', async () => {
    const source = await buildZip('<root><row><c>ok</c></row></root>');
    const chunks: string[] = [];
    let closed = 0;

    await assertZipArchiveWithinLimits(source, {
      ...options,
      createInspector: (entry) => {
        expect(entry.name).to.equal('document.xml');
        expect(entry.compressedBytes).to.equal(entry.uncompressedBytes);
        return {
          write: (chunk) => chunks.push(new TextDecoder().decode(chunk)),
          close: () => closed++,
        };
      },
    });

    expect(chunks.join('')).to.equal('<root><row><c>ok</c></row></root>');
    expect(closed).to.equal(1);
  });

  it('allows explicitly permitted non-ZIP payloads but rejects them in strict mode', async () => {
    await assertZipArchiveWithinLimits(new Uint8Array([1, 2]).buffer, {
      ...options,
      allowNonZip: true,
    });
    await assertZipArchiveWithinLimits(new Uint8Array([1, 2, 3, 4]).buffer, {
      ...options,
      allowNonZip: true,
    });
    await expectLimit(new Uint8Array([1, 2]).buffer, /malformed/);
    await expectLimit(new Uint8Array([1, 2, 3, 4]).buffer, /malformed/);
  });

  it('rejects missing end records and ZIP64 sentinel fields', async () => {
    const missingEnd = await buildZip();
    new DataView(missingEnd).setUint32(findSignature(missingEnd, END_SIGNATURE, true), 0, true);
    await expectLimit(missingEnd, /malformed/);

    for (const [field, value] of [[10, 0xffff], [12, 0xffffffff], [16, 0xffffffff]] as const) {
      const source = await buildZip();
      const { end } = offsets(source);
      const view = new DataView(source);
      if (field === 10) view.setUint16(end + field, value, true);
      else view.setUint32(end + field, value, true);
      await expectLimit(source, /ZIP64/);
    }
  });

  it('rejects multi-disk archives and excessive entry declarations', async () => {
    for (const mutate of [
      (view: DataView, end: number) => view.setUint16(end + 4, 1, true),
      (view: DataView, end: number) => view.setUint16(end + 6, 1, true),
      (view: DataView, end: number) => view.setUint16(end + 8, 0, true),
    ]) {
      const source = await buildZip();
      const { end } = offsets(source);
      mutate(new DataView(source), end);
      await expectLimit(source, /Multi-disk/);
    }

    const tooMany = await buildZip();
    const { end } = offsets(tooMany);
    const view = new DataView(tooMany);
    view.setUint16(end + 8, 5, true);
    view.setUint16(end + 10, 5, true);
    await expectLimit(tooMany, /too many entries/, { maxEntries: 4 });
  });

  it('rejects inconsistent central-directory bounds and records', async () => {
    const beyondEnd = await buildZip();
    {
      const { end } = offsets(beyondEnd);
      new DataView(beyondEnd).setUint32(end + 12, end + 1, true);
    }
    await expectLimit(beyondEnd, /malformed/);

    const badSignature = await buildZip();
    {
      const { central } = offsets(badSignature);
      new DataView(badSignature).setUint32(central, 0, true);
    }
    await expectLimit(badSignature, /malformed/);

    const truncatedRecord = await buildZip();
    {
      const { central } = offsets(truncatedRecord);
      new DataView(truncatedRecord).setUint16(central + 30, 0xffff, true);
    }
    await expectLimit(truncatedRecord, /malformed or uses ZIP64/);

    const trailingDirectoryByte = await buildZip();
    {
      const { end } = offsets(trailingDirectoryByte);
      const view = new DataView(trailingDirectoryByte);
      view.setUint32(end + 12, view.getUint32(end + 12, true) + 1, true);
    }
    await expectLimit(trailingDirectoryByte, /malformed/);

    const paddedDirectory = await buildZip();
    {
      const { end } = offsets(paddedDirectory);
      const expanded = new Uint8Array(paddedDirectory.byteLength + 1);
      expanded.set(new Uint8Array(paddedDirectory, 0, end));
      expanded.set(new Uint8Array(paddedDirectory, end), end + 1);
      const movedEnd = end + 1;
      const view = new DataView(expanded.buffer);
      view.setUint32(movedEnd + 12, view.getUint32(movedEnd + 12, true) + 1, true);
      await expectLimit(expanded.buffer, /malformed/);
    }
  });

  it('rejects empty, null-containing, and invalid UTF-8 entry names', async () => {
    for (const replacement of [0, 0xff]) {
      const source = await buildZip();
      const { central } = offsets(source);
      new Uint8Array(source)[central + 46] = replacement;
      await expectLimit(source, /invalid entry name/);
    }

    const empty = await buildZip();
    const { central } = offsets(empty);
    new DataView(empty).setUint16(central + 28, 0, true);
    await expectLimit(empty, /invalid entry name/);
  });

  it('rejects ZIP64 entry fields and declared expanded sizes above the budget', async () => {
    for (const field of [20, 24, 42]) {
      const source = await buildZip();
      const { central } = offsets(source);
      new DataView(source).setUint32(central + field, 0xffffffff, true);
      await expectLimit(source, /malformed or uses ZIP64/);
    }

    await expectLimit(await buildZip('12345'), /expanded test archive is too large/, {
      maxUncompressedBytes: 4,
    });
  });

  it('rejects malformed, encrypted, and inconsistent local headers', async () => {
    const badLocal = await buildZip();
    new DataView(badLocal).setUint32(offsets(badLocal).local, 0, true);
    await expectLimit(badLocal, /malformed/);

    for (const location of ['central', 'local'] as const) {
      const encrypted = await buildZip();
      const positions = offsets(encrypted);
      const view = new DataView(encrypted);
      view.setUint16(positions[location] + (location === 'central' ? 8 : 6), 1, true);
      await expectLimit(encrypted, /Encrypted/);
    }

    const mismatchedCompression = await buildZip();
    {
      const { local } = offsets(mismatchedCompression);
      new DataView(mismatchedCompression).setUint16(local + 8, 8, true);
    }
    await expectLimit(mismatchedCompression, /malformed/);

    const impossibleDataOffset = await buildZip();
    {
      const { local } = offsets(impossibleDataOffset);
      new DataView(impossibleDataOffset).setUint16(local + 26, 0xffff, true);
    }
    await expectLimit(impossibleDataOffset, /malformed/);

    const misplacedLocalHeader = await buildZip();
    {
      const { central } = offsets(misplacedLocalHeader);
      new DataView(misplacedLocalHeader).setUint32(central + 42, 1, true);
    }
    expect(() => assertZipArchiveMetadataWithinLimits(misplacedLocalHeader, options))
      .to.throw(LyraResourceLimitError, /malformed/);
    await expectLimit(clone(misplacedLocalHeader), /malformed/);
  });

  it('rejects unsupported compression and inconsistent stored entry sizes', async () => {
    const unsupported = await buildZip();
    {
      const { central, local } = offsets(unsupported);
      const view = new DataView(unsupported);
      view.setUint16(central + 10, 99, true);
      view.setUint16(local + 8, 99, true);
    }
    await expectLimit(unsupported, /unsupported compression/);

    const inconsistent = await buildZip('hello');
    {
      const { central, local } = offsets(inconsistent);
      new DataView(inconsistent).setUint32(central + 24, 6, true);
      new DataView(inconsistent).setUint32(local + 22, 6, true);
    }
    await expectLimit(inconsistent, /inconsistent entry sizes/);

    const measuredOverBudget = await buildZip('123456');
    {
      const { central, local } = offsets(measuredOverBudget);
      new DataView(measuredOverBudget).setUint32(central + 24, 5, true);
      new DataView(measuredOverBudget).setUint32(local + 22, 5, true);
    }
    await expectLimit(measuredOverBudget, /expanded test archive is too large/, {
      maxUncompressedBytes: 5,
    });
  });

  it('measures valid DEFLATE entries and rejects corrupt compressed data', async () => {
    let inspectorClosed = false;
    await assertZipArchiveWithinLimits(await buildZip('compress me '.repeat(50), 'DEFLATE'), {
      ...options,
      maxUncompressedBytes: 1_024,
      createInspector: () => ({
        write: () => undefined,
        close: () => {
          inspectorClosed = true;
        },
      }),
    });
    expect(inspectorClosed).to.equal(true);

    const corrupt = await buildZip('compress me '.repeat(20), 'DEFLATE');
    {
      const { central, local } = offsets(corrupt);
      const view = new DataView(corrupt);
      const dataOffset = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      const compressedBytes = view.getUint32(central + 20, true);
      new Uint8Array(corrupt, dataOffset, compressedBytes).fill(0xff);
    }
    await expectLimit(corrupt, /invalid compressed data/);
  });

  it('rejects an already-aborted validation before reading the payload', async () => {
    const controller = new AbortController();
    controller.abort();
    try {
      await assertZipArchiveWithinLimits(await buildZip(), { ...options, signal: controller.signal });
      expect.fail('expected abort');
    } catch (error) {
      expect((error as Error).name).to.equal('AbortError');
    }
  });

  it('accepts a genuinely empty ZIP (an end-of-central-directory record with zero entries)', async () => {
    // A valid empty ZIP has no local-file record at all -- byte zero is the end-of-central-
    // directory signature itself, a special case parseZipArchiveMetadata()'s own doc comment
    // calls out. Built directly (22-byte EOCD record) rather than via JSZip, since JSZip always
    // adds at least the caller's own files.
    const buffer = new ArrayBuffer(22);
    const view = new DataView(buffer);
    view.setUint32(0, END_SIGNATURE, true);
    view.setUint16(4, 0, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint32(12, 0, true);
    view.setUint32(16, 0, true);
    view.setUint16(20, 0, true);
    await assertZipArchiveWithinLimits(buffer, options);
    const metadata = assertZipArchiveMetadataWithinLimits(buffer, options);
    expect(metadata!.entries).to.have.lengthOf(0);
    expect(metadata!.totalUncompressedBytes).to.equal(0);
  });

  it('rejects a prefixed/polyglot payload carrying a ZIP signature after byte zero, even under allowNonZip', () => {
    // A ZIP signature at byte zero is the explicit non-ZIP passthrough; the same signature
    // appearing later is a disguised/polyglot ZIP and must still be rejected, not silently
    // treated as a permitted non-ZIP payload.
    const source = new Uint8Array([0, 0, 0, 0, 0x50, 0x4b, 0x03, 0x04]).buffer;
    expect(() => assertZipArchiveMetadataWithinLimits(source, { ...options, allowNonZip: true }))
      .to.throw(LyraResourceLimitError, /malformed/);
  });

  it('accepts exactly maxEntries entries and rejects one entry beyond it', async () => {
    const module = (await import('jszip')) as unknown as { default: new () => JSZipType };
    const atLimit = new module.default();
    for (let index = 0; index < 4; index++) atLimit.file(`f${index}.xml`, 'x');
    const atLimitBytes = await atLimit.generateAsync({ type: 'uint8array', compression: 'STORE' });
    const atLimitBuffer = atLimitBytes.buffer.slice(atLimitBytes.byteOffset, atLimitBytes.byteOffset + atLimitBytes.byteLength) as ArrayBuffer;
    await assertZipArchiveWithinLimits(atLimitBuffer, { ...options, maxEntries: 4 });

    const overLimit = new module.default();
    for (let index = 0; index < 5; index++) overLimit.file(`f${index}.xml`, 'x');
    const overLimitBytes = await overLimit.generateAsync({ type: 'uint8array', compression: 'STORE' });
    const overLimitBuffer = overLimitBytes.buffer.slice(overLimitBytes.byteOffset, overLimitBytes.byteOffset + overLimitBytes.byteLength) as ArrayBuffer;
    await expectLimit(overLimitBuffer, /too many entries/, { maxEntries: 4 });
  });

  it('accepts declared uncompressed size exactly at maxUncompressedBytes and rejects one byte over', async () => {
    await assertZipArchiveWithinLimits(await buildZip('12345'), { ...options, maxUncompressedBytes: 5 });
    await expectLimit(await buildZip('12345'), /expanded test archive is too large/, { maxUncompressedBytes: 4 });
  });

  it('SECURITY GAP: accepts a path-traversal entry name ("../../etc/passwd") without rejecting it', async () => {
    // SECURITY GAP: parseZipArchiveMetadata()'s entry-name validation (zip-resource-guard.ts,
    // the `if (!name || name.includes('\0'))` check) only rejects an empty name or one containing
    // an embedded null byte -- it never rejects `../`-style path-traversal sequences or absolute
    // paths. In this repository's current consumer (archive-viewer.class.ts) entry.name is only
    // ever rendered as flat display text and used as a virtual-list Map key -- never as a
    // filesystem path or a DOM id -- so this is not directly exploitable as classic zip-slip
    // today. But this guard is shared verbatim by the docx/pptx/xlsx/epub resource guards too, and
    // any current or future consumer that ever resolves an entry name against a real path or URL
    // (e.g. an EPUB manifest href) would get no protection from this shared boundary. Documented
    // here as the guard's actual (permissive) behavior rather than a defect this repo's current
    // call sites can exploit.
    const module = (await import('jszip')) as unknown as { default: new () => JSZipType };
    const zip = new module.default();
    zip.file('../../etc/passwd', 'pwned');
    const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' });
    const source = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

    // JSZip auto-creates one directory entry per path segment (its own client-side convenience,
    // not a guard behavior) -- so the file entry itself, not necessarily entries[0], is what
    // carries the untouched traversal path through to the guard's own output unrejected.
    const metadata = assertZipArchiveMetadataWithinLimits(source, options);
    const fileEntry = metadata!.entries.find((entry) => !entry.dir)!;
    expect(fileEntry.name).to.equal('../../etc/passwd');
  });

  it('SECURITY GAP: accepts an absolute-path entry name ("/etc/passwd") without rejecting it', async () => {
    // SECURITY GAP: see the sibling test above -- the same missing check applies to a leading `/`.
    const module = (await import('jszip')) as unknown as { default: new () => JSZipType };
    const zip = new module.default();
    zip.file('/etc/passwd', 'pwned');
    const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' });
    const source = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

    const metadata = assertZipArchiveMetadataWithinLimits(source, options);
    const fileEntry = metadata!.entries.find((entry) => !entry.dir)!;
    expect(fileEntry.name).to.equal('/etc/passwd');
  });
});

describe('assertZipArchiveMetadataWithinLimits()', () => {
  function expectMetadataLimit(
    source: ArrayBuffer,
    message: RegExp,
    overrides: Partial<ZipArchiveGuardOptions> = {},
  ): void {
    try {
      assertZipArchiveMetadataWithinLimits(source, { ...options, ...overrides });
      expect.fail('expected the ZIP metadata guard to reject the archive');
    } catch (error) {
      expect(error).to.be.instanceOf(LyraResourceLimitError);
      expect((error as Error).message).to.match(message);
    }
  }

  it('returns frozen, bounded metadata for a valid archive, including a directory entry', async () => {
    const module = (await import('jszip')) as unknown as { default: new () => JSZipType };
    const zip = new module.default();
    zip.folder('sub');
    zip.file('sub/nested.xml', 'hello');
    const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' });
    const source = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

    const metadata = assertZipArchiveMetadataWithinLimits(source, options);
    expect(metadata).to.not.equal(null);
    expect(Object.isFrozen(metadata)).to.equal(true);
    expect(Object.isFrozen(metadata!.entries)).to.equal(true);
    const names = metadata!.entries.map((entry) => entry.name).sort();
    expect(names).to.deep.equal(['sub/', 'sub/nested.xml']);
    const dirEntry = metadata!.entries.find((entry) => entry.name === 'sub/')!;
    expect(dirEntry.dir).to.equal(true);
    const fileEntry = metadata!.entries.find((entry) => entry.name === 'sub/nested.xml')!;
    expect(fileEntry.dir).to.equal(false);
    expect(fileEntry.uncompressedBytes).to.equal(5);
    expect(metadata!.totalUncompressedBytes).to.equal(5);
  });

  it('rejects a malformed local header', async () => {
    const source = await buildZip();
    new DataView(source).setUint32(offsets(source).local, 0, true);
    expectMetadataLimit(source, /malformed/);
  });

  it('rejects an encrypted entry', async () => {
    const source = await buildZip();
    const { central } = offsets(source);
    new DataView(source).setUint16(central + 8, 1, true);
    expectMetadataLimit(source, /Encrypted/);
  });

  it('rejects an unsupported or inconsistent compression method', async () => {
    const source = await buildZip();
    const { central, local } = offsets(source);
    const view = new DataView(source);
    view.setUint16(central + 10, 99, true);
    view.setUint16(local + 8, 99, true);
    expectMetadataLimit(source, /unsupported or inconsistent compression/);
  });

  it('rejects an entry whose declared data extends past the central directory', async () => {
    const source = await buildZip();
    const { local } = offsets(source);
    new DataView(source).setUint16(local + 26, 0xffff, true);
    expectMetadataLimit(source, /malformed/);
  });

  it('passes through a permitted non-ZIP payload as null, mirroring the async guard', () => {
    expect(assertZipArchiveMetadataWithinLimits(new Uint8Array([1, 2]).buffer, { ...options, allowNonZip: true })).to.equal(null);
  });
});

async function loadWithJsZip(source: ArrayBuffer): Promise<string[]> {
  const module = (await import('jszip')) as unknown as {
    default: { loadAsync(data: ArrayBuffer): Promise<{ files: Record<string, unknown> }> };
  };
  const zip = await module.default.loadAsync(source);
  return Object.keys(zip.files).sort();
}

describe('ZIP resource guard agrees with the archive the peer readers open', () => {
  it('rejects an end-record comment that hides the end record the peers select', async () => {
    // The benign end record's comment hides a second archive plus one trailing byte.
    const benign = await zipEntry('benign.txt', 'ok');
    const hidden = await zipEntry('hidden.bin', new Uint8Array(4_096), { deflate: true });
    const benignLocal = localRecord(benign);
    const benignCentral = centralRecord(benign, 0);
    const benignEnd = benignLocal.length + benignCentral.length;
    const hiddenLocalOffset = benignEnd + 22;
    const hiddenLocal = localRecord(hidden);
    const hiddenCentral = centralRecord(hidden, hiddenLocalOffset);
    const hiddenDirectoryOffset = hiddenLocalOffset + hiddenLocal.length;
    const hiddenEndRecord = endRecord({
      records: 1,
      directorySize: hiddenCentral.length,
      directoryOffset: hiddenDirectoryOffset,
    });
    const trailing = new Uint8Array([0]);
    const commentLength = hiddenLocal.length + hiddenCentral.length + hiddenEndRecord.length + trailing.length;
    const source = toArrayBuffer(concatBytes(
      benignLocal,
      benignCentral,
      endRecord({ records: 1, directorySize: benignCentral.length, directoryOffset: benignLocal.length, commentLength }),
      hiddenLocal,
      hiddenCentral,
      hiddenEndRecord,
      trailing,
    ));

    expect(await loadWithJsZip(clone(source))).to.deep.equal(['hidden.bin']);
    await expectLimit(source, /malformed/, { maxUncompressedBytes: 1_024 });
    expect(() => assertZipArchiveMetadataWithinLimits(clone(source), options))
      .to.throw(LyraResourceLimitError, /malformed/);
  });

  it('rejects a gap between the central directory and its end record', async () => {
    const entry = await zipEntry('document.xml', '<root/>');
    const local = localRecord(entry);
    const central = centralRecord(entry, 0);
    const source = toArrayBuffer(concatBytes(
      local,
      central,
      new Uint8Array(8),
      endRecord({ records: 1, directorySize: central.length, directoryOffset: local.length }),
    ));
    await expectLimit(source, /malformed/);
    expect(() => assertZipArchiveMetadataWithinLimits(clone(source), options))
      .to.throw(LyraResourceLimitError, /malformed/);
  });

  it('rejects a local file name that differs from the central-directory name', async () => {
    const entry = await zipEntry('word/document.bin', '<w:document/>');
    const local = localRecord(entry, { name: 'word/document.xml' });
    const central = centralRecord(entry, 0);
    const source = toArrayBuffer(concatBytes(
      local,
      central,
      endRecord({ records: 1, directorySize: central.length, directoryOffset: local.length }),
    ));
    expect(await loadWithJsZip(clone(source))).to.deep.equal(['word/document.xml']);
    await expectLimit(source, /malformed/);
  });

  it('rejects a Unicode-path extra field that renames the entry for the peer reader', async () => {
    const entry = await zipEntry('word/document.bin', '<w:document/>');
    const realName = new TextEncoder().encode('word/document.bin');
    const unicodePath = new Uint8Array(5 + 'word/document.xml'.length);
    unicodePath[0] = 1;
    new DataView(unicodePath.buffer).setUint32(1, crc32(realName), true);
    unicodePath.set(new TextEncoder().encode('word/document.xml'), 5);
    const local = localRecord(entry);
    const central = centralRecord(entry, 0, { extra: extraField(0x7075, unicodePath) });
    const source = toArrayBuffer(concatBytes(
      local,
      central,
      endRecord({ records: 1, directorySize: central.length, directoryOffset: local.length }),
    ));
    expect(await loadWithJsZip(clone(source))).to.deep.equal(['word/document.xml']);
    await expectLimit(source, /malformed/);
  });

  it('accepts a Unicode-path extra field that spells the entry name exactly', async () => {
    const entry = await zipEntry('word/document.xml', '<w:document/>');
    const name = new TextEncoder().encode('word/document.xml');
    const unicodePath = new Uint8Array(5 + name.length);
    unicodePath[0] = 1;
    new DataView(unicodePath.buffer).setUint32(1, crc32(name), true);
    unicodePath.set(name, 5);
    const local = localRecord(entry);
    const central = centralRecord(entry, 0, { extra: extraField(0x7075, unicodePath) });
    await assertZipArchiveWithinLimits(toArrayBuffer(concatBytes(
      local,
      central,
      endRecord({ records: 1, directorySize: central.length, directoryOffset: local.length }),
    )), options);
  });

  it('rejects local header sizes or checksums that disagree with the central directory', async () => {
    const entry = await zipEntry('document.xml', '<root/>');
    for (const overrides of [{ compressedSize: 1 }, { uncompressedSize: 1 }, { crc: 1 }]) {
      const local = localRecord(entry, overrides);
      const central = centralRecord(entry, 0);
      await expectLimit(toArrayBuffer(concatBytes(
        local,
        central,
        endRecord({ records: 1, directorySize: central.length, directoryOffset: local.length }),
      )), /malformed/);
    }
    const local = localRecord(entry, { flags: 8, crc: 0, compressedSize: 0, uncompressedSize: 0 });
    const central = centralRecord(entry, 0, { flags: 8 });
    await assertZipArchiveWithinLimits(toArrayBuffer(concatBytes(
      local,
      central,
      endRecord({ records: 1, directorySize: central.length, directoryOffset: local.length }),
    )), options);
  });

  it('rejects a ZIP64 extended-information field that disagrees with the 32-bit sizes', async () => {
    const entry = await zipEntry('document.xml', '<root/>');
    const sizes = new Uint8Array(16);
    new DataView(sizes.buffer).setUint32(0, 50_000_000, true);
    for (const location of ['central', 'local'] as const) {
      const extra = extraField(0x0001, sizes);
      const local = localRecord(entry, location === 'local' ? { extra } : {});
      const central = centralRecord(entry, 0, location === 'central' ? { extra } : {});
      await expectLimit(toArrayBuffer(concatBytes(
        local,
        central,
        endRecord({ records: 1, directorySize: central.length, directoryOffset: local.length }),
      )), /ZIP64/);
    }
  });

  it('rejects overlapping entries before inflating any of them', async () => {
    const entry = await zipEntry('a.xml', 'x'.repeat(2_000), { deflate: true });
    const local = localRecord(entry);
    const directory = concatBytes(...[0, 1, 2].map(() => centralRecord(entry, 0)));
    let inspected = 0;
    await expectLimit(toArrayBuffer(concatBytes(
      local,
      directory,
      endRecord({ records: 3, directorySize: directory.length, directoryOffset: local.length }),
    )), /malformed/, {
      maxUncompressedBytes: 10_000,
      createInspector: () => {
        inspected++;
        return undefined;
      },
    });
    expect(inspected).to.equal(0);
  });

  it('accepts entries separated by data descriptors and keeps measuring them', async () => {
    const first = await zipEntry('a.xml', 'first', { deflate: true });
    const second = await zipEntry('b.xml', 'second');
    const firstLocal = localRecord(first, { flags: 8, crc: 0, compressedSize: 0, uncompressedSize: 0 });
    const descriptor = new Uint8Array(16);
    const descriptorView = new DataView(descriptor.buffer);
    descriptorView.setUint32(0, 0x08074b50, true);
    descriptorView.setUint32(4, first.crc, true);
    descriptorView.setUint32(8, first.compressedSize, true);
    descriptorView.setUint32(12, first.uncompressedSize, true);
    const secondOffset = firstLocal.length + descriptor.length;
    const secondLocal = localRecord(second);
    const directory = concatBytes(
      centralRecord(first, 0, { flags: 8 }),
      centralRecord(second, secondOffset),
    );
    const chunks: string[] = [];
    await assertZipArchiveWithinLimits(toArrayBuffer(concatBytes(
      firstLocal,
      descriptor,
      secondLocal,
      directory,
      endRecord({ records: 2, directorySize: directory.length, directoryOffset: secondOffset + secondLocal.length }),
    )), {
      ...options,
      createInspector: () => ({
        write: (chunk) => chunks.push(new TextDecoder().decode(chunk)),
        close: () => undefined,
      }),
    });
    expect(chunks.join('|')).to.equal('first|second');
  });

  it('inspects entries under the names the peers resolve, not only the stored name', async () => {
    const seen: string[] = [];
    const inspect = createXmlComplexityInspectorFactory({
      includeEntry: (name) => /\.xml$/i.test(name),
      maxNodes: 10,
    });
    for (const name of ['word/document.xml/.', 'word/document.xml/x/..', 'ppt\\slides\\slide1.xml', 'notes.txt']) {
      if (inspect({ name, compressedBytes: 0, uncompressedBytes: 0 })) seen.push(name);
    }
    expect(seen).to.deep.equal(['word/document.xml/.', 'word/document.xml/x/..', 'ppt\\slides\\slide1.xml']);
  });
});

describe('streaming XML complexity inspector', () => {
  it('counts every element a lenient XML or HTML parser could build', () => {
    for (const xml of [
      '<r>' + '<é/>'.repeat(5) + '</r>',
      '<p a"b>' + '<a/>'.repeat(5),
      '< <a/>< <a/>< <a/>< <a/>< <a/>< <a/>',
      '<a title="x' + '<b/>'.repeat(5),
    ]) {
      const inspect = createXmlComplexityInspectorFactory({ includeEntry: () => true, maxNodes: 4 });
      const inspector = inspect({ name: 'document.xml', compressedBytes: 0, uncompressedBytes: 0 })!;
      expect(() => {
        inspector.write(new TextEncoder().encode(xml));
        inspector.close();
      }, xml).to.throw(LyraResourceLimitError, /too many document nodes/);
    }
  });

  it('counts element names split across chunk boundaries once, with their row and cell kind', () => {
    const inspect = createXmlComplexityInspectorFactory({
      includeEntry: () => true,
      maxNodes: 100,
      maxRows: 1,
      maxCells: 2,
    });
    const inspector = inspect({ name: 'sheet.xml', compressedBytes: 0, uncompressedBytes: 0 })!;
    for (const chunk of ['<x:r', 'ow><x:', 'c/><', 'c', '/></x:row><x:', 'cell/>']) {
      inspector.write(new TextEncoder().encode(chunk));
    }
    inspector.close();
    const rows = inspect({ name: 'sheet2.xml', compressedBytes: 0, uncompressedBytes: 0 })!;
    expect(() => {
      rows.write(new TextEncoder().encode('<ro'));
      rows.write(new TextEncoder().encode('w/>'));
      rows.close();
    }).to.throw(LyraResourceLimitError, /too many document nodes/);
  });

  it('counts namespaced nodes, rows, and cells across chunk and quote boundaries', () => {
    const inspect = createXmlComplexityInspectorFactory({
      includeEntry: (name) => name.endsWith('.xml'),
      maxNodes: 5,
      maxRows: 1,
      maxCells: 1,
    });
    expect(inspect({ name: 'notes.txt', compressedBytes: 0, uncompressedBytes: 0 })).to.be.undefined;

    const inspector = inspect({ name: 'sheet.xml', compressedBytes: 0, uncompressedBytes: 0 })!;
    inspector.write(new TextEncoder().encode('<x:root label=\"unfinished'));
    inspector.write(new TextEncoder().encode(' value\"><x:row><x:c>ok</x:c>'));
    inspector.close();
  });

  it('enforces node, row, and cell ceilings independently', () => {
    for (const [xml, limits] of [
      ['<root><a/></root>', { maxNodes: 1 }],
      ['<root><row/><row/></root>', { maxNodes: 5, maxRows: 1 }],
      ['<root><c/><c/></root>', { maxNodes: 5, maxCells: 1 }],
    ] as const) {
      const inspect = createXmlComplexityInspectorFactory({
        includeEntry: () => true,
        ...limits,
      });
      const inspector = inspect({ name: 'document.xml', compressedBytes: 0, uncompressedBytes: 0 })!;
      expect(() => inspector.write(new TextEncoder().encode(xml))).to.throw(
        LyraResourceLimitError,
        /too many document nodes/,
      );
    }
  });
});
