import { expect } from '@open-wc/testing';
import { loadChartJs } from './chart-loader.js';

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
