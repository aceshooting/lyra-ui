import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { Chart } from 'chart.js';
import type { LyraBoxPlot, LyraBoxPlotSeries } from './box-plot.class.js';
import './box-plot.js';

const point = { min: 1, q1: 2, median: 3, q3: 4, max: 5 };

async function mounted(): Promise<LyraBoxPlot> {
  const element = await fixture<LyraBoxPlot>(html`<lr-box-plot with-data-table
    style="inline-size:500px;block-size:260px" .labels=${['Only']}
    .datasets=${[{ label: 'Retained', data: [point] }]}></lr-box-plot>`);
  await waitUntil(() => {
    const canvas = element.shadowRoot!.querySelector('canvas');
    return canvas !== null && Chart.getChart(canvas) !== undefined;
  }, 'box plot peer did not mount', { timeout: 5_000 });
  await element.updateComplete;
  return element;
}

function geometry(element: LyraBoxPlot): { borderWidth: number; itemRadius: number } {
  const canvas = element.shadowRoot!.querySelector('canvas');
  const chart = canvas ? Chart.getChart(canvas) : undefined;
  if (!chart?.options.elements) throw new Error('Box plot geometry missing');
  return Reflect.get(chart.options.elements, 'boxandwhiskers') as { borderWidth: number; itemRadius: number };
}

for (const value of ['auto', '-2px']) {
  it(`uses finite default box geometry for the invalid ${value} token and recovers explicit lengths`, async () => {
    const element = await mounted();
    const initial = geometry(element);
    const before = { borderWidth: initial.borderWidth, itemRadius: initial.itemRadius };
    expect(Number.isFinite(before.borderWidth) && before.borderWidth >= 0).to.equal(true);
    expect(Number.isFinite(before.itemRadius) && before.itemRadius >= 0).to.equal(true);
    element.style.setProperty('--lr-box-plot-border-width', value);
    element.style.setProperty('--lr-box-plot-item-radius', value);
    element.refreshTheme();
    await element.updateComplete;
    await waitUntil(() => geometry(element).borderWidth === before.borderWidth && geometry(element).itemRadius === before.itemRadius);
    expect(element.exportData('csv')).to.include('Only,Retained,1,2,3,4,5');
    element.style.setProperty('--lr-box-plot-border-width', '3px');
    element.style.setProperty('--lr-box-plot-item-radius', '5px');
    element.refreshTheme();
    await element.updateComplete;
    await waitUntil(() => geometry(element).borderWidth === 3 && geometry(element).itemRadius === 5);
    expect(element.shadowRoot!.querySelector('table')?.textContent).to.include('Retained');
  });
}

it('drops malformed public dataset collections and recovers visible summaries after a valid reassignment', async () => {
  const element = await mounted();
  const revoked = Proxy.revocable([], {});
  revoked.revoke();
  for (const candidate of [null, { length: 1 }, revoked.proxy]) {
    Reflect.set(element, 'datasets', candidate);
    await element.updateComplete;
    expect(element.datasets).to.deep.equal([]);
    expect(element.exportData('csv')).to.equal('category,series,min,q1,median,q3,max');
    expect(element.shadowRoot!.querySelector('tbody')?.querySelectorAll('tr').length ?? 0).to.equal(0);
  }
  element.datasets = [{ label: 'Recovered', data: [point] }];
  await element.updateComplete;
  expect(element.exportData('csv')).to.include('Only,Recovered,1,2,3,4,5');
  expect(element.shadowRoot!.querySelector('table')?.textContent).to.include('Recovered');
});

it('keeps source and owned-snapshot dataset rebinds inert until a new collection is supplied', async () => {
  const element = await mounted();
  const source: LyraBoxPlotSeries[] = [{ label: 'Original', data: [point] }];
  element.datasets = source;
  await element.updateComplete;
  const held = element.datasets;
  const before = element.exportData('csv');
  source.push({ label: 'Later', data: [point] });
  element.datasets = source;
  element.datasets = held;
  expect(element.datasets === held).to.equal(true);
  expect(element.exportData('csv')).to.equal(before);
  element.datasets = [...source];
  await element.updateComplete;
  expect(element.datasets === held).to.equal(false);
  expect(element.datasets.length).to.equal(2);
  expect(element.exportData('csv')).to.include('Only,Later,1,2,3,4,5');
  expect(element.shadowRoot!.querySelector('table')?.textContent).to.include('Later');
});
