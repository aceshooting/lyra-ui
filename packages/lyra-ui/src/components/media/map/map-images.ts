import { getOwnDataDescriptor, isPlainDataRecord, MISSING_OWN_DATA_DESCRIPTOR, readOwnArrayLength, UNSAFE_OWN_DATA_DESCRIPTOR } from '../../../internal/data-descriptors.js';
import { isSvgElement } from '../../../internal/dom-guards.js';
import { loadDompurify } from '../../../internal/dompurify-loader.js';
import type { HtmlSanitizer } from '../../../internal/optional-peer-capabilities.js';
import { isResourceLimitError, readResponseArrayBuffer, resolveOwnerFetchTarget } from '../../../internal/resource-loader.js';
import { isUnsafeSvgCloneAttribute, isUnsafeSvgCloneElement } from '../../../internal/safe-svg.js';
import { sanitizePassiveMarkupFragment } from '../../viewers/passive-markup.js';
import { inspectMapImageMetadata, MAP_IMAGE_MAX_DIMENSION, MAP_IMAGE_MAX_ENCODED_BYTES, MAP_IMAGE_MAX_PIXELS } from './map-image-metadata.js';

/** Limits apply to backing pixels; pixelRatio changes logical size without multiplying allocation. */
export const MAP_IMAGE_LIMITS = Object.freeze({ count: 64, idLength: 128, svgBytes: 262_144,
  encodedBytes: MAP_IMAGE_MAX_ENCODED_BYTES, totalBytes: 8_388_608, dimension: MAP_IMAGE_MAX_DIMENSION, pixels: MAP_IMAGE_MAX_PIXELS,
  totalPixels: 16_777_216, elements: 2048, decodeTimeoutMs: 15_000 });
export interface LyraMapImage {
  readonly id: string;
  readonly source: { readonly kind: 'svg'; readonly markup: string } | { readonly kind: 'url'; readonly url: string };
  readonly width: number;
  readonly height: number;
  readonly pixelRatio: number;
}
type MapImageErrorCode = 'invalid-descriptor' | 'duplicate-id' | 'limit' | 'unsafe-url' |
  'fetch' | 'unsupported-format' | 'missing-sanitizer' | 'invalid-svg' | 'decode' | 'tainted' | 'aborted';
interface MapImageIssue { readonly code: MapImageErrorCode; readonly id?: string }
export type MapImageAdmission = { readonly ok: true; readonly images: readonly LyraMapImage[] } |
  { readonly ok: false; readonly issue: MapImageIssue };
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
  readonly image: ImageData | null;
  dispose(): void;
}
export type MapImagePreparationResult = { readonly ok: true; readonly images: readonly PreparedMapImage[]; dispose(): void } |
  { readonly ok: false; readonly issue: MapImageIssue };
class ImageFailure extends Error {
  constructor(readonly code: MapImageErrorCode) { super(code); }
}
const fail = (code: MapImageErrorCode): never => { throw new ImageFailure(code); };
function own(value: object, key: string): unknown {
  const descriptor = getOwnDataDescriptor(value, key);
  if (descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) return fail('invalid-descriptor');
  return descriptor === MISSING_OWN_DATA_DESCRIPTOR ? undefined : descriptor.value;
}
function bytesOf(text: string, ceiling: number): Uint8Array {
  if (text.length > ceiling) return fail('limit');
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > ceiling) return fail('limit');
  return bytes;
}
function issue(error: unknown, id?: string): { readonly ok: false; readonly issue: MapImageIssue } {
  const code = error instanceof ImageFailure ? error.code : isResourceLimitError(error) ? 'limit' : 'decode';
  return Object.freeze({ ok: false, issue: Object.freeze({ code, ...(id === undefined ? {} : { id }) }) });
}
/** Projects strict own data without calling accessors, rejecting an invalid assignment atomically. */
export function admitMapImages(value: unknown): MapImageAdmission {
  try {
    if (!Array.isArray(value)) return fail('invalid-descriptor');
    const count = readOwnArrayLength(value);
    if (count === undefined) return fail('invalid-descriptor');
    if (count > MAP_IMAGE_LIMITS.count) return fail('limit');
    const ids = new Set<string>();
    const images: LyraMapImage[] = [];
    let totalPixels = 0;
    let inlineBytes = 0;
    for (let index = 0; index < count; index += 1) {
      const row: unknown = own(value, String(index));
      if (!isPlainDataRecord(row)) return fail('invalid-descriptor');
      const rawId = own(row, 'id');
      const source = own(row, 'source');
      const width = own(row, 'width'); const height = own(row, 'height'); const ratio = own(row, 'pixelRatio');
      if (typeof rawId !== 'string' || !isPlainDataRecord(source) || typeof width !== 'number' ||
        typeof height !== 'number' || !Number.isInteger(width) || !Number.isInteger(height) ||
        width < 1 || height < 1 || typeof ratio !== 'number' || !Number.isFinite(ratio) || ratio <= 0 || ratio > 4) return fail('invalid-descriptor');
      const id = rawId.trim();
      if (!id || id.length > MAP_IMAGE_LIMITS.idLength) return fail('invalid-descriptor');
      if (ids.has(id)) return fail('duplicate-id');
      if (width > MAP_IMAGE_LIMITS.dimension || height > MAP_IMAGE_LIMITS.dimension || width * height > MAP_IMAGE_LIMITS.pixels) return fail('limit');
      totalPixels += width * height;
      if (totalPixels > MAP_IMAGE_LIMITS.totalPixels) return fail('limit');
      const kind = own(source, 'kind');
      const markup = own(source, 'markup'); const url = own(source, 'url');
      let projected: LyraMapImage['source'];
      if (kind === 'svg' && typeof markup === 'string' && url === undefined) {
        inlineBytes += bytesOf(markup, MAP_IMAGE_LIMITS.svgBytes).length;
        if (inlineBytes > MAP_IMAGE_LIMITS.totalBytes) return fail('limit');
        projected = Object.freeze({ kind, markup });
      } else if (kind === 'url' && typeof url === 'string' && url.trim() && url.length <= 8192 && markup === undefined) {
        projected = Object.freeze({ kind, url: url.trim() });
      } else return fail('invalid-descriptor');
      ids.add(id);
      images.push(Object.freeze({ id, source: projected, width, height, pixelRatio: ratio }));
    }
    return Object.freeze({ ok: true, images: Object.freeze(images) });
  } catch (error) { return issue(error); }
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
