import { expect, fixture, oneEvent, waitUntil } from '@open-wc/testing';
import { hoverUntilMatched, resetMouse, settlePointer } from '../../../../test/wtr-mouse.js';
import { focusAfterPointer, focusByKeyboard } from '../../../../test/wtr-focus.js';
import '../../lr-popover.js';
import type { LyraPopover } from '../../lr-popover.js';

/** `mouseenter`/`mouseleave` do not bubble, so they are dispatched on the node the popover binds. */
const enter = (node: Element, relatedTarget: Element | null = null): void => {
  node.dispatchEvent(new MouseEvent('mouseenter', { relatedTarget, composed: true }));
};
const leave = (node: Element, relatedTarget: Element | null = null): void => {
  node.dispatchEvent(new MouseEvent('mouseleave', { relatedTarget, composed: true }));
};

const DISCLOSURE_ARIA = ['aria-haspopup', 'aria-expanded', 'aria-controls'];
const ariaOf = (node: Element): string[] => DISCLOSURE_ARIA.filter((name) => node.hasAttribute(name));

describe('lr-popover trigger="hover-card"', () => {
  afterEach(async () => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    await resetMouse();
  });

  it('opens on hover, never pins on click, lets the click through and adds no disclosure ARIA', async () => {
    const el = await fixture<LyraPopover>(`<lr-popover trigger="hover-card" style="--lr-duration-base: 0ms">
      <a slot="trigger" href="#row">Row</a>
      <button>Edit</button>
    </lr-popover>`);
    const trigger = el.querySelector('a')!;
    let clicks = 0;
    trigger.addEventListener('click', (event) => { clicks++; event.preventDefault(); });
    expect(el.trigger).to.equal('hover-card');
    expect(ariaOf(trigger)).to.deep.equal([]);
    enter(trigger);
    await waitUntil(() => el.open, 'hovering opens the card');
    expect(ariaOf(trigger)).to.deep.equal([]);
    await expect(el).to.be.accessible();
    const hidden = oneEvent(el, 'lr-after-hide');
    trigger.click();
    await hidden;
    expect(clicks).to.equal(1);
    expect(el.open).to.equal(false);
    // A closed card is not toggled open by a click either.
    trigger.click();
    await settlePointer();
    expect(el.open).to.equal(false);
    enter(trigger);
    await waitUntil(() => el.open, 'a later hover reopens it');
    leave(trigger);
    await waitUntil(() => !el.open, 'leaving the owner closes an unpinned card');
  });

  it('reveals on keyboard focus only and drops ARIA when an existing trigger switches mode', async () => {
    const el = await fixture<LyraPopover>(`<lr-popover trigger="click" style="--lr-duration-base: 0ms">
      <button slot="trigger">Owner</button><span>Preview</span>
    </lr-popover>`);
    const trigger = el.querySelector('button')!;
    expect(trigger.getAttribute('aria-expanded')).to.equal('false');
    el.trigger = 'focus hover-card';
    await el.updateComplete;
    expect(el.trigger).to.equal('focus hover-card');
    expect(ariaOf(trigger)).to.deep.equal([]);
    await focusAfterPointer(trigger);
    await settlePointer();
    expect(el.open).to.equal(false);
    trigger.blur();
    await focusByKeyboard(trigger);
    await waitUntil(() => el.open, 'keyboard focus reveals the card');
    expect(document.activeElement === trigger).to.equal(true);
    el.trigger = 'manual hover-card';
    await el.updateComplete;
    expect(trigger.getAttribute('aria-expanded')).to.equal('true');
    await el.hide();
  });

  it('points one card at id-less list rows through forElement and follows a real pointer between them', async () => {
    const wrapper = await fixture<HTMLElement>(`<div>
      <ul><li tabindex="0">Alpha</li><li tabindex="0">Beta</li></ul>
      <lr-popover trigger="hover-card" show-delay="20" placement="bottom" style="--lr-duration-base: 0ms"><span>Card</span></lr-popover>
    </div>`);
    const el = wrapper.querySelector('lr-popover') as LyraPopover;
    const [alpha, beta] = Array.from(wrapper.querySelectorAll('li'));
    for (const row of [alpha!, beta!]) {
      row.addEventListener('pointerenter', () => { el.forElement = row; });
    }
    await hoverUntilMatched(alpha!, 'the pointer rests on the first row');
    await waitUntil(() => el.open, 'resting on a row opens its card');
    expect(ariaOf(alpha!)).to.deep.equal([]);
    const popup = el.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
    await hoverUntilMatched(beta!, 'the pointer moves to the second row');
    await waitUntil(
      () => Math.abs(popup.getBoundingClientRect().top - beta!.getBoundingClientRect().bottom - 8) < 2,
      'the open card repositions below the new owner',
    );
    expect(el.open).to.equal(true, 'the card moved to the new owner without closing');
    beta!.remove();
    await waitUntil(() => !el.open, 'removing the referenced owner closes the card');
  });

  it('starts the show delay when re-pointed at an element already under the pointer', async () => {
    const wrapper = await fixture<HTMLElement>(`<div>
      <p id="named">Named</p><p>Unnamed</p>
      <lr-popover trigger="hover-card" for="named" style="--lr-duration-base: 0ms"><span>Card</span></lr-popover>
    </div>`);
    const el = wrapper.querySelector('lr-popover') as LyraPopover;
    const unnamed = wrapper.querySelectorAll('p')[1]!;
    await hoverUntilMatched(unnamed, 'the pointer rests on an element the card does not own');
    expect(el.open).to.equal(false);
    el.forElement = unnamed;
    await waitUntil(() => el.open, 're-pointing at the hovered element opens the card');
    await el.hide();
    el.forElement = null;
    await el.updateComplete;
    enter(wrapper.querySelector('#named')!);
    await waitUntil(() => el.open, 'clearing forElement falls back to for');
    await el.hide();
  });
});
