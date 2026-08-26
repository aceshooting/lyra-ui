#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { isMainModule } from './is-main-module.mjs';

const defaultPackageDir = fileURLToPath(new URL('..', import.meta.url));
const defaultRepoRoot = path.resolve(defaultPackageDir, '..', '..');
const PACKAGE_DOC_FILES = Object.freeze(['README.md', 'llms.txt', 'llms-full.txt']);
const PACKAGE_DOC_ROOTS = Object.freeze(['llms']);
const PLUGIN_DOC_ROOTS = Object.freeze([
  'plugins/lyra-ui/commands',
  'plugins/lyra-ui/skills/lyra-ui/references',
]);

function walkDocumentation(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walkDocumentation(entryPath, files);
    else if (entry.isFile() && /\.(?:md|txt)$/i.test(entry.name)) files.push(entryPath);
  }
  return files;
}

function addFileIfPresent(files, file) {
  try {
    if (statSync(file).isFile()) files.push(file);
  } catch {
    // Generated documentation may legitimately be absent before its build step.
  }
}

function addRootIfPresent(files, directory) {
  try {
    if (statSync(directory).isDirectory()) walkDocumentation(directory, files);
  } catch {
    // Optional generated/plugin documentation may not exist in a source package checkout.
  }
}

function scannedDocumentation(packageDir, repoRoot) {
  const files = [];
  for (const name of PACKAGE_DOC_FILES) addFileIfPresent(files, path.join(packageDir, name));
  for (const root of PACKAGE_DOC_ROOTS) addRootIfPresent(files, path.join(packageDir, root));
  for (const root of PLUGIN_DOC_ROOTS) addRootIfPresent(files, path.join(repoRoot, root));
  return [...new Set(files)].sort();
}

function changelogVersions(contents) {
  return new Set(
    [...contents.matchAll(/^##\s+\[?v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\]?\s*$/gm)]
      .map((match) => match[1]),
  );
}

/**
 * Finds release-version annotations that promise an API was "new in" a version with no matching
 * changelog release heading.
 */
export function checkDocVersionReferences(
  packageDir = defaultPackageDir,
  { repoRoot = packageDir === defaultPackageDir ? defaultRepoRoot : packageDir } = {},
) {
  const changelogFile = path.join(packageDir, 'CHANGELOG.md');
  const released = changelogVersions(readFileSync(changelogFile, 'utf8'));
  const findings = [];
  const files = scannedDocumentation(packageDir, repoRoot);
  let referencesChecked = 0;
  const versionReference = /\bnew\s+in\s+v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?)\b/gi;

  if (released.size === 0) findings.push('CHANGELOG.md contains zero release-version headings');

  for (const file of files) {
    const contents = readFileSync(file, 'utf8');
    const relative = path.relative(packageDir, file).replaceAll('\\', '/');
    const lineStarts = [0];
    for (let index = 0; index < contents.length; index += 1) {
      if (contents[index] === '\n') lineStarts.push(index + 1);
    }
    for (const match of contents.matchAll(versionReference)) {
      referencesChecked += 1;
      const version = match[1];
      if (released.has(version)) continue;
      let low = 0;
      let high = lineStarts.length;
      while (low + 1 < high) {
        const middle = Math.floor((low + high) / 2);
        if (lineStarts[middle] <= match.index) low = middle;
        else high = middle;
      }
      findings.push(
        `${relative}:${low + 1} cites new in ${version}, but CHANGELOG.md has no ${version} heading`,
      );
    }
  }

  if (files.length === 0) findings.push('documentation scan found zero files');
  if (referencesChecked === 0) {
    findings.push('documentation scan found zero "new in X.Y.Z" version references');
  }

  return {
    findings: findings.sort(),
    filesChecked: files.length,
    referencesChecked,
    releasesChecked: released.size,
  };
}

if (isMainModule(import.meta.url)) {
  const { findings, filesChecked, referencesChecked } = checkDocVersionReferences();
  if (findings.length > 0) {
    console.error('Documentation cites release versions absent from CHANGELOG.md:');
    for (const finding of findings) console.error(`  - ${finding}`);
    process.exitCode = 1;
  } else {
    console.log(
      `documentation new-in versions all resolve to CHANGELOG.md releases `
      + `(${referencesChecked} references across ${filesChecked} files).`,
    );
  }
}
