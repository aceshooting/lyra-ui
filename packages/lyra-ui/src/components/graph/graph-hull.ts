export interface HullPoint {
  x: number;
  y: number;
}

function cross(o: HullPoint, a: HullPoint, b: HullPoint): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/**
 * Andrew's monotone chain convex hull, O(n log n), dependency-free. Returns hull vertices in
 * counter-clockwise order with no duplicate closing point. 0/1/2-point inputs pass through
 * unchanged -- `hullPathD()` below handles those as a dot/capsule via the caller's own stroke,
 * not a distinct geometry code path here.
 */
export function convexHull(points: HullPoint[]): HullPoint[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length <= 2) return pts;
  const lower: HullPoint[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: HullPoint[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

/**
 * Path data for a hull's raw polygon. The padded, rounded "blob" look comes entirely from the
 * caller's own stroke (`stroke-width: 2 * padding`, round linejoin/linecap) around this raw
 * shape -- a single point draws as a zero-length line (a well-known SVG idiom: a round dot under
 * a round linecap), two points as a plain open segment (the stroke then renders a capsule).
 */
export function hullPathD(hull: HullPoint[]): string {
  if (hull.length === 0) return '';
  if (hull.length === 1) return `M ${hull[0]!.x} ${hull[0]!.y} L ${hull[0]!.x} ${hull[0]!.y}`;
  const [first, ...rest] = hull;
  const segments = rest.map((p) => `L ${p.x} ${p.y}`).join(' ');
  return hull.length === 2 ? `M ${first!.x} ${first!.y} ${segments}` : `M ${first!.x} ${first!.y} ${segments} Z`;
}

export function hullCentroidX(hull: HullPoint[]): number {
  if (!hull.length) return 0;
  return hull.reduce((sum, p) => sum + p.x, 0) / hull.length;
}

export function hullTopY(hull: HullPoint[]): number {
  if (!hull.length) return 0;
  return Math.min(...hull.map((p) => p.y));
}
