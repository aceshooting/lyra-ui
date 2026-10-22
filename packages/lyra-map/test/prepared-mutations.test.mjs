import assert from 'node:assert/strict';
import test from 'node:test';
import { addPreparedFeatures } from '../scripts/prepared-mutations.mjs';

const source = () => ({ type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
function harness() {
  const sources = new Map(), layers = new Map([['labels', { id: 'labels', type: 'background' }]]);
  const order = ['labels'], calls = [], listeners = new Set();
  const map = {
    style: {}, _removed: false, sources, layers, order, calls,
    on(type, listener) { if (type === 'error') listeners.add(listener); },
    off(type, listener) { if (type === 'error') listeners.delete(listener); },
    getLayersOrder() { return [...order]; },
    getSource(id) { return sources.get(id); }, getLayer(id) { return layers.get(id); },
    async prepareFeatures(requirements) { calls.push(['prepare', requirements]); },
    addSource(id, value) { calls.push(['source', id]); sources.set(id, value); return this; },
    removeSource(id) { calls.push(['source-', id]); sources.delete(id); return this; },
    addLayer(layer, before) {
      calls.push(['layer', layer.id]); layers.set(layer.id, layer);
      order.splice(before ? order.indexOf(before) : order.length, 0, layer.id); return this;
    },
    removeLayer(id) { calls.push(['layer-', id]); layers.delete(id); order.splice(order.indexOf(id), 1); return this; },
    fireError() { for (const listener of listeners) listener({ error: new Error('native detail') }); },
    listenerCount() { return listeners.size; }
  };
  return map;
}
const batch = () => ({ sources: { points: source() }, layers: [{ layer: { id: 'dots', type: 'circle', source: 'points' }, before: 'labels' }] });

test('prepares real descriptors then inserts forward anchors with stable order; native methods stay synchronous', async () => {
  const map = harness(); const input = batch();
  input.layers.push({ layer: { id: 'top', type: 'background' }, before: 'dots' });
  assert.equal(await addPreparedFeatures(map, input), map);
  assert.deepEqual(map.order, ['top', 'dots', 'labels']);
  assert.equal(map.calls[0][0], 'prepare'); assert.equal(map.calls[0][1].sources.points.type, 'geojson');
  assert.equal(map.addSource('direct', source()), map); assert.equal(map.listenerCount(), 0);
});

test('snapshots plain data before await and preserves explicit custom callbacks', async () => {
  const map = harness(); let release; map.prepareFeatures = () => new Promise(resolve => { release = resolve; });
  const render = () => {};
  const input = { sources: { pixels: { type: 'image', url: '/image.png', coordinates: [[0,0],[1,0],[1,1],[0,1]] } },
    layers: [{ layer: { id: 'custom', type: 'custom', render } }] };
  const pending = addPreparedFeatures(map, input); input.sources.pixels.coordinates[0][0] = 99;
  await Promise.resolve(); release(); await pending;
  assert.equal(map.sources.get('pixels').coordinates[0][0], 0);
  assert.equal(map.layers.get('custom').render, render);
});

test('passes transferable ordinary records to native source and layer methods', async () => {
  const map = harness(), properties = Object.create(null);
  Object.defineProperty(properties, '__proto__', { value: 'safe', enumerable: true });
  const input = { sources: { points: { type: 'geojson', data: { type: 'FeatureCollection', features: [
    { type: 'Feature', properties, geometry: { type: 'Point', coordinates: [0, 0] } }
  ] } } }, layers: [{ layer: { id: 'dots', type: 'circle', source: 'points' } }] };
  await addPreparedFeatures(map, input);
  const captured = map.sources.get('points');
  assert.equal(Object.getPrototypeOf(captured), Object.prototype);
  assert.equal(Object.getPrototypeOf(captured.data.features[0].properties), Object.prototype);
  assert.equal(Object.getOwnPropertyDescriptor(captured.data.features[0].properties, '__proto__').value, 'safe');
  assert.equal(Object.getPrototypeOf(map.layers.get('dots')), Object.prototype);
  assert.equal(Object.getPrototypeOf({}), Object.prototype);
});

test('rejects nested accessors without executing them, malformed arrays, and oversized batches', async () => {
  const map = harness(); let reads = 0; const bad = source();
  Object.defineProperty(bad.data, 'features', { get() { reads++; return []; } });
  await assert.rejects(addPreparedFeatures(map, { sources: { x: bad } }), { code: 'invalid-descriptor' });
  assert.equal(reads, 0); assert.equal(map.calls.length, 0);
  const entries = []; entries[2] = { layer: { id: 'x', type: 'background' } };
  await assert.rejects(addPreparedFeatures(map, { layers: entries }), { code: 'invalid-descriptor' });
  await assert.rejects(addPreparedFeatures(map, { layers: Array.from({ length: 257 }, (_, i) => ({ layer: { id: String(i), type: 'background' } })) }), { code: 'invalid-descriptor' });
});

test('rejects duplicate IDs, collisions, missing source/anchor dependencies and cycles before preparation', async () => {
  for (const [input, code] of [
    [{ layers: [{ layer: { id: 'labels', type: 'background' } }] }, 'collision'],
    [{ layers: [{ layer: { id: 'x', type: 'circle', source: 'absent' } }] }, 'missing-source'],
    [{ layers: [{ layer: { id: 'x', type: 'background' }, before: 'absent' }] }, 'missing-anchor'],
    [{ layers: [{ layer: { id: 'x', type: 'background' } }, { layer: { id: 'x', type: 'background' } }] }, 'invalid-descriptor'],
    [{ layers: [{ layer: { id: 'x', type: 'background' }, before: 'y' }, { layer: { id: 'y', type: 'background' }, before: 'x' }] }, 'cycle']
  ]) {
    const map = harness(); await assert.rejects(addPreparedFeatures(map, input), { code }); assert.equal(map.calls.length, 0);
  }
});

test('revalidates native collisions after preparation and preserves pre-existing resources', async () => {
  const map = harness(); map.prepareFeatures = async () => { map.sources.set('points', source()); };
  await assert.rejects(addPreparedFeatures(map, batch()), { code: 'collision' });
  assert.equal(map.sources.has('points'), true); assert.equal(map.layers.has('dots'), false);
});

test('aborts promptly even when preparation ignores signal and observes its late rejection', async () => {
  const map = harness(), controller = new AbortController(); let reject;
  map.prepareFeatures = () => new Promise((_resolve, fail) => { reject = fail; });
  const work = addPreparedFeatures(map, batch(), { signal: controller.signal });
  await Promise.resolve(); assert.equal(typeof reject, 'function', 'preparation must start before its signal is ignored');
  controller.abort();
  await assert.rejects(work, { name: 'AbortError' }); reject(new Error('late')); await Promise.resolve();
  assert.equal(map.sources.size, 0); assert.equal(map.listenerCount(), 0);
});

test('new shorthand supersedes old preparation and old completion cannot mutate', async () => {
  const map = harness(); let release; map.prepareFeatures = () => new Promise(resolve => { release = resolve; });
  const first = addPreparedFeatures(map, batch()); await Promise.resolve(); const old = assert.rejects(first, { name: 'AbortError' });
  map.prepareFeatures = async () => {};
  await addPreparedFeatures(map, { layers: [{ layer: { id: 'new', type: 'background' } }] });
  await old; release(); await Promise.resolve(); assert.equal(map.layers.has('dots'), false); assert.equal(map.layers.has('new'), true);
});

test('native style intent/removal cancellation and actual style replacement reject before mutation', async () => {
  for (const change of [map => map._modularMutation.abort(), map => { map.style = {}; }, map => { map._removed = true; }]) {
    const map = harness(); map.prepareFeatures = async () => { change(map); };
    await assert.rejects(addPreparedFeatures(map, batch()), { name: 'AbortError' }); assert.equal(map.sources.size, 0);
  }
});

test('preparation failures preserve prior native state without entering commit', async () => {
  const map = harness(); map.prepareFeatures = async () => { throw Error('import failure'); };
  await assert.rejects(addPreparedFeatures(map, batch()), /import failure/);
  assert.deepEqual(map.order, ['labels']); assert.equal(map.sources.size, 0);
});

test('rolls back same-owner synchronous native failure, including mutation then throw and error events', async () => {
  for (const mode of ['throw', 'event']) {
    const map = harness(), add = map.addLayer;
    map.addLayer = function(layer, before) { add.call(this, layer, before); if (mode === 'throw') throw Error('native detail'); this.fireError(); return this; };
    await assert.rejects(addPreparedFeatures(map, batch()), { code: 'native-failure' });
    assert.deepEqual(map.order, ['labels']); assert.equal(map.sources.size, 0); assert.equal(map.listenerCount(), 0);
  }
});

test('never rolls back against a replacement style or reentrant newer mutation intent', async () => {
  const map = harness(); let next;
  map.addSource = function(id, value) {
    this.sources.set(id, value);
    next = addPreparedFeatures(this, { layers: [{ layer: { id: 'new', type: 'background' } }] }); return this;
  };
  await assert.rejects(addPreparedFeatures(map, batch()), { name: 'AbortError' }); await next;
  assert.equal(map.sources.has('points'), true); assert.equal(map.layers.has('new'), true); assert.equal(map.listenerCount(), 0);
});

test('retains input order for default placement and siblings sharing an anchor', async () => {
  for (const before of [undefined, 'labels']) {
    const map = harness(); await addPreparedFeatures(map, { layers: ['a', 'b'].map(id => ({ layer: { id, type: 'background' }, before })) });
    assert.deepEqual(map.order, before ? ['a', 'b', 'labels'] : ['labels', 'a', 'b']);
  }
});

test('reports rollback limits without hiding a failed native cleanup', async () => {
  const map = harness(); map.addLayer = () => { throw Error('native'); }; map.removeSource = () => { throw Error('cleanup'); };
  await assert.rejects(addPreparedFeatures(map, batch()), { code: 'rollback-failure' }); assert.equal(map.listenerCount(), 0);
});

test('abort listeners that start a newer batch retain newest ownership', async () => {
  const map = harness(); let newest;
  map.prepareFeatures = (_requirements, { signal }) => new Promise(() => {
    signal.addEventListener('abort', () => {
      map.prepareFeatures = async () => {};
      newest = addPreparedFeatures(map, { layers: [{ layer: { id: 'newest', type: 'background' } }] });
    }, { once: true });
  });
  const first = addPreparedFeatures(map, batch()); await Promise.resolve();
  const firstRejected = assert.rejects(first, { name: 'AbortError' });
  await assert.rejects(addPreparedFeatures(map, { layers: [{ layer: { id: 'interrupted', type: 'background' } }] }), { name: 'AbortError' });
  await firstRejected; await newest; assert.equal(map.layers.has('newest'), true); assert.equal(map.layers.has('interrupted'), false);
});

test('rejects canvas lookalikes without reading attacker-controlled canvas members', async () => {
  const map = harness(); let reads = 0;
  const canvas = { get getContext() { reads++; return () => {}; } };
  await assert.rejects(addPreparedFeatures(map, { sources: { x: { type: 'canvas', canvas } } }), { code: 'invalid-descriptor' });
  assert.equal(reads, 0); assert.equal(map.calls.length, 0);
});

test('preserves already-feasible input order across forward anchors and independent default siblings', async () => {
  const map = harness(); await addPreparedFeatures(map, { layers: [
    { layer: { id: 'a', type: 'background' }, before: 'c' },
    { layer: { id: 'b', type: 'background' } },
    { layer: { id: 'c', type: 'background' } }
  ] });
  assert.deepEqual(map.order, ['labels', 'a', 'b', 'c']);
});

test('layer-array admission never uses a Proxy get trap for length or indexed values', async () => {
  const map = harness(); let reads = 0;
  const layers = new Proxy([{ layer: { id: 'a', type: 'background' } }], { get() { reads++; throw Error('get trap'); } });
  await addPreparedFeatures(map, { layers }); assert.equal(reads, 0); assert.deepEqual(map.order, ['labels', 'a']);
});

test('malformed and accessor-backed options cannot leave a current mutation or execute getters', async () => {
  for (const signal of [null, {}, { aborted: false, addEventListener() {}, removeEventListener() {} }]) {
    const map = harness();
    await assert.rejects(addPreparedFeatures(map, batch(), { signal }), { code: 'invalid-options' });
    assert.equal(map._modularMutation, undefined); assert.equal(map.sources.size, 0);
  }
  const map = harness(); let reads = 0;
  const options = { get signal() { reads++; return reads === 1 ? undefined : new AbortController().signal; } };
  await assert.rejects(addPreparedFeatures(map, batch(), options), { code: 'invalid-options' });
  assert.equal(reads, 0); assert.equal(map._modularMutation, undefined);
});

test('real signals use intrinsic registration instead of reentrant overridden listener accessors', async () => {
  const map = harness(), controller = new AbortController(); let reads = 0;
  Object.defineProperty(controller.signal, 'addEventListener', { get() { reads++; addPreparedFeatures(map, {}); throw Error('reentry'); } });
  Object.defineProperty(controller.signal, 'removeEventListener', { get() { reads++; throw Error('cleanup'); } });
  await addPreparedFeatures(map, batch(), { signal: controller.signal });
  assert.equal(reads, 0); assert.equal(map._modularMutation, undefined); assert.equal(map.layers.has('dots'), true);
});

test('an invalid newer options call cancels prior pending work without orphaning its owner', async () => {
  const map = harness(); map.prepareFeatures = () => new Promise(() => {});
  const first = addPreparedFeatures(map, batch()); await Promise.resolve();
  const rejected = assert.rejects(first, { name: 'AbortError' });
  await assert.rejects(addPreparedFeatures(map, {}, { signal: {} }), { code: 'invalid-options' });
  await rejected; assert.equal(map._modularMutation, undefined); assert.equal(map.sources.size, 0);
});

test('already-aborted signals never prepare and reflective options reentry preserves the newest batch', async () => {
  const map = harness(), controller = new AbortController(); controller.abort();
  await assert.rejects(addPreparedFeatures(map, batch(), { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(map.calls.length, 0); assert.equal(map._modularMutation, undefined);
  let latest;
  const options = new Proxy({}, { ownKeys() {
    latest = addPreparedFeatures(map, { layers: [{ layer: { id: 'latest', type: 'background' } }] }); return [];
  } });
  await assert.rejects(addPreparedFeatures(map, batch(), options), { name: 'AbortError' });
  await latest; assert.equal(map.layers.has('latest'), true); assert.equal(map.sources.size, 0);
});

test('reports event-only cleanup failures and remaining native resources as rollback failures', async () => {
  for (const target of ['layer', 'source']) {
    const map = harness(), add = map.addLayer;
    map.addLayer = function(layer, before) { add.call(this, layer, before); throw Error('commit'); };
    if (target === 'layer') map.removeLayer = function() { this.fireError(); return this; };
    else map.removeSource = function() { this.fireError(); return this; };
    await assert.rejects(addPreparedFeatures(map, batch()), { code: 'rollback-failure' });
    assert.equal(target === 'layer' ? map.layers.has('dots') : map.sources.has('points'), true);
    assert.equal(map.listenerCount(), 0); assert.equal(map._modularMutation, undefined);
  }
});

test('source-only batches do not inspect or impose limits on unrelated native layer order', async () => {
  const map = harness(); map.getLayersOrder = () => { throw Error('unrelated order'); };
  await addPreparedFeatures(map, { sources: { points: source() } }); assert.equal(map.sources.has('points'), true);
});

test('the pinned platform accepts a transparent signal wrapper and its actual abort still cancels work', async () => {
  const map = harness(), controller = new AbortController();
  const signal = new Proxy(controller.signal, {});
  const nativeAborted = Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'aborted').get;
  assert.equal(nativeAborted.call(signal), false, 'pinned platform brand accepts this wrapper');
  let started = false; map.prepareFeatures = () => { started = true; return new Promise(() => {}); };
  const work = addPreparedFeatures(map, batch(), { signal });
  await Promise.resolve(); assert.equal(started, true);
  controller.abort(); await assert.rejects(work, { name: 'AbortError' });
  assert.equal(map._modularMutation, undefined); assert.equal(map.sources.size, 0);
});
