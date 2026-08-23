import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { getDisplayNames } from '../../../internal/intl-cache.js';
import type { LyraMessageKey } from '../../../internal/localization.js';
import { hostAriaLabel, srOnly } from '../../../internal/a11y.js';
import { safeMediaSrc } from '../../../internal/safe-url.js';
import { styles } from './flag.styles.js';
import { ALPHA2_RE, alpha3ToAlpha2, languageToCountry } from './language-map.js';
import '../../overlays/skeleton/skeleton.class.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_flagLoadError, LYRA_DEFAULT_loading, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_popover, LYRA_DEFAULT_search, LYRA_DEFAULT_select } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type LyraFlagFidelity = 'compact' | 'standard' | 'detailed';
export type LyraFlagShape = 'rect' | 'circle';
export type LyraFlagUrlResolver = (
  code: string,
  options?: { variant?: LyraFlagFidelity },
) => Promise<string | undefined>;
const FLAG_LOAD_ERROR_KEY = 'flagLoadError' as LyraMessageKey;

type LyraFlagSourceState =
  | { readonly status: 'idle'; readonly identity: string }
  | { readonly status: 'loading'; readonly identity: string; readonly url?: string }
  | { readonly status: 'loaded'; readonly identity: string; readonly url: string }
  | { readonly status: 'error'; readonly identity: string };

const FLAG_FIDELITIES = new Set<LyraFlagFidelity>(['compact', 'standard', 'detailed']);
const FLAG_SHAPES = new Set<LyraFlagShape>(['rect', 'circle']);

function normalizeFlagFidelity(value: unknown): LyraFlagFidelity {
  return FLAG_FIDELITIES.has(value as LyraFlagFidelity)
    ? (value as LyraFlagFidelity)
    : 'standard';
}

function normalizeFlagShape(value: unknown): LyraFlagShape {
  return FLAG_SHAPES.has(value as LyraFlagShape) ? (value as LyraFlagShape) : 'rect';
}

function resolverFromModule(module: unknown): LyraFlagUrlResolver | null {
  try {
    if ((typeof module === 'object' && module !== null) || typeof module === 'function') {
      const named = (module as { flagUrl?: unknown }).flagUrl;
      if (typeof named === 'function') return named as LyraFlagUrlResolver;
      const fallback = (module as { default?: unknown }).default ?? module;
      if (typeof fallback === 'function') return fallback as LyraFlagUrlResolver;
      if (typeof fallback === 'object' && fallback !== null) {
        const defaultNamed = (fallback as { flagUrl?: unknown }).flagUrl;
        if (typeof defaultNamed === 'function') return defaultNamed as LyraFlagUrlResolver;
      }
    }
  } catch {
    // Hostile namespace/default getters fail closed through the shared warning below.
  }
  return null;
}

/** The peer could not be imported at all: it is genuinely absent, so say so and how to add it. */
function warnFlagPeerMissing(): void {
  console.warn(
    "<lr-flag> needs the optional peer dependency '@aceshooting/lyra-flags' to render "
      + 'flag images — install it with `pnpm add @aceshooting/lyra-flags`.',
  );
}

/**
 * The peer imported fine but does not carry the capability this entry point needs. That is a
 * VERSION problem, not a missing-dependency problem, and the two used to be reported identically —
 * "install it with `pnpm add @aceshooting/lyra-flags`", advice the reader has already followed,
 * pointing them at the wrong thing entirely. It matters most for `createFlagUrlResolver`, which
 * older peers do not export from the tier-committed subpaths at all, so a consumer who upgrades
 * lyra-ui while pinning the peer lands here by the ordinary route rather than an exotic one.
 */
function warnFlagPeerIncapable(capability: string): void {
  console.warn(
    `<lr-flag> loaded '@aceshooting/lyra-flags' but it does not expose \`${capability}\`. The `
      + 'package is installed, so this is a version mismatch rather than a missing dependency: '
      + 'upgrade it to a release that provides that capability, and check the peer range in '
      + "<lr-flag>'s own package metadata for the floor it expects.",
  );
}

/**
 * Resolves the optional peer dependency `@aceshooting/lyra-flags`'s `flagUrl`
 * via the given importer. Uncached and
 * dependency-injectable — unlike `loadFlagUrlResolver()` below — so the
 * caught-error warning path is directly testable without needing to
 * actually uninstall the package.
 */
export async function loadFlagUrl(
  importFlags: () => Promise<unknown>,
): Promise<LyraFlagUrlResolver | null> {
  let peerModule: unknown;
  try {
    peerModule = await importFlags();
  } catch {
    warnFlagPeerMissing();
    return null;
  }
  try {
    const resolver = resolverFromModule(peerModule);
    if (resolver) return resolver;
  } catch {
    // Hostile namespace/default getters fall through to the capability warning below.
  }
  warnFlagPeerIncapable('flagUrl');
  return null;
}

function resolverFactoryFromModule(module: unknown): (() => LyraFlagUrlResolver) | null {
  try {
    if ((typeof module === 'object' && module !== null) || typeof module === 'function') {
      const named = (module as { createFlagUrlResolver?: unknown }).createFlagUrlResolver;
      if (typeof named === 'function') return named as () => LyraFlagUrlResolver;
      const fallback = (module as { default?: unknown }).default ?? module;
      if (typeof fallback === 'object' && fallback !== null) {
        const defaultNamed = (fallback as { createFlagUrlResolver?: unknown }).createFlagUrlResolver;
        if (typeof defaultNamed === 'function') return defaultNamed as () => LyraFlagUrlResolver;
      }
    }
  } catch {
    // Hostile namespace/default getters fail closed through the shared warning below.
  }
  return null;
}

/**
 * Resolves `@aceshooting/lyra-flags`'s `createFlagUrlResolver` via the given importer and calls
 * it once, the bulk-resolution twin of `loadFlagUrl()` above. Backs `flag-peer-bulk.js` — the
 * opt-in alternative to `flag-peer.js` for a page that renders most/all flags at once, where one
 * shared `flagUrls()` fetch beats resolving every `<lr-flag>` instance independently. Same
 * dependency-injectable, uncached shape as `loadFlagUrl()`, for the same testability reason.
 */
export async function loadBulkFlagUrl(
  importFlags: () => Promise<unknown>,
): Promise<LyraFlagUrlResolver | null> {
  let peerModule: unknown;
  try {
    peerModule = await importFlags();
  } catch {
    warnFlagPeerMissing();
    return null;
  }
  const factory = resolverFactoryFromModule(peerModule);
  if (!factory) {
    warnFlagPeerIncapable('createFlagUrlResolver');
    return null;
  }
  try {
    return factory();
  } catch {
    warnFlagPeerIncapable('createFlagUrlResolver');
    return null;
  }
}

/**
 * Resolves an ISO 3166-1 alpha-2 region code to a human-readable, localized
 * display name (e.g. `'FR'` -> `'France'`) via `Intl.DisplayNames`, for use as
 * the default accessible name (`alt`) instead of a bare code read
 * letter-by-letter by most screen readers. Falls back to the uppercase code
 * itself if `Intl.DisplayNames` throws (unrecognized region) or isn't
 * available in the current runtime. `displayNameFor()` runs on every
 * `render()` pass for a flag without an explicit `label` (e.g. toggling
 * `shape`), not just on country/language change, so the instance comes from
 * the shared per-locale `Intl` cache rather than a fresh ICU locale-data
 * lookup each time.
 */
function displayNameFor(code: string, locale: string): string {
  try {
    return getDisplayNames(locale, { type: 'region' }).of(code.toUpperCase()) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

let flagUrlResolver: Promise<LyraFlagUrlResolver | null> | undefined;
let flagResolverGeneration = 0;
const flagResolverSubscribers = new Set<(generation: number) => void>();
/**
 * One-shot guard for `warnMissingFlagResolver()`. A table of 200 flags shares one diagnostic
 * rather than emitting 200 identical lines. Re-armed by `setFlagUrlResolver()`, so a later
 * registration generation that is still resolver-less warns again.
 */
let warnedMissingFlagResolver = false;

/**
 * Explains the one failure this component otherwise reports only as a visible
 * `[part="error"]`: `country`/`language` was set, but nothing ever registered a resolver, so
 * there is no way to turn a code into a URL. The core component deliberately keeps the optional
 * peer out of its module graph (see `loadFlagUrlResolver()`), which means this is a *setup*
 * omission a developer can fix in one import — but only if they are told about it. Distinct from
 * `loadFlagUrl()`'s warning, which fires when the peer entry WAS imported and the peer package
 * itself is missing.
 */
function warnMissingFlagResolver(code: string): void {
  if (warnedMissingFlagResolver) return;
  warnedMissingFlagResolver = true;
  console.warn(
    `<lr-flag> could not resolve the code "${code}" because no flag resolver is registered. `
      + `Import the optional peer entry once at startup -- import `
      + `'@aceshooting/lyra-ui/components/media/flag/flag-peer.js' -- and install `
      + `'@aceshooting/lyra-flags', or pass an already-resolved URL through 'src' instead.`,
  );
}

/** Install an optional flag resolver supplied by a peer-registration entry. */
export function setFlagUrlResolver(
  value: LyraFlagUrlResolver | Promise<LyraFlagUrlResolver | null> | null,
): void {
  flagUrlResolver = value === null ? Promise.resolve(null) : Promise.resolve(value);
  warnedMissingFlagResolver = false;
  flagResolverGeneration++;
  for (const subscriber of [...flagResolverSubscribers]) subscriber(flagResolverGeneration);
}

/**
 * Lazily loads the optional peer dependency '@aceshooting/lyra-flags' once per
 * page. Resolves to `null` (with a one-time warning, see `loadFlagUrl()`) if
 * it isn't installed.
 */
function loadFlagUrlResolver(): Promise<LyraFlagUrlResolver | null> {
  if (!flagUrlResolver) {
    // The core component intentionally has no optional-peer import in its
    // module graph. Import `flag-peer.js` when country/language resolution is
    // wanted; otherwise a flag with no pre-resolved `src` simply renders empty.
    flagUrlResolver = Promise.resolve(null);
  }
  return flagUrlResolver;
}

/**
 * `<lr-flag>` — a country/language flag.
 *
 * Flag images are shipped by the optional peer package `@aceshooting/lyra-flags`,
 * not bundled into lyra-ui itself, so importing the core library pulls zero flag
 * weight. Give it a `country` (ISO 3166-1 alpha-2) or a `language` tag (mapped to
 * a representative country). While that peer package's `flagUrl()` resolves,
 * the host carries `aria-busy="true"`; a decorative skeleton and ordinary, non-live localized
 * loading text render in its place. A missing or failed peer resolver fails closed with a localized visible error and a
 * shared light-DOM assertive announcement, plus a one-time `console.warn` naming the code and the
 * `flag-peer.js` import that registers a resolver -- the visible error alone cannot tell a
 * developer that the fix is a missing import rather than missing flag data;
 * an installed resolver returning no URL for an unknown code remains a valid
 * empty result.
 *
 * **Bundle-size note:** `country`/`language` resolve through the peer package's
 * `flagUrl(code)`, which lazily fetches one requested flag at runtime. A
 * bundler may still emit the complete reachable lazy-chunk graph; use a
 * literal asset subpath import when the deployment artifact must be pruned.
 * If every `<lr-flag>` in your app is pinned to the same `fidelity` (no
 * per-instance switching), register `@aceshooting/lyra-flags/standard`/`/compact`/`/detailed` with
 * `setFlagUrlResolver()` instead of importing `flag-peer.js` (which always registers the full
 * three-tier resolver) — the tier-specific entry excludes the other two tiers' generated loader
 * maps from the reachable graph; see that package's README for the exact shape.
 * If you already
 * have a flag's URL at build time (e.g. from your own literal
 * `import frUrl from '@aceshooting/lyra-flags/flags/fr.svg?url'`), pass it as
 * `src` instead to skip the peer-package round trip (and its loading-skeleton
 * flash) entirely.
 *
 * **Rendering many flags at once** (a country table, a picker listing every locale): resolve every
 * code up front with `@aceshooting/lyra-flags`'s `flagUrls()` (one call, returns `{code: url}` for
 * all 249 flags) and pass results through `src`, instead of letting each `<lr-flag>` instance
 * independently call `flagUrl()` — this skips one peer-resolution round trip per instance. Image
 * fetches themselves are unaffected either way (each flag is a distinct asset; there is no sprite).
 * Or import `flag-peer-bulk.js` instead of `flag-peer.js` (never both) to get this automatically,
 * registering a resolver backed by one shared `flagUrls()` call — worthwhile only when the page
 * renders most/all flags; a page with a handful pays an unneeded 249-entry fetch.
 * When that page ALSO leaves every `<lr-flag>` on the default `fidelity="standard"`, import
 * `flag-peer-bulk-standard.js` instead: it registers the same bulk resolver through the peer
 * package's tier-committed `@aceshooting/lyra-flags/standard` entry, so the detailed and compact
 * tiers' lazy-chunk graphs never become reachable (measured at +15.8MB of emitted assets on a real
 * production build with a 156-country flag column). It is committed to one tier, so
 * `fidelity="compact"/"detailed"` on an individual element resolves to that code's standard asset
 * — a silent no-op, not an error; use `flag-peer-bulk.js` when per-instance fidelity must be
 * honoured.
 *
 * **Sizing:** the host has no intrinsic `width` — it sizes from `font-size` (`block-size: 1em`,
 * `inline-size` derived from `--lr-flag-aspect-ratio` via CSS `aspect-ratio`), so `<lr-flag>` scales
 * naturally with surrounding text (e.g. `style="font-size: 2rem"`). Do not set `width`/`inline-size`
 * directly: making both axes definite defeats `aspect-ratio` (which only participates when at most
 * one axis is definite per the CSS sizing spec), squashing the image instead of scaling it.
 *
 * The ~65 flags whose design includes a detailed coat of arms/seal/emblem (e.g. `es`, `pt`) ship
 * three fidelity tiers; choose one with `fidelity`: `"compact"` (a tiny WebP raster for icon-scale
 * use — menu items, language selectors, dense lists), the default `"standard"` (icon-optimized
 * vector for card/row sizes), or `"detailed"` (the pristine full-detail vector for hero-scale
 * display). A no-op for every other code — all tiers resolve to the same file. See `fidelity`'s own
 * doc.
 *
 * @customElement lr-flag
 * @example <lr-flag country="fr"></lr-flag>
 * @example <lr-flag language="en" label="English"></lr-flag>
 * @example <lr-flag src=${frUrl} label="French"></lr-flag>
 * @example <lr-flag country="es" fidelity="compact"></lr-flag>
 * @example <lr-flag country="es" fidelity="detailed" shape="circle"></lr-flag>
 * @csspart image - The underlying <img>.
 * @slot fallback - Rendered in place of the flag when `country`/`language` cannot resolve to a
 *   current flag (an unassigned, historical, or malformed code). Wins over the `fallback` property.
 *   Distinct from the peer-resolver failure that produces `[part="error"]`: an unresolvable code is
 *   data, not a defect.
 * @csspart fallback-image - The `fallback` property's placeholder image, when no `fallback` slot
 *   content is supplied.
 * @csspart error - Ordinary localized visible error rendered when the optional peer resolver is
 *   unavailable or fails; each fresh resolution failure appends the same localized message to the
 *   shared light-DOM assertive announcement sink.
 * @cssprop [--lr-flag-aspect-ratio=4 / 3] - Rectangular flag aspect ratio.
 * @cssprop [--lr-flag-object-fit=cover] - How the image fits its flag frame.
 * @cssprop --lr-flag-radius - Rectangular flag corner radius.
 * @status stable
 * @since 4.0.0
 */
export class LyraFlag extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    flagLoadError: LYRA_DEFAULT_flagLoadError,
    loading: LYRA_DEFAULT_loading,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    popover: LYRA_DEFAULT_popover,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, srOnly];

  /** ISO 3166-1 alpha-2 country code (e.g. `fr`, `us`). Takes precedence over `language`. */
  @property() country?: string;

  /**
   * Placeholder image URL rendered in place of a flag when the code cannot resolve — a historical
   * or defunct state in a longitudinal dataset, say. Unset renders the `fallback` slot's content
   * instead, or nothing at all, so the element still occupies its normal footprint in a table or
   * card grid rather than showing error wording.
   */
  @property() fallback?: string;

  /** BCP-47-ish language tag (e.g. `en`, `en-US`) resolved to a country flag. */
  @property() language?: string;

  /**
   * A pre-resolved flag image URL — takes precedence over `country`/`language`
   * and skips the `@aceshooting/lyra-flags` peer-package lookup (and its
   * loading-skeleton round trip) entirely. See the class doc: mainly useful to
   * avoid even the small per-flag async hop when you already have the URL at
   * build time. `label` is effectively required alongside `src` — there's no
   * `country`/`language` to derive a fallback `alt` from.
   */
  @property() src?: string;

  /**
   * Accessible label / `alt` text used when `aria-label` is unset. Defaults to a localized, human-readable
   * region name derived from the *resolved country code* via
   * `Intl.DisplayNames` (e.g. `"United Kingdom"`) — for a `language`-only
   * element (e.g. `language="en"`) that's the mapped country's display name,
   * not the language tag itself. Falls back to the bare uppercase code if
   * `Intl.DisplayNames` can't resolve it. Has no default when only `src` is
   * given (no country/language to derive one from).
   */
  @property() label?: string;

  private _shape: LyraFlagShape = 'rect';

  /** Flag crop geometry. Invalid runtime values normalize to `rect`. */
  @property({ reflect: true })
  get shape(): LyraFlagShape {
    return this._shape;
  }
  set shape(value: LyraFlagShape) {
    const old = this._shape;
    this._shape = normalizeFlagShape(value);
    this.requestUpdate('shape', old);
  }

  /**
   * Which fidelity tier to load, for the ~65 `country`/`language` codes whose source art embeds a
   * coat of arms/seal/emblem (for every other code all tiers are the same file, so this is a safe
   * no-op):
   * - `"compact"` — a tiny WebP raster for icon-scale use (menu items, language selectors, dense
   *   lists; ~12–28px), where the emblem detail is invisible anyway.
   * - `"standard"` (default) — the icon-optimized vector, for card/row sizes (~28–96px).
   * - `"detailed"` — the pristine, full-detail vector, for rendering larger than icon scale (e.g.
   *   a hero display) where the extra illustrative detail is actually visible.
   *
   * Has no effect when `src` is set — a pre-resolved URL is used as-is regardless.
   */
  private _fidelity: LyraFlagFidelity = 'standard';

  @property({ reflect: true })
  get fidelity(): LyraFlagFidelity {
    return this._fidelity;
  }
  set fidelity(value: LyraFlagFidelity) {
    const old = this._fidelity;
    this._fidelity = normalizeFlagFidelity(value);
    this.requestUpdate('fidelity', old);
  }

  /** The normalized tier sent to the optional peer resolver. */
  private get effectiveFidelity(): LyraFlagFidelity {
    return normalizeFlagFidelity(this.fidelity);
  }

  @state() private sourceState: LyraFlagSourceState = Object.freeze({
    status: 'idle',
    identity: 'idle',
  });
  @state() private resolverGeneration = flagResolverGeneration;
  private errorAnnouncementSink?: AnnouncementSink;
  private sourceRestartPending = true;
  private activeSourceRequest = 0;

  /**
   * Bumped on every `willUpdate` pass; captured by each in-flight resolver
   * `.then()` so a resolution for a `country`/`language` that's since changed
   * (or been cleared) can recognize itself as stale and no-op instead of
   * overwriting newer state.
   */
  private resolveToken = 0;

  private readonly onResolverGeneration = (generation: number): void => {
    if (!this.isConnected || generation === this.resolverGeneration) return;
    this.resolverGeneration = generation;
  };

  /** True while the effective source is resolving or its native image is loading. */
  get loading(): boolean {
    return this.sourceState.status === 'loading';
  }

  private get code(): string | undefined {
    if (this.country) {
      // Length alone disambiguates the two ISO 3166-1 code spaces, so accepting alpha-3 needs no
      // new API and cannot be ambiguous: a 2-letter value is alpha-2, a 3-letter value is alpha-3.
      // Statistical sources (World Bank, UN, IMF) key on alpha-3, so this removes the ~249-row
      // conversion table every such consumer otherwise maintains.
      if (ALPHA2_RE.test(this.country)) return this.country.toLowerCase();
      return alpha3ToAlpha2(this.country);
    }
    if (this.language) return languageToCountry(this.language);
    return undefined;
  }

  /**
   * True when the component has a `country`/`language` to resolve but no flag can be produced for
   * it — an unassigned, historical, or malformed code. Distinct from the peer-resolver failure that
   * drives `data-error`: a dissolved federation in a longitudinal dataset is *data*, not a bug, and
   * a consumer needs to style the two apart.
   */
  private get unresolved(): boolean {
    if (this.src) return false;
    if (!this.country && !this.language) return false;
    return this.code === undefined;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.sourceRestartPending = true;
    flagResolverSubscribers.add(this.onResolverGeneration);
    this.syncErrorAnnouncementSink();
    if (this.resolverGeneration !== flagResolverGeneration) {
      this.resolverGeneration = flagResolverGeneration;
    }
    this.requestUpdate();
  }

  override disconnectedCallback(): void {
    this.resolveToken++;
    this.sourceRestartPending = true;
    flagResolverSubscribers.delete(this.onResolverGeneration);
    this.releaseErrorAnnouncementSink();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.resolveToken++;
    this.sourceRestartPending = true;
    this.releaseErrorAnnouncementSink();
    this.syncErrorAnnouncementSink();
    this.requestUpdate();
  }

  private syncErrorAnnouncementSink(): void {
    if (!this.isConnected) return;
    if (this.errorAnnouncementSink?.element.ownerDocument === this.ownerDocument) return;
    this.releaseErrorAnnouncementSink();
    this.errorAnnouncementSink = acquireAnnouncementSink('assertive', {
      document: this.ownerDocument,
      source: this,
    });
  }

  private releaseErrorAnnouncementSink(): void {
    this.errorAnnouncementSink?.release();
    this.errorAnnouncementSink = undefined;
  }

  private announceLoadError(): void {
    this.errorAnnouncementSink?.announce(this.localize(FLAG_LOAD_ERROR_KEY));
  }

  private setSourceState(state: LyraFlagSourceState, announceError = false): void {
    this.sourceState = Object.freeze(state);
    this.toggleAttribute('data-error', state.status === 'error');
    // Reflected separately from data-error so a consumer can style "no flag exists for this code"
    // (a historical state in a dataset) differently from "the resolver failed" (a real fault).
    this.toggleAttribute('data-unresolved', this.unresolved);
    this.setAttribute('aria-busy', String(state.status === 'loading'));
    if (announceError && this.isConnected) this.announceLoadError();
  }

  private failSource(identity: string, announce = true): void {
    this.setSourceState({ status: 'error', identity }, announce);
  }

  private onImageLoad(event: Event, identity: string, url: string, request: number): void {
    const image = event.currentTarget as HTMLImageElement | null;
    if (
      !this.isConnected
      || request !== this.activeSourceRequest
      || !image
      || image !== this.renderRoot.querySelector('[part="image"]')
      || this.sourceState.status !== 'loading'
      || this.sourceState.identity !== identity
      || this.sourceState.url !== url
    ) return;
    this.setSourceState({ status: 'loaded', identity, url });
  }

  private onImageError(event: Event, identity: string, request: number): void {
    const image = event.currentTarget as HTMLImageElement | null;
    if (
      !this.isConnected
      || request !== this.activeSourceRequest
      || !image
      || image !== this.renderRoot.querySelector('[part="image"]')
      || this.sourceState.status !== 'loading'
      || this.sourceState.identity !== identity
    ) return;
    this.failSource(identity);
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    const sourceChanged =
      changed.has('country')
      || changed.has('language')
      || changed.has('src')
      || changed.has('fidelity')
      || changed.has('resolverGeneration');
    // `isConnected` has no meaningful answer during SSR generation (no live document to be
    // connected to) -- skipping source resolution there, the way a real disconnected browser
    // element does, would make the server-rendered idle/empty template permanently disagree with
    // the connected browser's first hydration render, which does resolve a source immediately.
    if (typeof Node !== 'undefined' && !this.isConnected) {
      if (sourceChanged) {
        this.resolveToken++;
        this.sourceRestartPending = true;
      }
      return;
    }
    if (
      this.hasUpdated &&
      !sourceChanged &&
      !this.sourceRestartPending
    ) {
      return;
    }
    const connectionBaseline = this.sourceRestartPending;
    this.sourceRestartPending = false;
    const token = ++this.resolveToken;
    const request = ++this.activeSourceRequest;
    const URLCtor = this.ownerDocument?.defaultView?.URL ?? globalThis.URL;
    const directValue = typeof this.src === 'string' ? this.src.trim() : '';
    if (directValue) {
      const identity = `direct:${directValue}`;
      const url = safeMediaSrc(directValue, URLCtor);
      if (!url) {
        this.failSource(identity, !connectionBaseline);
        return;
      }
      this.setSourceState({ status: 'loading', identity, url });
      return;
    }
    const code = this.code;
    if (!code) {
      this.setSourceState({ status: 'idle', identity: 'idle' });
      return;
    }
    const fidelity = this.effectiveFidelity;
    const identity = `peer:${code}:${fidelity}:${this.resolverGeneration}`;
    this.setSourceState({ status: 'loading', identity });
    void loadFlagUrlResolver()
      .then(async (resolve) => {
        if (token !== this.resolveToken || request !== this.activeSourceRequest || !this.isConnected) return;
        if (typeof resolve !== 'function') {
          warnMissingFlagResolver(code);
          this.failSource(identity);
          return;
        }
        const candidate = await resolve(
          code,
          fidelity === 'standard' ? undefined : { variant: fidelity },
        );
        if (token !== this.resolveToken || request !== this.activeSourceRequest || !this.isConnected) return;
        if (candidate === undefined) {
          this.setSourceState({ status: 'idle', identity });
          return;
        }
        const url = safeMediaSrc(candidate, URLCtor);
        if (!url) {
          this.failSource(identity);
          return;
        }
        this.setSourceState({ status: 'loading', identity, url });
      })
      .catch((err) => {
        if (token !== this.resolveToken || request !== this.activeSourceRequest || !this.isConnected) return;
        console.warn(`<lr-flag> failed to resolve a flag URL for "${code}":`, err);
        this.failSource(identity);
      });
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.setAttribute('aria-busy', String(this.sourceState.status === 'loading'));
    // Also toggled here, not only in setSourceState(): an unresolvable code never starts a
    // resolution, so setSourceState() may never run for exactly the case this reflects.
    this.toggleAttribute('data-unresolved', this.unresolved);
  }

  override render(): TemplateResult {
    const state = this.sourceState;
    const request = this.activeSourceRequest;
    // Checked before the error branch: an unresolvable code is data, not a failure, so it must not
    // fall through to localized error wording that reads to a user as a bug.
    if (this.unresolved) {
      const fallbackUrl = this.fallback
        ? safeMediaSrc(this.fallback, this.ownerDocument?.defaultView?.URL ?? globalThis.URL)
        : null;
      const fallbackAlt = hostAriaLabel(this) ?? this.label ?? '';
      return html`<slot name="fallback"
        >${fallbackUrl
          ? html`<img part="fallback-image" src=${fallbackUrl} alt=${fallbackAlt} />`
          : nothing}</slot
      >`;
    }
    if (state.status === 'error') {
      return html`<span part="error">${this.localize(FLAG_LOAD_ERROR_KEY)}</span>`;
    }
    const url = state.status === 'loading' || state.status === 'loaded' ? state.url : undefined;
    if (!url && state.status !== 'loading') return html``;
    const code = this.code;
    const alt = hostAriaLabel(this)
      ?? this.label
      ?? (code ? displayNameFor(code, this.effectiveLocale) : '');
    return html`
      ${state.status === 'loading'
        ? html`
            <span class="sr-only">${this.localize('loading')}</span>
            <lr-skeleton shape="rect" .announce=${false}></lr-skeleton>
          `
        : null}
      ${url
        ? keyed(
            `${state.identity}:${request}`,
            html`<img
              part="image"
              src=${url}
              alt=${alt}
              ?hidden=${state.status !== 'loaded'}
              loading="lazy"
              decoding="async"
              @load=${(event: Event) => this.onImageLoad(event, state.identity, url, request)}
              @error=${(event: Event) => this.onImageError(event, state.identity, request)}
            />`,
          )
        : null}
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-flag': LyraFlag;
  }
}
