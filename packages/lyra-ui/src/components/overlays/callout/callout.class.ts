import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './callout.styles.js';

export type CalloutVariant = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';
export interface LyraCalloutEventMap { 'lr-close': CustomEvent<undefined>; }

/**
 * `<lr-callout>` — an inline message surface for status, warning, and error content.
 * Set `inline` for lightweight reactive status/error text: it removes the panel chrome while
 * preserving the semantic role, optional leading icon, and close action.
 *
 * @customElement lr-callout
 * @slot - Message content.
 * @slot heading - Optional heading.
 * @slot icon - Optional icon.
 * @event lr-close - The close action was accepted. Cancelable before the callout hides.
 * @attr inline - Uses the lightweight inline treatment without border, background, or panel padding.
 * @csspart base - The callout surface.
 * @csspart icon - The icon wrapper.
 * @csspart content - The message content.
 * @csspart heading - The heading wrapper.
 * @csspart message - The message content wrapper.
 * @csspart close-button - The close button's interactive hit target, sized to the shared minimum
 *   tappable size (`--lr-icon-button-size`) in both the default panel and the compact `inline`
 *   variant.
 * @csspart close-icon - The close button's visible "×" glyph, independent of `close-button`'s hit
 *   target size -- shrinks in the `inline` variant while the hit target stays full-size.
 * @cssprop [--lr-callout-background=var(--lr-color-surface)] - The callout surface's background.
 *   Each non-neutral `variant` sets it to that variant's `-quiet` tint.
 * @cssprop [--lr-callout-border=var(--lr-color-border)] - The callout surface's border color. Each
 *   non-neutral `variant` sets it to that variant's loud color.
 * @cssprop [--lr-callout-color=var(--lr-color-text)] - The callout's text color. Each non-neutral
 *   `variant` sets it to that variant's loud color.
 */
export class LyraCallout extends LyraElement<LyraCalloutEventMap> {
  static styles = [LyraElement.styles, styles];
  @property({ reflect: true }) variant: CalloutVariant = 'neutral';
  @property() heading = '';
  @property({ type: Boolean, reflect: true }) closable = false;
  @property({ type: Boolean, reflect: true }) inline = false;
  @property({ type: Boolean, reflect: true }) open = true;
  @property({ attribute: 'accessible-label' }) accessibleLabel = '';
  @state() private hasIcon = false;
  @state() private hasHeading = false;
  private close = (): void => {
    const event = this.emit('lr-close', undefined, { cancelable: true });
    if (!event.defaultPrevented) this.open = false;
  };
  private onSlotChange = (event: Event): void => {
    const slot = event.target as HTMLSlotElement;
    const present = slot.assignedElements({ flatten: true }).length > 0;
    if (slot.name === 'icon') this.hasIcon = present;
    if (slot.name === 'heading') this.hasHeading = present;
  };
  render(): TemplateResult {
    if (!this.open) return html``;
    const label = this.accessibleLabel || this.getAttribute('aria-label') || undefined;
    return html`<div part="base" role="${this.variant === 'danger' ? 'alert' : 'status'}" aria-label=${label || nothing}>
      <span part="icon" ?hidden=${!this.hasIcon}><slot name="icon" @slotchange=${this.onSlotChange}></slot></span>
      <div part="content">
        <div part="heading" ?hidden=${!this.heading && !this.hasHeading}>${this.heading}<slot name="heading" @slotchange=${this.onSlotChange}></slot></div>
        <div part="message"><slot></slot></div>
      </div>
      <button part="close-button" ?hidden=${!this.closable} aria-label=${this.localize('close')} @click=${this.close}><span part="close-icon" aria-hidden="true">×</span></button>
    </div>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-callout': LyraCallout; } }
