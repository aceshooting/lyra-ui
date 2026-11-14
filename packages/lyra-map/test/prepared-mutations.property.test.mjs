import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { addPreparedFeatures } from '../scripts/prepared-mutations.mjs';

const runs = { seed: 0x5eed_1e57, numRuns: 200, includeErrorInReport: true };
const rows = fc.array(fc.record({ priority: fc.integer({ min: 0, max: 1000 }), anchor: fc.nat(1000) }), { minLength: 1, maxLength: 40 });

function mapWith(existing) {
  const order = existing.map(layer => layer.id), layers = new Map(existing.map(layer => [layer.id, layer]));
  const listeners = new Set();
  return {
    style: {}, order, layers, listeners,
    getSource() {}, getLayer(id) { return layers.get(id); }, getLayersOrder() { return [...order]; },
    async prepareFeatures() {}, on(_type, listener) { listeners.add(listener); }, off(_type, listener) { listeners.delete(listener); },
    addLayer(layer, before) {
      assert.equal(layers.has(layer.id), false);
      assert.ok(before === undefined || layers.has(before));
      layers.set(layer.id, layer); order.splice(before === undefined ? order.length : order.indexOf(before), 0, layer.id);
    },
    removeLayer(id) { layers.delete(id); order.splice(order.indexOf(id), 1); },
  };
}

// Select the earliest input whose predecessors have all been emitted. This deliberately uses
// sets and scans instead of the production heap and outgoing-edge counts.
function expectedOrder(existing, requested) {
  const names = [...existing, ...requested.map(entry => entry.layer.id)];
  const predecessors = new Map(names.map(name => [name, new Set()]));
  for (let index = 1; index < existing.length; index++) predecessors.get(existing[index]).add(existing[index - 1]);
  for (const { layer, before } of requested) {
    if (before !== undefined) predecessors.get(before).add(layer.id);
    else if (existing.length) predecessors.get(layer.id).add(existing.at(-1));
  }
  const result = [], emitted = new Set();
  while (result.length < names.length) {
    const next = names.find(name => !emitted.has(name) && [...predecessors.get(name)].every(value => emitted.has(value)));
    assert.notEqual(next, undefined, 'the generated constraints must be acyclic');
    result.push(next); emitted.add(next);
  }
  return result;
}

test('prepared layers preserve stable input priority across arbitrary acyclic forward anchors', async () => {
  await fc.assert(fc.asyncProperty(rows, fc.boolean(), async (values, withExisting) => {
    const ids = values.map((_value, index) => `layer-${index}`);
    const topological = [...ids];
    const existing = withExisting ? [{ id: 'base', type: 'background' }] : [];
    if (withExisting) topological.splice(Math.floor(ids.length / 2), 0, 'base');
    const requested = values.map((value, index) => {
      const position = topological.indexOf(ids[index]);
      const later = topological.slice(position + 1);
      if (!withExisting || position > topological.indexOf('base')) later.push(undefined);
      return { layer: { id: ids[index], type: 'background' }, before: later[value.anchor % later.length] };
    }).sort((a, b) => values[ids.indexOf(a.layer.id)].priority - values[ids.indexOf(b.layer.id)].priority);
    const original = structuredClone(requested), map = mapWith(existing);
    assert.equal(await addPreparedFeatures(map, { layers: requested }), map);
    assert.deepEqual(map.order, expectedOrder(existing.map(layer => layer.id), requested));
    assert.deepEqual(requested, original, 'caller descriptors remain untouched');
    assert.equal(map.layers.size, requested.length + existing.length);
    for (const layer of existing) assert.equal(map.layers.get(layer.id), layer);
    assert.equal(map.listeners.size, 0);
    assert.equal(map._modularMutation, undefined);
  }), runs);
});
