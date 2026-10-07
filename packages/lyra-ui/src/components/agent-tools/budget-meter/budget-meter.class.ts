import { hostAriaLabel } from '../../../internal/a11y.js';
import { finiteNumber, finiteRatio } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './budget-meter.styles.js';
import { resolveHeadingLevel, type LyraHeadingLevel } from '../../../internal/heading-level.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_budgetMeterExceeded, LYRA_DEFAULT_budgetMeterLabel, LYRA_DEFAULT_budgetMeterPercent, LYRA_DEFAULT_budgetMeterUnavailable, LYRA_DEFAULT_budgetMeterValue } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/**
 * `<lr-budget-meter>` — a presentation-only view of a host-supplied quantity and limit. Its visual
 * fill clamps at the limit while the localized value text retains the actual quantities. It does
 * not price usage, enforce limits, or take action when the budget is exceeded.
 *
 * @customElement lr-budget-meter
 * @csspart base - The component wrapper and semantic group.
 * @csspart label - The visible meter label.
 * @csspart meter - The progressbar, present only for a positive finite limit.
 * @csspart track - The meter track.
 * @csspart fill - The clamped visual fill.
 * @csspart percent - The localized percentage text.
 * @csspart value - The actual localized used and limit quantities.
 * @csspart unavailable - The unavailable state for a zero or invalid limit.
 * @csspart exceeded - The localized over-budget state.
 * @status experimental
 * @since 22.0.0
 */
export class LyraBudgetMeter extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    budgetMeterExceeded: LYRA_DEFAULT_budgetMeterExceeded,
    budgetMeterLabel: LYRA_DEFAULT_budgetMeterLabel,
    budgetMeterPercent: LYRA_DEFAULT_budgetMeterPercent,
    budgetMeterUnavailable: LYRA_DEFAULT_budgetMeterUnavailable,
    budgetMeterValue: LYRA_DEFAULT_budgetMeterValue,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** Host-reported usage quantity, normalized to a finite nonnegative value for display. */
  @property({ type: Number }) used = 0;
  /** Host-reported capacity; a nonpositive or invalid value makes the meter unavailable. */
  @property({ type: Number }) limit = 0;
  /** Optional host-supplied unit label, shown with the actual quantities. */
  @property() unit?: string;
  /** Level of the visible title: `'1'`-`'6'`, or `'none'` for no heading semantics. */
  @property({ attribute: 'heading-level' }) headingLevel: LyraHeadingLevel = '2';
  /** Accessible group name and visible label. */
  @property() label?: string;

  private get safeUsed(): number {
    return Math.max(0, finiteNumber(this.used, 0));
  }

  private get safeLimit(): number {
    return Math.max(0, finiteNumber(this.limit, 0));
  }

  private formatValue(value: number): string {
    return getNumberFormat(this.effectiveLocale, { maximumFractionDigits: 2 }).format(value);
  }

  private valueText(): string {
    return this.localize('budgetMeterValue', undefined, {
      used: this.formatValue(this.safeUsed),
      limit: this.formatValue(this.safeLimit),
      unit: this.unit ?? '',
    }).trim();
  }

  override render(): TemplateResult {
    const visibleLabel = this.label == null ? this.localize('budgetMeterLabel') : this.label;
    const hostLabel = hostAriaLabel(this);
    const used = this.safeUsed;
    const limit = this.safeLimit;
    const available = limit > 0;
    const ratio = available ? finiteRatio(used, 0, limit) : 0;
    const percentage = available ? getNumberFormat(this.effectiveLocale, {
      style: 'percent',
      maximumFractionDigits: 0,
    }).format(ratio) : '';
    const ariaValueNow = Math.min(used, limit);
    const level = resolveHeadingLevel(this.headingLevel ?? '2');
    return html`
      <section part="base" role="group" aria-label=${hostLabel === null ? nothing : hostLabel}>
        ${visibleLabel === '' ? nothing : html`<div part="label" role=${level ? 'heading' : nothing} aria-level=${level ?? nothing}>${visibleLabel}</div>`}
        ${available
          ? html`
              <div
                part="meter"
                role="progressbar"
                aria-label=${hostLabel ?? visibleLabel}
                aria-valuemin="0"
                aria-valuemax=${String(limit)}
                aria-valuenow=${String(ariaValueNow)}
                aria-valuetext=${this.valueText()}
              >
                <span part="track"><span part="fill" style=${styleMap({ inlineSize: `${ratio * 100}%` })}></span></span>
              </div>
              <span part="percent">${this.localize('budgetMeterPercent', undefined, { percent: percentage })}</span>
            `
          : html`<p part="unavailable">${this.localize('budgetMeterUnavailable')}</p>`}
        <p part="value">${this.valueText()}</p>
        ${available && used > limit ? html`<p part="exceeded">${this.localize('budgetMeterExceeded')}</p>` : nothing}
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-budget-meter': LyraBudgetMeter;
  }
}
