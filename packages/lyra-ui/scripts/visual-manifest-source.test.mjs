import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const packageDir = fileURLToPath(new URL('..', import.meta.url));
const sourcePath = 'visual-baselines/manifest-sources';
const aggregatePath = 'visual-baselines/manifest.json';
const api = () => import('./visual-manifest-source.mjs');
const render = value => `${JSON.stringify(value, null, 2)}\n`;
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-source-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const relative of [aggregatePath, 'scripts/component-families.json', 'scripts/fixtures/component-inventory.json']) {
    fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    fs.copyFileSync(path.join(packageDir, relative), path.join(root, relative));
  }
  fs.cpSync(path.join(packageDir, sourcePath), path.join(root, sourcePath), { recursive: true });
  return root;
}
function edit(root, relative, mutate) {
  const file = path.join(root, sourcePath, relative);
  const value = read(file); mutate(value); fs.writeFileSync(file, render(value));
}
function bytes(root) {
  return Object.fromEntries(fs.readdirSync(root, { recursive: true }).sort().filter(file => fs.lstatSync(path.join(root, file)).isFile()).map(file => [file, fs.readFileSync(path.join(root, file), 'utf8')]));
}

test('sources reproduce exact aggregate bytes and detach every record', async () => {
  const { readVisualManifestSources, assembleVisualManifest } = await api();
  const sources = readVisualManifestSources({ packageDir });
  const manifest = assembleVisualManifest(sources);
  assert.equal(render(manifest), fs.readFileSync(path.join(packageDir, aggregatePath), 'utf8'));
  manifest.stories[0].id = 'changed';
  assert.notEqual(assembleVisualManifest(sources).stories[0].id, 'changed');
});

test('custom aggregate paths stay confined, disjoint, current, and guarded by the writer', async t => {
  const { readVisualManifestSources, assembleVisualManifest, createVisualManifestSourceWritePlan, commitVisualManifestSourceWritePlan } = await api();
  const root = fixture(t);
  const custom = path.join(root, 'visual-baselines/custom.json');
  fs.copyFileSync(path.join(root, aggregatePath), custom);
  const sources = readVisualManifestSources({ packageDir: root, aggregatePath: custom });
  const next = assembleVisualManifest(sources);
  next.stories[0].comparisonReason = 'Explicit fixture comparison context.';
  const plan = createVisualManifestSourceWritePlan(sources, next);
  fs.appendFileSync(custom, '\n');
  const before = bytes(root);
  assert.throws(() => commitVisualManifestSourceWritePlan(plan), /changed while/);
  assert.deepEqual(bytes(root), before);
  assert.throws(() => readVisualManifestSources({ packageDir: root, aggregatePath: custom }), /custom.json is stale/);
  assert.throws(() => readVisualManifestSources({ packageDir: root, aggregatePath: '../outside.json' }), /escapes package/);
  assert.throws(() => readVisualManifestSources({ packageDir: root, aggregatePath: `${sourcePath}/global.json` }), /overlap/);
});

for (const [name, mutate] of [
  ['duplicate JSON keys', root => { const file = path.join(root, sourcePath, 'index.json'); fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('"schemaVersion": 1', '"schemaVersion": 1, "schemaVersion": 1')); }],
  ['unknown file', root => fs.writeFileSync(path.join(root, sourcePath, 'extra.json'), '{}')],
  ['missing family', root => fs.unlinkSync(path.join(root, sourcePath, 'families/forms.json'))],
  ['unknown family', root => edit(root, 'index.json', index => index.families.push('unknown'))],
  ['duplicate story owner', root => edit(root, 'index.json', index => index.stories.push(index.stories[0]))],
  ['missing story owner', root => edit(root, 'index.json', index => index.stories.pop())],
  ['unknown owner', root => edit(root, 'index.json', index => { index.stories[0].family = '../outside'; })],
  ['wrong family file', root => edit(root, 'families/forms.json', family => { family.family = 'utility'; })],
  ['duplicate story', root => edit(root, 'families/forms.json', family => family.stories.push(family.stories[0]))],
  ['story order mismatch', root => edit(root, 'families/forms.json', family => family.stories.reverse())],
  ['cross-family tag', root => edit(root, 'families/forms.json', family => { family.tagCoverage['lr-card'] = [family.stories[0].id]; })],
  ['unknown reference', root => edit(root, 'families/forms.json', family => { Object.values(family.tagCoverage)[0].push('missing-story'); })],
  ['unknown tag', root => edit(root, 'index.json', index => index.tagOrder.push('lr-missing'))],
  ['duplicate tag', root => edit(root, 'index.json', index => index.tagOrder.push(index.tagOrder[0]))],
  ['symlink file', root => { const file = path.join(root, sourcePath, 'global.json'); fs.renameSync(file, `${root}/outside.json`); fs.symlinkSync(`${root}/outside.json`, file); }],
  ['symlink directory', root => { const file = path.join(root, sourcePath, 'families'); fs.renameSync(file, `${root}/outside`); fs.symlinkSync(`${root}/outside`, file); }],
]) test(`rejects ${name} without touching aggregate`, async t => {
  const { readVisualManifestSources } = await api();
  const root = fixture(t);
  const original = fs.readFileSync(path.join(root, aggregatePath), 'utf8');
  mutate(root);
  assert.throws(() => readVisualManifestSources({ packageDir: root }));
  assert.equal(fs.readFileSync(path.join(root, aggregatePath), 'utf8'), original);
});

test('shared story has exactly one owner and retains cross-family tag edges', async () => {
  const { readVisualManifestSources, assembleVisualManifest, partitionVisualManifest } = await api();
  const sources = readVisualManifestSources({ packageDir });
  const manifest = assembleVisualManifest(sources);
  const id = manifest.stories[0].id;
  manifest.tagCoverage['lr-card'] = [...manifest.tagCoverage['lr-card'], id];
  const documents = partitionVisualManifest(manifest, { ...sources, storyOwners: sources.storyOwners });
  const families = Object.entries(documents).filter(([file]) => file.includes('/families/')).map(([, value]) => JSON.parse(value));
  assert.equal(families.flatMap(family => family.stories).filter(story => story.id === id).length, 1);
  assert.deepEqual(families.find(family => family.family === 'layout').tagCoverage['lr-card'], manifest.tagCoverage['lr-card']);
});

test('writer validates semantics, explicit new owners, and unchanged human evidence before mutation', async t => {
  const { readVisualManifestSources, assembleVisualManifest, createVisualManifestSourceWritePlan, commitVisualManifestSourceWritePlan } = await api();
  const root = fixture(t);
  const sources = readVisualManifestSources({ packageDir: root });
  const original = bytes(root);
  for (const mutate of [
    manifest => { manifest.stories[0].profile = 'unknown'; },
    manifest => { manifest.provenance.humanVisualReview = true; },
    manifest => { manifest.baselineReview.reviewer = 'Invented'; },
  ]) {
    const next = assembleVisualManifest(sources); mutate(next);
    assert.throws(() => createVisualManifestSourceWritePlan(sources, next));
    assert.deepEqual(bytes(root), original);
  }
  const next = assembleVisualManifest(sources);
  next.stories.push({ ...next.stories[0], id: 'builder--reviewable' });
  next.untaggedStories['builder--reviewable'] = 'Editor composition with no component owner.';
  assert.throws(() => createVisualManifestSourceWritePlan(sources, next), /owner/i);
  commitVisualManifestSourceWritePlan(createVisualManifestSourceWritePlan(sources, next, { storyOwners: { 'builder--reviewable': 'utility' } }));
  assert.deepEqual(assembleVisualManifest(readVisualManifestSources({ packageDir: root })), next);
  assert.deepEqual(next.baselineReview, assembleVisualManifest(sources).baselineReview);
});

for (const relative of ['global.json', 'families/forms.json', '../manifest.json']) test(`concurrent ${relative} edit rejects entire writer plan`, async t => {
  const { readVisualManifestSources, assembleVisualManifest, createVisualManifestSourceWritePlan, commitVisualManifestSourceWritePlan } = await api();
  const root = fixture(t);
  const sources = readVisualManifestSources({ packageDir: root });
  const next = assembleVisualManifest(sources);
  next.stories[0].comparisonReason = 'More precise comparison context.';
  const plan = createVisualManifestSourceWritePlan(sources, next);
  fs.appendFileSync(path.join(root, sourcePath, relative), '\n');
  const before = bytes(root);
  assert.throws(() => commitVisualManifestSourceWritePlan(plan), /changed while/);
  assert.deepEqual(bytes(root), before);
});
