import assert from 'node:assert/strict';
import test from 'node:test';
import { addPreparedFeatures } from '../scripts/prepared-mutations.mjs';

/** A map that records native calls; `prepareFeatures` also records its second argument. */
function harness() {
  const sources = new Map();
  const layers = new Map([['labels', { id: 'labels', type: 'background' }]]);
  const order = ['labels'];
  const calls = [];
  return {
    style: {}, _removed: false, sources, layers, order, calls,
    on() {}, off() {},
    getLayersOrder: () => [...order],
    getSource: (id) => sources.get(id),
    getLayer: (id) => layers.get(id),
    async prepareFeatures(requirements, options) { calls.push(['prepare', requirements, options]); },
    addSource(id, source) { calls.push(['source', id]); sources.set(id, source); return this; },
    removeSource(id) { sources.delete(id); return this; },
    addLayer(layer, before) {
      calls.push(['layer', layer.id]);
      layers.set(layer.id, layer);
      order.splice(before ? order.indexOf(before) : order.length, 0, layer.id);
      return this;
    },
    removeLayer(id) { layers.delete(id); order.splice(order.indexOf(id), 1); return this; },
  };
}

const geojson = (extra = {}) => ({ type: 'geojson', data: { type: 'FeatureCollection', features: [], ...extra } });
const background = (id, before) => ({ layer: { id, type: 'background' }, before });
const custom = (extra) => ({ layer: { id: 'user', type: 'custom', ...extra } });

/** Admitted when the batch is copied within every limit; refused with the descriptor code otherwise. */
async function admitted(input) {
  const map = harness();
  await addPreparedFeatures(map, input);
  return map;
}
async function refused(input) {
  const map = harness();
  await assert.rejects(addPreparedFeatures(map, input), { name: 'MapMutationError', code: 'invalid-descriptor' });
  assert.deepEqual(map.calls, [], 'nothing was prepared or added');
}

test('failures are named errors with a stable message and a code; cancellation is an AbortError', async () => {
  const map = harness();
  await assert.rejects(addPreparedFeatures(map, { layers: [background('labels')] }), {
    name: 'MapMutationError', message: 'Prepared map mutation failed.', code: 'collision',
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(addPreparedFeatures(map, {}, { signal: controller.signal }), {
    name: 'AbortError', message: 'Prepared map mutation cancelled.',
  });
});

test('native preparation receives the copied sources and the layer descriptors in input order, with the cancellation signal', async () => {
  const map = harness();
  const input = {
    sources: { points: geojson() },
    layers: [
      { layer: { id: 'dots', type: 'circle', source: 'points' }, before: 'labels' },
      background('top'),
    ],
  };
  await addPreparedFeatures(map, input);
  const [kind, requirements, options] = map.calls[0];
  assert.equal(kind, 'prepare');
  assert.deepEqual(Object.keys(requirements), ['sources', 'layers']);
  assert.deepEqual({ ...requirements.sources }, { points: geojson() });
  assert.deepEqual(requirements.layers, [{ id: 'dots', type: 'circle', source: 'points' }, { id: 'top', type: 'background' }]);
  assert.ok(options.signal instanceof AbortSignal, 'the shared cancellation signal is passed on');
  assert.equal(options.signal.aborted, false);
});

test('native preparation receives an empty layer list for a source-only batch', async () => {
  const map = harness();
  await addPreparedFeatures(map, { sources: { points: geojson() } });
  assert.deepEqual(map.calls[0][1].layers, []);
});

test('a custom layer keeps each of its four callbacks by identity', async () => {
  const callbacks = { render() {}, prerender() {}, onAdd() {}, onRemove() {} };
  const map = await admitted({ layers: [custom(callbacks)] });
  const layer = map.layers.get('user');
  for (const name of Object.keys(callbacks)) assert.equal(layer[name], callbacks[name], `${name} is passed through as is`);
});

test('callbacks are accepted only under the four callback names of a custom layer', async () => {
  const fn = () => {};
  await refused({ layers: [custom({ onResize: fn })] });
  await refused({ layers: [custom({ Render: fn })] });
  await refused({ layers: [custom({ paint: { render: fn } })] });
  await refused({ layers: [{ layer: { id: 'dots', type: 'circle', source: 'points', render: fn } }], sources: { points: geojson() } });
  await refused({ layers: [{ layer: { id: 'sky', type: 'sky', onAdd: fn } }] });
  await refused({ sources: { points: { type: 'geojson', render: fn } } });
  await refused({ sources: { points: { type: 'custom', render: fn } } });
});

test('a value under a callback name is validated like any other value unless it is a function', async () => {
  const shared = { nested: 1 };
  const map = await admitted({ layers: [custom({ render: shared })] });
  const copy = map.layers.get('user').render;
  assert.deepEqual(copy, shared);
  assert.notEqual(copy, shared, 'a plain record is copied, not handed to the native map');
  const accessor = Object.defineProperty({}, 'value', { get() { throw new Error('accessors never run'); }, enumerable: true });
  await refused({ layers: [custom({ render: accessor })] });
  await refused({ layers: [custom({ onAdd: Symbol('callback') })] });
});

test('descriptors with members but no type are refused with a descriptor error, not a TypeError', async () => {
  await refused({ sources: { points: { data: {} } } });
  await refused({ layers: [{ layer: { id: 'a', source: 'points' } }] });
});

test('the copy admits exactly 100000 values and refuses the next one', async () => {
  // source, 'geojson', data, 'FeatureCollection', features and the list itself are 6 values besides the elements.
  const list = (length) => ({ sources: { points: geojson({ list: new Array(length).fill(0) }) } });
  await admitted(list(100000 - 6));
  await refused(list(100000 - 5));
});

test('the copy admits exactly 4194304 code units of keys and text and refuses the next one', async () => {
  // Keys and string values count: 'type', 'data', 'type', 'features' and 'note' plus the two type names make 48.
  const note = (length) => ({ sources: { points: geojson({ note: 'x'.repeat(length) }) } });
  await admitted(note(4194304 - 48));
  await refused(note(4194304 - 47));
  // A key is charged before its value is read: 'type' and 'geojson' leave 4194293 code units for one key.
  const key = (length) => ({ sources: { points: { type: 'geojson', ['k'.repeat(length)]: 0 } } });
  await admitted(key(4194304 - 11));
  await refused(key(4194304 - 10));
});

test('values nest to depth 32 and no further, in records and in arrays alike', async () => {
  const records = (levels) => { let value = { leaf: true }; for (let level = 0; level < levels; level += 1) value = { child: value }; return value; };
  const arrays = (levels) => { let value = 0; for (let level = 0; level < levels; level += 1) value = [value]; return value; };
  const within = (nested) => ({ sources: { points: geojson({ nested }) } });
  // 'data' is at depth 1, so the outermost value sits at depth 2 and every level adds one.
  await admitted(within(records(29)));
  await refused(within(records(30)));
  await admitted(within(arrays(30)));
  await refused(within(arrays(31)));
  await refused(within(arrays(60)));
});

test('a layer batch admits exactly 256 layers, 64 sources and ids of 1024 code units', async () => {
  const layers = (count) => ({ layers: Array.from({ length: count }, (_, index) => background(`layer-${index}`)) });
  const map = await admitted(layers(256));
  assert.equal(map.order.length, 257);
  await refused(layers(257));

  const sources = (count) => ({ sources: Object.fromEntries(Array.from({ length: count }, (_, index) => [`source-${index}`, geojson()])) });
  assert.equal((await admitted(sources(64))).sources.size, 64);
  await refused(sources(65));

  const id = 'i'.repeat(1024);
  const long = await admitted({
    sources: { [id]: geojson() },
    layers: [{ layer: { id, type: 'circle', source: id }, before: 'labels' }, { layer: { id: 'other', type: 'background' }, before: id }],
  });
  assert.ok(long.sources.has(id) && long.layers.has(id));
  const tooLong = 'i'.repeat(1025);
  await refused({ sources: { [tooLong]: geojson() } });
  await refused({ layers: [background(tooLong)] });
  await refused({ layers: [{ layer: { id: 'x', type: 'circle', source: tooLong } }] });
  await refused({ layers: [background('x', tooLong)] });
});

test('the layers list must be a plain array with no members beyond its entries and length', async () => {
  const withExtra = (define) => {
    const list = [background('a')];
    define(list);
    return { layers: list };
  };
  await refused(withExtra((list) => { list.extra = true; }));
  await refused(withExtra((list) => Object.defineProperty(list, 'hidden', { value: true, enumerable: false })));
  await refused(withExtra((list) => { list[Symbol('marker')] = true; }));
  await refused({ layers: { length: 1, 0: background('a') } });
  await refused({ layers: new Array(2) });
});
