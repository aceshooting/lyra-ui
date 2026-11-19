export interface MarkdownFenceLine {
  readonly char: '`' | '~';
  readonly length: number;
  readonly indent: number;
  readonly info: string;
}

/** Classifies a complete source line. The caller supplies its indentation policy. */
export function matchMarkdownFenceLine(line: string): MarkdownFenceLine | null {
  const match = /^([\t ]*)(`{3,}|~{3,})([^\r\n]*)\r?$/.exec(line);
  if (!match) return null;
  const run = match[2]!;
  const info = match[3]!;
  if (run[0] === '`' && info.includes('`')) return null;
  return { char: run[0] as '`' | '~', length: run.length, indent: match[1]!.length, info };
}

export function isMarkdownFenceCloser(opening: MarkdownFenceLine, line: MarkdownFenceLine): boolean {
  return line.char === opening.char && line.length >= opening.length && !/[^ \t]/.test(line.info);
}

/** Reads a completed top-level opener from normalized streaming source. */
export function parseMarkdownFenceOpener(source: string): (MarkdownFenceLine & { end: number }) | null {
  if (!/^ {0,3}[`~]/.test(source)) return null;
  const newline = source.indexOf('\n');
  if (newline < 0) return null;
  const opening = matchMarkdownFenceLine(source.slice(0, newline));
  return opening && { ...opening, end: newline + 1 };
}

/** Searches complete lines for a top-level closing fence. */
export function markdownFenceClosePattern(opening: MarkdownFenceLine): RegExp {
  return new RegExp(`^ {0,3}${opening.char}{${opening.length},}[ \t]*\r?$`, 'm');
}
