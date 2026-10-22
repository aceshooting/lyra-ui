export type LyraModelFormat = 'gltf' | 'glb' | 'stl' | 'obj' | 'ply' | 'xyz' | 'pcd';
export type LyraModelFormatPreference = 'auto' | LyraModelFormat;
export interface LyraModelCamera {
  readonly yaw: number;
  readonly pitch: number;
  readonly distance: number;
  readonly target: { readonly x: number; readonly y: number; readonly z: number };
}
/** The companion enforces this same encoded-source ceiling before any model parser. */
export const MODEL_SOURCE_MAX_BYTES = 64 * 1024 * 1024;
export const MODEL_FORMATS: readonly LyraModelFormat[] = Object.freeze(['gltf', 'glb', 'stl', 'obj', 'ply', 'xyz', 'pcd']);
export const MODEL_MIME_FORMATS: Readonly<Record<string, LyraModelFormat>> = Object.freeze({
  'model/gltf+json': 'gltf', 'model/gltf-binary': 'glb', 'model/stl': 'stl', 'application/sla': 'stl',
  'model/obj': 'obj', 'application/x-ply': 'ply', 'application/ply': 'ply',
  'application/x-pcd': 'pcd', 'application/pcd': 'pcd',
});
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
function own(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null ? Object.getOwnPropertyDescriptor(value, key)?.value : undefined;
}
function finite(value: unknown): number { if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Model camera fields must be finite numbers'); return value; }
/** Copy only own data fields; accessor properties are never executed. */
export function snapshotModelCamera(value: unknown): LyraModelCamera {
  const target = own(value, 'target');
  return Object.freeze({
    yaw: clamp(finite(own(value, 'yaw')), -1e7, 1e7) % (Math.PI * 2),
    pitch: clamp(finite(own(value, 'pitch')), -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01),
    distance: clamp(finite(own(value, 'distance')), 0.01, ((2 - 2 ** -23) * 2 ** 127) / 8),
    target: Object.freeze({ x: clamp(finite(own(target, 'x')), -1e7, 1e7), y: clamp(finite(own(target, 'y')), -1e7, 1e7), z: clamp(finite(own(target, 'z')), -1e7, 1e7) }),
  });
}
export const DEFAULT_MODEL_CAMERA = snapshotModelCamera({ yaw: 0, pitch: 0, distance: 500, target: { x: 0, y: 0, z: 0 } });
export function resolveModelFormat(preference: unknown, name: string, mimeType: string, src: string): LyraModelFormat | null {
  if (preference !== 'auto') return MODEL_FORMATS.includes(preference as LyraModelFormat) ? preference as LyraModelFormat : null;
  const mime = mimeType.split(';', 1)[0]!.trim().toLowerCase(); const known = Object.hasOwn(MODEL_MIME_FORMATS, mime) ? MODEL_MIME_FORMATS[mime] : undefined; if (known) return known;
  for (const path of [name, src.split(/[?#]/, 1)[0]!]) {
    const extension = /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase();
    if (MODEL_FORMATS.includes(extension as LyraModelFormat)) return extension as LyraModelFormat;
  }
  return null;
}
