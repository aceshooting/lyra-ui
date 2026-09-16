/**
 * Shared memoized `Intl` formatter factories. Constructing an
 * `Intl.NumberFormat` / `Intl.DateTimeFormat` / `Intl.DisplayNames` / `Intl.ListFormat` /
 * `Intl.RelativeTimeFormat` / `Intl.PluralRules` / `Intl.Collator` / `Intl.Segmenter` performs an ICU locale-data
 * lookup that is orders of magnitude slower than reusing an existing
 * instance, and per-row template loops (table cells, chart points, feed
 * entries) would otherwise pay that cost once per row on every render pass.
 * One instance per locale + options pair is shared across all components on
 * the page.
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

function getFormatter<T>(
  locale: string | undefined,
  options: object | undefined,
  cache: Map<string, T>,
  create: (safeLocale: string) => T,
): T {
  const safeLocale = resolveIntlLocale(locale);
  return getCached(cache, cacheKey(safeLocale, options), () => create(safeLocale));
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
    (safeLocale) => new Intl.NumberFormat(safeLocale, options),
  );
}

/** A shared `Intl.DateTimeFormat` for the given locale and options. */
export function getDateTimeFormat(locale: string | undefined, options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return getFormatter(
    locale,
    options,
    dateTimeFormatCache,
    (safeLocale) => new Intl.DateTimeFormat(safeLocale, options),
  );
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
    (safeLocale) => new Intl.DisplayNames([safeLocale], options as Intl.DisplayNamesOptions),
  );
}

/** A shared `Intl.ListFormat` for the given locale and options. */
export function getListFormat(locale: string | undefined, options?: Intl.ListFormatOptions): Intl.ListFormat {
  return getFormatter(
    locale,
    options,
    listFormatCache,
    (safeLocale) => new Intl.ListFormat(safeLocale, options),
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
    (safeLocale) => new Intl.RelativeTimeFormat(safeLocale, options),
  );
}

/** A shared `Intl.PluralRules` instance for the given locale and options. */
export function getPluralRules(locale: string | undefined, options?: Intl.PluralRulesOptions): Intl.PluralRules {
  return getFormatter(
    locale,
    options,
    pluralRulesCache,
    (safeLocale) => new Intl.PluralRules(safeLocale, options),
  );
}

/** A shared `Intl.Collator` instance for the given locale and options. */
export function getCollator(locale: string | undefined, options?: Intl.CollatorOptions): Intl.Collator {
  return getFormatter(
    locale,
    options,
    collatorCache,
    (safeLocale) => new Intl.Collator(safeLocale, options),
  );
}

/** A shared `Intl.Segmenter` instance for the given locale and options. */
export function getSegmenter(locale: string | undefined, options?: Intl.SegmenterOptions): Intl.Segmenter {
  return getFormatter(
    locale,
    options,
    segmenterCache,
    (safeLocale) => new Intl.Segmenter(safeLocale, options),
  );
}
