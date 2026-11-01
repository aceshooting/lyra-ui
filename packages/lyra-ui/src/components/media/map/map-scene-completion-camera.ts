import type { SceneCompletionCameraFacts, SceneRenderPublication } from './map-scene-render-contract.js';

interface CameraMap {
  getCenter?(): { readonly lat: number };
  getZoom?(): number;
  getPitch?(): number;
  getMaxBounds?(): unknown;
  getMinZoom?(): number;
  getMaxZoom?(): number;
  getTerrain?(): unknown;
  isMoving?(): boolean;
  getProjection?(): unknown;
  readonly panBy?: unknown;
  readonly stop?: unknown;
  readonly on?: unknown;
  readonly off?: unknown;
}

/** Captures public camera capabilities without commanding or observing the camera. */
export function captureMapSceneCompletionCamera(options: {
  readonly expected: SceneRenderPublication;
  readonly capturePublication: () => SceneRenderPublication;
  readonly captureMap: () => CameraMap | undefined;
  readonly captureIntent: () => { readonly explicitBounds: boolean; readonly explicitZoomLimits: boolean };
  readonly isCurrent: () => boolean;
}): SceneCompletionCameraFacts | undefined {
  try {
    const { expected } = options;
    if (expected.phase !== 'resolved' || !options.isCurrent() || options.capturePublication() !== expected) return undefined;
    const map = options.captureMap();
    if (!map || typeof map.getCenter !== 'function' || typeof map.getZoom !== 'function' ||
      typeof map.getPitch !== 'function' || typeof map.getMaxBounds !== 'function' ||
      typeof map.getMinZoom !== 'function' || typeof map.getMaxZoom !== 'function' ||
      typeof map.getTerrain !== 'function' || typeof map.isMoving !== 'function' ||
      typeof map.getProjection !== 'function') return undefined;
    const latitude = map.getCenter().lat, zoom = map.getZoom(), pitch = map.getPitch();
    const bounds = map.getMaxBounds(), nativeMinZoom = map.getMinZoom(), nativeMaxZoom = map.getMaxZoom();
    const terrain = map.getTerrain(), moving = map.isMoving(), projection = map.getProjection();
    if (!projection || typeof projection !== 'object' || !('type' in projection)) return undefined;
    const projectionType = projection.type;
    const intent = options.captureIntent();
    const explicitBounds = intent.explicitBounds, explicitZoomLimits = intent.explicitZoomLimits;
    const canPan = typeof map.panBy === 'function', canStop = typeof map.stop === 'function';
    const canObserveMotion = typeof map.on === 'function' && typeof map.off === 'function';
    if (![latitude, zoom, pitch, nativeMinZoom, nativeMaxZoom].every(Number.isFinite) ||
      latitude < -90 || latitude > 90 || nativeMinZoom > nativeMaxZoom ||
      typeof moving !== 'boolean' || typeof explicitBounds !== 'boolean' || typeof explicitZoomLimits !== 'boolean' ||
      (projectionType !== 'mercator' && projectionType !== 'globe')) return undefined;
    const facts = Object.freeze({ latitude, zoom, pitch, explicitBounds, explicitZoomLimits,
      nativeBounds: bounds !== undefined && bounds !== null, nativeMinZoom, nativeMaxZoom,
      terrain: terrain !== undefined && terrain !== null, canPan, canObserveMotion, canStop, moving, hasProjection: true });
    if (!options.isCurrent() || options.captureMap() !== map || options.capturePublication() !== expected) return undefined;
    return facts;
  } catch { return undefined; }
}
