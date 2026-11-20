import { loadChartJs, type ChartJsModule } from './chart-core-loader.js';
import { isObjectLike } from '../../../internal/object-guards.js';
import { isConstructor, warnChartPeer, warnChartPeerImport } from './chart-peer.js';
import { createOptionalPeerLoader, resolveOptionalPeerCapability, unwrapOptionalPeerDefault } from '../../../internal/optional-peer-capabilities.js';

interface BoxPlotRegistrationConstructor {
  new (...args: never[]): object;
}

export interface BoxPlotModule {
  BoxPlotController: BoxPlotRegistrationConstructor;
  BoxAndWiskers: BoxPlotRegistrationConstructor;
}

function missingBoxPlotCapability(candidate: unknown): string | undefined {
  if (!isObjectLike(candidate)) {
    return 'module namespace';
  }
  const module = candidate as { BoxPlotController?: unknown; BoxAndWiskers?: unknown };
  if (!isConstructor(module.BoxPlotController)) return 'BoxPlotController';
  if (!isConstructor(module.BoxAndWiskers)) return 'BoxAndWiskers';
  return undefined;
}

function isBoxPlotModule(candidate: unknown): candidate is BoxPlotModule {
  return missingBoxPlotCapability(candidate) === undefined;
}

function resolveBoxPlotModule(value: unknown): BoxPlotModule {
  const module = resolveOptionalPeerCapability(value, isBoxPlotModule);
  if (module) return module;
  const candidate = unwrapOptionalPeerDefault(value);
  const missing = missingBoxPlotCapability(candidate) ?? 'module namespace';
  throw new Error(
    'Invalid optional peer `@sgratzl/chartjs-chart-boxplot`: ' +
      `missing or invalid \`${missing}\` constructor.`,
  );
}

/**
 * Loads and validates the box-plot peer before registering its two constructors.
 * Its declaration is retained for the box-plot class module's re-export.
 */
export async function loadBoxPlotAndRegister(
  loadChart: () => Promise<ChartJsModule | null> = loadChartJs,
  importBoxPlot: () => Promise<unknown> = () => import('@sgratzl/chartjs-chart-boxplot'),
): Promise<BoxPlotModule | null> {
  let chart: ChartJsModule | null;
  let imported: unknown;
  try {
    [chart, imported] = await Promise.all([loadChart(), importBoxPlot()]);
  } catch (error) {
    warnChartPeerImport('@sgratzl/chartjs-chart-boxplot', error, 'lr-box-plot');
    return null;
  }
  if (!chart) return null;
  try {
    const plugin = resolveBoxPlotModule(imported);
    chart.Chart.register(plugin.BoxPlotController, plugin.BoxAndWiskers);
    return plugin;
  } catch (error) {
    warnChartPeer('box-plot:register', '<lr-box-plot> could not register the box plot renderer.', error);
    return null;
  }
}

const boxPeer = createOptionalPeerLoader({
  load: () => import('@sgratzl/chartjs-chart-boxplot'),
  isCapability: isBoxPlotModule,
  cache: 'generation',
  warningKey: 'lr-box-plot-peer',
  warning: '<lr-box-plot> requires a compatible @sgratzl/chartjs-chart-boxplot installation.',
});
let registered: BoxPlotModule | undefined;

export async function loadBoxPlotPlugin(): Promise<BoxPlotModule | null> {
  const [chart, plugin] = await Promise.all([loadChartJs(), boxPeer.get()]);
  if (!chart || !plugin) return null;
  if (registered !== plugin) {
    try {
      chart.Chart.register(plugin.BoxPlotController, plugin.BoxAndWiskers);
      registered = plugin;
    } catch (error) {
      warnChartPeer('box-plot:register', '<lr-box-plot> could not register the box plot renderer.', error);
      return null;
    }
  }
  return plugin;
}
