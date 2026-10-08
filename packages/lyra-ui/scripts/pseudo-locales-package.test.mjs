#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveSideEffects } from './generate-side-effects.mjs';
import { sideEffectsCover } from './side-effects-patterns.mjs';

const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
// The real catalogs publish from @aceshooting/lyra-translations; only the pseudo-locales (which need
// private runtime helpers) stay in this package, as exact subpath exports.
assert.equal(pkg.exports?.['./translations/*'], undefined);
for (const name of ['en-XA', 'ar-XB']) {
  assert.equal(pkg.exports[`./translations/pseudo/${name}.js`], `./dist/translations/pseudo/${name}.js`);
}

assert.equal(pkg.exports['./design-tokens.json'], './design-tokens.json');
assert.equal(pkg.exports['./design-tokens.css'], './dist/styles/design-tokens.css');
assert.ok(pkg.files.includes('design-tokens.json'));

const effects = deriveSideEffects(packageDir);
const derivedEffects = new Set(effects);
const publishedEffects = new Set(pkg.sideEffects);
for (const entry of [
  './src/styles/design-tokens.css',
  './dist/styles/design-tokens.css',
  './src/translations/pseudo/en-XA.ts',
  './src/translations/pseudo/ar-XB.ts',
  './dist/translations/pseudo/en-XA.js',
  './dist/translations/pseudo/ar-XB.js',
]) {
  assert.ok(sideEffectsCover(derivedEffects, entry), `${entry} must be retained as an import-time registration`);
  assert.ok(sideEffectsCover(publishedEffects, entry), `${entry} must be published as a package side effect`);
}
console.log('pseudo-locale export and side-effect derivation tests passed.');
