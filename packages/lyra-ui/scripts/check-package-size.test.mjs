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
  minimumByteReductionPercent: 25,
  fileCountBudget: {
    baseArtifactCeiling: 15,
    stableTagAliasCount: 4,
    emittedFilesPerAlias: 2,
    entrypointHeadroom: 2,
  },
};

test('requires byte ceilings to enforce the approved minimum reduction', () => {
  assert.doesNotThrow(() => validatePackageBudgets(budgets));
  assert.throws(
    () => validatePackageBudgets({ ...budgets, maximum: { ...budgets.maximum, packedBytes: 751 } }),
    /must enforce at least a 25% reduction/,
  );
  assert.throws(
    () => validatePackageBudgets({ ...budgets, maximum: { ...budgets.maximum, fileCount: 26 } }),
    /must match the reviewed stable-alias derivation/,
  );
});

test('reports byte, file-count, and dangling-map regressions', () => {
  assert.deepEqual(
    packageBudgetFindings(
      {
        packedBytes: 751,
        unpackedBytes: 3_001,
        fileCount: 26,
        files: [
          { path: 'dist/component.js.map' },
          { path: 'dist/component.js' },
          { path: 'src/component.ts' },
        ],
      },
      budgets,
    ),
    [
      'packedBytes 751 exceeds hard budget 750',
      'unpackedBytes 3,001 exceeds hard budget 3,000',
      'fileCount 26 exceeds hard budget 25',
      'published tarball contains 1 dangling JavaScript/declaration map(s)',
      'published tarball contains 1 unnecessary TypeScript source file(s)',
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
