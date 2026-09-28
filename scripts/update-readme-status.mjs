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

export function updateDocumentationCounts(docsIndex, introduction, { tagCount, familyCount }) {
  for (const [name, count] of [
    ['custom-element count', tagCount],
    ['component-family count', familyCount],
  ]) {
    if (!Number.isSafeInteger(count) || count < 1) {
      throw new Error(`Cannot update documentation counts: ${name} must be a positive safe integer.`);
    }
  }

  const docsCount = /\d+ custom elements across \d+ component families/gu;
  const docsMatches = [...docsIndex.matchAll(docsCount)];
  if (docsMatches.length !== 1) {
    throw new Error(
      `Cannot update documentation counts: expected exactly one docs/index.md catalog count, found ${docsMatches.length}.`,
    );
  }

  const introductionCount = /<strong>\d+<\/strong><span>custom elements<\/span>/gu;
  const introductionMatches = [...introduction.matchAll(introductionCount)];
  if (introductionMatches.length !== 1) {
    throw new Error(
      `Cannot update documentation counts: expected exactly one .storybook/Introduction.mdx count, found ${introductionMatches.length}.`,
    );
  }

  return {
    docsIndex: docsIndex.replace(
      docsCount,
      `${tagCount} custom elements across ${familyCount} component families`,
    ),
    introduction: introduction.replace(
      introductionCount,
      `<strong>${tagCount}</strong><span>custom elements</span>`,
    ),
  };
}

function readDocumentationCounts() {
  const manifest = JSON.parse(
    readFileSync(path.join(repoRoot, 'packages/lyra-ui/custom-elements.json'), 'utf8'),
  );
  const tags = new Set(
    (manifest.modules ?? [])
      .flatMap((module) => module.declarations ?? [])
      .filter((declaration) => declaration.customElement && declaration.tagName)
      .map((declaration) => declaration.tagName),
  );
  const componentFamilies = JSON.parse(
    readFileSync(path.join(repoRoot, 'packages/lyra-ui/scripts/component-families.json'), 'utf8'),
  ).families;
  if (!Array.isArray(componentFamilies)) {
    throw new Error('Cannot update documentation counts: component-families.json has no families array.');
  }
  return { tagCount: tags.size, familyCount: componentFamilies.length };
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
  const docsIndexPath = path.join(repoRoot, 'docs/index.md');
  const docsIndex = readFileSync(docsIndexPath, 'utf8');
  const introductionPath = path.join(repoRoot, '.storybook/Introduction.mdx');
  const introduction = readFileSync(introductionPath, 'utf8');
  const counts = readDocumentationCounts();
  const updatedDocumentation = updateDocumentationCounts(docsIndex, introduction, counts);

  // Validate every anchored target before writing any of them, so a moved/duplicated count leaves
  // the release-preparation tree untouched and asks for review instead of guessing.
  if (updated !== readme) writeFileSync(readmePath, updated);
  if (updatedDocumentation.docsIndex !== docsIndex) {
    writeFileSync(docsIndexPath, updatedDocumentation.docsIndex);
  }
  if (updatedDocumentation.introduction !== introduction) {
    writeFileSync(introductionPath, updatedDocumentation.introduction);
  }
  console.log(
    `README Status now records lyra-ui ${versions.lyraUiVersion} and lyra-flags ${versions.lyraFlagsVersion}.`,
  );
  console.log(
    `Documentation counts now record ${counts.tagCount} custom elements across ${counts.familyCount} component families.`,
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
