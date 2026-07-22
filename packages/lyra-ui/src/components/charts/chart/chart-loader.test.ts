import { expect } from '@open-wc/testing';
import {
  loadChartJs,
  loadChartAndZoom,
  loadChartJsWithZoom,
  loadChartJsWithDataLabels,
  loadDataLabelsPlugin,
} from './chart-loader.js';

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

describe('loadChartAndZoom (independent chart.js / zoom-plugin loading)', () => {
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
});

describe('loadChartJsWithZoom (memoized zoom-plugin load)', () => {
  it('serializes two concurrent callers behind the same in-flight promise, so the zoom plugin is only imported once', async () => {
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

    await Promise.all([p1, p2]);
    expect(zoomImportCount).to.equal(1);
  });
});

describe('loadChartJsWithDataLabels (memoized data-labels plugin load)', () => {
  it('serializes two concurrent callers behind the same in-flight promise, so the plugin is only imported once', async () => {
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

    await Promise.all([p1, p2]);
    expect(importCount).to.equal(1);
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

  it('reads `mod.default ?? mod` so the plugin object is registered, not the module namespace', async () => {
    const sentinelPlugin = { id: 'datalabels-sentinel' };
    const plugin = await loadDataLabelsPlugin(() =>
      Promise.resolve({ default: sentinelPlugin } as never),
    );
    expect(plugin).to.equal(sentinelPlugin);
  });
});
