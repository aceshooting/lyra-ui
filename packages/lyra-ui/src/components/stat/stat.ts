import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { chevronIcon } from '../../internal/icons.js';
import { srOnly } from '../../internal/a11y.js';
import { styles } from './stat.styles.js';

export type StatVariant = 'neutral' | 'success' | 'warning' | 'danger';
export type StatGoodDirection = 'up' | 'down';
export interface StatRow {
  label: string;
  value: string;
}

/**
 * `<lyra-stat>` — a KPI/stat card. First-party invention consolidating the
 * "metric row" / "KPI card" pattern common to dashboard UIs.
 *
 * @customElement lyra-stat
 * @slot - Leading icon.
 * @slot caption - Rich caption content (overrides the `caption` attribute).
 * @slot spark - A sparkline (e.g. `<lyra-sparkline>`) or other compact trend
 *   visual. `lyra-stat` only reserves the slot; it doesn't render one itself.
 * @slot sub - Rich sub-line content (overrides the `sub` attribute).
 * @csspart base - The component's root wrapper.
 * @csspart icon - Container for the leading icon slot.
 * @csspart label - The label text.
 * @csspart value-row - Wrapper around the value and unit.
 * @csspart value - The value text.
 * @csspart unit - The unit text.
 * @csspart trend - The trend pill.
 * @csspart sub - Container for the `sub` attribute/slot.
 * @csspart spark - Container for the `spark` slot.
 * @csspart caption - Container for the caption attribute/slot.
 * @csspart rows - Container for the `rows` breakdown list.
 * @csspart row - A single breakdown row (one per `rows` entry).
 * @csspart row-label - The label text of a breakdown row.
 * @csspart row-value - The value text of a breakdown row.
 */
export class LyraStat extends LyraElement {
  static styles = [LyraElement.styles, styles, srOnly];

  @property() label = '';
  @property() value = '';
  @property() unit = '';
  @property({ reflect: true }) variant: StatVariant = 'neutral';
  @property({ type: Number }) trend = NaN;
  @property() caption = '';
  /** Which trend direction counts as "good" — inverts arrow/color polarity for
   *  cost/latency/error-rate-style metrics where a decrease is the win. */
  @property({ attribute: 'good-direction' }) goodDirection: StatGoodDirection = 'up';
  /** Breakdown rows rendered as a simple label/value list beneath the caption. */
  @property({ attribute: false }) rows: StatRow[] = [];
  /** Visual emphasis (e.g. for a "headline" stat in a group) — orthogonal to
   *  the status `variant`; see the `[part='value']` selector below for how
   *  the two combine. */
  @property({ type: Boolean, reflect: true }) emphasis = false;
  /** Exact value shown as a hover/focus tooltip on the headline `value` (e.g. `value="$1.2K"
   *  exact-value="$1,204.37"`). Also makes `[part='value']` keyboard-focusable so the tooltip is
   *  reachable without a pointer. */
  @property({ attribute: 'exact-value' }) exactValue = '';
  /** A secondary line distinct from `caption` (e.g. a comparison-period label), rendered between the
   *  trend pill and the caption. */
  @property() sub = '';
  /** Renders `value` as smaller/lighter prose (e.g. a loading/status message) instead of the bold
   *  numeric headline style, and hides `unit`. */
  @property({ type: Boolean, reflect: true }) prose = false;
  /** Tighter padding for constrained spaces — same convention as `lyra-empty`'s `compact`. */
  @property({ type: Boolean, reflect: true }) compact = false;

  // Same fix `lyra-empty` already established: `[part]:empty` never matches
  // because the part always contains a literal `<slot>` child. Track real
  // slot assignment in JS instead.
  @state() private hasIcon = false;
  @state() private hasCaptionSlot = false;
  @state() private hasSparkSlot = false;
  @state() private hasSubSlot = false;

  protected willUpdate(): void {
    if (!this.hasUpdated) {
      this.hasIcon = Array.from(this.children).some((el) => !el.hasAttribute('slot'));
      this.hasCaptionSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'caption');
      this.hasSparkSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'spark');
      this.hasSubSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'sub');
    }
  }

  private onIconSlotChange = (e: Event): void => {
    this.hasIcon = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onCaptionSlotChange = (e: Event): void => {
    this.hasCaptionSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onSparkSlotChange = (e: Event): void => {
    this.hasSparkSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onSubSlotChange = (e: Event): void => {
    this.hasSubSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  render(): TemplateResult {
    const hasTrend = !isNaN(this.trend);
    const rawDirection = this.trend > 0 ? 'up' : this.trend < 0 ? 'down' : 'flat';
    const isGood = rawDirection === 'flat' ? null : rawDirection === this.goodDirection;
    // The trend pill previously rendered literal ▲/▼ glyphs — font-dependent
    // and inconsistent with the rest of the icon set — swapped for the
    // shared chevronIcon(), rotated per direction via CSS on the wrapping
    // [part='trend'].
    const arrow = rawDirection === 'flat' ? '–' : chevronIcon();
    const hasCaption = this.hasCaptionSlot || this.caption.length > 0;
    const hasSub = this.hasSubSlot || this.sub.length > 0;
    // The visible pill only ever shows the icon rotation + color to convey
    // direction and good/bad polarity; both are invisible to screen readers,
    // so mirror them into a plain-language sr-only announcement.
    const trendAnnouncement =
      rawDirection === 'flat'
        ? 'unchanged'
        : `${rawDirection === 'up' ? 'increased' : 'decreased'} ${Math.abs(this.trend)}%${
            isGood == null ? '' : isGood ? ', good' : ', bad'
          }`;

    return html`
      <div part="base">
        <span part="icon" ?hidden=${!this.hasIcon}
          ><slot @slotchange=${this.onIconSlotChange}></slot
        ></span>
        <span part="label">${this.label}</span>
        <div part="value-row">
          <span part="value" title=${this.exactValue || nothing} tabindex=${this.exactValue ? '0' : nothing}
            >${this.value}</span
          >
          <span part="unit">${this.unit}</span>
        </div>
        ${hasTrend
          ? html`<span
              part="trend"
              data-direction=${rawDirection}
              data-polarity=${isGood == null ? nothing : isGood ? 'good' : 'bad'}
            >
              <span aria-hidden="true">${arrow} ${Math.abs(this.trend)}%</span>
              <span class="sr-only">${trendAnnouncement}</span>
            </span>`
          : nothing}
        <div part="sub" ?hidden=${!hasSub}>
          ${this.sub}<slot name="sub" @slotchange=${this.onSubSlotChange}></slot>
        </div>
        <div part="spark" ?hidden=${!this.hasSparkSlot}>
          <slot name="spark" @slotchange=${this.onSparkSlotChange}></slot>
        </div>
        <div part="caption" ?hidden=${!hasCaption}>
          <slot name="caption" @slotchange=${this.onCaptionSlotChange}>${this.caption}</slot>
        </div>
        <div part="rows" ?hidden=${this.rows.length === 0}>
          ${this.rows.map(
            (row) => html`
              <div part="row">
                <span part="row-label">${row.label}</span>
                <span part="row-value">${row.value}</span>
              </div>
            `,
          )}
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
