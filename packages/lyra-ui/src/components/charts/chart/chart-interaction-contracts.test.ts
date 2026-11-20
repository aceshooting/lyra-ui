import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { prepareLyraSeriesData } from '../../../utilities/data-preparation.js';
import { setReducedMotion } from '../../../../test/wtr-media.js';
import '../../lr-chart.js';
import '../../lr-box-plot.js';
import '../../lr-lite-chart.js';
import type { LyraChart } from './chart.class.js';
import type { LyraBoxPlot } from './box-plot.class.js';
import type { LyraLiteChart } from './lite-chart.class.js';

function press(target: Element, repeat: boolean): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'Enter', repeat, bubbles: true, cancelable: true, composed: true });
  target.dispatchEvent(event);
  return event;
}

async function settledLite(template: ReturnType<typeof html>): Promise<LyraLiteChart> {
  const el = await fixture<LyraLiteChart>(template);
  await waitUntil(() => {
    const chart = el as unknown as { plotWidth: number; plotHeight: number };
    return chart.plotWidth > 0 && chart.plotHeight > 0;
  });
  await el.updateComplete;
  return el;
}

describe('held activation keys do not repeat activation', () => {
  it('lr-chart activates a datum once per press', async () => {
    const el = await fixture<LyraChart>(html`<lr-chart type="bar" without-animation .labels=${['A', 'B']}
      .datasets=${[{ label: 'S', data: [1, 2] }]}></lr-chart>`);
    await waitUntil(() => el.chart !== undefined, 'chart did not settle', { timeout: 5000 });
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas')!;
    const activations: string[] = [];
    el.addEventListener('lr-datum-activate', () => activations.push('datum'));
    press(canvas, false);
    press(canvas, true);
    press(canvas, true);
    expect(activations).to.have.length(1);
  });

  it('lr-box-plot activates a box once per press', async () => {
    const el = await fixture<LyraBoxPlot>(html`<lr-box-plot .labels=${['A']}
      .datasets=${[{ label: 'S', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }]}></lr-box-plot>`);
    await waitUntil(() => el.shadowRoot!.querySelector('canvas') !== null && (el as unknown as { chart?: unknown }).chart != null,
      'box plot did not settle', { timeout: 5000 });
    const canvas = el.shadowRoot!.querySelector('canvas')!;
    const activations: string[] = [];
    el.addEventListener('lr-datum-activate', () => activations.push('datum'));
    press(canvas, false);
    press(canvas, true);
    press(canvas, true);
    expect(activations).to.have.length(1);
  });

  it('lr-lite-chart activates a mark once per press', async () => {
    const el = await settledLite(html`<lr-lite-chart type="bar" style="inline-size:400px;block-size:200px"
      .labels=${['A', 'B']} .datasets=${[{ label: 'S', data: [1, 2] }]}></lr-lite-chart>`);
    await el.updateComplete;
    const mark = el.shadowRoot!.querySelector<SVGElement>('[part="bar"]')!;
    const activations: string[] = [];
    el.addEventListener('lr-point-activate', () => activations.push('point'));
    press(mark, false);
    press(mark, true);
    press(mark, true);
    expect(activations).to.have.length(1);
  });
});

describe('lr-chart reset-zoom button', () => {
  async function zoomed(): Promise<LyraChart> {
    const el = await fixture<LyraChart>(html`<lr-chart zoomable type="line" without-animation .labels=${['A', 'B']}
      .datasets=${[{ label: 'S', data: [1, 2] }]}></lr-chart>`);
    await waitUntil(() => el.chart != null, 'chart did not settle', { timeout: 5000 });
    (el as unknown as { zoomed: boolean }).zoomed = true;
    await el.updateComplete;
    return el;
  }

  it('meets the minimum hit area', async () => {
    const el = await zoomed();
    const button = el.shadowRoot!.querySelector<HTMLElement>('[part="reset-zoom-button"]')!;
    const minimum = parseFloat(getComputedStyle(button).minBlockSize);
    expect(minimum).to.be.greaterThan(0);
    expect(button.getBoundingClientRect().height).to.be.at.least(minimum - 0.5);
    expect(button.getBoundingClientRect().width).to.be.at.least(minimum - 0.5);
  });

  it('keeps keyboard focus inside the chart when activating it removes the button', async () => {
    const el = await zoomed();
    const button = el.shadowRoot!.querySelector<HTMLElement>('[part="reset-zoom-button"]')!;
    await focusByKeyboard(button);
    expect(el.shadowRoot!.activeElement === button).to.equal(true);
    button.click();
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="reset-zoom-button"]') === null);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(document.activeElement === el).to.equal(true);
    expect(el.shadowRoot!.activeElement?.localName).to.equal('canvas');
  });
});

describe('request listeners that change state do not receive stale commits', () => {
  it('lr-box-plot drops a legend toggle when a request listener replaces the data', async () => {
    const box = { min: 1, q1: 2, median: 3, q3: 4, max: 5 };
    const el = await fixture<LyraBoxPlot>(html`<lr-box-plot with-legend .labels=${['A']}
      .datasets=${[{ label: 'S', data: [box] }, { label: 'T', data: [box] }]}></lr-box-plot>`);
    await waitUntil(() => (el as unknown as { chart?: unknown }).chart != null, 'box plot did not settle', { timeout: 5000 });
    const changes: string[] = [];
    el.addEventListener('lr-legend-visibility-change', () => changes.push('changed'));
    el.addEventListener('lr-legend-visibility-change-request', () => {
      el.datasets = [{ label: 'U', data: [box] }];
    });
    (el as unknown as { toggleDataset(index: number): void }).toggleDataset(1);
    expect(changes).to.deep.equal([]);
    expect(el.hiddenDatasets ?? []).to.deep.equal([]);
  });

  it('lr-box-plot emits no point event after a datum listener removes it', async () => {
    const box = { min: 1, q1: 2, median: 3, q3: 4, max: 5 };
    const el = await fixture<LyraBoxPlot>(html`<lr-box-plot .labels=${['A']}
      .datasets=${[{ label: 'S', data: [box] }]}></lr-box-plot>`);
    const points: string[] = [];
    el.addEventListener('lr-point-activate', () => points.push('point'));
    el.addEventListener('lr-datum-activate', () => el.remove());
    (el as unknown as { activateBox(value: unknown): void }).activateBox({ datasetIndex: 0, index: 0, label: 'A', value: box });
    expect(points).to.deep.equal([]);
  });

  it('lr-lite-chart stops after a datum listener removes the chart', async () => {
    const el = await settledLite(html`<lr-lite-chart type="bar" style="inline-size:400px;block-size:200px"
      .labels=${['A', 'B']} .datasets=${[{ label: 'S', data: [1, 2] }]}></lr-lite-chart>`);
    await el.updateComplete;
    const events: string[] = [];
    el.addEventListener('lr-datum-activate', () => events.push('datum'));
    el.addEventListener('lr-point-activate', () => events.push('point'));
    el.addEventListener('lr-datum-activate', () => el.remove());
    el.shadowRoot!.querySelector('[part="bar"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(events).to.deep.equal(['datum']);
  });
});

describe('lr-lite-chart tiny tick values', () => {
  it('keeps distinct value-axis labels when every tick is below one millionth', async () => {
    const el = await settledLite(html`<lr-lite-chart type="line" style="inline-size:400px;block-size:200px"
      .labels=${['a', 'b', 'c']} .datasets=${[{ label: 'S', data: [0, 2e-7, 4e-7] }]}></lr-lite-chart>`);
    await el.updateComplete;
    const labels = Array.from(el.shadowRoot!.querySelectorAll('[part="axis-label"]'))
      .map(node => node.textContent!.trim()).filter(text => /\d/.test(text) && !['a', 'b', 'c'].includes(text));
    expect(JSON.stringify(labels)).to.not.contain('"0","0"');
    expect(new Set(labels).size, JSON.stringify(labels)).to.equal(labels.length);
    expect(labels.filter(text => text !== '0').length, JSON.stringify(labels)).to.be.greaterThan(1);
  });
});

describe('chart activation after synchronous data changes', () => {
  it('drops a point notification when a chart listener replaces the labels', async () => {
    const el = await fixture<LyraChart>(html`<lr-chart .labels=${['A']}
      .datasets=${[{ label: 'Sales', data: [7] }]}></lr-chart>`);
    await waitUntil(() => !!el.chart);
    let points = 0;
    el.addEventListener('lr-point-activate', () => points++);
    el.addEventListener('lr-datum-activate', () => { el.labels = ['B']; });
    press(el.shadowRoot!.querySelector('canvas')!, false);
    expect(points).to.equal(0);
    expect(el.labels).to.deep.equal(['B']);
  });

  it('drops a point notification when a lite chart listener refreshes the data', async () => {
    const el = await settledLite(html`<lr-lite-chart type="bar" .labels=${['A']}
      .datasets=${[{ label: 'Sales', data: [7] }]}></lr-lite-chart>`);
    let points = 0;
    el.addEventListener('lr-point-activate', () => points++);
    el.addEventListener('lr-datum-activate', () => { el.requestUpdate(); });
    press(el.shadowRoot!.querySelector('[part="bar"]')!, false);
    expect(points).to.equal(0);
  });

  it('drops a point notification when a box listener refreshes the data', async () => {
    const box = { min: 1, q1: 2, median: 3, q3: 4, max: 5 };
    const el = await fixture<LyraBoxPlot>(html`<lr-box-plot .labels=${['A']}
      .datasets=${[{ label: 'Sales', data: [box] }]}></lr-box-plot>`);
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'));
    let points = 0;
    el.addEventListener('lr-point-activate', () => points++);
    el.addEventListener('lr-datum-activate', () => { el.requestUpdate(); });
    press(el.shadowRoot!.querySelector('canvas')!, false);
    expect(points).to.equal(0);
  });
});

it('uses the series name when chart name inputs are whitespace', async () => {
  const box = { min: 1, q1: 2, median: 3, q3: 4, max: 5 };
  const wrapper = await fixture<HTMLElement>(html`<div>
    <lr-chart label="  " aria-label=" " .datasets=${[{ label: 'Sales', data: [1] }]}></lr-chart>
    <lr-box-plot label="  " aria-label=" " .datasets=${[{ label: 'Sales', data: [box] }]}></lr-box-plot>
    <lr-lite-chart label="  " aria-label=" " .datasets=${[{ label: 'Sales', data: [1] }]}></lr-lite-chart>
  </div>`);
  for (const chart of wrapper.children) {
    await waitUntil(() => !!chart.shadowRoot?.querySelector('canvas,svg[role="group"]'), 'chart name owner did not render', { timeout: 5000 });
    expect(chart.shadowRoot!.querySelector('canvas,svg[role="group"]')!.getAttribute('aria-label'), chart.localName).to.equal('Sales');
  }
});

it('keeps large category ticks clear of the axis title and the bottom value tick', async () => {
  const el = await settledLite(html`<lr-lite-chart type="line" x-label="Period"
    style="--lr-chart-tick-font-size:2rem;inline-size:480px" .labels=${['A', 'B']}
    .datasets=${[{ label: 'Sales', data: [2, 4] }]}></lr-lite-chart>`);
  const svg = el.shadowRoot!.querySelector('svg[role="group"]')!;
  const labels = [...svg.querySelectorAll('[part="axis-label"]')];
  const first = labels.find(node => node.textContent!.trim() === 'A')!.getBoundingClientRect();
  const ticks = labels.filter(node => /\d/.test(node.textContent!));
  expect(ticks.length).to.be.greaterThan(0);
  expect(Math.max(...ticks.map(node => node.getBoundingClientRect().bottom))).to.be.at.most(first.top);
  const title = svg.querySelector('[part="axis-title"]')!.getBoundingClientRect();
  expect(first.bottom).to.be.at.most(title.top);
  expect(title.bottom).to.be.at.most(svg.getBoundingClientRect().bottom + 1);
});

it('exposes both axis titles on the populated lite chart to accessibility tools', async () => {
  const el = await settledLite(html`<lr-lite-chart x-label="Months" y-label="Sales" .labels=${['May', 'June']}
    .datasets=${[{ label: 'Sales', data: [3, 7] }]}></lr-lite-chart>`);
  expect([...el.shadowRoot!.querySelectorAll('[part="axis-title"]')].map(title => title.getAttribute('aria-label')))
    .to.deep.equal(['Sales', 'Months']);
  await expect(el).to.be.accessible();
});

it('names the legend independently of the chart and data table', async () => {
  const box = { min: 1, q1: 2, median: 3, q3: 4, max: 5 };
  const strings = { chartLegend: 'Series key' };
  const wrapper = await fixture<HTMLElement>(html`<div lang="en">
    <lr-chart label="Sales" .strings=${strings} .datasets=${[{ label: 'North', data: [7] }]}></lr-chart>
    <lr-box-plot label="Sales" with-legend .strings=${strings} .datasets=${[{ label: 'North', data: [box] }]}></lr-box-plot>
  </div>`);
  for (const chart of wrapper.children) {
    await waitUntil(() => !!chart.shadowRoot?.querySelector('[part="legend"]'));
    const element = chart as LyraChart | LyraBoxPlot;
    const legend = element.shadowRoot!.querySelector('[part="legend"]')!;
    expect(legend.getAttribute('aria-label')).to.equal('Series key');
    element.strings = {};
    await element.updateComplete;
    expect(legend.getAttribute('aria-label')).to.equal('Chart legend');
  }
});

it('shares the scale-type spelling on lite charts and preserves the scale property', async () => {
  const el = await settledLite(html`<lr-lite-chart scale-type="logarithmic" .datasets=${[{ label: 'Sales', data: [1, 10] }]}></lr-lite-chart>`);
  expect(el.scale).to.equal('logarithmic');
  el.scale = 'sqrt';
  expect(el.scaleType).to.equal('sqrt');
  el.scaleType = 'linear';
  expect(el.scale).to.equal('linear');
});

it('gives each data-table activation button a public part and the minimum hit area', async () => {
  const el = await fixture<LyraChart>(html`<lr-chart with-data-table .labels=${['A']}
    .datasets=${[{ label: 'Units', data: [1] }]}></lr-chart>`);
  await waitUntil(() => !!el.chart);
  const buttons = [...el.shadowRoot!.querySelectorAll('[part="data-table"] td button')];
  expect(buttons.length).to.equal(1);
  const button = buttons[0]!;
  expect(button.part.contains('data-table-button')).to.equal(true);
  const minimum = Number.parseFloat(getComputedStyle(button).minBlockSize);
  expect(minimum).to.be.greaterThan(0);
  expect(button.getBoundingClientRect().height).to.be.at.least(minimum - 0.5);
});

it('defers spatial controller creation until a spatial source is assigned', async () => {
  const el = await fixture<LyraChart>(html`<lr-chart type="scatter"></lr-chart>`);
  const points = [{ id: 'p', seriesId: 's', x: 1, y: 1, sourceIndex: 0 }];
  const state = el as unknown as { spatial?: unknown };
  expect(state.spatial === undefined).to.equal(true);
  const bounds = { minX: 0, minY: 0, maxX: 2, maxY: 2 };
  el.preparedData = { kind: 'spatial', revision: 1, count: 1, bounds,
    series: [{ id: 's', label: 'Sales' }], getPoint: () => points[0]!, query: () => ({ points, bins: [{ bounds, count: 1 }], matchedCount: 1 }) };
  await waitUntil(() => !!el.shadowRoot!.querySelector('[data-spatial-id="p"]'));
  expect(state.spatial === undefined).to.equal(false);
});

it('uses the interaction transition on chart disclosure buttons and honors reduced motion', async () => {
  const group = await fixture<HTMLElement>(html`<div>
    <lr-chart data-table-toggle></lr-chart>
    <lr-box-plot data-table-toggle></lr-box-plot>
    <lr-lite-chart data-table-toggle></lr-lite-chart>
  </div>`);
  const buttons = [...group.children].map(chart => chart.shadowRoot!.querySelector('[part="data-table-toggle"]')!);
  const durations = () => buttons.flatMap(button => getComputedStyle(button).transitionDuration.split(',').map(Number.parseFloat));
  try {
    await setReducedMotion('no-preference');
    expect(durations().every(value => value > 0.05)).to.equal(true);
    await setReducedMotion('reduce');
    await waitUntil(() => durations().every(value => value < 0.001));
  } finally {
    await setReducedMotion('no-preference');
  }
});

it('names lite line marks with the localized series fallback', async () => {
  const chart = await settledLite(html`<lr-lite-chart type="line" .labels=${['East', 'West']}
    .strings=${{ chartSeriesLabel: 'Measurements' }} .datasets=${[{ label: '  ', data: [2, 4] }]}></lr-lite-chart>`);
  expect(chart.shadowRoot!.querySelector('[part="point"]')!.getAttribute('aria-label')).to.contain('Measurements');
});

it('stops prepared activation after a source listener replaces the data', async () => {
  const source = await prepareLyraSeriesData([{ id: 's', label: 'Sales', input: {
    revision: 1, count: 2, read: () => [{ x: 0, y: 2 }, { x: 1, y: 3 }],
  } }], { maxPointsPerSeries: 4 });
  const group = await fixture<HTMLDivElement>(html`<div>
    <lr-chart type="line" without-animation .preparedData=${source}></lr-chart>
    <lr-lite-chart type="line" .preparedData=${source}></lr-lite-chart>
  </div>`);
  for (const child of group.children) {
    const chart = child as LyraChart | LyraLiteChart;
    await waitUntil(() => child.localName === 'lr-chart' ? !!(child as LyraChart).chart :
      !!child.shadowRoot!.querySelector('[part="point"]'), 'prepared marks did not render', { timeout: 5000 });
    const events: string[] = [];
    chart.addEventListener('lr-source-point-select', () => { events.push('source'); chart.preparedData = null; });
    chart.addEventListener('lr-datum-activate', () => events.push('datum'));
    chart.addEventListener('lr-point-activate', () => events.push('point'));
    press(child.shadowRoot!.querySelector('canvas,[part="point"]')!, false);
    expect(events, child.localName).to.deep.equal(['source']);
  }
});
