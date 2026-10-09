#!/usr/bin/env node
// RFC 0002 gates for the document token layer.
//
// 1. Shadow sheets (built package, every inventory component's composed `elementStyles`): no
//    component or shared shadow sheet declares a document-layer name, except
//      - the host-local names (`HOST_LOCAL_TOKENS`), declared per host on purpose;
//      - the generated preference arms (`:host` inside forced-colors / prefers-contrast /
//        prefers-reduced-motion), which every host carries so an application override cannot
//        defeat the preference inside a component;
//      - the glass re-derivation names below, which a glass surface (and an opaque interior inside
//        one) restates locally against its own translucency.
//    Run after a build: `node scripts/check-host-token-declarations.mjs`.
// 2. Shipped stylesheets (source): every rule that declares an input the layer consumes uses only
//    theme-scope selectors, otherwise the input would not re-derive the layer there. Runs without a
//    build: `node scripts/check-host-token-declarations.mjs --stylesheets`.
//
// Both read CSS structurally (scripts/css-declarations.mjs), so comment prose that names a
// token is never mistaken for a declaration.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from './is-main-module.mjs';
import { readDeclarations, splitTopLevel } from './css-declarations.mjs';
import { isThemeScopeSelector } from './migration-theme-scopes.mjs';
import { projectDefaultTokenSource, readCanonicalTokens } from './generate-design-tokens.mjs';
import {
  CONTRAST_SWITCHES,
  HOST_LOCAL_TOKENS,
  layerConsumedInputs,
  layerDeclarations,
} from './document-token-layer.mjs';

const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** Names a glass surface or an opaque interior re-derives locally, with the reason. */
export const LOCAL_REDERIVATION_ALLOWLIST = Object.freeze({
  '--lr-color-text-quiet': 'glass surfaces qualify quiet text against their own translucency',
  '--lr-color-border': 'glass surfaces qualify borders; opaque interiors restore the original',
  '--lr-color-border-strong': 'glass surfaces qualify borders; opaque interiors restore the original',
  '--lr-focus-ring-color': 'glass hosts and the clear media toolbar restate the ring colour locally',
  '--lr-focus-ring': 'restated wherever --lr-focus-ring-color is, so the shorthand follows it',
  '--_lr-glass-qualified-text-quiet': 'glass surface qualification',
  '--_lr-glass-qualified-border': 'glass surface qualification',
  '--_lr-glass-qualified-border-strong': 'glass surface qualification',
  '--_lr-glass-qualified-focus-ring-color': 'glass host qualification',
  '--_lr-glass-brand-text': 'glass surface qualification',
  '--_lr-glass-danger-text': 'glass surface qualification',
});

const ARM_PRELUDES = new Set([
  '@media(forced-colors:active)',
  '@media(prefers-contrast:more)',
  '@media(prefers-reduced-motion:reduce)',
]);
const normalizePrelude = (prelude) => prelude.replace(/\s+/g, '');

function layerModel() {
  const source = projectDefaultTokenSource(readCanonicalTokens(packageDir), packageDir);
  const layerNames = new Set(layerDeclarations(source).keys());
  const consumed = new Set([
    ...layerConsumedInputs(source),
    ...CONTRAST_SWITCHES.map(([name]) => name),
    '--_lr-motion-duration',
    '--_lr-motion-easing',
    '--_lr-motion-transition',
    '--_lr-subtle-mix',
    '--_lr-dark-on',
    '--_lr-light-on',
  ]);
  return { layerNames, consumed };
}

export { isThemeScopeSelector };

/** Violations in one shadow sheet's CSS text. */
export function shadowSheetViolations(css, layerNames, label = 'sheet') {
  const violations = [];
  for (const declaration of readDeclarations(css)) {
    if (!layerNames.has(declaration.property) || HOST_LOCAL_TOKENS.includes(declaration.property)) continue;
    const inArm = declaration.selector === ':host' &&
      declaration.atRules.some((prelude) => ARM_PRELUDES.has(normalizePrelude(prelude)));
    if (inArm || Object.hasOwn(LOCAL_REDERIVATION_ALLOWLIST, declaration.property)) continue;
    violations.push(`${label}: ${declaration.selector || '(at-rule)'} declares document-layer name ${declaration.property}`);
  }
  return violations;
}

/** Violations in one shipped stylesheet's text. */
export function stylesheetViolations(css, consumed, label = 'stylesheet') {
  const violations = [];
  for (const declaration of readDeclarations(css)) {
    if (!consumed.has(declaration.property) || !declaration.selector) continue;
    const inArm = declaration.atRules.some((prelude) => ARM_PRELUDES.has(normalizePrelude(prelude)));
    for (const selector of splitTopLevel(declaration.selector, ',')) {
      if (isThemeScopeSelector(selector)) continue;
      // Preference arms may also set their switches on an author shadow root's :host: every host
      // carries the same arm, so nothing below it needs the layer to re-derive.
      if (inArm && selector.trim() === ':host') continue;
      violations.push(`${label}: ${selector.trim()} declares ${declaration.property}, which the document layer consumes, outside a theme scope`);
    }
  }
  return violations;
}

const SHIPPED_STYLESHEETS = [
  'src/theme.css',
  'src/density.css',
  'src/accents.css',
  'src/preferences.css',
  'src/surfaces/glass.css',
  'src/styles/design-tokens.css',
  'src/styles/native.css',
  'src/styles/reservations.css',
  'src/styles/utilities.css',
  ...readdirSync(path.join(packageDir, 'src', 'looks')).filter((file) => file.endsWith('.css')).map((file) => `src/looks/${file}`),
];

export function checkShippedStylesheets() {
  const { consumed } = layerModel();
  return SHIPPED_STYLESHEETS.flatMap((relative) =>
    stylesheetViolations(readFileSync(path.join(packageDir, relative), 'utf8'), consumed, relative));
}

async function checkShadowSheets() {
  const { layerNames } = layerModel();
  const { loadSsrFixtureContext } = await import('./ssr-fixture.mjs');
  const { inventory } = await loadSsrFixtureContext();
  const seen = new Map();
  for (const { tag } of inventory.components) {
    const ctor = customElements.get(tag);
    if (!ctor) throw new Error(`${tag} is not registered after importing its registration entry`);
    for (const style of ctor.elementStyles ?? []) {
      const text = style.cssText ?? '';
      if (!seen.has(text)) seen.set(text, tag);
    }
  }
  if (seen.size === 0) throw new Error('no component styles were collected');
  return [...seen].flatMap(([text, tag]) => shadowSheetViolations(text, layerNames, `<${tag}> sheet`));
}

if (isMainModule(import.meta.url)) {
  const stylesheetsOnly = process.argv.includes('--stylesheets');
  const violations = [
    ...checkShippedStylesheets(),
    ...(stylesheetsOnly ? [] : await checkShadowSheets()),
  ];
  if (violations.length) {
    console.error(`Document token layer declarations are out of place:\n- ${violations.join('\n- ')}`);
    process.exitCode = 1;
  } else {
    console.log(stylesheetsOnly
      ? 'Shipped stylesheets set layer-consumed inputs only on theme scopes.'
      : 'Shadow sheets declare no document-layer name outside the host-local set and preference arms; shipped stylesheets set layer-consumed inputs only on theme scopes.');
  }
}
