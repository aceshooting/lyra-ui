import { getOwnDataDescriptor, isPlainDataRecord, MISSING_OWN_DATA_DESCRIPTOR, readOwnArrayLength, UNSAFE_OWN_DATA_DESCRIPTOR } from '../../../internal/data-descriptors.js';

export const MAP_IMAGE_MAX_DIMENSION = 2048;
export const MAP_IMAGE_MAX_PIXELS = 4_194_304;
export const MAP_IMAGE_MAX_ENCODED_BYTES = 1_048_576;
/** Limits apply to backing pixels; pixelRatio changes logical size without multiplying allocation.
 * The count admits sprite catalogs; the aggregate pixel and byte budgets bound the atlas itself. */
export const MAP_IMAGE_LIMITS = Object.freeze({ count: 1024, idLength: 128, svgBytes: 262_144,
  encodedBytes: MAP_IMAGE_MAX_ENCODED_BYTES, totalBytes: 8_388_608, dimension: MAP_IMAGE_MAX_DIMENSION, pixels: MAP_IMAGE_MAX_PIXELS,
  totalPixels: 16_777_216, elements: 2048, decodeTimeoutMs: 15_000 });
export interface LyraMapImage {
  readonly id: string;
  readonly source: { readonly kind: 'svg'; readonly markup: string } | { readonly kind: 'url'; readonly url: string };
  readonly width: number;
  readonly height: number;
  readonly pixelRatio: number;
  /** Signed-distance-field image: the engine recolors it with `icon-color`/`icon-halo-color`. */
  readonly sdf?: boolean;
}
export type MapImageErrorCode = 'invalid-descriptor' | 'duplicate-id' | 'limit' | 'unsafe-url' |
  'fetch' | 'unsupported-format' | 'missing-sanitizer' | 'invalid-svg' | 'decode' | 'tainted' | 'aborted';
export interface MapImageIssue { readonly code: MapImageErrorCode; readonly id?: string }
export type MapImageAdmission = { readonly ok: true; readonly images: readonly LyraMapImage[] } |
  { readonly ok: false; readonly issue: MapImageIssue };
/** A sanitized image failure; its code is the only diagnostic preparation retains. */
export class MapImageFailure extends Error {
  constructor(readonly code: MapImageErrorCode) { super(code); }
}
export const failMapImage = (code: MapImageErrorCode): never => { throw new MapImageFailure(code); };
function own(value: object, key: string): unknown {
  const descriptor = getOwnDataDescriptor(value, key);
  if (descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) return failMapImage('invalid-descriptor');
  return descriptor === MISSING_OWN_DATA_DESCRIPTOR ? undefined : descriptor.value;
}
export function mapImageBytes(text: string, ceiling: number): Uint8Array {
  if (text.length > ceiling) return failMapImage('limit');
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > ceiling) return failMapImage('limit');
  return bytes;
}
export function mapImageIssue(code: MapImageErrorCode, id?: string): { readonly ok: false; readonly issue: MapImageIssue } {
  return Object.freeze({ ok: false, issue: Object.freeze({ code, ...(id === undefined ? {} : { id }) }) });
}
/** Projects strict own data without calling accessors, rejecting an invalid assignment atomically. */
export function admitMapImages(value: unknown): MapImageAdmission {
  try {
    if (!Array.isArray(value)) return failMapImage('invalid-descriptor');
    const count = readOwnArrayLength(value);
    if (count === undefined) return failMapImage('invalid-descriptor');
    if (count > MAP_IMAGE_LIMITS.count) return failMapImage('limit');
    const ids = new Set<string>();
    const images: LyraMapImage[] = [];
    let totalPixels = 0;
    let inlineBytes = 0;
    for (let index = 0; index < count; index += 1) {
      const row: unknown = own(value, String(index));
      if (!isPlainDataRecord(row)) return failMapImage('invalid-descriptor');
      const rawId = own(row, 'id');
      const source = own(row, 'source');
      const width = own(row, 'width'); const height = own(row, 'height'); const ratio = own(row, 'pixelRatio');
      const sdf = own(row, 'sdf');
      if (sdf !== undefined && typeof sdf !== 'boolean') return failMapImage('invalid-descriptor');
      if (typeof rawId !== 'string' || !isPlainDataRecord(source) || typeof width !== 'number' ||
        typeof height !== 'number' || !Number.isInteger(width) || !Number.isInteger(height) ||
        width < 1 || height < 1 || typeof ratio !== 'number' || !Number.isFinite(ratio) || ratio <= 0 || ratio > 4) return failMapImage('invalid-descriptor');
      const id = rawId.trim();
      if (!id || id.length > MAP_IMAGE_LIMITS.idLength) return failMapImage('invalid-descriptor');
      if (ids.has(id)) return failMapImage('duplicate-id');
      if (width > MAP_IMAGE_LIMITS.dimension || height > MAP_IMAGE_LIMITS.dimension || width * height > MAP_IMAGE_LIMITS.pixels) return failMapImage('limit');
      totalPixels += width * height;
      if (totalPixels > MAP_IMAGE_LIMITS.totalPixels) return failMapImage('limit');
      const kind = own(source, 'kind');
      const markup = own(source, 'markup'); const url = own(source, 'url');
      let projected: LyraMapImage['source'];
      if (kind === 'svg' && typeof markup === 'string' && url === undefined) {
        inlineBytes += mapImageBytes(markup, MAP_IMAGE_LIMITS.svgBytes).length;
        if (inlineBytes > MAP_IMAGE_LIMITS.totalBytes) return failMapImage('limit');
        projected = Object.freeze({ kind, markup });
      } else if (kind === 'url' && typeof url === 'string' && url.trim() && url.length <= 8192 && markup === undefined) {
        projected = Object.freeze({ kind, url: url.trim() });
      } else return failMapImage('invalid-descriptor');
      ids.add(id);
      images.push(Object.freeze({ id, source: projected, width, height, pixelRatio: ratio, ...(sdf ? { sdf: true } : {}) }));
    }
    return Object.freeze({ ok: true, images: Object.freeze(images) });
  } catch (error) { return mapImageIssue(error instanceof MapImageFailure ? error.code : 'decode'); }
}
