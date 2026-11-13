import { expect, fixture, html, waitUntil } from '@open-wc/testing';
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

for (const kind of ['csv', 'dataset', 'spreadsheet'] as const) {
  for (const action of ['search', 'clear'] as const) {
    it(`${kind} preserves a newer search started by an abort callback during ${action}`, async () => {
      let viewer!: Viewer;
      let newest: Promise<number> | undefined;
      let resolveOriginal!: (reply: Reply) => void;
      const originalReply = new Promise<Reply>(resolve => { resolveOriginal = resolve; });
      const requests: LyraSourceSearchRequest[] = [];
      const changes: LyraSearchChangeDetail[] = [];
      const search = (request: LyraSourceSearchRequest): Promise<Reply> => {
        requests.push(request);
        if (request.query === 'original') {
          request.signal.addEventListener('abort', () => { newest = viewer.search('newest'); }, { once: true });
          return originalReply;
        }
        return Promise.resolve({ hits: [{ row: 2, column: 0 }], total: 1, exhaustive: true });
      };
      viewer = await mount(kind, search, changes);
      const original = viewer.search('original');
      await waitUntil(() => requests.length === 1);
      const interrupted = action === 'search' ? viewer.search('interrupted') : (viewer.clearSearch(), undefined);
      expect(newest !== undefined).to.equal(true);
      resolveOriginal({ hits: [{ row: 0, column: 0 }], total: 1, exhaustive: true });
      expect(await original).to.equal(0);
      expect(await newest).to.equal(1);
      if (interrupted) expect(await interrupted).to.equal(0);
      expect(requests.map(request => request.query)).to.deep.equal(['original', 'newest']);
      expect(changes.at(-1)).to.deep.equal({ query: 'newest', matchCount: 1, matchCountExact: true, activeIndex: 0 });
      expect(viewer.shadowRoot!.querySelector('lr-virtual-list')?.activeItemId).to.equal(2);
    });
  }

  it(`${kind} preserves a clear requested by an abort callback instead of starting the superseded search`, async () => {
    let viewer!: Viewer;
    let settle!: (reply: Reply) => void;
    const pending = new Promise<Reply>(resolve => { settle = resolve; });
    const queries: string[] = [];
    const changes: LyraSearchChangeDetail[] = [];
    viewer = await mount(kind, request => {
      queries.push(request.query);
      request.signal.addEventListener('abort', () => { viewer.clearSearch(); }, { once: true });
      return pending;
    }, changes);
    const original = viewer.search('original');
    await waitUntil(() => queries.length === 1);
    const superseded = viewer.search('superseded');
    settle({ hits: [{ row: 1, column: 0 }], total: 1, exhaustive: true });
    expect(await original).to.equal(0);
    expect(await superseded).to.equal(0);
    expect(queries).to.deep.equal(['original']);
    expect(changes.at(-1)).to.deep.equal({ query: '', matchCount: 0, matchCountExact: true, activeIndex: -1 });
    expect(await viewer.searchNext()).to.equal(false);
  });

  it(`${kind} preserves a newer search started while reading the provider capability`, async () => {
    const queries: string[] = [];
    const changes: LyraSearchChangeDetail[] = [];
    const viewer = await mount(kind, async request => {
      queries.push(request.query);
      return { hits: [{ row: 2, column: 0 }], total: 1, exhaustive: true };
    }, changes);
    const source = viewer.dataSource!;
    const search = source.search;
    let newest: Promise<number> | undefined;
    let armed = true;
    Object.defineProperty(source, 'search', { configurable: true, get() {
      if (armed) { armed = false; newest = viewer.search('newest'); }
      return search;
    } });
    expect(await viewer.search('superseded')).to.equal(0);
    expect(await newest).to.equal(1);
    expect(queries).to.deep.equal(['newest']);
    expect(changes.at(-1)).to.deep.equal({ query: 'newest', matchCount: 1, matchCountExact: true, activeIndex: 0 });
    expect(viewer.shadowRoot!.querySelector('lr-virtual-list')?.activeItemId).to.equal(2);
  });
}
