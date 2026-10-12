import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { sourcePackageExportsPlugin } from './source-package-exports.js';

test('companion runtime imports resolve to the source of their public export', () => {
  const plugin = sourcePackageExportsPlugin();
  const sources = ['editor.ts', 'docx-editor.class.ts', 'admission.ts', 'commands.ts'];
  const imports = new Set(sources.flatMap(name => {
    const source = readFileSync(new URL(`../packages/lyra-docs/src/docx/${name}`, import.meta.url), 'utf8');
    return [...source.matchAll(/['"](@aceshooting\/lyra-ui\/[^'"]+)['"]/g)].map(match => match[1]);
  }));
  assert.ok(imports.size > 15);
  for (const specifier of imports) assert.ok(plugin.resolveId(specifier), specifier);
  assert.equal(plugin.resolveId('@aceshooting/lyra-ui/utils/docx-zip-admission.js'),
    fileURLToPath(new URL('../packages/lyra-ui/src/internal/docx-zip-admission.ts', import.meta.url)));
  assert.equal(plugin.resolveId('@aceshooting/lyra-ui/components/lr-button.js'),
    fileURLToPath(new URL('../packages/lyra-ui/src/components/lr-button.ts', import.meta.url)));
});

test('blocked and nonexistent package routes stay unresolved', () => {
  const plugin = sourcePackageExportsPlugin();
  for (const specifier of ['@aceshooting/lyra-ui/internal/prefix.js',
    '@aceshooting/lyra-ui/utilities/missing.js', '@aceshooting/lyra-ui/src/internal/prefix.ts',
    '@aceshooting/lyra-ui/dist/utilities/prefix.js', 'lit']) {
    assert.equal(plugin.resolveId(specifier), undefined);
  }
});
