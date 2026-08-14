import {
  resolveOptionalPeerCapability,
  unwrapOptionalPeerDefault,
} from '../../../internal/optional-peer-capabilities.js';

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

/** Validates Chart.js's consumed module capabilities without exposing its peer types. */
function resolveChartJsModule(value: unknown): ChartJsModule {
  const module = resolveOptionalPeerCapability(value, isChartJsModule);
  if (module) return module;
  const candidate = unwrapOptionalPeerDefault(value);
  const missing = missingChartCapability(candidate) ?? 'module namespace';
  throw new Error(
    `Invalid optional peer \`chart.js\`: missing or invalid \`${missing}\` capability.`,
  );
}

let chartJs: Promise<ChartJsModule | null> | undefined;
let registered = false;

/**
 * Independently loads and validates Chart.js core for both core-only and feature-enabled charts.
 */
export async function loadChartModule(
  importChart: () => Promise<unknown> = () => import('chart.js'),
): Promise<ChartJsModule | null> {
  try {
    return resolveChartJsModule(await importChart());
  } catch (err) {
    console.warn(
      '<lr-chart> needs the optional peer dependency `chart.js` — install it with `pnpm add chart.js`:',
      err,
    );
    return null;
  }
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

/** Loads and registers the validated Chart.js core, failing closed for either phase. The
 * registration dependency is injectable solely so the rejection path can be exercised without
 * perturbing the page-global registration cache. */
export async function loadAndRegisterChartModule(
  importChart: () => Promise<unknown> = () => import('chart.js'),
  register: (mod: ChartJsModule) => void = registerCore,
): Promise<ChartJsModule | null> {
  const mod = await loadChartModule(importChart);
  if (!mod) return null;
  try {
    register(mod);
    return mod;
  } catch (error: unknown) {
    console.warn(
      '<lr-chart> could not register the optional `chart.js` peer:',
      error,
    );
    return null;
  }
}

/** Lazily loads the optional `chart.js` peer once per page and registers Lyra's core subset. */
export function loadChartJs(): Promise<ChartJsModule | null> {
  if (!chartJs) {
    chartJs = loadAndRegisterChartModule();
  }
  return chartJs;
}
