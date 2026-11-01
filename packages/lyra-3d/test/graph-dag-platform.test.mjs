import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { layoutGraphDagAsync } from '../dist/graph-layout/index.js';

const root = fileURLToPath(new URL('../', import.meta.url));
// Resolved through the module hooks, so a coverage run bundles the instrumented build it measures.
const entry = fileURLToPath(import.meta.resolve('../dist/graph-layout/index.js'));

test('Node signal adapter rejects transparent proxies while accepting native signals', async () => {
  const input = { nodeCount: 0, source: new Uint32Array(), target: new Uint32Array() };
  const controller = new AbortController();
  const result = await layoutGraphDagAsync(input, undefined, { signal: controller.signal });
  assert.equal(result.layerCount, 0);
  await assert.rejects(layoutGraphDagAsync(input, undefined, { signal: new Proxy(controller.signal, {}) }),
    error => error.code === 'invalid-options');
});

test('browser signal adapter defers proxy rejection to the platform getter brand check', async () => {
  const { isSignalProxy } = await import('../dist/graph-layout/signal-brand-browser.js');
  const { isSignalProxy: isNodeSignalProxy } = await import('../dist/graph-layout/signal-brand-node.js');
  const signal = new AbortController().signal;
  const proxy = new Proxy(signal, {});
  assert.equal(isNodeSignalProxy(proxy), true);
  assert.equal(isNodeSignalProxy(signal), false);
  // Browser AbortSignal getters throw on a proxy receiver, so the adapter never reports one itself.
  assert.equal(isSignalProxy(proxy), false);
  assert.equal(isSignalProxy(signal), false);
});

test('browser bundle selects the browser signal adapter without Node builtins', async () => {
  const modules = new Set();
  await build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [{
      name: 'inspect-layout-platform-modules',
      generateBundle() { for (const id of this.getModuleIds()) modules.add(id.replaceAll('\\', '/')); },
    }],
    build: {
      write: false,
      minify: false,
      lib: { entry, formats: ['es'] },
      rolldownOptions: { onwarn(warning) { throw new Error(`Unexpected bundle warning: ${warning.message}`); } },
    },
  });
  assert.ok([...modules].some(id => id.endsWith('/graph-layout/signal-brand-browser.js')));
  assert.ok([...modules].every(id => !id.includes('signal-brand-node') && !id.includes('node:util') && !id.includes('browser-external')));
  assert.ok([...modules].every(id => !/(?:^|\/)three(?:@|\/|$)/u.test(id)
    && !/\/dist\/(?:graph|core)\//u.test(id)), 'The layout bundle must not load a renderer or engine core');
});
