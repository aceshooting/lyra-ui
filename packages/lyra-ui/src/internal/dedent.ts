/**
 * Removes the indentation that the markup around a slotted code sample adds.
 *
 * Line endings become `\n`. Leading and trailing whitespace-only lines (the newline after the opening tag and the
 * indent before the closing tag) are dropped, then the smallest
 * indentation shared by every non-blank line is removed from all of them. Blank lines never
 * influence the common indent. Interior lines keep any further indentation unchanged.
 */
export function dedent(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  while (lines.length > 1 && /^[ \t]*$/.test(lines[0]!)) lines.shift();
  while (lines.length > 0 && /^[ \t]*$/.test(lines[lines.length - 1]!)) lines.pop();
  let indent = Infinity;
  for (const line of lines) {
    if (/^[ \t]*$/.test(line)) continue;
    const lead = /^[ \t]*/.exec(line)![0].length;
    if (lead < indent) indent = lead;
  }
  if (!Number.isFinite(indent) || indent === 0) return lines.join('\n');
  return lines.map((line) => (/^[ \t]*$/.test(line) ? '' : line.slice(indent))).join('\n');
}

/** Keeps slotted code as written, ignoring only the single newline right after the opening tag. */
export function stripLeadingNewline(text: string): string {
  const normalized = text.replace(/\r\n?/g, '\n');
  return normalized.startsWith('\n') ? normalized.slice(1) : normalized;
}
