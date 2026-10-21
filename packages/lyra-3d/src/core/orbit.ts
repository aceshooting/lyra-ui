import type { Lyra3dScreenPoint, Lyra3dWorldPoint } from './contract.js';

/**
 * An orbit camera: `target` is the point looked at, `distance` the eye's distance from it, `yaw`
 * the rotation around the vertical axis and `pitch` the elevation, both in radians. World `y`
 * points down the screen at zero pitch, matching the orientation convention of the built-in
 * Canvas 3D renderer.
 */
export interface Lyra3dOrbitCamera {
  readonly yaw: number;
  readonly pitch: number;
  readonly distance: number;
  readonly target: Lyra3dWorldPoint;
}

export interface Lyra3dViewportSize {
  readonly width: number;
  readonly height: number;
}

/** Axis-aligned bounds in world units. */
export interface Lyra3dBounds {
  readonly min: Lyra3dWorldPoint;
  readonly max: Lyra3dWorldPoint;
}

/** Where a world point lands on screen, in CSS pixels from the top-left, and its eye depth. */
export interface Lyra3dProjectedPoint extends Lyra3dScreenPoint {
  readonly depth: number;
  /** CSS pixels per world unit at this depth. */
  readonly scale: number;
}

/** A camera pose in renderer space, where the world is mirrored on `y` (see {@link orbitCameraPose}). */
export interface Lyra3dCameraPose {
  readonly position: readonly [number, number, number];
  readonly up: readonly [number, number, number];
  readonly target: readonly [number, number, number];
  readonly near: number;
}

/** Vertical field of view, in radians. */
export const LYRA_3D_FIELD_OF_VIEW = Math.PI / 4;
/** Largest accepted world coordinate; camera distances have a separate renderer-safe ceiling. */
export const LYRA_3D_WORLD_LIMIT = 1e7;
// Keep eye positions and the viewport's four-distance far plane within finite Float32 range.
// Framing distance must not share the coordinate bound: even an ordinary view of the full world
// needs a more distant eye, and narrow allocations need proportionally more room.
const MAX_CAMERA_DISTANCE = ((2 - 2 ** -23) * 2 ** 127) / 8;
const PITCH_LIMIT = Math.PI / 2 - 0.01;
const ORIGIN: Lyra3dWorldPoint = Object.freeze({ x: 0, y: 0, z: 0 });

export const DEFAULT_ORBIT_CAMERA: Lyra3dOrbitCamera = Object.freeze({ yaw: 0, pitch: 0, distance: 500, target: ORIGIN });

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function ownNumber(source: unknown, key: string): number | undefined {
  if (typeof source !== 'object' || source === null) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(source, key);
  const value: unknown = descriptor && 'value' in descriptor ? descriptor.value : undefined;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Copies a world point from untrusted input; `undefined` unless all three coordinates are finite. */
export function normalizeWorldPoint(value: unknown): Lyra3dWorldPoint | undefined {
  const x = ownNumber(value, 'x');
  const y = ownNumber(value, 'y');
  const z = ownNumber(value, 'z');
  if (x === undefined || y === undefined || z === undefined) return undefined;
  const limit = (entry: number) => clamp(entry, -LYRA_3D_WORLD_LIMIT, LYRA_3D_WORLD_LIMIT);
  return Object.freeze({ x: limit(x), y: limit(y), z: limit(z) });
}

/** Copies only own finite data fields; anything missing or invalid comes from `fallback`. */
export function normalizeOrbitCamera(value: unknown, fallback: Lyra3dOrbitCamera = DEFAULT_ORBIT_CAMERA): Lyra3dOrbitCamera {
  const yaw = ownNumber(value, 'yaw');
  const pitch = ownNumber(value, 'pitch');
  const distance = ownNumber(value, 'distance');
  const target = typeof value === 'object' && value !== null
    ? normalizeWorldPoint(Object.getOwnPropertyDescriptor(value, 'target')?.value)
    : undefined;
  return Object.freeze({
    yaw: clamp(yaw ?? fallback.yaw, -LYRA_3D_WORLD_LIMIT, LYRA_3D_WORLD_LIMIT) % (Math.PI * 2),
    pitch: clamp(pitch ?? fallback.pitch, -PITCH_LIMIT, PITCH_LIMIT),
    distance: clamp(distance ?? fallback.distance, 0.01, MAX_CAMERA_DISTANCE),
    target: target ?? Object.freeze({ ...fallback.target }),
  });
}

/** The camera-space position of a world point: `x` right, `y` down, `z` depth along the view. */
function cameraSpace(point: Lyra3dWorldPoint, camera: Lyra3dOrbitCamera): Lyra3dWorldPoint {
  const dx = point.x - camera.target.x;
  const dy = point.y - camera.target.y;
  const dz = point.z - camera.target.z;
  const x = Math.cos(camera.yaw) * dx - Math.sin(camera.yaw) * dz;
  const z = Math.sin(camera.yaw) * dx + Math.cos(camera.yaw) * dz;
  return {
    x,
    y: Math.cos(camera.pitch) * dy - Math.sin(camera.pitch) * z,
    z: camera.distance - (Math.sin(camera.pitch) * dy + Math.cos(camera.pitch) * z),
  };
}

/** The near clipping distance for a camera. */
export function orbitNearPlane(camera: Lyra3dOrbitCamera): number {
  return Math.max(0.01, camera.distance * 0.001);
}

/** Projects a world point to the viewport; `null` behind the near plane. */
export function projectOrbitPoint(
  point: Lyra3dWorldPoint,
  camera: Lyra3dOrbitCamera,
  viewport: Lyra3dViewportSize,
): Lyra3dProjectedPoint | null {
  const eye = cameraSpace(point, camera);
  if (eye.z < orbitNearPlane(camera)) return null;
  const scale = viewport.height / (2 * Math.tan(LYRA_3D_FIELD_OF_VIEW / 2) * eye.z);
  return { x: viewport.width / 2 + eye.x * scale, y: viewport.height / 2 + eye.y * scale, depth: eye.z, scale };
}

/**
 * The pose a right-handed renderer camera needs to reproduce {@link projectOrbitPoint} when the
 * scene's world group is mirrored on `y` (`scale.y = -1`). Mirroring keeps the y-down world
 * convention while the renderer keeps its usual handedness and face winding.
 */
export function orbitCameraPose(camera: Lyra3dOrbitCamera): Lyra3dCameraPose {
  const sy = Math.sin(camera.yaw), cy = Math.cos(camera.yaw), sp = Math.sin(camera.pitch), cp = Math.cos(camera.pitch);
  const target = [camera.target.x, -camera.target.y, camera.target.z] as const;
  return {
    position: [target[0] + camera.distance * cp * sy, target[1] - camera.distance * sp, target[2] + camera.distance * cp * cy],
    up: [sp * sy, cp, sp * cy],
    target,
    near: orbitNearPlane(camera),
  };
}

/** Bounds of an interleaved `x, y, z` array, optionally grown by a per-item radius. `null` when empty. */
export function boundsOfPositions(positions: ArrayLike<number>, radii?: ArrayLike<number>): Lyra3dBounds | null {
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  const count = Math.floor(positions.length / 3);
  for (let index = 0; index < count; index += 1) {
    const x = positions[index * 3] ?? Number.NaN, y = positions[index * 3 + 1] ?? Number.NaN, z = positions[index * 3 + 2] ?? Number.NaN;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    const radius = Math.max(0, Number(radii?.[index] ?? 0) || 0);
    minX = Math.min(minX, x - radius); maxX = Math.max(maxX, x + radius);
    minY = Math.min(minY, y - radius); maxY = Math.max(maxY, y + radius);
    minZ = Math.min(minZ, z - radius); maxZ = Math.max(maxZ, z + radius);
  }
  if (minX > maxX) return null;
  return { min: { x: minX, y: minY, z: minZ }, max: { x: maxX, y: maxY, z: maxZ } };
}

/**
 * A camera that frames `bounds` inside `padding` CSS pixels on every side, looking from `yaw` and
 * `pitch` (default: straight on, as the built-in renderer's fit does). Empty bounds keep the default
 * framing around the origin. Finite bounds are constrained to the supported world range; invalid
 * bounds keep default framing. Dimensions are finite and at least one CSS pixel. Required distances
 * beyond the renderer's finite Float32 headroom saturate, so arbitrarily extreme aspect ratios
 * need not fit inside the padding.
 */
export function fitOrbitCamera(
  bounds: Lyra3dBounds | null,
  viewport: Lyra3dViewportSize,
  padding = 24,
  orientation: { readonly yaw: number; readonly pitch: number } = { yaw: 0, pitch: 0 },
): Lyra3dOrbitCamera {
  if (!bounds) return normalizeOrbitCamera({ ...orientation }, DEFAULT_ORBIT_CAMERA);
  const min = normalizeWorldPoint(bounds.min);
  const max = normalizeWorldPoint(bounds.max);
  if (!min || !max || min.x > max.x || min.y > max.y || min.z > max.z) {
    return normalizeOrbitCamera({ ...orientation }, DEFAULT_ORBIT_CAMERA);
  }
  const target = {
    x: (min.x + max.x) / 2,
    y: (min.y + max.y) / 2,
    z: (min.z + max.z) / 2,
  };
  const radius = Math.max(1, Math.hypot(max.x - min.x, max.y - min.y, max.z - min.z) / 2);
  const width = Number.isFinite(viewport.width) ? Math.max(1, viewport.width) : 1;
  const height = Number.isFinite(viewport.height) ? Math.max(1, viewport.height) : 1;
  const safePadding = clamp(Number.isFinite(padding) ? padding : 24, 0, Math.min(width, height) * 0.45);
  const aspect = Math.min((width - 2 * safePadding) / height, (height - 2 * safePadding) / height);
  const angle = Math.atan(Math.tan(LYRA_3D_FIELD_OF_VIEW / 2) * aspect);
  const distance = Math.min(MAX_CAMERA_DISTANCE, radius / Math.sin(angle));
  return normalizeOrbitCamera({ yaw: orientation.yaw, pitch: orientation.pitch, distance, target });
}

/** Looks at `point`, keeping the orientation; `distance` defaults to the current distance. */
export function focusOrbitCamera(camera: Lyra3dOrbitCamera, point: Lyra3dWorldPoint, distance = camera.distance): Lyra3dOrbitCamera {
  return normalizeOrbitCamera({ ...camera, target: point, distance }, camera);
}

/** Rotates by `yaw` and `pitch` radians; pitch stays short of the poles. */
export function orbitBy(camera: Lyra3dOrbitCamera, yaw: number, pitch: number): Lyra3dOrbitCamera {
  return normalizeOrbitCamera({ ...camera, yaw: camera.yaw + yaw, pitch: camera.pitch + pitch }, camera);
}

/** Multiplies the distance by `factor` (below 1 moves closer). */
export function zoomBy(camera: Lyra3dOrbitCamera, factor: number): Lyra3dOrbitCamera {
  return normalizeOrbitCamera({ ...camera, distance: camera.distance * factor }, camera);
}

/** Moves the target by a screen-space drag of `dx`, `dy` CSS pixels, keeping the orientation. */
export function panBy(camera: Lyra3dOrbitCamera, dx: number, dy: number, viewport: Lyra3dViewportSize): Lyra3dOrbitCamera {
  const units = (2 * camera.distance * Math.tan(LYRA_3D_FIELD_OF_VIEW / 2)) / Math.max(1, viewport.height);
  const sy = Math.sin(camera.yaw), cy = Math.cos(camera.yaw), sp = Math.sin(camera.pitch), cp = Math.cos(camera.pitch);
  return normalizeOrbitCamera({
    ...camera,
    target: {
      x: camera.target.x - units * (cy * dx + sy * sp * dy),
      y: camera.target.y - units * cp * dy,
      z: camera.target.z - units * (-sy * dx + cy * sp * dy),
    },
  }, camera);
}

/** Interpolates two cameras at `t` in `[0, 1]`, turning the short way around and zooming geometrically. */
export function interpolateOrbit(from: Lyra3dOrbitCamera, to: Lyra3dOrbitCamera, t: number): Lyra3dOrbitCamera {
  const k = clamp(Number.isFinite(t) ? t : 1, 0, 1);
  if (k === 0) return from;
  if (k === 1) return to;
  let turn = (to.yaw - from.yaw) % (Math.PI * 2);
  if (turn > Math.PI) turn -= Math.PI * 2;
  if (turn < -Math.PI) turn += Math.PI * 2;
  const mix = (a: number, b: number) => a + (b - a) * k;
  return normalizeOrbitCamera({
    yaw: from.yaw + turn * k,
    pitch: mix(from.pitch, to.pitch),
    distance: from.distance * Math.pow(to.distance / from.distance, k),
    target: { x: mix(from.target.x, to.target.x), y: mix(from.target.y, to.target.y), z: mix(from.target.z, to.target.z) },
  }, to);
}
