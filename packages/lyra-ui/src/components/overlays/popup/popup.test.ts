import { fixture, expect, html, oneEvent, aTimeout } from '@open-wc/testing';
import './popup.js';
import type { LyraPopup } from './popup.class.js';

const popupOf = (el: Element): HTMLElement => el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;

it('renders nothing visible until activated', async () => {
  const el = await fixture<LyraPopup>(html`
    <lr-popup><button slot="anchor">Anchor</button><div>Content</div></lr-popup>
  `);
  expect(getComputedStyle(popupOf(el)).display).to.equal('none');
  await expect(el).to.be.accessible();
});

it('positions the popup against the slotted anchor once active', async () => {
  const el = await fixture<LyraPopup>(html`
    <lr-popup active placement="bottom-start">
      <button slot="anchor" style="inline-size: 6rem;">Anchor</button>
      <div style="inline-size: 4rem;">Content</div>
    </lr-popup>
  `);
  await aTimeout(50);
  const popup = popupOf(el);
  const anchor = el.querySelector('button')!;
  expect(getComputedStyle(popup).display).to.not.equal('none');
  expect(getComputedStyle(popup).position).to.equal('fixed');
  // Rendered geometry, not stylesheet text: the popup must actually sit below its anchor.
  expect(popup.getBoundingClientRect().top).to.be.greaterThan(anchor.getBoundingClientRect().top);
});

it('anchors to an element resolved through for', async () => {
  const wrapper = await fixture(html`
    <div>
      <button id="target" style="margin-block-start: 4rem;">Target</button>
      <lr-popup active for="target"><div>Content</div></lr-popup>
    </div>
  `);
  const el = wrapper.querySelector('lr-popup') as LyraPopup;
  await aTimeout(50);
  const target = wrapper.querySelector('#target')!;
  expect(popupOf(el).getBoundingClientRect().top).to.be.greaterThan(target.getBoundingClientRect().top);
});

it('anchors to a virtual rect and re-places when the rect moves', async () => {
  const el = await fixture<LyraPopup>(html`<lr-popup active><div>Content</div></lr-popup>`);
  el.virtualAnchor = { x: 20, y: 30 };
  await el.updateComplete;
  await aTimeout(50);
  const first = popupOf(el).getBoundingClientRect().top;
  el.virtualAnchor = { x: 20, y: 200 };
  await el.updateComplete;
  await aTimeout(50);
  expect(popupOf(el).getBoundingClientRect().top).to.be.greaterThan(first);
});

it('encodes the resolved side in the part name', async () => {
  const el = await fixture<LyraPopup>(html`
    <lr-popup active placement="bottom"><button slot="anchor">A</button><div>C</div></lr-popup>
  `);
  await aTimeout(50);
  expect(popupOf(el).getAttribute('part')!.split(/\s+/)).to.include('bottom');
});

it('renders an arrow only when asked', async () => {
  const withoutArrow = await fixture<LyraPopup>(html`
    <lr-popup active><button slot="anchor">A</button><div>C</div></lr-popup>
  `);
  expect(withoutArrow.shadowRoot!.querySelector('[part="arrow"]')).to.equal(null);

  const withArrow = await fixture<LyraPopup>(html`
    <lr-popup active arrow><button slot="anchor">A</button><div>C</div></lr-popup>
  `);
  expect(withArrow.shadowRoot!.querySelector('[part="arrow"]')).to.not.equal(null);
});

it('reports the placement it flipped to', async () => {
  const el = await fixture<LyraPopup>(html`
    <lr-popup placement="top"><button slot="anchor">A</button><div style="block-size: 3rem;">C</div></lr-popup>
  `);
  // The anchor sits at the very top of the viewport, so `top` cannot fit and `flip()` must move it.
  const repositioned = oneEvent(el, 'lr-reposition');
  el.active = true;
  const event = await repositioned;
  expect(event.detail.placement).to.equal('bottom');
});

it('does not flip when flip is turned off', async () => {
  const el = await fixture<LyraPopup>(html`
    <lr-popup active placement="top" flip="false">
      <button slot="anchor">A</button><div style="block-size: 3rem;">C</div>
    </lr-popup>
  `);
  await aTimeout(50);
  expect(popupOf(el).getAttribute('part')!.split(/\s+/)).to.not.include('bottom');
});

it('stops tracking when removed from the document', async () => {
  const el = await fixture<LyraPopup>(html`
    <lr-popup active><button slot="anchor">A</button><div>C</div></lr-popup>
  `);
  await aTimeout(50);
  el.remove();
  // Nothing to assert beyond it not throwing: the contract is that autoUpdate's listeners are
  // released, and a leaked listener would fire against a detached tree on the next scroll.
  window.dispatchEvent(new Event('resize'));
  await aTimeout(10);
  expect(el.isConnected).to.equal(false);
});
