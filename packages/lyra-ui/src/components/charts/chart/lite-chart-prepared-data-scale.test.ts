import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { recordScaleMeasurement, renderedNodeCount } from '../../../../test/scale-budgets.js';
import { prepareLyraSeriesData, prepareLyraCategoryData, type LyraPreparedSeriesData, type LyraPreparedCategoryData } from '../../../utilities/data-preparation.js';
import './lite-chart.js';
import type { LyraLiteChart } from './lite-chart.class.js';

type PreparedLite = LyraLiteChart & {
  preparedData: LyraPreparedSeriesData | LyraPreparedCategoryData | null;
  revealSourcePoint(ref: { seriesId: string; sourceIndex: number }): Promise<boolean>;
};

it('renders a million-position prepared SVG series and reveals original middle/final positions', async function () {
  this.timeout(20000);
  const reads: [number, number][] = [];
  const source = await prepareLyraSeriesData([{ id: 's', label: 'Signal', input: {
    revision: 'million', count: 1000000, read(start, count) {
      reads.push([start, count]);
      return Array.from({ length: count }, (_, offset) => { const x = start + offset; return { x, y: x === 500000 ? null : x === 999998 ? 9999 : x % 10 }; });
    },
  } }], { maxPointsPerSeries: 40, batchSize: 8192 });
  const element = await fixture<PreparedLite>(html`<lr-lite-chart type="line" with-data-table style="width:600px" .preparedData=${source}></lr-lite-chart>`);
  await waitUntil(() => (element.shadowRoot?.querySelectorAll('[part="point"]').length ?? 0) > 0, 'prepared SVG missing');
  expect(element.shadowRoot!.querySelector('[part="description"]')?.textContent).to.include('999,999');
  expect(element.shadowRoot!.querySelector('[part="line"]')!.getAttribute('d')!.match(/M/g)!.length).to.be.greaterThan(1);
  const points = element.shadowRoot!.querySelectorAll<SVGCircleElement>('[part="point"]');
  expect(Number(points[0]!.getAttribute('cx'))).to.be.lessThan(Number(points[points.length - 1]!.getAttribute('cx')));
  const lateMaximum = [...points].find(point => point.getAttribute('aria-label')?.includes('999998:'));
  expect(lateMaximum !== undefined).to.equal(true);
  expect(Number(lateMaximum!.getAttribute('cy'))).to.be.lessThan(Number(points[0]!.getAttribute('cy')));
  expect(element.shadowRoot!.querySelector('[part="description"]')!.textContent).to.include('9,999');
  expect(reads.reduce((sum, [, count]) => sum + count, 0)).to.equal(1000000);
  reads.length = 0;
  expect(await element.revealSourcePoint({ seriesId: 's', sourceIndex: 765432 })).to.equal(true);
  await element.updateComplete;
  const events: { sourceIndex: number }[] = [];
  element.addEventListener('lr-source-point-select', event => events.push((event as CustomEvent).detail));
  const last = element.shadowRoot!.querySelectorAll<SVGCircleElement>('[part="point"]');
  last[last.length - 1]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(events.at(-1)!.sourceIndex).to.equal(765432);
  expect(await element.revealSourcePoint({ seriesId: 's', sourceIndex: 999999 })).to.equal(true);
  await element.updateComplete;
  expect(reads).to.deep.equal([[765432, 1], [999999, 1]]);
  recordScaleMeasurement('lr-lite-chart', 'prepared-series@1000000:mount-reveal', {
    sourcePositions: 1000000, preparationReadPositions: 1000000, exactReadPositions: 2,
    svgMarks: element.shadowRoot!.querySelectorAll('[part="point"]').length,
    dataRows: element.shadowRoot!.querySelectorAll('[part="data-list"] li').length, domNodes: renderedNodeCount(element),
  });
  reads.length = 0;
  element.height = '300px'; await element.updateComplete;
  element.exportData('csv'); element.exportData('svg');
  expect(reads).to.have.length(0);
});

it('renders all million observations through prepared category counts and emits aggregate identity', async function () {
  this.timeout(15000);
  const source = await prepareLyraCategoryData({ revision: 'counts', count: 1000000, read: (start, count) => Array.from({ length: count }, (_, offset) => (start + offset) % 2) }, {
    categories: [{ id: 'a', label: 'A' }, { id: 'other', label: 'Other' }], aggregation: 'count', categoryOf: value => value ? 'other' : 'a', seriesId: 's', seriesLabel: 'Count', batchSize: 8192,
  });
  const element = await fixture<PreparedLite>(html`<lr-lite-chart with-data-table .preparedData=${source}></lr-lite-chart>`);
  await waitUntil(() => element.shadowRoot?.querySelectorAll('[part="bar"]').length === 2, 'prepared bars missing');
  expect(element.exportData('csv')).to.include('500000');
  const events: unknown[] = [];
  element.addEventListener('lr-source-category-select', event => events.push((event as CustomEvent).detail));
  element.shadowRoot!.querySelectorAll('[part="bar"]')[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(events[0]).to.deep.equal({ revision: 'counts', seriesId: 's', categoryId: 'other', value: 500000, observationCount: 500000 });
  recordScaleMeasurement('lr-lite-chart', 'prepared-categories@1000000:mount-activate', {
    sourcePositions: 1000000, aggregatedObservations: source.categoryCounts.reduce((sum, count) => sum + count, 0),
    svgMarks: element.shadowRoot!.querySelectorAll('[part="bar"]').length,
    dataRows: element.shadowRoot!.querySelectorAll('[part="data-list"] li').length, domNodes: renderedNodeCount(element),
  });
});
