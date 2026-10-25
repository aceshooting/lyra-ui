import { DoubleSide, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, PlaneGeometry, ShaderMaterial, Vector2, Vector4 } from 'three';
import { markAttributeFull, markAttributeRanges, markAttributeRows } from '../core/attribute-updates.js';
import type { VisualStateRows } from '../core/visual-state.js';
import type { Lyra3dViewport } from '../core/viewport.js';
import { graphSpatialNodeFragment, type createGraphSpatialNodes } from './spatial-nodes.js';
import { graphSpatialEdgeFragment, type createGraphSpatialEdges } from './spatial-edges.js';
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

const vertex = graphSpatialProjectionChunk + graphSpatialNodeVertexChunk + graphSpatialEdgeVertexChunk + `
attribute vec4 payload0; attribute vec4 payload1; attribute vec4 payload2; attribute vec4 payload3; attribute vec4 payload4;
varying float primitiveKind;
void main() {
  primitiveKind = payload4.a < 0.0 ? 0.0 : 1.0;
  offset=vec2(0.0); radius=0.0; shape=0.0; flags=vec2(0.0); pickDepth=0.0;
  fill=vec4(0.0); ring=vec4(0.0); marker=vec4(0.0);
  tint=vec4(0.0); pattern=vec2(0.0); arrowUv=vec3(0.0); cap=vec3(0.0); strokeRadius=0.0; depthEnds=vec2(0.0);
  if (primitiveKind > 0.5) graphSpatialNodeVertex(payload0.xyz, payload0.w, payload1.x, payload1.yz, payload2, payload3, payload4, vec3(0.0));
  else graphSpatialEdgeVertex(payload0.xyz, payload1.xyz, vec4(payload0.w, payload1.w, payload3.xy), vec3(payload3.z, 0.0, payload3.w), payload2, vec3(0.0), payload4.x);
}`;
const fragment = graphSpatialNodeFragment + graphSpatialEdgeFragment + `
varying float primitiveKind;
void main(){ if(primitiveKind>0.5) paintGraphSpatialNode(); else paintGraphSpatialEdge(); }
`;

/** One visual draw across glyphs and strokes; pick meshes retain row identity. Payloads are
 * rebuilt only when the batches' attributes change, and re-ordered only for translucent paint. */
export function createGraphSpatialComposite(nodes: ReturnType<typeof createGraphSpatialNodes>, edges: ReturnType<typeof createGraphSpatialEdges>) {
  const nodeCount = nodes.mesh.geometry.instanceCount, edgeCount = edges.mesh.geometry.instanceCount;
  const count = nodeCount + edgeCount;
  const plane = new PlaneGeometry(2, 2), geometry = new InstancedBufferGeometry();
  geometry.index = plane.index; geometry.attributes = { ...plane.attributes }; plane.dispose(); geometry.instanceCount = 0;
  const payloads = Array.from({ length: 5 }, (_, i) => {
    const attribute = new InstancedBufferAttribute(new Float32Array(count * 4), 4);
    geometry.setAttribute(`payload${i}`, attribute); return attribute;
  });
  // Unsorted payloads and world anchors of the active primitives, in edge-then-node order.
  const staged = Array.from({ length: 5 }, () => new Float32Array(count * 4));
  const anchors = new Float32Array(count * 3);
  const primitiveSlot = new Int32Array(count).fill(-1), outputRow = new Int32Array(count).fill(-1);
  let keys = new Float64Array(0);
  const viewportSize = new Vector2(1, 1), viewWindow = new Vector4(0, 0, 1, 1), lyraView = new Vector4(1, 1, 0.5, 1e4);
  const nodeUniforms = nodes.mesh.material.uniforms, edgeUniforms = edges.mesh.material.uniforms;
  const material = new ShaderMaterial({ side: DoubleSide, forceSinglePass: true, vertexShader: vertex, fragmentShader: fragment, transparent: true, depthWrite: false, depthTest: true,
    uniforms: { viewportSize: { value: viewportSize }, viewWindow: { value: viewWindow }, lyraView: { value: lyraView }, worldSizes: nodeUniforms['worldSizes']!, markerArm: nodeUniforms['markerArm']!,
      dashAtlas: edgeUniforms['dashAtlas']!, atlasHeight: edgeUniforms['atlasHeight']! } });
  const mesh = new Mesh(geometry, material); mesh.frustumCulled = false; let disposed = false;
  let seenNodes = -1, seenEdges = -1, active = 0, translucent = false, sorted: [number, number, number] | undefined;
  let activeEdges = 0;
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
  let loopOffsets: Float32Array | undefined, hasCssLoops = false;
  let lastLoopView: number[] | undefined;
  const cancelSettling = () => { if (settling !== undefined) clearTimeout(settling); settling = undefined; };
  const rebuild = () => {
    cancelSettling(); lastForward = undefined; lastLoopView = undefined; hasCssLoops = false;
    loopOffsets?.fill(0);
    seenNodes = nodes.revision; seenEdges = edges.revision; active = 0;
    primitiveSlot.fill(-1); outputRow.fill(-1);
    const node = (name: string) => nodes.mesh.geometry.getAttribute(name).array as Float32Array;
    const edge = (name: string) => edges.mesh.geometry.getAttribute(name).array as Float32Array;
    const [p0, p1, p2, p3, p4] = staged as [Float32Array, Float32Array, Float32Array, Float32Array, Float32Array];
    const start = edge('edgeStart'), end = edge('edgeEnd'), path = edge('edgePath'), stroke = edge('stroke'), color = edge('edgeColor'), dash = edge('dash');
    for (let i = 0; i < edgeCount; i++) {
      if (!(stroke[i * 3]! > 0 && color[i * 4 + 3]! > 0)) continue;
      primitiveSlot[i] = active;
      const o = active * 4;
      p0[o] = start[i * 3]!; p0[o + 1] = start[i * 3 + 1]!; p0[o + 2] = start[i * 3 + 2]!; p0[o + 3] = path[i * 4]!;
      p1[o] = end[i * 3]!; p1[o + 1] = end[i * 3 + 1]!; p1[o + 2] = end[i * 3 + 2]!; p1[o + 3] = path[i * 4 + 1]!;
      p2.set(color.subarray(i * 4, i * 4 + 4), o);
      p3[o] = path[i * 4 + 2]!; p3[o + 1] = path[i * 4 + 3]!; p3[o + 2] = stroke[i * 3]!; p3[o + 3] = stroke[i * 3 + 2]!;
      p4[o] = dash[i]!; p4[o + 1] = 0; p4[o + 2] = 0; p4[o + 3] = -1;
      anchors.set(edges.anchors.subarray(i * 3, i * 3 + 3), active * 3);
      if (nodeUniforms['worldSizes']!.value < 0.5 && path[i * 4 + 2]! > 0 && stroke[i * 3 + 2]! < 0.5) {
        // CSS loop endpoints are expanded in world XY by the shader. Store their midpoint in
        // CSS units; only its sort key needs the camera-dependent conversion to world units.
        loopOffsets ??= new Float32Array(count * 2);
        const a = path[i * 4]! * Math.PI * 2, b = path[i * 4 + 1]! * Math.PI * 2, radius = path[i * 4 + 2]!;
        loopOffsets[active * 2] = (Math.sin(a) + Math.sin(b)) * radius / 2;
        loopOffsets[active * 2 + 1] = -(2 - Math.cos(a) - Math.cos(b)) * radius / 2;
        hasCssLoops = true;
      }
      active++;
    }
    activeEdges = active;
    const position = node('nodePosition'), size = node('nodeSize'), shape = node('nodeShape'), flags = node('nodeFlags');
    const fill = node('nodeFill'), ring = node('nodeRing'), marker = node('nodeMarker');
    for (let i = 0; i < nodeCount; i++) {
      if (!(size[i]! > 0 || flags[i * 2]! > 0 || flags[i * 2 + 1]! > 0)) continue;
      primitiveSlot[edgeCount + i] = active;
      const o = active * 4;
      p0[o] = position[i * 3]!; p0[o + 1] = position[i * 3 + 1]!; p0[o + 2] = position[i * 3 + 2]!; p0[o + 3] = size[i]!;
      p1[o] = shape[i]!; p1[o + 1] = flags[i * 2]!; p1[o + 2] = flags[i * 2 + 1]!; p1[o + 3] = 0;
      p2.set(fill.subarray(i * 4, i * 4 + 4), o); p3.set(ring.subarray(i * 4, i * 4 + 4), o); p4.set(marker.subarray(i * 4, i * 4 + 4), o);
      anchors.set(position.subarray(i * 3, i * 3 + 3), active * 3); active++;
    }
    translucent = nodes.translucent || edges.translucent;
    if (material.transparent !== translucent) { material.transparent = translucent; material.needsUpdate = true; }
    material.depthWrite = !translucent;
    geometry.instanceCount = active; sorted = undefined;
    denseAllRanges = active ? [{ start: 0, count: active * 4 }] : [];
    denseNodeRanges = [];
    rememberPaint();
    if (!translucent) {
      if (active > activeEdges) denseNodeRanges.push({ start: activeEdges * 4, count: (active - activeEdges) * 4 });
      for (let row = 0; row < active; row++) outputRow[row] = row;
      payloads.forEach((payload, slot) => { (payload.array as Float32Array).set(staged[slot]!.subarray(0, active * 4)); markAttributeFull(payload); });
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
    rememberPaint(); seenNodes = nodes.revision; seenEdges = edges.revision;
    return true;
  };
  // Back-to-front is ascending `dot(anchor, forward)`; equal depths keep edges before nodes.
  const sort = (forward: [number, number, number], depthOrigin: number, view: GraphSpatialView) => {
    sorted = forward;
    if (keys.length < active) keys = new Float64Array(count);
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < active; i++) {
      let key = anchors[i * 3]! * forward[0] + anchors[i * 3 + 1]! * forward[1] + anchors[i * 3 + 2]! * forward[2];
      if (hasCssLoops) {
        const depth = depthOrigin - key;
        // Match lyraGraphPathPoint: CSS loops collapse while their centre is behind near.
        if (depth >= view.near) key += (loopOffsets![i * 2]! * forward[0] + loopOffsets![i * 2 + 1]! * forward[1]) / graphScale(depth, view);
      }
      keys[i] = key; if (key < min) min = key; if (key > max) max = key;
    }
    // Quantized key and original index share one exactly representable double, so the native
    // numeric sort orders by depth and breaks ties by index without a comparator.
    const scale = max > min ? KEY_STEPS / (max - min) : 0;
    for (let i = 0; i < active; i++) keys[i] = Math.min(KEY_STEPS, Math.floor((keys[i]! - min) * scale)) * INDEX_BITS + i;
    const order = keys.subarray(0, active).sort();
    denseNodeRanges = [];
    let nodeStart = -1;
    for (let row = 0; row <= active; row++) {
      const slot = row < active ? order[row]! % INDEX_BITS : -1;
      if (slot >= 0) outputRow[slot] = row;
      if (slot >= activeEdges) { if (nodeStart < 0) nodeStart = row; }
      else if (nodeStart >= 0) { denseNodeRanges.push({ start: nodeStart * 4, count: (row - nodeStart) * 4 }); nodeStart = -1; }
    }
    payloads.forEach((payload, slot) => {
      const target = payload.array as Float32Array, source = staged[slot]!;
      for (let row = 0; row < active; row++) {
        const from = (order[row]! % INDEX_BITS) * 4, to = row * 4;
        target[to] = source[from]!; target[to + 1] = source[from + 1]!; target[to + 2] = source[from + 2]!; target[to + 3] = source[from + 3]!;
      }
      markAttributeFull(payload);
    });
  };
  return { mesh,
    /** Per frame: uniforms always; payload rewrites only after a batch update or, for translucent
     * paint, a material change of view direction. */
    update(viewport: Pick<Lyra3dViewport, 'width' | 'height' | 'orbit' | 'invalidate'>) {
      if (disposed) return;
      const view = graphSpatialView(viewport.width, viewport.height, viewport.orbit);
      viewportSize.set(view.width, view.height); viewWindow.set(0, 0, viewport.width, viewport.height); lyraView.set(view.width, view.height, view.near, view.far);
      if (nodes.revision !== seenNodes || edges.revision !== seenEdges) {
        const nodeChanges = nodes.takeChanges(), edgeChanges = edges.takeChanges();
        if (seenNodes < 0 || seenEdges < 0 || nodeChanges.full || edgeChanges.full || !patch(nodeChanges.rows, edgeChanges.rows)) rebuild();
      }
      if (!translucent) return;
      const forward = graphViewForward(viewport.orbit);
      const camera = viewport.orbit;
      const loopView = hasCssLoops ? [camera.distance, camera.target.x, camera.target.y, camera.target.z, view.height] : undefined;
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
          if (disposed) return;
          sort(forward, depthOrigin, view); viewport.invalidate();
        }, SETTLE_MS);
      }
    },
    dispose() { if (disposed) return; disposed = true; cancelSettling(); mesh.removeFromParent(); geometry.dispose(); material.dispose(); },
  };
}
