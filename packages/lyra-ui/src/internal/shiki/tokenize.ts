import { splitLines } from '../text-lines.js';
import {
  SHIKI_SOURCE_MAX_CODE_UNITS,
  SHIKI_THEMES,
  type ShikiHighlighter,
  type ShikiTransformer,
} from './core.js';

/**
 * Highlights `code` as dual-theme markup. Returns `null` past {@link SHIKI_SOURCE_MAX_CODE_UNITS},
 * for a non-string result, or when the grammar or highlighter throws, so callers fall back to
 * plain text instead of a blank surface.
 */
export function highlightToHtml(
  highlighter: ShikiHighlighter,
  code: string,
  language: string,
  transformers?: readonly ShikiTransformer[],
  options: { readonly includeExplanation?: 'scopeName' } = {},
): string | null {
  if (code.length > SHIKI_SOURCE_MAX_CODE_UNITS) return null;
  try {
    const markup = highlighter.codeToHtml(code, transformers
      ? { lang: language, themes: SHIKI_THEMES, transformers: [...transformers], ...options }
      : { lang: language, themes: SHIKI_THEMES, ...options });
    return typeof markup === 'string' ? markup : null;
  } catch {
    return null;
  }
}

const LINE_CLASS = '<span class="line"';
const LINE = /^(?:\s[^>]*)?>([\s\S]*)<\/span>$/;

// Token text is escaped and never holds a line break, so the classic structure's newline
// separators split it into exactly the rendered lines without a second HTML parse.
function markupLines(markup: string): string[] | null {
  const code = markup.indexOf('<code');
  const open = code < 0 ? -1 : markup.indexOf('>', code);
  const close = markup.lastIndexOf('</code>');
  if (open < 0 || close < open) return null;
  const body = markup.slice(open + 1, close);
  if (body === '') return [];
  const lines: string[] = [];
  for (const segment of body.split('\n')) {
    const line = segment.startsWith(LINE_CLASS) && LINE.exec(segment.slice(LINE_CLASS.length));
    if (!line) return null;
    lines.push(line[1]!);
  }
  return lines;
}

/**
 * Tokenizes `text` as one document (so multi-line tokens survive) and returns each source line's
 * inner markup, normalized to exactly `splitLines(text).length` entries. Returns `null` whenever
 * {@link highlightToHtml} does. An owner document preserves browser parsing for custom highlighters;
 * without one, only classic Shiki line markup is supported.
 */
export function tokenizeToLines(
  highlighter: ShikiHighlighter,
  text: string,
  language: string,
  ownerDocument?: Document,
): string[] | null {
  const markup = highlightToHtml(highlighter, text, language);
  if (markup === null) return null;
  let lines: string[] | null;
  if (ownerDocument) {
    const Parser = ownerDocument.defaultView?.DOMParser;
    if (!Parser) return null;
    try {
      const parsed = new Parser().parseFromString(markup, 'text/html');
      lines = Array.from(parsed.querySelectorAll('code > .line'), (line) => line.innerHTML);
    } catch {
      return null;
    }
  } else {
    lines = markupLines(markup);
  }
  if (!lines) return null;
  const expected = splitLines(text).length;
  if (lines.length > expected) lines.length = expected;
  while (lines.length < expected) lines.push('');
  return lines;
}
