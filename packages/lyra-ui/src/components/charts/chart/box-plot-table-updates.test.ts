import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';
import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import { LyraBoxPlot } from './box-plot.js';
import type { LyraChartFormatter } from './chart.js';

expectLocaleFallback('de-DE', ['boxPlot', 'boxPlotData', 'boxPlotMax', 'boxPlotMedian', 'boxPlotMin', 'boxPlotQ1', 'boxPlotQ3', 'boxPlotSeriesSummary', 'boxPlotSummaryWithData', 'chartCategory', 'chartPointLabel', 'chartSeriesLabel', 'chartSummarySeparator', 'chartTrendFlat', 'chartTrendIncreasing', 'loading']);

const summary = { min: 1, q1: 2, median: 3, q3: 4, max: 5 };
async function mount(formatter?: LyraChartFormatter): Promise<LyraBoxPlot> {
  const chart = await fixture<LyraBoxPlot>(html`<lr-box-plot with-data-table
    .labels=${['First', 'Second']}
    .datasets=${[{ label: 'Series', data: [summary, { ...summary, max: 6 }] }]}
    .formatter=${formatter}
  ></lr-box-plot>`);
  await waitUntil(() => chart.shadowRoot!.querySelector('canvas') !== null, '', { timeout: 5000 });
  await aTimeout(0);
  await chart.updateComplete;
  return chart;
}

describe('box-plot accessible table updates', () => {
  it('announces and activates native keyboard navigation without reformatting the table', async () => {
    let calls = 0;
    let unit = 'units';
    const chart = await mount(({ value, surface }) => {
      if (surface === 'table') calls++;
      return `${value} ${unit}`;
    });
    const canvas = chart.shadowRoot!.querySelector('canvas')!;
    await focusByKeyboard(canvas);
    await chart.updateComplete;
    const firstRow = chart.shadowRoot!.querySelector('tbody tr');
    calls = 0;
    await sendKeys({ press: 'ArrowRight' });
    await chart.updateComplete;
    expect(calls).to.equal(0);
    expect(chart.shadowRoot!.querySelector('tbody tr') === firstRow).to.equal(true);
    expect(chart.shadowRoot!.activeElement === canvas).to.equal(true);
    await waitUntil(() => chart.ownerDocument.querySelector(
      `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`,
    )?.textContent?.includes('6 units') === true);
    const details: unknown[] = [];
    chart.addEventListener('lr-point-activate', (event) => details.push(event.detail));
    await sendKeys({ press: 'Enter' });
    expect(details).to.deep.equal([{ datasetIndex: 0, index: 1, label: 'Second', value: { ...summary, max: 6 } }]);
    chart.addEventListener('keydown', () => {
      unit = 'updated';
      chart.requestUpdate();
    }, { once: true });
    await sendKeys({ press: 'ArrowLeft' });
    await chart.updateComplete;
    expect(chart.shadowRoot!.querySelectorAll('tbody td')[1]?.textContent).to.equal('1 updated');
    chart.addEventListener('keydown', () => {
      chart.datasets = [{ label: 'Changed', data: [summary, { ...summary, max: 9 }] }];
    }, { once: true });
    await sendKeys({ press: 'ArrowRight' });
    await chart.updateComplete;
    expect(chart.shadowRoot!.querySelector('tbody tr:last-child td:last-child')?.textContent).to.equal('9 updated');
    await sendKeys({ press: 'Enter' });
    expect(details[1]).to.deep.equal({ datasetIndex: 0, index: 1, label: 'Second', value: { ...summary, max: 9 } });
  });

  it('refreshes formatter closures, data snapshots and formatter replacements explicitly', async () => {
    let unit = 'old';
    const chart = await mount(({ value }) => `${value} ${unit}`);
    unit = 'new';
    chart.requestUpdate();
    await chart.updateComplete;
    expect(chart.shadowRoot!.querySelectorAll('tbody td')[1]?.textContent).to.equal('1 new');
    chart.label = 'New caption';
    chart.labels = ['Replacement'];
    chart.datasets = [{ label: 'Updated', data: [{ min: 10, q1: 20, median: 30, q3: 40, max: 50 }] }];
    chart.formatter = ({ value }) => `Value ${value}`;
    await chart.updateComplete;
    expect(chart.shadowRoot!.querySelector('caption')?.textContent).to.equal('New caption');
    expect(chart.shadowRoot!.querySelector('tbody th')?.textContent).to.equal('Replacement');
    expect(chart.shadowRoot!.querySelectorAll('tbody td')[1]?.textContent).to.equal('Value 10');
    expect(chart.shadowRoot!.querySelectorAll('tbody tr').length).to.equal(1);
  });

  it('refreshes localized fallback labels, direction and visibility', async () => {
    const chart = await mount();
    chart.labels = [];
    chart.strings = { chartPointLabel: 'Item {n}' };
    chart.dir = 'rtl';
    chart.withDataTable = false;
    await chart.updateComplete;
    expect(chart.shadowRoot!.querySelector('tbody th')?.textContent).to.equal('Item 1');
    expect(chart.shadowRoot!.querySelectorAll('tbody .bidi').length).to.be.greaterThan(0);
    expect(chart.shadowRoot!.querySelector('table')?.classList.contains('sr-only')).to.equal(true);
  });
  it('refreshes numeric formatting when the locale changes', async () => {
    const chart = await mount();
    chart.datasets = [{ label: 'Series', data: [{ min: 1.5, q1: 2, median: 3, q3: 4, max: 5 }] }];
    await chart.updateComplete;
    expect(chart.shadowRoot!.querySelectorAll('tbody td')[1]?.textContent).to.equal('1.5');
    chart.locale = 'de-DE';
    await chart.updateComplete;
    expect(chart.shadowRoot!.querySelectorAll('tbody td')[1]?.textContent).to.equal('1,5');
  });

});
