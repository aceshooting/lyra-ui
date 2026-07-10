import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import type { Chart, ChartConfiguration, ChartType } from 'chart.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { loadChartJs } from './chart-loader.js';
import { styles } from './chart.styles.js';

export interface Series {
  label: string;
  data?: (number | null)[];
  points?: { x: number; y: number; label?: string }[];
  color?: string | string[];
  fill?: boolean;
  width?: number;
  dash?: boolean;
  noTooltip?: boolean;
  axis?: 'y' | 'y2';
  pointColors?: string[];
  pointRadius?: number;
  type?: 'line' | 'bar';
}

export type LyraChartType = 'line' | 'bar' | 'scatter';

/**
 * `<lyra-chart>` — the core Chart.js wrapper every other `lyra-*-chart` tag
 * subclasses. Requires the optional peer deps `chart.js` + `chartjs-plugin-zoom`.
 *
 * **API mirror note (Task 0):** the real `wa-chart` docs page
 * (https://webawesome.com/docs/components/chart/) documents a `config:
 * ChartJS['config']` property alongside its simplified attributes — "a
 * flexible wrapper around Chart.js" supporting *both* simplified attributes
 * and full Chart.js configuration passthrough, not a `data`/`options` prop
 * pair. `lyra-chart` mirrors that dual surface: the `Series`-based
 * `datasets`/`labels`/`type`/`legend`/`xLabel`/`yLabel`/`zoom` attributes
 * below are the simplified surface (compatible with WA's `type`, `xLabel`,
 * `yLabel`, `withoutLegend`-equivalent `legend`, etc.), and the additional
 * `config` property is the raw-passthrough escape hatch — a
 * `Partial<ChartConfiguration>` deep-merged over the generated config in
 * `buildConfig()`, mirroring WA's `config` property without discarding the
 * `Series` shape the rest of this component family (subclasses, box-plot,
 * histogram) is built on.
 *
 * @customElement lyra-chart
 * @event lyra-zoom - `detail: { zoomed }`.
 * @csspart base, canvas, reset-zoom-button
 */
export class LyraChart extends LyraElement {
  static styles = [LyraElement.styles, styles];

  @property() type: LyraChartType = 'line';
  @property({ attribute: false }) labels: string[] = [];
  @property({ attribute: false }) datasets: Series[] = [];
  @property({ type: Boolean }) legend = false;
  @property({ type: Boolean }) area = false;
  @property({ type: Boolean }) zoom = false;
  @property() height = '280px';
  @property({ attribute: 'x-label' }) xLabel = '';
  @property({ attribute: 'y-label' }) yLabel = '';
  @property({ attribute: 'y2-label' }) y2Label = '';
  @property({ type: Boolean, attribute: 'begin-at-zero' }) beginAtZero = true;

  /**
   * Raw Chart.js configuration passthrough — mirrors `wa-chart`'s `config`
   * property. Deep-merged over the `Series`-derived config in `buildConfig()`
   * (`config.data`/`config.options` win per-key over the generated
   * equivalents), for consumers who need full Chart.js control beyond the
   * simplified `Series` shape.
   */
  @property({ attribute: false }) config?: Partial<ChartConfiguration>;

  @state() private zoomed = false;

  @query('canvas') private canvasEl?: HTMLCanvasElement;
  private chart?: Chart;
  private chartJsModule?: typeof import('chart.js');
  // Tracks the *effective* Chart.js type actually passed to `new Chart()` —
  // i.e. `config.type` post-merge, not `this.type` — since `config.type` (the
  // raw passthrough) can override the generated type in `buildConfig()`. See
  // the deep-merge note on `buildConfig()` below.
  private builtType?: ChartType;

  private onThemeChange = (): void => this.draw();

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('lyra-theme', this.onThemeChange);
    void loadChartJs().then((mod) => {
      if (!mod) return;
      this.chartJsModule = mod;
      this.draw();
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('lyra-theme', this.onThemeChange);
    this.chart?.destroy();
    this.chart = undefined;
  }

  protected updated(changed: PropertyValues): void {
    const onlyZoomChanged = changed.size === 1 && changed.has('zoomed' as never);
    if (!onlyZoomChanged) this.draw();
  }

  private seriesToDataset(s: Series) {
    const colors = Array.isArray(s.color) ? s.color : s.color ? [s.color] : undefined;
    return {
      label: s.label,
      data: s.points ?? s.data ?? [],
      type: s.type ?? this.type,
      fill: s.fill ?? this.area,
      borderWidth: s.width ?? 2,
      borderDash: s.dash ? [4, 4] : undefined,
      backgroundColor: colors,
      borderColor: colors?.[0],
      pointBackgroundColor: s.pointColors,
      pointRadius: s.pointRadius,
      yAxisID: s.axis === 'y2' ? 'y2' : 'y',
      tooltip: s.noTooltip ? { enabled: false } : undefined,
    };
  }

  private buildConfig(): ChartConfiguration {
    const hasY2 = this.datasets.some((s) => s.axis === 'y2');
    const generated: ChartConfiguration = {
      type: this.type as ChartType,
      data: {
        labels: this.labels,
        datasets: this.datasets.map((s) => this.seriesToDataset(s)) as never,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: this.type === 'scatter' ? 'nearest' : 'index' },
        plugins: {
          legend: { display: this.legend },
          zoom: this.zoom
            ? {
                pan: { enabled: false },
                zoom: {
                  wheel: { enabled: true },
                  drag: { enabled: true },
                  pinch: { enabled: true },
                  mode: 'x',
                  onZoomComplete: () => {
                    this.zoomed = true;
                    this.emit('lyra-zoom', { zoomed: true });
                  },
                },
                limits: { x: { min: 'original', max: 'original' } },
              }
            : undefined,
        },
        scales: {
          x: {
            type: this.type === 'scatter' ? 'linear' : 'category',
            title: { display: !!this.xLabel, text: this.xLabel },
          },
          y: { beginAtZero: this.beginAtZero, title: { display: !!this.yLabel, text: this.yLabel } },
          ...(hasY2
            ? {
                y2: {
                  position: 'right',
                  grid: { drawOnChartArea: false },
                  title: { display: !!this.y2Label, text: this.y2Label },
                },
              }
            : {}),
        },
      },
    };

    if (!this.config) return generated;

    // Raw Chart.js passthrough (mirrors `wa-chart`'s `config` property) —
    // deep-merge `data`/`options` over the `Series`-derived config, letting
    // consumers override or extend anything the simplified shape doesn't
    // expose.
    return {
      ...generated,
      ...this.config,
      data: { ...generated.data, ...this.config.data },
      options: { ...generated.options, ...this.config.options },
    } as ChartConfiguration;
  }

  private draw(): void {
    if (!this.chartJsModule || !this.canvasEl) return;
    const config = this.buildConfig();
    const effectiveType = config.type;
    if (this.chart && this.builtType === effectiveType) {
      this.chart.data = config.data;
      this.chart.options = config.options ?? {};
      this.chart.update('none');
      return;
    }
    this.chart?.destroy();
    this.chart = new this.chartJsModule.Chart(this.canvasEl, config);
    this.builtType = effectiveType;
  }

  /** Reset any active zoom/pan back to the original view. */
  resetZoom(): void {
    (this.chart as unknown as { resetZoom?: () => void })?.resetZoom?.();
    this.zoomed = false;
    this.emit('lyra-zoom', { zoomed: false });
  }

  render(): TemplateResult {
    const label = this.datasets.map((d) => d.label).join(', ') || 'Chart';
    return html`
      <div part="base" style=${`--lyra-chart-height:${this.height}`}>
        <canvas part="canvas" role="img" aria-label=${label}></canvas>
        ${this.zoom && this.zoomed
          ? html`<button part="reset-zoom-button" type="button" @click=${() => this.resetZoom()}>
              Reset zoom
            </button>`
          : nothing}
      </div>
    `;
  }
}

defineElement('chart', LyraChart);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-chart': LyraChart;
  }
}
