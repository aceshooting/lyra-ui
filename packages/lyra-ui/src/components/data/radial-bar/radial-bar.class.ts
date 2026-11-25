import { html, nothing, svg, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { normalizeLabel } from '../../../internal/accessible-name.js';
import { hostAriaLabel, srOnly } from '../../../internal/a11y.js';
import { bdi } from '../../../internal/bidi.js';
import { chartValueFractionDigits } from '../../../internal/chart-number-format.js';
import { collectionSupport } from '../../../internal/collection-snapshot.js';
import { blankNumberConverter } from '../../../internal/converters.js';
import { finiteNumber } from '../../../internal/numbers.js';
import { isSafeNonArrayObject } from '../../../internal/object-guards.js';
import { specialistTokens } from '../../../internal/specialist-host-tokens.styles.js';
import { LYRA_VARIANT_VALUES } from '../../../internal/variant-values.js';
import type { LyraVariant } from '../../../internal/variants.js';
import { styles } from './radial-bar.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_radialBarSegment } from '../../../internal/default-strings/data.generated.js';
import { LYRA_DEFAULT_chart, LYRA_DEFAULT_chartValueLabel, LYRA_DEFAULT_noData } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** One category of a radial bar chart, drawn as its own concentric arc. */
export interface LyraRadialBarSegment {
  /** Category name. Caller-owned copy, read in the legend and the accessible list. */
  readonly label: string;
  /** The measured value. Non-finite input renders the localized no-data text and no arc. */
  readonly value: number;
  /** The value a full circle represents for this category. Overrides the host `max`. */
  readonly max?: number;
  /** Semantic arc color. Omitted segments use the categorical chart palette by position. */
  readonly variant?: LyraVariant;
}

/** Outer edge and inner hole of the ring band, in viewBox units of a 100 x 100 drawing. */
const OUTER_EDGE = 48;
const INNER_EDGE = 12;
/** Share of each ring's band covered by its stroke; the rest is the gap to the next ring. */
const STROKE_SHARE = 0.72;
/** Categorical chart colors available before the palette repeats. */
const PALETTE_SIZE = 8;

interface ResolvedSegment {
  readonly label: string;
  readonly value: number | null;
  /** The positive scale of a full circle, or `null` when none can be defined. */
  readonly max: number | null;
  /** Clamped share of a full circle, 0 to 1. */
  readonly ratio: number;
  readonly color: string;
}

function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * `<lr-radial-bar>` — concentric progress arcs, one ring per category, drawn as SVG from design
 * tokens and read as a plain list.
 *
 * Each segment's arc runs clockwise from the top (counter-clockwise under a right-to-left
 * direction) and covers its share of a full circle: `value / max`, where `max` is the segment's
 * own `max`, then the host `max`, then the largest value among segments without their own `max`.
 * Values above the scale draw a
 * full ring; zero, negative and missing values draw no arc.
 *
 * The drawing is decorative (`aria-hidden`). Assistive technology reads a labeled list with one
 * item per segment, "label: value of max", formatted for the effective locale. With `withLegend`
 * that same list is the visible legend, a color swatch beside each item; without it the list stays
 * in the accessibility tree but is visually hidden.
 *
 * `segments` is an owned collection: each assignment is detached into a frozen snapshot of at most
 * the first 10,000 entries. Entries that are not records, or have no string `label`, are skipped.
 * An empty chart renders the localized no-data text in `[part="empty"]`.
 *
 * @customElement lr-radial-bar
 * @csspart base - The container element.
 * @csspart chart - The decorative SVG drawing.
 * @csspart track - The full-circle groove behind each arc.
 * @csspart arc - One segment's progress arc.
 * @csspart legend - The labeled list of segments; visually hidden unless `with-legend` is set.
 * @csspart legend-item - One segment's list item.
 * @csspart legend-swatch - The color key beside a legend item.
 * @csspart legend-label - A legend item's text, "label: value of max".
 * @csspart empty - The localized no-data text shown when there are no segments.
 * @cssprop [--lr-radial-bar-size=var(--lr-size-12rem)] - Inline size of the drawing.
 * @cssprop [--lr-radial-bar-track-color=var(--lr-color-surface-raised)] - Color of every ring's track.
 * @status experimental
 * @since 33.2.0
 */
export class LyraRadialBar extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    chart: LYRA_DEFAULT_chart,
    chartValueLabel: LYRA_DEFAULT_chartValueLabel,
    noData: LYRA_DEFAULT_noData,
    radialBarSegment: LYRA_DEFAULT_radialBarSegment,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override collectionSupport = collectionSupport;

  protected static override readonly ownedCollectionProperties = Object.freeze(['segments']);

  static override styles = [LyraElement.styles, specialistTokens, styles, srOnly];

  /** The categories, outermost ring first. Assigned arrays are detached; assign a new array to
   *  publish a change. */
  @property({ attribute: false }) segments: readonly LyraRadialBarSegment[] = [];

  /** Accessible name for the segment list. A host `aria-label` wins over it; blank falls back to a
   *  localized generic chart name. */
  @property() label = '';

  /** Shows the segment list as a visible legend with color swatches. */
  @property({ type: Boolean, reflect: true, attribute: 'with-legend' }) withLegend = false;

  /** The value a full circle represents for every segment without its own `max`. Unset,
   *  non-finite or non-positive uses the largest value among those segments. */
  @property({ converter: blankNumberConverter(undefined) }) max?: number;

  private resolveSegments(): ResolvedSegment[] {
    const source: unknown = this.segments;
    if (!Array.isArray(source)) return [];
    const entries: { label: string; value: number | null; max: number | null; variant?: LyraVariant }[] = [];
    for (const entry of source as readonly unknown[]) {
      if (!isSafeNonArrayObject(entry)) continue;
      const { label, value, max, variant } = entry as Partial<Record<keyof LyraRadialBarSegment, unknown>>;
      if (typeof label !== 'string') continue;
      entries.push({
        label,
        value: typeof value === 'number' && Number.isFinite(value) ? value : null,
        max: positive(max),
        ...((LYRA_VARIANT_VALUES as readonly unknown[]).includes(variant) ? { variant: variant as LyraVariant } : {}),
      });
    }
    // The shared scale comes only from segments that share it: one with its own max never
    // shrinks the others.
    let largest: number | null = null;
    for (const entry of entries) {
      if (entry.max === null && entry.value !== null && entry.value > 0) largest = Math.max(largest ?? 0, entry.value);
    }
    const hostMax = positive(finiteNumber(Number(this.max), 0));
    return entries.map((entry, index) => {
      const max = entry.max ?? hostMax ?? largest;
      const ratio = entry.value === null || max === null || entry.value <= 0 ? 0 : Math.min(1, entry.value / max);
      return {
        label: entry.label,
        value: entry.value,
        max,
        ratio,
        color: entry.variant
          ? `var(--lr-color-${entry.variant}-fill-loud)`
          : `var(--lr-color-chart-${(index % PALETTE_SIZE) + 1})`,
      };
    });
  }

  private formatValue(value: number): string {
    return this.formatLocaleNumber(value, { maximumFractionDigits: chartValueFractionDigits(value) });
  }

  private segmentText(segment: ResolvedSegment): string {
    if (segment.value === null) {
      return this.localize('chartValueLabel', undefined, { label: segment.label, value: this.localize('noData') });
    }
    if (segment.max === null) {
      return this.localize('chartValueLabel', undefined, { label: segment.label, value: this.formatValue(segment.value) });
    }
    return this.localize('radialBarSegment', undefined, {
      label: segment.label,
      value: this.formatValue(segment.value),
      max: this.formatValue(segment.max),
    });
  }

  private renderRings(segments: readonly ResolvedSegment[]): TemplateResult {
    const band = (OUTER_EDGE - INNER_EDGE) / segments.length;
    const strokeWidth = band * STROKE_SHARE;
    return svg`${segments.map((segment, index) => {
      const radius = OUTER_EDGE - band * index - band / 2;
      const percent = segment.ratio * 100;
      return svg`<circle part="track" cx="50" cy="50" r=${radius} stroke-width=${strokeWidth}></circle>
        ${percent > 0
          ? svg`<circle
              part="arc"
              cx="50"
              cy="50"
              r=${radius}
              stroke-width=${strokeWidth}
              pathLength="100"
              stroke-dasharray=${`${percent} 100`}
              transform="rotate(-90 50 50)"
              style=${styleMap({ '--_lr-radial-bar-color': segment.color })}
            ></circle>`
          : nothing}`;
    })}`;
  }

  override render(): TemplateResult {
    const segments = this.resolveSegments();
    if (segments.length === 0) {
      return html`<div part="base"><p part="empty">${this.localize('noData')}</p></div>`;
    }
    const name = hostAriaLabel(this) ?? normalizeLabel(this.label) ?? this.localize('chart');
    return html`<div part="base">
      <svg part="chart" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${this.renderRings(segments)}</svg>
      <ul part="legend" role="list" aria-label=${name} class=${this.withLegend ? '' : 'sr-only'}>
        ${segments.map(
          (segment) => html`<li part="legend-item">
            <span
              part="legend-swatch"
              aria-hidden="true"
              style=${styleMap({ '--_lr-radial-bar-color': segment.color })}
            ></span>
            <span part="legend-label">${bdi(this.segmentText(segment))}</span>
          </li>`,
        )}
      </ul>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-radial-bar': LyraRadialBar;
  }
}
