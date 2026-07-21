import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './reorder-list.js';
import './reorder-item.js';
import type { LyraReorderList } from './reorder-list.class.js';
import type { LyraReorderItem } from './reorder-item.class.js';

describe('<lr-reorder-list>', () => {
  const threeItems = html`
    <lr-reorder-list>
      <lr-reorder-item value="a">Row A</lr-reorder-item>
      <lr-reorder-item value="b">Row B</lr-reorder-item>
      <lr-reorder-item value="c">Row C</lr-reorder-item>
    </lr-reorder-list>
  `;
  const itemsOf = (el: LyraReorderList) => [...el.querySelectorAll('lr-reorder-item')] as LyraReorderItem[];

  it('renders role="list" on its internal base and forwards label to aria-label', async () => {
    const el = await fixture<LyraReorderList>(html`
      <lr-reorder-list label="Steps"><lr-reorder-item>Row</lr-reorder-item></lr-reorder-list>
    `);
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute('role')).to.equal('list');
    expect(base.getAttribute('aria-label')).to.equal('Steps');
  });

  it('marks the first item atStart and the last item atEnd after initial slotchange', async () => {
    const el = await fixture<LyraReorderList>(threeItems);
    const items = itemsOf(el);
    expect(items[0].atStart).to.be.true;
    expect(items[0].atEnd).to.be.false;
    expect(items[1].atStart).to.be.false;
    expect(items[1].atEnd).to.be.false;
    expect(items[2].atStart).to.be.false;
    expect(items[2].atEnd).to.be.true;
  });

  it('moves the middle item up on a move-up button click and emits lr-reorder with the new order', async () => {
    const el = await fixture<LyraReorderList>(threeItems);
    const middle = itemsOf(el)[1];
    const upButton = middle.shadowRoot!.querySelector('[part="move-up-button"]') as HTMLButtonElement;

    const listener = oneEvent(el, 'lr-reorder');
    upButton.click();
    const event = (await listener) as CustomEvent<{ order: string[]; fromIndex: number; toIndex: number }>;

    expect(event.detail).to.deep.equal({ order: ['b', 'a', 'c'], fromIndex: 1, toIndex: 0 });
    expect(itemsOf(el).map((i) => i.value)).to.deep.equal(['b', 'a', 'c']);
    expect(itemsOf(el)[0].atStart).to.be.true;
    expect(itemsOf(el)[1].atStart).to.be.false;
  });

  it('moves the middle item down via Ctrl+ArrowDown from focus inside the row', async () => {
    const el = await fixture<LyraReorderList>(threeItems);
    const downButton = itemsOf(el)[1].shadowRoot!.querySelector('[part="move-down-button"]') as HTMLButtonElement;
    downButton.focus();

    const listener = oneEvent(el, 'lr-reorder');
    downButton.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', ctrlKey: true, bubbles: true, composed: true }),
    );
    const event = (await listener) as CustomEvent<{ order: string[]; fromIndex: number; toIndex: number }>;

    expect(event.detail).to.deep.equal({ order: ['a', 'c', 'b'], fromIndex: 1, toIndex: 2 });
  });

  it('restores focus to a still-enabled button after the move', async () => {
    const el = await fixture<LyraReorderList>(threeItems);
    const items = itemsOf(el);
    const lastUpButton = items[2].shadowRoot!.querySelector('[part="move-up-button"]') as HTMLButtonElement;
    lastUpButton.click();
    await el.updateComplete;
    // "c" moved from index 2 to index 1 -- still has a move-up available, focus should land there.
    // Re-query rather than reuse the stale `items` array: `items[1]` is a frozen reference to the
    // original "b" element and never moves, so checking it would test the wrong node's shadow root.
    const activeInShadow = itemsOf(el)[1].shadowRoot!.activeElement;
    expect(activeInShadow?.getAttribute('part')).to.equal('move-up-button');
  });

  it('restores focus to a real button inside the moved item after a boundary-crossing move on a 2-item list', async () => {
    // Regression test for a focus-loss bug: on a 2-item list, clicking the FIRST item's
    // move-down button makes that item (now at index 1) the new atEnd boundary -- the exact
    // "fallback to the opposite-direction button" case where the chosen refocus target
    // (move-up-button) was disabled BEFORE this move and only becomes enabled once Lit's
    // deferred render actually clears the `disabled` attribute in the live DOM.
    const el = await fixture<LyraReorderList>(html`
      <lr-reorder-list>
        <lr-reorder-item value="a">Row A</lr-reorder-item>
        <lr-reorder-item value="b">Row B</lr-reorder-item>
      </lr-reorder-list>
    `);
    const firstDownButton = itemsOf(el)[0].shadowRoot!.querySelector('[part="move-down-button"]') as HTMLButtonElement;

    const listener = oneEvent(el, 'lr-reorder');
    firstDownButton.click();
    await listener;
    await el.updateComplete;

    const movedItem = itemsOf(el)[1]; // "a" moved from index 0 to index 1
    expect(movedItem.value).to.equal('a');
    const active = movedItem.shadowRoot!.activeElement;
    expect(active, 'focus lands on a real element inside the moved item, not lost to document.body').to.exist;
    expect(active?.tagName).to.equal('BUTTON');
    expect((active as HTMLButtonElement).disabled, 'the focused button is not disabled').to.be.false;
    expect(active?.getAttribute('part')).to.equal('move-up-button');
    expect(document.activeElement === el || el.contains(document.activeElement), 'active element resolves into the list, not document.body').to.be
      .true;
  });

  it('restores focus to a real button inside the moved item after a boundary-crossing move via Ctrl/Cmd+ArrowDown on a 2-item list', async () => {
    const el = await fixture<LyraReorderList>(html`
      <lr-reorder-list>
        <lr-reorder-item value="a">Row A</lr-reorder-item>
        <lr-reorder-item value="b">Row B</lr-reorder-item>
      </lr-reorder-list>
    `);
    const firstDownButton = itemsOf(el)[0].shadowRoot!.querySelector('[part="move-down-button"]') as HTMLButtonElement;
    firstDownButton.focus();

    const listener = oneEvent(el, 'lr-reorder');
    firstDownButton.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', ctrlKey: true, bubbles: true, composed: true }),
    );
    await listener;
    await el.updateComplete;

    const movedItem = itemsOf(el)[1]; // "a" moved from index 0 to index 1
    expect(movedItem.value).to.equal('a');
    const active = movedItem.shadowRoot!.activeElement;
    expect(active, 'focus lands on a real element inside the moved item, not lost to document.body').to.exist;
    expect(active?.tagName).to.equal('BUTTON');
    expect((active as HTMLButtonElement).disabled, 'the focused button is not disabled').to.be.false;
    expect(active?.getAttribute('part')).to.equal('move-up-button');
  });

  it('is a no-op at a boundary: no event, item stays put', async () => {
    const el = await fixture<LyraReorderList>(threeItems);
    const first = itemsOf(el)[0];
    const upButton = first.shadowRoot!.querySelector('[part="move-up-button"]') as HTMLButtonElement;
    expect(upButton.disabled).to.be.true;

    let emitted = false;
    el.addEventListener('lr-reorder', () => {
      emitted = true;
    });
    upButton.click();
    await el.updateComplete;
    expect(emitted).to.be.false;
    expect(itemsOf(el).map((i) => i.value)).to.deep.equal(['a', 'b', 'c']);
  });

  it('is a no-op on a disabled item, even via the keyboard shortcut', async () => {
    const el = await fixture<LyraReorderList>(threeItems);
    itemsOf(el)[1].disabled = true;
    await el.updateComplete;

    let emitted = false;
    el.addEventListener('lr-reorder', () => {
      emitted = true;
    });
    const downButton = itemsOf(el)[1].shadowRoot!.querySelector('[part="move-down-button"]') as HTMLButtonElement;
    downButton.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', ctrlKey: true, bubbles: true, composed: true }),
    );
    await el.updateComplete;
    expect(emitted).to.be.false;
  });

  it("cascades list-level disabled to every item's buttons without mutating the item's own disabled attribute", async () => {
    const el = await fixture<LyraReorderList>(threeItems);
    el.disabled = true;
    await el.updateComplete;
    for (const item of itemsOf(el)) {
      const up = item.shadowRoot!.querySelector('[part="move-up-button"]') as HTMLButtonElement;
      const down = item.shadowRoot!.querySelector('[part="move-down-button"]') as HTMLButtonElement;
      expect(up.disabled || down.disabled, 'at least one button disabled while list-disabled').to.be.true;
      expect(item.disabled, "item's own disabled attribute untouched").to.be.false;
    }
    el.disabled = false;
    await el.updateComplete;
    const middleUp = itemsOf(el)[1].shadowRoot!.querySelector('[part="move-up-button"]') as HTMLButtonElement;
    expect(middleUp.disabled).to.be.false;
  });

  it('announces the move through an internal live region', async () => {
    const el = await fixture<LyraReorderList>(threeItems);
    const region = el.shadowRoot!.querySelector('lr-live-region') as HTMLElement & {
      updateComplete: Promise<boolean>;
    };
    expect(region, 'renders a live region').to.exist;
    await region.updateComplete;

    const upButton = itemsOf(el)[1].shadowRoot!.querySelector('[part="move-up-button"]') as HTMLButtonElement;
    upButton.click();
    await el.updateComplete;

    const text = region.shadowRoot!.querySelector('[part="region"]')!.textContent ?? '';
    expect(text).to.contain('1');
    expect(text).to.contain('3');
  });

  it('honors a .strings override for the reorderItemMoved announcement', async () => {
    const el = await fixture<LyraReorderList>(threeItems);
    el.strings = { reorderItemMoved: 'Déplacé en position {index} sur {total}' };
    await el.updateComplete;
    const region = el.shadowRoot!.querySelector('lr-live-region') as HTMLElement & {
      updateComplete: Promise<boolean>;
    };
    await region.updateComplete;

    const upButton = itemsOf(el)[1].shadowRoot!.querySelector('[part="move-up-button"]') as HTMLButtonElement;
    upButton.click();
    await el.updateComplete;

    const text = region.shadowRoot!.querySelector('[part="region"]')!.textContent ?? '';
    expect(text).to.contain('Déplacé en position 1 sur 3');
  });

  it('is accessible in a populated state', async () => {
    const el = await fixture<LyraReorderList>(threeItems);
    await expect(el).to.be.accessible();
  });

  it('renders correctly under dir="rtl" (up/down reorder is not a directional concept)', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div dir="rtl">${threeItems}</div>`);
    const el = wrapper.querySelector('lr-reorder-list') as LyraReorderList;
    await expect(el).to.be.accessible();
  });
});
