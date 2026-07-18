import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { styles } from './details.styles.js';

export interface LyraDetailsEventMap { 'lr-toggle': CustomEvent<{ open: boolean }>; }

/**
 * `<lr-details>` — an accessible disclosure panel.
 *
 * @customElement lr-details
 * @slot summary - Summary content. Takes priority over `summary` when any light-DOM child
 *   carries `slot="summary"` — the fallback localized "Details" text only appears when neither
 *   is set.
 * @slot - Panel content.
 * @event lr-toggle - The disclosure state changed. `detail: { open }`.
 * @csspart base - The native details element.
 * @csspart summary - The summary control.
 * @csspart content - The panel content.
 */
export class LyraDetails extends LyraElement<LyraDetailsEventMap> {
  static styles = [LyraElement.styles, styles];
  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property() summary = '';

  // `[part='summary']:empty` never matches because the part always contains a literal `<slot>`
  // child -- same fix `lr-avatar`/`lr-empty`/`lr-stat` already established. Track real
  // slot assignment in JS so the `summary` fallback text doesn't render alongside rich slotted
  // content (it previously always rendered whenever the plain-string `summary` prop was unset,
  // even with a `slot="summary"` child present).
  @state() private hasSummarySlot = false;

  protected willUpdate(changed: PropertyValues<this>): void {
    if (!this.hasUpdated) {
      this.hasSummarySlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'summary');
    }
    void changed;
  }

  private onToggle = (event: Event): void => {
    const details = event.currentTarget as HTMLDetailsElement;
    if (this.disabled && details.open) { details.open = false; return; }
    this.open = details.open;
    this.emit('lr-toggle', { open: this.open });
  };
  private onClick = (event: Event): void => {
    if (this.disabled) { event.preventDefault(); event.stopPropagation(); }
  };
  private onSummarySlotChange = (e: Event): void => {
    this.hasSummarySlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };
  render(): TemplateResult {
    return html`<details part="base" .open=${this.open} @toggle=${this.onToggle}>
      <summary
        part="summary"
        aria-expanded=${this.open ? 'true' : 'false'}
        aria-disabled=${this.disabled ? 'true' : 'false'}
        @click=${this.onClick}
      >
        ${this.hasSummarySlot || this.summary ? '' : this.localize('details')}<slot name="summary" @slotchange=${this.onSummarySlotChange}>${this.summary}</slot>
      </summary>
      <div part="content"><slot></slot></div>
    </details>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-details': LyraDetails; } }
