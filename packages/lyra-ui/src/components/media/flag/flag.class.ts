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
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { devWarnOnce } from '../../../internal/dev-mode-attribute-warning.js';
import { getFlagResolverGeneration, subscribeFlagResolver, loadFlagUrlResolver, warnMissingFlagResolver } from './flag-url-resolver.js';

export type { LyraFlagFidelity, LyraFlagShape, LyraFlagUrlResolver } from './flag-url-resolver.js';
import type { LyraFlagFidelity, LyraFlagShape } from './flag-url-resolver.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_flagLoadError, LYRA_DEFAULT_loading, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_search, LYRA_DEFAULT_select } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export { loadFlagUrl, loadBulkFlagUrl, setFlagUrlResolver } from './flag-url-resolver.js';
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
 *   content is supplied. It uses the same frame sizing, object fit, and shape clipping as `image`.
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
  @state() private resolverGeneration = getFlagResolverGeneration();
  private stopFlagResolverSubscription?: () => void;
  private readonly announcements = new AnnouncementSinkController(this);
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
    this.stopFlagResolverSubscription = subscribeFlagResolver(this.onResolverGeneration);
    if (this.resolverGeneration !== getFlagResolverGeneration()) {
      this.resolverGeneration = getFlagResolverGeneration();
    }
    this.requestUpdate();
  }

  override disconnectedCallback(): void {
    this.resolveToken++;
    this.sourceRestartPending = true;
    this.stopFlagResolverSubscription?.();
    this.stopFlagResolverSubscription = undefined;
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.resolveToken++;
    this.sourceRestartPending = true;
    this.announcements.adopted();
    this.requestUpdate();
  }

  private announceLoadError(): void {
    this.announcements.announceAssertive(this.localize(FLAG_LOAD_ERROR_KEY));
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
    // Only a flag that starts a load can fail; mount the region before any failure text.
    if (directValue || this.code) this.announcements.current('assertive');
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
        devWarnOnce('lyra-flag-resolve-failed', `<lr-flag> failed to resolve a flag URL for "${code}": ${err}`);
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
