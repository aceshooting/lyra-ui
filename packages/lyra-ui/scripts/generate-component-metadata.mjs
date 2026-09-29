import { isMainModule } from './is-main-module.mjs';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compactManifest } from './manifest-compact.mjs';
import {
  assembleComponentMetadata,
  commitComponentMetadataWritePlan,
  componentMetadataSourceFindings,
  createComponentMetadataWritePlan,
  readComponentMetadataSources,
} from './component-metadata-source.mjs';

import {
  annotateComponentSource,
  applyComponentMetadataToManifest,
  applyMaturityToInventory,
  buildReleaseHistory,
  currentHistoryRecord,
  partitionReleaseHistoryAtCurrent,
  reconcileCurrentReleaseHistory,
  requireCompleteGitHistory,
  stampUnreleasedDeprecations,
  validateComponentMetadata,
} from './component-metadata.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(packageDir, '..', '..');
const inventoryPath = path.join(scriptDir, 'fixtures', 'component-inventory.json');
const manifestPath = path.join(packageDir, 'custom-elements.json');
const packageJsonPath = path.join(packageDir, 'package.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sourceAnnotationChanges(inventory, readSource) {
  const changes = [];
  for (const component of inventory.components ?? []) {
    const file = path.join(packageDir, component.classModule);
    const source = readSource(component.classModule);
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

/**
 * The metadata a write persists: the reconciled history, plus -- on a version rollover, which is
 * when `pnpm release:prepare` runs this after `changeset version` -- every `since: 'unreleased'`
 * deprecation stamped with the version being released, so no record ships reading `unreleased`.
 */
export function nextWriteMetadata(
  metadata,
  { releases, taggedCurrent, current, rolloverCurrent, packageVersion },
) {
  const stamped = rolloverCurrent ? stampUnreleasedDeprecations(metadata, packageVersion) : metadata;
  return {
    ...stamped,
    history: {
      ...stamped.history,
      releases,
      taggedCurrent,
      current,
    },
  };
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
  const sources = readComponentMetadataSources(packageDir);
  let metadata = assembleComponentMetadata(sources);
  let inventory = readJson(inventoryPath);
  const rawManifest = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(rawManifest);
  const rawPackageJson = fs.readFileSync(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(rawPackageJson);
  const sourceGuards = new Map();
  const readSource = relative => {
    const file = path.join(packageDir, relative);
    if (sourceGuards.has(file)) return sourceGuards.get(file).original;
    let original;
    try { original = fs.readFileSync(file, 'utf8'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; original = null; }
    sourceGuards.set(file, { file, original });
    return original;
  };
  let nextCurrent = currentHistoryRecord(packageJson.version, rawManifest, manifest);
  let validationManifest = manifest;
  let validationRawManifest = rawManifest;
  let sourceChanges = [];
  let committedWrites = [];
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
    metadata = nextWriteMetadata(metadata, {
      releases: nextReleases,
      taggedCurrent: nextTaggedCurrent,
      current: nextCurrent,
      rolloverCurrent,
      packageVersion: packageJson.version,
    });
    // A metadata transition can itself change the CEM projection (most notably, a post-tag
    // component moves from `unreleased` to the newly bumped version). Predict the deterministic
    // final manifest bytes so history.current records what the required subsequent manifest run
    // will write, instead of either blocking the transition or checking in a stale digest.
    validationManifest = structuredClone(manifest);
    applyComponentMetadataToManifest(metadata, validationManifest, {
      packageVersion: packageJson.version,
    });
    validationManifest = compactManifest(validationManifest);
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
    sourceChanges = sourceAnnotationChanges(inventory, readSource);
  }

  const findings = validateComponentMetadata(metadata, {
    inventory,
    manifest: validationManifest,
    packageJson,
    rawManifest: validationRawManifest,
    readSource,
  });
  if (findings.length) {
    throw new Error(`Component metadata validation failed:\n- ${findings.join('\n- ')}`);
  }
  if (!options.write) sourceChanges = sourceAnnotationChanges(inventory, readSource);
  const annotationFindings = sourceAnnotationFindings(sourceChanges);
  if (!options.write && annotationFindings.length) {
    throw new Error(`Component source metadata validation failed:\n- ${annotationFindings.join('\n- ')}`);
  }
  if (!options.write) {
    const sourceFindings = componentMetadataSourceFindings(sources);
    if (sourceFindings.length) throw new Error(sourceFindings.join('\n'));
  }

  if (options.write) {
    const originalInventory = sources.snapshots.find(entry => entry.file === inventoryPath).original;
    const plan = createComponentMetadataWritePlan(sources, metadata, {
      guards: [
        { file: manifestPath, original: rawManifest },
        { file: packageJsonPath, original: rawPackageJson },
        ...sourceGuards.values(),
      ],
      extraWrites: [
        ...sourceChanges,
        { file: inventoryPath, original: originalInventory, expected: `${JSON.stringify(inventory, null, 2)}\n` },
      ],
    });
    commitComponentMetadataWritePlan(plan);
    committedWrites = plan.entries.filter(entry => entry.original !== entry.expected);
  }

  if (options.check) {
    const reproduced = buildReleaseHistory(repoRoot, metadata.history.manifestPath);
    reconcileCurrentReleaseHistory(metadata.history, reproduced, {
      requirePersistedTaggedCurrent: true,
    });
  }
  console.log(`Component metadata covers ${inventory.components.length} components with reproducible history.`);
  return committedWrites;
}

if (isMainModule(import.meta.url)) run();
