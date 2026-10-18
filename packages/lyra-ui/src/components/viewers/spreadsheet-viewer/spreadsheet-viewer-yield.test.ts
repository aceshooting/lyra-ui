import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraSpreadsheetViewer } from './spreadsheet-viewer.class.js';
import './spreadsheet-viewer.js';

it('yields before workbook parsing and between sheet projections', async () => {
  const el = await fixture<LyraSpreadsheetViewer>(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`);
  const seam = el as unknown as { loadLibrary(): Promise<unknown>; fetchState: { kind: string } };
  const fetch = window.fetch;
  const descriptor = Object.getOwnPropertyDescriptor(window, 'scheduler');
  const stages: string[] = [];
  window.fetch = async () => new Response(new Uint8Array([1, 2, 3]));
  Object.defineProperty(window, 'scheduler', { configurable: true, value: { yield: async () => { stages.push('yield'); } } });
  seam.loadLibrary = async () => ({
    read: () => { stages.push('read'); return { SheetNames: ['One', 'Two'], Sheets: { One: { '!ref': 'A1' }, Two: { '!ref': 'A1' } } }; },
    utils: { sheet_to_json: () => { stages.push('sheet'); return [['Value']]; } },
  });
  try {
    el.src = '/yield.xlsx';
    await waitUntil(() => seam.fetchState.kind === 'loaded');
    expect(stages).to.deep.equal(['yield', 'read', 'yield', 'sheet', 'yield', 'sheet']);
  } finally {
    window.fetch = fetch;
    if (descriptor) Object.defineProperty(window, 'scheduler', descriptor);
    else Reflect.deleteProperty(window, 'scheduler');
  }
});
