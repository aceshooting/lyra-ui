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

/** Snapshots source ancestry and the physical placement shared by all retained channels. */
export function createModelPlacementTransform(options: ModelPlacementOptions = {}) {
  const authoredScale = ownData(options, 'metersPerUnit', true);
  const scale = authoredScale === undefined ? 1 : authoredScale;
  if (typeof scale !== 'number' || !Number.isFinite(scale) || scale <= 0) return invalidPlacement();
  const q = normalizeOrientation(ownData(options, 'orientation', true));
  const transforms = ownData(options, 'nodeTransforms', true);
  const stages: number[][] = [];
  let composed = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  if (transforms !== undefined) {
    if (!Array.isArray(transforms)) return invalidPlacement();
    const length = ownData(transforms, 'length');
    if (typeof length !== 'number' || length > 64) return invalidPlacement();
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
      stages.push(m);
    }
  }
  const [qx, qy, qz, qw] = q;
  const rotate = ([vx, vy, vz]: MapVector3): MapVector3 => {
    const tx = 2 * (qy * vz - qz * vy), ty = 2 * (qz * vx - qx * vz), tz = 2 * (qx * vy - qy * vx);
    const result: MapVector3 = [vx + qw * tx + qy * tz - qz * ty,
      vy + qw * ty + qz * tx - qx * tz, vz + qw * tz + qx * ty - qy * tx];
    if (!result.every(Number.isFinite)) return invalidPlacement();
    return Object.freeze(result);
  };
  const unit = (value: MapVector3): MapVector3 => {
    const maximum = Math.max(...value.map(Math.abs));
    if (!Number.isFinite(maximum) || maximum === 0) return invalidPlacement();
    const scaled = value.map(entry => entry / maximum);
    const length = Math.hypot(...scaled);
    const result: MapVector3 = [scaled[0]! / length, scaled[1]! / length, scaled[2]! / length];
    return Object.freeze(result);
  };
  // Normalize each source column independently so determinant classification cannot overflow.
  const columns = [0, 4, 8].map(offset => [composed[offset]!, composed[offset + 1]!, composed[offset + 2]!]);
  const magnitudes = columns.map(column => Math.max(...column.map(Math.abs)));
  const c = columns.map((column, index) => column.map(value => magnitudes[index] === 0 ? 0 : value / magnitudes[index]!));
  const cross = (a: number[], b: number[]): MapVector3 => [a[1]! * b[2]! - a[2]! * b[1]!,
    a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
  const cofactors = [cross(c[1]!, c[2]!), cross(c[2]!, c[0]!), cross(c[0]!, c[1]!)];
  const determinant = c[0]!.reduce((sum, value, index) => sum + value * cofactors[0]![index]!, 0);
  const determinantSign: -1 | 0 | 1 = determinant < 0 ? -1 : determinant > 0 ? 1 : 0;
  const point = (value: MapVector3): MapVector3 => {
    let [x = 0, y = 0, z = 0] = finiteTuple(value, 3);
    for (const a of stages) {
      [x, y, z] = [a[0]! * x + a[4]! * y + a[8]! * z + a[12]!,
        a[1]! * x + a[5]! * y + a[9]! * z + a[13]!, a[2]! * x + a[6]! * y + a[10]! * z + a[14]!];
      if (![x, y, z].every(Number.isFinite)) return invalidPlacement();
    }
    return rotate([x * scale, -z * scale, y * scale]);
  };
  const normal = (value: MapVector3): MapVector3 => {
    const input = finiteTuple(value, 3);
    if (determinantSign === 0) return invalidPlacement();
    // A^-T = cofactor(normalized columns) * diag(1 / column scales) / det.
    // Its positive common magnitude is discarded by normalization.
    const weighted = input.map((entry, index) => entry / magnitudes[index]!);
    const source = unit([0, 1, 2].map(axis => determinantSign * weighted.reduce((sum, entry, index) =>
      sum + entry * cofactors[index]![axis]!, 0)) as unknown as MapVector3);
    return unit(rotate([source[0], -source[2], source[1]]));
  };
  const tangent = (value: readonly [number, number, number, number], transformedNormal: MapVector3): readonly [number, number, number, number] => {
    const input = finiteTuple(value, 4);
    if (determinantSign === 0 || (input[3] !== -1 && input[3] !== 1)) return invalidPlacement();
    const n = unit(finiteTuple(transformedNormal, 3) as unknown as MapVector3);
    const source = [0, 1, 2].map(axis => columns.reduce((sum, column, index) => sum + column[axis]! * input[index]!, 0));
    const direction = unit(rotate([source[0]!, -source[2]!, source[1]!]));
    const projection = direction.reduce((sum, entry, index) => sum + entry * n[index]!, 0);
    const residual = direction.map((entry, index) => entry - projection * n[index]!);
    if (Math.hypot(...residual) <= 1e-12) return invalidPlacement();
    const result = unit(residual as unknown as MapVector3);
    const output: readonly [number, number, number, number] = [result[0], result[1], result[2], input[3]! * determinantSign];
    return Object.freeze(output);
  };
  return Object.freeze({ determinantSign, point, normal, tangent });
}

/** Applies root-to-leaf source transforms without recentering, then source axes and ENU rotation. */
export function placeModelVertex(point: MapVector3, options: ModelPlacementOptions = {}): MapVector3 {
  finiteTuple(point, 3);
  return createModelPlacementTransform(options).point(point);
}
