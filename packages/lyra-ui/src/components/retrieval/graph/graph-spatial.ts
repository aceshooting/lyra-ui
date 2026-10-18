/** Perspective geometry for the graph's spatial view. Coordinates remain in three dimensions
 * until clipping and projection; no renderer or DOM state is needed by these helpers. */
import { finiteRange } from '../../../internal/numbers.js';
import { normalizeGraphCamera } from './graph-spatial-model.js';
export { normalizeGraphCamera, spatialNodePosition } from './graph-spatial-model.js';
import { graphLinkIdentity, type LyraGraphCamera, type LyraGraphEdge, type LyraGraphNode, type LyraGraphPosition } from './graph-model.js';

const EDGE_SEGMENTS = 16;
const FIELD_OF_VIEW = Math.PI / 4;
const NO_POSITION: LyraGraphPosition = Object.freeze({ x: 0, y: 0, z: 0 });

export interface SpatialViewport { readonly width: number; readonly height: number }
export interface SpatialWorldNode {
  readonly node: LyraGraphNode;
  readonly position: LyraGraphPosition;
  readonly radius: number;
  readonly shape: 'circle' | 'square' | 'diamond';
}
export interface SpatialProjectedPoint { readonly x: number; readonly y: number; readonly depth: number; readonly scale: number }
export interface SpatialProjectedNode extends SpatialWorldNode, SpatialProjectedPoint { readonly screenRadius: number }
export interface SpatialSegment {
  readonly edge: LyraGraphEdge;
  readonly id: string;
  readonly a: SpatialProjectedPoint;
  readonly b: SpatialProjectedPoint;
  readonly depth: number;
  readonly last: boolean;
  readonly middle: boolean;
  readonly labelPoint?: SpatialProjectedPoint;
  readonly dangling: boolean;
  readonly offset: number;
}
type SpatialPrimitive = { readonly kind: 'node'; readonly value: SpatialProjectedNode; readonly depth: number } |
  { readonly kind: 'link'; readonly value: SpatialSegment; readonly depth: number };
export interface SpatialScene {
  readonly nodes: readonly SpatialProjectedNode[];
  readonly segments: readonly SpatialSegment[];
  readonly primitives: readonly SpatialPrimitive[];
}
export type SpatialHit = { readonly kind: 'node'; readonly id: string; readonly node: LyraGraphNode } |
  { readonly kind: 'link'; readonly id: string; readonly edge: LyraGraphEdge };

function cameraPoint(point: LyraGraphPosition, camera: LyraGraphCamera): LyraGraphPosition {
  const dx = point.x - camera.target.x;
  const dy = point.y - camera.target.y;
  const dz = point.z - camera.target.z;
  const x = Math.cos(camera.yaw) * dx - Math.sin(camera.yaw) * dz;
  const z = Math.sin(camera.yaw) * dx + Math.cos(camera.yaw) * dz;
  return { x, y: Math.cos(camera.pitch) * dy - Math.sin(camera.pitch) * z,
    z: camera.distance - (Math.sin(camera.pitch) * dy + Math.cos(camera.pitch) * z) };
}

function perspective(point: LyraGraphPosition, viewport: SpatialViewport): SpatialProjectedPoint {
  const scale = viewport.height / (2 * Math.tan(FIELD_OF_VIEW / 2) * point.z);
  return { x: viewport.width / 2 + point.x * scale, y: viewport.height / 2 + point.y * scale, depth: point.z, scale };
}

function nearPlane(camera: LyraGraphCamera): number { return Math.max(0.01, camera.distance * 0.0001); }

export function projectSpatialPoint(point: LyraGraphPosition, camera: LyraGraphCamera, viewport: SpatialViewport): SpatialProjectedPoint | undefined {
  const transformed = cameraPoint(point, camera);
  return transformed.z < nearPlane(camera) ? undefined : perspective(transformed, viewport);
}

export function fittedGraphCamera(nodes: readonly SpatialWorldNode[], viewport: SpatialViewport, padding = 24): LyraGraphCamera {
  if (!nodes.length) return normalizeGraphCamera(undefined, { yaw: 0, pitch: 0, distance: 500, target: NO_POSITION });
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const { position: p, radius } of nodes) {
    minX = Math.min(minX, p.x - radius); maxX = Math.max(maxX, p.x + radius);
    minY = Math.min(minY, p.y - radius); maxY = Math.max(maxY, p.y + radius);
    minZ = Math.min(minZ, p.z - radius); maxZ = Math.max(maxZ, p.z + radius);
  }
  const target = { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 };
  const radius = Math.max(1, Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2);
  const safePadding = finiteRange(padding, 24, 0, Math.min(viewport.width, viewport.height) * 0.45);
  const aspect = Math.min((viewport.width - 2 * safePadding) / viewport.height, (viewport.height - 2 * safePadding) / viewport.height);
  const angle = Math.atan(Math.tan(FIELD_OF_VIEW / 2) * Math.max(0.01, aspect));
  return normalizeGraphCamera({ yaw: 0, pitch: 0, distance: radius / Math.sin(angle), target }, { yaw: 0, pitch: 0, distance: 500, target: NO_POSITION });
}

function interpolate(a: LyraGraphPosition, b: LyraGraphPosition, t: number): LyraGraphPosition {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

/** Reusable numeric scratch storage; projected scene objects remain independently owned. */
export class SpatialProjectionWorkspace {
  private bytes = new Uint8Array(0);
  private source = new Uint32Array(0);
  private target = new Uint32Array(0);
  private readonly counts = new Uint32Array(256);

  order(primitives: SpatialPrimitive[]): SpatialPrimitive[] {
    const length = primitives.length;
    // Direct helper callers can bypass camera normalization. Preserve their former ordering
    // for out-of-domain depths; admitted component projections always use the linear path.
    if (primitives.some(entry => !Number.isFinite(entry.depth) || entry.depth <= 0))
      return primitives.sort((a, b) => b.depth - a.depth || (a.kind === b.kind ? 0 : a.kind === 'link' ? -1 : 1));
    if (this.source.length < length) {
      const capacity = 2 ** Math.ceil(Math.log2(Math.max(1, length)));
      this.source = new Uint32Array(capacity);
      this.target = new Uint32Array(capacity);
      this.bytes = new Uint8Array(capacity * 8);
    }
    const depths = new DataView(this.bytes.buffer);
    // Equal-depth links paint before nodes; preserve input order within either kind.
    let index = 0;
    for (let i = 0; i < length; i++) if (primitives[i]!.kind === 'link') this.source[index++] = i;
    for (let i = 0; i < length; i++) if (primitives[i]!.kind === 'node') this.source[index++] = i;
    for (let i = 0; i < length; i++) depths.setFloat64(i * 8, primitives[i]!.depth, true);
    // Camera-space clipping guarantees positive finite depths. Their IEEE encoding orders
    // exactly like their numeric value, avoiding comparison sorting and depth quantization.
    for (let byte = 0; byte < 8; byte++) {
      this.counts.fill(0);
      for (let i = 0; i < length; i++) this.counts[this.bytes[this.source[i]! * 8 + byte]!]!++;
      let offset = 0;
      for (let value = 255; value >= 0; value--) {
        const count = this.counts[value]!; this.counts[value] = offset; offset += count;
      }
      for (let i = 0; i < length; i++) {
        const entry = this.source[i]!;
        this.target[this.counts[this.bytes[entry * 8 + byte]!]!++] = entry;
      }
      [this.source, this.target] = [this.target, this.source];
    }
    return Array.from({ length }, (_, i) => primitives[this.source[i]!]!);
  }
}

/** Depth-changing links are subdivided to interleave with nodes; coplanar straight links need
 * one segment. Clipping in camera space precedes division, including an edge crossing the eye. */
export function projectSpatialScene(nodes: readonly SpatialWorldNode[], edges: readonly LyraGraphEdge[], camera: LyraGraphCamera, viewport: SpatialViewport, workspace = new SpatialProjectionWorkspace()): SpatialScene {
  const byId = new Map(nodes.map((node) => [node.node.id, node]));
  const projected: SpatialProjectedNode[] = [];
  const segments: SpatialSegment[] = [];
  const primitives: SpatialPrimitive[] = [];
  for (const node of nodes) {
    const point = projectSpatialPoint(node.position, camera, viewport);
    if (!point) continue;
    const entry = { ...node, ...point, screenRadius: Math.min(Math.max(viewport.width, viewport.height) * 2, node.radius * point.scale) };
    projected.push(entry);
    primitives.push({ kind: 'node', value: entry, depth: entry.depth });
  }
  for (const edge of edges) {
    if (finiteRange(edge.width ?? 1.5, 1.5, 0) === 0) continue;
    const source = byId.get(edge.source);
    if (!source) continue;
    const target = byId.get(edge.target);
    const self = edge.source === edge.target;
    const end = target?.position ?? { x: source.position.x + 28, y: source.position.y - 28, z: source.position.z };
    const sourceDepth = cameraPoint(source.position, camera).z;
    const targetDepth = cameraPoint(end, camera).z;
    const count = self ? EDGE_SEGMENTS : Math.max(1, Math.min(EDGE_SEGMENTS,
      Math.ceil(Math.abs(sourceDepth - targetDepth) / Math.max(1, Math.min(sourceDepth, targetDepth) / EDGE_SEGMENTS))));
    const at = (t: number) => self ? {
      x: source.position.x + Math.sin(t * Math.PI * 2) * source.radius * 1.6,
      y: source.position.y - (1 - Math.cos(t * Math.PI * 2)) * source.radius * 1.6,
      z: source.position.z,
    } : interpolate(source.position, end, t);
    const midpoint = projectSpatialPoint(at(0.5), camera, viewport);
    let offset = 0;
    for (let index = 0; index < count; index++) {
      let a = cameraPoint(at(index / count), camera);
      let b = cameraPoint(at((index + 1) / count), camera);
      const near = nearPlane(camera);
      if (a.z < near && b.z < near) continue;
      if (a.z < near) a = interpolate(a, b, (near - a.z) / (b.z - a.z));
      if (b.z < near) b = interpolate(b, a, (near - b.z) / (a.z - b.z));
      const entry: SpatialSegment = { edge, id: graphLinkIdentity(edge), a: perspective(a, viewport), b: perspective(b, viewport),
        depth: (a.z + b.z) / 2, last: index === count - 1, middle: index === Math.floor(count / 2) && midpoint !== undefined,
        labelPoint: index === Math.floor(count / 2) ? midpoint : undefined, dangling: !target, offset };
      offset += Math.hypot(entry.b.x - entry.a.x, entry.b.y - entry.a.y);
      segments.push(entry);
      primitives.push({ kind: 'link', value: entry, depth: entry.depth });
    }
  }
  return { nodes: projected, segments, primitives: workspace.order(primitives) };
}

/** Frontmost projected geometry wins. Reciprocal interpolation recovers perspective-correct
 * segment depth at the pointer, even when its endpoints are at very different distances. */
export function pickSpatialScene(scene: SpatialScene, x: number, y: number): SpatialHit | undefined {
  let result: SpatialHit | undefined;
  let nearest = Infinity;
  for (const node of scene.nodes) {
    const dx = Math.abs(x - node.x), dy = Math.abs(y - node.y);
    const r = Math.max(12, node.screenRadius);
    const inside = node.shape === 'square' ? Math.max(dx, dy) <= Math.max(12, node.screenRadius * Math.sqrt(Math.PI) / 2) :
      node.shape === 'diamond' ? dx + dy <= r * Math.sqrt(Math.PI / 2) : Math.hypot(dx, dy) <= r;
    if (inside && node.depth <= nearest) {
      nearest = node.depth;
      result = { kind: 'node', id: node.node.id, node: node.node };
    }
  }
  for (const segment of scene.segments) {
    if (segment.dangling) continue;
    const dx = segment.b.x - segment.a.x, dy = segment.b.y - segment.a.y;
    const t = Math.min(1, Math.max(0, ((x - segment.a.x) * dx + (y - segment.a.y) * dy) / (dx * dx + dy * dy || 1)));
    const depth = 1 / ((1 - t) / segment.a.depth + t / segment.b.depth);
    const width = finiteRange(segment.edge.width ?? 1.5, 1.5, 0, 1000);
    if (Math.hypot(x - segment.a.x - dx * t, y - segment.a.y - dy * t) <= Math.max(6, width / 2) && (depth < nearest - 0.001 || (result?.kind === 'link' && depth === nearest))) {
      nearest = depth;
      result = { kind: 'link', id: segment.id, edge: segment.edge };
    }
  }
  return result;
}

/** Screen-space broad phase owned by one controller projection. Rebuild after geometry changes. */
export class SpatialHitIndex {
  private readonly cells = new Map<string, { nodes: number[]; segments: number[] }>();
  private readonly wide = { nodes: [] as number[], segments: [] as number[] };

  constructor(private readonly scene: SpatialScene) {
    scene.nodes.forEach((node, index) => {
      const radius = Math.max(16, node.screenRadius * Math.SQRT2);
      this.insert('nodes', index, node.x - radius, node.y - radius, node.x + radius, node.y + radius);
    });
    scene.segments.forEach((segment, index) => {
      if (segment.dangling) return;
      const radius = Math.max(6, finiteRange(segment.edge.width ?? 1.5, 1.5, 0, 1000) / 2);
      this.insert('segments', index, Math.min(segment.a.x, segment.b.x) - radius,
        Math.min(segment.a.y, segment.b.y) - radius, Math.max(segment.a.x, segment.b.x) + radius,
        Math.max(segment.a.y, segment.b.y) + radius);
    });
  }

  private insert(kind: 'nodes' | 'segments', index: number, left: number, top: number, right: number, bottom: number): void {
    const x1 = Math.floor(left / 64), y1 = Math.floor(top / 64);
    const x2 = Math.floor(right / 64), y2 = Math.floor(bottom / 64);
    // Near-plane geometry can cover an enormous rectangle; never expand it into an unbounded grid.
    if (![x1, y1, x2, y2].every(Number.isFinite) || (x2 - x1 + 1) * (y2 - y1 + 1) > 64) {
      this.wide[kind].push(index); return;
    }
    for (let x = x1; x <= x2; x++) for (let y = y1; y <= y2; y++) {
      const key = `${x},${y}`;
      let cell = this.cells.get(key);
      if (!cell) { cell = { nodes: [], segments: [] }; this.cells.set(key, cell); }
      cell[kind].push(index);
    }
  }

  hit(x: number, y: number): SpatialHit | undefined {
    const cell = this.cells.get(`${Math.floor(x / 64)},${Math.floor(y / 64)}`);
    const merge = (a: readonly number[], b: readonly number[]): number[] => {
      const indexes: number[] = [];
      let i = 0, j = 0;
      while (i < a.length || j < b.length)
        indexes.push(j >= b.length || (i < a.length && a[i]! < b[j]!) ? a[i++]! : b[j++]!);
      return indexes;
    };
    return pickSpatialScene({
      nodes: merge(cell?.nodes ?? [], this.wide.nodes).map(index => this.scene.nodes[index]!),
      segments: merge(cell?.segments ?? [], this.wide.segments).map(index => this.scene.segments[index]!),
      primitives: [],
    }, x, y);
  }
}

/** Move the orbit target along the camera's right/down basis, leaving its facing unchanged. */
export function panGraphCamera(camera: LyraGraphCamera, dx: number, dy: number, viewport: SpatialViewport): LyraGraphCamera {
  const units = 2 * camera.distance * Math.tan(FIELD_OF_VIEW / 2) / viewport.height;
  const sy = Math.sin(camera.yaw), cy = Math.cos(camera.yaw), sp = Math.sin(camera.pitch), cp = Math.cos(camera.pitch);
  return normalizeGraphCamera({ ...camera, target: {
    x: camera.target.x - units * (cy * dx + sy * sp * dy),
    y: camera.target.y - units * cp * dy,
    z: camera.target.z - units * (-sy * dx + cy * sp * dy),
  } }, camera);
}
