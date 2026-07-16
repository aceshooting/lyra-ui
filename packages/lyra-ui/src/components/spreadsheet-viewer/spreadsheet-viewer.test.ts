import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
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
});
