import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS } from './fixtures/catalog.mjs';
import { makeListInputs } from './fixtures/list-inputs.mjs';

test('list workloads are fixed-size members of quick and stress profiles', () => {
  for (const [id, size] of [['document-library-filter-10000', 10000], ['eval-dataset-select-10000', 10000], ['retrieval-results-select-10000', 10000], ['ingestion-queue-progress-5000', 5000]]) {
    const scenario = SCENARIOS.find(scenario => scenario.id === id);
    assert.equal(scenario?.size, size);
    assert.deepEqual(scenario.profiles, ['quick', 'stress']);
    assert.ok(scenario.assertionIds.length >= 3);
    if (id.startsWith('retrieval')) {
      assert.equal(scenario.parameters.retainedMin, 9999);
      assert.equal(scenario.parameters.retainedMax, 10000);
    } else assert.equal(scenario.parameters.retainedMin, undefined);
  }
});
test('list inputs retain compact shared source identities and preallocated progress variants', () => {
  const inputs = makeListInputs();
  assert.equal(inputs.documents.length, 10000);
  assert.equal(inputs.examples.length, 10000);
  assert.equal(inputs.chunks.length, 10000);
  assert.ok(inputs.chunks.every(chunk => chunk.source === inputs.chunks[0].source && !('metadata' in chunk)));
  assert.ok(Object.isFrozen(inputs.chunks[0].source));
  assert.equal(inputs.documentPages[0].length, 100);
  assert.equal(inputs.documentPages[1][0].id, 'doc-00007');
  assert.equal(inputs.ticks[0].length, 5000);
  assert.equal(inputs.ticks[1].length, 5000);
  assert.ok(inputs.ticks.every(items => Object.isFrozen(items) && Object.isFrozen(items[0])));
  assert.notEqual(inputs.ticks[0], inputs.ticks[1]);
  assert.notEqual(inputs.ticks[0][0], inputs.ticks[1][0]);
  assert.equal(inputs.ticks[0][1], inputs.ticks[1][1]);
  assert.deepEqual(inputs.ticks.map(items => items[0].progress), [40, 41]);
});
