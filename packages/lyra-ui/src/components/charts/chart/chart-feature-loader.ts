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

function isObjectLike(value: unknown): value is Record<PropertyKey, unknown> {
  return (typeof value === 'object' || typeof value === 'function') && value !== null;
}

function isChartPlugin(candidate: unknown): candidate is ChartPluginCapability {
  return (
    isObjectLike(candidate) &&
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

let zoomResultLoad: Promise<ChartFeatureLoadResult<ZoomPlugin>> | undefined;
let dataLabelsResultLoad:
  | Promise<ChartFeatureLoadResult<DataLabelsPlugin>>
  | undefined;
let annotationResultLoad:
  | Promise<ChartFeatureLoadResult<AnnotationPlugin>>
  | undefined;
let zoomLoad: Promise<ChartJsModule | null> | undefined;
let dataLabelsLoad:
  | Promise<{ mod: ChartJsModule; plugin: DataLabelsPlugin | undefined } | null>
  | undefined;

/**
 * Independently loads the mandatory `chart.js` peer dependency and, only
 * when `needsZoom` is true, the opt-in `chartjs-plugin-zoom` peer dependency
 * — so a partial install (`chart.js` only, which `peerDependenciesMeta`
 * marks as a valid combination) degrades to "charts render, zoom is inert"
 * instead of every chart breaking. Exported (in addition to `loadChartJs()`/
 * `loadChartJsWithZoom()` below) so both failure paths — and the real caught
 * error each one logs — are directly testable without needing to actually
 * uninstall either package.
 */
export async function loadChartAndZoom(
  importChart: () => Promise<unknown> = () => import('chart.js'),
  importZoom: () => Promise<unknown> = () => import('chartjs-plugin-zoom'),
  needsZoom = false,
): Promise<{ mod: ChartJsModule; zoomPlugin: ZoomPlugin | undefined } | null> {
  const mod = await loadChartModule(importChart);
  if (!mod) return null;

  if (!needsZoom) return { mod, zoomPlugin: undefined };

  let zoomPlugin: ZoomPlugin | undefined;
  try {
    // Prefer a capability-bearing namespace, then its validated default export. The plugin ships
    // its registerable object as the ES-module default, while some CJS interop configurations
    // expose the object directly; validating the non-empty `id` prevents either malformed shape
    // from reaching Chart.register().
    zoomPlugin = resolveChartPlugin(await importZoom(), 'chartjs-plugin-zoom');
  } catch (err) {
    console.warn(
      '<lr-chart> zoom support needs the optional peer dependency `chartjs-plugin-zoom` — ' +
        'charts still render without it, but the `zoom` attribute has no effect until it is ' +
        'installed with `pnpm add chartjs-plugin-zoom`:',
      err,
    );
  }
  return { mod, zoomPlugin };
}

/**
 * Loads Chart.js and attempts to register its zoom plugin. Unlike
 * `loadChartAndZoom()`, this reports plugin registration failures as a tagged
 * result so a caller can preserve the usable core chart while surfacing an
 * opt-in feature warning.
 *
 * Un-memoized to keep the registration-failure path directly testable; callers
 * that need the page-wide memoized load use `loadChartJsWithZoomResult()`.
 */
export async function loadChartAndRegisterZoom(
  loadChart: () => Promise<ChartJsModule | null>,
  importZoom: () => Promise<unknown> = () => import('chartjs-plugin-zoom'),
): Promise<ChartFeatureLoadResult<ZoomPlugin>> {
  const mod = await loadChart();
  if (!mod) return { kind: 'core-unavailable' };

  const zoomPlugin = (
    await loadChartAndZoom(() => Promise.resolve(mod), importZoom, true)
  )?.zoomPlugin;
  if (!zoomPlugin) return { kind: 'feature-unavailable', mod };

  try {
    mod.Chart.register(zoomPlugin);
  } catch (err) {
    console.warn(
      '<lr-chart> zoom support could not be enabled — charts still render without it, but the ' +
        '`zoom` attribute has no effect:',
      err,
    );
    return { kind: 'feature-unavailable', mod };
  }

  return { kind: 'available', mod, plugin: zoomPlugin };
}

/**
 * Loads `chart.js` (reusing the cached core load) plus `chartjs-plugin-zoom`,
 * on first actual demand — most charts never set `zoom`, and the plugin has
 * a hard dependency on `hammerjs`. Registers the plugin at most once across
 * the page. Call this instead of `loadChartJs()` from any chart that has
 * `zoom` set (at connect time, or later once `zoom` turns on).
 *
 * The whole operation (chart.js core + the zoom plugin import + its
 * registration) is memoized behind a single `zoomResultLoad` promise, assigned
 * synchronously before any `await` — mirroring `loadChartJs()`'s own
 * `chartJs` memoization above. A plain boolean "already registered" guard
 * checked before an `await` and only set after would leave a check-then-act
 * race across that `await` boundary: two callers racing to turn `zoom` on
 * close together (e.g. two `<lr-chart zoom>` elements connecting around
 * the same time) could both pass the check before either sets the flag,
 * each independently re-importing the plugin and calling
 * `mod.Chart.register()`. A single promise assigned up front closes that
 * window — the second caller synchronously observes `zoomResultLoad` already set
 * and awaits the same in-flight load instead of starting its own.
 *
 * `importZoom` defaults to the real dynamic import; it's a parameter purely
 * so tests can instrument/count the underlying import without needing to
 * actually uninstall the package.
 */
export function loadChartJsWithZoomResult(
  importZoom: () => Promise<unknown> = () => import('chartjs-plugin-zoom'),
): Promise<ChartFeatureLoadResult<ZoomPlugin>> {
  return (zoomResultLoad ??= loadChartAndRegisterZoom(loadChartJs, importZoom));
}

/**
 * Compatibility adapter for callers that only need a usable Chart.js module.
 * Feature-unavailable results intentionally still resolve to that module.
 */
export function loadChartJsWithZoom(
  importZoom: () => Promise<unknown> = () => import('chartjs-plugin-zoom'),
): Promise<ChartJsModule | null> {
  return (zoomLoad ??= loadChartJsWithZoomResult(importZoom).then((result) =>
    result.kind === 'core-unavailable' ? null : result.mod,
  ));
}

/**
 * Imports the optional `chartjs-plugin-datalabels` peer and returns the plugin
 * object, or `undefined` if the peer isn't installed (charts still render;
 * data labels are simply inert). Prefers a capability-bearing namespace, then
 * its validated default export, because registering either a wrapper namespace
 * or a malformed object would silently no-op. Un-memoized (unlike
 * `loadChartJsWithDataLabels()` below) so both the success and the
 * degrade-with-a-warning failure paths are directly testable without needing
 * to actually uninstall the package. `importDataLabels` defaults to the real
 * dynamic import; it's a parameter purely so tests can instrument it.
 */
export async function loadDataLabelsPlugin(
  importDataLabels: () => Promise<unknown> = () => import('chartjs-plugin-datalabels'),
): Promise<DataLabelsPlugin | undefined> {
  try {
    return resolveChartPlugin(
      await importDataLabels(),
      'chartjs-plugin-datalabels',
    );
  } catch (err) {
    console.warn(
      '<lr-chart> data labels need the optional peer dependency `chartjs-plugin-datalabels` — ' +
        'charts still render without it, but the `data-labels`/`stack-totals` attributes have no ' +
        'effect until it is installed with `pnpm add chartjs-plugin-datalabels`:',
      err,
    );
    return undefined;
  }
}

/**
 * Loads Chart.js with its optional per-instance data-labels plugin and
 * preserves a loaded core module when the feature peer is unavailable.
 * Stack totals use this same plugin, so they share the same tagged state.
 * Un-memoized for direct failure-path tests; use
 * `loadChartJsWithDataLabelsResult()` for the page-wide cached load.
 */
export async function loadChartAndDataLabels(
  loadChart: () => Promise<ChartJsModule | null>,
  importDataLabels: () => Promise<unknown> = () => import('chartjs-plugin-datalabels'),
): Promise<ChartFeatureLoadResult<DataLabelsPlugin>> {
  const mod = await loadChart();
  if (!mod) return { kind: 'core-unavailable' };

  const plugin = await loadDataLabelsPlugin(importDataLabels);
  return plugin
    ? { kind: 'available', mod, plugin }
    : { kind: 'feature-unavailable', mod };
}

/**
 * Loads `chart.js` (reusing the cached core load) plus the `chartjs-plugin-datalabels`
 * plugin object, on first actual demand — most charts never set `data-labels`.
 * Returns a tagged result (or `core-unavailable` if chart.js itself is absent).
 * The plugin is
 * **deliberately NOT registered globally** — unlike `chartjs-plugin-zoom` (inert
 * until given options), `chartjs-plugin-datalabels` draws on every dataset the
 * moment it is globally registered and, worse, breaks any chart constructed
 * before that global registration on its next update. So `chart.class.ts`
 * registers an available returned `plugin` PER-INSTANCE via the chart's own
 * `config.plugins` array, touching only charts that set `data-labels`/
 * `stack-totals`. The load is memoized behind a single `dataLabelsResultLoad` promise
 * assigned synchronously before any `await` — closing the same check-then-act
 * race across the `await` boundary that `loadChartJsWithZoomResult()`'s doc describes.
 *
 * `importDataLabels` defaults to the real dynamic import; it's a parameter
 * purely so tests can instrument/count the underlying import.
 */
export function loadChartJsWithDataLabelsResult(
  importDataLabels: () => Promise<unknown> = () => import('chartjs-plugin-datalabels'),
): Promise<ChartFeatureLoadResult<DataLabelsPlugin>> {
  return (dataLabelsResultLoad ??= loadChartAndDataLabels(loadChartJs, importDataLabels));
}

/**
 * Compatibility adapter retaining the established `{ mod, plugin }` shape.
 * A missing feature peer remains represented by `plugin: undefined`.
 */
export function loadChartJsWithDataLabels(
  importDataLabels: () => Promise<unknown> = () => import('chartjs-plugin-datalabels'),
): Promise<{ mod: ChartJsModule; plugin: DataLabelsPlugin | undefined } | null> {
  return (dataLabelsLoad ??= loadChartJsWithDataLabelsResult(importDataLabels).then((result) => {
    if (result.kind === 'core-unavailable') return null;
    return {
      mod: result.mod,
      plugin: result.kind === 'available' ? result.plugin : undefined,
    };
  }));
}


/**
 * Loads `chartjs-plugin-annotation`, validating that the module really exposes a Chart.js plugin
 * before it is handed to a chart — registering a wrapper namespace or a malformed object would
 * silently no-op, which is the failure mode `resolveChartPlugin` exists to prevent. Un-memoized so
 * both the success and the degrade-with-a-warning paths stay directly testable.
 */
export async function loadAnnotationPlugin(
  importAnnotation: () => Promise<unknown> = () => import('chartjs-plugin-annotation'),
): Promise<AnnotationPlugin | undefined> {
  try {
    return resolveChartPlugin(await importAnnotation(), 'chartjs-plugin-annotation');
  } catch (err) {
    console.warn(
      '<lr-chart> annotations need the optional peer dependency `chartjs-plugin-annotation` — ' +
        'charts still render without it, but the `annotations` property has no effect until it is ' +
        'installed with `pnpm add chartjs-plugin-annotation`:',
      err,
    );
    return undefined;
  }
}

/**
 * Loads Chart.js plus the annotation plugin and **registers it globally**, preserving a usable core
 * when the feature peer is absent. Un-memoized twin of `loadChartJsWithAnnotationResult()`, for
 * failure-path tests.
 *
 * Global registration here, per-instance for `chartjs-plugin-datalabels`, and the difference is not
 * arbitrary. Datalabels draws on every dataset the moment it is globally registered, so registering
 * it globally would visibly change every other chart on the page. `chartjs-plugin-annotation` is
 * the `chartjs-plugin-zoom` shape instead: it draws nothing at all unless a chart supplies
 * `options.plugins.annotation.annotations`, so a global registration is unobservable to a chart
 * that sets none. It also has to be global -- registration is what installs the plugin's own
 * element types and their defaults, and an inline `config.plugins` entry skips that, leaving the
 * plugin to throw on missing `borderWidth`/`borderCapStyle` defaults the moment it draws.
 */
export async function loadChartAndAnnotation(
  loadChart: () => Promise<ChartJsModule | null>,
  importAnnotation: () => Promise<unknown> = () => import('chartjs-plugin-annotation'),
): Promise<ChartFeatureLoadResult<AnnotationPlugin>> {
  const mod = await loadChart();
  if (!mod) return { kind: 'core-unavailable' };
  const plugin = await loadAnnotationPlugin(importAnnotation);
  if (!plugin) return { kind: 'feature-unavailable', mod };

  try {
    mod.Chart.register(plugin);
  } catch (err) {
    console.warn(
      '<lr-chart> annotations could not be enabled — charts still render without them, but the ' +
        '`annotations` property has no effect:',
      err,
    );
    return { kind: 'feature-unavailable', mod };
  }

  // Charts constructed before this registration carry no plugin state; let every live host
  // rebuild before the plugin's next hook runs against them.
  notifyAnnotationPluginRegistered();
  return { kind: 'available', mod, plugin };
}

/**
 * Loads `chart.js` (reusing the cached core load) plus `chartjs-plugin-annotation`, on first actual
 * demand — most charts set no annotations.
 *
 * Registered globally, like `chartjs-plugin-zoom` and unlike `chartjs-plugin-datalabels` — see
 * `loadChartAndAnnotation()` for why the two differ. The load itself still happens only on first
 * actual demand, so a page whose charts set no annotations never downloads the peer at all.
 *
 * Memoized behind a single promise assigned synchronously before any `await`, closing the
 * check-then-act race across the `await` boundary that the zoom loader's doc describes.
 */
export function loadChartJsWithAnnotationResult(
  importAnnotation: () => Promise<unknown> = () => import('chartjs-plugin-annotation'),
): Promise<ChartFeatureLoadResult<AnnotationPlugin>> {
  return (annotationResultLoad ??= loadChartAndAnnotation(loadChartJs, importAnnotation));
}
