import { expect } from '@open-wc/testing';
import JSZip from 'jszip';
import { LyraResourceLimitError } from '../src/internal/resource-loader.js';

/** Builds stored ZIP entries with declared sizes for resource-limit tests. */
export function zipWithDeclaredSizes(sizes: number[]): ArrayBuffer {
  const names = sizes.map((_size, index) => `e${index}`);
  const localSize = sizes.reduce((sum, size, index) => sum + 30 + names[index]!.length + size, 0);
  const directorySize = sizes.reduce((sum, _size, index) => sum + 46 + names[index]!.length, 0);
  const source = new ArrayBuffer(localSize + directorySize + 22);
  const view = new DataView(source);
  let localOffset = 0;
  let centralOffset = localSize;
  sizes.forEach((size, index) => {
    const name = names[index]!;
    view.setUint32(localOffset, 0x04034b50, true);
    view.setUint32(localOffset + 18, size, true);
    view.setUint32(localOffset + 22, size, true);
    view.setUint16(localOffset + 26, name.length, true);
    for (let byte = 0; byte < name.length; byte++) view.setUint8(localOffset + 30 + byte, name.charCodeAt(byte));
    view.setUint32(centralOffset, 0x02014b50, true);
    view.setUint32(centralOffset + 20, size, true);
    view.setUint32(centralOffset + 24, size, true);
    view.setUint16(centralOffset + 28, name.length, true);
    view.setUint32(centralOffset + 42, localOffset, true);
    for (let byte = 0; byte < name.length; byte++) view.setUint8(centralOffset + 46 + byte, name.charCodeAt(byte));
    localOffset += 30 + name.length + size;
    centralOffset += 46 + name.length;
  });
  const endOffset = localSize + directorySize;
  view.setUint32(endOffset, 0x06054b50, true);
  view.setUint16(endOffset + 8, sizes.length, true);
  view.setUint16(endOffset + 10, sizes.length, true);
  view.setUint32(endOffset + 12, directorySize, true);
  view.setUint32(endOffset + 16, localSize, true);
  return source;
}

export async function forgedExpansionZip(name: string): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file(name, 'x'.repeat(4_096));
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

export async function expectResourceLimit(operation: () => void | Promise<void>): Promise<void> {
  let caught: unknown;
  try { await operation(); } catch (error) { caught = error; }
  expect(caught).to.be.instanceOf(LyraResourceLimitError);
}
