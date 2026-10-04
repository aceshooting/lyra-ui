import type { DocxRefusalCode, DocxResult } from './types.js';

export interface DocxImageMetadata {
  readonly mimeType: 'image/png' | 'image/jpeg' | 'image/gif';
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly pixels: number;
  readonly hasJpegApp1: boolean;
}

const LIMITS = { image: 4 * 1024 * 1024, dimension: 8192, pixels: 16_000_000 };
class ImageRefusal extends Error {
  constructor(readonly code: DocxRefusalCode) { super(code); }
}
function reject(code: DocxRefusalCode = 'invalid-document'): never { throw new ImageRefusal(code); }

/** Bound and inspect raster bytes without decoding, copying or changing them. */
export function inspectDocxImage(bytes: Uint8Array): DocxResult<Readonly<DocxImageMetadata>> {
  try { return { ok: true, value: inspectImage(bytes) }; }
  catch (error) { return { ok: false, code: error instanceof ImageRefusal ? error.code : 'invalid-document' }; }
}

function inspectImage(bytes: Uint8Array): Readonly<DocxImageMetadata> {
  if (bytes.length > LIMITS.image) reject('resource-limit');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0, height = 0, hasJpegApp1 = false;
  let format: 'png' | 'gif' | 'jpeg';
  if (bytes.length >= 33 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte) && view.getUint32(12) === 0x49484452) {
    format = 'png';
    width = view.getUint32(16); height = view.getUint32(20);
  } else if (bytes.length >= 10 && bytes[0] === 71 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 56 && (bytes[4] === 55 || bytes[4] === 57) && bytes[5] === 97) {
    format = 'gif';
    width = view.getUint16(6, true); height = view.getUint16(8, true);
  } else if (bytes[0] === 255 && bytes[1] === 216) {
    format = 'jpeg';
    let at = 2, scanning = false, scanned = false, ended = false;
    while (at < bytes.length) {
      if (scanning) {
        if (bytes[at++] !== 255) { scanned = true; continue; }
        while (bytes[at] === 255) at++;
        const marker = bytes[at];
        if (marker === 0) { scanned = true; at++; continue; }
        if (marker !== undefined && marker >= 0xd0 && marker <= 0xd7) { at++; continue; }
        at--; scanning = false;
      }
      if (bytes[at++] !== 255) reject();
      while (bytes[at] === 255) at++;
      const marker = bytes[at++];
      if (marker === 0xd9) { ended = true; break; }
      if (marker === undefined || marker === 0 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) reject();
      if (marker === 0x01) continue;
      if (at + 2 > bytes.length) reject();
      const length = view.getUint16(at);
      if (length < 2 || at + length > bytes.length) reject();
      if (marker === 0xe1) hasJpegApp1 = true;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        if (length < 8 || width || height) reject();
        height = view.getUint16(at + 3); width = view.getUint16(at + 5);
        if (length !== 8 + 3 * bytes[at + 7]!) reject();
      }
      if (marker === 0xda) {
        if (!width || !height || length < 6 || length !== 6 + 2 * bytes[at + 2]!) reject();
        scanning = true;
      }
      at += length;
    }
    if (!ended || !scanned || at !== bytes.length) reject();
  } else reject();
  if (!width || !height) reject();
  if (width > LIMITS.dimension || height > LIMITS.dimension || width * height > LIMITS.pixels) reject('resource-limit');
  if (format === 'png') {
    inspectPng(bytes, view);
  } else if (format === 'gif') {
    if (bytes.length < 13) reject();
    const packed = bytes[10]!;
    let at = 13 + ((packed & 128) ? 3 * (2 ** ((packed & 7) + 1)) : 0);
    let frames = 0, ended = false;
    const subblocks = (): void => {
      while (at < bytes.length) {
        const size = bytes[at++]!;
        if (size === 0) return;
        at += size;
        if (at > bytes.length) reject();
      }
      reject();
    };
    while (at < bytes.length) {
      const block = bytes[at++];
      if (block === 59) { ended = true; break; }
      if (block === 33) { at++; subblocks(); continue; }
      if (block !== 44 || at + 9 > bytes.length || ++frames > 1) reject();
      const frameWidth = view.getUint16(at + 4, true), frameHeight = view.getUint16(at + 6, true);
      if (!frameWidth || !frameHeight || frameWidth > width || frameHeight > height) reject();
      const framePacked = bytes[at + 8]!;
      at += 9 + ((framePacked & 128) ? 3 * (2 ** ((framePacked & 7) + 1)) : 0);
      at++; // LZW minimum code size precedes bounded data subblocks.
      subblocks();
    }
    if (!ended || frames !== 1 || at !== bytes.length) reject();
  }
  return { pixels: width * height, pixelWidth: width, pixelHeight: height, mimeType: `image/${format}`, hasJpegApp1 };
}

const PNG_CRC = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});

/** Check PNG framing and checksums without inflating or copying image data. */
function inspectPng(bytes: Uint8Array, view: DataView): void {
  const depth = bytes[24]!, color = bytes[25]!;
  let at = 8, palette = false, imageData = false, dataEnded = false, ended = false;
  let dataBytes = 0, compression = -1, flags = -1;
  while (at + 12 <= bytes.length) {
    const length = view.getUint32(at), kind = view.getUint32(at + 4);
    if (length > bytes.length - at - 12) reject();
    for (let index = at + 4; index < at + 8; index++) {
      const value = bytes[index]!;
      if (!((value >= 65 && value <= 90) || (value >= 97 && value <= 122))) reject();
    }
    if (bytes[at + 6]! & 32) reject();
    let checksum = 0xffffffff;
    for (let index = at + 4; index < at + 8 + length; index++) {
      checksum = (checksum >>> 8) ^ PNG_CRC[(checksum ^ bytes[index]!) & 255]!;
    }
    if (((checksum ^ 0xffffffff) >>> 0) !== view.getUint32(at + 8 + length)) reject();
    if (kind === 0x49484452) {
      if (at !== 8 || length !== 13) reject();
      const validDepth = color === 0 ? [1, 2, 4, 8, 16].includes(depth) : color === 3 ? [1, 2, 4, 8].includes(depth) :
        [2, 4, 6].includes(color) && [8, 16].includes(depth);
      if (!validDepth || bytes[26] !== 0 || bytes[27] !== 0 || bytes[28]! > 1) reject();
    } else if (kind === 0x504c5445) {
      if (palette || imageData || color === 0 || color === 4 || length === 0 || length > 768 || length % 3 !== 0 ||
        (color === 3 && length / 3 > 2 ** depth)) reject();
      palette = true;
    } else if (kind === 0x49444154) {
      if (dataEnded || (color === 3 && !palette)) reject();
      imageData = true;
      for (let index = 0; index < length && dataBytes + index < 2; index++) {
        if (dataBytes + index === 0) compression = bytes[at + 8 + index]!;
        else flags = bytes[at + 8 + index]!;
      }
      dataBytes += length;
    } else {
      if (imageData) dataEnded = true;
      if (kind === 0x49454e44) {
        if (length !== 0 || !imageData || dataBytes < 6) reject();
        ended = true; at += 12; break;
      }
      if (kind === 0x6163544c || kind === 0x6663544c || kind === 0x66644154 || !(bytes[at + 4]! & 32)) reject();
    }
    at += length + 12;
  }
  if (!ended || at !== bytes.length || (compression & 15) !== 8 || (compression >>> 4) > 7 ||
    (flags & 32) !== 0 || ((compression << 8) + flags) % 31 !== 0) reject();
}
