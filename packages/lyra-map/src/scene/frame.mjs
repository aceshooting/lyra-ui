import { geographicFromEnu, geographicToTile } from './geographic.mjs';
import { compileProjectionSnapshot, createProjectionSnapshot, projectScenePosition, projectionOriginFor } from './projection.mjs';

const roots = new WeakMap(), origins = new WeakMap();
const fail = () => { throw new TypeError('Invalid or expired geographic frame.'); };
const finite = value => typeof value === 'number' && Number.isFinite(value);
const positiveInteger = value => Number.isSafeInteger(value) && value > 0;
const limits = Object.freeze({ objects: 2000, models: 32, modelConcurrency: 4,
  geographicVertices: 65536, effectVertices: 65536, modelEncodedBytes: 64 * 1024 * 1024,
  modelDecodedBytes: 256 * 1024 * 1024, modelVertices: 1000000, modelIndices: 6000000,
  modelImagePixels: 67108864, terrainSamples: 65536, terrainTexturePixels: 1048576 });

function field(value, key, optional = false) {
  if (value === null || typeof value !== 'object') fail();
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor) { if (optional) return undefined; fail(); }
  if (!Object.hasOwn(descriptor, 'value')) fail();
  return descriptor.value;
}

function resolvePosition(value) {
  const reference = field(value, 'altitudeReference', true);
  if (reference !== undefined && reference !== 'sea-level' && reference !== 'terrain') fail();
  const result = geographicFromEnu({ lngLat: field(value, 'lngLat'), altitude: field(value, 'altitude', true) }, [0, 0, 0]);
  const lngLat = Object.freeze(result.lngLat);
  return reference === 'terrain' ? Object.freeze({ lngLat, status: 'terrain-unavailable' }) :
    Object.freeze({ lngLat, altitude: result.altitude, status: 'resolved' });
}

function readLayout(root) {
  if (!root.isCurrent()) fail();
  const input = root.layout();
  const revision = field(input, 'revision'), tileZoom = field(input, 'tileZoom'), centerLongitude = field(input, 'centerLongitude');
  if (!positiveInteger(revision) || !Number.isSafeInteger(tileZoom) || tileZoom < 0 || tileZoom > 30 ||
    !finite(centerLongitude) || Math.abs(centerLongitude) > 360000000 || !root.isCurrent()) fail();
  return Object.freeze({ revision, tileZoom, centerLongitude });
}

const sameLayout = (left, right) => left.revision === right.revision && left.tileZoom === right.tileZoom &&
  left.centerLongitude === right.centerLongitude;

function originFor(root, position, layout) {
  const resolved = resolvePosition(position);
  const request = projectionOriginFor({ lngLat: resolved.lngLat,
    altitude: resolved.status === 'resolved' ? resolved.altitude : 0 }, layout);
  const { x, y, wrap } = request.tile;
  if (!root.cachedLayout || !sameLayout(root.cachedLayout, layout)) {
    root.cachedLayout = layout;
    root.cachedOrigins.clear();
  }
  const key = `${root.epoch}:${layout.revision}:${layout.tileZoom}:${x}:${y}:${wrap}`;
  let origin = root.cachedOrigins.get(key);
  if (!origin) {
    origin = Object.freeze({ tile: Object.freeze({ z: layout.tileZoom, x, y, wrap }), key });
    origins.set(origin, { root, layout });
    root.cachedOrigins.set(key, origin);
    if (root.cachedOrigins.size > 256) root.cachedOrigins.delete(root.cachedOrigins.keys().next().value);
  }
  return origin;
}

/** Owns absolute geographic services for one context epoch, without retaining native frame state. */
export function createEpochGeographicServices(input) {
  const epoch = field(input, 'epoch'), isCurrent = field(input, 'isCurrent'), layout = field(input, 'layout');
  if (!positiveInteger(epoch) || typeof isCurrent !== 'function' || typeof layout !== 'function') fail();
  const root = { epoch, isCurrent, layout, cachedOrigins: new Map() };
  readLayout(root);
  const services = Object.freeze({
    limits,
    resolve(position) { readLayout(root); const result = resolvePosition(position); readLayout(root); return result; },
    frameFor(position) {
      const current = readLayout(root), origin = originFor(root, position, current);
      if (!sameLayout(current, readLayout(root))) fail();
      return origin;
    },
    fromEnu(origin, point) {
      readLayout(root);
      if (field(origin, 'status') !== 'resolved') fail();
      const result = geographicFromEnu(origin, point);
      readLayout(root);
      return Object.freeze({ lngLat: Object.freeze(result.lngLat), altitude: result.altitude });
    }
  });
  roots.set(services, root);
  return services;
}

function vector4(value) {
  let result;
  if (Array.isArray(value)) {
    if (field(value, 'length') !== 4) fail();
    result = [0, 1, 2, 3].map(index => field(value, String(index)));
  } else {
    try {
      const prototype = Object.getPrototypeOf(Float32Array.prototype);
      const get = key => Object.getOwnPropertyDescriptor(prototype, key).get.call(value);
      const tag = get(Symbol.toStringTag), backing = get('buffer');
      if (tag !== 'Float32Array' && tag !== 'Float64Array') fail();
      Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength').get.call(backing);
      if (Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get.call(backing) || get('length') !== 4) fail();
      const ownedView = tag === 'Float32Array' ? new Float32Array(backing, get('byteOffset'), 4) : new Float64Array(backing, get('byteOffset'), 4);
      result = [ownedView[0], ownedView[1], ownedView[2], ownedView[3]];
    } catch { fail(); }
  }
  if (!result.every(finite)) fail();
  return Object.freeze(result);
}

const vertexWrapper = `
vec4 lrProjectPosition(vec3 position) {
  return projectTileFor3D(position.xy, position.z);
}
vec3 lrHorizonPosition(vec3 position) {
#ifdef GLOBE
  return projectToSphere(position.xy) * (1.0 + position.z / 6371008.8);
#else
  return vec3(0.0);
#endif
}`;

const fragmentPrelude = `
uniform vec4 u_lr_horizon_camera;
bool lrHorizonOccluded(vec3 position) {
  if (u_lr_horizon_camera.w < 0.5) return false;
  vec3 delta = u_lr_horizon_camera.xyz - position;
  float scale = max(max(abs(delta.x), abs(delta.y)), abs(delta.z));
  if (scale == 0.0) return false;
  vec3 scaledDelta = delta / scale;
  float scaledLength = length(scaledDelta);
  vec3 direction = scaledDelta / scaledLength;
  float along = max(-dot(position, direction), 0.0);
  // Admitted positions have radius below 17; larger segments cannot clamp this distance.
  if (scale < 64.0) along = min(along, scale * scaledLength);
  vec3 closest = position + along * direction;
  return dot(closest, closest) < 1.0 - 0.000001;
}`;

/** Leases copied projection services only for the current synchronous native callback. */
export function createGeographicFrameLease(input) {
  const services = field(input, 'services'), root = roots.get(services);
  const epoch = field(input, 'epoch'), revision = field(input, 'revision'), time = field(input, 'time');
  const width = field(input, 'width'), height = field(input, 'height'), pixelRatio = field(input, 'pixelRatio');
  const reducedMotion = field(input, 'reducedMotion'), isCurrent = field(input, 'isCurrent'), projectionFor = field(input, 'projectionFor');
  if (!root || epoch !== root.epoch || !positiveInteger(revision) || !finite(time) || time < 0 ||
    !finite(width) || width <= 0 || !finite(height) || height <= 0 || !finite(pixelRatio) || pixelRatio <= 0 ||
    typeof reducedMotion !== 'boolean' || typeof isCurrent !== 'function' || typeof projectionFor !== 'function') fail();
  const layout = readLayout(root), projections = new Map();
  let active = true;
  const check = () => {
    if (!active || !isCurrent() || !sameLayout(layout, readLayout(root)) || !active || !isCurrent()) fail();
  };
  const checkOrigin = origin => {
    check();
    const state = origins.get(origin);
    if (!state || state.root !== root || !sameLayout(state.layout, layout)) fail();
  };
  const projection = origin => {
    checkOrigin(origin);
    const { z, x, y, wrap } = origin.tile;
    const key = `${epoch}:${revision}:${layout.revision}:${z}:${x}:${y}:${wrap}`;
    const previous = projections.get(key);
    if (previous) {
      if (previous.state !== 'ready') { previous.state = 'failed'; fail(); }
      return previous.value;
    }
    const entry = { state: 'in-progress' };
    projections.set(key, entry);
    try {
      const source = projectionFor(origin);
      checkOrigin(origin);
      if (entry.state !== 'in-progress') fail();
      const transition = field(source, 'projectionTransition');
      if (!finite(transition) || transition < 0 || transition > 1) fail();
      // Validate/copy native vectors before rounding; horizon admission follows uploaded globeness.
      const numeric = createProjectionSnapshot({ tile: origin.tile, width, height,
        mainMatrix: field(source, 'mainMatrix'), fallbackMatrix: field(source, 'fallbackMatrix'),
        clippingPlane: field(source, 'clippingPlane'), projectionTransition: 0 });
      const compiled = compileProjectionSnapshot({ contract: 1, contextEpoch: epoch, viewRevision: revision,
        layout, tile: origin.tile, width, height, mainMatrix: numeric.mainMatrix.map(Math.fround),
        fallbackMatrix: numeric.fallbackMatrix.map(Math.fround), clippingPlane: numeric.clippingPlane.map(Math.fround),
        tileMercatorCoords: vector4(field(source, 'tileMercatorCoords')).map(Math.fround),
        projectionTransition: Math.fround(transition) });
      const snapshot = compiled.snapshot;
      const data = field(source, 'shaderData');
      const variant = field(data, 'variantName'), prelude = field(data, 'vertexShaderPrelude'), defines = field(data, 'define');
      if (typeof variant !== 'string' || !variant || typeof prelude !== 'string' || !prelude || typeof defines !== 'string') fail();
      const horizon = snapshot.projectionTransition > 0;
      const camera = horizon ? snapshot.clippingPlane.slice(0, 3).map(value => Math.fround(value / -snapshot.clippingPlane[3])) : [0, 0, 0];
      const uniform = (name, type, value) => {
        if (!(Array.isArray(value) ? value : [value]).every(number => finite(Math.fround(number)))) fail();
        return Object.freeze({ name, type, value });
      };
      const shader = Object.freeze({ key: `${origin.key}:${variant}`, vertexPrelude: prelude + vertexWrapper,
        fragmentPrelude, defines, positionEncoding: 'tile-xy-meters-z', projectFunction: 'lrProjectPosition',
        horizonPositionFunction: 'lrHorizonPosition', horizonOccludedFunction: 'lrHorizonOccluded',
        horizonMode: horizon ? 'sphere' : 'none', uniforms: Object.freeze([
          uniform('u_projection_matrix', 'mat4', snapshot.mainMatrix),
          uniform('u_projection_fallback_matrix', 'mat4', snapshot.fallbackMatrix),
          uniform('u_projection_tile_mercator_coords', 'vec4', snapshot.tileMercatorCoords),
          uniform('u_projection_clipping_plane', 'vec4', snapshot.clippingPlane),
          uniform('u_projection_transition', 'float', snapshot.projectionTransition),
          uniform('u_lr_horizon_camera', 'vec4', Object.freeze([...camera, horizon ? 1 : 0]))
        ]) });
      checkOrigin(origin);
      if (entry.state !== 'in-progress') fail();
      entry.value = { snapshot, shader };
      entry.state = 'ready';
      return entry.value;
    } catch (error) {
      entry.state = 'failed';
      throw error;
    }
  };
  check();
  const geographic = Object.freeze({
    resolve(position) { check(); const result = resolvePosition(position); check(); return result; },
    project(position) {
      check();
      const resolved = resolvePosition(position);
      if (resolved.status !== 'resolved') { check(); return Object.freeze({ visible: false, status: resolved.status }); }
      const origin = originFor(root, resolved, layout);
      const result = projectScenePosition(resolved, projection(origin).snapshot);
      check();
      return result;
    },
    encode(position, origin) {
      checkOrigin(origin);
      if (field(position, 'status') !== 'resolved') fail();
      if (projectionOriginFor(position, layout).tile.wrap !== origin.tile.wrap) fail();
      const encoded = geographicToTile(position, origin.tile);
      const [x, y] = encoded.map(Math.fround);
      if (!finite(x) || !finite(y) || x < -32767.5 || x > 32766.5 || y < -32767.5 || y > 32766.5) fail();
      checkOrigin(origin);
      return Object.freeze(encoded);
    },
    shader(origin) { return projection(origin).shader; },
    captureProjection(origin) { return projection(origin).snapshot; }
  });
  const projectionStamp = Object.freeze({ viewRevision: revision, contextEpoch: epoch, layout });
  const frame = Object.freeze({ revision, time, width, height, pixelRatio, reducedMotion, geographic, projectionStamp });
  return Object.freeze({ frame, close() { active = false; projections.clear(); } });
}
