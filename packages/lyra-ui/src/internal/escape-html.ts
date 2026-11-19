const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const HTML_PATTERN = /[&<>"']/g;
const SVG_TEXT_PATTERN = /[&<>"'\r]/g;

/**
 * Escapes `& < > " '` in one pass, so already-escaped output is never escaped twice within a
 * single call. With `svgText`, a carriage return is written as `&#13;` too: XML end-of-line
 * normalization would otherwise turn a raw CR into LF.
 */
export function escapeHtml(text: string, opts?: { readonly svgText?: boolean }): string {
  if (opts?.svgText) {
    return text.replace(SVG_TEXT_PATTERN, (ch) => (ch === '\r' ? '&#13;' : ESCAPES[ch]!));
  }
  return text.replace(HTML_PATTERN, (ch) => ESCAPES[ch]!);
}
