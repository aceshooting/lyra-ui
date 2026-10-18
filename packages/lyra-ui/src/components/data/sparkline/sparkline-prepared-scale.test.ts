import { expect, fixture, html } from '@open-wc/testing';
import { prepareLyraSeriesData, type LyraPreparedSeriesData } from '../../../utilities/data-preparation.js';
import { recordScaleMeasurement, renderedNodeCount } from '../../../../test/scale-budgets.js';
import './sparkline.js';
import type { LyraSparkline } from './sparkline.class.js';

type PreparedSparkline = LyraSparkline & { preparedData: LyraPreparedSeriesData | null };
function prepared(): LyraPreparedSeriesData {
  return { kind: 'series', revision: 'one', getPoint: () => { throw new Error('Unexpected source read'); }, series: [{
    id: 's', label: 'Signal', counts: { sourceCount: 1000, validCount: 999, invalidCount: 1 },
    xDomain: { min: 0, max: 100 }, yDomain: { min: 0, max: 100 },
    samples: [0,10,90,100].map((x,i) => ({ x, y: i*10, sourceIndex: [0,100,900,999][i]!, breakBefore: i === 0 || i === 2 })),
  }] };
}

it('renders a million-position prepared sparkline with full counts, domain and late extrema', async function () {
  this.timeout(20000);
  let reads = 0;
  const data = await prepareLyraSeriesData([{ id: 's', label: 'Signal', input: {
    revision: 'million', count: 1000000, read(start, count) { reads += count; return Array.from({ length: count }, (_, i) => {
      const x = start + i; return { x, y: x === 500000 ? null : x === 999998 ? 9999 : x % 10 };
    }); },
  } }], { maxPointsPerSeries: 40, batchSize: 8192 });
  const element = await fixture<PreparedSparkline>(html`<lr-sparkline .preparedData=${data}></lr-sparkline>`);
  const line = element.shadowRoot!.querySelector('[part="line"]');
  expect(line !== null).to.equal(true);
  expect(line!.getAttribute('d')!.match(/M/g)!.length).to.be.greaterThan(1);
  expect(element.shadowRoot!.querySelector('svg')!.getAttribute('aria-label')).to.include('999,999');
  expect(element.shadowRoot!.querySelector('svg')!.getAttribute('aria-label')).to.include('9,999');
  expect(reads).to.equal(1000000);
  reads = 0;
  element.mark = 'bar'; await element.updateComplete;
  const bars = [...element.shadowRoot!.querySelectorAll('rect')];
  expect(bars.some(bar => Number(bar.getAttribute('y')) === 0)).to.equal(true);
  expect(bars).to.have.length(data.series[0]!.samples.length);
  element.style.width = '400px'; element.min = -10; await element.updateComplete;
  expect(reads).to.equal(0);
  recordScaleMeasurement('lr-sparkline', 'prepared-series@1000000:mount-resize', {
    sourcePositions: 1000000, preparationReadPositions: 1000000, renderReadPositions: reads,
    svgMarks: bars.length, domNodes: renderedNodeCount(element),
  });
});

it('preserves original x positions and splits linear/natural/step lines and their fill closures', async () => {
  const element = await fixture<PreparedSparkline>(html`<lr-sparkline .preparedData=${prepared()}></lr-sparkline>`);
  expect(element.shadowRoot!.querySelector('[part="line"]')?.getAttribute('d')).to.equal('M0,100 L10,90 M90,80 L100,70');
  for (const curve of ['linear','natural','step'] as const) {
    element.curve = curve; element.appearance = 'gradient'; await element.updateComplete;
    const line = element.shadowRoot!.querySelector('[part="line"]')!.getAttribute('d')!;
    const fill = element.shadowRoot!.querySelector('[part="fill"]')!.getAttribute('d')!;
    expect(line.match(/M/g)).to.have.length(2); expect(fill.match(/Z/g)).to.have.length(2);
  }
  element.dir = 'rtl'; element.curve = 'linear'; await element.updateComplete;
  expect(element.shadowRoot!.querySelector('[part="line"]')!.getAttribute('d')).to.equal('M100,100 L90,90 M10,80 L0,70');
});

it('uses full prepared domains with explicit min/max overrides and never reads legacy inputs', async () => {
  const element = await fixture<PreparedSparkline>(html`<lr-sparkline .preparedData=${prepared()}></lr-sparkline>`);
  let reads = 0;
  Object.defineProperty(element, 'values', { configurable: true, get() { reads++; throw new Error('Legacy values read'); } });
  Object.defineProperty(element, 'data', { configurable: true, get() { reads++; throw new Error('Legacy text read'); } });
  try {
    element.requestUpdate(); element.max = 30; await element.updateComplete;
    expect(element.shadowRoot!.querySelector('[part="line"]')!.getAttribute('d')).to.include('L100,0');
    element.mark = 'bar'; element.style.width = '320px'; await element.updateComplete;
    expect(element.shadowRoot!.querySelectorAll('[part="bar"]')).to.have.length(4); expect(reads).to.equal(0);
  } finally { delete (element as Partial<PreparedSparkline>).values; delete (element as Partial<PreparedSparkline>).data; }
});

it('admits500 isolated samples but visibly rejects501, multiple series and accessors without evaluation', async () => {
  const original = prepared();
  const series = { ...original.series[0]!, counts: { sourceCount: 501, validCount: 501, invalidCount: 0 }, xDomain: { min: 0, max: 500 }, yDomain: { min: 1, max: 1 },
    samples: Array.from({ length: 500 }, (_, i) => ({ x: i, y: 1, sourceIndex: i, breakBefore: true })),
  };
  const element = await fixture<PreparedSparkline>(html`<lr-sparkline .preparedData=${{ ...original, series: [series] }}></lr-sparkline>`);
  expect(element.shadowRoot!.querySelector('[part="line"]')!.getAttribute('d')!.match(/M/g)).to.have.length(500);
  expect(element.shadowRoot!.querySelector('[part="fill"]')!.getAttribute('d')!.match(/Z/g)).to.have.length(500);
  element.strings = { chartPreparedUnavailable: 'Summary unavailable' };
  element.preparedData = { ...original, series: [{ ...series, samples: [...series.samples, { x: 500, y: 1, sourceIndex: 500, breakBefore: true }] }] };
  await element.updateComplete;
  expect(element.shadowRoot!.querySelector('[part="status"]')!.textContent).to.equal('Summary unavailable');
  element.preparedData = { ...original, series: [original.series[0]!, { ...original.series[0]!, id: 'other' }] }; await element.updateComplete;
  expect(element.shadowRoot!.querySelector('svg') === null).to.equal(true);
  let reads = 0;
  const samples = [...original.series[0]!.samples]; Object.defineProperty(samples, '0', { get() { reads++; throw new Error('Accessor evaluated'); } });
  element.preparedData = { ...original, series: [{ ...original.series[0]!, samples }] }; await element.updateComplete;
  expect(reads).to.equal(0); expect(element.shadowRoot!.querySelector('[part="status"]') !== null).to.equal(true);
});

it('refreshes mutable same-reference/keyless inputs and preserves accessible-name precedence and unset legacy geometry', async () => {
  const element = await fixture<PreparedSparkline>(html`<lr-sparkline .values=${[1,3,2]}></lr-sparkline>`);
  const legacy = element.shadowRoot!.querySelector('[part="line"]')!.getAttribute('d');
  const data = { ...prepared(), series: prepared().series.map(series => ({ ...series, xDomain: { min: 0, max: 100 } })) };
  element.preparedData = data; await element.updateComplete;
  data.series[0]!.xDomain.max = 200; element.preparedData = data; await element.updateComplete;
  expect(element.shadowRoot!.querySelector('[part="line"]')!.getAttribute('d')).to.include('L50,70');
  data.series[0]!.xDomain.max = 400; element.requestUpdate(); element.max = 100; await element.updateComplete;
  expect(element.shadowRoot!.querySelector('[part="line"]')!.getAttribute('d')).to.include('L25,70');
  element.label = 'Authored trend'; await element.updateComplete;
  expect(element.shadowRoot!.querySelector('svg')!.getAttribute('aria-label')).to.equal('Authored trend');
  element.setAttribute('aria-label', 'Host trend'); await element.updateComplete;
  expect(element.shadowRoot!.querySelector('svg')!.getAttribute('aria-label')).to.equal('Host trend');
  element.preparedData = null; element.max = undefined; await element.updateComplete;
  expect(element.shadowRoot!.querySelector('[part="line"]')!.getAttribute('d')).to.equal(legacy);
});

it('handles zero/all-invalid summaries and reconnect without reading the source', async () => {
  for (const count of [0,1000000]) {
    const original = prepared();
    const data: LyraPreparedSeriesData = { ...original, series: [{ ...original.series[0]!, samples: [], counts: { sourceCount: count, validCount: 0, invalidCount: count }, xDomain: null, yDomain: null }] };
    const element = await fixture<PreparedSparkline>(html`<lr-sparkline .preparedData=${data}></lr-sparkline>`);
    expect(element.shadowRoot!.querySelector('svg')!.getAttribute('aria-label')).to.include('0 valid observations');
    expect(element.shadowRoot!.querySelector('[part="status"]') === null).to.equal(true);
    element.remove(); document.body.append(element); await element.updateComplete;
    expect(element.shadowRoot!.querySelector('[part="line"]') === null).to.equal(true);
    await expect(element).to.be.accessible();
  }
});
