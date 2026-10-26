import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { collectApi, compareApi } from './check-api.mjs';

const declarations = JSON.parse(await readFile(new URL('./fixtures/api/contract.json', import.meta.url), 'utf8'));
const experimental = ['./candidate.js'];

async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'lyra-gen-api-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(path.join(directory, 'dist'));
  const manifest = {
    name: '@example/contracts', type: 'module', engines: { node: '>=22' },
    sideEffects: ['./dist/public.js'],
    exports: {
      '.': { types: './dist/index.d.ts', default: './dist/index.js' },
      './public.js': { types: './dist/public.d.ts', default: './dist/public.js' },
      './candidate.js': { types: './dist/candidate.d.ts', default: './dist/candidate.js' },
      './package.json': './package.json',
    },
  };
  const configPath = path.join(directory, 'tsconfig.json');
  await writeFile(configPath, JSON.stringify({ compilerOptions: { noEmit: true, noResolve: true, noLib: true, types: [], module: 'NodeNext', moduleResolution: 'NodeNext', strict: true }, include: ['dist/**/*.d.ts'] }));
  const put = (name, text) => writeFile(path.join(directory, 'dist', name), text);
  for (const [name, text] of Object.entries(declarations)) {
    await put(name, text);
    await put(name.replace('.d.ts', '.js'), 'export {};\n');
  }
  const saveManifest = () => writeFile(path.join(directory, 'package.json'), JSON.stringify(manifest));
  await saveManifest();
  return { directory, manifest, put, saveManifest, collect: () => collectApi({ packageDir: directory, configPath, experimental }) };
}

test('resolves re-exports, overloads, class members, globals and recursive reachable types', async t => {
  const f = await fixture(t);
  const result = f.collect();
  assert.deepEqual(Object.keys(result.entrypoints['.'].exports), ['admit', 'Controller', 'PublicPayload', 'VERSION']);
  assert.equal(result.entrypoints['.'].exports.PublicPayload, 'internal.d.ts#Payload');
  assert.ok(result.declarations['internal.d.ts#Payload']);
  assert.equal(result.declarations['internal.d.ts#Unreachable'], undefined);
  assert.ok(Object.keys(result.declarations).some(key => key.includes('#global')));
  assert.equal(result.entrypoints['./candidate.js'].profile, 'experimental');
  assert.deepEqual(compareApi(result, result), { contract: [], experimental: [] });
});

for (const [name, before, after, key] of [
  ['removes a root re-export', "export * from './public.js';", "export { Controller } from './public.js';", 'index.d.ts'],
  ['changes an overload parameter', 'input: Uint8Array', 'input: number', 'public.d.ts'],
  ['changes a return type', '): Payload;', '): string;', 'public.d.ts'],
  ['removes a public class method', 'submit(input: Payload): Promise<void>;', '', 'public.d.ts'],
  ['changes a protected class method', 'protected reset(): void;', 'protected reset(force: boolean): void;', 'public.d.ts'],
  ['changes an imported reachable type', 'readonly value: string;', 'readonly value: number;', 'internal.d.ts'],
  ['changes a literal format version', "VERSION: '1'", "VERSION: '2'", 'public.d.ts'],
  ['changes global element typing', "'fixture-view': Controller", "'different-view': Controller", 'public.d.ts'],
]) {
  test(`detects declaration drift when a change ${name}`, async t => {
    const f = await fixture(t);
    const baseline = f.collect();
    assert.ok(declarations[key].includes(before));
    await f.put(key, declarations[key].replace(before, after));
    assert.ok(compareApi(baseline, f.collect()).contract.length > 0);
  });
}

test('ignores comments, whitespace, unreachable types and private implementation member names', async t => {
  const f = await fixture(t);
  const baseline = f.collect();
  await f.put('public.d.ts', `/** A new explanation. */\n${declarations['public.d.ts'].replace('private pending;', 'private changed;').replace('readonly status:', 'readonly   status :')}`);
  await f.put('internal.d.ts', declarations['internal.d.ts'].replace('ignored: number', 'ignored: string'));
  assert.deepEqual(compareApi(baseline, f.collect()), { contract: [], experimental: [] });
});

test('keeps candidate signature changes separate and rejects candidate leakage into a stable entry', async t => {
  const f = await fixture(t);
  const baseline = f.collect();
  await f.put('candidate.d.ts', declarations['candidate.d.ts'].replace('number', 'boolean'));
  const change = compareApi(baseline, f.collect());
  assert.equal(change.contract.length, 0);
  assert.ok(change.experimental.length > 0);
  await f.put('index.d.ts', `${declarations['index.d.ts']}\nexport * from './candidate.js';`);
  assert.throws(() => f.collect(), /experimental.*stable/i);
});

test('detects loss of side effects and supported paths without accepting wildcard replacements', async t => {
  const f = await fixture(t);
  const baseline = f.collect();
  f.manifest.sideEffects = [];
  await f.saveManifest();
  assert.ok(compareApi(baseline, f.collect()).contract.some(item => item.includes('sideEffects')));
  delete f.manifest.exports['./public.js'];
  await f.saveManifest();
  assert.ok(compareApi(baseline, f.collect()).contract.some(item => item.includes('./public.js')));
  f.manifest.exports['./*.js'] = { types: './dist/*.d.ts', default: './dist/*.js' };
  await f.saveManifest();
  assert.throws(() => f.collect(), /explicit|wildcard/i);
});

test('fails closed for missing artifacts, unresolved local re-exports and invalid declarations', async t => {
  const f = await fixture(t);
  await rm(path.join(f.directory, 'dist', 'public.js'));
  assert.throws(() => f.collect(), /public.js/);
  await f.put('public.js', 'export {};');
  await f.put('index.d.ts', "export { Missing } from './missing.js';");
  assert.throws(() => f.collect(), /unresolved|missing/i);
  await f.put('index.d.ts', 'export declare function broken(: void;');
  assert.throws(() => f.collect(), /syntax|parse/i);
});

test('detects type-only re-export changes even when the target declaration is unchanged', async t => {
  const f = await fixture(t);
  await f.put('index.d.ts', "export { Controller } from './public.js';");
  const baseline = f.collect();
  await f.put('index.d.ts', "export type { Controller } from './public.js';");
  assert.ok(compareApi(baseline, f.collect()).contract.length > 0);
});

test('tracks type dependencies reached through namespace imports and import type expressions', async t => {
  const f = await fixture(t);
  await f.put('public.d.ts', "import type * as Internal from './internal.js'; export declare function admit(input: Internal.Payload): import('./internal.js').Payload;");
  const baseline = f.collect();
  assert.ok(baseline.declarations['internal.d.ts#Payload']);
  await f.put('internal.d.ts', declarations['internal.d.ts'].replace('value: string', 'value: number'));
  assert.ok(compareApi(baseline, f.collect()).contract.length > 0);
});

for (const signature of ["import type * as Internal from './internal.js'; export declare function all(): typeof Internal;", "export declare function all(): typeof import('./internal.js');"]) {
  test(`tracks a whole-module public type: ${signature}`, async t => {
    const f = await fixture(t);
    await f.put('public.d.ts', signature);
    await f.put('internal.d.ts', `${declarations['internal.d.ts']}\nexport declare const value: Payload;`);
    const baseline = f.collect();
    assert.ok(baseline.declarations['internal.d.ts#Payload']);
    await f.put('internal.d.ts', `${declarations['internal.d.ts'].replace('value: string', 'value: number')}\nexport declare const value: Payload;`);
    assert.ok(compareApi(baseline, f.collect()).contract.length > 0);
  });
}

test('preserves private-constructor accessibility independently of private implementation fields', async t => {
  const f = await fixture(t);
  await f.put('public.d.ts', 'export declare class Controller { private constructor(); private pending; }');
  const baseline = f.collect();
  await f.put('public.d.ts', 'export declare class Controller { private pending; }');
  assert.ok(compareApi(baseline, f.collect()).contract.length > 0);
});

test('tracks the external type import identity without copying dependency declarations', async t => {
  const f = await fixture(t);
  await f.put('public.d.ts', "import type { Message } from 'first-peer'; export declare function admit(input: Message): void;");
  const baseline = f.collect();
  await f.put('public.d.ts', "import type { Message } from 'second-peer'; export declare function admit(input: Message): void;");
  assert.ok(compareApi(baseline, f.collect()).contract.length > 0);
});

test('tracks global augmentation loaded by a declaration-only side-effect import', async t => {
  const f = await fixture(t);
  await f.put('public.d.ts', "import './augmentation.js'; export declare const ready: boolean;");
  await f.put('augmentation.d.ts', "export {}; declare global { interface Window { fixtureVersion: '1'; } }");
  const baseline = f.collect();
  await f.put('augmentation.d.ts', "export {}; declare global { interface Window { fixtureVersion: '2'; } }");
  assert.ok(compareApi(baseline, f.collect()).contract.length > 0);
});

for (const bridgeImport of ["export * from './bridge.js';", "import type { Unused } from './bridge.js'; export * from './public.js';"]) {
  test(`tracks intermediate module augmentation: ${bridgeImport}`, async t => {
    const f = await fixture(t);
    await f.put('index.d.ts', bridgeImport);
    const bridge = `export * from './public.js'; ${bridgeImport.startsWith('import type') ? 'export ' : ''}interface Unused { ignored: number; } declare global { interface Window { stableProperty: '1'; } }`;
    await f.put('bridge.d.ts', bridge);
    const baseline = f.collect();
    await f.put('bridge.d.ts', bridge.replace("stableProperty: '1'", "stableProperty: '2'"));
    assert.ok(compareApi(baseline, f.collect()).contract.length > 0);
    if (bridgeImport.startsWith('import type')) {
      assert.equal(baseline.declarations['bridge.d.ts#Unused'], undefined);
      await f.put('bridge.d.ts', bridge.replace('ignored: number', 'ignored: string'));
      assert.deepEqual(compareApi(baseline, f.collect()), { contract: [], experimental: [] });
    }
  });
}

test('follows cyclic declaration-module imports without freezing unrelated declarations', async t => {
  const f = await fixture(t);
  await f.put('public.d.ts', "import './bridge.js'; export declare const ready: boolean;");
  await f.put('bridge.d.ts', "import './public.js'; export interface Unreachable { value: string; } declare global { interface Window { stableProperty: '1'; } }");
  const baseline = f.collect();
  assert.equal(baseline.declarations['bridge.d.ts#Unreachable'], undefined);
  await f.put('bridge.d.ts', "import './public.js'; export interface Unreachable { value: string; } declare global { interface Window { stableProperty: '2'; } }");
  assert.ok(compareApi(baseline, f.collect()).contract.length > 0);
});
