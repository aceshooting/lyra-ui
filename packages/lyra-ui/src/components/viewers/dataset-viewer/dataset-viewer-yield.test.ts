import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraDatasetViewer } from './dataset-viewer.class.js';
import './dataset-viewer.js';

it('yields between dataset admission and record parsing', async () => {
  const el = await fixture<LyraDatasetViewer>(html`<lr-dataset-viewer></lr-dataset-viewer>`);
  const seam = el as unknown as { fetchState: { kind: string } };
  const fetch = window.fetch;
  const descriptor = Object.getOwnPropertyDescriptor(window, 'scheduler');
  let yields = 0;
  window.fetch = async () => new Response('Name,Value\nOne,1');
  Object.defineProperty(window, 'scheduler', { configurable: true, value: { yield: async () => { yields++; } } });
  try {
    el.src = '/yield.csv';
    await waitUntil(() => seam.fetchState.kind === 'loaded');
    expect(yields).to.equal(2);
  } finally {
    window.fetch = fetch;
    if (descriptor) Object.defineProperty(window, 'scheduler', descriptor);
    else Reflect.deleteProperty(window, 'scheduler');
  }
});
