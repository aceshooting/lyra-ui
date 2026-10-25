import assert from 'node:assert/strict';
import test from 'node:test';
import { BufferAttribute, BufferGeometry, Group, Mesh, MeshStandardMaterial, Scene } from 'three';
import { createModelEngine } from '../dist/model/engine.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';
import { DEFAULT_ORBIT_CAMERA } from '../dist/core/orbit.js';
const input = () => ({ format: 'obj', bytes: new TextEncoder().encode('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n') });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { resolve, reject, promise }; };
function setup() {
  const pending = []; const world = new Group(), scene = new Scene(); scene.add(world);
  const viewport = { world, scene, width: 640, height: 480, orbit: DEFAULT_ORBIT_CAMERA, style: resolveLyra3dStyle(), lost: false,
    setStyle(value) { this.style = resolveLyra3dStyle(value); }, setOrbit(value) { this.orbit = value; }, invalidate() {}, dispose() {}, resize() {}, project() { return null; } };
  const engine = createModelEngine({ viewport: () => viewport, prepare() { const work = deferred(); pending.push(work); return work.promise; } });
  const events = []; const host = { hover() {}, pick() {}, camera() {}, progress() { events.push('progress'); }, lost() { events.push('lost'); } };
  const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float64Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
  const material = new MeshStandardMaterial(), object = new Mesh(geometry, material); let disposals = 0;
  const model = { object, bounds: null, vertices: 3, indices: 0, dispose() { disposals++; geometry.dispose(); object.material.dispose(); object.removeFromParent(); } };
  return { engine, pending, world, host, events, model, geometry, material, disposals: () => disposals };
}
test('a failed newer load during premount GPU conversion retains the accepted model and completes mounting', { timeout: 5000 }, async () => {
  const h = setup(); const first = h.engine.setDataAsync(input(), 0); h.pending.shift().resolve(h.model); await first;
  const mounting = h.engine.mount({}, h.host); const mounted = mounting.then(() => 'mounted', error => error.name);
  const next = h.engine.setDataAsync(input(), 1); h.pending.shift().reject(new Error('Replacement failed'));
  await assert.rejects(next); assert.equal(await mounted, 'mounted');
  assert.equal(h.model.object.parent, h.world); assert.equal(h.disposals(), 0); assert.ok(h.geometry.getAttribute('position').array instanceof Float32Array);
  h.engine.dispose(); assert.equal(h.disposals(), 1);
});
test('disposing during premount GPU conversion releases the shared parsed model exactly once', { timeout: 5000 }, async () => {
  const h = setup(); const first = h.engine.setDataAsync(input(), 0); h.pending.shift().resolve(h.model); await first;
  const mounting = h.engine.mount({}, h.host); const mounted = mounting.then(() => 'mounted', error => error.name);
  h.engine.dispose(); await mounted; await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.disposals(), 1); assert.equal(h.model.object.parent, null); assert.deepEqual(h.events, []);
});

test('a successful newer model retires premount conversion without rejecting mount or releasing twice', { timeout: 5000 }, async () => {
  const h = setup(); const first = h.engine.setDataAsync(input(), 0); h.pending.shift().resolve(h.model); await first;
  const mounting = h.engine.mount({}, h.host); const mounted = mounting.then(() => 'mounted', error => error.name);
  const replacement = setup();
  replacement.geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
  const next = h.engine.setDataAsync(input(), 1); h.pending.shift().resolve(replacement.model); await next;
  assert.equal(await mounted, 'mounted'); assert.equal(replacement.model.object.parent, h.world);
  assert.equal(h.disposals(), 1); assert.equal(replacement.disposals(), 0);
  h.engine.dispose(); assert.equal(h.disposals(), 1); assert.equal(replacement.disposals(), 1);
  replacement.engine.dispose();
});
