import { html, type TemplateResult } from 'lit';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './carousel-item.styles.js';

/**
 * `<lr-carousel-item>` — an optional semantic wrapper for one child of
 * `<lr-carousel>`. A carousel also accepts arbitrary slotted elements, so
 * this element is convenience syntax for migrations and for consistent item styling.
 * Its author-supplied slide semantics remain in effect when changed after connection; an owning
 * carousel only temporarily applies inertness and aria-hidden state while the item is off page.
 *
 * @customElement lr-carousel-item
 * @slot - Slide content.
 * @csspart base - The slide wrapper.
 * @cssprop --aspect-ratio - The slide aspect ratio, inherited from an owning carousel by default.
 * @status stable
 * @since 4.0.0
 */
export class LyraCarouselItem extends LyraElement {
  static override styles = [LyraElement.styles, styles];

  override render(): TemplateResult {
    return html`<div part="base"><slot></slot></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-carousel-item': LyraCarouselItem;
  }
}
