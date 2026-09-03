import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  readVisualShardCoordinates,
  shardVisualCaptures,
  visualCapturePlan,
} from './visual-regression-shard.mjs';

const manifest = JSON.parse(
  await readFile(new URL('../visual-baselines/manifest.json', import.meta.url), 'utf8'),
);

test('builds the complete retained-baseline/evidence plan without changing enrollment', () => {
  const captures = visualCapturePlan(manifest);
  const axes = new Map(manifest.axes.map((axis) => [axis.name, axis]));
  const evidenceOnly = captures.filter(
    ({ story, axisName }) =>
      story.comparisonPolicy === 'evidence-only' ||
      axes.get(axisName)?.artifactPolicy === 'evidence-only',
  );

  assert.equal(new Set(captures.map(({ story }) => story.id)).size, 93);
  assert.equal(captures.length, 268);
  assert.equal(evidenceOnly.length, 145);
  assert.equal(captures.length - evidenceOnly.length, 123);
});

test('enrolls the exact required canaries on their intended visual axes', () => {
  const captures = visualCapturePlan(manifest);
  const axesByStory = new Map();
  for (const { story, axisName } of captures) {
    const axes = axesByStory.get(story.id) ?? [];
    axes.push(axisName);
    axesByStory.set(story.id, axes);
  }

  assert.deepEqual(
    Object.fromEntries(
      [
        'resultcard-result-field--narrow-long-rtl',
        'overlay-dropdown--narrow-long-rtl',
        'textarea--narrow-long-rtl',
        'observability-span-waterfall--narrow-edge-clamp',
        'agent-tools-subagent-panel--depth-12-narrow',
        'message-parts--narrow-error-retry',
        'charts-chart--annotations-canary',
        'charts-litechart--logarithmic-scale-canary',
      ].map((storyId) => [storyId, axesByStory.get(storyId)?.sort()]),
    ),
    {
      'resultcard-result-field--narrow-long-rtl': ['narrow'],
      'overlay-dropdown--narrow-long-rtl': ['narrow'],
      'textarea--narrow-long-rtl': ['narrow'],
      'observability-span-waterfall--narrow-edge-clamp': ['narrow'],
      'agent-tools-subagent-panel--depth-12-narrow': ['narrow'],
      'message-parts--narrow-error-retry': ['narrow'],
      'charts-chart--annotations-canary': ['dark', 'forced-colors', 'light', 'rtl'],
      'charts-litechart--logarithmic-scale-canary': ['dark', 'light', 'rtl'],
    },
  );
});

test('creates deterministic, disjoint, exhaustive, balanced capture shards', () => {
  const captures = visualCapturePlan(manifest);
  const shards = [1, 2, 3].map((shardIndex) =>
    shardVisualCaptures(captures, shardIndex, 3),
  );

  assert.deepEqual(shards.map((shard) => shard.length), [90, 89, 89]);
  assert.equal(new Set(shards.flat().map(({ key }) => key)).size, captures.length);
  assert.deepEqual(
    shards.flat().map(({ key }) => key).sort(),
    captures.map(({ key }) => key).sort(),
  );
  assert.deepEqual(
    shardVisualCaptures([...captures].reverse(), 2, 3).map(({ key }) => key),
    shards[1].map(({ key }) => key),
  );
});

test('filters before partitioning and keeps the filtered shards balanced', () => {
  const captures = visualCapturePlan(manifest, 'checkbox');
  const shards = [1, 2, 3].map((shardIndex) =>
    shardVisualCaptures(captures, shardIndex, 3),
  );

  assert.ok(captures.length > 0);
  assert.ok(captures.every(({ story }) => story.id.includes('checkbox')));
  const shardSizes = shards.map((shard) => shard.length);
  assert.ok(Math.max(...shardSizes) - Math.min(...shardSizes) <= 1);
  assert.equal(new Set(shards.flat().map(({ key }) => key)).size, captures.length);
});

test('validates one-based visual shard coordinates and defaults to an unsharded run', () => {
  assert.deepEqual(readVisualShardCoordinates({}), {
    shardIndex: 1,
    shardTotal: 1,
  });
  assert.deepEqual(
    readVisualShardCoordinates({
      VISUAL_SHARD_INDEX: '2',
      VISUAL_SHARD_TOTAL: '3',
    }),
    { shardIndex: 2, shardTotal: 3 },
  );

  assert.throws(
    () => readVisualShardCoordinates({ VISUAL_SHARD_INDEX: '1' }),
    /must be set together/,
  );
  assert.throws(
    () => readVisualShardCoordinates({ VISUAL_SHARD_TOTAL: '3' }),
    /must be set together/,
  );
  assert.throws(
    () => readVisualShardCoordinates({ VISUAL_SHARD_INDEX: '0', VISUAL_SHARD_TOTAL: '3' }),
    /positive integer/,
  );
  assert.throws(
    () => readVisualShardCoordinates({ VISUAL_SHARD_INDEX: '4', VISUAL_SHARD_TOTAL: '3' }),
    /cannot exceed/,
  );
  assert.throws(() => shardVisualCaptures([], 1, 0), /positive integer/);
});
