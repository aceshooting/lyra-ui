#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildDesignTokenArtifacts,
  readCanonicalTokens,
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

console.log('canonical design-token schema and artifact tests passed.');
