import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { assertPreparationInputs } from './prepare-artifacts-paths.mjs';
import { bundlePreparedSource } from './prepare-source-bundle.mjs';
import { validateCandidateSource, assertPreparationAuthority, preparationReceipt } from './prepare-candidate-source.mjs';

const sha = 'a'.repeat(40);
test('candidate preparation accepts only immutable source-only inputs', () => {
  assert.doesNotThrow(() => assertPreparationInputs('source', '', '', 'false', sha));
  for (const candidate of ['main', 'HEAD', 'a'.repeat(39), 'A'.repeat(40), `${sha}\n`]) {
    assert.throws(() => assertPreparationInputs('source', '', '', 'false', candidate));
  }
  for (const args of [['release', '', '', 'false'], ['source', '{}', '', 'false'], ['source', '', '', 'true']]) {
    assert.throws(() => assertPreparationInputs(...args, sha));
  }
});

function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'lyra-candidate-test-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    git('init', '--initial-branch=main');
    git('config', 'user.name', 'Preparation test');
    git('config', 'user.email', 'test@example.invalid');
    mkdirSync(join(root, 'scripts'));
    mkdirSync(join(root, 'packages/lyra-ui/scripts'), { recursive: true });
    writeFileSync(join(root, 'scripts/prepare-candidate-source.mjs'), readFileSync(new URL('./prepare-candidate-source.mjs', import.meta.url)));
    writeFileSync(join(root, 'scripts/control.mjs'), 'export const control = true;\n');
    writeFileSync(join(root, 'packages/lyra-ui/scripts/check.mjs'), 'export const check = true;\n');
    writeFileSync(join(root, 'source.ts'), 'export const value = 1;\n');
    git('add', '.'); git('commit', '-m', 'Main authority');
    const main = git('rev-parse', 'HEAD');
    git('update-ref', 'refs/remotes/origin/main', main);
    git('update-ref', 'refs/lyra-preparation-origin/main', main);
    writeFileSync(join(root, 'source.ts'), 'export const value = 2;\n');
    git('add', '.'); git('commit', '-m', 'Candidate source');
    const candidate = git('rev-parse', 'HEAD');
    git('update-ref', 'refs/lyra-preparation-origin/candidate', candidate);
    run({ root, git, main, candidate });
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test('actual Git ancestry binds candidate and refuses stale main or noncommit objects', () => fixture(({ root, git, main, candidate }) => {
  assert.equal(validateCandidateSource(root, { workflowSha: main, candidateSha: candidate }), candidate);
  assert.throws(() => validateCandidateSource(root, { workflowSha: main, candidateSha: 'main' }));
  assert.throws(() => validateCandidateSource(root, { workflowSha: main, candidateSha: 'f'.repeat(40) }));
  assert.throws(() => assertPreparationAuthority(root, main, main), /HEAD changed/u);
  assert.throws(() => validateCandidateSource(root, { workflowSha: candidate, candidateSha: main }));
  assert.throws(() => validateCandidateSource(root, { workflowSha: main, candidateSha: git('rev-parse', 'HEAD^{tree}') }));
  git('update-ref', 'refs/remotes/origin/main', candidate);
  git('update-ref', 'refs/lyra-preparation-origin/main', candidate);
  assert.throws(() => validateCandidateSource(root, { workflowSha: main, candidateSha: candidate }));
}));

test('authority comparison uses trusted Git blobs and detects candidate and working-tree changes', () => fixture(({ root, git, main, candidate }) => {
  assert.doesNotThrow(() => assertPreparationAuthority(root, main, candidate));
  writeFileSync(join(root, 'scripts/control.mjs'), 'export const control = false;\n');
  assert.throws(() => assertPreparationAuthority(root, main, candidate));
  git('add', '.'); git('commit', '-m', 'Changed control');
  assert.throws(() => assertPreparationAuthority(root, main, git('rev-parse', 'HEAD')));
}));

test('new tooling and mode changes fail while fixture data can regenerate', () => fixture(({ root, git, main, candidate }) => {
  writeFileSync(join(root, 'packages/lyra-ui/scripts/new.test.mjs'), 'export {};\n');
  assert.throws(() => assertPreparationAuthority(root, main, candidate));
  rmSync(join(root, 'packages/lyra-ui/scripts/new.test.mjs'));
  mkdirSync(join(root, 'packages/lyra-ui/scripts/fixtures'));
  writeFileSync(join(root, 'packages/lyra-ui/scripts/fixtures/data.json'), '{}\n');
  assert.doesNotThrow(() => assertPreparationAuthority(root, main, candidate));
  git('update-index', '--chmod=+x', 'scripts/control.mjs');
  git('commit', '-m', 'Changed control mode');
  assert.throws(() => assertPreparationAuthority(root, main, git('rev-parse', 'HEAD')));
}));

test('receipt preserves workflow identity and binds candidate rather than spoofing GitHub SHA', () => {
  const receipt = preparationReceipt({ workflowSha: 'a'.repeat(40), sourceSha: 'b'.repeat(40), candidateSha: 'b'.repeat(40), sourceContracts: '{"schemaVersion":1}' });
  assert.equal(receipt.workflowCommit, 'a'.repeat(40));
  assert.equal(receipt.sourceCommit, 'b'.repeat(40));
  assert.equal(receipt.candidateCommit, 'b'.repeat(40));
  assert.match(receipt.sourceContractsSha256, /^[a-f0-9]{64}$/u);
});

test('workflow keeps candidate execution behind trusted main and immutable authority checks', async () => {
  const { readFileSync } = await import('node:fs');
  const workflow = readFileSync(new URL('../.github/workflows/prepare-artifacts.yml', import.meta.url), 'utf8');
  assert.match(workflow, /candidateSha:/u);
  assert.match(workflow, /if: github.ref == 'refs\/heads\/main'/u);
  assert.match(workflow, /permissions:\n  contents: read/u);
  assert.match(workflow, /persist-credentials: false/u);
  assert.match(workflow, /lyra-preparation-control\.mjs/u);
  assert.match(workflow, /inputs.mode == 'source' && inputs.candidateSha == '' && inputs.upgradeDependencies/u);
  assert.match(workflow, /inputs.mode == 'source' && inputs.candidateSha == ''/u);
  assert.match(workflow, /inputs.mode == 'release' && inputs.candidateSha == ''/u);
  assert.doesNotMatch(workflow, /GITHUB_SHA=|GITHUB_SHA:/u);
  assert.match(workflow, /PREPARATION_SOURCE_SHA/u);
  assert.match(workflow, /node --test scripts\/prepare-artifacts\.test\.mjs scripts\/prepare-candidate-source\.test\.mjs/u);
  const scripts = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).scripts;
  assert.ok(scripts['check:release-tooling'].includes('scripts/prepare-candidate-source.test.mjs'));
  const writer = readFileSync(new URL('./prepare-source-contracts.mjs', import.meta.url), 'utf8');
  assert.match(writer, /assert.equal\(process.env.GITHUB_ACTIONS, 'true'/u);
  assert.match(writer, /assert.equal\(process.env.GITHUB_REF, 'refs\/heads\/main'/u);
  assert.match(writer, /assert.equal\(process.env.PREPARATION_MODE, 'source'/u);
});


test('authority rejects removed and symlinked control files after generation', () => fixture(({ root, main, candidate }) => {
  const file = join(root, 'scripts/control.mjs');
  rmSync(file);
  assert.throws(() => assertPreparationAuthority(root, main, candidate));
  symlinkSync('../source.ts', file);
  assert.throws(() => assertPreparationAuthority(root, main, candidate));
}));


test('receipt rejects mismatched default and explicit candidate source identities', () => {
  const main = 'a'.repeat(40);
  const candidate = 'b'.repeat(40);
  assert.throws(() => preparationReceipt({ workflowSha: main, sourceSha: candidate }), /source identity/u);
  assert.throws(() => preparationReceipt({ workflowSha: main, sourceSha: main, candidateSha: candidate }), /source identity/u);
  assert.equal(preparationReceipt({ workflowSha: main, sourceSha: main }).candidateCommit, null);
});

test('candidate cannot come from sibling Git history', () => fixture(({ root, git, main, candidate }) => {
  git('checkout', '--orphan', 'unrelated');
  git('rm', '-rf', '.');
  writeFileSync(join(root, 'unrelated.txt'), 'Unrelated history.\n');
  git('add', '.'); git('commit', '-m', 'Unrelated root');
  const unrelated = git('rev-parse', 'HEAD');
  assert.throws(() => validateCandidateSource(root, { workflowSha: main, candidateSha: unrelated }));
  git('checkout', '--detach', candidate);
}));

test('candidate sibling branch must contain the current trusted main commit', () => fixture(({ root, git, main, candidate }) => {
  git('update-ref', 'refs/remotes/origin/main', candidate);
  git('update-ref', 'refs/lyra-preparation-origin/main', candidate);
  git('checkout', '--detach', main);
  writeFileSync(join(root, 'source.ts'), 'export const sibling = 3;\n');
  git('add', '.'); git('commit', '-m', 'Sibling source');
  const sibling = git('rev-parse', 'HEAD');
  assert.throws(() => validateCandidateSource(root, { workflowSha: candidate, candidateSha: sibling }));
}));


test('actual source bundle binds candidate, workflow, run IDs and content-addressed files', () => fixture(({ root, main, candidate }) => {
  const outputRoot = mkdtempSync(join(tmpdir(), 'lyra-bundle-test-'));
  try {
    writeFileSync(join(root, 'source.ts'), 'export const value = 3;\n');
    bundlePreparedSource(root, {
      GITHUB_ACTIONS: 'true', GITHUB_REF: 'refs/heads/main', PREPARATION_MODE: 'source',
      GITHUB_SHA: main, PREPARATION_SOURCE_SHA: candidate, PREPARATION_CANDIDATE_SHA: candidate,
      GITHUB_REPOSITORY: 'aceshooting/lyra-ui', GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '2',
      RUNNER_TEMP: outputRoot,
    });
    const output = join(outputRoot, 'lyra-generated-source');
    const manifest = JSON.parse(readFileSync(join(output, 'manifest.json'), 'utf8'));
    assert.equal(manifest.baseCommit, candidate);
    assert.equal(manifest.preparation.workflowCommit, main);
    assert.equal(manifest.preparation.sourceCommit, candidate);
    assert.equal(manifest.preparation.candidateCommit, candidate);
    assert.equal(manifest.runId, '123');
    assert.equal(manifest.runAttempt, '2');
    assert.equal(manifest.repository, 'aceshooting/lyra-ui');
    assert.equal(manifest.changes.length, 1);
    const change = manifest.changes[0];
    assert.equal(change.path, 'source.ts');
    assert.equal(change.before.sha256, createHash('sha256').update('export const value = 2;\n').digest('hex'));
    assert.equal(change.after.sha256, createHash('sha256').update('export const value = 3;\n').digest('hex'));
    const manifestHash = createHash('sha256').update(readFileSync(join(output, 'manifest.json'))).digest('hex');
    assert.equal(readFileSync(join(output, 'manifest.sha256'), 'utf8'), `${manifestHash}  manifest.json\n`);
    assert.equal(readFileSync(join(output, 'blobs', change.after.sha256), 'utf8'), 'export const value = 3;\n');
    assert.match(readFileSync(join(output, 'changes.patch'), 'utf8'), /value = 3/u);
  } finally { rmSync(outputRoot, { recursive: true, force: true }); }
}));


test('actual source bundle rejects wrong HEAD before creating any output', () => fixture(({ root, main, candidate }) => {
  const outputRoot = mkdtempSync(join(tmpdir(), 'lyra-bundle-wrong-head-'));
  try {
    assert.throws(() => bundlePreparedSource(root, { GITHUB_SHA: main, PREPARATION_SOURCE_SHA: main,
      PREPARATION_CANDIDATE_SHA: candidate, PREPARATION_MODE: 'source', RUNNER_TEMP: outputRoot }));
    assert.equal(existsSync(join(outputRoot, 'lyra-generated-source')), false);
  } finally { rmSync(outputRoot, { recursive: true, force: true }); }
}));

test('fresh bare-origin branch membership rejects a local-only descendant', () => fixture(({ root, git, main, candidate }) => {
  const remote = mkdtempSync(join(tmpdir(), 'lyra-origin-membership-'));
  try {
    execFileSync('git', ['init', '--bare', remote], { stdio: 'ignore' });
    git('remote', 'add', 'origin', remote);
    git('push', 'origin', `${main}:refs/heads/main`, `${candidate}:refs/heads/candidate`);
    git('fetch', '--no-tags', 'origin', '+refs/heads/*:refs/lyra-preparation-origin/*');
    assert.equal(validateCandidateSource(root, { workflowSha: main, candidateSha: candidate }), candidate);
    writeFileSync(join(root, 'source.ts'), 'export const localOnly = 4;\n');
    git('add', '.'); git('commit', '-m', 'Local only');
    const local = git('rev-parse', 'HEAD');
    assert.throws(() => validateCandidateSource(root, { workflowSha: main, candidateSha: local }), /origin branch/u);
  } finally { rmSync(remote, { recursive: true, force: true }); }
}));


test('actual workflow selection shell checks out only the verified immutable origin candidate', () => fixture(({ root, git, main, candidate }) => {
  const remote = mkdtempSync(join(tmpdir(), 'lyra-selection-origin-'));
  const scratch = mkdtempSync(join(tmpdir(), 'lyra-selection-run-'));
  try {
    execFileSync('git', ['init', '--bare', remote], { stdio: 'ignore' });
    git('remote', 'add', 'origin', remote);
    git('push', 'origin', `${main}:refs/heads/main`, `${candidate}:refs/heads/candidate`);
    git('checkout', '--detach', main);
    const workflow = readFileSync(new URL('../.github/workflows/prepare-artifacts.yml', import.meta.url), 'utf8');
    const step = /      - name: Select immutable preparation source using trusted main control\n[\s\S]*?        run: \|\n(?<commands>(?:          .*\n)+)/u.exec(workflow);
    assert.ok(step);
    const commands = step.groups.commands.replace(/^          /gmu, '');
    const envFile = join(scratch, 'github-env');
    const environment = { ...process.env, GITHUB_ACTIONS: 'true', GITHUB_REF: 'refs/heads/main',
      GITHUB_SHA: main, CANDIDATE_SHA: candidate, PREPARATION_MODE: 'source', PUBLICATION_JSON: '',
      UPGRADE_DEPENDENCIES: 'false', RUNNER_TEMP: scratch, GITHUB_ENV: envFile };
    execFileSync('bash', ['-euo', 'pipefail', '-c', commands], { cwd: root, env: environment, stdio: 'pipe' });
    assert.equal(git('rev-parse', 'HEAD'), candidate);
    assert.equal(readFileSync(envFile, 'utf8'), `PREPARATION_SOURCE_SHA=${candidate}\n`);
    writeFileSync(join(root, 'source.ts'), 'export const localOnly = 5;\n');
    git('add', '.'); git('commit', '-m', 'Not pushed');
    const local = git('rev-parse', 'HEAD');
    git('checkout', '--detach', main);
    assert.throws(() => execFileSync('bash', ['-euo', 'pipefail', '-c', commands], {
      cwd: root, env: { ...environment, CANDIDATE_SHA: local }, stdio: 'pipe',
    }));
    assert.equal(git('rev-parse', 'HEAD'), main);
  } finally {
    rmSync(remote, { recursive: true, force: true });
    rmSync(scratch, { recursive: true, force: true });
  }
}));
