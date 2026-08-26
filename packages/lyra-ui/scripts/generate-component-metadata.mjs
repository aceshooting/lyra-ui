import { isMainModule } from './is-main-module.mjs';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  annotateComponentSource,
  applyComponentMetadataToManifest,
  applyMaturityToInventory,
  buildReleaseHistory,
  currentHistoryRecord,
  partitionReleaseHistoryAtCurrent,
  reconcileCurrentReleaseHistory,
  requireCompleteGitHistory,
  validateComponentMetadata,
} from './component-metadata.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(packageDir, '..', '..');
const metadataPath = path.join(scriptDir, 'fixtures', 'component-metadata.json');
const inventoryPath = path.join(scriptDir, 'fixtures', 'component-inventory.json');
const manifestPath = path.join(packageDir, 'custom-elements.json');
const packageJsonPath = path.join(packageDir, 'package.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function sourceAnnotationChanges(inventory) {
  const changes = [];
  for (const component of inventory.components ?? []) {
    const file = path.join(packageDir, component.classModule);
    const source = fs.readFileSync(file, 'utf8');
    const expected = annotateComponentSource(source, {
      tag: component.tag,
      status: component.maturity.status,
      since: component.maturity.since,
    });
    if (source !== expected) changes.push({ component, file, original: source, expected });
  }
  return changes;
}

function sourceAnnotationFindings(changes) {
  return changes.map(({ component }) =>
    `${component.tag}: source @status/@since annotations drifted`);
}

function writeSourceAnnotations(changes) {
  for (const { component, file, original } of changes) {
    if (fs.readFileSync(file, 'utf8') !== original) {
      throw new Error(`${component.tag}: source changed while component metadata was being prepared`);
    }
  }
  for (const { file, expected } of changes) {
    fs.writeFileSync(file, expected);
  }
}

function parseArguments(argv) {
  const options = { check: argv.length === 0, write: false, refreshHistory: false };
  for (const argument of argv) {
    if (argument === '--check') options.check = true;
    else if (argument === '--write') options.write = true;
    else if (argument === '--refresh-history') {
      options.refreshHistory = true;
      options.write = true;
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  if (options.check && options.write) throw new Error('--check and write modes are mutually exclusive');
  return options;
}

export function run(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  requireCompleteGitHistory(repoRoot);
  let metadata = readJson(metadataPath);
  let inventory = readJson(inventoryPath);
  const rawManifest = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(rawManifest);
  const packageJson = readJson(packageJsonPath);
  let nextCurrent = currentHistoryRecord(packageJson.version, rawManifest, manifest);
  let validationManifest = manifest;
  let validationRawManifest = rawManifest;
  let sourceChanges = [];
  let nextReleases = metadata.history?.releases ?? [];
  let nextTaggedCurrent = metadata.history?.taggedCurrent ?? null;
  const rolloverCurrent = packageJson.version !== metadata.history?.current?.version;

  if (options.refreshHistory) {
    const previousTags = new Set((metadata.history?.releases ?? []).map((release) => release.tag));
    const reproduced = buildReleaseHistory(repoRoot, metadata.history.manifestPath);
    const refreshedTags = new Set(reproduced.map((release) => release.tag));
    const missing = [...previousTags].filter((tag) => !refreshedTags.has(tag));
    if (missing.length) {
      throw new Error(`Refusing to truncate checked-in release history; missing local tags: ${missing.join(', ')}`);
    }
    const partitioned = partitionReleaseHistoryAtCurrent(reproduced, metadata.history?.current, {
      taggedCurrent: nextTaggedCurrent,
    });
    nextReleases = rolloverCurrent ? reproduced : partitioned.releases;
    nextTaggedCurrent = rolloverCurrent ? null : partitioned.taggedCurrent;
  } else if (options.write) {
    const reproduced = buildReleaseHistory(repoRoot, metadata.history.manifestPath);
    const reconciled = reconcileCurrentReleaseHistory(metadata.history, reproduced, {
      rolloverCurrent,
    });
    nextReleases = reconciled.releases;
    nextTaggedCurrent = reconciled.taggedCurrent;
  }

  if (options.write) {
    metadata = {
      ...metadata,
      history: {
        ...metadata.history,
        releases: nextReleases,
        taggedCurrent: nextTaggedCurrent,
        current: nextCurrent,
      },
    };
    // A metadata transition can itself change the CEM projection (most notably, a post-tag
    // component moves from `unreleased` to the newly bumped version). Predict the deterministic
    // final manifest bytes so history.current records what the required subsequent manifest run
    // will write, instead of either blocking the transition or checking in a stale digest.
    validationManifest = structuredClone(manifest);
    applyComponentMetadataToManifest(metadata, validationManifest, {
      packageVersion: packageJson.version,
    });
    validationRawManifest = `${JSON.stringify(validationManifest)}\n`;
    nextCurrent = currentHistoryRecord(
      packageJson.version,
      validationRawManifest,
      validationManifest,
    );
    metadata = {
      ...metadata,
      history: { ...metadata.history, current: nextCurrent },
    };
    inventory = applyMaturityToInventory(metadata, inventory, {
      packageVersion: packageJson.version,
    });
    // Build every source edit before touching disk. A detached/malformed component JSDoc or a
    // central policy/CEM mismatch must be detected before any file changes instead of validation
    // leaving a partial mass annotation behind.
    sourceChanges = sourceAnnotationChanges(inventory);
  }

  const findings = validateComponentMetadata(metadata, {
    inventory,
    manifest: validationManifest,
    packageJson,
    rawManifest: validationRawManifest,
  });
  if (findings.length) {
    throw new Error(`Component metadata validation failed:\n- ${findings.join('\n- ')}`);
  }
  if (!options.write) sourceChanges = sourceAnnotationChanges(inventory);
  const annotationFindings = sourceAnnotationFindings(sourceChanges);
  if (!options.write && annotationFindings.length) {
    throw new Error(`Component source metadata validation failed:\n- ${annotationFindings.join('\n- ')}`);
  }

  if (options.write) {
    writeSourceAnnotations(sourceChanges);
    writeJson(metadataPath, metadata);
    writeJson(inventoryPath, inventory);
  }

  if (options.check) {
    const reproduced = buildReleaseHistory(repoRoot, metadata.history.manifestPath);
    reconcileCurrentReleaseHistory(metadata.history, reproduced, {
      requirePersistedTaggedCurrent: true,
    });
  }
  console.log(`Component metadata covers ${inventory.components.length} components with reproducible history.`);
}

if (isMainModule(import.meta.url)) run();
