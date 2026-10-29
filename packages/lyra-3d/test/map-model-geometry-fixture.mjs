import assert from 'node:assert/strict';
import { prepareModelAsset, instantiatePreparedModel } from '../dist/model/model-asset.js';

export const channelApi = () => import('../dist/map/model-geometry-channels.js');
export const limits = Object.freeze({ vertices: 1_000_000, indices: 6_000_000 });
export const quota = Object.freeze({ bytes: 4096, scalars: 4096, records: 64 });

export function makeBudget() {
  let serial = 0;
  const live = new Map(), requests = [], releases = [];
  const budget = {
    live, requests, releases, ceiling: Infinity, onReserve: undefined,
    get bytes() { return [...live.values()].reduce((sum, row) => sum + row.byteLength, 0); },
    reserve(request) {
      assert.ok(Number.isSafeInteger(request.byteLength) && request.byteLength >= 0);
      assert.ok(!requests.some(row => row.token === request.token), 'actual allocation tokens are unique');
      if (budget.bytes + request.byteLength > budget.ceiling) throw new RangeError('Fixture storage limit');
      const row = { ...request, key: `storage-${serial++}` }; requests.push(row); live.set(row.key, row);
      budget.onReserve?.(row);
      let released = false;
      return { key: row.key, release() {
        if (released) return;
        released = true; assert.ok(live.delete(row.key), 'one live lease retires once'); releases.push(row.key);
      } };
    },
    admitCounts() {}, noteNativeImage() {}
  };
  return budget;
}

/** Uses actual asset admission and materialization; no fabricated asset or instance receipt. */
export async function prepareSource(input, { budget = makeBudget(), services = {} } = {}) {
  const asset = await prepareModelAsset(input, { execution: 'local', budget }, services);
  try {
    const instance = await instantiatePreparedModel(asset, { budget });
    return { asset, instance, budget };
  } catch (error) { asset.dispose(); throw error; }
}

export function drainWork(work, budget = quota) {
  const used = { bytes: 0, scalars: 0, records: 0 };
  try {
    for (let iterations = 0; iterations < 1_000_000; iterations++) {
      const step = work.step(budget);
      for (const key of Object.keys(used)) {
        assert.ok(Number.isSafeInteger(step.used[key]) && step.used[key] >= 0 && step.used[key] <= budget[key]);
        used[key] += step.used[key];
      }
      if (step.done) { assert.deepEqual(step.value.work, used); return step.value; }
      assert.ok(step.used.bytes + step.used.scalars + step.used.records > 0, 'unfinished work makes bounded progress');
    }
    assert.fail('Fixture work exceeded its bounded drain');
  } catch (error) { work.dispose(); throw error; }
}

export function drawables(object) {
  const result = [];
  object.traverse(node => { if (node.geometry) result.push(node); });
  return result;
}

export function values(attribute) {
  const result = [];
  for (let row = 0; row < attribute.count; row++) {
    for (let axis = 0; axis < attribute.itemSize; axis++) result.push(attribute.array[row * attribute.stride + attribute.offset + axis]);
  }
  return result;
}

/** Ignore retained material identity and storage tokens when comparing deterministic numeric output. */
export function numericReceipt(receipt) {
  return {
    counts: receipt.counts, work: receipt.work,
    primitives: receipt.primitives.map(row => ({
      node: row.node, membership: row.membership, kind: row.kind, normalMode: row.normalMode, tangentMode: row.tangentMode,
      geometry: { attributes: Object.fromEntries(Object.entries(row.geometry.attributes).map(([key, value]) =>
        [key, { values: values(value), itemSize: value.itemSize, count: value.count, stride: value.stride, offset: value.offset, normalized: value.normalized }])),
      index: [...row.geometry.index], groups: row.geometry.groups, drawRange: row.geometry.drawRange }
    }))
  };
}

export function assertNear(actual, expected, epsilon = 1e-5) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => assert.ok(Number.isFinite(value) && Math.abs(value - expected[index]) <= epsilon,
    `coordinate ${index}: ${value} differs from ${expected[index]}`));
}
