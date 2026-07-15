import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { styles } from './details.styles.js';

export interface LyraDetailsEventMap { 'lyra-toggle': CustomEvent<{ open: boolean }>; }

/**
 * `<lyra-details>` — an accessible disclosure panel.
 *
 * @customElement lyra-details
 * @slot summary - Summary content.
 * @slot - Panel content.
 * @event lyra-toggle - The disclosure state changed. `detail: { open }`.
 * @csspart base - The native details element.
 * @csspart summary - The summary control.
 * @csspart content - The panel content.
 */
export class LyraDetails extends LyraElement<LyraDetailsEventMap> {
  static styles = [LyraElement.styles, styles];
  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property() summary = '';
  private onToggle = (event: Event): void => {
    const details = event.currentTarget as HTMLDetailsElement;
    if (this.disabled && details.open) { details.open = false; return; }
    this.open = details.open;
    this.emit('lyra-toggle', { open: this.open });
  };
  private onClick = (event: Event): void => {
    if (this.disabled) { event.preventDefault(); event.stopPropagation(); }
  };
  render(): TemplateResult {
    return html`<details part="base" .open=${this.open} @toggle=${this.onToggle}>
      <summary part="summary" aria-expanded=${this.open ? 'true' : 'false'} @click=${this.onClick}>
        ${this.summary || this.localize('details')}<slot name="summary"></slot>
      </summary>
      <div part="content"><slot></slot></div>
    </details>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lyra-details': LyraDetails; } }
