import type { MapQuaternion, MapVector3, ModelPlacementOptions } from './types.js';

export function invalidPlacement(): never { throw new TypeError('Invalid model placement.'); }
export function ownData(value: unknown, key: string, optional = false): unknown {
  if (value === null || typeof value !== 'object') return invalidPlacement();
  const entry = Object.getOwnPropertyDescriptor(value, key);
  if (!entry) { if (optional) return undefined; return invalidPlacement(); }
  if (!Object.hasOwn(entry, 'value')) return invalidPlacement();
  return entry.value;
}
export function finiteTuple(value: unknown, size: number): number[] {
  if (!Array.isArray(value) || ownData(value, 'length') !== size) return invalidPlacement();
  return Array.from({ length: size }, (_, index) => {
    const entry = ownData(value, String(index));
    if (typeof entry !== 'number' || !Number.isFinite(entry)) return invalidPlacement();
    return entry;
  });
}
export function normalizeOrientation(value: unknown): MapQuaternion {
  const q = finiteTuple(value === undefined ? [0, 0, 0, 1] : value, 4);
  const maximum = Math.max(...q.map(Math.abs));
  if (maximum === 0) return invalidPlacement();
  const scaled = q.map(entry => entry / maximum);
  const length = Math.hypot(...scaled);
  return Object.freeze(scaled.map(entry => entry / length)) as unknown as MapQuaternion;
}

/** Applies root-to-leaf source transforms without recentering, then source axes and ENU rotation. */
export function placeModelVertex(point: MapVector3, options: ModelPlacementOptions = {}): MapVector3 {
  let [x = 0, y = 0, z = 0] = finiteTuple(point, 3);
  const authoredScale = ownData(options, 'metersPerUnit', true);
  const scale = authoredScale === undefined ? 1 : authoredScale;
  if (typeof scale !== 'number' || !Number.isFinite(scale) || scale <= 0) return invalidPlacement();
  const q = normalizeOrientation(ownData(options, 'orientation', true));
  const transforms = ownData(options, 'nodeTransforms', true);
  if (transforms !== undefined) {
    if (!Array.isArray(transforms)) return invalidPlacement();
    const length = ownData(transforms, 'length');
    if (typeof length !== 'number' || length > 64) return invalidPlacement();
    let composed = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    // Apply leaf first: parent * child * point.
    for (let index = length - 1; index >= 0; index--) {
      const m = finiteTuple(ownData(transforms, String(index)), 16);
      if (m[3] !== 0 || m[7] !== 0 || m[11] !== 0 || m[15] !== 1) return invalidPlacement();
      const a = m as [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];
      const prior = composed;
      composed = Array.from({ length: 16 }, (_, element) => {
        const row = element % 4, column = Math.floor(element / 4);
        let sum = 0;
        for (let k = 0; k < 4; k++) sum += a[k * 4 + row]! * prior[column * 4 + k]!;
        return sum;
      });
      if (!composed.every(Number.isFinite)) return invalidPlacement();
      [x, y, z] = [a[0] * x + a[4] * y + a[8] * z + a[12],
        a[1] * x + a[5] * y + a[9] * z + a[13], a[2] * x + a[6] * y + a[10] * z + a[14]];
      if (![x, y, z].every(Number.isFinite)) return invalidPlacement();
    }
  }
  const v: MapVector3 = [x * scale, -z * scale, y * scale];
  const [qx, qy, qz, qw] = q;
  const [vx, vy, vz] = v;
  const tx = 2 * (qy * vz - qz * vy), ty = 2 * (qz * vx - qx * vz), tz = 2 * (qx * vy - qy * vx);
  const result: MapVector3 = [vx + qw * tx + qy * tz - qz * ty,
    vy + qw * ty + qz * tx - qx * tz, vz + qw * tz + qx * ty - qy * tx];
  if (!result.every(Number.isFinite)) return invalidPlacement();
  return Object.freeze(result);
}
