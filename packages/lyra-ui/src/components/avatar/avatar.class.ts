import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { styles } from './avatar.styles.js';

export type AvatarSize = 'sm' | 'md' | 'lg';
export type AvatarShape = 'circle' | 'square';
export type AvatarTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

/**
 * `<lyra-avatar>` — a small, fixed-size identity marker: an image, or an initials fallback when
 * no image is set (or the image fails to load). First-party invention (no Web Awesome
 * equivalent) -- purely presentational, no built-in interactivity; a consumer wraps it in their
 * own `<button>`/`<lyra-menu>` trigger for a user-menu affordance.
 *
 * @customElement lyra-avatar
 * @csspart base - The outer circle/square container.
 * @csspart image - The `<img>`, only rendered while `src` is set and has not failed to load.
 * @csspart initials - The fallback initials text, rendered whenever `image` isn't.
 */
export class LyraAvatar extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** Fallback text (typically 1-2 characters) shown when no image is set, or the image fails to
   *  load. */
  @property() initials = '';

  /** Image URL. Takes priority over `initials` when set and loads successfully; falls back to
   *  `initials` on a load error. */
  @property() src?: string;

  /** Image alt text -- required alongside `src` for accessibility. */
  @property() alt = '';

  /** Visual size. `'md'` (the default) matches `--lyra-icon-button-size` (2.5rem). */
  @property({ reflect: true }) size: AvatarSize = 'md';

  /** `'circle'` (the default) or `'square'`. */
  @property({ reflect: true }) shape: AvatarShape = 'circle';

  /** Recolors the initials-fallback background/text, mirroring `lyra-chip`'s `tone` vocabulary.
   *  `'neutral'` (the default) reads as a plain, unaccented circle. */
  @property({ reflect: true }) tone: AvatarTone = 'neutral';

  @state() private imageFailed = false;

  private onImageError = (): void => {
    this.imageFailed = true;
  };

  render(): TemplateResult {
    const showImage = !!this.src && !this.imageFailed;
    return html`
      <span part="base">
        ${showImage
          ? html`<img part="image" src=${this.src!} alt=${this.alt} @error=${this.onImageError} />`
          : html`<span part="initials" aria-hidden=${this.alt ? 'true' : nothing}>${this.initials}</span>`}
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-avatar': LyraAvatar;
  }
}
