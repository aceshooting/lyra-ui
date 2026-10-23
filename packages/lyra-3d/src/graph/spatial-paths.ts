import { LYRA_3D_FIELD_OF_VIEW, orbitNearPlane, type Lyra3dOrbitCamera } from '../core/orbit.js';
import type { Lyra3dWorldPoint } from '../core/contract.js';
import type { Lyra3dViewport } from '../core/viewport.js';
import type { GraphSpatialAppearance } from './spatial-appearance.js';
export interface GraphSpatialData {
  readonly nodeCount: number;
  readonly source: Uint32Array;
  readonly target: Uint32Array;
  readonly sizes?: Float32Array;
  readonly directed?: Uint8Array;
  readonly spatialAppearance: GraphSpatialAppearance;
}
export type GraphPositionLookup = (row: number) => Lyra3dWorldPoint | null;
export function spatialNodeWorldRadius(data: GraphSpatialData, row: number, point: Lyra3dWorldPoint, viewport: Lyra3dViewport): number {
  const diameter = data.sizes?.[row] ?? viewport.style.pointSize;
  if (data.spatialAppearance.sizeUnits === 'world') return diameter / 2;
  const projection = viewport.project(point); return projection ? diameter / (2 * projection.scale) : 0;
}
export function spatialEdgeSegments(data: GraphSpatialData, edge: number): number {
  return !data.spatialAppearance.dangling?.[edge] && data.source[edge] === data.target[edge] ? 16 : 1;
}
/** Samples the same world path used by edge paint, arrows, labels and directional particles. */
export function spatialEdgePoint(data: GraphSpatialData, edge: number, t: number, position: GraphPositionLookup, viewport: Lyra3dViewport): Lyra3dWorldPoint | null {
  const source = data.source[edge]!; const a = position(source); if (!a) return null;
  if (data.spatialAppearance.dangling?.[edge]) return { x: a.x + 28 * t, y: a.y - 28 * t, z: a.z };
  if (source === data.target[edge]) { const radius = spatialNodeWorldRadius(data, source, a, viewport) * 1.6; return { x: a.x + Math.sin(t * Math.PI * 2) * radius, y: a.y - (1 - Math.cos(t * Math.PI * 2)) * radius, z: a.z }; }
  const b = position(data.target[edge]!); return b ? { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t } : null;
}

/** Bound expanded GPU attributes independently of the logical edge ceiling. */
const GRAPH_MAX_SPATIAL_PRIMITIVES = 2_000_000;
export function spatialPrimitiveCount(data: GraphSpatialData): number {
  let count = 0;
  for (let edge = 0; edge < data.source.length; edge++) {
    count += spatialEdgeSegments(data, edge) + (data.directed?.[edge] ? 1 : 0);
    if (count > GRAPH_MAX_SPATIAL_PRIMITIVES) throw new RangeError('Graph spatial geometry exceeds its primitive limit');
  }
  return count;
}

/**
 * Camera math shared by the spatial graph shaders and their CPU mirror. The GLSL below and the
 * functions in this module are line-for-line equivalents: the vertex shaders project every glyph and
 * stroke from world positions and camera uniforms, so a pure camera change uploads no attribute, and
 * the TypeScript twin lets unit tests pin that math against `projectOrbitPoint`.
 *
 * Eye space here is the orbit camera space: `x` right, `y` down, `z` the positive distance along the
 * view. Screen points are CSS pixels from the top-left of the full viewport plus an NDC depth.
 */
export interface GraphEyePoint { readonly x: number; readonly y: number; readonly z: number }
/** Full viewport size in CSS pixels and the perspective depth range. */
export interface GraphSpatialView { readonly width: number; readonly height: number; readonly near: number; readonly far: number }

const TAN_HALF_FOV = Math.tan(LYRA_3D_FIELD_OF_VIEW / 2);
/** Window-depth bias that makes an edge lose an exact depth tie against a node glyph, in both the
 * pick pass and the opaque paint pass, independently of GPU rounding. About eight 24-bit ULPs. */
export const GRAPH_EDGE_DEPTH_BIAS = 2 ** -21;
/** Arrow heads are isosceles triangles whose half-angle is this many radians. */
export const GRAPH_ARROW_HALF_ANGLE = 0.45;

/** The depth range the viewport's perspective camera uses for `camera`. */
export function graphSpatialView(width: number, height: number, camera: Lyra3dOrbitCamera): GraphSpatialView {
  const near = orbitNearPlane(camera);
  return { width: Math.max(1, width), height: Math.max(1, height), near, far: Math.max(near * 10, camera.distance * 4 + 1e4) };
}
/** CSS pixels per world unit at eye depth `depth`. */
export function graphScale(depth: number, view: GraphSpatialView): number {
  return view.height / (2 * TAN_HALF_FOV * depth);
}
/** Perspective NDC depth in [-1, 1] of eye depth `depth`; window depth is `ndc * 0.5 + 0.5`. */
export function graphNdcDepth(depth: number, view: GraphSpatialView): number {
  const { near, far } = view;
  return (far + near) / (far - near) - (2 * far * near) / ((far - near) * depth);
}
export function graphScreen(eye: GraphEyePoint, view: GraphSpatialView): GraphEyePoint {
  const scale = graphScale(eye.z, view);
  return { x: view.width * 0.5 + eye.x * scale, y: view.height * 0.5 + eye.y * scale, z: graphNdcDepth(eye.z, view) };
}
/** Clips an eye-space segment at the near plane; `null` when it lies wholly behind it. */
export function graphClipSegment(a: GraphEyePoint, b: GraphEyePoint, near: number): [GraphEyePoint, GraphEyePoint] | null {
  if (a.z < near && b.z < near) return null;
  const toward = (from: GraphEyePoint, to: GraphEyePoint) => {
    const t = (near - from.z) / (to.z - from.z);
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, z: near };
  };
  return [a.z < near ? toward(a, b) : a, b.z < near ? toward(b, a) : b];
}
/** Orbit eye space of a world point, matching the shader's model-view transform. */
export function graphEye(point: GraphEyePoint, camera: Lyra3dOrbitCamera): GraphEyePoint {
  const dx = point.x - camera.target.x, dy = point.y - camera.target.y, dz = point.z - camera.target.z;
  const x = Math.cos(camera.yaw) * dx - Math.sin(camera.yaw) * dz, z = Math.sin(camera.yaw) * dx + Math.cos(camera.yaw) * dz;
  return { x, y: Math.cos(camera.pitch) * dy - Math.sin(camera.pitch) * z, z: camera.distance - (Math.sin(camera.pitch) * dy + Math.cos(camera.pitch) * z) };
}
/** Unit vector along which eye depth decreases: painter order is ascending `dot(point, forward)`. */
export function graphViewForward(camera: Pick<Lyra3dOrbitCamera, 'yaw' | 'pitch'>): [number, number, number] {
  const cp = Math.cos(camera.pitch);
  return [cp * Math.sin(camera.yaw), Math.sin(camera.pitch), cp * Math.cos(camera.yaw)];
}

const SQUARE = Math.sqrt(Math.PI) / 2;
const DIAMOND = Math.sqrt(Math.PI / 2);
/** Glyph radius and quad half-extents (paint, pick) for a node; all zero behind the near plane. */
export function graphNodeExtents(eye: GraphEyePoint, size: number, shape: number, selected: boolean, expanded: boolean, worldSizes: boolean, markerArm: number, view: GraphSpatialView) {
  if (eye.z < view.near) return { radius: 0, paint: 0, pick: 0 };
  const radius = Math.min(Math.max(view.width, view.height) * 2, worldSizes ? size * graphScale(eye.z, view) : size);
  const body = shape > 1.5 ? radius * DIAMOND : shape > 0.5 ? radius * SQUARE : radius;
  const pick = shape > 1.5 ? Math.max(12, radius) * DIAMOND : shape > 0.5 ? Math.max(12, radius * SQUARE) : Math.max(12, radius);
  return { radius, paint: Math.max(body, selected ? radius + 5 : 0, expanded ? radius + markerArm : 0), pick };
}
/** World point `t` of a straight (`loopRadius <= 0`) or self-loop path; loop radii in CSS pixels
 * resolve at the loop centre's depth. */
export function graphPathPoint(start: GraphEyePoint, end: GraphEyePoint, loopRadius: number, t: number, centreDepth: number, worldSizes: boolean, view: GraphSpatialView): GraphEyePoint {
  if (loopRadius <= 0) return t <= 0 ? start : t >= 1 ? end : { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t, z: start.z + (end.z - start.z) * t };
  if (t <= 0 || t >= 1) return start;
  const radius = worldSizes ? loopRadius : centreDepth < view.near ? 0 : loopRadius / graphScale(centreDepth, view);
  const angle = t * Math.PI * 2;
  return { x: start.x + Math.sin(angle) * radius, y: start.y - (1 - Math.cos(angle)) * radius, z: start.z };
}
/** Screen endpoints of a stroke segment, or `null` when it is behind the camera. */
export function graphSegmentScreen(a: GraphEyePoint, b: GraphEyePoint, view: GraphSpatialView): [GraphEyePoint, GraphEyePoint] | null {
  const clip = graphClipSegment(a, b, view.near);
  return clip ? [graphScreen(clip[0], view), graphScreen(clip[1], view)] : null;
}
/** Arrow quad (tail, tip) for the terminal segment `a`→`b`, inset by a node radius in CSS pixels
 * (`worldSizes`: world units at the tip's depth), or `null` when hidden. */
export function graphArrowScreen(a: GraphEyePoint, b: GraphEyePoint, inset: number, width: number, worldSizes: boolean, view: GraphSpatialView): [GraphEyePoint, GraphEyePoint] | null {
  if (b.z < view.near) return null;
  const clip = graphClipSegment(a, b, view.near)!;
  const tail = graphScreen(clip[0], view), head = graphScreen(b, view);
  const dx = head.x - tail.x, dy = head.y - tail.y, span = Math.hypot(dx, dy);
  if (!(span > 0)) return null;
  const height = width / (2 * Math.tan(GRAPH_ARROW_HALF_ANGLE)), pixels = worldSizes ? inset * graphScale(b.z, view) : inset;
  const tipX = head.x - dx / span * pixels, tipY = head.y - dy / span * pixels;
  return [{ x: tipX - dx / span * height, y: tipY - dy / span * height, z: head.z }, { x: tipX, y: tipY, z: head.z }];
}

const glsl = (value: number) => { const text = String(value); return /[.e]/u.test(text) ? text : `${text}.0`; };
/** Shared uniforms and helpers; `lyraView` is (width, height, near, far) of the full viewport. */
export const graphSpatialProjectionChunk = `
uniform vec4 lyraView; uniform float worldSizes;
vec3 lyraGraphEye(vec3 point){ vec4 eye=modelViewMatrix*vec4(point,1.0); return vec3(eye.x,-eye.y,-eye.z); }
float lyraGraphScale(float depth){ return lyraView.y/(2.0*${glsl(TAN_HALF_FOV)}*depth); }
float lyraGraphNdcDepth(float depth){ float near=lyraView.z,far=lyraView.w; return (far+near)/(far-near)-(2.0*far*near)/((far-near)*depth); }
vec3 lyraGraphScreen(vec3 eye){ float scale=lyraGraphScale(eye.z); return vec3(lyraView.x*0.5+eye.x*scale,lyraView.y*0.5+eye.y*scale,lyraGraphNdcDepth(eye.z)); }
bool lyraGraphClip(inout vec3 a, inout vec3 b){
  float near=lyraView.z;
  if(a.z<near && b.z<near) return false;
  if(a.z<near){ float t=(near-a.z)/(b.z-a.z); a=vec3(a.xy+(b.xy-a.xy)*t,near); }
  else if(b.z<near){ float t=(near-b.z)/(a.z-b.z); b=vec3(b.xy+(a.xy-b.xy)*t,near); }
  return true;
}
vec3 lyraGraphPathPoint(vec3 start, vec3 end, float loopRadius, float t, float centreDepth){
  if(loopRadius<=0.0) return t<=0.0?start:t>=1.0?end:start+(end-start)*t;
  if(t<=0.0 || t>=1.0) return start;
  float radius=worldSizes>0.5?loopRadius:centreDepth<lyraView.z?0.0:loopRadius/lyraGraphScale(centreDepth);
  float angle=t*${glsl(Math.PI * 2)};
  return start+vec3(sin(angle)*radius,-(1.0-cos(angle))*radius,0.0);
}
`;

/** Node glyph vertex stage; the fragment stage is `graphSpatialNodeFragment`. */
export const graphSpatialNodeVertexChunk = `
uniform vec2 viewportSize; uniform float markerArm;
flat varying float pickDepth;
varying vec2 offset; varying float radius; varying float shape; varying vec2 flags;
varying vec4 fill; varying vec4 ring; varying vec4 marker;
void graphSpatialNodeVertex(vec3 centre, float size, float glyph, vec2 state, vec4 paintFill, vec4 paintRing, vec4 paintMarker, vec3 pickId){
  vec3 eye=lyraGraphEye(centre);
  bool shown=eye.z>=lyraView.z;
  float r=shown?min(max(lyraView.x,lyraView.y)*2.0,worldSizes>0.5?size*lyraGraphScale(eye.z):size):0.0;
  float body=glyph>1.5?r*${glsl(DIAMOND)}:glyph>0.5?r*${glsl(SQUARE)}:r;
  float hit=glyph>1.5?max(12.0,r)*${glsl(DIAMOND)}:glyph>0.5?max(12.0,r*${glsl(SQUARE)}):max(12.0,r);
  vec2 extent=shown?vec2(max(max(body,state.x>0.5?r+5.0:0.0),state.y>0.5?r+markerArm:0.0),hit):vec2(0.0);
  radius=r; shape=glyph; flags=state; pickDepth=lyraGraphNdcDepth(eye.z)*0.5+0.5;
  #ifdef PICKING
    offset=position.xy*extent.y; fill=vec4(pickId,1.0);
  #else
    offset=position.xy*extent.x; fill=paintFill;
  #endif
  ring=paintRing; marker=paintMarker;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(centre,1.0);
  gl_Position.xy+=offset*2.0/viewportSize*gl_Position.w;
  // Glyphs and strokes share a mixed instanced draw. Keep their homogeneous coordinates in the
  // same screen-space convention; each glyph quad has constant eye depth and clip-space w.
  if(shown) gl_Position=vec4(gl_Position.xyz/gl_Position.w,1.0);
}
`;

/**
 * Stroke vertex stage. `path` is (t0, t1, loop radius, arrow inset), `stroke` is (paint width,
 * pick width, arrow flag), widths in CSS pixels. Screen expansion, near clipping, dash offsets,
 * arrow placement and pick depth all derive from the current camera here.
 */
export const graphSpatialEdgeVertexChunk = `
uniform vec4 viewWindow;
varying vec4 tint; varying vec2 pattern; varying vec3 arrowUv; varying vec3 cap; varying float strokeRadius; flat varying vec2 depthEnds;
float lyraGraphLoopOffset(vec3 centre, float loopRadius, float t0, float centreDepth){
  float offset=0.0; int count=int(t0*16.0+0.5);
  vec3 previous=lyraGraphEye(centre);
  for(int i=0;i<16;i++){
    if(i>=count) break;
    vec3 next=lyraGraphEye(lyraGraphPathPoint(centre,centre,loopRadius,float(i+1)/16.0,centreDepth));
    vec3 a=previous, b=next;
    if(lyraGraphClip(a,b)) offset+=length(lyraGraphScreen(b).xy-lyraGraphScreen(a).xy);
    previous=next;
  }
  return offset;
}
void graphSpatialEdgeVertex(vec3 start, vec3 end, vec4 path, vec3 stroke, vec4 color, vec3 pickId, float dashRow){
  #ifdef PICKING
    float width=stroke.y; tint=vec4(pickId,1.0);
  #else
    float width=stroke.x; tint=color;
    if(color.a<=0.0) width=0.0;
  #endif
  strokeRadius=width*0.5; depthEnds=vec2(0.0); pattern=vec2(dashRow,0.0); arrowUv=vec3(uv,stroke.z); cap=vec3(0.0);
  gl_Position=vec4(2.0,2.0,2.0,1.0);
  if(width<=0.0) return;
  float centreDepth=path.z>0.0?lyraGraphEye(start).z:0.0;
  vec3 a=lyraGraphEye(lyraGraphPathPoint(start,end,path.z,path.x,centreDepth));
  vec3 b=lyraGraphEye(lyraGraphPathPoint(start,end,path.z,path.y,centreDepth));
  vec3 screenStart; vec3 screenEnd;
  if(stroke.z>0.5){
    if(b.z<lyraView.z) return;
    lyraGraphClip(a,b);
    vec3 tail=lyraGraphScreen(a), head=lyraGraphScreen(b);
    vec2 toward=head.xy-tail.xy; float reach=length(toward);
    if(!(reach>0.0)) return;
    vec2 direction=toward/reach;
    float height=width/(2.0*tan(${glsl(GRAPH_ARROW_HALF_ANGLE)}));
    vec2 tip=head.xy-direction*(worldSizes>0.5?path.w*lyraGraphScale(b.z):path.w);
    screenStart=vec3(tip-direction*height,head.z); screenEnd=vec3(tip,head.z);
  } else {
    if(!lyraGraphClip(a,b)) return;
    screenStart=lyraGraphScreen(a); screenEnd=lyraGraphScreen(b);
    #ifdef PICKING
      depthEnds=vec2(lyraGraphNdcDepth(a.z+0.001),lyraGraphNdcDepth(b.z+0.001))*0.5+0.5+${glsl(GRAPH_EDGE_DEPTH_BIAS)};
    #else
      if(path.z>0.0 && path.x>0.0) pattern.y=lyraGraphLoopOffset(start,path.z,path.x,centreDepth);
    #endif
  }
  vec2 delta=screenEnd.xy-screenStart.xy; float span=length(delta);
  if(span<0.0001) return;
  vec3 point=mix(screenStart,screenEnd,uv.x);
  pattern.y+=uv.x*span;
  cap=vec3(uv.x*span,position.y*width*0.5,span);
  #ifdef PICKING
    point.z=(depthEnds.x+(depthEnds.y-depthEnds.x)*uv.x)*2.0-1.0;
    point.xy+=delta/span*(uv.x*2.0-1.0)*width*0.5;
    cap.x+=(uv.x*2.0-1.0)*width*0.5;
    cap.z=span;
  #else
    point.z+=${glsl(2 * GRAPH_EDGE_DEPTH_BIAS)};
  #endif
  point.xy+=vec2(-delta.y,delta.x)/span*position.y*width*0.5;
  vec2 ndc=(point.xy-viewWindow.xy)/viewWindow.zw*2.0-1.0;
  gl_Position=vec4(ndc.x,-ndc.y,point.z,1.0);
}
`;
