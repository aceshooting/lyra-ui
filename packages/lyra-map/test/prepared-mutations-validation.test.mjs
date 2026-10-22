import assert from 'node:assert/strict';
import test from 'node:test';
import { addPreparedFeatures } from '../scripts/prepared-mutations.mjs';

/** A map that records native calls; `overrides` replace members to model inconsistent native state. */
function harness(overrides = {}) {
  const sources = new Map();
  const layers = new Map([['labels', { id: 'labels', type: 'background' }]]);
  const calls = [];
  return Object.assign({
    style: {}, _removed: false, sources, layers, calls,
    on() {}, off() {},
    getLayersOrder: () => [...layers.keys()],
    getSource: (id) => sources.get(id),
    getLayer: (id) => layers.get(id),
    async prepareFeatures(requirements) { calls.push(['prepare', requirements]); },
    addSource(id, source) { calls.push(['source', id]); sources.set(id, source); return this; },
    removeSource(id) { sources.delete(id); return this; },
    addLayer(layer) { calls.push(['layer', layer.id]); layers.set(layer.id, layer); return this; },
    removeLayer(id) { layers.delete(id); return this; },
  }, overrides);
}

const geojson = (extra = {}) => ({ type: 'geojson', data: { type: 'FeatureCollection', features: [], ...extra } });
const background = (id, before) => ({ layer: { id, type: 'background' }, before });
/** An array that passes the own-key count check but has no value at index 0. */
function holeAtZero() {
  const array = [];
  array.length = 1;
  Object.defineProperty(array, 'marker', { value: true, enumerable: true });
  return array;
}
let reads = 0;
function accessorAtZero() {
  const array = [];
  Object.defineProperty(array, 0, { get() { reads += 1; return background('x'); }, enumerable: true });
  return array;
}
const deep = (levels) => { let value = { leaf: true }; for (let level = 0; level < levels; level += 1) value = { child: value }; return value; };

const options = [
  ['null', null], ['a string', 'signal'], ['a number', 7], ['false', false],
  ['an unknown member', { other: true }], ['a symbol member', { [Symbol('signal')]: undefined }],
];
for (const [name, value] of options) {
  test(`options given as ${name} are refused before anything is read from the batch`, async () => {
    const map = harness();
    await assert.rejects(addPreparedFeatures(map, { sources: { points: geojson() } }, value), { code: 'invalid-options' });
    assert.deepEqual(map.calls, []);
    assert.equal(map._modularMutation, undefined);
  });
}

const malformed = [
  ['an array instead of a batch', []],
  ['null instead of a batch', null],
  ['text instead of a batch', 'sources'],
  ['an unknown batch member', { sources: {}, extra: 1 }],
  ['sources given as an array', { sources: [] }],
  ['sources given as text', { sources: 'points' }],
  ['layers given as text', { layers: 'labels' }],
  ['layers given as an object', { layers: {} }],
  ['more than 64 sources', { sources: Object.fromEntries(Array.from({ length: 65 }, (_, index) => [`s${index}`, geojson()])) }],
  ['an empty source id', { sources: { '': geojson() } }],
  ['a source id longer than 1024 code units', { sources: { ['s'.repeat(1025)]: geojson() } }],
  ['a source without a type', { sources: { points: {} } }],
  ['a source with a non-string type', { sources: { points: { type: 5 } } }],
  ['a null source', { sources: { points: null } }],
  ['a layer entry with an unknown member', { layers: [{ ...background('a'), extra: true }] }],
  ['a layer entry without a layer', { layers: [{}] }],
  ['a layer without a type', { layers: [{ layer: { id: 'a' } }] }],
  ['a layer with a non-string type', { layers: [{ layer: { id: 'a', type: 7 } }] }],
  ['an empty layer id', { layers: [background('')] }],
  ['a non-string layer id', { layers: [{ layer: { id: 5, type: 'background' } }] }],
  ['a layer id longer than 1024 code units', { layers: [background('l'.repeat(1025))] }],
  ['an empty source reference', { layers: [{ layer: { id: 'a', type: 'circle', source: '' } }] }],
  ['an empty anchor', { layers: [background('a', '')] }],
  ['a non-string anchor', { layers: [background('a', 5)] }],
  ['a layers array with a hole', { layers: holeAtZero() }],
  ['a layers array with an accessor entry', { layers: accessorAtZero() }],
  ['an array value with a hole', { sources: { points: geojson({ list: holeAtZero() }) } }],
  ['an array value with an accessor entry', { sources: { points: geojson({ list: accessorAtZero() }) } }],
  ['an array value with an extra member', { sources: { points: geojson({ list: Object.assign([1], { extra: true }) }) } }],
  ['an array value longer than 100000 entries', { sources: { points: geojson({ list: new Array(100001).fill(0) }) } }],
  ['a non-finite number', { sources: { points: geojson({ value: Number.POSITIVE_INFINITY }) } }],
  ['a number that is not a number', { sources: { points: geojson({ value: Number.NaN }) } }],
  ['values nested deeper than 32 levels', { sources: { points: geojson({ nested: deep(40) }) } }],
  ['more than 100000 values in total', { sources: { a: geojson({ list: new Array(60000).fill(0) }), b: geojson({ list: new Array(60000).fill(0) }) } }],
  ['text longer than 4194304 code units', { sources: { points: geojson({ note: 'x'.repeat(4194305) }) } }],
  ['member names longer than 4194304 code units in total', { sources: { points: geojson(Object.fromEntries(
    Array.from({ length: 5 }, (_, index) => [`${index}`.padEnd(1000000, 'k'), 0]))) } }],
];
for (const [name, input] of malformed) {
  test(`refuses ${name} without preparing or adding anything`, async () => {
    const map = harness();
    reads = 0;
    await assert.rejects(addPreparedFeatures(map, input), { code: 'invalid-descriptor' });
    assert.equal(reads, 0, 'accessors are never executed');
    assert.deepEqual(map.calls, []);
    assert.equal(map._modularMutation, undefined, 'the refused call leaves no pending ownership');
  });
}

test('a layer without a source is refused unless its type draws without one', async () => {
  const map = harness();
  await assert.rejects(addPreparedFeatures(map, { layers: [{ layer: { id: 'a', type: 'circle' } }] }), { code: 'missing-source' });
  assert.deepEqual(map.calls, []);
  await addPreparedFeatures(map, { layers: [{ layer: { id: 'sky', type: 'sky' } }, { layer: { id: 'custom', type: 'custom' } }, background('plain')] });
  assert.deepEqual([...map.layers.keys()].sort(), ['custom', 'labels', 'plain', 'sky']);
});

test('inconsistent native layer order is refused instead of guessed at', async () => {
  const batch = { layers: [background('a')] };
  for (const [name, order, code] of [
    ['an order that is not a list', () => 'labels', 'invalid-descriptor'],
    ['an order that would pass 4096 layers', () => Array.from({ length: 4096 }, (_, index) => `layer-${index}`), 'invalid-descriptor'],
    ['an order that repeats a layer', () => ['labels', 'labels'], 'collision'],
    ['an order that already lists the new layer', () => ['labels', 'a'], 'collision'],
  ]) {
    const map = harness({ getLayersOrder: order });
    await assert.rejects(addPreparedFeatures(map, batch), { code }, name);
    assert.deepEqual(map.calls, [], name);
  }
  const ghost = harness({ getLayer: (id) => (id === 'ghost' ? { id } : undefined), getLayersOrder: () => ['labels'] });
  await assert.rejects(addPreparedFeatures(ghost, { layers: [background('a', 'ghost')] }), { code: 'missing-anchor' });
  assert.deepEqual(ghost.calls, []);
});

test('a layer batch fits exactly up to the 4096 layer ceiling', async () => {
  const map = harness({ getLayersOrder: () => Array.from({ length: 4095 }, (_, index) => `layer-${index}`) });
  await addPreparedFeatures(map, { layers: [background('last')] });
  assert.deepEqual(map.calls.map(([kind]) => kind), ['prepare', 'layer']);
});

test('a source the native map silently fails to register is reported and not left behind', async () => {
  const map = harness({ addSource(id) { this.calls.push(['source', id]); return this; } });
  await assert.rejects(addPreparedFeatures(map, { sources: { points: geojson() } }), { code: 'native-failure' });
  assert.equal(map.sources.size, 0);
  assert.equal(map._modularMutation, undefined);
});

test('an abort that arrives while the layer order is being planned still cancels before preparation', async () => {
  const map = harness();
  map.getLayersOrder = () => new Proxy(['labels'], {
    get(target, key, receiver) {
      if (key === 'length') map._modularMutation.abort();
      return Reflect.get(target, key, receiver);
    },
  });
  await assert.rejects(addPreparedFeatures(map, { layers: [background('a')] }), { name: 'AbortError' });
  assert.deepEqual(map.calls, [], 'nothing was prepared or added');
  assert.equal(map._modularMutation, undefined);
});

test('maps constructed without a style get an empty one before the batch is checked', async () => {
  const map = harness({
    style: undefined,
    initialized: 0,
    _lazyInitEmptyStyle() { this.initialized += 1; this.style = {}; },
  });
  await addPreparedFeatures(map, { sources: { points: geojson() }, layers: [{ layer: { id: 'dots', type: 'circle', source: 'points' } }] });
  assert.equal(map.initialized, 1);
  assert.ok(map.sources.has('points') && map.layers.has('dots'));
});
