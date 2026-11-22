import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { playIcon } from '../../../internal/icons.js';
import { tag } from '../../../internal/prefix.js';
import { safeLinkHref, safeMediaSrc } from '../../../internal/safe-url.js';
import { literalSetConverter } from '../../../internal/converters.js';
import { attachInternalsSafely } from '../../../internal/element-internals.js';
import { setCustomState } from '../../../internal/custom-states.js';
import { styles } from './lightbox-item.styles.js';
import { chooseSrcsetCandidate } from '../../../internal/srcset.js';

/** The kind of media an item shows in the lightbox. */
export type LyraLightboxItemType = 'image' | 'video';

const ITEM_TYPES = ['image', 'video'] as const;

/** Whole-number pixel dimension from an attribute or property, or `undefined` when blank/invalid. */
function dimension(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined;
}

/**
 * `<lr-lightbox-item>` -- one image or video of an `<lr-lightbox>`, wrapping the thumbnail that
 * opens it. It mirrors `wa-lightbox-item`. Each item renders a real link to its full-size media
 * (`src`), so a gallery still works without JavaScript and when opened in a new tab; the parent
 * lightbox intercepts a plain click and opens at that item instead. An item without `src` renders
 * a button-like trigger with the same keyboard behavior.
 *
 * Every URL is validated before use: the link `href` must pass `safeLinkHref()` and the media
 * handed to the lightbox must pass `safeMediaSrc()`; a rejected URL leaves the trigger a button
 * and the item out of the viewer's media.
 *
 * `srcset` and `sizes` choose the full-size candidate the lightbox loads: the smallest candidate
 * that covers the viewer's width (or `sizes`, when it is a single `px`/`vw` length), else the
 * largest. `width` and `height` reserve the item's own space (and the viewer's placeholder) before
 * the media loads, so a gallery does not shift as it fills in.
 *
 * @customElement lr-lightbox-item
 * @slot - The item's thumbnail, usually an `<img>`. Clicking it opens the lightbox at this item.
 *   Leave it empty (with no `thumbnail`) for an item that only appears inside the lightbox.
 * @slot caption - Optional caption text shown with the item in the lightbox. Not displayed on the
 *   page; the lightbox reads its text content.
 * @slot play-icon - Optional play icon shown over a video item's thumbnail.
 * @csspart trigger - The link (or button-like anchor) that wraps the thumbnail and opens the lightbox.
 * @csspart thumbnail-image - The image rendered from `thumbnail` when nothing is slotted.
 * @csspart play-button - The play button shown over a video's thumbnail.
 * @cssstate active - Present while this is the current item of an open lightbox.
 * @cssstate empty - Present when nothing is slotted and no `thumbnail` is set; such an item is not
 *   displayed on the page.
 * @cssstate morphing - Present while the lightbox runs its open or close motion for this item.
 * @csspart play-glyph - The default play glyph inside the `play-icon` slot.
 * @status stable
 * @since 32.1.0
 */
export class LyraLightboxItem extends LyraElement {
  static override styles = [LyraElement.styles, styles];

  @query('[part="trigger"]') private triggerEl?: HTMLAnchorElement;
  private readonly itemInternals = attachInternalsSafely(this);

  /** The kind of media shown in the lightbox. A `video` item shows a play button over its thumbnail. */
  @property({ reflect: true, converter: literalSetConverter(ITEM_TYPES, 'image') })
  type: LyraLightboxItemType = 'image';

  /** URL of the full-size image or video. The trigger links to it, so the item works without JavaScript. */
  @property() src = '';

  /** Image sources for the full-size image, in `<img srcset>` format. */
  @property() srcset = '';

  /** The `sizes` hint for `srcset`; a single `px` or `vw` length narrows the chosen candidate. */
  @property() sizes = '';

  /** Alternative text for the full-size media. Defaults to the slotted thumbnail's `alt`. */
  @property() alt = '';

  /** Plain-text caption shown with the item in the lightbox (the `caption` slot is an alternative). */
  @property() caption = '';

  /** Thumbnail URL for the strip and the item itself when no `<img>` is slotted. */
  @property() thumbnail = '';

  /** Intrinsic width of the full-size media in pixels. Pair with `height` to reserve space. */
  @property({ converter: { fromAttribute: (value: string | null) => dimension(value) } })
  width?: number;

  /** Intrinsic height of the full-size media in pixels. */
  @property({ converter: { fromAttribute: (value: string | null) => dimension(value) } })
  height?: number;

  /** @internal The slotted thumbnail image, if any. */
  get thumbnailElement(): HTMLImageElement | null {
    return this.querySelector(':scope > img, :scope img');
  }

  /** @internal Thumbnail URL from the slotted image or the `thumbnail` property, already validated. */
  get thumbnailSrc(): string {
    const image = this.thumbnailElement;
    return safeMediaSrc(image?.currentSrc || image?.getAttribute('src') || this.thumbnail) ?? '';
  }

  /** @internal Alt text for the lightbox. */
  get resolvedAlt(): string {
    return this.alt || this.thumbnailElement?.alt || '';
  }

  /** @internal Caption text for the lightbox: the `caption` property, else the `caption` slot's text. */
  get captionText(): string {
    if (this.caption) return this.caption;
    const slotted = Array.from(this.children).find((child) => child.getAttribute('slot') === 'caption');
    return slotted?.textContent?.trim() ?? '';
  }

  /** @internal The validated full-size URL the lightbox loads, chosen from `srcset` when needed. */
  get mediaSrc(): string {
    const chosen = this.src || chooseSrcsetCandidate(this.srcset, this.sizes, this.ownerDocument.defaultView);
    return safeMediaSrc(chosen) ?? '';
  }

  /** @internal Called by the parent lightbox to publish its `active` and `morphing` states. */
  setViewerState(name: 'active' | 'morphing', present: boolean): void {
    setCustomState(this.itemInternals, name, present);
  }

  /** Focuses the item's trigger. */
  override focus(options?: FocusOptions): void {
    if (this.deferFocusUntilRendered(options)) return;
    this.triggerEl?.focus(options);
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.notifyLightbox();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.notifyLightbox();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.notifyLightbox();
  }

  private notifyLightbox(): void {
    const parent = this.closest(tag('lightbox')) as (HTMLElement & { itemChanged?: () => void }) | null;
    parent?.itemChanged?.();
  }

  private onSlotChange = (): void => {
    const slot = this.renderRoot.querySelector<HTMLSlotElement>('slot:not([name])');
    const assigned = slot?.assignedNodes({ flatten: true }) ?? [];
    const hasContent = assigned.some((node) =>
      node.nodeType === Node.ELEMENT_NODE ? true : Boolean(node.textContent?.trim()),
    );
    this.toggleAttribute('data-empty', !hasContent && !this.thumbnail);
    setCustomState(this.itemInternals, 'empty', !hasContent && !this.thumbnail);
    this.notifyLightbox();
  };

  /** Without a usable URL the trigger is not a real link, so it takes a button's keyboard behavior. */
  private onKeyDown = (event: KeyboardEvent): void => {
    if (!safeLinkHref(this.src) && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      this.triggerEl?.click();
    }
  };

  protected override render(): TemplateResult {
    const href = safeLinkHref(this.src) ?? undefined;
    const decorative = this.thumbnailElement?.alt === '' && !this.textContent?.trim();
    const name = decorative && this.alt ? this.alt : undefined;
    const width = dimension(this.width);
    const height = dimension(this.height);
    const thumbnail = safeMediaSrc(this.thumbnail);
    return html`
      <a
        part="trigger"
        href=${ifDefined(href)}
        role=${ifDefined(href ? undefined : 'button')}
        tabindex=${ifDefined(href ? undefined : '0')}
        aria-haspopup="dialog"
        aria-label=${ifDefined(name)}
        @keydown=${this.onKeyDown}
      >
        <slot @slotchange=${this.onSlotChange}>${thumbnail
          ? html`<img
              part="thumbnail-image"
              src=${thumbnail}
              alt=${this.resolvedAlt}
              width=${ifDefined(width)}
              height=${ifDefined(height)}
              loading="lazy"
            />`
          : nothing}</slot>
        <slot name="caption"></slot>
        <span part="play-button" ?hidden=${this.type !== 'video'} aria-hidden="true">
          <slot name="play-icon"><span part="play-glyph">${playIcon()}</span></slot>
        </span>
      </a>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-lightbox-item': LyraLightboxItem;
  }
}
