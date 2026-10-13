import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { Chart, CartesianScaleOptions, Plugin } from 'chart.js';
import './chart.js';
import './histogram.js';
import './box-plot.js';
import '../../../translations/de/shared.js';
import '../../../translations/de/charts.js';
import type { LyraChart } from './chart.class.js';
import type { LyraBoxPlot } from './box-plot.class.js';
import type { LyraHistogram } from './histogram.class.js';

function peer(el: LyraChart | LyraBoxPlot): Chart | undefined {
  return (el as unknown as { chart?: Chart }).chart;
}
async function settled(el: LyraChart | LyraBoxPlot): Promise<Chart> {
  await waitUntil(() => peer(el) !== undefined, 'chart did not initialize', { timeout: 5000 });
  await el.updateComplete;
  // wait-reason: Allow native observer/task delivery before measuring or rejecting a deferred peer update.
  await aTimeout(100);
  return peer(el)!;
}
function scaleOptions(runtime: Chart, axis: string): Partial<CartesianScaleOptions> {
  return runtime.options.scales![axis] as Partial<CartesianScaleOptions>;
}
function toggle(el: LyraChart | LyraBoxPlot, index = 0): void {
  el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="legend-item"]')[index]!.click();
}
async function chart(): Promise<LyraChart> {
  const el = await fixture<LyraChart>(html`<lr-chart type="line" without-animation
    .labels=${['A', 'B']} .datasets=${[{ label: 'First', data: [1, 2] }, { label: 'Second', data: [3, 4] }]}></lr-chart>`);
  await settled(el);
  return el;
}

describe('dataset legend update reconciliation', () => {
  it('applies two accepted toggles before one flush without repeating either update', async () => {
    const el = await chart();
    const runtime = peer(el)!;
    const original = runtime.update;
    let calls = 0;
    runtime.update = function (...args) { calls++; original.apply(this, args); };
    try {
      toggle(el, 0); toggle(el, 1);
      expect(calls).to.equal(2);
      expect(el.hiddenDatasets).to.deep.equal([0, 1]);
      await el.updateComplete;
      // wait-reason: Allow native observer/task delivery before measuring or rejecting a deferred peer update.
      await aTimeout(100);
      expect(calls).to.equal(2);
      expect([0, 1].map((index) => runtime.isDatasetVisible(index))).to.deep.equal([false, false]);
    } finally { runtime.update = original; }
  });

  for (const reset of [[], undefined]) {
    it(`honors a committed listener resetting visibility to ${reset ? 'all visible' : 'configured defaults'}`, async () => {
      const el = await chart();
      el.config = { data: { labels: ['A', 'B'], datasets: [
        { label: 'First', data: [1, 2] }, { label: 'Second', data: [3, 4], hidden: true },
      ] } };
      const runtime = await settled(el);
      expect(runtime.isDatasetVisible(1)).to.equal(false);
      el.addEventListener('lr-legend-visibility-change', () => { el.hiddenDatasets = reset; }, { once: true });
      toggle(el);
      await el.updateComplete;
      expect(runtime.isDatasetVisible(0)).to.equal(true);
      expect(runtime.isDatasetVisible(1)).to.equal(reset !== undefined);
      expect(el.hiddenDatasets).to.deep.equal(reset);
    });
  }

  for (const change of ['type', 'plugins', 'config'] as const) {
    it(`reconstructs the peer for a coalesced ${change} change`, async () => {
      const el = await chart();
      const original = peer(el)!;
      let pluginStarts = 0;
      el.addEventListener('lr-legend-visibility-change', () => {
        if (change === 'type') el.type = 'bar';
        else if (change === 'plugins') {
          const plugin: Plugin = { id: 'legend-update-control', beforeInit: () => { pluginStarts++; } };
          el.plugins = [plugin];
        }
        else el.config = { type: 'bar', options: { scales: { y: { min: -10 } } } };
      }, { once: true });
      toggle(el);
      await el.updateComplete;
      const current = peer(el)!;
      expect(current === original).to.equal(false);
      expect(current.isDatasetVisible(0)).to.equal(false);
      expect('type' in current.config ? current.config.type : undefined).to.equal(change === 'plugins' ? 'line' : 'bar');
      if (change === 'plugins') expect(pluginStarts).to.equal(1);
      if (change === 'config') expect(scaleOptions(current, 'y').min).to.equal(-10);
    });
  }

  it('refreshes locale and inherited direction after an accepted toggle', async () => {
    const el = await chart();
    el.datasets = [{ label: 'Primary', data: [1, 2] }, { label: 'Secondary', data: [3, 4], axis: 'y2' }];
    const runtime = await settled(el);
    el.addEventListener('lr-legend-visibility-change', () => {
      el.locale = 'de-DE';
      el.parentElement!.setAttribute('dir', 'rtl');
    }, { once: true });
    toggle(el);
    await waitUntil(() => scaleOptions(runtime, 'y2').position === 'left');
    expect(runtime.options.locale).to.equal('de-DE');
    expect(scaleOptions(runtime, 'y').position).to.equal('right');
    expect(runtime.isDatasetVisible(0)).to.equal(false);
  });

  for (const change of ['values', 'bins'] as const) {
    it(`keeps coalesced histogram ${change} live through its derived-content gate`, async () => {
      const el = await fixture<LyraHistogram>(html`<lr-histogram without-animation bins="2"
        .values=${[0, 0, 4, 4]}></lr-histogram>`);
      const runtime = await settled(el);
      el.addEventListener('lr-legend-visibility-change', () => {
        if (change === 'values') el.values = [0, 1, 1, 4];
        else el.bins = 4;
      }, { once: true });
      toggle(el);
      await el.updateComplete;
      expect(runtime.data.datasets[0]!.data).to.deep.equal(change === 'values' ? [3, 1] : [2, 0, 0, 2]);
      expect(runtime.data.labels).to.deep.equal([...el.labels]);
      expect(runtime.isDatasetVisible(0)).to.equal(false);
    });
  }

  it('preserves complete table cells and CSV values, including the hidden series', async () => {
    const el = await chart();
    const cells = () => [...el.shadowRoot!.querySelectorAll('table tr')].map((row) =>
      [...row.querySelectorAll('th, td')].map((cell) => cell.textContent!.trim()));
    const before = cells();
    const exported = el.exportData('csv');
    expect(before).to.deep.equal([['Category', 'First', 'Second'], ['A', '1', '3'], ['B', '2', '4']]);
    expect(exported).to.equal('label,First,Second\r\nA,1,3\r\nB,2,4');
    toggle(el);
    await el.updateComplete;
    expect(cells()).to.deep.equal(before);
    expect(el.exportData('csv')).to.equal(exported);
  });

  it('retains sampled source row indexes and values after an accepted toggle', async () => {
    const labels = Array.from({ length: 1001 }, (_, index) => `Row ${index}`);
    const values = labels.map((_, index) => index);
    const el = await fixture<LyraChart>(html`<lr-chart type="line" without-animation
      .labels=${labels} .datasets=${[{ label: 'Values', data: values }]}></lr-chart>`);
    const runtime = await settled(el);
    const indexes = () => [...(el as unknown as { visualRowSourceIndexes: readonly number[] }).visualRowSourceIndexes];
    const before = indexes();
    expect(before.length).to.be.lessThan(values.length);
    expect(before[0]).to.equal(0);
    expect(before.at(-1)).to.equal(1000);
    toggle(el);
    await el.updateComplete;
    expect(indexes()).to.deep.equal(before);
    expect(runtime.data.datasets[0]!.data).to.deep.equal(before.map((index) => values[index]));
  });
});

for (const reset of [false, true]) {
  it(`reconciles two box-plot legend actions with ${reset ? 'a controlled reset' : 'one deferred flush'}`, async () => {
    const box = { min: 1, q1: 2, median: 3, q3: 4, max: 5 };
    const el = await fixture<LyraBoxPlot>(html`<lr-box-plot with-legend .labels=${['A']}
      .datasets=${[{ label: 'First', data: [box] }, { label: 'Second', data: [box] }]}></lr-box-plot>`);
    const runtime = await settled(el);
    const original = runtime.update;
    let calls = 0;
    runtime.update = function (...args) { calls++; original.apply(this, args); };
    try {
      toggle(el, 0);
      if (reset) el.addEventListener('lr-legend-visibility-change', () => { el.hiddenDatasets = undefined; }, { once: true });
      toggle(el, 1);
      expect(calls).to.equal(2);
      await el.updateComplete;
      // wait-reason: Allow native observer/task delivery before measuring or rejecting a deferred peer update.
      await aTimeout(100);
      expect(calls).to.equal(reset ? 3 : 2);
      expect([0, 1].map((index) => runtime.isDatasetVisible(index))).to.deep.equal([reset, reset]);
    } finally { runtime.update = original; }
  });
}

it('keeps box-plot table/export complete and coalesced locale/direction live', async () => {
  const box = { min: 1, q1: 2, median: 3, q3: 4, max: 5 };
  const el = await fixture<LyraBoxPlot>(html`<lr-box-plot with-legend .labels=${['A']}
    .datasets=${[{ label: 'Series', data: [box] }]}></lr-box-plot>`);
  const runtime = await settled(el);
  const cells = () => [...el.shadowRoot!.querySelectorAll('tbody tr')].map((row) =>
    [...row.querySelectorAll('th, td')].map((cell) => cell.textContent!.trim()));
  expect(cells()).to.deep.equal([['A', 'Series', '1', '2', '3', '4', '5']]);
  const exported = 'category,series,min,q1,median,q3,max\r\nA,Series,1,2,3,4,5';
  expect(el.exportData('csv')).to.equal(exported);
  toggle(el);
  await el.updateComplete;
  expect(cells()).to.deep.equal([['A', 'Series', '1', '2', '3', '4', '5']]);
  expect(el.exportData('csv')).to.equal(exported);
  el.addEventListener('lr-legend-visibility-change', () => {
    el.locale = 'de-DE';
    el.parentElement!.setAttribute('dir', 'rtl');
  }, { once: true });
  toggle(el);
  await waitUntil(() => scaleOptions(runtime, 'y').position === 'right');
  expect(runtime.options.locale).to.equal('de-DE');
  expect(runtime.isDatasetVisible(0)).to.equal(true);
  expect(el.exportData('csv')).to.equal(exported);
});
