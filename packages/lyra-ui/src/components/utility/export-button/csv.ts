/**
 * Guard every common ASCII and fullwidth formula sigil. Spreadsheet engines vary in whether
 * leading '-' is interpreted as a formula, leading whitespace is stripped before the cell is
 * parsed, and fullwidth variants can be normalized during import, so treating all of them as text
 * is the fail-closed export contract.
 *
 * Exported (but deliberately not re-exported from the package root) so every delimited-text writer
 * in the library shares ONE definition of "unsafe leading character". `<lr-data-grid>` cannot call
 * `escapeCsvField()` itself -- it supports a caller-chosen delimiter and deliberately never
 * text-prefixes a real numeric cell -- but it must not carry a second, drifting copy of this set
 * either, which is exactly how it ended up guarding only the four bare ASCII sigils.
 *
 * @internal
 */
export const UNSAFE_LEADING = /^[\s=+\-@\uFF1D\uFF0B\uFF0D\uFF20]/u;
const NEEDS_QUOTING = /[",\r\n]/;

/** Escapes a CSV field: quotes as needed, guards against formula injection. */
export function escapeCsvField(value: unknown): string {
  // Keep real finite numbers as numeric spreadsheet cells. Formula guarding applies to caller
  // strings, where a leading minus is data rather than trusted numeric type information.
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  let s = value == null ? '' : String(value);
  if (UNSAFE_LEADING.test(s)) s = `'${s}`;
  if (NEEDS_QUOTING.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export interface LyraCsvColumn {
  readonly key: string;
  readonly label: string;
}

/** The UTF-8 byte-order mark (U+FEFF), spelled via `fromCharCode` rather than a source literal so
 *  no invisible character sits in this file. */
const UTF8_BOM = String.fromCharCode(0xfeff);

export interface LyraBuildCsvOptions {
  /** Prepends a UTF-8 byte-order mark (U+FEFF) ahead of the header row. Excel on Windows
   *  ignores a downloaded file's MIME charset and decodes a BOM-less CSV with the system ANSI
   *  code page, so accented, Arabic, CJK, and typographic characters render as mojibake; the BOM
   *  makes Excel detect UTF-8 and decode correctly. Google Sheets, LibreOffice, and Numbers
   *  already sniff UTF-8 correctly with or without it. Defaults to `false` (today's bytes,
   *  unchanged). Never apply this to JSON -- RFC 8259 forbids a BOM there. */
  readonly bom?: boolean;
}

/** Builds a CRLF-joined CSV string with a header row, optionally prefixed with a UTF-8
 *  byte-order mark (see `LyraBuildCsvOptions.bom`). */
export function buildCsv(
  rows: readonly Readonly<Record<string, unknown>>[],
  columns: readonly LyraCsvColumn[],
  options?: LyraBuildCsvOptions,
): string {
  const header = columns.map((c) => escapeCsvField(c.label)).join(',');
  const body = rows.map((row) => columns.map((c) => escapeCsvField(row[c.key])).join(','));
  const csv = [header, ...body].join('\r\n');
  return options?.bom ? UTF8_BOM + csv : csv;
}

/** Triggers a browser download of `content` as `filename` in `ownerDocument`'s realm. */
export function downloadBlob(
  content: string,
  filename: string,
  mime: string,
  ownerDocument: Document = document,
): void {
  const view = ownerDocument.defaultView;
  if (!view) throw new Error('Cannot start a download without a browsing context.');
  const blob = new view.Blob([content], { type: mime });
  const url = view.URL.createObjectURL(blob);
  const a = ownerDocument.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // Deferred revoke: Safari can cancel the download if the URL is revoked immediately.
  view.setTimeout(() => view.URL.revokeObjectURL(url), 5000);
}
