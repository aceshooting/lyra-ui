import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { transformWorker } from '../scripts/worker-transform.mjs';

const require = createRequire(import.meta.url);
const upstream = dirname(require.resolve('maplibre-gl/package.json'));
const paths = [
  'source/worker.ts',
  'util/actor_messages.ts',
  'render/subdivision.ts',
  'render/subdivision_granularity_settings.ts'
];
const sources = new Map(
  await Promise.all(paths.map(async (path) => [path, await readFile(join(upstream, 'src', path), 'utf8')]))
);
const transformed = new Map(paths.map((path) => [path, transformWorker(sources.get(path), path)]));
const javascript = (source) => stripTypeScriptTypes(source, { mode: 'transform' });

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function workerHarness(prepareStyleLayers) {
  const names = [
    'importScript',
    'setReferrer',
    'syncRTLPluginState',
    'setLayers',
    'updateLayers',
    'removeMap',
    'loadDEMTile',
    'removeDEMTile',
    'loadTile',
    'reloadTile',
    'abortTile',
    'removeTile',
    'loadData',
    'getClusterExpansionZoom',
    'getClusterChildren',
    'getClusterLeaves'
  ];
  const messageTypes = Object.fromEntries(names.map((name) => [name, name]));
  // Execute the transformed admission code with an in-memory Actor; no worker or network is started.
  const source = javascript(transformed.get('source/worker.ts'))
    .replace(/^import[\s\S]*?;\n/gm, '')
    .replace('export default class Worker', 'class Worker');
  const Worker = new Function('prepareStyleLayers', 'MessageType', 'isWorker', 'self', `${source}\nreturn Worker;`)(
    prepareStyleLayers,
    messageTypes,
    () => false,
    {}
  );
  const handlers = new Map();
  const worker = Object.assign(Object.create(Worker.prototype), {
    featureAdmissions: new Map(),
    actor: {
      registerMessageHandler(type, handler) {
        handlers.set(type, handler);
      }
    }
  });
  return {
    register(type, handler) {
      worker._registerFeatureHandler(type, handler);
    },
    send(type, params, controller = new AbortController()) {
      return handlers.get(type)('map', params, controller);
    }
  };
}

test('transforms and parses all four files from the pinned source', async () => {
  const manifest = JSON.parse(await readFile(join(upstream, 'package.json'), 'utf8'));
  assert.equal(manifest.version, '6.14.0');
  for (const path of paths) {
    assert.notEqual(transformed.get(path), sources.get(path), path);
    assert.doesNotThrow(() => javascript(transformed.get(path)), path);
  }
  assert.equal(transformWorker('unchanged', 'unrelated.ts'), undefined);
});

test('rejects missing and duplicated source anchors', () => {
  for (const path of paths) {
    assert.throws(() => transformWorker('', path), /match count/);
    assert.throws(() => transformWorker(sources.get(path) + sources.get(path), path), /match count/);
  }
});

test('registers subdivision constructors once in their defining module', () => {
  const registrations = new Map();
  const register = (name, constructor) => {
    assert.equal(registrations.has(name), false);
    registrations.set(name, constructor);
  };
  const source = javascript(transformed.get('render/subdivision_granularity_settings.ts'))
    .replace(/^import[\s\S]*?;\n/gm, '')
    .replaceAll('export class ', 'class ');
  const constructors = new Function(
    'register',
    `${source}\nreturn {SubdivisionGranularityExpression, SubdivisionGranularitySetting};`
  )(register);
  assert.equal(registrations.size, 2);
  for (const [name, constructor] of Object.entries(constructors)) assert.equal(registrations.get(name), constructor);
  assert.equal(
    constructors.SubdivisionGranularitySetting.noSubdivision.fill instanceof
      constructors.SubdivisionGranularityExpression,
    true
  );
  assert.doesNotMatch(transformed.get('render/subdivision.ts'), /register\('SubdivisionGranularity/);
  assert.match(transformed.get('source/worker.ts'), /import '\.\.\/render\/subdivision_granularity_settings\.ts';/);
});

test('orders layer admission while allowing aborts during unfinished tile work', async () => {
  const preparation = deferred();
  const tileCompletion = deferred();
  const calls = [];
  const worker = workerHarness(() => preparation.promise);
  worker.register('setLayers', async () => {
    calls.push('layers');
  });
  worker.register('loadTile', () => {
    calls.push('tile');
    return tileCompletion.promise;
  });
  worker.register('abortTile', async () => {
    calls.push('abort');
  });
  const layers = worker.send('setLayers', []);
  const tile = worker.send('loadTile', { type: 'external' });
  const abort = worker.send('abortTile', { type: 'external' });
  assert.deepEqual(calls, []);
  preparation.resolve();
  await layers;
  await abort;
  assert.deepEqual(calls, ['layers', 'tile', 'abort']);
  tileCompletion.resolve('complete');
  assert.equal(await tile, 'complete');
});

test('fails dependent admissions until a successful full replacement', async () => {
  let failure = true;
  const worker = workerHarness(async () => {
    if (failure) throw new Error('feature unavailable');
  });
  let calls = 0;
  worker.register('setLayers', async () => {});
  worker.register('loadTile', async () => {
    calls++;
  });
  await assert.rejects(worker.send('setLayers', []), /feature unavailable/);
  await assert.rejects(worker.send('loadTile', { type: 'external' }), /feature unavailable/);
  assert.equal(calls, 0);
  failure = false;
  await worker.send('setLayers', []);
  await worker.send('loadTile', { type: 'external' });
  assert.equal(calls, 1);
});

test('canceled preparation does not mutate layers or poison later admission', async () => {
  const preparation = deferred();
  const worker = workerHarness(() => preparation.promise);
  let mutations = 0;
  worker.register('setLayers', async () => {
    mutations++;
  });
  worker.register('loadTile', async () => 'tile');
  const controller = new AbortController();
  const pending = worker.send('setLayers', [], controller);
  controller.abort();
  preparation.resolve();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(await worker.send('loadTile', { type: 'external' }), 'tile');
  assert.equal(mutations, 0);
});
