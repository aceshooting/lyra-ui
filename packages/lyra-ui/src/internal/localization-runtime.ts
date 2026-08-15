import { getPluralRules } from './intl-cache.js';
import type {
  LyraLocaleDirection,
  LyraLocaleMeta,
  LyraLocaleStrings,
  LyraMessage,
  LyraPluralCategory,
  LyraPluralMessage,
} from './localization-types.js';

type LocaleCatalog = Readonly<LyraLocaleStrings>;

interface LocaleIdentity {
  /** Canonical public spelling (`pt-BR`) or the normalized lowercase legacy/custom spelling. */
  readonly publicTag: string;
  /** Case-insensitive registry/lookup identity. */
  readonly lookupKey: string;
  /** Whether `Intl` accepted the tag as structurally well-formed BCP-47. */
  readonly wellFormed: boolean;
  /** Whether the complete truncation chain fits the explicit work ceiling. */
  readonly candidateBounded: boolean;
  /** Whether a public storage API may retain this identity. */
  readonly storable: boolean;
}

interface HostLocaleTarget extends Element {
  requestUpdate(): unknown;
}

interface HostLocaleSubscription {
  readonly host: WeakRef<HostLocaleTarget>;
}

const MAX_LOCALE_CANDIDATES = 64;
const MAX_LOCALE_SUBTAGS = 32;
const MAX_LOCALE_TAG_LENGTH = 255;
const MAX_LOCALE_CACHE_ENTRIES = 128;
const MAX_CACHEABLE_LOCALE_LENGTH = 512;
const LEGACY_LOCALE_PATTERN = /^[a-z0-9]{1,32}(?:-[a-z0-9]{1,32})*$/;

const locales = new Map<string, LocaleCatalog>();
const localePublicTags = new Map<string, string>();
const localeMeta = new Map<string, LyraLocaleMeta>();
const wellFormedLocales = new Set<string>();
// Synthetic diagnostic catalogs are selected only by their exact locale tag. They must not become
// reverse regional fallbacks for the ordinary base language merely because their module was
// imported into a development bundle.
const exactOnlyLocales = new Set<string>();
const localeCatalogRevisions = new Map<string, number>();
const listeners = new Set<() => void>();
const hostLocaleListeners = new Set<HostLocaleSubscription>();
const hostLocaleFinalizer = new FinalizationRegistry<HostLocaleSubscription>(
  (subscription) => {
    hostLocaleListeners.delete(subscription);
  }
);
const ownerDocumentsWithBrowsingContext = new WeakSet<Document>();
const registryListeners = new Set<() => void>();
let activeLocale = '';
let catalogRevision = 0;

const localeIdentityCache = new Map<string, LocaleIdentity>();
const localeCandidateCache = new Map<string, readonly string[]>();

function cacheBounded<K, V>(cache: Map<K, V>, key: K, value: V): void {
  if (cache.size >= MAX_LOCALE_CACHE_ENTRIES) cache.clear();
  cache.set(key, value);
}

function subtagCountWithinBounds(tag: string): boolean {
  if (tag.length > MAX_LOCALE_TAG_LENGTH) return false;
  let count = tag ? 1 : 0;
  for (let index = 0; index < tag.length; index += 1) {
    if (tag.charCodeAt(index) === 45 && ++count > MAX_LOCALE_SUBTAGS)
      return false;
  }
  return true;
}

/**
 * Produces the single identity used by public locale APIs and internal lookup.
 *
 * Underscores remain a supported input alias. Well-formed BCP-47 goes through the platform
 * canonicalizer (`PT_BR` -> `pt-BR`, deprecated aliases included). The library historically also
 * accepted private-use-only and short opaque application/test tags that `Intl` rejects; those stay
 * supported as lowercase hyphenated identities. Over-complex invalid inherited `lang` values
 * resolve to English and are never retained by registration/active-locale storage APIs.
 */
function localeIdentity(locale: string): LocaleIdentity {
  const normalized =
    typeof locale === 'string' ? locale.trim().replace(/_/g, '-') : '';
  if (!normalized) {
    return {
      publicTag: '',
      lookupKey: '',
      wellFormed: false,
      candidateBounded: true,
      storable: false,
    };
  }
  const cached =
    normalized.length <= MAX_CACHEABLE_LOCALE_LENGTH
      ? localeIdentityCache.get(normalized)
      : undefined;
  if (cached) return cached;

  let publicTag = normalized.toLowerCase();
  let wellFormed = false;
  try {
    const canonical = Intl.getCanonicalLocales(normalized)[0];
    if (canonical) {
      publicTag = canonical;
      wellFormed = true;
    }
  } catch {
    // Preserve the documented lowercase legacy/private identity below.
  }
  const lookupKey = publicTag.toLowerCase();
  const candidateBounded = subtagCountWithinBounds(lookupKey);
  const identity: LocaleIdentity = {
    publicTag,
    lookupKey,
    wellFormed,
    candidateBounded,
    storable:
      wellFormed || (candidateBounded && LEGACY_LOCALE_PATTERN.test(lookupKey)),
  };
  if (normalized.length <= MAX_CACHEABLE_LOCALE_LENGTH) {
    cacheBounded(localeIdentityCache, normalized, identity);
  }
  return identity;
}

function storedLocaleIdentity(
  locale: string,
  required: boolean
): LocaleIdentity {
  if (typeof locale !== 'string')
    throw new TypeError('A locale must be a string.');
  const identity = localeIdentity(locale);
  if (!identity.publicTag) {
    if (!required) return identity;
    throw new TypeError('A locale is required.');
  }
  if (!identity.storable) {
    throw new TypeError(
      'The locale must be BCP-47 or a bounded alphanumeric custom tag.'
    );
  }
  return identity;
}

/**
 * Canonicalizes a component-owned locale value through the shared identity path. Invalid values
 * beyond the defensive storage bounds resolve to English instead of propagating an unbounded
 * opaque tag through component state.
 *
 * @internal
 */
export function canonicalizeLyraLocale(locale: string): string {
  const identity = localeIdentity(locale);
  return identity.storable ? identity.publicTag : 'en';
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
function regionalFallbacks(
  requestedKey: string,
  limit: number,
  wellFormed: boolean
): string[] {
  if (limit <= 0 || !wellFormed) return [];
  const separator = requestedKey.indexOf('-');
  const language =
    separator === -1 ? requestedKey : requestedKey.slice(0, separator);
  if (!language) return [];
  const requested = new Set(requestedKey.split('-'));
  const score = (key: string): number =>
    key.split('-').filter((subtag) => requested.has(subtag)).length;
  return [...locales.keys()]
    .filter(
      (key) =>
        wellFormedLocales.has(key) &&
        !exactOnlyLocales.has(key) &&
        (key === language || key.startsWith(`${language}-`)) &&
        !isPrefixOf(key, requestedKey)
    )
    .sort((a, b) => score(b) - score(a) || (a < b ? -1 : a > b ? 1 : 0))
    .slice(0, limit);
}

/** Whether `key` is one of the truncation steps of `requestedKey`. */
function isPrefixOf(key: string, requestedKey: string): boolean {
  return key === requestedKey || requestedKey.startsWith(`${key}-`);
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
  const identity = localeIdentity(locale);
  const normalized = identity.lookupKey;
  if (!normalized) return ['en'];
  const cached =
    normalized.length <= MAX_CACHEABLE_LOCALE_LENGTH
      ? localeCandidateCache.get(normalized)
      : undefined;
  if (cached) return [...cached];

  const candidates: string[] = [];
  if (identity.wellFormed || identity.candidateBounded)
    candidates.push(normalized);
  if (identity.candidateBounded) {
    // Boundary indexes avoid rebuilding each prefix through `slice(...).join('-')`. The number and
    // aggregate size of retained prefixes are bounded before this walk begins.
    for (let index = normalized.length - 1; index >= 0; index -= 1) {
      if (normalized.charCodeAt(index) === 45 && index > 0)
        candidates.push(normalized.slice(0, index));
    }
    const regionalBudget = Math.max(
      0,
      MAX_LOCALE_CANDIDATES - candidates.length - 1
    );
    candidates.push(
      ...regionalFallbacks(normalized, regionalBudget, identity.wellFormed)
    );
  } else if (identity.wellFormed) {
    // Valid tags are never rejected for exceeding the defensive malformed-input ceiling. Retain
    // their exact identity and base-language fallback without materializing an unbounded ladder.
    const separator = normalized.indexOf('-');
    if (separator > 0) candidates.push(normalized.slice(0, separator));
  }
  if (!candidates.includes('en')) candidates.push('en');
  if (candidates.length > MAX_LOCALE_CANDIDATES) {
    candidates.splice(MAX_LOCALE_CANDIDATES - 1, candidates.length, 'en');
  }
  const frozen = Object.freeze([...candidates]);
  if (normalized.length <= MAX_CACHEABLE_LOCALE_LENGTH) {
    cacheBounded(localeCandidateCache, normalized, frozen);
  }
  return candidates;
}

/**
 * A bounded signature of every catalog currently reachable from `locale`. Registration revisions
 * are globally unique, so the signature also detects candidate insertion, removal, and reordering
 * without making an unrelated locale registration dirty every localized host.
 *
 * @internal
 */
export function lyraLocaleCatalogVersion(locale: string): string {
  return localeCandidates(locale)
    .map((candidate) => localeCatalogRevisions.get(candidate) ?? 0)
    .join(',');
}

/** Every locale with registered strings, plus 'en' (always available via DEFAULT_STRINGS even
 *  with no explicit registerLyraLocale('en', ...) call), in canonical public BCP-47 spelling,
 *  sorted and deduped by case-insensitive lookup identity. */
export function getRegisteredLyraLocales(): readonly string[] {
  const keys = new Set(['en', ...localePublicTags.values()]);
  return Object.freeze([...keys].sort());
}

/** Subscribe to locale *registry membership* changes (a new locale registered) — distinct from
 *  subscribeLyraLocale(), which fires for active-locale selection and relevant active-catalog
 *  changes. Extending an already registered catalog does not change membership and does not fire.
 *  Only a consumer that enumerates the registry (lr-locale-picker) needs this; every other
 *  component's rendered strings are unaffected by a registration for a locale it isn't using, so
 *  registerLyraLocale() must not force a global requestUpdate() on every mounted component just
 *  to reach the one picker that cares.
 *
 * All listeners in the starting snapshot receive an eligible change. If one or more callbacks
 * throw, delivery finishes and the committing register call then throws one `AggregateError`.
 */
export function subscribeLyraLocaleRegistry(listener: () => void): () => void {
  registryListeners.add(listener);
  return () => registryListeners.delete(listener);
}

const MAX_CATALOG_MESSAGES = 4_096;
const MAX_MESSAGE_KEY_LENGTH = 256;
const PLURAL_CATEGORIES = new Set<string>([
  'zero',
  'one',
  'two',
  'few',
  'many',
  'other',
]);
const trustedMessageRecords = new WeakSet<object>();

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function ownDataValue(
  record: Record<string, unknown>,
  key: string
): { found: boolean; value?: unknown } {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (!descriptor || !('value' in descriptor)) return { found: false };
    return { found: true, value: descriptor.value };
  } catch {
    return { found: false };
  }
}

function snapshotPluralMessage(value: unknown): LyraPluralMessage | undefined {
  if (!isPlainRecord(value)) return undefined;
  const snapshot = Object.create(null) as Record<string, string>;
  let count = 0;
  try {
    for (const key in value) {
      if (++count > PLURAL_CATEGORIES.size || !PLURAL_CATEGORIES.has(key))
        return undefined;
      if (!Object.prototype.hasOwnProperty.call(value, key)) return undefined;
      const entry = ownDataValue(value, key);
      if (!entry.found || typeof entry.value !== 'string') return undefined;
      snapshot[key] = entry.value;
    }
  } catch {
    return undefined;
  }
  if (typeof snapshot['other'] !== 'string') return undefined;
  const frozen = Object.freeze(snapshot) as LyraPluralMessage;
  trustedMessageRecords.add(frozen);
  return frozen;
}

function snapshotMessage(value: unknown): LyraMessage | undefined {
  return typeof value === 'string' ? value : snapshotPluralMessage(value);
}

function snapshotCatalog(strings: unknown): LocaleCatalog {
  const snapshot = Object.create(null) as Record<string, LyraMessage>;
  if (!isPlainRecord(strings)) {
    const frozen = Object.freeze(snapshot) as LocaleCatalog;
    trustedMessageRecords.add(frozen);
    return frozen;
  }
  let count = 0;
  try {
    for (const key in strings) {
      if (count >= MAX_CATALOG_MESSAGES) break;
      count += 1;
      if (!Object.prototype.hasOwnProperty.call(strings, key)) continue;
      if (!key || key.length > MAX_MESSAGE_KEY_LENGTH) continue;
      const entry = ownDataValue(strings, key);
      if (!entry.found) continue;
      const message = snapshotMessage(entry.value);
      if (message !== undefined) snapshot[key] = message;
    }
  } catch {
    // A hostile enumeration trap invalidates the unread suffix only. Entries already copied are
    // independent data properties, and no caller accessor has executed.
  }
  const frozen = Object.freeze(snapshot) as LocaleCatalog;
  trustedMessageRecords.add(frozen);
  return frozen;
}

function mergeCatalogs(
  current: LocaleCatalog | undefined,
  incoming: LocaleCatalog
): LocaleCatalog {
  const merged = Object.assign(
    Object.create(null),
    current ?? {},
    incoming
  ) as LocaleCatalog;
  Object.freeze(merged);
  trustedMessageRecords.add(merged);
  return merged;
}

function snapshotLocaleMeta(
  meta: unknown
): Readonly<LyraLocaleMeta> | undefined {
  if (meta === undefined) return undefined;
  if (!isPlainRecord(meta)) return Object.freeze({});
  const snapshot: LyraLocaleMeta = {};
  const dir = ownDataValue(meta, 'dir');
  if (dir.found && (dir.value === 'ltr' || dir.value === 'rtl'))
    snapshot.dir = dir.value;
  const name = ownDataValue(meta, 'name');
  if (name.found && typeof name.value === 'string') snapshot.name = name.value;
  return Object.freeze(snapshot);
}

/**
 * Creates the immutable, bounded per-instance `.strings` snapshot stored by {@link LyraElement}.
 * Invalid/accessor entries are omitted per key and cannot execute while rendering.
 *
 * @internal
 */
export function snapshotLyraLocaleStrings(strings: unknown): LyraLocaleStrings {
  return snapshotCatalog(strings) as LyraLocaleStrings;
}

function safeMessageAt(source: unknown, key: string): LyraMessage | undefined {
  if (!isPlainRecord(source)) return undefined;
  if (trustedMessageRecords.has(source)) {
    return (source as Record<string, LyraMessage | undefined>)[key];
  }
  const entry = ownDataValue(source, key);
  return entry.found ? snapshotMessage(entry.value) : undefined;
}

function deliverLocaleListeners(
  groups: readonly (readonly (() => void)[])[],
  operation: string
): void {
  const errors: unknown[] = [];
  for (const group of groups) {
    // Each group arrives as a starting snapshot. Unsubscribing or subscribing during delivery does
    // not strand a listener that was eligible when the committed state change began.
    for (const listener of group) {
      try {
        listener();
      } catch (error) {
        errors.push(error);
      }
    }
  }
  if (errors.length > 0) {
    throw new AggregateError(
      errors,
      `${operation} committed, but ${errors.length} locale subscriber${
        errors.length === 1 ? '' : 's'
      } failed.`
    );
  }
}

function localeUsesCatalog(locale: string, lookupKey: string): boolean {
  return localeCandidates(locale).includes(lookupKey);
}

function ownerView(
  host: Element
): (Window & typeof globalThis) | null | undefined {
  try {
    return host.ownerDocument.defaultView;
  } catch {
    return undefined;
  }
}

/** Remembers that a connected Lyra host's owner was once backed by a browsing context. */
export function recordLyraOwnerDocumentConnection(host: Element): void {
  if (ownerView(host))
    ownerDocumentsWithBrowsingContext.add(host.ownerDocument);
}

function forgetHostLocaleSubscription(
  subscription: HostLocaleSubscription
): void {
  hostLocaleListeners.delete(subscription);
  hostLocaleFinalizer.unregister(subscription);
}

function liveHostLocaleSubscriptions(): Array<{
  readonly host: HostLocaleTarget;
}> {
  const live: Array<{ readonly host: HostLocaleTarget }> = [];
  for (const subscription of [...hostLocaleListeners]) {
    const host = subscription.host.deref();
    // Removing an iframe does not disconnect descendants in its content document in every engine:
    // they can retain `isConnected === true` while the document has lost its window. Prune that
    // owner explicitly, as well as ordinary disconnected/dead hosts, before taking the delivery
    // snapshot.
    if (
      !host ||
      !host.isConnected ||
      (ownerDocumentsWithBrowsingContext.has(host.ownerDocument) &&
        ownerView(host) === null)
    ) {
      forgetHostLocaleSubscription(subscription);
      continue;
    }
    live.push({ host });
  }
  return live;
}

/**
 * Register or extend messages for a locale.
 *
 * Well-formed tags use their canonical BCP-47 spelling publicly while lookup remains
 * case-insensitive; `_` is accepted as an input separator. Bounded legacy/private application tags
 * remain accepted in normalized lowercase. Structurally invalid over-complex storage tags throw.
 *
 * `strings` is read as a bounded snapshot of at most 4,096 own enumerable data properties. Plain
 * strings and plain CLDR plural records with a data-string `other` are cloned and frozen. Invalid
 * or accessor-backed entries are ignored per key, so they neither execute nor replace that key's
 * last valid value; valid siblings still merge.
 *
 * `meta` is optional and merged the same way `strings` is, so a later two-argument call adding
 * messages never drops metadata a previous call declared (and vice versa). Passing it is the only
 * way the library can answer {@link getLyraLocaleDirection} for a locale whose direction the
 * runtime's `Intl` cannot report. Subscriber failures are reported as an `AggregateError` only
 * after the catalog and every eligible listener delivery have completed.
 */
function registerLocale(
  locale: string,
  strings: LyraLocaleStrings,
  meta: LyraLocaleMeta | undefined,
  exactOnly: boolean
): void {
  const identity = storedLocaleIdentity(locale, true);
  const key = identity.lookupKey;
  const incomingStrings = snapshotCatalog(strings);
  const incomingMeta = snapshotLocaleMeta(meta);
  const isNewLocale = !locales.has(key);
  const candidateTopologyChanged =
    isNewLocale ||
    (exactOnly && !exactOnlyLocales.has(key)) ||
    (identity.wellFormed && !wellFormedLocales.has(key));
  // Exact-only is an identity of the registered locale tag, not of one catalog write. A later
  // public registration may extend a pseudo catalog, but must never turn that tag into a reverse
  // fallback for its ordinary base language.
  if (exactOnly) exactOnlyLocales.add(key);
  if (identity.wellFormed) wellFormedLocales.add(key);
  locales.set(key, mergeCatalogs(locales.get(key), incomingStrings));
  localePublicTags.set(key, identity.publicTag);
  if (incomingMeta) {
    localeMeta.set(
      key,
      Object.freeze({ ...(localeMeta.get(key) ?? {}), ...incomingMeta })
    );
  }
  localeCatalogRevisions.set(key, ++catalogRevision);
  // New membership or a changed exact-only identity can alter a regional fallback chain. Extending
  // an existing catalog changes messages/metadata but not candidate topology, so keep those hot
  // memoized chains intact.
  if (candidateTopologyChanged) {
    pluralLocaleCache.clear();
    localeCandidateCache.clear();
  }

  const activeSnapshot =
    activeLocale && localeUsesCatalog(activeLocale, key) ? [...listeners] : [];
  const hostSnapshot = liveHostLocaleSubscriptions()
    .filter(({ host }) => localeUsesCatalog(inheritedLocale(host), key))
    .map(
      ({ host }) =>
        () =>
          host.requestUpdate()
    );
  const registrySnapshot = isNewLocale ? [...registryListeners] : [];
  deliverLocaleListeners(
    [activeSnapshot, hostSnapshot, registrySnapshot],
    `registerLyraLocale(${JSON.stringify(identity.publicTag)})`
  );
}

export function registerLyraLocale(
  locale: string,
  strings: LyraLocaleStrings,
  meta?: LyraLocaleMeta
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
  meta?: LyraLocaleMeta
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
  const identity = localeIdentity(locale);
  if (!identity.publicTag) return 'ltr';
  for (const candidate of localeCandidates(identity.publicTag)) {
    const declared = localeMeta.get(candidate)?.dir;
    if (declared) return declared;
  }
  try {
    const resolved = new Intl.Locale(identity.publicTag) as LocaleWithTextInfo;
    const direction =
      resolved.textInfo?.direction ?? resolved.getTextInfo?.().direction;
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

/**
 * Set the page-level locale used by Lyra components without an explicit locale.
 *
 * This beats `<html lang>`. It did not until 9.0.0: `inheritedLocale()` consulted the document
 * element before the active locale (and reached it a second time through the ancestor walk), so on
 * any well-formed page -- one that declares `<html lang="en">`, i.e. essentially all of them --
 * `setLyraLocale('fr')` resolved to `'en'` and looked like a no-op. A per-subtree `locale`/`lang`
 * attribute on the component or any ancestor still wins over both, because that is a deliberate
 * scoped override rather than a page default.
 *
 * The stored/returned value follows the same canonical public tag path as registration. Equivalent
 * spellings are a no-op. Listener failures cannot interrupt delivery: the new locale commits, all
 * eligible starting-snapshot listeners run, then one `AggregateError` is thrown if any failed.
 */
export function setLyraLocale(locale: string): void {
  const next = storedLocaleIdentity(locale, false).publicTag;
  if (activeLocale === next) return;
  const hostSnapshot = liveHostLocaleSubscriptions();
  const previousHostLocales = hostSnapshot.map(({ host }) =>
    inheritedLocale(host)
  );
  activeLocale = next;
  const affectedHostListeners = hostSnapshot
    .filter(
      ({ host }, index) => inheritedLocale(host) !== previousHostLocales[index]
    )
    .map(
      ({ host }) =>
        () =>
          host.requestUpdate()
    );
  deliverLocaleListeners(
    [[...listeners], affectedHostListeners],
    `setLyraLocale(${JSON.stringify(next)})`
  );
}

/** Return the current page-level locale. */
export function getLyraLocale(): string {
  return activeLocale;
}

/**
 * Subscribe to active-locale selection changes and registrations that can alter the active
 * locale's messages or direction. Unrelated catalog registrations are registry-only and do not
 * fire this channel. The returned function is safe to call repeatedly.
 *
 * Listener failures are isolated until the eligible starting snapshot has run; the mutator then
 * throws one `AggregateError` containing every callback error.
 */
export function subscribeLyraLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Subscribes one component host to active changes that alter its effective locale and catalog
 * registrations reachable through that host's own document/ancestor/host candidate chain.
 *
 * @internal
 */
export function subscribeLyraLocaleForHost(host: HostLocaleTarget): () => void {
  recordLyraOwnerDocumentConnection(host);
  const subscription: HostLocaleSubscription = {
    host: new WeakRef(host),
  };
  hostLocaleListeners.add(subscription);
  hostLocaleFinalizer.register(host, subscription, subscription);
  return () => forgetHostLocaleSubscription(subscription);
}

function composedParentElement(element: Element): Element | null {
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode();
  // `instanceof ShadowRoot` is realm-bound: a target adopted into an iframe has a shadow root
  // whose constructor is not the outer window's constructor. The host-bearing document-fragment
  // shape is the cross-realm platform contract we actually need.
  const candidate = (root as { nodeType?: number; host?: unknown }).host;
  return root.nodeType === 11 &&
    candidate !== null &&
    typeof candidate === 'object' &&
    typeof (candidate as Element).getAttribute === 'function'
    ? (candidate as Element)
    : null;
}

function flattenedParentElement(element: Element): Element | null {
  const slot = (element as { assignedSlot?: unknown }).assignedSlot;
  if (
    slot !== null &&
    typeof slot === 'object' &&
    typeof (slot as Element).getAttribute === 'function'
  )
    return slot as Element;
  return composedParentElement(element);
}

/**
 * The locale a component host inherits, resolved in this order:
 *
 *   1. The host's own `locale`, then its own `lang`.
 *   2. The nearest composed ancestor declaring `locale`/`lang` -- EXCEPT that `<html lang>` is
 *      skipped here (see 4). A `locale` attribute on `<html>` is not skipped: `lang` there is
 *      generic page metadata every well-formed document carries, while `locale` is this library's
 *      own attribute and can only be a deliberate opt-in.
 *   3. The active locale from {@link setLyraLocale}, when one has been set.
 *   4. `<html lang>`, the document default.
 *   5. `'en'`.
 *
 * Steps 3 and 4 were the other way round before 9.0.0, which made `setLyraLocale()` inert on every
 * page declaring `<html lang>`; skipping the document element in step 2 is the other half of that
 * fix, since the ancestor walk passes through `<html>` on its way up and would otherwise read the
 * same attribute one step earlier.
 */
function inheritedLocale(host: Element): string {
  const explicit = host.getAttribute('locale') || host.getAttribute('lang');
  if (explicit) return canonicalizeLyraLocale(explicit);
  const documentElement = host.ownerDocument?.documentElement;
  let parent = composedParentElement(host);
  while (parent) {
    const locale =
      parent === documentElement
        ? parent.getAttribute('locale')
        : parent.getAttribute('locale') || parent.getAttribute('lang');
    if (locale) return canonicalizeLyraLocale(locale);
    parent = composedParentElement(parent);
  }
  if (activeLocale) return activeLocale;
  const documentLocale = documentElement?.getAttribute('lang');
  return documentLocale ? canonicalizeLyraLocale(documentLocale) : 'en';
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
  const explicit = host.getAttribute('dir')?.toLowerCase();
  if (explicit === 'rtl' || explicit === 'ltr') return explicit;
  const view = ownerView(host);
  if (view) {
    try {
      const getComputedStyle = view.getComputedStyle;
      if (typeof getComputedStyle === 'function') {
        const computed = getComputedStyle.call(view, host).direction;
        if (computed === 'rtl' || computed === 'ltr') return computed;
      }
    } catch {
      // An incomplete/hostile owner realm still gets the explicit-attribute fallback below.
    }
  }
  let parent = flattenedParentElement(host);
  while (parent) {
    const inherited = parent.getAttribute('dir')?.toLowerCase();
    if (inherited === 'rtl' || inherited === 'ltr') return inherited;
    parent = flattenedParentElement(parent);
  }
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
 * Reads a host's already-memoized locale/direction without resolving anything -- in particular,
 * without `resolveLyraDirection()`'s `getComputedStyle()` call. `undefined` when the host was
 * never opted into caching, or opted in but never actually read `effectiveLocale`/
 * `effectiveDirection` (so its own render never populated the memo). Lets a caller establish a
 * "what's currently rendered" baseline for free, piggybacking on whatever the host's own last
 * render already computed, instead of forcing a fresh (potentially expensive or, for
 * `getComputedStyle()` specifically, disruptive -- see `observeInheritedContext()`) resolution
 * purely to seed a comparison.
 */
export function peekLyraLocale(host: Element): string | undefined {
  return resolvedLocaleCache.get(host);
}

/** @see peekLyraLocale */
export function peekLyraDirection(host: Element): 'ltr' | 'rtl' | undefined {
  return resolvedDirectionCache.get(host);
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
const PLURAL_CATEGORY_FALLBACKS: Record<
  LyraPluralCategory,
  readonly LyraPluralCategory[]
> = {
  zero: ['zero', 'other'],
  one: ['one', 'other'],
  two: ['two', 'few', 'many', 'other'],
  few: ['few', 'many', 'other'],
  many: ['many', 'few', 'other'],
  other: ['other'],
};

/**
 * The number that drives plural selection. `count` is the documented spelling
 * and the one every built-in message interpolates; `pluralCount` exists for
 * the call sites that must show a locale-grouped, pre-formatted `{count}`
 * (`Intl.NumberFormat` output is a string, and `'1,024'` cannot select a
 * category). A non-finite or absent value selects `other`.
 */
function pluralSelector(
  values: Record<string, string | number>
): number | undefined {
  let raw: unknown;
  try {
    raw = values['pluralCount'] ?? values['count'];
  } catch {
    return undefined;
  }
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
  if (pluralLocaleCache.size >= MAX_PLURAL_LOCALE_ENTRIES)
    pluralLocaleCache.clear();
  pluralLocaleCache.set(locale, resolved);
  return resolved;
}

/**
 * Picks one category's string out of a pluralized message. Selection always
 * uses the host's effective locale, even when the message itself came from the
 * built-in English defaults — an unregistered locale then widens through
 * {@link PLURAL_CATEGORY_FALLBACKS} to a category English does author.
 */
function selectPluralMessage(
  message: LyraPluralMessage,
  locale: string,
  count: number | undefined
): string {
  if (count === undefined) return message.other;
  const tag = pluralLocale(locale);
  if (tag === undefined) return message.other;
  const category = getPluralRules(tag).select(count) as LyraPluralCategory;
  for (const candidate of PLURAL_CATEGORY_FALLBACKS[category] ??
    PLURAL_CATEGORY_FALLBACKS.other) {
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
  defaults?: Readonly<LyraLocaleStrings>
): string {
  let message = safeMessageAt(overrides, key);
  if (message === undefined && typeof fallback === 'string') message = fallback;
  let locale: string | undefined;
  if (message === undefined) {
    locale = resolveLyraLocale(host);
    for (const candidate of localeCandidates(locale)) {
      const registered = safeMessageAt(locales.get(candidate), key);
      if (registered !== undefined) {
        message = registered;
        break;
      }
    }
  }
  message ??= safeMessageAt(defaults, key) ?? key;
  let text: string;
  if (typeof message !== 'string') {
    locale ??= resolveLyraLocale(host);
    text = selectPluralMessage(
      message,
      locale,
      values ? pluralSelector(values) : undefined
    );
  } else {
    text = message;
  }
  if (!values) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    try {
      const value = values[name];
      return typeof value === 'string' || typeof value === 'number'
        ? String(value)
        : match;
    } catch {
      return match;
    }
  });
}

/**
 * Returns the text around one rich localized interpolation. `interpolate` must resolve the
 * message through the normal localization values argument with its supplied marker as the rich
 * value. The marker is selected outside the translated template so repeated and omitted
 * placeholders remain well-defined without parsing a localization token by hand. Sentinel
 * selection is linear in the template with fixed auxiliary bounds; the marker is at most two
 * UTF-16 code units even for an adversarial template containing every one-unit candidate.
 */
export function resolveLocalizedParts(
  template: string,
  interpolate: (marker: string) => string
): string[] {
  const privateUse = new Set<number>();
  for (let index = 0; index < template.length; index += 1) {
    const code = template.charCodeAt(index);
    if (code >= 0xe000 && code <= 0xf8ff) privateUse.add(code);
  }
  let marker = '';
  for (let code = 0xe000; code <= 0xf8ff; code += 1) {
    if (!privateUse.has(code)) {
      marker = String.fromCharCode(code);
      break;
    }
  }
  if (!marker) {
    // An input containing every BMP private-use code point is already at least 6,400 code units.
    // Find any absent code unit in one bounded table; if the input contains all 65,536, choose a
    // missing adjacent pair from the least-frequent first unit. Browser string-size ceilings make
    // a missing follower inevitable, while keeping the sentinel at one or two code units.
    const counts = new Uint32Array(65_536);
    for (let index = 0; index < template.length; index += 1) {
      const code = template.charCodeAt(index);
      counts[code] = (counts[code] ?? 0) + 1;
    }
    let leastCode = 0;
    let leastCount = Number.POSITIVE_INFINITY;
    for (let code = 0; code < counts.length; code += 1) {
      const count = counts[code] ?? 0;
      if (count === 0) {
        marker = String.fromCharCode(code);
        break;
      }
      if (count < leastCount) {
        leastCode = code;
        leastCount = count;
      }
    }
    if (!marker) {
      const followers = new Uint8Array(65_536);
      for (let index = 0; index + 1 < template.length; index += 1) {
        if (template.charCodeAt(index) === leastCode) {
          followers[template.charCodeAt(index + 1)] = 1;
        }
      }
      let follower = 0;
      while (follower < followers.length && followers[follower] !== 0)
        follower += 1;
      // A JavaScript string cannot contain all 2^32 ordered UTF-16 pairs in supported engines.
      marker = String.fromCharCode(
        leastCode,
        follower < followers.length ? follower : leastCode
      );
    }
  }
  return interpolate(marker).split(marker);
}
