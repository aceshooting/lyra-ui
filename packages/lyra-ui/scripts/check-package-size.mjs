import { isMainModule } from './is-main-module.mjs';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const budgetsPath = join(packageDir, 'scripts', 'package-budgets.json');
const FIXTURE_PATH = /(?:^|\/)fixtures(?:\/|$)/u;
const TEST_PATH = /(?:^|\/)(?:tests?(?:\/|$)|[^/]+\.test(?:\.[^/]+)+$)/u;
const STORY_PATH = /(?:^|\/)(?:stories(?:\/|$)|[^/]+\.stories(?:\.[^/]+)+$)/u;

function percentReduction(baseline, current) {
  return ((baseline - current) / baseline) * 100;
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

function normalizedPackagePath(file) {
  return typeof file?.path === 'string' ? file.path.replaceAll('\\', '/') : '';
}

export function validatePackageBudgets(budgets) {
  assert.equal(
    budgets?.minimumPackedByteReductionPercent,
    25,
    'package budget minimumPackedByteReductionPercent must retain the approved 25% target',
  );
  assert.equal(
    budgets?.minimumUnpackedByteReductionPercent,
    25,
    'package budget minimumUnpackedByteReductionPercent must remain the approved 25%',
  );
  for (const metric of ['packedBytes', 'unpackedBytes', 'fileCount']) {
    assert.ok(Number.isInteger(budgets?.baseline?.[metric]) && budgets.baseline[metric] > 0,
      `package budget baseline.${metric} must be a positive integer`);
    assert.ok(Number.isInteger(budgets?.maximum?.[metric]) && budgets.maximum[metric] > 0,
      `package budget maximum.${metric} must be a positive integer`);
  }
  const reductionFactor = 1 - budgets.minimumUnpackedByteReductionPercent / 100;
  assert.ok(
    budgets.maximum.unpackedBytes <= Math.floor(budgets.baseline.unpackedBytes * reductionFactor),
    'package budget maximum.unpackedBytes must enforce at least a 25% reduction from its baseline',
  );

  const packedBudget = budgets.packedBudgetPolicy;
  assert.equal(
    packedBudget?.strategy,
    'measured-required-artifact-exception',
    'package budget packed strategy must name the reviewed required-artifact exception',
  );
  assert.equal(
    packedBudget?.exceptionReason,
    'required-public-artifacts-exceed-25-percent-target',
    'package budget packed exception must retain its measured infeasibility reason',
  );
  for (const field of [
    'reviewedMeasurementBytes',
    'headroomBytes',
    'targetAt25PercentBytes',
    'favorableIncompletePackageProbeBytes',
  ]) {
    assert.ok(
      Number.isInteger(packedBudget?.[field]) && packedBudget[field] > 0,
      `package budget packedBudgetPolicy.${field} must be a positive integer`,
    );
  }
  const packedTarget = Math.floor(
    budgets.baseline.packedBytes * (1 - budgets.minimumPackedByteReductionPercent / 100),
  );
  assert.equal(
    packedBudget.targetAt25PercentBytes,
    packedTarget,
    'package budget packedBudgetPolicy.targetAt25PercentBytes must match the baseline calculation',
  );
  assert.ok(
    packedBudget.favorableIncompletePackageProbeBytes > packedTarget,
    'package budget packed probe must record why 25% is not achievable before restoring omitted public artifacts',
  );
  assert.ok(
    packedBudget.reviewedMeasurementBytes > packedBudget.favorableIncompletePackageProbeBytes,
    'package budget reviewed packed measurement must exceed the favorable incomplete-package probe',
  );
  assert.ok(
    packedBudget.headroomBytes <= Math.ceil(packedBudget.reviewedMeasurementBytes * 0.005),
    'package budget packed headroom must remain at or below 0.5% of the reviewed measurement',
  );
  assert.equal(
    budgets.maximum.packedBytes,
    packedBudget.reviewedMeasurementBytes + packedBudget.headroomBytes,
    'package budget maximum.packedBytes must equal the reviewed measurement plus tight headroom',
  );
  assert.ok(
    budgets.maximum.packedBytes < budgets.baseline.packedBytes,
    'package budget maximum.packedBytes must remain below the pre-8 baseline',
  );
  const fileBudget = budgets.fileCountBudget;
  for (const field of [
    'baseArtifactCeiling',
    'stableTagAliasCount',
    'emittedFilesPerAlias',
    'measuredEntrypointRemainder',
    'nextComponentArtifactHeadroom',
    'entrypointHeadroom',
  ]) {
    assert.ok(Number.isInteger(fileBudget?.[field]) && fileBudget[field] >= 0,
      `package budget fileCountBudget.${field} must be a non-negative integer`);
  }
  assert.ok(
    fileBudget.nextComponentArtifactHeadroom > 0,
    'package budget fileCountBudget.nextComponentArtifactHeadroom must reserve real scaffold headroom',
  );
  assert.equal(
    fileBudget.entrypointHeadroom,
    fileBudget.measuredEntrypointRemainder + fileBudget.nextComponentArtifactHeadroom,
    'package budget fileCountBudget.entrypointHeadroom must include the measured remainder plus next-component allowance',
  );
  assert.equal(
    budgets.maximum.fileCount,
    fileBudget.baseArtifactCeiling +
      fileBudget.stableTagAliasCount * fileBudget.emittedFilesPerAlias +
      fileBudget.entrypointHeadroom,
    'package budget maximum.fileCount must match the reviewed stable-alias derivation',
  );
  assert.ok(
    budgets.maximum.fileCount < budgets.baseline.fileCount,
    'package budget maximum.fileCount must remain below the pre-8 baseline',
  );
  return budgets;
}

export function packageBudgetFindings(metrics, budgets) {
  validatePackageBudgets(budgets);
  const findings = [];
  const packagePaths = metrics.files.map(normalizedPackagePath);
  for (const metric of ['packedBytes', 'unpackedBytes', 'fileCount']) {
    if (metrics[metric] > budgets.maximum[metric]) {
      findings.push(
        `${metric} ${metrics[metric].toLocaleString('en')} exceeds hard budget ` +
          budgets.maximum[metric].toLocaleString('en'),
      );
    }
  }
  const maps = packagePaths.filter((file) => /(?:\.js|\.d\.ts)\.map$/.test(file));
  if (maps.length > 0) {
    findings.push(`published tarball contains ${maps.length} dangling JavaScript/declaration map(s)`);
  }
  const sources = packagePaths.filter((file) => /^src\/.*\.(?:[cm]?ts|tsx)$/.test(file));
  if (sources.length > 0) {
    findings.push(`published tarball contains ${sources.length} unnecessary TypeScript source file(s)`);
  }
  const fixtures = packagePaths.filter((file) => FIXTURE_PATH.test(file));
  if (fixtures.length > 0) {
    findings.push(`published tarball contains ${fixtures.length} build-only fixture path(s)`);
  }
  const tests = packagePaths.filter((file) => TEST_PATH.test(file));
  if (tests.length > 0) {
    findings.push(`published tarball contains ${tests.length} test path(s)`);
  }
  const stories = packagePaths.filter((file) => STORY_PATH.test(file));
  if (stories.length > 0) {
    findings.push(`published tarball contains ${stories.length} story path(s)`);
  }
  return findings;
}

export function metricsFromPackResult(result) {
  assert.equal(typeof result?.size, 'number', 'npm pack result must report packed size');
  assert.equal(typeof result?.unpackedSize, 'number', 'npm pack result must report unpacked size');
  assert.ok(Array.isArray(result.files), 'npm pack result must report its file inventory');
  return {
    packedBytes: result.size,
    unpackedBytes: result.unpackedSize,
    fileCount: result.files.length,
    files: result.files,
  };
}

export function formatPackageSummary(metrics, budgets) {
  const packedReduction = percentReduction(budgets.baseline.packedBytes, metrics.packedBytes);
  const unpackedReduction = percentReduction(budgets.baseline.unpackedBytes, metrics.unpackedBytes);
  return (
    `package: ${formatBytes(metrics.packedBytes)} packed ` +
    `(${packedReduction.toFixed(1)}% reduction; reviewed exception to the 25% target), ` +
    `${formatBytes(metrics.unpackedBytes)} unpacked (${unpackedReduction.toFixed(1)}% reduction), ` +
    `${metrics.fileCount.toLocaleString('en')} files`
  );
}

function readPackedMetrics() {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const packed = spawnSync(
    npm,
    ['pack', '--dry-run', '--json', '--ignore-scripts'],
    { cwd: packageDir, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  );
  if (packed.status !== 0) {
    throw new Error(`npm pack --dry-run failed:\n${packed.stderr || packed.stdout}`);
  }
  const result = JSON.parse(packed.stdout);
  const packedMetrics = Array.isArray(result)
    ? result
    : typeof result === 'object' && result !== null
      ? Object.values(result)
      : [];
  assert.equal(packedMetrics.length, 1, 'npm pack must report exactly one package');
  return metricsFromPackResult(packedMetrics[0]);
}

function main() {
  const budgets = validatePackageBudgets(JSON.parse(readFileSync(budgetsPath, 'utf8')));
  const metrics = readPackedMetrics();
  const findings = packageBudgetFindings(metrics, budgets);
  const summary = formatPackageSummary(metrics, budgets);
  if (findings.length > 0) {
    console.error(`${summary}\n${findings.join('\n')}`);
    process.exitCode = 1;
    return;
  }
  console.log(`${summary} — within hard package budgets`);
}

if (isMainModule(import.meta.url)) main();
