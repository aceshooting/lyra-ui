import { isMainModule } from './is-main-module.mjs';

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const packageJsonPath = join(packageDir, 'package.json');
const outputPath = join(packageDir, 'src', 'internal', 'package-metadata.ts');

function invariant(condition, message) {
  if (!condition) throw new Error(`Invalid package metadata: ${message}`);
}

// This codebase is single-quote by convention (enforced by check:source-policy's
// double-quoted-literal rule); JSON.stringify always emits double quotes, so it can't be used
// directly to render the string literals below.
function singleQuote(value) {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

export function renderPackageMetadata(packageJson) {
  invariant(typeof packageJson?.name === 'string' && packageJson.name.length > 0, 'name is required');
  invariant(
    typeof packageJson?.version === 'string' && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(packageJson.version),
    'version must be a semver string',
  );
  return [
    '/**',
    ' * Generated from package.json by scripts/generate-package-metadata.mjs.',
    ' * Run `pnpm package-metadata` after changing package identity or version.',
    ' */',
    `export const LYRA_PACKAGE_NAME = ${singleQuote(packageJson.name)} as const;`,
    `export const LYRA_PACKAGE_VERSION = ${singleQuote(packageJson.version)} as const;`,
    '',
  ].join('\n');
}

export function checkPackageMetadata(packageJson, current) {
  return current === renderPackageMetadata(packageJson);
}

function main() {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const expected = renderPackageMetadata(packageJson);
  const check = process.argv.includes('--check');
  if (check) {
    const current = readFileSync(outputPath, 'utf8');
    if (current !== expected) {
      throw new Error('src/internal/package-metadata.ts is stale; run `pnpm package-metadata`');
    }
    console.log(`Package metadata is fresh: ${packageJson.name}@${packageJson.version}.`);
    return;
  }
  writeFileSync(outputPath, expected);
  console.log(`Generated package metadata for ${packageJson.name}@${packageJson.version}.`);
}

if (isMainModule(import.meta.url)) {
  main();
}
