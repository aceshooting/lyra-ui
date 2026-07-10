import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './histogram.js';
import type { LyraHistogram } from './histogram.js';

it('bins its values and renders a bar-chart Chart.js instance', async () => {
  const el = (await fixture(html`<lyra-histogram bins="5"></lyra-histogram>`)) as LyraHistogram;
  el.values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null, 'chart never initialized', { timeout: 2000 });
  expect((el as any).chart.config.type).to.equal('bar');
  expect((el as any).chart.data.labels.length).to.equal(5);
});

it('is accessible', async () => {
  const el = (await fixture(html`<lyra-histogram></lyra-histogram>`)) as LyraHistogram;
  el.values = [1, 2, 3];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  await expect(el).to.be.accessible();
});
