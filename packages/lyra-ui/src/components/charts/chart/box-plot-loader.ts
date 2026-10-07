import { loadChartJs, type ChartJsModule } from './chart-core-loader.js';
import { resolveOptionalPeerCapability, unwrapOptionalPeerDefault } from '../../../internal/optional-peer-capabilities.js';

interface BoxPlotRegistrationConstructor {
  new (...args: never[]): object;
}

export interface BoxPlotModule {
  BoxPlotController: BoxPlotRegistrationConstructor;
  BoxAndWiskers: BoxPlotRegistrationConstructor;
}

function isConstructor(value: unknown): value is BoxPlotRegistrationConstructor {
  if (typeof value !== 'function') return false;
  try {
    Reflect.construct(Object, [], value);
    return true;
  } catch {
    return false;
  }
}

function missingBoxPlotCapability(candidate: unknown): string | undefined {
  if ((typeof candidate !== 'object' && typeof candidate !== 'function') || candidate === null) {
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
  try {
    const [chartMod, imported] = await Promise.all([loadChart(), importBoxPlot()]);
    if (!chartMod) return null;
    const boxMod = resolveBoxPlotModule(imported);
    chartMod.Chart.register(boxMod.BoxPlotController, boxMod.BoxAndWiskers);
    return boxMod;
  } catch (error) {
    console.warn(
      '<lr-box-plot> needs the optional peer dependency `@sgratzl/chartjs-chart-boxplot` ' +
        '— install it with `pnpm add @sgratzl/chartjs-chart-boxplot`.',
      error,
    );
    return null;
  }
}
