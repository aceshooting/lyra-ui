import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './heatmap.js';
import type { LyraHeatmap } from './heatmap.class.js';

type Rectangle = { rowStart: number; rowEnd: number; columnStart: number; columnEnd: number };
type SourceHost = LyraHeatmap & { matrixSource: unknown; matrixViewport: Rectangle | null; matrixReducer: string; revealSourceCell(row: number, col: number): Promise<boolean> };
function provider(rows = 1000, cols = 1000) {
  const queries: Rectangle[] = [];
  const cells: [number, number][] = [];
  return { queries, cells, revision: 1, rowCount: rows, columnCount: cols, domain: { min: 0, max: rows * cols },
    query(request: Rectangle) { queries.push(request); const count = (request.rowEnd - request.rowStart) * (request.columnEnd - request.columnStart);
      return [{ ...request, count, validCount: count, min: 0, max: rows * cols, sum: count }]; },
    getCell(row: number, col: number) { cells.push([row, col]); return { value: row * cols + col, rowLabel: `R${row}`, columnLabel: `C${col}` }; },
  };
}

it('uses the complete source domain, bounded tile query, and exact middle/final keyboard coordinates', async () => {
  const source = provider();
  const el = await fixture<SourceHost>(html`<lr-heatmap style="width: 400px" .matrixSource=${source}></lr-heatmap>`);
  await waitUntil(() => source.queries.length === 1);
  expect(source.cells.length).to.equal(0);
  expect(source.queries[0]).to.include({ rowStart: 0, rowEnd: 1000, columnStart: 0, columnEnd: 1000 });
  expect(el.shadowRoot!.querySelector('[part="source-summary"]')?.textContent).to.contain('1,000');
  const activated: { row: number; col: number; value: number }[] = [];
  el.addEventListener('lr-cell-activate', event => activated.push(event.detail as { row: number; col: number; value: number }));
  expect(await el.revealSourceCell(500, 500)).to.equal(true);
  await sendKeys({ press: 'Enter' });
  await waitUntil(() => activated.length === 1);
  expect(activated[0]).to.deep.equal({ row: 500, col: 500, value: 500500 });
  await sendKeys({ press: 'Control+End' });
  await waitUntil(() => source.cells.some(([r, c]) => r === 999 && c === 999));
  await el.updateComplete;
  await sendKeys({ press: 'Enter' });
  await waitUntil(() => activated.length === 2);
  expect(activated[1]).to.deep.equal({ row: 999, col: 999, value: 999999 });
  expect(source.queries.length).to.equal(1);
  recordScaleMeasurement('lr-heatmap', 'lazy-matrix-source@1000000', { logicalSourceCells: 1000000, allocatedSourceCells: 0, tileQueries: source.queries.length, exactReads: source.cells.length });
});

it('selects an aggregate range without an invented exact event and exports bounded tile coordinates', async () => {
  const source = provider();
  const el = await fixture<SourceHost>(html`<lr-heatmap .matrixSource=${source}></lr-heatmap>`);
  await waitUntil(() => source.queries.length === 1);
  expect(await el.revealSourceCell(500, 500)).to.equal(true);
  let exact = 0;
  let range: unknown;
  el.addEventListener('lr-cell-activate', () => exact++);
  el.addEventListener('lr-matrix-range-select', event => { range = (event as CustomEvent).detail; });
  await sendKeys({ press: 'Shift+Enter' });
  await waitUntil(() => range !== undefined);
  expect(exact).to.equal(0);
  expect(Object.isFrozen(range)).to.equal(true);
  expect(range).to.include({ rowStart: 0, rowEnd: 1000, columnStart: 0, columnEnd: 1000, count: 1000000, validCount: 1000000, sum: 1000000 });
  expect(el.exportData('csv')).to.contain('rowStart,rowEnd,columnStart,columnEnd,count,validCount,min,max,sum,reducer,value');
  expect(el.exportData('csv').split('\r\n').length).to.equal(2);
  expect(source.cells.length).to.equal(1);
});

it('rejects malformed partitions and explicit viewports while retaining an honest shrink window', async () => {
  const source = provider();
  const el = await fixture<SourceHost>(html`<lr-heatmap .matrixSource=${source} .matrixViewport=${{ rowStart: 900, rowEnd: 1000, columnStart: 900, columnEnd: 1000 }}></lr-heatmap>`);
  await waitUntil(() => source.queries.length === 1);
  const smaller = provider(50, 50);
  el.matrixSource = smaller;
  await waitUntil(() => smaller.queries.length === 1);
  expect(smaller.queries[0]).to.include({ rowStart: 0, rowEnd: 50, columnStart: 0, columnEnd: 50 });
  el.matrixViewport = { rowStart: 40, rowEnd: 60, columnStart: 0, columnEnd: 20 };
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part="source-error"]')));
  expect(smaller.queries.length).to.equal(1);
  el.matrixViewport = null;
  smaller.query = request => [{ ...request, count: 2500, validCount: 2500, min: 0, max: 2500, sum: 2500 }, { ...request, count: 2500, validCount: 2500, min: 0, max: 2500, sum: 2500 }];
  el.requestUpdate();
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part="source-error"]')));
  expect(el.exportData('csv')).to.equal('');
});

it('renders at most400 exact cells with full source ARIA and restores the legacy route when unset', async () => {
  const source = provider();
  const el = await fixture<SourceHost>(html`<lr-heatmap accessible-cells .matrixSource=${source}
    .data=${{ kind: 'matrix', rowLabels: ['legacy'], colLabels: ['value'], values: [[42]] }}></lr-heatmap>`);
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="cell"]').length === 400, 'bounded exact window', { timeout: 5000 });
  expect(source.cells.length).to.equal(400);
  const grid = el.shadowRoot!.querySelector('[role="grid"]')!;
  expect(grid.getAttribute('aria-rowcount')).to.equal('1000');
  expect(grid.getAttribute('aria-colcount')).to.equal('1000');
  expect(await el.revealSourceCell(999, 999)).to.equal(true);
  expect(el.shadowRoot!.querySelectorAll('[part="cell"]').length).to.equal(400);
  expect(el.shadowRoot!.querySelector('[aria-rowindex="1000"] [aria-colindex="1000"]')).not.to.equal(null);
  expect(source.cells.length).at.most(800);
  recordScaleMeasurement('lr-heatmap', 'exact-matrix-window@1000000', { logicalSourceCells: 1000000, exactReads: source.cells.length, mountedExactCells: el.shadowRoot!.querySelectorAll('[part="cell"]').length });
  el.matrixSource = null;
  await el.updateComplete;
  expect(el.exportData('csv')).to.contain('legacy,value,42');
  expect(el.shadowRoot!.querySelectorAll('[part="cell"]').length).equal(1);
  expect(el.shadowRoot!.querySelector('[part="source-summary"]')).to.equal(null);
});

it('keeps named presentation changes query-free and revokes an obsolete exact reveal promptly', async () => {
  const source = provider();
  const el = await fixture<SourceHost>(html`<lr-heatmap .matrixSource=${source}></lr-heatmap>`);
  await waitUntil(() => source.queries.length === 1);
  el.matrixReducer = 'max'; el.strings = { heatmapValueLabel: 'Metric' };
  await el.updateComplete;
  expect(source.queries.length).to.equal(1);
  let release!: () => void;
  source.getCell = ((row: number, col: number) => new Promise(resolve => { release = () => resolve({ value: row + col, rowLabel: 'row', columnLabel: 'column' }); })) as unknown as typeof source.getCell;
  const reveal = el.revealSourceCell(999, 999);
  await waitUntil(() => Boolean(release));
  el.matrixSource = provider(2, 2);
  expect(await reveal).to.equal(false);
  release();
  await el.updateComplete;
  expect(el.shadowRoot!.textContent).not.to.contain('R999');
});

it('reports incompatible calendar input without invoking the source and handles null exact values as NaN', async () => {
  const source = provider(1, 1);
  const el = await fixture<SourceHost>(html`<lr-heatmap .matrixSource=${source} .data=${{ kind: 'calendar', days: [] }}></lr-heatmap>`);
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part="source-error"]')));
  expect(source.queries.length).to.equal(0);
  source.domain = null as unknown as typeof source.domain;
  source.query = request => [{ ...request, count: 1, validCount: 0, min: null as unknown as number, max: null as unknown as number, sum: 0 }];
  source.getCell = () => ({ value: null as unknown as number, rowLabel: 'Missing', columnLabel: 'Cell' });
  el.data = { kind: 'matrix', rowLabels: [], colLabels: [], values: [] };
  await el.updateComplete;
  expect(await el.revealSourceCell(0, 0)).to.equal(true);
  let value = 0;
  el.addEventListener('lr-cell-activate', event => { value = event.detail.value; });
  await sendKeys({ press: 'Enter' });
  await waitUntil(() => Number.isNaN(value));
  await focusByKeyboard(el.shadowRoot!.querySelector<HTMLCanvasElement>('canvas')!);
});

it('keeps physical query and exact permits occupied until ignored aborts settle', async () => {
  const source = provider(20, 20);
  let queryActive = 0, queryPeak = 0;
  const queryReleases: (() => void)[] = [];
  const normalQuery = source.query;
  source.query = ((request: Rectangle) => {
    queryActive++; queryPeak = Math.max(queryPeak, queryActive);
    return new Promise(resolve => queryReleases.push(() => { queryActive--; resolve(normalQuery(request)); }));
  }) as unknown as typeof source.query;
  const el = await fixture<SourceHost>(html`<lr-heatmap style="width: 320px" .matrixSource=${source}></lr-heatmap>`);
  await waitUntil(() => queryReleases.length === 1);
  for (let index = 0; index < 10; index++) { el.matrixSource = source; await el.updateComplete; }
  expect(queryReleases.length).equal(1); expect(queryPeak).equal(1);
  queryReleases.shift()!();
  await waitUntil(() => queryReleases.length === 1);
  queryReleases.shift()!();
  await waitUntil(() => el.exportData('csv') !== '');
  let exactActive = 0, exactPeak = 0;
  const exactReleases: (() => void)[] = [];
  source.getCell = ((row: number, col: number) => {
    exactActive++; exactPeak = Math.max(exactPeak, exactActive);
    return new Promise(resolve => exactReleases.push(() => { exactActive--; resolve({ value: row * 20 + col, rowLabel: String(row), columnLabel: String(col) }); }));
  }) as unknown as typeof source.getCell;
  const first = el.revealSourceCell(1, 1); await waitUntil(() => exactReleases.length === 1);
  const second = el.revealSourceCell(2, 2); await waitUntil(() => exactReleases.length === 2);
  expect(await first).equal(false);
  const third = el.revealSourceCell(3, 3); await el.updateComplete;
  expect(await second).equal(false); expect(exactReleases.length).equal(2);
  exactReleases.shift()!(); await waitUntil(() => exactReleases.length === 2);
  exactReleases.shift()!(); exactReleases.shift()!();
  expect(await third).equal(true); expect(exactPeak).equal(2);
  recordScaleMeasurement('lr-heatmap', 'matrix-source-ignored-abort', { physicalQueryPeak: queryPeak, physicalExactPeak: exactPeak });
  el.remove(); expect(queryActive).equal(0); expect(exactActive).equal(0);
});

it('leaves a named fallback stop when every exact cell is excluded and respects localized strings', async () => {
  const el = await fixture<SourceHost>(html`<lr-heatmap accessible-cells style="width: 320px"
    .matrixSource=${provider(2, 2)} .cellInteractive=${() => false}
    .strings=${{ heatmapSourceSummary: 'Complete source', heatmapSourceExactWindow: 'Exact window' }}></lr-heatmap>`);
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="cell"]').length === 4);
  expect(el.shadowRoot!.querySelector('[part="source-summary"]')?.textContent).contain('Complete source');
  const grid = el.shadowRoot!.querySelector('[role="grid"]')!;
  expect(grid.getAttribute('aria-label')).equal('Exact window'); expect(grid.getAttribute('tabindex')).equal('0');
  expect(el.shadowRoot!.querySelectorAll('button[tabindex="0"]').length).equal(0);
  expect(await el.revealSourceCell(1, 1)).equal(false);
});

it('does not steal focus when an exact request resolves after the user moves outside', async () => {
  const source = provider(2, 2);
  let release!: () => void;
  source.getCell = (() => new Promise(resolve => { release = () => resolve({ value: 1, rowLabel: 'r', columnLabel: 'c' }); })) as unknown as typeof source.getCell;
  const wrapper = await fixture<HTMLElement>(html`<div><lr-heatmap .matrixSource=${source}></lr-heatmap><button>Outside</button></div>`);
  const el = wrapper.querySelector('lr-heatmap') as SourceHost;
  await waitUntil(() => source.queries.length === 1);
  const pending = el.revealSourceCell(0, 1); await waitUntil(() => Boolean(release));
  const outside = wrapper.querySelector('button')!; await focusByKeyboard(outside);
  release(); expect(await pending).equal(false); expect(document.activeElement?.textContent).equal('Outside');
});

it('revokes metadata reentry and rejects viewport accessors without invoking them', async () => {
  const initial = provider(2, 2), replacement = provider(3, 3);
  const el = await fixture<SourceHost>(html`<lr-heatmap .matrixSource=${initial}></lr-heatmap>`);
  await waitUntil(() => initial.queries.length === 1);
  Object.defineProperty(initial, 'rowCount', { get() { el.matrixSource = replacement; return 2; } });
  el.requestUpdate();
  await waitUntil(() => replacement.queries.length === 1);
  expect(initial.queries.length).equal(1);
  let reads = 0;
  el.matrixViewport = { get rowStart() { reads++; return 0; }, rowEnd: 1, columnStart: 0, columnEnd: 1 };
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part="source-error"]')));
  expect(reads).equal(0); expect(replacement.queries.length).equal(1);
});
