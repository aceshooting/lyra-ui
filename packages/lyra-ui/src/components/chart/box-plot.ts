import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { loadChartJs } from './chart-loader.js';
import { styles } from './box-plot.styles.js';
import '../skeleton/skeleton.js';

export interface BoxPlotPoint {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}
export interface BoxPlotSeries {
  label: string;
  data: BoxPlotPoint[];
  color?: string;
}

// Defensive JS-side fallbacks for themeColors() below, mirroring the
// light-mode default of each `--lyra-chart-*` token's own fallback chain
// (see box-plot.styles.ts) — only reached if getComputedStyle somehow can't
// resolve the custom property at all (e.g. host detached from the document).
// Same values as chart.ts's own fallbacks, since both default to the same
// semantic tokens.
const FALLBACK_GRID_COLOR = '#8a8a90';
const FALLBACK_TICK_COLOR = '#6b7280';
const FALLBACK_LEGEND_COLOR = '#1a1a1a';
const FALLBACK_TOOLTIP_BG = '#fff';
const FALLBACK_TOOLTIP_TEXT = '#1a1a1a';

// Mirrors chart.ts's own `ThemeColors` shape (all 5 `--lyra-chart-*` tokens)
// even though `buildConfig()` below only threads `grid`/`tick`/`legend` into
// Chart.js options today — `LyraBoxPlot` has no tooltip customization to
// theme yet, but keeping the resolved shape identical means a future
// tooltip option can be wired in without touching this method or
// box-plot.styles.ts again.
interface ThemeColors {
  grid: string;
  tick: string;
  legend: string;
  tooltipBg: string;
  tooltipText: string;
}

let boxPlotPlugin: Promise<typeof import('@sgratzl/chartjs-chart-boxplot') | null> | undefined;

/**
 * Lazily loads `@sgratzl/chartjs-chart-boxplot` and registers its controller
 * only when a `<lyra-box-plot>` connects — kept separate from the base
 * `chart-loader.ts` so importing `lyra-chart.js` alone never pulls this in.
 */
function loadBoxPlotPlugin(): Promise<typeof import('@sgratzl/chartjs-chart-boxplot') | null> {
  if (!boxPlotPlugin) {
    boxPlotPlugin = Promise.all([loadChartJs(), import('@sgratzl/chartjs-chart-boxplot')])
      .then(([chartMod, boxMod]) => {
        if (!chartMod) return null;
        chartMod.Chart.register(boxMod.BoxPlotController, boxMod.BoxAndWiskers);
        return boxMod;
      })
      .catch(() => {
        console.warn(
          '<lyra-box-plot> needs the optional peer dependency `@sgratzl/chartjs-chart-boxplot` ' +
            '— install it with `pnpm add @sgratzl/chartjs-chart-boxplot`.',
        );
        return null;
      });
  }
  return boxPlotPlugin;
}

/**
 * `<lyra-box-plot>` — a box-and-whisker chart from precomputed five-number
 * summaries (no raw sample data is shipped to the browser). Beyond Web
 * Awesome's chart set — useful for summarizing distributions.
 *
 * @customElement lyra-box-plot
 * @csspart base, canvas
 */
export class LyraBoxPlot extends LyraElement {
  static styles = [LyraElement.styles, styles];

  @property({ attribute: false }) labels: string[] = [];
  @property({ attribute: false }) boxes: BoxPlotSeries[] = [];
  @property({ type: Boolean }) legend = false;
  @property() height = '280px';
  @property({ attribute: 'y-label' }) yLabel = '';
  @property({ type: Boolean, attribute: 'begin-at-zero' }) beginAtZero = true;

  /**
   * True until the lazy-loaded `chart.js` + `@sgratzl/chartjs-chart-boxplot`
   * peer dependencies have settled (success or failure) — mirrors
   * `LyraChart`'s `loading` state.
   */
  @state() private loading = true;

  @state() private visible = true;
  private intersectionObserver?: IntersectionObserver;
  private lastSignature = '';

  @query('canvas') private canvasEl?: HTMLCanvasElement;
  private chart?: import('chart.js').Chart;
  private chartJsModule?: typeof import('chart.js');

  connectedCallback(): void {
    super.connectedCallback();
    void loadBoxPlotPlugin().then((boxMod) => this.onBoxPlotPluginLoaded(boxMod));
    if (typeof IntersectionObserver !== 'undefined') {
      this.intersectionObserver = new IntersectionObserver((entries) => {
        const wasVisible = this.visible;
        this.visible = entries[0]?.isIntersecting ?? true;
        if (this.visible && !wasVisible) this.draw();
      });
      this.intersectionObserver.observe(this);
    }
  }

  // Split out from `connectedCallback()` so the partial-peer-dependency-
  // failure path (chart.js loads fine, `@sgratzl/chartjs-chart-boxplot`
  // doesn't) is directly testable: `loadBoxPlotPlugin()` resolves to `null`
  // without ever registering `BoxPlotController`/`BoxAndWiskers` in that
  // case, so this must gate on its resolved value — mirroring the correct,
  // established pattern in `LyraChart.connectedCallback()` — instead of
  // unconditionally re-awaiting the already-cached `loadChartJs()` promise.
  //
  // Also guards against a disconnect while either lazy peer import is still
  // in flight: `this.isConnected` is re-checked after each `await` gap, so a
  // `<lyra-box-plot>` removed before the load settles never constructs a
  // `Chart` bound to a (possibly detached) canvas.
  private async onBoxPlotPluginLoaded(
    boxMod: typeof import('@sgratzl/chartjs-chart-boxplot') | null,
  ): Promise<void> {
    if (!this.isConnected) return;
    this.loading = false;
    if (!boxMod) return;
    const chartMod = await loadChartJs();
    if (!this.isConnected) return;
    this.chartJsModule = chartMod ?? undefined;
    this.draw();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.chart?.destroy();
    this.chart = undefined;
    this.intersectionObserver?.disconnect();
  }

  protected updated(changed: PropertyValues): void {
    if (this.loading) this.setAttribute('aria-busy', 'true');
    else this.removeAttribute('aria-busy');

    // `--lyra-chart-height` is read by `:host`'s `block-size` in
    // `chart.styles.ts` (shared with `lyra-chart`). Custom properties only
    // cascade downward (host -> shadow tree), so this must be set on the
    // host element itself, not on the `[part="base"]` div inside the shadow
    // root.
    if (changed.has('height')) {
      this.style.setProperty('--lyra-chart-height', this.height);
    }
    // While the boxplot peer deps are still loading, `draw()` would no-op
    // anyway (no `chartJsModule`/`canvasEl` yet) — bail before touching
    // `lastSignature` so that phantom "no-op" update doesn't get cached as
    // the baseline and silently swallow the real first draw once loading
    // finishes with no other property having changed in the meantime.
    // Mirrors `LyraChart.updated()`.
    if (this.loading) return;
    if (!this.visible) return; // becoming visible again triggers its own draw() via the observer above
    const signature = this.computeSignature();
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    this.draw();
  }

  /**
   * Resolves the `--lyra-chart-*` theme tokens (declared in
   * `box-plot.styles.ts`, each layered over an existing semantic token) via
   * `getComputedStyle`. Chart.js renders to canvas, not the DOM, so it can't
   * consume CSS `var()` directly — same constraint `chart.ts`'s
   * `themeColors()` documents — so this is called fresh from `buildConfig()`
   * on every draw rather than cached.
   */
  private themeColors(): ThemeColors {
    const cs = getComputedStyle(this);
    return {
      grid: cs.getPropertyValue('--lyra-chart-grid-color').trim() || FALLBACK_GRID_COLOR,
      tick: cs.getPropertyValue('--lyra-chart-tick-color').trim() || FALLBACK_TICK_COLOR,
      legend: cs.getPropertyValue('--lyra-chart-legend-color').trim() || FALLBACK_LEGEND_COLOR,
      tooltipBg: cs.getPropertyValue('--lyra-chart-tooltip-bg').trim() || FALLBACK_TOOLTIP_BG,
      tooltipText: cs.getPropertyValue('--lyra-chart-tooltip-text').trim() || FALLBACK_TOOLTIP_TEXT,
    };
  }

  /**
   * A content-affecting-properties fingerprint used by `updated()` to skip a
   * redundant `draw()` when neither visibility nor any of these properties
   * actually changed since the last draw (e.g. an unrelated property/state
   * update, or `requestUpdate()` with nothing changed). Mirrors
   * `chart.ts`'s `computeSignature()`.
   *
   * Deliberately re-shapes `this.boxes` down to only the `BoxPlotPoint`
   * fields this component itself reads (`min`/`q1`/`median`/`q3`/`max`),
   * rather than `JSON.stringify(this.boxes)` directly:
   * `@sgratzl/chartjs-chart-boxplot`'s controller mutates each data point
   * object in place during Chart.js's own parse step (adding computed
   * `whiskerMin`/`whiskerMax`/`mean` fields onto the *same* object
   * references this component was handed) — so a raw stringify of the
   * whole object would drift to a new value across calls purely from that
   * side effect, with no actual consumer-driven change, defeating the
   * dedup this method exists to provide.
   */
  private computeSignature(): string {
    return JSON.stringify([
      this.labels,
      this.boxes.map((s) => ({
        label: s.label,
        color: s.color,
        data: s.data.map((d) => [d.min, d.q1, d.median, d.q3, d.max]),
      })),
      this.legend,
      this.yLabel,
      this.beginAtZero,
    ]);
  }

  private buildConfig(): import('chart.js').ChartConfiguration {
    const theme = this.themeColors();
    return {
      // boxplot isn't in chart.js's static ChartType union — same cast the seed uses.
      type: 'boxplot' as never,
      data: {
        labels: this.labels,
        datasets: this.boxes.map((s) => ({
          label: s.label,
          data: s.data,
          backgroundColor: s.color,
          borderColor: s.color,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: this.legend, labels: { color: theme.legend } } },
        scales: {
          y: {
            beginAtZero: this.beginAtZero,
            title: { display: !!this.yLabel, text: this.yLabel },
            ticks: { color: theme.tick },
            grid: { color: theme.grid },
          },
        },
      } as never,
    };
  }

  // Mirrors `LyraChart.draw()`'s reuse-existing-instance-when-possible
  // pattern: an update that doesn't need a new Chart.js instance (e.g. a
  // bare `height` change, or new `boxes`/`labels` data) mutates the existing
  // chart and does an incremental `.update('none')` instead of tearing down
  // and rebuilding the whole canvas/instance on every reactive update. Unlike
  // `LyraChart`, `LyraBoxPlot` has no raw `config` passthrough that could
  // change the effective Chart.js type out from under `this.type`, so
  // reusing whenever a chart already exists is always safe here.
  private draw(): void {
    if (!this.chartJsModule || !this.canvasEl) return;
    const config = this.buildConfig();
    if (this.chart) {
      this.chart.data = config.data;
      this.chart.options = config.options ?? {};
      this.chart.update('none');
      return;
    }
    this.chart = new this.chartJsModule.Chart(this.canvasEl, config);
  }

  render(): TemplateResult {
    if (this.loading) {
      return html`
        <div part="base">
          <lyra-skeleton variant="rect"></lyra-skeleton>
        </div>
      `;
    }
    const label = this.boxes.map((b) => b.label).join(', ') || 'Box plot';
    return html`
      <div part="base">
        <canvas part="canvas" role="img" aria-label=${label}></canvas>
      </div>
    `;
  }
}

defineElement('box-plot', LyraBoxPlot);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-box-plot': LyraBoxPlot;
  }
}
