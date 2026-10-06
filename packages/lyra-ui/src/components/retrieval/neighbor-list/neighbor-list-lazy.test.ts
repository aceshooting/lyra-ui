import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './neighbor-list.js';
import type { LyraNeighborRow } from './neighbor-list.js';

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
