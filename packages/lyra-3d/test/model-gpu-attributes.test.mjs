import assert from 'node:assert/strict';
import test from 'node:test';
import { BufferAttribute, BufferGeometry, InterleavedBuffer, InterleavedBufferAttribute, Mesh, MeshStandardMaterial } from 'three';
import { createModelGpuAttributeWork, modelGpuAttributesNeedConversion } from '../dist/model/model-gpu-attributes.js';
const mesh = geometry => new Mesh(geometry, new MeshStandardMaterial());
const budget = { bytes: 7, scalars: 2, records: 1 };
function drain(work) {
  const used = { bytes: 0, scalars: 0, records: 0 }; let steps = 0;
  for (;;) {
    const next = work.step(budget); steps++;
    for (const key of Object.keys(used)) { assert.ok(next.used[key] <= budget[key]); used[key] += next.used[key]; }
    if (next.done) return { used, steps };
    assert.ok(next.used.bytes + next.used.scalars + next.used.records > 0);
  }
}
test('conversion budgets census, storage allocation and scalars while preserving exact aliases', () => {
  const source = new Float64Array([0.1, 0.2, 0.3, 1.1, 1.2, 1.3]);
  const shared = new InterleavedBuffer(source, 3);
  const a = new BufferGeometry().setAttribute('position', new InterleavedBufferAttribute(shared, 3, 0));
  const b = new BufferGeometry().setAttribute('normal', new InterleavedBufferAttribute(shared, 3, 0));
  const separateAttribute = new BufferAttribute(source, 3); b.setAttribute('position', separateAttribute);
  const result = drain(createModelGpuAttributeWork([{ object: mesh(a) }, { object: mesh(a) }, { object: mesh(b) }]));
  assert.equal(result.used.bytes, source.length * 4); assert.equal(result.used.scalars, source.length); assert.ok(result.steps > 3);
  assert.equal(a.getAttribute('position').data, shared); assert.equal(b.getAttribute('position'), separateAttribute);
  assert.equal(shared.array, separateAttribute.array); assert.deepEqual(Array.from(shared.array), Array.from(source, Math.fround));
  assert.equal(shared.stride, 3); assert.equal(shared.count, 2); assert.equal(source[0], 0.1);
});
for (const bad of [NaN, Infinity, 1e300]) test(`invalid Float32 conversion (${bad}) refuses before any storage mutation`, () => {
  const a = new Float64Array([0, 0, 0]), b = new Float64Array([0, bad, 0]);
  const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(a, 3)).setAttribute('normal', new BufferAttribute(b, 3));
  const work = createModelGpuAttributeWork([{ object: mesh(geometry) }]);
  assert.throws(() => drain(work), error => error.code === 'invalid');
  assert.equal(geometry.getAttribute('position').array, a); assert.equal(geometry.getAttribute('normal').array, b);
  assert.throws(() => work.step(budget));
});
test('cancelled partial conversion leaves owned storage untouched and terminalizes work', () => {
  const source = new Float64Array([0.1, 0.2, 0.3, 1.1, 1.2, 1.3]);
  const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(source, 3));
  const work = createModelGpuAttributeWork([{ object: mesh(geometry) }]); let converted = 0;
  while (!converted) { const step = work.step(budget); assert.equal(step.done, false); converted += step.used.scalars; }
  work.dispose(); assert.equal(geometry.getAttribute('position').array, source); assert.throws(() => work.step(budget));
});
test('ordinary GPU attributes retain their storage and need no conversion marker', () => {
  const source = new Float32Array([0, 0, 0]); const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(source, 3));
  const object = mesh(geometry); assert.equal(modelGpuAttributesNeedConversion(object), false);
  const result = drain(createModelGpuAttributeWork([{ object }]));
  assert.equal(result.used.bytes, 0); assert.equal(result.used.scalars, 0); assert.equal(geometry.getAttribute('position').array, source);
});

test('malformed attribute-like storage cannot enter GPU conversion or mutate genuine attributes', () => {
  const source = new Float64Array([0, 0, 0]);
  const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(source, 3));
  geometry.setAttribute('normal', { array: new Float64Array([0, 0, 1]), itemSize: 3, count: 1, normalized: false });
  const work = createModelGpuAttributeWork([{ object: mesh(geometry) }]);
  assert.throws(() => drain(work), error => error.code === 'invalid');
  assert.equal(geometry.getAttribute('position').array, source);
  assert.throws(() => work.step(budget), /no longer active/); work.dispose();
});
