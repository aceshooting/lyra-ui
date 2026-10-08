#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { isMainModule } from './is-main-module.mjs';
import { walk } from './lib/fs-walk.mjs';

const defaultPackageDir = fileURLToPath(new URL('..', import.meta.url));
const defaultRepoRoot = path.resolve(defaultPackageDir, '..', '..');
const PACKAGE_DOC_FILES = Object.freeze(['README.md', 'llms.txt', 'llms-full.txt']);
const PACKAGE_DOC_ROOTS = Object.freeze(['llms']);
const PLUGIN_DOC_ROOTS = Object.freeze([
  'plugins/lyra-ui/commands',
  'plugins/lyra-ui/skills/lyra-ui/references',
]);

function walkDocumentation(directory, files = []) {
  files.push(...walk(directory).filter((file) => /\.(?:md|txt)$/i.test(file)));
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

function addArchivedVersions(released, repoRoot, findings) {
  if (released.size === 0) return;
  const currentMajor = Math.max(...[...released].map((version) => Number(version.split('.')[0])));
  const archiveDirectory = path.join(repoRoot, 'docs/changelog');
  if (!existsSync(archiveDirectory)) return;
  // The archiver's v<major>.md files are the history index. Unrelated Markdown and paths outside
  // this directory cannot establish a release, and an old-major archive cannot admit a future one.
  for (const entry of readdirSync(archiveDirectory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const match = /^v(0|[1-9]\d*)\.md$/.exec(entry.name);
    if (!match) continue;
    const label = `docs/changelog/${entry.name}`;
    const major = Number(match[1]);
    if (!entry.isFile()) {
      findings.push(`${label} must be a regular release archive file`);
      continue;
    }
    if (!Number.isSafeInteger(major) || major >= currentMajor) {
      findings.push(`${label} must archive a major older than current major ${currentMajor}`);
      continue;
    }
    const versions = changelogVersions(readFileSync(path.join(archiveDirectory, entry.name), 'utf8'));
    if (versions.size === 0) findings.push(`${label} contains zero release-version headings`);
    for (const version of versions) {
      if (Number(version.split('.')[0]) !== major) {
        findings.push(`${label} contains release ${version} outside archive major ${major}`);
      } else released.add(version);
    }
  }
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
  addArchivedVersions(released, repoRoot, findings);
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
        `${relative}:${low + 1} cites new in ${version}, but release history has no ${version} heading`,
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
    console.error('Documentation release references or changelog archives are invalid:');
    for (const finding of findings) console.error(`  - ${finding}`);
    process.exitCode = 1;
  } else {
    console.log(
      `documentation new-in versions all resolve to current or archived releases `
      + `(${referencesChecked} references across ${filesChecked} files).`,
    );
  }
}
