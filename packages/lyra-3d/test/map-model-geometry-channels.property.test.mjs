import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { bytesOf, dataUri, utf8 } from './model-fixtures.mjs';
import { channelApi, prepareSource, drainWork, assertNear } from './map-model-geometry-fixture.mjs';

const runs = { seed: 0x5eed_3d71, numRuns: 200, includeErrorInReport: true };
const limits = { vertices: 100, indices: 100 };
const integer = fc.integer({ min: -100, max: 100 });
const point = fc.tuple(integer, integer, integer);
const quota = fc.integer({ min: 2, max: 127 });
const stepBudget = size => ({ bytes: size, scalars: size, records: size });

function snapshotObject(object) {
  object.updateMatrixWorld(true);
  const nodes = [];
  object.traverse(node => nodes.push({
    matrix: [...node.matrix.elements], matrixWorld: [...node.matrixWorld.elements],
    attributes: Object.fromEntries(Object.entries(node.geometry?.attributes ?? {})
      .map(([name, attribute]) => [name, [...attribute.array]])),
    index: node.geometry?.index ? [...node.geometry.index.array] : null,
  }));
  return nodes;
}

function geometryValue(receipt) {
  return {
    counts: receipt.counts, work: receipt.work,
    primitives: receipt.primitives.map(primitive => ({
      node: primitive.node, membership: primitive.membership, kind: primitive.kind,
      normalMode: primitive.normalMode, tangentMode: primitive.tangentMode,
      attributes: Object.fromEntries(Object.entries(primitive.geometry.attributes).map(([name, attribute]) =>
        [name, { ...attribute, array: [...attribute.array] }])),
      index: [...primitive.geometry.index], groups: primitive.geometry.groups,
      drawRange: primitive.geometry.drawRange,
    })),
  };
}

function meshSource(size, translations = [[0, 0, 0]]) {
  const positions = [0, 0, 0, size, 0, 0, 0, size, 0, size, size, 0];
  const normals = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1];
  const indices = new Uint16Array([0, 1, 2, 2, 1, 3]);
  const bytes = new Uint8Array(108);
  bytes.set(bytesOf(positions)); bytes.set(bytesOf(normals), 48);
  bytes.set(new Uint8Array(indices.buffer), 96);
  return { format: 'gltf', bytes: utf8(JSON.stringify({
    asset: { version: '2.0' }, buffers: [{ byteLength: bytes.length, uri: dataUri(bytes) }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 48 },
      { buffer: 0, byteOffset: 48, byteLength: 48 }, { buffer: 0, byteOffset: 96, byteLength: 12 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 4, type: 'VEC3', min: [0, 0, 0], max: [size, size, 0] },
      { bufferView: 1, componentType: 5126, count: 4, type: 'VEC3' },
      { bufferView: 2, componentType: 5123, count: 6, type: 'SCALAR' }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2 }] }],
    nodes: translations.map(translation => ({ mesh: 0, translation })),
    scenes: [{ nodes: translations.map((_, index) => index) }], scene: 0,
  })) };
}

test('real XYZ channels match an independent translation, unit and quaternion oracle without source mutation', async () => {
  const { createMapModelChannelWork } = await channelApi();
  await fc.assert(fc.asyncProperty(fc.array(point, { minLength: 1, maxLength: 8 }), point,
    fc.integer({ min: 1, max: 8 }), fc.integer({ min: -180, max: 180 }),
    async (points, translation, units, degrees) => {
      const source = { format: 'xyz', bytes: utf8(points.map(row => row.join(' ')).join('\n') + '\n') };
      const originalBytes = [...source.bytes];
      const prepared = await prepareSource(source);
      let receipt;
      try {
        prepared.instance.object.position.set(...translation);
        prepared.instance.object.updateMatrix();
        const before = snapshotObject(prepared.instance.object);
        const radians = degrees * Math.PI / 180;
        receipt = drainWork(createMapModelChannelWork({ instance: prepared.instance, budget: prepared.budget, placement: {
          metersPerUnit: units,
          orientation: [0, 0, 3 * Math.sin(radians / 2), 3 * Math.cos(radians / 2)],
        }, limits }), stepBudget(7));
        assert.equal(receipt.primitives.length, 1);
        assert.equal(receipt.primitives[0].kind, 'points');
        const expected = points.flatMap(([x, y, z]) => {
          const east = (x + translation[0]) * units;
          const north = -(z + translation[2]) * units;
          return [east * Math.cos(radians) - north * Math.sin(radians),
            east * Math.sin(radians) + north * Math.cos(radians), (y + translation[1]) * units];
        });
        const actual = [...receipt.primitives[0].geometry.attributes.position.array];
        assert.equal(actual.length, expected.length);
        actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) <= 0.001));
        assert.deepEqual(snapshotObject(prepared.instance.object), before);
        assert.deepEqual([...source.bytes], originalBytes);
      } finally {
        receipt?.dispose(); prepared.instance.dispose(); prepared.asset.dispose();
        assert.equal(prepared.budget.live.size, 0);
      }
    }), runs);
});

test('real indexed smooth GLTF channels and total work are independent of step partition', async () => {
  const { createMapModelChannelWork } = await channelApi();
  await fc.assert(fc.asyncProperty(fc.integer({ min: 1, max: 100 }), quota, async (size, middleQuota) => {
    const results = [];
    for (const stepQuota of [1, middleQuota, 4096]) {
      const prepared = await prepareSource(meshSource(size));
      let receipt;
      try {
        const before = snapshotObject(prepared.instance.object);
        receipt = drainWork(createMapModelChannelWork({ instance: prepared.instance,
          budget: prepared.budget, placement: {}, limits }), stepBudget(stepQuota));
        assert.deepEqual(receipt.counts, { vertices: 4, indices: 6 });
        assert.equal(receipt.primitives.length, 1);
        assert.equal(receipt.primitives[0].normalMode, 'transformed');
        assert.equal(receipt.primitives[0].geometry.attributes.normal.count, 4);
        assertNear([...receipt.primitives[0].geometry.attributes.normal.array],
          [0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0]);
        assert.deepEqual(snapshotObject(prepared.instance.object), before);
        results.push(geometryValue(receipt));
      } finally {
        receipt?.dispose(); prepared.instance.dispose(); prepared.asset.dispose();
        assert.equal(prepared.budget.live.size, 0);
      }
    }
    assert.deepEqual(results[1], results[0]); assert.deepEqual(results[2], results[0]);
  }), runs);
});

test('combined multi-node footprint and radial exact and one-metre-over bounds ignore step partition', async () => {
  const { createMapModelChannelWork } = await channelApi();
  await fc.assert(fc.asyncProperty(quota, fc.boolean(), fc.boolean(), async (middleQuota, overflow, radial) => {
    const left = radial ? 50000 : -50000;
    const right = (radial ? 99999 : 49999) + Number(overflow);
    for (const stepQuota of [1, middleQuota, 4096]) {
      const prepared = await prepareSource(meshSource(1, [[left, 0, 0], [right, 0, 0]]));
      let receipt;
      try {
        const run = () => drainWork(createMapModelChannelWork({ instance: prepared.instance,
          budget: prepared.budget, placement: {}, limits }), stepBudget(stepQuota));
        if (overflow) assert.throws(run);
        else {
          receipt = run();
          assert.deepEqual(receipt.counts, { vertices: 8, indices: 12 });
          assert.equal(receipt.primitives.length, 2);
          const east = receipt.primitives.flatMap(p => [...p.geometry.attributes.position.array]
            .filter((_, index) => index % 3 === 0));
          assert.equal(Math.max(...east) - Math.min(...east), radial ? 50000 : 100000);
          assert.equal(Math.max(...east.map(Math.abs)), radial ? 100000 : 50000);
        }
      } finally {
        receipt?.dispose(); prepared.instance.dispose(); prepared.asset.dispose();
        assert.equal(prepared.budget.live.size, 0);
      }
    }
  }), runs);
});
