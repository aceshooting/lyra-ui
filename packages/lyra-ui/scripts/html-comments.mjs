/**
 * Index after an HTML comment beginning at start, bounded by limit. HTML accepts both normal
 * and bang endings, plus the abrupt empty-comment endings in its comment-start states.
 * This finds lexical comment boundaries; it does not sanitize HTML or parse an entire document.
 */
export function htmlCommentEnd(text, start, limit = text.length) {
  const body = start + 4;
  if (body < limit && text[body] === '>') return body + 1;
  if (body + 1 < limit && text.startsWith('->', body)) return body + 2;
  for (let index = body; index < limit; index += 1) {
    if (index + 3 <= limit && text.startsWith('-->', index)) return index + 3;
    if (index + 4 <= limit && text.startsWith('--!>', index)) return index + 4;
  }
  return limit;
}

/** Transform lexical comments once; the result is text for analysis, never sanitized HTML. */
export function replaceHtmlComments(text, replacement) {
  const chunks = [];
  let offset = 0;
  for (let start = text.indexOf('<!--'); start >= 0; start = text.indexOf('<!--', offset)) {
    const end = htmlCommentEnd(text, start);
    chunks.push(text.slice(offset, start), replacement(text.slice(start, end)));
    offset = end;
  }
  chunks.push(text.slice(offset));
  return chunks.join('');
}

/** Mask comments without changing offsets or line breaks used by source diagnostics. */
export function maskHtmlComments(text) {
  return replaceHtmlComments(text, (comment) => comment.replace(/[^\r\n]/g, ' '));
}
