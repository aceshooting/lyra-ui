import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraChart } from './chart.class.js';
import './chart.js';

it('bounds deep raw options while preserving sibling axes and opaque plugin identity', async () => {
  let deep: Record<string, unknown> = { unsupportedDepth: true };
  for (let index = 0; index < 40; index += 1) deep = { nested: deep };
  const plugin = { id: 'bounded-options-witness' };
  const element = await fixture<LyraChart>(html`<lr-chart without-animation with-data-table
    .config=${{ options: { scales: { y: { min: 0 } }, deep }, plugins: [null, 3, 'invalid', plugin],
      data: { labels: ['North'], datasets: [{ label: 'Visits', data: [7] }] } }}></lr-chart>`);
  await element.updateComplete;
  expect(element.config?.plugins).to.deep.equal([plugin]);
  expect(element.config?.plugins?.[0] === plugin).to.equal(true);
  const options = element.config?.options as { scales?: { y?: { min?: number } }; deep?: unknown };
  expect(options.scales?.y?.min).to.equal(0);
  let value: unknown = options.deep;
  let depth = 0;
  while (value && typeof value === 'object' && Object.hasOwn(value, 'nested')) {
    value = (value as Record<string, unknown>)['nested'];
    depth += 1;
  }
  expect(depth).to.be.lessThan(40);
  await waitUntil(() => element.shadowRoot!.querySelector('table')?.textContent?.includes('7') === true);
  expect(element.shadowRoot!.querySelector('table')?.textContent).to.include('Visits');
});

it('rejects revoked and reflective configuration inputs while retaining usable series siblings', async () => {
  const element = await fixture<LyraChart>(html`<lr-chart without-animation with-data-table></lr-chart>`);
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  const hostile = new Proxy({}, { ownKeys() { throw new Error('caller reflection denied'); } });
  element.config = revoked.proxy as LyraChart['config'];
  expect(element.config).to.equal(undefined);
  element.config = { options: hostile };
  expect(element.config?.options).to.equal(undefined);
  element.datasets = [revoked.proxy, { label: 'Safe series', data: [12] }] as LyraChart['datasets'];
  element.labels = ['Safe label'];
  await element.updateComplete;
  expect(element.datasets.length).to.equal(1);
  expect(element.datasets[0]?.label).to.equal('Safe series');
  await waitUntil(() => element.shadowRoot!.querySelector('table')?.textContent?.includes('12') === true);
  expect(element.shadowRoot!.querySelector('table')?.textContent).to.include('Safe label');
});

it('keeps raw options and every data point when config.data outgrows the options bound', () => {
  const element = document.createElement('lr-chart') as LyraChart;
  const points = (offset: number) => Array.from({ length: 4_000 }, (_, index) => offset + index);
  element.config = {
    type: 'line',
    data: {
      labels: Array.from({ length: 4_000 }, (_, index) => `t${index}`),
      datasets: [
        { label: 'A', data: points(0) },
        { label: 'B', data: points(10_000) },
        { label: 'C', data: points(20_000) },
      ],
    },
    options: { plugins: { title: { display: true, text: 'Caller title' } }, scales: { y: { min: -5 } } },
  };
  const options = element.config?.options as {
    plugins?: { title?: { text?: string } };
    scales?: { y?: { min?: number } };
  } | undefined;
  expect(options?.plugins?.title?.text).to.equal('Caller title');
  expect(options?.scales?.y?.min).to.equal(-5);
  const datasets = element.config?.data?.datasets ?? [];
  expect(datasets.length).to.equal(3);
  expect((datasets[2]!.data as unknown[]).at(-1)).to.equal(23_999);
  expect((datasets[2]!.data as unknown[]).includes(undefined)).to.equal(false);
});
