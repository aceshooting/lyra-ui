import assert from 'node:assert/strict';
import test from 'node:test';
import { LOCALIZATION_CATALOG_CHECKS, runLocalizationCatalogChecks } from './check-localization-catalogs.mjs';

test('runs every localization catalog check and fails if any one fails', async () => {
  const ran = [];
  const status = await runLocalizationCatalogChecks([
    ['first', async () => { ran.push('first'); return 1; }],
    ['second', async () => { ran.push('second'); throw new Error('boom'); }],
    ['third', async () => { ran.push('third'); return 0; }],
  ]);
  assert.equal(status, 1);
  assert.deepEqual(ran, ['first', 'second', 'third'], 'a failure never hides the checks after it');
  assert.equal(await runLocalizationCatalogChecks([['only', async () => 0]]), 0);
});

test('covers exactly the four catalog gates it replaces in contract-policy', () => {
  assert.deepEqual(
    LOCALIZATION_CATALOG_CHECKS.map(([name]) => name),
    ['default-string slices', 'translation slices', 'translation catalogs', 'translation catalog sizes'],
  );
});
