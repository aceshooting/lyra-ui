import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraCsvViewer } from './csv-viewer.class.js';
import './csv-viewer.js';

type CsvSeam = { loadLibrary(): Promise<unknown>; fetchState: { kind: string } };

it('yields between admission passes and cancels an obsolete parse', async () => {
  const el = await fixture<LyraCsvViewer>(html`<lr-csv-viewer></lr-csv-viewer>`);
  const seam = el as unknown as CsvSeam;
  const originalFetch = window.fetch;
  const schedulerDescriptor = Object.getOwnPropertyDescriptor(window, 'scheduler');
  let yields = 0;
  let parses = 0;
  let cancel = false;
  window.fetch = async () => new Response('a,b\nc,d');
  Object.defineProperty(window, 'scheduler', { configurable: true, value: { yield: async () => {
    yields++;
    if (cancel) el.src = '';
  } } });
  seam.loadLibrary = async () => ({ parse: (_text: string, options: { step(value: unknown, handle: unknown): void }) => {
    parses++;
    options.step({ data: ['a', 'b'] }, { abort() {} });
    options.step({ data: ['c', 'd'] }, { abort() {} });
    return {};
  } });
  try {
    el.src = '/yield-first.csv';
    await waitUntil(() => seam.fetchState.kind === 'loaded');
    expect(yields).to.equal(2);
    expect(parses).to.equal(1);
    cancel = true;
    el.src = '/yield-obsolete.csv';
    await waitUntil(() => yields > 2 && seam.fetchState.kind === 'idle');
    expect(parses).to.equal(1);
  } finally {
    window.fetch = originalFetch;
    if (schedulerDescriptor) Object.defineProperty(window, 'scheduler', schedulerDescriptor);
    else Reflect.deleteProperty(window, 'scheduler');
  }
});
