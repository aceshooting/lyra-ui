import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import { ref } from 'lit/directives/ref.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { setVirtualListCompositionProfile } from '../../../internal/virtual-list-composition.js';
import type { LyraVirtualList } from './virtual-list.class.js';
import './virtual-list.js';

type Demand = Readonly<{ start: number; endExclusive: number; pinnedIndex: number | null }>;
async function settle(el: LyraVirtualList) {
  for (let i = 0; i < 4; i++) { await el.updateComplete; await nextFrame(); }
}

it('publishes frozen mounted demand before rendering rows and keeps a distant focus pin separate', async () => {
  let demand: Demand | undefined;
  let calls = 0;
  const beforeRender = (next: Demand) => { demand = next; calls++; expect(Object.isFrozen(next)).to.equal(true); };
  const el = await fixture<LyraVirtualList>(html`<lr-virtual-list row-height="40" style="--lr-virtual-list-height:120px"
    .items=${Array.from({ length: 1000 }, (_, index) => index)}
    .renderItem=${(_value: unknown, index: number) => {
      expect(demand !== undefined).to.equal(true);
      expect(index === demand!.pinnedIndex || (index >= demand!.start && index < demand!.endExclusive)).to.equal(true);
      return html`<button data-index=${index}>${index}</button>`;
    }} ${ref(element => { if (element) setVirtualListCompositionProfile(element, { maxRows: 7, beforeRender }); })}></lr-virtual-list>`);
  await settle(el);
  expect(calls).to.be.greaterThan(0);
  await focusByKeyboard(el.shadowRoot!.querySelector<HTMLButtonElement>('[data-index="0"]')!);
  el.scrollToIndex(999, { align: 'end', behavior: 'auto' });
  await settle(el);
  expect(demand!.pinnedIndex).to.equal(0);
  expect(demand!.start).to.be.greaterThan(900);
  expect(demand!.endExclusive - demand!.start).to.be.at.most(6);
  expect(el.renderedRows.length).to.be.at.most(7);
  expect(el.shadowRoot!.querySelector('[data-index="0"]')?.matches(':focus')).to.equal(true);
  let replacementCalls = 0;
  setVirtualListCompositionProfile(el, { maxRows: 7, beforeRender: next => { demand = next; replacementCalls++; } });
  await settle(el);
  expect(replacementCalls).to.be.greaterThan(0);
});

it('publishes an empty mounted interval with equal endpoints', async () => {
  const demands: Demand[] = [];
  const el = await fixture<LyraVirtualList>(html`<lr-virtual-list ${ref(element => {
    if (element) setVirtualListCompositionProfile(element, { maxRows: 7, beforeRender: demand => demands.push(demand) });
  })}></lr-virtual-list>`);
  await settle(el);
  expect(demands.length).to.be.greaterThan(0);
  for (const demand of demands) {
    expect(demand.start).to.equal(demand.endExclusive);
    expect(demand.pinnedIndex).to.equal(null);
  }
});
