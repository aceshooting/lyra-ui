import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareModelAsset } from '../dist/model/model-asset.js';
import { triangleJson, utf8 } from './model-fixtures.mjs';
import { appendAttribute, encodeGltf, interleavedFixture, primitiveFixture, richFixture, stridedIndexFixture } from './fixtures/model-prepared-gltf.mjs';
import { binaryStl } from './fixtures/model-prepared-text.mjs';
import { pcdFixture, plyFixture } from './fixtures/model-prepared-binary.mjs';
import { channelApi, limits, makeBudget, prepareSource, drainWork, drawables, values, assertNear } from './map-model-geometry-fixture.mjs';

const gltf = document => ({ format: 'gltf', bytes: encodeGltf(document) });
const xyz = points => ({ format: 'xyz', bytes: utf8(points.map(row => row.join(' ')).join('\n') + '\n') });
const workInput = (source, extra = {}) => ({ instance: source.instance, budget: source.budget, placement: {}, limits, ...extra });
const cleanup = (source, receipt) => { receipt?.dispose(); source.instance.dispose(); source.asset.dispose(); assert.equal(source.budget.live.size, 0); };
const onDispose = instance => {
  let count = 0;
  const materials = new Set(drawables(instance.object).flatMap(node => Array.isArray(node.material) ? node.material : [node.material]));
  for (const material of materials) material.addEventListener('dispose', () => { count++; });
  return () => count;
};

const formatCases = [
  ['gltf', () => gltf(triangleJson()), 'mesh'],
  ['glb', () => ({ format: 'glb', bytes: encodeGltf(triangleJson(), 'glb') }), 'mesh'],
  ['stl', () => ({ format: 'stl', bytes: binaryStl({ facets: 1 }) }), 'mesh'],
  ['obj', () => ({ format: 'obj', bytes: utf8('o triangle\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n') }), 'mesh'],
  ['ply', () => plyFixture({ faces: [[0, 1, 2]] }).input.input, 'mesh'],
  ['xyz', () => xyz([[0, 0, 0], [1, 0, 0], [0, 1, 0]]), 'points'],
  ['pcd', () => pcdFixture({ viewpoint: null }).input.input, 'points']
];
for (const [format, input, kind] of formatCases) {
  test(`physical channels consume real ${format} admission and preserve ${kind} primitives`, async () => {
    const api = await channelApi(); const source = await prepareSource(input()); let result;
    try {
      const original = drawables(source.instance.object)[0];
      result = drainWork(api.createMapModelChannelWork(workInput(source)));
      assert.equal(result.primitives.length, 1);
      const row = result.primitives[0];
      assert.equal(row.kind, kind); assert.equal(row.material, original.material);
      assert.ok(row.geometry.attributes.position.count > 0);
      assert.equal(result.counts.vertices, row.geometry.attributes.position.count);
      assert.equal(result.counts.indices, row.geometry.index.length);
      assert.ok(row.geometry.index instanceof Uint32Array);
      assert.equal(Object.hasOwn(result, 'geographic'), false);
      assert.equal(Object.hasOwn(result, 'visible'), false);
      if (kind === 'points') { assert.equal(row.normalMode, 'absent'); assert.equal(row.geometry.attributes.normal, undefined); }
    } finally { cleanup(source, result); }
  });
}

test('real glTF line modes, OBJ line/points and PLY points preserve source order and primitive kind', async () => {
  const api = await channelApi();
  const cases = [
    ...[[1, 'line-segments'], [2, 'line-loop'], [3, 'line']].map(([mode, kind]) => [gltf(primitiveFixture(mode)), kind]),
    [{ format: 'obj', bytes: utf8('v 0 0 0\nv 1 0 0\nl 1 2\n') }, 'line-segments'],
    [{ format: 'obj', bytes: utf8('v 0 0 0\nv 1 0 0\np 1 2\n') }, 'points'],
    [plyFixture().input.input, 'points']
  ];
  for (const [input, kind] of cases) {
    const source = await prepareSource(input); let result;
    try {
      result = drainWork(api.createMapModelChannelWork(workInput(source, { placement: { metersPerUnit: 2 } })));
      const row = result.primitives[0]; assert.equal(row.kind, kind);
      const length = kind === 'line-segments' || input.format === 'obj' ? 2 : 3;
      assert.deepEqual([...row.geometry.index], Array.from({ length }, (_, index) => index));
      assert.equal(row.tangentMode, 'absent');
      assert.equal(row.geometry.attributes.tangent, undefined);
      if (kind === 'line-loop') assert.equal(row.geometry.index.length, 3, 'loop closure is topology, not a duplicated index');
    } finally { cleanup(source, result); }
  }
});

test('physical placement preserves complete source ancestry and nonzero authored origin', async () => {
  const api = await channelApi(); const document = triangleJson();
  document.nodes = [{ translation: [10, 20, 30], children: [1] }, { mesh: 0, translation: [1, 2, 3], scale: [2, 3, 4] }];
  const source = await prepareSource(gltf(document)); let result;
  try {
    const mesh = drawables(source.instance.object)[0], matrix = [...mesh.matrixWorld.elements];
    result = drainWork(api.createMapModelChannelWork(workInput(source, { placement: { metersPerUnit: 2 } })));
    assertNear(values(result.primitives[0].geometry.attributes.position), [22, -66, 44, 26, -66, 44, 22, -66, 50]);
    assert.deepEqual(mesh.matrixWorld.elements, matrix);
    assert.ok(mesh.parent, 'source hierarchy is not detached before snapshot');
  } finally { cleanup(source, result); }
});

test('interleaved normalized channels, UV seams and alpha retain materialized values without source writes', async () => {
  const api = await channelApi(); const document = interleavedFixture(); const primitive = document.meshes[0].primitives[0];
  primitive.attributes.COLOR_0 = appendAttribute(document, new Uint8Array([255, 128, 0, 255, 0, 255, 128, 192, 128, 0, 255, 64]), 4, 5121, true);
  primitive.attributes.TEXCOORD_0 = appendAttribute(document, new Uint16Array([0, 0, 65535, 0, 0, 65535]), 2, 5123, true);
  primitive.attributes.TEXCOORD_1 = appendAttribute(document, new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]), 2);
  const source = await prepareSource(gltf(document)); let result;
  try {
    const geometry = drawables(source.instance.object)[0].geometry;
    const originals = Object.fromEntries(Object.entries(geometry.attributes).map(([key, attr]) =>
      [key, Array.from(attr.isInterleavedBufferAttribute ? attr.data.array : attr.array)]));
    result = drainWork(api.createMapModelChannelWork(workInput(source)));
    const attributes = result.primitives[0].geometry.attributes;
    assertNear(values(attributes.uv), [0, 0, 1, 0, 0, 1]);
    assertNear(values(attributes.uv1), [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
    assertNear(values(attributes.color), [1, 128 / 255, 0, 1, 0, 1, 128 / 255, 192 / 255, 128 / 255, 0, 1, 64 / 255]);
    for (const [key, attr] of Object.entries(attributes)) {
      assert.ok(attr.array instanceof Float32Array); assert.equal(attr.normalized, false);
      assert.equal(attr.stride, attr.itemSize); assert.equal(attr.offset, 0);
      const original = geometry.getAttribute(key);
      assert.notEqual(attr.array.buffer, original.isInterleavedBufferAttribute ? original.data.array.buffer : original.array.buffer);
    }
    for (const [key, original] of Object.entries(originals)) {
      const attr = geometry.getAttribute(key); assert.deepEqual(Array.from(attr.isInterleavedBufferAttribute ? attr.data.array : attr.array), original);
    }
  } finally { cleanup(source, result); }
});

test('materialized OBJ color conversion is retained without applying it a second time', async () => {
  const api = await channelApi();
  const source = await prepareSource({ format: 'obj', bytes: utf8('v 0 0 0 0.5 0.25 0.75\nv 1 0 0 1 0 0\nv 0 1 0 0 1 0\nf 1 2 3\n') }); let result;
  try {
    const attr = drawables(source.instance.object)[0].geometry.getAttribute('color');
    const original = Array.from({ length: attr.count }, (_, index) => [attr.getX(index), attr.getY(index), attr.getZ(index)]).flat();
    assert.ok(Math.abs(original[0] - 0.5) > 0.1, 'fixture reaches actual color conversion');
    result = drainWork(api.createMapModelChannelWork(workInput(source)));
    assertNear(values(result.primitives[0].geometry.attributes.color), original);
  } finally { cleanup(source, result); }
});

test('draw ranges and overlapping material groups retain separate deterministic memberships', async () => {
  const api = await channelApi(); const source = await prepareSource(gltf(interleavedFixture())); let result;
  try {
    const mesh = drawables(source.instance.object)[0], material = mesh.material;
    // Configure the exclusive actual instance: glTF does not encode Three drawRange/group overlaps.
    mesh.material = [material, material]; mesh.geometry.setIndex([0, 1, 2, 0, 2, 1]);
    mesh.geometry.setDrawRange(3, 3); mesh.geometry.clearGroups();
    mesh.geometry.addGroup(0, 6, 0); mesh.geometry.addGroup(3, 3, 1);
    const groups = structuredClone(mesh.geometry.groups);
    result = drainWork(api.createMapModelChannelWork(workInput(source)));
    assert.deepEqual(result.primitives.map(row => row.membership), [0, 1]);
    assert.equal(result.primitives[0].node, result.primitives[1].node);
    assert.deepEqual(result.counts, { vertices: 6, indices: 6 });
    for (const row of result.primitives) {
      assert.equal(row.material, material); assert.deepEqual([...row.geometry.index], [0, 1, 2]);
      assertNear(values(row.geometry.attributes.position), [0, 0, 0, 0, 0, 1, 1, 0, 0]);
      assert.deepEqual(row.geometry.drawRange, { start: 0, count: 3 });
      assert.deepEqual(row.geometry.groups, [{ start: 0, count: 3, materialIndex: 0 }]);
    }
    assert.deepEqual(mesh.geometry.groups, groups); assert.equal(mesh.geometry.drawRange.start, 3);
  } finally { cleanup(source, result); }
});

test('single material ignores groups and strided index attributes normalize once', async () => {
  const api = await channelApi(); const source = await prepareSource(gltf(stridedIndexFixture())); let result;
  try {
    const mesh = drawables(source.instance.object)[0]; mesh.geometry.addGroup(0, 3, 0); mesh.geometry.addGroup(0, 3, 0);
    result = drainWork(api.createMapModelChannelWork(workInput(source)));
    assert.equal(result.primitives.length, 1); assert.equal(result.counts.indices, 3);
    assert.deepEqual([...result.primitives[0].geometry.index], [0, 1, 2]);
    assert.equal(result.primitives[0].geometry.indexAttribute, undefined);
  } finally { cleanup(source, result); }
});

test('mirrored nonuniform mesh transforms normals and tangent handedness and flips triangle winding once', async () => {
  const api = await channelApi(); const document = interleavedFixture();
  document.nodes[0].scale = [-2, 3, 4];
  document.meshes[0].primitives[0].attributes.TANGENT = appendAttribute(document, new Float32Array([1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1]), 4);
  const source = await prepareSource(gltf(document)); let result;
  try {
    result = drainWork(api.createMapModelChannelWork(workInput(source)));
    const row = result.primitives[0]; assert.equal(row.normalMode, 'transformed'); assert.equal(row.tangentMode, 'transformed');
    assertNear(values(row.geometry.attributes.normal), [0, -1, 0, 0, -1, 0, 0, -1, 0]);
    assertNear(values(row.geometry.attributes.tangent), [-1, 0, 0, -1, -1, 0, 0, -1, -1, 0, 0, -1]);
    assert.deepEqual([...row.geometry.index], [0, 2, 1]);
  } finally { cleanup(source, result); }
});

test('flat faces expand and charge corners while nonflat missing normals remain explicitly absent', async () => {
  const api = await channelApi();
  for (const flat of [true, false]) {
    const source = await prepareSource(gltf(triangleJson())); let result;
    try {
      const mesh = drawables(source.instance.object)[0]; mesh.material.flatShading = flat;
      mesh.geometry.setIndex([0, 1, 2, 0, 2, 1]);
      result = drainWork(api.createMapModelChannelWork(workInput(source, { limits: { vertices: flat ? 6 : 3, indices: 6 } })));
      const row = result.primitives[0]; assert.equal(row.normalMode, flat ? 'flat-face' : 'absent');
      assert.deepEqual(result.counts, { vertices: flat ? 6 : 3, indices: 6 });
      if (flat) {
        assertNear(values(row.geometry.attributes.normal), [0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]);
        assert.deepEqual([...row.geometry.index], [0, 1, 2, 3, 4, 5]);
      }
      else assert.equal(row.geometry.attributes.normal, undefined);
      assert.equal(row.tangentMode, 'absent');
    } finally { cleanup(source, result); }
  }
});

test('nonflat tangent without normal and singular required normal transform refuse without leaking source lease', async () => {
  const api = await channelApi();
  for (const singular of [false, true]) {
    const document = singular ? interleavedFixture() : triangleJson();
    if (singular) document.nodes[0].scale = [0, 1, 1];
    else document.meshes[0].primitives[0].attributes.TANGENT = appendAttribute(document, new Float32Array([1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1]), 4);
    const source = await prepareSource(gltf(document)); const disposed = onDispose(source.instance);
    try {
      drawables(source.instance.object)[0].material.flatShading = false;
      assert.throws(() => drainWork(api.createMapModelChannelWork(workInput(source))));
      assert.equal(disposed(), 1); assert.ok(source.budget.live.size > 0, 'asset remains caller-owned');
    } finally { cleanup(source); }
  }
});

test('combined model footprint and every source vertex radial reach are enforced before publication', async () => {
  const api = await channelApi();
  const document = triangleJson(); document.meshes[0].primitives[0].mode = 0;
  document.nodes = [{ children: [1, 2] }, { mesh: 0, translation: [-60000, 0, 0] }, { mesh: 0, translation: [60000, 0, 0] }];
  for (const [input, hide] of [[gltf(document), false], [xyz([[100000, 0, -1], [0, 0, 0]]), true]]) {
    const source = await prepareSource(input); const disposed = onDispose(source.instance);
    try {
      if (hide) drawables(source.instance.object)[0].geometry.setDrawRange(1, 1);
      assert.throws(() => drainWork(api.createMapModelChannelWork(workInput(source))));
      assert.ok(disposed() > 0);
    } finally { cleanup(source); }
  }
});

test('per-job output quotas admit the exact boundary and reject expansion before partial publication', async () => {
  const api = await channelApi();
  for (const [vertices, indices, passes] of [[3, 3, true], [2, 3, false], [3, 2, false], [0, 0, false]]) {
    const source = await prepareSource(gltf(triangleJson())); let result;
    try {
      const execute = () => drainWork(api.createMapModelChannelWork(workInput(source, { limits: { vertices, indices } })));
      if (passes) { result = execute(); assert.deepEqual(result.counts, { vertices: 3, indices: 3 }); }
      else assert.throws(execute);
    } finally { cleanup(source, result); }
  }
  const source = await prepareSource(gltf(triangleJson()));
  try {
    drawables(source.instance.object)[0].geometry.setIndex([0, 1, 2, 0, 2, 1]);
    assert.throws(() => drainWork(api.createMapModelChannelWork(workInput(source, { limits: { vertices: 5, indices: 6 } }))),
      'three source rows expanding to six flat corners cannot fit a five-vertex quota');
  } finally { cleanup(source); }
});

test('receipt storage covers each distinct output backing and scratch is retired before ready', async () => {
  const api = await channelApi(); const source = await prepareSource(gltf(interleavedFixture())); let result;
  try {
    const baseline = new Set(source.budget.live.keys());
    result = drainWork(api.createMapModelChannelWork(workInput(source)));
    assert.ok(Object.isFrozen(result) && Object.isFrozen(result.primitives) && Object.isFrozen(result.counts) && Object.isFrozen(result.storage));
    const backing = new Set(result.primitives.flatMap(row => [row.geometry.index.buffer, ...Object.values(row.geometry.attributes).map(attr => attr.array.buffer)]));
    assert.equal(result.storage.length, backing.size);
    assert.deepEqual(result.storage.map(row => row.byteLength).sort((a, b) => a - b), [...backing].map(buffer => buffer.byteLength).sort((a, b) => a - b));
    for (const row of result.storage) { assert.ok(Object.isFrozen(row)); assert.notEqual(row.purpose, 'scratch'); assert.equal(source.budget.live.get(row.key)?.byteLength, row.byteLength); }
    assert.equal([...source.budget.live.values()].some(row => row.purpose === 'scratch'), false);
    result.dispose(); result.dispose(); assert.deepEqual(new Set(source.budget.live.keys()), baseline);
  } finally { cleanup(source, result); }
});

test('output constructors follow actual reservation and callback abort prevents the next allocation', async () => {
  const api = await channelApi();
  for (const abort of [false, true]) {
    const source = await prepareSource(gltf(interleavedFixture())); const controller = new AbortController();
    const native = { ArrayBuffer, Float32Array, Float64Array, Uint32Array, Int32Array, Uint16Array, Int16Array, Uint8Array, Uint8ClampedArray, Int8Array };
    const pending = []; let allocations = 0, result;
    source.budget.onReserve = row => { pending.push(row); if (abort) controller.abort(); };
    try {
      for (const [name, Constructor] of Object.entries(native)) globalThis[name] = new Proxy(Constructor, { construct(target, args) {
        if (name === 'ArrayBuffer' || !(args[0] instanceof native.ArrayBuffer)) {
          const count = typeof args[0] === 'number' ? args[0] : args[0]?.length ?? 0;
          const bytes = name === 'ArrayBuffer' ? count : count * Constructor.BYTES_PER_ELEMENT;
          assert.equal(pending.shift()?.byteLength, bytes, 'reserve precedes owned backing constructor'); allocations++;
        }
        return Reflect.construct(target, args, target);
      } });
      const execute = () => drainWork(api.createMapModelChannelWork(workInput(source, { signal: controller.signal })));
      if (abort) { assert.throws(execute); assert.equal(allocations, 0); }
      else { result = execute(); assert.ok(allocations > 0); assert.equal(pending.length, 0); }
    } finally {
      Object.assign(globalThis, native); source.budget.onReserve = undefined; cleanup(source, result);
    }
  }
});

test('storage rejection preserves installed reservations and retires only the candidate instance', async () => {
  const api = await channelApi(); const source = await prepareSource(gltf(interleavedFixture()));
  const installed = source.budget.reserve({ token: 'installed', purpose: 'attribute', byteLength: 17 });
  const baseline = new Set(source.budget.live.keys()), disposed = onDispose(source.instance);
  source.budget.ceiling = source.budget.bytes;
  try {
    assert.throws(() => drainWork(api.createMapModelChannelWork(workInput(source))));
    assert.equal(disposed(), 1); assert.deepEqual(new Set(source.budget.live.keys()), baseline);
  } finally { installed.release(); cleanup(source); }
});

test('dispose before first step and mid-work releases source; disposal after ready leaves transferred receipt alive', async () => {
  const api = await channelApi();
  for (const stage of ['unstarted', 'working', 'ready']) {
    const source = await prepareSource(gltf(interleavedFixture())); const disposed = onDispose(source.instance); let result;
    try {
      const work = api.createMapModelChannelWork(workInput(source));
      if (stage === 'working') assert.equal(work.step({ bytes: 1, scalars: 1, records: 1 }).done, false);
      if (stage === 'ready') result = drainWork(work);
      work.dispose(); work.dispose();
      assert.equal(disposed(), stage === 'ready' ? 0 : 1);
      if (result) { assert.ok(source.budget.live.size > source.asset.storage.length); result.dispose(); assert.equal(disposed(), 1); }
    } finally { cleanup(source, result); }
  }
});

test('invalid factory quotas and aborted async preparation retire ownership without a partial receipt', async () => {
  const api = await channelApi();
  const source = await prepareSource(gltf(interleavedFixture())); const disposed = onDispose(source.instance);
  try {
    assert.throws(() => api.createMapModelChannelWork(workInput(source, { limits: { vertices: -1, indices: 3 } })));
    assert.equal(disposed(), 1);
    const controller = new AbortController(); controller.abort();
    await assert.rejects(api.prepareMapModelChannels(source.asset, {}, { budget: source.budget, limits, signal: controller.signal }), { name: 'AbortError' });
  } finally { cleanup(source); }
});

test('two physical epochs retain one actual textured asset and close images only after final retirement', async () => {
  const api = await channelApi(); const budget = makeBudget(); let decoded = 0, closed = 0;
  const document = richFixture(); const asset = await prepareModelAsset(gltf(document), { execution: 'local', budget },
    { async decodeImage() { decoded++; return { width: 1, height: 1, close() { closed++; } }; } });
  let first, second;
  try {
    first = await api.prepareMapModelChannels(asset, {}, { budget, limits });
    second = await api.prepareMapModelChannels(asset, { metersPerUnit: 2 }, { budget, limits });
    assert.equal(decoded, 1); assert.equal(closed, 0);
    assert.ok(first.primitives[0].material.map); assert.equal(first.primitives[0].material.map.image, second.primitives[0].material.map.image);
    assert.notEqual(first.primitives[0].material, second.primitives[0].material);
    assert.notEqual(first.primitives[0].geometry.attributes.position.array.buffer, second.primitives[0].geometry.attributes.position.array.buffer);
    asset.dispose(); assert.equal(closed, 0);
    first.dispose(); first.dispose(); assert.equal(closed, 0);
    second.dispose(); second.dispose(); assert.equal(closed, 1); assert.equal(budget.live.size, 0);
    await assert.rejects(api.prepareMapModelChannels(asset, {}, { budget, limits }));
  } finally { first?.dispose(); second?.dispose(); asset.dispose(); }
});
