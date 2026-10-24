import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { shrinkAnchorRetry } from '../../../test/viewer-scroll-test-support.js';
import type { LyraTabularSource, LyraWorkbookSource } from '../../data-sources.js';
import type { LyraCsvViewer } from './csv-viewer/csv-viewer.js';
import type { LyraSpreadsheetViewer } from './spreadsheet-viewer/spreadsheet-viewer.js';
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
