import { disposeAll } from '../core/dispose.js';
import type { GraphNodeMeshData } from './node-mesh.js';
import { DoubleSide, Color, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, PerspectiveCamera, PlaneGeometry, ShaderMaterial, Vector2, Vector4 } from 'three';
import { markAttributeFull, markAttributeRows } from '../core/attribute-updates.js';
import type { VisualStateRows } from '../core/visual-state.js';
import { createPaintColors } from '../core/paint-colors.js';
import type { Lyra3dState } from '../core/contract.js';
import { LYRA_3D_WORLD_LIMIT } from '../core/orbit.js';
import { createPickColors } from '../core/picking.js';
import type { Lyra3dRgba } from '../core/style.js';
import type { Lyra3dViewport } from '../core/viewport.js';
import type { GraphSpatialAppearance } from './spatial-appearance.js';
import { graphSpatialNodeVertexChunk, graphSpatialProjectionChunk, graphSpatialView } from './spatial-paths.js';

interface SpatialNodeData {
  readonly nodeCount: number;
  readonly sizes?: Float32Array;
  readonly categories?: Uint16Array;
  readonly spatialAppearance: GraphSpatialAppearance;
}
type NodeViewport = Pick<Lyra3dViewport, 'width' | 'height' | 'orbit' | 'style'>;
type NodeView = Pick<Lyra3dViewport, 'width' | 'height' | 'orbit'>;
const vertex = graphSpatialProjectionChunk + graphSpatialNodeVertexChunk + `
attribute vec3 nodePosition; attribute float nodeSize; attribute float nodeShape; attribute vec2 nodeFlags;
attribute vec4 nodeFill; attribute vec4 nodeRing; attribute vec4 nodeMarker; attribute vec3 pickColor;
void main() { graphSpatialNodeVertex(nodePosition, nodeSize, nodeShape, nodeFlags, nodeFill, nodeRing, nodeMarker, pickColor);
  #ifdef PICKING
    if(nodeShape < -0.5) {
      vec2 previous = offset;
      offset = position.xy * max(radius + 5.0, radius + markerArm);
      gl_Position.xy += (offset - previous) * 2.0 / viewportSize * gl_Position.w;
    }
  #endif
}`;
export const graphSpatialNodeFragment = `
uniform float markerArm;
#ifdef PICKING
  flat varying float pickDepth;
#endif
varying vec2 offset;
varying float radius;
varying float shape;
varying vec2 flags;
varying vec4 fill;
varying vec4 ring;
varying vec4 marker;
vec4 over(vec4 foreground, vec4 background) {
  float alpha = foreground.a + background.a * (1.0 - foreground.a);
  if (alpha <= 0.0) return vec4(0.0);
  return vec4((foreground.rgb * foreground.a + background.rgb * background.a * (1.0 - foreground.a)) / alpha, alpha);
}
bool inside(vec2 p, float r) {
  if (shape < 0.5) return length(p) <= r;
  if (shape < 1.5) {
    #ifdef PICKING
      return max(abs(p.x), abs(p.y)) <= max(12.0, r * 0.88622692545);
    #else
      return max(abs(p.x), abs(p.y)) <= r * 0.88622692545;
    #endif
  }
  return abs(p.x) + abs(p.y) <= r * 1.25331413732;
}
void paintGraphSpatialNode() {
  #ifdef PICKING
    if (shape < -0.5) {
      bool selectedRing = flags.x > 0.5 && ring.a > 0.0 && abs(length(offset) - radius - 4.0) <= 1.0;
      vec2 plus = abs(offset - vec2(radius));
      bool expandedMarker = flags.y > 0.5 && marker.a > 0.0 && ((plus.x <= 0.75 && plus.y <= markerArm) || (plus.y <= 0.75 && plus.x <= markerArm));
      if (!selectedRing && !expandedMarker) discard;
    } else if (!inside(offset, max(12.0, radius))) discard;
    gl_FragDepth = pickDepth;
    gl_FragColor = fill;
  #else
    vec4 paint = vec4(0.0);
    if (shape >= 0.0 && radius > 0.0 && inside(offset, radius)) paint = fill;
    if (flags.x > 0.5 && abs(length(offset) - radius - 4.0) <= 1.0) paint = over(ring, paint);
    vec2 plus = abs(offset - vec2(radius));
    if (flags.y > 0.5 && ((plus.x <= 0.75 && plus.y <= markerArm) || (plus.y <= 0.75 && plus.x <= markerArm))) paint = over(marker, paint);
    if (paint.a <= 0.0) discard;
    gl_FragColor = paint;
    #include <colorspace_fragment>
  #endif
}`;
const fragment = graphSpatialNodeFragment + '\nvoid main() { paintGraphSpatialNode(); }';

/** Batched screen-facing spatial glyphs. Pick colors always identify the original node row. */
export function createGraphSpatialNodes(input: SpatialNodeData, meshes?: GraphNodeMeshData) {
  const count = input.nodeCount;
  if (!Number.isInteger(count) || count < 0 || count > 200_000) throw new RangeError('Invalid spatial node count');
  const appearance = input.spatialAppearance;
  if (!appearance || (appearance.sizeUnits !== undefined && appearance.sizeUnits !== 'css' && appearance.sizeUnits !== 'world')) throw new TypeError('Invalid spatial node appearance');
  const opacity = appearance.dimmedOpacity ?? 0.35;
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) throw new RangeError('Invalid spatial node opacity');
  const bytes = (value: Uint8Array | undefined, maximum: number) => {
    if (value === undefined) return undefined;
    if (!(value instanceof Uint8Array) || value.length !== count || !value.every((item) => item <= maximum)) throw new RangeError('Invalid spatial node mask');
    return value.slice();
  };
  const floats = (value: Float32Array | undefined, length: number, maximum: number) => {
    if (value === undefined) return undefined;
    if (!(value instanceof Float32Array) || value.length !== length || !value.every((item) => Number.isFinite(item) && item >= 0 && item <= maximum)) throw new RangeError('Invalid spatial node values');
    return value.slice();
  };
  const shapes = bytes(appearance.nodeShapes, 2), expandable = bytes(appearance.expandable, 1);
  const colors = floats(appearance.nodeColors, count * 4, 1), sizes = floats(input.sizes, count, Number.MAX_VALUE);
  if (input.categories !== undefined && (!(input.categories instanceof Uint16Array) || input.categories.length !== count)) throw new RangeError('Invalid spatial node categories');
  const categories = input.categories?.slice();
  const worldSize = appearance.sizeUnits === 'world';
  const plane = new PlaneGeometry(2, 2), geometry = new InstancedBufferGeometry();
  geometry.index = plane.index; geometry.attributes = { ...plane.attributes }; geometry.instanceCount = count; plane.dispose();
  const attribute = (name: string, components: number) => {
    const result = new InstancedBufferAttribute(new Float32Array(count * components), components);
    geometry.setAttribute(name, result); return result;
  };
  // Attributes stay in row order and hold only camera-independent values: the vertex stage derives
  // glyph radius, quad extents, near-plane hiding and pick depth from the camera every frame.
  const position = attribute('nodePosition', 3), size = attribute('nodeSize', 1), shape = attribute('nodeShape', 1);
  const flags = attribute('nodeFlags', 2), fill = attribute('nodeFill', 4), ring = attribute('nodeRing', 4), marker = attribute('nodeMarker', 4), pickColor = attribute('pickColor', 3);
  (pickColor.array as Float32Array).set(createPickColors(count));
  if (shapes) (shape.array as Float32Array).set(shapes);
  if (meshes) for (let row = 0; row < count; row++) if (meshes.nodeMeshes[row]) shape.setX(row, -1);
  const viewportSize = new Vector2(1, 1), pickViewportSize = new Vector2(1, 1), lyraView = new Vector4(1, 1, 0.5, 1e4);
  const shared = { lyraView: { value: lyraView }, worldSizes: { value: worldSize ? 1 : 0 }, markerArm: { value: 3 } };
  const material = new ShaderMaterial({ side: DoubleSide, forceSinglePass: true, uniforms: { ...shared, viewportSize: { value: viewportSize } }, vertexShader: vertex, fragmentShader: fragment });
  const pickMaterial = new ShaderMaterial({ side: DoubleSide, forceSinglePass: true, uniforms: { ...shared, viewportSize: { value: pickViewportSize } }, defines: { PICKING: 1 }, vertexShader: vertex, fragmentShader: fragment, toneMapped: false });
  const mesh = new Mesh(geometry, material), pick = new Mesh(geometry, pickMaterial); mesh.frustumCulled = pick.frustumCulled = false;
  pick.onBeforeRender = (_renderer, _scene, camera) => {
    const view = camera instanceof PerspectiveCamera ? camera.view : null;
    pickViewportSize.copy(viewportSize);
    if (view?.enabled) pickViewportSize.set(viewportSize.x * view.width / view.fullWidth, viewportSize.y * view.height / view.fullHeight);
    pickMaterial.uniformsNeedUpdate = true;
  };
  const color = new Color(); let disposed = false, translucent = false, revision = 0, forcedColors = false;
  const setView = (viewport: NodeView) => {
    const next = graphSpatialView(viewport.width, viewport.height, viewport.orbit);
    viewportSize.set(next.width, next.height); lyraView.set(next.width, next.height, next.near, next.far);
  };
  const partialRows = new Uint8Array(count);
  let partialCount = 0, fullChange = true, denseChange = false;
  const changedRows = new Set<number>();
  const paint = (viewport: NodeViewport, state: Lyra3dState, rows: VisualStateRows, full: boolean) => {
    const style = viewport.style, dense = rows === null; forcedColors = style.forcedColors;
    const paintColor = createPaintColors(style);
    const dirty = new Map<InstancedBufferAttribute, number[]>();
    const touched = new Set<InstancedBufferAttribute>();
    const record = (buffer: InstancedBufferAttribute, row: number) => {
      if (full) return;
      touched.add(buffer);
      if (dense) return;
      const list = dirty.get(buffer) ?? []; list.push(row); dirty.set(buffer, list);
      if (!fullChange && !denseChange) changedRows.add(row);
    };
    const write2 = (buffer: InstancedBufferAttribute, row: number, a: number, b: number) => {
      const offset = row * 2;
      if (!full && buffer.array[offset] === a && buffer.array[offset + 1] === b) return;
      buffer.array[offset] = a; buffer.array[offset + 1] = b; record(buffer, row);
    };
    const writePaint = (buffer: InstancedBufferAttribute, row: number, value: Lyra3dRgba, alpha: number) => {
      paintColor(value, color);
      const offset = row * 4, r = Math.fround(color.r), g = Math.fround(color.g), b = Math.fround(color.b), a = Math.fround(value.a * alpha);
      if (!full && buffer.array[offset] === r && buffer.array[offset + 1] === g && buffer.array[offset + 2] === b && buffer.array[offset + 3] === a) return;
      buffer.array[offset] = r; buffer.array[offset + 1] = g; buffer.array[offset + 2] = b; buffer.array[offset + 3] = a; record(buffer, row);
    };
    const partial = (value: number) => value > 0 && value < 1;
    for (let index = 0, length = rows?.length ?? count; index < length; index++) {
      const row = rows === null ? index : rows[index]!;
      if (!Number.isInteger(row) || row < 0 || row >= count) continue;
      const selected = state.selected.has(row) || state.hover === row || state.focus === row;
      const expanded = expandable?.[row] === 1;
      const alpha = style.forcedColors || !state.dimmed.has(row) ? 1 : opacity;
      const customColor = meshes?.nodeMeshes[row]?.color;
      const source = style.forcedColors ? style.foreground : customColor ? { r: customColor[0], g: customColor[1], b: customColor[2], a: customColor[3] } : colors ? { r: colors[row * 4]!, g: colors[row * 4 + 1]!, b: colors[row * 4 + 2]!, a: colors[row * 4 + 3]! } : style.palette[(categories?.[row] ?? 0) % style.palette.length]!;
      if (meshes?.nodeMeshes[row]) {
        const nextShape = source.a > 0 ? -1 : -2;
        if (shape.getX(row) !== nextShape) { shape.setX(row, nextShape); record(shape, row); }
      }
      const blends = partial(source.a * alpha) || (selected && partial(style.accent.a * alpha)) || (expanded && partial(style.foreground.a * alpha));
      const nextPartial = blends ? 1 : 0;
      partialCount += nextPartial - partialRows[row]!; partialRows[row] = nextPartial;
      write2(flags, row, selected ? 1 : 0, expanded ? 1 : 0);
      writePaint(fill, row, source, alpha); writePaint(ring, row, style.accent, alpha); writePaint(marker, row, style.foreground, alpha);
    }
    translucent = partialCount > 0;
    if (material.transparent !== translucent) { material.transparent = translucent; material.needsUpdate = true; }
    material.depthWrite = !translucent;
    if (full) for (const buffer of [flags, fill, ring, marker, ...(meshes ? [shape] : [])]) markAttributeFull(buffer);
    else if (dense) for (const buffer of touched) markAttributeFull(buffer);
    else for (const [buffer, changed] of dirty) markAttributeRows(buffer, changed);
    if (full) { fullChange = true; denseChange = false; changedRows.clear(); }
    else if (dense && touched.size && !fullChange) { denseChange = true; changedRows.clear(); }
    if (touched.size || full) revision++;
  };
  const updatePositions = (viewport: NodeView, positions: Float32Array) => {
    if (!(positions instanceof Float32Array) || positions.length !== count * 3 || !positions.every((value) => Number.isFinite(value) && Math.abs(value) <= LYRA_3D_WORLD_LIMIT)) throw new RangeError('Invalid spatial node positions');
    setView(viewport); (position.array as Float32Array).set(positions); markAttributeFull(position); fullChange = true; revision++;
  };
  const updateStyle = (viewport: NodeViewport, state: Lyra3dState) => {
    setView(viewport); shared.markerArm.value = Math.max(3, viewport.style.fontSize / 4);
    for (let row = 0; row < count; row++) size.setX(row, (sizes?.[row] ?? viewport.style.pointSize) / 2);
    markAttributeFull(size); paint(viewport, state, null, true);
  };
  return {
    mesh, pick,
    /** Retained batch-owned copies and masks; geometry backing is inventoried separately. */
    allocationBuffers(): readonly ArrayBufferLike[] {
      const values = [shapes, expandable, colors, sizes, categories, partialRows];
      return [...new Set(values.filter(value => value !== undefined).map(value => value.buffer))];
    },
    get translucent() { return translucent; },
    get forcedColors() { return forcedColors; },
    bodyPickable(row: number) { return shape.getX(row) === -1; },
    get revision() { return revision; },
    takeChanges(): { full: boolean; rows: VisualStateRows } {
      const result = { full: fullChange, rows: fullChange ? [] : denseChange ? null : [...changedRows] };
      fullChange = false; denseChange = false; changedRows.clear(); return result;
    },
    setView(viewport: NodeView) { if (!disposed) setView(viewport); },
    updatePositions(viewport: NodeView, positions: Float32Array) { if (!disposed) updatePositions(viewport, positions); },
    updateStyle(viewport: NodeViewport, state: Lyra3dState) { if (!disposed) updateStyle(viewport, state); },
    updateState(viewport: NodeViewport, state: Lyra3dState, rows: VisualStateRows) { if (!disposed) paint(viewport, state, rows, false); },
    update(viewport: NodeViewport, positions: Float32Array, state: Lyra3dState) {
      if (disposed) return;
      const previousRevision = revision;
      updatePositions(viewport, positions); updateStyle(viewport, state);
      revision = previousRevision + 1;
    },
    dispose() { if (disposed) return; disposed = true; disposeAll([() => mesh.removeFromParent(), () => pick.removeFromParent(), () => material.dispose(), () => pickMaterial.dispose(), () => geometry.dispose()]); },
  };
}
