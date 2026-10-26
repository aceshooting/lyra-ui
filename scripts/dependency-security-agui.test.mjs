import assert from 'node:assert/strict';
import { readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const genRequire = createRequire(new URL('../packages/lyra-gen/package.json', import.meta.url));
const clientRequire = createRequire(genRequire.resolve('@ag-ui/client'));
const protoRequire = createRequire(clientRequire.resolve('@ag-ui/proto'));
const parents = [clientRequire, protoRequire, createRequire(clientRequire.resolve('@ag-ui/core')),
  createRequire(protoRequire.resolve('@ag-ui/core')), createRequire(genRequire.resolve('@ag-ui/core'))];

async function load(parentRequire, name, flavor) {
  if (flavor === 'cjs') return parentRequire(name);
  const manifestFile = parentRequire.resolve(`${name.split('/').slice(0, name.startsWith('@') ? 2 : 1).join('/')}/package.json`);
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
  const subpath = name.startsWith('@') ? name.split('/').slice(2) : name.split('/').slice(1);
  const entry = manifest.exports[subpath.length ? `./${subpath.join('/')}` : '.'].import;
  return import(pathToFileURL(join(dirname(manifestFile), typeof entry === 'string' ? entry : entry.default)).href);
}

for (const flavor of ['cjs', 'esm']) {
  test(`AG-UI ${flavor} resolves fixed Zod collection bounds through every SDK parent`, async () => {
    const resolved = new Set();
    for (const parentRequire of parents) {
      const { z } = await load(parentRequire, 'zod/v4', flavor);
      let visits = 0;
      const item = z.preprocess(value => { visits++; return value; }, z.string());
      const array = z.array(item).max(2);
      const oversized = array.safeParse([1, 2, 3]);
      assert.equal(oversized.success, false);
      assert.equal(visits, 0, 'Oversized arrays must reject before parsing their elements.');
      assert.deepEqual(oversized.error.issues.map(issue => [issue.code, issue.path]), [['too_big', []]]);
      for (const [schema, value] of [
        [z.array(item).length(2), [1, 2, 3]],
        [z.set(item).max(2), new Set([1, 2, 3])],
        [z.set(item).size(2), new Set([1, 2, 3])],
        [z.map(item, item).max(2), new Map([[1, 1], [2, 2], [3, 3]])],
      ]) {
        assert.equal((await schema.safeParseAsync(value)).success, false);
        assert.equal(visits, 0, 'Oversized constrained collections must not visit entries.');
      }
      assert.deepEqual(array.parse(['one', 'two']), ['one', 'two']);
      assert.equal(visits, 2);
      const invalid = array.safeParse([1, 2]);
      assert.equal(invalid.success, false);
      assert.deepEqual(invalid.error.issues.map(issue => issue.path), [[0], [1]]);
      assert.equal(visits, 4, 'Within-bound input retains element validation.');
      assert.equal(parentRequire('zod/package.json').version, '4.6.7');
      resolved.add(realpathSync(parentRequire.resolve('zod/v4')));
    }
    assert.equal(resolved.size, 1, 'The SDK and its schema peers use the same fixed Zod runtime.');
  });

  test(`AG-UI ${flavor} keeps protocol validation with the fixed v4 runtime`, async () => {
    const client = await load(genRequire, '@ag-ui/client', flavor);
    assert.equal(typeof client.HttpAgent, 'function');
    for (const parentRequire of [clientRequire, protoRequire, genRequire]) {
      const { RunAgentInputSchema, EventSchema } = await load(parentRequire, '@ag-ui/core/schemas', flavor);
      const input = { threadId: 'thread', runId: 'run', state: {}, messages: [], tools: [], context: [], forwardedProps: {} };
      assert.deepEqual(RunAgentInputSchema.parse(input), input);
      assert.equal(RunAgentInputSchema.safeParse({ ...input, messages: 'invalid' }).success, false);
      const event = { type: 'RUN_STARTED', threadId: 'thread', runId: 'run' };
      assert.deepEqual(EventSchema.parse(event), event);
      assert.equal(EventSchema.safeParse({ ...event, runId: 1 }).success, false);
      assert.equal(EventSchema.safeParse({ ...event, type: 'UNKNOWN_EVENT' }).success, false);
    }
  });
}
