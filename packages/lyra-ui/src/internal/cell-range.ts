/** A parsed A1-notation cell range. Rows/columns are 0-based and normalized so `start <= end`. */
export interface ParsedCellRange {
  sheet?: string;
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

const CELL_REF_RE = /^\$?([A-Za-z]+)\$?(\d+)$/;
const MAX_CELL_RANGE_INPUT_LENGTH = 1024;
const MAX_SHEET_NAME_LENGTH = 255;
const MAX_CELL_REFERENCE_LENGTH = 64;
const MAX_ZERO_BASED_COORDINATE = Number.MAX_SAFE_INTEGER - 1;

/** Bijective base-26 column letters ('A' = 0, 'Z' = 25, 'AA' = 26, ...) to a 0-based index. */
function columnToIndex(letters: string): number | null {
  let n = 0;
  for (const ch of letters.toUpperCase()) {
    const digit = ch.charCodeAt(0) - 64;
    if (n > Math.floor((Number.MAX_SAFE_INTEGER - digit) / 26)) return null;
    n = n * 26 + digit;
  }
  return n - 1;
}

function isCoordinate(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_ZERO_BASED_COORDINATE
  );
}

function indexToColumn(index: number): string | null {
  if (!isCoordinate(index)) return null;
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
  const trimmed = ref.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_CELL_REFERENCE_LENGTH) return null;
  const match = CELL_REF_RE.exec(trimmed);
  if (!match) return null;
  const rowNumber = Number(match[2]);
  const col = columnToIndex(match[1]!);
  if (!Number.isSafeInteger(rowNumber) || rowNumber <= 0 || col === null) return null;
  const row = rowNumber - 1;
  return isCoordinate(row) && isCoordinate(col) ? { row, col } : null;
}

/**
 * Parses an A1-notation cell or cell-range reference, tolerating an optional `Sheet name!` prefix
 * (quoted with single quotes when the name contains a space), `$` absolute markers, and lowercase
 * column letters. Whole-row (`3:7`) and whole-column (`A:A`) references are currently unsupported
 * and return `null` -- a bare `parseCellRef()` failure on either half of the range means neither
 * looks like a real single-cell reference.
 */
export function parseCellRange(input: string): ParsedCellRange | null {
  if (typeof input !== 'string' || input.length > MAX_CELL_RANGE_INPUT_LENGTH) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  let sheet: string | undefined;
  let rest = trimmed;
  const bangIndex = rest.lastIndexOf('!');
  if (bangIndex !== -1) {
    const rawSheet = rest.slice(0, bangIndex).trim();
    sheet = rawSheet.startsWith("'") && rawSheet.endsWith("'") ? rawSheet.slice(1, -1) : rawSheet;
    if (!sheet || sheet.length > MAX_SHEET_NAME_LENGTH) return null;
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

/**
 * Inverse of `parseCellRange()` -- builds an A1-notation string for a `LyraAnchor` of kind
 * `cell-range`. Returns `null` for non-finite, unsafe, negative, reversed, or overlong input rather
 * than entering an unbounded column-conversion loop.
 */
export function formatCellRange(range: ParsedCellRange): string | null {
  if (
    !isCoordinate(range.startRow) ||
    !isCoordinate(range.startCol) ||
    !isCoordinate(range.endRow) ||
    !isCoordinate(range.endCol) ||
    range.startRow > range.endRow ||
    range.startCol > range.endCol ||
    (range.sheet !== undefined &&
      (typeof range.sheet !== 'string' || range.sheet.length === 0 || range.sheet.length > MAX_SHEET_NAME_LENGTH))
  ) {
    return null;
  }
  const startColumn = indexToColumn(range.startCol);
  const endColumn = indexToColumn(range.endCol);
  if (startColumn === null || endColumn === null) return null;
  const start = `${startColumn}${range.startRow + 1}`;
  const end = `${endColumn}${range.endRow + 1}`;
  const body = start === end ? start : `${start}:${end}`;
  return range.sheet ? `${range.sheet}!${body}` : body;
}
