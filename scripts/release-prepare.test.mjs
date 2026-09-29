#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
    'component-metadata',
    'manifest',
    'component-inventory',
    'registrations',
    'autoloader-manifest',
    'registration-graph',
    'scoped-definitions',
    'events',
    'testing-event-registry',
    'default-string-slices',
    'translation-slices',
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
  const metadata = PACKAGE_GENERATORS.indexOf('component-metadata');
  const manifest = PACKAGE_GENERATORS.indexOf('manifest', metadata + 1);
  const inventory = PACKAGE_GENERATORS.indexOf('component-inventory', manifest + 1);
  assert.ok(metadata > 0 && manifest > metadata, 'component metadata precedes the manifest refresh');
  assert.ok(inventory > manifest, 'the inventory follows the stamped metadata and manifest');
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
