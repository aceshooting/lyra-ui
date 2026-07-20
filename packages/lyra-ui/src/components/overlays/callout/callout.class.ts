import { html, nothing, type ComplexAttributeConverter, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './callout.styles.js';

export type CalloutVariant = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';
export interface LyraCalloutEventMap { 'lr-close': CustomEvent<undefined>; }

/** `true`-defaulting boolean attribute converter, identical shape to `<lr-task-list>`'s
 *  `trueDefaultBooleanConverter` -- duplicated locally per this library's convention of not
 *  sharing these tiny converters across independently-consumable component files. Lit's default
 *  presence-based `type: Boolean` can never be set back to `false` from a plain-HTML attribute
 *  once the property's own default is `true` (removing an attribute that was never present fires
 *  no `attributeChangedCallback`), so `fromAttribute` checks the literal string instead.
 *  `toAttribute` reflects the `true` state as a present (empty-string) attribute rather than
 *  omitting it, matching every other `reflect: true` boolean property in this library. */
const trueDefaultBooleanConverter: ComplexAttributeConverter<boolean> = {
  fromAttribute(value): boolean {
    return value !== 'false';
  },
  toAttribute(value): string | null {
    return value ? '' : null;
  },
};

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
 * @cssprop [--lr-callout-close-hover-bg=var(--lr-color-brand-quiet)] - The close button's hover
 *   background, decoupled from `--lr-callout-background` so a consumer can retint one without
 *   affecting the other (e.g. keeping the hover fill visibly distinct from a `variant="brand"`
 *   panel, which shares the same default token).
 */
export class LyraCallout extends LyraElement<LyraCalloutEventMap> {
  static styles = [LyraElement.styles, styles];
  @property({ reflect: true }) variant: CalloutVariant = 'neutral';
  @property() heading = '';
  @property({ type: Boolean, reflect: true }) closable = false;
  @property({ type: Boolean, reflect: true }) inline = false;
  /** Whether the callout is shown. Defaults `true`; uses `trueDefaultBooleanConverter` (above) so
   *  plain HTML `open="false"` actually renders it closed -- Lit's default presence-based
   *  `type: Boolean` converter cannot distinguish an absent attribute from the literal string
   *  `"false"`. */
  @property({ type: Boolean, reflect: true, converter: trueDefaultBooleanConverter }) open = true;
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
