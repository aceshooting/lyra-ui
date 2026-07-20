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

describe('lr-spreadsheet-viewer', () => {
  it('renders an empty localized state by default', async () => {
    const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
    expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal('No document to display.');
  });

  it('renders a workbook header and virtualized body rows', async () => {
    const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
    const restore = fetchBuffer(buffer({ Sheet1: [['Name', 'Qty'], ['Widget', 12], ['Gadget', 3]] }));
    try {
      el.src = 'https://example.test/book.xlsx';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="header-row"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="header-row"]')!.textContent).to.equal('NameQty');
      expect((el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { items: unknown[][] }).items).to.deep.equal([['Widget', 12], ['Gadget', 3]]);
    } finally { restore(); }
  });

  it('renders data rows as a grid, matching the header row, not as unstyled stacked text', async () => {
    // Regression test: renderRow()/renderCell()'s output for data rows is rendered inside
    // <lr-virtual-list>'s own shadow root via its renderItem callback, a different shadow tree
    // than spreadsheet-viewer.styles.ts's stylesheet is scoped to -- a plain [part='data-row']/
    // [part='cell'] CSS selector there can never reach it, only the header row (rendered directly
    // by this component). Same bug/fix as lr-csv-viewer's identical architecture.
    const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
    const restore = fetchBuffer(buffer(GRID_WORKBOOK));
    try {
      el.src = 'https://example.test/book.xlsx';
      await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
      const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
      await waitUntil(() => list.shadowRoot!.querySelector('[part="data-row"]') !== null);
      const headerRow = el.shadowRoot!.querySelector('[part="header-row"]') as HTMLElement;
      const dataRow = list.shadowRoot!.querySelector('[part="data-row"]') as HTMLElement;
      expect(getComputedStyle(dataRow).display).to.equal('grid');
      expect(getComputedStyle(dataRow).display).to.equal(getComputedStyle(headerRow).display);
      const headerCell = headerRow.querySelector('[part="cell"]') as HTMLElement;
      const dataCell = dataRow.querySelector('[part="cell"]') as HTMLElement;
      expect(getComputedStyle(dataCell).paddingInlineStart).to.not.equal('0px');
      expect(getComputedStyle(dataCell).paddingInlineStart).to.equal(getComputedStyle(headerCell).paddingInlineStart);
      expect(getComputedStyle(dataCell).borderInlineEndStyle).to.equal('solid');
    } finally { restore(); }
  });

  it('renders tabs for multiple sheets', async () => {
    const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
    const restore = fetchBuffer(buffer({ Inventory: [['Name'], ['Widget']], Summary: [['Total'], [12]] }));
    try {
      el.src = 'https://example.test/book.xlsx';
      await waitUntil(() => el.shadowRoot!.querySelector('lr-tabs') !== null);
      const tabs = el.shadowRoot!.querySelector('lr-tabs')!;
      await (tabs as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
      expect(tabs.shadowRoot!.querySelectorAll('[part="tab"]')).to.have.lengthOf(2);
    } finally { restore(); }
  });

  it('is accessible', async () => { const el = await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`); await expect(el).to.be.accessible(); });
  it('uses name as the accessible name, falling back to a localized default', async () => {
    const named = (await fixture(html`<lr-spreadsheet-viewer name="quarterly.xlsx"></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
    expect(named.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('quarterly.xlsx');
    const unnamed = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
    expect(unnamed.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Spreadsheet');
  });

  describe('cell-range anchor-target', () => {
    it('scrolls to a cell-range anchor addressing the raw grid (header included)', async () => {
      const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
        // Row 2 (raw, 1-based, header at row 1) is the first data row ("Ada,Mathematician").
        expect(await el.scrollToAnchor({ kind: 'cell-range', range: 'A2' })).to.be.true;
      } finally {
        restore();
      }
    });

    it('resolves false for an anchor targeting a sheet that does not exist', async () => {
      const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      shrinkAnchorRetry(el);
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
        expect(await el.scrollToAnchor({ kind: 'cell-range', sheet: 'NoSuchSheet', range: 'A1' })).to.be.false;
      } finally {
        restore();
      }
    });

    it('renders a focusable cell-highlight and emits lr-highlight-activate', async () => {
      const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
        el.highlights = [{ id: 'h1', anchor: { kind: 'cell-range', range: 'A2' }, label: 'First result' }];
        await el.updateComplete;
        const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
        const highlighted = list.shadowRoot!.querySelector('[part~="cell-highlight"]') as HTMLElement;
        expect(highlighted).to.exist;
        expect(highlighted.getAttribute('tabindex')).to.equal('0');
        expect(highlighted.getAttribute('role')).to.equal('button');
        expect(highlighted.getAttribute('aria-label')).to.equal('First result');
        const listener = oneEvent(el, 'lr-highlight-activate');
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
      const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer({ Sheet1: [['X'], [1], [2]], Sheet2: [['Name'], ['Ada'], ['Grace']] }));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(() => el.shadowRoot!.querySelector('lr-tabs') !== null);
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
      const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
        const count = await el.search('ada');
        expect(count).to.equal(2); // "Ada" appears in two data rows, column 0
        let detail: { matchCount: number; activeIndex: number } | undefined;
        el.addEventListener('lr-search-change', (e) => (detail = (e as CustomEvent).detail));
        expect(await el.searchNext()).to.be.true;
        expect(detail!.activeIndex).to.equal(1);
        expect(await el.searchNext()).to.be.true;
        expect(detail!.activeIndex).to.equal(0); // wraps
      } finally {
        restore();
      }
    });

    it('scans every sheet, switching tabs when a match lives on a different one', async () => {
      const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer({ Sheet1: [['X'], ['nothing']], Sheet2: [['Name'], ['Ada'], ['Grace']] }));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(() => el.shadowRoot!.querySelector('lr-tabs') !== null);
        const count = await el.search('ada');
        expect(count).to.equal(1);
        expect((el as unknown as { activeSheetIndex: number }).activeSheetIndex).to.equal(1);
      } finally {
        restore();
      }
    });

    it('clearSearch resets matchCount/activeIndex to 0/-1', async () => {
      const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
        await el.search('ada');
        const listener = oneEvent(el, 'lr-search-change');
        el.clearSearch();
        const event = (await listener) as CustomEvent<{ matchCount: number; activeIndex: number }>;
        expect(event.detail).to.deep.equal({ query: '', matchCount: 0, activeIndex: -1 });
      } finally {
        restore();
      }
    });
  });

  describe('cell-highlight styling', () => {
    const injected: HTMLStyleElement[] = [];
    function injectStyle(cssText: string): void {
      const style = document.createElement('style');
      style.textContent = cssText;
      document.head.append(style);
      injected.push(style);
    }
    afterEach(() => { for (const style of injected.splice(0)) style.remove(); });

    /** Loads GRID_WORKBOOK, highlights A2, and resolves the highlighted cell alongside a plain one
     *  -- both live inside <lr-virtual-list>'s own shadow root, one hop in from this component's. */
    async function mountHighlighted(el: LyraSpreadsheetViewer, activeId: string | null = null): Promise<{ highlighted: HTMLElement; plain: HTMLElement; dataRow: HTMLElement }> {
      el.src = 'https://example.test/book.xlsx';
      await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
      el.highlights = [{ id: 'h1', anchor: { kind: 'cell-range', range: 'A2' }, label: 'First result' }];
      el.activeHighlightId = activeId;
      await el.updateComplete;
      const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
      await waitUntil(() => list.shadowRoot!.querySelector('[part~="cell-highlight"]') !== null);
      return {
        highlighted: list.shadowRoot!.querySelector('[part~="cell-highlight"]') as HTMLElement,
        plain: list.shadowRoot!.querySelector('[part="cell"]') as HTMLElement,
        dataRow: list.shadowRoot!.querySelector('[part="data-row"]') as HTMLElement,
      };
    }

    it('paints a highlighted cell with an outline no plain cell has', async () => {
      injectStyle('lr-spreadsheet-viewer { --lr-theme-color-brand-fill-loud: rgb(1, 2, 3); }');
      const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        const { highlighted, plain } = await mountHighlighted(el);
        const style = getComputedStyle(highlighted);
        expect(style.outlineStyle).to.equal('solid');
        expect(style.outlineWidth).to.not.equal('0px');
        expect(style.outlineColor).to.equal('rgb(1, 2, 3)');
        expect(style.cursor).to.equal('pointer');
        expect(getComputedStyle(plain).outlineStyle).to.equal('none');
      } finally { restore(); }
    });

    it('tints the active highlight apart from an inactive one', async () => {
      injectStyle('lr-spreadsheet-viewer { --lr-theme-color-brand-fill-loud: rgb(1, 2, 3); --lr-theme-color-warning-fill-loud: rgb(4, 5, 6); }');
      const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        const { highlighted } = await mountHighlighted(el, 'h1');
        expect(getComputedStyle(highlighted).outlineColor).to.equal('rgb(4, 5, 6)');
      } finally { restore(); }
    });

    it('swaps the highlight outline for the shared focus ring while the cell is focused', async () => {
      // The highlight outline is unconditional, so without an explicit :focus-visible rule it would
      // simply swallow the focus ring on this focusable cell -- indistinguishable from an unfocused
      // highlight. Probing the active (warning-tinted) highlight makes the swap unambiguous.
      injectStyle('lr-spreadsheet-viewer { --lr-theme-color-brand-fill-loud: rgb(1, 2, 3); --lr-theme-color-warning-fill-loud: rgb(4, 5, 6); }');
      const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        const { highlighted } = await mountHighlighted(el, 'h1');
        expect(getComputedStyle(highlighted).outlineColor).to.equal('rgb(4, 5, 6)');
        highlighted.focus();
        expect(getComputedStyle(highlighted).outlineColor).to.equal('rgb(1, 2, 3)');
      } finally { restore(); }
    });

    it('exports data-row, cell, and cell-highlight to a consumer stylesheet', async () => {
      injectStyle(`
        lr-spreadsheet-viewer::part(data-row) { opacity: 0.75; }
        lr-spreadsheet-viewer::part(cell) { padding-block-start: 3px; }
        lr-spreadsheet-viewer::part(cell-highlight) { padding-block-start: 5px; }
      `);
      const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        const { highlighted, plain, dataRow } = await mountHighlighted(el);
        expect(getComputedStyle(dataRow).opacity).to.equal('0.75');
        expect(getComputedStyle(plain).paddingBlockStart).to.equal('3px');
        expect(getComputedStyle(highlighted).paddingBlockStart).to.equal('5px');
      } finally { restore(); }
    });

    it('is accessible with a highlighted cell rendered', async () => {
      const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        const { highlighted } = await mountHighlighted(el);
        expect(highlighted.getAttribute('role')).to.equal('button');
        await expect(el).to.be.accessible();
      } finally { restore(); }
    });
  });

  describe('back-compat', () => {
    it('rendering is unchanged with highlights empty and no search active', async () => {
      const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
        const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
        expect(list.shadowRoot!.querySelectorAll('[part~="cell-highlight"]').length).to.equal(0);
      } finally {
        restore();
      }
    });
  });
});
