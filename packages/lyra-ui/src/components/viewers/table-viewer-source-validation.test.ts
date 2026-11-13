import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { shrinkAnchorRetry } from '../../../test/viewer-scroll-test-support.js';
import type { LyraTabularSource, LyraWorkbookSource } from '../../data-sources.js';
import type { LyraCsvViewer } from './csv-viewer/csv-viewer.js';
import type { LyraSpreadsheetViewer } from './spreadsheet-viewer/spreadsheet-viewer.js';
import type { LyraAnchor } from './document-viewer/anchors.js';
import { tableHighlightsForColumn, tableHighlightsForRow } from './table-viewer-shared.js';
import './csv-viewer/csv-viewer.js';
import './spreadsheet-viewer/spreadsheet-viewer.js';

const strings = { documentPreviewFailedToLoad: 'Source rejected', documentPreviewResourceTooLarge: 'Source exceeds limits' };
function source(): LyraTabularSource {
  return { revision: 1, rowCount: 3, columnCount: 2,
    columnAt: index => ({ key: String(index), label: `Column ${index}` }),
    cellAt: (row, column) => `Cell ${row}:${column}` };
}
async function csv(data: LyraTabularSource) {
  const errors: unknown[] = [];
  const viewer = await fixture<LyraCsvViewer>(html`<lr-csv-viewer .dataSource=${data} .strings=${strings}
    @lr-render-error=${(event: CustomEvent<{ error: unknown }>) => errors.push(event.detail.error)}></lr-csv-viewer>`);
  shrinkAnchorRetry(viewer);
  return { viewer, errors };
}
async function workbook(data: LyraWorkbookSource) {
  const errors: unknown[] = [];
  const viewer = await fixture<LyraSpreadsheetViewer>(html`<lr-spreadsheet-viewer .dataSource=${data} .strings=${strings}
    @lr-render-error=${(event: CustomEvent<{ error: unknown }>) => errors.push(event.detail.error)}></lr-spreadsheet-viewer>`);
  shrinkAnchorRetry(viewer);
  return { viewer, errors };
}
async function rejected(viewer: LyraCsvViewer | LyraSpreadsheetViewer, errors: unknown[]) {
  await waitUntil(() => errors.length > 0 && viewer.shadowRoot!.querySelector('[part="error"]') !== null);
  expect(viewer.shadowRoot!.querySelector('[part="error"]')!.textContent).to.match(/^Source (rejected|exceeds limits)$/);
  expect(viewer.shadowRoot!.querySelectorAll('[role="table"]').length).to.equal(0);
  expect(await viewer.scrollToAnchor({ kind: 'cell-range', range: 'A2' })).to.equal(false);
}

it('preserves empty highlight collections without inventing row or column highlights', () => {
  const highlights = Object.freeze([]);
  expect(tableHighlightsForRow(highlights, 1)).to.deep.equal([]);
  expect(tableHighlightsForColumn(highlights, 0)).to.deep.equal([]);
});

it('rejects ambiguous workbook sheet identities and oversized sheet names before reading cells', async () => {
  for (const sheets of [
    [{ key: '', name: 'Sheet' }],
    [{ key: 'one', name: '' }],
    [{ key: 'same', name: 'First' }, { key: 'same', name: 'Second' }],
    [{ key: 'one', name: 'Same' }, { key: 'two', name: 'Same' }],
    [{ key: 'x'.repeat(65_537), name: 'Sheet' }],
    [{ key: 'one', name: 'x'.repeat(65_537) }],
  ]) {
    let reads = 0;
    const data = source();
    data.cellAt = () => { reads++; return 'unused'; };
    const { viewer, errors } = await workbook({ revision: 1, sheets: sheets.map(sheet => ({ ...sheet, data })) });
    await rejected(viewer, errors);
    expect(reads).to.equal(0);
  }
});

it('accepts an empty workbook as an empty state and rejects missing sheet anchors', async () => {
  const { viewer, errors } = await workbook({ revision: 1, sheets: [] });
  expect(viewer.shadowRoot!.querySelectorAll('[role="table"]').length).to.equal(0);
  expect(viewer.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
  expect(await viewer.scrollToAnchor({ kind: 'cell-range', sheet: 'Missing', range: 'A1' })).to.equal(false);
  expect(await viewer.searchNext()).to.equal(false);
  expect(errors.length).to.equal(0);
});

it('rejects ambiguous source read contracts and unsafe row geometry', async () => {
  for (const kind of ['both readers', 'no reader', 'no column reader', 'unsafe row count'] as const) {
    const data = source();
    if (kind === 'both readers') Reflect.set(data, 'readCells', async () => []);
    else if (kind === 'no reader') Reflect.deleteProperty(data, 'cellAt');
    else if (kind === 'no column reader') Reflect.deleteProperty(data, 'columnAt');
    else Reflect.set(data, 'rowCount', Number.MAX_SAFE_INTEGER);
    const { viewer, errors } = await csv(data);
    await rejected(viewer, errors);
  }
});

it('rejects invalid source columns and non-scalar cell results with localized errors', async () => {
  for (const column of [null, { key: '', label: 'Column' }, { key: 'a', label: 42 },
    { key: 'x'.repeat(65_537), label: 'Column' }, { key: 'a', label: 'x'.repeat(65_537) }]) {
    const data = source();
    Reflect.set(data, 'columnAt', () => column);
    const { viewer, errors } = await csv(data);
    await rejected(viewer, errors);
  }
  for (const value of [{ secret: 'provider detail' }, NaN, Infinity, 1n, Symbol('cell')]) {
    const data = source();
    Reflect.set(data, 'cellAt', () => value);
    const { viewer, errors } = await csv(data);
    await rejected(viewer, errors);
  }
});

it('rejects malformed provider search results instead of accepting partial matches', async () => {
  for (const reply of [null, { hits: {}, total: 0, exhaustive: true },
    { hits: [], total: 0, exhaustive: 'yes' },
    { hits: [{ row: -2, column: 0 }], total: 1, exhaustive: true },
    { hits: [{ row: 0.5, column: 0 }], total: 1, exhaustive: true },
    { hits: [{ row: 0, column: -1 }], total: 1, exhaustive: true }]) {
    const data = source();
    Reflect.set(data, 'search', async () => reply);
    const { viewer, errors } = await csv(data);
    expect(await viewer.search('Cell')).to.equal(0);
    await rejected(viewer, errors);
  }
  const { viewer, errors } = await workbook({ revision: 1, sheets: [{ key: 'one', name: 'One', data: source() }],
    search: async () => ({ hits: [{ sheetKey: 'missing', row: 0, column: 0 }], total: 1, exhaustive: true }) });
  expect(await viewer.search('Cell')).to.equal(0);
  await rejected(viewer, errors);
});

it('steps source matches in both directions and clears them without another provider search', async () => {
  let searches = 0;
  const data = source();
  data.search = async () => {
    searches++;
    return { hits: [{ row: 0, column: 0 }, { row: 2, column: 1 }], total: 2, exhaustive: true };
  };
  const { viewer, errors } = await csv(data);
  expect(await viewer.search('Cell')).to.equal(2);
  const list = viewer.shadowRoot!.querySelector('lr-virtual-list')!;
  expect(list.activeItemId).to.equal(0);
  expect(await viewer.searchNext()).to.equal(true);
  expect(list.activeItemId).to.equal(2);
  expect(await viewer.searchPrevious()).to.equal(true);
  expect(list.activeItemId).to.equal(0);
  expect(await viewer.search('  ')).to.equal(0);
  expect(await viewer.searchNext()).to.equal(false);
  expect(searches).to.equal(1);
  expect(errors.length).to.equal(0);
});

for (const malformedRow of ['not an array', 'missing cell', 'extra cell'] as const) {
  it(`rejects a malformed rectangular source row (${malformedRow}) and recovers on source replacement`, async () => {
    const errors: unknown[] = [];
    const data: LyraTabularSource = {
      revision: 1, rowCount: 3, columnCount: 2,
      columnAt: index => ({ key: String(index), label: `Column ${index}` }),
      readCells: async request => {
        const rows = Array.from({ length: request.rowCount }, () =>
          Array.from({ length: request.columnCount }, () => 'Provider content'));
        const first = rows[0]!;
        if (malformedRow === 'not an array') Reflect.set(rows, 0, 'Provider content');
        else if (malformedRow === 'missing cell') first.pop();
        else first.push('Unexpected column');
        return rows;
      },
    };
    const viewer = await fixture<LyraCsvViewer>(html`<lr-csv-viewer
      .dataSource=${data} .rows=${[['Legacy content']]} .strings=${strings}
      @lr-render-error=${(event: CustomEvent<{ error: unknown }>) => errors.push(event.detail.error)}
    ></lr-csv-viewer>`);
    await waitUntil(() => viewer.shadowRoot!.querySelector('[part="error"]') !== null);
    expect(errors.length).to.equal(1);
    const error = viewer.shadowRoot!.querySelector('[part="error"]')!;
    expect(error.textContent).to.equal('Source rejected');
    expect(error.hasAttribute('role') || error.hasAttribute('aria-live')).to.equal(false);
    expect(viewer.shadowRoot!.querySelectorAll('[role="table"]').length).to.equal(0);
    expect(viewer.shadowRoot!.textContent).not.to.contain('Legacy content');

    viewer.dataSource = source();
    await waitUntil(() => viewer.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot?.textContent?.includes('Cell 0:0') === true);
    expect(viewer.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
    expect(await viewer.scrollToAnchor({ kind: 'cell-range', range: 'A2' })).to.equal(true);
    expect(errors.length).to.equal(1);
    viewer.remove();
  });
}

it('rejects cumulative retained cell text before reading an otherwise bounded source window in full', async () => {
  const errors: unknown[] = [];
  const text = 'x'.repeat(50_000);
  let reads = 0;
  const data: LyraTabularSource = {
    revision: 1, rowCount: 64, columnCount: 2,
    columnAt: index => ({ key: String(index), label: `Column ${index}` }),
    cellAt: () => { reads++; return text; },
  };
  const viewer = await fixture<LyraCsvViewer>(html`<lr-csv-viewer
    .dataSource=${data} .rows=${[['Legacy content']]} .strings=${strings}
    @lr-render-error=${(event: CustomEvent<{ error: unknown }>) => errors.push(event.detail.error)}
  ></lr-csv-viewer>`);
  await waitUntil(() => viewer.shadowRoot!.querySelector('[part="error"]') !== null);
  expect(viewer.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Source exceeds limits');
  expect(errors.length).to.equal(1);
  expect(reads).to.be.greaterThan(1);
  expect(reads).to.be.at.most(40);
  expect(viewer.shadowRoot!.querySelectorAll('[role="table"]').length).to.equal(0);
  expect(viewer.shadowRoot!.textContent).not.to.contain('Legacy content');
  expect(viewer.rows).to.deep.equal([['Legacy content']]);
});

for (const kind of ['csv', 'workbook'] as const) {
  it(`rejects invalid ${kind} source anchors without losing current cells or subsequent navigation`, async () => {
    const data = source();
    let reads = 0;
    data.cellAt = (row, column) => { reads++; return `Cell ${row}:${column}`; };
    const { viewer, errors } = kind === 'csv' ? await csv(data) : await workbook({
      revision: 1, sheets: [{ key: 'main', name: 'Main', data }],
    });
    const list = () => viewer.shadowRoot!.querySelector('lr-virtual-list')!;
    await waitUntil(() => list()?.shadowRoot?.textContent?.includes('Cell 0:0') === true);
    expect(await viewer.scrollToAnchor({ kind: 'cell-range', range: 'B3' })).to.equal(true);
    expect(list().activeItemId).to.equal(1);
    const initialReads = reads;
    const invalid: LyraAnchor[] = [
      { kind: 'page', page: 1 },
      { kind: 'cell-range', range: '' },
      { kind: 'cell-range', range: 'A0' },
      { kind: 'cell-range', range: 'A1:B2:C3' },
      { kind: 'cell-range', range: 'A5' },
      { kind: 'cell-range', range: 'C2' },
      { kind: 'cell-range', sheet: 'Missing', range: 'A2' },
      { kind: 'cell-range', range: "'Missing sheet'!A2" },
    ];
    for (const anchor of invalid) {
      expect(await viewer.scrollToAnchor(anchor), JSON.stringify(anchor)).to.equal(false);
      expect(list().activeItemId).to.equal(1);
      expect(viewer.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
    }
    expect(reads).to.equal(initialReads);
    expect(errors.length).to.equal(0);
    expect(list().shadowRoot!.textContent).to.include('Cell 1:1');
    expect(await viewer.scrollToAnchor({ kind: 'cell-range', range: 'A4' })).to.equal(true);
    expect(list().activeItemId).to.equal(2);
    expect(await viewer.scrollToAnchor({ kind: 'cell-range', range: 'B1' })).to.equal(true);
    expect(viewer.shadowRoot!.querySelector('[part="header-row"] [aria-colindex="2"]')!.textContent).to.include('Column 1');
  });
}

it('preserves CSV source raw-grid coordinates when headers are hidden', async () => {
  const data = source();
  const { viewer, errors } = await csv(data);
  await waitUntil(() => viewer.shadowRoot!.querySelectorAll('[part="header-row"]').length === 1);
  expect(await viewer.scrollToAnchor({ kind: 'cell-range', range: 'B1' })).to.equal(true);
  expect(viewer.shadowRoot!.querySelector('[part="header-row"] [aria-colindex="2"]')!.textContent).to.include('Column 1');
  viewer.withoutHeaderRow = true;
  await viewer.updateComplete;
  expect(viewer.shadowRoot!.querySelectorAll('[part="header-row"]').length).to.equal(0);
  expect(await viewer.scrollToAnchor({ kind: 'cell-range', range: 'B1' })).to.equal(true);
  const list = viewer.shadowRoot!.querySelector('lr-virtual-list')!;
  expect(list.activeItemId).to.equal(0);
  expect(list.shadowRoot!.querySelector('[data-row-index="0"] [aria-colindex="2"]')!.textContent).to.include('Cell 0:1');
  expect(await viewer.scrollToAnchor({ kind: 'cell-range', range: 'A4' })).to.equal(false);
  expect(list.activeItemId).to.equal(0);
  expect(errors.length).to.equal(0);
});

it('resolves source workbook names embedded in ranges and gives an explicit sheet precedence', async () => {
  const first = source(), second = source();
  first.cellAt = (row, column) => `First ${row}:${column}`;
  second.cellAt = (row, column) => `Second ${row}:${column}`;
  const { viewer, errors } = await workbook({ revision: 1, sheets: [
    { key: 'first', name: 'First sheet', data: first },
    { key: 'second', name: 'Second sheet', data: second },
  ] });
  const list = () => viewer.shadowRoot!.querySelector('lr-virtual-list')!;
  await waitUntil(() => list()?.shadowRoot?.textContent?.includes('First 0:0') === true);
  expect(await viewer.scrollToAnchor({ kind: 'cell-range', range: "'Second sheet'!B3" })).to.equal(true);
  expect(viewer.shadowRoot!.querySelector('[role="table"]')!.getAttribute('aria-label')).to.equal('Second sheet');
  expect(list().activeItemId).to.equal(1);
  expect(list().shadowRoot!.textContent).to.include('Second 1:1');
  expect(await viewer.scrollToAnchor({ kind: 'cell-range', sheet: 'First sheet', range: "'Second sheet'!A4" })).to.equal(true);
  expect(viewer.shadowRoot!.querySelector('[role="table"]')!.getAttribute('aria-label')).to.equal('First sheet');
  expect(list().activeItemId).to.equal(2);
  expect(list().shadowRoot!.textContent).to.include('First 2:0');
  expect(errors.length).to.equal(0);
});
