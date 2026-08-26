import type { Announcer } from './announcer.js';
import { getNumberFormat } from './intl-cache.js';

type LocalizeFn = (key: string, fallback?: string, values?: Record<string, string | number>) => string;

/**
 * Announces a search result for viewers adopting this helper: "No matches" when the count is zero,
 * a singular/plural match-count phrase before any navigation has happened (`activeIndex < 0`), or
 * a "Match N of M" phrase once navigation has started. Interpolated numbers use the viewer's
 * effective locale while raw `pluralCount` selects the CLDR category. Always routes through the
 * caller's own `Announcer` instance (never creates one) so throttling stays scoped to that viewer.
 */
export function announceSearchResult(
  localize: LocalizeFn,
  announcer: Announcer,
  effectiveLocale: string,
  matchCount: number,
  activeIndex: number,
): void {
  if (matchCount === 0) {
    announcer.announce(localize('viewerSearchNoMatches'));
    return;
  }
  const numberFormat = getNumberFormat(effectiveLocale);
  if (activeIndex < 0) {
    announcer.announce(
      localize('viewerSearchMatchCount', undefined, {
        count: numberFormat.format(matchCount),
        pluralCount: matchCount,
      }),
    );
    return;
  }
  announcer.announce(localize('viewerSearchActiveMatch', undefined, {
    current: numberFormat.format(activeIndex + 1),
    total: numberFormat.format(matchCount),
  }));
}
