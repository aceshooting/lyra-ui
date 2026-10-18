import { expect, html, nextFrame } from '@open-wc/testing';
import { dataGrid } from '../../../../test/data-grid.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import type { DataGridColumn } from './data-grid-types.js';
interface Row { id: number; name: string }
const rows: Row[] = Array.from({ length: 10_000 }, (_, id) => ({ id, name: `Row ${id}` }));
async function settle(element: { updateComplete: Promise<boolean> }): Promise<void> {
  for (let index = 0; index < 3; index += 1) { await element.updateComplete; await nextFrame(); }
}
describe('data-grid scale budgets', () => {
  it('reuses sorted rows, folded search cells and footers across interaction updates', async () => {
    let sortReads = 0; let searchReads = 0; let footers = 0;
    const columns: DataGridColumn<Row>[] = [
      { id: 'name', value: row => { searchReads += 1; return row.name; }, footer: () => { footers += 1; return 'Rows'; } },
      { id: 'id', searchable: false, value: row => { sortReads += 1; return row.id; } },
    ];
    const element = await dataGrid<Row>(html`<lr-data-grid label="Scale" row-key="id" selectable="multiple" .data=${rows} .columns=${columns} .sort=${[{ id: 'id', desc: false }]} .searchTerm=${'Row'}></lr-data-grid>`);
    await settle(element);
    sortReads = searchReads = footers = 0;
    element.searchTerm = 'Row 1'; await settle(element);
    expect(sortReads, 'sorting reads only mounted cells after a search').lessThan(200);
    expect(searchReads, 'search uses folded cells').lessThan(200);
    sortReads = searchReads = footers = 0;
    element.selectedRowKeys = [1]; await settle(element);
    expect(sortReads).lessThan(200); expect(searchReads).lessThan(200);
    expect(footers, 'selection does not evaluate the footer again').equal(0);
    recordScaleMeasurement('lr-data-grid', 'n=10000 selection after search', { sortReads, searchReads, footers });
  });
  it('keeps an expanded detail inside the row window', async () => {
    const element = await dataGrid<Row>(html`<lr-data-grid label="Details" row-key="id" .data=${rows} .columns=${[{ field: 'name' }]} .rowDetail=${(row: Row) => html`<div style="height:80px">${row.name}</div>`} .expandedRowKeys=${[0]}></lr-data-grid>`);
    await settle(element);
    const mountedRows = element.shadowRoot!.querySelectorAll('[part~="row"]').length;
    expect(mountedRows).lessThan(100);
    expect(element.shadowRoot!.querySelectorAll('[part="row-detail"]').length).equal(1);
    recordScaleMeasurement('lr-data-grid', 'n=10000 expand detail', { mountedRows });
  });
  it('windows one thousand columns and preserves logical column positions', async () => {
    const columns: DataGridColumn<Row>[] = Array.from({ length: 1_000 }, (_, id) => ({ id: `c${id}`, width: 120, value: row => row.id }));
    const element = await dataGrid<Row>(html`<lr-data-grid label="Wide" style="width:600px" .columns=${columns} .data=${rows}></lr-data-grid>`);
    await settle(element);
    const mountedCells = element.shadowRoot!.querySelectorAll('[part~="cell"]').length;
    expect(mountedCells).lessThan(1_000);
    const body = element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
    body.scrollLeft = 60_000; body.dispatchEvent(new Event('scroll')); await settle(element);
    expect(element.shadowRoot!.querySelector('[part="header-cell"][data-column-id="c500"]') !== null).equal(true);
    recordScaleMeasurement('lr-data-grid', 'n=10000 c=1000 inline scroll', { mountedCells });
  });
  it('raises row admission while retaining the default and hard maximum', async () => {
    const many = Array.from({ length: 100_001 }, (_, id) => ({ id, name: `${id}` }));
    const element = await dataGrid<Row>(html`<lr-data-grid label="Admission" row-key="id" .data=${many} .columns=${[{ field: 'name' }]}></lr-data-grid>`);
    expect(element.data.length, 'default admission is bounded').equal(10_000);
    element.setAttribute('max-rows', '20000'); element.data = many.slice(); await settle(element);
    expect(element.getProcessedRows().length).equal(20_000);
    element.setAttribute('max-rows', '1000000'); element.data = many.slice(); await settle(element);
    expect(element.getProcessedRows().length).equal(100_000);
    recordScaleMeasurement('lr-data-grid', 'n=100001 bounded admission', { retainedRows: element.data.length });
  });
});

it('reuses tree children and selection summaries on a view-only update', async () => {
  let childrenReads = 0;
  const element = await dataGrid<Row>(html`<lr-data-grid label="Tree scale" row-key="id" selectable="multiple"
    .data=${rows} .columns=${[{ field: 'name' }]} .childRows=${() => { childrenReads += 1; return []; }}></lr-data-grid>`);
  await settle(element);
  childrenReads = 0;
  const body = element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
  body.scrollTop = 400; body.dispatchEvent(new Event('scroll')); await settle(element);
  expect(childrenReads).equal(0);
  recordScaleMeasurement('lr-data-grid', 'n=10000 tree scroll', { childrenReads });
});

it('avoids full display scans when selecting a row repeatedly', async () => {
  let selectableReads = 0;
  const element = await dataGrid<Row>(html`<lr-data-grid label="Selection scale" row-key="id" selectable="multiple"
    .data=${rows} .columns=${[{ field: 'name' }]} .selectableRows=${() => { selectableReads += 1; return true; }}></lr-data-grid>`);
  await settle(element);
  const box = () => element.shadowRoot!.querySelector<HTMLInputElement>('[part~="row"] input')!;
  box().click(); await settle(element);
  selectableReads = 0;
  box().click(); await settle(element);
  expect(selectableReads).lessThan(200);
  recordScaleMeasurement('lr-data-grid', 'n=10000 repeated row selection', { selectableReads });
});

it('bounds geometry token reads during a ten-thousand-row scroll', async () => {
  const element = await dataGrid<Row>(html`<lr-data-grid label="Geometry scale" row-key="id" .data=${rows} .columns=${[{ field: 'name' }]}></lr-data-grid>`);
  await settle(element);
  const internal = element as unknown as { computedToken(...keys: string[]): string };
  const original = internal.computedToken;
  let rowHeightReads = 0;
  internal.computedToken = function (...keys) {
    if (keys[0] === '--row-height') rowHeightReads += 1;
    return original.apply(this, keys);
  };
  try {
    const body = element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
    body.scrollTop = 400; body.dispatchEvent(new Event('scroll')); await settle(element);
  } finally { internal.computedToken = original; }
  expect(rowHeightReads).at.most(4);
  recordScaleMeasurement('lr-data-grid', 'n=10000 geometry scroll', { rowHeightReads });
});

it('reuses group aggregates during focus and scrolling', async () => {
  let aggregates = 0;
  const element = await dataGrid<Row>(html`<lr-data-grid label="Grouped scale" row-key="id" .data=${rows}
    .groupBy=${['group']} .columns=${[{ id: 'group', value: () => 'All' },
      { field: 'id', aggregation: (members: readonly Row[]) => { aggregates += 1; return members.length; } }]}></lr-data-grid>`);
  await settle(element); aggregates = 0;
  const group = element.shadowRoot!.querySelector<HTMLElement>('[part="group-value"]')!;
  group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  await settle(element);
  expect(aggregates).equal(0);
  recordScaleMeasurement('lr-data-grid', 'n=10000 grouped navigation', { aggregates });
});

it('preserves default row disclosure, guards invalid limits, and admits without array getters', async () => {
  const element = await dataGrid<Row>(html`<lr-data-grid label="Limits" row-key="id" .data=${[...rows, { id: 10_000, name: 'Extra' }]} .columns=${[{ field: 'name' }]}></lr-data-grid>`);
  expect(element.maxRows).equal(10_000);
  expect(element.getProcessedRows().length).equal(10_000);
  expect(element.shadowRoot!.querySelector('[part="row-limit"]')?.textContent?.trim()).equal('Only the first 10,000 rows are shown.');
  element.maxRows = NaN; element.data = rows.slice(); await settle(element);
  expect(element.getProcessedRows().length).equal(10_000);
  element.maxRows = -1; element.data = rows.slice(); await settle(element);
  expect(element.getProcessedRows().length).equal(1);
  let reads = 0;
  const unsafe = [{ id: 1, name: 'Safe' }, { id: 2, name: 'Unsafe' }];
  Object.defineProperty(unsafe, '1', { get() { reads += 1; return { id: 2, name: 'Unsafe' }; } });
  element.maxRows = 20_000; element.data = unsafe; await settle(element);
  expect(reads).equal(0); expect(element.data.length).equal(1);
});

it('updates variable row offsets without reading every measured key again', async () => {
  const element = await dataGrid<Row>(html`<lr-data-grid label="Offset scale" row-key="id" .data=${rows}
    .columns=${[{ field: 'name', formatter: (value: unknown) => html`<div style="height:90px">${value}</div>` }]}></lr-data-grid>`);
  await settle(element);
  const internal = element as unknown as { measuredItemHeights: Map<string, number> };
  const heights = internal.measuredItemHeights;
  const original = heights.get;
  let heightLookups = 0;
  heights.get = function (key) { heightLookups += 1; return original.call(this, key); };
  try {
    const body = element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
    body.scrollTop = 4000; body.dispatchEvent(new Event('scroll')); await settle(element);
  } finally { heights.get = original; }
  expect(heightLookups).lessThan(200);
  recordScaleMeasurement('lr-data-grid', 'n=10000 variable height scroll', { heightLookups });
});

it('reuses folded text-column filters across queries', async () => {
  const element = await dataGrid<Row>(html`<lr-data-grid label="Column filter scale" row-key="id" .data=${rows}
    .columns=${[{ field: 'name', id: 'name' }]} .filters=${[{ id: 'name', value: 'Row' }]}></lr-data-grid>`);
  await settle(element);
  const original = String.prototype.toLocaleLowerCase;
  let rowFolds = 0;
  String.prototype.toLocaleLowerCase = function (locale) {
    if (/^Row \d+$/u.test(String(this))) rowFolds += 1;
    return original.call(this, locale);
  };
  try { element.filters = [{ id: 'name', value: 'Row 1' }]; await settle(element); }
  finally { String.prototype.toLocaleLowerCase = original; }
  expect(rowFolds).lessThan(200);
  recordScaleMeasurement('lr-data-grid', 'n=10000 text column filter', { rowFolds });
});

for (const direction of ['ltr', 'rtl']) it(`keeps pinned columns and full ARIA indexes while windowing ${direction}`, async () => {
  const columns: DataGridColumn<Row>[] = Array.from({ length: 1_000 }, (_, id) => ({
    id: `c${id}`, width: 120, value: row => row.id,
    ...(id === 0 ? { pinned: 'start' as const } : id === 999 ? { pinned: 'end' as const } : {}),
  }));
  const element = await dataGrid<Row>(html`<lr-data-grid label="Pinned wide grid" dir=${direction} style="width:600px"
    .data=${rows} .columns=${columns}></lr-data-grid>`);
  await settle(element);
  const body = element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
  body.scrollLeft = direction === 'rtl' ? -60_000 : 60_000;
  body.dispatchEvent(new Event('scroll')); await settle(element);
  expect(element.shadowRoot!.querySelector('[part="header-cell"][data-column-id="c500"]')?.getAttribute('aria-colindex')).equal('501');
  expect(element.shadowRoot!.querySelector('[part="header-cell"][data-column-id="c0"]') !== null).equal(true);
  expect(element.shadowRoot!.querySelector('[part="header-cell"][data-column-id="c999"]') !== null).equal(true);
  expect(element.shadowRoot!.querySelectorAll('[part="cell"]').length).lessThan(1_000);
});
