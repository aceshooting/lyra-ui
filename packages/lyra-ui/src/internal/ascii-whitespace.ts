function isAsciiWhitespace(code: number): boolean {
  return code === 0x09 || code === 0x0a || code === 0x0c || code === 0x0d || code === 0x20;
}

/**
 * Iterates HTML/ARIA space-separated tokens without treating Unicode whitespace as a delimiter.
 * A bounded caller can charge each inspected code unit before any complete token is sliced.
 */
export function* asciiWhitespaceTokens(
  value: string | null,
  consumeCodeUnit?: () => boolean,
): Generator<string> {
  if (value === null || value === '') return;
  let tokenStart = -1;
  for (let index = 0; index < value.length; index += 1) {
    if (consumeCodeUnit && !consumeCodeUnit()) return;
    if (isAsciiWhitespace(value.charCodeAt(index))) {
      if (tokenStart >= 0) {
        yield value.slice(tokenStart, index);
        tokenStart = -1;
      }
    } else if (tokenStart < 0) {
      tokenStart = index;
    }
  }
  if (tokenStart >= 0) yield value.slice(tokenStart);
}

/** Whether a value can be represented as one IDREF token in a serialized ARIA relationship. */
export function isSingleAsciiWhitespaceToken(value: string): boolean {
  if (value === '') return false;
  for (let index = 0; index < value.length; index += 1) {
    if (isAsciiWhitespace(value.charCodeAt(index))) return false;
  }
  return true;
}
