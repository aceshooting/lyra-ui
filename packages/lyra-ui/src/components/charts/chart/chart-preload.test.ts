import { expect } from '@open-wc/testing';
import { preloadCharts } from './chart-preload.js';

it('preloads core without importing unrequested feature capabilities into the result', async () => {
  const result = await preloadCharts();
  expect(result.core).to.be.true;
  expect(Object.keys(result)).to.deep.equal(['core']);
});

it('reports requested optional chart capabilities', async () => {
  const result = await preloadCharts({ zoom: true, dataLabels: true, boxPlot: true });
  expect(result).to.deep.equal({ core: true, zoom: true, dataLabels: true, boxPlot: true });
});
