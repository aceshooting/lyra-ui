import { html, type TemplateResult } from 'lit';
import { LyraElement } from '../../internal/lyra-element.js';
import { styles } from './carousel-item.styles.js';

/**
 * `<lyra-carousel-item>` — an optional semantic wrapper for one child of
 * `<lyra-carousel>`. A carousel also accepts arbitrary slotted elements, so
 * this element is convenience syntax for migrations and for consistent item styling.
 *
 * @customElement lyra-carousel-item
 * @slot - Slide content.
 * @csspart base - The slide wrapper.
 */
export class LyraCarouselItem extends LyraElement {
  static styles = [LyraElement.styles, styles];

  render(): TemplateResult {
    return html`<div part="base"><slot></slot></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-carousel-item': LyraCarouselItem;
  }
}
