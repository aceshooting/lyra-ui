#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { isMainModule } from '../packages/lyra-ui/scripts/is-main-module.mjs';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const STATUS_LINE = /(`@aceshooting\/lyra-ui` source is versioned at `)([^`]+)(`; `@aceshooting\/lyra-flags` source at `)([^`]+)(`)/g;
const PACKAGE_VERSION = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;

export function updateReadmeStatusLine(readme, { lyraUiVersion, lyraFlagsVersion }) {
  for (const [name, version] of [
    ['@aceshooting/lyra-ui', lyraUiVersion],
    ['@aceshooting/lyra-flags', lyraFlagsVersion],
  ]) {
    if (!PACKAGE_VERSION.test(String(version ?? ''))) {
      throw new Error(`Cannot write README Status: ${name} has invalid version '${version}'.`);
    }
  }

  const matches = [...readme.matchAll(STATUS_LINE)];
  if (matches.length !== 1) {
    throw new Error(
      `Cannot write README Status: expected exactly one source-version line, found ${matches.length}.`,
    );
  }

  return readme.replace(
    STATUS_LINE,
    (_match, uiPrefix, _oldUiVersion, flagsPrefix, _oldFlagsVersion, suffix) =>
      `${uiPrefix}${lyraUiVersion}${flagsPrefix}${lyraFlagsVersion}${suffix}`,
  );
}

function readPackageVersion(directory) {
  const packageJson = JSON.parse(
    readFileSync(path.join(repoRoot, 'packages', directory, 'package.json'), 'utf8'),
  );
  return packageJson.version;
}

function updateRepositoryReadmeStatus() {
  const readmePath = path.join(repoRoot, 'README.md');
  const readme = readFileSync(readmePath, 'utf8');
  const versions = {
    lyraUiVersion: readPackageVersion('lyra-ui'),
    lyraFlagsVersion: readPackageVersion('lyra-flags'),
  };
  const updated = updateReadmeStatusLine(readme, versions);
  if (updated !== readme) writeFileSync(readmePath, updated);
  console.log(
    `README Status now records lyra-ui ${versions.lyraUiVersion} and lyra-flags ${versions.lyraFlagsVersion}.`,
  );
}

if (isMainModule(import.meta.url)) {
  try {
    updateRepositoryReadmeStatus();
  } catch (error) {
    console.error(`README Status update failed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}
