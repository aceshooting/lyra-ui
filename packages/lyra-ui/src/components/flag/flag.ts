import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { styles } from './flag.styles.js';
import { languageToCountry } from './language-map.js';
import '../skeleton/skeleton.js';

type FlagUrlResolver = (code: string) => string;

let flagUrlResolver: Promise<FlagUrlResolver | null> | undefined;

/**
 * Lazily loads the optional peer dependency '@aceshooting/lyra-flags' once per
 * page. Resolves to `null` (with a one-time warning) if it isn't installed.
 */
function loadFlagUrlResolver(): Promise<FlagUrlResolver | null> {
  if (!flagUrlResolver) {
    flagUrlResolver = import('@aceshooting/lyra-flags')
      .then((mod) => mod.flagUrl)
      .catch(() => {
        console.warn(
          "<lyra-flag> needs the optional peer dependency '@aceshooting/lyra-flags' to render " +
            'flag images — install it with `pnpm add @aceshooting/lyra-flags`.',
        );
        return null;
      });
  }
  return flagUrlResolver;
}

/**
 * `<lyra-flag>` — a country/language flag.
 *
 * Flag images are shipped by the optional peer package `@aceshooting/lyra-flags`,
 * not bundled into lyra-ui itself, so importing the core library pulls zero flag
 * weight. Give it a `country` (ISO 3166-1 alpha-2) or a `language` tag (mapped to
 * a representative country).
 *
 * @customElement lyra-flag
 * @example <lyra-flag country="fr"></lyra-flag>
 * @example <lyra-flag language="en" label="English"></lyra-flag>
 * @csspart image - The underlying <img>.
 */
export class LyraFlag extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** ISO 3166-1 alpha-2 country code (e.g. `fr`, `us`). Takes precedence over `language`. */
  @property() country?: string;

  /** BCP-47-ish language tag (e.g. `en`, `en-US`) resolved to a country flag. */
  @property() language?: string;

  /** Accessible label / `alt` text. Defaults to the uppercase code. */
  @property() label?: string;

  /** Render as a circular flag. */
  @property({ type: Boolean, reflect: true }) round = false;

  @state() private src?: string;

  /** True while the lazy-loaded `@aceshooting/lyra-flags` peer resolver is in flight. */
  @state() private loading = true;

  private get code(): string | undefined {
    if (this.country) return this.country.toLowerCase();
    if (this.language) return languageToCountry(this.language);
    return undefined;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    // `this.hasUpdated` (not just `changed`) forces this body to run once on
    // the very first update even when neither `country` nor `language` is
    // ever set: an unset optional property's first "assignment" is
    // undefined -> undefined (no-op to Lit), so `changed.has('country')`
    // would otherwise never become true for a `<lyra-flag>` that never
    // receives a code, leaving `loading` stuck at its initial `true` forever.
    if (this.hasUpdated && !changed.has('country') && !changed.has('language')) return;
    const code = this.code;
    if (!code) {
      this.src = undefined;
      this.loading = false;
      return;
    }
    this.loading = true;
    void loadFlagUrlResolver().then((resolve) => {
      this.src = resolve?.(code);
      this.loading = false;
    });
  }

  protected updated(): void {
    if (this.loading) this.setAttribute('aria-busy', 'true');
    else this.removeAttribute('aria-busy');
  }

  render(): TemplateResult {
    if (this.loading) return html`<lyra-skeleton variant="rect"></lyra-skeleton>`;
    if (!this.src) return html``;
    const alt = this.label ?? (this.code ?? '').toUpperCase();
    return html`<img part="image" src=${this.src} alt=${alt} loading="lazy" decoding="async" />`;
  }
}

defineElement('flag', LyraFlag);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-flag': LyraFlag;
  }
}
