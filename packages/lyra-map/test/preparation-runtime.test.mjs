import assert from 'node:assert/strict';
import test from 'node:test';
import { join } from 'node:path';
import { getEventListeners } from 'node:events';
import { derefLayers } from '@maplibre/maplibre-gl-style-spec';
import { createPreparationRuntime } from '../scripts/preparation-runtime.mjs';
import { snapshotFeatureRequirements } from '../scripts/feature-requirements.mjs';
import { src, virtual } from '../scripts/complete-transform.mjs';

function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function harness(generated, settings = {}) {
  const trace = [], sent = deferred(), actorsRead = deferred(), importing = deferred();
  const dependencies = { derefLayers, MessageType: { prepareFeatures: 'prepareFeatures' }, snapshotFeatureRequirements,
    validateStyleAndEmit(_style, input) { trace.push(['validate', input.version]); return Boolean(settings.invalid); } };
  for (const name of ['prepareStyleLayers', 'prepareSources', 'prepareDraws', 'prepareShaders', 'prepareUniforms',
    'prepareProjection', 'prepareSymbols', 'prepareTerrain']) dependencies[name] = async value => {
    trace.push([name, value]);
    if (name === 'prepareSources') {
      importing.resolve();
      await settings.importing;
      if (Object.hasOwn(settings, 'failure')) throw settings.failure;
      if (settings.failImport) throw new Error('Import refused');
    }
  };
  let operations;
  if (generated) {
    const injected = { ...dependencies }; delete injected.snapshotFeatureRequirements;
    const code = virtual.get(join(src, 'modular', 'prepare.ts'))
      .replace(/import\s*\{[^}]*\}\s*from\s*(?:'[^']*'|"[^"]*");/gu, '').replace(/\bexport\s+/gu, '');
    operations = new Function(...Object.keys(injected), `${code}\nreturn {snapshotStyle,prepareReplacement,prepareMapFeatures,beginPreparation,prepareTransaction,prepareStyle};`)(...Object.values(injected));
  } else operations = createPreparationRuntime(dependencies);
  const style = { _modularReady: settings.ready ?? Promise.resolve(), serialize() { return { old: true }; },
    dispatcher: { get actorsPromise() { actorsRead.resolve(); return settings.actors ?? Promise.resolve([{ async sendAsync(message) {
      trace.push(['worker', message]); sent.resolve(); await settings.worker;
    } }]); } } };
  const map = { style, _lazyInitEmptyStyle() {} };
  return { operations, trace, sent, actorsRead, importing, map, style };
}
const input = () => ({ sources: { source: { type: 'geojson', data: { coordinates: [1, 2] } } },
  layers: [{ id: 'points', type: 'circle' }], projection: { type: 'mercator' } });
async function both(run) {
  const direct = await run(false), generated = await run(true);
  assert.deepEqual(generated, direct, 'authored factory and generated entry agree');
  return direct;
}

test('direct and generated preparation retain metadata plans, worker messages and cleanup', async () => {
  const trace = await both(async generated => {
    const h = harness(generated); await h.operations.prepareMapFeatures(h.map, input());
    assert.equal(h.style._modularFeaturePreparations.size, 0); return h.trace;
  });
  assert.equal(trace.filter(([name]) => name === 'worker').length, 1);
  assert.deepEqual(trace.find(([name]) => name === 'worker')[1].data, { layers: [{ type: 'circle' }], sources: ['geojson'] });
});

test('abort before start or during style/actor readiness cleans listeners and controller ownership', async () => {
  for (const stage of ['before', 'style', 'actors']) await both(async generated => {
    const held = deferred(), controller = new AbortController();
    const h = harness(generated, stage === 'style' ? { ready: held.promise } : stage === 'actors' ? { actors: held.promise } : {});
    if (stage === 'before') controller.abort();
    const pending = h.operations.prepareMapFeatures(h.map, input(), { signal: controller.signal });
    if (stage === 'actors') await h.actorsRead.promise;
    if (stage !== 'before') controller.abort();
    await assert.rejects(pending, { name: 'AbortError' });
    held.resolve([]);
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
    assert.equal(h.style._modularFeaturePreparations?.size ?? 0, 0);
    return { workers: h.trace.filter(([name]) => name === 'worker').length };
  });
});

test('worker cancellation and style replacement cannot resolve as current preparation', async () => {
  for (const cause of ['abort', 'replacement', 'remove']) await both(async generated => {
    const worker = deferred(), controller = new AbortController(), h = harness(generated, { worker: worker.promise });
    const pending = h.operations.prepareMapFeatures(h.map, input(), { signal: controller.signal });
    await h.sent.promise;
    if (cause === 'abort') controller.abort();
    else if (cause === 'replacement') h.map.style = {};
    else h.map._removed = true;
    worker.resolve(); await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
    assert.equal(h.style._modularFeaturePreparations.size, 0);
    return h.trace;
  });
});

test('replacement retains full snapshot isolation, transform receiver inputs and validation refusal', async () => {
  await both(async generated => {
    const h = harness(generated), original = { version: 8, ...input() };
    const pending = h.operations.prepareReplacement(h.style, original, { transformStyle(previous, incoming) {
      assert.deepEqual(previous, { old: true }); assert.equal(incoming, original); return incoming;
    } }, new AbortController());
    original.sources.source.data.coordinates[0] = 99;
    const replacement = await pending; assert.equal(replacement.sources.source.data.coordinates[0], 1);
    const rejected = harness(generated, { invalid: true });
    assert.equal(await rejected.operations.prepareReplacement(rejected.style, { version: 8, ...input() }, {}, new AbortController()), undefined);
    assert.deepEqual(rejected.trace, [['validate', 8]]);
    return { replacement, trace: h.trace };
  });
});

test('beginPreparation cancels previous owner and import errors retain preparation failure marking', async () => {
  await both(async generated => {
    const h = harness(generated, { failImport: true });
    const first = h.operations.beginPreparation(h.style), second = h.operations.beginPreparation(h.style);
    assert.equal(first.signal.aborted, true); assert.equal(second.signal.aborted, false);
    await assert.rejects(h.operations.prepareMapFeatures(h.map, input()), error => {
      assert.equal(error.message, 'Import refused'); assert.equal(error.modularPreparationFailure, true); return true;
    });
    assert.equal(h.style._modularFeaturePreparations.size, 0);
    return h.trace;
  });
});

test('family selection preserves defaults, deduplication, opacity, symbols, terrain and projections', async () => {
  for (const [state, expected] of [
    [{}, { types: [], programs: ['debug', 'sky'], projection: 'mercator' }],
    [{ sources: null, layers: null, projection: { type: null } }, { types: [], programs: ['debug', 'sky'], projection: 'mercator' }],
    [{ layers: [{ id: 'one', type: 'line' }, { id: 'two', type: 'line' }] },
      { types: ['line'], programs: ['line', 'debug', 'sky', 'layer-opacity'], projection: 'mercator' }],
    [{ layers: [{ id: 'one', type: 'fill' }, { id: 'two', type: 'symbol' }], projection: { type: 'globe' }, terrain: {} },
      { types: ['fill', 'symbol'], programs: ['fill', 'symbol', 'debug', 'sky', 'layer-opacity', 'globe', 'terrain'], projection: 'globe' }],
    [{ projection: { type: 'vertical-perspective' } },
      { types: [], programs: ['debug', 'sky', 'globe'], projection: 'vertical-perspective' }],
  ]) await both(async generated => {
    const h = harness(generated);
    await h.operations.prepareStyle(state);
    for (const name of ['prepareShaders', 'prepareUniforms']) assert.deepEqual(h.trace.find(([key]) => key === name)[1], expected.programs);
    assert.deepEqual(h.trace.find(([key]) => key === 'prepareDraws')[1], expected.types);
    assert.equal(h.trace.find(([key]) => key === 'prepareProjection')[1], expected.projection);
    assert.equal(h.trace.some(([key]) => key === 'prepareSymbols'), expected.types.includes('symbol'));
    assert.equal(h.trace.some(([key]) => key === 'prepareTerrain'), Boolean(state.terrain));
    return h.trace;
  });
});

test('full snapshots copy plain and null-prototype records while preserving opaque identities', async () => {
  await both(async generated => {
    const h = harness(generated);
    class Custom { constructor() { this.value = { nested: true }; } }
    const custom = new Custom(), date = new Date(0), callback = () => undefined;
    const data = Object.assign(Object.create(null), { list: [null, false, 0, 'value', { nested: true }] });
    Object.defineProperty(data, '__proto__', { value: { safe: true }, enumerable: true });
    const state = h.operations.snapshotStyle({ data, custom, date, callback });
    assert.notEqual(state.data, data); assert.notEqual(state.data.list, data.list);
    assert.notEqual(state.data.list[4], data.list[4]);
    assert.equal(state.custom, custom); assert.equal(state.date, date); assert.equal(state.callback, callback);
    assert.equal(Object.getPrototypeOf(state.data), Object.prototype);
    assert.equal(Object.hasOwn(state.data, '__proto__'), true);
    assert.deepEqual(state.data.__proto__, { safe: true });
    assert.equal(Object.prototype.safe, undefined);
    return state.data;
  });
});

test('replacement without transform skips serialization and explicit validation false skips validator', async () => {
  await both(async generated => {
    const h = harness(generated, { invalid: true });
    h.style.serialize = () => { throw new Error('Unexpected serialization'); };
    const state = await h.operations.prepareReplacement(h.style, { version: 8, ...input() }, { validate: false }, new AbortController());
    assert.equal(state.version, 8);
    assert.equal(h.trace.some(([name]) => name === 'validate'), false);
    return h.trace;
  });
});

test('import cancellation clears caller and internal listeners before imports settle', async () => {
  await both(async generated => {
    const held = deferred(), caller = new AbortController(), h = harness(generated, { importing: held.promise });
    const pending = h.operations.prepareMapFeatures(h.map, input(), { signal: caller.signal });
    await h.importing.promise;
    const [internal] = h.style._modularFeaturePreparations;
    caller.abort();
    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(internal.signal.aborted, true);
    assert.equal(getEventListeners(internal.signal, 'abort').length, 0);
    assert.equal(getEventListeners(caller.signal, 'abort').length, 0);
    assert.equal(h.style._modularFeaturePreparations.size, 0);
    held.resolve();
    return h.trace;
  });
});

test('signal abortion during listener registration is observed before readiness', async () => {
  await both(async generated => {
    const caller = new AbortController(), h = harness(generated);
    let removals = 0;
    const signal = {
      throwIfAborted() { caller.signal.throwIfAborted(); },
      addEventListener(type, listener, options) { caller.abort(); caller.signal.addEventListener(type, listener, options); },
      removeEventListener(type, listener) { removals++; caller.signal.removeEventListener(type, listener); },
      get aborted() { return caller.signal.aborted; }
    };
    await assert.rejects(h.operations.prepareMapFeatures(h.map, input(), { signal }), { name: 'AbortError' });
    assert.equal(removals, 1);
    assert.equal(h.style._modularFeaturePreparations.size, 0);
    assert.equal(getEventListeners(caller.signal, 'abort').length, 0);
    return h.trace;
  });
});

test('transactions preserve thrown values and mark only non-abort Error instances', async () => {
  for (const makeFailure of [() => new Error('failed'), () => new DOMException('cancelled', 'AbortError'),
    () => ({ name: 'Error', message: 'plain' }), () => 'failed', () => null, () => undefined]) {
    await both(async generated => {
      const failure = makeFailure(), h = harness(generated, { failure });
      const caller = new AbortController();
      let rejected = false;
      try { await h.operations.prepareMapFeatures(h.map, input(), { signal: caller.signal }); }
      catch (error) { rejected = true; assert.equal(error, failure); }
      assert.equal(rejected, true);
      assert.equal(failure?.modularPreparationFailure, failure instanceof Error && failure.name !== 'AbortError' ? true : undefined);
      assert.equal(h.style._modularFeaturePreparations.size, 0);
      assert.equal(getEventListeners(caller.signal, 'abort').length, 0);
      assert.equal(h.trace.some(([name]) => name === 'worker'), false);
      return h.trace;
    });
  }
});
