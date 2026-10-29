import { Matrix4 } from 'three';
import type { ResolvedLyra3dStyle } from '../core/style.js';
import { Lyra3dXrError } from '../xr/types.js';
import type { AdmittedPointsData } from './data.js';
import type { PointsXrAllocationAccount, PointsXrLabelLayout } from './xr-label-layout.js';

type Xyz = readonly [number, number, number];

/** Fixed-size numeric policy; no semantic data or renderer owner is retained. */
export interface PointsXrProfile {
  readonly min: Xyz;
  readonly max: Xyz;
  readonly center: Xyz;
  readonly radius: number;
  readonly scale: number;
  readonly padding: number;
  readonly units: number;
  readonly near: number;
  readonly far: number;
}

export interface PointsXrLabelProfileInput {
  readonly identity: object;
  readonly layout: PointsXrLabelLayout;
  readonly account: PointsXrAllocationAccount;
}

const normalMinimum = 2 ** -126;
const unsupported = (): never => { throw new Lyra3dXrError('unsupported-scene'); };
const failed = (): never => { throw new Lyra3dXrError('failed'); };

function coordinate(value: number): number {
  if (!Number.isFinite(value) || (value !== 0 && Math.abs(value) < normalMinimum)) return unsupported();
  const uploaded = Math.fround(value);
  if (!Number.isFinite(uploaded) || (uploaded !== 0 && Math.abs(uploaded) < normalMinimum)) return unsupported();
  return uploaded;
}

function downwardScale(value: number, account?: PointsXrAllocationAccount): number {
  const buffer = account ? account.allocate(4) : new ArrayBuffer(4);
  try {
    const floats = new Float32Array(buffer);
    floats[0] = value;
    if (!Number.isFinite(value) || !Number.isFinite(floats[0])) return unsupported();
    // Positive IEEE-754 bit patterns are ordered by value, including the normal boundary.
    if (floats[0]! > value) {
      const bits = new Uint32Array(buffer);
      bits[0] = bits[0]! - 1;
    }
    const result = floats[0]!;
    if (!Number.isFinite(result) || result < normalMinimum) return unsupported();
    return result;
  } finally { account?.release(buffer); }
}

/** Admit the complete scene before acquiring native presentation ownership. */
export function createPointsXrProfile(data: AdmittedPointsData, style: ResolvedLyra3dStyle, labels?: PointsXrLabelProfileInput): PointsXrProfile {
  const count = data.positions.length / 3;
  if (data.mode !== '3d' || count > 100_000 || (data.segments?.length ?? 0) / 2 > 100_000) return unsupported();
  if (!labels && (data.labels?.some(label => label.length > 0) ||
    data.axes.some(axis => Boolean(axis.label) || axis.ticks.some(tick => tick.label.length > 0)))) return unsupported();
  if (labels) {
    let axisRows = 0;
    for (const axis of data.axes) { if (axis.label) axisRows++; for (const tick of axis.ticks) if (tick.label) axisRows++; }
    if (labels.layout.identity !== labels.identity || labels.layout.pointRows !== count || labels.layout.axisRows !== axisRows ||
      labels.layout.axisAnchors.length !== axisRows * 3 || labels.layout.instanceData.length !== (count + axisRows) * 9 ||
      !Number.isFinite(labels.layout.padding) || labels.layout.padding < 0) return unsupported();
  }

  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  const include = (x: number, y: number, z: number): void => {
    const values = [coordinate(x), coordinate(y), coordinate(z)];
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis]!, values[axis]!);
      max[axis] = Math.max(max[axis]!, values[axis]!);
    }
  };
  for (let offset = 0; offset < data.positions.length; offset += 3) include(data.positions[offset]!, data.positions[offset + 1]!, data.positions[offset + 2]!);

  // The axis builder uploads these exact Float32 endpoints. Visit them without
  // creating a second row-proportional endpoint array for native presentation.
  for (const axis of data.axes) {
    const dimension = axis.axis === 'x' ? 0 : axis.axis === 'y' ? 1 : 2;
    const start: [number, number, number] = [0, 0, 0];
    const end: [number, number, number] = [0, 0, 0];
    start[dimension] = axis.min; end[dimension] = axis.max;
    include(...start); include(...end);
    if (axis.grid) for (const tick of axis.ticks) for (const other of data.axes) {
      if (other.axis === axis.axis) continue;
      const otherDimension = other.axis === 'x' ? 0 : other.axis === 'y' ? 1 : 2;
      start[dimension] = tick.value; end[dimension] = tick.value;
      start[otherDimension] = other.min; end[otherDimension] = other.max;
      include(...start); include(...end);
      start[otherDimension] = 0; end[otherDimension] = 0;
    }
  }
  if (labels) for (let offset = 0; offset < labels.layout.axisAnchors.length; offset += 3) {
    include(labels.layout.axisAnchors[offset]!, labels.layout.axisAnchors[offset + 1]!, labels.layout.axisAnchors[offset + 2]!);
  }
  if (min[0] === Infinity) { min.fill(0); max.fill(0); }
  const center: [number, number, number] = [
    (min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2,
  ];
  const radius = Math.hypot((max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2);
  let largest = count === 0 ? 0 : data.sizes ? 0 : style.pointSize;
  if (data.sizes) for (const size of data.sizes) largest = Math.max(largest, size);
  if ((data.segments?.length ?? 0) > 0 || data.axes.length > 0) largest = Math.max(largest, style.lineWidth);
  const padding = Math.max(largest * .001, labels?.layout.padding ?? 0);
  if (!Number.isFinite(padding) || padding < 0 || padding + .001 >= .75 || !Number.isFinite(radius)) return unsupported();
  const scale = radius === 0 ? 1 : downwardScale((.75 - padding - .001) / radius, labels?.account);
  for (let axis = 0; axis < 3; axis++) {
    // Dividing the limit first avoids overflowing even when the scene cannot fit.
    const limit = 64 / scale;
    if (Math.abs(min[axis]!) > limit || Math.abs(max[axis]!) > limit || Math.abs(center[axis]!) > limit) return unsupported();
  }
  return Object.freeze({ min: Object.freeze(min), max: Object.freeze(max), center: Object.freeze(center), radius, scale, padding, units: .002, near: .01, far: 100 });
}

function rigid(matrix: ArrayLike<number>): void {
  if (matrix.length !== 16) return failed();
  for (let index = 0; index < 16; index++) if (!Number.isFinite(matrix[index])) return failed();
  if (matrix[3] !== 0 || matrix[7] !== 0 || matrix[11] !== 0 || matrix[15] !== 1) return failed();
  for (let axis = 0; axis < 3; axis++) if (Math.abs(matrix[12 + axis]!) > 64) return failed();
  for (let column = 0; column < 3; column++) for (let other = column; other < 3; other++) {
    let dot = 0;
    for (let row = 0; row < 3; row++) dot += matrix[column * 4 + row]! * matrix[other * 4 + row]!;
    if (Math.abs(dot - (column === other ? 1 : 0)) > 1e-4) return failed();
  }
  const determinant = matrix[0]! * (matrix[5]! * matrix[10]! - matrix[9]! * matrix[6]!)
    - matrix[4]! * (matrix[1]! * matrix[10]! - matrix[9]! * matrix[2]!)
    + matrix[8]! * (matrix[1]! * matrix[6]! - matrix[5]! * matrix[2]!);
  if (Math.abs(determinant - 1) > 1e-4) return failed();
}

/** Validate actual common-head and eye world transforms, then the GPU model views. */
export function validatePointsXrPose(viewer: ArrayLike<number>, eyes: readonly ArrayLike<number>[], root?: ArrayLike<number>): void {
  rigid(viewer);
  for (const eye of eyes) rigid(eye);
  if (!root) return;
  if (root.length !== 16) return failed();
  for (let index = 0; index < 16; index++) if (!Number.isFinite(root[index]) || !Number.isFinite(Math.fround(root[index]!))) return failed();
  const model = new Matrix4().fromArray(root);
  const modelView = new Matrix4();
  for (const eye of eyes) {
    modelView.fromArray(eye).invert().multiply(model);
    for (const value of modelView.elements) if (!Number.isFinite(value) || !Number.isFinite(Math.fround(value))) return failed();
  }
}

/** Freeze a yaw-only tabletop root with one semantic-y reflection. */
export function createPointsXrPlacement(profile: PointsXrProfile, viewer: ArrayLike<number>, inlineYaw: number): readonly number[] {
  rigid(viewer);
  let forwardX = -viewer[8]!, forwardZ = -viewer[10]!;
  const horizontal = Math.hypot(forwardX, forwardZ);
  if (horizontal >= 1e-6) { forwardX /= horizontal; forwardZ /= horizontal; }
  else {
    const yaw = Number.isFinite(inlineYaw) ? inlineYaw : 0;
    forwardX = -Math.sin(yaw); forwardZ = -Math.cos(yaw);
  }
  const s = profile.scale;
  const x0 = -forwardZ * s, x2 = forwardX * s;
  const z0 = -forwardX * s, z2 = -forwardZ * s;
  const [cx, cy, cz] = profile.center;
  const matrix = [
    x0, 0, x2, 0,
    0, -s, 0, 0,
    z0, 0, z2, 0,
    viewer[12]! + 2 * forwardX - x0 * cx - z0 * cz,
    viewer[13]! + s * cy,
    viewer[14]! + 2 * forwardZ - x2 * cx - z2 * cz,
    1,
  ];
  validatePointsXrPose(viewer, [], matrix);
  return Object.freeze(matrix);
}
