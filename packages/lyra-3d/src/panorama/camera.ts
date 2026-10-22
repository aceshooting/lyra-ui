import type { Lyra3dWorldPoint } from '../core/contract.js';
import type { Lyra3dOrbitCamera } from '../core/orbit.js';
import type { PanoramaCamera } from './types.js';
const finite = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const tau = Math.PI * 2;
export function normalizePanoramaCamera(value: Partial<PanoramaCamera>): PanoramaCamera {
  const yaw = finite(value?.yaw, 0);
  return { yaw: ((yaw + Math.PI) % tau + tau) % tau - Math.PI,
    pitch: Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, finite(value?.pitch, 0))),
    fieldOfView: Math.max(20, Math.min(100, finite(value?.fieldOfView, 75))) };
}
export function panoramaPoint(yaw: number, pitch: number, radius = 10): Lyra3dWorldPoint {
  return { x: radius * Math.sin(yaw) * Math.cos(pitch) || 0, y: -radius * Math.sin(pitch) || 0, z: -radius * Math.cos(yaw) * Math.cos(pitch) || 0 };
}
export function panoramaOrbit(camera: PanoramaCamera): Lyra3dOrbitCamera {
  return { target: panoramaPoint(camera.yaw, camera.pitch, 1), yaw: -camera.yaw, pitch: camera.pitch, distance: 1 };
}
export function projectPanoramaPoint(point: Lyra3dWorldPoint, camera: PanoramaCamera, size: { width: number; height: number }) {
  const sy = Math.sin(camera.yaw), cy = Math.cos(camera.yaw), sp = Math.sin(camera.pitch), cp = Math.cos(camera.pitch);
  const depth = point.x * sy * cp - point.y * sp - point.z * cy * cp;
  if (depth <= 0.01 || size.width <= 0 || size.height <= 0) return null;
  const scale = size.height / (2 * Math.tan(camera.fieldOfView * Math.PI / 360) * depth);
  return { x: size.width / 2 + (point.x * cy + point.z * sy) * scale,
    y: size.height / 2 + (point.x * sy * sp + point.y * cp - point.z * cy * sp) * scale, scale };
}
