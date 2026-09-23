import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './popup.js';
import type { LyraPopup } from './popup.class.js';

const popupOf = (el: Element): HTMLElement => el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;

/** Mirrors lr-select/lr-combobox: a settled-inactive `<lr-popup>`
 *  must leave the scrollable layout entirely, not merely fade to invisible, or a
 *  `position:relative; overflow:auto` ancestor keeps unexplained scroll room. The popup's own live
 *  auto-sizing (`--lr-positioner-available-inline-size`) already keeps it within the container's
 *  bounds while active, so -- mirroring `select-closed-layout.test.ts`'s own "closed after resize"
 *  phase -- the regression only surfaces once the popup goes inactive (its geometry goes stale)
 *  and the container is then resized smaller: an unbreakable (`white-space: nowrap`) label can no
 *  longer shrink to fit, so a settled-inactive popup still in layout overflows the new bounds
 *  while a properly `display:none`d one does not. `strategy="absolute"` is this component's own
 *  unconditional default. */
it('keeps a settled-inactive lr-popup out of the scrollable layout after a resize', async () => {
  const container = await fixture<HTMLDivElement>(html`
    <div style="position: relative; width: 320px; height: 200px; overflow: auto; display: flex; justify-content: end; align-items: start">
      <lr-popup style="--show-duration: 0s; --hide-duration: 0s">
        <button slot="anchor">Anchor</button>
        <div style="white-space: nowrap">An unbreakable popup body label wide enough to overflow a shrunken container</div>
      </lr-popup>
    </div>
  `);
  const popup = container.querySelector<LyraPopup>('lr-popup')!;
  await popup.updateComplete;
  popup.active = true;
  await waitUntil(() => popupOf(popup).hasAttribute('data-active'), 'the popup finishes positioning');
  expect(getComputedStyle(popupOf(popup)).visibility).to.equal('visible');
  popup.active = false;
  await waitUntil(() => popupOf(popup).hasAttribute('hidden'), 'the settled-inactive popup leaves layout');
  container.style.width = '240px';
  expect(container.scrollWidth).to.equal(container.clientWidth);
});

it('preserves the popup opacity transition while removing the settled inactive layout', async () => {
  const control = await fixture<LyraPopup>(html`
    <lr-popup style="--show-duration: 1s; --hide-duration: 1s">
      <button slot="anchor">Anchor</button>
      <div>Content</div>
    </lr-popup>
  `);
  const popup = popupOf(control);
  for (let cycle = 0; cycle < 2; cycle++) {
    control.active = true;
    await waitUntil(() => popup.hasAttribute('data-active'), `activation completes on cycle ${cycle}`);
    expect(getComputedStyle(popup).visibility).to.equal('visible');
    expect(popup.hasAttribute('hidden')).to.be.false;
    control.active = false;
    // The exit fade is a plain CSS transition (no host lifecycle event), so it must still be
    // mid-flight immediately after `active` flips -- proving `hidden` was not applied instantly.
    expect(popup.hasAttribute('hidden')).to.be.false;
    expect(popup.getBoundingClientRect().width).to.be.greaterThan(0);
    await waitUntil(() => popup.hasAttribute('hidden'), 'the settled-inactive popup leaves layout');
  }
});

it('reasserts an unhidden lr-popup after a reconnect while active', async () => {
  const control = await fixture<LyraPopup>(
    html`<lr-popup active><button slot="anchor">Anchor</button><div>Content</div></lr-popup>`,
  );
  const popup = popupOf(control);
  await waitUntil(() => popup.hasAttribute('data-active'), 'the popup finishes positioning');
  expect(popup.hasAttribute('hidden')).to.be.false;
  const parent = control.parentNode!;
  parent.removeChild(control);
  parent.appendChild(control);
  expect(popup.hasAttribute('hidden')).to.be.false;
  control.active = false;
  await waitUntil(() => popup.hasAttribute('hidden'), 'the settled-inactive popup leaves layout');
});
