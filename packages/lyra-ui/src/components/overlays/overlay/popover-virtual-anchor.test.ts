import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraPopover, LyraPopoverVirtualElement } from './popover.class.js';
import '../../lr-popover.js';

const popupRect = (el: LyraPopover): DOMRect =>
  el.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!.getBoundingClientRect();

const rectAnchor = (x: number, y: number): LyraPopoverVirtualElement => ({
  getBoundingClientRect: () => new DOMRect(x, y, 10, 10),
});

async function openAt(el: LyraPopover, anchor: LyraPopoverVirtualElement | null): Promise<void> {
  el.virtualElement = anchor;
  await el.updateComplete;
  if (!el.open) await el.show();
  await waitUntil(() => popupRect(el).width > 0 && !el.shadowRoot!.querySelector('[data-hidden]'));
}

describe('lr-popover virtualElement', () => {
  it('positions against a virtual element and follows a replacement rectangle', async () => {
    const el = await fixture<LyraPopover>(html`<lr-popover placement="bottom" style="--show-duration: 0ms; --hide-duration: 0ms"><p>Details</p></lr-popover>`);
    await openAt(el, rectAnchor(200, 100));
    await waitUntil(() => Math.abs(popupRect(el).top - 118) < 3, 'popup below the virtual rect');
    expect(el.open).to.equal(true);
    const firstCentre = popupRect(el).left + popupRect(el).width / 2;
    el.virtualElement = rectAnchor(300, 100);
    await waitUntil(() => Math.abs(popupRect(el).left + popupRect(el).width / 2 - firstCentre - 100) < 3, 'popup follows a replaced rect');
  });

  it('wins over an element anchor, falls back to it when cleared, and stays open', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div>
      <button id="target" style="position: fixed; inset-inline-start: 400px; inset-block-start: 300px">Target</button>
      <lr-popover placement="bottom" style="--show-duration: 0ms; --hide-duration: 0ms"><p>Details</p></lr-popover>
    </div>`);
    const el = wrapper.querySelector<LyraPopover>('lr-popover')!;
    const button = wrapper.querySelector<HTMLButtonElement>('#target')!;
    await openAt(el, rectAnchor(50, 50));
    await waitUntil(() => popupRect(el).top < 100);
    el.anchor = button;
    await el.updateComplete;
    expect(popupRect(el).top).to.be.below(100);
    el.virtualElement = null;
    await el.updateComplete;
    await waitUntil(() => popupRect(el).top >= button.getBoundingClientRect().bottom - 1, 'moved under the element');
    expect(button.hasAttribute('aria-expanded')).to.equal(false);
    expect(el.anchor === button).to.equal(true);
    el.virtualElement = rectAnchor(50, 50);
    await el.updateComplete;
    await waitUntil(() => popupRect(el).top < 100, 'back on the virtual rect');
    expect(el.open).to.equal(true);
  });

  it('closes when a sole virtual element is cleared, and ignores a value without getBoundingClientRect', async () => {
    const el = await fixture<LyraPopover>(html`<lr-popover style="--show-duration: 0ms; --hide-duration: 0ms"><p>Details</p></lr-popover>`);
    await openAt(el, rectAnchor(80, 80));
    expect(el.anchor === null).to.equal(true);
    el.virtualElement = null;
    await waitUntil(() => !el.open, 'cleared sole anchor closes');
    el.virtualElement = { x: 1 } as unknown as LyraPopoverVirtualElement;
    el.open = true;
    await el.updateComplete;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part~="popup"]')!.hasAttribute('data-hidden')).to.equal(true);
  });

  it('lets showAt() win over a virtual element while active', async () => {
    const el = await fixture<LyraPopover>(html`<lr-popover placement="bottom" style="--show-duration: 0ms; --hide-duration: 0ms"><p>Details</p></lr-popover>`);
    await openAt(el, rectAnchor(40, 40));
    el.showAt({ x: 300, y: 300 });
    await waitUntil(() => popupRect(el).top > 290, 'showAt rect wins');
  });
});
