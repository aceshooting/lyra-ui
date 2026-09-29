import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { captureDeprecationWarnings } from '../../../../test/expected-deprecations.js';
import './chart.js';
import './bar-chart.js';
import './bubble-chart.js';
import './doughnut-chart.js';
import './histogram.js';
import './line-chart.js';
import './pie-chart.js';
import './polar-area-chart.js';
import './radar-chart.js';
import './scatter-chart.js';
import './box-plot.js';
import './lite-chart.js';
import type { LyraChart } from './chart.js';
import type { LyraHistogram } from './histogram.js';
import type { LyraBoxPlot } from './box-plot.js';
import type { LyraLiteChart } from './lite-chart.js';

const chartTags = [
  'lr-chart', 'lr-bar-chart', 'lr-bubble-chart', 'lr-doughnut-chart', 'lr-histogram',
  'lr-line-chart', 'lr-pie-chart', 'lr-polar-area-chart', 'lr-radar-chart', 'lr-scatter-chart',
] as const;
const LINE = { labels: ['Q1', 'Q2'], datasets: [{ label: 'Revenue', data: [90, 100] }] };
const BOXES = [{ label: 'Latency', data: [{ min: 10, q1: 12, median: 14, q3: 16, max: 18 }] }];

type ChartConfig = {
  options: {
    layout?: unknown;
    scales: Record<string, { beginAtZero?: boolean; display?: boolean } | undefined>;
    plugins: { zoom?: unknown; tooltip: { bodyColor: string } };
  };
};
function configOf(el: HTMLElement): ChartConfig {
  return (el as unknown as { buildConfig(): ChartConfig }).buildConfig();
}
function tableHidden(el: HTMLElement): boolean {
  return el.shadowRoot!.querySelector('[part~="data-table"]')!.hasAttribute('data-visually-hidden');
}
function hasLegend(el: HTMLElement): boolean {
  return el.shadowRoot!.querySelector('[part="legend"]') !== null;
}
async function chartWith(tag: string): Promise<LyraChart> {
  const el = await fixture<LyraChart>(`<${tag}></${tag}>`);
  if (tag === 'lr-histogram') {
    (el as LyraHistogram).values = [90, 95, 100];
    (el as LyraHistogram).bins = 2;
  } else {
    // Typed charts retain their writable mirrored type property.
    el.type = 'line';
    el.labels = LINE.labels;
    el.datasets = LINE.datasets;
  }
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('[part~="data-table"]') !== null);
  return el;
}
async function smallChartWith(tag: 'lr-box-plot' | 'lr-lite-chart'): Promise<LyraBoxPlot | LyraLiteChart> {
  if (tag === 'lr-box-plot') {
    const el = await fixture<LyraBoxPlot>(html`<lr-box-plot></lr-box-plot>`);
    el.labels = ['Q1'];
    el.datasets = BOXES;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelector('canvas') !== null);
    return el;
  }
  const el = await fixture<LyraLiteChart>(html`<lr-lite-chart></lr-lite-chart>`);
  el.labels = LINE.labels;
  el.datasets = LINE.datasets;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('[part="bar"]') !== null);
  return el;
}

for (const tag of chartTags) {
  describe(`${tag}: retired aliases`, () => {
    it('ignores old attributes and property writes while canonical controls still render', async () => {
      const warnings = await captureDeprecationWarnings([], async () => {
        const el = await chartWith(tag);
        for (const name of ['beginAtZero', 'compact', 'showDataTable', 'zoom']) {
          expect(name in el, name).to.equal(false);
        }
        el.setAttribute('begin-at-zero', 'false');
        el.setAttribute('show-data-table', '');
        el.setAttribute('compact', '');
        el.setAttribute('zoom', '');
        await el.updateComplete;
        expect([el.withoutZeroBaseline, el.withDataTable, el.zoomable, el.size, el.withoutLegend])
          .to.deep.equal([false, false, false, 'm', false]);
        expect(tableHidden(el)).to.equal(true);
        expect(hasLegend(el)).to.equal(true);
        expect(configOf(el).options.scales['y']!.beginAtZero).to.equal(true);
        expect(configOf(el).options.plugins.zoom).to.equal(undefined);
        expect(configOf(el).options.scales['x']!.display).to.equal(true);

        Object.assign(el, { beginAtZero: false, showDataTable: true, compact: true, zoom: true });
        await el.updateComplete;
        expect([el.withoutZeroBaseline, el.withDataTable, el.zoomable, el.size])
          .to.deep.equal([false, false, false, 'm']);
        el.withoutZeroBaseline = true;
        el.withDataTable = true;
        el.zoomable = true;
        el.size = 's';
        await el.updateComplete;
        expect(tableHidden(el)).to.equal(false);
        expect(configOf(el).options.scales['y']!.beginAtZero).to.equal(false);
        expect(configOf(el).options.plugins.zoom !== undefined).to.equal(true);
        expect(configOf(el).options.layout).to.deep.equal({ padding: 0, autoPadding: false });
        expect(configOf(el).options.scales['x']!.display).to.equal(false);

        Object.assign(el, { beginAtZero: true, showDataTable: false, compact: false, zoom: false });
        for (const name of ['begin-at-zero', 'show-data-table', 'compact', 'zoom']) el.removeAttribute(name);
        await el.updateComplete;
        expect([el.withoutZeroBaseline, el.withDataTable, el.zoomable, el.size])
          .to.deep.equal([true, true, true, 's']);
        expect(tableHidden(el)).to.equal(false);
      });
      expect(warnings).to.have.length(0);
    });

    it('uses only the canonical tooltip token in painter-facing options', async () => {
      const el = await chartWith(tag);
      const fallback = configOf(el).options.plugins.tooltip.bodyColor;
      el.style.setProperty('--lr-chart-tooltip-text', 'rgb(13, 14, 15)');
      expect(configOf(el).options.plugins.tooltip.bodyColor).to.equal(fallback);
      el.style.setProperty('--lr-chart-tooltip-color', 'rgb(1, 2, 3)');
      expect(configOf(el).options.plugins.tooltip.bodyColor).to.equal('rgb(1, 2, 3)');
      el.style.setProperty('--lr-chart-tooltip-text', 'rgb(23, 24, 25)');
      expect(configOf(el).options.plugins.tooltip.bodyColor).to.equal('rgb(1, 2, 3)');
    });

    it('activates a populated chart through the keyboard without the retired notification', async () => {
      await assertActivation(await chartWith(tag));
    });
  });
}

async function assertActivation(el: LyraChart | LyraBoxPlot | LyraLiteChart): Promise<void> {
  const events: string[] = [];
  const details: unknown[] = [];
  for (const name of ['lr-datum-activate', 'lr-point-activate', 'lr-point-click']) {
    el.addEventListener(name, (event) => {
      events.push(name);
      details.push((event as CustomEvent).detail);
    });
  }
  const target = el.shadowRoot!.querySelector<HTMLElement>('canvas, [part="bar"]')!;
  await focusByKeyboard(target);
  await el.updateComplete;
  await sendKeys({ press: 'Enter' });
  expect(events).to.deep.equal(['lr-datum-activate', 'lr-point-activate']);
  const point = details[1] as { datasetIndex: number; index: number; value: unknown };
  expect(point.datasetIndex).to.equal(0);
  expect(point.index).to.equal(0);
  if (el.localName === 'lr-box-plot') expect(point.value).to.deep.equal(BOXES[0]!.data[0]);
  else if (el.localName !== 'lr-histogram') expect(point.value).to.equal(90);
  const { kind, ...datum } = details[0] as { kind: string; [key: string]: unknown };
  expect(['bar', 'point', 'segment', 'slice', 'box']).to.include(kind);
  expect(datum).to.deep.equal(details[1]);
}

for (const tag of ['lr-box-plot', 'lr-lite-chart'] as const) {
  describe(`${tag}: retired aliases`, () => {
    it('keeps the opt-in legend, table and zero-baseline defaults and canonical controls', async () => {
      const warnings = await captureDeprecationWarnings([], async () => {
        const el = await smallChartWith(tag);
        for (const name of ['beginAtZero', 'legend', 'showDataTable']) expect(name in el, name).to.equal(false);
        el.setAttribute('begin-at-zero', 'false');
        el.setAttribute('legend', '');
        el.setAttribute('show-data-table', '');
        Object.assign(el, { beginAtZero: false, legend: true, showDataTable: true });
        await el.updateComplete;
        expect([el.withoutZeroBaseline, el.withLegend, el.withDataTable]).to.deep.equal([false, false, false]);
        expect(tableHidden(el)).to.equal(true);
        expect(hasLegend(el)).to.equal(false);
        if (tag === 'lr-lite-chart') expect(valueTicks(el)).to.include('0');
        else expect(configOf(el).options.scales['y']!.beginAtZero).to.equal(true);
        el.withoutZeroBaseline = true;
        el.withLegend = true;
        el.withDataTable = true;
        await el.updateComplete;
        expect(tableHidden(el)).to.equal(false);
        expect(hasLegend(el)).to.equal(true);
        if (tag === 'lr-lite-chart') expect(valueTicks(el)).to.not.include('0');
        else expect(configOf(el).options.scales['y']!.beginAtZero).to.equal(false);
        Object.assign(el, { beginAtZero: true, legend: false, showDataTable: false });
        for (const name of ['begin-at-zero', 'legend', 'show-data-table']) el.removeAttribute(name);
        await el.updateComplete;
        expect([el.withoutZeroBaseline, el.withLegend, el.withDataTable]).to.deep.equal([true, true, true]);
        expect(tableHidden(el)).to.equal(false);
        expect(hasLegend(el)).to.equal(true);
      });
      expect(warnings).to.have.length(0);
    });
    it('activates populated data through the keyboard without the retired notification', async () => {
      await assertActivation(await smallChartWith(tag));
    });
  });
}
function valueTicks(el: HTMLElement): string[] {
  return [...el.shadowRoot!.querySelectorAll('[part="axis-label"]')].map((label) => label.textContent ?? '');
}
function svgName(el: LyraLiteChart): string | null {
  return el.shadowRoot!.querySelector('svg')!.getAttribute('aria-label');
}

it('box plot uses only the canonical canvas-tooltip color', async () => {
  const el = await smallChartWith('lr-box-plot');
  const fallback = configOf(el).options.plugins.tooltip.bodyColor;
  el.style.setProperty('--lr-chart-tooltip-text', 'rgb(13, 14, 15)');
  expect(configOf(el).options.plugins.tooltip.bodyColor).to.equal(fallback);
  el.style.setProperty('--lr-chart-tooltip-color', 'rgb(1, 2, 3)');
  expect(configOf(el).options.plugins.tooltip.bodyColor).to.equal('rgb(1, 2, 3)');
});

it('lite chart ignores accessible-label while retaining the programmatic fallback and its warning', async () => {
  const usage = { tag: 'lr-lite-chart', kind: 'property', name: 'accessibleLabel' } as const;
  let el!: LyraLiteChart;
  const attributeWarnings = await captureDeprecationWarnings([], async () => {
    el = await smallChartWith('lr-lite-chart') as LyraLiteChart;
    el.setAttribute('accessible-label', 'Old attribute');
    await el.updateComplete;
    expect(el.accessibleLabel).to.equal(undefined);
    expect(svgName(el)).to.equal('Revenue');
  });
  expect(attributeWarnings).to.have.length(0);
  const propertyWarnings = await captureDeprecationWarnings([usage], async () => {
    el.accessibleLabel = 'Retained property';
    await el.updateComplete;
  });
  expect(propertyWarnings.map((warning) => warning.key)).to.deep.equal([
    'lyra-deprecated:lr-lite-chart:property:accessibleLabel',
  ]);
  expect(svgName(el)).to.equal('Retained property');
  el.setAttribute('accessible-label', 'Changed old attribute');
  await el.updateComplete;
  expect(svgName(el)).to.equal('Retained property');
  el.setAttribute('aria-label', 'Native name');
  await el.updateComplete;
  expect(svgName(el)).to.equal('Native name');
  el.setAttribute('aria-label', '');
  await el.updateComplete;
  expect(svgName(el)).to.equal('');
  el.removeAttribute('aria-label');
  el.removeAttribute('accessible-label');
  await el.updateComplete;
  expect(svgName(el)).to.equal('Retained property');
});
