import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { settlePointer } from '../../../../test/wtr-mouse.js';
import './popover.js';
import type { LyraPopover } from './popover.js';

async function setup(topLayer = false) {
  const wrapper = await fixture<HTMLDivElement>(html`<div>
    <button id="outside">Outside</button><button id="next">Next</button>
    <button id="anchor" style="position:fixed;left:180px;top:120px">Anchor</button>
    <lr-popover trigger="hover" placement="bottom-start" .topLayer=${topLayer} style="--lr-duration-base:0ms">
      <button slot="trigger">Trigger</button><button autofocus="caller-value">Inside</button>
    </lr-popover>
  </div>`);
  const el = wrapper.querySelector<LyraPopover>('lr-popover')!;
  const outside = wrapper.querySelector<HTMLButtonElement>('#outside')!;
  const next = wrapper.querySelector<HTMLButtonElement>('#next')!;
  const anchor = wrapper.querySelector<HTMLButtonElement>('#anchor')!;
  await el.updateComplete; await focusByKeyboard(outside);
  return { wrapper, el, outside, next, anchor };
}
function enter(el: LyraPopover): void {
  el.querySelector('[slot="trigger"]')!.dispatchEvent(new MouseEvent('mouseenter', { composed: true }));
}

it('keeps a newer explicit focus target through transient placement', async () => {
  const { el, next } = await setup();
  const shown = oneEvent(el, 'lr-after-show');
  enter(el); await el.updateComplete;
  // Intentional caller focus() is the behavior under test; keyboard modality was established above.
  next.focus();
  expect(document.activeElement === next).to.equal(true);
  await shown;
  expect(document.activeElement === next).to.equal(true);
  const inside = el.querySelector<HTMLButtonElement>('button[autofocus]')!;
  inside.focus();
  expect(document.activeElement === inside).to.equal(true);
  expect(inside.getAttribute('autofocus')).to.equal('caller-value');
});

it('retires a disconnected transient reveal without an after-show event', async () => {
  const { el, outside } = await setup();
  let shown = 0; el.addEventListener('lr-after-show', () => { shown++; });
  enter(el); await el.updateComplete; el.remove();
  await settlePointer();
  expect(shown).to.equal(0);
  expect(document.activeElement === outside).to.equal(true);
  expect(el.querySelector('button[autofocus]')!.getAttribute('autofocus')).to.equal('caller-value');
});

it('keeps a never-revealed popup hidden and inert throughout a requested exit animation', async () => {
  const { el, outside } = await setup();
  el.style.setProperty('--hide-duration', '800ms');
  let shown = 0; el.addEventListener('lr-after-show', () => { shown++; });
  enter(el); await el.updateComplete;
  const popup = el.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
  expect(popup.inert).to.equal(true);
  const hiding = el.hide({ focusTrigger: false });
  await el.updateComplete;
  expect(popup.hidden).to.equal(true);
  expect(popup.inert).to.equal(true);
  await settlePointer();
  expect(document.activeElement === outside).to.equal(true);
  expect(popup.hidden).to.equal(true);
  expect(popup.inert).to.equal(true);
  await hiding;
  expect(shown).to.equal(0);
  expect(popup.hidden).to.equal(true);
  expect(popup.inert).to.equal(true);
  expect(el.querySelector('button[autofocus]')!.getAttribute('autofocus')).to.equal('caller-value');
});

it('follows a replacement anchor while a transient reveal is waiting', async () => {
  const { el, outside, anchor } = await setup();
  const shown = oneEvent(el, 'lr-after-show');
  enter(el); await el.updateComplete;
  el.anchor = anchor; await el.updateComplete; await shown;
  const popup = el.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
  expect(popup.getBoundingClientRect().left).to.be.closeTo(anchor.getBoundingClientRect().left, 1);
  expect(popup.inert).to.equal(false);
  expect(document.activeElement === outside).to.equal(true);
});

for (const topLayer of [false, true]) {
  it(`keeps nested autofocus inert until transient reveal with topLayer ${String(topLayer)}`, async () => {
    const { el, outside } = await setup(topLayer);
    el.querySelector('button[autofocus]')!.remove();
    const nested = document.createElement('div');
    const root = nested.attachShadow({ mode: 'open' });
    root.innerHTML = '<button autofocus="nested-value" style="visibility:visible">Nested</button>';
    el.append(nested);
    const inside = root.querySelector<HTMLButtonElement>('button')!;
    const shown = oneEvent(el, 'lr-after-show');
    enter(el); await el.updateComplete;
    const popup = el.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
    expect(popup.inert).to.equal(true);
    await shown;
    expect(document.activeElement === outside).to.equal(true);
    expect(popup.inert).to.equal(false);
    expect(popup.matches(':popover-open')).to.equal(topLayer);
    expect(inside.getAttribute('autofocus')).to.equal('nested-value');
    inside.focus();
    expect(root.activeElement === inside).to.equal(true);
  });
}
