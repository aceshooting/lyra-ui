/**
 * Approximate token counter. This is NOT a provider tokenizer and never a provider token count.
 *
 * `heuristic-v1` pre-splits text the way byte-pair tokenizers commonly do, then estimates the pieces:
 *   - a letter run (with one optional leading space) costs ceil(letters / 4) pieces, and each
 *     lower-to-upper camelCase boundary inside it starts a new piece;
 *   - a digit run (with one optional leading space) costs ceil(digits / 3);
 *   - each punctuation or symbol code point costs 1 (so `":` and `},` cost one per character);
 *   - a whitespace run costs 1 when it contains a newline or is longer than one space, else 0 (a single
 *     space is absorbed by the next word);
 *   - every non-ASCII code point costs 1.
 * The pure byte baseline `ceil(utf8Bytes / 4)` is reported next to it. Neither was calibrated against
 * any provider; use them only to compare encodings of the same content with each other.
 */
export const TOKENIZER_NAME = 'heuristic-v1';
const piece = /( ?[A-Za-z]+)|( ?[0-9]+)|(\s+)|([^\s])/gu;

export function approximateTokens(text) {
  let total = 0;
  for (const match of text.matchAll(piece)) {
    const [whole, letters, digits, space] = match;
    if (letters !== undefined) {
      const word = letters.trimStart();
      let count = 0;
      for (const part of word.split(/(?<=[a-z])(?=[A-Z])/u)) count += Math.ceil(part.length / 4);
      total += count;
    } else if (digits !== undefined) total += Math.ceil(digits.trimStart().length / 3);
    else if (space !== undefined) total += space.length === 1 && space !== '\n' ? 0 : 1;
    else total += 1;
    void whole;
  }
  return total;
}

export const bytesBaselineTokens = (text) => Math.ceil(new TextEncoder().encode(text).length / 4);
