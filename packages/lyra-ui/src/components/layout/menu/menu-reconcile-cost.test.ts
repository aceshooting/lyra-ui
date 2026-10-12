import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { measureElementArrayLookups } from '../../../../test/element-array-lookup-cost.js';
import './menu.js';
import './menu-item.js';
import type { LyraMenu } from './menu.class.js';
import type { LyraMenuItem } from './menu-item.class.js';

interface Reconciliation {
  items: LyraMenuItem[];
  activeIndex: number;
  syncItemsFromSlot(slot: HTMLSlotElement): void;
  onItemStateChange(): void;
}
async function mount() {
  const menu = await fixture<LyraMenu>(html`<lr-menu>
    ${Array.from({ length: 64 }, (_, index) => html`<lr-menu-item value=${String(index)}>Item ${index}</lr-menu-item>`)}
  </lr-menu>`);
  const model = menu as unknown as Reconciliation;
  await waitUntil(() => model.items.length === 64);
  return { menu, model, items: [...model.items] };
}

it('reconciles reordered menu ownership with linear identity matching', async () => {
  const { menu, model, items } = await mount();
  const first = items[0]!;
  menu.append(...[...items].reverse());
  const comparisons = measureElementArrayLookups(items, () => model.syncItemsFromSlot(menu.shadowRoot!.querySelector('slot:not([name])')!));
  expect(model.items.map(item => item.value)).to.deep.equal(items.map(item => item.value).reverse());
  expect(model.items[model.activeIndex]?.value).to.equal(first.value);
  expect(comparisons).to.be.at.most(items.length * 4);
});

it('repairs a disabled final menu item with linear matching and chooses the first earlier survivor', async () => {
  const { model, items } = await mount();
  model.activeIndex = items.length - 1;
  items.at(-1)!.disabled = true;
  const comparisons = measureElementArrayLookups(items, () => model.onItemStateChange());
  expect(model.activeIndex).to.equal(0);
  expect(items.map(item => item.tabIndex)).to.deep.equal(items.map((_, index) => index === 0 ? 0 : -1));
  expect(comparisons).to.be.at.most(items.length * 4);
});
