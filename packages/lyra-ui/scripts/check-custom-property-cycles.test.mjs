#!/usr/bin/env node
// Standalone test for scripts/check-custom-property-cycles.mjs -- plain `node:assert`, not wired
// into the wtr suite (this checker reads source text, it does not render components). Run directly:
// `node scripts/check-custom-property-cycles.test.mjs` (`--verbose` prints the per-case lines).
//
// The two fixtures that matter most are reduced, byte-shape copies of lr-dialog's real close-button
// stylesheet before and after the private-default-tier fix: a detector with only a passing fixture
// proves nothing about whether it can still fire, and a detector that also flags the fixed shape
// would be useless as a regression gate.

import assert from 'node:assert/strict';
import {
  cssTemplateContents,
  customPropertyDeclarations,
  dependencyGraph,
  findCycle,
  findTokenCycle,
  referencedProperties,
} from './check-custom-property-cycles.mjs';

const verbose = process.argv.includes('--verbose');
let failures = 0;
let passes = 0;
function test(name, fn) {
  try {
    fn();
    passes += 1;
    if (verbose) console.log(`ok - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
}

test('extracts only the css`` template contents, dropping surrounding TS comments and imports', () => {
  const fileText = `import { css } from 'lit';

// MASK_OPAQUE -- a translucent shadow theme
// (--lr-theme-color-shadow: rgb(0 0 0 / 0.25)) silently dropped mask alpha, so this token is
// deliberately fixed rather than reading --lr-theme-color-shadow at all;
export const styles = css\`
  :host { --lr-mask-opaque: #000; }
\`;
`;
  const contents = cssTemplateContents(fileText);
  assert.ok(!contents.includes('--lr-theme-color-shadow'), 'the commented-out example must not leak in');
  assert.ok(contents.includes('--lr-mask-opaque'), 'the real declaration must still be captured');
  // The commented-out example must not create a phantom self-referential "declaration" either.
  assert.equal(findTokenCycle(contents), null);
});

test('concatenates more than one css`` template in the same file', () => {
  const fileText = `
    export const a = css\`:host { --a: var(--shared); }\`;
    export const b = css\`:host { --shared: var(--a); }\`;
  `;
  const cycle = findTokenCycle(cssTemplateContents(fileText));
  assert.ok(cycle, 'a cycle split across two templates in the same file is still detected');
});

test('parses a single custom-property declaration', () => {
  const declarations = customPropertyDeclarations(':host { --_lr-x-default: var(--lr-radius); }');
  assert.deepEqual(declarations, [{ name: '--_lr-x-default', value: 'var(--lr-radius)' }]);
});

test('parses a declaration with nested parens (color-mix) without truncating early', () => {
  const declarations = customPropertyDeclarations(`
    :host {
      --_lr-x-active: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
    }
  `);
  assert.equal(declarations.length, 1);
  assert.equal(declarations[0].name, '--_lr-x-active');
  assert.match(declarations[0].value, /^color-mix\(in oklab,.*\)$/);
});

test('ignores custom properties written inside a comment', () => {
  const declarations = customPropertyDeclarations(`
    :host {
      /* --_lr-dead-example: var(--lr-icon-button-background); */
      --_lr-x-default: transparent;
    }
  `);
  assert.deepEqual(declarations, [{ name: '--_lr-x-default', value: 'transparent' }]);
});

test('does not treat an ordinary CSS property\'s var() usage as a declared node', () => {
  const declarations = customPropertyDeclarations(`
    [part~='button'] { background: var(--lr-icon-button-background, transparent); }
  `);
  assert.deepEqual(declarations, []);
});

test('reads every --other-property referenced in a value, including nested fallbacks', () => {
  const refs = referencedProperties(
    'var(--lr-icon-button-color-active, var(--lr-icon-button-color-hover, var(--lr-icon-button-color, inherit)))',
  );
  assert.deepEqual(
    [...refs].sort(),
    ['--lr-icon-button-color', '--lr-icon-button-color-active', '--lr-icon-button-color-hover'].sort(),
  );
});

test('unions edges across multiple declarations of the same name', () => {
  const graph = dependencyGraph([
    { name: '--_lr-x-max-width', value: 'var(--lr-size-32rem)' },
    { name: '--_lr-x-max-width', value: 'var(--lr-size-20rem)' },
  ]);
  assert.deepEqual([...graph.get('--_lr-x-max-width')].sort(), ['--lr-size-20rem', '--lr-size-32rem']);
});

test('finds no cycle in an acyclic graph', () => {
  const graph = new Map([
    ['--a', new Set(['--b'])],
    ['--b', new Set(['--lr-color-brand'])],
  ]);
  assert.equal(findCycle(graph), null);
});

test('finds a direct two-node cycle', () => {
  const graph = new Map([
    ['--a', new Set(['--b'])],
    ['--b', new Set(['--a'])],
  ]);
  const cycle = findCycle(graph);
  assert.ok(cycle, 'a cycle must be reported');
  assert.equal(cycle[0], cycle[cycle.length - 1], 'the cycle path returns to its own start');
});

// -- the real defect shape, reduced to its two load-bearing rules -----------------------------

const BEFORE_FIX_DIALOG_CLOSE_BUTTON = `
  :host {
    --_lr-dialog-close-background: var(--lr-icon-button-background, transparent);
    --_lr-dialog-close-background-hover: var(
      --lr-icon-button-background-hover,
      var(--lr-color-brand-quiet)
    );
  }
  [part~="close-button"] {
    --lr-icon-button-background: var(--_lr-dialog-close-background);
    --lr-icon-button-background-hover: var(--_lr-dialog-close-background-hover);
  }
`;

const AFTER_FIX_DIALOG_CLOSE_BUTTON = `
  :host {
    --_lr-dialog-close-background: transparent;
    --_lr-dialog-close-background-hover: var(--lr-color-brand-quiet);
  }
  [part~="close-button"] {
    --_lr-icon-button-background-default: var(--_lr-dialog-close-background);
    --_lr-icon-button-background-hover-default: var(--_lr-dialog-close-background-hover);
  }
`;

test('flags the pre-fix capture-and-re-declare shape as a cycle', () => {
  const cycle = findTokenCycle(BEFORE_FIX_DIALOG_CLOSE_BUTTON);
  assert.ok(cycle, 'the pre-fix shape must be reported as cyclic');
  assert.ok(
    cycle.includes('--lr-icon-button-background') || cycle.includes('--lr-icon-button-background-hover'),
    'the reported cycle names the looping public token',
  );
});

test('does not flag the post-fix private-default-tier shape', () => {
  assert.equal(findTokenCycle(AFTER_FIX_DIALOG_CLOSE_BUTTON), null);
});

test('does not flag icon-button\'s own existing radius default tier', () => {
  const iconButtonRadius = `
    :host { --_lr-icon-button-radius-default: var(--lr-radius); }
    [part~='button'] {
      border-radius: var(--lr-icon-button-radius, var(--_lr-icon-button-radius-default));
    }
  `;
  assert.equal(findTokenCycle(iconButtonRadius), null);
});

test('a cross-reference to a DIFFERENT public token than the one being defined is not a cycle', () => {
  // --_lr-x-active legitimately mixes from the ambient hover token while resolving its own default
  // -- a real cross-reference, not a self-loop, as long as nothing re-declares that hover token
  // from --_lr-x-active anywhere in the same file.
  const css = `
    :host {
      --_lr-x-active: color-mix(in oklab, var(--lr-icon-button-background-hover, var(--lr-color-brand-quiet)), var(--lr-color-mix-partner) var(--lr-color-mix-active));
    }
    [part~="close-button"] {
      --_lr-icon-button-background-active-default: var(--_lr-x-active);
    }
  `;
  assert.equal(findTokenCycle(css), null);
});

if (failures > 0) {
  console.error(`\n${failures} failing, ${passes} passing`);
  process.exitCode = 1;
} else {
  console.log(`${passes} passing`);
}
