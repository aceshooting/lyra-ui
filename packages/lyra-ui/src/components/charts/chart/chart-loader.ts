import {
  resolveOptionalPeerCapability,
  unwrapOptionalPeerDefault,
} from '../../../internal/optional-peer-capabilities.js';

/** Peer-neutral Chart.js plugin capability used for registration and per-chart configuration. */
export interface ChartPluginCapability {
  id: string;
  [key: string]: unknown;
}

interface ChartConstructorCapability {
  new (item: HTMLCanvasElement, configuration: unknown): object;
  register(...items: unknown[]): void;
}

/** The Chart.js module capabilities Lyra uses, kept structural so optional peers do not leak. */
export interface ChartJsModule {
  Chart: ChartConstructorCapability;
  defaults: {
    plugins?: {
      legend?: {
        labels?: {
          generateLabels?: (chart: object) => unknown[];
        };
      };
    };
  };
  LineController: unknown;
  BarController: unknown;
  ScatterController: unknown;
  DoughnutController: unknown;
  PieController: unknown;
  RadarController: unknown;
  PolarAreaController: unknown;
  BubbleController: unknown;
  LineElement: unknown;
  PointElement: unknown;
  BarElement: unknown;
  ArcElement: unknown;
  LinearScale: unknown;
  CategoryScale: unknown;
  RadialLinearScale: unknown;
  Filler: unknown;
  Tooltip: unknown;
  Legend: unknown;
}

export type ZoomPlugin = ChartPluginCapability;
export type DataLabelsPlugin = ChartPluginCapability;

const CHART_REGISTERABLE_KEYS = [
  'LineController',
  'BarController',
  'ScatterController',
  'DoughnutController',
  'PieController',
  'RadarController',
  'PolarAreaController',
  'BubbleController',
  'LineElement',
  'PointElement',
  'BarElement',
  'ArcElement',
  'LinearScale',
  'CategoryScale',
  'RadialLinearScale',
  'Filler',
  'Tooltip',
  'Legend',
] as const satisfies readonly (keyof ChartJsModule)[];

function isObjectLike(value: unknown): value is Record<PropertyKey, unknown> {
  return (typeof value === 'object' || typeof value === 'function') && value !== null;
}

function isConstructor(value: unknown): value is new (...args: never[]) => object {
  if (typeof value !== 'function') return false;
  try {
    Reflect.construct(Object, [], value);
    return true;
  } catch {
    return false;
  }
}

function missingChartCapability(candidate: unknown): string | undefined {
  if (!isObjectLike(candidate)) return 'module namespace';
  if (!isConstructor(candidate['Chart'])) return 'Chart';
  if (typeof (candidate['Chart'] as unknown as { register?: unknown }).register !== 'function') {
    return 'Chart.register';
  }
  if (!isObjectLike(candidate['defaults'])) return 'defaults';
  for (const key of CHART_REGISTERABLE_KEYS) {
    if (!isObjectLike(candidate[key])) return key;
  }
  return undefined;
}

function isChartJsModule(candidate: unknown): candidate is ChartJsModule {
  return missingChartCapability(candidate) === undefined;
}

function resolveChartJsModule(value: unknown): ChartJsModule {
  const module = resolveOptionalPeerCapability(value, isChartJsModule);
  if (module) return module;
  const candidate = unwrapOptionalPeerDefault(value);
  const missing = missingChartCapability(candidate) ?? 'module namespace';
  throw new Error(
    `Invalid optional peer \`chart.js\`: missing or invalid \`${missing}\` capability.`,
  );
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

let chartJs: Promise<ChartJsModule | null> | undefined;
let zoomLoad: Promise<ChartJsModule | null> | undefined;
let dataLabelsLoad:
  | Promise<{ mod: ChartJsModule; plugin: DataLabelsPlugin | undefined } | null>
  | undefined;
let registered = false;

/**
 * Independently loads the mandatory `chart.js` peer dependency and, only
 * when `needsZoom` is true, the opt-in `chartjs-plugin-zoom` peer dependency
 * — so a partial install (`chart.js` only, which `peerDependenciesMeta`
 * marks as a valid combination) degrades to "charts render, zoom is inert"
 * instead of every chart breaking. `needsZoom` defaults to `false` because
 * most charts never set `zoom`, and `chartjs-plugin-zoom` has a hard
 * dependency on `hammerjs` — no point paying that import cost for every
 * chart on the page. Exported (in addition to `loadChartJs()`/
 * `loadChartJsWithZoom()` below) so both failure paths — and the real caught
 * error each one logs — are directly testable without needing to actually
 * uninstall either package.
 */
export async function loadChartAndZoom(
  importChart: () => Promise<unknown> = () => import('chart.js'),
  importZoom: () => Promise<unknown> = () => import('chartjs-plugin-zoom'),
  needsZoom = false,
): Promise<{ mod: ChartJsModule; zoomPlugin: ZoomPlugin | undefined } | null> {
  let mod: ChartJsModule;
  try {
    mod = resolveChartJsModule(await importChart());
  } catch (err) {
    console.warn(
      '<lr-chart> needs the optional peer dependency `chart.js` — install it with `pnpm add chart.js`:',
      err,
    );
    return null;
  }

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

function registerCore(mod: ChartJsModule): void {
  if (registered) return;
  mod.Chart.register(
    mod.LineController,
    mod.BarController,
    mod.ScatterController,
    mod.DoughnutController,
    mod.PieController,
    mod.RadarController,
    mod.PolarAreaController,
    mod.BubbleController,
    mod.LineElement,
    mod.PointElement,
    mod.BarElement,
    mod.ArcElement,
    mod.LinearScale,
    mod.CategoryScale,
    mod.RadialLinearScale,
    mod.Filler,
    mod.Tooltip,
    mod.Legend,
  );
  registered = true;
}

/**
 * Lazily loads the optional peer dependency `chart.js` once per page,
 * registering only the tree-shaken subset this library uses.
 * `chartjs-plugin-zoom` is *not* loaded here — see `loadChartJsWithZoom()`
 * below, which any chart that actually sets `zoom` should call instead.
 * Resolves to `null` if chart.js isn't installed.
 */
export function loadChartJs(): Promise<ChartJsModule | null> {
  if (!chartJs) {
    chartJs = loadChartAndZoom().then((result) => {
      if (!result) return null;
      registerCore(result.mod);
      return result.mod;
    });
  }
  return chartJs;
}

/**
 * Loads `chart.js` (reusing the cached load above) plus `chartjs-plugin-zoom`,
 * on first actual demand — most charts never set `zoom`, and the plugin has
 * a hard dependency on `hammerjs`. Registers the plugin at most once across
 * the page. Call this instead of `loadChartJs()` from any chart that has
 * `zoom` set (at connect time, or later once `zoom` turns on).
 *
 * The whole operation (chart.js core + the zoom plugin import + its
 * registration) is memoized behind a single `zoomLoad` promise, assigned
 * synchronously before any `await` — mirroring `loadChartJs()`'s own
 * `chartJs` memoization above. A plain boolean "already registered" guard
 * checked before an `await` and only set after would leave a check-then-act
 * race across that `await` boundary: two callers racing to turn `zoom` on
 * close together (e.g. two `<lr-chart zoom>` elements connecting around
 * the same time) could both pass the check before either sets the flag,
 * each independently re-importing the plugin and calling
 * `mod.Chart.register()`. A single promise assigned up front closes that
 * window — the second caller synchronously observes `zoomLoad` already set
 * and awaits the same in-flight load instead of starting its own.
 *
 * `importZoom` defaults to the real dynamic import; it's a parameter purely
 * so tests can instrument/count the underlying import without needing to
 * actually uninstall the package.
 */
export function loadChartJsWithZoom(
  importZoom: () => Promise<unknown> = () => import('chartjs-plugin-zoom'),
): Promise<ChartJsModule | null> {
  if (!zoomLoad) {
    zoomLoad = loadChartJs().then(async (mod) => {
      if (!mod) return null;
      const result = await loadChartAndZoom(() => Promise.resolve(mod), importZoom, true);
      if (result?.zoomPlugin) {
        mod.Chart.register(result.zoomPlugin);
      }
      return mod;
    });
  }
  return zoomLoad;
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
 * Loads `chart.js` (reusing the cached load) plus the `chartjs-plugin-datalabels`
 * plugin object, on first actual demand — most charts never set `data-labels`.
 * Returns `{ mod, plugin }` (or `null` if chart.js itself is absent; `plugin` is
 * `undefined` if only the data-labels peer is missing). The plugin is
 * **deliberately NOT registered globally** — unlike `chartjs-plugin-zoom` (inert
 * until given options), `chartjs-plugin-datalabels` draws on every dataset the
 * moment it is globally registered and, worse, breaks any chart constructed
 * before that global registration on its next update. So `chart.class.ts`
 * registers the returned `plugin` PER-INSTANCE via the chart's own
 * `config.plugins` array, touching only charts that set `data-labels`/
 * `stack-totals`. The load is memoized behind a single `dataLabelsLoad` promise
 * assigned synchronously before any `await` — closing the same check-then-act
 * race across the `await` boundary that `loadChartJsWithZoom()`'s doc describes.
 *
 * `importDataLabels` defaults to the real dynamic import; it's a parameter
 * purely so tests can instrument/count the underlying import.
 */
export function loadChartJsWithDataLabels(
  importDataLabels: () => Promise<unknown> = () => import('chartjs-plugin-datalabels'),
): Promise<{ mod: ChartJsModule; plugin: DataLabelsPlugin | undefined } | null> {
  if (!dataLabelsLoad) {
    dataLabelsLoad = loadChartJs().then(async (mod) => {
      if (!mod) return null;
      const plugin = await loadDataLabelsPlugin(importDataLabels);
      return { mod, plugin };
    });
  }
  return dataLabelsLoad;
}
