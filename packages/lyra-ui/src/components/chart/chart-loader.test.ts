import { expect } from '@open-wc/testing';
import { loadChartJs, loadChartAndZoom } from './chart-loader.js';

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
  it('still resolves chart.js when the zoom plugin fails to load — a partial install (chart.js only, no zoom) must not break every chart', async () => {
    const zoomError = new Error('zoom boom');
    const result = await loadChartAndZoom(
      () => import('chart.js'),
      () => Promise.reject(zoomError),
    );
    expect(result).to.not.be.null;
    expect(result!.mod.Chart).to.exist;
    expect(result!.zoomPlugin).to.equal(undefined);
  });

  it('resolves null when chart.js itself fails to load, even though the zoom plugin would have loaded fine', async () => {
    const chartError = new Error('chart.js boom');
    const result = await loadChartAndZoom(
      () => Promise.reject(chartError),
      () => import('chartjs-plugin-zoom'),
    );
    expect(result).to.equal(null);
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
      );
    } finally {
      console.warn = originalWarn;
    }
    const loggedArgs = calls.flat();
    expect(loggedArgs).to.contain(zoomError);
  });
});
