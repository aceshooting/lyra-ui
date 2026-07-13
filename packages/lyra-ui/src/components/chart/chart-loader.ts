import type { OptionalPeerApi } from '../../internal/optional-peer-types.js';

type ChartJsModule = OptionalPeerApi;
type ZoomPlugin = OptionalPeerApi;

let chartJs: Promise<ChartJsModule | null> | undefined;
let zoomLoad: Promise<ChartJsModule | null> | undefined;
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
  importChart: () => Promise<ChartJsModule> = () => import('chart.js') as Promise<ChartJsModule>,
  importZoom: () => Promise<{ default: ZoomPlugin }> = () =>
    import('chartjs-plugin-zoom') as Promise<{ default: ZoomPlugin }>,
  needsZoom = false,
): Promise<{ mod: ChartJsModule; zoomPlugin: ZoomPlugin | undefined } | null> {
  let mod: ChartJsModule;
  try {
    mod = await importChart();
  } catch (err) {
    console.warn(
      '<lyra-chart> needs the optional peer dependency `chart.js` — install it with `pnpm add chart.js`:',
      err,
    );
    return null;
  }

  if (!needsZoom) return { mod, zoomPlugin: undefined };

  let zoomPlugin: ZoomPlugin | undefined;
  try {
    zoomPlugin = (await importZoom()).default;
  } catch (err) {
    console.warn(
      '<lyra-chart> zoom support needs the optional peer dependency `chartjs-plugin-zoom` — ' +
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
 * close together (e.g. two `<lyra-chart zoom>` elements connecting around
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
  importZoom: () => Promise<{ default: ZoomPlugin }> = () =>
    import('chartjs-plugin-zoom') as Promise<{ default: ZoomPlugin }>,
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
