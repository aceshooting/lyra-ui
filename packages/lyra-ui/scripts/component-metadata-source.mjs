import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseSourceJson as parse,
  assertRegularSourcePath as regularPath,
  readSourceSnapshot as readSnapshot,
  commitSourceWritePlan,
} from './source-fixture-io.mjs';

const defaultPackageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = 'scripts/fixtures/component-metadata';
const aggregate = 'scripts/fixtures/component-metadata.json';
const render = value => `${JSON.stringify(value, null, 2)}\n`;
const compare = (left, right) => String(left).localeCompare(String(right));
const memberKey = entry => `${entry.tag}:${entry.kind}:${entry.name}`;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function keys(value, expected, label) {
  invariant(value && typeof value === 'object' && !Array.isArray(value), `${label}: expected an object`);
  for (const key of Object.keys(value)) invariant(expected.includes(key), `${label}: unexpected key ${key}`);
  for (const key of expected) invariant(Object.hasOwn(value, key), `${label}: missing key ${key}`);
}

/** Read current authored sources. packageDir is the package root, never a release-tag fallback. */
export function readComponentMetadataSources(packageDir = defaultPackageDir) {
  packageDir = path.resolve(packageDir);
  invariant(fs.realpathSync(packageDir) === packageDir, 'Metadata package root must not traverse symlinks');
  const snapshots = [];
  const read = relative => {
    const snapshot = readSnapshot(packageDir, relative);
    snapshots.push(snapshot);
    return parse(snapshot.original, relative);
  };
  const catalog = read('scripts/component-families.json');
  const inventory = read('scripts/fixtures/component-inventory.json');
  const familyNames = catalog.families.map(entry => entry.key);
  invariant(familyNames.every(name => /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name)) && new Set(familyNames).size === familyNames.length, 'Invalid or duplicate family names');
  const familyByTag = Object.fromEntries((inventory.components ?? []).map(entry => [entry.tag, entry.family]));
  // A scaffold enrolls its directory before the first manifest/inventory generation. Existing
  // inventory owners remain authoritative; only a new directory's exact tag can fill that gap.
  for (const [name, family] of Object.entries(catalog.directories ?? {})) {
    const tag = `lr-${name}`;
    if (!Object.hasOwn(familyByTag, tag)) familyByTag[tag] = family;
    else invariant(familyByTag[tag] === family, `${tag}: catalog and inventory family differ`);
  }
  const expected = ['policy.json', 'profiles.json', 'exports.json', 'history.json', 'families'];
  const root = path.join(packageDir, directory);
  regularPath(packageDir, root, { directory: true });
  invariant(JSON.stringify(fs.readdirSync(root).sort()) === JSON.stringify(expected.sort()), 'Unexpected or missing metadata source files');
  regularPath(packageDir, path.join(root, 'families'), { directory: true });
  invariant(JSON.stringify(fs.readdirSync(path.join(root, 'families')).sort()) === JSON.stringify(familyNames.map(name => `${name}.json`).sort()), 'Unexpected or missing metadata family files');
  const policy = read(`${directory}/policy.json`);
  const profiles = read(`${directory}/profiles.json`);
  const exports = read(`${directory}/exports.json`);
  const history = read(`${directory}/history.json`);
  keys(policy, ['schemaVersion', 'metadataSchemaVersion', 'policy'], 'policy.json');
  keys(profiles, ['profiles'], 'profiles.json');
  keys(exports, ['exportDeprecations'], 'exports.json');
  keys(history, ['history'], 'history.json');
  invariant(policy.schemaVersion === 1 && policy.metadataSchemaVersion === 2, 'Unsupported metadata source schema');
  const families = familyNames.map(family => read(`${directory}/families/${family}.json`));
  families.forEach((value, index) => invariant(value.family === familyNames[index], `${familyNames[index]}: family file owner differs`));
  snapshots.push(readSnapshot(packageDir, aggregate, { missing: true }));
  const sources = {
    packageDir, schemaVersion: policy.metadataSchemaVersion, policy: policy.policy,
    profiles: profiles.profiles, exportDeprecations: exports.exportDeprecations, history: history.history,
    familyNames, familyByTag, families, snapshots,
  };
  assembleComponentMetadata(sources);
  return sources;
}

/** Assemble the existing aggregate shape without changing authored record bodies. */
export function assembleComponentMetadata(sources) {
  const assignments = Object.fromEntries(Object.keys(sources.profiles).map(profile => [profile, []]));
  const deprecations = [];
  const assigned = new Set();
  const members = new Set();
  const families = new Set();
  for (const entry of sources.families) {
    keys(entry, ['family', 'assignments', 'deprecations'], 'family metadata');
    invariant(sources.familyNames.includes(entry.family) && !families.has(entry.family), `Invalid or duplicate family ${entry.family}`);
    families.add(entry.family);
    const own = tag => invariant(sources.familyByTag[tag] === entry.family, `${tag}: expected family ${String(sources.familyByTag[tag])}, found ${entry.family}`);
    keys(entry.assignments, Object.keys(sources.profiles), `${entry.family} assignment profiles`);
    for (const [profile, tags] of Object.entries(entry.assignments)) {
      invariant(Array.isArray(tags), `${profile}: assignments must be an array`);
      for (const tag of tags) {
        own(tag);
        invariant(!assigned.has(tag), `${tag}: duplicate maturity assignment`);
        assigned.add(tag);
        assignments[profile].push(tag);
      }
    }
    invariant(Array.isArray(entry.deprecations), `${entry.family}: deprecations must be an array`);
    for (const record of entry.deprecations) {
      own(record.tag);
      const key = JSON.stringify([record.tag, record.kind, record.name]);
      invariant(!members.has(key), `${key}: duplicate member notice`);
      members.add(key);
      deprecations.push(record);
    }
  }
  invariant(families.size === sources.familyNames.length, 'Missing metadata family');
  for (const tags of Object.values(assignments)) tags.sort(compare);
  deprecations.sort((left, right) => compare(memberKey(left), memberKey(right)));
  invariant(Array.isArray(sources.exportDeprecations), 'exportDeprecations must be an array');
  const exports = new Set();
  for (const entry of sources.exportDeprecations) {
    const key = JSON.stringify([entry.kind, entry.module ?? null, entry.name]);
    invariant(!exports.has(key), `${key}: duplicate export notice`);
    exports.add(key);
  }
  invariant(sources.history && typeof sources.history === 'object' && !Array.isArray(sources.history), 'history must be an object');
  return structuredClone({
    schemaVersion: sources.schemaVersion, policy: sources.policy, profiles: sources.profiles,
    assignments, deprecations, exportDeprecations: sources.exportDeprecations, history: sources.history,
  });
}

/** Prepare the source documents for a validated next aggregate; no filesystem writes. */
export function partitionComponentMetadata(metadata, { familyNames, familyByTag }) {
  keys(metadata, ['schemaVersion', 'policy', 'profiles', 'assignments', 'deprecations', 'exportDeprecations', 'history'], 'metadata');
  invariant(metadata.schemaVersion === 2, 'Unsupported metadata aggregate schema');
  keys(metadata.assignments, Object.keys(metadata.profiles), 'metadata assignments');
  const families = familyNames.map(family => ({
    family, assignments: Object.fromEntries(Object.keys(metadata.profiles).map(profile => [profile, []])), deprecations: [],
  }));
  const owner = tag => {
    const family = families.find(entry => entry.family === familyByTag[tag]);
    invariant(family, `${tag}: missing metadata family owner`);
    return family;
  };
  for (const [profile, tags] of Object.entries(metadata.assignments)) for (const tag of tags) owner(tag).assignments[profile].push(tag);
  for (const record of metadata.deprecations) owner(record.tag).deprecations.push(record);
  const assembled = assembleComponentMetadata({ ...metadata, families, familyNames, familyByTag });
  invariant(JSON.stringify(assembled) === JSON.stringify(metadata), 'Metadata aggregate is not in canonical source order');
  return Object.fromEntries([
    ['policy.json', { schemaVersion: 1, metadataSchemaVersion: metadata.schemaVersion, policy: metadata.policy }],
    ['profiles.json', { profiles: metadata.profiles }],
    ['exports.json', { exportDeprecations: metadata.exportDeprecations }],
    ['history.json', { history: metadata.history }],
    ...families.map(entry => [`families/${entry.family}.json`, entry]),
  ].map(([file, value]) => [`${directory}/${file}`, render(value)]));
}

export function componentMetadataSourceFindings(sources) {
  const original = sources.snapshots.find(entry => entry.file === path.join(sources.packageDir, aggregate))?.original;
  return original === render(assembleComponentMetadata(sources)) ? [] : ['component-metadata.json differs from its authored sources'];
}

/** Include extra generated/source edits in the same validation and concurrent-edit guard. */
export function createComponentMetadataWritePlan(sources, metadata, { extraWrites = [], guards = [], includeAggregate = true, familyByTag = sources.familyByTag } = {}) {
  const writes = partitionComponentMetadata(metadata, { ...sources, familyByTag });
  if (includeAggregate) writes[aggregate] = render(metadata);
  const entries = new Map(sources.snapshots.map(snapshot => [snapshot.file, { ...snapshot, expected: snapshot.original }]));
  for (const guard of guards) {
    invariant(!entries.has(guard.file) || entries.get(guard.file).original === guard.original, `Conflicting snapshot: ${guard.file}`);
    entries.set(guard.file, { ...guard, expected: guard.original });
  }
  for (const [relative, expected] of Object.entries(writes)) {
    const file = path.join(sources.packageDir, relative);
    invariant(entries.has(file), `Missing source snapshot: ${file}`);
    entries.get(file).expected = expected;
  }
  for (const write of extraWrites) {
    invariant(!entries.has(write.file) || entries.get(write.file).original === write.original, `Conflicting snapshot: ${write.file}`);
    entries.set(write.file, { ...write });
  }
  return { packageDir: sources.packageDir, entries: [...entries.values()] };
}

export function commitComponentMetadataWritePlan(plan) {
  commitSourceWritePlan({ root: plan.packageDir, entries: plan.entries });
}
