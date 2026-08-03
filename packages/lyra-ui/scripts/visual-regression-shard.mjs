function positiveInteger(value, name) {
  const raw = String(value);
  if (!/^[1-9]\d*$/.test(raw)) {
    throw new Error(`${name} must be a positive integer; received ${raw || '(empty)'}.`);
  }
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${name} must be a safe positive integer; received ${raw}.`);
  }
  return parsed;
}

/** Reads one-based shard coordinates while preserving an unsharded local default. */
export function readVisualShardCoordinates(environment = process.env) {
  const hasIndex = environment.VISUAL_SHARD_INDEX !== undefined;
  const hasTotal = environment.VISUAL_SHARD_TOTAL !== undefined;
  if (!hasIndex && !hasTotal) return { shardIndex: 1, shardTotal: 1 };
  if (hasIndex !== hasTotal) {
    throw new Error('VISUAL_SHARD_INDEX and VISUAL_SHARD_TOTAL must be set together.');
  }

  const shardIndex = positiveInteger(environment.VISUAL_SHARD_INDEX, 'VISUAL_SHARD_INDEX');
  const shardTotal = positiveInteger(environment.VISUAL_SHARD_TOTAL, 'VISUAL_SHARD_TOTAL');
  if (shardIndex > shardTotal) {
    throw new Error(
      `VISUAL_SHARD_INDEX (${shardIndex}) cannot exceed VISUAL_SHARD_TOTAL (${shardTotal}).`,
    );
  }
  return { shardIndex, shardTotal };
}

function compareCapture(left, right) {
  return left.key < right.key ? -1 : left.key > right.key ? 1 : 0;
}

/** Expands manifest stories into a stable, axis-level capture inventory. */
export function visualCapturePlan(manifest, filter) {
  const captures = [];
  for (const story of manifest.stories) {
    if (filter && !story.id.includes(filter)) continue;
    const profile = manifest.coverageProfiles[story.profile];
    if (!profile) throw new Error(`${story.id} names unknown visual profile ${story.profile}.`);
    for (const axisName of profile.axes) {
      captures.push({
        story,
        axisName,
        key: `${story.id}\u0000${axisName}`,
      });
    }
  }
  return captures.sort(compareCapture);
}

/**
 * Assigns sorted captures round-robin. Every capture is selected once and shard sizes differ by
 * at most one, regardless of manifest order.
 */
export function shardVisualCaptures(captures, shardIndex, shardTotal) {
  const index = positiveInteger(shardIndex, 'shardIndex');
  const total = positiveInteger(shardTotal, 'shardTotal');
  if (index > total) throw new Error(`shardIndex (${index}) cannot exceed shardTotal (${total}).`);

  return [...captures]
    .sort(compareCapture)
    .filter((_, captureIndex) => captureIndex % total === index - 1);
}
