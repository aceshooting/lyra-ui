function integerCoordinate(value, label, minimum) {
  const numeric = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^(?:0|[1-9]\d*)$/u.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(numeric) || numeric < minimum) {
    throw new Error(`${label} must be a safe integer greater than or equal to ${minimum}.`);
  }
  return numeric;
}

export function parseShowCodeSelectionOptions({ shardIndex, shardTotal, start, end } = {}) {
  if (shardIndex !== undefined || shardTotal !== undefined) {
    if (shardIndex === undefined || shardTotal === undefined) {
      throw new Error('Show Code shard index and total must be supplied together.');
    }
    if (start !== undefined || end !== undefined) {
      throw new Error('Show Code sharding cannot be combined with a manual start/end range.');
    }
    const index = integerCoordinate(shardIndex, 'Show Code shard index', 1);
    const total = integerCoordinate(shardTotal, 'Show Code shard total', 1);
    if (index > total) throw new Error('Show Code shard index cannot exceed its total.');
    return { shardIndex: index, shardTotal: total };
  }
  const first = start === undefined ? 0 : integerCoordinate(start, 'Show Code range start', 0);
  const last = end === undefined ? undefined : integerCoordinate(end, 'Show Code range end', 0);
  if (last !== undefined && last < first) throw new Error('Show Code range end cannot come before its start.');
  return { start: first, end: last };
}

/** Keep manual ranges in index order; CI shards use a stable, complete docs-ID inventory. */
export function selectShowCodeDocs(docs, options = {}) {
  const coordinates = parseShowCodeSelectionOptions(options);
  if (!Array.isArray(docs) || docs.length === 0) throw new Error('Show Code docs inventory is empty.');
  const seen = new Set();
  for (const doc of docs) {
    if (typeof doc?.id !== 'string' || doc.id.length === 0) {
      throw new Error('Every Show Code docs ID must be a nonempty string.');
    }
    if (seen.has(doc.id)) throw new Error(`Duplicate Show Code docs ID: ${doc.id}.`);
    seen.add(doc.id);
  }
  const inventoryIds = [...seen].sort();
  if (coordinates.shardTotal !== undefined) {
    const { shardIndex, shardTotal } = coordinates;
    if (shardTotal > docs.length) throw new Error('Show Code shard total would leave an empty shard.');
    const byId = new Map(docs.map(doc => [doc.id, doc]));
    const selected = inventoryIds.filter((_, index) => index % shardTotal === shardIndex - 1).map(id => byId.get(id));
    return { selected, inventoryIds, range: null, shard: { index: shardIndex, total: shardTotal } };
  }
  const { start } = coordinates;
  const end = coordinates.end ?? docs.length - 1;
  if (start >= docs.length || end >= docs.length) throw new Error('Show Code range is outside the docs inventory.');
  return { selected: docs.slice(start, end + 1), inventoryIds, range: [start, end], shard: null };
}
