import assert from 'node:assert/strict';
import test from 'node:test';
import { diffPublicApi, minimumRequiredBump, normalizePublicApi } from './public-api-diff.mjs';

const originalDeclarations = `
export type Kind = 'ready' | 'pending';
export interface Options<T = string> { value: T; next?: Options<T>; kind: Kind; }
export declare const MAX: 500;
export declare function normalize(value: Kind): Kind;
export declare class Result { constructor(value: Kind); value: Kind; }
`;

function relocationFixture({ moved = false, declarations = originalDeclarations, exports, consumer } = {}) {
  const files = {
    'dist/public.d.ts': moved
      ? exports ?? `export type { Kind, Options } from './shared.js';
        export { MAX, normalize, Result } from './shared.js';`
      : declarations,
    'dist/consumer.d.ts': consumer ?? `import type { Options } from './public.js';
      export declare function use(value: Options): void;`,
    ...(moved ? { 'dist/shared.d.ts': declarations } : {}),
  };
  return normalizePublicApi({
    packageJson: {
      name: '@aceshooting/lyra-ui', version: '1.0.0',
      exports: { './public.js': './dist/public.js', './consumer.js': './dist/consumer.js' },
    },
    manifest: { modules: [] },
    declarations: {
      namedEntry: 'dist/public.d.ts', files,
      packageFiles: Object.keys(files).flatMap((file) => [file, file.replace('.d.ts', '.js')]),
    },
  });
}

test('ambient declarations and their reexports preserve runtime value kinds', () => {
  for (const moved of [false, true]) {
    const snapshot = relocationFixture({ moved });
    for (const name of ['MAX', 'normalize', 'Result']) {
      assert.deepEqual(snapshot.entries[`subpath-export:./public.js:${name}`].value, { kind: 'value' });
    }
    assert.deepEqual(snapshot.entries['subpath-export:./public.js:Options'].value, { kind: 'type' });
  }
});

test('moving recursive generic declarations behind retained public exports is compatible', () => {
  const before = relocationFixture();
  const after = relocationFixture({ moved: true });
  assert.equal(minimumRequiredBump(diffPublicApi(before, after)), 'none');
  assert.equal(minimumRequiredBump(diffPublicApi(after, before)), 'none');
});

test('relocation requires retained topology evidence from both snapshots', () => {
  for (const missing of ['before', 'after']) {
    const before = relocationFixture();
    const after = relocationFixture({ moved: true });
    delete (missing === 'before' ? before : after).dependencyTopology;
    assert.equal(minimumRequiredBump(diffPublicApi(before, after)), 'major');
  }
});

test('relocation retains detection of changed fields, recursion, generics and callables', () => {
  for (const declarations of [
    originalDeclarations.replace("'ready' | 'pending'", "'ready'"),
    originalDeclarations.replace('value: T;', ''),
    originalDeclarations.replace('next?: Options<T>', 'next?: Options<number>'),
    originalDeclarations.replace('T = string', 'T extends number = number'),
    originalDeclarations.replace('normalize(value: Kind)', 'normalize(value: number)'),
    originalDeclarations.replace('MAX: 500', 'MAX: 501'),
  ]) {
    assert.equal(minimumRequiredBump(diffPublicApi(
      relocationFixture(), relocationFixture({ moved: true, declarations }),
    )), 'major', declarations);
  }
});

test('relocation cannot hide a missing export or a value made type-only', () => {
  for (const exports of [
    `export type { Kind, Options } from './shared.js'; export { MAX } from './shared.js';`,
    `export type { Kind, Options, MAX, normalize, Result } from './shared.js';`,
    `export type { Kind, Options, Result } from './shared.js'; export { MAX, normalize } from './shared.js';`,
  ]) {
    assert.equal(minimumRequiredBump(diffPublicApi(
      relocationFixture(), relocationFixture({ moved: true, exports }),
    )), 'major');
  }
});

test('relocation cannot substitute an unrelated same-named dependency', () => {
  const fixture = (moved, useOther) => {
    const declarations = originalDeclarations;
    const files = {
      'dist/public.d.ts': moved
        ? `export type { Kind, Options } from './shared.js'; export { MAX, normalize } from './shared.js';`
        : declarations,
      'dist/other.d.ts': 'export interface Options { value: number; }',
      'dist/consumer.d.ts': `import type { Options } from './${useOther ? 'other' : 'public'}.js';
        export declare function use(value: Options): void;`,
      ...(moved ? { 'dist/shared.d.ts': declarations } : {}),
    };
    return normalizePublicApi({
      packageJson: {
        name: '@aceshooting/lyra-ui', version: '1.0.0',
        exports: { './public.js': './dist/public.js', './consumer.js': './dist/consumer.js' },
      },
      manifest: { modules: [] },
      declarations: { files, packageFiles: Object.keys(files).map((file) => file.replace('.d.ts', '.js')) },
    });
  };
  const changes = diffPublicApi(fixture(false, false), fixture(true, true));
  assert.ok(changes.some(({ id, bump }) =>
    id === 'subpath-export:./consumer.js:use:dependencies' && bump === 'major'));
});

test('relocation rejects conflicting public alias correspondences in either direction', () => {
  const fixture = (split) => normalizePublicApi({
    packageJson: {
      name: '@aceshooting/lyra-ui', version: '1.0.0',
      exports: { './public.js': './dist/public.js' },
    },
    manifest: { modules: [] },
    declarations: {
      files: {
        'dist/public.d.ts': `export type { Options as First } from './first.js';
          export type { Options as Second } from './${split ? 'second' : 'first'}.js';`,
        'dist/first.d.ts': 'export interface Options { value: string; }',
        'dist/second.d.ts': 'export interface Options { value: string; }',
      },
      packageFiles: ['dist/public.js', 'dist/first.js', 'dist/second.js'],
    },
  });
  assert.equal(minimumRequiredBump(diffPublicApi(fixture(false), fixture(true))), 'major');
  assert.equal(minimumRequiredBump(diffPublicApi(fixture(true), fixture(false))), 'major');
});

test('relocation cannot hide root-edge rewiring when the reachable set stays identical', () => {
  const fixture = (moved, rewired) => {
    const declarations = `export interface First { value: string; other?: Second; }
      export interface Second { value: number; other?: First; }`;
    return normalizePublicApi({
      packageJson: {
        name: '@aceshooting/lyra-ui', version: '1.0.0',
        exports: { './public.js': './dist/public.js', './consumer.js': './dist/consumer.js' },
      },
      manifest: { modules: [] },
      declarations: {
        files: {
          'dist/public.d.ts': moved ? "export type { First, Second } from './shared.js';" : declarations,
          'dist/consumer.d.ts': `import type { ${rewired ? 'Second' : 'First'} as Value } from './public.js';
            export declare function use(value: Value): void;`,
          ...(moved ? { 'dist/shared.d.ts': declarations } : {}),
        },
        packageFiles: ['dist/public.js', 'dist/consumer.js', ...(moved ? ['dist/shared.js'] : [])],
      },
    });
  };
  const changes = diffPublicApi(fixture(false, false), fixture(true, true));
  assert.ok(changes.some(({ id, bump }) =>
    id === 'subpath-export:./consumer.js:use:dependencies' && bump === 'major'));
});
