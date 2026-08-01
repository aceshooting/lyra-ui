import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraSize, LyraVariant } from '../../../internal/variants.js';
import { styles } from './avatar.styles.js';

/**
 * The shared six-step {@linkcode LyraSize} ladder (in either the `s`/`m`/`l` or the
 * `small`/`medium`/`large` spelling) plus the `'sm' | 'md' | 'lg'` shorthands this component
 * already accepted. Every member renders a distinct diameter; the three spellings of each tier
 * render identically.
 */
export type AvatarSize = LyraSize | 'sm' | 'md' | 'lg';
export type AvatarShape = 'circle' | 'rounded' | 'square';
/** Semantic tone — an alias of the shared {@linkcode LyraVariant}, so there is one definition. */
export type AvatarVariant = LyraVariant;
export type AvatarLoading = 'eager' | 'lazy';

export interface LyraAvatarEventMap {
  'lr-error': CustomEvent<{ image: string }>;
}

/**
 * `<lr-avatar>` — a small, fixed-size identity marker: default-slotted icon/glyph content, an
 * image, an `icon`-slotted fallback glyph, or an initials fallback, in that priority order
 * (whichever's set takes over from the next). Mirrors `wa-avatar`'s public surface
 * (`image`/`initials`/`loading`/`shape`, the `icon` slot, the image-load error event) and adds
 * this library's own `size`/`variant` vocabulary. Purely presentational, no built-in interactivity;
 * a consumer wraps it in their own `<button>`/`<lr-menu>` trigger for a user-menu affordance.
 *
 * @customElement lr-avatar
 * @event lr-error - The image failed to load. `detail: { image }` carries the URL that failed, so
 *   a consumer can retry or report it; the avatar itself has already fallen back to the `icon`
 *   slot or the initials by the time this fires. Never fires when no `image` is set.
 * @slot - Icon/glyph content (e.g. an inline SVG) shown in place of the image/initials, e.g. to
 *   mark a chat message avatar as "AI" vs. "user" with a role glyph instead of a photo or
 *   initials. Takes priority over `image`, the `icon` slot, and `initials`. The glyph itself is
 *   treated as decorative (`aria-hidden`); set `alt` alongside it for an accessible name.
 * @slot icon - A fallback glyph shown only when there is no default-slotted content and no
 *   loadable `image` — the same role `wa-avatar`'s `icon` slot fills, i.e. a stand-in for the
 *   `initials` text rather than an override of the photo. Also decorative (`aria-hidden`), so set
 *   `alt` alongside it.
 * @csspart base - The outer circle/rounded/square container.
 * @csspart icon - Wrapper around whichever glyph slot is active. Only rendered while one of them
 *   has assigned content that is currently winning the fallback order.
 * @csspart image - The `<img>`, only rendered while `image` is set and has not failed to load (and
 *   no default-slot glyph is provided).
 * @csspart initials - The initials text, only rendered once every glyph and image fallback ahead of
 *   it in the priority order has been ruled out.
 * @cssprop [--lr-avatar-size=var(--lr-size-2rem)] - Inline and block size of the container. `size`
 *   steps it across the shared six-step ladder, from `var(--lr-size-1rem)` (`2xs`) to
 *   `var(--lr-size-3rem)` (`xl`); the default `medium`/`m` tier is `var(--lr-size-2rem)`.
 * @cssprop [--lr-avatar-bg=var(--lr-color-border)] - Container background. Each non-neutral
 *   `variant` sets it to that variant's `-quiet` tint.
 * @cssprop [--lr-avatar-color=var(--lr-color-text)] - Initials/glyph color. Each non-neutral
 *   `variant` sets it to that variant's loud color.
 * @cssprop [--lr-avatar-font-size=var(--lr-font-size-sm)] - Font size of the initials fallback (and
 *   of any `em`-sized slotted glyph). `size` steps it alongside the diameter, so the initials track
 *   the circle instead of staying at one fixed size across every tier.
 */
export class LyraAvatar extends LyraElement<LyraAvatarEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** Fallback text (typically 1-2 characters) shown when no glyph and no image is set, or the
   *  image fails to load and no `icon` slot content is provided. */
  @property() initials = '';

  /** Image URL. Takes priority over the `icon` slot and `initials` when set and loads successfully
   *  (but not over default-slotted icon content); falls back to them on a load error. Named
   *  `image` to match `wa-avatar`; it used to be `src`, which a mechanical rename left unset —
   *  silently falling back to initials. */
  @property() image?: string;

  /** Alt text -- required alongside `image` for accessibility, and also used as the accessible
   *  name (via `aria-label`) when showing icon-only slotted content, since a decorative glyph
   *  has no text of its own for a screen reader to read. A host `aria-label` overrides this
   *  value while leaving the visible initials/image unchanged. */
  @property() alt = '';

  /** Native `<img loading>` passthrough. `'lazy'` defers the request until the avatar approaches
   *  the viewport — worth setting for avatars far down a long list, never for one above the fold. */
  @property() loading: AvatarLoading = 'eager';

  /** Visual size, on the shared six-step ladder. `'large'`/`'l'` matches `--lr-icon-button-size`
   *  (2.5rem); `'medium'`/`'m'` (the default) is 2rem. `'sm'`/`'md'`/`'lg'` are accepted aliases of
   *  `'small'`/`'medium'`/`'large'` and render identically. */
  @property({ reflect: true }) size: AvatarSize = 'medium';

  /** `'circle'` (the default), `'rounded'` (the shared medium corner radius), or `'square'` (no
   *  corner radius at all). */
  @property({ reflect: true }) shape: AvatarShape = 'circle';

  /** Recolors the initials-fallback background/text, on the library's shared `variant` vocabulary.
   *  `'neutral'` (the default) reads as a plain, unaccented circle. */
  @property({ reflect: true }) variant: AvatarVariant = 'neutral';

  @state() private failedSrc?: string;

  // `[part='icon']:empty` never matches because the part always contains a literal `<slot>`
  // child -- same fix `lr-empty`/`lr-stat` already established. Track real slot assignment
  // in JS instead.
  @state() private hasIcon = false;

  @state() private hasIconSlot = false;

  private hasDefaultSlotContent(nodes: Iterable<Node>): boolean {
    return Array.from(nodes).some((node) => {
      if (node instanceof Element) return !node.hasAttribute('slot');
      return node.nodeType === Node.TEXT_NODE && (node.textContent?.trim().length ?? 0) > 0;
    });
  }

  private hasIconSlotContent(nodes: Iterable<Node>): boolean {
    return Array.from(nodes).some((node) => node instanceof Element && node.getAttribute('slot') === 'icon');
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (changed.has('image')) this.failedSrc = undefined;
    // Set from light-DOM children before the first render so the initial paint already reflects
    // any icon content present at parse time, rather than waiting a render behind `slotchange`.
    if (!this.hasUpdated) {
      this.hasIcon = this.hasDefaultSlotContent(this.childNodes);
      this.hasIconSlot = this.hasIconSlotContent(this.childNodes);
    }
  }

  private onImageError = (event: Event): void => {
    const image = event.currentTarget as HTMLImageElement | null;
    const failedSrc = image?.getAttribute('src');
    if (failedSrc) this.failedSrc = failedSrc;
    this.emit('lr-error', { image: failedSrc ?? this.image ?? '' });
  };

  private onIconSlotChange = (e: Event): void => {
    this.hasIcon = this.hasDefaultSlotContent(
      (e.target as HTMLSlotElement).assignedNodes({ flatten: true }),
    );
  };

  // A named slot only ever receives elements carrying the matching `slot` attribute, so any
  // assigned node at all is real content -- no whitespace filtering needed here.
  private onNamedIconSlotChange = (e: Event): void => {
    this.hasIconSlot = (e.target as HTMLSlotElement).assignedNodes({ flatten: true }).length > 0;
  };

  override render(): TemplateResult {
    const showImage = !this.hasIcon && !!this.image && this.image !== this.failedSrc;
    const showIconSlot = !this.hasIcon && !showImage && this.hasIconSlot;
    const showGlyph = this.hasIcon || showIconSlot;
    const showInitials = !showGlyph && !showImage;
    const accessibleName = this.getAttribute('aria-label') ?? this.alt;
    // Whenever `alt` is set, [part='base'] needs a real accessible name
    // regardless of which fallback tier ends up rendering -- the glyph cases
    // (their content is aria-hidden) and the initials-fallback case (its
    // text is aria-hidden once `alt` is set, see [part='initials'] below)
    // both rely on this. The `showImage` case is excluded: the `<img>` itself
    // already carries `alt` as its accessible name, so [part='base'] doesn't
    // need a redundant role/aria-label.
    const hasAccessibleFallback = (showGlyph || showInitials) && accessibleName;
    return html`
      <span
        part="base"
        role=${hasAccessibleFallback ? 'img' : nothing}
        aria-label=${hasAccessibleFallback ? accessibleName : nothing}
      >
        <span part="icon" aria-hidden="true" ?hidden=${!showGlyph}
          ><slot @slotchange=${this.onIconSlotChange} ?hidden=${!this.hasIcon}></slot
          ><slot name="icon" @slotchange=${this.onNamedIconSlotChange} ?hidden=${!showIconSlot}></slot
        ></span>
        ${showImage
          ? html`<img
              part="image"
              src=${this.image!}
              alt=${accessibleName}
              loading=${this.loading}
              @error=${this.onImageError}
            />`
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
