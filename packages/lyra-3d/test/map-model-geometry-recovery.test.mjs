import assert from 'node:assert/strict';
import test from 'node:test';
import { BufferAttribute } from 'three';
import { encodeGltf, interleavedFixture } from './fixtures/model-prepared-gltf.mjs';
import { channelApi, prepareSource, drainWork, drawables, limits, values, assertNear } from './map-model-geometry-fixture.mjs';

const prepare = () => prepareSource({ format: 'gltf', bytes: encodeGltf(interleavedFixture()) });
const input = source => ({ instance: source.instance, budget: source.budget, placement: {}, limits });

for (const [name, change] of [
  ['unsupported channel', mesh => { mesh.geometry.setAttribute('custom', new BufferAttribute(new Float32Array(9), 3)); }],
  ['untyped attribute', mesh => { mesh.geometry.attributes.position = { count: 3, itemSize: 3 }; }],
  ['mismatched normal count', mesh => { mesh.geometry.setAttribute('normal', new BufferAttribute(new Float32Array(6), 3)); }],
  ['non-finite position', mesh => { mesh.geometry.getAttribute('position').setX(0, NaN); }],
  ['non-finite UV', mesh => { mesh.geometry.setAttribute('uv', new BufferAttribute(new Float32Array([NaN, 0, 1, 0, 0, 1]), 2)); }],
  ['normalized index', mesh => { mesh.geometry.setIndex(new BufferAttribute(new Uint16Array([0, 1, 2]), 1, true)); }],
  ['multi-component index', mesh => { mesh.geometry.setIndex(new BufferAttribute(new Uint16Array([0, 1, 2]), 3)); }],
  ['non-geometry drawable', mesh => { mesh.geometry = {}; }],
  ['non-material drawable', mesh => { mesh.material = {}; }],
  ['non-material group', mesh => { mesh.material = [{}]; mesh.geometry.clearGroups(); mesh.geometry.addGroup(0, 3, 0); }],
  ['degenerate flat triangle', mesh => {
    mesh.material.flatShading = true;
    const position = mesh.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) position.setXYZ(i, 0, 0, 0);
  }],
]) {
  test(`channel preparation rejects ${name} and releases the exclusive source and output storage`, async () => {
    const api = await channelApi(), source = await prepare();
    const mesh = drawables(source.instance.object)[0];
    const geometry = mesh.geometry, material = mesh.material;
    let disposals = 0; material.addEventListener('dispose', () => { disposals++; });
    change(mesh);
    try {
      assert.throws(() => drainWork(api.createMapModelChannelWork(input(source))));
      assert.equal(disposals, 1);
      source.asset.dispose();
      assert.equal(source.budget.live.size, 0);
      assert.equal(new Set(source.budget.releases).size, source.budget.releases.length);
    } finally { mesh.geometry = geometry; mesh.material = material; source.instance.dispose(); source.asset.dispose(); }
  });
}

for (const [name, patch] of [
  ['zero unit scale', { placement: { metersPerUnit: 0 } }],
  ['negative unit scale', { placement: { metersPerUnit: -1 } }],
  ['non-finite unit scale', { placement: { metersPerUnit: Infinity } }],
  ['non-numeric unit scale', { placement: { metersPerUnit: '1' } }],
  ['caller-supplied node transforms', { placement: { nodeTransforms: [] } }],
  ['excessive vertex ceiling', { limits: { vertices: 1000001, indices: 3 } }],
  ['missing budget', { budget: null }],
]) {
  test(`factory rejection for ${name} retires the admitted instance`, async () => {
    const api = await channelApi(), source = await prepare();
    let disposals = 0;
    drawables(source.instance.object)[0].material.addEventListener('dispose', () => { disposals++; });
    try {
      assert.throws(() => api.createMapModelChannelWork({ ...input(source), ...patch }));
      assert.equal(disposals, 1);
    } finally { source.instance.dispose(); source.asset.dispose(); }
    assert.equal(source.budget.live.size, 0);
  });
}

test('duplicate source nodes refuse publication instead of rendering and charging them twice', async () => {
  const api = await channelApi(), source = await prepare(), root = source.instance.object;
  const child = root.children[0]; assert.ok(child); root.children.push(child);
  try { assert.throws(() => drainWork(api.createMapModelChannelWork(input(source)))); }
  finally { root.children.pop(); source.instance.dispose(); source.asset.dispose(); }
  assert.equal(source.budget.live.size, 0);
});

test('retirement from a storage reservation releases the newly returned lease exactly once', async () => {
  const api = await channelApi(), source = await prepare();
  const work = api.createMapModelChannelWork(input(source));
  source.budget.onReserve = () => work.dispose();
  try {
    assert.throws(() => drainWork(work), { name: 'AbortError' });
    assert.throws(() => work.step({ bytes: 1, records: 1, scalars: 1 }), { name: 'AbortError' });
    work.dispose();
  } finally { source.budget.onReserve = undefined; source.instance.dispose(); source.asset.dispose(); }
  assert.equal(source.budget.live.size, 0);
  assert.equal(new Set(source.budget.releases).size, source.budget.releases.length);
});

test('reservation callbacks cannot reenter incremental channel work or consume its final receipt twice', async () => {
  const api = await channelApi(), source = await prepare();
  const work = api.createMapModelChannelWork(input(source));
  let attempts = 0, receipt;
  source.budget.onReserve = () => {
    attempts++;
    assert.throws(() => work.step({ bytes: 1, scalars: 1, records: 1 }), /no longer active/);
  };
  try {
    receipt = drainWork(work);
    assert.ok(attempts > 0); assert.equal(receipt.counts.vertices, 3);
    assert.throws(() => work.step({ bytes: 1, scalars: 1, records: 1 }), /no longer active/);
    assert.ok(source.budget.live.size > source.asset.storage.length);
  } finally { source.budget.onReserve = undefined; receipt?.dispose(); source.instance.dispose(); source.asset.dispose(); }
  assert.equal(source.budget.live.size, 0);
});

test('throwing storage releases and source cleanup cannot prevent retirement of remaining reservations', async () => {
  const api = await channelApi(), source = await prepare();
  const reserve = source.budget.reserve;
  let releases = 0, disposals = 0;
  const budget = { ...source.budget, reserve(request) {
    const lease = reserve(request);
    return { key: lease.key, release() { lease.release(); releases++; throw new Error('Storage cleanup failed'); } };
  } };
  const instance = { object: source.instance.object, dispose() { source.instance.dispose(); disposals++; throw new Error('Source cleanup failed'); } };
  let receipt;
  try {
    receipt = drainWork(api.createMapModelChannelWork({ ...input(source), instance, budget }));
    receipt.dispose(); receipt.dispose();
    assert.ok(releases > 1); assert.equal(disposals, 1);
  } finally { receipt?.dispose(); source.instance.dispose(); source.asset.dispose(); }
  assert.equal(source.budget.live.size, 0);
});

test('mirrored flat faces keep normals aligned with the corrected index winding', async () => {
  const api = await channelApi(), document = interleavedFixture();
  document.nodes[0].scale = [-2, 3, 4];
  const source = await prepareSource({ format: 'gltf', bytes: encodeGltf(document) });
  const mesh = drawables(source.instance.object)[0];
  mesh.material.flatShading = true;
  let receipt;
  try {
    receipt = drainWork(api.createMapModelChannelWork(input(source)));
    const { geometry, normalMode } = receipt.primitives[0];
    assert.equal(normalMode, 'flat-face');
    assert.deepEqual([...geometry.index], [0, 2, 1]);
    const positions = values(geometry.attributes.position), normals = values(geometry.attributes.normal);
    const [a, b, c] = [...geometry.index].map(index => positions.slice(index * 3, index * 3 + 3));
    const ab = b.map((value, i) => value - a[i]), ac = c.map((value, i) => value - a[i]);
    const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    const magnitude = Math.hypot(...cross), expected = cross.map(value => value / magnitude);
    for (let row = 0; row < 3; row++) assertNear(normals.slice(row * 3, row * 3 + 3), expected);
  } finally { receipt?.dispose(); source.instance.dispose(); source.asset.dispose(); }
  assert.equal(source.budget.live.size, 0);
});
