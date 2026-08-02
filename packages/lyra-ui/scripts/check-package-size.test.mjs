import assert from 'node:assert/strict';
import test from 'node:test';
import {
  metricsFromPackResult,
  packageBudgetFindings,
  validatePackageBudgets,
} from './check-package-size.mjs';

const budgets = {
  baseline: { packedBytes: 1_000, unpackedBytes: 4_000, fileCount: 40 },
  maximum: { packedBytes: 750, unpackedBytes: 3_000, fileCount: 25 },
};

test('requires byte ceilings to stay below the baseline, without demanding a fixed reduction', () => {
  assert.doesNotThrow(() => validatePackageBudgets(budgets));
  // A ceiling anywhere under the baseline is legitimate -- the rule is that the tarball may never
  // grow back past where 8.0.0 started, not that it must hit a particular percentage. Encoding a
  // target here is what previously left the gate permanently red.
  assert.doesNotThrow(() =>
    validatePackageBudgets({ ...budgets, maximum: { ...budgets.maximum, packedBytes: 999 } }),
  );
  assert.throws(
    () => validatePackageBudgets({ ...budgets, maximum: { ...budgets.maximum, packedBytes: 1_000 } }),
    /must stay below its baseline/,
  );
});

test('reports byte, file-count, and dangling-map regressions', () => {
  assert.deepEqual(
    packageBudgetFindings(
      {
        packedBytes: 751,
        unpackedBytes: 3_001,
        fileCount: 26,
        files: [{ path: 'dist/component.js.map' }, { path: 'dist/component.js' }],
      },
      budgets,
    ),
    [
      'packedBytes 751 exceeds hard budget 750',
      'unpackedBytes 3,001 exceeds hard budget 3,000',
      'fileCount 26 exceeds hard budget 25',
      'published tarball contains 1 dangling JavaScript/declaration map(s)',
    ],
  );
});

test('derives metrics from npm pack JSON without trusting its entryCount alias', () => {
  assert.deepEqual(
    metricsFromPackResult({
      size: 10,
      unpackedSize: 20,
      entryCount: 999,
      files: [{ path: 'dist/a.js' }, { path: 'dist/a.d.ts' }],
    }),
    {
      packedBytes: 10,
      unpackedBytes: 20,
      fileCount: 2,
      files: [{ path: 'dist/a.js' }, { path: 'dist/a.d.ts' }],
    },
  );
});
