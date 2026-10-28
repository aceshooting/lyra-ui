import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { admitGraphNodeMeshes } from '../dist/graph/node-mesh.js';
import { graphNodeMeshStorage } from '../dist/graph/node-mesh-storage.js';
import { triangleMesh } from './graph-node-mesh-fixtures.mjs';

const options = { seed: 0x5eed_1e57, numRuns: 200, includeErrorInReport: true };
const rotate = ([x, y, z], axis) => {
  if (axis >= 3) { y = -y; z = -z; }
  return axis % 3 === 0 ? [x, y, z] : axis % 3 === 1 ? [z, y, -x] : [x, z, -y];
};

test('bounded face rotations and scales preserve owned geometry and outward orientation', () => {
  fc.assert(fc.property(fc.record({ triangles: fc.integer({ min: 1, max: 64 }), axis: fc.integer({ min: 0, max: 5 }),
    scale: fc.integer({ min: 10, max: 100 }), index: fc.integer({ min: 0, max: 30 }) }), ({ triangles, axis, scale, index }) => {
    const mesh = triangleMesh(triangles), factor = scale / 100;
    for (let offset = 0; offset < mesh.positions.length; offset += 3) {
      const value = rotate([...mesh.positions.subarray(offset, offset + 3)], axis).map(component => component * factor);
      mesh.positions.set(value, offset);
    }
    for (let offset = 0; offset < mesh.normals.length; offset += 3) mesh.normals.set(rotate([0, 0, 1], axis), offset);
    const before = [...mesh.positions], rows = Array(index + 1).fill(null); rows[index] = mesh;
    const result = admitGraphNodeMeshes(rows, rows.length);
    assert.equal(result.triangleCount, triangles);
    assert.equal(result.customNodeCount, 1);
    assert.deepEqual([...result.nodeMeshes[index].positions], before);
    mesh.positions.fill(0);
    assert.deepEqual([...result.nodeMeshes[index].positions], before);
  }), options);
});

test('storage arithmetic charges full mixed sorting without globally widening ordinary payloads', () => {
  fc.assert(fc.property(fc.record({ nodes: fc.integer({ min: 1, max: 1000 }), triangles: fc.integer({ min: 1, max: 64 }),
    ordinary: fc.integer({ min: 0, max: 100_000 }), sorted: fc.boolean(), scratch: fc.integer({ min: 0, max: 4096 }) }),
  ({ nodes, triangles, ordinary, sorted, scratch }) => {
    const value = graphNodeMeshStorage({ nodeCount: nodes, customNodeCount: 1, triangleCount: triangles,
      ordinaryPrimitiveCount: ordinary, sortKeyBytesBefore: 0, sortKeyBytesAfter: sorted ? (ordinary + triangles) * 8 : 0,
      scratchBytes: scratch });
    const payload = triangles * 48 + 16;
    const cpu = payload * 2 + triangles * 180 + (sorted ? (ordinary + triangles) * 8 : 0) + (nodes + 1) * 4 + nodes * 17 + scratch;
    assert.equal(value.payloadBytes, payload);
    assert.equal(value.cpuBytes, cpu);
    assert.equal(value.gpuBytes, triangles * 160);
    assert.equal(value.accountedBytes, cpu + triangles * 160);
    assert.equal(value.primitiveCount, ordinary + triangles);
  }), options);
});
