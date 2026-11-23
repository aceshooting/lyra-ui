import assert from 'node:assert/strict';
import { readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { settleFixtureDescendants } from './wtr-fixture-settle.mjs';

// pnpm links a package's dependencies beside its real directory.
const testing = realpathSync(new URL('../node_modules/@open-wc/testing', import.meta.url));
const helpers = join(testing, '..', 'testing-helpers');

test('the installed elementUpdated() keeps the shape the fixture-settle rewrite targets', () => {
  const source = readFileSync(join(helpers, 'src/elementUpdated.js'), 'utf8');
  const rewritten = settleFixtureDescendants(source);
  assert.ok(rewritten, 'a helper release changed elementUpdated(); update scripts/wtr-fixture-settle.mjs');
  assert.match(rewritten, /async function originalElementUpdated\(el\) \{/u);
  assert.equal(rewritten.match(/export async function elementUpdated\(el\)/gu)?.length, 1);
});

test('an unexpected helper shape is left untouched', () => {
  assert.equal(settleFixtureDescendants('export function elementUpdated() {}'), undefined);
});

test('patches only the helper JavaScript served by the fixture-settle plugin', async () => {
  const { fixtureSettlePlugin } = await import('./wtr-fixture-settle.mjs');
  const body = readFileSync(join(helpers, 'src/elementUpdated.js'), 'utf8');
  const context = (path, type = 'js') => ({ path, body, response: { is: (expected) => expected === type } });
  assert.ok(fixtureSettlePlugin.transform(context('/node_modules/@open-wc/testing-helpers/src/elementUpdated.js')));
  for (const [path, type] of [
    ['/node_modules/other/src/elementUpdated.js', 'js'],
    ['/node_modules/@open-wc/testing-helpers/src/helpers.js', 'js'],
    ['/node_modules/@open-wc/testing-helpers/src/elementUpdated.js', 'html'],
  ]) assert.equal(fixtureSettlePlugin.transform(context(path, type)), undefined);
});
