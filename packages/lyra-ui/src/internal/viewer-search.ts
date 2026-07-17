import type { Announcer } from './announcer.js';

/** The `lyra-search-change` event detail shape, uniform across every search-capable viewer. */
export interface ViewerSearchChangeDetail {
  query: string;
  matchCount: number;
  activeIndex: number;
}

type LocalizeFn = (key: string, fallback?: string, values?: Record<string, string | number>) => string;

/**
 * Announces a search result identically across every search-capable viewer: "No matches" when the
 * count is zero, a singular/plural match-count phrase before any navigation has happened
 * (`activeIndex < 0`), or a "Match N of M" phrase once navigation has started. Always routes
 * through the caller's own `Announcer` instance (never creates one) so throttling stays scoped to
 * that viewer.
 */
export function announceSearchResult(
  localize: LocalizeFn,
  announcer: Announcer,
  matchCount: number,
  activeIndex: number,
): void {
  if (matchCount === 0) {
    announcer.announce(localize('viewerSearchNoMatches'));
    return;
  }
  if (activeIndex < 0) {
    announcer.announce(
      localize(matchCount === 1 ? 'viewerSearchMatchCount' : 'viewerSearchMatchCountPlural', undefined, {
        count: matchCount,
      }),
    );
    return;
  }
  announcer.announce(localize('viewerSearchActiveMatch', undefined, { current: activeIndex + 1, total: matchCount }));
}
