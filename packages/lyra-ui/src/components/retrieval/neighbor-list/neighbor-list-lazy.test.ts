import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-neighbor-list.js';
import type { LyraNeighborRow } from '../../lr-neighbor-list.js';

const row = (index: number): LyraNeighborRow => ({
  relation: 'knows',
  direction: 'out',
  node: { id: `n${index}`, label: `Node ${index}` },
});

it('registers lr-virtual-list only once a list first needs it', async () => {
  await fixture(html`<lr-neighbor-list .rows=${[row(0), row(1)]}></lr-neighbor-list>`);
  expect(customElements.get('lr-virtual-list') === undefined, 'registered eagerly').to.equal(true);
  const el = await fixture<HTMLElement>(html`<lr-neighbor-list
    .rows=${Array.from({ length: 150 }, (_, index) => row(index))}
  ></lr-neighbor-list>`);
  await waitUntil(() => customElements.get('lr-virtual-list') !== undefined, 'virtual list registered', {
    timeout: 5000,
  });
  await waitUntil(
    () => el.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot?.querySelector('[part~="row"]') != null,
    'virtualized rows rendered',
    { timeout: 5000 }
  );
});

it('loads the pager when source navigation first needs it and settles its first render in updateComplete', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-neighbor-list']>(html`<lr-neighbor-list></lr-neighbor-list>`);
  expect(customElements.get('lr-pagination') === undefined).to.equal(true);
  el.centerKey = 'node:a';
  el.graphSource = { revision: 1, records: { revision: 1,
    query: async () => ({rows: [], total: 0, summary: {nodes:0, edges:0}}), lookup: async () => [], locate: async () => null },
    scene: async () => ({nodes:[], edges:[], total:{nodes:0, edges:0}, coverage:'complete', worldBounds:null}) };
  // updateComplete covers the pager's registration and its first render, with no extra wait.
  await el.updateComplete;
  const pager = el.shadowRoot!.querySelector('lr-pagination')!;
  expect(pager.matches(':defined')).to.equal(true);
  expect(pager.hasUpdated).to.equal(true);
  expect(pager.isUpdatePending).to.equal(false);
  expect(pager.shadowRoot!.querySelector('[part~="base"]') !== null).to.equal(true);
  expect(pager.page).to.equal(1);
});
