import type * as ChartJsModule from 'chart.js';
import type ZoomPlugin from 'chartjs-plugin-zoom';

let chartJs: Promise<typeof ChartJsModule | null> | undefined;
let zoomRegistered = false;
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
  importChart: () => Promise<typeof ChartJsModule> = () => import('chart.js'),
  importZoom: () => Promise<{ default: typeof ZoomPlugin }> = () => import('chartjs-plugin-zoom'),
  needsZoom = false,
): Promise<{ mod: typeof ChartJsModule; zoomPlugin: typeof ZoomPlugin | undefined } | null> {
  let mod: typeof ChartJsModule;
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

  let zoomPlugin: typeof ZoomPlugin | undefined;
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

function registerCore(mod: typeof ChartJsModule): void {
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
export function loadChartJs(): Promise<typeof ChartJsModule | null> {
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
 */
export async function loadChartJsWithZoom(): Promise<typeof ChartJsModule | null> {
  const mod = await loadChartJs();
  if (!mod || zoomRegistered) return mod;
  const result = await loadChartAndZoom(() => Promise.resolve(mod), undefined, true);
  if (result?.zoomPlugin) {
    mod.Chart.register(result.zoomPlugin);
    zoomRegistered = true;
  }
  return mod;
}
