import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const manifestPath = fileURLToPath(new URL('../visual-baselines/manifest.json', import.meta.url));
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

assert.equal(manifest.schemaVersion, 1);
assert.ok(Array.isArray(manifest.axes));
assert.ok(Array.isArray(manifest.stories));
assert.ok(manifest.stories.length >= 80);

const axes = new Map(manifest.axes.map((axis) => [axis.name, axis]));
assert.equal(axes.get('forced-colors')?.emulation?.forcedColors, 'active');
assert.ok(axes.get('narrow')?.viewport?.width <= 320);
assert.ok(axes.get('narrow')?.viewport?.height >= 640);

const profiles = manifest.coverageProfiles;
assert.equal(typeof profiles, 'object');
for (const [name, profile] of Object.entries(profiles)) {
  const covered = new Set(profile.axes);
  const exempted = new Set(Object.keys(profile.exemptions ?? {}));
  for (const axis of axes.keys()) {
    assert.ok(
      covered.has(axis) || exempted.has(axis),
      `coverage profile ${name} neither captures nor exempts ${axis}`,
    );
  }
}

const ids = manifest.stories.map((story) => story.id);
assert.equal(new Set(ids).size, ids.length, 'visual story ids must be unique');
for (const story of manifest.stories) {
  assert.ok(profiles[story.profile], `${story.id} names unknown profile ${story.profile}`);
}
assert.ok(manifest.stories.some((story) => profiles[story.profile].axes.includes('forced-colors')));
assert.ok(manifest.stories.some((story) => profiles[story.profile].axes.includes('narrow')));

assert.equal(manifest.baselineReview.status, 'pending-human-review');
assert.equal(manifest.baselineReview.reviewer, null);
assert.equal(manifest.baselineReview.reviewedAt, null);
assert.ok(Array.isArray(manifest.baselineReview.knownLimitations));
assert.ok(manifest.baselineReview.knownLimitations.length > 0);

console.log(`Visual coverage manifest is valid: ${manifest.stories.length} stories, ${axes.size} axes.`);
