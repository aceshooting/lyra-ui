import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import type { Chart, ChartConfiguration } from 'chart.js';
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

  @query('canvas') private canvasEl?: HTMLCanvasElement;
  private chart?: Chart;
  private chartJsModule?: typeof import('chart.js');

  connectedCallback(): void {
    super.connectedCallback();
    void loadBoxPlotPlugin().then((boxMod) => this.onBoxPlotPluginLoaded(boxMod));
  }

  // Split out from `connectedCallback()` so the partial-peer-dependency-
  // failure path (chart.js loads fine, `@sgratzl/chartjs-chart-boxplot`
  // doesn't) is directly testable: `loadBoxPlotPlugin()` resolves to `null`
  // without ever registering `BoxPlotController`/`BoxAndWiskers` in that
  // case, so this must gate on its resolved value — mirroring the correct,
  // established pattern in `LyraChart.connectedCallback()` — instead of
  // unconditionally re-awaiting the already-cached `loadChartJs()` promise.
  private async onBoxPlotPluginLoaded(
    boxMod: typeof import('@sgratzl/chartjs-chart-boxplot') | null,
  ): Promise<void> {
    this.loading = false;
    if (!boxMod) return;
    this.chartJsModule = (await loadChartJs()) ?? undefined;
    this.draw();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.chart?.destroy();
    this.chart = undefined;
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
    this.draw();
  }

  private buildConfig(): ChartConfiguration {
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
        plugins: { legend: { display: this.legend } },
        scales: { y: { beginAtZero: this.beginAtZero, title: { display: !!this.yLabel, text: this.yLabel } } },
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
