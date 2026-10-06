type LitWarningGlobal = { litIssuedWarnings?: Set<string> };

/** Piggybacks on Lit's own dev-mode signal (`@lit/reactive-element`'s `development` build sets
 *  this global when a consumer's bundler resolves Lit into dev mode). This implementation is
 *  selected only by the package's development condition. */
export function litDevWarnings(): Set<string> | undefined {
  return (globalThis as LitWarningGlobal).litIssuedWarnings;
}

/** Emits a development diagnostic when Lit's development signal is present. Callers retain
 * their own bounded deduplication state when warnings belong to one document generation. */
export function devWarn(message: string): void {
  if (litDevWarnings()) console.warn(message);
}

/**
 * Dev-mode-only: emits `message` at most once per `key` for the page. Shares the exact gate and
 * dedupe store `warnUnknownAttributes` uses below, so a diagnostic added by a component behaves
 * like the attribute diagnostic: silent in production, silent when Lit itself is not in dev mode,
 * and never repeated for the same key however many instances exist.
 */
export function devWarnOnce(key: string, message: string): void {
  const warnings = litDevWarnings();
  if (!warnings) return;
  if (warnings.has(key)) return;
  warnings.add(key);
  console.warn(message);
}

/**
 * Dev-mode-only, once per (locale, key): reports that a non-English locale has no registered catalog
 * message for `key`, so resolution falls through to the English default (or the bare key). English
 * itself resolves through its defaults, so an `en`/`en-*` locale never warns. The message and its
 * construction live only in this development entry; production bundles carry a no-op.
 */
export function warnLocaleFallback(locale: string, key: string): void {
  const warnings = litDevWarnings();
  if (!warnings) return;
  const lower = locale.toLowerCase();
  if (lower === 'en' || lower.startsWith('en-')) return;
  const warningKey = `lyra-locale-fallback:${locale}:${key}`;
  if (warnings.has(warningKey)) return;
  warnings.add(warningKey);
  console.warn(
    `Lyra localization: no "${key}" message registered for locale "${locale}"; falling back to ` +
      'the English default. Register it with registerLyraLocale(), or accept the fallback ' +
      'intentionally for a still-partial catalog.'
  );
}

/**
 * Kinds of deprecated usage a component or module can observe at runtime. Each is a `kind` of the tag-scoped
 * or module records in the package's deprecation metadata (`scripts/fixtures/component-metadata.json`), so a
 * warning key names exactly one record. The styling kinds (`part`, `css-property`, `css-state`) are
 * absent because a component cannot observe a stylesheet's use of them; `slot`/`slot-content`
 * records are absent because detecting slotted content would ship in every production bundle of
 * the component. Those deprecations are recorded and documented but never warn.
 */
export type LyraDeprecatedUsageKind =
  | 'component'
  | 'property'
  | 'attribute'
  | 'method'
  | 'event'
  | 'function';

/**
 * The page-wide dedupe key for one deprecated usage: `lyra-deprecated:<tag>:<kind>:<name>`.
 * `tagName` is the live element name, so a custom prefix
 * or a consumer subclass registered under its own tag gets its own key.
 */
export function deprecationWarningKey(
  tagName: string,
  kind: LyraDeprecatedUsageKind,
  name: string
): string {
  return `lyra-deprecated:${tagName}:${kind}:${name}`;
}

/**
 * Dev-mode-only: reports that `host` was used through a deprecated API, once per page for each
 * (tag, `kind`, `name`) -- the same gate and dedupe store as {@link devWarnOnce}, so it is silent in
 * production and whenever Lit itself is not in development mode.
 *
 * `kind` and `name` are the deprecation record's own `kind` and `name`, so the key {@link deprecationWarningKey} derives maps to exactly one record, and the message
 * names the API in that same vocabulary: `<lr-markdown>: deprecated property 'codeBlockChrome'; use
 * code-block-header.`. `replacement` is the record's replacement, written tersely the way an
 * author uses it (`attr="*"`, `code-block-header`, `<lr-geojson-viewer>`) — every string ships in each
 * bundle that composes the component. The message
 * names no version -- removal floors live in the deprecation metadata -- and, as a developer
 * diagnostic, is not localized.
 *
 * Call it only at an exact, cheap usage signal: a deprecated property or attribute being set
 * (`willUpdate`, guarded on the truthy value so a default never warns), a deprecated tag
 * connecting, a deprecated alias event actually vetoing, or a deprecated function call. A module
 * passes its package-relative specifier instead of an element.
 * Never add a style probe or a listener hook just to detect usage. Tests seed or capture the
 * warning with `test/expected-deprecations.ts`.
 */
export function warnDeprecatedUsage(
  host: Element | string,
  kind: LyraDeprecatedUsageKind,
  name: string,
  replacement: string
): void {
  const tagName = typeof host === 'string' ? host : host.localName;
  const subject = typeof host === 'string' ? host : `<${tagName}>`;
  // The key is built inline (not through deprecationWarningKey) so bundles never carry both.
  devWarnOnce(
    `lyra-deprecated:${tagName}:${kind}:${name}`,
    `${subject}: deprecated ${kind} '${name}'; use ${replacement}.`
  );
}

