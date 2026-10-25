import assert from 'node:assert/strict';
import test from 'node:test';
import { ColorManagement, Material, BufferGeometry, Texture } from 'three';
import { LinearDisplayP3ColorSpace, LinearDisplayP3ColorSpaceImpl } from 'three/addons/math/ColorSpaces.js';
import { admitModel } from '../dist/model/admission.js';
import { parseModel } from '../dist/model/model-parsers.js';
import { snapshotModelInput } from '../dist/model/model-admission-policy.js';
import { createModelAdmissionWork } from '../dist/model/model-admission-kernel.js';
import { createModelDescriptorValidation } from '../dist/model/model-descriptor-validation.js';
import { createModelMaterialization, decodePreparedImages } from '../dist/model/model-materialization.js';
import { createModelDecoderServices } from '../dist/model/model-decoder-services.js';
import { createPreparedXyz } from '../dist/model/parsers/prepared-xyz.js';
import { createPreparedObj } from '../dist/model/parsers/prepared-obj.js';
import { createPreparedPly } from '../dist/model/parsers/prepared-ply.js';
import { createPreparedPcd } from '../dist/model/parsers/prepared-pcd.js';
import { createPreparedStl } from '../dist/model/parsers/prepared-stl.js';
import { createPreparedGltf } from '../dist/model/parsers/prepared-gltf.js';
import { drainModelWork } from '../dist/model/model-work.js';
import { plyFixture, pcdFixture } from './fixtures/model-prepared-binary.mjs';
import { binaryStl } from './fixtures/model-prepared-text.mjs';
import { interleavedFixture, stridedIndexFixture, appendAttribute } from './fixtures/model-prepared-gltf.mjs';
import { triangleJson, utf8, glbWithImage, png } from './model-fixtures.mjs';

const decoders={xyz:createPreparedXyz,obj:createPreparedObj,ply:createPreparedPly,pcd:createPreparedPcd,stl:createPreparedStl,gltf:createPreparedGltf,glb:createPreparedGltf};
function prepare(bytes,format) {
  const admitted=drainModelWork(createModelAdmissionWork(snapshotModelInput(bytes,format)));
  const allocation=createModelDecoderServices(admitted);
  const descriptor=drainModelWork(decoders[format](admitted,allocation.services),{bytes:7,scalars:7,records:7});
  drainModelWork(createModelDescriptorValidation(descriptor,admitted),{bytes:7,scalars:7,records:7});
  return {admitted,descriptor};
}
function snapshot(object) {
  const rows=[];
  object.traverse(node=>{
    const row={type:node.type,name:node.name,matrix:node.matrix.elements.slice(),children:node.children.length};
    if(node.geometry) {
      const g=node.geometry;
      row.attributes=Object.fromEntries(Object.entries(g.attributes).map(([name,a])=>[name,{array:Array.from(a.array),kind:a.array.constructor.name,itemSize:a.itemSize,count:a.count,normalized:a.normalized,stride:a.data?.stride??a.itemSize,offset:a.offset??0}]));
      row.index=g.index?{array:Array.from(g.index.array),kind:g.index.array.constructor.name,count:g.index.count,stride:g.index.data?.stride??1,offset:g.index.offset??0}:null;
      row.groups=g.groups;row.box=[g.boundingBox.min.toArray(),g.boundingBox.max.toArray()];row.sphere=[g.boundingSphere.center.toArray(),g.boundingSphere.radius];
      row.materials=(Array.isArray(node.material)?node.material:[node.material]).map(m=>({type:m.type,color:m.color.toArray(),emissive:m.emissive?.toArray(),specular:m.specular?.toArray(),opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite,side:m.side,vertexColors:m.vertexColors,size:m.size,sizeAttenuation:m.sizeAttenuation,flatShading:m.flatShading,aoMapIntensity:m.aoMapIntensity}));
    }
    rows.push(row);
  });
  return rows;
}
test('independent validation and bounded materialization retain all-format native output',async()=>{
  const sources=[['xyz',utf8('0 0 0\n1 2 3 128 0 255\n4 5 6\n')],['obj',utf8('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n')],['ply',plyFixture({faces:[[0,1,2]]}).input.input.bytes],['pcd',pcdFixture().input.input.bytes],['stl',binaryStl()],['gltf',utf8(JSON.stringify(triangleJson()))]];
  for(const[format,bytes]of sources){
    const reference=await parseModel(admitModel(bytes,format));const {admitted,descriptor}=prepare(bytes,format);let result;
    try{result=drainModelWork(createModelMaterialization(descriptor,admitted,new Map()),{bytes:1,scalars:1,records:1});assert.deepEqual(snapshot(result.object),snapshot(reference.object),format);assert.deepEqual(result.bounds,reference.bounds);assert.equal(result.vertices,reference.vertices);assert.equal(result.indices,reference.indices);}finally{result?.dispose();reference.dispose();}
  }
});
test('mixed XYZ authored colors retain main color settings while uncolored rows stay literal white',async()=>{
  const enabled=ColorManagement.enabled;const working=ColorManagement.workingColorSpace;const previous=Object.getOwnPropertyDescriptor(ColorManagement.spaces,LinearDisplayP3ColorSpace);
  const bytes=utf8('0 0 0\n1 2 3 128 64 255\n4 5 6\n');
  try{
    ColorManagement.define({[LinearDisplayP3ColorSpace]:LinearDisplayP3ColorSpaceImpl});ColorManagement.workingColorSpace=LinearDisplayP3ColorSpace;
    for(const value of[true,false]){ColorManagement.enabled=value;const reference=await parseModel(admitModel(bytes,'xyz'));const{admitted,descriptor}=prepare(bytes,'xyz');const mask=descriptor.geometries[0].attributes.color.colorConversion.authoredRows;assert.deepEqual(Array.from(mask),[0,1,0]);let result;try{result=drainModelWork(createModelMaterialization(descriptor,admitted,new Map()));assert.deepEqual(result.object.geometry.attributes.color.array,reference.object.geometry.attributes.color.array);}finally{result?.dispose();reference.dispose();}}
  }finally{ColorManagement.workingColorSpace=working;ColorManagement.enabled=enabled;if(previous)Object.defineProperty(ColorManagement.spaces,LinearDisplayP3ColorSpace,previous);else delete ColorManagement.spaces[LinearDisplayP3ColorSpace];}
});
test('decoder allocations reject unsupported kinds, overflow and accumulated excess before allocation',()=>{
  const admitted=drainModelWork(createModelAdmissionWork(snapshotModelInput(utf8('0 0 0'),'xyz')));const account=createModelDecoderServices(admitted);
  assert.throws(()=>account.services.allocateAttribute('invalid',1));assert.throws(()=>account.services.allocateAttribute('f64',Number.MAX_SAFE_INTEGER));
  account.services.allocateAttribute('u8',admitted.counts.decodedBytes);assert.equal(account.allocatedBytes,admitted.counts.decodedBytes);assert.throws(()=>account.services.allocateIndex('u8',1));
});
test('all admitted images are dimension checked and late aborted images are closed',async()=>{
  const original=globalThis.createImageBitmap;const admitted=drainModelWork(createModelAdmissionWork(snapshotModelInput(glbWithImage(png(),'image/png'),'glb')));let closed=0;let resolve;const controller=new AbortController();
  try{globalThis.createImageBitmap=()=>new Promise(done=>{resolve=done;});const pending=decodePreparedImages(admitted,controller.signal);controller.abort();resolve({width:1,height:1,close(){closed++;}});await assert.rejects(pending,{name:'AbortError'});assert.equal(closed,1);
    globalThis.createImageBitmap=async()=>({width:2,height:1,close(){closed++;}});await assert.rejects(decodePreparedImages(admitted));assert.equal(closed,2);
  }finally{if(original===undefined)delete globalThis.createImageBitmap;else globalThis.createImageBitmap=original;}
});

test('cancelled materialization releases constructed resources and every owned image once',()=>{
  const {admitted,descriptor}=prepare(utf8('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n'),'obj');
  const oldMaterial=Material.prototype.dispose;const oldGeometry=BufferGeometry.prototype.dispose;let materialDisposals=0;let geometryDisposals=0;let imageDisposals=0;
  try{
    Material.prototype.dispose=function(){materialDisposals++;return oldMaterial.call(this);};BufferGeometry.prototype.dispose=function(){geometryDisposals++;return oldGeometry.call(this);};
    const work=createModelMaterialization(descriptor,admitted,new Map([[0,{close(){imageDisposals++;}}]]));
    for(let i=0;i<8;i++){const step=work.step({bytes:1,scalars:1,records:1});assert.equal(step.done,false);}
    work.dispose();work.dispose();assert.equal(materialDisposals,1);assert.equal(geometryDisposals,1);assert.equal(imageDisposals,1);assert.throws(()=>work.step({bytes:1,scalars:1,records:1}),/no longer active/);
  }finally{Material.prototype.dispose=oldMaterial;BufferGeometry.prototype.dispose=oldGeometry;}
});

for (const kind of ['interleaved-attributes', 'interleaved-indices', 'normalized-uv']) test(`bounded materialization preserves native ${kind} storage and effective values`, async () => {
  const document = kind === 'interleaved-attributes' ? interleavedFixture() : kind === 'interleaved-indices' ? stridedIndexFixture() : triangleJson();
  if (kind === 'normalized-uv') document.meshes[0].primitives[0].attributes.TEXCOORD_0 = appendAttribute(document, new Uint16Array([0, 0, 65535, 0, 0, 65535]), 2, 5123, true);
  const bytes = utf8(JSON.stringify(document)); const reference = await parseModel(admitModel(bytes, 'gltf'));
  const { admitted, descriptor } = prepare(bytes, 'gltf'); let result;
  try {
    result = drainModelWork(createModelMaterialization(descriptor, admitted, new Map()), { bytes: 1, scalars: 1, records: 1 });
    assert.deepEqual(snapshot(result.object), snapshot(reference.object)); assert.deepEqual(result.bounds, reference.bounds);
    let geometry; result.object.traverse(node => { if (node.geometry) geometry = node.geometry; });
    if (kind === 'interleaved-attributes') {
      assert.equal(geometry.attributes.position.data, geometry.attributes.normal.data);
      assert.equal(geometry.attributes.position.data.stride, 6); assert.equal(geometry.attributes.normal.offset, 3);
      assert.equal(geometry.attributes.normal.getZ(0), 1);
    } else if (kind === 'interleaved-indices') {
      assert.equal(geometry.index.data.stride, 4); assert.deepEqual([0, 1, 2].map(row => geometry.index.getX(row)), [0, 1, 2]);
    } else {
      assert.equal(geometry.attributes.uv.normalized, true); assert.equal(geometry.attributes.uv.getX(1), 1); assert.equal(geometry.attributes.uv.getY(2), 1);
    }
    let disposals = 0; geometry.addEventListener('dispose', () => disposals++); result.dispose(); result.dispose(); assert.equal(disposals, 1);
  } finally { result?.dispose(); reference.dispose(); }
});


test('image height refusal releases all decoded images despite a throwing close callback', { timeout: 5000 }, async () => {
  const original = globalThis.createImageBitmap;
  const bytes = glbWithImage(png(), 'image/png', document => { document.images.push({ ...document.images[0] }); });
  const admitted = drainModelWork(createModelAdmissionWork(snapshotModelInput(bytes, 'glb')));
  const resource = admitted.resources.find(value => value.kind === 'image');
  const closed = [0, 0]; let calls = 0;
  try {
    globalThis.createImageBitmap = async () => {
      const index = calls++;
      return { width: resource.width, height: resource.height + index, close() { closed[index]++; if (index === 0) throw new Error('Close failed'); } };
    };
    await assert.rejects(decodePreparedImages(admitted), error => error.code === 'invalid');
    assert.equal(calls, 2); assert.deepEqual(closed, [1, 1]);
  } finally { if (original === undefined) delete globalThis.createImageBitmap; else globalThis.createImageBitmap = original; }
});

test('image preparation refuses absent bitmap capability without accepting image ownership', { timeout: 5000 }, async () => {
  const original = globalThis.createImageBitmap;
  const admitted = drainModelWork(createModelAdmissionWork(snapshotModelInput(glbWithImage(png(), 'image/png'), 'glb')));
  try {
    delete globalThis.createImageBitmap;
    await assert.rejects(decodePreparedImages(admitted), error => error.code === 'unsupported');
  } finally { if (original === undefined) delete globalThis.createImageBitmap; else globalThis.createImageBitmap = original; }
});

test('prepared resource disposal continues after every throwing callback and is idempotent', () => {
  const { admitted, descriptor } = prepare(glbWithImage(png(), 'image/png'), 'glb');
  const resourceIndex = admitted.resources.findIndex(value => value.kind === 'image');
  const attempts = { texture: 0, material: 0, geometry: 0, image: 0 };
  const images = new Map([[resourceIndex, { width: 1, height: 1, close() { attempts.image++; throw new Error('Image close failed'); } }]]);
  const parsed = drainModelWork(createModelMaterialization(descriptor, admitted, images));
  const resources = { texture: new Set(), material: new Set(), geometry: new Set() };
  parsed.object.traverse(node => {
    if (node.geometry) resources.geometry.add(node.geometry);
    for (const material of node.material ? (Array.isArray(node.material) ? node.material : [node.material]) : []) {
      resources.material.add(material);
      for (const value of Object.values(material)) if (value instanceof Texture) resources.texture.add(value);
    }
  });
  for (const [kind, values] of Object.entries(resources)) {
    assert.ok(values.size > 0, `${kind} ownership is exercised`);
    for (const value of values) value.addEventListener('dispose', () => { attempts[kind]++; throw new Error(`${kind} disposal failed`); });
  }
  assert.doesNotThrow(() => parsed.dispose()); assert.doesNotThrow(() => parsed.dispose());
  assert.deepEqual(attempts, { texture: resources.texture.size, material: resources.material.size, geometry: resources.geometry.size, image: 1 });
  assert.equal(images.size, 0);
});
