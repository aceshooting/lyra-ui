import { getOwnDataDescriptor, isPlainDataRecord, MISSING_OWN_DATA_DESCRIPTOR, readOwnArrayLength,
  UNSAFE_OWN_DATA_DESCRIPTOR } from '../../../internal/data-descriptors.js';
import type { LyraMapFeatureIdentifier } from './map-feature-state.js';

export type LyraMapFeatureOrigin = 'choropleth' | 'data-layer' | 'overlay' | 'basemap';
export interface MapFeatureStateRoute {
  readonly origin: LyraMapFeatureOrigin;
  readonly source: string;
  readonly nativeSource: string;
  /** Stable logical dataset token, independent of the native ID or style generation. */
  readonly identity: unknown;
  /** Omitted for GeoJSON; vector targets must name one of these exact source layers. */
  readonly sourceLayers?: readonly string[];
}
export interface LyraMapFeatureStateTarget extends LyraMapFeatureIdentifier { readonly origin?: LyraMapFeatureOrigin; }
export interface LyraMapResolvedFeatureStateTarget extends LyraMapFeatureIdentifier { readonly origin: LyraMapFeatureOrigin; }
const origins = new Set(['choropleth', 'data-layer', 'overlay', 'basemap']);
const featureStateRouteKey = (origin: LyraMapFeatureOrigin, source: string): string => JSON.stringify([origin, source]);
const validFeatureStateName = (value: unknown, limit = 1024): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= limit;
function ownFeatureStateValue(value: object, key: string): unknown {
  const descriptor = getOwnDataDescriptor(value, key);
  if (descriptor === MISSING_OWN_DATA_DESCRIPTOR || descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) throw new Error('Invalid feature-state data.');
  return descriptor.value;
}
function fields(value: unknown, allowed: readonly string[]): readonly string[] {
  if (!isPlainDataRecord(value)) throw new Error('Invalid feature-state record.');
  const keys = Reflect.ownKeys(value);
  if (keys.length > allowed.length || keys.some(key => typeof key !== 'string' || !allowed.includes(key))) throw new Error('Invalid feature-state fields.');
  for (const key of keys) ownFeatureStateValue(value, key as string);
  return keys as string[];
}
function array(value: unknown, maximum: number): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error('Invalid feature-state array.');
  const length = readOwnArrayLength(value);
  if (length === undefined || length > maximum || Reflect.ownKeys(value).length !== length + 1) throw new Error('Invalid feature-state array.');
  return Array.from({ length }, (_value, index) => ownFeatureStateValue(value, String(index)));
}
/** Admits bounded route descriptors atomically; any invalid or duplicate route rejects all of them. */
export function admitMapFeatureStateRoutes(input: unknown): Map<string, MapFeatureStateRoute> {
  const routes = new Map<string, MapFeatureStateRoute>();
  for (const entry of array(input, 256)) {
    const keys = fields(entry, ['origin', 'source', 'nativeSource', 'identity', 'sourceLayers']);
    const origin = ownFeatureStateValue(entry as object, 'origin'), source = ownFeatureStateValue(entry as object, 'source'),
      nativeSource = ownFeatureStateValue(entry as object, 'nativeSource'), identity = ownFeatureStateValue(entry as object, 'identity');
    if (typeof origin !== 'string' || !origins.has(origin) || !validFeatureStateName(source, 128) || !validFeatureStateName(nativeSource) || identity === undefined) throw new Error('Invalid feature-state route.');
    const sourceLayers = keys.includes('sourceLayers') ? Object.freeze(array(ownFeatureStateValue(entry as object, 'sourceLayers'), 128).map(value => {
      if (!validFeatureStateName(value)) throw new Error('Invalid source layer.'); return value;
    })) : undefined;
    if (sourceLayers && (!sourceLayers.length || new Set(sourceLayers).size !== sourceLayers.length)) throw new Error('Invalid source layers.');
    const key = featureStateRouteKey(origin as LyraMapFeatureOrigin, source);
    if (routes.has(key)) throw new Error('Duplicate feature-state route.');
    routes.set(key, Object.freeze({ origin: origin as LyraMapFeatureOrigin, source, nativeSource, identity,
      ...(sourceLayers ? { sourceLayers } : {}) }));
  }
  return routes;
}
/** Resolves public origin ambiguity and source-layer constraints against admitted routes. */
export function resolveMapFeatureStateTarget(routes: ReadonlyMap<string, MapFeatureStateRoute>, input: unknown):
  { readonly target: LyraMapResolvedFeatureStateTarget; readonly route: MapFeatureStateRoute; readonly logical: LyraMapFeatureIdentifier } | undefined {
  const keys = fields(input, ['origin', 'source', 'sourceLayer', 'id']);
  const source = ownFeatureStateValue(input as object, 'source'), id = ownFeatureStateValue(input as object, 'id');
  if (!validFeatureStateName(source, 128) || !(typeof id === 'string' && id.length <= 1024 || typeof id === 'number' && Number.isFinite(id))) return undefined;
  const origin = keys.includes('origin') ? ownFeatureStateValue(input as object, 'origin') : undefined;
  if (origin !== undefined && (typeof origin !== 'string' || !origins.has(origin))) return undefined;
  const matches = [...routes.values()].filter(route => route.source === source && (origin === undefined || route.origin === origin));
  if (matches.length !== 1) return undefined;
  const route = matches[0]!;
  const sourceLayer = keys.includes('sourceLayer') ? ownFeatureStateValue(input as object, 'sourceLayer') : undefined;
  if (route.sourceLayers ? !validFeatureStateName(sourceLayer) || !route.sourceLayers.includes(sourceLayer) : keys.includes('sourceLayer')) return undefined;
  const target = Object.freeze({ origin: route.origin, source, id, ...(sourceLayer === undefined ? {} : { sourceLayer: sourceLayer as string }) });
  const logical = Object.freeze({ source: featureStateRouteKey(route.origin, source), id, ...(sourceLayer === undefined ? {} : { sourceLayer: sourceLayer as string }) });
  return { target, route, logical };
}

/**
 * Hit-target routing over the admitted routes. It is all a map needs until desired feature state
 * is first written, when the state runtime loads and takes over the same routes.
 */
export class MapFeatureStateRouter {
  private routes = new Map<string, MapFeatureStateRoute>();

  /** Admits routes atomically; a rejection leaves none, exactly like the state runtime. */
  configure(input: unknown): boolean {
    try { this.routes = admitMapFeatureStateRoutes(input); return true; }
    catch { this.routes = new Map(); return false; }
  }

  resolve(input: unknown): LyraMapResolvedFeatureStateTarget | undefined {
    try { return resolveMapFeatureStateTarget(this.routes, input)?.target; } catch { return undefined; }
  }
}
