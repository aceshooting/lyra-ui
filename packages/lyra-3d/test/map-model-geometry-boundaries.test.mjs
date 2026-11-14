import assert from 'node:assert/strict';
import test from 'node:test';
import { BufferAttribute, BufferGeometry, Group, Line, LineBasicMaterial, LineSegments, Object3D } from 'three';
import { encodeGltf, interleavedFixture } from './fixtures/model-prepared-gltf.mjs';
import { channelApi, drainWork, drawables, limits, prepareSource } from './map-model-geometry-fixture.mjs';

const prepare = () => prepareSource({ format: 'gltf', bytes: encodeGltf(interleavedFixture()) });
const input = source => ({ instance: source.instance, budget: source.budget, placement: {}, limits });
const line = (Kind, points) => new Kind(new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(points), 3)), new LineBasicMaterial());

test('channel work requires a disposable Object3D instance', async () => {
  const api = await channelApi(), source = await prepare();
  try {
    for (const instance of [null, { object: {}, dispose() {} }, { object: new Object3D() }]) {
      assert.throws(() => api.createMapModelChannelWork({ ...input(source), instance }), { name: 'ModelAdmissionError' });
    }
    let disposed = 0;
    assert.throws(() => api.createMapModelChannelWork({ ...input(source), instance: { object: {}, dispose() { disposed++; } } }));
    assert.equal(disposed, 1, 'a refused instance is still retired');
  } finally { source.instance.dispose(); source.asset.dispose(); }
});

test('a storage lease without a usable key or release refuses the work and releases what it can', async () => {
  const api = await channelApi(), source = await prepare(), reserve = source.budget.reserve;
  try {
    for (const broken of [lease => ({ ...lease, key: '' }), lease => ({ key: lease.key, release: 'release' })]) {
      const leases = [];
      source.budget.reserve = request => { const lease = reserve(request); leases.push(lease); return broken(lease); };
      const instance = { object: source.instance.object, dispose() {} };
      assert.throws(() => drainWork(api.createMapModelChannelWork({ ...input(source), instance })), { name: 'ModelAdmissionError' });
      for (const lease of leases) lease.release();
    }
  } finally { source.budget.reserve = reserve; source.instance.dispose(); source.asset.dispose(); }
  assert.equal(source.budget.live.size, 0);
});

const grouped = (groups, perGroup, child) => {
  const root = new Group();
  for (let group = 0; group < groups; group++) { const parent = new Group(); for (let index = 0; index < perGroup; index++) parent.add(child()); root.add(parent); }
  return root;
};
for (const [name, build, code] of [
  ['too many source nodes', () => grouped(4, 3072, () => new Object3D()), 'limit'],
  ['too many drawables', () => grouped(2, 2049, () => line(LineSegments, [0, 0, 0, 1, 0, 0])), 'limit'],
  ['too many source vertices', () => grouped(1, 2, () => line(Line, new Float32Array(3 * 500001))), 'limit'],
  ['a one-vertex line strip', () => line(Line, [0, 0, 0]), 'invalid'],
  ['an odd line segment list', () => line(LineSegments, [0, 0, 0, 1, 0, 0, 2, 0, 0]), 'invalid'],
]) {
  test(`channel work refuses ${name}`, async () => {
    const api = await channelApi(), source = await prepare();
    let disposed = 0;
    try {
      const instance = { object: build(), dispose() { disposed++; } };
      assert.throws(() => drainWork(api.createMapModelChannelWork({ ...input(source), instance }), { bytes: 65536, scalars: 65536, records: 65536 }),
        { name: 'ModelAdmissionError', code });
      assert.equal(disposed, 1);
    } finally { source.instance.dispose(); source.asset.dispose(); }
    assert.equal(source.budget.live.size, 0);
  });
}

test('indexed rows beyond the vertex quota are refused while they are remapped', async () => {
  const api = await channelApi(), source = await prepare();
  try {
    const mesh = drawables(source.instance.object)[0];
    assert.throws(() => drainWork(api.createMapModelChannelWork({ ...input(source), limits: { vertices: 2, indices: 3 } })));
    assert.ok(mesh.geometry.getAttribute('position').count > 2);
  } finally { source.instance.dispose(); source.asset.dispose(); }
  assert.equal(source.budget.live.size, 0);
});
