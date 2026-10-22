import { isPlainDataRecord } from '../../../internal/data-descriptors.js';

export interface MapHashCamera {
  readonly zoom: number;
  readonly center: readonly [number, number];
  readonly bearing: number;
  readonly pitch: number;
}
export type MapInitialBounds = readonly [readonly [number, number], readonly [number, number]];
export type MapHashOptionResult = { readonly status: 'enabled'; readonly key: string } | { readonly status: 'disabled' | 'invalid' };
export type MapHashReadResult = { readonly status: 'camera'; readonly camera: MapHashCamera } | { readonly status: 'disabled' | 'none' | 'invalid' };
export interface MapHashWriteResult { readonly status: 'written' | 'disabled' | 'invalid'; readonly fragment: string; }
export type MapInitialView = { readonly kind: 'hash' | 'camera'; readonly camera: MapHashCamera } | { readonly kind: 'bounds'; readonly bounds: MapInitialBounds } | { readonly kind: 'none' | 'invalid' };
const UNSAFE = Symbol('unsafe-data');
const MAX_FRAGMENT = 65536, MAX_TOKENS = 1024;
function own(value: unknown, key: string): unknown {
  if (value === null || typeof value !== 'object') return UNSAFE;
  try { const descriptor = Object.getOwnPropertyDescriptor(value, key); return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : UNSAFE; } catch { return UNSAFE; }
}
function fields(value: unknown, allowed: readonly string[]): readonly string[] | undefined {
  if (!isPlainDataRecord(value)) return undefined;
  try {
    const keys = Reflect.ownKeys(value);
    if (keys.length > allowed.length || keys.some((key) => typeof key !== 'string' || !allowed.includes(key) || own(value, key) === UNSAFE)) return undefined;
    return keys as string[];
  } catch { return undefined; }
}
function pair(value: unknown): readonly [unknown, unknown] | undefined {
  try { if (!Array.isArray(value) || own(value, 'length') !== 2 || Reflect.ownKeys(value).length !== 3) return undefined; } catch { return undefined; }
  const first = own(value, '0'), second = own(value, '1'); return first === UNSAFE || second === UNSAFE ? undefined : [first, second];
}
const number = (value: unknown, minimum: number, maximum: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
function cameraOf(value: unknown): MapHashCamera | undefined {
  const keys = fields(value, ['zoom', 'center', 'bearing', 'pitch']); if (!keys) return undefined;
  const zoom = own(value, 'zoom'), center = pair(own(value, 'center'));
  const bearing = keys.includes('bearing') ? own(value, 'bearing') : 0, pitch = keys.includes('pitch') ? own(value, 'pitch') : 0;
  if (!number(zoom, 0, 24) || !center || !number(center[0], -180, 180) || !number(center[1], -90, 90) || !number(bearing, -360, 360) || !number(pitch, 0, 85)) return undefined;
  return Object.freeze({ zoom, center: Object.freeze([center[0], center[1]] as const), bearing, pitch });
}
/** Named fragment fields only; native unnamed map hashes remain opaque and untouched. */
export function admitMapHashOption(value: unknown): MapHashOptionResult {
  if (value === false || value === undefined || value === null) return Object.freeze({ status: 'disabled' });
  if (value === true) return Object.freeze({ status: 'enabled', key: 'map' });
  return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value) ? Object.freeze({ status: 'enabled', key: value }) : Object.freeze({ status: 'invalid' });
}
interface Fragment { readonly prefix: string; readonly tokens: readonly string[]; readonly owned: readonly number[]; }
function fragmentOf(fragment: unknown, key: string): Fragment | undefined {
  if (typeof fragment !== 'string' || fragment.length > MAX_FRAGMENT) return undefined;
  const prefix = fragment.startsWith('#') ? '#' : '', body = fragment.slice(prefix.length);
  const tokens = body ? body.split('&') : []; if (tokens.length > MAX_TOKENS) return undefined;
  const owned: number[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]!, separator = token.indexOf('=');
    if (separator < 0) continue;
    const rawKey = token.slice(0, separator);
    try { if (decodeURIComponent(rawKey) === key) owned.push(index); } catch { /* Unrelated malformed keys remain opaque. */ }
  }
  return { prefix, tokens, owned };
}
function cameraAt(fragment: Fragment, index: number): MapHashCamera | undefined {
  const token = fragment.tokens[index]!, separator = token.indexOf('='); if (separator < 0) return undefined;
  let decoded: string; try { decoded = decodeURIComponent(token.slice(separator + 1)); } catch { return undefined; }
  const parts = decoded.split('/'); if (parts.length < 3 || parts.length > 5 || !parts.every((part) => /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(part))) return undefined;
  const values = parts.map((part) => Number(part));
  return cameraOf({ zoom: values[0], center: [values[2], values[1]], bearing: values[3] ?? 0, pitch: values[4] ?? 0 });
}
export function readMapHash(fragment: string, option: unknown): MapHashReadResult {
  const enabled = admitMapHashOption(option); if (enabled.status !== 'enabled') return Object.freeze({ status: enabled.status });
  const parsed = fragmentOf(fragment, enabled.key); if (!parsed || parsed.owned.length > 1) return Object.freeze({ status: 'invalid' });
  if (!parsed.owned.length) return Object.freeze({ status: 'none' });
  const camera = cameraAt(parsed, parsed.owned[0]!); return camera ? Object.freeze({ status: 'camera', camera }) : Object.freeze({ status: 'invalid' });
}
function unchanged(fragment: string, status: 'disabled' | 'invalid'): MapHashWriteResult { return Object.freeze({ status, fragment: typeof fragment === 'string' ? fragment : '' }); }
function written(fragment: string): MapHashWriteResult { return Object.freeze({ status: 'written', fragment }); }

function decimal(value: number): string {
  const text = String(value); if (!/[eE]/.test(text)) return text;
  const [mantissa, exponent] = text.split(/[eE]/), negative = mantissa!.startsWith('-');
  const [whole, fraction = ''] = (negative ? mantissa!.slice(1) : mantissa!).split('.');
  const digits = whole! + fraction, position = whole!.length + Number(exponent);
  const expanded = position <= 0 ? `0.${'0'.repeat(-position)}${digits}` : position >= digits.length ? digits + '0'.repeat(position - digits.length) : `${digits.slice(0, position)}.${digits.slice(position)}`;
  return negative ? `-${expanded}` : expanded;
}
/** Replace one owned token in place, or append it without normalizing unrelated tokens. */
export function replaceMapHash(fragment: string, option: unknown, cameraInput: unknown): MapHashWriteResult {
  const enabled = admitMapHashOption(option); if (enabled.status !== 'enabled') return unchanged(fragment, enabled.status);
  const parsed = fragmentOf(fragment, enabled.key), camera = cameraOf(cameraInput);
  if (!parsed || !camera || parsed.owned.length > 1 || parsed.owned.length === 1 && !cameraAt(parsed, parsed.owned[0]!)) return unchanged(fragment, 'invalid');
  const values = [camera.zoom, camera.center[1], camera.center[0]];
  if (camera.bearing !== 0 || camera.pitch !== 0) values.push(camera.bearing);
  if (camera.pitch !== 0) values.push(camera.pitch);
  const token = `${enabled.key}=${values.map(decimal).join('/')}`, tokens = [...parsed.tokens];
  if (parsed.owned.length) tokens[parsed.owned[0]!] = token; else tokens.push(token);
  const output = `${parsed.prefix || '#'}${tokens.join('&')}`;
  return output.length <= MAX_FRAGMENT && tokens.length <= MAX_TOKENS ? written(output) : unchanged(fragment, 'invalid');
}
/** Explicit cleanup owns all exact matching fields, even duplicate or malformed values. */
export function removeMapHash(fragment: string, option: unknown): MapHashWriteResult {
  const enabled = admitMapHashOption(option); if (enabled.status !== 'enabled') return unchanged(fragment, enabled.status);
  const parsed = fragmentOf(fragment, enabled.key); if (!parsed) return unchanged(fragment, 'invalid');
  if (!parsed.owned.length) return written(fragment);
  const owned = new Set(parsed.owned), tokens = parsed.tokens.filter((_token, index) => !owned.has(index));
  return written(tokens.length ? `${parsed.prefix}${tokens.join('&')}` : '');
}
/** A fit request, independent of the component's maxBounds camera constraint. */
export function normalizeMapInitialBounds(value: unknown): MapInitialBounds | undefined {
  const corners = pair(value); if (!corners) return undefined;
  const southWest = pair(corners[0]), northEast = pair(corners[1]); if (!southWest || !northEast) return undefined;
  const [west, south] = southWest, [east, north] = northEast;
  if (!number(west, -180, 180) || !number(east, -180, west + 360) || !number(south, -90, 90) || !number(north, -90, 90) || south > north) return undefined;
  return Object.freeze([Object.freeze([west, south] as const), Object.freeze([west > east ? east + 360 : east, north] as const)] as const);
}
/** Deterministic initial choice; malformed/disabled hash falls through to bounds or camera. */
export function chooseMapInitialView(input: unknown): MapInitialView {
  const keys = fields(input, ['fragment', 'hash', 'bounds', 'camera']); if (!keys) return Object.freeze({ kind: 'invalid' });
  const fragment = keys.includes('fragment') ? own(input, 'fragment') : '';
  const parsed = readMapHash(typeof fragment === 'string' ? fragment : '', keys.includes('hash') ? own(input, 'hash') : undefined);
  if (parsed.status === 'camera') return Object.freeze({ kind: 'hash', camera: parsed.camera });
  const bounds = normalizeMapInitialBounds(own(input, 'bounds')); if (bounds) return Object.freeze({ kind: 'bounds', bounds });
  const camera = cameraOf(own(input, 'camera')); return camera ? Object.freeze({ kind: 'camera', camera }) : Object.freeze({ kind: 'none' });
}
