import { expect, fixture, html } from '@open-wc/testing';
import './json-viewer.js';
import type { LyraJsonViewer } from './json-viewer.js';

it('bounds traversal of shared acyclic branches independently from snapshot admission', async () => {
  const shared = Object.fromEntries(Array.from({ length: 100 }, (_, index) => [`leaf-${index}`, 'needle']));
  const data = Object.fromEntries(Array.from({ length: 60 }, (_, index) => [`branch-${index}`, shared]));
  const viewer = await fixture<LyraJsonViewer>(html`<lr-json-viewer .data=${data} expand-depth="0"></lr-json-viewer>`);
  let exact: boolean | undefined;
  viewer.addEventListener('lr-search-change', (event) => { exact = event.detail.matchCountExact; });
  expect(await viewer.runSearch('absent')).to.equal(0);
  expect(exact).to.equal(false);
  expect(viewer.shadowRoot!.querySelectorAll('[part="limit"]').length).to.equal(1);
  viewer.expandDepth = 2;
  await viewer.updateComplete;
  const rows = viewer.shadowRoot!.querySelectorAll('[part="row"]');
  expect(rows.length).to.be.greaterThan(4900);
  // Each expanded object also owns a closing-bracket row, so rendered row count can exceed the
  // 5,000 visited-node budget while remaining bounded by the number of expanded containers.
  expect(rows.length).to.be.at.most(5100);
  expect(viewer.shadowRoot!.textContent).to.contain('needle');
  expect(viewer.shadowRoot!.textContent).not.to.contain('Circular');
  viewer.data = { safe: 'replacement' };
  await viewer.updateComplete;
  expect(await viewer.runSearch('replacement')).to.equal(1);
  expect(exact).to.equal(true);
  expect(viewer.shadowRoot!.querySelectorAll('[part="limit"]').length).to.equal(0);
});
