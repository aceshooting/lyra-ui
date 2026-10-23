import { readResponseArrayBuffer } from '../../../internal/resource-loader.js';
import { MAP_IMAGE_LIMITS } from './map-image-admission.js';
import { inspectMapImageMetadata } from './map-image-metadata.js';
import { projectMapLocalImageUrl } from './map-local-image-url.js';
import type { MapImagePreparationContext } from './map-images.js';

export interface PreparedMapLocalImage {
  readonly url: string;
  readonly encodedBytes: number;
  dispose(): void;
}
function failed(): never { throw new Error('Map image could not be prepared.'); }
/** Validate and decode before forwarding an owned URL; the caller's blob URL is never revoked. */
export async function prepareMapLocalImage(input: string, context: MapImagePreparationContext): Promise<PreparedMapLocalImage> {
  const document = context.owner.ownerDocument, view = document.defaultView;
  if (!view) return failed();
  const admitted = projectMapLocalImageUrl(input, view.origin);
  if (!admitted) return failed();
  const controller = new AbortController();
  const abort = () => { controller.abort(); };
  const guard = () => {
    if (controller.signal.aborted || context.signal.aborted || !context.owner.isConnected ||
      context.owner.ownerDocument !== document || !context.isCurrent()) failed();
  };
  context.signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, MAP_IMAGE_LIMITS.decodeTimeoutMs);
  let response: Response | undefined, objectUrl: string | undefined;
  let retained = false;
  const image = new view.Image();
  const wait = async <T>(pending: Promise<T>): Promise<T> => {
    let stop!: () => void;
    const cancelled = new Promise<never>((_resolve, reject) => {
      stop = () => { reject(new Error('Map image preparation was cancelled.')); };
      controller.signal.addEventListener('abort', stop, { once: true });
      if (controller.signal.aborted) stop();
    });
    try { const result = await Promise.race([pending, cancelled]); guard(); return result; }
    finally { controller.signal.removeEventListener('abort', stop); }
  };
  try {
    guard();
    let bytes: Uint8Array, mime: string;
    if (admitted.kind === 'data') {
      const encoded = admitted.url.slice(admitted.url.indexOf(',') + 1);
      const decoded = view.atob(encoded);
      if (view.btoa(decoded) !== encoded) return failed();
      bytes = Uint8Array.from(decoded, value => value.charCodeAt(0)); mime = admitted.mime!;
    } else {
      response = await wait(view.fetch(admitted.url, { signal: controller.signal, credentials: 'omit', redirect: 'error' }));
      if (!response.ok || response.type === 'opaque' || response.type === 'opaqueredirect' ||
        (response.url && !projectMapLocalImageUrl(response.url, view.origin))) return failed();
      mime = (response.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
      bytes = new Uint8Array(await wait(readResponseArrayBuffer(response, MAP_IMAGE_LIMITS.encodedBytes)));
    }
    guard();
    const metadata = inspectMapImageMetadata(bytes, mime);
    if (!metadata.ok) return failed();
    objectUrl = view.URL.createObjectURL(new view.Blob([bytes.slice().buffer], { type: metadata.mime }));
    await wait(new Promise<void>((resolve, reject) => {
      image.onload = () => { resolve(); };
      image.onerror = () => { reject(new Error('Map image decoding failed.')); };
      image.src = objectUrl!;
    }));
    const width = image.naturalWidth, height = image.naturalHeight;
    if (!(width === metadata.width && height === metadata.height || width === metadata.height && height === metadata.width)) return failed();
    guard();
    const url = objectUrl;
    let disposed = false;
    const result = Object.freeze({ url, encodedBytes: bytes.byteLength, dispose() {
      if (!disposed) { disposed = true; view.URL.revokeObjectURL(url); }
    } });
    retained = true;
    return result;
  } finally {
    clearTimeout(timer); context.signal.removeEventListener('abort', abort);
    controller.abort(); image.onload = null; image.onerror = null; image.removeAttribute('src');
    if (response?.body && !response.body.locked) void response.body.cancel().catch(() => {});
    if (objectUrl && !retained) view.URL.revokeObjectURL(objectUrl);
  }
}
