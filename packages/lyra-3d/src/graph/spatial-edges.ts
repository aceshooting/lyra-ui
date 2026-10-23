import { DoubleSide, Color, DataTexture, FloatType, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, NearestFilter, NoBlending, PerspectiveCamera, PlaneGeometry, RedFormat, ShaderMaterial, SRGBColorSpace, Vector4 } from 'three';
import type { Lyra3dState, Lyra3dWorldPoint } from '../core/contract.js';
import { encodePickId } from '../core/picking.js';
import type { Lyra3dViewport } from '../core/viewport.js';
import { validateGraphSpatialSizes } from './spatial-appearance.js';
import { GRAPH_ARROW_HALF_ANGLE, graphSpatialEdgeVertexChunk, graphSpatialProjectionChunk, graphSpatialView, spatialEdgeSegments, spatialPrimitiveCount, type GraphPositionLookup, type GraphSpatialData } from './spatial-paths.js';

type EdgeView = Pick<Lyra3dViewport, 'width' | 'height' | 'orbit'>;
const vertex = graphSpatialProjectionChunk + graphSpatialEdgeVertexChunk + `
attribute vec3 edgeStart; attribute vec3 edgeEnd; attribute vec4 edgePath; attribute vec3 stroke;
attribute vec4 edgeColor; attribute vec3 pickColor; attribute float dash;
void main(){ graphSpatialEdgeVertex(edgeStart, edgeEnd, edgePath, stroke, edgeColor, pickColor, dash); }`;
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
  const count = spatialPrimitiveCount(data), worldSizes = appearance.sizeUnits === 'world';
  const plane = new PlaneGeometry(2, 2), geometry = new InstancedBufferGeometry(); geometry.index = plane.index; geometry.attributes = { ...plane.attributes }; geometry.instanceCount = count; plane.dispose();
  const attribute = (name: string, components: number) => {
    const result = new InstancedBufferAttribute(new Float32Array(count * components), components);
    geometry.setAttribute(name, result); return result;
  };
  const start = attribute('edgeStart', 3), end = attribute('edgeEnd', 3), path = attribute('edgePath', 4), stroke = attribute('stroke', 3);
  const colors = attribute('edgeColor', 4), picks = attribute('pickColor', 3), dash = attribute('dash', 1);
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
  // Identity and path shape are fixed per batch; only paint and positions are rewritten.
  for (let edge = 0, index = 0; edge < data.source.length; edge++) {
    const segments = spatialEdgeSegments(data, edge), primitives = segments + (data.directed?.[edge] ? 1 : 0), id = encodePickId(data.nodeCount + edge)!;
    for (let primitive = 0; primitive < primitives; primitive++, index++) {
      const arrow = primitive === segments;
      picks.setXYZ(index, id[0] / 255, id[1] / 255, id[2] / 255); dash.setX(index, arrow ? 0 : patternRows[edge]!);
      path.setXY(index, arrow ? 1 - 1 / segments : primitive / segments, arrow ? 1 : (primitive + 1) / segments);
    }
  }
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
  return { mesh, pick, anchors,
    /** True when any visible stroke blends; the composite then paints in back-to-front order. */
    get translucent() { return translucent; },
    /** Increases with every attribute rewrite. */
    get revision() { return revision; },
    /** Camera and viewport changes only touch uniforms. */
    setView(viewport: EdgeView) { if (!disposed) setView(viewport); },
    update(viewport: EdgeView & Pick<Lyra3dViewport, 'style'>, position: GraphPositionLookup, state: Lyra3dState) {
      if (disposed) return;
      setView(viewport);
      const style = viewport.style;
      translucent = false;
      let index = 0;
      for (let edge = 0; edge < data.source.length; edge++) {
        const segments = spatialEdgeSegments(data, edge), item = data.nodeCount + edge, source = data.source[edge]!, dangling = appearance.dangling?.[edge] === 1;
        const selected = state.selected.has(item) || state.hover === item;
        const raw = appearance.edgeColors; const rgba = selected ? style.accent : style.forcedColors ? style.foreground : raw ? { r: raw[edge * 4]!, g: raw[edge * 4 + 1]!, b: raw[edge * 4 + 2]!, a: raw[edge * 4 + 3]! } : style.muted;
        color.setRGB(rgba.r, rgba.g, rgba.b, SRGBColorSpace);
        const alpha = rgba.a * (!style.forcedColors && state.dimmed.has(item) ? appearance.dimmedOpacity ?? 0.35 : 1);
        const baseWidth = appearance.edgeWidths?.[edge] ?? style.lineWidth;
        // Mirrors spatialEdgePoint: dangling stubs reach a fixed world offset and self loops circle
        // their node at 1.6 node radii (world units, or CSS pixels resolved by the shader).
        const a: Lyra3dWorldPoint | null = position(source);
        const loop = !dangling && source === data.target[edge];
        const b: Lyra3dWorldPoint | null = !a ? null : dangling ? { x: a.x + DANGLING_REACH, y: a.y - DANGLING_REACH, z: a.z } : loop ? a : position(data.target[edge]!);
        const loopRadius = loop ? (data.sizes?.[source] ?? style.pointSize) / 2 * 1.6 : 0;
        const eligible = a !== null && b !== null && baseWidth > 0 && (raw?.[edge * 4 + 3] ?? style.muted.a) > 0;
        const visible = eligible && alpha > 0;
        if (visible && alpha < 1) translucent = true;
        const primitives = segments + (data.directed?.[edge] ? 1 : 0);
        for (let primitive = 0; primitive < primitives; primitive++, index++) {
          const arrow = primitive === segments, t0 = path.getX(index), t1 = path.getY(index);
          start.setXYZ(index, a?.x ?? 0, a?.y ?? 0, a?.z ?? 0); end.setXYZ(index, b?.x ?? 0, b?.y ?? 0, b?.z ?? 0);
          path.setZ(index, loopRadius); path.setW(index, arrow && !dangling ? (data.sizes?.[data.target[edge]!] ?? style.pointSize) / 2 : 0);
          colors.setXYZW(index, color.r, color.g, color.b, alpha);
          if (arrow) {
            const head = Math.max(6, (baseWidth + (selected ? 2 : 0)) * 3);
            stroke.setXYZ(index, visible ? head * Math.tan(GRAPH_ARROW_HALF_ANGLE) * 2 : 0, 0, 1);
            if (b) anchor(index, b.x, b.y, b.z); else anchor(index, 0, 0, 0);
          } else {
            stroke.setXYZ(index, visible ? baseWidth + (selected ? 2 : 0) : 0, eligible && !dangling ? Math.max(12, baseWidth) : 0, 0);
            if (!a || !b) anchor(index, 0, 0, 0);
            else if (loop && worldSizes) {
              const mid = (t0 + t1) * Math.PI;
              anchor(index, a.x + Math.sin(mid) * loopRadius, a.y - (1 - Math.cos(mid)) * loopRadius, a.z);
            } else {
              const mid = loop ? 0 : (t0 + t1) / 2;
              anchor(index, a.x + (b.x - a.x) * mid, a.y + (b.y - a.y) * mid, a.z + (b.z - a.z) * mid);
            }
          }
        }
      }
      if (material.transparent !== translucent) { material.transparent = translucent; material.needsUpdate = true; }
      material.depthWrite = !translucent;
      for (const buffer of [start, end, path, stroke, colors]) buffer.needsUpdate = true;
      revision += 1;
    },
    dispose() { if (disposed) return; disposed = true; mesh.removeFromParent(); pick.removeFromParent(); geometry.dispose(); material.dispose(); pickMaterial.dispose(); texture.dispose(); },
  };
}
