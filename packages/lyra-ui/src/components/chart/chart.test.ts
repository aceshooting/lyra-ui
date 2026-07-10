import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './chart.js';
import type { LyraChart } from './chart.js';

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
  const canvas = el.shadowRoot!.querySelector('canvas')!;
  expect(canvas.getAttribute('role')).to.equal('img');
  expect(canvas.getAttribute('aria-label')).to.contain('Revenue');
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
