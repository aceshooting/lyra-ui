import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { build, createLogger } from 'vite';
import { packedShikiViteConfig } from './packed-shiki-consumer.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'lyra-shiki-build-warning-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'index.html'), '<script type="module" src="/main.js"></script>');
  await writeFile(join(root, 'main.js'), 'globalThis.consumerReady = true;');
  const warnings = [];
  const logger = createLogger('silent');
  logger.warn = logger.warnOnce = message => warnings.push(message);
  return { root, logger, warnings };
}

test('packed Shiki builds ignore timing advisories from a slow plugin', async t => {
  const { root, logger, warnings } = await fixture(t);
  const plugin = {
    name: 'slow-consumer-transform',
    transform(_code, id) {
      if (id.endsWith('/main.js')) {
        // Exceed Rolldown's three-second timing threshold without occupying a CPU core.
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3_500);
      }
    },
  };
  await build({ configFile: false, root, customLogger: logger, plugins: [plugin] });
  assert.ok(warnings.some(message => message.includes('PLUGIN_TIMINGS')),
    'The control build must reproduce the timing advisory');
  warnings.length = 0;
  const result = await build({ ...packedShikiViteConfig(root, logger), plugins: [plugin] });
  assert.deepEqual(warnings, [], 'A timing advisory must not fail package qualification');
  assert.ok(result.output.some(row => row.type === 'chunk' && row.code.includes('consumerReady')));
});

test('packed Shiki builds still report ordinary plugin warnings', async t => {
  const { root, logger, warnings } = await fixture(t);
  await build({
    ...packedShikiViteConfig(root, logger),
    plugins: [{ name: 'consumer-warning', buildStart() { this.warn('Consumer configuration is invalid'); } }],
  });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Consumer configuration is invalid/u);
});

test('packed Shiki builds still reject unresolved package imports', async t => {
  const { root, logger } = await fixture(t);
  await writeFile(join(root, 'main.js'), "import 'missing-consumer-package';");
  await assert.rejects(build(packedShikiViteConfig(root, logger)), /missing-consumer-package/u);
});
