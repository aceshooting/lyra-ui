import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readDeclarations, splitTopLevel } from './css-declarations.mjs';

test('reads declarations with their rule selector and enclosing at-rules', () => {
  const declarations = readDeclarations(`
    @layer a, b;
    :host { --a: 1; color: red !important }
    @media (forced-colors: active) { :host { --b: Canvas } }
    @layer lr-theme { :root, .x { --c: var(--d, 2px); } }
  `);
  assert.deepEqual(declarations.map(({ property, value, important, selector, atRules }) => [property, value, important, selector, atRules]), [
    ['--a', '1', false, ':host', []],
    ['color', 'red', true, ':host', []],
    ['--b', 'Canvas', false, ':host', ['@media (forced-colors: active)']],
    ['--c', 'var(--d, 2px)', false, ':root, .x', ['@layer lr-theme']],
  ]);
});

test('ignores comment prose and keeps strings, empty values and nested parentheses intact', () => {
  const declarations = readDeclarations(`
    /* :host { --lr-space-m: 1px } is prose, not a declaration */
    :host { --e: ; content: '/* not a comment */ ; {'; --f: calc((1px + 2px) * 3) }
  `);
  assert.deepEqual(declarations.map(({ property, value }) => [property, value]), [
    ['--e', ''],
    ['content', "'/* not a comment */ ; {'"],
    ['--f', 'calc((1px + 2px) * 3)'],
  ]);
});

test('splits selector lists only at the top level', () => {
  assert.deepEqual(splitTopLevel(":root, :where(.a, .b) .c, [x='1,2']", ',').map((part) => part.trim()), [
    ':root',
    ':where(.a, .b) .c',
    "[x='1,2']",
  ]);
});
