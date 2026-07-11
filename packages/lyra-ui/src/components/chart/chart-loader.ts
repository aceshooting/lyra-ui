import type * as ChartJsModule from 'chart.js';
import type ZoomPlugin from 'chartjs-plugin-zoom';

let chartJs: Promise<typeof ChartJsModule | null> | undefined;
let registered = false;

/**
 * Independently loads the mandatory `chart.js` peer dependency and the
 * opt-in `chartjs-plugin-zoom` peer dependency, so a partial install
 * (`chart.js` only, which `peerDependenciesMeta` marks as a valid
 * combination) degrades to "charts render, zoom is inert" instead of every
 * chart breaking. Exported (in addition to `loadChartJs()` below) so both
 * failure paths — and the real caught error each one logs — are directly
 * testable without needing to actually uninstall either package.
 */
export async function loadChartAndZoom(
  importChart: () => Promise<typeof ChartJsModule> = () => import('chart.js'),
  importZoom: () => Promise<{ default: typeof ZoomPlugin }> = () => import('chartjs-plugin-zoom'),
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

/**
 * Lazily loads the optional peer dependency `chart.js` (+ `chartjs-plugin-zoom`,
 * loaded independently — see `loadChartAndZoom()`) once per page, registering
 * only the tree-shaken subset this library uses. Resolves to `null` if
 * chart.js isn't installed; still resolves the real module (with zoom simply
 * unregistered) if only `chartjs-plugin-zoom` is missing.
 */
export function loadChartJs(): Promise<typeof ChartJsModule | null> {
  if (!chartJs) {
    chartJs = loadChartAndZoom().then((result) => {
      if (!result) return null;
      const { mod, zoomPlugin } = result;
      if (!registered) {
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
          ...(zoomPlugin ? [zoomPlugin] : []),
        );
        registered = true;
      }
      return mod;
    });
  }
  return chartJs;
}
