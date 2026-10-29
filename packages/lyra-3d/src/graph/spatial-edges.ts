import { disposeAll } from '../core/dispose.js';
import { DoubleSide, Color, DataTexture, FloatType, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, NearestFilter, NoBlending, PerspectiveCamera, PlaneGeometry, RedFormat, ShaderMaterial, SRGBColorSpace, Vector4 } from 'three';
import { markAttributeFull, markAttributeRows } from '../core/attribute-updates.js';
import type { VisualStateRows } from '../core/visual-state.js';
import { createPaintColors, type PaintColors } from '../core/paint-colors.js';
import type { Lyra3dState, Lyra3dWorldPoint } from '../core/contract.js';
import { encodePickId } from '../core/picking.js';
import type { Lyra3dViewport } from '../core/viewport.js';
import type { GraphPreparedDataColumns } from './data-preparation.js';
import type { GraphSceneFacts } from './scene-facts-work.js';
import { validateGraphSpatialSizes } from './spatial-appearance.js';
import { GRAPH_ARROW_HALF_ANGLE, GRAPH_MAX_SPATIAL_PRIMITIVES, graphSpatialEdgeVertexChunk, graphSpatialProjectionChunk, graphSpatialView, spatialCurvePoint, spatialEdgeSegments, spatialPrimitiveCount, type GraphPositionLookup, type GraphSpatialData } from './spatial-paths.js';

type EdgeView = Pick<Lyra3dViewport, 'width' | 'height' | 'orbit'>;
const vertex = graphSpatialProjectionChunk + graphSpatialEdgeVertexChunk + `
attribute vec3 edgeStart; attribute vec3 edgeEnd; attribute vec4 edgePath; attribute vec3 stroke;
attribute vec4 edgeColor; attribute vec3 pickColor; attribute float dash; attribute float edgeCurvature;
void main(){ graphSpatialEdgeVertex(edgeStart, edgeEnd, edgePath, stroke, edgeColor, pickColor, dash, edgeCurvature); }`;
export const graphSpatialEdgeFragment = `
uniform sampler2D dashAtlas; uniform float atlasHeight;
varying vec4 tint; varying vec2 pattern; varying vec3 arrowUv; varying vec3 cap; varying float strokeRadius; flat varying vec2 depthEnds;
float readDash(float offset){float index=pattern.x*64.0+offset;return texture2D(dashAtlas,vec2((mod(index,2048.0)+0.5)/2048.0,(floor(index/2048.0)+0.5)/atlasHeight)).r;}
void paintGraphSpatialEdge(){
  #ifdef PICKING
    float outside=max(-cap.x,cap.x-cap.z);
    if(outside>0.0 && outside*outside+cap.y*cap.y>strokeRadius*strokeRadius)discard;
    // Equal endpoints must stay exactly equal: weighted-sum mix can round a tie.
    gl_FragDepth=depthEnds.x+(depthEnds.y-depthEnds.x)*clamp(cap.x/max(cap.z,0.0001),0.0,1.0);
  #endif
  if(arrowUv.z>0.5 && abs(arrowUv.y*2.0-1.0)>1.0-arrowUv.x)discard;
  #ifndef PICKING
    float count=readDash(0.0),sum=readDash(1.0);
    if(count>0.0 && sum>0.0){
      float cycle=sum*(mod(count,2.0)>0.5?2.0:1.0);
      float cursor=mod(pattern.y,cycle),parity=0.0;
      if(cursor>=sum){cursor-=sum;parity=1.0;}
      for(int i=0;i<32;i++){if(float(i)>=count)break;float length=readDash(float(i)+2.0);if(cursor<length){if(mod(float(i)+parity,2.0)>0.5)discard;break;}cursor-=length;}
    }
  #endif
  gl_FragColor=tint;
  #ifndef PICKING
    #include <colorspace_fragment>
  #endif
}`;
const fragment = graphSpatialEdgeFragment + '\nvoid main() { paintGraphSpatialEdge(); }';
const DANGLING_REACH = 28;

type EdgeViewport = EdgeView & Pick<Lyra3dViewport, 'style'>;
export interface GraphSpatialEdgePresentation extends EdgeViewport { readonly state: Lyra3dState; }
/** Native resources only, without the semantic edge controller or its position lookup. */
export interface GraphSpatialEdgeResources {
  readonly geometry: InstancedBufferGeometry;
  readonly material: ShaderMaterial;
  readonly pickMaterial: ShaderMaterial;
  readonly texture: DataTexture;
  readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>;
  readonly pick: Mesh<InstancedBufferGeometry, ShaderMaterial>;
  disposed: boolean;
}
export interface GraphPreparedSpatialEdges {
  readonly batch: ReturnType<typeof createGraphSpatialEdges>;
  readonly resources: GraphSpatialEdgeResources;
  readonly ownedBuffers: readonly ArrayBufferLike[];
  readonly borrowedBuffers: readonly ArrayBufferLike[];
}
export interface GraphSpatialEdgeWorkStep {
  readonly done: boolean;
  readonly operations: number;
  readonly allocatedBytes: number;
  readonly visitedEdges: number;
  readonly initializedPrimitives: number;
  readonly copiedDashValues: number;
  readonly value?: GraphPreparedSpatialEdges;
}
export interface GraphSpatialEdgeWork { step(maxOperations: number): GraphSpatialEdgeWorkStep; dispose(): void; }

/** Retires a detached native owner without retaining its batch, graph or viewport. */
export function disposeGraphSpatialEdgeResources(resources: GraphSpatialEdgeResources): void {
  if (resources.disposed) return;
  resources.disposed = true;
  disposeAll([
    () => resources.mesh.removeFromParent(), () => resources.pick.removeFromParent(), () => resources.geometry.dispose(),
    () => resources.material.dispose(), () => resources.pickMaterial.dispose(), () => resources.texture.dispose(),
  ]);
}
function edgePickHook(window: Vector4, pickWindow: Vector4, material: ShaderMaterial): Mesh['onBeforeRender'] {
  return (_renderer, _scene, camera) => {
    const view = camera instanceof PerspectiveCamera ? camera.view : null;
    if (view?.enabled) pickWindow.set(view.offsetX, view.offsetY, view.width, view.height); else pickWindow.copy(window);
    material.uniformsNeedUpdate = true;
  };
}
function edgePositionLookup(positions: Float32Array): GraphPositionLookup {
  return row => ({ x: positions[row * 3]!, y: positions[row * 3 + 1]!, z: positions[row * 3 + 2]! });
}
const edgeAttributeLayout = [
  ['edgeStart', 3], ['edgeEnd', 3], ['edgePath', 4], ['stroke', 3],
  ['edgeColor', 4], ['pickColor', 3], ['dash', 1], ['edgeCurvature', 1],
] as const;
type EdgeAttributes = Record<(typeof edgeAttributeLayout)[number][0], InstancedBufferAttribute>;
interface EdgeStorage {
  anchors: Float32Array;
  patternRows: Uint32Array;
  offsets: Uint32Array;
  valid: Uint8Array;
  partialRows: Uint8Array;
  values: Float32Array;
}
interface EdgeUniforms {
  window: Vector4;
  pickWindow: Vector4;
  lyraView: Vector4;
  shared: { lyraView: { value: Vector4 }; worldSizes: { value: number } };
}
function edgeUniforms(worldSizes: boolean): EdgeUniforms {
  const window = new Vector4(0, 0, 1, 1), pickWindow = new Vector4(0, 0, 1, 1), lyraView = new Vector4(1, 1, 0.5, 1e4);
  return { window, pickWindow, lyraView, shared: { lyraView: { value: lyraView }, worldSizes: { value: worldSizes ? 1 : 0 } } };
}
interface EdgeIdentity { segments: number; id: readonly number[]; bend: number; pattern: number; }
function edgeIdentity(data: GraphSpatialData, edge: number, pattern: number): EdgeIdentity {
  return { segments: spatialEdgeSegments(data, edge), id: encodePickId(data.nodeCount + edge)!, pattern,
    bend: !data.spatialAppearance.dangling?.[edge] && data.source[edge] !== data.target[edge] ? data.spatialAppearance.edgeCurvatures?.[edge] ?? 0 : 0 };
}
function initializeEdgeIdentity(attributes: EdgeAttributes, index: number, primitive: number, identity: EdgeIdentity): void {
  const { segments, id, bend, pattern } = identity, arrow = primitive === segments;
  attributes.pickColor.setXYZ(index, id[0]! / 255, id[1]! / 255, id[2]! / 255);
  attributes.dash.setX(index, arrow ? 0 : pattern); attributes.edgeCurvature.setX(index, bend);
  attributes.edgePath.setXY(index, arrow ? 1 - 1 / segments : primitive / segments, arrow ? 1 : (primitive + 1) / segments);
}
interface EdgePosition {
  a: Lyra3dWorldPoint | null;
  b: Lyra3dWorldPoint | null;
  loop: boolean;
  loopRadius: number;
  targetRadius: number;
}
interface EdgePaint { r: number; g: number; b: number; a: number; bodyWidth: number; pickWidth: number; headWidth: number; }
interface EdgeInitialization { edge: number; identity: EdgeIdentity; position: EdgePosition; paint: EdgePaint; }
type RecordPrimitive = (attribute: InstancedBufferAttribute, index: number) => void;
const noPrimitiveChange: RecordPrimitive = () => {};
const directEdgePaint: PaintColors = (value, target) => target.setRGB(value.r, value.g, value.b, SRGBColorSpace);

function createEdgeController(data: GraphSpatialData, resources: GraphSpatialEdgeResources, attributes: EdgeAttributes, storage: EdgeStorage, uniforms: EdgeUniforms, styleRadius: boolean) {
  const appearance = data.spatialAppearance, worldSizes = appearance.sizeUnits === 'world';
  const { mesh, pick, material } = resources;
  const { edgeStart: start, edgeEnd: end, edgePath: path, stroke, edgeColor: colors, edgeCurvature: curvature } = attributes;
  const { anchors, patternRows, offsets, valid, partialRows, values } = storage;
  const { window, lyraView } = uniforms;
  const color = new Color(); let translucent = false, revision = 0;
  let partialCount = 0, fullChange = true, denseChange = false;
  const changedRows = new Set<number>();
  let lookup: GraphPositionLookup | undefined;
  let positionPointSize: number | undefined;
  let lastState: Lyra3dState | undefined;
  const setView = (viewport: EdgeView) => {
    const next = graphSpatialView(viewport.width, viewport.height, viewport.orbit);
    window.set(0, 0, viewport.width, viewport.height); lyraView.set(next.width, next.height, next.near, next.far);
  };
  const anchor = (index: number, x: number, y: number, z: number) => { anchors[index * 3] = x; anchors[index * 3 + 1] = y; anchors[index * 3 + 2] = z; };
  const positionRow = (edge: number, viewport: EdgeViewport, position: GraphPositionLookup): EdgePosition => {
    const source = data.source[edge]!, dangling = appearance.dangling?.[edge] === 1;
    const a = position(source), loop = !dangling && source === data.target[edge];
    const b = !a ? null : dangling ? { x: a.x + DANGLING_REACH, y: a.y - DANGLING_REACH, z: a.z } : loop ? a : position(data.target[edge]!);
    valid[edge] = Number(a !== null && b !== null);
    return { a, b, loop, loopRadius: loop ? (data.sizes?.[source] ?? viewport.style.pointSize) / 2 * 1.6 : 0,
      targetRadius: !dangling ? (data.sizes?.[data.target[edge]!] ?? viewport.style.pointSize) / 2 : 0 };
  };
  const positionPrimitive = (index: number, arrow: boolean, position: EdgePosition) => {
    const { a, b, loop, loopRadius, targetRadius } = position, t0 = path.getX(index), t1 = path.getY(index);
    start.setXYZ(index, a?.x ?? 0, a?.y ?? 0, a?.z ?? 0); end.setXYZ(index, b?.x ?? 0, b?.y ?? 0, b?.z ?? 0);
    path.setZ(index, loopRadius); path.setW(index, arrow ? targetRadius : 0);
    if (arrow) { if (b) anchor(index, b.x, b.y, b.z); else anchor(index, 0, 0, 0); }
    else if (!a || !b) anchor(index, 0, 0, 0);
    else if (loop && worldSizes) {
      const mid = (t0 + t1) * Math.PI;
      anchor(index, a.x + Math.sin(mid) * loopRadius, a.y - (1 - Math.cos(mid)) * loopRadius, a.z);
    } else if (!loop && curvature.getX(index) !== 0) {
      const point = spatialCurvePoint(a, b, curvature.getX(index), (t0 + t1) / 2);
      anchor(index, point.x, point.y, point.z);
    } else {
      const mid = loop ? 0 : (t0 + t1) / 2;
      anchor(index, a.x + (b.x - a.x) * mid, a.y + (b.y - a.y) * mid, a.z + (b.z - a.z) * mid);
    }
  };
  const paintRow = (edge: number, viewport: EdgeViewport, state: Lyra3dState, paintColor: PaintColors): EdgePaint => {
    const style = viewport.style, item = data.nodeCount + edge;
    const selected = state.selected.has(item) || state.hover === item;
    const raw = appearance.edgeColors, dangling = appearance.dangling?.[edge] === 1;
    const rgba = selected ? style.accent : style.forcedColors ? style.foreground : raw ? { r: raw[edge * 4]!, g: raw[edge * 4 + 1]!, b: raw[edge * 4 + 2]!, a: raw[edge * 4 + 3]! } : style.muted;
    paintColor(rgba, color);
    const alpha = rgba.a * (!style.forcedColors && state.dimmed.has(item) ? appearance.dimmedOpacity ?? 0.35 : 1);
    const baseWidth = appearance.edgeWidths?.[edge] ?? style.lineWidth;
    const eligible = valid[edge] === 1 && baseWidth > 0 && (raw?.[edge * 4 + 3] ?? style.muted.a) > 0;
    const visible = eligible && alpha > 0, nextPartial = visible && alpha < 1 ? 1 : 0;
    partialCount += nextPartial - partialRows[edge]!; partialRows[edge] = nextPartial;
    const head = Math.max(6, (baseWidth + (selected ? 2 : 0)) * 3);
    return { r: Math.fround(color.r), g: Math.fround(color.g), b: Math.fround(color.b), a: Math.fround(alpha),
      bodyWidth: visible ? baseWidth + (selected ? 2 : 0) : 0, pickWidth: eligible && !dangling ? Math.max(12, baseWidth) : 0,
      headWidth: visible ? head * Math.tan(GRAPH_ARROW_HALF_ANGLE) * 2 : 0 };
  };
  const paintPrimitive = (index: number, arrow: boolean, paint: EdgePaint, full: boolean, record: RecordPrimitive) => {
    const { r, g, b, a } = paint, offset = index * 4;
    if (full || colors.array[offset] !== r || colors.array[offset + 1] !== g || colors.array[offset + 2] !== b || colors.array[offset + 3] !== a) {
      colors.array[offset] = r; colors.array[offset + 1] = g; colors.array[offset + 2] = b; colors.array[offset + 3] = a; record(colors, index);
    }
    const strokeOffset = index * 3, w = Math.fround(arrow ? paint.headWidth : paint.bodyWidth), p = Math.fround(arrow ? 0 : paint.pickWidth), flag = Number(arrow);
    if (full || stroke.array[strokeOffset] !== w || stroke.array[strokeOffset + 1] !== p || stroke.array[strokeOffset + 2] !== flag) {
      stroke.array[strokeOffset] = w; stroke.array[strokeOffset + 1] = p; stroke.array[strokeOffset + 2] = flag; record(stroke, index);
    }
  };
  const finishPaint = () => {
    translucent = partialCount > 0;
    if (material.transparent !== translucent) { material.transparent = translucent; material.needsUpdate = true; }
    material.depthWrite = !translucent;
  };
  const paint = (viewport: EdgeViewport, state: Lyra3dState, rows: VisualStateRows, full: boolean) => {
    lastState = state;
    const dense = rows === null, paintColor = createPaintColors(viewport.style);
    const dirty = new Map<InstancedBufferAttribute, number[]>(), touched = new Set<InstancedBufferAttribute>();
    const record: RecordPrimitive = (buffer, index) => {
      if (full) return;
      touched.add(buffer);
      if (dense) return;
      const list = dirty.get(buffer) ?? []; list.push(index); dirty.set(buffer, list);
      if (!fullChange && !denseChange) changedRows.add(index);
    };
    for (let row = 0, length = rows?.length ?? data.source.length; row < length; row++) {
      const edge = rows === null ? row : rows[row]! - data.nodeCount;
      if (!Number.isInteger(edge) || edge < 0 || edge >= data.source.length) continue;
      const coefficients = paintRow(edge, viewport, state, paintColor), segments = spatialEdgeSegments(data, edge);
      for (let index = offsets[edge]!; index < offsets[edge + 1]!; index++) paintPrimitive(index, index - offsets[edge]! === segments, coefficients, full, record);
    }
    finishPaint();
    if (full) for (const buffer of [colors, stroke]) markAttributeFull(buffer);
    else if (dense) for (const buffer of touched) markAttributeFull(buffer);
    else for (const [buffer, changed] of dirty) markAttributeRows(buffer, changed);
    if (full) { fullChange = true; denseChange = false; changedRows.clear(); }
    else if (dense && touched.size && !fullChange) { denseChange = true; changedRows.clear(); }
    if (touched.size || full) revision++;
  };
  const updatePositions = (viewport: EdgeViewport, position: GraphPositionLookup) => {
    lookup = position; setView(viewport);
    const validityChanges: number[] = [];
    for (let edge = 0; edge < data.source.length; edge++) {
      const previous = valid[edge], coefficients = positionRow(edge, viewport, position);
      if (previous !== valid[edge]) validityChanges.push(data.nodeCount + edge);
      const segments = spatialEdgeSegments(data, edge);
      for (let index = offsets[edge]!; index < offsets[edge + 1]!; index++) positionPrimitive(index, index - offsets[edge]! === segments, coefficients);
    }
    for (const buffer of [start, end, path]) markAttributeFull(buffer);
    positionPointSize = viewport.style.pointSize; fullChange = true; revision++;
    if (lastState && validityChanges.length) paint(viewport, lastState, validityChanges, false);
  };
  const updateStyle = (viewport: EdgeViewport, state: Lyra3dState, positionsUnchanged: boolean) => {
    // Stable positions still need a refresh when default loop or arrow radii change.
    if (lookup && (!positionsUnchanged || (styleRadius && positionPointSize !== viewport.style.pointSize))) updatePositions(viewport, lookup);
    else setView(viewport);
    paint(viewport, state, null, true);
  };
  const batch = { mesh, pick, anchors,
    /** Retained path lookup, atlas and validity storage beyond geometry attributes. */
    allocationBuffers(): readonly ArrayBufferLike[] { return [...new Set([anchors, patternRows, offsets, valid, partialRows, values].map(value => value.buffer))]; },
    get translucent() { return translucent; }, get revision() { return revision; },
    takeChanges(): { full: boolean; rows: VisualStateRows } {
      const result = { full: fullChange, rows: fullChange ? [] : denseChange ? null : [...changedRows] };
      fullChange = false; denseChange = false; changedRows.clear(); return result;
    },
    setView(viewport: EdgeView) { if (!resources.disposed) setView(viewport); },
    updatePositions(viewport: EdgeViewport, position: GraphPositionLookup) { if (!resources.disposed) updatePositions(viewport, position); },
    updateStyle(viewport: EdgeViewport, state: Lyra3dState, positionsUnchanged = false) { if (!resources.disposed) updateStyle(viewport, state, positionsUnchanged); },
    updateState(viewport: EdgeViewport, state: Lyra3dState, rows: VisualStateRows) { if (!resources.disposed) paint(viewport, state, rows, false); },
    update(viewport: EdgeViewport, position: GraphPositionLookup, state: Lyra3dState) {
      if (resources.disposed) return;
      const previousRevision = revision;
      updatePositions(viewport, position); paint(viewport, state, null, true); revision = previousRevision + 1;
    },
    dispose() { disposeGraphSpatialEdgeResources(resources); },
  };
  return { batch,
    initializeEdge(edge: number, view: GraphSpatialEdgePresentation, position: GraphPositionLookup): EdgeInitialization {
      const coefficients = positionRow(edge, view, position);
      return { edge, position: coefficients, identity: edgeIdentity(data, edge, patternRows[edge]!), paint: paintRow(edge, view, view.state, directEdgePaint) };
    },
    initializePrimitive(row: EdgeInitialization, primitive: number) {
      const index = offsets[row.edge]! + primitive, arrow = primitive === row.identity.segments;
      initializeEdgeIdentity(attributes, index, primitive, row.identity);
      positionPrimitive(index, arrow, row.position); paintPrimitive(index, arrow, row.paint, true, noPrimitiveChange);
    },
    finishInitialization(view: GraphSpatialEdgePresentation, position: GraphPositionLookup) {
      lookup = position; lastState = view.state; positionPointSize = view.style.pointSize; setView(view); finishPaint();
      for (const attribute of [start, end, path, colors, stroke]) markAttributeFull(attribute);
      fullChange = true; denseChange = false; changedRows.clear(); revision = 1;
    },
  };
}

type EdgeAssemblyPhase = 'tables' | 'metadata' | 'metadata-finish' | 'arrays' | 'atlas' | 'native' | 'ready';
interface EdgeAssembly {
  data: GraphSpatialData | undefined;
  dashRows: readonly (readonly number[])[] | undefined;
  copyPatterns: boolean;
  count: number;
  phase: EdgeAssemblyPhase;
  stage: number;
  edge: number;
  derivedCount: number;
  styleRadius: boolean;
  height: number;
  patterns: (readonly number[])[] | undefined;
  byPattern: Map<string, number> | undefined;
  patternRow: number;
  dashScalar: number;
  dashSum: number;
  buffers: Float32Array[];
  storage: Partial<EdgeStorage>;
  plane: PlaneGeometry | undefined;
  geometry: InstancedBufferGeometry | undefined;
  attributes: EdgeAttributes | undefined;
  texture: DataTexture | undefined;
  uniforms: EdgeUniforms | undefined;
  material: ShaderMaterial | undefined;
  pickMaterial: ShaderMaterial | undefined;
  mesh: Mesh<InstancedBufferGeometry, ShaderMaterial> | undefined;
  pick: Mesh<InstancedBufferGeometry, ShaderMaterial> | undefined;
  resources: GraphSpatialEdgeResources | undefined;
  controller: ReturnType<typeof createEdgeController> | undefined;
}
function edgeAssembly(data: GraphSpatialData, count: number, dashRows: readonly (readonly number[])[] | undefined, copyPatterns = false): EdgeAssembly {
  return { data, count, dashRows, copyPatterns, phase: 'tables', stage: 0, edge: 0, derivedCount: 0, styleRadius: false, height: 1,
    patterns: [[]], byPattern: new Map([['', 0]]), patternRow: 0, dashScalar: -1, dashSum: 0, buffers: [], storage: {},
    plane: undefined, geometry: undefined, attributes: undefined, texture: undefined, uniforms: undefined, material: undefined,
    pickMaterial: undefined, mesh: undefined, pick: undefined, resources: undefined, controller: undefined };
}
function advanceEdgeAssembly(owner: EdgeAssembly): { allocatedBytes: number; visitedEdges: number; copiedDashValues: number } {
  const data = owner.data!, storage = owner.storage;
  const result = { allocatedBytes: 0, visitedEdges: 0, copiedDashValues: 0 };
  for (;;) {
    switch (owner.phase) {
      case 'tables':
        if (owner.stage++ === 0) { storage.patternRows = new Uint32Array(data.source.length); result.allocatedBytes = storage.patternRows.byteLength; }
        else { storage.offsets = new Uint32Array(data.source.length + 1); result.allocatedBytes = storage.offsets.byteLength; owner.phase = 'metadata'; }
        return result;
      case 'metadata': {
        if (owner.edge === data.source.length) { owner.phase = 'metadata-finish'; continue; }
        const edge = owner.edge++, appearance = data.spatialAppearance;
        storage.offsets![edge] = owner.derivedCount;
        owner.derivedCount += spatialEdgeSegments(data, edge) + (data.directed?.[edge] ? 1 : 0);
        owner.styleRadius ||= data.sizes === undefined && appearance.dangling?.[edge] !== 1 && (data.source[edge] === data.target[edge] || Boolean(data.directed?.[edge]));
        const pattern = appearance.dangling?.[edge] ? [4, 4] : owner.dashRows?.[edge] ?? [], key = pattern.join(',');
        let index = owner.byPattern!.get(key);
        if (index === undefined) { index = owner.patterns!.length; owner.byPattern!.set(key, index); owner.patterns!.push(owner.copyPatterns ? [...pattern] : pattern); }
        storage.patternRows![edge] = index; result.visitedEdges = 1; return result;
      }
      case 'metadata-finish':
        if (owner.derivedCount !== owner.count) throw new RangeError('Graph spatial edge facts do not match the owned columns');
        storage.offsets![data.source.length] = owner.count;
        owner.height = Math.max(1, Math.ceil(owner.patterns!.length / 32)); owner.dashRows = undefined;
        owner.phase = 'arrays'; owner.stage = 0; return result;
      case 'arrays': {
        const stage = owner.stage++;
        if (stage < 8) {
          const buffer = new Float32Array(owner.count * edgeAttributeLayout[stage]![1]); owner.buffers.push(buffer); result.allocatedBytes = buffer.byteLength;
        } else if (stage === 8) { storage.anchors = new Float32Array(owner.count * 3); result.allocatedBytes = storage.anchors.byteLength; }
        else if (stage === 9) { storage.valid = new Uint8Array(data.source.length); result.allocatedBytes = storage.valid.byteLength; }
        else if (stage === 10) { storage.partialRows = new Uint8Array(data.source.length); result.allocatedBytes = storage.partialRows.byteLength; }
        else { storage.values = new Float32Array(2048 * owner.height); result.allocatedBytes = storage.values.byteLength; owner.phase = 'atlas'; }
        return result;
      }
      case 'atlas': {
        if (owner.patternRow === owner.patterns!.length) {
          owner.patterns = undefined; owner.byPattern = undefined; owner.phase = 'native'; owner.stage = 0; continue;
        }
        const pattern = owner.patterns![owner.patternRow]!, base = owner.patternRow * 64;
        if (owner.dashScalar === -1) {
          storage.values![base] = pattern.length; owner.dashSum = 0; owner.dashScalar = 0;
          if (pattern.length === 0) { owner.patternRow++; owner.dashScalar = -1; }
        } else {
          const scalar = owner.dashScalar++, value = pattern[scalar]!;
          storage.values![base + scalar + 2] = value; owner.dashSum += value; storage.values![base + 1] = owner.dashSum;
          result.copiedDashValues = 1;
          if (owner.dashScalar === pattern.length) { owner.patternRow++; owner.dashScalar = -1; }
        }
        return result;
      }
      case 'native': {
        switch (owner.stage++) {
          case 0: {
            const texture = owner.texture = new DataTexture(storage.values!, 2048, owner.height, RedFormat, FloatType);
            texture.minFilter = texture.magFilter = NearestFilter; texture.generateMipmaps = false; texture.needsUpdate = true; break;
          }
          case 1: {
            const plane = owner.plane = new PlaneGeometry(2, 2);
            result.allocatedBytes = plane.index!.array.byteLength + plane.getAttribute('position').array.byteLength
              + plane.getAttribute('normal').array.byteLength + plane.getAttribute('uv').array.byteLength; break;
          }
          case 2: {
            const geometry = owner.geometry = new InstancedBufferGeometry(), plane = owner.plane!;
            geometry.index = plane.index; geometry.attributes = { ...plane.attributes }; geometry.instanceCount = owner.count;
            owner.plane = undefined; plane.dispose(); break;
          }
          case 3: {
            const attributes = owner.attributes = {} as EdgeAttributes;
            for (const [index, [name, components]] of edgeAttributeLayout.entries()) {
              const attribute = new InstancedBufferAttribute(owner.buffers[index]!, components); attributes[name] = attribute; owner.geometry!.setAttribute(name, attribute);
            }
            owner.uniforms = edgeUniforms(data.spatialAppearance.sizeUnits === 'world'); break;
          }
          case 4: {
            const { shared, window } = owner.uniforms!;
            owner.material = new ShaderMaterial({ side: DoubleSide, forceSinglePass: true,
              uniforms: { ...shared, viewWindow: { value: window }, dashAtlas: { value: owner.texture! }, atlasHeight: { value: owner.height } },
              vertexShader: vertex, fragmentShader: fragment, transparent: true }); break;
          }
          case 5: {
            const { shared, pickWindow } = owner.uniforms!;
            owner.pickMaterial = new ShaderMaterial({ side: DoubleSide, forceSinglePass: true, uniforms: { ...shared, viewWindow: { value: pickWindow } },
              vertexShader: vertex, fragmentShader: fragment, defines: { PICKING: 1 }, blending: NoBlending, toneMapped: false }); break;
          }
          case 6:
            owner.mesh = new Mesh(owner.geometry!, owner.material!); owner.mesh.frustumCulled = false; break;
          case 7:
            owner.pick = new Mesh(owner.geometry!, owner.pickMaterial!); owner.pick.frustumCulled = false;
            owner.pick.onBeforeRender = edgePickHook(owner.uniforms!.window, owner.uniforms!.pickWindow, owner.pickMaterial!); break;
          case 8:
            owner.resources = { geometry: owner.geometry!, material: owner.material!, pickMaterial: owner.pickMaterial!, texture: owner.texture!,
              mesh: owner.mesh!, pick: owner.pick!, disposed: false };
            owner.controller = createEdgeController(data, owner.resources, owner.attributes!, storage as EdgeStorage, owner.uniforms!, owner.styleRadius);
            owner.phase = 'ready'; break;
        }
        return result;
      }
      case 'ready': throw new DOMException('Graph spatial edge assembly is complete', 'InvalidStateError');
    }
  }
}
function clearEdgeAssembly(owner: EdgeAssembly): void {
  owner.data = undefined; owner.dashRows = undefined; owner.patterns = undefined; owner.byPattern = undefined; owner.buffers = []; owner.storage = {};
  owner.plane = undefined; owner.geometry = undefined; owner.attributes = undefined; owner.texture = undefined; owner.uniforms = undefined;
  owner.material = undefined; owner.pickMaterial = undefined; owner.mesh = undefined; owner.pick = undefined; owner.resources = undefined; owner.controller = undefined;
}
function retireEdgeAssembly(owner: EdgeAssembly): void {
  const { resources, plane, geometry, texture, material, pickMaterial, mesh, pick } = owner;
  clearEdgeAssembly(owner);
  if (resources) disposeGraphSpatialEdgeResources(resources);
  else disposeAll([
    () => mesh?.removeFromParent(), () => pick?.removeFromParent(), () => plane?.dispose(), () => geometry?.dispose(),
    () => material?.dispose(), () => pickMaterial?.dispose(), () => texture?.dispose(),
  ]);
}

/** Batched strokes in world space. Segment expansion never changes the public edge row identity;
 * the vertex stage projects, clips and widens every segment from camera uniforms. */
export function createGraphSpatialEdges(data: GraphSpatialData) {
  validateGraphSpatialSizes(data.sizes, data.nodeCount, data.spatialAppearance);
  const owner = edgeAssembly(data, spatialPrimitiveCount(data), data.spatialAppearance.edgeDashes, true);
  try {
    while (owner.phase !== 'ready') advanceEdgeAssembly(owner);
    const controller = owner.controller!, offsets = owner.storage.offsets!, patternRows = owner.storage.patternRows!;
    for (let edge = 0; edge < data.source.length; edge++) {
      const identity = edgeIdentity(data, edge, patternRows[edge]!);
      for (let index = offsets[edge]!; index < offsets[edge + 1]!; index++) initializeEdgeIdentity(owner.attributes!, index, index - offsets[edge]!, identity);
    }
    clearEdgeAssembly(owner); return controller.batch;
  } catch (error) {
    try { retireEdgeAssembly(owner); } catch { /* Preserve the construction error after attempting every acquired resource. */ }
    throw error;
  }
}

interface EdgeWorkState {
  data: GraphPreparedDataColumns | undefined;
  facts: Pick<GraphSceneFacts, 'spatialEdgePrimitiveCount'> | undefined;
  presentation: GraphSpatialEdgePresentation | undefined;
  guard: (() => boolean) | undefined;
  owner: EdgeAssembly | undefined;
  lookup: GraphPositionLookup | undefined;
  row: EdgeInitialization | undefined;
  active: boolean;
  edge: number;
  primitive: number;
}
function edgeColumns(data: GraphPreparedDataColumns): GraphSpatialData {
  const appearance = data.spatialAppearance!;
  return { nodeCount: data.nodeCount, source: data.source, target: data.target, sizes: data.sizes, directed: data.directed,
    spatialAppearance: { sizeUnits: appearance.sizeUnits, dimmedOpacity: appearance.dimmedOpacity, edgeWidths: appearance.edgeWidths,
      edgeColors: appearance.edgeColors, edgeCurvatures: appearance.edgeCurvatures, dangling: appearance.dangling } };
}
/**
 * Prepares detached strokes from admitted owned columns and a resolved owned presentation.
 * Inputs remain unchanged while borrowed. Each operation allocates one backing, constructs a
 * fixed native wrapper, visits one bounded dash/edge row, or writes one expanded primitive.
 */
export function createGraphSpatialEdgesWork(data: GraphPreparedDataColumns, facts: Pick<GraphSceneFacts, 'spatialEdgePrimitiveCount'>, presentation: GraphSpatialEdgePresentation, isCurrent?: () => boolean): GraphSpatialEdgeWork {
  const state: EdgeWorkState = { data, facts, presentation, guard: isCurrent, owner: undefined, lookup: undefined, row: undefined, active: true, edge: 0, primitive: 0 };
  data = undefined as never; facts = undefined as never; presentation = undefined as never; isCurrent = undefined;
  let running = false;
  const releaseInputs = (): void => {
    state.active = false; state.data = undefined; state.facts = undefined; state.presentation = undefined; state.guard = undefined; state.lookup = undefined; state.row = undefined;
  };
  const checkpoint = (): void => {
    const current = state.active && (!state.guard || state.guard());
    if (!current || !state.active) {
      const error = new Error('Graph spatial edge preparation was superseded'); error.name = 'AbortError'; throw error;
    }
  };
  const close = (): void => {
    releaseInputs();
    if (running) return;
    const owner = state.owner; state.owner = undefined;
    if (owner) retireEdgeAssembly(owner);
  };
  return {
    step(maxOperations) {
      if (!state.active || running) throw new DOMException('Graph spatial edge preparation is closed or running', 'InvalidStateError');
      if (!Number.isSafeInteger(maxOperations) || maxOperations < 1) throw new RangeError('Invalid graph spatial edge preparation budget');
      let operations = 0, allocatedBytes = 0, visitedEdges = 0, initializedPrimitives = 0, copiedDashValues = 0;
      running = true;
      try {
        while (operations < maxOperations) {
          checkpoint();
          if (!state.owner) {
            const input = state.data!, count = state.facts!.spatialEdgePrimitiveCount;
            if (!input.spatialAppearance) throw new TypeError('Invalid spatial edge appearance');
            if (!Number.isSafeInteger(count) || count! < 0 || count! > GRAPH_MAX_SPATIAL_PRIMITIVES) throw new RangeError('Invalid graph spatial edge primitive count');
            state.owner = edgeAssembly(edgeColumns(input), count!, input.spatialAppearance.edgeDashes);
            state.lookup = edgePositionLookup(input.positions); state.facts = undefined;
          } else if (state.owner.phase !== 'ready') {
            const step = advanceEdgeAssembly(state.owner);
            allocatedBytes += step.allocatedBytes; visitedEdges += step.visitedEdges; copiedDashValues += step.copiedDashValues;
          } else if (state.edge < state.owner.data!.source.length) {
            if (!state.row) {
              state.row = state.owner.controller!.initializeEdge(state.edge, state.presentation!, state.lookup!); visitedEdges++;
            } else {
              const owner = state.owner;
              owner.controller!.initializePrimitive(state.row, state.primitive++); initializedPrimitives++;
              if (state.primitive === owner.storage.offsets![state.edge + 1]! - owner.storage.offsets![state.edge]!) {
                state.edge++; state.primitive = 0; state.row = undefined;
              }
            }
          } else {
            const owner = state.owner, controller = owner.controller!, resources = owner.resources!, storage = owner.storage as EdgeStorage;
            controller.finishInitialization(state.presentation!, state.lookup!);
            const geometry = resources.geometry, columns = owner.data!, appearance = columns.spatialAppearance;
            const ownedBuffers: ArrayBufferLike[] = [geometry.index!.array.buffer, geometry.getAttribute('position').array.buffer,
              geometry.getAttribute('normal').array.buffer, geometry.getAttribute('uv').array.buffer, ...owner.buffers.map(buffer => buffer.buffer),
              storage.anchors.buffer, storage.patternRows.buffer, storage.offsets.buffer, storage.valid.buffer, storage.partialRows.buffer, storage.values.buffer];
            const borrowedBuffers = [...new Set([columns.source, columns.target, state.data!.positions, columns.sizes, columns.directed,
              appearance.edgeWidths, appearance.edgeColors, appearance.edgeCurvatures, appearance.dangling].filter(value => value !== undefined).map(value => value.buffer))];
            const value: GraphPreparedSpatialEdges = { batch: controller.batch, resources, ownedBuffers, borrowedBuffers };
            operations++; checkpoint();
            state.owner = undefined; clearEdgeAssembly(owner); close();
            return { done: true, operations, allocatedBytes, visitedEdges, initializedPrimitives, copiedDashValues, value };
          }
          operations++; checkpoint();
        }
        return { done: false, operations, allocatedBytes, visitedEdges, initializedPrimitives, copiedDashValues };
      } catch (error) {
        releaseInputs();
        const owner = state.owner; state.owner = undefined;
        try { if (owner) retireEdgeAssembly(owner); } catch { /* Keep the operation error after every acquired resource was attempted. */ }
        throw error;
      } finally { running = false; }
    },
    dispose: close,
  };
}
