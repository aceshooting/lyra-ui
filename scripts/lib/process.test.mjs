import assert from 'node:assert/strict';
import { test } from 'node:test';
import { run } from './process.mjs';

test('captured child output is returned and included in failure diagnostics', async () => {
  assert.equal(await run(process.execPath, ['-e', "process.stdout.write('ready')"], process.cwd(), 'probe',
    { capture: true }), 'ready');
  await assert.rejects(run(process.execPath, ['-e', "process.stderr.write('failure'); process.exit(3)"],
    process.cwd(), 'probe', { capture: true }), /probe failed with exit code 3\nfailure/);
});
