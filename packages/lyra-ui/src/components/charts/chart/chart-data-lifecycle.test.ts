import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './chart.js';
import type { LyraChart } from './chart.class.js';

it('keeps the accessible data table current when a pie chart replaces its categories and values', async () => {
  const initialColors = ['red', 'blue'];
  const chart = await fixture<LyraChart>(html`<lr-chart
    type="pie" without-animation with-data-table
    .labels=${['North', 'South']}
    .datasets=${[{ label: 'Orders', data: [4, 6], color: initialColors }]}
  ></lr-chart>`);
  await waitUntil(() => chart.chart !== undefined, 'Chart.js initialized');
  await chart.updateComplete;

  chart.labels = ['East', 'West', 'Central'];
  const replacementColors: string[] = [];
  replacementColors[0] = 'red';
  replacementColors[2] = 'blue';
  chart.datasets = [{ label: 'Orders', data: [2, 5, 3], color: replacementColors }];
  await chart.updateComplete;
  await waitUntil(() => chart.shadowRoot!.querySelectorAll('tbody tr').length === 3);

  expect([...chart.shadowRoot!.querySelectorAll('tbody th')].map((cell) => cell.textContent?.trim()))
    .to.deep.equal(['East', 'West', 'Central']);
  expect([...chart.shadowRoot!.querySelectorAll('tbody button')].map((button) => button.textContent?.trim()))
    .to.deep.equal(['2', '5', '3']);
  expect([...chart.shadowRoot!.querySelectorAll('[part~="legend-item"]')].map((item) => item.textContent?.trim()))
    .to.deep.equal(['East', 'West', 'Central']);
  const swatches = [...chart.shadowRoot!.querySelectorAll<HTMLElement>('[part="legend-swatch"]')];
  expect(swatches.map((swatch) => getComputedStyle(swatch).backgroundColor)[0]).to.equal('rgb(255, 0, 0)');
  expect(getComputedStyle(swatches[1]!).backgroundColor, 'a missing category color uses the chart palette')
    .to.not.equal('rgba(0, 0, 0, 0)');
  expect(getComputedStyle(swatches[2]!).backgroundColor).to.equal('rgb(0, 0, 255)');
});
