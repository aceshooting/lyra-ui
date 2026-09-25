/**
 * Resolves the `rel` value for a rendered anchor from an author-supplied `rel` and the anchor's
 * `target`. Author tokens are kept in first-occurrence order and de-duplicated; `opener` is
 * stripped in any letter case, because it would re-enable `window.opener` access; and whenever
 * `target` is non-empty the `noopener noreferrer` guard is added. A same-tab link needs no guard,
 * so it renders exactly the author's tokens.
 *
 * Tokens split on `/\s+/`, which includes a no-break space. Returns `undefined` when nothing
 * remains, so callers omit the attribute rather than rendering it empty.
 */
export function resolveGuardedRel(
  rel: string | null | undefined,
  target: string | null | undefined,
): string | undefined {
  const tokens = new Set(
    (rel ?? '').split(/\s+/).filter((token) => token !== '' && token.toLowerCase() !== 'opener'),
  );
  if (target) {
    tokens.add('noopener');
    tokens.add('noreferrer');
  }
  return tokens.size > 0 ? [...tokens].join(' ') : undefined;
}
