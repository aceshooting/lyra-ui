import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  assembleComponentMetadata,
  commitComponentMetadataWritePlan,
  componentMetadataSourceFindings,
  createComponentMetadataWritePlan,
  partitionComponentMetadata,
  readComponentMetadataSources,
} from './component-metadata-source.mjs';
import { nextWriteMetadata } from './generate-component-metadata.mjs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDirectory = 'scripts/fixtures/component-metadata';
const aggregatePath = 'scripts/fixtures/component-metadata.json';
const render = value => `${JSON.stringify(value, null, 2)}\n`;
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const syntheticExportNotice = {
  kind: 'entry-point', name: './fixture-legacy.js', since: 'unreleased',
  replacement: { kind: 'entry-point', name: './fixture-current.js' },
  removalNotBefore: '27.0.0', rationale: 'Synthetic source-partition fixture.',
};

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metadata-source-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const file of ['scripts/component-families.json', 'scripts/fixtures/component-inventory.json', aggregatePath]) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.copyFileSync(path.join(packageDir, file), path.join(root, file));
  }
  fs.cpSync(path.join(packageDir, sourceDirectory), path.join(root, sourceDirectory), { recursive: true });
  return root;
}

function change(root, relative, mutate) {
  const file = path.join(root, sourceDirectory, relative);
  const value = read(file);
  mutate(value);
  fs.writeFileSync(file, render(value));
}

function snapshot(root) {
  const result = {};
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else result[path.relative(root, file)] = fs.readFileSync(file, 'utf8');
    }
  }
  visit(root);
  return result;
}

test('authored metadata sources reproduce the aggregate bytes and detached record bodies', () => {
  const sources = readComponentMetadataSources(packageDir);
  const aggregate = assembleComponentMetadata(sources);
  assert.equal(render(aggregate), fs.readFileSync(path.join(packageDir, aggregatePath), 'utf8'));
  assert.deepEqual(componentMetadataSourceFindings(sources), []);
  aggregate.deprecations[0].rationale = 'changed detached view';
  assert.notEqual(assembleComponentMetadata(sources).deprecations[0].rationale, aggregate.deprecations[0].rationale);
});

test('an authored family edit is visible before refreshing the generated aggregate', t => {
  const root = fixture(t);
  change(root, 'families/media.json', value => { value.deprecations[0].rationale += ' Additional context.'; });
  const sources = readComponentMetadataSources(root);
  const aggregate = assembleComponentMetadata(sources);
  assert.ok(aggregate.deprecations.some(entry => entry.rationale.endsWith(' Additional context.')));
  assert.deepEqual(componentMetadataSourceFindings(sources), ['component-metadata.json differs from its authored sources']);
});

test('the CEM metadata plugin reads its package sources when the aggregate is stale', async t => {
  const root = fixture(t);
  fs.copyFileSync(path.join(packageDir, 'package.json'), path.join(root, 'package.json'));
  let changedTag;
  change(root, 'families/media.json', value => {
    changedTag = value.deprecations[0].tag;
    value.deprecations[0].rationale = 'An updated authored family rationale.';
  });
  const configSource = fs.readFileSync(path.join(packageDir, 'custom-elements-manifest.config.js'), 'utf8')
    .replaceAll("from './scripts/", `from '${pathToFileURL(path.join(packageDir, 'scripts/')).href}`);
  const configPath = path.join(root, 'custom-elements-manifest.config.js');
  fs.writeFileSync(configPath, configSource);
  const config = (await import(pathToFileURL(configPath).href)).default;
  const manifest = read(path.join(packageDir, 'custom-elements.json'));
  config.plugins.find(plugin => plugin.name === 'lr-component-maturity-metadata').packageLinkPhase({ customElementsManifest: manifest });
  const declaration = manifest.modules.flatMap(module => module.declarations ?? []).find(entry => entry.tagName === changedTag);
  assert.ok(declaration.deprecations.some(entry => entry.rationale === 'An updated authored family rationale.'));
});

for (const [name, mutate, pattern] of [
  ['missing family', root => fs.unlinkSync(path.join(root, sourceDirectory, 'families/forms.json')), /missing|ENOENT/i],
  ['unknown source file', root => fs.writeFileSync(path.join(root, sourceDirectory, 'extra.json'), '{}'), /unexpected/i],
  ['duplicate JSON key', root => {
    const file = path.join(root, sourceDirectory, 'policy.json');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('"schemaVersion": 1', '"schemaVersion": 1, "schemaVersion": 1'));
  }, /duplicate JSON key/i],
  ['duplicate member', root => change(root, 'families/media.json', value => value.deprecations.push(value.deprecations[0])), /duplicate.*member/i],
  ['duplicate export', root => change(root, 'exports.json', value => value.exportDeprecations.push(syntheticExportNotice, syntheticExportNotice)), /duplicate.*export/i],
  ['cross-family member', root => change(root, 'families/media.json', value => { value.deprecations[0].tag = 'lr-card'; }), /family/i],
  ['duplicate assignment', root => change(root, 'families/forms.json', value => {
    const profile = Object.keys(value.assignments).find(key => value.assignments[key].length);
    value.assignments[profile].push(value.assignments[profile][0]);
  }), /duplicate.*assignment/i],
  ['unknown profile', root => change(root, 'families/forms.json', value => { value.assignments.unknown = []; }), /profile/i],
  ['unknown wrapper key', root => change(root, 'history.json', value => { value.extra = true; }), /unexpected/i],
  ['symlinked source', root => {
    const file = path.join(root, sourceDirectory, 'exports.json');
    fs.renameSync(file, path.join(root, 'outside.json'));
    fs.symlinkSync(path.join(root, 'outside.json'), file);
  }, /symlink|regular/i],
  ['symlinked family directory', root => {
    const directory = path.join(root, sourceDirectory, 'families');
    fs.renameSync(directory, path.join(root, 'outside'));
    fs.symlinkSync(path.join(root, 'outside'), directory);
  }, /symlink|regular/i],
]) {
  test(`rejects ${name} before a metadata write`, t => {
    const root = fixture(t);
    const before = fs.readFileSync(path.join(root, aggregatePath), 'utf8');
    mutate(root);
    assert.throws(() => assembleComponentMetadata(readComponentMetadataSources(root)), pattern);
    assert.equal(fs.readFileSync(path.join(root, aggregatePath), 'utf8'), before);
  });
}

test('same-version writes retain unreleased notices and rollover persists stamps in both owners', t => {
  const root = fixture(t);
  change(root, 'families/media.json', value => {
    value.deprecations[0].since = 'unreleased';
    value.deprecations[0].removalNotBefore = '27.0.0';
  });
  change(root, 'exports.json', value => {
    value.exportDeprecations.push(syntheticExportNotice);
  });
  let sources = readComponentMetadataSources(root);
  const metadata = assembleComponentMetadata(sources);
  const history = { ...metadata.history, packageVersion: '24.0.0', rolloverCurrent: false };
  commitComponentMetadataWritePlan(createComponentMetadataWritePlan(sources, nextWriteMetadata(metadata, history)));
  sources = readComponentMetadataSources(root);
  assert.ok(assembleComponentMetadata(sources).deprecations.some(entry => entry.since === 'unreleased'));
  const next = nextWriteMetadata(assembleComponentMetadata(sources), {
    ...history, packageVersion: '25.0.0', rolloverCurrent: true,
    current: { ...history.current, version: '25.0.0' }, taggedCurrent: null,
  });
  commitComponentMetadataWritePlan(createComponentMetadataWritePlan(sources, next));
  assert.equal(read(path.join(root, sourceDirectory, 'families/media.json')).deprecations[0].since, '25.0.0');
  assert.equal(read(path.join(root, sourceDirectory, 'exports.json')).exportDeprecations[0].since, '25.0.0');
  assert.equal(read(path.join(root, sourceDirectory, 'exports.json')).exportDeprecations[0].removalNotBefore, '27.0.0');
  sources = readComponentMetadataSources(root);
  assert.deepEqual(componentMetadataSourceFindings(sources), []);
  assert.ok(createComponentMetadataWritePlan(sources, assembleComponentMetadata(sources)).entries.every(entry => entry.original === entry.expected));
});

for (const relative of [
  `${sourceDirectory}/families/forms.json`, `${sourceDirectory}/exports.json`, `${sourceDirectory}/history.json`,
  'scripts/fixtures/component-inventory.json', aggregatePath,
]) {
  test(`concurrent edits to ${relative} reject the whole pending write`, t => {
    const root = fixture(t);
    const sources = readComponentMetadataSources(root);
    const next = assembleComponentMetadata(sources);
    next.policy.deprecation.minimumFullMajorsAfterDeprecation += 1;
    const plan = createComponentMetadataWritePlan(sources, next);
    fs.appendFileSync(path.join(root, relative), '\n');
    const before = snapshot(root);
    assert.throws(() => commitComponentMetadataWritePlan(plan), /changed while/i);
    assert.deepEqual(snapshot(root), before);
  });
}

test('partitioning rejects a member assigned to an unknown owner without changing sources', t => {
  const root = fixture(t);
  const sources = readComponentMetadataSources(root);
  const next = assembleComponentMetadata(sources);
  next.deprecations[0].tag = 'lr-does-not-exist';
  const before = snapshot(root);
  assert.throws(() => partitionComponentMetadata(next, sources), /owner|family/i);
  assert.deepEqual(snapshot(root), before);
});

test('a replacement failure restores committed source files and removes staged files', t => {
  const root = fixture(t);
  const sources = readComponentMetadataSources(root);
  const next = assembleComponentMetadata(sources);
  next.policy.deprecation.minimumFullMajorsAfterDeprecation += 1;
  next.history.current.manifestSha256 = 'f'.repeat(64);
  const plan = createComponentMetadataWritePlan(sources, next);
  const before = snapshot(root);
  const rename = fs.renameSync;
  let count = 0;
  fs.renameSync = (...args) => {
    if (++count === 2) throw new Error('simulated replacement failure');
    return rename(...args);
  };
  try { assert.throws(() => commitComponentMetadataWritePlan(plan), /simulated replacement failure/); }
  finally { fs.renameSync = rename; }
  assert.deepEqual(snapshot(root), before);
});

test('concurrent source annotation and manifest edits reject all metadata changes', t => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, 'src/components/forms/input'), { recursive: true });
  const annotation = path.join(root, 'src/components/forms/input/input.class.ts');
  const manifest = path.join(root, 'custom-elements.json');
  fs.writeFileSync(annotation, '// original annotation\n');
  fs.writeFileSync(manifest, '{}\n');
  for (const file of [annotation, manifest]) {
    const sources = readComponentMetadataSources(root);
    const next = assembleComponentMetadata(sources);
    next.policy.deprecation.minimumFullMajorsAfterDeprecation += 1;
    const plan = createComponentMetadataWritePlan(sources, next, {
      guards: [{ file: manifest, original: fs.readFileSync(manifest, 'utf8') }],
      extraWrites: [{ file: annotation, original: fs.readFileSync(annotation, 'utf8'), expected: '// next annotation\n' }],
    });
    fs.appendFileSync(file, '\n');
    const before = snapshot(root);
    assert.throws(() => commitComponentMetadataWritePlan(plan), /changed while/i);
    assert.deepEqual(snapshot(root), before);
  }
});
