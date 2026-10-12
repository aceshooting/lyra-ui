import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { measureElementArrayLookups } from '../../../../test/element-array-lookup-cost.js';
import './menubar.js';
import type { LyraMenubar } from './menubar.class.js';
import type { LyraMenubarItem } from './menubar-item.class.js';

interface Reconciliation {
  items: LyraMenubarItem[];
  activeIndex: number;
  syncItems(): void;
  syncItemState(): void;
}
async function mount() {
  const bar = await fixture<LyraMenubar>(html`<lr-menubar label="Commands">
    ${Array.from({ length: 64 }, (_, index) => html`<lr-menubar-item id=${`command-${index}`}>Command ${index}</lr-menubar-item>`)}
  </lr-menubar>`);
  const model = bar as unknown as Reconciliation;
  await waitUntil(() => model.items.length === 64);
  return { bar, model, items: [...model.items] };
}

it('reconciles reordered menubar ownership with linear identity matching', async () => {
  const { bar, model, items } = await mount();
  const active = items[model.activeIndex]!.id;
  bar.append(...[...items].reverse());
  const comparisons = measureElementArrayLookups(items, () => model.syncItems());
  expect(model.items.map(item => item.id)).to.deep.equal(items.map(item => item.id).reverse());
  expect(model.items[model.activeIndex]?.id).to.equal(active);
  expect(comparisons).to.be.at.most(items.length * 4);
});

it('keeps menubar nearest-predecessor repair distinct from menu first-earlier repair', async () => {
  const { model, items } = await mount();
  model.activeIndex = items.length - 1;
  items.at(-1)!.disabled = true;
  model.syncItemState();
  expect(model.activeIndex).to.equal(items.length - 2);
  expect(items.at(-2)!.tabIndex).to.equal(0);
});
