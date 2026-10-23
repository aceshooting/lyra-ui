import { MAP_IMAGE_MAX_ENCODED_BYTES } from './map-image-limits.js';

export interface MapLocalImageUrl {
  readonly url: string;
  readonly kind: 'data' | 'blob';
  readonly mime?: 'image/png' | 'image/jpeg' | 'image/webp';
}
/** Local URLs are admitted only by the image data-layer route, never by tile/style admission. */
export function projectMapLocalImageUrl(value: unknown, ownerOrigin: string): MapLocalImageUrl | undefined {
  if (typeof value !== 'string' || /[\u0000-\u0020\u007f]/u.test(value)) return undefined;
  if (value.startsWith('data:')) {
    if (value.length > Math.ceil(MAP_IMAGE_MAX_ENCODED_BYTES / 3) * 4 + 32) return undefined;
    const match = /^data:(image\/(?:png|jpeg|webp));base64,/u.exec(value);
    if (!match) return undefined;
    const encoded = value.slice(match[0].length);
    if (!encoded.length || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/u.test(encoded)) return undefined;
    const size = encoded.length / 4 * 3 - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0);
    if (size < 1 || size > MAP_IMAGE_MAX_ENCODED_BYTES) return undefined;
    return Object.freeze({ url: value, kind: 'data', mime: match[1] as MapLocalImageUrl['mime'] });
  }
  if (!value.startsWith('blob:') || value.length > 4096) return undefined;
  try {
    const owner = new URL(ownerOrigin), blob = new URL(value), embedded = new URL(value.slice(5));
    if (owner.origin === 'null' || blob.origin !== owner.origin || embedded.origin !== owner.origin ||
      embedded.username || embedded.password || embedded.search || embedded.hash || blob.hash) return undefined;
    return Object.freeze({ url: blob.href, kind: 'blob' });
  } catch { return undefined; }
}
