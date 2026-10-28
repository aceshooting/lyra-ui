import { disposeAll } from '../core/dispose.js';
import { DoubleSide, Color, DataTexture, FloatType, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, NearestFilter, NoBlending, PerspectiveCamera, PlaneGeometry, RedFormat, ShaderMaterial, Vector4 } from 'three';
import { markAttributeFull, markAttributeRows } from '../core/attribute-updates.js';
import type { VisualStateRows } from '../core/visual-state.js';
import { createPaintColors } from '../core/paint-colors.js';
import type { Lyra3dState, Lyra3dWorldPoint } from '../core/contract.js';
import { encodePickId } from '../core/picking.js';
import type { Lyra3dViewport } from '../core/viewport.js';
import { validateGraphSpatialSizes } from './spatial-appearance.js';
import { GRAPH_ARROW_HALF_ANGLE, graphSpatialEdgeVertexChunk, graphSpatialProjectionChunk, graphSpatialView, spatialCurvePoint, spatialEdgeSegments, spatialPrimitiveCount, type GraphPositionLookup, type GraphSpatialData } from './spatial-paths.js';

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

/** Batched strokes in world space. Segment expansion never changes the public edge row identity;
 * the vertex stage projects, clips and widens every segment from camera uniforms. */
export function createGraphSpatialEdges(data: GraphSpatialData) {
  const appearance = data.spatialAppearance;
  validateGraphSpatialSizes(data.sizes, data.nodeCount, appearance);
  // Only default-size loops and non-dangling arrow clearance depend on style pointSize.
  const styleRadius = data.sizes === undefined && data.source.some((source, edge) =>
    appearance.dangling?.[edge] !== 1 && (source === data.target[edge] || Boolean(data.directed?.[edge])));
  const count = spatialPrimitiveCount(data), worldSizes = appearance.sizeUnits === 'world';
  const plane = new PlaneGeometry(2, 2), geometry = new InstancedBufferGeometry(); geometry.index = plane.index; geometry.attributes = { ...plane.attributes }; geometry.instanceCount = count; plane.dispose();
  const attribute = (name: string, components: number) => {
    const result = new InstancedBufferAttribute(new Float32Array(count * components), components);
    geometry.setAttribute(name, result); return result;
  };
  const start = attribute('edgeStart', 3), end = attribute('edgeEnd', 3), path = attribute('edgePath', 4), stroke = attribute('stroke', 3);
  const colors = attribute('edgeColor', 4), picks = attribute('pickColor', 3), dash = attribute('dash', 1), curvature = attribute('edgeCurvature', 1);
  /** World anchor of each primitive, from which the composite derives painter order. */
  const anchors = new Float32Array(count * 3);
  const mutablePatterns: number[][] = [[]]; const byPattern = new Map<string, number>([['', 0]]); const patternRows = new Uint32Array(data.source.length);
  for (let row = 0; row < data.source.length; row++) {
    const pattern = appearance.dangling?.[row] ? [4, 4] : appearance.edgeDashes?.[row] ?? []; const key = pattern.join(',');
    let index = byPattern.get(key); if (index === undefined) { index = mutablePatterns.length; byPattern.set(key, index); mutablePatterns.push([...pattern]); } patternRows[row] = index;
  }
  const height = Math.max(1, Math.ceil(mutablePatterns.length * 64 / 2048)), values = new Float32Array(2048 * height);
  mutablePatterns.forEach((pattern, row) => { values[row * 64] = pattern.length; values[row * 64 + 1] = pattern.reduce((sum, value) => sum + value, 0); values.set(pattern, row * 64 + 2); });
  const texture = new DataTexture(values, 2048, height, RedFormat, FloatType); texture.minFilter = texture.magFilter = NearestFilter; texture.generateMipmaps = false; texture.needsUpdate = true;
  const offsets = new Uint32Array(data.source.length + 1);
  // Identity and path shape are fixed per batch; only paint and positions are rewritten.
  for (let edge = 0, index = 0; edge < data.source.length; edge++) {
    offsets[edge] = index;
    const segments = spatialEdgeSegments(data, edge), primitives = segments + (data.directed?.[edge] ? 1 : 0), id = encodePickId(data.nodeCount + edge)!;
    const bend = !appearance.dangling?.[edge] && data.source[edge] !== data.target[edge] ? appearance.edgeCurvatures?.[edge] ?? 0 : 0;
    for (let primitive = 0; primitive < primitives; primitive++, index++) {
      const arrow = primitive === segments;
      picks.setXYZ(index, id[0] / 255, id[1] / 255, id[2] / 255); dash.setX(index, arrow ? 0 : patternRows[edge]!);
      curvature.setX(index, bend);
      path.setXY(index, arrow ? 1 - 1 / segments : primitive / segments, arrow ? 1 : (primitive + 1) / segments);
    }
  }
  offsets[data.source.length] = count;
  const window = new Vector4(0, 0, 1, 1), pickWindow = new Vector4(0, 0, 1, 1), lyraView = new Vector4(1, 1, 0.5, 1e4);
  const shared = { lyraView: { value: lyraView }, worldSizes: { value: worldSizes ? 1 : 0 } };
  const material = new ShaderMaterial({ side: DoubleSide, forceSinglePass: true, uniforms: { ...shared, viewWindow: { value: window }, dashAtlas: { value: texture }, atlasHeight: { value: height } }, vertexShader: vertex, fragmentShader: fragment, transparent: true });
  const pickMaterial = new ShaderMaterial({ side: DoubleSide, forceSinglePass: true, uniforms: { ...shared, viewWindow: { value: pickWindow } }, vertexShader: vertex, fragmentShader: fragment, defines: { PICKING: 1 }, blending: NoBlending, toneMapped: false });
  const mesh = new Mesh(geometry, material), pick = new Mesh(geometry, pickMaterial); mesh.frustumCulled = pick.frustumCulled = false;
  pick.onBeforeRender = (_renderer, _scene, camera) => {
    const view = camera instanceof PerspectiveCamera ? camera.view : null;
    if (view?.enabled) pickWindow.set(view.offsetX, view.offsetY, view.width, view.height); else pickWindow.copy(window);
    pickMaterial.uniformsNeedUpdate = true;
  };
  const color = new Color(); let disposed = false, translucent = false, revision = 0;
  const setView = (viewport: EdgeView) => {
    const next = graphSpatialView(viewport.width, viewport.height, viewport.orbit);
    window.set(0, 0, viewport.width, viewport.height); lyraView.set(next.width, next.height, next.near, next.far);
  };
  const anchor = (index: number, x: number, y: number, z: number) => { anchors[index * 3] = x; anchors[index * 3 + 1] = y; anchors[index * 3 + 2] = z; };
  type EdgeViewport = EdgeView & Pick<Lyra3dViewport, 'style'>;
  const valid = new Uint8Array(data.source.length), partialRows = new Uint8Array(data.source.length);
  let partialCount = 0, fullChange = true, denseChange = false;
  const changedRows = new Set<number>();
  let lookup: GraphPositionLookup | undefined;
  let positionPointSize: number | undefined;
  let lastState: Lyra3dState | undefined;
  const updatePositions = (viewport: EdgeViewport, position: GraphPositionLookup) => {
    lookup = position; setView(viewport);
    const validityChanges: number[] = [];
    for (let edge = 0; edge < data.source.length; edge++) {
      const source = data.source[edge]!, dangling = appearance.dangling?.[edge] === 1;
      const a: Lyra3dWorldPoint | null = position(source);
      const loop = !dangling && source === data.target[edge];
      const b: Lyra3dWorldPoint | null = !a ? null : dangling ? { x: a.x + DANGLING_REACH, y: a.y - DANGLING_REACH, z: a.z } : loop ? a : position(data.target[edge]!);
      const nextValid = Number(a !== null && b !== null);
      if (valid[edge] !== nextValid) validityChanges.push(data.nodeCount + edge);
      valid[edge] = nextValid;
      const loopRadius = loop ? (data.sizes?.[source] ?? viewport.style.pointSize) / 2 * 1.6 : 0;
      const segments = spatialEdgeSegments(data, edge);
      for (let index = offsets[edge]!; index < offsets[edge + 1]!; index++) {
        const arrow = index - offsets[edge]! === segments, t0 = path.getX(index), t1 = path.getY(index);
        start.setXYZ(index, a?.x ?? 0, a?.y ?? 0, a?.z ?? 0); end.setXYZ(index, b?.x ?? 0, b?.y ?? 0, b?.z ?? 0);
        path.setZ(index, loopRadius); path.setW(index, arrow && !dangling ? (data.sizes?.[data.target[edge]!] ?? viewport.style.pointSize) / 2 : 0);
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
      }
    }
    for (const buffer of [start, end, path]) markAttributeFull(buffer);
    positionPointSize = viewport.style.pointSize;
    fullChange = true; revision++;
    if (lastState && validityChanges.length) paint(viewport, lastState, validityChanges, false);
  };
  const paint = (viewport: EdgeViewport, state: Lyra3dState, rows: VisualStateRows, full: boolean) => {
    lastState = state;
    const style = viewport.style, dense = rows === null;
    const paintColor = createPaintColors(style);
    const dirty = new Map<InstancedBufferAttribute, number[]>();
    const touched = new Set<InstancedBufferAttribute>();
    const record = (buffer: InstancedBufferAttribute, index: number) => {
      if (full) return;
      touched.add(buffer);
      if (dense) return;
      const list = dirty.get(buffer) ?? []; list.push(index); dirty.set(buffer, list);
      if (!fullChange && !denseChange) changedRows.add(index);
    };
    const writeColor = (index: number, r: number, g: number, b: number, a: number) => {
      const offset = index * 4;
      if (!full && colors.array[offset] === r && colors.array[offset + 1] === g && colors.array[offset + 2] === b && colors.array[offset + 3] === a) return;
      colors.array[offset] = r; colors.array[offset + 1] = g; colors.array[offset + 2] = b; colors.array[offset + 3] = a; record(colors, index);
    };
    const writeStroke = (index: number, width: number, pickWidth: number, arrow: number) => {
      const offset = index * 3, w = Math.fround(width), p = Math.fround(pickWidth);
      if (!full && stroke.array[offset] === w && stroke.array[offset + 1] === p && stroke.array[offset + 2] === arrow) return;
      stroke.array[offset] = w; stroke.array[offset + 1] = p; stroke.array[offset + 2] = arrow; record(stroke, index);
    };
    for (let row = 0, length = rows?.length ?? data.source.length; row < length; row++) {
      const edge = rows === null ? row : rows[row]! - data.nodeCount;
      if (!Number.isInteger(edge) || edge < 0 || edge >= data.source.length) continue;
      const item = data.nodeCount + edge;
      const selected = state.selected.has(item) || state.hover === item;
      const raw = appearance.edgeColors, dangling = appearance.dangling?.[edge] === 1;
      const rgba = selected ? style.accent : style.forcedColors ? style.foreground : raw ? { r: raw[edge * 4]!, g: raw[edge * 4 + 1]!, b: raw[edge * 4 + 2]!, a: raw[edge * 4 + 3]! } : style.muted;
      paintColor(rgba, color);
      const alpha = rgba.a * (!style.forcedColors && state.dimmed.has(item) ? appearance.dimmedOpacity ?? 0.35 : 1);
      const baseWidth = appearance.edgeWidths?.[edge] ?? style.lineWidth;
      const eligible = valid[edge] === 1 && baseWidth > 0 && (raw?.[edge * 4 + 3] ?? style.muted.a) > 0;
      const visible = eligible && alpha > 0, blends = visible && alpha < 1;
      const nextPartial = blends ? 1 : 0;
      partialCount += nextPartial - partialRows[edge]!; partialRows[edge] = nextPartial;
      const segments = spatialEdgeSegments(data, edge);
      const r = Math.fround(color.r), g = Math.fround(color.g), b = Math.fround(color.b), a = Math.fround(alpha);
      for (let index = offsets[edge]!; index < offsets[edge + 1]!; index++) {
        writeColor(index, r, g, b, a);
        if (index - offsets[edge]! === segments) {
          const head = Math.max(6, (baseWidth + (selected ? 2 : 0)) * 3);
          writeStroke(index, visible ? head * Math.tan(GRAPH_ARROW_HALF_ANGLE) * 2 : 0, 0, 1);
        } else writeStroke(index, visible ? baseWidth + (selected ? 2 : 0) : 0, eligible && !dangling ? Math.max(12, baseWidth) : 0, 0);
      }
    }
    translucent = partialCount > 0;
    if (material.transparent !== translucent) { material.transparent = translucent; material.needsUpdate = true; }
    material.depthWrite = !translucent;
    if (full) for (const buffer of [colors, stroke]) markAttributeFull(buffer);
    else if (dense) for (const buffer of touched) markAttributeFull(buffer);
    else for (const [buffer, changed] of dirty) markAttributeRows(buffer, changed);
    if (full) { fullChange = true; denseChange = false; changedRows.clear(); }
    else if (dense && touched.size && !fullChange) { denseChange = true; changedRows.clear(); }
    if (touched.size || full) revision++;
  };
  const updateStyle = (viewport: EdgeViewport, state: Lyra3dState, positionsUnchanged: boolean) => {
    // Node radii also determine self loops and arrow endpoint clearance.
    // Only the engine's position-revision coordinator supplies the stable-position proof;
    // direct callers retain lookup refresh, including position validity changes.
    if (lookup && (!positionsUnchanged || (styleRadius && positionPointSize !== viewport.style.pointSize))) updatePositions(viewport, lookup);
    else setView(viewport);
    paint(viewport, state, null, true);
  };
  return { mesh, pick, anchors,
    /** Retained path lookup, atlas and validity storage beyond geometry attributes. */
    allocationBuffers(): readonly ArrayBufferLike[] {
      return [...new Set([anchors, patternRows, offsets, valid, partialRows, values].map(value => value.buffer))];
    },
    get translucent() { return translucent; },
    get revision() { return revision; },
    takeChanges(): { full: boolean; rows: VisualStateRows } {
      const result = { full: fullChange, rows: fullChange ? [] : denseChange ? null : [...changedRows] };
      fullChange = false; denseChange = false; changedRows.clear(); return result;
    },
    setView(viewport: EdgeView) { if (!disposed) setView(viewport); },
    updatePositions(viewport: EdgeViewport, position: GraphPositionLookup) { if (!disposed) updatePositions(viewport, position); },
    updateStyle(viewport: EdgeViewport, state: Lyra3dState, positionsUnchanged = false) { if (!disposed) updateStyle(viewport, state, positionsUnchanged); },
    updateState(viewport: EdgeViewport, state: Lyra3dState, rows: VisualStateRows) { if (!disposed) paint(viewport, state, rows, false); },
    update(viewport: EdgeViewport, position: GraphPositionLookup, state: Lyra3dState) {
      if (disposed) return;
      const previousRevision = revision;
      updatePositions(viewport, position); paint(viewport, state, null, true);
      revision = previousRevision + 1;
    },
    dispose() { if (disposed) return; disposed = true; disposeAll([() => mesh.removeFromParent(), () => pick.removeFromParent(), () => geometry.dispose(), () => material.dispose(), () => pickMaterial.dispose(), () => texture.dispose()]); },
  };
}
