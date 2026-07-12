import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { styles } from './flag.styles.js';
import { ALPHA2_RE, languageToCountry } from './language-map.js';
import '../skeleton/skeleton.js';

type FlagUrlResolver = (code: string) => Promise<string | undefined>;

/**
 * Resolves the optional peer dependency `@aceshooting/lyra-flags`'s `flagUrl`
 * via the given importer (a real dynamic import by default). Uncached and
 * dependency-injectable — unlike `loadFlagUrlResolver()` below — so the
 * caught-error warning path is directly testable without needing to
 * actually uninstall the package.
 */
export async function loadFlagUrl(
  importFlags: () => Promise<{ flagUrl: FlagUrlResolver }> = () => import('@aceshooting/lyra-flags'),
): Promise<FlagUrlResolver | null> {
  try {
    return (await importFlags()).flagUrl;
  } catch {
    console.warn(
      "<lyra-flag> needs the optional peer dependency '@aceshooting/lyra-flags' to render " +
        'flag images — install it with `pnpm add @aceshooting/lyra-flags`.',
    );
    return null;
  }
}

let flagUrlResolver: Promise<FlagUrlResolver | null> | undefined;

/**
 * Lazily loads the optional peer dependency '@aceshooting/lyra-flags' once per
 * page. Resolves to `null` (with a one-time warning, see `loadFlagUrl()`) if
 * it isn't installed.
 */
function loadFlagUrlResolver(): Promise<FlagUrlResolver | null> {
  if (!flagUrlResolver) {
    flagUrlResolver = loadFlagUrl();
  }
  return flagUrlResolver;
}

/**
 * `<lyra-flag>` — a country/language flag.
 *
 * Flag images are shipped by the optional peer package `@aceshooting/lyra-flags`,
 * not bundled into lyra-ui itself, so importing the core library pulls zero flag
 * weight. Give it a `country` (ISO 3166-1 alpha-2) or a `language` tag (mapped to
 * a representative country). While that peer package's `flagUrl()` resolves (or
 * if it isn't installed), the host carries `aria-busy="true"` and a skeleton
 * placeholder renders in its place.
 *
 * **Bundle-size note:** `country`/`language` resolve through the peer package's
 * `flagUrl(code)`, which is itself genuinely code-split per flag (see that
 * package's docs) — using `<lyra-flag country="fr">` anywhere in an app ships
 * only the flags actually requested at runtime, not all 249. If you already
 * have a flag's URL at build time (e.g. from your own literal
 * `import frUrl from '@aceshooting/lyra-flags/flags/fr.svg?url'`), pass it as
 * `src` instead to skip the peer-package round trip (and its loading-skeleton
 * flash) entirely.
 *
 * @customElement lyra-flag
 * @example <lyra-flag country="fr"></lyra-flag>
 * @example <lyra-flag language="en" label="English"></lyra-flag>
 * @example <lyra-flag src=${frUrl} label="French"></lyra-flag>
 * @csspart image - The underlying <img>.
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

  /**
   * Accessible label / `alt` text. Defaults to the uppercase *resolved country
   * code* — for a `language`-only element (e.g. `language="en"`) that's the
   * mapped country (`"GB"`), not the language tag itself (`"EN"`). Has no
   * default when only `src` is given (no country/language to derive one from).
   */
  @property() label?: string;

  /** Render as a circular flag. */
  @property({ type: Boolean, reflect: true }) round = false;

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
    // would otherwise ever become true for a `<lyra-flag>` that never
    // receives one, leaving `loading` stuck at its initial `true` forever.
    if (this.hasUpdated && !changed.has('country') && !changed.has('language') && !changed.has('src')) return;
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
    void loadFlagUrlResolver()
      .then((resolve) => resolve?.(code))
      .then((url) => {
        if (token !== this.resolveToken) return; // superseded by a later country/language/src change
        this.resolvedSrc = url;
        this.loading = false;
      });
  }

  protected updated(): void {
    if (this.loading) this.setAttribute('aria-busy', 'true');
    else this.removeAttribute('aria-busy');
  }

  render(): TemplateResult {
    if (this.loading) return html`<lyra-skeleton variant="rect"></lyra-skeleton>`;
    const url = this.src ?? this.resolvedSrc;
    if (!url) return html``;
    const alt = this.label ?? (this.code ?? '').toUpperCase();
    return html`<img part="image" src=${url} alt=${alt} loading="lazy" decoding="async" />`;
  }
}

defineElement('flag', LyraFlag);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-flag': LyraFlag;
  }
}
