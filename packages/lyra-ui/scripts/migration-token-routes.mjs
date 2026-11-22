// Web Awesome / Shoelace design-token routes.
//
// The reviewed table lives in fixtures/upstream-token-routes.json; this module only looks names up
// and locates the references a file reads. Every target is a token the Lyra document layer
// declares (enforced by migration-token-routes.test.mjs).

import table from './fixtures/upstream-token-routes.json' with { type: 'json' };

/** @typedef {'exact' | 'approximate' | 'review'} UpstreamTokenRouteKind */

const EXACT = new Map(Object.entries(table.exact));
const APPROXIMATE = new Map(Object.entries(table.approximate));
const REVIEW = new Map(Object.entries(table.review));
const REVIEW_PATTERNS = table.reviewPatterns.map(({ pattern, note }) => ({ pattern: new RegExp(pattern), note }));

/** The whole upstream custom-property name at an offset; never a prefix of a longer name. */
export const UPSTREAM_TOKEN_REFERENCE = /(?<![\w-])--(?<ecosystem>wa|sl)-[a-z0-9-]+(?![\w-])/g;

/**
 * Looks up one upstream token name.
 *
 * @param {string} token A full `--wa-*` or `--sl-*` custom-property name.
 * @returns {{ kind: UpstreamTokenRouteKind, target: string | null, note: string | null } | null}
 *   `null` for a name the table does not know.
 */
export function lookupUpstreamToken(token) {
  const exact = EXACT.get(token);
  if (exact) return { kind: 'exact', target: exact, note: null };
  const approximate = APPROXIMATE.get(token);
  if (approximate) return { kind: 'approximate', target: approximate.target, note: approximate.note };
  const review = REVIEW.get(token) ?? REVIEW_PATTERNS.find(({ pattern }) => pattern.test(token))?.note;
  if (review) return { kind: 'review', target: null, note: review };
  return null;
}

/**
 * Upstream token names a file declares (`--wa-x: ...`). Such a name is the file's own property that
 * merely shares the prefix, or a theme override the author owns, so it is neither rewritten nor
 * reported.
 *
 * @param {string} text
 * @returns {Set<string>}
 */
export function declaredUpstreamTokens(text) {
  return new Set([...text.matchAll(/(--(?:wa|sl)-[a-z0-9-]+)\s*:/g)].map((match) => match[1]));
}

/**
 * Finds every upstream token reference with an exact or approximate route.
 *
 * @param {string} text
 * @param {(offset: number) => boolean} [isIgnored] Offsets to skip, such as comments.
 * @returns {Array<{ start: number, end: number, token: string, origin: 'webawesome' | 'shoelace',
 *   kind: 'exact' | 'approximate', target: string, note: string | null }>}
 */
export function scanUpstreamTokenRoutes(text, isIgnored = () => false) {
  const declared = declaredUpstreamTokens(text);
  const found = [];
  for (const match of text.matchAll(UPSTREAM_TOKEN_REFERENCE)) {
    const token = match[0];
    if (declared.has(token) || isIgnored(match.index)) continue;
    const route = lookupUpstreamToken(token);
    if (!route || route.kind === 'review') continue;
    found.push({
      start: match.index,
      end: match.index + token.length,
      token,
      origin: match.groups.ecosystem === 'sl' ? 'shoelace' : 'webawesome',
      kind: route.kind,
      target: route.target,
      note: route.note,
    });
  }
  return found;
}
