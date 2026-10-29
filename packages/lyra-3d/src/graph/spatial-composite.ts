import { disposeAll } from '../core/dispose.js';
import type { GraphNodeMeshData } from './node-mesh.js';
import { graphNodeMeshStorage } from './node-mesh-storage.js';
import { createGraphSpatialMeshPick, graphSpatialMeshVertexChunk, graphSpatialMeshFragment, packGraphMeshFace } from './spatial-node-meshes.js';
import { DoubleSide, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, PlaneGeometry, ShaderMaterial, Vector2, Vector4 } from 'three';
import { markAttributeFull, markAttributeRanges, markAttributeRows } from '../core/attribute-updates.js';
import type { VisualStateRows } from '../core/visual-state.js';
import type { Lyra3dViewport } from '../core/viewport.js';
import { graphSpatialNodeFragment, type createGraphSpatialNodes, type GraphPreparedSpatialNodes } from './spatial-nodes.js';
import { graphSpatialEdgeFragment, type createGraphSpatialEdges, type GraphPreparedSpatialEdges } from './spatial-edges.js';
import { graphSpatialEdgeVertexChunk, graphSpatialNodeVertexChunk, graphSpatialProjectionChunk, graphSpatialView, graphViewForward, graphScale, type GraphSpatialView } from './spatial-paths.js';

/**
 * Translucent painter order is re-sorted only once the view direction has turned this far (radians)
 * since the last sort. Orbit eye depth is `distance - dot(point - target, forward)`, so the order of
 * fixed world anchors depends on the view direction alone. CSS-sized loop segments are the exception:
 * their world radii depend on centre eye depth and viewport scale, so those changes re-sort. A
 * small turn can swap nearby depths before the next sort. This bounds sorting work but can retain
 * approximate blend order during motion; a final exact sort follows when rotation settles.
 * Opaque scenes never sort: they draw in a fixed order with depth writes, and depth testing
 * resolves occlusion per pixel.
 */
const GRAPH_RESORT_ANGLE = 0.02;
const SETTLE_MS = 100;
const RESORT_COSINE = Math.cos(GRAPH_RESORT_ANGLE);
const INDEX_BITS = 2 ** 22;
const KEY_STEPS = 2 ** 31 - 1;

const vertex = graphSpatialProjectionChunk + graphSpatialNodeVertexChunk + graphSpatialEdgeVertexChunk + graphSpatialMeshVertexChunk + `
attribute vec4 payload0; attribute vec4 payload1; attribute vec4 payload2; attribute vec4 payload3; attribute vec4 payload4;
flat varying float primitiveKind;
void main() {
  primitiveKind = payload4.a <= -2.0 ? 2.0 : payload4.a < 0.0 ? 0.0 : 1.0;
  meshNormal=vec3(0.0,0.0,1.0); meshPaint=vec4(0.0);
  offset=vec2(0.0); radius=0.0; shape=0.0; flags=vec2(0.0); pickDepth=0.0;
  fill=vec4(0.0); ring=vec4(0.0); marker=vec4(0.0);
  tint=vec4(0.0); pattern=vec2(0.0); arrowUv=vec3(0.0); cap=vec3(0.0); strokeRadius=0.0; depthEnds=vec2(0.0);
  if (primitiveKind > 1.5) graphSpatialMeshVertex(payload0,payload1,payload2,payload3,payload4);
  else if (primitiveKind > 0.5) graphSpatialNodeVertex(payload0.xyz, payload0.w, payload1.x, payload1.yz, payload2, payload3, payload4, vec3(0.0));
  else graphSpatialEdgeVertex(payload0.xyz, payload1.xyz, vec4(payload0.w, payload1.w, payload3.xy), vec3(payload3.z, 0.0, payload3.w), payload2, vec3(0.0), payload4.x, payload4.y);
}`;
const fragment = graphSpatialNodeFragment + graphSpatialEdgeFragment + graphSpatialMeshFragment + `
flat varying float primitiveKind;
void main(){ if(primitiveKind>1.5) paintGraphSpatialMesh(); else if(primitiveKind>0.5) paintGraphSpatialNode(); else paintGraphSpatialEdge(); }
`;

/** Conservative preflight before any custom composite backing or GPU objects exist. */
export function preflightGraphSpatialMeshes(nodeCount: number, edgePrimitiveCount: number, custom: GraphNodeMeshData) {
  const ordinaryPrimitiveCount = nodeCount + edgePrimitiveCount;
  return graphNodeMeshStorage({ nodeCount, customNodeCount: custom.customNodeCount, triangleCount: custom.triangleCount,
    ordinaryPrimitiveCount, sortKeyBytesBefore: 0, sortKeyBytesAfter: (ordinaryPrimitiveCount + custom.triangleCount) * 8,
    scratchBytes: custom.triangleCount * 12 });
}

type CompositePresentation = Pick<Lyra3dViewport, 'width' | 'height' | 'orbit'>;
export type GraphSpatialCompositePresentation = CompositePresentation;
/** Native draw objects only. Child batches and the shared dash texture remain separately owned. */
export interface GraphSpatialCompositeResources {
  readonly geometry: InstancedBufferGeometry;
  readonly material: ShaderMaterial;
  readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>;
  readonly customPick?: ReturnType<typeof createGraphSpatialMeshPick>;
  disposed: boolean;
}
export interface GraphPreparedSpatialComposite {
  readonly batch: ReturnType<typeof createGraphSpatialComposite>;
  readonly resources: GraphSpatialCompositeResources;
  readonly ownedBuffers: readonly ArrayBufferLike[];
  readonly borrowedBuffers: readonly ArrayBufferLike[];
}
export interface GraphSpatialCompositeWorkStep {
  readonly done: boolean;
  readonly operations: number;
  readonly allocatedBytes: number;
  readonly visitedNodes: number;
  readonly visitedEdgePrimitives: number;
  readonly packedFaces: number;
  readonly paintedFaces: number;
  readonly initializedSlots: number;
  readonly orderedRows: number;
  readonly sortOperations: number;
  readonly publishedRanges: number;
  readonly value?: GraphPreparedSpatialComposite;
}
export interface GraphSpatialCompositeWork { step(maxOperations: number): GraphSpatialCompositeWorkStep; dispose(): void; }
export function disposeGraphSpatialCompositeResources(resources: GraphSpatialCompositeResources): void {
  if (resources.disposed) return;
  resources.disposed = true;
  disposeAll([
    () => resources.mesh.removeFromParent(), () => resources.geometry.dispose(), () => resources.material.dispose(),
    () => resources.customPick?.removeFromParent(), () => resources.customPick?.geometry.dispose(), () => resources.customPick?.material.dispose(),
  ]);
}
interface CompositeStorage {
  output: Float32Array[];
  staged: Float32Array[];
  anchors: Float32Array;
  primitiveSlot: Int32Array;
  outputRow: Int32Array;
  keys: Float64Array;
  ranges?: Uint32Array;
  loopOffsets?: Float32Array;
}
interface CompositeUniforms { viewportSize: Vector2; viewWindow: Vector4; lyraView: Vector4; }

function createCompositeController(nodes: ReturnType<typeof createGraphSpatialNodes>, edges: ReturnType<typeof createGraphSpatialEdges>, custom: GraphNodeMeshData | undefined,
  resources: GraphSpatialCompositeResources, storage: CompositeStorage, payloads: InstancedBufferAttribute[], uniforms: CompositeUniforms) {
  const nodeCount = nodes.mesh.geometry.instanceCount, edgeCount = edges.mesh.geometry.instanceCount;
  const ordinaryCount = nodeCount + edgeCount, customCount = custom?.triangleCount ?? 0, count = ordinaryCount + customCount;
  const { geometry, material, mesh, customPick } = resources;
  const { ranges, staged, anchors, primitiveSlot, outputRow } = storage;
  const { viewportSize, viewWindow, lyraView } = uniforms;
  const nodeUniforms = nodes.mesh.material.uniforms;
  let quiesced = false;
  let seenNodes = -1, seenEdges = -1, active = 0, translucent = false, sorted: [number, number, number] | undefined;
  let activeEdges = 0, activeOrdinary = 0, transientCustomScratchBytes = 0;
  const physicalSlot = (logical: number) => logical < activeOrdinary ? logical : ordinaryCount + logical - activeOrdinary;
  const writeCustom = (face: number, payload: number, channel: number, value: number): boolean => {
    const slot = ordinaryCount + face, offset = slot * 4 + channel;
    if (staged[payload]![offset] === value) return false;
    staged[payload]![offset] = value;
    const output = outputRow[slot]!;
    if (output >= 0) (payloads[payload]!.array as Float32Array)[output * 4 + channel] = value;
    return true;
  };
  const paintCustomFace = (row: number, face: number, write: (face: number, payload: number, channel: number, value: number) => void) => {
    const position = nodes.mesh.geometry.getAttribute('nodePosition').array;
    const sizes = nodes.mesh.geometry.getAttribute('nodeSize').array;
    const fill = nodes.mesh.geometry.getAttribute('nodeFill').array;
    for (let axis = 0; axis < 3; axis++) { write(face, 0, axis, position[row * 3 + axis]!); write(face, 4, axis, fill[row * 4 + axis]!); }
    write(face, 0, 3, sizes[row]!); write(face, 3, 3, fill[row * 4 + 3]!);
    write(face, 4, 3, -2 - row - (nodes.bodyPickable(row) ? 0 : 0.25));
    const slot = ordinaryCount + face;
    for (let axis = 0; axis < 3; axis++) anchors[slot * 3 + axis] = position[row * 3 + axis]!;
  };
  const customPaint = (rows: VisualStateRows) => {
    if (!customPick || !ranges) return;
    const changed = new Map<number, number[]>();
    const write = (face: number, payload: number, channel: number, value: number) => {
      if (!writeCustom(face, payload, channel, value)) return;
      const list = changed.get(payload) ?? []; list.push(face); changed.set(payload, list);
    };
    for (let index = 0, length = rows?.length ?? nodeCount; index < length; index++) {
      const row = rows === null ? index : rows[index]!;
      for (let face = ranges[row]!; face < ranges[row + 1]!; face++) paintCustomFace(row, face, write);
    }
    for (const [payload, faces] of changed) {
      markAttributeRows(customPick.geometry.getAttribute(`payload${payload}`) as InstancedBufferAttribute, faces);
      const outputs = faces.map(face => outputRow[ordinaryCount + face]!).filter(row => row >= 0);
      if (outputs.length) markAttributeRows(payloads[payload]!, outputs);
    }
  };
  const sourcePaint = [
    ...['nodeFlags', 'nodeFill', 'nodeRing', 'nodeMarker'].map(name => nodes.mesh.geometry.getAttribute(name) as InstancedBufferAttribute),
    ...['edgeColor', 'stroke'].map(name => edges.mesh.geometry.getAttribute(name) as InstancedBufferAttribute),
  ];
  let seenPaintVersions: number[] = [];
  const rememberPaint = () => { seenPaintVersions = sourcePaint.map(attribute => attribute.version); };
  // Stable geometric coverage for a paint visiting both batches in full. A rebuild or sort
  // replaces these ranges; paint-only updates reuse them without per-primitive dirty masks.
  let denseNodeRanges: { start: number; count: number }[] = [];
  let denseAllRanges: { start: number; count: number }[] = [];
  let settling: ReturnType<typeof setTimeout> | undefined;
  let lastForward: [number, number, number] | undefined;
  let hasCssLoops = false;
  let lastLoopView: number[] | undefined;
  const cancelSettling = () => { const timer = settling; settling = undefined; if (timer !== undefined) clearTimeout(timer); };
  const [p0, p1, p2, p3, p4] = staged as [Float32Array, Float32Array, Float32Array, Float32Array, Float32Array];
  const edgeArray = (name: string) => edges.mesh.geometry.getAttribute(name).array as Float32Array;
  const nodeArray = (name: string) => nodes.mesh.geometry.getAttribute(name).array as Float32Array;
  const needsLoopOffsets = (i: number) => {
    const stroke = edgeArray('stroke'), color = edgeArray('edgeColor'), path = edgeArray('edgePath');
    return stroke[i * 3]! > 0 && color[i * 4 + 3]! > 0 && nodeUniforms['worldSizes']!.value < 0.5 && path[i * 4 + 2]! > 0 && stroke[i * 3 + 2]! < 0.5;
  };
  const packEdge = (i: number) => {
    const start = edgeArray('edgeStart'), end = edgeArray('edgeEnd'), path = edgeArray('edgePath'), stroke = edgeArray('stroke'), color = edgeArray('edgeColor'), dash = edgeArray('dash'), curvature = edgeArray('edgeCurvature');
    if (!(stroke[i * 3]! > 0 && color[i * 4 + 3]! > 0)) return;
    primitiveSlot[i] = active;
    const o = active * 4;
    p0[o] = start[i * 3]!; p0[o + 1] = start[i * 3 + 1]!; p0[o + 2] = start[i * 3 + 2]!; p0[o + 3] = path[i * 4]!;
    p1[o] = end[i * 3]!; p1[o + 1] = end[i * 3 + 1]!; p1[o + 2] = end[i * 3 + 2]!; p1[o + 3] = path[i * 4 + 1]!;
    p2.set(color.subarray(i * 4, i * 4 + 4), o);
    p3[o] = path[i * 4 + 2]!; p3[o + 1] = path[i * 4 + 3]!; p3[o + 2] = stroke[i * 3]!; p3[o + 3] = stroke[i * 3 + 2]!;
    p4[o] = dash[i]!; p4[o + 1] = curvature[i]!; p4[o + 2] = 0; p4[o + 3] = -1;
    anchors.set(edges.anchors.subarray(i * 3, i * 3 + 3), active * 3);
    if (nodeUniforms['worldSizes']!.value < 0.5 && path[i * 4 + 2]! > 0 && stroke[i * 3 + 2]! < 0.5) {
      // CSS loop endpoints are expanded in world XY by the shader. Store their midpoint in
      // CSS units; only its sort key needs the camera-dependent conversion to world units.
      storage.loopOffsets ??= new Float32Array(count * 2);
      const a = path[i * 4]! * Math.PI * 2, b = path[i * 4 + 1]! * Math.PI * 2, radius = path[i * 4 + 2]!;
      storage.loopOffsets[active * 2] = (Math.sin(a) + Math.sin(b)) * radius / 2;
      storage.loopOffsets[active * 2 + 1] = -(2 - Math.cos(a) - Math.cos(b)) * radius / 2;
      hasCssLoops = true;
    }
    active++;
  };
  const packNode = (i: number) => {
    const position = nodeArray('nodePosition'), size = nodeArray('nodeSize'), shape = nodeArray('nodeShape'), flags = nodeArray('nodeFlags');
    const fill = nodeArray('nodeFill'), ring = nodeArray('nodeRing'), marker = nodeArray('nodeMarker');
    if (!(size[i]! > 0 || flags[i * 2]! > 0 || flags[i * 2 + 1]! > 0)) return;
    primitiveSlot[edgeCount + i] = active;
    const o = active * 4;
    p0[o] = position[i * 3]!; p0[o + 1] = position[i * 3 + 1]!; p0[o + 2] = position[i * 3 + 2]!; p0[o + 3] = size[i]!;
    p1[o] = shape[i]!; p1[o + 1] = flags[i * 2]!; p1[o + 2] = flags[i * 2 + 1]!; p1[o + 3] = 0;
    p2.set(fill.subarray(i * 4, i * 4 + 4), o); p3.set(ring.subarray(i * 4, i * 4 + 4), o); p4.set(marker.subarray(i * 4, i * 4 + 4), o);
    anchors.set(position.subarray(i * 3, i * 3 + 3), active * 3); active++;
  };
  const rebuild = () => {
    cancelSettling(); lastForward = undefined; lastLoopView = undefined; hasCssLoops = false;
    storage.loopOffsets?.fill(0);
    seenNodes = nodes.revision; seenEdges = edges.revision; active = 0;
    primitiveSlot.fill(-1); outputRow.fill(-1);
    for (let i = 0; i < edgeCount; i++) packEdge(i);
    activeEdges = active;
    for (let i = 0; i < nodeCount; i++) packNode(i);
    activeOrdinary = active;
    customPaint(null);
    active += customCount;
    translucent = nodes.translucent || edges.translucent;
    if (material.transparent !== translucent) { material.transparent = translucent; material.needsUpdate = true; }
    material.depthWrite = !translucent;
    geometry.instanceCount = active; sorted = undefined;
    denseAllRanges = active ? [{ start: 0, count: active * 4 }] : [];
    denseNodeRanges = [];
    rememberPaint();
    if (!translucent) {
      if (active > activeEdges) denseNodeRanges.push({ start: activeEdges * 4, count: (active - activeEdges) * 4 });
      for (let row = 0; row < active; row++) outputRow[physicalSlot(row)] = row;
      payloads.forEach((payload, slot) => { const target = payload.array as Float32Array;
        target.set(staged[slot]!.subarray(0, activeOrdinary * 4));
        if (customCount) target.set(staged[slot]!.subarray(ordinaryCount * 4), activeOrdinary * 4); markAttributeFull(payload); });
    }
  };
  const patch = (nodeRows: VisualStateRows, edgeRows: VisualStateRows) => {
    const node = (name: string) => nodes.mesh.geometry.getAttribute(name).array as Float32Array;
    const edge = (name: string) => edges.mesh.geometry.getAttribute(name).array as Float32Array;
    const flags = node('nodeFlags'), size = node('nodeSize'), stroke = edge('stroke'), colors = edge('edgeColor');
    // Compaction and material transitions deliberately retain the full repack path.
    if (translucent !== (nodes.translucent || edges.translucent)) return false;
    for (let index = 0, length = nodeRows?.length ?? nodeCount; index < length; index++) {
      const row = nodeRows === null ? index : nodeRows[index]!;
      if ((primitiveSlot[edgeCount + row]! >= 0) !== (size[row]! > 0 || flags[row * 2]! > 0 || flags[row * 2 + 1]! > 0)) return false;
    }
    for (let index = 0, length = edgeRows?.length ?? edgeCount; index < length; index++) {
      const row = edgeRows === null ? index : edgeRows[index]!;
      if ((primitiveSlot[row]! >= 0) !== (stroke[row * 3]! > 0 && colors[row * 4 + 3]! > 0)) return false;
    }
    if (nodeRows === null && edgeRows === null) {
      let changedPayloads = 0;
      // Versions only skip untouched sources. A changed source may have reverted before
      // composition, so compare until its first real difference before copying the rest.
      for (const paint of [0, 5]) {
        const attribute = sourcePaint[paint]!;
        if (attribute.version === seenPaintVersions[paint]) continue;
        const isNode = paint === 0, payload = isNode ? 1 : 3;
        const source = attribute.array, stagedPaint = staged[payload]!, target = payloads[payload]!.array;
        const length = isNode ? nodeCount : edgeCount, firstPrimitive = isNode ? edgeCount : 0;
        const stride = isNode ? 2 : 3, second = isNode ? 1 : 2;
        const firstChannel = isNode ? 1 : 2, secondChannel = isNode ? 2 : 3;
        let changed = false;
        for (let row = 0; row < length; row++) {
          const slot = primitiveSlot[firstPrimitive + row]!; if (slot < 0) continue;
          const from = row * stride, offset = slot * 4, a = source[from]!, b = source[from + second]!;
          if (!changed && stagedPaint[offset + firstChannel] === a && stagedPaint[offset + secondChannel] === b) continue;
          changed = true;
          stagedPaint[offset + firstChannel] = a; stagedPaint[offset + secondChannel] = b;
          const to = outputRow[slot]! * 4;
          target[to + firstChannel] = a; target[to + secondChannel] = b;
        }
        if (changed) changedPayloads |= 1 << payload;
      }
      for (let paint = 1; paint <= 4; paint++) {
        const attribute = sourcePaint[paint]!;
        if (attribute.version === seenPaintVersions[paint]) continue;
        const isNode = paint < 4, payload = isNode ? paint + 1 : 2;
        const source = attribute.array, stagedPaint = staged[payload]!, target = payloads[payload]!.array;
        const length = isNode ? nodeCount : edgeCount, firstPrimitive = isNode ? edgeCount : 0;
        let changed = false;
        for (let row = 0; row < length; row++) {
          const slot = primitiveSlot[firstPrimitive + row]!; if (slot < 0) continue;
          const from = row * 4, offset = slot * 4;
          const a = source[from]!, b = source[from + 1]!, c = source[from + 2]!, d = source[from + 3]!;
          if (!changed && stagedPaint[offset] === a && stagedPaint[offset + 1] === b && stagedPaint[offset + 2] === c && stagedPaint[offset + 3] === d) continue;
          changed = true;
          stagedPaint[offset] = a; stagedPaint[offset + 1] = b; stagedPaint[offset + 2] = c; stagedPaint[offset + 3] = d;
          const to = outputRow[slot]! * 4;
          target[to] = a; target[to + 1] = b; target[to + 2] = c; target[to + 3] = d;
        }
        if (changed) changedPayloads |= 1 << payload;
      }
      for (let payload = 1; payload < payloads.length; payload++) {
        if (changedPayloads & (1 << payload)) markAttributeRanges(payloads[payload]!, payload === 1 || payload === 4 ? denseNodeRanges : denseAllRanges);
      }
      customPaint(nodeRows);
      rememberPaint(); seenNodes = nodes.revision; seenEdges = edges.revision;
      return true;
    }
    const dense = nodeRows === null || edgeRows === null;
    const dirty = new Map<number, number[]>(), masks = new Map<number, Uint8Array>();
    let changedPayloads = 0;
    const write = (slot: number, payload: number, a: number, b: number, c: number, d: number) => {
      const source = staged[payload]!, offset = slot * 4;
      const row = outputRow[slot]!;
      if (dense) {
        // Dense masks describe logically affected paint rows, including equal values. Only
        // payloads with a real change publish them, so an unchanged repaint stays a no-op.
        let mask = masks.get(payload);
        if (!mask) { mask = new Uint8Array(active); masks.set(payload, mask); }
        mask[row] = 1;
      }
      if (source[offset] === a && source[offset + 1] === b && source[offset + 2] === c && source[offset + 3] === d) return;
      changedPayloads |= 1 << payload;
      source[offset] = a; source[offset + 1] = b; source[offset + 2] = c; source[offset + 3] = d;
      const target = payloads[payload]!.array, to = row * 4;
      target[to] = a; target[to + 1] = b; target[to + 2] = c; target[to + 3] = d;
      if (!dense) {
        const rows = dirty.get(payload) ?? []; rows.push(row); dirty.set(payload, rows);
      }
    };
    const fill = node('nodeFill'), ring = node('nodeRing'), marker = node('nodeMarker');
    for (let index = 0, length = nodeRows?.length ?? nodeCount; index < length; index++) {
      const row = nodeRows === null ? index : nodeRows[index]!;
      const slot = primitiveSlot[edgeCount + row]!; if (slot < 0) continue;
      const offset = row * 4;
      write(slot, 1, staged[1]![slot * 4]!, flags[row * 2]!, flags[row * 2 + 1]!, 0);
      write(slot, 2, fill[offset]!, fill[offset + 1]!, fill[offset + 2]!, fill[offset + 3]!);
      write(slot, 3, ring[offset]!, ring[offset + 1]!, ring[offset + 2]!, ring[offset + 3]!);
      write(slot, 4, marker[offset]!, marker[offset + 1]!, marker[offset + 2]!, marker[offset + 3]!);
    }
    for (let index = 0, length = edgeRows?.length ?? edgeCount; index < length; index++) {
      const row = edgeRows === null ? index : edgeRows[index]!;
      const slot = primitiveSlot[row]!; if (slot < 0) continue;
      const offset = row * 4;
      write(slot, 2, colors[offset]!, colors[offset + 1]!, colors[offset + 2]!, colors[offset + 3]!);
      write(slot, 3, staged[3]![slot * 4]!, staged[3]![slot * 4 + 1]!, stroke[row * 3]!, stroke[row * 3 + 2]!);
    }
    transientCustomScratchBytes = Math.max(transientCustomScratchBytes, masks.size * customCount);
    for (const [payload, rows] of dirty) markAttributeRows(payloads[payload]!, rows);
    for (const [payload, mask] of masks) {
      if ((changedPayloads & (1 << payload)) === 0) continue;
      const ranges: { start: number; count: number }[] = [];
      let start = -1;
      for (let row = 0; row <= active; row++) {
        if (row < active && mask[row]) { if (start < 0) start = row; }
        else if (start >= 0) { ranges.push({ start: start * 4, count: (row - start) * 4 }); start = -1; }
      }
      markAttributeRanges(payloads[payload]!, ranges);
    }
    customPaint(nodeRows);
    rememberPaint(); seenNodes = nodes.revision; seenEdges = edges.revision;
    return true;
  };
  const depthKey = (slot: number, forward: [number, number, number], depthOrigin: number, view: GraphSpatialView): number => {
    let key = anchors[slot * 3]! * forward[0] + anchors[slot * 3 + 1]! * forward[1] + anchors[slot * 3 + 2]! * forward[2];
    if (hasCssLoops) {
      const depth = depthOrigin - key;
      // Match lyraGraphPathPoint: CSS loops collapse while their centre is behind near.
      if (depth >= view.near) key += (storage.loopOffsets![slot * 2]! * forward[0] + storage.loopOffsets![slot * 2 + 1]! * forward[1]) / graphScale(depth, view);
    }
    if (customCount && slot >= ordinaryCount) {
      const o = slot * 4, depth = depthOrigin - key;
      const radius = staged[0]![o + 3]! * (nodeUniforms['worldSizes']!.value > 0.5 ? 1 : depth > view.near ? 1 / graphScale(depth, view) : 0);
      for (let axis = 0; axis < 3; axis++) key += (staged[1]![o + axis]! + staged[2]![o + axis]! + staged[3]![o + axis]!) / 3 * radius * forward[axis]!;
    }
    return key;
  };
  const copyPayloadRow = (row: number, slot: number) => {
    const from = slot * 4, to = row * 4;
    for (let payload = 0; payload < 5; payload++) {
      const target = payloads[payload]!.array, source = staged[payload]!;
      target[to] = source[from]!; target[to + 1] = source[from + 1]!; target[to + 2] = source[from + 2]!; target[to + 3] = source[from + 3]!;
    }
  };
  // Back-to-front is ascending `dot(anchor, forward)`; equal depths keep edges before nodes.
  const sort = (forward: [number, number, number], depthOrigin: number, view: GraphSpatialView) => {
    sorted = forward;
    if (storage.keys.length < active) storage.keys = new Float64Array(count);
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < active; i++) {
      const key = depthKey(physicalSlot(i), forward, depthOrigin, view);
      storage.keys[i] = key; if (key < min) min = key; if (key > max) max = key;
    }
    // Quantized key and original index share one exactly representable double, so the native
    // numeric sort orders by depth and breaks ties by index without a comparator.
    const scale = max > min ? KEY_STEPS / (max - min) : 0;
    for (let i = 0; i < active; i++) storage.keys[i] = Math.min(KEY_STEPS, Math.floor((storage.keys[i]! - min) * scale)) * INDEX_BITS + physicalSlot(i);
    const order = storage.keys.subarray(0, active).sort();
    denseNodeRanges = [];
    let nodeStart = -1;
    for (let row = 0; row <= active; row++) {
      const slot = row < active ? order[row]! % INDEX_BITS : -1;
      if (slot >= 0) outputRow[slot] = row;
      if (slot >= activeEdges) { if (nodeStart < 0) nodeStart = row; }
      else if (nodeStart >= 0) { denseNodeRanges.push({ start: nodeStart * 4, count: (row - nodeStart) * 4 }); nodeStart = -1; }
    }
    for (let row = 0; row < active; row++) copyPayloadRow(row, order[row]! % INDEX_BITS);
    for (const payload of payloads) markAttributeFull(payload);
  };
  const setView = (viewport: CompositePresentation): GraphSpatialView => {
    const view = graphSpatialView(viewport.width, viewport.height, viewport.orbit);
    material.uniforms['meshForcedColors']!.value = nodes.forcedColors ? 1 : 0;
    viewportSize.set(view.width, view.height); viewWindow.set(0, 0, viewport.width, viewport.height); lyraView.set(view.width, view.height, view.near, view.far);
    return view;
  };
  const batch = { mesh, customPick,
    /** Unique backing stores, including staging shared with the independent pick upload. */
    allocations() {
      const baseArrays = ['position', 'normal', 'uv'].map(name => geometry.getAttribute(name).array);
      if (geometry.index) baseArrays.push(geometry.index.array);
      const arrays: ArrayBufferView[] = [...staged, ...payloads.map(payload => payload.array), anchors, primitiveSlot, outputRow, storage.keys, ...baseArrays];
      if (ranges) arrays.push(ranges); if (storage.loopOffsets) arrays.push(storage.loopOffsets);
      const buffers = [...new Set(arrays.map(array => array.buffer))];
      const cpuBytes = buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);
      const baseGeometryBytes = baseArrays.reduce((sum, array) => sum + array.byteLength, 0);
      let customStorage;
      if (custom) {
        customStorage = graphNodeMeshStorage({ nodeCount, customNodeCount: custom.customNodeCount, triangleCount: customCount,
          ordinaryPrimitiveCount: ordinaryCount, sortKeyBytesBefore: 0, sortKeyBytesAfter: storage.keys.byteLength,
          scratchBytes: (storage.loopOffsets ? customCount * 8 : 0) + transientCustomScratchBytes });
        const ordinaryCpu = ordinaryCount * 180 + (storage.loopOffsets ? ordinaryCount * 8 : 0) + baseGeometryBytes;
        const addedCpu = cpuBytes - ordinaryCpu + custom.payloadBytes * 2 + nodeCount * 16 + transientCustomScratchBytes;
        if (addedCpu > customStorage.cpuBytes || customCount * 160 > customStorage.gpuBytes) throw new RangeError('Graph custom allocations exceed planned storage');
      }
      return { buffers, cpuBytes, baseGeometryBytes, customStorage, transientCustomScratchBytes,
        gpuAttributeBytes: count * 80 + customCount * 80, sortKeyBytes: storage.keys.byteLength };
    },
    /** Per frame: uniforms always; payload rewrites only after a batch update or, for translucent
     * paint, a material change of view direction. */
    update(viewport: Pick<Lyra3dViewport, 'width' | 'height' | 'orbit' | 'invalidate'>) {
      if (resources.disposed || quiesced) return;
      const view = setView(viewport);
      if (nodes.revision !== seenNodes || edges.revision !== seenEdges) {
        const nodeChanges = nodes.takeChanges(), edgeChanges = edges.takeChanges();
        if (seenNodes < 0 || seenEdges < 0 || nodeChanges.full || edgeChanges.full || !patch(nodeChanges.rows, edgeChanges.rows)) rebuild();
      }
      if (!translucent) return;
      const forward = graphViewForward(viewport.orbit);
      const camera = viewport.orbit;
      const loopView = hasCssLoops || (customCount > 0 && nodeUniforms['worldSizes']!.value < 0.5) ? [camera.distance, camera.target.x, camera.target.y, camera.target.z, view.height, view.width, view.near] : undefined;
      const loopChanged = loopView !== undefined && (!lastLoopView || loopView.some((value, index) => value !== lastLoopView![index]));
      lastLoopView = loopView;
      const depthOrigin = camera.distance + camera.target.x * forward[0] + camera.target.y * forward[1] + camera.target.z * forward[2];
      if (!loopChanged && lastForward && forward.every((value, index) => value === lastForward![index])) return;
      lastForward = forward; cancelSettling();
      if (loopChanged || !sorted || forward[0] * sorted[0] + forward[1] * sorted[1] + forward[2] * sorted[2] < RESORT_COSINE) sort(forward, depthOrigin, view);
      else if (forward.some((value, index) => value !== sorted![index])) {
        // Camera updates may stop without another render. Finish the exact painter order once
        // rotation settles, and explicitly request the frame that displays the corrected buffers.
        settling = setTimeout(() => {
          settling = undefined;
          if (resources.disposed || quiesced) return;
          sort(forward, depthOrigin, view); viewport.invalidate();
        }, SETTLE_MS);
      }
    },
    quiesce() { quiesced = true; cancelSettling(); },
    dispose() { disposeAll([() => batch.quiesce(), () => disposeGraphSpatialCompositeResources(resources)]); },
  };
  let initialNodeStart = -1;
  return { batch, needsLoopOffsets, packEdge, packNode,
    get active() { return active; }, get translucent() { return translucent; },
    finishEdges() { activeEdges = active; },
    finishNodes() { activeOrdinary = active; },
    initializeLocalFace(row: number, face: number) {
      const body = custom!.nodeMeshes[row]!, localFace = face - ranges![row]!;
      packGraphMeshFace(staged, ordinaryCount + face, row, [0, 0, 0], 0, body.positions, localFace * 9,
        body.normals.subarray(localFace * 3, localFace * 3 + 3), [0, 0, 0, 0]);
    },
    initializeFacePaint(row: number, face: number): number {
      let changed = 0;
      paintCustomFace(row, face, (index, payload, channel, value) => { if (writeCustom(index, payload, channel, value)) changed |= 1 << payload; });
      return changed;
    },
    finishCompaction() {
      active += customCount; translucent = nodes.translucent || edges.translucent;
      if (material.transparent !== translucent) { material.transparent = translucent; material.needsUpdate = true; }
      material.depthWrite = !translucent; geometry.instanceCount = active;
      denseAllRanges = active ? [{ start: 0, count: active * 4 }] : []; denseNodeRanges = [];
    },
    initializeOrder(viewport: CompositePresentation) {
      const view = graphSpatialView(viewport.width, viewport.height, viewport.orbit), forward = graphViewForward(viewport.orbit), camera = viewport.orbit;
      sorted = forward; lastForward = forward;
      lastLoopView = hasCssLoops || (customCount > 0 && nodeUniforms['worldSizes']!.value < 0.5)
        ? [camera.distance, camera.target.x, camera.target.y, camera.target.z, view.height, view.width, view.near] : undefined;
      const depthOrigin = camera.distance + camera.target.x * forward[0] + camera.target.y * forward[1] + camera.target.z * forward[2];
      return { view, forward, depthOrigin };
    },
    initialDepthKey(row: number, order: { view: GraphSpatialView; forward: [number, number, number]; depthOrigin: number }) {
      return depthKey(physicalSlot(row), order.forward, order.depthOrigin, order.view);
    },
    encodeInitialKey(row: number, min: number, scale: number) {
      storage.keys[row] = Math.min(KEY_STEPS, Math.floor((storage.keys[row]! - min) * scale)) * INDEX_BITS + physicalSlot(row);
    },
    initializeOutputRow(row: number) {
      const slot = translucent ? storage.keys[row]! % INDEX_BITS : physicalSlot(row);
      outputRow[slot] = row; copyPayloadRow(row, slot);
      if (slot >= activeEdges) { if (initialNodeStart < 0) initialNodeStart = row; }
      else if (initialNodeStart >= 0) { denseNodeRanges.push({ start: initialNodeStart * 4, count: (row - initialNodeStart) * 4 }); initialNodeStart = -1; }
    },
    finishInitialization(viewport: CompositePresentation) {
      if (initialNodeStart >= 0) { denseNodeRanges.push({ start: initialNodeStart * 4, count: (active - initialNodeStart) * 4 }); initialNodeStart = -1; }
      setView(viewport); seenNodes = nodes.revision; seenEdges = edges.revision; rememberPaint();
      for (const payload of payloads) markAttributeFull(payload);
    },
  };
}

interface CompositeAssembly {
  nodes: ReturnType<typeof createGraphSpatialNodes> | undefined;
  edges: ReturnType<typeof createGraphSpatialEdges> | undefined;
  custom: GraphNodeMeshData | undefined;
  nodeCount: number;
  edgeCount: number;
  count: number;
  allocation: number;
  native: number;
  storage: Partial<CompositeStorage> & Pick<CompositeStorage, 'output' | 'staged'>;
  plane: PlaneGeometry | undefined;
  geometry: InstancedBufferGeometry | undefined;
  payloads: InstancedBufferAttribute[];
  uniforms: CompositeUniforms | undefined;
  material: ShaderMaterial | undefined;
  customPick: ReturnType<typeof createGraphSpatialMeshPick> | undefined;
  mesh: Mesh<InstancedBufferGeometry, ShaderMaterial> | undefined;
  resources: GraphSpatialCompositeResources | undefined;
  controller: ReturnType<typeof createCompositeController> | undefined;
}
function compositeAssembly(nodes: ReturnType<typeof createGraphSpatialNodes>, edges: ReturnType<typeof createGraphSpatialEdges>, custom?: GraphNodeMeshData): CompositeAssembly {
  const nodeCount = nodes.mesh.geometry.instanceCount, edgeCount = edges.mesh.geometry.instanceCount;
  if (custom) preflightGraphSpatialMeshes(nodeCount, edgeCount, custom);
  return { nodes, edges, custom, nodeCount, edgeCount, count: nodeCount + edgeCount + (custom?.triangleCount ?? 0), allocation: 0, native: 0,
    storage: { output: [], staged: [] }, plane: undefined, geometry: undefined, payloads: [], uniforms: undefined, material: undefined,
    customPick: undefined, mesh: undefined, resources: undefined, controller: undefined };
}
function allocateComposite(owner: CompositeAssembly): number {
  const stage = owner.allocation++, storage = owner.storage;
  if (stage < 10) {
    const buffer = new Float32Array(owner.count * 4);
    (stage < 5 ? storage.output : storage.staged).push(buffer); return buffer.byteLength;
  }
  if (stage === 10) { storage.anchors = new Float32Array(owner.count * 3); return storage.anchors.byteLength; }
  if (stage === 11) { storage.primitiveSlot = new Int32Array(owner.count); return storage.primitiveSlot.byteLength; }
  if (stage === 12) { storage.outputRow = new Int32Array(owner.count); return storage.outputRow.byteLength; }
  if (stage === 13) { storage.keys = new Float64Array(0); return 0; }
  storage.ranges = new Uint32Array(owner.nodeCount + 1); return storage.ranges.byteLength;
}
function constructComposite(owner: CompositeAssembly): number {
  // The optional pick factory performs fixed work and retires its own partial handles on failure.
  if (owner.native === 4 && !owner.custom) owner.native++;
  switch (owner.native++) {
    case 0: {
      const plane = owner.plane = new PlaneGeometry(2, 2);
      return plane.index!.array.byteLength + plane.getAttribute('position').array.byteLength
        + plane.getAttribute('normal').array.byteLength + plane.getAttribute('uv').array.byteLength;
    }
    case 1: {
      const geometry = owner.geometry = new InstancedBufferGeometry(), plane = owner.plane!;
      geometry.index = plane.index; geometry.attributes = { ...plane.attributes }; geometry.instanceCount = 0;
      owner.plane = undefined; plane.dispose(); break;
    }
    case 2:
      for (let index = 0; index < 5; index++) {
        const attribute = new InstancedBufferAttribute(owner.storage.output[index]!, 4);
        owner.payloads.push(attribute); owner.geometry!.setAttribute(`payload${index}`, attribute);
      }
      owner.uniforms = { viewportSize: new Vector2(1, 1), viewWindow: new Vector4(0, 0, 1, 1), lyraView: new Vector4(1, 1, 0.5, 1e4) };
      break;
    case 3: {
      const { viewportSize, viewWindow, lyraView } = owner.uniforms!;
      const nodeUniforms = owner.nodes!.mesh.material.uniforms, edgeUniforms = owner.edges!.mesh.material.uniforms;
      owner.material = new ShaderMaterial({ side: DoubleSide, forceSinglePass: true, vertexShader: vertex, fragmentShader: fragment, transparent: true, depthWrite: false, depthTest: true,
        uniforms: { viewportSize: { value: viewportSize }, viewWindow: { value: viewWindow }, lyraView: { value: lyraView }, worldSizes: nodeUniforms['worldSizes']!, markerArm: nodeUniforms['markerArm']!,
          meshForcedColors: { value: 0 }, dashAtlas: edgeUniforms['dashAtlas']!, atlasHeight: edgeUniforms['atlasHeight']! } });
      break;
    }
    case 4:
      owner.customPick = createGraphSpatialMeshPick(owner.storage.staged, owner.nodeCount + owner.edgeCount, owner.custom!.triangleCount, owner.material!.uniforms, owner.geometry!); break;
    case 5:
      owner.mesh = new Mesh(owner.geometry!, owner.material!); owner.mesh.frustumCulled = false; break;
    case 6:
      owner.resources = { geometry: owner.geometry!, material: owner.material!, mesh: owner.mesh!, customPick: owner.customPick, disposed: false };
      owner.controller = createCompositeController(owner.nodes!, owner.edges!, owner.custom, owner.resources, owner.storage as CompositeStorage, owner.payloads, owner.uniforms!);
      break;
  }
  return 0;
}
function clearCompositeAssembly(owner: CompositeAssembly): void {
  owner.nodes = undefined; owner.edges = undefined; owner.custom = undefined; owner.storage = { output: [], staged: [] };
  owner.plane = undefined; owner.geometry = undefined; owner.payloads = []; owner.uniforms = undefined; owner.material = undefined;
  owner.customPick = undefined; owner.mesh = undefined; owner.resources = undefined; owner.controller = undefined;
}
function retireCompositeAssembly(owner: CompositeAssembly): void {
  const { resources, plane, geometry, material, customPick, mesh } = owner;
  clearCompositeAssembly(owner);
  if (resources) disposeGraphSpatialCompositeResources(resources);
  else disposeAll([
    () => mesh?.removeFromParent(), () => plane?.dispose(), () => geometry?.dispose(), () => material?.dispose(),
    () => customPick?.removeFromParent(), () => customPick?.geometry.dispose(), () => customPick?.material.dispose(),
  ]);
}

/** One visual draw across glyphs and strokes; pick meshes retain row identity. */
export function createGraphSpatialComposite(nodes: ReturnType<typeof createGraphSpatialNodes>, edges: ReturnType<typeof createGraphSpatialEdges>, custom?: GraphNodeMeshData) {
  const owner = compositeAssembly(nodes, edges, custom);
  try {
    while (owner.allocation < 14 + Number(Boolean(custom))) allocateComposite(owner);
    if (custom) for (let row = 0; row < owner.nodeCount; row++) owner.storage.ranges![row + 1] = owner.storage.ranges![row]! + (custom.nodeMeshes[row]?.positions.length ?? 0) / 9;
    owner.storage.primitiveSlot!.fill(-1); owner.storage.outputRow!.fill(-1);
    while (owner.native < 7) constructComposite(owner);
    const controller = owner.controller!;
    if (custom) for (let row = 0; row < owner.nodeCount; row++) {
      for (let face = owner.storage.ranges![row]!; face < owner.storage.ranges![row + 1]!; face++) controller.initializeLocalFace(row, face);
    }
    clearCompositeAssembly(owner); return controller.batch;
  } catch (error) {
    try { retireCompositeAssembly(owner); } catch { /* Preserve the construction error after attempting every acquired handle. */ }
    throw error;
  }
}

interface HeapOrder {
  end: number;
  build: number;
  building: boolean;
  root: number;
  child: number;
  phase: 'root' | 'choose' | 'compare' | 'swap' | 'extract' | 'done';
}
function heapOrder(length: number): HeapOrder { return { end: length, build: Math.floor(length / 2) - 1, building: true, root: 0, child: 0, phase: 'root' }; }
/** One comparison or swap per successful call; heap transitions retain only scalar state. */
function advanceHeap(keys: Float64Array, state: HeapOrder): boolean {
  for (;;) {
    switch (state.phase) {
      case 'root':
        if (state.build < 0) { state.building = false; state.phase = 'extract'; continue; }
        state.root = state.build--; state.phase = 'choose'; continue;
      case 'choose': {
        const left = state.root * 2 + 1;
        if (left >= state.end) { state.phase = state.building ? 'root' : 'extract'; continue; }
        state.child = left; state.phase = 'compare';
        if (left + 1 < state.end) { if (keys[left + 1]! > keys[left]!) state.child++; return true; }
        continue;
      }
      case 'compare':
        state.phase = keys[state.root]! >= keys[state.child]! ? state.building ? 'root' : 'extract' : 'swap'; return true;
      case 'swap': {
        const previous = keys[state.root]!; keys[state.root] = keys[state.child]!; keys[state.child] = previous;
        state.root = state.child; state.phase = 'choose'; return true;
      }
      case 'extract': {
        if (state.end < 2) { state.phase = 'done'; continue; }
        const previous = keys[0]!; keys[0] = keys[--state.end]!; keys[state.end] = previous;
        state.root = 0; state.phase = 'choose'; return true;
      }
      case 'done': return false;
    }
  }
}

type CompositePhase = 'setup' | 'allocate' | 'prefix' | 'slots' | 'native' | 'local-faces' | 'edges' | 'nodes' | 'face-paint' | 'range-setup' | 'ranges' | 'keys' | 'depth' | 'encode' | 'heap' | 'output' | 'finish';
interface InitialPickRanges { payload: number; ranges: { start: number; count: number }[]; covered: number; publish: { start: number; count: number }[]; }
interface CompositeWorkState {
  nodes: GraphPreparedSpatialNodes | undefined;
  edges: GraphPreparedSpatialEdges | undefined;
  presentation: GraphSpatialCompositePresentation | undefined;
  custom: GraphNodeMeshData | undefined;
  guard: (() => boolean) | undefined;
  active: boolean;
  owner: CompositeAssembly | undefined;
  phase: CompositePhase;
  row: number;
  face: number;
  customRow: number;
  customRows: number[];
  borrowed: ArrayBufferLike[];
  borrowedSet: Set<ArrayBufferLike> | undefined;
  nodeRevision: number;
  edgeRevision: number;
  dirty: InitialPickRanges[];
  range: number;
  order: ReturnType<ReturnType<typeof createCompositeController>['initializeOrder']> | undefined;
  min: number;
  max: number;
  scale: number;
  heap: HeapOrder | undefined;
}
function addCompositeBorrow(state: CompositeWorkState, buffer: ArrayBufferLike): void {
  if (state.borrowedSet!.has(buffer)) return;
  state.borrowedSet!.add(buffer); state.borrowed.push(buffer);
}
function recordInitialPickRanges(state: CompositeWorkState, face: number, changed: number): void {
  for (const entry of state.dirty) if (changed & (1 << entry.payload)) {
    const previous = entry.ranges.at(-1), start = face * 4;
    if (previous && previous.start + previous.count === start) previous.count += 4;
    else entry.ranges.push({ start, count: 4 });
    entry.covered += 4;
  }
}

/**
 * Prepares one detached visual owner from fresh, exclusively borrowed child batches. Each step
 * allocates one backing, performs fixed native work, or visits one slot, primitive, face or range.
 * Exact initial painter ordering uses the existing key encoding with scalar heap operations.
 */
export function createGraphSpatialCompositeWork(nodes: GraphPreparedSpatialNodes, edges: GraphPreparedSpatialEdges, presentation: GraphSpatialCompositePresentation, custom?: GraphNodeMeshData, isCurrent?: () => boolean): GraphSpatialCompositeWork {
  const state: CompositeWorkState = { nodes, edges, presentation, custom, guard: isCurrent, active: true, owner: undefined, phase: 'setup', row: 0, face: 0,
    customRow: 0, customRows: [], borrowed: [], borrowedSet: new Set(), nodeRevision: 0, edgeRevision: 0,
    dirty: [0, 3, 4].map(payload => ({ payload, ranges: [], covered: 0, publish: [] })), range: 0,
    order: undefined, min: Infinity, max: -Infinity, scale: 0, heap: undefined };
  nodes = undefined as never; edges = undefined as never; presentation = undefined as never; custom = undefined; isCurrent = undefined;
  let running = false;
  const abort = (): never => { const error = new Error('Graph spatial composite preparation was superseded'); error.name = 'AbortError'; throw error; };
  const checkpoint = (): void => {
    const current = state.active && (!state.guard || state.guard());
    if (!current || !state.active) abort();
  };
  const releaseInputs = (): void => {
    state.active = false; state.nodes = undefined; state.edges = undefined; state.presentation = undefined; state.custom = undefined; state.guard = undefined;
    state.customRows = []; state.borrowed = []; state.borrowedSet = undefined; state.dirty = []; state.order = undefined; state.heap = undefined;
  };
  const close = (): void => {
    releaseInputs();
    if (running) return;
    const owner = state.owner; state.owner = undefined;
    if (owner) retireCompositeAssembly(owner);
  };
  return {
    step(maxOperations) {
      if (!state.active || running) throw new DOMException('Graph spatial composite preparation is closed or running', 'InvalidStateError');
      if (!Number.isSafeInteger(maxOperations) || maxOperations < 1) throw new RangeError('Invalid graph spatial composite preparation budget');
      let operations = 0, allocatedBytes = 0, visitedNodes = 0, visitedEdgePrimitives = 0, packedFaces = 0, paintedFaces = 0;
      let initializedSlots = 0, orderedRows = 0, sortOperations = 0, publishedRanges = 0;
      running = true;
      try {
        while (operations < maxOperations) {
          checkpoint();
          const owner = state.owner;
          switch (state.phase) {
            case 'setup': {
              const nodeInput = state.nodes!, edgeInput = state.edges!;
              state.nodeRevision = nodeInput.batch.revision; state.edgeRevision = edgeInput.batch.revision;
              if (nodeInput.resources.disposed || edgeInput.resources.disposed || state.nodeRevision !== 1 || state.edgeRevision !== 1) {
                throw new DOMException('Fresh spatial child batches are required', 'InvalidStateError');
              }
              state.owner = compositeAssembly(nodeInput.batch, edgeInput.batch, state.custom);
              for (const buffer of [...nodeInput.ownedBuffers, ...nodeInput.borrowedBuffers, ...edgeInput.ownedBuffers, ...edgeInput.borrowedBuffers]) addCompositeBorrow(state, buffer);
              state.phase = 'allocate'; break;
            }
            case 'allocate':
              if (owner!.allocation === 14 + Number(Boolean(state.custom))) { state.phase = 'prefix'; state.row = 0; continue; }
              allocatedBytes += allocateComposite(owner!); break;
            case 'prefix': {
              if (!state.custom || state.row === owner!.nodeCount) { state.phase = 'slots'; state.row = 0; continue; }
              const row = state.row++, body = state.custom.nodeMeshes[row], ranges = owner!.storage.ranges!;
              ranges[row + 1] = ranges[row]! + (body?.positions.length ?? 0) / 9;
              if (body) { state.customRows.push(row); addCompositeBorrow(state, body.positions.buffer); addCompositeBorrow(state, body.normals.buffer); }
              visitedNodes++; break;
            }
            case 'slots':
              if (state.row === owner!.count) { state.phase = 'native'; continue; }
              owner!.storage.primitiveSlot![state.row] = -1; owner!.storage.outputRow![state.row++] = -1; initializedSlots++; break;
            case 'native':
              if (owner!.native === 7) { state.phase = 'local-faces'; continue; }
              allocatedBytes += constructComposite(owner!); break;
            case 'local-faces': {
              if (state.face === (state.custom?.triangleCount ?? 0)) { state.phase = 'edges'; state.row = 0; continue; }
              const row = state.customRows[state.customRow]!;
              owner!.controller!.initializeLocalFace(row, state.face++); packedFaces++;
              if (state.face === owner!.storage.ranges![row + 1]) state.customRow++;
              break;
            }
            case 'edges':
              if (state.row === owner!.edgeCount) { owner!.controller!.finishEdges(); state.phase = 'nodes'; state.row = 0; continue; }
              if (!owner!.storage.loopOffsets && owner!.controller!.needsLoopOffsets(state.row)) {
                owner!.storage.loopOffsets = new Float32Array(owner!.count * 2); allocatedBytes += owner!.storage.loopOffsets.byteLength; break;
              }
              owner!.controller!.packEdge(state.row++); visitedEdgePrimitives++; break;
            case 'nodes':
              if (state.row === owner!.nodeCount) {
                owner!.controller!.finishNodes(); state.phase = 'face-paint'; state.face = 0; state.customRow = 0; continue;
              }
              owner!.controller!.packNode(state.row++); visitedNodes++; break;
            case 'face-paint': {
              if (state.face === (state.custom?.triangleCount ?? 0)) {
                owner!.controller!.finishCompaction(); state.phase = 'range-setup'; state.row = 0; continue;
              }
              const row = state.customRows[state.customRow]!, face = state.face++;
              recordInitialPickRanges(state, face, owner!.controller!.initializeFacePaint(row, face)); paintedFaces++;
              if (state.face === owner!.storage.ranges![row + 1]) state.customRow++;
              break;
            }
            case 'range-setup': {
              if (!state.custom || state.row === 3) { state.phase = 'ranges'; state.row = 0; state.range = 0; continue; }
              const entry = state.dirty[state.row++]!, attribute = owner!.customPick!.geometry.getAttribute(`payload${entry.payload}`) as InstancedBufferAttribute;
              if (entry.ranges.length) {
                const last = entry.ranges.at(-1)!;
                entry.publish = entry.ranges.length > 64 && entry.covered >= attribute.array.length / 4
                  ? [{ start: entry.ranges[0]!.start, count: last.start + last.count - entry.ranges[0]!.start }] : entry.ranges;
                // Install the same native-only upload cleanup and one version change, then publish
                // the already ordered ranges one at a time while this owner remains detached.
                markAttributeFull(attribute); attribute.clearUpdateRanges();
              }
              break;
            }
            case 'ranges': {
              if (!state.custom || state.row === 3) { state.phase = 'keys'; continue; }
              const entry = state.dirty[state.row]!;
              if (state.range === entry.publish.length) { state.row++; state.range = 0; continue; }
              const range = entry.publish[state.range++]!;
              (owner!.customPick!.geometry.getAttribute(`payload${entry.payload}`) as InstancedBufferAttribute).addUpdateRange(range.start, range.count); publishedRanges++; break;
            }
            case 'keys': {
              const controller = owner!.controller!;
              if (!controller.translucent) { state.phase = 'output'; state.row = 0; continue; }
              state.order = controller.initializeOrder(state.presentation!); state.phase = 'depth'; state.row = 0;
              if (controller.active === 0) continue;
              owner!.storage.keys = new Float64Array(owner!.count); allocatedBytes += owner!.storage.keys.byteLength; break;
            }
            case 'depth': {
              if (state.row === owner!.controller!.active) { state.scale = state.max > state.min ? KEY_STEPS / (state.max - state.min) : 0; state.phase = 'encode'; state.row = 0; continue; }
              const key = owner!.controller!.initialDepthKey(state.row, state.order!);
              owner!.storage.keys![state.row++] = key; if (key < state.min) state.min = key; if (key > state.max) state.max = key; break;
            }
            case 'encode':
              if (state.row === owner!.controller!.active) { state.heap = heapOrder(owner!.controller!.active); state.phase = 'heap'; continue; }
              owner!.controller!.encodeInitialKey(state.row++, state.min, state.scale); break;
            case 'heap':
              if (!advanceHeap(owner!.storage.keys!, state.heap!)) { state.phase = 'output'; state.row = 0; continue; }
              sortOperations++; break;
            case 'output':
              if (state.row === owner!.controller!.active) { state.phase = 'finish'; continue; }
              owner!.controller!.initializeOutputRow(state.row++); orderedRows++; break;
            case 'finish': {
              const prepared = owner!, controller = prepared.controller!, nodeInput = state.nodes!, edgeInput = state.edges!;
              controller.finishInitialization(state.presentation!);
              const value: GraphPreparedSpatialComposite = { batch: controller.batch, resources: prepared.resources!,
                ownedBuffers: controller.batch.allocations().buffers, borrowedBuffers: state.borrowed };
              const result: GraphSpatialCompositeWorkStep = { done: true, operations: operations + 1, allocatedBytes, visitedNodes, visitedEdgePrimitives,
                packedFaces, paintedFaces, initializedSlots, orderedRows, sortOperations, publishedRanges, value };
              checkpoint();
              if (nodeInput.resources.disposed || edgeInput.resources.disposed || nodeInput.batch.revision !== state.nodeRevision || edgeInput.batch.revision !== state.edgeRevision) abort();
              // These are the trusted fresh child controllers. Consume only after the final fence;
              // no callback, guard or fallible candidate construction follows ownership transfer.
              nodeInput.batch.takeChanges(); edgeInput.batch.takeChanges();
              state.owner = undefined; clearCompositeAssembly(prepared); releaseInputs();
              return result;
            }
          }
          operations++; checkpoint();
        }
        return { done: false, operations, allocatedBytes, visitedNodes, visitedEdgePrimitives, packedFaces, paintedFaces, initializedSlots, orderedRows, sortOperations, publishedRanges };
      } catch (error) {
        releaseInputs();
        const owner = state.owner; state.owner = undefined;
        try { if (owner) retireCompositeAssembly(owner); } catch { /* Preserve the operation failure after every acquired resource was attempted. */ }
        throw error;
      } finally { running = false; }
    },
    dispose: close,
  };
}
