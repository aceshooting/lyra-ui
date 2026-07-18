import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { tag } from '../../internal/prefix.js';
import { styles } from './accordion.styles.js';
import type { LyraDetails } from './details.class.js';

/**
 * `<lr-accordion>` — coordinates slotted `<lr-details>` panels.
 *
 * @customElement lr-accordion
 * @slot - `<lr-details>` panels.
 * @csspart base - The accordion wrapper.
 */
export class LyraAccordion extends LyraElement {
  static styles = [LyraElement.styles, styles];
  @property({ type: Boolean, reflect: true }) multiple = false;
  private onSlotChange = (): void => { this.bindPanels(); };
  private bindPanels(): void {
    const selector = `${tag('details')},${tag('accordion-item')}`;
    for (const panel of [...this.querySelectorAll(selector)] as LyraDetails[]) {
      panel.removeEventListener('lr-toggle', this.onPanelToggle as EventListener);
      panel.addEventListener('lr-toggle', this.onPanelToggle as EventListener);
    }
  }
  private onPanelToggle = (event: Event): void => {
    if (this.multiple || !(event as CustomEvent<{ open: boolean }>).detail.open) return;
    const source = event.target as LyraDetails;
    const selector = `${tag('details')},${tag('accordion-item')}`;
    for (const panel of [...this.querySelectorAll(selector)] as LyraDetails[]) {
      if (panel !== source) panel.open = false;
    }
  };
  render(): TemplateResult { return html`<div part="base"><slot @slotchange=${this.onSlotChange}></slot></div>`; }
}
declare global { interface HTMLElementTagNameMap { 'lr-accordion': LyraAccordion; } }
