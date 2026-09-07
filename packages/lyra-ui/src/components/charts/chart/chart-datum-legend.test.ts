import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import type { Chart } from 'chart.js';
import './chart.js';
import type { LyraChart, LyraChartDatumVisibilityChangeDetail as DatumVisibility } from './chart.class.js';
const buttons = (el: LyraChart): HTMLButtonElement[] =>
  [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="legend-item"]')];
const labels = (el: LyraChart): string[] => buttons(el).map((button) => button.textContent!.trim());
const peer = (el: LyraChart): Chart => el.chart as unknown as Chart;

async function chart(type: 'pie' | 'doughnut' | 'polarArea' | 'bar' = 'doughnut'): Promise<LyraChart> {
  const el = await fixture<LyraChart>(html`<lr-chart type=${type} legend-mode="datum"
    without-animation style="inline-size:320px;block-size:320px"
    .labels=${['A', 'B', 'C']}
    .datasets=${[{ label: 'Distribution', data: [5, 3, 2], color: ['red', 'green', 'blue'] }]}
  ></lr-chart>`);
  await waitUntil(() => !!el.chart, 'Chart.js initialized', { timeout: 5000 });
  await el.updateComplete;
  return el;
}

describe('chart datum legends', () => {
  for (const type of ['pie', 'doughnut', 'polarArea'] as const) {
    it(`${type} exposes one named, color-matched category toggle per slice`, async () => {
      const el = await chart(type);
      expect(labels(el)).to.deep.equal(['A', 'B', 'C']);
      expect(buttons(el).map((button) => button.getAttribute('aria-pressed'))).to.deep.equal(['true', 'true', 'true']);
      const swatches = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="legend-swatch"]')];
      expect(swatches.map((swatch) => getComputedStyle(swatch).backgroundColor))
        .to.deep.equal(['rgb(255, 0, 0)', 'rgb(0, 128, 0)', 'rgb(0, 0, 255)']);
      await expect(el).to.be.accessible();
    });
  }

  it('preserves unset dataset legends and lets label-only display bypass legend formatting alone', async () => {
    const el = await chart();
    el.removeAttribute('legend-mode');
    el.valueFormatter = (value) => `$${value}`;
    await el.updateComplete;
    expect(el.legendMode).to.equal('dataset');
    expect(labels(el)).to.deep.equal(['Distribution: $10']);
    el.legendDisplay = 'label';
    await el.updateComplete;
    expect(labels(el)).to.deep.equal(['Distribution']);
    peer(el).tooltip!.setActiveElements([{ datasetIndex: 0, index: 0 }], { x: 0, y: 0 });
    peer(el).update('none');
    expect(peer(el).tooltip!.body.flatMap((entry) => entry.lines)).to.deep.equal(['Distribution: $5']);
    el.legendMode = 'datum';
    await el.updateComplete;
    expect(labels(el)).to.deep.equal(['A', 'B', 'C']);
    el.legendDisplay = 'value';
    await el.updateComplete;
    expect(labels(el)).to.deep.equal(['A: $5', 'B: $3', 'C: $2']);
  });

  it('keeps cartesian charts on dataset legends even when datum mode is requested', async () => {
    const el = await chart('bar');
    expect(labels(el)).to.deep.equal(['Distribution']);
    buttons(el)[0]!.click();
    await el.updateComplete;
    expect(el.hiddenDatasets).to.deep.equal([0]);
    expect(peer(el).isDatasetVisible(0)).to.equal(false);
  });

  it('vetoes or commits frozen complete datum proposals and toggles matching slices in every ring', async () => {
    const el = await chart();
    el.datasets = [...el.datasets, { label: 'Comparison', data: [2, 4, 4] }];
    await el.updateComplete;
    let before: CustomEvent<DatumVisibility> | undefined;
    const committed: CustomEvent<DatumVisibility>[] = [];
    let veto = true;
    let datasetEvents = 0;
    el.addEventListener('lr-before-datum-visibility-change', (event) => {
      before = event as CustomEvent<DatumVisibility>;
      if (veto) event.preventDefault();
    });
    el.addEventListener('lr-datum-visibility-change', (event) => committed.push(event as CustomEvent<DatumVisibility>));
    el.addEventListener('lr-legend-visibility-change', () => datasetEvents++);
    const csv = el.exportData('csv');
    const png = el.exportData('png');
    buttons(el)[1]!.click();
    expect(before?.detail).to.deep.equal({ index: 1, visible: false, hiddenDatums: [1] });
    expect(before?.bubbles && before.composed && before.cancelable).to.equal(true);
    expect(Object.isFrozen(before?.detail)).to.equal(true);
    expect(Object.isFrozen(before?.detail.hiddenDatums)).to.equal(true);
    expect(el.hiddenDatums).to.deep.equal([]);
    expect(committed.length).to.equal(0);
    veto = false;
    buttons(el)[1]!.focus();
    await sendKeys({ press: 'Enter' });
    await waitUntil(() => committed.length === 1);
    await el.updateComplete;
    expect(el.hiddenDatums).to.deep.equal([1]);
    expect(committed[0]?.detail).to.deep.equal(before?.detail);
    expect(Object.isFrozen(committed[0]?.detail.hiddenDatums)).to.equal(true);
    expect(peer(el).getDataVisibility(1)).to.equal(false);
    for (const datasetIndex of [0, 1]) {
      const arcs = peer(el).getDatasetMeta(datasetIndex).data as unknown as Array<{ circumference: number }>;
      expect(arcs[1]?.circumference).to.equal(0);
      expect(peer(el).isDatasetVisible(datasetIndex)).to.equal(true);
    }
    expect(buttons(el)[1]?.getAttribute('aria-pressed')).to.equal('false');
    expect(el.exportData('csv')).to.equal(csv);
    expect(el.exportData('png')).to.not.equal(png);
    expect(el.shadowRoot!.querySelectorAll('tbody tr').length).to.equal(3);
    expect(datasetEvents).to.equal(0);
    await sendKeys({ press: 'Space' });
    await waitUntil(() => committed.length === 2);
    expect(el.hiddenDatums).to.deep.equal([]);
    expect(peer(el).getDataVisibility(1)).to.equal(true);
  });

  it('owns programmatic hidden indexes and restores them across data, type and connection changes', async () => {
    const el = await chart();
    const authored = [2, 2, -1, Number.NaN];
    let changes = 0;
    el.addEventListener('lr-datum-visibility-change', () => changes++);
    el.hiddenDatums = authored;
    const originalData = peer(el).data;
    await el.updateComplete;
    expect(peer(el).data === originalData).to.equal(true);
    authored.splice(0);
    expect(Object.isFrozen(el.hiddenDatums)).to.equal(true);
    expect(peer(el).getDataVisibility(2)).to.equal(false);
    el.datasets = [{ label: 'Replacement', data: [7, 2, 1] }];
    await el.updateComplete;
    expect(peer(el).getDataVisibility(2)).to.equal(false);
    el.type = 'pie';
    await el.updateComplete;
    expect(peer(el).getDataVisibility(2)).to.equal(false);
    const parent = el.parentElement!;
    el.remove();
    parent.append(el);
    await waitUntil(() => !!el.chart);
    expect(peer(el).getDataVisibility(2)).to.equal(false);
    el.hiddenDatums = [];
    await el.updateComplete;
    expect(peer(el).getDataVisibility(2)).to.equal(true);
    expect(changes).to.equal(0);
  });

  it('uses source category indexes when the rendered series is sampled', async () => {
    const el = await chart();
    el.labels = Array.from({ length: 2000 }, (_, index) => `Category ${index}`);
    el.datasets = [{ label: 'Large distribution', data: Array.from({ length: 2000 }, () => 1) }];
    el.hiddenDatums = [1999];
    await el.updateComplete;
    const items = buttons(el);
    expect(items.length).to.equal(1000);
    expect(labels(el).at(-1)).to.equal('Category 1999');
    expect(items.at(-1)?.getAttribute('aria-pressed')).to.equal('false');
    expect(peer(el).getDataVisibility(999)).to.equal(false);
    let committed: DatumVisibility | undefined;
    el.addEventListener('lr-datum-visibility-change', (event) => { committed = (event as CustomEvent<DatumVisibility>).detail; });
    items.at(-1)!.click();
    expect(committed).to.deep.equal({ index: 1999, visible: true, hiddenDatums: [] });
    expect(peer(el).getDataVisibility(999)).to.equal(true);
  });

  it('ignores hostile hidden-index getters and out-of-range entries without invoking them', async () => {
    const el = await chart();
    let reads = 0;
    const indexes = [0, 2, 300];
    Object.defineProperty(indexes, '1', { get: () => { reads++; throw new Error('not data'); } });
    el.hiddenDatums = indexes;
    await el.updateComplete;
    expect(reads).to.equal(0);
    expect(buttons(el).map((button) => button.getAttribute('aria-pressed'))).to.deep.equal(['false', 'true', 'true']);
    el.datasets = [{ label: 'Short', data: [1] }];
    el.labels = ['Only'];
    await el.updateComplete;
    expect(labels(el)).to.deep.equal(['Only']);
    expect(peer(el).getDataVisibility(0)).to.equal(false);
  });

  it('formats percentages independently, including hidden categories, signed values and zero totals', async () => {
    const el = await chart();
    el.lang = 'fr';
    el.legendDisplay = 'percentage';
    el.valueFormatter = () => 'CUSTOM';
    el.hiddenDatums = [1];
    await el.updateComplete;
    const percent = new Intl.NumberFormat('fr', { style: 'percent', maximumFractionDigits: 1 });
    expect(labels(el)).to.deep.equal([`A: ${percent.format(0.5)}`, `B: ${percent.format(0.3)}`, `C: ${percent.format(0.2)}`]);
    el.datasets = [{ label: 'Signed', data: [-5, 3, 2] }];
    await el.updateComplete;
    expect(labels(el)[0]).to.equal(`A: ${percent.format(0.5)}`);
    el.datasets = [{ label: 'Empty', data: [0, 0, 0] }];
    await el.updateComplete;
    expect(labels(el)).to.deep.equal(['A', 'B', 'C'].map((label) => `${label}: ${percent.format(0)}`));
    const tooltipValues: number[] = [];
    el.valueFormatter = (value, context) => { if (context === 'tooltip') tooltipValues.push(value); return 'CUSTOM'; };
    el.datasets = [{ label: 'Large', data: [Number.MAX_VALUE, Number.MAX_VALUE, 0] }];
    await el.updateComplete;
    expect(labels(el)).to.deep.equal([`A: ${percent.format(0.5)}`, `B: ${percent.format(0.5)}`, `C: ${percent.format(0)}`]);
    expect(el.datasets[0]?.data?.[0]).to.equal(Number.MAX_VALUE);
    expect(peer(el).data.datasets[0]?.data).to.deep.equal([1, 1, 0]);
    peer(el).tooltip!.setActiveElements([{ datasetIndex: 0, index: 0 }], { x: 0, y: 0 });
    peer(el).update('none');
    expect(tooltipValues.includes(Number.MAX_VALUE)).to.equal(true);
    expect(tooltipValues.includes(1)).to.equal(false);
    el.valueFormatter = undefined;
    await el.updateComplete;
    expect(el.exportData('csv')).to.include(String(Number.MAX_VALUE));
    peer(el).tooltip!.setActiveElements([], { x: 0, y: 0 });
    peer(el).tooltip!.setActiveElements([{ datasetIndex: 0, index: 0 }], { x: 0, y: 0 });
    peer(el).update('none');
    expect(peer(el).tooltip!.body.flatMap((entry) => entry.lines))
      .to.deep.equal([`Large: ${new Intl.NumberFormat('fr').format(Number.MAX_VALUE)}`]);
    expect(peer(el).getDatasetMeta(0).data.every((arc) => Number.isFinite((arc as unknown as { circumference: number }).circumference))).to.equal(true);
    el.dataLabels = true;
    await el.updateComplete;
    const dataLabels = peer(el).config.options?.plugins?.datalabels as unknown as {
      formatter: (value: unknown, context: { datasetIndex: number; dataIndex: number }) => string;
    };
    expect(dataLabels.formatter(1, { datasetIndex: 0, dataIndex: 0 })).to.equal(new Intl.NumberFormat('fr').format(Number.MAX_VALUE));
  });

  it('uses dataset totals for dataset percentages and resets invalid display attributes', async () => {
    const el = await chart('bar');
    el.datasets = [...el.datasets, { label: 'Other', data: [10, 10, 10] }];
    el.legendDisplay = 'percentage';
    await el.updateComplete;
    expect(labels(el)).to.deep.equal(['Distribution: 25%', 'Other: 75%']);
    el.setAttribute('legend-display', 'unknown');
    el.setAttribute('legend-mode', 'unknown');
    await el.updateComplete;
    expect(el.legendDisplay).to.equal('auto');
    expect(el.legendMode).to.equal('dataset');
    expect(labels(el)).to.deep.equal(['Distribution', 'Other']);
  });

  it('keeps dataset percentages proportional when their finite values sum beyond the numeric range', async () => {
    const el = await chart();
    el.legendMode = 'dataset';
    el.legendDisplay = 'percentage';
    el.labels = ['A', 'B'];
    el.datasets = [
      { label: 'Double', data: [Number.MAX_VALUE, Number.MAX_VALUE] },
      { label: 'Single', data: [Number.MAX_VALUE / 2, Number.MAX_VALUE / 2] },
    ];
    await el.updateComplete;
    expect(labels(el)).to.deep.equal(['Double: 66.7%', 'Single: 33.3%']);
  });

  it('wraps long RTL categories and refreshes per-slice theme swatches', async () => {
    const el = await chart();
    el.dir = 'rtl';
    el.labels = ['A category with a very long label that must wrap within a small chart allocation', 'B', 'C'];
    el.datasets = [{ label: 'Distribution', data: [5, 3, 2] }];
    el.style.setProperty('--lr-color-chart-2', 'rgb(17, 85, 153)');
    el.refreshTheme();
    await el.updateComplete;
    const swatches = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="legend-swatch"]')];
    expect(getComputedStyle(swatches[1]!).backgroundColor).to.equal('rgb(17, 85, 153)');
    el.style.setProperty('--fill-color-2', 'rgb(102, 51, 153)');
    el.refreshTheme();
    await el.updateComplete;
    expect(getComputedStyle(swatches[1]!).backgroundColor).to.equal('rgb(102, 51, 153)');
    expect(labels(el)[0]).to.equal(el.labels[0]);
    for (const button of buttons(el)) expect(button.getBoundingClientRect().width).to.be.at.most(320);
    expect(getComputedStyle(buttons(el)[0]!).direction).to.equal('rtl');
    expect(el.scrollWidth).to.be.at.most(320);
    await expect(el).to.be.accessible();
  });
});
