import assert from 'node:assert/strict';
import { readFileSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const budgetsPath = join(packageDir, 'scripts', 'package-budgets.json');

function percentReduction(baseline, current) {
  return ((baseline - current) / baseline) * 100;
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

export function validatePackageBudgets(budgets) {
  for (const metric of ['packedBytes', 'unpackedBytes', 'fileCount']) {
    assert.ok(Number.isInteger(budgets?.baseline?.[metric]) && budgets.baseline[metric] > 0,
      `package budget baseline.${metric} must be a positive integer`);
    assert.ok(Number.isInteger(budgets?.maximum?.[metric]) && budgets.maximum[metric] > 0,
      `package budget maximum.${metric} must be a positive integer`);
  }
  for (const metric of ['packedBytes', 'unpackedBytes']) {
    assert.ok(
      budgets.maximum[metric] < budgets.baseline[metric],
      `package budget maximum.${metric} must stay below its baseline`,
    );
  }
  const fileBudget = budgets.fileCountBudget;
  for (const field of [
    'baseArtifactCeiling',
    'stableTagAliasCount',
    'emittedFilesPerAlias',
    'entrypointHeadroom',
  ]) {
    assert.ok(Number.isInteger(fileBudget?.[field]) && fileBudget[field] >= 0,
      `package budget fileCountBudget.${field} must be a non-negative integer`);
  }
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
  for (const metric of ['packedBytes', 'unpackedBytes', 'fileCount']) {
    if (metrics[metric] > budgets.maximum[metric]) {
      findings.push(
        `${metric} ${metrics[metric].toLocaleString('en')} exceeds hard budget ` +
          budgets.maximum[metric].toLocaleString('en'),
      );
    }
  }
  const maps = metrics.files.filter((file) => /(?:\.js|\.d\.ts)\.map$/.test(file.path));
  if (maps.length > 0) {
    findings.push(`published tarball contains ${maps.length} dangling JavaScript/declaration map(s)`);
  }
  const sources = metrics.files.filter((file) => /^src\/.*\.(?:[cm]?ts|tsx)$/.test(file.path));
  if (sources.length > 0) {
    findings.push(`published tarball contains ${sources.length} unnecessary TypeScript source file(s)`);
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
  const packedReduction = percentReduction(budgets.baseline.packedBytes, metrics.packedBytes);
  const unpackedReduction = percentReduction(budgets.baseline.unpackedBytes, metrics.unpackedBytes);
  const summary =
    `package: ${formatBytes(metrics.packedBytes)} packed (${packedReduction.toFixed(1)}% reduction), ` +
    `${formatBytes(metrics.unpackedBytes)} unpacked (${unpackedReduction.toFixed(1)}% reduction), ` +
    `${metrics.fileCount.toLocaleString('en')} files`;
  if (findings.length > 0) {
    console.error(`${summary}\n${findings.join('\n')}`);
    process.exitCode = 1;
    return;
  }
  console.log(`${summary} — within hard package budgets`);
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) main();
