import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './histogram.js';
import { binnedBuckets, type LyraHistogram } from './histogram.js';

it('bins its values and renders a bar-chart Chart.js instance', async () => {
  const el = (await fixture(html`<lyra-histogram bins="5"></lyra-histogram>`)) as LyraHistogram;
  el.values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null, 'chart never initialized', { timeout: 2000 });
  expect((el as any).chart.config.type).to.equal('bar');
  expect((el as any).chart.data.labels.length).to.equal(5);
});

it('locks .type to "bar" — assigning a different value at runtime (e.g. via a `type="line"` attribute) is a no-op', async () => {
  const el = (await fixture(html`<lyra-histogram></lyra-histogram>`)) as LyraHistogram;
  (el as any).type = 'line';
  expect(el.type).to.equal('bar');
});

it('memoizes the binning pass, reusing the same bucket array while `values`/`bins` are unchanged', async () => {
  const el = (await fixture(html`<lyra-histogram bins="5"></lyra-histogram>`)) as LyraHistogram;
  el.values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  const first = binnedBuckets(el);
  const second = binnedBuckets(el);
  expect(second).to.equal(first);

  el.values = [...el.values, 11];
  const third = binnedBuckets(el);
  expect(third).to.not.equal(first);

  el.bins = 3;
  const fourth = binnedBuckets(el);
  expect(fourth).to.not.equal(third);
});

it('is accessible', async () => {
  const el = (await fixture(html`<lyra-histogram></lyra-histogram>`)) as LyraHistogram;
  el.values = [1, 2, 3];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  await expect(el).to.be.accessible();
});
