import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';
import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { LyraLiteChart, type LyraLiteChartTableCellFormatter } from './lite-chart.js';

expectLocaleFallback('de-DE', ['chart', 'chartCategory', 'chartData', 'chartSeriesLabel', 'liteChartBarLabel', 'liteChartMarkSummary']);

async function mount(tableCellFormatter?: LyraLiteChartTableCellFormatter): Promise<LyraLiteChart> {
  const chart = await fixture<LyraLiteChart>(html`<lr-lite-chart type="bar" with-data-table
    .labels=${['First', 'Second']}
    .datasets=${[{ label: 'A', data: [10, 20] }, { label: 'B', data: [30, 40] }]}
    .tableCellFormatter=${tableCellFormatter}
  ></lr-lite-chart>`);
  await aTimeout(50);
  await chart.updateComplete;
  return chart;
}

describe('lite-chart accessible table updates', () => {
  it('announces and activates native keyboard navigation without reformatting the table', async () => {
    let calls = 0;
    let unit = 'units';
    const chart = await mount((value) => { calls++; return `${value} ${unit}`; });
    const marks = () => chart.shadowRoot!.querySelectorAll<SVGElement>('[part="bar"]');
    await focusByKeyboard(marks()[0]! as unknown as HTMLElement);
    await chart.updateComplete;
    const firstRow = chart.shadowRoot!.querySelector('tbody tr');
    calls = 0;
    await sendKeys({ press: 'ArrowRight' });
    await chart.updateComplete;
    await waitUntil(() => chart.shadowRoot!.activeElement === marks()[1]);
    expect(calls).to.equal(0);
    expect(chart.shadowRoot!.querySelector('tbody tr') === firstRow).to.equal(true);
    expect(marks()[1]?.getAttribute('tabindex')).to.equal('0');
    await waitUntil(() => chart.shadowRoot!.querySelector('[part="live-region"]')?.shadowRoot
      ?.querySelector('[part="region"]')?.textContent?.includes('2 of 4') === true);
    const details: unknown[] = [];
    chart.addEventListener('lr-point-activate', (event) => details.push(event.detail));
    await sendKeys({ press: 'Enter' });
    expect(details).to.deep.equal([{ datasetIndex: 1, index: 0, label: 'First', value: 30 }]);
    chart.addEventListener('keydown', () => { unit = 'updated'; chart.requestUpdate(); }, { once: true });
    await sendKeys({ press: 'ArrowLeft' });
    await chart.updateComplete;
    expect(chart.shadowRoot!.querySelector('tbody td')?.textContent).to.equal('10 updated');
    chart.addEventListener('keydown', () => {
      chart.datasets = [{ label: 'A', data: [10, 20] }, { label: 'Changed', data: [90, 40] }];
    }, { once: true });
    await sendKeys({ press: 'ArrowRight' });
    await chart.updateComplete;
    expect(chart.shadowRoot!.querySelector('tbody tr td:last-child')?.textContent).to.equal('90 updated');
    await sendKeys({ press: 'Enter' });
    expect(details[1]).to.deep.equal({ datasetIndex: 1, index: 0, label: 'First', value: 90 });
  });

  it('refreshes explicit formatter state and changes to data, totals and type', async () => {
    let unit = 'old';
    const chart = await mount((value) => `${value} ${unit}`);
    unit = 'new';
    chart.requestUpdate();
    await chart.updateComplete;
    expect(chart.shadowRoot!.querySelector('tbody td')?.textContent).to.equal('10 new');
    chart.stacked = true;
    chart.tableTotals = true;
    chart.labels = ['Replacement'];
    chart.datasets = [{ label: 'C', data: [5] }, { label: 'D', data: [7] }];
    chart.tableCellFormatter = (value, context) => `${context.kind}:${value}`;
    await chart.updateComplete;
    expect(chart.shadowRoot!.querySelector('tbody th')?.textContent).to.equal('Replacement');
    expect([...chart.shadowRoot!.querySelectorAll('tbody td')].map((cell) => cell.textContent))
      .to.deep.equal(['value:5', 'value:7', 'total:12']);
    chart.type = 'line';
    await chart.updateComplete;
    expect(chart.shadowRoot!.querySelectorAll('tbody td').length).to.equal(2);
  });

  it('refreshes direction, headings and table visibility', async () => {
    const chart = await mount();
    chart.dir = 'rtl';
    chart.strings = { chartCategory: 'Category heading', chartData: 'Values' };
    chart.withDataTable = false;
    await chart.updateComplete;
    expect(chart.shadowRoot!.querySelector('caption')?.textContent).to.equal('Values');
    expect(chart.shadowRoot!.querySelector('thead th')?.textContent).to.equal('Category heading');
    expect(chart.shadowRoot!.querySelectorAll('tbody .bidi').length).to.be.greaterThan(0);
    expect(chart.shadowRoot!.querySelector('table')?.classList.contains('sr-only')).to.equal(true);
  });
  it('refreshes numeric formatting when the locale changes', async () => {
    const chart = await mount();
    chart.datasets = [{ label: 'A', data: [1.5] }, { label: 'B', data: [2] }];
    await chart.updateComplete;
    expect(chart.shadowRoot!.querySelector('tbody td')?.textContent).to.equal('1.5');
    chart.locale = 'de-DE';
    await chart.updateComplete;
    expect(chart.shadowRoot!.querySelector('tbody td')?.textContent).to.equal('1,5');
  });

  it('refreshes single-series list formatter closure state on a bare update', async () => {
    let unit = 'old';
    const chart = await mount();
    chart.datasets = [{ label: 'Series', data: [10, 20] }];
    chart.formatter = ({ value }) => `${value} ${unit}`;
    await chart.updateComplete;
    expect(chart.shadowRoot!.querySelector('[part="data-list"] li')?.textContent).to.contain('10 old');
    unit = 'new';
    chart.requestUpdate();
    await chart.updateComplete;
    expect(chart.shadowRoot!.querySelector('[part="data-list"] li')?.textContent).to.contain('10 new');
    await focusByKeyboard(chart.shadowRoot!.querySelector('[part="bar"]')! as unknown as HTMLElement);
    await chart.updateComplete;
    chart.addEventListener('keydown', () => { unit = 'coalesced'; chart.requestUpdate(); }, { once: true });
    await sendKeys({ press: 'ArrowRight' });
    await chart.updateComplete;
    expect(chart.shadowRoot!.querySelector('[part="data-list"] li')?.textContent).to.contain('10 coalesced');
  });

});
