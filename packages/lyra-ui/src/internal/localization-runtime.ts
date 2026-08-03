import { getPluralRules } from './intl-cache.js';
import type {
  LyraLocaleDirection,
  LyraLocaleMeta,
  LyraLocaleStrings,
  LyraMessage,
  LyraPluralCategory,
  LyraPluralMessage,
} from './localization-types.js';

const locales = new Map<string, LyraLocaleStrings>();
const localeMeta = new Map<string, LyraLocaleMeta>();
// Synthetic diagnostic catalogs are selected only by their exact locale tag. They must not become
// reverse regional fallbacks for the ordinary base language merely because their module was
// imported into a development bundle.
const exactOnlyLocales = new Set<string>();
const listeners = new Set<() => void>();
const registryListeners = new Set<() => void>();
let activeLocale = '';

function normalizeLocale(locale: string): string {
  return locale.trim().replace(/_/g, '-').toLowerCase();
}

/**
 * Every registered catalog whose *base language* matches `subtags[0]` but which is not itself a
 * step of the requested tag's truncation chain — the reverse direction of BCP-47 lookup, and the
 * only way `lang="zh"` can reach a `zh-CN`-only catalog.
 *
 * Ordering is deterministic and independent of registration order, so the same page always
 * resolves the same way regardless of which translation module happened to be imported first:
 *
 *   1. **Most shared subtags first.** A candidate scores one point per subtag of the requested
 *      tag it also carries, so `zh-Hant-TW` prefers a registered `zh-TW` over a registered
 *      `zh-CN` even though neither is a prefix of it.
 *   2. **Then alphabetically**, purely as a tie-break: with `zh-CN` and `zh-TW` both registered
 *      and a bare `zh` requested, `zh-CN` wins. This is an arbitrary-but-stable choice, not a
 *      claim that Simplified is the better default — an application that cares registers the
 *      regional tag it means, or offers `zh` itself.
 */
function regionalFallbacks(subtags: string[]): string[] {
  const language = subtags[0];
  if (!language) return [];
  const requested = new Set(subtags);
  const score = (key: string): number => key.split('-').filter((subtag) => requested.has(subtag)).length;
  return [...locales.keys()]
    .filter((key) =>
      !exactOnlyLocales.has(key) &&
      key.split('-')[0] === language &&
      !isPrefixOf(key, subtags))
    .sort((a, b) => score(b) - score(a) || (a < b ? -1 : a > b ? 1 : 0));
}

/** Whether `key` is one of the truncation steps of `subtags` (and therefore already in the chain). */
function isPrefixOf(key: string, subtags: string[]): boolean {
  const parts = key.split('-');
  return parts.length <= subtags.length && parts.every((part, index) => part === subtags[index]);
}

/**
 * The ordered lookup chain for a locale tag, terminating at `'en'` (the built-in catalog, always
 * available through the caller-provided default catalog).
 *
 * The chain is the full BCP-47 truncation walk, most specific first —
 * `zh-Hans-CN` → `zh-Hans` → `zh` — followed by {@link regionalFallbacks}. Truncation comes first
 * so an exactly-matching catalog always wins over a sibling region: with both `zh` and `zh-CN`
 * registered, `zh-Hans-CN` resolves to `zh`.
 *
 * Both halves matter in practice, because the shipped catalogs are a mix: `fa` and `he` are base
 * tags reached from `fa-IR`/`he-IL` by truncation, while `pt-BR` and `zh-CN` are regional-only and
 * reachable from `pt`/`zh` only through the fallback half.
 */
function localeCandidates(locale: string): string[] {
  const normalized = normalizeLocale(locale);
  const subtags = normalized.split('-').filter(Boolean);
  const candidates: string[] = [];
  for (let length = subtags.length; length > 0; length--) {
    candidates.push(subtags.slice(0, length).join('-'));
  }
  candidates.push(...regionalFallbacks(subtags));
  if (!candidates.includes('en')) candidates.push('en');
  return candidates;
}

function notify(): void {
  for (const listener of [...listeners]) listener();
}

/** Every locale with registered strings, plus 'en' (always available via DEFAULT_STRINGS even
 *  with no explicit registerLyraLocale('en', ...) call), sorted, deduped. */
export function getRegisteredLyraLocales(): string[] {
  const keys = new Set(['en', ...locales.keys()]);
  return [...keys].sort();
}

/** Subscribe to locale *registry membership* changes (a new locale registered) — distinct from
 *  subscribeLyraLocale(), which only fires for the currently *active* locale's string changes.
 *  Only a consumer that enumerates the registry (lr-locale-picker) needs this; every other
 *  component's rendered strings are unaffected by a registration for a locale it isn't using, so
 *  registerLyraLocale() must not force a global requestUpdate() on every mounted component just
 *  to reach the one picker that cares. */
export function subscribeLyraLocaleRegistry(listener: () => void): () => void {
  registryListeners.add(listener);
  return () => registryListeners.delete(listener);
}

/**
 * Register or extend messages for a locale.
 *
 * `meta` is optional and merged the same way `strings` is, so a later two-argument call adding
 * messages never drops metadata a previous call declared (and vice versa). Passing it is the only
 * way the library can answer {@link getLyraLocaleDirection} for a locale whose direction the
 * runtime's `Intl` cannot report.
 */
function registerLocale(
  locale: string,
  strings: LyraLocaleStrings,
  meta: LyraLocaleMeta | undefined,
  exactOnly: boolean,
): void {
  const key = normalizeLocale(locale);
  if (!key) throw new TypeError('A locale is required.');
  // Exact-only is an identity of the registered locale tag, not of one catalog write. A later
  // public registration may extend a pseudo catalog, but must never turn that tag into a reverse
  // fallback for its ordinary base language.
  if (exactOnly) exactOnlyLocales.add(key);
  locales.set(key, { ...(locales.get(key) ?? {}), ...strings });
  if (meta) localeMeta.set(key, { ...(localeMeta.get(key) ?? {}), ...meta });
  // A new registry key can change what `localeCandidates()` resolves to (a regional-only catalog
  // becoming reachable from its base language), and `pluralLocale()` memoizes that chain.
  pluralLocaleCache.clear();
  // A connected component may resolve its locale from the document, a composed ancestor, or its
  // own override instead of `activeLocale`. Catalog imports are rare, so notifying every locale
  // subscriber is both simpler and correct for every inheritance source and fallback chain.
  notify();
  for (const listener of [...registryListeners]) listener();
}

export function registerLyraLocale(
  locale: string,
  strings: LyraLocaleStrings,
  meta?: LyraLocaleMeta,
): void {
  registerLocale(locale, strings, meta, false);
}

/**
 * Registers a catalog that is reachable only through its exact/truncation lookup chain, never as
 * a reverse regional fallback for another tag sharing its base language.
 *
 * @internal
 */
export function registerLyraExactLocale(
  locale: string,
  strings: LyraLocaleStrings,
  meta?: LyraLocaleMeta,
): void {
  registerLocale(locale, strings, meta, true);
}

/**
 * The writing direction to use for `locale`, as an application would put in `dir`.
 *
 * Resolution order, stopping at the first answer:
 *
 *   1. A `dir` declared by {@link registerLyraLocale}'s `meta` argument, walked through the same
 *      candidate chain messages use — so `ar-EG` inherits the `ar` catalog's declaration.
 *   2. `Intl.Locale`'s text-info surface, which is feature-detected rather than assumed: it is
 *      spelled as a `textInfo` accessor in some engines, a `getTextInfo()` method in others, and
 *      is absent in older ones. A structurally invalid tag throws here and is caught.
 *   3. `'ltr'`, the platform default.
 *
 * This never *applies* a direction. Components read the inherited `dir` cascade and no component
 * forces one from `lang`; this is the lookup an application needs to set `dir` itself.
 */
export function getLyraLocaleDirection(locale: string): LyraLocaleDirection {
  const normalized = normalizeLocale(locale);
  if (!normalized) return 'ltr';
  for (const candidate of localeCandidates(normalized)) {
    const declared = localeMeta.get(candidate)?.dir;
    if (declared) return declared;
  }
  try {
    const resolved = new Intl.Locale(normalized) as LocaleWithTextInfo;
    const direction = resolved.textInfo?.direction ?? resolved.getTextInfo?.().direction;
    return direction === 'rtl' ? 'rtl' : 'ltr';
  } catch {
    return 'ltr';
  }
}

/**
 * `Intl.Locale`'s text-info surface, still shifting between runtimes — the same accessor-vs-method
 * split `calendar-core.ts` documents for week info. Intentionally an intersection rather than an
 * `extends`, so an ambient lib.dom that types either member as required is not illegally narrowed.
 */
type LocaleWithTextInfo = Intl.Locale & {
  textInfo?: { direction?: string };
  getTextInfo?: () => { direction?: string };
};

/** Set the page-level locale used by Lyra components without an explicit locale. */
export function setLyraLocale(locale: string): void {
  const next = locale.trim();
  if (activeLocale === next) return;
  activeLocale = next;
  notify();
}

/** Return the current page-level locale. */
export function getLyraLocale(): string {
  return activeLocale;
}

/** Subscribe to locale changes. The returned function is safe to call repeatedly. */
export function subscribeLyraLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function inheritedLocale(host: Element): string {
  const explicit = host.getAttribute('locale') || host.getAttribute('lang');
  if (explicit) return explicit;
  const composedParent = (element: Element): Element | null => {
    if (element.parentElement) return element.parentElement;
    const root = element.getRootNode();
    // `instanceof ShadowRoot` is realm-bound: a target adopted into an iframe has a shadow root
    // whose constructor is not the outer window's constructor. The host-bearing document-
    // fragment shape is the cross-realm platform contract we actually need.
    const candidate = (root as { nodeType?: number; host?: unknown }).host;
    return root.nodeType === 11 && candidate !== null && typeof candidate === 'object' &&
      typeof (candidate as Element).getAttribute === 'function'
      ? candidate as Element
      : null;
  };
  let parent = composedParent(host);
  while (parent) {
    const locale = parent.getAttribute('locale') || parent.getAttribute('lang');
    if (locale) return locale;
    parent = composedParent(parent);
  }
  const documentLocale = host.ownerDocument?.documentElement?.getAttribute('lang');
  if (documentLocale) return documentLocale;
  return activeLocale || 'en';
}

/**
 * Per-host memos for `resolveLyraLocale()`/`resolveLyraDirection()`. The
 * ancestor-chain walk (and `getComputedStyle` for direction) is a per-call
 * cost that per-row template loops multiply by hundreds within a single
 * render pass. Caching is strictly opt-in via `enableLyraLocaleCache()`
 * because a host must guarantee invalidation for the memo to stay honest —
 * arbitrary elements passed to the public resolvers get no caching.
 */
const cacheableLocaleHosts = new WeakSet<Element>();
const resolvedLocaleCache = new WeakMap<Element, string>();
const resolvedDirectionCache = new WeakMap<Element, 'ltr' | 'rtl'>();

/**
 * Opts a host into memoized locale/direction resolution. The host must call
 * `invalidateLyraLocaleCache()` whenever a new update cycle is scheduled and
 * on (re)connection, so a memo never outlives the render pass that produced
 * it. An ancestor `lang`/`dir` change mid-cycle is only reflected in rendered
 * output on the next update anyway, so per-cycle reuse changes nothing
 * observable.
 */
export function enableLyraLocaleCache(host: Element): void {
  cacheableLocaleHosts.add(host);
}

/** Drops a host's memoized locale/direction so the next read re-resolves. */
export function invalidateLyraLocaleCache(host: Element): void {
  resolvedLocaleCache.delete(host);
  resolvedDirectionCache.delete(host);
}

/** Resolve the locale inherited by a component host. */
export function resolveLyraLocale(host: Element): string {
  if (!cacheableLocaleHosts.has(host)) return inheritedLocale(host);
  let locale = resolvedLocaleCache.get(host);
  if (locale === undefined) {
    locale = inheritedLocale(host);
    resolvedLocaleCache.set(host, locale);
  }
  return locale;
}

function inheritedDirection(host: Element): 'ltr' | 'rtl' {
  const explicit = host.getAttribute('dir');
  if (explicit === 'rtl' || explicit === 'ltr') return explicit;
  const view = host.ownerDocument?.defaultView;
  if (view) return view.getComputedStyle(host).direction === 'rtl' ? 'rtl' : 'ltr';
  return 'ltr';
}

/** Resolve the direction inherited by a component host. */
export function resolveLyraDirection(host: Element): 'ltr' | 'rtl' {
  if (!cacheableLocaleHosts.has(host)) return inheritedDirection(host);
  let direction = resolvedDirectionCache.get(host);
  if (direction === undefined) {
    direction = inheritedDirection(host);
    resolvedDirectionCache.set(host, direction);
  }
  return direction;
}

/**
 * Where each plural category looks when a catalog does not author it, always
 * terminating at the mandatory `other`.
 *
 * The widening steps are grammatical neighbours, not arbitrary: `two` is a
 * special case carved out of the small-number bucket that `few` covers
 * (Arabic, Slovenian, Welsh), and `few`/`many` are the adjacent
 * larger-magnitude buckets in the Slavic languages that have both. A catalog
 * that authors only `few` therefore reads better for `many` than the fully
 * generic `other` (which in Russian is reserved for fractional counts).
 */
const PLURAL_CATEGORY_FALLBACKS: Record<LyraPluralCategory, readonly LyraPluralCategory[]> = {
  zero: ['zero', 'other'],
  one: ['one', 'other'],
  two: ['two', 'few', 'many', 'other'],
  few: ['few', 'many', 'other'],
  many: ['many', 'few', 'other'],
  other: ['other'],
};

function isPluralMessage(message: LyraMessage): message is LyraPluralMessage {
  return typeof message === 'object';
}

/**
 * The number that drives plural selection. `count` is the documented spelling
 * and the one every built-in message interpolates; `pluralCount` exists for
 * the call sites that must show a locale-grouped, pre-formatted `{count}`
 * (`Intl.NumberFormat` output is a string, and `'1,024'` cannot select a
 * category). A non-finite or absent value selects `other`.
 */
function pluralSelector(values: Record<string, string | number>): number | undefined {
  const raw = values['pluralCount'] ?? values['count'];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
}

/**
 * The first tag in the locale's own resolution chain that `Intl.PluralRules`
 * accepts. An inherited `lang` is arbitrary author-supplied text and
 * `Intl.PluralRules` throws a `RangeError` on anything that is not a
 * structurally valid language tag (`lang="x-test"`, `lang="en_US"`,
 * `lang=""`), which would otherwise turn a stray attribute into a render-time
 * exception. Walking `localeCandidates()` reuses the exact chain message
 * lookup already uses — the full BCP-47 truncation walk, then any registered
 * catalog sharing the base language, then `'en'` — so plural selection and
 * message selection can never disagree about which locale is in force.
 * Memoized because a rejected tag throws on every construction;
 * `registerLyraLocale()` clears the memo, since registering a catalog can
 * lengthen the chain.
 */
const pluralLocaleCache = new Map<string, string | undefined>();
const MAX_PLURAL_LOCALE_ENTRIES = 64;

function pluralLocale(locale: string): string | undefined {
  const cached = pluralLocaleCache.get(locale);
  if (cached !== undefined || pluralLocaleCache.has(locale)) return cached;
  let resolved: string | undefined;
  for (const candidate of localeCandidates(locale)) {
    try {
      getPluralRules(candidate);
      resolved = candidate;
      break;
    } catch {
      // Structurally invalid tag — try the next, less specific candidate.
    }
  }
  if (pluralLocaleCache.size >= MAX_PLURAL_LOCALE_ENTRIES) pluralLocaleCache.clear();
  pluralLocaleCache.set(locale, resolved);
  return resolved;
}

/**
 * Picks one category's string out of a pluralized message. Selection always
 * uses the host's effective locale, even when the message itself came from the
 * built-in English defaults — an unregistered locale then widens through
 * {@link PLURAL_CATEGORY_FALLBACKS} to a category English does author.
 */
function selectPluralMessage(message: LyraPluralMessage, locale: string, count: number | undefined): string {
  if (count === undefined) return message.other;
  const tag = pluralLocale(locale);
  if (tag === undefined) return message.other;
  const category = getPluralRules(tag).select(count) as LyraPluralCategory;
  for (const candidate of PLURAL_CATEGORY_FALLBACKS[category] ?? PLURAL_CATEGORY_FALLBACKS.other) {
    const text = message[candidate];
    if (text !== undefined) return text;
  }
  return message.other;
}

/**
 * Resolve a message for a component. An explicit per-component override wins,
 * followed by a non-empty component property fallback, registered locale
 * messages, and finally the built-in English message.
 *
 * A resolved message may be a plain string (unchanged behaviour) or a
 * {@link LyraPluralMessage}; the latter is reduced to one string by
 * `Intl.PluralRules` before interpolation, so the return type stays `string`
 * and every caller's contract is untouched.
 */
export function resolveLyraString(
  host: Element,
  key: string,
  overrides?: LyraLocaleStrings,
  fallback?: string,
  values?: Record<string, string | number>,
  defaults?: Readonly<LyraLocaleStrings>,
): string {
  const own = overrides?.[key];
  let message: LyraMessage | undefined = own ?? fallback;
  let locale: string | undefined;
  if (message === undefined) {
    locale = resolveLyraLocale(host);
    for (const candidate of localeCandidates(locale)) {
      const registered = locales.get(candidate)?.[key];
      if (registered !== undefined) {
        message = registered;
        break;
      }
    }
  }
  message ??= defaults?.[key] ?? key;
  let text: string;
  if (isPluralMessage(message)) {
    locale ??= resolveLyraLocale(host);
    text = selectPluralMessage(message, locale, values ? pluralSelector(values) : undefined);
  } else {
    text = message;
  }
  if (!values) return text;
  return text.replace(/\{(\w+)\}/g, (_match, name: string) => String(values[name] ?? `{${name}}`));
}

/**
 * Returns the text around one rich localized interpolation. `interpolate` must resolve the
 * message through the normal localization values argument with its supplied marker as the rich
 * value. The marker is selected outside the translated template so repeated and omitted
 * placeholders remain well-defined without parsing a localization token by hand.
 */
export function resolveLocalizedParts(
  template: string,
  interpolate: (marker: string) => string,
): string[] {
  let marker = '\ue000';
  while (template.includes(marker)) marker += '\ue001';
  return interpolate(marker).split(marker);
}
