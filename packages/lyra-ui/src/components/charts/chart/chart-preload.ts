import { loadChartJs } from './chart-core-loader.js';
import {
  loadChartJsWithAnnotationResult,
  loadChartJsWithDataLabelsResult,
  loadChartJsWithZoomResult,
} from './chart-feature-loader.js';

export interface LyraChartPreloadOptions {
  readonly zoom?: boolean;
  readonly dataLabels?: boolean;
  readonly annotations?: boolean;
  readonly boxPlot?: boolean;
}

export interface LyraChartPreloadResult {
  readonly core: boolean;
  readonly zoom?: boolean;
  readonly dataLabels?: boolean;
  readonly annotations?: boolean;
  readonly boxPlot?: boolean;
}

async function preloadBoxPlot(): Promise<boolean> {
  const { loadBoxPlotPlugin } = await import('./box-plot-loader.js');
  return (await loadBoxPlotPlugin()) !== null;
}

/**
 * Preloads the chart peer capabilities a route is about to use. Core Chart.js is always loaded;
 * optional feature peers are requested only when their corresponding flag is true. Every loader
 * remains page-memoized, so calling this before multiple charts does not duplicate imports.
 */
export async function preloadCharts(
  options: LyraChartPreloadOptions = {},
): Promise<LyraChartPreloadResult> {
  const [core, zoom, dataLabels, annotations, boxPlot] = await Promise.all([
    loadChartJs(),
    options.zoom ? loadChartJsWithZoomResult() : undefined,
    options.dataLabels ? loadChartJsWithDataLabelsResult() : undefined,
    options.annotations ? loadChartJsWithAnnotationResult() : undefined,
    options.boxPlot
      ? preloadBoxPlot()
      : undefined,
  ]);
  return {
    core: core !== null,
    ...(options.zoom ? { zoom: zoom?.kind === 'available' } : {}),
    ...(options.dataLabels ? { dataLabels: dataLabels?.kind === 'available' } : {}),
    ...(options.annotations ? { annotations: annotations?.kind === 'available' } : {}),
    ...(options.boxPlot ? { boxPlot } : {}),
  };
}
