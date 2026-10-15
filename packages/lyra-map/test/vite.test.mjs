import assert from 'node:assert/strict';
import test from 'node:test';
import { lyraMapWorkerPlugin } from '../src/vite.mjs';

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

test('leaves unrelated modules unchanged', () => {
  assert.equal(lyraMapWorkerPlugin().transform('export const value = 1;'), undefined);
});
