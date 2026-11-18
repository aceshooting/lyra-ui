import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as catalog from './fixtures/catalog.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const packageName = '@aceshooting/lyra-ui';
const quickScenarioIds = catalog.SCENARIOS.filter(scenario => scenario.profiles.includes('quick')).map(scenario => scenario.id);
const comparisonCount = quickScenarioIds.length * Object.keys(catalog.METRICS).length;
const readJson = file => JSON.parse(readFileSync(file, 'utf8'));
const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

export function validateComparison(comparison, exitCode) {
  assert.ok(exitCode === 0 || exitCode === 1, `Quick comparison exited with status ${exitCode}`);
  const expected = exitCode === 0 ? 'passed' : 'regression';
  assert.equal(comparison.status, expected);
  assert.deepEqual(comparison.compatibility, { overridden: false, mismatches: [] });
  assert.equal(comparison.thresholds.relative, 0.15);
  assert.equal(comparison.thresholds.absoluteMs, 1);
  assert.equal(comparison.comparisons.length, comparisonCount);
  return expected;
}

export function verifyMeasurement(measured, publicCommit, version) {
  assert.equal(measured.status, 'passed');
  assert.equal(measured.library.publicCommit, publicCommit);
  assert.equal(measured.library.version, version);
  assert.deepEqual(measured.configuration.browsers, ['chromium']);
  assert.equal(measured.configuration.profile, 'quick');
  assert.deepEqual(measured.configuration.scenarioIds, quickScenarioIds);
}

function requireFromPackage(directory) {
  return createRequire(join(directory, 'package.json'));
}

function runtimePaths(directory) {
  const lit = realpathSync(requireFromPackage(directory).resolve('lit'));
  const requireFromLit = createRequire(lit);
  return {
    lit,
    'lit-html': realpathSync(requireFromLit.resolve('lit-html')),
    'lit-element': realpathSync(requireFromLit.resolve('lit-element')),
    '@lit/reactive-element': realpathSync(requireFromLit.resolve('@lit/reactive-element')),
  };
}

function ownerVersion(file, name) {
  for (let directory = dirname(file); directory !== dirname(directory); directory = dirname(directory)) {
    try {
      const metadata = readJson(join(directory, 'package.json'));
      if (metadata.name === name) return metadata.version;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  throw new Error(`No package metadata for ${name}`);
}

function run(command, ...args) {
  execFileSync(command, args, { cwd: root, stdio: 'inherit' });
}

function main() {
  const {
    BASELINE_VERSION: baselineVersion, BASELINE_SHA256: baselineSha256, GITHUB_SHA: commit,
    GITHUB_RUN_ID: runId, GITHUB_RUN_ATTEMPT: runAttempt, RUNNER_TEMP: runnerTemp,
  } = process.env;
  assert.match(baselineVersion ?? '', /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u);
  assert.match(baselineSha256 ?? '', /^[a-f0-9]{64}$/u);
  assert.match(commit ?? '', /^[a-f0-9]{40}$/u);
  assert.match(runId ?? '', /^[1-9]\d*$/u);
  assert.match(runAttempt ?? '', /^[1-9]\d*$/u);
  assert.ok(runnerTemp);
  assert.equal(process.env.GITHUB_REF, 'refs/heads/main');
  assert.equal(git('rev-parse', 'HEAD'), commit);
  assert.equal(git('status', '--porcelain'), '');
  const candidateDir = join(root, 'packages/lyra-ui');
  assert.equal(readJson(join(candidateDir, 'package.json')).version, baselineVersion,
    'Compare on the candidate before preparing its version');

  const evidence = join(runnerTemp, 'lyra-release-quick-results');
  mkdirSync(evidence);
  const inputs = mkdtempSync(join(runnerTemp, 'lyra-release-quick-inputs-'));
  try {
    run('npm', 'pack', `${packageName}@${baselineVersion}`, '--ignore-scripts', '--pack-destination', inputs,
      '--registry=https://registry.npmjs.org');
    const archive = join(inputs, `aceshooting-lyra-ui-${baselineVersion}.tgz`);
    assert.equal(sha256(archive), baselineSha256, 'Baseline does not match the verified published tarball');
    run(process.execPath, 'scripts/release-integrity.mjs', 'validate-tarball', '--tag', `lyra-ui@${baselineVersion}`, '--file', archive);
    run('tar', '-xzf', archive, '-C', inputs, '--no-same-owner', '--no-same-permissions');
    const baselineDir = join(inputs, 'package');
    symlinkSync(join(candidateDir, 'node_modules'), join(baselineDir, 'node_modules'), 'dir');

    const baselinePaths = runtimePaths(baselineDir);
    const candidatePaths = runtimePaths(candidateDir);
    assert.deepEqual(baselinePaths, candidatePaths, 'Both packages must resolve the same installed Lit runtime');
    const runtimeVersions = Object.fromEntries(Object.entries(candidatePaths).map(([name, file]) => [name, ownerVersion(file, name)]));
    const metadata = {
      commit, runId, runAttempt, baselineVersion, baselineSha256, runtimeVersions,
      lockfileSha256: sha256(join(root, 'pnpm-lock.yaml')),
    };
    writeFileSync(join(evidence, 'inputs.json'), `${JSON.stringify(metadata, null, 2)}\n`, { flag: 'wx' });

    const baseline = join(evidence, 'baseline.json');
    const candidate = join(evidence, 'candidate.json');
    for (const [directory, report, publicCommit] of [[baselineDir, baseline, null], [candidateDir, candidate, commit]]) {
      run('pnpm', 'benchmark', '--profile', 'quick', '--browsers', 'chromium', '--package-dir', directory, '--output', report);
      run(process.execPath, 'benchmarks/schema.mjs', '--validate', report);
      verifyMeasurement(readJson(report), publicCommit, baselineVersion);
    }
    assert.equal(sha256(archive), baselineSha256);
    assert.equal(git('status', '--porcelain'), '');

    const comparison = join(evidence, 'comparison.json');
    const result = spawnSync('pnpm', ['benchmark:compare', baseline, candidate, '--output', comparison], {
      cwd: root, stdio: 'inherit',
    });
    if (result.error) throw result.error;
    assert.ok(result.status === 0 || result.status === 1, `Quick comparison exited with status ${result.status}`);
    const status = validateComparison(readJson(comparison), result.status);
    const receipt = { ...metadata, status, comparisonExit: result.status };
    writeFileSync(join(evidence, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' });
    if (status === 'regression') console.warn('::warning::Review material timing observations and explain them before release.');
  } finally {
    rmSync(inputs, { recursive: true, force: true });
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main();
