import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { pruneUnreachableBuildDeclarations } from './prune-build-declarations.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'lyra-prune-declarations-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  function write(name, contents) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), contents);
  }
  write('package.json', JSON.stringify({
    types: './dist/index.d.ts',
    exports: {
      '.': { types: './dist/index.d.ts', default: './dist/index.js' },
      './theme/*': './dist/theme/*',
      './plain.js': './dist/plain.js',
    },
  }));
  write('dist/index.d.ts', `
import type { Model } from './model.js';
export { Visible } from './visible.js';
export type Lazy = import('./lazy.js').Lazy;
/// <reference path="./referenced.d.ts" />
export declare const item: Model;
`);
  write('dist/model.d.ts', 'export interface Model { value: string; }\n');
  write('dist/visible.d.ts', 'export declare class Visible {}\n');
  write('dist/lazy.d.ts', 'export interface Lazy { enabled: boolean; }\n');
  write('dist/referenced.d.ts', 'export interface Referenced {}\n');
  write('dist/plain.d.ts', 'export declare const plain: true;\n');
  write('dist/theme/theme.d.ts', 'export declare const theme: true;\n');
  write('dist/private.styles.d.ts', 'export declare const styles: string;\n');
  write('dist/unused.d.ts', 'export declare const unused: true;\n');
  return { root, write };
}

test('keeps every exported and referenced declaration, including wildcard and import-type roots', (t) => {
  const { root } = fixture(t);
  const result = pruneUnreachableBuildDeclarations(root);
  assert.deepEqual(result.removedPaths, ['dist/private.styles.d.ts', 'dist/unused.d.ts']);
  for (const name of ['index', 'model', 'visible', 'lazy', 'referenced', 'plain']) {
    assert.equal(existsSync(join(root, `dist/${name}.d.ts`)), true, name);
  }
  assert.equal(existsSync(join(root, 'dist/theme/theme.d.ts')), true);
  assert.match(readFileSync(join(root, 'dist/index.d.ts'), 'utf8'), /import type/);
  assert.deepEqual(pruneUnreachableBuildDeclarations(root).removedPaths, []);
});

test('an unresolved relative reference fails before deleting any declaration', (t) => {
  const { root, write } = fixture(t);
  write('dist/model.d.ts', "export type Missing = import('./absent.js').Missing;\n");
  assert.throws(() => pruneUnreachableBuildDeclarations(root), /unresolved relative declaration reference/);
  assert.equal(existsSync(join(root, 'dist/unused.d.ts')), true);
});
