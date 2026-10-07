import type { Feature } from 'geojson';
import {
  getOwnDataDescriptor,
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from '../../../internal/data-descriptors.js';
import type { MapLibreGeoJsonDiff } from './map-loader.js';

function isRuntimeRecord(value: unknown): value is object {
  try {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  } catch {
    return false;
  }
}

function isRuntimeArray(value: unknown): value is readonly unknown[] {
  try {
    return Array.isArray(value);
  } catch {
    return false;
  }
}

function ownDataValue(
  value: object,
  property: PropertyKey,
): ReturnType<typeof getOwnDataDescriptor> {
  return getOwnDataDescriptor(value, property);
}

function isUnsafeDescriptor(
  descriptor: ReturnType<typeof getOwnDataDescriptor>,
): descriptor is typeof UNSAFE_OWN_DATA_DESCRIPTOR {
  return descriptor === UNSAFE_OWN_DATA_DESCRIPTOR;
}

/** Ceiling on the features one property-diff pass inspects, matching the untileable-property scan:
 *  past it, falling back to a whole-source replace is cheaper than the comparison itself. */
const GEOJSON_DIFF_FEATURE_LIMIT = 10_000;
/** Maximum values traversed while proving retained GeoJSON geometry unchanged. */
const GEOJSON_DIFF_VALUE_LIMIT = 50_000;
/** Maximum recursive nesting admitted into the descriptor-safe GeoJSON comparison projection. */
const GEOJSON_PROJECTION_DEPTH_LIMIT = 100;
const INVALID_GEOJSON_PROJECTION_VALUE = Symbol('invalid-geojson-projection-value');
const GEOJSON_FUNCTION_TO_STRING = Function.prototype.toString;
const GEOJSON_OBJECT_CONSTRUCTOR_SOURCE = GEOJSON_FUNCTION_TO_STRING.call(Object);

interface GeoJsonProjectionBudget {
  remaining: number;
  readonly seen: WeakMap<object, unknown>;
  /** Values currently being projected; re-entry is a JSON-inexpressible cycle, not an alias. */
  readonly active: WeakSet<object>;
}

interface CanonicalGeoJsonDiagnosticFeature {
  readonly id: string | number | undefined;
  readonly index: number;
  /** Own enumerable data descriptors copied in source order; values stay opaque identities. */
  readonly properties: ReadonlyMap<string, unknown>;
}

interface CanonicalGeoJsonFeature extends CanonicalGeoJsonDiagnosticFeature {
  readonly id: string | number;
  /** The peer-facing feature identity; no component code reads it after this projection. */
  readonly feature: Feature;
  readonly geometry: unknown;
  readonly bbox: unknown;
}

interface CanonicalGeoJsonCollection {
  readonly ordered: readonly CanonicalGeoJsonFeature[];
  readonly byId: ReadonlyMap<string | number, CanonicalGeoJsonFeature>;
}

/** Descriptor metadata used internally; the original GeoJSON value remains peer-facing only. */
export interface CanonicalGeoJsonProjection {
  readonly diagnostics: readonly CanonicalGeoJsonDiagnosticFeature[];
  readonly collection: CanonicalGeoJsonCollection | undefined;
}

const EMPTY_CANONICAL_GEOJSON_PROJECTION: CanonicalGeoJsonProjection = Object.freeze({
  diagnostics: Object.freeze([]),
  collection: undefined,
});
const EMPTY_CANONICAL_GEOJSON_PROPERTIES: ReadonlyMap<string, unknown> = new Map();

function spendGeoJsonProjectionWork(budget: GeoJsonProjectionBudget): boolean {
  if (budget.remaining <= 0) return false;
  budget.remaining -= 1;
  return true;
}

function projectedGeoJsonOwnValue(
  value: object,
  key: PropertyKey,
  budget: GeoJsonProjectionBudget,
): unknown | typeof MISSING_OWN_DATA_DESCRIPTOR | typeof INVALID_GEOJSON_PROJECTION_VALUE {
  if (!spendGeoJsonProjectionWork(budget)) return INVALID_GEOJSON_PROJECTION_VALUE;
  const descriptor = ownDataValue(value, key);
  if (isUnsafeDescriptor(descriptor)) return INVALID_GEOJSON_PROJECTION_VALUE;
  return descriptor === MISSING_OWN_DATA_DESCRIPTOR ? descriptor : descriptor.value;
}

function isPlainGeoJsonRecord(value: object): boolean {
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype === null) return true;
    if (Object.getPrototypeOf(prototype) !== null) return false;
    const constructorDescriptor = Object.getOwnPropertyDescriptor(prototype, 'constructor');
    if (
      !constructorDescriptor ||
      !('value' in constructorDescriptor) ||
      typeof constructorDescriptor.value !== 'function'
    )
      return false;
    const constructor = constructorDescriptor.value;
    const constructorPrototype = Object.getOwnPropertyDescriptor(constructor, 'prototype');
    return Boolean(
      constructorPrototype &&
        'value' in constructorPrototype &&
        constructorPrototype.value === prototype &&
        GEOJSON_FUNCTION_TO_STRING.call(constructor) === GEOJSON_OBJECT_CONSTRUCTOR_SOURCE,
    );
  } catch {
    return false;
  }
}

/**
 * Captures the JSON-shaped geometry/bbox data that the incremental diff needs, never the original
 * object. Accessors, custom prototypes, cycles that cannot be represented, and exhausted work
 * reject the fast path while leaving the peer-facing GeoJSON identity intact for `setData()`.
 */
function projectGeoJsonComparableValue(
  value: unknown,
  budget: GeoJsonProjectionBudget,
  depth = 0,
): unknown | typeof INVALID_GEOJSON_PROJECTION_VALUE {
  if (!spendGeoJsonProjectionWork(budget) || depth > GEOJSON_PROJECTION_DEPTH_LIMIT)
    return INVALID_GEOJSON_PROJECTION_VALUE;
  if (
    value === null ||
    value === undefined ||
    typeof value === 'boolean' ||
    typeof value === 'string'
  )
    return value;
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : INVALID_GEOJSON_PROJECTION_VALUE;
  if (typeof value !== 'object') return INVALID_GEOJSON_PROJECTION_VALUE;
  if (budget.active.has(value)) return INVALID_GEOJSON_PROJECTION_VALUE;
  const remembered = budget.seen.get(value);
  if (remembered !== undefined) return remembered;

  if (isRuntimeArray(value)) {
    const length = projectedGeoJsonOwnValue(value, 'length', budget);
    if (
      length === INVALID_GEOJSON_PROJECTION_VALUE ||
      length === MISSING_OWN_DATA_DESCRIPTOR ||
      typeof length !== 'number' ||
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > budget.remaining
    )
      return INVALID_GEOJSON_PROJECTION_VALUE;
    const output: unknown[] = new Array(length);
    budget.seen.set(value, output);
    budget.active.add(value);
    let completed = false;
    try {
      for (let index = 0; index < length; index += 1) {
        const entry = projectedGeoJsonOwnValue(value, String(index), budget);
        if (entry === INVALID_GEOJSON_PROJECTION_VALUE) return entry;
        if (entry === MISSING_OWN_DATA_DESCRIPTOR) continue;
        const projected = projectGeoJsonComparableValue(entry, budget, depth + 1);
        if (projected === INVALID_GEOJSON_PROJECTION_VALUE) return projected;
        Object.defineProperty(output, index, {
          value: projected,
          enumerable: true,
          configurable: false,
          writable: false,
        });
      }
      const frozen = Object.freeze(output);
      completed = true;
      return frozen;
    } finally {
      budget.active.delete(value);
      if (!completed) budget.seen.delete(value);
    }
  }

  if (!isPlainGeoJsonRecord(value)) return INVALID_GEOJSON_PROJECTION_VALUE;
  const output = Object.create(null) as Record<string, unknown>;
  budget.seen.set(value, output);
  budget.active.add(value);
  let completed = false;
  try {
    for (const key in value) {
      const entry = projectedGeoJsonOwnValue(value, key, budget);
      if (entry === INVALID_GEOJSON_PROJECTION_VALUE) return entry;
      if (entry === MISSING_OWN_DATA_DESCRIPTOR) continue;
      const projected = projectGeoJsonComparableValue(entry, budget, depth + 1);
      if (projected === INVALID_GEOJSON_PROJECTION_VALUE) return projected;
      Object.defineProperty(output, key, {
        value: projected,
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
    const frozen = Object.freeze(output);
    completed = true;
    return frozen;
  } catch {
    return INVALID_GEOJSON_PROJECTION_VALUE;
  } finally {
    budget.active.delete(value);
    if (!completed) budget.seen.delete(value);
  }
}

function projectGeoJsonProperties(
  value: unknown,
  budget: GeoJsonProjectionBudget,
): ReadonlyMap<string, unknown> | undefined {
  if (value === null || value === undefined) return EMPTY_CANONICAL_GEOJSON_PROPERTIES;
  if (!isRuntimeRecord(value)) return undefined;
  const output = new Map<string, unknown>();
  try {
    for (const key in value) {
      const entry = projectedGeoJsonOwnValue(value, key, budget);
      if (entry === INVALID_GEOJSON_PROJECTION_VALUE) return undefined;
      if (entry === MISSING_OWN_DATA_DESCRIPTOR) continue;
      output.set(key, entry);
    }
  } catch {
    return undefined;
  }
  return output;
}

function projectGeoJsonFeature(
  value: unknown,
  index: number,
  budget: GeoJsonProjectionBudget,
): {
  readonly diagnostic: CanonicalGeoJsonDiagnosticFeature;
  readonly feature: CanonicalGeoJsonFeature | undefined;
} | undefined {
  if (!isRuntimeRecord(value)) return undefined;
  const type = projectedGeoJsonOwnValue(value, 'type', budget);
  const id = projectedGeoJsonOwnValue(value, 'id', budget);
  const geometry = projectedGeoJsonOwnValue(value, 'geometry', budget);
  const bbox = projectedGeoJsonOwnValue(value, 'bbox', budget);
  const properties = projectedGeoJsonOwnValue(value, 'properties', budget);
  if (properties === INVALID_GEOJSON_PROJECTION_VALUE) return undefined;
  const projectedProperties = projectGeoJsonProperties(
    properties === MISSING_OWN_DATA_DESCRIPTOR ? undefined : properties,
    budget,
  );
  if (!projectedProperties) return undefined;
  const diagnostic = Object.freeze({
    id: typeof id === 'string' || typeof id === 'number' ? id : undefined,
    index,
    properties: projectedProperties,
  });
  if (
    type === INVALID_GEOJSON_PROJECTION_VALUE ||
    id === INVALID_GEOJSON_PROJECTION_VALUE ||
    geometry === INVALID_GEOJSON_PROJECTION_VALUE ||
    bbox === INVALID_GEOJSON_PROJECTION_VALUE ||
    type !== 'Feature' ||
    id === MISSING_OWN_DATA_DESCRIPTOR ||
    (typeof id !== 'string' && typeof id !== 'number')
  )
    return Object.freeze({ diagnostic, feature: undefined });
  const comparableGeometry = projectGeoJsonComparableValue(
    geometry === MISSING_OWN_DATA_DESCRIPTOR ? undefined : geometry,
    budget,
  );
  const comparableBbox = projectGeoJsonComparableValue(
    bbox === MISSING_OWN_DATA_DESCRIPTOR ? undefined : bbox,
    budget,
  );
  if (
    comparableGeometry === INVALID_GEOJSON_PROJECTION_VALUE ||
    comparableBbox === INVALID_GEOJSON_PROJECTION_VALUE
  )
    return Object.freeze({ diagnostic, feature: undefined });
  return Object.freeze({
    diagnostic,
    feature: Object.freeze({
      id,
      index,
      feature: value as Feature,
      geometry: comparableGeometry,
      bbox: comparableBbox,
      properties: projectedProperties,
    }),
  });
}

/**
 * Captures only the bounded descriptor metadata this component subsequently needs. The original
 * GeoJSON value is deliberately absent from the result: callers retain it solely for MapLibre.
 */
export function projectGeoJson(value: unknown): CanonicalGeoJsonProjection {
  try {
    if (!isRuntimeRecord(value)) return EMPTY_CANONICAL_GEOJSON_PROJECTION;
    const budget: GeoJsonProjectionBudget = {
      remaining: GEOJSON_DIFF_VALUE_LIMIT,
      seen: new WeakMap(),
      active: new WeakSet(),
    };
    const type = projectedGeoJsonOwnValue(value, 'type', budget);
    const features = projectedGeoJsonOwnValue(value, 'features', budget);
    if (
      type !== 'FeatureCollection' ||
      features === INVALID_GEOJSON_PROJECTION_VALUE ||
      features === MISSING_OWN_DATA_DESCRIPTOR ||
      !isRuntimeArray(features)
    )
      return EMPTY_CANONICAL_GEOJSON_PROJECTION;
    const length = projectedGeoJsonOwnValue(features, 'length', budget);
    if (
      length === INVALID_GEOJSON_PROJECTION_VALUE ||
      length === MISSING_OWN_DATA_DESCRIPTOR ||
      typeof length !== 'number' ||
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > GEOJSON_DIFF_FEATURE_LIMIT
    )
      return EMPTY_CANONICAL_GEOJSON_PROJECTION;
    const diagnostics: CanonicalGeoJsonDiagnosticFeature[] = [];
    const ordered: CanonicalGeoJsonFeature[] = [];
    const byId = new Map<string | number, CanonicalGeoJsonFeature>();
    let collectionIsAddressable = true;
    for (let index = 0; index < length; index += 1) {
      const candidate = projectedGeoJsonOwnValue(features, String(index), budget);
      if (
        candidate === INVALID_GEOJSON_PROJECTION_VALUE ||
        candidate === MISSING_OWN_DATA_DESCRIPTOR
      ) {
        collectionIsAddressable = false;
        continue;
      }
      const projected = projectGeoJsonFeature(candidate, index, budget);
      if (!projected) {
        collectionIsAddressable = false;
        continue;
      }
      diagnostics.push(projected.diagnostic);
      const feature = projected.feature;
      if (!feature || byId.has(feature.id)) {
        collectionIsAddressable = false;
        continue;
      }
      ordered.push(feature);
      byId.set(feature.id, feature);
    }
    return Object.freeze({
      diagnostics: Object.freeze(diagnostics),
      collection:
        collectionIsAddressable && ordered.length === length
          ? Object.freeze({ ordered: Object.freeze(ordered), byId })
          : undefined,
    });
  } catch {
    return EMPTY_CANONICAL_GEOJSON_PROJECTION;
  }
}

interface GeoJsonValueComparison {
  remaining: number;
  readonly forward: WeakMap<object, object>;
  readonly reverse: WeakMap<object, object>;
}

/** Bounded equality for the JSON data model GeoJSON geometry/bbox values are allowed to contain.
 * It reads data descriptors only, preserves sparse-array and alias distinctions, and fails closed
 * for accessors, custom prototypes, exhausted work, or any reflective error. */
function sameGeoJsonValue(
  previous: unknown,
  next: unknown,
  comparison: GeoJsonValueComparison
): boolean {
  if (comparison.remaining <= 0) return false;
  comparison.remaining -= 1;
  if (Object.is(previous, next)) return true;
  if (
    previous === null ||
    next === null ||
    typeof previous !== 'object' ||
    typeof next !== 'object'
  )
    return false;

  const pairedNext = comparison.forward.get(previous);
  if (pairedNext) return pairedNext === next;
  const pairedPrevious = comparison.reverse.get(next);
  if (pairedPrevious) return pairedPrevious === previous;
  comparison.forward.set(previous, next);
  comparison.reverse.set(next, previous);

  const previousIsArray = Array.isArray(previous);
  const nextIsArray = Array.isArray(next);
  if (previousIsArray || nextIsArray) {
    if (!previousIsArray || !nextIsArray || previous.length !== next.length) return false;
    for (let index = 0; index < previous.length; index += 1) {
      const before = Object.getOwnPropertyDescriptor(previous, String(index));
      const after = Object.getOwnPropertyDescriptor(next, String(index));
      if (Boolean(before) !== Boolean(after)) return false;
      if (!before || !after) continue;
      if (!('value' in before) || !('value' in after)) return false;
      if (!sameGeoJsonValue(before.value, after.value, comparison)) return false;
    }
    return true;
  }

  if (!isPlainGeoJsonRecord(previous) || !isPlainGeoJsonRecord(next)) return false;
  const previousKeys = Object.keys(previous);
  const nextKeys = Object.keys(next);
  if (previousKeys.length !== nextKeys.length) return false;
  for (let index = 0; index < previousKeys.length; index += 1) {
    const key = previousKeys[index]!;
    if (key !== nextKeys[index]) return false;
    const before = Object.getOwnPropertyDescriptor(previous, key);
    const after = Object.getOwnPropertyDescriptor(next, key);
    if (!before || !after || !('value' in before) || !('value' in after)) return false;
    if (!sameGeoJsonValue(before.value, after.value, comparison)) return false;
  }
  return true;
}

function sameGeoJsonSnapshots(previous: unknown, next: unknown): boolean {
  try {
    return sameGeoJsonValue(previous, next, {
      remaining: GEOJSON_DIFF_VALUE_LIMIT,
      forward: new WeakMap(),
      reverse: new WeakMap(),
    });
  } catch {
    return false;
  }
}

/**
 * Builds a maplibre-gl `updateData()` diff when stable feature ids make the change addressable,
 * and returns `null` otherwise so the caller replaces the whole source instead. Property changes,
 * additions, removals, and order changes all stay on the incremental path.
 *
 * `setData()` unconditionally re-tiles and repaints an entire source with no diffing. That is
 * invisible on a static map and expensive on an animated one: advancing a choropleth a step every
 * few hundred milliseconds re-tiles every polygon each time, when all that changed were the values
 * driving the colour ramp.
 *
 * Geometry and bbox values must remain semantically unchanged. A bounded, descriptor-safe
 * projection captures their JSON data graph before comparison; any uncertainty falls back to
 * `setData()` while leaving the original GeoJSON identity untouched for MapLibre.
 *
 * MapLibre applies removals before additions. To preserve the feature collection's observable
 * order, the longest next-order prefix already appearing in previous order stays in place; the
 * remaining suffix is removed and re-added in its exact next order. Appends and ordinary removals
 * therefore remain minimal, while a reorder changes only the suffix it invalidated.
 */
export function buildProjectedGeoJsonPropertyDiff(
  previous: CanonicalGeoJsonProjection,
  next: CanonicalGeoJsonProjection,
): MapLibreGeoJsonDiff | null {
  const previousCollection = previous.collection;
  const nextCollection = next.collection;
  if (!previousCollection || !nextCollection) return null;

  const previousGeometry: unknown[] = [];
  const nextGeometry: unknown[] = [];
  for (const after of nextCollection.ordered) {
    const before = previousCollection.byId.get(after.id);
    if (!before) continue;
    previousGeometry.push(before.geometry, before.bbox);
    nextGeometry.push(after.geometry, after.bbox);
  }
  if (!sameGeoJsonSnapshots(previousGeometry, nextGeometry)) return null;

  const retained = new Set<string | number>();
  let previousIndex = -1;
  for (const feature of nextCollection.ordered) {
    const before = previousCollection.byId.get(feature.id);
    if (!before || before.index <= previousIndex) break;
    retained.add(feature.id);
    previousIndex = before.index;
  }

  const remove = previousCollection.ordered
    .filter((feature) => !retained.has(feature.id))
    .map((feature) => feature.id);
  const add = nextCollection.ordered
    .filter((feature) => !retained.has(feature.id))
    .map((feature) => feature.feature);

  const update: {
    id: string | number;
    addOrUpdateProperties: { key: string; value: unknown }[];
    removeProperties: string[];
  }[] = [];

  for (const after of nextCollection.ordered) {
    if (!retained.has(after.id)) continue;
    const before = previousCollection.byId.get(after.id)!;
    const addOrUpdateProperties: { key: string; value: unknown }[] = [];
    for (const [key, value] of after.properties) {
      if (!Object.is(before.properties.get(key), value)) {
        addOrUpdateProperties.push({ key, value });
      }
    }
    const removeProperties = [...before.properties.keys()].filter((key) => !after.properties.has(key));
    if (addOrUpdateProperties.length === 0 && removeProperties.length === 0) continue;
    update.push({ id: after.id, addOrUpdateProperties, removeProperties });
  }

  return {
    ...(remove.length ? { remove } : {}),
    ...(add.length ? { add } : {}),
    update,
  };
}

const admittedGeoJson = new WeakMap<object, CanonicalGeoJsonProjection>();

/** Admitted GeoJSON is never inspected again, so one projection per object suffices. */
export function projectAdmittedGeoJson(value: unknown): CanonicalGeoJsonProjection {
  if (!isRuntimeRecord(value)) return projectGeoJson(value);
  let projection = admittedGeoJson.get(value);
  if (!projection) admittedGeoJson.set(value, (projection = projectGeoJson(value)));
  return projection;
}

export function buildGeoJsonPropertyDiff(
  previous: unknown,
  next: unknown,
): MapLibreGeoJsonDiff | null {
  return buildProjectedGeoJsonPropertyDiff(projectGeoJson(previous), projectGeoJson(next));
}
