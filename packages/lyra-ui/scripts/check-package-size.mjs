import { isMainModule } from './is-main-module.mjs';

import assert from 'node:assert/strict';
import { lstatSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const budgetsPath = join(packageDir, 'scripts', 'package-budgets.json');
const FIXTURE_PATH = /(?:^|\/)fixtures(?:\/|$)/u;
const REQUIRED_TARBALL_FILES = Object.freeze([
  'custom-elements.json',
  'llms.txt',
  'llms/index.md',
  'llms/shared.md',
  'llms/tokens.md',
  'llms/peers.md',
  'llms/migration.md',
  'llms/components/lr-table.md',
]);
const REPOSITORY_ONLY_TARBALL_FILES = Object.freeze(['llms-full.txt']);
// The trailing segment is matched with a single unbounded class after the literal marker rather
// than `[^/]+(?:\.[^/]+)+$`: those two quantifiers can both consume the same dots, so a path like
// `a.test.` followed by many `..` backtracks exponentially (CodeQL js/redos). One class each side
// of the literal is linear and, since `[^/]` already admits dots, matches exactly the same paths.
const TEST_PATH = /(?:^|\/)(?:tests?(?:\/|$)|[^/]*\.test\.[^/]+$)/u;
const STORY_PATH = /(?:^|\/)(?:stories(?:\/|$)|[^/]*\.stories\.[^/]+$)/u;

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
  const unpackedTarget = Math.floor(budgets.baseline.unpackedBytes * reductionFactor);
  const unpackedBudget = budgets.unpackedBudgetPolicy;
  if (unpackedBudget === undefined) {
    assert.ok(
      budgets.maximum.unpackedBytes <= unpackedTarget,
      'package budget maximum.unpackedBytes must enforce at least a 25% reduction from its baseline',
    );
  } else {
    // The unpacked exception applies only while the complete required package exceeds its
    // reduction target, bound to an exact reviewed measurement with tight headroom.
    assert.equal(
      unpackedBudget.strategy,
      'measured-required-artifact-exception',
      'package budget unpacked strategy must name the reviewed required-artifact exception',
    );
    assert.equal(
      unpackedBudget.exceptionReason,
      'required-public-artifacts-exceed-25-percent-target',
      'package budget unpacked exception must retain its measured infeasibility reason',
    );
    for (const field of ['reviewedMeasurementBytes', 'headroomBytes', 'targetAt25PercentBytes']) {
      assert.ok(
        Number.isInteger(unpackedBudget[field]) && unpackedBudget[field] > 0,
        `package budget unpackedBudgetPolicy.${field} must be a positive integer`,
      );
    }
    assert.equal(
      unpackedBudget.targetAt25PercentBytes,
      unpackedTarget,
      'package budget unpackedBudgetPolicy.targetAt25PercentBytes must match the baseline calculation',
    );
    assert.ok(
      unpackedBudget.reviewedMeasurementBytes > unpackedTarget,
      'package budget unpacked exception is only allowed while the reviewed measurement exceeds the 25% target',
    );
    assert.ok(
      unpackedBudget.headroomBytes <= Math.ceil(unpackedBudget.reviewedMeasurementBytes * 0.005),
      'package budget unpacked headroom must remain at or below 0.5% of the reviewed measurement',
    );
    assert.equal(
      budgets.maximum.unpackedBytes,
      unpackedBudget.reviewedMeasurementBytes + unpackedBudget.headroomBytes,
      'package budget maximum.unpackedBytes must equal the reviewed measurement plus tight headroom',
    );
    // The unpacked ceiling may pass the pre-8 baseline only through a named
    // maintainer review bound to its own byte ceiling (21.2.0: deprecated-alias metadata that
    // 23.0.0 removes).
    if (budgets.maximum.unpackedBytes >= budgets.baseline.unpackedBytes) {
      const review = unpackedBudget.baselineExceptionReview;
      assert.ok(
        typeof review?.approvedBy === 'string' &&
          review.approvedBy.length > 0 &&
          typeof review?.approvedOn === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test(review.approvedOn) &&
          typeof review?.reason === 'string' &&
          review.reason.length >= 40 &&
          Number.isInteger(review?.approvedMaximumUnpackedBytes),
        'package budget maximum.unpackedBytes at or above the pre-8 baseline requires unpackedBudgetPolicy.baselineExceptionReview with approvedBy, approvedOn, a substantive reason and an approvedMaximumUnpackedBytes ceiling',
      );
      assert.ok(
        budgets.maximum.unpackedBytes <= review.approvedMaximumUnpackedBytes,
        'package budget maximum.unpackedBytes must stay at or below the approved baseline-exception ceiling',
      );
    }
  }

  const packedBudget = budgets.packedBudgetPolicy;
  assert.equal(
    packedBudget?.strategy,
    'absolute-download-ceiling',
    'package budget packed strategy must enforce the absolute compressed download ceiling',
  );
  assert.equal(
    packedBudget?.exclusiveMaximumBytes,
    10_000_000,
    'package budget packed limit must remain strictly below 10,000,000 bytes (10 MB decimal)',
  );
  assert.equal(
    budgets.maximum.packedBytes,
    packedBudget.exclusiveMaximumBytes - 1,
    'package budget maximum.packedBytes must enforce the exclusive download limit',
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
  const packagedFiles = new Set(packagePaths);
  for (const requiredFile of REQUIRED_TARBALL_FILES) {
    if (!packagedFiles.has(requiredFile)) {
      findings.push(`published tarball is missing required file: ${requiredFile}`);
    }
  }
  for (const repositoryOnlyFile of REPOSITORY_ONLY_TARBALL_FILES) {
    if (packagedFiles.has(repositoryOnlyFile)) {
      findings.push(
        `published tarball contains repository-only archive: ${repositoryOnlyFile}`,
      );
    }
  }
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
    measurement: 'estimate',
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
    `package: ${formatBytes(metrics.packedBytes)} packed ${metrics.measurement === 'archive' ? 'archive' : 'estimate'} ` +
    `(${packedReduction.toFixed(1)}% reduction from historical baseline; download limit <10 MB decimal), ` +
    `${formatBytes(metrics.unpackedBytes)} unpacked (${unpackedReduction.toFixed(1)}% reduction` +
    `${budgets.unpackedBudgetPolicy ? '; reviewed exception to the 25% target' : ''}), ` +
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

export function parsePackageSizeArguments(args) {
  if (args.length === 0) return {};
  if (args.length !== 2 || args[0] !== '--tarball' ||
      typeof args[1] !== 'string' || !args[1].trim() || args[1].startsWith('--') ||
      /[\u0000\r\n]/u.test(args[1])) {
    throw new TypeError('Usage: check-package-size.mjs [--tarball <archive.tgz>]');
  }
  return { tarball: args[1] };
}

/** Inspect the already-produced archive; its download size is never inferred from a dry run. */
export async function readTarballMetrics(tarball, expectedPackage = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'))) {
  const file = resolve(tarball);
  const metadata = lstatSync(file);
  if (!metadata.isFile()) throw new TypeError('Package tarball must be a regular file.');
  if (metadata.size >= 10_000_000) {
    throw new Error(`packedBytes ${metadata.size.toLocaleString('en')} exceeds hard budget 9,999,999`);
  }
  const bytes = readFileSync(file);
  assert.equal(bytes.length, metadata.size, 'Package tarball changed while being measured.');
  const { inspectPeerTarballArchive } = await import('../../../scripts/check-peer-compatibility.mjs');
  const archive = inspectPeerTarballArchive(bytes, { expectedPackage });
  return {
    measurement: 'archive',
    packedBytes: metadata.size,
    unpackedBytes: archive.files.reduce((total, entry) => total + entry.size, 0),
    fileCount: archive.files.length,
    files: archive.files,
    sha256: archive.sha256,
  };
}

async function main() {
  const options = parsePackageSizeArguments(process.argv.slice(2));
  const budgets = validatePackageBudgets(JSON.parse(readFileSync(budgetsPath, 'utf8')));
  const metrics = options.tarball ? await readTarballMetrics(options.tarball) : readPackedMetrics();
  if (metrics.sha256) console.log(`Package archive SHA-256: ${metrics.sha256}`);
  const findings = packageBudgetFindings(metrics, budgets);
  const summary = formatPackageSummary(metrics, budgets);
  if (findings.length > 0) {
    console.error(`${summary}\n${findings.join('\n')}`);
    process.exitCode = 1;
    return;
  }
  console.log(`${summary} — within hard package budgets`);
}

if (isMainModule(import.meta.url)) main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
