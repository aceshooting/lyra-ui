import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { Chart } from 'chart.js';
import type { LyraChart, LyraChartFormatterContext } from './chart.class.js';
import './chart.js';

it('owns primitive and multiline raw dataset labels while retaining detached data-level extension fields', async () => {
  const extension = { retained: true };
  const multiline = ['Revenue', , 'North'];
  const el = await fixture<LyraChart>(html`<lr-chart without-animation with-data-table .config=${{
    data: { labels: ['Q1'], extension, datasets: [
      { label: 7, data: [1] }, { label: false, data: [2] }, { label: 8n, data: [3] },
      { label: multiline, data: [4] }, { label: {}, data: [5] },
    ] },
  }}></lr-chart>`);
  await el.updateComplete;
  const datasets = el.config?.data?.datasets;
  expect(datasets?.[0]?.label).to.equal(7);
  expect(datasets?.[1]?.label).to.equal(false);
  expect(datasets?.[2]?.label).to.equal(8n);
  expect((el.config?.data as unknown as Record<string, unknown>)['extension']).to.deep.equal({ retained: true });
  extension.retained = false;
  expect(((el.config?.data as unknown as Record<string, unknown>)['extension'] as { retained: boolean }).retained).to.equal(true);
  multiline[0] = 'Changed';
  await waitUntil(() => el.shadowRoot!.querySelector('table') !== null);
  expect(el.shadowRoot!.querySelector('table')!.textContent).to.include('Revenue  North');
  expect(el.shadowRoot!.querySelector('table')!.textContent).to.include('7');
  expect(el.shadowRoot!.querySelector('table')!.textContent).to.include('false');
});

it('supplies original extreme slice values to the peer tooltip title and footer callbacks', async () => {
  const seen: LyraChartFormatterContext[][] = [];
  const formatter = (items: readonly LyraChartFormatterContext[]): string => {
    seen.push([...items]);
    return 'Original values';
  };
  const el = await fixture<LyraChart>(html`<lr-chart type="pie" without-animation
    .labels=${['North', 'South']} .datasets=${[{ label: 'Sales', data: [Number.MAX_VALUE, Number.MAX_VALUE] }]}
    .tooltipTitleFormatter=${formatter} .tooltipFooterFormatter=${formatter}></lr-chart>`);
  const runtime = (): Chart | undefined => (el as unknown as { chart?: Chart }).chart;
  await waitUntil(() => runtime() !== undefined);
  const chart = runtime()!;
  const callbacks = chart.options.plugins?.tooltip?.callbacks as unknown as {
    title(items: unknown[]): string;
    footer(items: unknown[]): string;
  };
  const item = { datasetIndex: 0, dataIndex: 1, parsed: 1, raw: 1, dataset: chart.data.datasets[0] };
  expect(callbacks.title([item])).to.equal('Original values');
  expect(callbacks.footer([item])).to.equal('Original values');
  expect(seen.map((items) => items[0]?.value)).to.deep.equal([Number.MAX_VALUE, Number.MAX_VALUE]);
  expect(seen[0]?.[0]?.label).to.equal('South');
});

it('contains a peer hit-testing failure without emitting an activation and recovers for the next click', async () => {
  const el = await fixture<LyraChart>(html`<lr-chart without-animation .labels=${['North']} .datasets=${[{ label: 'Sales', data: [4] }]}></lr-chart>`);
  const runtime = (): Chart | undefined => (el as unknown as { chart?: Chart }).chart;
  await waitUntil(() => runtime() !== undefined);
  const chart = runtime()!;
  const original = chart.getElementsAtEventForMode;
  let activations = 0;
  el.addEventListener('lr-datum-activate', () => { activations += 1; });
  const click = (): void => {
    chart.options.onClick?.call(chart, { type: 'click', x: 50, y: 50, native: new MouseEvent('click') }, [], chart);
  };
  try {
    chart.getElementsAtEventForMode = (): never => { throw new Error('hit test unavailable'); };
    click();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(activations).to.equal(0);
    chart.getElementsAtEventForMode = () => [{ datasetIndex: 0, index: 0 }] as ReturnType<Chart['getElementsAtEventForMode']>;
    click();
    await waitUntil(() => activations === 1);
  } finally { chart.getElementsAtEventForMode = original; }
});

it('fails revoked series arrays and unavailable configuration prototypes closed and recovers through fresh data', async () => {
  const el = await fixture<LyraChart>(html`<lr-chart without-animation with-data-table .labels=${['North']} .datasets=${[{ label: 'Sales', data: [4] }]}></lr-chart>`);
  const revoked = Proxy.revocable([], {});
  revoked.revoke();
  el.datasets = revoked.proxy;
  expect(el.datasets.length).to.equal(0);
  const config = new Proxy({}, {
    getPrototypeOf(): never { throw new Error('prototype unavailable'); },
  });
  el.config = config;
  expect(el.config).to.equal(undefined);
  el.datasets = [{ label: 'Recovered', data: [9] }];
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('table')?.textContent?.includes('Recovered') === true);
  expect(el.shadowRoot!.querySelector('table')?.textContent).to.include('9');
});

for (const type of ['pie', 'doughnut'] as const) {
  it(`preserves gaps and original tooltip values while scaling extreme ${type} slices and returning to ordinary values`, async () => {
    const contexts: LyraChartFormatterContext[] = [];
    const formatter = (context: LyraChartFormatterContext): string => {
      contexts.push(context);
      return `value=${context.value}`;
    };
    const el = await fixture<LyraChart>(html`<lr-chart type=${type} without-animation with-data-table
      .labels=${['North', 'Missing', 'South']}
      .datasets=${[{ label: 'Sales', data: [Number.MAX_VALUE, null, Number.MAX_VALUE / 2] }]}
      .formatter=${formatter}></lr-chart>`);
    await waitUntil(() => el.chart !== undefined, 'slice chart drawn');
    const chart = el.chart as unknown as Chart;
    expect(chart.data.datasets[0]!.data).to.deep.equal([1, null, 0.5]);
    const label = () => chart.options.plugins!.tooltip!.callbacks!.label as unknown as (item: unknown) => string;
    contexts.length = 0;
    expect(label()({ datasetIndex: 0, dataIndex: 2, parsed: 0.5, raw: 0.5, dataset: chart.data.datasets[0] }))
      .to.include(`value=${Number.MAX_VALUE / 2}`);
    expect(contexts[0]?.value).to.equal(Number.MAX_VALUE / 2);
    expect(contexts[0]?.label).to.equal('South');
    expect(el.datasets[0]!.data).to.deep.equal([Number.MAX_VALUE, null, Number.MAX_VALUE / 2]);

    el.datasets = [{ label: 'Sales', data: [8, null, 4] }];
    await el.updateComplete;
    await waitUntil(() => chart.data.datasets[0]!.data[0] === 8, 'ordinary values replace scaled geometry');
    expect(chart.data.datasets[0]!.data).to.deep.equal([8, null, 4]);
    contexts.length = 0;
    expect(label()({ datasetIndex: 0, dataIndex: 2, parsed: 4, raw: 4, dataset: chart.data.datasets[0] })).to.include('value=4');
    expect(contexts[0]?.value).to.equal(4);
    expect(el.chart === (chart as unknown)).to.equal(true);
  });
}
