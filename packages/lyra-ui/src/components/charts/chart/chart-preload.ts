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

let boxPlotPreload: Promise<boolean> | undefined;

async function preloadBoxPlot(): Promise<boolean> {
  const { loadBoxPlotAndRegister } = await import('./box-plot.class.js');
  return (await loadBoxPlotAndRegister()) !== null;
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
      ? (boxPlotPreload ??= preloadBoxPlot())
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
