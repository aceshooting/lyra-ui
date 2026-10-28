import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { createGraphNodeMeshWork } from '../dist/graph/node-mesh.js';
import { triangleMesh } from './graph-node-mesh-fixtures.mjs';

function drain(rows, budget) {
  const work = createGraphNodeMeshWork(rows, rows.length); let bytes = 0;
  for (let calls = 0; calls < 100000; calls++) {
    const step = work.step(budget);
    assert.ok(step.operations >= 0 && step.operations <= budget); bytes += step.allocatedBytes;
    if (step.done) return { value: step.value, bytes };
    assert.ok(step.operations > 0);
  }
  assert.fail('generated bounded work did not finish');
}

test('custom geometry results and ownership are independent of operation chunking', () => {
  fc.assert(fc.property(fc.record({ faces: fc.integer({ min: 1, max: 64 }),
    index: fc.integer({ min: 0, max: 15 }), scale: fc.integer({ min: 1, max: 100 }), colored: fc.boolean() }),
  ({ faces, index, scale, colored }) => {
    const mesh = triangleMesh(faces, colored ? [.25, .5, .75, 1] : undefined);
    for (let i = 0; i < mesh.positions.length; i++) mesh.positions[i] *= scale / 100;
    const rows = Array(index + 1).fill(null); rows[index] = mesh; const before = structuredClone(mesh);
    for (const budget of [1, 7, 4096]) {
      const result = drain(rows, budget), data = result.value;
      assert.equal(data.triangleCount, faces); assert.equal(data.customNodeCount, 1);
      assert.equal(data.payloadBytes, faces * 48 + 16); assert.equal(result.bytes, faces * 48);
      assert.deepEqual(data.nodeMeshes[index], before); assert.deepEqual(mesh, before);
      assert.notEqual(data.nodeMeshes[index].positions.buffer, mesh.positions.buffer);
      assert.notEqual(data.nodeMeshes[index].normals.buffer, mesh.normals.buffer);
      assert.equal(data.nodeMeshes.filter(value => value !== null).length, 1);
    }
  }), { seed: 20261028, numRuns: 200 });
});
