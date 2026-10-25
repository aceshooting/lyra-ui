import type { BufferAttribute } from 'three';

const callbacks = new WeakMap<BufferAttribute, () => void>();

function uploadedRanges(attribute: BufferAttribute): void {
  if (callbacks.get(attribute) === attribute.onUploadCallback) return;
  const previous = attribute.onUploadCallback;
  const callback = function (this: BufferAttribute) {
    // Three clears ranges after bufferSubData, but not after the initial bufferData.
    // Clear before the owner's callback so work it queues remains pending.
    attribute.clearUpdateRanges();
    previous.call(this);
  };
  callbacks.set(attribute, callback);
  attribute.onUpload(callback);
}

function mark(attribute: BufferAttribute, ranges: { start: number; count: number }[]): void {
  if (ranges.length === 0) return;
  uploadedRanges(attribute);
  const pending = attribute.updateRanges.length ? [...attribute.updateRanges, ...ranges].sort((a, b) => a.start - b.start) : ranges;
  const merged: { start: number; count: number }[] = [];
  let start = pending[0]!.start, end = start + pending[0]!.count;
  for (let index = 1; index < pending.length; index++) {
    const range = pending[index]!;
    if (range.start <= end) end = Math.max(end, range.start + range.count);
    else { merged.push({ start, count: end - start }); start = range.start; end = start + range.count; }
  }
  merged.push({ start, count: end - start });
  attribute.clearUpdateRanges();
  // Dense paint scattered by a sorted permutation must not issue one driver call per row.
  // Sparse ranges stay exact; a promoted span still includes every pending write.
  if (merged.length > 64 && merged.reduce((sum, range) => sum + range.count, 0) >= attribute.array.length / 4) {
    attribute.addUpdateRange(merged[0]!.start, end - merged[0]!.start);
  } else for (const range of merged) attribute.addUpdateRange(range.start, range.count);
  attribute.needsUpdate = true;
}

/** Already ordered, non-overlapping scalar ranges from a dense paint scan. */
export function markAttributeRanges(attribute: BufferAttribute, ranges: { start: number; count: number }[]): void {
  mark(attribute, ranges);
}

/** Marks valid logical rows, coalescing adjacent rows before joining pending upload ranges. */
export function markAttributeRows(attribute: BufferAttribute, rows: Iterable<number>): void {
  const sorted = [...new Set(rows)].filter(row => Number.isInteger(row) && row >= 0 && row < attribute.count).sort((a, b) => a - b);
  const ranges: { start: number; count: number }[] = [];
  for (const row of sorted) {
    const start = row * attribute.itemSize, previous = ranges.at(-1);
    if (previous && previous.start + previous.count === start) previous.count += attribute.itemSize;
    else ranges.push({ start, count: attribute.itemSize });
  }
  mark(attribute, ranges);
}

export function markAttributeFull(attribute: BufferAttribute): void {
  if (attribute.array.length === 0) return;
  uploadedRanges(attribute);
  attribute.clearUpdateRanges();
  attribute.addUpdateRange(0, attribute.array.length);
  attribute.needsUpdate = true;
}
