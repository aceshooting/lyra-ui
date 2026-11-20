import { isObjectLike } from '../../../internal/object-guards.js';
import { warnChartPeer, warnChartPeerImport } from './chart-peer.js';
import { resolveOptionalPeerCapability } from '../../../internal/optional-peer-capabilities.js';
import {
  loadChartJs,
  loadChartModule,
  type ChartJsModule,
} from './chart-core-loader.js';
import { notifyAnnotationPluginRegistered } from '../../../internal/chart-annotation-registration.js';

/** Peer-neutral Chart.js plugin capability used for registration and per-chart configuration. */
export interface ChartPluginCapability {
  id: string;
  [key: string]: unknown;
}

export type ZoomPlugin = ChartPluginCapability;
export type DataLabelsPlugin = ChartPluginCapability;
export type AnnotationPlugin = ChartPluginCapability;

/**
 * The outcome of loading an opt-in Chart.js feature after attempting to load
 * the core module. Callers can distinguish an unavailable core from an
 * unavailable feature without throwing away a usable Chart.js module.
 */
export type ChartFeatureLoadResult<Plugin extends ChartPluginCapability> =
  | { kind: 'core-unavailable' }
  | { kind: 'available'; mod: ChartJsModule; plugin: Plugin }
  | { kind: 'feature-unavailable'; mod: ChartJsModule };

function isChartPlugin(candidate: unknown): candidate is ChartPluginCapability {
  return (
    isObjectLike(candidate) &&
    'id' in candidate &&
    typeof candidate['id'] === 'string' &&
    candidate['id'].trim().length > 0
  );
}

function resolveChartPlugin(value: unknown, packageName: string): ChartPluginCapability {
  const plugin = resolveOptionalPeerCapability(value, isChartPlugin);
  if (plugin) return plugin;
  throw new Error(
    `Invalid optional peer \`${packageName}\`: expected a plugin with a non-empty string \`id\`.`,
  );
}

type ImportPeer = () => Promise<unknown>;

function cachedFeature(
  load: (core: typeof loadChartJs, importer: ImportPeer) => Promise<ChartFeatureLoadResult<ChartPluginCapability>>,
  defaultImport: ImportPeer,
): (importer?: ImportPeer) => Promise<ChartFeatureLoadResult<ChartPluginCapability>> {
  let shared: Promise<ChartFeatureLoadResult<ChartPluginCapability>> | undefined;
  return (importer = defaultImport) => {
    if (shared) return shared;
    let rejected = false;
    shared = load(loadChartJs, async () => {
      try { return await importer(); }
      catch (error) { rejected = true; throw error; }
    }).then(result => {
      if (rejected || result.kind === 'core-unavailable') shared = undefined;
      return result;
    });
    return shared;
  };
}

async function loadPlugin(importer: ImportPeer, name: string): Promise<ChartPluginCapability | undefined> {
  let module: unknown;
  try { module = await importer(); }
  catch (error) { warnChartPeerImport(name, error); return undefined; }
  try { return resolveChartPlugin(module, name); }
  catch (error) { warnChartPeer(`plugin:${name}`, `<lr-chart> incompatible ${name} plugin.`, error); return undefined; }
}

export async function loadChartAndZoom(
  importChart: () => Promise<unknown> = () => import('chart.js'),
  importZoom: () => Promise<unknown> = () => import('chartjs-plugin-zoom'),
  needsZoom = false,
): Promise<{ mod: ChartJsModule; zoomPlugin: ZoomPlugin | undefined } | null> {
  const mod = await loadChartModule(importChart);
  if (!mod) return null;

  if (!needsZoom) return { mod, zoomPlugin: undefined };

  const zoomPlugin = await loadPlugin(importZoom, 'chartjs-plugin-zoom');
  return { mod, zoomPlugin };
}

function createPluginLoader(
  name: string,
  importer: ImportPeer,
  registration?: (mod: ChartJsModule, plugin: ChartPluginCapability) => void,
) {
  const plugin = (load = importer) => loadPlugin(load, name);
  const withCore = async (
    loadCore: typeof loadChartJs,
    loadFeature = importer,
  ): Promise<ChartFeatureLoadResult<ChartPluginCapability>> => {
    const mod = await loadCore();
    if (!mod) return { kind: 'core-unavailable' };
    const capability = await plugin(loadFeature);
    if (!capability) return { kind: 'feature-unavailable', mod };
    try {
      registration?.(mod, capability);
      return { kind: 'available', mod, plugin: capability };
    } catch (error) {
      warnChartPeer(`register:${name}`, `<lr-chart> could not register ${name}.`, error);
      return { kind: 'feature-unavailable', mod };
    }
  };
  return { plugin, withCore, cached: cachedFeature(withCore, importer) };
}

const zoom = createPluginLoader('chartjs-plugin-zoom', () => import('chartjs-plugin-zoom'),
  (mod, plugin) => mod.Chart.register(plugin));
const dataLabels = createPluginLoader('chartjs-plugin-datalabels', () => import('chartjs-plugin-datalabels'));
const annotation = createPluginLoader('chartjs-plugin-annotation', () => import('chartjs-plugin-annotation'), (mod, plugin) => {
  mod.Chart.register(plugin);
  notifyAnnotationPluginRegistered();
});

export function loadChartAndRegisterZoom(
  loadChart: () => Promise<ChartJsModule | null>,
  importZoom?: () => Promise<unknown>,
): Promise<ChartFeatureLoadResult<ZoomPlugin>> {
  return zoom.withCore(loadChart, importZoom);
}

export function loadChartJsWithZoomResult(
  importZoom?: () => Promise<unknown>,
): Promise<ChartFeatureLoadResult<ZoomPlugin>> {
  return zoom.cached(importZoom);
}

export function loadDataLabelsPlugin(
  importDataLabels?: () => Promise<unknown>,
): Promise<DataLabelsPlugin | undefined> {
  return dataLabels.plugin(importDataLabels);
}

export function loadChartAndDataLabels(
  loadChart: () => Promise<ChartJsModule | null>,
  importDataLabels?: () => Promise<unknown>,
): Promise<ChartFeatureLoadResult<DataLabelsPlugin>> {
  return dataLabels.withCore(loadChart, importDataLabels);
}

export function loadChartJsWithDataLabelsResult(
  importDataLabels?: () => Promise<unknown>,
): Promise<ChartFeatureLoadResult<DataLabelsPlugin>> {
  return dataLabels.cached(importDataLabels);
}

export function loadAnnotationPlugin(
  importAnnotation?: () => Promise<unknown>,
): Promise<AnnotationPlugin | undefined> {
  return annotation.plugin(importAnnotation);
}

export function loadChartAndAnnotation(
  loadChart: () => Promise<ChartJsModule | null>,
  importAnnotation?: () => Promise<unknown>,
): Promise<ChartFeatureLoadResult<AnnotationPlugin>> {
  return annotation.withCore(loadChart, importAnnotation);
}

export function loadChartJsWithAnnotationResult(
  importAnnotation?: () => Promise<unknown>,
): Promise<ChartFeatureLoadResult<AnnotationPlugin>> {
  return annotation.cached(importAnnotation);
}

function projectCachedFeature<Result>(
  load: (importer?: ImportPeer) => Promise<ChartFeatureLoadResult<ChartPluginCapability>>,
  project: (result: ChartFeatureLoadResult<ChartPluginCapability>) => Result,
): (importer?: ImportPeer) => Promise<Result> {
  let projection: { source: Promise<ChartFeatureLoadResult<ChartPluginCapability>>; value: Promise<Result> } | undefined;
  return (importer) => {
    const source = load(importer);
    if (projection?.source !== source) projection = { source, value: source.then(project) };
    return projection.value;
  };
}

const chartWithZoom = projectCachedFeature(loadChartJsWithZoomResult, (result) =>
  result.kind === 'core-unavailable' ? null : result.mod,
);
const chartWithDataLabels = projectCachedFeature(loadChartJsWithDataLabelsResult, (result) =>
  result.kind === 'core-unavailable' ? null : {
    mod: result.mod,
    plugin: result.kind === 'available' ? result.plugin : undefined,
  },
);

/** Returns the usable core module even when the optional zoom plugin is unavailable. */
export function loadChartJsWithZoom(importZoom?: () => Promise<unknown>): Promise<ChartJsModule | null> {
  return chartWithZoom(importZoom);
}

/** Returns the per-chart data-labels plugin alongside the core module when available. */
export function loadChartJsWithDataLabels(
  importDataLabels?: () => Promise<unknown>,
): Promise<{ mod: ChartJsModule; plugin: DataLabelsPlugin | undefined } | null> {
  return chartWithDataLabels(importDataLabels);
}
