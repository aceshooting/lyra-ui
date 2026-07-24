import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import * as XLSX from 'xlsx';
import './spreadsheet-viewer.js';
import type { LyraSpreadsheetViewer } from './spreadsheet-viewer.js';
import { styles } from './spreadsheet-viewer.styles.js';

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

/** A promise plus its externally-callable resolve/reject, for precisely timing a stale in-flight
 *  `load()` against a later superseding `src` change. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void } {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
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

  it('never scrolls vertically on the sheet wrapper -- overflow-x:auto alone lets the y axis compute to auto too, which can show a phantom scrollbar', async () => {
    // Same bug/fix as lr-tabs: pinning only overflow-x to a non-'visible' value forces the browser
    // to resolve the unset y axis to 'auto' too (never leaves it 'visible'), risking a phantom empty
    // vertical scrollbar on a workbook that fits horizontally.
    const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
    const restore = fetchBuffer(buffer({ Sheet1: [['Name', 'Qty'], ['Widget', 12]] }));
    try {
      el.src = 'https://example.test/book.xlsx';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="sheet"]') !== null);
      expect(getComputedStyle(el.shadowRoot!.querySelector('[part="sheet"]') as HTMLElement).overflowY).to.equal('hidden');
    } finally { restore(); }
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

  it('exposes a complete ARIA table, row, header, and cell ownership tree', async () => {
    const el = (await fixture(html`<lr-spreadsheet-viewer name="Inventory"></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
    const restore = fetchBuffer(buffer({ Sheet1: [['Name', 'Qty'], ['Widget', 12]] }));
    try {
      el.src = 'https://example.test/book.xlsx';
      await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
      const sheet = el.shadowRoot!.querySelector('[part="sheet"]')!;
      const header = el.shadowRoot!.querySelector('[part="header-row"]')!;
      const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
      await waitUntil(() => list.shadowRoot!.querySelector('[part="data-row"]') !== null);
      expect(sheet.getAttribute('role')).to.equal('table');
      expect(sheet.getAttribute('aria-rowcount')).to.equal('2');
      expect(sheet.getAttribute('aria-colcount')).to.equal('2');
      expect(header.getAttribute('role')).to.equal('row');
      expect(Array.from(header.querySelectorAll('[part~="cell"]')).map((cell) => cell.getAttribute('role'))).to.deep.equal(['columnheader', 'columnheader']);
      expect(list.getAttribute('item-role')).to.equal('row');
      expect(Array.from(list.shadowRoot!.querySelectorAll('[part~="cell"]')).map((cell) => cell.getAttribute('role'))).to.deep.equal(['cell', 'cell']);
    } finally { restore(); }
  });

  it('locale-formats numeric cell values', async () => {
    const el = (await fixture(html`<lr-spreadsheet-viewer lang="ar"></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
    const restore = fetchBuffer(buffer({ Sheet1: [['Qty'], [1234.5]] }));
    try {
      el.src = 'https://example.test/book.xlsx';
      await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
      const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
      await waitUntil(() => list.shadowRoot!.querySelector('[part~="cell"]') !== null);
      expect(list.shadowRoot!.querySelector('[part~="cell"]')!.textContent).to.equal(new Intl.NumberFormat('ar').format(1234.5));
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

  it('does not leak internal virtual-list or tabs events through the viewer host', async () => {
    const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
    const restore = fetchBuffer(buffer({ Sheet1: [['Name'], ['Ada']], Sheet2: [['Name'], ['Grace']] }));
    try {
      el.src = 'https://example.test/book.xlsx';
      await waitUntil(() => el.shadowRoot!.querySelector('lr-tabs') !== null);
      let leaked = 0;
      for (const name of ['lr-load-more', 'lr-visible-range-changed', 'lr-scroll']) {
        el.addEventListener(name as never, () => { leaked++; });
        el.shadowRoot!.querySelector('lr-virtual-list')!.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }));
      }
      el.addEventListener('lr-tabs-change' as never, () => { leaked++; });
      el.shadowRoot!.querySelector('lr-tabs')!.dispatchEvent(new CustomEvent('lr-tabs-change', {
        detail: { tabId: 'sheet-1' },
        bubbles: true,
        composed: true,
      }));
      expect(leaked).to.equal(0);
    } finally { restore(); }
  });

  it('is accessible', async () => { const el = await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`); await expect(el).to.be.accessible(); });
  it('uses name as the accessible name, falling back to a localized default', async () => {
    const named = (await fixture(html`<lr-spreadsheet-viewer name="quarterly.xlsx"></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
    expect(named.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('quarterly.xlsx');
    const unnamed = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
    expect(unnamed.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Spreadsheet');
  });
  it('lets an explicit host aria-label win over the name-derived fallback', async () => {
    // Regression test: render() previously checked `this.name || this.getAttribute('aria-label')`,
    // so a consumer-supplied host aria-label could never override an also-set `name` -- unlike every
    // sibling viewer (notebook-viewer, xml-viewer, pdf-viewer), which check the host attribute first.
    const overridden = (await fixture(
      html`<lr-spreadsheet-viewer name="quarterly.xlsx" aria-label="Q3 Financial Report"></lr-spreadsheet-viewer>`,
    )) as LyraSpreadsheetViewer;
    expect(overridden.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Q3 Financial Report');

    const labeled = (await fixture(html`<lr-spreadsheet-viewer aria-label="Q3 Financial Report"></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
    expect(labeled.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Q3 Financial Report');
    expect(labeled.shadowRoot!.querySelector('[part="base"]')!.getAttribute('role')).to.equal('region');
  });
  it('supports a .strings override for the spreadsheetViewerLabel fallback', async () => {
    const el = (await fixture(
      html`<lr-spreadsheet-viewer .strings=${{ spreadsheetViewerLabel: 'Tableur' }}></lr-spreadsheet-viewer>`,
    )) as LyraSpreadsheetViewer;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Tableur');
  });

  it('shows a localized url-not-allowed error and emits exactly one render error', async () => {
    const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
    let count = 0;
    el.addEventListener('lr-render-error', () => { count++; });
    const event = oneEvent(el, 'lr-render-error');
    el.src = 'javascript:alert(1)';
    await event;
    await aTimeout(0);
    expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Document URL is not allowed.');
    expect(count).to.equal(1);
  });

  it('surfaces a load error and emits lr-render-error when the fetch response is not ok', async () => {
    const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
    const original = window.fetch;
    window.fetch = (() => Promise.resolve({ ok: false, status: 404, statusText: 'Not Found', arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) } as Response)) as typeof window.fetch;
    try {
      const listener = oneEvent(el, 'lr-render-error');
      el.src = 'https://example.test/missing.xlsx';
      const event = (await listener) as CustomEvent<{ error: unknown }>;
      expect(event.detail.error).to.exist;
      await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Failed to load document.');
    } finally {
      window.fetch = original;
    }
  });

  it('loads without an abort signal when AbortController is unavailable', async () => {
    const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
    const restore = fetchBuffer(buffer(GRID_WORKBOOK));
    const originalAbortController = window.AbortController;
    (window as unknown as { AbortController?: unknown }).AbortController = undefined;
    try {
      el.src = 'https://example.test/book.xlsx';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="header-row"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="header-row"]')!.textContent).to.equal('NameRole');
    } finally {
      window.AbortController = originalAbortController;
      restore();
    }
  });

  it('shows the localized spreadsheet-unavailable error when the optional xlsx peer fails to load', async () => {
    const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
    (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => Promise.resolve(null);
    const restore = fetchBuffer(buffer(GRID_WORKBOOK));
    try {
      const event = oneEvent(el, 'lr-render-error');
      el.src = 'https://example.test/book.xlsx';
      await event;
      await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Spreadsheet preview is unavailable.');
    } finally {
      restore();
    }
  });

  it('reloads an already-loaded source after reconnecting', async () => {
    const original = window.fetch;
    let calls = 0;
    const value = buffer(GRID_WORKBOOK);
    window.fetch = (() => { calls++; return Promise.resolve({ ok: true, status: 200, statusText: 'OK', arrayBuffer: () => Promise.resolve(value) } as Response); }) as typeof window.fetch;
    try {
      const el = (await fixture(html`<lr-spreadsheet-viewer src="https://example.test/book.xlsx"></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      await waitUntil(() => calls === 1 && el.shadowRoot!.querySelector('[part="header-row"]') !== null);
      const parent = el.parentElement!;
      el.remove();
      parent.append(el);
      await waitUntil(() => calls === 2);
    } finally { window.fetch = original; }
  });

  it('rejects cumulative workbook rows across individually valid sheets before rendering', async () => {
    const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
    const rows = Array.from({ length: 5001 }, (_unused, index) => [index]);
    (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => Promise.resolve({
      read: () => ({ SheetNames: ['One', 'Two'], Sheets: { One: {}, Two: {} } }),
      utils: { sheet_to_json: () => rows },
    });
    const restore = fetchBuffer(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]).buffer);
    try {
      const event = oneEvent(el, 'lr-render-error');
      el.src = 'https://example.test/book.xls';
      await event;
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('This document is too large to preview.');
      expect(el.shadowRoot!.querySelector('[part="sheet"]')).to.equal(null);
    } finally { restore(); }
  });

  it('rejects excessive sheet and expanded-cell counts before eagerly rendering workbook tabs', async () => {
    const run = async (sheetNames: string[], rows: unknown[][]): Promise<void> => {
      const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => Promise.resolve({
        read: () => ({
          SheetNames: sheetNames,
          Sheets: Object.fromEntries(sheetNames.map((name) => [name, {}])),
        }),
        utils: { sheet_to_json: () => rows },
      });
      const restore = fetchBuffer(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]).buffer);
      try {
        const event = oneEvent(el, 'lr-render-error');
        el.src = 'https://example.test/book.xls';
        await event;
        expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal(
          'This document is too large to preview.',
        );
        expect(el.shadowRoot!.querySelector('lr-tabs')).to.equal(null);
      } finally {
        restore();
      }
    };

    await run(Array.from({ length: 257 }, (_unused, index) => `Sheet ${index}`), []);
    await run(['One'], Array.from({ length: 1_001 }, () => Array(1_000).fill('x')));
  });

  it('a src change while awaiting the sheetjs library import supersedes the earlier load (stale generation)', async () => {
    const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
    const lib = deferred<unknown>();
    (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => lib.promise;
    const firstRestore = fetchBuffer(buffer({ Sheet1: [['First'], ['A']] }));
    try {
      el.src = 'https://example.test/first.xlsx';
      await aTimeout(20); // let load() reach `await this.loadLibrary()` and suspend there
      firstRestore();
      const secondRestore = fetchBuffer(buffer({ Sheet1: [['Second'], ['B']] }));
      try {
        el.src = 'https://example.test/second.xlsx'; // bumps generation, superseding the first load
        await aTimeout(20); // let the second load also reach and suspend on the same shared import
        lib.resolve(XLSX); // release both suspended loads together
        // The stale first load's library import now resolves late; it must bail silently instead of
        // clobbering the second (current) document.
        await waitUntil(() => el.shadowRoot!.querySelector('[part="header-row"]') !== null);
        expect(el.shadowRoot!.querySelector('[part="header-row"]')!.textContent).to.equal('Second');
      } finally {
        secondRestore();
      }
    } finally {
      // firstRestore was already invoked above once load() had moved past the fetch step.
    }
  });

  it('switches sheets when a tab is clicked directly (not just via scrollToAnchor/search)', async () => {
    const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
    const restore = fetchBuffer(buffer({ Inventory: [['Name'], ['Widget']], Summary: [['Total'], [12]] }));
    try {
      el.src = 'https://example.test/book.xlsx';
      await waitUntil(() => el.shadowRoot!.querySelector('lr-tabs') !== null);
      const tabs = el.shadowRoot!.querySelector('lr-tabs')!;
      await (tabs as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
      const tabButtons = tabs.shadowRoot!.querySelectorAll('[part="tab"]');
      expect(tabButtons).to.have.lengthOf(2);
      (tabButtons[1] as HTMLElement).click();
      await el.updateComplete;
      expect((el as unknown as { activeSheetIndex: number }).activeSheetIndex).to.equal(1);
    } finally {
      restore();
    }
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

    it('resolves a header-row anchor and paints only the first occurrence of a duplicate highlight id', async () => {
      const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(() => el.shadowRoot!.querySelector('[part="header-row"]') !== null);
        expect(await el.scrollToAnchor({ kind: 'cell-range', range: 'B1' })).to.be.true;
        el.highlights = [
          { id: 'duplicate', anchor: { kind: 'cell-range', range: 'A1' }, label: 'First' },
          { id: 'duplicate', anchor: { kind: 'cell-range', range: 'B1' }, label: 'Ignored duplicate' },
        ];
        await el.updateComplete;
        const highlighted = el.shadowRoot!.querySelector('[part~="cell-highlight"]') as HTMLElement;
        expect(el.shadowRoot!.querySelectorAll('[part~="cell-highlight"]')).to.have.lengthOf(1);
        expect(getComputedStyle(highlighted).outlineStyle).to.equal('solid');
      } finally { restore(); }
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

    it('keeps the highlighted cell structural and emits from a nested native action', async () => {
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
        expect(highlighted.hasAttribute('tabindex')).to.be.false;
        expect(highlighted.getAttribute('role')).to.equal('cell');
        const action = highlighted.querySelector('[part="cell-highlight-action"]') as HTMLButtonElement;
        expect(action.tagName).to.equal('BUTTON');
        expect(action.getAttribute('aria-label')).to.equal('First result');
        const listener = oneEvent(el, 'lr-highlight-activate');
        action.click();
        const event = (await listener) as CustomEvent<{ id: string }>;
        expect(event.detail).to.deep.equal({ id: 'h1' });
      } finally {
        restore();
      }
    });

    it('places keyboard focus on the nested native highlight action', async () => {
      const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
        el.highlights = [{ id: 'h1', anchor: { kind: 'cell-range', range: 'A2' }, label: 'First result' }];
        await el.updateComplete;
        const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
        const highlighted = list.shadowRoot!.querySelector('[part~="cell-highlight"]') as HTMLElement;
        const action = highlighted.querySelector('[part="cell-highlight-action"]') as HTMLButtonElement;
        action.focus();
        expect(list.shadowRoot!.activeElement).to.equal(action);
      } finally {
        restore();
      }
    });

    it('ignores a keydown for a key other than Enter/Space, leaving the highlight inert', async () => {
      const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
        el.highlights = [{ id: 'h1', anchor: { kind: 'cell-range', range: 'A2' }, label: 'First result' }];
        await el.updateComplete;
        const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
        const highlighted = list.shadowRoot!.querySelector('[part~="cell-highlight-action"]') as HTMLElement;
        let activated = false;
        el.addEventListener('lr-highlight-activate', () => { activated = true; });
        highlighted.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
        await aTimeout(10);
        expect(activated).to.be.false;
      } finally {
        restore();
      }
    });

    it('resolves true when a cell-range anchor targets the header row itself', async () => {
      const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
        expect(await el.scrollToAnchor({ kind: 'cell-range', range: 'A1' })).to.be.true;
      } finally {
        restore();
      }
    });

    it('resolves false when scrollToAnchor is called before any document has loaded', async () => {
      const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      shrinkAnchorRetry(el);
      expect(await el.scrollToAnchor({ kind: 'cell-range', range: 'A2' })).to.be.false;
    });

    it('resolves false for a malformed cell-range anchor', async () => {
      const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      shrinkAnchorRetry(el);
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
        expect(await el.scrollToAnchor({ kind: 'cell-range', range: 'not-a-range' })).to.be.false;
      } finally {
        restore();
      }
    });

    it('resolves false for a row beyond the addressed sheet', async () => {
      const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      shrinkAnchorRetry(el);
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
        expect(await el.scrollToAnchor({ kind: 'cell-range', range: 'A999' })).to.be.false;
      } finally { restore(); }
    });

    it('truthfully rejects a cell-range anchor beyond the sheet\'s rendered width', async () => {
      const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK)); // only 2 rendered columns (Name, Role)
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
        expect(await el.scrollToAnchor({ kind: 'cell-range', range: 'K2' })).to.be.false;
      } finally {
        restore();
      }
    });

    it('jumpToCell resolves false when no document is loaded yet', async () => {
      const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      const result = await (
        el as unknown as { jumpToCell: (sheetIndex: number, rawRow: number, col: number) => Promise<boolean> }
      ).jumpToCell(0, 2, 0);
      expect(result).to.be.false;
    });

    it('jumpToCell resolves false for a sheet index outside the loaded workbook', async () => {
      const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
        const result = await (
          el as unknown as { jumpToCell: (sheetIndex: number, rawRow: number, col: number) => Promise<boolean> }
        ).jumpToCell(5, 2, 0);
        expect(result).to.be.false;
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

    it('targets the requested sheet header instead of the first workbook header', async () => {
      const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer({ Sheet1: [['First'], [1]], Sheet2: [['Second'], [2]] }));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="header-row"]').length === 2);
        const headers = el.shadowRoot!.querySelectorAll('[part="header-row"] [part~="cell"]');
        let firstScrolled = false;
        let secondScrolled = false;
        (headers[0] as HTMLElement).scrollIntoView = () => { firstScrolled = true; };
        (headers[1] as HTMLElement).scrollIntoView = () => { secondScrolled = true; };
        expect(await el.scrollToAnchor({ kind: 'cell-range', sheet: 'Sheet2', range: 'A1' })).to.be.true;
        expect(firstScrolled).to.be.false;
        expect(secondScrolled).to.be.true;
      } finally { restore(); }
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

    it('caps retained search matches before allocating an unbounded result list', async () => {
      const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      (el as unknown as { fetchState: unknown }).fetchState = {
        kind: 'loaded',
        sheets: [{ name: 'One', rows: Array.from({ length: 1_001 }, () => ['hit']) }],
      };
      await el.updateComplete;
      expect(await el.search('hit')).to.equal(1_000);
      expect((el as unknown as { searchMatches: unknown[] }).searchMatches).to.have.lengthOf(1_000);
    });

    it('case-folds with the effective locale and navigates a header match', async () => {
      const el = (await fixture(html`<lr-spreadsheet-viewer lang="tr"></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer({ Sheet1: [['İSTANBUL'], ['Ankara']] }));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(() => el.shadowRoot!.querySelector('[part="header-row"]') !== null);
        expect(await el.search('istanbul')).to.equal(1);
      } finally { restore(); }
    });

    it('recomputes an active search when the host language changes', async () => {
      const el = (await fixture(html`<lr-spreadsheet-viewer lang="en"></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer({ Sheet1: [['City'], ['İSTANBUL'], ['istanbul']] }));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
        expect(await el.search('istanbul')).to.equal(1);
        el.lang = 'tr';
        await el.updateComplete;
        await aTimeout(0);
        expect((el as unknown as { searchMatches: unknown[] }).searchMatches).to.have.lengthOf(2);
      } finally { restore(); }
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

    it('resolves 0 and leaves no active match for a query with no hits', async () => {
      const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
        const count = await el.search('zzz-not-present');
        expect(count).to.equal(0);
        expect(await el.searchNext()).to.be.false;
      } finally {
        restore();
      }
    });

    it('searchNext and searchPrevious resolve false when there is no active search', async () => {
      const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      expect(await el.searchNext()).to.be.false;
      expect(await el.searchPrevious()).to.be.false;
    });

    it('searchPrevious wraps to the last match, mirroring searchNext in reverse', async () => {
      const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
        const count = await el.search('ada');
        expect(count).to.equal(2); // "Ada" appears in two data rows, column 0
        let detail: { matchCount: number; activeIndex: number } | undefined;
        el.addEventListener('lr-search-change', (e) => (detail = (e as CustomEvent).detail));
        expect(await el.searchPrevious()).to.be.true;
        expect(detail!.activeIndex).to.equal(1); // wraps backward from 0 to the last match
        expect(await el.searchPrevious()).to.be.true;
        expect(detail!.activeIndex).to.equal(0);
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
        const action = highlighted.querySelector('[part="cell-highlight-action"]') as HTMLElement;
        const style = getComputedStyle(highlighted);
        expect(style.outlineStyle).to.equal('solid');
        expect(style.outlineWidth).to.not.equal('0px');
        expect(style.outlineColor).to.equal('rgb(1, 2, 3)');
        expect(getComputedStyle(action).cursor).to.equal('pointer');
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

    it('shows the shared focus ring while the nested highlight action is focused', async () => {
      injectStyle('lr-spreadsheet-viewer { --lr-theme-color-brand-fill-loud: rgb(1, 2, 3); --lr-theme-color-warning-fill-loud: rgb(4, 5, 6); }');
      const el = (await fixture(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`)) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        const { highlighted } = await mountHighlighted(el, 'h1');
        const action = highlighted.querySelector('[part="cell-highlight-action"]') as HTMLElement;
        expect(getComputedStyle(highlighted).outlineColor).to.equal('rgb(4, 5, 6)');
        action.focus();
        expect(getComputedStyle(action).outlineColor).to.equal('rgb(1, 2, 3)');
      } finally { restore(); }
    });

    it('gives the cell-highlight-action part a :hover rule alongside its :focus-visible one', () => {
      // Regression test: a mouse user hovering a highlighted cell previously got no visual change
      // beyond the cursor shape, since only :focus-visible was styled -- getComputedStyle can't
      // synthesize a real :hover state without dispatching pointer events the wtr harness can't
      // simulate, so (matching commit-card.test.ts's identical convention) this asserts against the
      // stylesheet source text.
      const css = styles.cssText.replace(/\s+/g, ' ');
      expect(css).to.match(/cell-highlight-action\)\s*:hover/);
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
        expect(highlighted.getAttribute('role')).to.equal('cell');
        expect(highlighted.querySelector('[part="cell-highlight-action"]')?.localName).to.equal('button');
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
