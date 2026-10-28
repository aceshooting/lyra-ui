import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { encodeGraphMeshNormal, decodeGraphMeshNormal } from '../dist/graph/spatial-node-meshes.js';
const options={seed:0x5eed_1e57,numRuns:200,includeErrorInReport:true};
test('packed Float32 octahedral normals retain direction across every octant',()=>{
  fc.assert(fc.property(fc.tuple(...Array.from({length:3},()=>fc.integer({min:-10000,max:10000}))).filter(n=>n.some(v=>v!==0)),n=>{
    const length=Math.hypot(...n),unit=n.map(v=>v/length);
    const restored=decodeGraphMeshNormal(...encodeGraphMeshNormal(...unit).map(Math.fround));
    assert.ok(Math.abs(Math.hypot(...restored)-1)<1e-12);
    assert.ok(restored.every((v,i)=>Math.abs(v-unit[i])<2e-7));
  }),options);
});
