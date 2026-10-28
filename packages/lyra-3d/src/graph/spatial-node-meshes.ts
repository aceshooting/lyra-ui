import { DoubleSide, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, ShaderMaterial } from 'three';
import { graphSpatialProjectionChunk } from './spatial-paths.js';

/** Octahedral unit-normal encoding; both coordinates remain in the closed unit square. */
export function encodeGraphMeshNormal(x: number, y: number, z: number): [number, number] {
  const length = Math.abs(x) + Math.abs(y) + Math.abs(z);
  x /= length; y /= length;
  return z < 0 ? [(1 - Math.abs(y)) * (x < 0 ? -1 : 1), (1 - Math.abs(x)) * (y < 0 ? -1 : 1)] : [x, y];
}
export function decodeGraphMeshNormal(x: number, y: number): [number, number, number] {
  const z = 1 - Math.abs(x) - Math.abs(y);
  if (z < 0) { const previous = x; x = (1 - Math.abs(y)) * (x < 0 ? -1 : 1); y = (1 - Math.abs(previous)) * (y < 0 ? -1 : 1); }
  const length = Math.hypot(x, y, z); return [x / length, y / length, z / length];
}
/** Writes one face without allocating additional per-primitive attributes.
 * The negative owner tag reserves an exactly representable quarter for nonpickable bodies;
 * floor(-tag - 2) remains the original row even at the largest admitted node index. */
export function packGraphMeshFace(payloads: readonly Float32Array[], slot: number, owner: number, center: readonly number[], radius: number,
  positions: Float32Array, offset: number, normal: ArrayLike<number>, color: readonly number[], bodyPickable = true): void {
  const o = slot * 4, encoded = encodeGraphMeshNormal(normal[0]!, normal[1]!, normal[2]!);
  payloads[0]!.set([center[0]!, center[1]!, center[2]!, radius], o);
  for (let vertex = 0; vertex < 3; vertex++) payloads[vertex + 1]!.set(positions.subarray(offset + vertex * 3, offset + vertex * 3 + 3), o);
  payloads[1]![o + 3] = encoded[0]; payloads[2]![o + 3] = encoded[1]; payloads[3]![o + 3] = color[3]!;
  payloads[4]!.set([color[0]!, color[1]!, color[2]!, -2 - owner - (bodyPickable ? 0 : 0.25)], o);
}

export const graphSpatialMeshVertexChunk = `
flat varying vec3 meshNormal; flat varying vec4 meshPaint;
vec3 graphMeshNormal(vec2 oct) {
  vec3 n=vec3(oct,1.0-abs(oct.x)-abs(oct.y));
  if(n.z<0.0) n.xy=(1.0-abs(n.yx))*vec2(n.x<0.0?-1.0:1.0,n.y<0.0?-1.0:1.0);
  return normalize(n);
}
void graphSpatialMeshVertex(vec4 p0, vec4 p1, vec4 p2, vec4 p3, vec4 p4) {
  meshNormal=normalize(normalMatrix*graphMeshNormal(vec2(p1.w,p2.w)));
  meshPaint=vec4(p4.rgb,p3.w);
  float depth=lyraGraphEye(p0.xyz).z;
  float radius=p0.w;
  if(worldSizes<0.5) radius=depth>lyraView.z?radius/lyraGraphScale(depth):0.0;
  // Plane indices are (0,2,1),(2,3,1): collapse the bottom corners to B.
  vec3 local=position.y>0.0?(position.x<0.0?p1.xyz:p3.xyz):p2.xyz;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p0.xyz+local*radius,1.0);
  #ifdef PICKING
    float owner=-p4.w-2.0;
    if(radius<=0.0 || fract(owner)>0.125) gl_Position=vec4(2.0,2.0,2.0,1.0);
    float id=floor(owner)+1.0;
    meshPaint=vec4(mod(id,256.0),mod(floor(id/256.0),256.0),floor(id/65536.0),255.0)/255.0;
  #else
    if(radius<=0.0 || p3.w<=0.0) gl_Position=vec4(2.0,2.0,2.0,1.0);
  #endif
}`;
export const graphSpatialMeshFragment = `
uniform float meshForcedColors;
flat varying vec3 meshNormal; flat varying vec4 meshPaint;
void paintGraphSpatialMesh() {
  if(meshPaint.a<=0.0) discard;
  #ifdef PICKING
    gl_FragColor=meshPaint;
  #else
    vec3 n=normalize(meshNormal)*(gl_FrontFacing?1.0:-1.0);
    float light=meshForcedColors>0.5?1.0:0.35+0.65*max(0.0,dot(n,normalize(vec3(-0.4,-0.5,1.0))));
    gl_FragColor=vec4(meshPaint.rgb*light,meshPaint.a);
    #include <colorspace_fragment>
  #endif
}`;

/** A distinct GPU upload sharing the compositor's fixed unsorted CPU tail. */
export function createGraphSpatialMeshPick(staged: readonly Float32Array[], first: number, count: number, uniforms: ShaderMaterial['uniforms'], base: InstancedBufferGeometry) {
  const geometry = new InstancedBufferGeometry();
  geometry.index = base.index;
  for (const name of ['position', 'normal', 'uv']) geometry.setAttribute(name, base.getAttribute(name));
  geometry.instanceCount = count;
  for (let slot = 0; slot < 5; slot++) geometry.setAttribute(`payload${slot}`, new InstancedBufferAttribute(staged[slot]!.subarray(first * 4, (first + count) * 4), 4));
  const material = new ShaderMaterial({ side: DoubleSide, forceSinglePass: true, toneMapped: false, uniforms, defines: { PICKING: 1 },
    vertexShader: graphSpatialProjectionChunk + graphSpatialMeshVertexChunk + `
attribute vec4 payload0; attribute vec4 payload1; attribute vec4 payload2; attribute vec4 payload3; attribute vec4 payload4;
void main(){graphSpatialMeshVertex(payload0,payload1,payload2,payload3,payload4);}`,
    fragmentShader: graphSpatialMeshFragment + '\nvoid main(){paintGraphSpatialMesh();}' });
  const pick = new Mesh(geometry, material); pick.frustumCulled = false;
  return pick;
}
