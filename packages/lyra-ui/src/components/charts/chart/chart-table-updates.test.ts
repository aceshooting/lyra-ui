import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import { LyraChart, type LyraChartFormatter } from './chart.js';

async function tableChart(formatter?: LyraChartFormatter): Promise<LyraChart> {
  const chart = await fixture<LyraChart>(html`<lr-chart
    without-animation without-legend with-data-table
    .labels=${['First', 'Second']}
    .datasets=${[{ label: 'Series', data: [10, 20] }]}
    .formatter=${formatter}
  ></lr-chart>`);
  await waitUntil(() => chart.chart !== undefined);
  await aTimeout(0);
  await chart.updateComplete;
  return chart;
}

describe('chart accessible table updates', () => {
  it('announces native keyboard navigation without reformatting unchanged table rows', async () => {
    let tableCalls = 0;
    let summaryCalls = 0;
    let spokenCalls = 0;
    let unit = 'units';
    const chart = await tableChart(({ value, surface, statistic }) => {
      if (surface === 'table') tableCalls++;
      if (surface === 'spoken' && statistic !== undefined) summaryCalls++;
      if (surface === 'spoken' && statistic === undefined) spokenCalls++;
      return `${value} ${unit}`;
    });
    const canvas = chart.shadowRoot!.querySelector('canvas')!;
    await focusByKeyboard(canvas);
    await chart.updateComplete;
    tableCalls = summaryCalls = spokenCalls = 0;
    await sendKeys({ press: 'ArrowRight' });
    await chart.updateComplete;
    expect(tableCalls).to.equal(0);
    expect(spokenCalls).to.equal(1);
    expect(summaryCalls).to.equal(2);
    expect(chart.shadowRoot!.activeElement === canvas).to.equal(true);
    await waitUntil(() => chart.ownerDocument.querySelector(
      `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`,
    )?.textContent?.includes('20 units') === true);
    const details: unknown[] = [];
    chart.addEventListener('lr-point-activate', (event) => details.push(event.detail));
    await sendKeys({ press: 'Enter' });
    expect(details).to.deep.equal([{ datasetIndex: 0, index: 1, label: 'Second', value: 20 }]);

    // An explicit refresh in the same event still updates captured formatter state.
    chart.addEventListener('keydown', () => {
      unit = 'updated';
      chart.requestUpdate();
    }, { once: true });
    await sendKeys({ press: 'ArrowLeft' });
    await chart.updateComplete;
    expect(chart.shadowRoot!.querySelector('tbody button')?.textContent).to.equal('10 updated');
    chart.addEventListener('keydown', () => {
      chart.datasets = [{ label: 'Replacement', data: [30, 40] }];
      chart.withDataTable = false;
    }, { once: true });
    await sendKeys({ press: 'ArrowRight' });
    await chart.updateComplete;
    expect(chart.shadowRoot!.querySelector('tbody button')?.textContent).to.equal('30 updated');
    expect(chart.shadowRoot!.querySelector('tbody button')?.getAttribute('tabindex')).to.equal('-1');
  });

  it('updates its caption without reformatting unchanged rows or disturbing keyboard activation', async () => {
    let calls = 0;
    const chart = await tableChart(({ value, surface }) => {
      if (surface === 'table') calls++;
      return String(value);
    });
    const button = chart.shadowRoot!.querySelector<HTMLButtonElement>('tbody button')!;
    await focusByKeyboard(button);
    calls = 0;
    chart.label = 'Updated chart';
    await chart.updateComplete;
    expect(calls).to.equal(0);
    expect(chart.shadowRoot!.querySelector('caption')?.textContent).to.equal('Updated chart');
    chart.description = 'Updated description';
    await chart.updateComplete;
    expect(calls).to.equal(0);
    expect(chart.shadowRoot!.querySelector('[part="description"]')?.textContent)
      .to.equal('Updated description');
    expect(chart.shadowRoot!.activeElement === button).to.equal(true);
    const details: unknown[] = [];
    chart.addEventListener('lr-point-activate', (event) => details.push(event.detail));
    await sendKeys({ press: 'Enter' });
    expect(details).to.deep.equal([{ datasetIndex: 0, index: 0, label: 'First', value: 10 }]);
  });

  it('refreshes formatter closure state on an explicit update and formatter replacement', async () => {
    let unit = 'old';
    const chart = await tableChart(({ value }) => `${value} ${unit}`);
    chart.label = 'Updated chart';
    await chart.updateComplete;
    unit = 'new';
    chart.requestUpdate();
    await chart.updateComplete;
    expect(chart.shadowRoot!.querySelector('tbody button')?.textContent).to.equal('10 new');
    unit = 'coalesced';
    chart.label = 'Another caption';
    chart.requestUpdate();
    await chart.updateComplete;
    expect(chart.shadowRoot!.querySelector('tbody button')?.textContent).to.equal('10 coalesced');
    chart.formatter = ({ value }) => `Replacement ${value}`;
    await chart.updateComplete;
    expect(chart.shadowRoot!.querySelector('tbody button')?.textContent).to.equal('Replacement 10');
  });

  it('retains the assigned data snapshot until a new data assignment', async () => {
    const chart = await tableChart();
    const values = [30];
    chart.datasets = [{ label: 'Snapshot', data: values }];
    await chart.updateComplete;
    values[0] = 40;
    chart.requestUpdate();
    await chart.updateComplete;
    expect(chart.shadowRoot!.querySelector('tbody button')?.textContent).to.equal('30');
    chart.label = 'Replacement snapshot';
    chart.datasets = [{ label: 'Snapshot', data: values }];
    await chart.updateComplete;
    expect(chart.shadowRoot!.querySelector('tbody button')?.textContent).to.equal('40');
  });

  it('refreshes rows, formatter axes and visibility after a caption update', async () => {
    const chart = await tableChart(({ value, axis }) => `${axis}:${value}`);
    chart.label = 'Updated chart';
    await chart.updateComplete;
    chart.datasets = [{ label: 'Replacement', data: [30], axis: 'y2' }];
    chart.labels = ['Third'];
    await chart.updateComplete;
    expect(chart.shadowRoot!.querySelector('tbody th')?.textContent).to.equal('Third');
    expect(chart.shadowRoot!.querySelector('tbody button')?.textContent).to.equal('y2:30');
    chart.indexAxis = 'y';
    chart.withDataTable = false;
    await chart.updateComplete;
    expect(chart.shadowRoot!.querySelector('tbody button')?.textContent).to.equal('x:30');
    expect(chart.shadowRoot!.querySelector('tbody button')?.getAttribute('tabindex')).to.equal('-1');
    expect(chart.shadowRoot!.querySelectorAll('tbody tr')).to.have.length(1);
    chart.type = 'pie';
    await chart.updateComplete;
    expect(chart.shadowRoot!.querySelector('tbody button')?.textContent).to.equal('undefined:30');
  });

  it('refreshes localized point text and direction after a caption update', async () => {
    const chart = await tableChart();
    chart.type = 'scatter';
    chart.labels = [];
    chart.datasets = [{ label: 'Points', points: [{ x: 1, y: 2 }] }];
    await chart.updateComplete;
    chart.label = 'Updated points';
    await chart.updateComplete;
    chart.strings = { chartPointCoordinates: 'Horizontal {x}; vertical {y}' };
    chart.setAttribute('dir', 'rtl');
    await chart.updateComplete;
    expect(chart.shadowRoot!.querySelector('tbody button')?.textContent)
      .to.equal('Horizontal 1; vertical 2');
    expect(chart.shadowRoot!.querySelectorAll('tbody button .bidi')).to.have.length(1);
  });

  it('retains complete totals for hidden series and refreshes the stacked axis configuration', async () => {
    const chart = await tableChart();
    chart.stacked = true;
    chart.stackTotals = true;
    chart.datasets = [
      { label: 'One', data: [10, 20] },
      { label: 'Two', data: [30, 40] },
    ];
    await chart.updateComplete;
    chart.label = 'Updated stacks';
    await chart.updateComplete;
    expect(chart.shadowRoot!.querySelector('tbody tr td:last-child')?.textContent).to.equal('40');
    chart.hiddenDatasets = [1];
    await chart.updateComplete;
    expect(chart.shadowRoot!.querySelector('tbody tr td:last-child')?.textContent).to.equal('40');
    chart.stackedAxes = { y: false };
    await chart.updateComplete;
    expect(chart.shadowRoot!.querySelectorAll('tbody tr:first-child td')).to.have.length(2);
  });
});
