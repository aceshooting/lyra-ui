import type { LyraGraphPosition } from './graph-model.js';

/** Local records accept finite signed curvature, bounded to one chord length. */
export function normalizeGraphCurvature(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
}

function control(a: LyraGraphPosition, b: LyraGraphPosition, curvature: number): LyraGraphPosition {
  const x = b.x - a.x, y = b.y - a.y, z = b.z - a.z;
  const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
  const basis = ax <= ay && ax <= az ? 0 : ay <= az ? 1 : 2;
  const nx = basis === 0 ? 0 : basis === 1 ? -z : y;
  const ny = basis === 0 ? z : basis === 1 ? 0 : -x;
  const nz = basis === 0 ? -y : basis === 1 ? x : 0;
  const length = Math.hypot(nx, ny, nz);
  const scale = length ? 2 * normalizeGraphCurvature(curvature) * Math.hypot(x, y, z) / length : 0;
  return { x: (a.x + b.x) / 2 + scale * nx, y: (a.y + b.y) / 2 + scale * ny, z: (a.z + b.z) / 2 + scale * nz };
}

/** Directed world-space quadratic; reversing endpoints reverses the bow. */
export function graphCurvePoint(a: LyraGraphPosition, b: LyraGraphPosition, curvature: number, t: number): LyraGraphPosition {
  if (t === 0) return { ...a };
  if (t === 1) return { ...b };
  const c = control(a, b, curvature), s = 1 - t;
  return { x: s * s * a.x + 2 * s * t * c.x + t * t * b.x,
    y: s * s * a.y + 2 * s * t * c.y + t * t * b.y,
    z: s * s * a.z + 2 * s * t * c.z + t * t * b.z };
}

export function graphCurveTangent(a: LyraGraphPosition, b: LyraGraphPosition, curvature: number): LyraGraphPosition {
  const c = control(a, b, curvature);
  return { x: 2 * (b.x - c.x), y: 2 * (b.y - c.y), z: 2 * (b.z - c.z) };
}

/** Endpoints and every interior axis extremum bound the continuous quadratic. */
export function graphCurveExtrema(a: LyraGraphPosition, b: LyraGraphPosition, curvature: number): readonly LyraGraphPosition[] {
  const c = control(a, b, curvature), points = [{ ...a }, { ...b }];
  for (const axis of ['x', 'y', 'z'] as const) {
    const denominator = a[axis] - 2 * c[axis] + b[axis];
    const t = denominator ? (a[axis] - c[axis]) / denominator : 0;
    if (t > 0 && t < 1) points.push(graphCurvePoint(a, b, curvature, t));
  }
  return points;
}
