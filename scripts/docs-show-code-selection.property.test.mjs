import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { selectShowCodeDocs } from './docs-show-code-selection.mjs';

const fc = createRequire(new URL('../packages/lyra-ui/package.json', import.meta.url))('fast-check');

test('Show Code partitions remain exhaustive and disjoint for arbitrary inventories and shard counts', () => {
  fc.assert(fc.property(
    fc.uniqueArray(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 100 }),
    fc.nat({ max: 99 }),
    (ids, requestedTotal) => {
      const total = 1 + requestedTotal % ids.length;
      const docs = ids.map(id => ({ id }));
      const partitions = Array.from({ length: total }, (_, index) => selectShowCodeDocs(docs, {
        shardIndex: index + 1, shardTotal: total,
      }).selected.map(doc => doc.id));
      assert.deepEqual(partitions.flat().sort(), [...ids].sort());
      assert.equal(new Set(partitions.flat()).size, ids.length);
      assert.ok(partitions.every(partition => partition.length > 0));
      assert.ok(Math.max(...partitions.map(partition => partition.length)) - Math.min(...partitions.map(partition => partition.length)) <= 1);
      assert.deepEqual(selectShowCodeDocs([...docs].reverse(), { shardIndex: 1, shardTotal: total }).selected,
        selectShowCodeDocs(docs, { shardIndex: 1, shardTotal: total }).selected);
    },
  ), { seed: 0x5eed_1e57, numRuns: 200 });
});
