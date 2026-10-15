/** Perspective geometry for the graph's spatial view. Coordinates remain in three dimensions
 * until clipping and projection; no renderer or DOM state is needed by these helpers. */
import { finiteRange } from '../../../internal/numbers.js';
import { getOwnDataDescriptor } from '../../../internal/data-descriptors.js';
import { graphLinkIdentity, type LyraGraphCamera, type LyraGraphEdge, type LyraGraphNode, type LyraGraphPosition } from './graph-model.js';

const WORLD_LIMIT = 1_000_000;
const CAMERA_LIMIT = WORLD_LIMIT * 10;
const EDGE_SEGMENTS = 16;
const FIELD_OF_VIEW = Math.PI / 4;
const NO_POSITION: LyraGraphPosition = Object.freeze({ x: 0, y: 0, z: 0 });

function own(value: unknown, key: string): unknown {
  if (value === null || typeof value !== 'object') return undefined;
  const descriptor = getOwnDataDescriptor(value, key);
  return typeof descriptor === 'object' ? descriptor.value : undefined;
}

function coordinate(value: unknown, fallback: number): number {
  return finiteRange(typeof value === 'number' ? value : NaN, fallback, -WORLD_LIMIT, WORLD_LIMIT);
}

function positionValue(value: unknown): LyraGraphPosition | undefined {
  const x = own(value, 'x');
  const y = own(value, 'y');
  const z = own(value, 'z');
  if (![x, y, z].every((entry) => typeof entry === 'number' && Number.isFinite(entry))) return undefined;
  return Object.freeze({ x: coordinate(x, 0), y: coordinate(y, 0), z: coordinate(z, 0) });
}

/** Copies only own numeric data fields; accessors and inherited coordinates are never read. */
export function normalizeGraphCamera(value: unknown, fallback: LyraGraphCamera): LyraGraphCamera {
  const yaw = own(value, 'yaw');
  const pitch = own(value, 'pitch');
  const distance = own(value, 'distance');
  return Object.freeze({
    yaw: finiteRange(typeof yaw === 'number' ? yaw : NaN, fallback.yaw, -CAMERA_LIMIT, CAMERA_LIMIT) % (Math.PI * 2),
    pitch: finiteRange(typeof pitch === 'number' ? pitch : NaN, fallback.pitch, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01),
    distance: finiteRange(typeof distance === 'number' ? distance : NaN, fallback.distance, 0.01, CAMERA_LIMIT),
    target: positionValue(own(value, 'target')) ?? Object.freeze({ ...fallback.target }),
  });
}

/** Stable-id spherical placement supplies actual depth without a simulation or input mutation. */
export function spatialNodePosition(node: LyraGraphNode): LyraGraphPosition {
  const explicit = positionValue(own(node, 'position'));
  if (explicit) return explicit;
  let hash = 2166136261;
  for (const character of node.id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  const fraction = (hash >>> 0) / 4294967296;
  const latitude = fraction * 2 - 1;
  const angle = ((Math.imul(hash, 2246822519) >>> 0) / 4294967296) * Math.PI * 2;
  const radius = 120 + ((hash >>> 8) % 81);
  const ring = Math.sqrt(Math.max(0, 1 - latitude * latitude));
  return Object.freeze({ x: radius * ring * Math.cos(angle), y: radius * latitude, z: radius * ring * Math.sin(angle) });
}

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

/** Fixed subdivisions interleave edge depth with node depth instead of painting all links behind
 * all nodes. Clipping in camera space precedes division, including an edge crossing the eye. */
export function projectSpatialScene(nodes: readonly SpatialWorldNode[], edges: readonly LyraGraphEdge[], camera: LyraGraphCamera, viewport: SpatialViewport): SpatialScene {
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
    let offset = 0;
    for (let index = 0; index < EDGE_SEGMENTS; index++) {
      const at = (t: number) => self ? {
        x: source.position.x + Math.sin(t * Math.PI * 2) * source.radius * 1.6,
        y: source.position.y - (1 - Math.cos(t * Math.PI * 2)) * source.radius * 1.6,
        z: source.position.z,
      } : interpolate(source.position, end, t);
      let a = cameraPoint(at(index / EDGE_SEGMENTS), camera);
      let b = cameraPoint(at((index + 1) / EDGE_SEGMENTS), camera);
      const near = nearPlane(camera);
      if (a.z < near && b.z < near) continue;
      if (a.z < near) a = interpolate(a, b, (near - a.z) / (b.z - a.z));
      if (b.z < near) b = interpolate(b, a, (near - b.z) / (a.z - b.z));
      const entry: SpatialSegment = { edge, id: graphLinkIdentity(edge), a: perspective(a, viewport), b: perspective(b, viewport),
        depth: (a.z + b.z) / 2, last: index === EDGE_SEGMENTS - 1, middle: index === EDGE_SEGMENTS / 2, dangling: !target, offset };
      offset += Math.hypot(entry.b.x - entry.a.x, entry.b.y - entry.a.y);
      segments.push(entry);
      primitives.push({ kind: 'link', value: entry, depth: entry.depth });
    }
  }
  primitives.sort((a, b) => b.depth - a.depth || (a.kind === b.kind ? 0 : a.kind === 'link' ? -1 : 1));
  return { nodes: projected, segments, primitives };
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
