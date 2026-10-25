import assert from 'node:assert/strict';
import test from 'node:test';
import { ModelAdmissionError } from '../dist/model/admission.js';
import { snapshotModelInput } from '../dist/model/model-admission-policy.js';
import { createModelAdmissionWork } from '../dist/model/model-admission-kernel.js';
import { createModelDescriptorValidation } from '../dist/model/model-descriptor-validation.js';
import { createPreparedObj } from '../dist/model/parsers/prepared-obj.js';
import { drainModelWork } from '../dist/model/model-work.js';

function fixture() {
  const bytes = new TextEncoder().encode('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n');
  const admitted = drainModelWork(createModelAdmissionWork(snapshotModelInput(bytes, 'obj')));
  const constructors = {f32:Float32Array,f64:Float64Array,u8:Uint8Array,u16:Uint16Array,u32:Uint32Array};
  const allocate = (kind, length) => new constructors[kind](length);
  const descriptor = drainModelWork(createPreparedObj(admitted, {allocateAttribute:allocate,allocateIndex:allocate}));
  return {admitted,descriptor};
}
const valid = (descriptor, admitted) => drainModelWork(createModelDescriptorValidation(descriptor, admitted), {bytes:1,scalars:1,records:1});
test('genuine decoder output passes independent bounded validation', () => { const {admitted,descriptor}=fixture(); assert.equal(valid(descriptor,admitted),descriptor); });
test('forged worker buffers, attributes, ranges, references and graph ownership fail closed', () => {
  const mutations = [
    d => {d.geometries[0].attributes.position.array[0]=NaN;},
    d => {d.geometries[0].attributes.position.count=1000001;},
    d => {d.geometries[0].attributes.position.stride=0;},
    d => {d.geometries[0].attributes.position.array=new Float32Array(new SharedArrayBuffer(36));},
    d => {d.geometries[0].index=Uint32Array.of(0,1,999);},
    d => {d.geometries[0].groups=[{start:2,count:3,materialIndex:0}];},
    d => {d.geometries[0].drawRange={start:0,count:999};},
    d => {d.nodes[1].materials=[999];},
    d => {d.nodes[0].children.push(0);},
    d => {d.nodes[0].children=[];},
    d => {d.nodes[1].matrix[0]=Infinity;},
    d => {d.geometries[0].attributes.color={...d.geometries[0].attributes.position,colorConversion:{space:'arbitrary',scale:1,output:'f32'}};},
  ];
  for (const mutate of mutations) { const {admitted,descriptor}=fixture(); mutate(descriptor); assert.throws(()=>valid(descriptor,admitted),ModelAdmissionError); }
});
test('failed independent validation cannot later publish success', () => {
  const {admitted,descriptor}=fixture(); descriptor.protocol=2;
  const work=createModelDescriptorValidation(descriptor,admitted);
  assert.throws(()=>work.step({bytes:1,scalars:1,records:1}),ModelAdmissionError);
  assert.throws(()=>work.step({bytes:1,scalars:1,records:1}),/no longer active/);
});

test('authored-row masks remain owned, validated arrays after transfer', async () => {
  const { createPreparedXyz } = await import('../dist/model/parsers/prepared-xyz.js');
  const bytes = new TextEncoder().encode('0 0 0\n1 2 3 128 64 255\n');
  const admitted = drainModelWork(createModelAdmissionWork(snapshotModelInput(bytes, 'xyz')));
  const constructors = { f32: Float32Array, f64: Float64Array, u8: Uint8Array };
  const allocate = (kind, length) => new constructors[kind](length);
  const descriptor = drainModelWork(createPreparedXyz(admitted, { allocateAttribute: allocate, allocateIndex: allocate }));
  const mask = descriptor.geometries[0].attributes.color.colorConversion.authoredRows;
  const transferred = structuredClone(descriptor, { transfer: [mask.buffer] });
  assert.equal(mask.byteLength, 0); assert.deepEqual(Array.from(transferred.geometries[0].attributes.color.colorConversion.authoredRows), [0, 1]);
  valid(transferred, admitted); assert.throws(() => valid(descriptor, admitted), ModelAdmissionError);
  transferred.geometries[0].attributes.color.colorConversion.authoredRows[0] = 2;
  assert.throws(() => valid(transferred, admitted), ModelAdmissionError);
});

for (const [kind, min, max] of [[Uint16Array, 0, 65535], [Uint32Array, 0, 4294967295], [Int8Array, -128, 127], [Int16Array, -32768, 32767], [Int32Array, -2147483648, 2147483647], [Float32Array, -1, 1]]) {
  test(`independent worker validation applies ${kind.name} normalization before world-range checks`, () => {
    const { admitted, descriptor } = fixture();
    const position = descriptor.geometries[0].attributes.position;
    position.array = new kind([min, 0, 0, max, 0, 0, 0, max, 0]); position.normalized = true;
    const node = descriptor.nodes.find(value => value.geometry === 0);
    node.matrix[0] = 1e20; node.matrix[5] = 1e20; node.matrix[10] = 1e20;
    assert.equal(valid(descriptor, admitted), descriptor, 'normalized endpoints fit the accepted coordinate range, including signed minimum clamping');
    node.matrix[12] = 1e20;
    const work = createModelDescriptorValidation(descriptor, admitted);
    assert.throws(() => drainModelWork(work, { bytes: 1, scalars: 1, records: 1 }), ModelAdmissionError, 'normalized maximum plus translation exceeds the coordinate range');
    assert.throws(() => work.step({ bytes: 1, scalars: 1, records: 1 }), /no longer active/);
  });
}
