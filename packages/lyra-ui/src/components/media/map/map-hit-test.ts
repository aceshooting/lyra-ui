import { getInheritedPropertyDescriptor, isPlainDataRecord } from '../../../internal/data-descriptors.js';

export interface MapHitRule {
  readonly layerId: string;
  readonly owner: 'overlay' | 'basemap';
  readonly interactive?: boolean;
  readonly priority?: number;
}
export type LyraMapFeatureValue = null | boolean | number | string | readonly LyraMapFeatureValue[] | { readonly [key: string]: LyraMapFeatureValue };
export interface MapHit {
  readonly layerId: string;
  readonly owner: MapHitRule['owner'];
  readonly source?: string;
  readonly sourceLayer?: string;
  readonly id?: string | number;
  readonly properties: { readonly [key: string]: LyraMapFeatureValue };
}
export type MapHitResult =
  | { readonly status: 'hit'; readonly hit: MapHit; readonly featureIndex: number }
  | { readonly status: 'none' | 'query-error' | 'stale' }
  | { readonly status: 'invalid'; readonly reason: 'rules' | 'layers' | 'features' | 'point' };
export type MapHitRulesResult =
  | { readonly status: 'ready'; readonly rules: readonly MapHitRule[] }
  | { readonly status: 'invalid'; readonly reason: 'rules' };
export interface MapHitQueryService {
  getLayer(id: string): unknown;
  queryRenderedFeatures(point: { readonly x: number; readonly y: number }, options: { readonly layers: readonly string[] }): unknown;
}
export interface MapHitQueryBoundary { readonly signal?: AbortSignal; readonly current?: () => boolean }
const MAX_LAYERS = 4096, MAX_FEATURES = 10000, MAX_ID = 1024;
const OMIT = Symbol('omitted-data');
function object(value: unknown): value is object { return value !== null && typeof value === 'object'; }
function own(value: unknown, key: PropertyKey): unknown {
  if (!object(value)) return OMIT;
  try { const descriptor = Object.getOwnPropertyDescriptor(value, key); return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : OMIT; }
  catch { return OMIT; }
}
function keys(value: object): readonly PropertyKey[] | undefined { try { return Reflect.ownKeys(value); } catch { return undefined; } }
function id(value: unknown): value is string { return typeof value === 'string' && value.length <= MAX_ID && value.trim().length > 0; }
function length(value: unknown, cap: number): number | undefined {
  try { if (!Array.isArray(value)) return undefined; } catch { return undefined; }
  const count = own(value, 'length'); return typeof count === 'number' && Number.isSafeInteger(count) && count >= 0 && count <= cap ? count : undefined;
}
function invalid(reason: 'rules' | 'layers' | 'features' | 'point'): MapHitResult { return Object.freeze({ status: 'invalid', reason }); }
function status(value: 'none' | 'query-error' | 'stale'): MapHitResult { return Object.freeze({ status: value }); }

/** Admit the complete rule set atomically. Basemap membership is always explicit. */
export function admitMapHitRules(input: unknown): MapHitRulesResult {
  const fail = (): MapHitRulesResult => Object.freeze({ status: 'invalid', reason: 'rules' });
  const count = length(input, MAX_LAYERS); if (count === undefined) return fail();
  const rules: MapHitRule[] = [], seen = new Set<string>();
  for (let index = 0; index < count; index++) {
    const entry = own(input, String(index)); if (!object(entry)) return fail();
    if (!isPlainDataRecord(entry)) return fail();
    const names = keys(entry); if (!names || names.length > 4 || names.some((key) => typeof key !== 'string' || !['layerId', 'owner', 'interactive', 'priority'].includes(key))) return fail();
    const layerId = own(entry, 'layerId'), owner = own(entry, 'owner');
    const interactiveValue = own(entry, 'interactive'), priorityValue = own(entry, 'priority');
    // Accessors are invalid even on optional members; missing members alone get defaults.
    let interactive: unknown = true, priority: unknown = 0;
    if (names.includes('interactive')) interactive = interactiveValue;
    if (names.includes('priority')) priority = priorityValue;
    if (!id(layerId) || seen.has(layerId) || (owner !== 'overlay' && owner !== 'basemap') || typeof interactive !== 'boolean' || typeof priority !== 'number' || !Number.isFinite(priority) || Math.abs(priority) > 1e6) return fail();
    seen.add(layerId); rules.push(Object.freeze({ layerId, owner, interactive, priority }));
  }
  return Object.freeze({ status: 'ready', rules: Object.freeze(rules) });
}

interface Budget { entries: number; chars: number; readonly stack: Set<object> }
function sanitize(value: unknown, depth: number, budget: Budget): LyraMapFeatureValue | typeof OMIT {
  if (budget.entries >= 1024) return OMIT;
  budget.entries++;
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : OMIT;
  if (typeof value === 'string') { if (value.length > 4096 || budget.chars + value.length > 65536) return OMIT; budget.chars += value.length; return value; }
  if (!object(value) || depth >= 4 || budget.stack.has(value)) return OMIT;
  budget.stack.add(value);
  try {
    let array = false; try { array = Array.isArray(value); } catch { return OMIT; }
    if (array) {
      const count = length(value, 128); if (count === undefined) return OMIT;
      const result: LyraMapFeatureValue[] = [];
      for (let index = 0; index < count; index++) { const entry = sanitize(own(value, String(index)), depth + 1, budget); result.push(entry === OMIT ? null : entry); }
      return Object.freeze(result);
    }
    const names = keys(value); if (!names || names.length > 128) return OMIT;
    const result: Record<string, LyraMapFeatureValue> = Object.create(null) as Record<string, LyraMapFeatureValue>;
    for (const key of names) {
      if (typeof key !== 'string' || key.length > MAX_ID || ['__proto__', 'prototype', 'constructor'].includes(key) || budget.chars + key.length > 65536 || budget.entries >= 1024) continue;
      budget.chars += key.length;
      const entry = sanitize(own(value, key), depth + 1, budget); if (entry === OMIT) continue;
      result[key] = entry;
    }
    return Object.freeze(result);
  } finally { budget.stack.delete(value); }
}
function snapshot(feature: unknown, rule: MapHitRule): MapHit {
  const source = own(feature, 'source'), sourceLayer = own(feature, 'sourceLayer'), featureId = own(feature, 'id');
  const properties = own(feature, 'properties');
  const clean = object(properties) && length(properties, 128) === undefined ? sanitize(properties, 0, { entries: 0, chars: 0, stack: new Set() }) : OMIT;
  return Object.freeze({ layerId: rule.layerId, owner: rule.owner,
    ...(id(source) ? { source } : {}), ...(id(sourceLayer) ? { sourceLayer } : {}),
    ...(typeof featureId === 'number' && Number.isFinite(featureId) || typeof featureId === 'string' && featureId.length <= MAX_ID ? { id: featureId as string | number } : {}),
    properties: clean !== OMIT && object(clean) && !Array.isArray(clean) ? clean as MapHit['properties'] : Object.freeze({}),
  });
}
function admittedLayers(input: unknown): readonly string[] | undefined {
  const count = length(input, MAX_LAYERS); if (count === undefined) return undefined;
  const result: string[] = [];
  for (let index = 0; index < count; index++) { const value = own(input, String(index)); if (!id(value)) return undefined; result.push(value); }
  return result;
}
function select(features: unknown, rules: readonly MapHitRule[], existing: readonly string[], strictMembership = false): MapHitResult {
  const count = length(features, MAX_FEATURES); if (count === undefined) return invalid('features');
  const live = new Set(existing), enabled = new Map(rules.filter((rule) => rule.interactive && live.has(rule.layerId)).map((rule) => [rule.layerId, rule]));
  let winner: unknown, winningRule: MapHitRule | undefined, featureIndex = -1;
  for (let index = 0; index < count; index++) {
    const feature = own(features, String(index)), layer = own(feature, 'layer'), layerId = own(layer, 'id');
    if (!object(feature) || !object(layer) || !id(layerId)) return invalid('features');
    if (strictMembership && !enabled.has(layerId)) return invalid('features');
    const rule = typeof layerId === 'string' ? enabled.get(layerId) : undefined;
    if (!rule || winningRule && rule.priority! <= winningRule.priority!) continue;
    winner = feature; winningRule = rule; featureIndex = index;
  }
  return winningRule ? Object.freeze({ status: 'hit', hit: snapshot(winner, winningRule), featureIndex }) : status('none');
}
/** The engine's order breaks ties. Geometry/visibility is owned by its rendered-feature query. */
export function selectMapHit(features: unknown, rules: unknown, existingLayerIds: unknown): MapHitResult {
  const admitted = admitMapHitRules(rules); if (admitted.status !== 'ready') return invalid('rules');
  const layers = admittedLayers(existingLayerIds); if (!layers) return invalid('layers');
  return select(features, admitted.rules, layers);
}

/** Synchronous query boundary: stale work never publishes a hit or a background result. */
const busyQueries = new WeakSet<MapHitQueryService>();
export function queryMapHit(service: MapHitQueryService, point: { readonly x: number; readonly y: number }, rules: unknown, boundary: MapHitQueryBoundary = {}): MapHitResult {
  if (!object(service)) return status('query-error');
  if (busyQueries.has(service)) return status('stale');
  busyQueries.add(service);
  try { return queryCurrentMapHit(service, point, rules, boundary); } finally { busyQueries.delete(service); }
}
function queryCurrentMapHit(service: MapHitQueryService, point: { readonly x: number; readonly y: number }, rules: unknown, boundary: MapHitQueryBoundary): MapHitResult {
  const current = () => { try { return !boundary.signal?.aborted && (boundary.current?.() ?? true); } catch { return false; } };
  if (!current()) return status('stale');
  const admitted = admitMapHitRules(rules); if (!current()) return status('stale'); if (admitted.status !== 'ready') return invalid('rules');
  const x = own(point, 'x'), y = own(point, 'y'); if (!current()) return status('stale'); if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return invalid('point');
  const layers: string[] = [];
  try {
    const layerMethod = getInheritedPropertyDescriptor(service, 'getLayer');
    const queryMethod = getInheritedPropertyDescriptor(service, 'queryRenderedFeatures');
    if (!current()) return status('stale');
    if (!layerMethod || !Object.hasOwn(layerMethod, 'value') || typeof layerMethod.value !== 'function' || !queryMethod || !Object.hasOwn(queryMethod, 'value') || typeof queryMethod.value !== 'function') return status('query-error');
    for (const rule of admitted.rules) {
      if (!rule.interactive) continue;
      if (!current()) return status('stale');
      const layer = layerMethod.value.call(service, rule.layerId);
      if (!current()) return status('stale');
      if (object(layer)) layers.push(rule.layerId);
    }
    if (!current()) return status('stale');
    if (!layers.length) return status('none');
    const features = queryMethod.value.call(service, Object.freeze({ x, y }), { layers: Object.freeze(layers) });
    if (!current()) return status('stale');
    const result = select(features, admitted.rules, layers, true);
    return current() ? result : status('stale');
  } catch { return current() ? status('query-error') : status('stale'); }
}
