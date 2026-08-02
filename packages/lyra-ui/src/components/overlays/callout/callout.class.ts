import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraAppearance, LyraSize, LyraVariant } from '../../../internal/variants.js';
import { contextualSizes, contextualVariants } from '../../../internal/contextual-vocabulary.styles.js';
import { styles } from './callout.styles.js';
import { presenceTrueDefaultBooleanConverter as trueDefaultBooleanConverter } from '../../../internal/converters.js';

/** The library's one semantic-tone vocabulary. */
export type CalloutVariant = LyraVariant;
/** The library's shared fill/border treatment vocabulary. */
export type CalloutAppearance = LyraAppearance;
/** The library's one size ladder, in either spelling. */
export type CalloutSize = LyraSize;
export interface LyraCalloutEventMap { 'lr-close': CustomEvent<undefined>; }

/**
 * `<lr-callout>` — an inline message surface for status, warning, and error content.
 * Set `inline` for lightweight reactive status/error text: it removes the panel chrome while
 * preserving the semantic role, optional leading icon, and close action.
 * Initial content is not announced as a new live update. Once the first render and slot
 * distribution settle, the region is armed: later updates are polite, or assertive for
 * `variant="danger"`.
 *
 * @customElement lr-callout
 * @slot - Message content.
 * @slot heading - Optional heading.
 * @slot icon - Optional icon.
 * @event lr-close - The close action was accepted. Cancelable before the callout hides.
 * @attr inline - Uses the lightweight inline treatment without border, background, or panel padding.
 * @csspart base - The semantic grid wrapper inside the host-owned callout surface.
 * @csspart icon - The icon wrapper.
 * @csspart content - The message content.
 * @csspart heading - The heading wrapper.
 * @csspart message - The message content wrapper.
 * @csspart close-button - The close button's interactive hit target, sized to the shared minimum
 *   tappable size (`--lr-icon-button-size`) in both the default panel and the compact `inline`
 *   variant.
 * @csspart close-icon - The close button's visible "×" glyph, independent of `close-button`'s hit
 *   target size -- shrinks in the `inline` variant while the hit target stays full-size.
 * @cssprop [--lr-callout-background=var(--lr-color-fill-quiet,var(--lr-color-brand-fill-quiet))] -
 *   The host surface's background: an inherited semantic quiet fill, with brand as the standalone
 *   fallback.
 * @cssprop [--lr-callout-border=var(--lr-color-fill-loud,var(--lr-color-brand-fill-loud))] - The
 *   host surface's border color.
 * @cssprop [--lr-callout-color=var(--lr-color-fill-loud,var(--lr-color-brand-fill-loud))] - The
 *   host surface's text color.
 * @cssprop [--lr-callout-close-hover-bg=var(--lr-color-brand-quiet)] - The close button's hover
 *   background, decoupled from `--lr-callout-background` so a consumer can retint one without
 *   affecting the other (e.g. keeping the hover fill visibly distinct from a `variant="brand"`
 *   panel, which shares the same default token).
 * @cssprop [--lr-callout-font-size=var(--lr-form-control-font-size,var(--lr-font-size-m))] - The callout's text size.
 *   Each `size` tier sets it from the library's shared size ladder.
 * @cssprop [--lr-callout-padding=var(--lr-form-control-padding-inline,var(--lr-space-m))] - Padding of the panel, on
 *   both axes. Each `size` tier sets it from the shared ladder's inline-padding knob: a panel's
 *   block rhythm is generous like a control's inline padding, not tight like its block padding
 *   (which exists to fit text inside a fixed control height). `inline` removes it entirely.
 * @cssprop [--lr-callout-gap=var(--lr-space-s)] - Space between the icon, the content, and the
 *   close action. Deliberately does not vary by `size`: it separates three adjacent boxes rather
 *   than setting the panel's density, and shrinking it at the small tiers only crowds them.
 * @status stable
 * @since 4.0.0
 */
export class LyraCallout extends LyraElement<LyraCalloutEventMap> {
  static override styles = [LyraElement.styles, contextualVariants, contextualSizes, styles];

  /** Semantic palette. The property defaults to `brand` without forcing an attribute, allowing an
   *  unset nested callout to inherit its containing semantic context. Explicitly assigning
   *  `brand` reflects it, making the standalone default an intentional local override. */
  @property({ reflect: true, useDefault: true })
  variant: CalloutVariant = 'brand';

  /** How much of the active `variant` palette is spent on fill, border, and text. Unset preserves
   *  the established callout treatment; every explicit Web Awesome appearance is reflected. */
  @property({ reflect: true }) appearance!: CalloutAppearance;

  /** Visual density, on the library's shared ladder. The `m` property default is not reflected,
   *  so an unset nested callout inherits its containing size context. Both Web Awesome spellings
   *  are accepted (`s`/`small`, `m`/`medium`, `l`/`large`). */
  @property({ reflect: true, useDefault: true })
  size: CalloutSize = 'm';

  @property() heading = '';
  @property({ type: Boolean, reflect: true }) closable = false;
  @property({ type: Boolean, reflect: true }) inline = false;

  @property({ type: Boolean, reflect: true, converter: trueDefaultBooleanConverter }) open = true;
  @property({ attribute: 'accessible-label' }) accessibleLabel = '';
  @state() private hasIcon = false;
  @state() private hasHeading = false;
  @state() private liveActive = false;
  private connectionGeneration = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    const generation = ++this.connectionGeneration;
    // The initial render commits with aria-live="off". Wait through the first slot-distribution
    // paint and any update it schedules before arming; otherwise an initially slotted heading can
    // become visible in the same update that turns announcements on.
    void this.updateComplete
      .then(() => {
        const view = this.ownerDocument?.defaultView;
        return typeof view?.requestAnimationFrame === 'function'
          ? new Promise<void>((resolve) => view.requestAnimationFrame(() => resolve()))
          : Promise.resolve();
      })
      .then(() => this.updateComplete)
      .then(() => {
        if (this.isConnected && generation === this.connectionGeneration) this.liveActive = true;
      });
  }

  override disconnectedCallback(): void {
    this.connectionGeneration += 1;
    this.liveActive = false;
    super.disconnectedCallback();
  }
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
  override render(): TemplateResult {
    if (!this.open) return html``;
    const label = this.getAttribute('aria-label') || this.accessibleLabel || undefined;
    return html`<div part="base" role="${this.variant === 'danger' ? 'alert' : 'status'}"
      aria-live=${this.liveActive ? (this.variant === 'danger' ? 'assertive' : 'polite') : 'off'}
      aria-label=${label || nothing}>
      <span part="icon" ?hidden=${!this.hasIcon}><slot name="icon" @slotchange=${this.onSlotChange}></slot></span>
      <div part="content">
        <div part="heading" ?hidden=${!this.heading && !this.hasHeading}>${this.heading}<slot name="heading" @slotchange=${this.onSlotChange}></slot></div>
        <div part="message"><slot></slot></div>
      </div>
      <button type="button" part="close-button" ?hidden=${!this.closable} aria-label=${this.localize('close')} @click=${this.close}><span part="close-icon" aria-hidden="true">×</span></button>
    </div>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-callout': LyraCallout; } }
