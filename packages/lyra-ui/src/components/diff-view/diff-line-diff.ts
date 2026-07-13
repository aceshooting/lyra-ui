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
