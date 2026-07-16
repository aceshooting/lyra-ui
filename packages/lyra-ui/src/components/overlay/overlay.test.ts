import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import type { LyraPopover } from './popover.class.js';
import type { LyraTooltip } from './tooltip.class.js';
import './popover.js';
import './tooltip.js';
import './dropdown.js';

it('opens a popover from its slotted trigger and wires dialog semantics', async () => {
  const el = await fixture(html`
    <lyra-popover><button slot="trigger">Open</button><p>Details</p></lyra-popover>
  `);
  const trigger = el.querySelector('button') as HTMLButtonElement;
  trigger.click();
  await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
  const popup = el.shadowRoot!.querySelector('[part="popup"]') as HTMLElement;
  expect((el as HTMLElement).hasAttribute('open')).to.be.true;
  expect(trigger.getAttribute('aria-haspopup')).to.equal('dialog');
  expect(trigger.getAttribute('aria-expanded')).to.equal('true');
  expect(popup.getAttribute('role')).to.equal('dialog');
  await expect(el).to.be.accessible();
});

it('uses menu semantics for dropdowns', async () => {
  const el = await fixture(html`<lyra-dropdown><button slot="trigger">Actions</button><div>Item</div></lyra-dropdown>`);
  const trigger = el.querySelector('button') as HTMLButtonElement;
  expect(trigger.getAttribute('aria-haspopup')).to.equal('menu');
  trigger.click();
  await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
  expect(el.shadowRoot!.querySelector('[part="popup"]')?.getAttribute('role')).to.equal('menu');
});

it('does not let a closed popup/dropdown occupy a layout box in its host', async () => {
  const el = await fixture(
    html`<lyra-dropdown><button slot="trigger">Actions</button><div style="width:400px;height:400px;">Item</div></lyra-dropdown>`,
  );
  // Regression: [part='popup'] must be position:fixed even while closed -- if it were
  // position:static (the default), its content-sized box would inflate the host's own
  // inline-block box, spilling an invisible-but-hit-testable area over unrelated page content.
  const hostRect = (el as HTMLElement).getBoundingClientRect();
  expect(hostRect.width).to.be.lessThan(200);
  expect(hostRect.height).to.be.lessThan(200);
});

it('shows a tooltip after focus and describes the trigger', async () => {
  const el = await fixture(html`<lyra-tooltip delay="0">Helpful text<button slot="trigger">Help</button></lyra-tooltip>`);
  const trigger = el.querySelector('button') as HTMLButtonElement;
  trigger.focus();
  await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
  expect(el.hasAttribute('open')).to.be.true;
  expect(trigger.hasAttribute('aria-describedby')).to.be.true;
  await expect(el).to.be.accessible();
});

it('names a dropdown popup "Menu", not "Popover", since it inherits LyraPopover with popupRole=menu', async () => {
  const el = await fixture(html`<lyra-dropdown><button slot="trigger">Actions</button><div>Item</div></lyra-dropdown>`);
  const popup = el.shadowRoot!.querySelector('[part="popup"]') as HTMLElement;
  expect(popup.getAttribute('aria-label')).to.equal('Menu');
});

it('keeps a plain popover (popupRole=dialog) named "Popover"', async () => {
  const el = await fixture(html`<lyra-popover><button slot="trigger">Open</button><p>Details</p></lyra-popover>`);
  const popup = el.shadowRoot!.querySelector('[part="popup"]') as HTMLElement;
  expect(popup.getAttribute('aria-label')).to.equal('Popover');
});

it('dismisses an open tooltip on Escape while the trigger keeps focus', async () => {
  const el = (await fixture(
    html`<lyra-tooltip delay="0">Helpful text<button slot="trigger">Help</button></lyra-tooltip>`,
  )) as LyraTooltip;
  const trigger = el.querySelector('button') as HTMLButtonElement;
  trigger.focus();
  await el.updateComplete;
  expect(el.open).to.be.true;

  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await el.updateComplete;

  expect(el.open).to.be.false;
  expect(document.activeElement, 'Escape must not move focus off the trigger').to.equal(trigger);
});

it('does not re-emit lyra-show/lyra-hide when only placement or distance changes on an already-open popover', async () => {
  const el = (await fixture(
    html`<lyra-popover open><button slot="trigger">Open</button><p>Details</p></lyra-popover>`,
  )) as LyraPopover;
  await el.updateComplete;
  let showCount = 0;
  let hideCount = 0;
  el.addEventListener('lyra-show', () => showCount++);
  el.addEventListener('lyra-hide', () => hideCount++);

  el.distance = 12;
  await el.updateComplete;
  el.placement = 'top-start';
  await el.updateComplete;

  expect(showCount, 'a placement/distance-only change must not re-emit lyra-show').to.equal(0);
  expect(hideCount).to.equal(0);

  el.open = false;
  await el.updateComplete;
  expect(hideCount, 'a real close must still emit lyra-hide').to.equal(1);
});

it('still emits lyra-show/lyra-hide on a real open/close transition', async () => {
  const el = (await fixture(
    html`<lyra-popover><button slot="trigger">Open</button><p>Details</p></lyra-popover>`,
  )) as LyraPopover;
  const opened = oneEvent(el, 'lyra-show');
  el.open = true;
  await opened;

  const closed = oneEvent(el, 'lyra-hide');
  el.open = false;
  await closed;
});

it('restores the light-dismiss listener after a synchronous reconnect while open', async () => {
  const el = (await fixture(
    html`<lyra-popover open><button slot="trigger">Open</button><p>Details</p></lyra-popover>`,
  )) as LyraPopover;
  await el.updateComplete;
  expect(el.open).to.be.true;

  const otherContainer = document.createElement('div');
  document.body.appendChild(otherContainer);
  otherContainer.appendChild(el); // disconnect + reconnect synchronously, same instance
  await el.updateComplete;

  document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(el.open, 'the document pointerdown light-dismiss listener must survive a reconnect').to.be.false;

  otherContainer.remove();
});

it('unbinds hover/focus listeners and stale aria-describedby from a trigger swapped out of the slot', async () => {
  const el = (await fixture(html`<lyra-tooltip delay="0">Info<button slot="trigger">A</button></lyra-tooltip>`)) as LyraTooltip;
  const oldTrigger = el.querySelector('button') as HTMLButtonElement;
  oldTrigger.focus();
  await el.updateComplete;
  expect(el.open).to.be.true;
  expect(oldTrigger.hasAttribute('aria-describedby')).to.be.true;
  el.open = false;
  await el.updateComplete;

  const newTrigger = document.createElement('button');
  newTrigger.slot = 'trigger';
  newTrigger.textContent = 'B';
  oldTrigger.replaceWith(newTrigger);
  await el.updateComplete;

  expect(oldTrigger.hasAttribute('aria-describedby'), 'the outgoing trigger must lose its stale aria-describedby').to.be
    .false;

  oldTrigger.dispatchEvent(new FocusEvent('focus'));
  await el.updateComplete;
  expect(el.open, 'a detached, no-longer-slotted trigger must not still drive this tooltip').to.be.false;

  newTrigger.focus();
  await el.updateComplete;
  expect(el.open, 'the newly slotted trigger must drive the tooltip').to.be.true;
});

it('lets a consumer retheme the popover popup width via --lyra-overlay-max-inline-size', async () => {
  const el = (await fixture(
    html`<lyra-popover><button slot="trigger">Open</button><p>Details</p></lyra-popover>`,
  )) as LyraPopover;
  await el.updateComplete;
  const popup = el.shadowRoot!.querySelector('[part="popup"]') as HTMLElement;
  const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
  expect(getComputedStyle(popup).maxInlineSize).to.include(`${20 * remPx}px`);

  el.style.setProperty('--lyra-overlay-max-inline-size', '5rem');
  await el.updateComplete;
  expect(getComputedStyle(popup).maxInlineSize).to.include(`${5 * remPx}px`);
});

it('lets a consumer retheme the tooltip via --lyra-tooltip-max-inline-size/-background/-color', async () => {
  const el = (await fixture(html`<lyra-tooltip delay="0">Info<button slot="trigger">Help</button></lyra-tooltip>`)) as LyraTooltip;
  await el.updateComplete;
  const popup = el.shadowRoot!.querySelector('[part="popup"]') as HTMLElement;
  const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
  expect(getComputedStyle(popup).maxInlineSize).to.equal(`${20 * remPx}px`);

  el.style.setProperty('--lyra-tooltip-max-inline-size', '10rem');
  el.style.setProperty('--lyra-tooltip-background', 'rgb(1, 2, 3)');
  el.style.setProperty('--lyra-tooltip-color', 'rgb(4, 5, 6)');
  await el.updateComplete;

  expect(getComputedStyle(popup).maxInlineSize).to.equal(`${10 * remPx}px`);
  expect(getComputedStyle(popup).backgroundColor).to.equal('rgb(1, 2, 3)');
  expect(getComputedStyle(popup).color).to.equal('rgb(4, 5, 6)');
});
