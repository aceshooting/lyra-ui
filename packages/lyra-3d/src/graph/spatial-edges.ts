import { DoubleSide, Color, DataTexture, FloatType, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, NearestFilter, NoBlending, PerspectiveCamera, PlaneGeometry, RedFormat, ShaderMaterial, SRGBColorSpace, Vector4 } from 'three';
import type { Lyra3dState, Lyra3dWorldPoint } from '../core/contract.js';
import { orbitNearPlane, type Lyra3dOrbitCamera } from '../core/orbit.js';
import { encodePickId } from '../core/picking.js';
import type { Lyra3dViewport } from '../core/viewport.js';
import { validateGraphSpatialSizes } from './spatial-appearance.js';
import { spatialEdgePoint, spatialEdgeSegments, spatialNodeWorldRadius, spatialPrimitiveCount, type GraphPositionLookup, type GraphSpatialData } from './spatial-paths.js';

function eye(point: Lyra3dWorldPoint, camera: Lyra3dOrbitCamera): Lyra3dWorldPoint {
  const x = point.x - camera.target.x, y = point.y - camera.target.y, z = point.z - camera.target.z;
  const depth = Math.sin(camera.yaw) * x + Math.cos(camera.yaw) * z;
  return { x: Math.cos(camera.yaw) * x - Math.sin(camera.yaw) * z, y: Math.cos(camera.pitch) * y - Math.sin(camera.pitch) * depth,
    z: camera.distance - Math.sin(camera.pitch) * y - Math.cos(camera.pitch) * depth };
}
function clipped(a: Lyra3dWorldPoint, b: Lyra3dWorldPoint, near: number): [Lyra3dWorldPoint, Lyra3dWorldPoint] | null {
  if (a.z < near && b.z < near) return null;
  const mix = (from: Lyra3dWorldPoint, to: Lyra3dWorldPoint) => { const t = (near - from.z) / (to.z - from.z); return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, z: near }; };
  return [a.z < near ? mix(a, b) : a, b.z < near ? mix(b, a) : b];
}
const vertex = `
attribute vec3 screenStart; attribute vec3 screenEnd; attribute vec3 stroke;
attribute vec2 pickDepth; attribute vec4 edgeColor; attribute vec3 pickColor; attribute vec3 dash;
uniform vec4 viewWindow;
varying vec4 tint; varying vec2 pattern; varying vec3 arrowUv; varying vec3 cap; varying float strokeRadius; flat varying vec2 depthEnds;
void main(){
  vec2 delta=screenEnd.xy-screenStart.xy; float span=length(delta);
  #ifdef PICKING
    float width=stroke.y; tint=vec4(pickColor,1.0);
  #else
    float width=stroke.x; tint=edgeColor;
  #endif
  #ifndef PICKING
    if(edgeColor.a<=0.0)width=0.0;
  #endif
  strokeRadius=width*0.5; depthEnds=pickDepth;
  pattern=vec2(dash.x,dash.y+uv.x*dash.z); arrowUv=vec3(uv,stroke.z);
  if(width<=0.0 || span<0.0001){gl_Position=vec4(2.0,2.0,2.0,1.0);return;}
  vec3 point=mix(screenStart,screenEnd,uv.x);
  cap=vec3(uv.x*span,position.y*width*0.5,span);
  #ifdef PICKING
    point.z=(pickDepth.x+(pickDepth.y-pickDepth.x)*uv.x)*2.0-1.0;
    point.xy+=delta/span*(uv.x*2.0-1.0)*width*0.5;
    cap.x+= (uv.x*2.0-1.0)*width*0.5;
    cap.z=span;
  #endif
  point.xy+=vec2(-delta.y,delta.x)/span*position.y*width*0.5;
  vec2 ndc=(point.xy-viewWindow.xy)/viewWindow.zw*2.0-1.0;
  gl_Position=vec4(ndc.x,-ndc.y,point.z,1.0);
}`;
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

/** Batched projected strokes: segment expansion never changes the public edge row identity. */
export function createGraphSpatialEdges(data: GraphSpatialData) {
  const appearance = data.spatialAppearance;
  validateGraphSpatialSizes(data.sizes, data.nodeCount, appearance);
  const count = spatialPrimitiveCount(data);
  const plane = new PlaneGeometry(2, 2), geometry = new InstancedBufferGeometry(); geometry.index = plane.index; geometry.attributes = { ...plane.attributes }; geometry.instanceCount = count; plane.dispose();
  const start = new InstancedBufferAttribute(new Float32Array(count * 3), 3), end = new InstancedBufferAttribute(new Float32Array(count * 3), 3);
  const stroke = new InstancedBufferAttribute(new Float32Array(count * 3), 3), colors = new InstancedBufferAttribute(new Float32Array(count * 4), 4);
  const pickDepth = new InstancedBufferAttribute(new Float32Array(count * 2), 2);
  const picks = new InstancedBufferAttribute(new Float32Array(count * 3), 3), dash = new InstancedBufferAttribute(new Float32Array(count * 3), 3);
  geometry.setAttribute('pickDepth', pickDepth); geometry.setAttribute('screenStart', start); geometry.setAttribute('screenEnd', end); geometry.setAttribute('stroke', stroke); geometry.setAttribute('edgeColor', colors); geometry.setAttribute('pickColor', picks); geometry.setAttribute('dash', dash);
  const mutablePatterns: number[][] = [[]]; const byPattern = new Map<string, number>([['', 0]]); const patternRows = new Uint32Array(data.source.length);
  for (let row = 0; row < data.source.length; row++) {
    const pattern = appearance.dangling?.[row] ? [4, 4] : appearance.edgeDashes?.[row] ?? []; const key = pattern.join(',');
    let index = byPattern.get(key); if (index === undefined) { index = mutablePatterns.length; byPattern.set(key, index); mutablePatterns.push([...pattern]); } patternRows[row] = index;
  }
  const height = Math.max(1, Math.ceil(mutablePatterns.length * 64 / 2048)), values = new Float32Array(2048 * height);
  mutablePatterns.forEach((pattern, row) => { values[row * 64] = pattern.length; values[row * 64 + 1] = pattern.reduce((sum, value) => sum + value, 0); values.set(pattern, row * 64 + 2); });
  const texture = new DataTexture(values, 2048, height, RedFormat, FloatType); texture.minFilter = texture.magFilter = NearestFilter; texture.generateMipmaps = false; texture.needsUpdate = true;
  const window = new Vector4(0, 0, 1, 1), pickWindow = new Vector4(0, 0, 1, 1);
  const material = new ShaderMaterial({ side: DoubleSide, forceSinglePass: true, uniforms: { viewWindow: { value: window }, dashAtlas: { value: texture }, atlasHeight: { value: height } }, vertexShader: vertex, fragmentShader: fragment, transparent: true });
  const pickMaterial = new ShaderMaterial({ side: DoubleSide, forceSinglePass: true, uniforms: { viewWindow: { value: pickWindow } }, vertexShader: vertex, fragmentShader: fragment, defines: { PICKING: 1 }, blending: NoBlending, toneMapped: false });
  const mesh = new Mesh(geometry, material), pick = new Mesh(geometry, pickMaterial); mesh.frustumCulled = pick.frustumCulled = false;
  pick.onBeforeRender = (_renderer, _scene, camera) => {
    const view = camera instanceof PerspectiveCamera ? camera.view : null;
    if (view?.enabled) pickWindow.set(view.offsetX, view.offsetY, view.width, view.height); else pickWindow.copy(window);
    pickMaterial.uniformsNeedUpdate = true;
  };
  const color = new Color(); let disposed = false;
  const depths = new Float64Array(count), order = new Uint32Array(count), scratch = new Float32Array(count * 4);
  return { mesh, pick,
    depthAt(index: number) { return depths[order[index]!]!; },
    update(viewport: Lyra3dViewport, position: GraphPositionLookup, state: Lyra3dState) {
      if (disposed) return;
      window.set(0, 0, viewport.width, viewport.height); const style = viewport.style, near = orbitNearPlane(viewport.orbit), far = Math.max(near * 10, viewport.orbit.distance * 4 + 1e4);
      const project = (point: Lyra3dWorldPoint) => { const scale = viewport.height / (2 * Math.tan(Math.PI / 8) * point.z); return { x: viewport.width / 2 + point.x * scale, y: viewport.height / 2 + point.y * scale, z: (far + near) / (far - near) - (2 * far * near) / ((far - near) * point.z) }; };
      let index = 0, translucent = false;
      for (let edge = 0; edge < data.source.length; edge++) {
        const segments = spatialEdgeSegments(data, edge), item = data.nodeCount + edge;
        const selected = state.selected.has(item) || state.hover === item;
        const raw = appearance.edgeColors; const rgba = selected ? style.accent : style.forcedColors ? style.foreground : raw ? { r: raw[edge * 4]!, g: raw[edge * 4 + 1]!, b: raw[edge * 4 + 2]!, a: raw[edge * 4 + 3]! } : style.muted;
        color.setRGB(rgba.r, rgba.g, rgba.b, SRGBColorSpace);
        const alpha = rgba.a * (!style.forcedColors && state.dimmed.has(item) ? appearance.dimmedOpacity ?? 0.35 : 1);
        const baseWidth = appearance.edgeWidths?.[edge] ?? style.lineWidth;
        const id = encodePickId(item)!; let offset = 0;
        for (let segment = 0; segment < segments; segment++, index++) {
          const a = spatialEdgePoint(data, edge, segment / segments, position, viewport), b = spatialEdgePoint(data, edge, (segment + 1) / segments, position, viewport);
          const clip = a && b ? clipped(eye(a, viewport.orbit), eye(b, viewport.orbit), near) : null;
          const eligible = baseWidth > 0 && (raw?.[edge * 4 + 3] ?? style.muted.a) > 0 && clip !== null;
          const visible = eligible && alpha > 0;
          if (visible && alpha < 1) translucent = true;
          order[index] = index; depths[index] = clip ? (clip[0].z + clip[1].z) / 2 : Infinity;
          const pa = clip ? project(clip[0]) : { x: 0, y: 0, z: 0 }, pb = clip ? project(clip[1]) : pa;
          const length = Math.hypot(pb.x - pa.x, pb.y - pa.y);
          start.setXYZ(index, pa.x, pa.y, pa.z); end.setXYZ(index, pb.x, pb.y, pb.z);
          pickDepth.setXY(index, clip ? project({ ...clip[0], z: clip[0].z + 0.001 }).z * 0.5 + 0.5 : 0, clip ? project({ ...clip[1], z: clip[1].z + 0.001 }).z * 0.5 + 0.5 : 0);
          stroke.setXYZ(index, visible ? baseWidth + (selected ? 2 : 0) : 0, eligible && !appearance.dangling?.[edge] ? Math.max(12, baseWidth) : 0, 0);
          colors.setXYZW(index, color.r, color.g, color.b, alpha); picks.setXYZ(index, id[0] / 255, id[1] / 255, id[2] / 255); dash.setXYZ(index, patternRows[edge]!, offset, length); offset += length;
        }
        if (data.directed?.[edge]) {
          const a = spatialEdgePoint(data, edge, 1 - 1 / segments, position, viewport), b = spatialEdgePoint(data, edge, 1, position, viewport);
          const terminal = a && b ? clipped(eye(a, viewport.orbit), eye(b, viewport.orbit), near) : null;
          const pa = terminal ? project(terminal[0]) : null, pb = b ? viewport.project(b) : null;
          const target = position(data.target[edge]!);
          const inset = pb && target && !appearance.dangling?.[edge] ? spatialNodeWorldRadius(data, data.target[edge]!, target, viewport) * pb.scale : 0;
          const dx = pa && pb ? pb.x - pa.x : 0, dy = pa && pb ? pb.y - pa.y : 0, span = Math.hypot(dx, dy);
          const height = Math.max(6, (baseWidth + (selected ? 2 : 0)) * 3), visible = pa && pb && span > 0 && baseWidth > 0 && (raw?.[edge * 4 + 3] ?? style.muted.a) > 0 && alpha > 0;
          const tipX = pb ? pb.x - dx / (span || 1) * inset : 0, tipY = pb ? pb.y - dy / (span || 1) * inset : 0;
          const depth = pb && b ? project(eye(b, viewport.orbit)).z : 0;
          order[index] = index; depths[index] = b ? eye(b, viewport.orbit).z : Infinity;
          if (visible && alpha < 1) translucent = true;
          start.setXYZ(index, tipX - dx / (span || 1) * height, tipY - dy / (span || 1) * height, depth); end.setXYZ(index, tipX, tipY, depth);
          stroke.setXYZ(index, visible ? height * Math.tan(0.45) * 2 : 0, 0, 1); colors.setXYZW(index, color.r, color.g, color.b, alpha); picks.setXYZ(index, id[0] / 255, id[1] / 255, id[2] / 255); dash.setXYZ(index, 0, 0, 0); index++;
        }
      }
      const attributes = [start, end, stroke, colors, picks, dash, pickDepth];
      if (translucent) {
        order.sort((a, b) => depths[b]! - depths[a]! || a - b);
        for (const attribute of attributes) {
          const array = attribute.array, size = attribute.itemSize;
          for (let row = 0; row < count; row++) for (let component = 0; component < size; component++) scratch[row * size + component] = array[order[row]! * size + component]!;
          array.set(scratch.subarray(0, count * size));
        }
      }
      if (material.transparent !== translucent) { material.transparent = translucent; material.needsUpdate = true; }
      material.depthWrite = !translucent;
      for (const attribute of attributes) attribute.needsUpdate = true;
    },
    dispose() { if (disposed) return; disposed = true; mesh.removeFromParent(); pick.removeFromParent(); geometry.dispose(); material.dispose(); pickMaterial.dispose(); texture.dispose(); },
  };
}
