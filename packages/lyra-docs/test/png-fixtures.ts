import { crc32, deflateSync } from 'node:zlib';

const pngSignature = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);

/** One PNG chunk with its length and checksum. */
export function pngChunk(name: string, data = new Uint8Array()): Uint8Array {
  const bytes = new Uint8Array(data.length + 12), view = new DataView(bytes.buffer);
  view.setUint32(0, data.length);
  bytes.set(new TextEncoder().encode(name), 4); bytes.set(data, 8);
  view.setUint32(bytes.length - 4, crc32(bytes.subarray(4, bytes.length - 4)));
  return bytes;
}

/** An IHDR chunk; the dimensions default to one pixel. */
export function pngHeader(depth = 8, color = 6, compression = 0, filter = 0, interlace = 0, width = 1, height = 1): Uint8Array {
  const data = new Uint8Array(13), view = new DataView(data.buffer);
  view.setUint32(0, width); view.setUint32(4, height);
  data.set([depth, color, compression, filter, interlace], 8);
  return pngChunk('IHDR', data);
}

export const pngCompressed = new Uint8Array(deflateSync(Uint8Array.of(0, 0, 0, 0, 255)));
export const pngEnd = () => pngChunk('IEND');

/** A complete PNG file from its chunks; the default is a valid static image. */
export function pngFile(parts = [pngHeader(), pngChunk('IDAT', pngCompressed), pngEnd()]): Uint8Array {
  return new Uint8Array(Buffer.concat([pngSignature, ...parts]));
}
