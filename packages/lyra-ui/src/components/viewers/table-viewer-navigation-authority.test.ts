import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraTabularSource, LyraWorkbookSource } from '../../data-sources.js';
import type { LyraCsvViewer } from './csv-viewer/csv-viewer.js';
import type { LyraSpreadsheetViewer } from './spreadsheet-viewer/spreadsheet-viewer.js';
import './csv-viewer/csv-viewer.js';
import './spreadsheet-viewer/spreadsheet-viewer.js';

function source(label: string, columns = 2): LyraTabularSource {
  return {
    revision: 1, rowCount: 3, columnCount: columns,
    columnAt: index => ({ key: String(index), label: `Column ${index}` }),
    cellAt: (row, column) => `${label}:${row}:${column}`,
  };
}

function bodyText(viewer: LyraCsvViewer | LyraSpreadsheetViewer): string {
  return viewer.shadowRoot?.querySelector('lr-virtual-list')?.shadowRoot?.textContent ?? '';
}

async function csv(data: LyraTabularSource) {
  const errors: unknown[] = [];
  const viewer = await fixture<LyraCsvViewer>(html`<lr-csv-viewer
    style="display:block;width:320px;--lr-size-8rem:80px" .dataSource=${data}
    @lr-render-error=${(event: CustomEvent<{ error: unknown }>) => errors.push(event.detail.error)}
  ></lr-csv-viewer>`);
  await waitUntil(() => bodyText(viewer).includes('original:0:0'));
  return { viewer, errors };
}

describe('table source navigation authority', () => {
  for (const throws of [false, true]) {
    it(`preserves a provider replacement made by a revision getter that ${throws ? 'throws' : 'returns'}`, async () => {
      const data = source('original');
      const replacement = source('replacement');
      const { viewer, errors } = await csv(data);
      let revisions = 0;
      Object.defineProperty(data, 'revision', { get() {
        revisions++;
        viewer.dataSource = replacement;
        if (throws) throw new Error('Obsolete revision failure');
        return 2;
      } });
      viewer.requestUpdate();
      await waitUntil(() => bodyText(viewer).includes('replacement:0:0'));
      expect(revisions).to.equal(1);
      expect(viewer.dataSource === replacement).to.equal(true);
      expect(errors.length).to.equal(0);
      expect(viewer.shadowRoot!.querySelector('[part="error"]') === null).to.equal(true);
      expect(await viewer.scrollToAnchor({ kind: 'cell-range', range: 'B4' })).to.equal(true);
      expect(bodyText(viewer)).to.include('replacement:2:1');
      expect(bodyText(viewer)).not.to.include('original:');
    });
  }

  it('discards an asynchronous search result when its source metadata replaces the provider during hit validation', async () => {
    const data = source('original');
    const replacement = source('replacement');
    replacement.search = async () => ({ hits: [{ row: 1, column: 1 }], total: 1, exhaustive: true });
    let complete!: () => void;
    data.search = () => new Promise(resolve => {
      complete = () => resolve({ hits: [{ row: 2, column: 1 }], total: 1, exhaustive: true });
    });
    const { viewer, errors } = await csv(data);
    const counts: number[] = [];
    viewer.addEventListener('lr-search-change', event => counts.push(event.detail.matchCount));
    let metadataReads = 0;
    Object.defineProperty(data, 'rowCount', { get() {
      metadataReads++;
      viewer.dataSource = replacement;
      return 3;
    } });
    const stale = viewer.search('original');
    expect(typeof complete).to.equal('function');
    complete();
    expect(await stale).to.equal(0);
    await waitUntil(() => bodyText(viewer).includes('replacement:0:0'));
    expect(metadataReads).to.equal(1);
    expect(counts.every(count => count === 0)).to.equal(true);
    expect(await viewer.searchNext()).to.equal(false);
    expect(errors.length).to.equal(0);
    expect(await viewer.search('replacement')).to.equal(1);
    expect(counts.at(-1)).to.equal(1);
    expect(bodyText(viewer)).to.include('replacement:1:1');
  });

  it('cancels a horizontal reveal when the newly requested column replaces its source', async () => {
    const data = source('original', 100);
    const replacement = source('replacement');
    const { viewer, errors } = await csv(data);
    const oldColumns: number[] = [];
    let replacements = 0;
    data.columnAt = index => {
      if (index >= 90) {
        replacements++;
        viewer.dataSource = replacement;
      }
      return { key: String(index), label: `Column ${index}` };
    };
    data.cellAt = (row, column) => { oldColumns.push(column); return `original:${row}:${column}`; };
    expect(await viewer.scrollToAnchor({ kind: 'cell-range', range: 'CV2' })).to.equal(false);
    await waitUntil(() => bodyText(viewer).includes('replacement:0:'));
    expect(replacements).to.equal(1);
    expect(oldColumns.some(column => column >= 90)).to.equal(false);
    expect(viewer.dataSource === replacement).to.equal(true);
    expect(errors.length).to.equal(0);
    expect(await viewer.scrollToAnchor({ kind: 'cell-range', range: 'A2' })).to.equal(true);
    expect(bodyText(viewer)).to.include('replacement:0:0');
    expect(bodyText(viewer)).not.to.include('original:');
  });

  it('reports a current sheet metadata failure and recovers navigation after the workbook is replaced', async () => {
    const second = source('second');
    const workbook: LyraWorkbookSource = { revision: 1, sheets: [
      { key: 'first', name: 'First', data: source('original') },
      { key: 'second', name: 'Second', data: second },
    ] };
    const errors: unknown[] = [];
    const viewer = await fixture<LyraSpreadsheetViewer>(html`<lr-spreadsheet-viewer
      style="display:block;width:320px" .dataSource=${workbook}
      .strings=${{ documentPreviewFailedToLoad: 'Workbook unavailable' }}
      @lr-render-error=${(event: CustomEvent<{ error: unknown }>) => errors.push(event.detail.error)}
    ></lr-spreadsheet-viewer>`);
    await waitUntil(() => bodyText(viewer).includes('original:0:0'));
    Object.defineProperty(second, 'rowCount', { get() { throw new Error('Provider row metadata unavailable'); } });
    const tabs = viewer.shadowRoot!.querySelector('lr-tab-group')!;
    await tabs.updateComplete;
    tabs.show('source-1');
    await waitUntil(() => viewer.shadowRoot?.querySelector('[part="error"]')?.textContent === 'Workbook unavailable');
    expect(errors.length).to.equal(1);
    expect(viewer.shadowRoot!.textContent).not.to.include('Provider row metadata unavailable');
    expect(viewer.shadowRoot!.querySelectorAll('[role="table"]').length).to.equal(0);
    viewer.dataSource = { revision: 2, sheets: [{ key: 'recovered', name: 'Recovered', data: source('replacement') }] };
    await waitUntil(() => bodyText(viewer).includes('replacement:0:0'));
    expect(viewer.shadowRoot!.querySelector('[part="error"]') === null).to.equal(true);
    expect(await viewer.scrollToAnchor({ kind: 'cell-range', sheet: 'Recovered', range: 'B4' })).to.equal(true);
    expect(bodyText(viewer)).to.include('replacement:2:1');
    expect(errors.length).to.equal(1);
  });
});
