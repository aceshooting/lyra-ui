import { asciiWhitespaceTokens } from './ascii-whitespace.js';

/**
 * Resolves the `rel` value for a rendered anchor from an author-supplied `rel` and the anchor's
 * `target`. Author tokens are kept in first-occurrence order and de-duplicated; `opener` is
 * stripped in any letter case, because it would re-enable `window.opener` access; and whenever
 * `target` is non-empty the `noopener noreferrer` guard is added. A same-tab link needs no guard,
 * so it renders exactly the author's tokens.
 *
 * Tokens split on ASCII whitespace, exactly as the browser reads `rel`: a no-break space is part of
 * a token, not a separator. Returns `undefined` when nothing remains, so callers omit the
 * attribute rather than rendering it empty.
 */
export function resolveGuardedRel(
  rel: string | null | undefined,
  target: string | null | undefined,
): string | undefined {
  const tokens = new Set<string>();
  for (const token of asciiWhitespaceTokens(rel ?? null)) {
    if (token.toLowerCase() !== 'opener') tokens.add(token);
  }
  if (target) {
    tokens.add('noopener');
    tokens.add('noreferrer');
  }
  return tokens.size > 0 ? [...tokens].join(' ') : undefined;
}
