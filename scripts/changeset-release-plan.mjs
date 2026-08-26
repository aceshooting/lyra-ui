#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { isMainModule } from '../packages/lyra-ui/scripts/is-main-module.mjs';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RELEASE_TYPES = new Set(['major', 'minor', 'patch']);
const CHANGESET_ID = /^[^\s/\\]+$/u;
const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u;

/**
 * Validates the JSON emitted by `changeset status --output` and returns the package names owned
 * by each individual changeset. Using Changesets' own YAML parser keeps release discovery aligned
 * with the CLI that will later consume the same files.
 */
export function changesetPackagePlan(status) {
  if (!status || !Array.isArray(status.changesets)) {
    throw new Error('Changesets status JSON has no changesets array.');
  }

  const seenIds = new Set();
  return status.changesets.map((changeset, index) => {
    const id = changeset?.id;
    if (typeof id !== 'string' || !CHANGESET_ID.test(id)) {
      throw new Error(`Changesets status entry ${index + 1} has an invalid id.`);
    }
    if (seenIds.has(id)) {
      throw new Error(`Changesets status contains duplicate id '${id}'.`);
    }
    seenIds.add(id);

    if (!Array.isArray(changeset.releases)) {
      throw new Error(`Changeset '${id}' has no releases array.`);
    }

    const packages = [];
    const seenPackages = new Set();
    for (const release of changeset.releases) {
      const name = release?.name;
      if (typeof name !== 'string' || !PACKAGE_NAME.test(name)) {
        throw new Error(`Changeset '${id}' has an invalid package name.`);
      }
      if (!RELEASE_TYPES.has(release.type)) {
        throw new Error(`Changeset '${id}' has invalid release type '${release?.type}'.`);
      }
      if (seenPackages.has(name)) {
        throw new Error(`Changeset '${id}' lists package '${name}' more than once.`);
      }
      seenPackages.add(name);
      packages.push(name);
    }

    return { id, packages };
  });
}

export function renderChangesetPackagePlan(plan) {
  return plan.map(({ id, packages }) => `${id}\t${packages.join(' ')}`).join('\n');
}

function loadChangesetPackagePlan(root = repoRoot) {
  const workspace = mkdtempSync(path.join(tmpdir(), 'lyra-changeset-status-'));
  const output = path.join(workspace, 'status.json');
  const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  try {
    execFileSync(pnpm, ['changeset', 'status', '--output', output], {
      cwd: root,
      stdio: ['ignore', 'ignore', 'inherit'],
    });
    return changesetPackagePlan(JSON.parse(readFileSync(output, 'utf8')));
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}

if (isMainModule(import.meta.url)) {
  try {
    console.log(renderChangesetPackagePlan(loadChangesetPackagePlan()));
  } catch (error) {
    console.error(
      `Changeset release plan failed: ${error instanceof Error ? error.message : error}`,
    );
    process.exitCode = 1;
  }
}
