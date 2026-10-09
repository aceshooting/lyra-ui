import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  DOCUMENT_LAYER_SCOPES,
  DOCUMENT_LAYER_SENTINEL,
  HOST_LOCAL_TOKENS,
  buildDocumentLayerCss,
  buildHostPreferenceCss,
  classifySharedTokens,
  derivedClosure,
  documentLayerIdOf,
  layerConsumedInputs,
  layerDeclarations,
  hostReadInputs,
  validateDocumentLayer,
} from './document-token-layer.mjs';
import { projectDefaultTokenSource, readCanonicalTokens, readLayerOrderStatement } from './generate-design-tokens.mjs';
import { readDeclarations } from './css-declarations.mjs';
import { THEME_SCOPE_VOCABULARY } from './theme-scope-vocabulary.generated.mjs';
import { migrateThemeScopes } from './migration-theme-scopes.mjs';

const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = projectDefaultTokenSource(readCanonicalTokens(packageDir), packageDir);
const layerOrder = readLayerOrderStatement(packageDir);
const layerCss = buildDocumentLayerCss(source, layerOrder);
const read = (relative) => readFileSync(path.join(packageDir, relative), 'utf8');

test('the adopted layer and tokens-root.css are byte-identical, and the runtime module carries it', () => {
  const tokensRoot = read('src/styles/tokens-root.css');
  assert.ok(tokensRoot.endsWith(`\n\n${layerCss}`), 'tokens-root.css ends with the generated layer text');
  const module = read('src/internal/document-tokens.generated.ts');
  const literal = `'${layerCss.replaceAll('\\', '\\\\').replaceAll("'", "\\'").replaceAll('\n', '\\n')}'`;
  assert.ok(module.includes(`export const DOCUMENT_TOKEN_CSS = ${literal};`));
  assert.ok(module.includes(`export const DOCUMENT_TOKEN_LAYER_ID = '${documentLayerIdOf(layerCss)}';`));
});

test('the layer validates: every name it reads is declared, an input, or an allowed private switch', () => {
  assert.deepEqual(validateDocumentLayer(source), []);
});

test('a layer output that reads a host-declared token must be host-local', () => {
  const broken = structuredClone(source);
  broken.tokens['--lr-zz-probe'] = {
    type: 'dimension', group: 'control', scope: 'shared', description: 'probe token for the guard test',
    values: { light: 'var(--lr-form-control-radius)' },
  };
  assert.match(validateDocumentLayer(broken).join('\n'), /--lr-zz-probe: reads host-declared --lr-form-control-radius/);
});

test('the shared tokens partition into layer, host-local, specialist and form-control families', () => {
  const { layer, hostLocal, specialist, formControl } = classifySharedTokens(source);
  assert.deepEqual([...hostLocal].sort(), [...HOST_LOCAL_TOKENS].sort());
  assert.ok(layer.length > 200);
  assert.ok(specialist.every((name) => /^--lr-(?:color-chart-|graph-|terminal-)/.test(name)));
  assert.ok(formControl.every((name) => name.startsWith('--lr-form-control-')));
  for (const name of layer) assert.ok(!hostLocal.includes(name) && !specialist.includes(name));
});

test('the glass companions equal the per-mode record they replace', () => {
  const record = read('src/internal/tokens.styles.ts');
  const darkAt = record.indexOf('/* @media (prefers-color-scheme: dark) */');
  const light = new Map([...record.slice(0, darkAt).matchAll(/^\s*(--_lr-glass-[a-z-]+):\s*(.+);\s*$/gm)].map((match) => [match[1], match[2]]));
  const declarations = layerDeclarations(source);
  for (const [name, value] of light) {
    if (name === '--_lr-glass-dark-anchor') continue;
    // A glass host derives its qualified focus colour itself; a scope-level declaration would be
    // guaranteed-invalid there and would beat the host's own :host rule from the outer tree.
    if (name === '--_lr-glass-qualified-focus-ring-color') {
      assert.equal(declarations.has(name), false, name);
      continue;
    }
    assert.equal(declarations.get(name)?.light, value, name);
  }
});

test('every media-conditioned arm is emitted at the scopes and on the host, with its derived set', () => {
  const scopeArms = new Map();
  for (const declaration of readDeclarations(layerCss)) {
    const media = declaration.atRules.find((prelude) => prelude.startsWith('@media'));
    if (!media || media.includes('prefers-color-scheme')) continue;
    if (!scopeArms.has(media)) scopeArms.set(media, new Set());
    scopeArms.get(media).add(declaration.property);
  }
  const hostArms = new Map();
  for (const declaration of readDeclarations(buildHostPreferenceCss(source))) {
    assert.equal(declaration.selector, ':host');
    const media = declaration.atRules.find((prelude) => prelude.startsWith('@media'));
    if (!hostArms.has(media)) hostArms.set(media, new Set());
    hostArms.get(media).add(declaration.property);
  }
  assert.deepEqual([...scopeArms.keys()].sort(), [...hostArms.keys()].sort());
  const declarations = layerDeclarations(source);
  for (const [media, names] of scopeArms) {
    const host = hostArms.get(media);
    for (const name of names) assert.ok(host.has(name), `${media}: ${name} is missing from the host arm`);
    for (const name of derivedClosure(declarations, [...names])) assert.ok(host.has(name), `${media}: derived ${name} is missing from the host arm`);
  }
  assert.ok(hostArms.get('@media (prefers-reduced-motion:reduce)').has('--lr-transition-interactive'));
  assert.ok(hostArms.get('@media (forced-colors:active)').has('--lr-focus-ring'));
});

test('every scope rule uses the closed scope list, and the forced and reduced arms repeat it', () => {
  const selectors = new Set(readDeclarations(layerCss).filter((declaration) => declaration.property.startsWith('--lr-')).map((declaration) => declaration.selector));
  assert.deepEqual([...selectors], [DOCUMENT_LAYER_SCOPES.join(',')]);
});

test('the input split is generated and disjoint', () => {
  const consumed = layerConsumedInputs(source);
  const hostRead = hostReadInputs(source);
  assert.deepEqual(THEME_SCOPE_VOCABULARY.consumedInputs, consumed);
  assert.deepEqual(hostRead.filter((name) => consumed.includes(name)), []);
  assert.ok(hostRead.includes('--lr-theme-color-chart-1') && hostRead.includes('--lr-theme-icon-button-size'));
});

test('the theme-scopes rule marks inline inputs and feeding outputs, and reports the rest', () => {
  const lit = [
    'html`<div style="--lr-theme-space-m: 1rem"></div>',
    '<section class="lr-dark" style="--lr-theme-space-m: 1rem"></section>',
    '<lr-button style="--lr-transition-fast: 0s"></lr-button>',
    '<span style="--lr-theme-color-chart-1: red"></span>',
    '${rows.map((row) => html`<li style=${styleMap({ "--lr-theme-color-text-normal": row })}></li>`)}`;',
    "el.style.setProperty('--lr-theme-space-m', '1px');",
    'css`.card { --lr-theme-space-m: 1px } :root { --lr-theme-space-l: 1px } .x { --lr-color-border: red }`;',
  ].join('\n');
  const result = migrateThemeScopes(lit, { file: 'fixture.ts' });
  assert.equal(result.changes.length, 3);
  assert.match(result.content, /<div data-lr-theme-scope style=/);
  assert.match(result.content, /<section class="lr-dark" style=/);
  assert.match(result.content, /<lr-button data-lr-theme-scope style="--lr-transition-fast: 0s">/);
  assert.match(result.content, /<span style="--lr-theme-color-chart-1: red">/);
  assert.deepEqual(result.warnings.map((warning) => warning.warningCode).sort(), [
    'THEME_SCOPE_CSS_INPUT_REVIEW',
    'THEME_SCOPE_DYNAMIC_INPUT_REVIEW',
    'THEME_SCOPE_OUTPUT_REVIEW',
    'THEME_SCOPE_REPEATED_REVIEW',
  ]);
  assert.match(migrateThemeScopes('<div style={{ "--lr-theme-space-m": "1rem" }} />', { file: 'a.tsx' }).content, /data-lr-theme-scope=""/);
  assert.equal(migrateThemeScopes(result.content, { file: 'fixture.ts' }).changes.length, 0, 'idempotent');
  const double = migrateThemeScopes('@import "@aceshooting/lyra-ui/theme.css";\n@import "@aceshooting/lyra-ui/tokens-root.css";\n', { file: 'app.css' });
  assert.deepEqual(double.warnings.map((warning) => [warning.warningCode, warning.line]), [['THEME_SCOPE_DOUBLE_LAYER_REVIEW', 2]]);
  assert.deepEqual(migrateThemeScopes('@import "@aceshooting/lyra-ui/tokens-root.css";\n', { file: 'app.css' }).warnings, []);
});

test('theme.css ends with the same layer, so importing it makes the constructed copy unnecessary', () => {
  const theme = read('src/theme.css');
  const body = layerCss.slice(layerCss.indexOf('\n') + 1);
  assert.equal(theme.endsWith(body), true);
  assert.equal(theme.split(DOCUMENT_LAYER_SENTINEL).length, 2, 'one sentinel declaration');
});

test('custom-property cardinality stays within budget on :root and at a neutral scope', async () => {
  const { customPropertyCardinality } = await import('./theme-boundary-lint.mjs');
  const counts = customPropertyCardinality(read('src/theme.css'));
  // Measured for 28.0.0: 1,006 on :root (inherited by every element), 253 at a bare marker (the
  // layer only; the marker is not an input boundary). Raise a budget only with a changeset that
  // explains the growth: these counts drive style cost in every engine.
  const BUDGET = { root: 1030, marker: 260 };
  assert.ok(counts.root <= BUDGET.root, `:root declares ${counts.root} custom properties (budget ${BUDGET.root})`);
  assert.ok(counts.marker <= BUDGET.marker, `a neutral scope declares ${counts.marker} custom properties (budget ${BUDGET.marker})`);
  assert.equal(counts.marker, layerDeclarations(source).size, 'a neutral scope re-derives the document layer and nothing else');
});
