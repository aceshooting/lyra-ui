#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { isMainModule } from '../packages/lyra-ui/scripts/is-main-module.mjs';

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const FRAMEWORKS = Object.freeze(['react', 'vue', 'svelte']);

export function frameworkRecipeVersionRange(version) {
  const match = /^([1-9]\d*)\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.exec(version);
  const major = match?.[1];
  if (!major) throw new Error(`Invalid Lyra package version '${version}'.`);
  return `^${major}.0.0`;
}

export async function updateFrameworkRecipeVersions(root = repositoryRoot) {
  const packagePath = join(root, 'packages', 'lyra-ui', 'package.json');
  const packageManifest = JSON.parse(await readFile(packagePath, 'utf8'));
  const versionRange = frameworkRecipeVersionRange(packageManifest.version);
  const changed = [];

  for (const framework of FRAMEWORKS) {
    const recipePath = join(root, 'examples', 'frameworks', framework, 'package.json');
    const recipe = JSON.parse(await readFile(recipePath, 'utf8'));
    const previous = recipe.dependencies?.['@aceshooting/lyra-ui'];
    if (typeof previous !== 'string') {
      throw new Error(`${recipePath} must declare @aceshooting/lyra-ui in dependencies.`);
    }
    if (previous === versionRange) continue;

    recipe.dependencies['@aceshooting/lyra-ui'] = versionRange;
    await writeFile(recipePath, `${JSON.stringify(recipe, null, 2)}\n`);
    changed.push(recipePath);
  }

  return { versionRange, changed };
}

if (isMainModule(import.meta.url)) {
  try {
    const { versionRange, changed } = await updateFrameworkRecipeVersions();
    console.log(
      changed.length === 0
        ? `Framework recipes already target Lyra ${versionRange}.`
        : `Updated ${changed.length} framework recipes to Lyra ${versionRange}.`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : error;
    console.error(`Framework recipe version update failed: ${message}`);
    process.exitCode = 1;
  }
}
