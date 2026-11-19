import { expect, waitUntil } from '@open-wc/testing';
import type { LyraChart } from './chart.class.js';
import type { LyraSpatialChartSource } from '../../../utilities/data-spatial.js';
import './chart.js';

it('keeps a failed spatial import recoverable and waits for a cold exact-point reveal', async () => {
  const chart = document.createElement('lr-chart') as LyraChart;
  const runtime = chart as unknown as { importSpatialTools(): Promise<typeof import('./chart-spatial-data.js')> };
  const load = runtime.importSpatialTools.bind(chart);
  const neighbors: LyraChart[] = [];
  const point = { id: 'east', seriesId: 'quarter', sourceIndex: 0, x: 1, y: 1 };
  const source: LyraSpatialChartSource = {
    kind: 'spatial', revision: 1, count: 1, bounds: { minX: 0, maxX: 2, minY: 0, maxY: 2 },
    series: [{ id: 'quarter', label: 'Quarter' }], getPoint: () => point,
    query: ({ bounds }) => ({ matchedCount: 1, points: [point], bins: [{ bounds, count: 1 }] }),
  };
  chart.type = 'scatter';
  chart.withDataTable = true;
  chart.preparedData = source;
  runtime.importSpatialTools = () => Promise.reject(new TypeError('Spatial module unavailable'));
  document.body.append(chart);
  try {
    await waitUntil(() => !!chart.shadowRoot!.querySelector('[part="error"]'));
    expect(await chart.revealSourcePoint(point.id)).to.equal(false);
    let finish!: () => void;
    runtime.importSpatialTools = () => new Promise(resolve => { finish = () => resolve(load()); });
    chart.requestUpdate();
    await chart.updateComplete;
    const revealing = chart.revealSourcePoint(point.id);
    for (const outcome of ['reject', 'resolve']) {
      const retired = document.createElement('lr-chart') as LyraChart;
      neighbors.push(retired);
      retired.type = 'scatter';
      retired.preparedData = source;
      let settle!: () => void;
      (retired as unknown as typeof runtime).importSpatialTools = () => new Promise((resolve, reject) => {
        settle = () => { if (outcome === 'resolve') resolve(load()); else reject(new Error('Unavailable')); };
      });
      document.body.append(retired);
      await retired.updateComplete;
      const pending = retired.revealSourcePoint(point.id);
      if (outcome === 'reject') retired.remove();
      else retired.preparedData = null;
      await retired.updateComplete;
      expect(await pending).to.equal(false);
      settle();
      await load();
      await retired.updateComplete;
      expect(retired.shadowRoot!.querySelector('[part="error"]') === null).to.equal(true);
      expect(await retired.revealSourcePoint(point.id)).to.equal(false);
    }
    finish();
    expect(await revealing).to.equal(true);
    expect(chart.shadowRoot!.querySelector('[part="error"]') === null).to.equal(true);
  } finally { chart.remove(); for (const retired of neighbors) retired.remove(); }
});
