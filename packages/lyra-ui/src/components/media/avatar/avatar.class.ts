import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { safeMediaSrc } from '../../../internal/safe-url.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import type { LyraSize, LyraVariant } from '../../../internal/variants.js';
import { styles } from './avatar.styles.js';

export type LyraAvatarShape = 'circle' | 'rounded' | 'square';
export type LyraAvatarLoading = 'eager' | 'lazy';

export interface LyraAvatarErrorDetail {
  image: string;
}

export interface LyraAvatarEventMap {
  'lr-error': CustomEvent<LyraAvatarErrorDetail>;
}

/**
 * `<lr-avatar>` — a small, fixed-size identity marker: an image, an `icon`-slotted fallback
 * glyph, or an initials fallback, in that priority order. Mirrors `wa-avatar`'s public surface
 * (`image`/`initials`/`loading`/`shape`, the `icon` slot, the image-load error event) and adds
 * this library's own `size`/`variant` vocabulary. Purely presentational, no built-in interactivity;
 * a consumer wraps it in their own `<button>`/`<lr-menu>` trigger for a user-menu affordance.
 *
 * @customElement lr-avatar
 * @event lr-error - The image failed to load. `detail: { image }` carries the URL that failed, so
 *   a consumer can retry or report it; the avatar itself has already fallen back to the `icon`
 *   slot or the initials by the time this fires. Never fires when no `image` is set.
 * @slot icon - A fallback glyph shown only when there is no loadable `image` — the same role
 *   `wa-avatar`'s `icon` slot fills, i.e. a stand-in for the
 *   `initials` text rather than an override of the photo. Also decorative (`aria-hidden`), so set
 *   `label` alongside it.
 * @csspart base - The outer circle/rounded/square container.
 * @csspart icon - Wrapper around the named icon fallback while it has assigned content and no
 *   image is currently usable.
 * @csspart image - The `<img>`, only rendered while `image` is set and has not failed to load (and
 *   is safe for a media source).
 * @csspart initials - The initials text, only rendered once the image and icon fallbacks ahead of it
 *   in the priority order have been ruled out.
 * @cssprop [--size=var(--lr-avatar-size)] - Upstream-compatible avatar diameter.
 * @cssprop [--lr-avatar-size=var(--lr-size-3rem)] - Inline and block size of the container. `size`
 *   steps its private default across the shared six-step ladder, from `var(--lr-size-1-5rem)`
 *   (`2xs`) to `var(--lr-size-5rem)` (`xl`); an inherited or direct public value still wins.
 * @cssprop [--lr-avatar-bg=var(--lr-color-border)] - Container background. Each non-neutral
 *   `variant` changes its private default to that variant's `-quiet` tint.
 * @cssprop [--lr-avatar-color=var(--lr-color-text)] - Initials/glyph color. Each non-neutral
 *   `variant` changes its private default to that variant's loud color.
 * @cssprop [--lr-avatar-font-size=var(--lr-font-size-m)] - Font size of the initials fallback (and
 *   of any `em`-sized slotted glyph). `size` steps its private default alongside the diameter, so
 *   the initials track the circle instead of staying at one fixed size across every tier.
 * @status stable
 * @since 4.0.0
 */
export class LyraAvatar extends LyraElement<LyraAvatarEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** Fallback text (typically 1-2 characters) shown when no glyph and no image is set, or the
   *  image fails to load and no `icon` slot content is provided. */
  @property() initials = '';

  /** Image URL. Takes priority over the `icon` slot and `initials` when set and loads successfully
   *  and falls back to them on a load error. Named
   *  `image` to match `wa-avatar`; it used to be `src`, which a mechanical rename left unset —
   *  silently falling back to initials. */
  @property() image = '';

  /** Accessible description matching the upstream avatar contract. A host `aria-label` wins.
   * Attribute removal is consumed as an absent label without changing its null readback. */
  @property() label = '';

  /** Native `<img loading>` passthrough. `'lazy'` defers the request until the avatar approaches
   *  the viewport — worth setting for avatars far down a long list, never for one above the fold. */
  @property() loading: LyraAvatarLoading = 'eager';

  /** Visual size, on the shared six-step ladder. `'large'`/`'l'` matches `--lr-icon-button-size`
   *  (4rem); `'medium'`/`'m'` (the default) is the mirrored 3rem diameter. */
  @property({ reflect: true, useDefault: true }) size: LyraSize = 'medium';

  /** `'circle'` (the default), `'rounded'` (the shared medium corner radius), or `'square'` (no
   *  corner radius at all). */
  @property({ reflect: true, useDefault: true }) shape: LyraAvatarShape =
    'circle';

  /** Recolors the initials-fallback background/text, on the library's shared `variant` vocabulary.
   *  `'neutral'` (the default) reads as a plain, unaccented circle. */
  @property({ reflect: true, useDefault: true }) variant: LyraVariant =
    'neutral';

  @state() private failedSrc?: string;

  @state() private hasIconSlot = false;

  /** Each connection establishes state before later image writes become observable failures. */
  private connectionEventBaselinePending = true;

  /**
   * A glyph is presentation owned by the avatar, never an independent focus target. Browsers
   * normally refuse focus for an unassigned light-DOM child, but WebKit can still honor an
   * imperative `focus()` call on one. Restore the previous external focus target in that case;
   * the same boundary also protects an accidentally interactive node assigned to `icon` without
   * mutating the consumer's node or its authored `inert` state.
   */
  private onDecorativeGlyphFocusIn = (event: Event): void => {
    const focusEvent = event as FocusEvent;
    const target = event.target as
      | (EventTarget & { blur?: () => void; nodeType?: number })
      | null;
    if (
      target === this ||
      target?.nodeType !== 1 ||
      !this.contains(target as Node)
    )
      return;

    const previous = focusEvent.relatedTarget as
      | (EventTarget & { focus?: () => void; nodeType?: number })
      | null;
    if (
      previous?.nodeType === 1 &&
      !this.contains(previous as Node) &&
      typeof previous.focus === 'function'
    ) {
      previous.focus();
      return;
    }
    target.blur?.();
  };

  constructor() {
    super();
    this.addEventListener('focusin', this.onDecorativeGlyphFocusIn);
  }

  private safeImage(): string | null {
    return safeMediaSrc(this.image, this.ownerDocument?.defaultView?.URL ?? URL);
  }

  private hasIconSlotContent(nodes: Iterable<Node>): boolean {
    return Array.from(nodes).some(
      (node) =>
        node.nodeType === 1 && (node as Element).getAttribute('slot') === 'icon'
    );
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    const mayEmitConnectionTransition =
      this.isConnected && !this.connectionEventBaselinePending;
    if (
      changed.has('loading') &&
      this.loading !== 'eager' &&
      this.loading !== 'lazy'
    )
      this.loading = 'eager';
    if (
      changed.has('size') &&
      this.size !== '2xs' &&
      this.size !== 'xs' &&
      this.size !== 's' &&
      this.size !== 'm' &&
      this.size !== 'l' &&
      this.size !== 'xl' &&
      this.size !== 'small' &&
      this.size !== 'medium' &&
      this.size !== 'large'
    )
      this.size = 'medium';
    if (
      changed.has('shape') &&
      this.shape !== 'circle' &&
      this.shape !== 'rounded' &&
      this.shape !== 'square'
    ) {
      this.shape = 'circle';
    }
    if (
      changed.has('variant') &&
      this.variant !== 'neutral' &&
      this.variant !== 'brand' &&
      this.variant !== 'success' &&
      this.variant !== 'warning' &&
      this.variant !== 'danger'
    )
      this.variant = 'neutral';
    if (changed.has('image')) {
      this.failedSrc = undefined;
      if (
        this.hasUpdated &&
        this.image &&
        !this.safeImage() &&
        mayEmitConnectionTransition
      ) {
        this.emit('lr-error', { image: this.image });
      }
    }
    // Set from light-DOM children before the first render so the initial paint already reflects
    // any icon content present at parse time, rather than waiting a render behind `slotchange`.
    // A server render sees no children at all, so hydration seeds one update later instead.
    this.seedFirstRenderState(() => {
      this.hasIconSlot = this.hasIconSlotContent(this.childNodes);
    });
  }

  private onImageError = (event: Event): void => {
    const image = event.currentTarget as HTMLImageElement | null;
    const failedSrc = image?.getAttribute('src');
    const currentSrc = this.safeImage();
    if (
      !this.isConnected ||
      !image ||
      image !== this.renderRoot.querySelector('[part="image"]') ||
      !failedSrc ||
      failedSrc !== currentSrc
    )
      return;
    if (this.failedSrc === failedSrc) return;
    this.failedSrc = failedSrc;
    this.emit('lr-error', { image: failedSrc });
  };

  // A named slot only ever receives elements carrying the matching `slot` attribute, so any
  // assigned node at all is real content -- no whitespace filtering needed here.
  private onNamedIconSlotChange = (e: Event): void => {
    this.hasIconSlot =
      (e.target as HTMLSlotElement).assignedNodes({ flatten: true }).length > 0;
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this.connectionEventBaselinePending = true;
    this.requestUpdate();
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    if (this.isConnected) this.connectionEventBaselinePending = false;
  }

  override disconnectedCallback(): void {
    this.connectionEventBaselinePending = true;
    this.failedSrc = undefined;
    super.disconnectedCallback();
  }

  override render(): TemplateResult {
    const safeImage = this.safeImage();
    const showImage = !!safeImage && safeImage !== this.failedSrc;
    const showGlyph = !showImage && this.hasIconSlot;
    const showInitials = !showGlyph && !showImage;
    const explicitHostLabel = hostAriaLabel(this);
    const label = this.label ?? '';
    const accessibleName = explicitHostLabel ?? label;
    const suppressFallbackSemantics =
      explicitHostLabel !== null || label.length > 0;
    // Whenever `label` is set, [part='base'] needs a real accessible name
    // regardless of which fallback tier ends up rendering -- the glyph cases
    // (their content is aria-hidden) and the initials-fallback case (its
    // text is aria-hidden once an accessible name is set, see [part='initials'] below)
    // both rely on this. The `showImage` case is excluded: the `<img>` itself
    // already carries its alt text as its accessible name, so [part='base'] doesn't
    // need a redundant role/aria-label.
    const hasAccessibleFallback =
      (showGlyph || showInitials) && accessibleName.length > 0;
    return html`
      <span
        part="base"
        role=${hasAccessibleFallback ? 'img' : nothing}
        aria-label=${hasAccessibleFallback ? accessibleName : nothing}
      >
        <span part="icon" aria-hidden="true" inert ?hidden=${!showGlyph}
          ><slot name="icon" @slotchange=${this.onNamedIconSlotChange}></slot
        ></span>
        ${showImage
          ? html`<img
              part="image"
              src=${safeImage!}
              alt=${accessibleName}
              loading=${this.loading}
              @error=${this.onImageError}
            />`
          : nothing}
        ${showInitials
          ? html`<span
              part="initials"
              aria-hidden=${suppressFallbackSemantics ? 'true' : nothing}
              >${this.initials}</span
            >`
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
