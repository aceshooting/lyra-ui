import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LOCAL_REDERIVATION_ALLOWLIST,
  checkShippedStylesheets,
  isThemeScopeSelector,
  shadowSheetViolations,
  stylesheetViolations,
} from './check-host-token-declarations.mjs';

const layer = new Set(['--lr-space-m', '--lr-color-surface', '--lr-icon-button-size', '--lr-color-border']);

test('a shadow sheet may declare host-local names, generated preference arms and local glass re-derivation only', () => {
  assert.ok(Object.hasOwn(LOCAL_REDERIVATION_ALLOWLIST, '--lr-color-border'));
  assert.deepEqual(shadowSheetViolations(`
    /* :host { --lr-space-m: 1px } -- prose */
    :host { --lr-icon-button-size: 2rem; --lr-color-border: red }
    @media (forced-colors: active) { :host { --lr-color-surface: Canvas } }
    @media (prefers-reduced-motion: reduce) { :host { --lr-space-m: 0 } }
  `, layer), []);
  assert.deepEqual(shadowSheetViolations(`
    :host { --lr-space-m: 1px }
    @media (forced-colors: active) { [part='x'] { --lr-color-surface: Canvas } }
    @media (min-width: 1px) { :host { --lr-color-surface: red } }
  `, layer, 's'), [
    's: :host declares document-layer name --lr-space-m',
    "s: [part='x'] declares document-layer name --lr-color-surface",
    's: :host declares document-layer name --lr-color-surface',
  ]);
});

test('classifies theme-scope selectors, ignoring negated fragments', () => {
  for (const selector of [
    ':root', 'html', '.lr-dark', "[data-lr-theme='dark']", '[data-lr-theme-scope]', "[data-lr-accent='ruby']",
    ':root:where(:not([data-lr-look]))', ":where(.lr-token-dark, [data-lr-design-token-mode='dark'])",
    ":where([data-lr-look='shadcn']) .dark:not(:where([data-lr-mode], [data-lr-theme], .lr-light, .lr-dark))",
  ]) assert.equal(isThemeScopeSelector(selector), true, selector);
  for (const selector of ['.card', ':host', '.foo:not([data-lr-mode])', '.dark', '[data-lr-look] .panel']) {
    assert.equal(isThemeScopeSelector(selector), false, selector);
  }
});

test('a stylesheet that sets a consumed input outside a scope is reported; preference arms may use :host', () => {
  const consumed = new Set(['--lr-theme-space-m', '--_lr-preference-quiet-color']);
  assert.deepEqual(stylesheetViolations(`
    :root, [data-lr-density='compact'] { --lr-theme-space-m: 1px }
    .card { --lr-theme-other: 1px }
    @media (prefers-contrast: more) { :root, :host { --_lr-preference-quiet-color: currentColor } }
  `, consumed), []);
  assert.deepEqual(stylesheetViolations('.card, :root { --lr-theme-space-m: 1px }', consumed, 'x.css'), [
    'x.css: .card declares --lr-theme-space-m, which the document layer consumes, outside a theme scope',
  ]);
});

test('every shipped stylesheet sets layer-consumed inputs only on theme scopes', () => {
  assert.deepEqual(checkShippedStylesheets(), []);
});
