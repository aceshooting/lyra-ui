import { TEXT_QUOTE_LIMITS } from '../../internal/text-quote.js';
import { resolveIntlLocale } from '../../internal/intl-cache.js';

/** Resource ceilings for model-backed searches that cannot use a DOM `TextQuoteIndex` directly. */
export const VIEWER_SEARCH_QUERY_LIMIT = TEXT_QUOTE_LIMITS.maxQueryCodeUnits;
export const VIEWER_SEARCH_WORK_LIMIT = TEXT_QUOTE_LIMITS.maxSearchWorkCodeUnits;

export interface BoundedViewerSearchQuery {
  needle: string;
  accepted: boolean;
}

export function boundedViewerSearchQuery(
  query: string,
  locale: string,
): BoundedViewerSearchQuery {
  if (query.length > VIEWER_SEARCH_QUERY_LIMIT) return { needle: '', accepted: false };
  return { needle: query.trim().toLocaleLowerCase(resolveIntlLocale(locale)), accepted: true };
}

/** Charges at least one unit per model field so empty-cell/page collections remain bounded too. */
export class ViewerSearchWorkBudget {
  private remaining: number;
  complete = true;

  constructor(maxWork = VIEWER_SEARCH_WORK_LIMIT) {
    this.remaining = Number.isFinite(maxWork)
      ? Math.min(VIEWER_SEARCH_WORK_LIMIT, Math.max(0, Math.floor(maxWork)))
      : VIEWER_SEARCH_WORK_LIMIT;
  }

  includes(value: string, needle: string, locale: string): boolean {
    return this.includesJoined([value], needle, locale);
  }

  /** Charges a validation-only field without copying or locale-folding its contents. */
  consume(value: string): boolean {
    if (this.remaining <= 0) {
      this.complete = false;
      return false;
    }
    const cost = Math.max(1, value.length);
    if (cost > this.remaining) {
      this.remaining = 0;
      this.complete = false;
      return false;
    }
    this.remaining -= cost;
    return true;
  }

  /** Searches logical concatenation without first joining an attacker-sized string collection. */
  includesJoined(values: Iterable<string>, needle: string, locale: string): boolean {
    const chunks: string[] = [];
    let inspectedAny = false;
    for (const value of values) {
      inspectedAny = true;
      if (this.remaining <= 0) {
        this.complete = false;
        break;
      }
      if (value.length === 0) {
        this.remaining--;
        continue;
      }
      const retainedLength = Math.min(value.length, this.remaining);
      chunks.push(value.slice(0, retainedLength));
      this.remaining -= retainedLength;
      if (retainedLength !== value.length) {
        this.complete = false;
        break;
      }
    }
    if (!inspectedAny) {
      if (this.remaining <= 0) this.complete = false;
      else this.remaining--;
    }
    return chunks.join('').toLocaleLowerCase(resolveIntlLocale(locale)).includes(needle);
  }

  get exhausted(): boolean {
    return this.remaining <= 0;
  }
}
