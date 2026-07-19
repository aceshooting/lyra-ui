import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { chevronIcon } from '../../../internal/icons.js';
import { nextId, srOnly } from '../../../internal/a11y.js';
import { finiteNumber } from '../../../internal/numbers.js';
import { safeLinkHref } from '../../../internal/safe-url.js';
import { styles } from './stat.styles.js';

export type StatVariant = 'neutral' | 'success' | 'warning' | 'danger';
export type StatGoodDirection = 'up' | 'down';
export interface StatRow {
  label: string;
  value: string;
  /** Exact value shown as a hover/focus tooltip on this row's `row-value` (mirrors the headline
   *  `exactValue`/`exact-value` behavior). Also makes this row's `[part='row-value']`
   *  keyboard-focusable so the tooltip is reachable without a pointer. */
  exactValue?: string;
}

/**
 * `<lr-stat>` — a KPI/stat card. First-party invention consolidating the
 * "metric row" / "KPI card" pattern common to dashboard UIs.
 *
 * @customElement lr-stat
 * @slot - Leading icon.
 * @slot caption - Rich caption content (overrides the `caption` attribute).
 * @slot spark - A sparkline (e.g. `<lr-sparkline>`) or other compact trend
 *   visual. `lr-stat` only reserves the slot; it doesn't render one itself.
 * @slot sub - Rich sub-line content (overrides the `sub` attribute).
 * @csspart base - The component's root wrapper (`<div>`, or a real `<a>` when `href` is safe).
 * @csspart icon - Container for the leading icon slot.
 * @csspart label - The label text.
 * @csspart value-row - Wrapper around the value and unit.
 * @csspart value - The value text. Accessibly labelled by the `label` part (via
 *   `aria-labelledby`) whenever `label` is set, so tabbing directly to this
 *   (focusable when `exactValue` is set) control still announces which metric it is.
 * @csspart unit - The unit text.
 * @csspart trend - The trend pill.
 * @csspart sub - Container for the `sub` attribute/slot.
 * @csspart spark - Container for the `spark` slot.
 * @csspart caption - Container for the caption attribute/slot.
 * @csspart rows - Container for the `rows` breakdown list.
 * @csspart row - A single breakdown row (one per `rows` entry).
 * @csspart row-label - The label text of a breakdown row.
 * @csspart row-value - The value text of a breakdown row. Shows the row's `exactValue` (if any) as
 *   a hover/focus tooltip, same as the headline `value`, and is accessibly labelled by its
 *   `row-label` (via `aria-labelledby`) the same way the headline `value` is.
 */
export class LyraStat extends LyraElement {
  static styles = [LyraElement.styles, styles, srOnly];

  @property() label = '';
  @property() value = '';
  @property() unit = '';
  @property({ reflect: true }) variant: StatVariant = 'neutral';
  /** When set to a safe URL, renders the whole stat as a real anchor instead of a static div. */
  @property() href?: string;
  /** Native anchor target, used only while `href` resolves to a link. */
  @property() target?: string;
  /** Native anchor relationship tokens, used only while `href` resolves to a link. */
  @property() rel?: string;

  private _trend = NaN;
  /** Percentage/delta value for the trend pill (e.g. `-12.5` renders a down arrow at "12.5%").
   *  `NaN` (the default, and what a removed `trend` attribute resolves to — Lit's `type: Number`
   *  converter maps a missing attribute to `null`, treated the same as `NaN` here) is a
   *  deliberate sentinel meaning "no trend": it hides the pill entirely and is preserved as-is,
   *  never coerced away. Any other non-finite input (e.g. a literal `trend="Infinity"` attribute)
   *  is normalized via `finiteNumber` to a flat `0` instead of rendering a bogus
   *  "Infinity%"/"-Infinity%" pill; genuine finite numbers pass through unclamped. */
  @property({ type: Number })
  get trend(): number {
    return this._trend;
  }
  set trend(value: number | null) {
    const old = this._trend;
    this._trend = value == null || Number.isNaN(value) ? NaN : finiteNumber(value, 0);
    this.requestUpdate('trend', old);
  }

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
  /** Tighter padding for constrained spaces — same convention as `lr-empty`'s `compact`. */
  @property({ type: Boolean, reflect: true }) compact = false;

  // Same fix `lr-empty` already established: `[part]:empty` never matches
  // because the part always contains a literal `<slot>` child. Track real
  // slot assignment in JS instead.
  @state() private hasIcon = false;
  @state() private hasCaptionSlot = false;
  @state() private hasSparkSlot = false;
  @state() private hasSubSlot = false;

  // Stable id pairing `[part='label']` with `[part='value']` via
  // aria-labelledby, so a keyboard user tabbing straight to the (focusable,
  // tooltip-bearing) value still gets an accessible name like "Revenue
  // $1.2K" instead of the bare value.
  private readonly labelId = nextId('stat-label');
  private readonly valueId = `${this.labelId}-value`;
  // One id per `rows` entry, regenerated only when the `rows` array itself is
  // reassigned (not on every render) so `aria-labelledby` references stay
  // stable across unrelated re-renders.
  @state() private rowLabelIds: string[] = [];

  protected willUpdate(changed: PropertyValues): void {
    if (!this.hasUpdated) {
      this.hasIcon = Array.from(this.children).some((el) => !el.hasAttribute('slot'));
      this.hasCaptionSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'caption');
      this.hasSparkSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'spark');
      this.hasSubSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'sub');
    }
    if (changed.has('rows')) {
      this.rowLabelIds = this.rows.map(() => nextId('stat-row-label'));
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
    const href = safeLinkHref(this.href);
    const linked = Boolean(href);
    // `trend`'s own accessor above already normalizes a removed/absent attribute (which Lit's
    // `type: Number` converter delivers as `null`, not `NaN`) to the same `NaN` "no trend"
    // sentinel, so `this.trend` is never actually `null` here — the `!= null` check is kept as a
    // defensive belt-and-suspenders against the static type lying.
    const hasTrend = this.trend != null && !isNaN(this.trend);
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
        ? this.localize('trendUnchanged')
        : `${this.localize(rawDirection === 'up' ? 'trendIncreased' : 'trendDecreased', undefined, { value: Math.abs(this.trend) })}${
            isGood == null ? '' : isGood ? this.localize('trendGoodSuffix') : this.localize('trendBadSuffix')
          }`;

    const content = html`
        <span part="icon" ?hidden=${!this.hasIcon}
          ><slot @slotchange=${this.onIconSlotChange}></slot
        ></span>
        <span part="label" id=${this.labelId}>${this.label}</span>
        <div part="value-row">
          <span
            part="value"
            id=${this.valueId}
            title=${this.exactValue || nothing}
            tabindex=${this.exactValue && !linked ? '0' : nothing}
            aria-labelledby=${this.label ? `${this.labelId} ${this.valueId}` : nothing}
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
          <slot name="sub" @slotchange=${this.onSubSlotChange}>${this.sub}</slot>
        </div>
        <div part="spark" ?hidden=${!this.hasSparkSlot}>
          <slot name="spark" @slotchange=${this.onSparkSlotChange}></slot>
        </div>
        <div part="caption" ?hidden=${!hasCaption}>
          <slot name="caption" @slotchange=${this.onCaptionSlotChange}>${this.caption}</slot>
        </div>
        <div part="rows" ?hidden=${this.rows.length === 0}>
          ${this.rows.map((row, i) => {
            const rowLabelId = this.rowLabelIds[i];
            const rowValueId = `${rowLabelId}-value`;
            return html`
              <div part="row">
                <span part="row-label" id=${rowLabelId}>${row.label}</span>
                <span
                  part="row-value"
                  id=${rowValueId}
                  title=${row.exactValue || nothing}
                  tabindex=${row.exactValue && !linked ? '0' : nothing}
                  aria-labelledby=${row.label ? `${rowLabelId} ${rowValueId}` : nothing}
                  >${row.value}</span
                >
              </div>
            `;
          })}
        </div>
    `;
    return href
      ? html`<a part="base" href=${href} target=${this.target || nothing} rel=${this.rel || nothing}>${content}</a>`
      : html`<div part="base">${content}</div>`;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-stat': LyraStat;
  }
}
