import assert from 'node:assert/strict';
import test from 'node:test';
import { HYDRATION_FIXTURE_ENGINES, parseEngines } from './hydration-fixtures.mjs';
import { SSR_RENDER_COMMAND, SSR_WARM_COMMAND, ssrFixturePlugin } from './wtr-ssr-fixture-plugin.mjs';

test('runs every engine by default and narrows to a requested, deduplicated subset', () => {
  assert.deepEqual(parseEngines(undefined), ['chromium', 'firefox', 'webkit']);
  assert.deepEqual(parseEngines(' '), [...HYDRATION_FIXTURE_ENGINES]);
  assert.deepEqual(parseEngines('webkit, chromium,webkit'), ['webkit', 'chromium']);
});

test('rejects unknown or empty engine lists instead of silently running fewer engines', () => {
  assert.throws(() => parseEngines('chromium,edge'), /HYDRATION_FIXTURE_BROWSERS accepts/);
  assert.throws(() => parseEngines(','), /HYDRATION_FIXTURE_BROWSERS accepts/);
});

test('the fixture plugin ignores foreign commands and rejects a malformed render payload before starting a worker', async () => {
  const plugin = ssrFixturePlugin();
  assert.equal(await plugin.executeCommand({ command: 'send-mouse', payload: {} }), undefined);
  await assert.rejects(
    plugin.executeCommand({ command: SSR_RENDER_COMMAND, payload: { template: { kind: 'primitive', value: 1 } } }),
    /expects a serialized template payload/,
  );
  assert.notEqual(SSR_WARM_COMMAND, SSR_RENDER_COMMAND);
  await plugin.serverStop();
});
