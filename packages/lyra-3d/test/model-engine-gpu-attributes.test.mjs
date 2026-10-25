import assert from 'node:assert/strict';
import test from 'node:test';
import { BufferAttribute, BufferGeometry, Group, InterleavedBuffer, InterleavedBufferAttribute, Mesh, MeshStandardMaterial, Scene } from 'three';
import { createModelEngine } from '../dist/model/engine.js';
import { admitModel, ModelAdmissionError } from '../dist/model/admission.js';
import { parseModel } from '../dist/model/model-parsers.js';
import { DEFAULT_ORBIT_CAMERA } from '../dist/core/orbit.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';

const input = () => ({ format: 'obj', bytes: new TextEncoder().encode('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n') });
const native = async () => { const data = input(); return parseModel(admitModel(data.bytes, data.format)); };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function queue() { const entries = [], waiters = []; return { push(value) { const waiter = waiters.shift(); if (waiter) waiter(value); else entries.push(value); }, next() { return entries.length ? Promise.resolve(entries.shift()) : new Promise(resolve => waiters.push(resolve)); }, get length() { return entries.length; } }; }
function harness() {
  const preparation = queue(), parsing = queue(), progress = queue(), events = [];
  const world = new Group(), scene = new Scene(); scene.add(world);
  const viewport = { world, scene, width: 640, height: 480, orbit: DEFAULT_ORBIT_CAMERA, style: resolveLyra3dStyle(), lost: false,
    setStyle(value) { this.style = resolveLyra3dStyle(value); }, setOrbit(value) { this.orbit = value; }, invalidate() {}, dispose() {}, resize() {}, project() { return null; },
  };
  const engine = createModelEngine({ viewport: () => viewport,
    prepare(owned, options) { const result = deferred(); preparation.push({ owned, options, ...result }); return result.promise; },
    parse(admitted, options) { const result = deferred(); parsing.push({ admitted, options, ...result }); return result.promise; },
  });
  const host = { hover() {}, pick() {}, camera() {}, progress(...value) { events.push(['progress', ...value]); progress.push(value); }, lost(...value) { events.push(['lost', ...value]); } };
  return { engine, host, world, preparation, parsing, progress, events };
}
const bounded = { timeout: 5000 };


function doubleMesh(interleaved = false) {
  const geometry = new BufferGeometry();
  const raw = new Float64Array([0.100000000125, 0, 0, 1.100000000125, 0, 0, 0.100000000125, 1, 0]);
  if (interleaved) {
    const storage = new InterleavedBuffer(raw, 3);
    geometry.setAttribute('position', new InterleavedBufferAttribute(storage, 3, 0));
    geometry.setAttribute('normal', new InterleavedBufferAttribute(storage, 3, 0));
  } else {
    const attribute = new BufferAttribute(raw, 3);
    geometry.setAttribute('position', attribute); geometry.setAttribute('normal', attribute);
  }
  const material = new MeshStandardMaterial();
  const object = new Group().add(new Mesh(geometry, material), new Mesh(geometry, material));
  let disposals = 0;
  const parsed = { object, bounds: null, vertices: 6, indices: 0, dispose() { disposals++; geometry.dispose(); material.dispose(); object.removeFromParent(); } };
  return { parsed, geometry, raw, disposals: () => disposals };
}
for (const interleaved of [false, true]) for (const mode of ['native', 'async']) test(`${mode} installation converts shared ${interleaved ? 'interleaved' : 'contiguous'} double storage at the GPU boundary`, bounded, async () => {
  const h = harness(); await h.engine.mount({}, h.host); const fixture = doubleMesh(interleaved);
  const originalAttribute = fixture.geometry.getAttribute('position'); const originalNormal = fixture.geometry.getAttribute('normal');
  const originalStorage = interleaved ? originalAttribute.data : null; const originalValues = Array.from(fixture.raw);
  if (mode === 'native') { h.engine.setData(input(), 0); (await h.parsing.next()).resolve(fixture.parsed); await h.progress.next(); }
  else { const pending = h.engine.setDataAsync(input(), 0); (await h.preparation.next()).resolve(fixture.parsed); await pending; }
  const position = fixture.geometry.getAttribute('position'), normal = fixture.geometry.getAttribute('normal');
  assert.ok(position.array instanceof Float32Array); assert.equal(position, originalAttribute); assert.equal(normal, originalNormal);
  assert.equal(position.array, normal.array); if (interleaved) assert.equal(position.data, originalStorage);
  assert.deepEqual(Array.from(position.array), originalValues.map(Math.fround)); assert.deepEqual(Array.from(fixture.raw), originalValues);
  assert.equal(fixture.parsed.object.children[0].geometry, fixture.parsed.object.children[1].geometry);
  assert.equal(position.itemSize, 3); assert.equal(position.count, 3); assert.equal(position.normalized, false);
  assert.equal(h.events.filter(event => event[0] === 'progress').length, 1); assert.equal(h.events.filter(event => event[0] === 'lost').length, 0);
  h.engine.dispose(); assert.equal(fixture.disposals(), 1); h.engine.dispose(); assert.equal(fixture.disposals(), 1);
});

test('aborting before a double-storage conversion commits retains the old scene and releases only the candidate', bounded, async () => {
  const h = harness(); await h.engine.mount({}, h.host); const first = await native();
  const initial = h.engine.setDataAsync(input(), 0); (await h.preparation.next()).resolve(first); await initial;
  const candidate = doubleMesh(); const before = candidate.geometry.getAttribute('position').array;
  const controller = new AbortController(); const pending = h.engine.setDataAsync(input(), 1, { signal: controller.signal });
  (await h.preparation.next()).resolve(candidate.parsed); queueMicrotask(() => controller.abort());
  await assert.rejects(pending, { name: 'AbortError' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(first.object.parent, h.world); assert.equal(candidate.parsed.object.parent, null);
  assert.equal(candidate.geometry.getAttribute('position').array, before); assert.equal(candidate.disposals(), 1);
  assert.equal(h.events.filter(event => event[0] === 'progress').length, 1); assert.equal(h.events.filter(event => event[0] === 'lost').length, 0);
  h.engine.dispose(); assert.equal(candidate.disposals(), 1);
});
