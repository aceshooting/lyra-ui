import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
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
  // The ceiling must stay below the pre-8.0.0 baseline -- the tarball may never grow back past
  // where it started. It deliberately does NOT encode a target reduction: an earlier revision
  // required 25%, which was a goal nobody had achieved, so the gate was red from the day it landed
  // and therefore taught every reader to ignore it. A budget is only useful if meeting it is the
  // normal state and failing it is news. Ratchet it downward as real reductions land.
  //
  // Next measured win, when someone takes it: custom-elements.json is pretty-printed at 11.42 MiB
  // and minifies to 6.66 MiB -- 4.77 MiB (41.7%) off every install for no semantic change. It is
  // 37% of the unpacked tarball on its own. Doing it means teaching `pnpm manifest` to minify and
  // confirming check-manifest.mjs plus the editor-data generators still round-trip, so it belongs
  // in its own change rather than bundled into a budget edit.
  for (const metric of ['packedBytes', 'unpackedBytes']) {
    assert.ok(
      budgets.maximum[metric] < budgets.baseline[metric],
      `package budget maximum.${metric} must stay below its baseline`,
    );
  }
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
  assert.equal(result.length, 1, 'npm pack must report exactly one package');
  return metricsFromPackResult(result[0]);
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
