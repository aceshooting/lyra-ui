import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadVisualStory } from './visual-story-readiness.mjs';

const manifestPath = fileURLToPath(new URL('../visual-baselines/manifest.json', import.meta.url));
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const runner = await readFile(new URL('./visual-regression.mjs', import.meta.url), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const componentInventory = JSON.parse(
  await readFile(new URL('./fixtures/component-inventory.json', import.meta.url), 'utf8'),
);
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const ciWorkflow = await readFile(new URL('../../../.github/workflows/ci.yml', import.meta.url), 'utf8');

assert.equal(manifest.schemaVersion, 1);
assert.ok(Array.isArray(manifest.axes));
assert.ok(Array.isArray(manifest.stories));
assert.ok(manifest.stories.length >= 80);

const axes = new Map(manifest.axes.map((axis) => [axis.name, axis]));
assert.equal(axes.size, manifest.axes.length, 'visual axis names must be unique');
assert.equal(axes.get('forced-colors')?.emulation?.forcedColors, 'active');
assert.ok(axes.get('narrow')?.viewport?.width <= 320);
assert.ok(axes.get('narrow')?.viewport?.height >= 640);
for (const axis of axes.values()) {
  assert.ok(
    ['tracked-baseline', 'evidence-only'].includes(axis.artifactPolicy),
    `${axis.name} must declare whether its pixels are tracked or ephemeral evidence`,
  );
}
assert.equal(axes.get('forced-colors')?.artifactPolicy, 'evidence-only');
assert.equal(axes.get('narrow')?.artifactPolicy, 'evidence-only');

const profiles = manifest.coverageProfiles;
assert.equal(typeof profiles, 'object');
for (const [name, profile] of Object.entries(profiles)) {
  assert.ok(Array.isArray(profile.axes) && profile.axes.length > 0);
  const covered = new Set(profile.axes);
  const exempted = new Set(Object.keys(profile.exemptions ?? {}));
  for (const axis of [...covered, ...exempted]) {
    assert.ok(axes.has(axis), `coverage profile ${name} names unknown axis ${axis}`);
  }
  for (const axis of axes.keys()) {
    assert.ok(
      covered.has(axis) || exempted.has(axis),
      `coverage profile ${name} neither captures nor exempts ${axis}`,
    );
  }
}

const ids = manifest.stories.map((story) => story.id);
assert.equal(new Set(ids).size, ids.length, 'visual story ids must be unique');
const storyIds = new Set(ids);
for (const story of manifest.stories) {
  assert.ok(profiles[story.profile], `${story.id} names unknown profile ${story.profile}`);
  if (story.forcedColorsProbe) {
    assert.ok(
      ['intrinsic-color', 'chart-encodings'].includes(story.forcedColorsProbe),
      `${story.id} names unknown forced-colors pixel probe ${story.forcedColorsProbe}`,
    );
    assert.ok(
      profiles[story.profile].axes.includes('forced-colors'),
      `${story.id}'s painted-pixel probe is never exercised by its profile`,
    );
  }
  if (story.narrowProbe) {
    assert.equal(story.narrowProbe, 'viewport-fit', `${story.id} names an unknown narrow probe`);
    assert.ok(
      profiles[story.profile].axes.includes('narrow'),
      `${story.id}'s narrow-allocation probe is never exercised by its profile`,
    );
  }
  if (story.comparisonPolicy === 'evidence-only') {
    assert.ok(
      typeof story.comparisonReason === 'string' && story.comparisonReason.trim().length > 0,
      `${story.id}'s evidence-only comparison policy needs a review reason`,
    );
  } else {
    assert.equal(story.comparisonPolicy, undefined, `${story.id} names an unknown comparison policy`);
  }
}
assert.ok(manifest.stories.some((story) => profiles[story.profile].axes.includes('forced-colors')));
assert.ok(manifest.stories.some((story) => profiles[story.profile].axes.includes('narrow')));
assert.ok(manifest.stories.some((story) => story.forcedColorsProbe === 'intrinsic-color'));
assert.ok(manifest.stories.some((story) => story.forcedColorsProbe === 'chart-encodings'));
assert.ok(manifest.stories.some((story) => story.narrowProbe === 'viewport-fit'));
assert.ok(manifest.stories.some((story) => story.comparisonPolicy === 'evidence-only'));

const knownTags = new Set(componentInventory.components.map((component) => component.tag));
const taggedStories = new Set();
for (const [tag, coveredStoryIds] of Object.entries(manifest.tagCoverage)) {
  assert.ok(knownTags.has(tag), `visual tag coverage names unknown component ${tag}`);
  assert.ok(Array.isArray(coveredStoryIds) && coveredStoryIds.length > 0);
  for (const storyId of coveredStoryIds) {
    assert.ok(storyIds.has(storyId), `${tag} visual coverage names unknown story ${storyId}`);
    taggedStories.add(storyId);
  }
}
for (const [storyId, reason] of Object.entries(manifest.untaggedStories ?? {})) {
  assert.ok(storyIds.has(storyId), `untagged visual exemption names unknown story ${storyId}`);
  assert.ok(typeof reason === 'string' && reason.trim().length > 0);
}
for (const storyId of storyIds) {
  assert.ok(
    taggedStories.has(storyId) || manifest.untaggedStories?.[storyId],
    `${storyId} has neither deterministic tag coverage nor an untagged reason`,
  );
}

assert.ok(['pending-human-review', 'complete'].includes(manifest.baselineReview.status));
if (manifest.baselineReview.status === 'pending-human-review') {
  assert.equal(manifest.baselineReview.reviewer, null);
  assert.equal(manifest.baselineReview.reviewedAt, null);
  assert.equal(manifest.provenance.humanVisualReview, false);
} else {
  assert.ok(typeof manifest.baselineReview.reviewer === 'string' && manifest.baselineReview.reviewer.length > 0);
  assert.match(manifest.baselineReview.reviewedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(manifest.provenance.humanVisualReview, true);
}
assert.ok(Array.isArray(manifest.baselineReview.knownLimitations));
assert.ok(manifest.baselineReview.knownLimitations.length > 0);
assert.equal(manifest.provenance.generator, 'packages/lyra-ui/scripts/visual-regression.mjs');
assert.equal(manifest.provenance.generatedBy, 'automated-coding-agent');
assert.equal(manifest.provenance.browser.name, 'chromium');
assert.equal(typeof manifest.provenance.browser.version, 'string');
assert.ok(manifest.provenance.browser.version.length > 0);
assert.deepEqual(manifest.provenance.platform, { os: 'linux', arch: 'x64' });
assert.match(manifest.provenance.sourceTree.baseCommit, /^[0-9a-f]{40}$/);
assert.equal(manifest.provenance.sourceTree.dirty, true);
assert.equal(manifest.provenance.artifactScope, 'ephemeral-evidence');

assert.match(runner, /visual-baselines\/manifest\.json/);
assert.doesNotMatch(runner, /const AXES = \[/, 'runner must consume manifest axes');
assert.doesNotMatch(runner, /const STORIES = \[/, 'runner must consume manifest stories');
assert.match(runner, /\.emulateMedia\(\{[^}]*forcedColors/s);
assert.match(runner, /PNG\.sync\.read\(/, 'forced-colors checks must inspect painted PNG pixels');
assert.match(runner, /customElements\.get\(/, 'captures must fail when a rendered lr-* tag is inert');
assert.match(runner, /EXPECTED_TAGS_BY_STORY/, 'captures must consume the manifest tag-to-story mapping');
assert.match(runner, /missingExpectedTags/, 'captures must reject a story that does not render its claimed tag');
assert.match(runner, /axis\.name === 'forced-colors'/, 'every forced-colors capture must verify activation');
assert.match(runner, /assertNarrowAllocation/, 'the narrow axis must assert viewport allocation, not only set it');
assert.match(runner, /baselineReview\.status !== 'complete'/, 'snapshot promotion must require recorded human review');
assert.match(runner, /promoteReviewedCandidates/, 'promotion must use the exact previously reviewed candidates');
assert.match(runner, /candidateSha256/, 'candidate pixels must be hash-bound before promotion');
assert.match(runner, /visualCapturePlan/, 'the runner must expand the manifest into axis-level captures');
assert.match(runner, /shardVisualCaptures/, 'the runner must apply deterministic capture sharding');
assert.ok(
  packageJson.scripts['test:tooling'].includes('visual-regression-config.test.mjs'),
  'the visual manifest contract must run in test:tooling',
);
assert.ok(
  packageJson.scripts['test:tooling'].includes('visual-regression-shard.test.mjs'),
  'the deterministic visual shard unit tests must run in test:tooling',
);
assert.match(ciWorkflow, /shard: \[1, 2, 3\]/, 'CI must run three balanced visual shards');
assert.match(
  ciWorkflow,
  /VISUAL_SHARD_INDEX: \$\{\{ matrix\.shard \}\}/,
  'each CI leg must pass its one-based visual shard index',
);
assert.match(ciWorkflow, /VISUAL_SHARD_TOTAL: '3'/, 'CI and the runner must agree on shard total');
assert.match(
  ciWorkflow,
  /visual-regression-diff-\$\{\{ matrix\.shard \}\}-of-3/,
  'each shard must upload a uniquely named diff artifact',
);
assert.match(
  ciWorkflow,
  /visual-regression-gate:[\s\S]*?needs: visual-regression/,
  'the stable release-blocking visual-regression check must aggregate all matrix legs',
);

function readinessPage(waitOutcomes) {
  const calls = [];
  return {
    calls,
    async goto(url, options) {
      calls.push(['goto', url, options]);
    },
    async addStyleTag(options) {
      calls.push(['style', options]);
    },
    async waitForFunction(_predicate, _argument, options) {
      calls.push(['wait', options]);
      const outcome = waitOutcomes.shift();
      if (outcome instanceof Error) throw outcome;
    },
  };
}

const recoveredPage = readinessPage([new Error('empty root'), undefined]);
assert.deepEqual(
  await loadVisualStory(recoveredPage, 'http://storybook/story', ':root {}'),
  { attempts: 2 },
  'one empty Storybook root should receive one fresh navigation',
);
assert.deepEqual(
  recoveredPage.calls.map(([name]) => name),
  ['goto', 'style', 'wait', 'goto', 'style', 'wait'],
  'each bounded readiness attempt must navigate, inject deterministic styles, then wait',
);

const persistentlyEmptyPage = readinessPage([new Error('empty root one'), new Error('empty root two')]);
await assert.rejects(
  loadVisualStory(persistentlyEmptyPage, 'http://storybook/story', ':root {}'),
  /Storybook root was not ready after 2 attempts.*empty root two/,
  'a persistent render failure must remain blocking after the one recovery navigation',
);

const expectedTrackedBaselines = [];
for (const story of manifest.stories) {
  for (const axisName of profiles[story.profile].axes) {
    const axis = axes.get(axisName);
    if (axis.artifactPolicy !== 'tracked-baseline') continue;
    await access(new URL(`../visual-baselines/${story.id}/${axisName}.png`, import.meta.url));
    expectedTrackedBaselines.push(`packages/lyra-ui/visual-baselines/${story.id}/${axisName}.png`);
  }
}
const trackedBaselines = execFileSync(
  'git',
  ['ls-files', '--', 'packages/lyra-ui/visual-baselines/*.png', 'packages/lyra-ui/visual-baselines/**/*.png'],
  { cwd: repoRoot, encoding: 'utf8' },
)
  .trim()
  .split('\n')
  .filter(Boolean)
  .sort();
assert.deepEqual(
  trackedBaselines,
  expectedTrackedBaselines.sort(),
  'only retained baseline axes may be tracked; forced-colors/narrow captures stay ephemeral',
);

const captures = manifest.stories.reduce(
  (total, story) => total + profiles[story.profile].axes.length,
  0,
);
console.log(
  `Visual coverage manifest is valid: ${manifest.stories.length} stories, ${axes.size} axes, ${captures} captures.`,
);
