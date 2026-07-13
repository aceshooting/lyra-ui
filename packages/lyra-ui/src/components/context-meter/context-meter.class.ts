import { html, svg, nothing, type TemplateResult, type SVGTemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { finiteNumber } from '../../internal/numbers.js';
import { styles } from './context-meter.styles.js';

export type ContextMeterTone = 'brand' | 'success' | 'warning' | 'danger' | 'neutral';
export type ContextMeterVariant = 'ring' | 'bar';

export interface ContextMeterSegment {
  label: string;
  /** Absolute quantity (e.g. tokens), not a pre-computed percentage. */
  value: number;
  tone?: ContextMeterTone;
}

interface RatioSegment {
  segment: ContextMeterSegment;
  /** This segment's share of `total`, already clamped so the running sum
   *  across all segments never exceeds 1. */
  ratio: number;
}

// Ring geometry: RADIUS/CENTER match lyra-gauge's radial numbers, so both
// components' rings sit on the same circle within their viewBox. STROKE is
// intentionally heavier than the gauge's (12 vs. 10) -- tightly-packed
// multi-tone arcs need more width to stay visually distinct than a gauge's
// single fill arc, so it isn't shared.
const RADIUS = 40;
const CENTER = 50;
const STROKE = 12;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function formatCount(n: number): string {
  return Math.round(finiteNumber(n, 0)).toLocaleString();
}

/**
 * `<lyra-context-meter>` — a segmented occupancy meter (bar or ring) for
 * showing how a fixed capacity (a model's context window, a token budget,
 * any consumable quota) is divided across labeled categories. First-party
 * invention; no equivalent exists in Web Awesome.
 *
 * Pure data visualization: it renders `segments`/`total` as given and never
 * computes token counts, costs, or any other domain-specific estimate
 * itself — the one exception is the plain arithmetic sum of the segment
 * values used to build the accessible "X of Y used" summary below.
 *
 * @customElement lyra-context-meter
 * @csspart base - The component's root wrapper (a `<div>` for `bar`, an `<svg>` for `ring`).
 * @csspart track - The unfilled/empty capacity track.
 * @csspart segment - One occupied segment. Carries `data-tone` for styling.
 * @csspart label - The visible caption, when `label` is set.
 */
export class LyraContextMeter extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** Occupied segments, each an absolute quantity against `total` — never a percentage. */
  @property({ attribute: false }) segments: ContextMeterSegment[] = [];

  /** The full capacity segments are measured against (e.g. a model's context window size). */
  @property({ type: Number }) total = 0;

  @property({ reflect: true }) variant: ContextMeterVariant = 'bar';

  /** Overall accessible label/caption, e.g. `"128K context window"`. */
  @property() label = '';

  /** Sum of segment values, clamped so a negative/NaN entry can't produce a negative total. */
  private get usedTotal(): number {
    return this.segments.reduce((sum, s) => sum + Math.max(0, finiteNumber(s.value, 0)), 0);
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
      const raw = Math.max(0, finiteNumber(segment.value, 0));
      const available = Math.max(0, 1 - cumulative);
      const ratio = Math.min(raw / total, available);
      cumulative += ratio;
      out.push({ segment, ratio });
    }
    return out;
  }

  private get summary(): string {
    // Clamp the announced figure the same way ratios() clamps the visual fill --
    // a segments array that sums past total must not report an impossible
    // "160 of 100 used" to assistive tech while the bar/ring visibly caps at 100%.
    const totalValue = Math.max(0, finiteNumber(this.total, 0));
    const usedForSummary = totalValue > 0 ? Math.min(this.usedTotal, totalValue) : this.usedTotal;
    const used = formatCount(usedForSummary);
    const phrase =
      totalValue > 0
        ? this.localize('contextMeterUsedOfTotal', undefined, { used, total: formatCount(totalValue) })
        : this.localize('contextMeterUsed', undefined, { used });
    return this.label ? `${this.label} — ${phrase}` : phrase;
  }

  protected willUpdate(): void {
    // role="img" + aria-label (rather than exposing the SVG/bar internals to
    // the accessibility tree) mirrors lyra-gauge's "meter" role convention:
    // one computed string carries the whole occupancy summary, so a screen
    // reader gets meaningful text instead of silence or a bare "graphic".
    this.setAttribute('role', 'img');
    this.setAttribute('aria-label', this.summary);
  }

  private renderBar(): TemplateResult {
    const ratios = this.ratios();
    return html`
      <div part="base">
        ${this.label ? html`<div part="label" aria-hidden="true">${this.label}</div>` : nothing}
        <div part="track" aria-hidden="true">
          ${ratios.map(
            ({ segment, ratio }) => html`
              <span
                part="segment"
                data-tone=${segment.tone ?? 'neutral'}
                title=${`${segment.label}: ${formatCount(segment.value)}`}
                style=${styleMap({ flexBasis: `${(ratio * 100).toFixed(4)}%` })}
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
    const arcs: SVGTemplateResult[] = ratios.map(({ segment, ratio }) => {
      const segLen = ratio * CIRCUMFERENCE;
      const dashoffset = -cumulative * CIRCUMFERENCE;
      cumulative += ratio;
      return svg`
        <circle
          part="segment"
          data-tone=${segment.tone ?? 'neutral'}
          cx=${CENTER}
          cy=${CENTER}
          r=${RADIUS}
          stroke-width=${STROKE}
          stroke-dasharray=${`${segLen} ${CIRCUMFERENCE - segLen}`}
          stroke-dashoffset=${dashoffset}
          transform="rotate(-90 ${CENTER} ${CENTER})"
        ><title>${`${segment.label}: ${formatCount(segment.value)}`}</title></circle>
      `;
    });
    return html`
      <svg part="base" viewBox="0 0 100 100" aria-hidden="true">
        <circle part="track" cx=${CENTER} cy=${CENTER} r=${RADIUS} stroke-width=${STROKE}></circle>
        ${arcs}
        ${this.label ? svg`<text part="label" x=${CENTER} y=${CENTER + 4} aria-hidden="true">${this.label}</text>` : nothing}
      </svg>
    `;
  }

  render(): TemplateResult {
    return this.variant === 'ring' ? this.renderRing() : this.renderBar();
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lyra-context-meter': LyraContextMeter;
  }
}

