import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './box-plot.js';
import type { LyraBoxPlot } from './box-plot.class.js';
import { preloadCharts } from './chart-preload.js';
import { forcedColorsMatchMedia } from '../../../../test/chart-forced-colors-media.js';
import { countCalls, recordScaleMeasurement, renderedNodeCount } from '../../../../test/scale-budgets.js';
import { aggregateMillionObservations } from '../../../../test/aggregate-observations.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { sendKeys } from '@web/test-runner-commands';
import type { LyraBoxPlotPointDetail } from './box-plot.class.js';

it('reuses forced-color tiles and one surface-token read across repeated series encodings', () => {
  const original = window.matchMedia;
  window.matchMedia = forcedColorsMatchMedia(original);
  const el = document.createElement('lr-box-plot') as LyraBoxPlot;
  const probe = el as unknown as { forcedColorFill(index: number, background: string): unknown; styleColor(name: string, fallback: string): string };
  const canvases = countCalls(document, 'createElement');
  const colors = countCalls(probe, 'styleColor');
  try {
    const first = probe.forcedColorFill(1, 'black');
    for (let i = 0; i < 100; i++) expect(probe.forcedColorFill(1 + 8 * i, 'black') === first).to.equal(true);
    expect(canvases.calls).to.equal(1);
    expect(colors.calls).to.equal(1);
    recordScaleMeasurement('lr-box-plot', 'forced-colors@100', { tileCreations: canvases.calls, surfaceReads: colors.calls });
  } finally { canvases.restore(); colors.restore(); window.matchMedia = original; }
});

it('renders complete million-observation group summaries with exact host provenance and a late maximum', async () => {
  // Host aggregation and optional peer loading are independent setup work. Start both before
  // mounting the measured component, so the rendering/keyboard scenario has a ready peer.
  const [peers, aggregates] = await Promise.all([
    preloadCharts({ boxPlot: true }),
    aggregateMillionObservations(),
  ]);
  expect(peers).deep.equal({ core: true, boxPlot: true });
  const { prefix, complete } = aggregates;
  expect(aggregates.sourceReads).equal(1_000_000);
  expect(prefix.sourceCount).equal(999_999);
  expect(complete.groups.map(group => group.count)).deep.equal([250_000, 250_000, 250_000, 250_000]);
  expect(complete.groups.map(group => group.summary)).deep.equal([
    { min: 0, q1: 25, median: 50, q3: 75, max: 100 },
    { min: 0, q1: 25, median: 50, q3: 75, max: 100 },
    { min: 0, q1: 25, median: 50, q3: 75, max: 100 },
    { min: 0, q1: 25, median: 50, q3: 75, max: 10_000 },
  ]);
  expect(prefix.groups[3]!.summary.max).equal(100);
  expect(complete.groups[3]!.summary.max).equal(10_000);
  const el = await fixture<LyraBoxPlot>(html`<lr-box-plot lang="en" label="Complete cohort distributions" with-data-table
    .description=${`999,999 observations before the final record. ${aggregates.quantileMethod}.`}
    .labels=${complete.groups.map(group => group.label)}
    .datasets=${[{ label: 'Value', data: prefix.groups.map(group => group.summary) }]}></lr-box-plot>`);
  const seam = el as unknown as { chart?: { data: { datasets: Array<{ data: Array<{ max: number }> }> } } };
  await waitUntil(() => seam.chart !== undefined && seam.chart !== null, 'the real box-plot peer did not construct', { timeout: 5_000 });
  expect(seam.chart!.data.datasets[0]!.data[3]!.max).equal(100);
  el.datasets = [{ label: 'Value', data: complete.groups.map(group => group.summary) }];
  el.description = `1,000,000 observations; 250,000 per group. ${aggregates.quantileMethod}.`;
  await el.updateComplete;
  await waitUntil(() => seam.chart!.data.datasets[0]!.data[3]!.max === 10_000, 'the peer did not receive the tail-influenced summary');
  const tableRows = el.shadowRoot!.querySelectorAll('[part="data-table"] tbody tr');
  expect(tableRows.length).equal(4);
  expect(tableRows[3]?.textContent).contain('10,000');
  expect(el.shadowRoot!.querySelector('[part="description"]')?.textContent).contain(aggregates.quantileMethod);
  expect(el.shadowRoot!.querySelector('[part="description"]')?.textContent).contain('1,000,000 observations; 250,000 per group');
  expect(el.exportData('csv')).contain('10000');
  const canvas = el.shadowRoot!.querySelector<HTMLCanvasElement>('canvas');
  if (!canvas) throw new Error('Missing real box-plot canvas');
  await focusByKeyboard(canvas);
  await sendKeys({ press: 'End' });
  const activated = oneEvent(el, 'lr-datum-activate');
  await sendKeys({ press: 'Enter' });
  const event = await activated as CustomEvent<LyraBoxPlotPointDetail & { kind: string }>;
  expect(event.detail.kind).equal('box');
  expect(event.detail.index).equal(3);
  expect(event.detail.value).deep.equal(complete.groups[3]!.summary);
  el.label = 'Updated complete cohort distributions';
  await el.updateComplete;
  expect(aggregates.sourceReads).equal(1_000_000);
  const peerBoxes = seam.chart!.data.datasets.reduce((total, series) => total + series.data.length, 0);
  const retainedBoxes = el.datasets.reduce((total, series) => total + series.data.length, 0);
  expect(peerBoxes).equal(4);
  expect(retainedBoxes).equal(4);
  const domNodes = renderedNodeCount(el);
  expect(domNodes).lessThan(200);
  recordScaleMeasurement('lr-box-plot', 'aggregate-observations@1000000', {
    sourceReads: aggregates.sourceReads, sourceObservations: complete.sourceCount, maxHostChunkRecords: aggregates.maxChunkRecords,
    hostHistogramEntries: aggregates.histogramEntries, retainedBoxes, peerBoxes, tableRows: tableRows.length, domNodes,
  });
});
