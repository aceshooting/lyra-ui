export const MAP_IMAGE_MAX_DIMENSION = 2048;
export const MAP_IMAGE_MAX_PIXELS = 4_194_304;
export const MAP_IMAGE_MAX_ENCODED_BYTES = 1_048_576;
const MAX_ITEMS = 4096;

type MapImageRasterMime = 'image/png' | 'image/jpeg' | 'image/webp';
type MapImageMetadataIssue = 'unsupported-format' | 'mime-mismatch' | 'encoded-limit' |
  'dimension-limit' | 'animated' | 'malformed' | 'scan-limit';
export type MapImageMetadataResult = Readonly<{
  ok: true; mime: MapImageRasterMime; width: number; height: number;
}> | Readonly<{ ok: false; issue: MapImageMetadataIssue }>;

const issue = (value: MapImageMetadataIssue): MapImageMetadataResult => Object.freeze({ ok: false, issue: value });
const text = (data: Uint8Array, offset: number, size: number): string =>
  String.fromCharCode(...data.subarray(offset, offset + size));
const be16 = (data: Uint8Array, offset: number): number => data[offset]! * 256 + data[offset + 1]!;
const be32 = (data: Uint8Array, offset: number): number => data[offset]! * 16_777_216 + data[offset + 1]! * 65_536 + data[offset + 2]! * 256 + data[offset + 3]!;
const le16 = (data: Uint8Array, offset: number): number => data[offset]! + data[offset + 1]! * 256;
const le24 = (data: Uint8Array, offset: number): number => le16(data, offset) + data[offset + 2]! * 65_536;
const le32 = (data: Uint8Array, offset: number): number => le24(data, offset) + data[offset + 3]! * 16_777_216;

function dimensions(mime: MapImageRasterMime, width: number, height: number): MapImageMetadataResult {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) return issue('malformed');
  if (width > MAP_IMAGE_MAX_DIMENSION || height > MAP_IMAGE_MAX_DIMENSION || width * height > MAP_IMAGE_MAX_PIXELS) return issue('dimension-limit');
  return Object.freeze({ ok: true, mime, width, height });
}

function crc32(data: Uint8Array, start: number, end: number): number {
  let crc = 0xffffffff;
  for (let index = start; index < end; index += 1) {
    crc ^= data[index]!;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** PNG chunk framing, IHDR and CRC follow the PNG specification, sections 5 and 11. */
function png(data: Uint8Array): MapImageMetadataResult {
  if (data.length < 8 || text(data, 0, 8) !== '\x89PNG\r\n\x1a\n') return issue('malformed');
  let offset = 8;
  let count = 0;
  let metadata: MapImageMetadataResult = issue('malformed');
  let color = -1;
  let depth = 0;
  let palette = 0;
  let imageBytes = 0;
  let sawImage = false;
  const zlib: number[] = [];
  let imageEnded = false;
  let transparency = false;
  while (offset < data.length) {
    if (++count > MAX_ITEMS) return issue('scan-limit');
    if (data.length - offset < 12) return issue('malformed');
    const length = be32(data, offset);
    if (length > data.length - offset - 12) return issue('malformed');
    const type = text(data, offset + 4, 4);
    if (!/^[A-Za-z]{4}$/.test(type) || (data[offset + 6]! & 32) !== 0) return issue('malformed');
    const start = offset + 8;
    const end = start + length;
    if (type === 'acTL' || type === 'fcTL' || type === 'fdAT') return issue('animated');
    if (crc32(data, offset + 4, end) !== be32(data, end)) return issue('malformed');
    if (count === 1 && type !== 'IHDR') return issue('malformed');
    if (type === 'IHDR') {
      if (count !== 1 || length !== 13) return issue('malformed');
      metadata = dimensions('image/png', be32(data, start), be32(data, start + 4));
      if (!metadata.ok) return metadata;
      depth = data[start + 8]!;
      color = data[start + 9]!;
      const validDepth = color === 0 ? [1, 2, 4, 8, 16].includes(depth)
        : color === 3 ? [1, 2, 4, 8].includes(depth) : [2, 4, 6].includes(color) && [8, 16].includes(depth);
      if (!validDepth || data[start + 10] !== 0 || data[start + 11] !== 0 || data[start + 12]! > 1) return issue('malformed');
    } else if (type === 'PLTE') {
      if (palette || transparency || sawImage || color === 0 || color === 4 || length === 0 || length > 768 || length % 3 !== 0) return issue('malformed');
      palette = length / 3;
      if (color === 3 && palette > 2 ** depth) return issue('malformed');
    } else if (type === 'tRNS') {
      if (transparency || sawImage || (color === 3 ? !palette || length < 1 || length > palette
        : color === 0 ? length !== 2 : color === 2 ? length !== 6 : true)) return issue('malformed');
      transparency = true;
    } else if (type === 'IDAT') {
      if (imageEnded || (color === 3 && !palette)) return issue('malformed');
      sawImage = true;
      for (let index = start; index < end && zlib.length < 2; index += 1) zlib.push(data[index]!);
      imageBytes += length;
    } else if (type === 'IEND') {
      if (length !== 0 || end + 4 !== data.length || imageBytes < 6 || zlib.length !== 2 ||
        (zlib[0]! & 15) !== 8 || (zlib[0]! >>> 4) > 7 || ((zlib[0]! * 256 + zlib[1]!) % 31) !== 0 ||
        (zlib[1]! & 32) !== 0) return issue('malformed');
      return metadata;
    } else if (type === 'iCCP' || type === 'zTXt' || type === 'iTXt') {
      // Native decoders can inflate ancillary metadata independently of bounded raster dimensions.
      // Exclude these representations before decode; iTXt is excluded even when uncompressed.
      return issue('unsupported-format');
    } else if ((data[offset + 4]! & 32) === 0) return issue('malformed');
    if (type !== 'IDAT' && sawImage) imageEnded = true;
    offset = end + 4;
  }
  return issue('malformed');
}

/** T.81 Annex B marker framing; compressed tables and entropy coding remain decoder-owned. */
function jpeg(data: Uint8Array): MapImageMetadataResult {
  let offset = 2;
  let count = 0;
  let frame = -1;
  let metadata: MapImageMetadataResult = issue('malformed');
  const components = new Map<number, number>();
  let entropy = false;
  let entropyBytes = 0;
  let scans = 0;
  while (offset < data.length) {
    if (entropy && data[offset] !== 255) { entropyBytes += 1; offset += 1; continue; }
    if (data[offset++] !== 255) return issue('malformed');
    while (offset < data.length && data[offset] === 255) offset += 1;
    if (offset >= data.length) return issue('malformed');
    const marker = data[offset++]!;
    if (entropy && marker === 0) { entropyBytes += 1; continue; }
    if (++count > MAX_ITEMS) return issue('scan-limit');
    if (marker >= 0xd0 && marker <= 0xd7) {
      if (!entropy || entropyBytes === 0) return issue('malformed');
      continue;
    }
    if (entropy && entropyBytes === 0) return issue('malformed');
    entropy = false;
    if (marker === 0xd9) return offset === data.length && scans > 0 ? metadata : issue('malformed');
    if (marker === 0 || marker === 0xd8 || marker === 0xdc || marker === 0x01) return issue('malformed');
    if (data.length - offset < 2) return issue('malformed');
    const length = be16(data, offset);
    if (length < 2 || length > data.length - offset) return issue('malformed');
    const start = offset + 2;
    const end = offset + length;
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isFrame) {
      if (frame !== -1) return issue('malformed');
      if (![0xc0, 0xc1, 0xc2].includes(marker)) return issue('unsupported-format');
      if (length < 8 || data[start] !== 8) return issue('malformed');
      const componentCount = data[start + 5]!;
      if (componentCount < 1 || componentCount > 4 || length !== 8 + 3 * componentCount) return issue('malformed');
      metadata = dimensions('image/jpeg', be16(data, start + 3), be16(data, start + 1));
      if (!metadata.ok) return metadata;
      frame = marker;
      for (let index = 0; index < componentCount; index += 1) {
        const position = start + 6 + index * 3;
        const id = data[position]!;
        const sampling = data[position + 1]!;
        const horizontal = sampling >>> 4;
        const vertical = sampling & 15;
        if (components.has(id) || horizontal < 1 || horizontal > 4 || vertical < 1 || vertical > 4 || data[position + 2]! > 3) return issue('malformed');
        components.set(id, horizontal * vertical);
      }
    } else if (marker === 0xda) {
      if (frame === -1 || length < 6) return issue('malformed');
      const componentCount = data[start]!;
      if (componentCount < 1 || componentCount > components.size || length !== 6 + 2 * componentCount) return issue('malformed');
      const selected = new Set<number>();
      let sampling = 0;
      for (let index = 0; index < componentCount; index += 1) {
        const id = data[start + 1 + index * 2]!;
        const table = data[start + 2 + index * 2]!;
        if (!components.has(id) || selected.has(id) || (table >>> 4) > 3 || (table & 15) > 3) return issue('malformed');
        selected.add(id);
        sampling += components.get(id)!;
      }
      if (componentCount > 1 && sampling > 10) return issue('malformed');
      const spectral = start + 1 + 2 * componentCount;
      const low = data[spectral]!;
      const high = data[spectral + 1]!;
      const approximation = data[spectral + 2]!;
      const previous = approximation >>> 4;
      const next = approximation & 15;
      if (frame !== 0xc2 ? low !== 0 || high !== 63 || approximation !== 0
        : low > high || high > 63 || (low === 0 ? high !== 0 : componentCount !== 1) || previous > 13 || next > 13 || (previous !== 0 && previous !== next + 1)) return issue('malformed');
      scans += 1;
      entropy = true;
      entropyBytes = 0;
    } else if (marker === 0xdd) {
      if (length !== 4) return issue('malformed');
    } else if (!(marker >= 0xe0 && marker <= 0xef) && ![0xc4, 0xdb, 0xfe].includes(marker)) return issue('malformed');
    offset = end;
  }
  return issue('malformed');
}

/** WebP RIFF/VP8X framing and the VP8/VP8L uncompressed dimension headers. */
function webp(data: Uint8Array): MapImageMetadataResult {
  if (data.length < 12 || text(data, 0, 4) !== 'RIFF' || text(data, 8, 4) !== 'WEBP' ||
    le32(data, 4) !== data.length - 8 || data.length % 2 !== 0) return issue('malformed');
  let offset = 12;
  let count = 0;
  let canvas: MapImageMetadataResult | undefined;
  let frame: MapImageMetadataResult | undefined;
  let frameType = '';
  let flags = 0;
  let alphaSize = -1;
  let alphaRaw = false;
  const seen = new Set<string>();
  while (offset < data.length) {
    if (++count > MAX_ITEMS) return issue('scan-limit');
    if (data.length - offset < 8) return issue('malformed');
    const type = text(data, offset, 4);
    const length = le32(data, offset + 4);
    const padding = length % 2;
    if (length > data.length - offset - 8 || padding > data.length - offset - 8 - length) return issue('malformed');
    const start = offset + 8;
    const end = start + length;
    if (padding && data[end] !== 0) return issue('malformed');
    if (type === 'ANIM' || type === 'ANMF') return issue('animated');
    if (['VP8X', 'VP8 ', 'VP8L', 'ALPH', 'ICCP', 'EXIF', 'XMP '].includes(type)) {
      if (seen.has(type)) return issue('malformed');
      seen.add(type);
    }
    if (type === 'VP8X') {
      if (count !== 1 || length !== 10) return issue('malformed');
      flags = data[start]!;
      if (flags & 2) return issue('animated');
      if ((flags & 0xc1) !== 0 || data[start + 1] !== 0 || data[start + 2] !== 0 || data[start + 3] !== 0) return issue('malformed');
      canvas = dimensions('image/webp', 1 + le24(data, start + 4), 1 + le24(data, start + 7));
      if (!canvas.ok) return canvas;
    } else if (type === 'VP8 ' || type === 'VP8L') {
      if (frame) return issue('malformed');
      if (type === 'VP8 ') {
        if (length < 11) return issue('malformed');
        const tag = le24(data, start);
        if ((tag & 1) !== 0 || ((tag >>> 1) & 7) > 3 || (tag & 16) === 0 || (tag >>> 5) === 0 ||
          (tag >>> 5) > length - 10 || text(data, start + 3, 3) !== '\x9d\x01\x2a' ||
          (le16(data, start + 6) & 0xc000) !== 0 || (le16(data, start + 8) & 0xc000) !== 0) return issue('malformed');
        frame = dimensions('image/webp', le16(data, start + 6) & 0x3fff, le16(data, start + 8) & 0x3fff);
      } else {
        if (length < 6 || data[start] !== 0x2f) return issue('malformed');
        const bits = le32(data, start + 1);
        if (bits >>> 29) return issue('malformed');
        frame = dimensions('image/webp', 1 + (bits & 0x3fff), 1 + ((bits >>> 14) & 0x3fff));
      }
      if (!frame.ok) return frame;
      frameType = type;
    } else if (type === 'ALPH') {
      if (!canvas || frame || !(flags & 16) || length < 2 || (data[start]! & 0xc0) !== 0 ||
        (data[start]! & 3) > 1 || ((data[start]! >>> 4) & 3) > 1) return issue('malformed');
      alphaSize = length - 1;
      alphaRaw = (data[start]! & 3) === 0;
    } else if (type === 'ICCP' || type === 'EXIF' || type === 'XMP ') {
      if (!canvas || (type === 'ICCP' && (frame || alphaSize >= 0 || length === 0))) return issue('malformed');
    }
    offset = end + padding;
  }
  if (!frame?.ok || (canvas?.ok && (canvas.width !== frame.width || canvas.height !== frame.height))) return issue('malformed');
  if (canvas && (Boolean(flags & 32) !== seen.has('ICCP') || Boolean(flags & 8) !== seen.has('EXIF') ||
    Boolean(flags & 4) !== seen.has('XMP '))) return issue('malformed');
  if (frameType === 'VP8L' ? alphaSize >= 0 : Boolean(flags & 16) !== (alphaSize >= 0)) return issue('malformed');
  if (alphaRaw && alphaSize !== frame.width * frame.height) return issue('malformed');
  return frame;
}

/**
 * Check bounded static raster dimensions before native image decoding. This validates container
 * framing and metadata, not compressed pixel/entropy correctness. The caller must still handle
 * decoder failure and verify decoded intrinsic dimensions before allocating a drawing surface.
 * PNG CRCs are checked and compressed-capable metadata chunks are excluded; JPEG accepts eight-bit
 * nonhierarchical SOF0/1/2; GIF/AVIF/SVG are excluded.
 */
export function inspectMapImageMetadata(bytes: Uint8Array, mime: string): MapImageMetadataResult {
  try {
    if (!(bytes instanceof Uint8Array) || (typeof SharedArrayBuffer !== 'undefined' && bytes.buffer instanceof SharedArrayBuffer)) return issue('malformed');
    if (bytes.byteLength > MAP_IMAGE_MAX_ENCODED_BYTES) return issue('encoded-limit');
    if (typeof mime !== 'string' || mime.length > 256) return issue('unsupported-format');
    const declared = mime.split(';', 1)[0]!.trim().toLowerCase();
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(declared)) return issue('unsupported-format');
    const detected: MapImageRasterMime | undefined = text(bytes, 0, 4) === '\x89PNG' ? 'image/png'
      : bytes[0] === 255 && bytes[1] === 216 ? 'image/jpeg'
      : text(bytes, 0, 4) === 'RIFF' ? 'image/webp' : undefined;
    if (!detected) return issue('unsupported-format');
    if (declared !== detected) return issue('mime-mismatch');
    return detected === 'image/png' ? png(bytes) : detected === 'image/jpeg' ? jpeg(bytes) : webp(bytes);
  } catch {
    return issue('malformed');
  }
}
