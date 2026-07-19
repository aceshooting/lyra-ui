import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { styles } from './avatar.styles.js';

export type AvatarSize = 'sm' | 'md' | 'lg';
export type AvatarShape = 'circle' | 'square';
export type AvatarTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

/**
 * `<lr-avatar>` — a small, fixed-size identity marker: default-slotted icon/glyph content, an
 * image, or an initials fallback, in that priority order (whichever's set takes over from the
 * next). First-party invention (no Web Awesome equivalent) -- purely presentational, no built-in
 * interactivity; a consumer wraps it in their own `<button>`/`<lr-menu>` trigger for a
 * user-menu affordance.
 *
 * @customElement lr-avatar
 * @slot - Icon/glyph content (e.g. an inline SVG) shown in place of the image/initials, e.g. to
 *   mark a chat message avatar as "AI" vs. "user" with a role glyph instead of a photo or
 *   initials. Takes priority over both `src` and `initials`. The glyph itself is treated as
 *   decorative (`aria-hidden`); set `alt` alongside it for an accessible name.
 * @csspart base - The outer circle/square container.
 * @csspart icon - Wrapper around the default-slotted icon/glyph content. Only rendered while the
 *   slot has assigned content.
 * @csspart image - The `<img>`, only rendered while `src` is set and has not failed to load (and
 *   no icon content is slotted).
 * @csspart initials - The fallback initials text, rendered whenever neither slotted content nor
 *   `image` is.
 */
export class LyraAvatar extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** Fallback text (typically 1-2 characters) shown when no icon/image is set, or the image
   *  fails to load. */
  @property() initials = '';

  /** Image URL. Takes priority over `initials` when set and loads successfully (but not over
   *  slotted icon content); falls back to `initials` on a load error. */
  @property() src?: string;

  /** Alt text -- required alongside `src` for accessibility, and also used as the accessible
   *  name (via `aria-label`) when showing icon-only slotted content, since a decorative glyph
   *  has no text of its own for a screen reader to read. A host `aria-label` overrides this
   *  value while leaving the visible initials/image unchanged. */
  @property() alt = '';

  /** Visual size. `'lg'` matches `--lr-icon-button-size` (2.5rem); `'md'` (the default) is 2rem. */
  @property({ reflect: true }) size: AvatarSize = 'md';

  /** `'circle'` (the default) or `'square'`. */
  @property({ reflect: true }) shape: AvatarShape = 'circle';

  /** Recolors the initials-fallback background/text, mirroring `lr-chip`'s `tone` vocabulary.
   *  `'neutral'` (the default) reads as a plain, unaccented circle. */
  @property({ reflect: true }) tone: AvatarTone = 'neutral';

  @state() private failedSrc?: string;

  // `[part='icon']:empty` never matches because the part always contains a literal `<slot>`
  // child -- same fix `lr-empty`/`lr-stat` already established. Track real slot assignment
  // in JS instead.
  @state() private hasIcon = false;

  protected willUpdate(): void {
    // Set from light-DOM children before the first render so the initial paint already reflects
    // any icon content present at parse time, rather than waiting a render behind `slotchange`.
    if (!this.hasUpdated) {
      this.hasIcon = Array.from(this.children).some((el) => !el.hasAttribute('slot'));
    }
  }

  private onImageError = (event: Event): void => {
    const image = event.currentTarget as HTMLImageElement | null;
    const failedSrc = image?.getAttribute('src');
    if (failedSrc) this.failedSrc = failedSrc;
  };

  private onIconSlotChange = (e: Event): void => {
    this.hasIcon = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  render(): TemplateResult {
    const showImage = !this.hasIcon && !!this.src && this.src !== this.failedSrc;
    const showInitials = !this.hasIcon && !showImage;
    const accessibleName = this.getAttribute('aria-label') ?? this.alt;
    // Whenever `alt` is set, [part='base'] needs a real accessible name
    // regardless of which fallback tier ends up rendering -- the icon-slot
    // case (its glyph is aria-hidden) and the initials-fallback case (its
    // text is aria-hidden once `alt` is set, see [part='initials'] below)
    // both rely on this, not just the icon-slot one. The `showImage` case is
    // excluded: the `<img>` itself already carries `alt` as its accessible
    // name, so [part='base'] doesn't need a redundant role/aria-label.
    const hasAccessibleFallback = (this.hasIcon || showInitials) && accessibleName;
    return html`
      <span
        part="base"
        role=${hasAccessibleFallback ? 'img' : nothing}
        aria-label=${hasAccessibleFallback ? accessibleName : nothing}
      >
        <span part="icon" aria-hidden="true" ?hidden=${!this.hasIcon}
          ><slot @slotchange=${this.onIconSlotChange}></slot
        ></span>
        ${showImage
          ? html`<img part="image" src=${this.src!} alt=${accessibleName} @error=${this.onImageError} />`
          : nothing}
        ${showInitials
          ? html`<span part="initials" aria-hidden=${accessibleName ? 'true' : nothing}>${this.initials}</span>`
          : nothing}
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-avatar': LyraAvatar;
  }
}
