import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { lyraMapWorkerPlugin, workerBridgeToken } from '../src/vite.mjs';

const bridge = "const worker = new URL('__LYRA_MODULAR_WORKER_BRIDGE__', import.meta.url);";

test('emits the worker into the same build graph and rejects duplicate bridges', () => {
  const plugin = lyraMapWorkerPlugin({ workerEntry: '/engine/worker.mjs' });
  const emitted = [];
  plugin.configResolved({ command: 'build' });
  const result = plugin.transform.call(
    {
      emitFile(chunk) {
        emitted.push(chunk);
        return 'paired';
      }
    },
    bridge
  );
  assert.deepEqual(emitted, [{ type: 'chunk', id: '/engine/worker.mjs', name: 'map-worker' }]);
  assert.match(result.code, /import\.meta\.ROLLUP_FILE_URL_paired/);
  plugin.generateBundle();
  plugin.transform.call(
    {
      emitFile() {
        throw new Error('Unexpected second worker');
      }
    },
    bridge
  );
  assert.throws(() => plugin.generateBundle(), /found 2/);
  assert.doesNotThrow(() => lyraMapWorkerPlugin().generateBundle());
});

test('uses Vite worker URL handling during development without a document preload helper', () => {
  const plugin = lyraMapWorkerPlugin({ workerEntry: '/engine/worker.mjs' });
  plugin.configResolved({ command: 'serve' });
  const configuration = plugin.config();
  assert.equal(configuration.build.modulePreload, false);
  assert.deepEqual(configuration.optimizeDeps.exclude, ['@aceshooting/lyra-map']);
  const result = plugin.transform.call(
    {
      emitFile() {
        throw new Error('Development must not emit a build chunk');
      }
    },
    bridge
  );
  assert.match(result.code, /worker\.mjs\?worker&url/);
  assert.match(result.code, /new URL\(__lyraModularDevWorkerUrl, import\.meta\.url\)/);
  const server = { config: { server: { fs: { allow: ['/app'] } } } };
  plugin.configureServer(server);
  plugin.configureServer(server);
  assert.deepEqual(server.config.server.fs.allow, ['/app', '/engine']);
});

test('supplies the deferred worker marker as an absolute URL in development and production', () => {
  const deferred = "const url = requireConfiguredModularWorkerUrl('__LYRA_MODULAR_WORKER_BRIDGE__');";
  for (const command of ['serve', 'build']) {
    const plugin = lyraMapWorkerPlugin({ workerEntry: '/engine/worker.mjs' });
    plugin.configResolved({ command });
    const emitted = [];
    const result = plugin.transform.call({ emitFile(chunk) { emitted.push(chunk); return 'paired'; } }, deferred);
    assert.ok(result, `${command} resolves the deferred marker`);
    assert.ok(!result.code.includes('__LYRA_MODULAR_WORKER_BRIDGE__'));
    assert.match(result.code, /requireConfiguredModularWorkerUrl\(new URL\([^]*?import\.meta\.url\)\.href\)/u);
    assert.equal(emitted.length, command === 'build' ? 1 : 0);
    if (command === 'serve') assert.match(result.code, /worker\.mjs\?worker&url/u);
    else assert.match(result.code, /import\.meta\.ROLLUP_FILE_URL_paired/u);
    assert.doesNotThrow(() => plugin.generateBundle());
  }
});

test('leaves unrelated modules unchanged', () => {
  assert.equal(lyraMapWorkerPlugin().transform('export const value = 1;'), undefined);
});

test('an empty package name leaves dependency optimization exclusions empty', () => {
  const configuration = lyraMapWorkerPlugin({ packageName: '' }).config();
  assert.equal(configuration.build.modulePreload, false);
  assert.deepEqual(configuration.optimizeDeps.exclude, []);
});

test('resets worker bridge state for each watch rebuild without hiding same-build duplicates', () => {
  const plugin = lyraMapWorkerPlugin({ workerEntry: '/engine/worker.mjs' });
  plugin.configResolved({ command: 'build' });
  let count = 0;
  const context = { emitFile() { return 'build' + (++count); } };
  for (let build = 1; build <= 2; build++) {
    plugin.buildStart?.();
    const result = plugin.transform.call(context, bridge);
    assert.match(result.code, new RegExp('ROLLUP_FILE_URL_build' + build));
    assert.doesNotThrow(() => plugin.generateBundle());
  }
  plugin.transform.call(context, bridge);
  assert.throws(() => plugin.generateBundle(), /found 2/);
});


test('the exported worker marker participates in the build transform', () => {
  const plugin = lyraMapWorkerPlugin({ workerEntry: '/engine/worker.mjs' });
  plugin.configResolved({ command: 'build' });
  const emitted = [];
  const result = plugin.transform.call(
    { emitFile(chunk) { emitted.push(chunk); return 'exportedMarker'; } },
    `const workerUrl = requireConfiguredModularWorkerUrl(${JSON.stringify(workerBridgeToken)});`
  );
  assert.ok(result, 'Consumers of the exported marker receive a worker URL');
  assert.equal(result.code, 'const workerUrl = requireConfiguredModularWorkerUrl(new URL(import.meta.ROLLUP_FILE_URL_exportedMarker, import.meta.url).href);');
  assert.deepEqual(emitted, [{ type: 'chunk', id: '/engine/worker.mjs', name: 'map-worker' }]);
});

test('the named plugin resolves its default worker beside its own module', () => {
  const plugin = lyraMapWorkerPlugin();
  assert.equal(typeof plugin.name, 'string');
  assert.ok(plugin.name.trim().length > 0, 'Vite diagnostics can identify the worker plugin');
  plugin.configResolved({ command: 'build' });
  const emitted = [];
  plugin.transform.call({ emitFile(chunk) { emitted.push(chunk); return 'defaultWorker'; } }, bridge);
  assert.deepEqual(emitted, [{
    type: 'chunk',
    id: fileURLToPath(new URL('../src/worker.mjs', import.meta.url)),
    name: 'map-worker'
  }]);
});
