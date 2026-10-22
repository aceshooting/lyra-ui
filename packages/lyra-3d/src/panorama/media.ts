import type { PanoramaSource } from './types.js';
export interface PanoramaMedia { kind: 'image' | 'video'; element: HTMLImageElement | HTMLCanvasElement | OffscreenCanvas | ImageBitmap | HTMLVideoElement; width: number; height: number }
export function inspectPanoramaMedia(source: PanoramaSource): PanoramaMedia {
  if (!source || (source.kind !== 'image' && source.kind !== 'video')) throw new TypeError('Panorama requires loaded media');
  const element = source.kind === 'image' ? source.image : source.video;
  const owner = 'ownerDocument' in element ? element.ownerDocument?.defaultView : undefined;
  const is = (name: string) => {
    const constructor = (owner as unknown as Record<string, unknown> | undefined)?.[name] ?? (globalThis as unknown as Record<string, unknown>)[name];
    return typeof constructor === 'function' && element instanceof constructor;
  };
  let width: number, height: number;
  if (source.kind === 'video') {
    if (!is('HTMLVideoElement') || source.video.readyState < 2) throw new TypeError('Panorama video must have a decoded frame');
    width = source.video.videoWidth; height = source.video.videoHeight;
  } else if (is('HTMLImageElement')) {
    const image = element as HTMLImageElement;
    if (!image.complete) throw new TypeError('Panorama image must already be loaded');
    width = image.naturalWidth; height = image.naturalHeight;
  } else {
    if (!is('HTMLCanvasElement') && !is('OffscreenCanvas') && !is('ImageBitmap')) throw new TypeError('Unsupported panorama image');
    const image = element as HTMLCanvasElement; width = image.width; height = image.height;
  }
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || width > 8192 || height > 8192 || width * height > 33554432) throw new RangeError('Panorama media dimensions exceed the supported range');
  return { kind: source.kind, element, width, height };
}
/** Rejects tainted media before a renderer starts uploading it. */
export function probePanoramaMedia(media: PanoramaMedia): void {
  const owner = 'ownerDocument' in media.element ? media.element.ownerDocument : globalThis.document;
  const canvas = owner.createElement('canvas'); canvas.width = 1; canvas.height = 1;
  try {
    const context = canvas.getContext('2d'); if (!context) throw new Error('Panorama media validation is unavailable');
    context.drawImage(media.element, 0, 0, 1, 1); context.getImageData(0, 0, 1, 1);
  } finally { canvas.width = 0; canvas.height = 0; }
}
