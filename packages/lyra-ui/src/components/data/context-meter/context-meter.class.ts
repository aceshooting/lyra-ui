import { html, svg, nothing, type TemplateResult, type SVGTemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteNumber } from '../../../internal/numbers.js';
import { resolveIntlLocale } from '../../../internal/intl-cache.js';
import { sanitizeCssColor } from '../../../internal/safe-css.js';
import { srOnly } from '../../../internal/a11y.js';
import type { LyraVariant } from '../../../internal/variants.js';
import { styles } from './context-meter.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_contextMeterLabeledSummary, LYRA_DEFAULT_contextMeterSegmentLabel, LYRA_DEFAULT_contextMeterUsed, LYRA_DEFAULT_contextMeterUsedOfTotal } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** The shared semantic tone. Kept as a local name so existing imports keep resolving. */
export type ContextMeterTone = LyraVariant;
/** The meter geometry. This is deliberately separate from the semantic `variant` vocabulary. */
export type ContextMeterShape = 'ring' | 'bar';

export interface ContextMeterSegment {
  label: string;
  /** Absolute quantity (e.g. tokens), not a pre-computed percentage. */
  value: number;
  tone?: ContextMeterTone;
  /** Optional arbitrary CSS color. When set, it takes precedence over `tone`. */
  color?: string;
}

interface RatioSegment {
  segment: Readonly<ContextMeterSegment>;
  /** The normalized value used by every visual and semantic projection. */
  value: number;
  /** This segment's share of `total`, already clamped so the running sum
   *  across all segments never exceeds 1. */
  ratio: number;
}

// Ring geometry: RADIUS/CENTER match lr-gauge's radial numbers, so both
// components' rings sit on the same circle within their viewBox. STROKE is
// intentionally heavier than the gauge's (12 vs. 10) -- tightly-packed
// multi-tone arcs need more width to stay visually distinct than a gauge's
// single fill arc, so it isn't shared.
const RADIUS = 40;
const CENTER = 50;
const STROKE = 12;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function formatCount(n: number, locale: string): string {
  return Math.round(finiteNumber(n, 0)).toLocaleString(resolveIntlLocale(locale));
}

/**
 * `<lr-context-meter>` — a segmented occupancy meter (bar or ring) for
 * showing how a fixed capacity (a model's context window, a token budget,
 * any consumable quota) is divided across labeled categories. First-party
 * invention; no equivalent exists in Web Awesome.
 *
 * Pure data visualization: it renders `segments`/`total` as given and never
 * computes token counts, costs, or any other domain-specific estimate
 * itself — the one exception is the plain arithmetic sum of the segment
 * values used to build the accessible "X of Y used" summary below.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-context-meter
 * @csspart base - The component's root wrapper (a `<div>` for `bar`, an `<svg>` for `ring`).
 * @csspart track - The unfilled/empty capacity track.
 * @csspart segment - One occupied segment. Carries `data-tone` for styling and
 *   `--lr-context-meter-segment-color` when `color` is set.
 * @csspart label - The visible caption, when `label` is set.
 * @csspart semantic - The visually-hidden meter/group carrying aggregate range semantics.
 * @csspart segment-list - The visually-hidden list exposing the segment breakdown.
 * @csspart segment-item - One visually-hidden segment label/count pair.
 * @csspart legend - The visible category key rendered below the meter when `showLegend` is set.
 *   `aria-hidden`, because `segment-list` already exposes the same names to assistive technology.
 * @csspart legend-item - One swatch + label pair in the legend, one per `segments` entry.
 * @csspart legend-swatch - The color chip of a legend item, painted from that segment's resolved
 *   `color`/`tone` — the same ladder and the same inline custom-property escape `segment` uses.
 * @csspart legend-label - The text of a legend item (the segment's `label`).
 * @cssprop [--lr-context-meter-segment-color] - Per-segment color. Set inline on `[part="segment"]` by the component itself whenever that segment supplies a `color`; unset (and the token unread) otherwise, leaving the `data-tone` palette in charge. The matching `[part="legend-swatch"]` reads the same property, so a swatch can never disagree with the band it stands for.
 * @cssprop [--lr-context-meter-legend-swatch-size=var(--lr-size-0-625rem)] - Inline and block size of a legend swatch.
 * @status stable
 * @since 4.0.0
 */
export class LyraContextMeter extends LyraElement {
  protected static override readonly ownedCollectionProperties = Object.freeze(['segments']);

  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    contextMeterLabeledSummary: LYRA_DEFAULT_contextMeterLabeledSummary,
    contextMeterSegmentLabel: LYRA_DEFAULT_contextMeterSegmentLabel,
    contextMeterUsed: LYRA_DEFAULT_contextMeterUsed,
    contextMeterUsedOfTotal: LYRA_DEFAULT_contextMeterUsedOfTotal,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, srOnly, styles];

  /** Occupied segments, each an absolute quantity against `total` — never a percentage. */
  @property({ attribute: false }) segments: readonly ContextMeterSegment[] = [];

  /** The full capacity segments are measured against (e.g. a model's context window size). */
  @property({ type: Number }) total = 0;

  private _shape: ContextMeterShape = 'bar';

  /** Meter geometry. Foreign attribute values normalize to the default bar shape. */
  @property({ reflect: true })
  get shape(): ContextMeterShape { return this._shape; }
  set shape(value: ContextMeterShape) {
    const normalized: ContextMeterShape = value === 'ring' ? 'ring' : 'bar';
    const previous = this._shape;
    if (previous === normalized) {
      // An invalid attribute can normalize to the current value. Still schedule reflection so
      // the DOM never advertises a closed-token state the renderer did not accept.
      if (value !== normalized) this.requestUpdate('shape', previous);
      return;
    }
    this._shape = normalized;
    this.requestUpdate('shape', previous);
  }

  /** Overall accessible label/caption, e.g. `"128K context window"`. */
  @property() label = '';

  /** Renders a static `[part="legend"]` key below the meter — one swatch/label pair per `segments`
   *  entry, each swatch painted with that segment's resolved `color`/`tone`. Off by default.
   *
   *  Without it, the only place a segment's own label is exposed is a hover `title` (desktop-only,
   *  undiscoverable) and the visually-hidden breakdown list — so a meter split across more than two
   *  or three categories is legible to a screen-reader user but not to a sighted one, who has to
   *  hand-roll swatch+label markup outside the component. Non-interactive: it toggles nothing and
   *  emits nothing, mirroring `<lr-sequence-strip>`'s `showLegend` rather than the interactive
   *  `<lr-graph-legend>`. */
  @property({ type: Boolean, reflect: true, attribute: 'show-legend' }) showLegend = false;

  private normalizedSegmentValue(segment: Readonly<ContextMeterSegment>): number {
    return Math.max(0, finiteNumber(segment.value, 0));
  }

  /** Sum of segment values, clamped so a negative/NaN entry can't produce a negative total. */
  private get usedTotal(): number {
    return this.segments.reduce((sum, segment) => {
      const next = sum + this.normalizedSegmentValue(segment);
      return finiteNumber(next, Number.MAX_VALUE);
    }, 0);
  }

  /** Per-segment ratio of `value` to `total`, clamped to [0,1] and capped so the
   *  running sum across all segments never overflows past 1 — a `segments` array
   *  that sums to more than `total` still renders a fully (not over-) filled meter. */
  private ratios(): RatioSegment[] {
    const total = Math.max(0, finiteNumber(this.total, 0));
    if (total <= 0) return [];
    const out: RatioSegment[] = [];
    let cumulative = 0;
    for (const segment of this.segments) {
      const raw = this.normalizedSegmentValue(segment);
      const available = Math.max(0, 1 - cumulative);
      const ratio = Math.min(raw / total, available);
      cumulative += ratio;
      out.push({ segment, value: raw, ratio });
    }
    return out;
  }

  /** `usedTotal` and `total`, both clamped the same way ratios() clamps the
   *  visual fill -- a segments array that sums past total must not report an
   *  impossible "160 of 100 used"/aria-valuenow > aria-valuemax while the
   *  bar/ring visibly caps at 100%. Shared by `summary` and `willUpdate`'s
   *  aria-value* trio so the announced text and the queryable numeric value
   *  can never diverge. */
  private get clampedUsedTotal(): { used: number; total: number } {
    const total = Math.max(0, finiteNumber(this.total, 0));
    const used = total > 0 ? Math.min(this.usedTotal, total) : this.usedTotal;
    return { used, total };
  }

  private get summary(): string {
    const { used: usedForSummary, total: totalValue } = this.clampedUsedTotal;
    const used = formatCount(usedForSummary, this.effectiveLocale);
    const phrase =
      totalValue > 0
        ? this.localize('contextMeterUsedOfTotal', undefined, {
            used,
            total: formatCount(totalValue, this.effectiveLocale),
          })
        : this.localize('contextMeterUsed', undefined, { used });
    return this.label
      ? this.localize('contextMeterLabeledSummary', undefined, { label: this.label, summary: phrase })
      : phrase;
  }

  /** Hover/`<title>` text for one segment. Templated so a locale controls
   *  where the count sits relative to the label, not just the words. */
  private segmentTitle(segment: Readonly<ContextMeterSegment>, value = this.normalizedSegmentValue(segment)): string {
    return this.localize('contextMeterSegmentLabel', undefined, {
      label: segment.label,
      count: formatCount(value, this.effectiveLocale),
    });
  }

  private segmentColor(segment: ContextMeterSegment): string | undefined {
    return segment.color ? sanitizeCssColor(segment.color) : undefined;
  }

  private renderSemantics(): TemplateResult {
    const { used, total } = this.clampedUsedTotal;
    // A host aria-label names the custom element itself. Reusing it here would expose the same
    // name on two semantic owners; the meter retains its purpose-specific generated summary.
    const accessibleName = this.summary;
    return html`
      <div
        part="semantic"
        class="sr-only"
        role=${total > 0 ? 'meter' : 'group'}
        aria-label=${accessibleName}
        aria-valuenow=${total > 0 ? String(used) : nothing}
        aria-valuemin=${total > 0 ? '0' : nothing}
        aria-valuemax=${total > 0 ? String(total) : nothing}
      ></div>
      <ul part="segment-list" class="sr-only">
        ${this.segments.map(
          (segment) => html`<li part="segment-item">${this.segmentTitle(segment)}</li>`,
        )}
      </ul>
    `;
  }

  private renderBar(): TemplateResult {
    const ratios = this.ratios();
    return html`
      <div part="base">
        ${this.label ? html`<div part="label" aria-hidden="true">${this.label}</div>` : nothing}
        <div part="track" aria-hidden="true">
          ${ratios.map(
            ({ segment, value, ratio }) => html`
              <span
                part="segment"
                data-tone=${segment.tone ?? 'neutral'}
                title=${this.segmentTitle(segment, value)}
                style=${styleMap({
                  flexBasis: `${(ratio * 100).toFixed(4)}%`,
                  ...(this.segmentColor(segment)
                    ? { '--lr-context-meter-segment-color': this.segmentColor(segment)! }
                    : {}),
                })}
              ></span>
            `,
          )}
        </div>
      </div>
    `;
  }

  private renderRing(): TemplateResult {
    const ratios = this.ratios();
    let cumulative = 0;
    const arcs: SVGTemplateResult[] = ratios.map(({ segment, value, ratio }) => {
      const segLen = ratio * CIRCUMFERENCE;
      const dashoffset = -cumulative * CIRCUMFERENCE;
      cumulative += ratio;
      return svg`
        <circle
          part="segment"
          data-tone=${segment.tone ?? 'neutral'}
          style=${styleMap(
            this.segmentColor(segment)
              ? { '--lr-context-meter-segment-color': this.segmentColor(segment)! }
              : {},
          )}
          cx=${CENTER}
          cy=${CENTER}
          r=${RADIUS}
          stroke-width=${STROKE}
          stroke-dasharray=${`${segLen} ${CIRCUMFERENCE - segLen}`}
          stroke-dashoffset=${dashoffset}
          transform="rotate(-90 ${CENTER} ${CENTER})"
        ><title>${this.segmentTitle(segment, value)}</title></circle>
      `;
    });
    return html`
      <svg part="base" viewBox="0 0 100 100" aria-hidden="true">
        <circle part="track" cx=${CENTER} cy=${CENTER} r=${RADIUS} stroke-width=${STROKE}></circle>
        ${arcs}
        ${this.label ? svg`
          <foreignObject part="label" x="20" y="25" width="60" height="50" aria-hidden="true">
            <div class="ring-label" title=${this.label}>${this.label}</div>
          </foreignObject>
        ` : nothing}
      </svg>
    `;
  }

  /** The visible category key. It repeats, in sighted form, exactly the label/count pairs the
   *  visually-hidden `segment-list` already exposes, so the whole subtree is `aria-hidden` — a
   *  screen reader announcing the same scheme twice is worse than not announcing the duplicate at
   *  all. Same stance, and the same `legend`/`legend-item`/`legend-swatch`/`legend-label` part
   *  names, as `<lr-sequence-strip>`'s legend. */
  private renderLegend(): TemplateResult {
    return html`
      <div part="legend" aria-hidden="true">
        ${this.segments.map((segment) => {
          const color = this.segmentColor(segment);
          return html`<span part="legend-item">
            <span
              part="legend-swatch"
              data-tone=${segment.tone ?? 'neutral'}
              style=${styleMap(color ? { '--lr-context-meter-segment-color': color } : {})}
            ></span>
            <span part="legend-label">${segment.label}</span>
          </span>`;
        })}
      </div>
    `;
  }

  override render(): TemplateResult {
    return html`
      ${this.shape === 'ring' ? this.renderRing() : this.renderBar()}
      ${this.showLegend ? this.renderLegend() : nothing}
      ${this.renderSemantics()}
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-context-meter': LyraContextMeter;
  }
}
