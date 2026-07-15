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

it('normalizes unsafe HTML `bins` values before they reach the binning pass', () => {
  const el = document.createElement('lyra-histogram') as LyraHistogram;

  el.setAttribute('bins', String(Number.MAX_SAFE_INTEGER));
  expect(el.bins).to.equal(1_000);

  el.setAttribute('bins', '3.9');
  expect(el.bins).to.equal(3);

  el.setAttribute('bins', 'Infinity');
  expect(el.bins).to.equal(0);

  el.values = [0, 1];
  el.bins = Number.MAX_SAFE_INTEGER;
  expect(binnedBuckets(el)).to.have.length(1_000);
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
  const el = (await fixture(html`<lyra-histogram aria-label="Response-time distribution"></lyra-histogram>`)) as LyraHistogram;
  el.values = [1, 2, 3];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  expect(el.shadowRoot!.querySelector('canvas')!.getAttribute('aria-label')).to.equal('Response-time distribution');
  expect(el.shadowRoot!.querySelectorAll('[role]')).to.have.length(1);
  await expect(el).to.be.accessible();
});

it('redraws its derived labels and counts when values change after initialization', async () => {
  const el = (await fixture(html`<lyra-histogram bins="2"></lyra-histogram>`)) as LyraHistogram;
  el.values = [0, 1, 2, 3];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  el.values = [0, 0, 0, 10];
  await el.updateComplete;

  expect((el as any).chart.data.datasets[0].data).to.deep.equal([3, 1]);
});

it('can shrink to a 320px allocation with a long series label', async () => {
  const wrapper = await fixture(html`
    <div style="display: flex; inline-size: 320px;">
      <lyra-histogram label="A deliberately long translated frequency distribution label"></lyra-histogram>
    </div>
  `);
  const el = wrapper.querySelector('lyra-histogram') as LyraHistogram;
  el.values = [1, 2, 3, 4, 5];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  expect(getComputedStyle(el).minInlineSize).to.equal('0px');
  expect(el.getBoundingClientRect().width).to.be.at.most(320);
});
