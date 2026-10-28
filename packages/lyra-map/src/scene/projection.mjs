import { EARTH_RADIUS_METERS, geographicFromEnu, geographicToTile } from './geographic.mjs';

const snapshots = new WeakMap();
const compiledProjections = new WeakMap();
const positiveInteger = value => Number.isSafeInteger(value) && value > 0;
const fail = () => { throw new TypeError('Invalid geographic projection.'); };
const finite = value => typeof value === 'number' && Number.isFinite(value);
const typedPrototype = Object.getPrototypeOf(Float32Array.prototype);
const nativeGetter = (prototype, key) => Object.getOwnPropertyDescriptor(prototype, key)?.get;
const typedTag = nativeGetter(typedPrototype, Symbol.toStringTag);
const typedBuffer = nativeGetter(typedPrototype, 'buffer');
const typedLength = nativeGetter(typedPrototype, 'length');
const arrayBufferLength = nativeGetter(ArrayBuffer.prototype, 'byteLength');
const arrayBufferResizable = nativeGetter(ArrayBuffer.prototype, 'resizable');

function field(value, key) {
  if (value === null || typeof value !== 'object') fail();
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail();
  return descriptor.value;
}

function numbers(value, length) {
  let values;
  if (Array.isArray(value)) {
    if (field(value, 'length') !== length) fail();
    values = Array.from({ length }, (_, index) => field(value, String(index)));
  } else {
    try {
      const tag = typedTag.call(value);
      if (tag !== 'Float32Array' && tag !== 'Float64Array') fail();
      const backing = typedBuffer.call(value);
      arrayBufferLength.call(backing);
      if (arrayBufferResizable?.call(backing) || typedLength.call(value) !== length) fail();
      // A native view prevents caller-defined indexed access or iteration from running.
      const byteOffset = nativeGetter(typedPrototype, 'byteOffset').call(value);
      const view = tag === 'Float32Array' ? new Float32Array(backing, byteOffset, length) : new Float64Array(backing, byteOffset, length);
      values = Array.from({ length }, (_, index) => view[index]);
    } catch { fail(); }
  }
  if (!values.every(finite)) fail();
  return Object.freeze(values);
}

function camera(value) {
  const result = numbers(value, 3);
  const radius = Math.hypot(...result);
  if (!Number.isFinite(radius) || radius <= 1) fail();
  return result;
}

function spherePosition(position) {
  const [longitude, latitude] = position.lngLat.map(value => value * Math.PI / 180);
  const radius = 1 + position.altitude / EARTH_RADIUS_METERS;
  return [Math.sin(longitude) * Math.cos(latitude) * radius, Math.sin(latitude) * radius,
    Math.cos(longitude) * Math.cos(latitude) * radius];
}

function occluded(sphere, viewpoint) {
  // Start at the bounded sphere endpoint so distant cameras cannot cancel its coordinates.
  const delta = viewpoint.map((value, index) => value - sphere[index]);
  const distance = Math.hypot(...delta);
  if (distance === 0) return false;
  const direction = delta.map(value => value / distance);
  const along = Math.max(0, Math.min(distance, -sphere.reduce((sum, value, index) => sum + value * direction[index], 0)));
  const closest = Math.hypot(...sphere.map((value, index) => value + along * direction[index]));
  return closest < Math.sqrt(1 - 1e-6);
}

const multiply = (matrix, vector) => [0, 1, 2, 3].map(row =>
  vector.reduce((sum, value, column) => sum + matrix[column * 4 + row] * value, 0));

function copyLayout(value) {
  const revision = field(value, 'revision'), tileZoom = field(value, 'tileZoom'), centerLongitude = field(value, 'centerLongitude');
  if (!positiveInteger(revision) || !Number.isSafeInteger(tileZoom) || tileZoom < 0 || tileZoom > 30 ||
      !finite(centerLongitude) || Math.abs(centerLongitude) > 360000000) fail();
  return Object.freeze({ revision, tileZoom, centerLongitude });
}

/** Selects a canonical tile and nearest world copy without retaining a live frame. */
export function projectionOriginFor(value, layoutValue) {
  const position = geographicFromEnu(value, [0, 0, 0]), layout = copyLayout(layoutValue);
  const [longitude, latitude] = position.lngLat, size = 2 ** layout.tileZoom;
  const x = Math.max(0, Math.min(size - 1, Math.floor((longitude + 180) / 360 * size)));
  const mercatorY = latitude === 0 ? 0.5 : (1 - Math.asinh(Math.tan(latitude * Math.PI / 180)) / Math.PI) / 2;
  const y = Math.max(0, Math.min(size - 1, Math.floor(mercatorY * size)));
  const wrap = Math.ceil((layout.centerLongitude - longitude) / 360 - 0.5) || 0;
  if (Math.abs(wrap) > 1000000) fail();
  return Object.freeze({ layoutRevision: layout.revision,
    tile: Object.freeze({ z: layout.tileZoom, x, y, wrap }),
    key: `${layout.revision}:${layout.tileZoom}:${x}:${y}:${wrap}`,
    representative: Object.freeze([longitude, latitude]) });
}

function uniformNumbers(value, length) {
  const result = numbers(value, length);
  if (!result.every(number => number === Math.fround(number))) fail();
  return result;
}

function projectionViewpoint(clippingPlane, transition, upload = false) {
  if (transition === 0) return undefined;
  if (clippingPlane[3] >= 0) fail();
  let values = clippingPlane.slice(0, 3).map(value => value / -clippingPlane[3]);
  if (upload) {
    values = values.map(Math.fround);
    if (!values.every(finite)) fail();
  }
  return camera(values);
}

/** Validates and owns historical native uniform data; the returned handle is runtime branded. */
export function compileProjectionSnapshot(value) {
  const contract = field(value, 'contract'), contextEpoch = field(value, 'contextEpoch'), viewRevision = field(value, 'viewRevision');
  const layout = copyLayout(field(value, 'layout')), sourceTile = field(value, 'tile');
  const tile = Object.freeze(Object.fromEntries(['z', 'x', 'y', 'wrap'].map(key => [key, field(sourceTile, key)])));
  geographicToTile({ lngLat: [0, 0] }, tile);
  const width = field(value, 'width'), height = field(value, 'height'), projectionTransition = field(value, 'projectionTransition');
  if (contract !== 1 || !positiveInteger(contextEpoch) || !positiveInteger(viewRevision) || tile.z !== layout.tileZoom ||
      !finite(width) || width <= 0 || !finite(height) || height <= 0 || !finite(projectionTransition) ||
      projectionTransition < 0 || projectionTransition > 1 || Math.fround(projectionTransition) !== projectionTransition) fail();
  const mainMatrix = uniformNumbers(field(value, 'mainMatrix'), 16), fallbackMatrix = uniformNumbers(field(value, 'fallbackMatrix'), 16);
  const clippingPlane = uniformNumbers(field(value, 'clippingPlane'), 4), tileMercatorCoords = uniformNumbers(field(value, 'tileMercatorCoords'), 4);
  const size = 2 ** tile.z, coefficients = [tile.x / size, tile.y / size, 1 / (8192 * size), 1 / (8192 * size)].map(Math.fround);
  if (tileMercatorCoords.some((number, index) => number !== coefficients[index])) fail();
  const viewpoint = projectionViewpoint(clippingPlane, projectionTransition, true);
  const snapshot = Object.freeze({ contract, contextEpoch, viewRevision, layout, tile, width, height,
    mainMatrix, fallbackMatrix, clippingPlane, tileMercatorCoords, projectionTransition });
  const effectiveProjection = projectionTransition === 0 ? 'mercator' : projectionTransition > Math.fround(0.999) ? 'globe' : 'mixed';
  const compiled = Object.freeze({ snapshot, effectiveProjection });
  compiledProjections.set(compiled, { snapshot, viewpoint });
  snapshots.set(snapshot, { viewpoint, compiled });
  return compiled;
}

function rawProjection(position, snapshot, encoded, viewpoint) {
  const sphere = spherePosition(position), flat = multiply(snapshot.fallbackMatrix, [...encoded, 1]);
  const uploadedTransition = Math.fround(snapshot.projectionTransition);
  const globe = uploadedTransition > 0 ? multiply(snapshot.mainMatrix, [...sphere, 1]) : flat;
  const transition = uploadedTransition > Math.fround(0.999) ? 1 : uploadedTransition;
  const clip = Object.freeze(flat.map((value, index) => value * (1 - transition) + globe[index] * transition));
  if (!clip.every(finite)) fail();
  return Object.freeze({ status: 'projected', clip, tilePosition: Object.freeze(encoded),
    horizonOccluded: Boolean(viewpoint && uploadedTransition > 0 && occluded(sphere, viewpoint)) });
}

/** Returns finite homogeneous coordinates without division or completed visibility claims. */
export function evaluateSceneProjection(value, compiled) {
  const state = compiledProjections.get(compiled);
  if (!state) fail();
  const position = geographicFromEnu(value, [0, 0, 0]), snapshot = state.snapshot;
  const request = projectionOriginFor(position, snapshot.layout);
  if (request.tile.wrap !== snapshot.tile.wrap) return Object.freeze({ status: 'origin-needed', request });
  const encoded = geographicToTile(position, snapshot.tile), xy = encoded.slice(0, 2).map(Math.fround);
  if (xy.some(number => !finite(number) || number < -32767.5 || number > 32766.5)) {
    return Object.freeze({ status: 'origin-needed', request });
  }
  return rawProjection(position, snapshot, encoded, state.viewpoint);
}

/** Copies one native tile projection and CSS viewport without retaining native objects. */
export function createProjectionSnapshot(value) {
  const sourceTile = field(value, 'tile');
  const tile = Object.freeze(Object.fromEntries(['z', 'x', 'y', 'wrap'].map(key => [key, field(sourceTile, key)])));
  geographicToTile({ lngLat: [0, 0] }, tile);
  const mainMatrix = numbers(field(value, 'mainMatrix'), 16);
  const fallbackMatrix = numbers(field(value, 'fallbackMatrix'), 16);
  const clippingPlane = numbers(field(value, 'clippingPlane'), 4);
  const projectionTransition = field(value, 'projectionTransition');
  const width = field(value, 'width'), height = field(value, 'height');
  if (!finite(projectionTransition) || projectionTransition < 0 || projectionTransition > 1 ||
    !finite(width) || width <= 0 || !finite(height) || height <= 0) fail();
  const viewpoint = projectionViewpoint(clippingPlane, projectionTransition);
  const snapshot = Object.freeze({ tile, mainMatrix, fallbackMatrix, clippingPlane, projectionTransition, width, height });
  snapshots.set(snapshot, { viewpoint });
  return snapshot;
}

/** Tests the native sphere-horizon convention, independently of terrain or rendered depth. */
export function sphereOccludesPosition(value, viewpoint) {
  const position = geographicFromEnu(value, [0, 0, 0]);
  return occluded(spherePosition(position), camera(viewpoint));
}

/** Projects resolved meters; a point inside the clip volume still requires a completed depth query. */
export function projectScenePosition(value, snapshot) {
  const state = snapshots.get(snapshot);
  if (!state) fail();
  const position = geographicFromEnu(value, [0, 0, 0]);
  const encoded = geographicToTile(position, snapshot.tile);
  // Native globe shaders reserve these tile-y values for synthetic pole vertices.
  const uploadedY = Math.fround(encoded[1]);
  if (uploadedY < -32767.5 || uploadedY > 32766.5) fail();
  const raw = state.compiled ? evaluateSceneProjection(position, state.compiled) : rawProjection(position, snapshot, encoded, state.viewpoint);
  if (raw.status !== 'projected') fail();
  const clip = raw.clip;
  if (clip[3] <= 0 || clip.slice(0, 3).some(value => Math.abs(value) > clip[3])) {
    return Object.freeze({ clip, visible: false, status: 'clipped' });
  }
  const point = Object.freeze([(clip[0] / clip[3] * 0.5 + 0.5) * snapshot.width,
    (0.5 - clip[1] / clip[3] * 0.5) * snapshot.height]);
  return Object.freeze({ clip, point, visible: false,
    status: raw.horizonOccluded ? 'occluded' : 'visibility-pending' });
}
