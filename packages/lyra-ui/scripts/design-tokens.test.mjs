#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildDesignTokenArtifacts,
  buildLookInterchange,
  readCanonicalTokens,
  readLayerOrderStatement,
  validateCanonicalTokens,
  verifyRuntimeTokenParity,
} from './generate-design-tokens.mjs';

const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = readCanonicalTokens(packageDir);

assert.deepEqual(validateCanonicalTokens(source), []);
assert.equal(source.schemaVersion, 1);
assert.equal(source.valueNamedTokenPolicy.frozenCount, 89);
assert.ok(Object.keys(source.tokens).length >= 300, 'the canonical source must cover every shared token');
assert.deepEqual(verifyRuntimeTokenParity(source, packageDir), []);

const valueNamed = Object.entries(source.tokens).filter(([name]) => /^--lr-size-/.test(name));
assert.equal(valueNamed.length, 89);
for (const [name, token] of valueNamed) {
  assert.ok(
    ['semantic-global', 'component-role', 'audited-fixed-geometry'].includes(token.valueNameClassification),
    `${name} needs a recognized value-name classification`,
  );
  assert.equal(token.compatibility?.name, name, `${name} must remain a compatibility name`);
  assert.ok(token.evidence?.length, `${name} needs checked-in call-site evidence`);
}

const invalid = structuredClone(source);
invalid.tokens['--lr-size-999rem'] = {
  type: 'dimension',
  group: 'size',
  description: 'Unclassified value token.',
  values: { light: '999rem' },
};
assert.ok(validateCanonicalTokens(invalid).some((error) => error.includes('--lr-size-999rem')));

const first = buildDesignTokenArtifacts(source, packageDir);
const second = buildDesignTokenArtifacts(source, packageDir);
assert.deepEqual(first, second, 'generation must be deterministic');

const bySuffix = (suffix) => {
  const match = first.find(([file]) => file.endsWith(suffix));
  assert.ok(match, `missing generated ${suffix}`);
  return match[1];
};

const dtcg = JSON.parse(bySuffix('/design-tokens.json'));
assert.equal(
  bySuffix('/design-tokens.json'),
  `${JSON.stringify(dtcg)}\n`,
  'the published DTCG artifact remains deterministically compact',
);
assert.equal(dtcg.$extensions['com.aceshooting.lyra'].schemaVersion, 1);
assert.equal(dtcg.theme.color.surface.default.$type, 'color');
assert.deepEqual(dtcg.theme.color.surface.default.$value, {
  colorSpace: 'srgb',
  components: [1, 1, 1],
  alpha: 1,
  hex: '#ffffff',
});
assert.ok(dtcg.theme.color.surface.default.$extensions['com.aceshooting.lyra.modes'].dark);

const lookInterchange = dtcg.$extensions['com.aceshooting.lyra.looks'];
assert.equal(lookInterchange.schemaVersion, 1);
assert.equal(lookInterchange.base, 'lyra');
assert.deepEqual(lookInterchange.definitions.lyra, { id: 'lyra', tokens: {} });
assert.deepEqual(Object.keys(lookInterchange.definitions), ['lyra', 'data', 'high-contrast', 'material', 'shadcn', 'terminal']);
for (const id of Object.keys(lookInterchange.definitions).filter(id => id !== 'lyra')) {
  const authored = JSON.parse(readFileSync(path.join(packageDir, 'tokens', 'looks', `${id}.json`), 'utf8'));
  assert.deepEqual(lookInterchange.definitions[id], { id, tokens: authored.tokens });
}
const sparseLook = { id: 'sparse', tokens: {
  '--lr-theme-color-text-normal': { light: null, dark: '#eeeeee' },
  '--lr-theme-color-text-quiet': { light: '#444444' },
} };
assert.deepEqual(buildLookInterchange([sparseLook]).definitions.sparse, sparseLook);
assert.equal(JSON.stringify(buildLookInterchange([
  { id: 'zebra', tokens: {} }, sparseLook,
])), JSON.stringify(buildLookInterchange([
  sparseLook, { id: 'zebra', tokens: {} },
])), 'look order cannot change the generated interchange');
assert.throws(() => buildLookInterchange([sparseLook, sparseLook]), /Duplicate or reserved/);
assert.throws(() => buildLookInterchange([{ id: 'lyra', tokens: {} }]), /Duplicate or reserved/);
assert.throws(() => buildLookInterchange([{ id: 'unsafe', tokens: { '--lr-theme-color-focus': 'red; color: blue' } }]));
assert.throws(() => buildLookInterchange([{ id: 'surface', tokens: { '--lr-theme-surface-opacity': '0.2' } }]));
assert.throws(() => buildLookInterchange([{ id: 'empty', tokens: { '--lr-theme-color-focus': { light: null, dark: null } } }]));
const optionInterchange = dtcg.$extensions['com.aceshooting.lyra.options'];
assert.equal(optionInterchange.schemaVersion, 1);
assert.deepEqual(Object.keys(optionInterchange.presets), ['elevation', 'shape', 'typography']);
for (const kind of ['shape', 'typography', 'elevation']) {
  const authored = JSON.parse(readFileSync(path.join(packageDir, 'tokens', 'options', `${kind}.json`), 'utf8'));
  assert.deepEqual(optionInterchange.presets[kind], authored.presets);
}

const css = bySuffix('/src/styles/design-tokens.css');
assert.match(css, /\[data-lr-design-token-mode='light'\]/);
assert.match(css, /\[data-lr-design-token-mode='dark'\]/);
assert.match(css, /--lr-theme-color-surface-default:\s*#ffffff/);

const preview = bySuffix('/.storybook/token-preview.generated.js');
assert.match(preview, /export const LYRA_TOKEN_PREVIEW_GROUPS/);
assert.match(preview, /--lr-color-brand/);

const docs = JSON.parse(bySuffix('/scripts/fixtures/token-docs.generated.json'));
const editor = JSON.parse(bySuffix('/scripts/fixtures/token-editor.generated.json'));
assert.equal(docs.schemaVersion, 1);
assert.ok(docs.tokens.some((token) => token.name === '--lr-color-surface'));
assert.ok(editor.properties.some((property) => property.name === '--lr-theme-color-surface-default'));
// llms/tokens.md (build-llms.mjs's buildTokens()) never reads a token's `description`, so it is
// dropped from this fixture rather than duplicating canonical-tokens.json's boilerplate prose into
// an artifact nothing consumes; every other field a shared token needs still round-trips.
assert.ok(docs.tokens.every((token) => !('description' in token)));
const surfaceDocsToken = docs.tokens.find((token) => token.name === '--lr-color-surface');
assert.equal(surfaceDocsToken.scope, 'shared');
assert.equal(typeof surfaceDocsToken.values.light, 'string');
// token-editor.generated.json feeds the VS Code/JetBrains CSS-property hover
// (design-token-editor.mjs), which does render `description` as prose, so it is kept there.
// Compare against the checked-in fixture rather than a second hard-coded copy of the wording —
// design-token-editor.test.mjs already pins that literal sentence, and this assertion only needs
// to prove the generator left that consumer's output untouched, not lock the prose here too.
const persistedEditor = JSON.parse(
  readFileSync(path.join(packageDir, 'scripts', 'fixtures', 'token-editor.generated.json'), 'utf8'),
);
assert.equal(
  editor.properties.find((property) => property.name === '--lr-theme-color-surface-default').description,
  persistedEditor.properties.find((property) => property.name === '--lr-theme-color-surface-default').description,
);

// tokens-root.css repeats theme.css's cascade-layer order statement verbatim. Layer order is fixed
// by FIRST appearance, so if tokens-root.css loaded first with a shorter list, every layer only
// theme.css names would be appended AFTER lr-overrides instead of in its declared slot.
const themeLayerOrder = /^@layer lr-base\b[^;{]*;/m.exec(
  readFileSync(path.join(packageDir, 'src', 'theme.css'), 'utf8'),
)?.[0];
assert.ok(themeLayerOrder, 'theme.css must declare the Lyra cascade-layer order');
assert.equal(readLayerOrderStatement(packageDir), themeLayerOrder);
assert.ok(
  bySuffix('/src/styles/tokens-root.css').includes(`\n${themeLayerOrder}\n`),
  'tokens-root.css must repeat theme.css\'s layer order statement exactly',
);
assert.ok(
  bySuffix('/src/styles/design-tokens.css').includes(`\n${themeLayerOrder}\n`),
  'design-tokens.css must repeat theme.css\'s layer order statement exactly',
);
assert.ok(
  bySuffix('/src/styles/tokens-root.css').includes('--lr-color-border-subtle: var(--_lr-preference-control-color, var(--lr-theme-color-surface-border-subtle, var(--lr-color-border)));'),
  'the decorative border tier is published at document scope, still derived from --lr-color-border',
);

// Every layered CSS asset Lyra ships carries the identical statement, exactly once, ahead of any
// layer block. Any of them may be the first Lyra stylesheet a page loads, and the first statement
// seen fixes the order for the whole document: a copy that names fewer layers (or names them in a
// different order) appends the missing ones after its own, so lr-theme-preset could land above an
// application's lr-overrides, or lr-base above lr-theme. Read from disk, so a hand-edited or stale
// generated copy fails here as well as in check:design-tokens.
const stripCssComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '');
// Every `@layer ...;` statement (a single name orders a layer just as much as a list does), with its
// offset in the comment-free text so its position is checked however the statement is wrapped.
const layerOrderStatementMatches = (code) =>
  [...code.matchAll(/@layer\s+[a-z0-9-]+(?:\s*,\s*[a-z0-9-]+)*\s*;/g)].map((match) => ({
    statement: match[0].replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ').replace(/\s*;$/, ';'),
    index: match.index,
  }));
const layerOrderStatements = (text) =>
  layerOrderStatementMatches(stripCssComments(text)).map(({ statement }) => statement);
const lookAssets = readdirSync(path.join(packageDir, 'src', 'looks'))
  .filter((name) => name.endsWith('.css'))
  .sort()
  .map((name) => path.join('src', 'looks', name));
const layeredAssets = [
  path.join('src', 'theme.css'),
  path.join('src', 'preferences.css'),
  path.join('src', 'styles', 'native.css'),
  path.join('src', 'styles', 'utilities.css'),
  path.join('src', 'styles', 'tokens-root.css'),
  path.join('src', 'styles', 'design-tokens.css'),
  ...lookAssets,
];
const layerOrderMismatches = [];
for (const relative of layeredAssets) {
  const code = stripCssComments(readFileSync(path.join(packageDir, relative), 'utf8'));
  const matches = layerOrderStatementMatches(code);
  const statements = matches.map(({ statement }) => statement);
  const firstBlock = code.search(/@layer\s+[a-z0-9-]+\s*\{/);
  if (statements.length !== 1 || statements[0] !== themeLayerOrder) {
    layerOrderMismatches.push(`${relative}: ${statements.join(' | ') || '(no ordering statement)'}`);
  } else if (firstBlock !== -1 && matches[0].index > firstBlock) {
    layerOrderMismatches.push(`${relative}: the ordering statement follows a @layer block`);
  }
}
assert.deepEqual(layerOrderMismatches, [], 'every layered Lyra stylesheet must declare theme.css\'s layer order verbatim');
// The Storybook preview declares the full consumer order (a layered reset's theme/base before
// Lyra's layers, docs-authoring utilities after lr-utilities) as the very first stylesheet it
// imports. Its lr-* names must be theme.css's names in theme.css's order, or the docs site renders
// a cascade no consumer gets.
const storybookDir = path.join(packageDir, '..', '..', '.storybook');
const lyraLayerNames = (statement) =>
  statement.replace(/^@layer\s+/, '').replace(/;$/, '').split(/\s*,\s*/).filter((name) => name.startsWith('lr-'));
const previewLayerStatements = layerOrderStatements(readFileSync(path.join(storybookDir, 'layer-order.css'), 'utf8'));
assert.equal(previewLayerStatements.length, 1, '.storybook/layer-order.css must hold exactly one @layer statement');
assert.deepEqual(
  lyraLayerNames(previewLayerStatements[0]),
  lyraLayerNames(themeLayerOrder),
  '.storybook/layer-order.css must name the lr-* layers exactly as theme.css orders them',
);
const firstPreviewStylesheet = /^\s*import\s+['"]([^'"]+\.css(?:\?[^'"]*)?)['"]/m.exec(
  readFileSync(path.join(storybookDir, 'preview.js'), 'utf8').replace(/^\s*\/\/.*$/gm, ''),
)?.[1];
assert.equal(firstPreviewStylesheet, './layer-order.css', '.storybook/preview.js must import layer-order.css before any other stylesheet');
assert.deepEqual(lyraLayerNames('@layer theme, base, lr-b, components, lr-a;'), ['lr-b', 'lr-a']);

// The helper is not vacuous: a stale four-name copy is reported as one, and prose never counts.
assert.deepEqual(layerOrderStatements('/* @layer a, b; */\n@layer lr-base, lr-theme, lr-utilities, lr-overrides;'), [
  '@layer lr-base, lr-theme, lr-utilities, lr-overrides;',
]);
// A lone single-name statement is an ordering statement too, and a wrapped statement keeps its offset.
assert.deepEqual(layerOrderStatements('@layer lr-theme;\n@layer lr-base, lr-theme;'), ['@layer lr-theme;', '@layer lr-base, lr-theme;']);
assert.deepEqual(
  layerOrderStatementMatches('@layer lr-theme { }\n@layer lr-base,\n  lr-theme;').map(({ statement, index }) => [statement, index]),
  [['@layer lr-base, lr-theme;', 20]],
);

const layerFixture = mkdtempSync(path.join(tmpdir(), 'lyra-layer-order-'));
try {
  mkdirSync(path.join(layerFixture, 'src'), { recursive: true });
  mkdirSync(path.join(layerFixture, 'tokens', 'looks'), { recursive: true });
  // Optional per-mode presets use the resolvers contributed by these built-in looks.
  for (const file of readdirSync(path.join(packageDir, 'tokens', 'looks')).filter(file => file.endsWith('.json'))) {
    writeFileSync(path.join(layerFixture, 'tokens', 'looks', file), readFileSync(path.join(packageDir, 'tokens', 'looks', file)));
  }
  writeFileSync(path.join(layerFixture, 'tokens', 'looks', 'sparse.json'), JSON.stringify(sparseLook));
  writeFileSync(path.join(layerFixture, 'tokens', 'canonical-tokens.json'), JSON.stringify(source));
  mkdirSync(path.join(layerFixture, 'tokens', 'options'), { recursive: true });
  for (const kind of ['shape', 'typography', 'elevation']) {
    writeFileSync(path.join(layerFixture, 'tokens', 'options', `${kind}.json`),
      readFileSync(path.join(packageDir, 'tokens', 'options', `${kind}.json`)));
  }
  const widened = '@layer lr-base, lr-theme, lr-theme-extra, lr-utilities, lr-overrides;';
  writeFileSync(
    path.join(layerFixture, 'src', 'theme.css'),
    `/* Prose that names the statement is not the statement:\n@layer lr-base, lr-theme;\n*/\n${widened}\n`,
  );
  assert.equal(readLayerOrderStatement(layerFixture), widened);
  const fixtureRoot = buildDesignTokenArtifacts(source, layerFixture).find(([file]) =>
    file.endsWith(`${path.sep}tokens-root.css`),
  )?.[1];
  assert.ok(fixtureRoot?.includes(`\n${widened}\n`), 'a widened theme.css layer order must flow into tokens-root.css');
  const fixtureModes = buildDesignTokenArtifacts(source, layerFixture).find(([file]) =>
    file.endsWith(`${path.sep}design-tokens.css`),
  )?.[1];
  assert.ok(fixtureModes?.includes(`\n${widened}\n`), 'a widened theme.css layer order must flow into design-tokens.css');
  writeFileSync(path.join(layerFixture, 'tokens', 'looks', 'wrong.json'), JSON.stringify(sparseLook));
  assert.throws(() => buildDesignTokenArtifacts(source, layerFixture), /Look id must match its source filename/);
  rmSync(path.join(layerFixture, 'tokens', 'looks', 'wrong.json'));
  writeFileSync(path.join(layerFixture, 'src', 'theme.css'), ':root { --lr-theme-x: 1px; }\n');
  assert.throws(() => readLayerOrderStatement(layerFixture), /layer order/);
} finally {
  rmSync(layerFixture, { recursive: true, force: true });
}

console.log('canonical design-token schema and artifact tests passed.');
