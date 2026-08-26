import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatPackageSummary,
  metricsFromPackResult,
  packageBudgetFindings,
  validatePackageBudgets,
} from './check-package-size.mjs';

const budgets = {
  baseline: { packedBytes: 1_000, unpackedBytes: 4_000, fileCount: 40 },
  minimumPackedByteReductionPercent: 25,
  minimumUnpackedByteReductionPercent: 25,
  packedBudgetPolicy: {
    strategy: 'measured-required-artifact-exception',
    exceptionReason: 'required-public-artifacts-exceed-25-percent-target',
    reviewedMeasurementBytes: 880,
    headroomBytes: 4,
    targetAt25PercentBytes: 750,
    favorableIncompletePackageProbeBytes: 800,
  },
  maximum: { packedBytes: 884, unpackedBytes: 3_000, fileCount: 26 },
  fileCountBudget: {
    baseArtifactCeiling: 15,
    stableTagAliasCount: 4,
    emittedFilesPerAlias: 2,
    measuredEntrypointRemainder: 1,
    nextComponentArtifactHeadroom: 2,
    entrypointHeadroom: 3,
  },
};

test('enforces 25% unpacked reduction and an honest measured packed ceiling', () => {
  assert.doesNotThrow(() => validatePackageBudgets(budgets));
  assert.throws(
    () => validatePackageBudgets({ ...budgets, minimumPackedByteReductionPercent: 24 }),
    /must retain the approved 25% target/,
  );
  assert.throws(
    () => validatePackageBudgets({ ...budgets, minimumUnpackedByteReductionPercent: 24 }),
    /must remain the approved 25%/,
  );
  assert.throws(
    () => validatePackageBudgets({
      ...budgets,
      packedBudgetPolicy: { ...budgets.packedBudgetPolicy, strategy: 'ordinary-ceiling' },
    }),
    /must name the reviewed required-artifact exception/,
  );
  assert.throws(
    () => validatePackageBudgets({
      ...budgets,
      packedBudgetPolicy: { ...budgets.packedBudgetPolicy, exceptionReason: 'unspecified' },
    }),
    /must retain its measured infeasibility reason/,
  );
  assert.throws(
    () => validatePackageBudgets({ ...budgets, maximum: { ...budgets.maximum, unpackedBytes: 3_001 } }),
    /must enforce at least a 25% reduction/,
  );
  assert.throws(
    () => validatePackageBudgets({ ...budgets, maximum: { ...budgets.maximum, packedBytes: 885 } }),
    /must equal the reviewed measurement plus tight headroom/,
  );
  assert.throws(
    () => validatePackageBudgets({
      ...budgets,
      packedBudgetPolicy: {
        ...budgets.packedBudgetPolicy,
        favorableIncompletePackageProbeBytes: 750,
      },
    }),
    /must record why 25% is not achievable/,
  );
  assert.throws(
    () => validatePackageBudgets({ ...budgets, maximum: { ...budgets.maximum, fileCount: 27 } }),
    /must match the reviewed stable-alias derivation/,
  );
  assert.throws(
    () => validatePackageBudgets({
      ...budgets,
      fileCountBudget: { ...budgets.fileCountBudget, entrypointHeadroom: 2 },
    }),
    /must include the measured remainder plus next-component allowance/,
  );
});

test('reports byte, file-count, and dangling-map regressions', () => {
  assert.deepEqual(
    packageBudgetFindings(
      {
        packedBytes: 885,
        unpackedBytes: 3_001,
        fileCount: 27,
        files: [
          { path: 'dist/component.js.map' },
          { path: 'dist/component.js' },
          { path: 'src/component.ts' },
        ],
      },
      budgets,
    ),
    [
      'packedBytes 885 exceeds hard budget 884',
      'unpackedBytes 3,001 exceeds hard budget 3,000',
      'fileCount 27 exceeds hard budget 26',
      'published tarball contains 1 dangling JavaScript/declaration map(s)',
      'published tarball contains 1 unnecessary TypeScript source file(s)',
    ],
  );
});

test('labels the measured packed exception instead of implying the 25% target passed', () => {
  const summary = formatPackageSummary(
    { packedBytes: 884, unpackedBytes: 3_000, fileCount: 26, files: [] },
    budgets,
  );
  assert.match(summary, /packed \(11\.6% reduction; reviewed exception to the 25% target\)/);
  assert.match(summary, /unpacked \(25\.0% reduction\)/);
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
