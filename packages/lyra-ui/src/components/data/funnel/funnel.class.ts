import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { chartValueFractionDigits } from '../../charts/chart/chart-number-format.js';
import { finiteInteger, finiteNumber } from '../../../internal/numbers.js';
import { sanitizeCssColor } from '../../../internal/safe-css.js';
import { styles } from './funnel.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_funnelComparisonShare, LYRA_DEFAULT_funnelDropoffDecreased, LYRA_DEFAULT_funnelDropoffIncreased, LYRA_DEFAULT_funnelStagesLimit, LYRA_DEFAULT_trendUnchanged } from '../../../internal/default-strings/data.generated.js';
import { LYRA_DEFAULT_chart, LYRA_DEFAULT_comparePanel, LYRA_DEFAULT_noData } from '../../../internal/default-strings/shared.generated.js';
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

/** Caps the rendered stage count so an unbounded host-supplied `stages`/`comparison` array can
 *  never mount an unbounded number of bar rows. Matches the 500-row ceiling used by every other
 *  bounded list in this library (e.g. `lr-task-list`'s `MAX_RENDERED_TASKS`). */
const MAX_RENDERED_STAGES = 500;

interface StageScan {
  readonly source: readonly unknown[];
  readonly stages: LyraFunnelStage[];
  readonly length: number;
  cursor: number;
  done: boolean;
  timer?: ReturnType<typeof setTimeout>;
}

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
 *   valid neighbors remain in either series; caller-owned arrays are never rewritten. Long invalid
 *   runs are inspected in cancelable chunks. The previous completed view remains aria-busy until
 *   both new series are ready; disconnecting or explicit refresh revokes unfinished work. Keep
 *   pending source arrays and records unchanged, or reassign/explicitly refresh to restart them.
 * - At most 500 valid stages render, each as its own bar row; a `stages` array past that length
 *   renders a localized `[part="limit"]` notice after the list rather than mounting an unbounded
 *   number of bars. Every stage's share is still measured against the true first stage regardless
 *   of truncation.
 *
 * @customElement lr-funnel
 * @csspart base - The container element.
 * @csspart stages - The ordered list of stages.
 * @csspart stage - One stage row.
 * @csspart dropoff - The change from the previous stage, above each stage after the first. Omitted
 *   while `without-dropoff` is set.
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
 * @csspart limit - Localized notice shown when `stages` exceeds the 500-stage render ceiling.
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
    funnelComparisonShare: LYRA_DEFAULT_funnelComparisonShare,
    funnelDropoffDecreased: LYRA_DEFAULT_funnelDropoffDecreased,
    funnelDropoffIncreased: LYRA_DEFAULT_funnelDropoffIncreased,
    funnelStagesLimit: LYRA_DEFAULT_funnelStagesLimit,
    noData: LYRA_DEFAULT_noData,
    trendUnchanged: LYRA_DEFAULT_trendUnchanged,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** The ordered stages, first to last. Every share is measured against the first entry.
   * Reassign after changes, or call `requestUpdate()` after mutating the existing array. */
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

  /** Omits the change from the previous stage that is otherwise rendered above each later stage. */
  @property({ type: Boolean, reflect: true, attribute: 'without-dropoff' }) withoutDropoff = false;

  /** Fraction digits used for every share and drop-off percentage. */
  @property({ type: Number, attribute: 'share-precision' }) sharePrecision = 0;

  private get precision(): number {
    return finiteInteger(this.sharePrecision, 0, 0, MAX_SHARE_PRECISION);
  }

  private formatValue(value: number): string {
    return getNumberFormat(this.effectiveLocale, { maximumFractionDigits: chartValueFractionDigits(value) }).format(value);
  }

  private formatShare(ratio: number): string {
    const precision = this.precision;
    const percent = Math.abs(ratio) * 100;
    // A non-zero share that would round to 0 keeps its first significant digit.
    const digits = percent > 0 && percent < 0.5 * 10 ** -precision ? Math.min(20, -Math.floor(Math.log10(percent))) : precision;
    return getNumberFormat(this.effectiveLocale, {
      style: 'percent',
      minimumFractionDigits: precision,
      maximumFractionDigits: digits,
    }).format(ratio);
  }

  private stagesMemo?: { stages: readonly LyraFunnelStage[]; comparison: readonly LyraFunnelStage[]; result: ResolvedStage[] };
  private readonly stageScans = new Map<unknown, StageScan>();
  private completedStages: ResolvedStage[] = [];

  private cancelStageScans(): void {
    for (const scan of this.stageScans?.values() ?? []) clearTimeout(scan.timer);
    this.stageScans?.clear();
    this.stagesMemo = undefined;
  }

  override requestUpdate(name?: PropertyKey, oldValue?: unknown, options?: Parameters<LyraElement['requestUpdate']>[2]): void {
    if (name === undefined || name === 'stages' || name === 'comparison') this.cancelStageScans();
    super.requestUpdate(name, oldValue, options);
  }

  override disconnectedCallback(): void {
    this.cancelStageScans();
    super.disconnectedCallback();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    super.requestUpdate();
  }

  private get scanningStages(): boolean {
    return [...this.stageScans.values()].some(scan => !scan.done);
  }

  private continueStageScan(scan: StageScan): void {
    const end = Math.min(scan.length, scan.cursor + 10_000);
    for (; scan.cursor < end && scan.stages.length <= MAX_RENDERED_STAGES; scan.cursor++) {
      try {
        const stage = scan.source[scan.cursor];
        if (!stage || typeof stage !== 'object' || Array.isArray(stage)) continue;
        const record = stage as { readonly label?: unknown; readonly value?: unknown; readonly color?: unknown };
        if (typeof record.label !== 'string') continue;
        scan.stages.push(Object.freeze({
          label: record.label,
          value: typeof record.value === 'number' ? finiteNumber(record.value, 0) : 0,
          ...(typeof record.color === 'string' ? { color: record.color } : {}),
        }));
      } catch {
        // An invalid entry does not hide later valid stages.
      }
    }
    scan.done = scan.cursor >= scan.length || scan.stages.length > MAX_RENDERED_STAGES;
    if (!scan.done && this.isConnected) {
      scan.timer = setTimeout(() => {
        scan.timer = undefined;
        if (!this.isConnected || this.stageScans.get(scan.source) !== scan) return;
        this.continueStageScan(scan);
        if (scan.done) super.requestUpdate();
      }, 0);
    }
  }

  private validStages(value: unknown): readonly LyraFunnelStage[] {
    if (!Array.isArray(value)) return [];
    let scan = this.stageScans.get(value);
    if (!scan) {
      scan = { source: value, stages: [], length: value.length, cursor: 0, done: false };
      this.stageScans.set(value, scan);
      this.continueStageScan(scan);
    }
    return scan.stages;
  }

  /** Resolves every stage's geometry and text inputs in one pass so render stays declarative. */
  private resolveStages(): ResolvedStage[] {
    const memo = this.stagesMemo;
    if (memo && memo.stages === this.stages && memo.comparison === this.comparison) return memo.result;
    const result = this.computeStages();
    if (this.scanningStages) return this.completedStages;
    this.completedStages = result;
    this.stagesMemo = { stages: this.stages, comparison: this.comparison, result };
    return result;
  }

  private computeStages(): ResolvedStage[] {
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
    return this.localize(change > 0 ? 'funnelDropoffIncreased' : 'funnelDropoffDecreased', undefined, {
      value: this.formatShare(Math.abs(change)),
    });
  }

  private renderStage(resolved: ResolvedStage): TemplateResult {
    const { stage, value, share, change, comparisonShare } = resolved;
    const barColor = sanitizeCssColor(stage.color);
    const barPart = share !== null && share > 1 ? 'bar bar-overflow' : 'bar';
    const comparisonName = this.comparisonLabel || this.localize('comparePanel');
    return html`<li part="stage">
      ${!this.withoutDropoff && change !== null
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
              >${this.localize('funnelComparisonShare', undefined, {
                label: comparisonName,
                value: this.formatShare(comparisonShare),
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
      return html`<div part="base" aria-busy=${this.scanningStages ? 'true' : 'false'}>${this.scanningStages ? nothing : html`<p part="empty">${this.localize('noData')}</p>`}</div>`;
    }
    const truncated = resolved.length > MAX_RENDERED_STAGES;
    // Every stage's share/change was already resolved against the full, untruncated series above --
    // slicing here only bounds the rendered DOM node count, it never changes what a surviving bar reports.
    const renderedStages = resolved.slice(0, MAX_RENDERED_STAGES);
    const name = hostAriaLabel(this) ?? (this.label || this.localize('chart'));
    return html`<div part="base" aria-busy=${this.scanningStages ? 'true' : 'false'}>
      <ol part="stages" aria-label=${name}>
        ${renderedStages.map((entry) => this.renderStage(entry))}
      </ol>
      ${truncated
        ? html`<p part="limit" role="note">${this.localize('funnelStagesLimit', undefined, {
            count: getNumberFormat(this.effectiveLocale).format(MAX_RENDERED_STAGES),
          })}</p>`
        : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-funnel': LyraFunnel;
  }
}
