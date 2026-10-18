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
  const needle = query.trim().toLocaleLowerCase(resolveIntlLocale(locale));
  return needle.length <= VIEWER_SEARCH_QUERY_LIMIT
    ? { needle, accepted: true }
    : { needle: '', accepted: false };
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

  /** Reports whether a complete field can be admitted without mutating the remaining budget. */
  canConsume(value: string): boolean {
    return this.remaining > 0 && Math.max(1, value.length) <= this.remaining;
  }

  /** Prepares one field under the same source/output budget as a search. Reuse the result only
   * for an unchanged source and locale; undefined means folding could not fit the budget. */
  prepare(value: string, locale: string): string | undefined {
    return this.foldJoined([value], locale);
  }

  /** Searches logical concatenation without first joining an attacker-sized string collection. */
  includesJoined(values: Iterable<string>, needle: string, locale: string): boolean {
    return this.foldJoined(values, locale)?.includes(needle) ?? false;
  }

  private foldJoined(values: Iterable<string>, locale: string): string | undefined {
    const chunks: string[] = [];
    const availableWork = this.remaining;
    let retainedCodeUnits = 0;
    let asciiOnly = true;
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
      const chunk = value.slice(0, retainedLength);
      chunks.push(chunk);
      retainedCodeUnits += retainedLength;
      if (asciiOnly && /[^\x00-\x7f]/u.test(chunk)) asciiOnly = false;
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
    // Locale lower-casing can expand source text (for example U+0130 becomes two code units in
    // English). Reserve output work before asking the engine to allocate the folded string. ASCII
    // is length-preserving; for non-ASCII input, four output code units per source code unit is a
    // conservative bound above the Unicode full-lowercase mappings implemented by supported
    // engines. Inputs that cannot fit both their source and possible folded output fail closed.
    const maximumFoldedCodeUnits = asciiOnly ? retainedCodeUnits : retainedCodeUnits * 4;
    if (retainedCodeUnits + maximumFoldedCodeUnits > availableWork) {
      this.remaining = 0;
      this.complete = false;
      return undefined;
    }
    const folded = chunks.join('').toLocaleLowerCase(resolveIntlLocale(locale));
    if (folded.length > this.remaining) {
      this.remaining = 0;
      this.complete = false;
      return undefined;
    }
    this.remaining -= folded.length;
    return folded;
  }

  get exhausted(): boolean {
    return this.remaining <= 0;
  }
}
