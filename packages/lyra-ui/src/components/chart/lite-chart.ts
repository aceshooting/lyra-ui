import { html, svg, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { styles } from './lite-chart.styles.js';

export interface LiteSeries {
  label: string;
  data: (number | null)[];
  /** Defaults to a color from the built-in categorical palette, keyed by dataset index. */
  color?: string;
}

export type LyraLiteChartType = 'bar' | 'line';

// Colorblind-considered categorical palette, used round-robin when a Series
// doesn't set its own `color` — same role as Chart.js's default dataset
// colors for lyra-chart, just a fixed JS array instead of a peer dep's.
const DEFAULT_PALETTE = [
  '#4c6ef5',
  '#f76707',
  '#2f9e44',
  '#e64980',
  '#ae3ec9',
  '#1098ad',
  '#f59f00',
  '#495057',
];

const PAD_LEFT = 36;
const PAD_RIGHT = 8;
const PAD_TOP = 8;
const PAD_BOTTOM = 20;
const AXIS_TITLE_SPACE = 14;
const TICK_COUNT = 4;
const BAR_GROUP_GAP = 0.2; // fraction of a category slot left as gap between categories
const BAR_GAP = 0.08; // fraction of a category slot left as gap between grouped bars

/**
 * Picks a "nice" (1/2/5 × 10^n) step size for an axis spanning `span` over
 * roughly `count` ticks — the standard Heckbert nice-numbers approach, so
 * axis labels read as 0/25/50/75/100 rather than 0/23.4/46.8/70.2/93.6.
 */
function niceStep(span: number, count: number): number {
  if (span <= 0) return 1;
  const rough = span / Math.max(1, count);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const residual = rough / magnitude;
  const niceResidual = residual < 1.5 ? 1 : residual < 3 ? 2 : residual < 7 ? 5 : 10;
  return niceResidual * magnitude;
}

/** Nice-rounded [lo, hi, ticks[]] for an axis covering `dataLo..dataHi`. */
function niceDomain(dataLo: number, dataHi: number, beginAtZero: boolean, count: number) {
  let lo = beginAtZero ? Math.min(0, dataLo) : dataLo;
  let hi = beginAtZero ? Math.max(0, dataHi) : dataHi;
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const step = niceStep(hi - lo, count);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v / step) * step);
  return { lo, hi, ticks };
}

interface PointDetail {
  datasetIndex: number;
  index: number;
  label: string | undefined;
  value: number | null;
}

/**
 * `<lyra-lite-chart>` — a dependency-free bar/line chart, plain SVG/DOM
 * rendering with zero peer dependencies (unlike `lyra-chart`, which wraps
 * `chart.js`). For a project whose architecture forbids a charting
 * dependency outright, this covers the common bar/line case: grouped or
 * stacked bars, multi-series lines, per-point click, and hover tooltips
 * (native SVG `<title>`, no positioning JS needed) — not a full `lyra-chart`
 * replacement (no zoom/pan, no pie/doughnut/radar/scatter/bubble types, no
 * horizontal/dual-y-axis, no raw-config passthrough).
 *
 * Because this renders real DOM (not canvas), it reuses `lyra-chart`'s
 * `--lyra-chart-*` theme tokens directly via CSS `var()` — no
 * `getComputedStyle()`-based re-theming step is needed the way `chart.ts`
 * needs one for its canvas.
 *
 * @customElement lyra-lite-chart
 * @event lyra-point-click - Fired when a bar/point is activated (click, or
 *   Enter/Space while focused). `detail: { datasetIndex: number, index:
 *   number, label: string | undefined, value: number | null }` — same shape
 *   as `lyra-chart`'s `lyra-point-click`.
 * @csspart base - The host's flex layout wrapper.
 * @csspart grid-line - Each horizontal gridline.
 * @csspart axis-label - Each axis tick label.
 * @csspart axis-title - The x/y axis title text, when set.
 * @csspart bar - Each bar rect (type="bar").
 * @csspart line - Each series' stroked line path (type="line").
 * @csspart point - Each series' per-point hit target (type="line").
 * @csspart legend - The legend row, when `legend` is set.
 * @csspart legend-item - Each legend entry.
 * @csspart legend-swatch - Each legend entry's color swatch.
 */
export class LyraLiteChart extends LyraElement {
  static styles = [LyraElement.styles, styles];

  @property() type: LyraLiteChartType = 'bar';
  @property({ attribute: false }) labels: string[] = [];
  @property({ attribute: false }) datasets: LiteSeries[] = [];
  @property({ type: Boolean }) legend = false;
  @property() height = '280px';
  @property({ attribute: 'x-label' }) xLabel = '';
  @property({ attribute: 'y-label' }) yLabel = '';
  @property({ type: Boolean, attribute: 'begin-at-zero' }) beginAtZero = true;
  /** Stacks each category's bars into one segmented bar. Ignored for `type="line"`. */
  @property({ type: Boolean }) stacked = false;

  @state() private plotWidth = 0;
  @state() private plotHeight = 0;

  @query('svg') private svgEl?: SVGSVGElement;
  private resizeObserver?: ResizeObserver;

  connectedCallback(): void {
    super.connectedCallback();
    this.resizeObserver = new ResizeObserver((entries) => {
      const box = entries[0]?.contentBoxSize?.[0];
      if (box) {
        this.plotWidth = box.inlineSize;
        this.plotHeight = box.blockSize;
      } else {
        const rect = this.svgEl?.getBoundingClientRect();
        if (rect) {
          this.plotWidth = rect.width;
          this.plotHeight = rect.height;
        }
      }
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
  }

  protected firstUpdated(): void {
    if (this.svgEl) this.resizeObserver?.observe(this.svgEl);
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('height')) {
      this.style.setProperty('--lyra-chart-height', this.height);
    }
  }

  private colorFor(index: number, series: LiteSeries): string {
    return series.color ?? DEFAULT_PALETTE[index % DEFAULT_PALETTE.length];
  }

  private domain() {
    let lo = Infinity;
    let hi = -Infinity;
    if (this.type === 'bar' && this.stacked) {
      // Stacked bars: each category's extent is the sum of its (signed)
      // positive/negative segments, not the max single value.
      for (let i = 0; i < this.labels.length; i++) {
        let pos = 0;
        let neg = 0;
        for (const s of this.datasets) {
          const v = s.data[i];
          if (v == null) continue;
          if (v >= 0) pos += v;
          else neg += v;
        }
        lo = Math.min(lo, neg);
        hi = Math.max(hi, pos);
      }
    } else {
      for (const s of this.datasets) {
        for (const v of s.data) {
          if (v == null) continue;
          lo = Math.min(lo, v);
          hi = Math.max(hi, v);
        }
      }
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
      lo = 0;
      hi = 1;
    }
    return niceDomain(lo, hi, this.beginAtZero, TICK_COUNT);
  }

  private emitPoint(datasetIndex: number, index: number): void {
    const label = this.labels[index];
    const value = this.datasets[datasetIndex]?.data[index] ?? null;
    this.emit<PointDetail>('lyra-point-click', { datasetIndex, index, label, value });
  }

  private onPointKeyDown(e: KeyboardEvent, datasetIndex: number, index: number): void {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    this.emitPoint(datasetIndex, index);
  }

  private renderGrid(plotX: number, plotY: number, plotW: number, plotH: number, ticks: number[], lo: number, hi: number) {
    const span = hi - lo || 1;
    return ticks.map((t) => {
      const y = plotY + plotH - ((t - lo) / span) * plotH;
      return svg`
        <line part="grid-line" x1=${plotX} y1=${y} x2=${plotX + plotW} y2=${y}></line>
        <text part="axis-label" x=${plotX - 6} y=${y} text-anchor="end" dominant-baseline="middle">${formatTick(t)}</text>
      `;
    });
  }

  private renderBars(plotX: number, plotY: number, plotW: number, plotH: number, lo: number, hi: number) {
    const span = hi - lo || 1;
    const n = this.labels.length;
    const slot = n > 0 ? plotW / n : 0;
    const groupCount = this.stacked ? 1 : Math.max(1, this.datasets.length);
    const groupW = slot * (1 - BAR_GROUP_GAP);
    const barW = (groupW - BAR_GAP * slot * (groupCount - 1)) / groupCount;

    const bars: TemplateResult[] = [];
    for (let i = 0; i < n; i++) {
      const slotStart = plotX + i * slot + (slot - groupW) / 2;
      let stackPos = 0; // running positive-side offset (in value units) for stacked bars
      let stackNeg = 0; // running negative-side offset
      this.datasets.forEach((s, di) => {
        const v = s.data[i];
        if (v == null) return;
        const color = this.colorFor(di, s);
        let barX: number;
        let barValLo: number;
        let barValHi: number;
        if (this.stacked) {
          barX = slotStart;
          if (v >= 0) {
            barValLo = stackPos;
            barValHi = stackPos + v;
            stackPos += v;
          } else {
            barValLo = stackNeg + v;
            barValHi = stackNeg;
            stackNeg += v;
          }
        } else {
          barX = slotStart + di * (barW + BAR_GAP * slot);
          barValLo = Math.min(0, v);
          barValHi = Math.max(0, v);
        }
        const y1 = plotY + plotH - ((barValHi - lo) / span) * plotH;
        const y2 = plotY + plotH - ((barValLo - lo) / span) * plotH;
        const label = this.labels[i];
        bars.push(svg`
          <rect
            part="bar"
            x=${barX}
            y=${y1}
            width=${Math.max(0, barW)}
            height=${Math.max(0, y2 - y1)}
            fill=${color}
            tabindex="0"
            role="button"
            aria-label=${`${s.label}, ${label}: ${v}`}
            @click=${() => this.emitPoint(di, i)}
            @keydown=${(e: KeyboardEvent) => this.onPointKeyDown(e, di, i)}
          ><title>${s.label} — ${label}: ${v}</title></rect>
        `);
      });
    }
    return bars;
  }

  private renderLines(plotX: number, plotY: number, plotW: number, plotH: number, lo: number, hi: number) {
    const span = hi - lo || 1;
    const n = this.labels.length;
    const xFor = (i: number) => plotX + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2);
    const yFor = (v: number) => plotY + plotH - ((v - lo) / span) * plotH;

    return this.datasets.map((s, di) => {
      const color = this.colorFor(di, s);
      const pts = s.data
        .map((v, i) => (v == null ? null : ([xFor(i), yFor(v)] as const)))
        .filter((p): p is readonly [number, number] => p !== null);
      const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');
      const dots = s.data.map((v, i) => {
        if (v == null) return nothing;
        const label = this.labels[i];
        return svg`
          <circle
            part="point"
            cx=${xFor(i)}
            cy=${yFor(v)}
            r="4"
            fill=${color}
            tabindex="0"
            role="button"
            aria-label=${`${s.label}, ${label}: ${v}`}
            @click=${() => this.emitPoint(di, i)}
            @keydown=${(e: KeyboardEvent) => this.onPointKeyDown(e, di, i)}
          ><title>${s.label} — ${label}: ${v}</title></circle>
        `;
      });
      return svg`<path part="line" d=${d} stroke=${color}></path>${dots}`;
    });
  }

  render(): TemplateResult {
    const w = this.plotWidth || 400;
    const h = this.plotHeight || 200;
    const padLeft = PAD_LEFT + (this.yLabel ? AXIS_TITLE_SPACE : 0);
    const padBottom = PAD_BOTTOM + (this.xLabel ? AXIS_TITLE_SPACE : 0);
    const plotX = padLeft;
    const plotY = PAD_TOP;
    const plotW = Math.max(0, w - padLeft - PAD_RIGHT);
    const plotH = Math.max(0, h - plotY - padBottom);
    const { lo, hi, ticks } = this.domain();

    const grid = this.renderGrid(plotX, plotY, plotW, plotH, ticks, lo, hi);
    const marks =
      this.type === 'bar'
        ? this.renderBars(plotX, plotY, plotW, plotH, lo, hi)
        : this.renderLines(plotX, plotY, plotW, plotH, lo, hi);

    const categoryLabels = this.labels.map((label, i) => {
      const n = this.labels.length;
      const x = plotX + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2);
      return svg`<text part="axis-label" x=${x} y=${plotY + plotH + 14} text-anchor="middle">${label}</text>`;
    });

    const chartLabel = this.datasets.map((d) => d.label).join(', ') || 'Chart';

    return html`
      <div part="base">
        <svg viewBox="0 0 ${w} ${h}" role="group" aria-label=${chartLabel}>
          ${grid}
          ${categoryLabels}
          ${marks}
          ${this.yLabel
            ? svg`<text part="axis-title" x=${12} y=${plotY + plotH / 2} text-anchor="middle" transform="rotate(-90, 12, ${plotY + plotH / 2})">${this.yLabel}</text>`
            : nothing}
          ${this.xLabel
            ? svg`<text part="axis-title" x=${plotX + plotW / 2} y=${plotY + plotH + padBottom - 2} text-anchor="middle">${this.xLabel}</text>`
            : nothing}
        </svg>
        ${this.legend
          ? html`<div part="legend">
              ${this.datasets.map(
                (s, i) => html`
                  <span part="legend-item">
                    <span part="legend-swatch" style="background:${this.colorFor(i, s)}"></span>
                    ${s.label}
                  </span>
                `,
              )}
            </div>`
          : nothing}
      </div>
    `;
  }
}

function formatTick(v: number): string {
  // Avoid float noise (e.g. 0.30000000000000004) from the niceStep() math
  // above without hardcoding a fixed decimal count that'd butcher large ints.
  return Number(v.toFixed(6)).toString();
}

defineElement('lite-chart', LyraLiteChart);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-lite-chart': LyraLiteChart;
  }
}
