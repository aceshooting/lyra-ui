/** A parsed A1-notation cell range. Rows/columns are 0-based and normalized so `start <= end`. */
export interface ParsedCellRange {
  sheet?: string;
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

const CELL_REF_RE = /^\$?([A-Za-z]+)\$?(\d+)$/;

/** Bijective base-26 column letters ('A' = 0, 'Z' = 25, 'AA' = 26, ...) to a 0-based index. */
function columnToIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

function indexToColumn(index: number): string {
  let n = index + 1;
  let letters = '';
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function parseCellRef(ref: string): { row: number; col: number } | null {
  const match = CELL_REF_RE.exec(ref.trim());
  if (!match) return null;
  return { row: Number(match[2]) - 1, col: columnToIndex(match[1]) };
}

/**
 * Parses an A1-notation cell or cell-range reference, tolerating an optional `Sheet name!` prefix
 * (quoted with single quotes when the name contains a space), `$` absolute markers, and lowercase
 * column letters. Whole-row (`3:7`) and whole-column (`A:A`) references are unsupported this round
 * and return `null` -- a bare `parseCellRef()` failure on either half of the range means neither
 * looks like a real single-cell reference.
 */
export function parseCellRange(input: string): ParsedCellRange | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let sheet: string | undefined;
  let rest = trimmed;
  const bangIndex = rest.lastIndexOf('!');
  if (bangIndex !== -1) {
    const rawSheet = rest.slice(0, bangIndex).trim();
    sheet = rawSheet.startsWith("'") && rawSheet.endsWith("'") ? rawSheet.slice(1, -1) : rawSheet;
    rest = rest.slice(bangIndex + 1);
  }

  const parts = rest.split(':');
  if (parts.length > 2) return null;
  const first = parseCellRef(parts[0]!);
  if (!first) return null;
  const second = parts.length === 2 ? parseCellRef(parts[1]!) : first;
  if (!second) return null;

  return {
    ...(sheet ? { sheet } : {}),
    startRow: Math.min(first.row, second.row),
    endRow: Math.max(first.row, second.row),
    startCol: Math.min(first.col, second.col),
    endCol: Math.max(first.col, second.col),
  };
}

/** Inverse of `parseCellRange()` -- builds an A1-notation string for a `LyraAnchor` of kind `cell-range`. */
export function formatCellRange(range: ParsedCellRange): string {
  const start = `${indexToColumn(range.startCol)}${range.startRow + 1}`;
  const end = `${indexToColumn(range.endCol)}${range.endRow + 1}`;
  const body = start === end ? start : `${start}:${end}`;
  return range.sheet ? `${range.sheet}!${body}` : body;
}
