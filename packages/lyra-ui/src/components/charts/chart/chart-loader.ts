import {
  loadChartJs,
  loadChartModule,
  type ChartJsModule,
} from './chart-core-loader.js';
import type {
  ChartPluginCapability,
  DataLabelsPlugin,
  ZoomPlugin,
} from './chart-feature-loader.js';

/**
 * Backward-compatible Chart.js loader entry. Core-only consumers import
 * `chart-core-loader.ts` so optional chart features stay outside their graph.
 */
export { loadChartJs, loadChartModule, type ChartJsModule };
export type { ChartPluginCapability, DataLabelsPlugin, ZoomPlugin };

type ChartFeatureLoader = typeof import('./chart-feature-loader.js');

let chartFeatureLoader: Promise<ChartFeatureLoader> | undefined;
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
export function loadChartJsWithZoom(
  importZoom?: () => Promise<unknown>,
): Promise<ChartJsModule | null> {
  return (zoomLoad ??= loadChartFeatureLoader().then(({ loadChartJsWithZoom: loadFeature }) =>
    loadFeature(importZoom),
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
export function loadChartJsWithDataLabels(
  importDataLabels?: () => Promise<unknown>,
): Promise<{ mod: ChartJsModule; plugin: DataLabelsPlugin | undefined } | null> {
  return (dataLabelsLoad ??= loadChartFeatureLoader().then(
    ({ loadChartJsWithDataLabels: loadFeature }) => loadFeature(importDataLabels),
  ));
}
