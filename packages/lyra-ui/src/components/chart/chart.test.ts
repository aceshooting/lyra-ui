import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './chart.js';
import type { LyraChart } from './chart.js';

it('shows a loading skeleton and aria-busy while chart.js loads, then swaps to the canvas', async () => {
  const el = (await fixture(html`<lyra-chart></lyra-chart>`)) as LyraChart;
  expect(el.getAttribute('aria-busy')).to.equal('true');
  expect(el.shadowRoot!.querySelector('lyra-skeleton')).to.exist;
  expect(el.shadowRoot!.querySelector('canvas')).to.not.exist;

  await waitUntil(() => (el as any).chart != null);

  expect(el.hasAttribute('aria-busy')).to.be.false;
  expect(el.shadowRoot!.querySelector('lyra-skeleton')).to.not.exist;
  expect(el.shadowRoot!.querySelector('canvas')).to.exist;
});

it('renders a canvas and builds a Chart.js instance once chart.js loads', async () => {
  const el = (await fixture(html`<lyra-chart></lyra-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = ['Jan', 'Feb', 'Mar'];
  el.datasets = [{ label: 'Revenue', data: [1, 2, 3] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const canvas = el.shadowRoot!.querySelector('canvas');
  expect(canvas).to.exist;
});

it('updates in place (same Chart instance) when only data changes', async () => {
  const el = (await fixture(html`<lyra-chart></lyra-chart>`)) as LyraChart;
  el.type = 'bar';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const instance = (el as any).chart;
  el.datasets = [{ label: 'x', data: [3, 4] }];
  await el.updateComplete;
  expect((el as any).chart).to.equal(instance);
});

it('rebuilds (new Chart instance) when type changes', async () => {
  const el = (await fixture(html`<lyra-chart></lyra-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const instance = (el as any).chart;
  el.type = 'bar';
  await el.updateComplete;
  await waitUntil(() => (el as any).chart !== instance);
});

it('exposes role=img with a dataset-label-derived aria-label', async () => {
  const el = (await fixture(html`<lyra-chart></lyra-chart>`)) as LyraChart;
  el.datasets = [{ label: 'Revenue', data: [1] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const canvas = el.shadowRoot!.querySelector('canvas')!;
  expect(canvas.getAttribute('role')).to.equal('img');
  expect(canvas.getAttribute('aria-label')).to.contain('Revenue');
});

it('exposes part="canvas" on the canvas element, matching the documented @csspart surface', async () => {
  const el = (await fixture(html`<lyra-chart></lyra-chart>`)) as LyraChart;
  el.datasets = [{ label: 'Revenue', data: [1] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const canvas = el.shadowRoot!.querySelector('canvas')!;
  expect(canvas.getAttribute('part')).to.equal('canvas');
});

it('is accessible', async () => {
  const el = (await fixture(html`<lyra-chart></lyra-chart>`)) as LyraChart;
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  await expect(el).to.be.accessible();
});

it('deep-merges the raw `config` passthrough over the generated options, keeping ungiven generated fields', async () => {
  const el = (await fixture(html`<lyra-chart></lyra-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  el.config = { options: { animation: false as never } };
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const config = (el as any).buildConfig();
  // config.options wins over the generated value for keys it sets...
  expect(config.options.animation).to.equal(false);
  // ...while generated option keys `config.options` doesn't touch survive.
  expect(config.options.responsive).to.equal(true);
  expect(config.options.maintainAspectRatio).to.equal(false);
});

it('rebuilds when `config.type` overrides the effective type even though the `type` prop is unchanged', async () => {
  const el = (await fixture(html`<lyra-chart></lyra-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const instance = (el as any).chart;
  expect(instance.config.type).to.equal('line');

  // `type` prop stays 'line', but `config.type` overrides the effective
  // Chart.js type — draw() must rebuild rather than mutate-in-place, since
  // the previously built chart is a 'line' chart and the new effective type
  // is 'bar'.
  el.config = { type: 'bar' as never };
  await el.updateComplete;
  await waitUntil(() => (el as any).chart !== instance);
  expect((el as any).chart.config.type).to.equal('bar');
});

it('updates in place when neither `type` nor the effective `config.type` changes', async () => {
  const el = (await fixture(html`<lyra-chart></lyra-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  el.config = { type: 'line' as never };
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const instance = (el as any).chart;
  el.datasets = [{ label: 'x', data: [5, 6] }];
  await el.updateComplete;
  expect((el as any).chart).to.equal(instance);
});

it('lets `config.data` override generated data while the Chart instance picks up the override', async () => {
  const el = (await fixture(html`<lyra-chart></lyra-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  el.config = { data: { labels: ['Override'] as never } };
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const config = (el as any).buildConfig();
  expect(config.data.labels).to.deep.equal(['Override']);
  expect((el as any).chart.data.labels).to.deep.equal(['Override']);
});

it('deep-merges a nested `config.options` key without clobbering the rest of the generated sibling object', async () => {
  const el = (await fixture(html`<lyra-chart></lyra-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = ['A', 'B'];
  el.yLabel = 'Revenue';
  el.datasets = [{ label: 'x', data: [1, 2] }];
  // Only sets `scales.y.min` — the rest of the generated `y` axis config
  // (`beginAtZero`, `title`) must survive, and the generated `x`/`plugins`
  // config must be untouched.
  el.config = { options: { scales: { y: { min: 0 as never } } } };
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const config = (el as any).buildConfig();
  expect(config.options.scales.y.min).to.equal(0);
  expect(config.options.scales.y.beginAtZero).to.equal(true);
  expect(config.options.scales.y.title).to.deep.equal({ display: true, text: 'Revenue' });
  expect(config.options.scales.x.type).to.equal('category');
});

it('applies `height` as `--lyra-chart-height` on the host, not on the shadow-tree [part=base] div', async () => {
  const el = (await fixture(html`<lyra-chart height="500px"></lyra-chart>`)) as LyraChart;
  await el.updateComplete;
  expect(el.style.getPropertyValue('--lyra-chart-height').trim()).to.equal('500px');
  expect(getComputedStyle(el).height).to.equal('500px');

  el.height = '640px';
  await el.updateComplete;
  expect(el.style.getPropertyValue('--lyra-chart-height').trim()).to.equal('640px');
  expect(getComputedStyle(el).height).to.equal('640px');
});
