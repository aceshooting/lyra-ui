import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { chevronIcon } from '../../internal/icons.js';
import { styles } from './stat.styles.js';

export type StatVariant = 'neutral' | 'success' | 'warning' | 'danger';
export type StatGoodDirection = 'up' | 'down';

/**
 * `<lyra-stat>` — a KPI/stat card. First-party invention consolidating the
 * "metric row" / "KPI card" pattern reinvented in every surveyed repo.
 *
 * @customElement lyra-stat
 * @slot - Leading icon.
 * @slot caption - Rich caption content (overrides the `caption` attribute).
 * @csspart base, icon, label, value, unit, trend, caption
 */
export class LyraStat extends LyraElement {
  static styles = [LyraElement.styles, styles];

  @property() label = '';
  @property() value = '';
  @property() unit = '';
  @property({ reflect: true }) variant: StatVariant = 'neutral';
  @property({ type: Number }) trend = NaN;
  @property() caption = '';
  /** Which trend direction counts as "good" — inverts arrow/color polarity for
   *  cost/latency/error-rate-style metrics where a decrease is the win. */
  @property({ attribute: 'good-direction' }) goodDirection: StatGoodDirection = 'up';

  // Same fix `lyra-empty` already established: `[part]:empty` never matches
  // because the part always contains a literal `<slot>` child. Track real
  // slot assignment in JS instead (2026-07-10 audit, "dashboard-atoms"
  // §lyra-stat, High).
  @state() private hasIcon = false;
  @state() private hasCaptionSlot = false;

  protected willUpdate(): void {
    if (!this.hasUpdated) {
      this.hasIcon = Array.from(this.children).some((el) => !el.hasAttribute('slot'));
      this.hasCaptionSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'caption');
    }
  }

  private onIconSlotChange = (e: Event): void => {
    this.hasIcon = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onCaptionSlotChange = (e: Event): void => {
    this.hasCaptionSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  render(): TemplateResult {
    const hasTrend = !isNaN(this.trend);
    const rawDirection = this.trend > 0 ? 'up' : this.trend < 0 ? 'down' : 'flat';
    const isGood = rawDirection === 'flat' ? null : rawDirection === this.goodDirection;
    // 2026-07-10 design review, "dashboard-atoms" §lyra-stat: the trend
    // pill rendered literal ▲/▼ glyphs — font-dependent and inconsistent
    // with the rest of the icon set — swapped for the shared chevronIcon(),
    // rotated per direction via CSS on the wrapping [part='trend'].
    const arrow = rawDirection === 'flat' ? '–' : chevronIcon();
    const hasCaption = this.hasCaptionSlot || this.caption.length > 0;

    return html`
      <div part="base">
        <span part="icon" ?hidden=${!this.hasIcon}
          ><slot @slotchange=${this.onIconSlotChange}></slot
        ></span>
        <span part="label">${this.label}</span>
        <div part="value-row">
          <span part="value">${this.value}</span>
          <span part="unit">${this.unit}</span>
        </div>
        ${hasTrend
          ? html`<span
              part="trend"
              data-direction=${rawDirection}
              data-polarity=${isGood == null ? nothing : isGood ? 'good' : 'bad'}
            >
              <span aria-hidden="true">${arrow}</span> ${Math.abs(this.trend)}%
            </span>`
          : nothing}
        <div part="caption" ?hidden=${!hasCaption}>
          <slot name="caption" @slotchange=${this.onCaptionSlotChange}>${this.caption}</slot>
        </div>
      </div>
    `;
  }
}

defineElement('stat', LyraStat);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-stat': LyraStat;
  }
}
