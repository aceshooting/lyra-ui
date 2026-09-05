import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { finiteInteger, finiteNumber } from '../../../internal/numbers.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { sanitizeCssColor } from '../../../internal/safe-css.js';
import { styles } from './funnel.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_chart, LYRA_DEFAULT_comparePanel, LYRA_DEFAULT_contextMeterLabeledSummary, LYRA_DEFAULT_noData, LYRA_DEFAULT_statTrendDecreased, LYRA_DEFAULT_statTrendIncreased, LYRA_DEFAULT_trendUnchanged } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** One ordered step of a conversion funnel. */
export interface LyraFunnelStage {
  /** Stage name, rendered beside the bar and read as the row's own text. Caller-owned copy. */
  readonly label: string;
  /** Absolute count or measure for the stage. Non-finite input is treated as 0. */
  readonly value: number;
  /** CSS color for this stage's bar. Unparseable values fall back to the shared bar color. */
  readonly color?: string;
}

/** The largest fraction-digit count Intl.NumberFormat accepts. */
const MAX_SHARE_PRECISION = 20;

interface ResolvedStage {
  readonly stage: LyraFunnelStage;
  readonly value: number;
  /** Share of the FIRST stage, or null when the first stage cannot define one. */
  readonly share: number | null;
  /** Change from the previous stage, or null for the first stage / a non-positive predecessor. */
  readonly change: number | null;
  /** The comparison series' share of ITS OWN first stage, or null when unpaired. */
  readonly comparisonShare: number | null;
}

/**
 * `<lr-funnel>` — a dependency-free conversion funnel: an ordered set of stages, each drawn as a
 * bar whose length is that stage's share of the FIRST stage, read top-to-bottom as progressive
 * drop-off.
 *
 * This is an analytics primitive rather than a general chart type — a sibling of `<lr-gauge>` and
 * `<lr-heatmap>` rather than of the Chart.js-backed chart family, and it pulls no charting peer.
 * It renders plain HTML, so stage names, absolute values, shares and drop-off percentages are real
 * text in the DOM rather than a sighted-only drawing with a separate transcript bolted on.
 *
 * A funnel is deliberately not a sorted bar chart: it normalizes to the first stage instead of the
 * data maximum, draws no value axis, and reads as stage-to-stage retention rather than category
 * comparison.
 *
 * Degenerate inputs are defined rather than avoided:
 *
 * - An empty series renders the localized empty state and no list.
 * - A single stage renders one full-length bar and no drop-off row.
 * - A zero or negative first stage cannot define a share, so shares and drop-off percentages are
 *   omitted, every bar is zero-length, and the absolute values still render.
 * - A stage larger than its predecessor (funnel re-entry) reports its true share above 100% in
 *   text while its bar clamps to the track, carrying the extra bar-overflow part token.
 *   Finite values whose positive ratio overflows also fill the main or comparison track.
 * - A comparison series of a different length pairs by index: extra comparison entries are
 *   ignored, and stages past its end simply get no comparison bar.
 * - Malformed/non-record entries and records without a string `label` are omitted while later
 *   valid neighbors remain in either series; caller-owned arrays are never rewritten.
 *
 * @customElement lr-funnel
 * @csspart base - The container element.
 * @csspart stages - The ordered list of stages.
 * @csspart stage - One stage row.
 * @csspart dropoff - The change from the previous stage, above each stage after the first.
 * @csspart stage-header - The text row above a stage's bar.
 * @csspart stage-label - A stage's name.
 * @csspart stage-value - A stage's absolute value.
 * @csspart stage-share - A stage's share of the first stage.
 * @csspart comparison-value - The comparison series' share for a stage.
 * @csspart track - The full-length groove a stage's bar is drawn in.
 * @csspart bar - A stage's bar.
 * @csspart bar-overflow - Added to bar when the stage exceeds the first stage.
 * @csspart comparison-bar - The comparison series' outline drawn behind a stage's bar.
 * @csspart empty - The empty state shown when there are no stages.
 * @cssprop [--lr-funnel-bar-color=var(--lr-color-brand)] - Fill of every stage bar that has no own color.
 * @cssprop [--lr-funnel-comparison-color=var(--lr-color-border-strong)] - Outline of the comparison bars.
 * @cssprop [--lr-funnel-track-color=var(--lr-color-surface-raised)] - Background of the bar track.
 * @cssprop [--lr-funnel-bar-size=var(--lr-size-1-5rem)] - Thickness of a stage's track.
 * @status experimental
 * @since 12.0.0
 */
export class LyraFunnel extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    chart: LYRA_DEFAULT_chart,
    comparePanel: LYRA_DEFAULT_comparePanel,
    contextMeterLabeledSummary: LYRA_DEFAULT_contextMeterLabeledSummary,
    noData: LYRA_DEFAULT_noData,
    statTrendDecreased: LYRA_DEFAULT_statTrendDecreased,
    statTrendIncreased: LYRA_DEFAULT_statTrendIncreased,
    trendUnchanged: LYRA_DEFAULT_trendUnchanged,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** The ordered stages, first to last. Every share is measured against the first entry. */
  @property({ attribute: false }) stages: readonly LyraFunnelStage[] = [];

  /**
   * An optional baseline/peer cohort drawn behind each bar as an outline. It is normalized to its
   * OWN first stage, so a funnel's shape stays comparable against a baseline whose absolute
   * volumes are not comparable at all.
   */
  @property({ attribute: false }) comparison: readonly LyraFunnelStage[] = [];

  /** Name for the comparison series. Falls back to a localized generic label. */
  @property({ attribute: 'comparison-label' }) comparisonLabel = '';

  /** Accessible name for the stage list. A host `aria-label` wins over it. */
  @property() label = '';

  /** Whether the change from the previous stage is rendered above each later stage. */
  @property({ type: Boolean, reflect: true, converter: trueDefaultBooleanConverter })
  dropoff = true;

  /** Fraction digits used for every share and drop-off percentage. */
  @property({ type: Number, attribute: 'share-precision' }) sharePrecision = 0;

  private get precision(): number {
    return finiteInteger(this.sharePrecision, 0, 0, MAX_SHARE_PRECISION);
  }

  private formatValue(value: number): string {
    return getNumberFormat(this.effectiveLocale).format(value);
  }

  private formatShare(ratio: number): string {
    const precision = this.precision;
    return getNumberFormat(this.effectiveLocale, {
      style: 'percent',
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    }).format(ratio);
  }

  private validStages(value: unknown): readonly LyraFunnelStage[] {
    if (!Array.isArray(value)) return [];
    const stages: LyraFunnelStage[] = [];
    for (let index = 0; index < value.length; index += 1) {
      try {
        const stage: unknown = value[index];
        if (!stage || typeof stage !== 'object' || Array.isArray(stage)) continue;
        const record = stage as {
          readonly label?: unknown;
          readonly value?: unknown;
          readonly color?: unknown;
        };
        if (typeof record.label !== 'string') continue;
        stages.push(
          Object.freeze({
            label: record.label,
            value:
              typeof record.value === 'number'
                ? finiteNumber(record.value, 0)
                : 0,
            ...(typeof record.color === 'string'
              ? { color: record.color }
              : {}),
          })
        );
      } catch {
        // Keep later valid stage records when an untyped record/getter fails.
      }
    }
    return stages;
  }

  /** Resolves every stage's geometry and text inputs in one pass so render stays declarative. */
  private resolveStages(): ResolvedStage[] {
    const stages = this.validStages(this.stages);
    const comparison = this.validStages(this.comparison);
    const values = stages.map((stage) => finiteNumber(stage.value, 0));
    const base = values[0] ?? 0;
    // A zero or negative first stage cannot define "share of the first stage" at all: every ratio
    // would be infinite, undefined, or sign-flipped. Reporting no share is the truthful answer.
    const hasBase = base > 0;
    const comparisonValues = comparison.map((stage) => finiteNumber(stage.value, 0));
    const comparisonBase = comparisonValues[0] ?? 0;
    const hasComparisonBase = comparisonBase > 0;

    return stages.map((stage, index) => {
      const value = values[index] ?? 0;
      const previous = values[index - 1];
      const comparisonValue = comparisonValues[index];
      return {
        stage,
        value,
        share: hasBase ? value / base : null,
        change:
          index > 0 && previous !== undefined && previous > 0
            ? (value - previous) / previous
            : null,
        comparisonShare:
          hasComparisonBase && comparisonValue !== undefined
            ? comparisonValue / comparisonBase
            : null,
      };
    });
  }

  /** Clamped bar length as a CSS percentage; a share above 1 fills the track without spilling. */
  private barLength(share: number | null): string {
    const ratio = share === null ? 0 : finiteNumber(Math.min(1, Math.max(0, share)), 0);
    return `${ratio * 100}%`;
  }

  private changeText(change: number): string {
    if (change === 0) return this.localize('trendUnchanged');
    return this.localize(change > 0 ? 'statTrendIncreased' : 'statTrendDecreased', undefined, {
      value: this.formatShare(Math.abs(change)),
    });
  }

  private renderStage(resolved: ResolvedStage): TemplateResult {
    const { stage, value, share, change, comparisonShare } = resolved;
    const barColor = sanitizeCssColor(stage.color);
    const barPart = share !== null && share > 1 ? 'bar bar-overflow' : 'bar';
    const comparisonName = this.comparisonLabel || this.localize('comparePanel');
    return html`<li part="stage">
      ${this.dropoff && change !== null
        ? html`<span part="dropoff">${this.changeText(change)}</span>`
        : nothing}
      <span part="stage-header">
        <span part="stage-label">${stage.label}</span>
        <span part="stage-value">${this.formatValue(value)}</span>
        ${share === null
          ? nothing
          : html`<span part="stage-share">${this.formatShare(share)}</span>`}
        ${comparisonShare === null
          ? nothing
          : html`<span part="comparison-value"
              >${this.localize('contextMeterLabeledSummary', undefined, {
                label: comparisonName,
                summary: this.formatShare(comparisonShare),
              })}</span
            >`}
      </span>
      <span part="track">
        ${comparisonShare === null
          ? nothing
          : html`<span
              part="comparison-bar"
              style=${styleMap({ inlineSize: this.barLength(comparisonShare) })}
            ></span>`}
        <span
          part=${barPart}
          style=${styleMap({
            inlineSize: this.barLength(share),
            ...(barColor === undefined ? {} : { backgroundColor: barColor }),
          })}
        ></span>
      </span>
    </li>`;
  }

  override render(): TemplateResult {
    const resolved = this.resolveStages();
    if (resolved.length === 0) {
      return html`<div part="base"><p part="empty">${this.localize('noData')}</p></div>`;
    }
    const name = hostAriaLabel(this) ?? (this.label || this.localize('chart'));
    return html`<div part="base">
      <ol part="stages" aria-label=${name}>
        ${resolved.map((entry) => this.renderStage(entry))}
      </ol>
    </div>`;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-funnel': LyraFunnel;
  }
}
