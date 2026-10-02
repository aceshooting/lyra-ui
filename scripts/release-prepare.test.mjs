#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  assertCleanWorktree,
  PACKAGE_GENERATORS,
  releaseCommitSubject,
  releasedPackages,
  releasePreparationSteps,
} from './release-prepare.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const source = readFileSync(join(repoRoot, 'scripts/release-prepare.mjs'), 'utf8');
const render = (steps) => steps.map(([command, args]) => [command, ...args].join(' '));

function indexAfter(lines, line, after = -1) {
  const index = lines.indexOf(line, after + 1);
  assert.ok(index > after, `${line} must follow its required predecessor`);
  return index;
}

test('release preparation runs every per-package generator in dependency order', () => {
  const lines = render(releasePreparationSteps(['@aceshooting/lyra-ui']));
  let cursor = -1;
  for (const script of PACKAGE_GENERATORS) {
    cursor = indexAfter(lines, `pnpm --filter @aceshooting/lyra-ui --if-present run ${script}`, cursor);
  }
  assert.deepEqual(PACKAGE_GENERATORS, [
    'archive-changelog',
    'package-metadata',
    'manifest',
    'component-inventory',
    'component-metadata:history',
    'registrations',
    'manifest',
    'component-inventory',
    'visual-manifest',
    'autoloader-manifest',
    'registration-graph',
    'scoped-definitions',
    'events',
    'testing-event-registry',
    'default-string-slices',
    'translation-slices',
    'translation-review-fixture',
    'locale-manifest',
    'framework-types',
    'design-tokens',
    'generate-editor-data',
    'llms',
    'build',
    'component-quality',
  ]);
});

test('release preparation regenerates the component inventory after the bump stamps deprecation versions', () => {
  const metadata = PACKAGE_GENERATORS.indexOf('component-metadata:history');
  const manifest = PACKAGE_GENERATORS.indexOf('manifest', metadata + 1);
  const inventory = PACKAGE_GENERATORS.indexOf('component-inventory', manifest + 1);
  assert.ok(metadata > 0 && manifest > metadata, 'component metadata precedes the manifest refresh');
  assert.ok(inventory > manifest, 'the inventory follows the stamped metadata and manifest');
});

test('release preparation refreshes immutable release history between manifest generations', () => {
  const lines = render(releasePreparationSteps(['@aceshooting/lyra-ui']));
  const manifest = indexAfter(lines, 'pnpm --filter @aceshooting/lyra-ui --if-present run manifest');
  const inventory = indexAfter(lines, 'pnpm --filter @aceshooting/lyra-ui --if-present run component-inventory', manifest);
  const history = indexAfter(lines, 'pnpm --filter @aceshooting/lyra-ui --if-present run component-metadata:history', inventory);
  const registrations = indexAfter(lines, 'pnpm --filter @aceshooting/lyra-ui --if-present run registrations', history);
  const refreshedManifest = indexAfter(lines, 'pnpm --filter @aceshooting/lyra-ui --if-present run manifest', registrations);
  indexAfter(lines, 'pnpm --filter @aceshooting/lyra-ui --if-present run component-inventory', refreshedManifest);
});

test('hosted source preparation bootstraps manifest and inventory before history reconciliation', () => {
  const lines = readFileSync(join(repoRoot, '.github/workflows/prepare-artifacts.yml'), 'utf8')
    .split('\n').map(line => line.trim());
  const sourceStep = indexAfter(lines, '- name: Reconcile release history and generate source');
  const manifest = indexAfter(lines, 'pnpm manifest', sourceStep);
  const inventory = indexAfter(lines, 'pnpm --filter @aceshooting/lyra-ui run component-inventory', manifest);
  const history = indexAfter(lines, 'pnpm --filter @aceshooting/lyra-ui run component-metadata:history', inventory);
  indexAfter(lines, './scripts/regen.sh', history);
});

test('release preparation fetches published tags before bumping and refuses conflicting local tags', () => {
  const root = mkdtempSync(join(tmpdir(), 'lyra-release-tags-'));
  const remote = join(root, 'remote');
  const checkout = join(root, 'checkout');
  const bin = join(root, 'bin');
  const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    mkdirSync(remote);
    mkdirSync(bin);
    for (const directory of ['scripts', 'packages/lyra-ui/scripts', '.github', '.changeset']) {
      mkdirSync(join(remote, directory), { recursive: true });
    }
    for (const file of [
      'scripts/release-prepare.mjs',
      'scripts/release-integrity.mjs',
      'scripts/check-node-version.mjs',
      'packages/lyra-ui/scripts/is-main-module.mjs',
      '.github/release-qualification.json',
      '.nvmrc',
    ]) {
      copyFileSync(join(repoRoot, file), join(remote, file));
    }
    writeFileSync(join(remote, 'scripts/changeset-release-plan.mjs'), '');
    writeFileSync(join(remote, '.changeset/release.md'), "---\n'@aceshooting/lyra-ui': patch\n---\n\nRelease fixture.\n");
    writeFileSync(join(remote, 'packages/lyra-ui/package.json'), JSON.stringify({
      name: '@aceshooting/lyra-ui', version: '24.0.0', private: false,
    }));
    git(remote, ['init', '--initial-branch=main']);
    git(remote, ['config', 'user.name', 'Release fixture']);
    git(remote, ['config', 'user.email', 'release@example.invalid']);
    git(remote, ['add', '.']);
    git(remote, ['commit', '-m', 'Release fixture']);
    git(root, ['clone', '--no-tags', remote, checkout]);
    git(remote, ['tag', '-a', 'lyra-ui@24.0.0', '-m', 'Published release']);
    assert.equal(git(checkout, ['tag', '--list', 'lyra-ui@24.0.0']).trim(), '');
    writeFileSync(join(bin, 'pnpm'), `#!/bin/sh
if git rev-parse --verify --quiet refs/tags/lyra-ui@24.0.0 >/dev/null; then
  echo TAG_VISIBLE_BEFORE_BUMP
else
  echo TAG_MISSING_BEFORE_BUMP
fi
exit 73
`, { mode: 0o755 });
    const result = spawnSync(process.execPath, ['scripts/release-prepare.mjs'], {
      cwd: checkout,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
      encoding: 'utf8',
    });
    assert.equal(result.status, 1, 'the fixture intentionally stops before a real version bump');
    assert.match(result.stdout, /TAG_VISIBLE_BEFORE_BUMP/u, result.stderr);
    assert.doesNotMatch(result.stdout, /TAG_MISSING_BEFORE_BUMP/u);
    assert.equal(git(checkout, ['rev-parse', 'lyra-ui@24.0.0^{}']).trim(), git(remote, ['rev-parse', 'HEAD']).trim());
    assert.equal(git(checkout, ['status', '--porcelain']).trim(), '');
    git(checkout, ['config', 'user.name', 'Release fixture']);
    git(checkout, ['config', 'user.email', 'release@example.invalid']);
    git(checkout, ['tag', '--force', '-a', 'lyra-ui@24.0.0', '-m', 'Conflicting local annotation']);
    const localTag = git(checkout, ['rev-parse', 'refs/tags/lyra-ui@24.0.0']).trim();
    const conflict = spawnSync(process.execPath, ['scripts/release-prepare.mjs'], {
      cwd: checkout,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
      encoding: 'utf8',
    });
    assert.equal(conflict.status, 1);
    assert.match(conflict.stderr, /Command failed: git fetch/u);
    assert.doesNotMatch(conflict.stdout, /pnpm changeset version/u);
    assert.equal(git(checkout, ['rev-parse', 'refs/tags/lyra-ui@24.0.0']).trim(), localTag);
    assert.equal(git(checkout, ['status', '--porcelain']).trim(), '');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a lyra-ui release syncs the plugin, repackages, and rebuilds quality evidence before the README', () => {
  const lines = render(releasePreparationSteps(['@aceshooting/lyra-ui', '@aceshooting/lyra-flags']));
  const lastQuality = lines.lastIndexOf('pnpm --filter @aceshooting/lyra-flags --if-present run component-quality');
  const recipes = indexAfter(lines, 'node scripts/update-framework-recipe-versions.mjs', lastQuality);
  const sync = indexAfter(lines, 'node scripts/sync-plugin-version.mjs', recipes);
  const pack = indexAfter(lines, './package.sh', sync);
  const rebuild = indexAfter(lines, 'pnpm --filter @aceshooting/lyra-ui run build', pack);
  const remeasure = indexAfter(lines, 'pnpm --filter @aceshooting/lyra-ui run component-quality', rebuild);
  const readme = indexAfter(lines, 'node scripts/update-readme-status.mjs', remeasure);
  assert.equal(readme, lines.length - 1, 'the README status update is the final step');
});

test('a companion-only release leaves the lyra-ui plugin untouched', () => {
  const lines = render(releasePreparationSteps(['@aceshooting/lyra-flags']));
  assert.ok(!lines.includes('node scripts/update-framework-recipe-versions.mjs'));
  assert.ok(!lines.includes('node scripts/sync-plugin-version.mjs'));
  assert.ok(!lines.includes('./package.sh'));
  assert.equal(lines.at(-1), 'node scripts/update-readme-status.mjs');
});

test('release preparation never lints, tests, packs, commits, tags, or pushes', () => {
  const lines = render(releasePreparationSteps(['@aceshooting/lyra-ui', '@aceshooting/lyra-flags']));
  for (const line of lines) {
    assert.doesNotMatch(line, /\brun (?:lint(?:\b|:)|test(?:\b|:)|check:)|\bpack\b|publish/u, line);
  }
  const executable = source.replace(/^\s*(\/\/|\*|\/\*\*).*$/gmu, '');
  assert.doesNotMatch(executable, /\['(commit|tag|push|add)'/u);
  assert.doesNotMatch(executable, /'gh'/u);
  assert.doesNotMatch(executable, /'(lint|test|pack)'\]/u);
});

test('release preparation checks the exact Node patch and a clean tree before bumping', () => {
  const nodeCheck = source.indexOf('await checkNodeVersionAtRoot(repoRoot)');
  const cleanTree = source.indexOf("assertCleanWorktree(git(['status', '--porcelain']))");
  const bump = source.indexOf("run('pnpm', ['changeset', 'version'])");
  const install = source.indexOf("run('pnpm', ['install'])");
  const generators = source.indexOf('releasePreparationSteps(released.map');
  assert.ok(nodeCheck > 0 && nodeCheck < cleanTree, 'the exact Node patch is checked first');
  assert.ok(cleanTree < bump, 'a dirty tree is refused before the bump');
  assert.ok(bump < install && install < generators, 'the lockfile refresh follows the bump');

  assert.doesNotThrow(() => assertCleanWorktree(''));
  assert.throws(() => assertCleanWorktree(' M README.md\n'), /Working tree is not clean[\s\S]*README\.md/u);
});

test('the released set is the publishable version delta, with stable release tags', () => {
  const before = new Map([
    ['packages/lyra-ui', '21.2.0'],
    ['packages/lyra-flags', '2.3.0'],
    ['packages/private-tool', '1.0.0'],
  ]);
  const after = [
    { directory: 'packages/lyra-ui', name: '@aceshooting/lyra-ui', version: '22.0.0', private: false },
    { directory: 'packages/lyra-flags', name: '@aceshooting/lyra-flags', version: '2.3.0', private: false },
    { directory: 'packages/private-tool', name: 'private-tool', version: '1.1.0', private: true },
  ];
  const released = releasedPackages(before, after);
  assert.deepEqual(
    released.map(({ name, previousVersion, version, tag }) => ({ name, previousVersion, version, tag })),
    [{ name: '@aceshooting/lyra-ui', previousVersion: '21.2.0', version: '22.0.0', tag: 'lyra-ui@22.0.0' }],
  );
  assert.equal(releaseCommitSubject(released), 'chore(release): @aceshooting/lyra-ui@22.0.0');
  assert.throws(
    () => releasedPackages(before, [{ ...after[0], version: '22.0.0-next.0' }]),
    /Unsupported release tag/u,
  );
});
