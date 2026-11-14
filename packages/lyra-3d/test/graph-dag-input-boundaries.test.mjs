import assert from 'node:assert/strict';
import test from 'node:test';
import { layoutGraphDagAsync } from '../dist/graph-layout/async.js';
import { layoutGraphDag } from '../dist/graph-layout/index.js';

const code = (expected) => (error) => error.code === expected;
const chain = (nodeCount) => ({
  nodeCount,
  source: Uint32Array.from({ length: nodeCount - 1 }, (_, i) => i),
  target: Uint32Array.from({ length: nodeCount - 1 }, (_, i) => i + 1),
});
const detach = (array) => { structuredClone(array.buffer, { transfer: [array.buffer] }); };

test('edge columns of different lengths are rejected before layout', () => {
  assert.throws(() => layoutGraphDag({ nodeCount: 3, source: new Uint32Array([0]), target: new Uint32Array([1, 2]) }), code('invalid-input'));
  assert.throws(() => layoutGraphDag({ nodeCount: 3, source: new Uint32Array([0, 1]), target: new Uint32Array([1]) }), code('invalid-input'));
});

for (const column of ['source', 'target']) {
  test(`detaching the borrowed ${column} column during an async snapshot fails closed`, async () => {
    const input = chain(3000);
    let detached = false;
    await assert.rejects(layoutGraphDagAsync(input, undefined, {
      onProgress(progress) {
        if (detached || progress.phase !== 'snapshot' || progress.operations === 0) return;
        detached = true; detach(input[column]);
      },
    }), code('invalid-input'));
    assert.equal(detached, true);
    assert.equal(input[column].length, 0);
  });
}

test('a rank too wide for the coordinate range is rejected rather than clipped', () => {
  // 484 unconnected nodes share rank 0 as a 22 by 22 grid: 21 node gaps of 1e6 span 1.05e7 either side.
  const wide = { nodeCount: 484, source: new Uint32Array(), target: new Uint32Array() };
  assert.throws(() => layoutGraphDag(wide, { nodeGap: 1000000 }), code('coordinate-range'));
  const fits = layoutGraphDag({ ...wide, nodeCount: 441 }, { nodeGap: 1000000 });
  assert.equal(fits.layerCount, 1);
  assert.equal(Math.max(...fits.positions.map(Math.abs)), 10000000);
});
