import type { LyraFrame, LyraSize } from '../../../internal/variants.js';
import { bdi } from '../../../internal/bidi.js';
import { normalizeLabel, resolveAccessibleName } from '../../../internal/accessible-name.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { finiteNumber, finiteRatio } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { formatChartValue } from '../../../internal/chart-number-format.js';
import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './budget-meter.styles.js';
import { resolveHeadingLevel, type LyraHeadingLevel } from '../../../internal/heading-level.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_budgetMeterExceeded, LYRA_DEFAULT_budgetMeterLabel, LYRA_DEFAULT_budgetMeterPercent, LYRA_DEFAULT_budgetMeterUnavailable, LYRA_DEFAULT_budgetMeterValue } from '../../../internal/default-strings/agent-tools.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** Locale supplied to a budget quantity display formatter. */
export interface BudgetMeterFormatContext {
  readonly locale: string;
}

/** Synchronous display hook; numeric meter semantics always use the original quantities. */
export type BudgetMeterValueFormatter = (value: number, context: BudgetMeterFormatContext) => string;

/**
 * `<lr-budget-meter>` — a presentation-only view of a host-supplied quantity and limit. Its visual
 * fill clamps at the limit while the localized value text retains the actual quantities. It does
 * not price usage, enforce limits, or take action when the budget is exceeded.
 *
 * @customElement lr-budget-meter
 * @cssprop [--lr-budget-meter-border-color] - Card border color.
 * @cssprop [--lr-budget-meter-radius] - Card and track corner radius.
 * @cssprop [--lr-budget-meter-track-bg] - Track background.
 * @cssprop [--lr-budget-meter-fill] - Fill within budget.
 * @cssprop [--lr-budget-meter-exceeded-fill] - Over-budget fill.
 * @csspart base - The component wrapper and semantic group.
 * @csspart label - The visible meter label.
 * @csspart meter - The budget meter, present only for a positive finite limit.
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

  /** Outer frame. Defaults to `card`. */
  @property({ reflect: true }) frame: LyraFrame = 'card';
  /** Layout density. Small sizes use compact spacing. */
  @property({ reflect: true }) size: LyraSize = 'm';

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

  /**
   * Optional synchronous, side-effect-free quantity formatter. Receives each normalized quantity
   * and the effective locale. Return nonblank plain text of at most 65,536 UTF-16 code units;
   * invalid results or throws restore numeric formatting for both quantities. The localized
   * value sentence and optional unit still apply. Mutating the meter invalidates the custom pair.
   */
  @property({ attribute: false }) valueFormatter?: BudgetMeterValueFormatter;

  private formatGeneration = 0;
  private formatting = false;
  private suppressFormatter = false;

  override requestUpdate(...args: Parameters<LyraElement['requestUpdate']>): void {
    this.formatGeneration = (this.formatGeneration ?? 0) + 1;
    // A callback's own update must not immediately invoke it again. An external refresh retries.
    this.suppressFormatter = this.formatting === true;
    super.requestUpdate(...args);
  }

  private get safeUsed(): number {
    return Math.max(0, finiteNumber(this.used, 0));
  }

  private get safeLimit(): number {
    return Math.max(0, finiteNumber(this.limit, 0));
  }

  private valueProjection(): { used: number; limit: number; text: string; content: (string | TemplateResult)[] } {
    const formatter = this.valueFormatter;
    const usedInput = this.used;
    const limitInput = this.limit;
    const unit = this.unit;
    const locale = this.effectiveLocale;
    const document = this.ownerDocument;
    const connected = this.isConnected;
    const generation = this.formatGeneration;
    const used = this.safeUsed;
    const limit = this.safeLimit;
    const current = (): boolean => generation === this.formatGeneration &&
      formatter === this.valueFormatter && Object.is(usedInput, this.used) &&
      Object.is(limitInput, this.limit) && unit === this.unit && locale === this.effectiveLocale &&
      document === this.ownerDocument && connected === this.isConnected;
    const valid = (value: unknown): value is string =>
      typeof value === 'string' && value.length <= 65_536 && value.trim().length > 0;
    let formattedUsed: unknown;
    let formattedLimit: unknown;
    if (typeof formatter === 'function' && !this.suppressFormatter) {
      const context: BudgetMeterFormatContext = Object.freeze({ locale });
      this.formatting = true;
      try {
        formattedUsed = formatter(used, context);
        if (current() && valid(formattedUsed)) formattedLimit = formatter(limit, context);
      } catch {
        // Both quantities retain the built-in formatter when either custom result fails.
      } finally {
        this.formatting = false;
      }
      if (!current()) this.suppressFormatter = true;
    }
    const coherent = current();
    const finalUsed = coherent ? used : this.safeUsed;
    const finalLimit = coherent ? limit : this.safeLimit;
    const finalLocale = this.effectiveLocale;
    const numberFormat = getNumberFormat(finalLocale, { maximumFractionDigits: 2 });
    const formatQuantity = (value: number): string => value > 0 && value < 0.01
      ? formatChartValue(value, finalLocale, numberFormat, 2)
      : numberFormat.format(value);
    let usedText = formatQuantity(finalUsed);
    let limitText = formatQuantity(finalLimit);
    if (coherent && valid(formattedUsed) && valid(formattedLimit)) {
      usedText = formattedUsed;
      limitText = formattedLimit;
    }
    const values = new Map([['{used}', usedText], ['{limit}', limitText], ['{unit}', this.unit ?? '']]);
    const template = this.localize('budgetMeterValue');
    const parts = template.split(/(\{used\}|\{limit\}|\{unit\})/).map(token => ({
      text: values.get(token) ?? token,
      isolate: values.has(token),
    }));
    const hasText = parts.map(part => part.text.trim().length > 0);
    const retained = parts.slice(hasText.indexOf(true), hasText.lastIndexOf(true) + 1);
    const content = retained.map((part, index) => {
      if (index === 0) part.text = part.text.trimStart();
      if (index === retained.length - 1) part.text = part.text.trimEnd();
      return part.isolate ? bdi(part.text) : part.text;
    });
    return { used: finalUsed, limit: finalLimit, text: retained.map(part => part.text).join(''), content };
  }

  override render(): TemplateResult {
    const { used, limit, text, content } = this.valueProjection();
    const defaultLabel = this.localize('budgetMeterLabel');
    const visibleLabel = this.label === '' ? '' : normalizeLabel(this.label) ?? defaultLabel;
    const hostLabel = resolveAccessibleName(this);
    const available = limit > 0;
    const ratio = available ? finiteRatio(used, 0, limit) : 0;
    const percentage = available ? getNumberFormat(this.effectiveLocale, {
      style: 'percent',
      ...(ratio > 0 && ratio < 0.01
        ? { maximumSignificantDigits: 3 }
        : { maximumFractionDigits: ratio > 0.99 && ratio < 1 ? 16 : 0 }),
    }).format(ratio) : '';
    const ariaValueNow = Math.min(used, limit);
    const level = resolveHeadingLevel(this.headingLevel, '2');
    return html`
      <section part="base" role="group" aria-label=${ifDefined(hostLabel)}>
        ${visibleLabel === '' ? nothing : html`<div part="label" role=${level ? 'heading' : nothing} aria-level=${level ?? nothing}>${visibleLabel}</div>`}
        ${available
          ? html`
              <div
                part="meter"
                role="meter"
                aria-label=${ifDefined(resolveAccessibleName(this, visibleLabel, defaultLabel))}
                aria-valuemin="0"
                aria-valuemax=${String(limit)}
                aria-valuenow=${String(ariaValueNow)}
                aria-valuetext=${text}
              >
                <span part="track"><span part="fill" ?data-exceeded=${used > limit} style=${styleMap({ inlineSize: `${ratio * 100}%` })}></span></span>
              </div>
              <span part="percent">${this.localize('budgetMeterPercent', undefined, { percent: percentage })}</span>
            `
          : html`<p part="unavailable">${this.localize('budgetMeterUnavailable')}</p>`}
        <p part="value">${content}</p>
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
