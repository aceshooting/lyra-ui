// The occurrence index: case folding, query scanning and the per-content match cache. Kept apart
// from the scope and anchor builders so a view can build selection anchors without loading search.
import { resolveIntlLocale } from './intl-cache.js';
import {
  incrementalScopeChanges,
  mapExpandedOffset,
  rangeFromOffsets,
  resolvedLimits,
  segmenterFor,
  type TextOffsetMapping,
  type TextQuoteMatch,
  type TextQuoteMatches,
  type TextQuoteScope,
} from './text-quote.js';
import { TEXT_QUOTE_LIMITS, WHITESPACE_CHAR_RE, normalizeQuoteText, type TextQuoteLimits } from './text-selection.js';

/** Occurrence offsets one index may retain across all cached queries (a few full match lists). */
const MAX_CACHED_MATCHES = 4 * TEXT_QUOTE_LIMITS.maxMatches;


type FoldedText = TextOffsetMapping;

function caseFold(value: string, locale?: string): string {
  let lowered: string;
  if (!locale) {
    lowered = value.toLowerCase();
  } else {
    lowered = value.toLocaleLowerCase(resolveIntlLocale(locale));
  }
  // Locale lower-casing preserves an already-lowercase final sigma (`ς`) while a standalone
  // uppercase/medial sigma query becomes `σ`. Unicode caseless matching treats both as equivalent.
  return lowered.replaceAll('ς', 'σ');
}

interface CaseMappingSegment {
  text: string;
  rawStart: number;
  rawEnd: number;
}

function* caseMappingSegments(value: string, locale?: string): Generator<CaseMappingSegment> {
  if (typeof Intl.Segmenter === 'function') {
    for (const { segment, index } of segmenterFor(locale).segment(value)) {
      yield {
        text: segment,
        rawStart: index,
        rawEnd: index + segment.length,
      };
    }
    return;
  }

  let rawStart = 0;
  for (const text of value) {
    yield { text, rawStart, rawEnd: rawStart + text.length };
    rawStart += text.length;
  }
}

/** Locale-folds the complete string so contextual Unicode casing is preserved, while retaining a
 * sparse map only for graphemes whose UTF-16 length expands or contracts. Same-length documents
 * need no Segmenter and no per-character offset arrays; the sparse expansion map keeps values such
 * as English `İ` and Lithuanian accent-sensitive `I` aligned with DOM offsets. */
function foldText(value: string, locale?: string): FoldedText {
  const text = caseFold(value, locale);
  if (text.length === value.length) return { text, expansions: new Uint32Array() };

  let expansions = new Uint32Array(Math.min(64, Math.max(1, value.length)) * 4);
  let expansionCount = 0;
  const appendExpansion = (
    rawStart: number,
    rawEnd: number,
    foldedStart: number,
    foldedEnd: number,
  ): void => {
    if (expansionCount * 4 === expansions.length) {
      const nextCapacity = Math.min(value.length, Math.max(1, (expansions.length >> 2) * 2));
      const next = new Uint32Array(nextCapacity * 4);
      next.set(expansions);
      expansions = next;
    }
    const offset = expansionCount * 4;
    expansions[offset] = rawStart;
    expansions[offset + 1] = rawEnd;
    expansions[offset + 2] = foldedStart;
    expansions[offset + 3] = foldedEnd;
    expansionCount++;
  };
  let foldedStart = 0;
  for (const segment of caseMappingSegments(value, locale)) {
    // Length-changing special casing is grapheme-local. Contextual casing such as Greek final
    // sigma changes code points but not UTF-16 length, so it does not need an offset entry.
    const isolatedLength = caseFold(segment.text, locale).length;
    const foldedEnd = segment.rawEnd === value.length
      ? text.length
      : Math.min(text.length, foldedStart + isolatedLength);
    if (foldedEnd - foldedStart !== segment.rawEnd - segment.rawStart) {
      appendExpansion(segment.rawStart, segment.rawEnd, foldedStart, foldedEnd);
    }
    foldedStart = foldedEnd;
  }
  return { text, expansions: expansions.slice(0, expansionCount * 4) };
}

class PackedTextQuoteMatches implements TextQuoteMatches {
  constructor(
    readonly packedOffsets: Uint32Array,
    readonly matchCountExact: boolean,
    readonly scanComplete: boolean,
  ) {}

  get length(): number {
    return this.packedOffsets.length >> 1;
  }

  at(index: number): TextQuoteMatch | undefined {
    if (!Number.isInteger(index) || index < 0 || index >= this.length) return undefined;
    return {
      start: this.packedOffsets[index * 2]!,
      end: this.packedOffsets[index * 2 + 1]!,
    };
  }

  *[Symbol.iterator](): Iterator<TextQuoteMatch> {
    for (let index = 0; index < this.length; index++) yield this.at(index)!;
  }
}

function emptyMatches(matchCountExact: boolean, scanComplete = matchCountExact): TextQuoteMatches {
  return new PackedTextQuoteMatches(new Uint32Array(), matchCountExact, scanComplete);
}

/** An exact, allocation-light empty occurrence collection for viewer state initialization/reset. */
export function emptyTextQuoteMatches(): TextQuoteMatches {
  return emptyMatches(true, true);
}

function scanOccurrences(
  haystack: string,
  needle: string,
  foldedHaystack: FoldedText | undefined,
  maxMatches: number,
  scopeTruncated: boolean,
  startAt = 0,
): TextQuoteMatches {
  // Grown geometrically: most quotes occur a handful of times, and a zero-filled ceiling-sized
  // buffer per uncached scan cost 80 KB each.
  let packed = new Uint32Array(Math.min(maxMatches, 32) * 2);
  let count = 0;
  let scanComplete = true;
  let from = startAt;
  for (;;) {
    const index = haystack.indexOf(needle, from);
    if (index === -1) break;
    if (count >= maxMatches) {
      scanComplete = false;
      break;
    }
    if (count * 2 === packed.length) {
      const grown = new Uint32Array(Math.min(maxMatches, count * 2) * 2);
      grown.set(packed);
      packed = grown;
    }
    if (foldedHaystack) {
      packed[count * 2] = mapExpandedOffset(foldedHaystack, index, true, false);
      packed[count * 2 + 1] = mapExpandedOffset(foldedHaystack, index + needle.length, true, true);
    } else {
      packed[count * 2] = index;
      packed[count * 2 + 1] = index + needle.length;
    }
    count++;
    from = index + 1;
  }
  return new PackedTextQuoteMatches(
    packed.slice(0, count * 2),
    scanComplete && !scopeTruncated,
    scanComplete,
  );
}

export interface TextQuoteWorkBudget {
  remainingCodeUnits: number;
}

/** Reusable per-content/per-locale occurrence index. Cached queries allocate packed offsets; a
 * caller supplies a fresh work budget for each logical operation so one paint pass cannot turn
 * N distinct highlights into N full-corpus scans. */
export class TextQuoteIndex {
  private readonly limits: TextQuoteLimits;
  private readonly occurrenceCache = new Map<string, TextQuoteMatches>();
  private cachedMatchCount = 0;
  private foldedScope?: FoldedText;
  private _scanCount = 0;
  scannedCodeUnits = 0;
  private _scope: TextQuoteScope;

  constructor(
    scope: TextQuoteScope,
    readonly locale?: string,
    limitOverrides?: Partial<TextQuoteLimits>,
  ) {
    this._scope = scope;
    this.limits = resolvedLimits(limitOverrides);
  }

  get scope(): TextQuoteScope {
    return this._scope;
  }

  /** Rebinds offset-to-node materialization after a structurally different but semantically
   * identical DOM paint, preserving the folded corpus and occurrence cache. */
  rebindScope(scope: TextQuoteScope): boolean {
    if (scope.text === this._scope.text && scope.truncated === this._scope.truncated) { this._scope = scope; return true; }
    const change = incrementalScopeChanges.get(scope);
    const previous = incrementalScopeChanges.get(this._scope);
    if (!change || change.owner !== previous?.owner || change.stableEnd === 0) return false;
    const stableEnd = Math.min(change.stableEnd, previous!.settledEnd);
    const budget = this.createWorkBudget();
    let foldedEnd = 0;
    if (this.foldedScope) {
      foldedEnd = mapExpandedOffset(this.foldedScope, stableEnd, false, false);
      const suffix = foldText(scope.text.slice(stableEnd), this.locale);
      const expansions = Array.isArray(this.foldedScope.expansions) ? this.foldedScope.expansions : Array.from(this.foldedScope.expansions);
      while (expansions.length && expansions[expansions.length - 4]! >= stableEnd) expansions.length -= 4;
      for (let i = 0; i < suffix.expansions.length; i += 4) expansions.push(
        suffix.expansions[i]! + stableEnd, suffix.expansions[i + 1]! + stableEnd,
        suffix.expansions[i + 2]! + foldedEnd, suffix.expansions[i + 3]! + foldedEnd);
      this.foldedScope = { text: this.foldedScope.text.slice(0, foldedEnd) + suffix.text, expansions };
    }
    this._scope = scope;
    this.cachedMatchCount = 0;
    for (const [key, cached] of this.occurrenceCache) {
      const insensitive = key.startsWith('i:');
      const needle = key.slice(2);
      const folded = insensitive ? this.foldedScope : undefined;
      const haystack = folded?.text ?? scope.text;
      let from = Math.max(0, (insensitive ? foldedEnd : stableEnd) - needle.length + 1);
      if (folded) from = mapExpandedOffset(folded, mapExpandedOffset(folded, from, true, false), false, false);
      if (!cached.scanComplete || !this.consumeWork(budget, haystack.length - from)) { this.occurrenceCache.delete(key); continue; }
      const rawFrom = folded ? mapExpandedOffset(folded, from, true, false) : from;
      let retained = 0, upper = cached.length;
      while (retained < upper) {
        const middle = (retained + upper) >>> 1;
        if (cached.at(middle)!.start < rawFrom) retained = middle + 1; else upper = middle;
      }
      this.scannedCodeUnits += haystack.length - from;
      const suffix = scanOccurrences(haystack, needle, folded, this.limits.maxMatches - retained, scope.truncated, from);
      if (retained === cached.length && suffix.length === 0 && cached.matchCountExact === suffix.matchCountExact) {
        this.cachedMatchCount += cached.length; continue;
      }
      const packed = new Uint32Array((retained + suffix.length) * 2);
      let count = 0;
      for (let i = 0; i < retained; i++) { const match = cached.at(i)!; packed[count++] = match.start; packed[count++] = match.end; }
      for (const match of suffix) { packed[count++] = match.start; packed[count++] = match.end; }
      const merged = new PackedTextQuoteMatches(packed, suffix.matchCountExact, suffix.scanComplete);
      if (this.cachedMatchCount + merged.length > MAX_CACHED_MATCHES) { this.occurrenceCache.delete(key); continue; }
      this.occurrenceCache.set(key, merged); this.cachedMatchCount += merged.length;
    }
    return true;
  }

  get scanCount(): number {
    return this._scanCount;
  }

  createWorkBudget(maxCodeUnits = this.limits.maxSearchWorkCodeUnits): TextQuoteWorkBudget {
    const bounded = Number.isFinite(maxCodeUnits)
      ? Math.min(this.limits.maxSearchWorkCodeUnits, Math.max(0, Math.floor(maxCodeUnits)))
      : this.limits.maxSearchWorkCodeUnits;
    return { remainingCodeUnits: bounded };
  }

  private consumeWork(budget: TextQuoteWorkBudget, amount: number): boolean {
    if (!Number.isFinite(budget.remainingCodeUnits) || budget.remainingCodeUnits < amount) return false;
    budget.remainingCodeUnits -= amount;
    return true;
  }

  /** `undefined` for absent optional text (JSON carries it as `null` as often as omitted), `null`
   * for an unusable value: not a string, or beyond the query ceiling. */
  private boundedQuery(value: unknown): string | null | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string' || value.length > this.limits.maxQueryCodeUnits) return null;
    const normalized = normalizeQuoteText(value);
    return normalized.length <= this.limits.maxQueryCodeUnits ? normalized : null;
  }

  private foldedFor(budget: TextQuoteWorkBudget): FoldedText | null {
    if (this.foldedScope) return this.foldedScope;
    if (!this.consumeWork(budget, this.scope.text.length)) return null;
    this.foldedScope = foldText(this.scope.text, this.locale);
    return this.foldedScope;
  }

  /** Least-recently-used: `occurrences()` re-inserts every hit, so iteration order is recency. */
  private cache(key: string, matches: TextQuoteMatches): void {
    if (this.limits.maxCacheEntries === 0) return;
    for (const [oldestKey, oldest] of this.occurrenceCache) {
      if (
        this.occurrenceCache.size < this.limits.maxCacheEntries &&
        this.cachedMatchCount + matches.length <= MAX_CACHED_MATCHES
      ) {
        break;
      }
      this.occurrenceCache.delete(oldestKey);
      this.cachedMatchCount -= oldest.length;
    }
    this.occurrenceCache.set(key, matches);
    this.cachedMatchCount += matches.length;
  }

  private occurrences(
    needle: string,
    caseInsensitive: boolean,
    budget: TextQuoteWorkBudget,
  ): TextQuoteMatches {
    const searchableNeedle = caseInsensitive ? caseFold(needle, this.locale) : needle;
    if (searchableNeedle.length > this.limits.maxQueryCodeUnits) {
      return emptyMatches(false, false);
    }
    const folded = caseInsensitive ? this.foldedFor(budget) ?? undefined : undefined;
    if (caseInsensitive && !folded) return emptyMatches(false, false);
    const haystack = folded?.text ?? this.scope.text;
    const key = `${caseInsensitive ? 'i' : 's'}:${searchableNeedle}`;
    const cached = this.occurrenceCache.get(key);
    if (cached) {
      this.occurrenceCache.delete(key);
      this.occurrenceCache.set(key, cached);
      return cached;
    }
    if (searchableNeedle.length === 0) return emptyMatches(!this.scope.truncated, true);
    if (searchableNeedle.length > haystack.length) {
      const result = emptyMatches(!this.scope.truncated, true);
      this.cache(key, result);
      return result;
    }
    if (!this.consumeWork(budget, haystack.length)) return emptyMatches(false, false);
    this._scanCount++;
    this.scannedCodeUnits += haystack.length;
    const result = scanOccurrences(
      haystack,
      searchableNeedle,
      folded,
      this.limits.maxMatches,
      this.scope.truncated,
    );
    this.cache(key, result);
    return result;
  }

  search(query: string, budget = this.createWorkBudget()): TextQuoteMatches {
    const needle = this.boundedQuery(query);
    if (needle === null) return emptyMatches(false, false);
    if (!needle) return emptyMatches(true, true);
    return this.occurrences(needle, true, budget);
  }

  resolve(
    anchor: { quote: string; prefix?: string; suffix?: string },
    budget = this.createWorkBudget(),
  ): TextQuoteMatch | null {
    // Anchors are caller data (often deserialized JSON, sometimes accessor-backed): one malformed
    // anchor resolves to nothing rather than throwing out of a whole highlight paint pass.
    let fields: unknown[];
    try {
      fields = [anchor.quote, anchor.prefix, anchor.suffix];
    } catch {
      return null;
    }
    const quote = this.boundedQuery(fields[0]);
    const prefix = this.boundedQuery(fields[1]);
    const suffix = this.boundedQuery(fields[2]);
    if (!quote || prefix === null || suffix === null) return null;

    let candidates = this.occurrences(quote, false, budget);
    if (candidates.length === 0 && candidates.scanComplete) {
      candidates = this.occurrences(quote, true, budget);
    }
    const first = candidates.at(0);
    if (!first || (!prefix && !suffix)) return first ?? null;
    // Context is a disambiguator, not a best-effort hint. Returning an admitted prefix candidate
    // when a resource ceiling omitted a later one can silently resolve to the wrong passage.
    if (!candidates.matchCountExact) return null;

    const foldedScope = this.foldedFor(budget);
    if (!foldedScope) return null;
    const foldedPrefix = prefix ? caseFold(prefix, this.locale) : undefined;
    const foldedSuffix = suffix ? caseFold(suffix, this.locale) : undefined;
    let best = first;
    let bestScore = -1;
    for (const candidate of candidates) {
      const contextWork = (foldedPrefix?.length ?? 0) + (foldedSuffix?.length ?? 0);
      if (!this.consumeWork(budget, contextWork)) return null;
      let score = 0;
      const foldedStart = mapExpandedOffset(foldedScope, candidate.start, false, false);
      const foldedEnd = mapExpandedOffset(foldedScope, candidate.end, false, true);
      if (foldedPrefix) {
        let beforeEnd = foldedStart;
        while (beforeEnd > 0 && WHITESPACE_CHAR_RE.test(foldedScope.text[beforeEnd - 1]!)) {
          if (!this.consumeWork(budget, 1)) return null;
          beforeEnd--;
        }
        if (foldedScope.text.endsWith(foldedPrefix, beforeEnd)) score++;
      }
      if (foldedSuffix) {
        let afterStart = foldedEnd;
        while (afterStart < foldedScope.text.length && WHITESPACE_CHAR_RE.test(foldedScope.text[afterStart]!)) {
          if (!this.consumeWork(budget, 1)) return null;
          afterStart++;
        }
        if (foldedScope.text.startsWith(foldedSuffix, afterStart)) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    return best;
  }
}

export function createTextQuoteIndex(
  scope: TextQuoteScope,
  locale?: string,
  limitOverrides?: Partial<TextQuoteLimits>,
): TextQuoteIndex {
  return new TextQuoteIndex(scope, locale, limitOverrides);
}

/** Resolves within the bounded scope/index. Quotes after a truncated corpus prefix or beyond an
 * occurrence/work ceiling are intentionally unresolved rather than allocating without limit. */
export function resolveTextQuote(
  scope: TextQuoteScope,
  anchor: { quote: string; prefix?: string; suffix?: string },
  locale?: string,
): Range | null {
  const match = createTextQuoteIndex(scope, locale).resolve(anchor);
  return match ? rangeFromOffsets(scope, match.start, match.end) : null;
}

/** Every retained occurrence of `query` in `scope`, packed as offsets. `matchCountExact=false`
 * makes corpus/match/query/work truncation explicit to search-event callers. */
export function findTextQuoteMatches(
  scope: TextQuoteScope,
  query: string,
  locale?: string,
  limitOverrides?: Partial<TextQuoteLimits>,
): TextQuoteMatches {
  return createTextQuoteIndex(scope, locale, limitOverrides).search(query);
}

