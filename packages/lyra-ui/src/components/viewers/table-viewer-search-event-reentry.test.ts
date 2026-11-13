import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import type { LyraSourceSearchRequest, LyraSourceSearchResult, LyraTabularHit, LyraTabularSource, LyraWorkbookSource } from '../../data-sources.js';
import type { LyraSearchChangeDetail } from '../../internal/text-viewer-target.js';
import type { LyraCsvViewer } from './csv-viewer/csv-viewer.class.js';
import type { LyraDatasetViewer } from './dataset-viewer/dataset-viewer.class.js';
import type { LyraSpreadsheetViewer } from './spreadsheet-viewer/spreadsheet-viewer.class.js';
import './csv-viewer/csv-viewer.js';
import './dataset-viewer/dataset-viewer.js';
import './spreadsheet-viewer/spreadsheet-viewer.js';

type Viewer = LyraCsvViewer | LyraDatasetViewer | LyraSpreadsheetViewer;
type Reply = LyraSourceSearchResult<LyraTabularHit>;
type Kind = 'csv' | 'dataset' | 'spreadsheet';

async function mount(kind: Kind, search: (request: LyraSourceSearchRequest) => Promise<Reply>, changes: LyraSearchChangeDetail[]): Promise<Viewer> {
  const data: LyraTabularSource = { revision: 1, rowCount: 3, columnCount: 1,
    columnAt: () => ({ key: 'value', label: 'Value' }), cellAt: row => `Row ${row}`, search };
  const workbook: LyraWorkbookSource = { revision: 1, sheets: [{ key: 'main', name: 'Main', data }],
    search: async request => {
      const result = await search(request);
      return { ...result, hits: result.hits.map(hit => ({ ...hit, sheetKey: 'main' })) };
    } };
  const changed = (event: CustomEvent<LyraSearchChangeDetail>): void => { changes.push(event.detail); };
  return kind === 'csv'
    ? fixture<LyraCsvViewer>(html`<lr-csv-viewer .dataSource=${data} @lr-search-change=${changed}></lr-csv-viewer>`)
    : kind === 'dataset'
      ? fixture<LyraDatasetViewer>(html`<lr-dataset-viewer .dataSource=${data} @lr-search-change=${changed}></lr-dataset-viewer>`)
      : fixture<LyraSpreadsheetViewer>(html`<lr-spreadsheet-viewer .dataSource=${workbook} @lr-search-change=${changed}></lr-spreadsheet-viewer>`);
}

async function mountLocal(kind: Kind): Promise<Viewer> {
  const rows = [['Value'], ['match one'], ['other'], ['match two']];
  const viewer: Viewer = kind === 'csv'
    ? await fixture<LyraCsvViewer>(html`<lr-csv-viewer .rows=${rows}></lr-csv-viewer>`)
    : kind === 'dataset'
      ? await fixture<LyraDatasetViewer>(html`<lr-dataset-viewer .table=${{ fields: ['Value'], rows: rows.slice(1).map(row => ({ Value: row[0]! })) }}></lr-dataset-viewer>`)
      : await fixture<LyraSpreadsheetViewer>(html`<lr-spreadsheet-viewer .workbook=${{ sheets: [{ name: 'Main', rows }] }}></lr-spreadsheet-viewer>`);
  await waitUntil(() => viewer.shadowRoot!.querySelector('lr-virtual-list') !== null);
  return viewer;
}

for (const kind of ['csv', 'dataset', 'spreadsheet'] as const) {
  for (const direction of ['next', 'previous'] as const) {
    it(`${kind} stops ${direction} navigation when its search-change listener clears the result set`, async () => {
      const changes: LyraSearchChangeDetail[] = [];
      const viewer = await mount(kind, async () => ({ hits: [{ row: 0, column: 0 }, { row: 2, column: 0 }], total: 2, exhaustive: true }), changes);
      expect(await viewer.search('Row')).to.equal(2);
      viewer.addEventListener('lr-search-change', () => viewer.clearSearch(), { once: true });
      expect(await (direction === 'next' ? viewer.searchNext() : viewer.searchPrevious())).to.equal(false);
      expect(changes.at(-1)).to.deep.equal({ query: '', matchCount: 0, matchCountExact: true, activeIndex: -1 });
      expect(await viewer.searchNext()).to.equal(false);
    });
  }
}

for (const kind of ['csv', 'dataset', 'spreadsheet'] as const) {
  it(`${kind} does not reveal an obsolete source hit after a search-change listener clears`, async () => {
    const changes: LyraSearchChangeDetail[] = [];
    const viewer = await mount(kind, async () => ({ hits: [{ row: 2, column: 0 }], total: 1, exhaustive: true }), changes);
    viewer.addEventListener('lr-search-change', () => viewer.clearSearch(), { once: true });
    expect(await viewer.search('Row')).to.equal(0);
    await nextFrame();
    await viewer.updateComplete;
    expect(changes.at(-1)).to.deep.equal({ query: '', matchCount: 0, matchCountExact: true, activeIndex: -1 });
    expect(viewer.shadowRoot!.querySelector('lr-virtual-list')?.activeItemId).to.equal('');
  });
}

for (const kind of ['csv', 'dataset', 'spreadsheet'] as const) {
  for (const direction of ['next', 'previous'] as const) {
    it(`${kind} stops ${direction} navigation when a local search-change listener clears the result set`, async () => {
      const viewer = await mountLocal(kind);
      expect(await viewer.search('match')).to.equal(2);
      const changes: LyraSearchChangeDetail[] = [];
      viewer.addEventListener('lr-search-change', event => changes.push((event as CustomEvent<LyraSearchChangeDetail>).detail));
      viewer.addEventListener('lr-search-change', () => viewer.clearSearch(), { once: true });
      expect(await (direction === 'next' ? viewer.searchNext() : viewer.searchPrevious())).to.equal(false);
      expect(changes.at(-1)).to.deep.equal({ query: '', matchCount: 0, matchCountExact: true, activeIndex: -1 });
      expect(await viewer.searchNext()).to.equal(false);
    });
  }
}

for (const kind of ['csv', 'dataset', 'spreadsheet'] as const) {
  it(`${kind} keeps a local search cleared from its result event`, async () => {
    const viewer = await mountLocal(kind);
    viewer.addEventListener('lr-search-change', () => viewer.clearSearch(), { once: true });
    expect(await viewer.search('match')).to.equal(0);
    await nextFrame();
    await viewer.updateComplete;
    expect(viewer.shadowRoot!.querySelector('lr-virtual-list')?.activeItemId).to.equal('');
    expect(await viewer.searchNext()).to.equal(false);
  });
}

for (const kind of ['csv', 'dataset', 'spreadsheet'] as const) {
  for (const mode of ['source', 'local'] as const) {
    for (const outer of ['search', 'next'] as const) {
      it(`${kind} preserves nested ${mode} search navigation from the ${outer} result event`, async () => {
        const viewer = mode === 'local' ? await mountLocal(kind)
          : await mount(kind, async () => ({ hits: [{ row: 0, column: 0 }, { row: 2, column: 0 }], total: 2, exhaustive: true }), []);
        if (outer === 'next') expect(await viewer.search('match')).to.equal(2);
        let nested: Promise<boolean> | undefined;
        viewer.addEventListener('lr-search-change', () => { nested = viewer.searchNext(); }, { once: true });
        const result = outer === 'search' ? await viewer.search('match') : await viewer.searchNext();
        expect(result).to.equal(outer === 'search' ? 0 : false);
        expect(await nested).to.equal(true);
        await nextFrame();
        expect(viewer.shadowRoot!.querySelector('lr-virtual-list')?.activeItemId).to.equal(outer === 'search' ? 2 : 0);
      });
    }
  }

  it(`${kind} stops navigation when its event listener starts a new provider search`, async () => {
    let release!: (reply: Reply) => void;
    const replacement = new Promise<Reply>(resolve => { release = resolve; });
    const viewer = await mount(kind, async request => request.query === 'newest' ? replacement
      : { hits: [{ row: 0, column: 0 }, { row: 1, column: 0 }], total: 2, exhaustive: true }, []);
    expect(await viewer.search('original')).to.equal(2);
    let newest: Promise<number> | undefined;
    viewer.addEventListener('lr-search-change', () => { newest = viewer.search('newest'); }, { once: true });
    const step = await viewer.searchNext();
    release({ hits: [{ row: 2, column: 0 }], total: 1, exhaustive: true });
    expect(step).to.equal(false);
    expect(await newest).to.equal(1);
    expect(viewer.shadowRoot!.querySelector('lr-virtual-list')?.activeItemId).to.equal(2);
  });
}

for (const kind of ['csv', 'dataset', 'spreadsheet'] as const) {
  it(`${kind} leaves the current row unchanged while an event-triggered replacement query is pending`, async () => {
    let release!: (reply: Reply) => void;
    const replacement = new Promise<Reply>(resolve => { release = resolve; });
    const queries: string[] = [];
    const viewer = await mount(kind, async request => {
      queries.push(request.query);
      return request.query === 'newest' ? replacement
        : { hits: [{ row: 1, column: 0 }], total: 1, exhaustive: true };
    }, []);
    let newest: Promise<number> | undefined;
    viewer.addEventListener('lr-search-change', () => { newest = viewer.search('newest'); }, { once: true });
    expect(await viewer.search('original')).to.equal(0);
    await waitUntil(() => queries.length === 2);
    await nextFrame();
    const activeWhilePending = viewer.shadowRoot!.querySelector('lr-virtual-list')?.activeItemId;
    release({ hits: [{ row: 2, column: 0 }], total: 1, exhaustive: true });
    expect(await newest).to.equal(1);
    expect(activeWhilePending).to.equal('');
    expect(viewer.shadowRoot!.querySelector('lr-virtual-list')?.activeItemId).to.equal(2);
  });
}
