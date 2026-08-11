import { expect } from '@open-wc/testing';
import {
  loadChartJs,
  loadChartModule,
  loadChartAndZoom,
  loadChartJsWithZoomResult,
  loadChartJsWithZoom,
  loadChartJsWithDataLabelsResult,
  loadChartJsWithDataLabels,
  loadDataLabelsPlugin,
  type ChartJsModule,
} from './chart-loader.js';
import {
  loadChartAndDataLabels,
  loadChartAndRegisterZoom,
  loadChartAndZoom as loadChartFeatureAndZoom,
  loadDataLabelsPlugin as loadFeatureDataLabelsPlugin,
} from './chart-feature-loader.js';

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
});

describe('loadChartAndZoom (independent chart.js / zoom-plugin loading)', () => {
  it('normalizes a valid Chart.js default export and prefers a valid named namespace', async () => {
    const fallback = fakeChartModule();
    const fromDefault = await loadChartAndZoom(
      () => Promise.resolve({ default: fallback } as never),
      () => Promise.reject(new Error('unused')),
    );
    expect(fromDefault?.mod === fallback).to.be.true;

    const named = fakeChartModule();
    const mixed = Object.assign(named, { default: fallback });
    const capabilityFirst = await loadChartAndZoom(
      () => Promise.resolve(mixed as never),
      () => Promise.reject(new Error('unused')),
    );
    expect(capabilityFirst?.mod === named).to.be.true;
  });

  it('fails closed with a clear Error when Chart.js lacks a consumed core capability', async () => {
    const malformedCases: Array<[string, unknown]> = [
      [
        'Chart',
        {
          ...fakeChartModule(),
          Chart: Object.assign(() => ({}), { register() {} }),
        },
      ],
      [
        'Chart.register',
        {
          ...fakeChartModule(),
          Chart: class {
            constructor(_item: HTMLCanvasElement, _configuration: unknown) {}
          },
        },
      ],
      ['defaults', { ...fakeChartModule(), defaults: null }],
      ...CHART_REGISTERABLE_KEYS.map(
        (key) => [key, { ...fakeChartModule(), [key]: undefined }] as [string, unknown],
      ),
    ];

    for (const [capability, malformed] of malformedCases) {
      const { result, warnings } = await captureWarnings(() =>
        loadChartAndZoom(
          () => Promise.resolve(malformed as never),
          () => Promise.reject(new Error('unused')),
        ),
      );
      expect(result === null, capability).to.be.true;
      const error = warnings.flat().find((value) => value instanceof Error) as Error | undefined;
      expect(error instanceof Error, capability).to.be.true;
      expect(error!.message, capability).to.contain('chart.js');
      expect(error!.message, capability).to.contain(capability);
    }
  });

  it('rejects malformed named and default-wrapped Chart.js namespaces', async () => {
    for (const malformed of [
      { Chart: class {}, defaults: {} },
      { default: { Chart: class {}, defaults: {} } },
    ]) {
      const { result, warnings } = await captureWarnings(() =>
        loadChartAndZoom(
          () => Promise.resolve(malformed as never),
          () => Promise.reject(new Error('unused')),
        ),
      );
      expect(result === null).to.be.true;
      expect(warnings.flat().some((value) => value instanceof Error)).to.be.true;
    }
  });

  it('does not import chartjs-plugin-zoom when the caller does not request it', async () => {
    let zoomImportCalled = false;
    const fakeChart = await import('chart.js');
    await loadChartAndZoom(
      () => Promise.resolve(fakeChart),
      () => {
        zoomImportCalled = true;
        return import('chartjs-plugin-zoom');
      },
      false,
    );
    expect(zoomImportCalled).to.be.false;
  });

  it('still resolves chart.js when the zoom plugin fails to load — a partial install (chart.js only, no zoom) must not break every chart', async () => {
    const zoomError = new Error('zoom boom');
    const originalWarn = console.warn;
    const warnings: unknown[][] = [];
    console.warn = (...args: unknown[]) => warnings.push(args);
    let result: Awaited<ReturnType<typeof loadChartAndZoom>>;
    try {
      result = await loadChartAndZoom(
        () => import('chart.js'),
        () => Promise.reject(zoomError),
        true,
      );
    } finally {
      console.warn = originalWarn;
    }
    expect(result).to.not.be.null;
    expect(result!.mod.Chart).to.exist;
    expect(result!.zoomPlugin).to.equal(undefined);
    expect(warnings.flat()).to.contain(zoomError);
    expect(warnings.flat().join(' ')).to.contain('pnpm add chartjs-plugin-zoom');
  });

  it('resolves null when chart.js itself fails to load, even though the zoom plugin would have loaded fine', async () => {
    const chartError = new Error('chart.js boom');
    const originalWarn = console.warn;
    const warnings: unknown[][] = [];
    console.warn = (...args: unknown[]) => warnings.push(args);
    let result: Awaited<ReturnType<typeof loadChartAndZoom>>;
    try {
      result = await loadChartAndZoom(
        () => Promise.reject(chartError),
        () => import('chartjs-plugin-zoom'),
      );
    } finally {
      console.warn = originalWarn;
    }
    expect(result).to.equal(null);
    expect(warnings.flat()).to.contain(chartError);
    expect(warnings.flat().join(' ')).to.contain('pnpm add chart.js');
  });

  it('logs the real caught error (not a generic message) when chart.js fails to load', async () => {
    const chartError = new Error('specific chart.js failure reason');
    const originalWarn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    try {
      await loadChartAndZoom(
        () => Promise.reject(chartError),
        () => import('chartjs-plugin-zoom'),
      );
    } finally {
      console.warn = originalWarn;
    }
    const loggedArgs = calls.flat();
    expect(loggedArgs).to.contain(chartError);
  });

  it('logs the real caught error (not a generic message) when the zoom plugin fails to load', async () => {
    const zoomError = new Error('specific zoom failure reason');
    const originalWarn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    try {
      await loadChartAndZoom(
        () => import('chart.js'),
        () => Promise.reject(zoomError),
        true,
      );
    } finally {
      console.warn = originalWarn;
    }
    const loggedArgs = calls.flat();
    expect(loggedArgs).to.contain(zoomError);
  });

  it('normalizes plugins capability-first and rejects a plugin without a non-empty id', async () => {
    const chart = fakeChartModule();
    const namedPlugin = { id: 'named-zoom' };
    const fallbackPlugin = { id: 'default-zoom' };
    const mixed = Object.assign(namedPlugin, { default: fallbackPlugin });
    const result = await loadChartAndZoom(
      () => Promise.resolve(chart),
      () => Promise.resolve(mixed as never),
      true,
    );
    expect(result!.zoomPlugin).to.equal(namedPlugin);

    for (const malformed of [{}, { default: { id: '' } }]) {
      const { result: degraded, warnings } = await captureWarnings(() =>
        loadChartAndZoom(
          () => Promise.resolve(chart),
          () => Promise.resolve(malformed as never),
          true,
        ),
      );
      expect(degraded!.zoomPlugin).to.equal(undefined);
      const error = warnings.flat().find((value) => value instanceof Error) as Error | undefined;
      expect(error instanceof Error).to.be.true;
      expect(error!.message).to.contain('chartjs-plugin-zoom');
      expect(error!.message).to.contain('id');
    }
  });
});

describe('tagged feature-load results', () => {
  it('reports core-unavailable without attempting to import zoom', async () => {
    let zoomImportCalled = false;
    const result = await loadChartAndRegisterZoom(
      () => Promise.resolve(null),
      () => {
        zoomImportCalled = true;
        return import('chartjs-plugin-zoom');
      },
    );

    expect(result.kind).to.equal('core-unavailable');
    expect(zoomImportCalled).to.be.false;
  });

  it('retains the core module and reports zoom unavailable when its peer fails', async () => {
    const peerError = new Error('zoom peer boom');
    const chart = fakeChartModule();
    const { result, warnings } = await captureWarnings(() =>
      loadChartAndRegisterZoom(
        () => Promise.resolve(chart),
        () => Promise.reject(peerError),
      ),
    );

    expect(result.kind).to.equal('feature-unavailable');
    if (result.kind !== 'feature-unavailable') {
      throw new Error('Expected the zoom feature to be unavailable.');
    }
    expect(result.mod).to.equal(chart);
    expect(warnings.flat()).to.contain(peerError);
  });

  it('retains the core module and reports zoom unavailable when Chart.register throws', async () => {
    const registrationError = new Error('zoom registration boom');
    const chart = fakeChartModule();
    chart.Chart.register = () => {
      throw registrationError;
    };
    const zoomPlugin = { id: 'zoom-sentinel' };

    const { result, warnings } = await captureWarnings(() =>
      loadChartAndRegisterZoom(
        () => Promise.resolve(chart),
        () => Promise.resolve(zoomPlugin),
      ),
    );

    expect(result.kind).to.equal('feature-unavailable');
    if (result.kind !== 'feature-unavailable') {
      throw new Error('Expected the zoom feature to be unavailable.');
    }
    expect(result.mod).to.equal(chart);
    expect(warnings.flat()).to.contain(registrationError);
    expect(warnings.flat().join(' ')).to.contain('lr-chart');
  });

  it('retains the core module and reports data-labels unavailable when its peer fails', async () => {
    const peerError = new Error('data-labels peer boom');
    const chart = fakeChartModule();
    const { result, warnings } = await captureWarnings(() =>
      loadChartAndDataLabels(
        () => Promise.resolve(chart),
        () => Promise.reject(peerError),
      ),
    );

    expect(result.kind).to.equal('feature-unavailable');
    if (result.kind !== 'feature-unavailable') {
      throw new Error('Expected the data-labels feature to be unavailable.');
    }
    expect(result.mod).to.equal(chart);
    expect(warnings.flat()).to.contain(peerError);
  });
});

describe('loadChartJsWithZoomResult (memoized zoom-plugin load)', () => {
  it('serializes two concurrent legacy callers behind the same in-flight promise, then exposes the matching tagged result', async () => {
    let zoomImportCount = 0;
    const fakeZoomModule = await import('chartjs-plugin-zoom');
    const importZoom = () => {
      zoomImportCount++;
      return Promise.resolve(fakeZoomModule);
    };

    // No `await` between these two calls — this is the exact race the fix
    // closes: two callers (e.g. two `<lr-chart zoom>` elements connecting
    // close together) both hitting `loadChartJsWithZoom()` before either has
    // had a chance to observe a completed load.
    const p1 = loadChartJsWithZoom(importZoom);
    const p2 = loadChartJsWithZoom(importZoom);

    // A memoized single load means both callers share the exact same
    // promise — a boolean check-then-act guard could never guarantee this,
    // since each call to a plain `async function` returns a distinct
    // Promise regardless of the internal guard's state.
    expect(p1).to.equal(p2);

    const [mod] = await Promise.all([p1, p2]);
    const result1 = loadChartJsWithZoomResult();
    const result2 = loadChartJsWithZoomResult();
    expect(result1).to.equal(result2);
    const result = await result1;
    expect(result.kind).to.equal('available');
    if (result.kind !== 'available') {
      throw new Error('Expected zoom to be available.');
    }
    expect(zoomImportCount).to.equal(1);
    expect(mod).to.equal(result.mod);
  });
});

describe('loadChartJsWithDataLabelsResult (memoized data-labels plugin load)', () => {
  it('serializes two concurrent legacy callers behind the same in-flight promise, then exposes the matching tagged result', async () => {
    let importCount = 0;
    const fakeModule = await import('chartjs-plugin-datalabels');
    const importDataLabels = () => {
      importCount++;
      return Promise.resolve(fakeModule);
    };

    // No `await` between the two calls — the same check-then-act race the zoom
    // loader closes: two `<lr-chart data-labels>` elements connecting close
    // together must share one in-flight load, not each register the plugin.
    const p1 = loadChartJsWithDataLabels(importDataLabels);
    const p2 = loadChartJsWithDataLabels(importDataLabels);
    expect(p1).to.equal(p2);

    const [legacy] = await Promise.all([p1, p2]);
    const result1 = loadChartJsWithDataLabelsResult();
    const result2 = loadChartJsWithDataLabelsResult();
    expect(result1).to.equal(result2);
    const result = await result1;
    expect(result.kind).to.equal('available');
    if (result.kind !== 'available') {
      throw new Error('Expected data labels to be available.');
    }
    expect(importCount).to.equal(1);
    expect(legacy?.mod).to.equal(result.mod);
    expect(legacy?.plugin).to.equal(result.plugin);
  });

  it('resolves undefined and warns (naming the component + package) when the data-labels plugin fails to load — a partial install must not break charts', async () => {
    // Tested via the un-memoized `loadDataLabelsPlugin` so the rejected import
    // actually runs (the memoized `loadChartJsWithDataLabels` would return a
    // cached success from the test above) — mirrors how the zoom failure path
    // is tested through `loadChartAndZoom` rather than the memoized wrapper.
    const warn = console.warn;
    const warnings: unknown[][] = [];
    console.warn = (...args: unknown[]) => warnings.push(args);
    try {
      const plugin = await loadDataLabelsPlugin(() => Promise.reject(new Error('boom')));
      expect(plugin).to.equal(undefined);
      expect(warnings.length).to.be.greaterThan(0);
      const joined = warnings.flat().map(String).join(' ');
      expect(joined).to.contain('lr-chart');
      expect(joined).to.contain('chartjs-plugin-datalabels');
    } finally {
      console.warn = warn;
    }
  });

  it('normalizes a default-wrapped plugin to the registerable capability', async () => {
    const sentinelPlugin = { id: 'datalabels-sentinel' };
    const plugin = await loadDataLabelsPlugin(() =>
      Promise.resolve({ default: sentinelPlugin } as never),
    );
    expect(plugin).to.equal(sentinelPlugin);
  });

  it('prefers a valid named plugin capability and rejects malformed namespace/default shapes', async () => {
    const named = { id: 'named-datalabels' };
    const fallback = { id: 'default-datalabels' };
    const mixed = Object.assign(named, { default: fallback });
    expect(await loadDataLabelsPlugin(() => Promise.resolve(mixed as never))).to.equal(named);

    for (const malformed of [{ render: () => undefined }, { default: { id: 42 } }]) {
      const { result, warnings } = await captureWarnings(() =>
        loadDataLabelsPlugin(() => Promise.resolve(malformed as never)),
      );
      expect(result).to.equal(undefined);
      const error = warnings.flat().find((value) => value instanceof Error) as Error | undefined;
      expect(error instanceof Error).to.be.true;
      expect(error!.message).to.contain('chartjs-plugin-datalabels');
      expect(error!.message).to.contain('id');
    }
  });
});

describe('chart feature loader default imports', () => {
  it('loads installed peers through each un-memoized public default path', async () => {
    const combined = await loadChartFeatureAndZoom(undefined, undefined, true);
    expect(combined === null).to.be.false;
    expect(typeof combined?.mod.Chart).to.equal('function');
    expect(typeof combined?.zoomPlugin?.id).to.equal('string');

    const registered = await loadChartAndRegisterZoom(() => Promise.resolve(fakeChartModule()));
    expect(registered.kind).to.equal('available');
    if (registered.kind !== 'available') {
      throw new Error('Expected the installed zoom peer to be available.');
    }
    expect(typeof registered.plugin.id).to.equal('string');

    const standalone = await loadFeatureDataLabelsPlugin();
    expect(typeof standalone?.id).to.equal('string');

    const dataLabels = await loadChartAndDataLabels(() => Promise.resolve(fakeChartModule()));
    expect(dataLabels.kind).to.equal('available');
    if (dataLabels.kind !== 'available') {
      throw new Error('Expected the installed data-labels peer to be available.');
    }
    expect(typeof dataLabels.plugin.id).to.equal('string');

    let attemptedPeerImport = false;
    const unavailable = await loadChartAndDataLabels(
      () => Promise.resolve(null),
      () => {
        attemptedPeerImport = true;
        return Promise.resolve({ id: 'unused' });
      },
    );
    expect(unavailable.kind).to.equal('core-unavailable');
    expect(attemptedPeerImport).to.be.false;
  });

  it('keeps the legacy data-labels adapter independent of another test module cache', async () => {
    const { loadChartJsWithDataLabels: loadInFreshRealm } = await import(
      './chart-feature-loader.js?coverage-legacy-data-labels',
    );
    const legacy = await loadInFreshRealm();
    expect(typeof legacy?.mod.Chart).to.equal('function');
    expect(typeof legacy?.plugin?.id).to.equal('string');
  });
});
