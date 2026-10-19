/**
 * Shared memoized `Intl` formatter factories. Constructing an
 * `Intl.NumberFormat` / `Intl.DateTimeFormat` / `Intl.DisplayNames` / `Intl.ListFormat` /
 * `Intl.RelativeTimeFormat` / `Intl.PluralRules` / `Intl.Collator` / `Intl.Segmenter` performs an ICU locale-data
 * lookup that is orders of magnitude slower than reusing an existing
 * instance, and per-row template loops (table cells, chart points, feed
 * entries) would otherwise pay that cost once per row on every render pass.
 * Primitive option values share one instance per locale + options pair across components on the
 * page. Ordinary option bags are read into a bounded snapshot, including hidden and inherited
 * values. Accessor and custom-prototype bags pass directly to Intl. Proxy-backed data options
 * are supported by value; arbitrary proxy trap ordering is not part of the cache contract.
 *
 * Each kind keeps at most {@link MAX_ENTRIES_PER_KIND} entries, evicting the
 * least recently used beyond that, so pages that churn through many locales
 * or option shapes cannot grow the caches without bound.
 */

const MAX_ENTRIES_PER_KIND = 64;

const numberFormatCache = new Map<string, Intl.NumberFormat>();
const dateTimeFormatCache = new Map<string, Intl.DateTimeFormat>();
const displayNamesCache = new Map<string, Intl.DisplayNames>();
const listFormatCache = new Map<string, Intl.ListFormat>();
const relativeTimeFormatCache = new Map<string, Intl.RelativeTimeFormat>();
const pluralRulesCache = new Map<string, Intl.PluralRules>();
const collatorCache = new Map<string, Intl.Collator>();
const segmenterCache = new Map<string, Intl.Segmenter>();
const resolvedLocaleCache = new Map<string, string>();

/**
 * Converts an author-supplied locale into the canonical, structurally valid tag used at every
 * `Intl` boundary. Message lookup deliberately does not use this function: synthetic catalog
 * keys such as `x-test` must remain addressable even though ECMA-402 formatters reject them.
 *
 * Browsers and translation tools sometimes produce underscore tags (`en_US`) or the sentinel
 * `auto`; arbitrary `lang`/`locale` attributes can also be malformed. Underscores are normalized
 * before validation, while an empty, sentinel, synthetic, or malformed tag falls back to English
 * instead of turning an ordinary component render into a `RangeError`.
 */
export function resolveIntlLocale(locale: string | undefined): string {
  const raw = locale?.trim() ?? '';
  const cached = resolvedLocaleCache.get(raw);
  if (cached !== undefined) return cached;

  const normalized = raw.replaceAll('_', '-');
  let resolved = 'en';
  if (normalized && normalized.toLowerCase() !== 'auto') {
    try {
      resolved = Intl.getCanonicalLocales(normalized)[0] ?? 'en';
    } catch {
      // Author-supplied locale values are not trusted formatter input.
    }
  }

  if (resolvedLocaleCache.size >= MAX_ENTRIES_PER_KIND) resolvedLocaleCache.clear();
  resolvedLocaleCache.set(raw, resolved);
  return resolved;
}

/**
 * Builds a stable cache key: `Intl` options bags are flat objects, so
 * serializing with a sorted key list makes `{ a, b }` and `{ b, a }` collide
 * on the same entry regardless of property insertion order. An `undefined`
 * locale is already canonicalized by {@link resolveIntlLocale}, so equivalent spellings share a
 * cache entry and malformed author input can never reach a formatter constructor.
 */
function cacheKey(locale: string, options?: object): string {
  const localeKey = locale;
  if (!options) return localeKey;
  return `${localeKey}\u0000${JSON.stringify(options, Object.keys(options).sort())}`;
}

/**
 * Map iteration order is insertion order, so refreshing an entry on every hit
 * (delete + re-set) keeps the first key the least recently used one — that is
 * the entry evicted when the cache is full.
 */
function getCached<T>(cache: Map<string, T>, key: string, create: () => T): T {
  const existing = cache.get(key);
  if (existing !== undefined) {
    cache.delete(key);
    cache.set(key, existing);
    return existing;
  }
  if (cache.size >= MAX_ENTRIES_PER_KIND) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  const created = create();
  cache.set(key, created);
  return created;
}

/** Per formatter kind: the previous lookup's `[locale, key, value, ...]` entries and its result. */
const lastLookups = new Map<object, [readonly unknown[], unknown]>();

// Keep each family's full option vocabulary: native constructors read supported option names,
// including inherited/non-enumerable properties, rather than enumerating the supplied object.
const numberOptions = [
  'localeMatcher', 'numberingSystem', 'style', 'currency', 'currencyDisplay', 'currencySign',
  'unit', 'unitDisplay', 'notation', 'minimumIntegerDigits', 'minimumFractionDigits',
  'maximumFractionDigits', 'minimumSignificantDigits', 'maximumSignificantDigits',
  'roundingIncrement', 'roundingMode', 'roundingPriority', 'trailingZeroDisplay', 'compactDisplay',
  'useGrouping', 'signDisplay',
] as const;
const dateOptions = [
  'localeMatcher', 'calendar', 'numberingSystem', 'hour12', 'hourCycle', 'timeZone', 'weekday',
  'era', 'year', 'month', 'day', 'dayPeriod', 'hour', 'minute', 'second', 'fractionalSecondDigits',
  'timeZoneName', 'formatMatcher', 'dateStyle', 'timeStyle',
] as const;
const pluralOptions = [
  'localeMatcher', 'type', 'notation', 'compactDisplay', 'minimumIntegerDigits',
  'minimumFractionDigits', 'maximumFractionDigits', 'minimumSignificantDigits',
  'maximumSignificantDigits', 'roundingIncrement', 'roundingMode', 'roundingPriority',
  'trailingZeroDisplay',
] as const;
const collatorOptions = [
  'usage', 'localeMatcher', 'collation', 'numeric', 'caseFirst', 'sensitivity', 'ignorePunctuation',
] as const;
const displayNamesOptions = ['localeMatcher', 'style', 'type', 'fallback', 'languageDisplay'] as const;
const listOptions = ['localeMatcher', 'type', 'style'] as const;
const relativeOptions = ['localeMatcher', 'numberingSystem', 'style', 'numeric'] as const;
const segmenterOptions = ['localeMatcher', 'granularity'] as const;

interface CapturedFormatterOptions {
  readonly options: object | undefined;
  readonly entries?: readonly unknown[];
}

function isCacheableOptionValue(value: unknown): boolean {
  return value === null || value === undefined ||
    typeof value === 'string' || typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value));
}

/** Capture values once so both the key and constructor see the same options. Descriptor checks
 * only choose the native accessor path; descriptors are never a substitute for property reads,
 * since a proxy may expose a different value. Coercible values are handed to Intl without caching. */
function captureFormatterOptions(
  locale: string,
  options: object | undefined,
  keys: readonly string[],
): CapturedFormatterOptions {
  const entries: unknown[] = [locale];
  if (options === undefined) return { options, entries };
  if (options === null || typeof options !== 'object') return { options };
  try {
    const prototype = Object.getPrototypeOf(options);
    if (prototype !== null && prototype !== Object.prototype) return { options };
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(options, key) ??
        (prototype === null ? undefined : Object.getOwnPropertyDescriptor(prototype, key));
      if (descriptor && (!Object.hasOwn(descriptor, 'value') ||
        !isCacheableOptionValue(descriptor.value))) return { options };
    }
  } catch {
    // A proxy may reject reflection while still allowing the constructor's ordinary reads.
    return { options };
  }
  const captured = Object.create(null) as Record<string, unknown>;
  let cacheable = true;
  for (const key of keys) {
    const value: unknown = Reflect.get(options, key);
    if (value === undefined) continue;
    captured[key] = value;
    if (!isCacheableOptionValue(value)) cacheable = false;
    entries.push(key, value);
  }
  return { options: captured, entries: cacheable ? entries : undefined };
}

function getFormatter<T>(
  locale: string | undefined,
  options: object | undefined,
  cache: Map<string, T>,
  keys: readonly string[],
  create: (safeLocale: string, capturedOptions: object | undefined) => T,
): T {
  const safeLocale = resolveIntlLocale(locale);
  // Per-row template loops repeat one lookup with a fresh but equal options literal. Comparing
  // its entries with the previous lookup's (by content, so a reused options object mutated in
  // between is still re-resolved) skips the sorted serialization and the LRU refresh; that entry
  // is already the most recently used one of its kind.
  const captured = captureFormatterOptions(safeLocale, options, keys);
  const entries = captured.entries;
  if (!entries) return create(safeLocale, captured.options);
  const last = lastLookups.get(cache);
  if (
    last &&
    last[0].length === entries.length &&
    last[0].every((entry, index) => Object.is(entry, entries[index]))
  ) {
    return last[1] as T;
  }
  const value = getCached(cache, cacheKey(safeLocale, captured.options), () => create(safeLocale, captured.options));
  lastLookups.set(cache, [entries, value]);
  return value;
}

/**
 * A shared `Intl.NumberFormat` for the given locale and options. `undefined` and malformed input
 * safely select the library's deterministic English fallback.
 */
export function getNumberFormat(locale: string | undefined, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  return getFormatter(
    locale,
    options,
    numberFormatCache,
    numberOptions,
    (safeLocale, captured) => new Intl.NumberFormat(safeLocale, captured),
  );
}

/**
 * A fresh `Intl.NumberFormat` that bypasses the shared cache, through the same safe locale and
 * option boundary. For callers that memoize what they derive: a catalog resolving one formatter
 * per entry would otherwise evict every other component's shared formatter.
 */
export function createNumberFormat(locale: string | undefined, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const safeLocale = resolveIntlLocale(locale);
  return new Intl.NumberFormat(safeLocale, captureFormatterOptions(safeLocale, options, numberOptions).options);
}

/** A shared `Intl.DateTimeFormat` for the given locale and options. */
export function getDateTimeFormat(locale: string | undefined, options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return getFormatter(
    locale,
    options,
    dateTimeFormatCache,
    dateOptions,
    (safeLocale, captured) => new Intl.DateTimeFormat(safeLocale, captured),
  );
}

/** Formats a locale-aware hour/minute clock time with the shared date-time formatter cache. */
export function formatTimeOfDay(date: Date, locale: string): string {
  return getDateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(date);
}

/**
 * A shared `Intl.DisplayNames` for the given locale and options. Note the
 * `Intl.DisplayNames` constructor itself requires `options.type`, so omitting
 * the options throws the same `TypeError` a direct construction would.
 */
export function getDisplayNames(locale: string, options?: Intl.DisplayNamesOptions): Intl.DisplayNames {
  return getFormatter(
    locale,
    options,
    displayNamesCache,
    displayNamesOptions,
    (safeLocale, captured) => new Intl.DisplayNames([safeLocale], captured as Intl.DisplayNamesOptions),
  );
}

/** A shared `Intl.ListFormat` for the given locale and options. */
export function getListFormat(locale: string | undefined, options?: Intl.ListFormatOptions): Intl.ListFormat {
  return getFormatter(
    locale,
    options,
    listFormatCache,
    listOptions,
    (safeLocale, captured) => new Intl.ListFormat(safeLocale, captured),
  );
}

/** A shared `Intl.RelativeTimeFormat` for the given locale and options. */
export function getRelativeTimeFormat(
  locale: string | undefined,
  options?: Intl.RelativeTimeFormatOptions,
): Intl.RelativeTimeFormat {
  return getFormatter(
    locale,
    options,
    relativeTimeFormatCache,
    relativeOptions,
    (safeLocale, captured) => new Intl.RelativeTimeFormat(safeLocale, captured),
  );
}

/** A shared `Intl.PluralRules` instance for the given locale and options. */
export function getPluralRules(locale: string | undefined, options?: Intl.PluralRulesOptions): Intl.PluralRules {
  return getFormatter(
    locale,
    options,
    pluralRulesCache,
    pluralOptions,
    (safeLocale, captured) => new Intl.PluralRules(safeLocale, captured),
  );
}

/** A shared `Intl.Collator` instance for the given locale and options. */
export function getCollator(locale: string | undefined, options?: Intl.CollatorOptions): Intl.Collator {
  return getFormatter(
    locale,
    options,
    collatorCache,
    collatorOptions,
    (safeLocale, captured) => new Intl.Collator(safeLocale, captured),
  );
}

/** A shared `Intl.Segmenter` instance for the given locale and options. */
export function getSegmenter(locale: string | undefined, options?: Intl.SegmenterOptions): Intl.Segmenter {
  return getFormatter(
    locale,
    options,
    segmenterCache,
    segmenterOptions,
    (safeLocale, captured) => new Intl.Segmenter(safeLocale, captured),
  );
}
