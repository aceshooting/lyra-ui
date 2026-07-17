export interface DiffOp {
  type: 'equal' | 'add' | 'remove';
  text: string;
}

/**
 * A real line-level diff via the classic O(n*m) longest-common-subsequence dynamic program --
 * not a lexical/syntax-highlighting pass, and not "every removed line then every added line."
 * Fine for the typical size of a tool-call/transcript diff this component targets; a full Myers
 * implementation would be asymptotically faster on very large inputs but isn't needed to fix the
 * filed defect (alignment), only to make it correct.
 */
export function computeLineDiff(oldLines: string[], newLines: string[]): DiffOp[] {
  const m = oldLines.length;
  const n = newLines.length;
  const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      lcs[i]![j] = oldLines[i] === newLines[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (oldLines[i] === newLines[j]) {
      ops.push({ type: 'equal', text: oldLines[i]! });
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      ops.push({ type: 'remove', text: oldLines[i]! });
      i++;
    } else {
      ops.push({ type: 'add', text: newLines[j]! });
      j++;
    }
  }
  while (i < m) {
    ops.push({ type: 'remove', text: oldLines[i]! });
    i++;
  }
  while (j < n) {
    ops.push({ type: 'add', text: newLines[j]! });
    j++;
  }
  return ops;
}

export interface DiffSplitRow {
  left: DiffOp | null;
  right: DiffOp | null;
}

/**
 * Regroups an already-computed `DiffOp[]` (never re-diffs) into side-by-side rows: consecutive
 * `remove`s buffer on the left, consecutive `add`s buffer on the right, and an `equal` op (or the
 * end of the stream) flushes both buffers paired index-wise -- the k-th removed line beside the
 * k-th added line, with the longer run's tail paired against `null` (rendered as an empty
 * placeholder cell, never carrying a `+`/`-` prefix). An `equal` op renders identically on both
 * sides.
 */
export function pairOpsForSplit(ops: DiffOp[]): DiffSplitRow[] {
  const rows: DiffSplitRow[] = [];
  let removeBuffer: DiffOp[] = [];
  let addBuffer: DiffOp[] = [];
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
