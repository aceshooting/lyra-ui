import type * as ChartJsModule from 'chart.js';

let chartJs: Promise<typeof ChartJsModule | null> | undefined;
let registered = false;

/**
 * Lazily loads the optional peer dependency `chart.js` (+ `chartjs-plugin-zoom`)
 * once per page, registering only the tree-shaken subset this library uses.
 * Resolves to `null` (with a one-time warning) if chart.js isn't installed —
 * mirrors `<lyra-flag>`'s peer-dependency pattern.
 */
export function loadChartJs(): Promise<typeof ChartJsModule | null> {
  if (!chartJs) {
    chartJs = Promise.all([import('chart.js'), import('chartjs-plugin-zoom')])
      .then(([mod, zoomMod]) => {
        if (!registered) {
          mod.Chart.register(
            mod.LineController,
            mod.BarController,
            mod.ScatterController,
            mod.LineElement,
            mod.PointElement,
            mod.BarElement,
            mod.LinearScale,
            mod.CategoryScale,
            mod.Filler,
            mod.Tooltip,
            mod.Legend,
            zoomMod.default,
          );
          registered = true;
        }
        return mod;
      })
      .catch(() => {
        console.warn(
          '<lyra-chart> needs the optional peer dependencies `chart.js` and ' +
            '`chartjs-plugin-zoom` — install them with `pnpm add chart.js chartjs-plugin-zoom`.',
        );
        return null;
      });
  }
  return chartJs;
}
