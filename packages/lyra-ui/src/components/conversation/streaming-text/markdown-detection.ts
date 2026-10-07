/**
 * Lightweight, deliberately-imperfect signals that the currently-displayed
 * text contains Markdown syntax worth routing through the composed Markdown
 * renderer rather than a plain `white-space: pre-wrap` node. Checked in order against
 * the whole string; the first match short-circuits. None of these need to be
 * airtight -- a false positive just renders ordinary prose through
 * Markdown mode (which renders plain prose fine); a false negative just
 * renders literal `**`/backticks/etc. as plain text until more of the stream
 * arrives.
 */
export const APPEND_MONOTONIC_MARKDOWN_PATTERNS: readonly RegExp[] = [
  /^ {0,3}#{1,6}\s+\S/m, // ATX heading: "# Heading"
  /```/, // fenced code block
  /\*\*[^*\n]+\*\*/, // **bold**
  /`[^`\n]+`/, // inline code
  /^ {0,3}[-*+]\s+\S/m, // bullet list item
  /^ {0,3}\d+\.\s+\S/m, // numbered list item
  /\[[^\]]+\]\([^)\s]+\)/, // [text](url)
  /^ {0,3}>\s?\S/m, // blockquote
];

// The trailing boundary may be the current end of a stream. Appending a
// word character can therefore invalidate a prior match (`_x_` -> `_x_a`).
export const BOUNDARY_SENSITIVE_MARKDOWN_PATTERNS: readonly RegExp[] = [
  /(?:^|[^\w])_[^_\n]+_(?:[^\w]|$)/, // _italic_
];

/** Runs {@link APPEND_MONOTONIC_MARKDOWN_PATTERNS}/{@link BOUNDARY_SENSITIVE_MARKDOWN_PATTERNS}
 *  against `text`, used whenever `contentMode` is left unset (auto-detect). Exported so the
 *  heuristic is directly testable without going through either variant's render cycle. */
export function looksLikeMarkdown(text: string): boolean {
  if (!text) return false;
  return [...APPEND_MONOTONIC_MARKDOWN_PATTERNS, ...BOUNDARY_SENSITIVE_MARKDOWN_PATTERNS].some((pattern) =>
    pattern.test(text),
  );
}
