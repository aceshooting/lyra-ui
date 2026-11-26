import { html, ssrFixture } from '../wtr-ssr-fixture.js';
import { expect } from '@open-wc/testing';
import type { LyraVirtualList } from '../../src/components/lr-virtual-list.js';

it('hydrates a fixed-column gallery with item positions and a partial final row', async () => {
  const list = await ssrFixture<LyraVirtualList>(html`<lr-virtual-list columns="3" row-height="40"
    .items=${['A', 'B', 'C', 'D']}></lr-virtual-list>`);
  expect(list.offsetForIndex(2)).to.equal(0);
  expect(list.offsetForIndex(4)).to.equal(80);
  const cells = [...list.shadowRoot!.querySelectorAll('[part="row"]')];
  expect(cells.map(cell => cell.getAttribute('aria-posinset'))).to.deep.equal(['1', '2', '3', '4']);
});
