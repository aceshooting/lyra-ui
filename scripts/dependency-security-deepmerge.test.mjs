import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import test from 'node:test';

const packageRequire = createRequire(new URL('../packages/lyra-ui/package.json', import.meta.url));
const testRunnerRequire = createRequire(packageRequire.resolve('@web/test-runner'));
const devServerEntry = testRunnerRequire.resolve('@web/dev-server');
const devServerRequire = createRequire(devServerEntry);
const nodeResolveRequire = createRequire(devServerRequire.resolve('@rollup/plugin-node-resolve'));
// Both consumers must reach the same pinned, patched copy.
const entry = nodeResolveRequire.resolve('deepmerge');
assert.equal(devServerRequire.resolve('deepmerge'), entry);
const packageRoot = dirname(dirname(entry));
// The runnable builds that implement mergeObject. index.js (unbuilt source, patched identically)
// requires is-mergeable-object, which deepmerge does not install.
const builds = {
  cjs: nodeResolveRequire('deepmerge'),
  umd: nodeResolveRequire(join(packageRoot, 'dist/umd.js')),
};
const parse = (json) => JSON.parse(json);
const payload = '{"__proto__":{"isAdmin":true}}';
const assertClean = (value, label) => {
  assert.equal(Object.getPrototypeOf(value), Object.prototype, `${label} keeps the default prototype`);
  assert.equal(value.isAdmin, undefined, `${label} inherits no attacker-controlled property`);
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    assert.equal(Object.hasOwn(value, key), false, `${label} has no own ${key}`);
  }
};

test('deepmerge is pinned to the reviewed 4.1.1 release', () => {
  assert.equal(JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')).version, '4.1.1');
});

for (const [flavor, merge] of Object.entries(builds)) {
  // The two call shapes in this graph: merge({}, defaults) and merge(defaults, userOptions).
  test(`deepmerge ${flavor} rejects prototype poisoning through both call shapes`, () => {
    assertClean(merge({}, parse(payload)), 'clone into an empty target');
    const defaults = { rootDir: '/', extensions: ['.js'], preferBuiltins: false };
    const options = merge(defaults, parse(`{"extensions":[".ts"],"nested":${payload},"__proto__":{"isAdmin":true}}`));
    assertClean(options, 'defaults merged with options');
    assertClean(options.nested, 'nested options object');
    assert.deepEqual(options.extensions, ['.js', '.ts']);
    assert.equal(Object.prototype.isAdmin, undefined);
  });

  // GHSA-gcqx-w48m-w2h4: each target shape that bypasses a target-based guard.
  test(`deepmerge ${flavor} rejects prototype poisoning for every target shape`, () => {
    const nullPrototype = Object.create(null);
    nullPrototype.debug = false;
    const merged = merge(nullPrototype, parse(payload));
    assertClean(merged, 'null-prototype target');
    assert.equal(merged.debug, false);
    for (const placeholder of [null, undefined, 'text', 0]) {
      const nested = merge({ session: placeholder }, parse(`{"session":${payload}}`));
      assertClean(nested.session, `${String(placeholder)} placeholder`);
    }
    const ownKey = merge(parse('{"__proto__":{"isAdmin":true},"debug":false}'), { verbose: true });
    assertClean(ownKey, 'own __proto__ target');
    assert.deepEqual({ ...ownKey }, { debug: false, verbose: true });
    assertClean(merge({ list: [] }, parse(`{"list":[${payload}]}`)).list[0], 'cloned array element');
    assertClean(merge.all([Object.create(null), parse(payload), {}]), 'merge.all result');
    const custom = merge({ child: {} }, parse(`{"child":${payload}}`), { customMerge: () => undefined });
    assertClean(custom.child, 'custom merge result');
  });

  test(`deepmerge ${flavor} drops constructor, prototype and inherited keys`, () => {
    const merged = merge(
      parse('{"constructor":{"prototype":{"isAdmin":true}},"prototype":{"isAdmin":true},"keep":1}'),
      parse('{"constructor":{"name":"x"},"prototype":{"isAdmin":true},"toString":"x","other":2}'),
    );
    assertClean(merged, 'merged object');
    assert.equal(merged.constructor, Object);
    assert.equal(merged.toString, Object.prototype.toString);
    assert.deepEqual({ ...merged }, { keep: 1, other: 2 });
  });

  test(`deepmerge ${flavor} preserves ordinary merge, clone and symbol semantics`, () => {
    const symbol = Symbol('key');
    const target = { a: { x: 1, list: [1] }, keep: 'target', [symbol]: 'target' };
    const source = { a: { y: 2, list: [2] }, added: new Date(0), [symbol]: 'source' };
    const merged = merge(target, source);
    assert.deepEqual(merged.a, { x: 1, y: 2, list: [1, 2] });
    assert.equal(merged.keep, 'target');
    assert.equal(merged.added, source.added);
    assert.equal(merged[symbol], 'source');
    assert.notEqual(merged.a, target.a);
    assert.deepEqual(Object.getOwnPropertyDescriptor(merged, 'keep'),
      { value: 'target', writable: true, enumerable: true, configurable: true });
    const nullSymbolTarget = Object.create(null);
    nullSymbolTarget[symbol] = 'target';
    assert.equal(merge(nullSymbolTarget, { b: 1 })[symbol], 'target');
    assert.deepEqual(merge({ list: [1] }, { list: [2] }, { arrayMerge: (_, next) => next }), { list: [2] });
    assert.deepEqual(merge.all([{ a: 1 }, { b: 2 }, { a: 3 }]), { a: 3, b: 2 });
    const customMerge = (key) => (key === 'a' ? (x, y) => ({ ...x, ...y, custom: true }) : undefined);
    assert.deepEqual(merge({ a: { b: 1 } }, { a: { c: 2 } }, { customMerge }).a, { b: 1, c: 2, custom: true });
  });
}

test('the Rollup and dev-server resolver plugins still build their options', () => {
  const { nodeResolve } = nodeResolveRequire('@rollup/plugin-node-resolve');
  assert.equal(nodeResolve({ exportConditions: ['development'] }).name, 'node-resolve');
  const { nodeResolvePlugin } = devServerRequire(join(dirname(devServerEntry), 'plugins/nodeResolvePlugin.js'));
  const plugin = nodeResolvePlugin(process.cwd(), false, { ignoreSideEffectsForRoot: true, exportConditions: ['development'] });
  assert.equal(typeof plugin.resolveImport, 'function');
});
