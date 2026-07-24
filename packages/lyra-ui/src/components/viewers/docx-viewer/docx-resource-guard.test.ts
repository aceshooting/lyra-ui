import { expect } from '@open-wc/testing';
import JSZip from 'jszip';
import { LyraResourceLimitError } from '../../../internal/resource-loader.js';
import { assertDocxArchiveWithinLimits } from './docx-resource-guard.js';

function zipWithDeclaredSizes(sizes: number[]): ArrayBuffer {
  const localSize = sizes.reduce((sum, size) => sum + 30 + size, 0);
  const directorySize = sizes.length * 46;
  const source = new ArrayBuffer(localSize + directorySize + 22);
  const view = new DataView(source);
  let localOffset = 0;
  sizes.forEach((size, index) => {
    view.setUint32(localOffset, 0x04034b50, true);
    view.setUint32(localOffset + 18, size, true);
    view.setUint32(localOffset + 22, size, true);
    const centralOffset = localSize + index * 46;
    view.setUint32(centralOffset, 0x02014b50, true);
    view.setUint32(centralOffset + 20, size, true);
    view.setUint32(centralOffset + 24, size, true);
    view.setUint32(centralOffset + 42, localOffset, true);
    localOffset += 30 + size;
  });
  const endOffset = localSize + directorySize;
  view.setUint32(endOffset, 0x06054b50, true);
  view.setUint16(endOffset + 8, sizes.length, true);
  view.setUint16(endOffset + 10, sizes.length, true);
  view.setUint32(endOffset + 12, directorySize, true);
  view.setUint32(endOffset + 16, localSize, true);
  return source;
}

async function forgedExpansionZip(): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file('word/document.xml', 'x'.repeat(4_096));
  const source = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
  const view = new DataView(source);
  let patched = 0;
  for (let offset = 0; offset <= source.byteLength - 4; offset++) {
    if (view.getUint32(offset, true) !== 0x02014b50) continue;
    if (view.getUint32(offset + 24, true) === 0) continue;
    const localOffset = view.getUint32(offset + 42, true);
    view.setUint32(localOffset + 22, 1, true);
    view.setUint32(offset + 24, 1, true);
    patched++;
  }
  expect(patched).to.be.greaterThan(0);
  return source;
}

async function expectResourceLimit(operation: () => void | Promise<void>): Promise<void> {
  let caught: unknown;
  try { await operation(); } catch (error) { caught = error; }
  expect(caught).to.be.instanceOf(LyraResourceLimitError);
}

describe('DOCX resource guard', () => {
  it('accepts an archive within both ceilings', async () => {
    await assertDocxArchiveWithinLimits(zipWithDeclaredSizes([10, 20]), 2, 30);
  });

  it('rejects excessive declared expansion, entry count, and malformed ZIP input', async () => {
    await expectResourceLimit(() => assertDocxArchiveWithinLimits(zipWithDeclaredSizes([60, 50]), 10, 100));
    await expectResourceLimit(() => assertDocxArchiveWithinLimits(zipWithDeclaredSizes([1, 1]), 1, 100));
    await expectResourceLimit(() => assertDocxArchiveWithinLimits(new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer));
  });

  it('measures deflate output instead of trusting forged uncompressed-size fields', async () => {
    const source = await forgedExpansionZip();
    await expectResourceLimit(() => assertDocxArchiveWithinLimits(source, 10, 1_000));
  });

  it('rejects excessive expanded XML node complexity before Mammoth and honors cancellation', async () => {
    const zip = new JSZip();
    zip.file('word/document.xml', '<w:document><w:p/><w:p/></w:document>');
    const source = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
    await expectResourceLimit(() => assertDocxArchiveWithinLimits(source, 10, 10_000, { maxXmlNodes: 2 }));

    const controller = new AbortController();
    controller.abort();
    let aborted: unknown;
    try {
      await assertDocxArchiveWithinLimits(source, 10, 10_000, { signal: controller.signal });
    } catch (error) {
      aborted = error;
    }
    expect(aborted).to.be.instanceOf(DOMException);
    expect((aborted as DOMException).name).to.equal('AbortError');
  });
});
