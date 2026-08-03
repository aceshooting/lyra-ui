#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveSideEffects } from './generate-side-effects.mjs';

const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
const translationPattern = pkg.exports?.['./translations/*'];
const target = typeof translationPattern === 'string' ? translationPattern : translationPattern?.default;

assert.equal(target, './dist/translations/*');
for (const name of ['en-XA', 'ar-XB']) {
  const publicSubpath = `./translations/pseudo/${name}.js`;
  const wildcard = publicSubpath.slice('./translations/'.length);
  assert.equal(target.replaceAll('*', wildcard), `./dist/translations/pseudo/${name}.js`);
  assert.equal(pkg.exports[publicSubpath], `./dist/translations/pseudo/${name}.js`);
}

assert.equal(pkg.exports['./design-tokens.json'], './design-tokens.json');
assert.equal(pkg.exports['./design-tokens.css'], './dist/styles/design-tokens.css');
assert.ok(pkg.files.includes('design-tokens.json'));

const effects = deriveSideEffects(packageDir);
for (const entry of [
  './src/styles/design-tokens.css',
  './dist/styles/design-tokens.css',
  './src/translations/pseudo/en-XA.ts',
  './src/translations/pseudo/ar-XB.ts',
  './dist/translations/pseudo/en-XA.js',
  './dist/translations/pseudo/ar-XB.js',
]) {
  assert.ok(effects.includes(entry), `${entry} must be retained as an import-time registration`);
  assert.ok(pkg.sideEffects.includes(entry), `${entry} must be published as a package side effect`);
}
console.log('pseudo-locale export and side-effect derivation tests passed.');
