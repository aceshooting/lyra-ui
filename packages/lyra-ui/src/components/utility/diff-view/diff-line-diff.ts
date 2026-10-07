export interface LyraDiffOp {
  type: 'equal' | 'add' | 'remove';
  text: string;
}

type LineMatch = readonly [oldIndex: number, newIndex: number];

/** Returns LCS lengths for every prefix of `newLines[newStart:newEnd]` using one row. */
function prefixLengths(
  oldLines: string[],
  oldStart: number,
  oldEnd: number,
  newLines: string[],
  newStart: number,
  newEnd: number,
  reverse: boolean,
): Uint32Array {
  const newLength = newEnd - newStart;
  const lengths = new Uint32Array(newLength + 1);
  const oldFirst = reverse ? oldEnd - 1 : oldStart;
  const oldLimit = reverse ? oldStart - 1 : oldEnd;
  const oldStep = reverse ? -1 : 1;
  for (let oldIndex = oldFirst; oldIndex !== oldLimit; oldIndex += oldStep) {
    let diagonal = 0;
    for (let offset = 1; offset <= newLength; offset += 1) {
      const previous = lengths[offset]!;
      const newIndex = reverse ? newEnd - offset : newStart + offset - 1;
      lengths[offset] =
        oldLines[oldIndex] === newLines[newIndex]
          ? diagonal + 1
          : Math.max(lengths[offset]!, lengths[offset - 1]!);
      diagonal = previous;
    }
  }
  return lengths;
}

/** Finds Hirschberg's split while keeping the two temporary rows out of recursive frames. */
function splitOffset(
  oldLines: string[],
  oldStart: number,
  oldMiddle: number,
  oldEnd: number,
  newLines: string[],
  newStart: number,
  newEnd: number,
): number {
  const prefix = prefixLengths(oldLines, oldStart, oldMiddle, newLines, newStart, newEnd, false);
  const suffix = prefixLengths(oldLines, oldMiddle, oldEnd, newLines, newStart, newEnd, true);
  const newLength = newEnd - newStart;
  let bestOffset = 0;
  let bestLength = -1;
  for (let offset = 0; offset <= newLength; offset += 1) {
    const length = prefix[offset]! + suffix[newLength - offset]!;
    // Keep the first maximum for deterministic left-biased alignment.
    if (length > bestLength) {
      bestLength = length;
      bestOffset = offset;
    }
  }
  return bestOffset;
}

function collectMatches(
  oldLines: string[],
  oldStart: number,
  oldEnd: number,
  newLines: string[],
  newStart: number,
  newEnd: number,
  matches: LineMatch[],
): void {
  const oldLength = oldEnd - oldStart;
  const newLength = newEnd - newStart;
  if (oldLength === 0 || newLength === 0) return;
  if (oldLength === 1) {
    for (let newIndex = newStart; newIndex < newEnd; newIndex += 1) {
      if (oldLines[oldStart] === newLines[newIndex]) {
        matches.push([oldStart, newIndex]);
        return;
      }
    }
    return;
  }
  if (newLength === 1) {
    for (let oldIndex = oldStart; oldIndex < oldEnd; oldIndex += 1) {
      if (oldLines[oldIndex] === newLines[newStart]) {
        matches.push([oldIndex, newStart]);
        return;
      }
    }
    return;
  }

  const oldMiddle = oldStart + Math.floor(oldLength / 2);
  const newMiddle =
    newStart +
    splitOffset(oldLines, oldStart, oldMiddle, oldEnd, newLines, newStart, newEnd);
  collectMatches(oldLines, oldStart, oldMiddle, newLines, newStart, newMiddle, matches);
  collectMatches(oldLines, oldMiddle, oldEnd, newLines, newMiddle, newEnd, matches);
}

/** Lengths of the identical leading and trailing line runs; they never overlap. */
export function commonAffix(oldLines: string[], newLines: string[]): [head: number, tail: number] {
  const shortest = Math.min(oldLines.length, newLines.length);
  let head = 0;
  while (head < shortest && oldLines[head] === newLines[head]) head += 1;
  let tail = 0;
  while (
    tail < shortest - head &&
    oldLines[oldLines.length - 1 - tail] === newLines[newLines.length - 1 - tail]
  ) tail += 1;
  return [head, tail];
}

/**
 * A real line-level diff using Hirschberg's linear-space longest-common-subsequence algorithm --
 * not a lexical/syntax-highlighting pass, and not "every removed line then every added line."
 * The identical leading and trailing lines are matched directly; Hirschberg's O(k*l) runtime and
 * linear working memory apply only to the lines between them.
 */
export function computeLineDiff(oldLines: string[], newLines: string[]): LyraDiffOp[] {
  const [head, tail] = commonAffix(oldLines, newLines);
  const matches: LineMatch[] = [];
  for (let index = 0; index < head; index += 1) matches.push([index, index]);
  collectMatches(oldLines, head, oldLines.length - tail, newLines, head, newLines.length - tail, matches);
  for (let index = tail; index > 0; index -= 1) {
    matches.push([oldLines.length - index, newLines.length - index]);
  }

  const ops: LyraDiffOp[] = [];
  let oldIndex = 0;
  let newIndex = 0;
  for (const [matchedOldIndex, matchedNewIndex] of matches) {
    while (oldIndex < matchedOldIndex) ops.push({ type: 'remove', text: oldLines[oldIndex++]! });
    while (newIndex < matchedNewIndex) ops.push({ type: 'add', text: newLines[newIndex++]! });
    ops.push({ type: 'equal', text: oldLines[matchedOldIndex]! });
    oldIndex = matchedOldIndex + 1;
    newIndex = matchedNewIndex + 1;
  }
  while (oldIndex < oldLines.length) ops.push({ type: 'remove', text: oldLines[oldIndex++]! });
  while (newIndex < newLines.length) ops.push({ type: 'add', text: newLines[newIndex++]! });
  return ops;
}

export interface LyraDiffSplitRow {
  left: LyraDiffOp | null;
  right: LyraDiffOp | null;
}

/**
 * Regroups an already-computed `LyraDiffOp[]` (never re-diffs) into side-by-side rows: consecutive
 * `remove`s buffer on the left, consecutive `add`s buffer on the right, and an `equal` op (or the
 * end of the stream) flushes both buffers paired index-wise -- the k-th removed line beside the
 * k-th added line, with the longer run's tail paired against `null` (rendered as an empty
 * placeholder cell, never carrying a `+`/`-` prefix). An `equal` op renders identically on both
 * sides.
 */
export function pairOpsForSplit(ops: LyraDiffOp[]): LyraDiffSplitRow[] {
  const rows: LyraDiffSplitRow[] = [];
  let removeBuffer: LyraDiffOp[] = [];
  let addBuffer: LyraDiffOp[] = [];
  const flush = (): void => {
    const max = Math.max(removeBuffer.length, addBuffer.length);
    for (let i = 0; i < max; i++) {
      rows.push({ left: removeBuffer[i] ?? null, right: addBuffer[i] ?? null });
    }
    removeBuffer = [];
    addBuffer = [];
  };
  for (const op of ops) {
    if (op.type === 'remove') removeBuffer.push(op);
    else if (op.type === 'add') addBuffer.push(op);
    else {
      flush();
      rows.push({ left: op, right: op });
    }
  }
  flush();
  return rows;
}
