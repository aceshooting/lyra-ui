import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import type { OptionalPeerApi } from '../../internal/optional-peer-types.js';
import { nextId, srOnly } from '../../internal/a11y.js';
import { loadChartJs, loadChartJsWithZoom } from './chart-loader.js';
import { styles } from './chart.styles.js';
import '../skeleton/skeleton.class.js';

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

export type LyraChartType =
  | 'line'
  | 'bar'
  | 'scatter'
  | 'pie'
  | 'doughnut'
  | 'radar'
  | 'polarArea'
  | 'bubble';

const CHART_TYPES = new Set<LyraChartType>([
  'line',
  'bar',
  'scatter',
  'pie',
  'doughnut',
  'radar',
  'polarArea',
  'bubble',
]);

function normalizeChartType(value: unknown): LyraChartType {
  return typeof value === 'string' && CHART_TYPES.has(value as LyraChartType)
    ? (value as LyraChartType)
    : 'line';
}

/**
 * Recursively merges `override` onto `base`, matching JSON-merge semantics:
 * plain objects are merged key-by-key at every depth; arrays, functions, and
 * any other value type are replaced wholesale by `override`'s value. Used to
 * deep-merge the raw `config` passthrough over the `Series`-generated config
 * in `buildConfig()` so a nested key (e.g. `config.options.scales.y`) only
 * overrides the keys it sets, rather than clobbering the whole generated
 * sibling object (e.g. the rest of the generated `y` axis config).
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Keys that would let a JSON-sourced `config` (e.g. parsed from an API
// response) reach up through the merge and mutate `Object.prototype` —
// skipped unconditionally regardless of `base`'s own shape.
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

// Defensive JS-side fallbacks for themeColors() below, mirroring the
// light-mode default of each `--lyra-chart-*` token's own fallback chain
// (see chart.styles.ts) — only reached if getComputedStyle somehow can't
// resolve the custom property at all (e.g. host detached from the document).
const FALLBACK_GRID_COLOR = '#8a8a90';
const FALLBACK_TICK_COLOR = '#6b7280';
const FALLBACK_LEGEND_COLOR = '#1a1a1a';
const FALLBACK_TOOLTIP_BG = '#fff';
const FALLBACK_TOOLTIP_TEXT = '#1a1a1a';

interface ThemeColors {
  grid: string;
  tick: string;
  legend: string;
  tooltipBg: string;
  tooltipText: string;
}

function deepMerge<T>(base: T, override: unknown, seen = new WeakMap<object, unknown>()): T {
  if (typeof override === 'object' && override !== null) {
    const previous = seen.get(override);
    if (previous !== undefined) return previous as T;
  }
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return (override === undefined ? base : (override as T)) as T;
  }
  const result: Record<string, unknown> = { ...base };
  seen.set(override, result);
  for (const key of Object.keys(override)) {
    if (UNSAFE_KEYS.has(key)) continue;
    result[key] = deepMerge((base as Record<string, unknown>)[key], override[key], seen);
  }
  return result as T;
}

export interface LyraChartEventMap {
  'lyra-point-click': CustomEvent<{
    datasetIndex: number;
    index: number;
    label: string | undefined;
    value: unknown;
  }>;
  'lyra-zoom': CustomEvent<{ zoomed: boolean }>;
}
/**
 * `<lyra-chart>` — the core Chart.js wrapper every other `lyra-*-chart` tag
 * subclasses. Requires the optional peer deps `chart.js` + `chartjs-plugin-zoom`.
 *
 * **API mirror note:** the real `wa-chart` docs page
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
 * @event lyra-point-click - Fired when a click lands on (or nearest,
 *   intersect-only — see `handlePointClick()`) a data point/segment.
 *   `detail: { datasetIndex: number, index: number, label: string |
 *   undefined, value: unknown }`.
 * @csspart base - The chart wrapper.
 * @csspart canvas - The Chart.js canvas.
 * @csspart reset-zoom-button - The reset-zoom control when zoom is active.
 * @csspart description - The accessible chart summary.
 * @csspart data-table - The optional generated or slotted data table.
 * @slot data-table - An optional consumer-provided accessible table alternative.
 */
export class LyraChart extends LyraElement<LyraChartEventMap> {
  static styles = [LyraElement.styles, styles, srOnly];

  @property({ converter: { fromAttribute: (value) => normalizeChartType(value) } })
  type: LyraChartType = 'line';
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
  /** Accessible name applied to the canvas. Falls back to the dataset labels. */
  @property({ attribute: 'accessible-label' }) accessibleLabel = '';
  /** Accessible description for the canvas. When unset, a concise data/trend summary is generated. */
  @property({ attribute: 'accessible-description' }) accessibleDescription = '';
  /** Makes the generated data table visible; it remains screen-reader available when false. */
  @property({ type: Boolean, attribute: 'show-data-table' }) showDataTable = false;
  /** Sets `options.indexAxis = 'y'`, Chart.js's own mechanism for horizontal bars (also applies to line/area types). */
  @property({ type: Boolean }) horizontal = false;
  /** Stacks the `x`/`y`(/`y2`) scale entries `buildScales()` returns; only meaningful for `bar` and `line` types. */
  @property({ type: Boolean }) stacked = false;

  /**
   * Raw Chart.js configuration passthrough — mirrors `wa-chart`'s `config`
   * property. Recursively deep-merged over the `Series`-derived config in
   * `buildConfig()` (any key at any nesting depth — e.g.
   * `config.options.scales.y.min` — wins over the generated equivalent
   * without discarding sibling keys the generated config set), for consumers
   * who need full Chart.js control beyond the simplified `Series` shape.
   */
  @property({ attribute: false }) config?: OptionalPeerApi;

  /** True until the lazy-loaded `chart.js` peer dependency has settled (success or failure). */
  @state() private loading = true;

  @state() private zoomed = false;

  @state() private visible = true;
  private intersectionObserver?: IntersectionObserver;

  @query('canvas') private canvasEl?: HTMLCanvasElement;
  private chart?: OptionalPeerApi;
  private chartJsModule?: OptionalPeerApi;
  // Tracks the *effective* Chart.js type actually passed to `new Chart()` —
  // i.e. `config.type` post-merge, not `this.type` — since `config.type` (the
  // raw passthrough) can override the generated type in `buildConfig()`. See
  // the deep-merge note on `buildConfig()` below.
  private builtType?: OptionalPeerApi;
  // `chartjs-plugin-zoom`'s own `resetZoom()` synchronously re-invokes the
  // `onZoomComplete` callback below as part of its reset, which would emit a
  // stale `{zoomed: true}` right before `resetZoom()` emits the real
  // `{zoomed: false}`. Set while this component's own `resetZoom()` is
  // driving the plugin so that re-entrant callback is ignored.
  private suppressZoomComplete = false;
  private descriptionId = nextId('chart-description');

  connectedCallback(): void {
    super.connectedCallback();
    const load = this.zoom ? loadChartJsWithZoom() : loadChartJs();
    void load.then((mod) => {
      if (!this.isConnected) return;
      this.loading = false;
      if (!mod) return;
      this.chartJsModule = mod;
      this.draw();
    });
    if (typeof IntersectionObserver !== 'undefined') {
      this.intersectionObserver = new IntersectionObserver((entries) => {
        const wasVisible = this.visible;
        this.visible = entries[0]?.isIntersecting ?? true;
        if (this.visible && !wasVisible) this.draw();
      });
      this.intersectionObserver.observe(this);
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.chart?.destroy();
    this.chart = undefined;
    this.intersectionObserver?.disconnect();
  }

  /**
   * Resets a stale `zoomed` flag before the render pass that's about to call
   * `draw()`: a `type` (or `config.type` override) change that lands on a
   * *different* effective Chart.js type makes `draw()` destroy the old
   * `Chart` instance and construct a brand-new one, which was never zoomed —
   * without this, `render()`'s reset-zoom-button stays visible for an
   * instance that has no zoom/pan state left to reset. Computed here (before
   * render), not in `updated()`/`draw()`, because setting `zoomed` — a
   * reactive `@state` property — from `updated()` would schedule a second,
   * redundant update pass; `willUpdate()` runs before this cycle's render is
   * considered complete, so the same set just folds into the render already
   * in progress. Same rationale as `toast-item.ts`'s `willUpdate()`-vs-
   * `updated()` split.
   */
  protected willUpdate(): void {
    if (!this.zoomed) return;
    if (this.effectiveType() !== this.builtType) {
      this.zoomed = false;
    }
  }

  protected updated(changed: PropertyValues): void {
    // Disconnected between the property change that scheduled this update
    // and Lit's (microtask-deferred) processing of it — e.g. a property
    // changes and the element is removed in the same synchronous tick, so
    // `disconnectedCallback()` (which already destroyed `this.chart`) runs
    // *before* this method does. Nothing below should run in that case:
    // this method's own unconditional `draw()` call further down would
    // otherwise construct a brand-new `Chart` bound to the now-detached
    // canvas — `draw()`'s own guard (`!chartJsModule || !canvasEl`) doesn't
    // catch this, since both persist on a disconnected-but-intact element.
    // If the component is reconnected later, `connectedCallback()` re-kicks
    // its own load/draw sequence, so nothing is lost by bailing out here.
    if (!this.isConnected) return;

    if (this.loading) this.setAttribute('aria-busy', 'true');
    else this.removeAttribute('aria-busy');

    // `--lyra-chart-height` is read by `:host`'s `block-size` in
    // `chart.styles.ts`. Custom properties only cascade downward (host ->
    // shadow tree), never upward from a shadow-tree descendant back to the
    // host, so this must be set on the host element itself, not on the
    // `[part="base"]` div inside the shadow root.
    if (changed.has('height')) {
      this.style.setProperty('--lyra-chart-height', this.height);
    }
    // While `chart.js` is still loading, `draw()` would no-op anyway (no
    // `chartJsModule`/`canvasEl` yet) — bail before touching `lastSignature`
    // so that phantom "no-op" update doesn't get cached as the baseline and
    // silently swallow the real first draw once loading finishes with no
    // other property having changed in the meantime.
    if (this.loading) return;

    // `zoom` can also turn on after connect (it was false at
    // `connectedCallback()` time, so only the core `loadChartJs()` load was
    // kicked off) — load the zoom plugin on demand now and redraw once it's
    // registered. Mirrors the same `isConnected` guard `connectedCallback()`
    // uses: this method already bailed out above if *already* disconnected,
    // but the element can *also* disconnect during the gap while this
    // dynamic import is in flight — without this guard, `draw()` would
    // construct a new, leaked `Chart` bound to the now-detached canvas once
    // the import resolves.
    if (changed.has('zoom') && this.zoom) {
      void loadChartJsWithZoom().then(() => {
        if (!this.isConnected) return;
        this.draw();
      });
    }
    const contentChanged = [
      'type',
      'labels',
      'datasets',
      'legend',
      'area',
      'height',
      'xLabel',
      'yLabel',
      'y2Label',
      'beginAtZero',
      'horizontal',
      'stacked',
      'config',
      'zoom',
      'loading',
    ].some((name) => changed.has(name));
    if (!contentChanged) return;
    if (!this.visible) return; // becoming visible again triggers its own draw() via the observer above
    this.draw();
  }

  private seriesToDataset(s: Series) {
    const colors = Array.isArray(s.color) ? s.color : s.color ? [s.color] : undefined;
    return {
      label: s.label,
      data: s.points ?? s.data ?? [],
      // Leave unset rather than defaulting to `this.type`: Chart.js already
      // falls back to the chart-level (effective) type for any dataset that
      // doesn't set its own `type`, and forcing `this.type` here unconditionally
      // used to be harmless (it normally matched the effective type anyway) —
      // but it actively breaks a `config.type` override to a different chart
      // family (e.g. attribute `type="line"` + `config.type: 'radar'`): every
      // dataset would carry an explicit `type: 'line'` under a chart whose
      // scales are built for `radar` (a single radial `r` scale, no `x`/`y`),
      // which Chart.js can't reconcile — it hangs the page trying to lay out
      // a cartesian-scale controller against a radial-only scale set. Only
      // `s.type` (an explicit per-series mixed-type override, e.g. a line
      // series over a bar chart of the *same* effective family) is passed
      // through.
      type: s.type,
      fill: s.fill ?? this.area,
      borderWidth: s.width ?? 2,
      borderDash: s.dash ? [4, 4] : undefined,
      backgroundColor: colors,
      borderColor: colors?.[0],
      pointBackgroundColor: s.pointColors,
      pointRadius: s.pointRadius,
      yAxisID: s.axis === 'y2' ? 'y2' : 'y',
    };
  }

  /**
   * Resolves the `--lyra-chart-*` theme tokens (declared in
   * `chart.styles.ts`, each layered over an existing semantic token) via
   * `getComputedStyle`. Chart.js renders to canvas, not the DOM, so it can't
   * consume CSS `var()` directly — same constraint documented on
   * `heatmap.ts`'s `labelColor()`/`noDataFill()`/`scaleEndpoints()` — so this
   * is called fresh from `buildConfig()` on every draw rather than cached.
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
   * Builds `options.scales` for the effective chart type: no scale at all for
   * pie/doughnut (a proportional-area chart has no axis), the single radial
   * `r` scale Chart.js v4 uses for radar/polarArea, and the cartesian
   * `x`/`y`(/`y2`) block for every other (line/bar/scatter/bubble) type — with
   * `x` itself further split within that block: scatter and bubble datasets
   * carry raw numeric `{x, y(, r)}` points (via `Series.points`) and need a
   * linear `x` scale, while line/bar plot against `labels` and need the
   * default categorical one. `theme` (from `themeColors()`) drives every
   * scale's `ticks.color`/`grid.color`/axis `title.color` so grid lines and
   * labels retheme instead of sitting at Chart.js's own hardcoded defaults.
   */
  private buildScales(
    effectiveType: OptionalPeerApi,
    theme: ThemeColors,
  ): OptionalPeerApi {
    if (effectiveType === 'pie' || effectiveType === 'doughnut') return {};

    if (effectiveType === 'radar' || effectiveType === 'polarArea') {
      return {
        r: {
          beginAtZero: this.beginAtZero,
          ticks: { color: theme.tick },
          grid: { color: theme.grid },
          angleLines: { color: theme.grid },
          pointLabels: { color: theme.tick },
        },
      };
    }

    const hasY2 = this.datasets.some((s) => s.axis === 'y2');
    // `stacked` only applies to bar/line-family charts sharing a categorical
    // axis, per the design spec — scatter/bubble's linear x scale and the
    // radial r scale above are out of scope.
    const stacked = this.stacked && (effectiveType === 'bar' || effectiveType === 'line');
    return {
      x: {
        type: effectiveType === 'scatter' || effectiveType === 'bubble' ? 'linear' : 'category',
        title: { display: !!this.xLabel, text: this.xLabel, color: theme.tick },
        ticks: { color: theme.tick },
        grid: { color: theme.grid },
        stacked,
      },
      y: {
        beginAtZero: this.beginAtZero,
        title: { display: !!this.yLabel, text: this.yLabel, color: theme.tick },
        ticks: { color: theme.tick },
        grid: { color: theme.grid },
        stacked,
      },
      ...(hasY2
        ? {
            y2: {
              position: 'right',
              grid: { drawOnChartArea: false, color: theme.grid },
              title: { display: !!this.y2Label, text: this.y2Label, color: theme.tick },
              ticks: { color: theme.tick },
              stacked,
            },
          }
        : {}),
    };
  }

  /**
   * `options.onClick` handler wired in `buildConfig()`. The chart-wide
   * `interaction` mode above (`'index'`/`'nearest'`, `intersect: false`) is
   * tuned for hover tooltips — resolving which single point/segment was
   * actually clicked needs its own `getElementsAtEventForMode('nearest', {
   * intersect: true }, true)` lookup instead, so a click landing off any
   * point/segment reports nothing (`elements` empty) rather than firing for
   * whatever's nearest. Covers the per-bar/per-segment click ask for any
   * chart type (bar/line/pie/doughnut/etc.), not just bars.
   */
  private handlePointClick(event: OptionalPeerApi, chart: OptionalPeerApi): void {
    // Chart.js's own `onClick` handler hands us its `ChartEvent` wrapper, but
    // `getElementsAtEventForMode()`'s .d.ts (inaccurately) types its first
    // param as a DOM `Event` — at runtime Chart.js only reads `.x`/`.y` off
    // whatever is passed (see chart.js/src/helpers/helpers.dom.ts
    // `getRelativePosition()`), which `ChartEvent` already has, so the cast
    // here is a type-only correction, not a behavior change.
    const elements = chart.getElementsAtEventForMode(
      event as unknown as Event,
      'nearest',
      { intersect: true },
      true,
    ) as OptionalPeerApi[];
    const hit = elements[0];
    if (!hit) return;
    const { datasetIndex, index } = hit;
    const label = chart.data.labels?.[index] as string | undefined;
    const value = chart.data.datasets[datasetIndex]?.data?.[index] ?? null;
    this.emit('lyra-point-click', { datasetIndex, index, label, value });
  }

  /**
   * `config.type` (if set) overrides the attribute `type` post-merge — this
   * is the one place that resolution logic lives, shared by `buildConfig()`
   * (which needs it to build scales/interaction for the right type) and
   * `willUpdate()` (which needs it to detect a type change against the last
   * *actually built* type, `this.builtType`, before the render pass that
   * would rebuild the `Chart` instance).
   */
  private effectiveType(): OptionalPeerApi {
    return (
      (this.config?.type as OptionalPeerApi | undefined) ?? normalizeChartType(this.type)
    );
  }

  private buildConfig(): OptionalPeerApi {
    const theme = this.themeColors();
    // Resolve the effective type up front: `config.type` (if set) overrides
    // the attribute `type` post-merge, so scales/interaction must be built
    // for *that* type, not `this.type` — otherwise a config.type override
    // (e.g. line -> radar) ships with the wrong axis shape (categorical x/y
    // instead of a radial r scale).
    const effectiveType = this.effectiveType();
    const generated: OptionalPeerApi = {
      type: effectiveType,
      data: {
        labels: this.labels,
        datasets: this.datasets.map((s) => this.seriesToDataset(s)) as never,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        // Chart.js's own mechanism for horizontal bars (also flips line/area
        // types onto a horizontal category axis).
        indexAxis: this.horizontal ? 'y' : undefined,
        // Chart.js's own default ~1000ms draw-in animation only ever fires
        // from `new Chart()` (chart/type-change construction) — every
        // in-place update in `draw()` already passes `'none'` to
        // `Chart#update()`. A CSS media query can't reach that
        // canvas-internal animation loop, so `prefersReducedMotion()` is
        // checked here instead and fed into `options.animation`.
        animation: prefersReducedMotion() ? false : undefined,
        interaction: { intersect: false, mode: effectiveType === 'scatter' ? 'nearest' : 'index' },
        onClick: (event: OptionalPeerApi, _elements: OptionalPeerApi, chart: OptionalPeerApi) =>
          this.handlePointClick(event, chart),
        plugins: {
          legend: { display: this.legend, labels: { color: theme.legend } },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            // Chart.js's tooltip plugin has no per-dataset `tooltip.enabled`
            // — `Series.noTooltip` is implemented here instead, via the one
            // mechanism the core tooltip plugin actually reads.
            filter: (item: OptionalPeerApi) => !this.datasets[item.datasetIndex]?.noTooltip,
          },
          zoom: this.zoom
            ? {
                pan: { enabled: false },
                zoom: {
                  wheel: { enabled: true },
                  drag: { enabled: true },
                  pinch: { enabled: true },
                  mode: 'x',
                  onZoomComplete: () => {
                    if (this.suppressZoomComplete) return;
                    this.zoomed = true;
                    this.emit('lyra-zoom', { zoomed: true });
                  },
                },
                limits: { x: { min: 'original', max: 'original' } },
              }
            : undefined,
        },
        scales: this.buildScales(effectiveType, theme),
      },
    };

    if (!this.config) return generated;

    // Raw Chart.js passthrough (mirrors `wa-chart`'s `config` property) —
    // deep-merge `config` over the `Series`-derived config at every nesting
    // level (see `deepMerge` above), letting consumers override or extend a
    // single nested key (e.g. `config.options.scales.y.min`) without
    // clobbering the rest of the generated sibling object.
    return deepMerge(generated, this.config);
  }

  private draw(): void {
    if (!this.chartJsModule || !this.canvasEl) return;
    const config = this.buildConfig();
    const effectiveType = config.type;
    if (this.chart && this.builtType === effectiveType) {
      // Chart.js tracks per-dataset legend-toggled visibility by dataset INDEX against its own
      // internal metadata, separate from `chart.data.datasets` itself -- a full reassignment of
      // `chart.data` on every reactive update (as every live-polling consumer's parent naturally
      // produces) would otherwise silently reset every hidden series back to visible.
      const priorVisibility = this.datasets.map((_, i) => this.chart!.isDatasetVisible(i));
      this.chart.data = config.data;
      this.chart.options = config.options ?? {};
      this.chart.update('none');
      priorVisibility.forEach((visible, i) => {
        if (!visible) this.chart!.setDatasetVisibility(i, false);
      });
      return;
    }
    this.chart?.destroy();
    this.chart = new this.chartJsModule.Chart(this.canvasEl, config);
    this.builtType = effectiveType;
  }

  /** Reset any active zoom/pan back to the original view. */
  resetZoom(): void {
    this.suppressZoomComplete = true;
    try {
      (this.chart as unknown as { resetZoom?: () => void })?.resetZoom?.();
    } finally {
      this.suppressZoomComplete = false;
    }
    this.zoomed = false;
    this.emit('lyra-zoom', { zoomed: false });
  }

  /**
   * Forces a redraw so `themeColors()` re-reads the `--lyra-chart-*` custom
   * properties from the current computed style. No global theme-broadcast
   * event exists anywhere in lyra-ui (nothing to subscribe to here) — this
   * is the escape hatch for a consumer's own theme-toggle handler to call
   * directly when it flips e.g. a `data-theme` attribute upstream that
   * doesn't otherwise change any `lyra-chart` property, so Lit's reactive
   * update loop has nothing of its own to trigger `draw()` on.
   */
  refreshTheme(): void {
    this.draw();
  }

  private seriesValues(series: Series): number[] {
    if (series.points) return series.points.map((point) => point.y).filter((value) => Number.isFinite(value));
    return (series.data ?? []).filter((value): value is number => value != null && Number.isFinite(value));
  }

  private chartDescription(): string {
    if (this.accessibleDescription) return this.accessibleDescription;
    const summaries = this.datasets.map((series) => {
      const values = this.seriesValues(series);
      if (!values.length) return `${series.label}: no data`;
      const first = values[0]!;
      const last = values[values.length - 1]!;
      const trend = last > first ? 'increasing' : last < first ? 'decreasing' : 'flat';
      let min = values[0]!;
      let max = values[0]!;
      for (const value of values) {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
      return `${series.label}: ${values.length} values, range ${min} to ${max}, ${trend} trend`;
    });
    return `${this.effectiveType()} chart${summaries.length ? `. ${summaries.join('. ')}` : ' with no data'}.`;
  }

  private renderDataTable(): TemplateResult {
    const rowCount = Math.max(
      this.labels.length,
      ...this.datasets.map((series) => (series.points ? series.points.length : series.data?.length ?? 0)),
      0,
    );
    return html`
      <table class=${this.showDataTable ? nothing : 'sr-only'}>
        <caption>${this.accessibleLabel || 'Chart data'}</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            ${this.datasets.map((series) => html`<th scope="col">${series.label}</th>`)}
          </tr>
        </thead>
        <tbody>
          ${Array.from({ length: rowCount }, (_, index) => html`
            <tr>
              <th scope="row">${this.labels[index] ?? `Point ${index + 1}`}</th>
              ${this.datasets.map((series) => {
                const value = series.points ? series.points[index]?.y : series.data?.[index];
                return html`<td>${value == null || !Number.isFinite(value) ? this.localize('noData') : value}</td>`;
              })}
            </tr>
          `)}
        </tbody>
      </table>
    `;
  }

  render(): TemplateResult {
    if (this.loading) {
      return html`
        <div part="base">
          <lyra-skeleton variant="rect"></lyra-skeleton>
        </div>
      `;
    }
    const label = this.accessibleLabel || this.datasets.map((d) => d.label).join(', ') || 'Chart';
    const description = this.chartDescription();
    return html`
      <div part="base">
        <canvas part="canvas" role="img" aria-label=${label} aria-describedby=${this.descriptionId}></canvas>
        <p part="description" id=${this.descriptionId} class="sr-only">${description}</p>
        <div part="data-table">
          <slot name="data-table"></slot>
          ${this.renderDataTable()}
        </div>
        ${this.zoom && this.zoomed
          ? html`<button part="reset-zoom-button" type="button" @click=${() => this.resetZoom()}>
              Reset zoom
            </button>`
          : nothing}
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lyra-chart': LyraChart;
  }
}

/**
 * Installs a read-only `type` accessor pair on a `LyraChart` subclass's
 * prototype, locking it to `value` — assigning `.type` afterwards (attribute
 * or property) is silently ignored. `LyraChart` declares `type` as a plain
 * (decorator-managed) class field, and TypeScript forbids a subclass from
 * re-declaring a base field as a getter/setter pair via ordinary class
 * syntax (TS2611), so the accessor pair is installed directly on the
 * prototype instead, which is runtime-equivalent (same shadowing semantics
 * as a class-syntax override) without tripping that check. Shared by every
 * `lyra-*-chart` subclass (bar/line/pie/doughnut/scatter/bubble/radar/
 * polarArea) plus `lyra-histogram`, replacing what used to be an identical
 * ~16-line `Object.defineProperty` block copy-pasted into each file.
 */
export function lockChartType(ctor: Function, value: string): void {
  Object.defineProperty(ctor.prototype, 'type', {
    configurable: true,
    enumerable: true,
    get(): string {
      return value;
    },
    set(_v: string) {
      /* locked to `value`; direct writes are ignored */
    },
  });
}
