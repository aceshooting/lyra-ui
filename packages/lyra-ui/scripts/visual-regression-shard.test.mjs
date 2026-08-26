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

  assert.equal(new Set(captures.map(({ story }) => story.id)).size, 85);
  assert.equal(captures.length, 255);
  assert.equal(evidenceOnly.length, 129);
  assert.equal(captures.length - evidenceOnly.length, 126);
});

test('creates deterministic, disjoint, exhaustive, balanced capture shards', () => {
  const captures = visualCapturePlan(manifest);
  const shards = [1, 2, 3].map((shardIndex) =>
    shardVisualCaptures(captures, shardIndex, 3),
  );

  assert.deepEqual(shards.map((shard) => shard.length), [85, 85, 85]);
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
