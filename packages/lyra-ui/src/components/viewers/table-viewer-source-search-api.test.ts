import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type {
  LyraSourceSearchRequest, LyraSourceSearchResult, LyraTabularHit, LyraTabularSource, LyraWorkbookSource,
} from '../../data-sources.js';
import type { LyraSearchChangeDetail } from '../../internal/text-viewer-target.js';
import type { LyraDatasetViewer } from './dataset-viewer/dataset-viewer.class.js';
import type { LyraSpreadsheetViewer } from './spreadsheet-viewer/spreadsheet-viewer.class.js';
import './dataset-viewer/dataset-viewer.js';
import './spreadsheet-viewer/spreadsheet-viewer.js';

type Viewer = LyraDatasetViewer | LyraSpreadsheetViewer;
type Reply = LyraSourceSearchResult<LyraTabularHit>;
type Search = (request: LyraSourceSearchRequest) => Promise<Reply>;
const hits = [{ row: 0, column: 0 }, { row: 2, column: 19 }, { row: 4, column: 1 }];

async function make(kind: 'dataset' | 'spreadsheet', search?: Search) {
  const requests: LyraSourceSearchRequest[] = [];
  const receivers: unknown[] = [];
  const changes: LyraSearchChangeDetail[] = [];
  const source = (label: string): LyraTabularSource => ({ revision: 7, rowCount: 6, columnCount: 20,
    columnAt: column => ({ key: String(column), label: `Column ${column}` }),
    cellAt: (row, column) => `${label} ${row}:${column}`,
  });
  const data = source('First');
  if (search) data.search = function (request) {
    receivers.push(this); requests.push(request); return search(request);
  };
  const workbook: LyraWorkbookSource = { revision: 7, sheets: [
    { key: 'first', name: 'First sheet', data: source('First') },
    { key: 'second', name: 'Second sheet', data: source('Second') },
  ] };
  if (search) workbook.search = async function (request) {
    receivers.push(this); requests.push(request);
    const result = await search(request);
    return { ...result, hits: result.hits.map((hit, index) => ({ ...hit, sheetKey: index % 2 ? 'second' : 'first' })) };
  };
  const strings = { sourceSearchUnavailable: 'Global search is unavailable' };
  const changed = (event: CustomEvent<LyraSearchChangeDetail>): void => { changes.push(event.detail); };
  const viewer: Viewer = kind === 'dataset'
    ? await fixture<LyraDatasetViewer>(html`<lr-dataset-viewer style="display:block;width:360px"
        lang="en" .dataSource=${data} .strings=${strings} @lr-search-change=${changed}></lr-dataset-viewer>`)
    : await fixture<LyraSpreadsheetViewer>(html`<lr-spreadsheet-viewer style="display:block;width:360px"
        lang="en" .dataSource=${workbook} .strings=${strings} @lr-search-change=${changed}></lr-spreadsheet-viewer>`);
  return { viewer, requests, receivers, changes };
}

function activeRow(viewer: Viewer): number | string | undefined {
  return viewer.shadowRoot!.querySelector('lr-virtual-list')?.activeItemId;
}

for (const kind of ['dataset', 'spreadsheet'] as const) {
  describe(`${kind} viewer public source-search API`, () => {
    it('delegates global search, wraps both directions, and reveals offscreen cells', async () => {
      const { viewer, requests, receivers, changes } = await make(kind, async () => ({ hits, total: 3, exhaustive: true }));
      expect(await viewer.search('global query')).to.equal(3);
      expect(requests.length).to.equal(1);
      expect(requests[0]!.query).to.equal('global query');
      expect(requests[0]!.limit).to.equal(1000);
      expect(requests[0]!.revision).to.equal(7);
      expect(requests[0]!.locale).to.equal('en');
      expect(Object.isFrozen(requests[0])).to.equal(true);
      expect(receivers[0] === viewer.dataSource).to.equal(true);
      expect(activeRow(viewer)).to.equal(0);
      expect(await viewer.searchNext()).to.equal(true);
      expect(activeRow(viewer)).to.equal(2);
      const label = kind === 'spreadsheet' ? 'Second' : 'First';
      const list = viewer.shadowRoot!.querySelector('lr-virtual-list')!;
      expect(list.shadowRoot!.textContent).to.contain(`${label} 2:19`);
      expect(list.shadowRoot!.querySelectorAll('[aria-colindex="20"]').length).to.be.greaterThan(0);
      expect(await viewer.searchNext()).to.equal(true);
      expect(activeRow(viewer)).to.equal(4);
      expect(await viewer.searchNext()).to.equal(true);
      expect(activeRow(viewer)).to.equal(0);
      expect(await viewer.searchPrevious()).to.equal(true);
      expect(activeRow(viewer)).to.equal(4);
      expect(changes.at(-1)).to.deep.equal({ query: 'global query', matchCount: 3, matchCountExact: true, activeIndex: 2 });
      viewer.clearSearch();
      await viewer.updateComplete;
      expect(activeRow(viewer)).to.equal('');
      expect(await viewer.searchNext()).to.equal(false);
      expect(await viewer.searchPrevious()).to.equal(false);
      expect(changes.at(-1)).to.deep.equal({ query: '', matchCount: 0, matchCountExact: true, activeIndex: -1 });
      expect(requests.length).to.equal(1);
    });

    it('cancels a pending search and rejects its late result before a new query succeeds', async () => {
      let resolvePending!: (reply: Reply) => void;
      const pendingReply = new Promise<Reply>(resolve => { resolvePending = resolve; });
      const { viewer, requests, changes } = await make(kind, request => request.query === 'old'
        ? pendingReply : Promise.resolve({ hits: hits.slice(0, 1), total: 1, exhaustive: true }));
      const pending = viewer.search('old');
      await waitUntil(() => requests.length === 1);
      viewer.clearSearch();
      expect(requests[0]!.signal.aborted).to.equal(true);
      expect(await pending).to.equal(0);
      resolvePending({ hits, total: 3, exhaustive: true });
      await pendingReply;
      expect(await viewer.search('new')).to.equal(1);
      expect(requests.map(request => request.query)).to.deep.equal(['old', 'new']);
      expect(changes.some(detail => detail.query === 'old' && detail.matchCount > 0)).to.equal(false);
      expect(changes.at(-1)).to.deep.equal({ query: 'new', matchCount: 1, matchCountExact: true, activeIndex: 0 });
      expect(activeRow(viewer)).to.equal(0);
    });

    it('reports unavailable global search without treating the visible rows as exhaustive results', async () => {
      const { viewer, changes } = await make(kind);
      expect(await viewer.search('First')).to.equal(0);
      await viewer.updateComplete;
      expect(changes.at(-1)).to.deep.equal({ query: 'First', matchCount: 0, matchCountExact: false, activeIndex: -1 });
      expect(viewer.shadowRoot!.querySelector('[part="search-status"]')?.textContent).to.contain('Global search is unavailable');
      expect(await viewer.searchPrevious()).to.equal(false);
      viewer.clearSearch();
      await viewer.updateComplete;
      expect(activeRow(viewer)).to.equal('');
      expect(viewer.shadowRoot!.querySelectorAll('[role="table"]').length).to.equal(1);
      expect(changes.at(-1)).to.deep.equal({ query: '', matchCount: 0, matchCountExact: true, activeIndex: -1 });
    });

    for (const total of [null, 200]) {
      it(`keeps two retained hits cursor-addressable when the provider total is ${total}`, async () => {
        const { viewer, changes } = await make(kind, async () => ({ hits: hits.slice(0, 2), total, exhaustive: false }));
        expect(await viewer.search('partial')).to.equal(2);
        expect(await viewer.searchPrevious()).to.equal(true);
        expect(activeRow(viewer)).to.equal(2);
        expect(changes.at(-1)).to.deep.equal({ query: 'partial', matchCount: 2, matchCountExact: false, activeIndex: 1 });
        expect(await viewer.searchNext()).to.equal(true);
        expect(activeRow(viewer)).to.equal(0);
        viewer.clearSearch();
        expect(await viewer.searchNext()).to.equal(false);
      });
    }
  });
}
