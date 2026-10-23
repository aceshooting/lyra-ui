import { isSvgElement } from '../../../internal/dom-guards.js';
import { loadDompurify } from '../../../internal/dompurify-loader.js';
import type { HtmlSanitizer } from '../../../internal/optional-peer-capabilities.js';
import { isResourceLimitError, readResponseArrayBuffer, resolveOwnerFetchTarget } from '../../../internal/resource-loader.js';
import { isUnsafeSvgCloneAttribute, isUnsafeSvgCloneElement } from '../../../internal/safe-svg.js';
import { sanitizePassiveMarkupFragment } from '../../viewers/passive-markup.js';
import { inspectMapImageMetadata } from './map-image-metadata.js';
import { admitMapImages, failMapImage as fail, MAP_IMAGE_LIMITS, mapImageBytes as bytesOf, mapImageIssue, MapImageFailure as ImageFailure,
  type MapImageIssue } from './map-image-admission.js';

export { admitMapImages, MAP_IMAGE_LIMITS };
export type { LyraMapImage } from './map-image-admission.js';
export interface MapImagePreparationContext {
  readonly owner: Element;
  readonly signal: AbortSignal;
  readonly isCurrent: () => boolean;
}
interface MapImageRasterInput {
  readonly mime: 'image/svg+xml' | 'image/png' | 'image/jpeg' | 'image/webp';
  readonly svg?: string;
  readonly bytes?: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly intrinsicWidth: number;
  readonly intrinsicHeight: number;
}
interface RasterizedMapImage { readonly image: ImageData; dispose(): void }
export interface MapImagePreparationServices {
  readonly loadSanitizer?: () => Promise<HtmlSanitizer | null>;
  readonly rasterize?: (input: MapImageRasterInput, context: MapImagePreparationContext) => Promise<RasterizedMapImage>;
}
export interface PreparedMapImage {
  /** Encoded input bytes retained for aggregate component cache accounting. */
  readonly encodedBytes?: number;
  /** Intrinsic decoded pixels, before resizing to the requested atlas backing size. */
  readonly decodedPixels?: number;
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly pixelRatio: number;
  /** Registered as a signed-distance-field image. */
  readonly sdf?: boolean;
  readonly image: ImageData | null;
  dispose(): void;
}
export type MapImagePreparationResult = { readonly ok: true; readonly images: readonly PreparedMapImage[]; dispose(): void } |
  { readonly ok: false; readonly issue: MapImageIssue };
function issue(error: unknown, id?: string): { readonly ok: false; readonly issue: MapImageIssue } {
  return mapImageIssue(error instanceof ImageFailure ? error.code : isResourceLimitError(error) ? 'limit' : 'decode', id);
}
function guard(context: MapImagePreparationContext): void {
  if (context.signal.aborted || !context.owner.isConnected || !context.isCurrent()) fail('aborted');
}
function webUrl(owner: Element, source: string): ReturnType<typeof resolveOwnerFetchTarget> {
  const target = resolveOwnerFetchTarget(owner, source);
  if (!target) return fail('unsafe-url');
  const parsed = new target.view.URL(target.url);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return fail('unsafe-url');
  return target;
}
function sanitizeSvg(raw: string, sanitizer: HtmlSanitizer, owner: Element, width: number, height: number): string {
  const fragment = sanitizePassiveMarkupFragment(sanitizer, raw, owner.ownerDocument, 'passive-svg');
  const roots = [...fragment.children];
  if (roots.length !== 1 || !isSvgElement(roots[0]) || roots[0].localName !== 'svg' ||
    [...fragment.childNodes].some((node) => node.nodeType === 3 && Boolean(node.textContent?.trim()))) return fail('invalid-svg');
  const root = roots[0];
  const elements = [root, ...root.querySelectorAll('*')];
  if (elements.length > MAP_IMAGE_LIMITS.elements) return fail('limit');
  for (const element of elements) {
    const name = element.localName.toLowerCase();
    if (!isSvgElement(element) || isUnsafeSvgCloneElement(name) || name === 'filter' || name.startsWith('fe') || name === 'use') {
      element.remove(); continue;
    }
    for (const attribute of [...element.attributes]) {
      if (isUnsafeSvgCloneAttribute(attribute.name, attribute.value, name)) element.removeAttributeNode(attribute);
    }
  }
  // Raster allocation is always explicit. Reject malformed intrinsic geometry rather than allowing
  // browser-dependent dimensions, and remove percentages/physical units before decode.
  for (const key of ['width', 'height']) {
    const value = root.getAttribute(key);
    if (value !== null && (!/^\s*(?:\d+(?:\.\d*)?|\.\d+)(?:px)?\s*$/u.test(value) ||
      !Number.isFinite(Number.parseFloat(value)) || Number.parseFloat(value) <= 0 || Number.parseFloat(value) > MAP_IMAGE_LIMITS.dimension)) fail('invalid-svg');
  }
  const viewBox = root.getAttribute('viewBox');
  if (viewBox !== null) {
    const tokens = viewBox.trim().split(/[\s,]+/u);
    if (tokens.some((token) => !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u.test(token))) fail('invalid-svg');
    const numbers = tokens.map(Number);
    if (numbers.length !== 4 || !numbers.every(Number.isFinite) || numbers[2]! <= 0 || numbers[3]! <= 0 ||
      numbers.some((value) => Math.abs(value) > 1e7)) fail('invalid-svg');
  }
  root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  root.setAttribute('width', String(width)); root.setAttribute('height', String(height));
  const serialized = root.outerHTML;
  bytesOf(serialized, MAP_IMAGE_LIMITS.encodedBytes);
  return serialized;
}
/** Portable image-element decoding. SVG uses a sanitized data URL; raster URLs are task-owned blobs. */
async function rasterizeMapImage(input: MapImageRasterInput, context: MapImagePreparationContext): Promise<RasterizedMapImage> {
  guard(context);
  const doc = context.owner.ownerDocument;
  const view = doc.defaultView;
  if (!view) return fail('aborted');
  const image = new view.Image();
  let objectUrl: string | undefined;
  let canvas: HTMLCanvasElement | undefined;
  try {
    const src = input.svg === undefined
      ? (objectUrl = view.URL.createObjectURL(new view.Blob([input.bytes!.slice().buffer], { type: input.mime })))
      : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(input.svg)}`;
    await new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const clear = () => {
        image.onload = null; image.onerror = null;
        context.signal.removeEventListener('abort', abort);
        if (timer !== undefined) clearTimeout(timer);
      };
      const finish = (error?: ImageFailure) => { clear(); if (error) reject(error); else resolve(); };
      const abort = () => { finish(new ImageFailure('aborted')); image.removeAttribute('src'); };
      image.onload = () => finish();
      image.onerror = () => finish(new ImageFailure('decode'));
      context.signal.addEventListener('abort', abort, { once: true });
      timer = setTimeout(() => { finish(new ImageFailure('decode')); image.removeAttribute('src'); }, MAP_IMAGE_LIMITS.decodeTimeoutMs);
      if (context.signal.aborted) abort(); else image.src = src;
    });
    guard(context);
    const exactSize = image.naturalWidth === input.intrinsicWidth && image.naturalHeight === input.intrinsicHeight;
    // Native decoders apply EXIF orientation before exposing intrinsic axes. Either orientation
    // retains the already-admitted bounded rectangle and its pixel count.
    const rotatedSize = image.naturalWidth === input.intrinsicHeight && image.naturalHeight === input.intrinsicWidth;
    if (!exactSize && !rotatedSize) return fail('decode');
    canvas = doc.createElement('canvas'); canvas.width = input.width; canvas.height = input.height;
    const drawing = canvas.getContext('2d');
    if (!drawing) return fail('decode');
    drawing.drawImage(image, 0, 0, input.width, input.height);
    let pixels: ImageData;
    try { pixels = drawing.getImageData(0, 0, input.width, input.height); } catch { return fail('tainted'); }
    guard(context);
    return { image: pixels, dispose() {} };
  } finally {
    image.onload = null; image.onerror = null; image.removeAttribute('src');
    if (objectUrl !== undefined) view.URL.revokeObjectURL(objectUrl);
    if (canvas) { canvas.width = 1; canvas.height = 1; }
  }
}
/** Serial, atomic preparation: callers own successful images until removed from the peer and disposed. */
export async function prepareMapImages(value: unknown, context: MapImagePreparationContext,
  services: MapImagePreparationServices = {}): Promise<MapImagePreparationResult> {
  const admission = admitMapImages(value);
  if (!admission.ok) return admission;
  const prepared: PreparedMapImage[] = [];
  let currentId: string | undefined;
  let totalBytes = 0;
  let totalDecodedPixels = 0;
  let pendingRaster: RasterizedMapImage | undefined;
  let pendingResponse: Response | undefined;
  try {
    guard(context);
    const documentAtStart = context.owner.ownerDocument;
    const check = () => { guard(context); if (context.owner.ownerDocument !== documentAtStart) fail('aborted'); };
    for (const descriptor of admission.images) {
      currentId = descriptor.id;
      check();
      if (totalBytes >= MAP_IMAGE_LIMITS.totalBytes) return fail('limit');
      let mime = 'image/svg+xml';
      let encoded: Uint8Array;
      if (descriptor.source.kind === 'svg') encoded = bytesOf(descriptor.source.markup, MAP_IMAGE_LIMITS.svgBytes);
      else {
        const target = webUrl(context.owner, descriptor.source.url)!;
        let response: Response;
        try { response = await target.view.fetch(target.url, { mode: 'cors', credentials: 'omit', redirect: 'error', signal: context.signal }); }
        catch { check(); return fail('fetch'); }
        pendingResponse = response;
        check();
        if (!response.ok || !['basic', 'cors'].includes(response.type)) return fail('fetch');
        if (response.url) webUrl(context.owner, response.url);
        mime = (response.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
        if (!['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'].includes(mime)) return fail('unsupported-format');
        encoded = new Uint8Array(await readResponseArrayBuffer(response, Math.min(MAP_IMAGE_LIMITS.encodedBytes, MAP_IMAGE_LIMITS.totalBytes - totalBytes)));
        pendingResponse = undefined;
        check();
      }
      totalBytes += encoded.length;
      if (totalBytes > MAP_IMAGE_LIMITS.totalBytes) return fail('limit');
      let input: MapImageRasterInput;
      if (mime === 'image/svg+xml') {
        if (encoded.length > MAP_IMAGE_LIMITS.svgBytes) return fail('limit');
        const sanitizer = await (services.loadSanitizer ?? loadDompurify)();
        check();
        if (!sanitizer) return fail('missing-sanitizer');
        let markup: string;
        try { markup = new TextDecoder('utf-8', { fatal: true }).decode(encoded); } catch { return fail('invalid-svg'); }
        const svg = sanitizeSvg(markup, sanitizer, context.owner, descriptor.width, descriptor.height);
        input = { mime: 'image/svg+xml', svg, width: descriptor.width, height: descriptor.height,
          intrinsicWidth: descriptor.width, intrinsicHeight: descriptor.height };
      } else {
        const metadata = inspectMapImageMetadata(encoded, mime);
        if (!metadata.ok) return fail(metadata.issue === 'dimension-limit' || metadata.issue === 'encoded-limit' || metadata.issue === 'scan-limit' ? 'limit' : 'unsupported-format');
        input = { mime: metadata.mime, bytes: encoded, width: descriptor.width, height: descriptor.height,
          intrinsicWidth: metadata.width, intrinsicHeight: metadata.height };
      }
      totalDecodedPixels += input.intrinsicWidth * input.intrinsicHeight;
      if (totalDecodedPixels > MAP_IMAGE_LIMITS.totalPixels) return fail('limit');
      check();
      pendingRaster = await (services.rasterize ?? rasterizeMapImage)(input, context);
      check();
      if (pendingRaster.image.width !== descriptor.width || pendingRaster.image.height !== descriptor.height ||
        pendingRaster.image.data.length !== descriptor.width * descriptor.height * 4) return fail('decode');
      let raster: RasterizedMapImage | undefined = pendingRaster; pendingRaster = undefined;
      prepared.push(Object.freeze({ encodedBytes: encoded.length, decodedPixels: input.intrinsicWidth * input.intrinsicHeight, id: descriptor.id, width: descriptor.width, height: descriptor.height, pixelRatio: descriptor.pixelRatio,
        ...(descriptor.sdf ? { sdf: true } : {}),
        get image() { return raster?.image ?? null; },
        dispose() {
          const previous = raster; raster = undefined;
          try { previous?.dispose(); } catch { /* Continue disposing the remaining owned images. */ }
        },
      }));
    }
    check();
    const images = Object.freeze(prepared);
    return Object.freeze({ ok: true, images, dispose() { for (const image of images) image.dispose(); } });
  } catch (error) {
    try { await pendingResponse?.body?.cancel(); } catch { /* The original failure remains authoritative. */ }
    try { pendingRaster?.dispose(); } catch { /* Preserve the preparation failure and dispose the batch. */ }
    for (const image of prepared) image.dispose();
    return issue(context.signal.aborted ? new ImageFailure('aborted') : error, currentId);
  }
}
