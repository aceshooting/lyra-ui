import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSync } from 'oxc-parser';
import { runtimeModuleEdges } from './runtime-module-edges.mjs';

function edges(source) {
  const parsed = parseSync('fixture.ts', source);
  assert.deepEqual(parsed.errors, []);
  return runtimeModuleEdges(parsed.program);
}
const edge = (specifier, kind = 'static-import', bindings = []) => ({ specifier, bindings, kind });

test('retains runtime bindings, empty evaluations and value reexports, excluding erased edges', () => {
  assert.deepEqual(edges(`
    import type DefaultType from './type-default.js';
    import { type Only } from './type-only.js';
    import Main, { type Hidden, value as localValue } from './mixed.js';
    import * as namespace from './namespace.js';
    import './side-effect.js';
    import {} from './empty.js';
    export type { Gone } from './type-export.js';
    export { type AlsoGone } from './type-export-list.js';
    export type * from './type-star.js';
    export { type Hidden, value } from './value-export.js';
    export {} from './empty-export.js';
    export * from './star.js';
  `), [
    edge('./mixed.js', 'static-import', ['Main', 'localValue']),
    edge('./namespace.js', 'static-import', ['namespace']),
    edge('./side-effect.js'), edge('./empty.js'),
    edge('./value-export.js', 're-export'), edge('./empty-export.js', 're-export'),
    edge('./star.js', 're-export'),
  ]);
});

test('preserves static-first ordering, lazy preorder and repeated edges', () => {
  assert.deepEqual(edges(`
    import('./repeated.js');
    import './repeated.js';
    async function nested() { await import(\`./template.js\`); await import('./repeated.js'); }
    export * from './last-static.js';
  `), [edge('./repeated.js'), edge('./last-static.js', 're-export'),
    edge('./repeated.js', 'dynamic-import'), edge('./template.js', 'dynamic-import'),
    edge('./repeated.js', 'dynamic-import')]);
});

test('ignores computed imports, TypeScript import types and text that resembles code', () => {
  assert.deepEqual(edges(`
    type T = import('./type-query.js').T;
    const example = "import('./example.js')";
    // import('./comment.js')
    import(variable); import(\`./\${variable}.js\`); import('./' + variable);
  `), []);
});
