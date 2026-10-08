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

/** The query, match set, exactness flag and active index shared by every non-text viewer's search. */
export class ViewerSearchState<C extends { readonly length: number }> {
  query = '';
  matches: C;
  exact = true;
  activeIndex = -1;

  constructor(
    private readonly empty: () => C,
    private readonly emitDetail: (detail: LyraSearchChangeDetail) => void,
    private readonly changed: () => void = () => {},
  ) {
    this.matches = empty();
  }

  /** True once anything differs from a cleared search (source resets emit only then). */
  get dirty(): boolean {
    return this.query !== '' || this.matches.length > 0 || !this.exact || this.activeIndex !== -1;
  }

  emit(): void {
    this.emitDetail(viewerSearchDetail(this.query, this.matches.length, this.exact, this.activeIndex));
  }

  /** Stores a result (the first match becomes active) and emits; `exact=false` marks a lower bound. */
  publish(matches: C = this.empty(), exact = true): void {
    this.matches = matches;
    this.exact = exact;
    this.activeIndex = matches.length > 0 ? 0 : -1;
    this.changed();
    this.emit();
  }

  /** Clears the query and results without emitting. */
  reset(): void {
    this.query = '';
    this.matches = this.empty();
    this.exact = true;
    this.activeIndex = -1;
    this.changed();
  }

  clear(): void {
    this.reset();
    this.emit();
  }

  /** Moves the active match with wrap-around and emits; false when nothing matches. */
  step(direction: 1 | -1): boolean {
    if (!this.matches.length) return false;
    this.activeIndex = advanceViewerSearchIndex(this.activeIndex, this.matches.length, direction);
    this.changed();
    this.emit();
    return true;
  }
}
