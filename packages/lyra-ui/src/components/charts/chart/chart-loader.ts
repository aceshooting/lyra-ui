/**
 * Backward-compatible Chart.js loader entry. Core-only consumers import
 * `chart-core-loader.ts` so optional chart features stay outside their graph.
 */
export {
  loadChartJs,
  loadChartModule,
  type ChartJsModule,
} from './chart-core-loader.js';
export {
  loadChartAndZoom,
  loadChartJsWithZoom,
  loadChartJsWithDataLabels,
  loadDataLabelsPlugin,
  type ChartPluginCapability,
  type DataLabelsPlugin,
  type ZoomPlugin,
} from './chart-feature-loader.js';
