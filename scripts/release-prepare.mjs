#!/usr/bin/env node
// Local release preparation: consumes every pending changeset and regenerates the version-derived
// artifacts, then stops. It never lints, tests, packs, commits, tags, or pushes -- the bumped tree
// is left for review and a normal commit to main. Qualification (CI, Test All Browsers, and the
// full browser-engine suite on the exact pushed commit), tagging, the GitHub Release, and the npm
// publish all run on GitHub through .github/workflows/release.yml.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { isMainModule } from '../packages/lyra-ui/scripts/is-main-module.mjs';
import { checkNodeVersionAtRoot } from './check-node-version.mjs';
import { parseReleaseTag } from './release-integrity.mjs';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PRIMARY_PACKAGE = '@aceshooting/lyra-ui';

/**
 * Per-package post-bump generators, in dependency order. The bump stamps `since: 'unreleased'`
 * deprecation records with the new version. The metadata history refresh retains immutable
 * published-release snapshots from the fetched tags before regenerating the manifest and inventory.
 * The component inventory records each stamped deprecation. LLM
 * references read the regenerated manifest and package metadata, and the built component-quality
 * evidence measures the build that embeds the new version.
 */
export const PACKAGE_GENERATORS = Object.freeze([
  'archive-changelog',
  'package-metadata',
  'manifest',
  'component-metadata:history',
  'manifest',
  'component-inventory',
  'visual-manifest',
  'registrations',
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

/**
 * Every generator command, in order, for the packages whose version the bump changed. A release
 * that includes lyra-ui also synchronizes the plugin versions and regenerates the packaged skill
 * references; package.sh writes source, so the build and its quality evidence are regenerated
 * after it. A companion-only release leaves the lyra-ui plugin untouched.
 */
export function releasePreparationSteps(releasedPackageNames) {
  const steps = [];
  for (const name of releasedPackageNames) {
    for (const script of PACKAGE_GENERATORS) {
      steps.push(['pnpm', ['--filter', name, '--if-present', 'run', script]]);
    }
  }
  if (releasedPackageNames.includes(PRIMARY_PACKAGE)) {
    steps.push(['node', ['scripts/update-framework-recipe-versions.mjs']]);
    steps.push(['node', ['scripts/sync-plugin-version.mjs']]);
    steps.push(['./package.sh', []]);
    steps.push(['pnpm', ['--filter', PRIMARY_PACKAGE, 'run', 'build']]);
    steps.push(['pnpm', ['--filter', PRIMARY_PACKAGE, 'run', 'component-quality']]);
  }
  steps.push(['node', ['scripts/update-readme-status.mjs']]);
  return steps;
}

/** Release preparation must start from a clean tree so the bump commit holds only its own output. */
export function assertCleanWorktree(porcelainStatus) {
  if (porcelainStatus.trim() !== '') {
    throw new Error(
      'Working tree is not clean; refusing to mix unrelated changes into a release commit:\n' +
        `${porcelainStatus.trimEnd()}\nCommit or discard them, then run pnpm release:prepare again.`,
    );
  }
}

/** Publishable packages whose version the bump changed, with their release tags. */
export function releasedPackages(before, after) {
  return after
    .filter((pkg) => !pkg.private && before.get(pkg.directory) !== pkg.version)
    .map((pkg) => ({
      ...pkg,
      previousVersion: before.get(pkg.directory),
      tag: parseReleaseTag(`${path.posix.basename(pkg.directory)}@${pkg.version}`).tag,
    }));
}

export function releaseCommitSubject(packages) {
  return `chore(release): ${packages.map(({ name, version }) => `${name}@${version}`).join(', ')}`;
}

function readWorkspacePackages(root = repoRoot) {
  const packagesRoot = path.join(root, 'packages');
  return readdirSync(packagesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => existsSync(path.join(packagesRoot, entry.name, 'package.json')))
    .map((entry) => {
      const packageJson = JSON.parse(
        readFileSync(path.join(packagesRoot, entry.name, 'package.json'), 'utf8'),
      );
      return {
        directory: path.posix.join('packages', entry.name),
        name: packageJson.name,
        version: packageJson.version,
        private: packageJson.private === true,
      };
    });
}

function git(args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
}

function run(command, args) {
  console.log(`\n==> ${[command, ...args].join(' ')}`);
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${[command, ...args].join(' ')} exited with status ${result.status}.`);
  }
}

async function main(argv) {
  if (argv.length > 0) throw new Error('usage: pnpm release:prepare');
  // Generated metadata and measured gzip output depend on the exact Node patch.
  await checkNodeVersionAtRoot(repoRoot);
  assertCleanWorktree(git(['status', '--porcelain']));

  git(['fetch', 'origin', 'main', '--tags', '--quiet']);
  const upToDate = spawnSync('git', ['merge-base', '--is-ancestor', 'origin/main', 'HEAD'], {
    cwd: repoRoot,
  });
  if (upToDate.status !== 0) {
    throw new Error('HEAD does not contain origin/main; rebase onto origin/main first.');
  }

  const pending = readdirSync(path.join(repoRoot, '.changeset')).filter(
    (file) => file.endsWith('.md') && file !== 'README.md',
  );
  if (pending.length === 0) {
    throw new Error('No pending changesets in .changeset/; run pnpm changeset first.');
  }
  // Parses the pending changesets with Changesets itself and fails closed on a malformed plan.
  run('node', ['scripts/changeset-release-plan.mjs']);

  const before = new Map(readWorkspacePackages().map((pkg) => [pkg.directory, pkg.version]));
  run('pnpm', ['changeset', 'version']);
  const released = releasedPackages(before, readWorkspacePackages());
  if (released.length === 0) {
    throw new Error('pnpm changeset version did not change any publishable package version.');
  }
  for (const { tag } of released) {
    const remoteTag = git(['ls-remote', '--tags', 'origin', `refs/tags/${tag}`]).trim();
    const localTag = spawnSync('git', ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`], {
      cwd: repoRoot,
    });
    if (remoteTag !== '' || localTag.status === 0) {
      throw new Error(`Release tag '${tag}' already exists; restore the bumped files and investigate.`);
    }
  }

  run('pnpm', ['install']);
  for (const [command, args] of releasePreparationSteps(released.map(({ name }) => name))) {
    run(command, args);
  }

  console.log('\n==> Release prepared');
  for (const pkg of released) {
    console.log(`  ${pkg.name}: ${pkg.previousVersion} -> ${pkg.version} (tag ${pkg.tag})`);
  }
  console.log(`\n${git(['status', '--short']).trimEnd()}`);
  console.log(
    '\nReview the diff, then commit and push to main:\n' +
      `  git add -A && git commit -m "${releaseCommitSubject(released)}"\n` +
      'After CI, Test All Browsers, and the Full browser-engine suite pass on that commit, run:\n' +
      '  gh workflow run release.yml --ref main',
  );
}

if (isMainModule(import.meta.url)) {
  try {
    await main(process.argv.slice(2));
  } catch (error) {
    console.error(`Release preparation failed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}
