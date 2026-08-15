import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { getDisplayNames } from '../../../internal/intl-cache.js';
import type { LyraMessageKey } from '../../../internal/localization.js';
import { hostAriaLabel, srOnly } from '../../../internal/a11y.js';
import { safeMediaSrc } from '../../../internal/safe-url.js';
import { styles } from './flag.styles.js';
import { ALPHA2_RE, languageToCountry } from './language-map.js';
import '../../overlays/skeleton/skeleton.class.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_flagLoadError, LYRA_DEFAULT_loading, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_progress, LYRA_DEFAULT_search, LYRA_DEFAULT_select } from '../../../internal/default-strings.generated.js';
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
  try {
    const resolver = resolverFromModule(await importFlags());
    if (resolver) return resolver;
    throw new TypeError('The flag peer does not expose a callable flagUrl capability.');
  } catch {
    console.warn(
      "<lr-flag> needs the optional peer dependency '@aceshooting/lyra-flags' to render " +
        'flag images — install it with `pnpm add @aceshooting/lyra-flags`.',
    );
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

/** Install an optional flag resolver supplied by a peer-registration entry. */
export function setFlagUrlResolver(
  value: LyraFlagUrlResolver | Promise<LyraFlagUrlResolver | null> | null,
): void {
  flagUrlResolver = value === null ? Promise.resolve(null) : Promise.resolve(value);
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
 * shared light-DOM assertive announcement;
 * an installed resolver returning no URL for an unknown code remains a valid
 * empty result.
 *
 * **Bundle-size note:** `country`/`language` resolve through the peer package's
 * `flagUrl(code)`, which lazily fetches one requested flag at runtime. A
 * bundler may still emit the complete reachable lazy-chunk graph; use a
 * literal asset subpath import when the deployment artifact must be pruned.
 * If you already
 * have a flag's URL at build time (e.g. from your own literal
 * `import frUrl from '@aceshooting/lyra-flags/flags/fr.svg?url'`), pass it as
 * `src` instead to skip the peer-package round trip (and its loading-skeleton
 * flash) entirely.
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
    progress: LYRA_DEFAULT_progress,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, srOnly];

  /** ISO 3166-1 alpha-2 country code (e.g. `fr`, `us`). Takes precedence over `language`. */
  @property() country?: string;

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
      return ALPHA2_RE.test(this.country) ? this.country.toLowerCase() : undefined;
    }
    if (this.language) return languageToCountry(this.language);
    return undefined;
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
    if (!this.isConnected) {
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
    const URLCtor = this.ownerDocument.defaultView?.URL ?? globalThis.URL;
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
  }

  override render(): TemplateResult {
    const state = this.sourceState;
    const request = this.activeSourceRequest;
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
