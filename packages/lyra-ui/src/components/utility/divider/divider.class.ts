import { literalSetConverter } from '../../../internal/converters.js';
import { normalizeLabel } from '../../../internal/accessible-name.js';
import { html, isServer, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraOrientation } from '../../../internal/shared-unions.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import { styles } from './divider.styles.js';

export type LyraDividerOrientation = LyraOrientation;
const orientationValues = literalSetConverter(['horizontal', 'vertical'], 'horizontal');

/** Where a divider's label sits along the line. */
export type LyraDividerLabelPlacement = 'start' | 'center' | 'end';
const labelPlacementValues = literalSetConverter(['start', 'center', 'end'], 'center');

/**
 * `<lr-divider>` — a themeable semantic separator.
 *
 * @customElement lr-divider
 * @slot - Optional label shown on the line (placed by `label-placement`). A labeled divider keeps
 * `role="separator"`; the label text becomes its accessible name unless the host sets `aria-label`.
 * @csspart base - The separator element (an `<hr>` when unlabeled, a `div` when labeled).
 * @csspart line - Each line segment of a labeled divider.
 * @csspart line-start - The line segment before the label.
 * @csspart line-end - The line segment after the label.
 * @csspart label - The container that wraps the label.
 * @cssprop [--color=var(--lr-color-border-subtle)] - Separator color.
 * @cssprop [--spacing=0] - Space on both block sides (inline sides when vertical).
 * @cssprop [--label-spacing=var(--lr-space-s)] - Space between the label and the line segments.
 * @cssprop [--label-offset=2em] - Length of the short line segment when the label is placed at the
 * `start` or `end`.
 * @cssprop [--width=var(--lr-border-width-thin)] - Separator thickness.
 * @status stable
 * @since 4.0.0
 */
export class LyraDivider extends LyraElement {
  static override styles = [LyraElement.styles, styles];
  private _orientation: LyraDividerOrientation = 'horizontal';
  /** Base orientation. The vertical shorthand takes precedence when present.
   * @default 'horizontal' */
  @property({ reflect: true, converter: orientationValues })
  get orientation(): LyraDividerOrientation { return this._orientation; }
  set orientation(value: LyraDividerOrientation) {
    const previous = this._orientation;
    this._orientation = orientationValues.normalizeReflected(this, 'orientation', value);
    this.requestUpdate('orientation', previous);
  }
  /** Shoelace-compatible vertical-orientation shorthand. */
  @property({ type: Boolean, reflect: true }) vertical = false;
  /** Where the label sits along the line: `start`, `center` or `end`. Unsupported values fall back
   * to `center`.
   * @default 'center' */
  @property({ attribute: 'label-placement', reflect: true, converter: labelPlacementValues })
  labelPlacement: LyraDividerLabelPlacement = 'center';
  /** Reflects whether a label is slotted. In the browser it always follows the real slot content;
   * set it on server-rendered markup so the labeled layout is present before hydration. */
  @property({ attribute: 'with-label', type: Boolean, reflect: true }) withLabel = false;
  private readonly slotPresence = new SlotPresenceController(this, { observeLightDom: true });

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (!isServer) this.withLabel = this.slotPresence.hasResolved();
  }

  override render(): TemplateResult {
    const orientation: LyraDividerOrientation =
      this.vertical || this.orientation === 'vertical' ? 'vertical' : 'horizontal';
    if (this.withLabel) {
      const name = normalizeLabel(this.getAttribute('aria-label')) ?? (this.textContent?.trim() || undefined);
      return html`<div
        part="base"
        role="separator"
        aria-orientation=${orientation}
        aria-label=${name ?? nothing}
      >
        <span part="line line-start"></span>
        <span part="label"><slot></slot></span>
        <span part="line line-end"></span>
      </div>`;
    }
    return html`<hr
      part="base"
      role="separator"
      aria-orientation=${orientation}
      aria-label=${normalizeLabel(this.getAttribute('aria-label')) ?? nothing}
    >`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-divider': LyraDivider; } }
