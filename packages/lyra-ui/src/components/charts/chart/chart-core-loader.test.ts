import { expect } from '@open-wc/testing';
import {
  loadChartJs,
  loadChartModule,
  loadAndRegisterChartModule,
  type ChartJsModule,
} from './chart-core-loader.js';

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
  'LogarithmicScale',
  'Filler',
  'Tooltip',
  'Legend',
] as const;

function fakeChartModule(): ChartJsModule {
  class FakeChart {
    static register(..._items: unknown[]): void {}
    constructor(_item: HTMLCanvasElement, _configuration: unknown) {}
  }
  const registrationItem = {};
  return {
    Chart: FakeChart,
    defaults: {
      plugins: { legend: { labels: { generateLabels: () => [] } } },
    },
    ...Object.fromEntries(CHART_REGISTERABLE_KEYS.map((key) => [key, registrationItem])),
  } as unknown as ChartJsModule;
}

async function captureWarnings<T>(operation: () => Promise<T>): Promise<{
  result: T;
  warnings: unknown[][];
}> {
  const originalWarn = console.warn;
  const warnings: unknown[][] = [];
  console.warn = (...args: unknown[]) => warnings.push(args);
  try {
    return { result: await operation(), warnings };
  } finally {
    console.warn = originalWarn;
  }
}

it('resolves the Chart.js module', async () => {
  const mod = await loadChartJs();
  expect(mod).to.not.be.null;
  expect(mod!.Chart).to.exist;
});

it('caches the module — a second call returns the same promise result', async () => {
  const a = await loadChartJs();
  const b = await loadChartJs();
  expect(a).to.equal(b);
});

describe('loadChartModule (independent Chart.js core loading)', () => {
  it('normalizes a valid Chart.js default export', async () => {
    const fallback = fakeChartModule();
    expect(
      await loadChartModule(() => Promise.resolve({ default: fallback } as never)),
    ).to.equal(fallback);
  });

  it('fails closed and logs the real caught error when Chart.js cannot load', async () => {
    const chartError = new Error('specific chart.js core failure reason');
    const { result, warnings } = await captureWarnings(() =>
      loadChartModule(() => Promise.reject(chartError)),
    );
    expect(result).to.equal(null);
    expect(warnings.flat()).to.contain(chartError);
    expect(warnings.flat().join(' ')).to.contain('pnpm add chart.js');
  });

  it('fails closed when core registration throws instead of memoizing a rejected promise', async () => {
    const registrationError = new Error('core registration boom');
    const chart = fakeChartModule();
    const { result, warnings } = await captureWarnings(() =>
      loadAndRegisterChartModule(
        () => Promise.resolve(chart),
        () => { throw registrationError; },
      ),
    );

    expect(result).to.equal(null);
    expect(warnings.flat()).to.contain(registrationError);
    expect(warnings.flat().join(' ')).to.contain('could not register');
  });
});
