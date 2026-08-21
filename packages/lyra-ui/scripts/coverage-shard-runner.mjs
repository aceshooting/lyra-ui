// Runs the coverage suite across several isolated `wtr` sessions instead of one long-lived
// single-session sweep across all ~480 files, then merges the results into the same
// coverage/lcov.info + coverage/coverage-summary.json + coverage/junit.xml a plain coverage run
// produces, in the same shape/location, so downstream consumers (check:coverage-floors, the
// Codecov upload steps in ci.yml) need no changes.
//
// Why: the single-session run has been observed dying silently -- no browser-disconnect message,
// no testsFinishTimeout, no stack trace, just pnpm's own generic "Exit status 1" -- consistently
// near the tail of the full file list (position 475-481 of 482 across repeated runs), reproducing
// identically on both a 64MB-/dev/shm GitHub Actions runner and a 31GB-/dev/shm local machine.
// Isolating every suspect file in the tail (the last 60 files, spanning every viewer family) ran
// clean on its own, ruling out one leaking component -- the cause is cumulative resource pressure
// from one Chromium page staying alive across hundreds of coverage-instrumented files, not a
// fixable leak in this repo's source. Sharding caps any one session's file count well under
// wherever that threshold actually sits.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import libCoverage from 'istanbul-lib-coverage';
import libReport from 'istanbul-lib-report';
import reports from 'istanbul-reports';
import { discoverTestFiles, shardTestFiles } from './full-engine-shard.mjs';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const coverageDir = resolve(packageDir, 'coverage');
// 4 matches full-engine.yml's own per-browser shard count and leaves real margin under the
// observed 475-481/482 failure window -- even 2 shards of ~241 files would likely clear it, but 4
// keeps a wide safety margin without meaningfully lengthening the sequential wall-clock total.
const SHARD_TOTAL = 4;

function shardDir(shardIndex) {
  return resolve(coverageDir, `.shard-${shardIndex}`);
}

function runShard(shardIndex, testFiles) {
  const files = shardTestFiles(testFiles, shardIndex, SHARD_TOTAL);
  const dir = shardDir(shardIndex);
  rmSync(dir, { recursive: true, force: true });
  console.log(
    `Coverage shard ${shardIndex}/${SHARD_TOTAL}: ${files.length} of ${testFiles.length} sorted test files.`,
  );
  const executable = process.platform === 'win32' ? 'wtr.cmd' : 'wtr';
  // Sequential, not parallel: running 4 Chromium sessions at once would trade one long-lived
  // session's cumulative pressure for four concurrent sessions' cumulative pressure, defeating the
  // point. Each shard's browser process starts and fully tears down before the next one launches.
  const result = spawnSync(executable, files, {
    cwd: packageDir,
    env: { ...process.env, WTR_COVERAGE: '1', WTR_COVERAGE_REPORT_DIR: dir },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.signal) {
    throw new Error(`Coverage shard ${shardIndex}/${SHARD_TOTAL} was terminated by signal ${result.signal}.`);
  }
  return result.status ?? 1;
}

function loadShardCoverage(shardIndex) {
  const file = resolve(shardDir(shardIndex), 'coverage-final.json');
  if (!existsSync(file)) {
    throw new Error(
      `Coverage shard ${shardIndex}/${SHARD_TOTAL} produced no ${file} -- it likely crashed before writing a report.`,
    );
  }
  return JSON.parse(readFileSync(file, 'utf8'));
}

/** Shards are disjoint (deterministic cost-balanced split), so this is a plain union. */
function mergeCoverageMap(shardIndices) {
  const map = libCoverage.createCoverageMap({});
  for (const shardIndex of shardIndices) map.merge(loadShardCoverage(shardIndex));
  return map;
}

function writeMergedCoverageReport(map) {
  const context = libReport.createContext({ dir: coverageDir, coverageMap: map });
  reports.create('lcovonly', {}).execute(context);
  reports.create('json-summary', {}).execute(context);
}

function extractTestsuites(xml, shardIndex) {
  const match = xml.match(/<testsuites>([\s\S]*)<\/testsuites>/);
  if (!match) {
    throw new Error(`Coverage shard ${shardIndex}/${SHARD_TOTAL}'s junit.xml has no <testsuites> root.`);
  }
  return match[1];
}

function mergeJunitReports(shardIndices) {
  const inner = shardIndices
    .map((shardIndex) => extractTestsuites(readFileSync(resolve(shardDir(shardIndex), 'junit.xml'), 'utf8'), shardIndex))
    .join('');
  writeFileSync(
    resolve(coverageDir, 'junit.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites>${inner}</testsuites>\n`,
  );
}

async function main() {
  const testFiles = await discoverTestFiles();
  const shardIndices = Array.from({ length: SHARD_TOTAL }, (_unused, index) => index + 1);

  mkdirSync(coverageDir, { recursive: true });
  let failed = false;
  for (const shardIndex of shardIndices) {
    if (runShard(shardIndex, testFiles) !== 0) failed = true;
  }

  // Merge and report even when a shard had failing tests -- a plain single-session coverage run
  // still writes its report in that case too, and CI needs the coverage numbers either way.
  writeMergedCoverageReport(mergeCoverageMap(shardIndices));
  mergeJunitReports(shardIndices);
  for (const shardIndex of shardIndices) rmSync(shardDir(shardIndex), { recursive: true, force: true });

  process.exitCode = failed ? 1 : 0;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  await main();
}
