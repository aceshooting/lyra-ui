import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './box-plot.js';
import type { LyraBoxPlot } from './box-plot.js';

it('builds a boxplot Chart.js instance once both chart.js and the boxplot plugin load', async () => {
  const el = (await fixture(html`<lyra-box-plot></lyra-box-plot>`)) as LyraBoxPlot;
  el.labels = ['K=2', 'K=3'];
  el.boxes = [
    {
      label: 'Loss',
      data: [
        { min: 1, q1: 2, median: 3, q3: 4, max: 5 },
        { min: 2, q1: 3, median: 4, q3: 5, max: 6 },
      ],
    },
  ];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null, 'chart never initialized', { timeout: 2000 });
  expect(el.shadowRoot!.querySelector('canvas')).to.exist;
});

it('is accessible', async () => {
  const el = (await fixture(html`<lyra-box-plot></lyra-box-plot>`)) as LyraBoxPlot;
  el.boxes = [{ label: 'x', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  await expect(el).to.be.accessible();
});
