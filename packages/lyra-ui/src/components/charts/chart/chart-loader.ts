import {
  loadChartJs,
  loadChartModule,
  loadAndRegisterChartModule,
  type ChartJsModule,
} from './chart-core-loader.js';
import type {
  ChartFeatureLoadResult,
  ChartPluginCapability,
  DataLabelsPlugin,
  ZoomPlugin,
} from './chart-feature-loader.js';

/**
 * Backward-compatible Chart.js loader entry. Core-only consumers import
 * `chart-core-loader.ts` so optional chart features stay outside their graph.
 */
export { loadChartJs, loadChartModule, loadAndRegisterChartModule, type ChartJsModule };
export type {
  ChartFeatureLoadResult,
  ChartPluginCapability,
  DataLabelsPlugin,
  ZoomPlugin,
};

type ChartFeatureLoader = typeof import('./chart-feature-loader.js');

let chartFeatureLoader: Promise<ChartFeatureLoader> | undefined;
let zoomResultLoad: Promise<ChartFeatureLoadResult<ZoomPlugin>> | undefined;
let dataLabelsResultLoad:
  | Promise<ChartFeatureLoadResult<DataLabelsPlugin>>
  | undefined;
let zoomLoad: Promise<ChartJsModule | null> | undefined;
let dataLabelsLoad:
  | Promise<{ mod: ChartJsModule; plugin: DataLabelsPlugin | undefined } | null>
  | undefined;

function loadChartFeatureLoader(): Promise<ChartFeatureLoader> {
  return (chartFeatureLoader ??= import('./chart-feature-loader.js'));
}

/**
 * Loads Chart.js and, when requested, its optional zoom plugin. The feature
 * implementation stays lazily separated from the core-only loader graph.
 */
export function loadChartAndZoom(
  importChart?: () => Promise<unknown>,
  importZoom?: () => Promise<unknown>,
  needsZoom?: boolean,
): Promise<{ mod: ChartJsModule; zoomPlugin: ZoomPlugin | undefined } | null> {
  return loadChartFeatureLoader().then(({ loadChartAndZoom: loadFeature }) =>
    loadFeature(importChart, importZoom, needsZoom),
  );
}

/** Lazily loads Chart.js and registers the optional zoom plugin once per page. */
export function loadChartJsWithZoomResult(
  importZoom?: () => Promise<unknown>,
): Promise<ChartFeatureLoadResult<ZoomPlugin>> {
  return (zoomResultLoad ??= loadChartFeatureLoader().then(
    ({ loadChartJsWithZoomResult: loadFeature }) => loadFeature(importZoom),
  ));
}

/** Compatibility adapter retaining the established core-module return shape. */
export function loadChartJsWithZoom(
  importZoom?: () => Promise<unknown>,
): Promise<ChartJsModule | null> {
  return (zoomLoad ??= loadChartJsWithZoomResult(importZoom).then((result) =>
    result.kind === 'core-unavailable' ? null : result.mod,
  ));
}

/** Loads the optional data-labels plugin without registering it globally. */
export function loadDataLabelsPlugin(
  importDataLabels?: () => Promise<unknown>,
): Promise<DataLabelsPlugin | undefined> {
  return loadChartFeatureLoader().then(({ loadDataLabelsPlugin: loadFeature }) =>
    loadFeature(importDataLabels),
  );
}

/** Lazily loads Chart.js with its optional per-instance data-labels plugin. */
export function loadChartJsWithDataLabelsResult(
  importDataLabels?: () => Promise<unknown>,
): Promise<ChartFeatureLoadResult<DataLabelsPlugin>> {
  return (dataLabelsResultLoad ??= loadChartFeatureLoader().then(
    ({ loadChartJsWithDataLabelsResult: loadFeature }) => loadFeature(importDataLabels),
  ));
}

/** Compatibility adapter retaining the established `{ mod, plugin }` shape. */
export function loadChartJsWithDataLabels(
  importDataLabels?: () => Promise<unknown>,
): Promise<{ mod: ChartJsModule; plugin: DataLabelsPlugin | undefined } | null> {
  return (dataLabelsLoad ??= loadChartJsWithDataLabelsResult(importDataLabels).then((result) => {
    if (result.kind === 'core-unavailable') return null;
    return {
      mod: result.mod,
      plugin: result.kind === 'available' ? result.plugin : undefined,
    };
  }));
}
