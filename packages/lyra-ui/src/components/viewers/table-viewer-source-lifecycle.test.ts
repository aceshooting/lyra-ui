import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import './csv-viewer/csv-viewer.js';
import './spreadsheet-viewer/spreadsheet-viewer.js';
import type { LyraCsvViewer } from './csv-viewer/csv-viewer.js';
import type { LyraTabularSource } from '../../data-sources.js';
const make = (_kind: 'csv', source: LyraTabularSource) => fixture<LyraCsvViewer>(html`<lr-csv-viewer style="width:400px" .dataSource=${source}></lr-csv-viewer>`);

it('revokes old document reads during adoption and reveals using the new owner document', async () => {
  type Request = import('../../data-sources.js').LyraTabularReadRequest;
  const pending: Array<{ request: Request; resolve(value: readonly (readonly string[])[]): void }> = [];
  let calls = 0;
  const values = (request: Request) => Array.from({ length: request.rowCount }, (_, r) => Array.from({ length: request.columnCount }, (_, c) => `${request.row + r}:${request.column + c}`));
  const source: LyraTabularSource = { revision: 1, rowCount: 1000000, columnCount: 3, columnAt: i => ({ key: String(i), label: 'Header' }),
    readCells: request => ++calls <= 2 ? new Promise(resolve => pending.push({ request, resolve })) : Promise.resolve(values(request)) };
  const viewer = await make('csv', source);
  await waitUntil(() => pending.length === 2);
  const parent = viewer.parentNode!;
  const errors: unknown[] = [];
  viewer.addEventListener('lr-render-error', event => errors.push((event as CustomEvent).detail.error));
  const frame = await fixture<HTMLIFrameElement>(html`<iframe title="Viewer owner document" style="position:fixed;top:0;left:0;width:600px;height:600px"></iframe>`);
  await waitUntil(() => !!frame.contentDocument?.body);
  try {
    frame.contentDocument!.body.append(viewer);
    expect(pending.every(item => item.request.signal.aborted)).to.equal(true);
    for (const item of pending) item.resolve(values(item.request));
    await nextFrame();
    expect(errors.length).to.equal(0);
    expect(await viewer.scrollToAnchor({ kind: 'cell-range', range: 'C1000001' })).to.equal(true);
    expect(viewer.ownerDocument === frame.contentDocument).to.equal(true);
    expect(viewer.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!.textContent).to.include('999999:2');
  } finally { parent.append(viewer); }
});

it('updates fixed source row geometry after a token-only theme change on a settled viewer', async () => {
  const source: LyraTabularSource = { revision: 1, rowCount: 1000000, columnCount: 3, columnAt: i => ({ key: String(i), label: 'Header' }), cellAt: () => 'value' };
  const viewer = await make('csv', source);
  await nextFrame(); await nextFrame(); await nextFrame();
  const list = viewer.shadowRoot!.querySelector('lr-virtual-list')!;
  const before = viewer.getBoundingClientRect().height;
  viewer.style.setProperty('--lr-size-3rem', '64px');
  await waitUntil(() => list.rowHeight === 64);
  expect(viewer.getBoundingClientRect().height).to.equal(before);
  expect(getComputedStyle(list.shadowRoot!.querySelector('[part="data-row"]')!).height).to.equal('64px');
});

it('covers the unaligned compact visible interval across both bounded rectangles', async () => {
  const source: LyraTabularSource = { revision: 1, rowCount: 1000000, columnCount: 100, columnAt: i => ({ key: String(i), label: 'Header' }), cellAt: (r, c) => `${r}:${c}` };
  const viewer = await fixture<LyraCsvViewer>(html`<lr-csv-viewer style="width:12800px;--lr-size-3rem:2px" .dataSource=${source}></lr-csv-viewer>`);
  const list = viewer.shadowRoot!.querySelector('lr-virtual-list')!;
  list.scrollToIndex(105, { align: 'start', behavior: 'auto' });
  await waitUntil(() => list.shadowRoot!.querySelector('[data-row-index="250"] [aria-colindex="100"]')?.textContent === '250:99');
});

for (const action of ['search', 'clear'] as const) it(`revokes pending public anchor retries when ${action} changes navigation intent`, async () => {
  type Request = import('../../data-sources.js').LyraTabularReadRequest;
  const pending: Array<{ request: Request; resolve(value: readonly (readonly string[])[]): void }> = [];
  let calls = 0;
  const values = (request: Request) => Array.from({ length: request.rowCount }, (_, r) => Array.from({ length: request.columnCount }, (_, c) => `${request.row + r}:${request.column + c}`));
  const source: LyraTabularSource = { revision: 1, rowCount: 1000000, columnCount: 3, columnAt: i => ({ key: String(i), label: 'Header' }),
    readCells: request => ++calls <= 2 ? new Promise(resolve => pending.push({ request, resolve })) : Promise.resolve(values(request)),
    search: async () => ({ hits: [{ row: 999999, column: 2 }], total: 1, exhaustive: true }) };
  const viewer = await make('csv', source);
  await waitUntil(() => pending.length === 2);
  const old = viewer.scrollToAnchor({ kind: 'cell-range', range: 'C500002' });
  await nextFrame();
  const next = action === 'search' ? viewer.search('tail') : (viewer.clearSearch(), Promise.resolve(0));
  for (const item of pending) item.resolve(values(item.request));
  await next;
  expect(await old).to.equal(false);
  if (action === 'search') expect(viewer.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!.textContent).to.include('999999:2');
});

it('clears header search coordinates and pending navigation when CSV hides labels without rereading cells', async () => {
  let cells = 0;
  const source: LyraTabularSource = { revision: 1, rowCount: 1000000, columnCount: 3, columnAt: i => ({ key: String(i), label: 'Header' }), cellAt: (r, c) => { cells++; return `${r}:${c}`; },
    search: async () => ({ hits: [{ row: -1, column: 0 }, { row: 999999, column: 2 }], total: 2, exhaustive: true }) };
  const viewer = await make('csv', source);
  const details: Array<{ matchCount: number; matchCountExact: boolean }> = [];
  viewer.addEventListener('lr-search-change', event => details.push(event.detail));
  expect(await viewer.search('Header')).to.equal(2);
  cells = 0;
  const old = viewer.scrollToAnchor({ kind: 'cell-range', range: 'A1' });
  viewer.withoutHeaderRow = true;
  await viewer.updateComplete; await nextFrame();
  expect(details.at(-1)?.matchCount).to.equal(0);
  expect(cells).to.equal(0);
  expect(await old).to.equal(false);
  expect(await viewer.searchNext()).to.equal(false);
  expect(await viewer.search('Header')).to.equal(1);
  expect(details.at(-1)).to.include({ matchCount: 1, matchCountExact: false });
});

const sizedSource = (rows: number, columns: number): LyraTabularSource => ({ revision: 1, rowCount: rows, columnCount: columns,
  columnAt: index => ({ key: String(index), label: String(index) }), cellAt: (row, column) => `${row}:${column}` });

it('replaces a compact tall source with a small wider source without stale range admission', async () => {
  const viewer = await fixture<LyraCsvViewer>(html`<lr-csv-viewer style="width:12800px;--lr-size-3rem:1px" .dataSource=${sizedSource(1000000, 3)}></lr-csv-viewer>`);
  await waitUntil(() => viewer.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot!.textContent?.includes('250:0') === true);
  const errors: unknown[] = [];
  viewer.addEventListener('lr-render-error', event => errors.push(event.detail.error));
  viewer.dataSource = sizedSource(10, 100);
  await viewer.updateComplete; await nextFrame(); await nextFrame();
  expect(errors.length).to.equal(0);
  expect(viewer.shadowRoot!.querySelector('[part="error"]') === null).to.equal(true);
  expect(await viewer.scrollToAnchor({ kind: 'cell-range', range: 'CV11' })).to.equal(true);
  expect(viewer.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!.textContent).to.include('9:99');
});

it('switches a compact tall workbook sheet to a small wider sheet without stale range admission', async () => {
  const viewer = await fixture<import('./spreadsheet-viewer/spreadsheet-viewer.js').LyraSpreadsheetViewer>(html`<lr-spreadsheet-viewer style="width:12800px;--lr-size-3rem:1px"
    .dataSource=${{ revision: 1, sheets: [{ key: 'tall', name: 'Tall', data: sizedSource(1000000, 3) }, { key: 'small', name: 'Small', data: sizedSource(10, 100) }] }}></lr-spreadsheet-viewer>`);
  await waitUntil(() => viewer.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot!.textContent?.includes('250:0') === true);
  const errors: unknown[] = [];
  viewer.addEventListener('lr-render-error', event => errors.push(event.detail.error));
  viewer.shadowRoot!.querySelector('lr-tab-group')!.show('source-1');
  await viewer.updateComplete; await nextFrame(); await nextFrame();
  expect(errors.length).to.equal(0);
  expect(await viewer.scrollToAnchor({ kind: 'cell-range', sheet: 'Small', range: 'CV11' })).to.equal(true);
  expect(viewer.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!.textContent).to.include('9:99');
});

it('still rejects a current visible interval beyond both rectangle budgets', async () => {
  const errors: unknown[] = [];
  const viewer = await fixture<LyraCsvViewer>(html`<lr-csv-viewer style="width:12800px;--lr-size-3rem:1px" .dataSource=${sizedSource(1000000, 100)}
    @lr-render-error=${(event: CustomEvent) => errors.push(event.detail.error)}></lr-csv-viewer>`);
  await waitUntil(() => errors.length > 0);
  expect(viewer.shadowRoot!.querySelector('[part="error"]') !== null).to.equal(true);
});
