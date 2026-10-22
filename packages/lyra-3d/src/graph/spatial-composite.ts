import { DoubleSide, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, PlaneGeometry, ShaderMaterial, Vector2 } from 'three';
import type { Lyra3dViewport } from '../core/viewport.js';
import { graphSpatialNodeFragment, type createGraphSpatialNodes } from './spatial-nodes.js';
import { graphSpatialEdgeFragment, type createGraphSpatialEdges } from './spatial-edges.js';

const nodePaintSlots = [[2, 'nodeFill'], [3, 'nodeRing'], [4, 'nodeMarker']] as const;
const vertex = `
attribute vec4 payload0; attribute vec4 payload1; attribute vec4 payload2; attribute vec4 payload3; attribute vec4 payload4;
uniform vec2 viewportSize;
varying float primitiveKind;
varying vec2 offset; varying float radius; varying float shape; varying vec2 flags;
varying vec4 fill; varying vec4 ring; varying vec4 marker;
varying vec4 tint; varying vec2 pattern; varying vec3 arrowUv; varying vec3 cap; varying float strokeRadius; flat varying vec2 depthEnds;
void main() {
  primitiveKind = payload4.a < 0.0 ? 0.0 : 1.0;
  offset=vec2(0.0); radius=0.0; shape=0.0; flags=vec2(0.0);
  fill=vec4(0.0); ring=vec4(0.0); marker=vec4(0.0);
  tint=vec4(0.0); pattern=vec2(0.0); arrowUv=vec3(0.0); cap=vec3(0.0); strokeRadius=0.0; depthEnds=vec2(0.0);
  if (primitiveKind > 0.5) {
    offset=position.xy*payload1.y; radius=payload0.w; shape=payload1.x; flags=payload1.zw;
    fill=payload2; ring=payload3; marker=payload4;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(payload0.xyz,1.0);
    gl_Position.xy+=offset*2.0/viewportSize*gl_Position.w;
  } else {
    vec2 delta=payload1.xy-payload0.xy; float span=length(delta); float width=payload0.w;
    tint=payload2; pattern=vec2(payload3.x,payload3.y+uv.x*payload3.z); arrowUv=vec3(uv,payload1.w);
    if(width<=0.0 || span<0.0001){gl_Position=vec4(2.0,2.0,2.0,1.0);return;}
    vec3 point=mix(payload0.xyz,payload1.xyz,uv.x);
    point.xy+=vec2(-delta.y,delta.x)/span*position.y*width*0.5;
    vec2 ndc=point.xy/viewportSize*2.0-1.0; gl_Position=vec4(ndc.x,-ndc.y,point.z,1.0);
  }
}`;
const fragment = graphSpatialNodeFragment + graphSpatialEdgeFragment + `
varying float primitiveKind;
void main(){ if(primitiveKind>0.5) paintGraphSpatialNode(); else paintGraphSpatialEdge(); }
`;

/** One painter-ordered visual draw across glyphs and strokes; pick meshes retain row identity. */
export function createGraphSpatialComposite(nodes: ReturnType<typeof createGraphSpatialNodes>, edges: ReturnType<typeof createGraphSpatialEdges>) {
  const nodeCount = nodes.mesh.geometry.instanceCount, edgeCount = edges.mesh.geometry.instanceCount;
  const count = nodeCount + edgeCount, order = new Uint32Array(count);
  const plane = new PlaneGeometry(2, 2), geometry = new InstancedBufferGeometry();
  geometry.index = plane.index; geometry.attributes = { ...plane.attributes }; plane.dispose(); geometry.instanceCount = 0;
  const payloads = Array.from({ length: 5 }, (_, i) => {
    const attribute = new InstancedBufferAttribute(new Float32Array(count * 4), 4);
    geometry.setAttribute(`payload${i}`, attribute); return attribute;
  });
  const viewportSize = new Vector2(1, 1);
  const material = new ShaderMaterial({ side: DoubleSide, forceSinglePass: true, vertexShader: vertex, fragmentShader: fragment, transparent: true, depthWrite: false, depthTest: true,
    uniforms: { viewportSize: { value: viewportSize }, markerArm: nodes.mesh.material.uniforms['markerArm']!,
      dashAtlas: edges.mesh.material.uniforms['dashAtlas']!, atlasHeight: edges.mesh.material.uniforms['atlasHeight']! } });
  const mesh = new Mesh(geometry, material); mesh.frustumCulled = false; let disposed = false;
  const node = (name: string) => nodes.mesh.geometry.getAttribute(name);
  const edge = (name: string) => edges.mesh.geometry.getAttribute(name);
  const depth = (index: number) => index < edgeCount ? edges.depthAt(index) : nodes.depthAt(index - edgeCount);
  return { mesh,
    update(viewport: Pick<Lyra3dViewport, 'width' | 'height'>) {
      if (disposed) return;
      viewportSize.set(Math.max(1, viewport.width), Math.max(1, viewport.height));
      let active = 0;
      for (let i = 0; i < edgeCount; i++) if (edge('stroke').getX(i) > 0 && edge('edgeColor').getW(i) > 0) order[active++] = i;
      for (let i = 0; i < nodeCount; i++) if (node('nodeExtent').getX(i) > 0) order[active++] = edgeCount + i;
      const sorted = order.subarray(0, active); sorted.sort((a, b) => depth(b) - depth(a) || a - b);
      for (let row = 0; row < active; row++) {
        const index = sorted[row]!;
        if (index < edgeCount) {
          const a = edge('screenStart'), b = edge('screenEnd'), stroke = edge('stroke'), dash = edge('dash'), color = edge('edgeColor');
          payloads[0]!.setXYZW(row, a.getX(index), a.getY(index), a.getZ(index), stroke.getX(index));
          payloads[1]!.setXYZW(row, b.getX(index), b.getY(index), b.getZ(index), stroke.getZ(index));
          payloads[2]!.setXYZW(row, color.getX(index), color.getY(index), color.getZ(index), color.getW(index));
          payloads[3]!.setXYZW(row, dash.getX(index), dash.getY(index), dash.getZ(index), 0);
          payloads[4]!.setXYZW(row, 0, 0, 0, -1);
        } else {
          const i = index - edgeCount, position = node('nodePosition'), flags = node('nodeFlags');
          payloads[0]!.setXYZW(row, position.getX(i), position.getY(i), position.getZ(i), node('nodeRadius').getX(i));
          payloads[1]!.setXYZW(row, node('nodeShape').getX(i), node('nodeExtent').getX(i), flags.getX(i), flags.getY(i));
          for (const [slot, name] of nodePaintSlots) {
            const color = node(name); payloads[slot]!.setXYZW(row, color.getX(i), color.getY(i), color.getZ(i), color.getW(i));
          }
        }
      }
      geometry.instanceCount = active; for (const payload of payloads) payload.needsUpdate = true;
    },
    dispose() { if (disposed) return; disposed = true; mesh.removeFromParent(); geometry.dispose(); material.dispose(); },
  };
}
