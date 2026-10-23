import { resolveGuardedRel } from '../../../internal/link-rel.js';
import { getOwnDataDescriptor, isPlainDataRecord, MISSING_OWN_DATA_DESCRIPTOR, UNSAFE_OWN_DATA_DESCRIPTOR } from '../../../internal/data-descriptors.js';

export type MapOwnedControlKind = 'navigation' | 'scale' | 'geolocate' | 'attribution';
/** Corner a declarative control is added to. The corners follow text direction under RTL. */
export type LyraMapControlPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
/** Unit system of the scale control. */
export type LyraMapScaleUnit = 'metric' | 'imperial';
/** Options of the declarative navigation control (zoom buttons and compass). */
export interface LyraMapNavigationControlOptions {
  /** Corner to add the control to. Defaults to `'top-right'`. */
  readonly position?: LyraMapControlPosition;
}
/** Options of the declarative scale control. */
export interface LyraMapScaleControlOptions {
  /** Corner to add the control to. Defaults to `'bottom-left'`. */
  readonly position?: LyraMapControlPosition;
  /** Unit system. Defaults to `'metric'`. */
  readonly unit?: LyraMapScaleUnit;
}
/** Options of the declarative geolocation control. */
export interface LyraMapGeolocateControlOptions extends LyraMapNavigationControlOptions {
  readonly trackUserLocation?: boolean;
  readonly showUserLocation?: boolean;
  readonly showAccuracyCircle?: boolean;
  readonly zoomToUserAccuracy?: boolean;
  readonly positionOptions?: { readonly enableHighAccuracy?: boolean; readonly timeout?: number; readonly maximumAge?: number };
  readonly fitBoundsOptions?: { readonly maxZoom?: number };
}
/** A text credit linked to an absolute HTTP(S) URL; admission takes an immutable own-data snapshot. */
export interface LyraMapAttributionLink {
  /** Escaped display text, at most 4,096 characters. */
  readonly label: string;
  /** Absolute HTTP(S) URL, at most 2,048 characters, without credentials or control characters. */
  readonly url: string;
}
/** Options of the declarative attribution control. */
export interface LyraMapAttributionControlOptions extends LyraMapNavigationControlOptions {
  /** Omission retains the peer's automatic compact layout. */
  readonly compact?: boolean;
  /** Text or guarded links; at most 32 items and 16 KiB of labels and URLs. Caller HTML is never interpreted. */
  readonly customAttribution?: string | LyraMapAttributionLink | readonly (string | LyraMapAttributionLink)[];
}
export interface NormalizedMapControlOptions {
  readonly kind: MapOwnedControlKind;
  readonly position: LyraMapControlPosition;
  readonly unit: LyraMapScaleUnit | undefined;
  readonly options: Readonly<Record<string, unknown>>;
  readonly key: string;
  /** Escaped labels only, for text export without URLs or link markup. */
  readonly attributionText?: readonly string[];
}
export interface MapControlOptionsResult {
  readonly controls: ReadonlyMap<MapOwnedControlKind, NormalizedMapControlOptions>;
  readonly diagnostics: readonly { readonly kind: MapOwnedControlKind; readonly code: 'invalid-options' }[];
}
const positions = new Set<LyraMapControlPosition>(['top-left', 'top-right', 'bottom-left', 'bottom-right']);
function runtimeRecord(input: unknown): input is object { try { return input !== null && typeof input === 'object' && !Array.isArray(input); } catch { return false; } }
function own(input: object, key: string): unknown {
  const descriptor = getOwnDataDescriptor(input, key);
  if (descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) throw new TypeError('Unsafe control option');
  return descriptor === MISSING_OWN_DATA_DESCRIPTOR ? undefined : descriptor.value;
}
function optionalLegacy(input: object, key: string): unknown { try { return own(input, key); } catch { return undefined; } }
function plain(input: unknown): object { if (!isPlainDataRecord(input)) throw new TypeError('Expected plain control options'); return input; }
function bool(input: object, key: string, fallback: boolean): boolean {
  const value = own(input, key); if (value === undefined) return fallback;
  if (typeof value !== 'boolean') throw new TypeError('Invalid boolean control option'); return value;
}
function number(input: object, key: string, fallback: number, maximum: number): number {
  const value = own(input, key); if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > maximum) throw new RangeError('Invalid numeric control option'); return value;
}
function position(input: object, fallback: LyraMapControlPosition): LyraMapControlPosition {
  const value = own(input, 'position'); if (value === undefined) return fallback;
  if (!positions.has(value as LyraMapControlPosition)) throw new TypeError('Invalid control position'); return value as LyraMapControlPosition;
}
const escapeText = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
function attributionText(input: unknown): { readonly html: string | readonly string[]; readonly text: readonly string[] } {
  let total = 0;
  const labels: string[] = [];
  const text = (value: unknown): string => {
    if (typeof value !== 'string' || value.length > 4096 || (total += value.length) > 16384) throw new RangeError('Attribution text limit');
    return escapeText(value);
  };
  const item = (value: unknown): string => {
    if (typeof value === 'string') { const label = text(value); labels.push(label); return label; }
    const record = plain(value);
    const label = text(own(record, 'label')), raw = own(record, 'url');
    if (typeof raw !== 'string' || raw.length > 2048 || /[\u0000-\u0020\u007f-\u009f]/.test(raw)) throw new TypeError('Invalid attribution URL');
    const url = new URL(raw);
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password ||
      url.href.length > 2048 || (total += url.href.length) > 16384) throw new TypeError('Invalid attribution URL');
    const snapshot = Object.freeze({ label, url: url.href });
    labels.push(snapshot.label);
    return `<a href="${escapeText(snapshot.url)}" target="_blank" rel="${resolveGuardedRel(undefined, '_blank')}">${snapshot.label}</a>`;
  };
  let html: string | readonly string[];
  if (!Array.isArray(input)) html = item(input);
  else {
    const length = own(input, 'length'); if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 || length > 32) throw new RangeError('Attribution count limit');
    const result: string[] = []; for (let index = 0; index < length; index++) result.push(item(own(input, String(index))));
    html = Object.freeze(result);
  }
  return Object.freeze({ html, text: Object.freeze(labels) });
}
/**
 * Detached constructor options only. No permission requests, geolocation calls, DOM work or
 * activation occur here. Navigation/scale preserve their existing malformed-field defaults;
 * malformed new controls are excluded with stable diagnostics. Unknown fields are not forwarded.
 */
export function normalizeMapControlOptions(input: unknown): MapControlOptionsResult {
  const controls = new Map<MapOwnedControlKind, NormalizedMapControlOptions>();
  const diagnostics: { kind: MapOwnedControlKind; code: 'invalid-options' }[] = [];
  const done = (): MapControlOptionsResult => Object.freeze({ controls, diagnostics: Object.freeze(diagnostics.map((item) => Object.freeze(item))) });
  if (!runtimeRecord(input)) return done();
  for (const kind of ['navigation', 'scale', 'geolocate', 'attribution'] as const) {
    try {
      const value = kind === 'navigation' || kind === 'scale' ? optionalLegacy(input, kind) : own(input, kind);
      if (value === undefined || value === false) continue;
      if (kind === 'navigation' || kind === 'scale') {
        if (value !== true && !runtimeRecord(value)) continue;
        const entry = value === true ? {} : value;
        const fallback = kind === 'navigation' ? 'top-right' : 'bottom-left';
        const requested = optionalLegacy(entry, 'position');
        const corner = positions.has(requested as LyraMapControlPosition) ? requested as LyraMapControlPosition : fallback;
        const unit = kind === 'scale' ? optionalLegacy(entry, 'unit') === 'imperial' ? 'imperial' : 'metric' : undefined;
        controls.set(kind, Object.freeze({ kind, position: corner, unit, options: Object.freeze(kind === 'scale' ? { unit } : {}), key: `${corner}:${unit ?? ''}` }));
        continue;
      }
      const entry = value === true ? {} : plain(value);
      const corner = position(entry, kind === 'geolocate' ? 'top-right' : 'bottom-right');
      let options: Readonly<Record<string, unknown>>;
      let attributionLabels: readonly string[] | undefined;
      if (kind === 'geolocate') {
        const rawPosition = own(entry, 'positionOptions'), rawFit = own(entry, 'fitBoundsOptions');
        const positionOptions = rawPosition === undefined ? {} : plain(rawPosition), fit = rawFit === undefined ? {} : plain(rawFit);
        const showUserLocation = bool(entry, 'showUserLocation', true), showAccuracyCircle = bool(entry, 'showAccuracyCircle', true);
        const zoomToUserAccuracy = own(entry, 'zoomToUserAccuracy');
        if (zoomToUserAccuracy !== undefined && typeof zoomToUserAccuracy !== 'boolean') throw new TypeError('Invalid zoom option');
        options = Object.freeze({ trackUserLocation: bool(entry, 'trackUserLocation', false), showUserLocation, showAccuracyCircle: showUserLocation && showAccuracyCircle,
          positionOptions: Object.freeze({ enableHighAccuracy: bool(positionOptions, 'enableHighAccuracy', false), timeout: number(positionOptions, 'timeout', 6000, 86400000), maximumAge: number(positionOptions, 'maximumAge', 0, 86400000) }),
          fitBoundsOptions: Object.freeze({ maxZoom: number(fit, 'maxZoom', 15, 24) }),
          ...(zoomToUserAccuracy === undefined ? {} : { zoomToUserAccuracy }),
        });
      } else {
        const compact = own(entry, 'compact'), custom = own(entry, 'customAttribution');
        if (compact !== undefined && typeof compact !== 'boolean') throw new TypeError('Invalid attribution mode');
        const credits = custom === undefined ? undefined : attributionText(custom);
        attributionLabels = credits?.text;
        options = Object.freeze({ ...(compact === undefined ? {} : { compact }), ...(credits === undefined ? {} : { customAttribution: credits.html }) });
      }
      controls.set(kind, Object.freeze({ kind, position: corner, unit: undefined, options, ...(attributionLabels ? { attributionText: attributionLabels } : {}), key: `${corner}:${JSON.stringify(options)}` }));
    } catch { diagnostics.push({ kind, code: 'invalid-options' }); }
  }
  return done();
}
export type LyraMapGeolocationErrorCode = 'permission-denied' | 'position-unavailable' | 'timeout' | 'unknown';
/** Map an already extracted native numeric error code; do not inspect native messages or locations. */
export function mapGeolocationErrorCode(code: unknown): LyraMapGeolocationErrorCode {
  return code === 1 ? 'permission-denied' : code === 2 ? 'position-unavailable' : code === 3 ? 'timeout' : 'unknown';
}
