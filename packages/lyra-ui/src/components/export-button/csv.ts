// A bare leading '-' is not itself formula syntax (only '=', and context-dependent '+'/'@',
// reliably trigger spreadsheet formula evaluation) — guarding it forces text rendering on
// ordinary negative numbers/currency. Per OWASP CSV-injection guidance, '-' is intentionally
// excluded here.
const UNSAFE_LEADING = /^[=+@\t\r\n]/;
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

/** Triggers a browser download of `content` as `filename`. */
export function downloadBlob(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // Deferred revoke: Safari can cancel the download if the URL is revoked immediately.
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
