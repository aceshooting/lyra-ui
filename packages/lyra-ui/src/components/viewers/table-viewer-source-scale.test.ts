import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import './csv-viewer/csv-viewer.js';
import './dataset-viewer/dataset-viewer.js';
import './spreadsheet-viewer/spreadsheet-viewer.js';
import type { LyraCsvViewer } from './csv-viewer/csv-viewer.js';
import type { LyraDatasetViewer } from './dataset-viewer/dataset-viewer.js';
import type { LyraSpreadsheetViewer } from './spreadsheet-viewer/spreadsheet-viewer.js';
import type { LyraTabularSource, LyraWorkbookSource } from '../../data-sources.js';
import { recordScaleMeasurement } from '../../../test/scale-budgets.js';
import { expectDevWarning } from '../../../test/expected-dev-warnings.js';
expectDevWarning('virtual-list-scroll-scaling');
type Viewer = (LyraCsvViewer | LyraDatasetViewer | LyraSpreadsheetViewer) & { dataSource?: LyraTabularSource | LyraWorkbookSource };
const kinds = ['csv', 'dataset', 'spreadsheet'] as const;
async function make(kind: typeof kinds[number], source: LyraTabularSource): Promise<Viewer> {
  const dataSource = kind === 'spreadsheet' ? { revision: 1, sheets: [{ key: 'main', name: 'Main', data: source }] } : source;
  return kind === 'csv' ? fixture(html`<lr-csv-viewer style="width:400px" .dataSource=${dataSource}></lr-csv-viewer>`) :
    kind === 'dataset' ? fixture(html`<lr-dataset-viewer style="width:400px" .dataSource=${dataSource}></lr-dataset-viewer>`) :
    fixture(html`<lr-spreadsheet-viewer style="width:400px" .dataSource=${dataSource}></lr-spreadsheet-viewer>`);
}
for (const kind of kinds) it(`${kind} addresses a million body records with bounded cell and column reads`, async () => {
  let cells = 0, columns = 0;
  const source: LyraTabularSource = { revision: 1, rowCount: 1000000, columnCount: 1000,
    columnAt: index => { columns++; return { key: `c${index}`, label: `Column ${index}` }; },
    cellAt: (row, column) => { cells++; return `VALUE ${row} ${column}`; },
  };
  const viewer = await make(kind, source);
  await nextFrame();
  expect(viewer.shadowRoot!.querySelector('[role="table"]')?.getAttribute('aria-rowcount')).to.equal('1000001');
  recordScaleMeasurement(`lr-${kind}-viewer`, 'source1000000 initial mount', { cells, columns });
  for (const [row, column, range] of [[0, 0, 'A2'], [500000, 2, 'C500002'], [999999, 999, 'ALL1000001']] as const) {
    cells = 0; columns = 0;
    expect(await viewer.scrollToAnchor({ kind: 'cell-range', range })).to.equal(true);
    const list = viewer.shadowRoot!.querySelector('lr-virtual-list')!;
    await waitUntil(() => list.shadowRoot!.textContent!.includes(`VALUE ${row} ${column}`));
    const mounted = list.shadowRoot!.querySelectorAll('[role="cell"]').length;
    expect(cells).to.be.lessThan(20000);
    expect(columns).to.be.lessThan(200);
    expect(mounted).to.be.lessThan(1000);
    recordScaleMeasurement(`lr-${kind}-viewer`, `source1000000 row=${row} column=${column}`, { cells, columns, mountedCells: mounted });
  }
});

it('keeps legacy inputs unchanged and restores them when a provider is removed', async () => {
  const source: LyraTabularSource = { revision: 1, rowCount: 1000000, columnCount: 3, columnAt: i => ({ key: String(i), label: `Header ${i}` }), cellAt: (r, c) => `${r}:${c}` };
  const viewer = await fixture<LyraCsvViewer>(html`<lr-csv-viewer .rows=${[['Legacy header'], ['Legacy row']]} .dataSource=${source}></lr-csv-viewer>`);
  await nextFrame();
  expect(viewer.rows?.[1]?.[0]).to.equal('Legacy row');
  expect(viewer.shadowRoot!.querySelector('[role="table"]')!.getAttribute('aria-rowcount')).to.equal('1000001');
  viewer.dataSource = undefined;
  await waitUntil(() => viewer.shadowRoot!.querySelector('[role="table"]')?.getAttribute('aria-rowcount') === '2');
  expect(viewer.rows?.[1]?.[0]).to.equal('Legacy row');
});

it('publishes nonexact unavailable search and uses only provider global search when present', async () => {
  let calls = 0;
  const source: LyraTabularSource = { revision: 1, rowCount: 1000000, columnCount: 3, columnAt: i => ({ key: String(i), label: `Header ${i}` }), cellAt: (r, c) => `${r}:${c}` };
  const viewer = await make('csv', source);
  const details: Array<{ matchCount: number; matchCountExact: boolean }> = [];
  viewer.addEventListener('lr-search-change', event => details.push((event as CustomEvent).detail));
  expect(await viewer.search('missing')).to.equal(0);
  expect(details.at(-1)?.matchCountExact).to.equal(false);
  expect(viewer.shadowRoot!.querySelector('[part="search-status"]') !== null).to.equal(true);
  source.search = async request => { calls++; expect(request.limit).to.equal(1000); return { hits: [{ row: 999999, column: 2 }], total: 9000, exhaustive: false }; };
  viewer.requestUpdate(); await viewer.updateComplete;
  expect(await viewer.search('tail')).to.equal(1);
  expect(calls).to.equal(1);
  expect(details.at(-1)).to.include({ matchCount: 1, matchCountExact: false });
  expect(viewer.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!.textContent).to.include('999999:2');
});

it('aborts replaced reads, bounds ignored-abort concurrency and promptly rejects stale reveals', async () => {
  type Pending = { request: import('../../data-sources.js').LyraTabularReadRequest; resolve(value: readonly (readonly string[])[]): void };
  const pending: Pending[] = [];
  const source: LyraTabularSource = { revision: 1, rowCount: 1000000, columnCount: 3, columnAt: i => ({ key: String(i), label: `Header ${i}` }),
    readCells: request => new Promise(resolve => pending.push({ request, resolve })) };
  const viewer = await make('csv', source);
  await waitUntil(() => pending.length === 2);
  const old = viewer.scrollToAnchor({ kind: 'cell-range', range: 'C500002' });
  await nextFrame();
  viewer.dataSource = { revision: 2, rowCount: 1000000, columnCount: 3, columnAt: i => ({ key: String(i), label: `New ${i}` }), cellAt: (r, c) => `NEW ${r}:${c}` };
  await viewer.updateComplete;
  expect(pending.every(item => item.request.signal.aborted)).to.equal(true);
  expect(pending.length).to.equal(2);
  for (const item of pending) item.resolve(Array.from({ length: item.request.rowCount }, () => Array.from({ length: item.request.columnCount }, () => 'STALE')));
  await waitUntil(() => viewer.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot!.textContent?.includes('NEW 0:0') === true);
  expect(await old).to.equal(false);
  expect(viewer.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!.textContent).not.to.include('STALE');
});

it('uses separate labels when CSV headers are hidden and refreshes a mutable source explicitly', async () => {
  let value = 'before', reads = 0;
  const source: LyraTabularSource = { revision: 1, rowCount: 1000000, columnCount: 3, columnAt: i => ({ key: String(i), label: `Header ${i}` }), cellAt: () => { reads++; return value; } };
  const viewer = await make('csv', source) as LyraCsvViewer;
  viewer.withoutHeaderRow = true; await viewer.updateComplete;
  expect(viewer.shadowRoot!.querySelector('[role="table"]')!.getAttribute('aria-rowcount')).to.equal('1000000');
  expect(await viewer.scrollToAnchor({ kind: 'cell-range', range: 'A1' })).to.equal(true);
  reads = 0; viewer.name = 'New name'; await viewer.updateComplete; await nextFrame();
  expect(reads).to.equal(0);
  value = 'after'; viewer.name = 'Next name'; viewer.requestUpdate(); await viewer.updateComplete;
  await waitUntil(() => viewer.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!.textContent!.includes('after'));
  expect(reads).to.be.at.most(384);
});

it('loads only the active workbook sheet and reveals global hits by stable sheet key', async () => {
  const reads = [0, 0];
  const sheet = (which: number): LyraTabularSource => ({ revision: 1, rowCount: 1000000, columnCount: 3, columnAt: i => ({ key: String(i), label: `Header ${i}` }), cellAt: (r, c) => { reads[which] = reads[which]! + 1; return `SHEET ${which} ${r}:${c}`; } });
  const source: LyraWorkbookSource = { revision: 1, sheets: [{ key: 'one', name: 'First', data: sheet(0) }, { key: 'two', name: 'Second', data: sheet(1) }],
    search: async () => ({ hits: [{ sheetKey: 'two', row: 999999, column: 2 }], total: 1, exhaustive: true }) };
  const viewer = await fixture<LyraSpreadsheetViewer>(html`<lr-spreadsheet-viewer .dataSource=${source}></lr-spreadsheet-viewer>`);
  await nextFrame(); expect(reads[1]).to.equal(0);
  expect(await viewer.search('final')).to.equal(1);
  expect(viewer.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!.textContent).to.include('SHEET 1 999999:2');
  expect(reads[1]).to.be.at.most(768);
  expect(await viewer.scrollToAnchor({ kind: 'cell-range', sheet: 'First', range: 'B500002' })).to.equal(true);
});

it('fails closed on invalid source metadata and malformed rectangles', async () => {
  const errors: unknown[] = [];
  const viewer = await fixture<LyraCsvViewer>(html`<lr-csv-viewer .rows=${[['legacy']]} @lr-render-error=${(event: CustomEvent) => errors.push((event as CustomEvent).detail.error)}></lr-csv-viewer>`);
  viewer.dataSource = { revision: 1, rowCount: -1, columnCount: 3, columnAt: i => ({ key: String(i), label: 'Header' }), cellAt: () => 'invalid' };
  await viewer.updateComplete;
  expect(viewer.shadowRoot!.querySelector('[part="error"]') !== null).to.equal(true);
  expect(errors.length).to.equal(1);
  viewer.dataSource = { revision: 2, rowCount: 1000000, columnCount: 3, columnAt: i => ({ key: String(i), label: 'Header' }), readCells: async () => [] };
  await waitUntil(() => errors.length >= 2);
  expect(viewer.shadowRoot!.querySelector('[part="error"]') !== null).to.equal(true);
});


it('rejects out-of-range global hits and inconsistent exhaustive totals', async () => {
  const errors: unknown[] = [];
  const source: LyraTabularSource = { revision: 1, rowCount: 1000000, columnCount: 3, columnAt: i => ({ key: String(i), label: 'Header' }), cellAt: () => 'cell',
    search: async () => ({ hits: [{ row: 1000000, column: 0 }], total: 1, exhaustive: true }) };
  const viewer = await make('csv', source);
  viewer.addEventListener('lr-render-error', event => errors.push((event as CustomEvent).detail.error));
  expect(await viewer.search('bad')).to.equal(0);
  expect(errors.length).to.equal(1);
  source.search = async () => ({ hits: [{ row: 0, column: 0 }], total: 2, exhaustive: true });
  viewer.requestUpdate(); await viewer.updateComplete;
  expect(await viewer.search('inconsistent')).to.equal(0);
  expect(errors.length).to.equal(2);
});

it('uses live source row geometry and retains bounded windows after RTL width changes', async () => {
  const source: LyraTabularSource = { revision: 1, rowCount: 1000000, columnCount: 1000, columnAt: i => ({ key: String(i), label: `Header ${i}` }), cellAt: (r, c) => `${r}:${c}` };
  const viewer = await make('dataset', source);
  viewer.style.setProperty('--lr-size-3rem', '4em'); viewer.style.fontSize = '20px';
  await nextFrame(); await nextFrame();
  const list = viewer.shadowRoot!.querySelector('lr-virtual-list')!;
  expect(list.rowHeight).to.equal(80);
  expect(getComputedStyle(list.shadowRoot!.querySelector('[part="data-row"]')!).height).to.equal('80px');
  viewer.dir = 'rtl'; viewer.style.width = '320px'; await nextFrame(); await nextFrame();
  expect(await viewer.scrollToAnchor({ kind: 'cell-range', range: 'ALL1000001' })).to.equal(true);
  expect(list.shadowRoot!.textContent).to.include('999999:999');
  expect(list.shadowRoot!.querySelectorAll('[role="cell"]').length).to.be.lessThan(1000);
});

it('accepts a new anchor immediately after source assignment and cancels earlier navigation', async () => {
  const source: LyraTabularSource = { revision: 1, rowCount: 1000000, columnCount: 3, columnAt: i => ({ key: String(i), label: 'Header' }), cellAt: (r, c) => `${r}:${c}` };
  const viewer = await make('csv', source);
  viewer.dataSource = { ...source, revision: 2 };
  expect(await viewer.scrollToAnchor({ kind: 'cell-range', range: 'C1000001' })).to.equal(true);
});

it('settles stale searches promptly, serializes ignored-abort calls and uses the latest query', async () => {
  type Result = import('../../data-sources.js').LyraSourceSearchResult<import('../../data-sources.js').LyraTabularHit>;
  const pending: Array<{ request: import('../../data-sources.js').LyraSourceSearchRequest; resolve(result: Result): void }> = [];
  const source: LyraTabularSource = { revision: 1, rowCount: 1000000, columnCount: 3, columnAt: i => ({ key: String(i), label: 'Header' }), cellAt: (r, c) => `${r}:${c}`,
    search: request => new Promise(resolve => pending.push({ request, resolve })) };
  const viewer = await make('csv', source);
  const old = viewer.search('old');
  const middle = viewer.search('middle');
  const latest = viewer.search('latest');
  expect(await old).to.equal(0); expect(await middle).to.equal(0);
  expect(pending.length).to.equal(1); expect(pending[0]!.request.signal.aborted).to.equal(true);
  pending[0]!.resolve({ hits: [{ row: 2, column: 1 }], total: 1, exhaustive: true });
  await waitUntil(() => pending.length === 2);
  expect(pending[1]!.request.query).to.equal('latest');
  pending[1]!.resolve({ hits: [{ row: 999999, column: 2 }], total: 1, exhaustive: true });
  expect(await latest).to.equal(1);
  expect(viewer.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!.textContent).to.include('999999:2');
});

it('rejects oversized scalars and workbook descriptors before unbounded traversal', async () => {
  const errors: unknown[] = [];
  let reads = 0;
  const source: LyraTabularSource = { revision: 1, rowCount: 1000000, columnCount: 3, columnAt: i => ({ key: String(i), label: 'Header' }), cellAt: () => { reads++; return 'x'.repeat(65537); } };
  const viewer = await fixture<LyraCsvViewer>(html`<lr-csv-viewer .dataSource=${source} @lr-render-error=${(event: CustomEvent) => errors.push((event as CustomEvent).detail.error)}></lr-csv-viewer>`);
  await waitUntil(() => errors.length > 0);
  expect(reads).to.be.at.most(2);
  expect(viewer.shadowRoot!.querySelector('[part="error"]')!.textContent).not.to.include('x'.repeat(100));
  const workbook = await fixture<LyraSpreadsheetViewer>(html`<lr-spreadsheet-viewer .dataSource=${{ revision: 1, sheets: Array.from({ length: 257 }, (_, i) => ({ key: String(i), name: String(i), data: source })) }}></lr-spreadsheet-viewer>`);
  expect(workbook.shadowRoot!.querySelector('[part="error"]') !== null).to.equal(true);
});

it('reconnects the current source and localizes unavailable search without refreshing cells for string overrides', async () => {
  let reads = 0;
  const source: LyraTabularSource = { revision: 1, rowCount: 1000000, columnCount: 3, columnAt: i => ({ key: String(i), label: 'Header' }), cellAt: () => { reads++; return 'value'; } };
  const viewer = await make('csv', source);
  expect(viewer.shadowRoot!.querySelector('[part="search-status"]')!.textContent).to.equal('Search is unavailable for this data source.');
  const parent = viewer.parentNode!; viewer.remove(); parent.append(viewer);
  await nextFrame();
  expect(await viewer.scrollToAnchor({ kind: 'cell-range', range: 'A1000001' })).to.equal(true);
  reads = 0; viewer.strings = { sourceSearchUnavailable: 'No global finder' }; await viewer.updateComplete; await nextFrame();
  expect(viewer.shadowRoot!.querySelector('[part="search-status"]')!.textContent).to.equal('No global finder');
  expect(reads).to.equal(0);
});

it('loads the complete bounded visible interval when source row geometry is compact', async () => {
  const source: LyraTabularSource = { revision: 1, rowCount: 1000000, columnCount: 3, columnAt: i => ({ key: String(i), label: 'Header' }), cellAt: (r, c) => `${r}:${c}` };
  const viewer = await make('csv', source);
  viewer.style.setProperty('--lr-size-3rem', '1px');
  await nextFrame(); await nextFrame();
  const list = viewer.shadowRoot!.querySelector('lr-virtual-list')!;
  await waitUntil(() => list.shadowRoot!.textContent!.includes('250:0'));
  expect(list.shadowRoot!.querySelector('[data-row-index="250"] [role="cell"]')!.textContent).to.equal('250:0');
});


it('restores owned dataset and workbook inputs after removing their optional source', async () => {
  const source: LyraTabularSource = { revision: 1, rowCount: 1000000, columnCount: 3, columnAt: i => ({ key: String(i), label: 'Header' }), cellAt: () => 'source' };
  const dataset = await fixture<LyraDatasetViewer>(html`<lr-dataset-viewer .table=${{ fields: ['name'], rows: [{ name: 'Legacy dataset' }] }} .dataSource=${source}></lr-dataset-viewer>`);
  const workbook = await fixture<LyraSpreadsheetViewer>(html`<lr-spreadsheet-viewer .workbook=${{ sheets: [{ name: 'Legacy', rows: [['Name'], ['Legacy workbook']] }] }} .dataSource=${{ revision: 1, sheets: [{ key: 'source', name: 'Source', data: source }] }}></lr-spreadsheet-viewer>`);
  dataset.dataSource = undefined; workbook.dataSource = undefined;
  await waitUntil(() => dataset.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot!.textContent?.includes('Legacy dataset') === true);
  await waitUntil(() => workbook.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot!.textContent?.includes('Legacy workbook') === true);
  expect(dataset.table?.rows[0]?.['name']).to.equal('Legacy dataset');
  expect(workbook.workbook?.sheets[0]?.name).to.equal('Legacy');
});

it('settles invalid revision metadata once and keeps reentrant source replacement authoritative', async () => {
  const errors: unknown[] = [];
  const valid: LyraTabularSource = { revision: 1, rowCount: 1000000, columnCount: 3, columnAt: i => ({ key: String(i), label: 'Header' }), cellAt: () => 'new source' };
  const viewer = await make('csv', valid);
  viewer.addEventListener('lr-render-error', event => errors.push((event as CustomEvent).detail.error));
  viewer.dataSource = { ...valid, revision: '' }; await nextFrame(); await nextFrame();
  expect(errors.length).to.equal(1);
  const reentrant: LyraTabularSource = { ...valid, revision: 2, columnAt: i => { viewer.dataSource = valid; return { key: String(i), label: 'obsolete' }; } };
  viewer.dataSource = reentrant;
  await waitUntil(() => viewer.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot!.textContent?.includes('new source') === true);
  expect(viewer.dataSource === valid).to.equal(true);
  expect(viewer.shadowRoot!.textContent).not.to.include('obsolete');
});

it('keeps absolute final-row and far-column navigation in page-scrolling mode', async () => {
  const source: LyraTabularSource = { revision: 1, rowCount: 1000000, columnCount: 1000, columnAt: i => ({ key: String(i), label: 'Header' }), cellAt: (r, c) => `${r}:${c}` };
  const viewer = await make('dataset', source) as LyraDatasetViewer;
  try {
    viewer.scrollMode = 'page'; await viewer.updateComplete;
    expect(await viewer.scrollToAnchor({ kind: 'cell-range', range: 'ALL1000001' })).to.equal(true);
    expect(viewer.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!.textContent).to.include('999999:999');
  } finally { window.scrollTo(0, 0); }
});


it('switches source workbook tabs through upgraded controls without adding tabs to scalar viewers', async () => {
  const sheet = (name: string): LyraTabularSource => ({
    revision: 1, rowCount: 2, columnCount: 1,
    columnAt: () => ({ key: 'value', label: 'Value' }),
    cellAt: row => `${name} ${row}`,
  });
  const first = sheet('First sheet');
  const viewer = await fixture<LyraSpreadsheetViewer>(html`<lr-spreadsheet-viewer .dataSource=${{
    revision: 1, sheets: [{ key: 'first', name: 'First', data: first },
      { key: 'second', name: 'Second', data: sheet('Second sheet') }],
  }}></lr-spreadsheet-viewer>`);
  const cells = () => viewer.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot?.textContent ?? '';
  await waitUntil(() => cells().includes('First sheet'));
  const tabs = viewer.shadowRoot!.querySelector<HTMLElement & { active: string; updateComplete: Promise<boolean> }>('lr-tab-group')!;
  await tabs.updateComplete;
  expect(tabs.shadowRoot!.querySelectorAll('[part="tab"]').length).to.equal(2);
  let escaped = 0;
  viewer.addEventListener('lr-tab-show', () => escaped++);
  tabs.shadowRoot!.querySelectorAll<HTMLElement>('[part="tab"]')[1]!.click();
  await waitUntil(() => cells().includes('Second sheet'));
  expect(tabs.active).to.equal('source-1');
  expect(escaped).to.equal(0);
  for (const kind of ['csv', 'dataset'] as const) {
    const scalar = await make(kind, first);
    await nextFrame();
    expect(scalar.shadowRoot!.querySelector('lr-tab-group') === null).to.equal(true);
  }
});
