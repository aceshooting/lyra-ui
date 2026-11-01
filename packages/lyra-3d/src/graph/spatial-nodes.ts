import { disposeAll } from '../core/dispose.js';
import type { GraphNodeMeshData } from './node-mesh.js';
import { DoubleSide, Color, SRGBColorSpace, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, PerspectiveCamera, PlaneGeometry, ShaderMaterial, Vector2, Vector4 } from 'three';
import { markAttributeFull, markAttributeRows } from '../core/attribute-updates.js';
import type { VisualStateRows } from '../core/visual-state.js';
import { createPaintColors } from '../core/paint-colors.js';
import type { Lyra3dState } from '../core/contract.js';
import { LYRA_3D_WORLD_LIMIT } from '../core/orbit.js';
import type { Lyra3dRgba, ResolvedLyra3dStyle } from '../core/style.js';
import type { PaintColors } from '../core/paint-colors.js';
import type { GraphPreparedDataColumns } from './data-preparation.js';
import type { Lyra3dViewport } from '../core/viewport.js';
import { graphSpatialNodeMeshData, type GraphSpatialAppearance } from './spatial-appearance.js';
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

interface NodeColumns {
  readonly count: number;
  readonly shapes: Uint8Array | undefined;
  readonly expandable: Uint8Array | undefined;
  readonly colors: Float32Array | undefined;
  readonly sizes: Float32Array | undefined;
  readonly categories: Uint16Array | undefined;
  readonly opacity: number;
  readonly worldSize: boolean;
  readonly meshes: GraphNodeMeshData | undefined;
}
const NODE_ATTRIBUTES = [
  ['nodePosition', 3], ['nodeSize', 1], ['nodeShape', 1], ['nodeFlags', 2],
  ['nodeFill', 4], ['nodeRing', 4], ['nodeMarker', 4], ['pickColor', 3],
] as const;
type NodeAttributeName = typeof NODE_ATTRIBUTES[number][0];
type NodeAttributes = Record<NodeAttributeName, InstancedBufferAttribute>;
interface NodeUniforms {
  readonly viewportSize: Vector2;
  readonly pickViewportSize: Vector2;
  readonly lyraView: Vector4;
  readonly shared: {
    readonly lyraView: { value: Vector4 };
    readonly worldSizes: { value: number };
    readonly markerArm: { value: number };
  };
}
export interface GraphSpatialNodePresentation extends NodeViewport {
  readonly state: Lyra3dState;
}
/** Native resources only; semantic batch state is deliberately not reachable through this record. */
export interface GraphSpatialNodeResources {
  readonly geometry: InstancedBufferGeometry;
  readonly material: ShaderMaterial;
  readonly pickMaterial: ShaderMaterial;
  readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>;
  readonly pick: Mesh<InstancedBufferGeometry, ShaderMaterial>;
  disposed: boolean;
}
export interface GraphPreparedSpatialNodes {
  readonly batch: ReturnType<typeof createGraphSpatialNodes>;
  readonly resources: GraphSpatialNodeResources;
  readonly ownedBuffers: readonly ArrayBufferLike[];
  readonly borrowedBuffers: readonly ArrayBufferLike[];
}
export interface GraphSpatialNodeWorkStep {
  readonly done: boolean;
  readonly operations: number;
  readonly allocatedBytes: number;
  readonly initializedRows: number;
  readonly value?: GraphPreparedSpatialNodes;
}
export interface GraphSpatialNodeWork {
  step(maxOperations: number): GraphSpatialNodeWorkStep;
  dispose(): void;
}

/** Retires a detached native owner without retaining its batch, graph or viewport. */
export function disposeGraphSpatialNodeResources(resources: GraphSpatialNodeResources): void {
  if (resources.disposed) return;
  resources.disposed = true;
  disposeAll([
    () => resources.mesh.removeFromParent(), () => resources.pick.removeFromParent(),
    () => resources.material.dispose(), () => resources.pickMaterial.dispose(), () => resources.geometry.dispose(),
  ]);
}

// This callback's environment contains only native resources and fixed uniform values.
function nodePickHook(viewportSize: Vector2, pickViewportSize: Vector2, material: ShaderMaterial): Mesh['onBeforeRender'] {
  return (_renderer, _scene, camera) => {
    const view = camera instanceof PerspectiveCamera ? camera.view : null;
    pickViewportSize.copy(viewportSize);
    if (view?.enabled) pickViewportSize.set(viewportSize.x * view.width / view.fullWidth, viewportSize.y * view.height / view.fullHeight);
    material.uniformsNeedUpdate = true;
  };
}
function nodeUniforms(worldSize: boolean): NodeUniforms {
  const viewportSize = new Vector2(1, 1), pickViewportSize = new Vector2(1, 1), lyraView = new Vector4(1, 1, 0.5, 1e4);
  return { viewportSize, pickViewportSize, lyraView,
    shared: { lyraView: { value: lyraView }, worldSizes: { value: worldSize ? 1 : 0 }, markerArm: { value: 3 } } };
}
const directPaintColor: PaintColors = (value, target) => target.setRGB(value.r, value.g, value.b, SRGBColorSpace);

function createNodeController(columns: NodeColumns, resources: GraphSpatialNodeResources, attributes: NodeAttributes, partialRows: Uint8Array, uniforms: NodeUniforms) {
  const { count, shapes, expandable, colors, sizes, categories, opacity, meshes } = columns;
  const { mesh, pick, material } = resources;
  const { nodePosition: position, nodeSize: size, nodeShape: shape, nodeFlags: flags, nodeFill: fill, nodeRing: ring, nodeMarker: marker, pickColor } = attributes;
  const { viewportSize, lyraView, shared } = uniforms;
  const color = new Color(); let translucent = false, revision = 0, forcedColors = false;
  let partialCount = 0, fullChange = true, denseChange = false;
  const changedRows = new Set<number>();
  const setView = (viewport: NodeView) => {
    const next = graphSpatialView(viewport.width, viewport.height, viewport.orbit);
    viewportSize.set(next.width, next.height); lyraView.set(next.width, next.height, next.near, next.far);
  };
  type RecordRow = (buffer: InstancedBufferAttribute, row: number) => void;
  const write2 = (buffer: InstancedBufferAttribute, row: number, a: number, b: number, full: boolean, record: RecordRow) => {
    const offset = row * 2;
    if (!full && buffer.array[offset] === a && buffer.array[offset + 1] === b) return;
    buffer.array[offset] = a; buffer.array[offset + 1] = b; record(buffer, row);
  };
  const writePaint = (buffer: InstancedBufferAttribute, row: number, value: Lyra3dRgba, alpha: number, full: boolean, record: RecordRow, paintColor: PaintColors) => {
    paintColor(value, color);
    const offset = row * 4, r = Math.fround(color.r), g = Math.fround(color.g), b = Math.fround(color.b), a = Math.fround(value.a * alpha);
    if (!full && buffer.array[offset] === r && buffer.array[offset + 1] === g && buffer.array[offset + 2] === b && buffer.array[offset + 3] === a) return;
    buffer.array[offset] = r; buffer.array[offset + 1] = g; buffer.array[offset + 2] = b; buffer.array[offset + 3] = a; record(buffer, row);
  };
  const partial = (value: number) => value > 0 && value < 1;
  const paintRow = (style: ResolvedLyra3dStyle, state: Lyra3dState, row: number, full: boolean, record: RecordRow, paintColor: PaintColors) => {
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
    write2(flags, row, selected ? 1 : 0, expanded ? 1 : 0, full, record);
    writePaint(fill, row, source, alpha, full, record, paintColor);
    writePaint(ring, row, style.accent, alpha, full, record, paintColor);
    writePaint(marker, row, style.foreground, alpha, full, record, paintColor);
  };
  const materialState = () => {
    translucent = partialCount > 0;
    if (material.transparent !== translucent) { material.transparent = translucent; material.needsUpdate = true; }
    material.depthWrite = !translucent;
  };
  const fullPaintChange = () => {
    for (const buffer of [flags, fill, ring, marker, ...(meshes ? [shape] : [])]) markAttributeFull(buffer);
    fullChange = true; denseChange = false; changedRows.clear();
  };
  const paint = (viewport: NodeViewport, state: Lyra3dState, rows: VisualStateRows, full: boolean) => {
    const style = viewport.style, dense = rows === null; forcedColors = style.forcedColors;
    const paintColor = createPaintColors(style);
    const dirty = new Map<InstancedBufferAttribute, number[]>();
    const touched = new Set<InstancedBufferAttribute>();
    const record: RecordRow = (buffer, row) => {
      if (full) return;
      touched.add(buffer);
      if (dense) return;
      const list = dirty.get(buffer) ?? []; list.push(row); dirty.set(buffer, list);
      if (!fullChange && !denseChange) changedRows.add(row);
    };
    for (let index = 0, length = rows?.length ?? count; index < length; index++) {
      const row = rows === null ? index : rows[index]!;
      if (!Number.isInteger(row) || row < 0 || row >= count) continue;
      paintRow(style, state, row, full, record, paintColor);
    }
    materialState();
    if (full) fullPaintChange();
    else if (dense) for (const buffer of touched) markAttributeFull(buffer);
    else for (const [buffer, changed] of dirty) markAttributeRows(buffer, changed);
    if (!full && dense && touched.size && !fullChange) { denseChange = true; changedRows.clear(); }
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
  const initializeIdentity = (row: number) => {
    const id = row + 1;
    pickColor.setXYZ(row, (id & 0xff) / 255, ((id >> 8) & 0xff) / 255, ((id >> 16) & 0xff) / 255);
    shape.setX(row, meshes?.nodeMeshes[row] ? -1 : shapes?.[row] ?? 0);
  };
  const ignoreRecord: RecordRow = () => {};
  const batch = {
    mesh, pick,
    /** Retained node columns and the owned paint mask; geometry backing is inventoried separately. */
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
    setView(viewport: NodeView) { if (!resources.disposed) setView(viewport); },
    updatePositions(viewport: NodeView, positions: Float32Array) { if (!resources.disposed) updatePositions(viewport, positions); },
    updateStyle(viewport: NodeViewport, state: Lyra3dState) { if (!resources.disposed) updateStyle(viewport, state); },
    updateState(viewport: NodeViewport, state: Lyra3dState, rows: VisualStateRows) { if (!resources.disposed) paint(viewport, state, rows, false); },
    update(viewport: NodeViewport, positions: Float32Array, state: Lyra3dState) {
      if (resources.disposed) return;
      const previousRevision = revision;
      updatePositions(viewport, positions); updateStyle(viewport, state);
      revision = previousRevision + 1;
    },
    dispose() { disposeGraphSpatialNodeResources(resources); },
  };
  return {
    batch, initializeIdentity,
    initializeRow(row: number, positions: Float32Array, viewport: NodeViewport, state: Lyra3dState) {
      initializeIdentity(row);
      position.setXYZ(row, positions[row * 3]!, positions[row * 3 + 1]!, positions[row * 3 + 2]!);
      size.setX(row, (sizes?.[row] ?? viewport.style.pointSize) / 2);
      paintRow(viewport.style, state, row, true, ignoreRecord, directPaintColor);
    },
    finishInitialization(viewport: NodeViewport) {
      setView(viewport); shared.markerArm.value = Math.max(3, viewport.style.fontSize / 4);
      forcedColors = viewport.style.forcedColors;
      markAttributeFull(position); markAttributeFull(size); materialState(); fullPaintChange(); revision = 1;
    },
  };
}

interface NodeAssembly {
  columns: NodeColumns | undefined;
  stage: number;
  buffers: Float32Array[];
  partialRows: Uint8Array | undefined;
  plane: PlaneGeometry | undefined;
  geometry: InstancedBufferGeometry | undefined;
  attributes: NodeAttributes | undefined;
  uniforms: NodeUniforms | undefined;
  material: ShaderMaterial | undefined;
  pickMaterial: ShaderMaterial | undefined;
  mesh: Mesh<InstancedBufferGeometry, ShaderMaterial> | undefined;
  pick: Mesh<InstancedBufferGeometry, ShaderMaterial> | undefined;
  resources: GraphSpatialNodeResources | undefined;
  controller: ReturnType<typeof createNodeController> | undefined;
}
function nodeAssembly(columns: NodeColumns): NodeAssembly {
  return { columns, stage: 0, buffers: [], partialRows: undefined, plane: undefined, geometry: undefined,
    attributes: undefined, uniforms: undefined, material: undefined, pickMaterial: undefined, mesh: undefined, pick: undefined,
    resources: undefined, controller: undefined };
}
/** One proportional backing or one fixed wrapper construction per visit. */
function advanceNodeAssembly(owner: NodeAssembly): number {
  const columns = owner.columns!, count = columns.count;
  let allocatedBytes = 0;
  if (owner.stage < 8) {
    const buffer = new Float32Array(count * NODE_ATTRIBUTES[owner.stage]![1]);
    owner.buffers.push(buffer); allocatedBytes = buffer.byteLength;
  } else switch (owner.stage) {
    case 8:
      owner.partialRows = new Uint8Array(count); allocatedBytes = owner.partialRows.byteLength;
      break;
    case 9: {
      const plane = new PlaneGeometry(2, 2); owner.plane = plane;
      allocatedBytes = plane.index!.array.byteLength + plane.getAttribute('position').array.byteLength
        + plane.getAttribute('normal').array.byteLength + plane.getAttribute('uv').array.byteLength;
      break;
    }
    case 10: {
      const plane = owner.plane!, geometry = new InstancedBufferGeometry(); owner.geometry = geometry;
      geometry.index = plane.index; geometry.attributes = { ...plane.attributes }; geometry.instanceCount = count;
      // Relinquish the temporary handle before a disposal listener can throw or reenter.
      owner.plane = undefined; plane.dispose();
      break;
    }
    case 11: {
      const attributes = {} as NodeAttributes; owner.attributes = attributes;
      for (let index = 0; index < NODE_ATTRIBUTES.length; index++) {
        const [name, components] = NODE_ATTRIBUTES[index]!;
        const attribute = new InstancedBufferAttribute(owner.buffers[index]!, components);
        attributes[name] = attribute; owner.geometry!.setAttribute(name, attribute);
      }
      owner.uniforms = nodeUniforms(columns.worldSize);
      break;
    }
    case 12: {
      const uniforms = owner.uniforms!;
      owner.material = new ShaderMaterial({ side: DoubleSide, forceSinglePass: true,
        uniforms: { ...uniforms.shared, viewportSize: { value: uniforms.viewportSize } }, vertexShader: vertex, fragmentShader: fragment });
      break;
    }
    case 13: {
      const uniforms = owner.uniforms!;
      owner.pickMaterial = new ShaderMaterial({ side: DoubleSide, forceSinglePass: true,
        uniforms: { ...uniforms.shared, viewportSize: { value: uniforms.pickViewportSize } }, defines: { PICKING: 1 },
        vertexShader: vertex, fragmentShader: fragment, toneMapped: false });
      break;
    }
    case 14:
      owner.mesh = new Mesh(owner.geometry!, owner.material!);
      break;
    case 15: {
      const mesh = owner.mesh!, pick = new Mesh(owner.geometry!, owner.pickMaterial!); owner.pick = pick;
      mesh.frustumCulled = pick.frustumCulled = false;
      const uniforms = owner.uniforms!;
      pick.onBeforeRender = nodePickHook(uniforms.viewportSize, uniforms.pickViewportSize, owner.pickMaterial!);
      owner.resources = { geometry: owner.geometry!, material: owner.material!, pickMaterial: owner.pickMaterial!, mesh, pick, disposed: false };
      break;
    }
    case 16:
      owner.controller = createNodeController(columns, owner.resources!, owner.attributes!, owner.partialRows!, owner.uniforms!);
      break;
  }
  owner.stage++;
  return allocatedBytes;
}
function clearNodeAssembly(owner: NodeAssembly): void {
  owner.columns = undefined; owner.buffers = []; owner.partialRows = undefined; owner.plane = undefined;
  owner.geometry = undefined; owner.attributes = undefined; owner.uniforms = undefined; owner.material = undefined;
  owner.pickMaterial = undefined; owner.mesh = undefined; owner.pick = undefined; owner.resources = undefined; owner.controller = undefined;
}
function retireNodeAssembly(owner: NodeAssembly): void {
  const { resources, plane, geometry, material, pickMaterial, mesh, pick } = owner;
  clearNodeAssembly(owner);
  if (resources) disposeGraphSpatialNodeResources(resources);
  else disposeAll([
    () => mesh?.removeFromParent(), () => pick?.removeFromParent(), () => plane?.dispose(),
    () => material?.dispose(), () => pickMaterial?.dispose(), () => geometry?.dispose(),
  ]);
}

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
  const owner = nodeAssembly({ count, shapes, expandable, colors, sizes, categories, opacity, worldSize: appearance.sizeUnits === 'world', meshes });
  try {
    while (owner.stage < 17) advanceNodeAssembly(owner);
    const controller = owner.controller!;
    for (let row = 0; row < count; row++) controller.initializeIdentity(row);
    clearNodeAssembly(owner);
    return controller.batch;
  } catch (error) {
    try { retireNodeAssembly(owner); } catch { /* Preserve the construction error after attempting every acquired resource. */ }
    throw error;
  }
}

interface NodeWorkState {
  data: GraphPreparedDataColumns | undefined;
  presentation: GraphSpatialNodePresentation | undefined;
  guard: (() => boolean) | undefined;
  owner: NodeAssembly | undefined;
  active: boolean;
  row: number;
}
/**
 * Prepares detached glyphs from owned spatial columns and a resolved, owned presentation snapshot.
 * Inputs remain unchanged while borrowed. Native backing allocation and fixed Three constructors
 * are indivisible; each row initializes a fixed set of attributes without a whole-scene update.
 */
export function createGraphSpatialNodesWork(data: GraphPreparedDataColumns, presentation: GraphSpatialNodePresentation, isCurrent?: () => boolean): GraphSpatialNodeWork {
  const state: NodeWorkState = { data, presentation, guard: isCurrent, owner: undefined, active: true, row: 0 };
  data = undefined as never; presentation = undefined as never; isCurrent = undefined;
  let running = false;
  const checkpoint = (): void => {
    const current = state.active && (!state.guard || state.guard());
    if (!current || !state.active) {
      const error = new Error('Graph spatial node preparation was superseded'); error.name = 'AbortError'; throw error;
    }
  };
  const close = (): void => {
    state.active = false; state.data = undefined; state.presentation = undefined; state.guard = undefined;
    if (running) return;
    const owner = state.owner; state.owner = undefined;
    if (owner) retireNodeAssembly(owner);
  };
  return {
    step(maxOperations) {
      if (!state.active || running) throw new DOMException('Graph spatial node preparation is closed or running', 'InvalidStateError');
      if (!Number.isSafeInteger(maxOperations) || maxOperations < 1) throw new RangeError('Invalid graph spatial node preparation budget');
      let operations = 0, allocatedBytes = 0, initializedRows = 0;
      running = true;
      try {
        while (operations < maxOperations) {
          checkpoint();
          if (!state.owner) {
            const input = state.data!, appearance = input.spatialAppearance;
            if (!appearance) throw new TypeError('Invalid spatial node appearance');
            state.owner = nodeAssembly({ count: input.nodeCount, shapes: appearance.nodeShapes, expandable: appearance.expandable,
              colors: appearance.nodeColors, sizes: input.sizes, categories: input.categories, opacity: appearance.dimmedOpacity ?? 0.35,
              worldSize: appearance.sizeUnits === 'world', meshes: graphSpatialNodeMeshData(appearance) });
          } else if (state.owner.stage < 17) allocatedBytes += advanceNodeAssembly(state.owner);
          else if (state.row < state.owner.columns!.count) {
            const view = state.presentation!;
            state.owner.controller!.initializeRow(state.row++, state.data!.positions, view, view.state); initializedRows++;
          } else {
            const owner = state.owner, columns = owner.columns!, controller = owner.controller!, resources = owner.resources!;
            controller.finishInitialization(state.presentation!);
            const geometry = resources.geometry;
            const ownedBuffers: ArrayBufferLike[] = [geometry.index!.array.buffer, geometry.getAttribute('position').array.buffer,
              geometry.getAttribute('normal').array.buffer, geometry.getAttribute('uv').array.buffer,
              ...owner.buffers.map(buffer => buffer.buffer), owner.partialRows!.buffer];
            const borrowedBuffers = [...new Set([columns.shapes, columns.expandable, columns.colors, columns.sizes, columns.categories]
              .filter(value => value !== undefined).map(value => value.buffer))];
            const value: GraphPreparedSpatialNodes = { batch: controller.batch, resources, ownedBuffers, borrowedBuffers };
            operations++; checkpoint();
            state.owner = undefined; clearNodeAssembly(owner); close();
            return { done: true, operations, allocatedBytes, initializedRows, value };
          }
          operations++; checkpoint();
        }
        return { done: false, operations, allocatedBytes, initializedRows };
      } catch (error) {
        state.active = false; state.data = undefined; state.presentation = undefined; state.guard = undefined;
        const owner = state.owner; state.owner = undefined;
        try { if (owner) retireNodeAssembly(owner); } catch { /* Keep the operation error after every acquired resource was attempted. */ }
        throw error;
      } finally { running = false; }
    },
    dispose: close,
  };
}
