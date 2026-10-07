import type { Announcer } from './announcer.js';
import { getNumberFormat } from './intl-cache.js';
import type { LyraSearchChangeDetail } from './text-viewer-target.js';

type LocalizeFn = (key: string, fallback?: string, values?: Record<string, string | number>) => string;

/** Announces the count or active position through the caller's own throttled announcer. */
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
    announcer.announce(localize('viewerSearchMatchCount', undefined, {
      count: numberFormat.format(matchCount),
      pluralCount: matchCount,
    }));
    return;
  }
  announcer.announce(localize('viewerSearchActiveMatch', undefined, {
    current: numberFormat.format(activeIndex + 1),
    total: numberFormat.format(matchCount),
  }));
}

export function viewerSearchDetail(
  query: string,
  matchCount: number,
  matchCountExact: boolean,
  activeIndex: number,
): LyraSearchChangeDetail {
  return { query, matchCount, matchCountExact, activeIndex };
}

export function advanceViewerSearchIndex(activeIndex: number, matchCount: number, direction: 1 | -1): number {
  return matchCount > 0 ? (activeIndex + direction + matchCount) % matchCount : -1;
}

export function sameViewerSearchDetail(first: LyraSearchChangeDetail, second: LyraSearchChangeDetail): boolean {
  return first.query === second.query
    && first.matchCount === second.matchCount
    && first.matchCountExact === second.matchCountExact
    && first.activeIndex === second.activeIndex;
}
