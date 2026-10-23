import assert from 'node:assert/strict';
import test from 'node:test';
import { getEventListeners } from 'node:events';
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

test('preserves native resources and stable order across many siblings and forward anchors', async () => {
  const map = harness(), retained = source(), base = { id: 'base', type: 'background' };
  map.addSource('retained', retained); map.addLayer(base); map.calls.length = 0;
  let release;
  map.prepareFeatures = requirements => {
    map.calls.push(['prepare', requirements]);
    return new Promise(resolve => { release = resolve; });
  };
  const input = {
    sources: { points: source() },
    layers: [
      { layer: { id: 'pin', type: 'background' }, before: 'alpha' },
      ...['zeta', 'alpha', 'omega', 'beta', 'gamma', 'delta'].map(id => ({
        layer: id === 'zeta' ? { id, type: 'circle', source: 'points' } : { id, type: 'background' },
        before: 'labels'
      })),
      { layer: { id: 'tail', type: 'background' } }
    ]
  };

  const pending = addPreparedFeatures(map, input);
  await Promise.resolve();
  assert.equal(typeof release, 'function');
  assert.deepEqual(map.getLayersOrder(), ['labels', 'base']);
  assert.equal(map.getSource('points'), undefined);
  assert.equal(map.getSource('retained'), retained);
  release();
  assert.equal(await pending, map);

  assert.deepEqual(map.getLayersOrder(), ['pin', 'zeta', 'alpha', 'omega', 'beta', 'gamma', 'delta', 'labels', 'base', 'tail']);
  assert.equal(map.getLayer('base'), base);
  assert.equal(map.getSource('retained'), retained);
  assert.deepEqual(map.getSource('points'), input.sources.points);
  assert.equal(map.getLayer('zeta').source, 'points');
  assert.equal(map.calls[0][0], 'prepare');
  assert.deepEqual(map.calls.filter(call => call[0] === 'source').map(call => call[1]), ['points']);
  assert.equal(map.listenerCount(), 0);
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
test('releases real caller abort listeners after both success and descriptor rejection', async () => {
  for (const invalid of [false, true]) {
    const map = harness(), signal = new AbortController().signal;
    const baseline = getEventListeners(signal, 'abort').length;
    if (invalid) await assert.rejects(addPreparedFeatures(map, { layers: [{ layer: { type: 'background' } }] }, { signal }), { code: 'invalid-descriptor' });
    else await addPreparedFeatures(map, batch(), { signal });
    assert.equal(getEventListeners(signal, 'abort').length, baseline);
  }
});

test('already-cancelled requests do not inspect caller descriptors or register native map listeners', async () => {
  const map = harness(), controller = new AbortController();
  controller.abort();
  let descriptorReads = 0, offCalls = 0;
  const input = new Proxy({}, { ownKeys() { descriptorReads++; return []; } });
  const off = map.off;
  map.off = (...args) => { offCalls++; return off(...args); };
  await assert.rejects(addPreparedFeatures(map, input, { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(descriptorReads, 0);
  assert.equal(offCalls, 0);
  assert.deepEqual(map.calls, []);
});

test('descriptor rejection never unregisters a native map listener that was not registered', async () => {
  const map = harness();
  const registrations = [], removals = [];
  map.on = (...args) => { registrations.push(args); };
  map.off = (...args) => { removals.push(args); };
  await assert.rejects(addPreparedFeatures(map, { layers: [{ layer: { type: 'background' } }] }), { code: 'invalid-descriptor' });
  assert.deepEqual(registrations, []);
  assert.deepEqual(removals, []);
});

test('preserves nullable leaves and mutable owned data descriptors in the prepared source snapshot', async () => {
  const map = harness(), input = source();
  input.data.extra = { empty: null, absent: undefined, enabled: false, label: 'original' };
  await addPreparedFeatures(map, { sources: { points: input } });
  const copied = map.sources.get('points').data.extra;
  assert.deepEqual(copied, input.data.extra);
  assert.notEqual(copied, input.data.extra);
  assert.equal(Object.hasOwn(copied, 'absent'), true);
  for (const key of ['empty', 'absent', 'enabled', 'label']) {
    const descriptor = Object.getOwnPropertyDescriptor(copied, key);
    assert.equal(descriptor.enumerable, true);
    assert.equal(descriptor.writable, true);
    assert.equal(descriptor.configurable, true);
  }
  copied.label = 'native update';
  assert.equal(delete copied.enabled, true);
  assert.equal(input.data.extra.label, 'original');
  assert.equal(input.data.extra.enabled, false);
});

test('rejects nested symbol members and callable values rather than silently converting them', async () => {
  const symbolRecord = { label: 'visible', [Symbol('unsupported')]: 'hidden' };
  const callable = Object.setPrototypeOf(() => {}, null);
  for (const extra of [symbolRecord, callable]) {
    const map = harness(), input = source(); input.data.extra = extra;
    await assert.rejects(addPreparedFeatures(map, { sources: { points: input } }), { code: 'invalid-descriptor' });
    assert.deepEqual(map.calls, []);
  }
});

test('keeps nested canvas-shaped ordinary data separate from a source canvas capability', async () => {
  const map = harness(), input = source();
  input.data.extra = { type: 'canvas', canvas: { label: 'ordinary nested data' } };
  await addPreparedFeatures(map, { sources: { points: input } });
  const copied = map.sources.get('points').data.extra;
  assert.deepEqual(copied, input.data.extra);
  assert.notEqual(copied.canvas, input.data.extra.canvas);
});

test('rejects an oversized nested array before traversing any of its entries', async () => {
  const map = harness(), input = source();
  let entryInspections = 0;
  const entry = new Proxy({ value: 1 }, { ownKeys(target) { entryInspections++; return Reflect.ownKeys(target); } });
  input.data.extra = Array(100001).fill(entry);
  await assert.rejects(addPreparedFeatures(map, { sources: { points: input } }), { code: 'invalid-descriptor' });
  assert.equal(entryInspections, 0);
  assert.deepEqual(map.calls, []);
});

test('rejects a missing layer id before preparation or native resource lookup', async () => {
  const map = harness(); let queries = 0;
  map.getLayer = () => { queries++; return undefined; };
  map.getSource = () => { queries++; return undefined; };
  await assert.rejects(addPreparedFeatures(map, { layers: [{ layer: { type: 'background' } }] }), { name: 'MapMutationError', code: 'invalid-descriptor' });
  assert.equal(queries, 0);
  assert.deepEqual(map.calls, []);
});

test('rollback queries only declared or preexisting resources and leaves unrelated resources intact', async () => {
  const map = harness(), queried = [];
  const getSource = map.getSource, getLayer = map.getLayer;
  map.sources.set('unrelated-source', source());
  map.layers.set('unrelated-layer', { id: 'unrelated-layer', type: 'background' });
  map.order.push('unrelated-layer');
  map.getSource = id => { queried.push(id); return getSource(id); };
  map.getLayer = id => { queried.push(id); return getLayer(id); };
  map.addLayer = () => { throw new Error('native insertion failed'); };
  await assert.rejects(addPreparedFeatures(map, batch()), { code: 'native-failure' });
  const allowed = new Set(['points', 'dots', 'labels', 'unrelated-layer']);
  assert.equal(queried.every(id => allowed.has(id)), true);
  assert.equal(map.sources.has('unrelated-source'), true);
  assert.equal(map.layers.has('unrelated-layer'), true);
  assert.equal(map.sources.has('points'), false);
});

test('cancellation at native validation boundaries prevents subsequent native inspection', async () => {
  for (const boundary of ['snapshot', 'initialize', 'source', 'layer', 'dependency', 'anchor', 'order']) {
    const map = harness(), controller = new AbortController();
    let input = { sources: { first: source(), second: source() }, layers: [
      { layer: { id: 'first-layer', type: 'circle', source: 'existing' }, before: 'labels' },
      { layer: { id: 'second-layer', type: 'background' } }
    ] };
    map.sources.set('existing', source());
    let cancelled = false;
    const subsequent = [];
    const cancel = () => { cancelled = true; controller.abort(); };
    const observe = label => { if (cancelled) subsequent.push(label); };
    map._lazyInitEmptyStyle = () => { observe('initialize'); if (boundary === 'initialize') cancel(); };
    const getSource = map.getSource, getLayer = map.getLayer, getOrder = map.getLayersOrder;
    map.getSource = function(key) {
      observe(`source:${key}`);
      if ((boundary === 'source' && key === 'first') || (boundary === 'dependency' && key === 'existing')) cancel();
      return getSource.call(this, key);
    };
    map.getLayer = function(key) {
      observe(`layer:${key}`);
      if ((boundary === 'layer' && key === 'first-layer') || (boundary === 'anchor' && key === 'labels')) cancel();
      return getLayer.call(this, key);
    };
    map.getLayersOrder = function() {
      observe('order');
      const result = getOrder.call(this);
      if (boundary !== 'order') return result;
      cancel();
      return new Proxy(result, { get(target, key, receiver) { observe(`order:${String(key)}`); return Reflect.get(target, key, receiver); } });
    };
    if (boundary === 'snapshot') input = new Proxy(input, { ownKeys(target) { cancel(); return Reflect.ownKeys(target); } });
    await assert.rejects(addPreparedFeatures(map, input, { signal: controller.signal }), { name: 'AbortError' });
    assert.deepEqual(subsequent, [], boundary);
    assert.equal(map.calls.length, 0, boundary);
    assert.deepEqual(map.order, ['labels'], boundary);
  }
});

test('stable layer order prioritizes a newly available earlier descriptor over waiting siblings', async () => {
  const map = harness();
  await addPreparedFeatures(map, { layers: [
    { layer: { id: 'a', type: 'background' }, before: 'labels' },
    { layer: { id: 'b', type: 'background' }, before: 'a' },
    { layer: { id: 'c', type: 'background' }, before: 'labels' },
    { layer: { id: 'd', type: 'background' }, before: 'labels' }
  ] });
  assert.deepEqual(map.order, ['b', 'a', 'c', 'd', 'labels']);
});

test('unanchored layers stay above all existing layers despite later descriptors targeting an early anchor', async () => {
  const map = harness();
  map.addLayer({ id: 'existing-top', type: 'background' });
  await addPreparedFeatures(map, { layers: [
    { layer: { id: 'unanchored', type: 'background' } },
    { layer: { id: 'early', type: 'background' }, before: 'labels' }
  ] });
  assert.deepEqual(map.order, ['early', 'labels', 'existing-top', 'unanchored']);
});

test('reentrant successor cancellation stops abandoned options admission', async () => {
  const map = harness(); let preparationSignal, newest;
  map.prepareFeatures = (_requirements, { signal }) => { preparationSignal = signal; return new Promise(() => {}); };
  const first = addPreparedFeatures(map, batch());
  const firstCancelled = assert.rejects(first, { name: 'AbortError' });
  await Promise.resolve();
  preparationSignal.addEventListener('abort', () => {
    map.prepareFeatures = async () => {};
    newest = addPreparedFeatures(map, {});
  }, { once: true });
  let inspections = 0;
  const abandoned = new Proxy({}, { ownKeys() { inspections++; return []; } });
  await assert.rejects(addPreparedFeatures(map, {}, abandoned), { name: 'AbortError' });
  await firstCancelled; await newest;
  assert.equal(inspections, 0);
});

test('rejects an array length descriptor with coercible data without invoking caller coercion', async () => {
  const map = harness(); let coercions = 0;
  const length = { valueOf() { coercions++; throw Error('caller coercion'); } };
  const layers = new Proxy([], { getOwnPropertyDescriptor(target, key) {
    const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
    return key === 'length' ? { ...descriptor, value: length } : descriptor;
  } });
  await assert.rejects(addPreparedFeatures(map, { layers }), { name: 'MapMutationError', code: 'invalid-descriptor' });
  assert.equal(coercions, 0);
  assert.deepEqual(map.calls, []);
});

test('releases external and preparation abort listeners after success and preparation failure', async () => {
  for (const fails of [false, true]) {
    const map = harness(), caller = new AbortController();
    let preparationSignal;
    map.prepareFeatures = async (_requirements, { signal }) => {
      preparationSignal = signal;
      assert.equal(getEventListeners(caller.signal, 'abort').length, 1);
      assert.equal(getEventListeners(signal, 'abort').length, 1);
      if (fails) throw Error('preparation failed');
    };
    const work = addPreparedFeatures(map, batch(), { signal: caller.signal });
    if (fails) await assert.rejects(work, /preparation failed/); else await work;
    assert.equal(getEventListeners(caller.signal, 'abort').length, 0);
    assert.equal(getEventListeners(preparationSignal, 'abort').length, 0);
    caller.abort();
    assert.equal(preparationSignal.aborted, false, 'finished work is no longer connected to caller cancellation');
  }
});

test('asynchronous cancellation retains its public error message', async () => {
  const map = harness(), caller = new AbortController();
  map.prepareFeatures = () => new Promise(() => {});
  const work = addPreparedFeatures(map, batch(), { signal: caller.signal });
  await Promise.resolve();
  caller.abort();
  await assert.rejects(work, { name: 'AbortError', message: 'Prepared map mutation cancelled.' });
});

test('a preparation that replaces the style never invokes validation on the new style', async () => {
  const map = harness(), read = map.getSource;
  let replacement = false, staleReads = 0;
  map.prepareFeatures = async () => { map.style = {}; replacement = true; };
  map.getSource = id => { if (replacement) staleReads++; return read.call(map, id); };
  await assert.rejects(addPreparedFeatures(map, batch()), { name: 'AbortError' });
  assert.equal(staleReads, 0);
  assert.equal(map.sources.size, 0);
});

test('native listener registration that replaces a style cannot start a source or layer commit', async () => {
  for (const input of [{ sources: { points: source() } }, { layers: [{ layer: { id: 'plain', type: 'background' } }] }]) {
    const map = harness(), on = map.on;
    map.on = function(type, listener) { on.call(this, type, listener); this.style = {}; };
    await assert.rejects(addPreparedFeatures(map, input), { name: 'AbortError' });
    assert.equal(map.calls.some(([kind]) => kind === 'source' || kind === 'layer'), false);
    assert.equal(map.listenerCount(), 0);
  }
});

test('style replacement during native addition prevents subsequent resource reads', async () => {
  for (const kind of ['Source', 'Layer']) {
    const map = harness(), add = map[`add${kind}`], read = map[`get${kind}`];
    let replacement = false, staleReads = 0;
    map[`add${kind}`] = function(...args) { add.apply(this, args); this.style = {}; replacement = true; return this; };
    map[`get${kind}`] = function(id) { if (replacement) staleReads++; return read.call(this, id); };
    await assert.rejects(addPreparedFeatures(map, batch()), { name: 'AbortError' });
    assert.equal(staleReads, 0);
    assert.equal(map.listenerCount(), 0);
  }
});

test('style replacement during the final native presence check rejects rather than publishing success', async () => {
  for (const kind of ['Source', 'Layer']) {
    const map = harness(), read = map[`get${kind}`];
    map[`get${kind}`] = function(id) { const value = read.call(this, id); if (value && id !== 'labels') this.style = {}; return value; };
    const input = kind === 'Source' ? { sources: { points: source() } } : { layers: [{ layer: { id: 'plain', type: 'background' } }] };
    await assert.rejects(addPreparedFeatures(map, input), { name: 'AbortError' });
    assert.equal(map.listenerCount(), 0);
  }
});

test('cleanup skips native resources that failed before they were registered', async () => {
  const map = harness();
  map.addSource = () => { throw Error('not registered'); };
  await assert.rejects(addPreparedFeatures(map, { sources: { points: source() } }), { code: 'native-failure' });
  assert.equal(map.calls.some(([kind]) => kind === 'source-'), false);
});

test('rollback reports silently retained resources independently of emitted errors', async () => {
  for (const kind of ['Source', 'Layer']) {
    const map = harness(), add = map.addLayer;
    map.addLayer = function(...args) { add.apply(this, args); throw Error('commit failed'); };
    map[`remove${kind}`] = function() { return this; };
    await assert.rejects(addPreparedFeatures(map, batch()), { code: 'rollback-failure' });
    assert.equal(kind === 'Source' ? map.sources.has('points') : map.layers.has('dots'), true);
    assert.equal(map.listenerCount(), 0);
  }
});

test('rollback reports an emitted error even when the native resource was removed', async () => {
  const map = harness(), add = map.addLayer, remove = map.removeSource;
  map.addLayer = function(...args) { add.apply(this, args); throw Error('commit failed'); };
  map.removeSource = function(id) { remove.call(this, id); this.fireError(); return this; };
  await assert.rejects(addPreparedFeatures(map, batch()), { code: 'rollback-failure' });
  assert.equal(map.sources.size, 0);
  assert.equal(map.layers.has('dots'), false);
  assert.equal(map.listenerCount(), 0);
});

test('rollback stops before touching a replacement style reached by a presence read or removal', async () => {
  for (const point of ['read', 'remove']) {
    const map = harness(), add = map.addLayer, read = map.getLayer, remove = map.removeLayer;
    let rollback = false, replaced = false, readsAfterReplacement = 0, removesAfterReplacement = 0;
    map.addLayer = function(...args) { add.apply(this, args); rollback = true; throw Error('commit failed'); };
    map.getLayer = function(id) {
      if (replaced) readsAfterReplacement++;
      const value = read.call(this, id);
      if (rollback && point === 'read' && id === 'dots') { this.style = {}; replaced = true; }
      return value;
    };
    map.removeLayer = function(id) {
      if (replaced) removesAfterReplacement++;
      remove.call(this, id);
      if (point === 'remove') { this.style = {}; replaced = true; }
      return this;
    };
    await assert.rejects(addPreparedFeatures(map, batch()), { name: 'AbortError' });
    assert.equal(readsAfterReplacement, 0);
    assert.equal(removesAfterReplacement, 0);
    assert.equal(map.sources.has('points'), true, 'old work does not remove sources after replacement');
  }
});

test('rollback releases layer and source acquisitions in reverse order', async () => {
  const map = harness(), add = map.addLayer;
  map.addLayer = function(layer, before) { add.call(this, layer, before); if (layer.id === 'first') throw Error('commit failed'); return this; };
  await assert.rejects(addPreparedFeatures(map, {
    sources: { one: source(), two: source() },
    layers: [{ layer: { id: 'first', type: 'circle', source: 'one' } }, { layer: { id: 'second', type: 'circle', source: 'two' } }],
  }), { code: 'native-failure' });
  assert.deepEqual(map.calls.filter(([kind]) => kind.endsWith('-')), [['layer-', 'first'], ['layer-', 'second'], ['source-', 'two'], ['source-', 'one']]);
  assert.deepEqual(map.order, ['labels']);
  assert.equal(map.sources.size, 0);
});

test('retirement during commit skips even reading rollback capabilities on the replacement style', async () => {
  const map = harness(), add = map.addLayer, remove = map.removeLayer;
  let capabilityReads = 0;
  Object.defineProperty(map, 'removeLayer', { get() { capabilityReads++; return remove; } });
  map.addLayer = function(...args) { add.apply(this, args); this.style = {}; throw Error('retired commit'); };
  await assert.rejects(addPreparedFeatures(map, batch()), { name: 'AbortError' });
  assert.equal(capabilityReads, 0);
});

test('rollback capability resolution that retires the style prevents calling its presence probe', async () => {
  const map = harness(), add = map.addLayer, remove = map.removeLayer, read = map.getLayer;
  let retired = false, staleReads = 0;
  map.addLayer = function(...args) { add.apply(this, args); throw Error('commit failed'); };
  Object.defineProperty(map, 'removeLayer', { get() { this.style = {}; retired = true; return remove; } });
  map.getLayer = function(id) { if (retired) staleReads++; return read.call(this, id); };
  await assert.rejects(addPreparedFeatures(map, batch()), { name: 'AbortError' });
  assert.equal(staleReads, 0);
});

test('retirement at the end of layer rollback prevents reading source cleanup capabilities', async () => {
  for (const point of ['confirmation', 'throw']) {
    const map = harness(), add = map.addLayer, remove = map.removeLayer, read = map.getLayer, removeSource = map.removeSource;
    let removed = false, sourceCapabilityReads = 0;
    map.addLayer = function(...args) { add.apply(this, args); throw Error('commit failed'); };
    map.removeLayer = function(id) {
      remove.call(this, id); removed = true;
      if (point === 'throw') { this.style = {}; throw Error('retired removal'); }
      return this;
    };
    map.getLayer = function(id) { if (removed && point === 'confirmation') this.style = {}; return read.call(this, id); };
    Object.defineProperty(map, 'removeSource', { get() { sourceCapabilityReads++; return removeSource; } });
    await assert.rejects(addPreparedFeatures(map, batch()), { name: 'AbortError' });
    assert.equal(sourceCapabilityReads, 0);
    assert.equal(map.sources.has('points'), true);
  }
});
