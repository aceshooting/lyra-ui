/**
 * Parses a native-`accept`-style string (`".csv,.xlsx"`, `"text/csv"`,
 * `"image/*"`, or any mix, comma-separated) and reports whether `file`
 * matches it — the same three forms the browser's own file picker accepts,
 * now also enforced on the drag-drop path (previously `accept` only
 * constrained the native picker dialog and had no effect on drop).
 *
 * `file` may be a `DataTransferItem` cast as `File` (the dragenter-preview
 * call site, before the drop payload has real `File` objects) - unlike
 * `File`, `DataTransferItem` has no `.name`, only `.type`, so extension
 * patterns (`.csv`) can't be evaluated pre-drop. By default an unresolved
 * extension pattern counts as no match, since that's the correct behavior
 * once real `File` objects are available at drop time. Pass
 * `assumeExtensionMatch: true` to instead treat an unresolved extension
 * pattern as a possible match — this is what dragenter preview uses so it
 * doesn't render a false "reject" state for accept lists that are
 * extension-only, when the file may well be accepted once dropped.
 */
export function matchesAccept(file: File, accept: string, assumeExtensionMatch = false): boolean {
  const parts = accept
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (parts.length === 0) return true;

  const name = file.name?.toLowerCase();
  const type = (file.type || '').toLowerCase();

  return parts.some((p) => {
    if (p.startsWith('.')) return name === undefined ? assumeExtensionMatch : name.endsWith(p);
    if (p.endsWith('/*')) return type.startsWith(p.slice(0, -1));
    return type === p;
  });
}
