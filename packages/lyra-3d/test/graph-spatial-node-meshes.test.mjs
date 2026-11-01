import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeGraphMeshNormal, decodeGraphMeshNormal, packGraphMeshFace } from '../dist/graph/spatial-node-meshes.js';

test('octahedral face normals round trip both hemispheres', () => {
  for (const n of [[1,0,0], [0,1,0], [0,0,1], [0,0,-1], [-1,-2,-3], [1,-4,2]]) {
    const length = Math.hypot(...n), unit = n.map(v => v / length);
    const encoded = encodeGraphMeshNormal(...unit).map(Math.fround);
    assert.ok(encoded.every(v => v >= -1 && v <= 1));
    const actual = decodeGraphMeshNormal(...encoded);
    assert.ok(actual.every((v, i) => Math.abs(v - unit[i]) < 1e-6));
  }
});

test('faces use exactly five vec4s, retaining XYZ, radius, alpha and original owner', () => {
  const payloads = Array.from({length: 5}, () => new Float32Array(8));
  const positions = new Float32Array([-.5,-.5,0, .5,-.5,0, 0,.5,.5]);
  packGraphMeshFace(payloads, 1, 199999, [10,20,30], 12, positions, 0, [0,-Math.SQRT1_2,Math.SQRT1_2], [1,.5,.25,.3]);
  assert.deepEqual([...payloads[0].subarray(4)], [10,20,30,12]);
  assert.deepEqual([...payloads[1].subarray(4,7)], [...positions.subarray(0,3)]);
  assert.deepEqual([...payloads[2].subarray(4,7)], [...positions.subarray(3,6)]);
  assert.deepEqual([...payloads[3].subarray(4,7)], [...positions.subarray(6,9)]);
  assert.equal(payloads[3][7], Math.fround(.3));
  assert.equal(payloads[4][7], -200001);
  assert.ok(payloads.every(p => p.subarray(0,4).every(v => v === 0)));
});

import { admitGraphSpatialAppearance, graphSpatialNodeMeshData } from '../dist/graph/spatial-appearance.js';
import { createGraphSpatialNodes } from '../dist/graph/spatial-nodes.js';
import { createGraphSpatialEdges } from '../dist/graph/spatial-edges.js';
import { createGraphSpatialComposite } from '../dist/graph/spatial-composite.js';
import { DEFAULT_ORBIT_CAMERA } from '../dist/core/orbit.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';
function fixture(alpha = 1) {
  const mesh = {positions: new Float32Array([-.5,-.5,0, .5,-.5,0, 0,.5,0]), normals: new Float32Array([0,0,1]), color:[1,0,0,alpha]};
  const appearance = admitGraphSpatialAppearance({nodeMeshes:[null,mesh]},2,0);
  const admitted = graphSpatialNodeMeshData(appearance);
  const data = {nodeCount:2, source:new Uint32Array(), target:new Uint32Array(), spatialAppearance:appearance};
  const nodes = createGraphSpatialNodes(data,admitted), edges = createGraphSpatialEdges(data), composite = createGraphSpatialComposite(nodes,edges,admitted);
  const view = {width:640,height:480,orbit:{...DEFAULT_ORBIT_CAMERA},style:resolveLyra3dStyle(),invalidate(){}};
  const state = {selected:new Set([1]),dimmed:new Set(),hover:-1,focus:-1};
  nodes.update(view,new Float32Array([0,0,0,20,0,0]),state);
  edges.update(view,()=>null,state); composite.update(view);
  return {nodes,edges,composite,view,admitted,dispose(){composite.dispose();nodes.dispose();edges.dispose();}};
}
test('custom pick shares five staged buffers, decodes owner, and camera updates do not upload local geometry',()=>{
  const f=fixture();
  assert.ok(f.composite.customPick);
  assert.equal(f.composite.customPick.geometry.instanceCount,1);
  const p=f.composite.customPick.geometry.getAttribute('payload4');
  assert.equal(p.getW(0),-3);
  const versions=Array.from({length:5},(_,i)=>f.composite.customPick.geometry.getAttribute(`payload${i}`).version);
  f.view.orbit={...f.view.orbit,yaw:1,distance:1200}; f.composite.update(f.view);
  assert.deepEqual(Array.from({length:5},(_,i)=>f.composite.customPick.geometry.getAttribute(`payload${i}`).version),versions);
  assert.equal(f.nodes.mesh.geometry.getAttribute('nodeShape').getX(1),-1);
  assert.equal(f.nodes.mesh.geometry.getAttribute('nodeFlags').getX(1),1);
  f.dispose();
});
test('all-null appearance has no custom metadata or pick geometry',()=>{
  const appearance=admitGraphSpatialAppearance({nodeMeshes:[null]},1,0);
  assert.equal(graphSpatialNodeMeshData(appearance),undefined);
  assert.equal(appearance.nodeMeshes,undefined);
});
test('physical allocation snapshot counts shared CPU backing once and separate pick GPU upload',()=>{
  const f=fixture(.5), accounting=f.composite.allocations();
  assert.equal(new Set(accounting.buffers).size,accounting.buffers.length);
  assert.equal(accounting.cpuBytes,accounting.buffers.reduce((total,buffer)=>total+buffer.byteLength,0));
  const pick=f.composite.customPick;
  for(let i=0;i<5;i++) assert.ok(accounting.buffers.includes(pick.geometry.getAttribute(`payload${i}`).array.buffer));
  const output=Array.from({length:5},(_,i)=>f.composite.mesh.geometry.getAttribute(`payload${i}`).array.byteLength).reduce((a,b)=>a+b,0);
  assert.equal(accounting.gpuAttributeBytes,output+80);
  assert.ok(accounting.sortKeyBytes>=8*f.composite.mesh.geometry.instanceCount);
  f.dispose();
});
test('nonpickable owner tag retains exact maximum row with no additional attribute',()=>{
  const payloads=Array.from({length:5},()=>new Float32Array(4));
  packGraphMeshFace(payloads,0,199999,[0,0,0],1,new Float32Array([0,0,0,.5,0,0,0,.5,0]),0,[0,0,1],[1,0,0,0],false);
  assert.equal(payloads[4][3],-200001.25);
  assert.equal(Math.floor(-payloads[4][3]-2),199999);
});
test('zero dimming hides paint but retains authored positive-alpha custom body identity',()=>{
  const f=fixture(1);
  // Reuse a style whose dimming multiplier is zero through a fresh admitted appearance.
  const appearance=admitGraphSpatialAppearance({nodeMeshes:f.admitted.nodeMeshes,dimmedOpacity:0},2,0);
  const admitted=graphSpatialNodeMeshData(appearance),data={nodeCount:2,source:new Uint32Array(),target:new Uint32Array(),spatialAppearance:appearance};
  const nodes=createGraphSpatialNodes(data,admitted),edges=createGraphSpatialEdges(data),composite=createGraphSpatialComposite(nodes,edges,admitted);
  const state={selected:new Set(),dimmed:new Set([1]),hover:-1,focus:-1};
  nodes.update(f.view,new Float32Array(6),state);edges.update(f.view,()=>null,state);composite.update(f.view);
  assert.equal(composite.customPick.geometry.getAttribute('payload3').getW(0),0);
  assert.equal(composite.customPick.geometry.getAttribute('payload4').getW(0),-3);
  assert.equal(nodes.bodyPickable(1),true);
  composite.dispose();nodes.dispose();edges.dispose();f.dispose();
});
test('CSS centroid order reverses on zoom and resize without uploading local face data',()=>{
  const body={positions:new Float32Array([-.5,-.5,.5,.5,-.5,.5,0,.5,.5]),normals:new Float32Array([0,0,1]),color:[1,0,0,.5]};
  const appearance=admitGraphSpatialAppearance({nodeMeshes:[body,null,null],edgeColors:new Float32Array([0,0,1,.5]),edgeWidths:new Float32Array([2])},3,1);
  const admitted=graphSpatialNodeMeshData(appearance),data={nodeCount:3,source:new Uint32Array([1]),target:new Uint32Array([2]),sizes:new Float32Array([100,0,0]),spatialAppearance:appearance};
  const nodes=createGraphSpatialNodes(data,admitted),edges=createGraphSpatialEdges(data),composite=createGraphSpatialComposite(nodes,edges,admitted);
  const view={width:640,height:480,orbit:{...DEFAULT_ORBIT_CAMERA},style:resolveLyra3dStyle(),invalidate(){}};
  const state={selected:new Set(),dimmed:new Set(),hover:-1,focus:-1},positions=new Float32Array([0,0,0,-50,0,30,50,0,30]);
  nodes.update(view,positions,state);edges.update(view,i=>({x:positions[i*3],y:positions[i*3+1],z:positions[i*3+2]}),state);composite.update(view);
  const order=()=>Array.from(composite.mesh.geometry.getAttribute('payload4').array).filter((_,i)=>i%4===3).slice(0,composite.mesh.geometry.instanceCount).filter(v=>v<0);
  const versions=()=>[1,2,3].map(i=>composite.customPick.geometry.getAttribute(`payload${i}`).version);
  assert.deepEqual(order(),[-2,-1]);const localVersions=versions();
  view.orbit={...view.orbit,distance:1000};composite.update(view);assert.deepEqual(order(),[-1,-2]);assert.deepEqual(versions(),localVersions);
  view.orbit={...view.orbit,distance:500};composite.update(view);assert.deepEqual(order(),[-2,-1]);
  view.height=240;composite.update(view);assert.deepEqual(order(),[-1,-2]);assert.deepEqual(versions(),localVersions);
  composite.dispose();nodes.dispose();edges.dispose();
});
