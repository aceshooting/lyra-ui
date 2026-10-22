import { finiteRange } from '../../../internal/numbers.js';
import { getOwnDataDescriptor } from '../../../internal/data-descriptors.js';
import { graphLinkIdentity, type LyraGraphCamera, type LyraGraphEdge } from './graph-model.js';
import type { SpatialWorldNode } from './graph-spatial.js';
import type { GraphBuiltin3dPaint } from './graph-builtin-3d-engine.js';

const CAMERA_LIMIT = 3.4028234663852886e38 / 8;
function own(value: unknown, key: string): unknown {
  if (!value || typeof value !== 'object') return undefined;
  const descriptor = getOwnDataDescriptor(value, key); return typeof descriptor === 'object' ? descriptor.value : undefined;
}
/** Camera distance is independent of the largest renderable world coordinate. */
export function graphWebglCamera(value: unknown, fallback: LyraGraphCamera): LyraGraphCamera {
  const number = (input: unknown, otherwise: number, min: number, max: number) => finiteRange(typeof input === 'number' ? input : NaN, otherwise, min, max);
  const target = own(value, 'target');
  return Object.freeze({ yaw: number(own(value, 'yaw'), fallback.yaw, -CAMERA_LIMIT, CAMERA_LIMIT) % (Math.PI * 2),
    pitch: number(own(value, 'pitch'), fallback.pitch, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01),
    distance: number(own(value, 'distance'), fallback.distance, 0.01, CAMERA_LIMIT),
    target: Object.freeze({ x: number(own(target, 'x'), fallback.target.x, -1e7, 1e7), y: number(own(target, 'y'), fallback.target.y, -1e7, 1e7), z: number(own(target, 'z'), fallback.target.z, -1e7, 1e7) }) });
}

/** Translate only the already-admitted spatial model. Semantic labels stay in the component. */
export function graphWebglData(world: readonly SpatialWorldNode[], edges: readonly LyraGraphEdge[], paint: GraphBuiltin3dPaint, rgba: (color: string) => readonly [number, number, number, number]) {
  const count = world.length, positions = new Float32Array(count * 3), sizes = new Float32Array(count), shapes = new Uint8Array(count), expandable = new Uint8Array(count), colors = new Float32Array(count * 4);
  const rows = new Map<string, number>();
  world.forEach((entry, row) => { rows.set(entry.node.id, row); positions.set([entry.position.x, entry.position.y, entry.position.z], row * 3); sizes[row] = entry.radius * 2;
    shapes[row] = entry.shape === 'square' ? 1 : entry.shape === 'diamond' ? 2 : 0; expandable[row] = entry.node.expandable ? 1 : 0; colors.set(rgba(paint.nodes.get(entry.node.id) ?? paint.text), row * 4); });
  const source = new Uint32Array(edges.length), target = new Uint32Array(edges.length), directed = new Uint8Array(edges.length), dangling = new Uint8Array(edges.length);
  const edgeColors = new Float32Array(edges.length * 4), widths = new Float32Array(edges.length), dashes: number[][] = [];
  edges.forEach((edge, row) => { source[row] = rows.get(edge.source)!; target[row] = rows.get(edge.target) ?? source[row]!; dangling[row] = rows.has(edge.target) ? 0 : 1; directed[row] = edge.directed ? 1 : 0;
    const id = graphLinkIdentity(edge); widths[row] = paint.visibleEdges.has(id) ? finiteRange(edge.width ?? 1.5, 1.5, 0, 1000) : 0;
    edgeColors.set(rgba(paint.edges.get(id) ?? paint.text), row * 4);
    dashes.push(Array.isArray(edge.dash) && edge.dash.length <= 32 && edge.dash.every((v) => Number.isFinite(v) && v >= 0 && v <= 1e7) ? [...edge.dash] : []); });
  return { nodeCount: count, positions, sizes, source, target, directed, nodeLabels: 'none' as const, withEdgeLabels: false,
    spatialAppearance: { sizeUnits: 'world' as const, nodeShapes: shapes, expandable, nodeColors: colors, edgeColors, edgeWidths: widths, edgeDashes: dashes, dangling, dimmedOpacity: paint.dimmedOpacity } };
}
