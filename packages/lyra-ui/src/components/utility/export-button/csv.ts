// Guard every common ASCII and fullwidth formula sigil. Spreadsheet engines vary in whether
// leading '-' is interpreted as a formula, and fullwidth variants can be normalized during
// import, so treating all of them as text is the fail-closed export contract.
const UNSAFE_LEADING = /^[=+\-@\uFF1D\uFF0B\uFF0D\uFF20\t\r\n]/;
const NEEDS_QUOTING = /[",\r\n]/;

/** Escapes a CSV field: quotes as needed, guards against formula injection. */
export function escapeCsvField(value: unknown): string {
  let s = value == null ? '' : String(value);
  if (UNSAFE_LEADING.test(s)) s = `'${s}`;
  if (NEEDS_QUOTING.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export interface CsvColumn {
  key: string;
  label: string;
}

/** Builds a CRLF-joined CSV string with a header row. */
export function buildCsv(rows: Record<string, unknown>[], columns: CsvColumn[]): string {
  const header = columns.map((c) => escapeCsvField(c.label)).join(',');
  const body = rows.map((row) => columns.map((c) => escapeCsvField(row[c.key])).join(','));
  return [header, ...body].join('\r\n');
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
