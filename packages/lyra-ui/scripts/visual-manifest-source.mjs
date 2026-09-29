import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertRegularSourcePath, commitSourceWritePlan, parseSourceJson, readSourceSnapshot } from './source-fixture-io.mjs';
import { validateVisualQualificationManifest } from './qualification-ledger.mjs';

const defaultPackageDir = fileURLToPath(new URL('..', import.meta.url));
const directory = 'visual-baselines/manifest-sources';
const aggregate = 'visual-baselines/manifest.json';
const globalKeys = ['axes', 'coverageProfiles', 'untaggedStories', 'provenance', 'baselineReview'];
const render = value => `${JSON.stringify(value, null, 2)}\n`;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function invariant(condition, message) { if (!condition) throw new Error(message); }
function keys(value, expected, label) {
  invariant(value && typeof value === 'object' && !Array.isArray(value), `${label}: expected object`);
  invariant(same(Object.keys(value).sort(), [...expected].sort()), `${label}: unknown or missing keys`);
}
function uniqueStrings(values, label) {
  invariant(Array.isArray(values) && values.every(value => typeof value === 'string' && value.length > 0) && new Set(values).size === values.length, `${label}: invalid or duplicate entries`);
}
function validateSemantics(manifest, familyByTag) {
  const inventory = { components: Object.keys(familyByTag).map(tag => ({ tag })) };
  const findings = validateVisualQualificationManifest(manifest, inventory);
  invariant(!findings.length, `Visual qualification manifest failed:\n- ${findings.join('\n- ')}`);
}

/** Current consumers require fresh output; only the aggregate repair generator opts out. */
export function readVisualManifestSources({ packageDir = defaultPackageDir, aggregatePath = aggregate, allowStaleAggregate = false } = {}) {
  packageDir = path.resolve(packageDir);
  const aggregateFile = path.resolve(packageDir, aggregatePath);
  const snapshots = [];
  const read = relative => {
    const snapshot = readSourceSnapshot(packageDir, relative);
    snapshots.push(snapshot);
    return parseSourceJson(snapshot.original, relative);
  };
  const catalog = read('scripts/component-families.json');
  const inventory = read('scripts/fixtures/component-inventory.json');
  const familyNames = catalog.families.map(family => family.key).sort();
  uniqueStrings(familyNames, 'family catalog');
  invariant(familyNames.every(family => /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(family)), 'Unsafe family name');
  const familyByTag = Object.create(null);
  for (const component of inventory.components) {
    invariant(typeof component.tag === 'string' && !Object.hasOwn(familyByTag, component.tag) && familyNames.includes(component.family), 'Invalid or duplicate inventory owner');
    familyByTag[component.tag] = component.family;
  }
  const root = path.join(packageDir, directory);
  assertRegularSourcePath(packageDir, root, { directory: true });
  invariant(same(fs.readdirSync(root).sort(), ['families', 'global.json', 'index.json']), 'Unknown or missing visual source files');
  assertRegularSourcePath(packageDir, path.join(root, 'families'), { directory: true });
  invariant(same(fs.readdirSync(path.join(root, 'families')).sort(), familyNames.map(family => `${family}.json`)), 'Unknown or missing visual family files');
  const index = read(`${directory}/index.json`);
  const global = read(`${directory}/global.json`);
  const families = familyNames.map(family => {
    const value = read(`${directory}/families/${family}.json`);
    invariant(value.family === family, `${family}: source file owner mismatch`);
    return value;
  });
  invariant(!snapshots.some(snapshot => snapshot.file === aggregateFile), 'Visual aggregate must not overlap an authored input');
  snapshots.push(readSourceSnapshot(packageDir, path.relative(packageDir, aggregateFile), { missing: true }));
  const sources = { packageDir, aggregateFile, familyNames, familyByTag, index, global, families, snapshots };
  assembleVisualManifest(sources);
  sources.storyOwners = Object.fromEntries(index.stories.map(story => [story.id, story.family]));
  if (!allowStaleAggregate) {
    const findings = visualManifestSourceFindings(sources);
    invariant(!findings.length, findings.join('\n'));
  }
  return sources;
}

/** Rebuild the stable facade without sorting, normalizing or inventing record fields. */
export function assembleVisualManifest(sources) {
  const { index, global, families, familyNames, familyByTag } = sources;
  keys(index, ['schemaVersion', 'manifestSchemaVersion', 'families', 'stories', 'tagOrder'], 'visual index');
  keys(global, globalKeys, 'visual global');
  invariant(index.schemaVersion === 1 && index.manifestSchemaVersion === 1, 'Unsupported visual source schema');
  invariant(same(index.families, familyNames), 'Visual index family inventory differs');
  invariant(Array.isArray(index.stories), 'Invalid story index');
  uniqueStrings(index.stories.map(story => story.id), 'story index');
  uniqueStrings(index.tagOrder, 'tag order');
  for (const row of index.stories) {
    keys(row, ['id', 'family'], 'story owner');
    invariant(familyNames.includes(row.family), `${row.id}: unknown story owner`);
  }
  invariant(Array.isArray(families) && same(families.map(family => family.family), familyNames), 'Missing or duplicate family sources');
  const stories = new Map();
  const coverage = new Map();
  for (const family of families) {
    keys(family, ['family', 'stories', 'tagCoverage'], 'visual family');
    invariant(Array.isArray(family.stories), `${family.family}: invalid stories`);
    invariant(same(family.stories.map(story => story.id), index.stories.filter(row => row.family === family.family).map(row => row.id)), `${family.family}: story order or ownership mismatch`);
    const expectedTags = index.tagOrder.filter(tag => familyByTag[tag] === family.family);
    keys(family.tagCoverage, expectedTags, `${family.family} tag coverage`);
    invariant(same(Object.keys(family.tagCoverage), expectedTags), `${family.family}: tag order mismatch`);
    for (const story of family.stories) {
      invariant(!stories.has(story.id), `${story.id}: duplicate story`);
      stories.set(story.id, story);
    }
    for (const [tag, ids] of Object.entries(family.tagCoverage)) {
      invariant(!coverage.has(tag), `${tag}: duplicate coverage owner`);
      uniqueStrings(ids, `${tag} story references`);
      coverage.set(tag, ids);
    }
  }
  for (const tag of index.tagOrder) invariant(Object.hasOwn(familyByTag, tag) && coverage.has(tag), `${tag}: unknown or missing tag owner`);
  for (const [tag, ids] of coverage) for (const id of ids) invariant(stories.has(id), `${tag}: unknown story reference ${id}`);
  return structuredClone({
    schemaVersion: index.manifestSchemaVersion, axes: global.axes, coverageProfiles: global.coverageProfiles,
    stories: index.stories.map(row => stories.get(row.id)),
    tagCoverage: Object.fromEntries(index.tagOrder.map(tag => [tag, coverage.get(tag)])),
    untaggedStories: global.untaggedStories, provenance: global.provenance, baselineReview: global.baselineReview,
  });
}

/** Explicit ownership is required even for stories referenced from several component families. */
export function partitionVisualManifest(manifest, { familyNames, familyByTag, storyOwners }) {
  keys(manifest, ['schemaVersion', 'axes', 'coverageProfiles', 'stories', 'tagCoverage', 'untaggedStories', 'provenance', 'baselineReview'], 'visual manifest');
  uniqueStrings(familyNames, 'family names');
  invariant(same(familyNames, [...familyNames].sort()) && familyNames.every(family => /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(family)), 'Invalid family inventory');
  uniqueStrings(manifest.stories.map(story => story.id), 'manifest stories');
  keys(storyOwners, manifest.stories.map(story => story.id), 'story owners');
  const index = {
    schemaVersion: 1, manifestSchemaVersion: manifest.schemaVersion, families: [...familyNames],
    stories: manifest.stories.map(story => ({ id: story.id, family: storyOwners[story.id] })),
    tagOrder: Object.keys(manifest.tagCoverage),
  };
  const global = Object.fromEntries(globalKeys.map(key => [key, manifest[key]]));
  const families = familyNames.map(family => ({
    family, stories: manifest.stories.filter(story => storyOwners[story.id] === family),
    tagCoverage: Object.fromEntries(Object.entries(manifest.tagCoverage).filter(([tag]) => familyByTag[tag] === family)),
  }));
  const assembled = assembleVisualManifest({ index, global, families, familyNames, familyByTag });
  invariant(same(assembled, manifest), 'Visual manifest is not in canonical aggregate order');
  validateSemantics(assembled, familyByTag);
  return Object.fromEntries([
    [`${directory}/index.json`, index], [`${directory}/global.json`, global],
    ...families.map(family => [`${directory}/families/${family.family}.json`, family]),
  ].map(([file, value]) => [file, render(value)]));
}

export function visualManifestSourceFindings(sources) {
  const original = sources.snapshots.find(snapshot => snapshot.file === sources.aggregateFile)?.original;
  return original === render(assembleVisualManifest(sources)) ? [] : [`${path.relative(sources.packageDir, sources.aggregateFile)} is stale or missing; regenerate the aggregate`];
}

/** Enrollment changes cannot approve baseline evidence or rewrite capture provenance. */
export function createVisualManifestSourceWritePlan(sources, manifest, { storyOwners = {} } = {}) {
  const current = assembleVisualManifest(sources);
  for (const key of ['provenance', 'baselineReview']) invariant(same(current[key], manifest[key]), `Visual enrollment cannot change ${key}`);
  const ids = new Set(manifest.stories.map(story => story.id));
  invariant(Object.keys(storyOwners).every(id => ids.has(id)), 'Unknown story owner override');
  const owners = Object.fromEntries(manifest.stories.map(story => [story.id, Object.hasOwn(storyOwners, story.id) ? storyOwners[story.id] : sources.storyOwners[story.id]]));
  const writes = partitionVisualManifest(manifest, { ...sources, storyOwners: owners });
  writes[path.relative(sources.packageDir, sources.aggregateFile)] = render(manifest);
  const entries = sources.snapshots.map(snapshot => ({ ...snapshot, expected: writes[path.relative(sources.packageDir, snapshot.file)] ?? snapshot.original }));
  invariant(Object.keys(writes).every(relative => entries.some(entry => entry.file === path.join(sources.packageDir, relative))), 'Missing visual source snapshot');
  return { root: sources.packageDir, entries };
}

export function commitVisualManifestSourceWritePlan(plan) { commitSourceWritePlan(plan); }
