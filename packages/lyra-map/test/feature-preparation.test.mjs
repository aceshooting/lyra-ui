import assert from 'node:assert/strict';
import { join } from 'node:path';
import test from 'node:test';
import { derefLayers } from '@maplibre/maplibre-gl-style-spec';
import { src, virtual } from '../scripts/complete-transform.mjs';

/** Executes the actual generated preparation entry with only engine dependencies stubbed. */
function runtime(ready = Promise.resolve()) {
  const code = virtual.get(join(src, 'modular', 'prepare.ts'));
  assert.equal(typeof code, 'string');
  const dependencies = { derefLayers, MessageType: { prepareFeatures: 'prepareFeatures' } };
  const calls = [], messages = [];
  for (const name of ['prepareStyleLayers', 'prepareSources', 'prepareDraws', 'prepareShaders',
    'prepareUniforms', 'prepareProjection', 'prepareSymbols', 'prepareTerrain']) {
    dependencies[name] = async value => { calls.push([name, value]); };
  }
  dependencies.validateStyleAndEmit = () => false;
  const body = code.replace(/import\s*\{[^}]*\}\s*from\s*(?:'[^']*'|"[^"]*");/gu, '')
    .replace(/\bexport\s+/gu, '');
  const entry = new Function(...Object.keys(dependencies), `${body}\nreturn {prepareMapFeatures,prepareReplacement};`)(...Object.values(dependencies));
  const style = { _modularReady: ready, dispatcher: { actorsPromise: Promise.resolve([
    { async sendAsync(message) { messages.push(message); } }
  ]) } };
  const map = { style, _lazyInitEmptyStyle() {} };
  return { ...entry, map, style, calls, messages };
}

test('feature preflight does not traverse GeoJSON coordinates or properties at any payload size', async () => {
  const counts = [];
  for (const size of [1000, 10000, 100000]) {
    let visits = 0;
    const data = new Proxy({ type: 'FeatureCollection', features: new Array(size).fill(null) }, {
      ownKeys(target) { visits++; return Reflect.ownKeys(target); },
      getOwnPropertyDescriptor(target, name) { visits++; return Reflect.getOwnPropertyDescriptor(target, name); },
      get(target, name, receiver) { visits++; return Reflect.get(target, name, receiver); },
      getPrototypeOf(target) { visits++; return Reflect.getPrototypeOf(target); }
    });
    const subject = runtime();
    await subject.prepareMapFeatures(subject.map, {
      sources: { points: { type: 'geojson', data } },
      layers: [{ id: 'dots', type: 'circle', source: 'points' }]
    });
    counts.push(visits);
    assert.deepEqual(subject.messages, [{ type: 'prepareFeatures', data: { layers: [{ type: 'circle' }], sources: ['geojson'] } }]);
    assert.equal(subject.style._modularFeaturePreparations.size, 0);
  }
  assert.deepEqual(counts, [0, 0, 0]);
});

test('discarded source and custom-layer payload accessors are not evaluated', async () => {
  let reads = 0;
  const source = { type: 'geojson', get data() { reads++; throw new Error('payload read'); } };
  const custom = { id: 'custom', type: 'custom', get render() { reads++; throw new Error('callback read'); } };
  const subject = runtime();
  await subject.prepareMapFeatures(subject.map, { sources: { points: source }, layers: [custom] });
  assert.equal(reads, 0);
});

test('metadata is isolated across ready awaits, including forward refs and terrain/projection', async () => {
  let release;
  const subject = runtime(new Promise(resolve => { release = resolve; }));
  const requirements = { sources: { pixels: { type: 'canvas' } },
    layers: [{ id: 'ref', ref: 'parent' }, { id: 'parent', type: 'symbol' }],
    projection: { type: 'globe' }, terrain: { source: 'dem' } };
  const pending = subject.prepareMapFeatures(subject.map, requirements);
  requirements.sources.pixels.type = 'geojson'; requirements.layers[1].type = 'line';
  requirements.layers[0].ref = 'missing'; requirements.projection.type = 'mercator'; requirements.terrain = null;
  release(); await pending;
  assert.deepEqual(subject.messages[0].data, { layers: [{ type: 'symbol' }, { type: 'symbol' }], sources: ['canvas'] });
  assert.ok(subject.calls.some(([name, value]) => name === 'prepareProjection' && value === 'globe'));
  assert.ok(subject.calls.some(([name]) => name === 'prepareTerrain'));
});

test('selected metadata accessors reject without executing their getter or importing', async () => {
  let reads = 0;
  const subject = runtime();
  await assert.rejects(subject.prepareMapFeatures(subject.map, { sources: {
    points: { get type() { reads++; return 'geojson'; } }
  } }), TypeError);
  assert.equal(reads, 0); assert.deepEqual(subject.calls, []); assert.deepEqual(subject.messages, []);
});

test('feature projection preserves snapshot semantics for ordinary and retained-prototype records', async () => {
  class Source { }
  Object.defineProperty(Source.prototype, 'type', { value: 'geojson' });
  class Layer { }
  Object.defineProperties(Layer.prototype, { id: { value: 'inherited' }, type: { value: 'circle' } });
  const subject = runtime();
  await subject.prepareMapFeatures(subject.map, { sources: { source: new Source() }, layers: [new Layer()] });
  assert.deepEqual(subject.messages[0].data, { layers: [{ type: 'circle' }], sources: ['geojson'] });
  const hidden = {};
  Object.defineProperty(hidden, 'sources', { value: { hidden: { type: 'raster' } } });
  const empty = runtime(); await empty.prepareMapFeatures(empty.map, hidden);
  assert.deepEqual(empty.messages[0].data, { layers: [], sources: [] });
});

test('ordinary non-enumerable metadata stays omitted while null-prototype data records remain supported', async () => {
  const source = Object.create(null);
  Object.defineProperty(source, 'type', { value: 'geojson', enumerable: false });
  const layer = { id: 'dots' };
  Object.defineProperty(layer, 'type', { value: 'circle', enumerable: false });
  const subject = runtime();
  await subject.prepareMapFeatures(subject.map, { sources: { points: source }, layers: [layer] });
  assert.deepEqual(subject.messages[0].data, { layers: [{ type: undefined }], sources: [undefined] });
  // The family registry owns unknown-family refusal; this harness records the exact metadata it receives.
});

test('null sources and layers keep their existing later refusal, rather than becoming empty defaults', async () => {
  for (const requirements of [{ sources: null }, { layers: null }]) {
    const subject = runtime();
    await assert.rejects(subject.prepareMapFeatures(subject.map, requirements), TypeError);
    assert.equal(subject.style._modularFeaturePreparations.size, 0);
  }
});

test('cyclic metadata prototype chains reject before imports or payload getters run', async () => {
  let prototypeReads = 0, payloadReads = 0;
  let source;
  source = new Proxy({ get data() { payloadReads++; throw new Error('payload read'); } }, {
    getPrototypeOf() { prototypeReads++; return source; }
  });
  const subject = runtime();
  await assert.rejects(subject.prepareMapFeatures(subject.map, { sources: { points: source } }), TypeError);
  assert.ok(prototypeReads <= 4, 'cyclic metadata traversal has a finite bound');
  assert.equal(payloadReads, 0); assert.deepEqual(subject.calls, []); assert.deepEqual(subject.messages, []);
});

test('fresh fabricated prototype chains reject at the metadata depth bound', async () => {
  let prototypeReads = 0, metadataReads = 0, payloadReads = 0;
  const chain = () => new Proxy({}, {
    getPrototypeOf() { prototypeReads++; return chain(); },
    getOwnPropertyDescriptor(_target, key) { if (key === 'type') metadataReads++; return undefined; },
    get() { payloadReads++; throw new Error('property getter read'); }
  });
  const subject = runtime();
  await assert.rejects(subject.prepareMapFeatures(subject.map, { sources: { points: chain() } }), TypeError);
  assert.equal(metadataReads, 64, 'at most 64 objects are inspected for one metadata field');
  assert.ok(prototypeReads <= 66, 'plain-record classification adds at most two prototype reads');
  assert.equal(payloadReads, 0); assert.deepEqual(subject.calls, []); assert.deepEqual(subject.messages, []);
});

test('full replacement still snapshots GeoJSON payloads before preparation waits', async () => {
  const subject = runtime();
  const input = { version: 8, sources: { points: { type: 'geojson', data: {
    type: 'Feature', properties: { value: 1 }, geometry: { type: 'Point', coordinates: [1, 2] }
  } } }, layers: [] };
  const pending = subject.prepareReplacement(subject.style, input, {}, new AbortController());
  input.sources.points.data.geometry.coordinates[0] = 99; input.sources.points.data.properties.value = 99;
  const result = await pending;
  assert.equal(result.sources.points.data.geometry.coordinates[0], 1);
  assert.equal(result.sources.points.data.properties.value, 1);
});
