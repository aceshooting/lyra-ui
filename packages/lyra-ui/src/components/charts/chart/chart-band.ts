/**
 * Range-band rendering for `LyraChartSeries.type: 'band'`. A band reaches Chart.js as a line
 * dataset whose data are the upper bounds and whose private `lyraBandLower` carries the matching
 * lower bounds; the hooks below widen the value scale to the lower bounds and fill the region
 * between both edges before any dataset draws, so every line stays on top of every band.
 */

/** Chart.js dataset key carrying a band's lower bounds, aligned with the dataset's `data`. */
export const CHART_BAND_LOWER_KEY = 'lyraBandLower';

/** Chart.js dataset key carrying one band's own fill alpha (0-1), when its series sets `bandOpacity`. */
export const CHART_BAND_OPACITY_KEY = 'lyraBandOpacity';

/** An admitted 0-1 alpha, or `undefined` to follow `--lr-chart-band-opacity`. */
function ownOpacity(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : undefined;
}

/** A Chart.js band dataset's own alpha, from its private key. */
function bandOwnOpacity(dataset: object): number | undefined {
  return ownOpacity((dataset as Record<string, unknown>)[CHART_BAND_OPACITY_KEY]);
}

/** Inline declaration giving a band's legend swatch its series' own `bandOpacity`, or `''` for the shared token. */
export function chartBandSwatchOpacity(bandOpacity: unknown): string {
  const own = ownOpacity(bandOpacity);
  return own === undefined ? '' : `;--_lr-chart-swatch-opacity:${own}`;
}

/** Default `--lr-chart-band-opacity`. */
const DEFAULT_CHART_BAND_OPACITY = 0.2;

/** Semantic (source-index) lower bounds of each generated band dataset. */
export const chartBandLowerValues = new WeakMap<object, readonly (number | null)[]>();

interface BandScale {
  readonly id?: string;
  readonly axis?: string;
  readonly options?: { readonly min?: unknown };
  min: number;
  getPixelForValue(value: number): number;
}

interface BandMeta {
  readonly type?: string;
  readonly hidden?: boolean | null;
  readonly vScale?: BandScale;
  readonly data?: readonly { readonly x: number; readonly y: number; readonly skip?: boolean }[];
}

interface BandChart {
  readonly data: { readonly datasets: readonly object[] };
  readonly ctx?: CanvasRenderingContext2D | null;
  readonly chartArea?: { left: number; top: number; right: number; bottom: number };
  isDatasetVisible(index: number): boolean;
  getDatasetMeta?(index: number): unknown;
}

function bandLower(dataset: object): readonly (number | null)[] | undefined {
  const value = (dataset as Record<string, unknown>)[CHART_BAND_LOWER_KEY];
  return Array.isArray(value) ? value as readonly (number | null)[] : undefined;
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Parses the resolved `--lr-chart-band-opacity` text into a 0-1 alpha. */
export function chartBandOpacity(text: string): number {
  const value = Number.parseFloat(text);
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : DEFAULT_CHART_BAND_OPACITY;
}

/** `afterDataLimits`: widen an automatic value scale so every visible lower bound is in range. */
export function extendChartBandLimits(chart: BandChart, scale: BandScale): void {
  chart.data.datasets.forEach((dataset, index) => {
    const lower = bandLower(dataset);
    if (!lower || !chart.isDatasetVisible(index)) return;
    const meta = chart.getDatasetMeta?.(index) as BandMeta | undefined;
    if (meta?.vScale !== scale) return;
    for (const value of lower) {
      if (!finite(value)) continue;
      // Bounds are ordered on admission, so only the minimum can need widening.
      if (!finite(scale.options?.min) && value < scale.min) scale.min = value;
    }
  });
}

/** `beforeDatasetsDraw`: fill each visible band between its upper points and lower bounds. */
export function drawChartBands(chart: BandChart, opacity: () => number): void {
  const ctx = chart.ctx;
  if (!ctx) return;
  let alpha: number | undefined;
  chart.data.datasets.forEach((dataset, index) => {
    const lower = bandLower(dataset);
    if (!lower || !chart.isDatasetVisible(index)) return;
    const meta = chart.getDatasetMeta?.(index) as BandMeta | undefined;
    const scale = meta?.vScale;
    if (meta?.type !== 'line' || !scale || !meta.data) return;
    const vertical = scale.axis !== 'x';
    const fill = (dataset as Record<string, unknown>)['backgroundColor'];
    // One closed polygon per contiguous run of complete rows, so a gap never bridges two runs.
    const runs: { x: number; y: number; base: number }[][] = [];
    let run: { x: number; y: number; base: number }[] = [];
    meta.data.forEach((point, row) => {
      const low = lower[row];
      if (!point || point.skip || !finite(low) || !finite(point.x) || !finite(point.y)) {
        if (run.length) runs.push(run);
        run = [];
        return;
      }
      run.push({ x: point.x, y: point.y, base: scale.getPixelForValue(low) });
    });
    if (run.length) runs.push(run);
    ctx.save();
    const area = chart.chartArea;
    if (area) {
      ctx.beginPath();
      ctx.rect(area.left, area.top, area.right - area.left, area.bottom - area.top);
      ctx.clip();
    }
    ctx.globalAlpha = bandOwnOpacity(dataset) ?? (alpha ??= opacity());
    ctx.fillStyle = (fill ?? 'transparent') as string | CanvasPattern;
    for (const points of runs) {
      ctx.beginPath();
      points.forEach((point, position) => {
        if (position === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y);
      });
      for (let position = points.length - 1; position >= 0; position -= 1) {
        const point = points[position]!;
        if (vertical) ctx.lineTo(point.x, point.base); else ctx.lineTo(point.base, point.y);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  });
}
