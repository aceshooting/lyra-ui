import { sinkTexts } from '../../../../test/announcements.js';
import { expect, fixture, html } from '@open-wc/testing';
import { LyraNeighborList } from './neighbor-list.js';

it('discloses outer neighbor input loss and clears the notice after replacement', async () => {
  const rows = Array.from({ length: 10_001 }, (_, index) => ({ relation: 'related', direction: 'out' as const, node: { id: `n${index}`, label: 'Node' } }));
  const el = await fixture<LyraNeighborList>(html`<lr-neighbor-list .rows=${rows}></lr-neighbor-list>`);
  expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.include('10,001');
  el.strings = { graphDataListLimit: 'Retained {shown} from {total}' };
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.include(`Retained ${el.rows.length.toLocaleString('en')} from 10,001`);
  el.rows = rows.slice(0, 1);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="limit"]') === null).to.equal(true);
  el.rows = rows;
  await el.updateComplete;
  expect(sinkTexts()).to.include(`Retained ${el.rows.length.toLocaleString('en')} from 10,001`);
});
