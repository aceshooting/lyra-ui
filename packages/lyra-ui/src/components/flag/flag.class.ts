import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { getDisplayNames } from '../../internal/intl-cache.js';
import { styles } from './flag.styles.js';
import { ALPHA2_RE, languageToCountry } from './language-map.js';
import '../skeleton/skeleton.class.js';

export type FlagVariant = 'compact' | 'standard' | 'detailed';
export type FlagUrlResolver = (code: string, options?: { variant?: FlagVariant }) => Promise<string | undefined>;

/**
 * Resolves the optional peer dependency `@aceshooting/lyra-flags`'s `flagUrl`
 * via the given importer. Uncached and
 * dependency-injectable — unlike `loadFlagUrlResolver()` below — so the
 * caught-error warning path is directly testable without needing to
 * actually uninstall the package.
 */
export async function loadFlagUrl(
  importFlags: () => Promise<{ flagUrl: FlagUrlResolver }>,
): Promise<FlagUrlResolver | null> {
  try {
    return (await importFlags()).flagUrl;
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
 * `round`), not just on country/language change, so the instance comes from
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

let flagUrlResolver: Promise<FlagUrlResolver | null> | undefined;
let testFlagUrlResolver: Promise<FlagUrlResolver | null> | undefined;

/** Install an optional flag resolver supplied by a peer-registration entry. */
export function setFlagUrlResolver(value: FlagUrlResolver | Promise<FlagUrlResolver | null> | null): void {
  flagUrlResolver = value === null ? Promise.resolve(null) : Promise.resolve(value);
}

/**
 * Lazily loads the optional peer dependency '@aceshooting/lyra-flags' once per
 * page. Resolves to `null` (with a one-time warning, see `loadFlagUrl()`) if
 * it isn't installed.
 */
function loadFlagUrlResolver(): Promise<FlagUrlResolver | null> {
  if (testFlagUrlResolver) return testFlagUrlResolver;
  if (!flagUrlResolver) {
    // The core component intentionally has no optional-peer import in its
    // module graph. Import `flag-peer.js` when country/language resolution is
    // wanted; otherwise a flag with no pre-resolved `src` simply renders empty.
    flagUrlResolver = Promise.resolve(null);
  }
  return flagUrlResolver;
}

/**
 * @internal Test-only seam: overrides (or, with `undefined`, restores) the module-level cache that
 * `willUpdate()` reads through `loadFlagUrlResolver()`. The real `@aceshooting/lyra-flags` peer's
 * `flagUrl(code)` never actually rejects (unknown codes just resolve `undefined`), so this is the
 * only way to exercise a resolver-function rejection — e.g. a network failure fetching a flag
 * asset — without uninstalling the real package. Not part of the public API; not re-exported from
 * the root barrel.
 */
export function __setFlagUrlResolverForTesting(value: Promise<FlagUrlResolver | null> | undefined): void {
  testFlagUrlResolver = value;
}

/**
 * `<lr-flag>` — a country/language flag.
 *
 * Flag images are shipped by the optional peer package `@aceshooting/lyra-flags`,
 * not bundled into lyra-ui itself, so importing the core library pulls zero flag
 * weight. Give it a `country` (ISO 3166-1 alpha-2) or a `language` tag (mapped to
 * a representative country). While that peer package's `flagUrl()` resolves (or
 * if it isn't installed), the host carries `aria-busy="true"` and a skeleton
 * placeholder renders in its place.
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
 * three fidelity tiers; choose one with `variant`: `"compact"` (a tiny WebP raster for icon-scale
 * use — menu items, language selectors, dense lists), the default `"standard"` (icon-optimized
 * vector for card/row sizes), or `"detailed"` (the pristine full-detail vector for hero-scale
 * display). A no-op for every other code — all tiers resolve to the same file. See `variant`'s own
 * doc.
 *
 * @customElement lr-flag
 * @example <lr-flag country="fr"></lr-flag>
 * @example <lr-flag language="en" label="English"></lr-flag>
 * @example <lr-flag src=${frUrl} label="French"></lr-flag>
 * @example <lr-flag country="es" variant="compact"></lr-flag>
 * @example <lr-flag country="es" variant="detailed"></lr-flag>
 * @csspart image - The underlying <img>.
 * @cssprop [--lr-flag-aspect-ratio=4 / 3] - Rectangular flag aspect ratio.
 * @cssprop [--lr-flag-object-fit=cover] - How the image fits its flag frame.
 * @cssprop --lr-flag-radius - Rectangular flag corner radius.
 */
export class LyraFlag extends LyraElement {
  static styles = [LyraElement.styles, styles];

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

  /** Host `aria-label` forwarded to the internal image. Takes precedence over `label` and the
   *  derived region name; an explicit empty string marks the image decorative. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

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

  /** Render as a circular flag. */
  @property({ type: Boolean, reflect: true }) round = false;

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
   * Has no effect when `src` is set — a pre-resolved URL is used as-is regardless. Takes precedence
   * over the deprecated `detailed` boolean.
   */
  @property() variant?: FlagVariant;

  /**
   * @deprecated Use `variant="detailed"` instead. Kept as an alias for one minor cycle; when
   * `variant` is unset, `detailed` still maps to the detailed tier. Removed in the next major.
   */
  @property({ type: Boolean, reflect: true }) detailed = false;

  /** The effective tier to request: an explicit `variant` wins; otherwise the deprecated
   *  `detailed` boolean is honored; otherwise `"standard"`. */
  private get effectiveVariant(): FlagVariant {
    return this.variant ?? (this.detailed ? 'detailed' : 'standard');
  }

  @state() private resolvedSrc?: string;

  /** True while the lazy-loaded `@aceshooting/lyra-flags` peer resolver is in flight. */
  @state() private loading = true;

  /**
   * Bumped on every `willUpdate` pass; captured by each in-flight resolver
   * `.then()` so a resolution for a `country`/`language` that's since changed
   * (or been cleared) can recognize itself as stale and no-op instead of
   * overwriting newer state.
   */
  private resolveToken = 0;

  private get code(): string | undefined {
    if (this.country) {
      return ALPHA2_RE.test(this.country) ? this.country.toLowerCase() : undefined;
    }
    if (this.language) return languageToCountry(this.language);
    return undefined;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    // `this.hasUpdated` (not just `changed`) forces this body to run once on
    // the very first update even when none of `country`/`language`/`src` is
    // ever set: an unset optional property's first "assignment" is
    // undefined -> undefined (no-op to Lit), so none of `changed.has(...)`
    // would otherwise ever become true for a `<lr-flag>` that never
    // receives one, leaving `loading` stuck at its initial `true` forever.
    if (
      this.hasUpdated &&
      !changed.has('country') &&
      !changed.has('language') &&
      !changed.has('src') &&
      !changed.has('variant') &&
      !changed.has('detailed')
    ) {
      return;
    }
    const token = ++this.resolveToken; // invalidates any in-flight peer resolution either way
    if (this.src) {
      this.resolvedSrc = undefined;
      this.loading = false;
      return;
    }
    const code = this.code;
    if (!code) {
      this.resolvedSrc = undefined;
      this.loading = false;
      return;
    }
    this.loading = true;
    const variant = this.effectiveVariant;
    void loadFlagUrlResolver()
      .then((resolve) => resolve?.(code, variant === 'standard' ? undefined : { variant }))
      .then((url) => {
        if (token !== this.resolveToken) return; // superseded by a later country/language/src change
        this.resolvedSrc = url;
        this.loading = false;
      })
      .catch((err) => {
        if (token !== this.resolveToken) return; // superseded by a later country/language/src change
        console.warn(`<lr-flag> failed to resolve a flag URL for "${code}":`, err);
        this.resolvedSrc = undefined;
        this.loading = false;
      });
  }

  protected updated(): void {
    if (this.loading) this.setAttribute('aria-busy', 'true');
    else this.removeAttribute('aria-busy');
  }

  render(): TemplateResult {
    if (this.loading) return html`<lr-skeleton variant="rect"></lr-skeleton>`;
    const url = this.src ?? this.resolvedSrc;
    if (!url) return html``;
    const code = this.code;
    const alt = this.accessibleLabel ?? this.label ?? (code ? displayNameFor(code, this.effectiveLocale) : '');
    return html`<img part="image" src=${url} alt=${alt} loading="lazy" decoding="async" />`;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-flag': LyraFlag;
  }
}
