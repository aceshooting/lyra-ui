import { expect, fixture, html } from '@open-wc/testing';
import type { LyraJsonViewer } from './json-viewer.class.js';
import './json-viewer.js';

it('uses the default node budget when unset and admits a bounded raised budget', async () => {
  const el = await fixture<LyraJsonViewer>(html`<lr-json-viewer expand-depth="0"></lr-json-viewer>`);
  const seam = el as unknown as { maxNodes: number; dataSnapshot: unknown[] };
  expect(seam.maxNodes).to.equal(5000);
  seam.maxNodes = 7000;
  el.data = Array.from({ length: 6000 }, (_, index) => index);
  await el.updateComplete;
  expect(seam.dataSnapshot.length).to.equal(6000);
  seam.maxNodes = 100;
  await el.updateComplete;
  expect(seam.dataSnapshot.length).to.equal(99);
  seam.maxNodes = NaN;
  await el.updateComplete;
  expect(seam.dataSnapshot.length).to.equal(4999);
  expect(el.shadowRoot!.querySelector('[part="limit"]') !== null).to.equal(true);
});
