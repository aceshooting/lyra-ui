import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraSpreadsheetViewer } from './spreadsheet-viewer.class.js';
import '../../lr-spreadsheet-viewer.js';

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

it('discards a workbook if the spreadsheet parser detaches its host', async () => {
  const viewer = await fixture<LyraSpreadsheetViewer>(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`);
  const originalFetch = window.fetch;
  window.fetch = async () => new Response(new Uint8Array([1, 2, 3]));
  let loaded = 0;
  let projected = false;
  viewer.addEventListener('lr-load', () => ++loaded);
  (viewer as unknown as { loadLibrary(): Promise<unknown> }).loadLibrary = async () => ({
    read() { viewer.remove(); return { SheetNames: ['People'], Sheets: { People: {} } }; },
    utils: { sheet_to_json() { projected = true; return []; } },
  });
  try {
    viewer.src = '/people.xlsx';
    await waitUntil(() => !viewer.isConnected);
    expect([loaded, projected]).to.deep.equal([0, false]);
  } finally { window.fetch = originalFetch; }
});

it('drops the source when a queued task detaches the viewer before parsing resumes', async () => {
  const viewer = await fixture<LyraSpreadsheetViewer>(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`);
  const originalFetch = window.fetch;
  const scheduler = Object.getOwnPropertyDescriptor(window, 'scheduler');
  let loads = 0;
  viewer.addEventListener('lr-load', () => ++loads);
  window.fetch = async () => new Response('workbook bytes');
  Object.defineProperty(window, 'scheduler', { configurable: true, value: {
    yield() {
      const pending = Promise.resolve();
      void pending.then(() => queueMicrotask(() => viewer.remove()));
      return pending;
    },
  } });
  try {
    viewer.src = '/retired';
    await waitUntil(() => !viewer.isConnected);
    await viewer.updateComplete;
    expect(loads).to.equal(0);
    expect(viewer.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
  } finally {
    window.fetch = originalFetch;
    if (scheduler) Object.defineProperty(window, 'scheduler', scheduler);
    else Reflect.deleteProperty(window, 'scheduler');
  }
});
