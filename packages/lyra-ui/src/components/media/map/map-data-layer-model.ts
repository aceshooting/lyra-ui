import { projectMapVectorStyle, type CanonicalMapVectorStyle,
  type LyraMapVectorPaint, type LyraMapVectorLayout, type LyraMapVectorStyleExpression } from './map-vector-style.js';
import { projectMapLocalImageUrl } from './map-local-image-url.js';
import { getOwnDataDescriptor, isPlainDataRecord, MISSING_OWN_DATA_DESCRIPTOR, type OwnDataDescriptorResult, readOwnArrayLength, readOwnDataValueOr, UNSAFE_OWN_DATA_DESCRIPTOR } from '../../../internal/data-descriptors.js';
import { projectMapInteractionOptions, type LyraMapInteractionOptions, type CanonicalMapInteraction } from './map-interaction-options.js';
import { escapeHtml } from '../../../internal/escape-html.js';
import { safeFetchUrl } from '../../../internal/safe-url.js';
import { invalidDataLayer as invalid, numeric, type CanonicalMapLabel, type LyraMapLabelAnchor, type LyraMapLabelValue } from './map-label-layer.js';
export { buildMapLabelLayer } from './map-label-layer.js';
export type { CanonicalMapLabel, LyraMapLabelAnchor, LyraMapLabelValue } from './map-label-layer.js';

/** Four native corners, ordered top-left, top-right, bottom-right, bottom-left. */
export type LyraMapSourceCoordinates = readonly [readonly [number, number], readonly [number, number], readonly [number, number], readonly [number, number]];
/** Text labels require a style with a glyph provider. Set exactly one of field or expression. */
export interface LyraMapLabelOptions {
  readonly field?: string;
  readonly expression?: readonly LyraMapLabelValue[];
  readonly placement?: 'point' | 'line';
  /** Physical native anchor. Omission preserves the native center default. */
  readonly anchor?: LyraMapLabelAnchor;
  /** Native text-size ems; positive x is right and y down in label coordinates. Not mirrored in RTL.
   * Each finite coordinate is within [-16,16]. Omission preserves native [0,0]. */
  readonly offset?: readonly [number, number];
  readonly size?: number;
  readonly color?: string;
  /** Halo colour; with a `haloWidth` above 0 and no colour it resolves to `var(--lr-color-surface)`. */
  readonly haloColor?: string;
  readonly haloWidth?: number;
  readonly minZoom?: number;
  readonly font?: readonly string[];
  readonly allowOverlap?: boolean;
  readonly ignorePlacement?: boolean;
}
export interface LyraMapTileSource {
  readonly url?: string;
  readonly tiles?: readonly string[];
  readonly minZoom?: number;
  readonly maxZoom?: number;
  readonly attribution?: string;
  readonly scheme?: 'xyz' | 'tms';
}
export interface LyraMapExternalDataLayerOptions extends LyraMapInteractionOptions {
  readonly sourceId: string;
  /** Native layer insertion target; a missing target appends. */
  readonly before?: string;
  readonly minZoom?: number;
  readonly maxZoom?: number;
  readonly opacity?: number;
  /** Whole-layer category toggled by hiddenCategories and an authored legend row. */
  readonly category?: string;
}
export interface LyraMapVectorDataLayer extends LyraMapExternalDataLayerOptions {
  readonly kind: 'vector';
  readonly source: LyraMapTileSource;
  readonly sourceLayer: string;
  readonly render: 'line' | 'circle' | 'fill' | 'symbol';
  readonly color?: string;
  readonly strokeColor?: string;
  readonly width?: number;
  readonly radius?: number;
  readonly categoryField?: string;
  /** Render-specific bounded paint; explicit values override the flat defaults. Row opacity remains separate. */
  readonly paint?: LyraMapVectorPaint;
  /** Render-specific bounded layout. Icon-only symbols do not require glyphs. */
  readonly layout?: LyraMapVectorLayout;
  /** Bounded boolean expression applied to the primary layer and its optional label. */
  readonly filter?: LyraMapVectorStyleExpression;
  readonly label?: LyraMapLabelOptions;
}
export interface LyraMapRasterDataLayer extends LyraMapExternalDataLayerOptions {
  readonly kind: 'raster';
  readonly source: LyraMapTileSource & { readonly tileSize?: number };
}
/** Interactive hits use the four-corner footprint, independently of pixel alpha. Hits expose sourceId, without a feature ID or sourceLayer. */
export interface LyraMapImageDataLayer extends LyraMapExternalDataLayerOptions {
  readonly kind: 'image';
  /** HTTP(S), strict base64 PNG/JPEG/WebP data URL, or same-origin blob URL. Local images are validated and bounded before use. */
  readonly url: string;
  readonly coordinates: LyraMapSourceCoordinates;
}
/** Interactive hits use the four-corner footprint; coordinate updates move it with the canvas. No per-pixel or feature-state identity is implied. */
export interface LyraMapCanvasDataLayer extends LyraMapExternalDataLayerOptions {
  readonly kind: 'canvas';
  readonly canvas: HTMLCanvasElement;
  readonly coordinates: LyraMapSourceCoordinates;
  readonly animate?: boolean;
  /** Nonnegative safe integer; change after drawing into the same canvas. Defaults to zero. */
  readonly redrawRevision?: number;
}
export type LyraMapExternalDataLayer = LyraMapVectorDataLayer | LyraMapRasterDataLayer | LyraMapImageDataLayer | LyraMapCanvasDataLayer;
export interface CanonicalMapExternalLayer extends CanonicalMapInteraction {
  readonly style?: CanonicalMapVectorStyle;
  readonly sourceId: string;
  readonly kind: LyraMapExternalDataLayer['kind'];
  readonly source: Readonly<Record<string, unknown>>;
  readonly redrawRevision?: number;
  readonly sourceLayer?: string;
  readonly render: 'line' | 'circle' | 'fill' | 'symbol' | 'raster';
  readonly before?: string;
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly opacity: number;
  readonly category?: string;
  readonly categoryField?: string;
  readonly color?: string;
  readonly strokeColor?: string;
  readonly width: number;
  readonly radius: number;
  readonly label?: CanonicalMapLabel;
}
const EXTERNAL_KINDS = new Set(['vector', 'raster', 'image', 'canvas']);
const COMMON_KEYS = ['interactive', 'priority', 'kind', 'sourceId', 'before', 'minZoom', 'maxZoom', 'opacity', 'category'];
const TILE_TOKENS = new Set(['z', 'x', 'y', 'ratio', 'quadkey', 'bbox-epsg-3857', 'prefix']);
function own(value: object, key: string): unknown {
  return readOwnDataValueOr(value, key, invalid);
}
function record(value: unknown, keys: readonly string[], knownKind?: string): Record<string, unknown> {
  if (!isPlainDataRecord(value)) return invalid();
  const fields = Reflect.ownKeys(value);
  if (fields.length > keys.length || fields.some(key => typeof key !== 'string' || !keys.includes(key))) return invalid();
  for (const key of fields) if (key !== 'kind' || knownKind === undefined) own(value, key as string);
  return value;
}
function text(value: unknown, limit: number, trim = true): string {
  if (typeof value !== 'string' || value.length > limit || (trim && !value.trim())) return invalid();
  return trim ? value.trim() : value;
}
function id(value: unknown): string {
  const result = text(value, 128);
  return ['__proto__', 'constructor', 'prototype'].includes(result) ? invalid() : result;
}
function optionalText(value: unknown, limit = 256): string | undefined {
  return value === undefined ? undefined : text(value, limit);
}
function boolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return typeof value === 'boolean' ? value : invalid();
}
function dense(value: unknown, limit: number): readonly unknown[] {
  if (!Array.isArray(value)) return invalid();
  const prototype = Object.getPrototypeOf(value) as object | null;
  const constructor = prototype && Object.getOwnPropertyDescriptor(prototype, 'constructor');
  if (!constructor || !Object.hasOwn(constructor, 'value') || typeof constructor.value !== 'function' ||
    Function.prototype.toString.call(constructor.value) !== Function.prototype.toString.call(Array) ||
    Object.getOwnPropertyDescriptor(constructor.value, 'prototype')?.value !== prototype) return invalid();
  const length = readOwnArrayLength(value);
  if (length === undefined || length > limit || Reflect.ownKeys(value).length !== length + 1) return invalid();
  const output: unknown[] = [];
  for (let index = 0; index < length; index++) {
    const descriptor = getOwnDataDescriptor(value, String(index));
    if (descriptor === MISSING_OWN_DATA_DESCRIPTOR || descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) return invalid();
    output.push(descriptor.value);
  }
  return output;
}
function coordinates(value: unknown): LyraMapSourceCoordinates {
  const corners = dense(value, 4);
  if (corners.length !== 4) return invalid();
  return Object.freeze(corners.map(corner => {
    const pair = dense(corner, 2);
    if (pair.length !== 2 || typeof pair[0] !== 'number' || !Number.isFinite(pair[0]) || Math.abs(pair[0]) > 180 ||
      typeof pair[1] !== 'number' || !Number.isFinite(pair[1]) || Math.abs(pair[1]) > 90) return invalid();
    return Object.freeze([pair[0], pair[1]] as const);
  })) as unknown as LyraMapSourceCoordinates;
}
function canvas(value: unknown): HTMLCanvasElement {
  try {
    const read = typeof HTMLCanvasElement === 'undefined' ? undefined : Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width')?.get;
    if (read && typeof Reflect.apply(read, value, []) === 'number') return value as HTMLCanvasElement;
  } catch { /* Invalid native identity. */ }
  return invalid();
}
function url(value: unknown, base: string, tiled = false): string {
  const input = text(value, 4096);
  const marker = 'lyratileplaceholder';
  if (input.toLowerCase().includes(marker) || base.toLowerCase().includes(marker)) return invalid();
  const tokens: string[] = [];
  const substituted = input.replace(/\{([^{}]+)\}/gu, (_match, token: string) => {
    if (!tiled || !TILE_TOKENS.has(token)) return invalid();
    tokens.push(token); return `${marker}${tokens.length - 1}token`;
  });
  if (/[{}]/u.test(substituted) || safeFetchUrl(substituted) === null) return invalid();
  const parsed = new URL(substituted, base);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return invalid();
  let result = parsed.href;
  for (const [index, token] of tokens.entries()) {
    const placeholder = `${marker}${index}token`;
    if (result.split(placeholder).length !== 2) return invalid();
    result = result.replace(placeholder, `{${token}}`);
  }
  return result.length <= 4096 ? result : invalid();
}
function zoomRange(value: object): readonly [number, number] {
  const authoredMin = own(value, 'minZoom'); const authoredMax = own(value, 'maxZoom');
  if (typeof authoredMin === 'number' && typeof authoredMax === 'number' && authoredMin > authoredMax) return invalid();
  const min = numeric(authoredMin, 0, 0, 24);
  const max = numeric(authoredMax, 24, 0, 24);
  return min <= max ? [min, max] : invalid();
}
export interface CanonicalMapRowPlacement {
  readonly before?: string;
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly requested: boolean;
}

/** Own-data projection shared by legacy GeoJSON rows and explicit source families. */
export function projectMapRowPlacement(value: unknown): CanonicalMapRowPlacement | undefined {
  try {
    if (value === null || typeof value !== 'object') return undefined;
    const [minZoom, maxZoom] = zoomRange(value);
    const before = own(value, 'before');
    const requested = ['before', 'minZoom', 'maxZoom'].some(key => getOwnDataDescriptor(value, key) !== MISSING_OWN_DATA_DESCRIPTOR);
    return Object.freeze({ minZoom, maxZoom, requested,
      ...(before === undefined ? {} : { before: id(before) }) });
  } catch { return undefined; }
}

function tileSource(value: unknown, kind: 'vector' | 'raster', base: string): Readonly<Record<string, unknown>> {
  const source = record(value, ['url', 'tiles', 'minZoom', 'maxZoom', 'attribution', 'scheme', ...(kind === 'raster' ? ['tileSize'] : [])]);
  const sourceUrl = own(source, 'url'); const tiles = own(source, 'tiles');
  if ((sourceUrl === undefined) === (tiles === undefined)) return invalid();
  const [minzoom, maxzoom] = zoomRange(source);
  const scheme = own(source, 'scheme');
  if (scheme !== undefined && scheme !== 'xyz' && scheme !== 'tms') return invalid();
  const attribution = own(source, 'attribution');
  const native: Record<string, unknown> = { type: kind,
    ...(own(source, 'minZoom') !== undefined ? { minzoom } : {}),
    ...(own(source, 'maxZoom') !== undefined ? { maxzoom } : {}), ...(scheme !== undefined ? { scheme } : {}) };
  if (sourceUrl !== undefined) native['url'] = url(sourceUrl, base);
  else {
    const entries = dense(tiles, 16);
    if (!entries.length) return invalid();
    native['tiles'] = Object.freeze(entries.map(entry => url(entry, base, true)));
  }
  if (attribution !== undefined) native['attribution'] = escapeHtml(text(attribution, 4096, false));
  if (kind === 'raster' && own(source, 'tileSize') !== undefined) native['tileSize'] = numeric(own(source, 'tileSize'), 512, 1, 4096);
  return Object.freeze(native);
}

/** Bounded native expression data, with no accessors, executable values, cycles or handles. */
export function projectMapLabelOptions(value: unknown): CanonicalMapLabel | undefined {
  try {
    const input = record(value, ['field', 'expression', 'placement', 'anchor', 'offset', 'size', 'color', 'haloColor', 'haloWidth', 'minZoom', 'font', 'allowOverlap', 'ignorePlacement']);
    const field = own(input, 'field'); const expression = own(input, 'expression');
    if ((field === undefined) === (expression === undefined)) return undefined;
    let count = 0; let bytes = 0; const path = new WeakSet<object>(); const encoder = new TextEncoder();
    const clone = (entry: unknown, depth: number): LyraMapLabelValue => {
      if (++count > 4096 || depth > 12) return invalid();
      if (entry === null || typeof entry === 'boolean') return entry;
      if (typeof entry === 'number') return Number.isFinite(entry) ? entry : invalid();
      if (typeof entry === 'string') {
        if (entry.length > 65_536 - bytes) return invalid();
        bytes += encoder.encode(entry).length; return bytes <= 65_536 ? entry : invalid();
      }
      if (typeof entry !== 'object' || path.has(entry)) return invalid();
      path.add(entry);
      try {
        if (Array.isArray(entry)) return Object.freeze(dense(entry, 4096).map(child => clone(child, depth + 1)));
        if (!isPlainDataRecord(entry)) return invalid();
        const keys = Reflect.ownKeys(entry);
        if (keys.length > 4096) return invalid();
        const result: Record<string, LyraMapLabelValue> = Object.create(null) as Record<string, LyraMapLabelValue>;
        for (const key of keys) {
          if (typeof key !== 'string' || ['__proto__', 'prototype', 'constructor'].includes(key)) return invalid();
          clone(key, depth + 1); result[key] = clone(own(entry, key), depth + 1);
        }
        return Object.freeze(result);
      } finally { path.delete(entry); }
    };
    const projected = field !== undefined ? Object.freeze(['get', text(field, 128)]) : clone(expression, 0);
    if (!Array.isArray(projected) || !projected.length || typeof projected[0] !== 'string') return undefined;
    const authoredPlacement = own(input, 'placement');
    const placement = authoredPlacement === undefined ? 'point' : authoredPlacement;
    if (placement !== 'point' && placement !== 'line') return undefined;
    const anchor = own(input, 'anchor');
    if (Object.hasOwn(input, 'anchor') && (typeof anchor !== 'string' ||
      !['center', 'left', 'right', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(anchor))) return undefined;
    const offsetInput = own(input, 'offset');
    const offset = Object.hasOwn(input, 'offset') ? dense(offsetInput, 2) : undefined;
    if (offset && (offset.length !== 2 || offset.some(value => typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 16))) return undefined;
    const size = numeric(own(input, 'size'), 12, 1, 128);
    const fonts = own(input, 'font');
    const font = fonts === undefined ? undefined : Object.freeze(dense(fonts, 8).map(entry => text(entry, 128)));
    if (font?.length === 0) return undefined;
    return Object.freeze({ expression: projected as readonly LyraMapLabelValue[], placement, size,
      ...(anchor === undefined ? {} : { anchor: anchor as LyraMapLabelAnchor }),
      ...(offset === undefined ? {} : { offset: Object.freeze([offset[0], offset[1]]) as readonly [number, number] }),
      color: optionalText(own(input, 'color')), haloColor: optionalText(own(input, 'haloColor')),
      haloWidth: numeric(own(input, 'haloWidth'), 0, 0, size / 4), minZoom: numeric(own(input, 'minZoom'), 0, 0, 24),
      font, allowOverlap: boolean(own(input, 'allowOverlap'), false), ignorePlacement: boolean(own(input, 'ignorePlacement'), false) });
  } catch { return undefined; }
}

function external(value: unknown, base: string, ownerOrigin: string, kind: unknown): CanonicalMapExternalLayer {
  if (!isPlainDataRecord(value)) return invalid();
  if (typeof kind !== 'string' || !EXTERNAL_KINDS.has(kind)) return invalid();
  const extra = kind === 'vector' ? ['source', 'sourceLayer', 'render', 'color', 'strokeColor', 'width', 'radius', 'categoryField', 'label', 'paint', 'layout', 'filter']
    : kind === 'raster' ? ['source'] : kind === 'image' ? ['url', 'coordinates'] : ['canvas', 'coordinates', 'animate', 'redrawRevision'];
  const input = record(value, [...COMMON_KEYS, ...extra], kind);
  const [minZoom, maxZoom] = zoomRange(input);
  const source = kind === 'vector' || kind === 'raster' ? tileSource(own(input, 'source'), kind, base)
    : Object.freeze({ type: kind, coordinates: coordinates(own(input, 'coordinates')),
      ...(kind === 'image' ? { url: projectMapLocalImageUrl(own(input, 'url'), ownerOrigin)?.url ?? url(own(input, 'url'), base) } : { canvas: canvas(own(input, 'canvas')), animate: boolean(own(input, 'animate'), true) }) });
  const authoredRevision = kind === 'canvas' ? own(input, 'redrawRevision') : undefined;
  const revision = kind === 'canvas' ? (authoredRevision === undefined ? 0 : authoredRevision) : undefined;
  if (revision !== undefined && (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0)) return invalid();
  const render = kind === 'vector' ? own(input, 'render') : 'raster';
  if (render !== 'line' && render !== 'circle' && render !== 'fill' && render !== 'symbol' && render !== 'raster') return invalid();
  if (kind === 'vector' && render === 'raster') return invalid();
  const labelInput = own(input, 'label');
  const label = labelInput === undefined ? undefined : projectMapLabelOptions(labelInput);
  if (labelInput !== undefined && !label) return invalid();
  const style = kind === 'vector' && render !== 'raster' ? projectMapVectorStyle({ render, hasLabel: label !== undefined,
    ...(Object.hasOwn(input, 'paint') ? { paint: own(input, 'paint') } : {}),
    ...(Object.hasOwn(input, 'layout') ? { layout: own(input, 'layout') } : {}),
    ...(Object.hasOwn(input, 'filter') ? { filter: own(input, 'filter') } : {}),
  }) : undefined;
  if (kind === 'vector' && !style) return invalid();
  if (label && Math.max(minZoom, label.minZoom) > maxZoom) return invalid();
  return Object.freeze({ ...projectMapInteractionOptions(input), sourceId: id(own(input, 'sourceId')), kind: kind as CanonicalMapExternalLayer['kind'], source,
    ...(revision === undefined ? {} : { redrawRevision: revision as number }),
    sourceLayer: kind === 'vector' ? text(own(input, 'sourceLayer'), 128) : undefined,
    render, before: own(input, 'before') === undefined ? undefined : id(own(input, 'before')),
    minZoom, maxZoom, opacity: numeric(own(input, 'opacity'), 1, 0, 1), category: optionalText(own(input, 'category'), 128),
    categoryField: optionalText(own(input, 'categoryField'), 128), color: optionalText(own(input, 'color')),
    strokeColor: optionalText(own(input, 'strokeColor')), width: numeric(own(input, 'width'), 2, 0, 100),
    radius: numeric(own(input, 'radius'), 4, 0, 200), label, ...(style ? { style } : {}) });
}
export type MapDataLayerModel<T> = { readonly ok: true; readonly geojson: readonly T[]; readonly external: readonly CanonicalMapExternalLayer[] } | { readonly ok: false };

/** Mixed first-100 admission; legacy row validation remains with its existing projector. */
export function projectMapDataLayerModel<T extends { readonly sourceId: string }>(value: unknown, options: {
  readonly baseUrl: string; readonly ownerOrigin?: string; readonly projectGeoJson: (row: unknown, kind: OwnDataDescriptorResult) => T | undefined;
}): MapDataLayerModel<T> {
  let requestedExternal = false;
  let invalidPlacement = false;
  try {
    const geojson: T[] = []; const sources: CanonicalMapExternalLayer[] = []; const seen = new Set<string>();
    if (!Array.isArray(value)) return Object.freeze({ ok: true, geojson: Object.freeze(geojson), external: Object.freeze(sources) });
    const length = readOwnArrayLength(value);
    if (length === undefined) return { ok: true, geojson: Object.freeze([]), external: Object.freeze([]) };
    for (let index = 0; index < Math.min(length, 100); index++) {
      const entry = getOwnDataDescriptor(value, String(index));
      if (entry === MISSING_OWN_DATA_DESCRIPTOR || entry === UNSAFE_OWN_DATA_DESCRIPTOR) continue;
      const row = entry.value;
      const descriptor = row !== null && typeof row === 'object' ? getOwnDataDescriptor(row, 'kind') : MISSING_OWN_DATA_DESCRIPTOR;
      const kind = descriptor === MISSING_OWN_DATA_DESCRIPTOR || descriptor === UNSAFE_OWN_DATA_DESCRIPTOR ? undefined : descriptor.value;
      if (typeof kind === 'string' && EXTERNAL_KINDS.has(kind)) {
        requestedExternal = true;
        const layer = external(row, options.baseUrl, options.ownerOrigin ?? 'null', kind);
        if (seen.has(layer.sourceId)) continue;
        if (sources.length >= 32) return { ok: false };
        seen.add(layer.sourceId); sources.push(layer);
      } else {
        if (row !== null && typeof row === 'object' &&
          ['before', 'minZoom', 'maxZoom'].some(key => getOwnDataDescriptor(row, key) !== MISSING_OWN_DATA_DESCRIPTOR) &&
          !projectMapRowPlacement(row)) { invalidPlacement = true; return { ok: false }; }
        const layer = options.projectGeoJson(row, descriptor);
        if (!layer || seen.has(layer.sourceId)) continue;
        seen.add(layer.sourceId); geojson.push(layer);
      }
    }
    return Object.freeze({ ok: true, geojson: Object.freeze(geojson), external: Object.freeze(sources) });
  } catch { return requestedExternal || invalidPlacement ? { ok: false } : { ok: true, geojson: Object.freeze([]), external: Object.freeze([]) }; }
}

