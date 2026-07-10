/**
 * Parses a native-`accept`-style string (`".csv,.xlsx"`, `"text/csv"`,
 * `"image/*"`, or any mix, comma-separated) and reports whether `file`
 * matches it — the same three forms the browser's own file picker accepts,
 * now also enforced on the drag-drop path (2026-07-10 audit,
 * "map-file-input" §lyra-file-input, High: previously `accept` only
 * constrained the native picker dialog and had no effect on drop).
 */
export function matchesAccept(file: File, accept: string): boolean {
  const parts = accept
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (parts.length === 0) return true;

  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();

  return parts.some((p) => {
    if (p.startsWith('.')) return name.endsWith(p);
    if (p.endsWith('/*')) return type.startsWith(p.slice(0, -1));
    return type === p;
  });
}
