import assert from 'node:assert/strict';
import test from 'node:test';
import { BufferGeometry, Float32BufferAttribute, Points, PointsMaterial } from 'three';
import { admitModel } from '../dist/model/admission.js';
import { parseModel } from '../dist/model/model-parsers.js';

const receipt = () => admitModel(new TextEncoder().encode('0 0 0\n'), 'xyz');
function candidate(context, released) {
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0], 3));
  const material = new PointsMaterial(); geometry.addEventListener('dispose', () => { released.geometry++; }); material.addEventListener('dispose', () => { released.material++; });
  const object = new Points(geometry, material); context.roots.push(object); return object;
}

test('genuine receipt and early abort checks precede the format importer', async () => {
  let calls = 0; const services = { loadFormat: async () => { calls++; throw new Error('Importer must not run'); } };
  await assert.rejects(parseModel({}, {}, services), error => error.code === 'invalid');
  const controller = new AbortController(); controller.abort();
  await assert.rejects(parseModel(receipt(), { signal: controller.signal }, services), { name: 'AbortError' });
  assert.equal(calls, 0);
});

test('aborting a pending format import never invokes its parser', async () => {
  let release; let imports = 0; let parses = 0;
  const controller = new AbortController();
  const loading = new Promise(resolve => { release = resolve; });
  const pending = parseModel(receipt(), { signal: controller.signal }, { loadFormat: () => { imports++; return loading; } });
  assert.equal(imports, 1);
  controller.abort(); release(() => { parses++; throw new Error('Obsolete parser must not run'); });
  await assert.rejects(pending, { name: 'AbortError' }); assert.equal(parses, 0);
});

test('format import failure remains retryable and a late parse closes every owned resource', async () => {
  let imports = 0; const released = { geometry: 0, material: 0 };
  const services = { loadFormat: async () => { if (++imports === 1) throw new Error('One import failure'); return context => candidate(context, released); } };
  await assert.rejects(parseModel(receipt(), {}, services), error => error.code === 'invalid');
  const parsed = await parseModel(receipt(), {}, services); parsed.dispose(); parsed.dispose();
  assert.equal(imports, 2); assert.deepEqual(released, { geometry: 1, material: 1 });
  let finish; let entered;
  const started = new Promise(resolve => { entered = resolve; }); const controller = new AbortController();
  const delayed = parseModel(receipt(), { signal: controller.signal }, { loadFormat: async () => context => {
    const object = candidate(context, released); entered(); return new Promise(resolve => { finish = () => resolve(object); });
  } });
  await started; controller.abort(); finish();
  await assert.rejects(delayed, { name: 'AbortError' }); assert.deepEqual(released, { geometry: 2, material: 2 });
});
