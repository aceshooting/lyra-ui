import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import * as XLSX from 'xlsx';
import './spreadsheet-viewer.js';
import type { LyraSpreadsheetViewer } from './spreadsheet-viewer.js';

function buffer(workbook: Record<string, unknown[][]>): ArrayBuffer {
  const book = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(workbook)) XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), name);
  const binary = XLSX.write(book, { type: 'binary', bookType: 'xlsx' }) as string;
  const result = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) result[i] = binary.charCodeAt(i) & 255;
  return result.buffer;
}

function fetchBuffer(value: ArrayBuffer): () => void {
  const original = window.fetch;
  window.fetch = (() => Promise.resolve({ ok: true, status: 200, statusText: 'OK', arrayBuffer: () => Promise.resolve(value) } as Response)) as typeof window.fetch;
  return () => { window.fetch = original; };
}

const GRID_WORKBOOK = { Sheet1: [['Name', 'Role'], ['Ada', 'Mathematician'], ['Grace', 'Scientist'], ['Ada', 'Programmer']] };
/** Shrinks `DocumentAnchorTarget`'s retry loop so a permanently-unresolvable `scrollToAnchor()` call
 *  resolves in milliseconds instead of waiting out the real 5s default timeout. */
function shrinkAnchorRetry(el: LyraSpreadsheetViewer): void {
  (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 30;
  (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
}

describe('lyra-spreadsheet-viewer', () => {
  it('renders an empty localized state by default', async () => {
    const el = (await fixture(html`<lyra-spreadsheet-viewer></lyra-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
    expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal('No document to display.');
  });

  it('renders a workbook header and virtualized body rows', async () => {
    const el = (await fixture(html`<lyra-spreadsheet-viewer></lyra-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
    const restore = fetchBuffer(buffer({ Sheet1: [['Name', 'Qty'], ['Widget', 12], ['Gadget', 3]] }));
    try {
      el.src = 'https://example.test/book.xlsx';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="header-row"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="header-row"]')!.textContent).to.equal('NameQty');
      expect((el.shadowRoot!.querySelector('lyra-virtual-list') as HTMLElement & { items: unknown[][] }).items).to.deep.equal([['Widget', 12], ['Gadget', 3]]);
    } finally { restore(); }
  });

  it('renders tabs for multiple sheets', async () => {
    const el = (await fixture(html`<lyra-spreadsheet-viewer></lyra-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
    const restore = fetchBuffer(buffer({ Inventory: [['Name'], ['Widget']], Summary: [['Total'], [12]] }));
    try {
      el.src = 'https://example.test/book.xlsx';
      await waitUntil(() => el.shadowRoot!.querySelector('lyra-tabs') !== null);
      const tabs = el.shadowRoot!.querySelector('lyra-tabs')!;
      await (tabs as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
      expect(tabs.shadowRoot!.querySelectorAll('[part="tab"]')).to.have.lengthOf(2);
    } finally { restore(); }
  });

  it('is accessible', async () => { const el = await fixture(html`<lyra-spreadsheet-viewer></lyra-spreadsheet-viewer>`); await expect(el).to.be.accessible(); });
  it('uses name as the accessible name, falling back to a localized default', async () => {
    const named = (await fixture(html`<lyra-spreadsheet-viewer name="quarterly.xlsx"></lyra-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
    expect(named.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('quarterly.xlsx');
    const unnamed = (await fixture(html`<lyra-spreadsheet-viewer></lyra-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
    expect(unnamed.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Spreadsheet');
  });

  describe('cell-range anchor-target', () => {
    it('scrolls to a cell-range anchor addressing the raw grid (header included)', async () => {
      const el = (await fixture(html`<lyra-spreadsheet-viewer></lyra-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(() => el.shadowRoot!.querySelector('lyra-virtual-list') !== null);
        // Row 2 (raw, 1-based, header at row 1) is the first data row ("Ada,Mathematician").
        expect(await el.scrollToAnchor({ kind: 'cell-range', range: 'A2' })).to.be.true;
      } finally {
        restore();
      }
    });

    it('resolves false for an anchor targeting a sheet that does not exist', async () => {
      const el = (await fixture(html`<lyra-spreadsheet-viewer></lyra-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      shrinkAnchorRetry(el);
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(() => el.shadowRoot!.querySelector('lyra-virtual-list') !== null);
        expect(await el.scrollToAnchor({ kind: 'cell-range', sheet: 'NoSuchSheet', range: 'A1' })).to.be.false;
      } finally {
        restore();
      }
    });

    it('renders a focusable cell-highlight and emits lyra-highlight-activate', async () => {
      const el = (await fixture(html`<lyra-spreadsheet-viewer></lyra-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(() => el.shadowRoot!.querySelector('lyra-virtual-list') !== null);
        el.highlights = [{ id: 'h1', anchor: { kind: 'cell-range', range: 'A2' }, label: 'First result' }];
        await el.updateComplete;
        const list = el.shadowRoot!.querySelector('lyra-virtual-list')!;
        const highlighted = list.shadowRoot!.querySelector('[part~="cell-highlight"]') as HTMLElement;
        expect(highlighted).to.exist;
        expect(highlighted.getAttribute('tabindex')).to.equal('0');
        expect(highlighted.getAttribute('role')).to.equal('button');
        expect(highlighted.getAttribute('aria-label')).to.equal('First result');
        const listener = oneEvent(el, 'lyra-highlight-activate');
        highlighted.click();
        const event = (await listener) as CustomEvent<{ id: string }>;
        expect(event.detail).to.deep.equal({ id: 'h1' });
      } finally {
        restore();
      }
    });
  });

  describe('cross-sheet scrollToAnchor', () => {
    it('switches the active tab to resolve a sheet-qualified anchor', async () => {
      const el = (await fixture(html`<lyra-spreadsheet-viewer></lyra-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer({ Sheet1: [['X'], [1], [2]], Sheet2: [['Name'], ['Ada'], ['Grace']] }));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(() => el.shadowRoot!.querySelector('lyra-tabs') !== null);
        const result = await el.scrollToAnchor({ kind: 'cell-range', sheet: 'Sheet2', range: 'A2' });
        expect(result).to.be.true;
        expect((el as unknown as { activeSheetIndex: number }).activeSheetIndex).to.equal(1);
      } finally {
        restore();
      }
    });
  });

  describe('search', () => {
    it('finds matches ordered row -> column', async () => {
      const el = (await fixture(html`<lyra-spreadsheet-viewer></lyra-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(() => el.shadowRoot!.querySelector('lyra-virtual-list') !== null);
        const count = await el.search('ada');
        expect(count).to.equal(2); // "Ada" appears in two data rows, column 0
        let detail: { matchCount: number; activeIndex: number } | undefined;
        el.addEventListener('lyra-search-change', (e) => (detail = (e as CustomEvent).detail));
        expect(await el.searchNext()).to.be.true;
        expect(detail!.activeIndex).to.equal(1);
        expect(await el.searchNext()).to.be.true;
        expect(detail!.activeIndex).to.equal(0); // wraps
      } finally {
        restore();
      }
    });

    it('scans every sheet, switching tabs when a match lives on a different one', async () => {
      const el = (await fixture(html`<lyra-spreadsheet-viewer></lyra-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer({ Sheet1: [['X'], ['nothing']], Sheet2: [['Name'], ['Ada'], ['Grace']] }));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(() => el.shadowRoot!.querySelector('lyra-tabs') !== null);
        const count = await el.search('ada');
        expect(count).to.equal(1);
        expect((el as unknown as { activeSheetIndex: number }).activeSheetIndex).to.equal(1);
      } finally {
        restore();
      }
    });

    it('clearSearch resets matchCount/activeIndex to 0/-1', async () => {
      const el = (await fixture(html`<lyra-spreadsheet-viewer></lyra-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(() => el.shadowRoot!.querySelector('lyra-virtual-list') !== null);
        await el.search('ada');
        const listener = oneEvent(el, 'lyra-search-change');
        el.clearSearch();
        const event = (await listener) as CustomEvent<{ matchCount: number; activeIndex: number }>;
        expect(event.detail).to.deep.equal({ query: '', matchCount: 0, activeIndex: -1 });
      } finally {
        restore();
      }
    });
  });

  describe('back-compat', () => {
    it('rendering is unchanged with highlights empty and no search active', async () => {
      const el = (await fixture(html`<lyra-spreadsheet-viewer></lyra-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(() => el.shadowRoot!.querySelector('lyra-virtual-list') !== null);
        const list = el.shadowRoot!.querySelector('lyra-virtual-list')!;
        expect(list.shadowRoot!.querySelectorAll('[part~="cell-highlight"]').length).to.equal(0);
      } finally {
        restore();
      }
    });
  });
});
