import type { Lyra3dWorldPoint } from '../core/contract.js';
import type { Lyra3dViewport } from '../core/viewport.js';
import type { GraphSpatialAppearance } from './spatial-appearance.js';
export interface GraphSpatialData {
  readonly nodeCount: number;
  readonly source: Uint32Array;
  readonly target: Uint32Array;
  readonly sizes?: Float32Array;
  readonly directed?: Uint8Array;
  readonly spatialAppearance: GraphSpatialAppearance;
}
export type GraphPositionLookup = (row: number) => Lyra3dWorldPoint | null;
export function spatialNodeWorldRadius(data: GraphSpatialData, row: number, point: Lyra3dWorldPoint, viewport: Lyra3dViewport): number {
  const diameter = data.sizes?.[row] ?? viewport.style.pointSize;
  if (data.spatialAppearance.sizeUnits === 'world') return diameter / 2;
  const projection = viewport.project(point); return projection ? diameter / (2 * projection.scale) : 0;
}
export function spatialEdgeSegments(data: GraphSpatialData, edge: number): number {
  return !data.spatialAppearance.dangling?.[edge] && data.source[edge] === data.target[edge] ? 16 : 1;
}
/** Samples the same world path used by edge paint, arrows, labels and directional particles. */
export function spatialEdgePoint(data: GraphSpatialData, edge: number, t: number, position: GraphPositionLookup, viewport: Lyra3dViewport): Lyra3dWorldPoint | null {
  const source = data.source[edge]!; const a = position(source); if (!a) return null;
  if (data.spatialAppearance.dangling?.[edge]) return { x: a.x + 28 * t, y: a.y - 28 * t, z: a.z };
  if (source === data.target[edge]) { const radius = spatialNodeWorldRadius(data, source, a, viewport) * 1.6; return { x: a.x + Math.sin(t * Math.PI * 2) * radius, y: a.y - (1 - Math.cos(t * Math.PI * 2)) * radius, z: a.z }; }
  const b = position(data.target[edge]!); return b ? { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t } : null;
}

/** Bound expanded GPU attributes independently of the logical edge ceiling. */
const GRAPH_MAX_SPATIAL_PRIMITIVES = 2_000_000;
export function spatialPrimitiveCount(data: GraphSpatialData): number {
  let count = 0;
  for (let edge = 0; edge < data.source.length; edge++) {
    count += spatialEdgeSegments(data, edge) + (data.directed?.[edge] ? 1 : 0);
    if (count > GRAPH_MAX_SPATIAL_PRIMITIVES) throw new RangeError('Graph spatial geometry exceeds its primitive limit');
  }
  return count;
}
