import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const packageDir = fileURLToPath(new URL('..', import.meta.url));
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-generator-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const relative of ['visual-baselines/manifest.json', 'scripts/component-families.json', 'scripts/fixtures/component-inventory.json']) {
    fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    fs.copyFileSync(path.join(packageDir, relative), path.join(root, relative));
  }
  fs.cpSync(path.join(packageDir, 'visual-baselines/manifest-sources'), path.join(root, 'visual-baselines/manifest-sources'), { recursive: true });
  return root;
}
test('generator repairs stale and missing output, while check and consumers fail closed', async t => {
  const { generateVisualManifest } = await import('./generate-visual-manifest.mjs');
  const { readVisualManifestSources } = await import('./visual-manifest-source.mjs');
  const root = fixture(t);
  const file = path.join(root, 'visual-baselines/manifest.json');
  const original = fs.readFileSync(file, 'utf8');
  const sourceRoot = path.join(root, 'visual-baselines/manifest-sources');
  const originals = fs.readdirSync(sourceRoot, { recursive: true }).filter(relative => fs.statSync(path.join(sourceRoot, relative)).isFile())
    .map(relative => [relative, fs.readFileSync(path.join(sourceRoot, relative), 'utf8')]);
  for (const missing of [false, true]) {
    if (missing) fs.unlinkSync(file); else fs.writeFileSync(file, '{}\n');
    assert.throws(() => generateVisualManifest({ packageDir: root, check: true }), /stale|missing|differs/i);
    assert.throws(() => readVisualManifestSources({ packageDir: root }), /stale|missing|differs/i);
    generateVisualManifest({ packageDir: root });
    assert.equal(fs.readFileSync(file, 'utf8'), original);
    for (const [relative, content] of originals) assert.equal(fs.readFileSync(path.join(sourceRoot, relative), 'utf8'), content);
  }
});
test('generator rejects malformed authored input without replacing a stale aggregate', async t => {
  const { generateVisualManifest } = await import('./generate-visual-manifest.mjs');
  const root = fixture(t);
  const output = path.join(root, 'visual-baselines/manifest.json');
  const input = path.join(root, 'visual-baselines/manifest-sources/global.json');
  fs.writeFileSync(output, '{}\n');
  fs.writeFileSync(input, '{"axes": [], "axes": []}');
  assert.throws(() => generateVisualManifest({ packageDir: root }), /duplicate/i);
  assert.equal(fs.readFileSync(output, 'utf8'), '{}\n');
});
test('quality reader honors an explicit temporary visual source root and rejects stale output', async t => {
  const { buildQualityArtifacts, QUALITY_PATHS } = await import('./generate-component-quality.mjs');
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'visual-baselines/manifest.json'), '{}\n');
  await assert.rejects(buildQualityArtifacts({ visualSourceRoot: root, paths: { ...QUALITY_PATHS, visual: path.join(root, 'visual-baselines/manifest.json') } }), /stale|missing/i);
});
test('quality reader honors the exact custom visual filename', async t => {
  const { buildQualityArtifacts, QUALITY_PATHS } = await import('./generate-component-quality.mjs');
  const root = fixture(t);
  const custom = path.join(root, 'visual-baselines/custom.json');
  fs.writeFileSync(custom, '{}\n');
  await assert.rejects(buildQualityArtifacts({ paths: { ...QUALITY_PATHS, visual: custom } }), /stale|missing/i);
});
for (const [label, mutate] of [
  ['empty axes', manifest => { manifest.axes = []; }],
  ['duplicate axes', manifest => { manifest.axes.push(manifest.axes[0]); }],
  ['unknown artifact policy', manifest => { manifest.axes[0].artifactPolicy = 'invented'; }],
  ['unknown profile axis', manifest => { manifest.coverageProfiles.standard.axes.push('missing'); }],
  ['uncaptured axis', manifest => { manifest.axes.push({ name: 'new-axis', artifactPolicy: 'evidence-only' }); }],
  ['unknown forced-color probe', manifest => { manifest.stories[0].forcedColorsProbe = 'invented'; }],
  ['unexercised narrow probe', manifest => { manifest.stories[0].narrowProbe = 'viewport-fit'; }],
  ['unknown comparison policy', manifest => { manifest.stories[0].comparisonPolicy = 'invented'; }],
  ['missing comparison reason', manifest => { manifest.stories[0].comparisonPolicy = 'evidence-only'; delete manifest.stories[0].comparisonReason; }],
]) test(`writer and generator reject ${label} before mutation`, async t => {
  const { generateVisualManifest } = await import('./generate-visual-manifest.mjs');
  const { readVisualManifestSources, assembleVisualManifest, createVisualManifestSourceWritePlan } = await import('./visual-manifest-source.mjs');
  const root = fixture(t);
  const sources = readVisualManifestSources({ packageDir: root });
  const next = assembleVisualManifest(sources);
  mutate(next);
  const output = path.join(root, 'visual-baselines/manifest.json');
  const original = fs.readFileSync(output, 'utf8');
  assert.throws(() => createVisualManifestSourceWritePlan(sources, next), /visual|profile|probe|axis|comparison/i);
  const globalFile = path.join(root, 'visual-baselines/manifest-sources/global.json');
  const global = JSON.parse(fs.readFileSync(globalFile, 'utf8'));
  global.axes = next.axes;
  global.coverageProfiles = next.coverageProfiles;
  fs.writeFileSync(globalFile, JSON.stringify(global));
  const familyFile = path.join(root, `visual-baselines/manifest-sources/families/${sources.storyOwners[next.stories[0].id]}.json`);
  const family = JSON.parse(fs.readFileSync(familyFile, 'utf8'));
  family.stories[0] = next.stories[0];
  fs.writeFileSync(familyFile, JSON.stringify(family));
  assert.throws(() => generateVisualManifest({ packageDir: root }), /visual|profile|probe|axis|comparison/i);
  assert.equal(fs.readFileSync(output, 'utf8'), original);
});
test('generator rejects semantic failure before replacing aggregate or human review evidence', async t => {
  const { generateVisualManifest } = await import('./generate-visual-manifest.mjs');
  const root = fixture(t);
  const output = path.join(root, 'visual-baselines/manifest.json');
  const original = fs.readFileSync(output, 'utf8');
  const globalFile = path.join(root, 'visual-baselines/manifest-sources/global.json');
  const global = JSON.parse(fs.readFileSync(globalFile, 'utf8'));
  global.baselineReview.reviewer = 'Not reviewed';
  fs.writeFileSync(globalFile, JSON.stringify(global));
  assert.throws(() => generateVisualManifest({ packageDir: root }), /reviewer|review/i);
  assert.equal(fs.readFileSync(output, 'utf8'), original);
});
test('generator retains the complete-review string reviewer contract', async t => {
  const { generateVisualManifest } = await import('./generate-visual-manifest.mjs');
  const root = fixture(t);
  const output = path.join(root, 'visual-baselines/manifest.json');
  const original = fs.readFileSync(output, 'utf8');
  const globalFile = path.join(root, 'visual-baselines/manifest-sources/global.json');
  const global = JSON.parse(fs.readFileSync(globalFile, 'utf8'));
  global.baselineReview = { ...global.baselineReview, status: 'complete', reviewer: 123, reviewedAt: '2026-09-29' };
  global.provenance.humanVisualReview = true;
  fs.writeFileSync(globalFile, JSON.stringify(global));
  assert.throws(() => generateVisualManifest({ packageDir: root }), /reviewer/i);
  assert.equal(fs.readFileSync(output, 'utf8'), original);
});
