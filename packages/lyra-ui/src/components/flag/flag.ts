import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { styles } from './flag.styles.js';
import { languageToCountry } from './language-map.js';

/**
 * `<lyra-flag>` — a country/language flag.
 *
 * Flags are lazy-loaded per code via `import.meta.url`, so importing the core
 * library pulls zero flag weight and a language picker only fetches what it shows.
 * Give it a `country` (ISO 3166-1 alpha-2) or a `language` tag (mapped to a
 * representative country).
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

  private get code(): string | undefined {
    if (this.country) return this.country.toLowerCase();
    if (this.language) return languageToCountry(this.language);
    return undefined;
  }

  render(): TemplateResult {
    const code = this.code;
    if (!code) return html``;
    const src = new URL(`./flags/${code}.svg`, import.meta.url).href;
    const alt = this.label ?? code.toUpperCase();
    return html`<img part="image" src=${src} alt=${alt} loading="lazy" decoding="async" />`;
  }
}

defineElement('flag', LyraFlag);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-flag': LyraFlag;
  }
}
