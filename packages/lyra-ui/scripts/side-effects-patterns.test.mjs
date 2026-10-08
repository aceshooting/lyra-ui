import assert from 'node:assert/strict';
import { sideEffectsCover, sideEffectPatternHasSource } from './side-effects-patterns.mjs';

const patterns = new Set([
  './src/translations/**/*.ts',
  './src/components/lr-*.ts',
  './dist/components/lr-*.js',
]);
for (const entry of [
  './src/translations/fr.ts',
  './src/translations/fr/forms.ts',
  './src/components/lr-button.ts',
  './dist/components/lr-button.js',
]) assert.equal(sideEffectsCover(patterns, entry), true, entry);

for (const entry of [
  './src/components/forms/button/button.class.ts',
  './dist/components/forms/button/button.class.js',
  './src/lyra.ts',
  './dist/lyra.js',
  './src/translations/fr.test.ts',
]) assert.equal(sideEffectsCover(patterns, entry), entry === './src/translations/fr.test.ts', entry);

const sourceEntries = [
  './src/translations/fr.ts',
  './src/translations/fr/forms.ts',
  './src/components/lr-button.ts',
];
for (const pattern of patterns) {
  assert.equal(sideEffectPatternHasSource(pattern, sourceEntries), true, pattern);
  assert.equal(sideEffectPatternHasSource(pattern, ['./src/components/forms/button/button.class.ts']), false, pattern);
  assert.equal(sideEffectPatternHasSource(pattern, []), false, pattern);
}

console.log('side-effects pattern coverage test passed.');
