import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraTabularReadRequest, LyraTabularSource, LyraWorkbookSource } from '../../data-sources.js';
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
  for (const property of ['revision', 'rowCount', 'columnCount', 'columnAt', 'cellAt', 'readCells'] as const) {
    for (const throws of [false, true]) {
      it(`retains the latest sheet when obsolete ${property} changes tabs and ${throws ? 'throws' : 'returns'}`, async () => {
        const obsolete = source('obsolete');
        const latest = { ...source('latest', 4), rowCount: 5 };
        const errors: unknown[] = [];
        const viewer = await fixture<LyraSpreadsheetViewer>(html`<lr-spreadsheet-viewer
          style="display:block;width:480px" .dataSource=${{ revision: 1, sheets: [
            { key: 'first', name: 'First', data: source('original') },
            { key: 'obsolete', name: 'Obsolete', data: obsolete },
            { key: 'latest', name: 'Latest', data: latest },
          ] }} @lr-render-error=${(event: CustomEvent<{ error: unknown }>) => errors.push(event.detail.error)}
        ></lr-spreadsheet-viewer>`);
        await waitUntil(() => bodyText(viewer).includes('original:0:0'));
        const tabs = viewer.shadowRoot!.querySelector('lr-tab-group')!;
        await tabs.updateComplete;
        let reads = 0;
        const previous = obsolete[property];
        Object.defineProperty(obsolete, property, { get() {
          reads++;
          tabs.show('source-2');
          if (throws) throw new Error('Obsolete sheet metadata unavailable');
          return previous;
        } });
        tabs.show('source-1');
        await viewer.updateComplete;
        await waitUntil(() => bodyText(viewer).includes('latest:0:0') || errors.length > 0, 'latest sheet or erroneous failure rendered');
        expect(reads).to.equal(1);
        expect(errors.length).to.equal(0);
        const table = viewer.shadowRoot!.querySelector('[role="table"]');
        expect(table?.getAttribute('aria-label')).to.equal('Latest');
        expect(table?.getAttribute('aria-rowcount')).to.equal('6');
        expect(table?.getAttribute('aria-colcount')).to.equal('4');
        expect(bodyText(viewer)).not.to.include('obsolete:');
        expect(await viewer.scrollToAnchor({ kind: 'cell-range', sheet: 'Latest', range: 'D6' })).to.equal(true);
        expect(bodyText(viewer)).to.include('latest:4:3');
        expect(viewer.shadowRoot!.querySelector('[part="error"]') === null).to.equal(true);
      });
    }
  }

  it('stops a synchronous cell rectangle when its provider replaces the source', async () => {
    const data = source('original');
    const replacement = source('replacement');
    const { viewer, errors } = await csv(data);
    let reads = 0;
    data.cellAt = () => { reads++; viewer.dataSource = replacement; return 'Obsolete cell'; };
    Object.defineProperty(data, 'revision', { value: 2 }); viewer.requestUpdate();
    await waitUntil(() => bodyText(viewer).includes('replacement:0:0'));
    expect(reads).to.equal(1);
    expect(bodyText(viewer)).not.to.include('Obsolete cell');
    expect(errors.length).to.equal(0);
    expect(await viewer.scrollToAnchor({ kind: 'cell-range', range: 'B4' })).to.equal(true);
    expect(bodyText(viewer)).to.include('replacement:2:1');
  });

  for (const stage of ['columnAt', 'column key', 'column label'] as const) {
    for (const throws of [false, true]) {
      it(`discards obsolete ${stage} metadata when its callback switches sheets and ${throws ? 'throws' : 'returns'}`, async () => {
        const obsolete = source('obsolete');
        const errors: unknown[] = [];
        const viewer = await fixture<LyraSpreadsheetViewer>(html`<lr-spreadsheet-viewer style="display:block;width:480px"
          .dataSource=${{ revision: 1, sheets: [
            { key: 'first', name: 'First', data: source('original') },
            { key: 'obsolete', name: 'Obsolete', data: obsolete },
            { key: 'latest', name: 'Latest', data: { ...source('latest'), rowCount: 5 } },
          ] }} @lr-render-error=${(event: CustomEvent<{ error: unknown }>) => errors.push(event.detail.error)}
        ></lr-spreadsheet-viewer>`);
        await waitUntil(() => bodyText(viewer).includes('original:0:0'));
        const tabs = viewer.shadowRoot!.querySelector('lr-tab-group')!;
        await tabs.updateComplete;
        let reads = 0;
        const switchSheet = (): void => {
          reads++; tabs.show('source-2');
          if (throws) throw new Error('Obsolete column unavailable');
        };
        obsolete.columnAt = () => {
          const column = { key: 'old', label: 'Old column' };
          if (stage === 'columnAt') switchSheet();
          else Object.defineProperty(column, stage === 'column key' ? 'key' : 'label', { get() {
            switchSheet(); return stage === 'column key' ? 'old' : 'Old column';
          } });
          return column;
        };
        tabs.show('source-1');
        await waitUntil(() => bodyText(viewer).includes('latest:0:0') || errors.length > 0, 'latest sheet or obsolete error rendered');
        expect(reads).to.equal(1);
        expect(errors.length).to.equal(0);
        expect(viewer.shadowRoot!.querySelector('[role="table"]')?.getAttribute('aria-colcount')).to.equal('2');
        expect([...viewer.shadowRoot!.querySelectorAll('[role="columnheader"]')].map(cell => cell.textContent?.trim())).to.deep.equal(['Column 0', 'Column 1']);
        expect(await viewer.scrollToAnchor({ kind: 'cell-range', sheet: 'Latest', range: 'B6' })).to.equal(true);
        expect(bodyText(viewer)).to.include('latest:4:1');
      });
    }
  }

  it('cancels anchor navigation when selecting its sheet synchronously selects a newer one', async () => {
    const obsolete = source('obsolete');
    const viewer = await fixture<LyraSpreadsheetViewer>(html`<lr-spreadsheet-viewer style="display:block;width:480px"
      .dataSource=${{ revision: 1, sheets: [
        { key: 'first', name: 'First', data: source('original') },
        { key: 'obsolete', name: 'Obsolete', data: obsolete },
        { key: 'latest', name: 'Latest', data: { ...source('latest', 4), rowCount: 5 } },
      ] }}></lr-spreadsheet-viewer>`);
    await waitUntil(() => bodyText(viewer).includes('original:0:0'));
    const tabs = viewer.shadowRoot!.querySelector('lr-tab-group')!;
    await tabs.updateComplete;
    let reads = 0;
    Object.defineProperty(obsolete, 'rowCount', { get() { reads++; tabs.show('source-2'); return 3; } });
    expect(await viewer.scrollToAnchor({ kind: 'cell-range', sheet: 'Obsolete', range: 'B4' })).to.equal(false);
    await waitUntil(() => bodyText(viewer).includes('latest:0:0'));
    expect(reads).to.equal(1);
    expect(viewer.shadowRoot!.querySelector('[role="table"]')?.getAttribute('aria-label')).to.equal('Latest');
    expect(viewer.shadowRoot!.querySelector('lr-virtual-list')?.activeItemId).to.equal('');
    expect(await viewer.scrollToAnchor({ kind: 'cell-range', sheet: 'Latest', range: 'D6' })).to.equal(true);
    expect(bodyText(viewer)).to.include('latest:4:3');
  });

  it('preserves a sheet selected by an aborted cell request before the old selection reads metadata', async () => {
    const pending: { request: LyraTabularReadRequest; resolve(value: readonly (readonly string[])[]): void }[] = [];
    const first: LyraTabularSource = { revision: 1, rowCount: 200, columnCount: 2,
      columnAt: index => ({ key: String(index), label: `Column ${index}` }),
      readCells: request => new Promise(resolve => pending.push({ request, resolve })),
    };
    let obsoleteReads = 0;
    const obsolete = { ...source('obsolete'), get rowCount() { obsoleteReads++; return 3; } };
    const errors: unknown[] = [];
    const viewer = await fixture<LyraSpreadsheetViewer>(html`<lr-spreadsheet-viewer style="display:block;width:480px"
      .dataSource=${{ revision: 1, sheets: [
        { key: 'first', name: 'First', data: first },
        { key: 'obsolete', name: 'Obsolete', data: obsolete },
        { key: 'latest', name: 'Latest', data: { ...source('latest', 4), rowCount: 5 } },
      ] }} @lr-render-error=${(event: CustomEvent<{ error: unknown }>) => errors.push(event.detail.error)}
    ></lr-spreadsheet-viewer>`);
    await waitUntil(() => pending.length === 2, 'initial sheet reads are pending');
    const tabs = viewer.shadowRoot!.querySelector('lr-tab-group')!;
    await tabs.updateComplete;
    pending[0]!.request.signal.addEventListener('abort', () => tabs.show('source-2'), { once: true });
    tabs.show('source-1');
    expect(pending.every(entry => entry.request.signal.aborted)).to.equal(true);
    pending.forEach(entry => entry.resolve([]));
    await waitUntil(() => bodyText(viewer).includes('latest:0:0'));
    expect(obsoleteReads).to.equal(0);
    expect(errors.length).to.equal(0);
    expect(viewer.shadowRoot!.querySelector('[role="table"]')?.getAttribute('aria-rowcount')).to.equal('6');
    expect(await viewer.scrollToAnchor({ kind: 'cell-range', sheet: 'Latest', range: 'D6' })).to.equal(true);
    expect(bodyText(viewer)).to.include('latest:4:3');
  });

  it('reports a shared read failure once across concurrent rectangles and recovers after replacement', async () => {
    const pending: ((reason: Error) => void)[] = [];
    const data: LyraTabularSource = { revision: 1, rowCount: 200, columnCount: 2,
      columnAt: index => ({ key: String(index), label: `Column ${index}` }),
      readCells: () => new Promise((_resolve, reject) => { pending.push(reject); }),
    };
    const errors: unknown[] = [];
    const viewer = await fixture<LyraCsvViewer>(html`<lr-csv-viewer style="display:block;width:320px"
      .dataSource=${data} .strings=${{ documentPreviewFailedToLoad: 'Cell source unavailable' }}
      @lr-render-error=${(event: CustomEvent<{ error: unknown }>) => errors.push(event.detail.error)}
    ></lr-csv-viewer>`);
    await waitUntil(() => pending.length === 2, 'two bounded rectangles are in flight');
    const failure = new Error('Private provider failure');
    pending.forEach(reject => reject(failure));
    await waitUntil(() => viewer.shadowRoot!.querySelector('[part="error"]')?.textContent === 'Cell source unavailable');
    expect(errors.length).to.equal(1);
    expect(errors[0] === failure).to.equal(true);
    expect(viewer.shadowRoot!.textContent).not.to.include('Private provider failure');
    viewer.dataSource = source('replacement');
    await waitUntil(() => bodyText(viewer).includes('replacement:0:0'));
    expect(await viewer.scrollToAnchor({ kind: 'cell-range', range: 'B4' })).to.equal(true);
    expect(bodyText(viewer)).to.include('replacement:2:1');
    expect(errors.length).to.equal(1);
  });

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
