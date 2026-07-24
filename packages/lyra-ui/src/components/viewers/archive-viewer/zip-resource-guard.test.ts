import { expect } from '@open-wc/testing';
import type { default as JSZipType } from 'jszip';
import { LyraResourceLimitError } from '../../../internal/resource-loader.js';
import {
  assertZipArchiveWithinLimits,
  createXmlComplexityInspectorFactory,
  type ZipArchiveGuardOptions,
} from './zip-resource-guard.js';

const LOCAL_SIGNATURE = 0x04034b50;
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
      const { central } = offsets(inconsistent);
      new DataView(inconsistent).setUint32(central + 24, 6, true);
    }
    await expectLimit(inconsistent, /inconsistent entry sizes/);
  });

  it('measures valid DEFLATE entries and rejects corrupt compressed data', async () => {
    await assertZipArchiveWithinLimits(await buildZip('compress me '.repeat(50), 'DEFLATE'), {
      ...options,
      maxUncompressedBytes: 1_024,
    });

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
});

describe('streaming XML complexity inspector', () => {
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
