import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import type { LyraPopover } from './popover.class.js';
import type { LyraTooltip } from './tooltip.class.js';
import './popover.js';
import './tooltip.js';
import './dropdown.js';

it('opens a popover from its slotted trigger and wires dialog semantics', async () => {
  const el = await fixture(html`
    <lr-popover><button slot="trigger">Open</button><p>Details</p></lr-popover>
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
  const el = await fixture(html`<lr-dropdown><button slot="trigger">Actions</button><div>Item</div></lr-dropdown>`);
  const trigger = el.querySelector('button') as HTMLButtonElement;
  expect(trigger.getAttribute('aria-haspopup')).to.equal('menu');
  trigger.click();
  await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
  expect(el.shadowRoot!.querySelector('[part="popup"]')?.getAttribute('role')).to.equal('menu');
});

// lr-dropdown is its own registered custom element (extending LyraPopover with popupRole='menu'
// set in its constructor) -- it needs its own axe assertion run against an <lr-dropdown> instance
// specifically. Every other `to.be.accessible()` call in this file targets <lr-popover> or
// <lr-tooltip>; none of those would catch a menu-semantics regression (e.g. a bad
// aria-haspopup/role combination) introduced by lr-dropdown's constructor override.
it('is accessible, both closed and with its menu open', async () => {
  const el = await fixture(html`<lr-dropdown><button slot="trigger">Actions</button><div>Item</div></lr-dropdown>`);
  await expect(el).to.be.accessible();

  const trigger = el.querySelector('button') as HTMLButtonElement;
  trigger.click();
  await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
  await expect(el).to.be.accessible();
});

it('does not let a closed popup/dropdown occupy a layout box in its host', async () => {
  const el = await fixture(
    html`<lr-dropdown><button slot="trigger">Actions</button><div style="width:400px;height:400px;">Item</div></lr-dropdown>`,
  );
  // Regression: [part='popup'] must be position:fixed even while closed -- if it were
  // position:static (the default), its content-sized box would inflate the host's own
  // inline-block box, spilling an invisible-but-hit-testable area over unrelated page content.
  const hostRect = (el as HTMLElement).getBoundingClientRect();
  expect(hostRect.width).to.be.lessThan(200);
  expect(hostRect.height).to.be.lessThan(200);
});

it('shows a tooltip after focus and describes the trigger', async () => {
  const el = await fixture(html`<lr-tooltip delay="0">Helpful text<button slot="trigger">Help</button></lr-tooltip>`);
  const trigger = el.querySelector('button') as HTMLButtonElement;
  trigger.focus();
  await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
  expect(el.hasAttribute('open')).to.be.true;
  expect(trigger.hasAttribute('aria-describedby')).to.be.true;
  await expect(el).to.be.accessible();
});

it('positions a tooltip that is open on first render against its slotted trigger', async () => {
  const el = (await fixture(html`
    <div style="margin-inline-start: 300px; margin-block-start: 100px">
      <lr-tooltip open manual>Helpful text<button slot="trigger">Help</button></lr-tooltip>
    </div>
  `)).querySelector('lr-tooltip') as LyraTooltip;
  await el.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  const trigger = el.querySelector('button') as HTMLButtonElement;
  const popup = el.shadowRoot!.querySelector('[part="popup"]') as HTMLElement;
  const triggerRect = trigger.getBoundingClientRect();
  const popupRect = popup.getBoundingClientRect();

  expect(Math.abs(popupRect.x + popupRect.width / 2 - (triggerRect.x + triggerRect.width / 2))).to.be.lessThan(2);
  expect(popupRect.bottom).to.be.at.most(triggerRect.top);
});

it('names a dropdown popup "Menu", not "Popover", since it inherits LyraPopover with popupRole=menu', async () => {
  const el = await fixture(html`<lr-dropdown><button slot="trigger">Actions</button><div>Item</div></lr-dropdown>`);
  const popup = el.shadowRoot!.querySelector('[part="popup"]') as HTMLElement;
  expect(popup.getAttribute('aria-label')).to.equal('Menu');
});

it('keeps a plain popover (popupRole=dialog) named "Popover"', async () => {
  const el = await fixture(html`<lr-popover><button slot="trigger">Open</button><p>Details</p></lr-popover>`);
  const popup = el.shadowRoot!.querySelector('[part="popup"]') as HTMLElement;
  expect(popup.getAttribute('aria-label')).to.equal('Popover');
});

it('dismisses an open tooltip on Escape while the trigger keeps focus', async () => {
  const el = (await fixture(
    html`<lr-tooltip delay="0">Helpful text<button slot="trigger">Help</button></lr-tooltip>`,
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

it('does not re-emit lr-show/lr-hide when only placement or distance changes on an already-open popover', async () => {
  const el = (await fixture(
    html`<lr-popover open><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
  )) as LyraPopover;
  await el.updateComplete;
  let showCount = 0;
  let hideCount = 0;
  el.addEventListener('lr-show', () => showCount++);
  el.addEventListener('lr-hide', () => hideCount++);

  el.distance = 12;
  await el.updateComplete;
  el.placement = 'top-start';
  await el.updateComplete;

  expect(showCount, 'a placement/distance-only change must not re-emit lr-show').to.equal(0);
  expect(hideCount).to.equal(0);

  el.open = false;
  await el.updateComplete;
  expect(hideCount, 'a real close must still emit lr-hide').to.equal(1);
});

it('still emits lr-show/lr-hide on a real open/close transition', async () => {
  const el = (await fixture(
    html`<lr-popover><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
  )) as LyraPopover;
  const opened = oneEvent(el, 'lr-show');
  el.open = true;
  await opened;

  const closed = oneEvent(el, 'lr-hide');
  el.open = false;
  await closed;
});

it('restores the light-dismiss listener after a synchronous reconnect while open', async () => {
  const el = (await fixture(
    html`<lr-popover open><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
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
  const el = (await fixture(html`<lr-tooltip delay="0">Info<button slot="trigger">A</button></lr-tooltip>`)) as LyraTooltip;
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

it('lets a consumer retheme the popover popup width via --lr-overlay-max-inline-size', async () => {
  const el = (await fixture(
    html`<lr-popover><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
  )) as LyraPopover;
  await el.updateComplete;
  const popup = el.shadowRoot!.querySelector('[part="popup"]') as HTMLElement;
  const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
  expect(getComputedStyle(popup).maxInlineSize).to.include(`${20 * remPx}px`);

  el.style.setProperty('--lr-overlay-max-inline-size', '5rem');
  await el.updateComplete;
  expect(getComputedStyle(popup).maxInlineSize).to.include(`${5 * remPx}px`);
});

it('does not poison popover/tooltip positioning with NaN when distance is invalid', async () => {
  const popover = (await fixture(
    html`<lr-popover open distance="not-a-number"><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
  )) as LyraPopover;
  await popover.updateComplete;
  // autoUpdate schedules an async computePosition; wait a frame for it to land.
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  const popoverPopup = popover.shadowRoot!.querySelector('[part="popup"]') as HTMLElement;
  expect(popoverPopup.style.left).to.not.include('NaN');
  expect(popoverPopup.style.top).to.not.include('NaN');

  const tooltip = (await fixture(
    html`<lr-tooltip delay="0" distance="not-a-number">Info<button slot="trigger">Help</button></lr-tooltip>`,
  )) as LyraTooltip;
  const trigger = tooltip.querySelector('button') as HTMLButtonElement;
  trigger.focus();
  await tooltip.updateComplete;
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  const tooltipPopup = tooltip.shadowRoot!.querySelector('[part="popup"]') as HTMLElement;
  expect(tooltipPopup.style.left).to.not.include('NaN');
  expect(tooltipPopup.style.top).to.not.include('NaN');
});

it('falls back to the default 150ms delay when delay is NaN, instead of opening instantly', async () => {
  const el = (await fixture(html`<lr-tooltip>Info<button slot="trigger">Help</button></lr-tooltip>`)) as LyraTooltip;
  el.delay = NaN;
  await el.updateComplete;
  const trigger = el.querySelector('button') as HTMLButtonElement;
  trigger.dispatchEvent(new FocusEvent('focus'));
  expect(el.open, 'must not open synchronously on an invalid delay').to.be.false;
  await new Promise((resolve) => setTimeout(resolve, 250));
  expect(el.open, 'must still open, via the normalized default delay').to.be.true;
});

it('lets a consumer retheme the tooltip via --lr-tooltip-max-inline-size/-background/-color', async () => {
  const el = (await fixture(html`<lr-tooltip delay="0">Info<button slot="trigger">Help</button></lr-tooltip>`)) as LyraTooltip;
  await el.updateComplete;
  const popup = el.shadowRoot!.querySelector('[part="popup"]') as HTMLElement;
  const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
  expect(getComputedStyle(popup).maxInlineSize).to.equal(`${20 * remPx}px`);

  el.style.setProperty('--lr-tooltip-max-inline-size', '10rem');
  el.style.setProperty('--lr-tooltip-background', 'rgb(1, 2, 3)');
  el.style.setProperty('--lr-tooltip-color', 'rgb(4, 5, 6)');
  await el.updateComplete;

  expect(getComputedStyle(popup).maxInlineSize).to.equal(`${10 * remPx}px`);
  expect(getComputedStyle(popup).backgroundColor).to.equal('rgb(1, 2, 3)');
  expect(getComputedStyle(popup).color).to.equal('rgb(4, 5, 6)');
});

// --- showAt() virtual-anchor contract -------------------------------------------------------

it('opens a popover anchored to an arbitrary rect via showAt(), with no slotted trigger', async () => {
  const el = (await fixture(html`<lr-popover><p>Node details</p></lr-popover>`)) as LyraPopover;
  el.showAt({ x: 120, y: 80 });
  await el.updateComplete;
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await new Promise((r) => requestAnimationFrame(() => r(null)));

  expect(el.open).to.be.true;
  const popup = el.shadowRoot!.querySelector('[part="popup"]') as HTMLElement;
  expect(popup.hasAttribute('data-hidden')).to.be.false;
  expect(popup.style.left).to.not.be.empty;
  expect(popup.style.top).to.not.be.empty;
  await expect(el).to.be.accessible();
});

it('re-anchors an already-open showAt() popover when called again with fresh coordinates', async () => {
  const el = (await fixture(html`<lr-popover><p>Node details</p></lr-popover>`)) as LyraPopover;
  el.showAt({ x: 10, y: 10 });
  await el.updateComplete;
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  const popup = el.shadowRoot!.querySelector('[part="popup"]') as HTMLElement;
  const firstTop = popup.style.top;

  el.showAt({ x: 10, y: 400 });
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await new Promise((r) => requestAnimationFrame(() => r(null)));

  expect(el.open, 'showAt() called again while open must stay open, not toggle').to.be.true;
  expect(popup.style.top, 'a second showAt() call must reposition against the new rect').to.not.equal(firstTop);
});

it('returns focus to options.returnFocusTo on Escape after showAt()', async () => {
  const el = (await fixture(html`<lr-popover><p>Node details</p></lr-popover>`)) as LyraPopover;
  const returnTarget = document.createElement('button');
  returnTarget.textContent = 'Back';
  document.body.appendChild(returnTarget);
  returnTarget.focus();

  el.showAt({ x: 50, y: 50 }, { returnFocusTo: returnTarget });
  await el.updateComplete;
  expect(el.open).to.be.true;

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await el.updateComplete;

  expect(el.open).to.be.false;
  expect(document.activeElement, 'Escape must return focus to returnFocusTo').to.equal(returnTarget);
  returnTarget.remove();
});

it('does not throw on Escape after showAt() without returnFocusTo, and closes without focusing anything', async () => {
  const el = (await fixture(html`<lr-popover><p>Node details</p></lr-popover>`)) as LyraPopover;
  el.showAt({ x: 50, y: 50 });
  await el.updateComplete;
  expect(el.open).to.be.true;

  expect(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  }, 'Escape with no returnFocusTo and no real trigger must not throw trying to call .focus()').to.not.throw();
  await el.updateComplete;

  expect(el.open).to.be.false;
});

it('closes a showAt()-opened popover on an outside pointerdown (light dismiss)', async () => {
  const el = (await fixture(html`<lr-popover><p>Node details</p></lr-popover>`)) as LyraPopover;
  el.showAt({ x: 50, y: 50 });
  await el.updateComplete;
  expect(el.open).to.be.true;

  document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  await el.updateComplete;

  expect(el.open, 'an outside pointerdown must still light-dismiss a showAt()-opened popover').to.be.false;
});

it('leaves normal slotted-trigger popover behavior unchanged when showAt() is never used', async () => {
  // Regression guard for the virtual-anchor widening: a popover that never calls showAt() must
  // behave byte-identical to before -- same open/close via trigger click, same Escape-returns-
  // focus-to-trigger behavior.
  const el = await fixture(html`
    <lr-popover><button slot="trigger">Open</button><p>Details</p></lr-popover>
  `);
  const trigger = el.querySelector('button') as HTMLButtonElement;
  trigger.click();
  await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
  expect((el as HTMLElement).hasAttribute('open')).to.be.true;

  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
  expect((el as HTMLElement).hasAttribute('open')).to.be.false;
  expect(document.activeElement, 'Escape must return focus to the real slotted trigger, as before').to.equal(trigger);
});

it('opens a tooltip anchored to an arbitrary rect via showAt(), with no slotted trigger', async () => {
  const el = (await fixture(html`<lr-tooltip>Node info</lr-tooltip>`)) as LyraTooltip;
  el.showAt({ x: 200, y: 150 });
  await el.updateComplete;
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await new Promise((r) => requestAnimationFrame(() => r(null)));

  expect(el.open).to.be.true;
  const popup = el.shadowRoot!.querySelector('[part="popup"]') as HTMLElement;
  expect(popup.hasAttribute('data-hidden')).to.be.false;
  expect(popup.style.left).to.not.be.empty;
  expect(popup.style.top).to.not.be.empty;
  await expect(el).to.be.accessible();
});

it('returns focus to options.returnFocusTo on Escape after tooltip showAt()', async () => {
  const el = (await fixture(html`<lr-tooltip>Node info</lr-tooltip>`)) as LyraTooltip;
  const returnTarget = document.createElement('button');
  returnTarget.textContent = 'Back';
  document.body.appendChild(returnTarget);
  returnTarget.focus();

  el.showAt({ x: 50, y: 50 }, { returnFocusTo: returnTarget });
  await el.updateComplete;
  expect(el.open).to.be.true;

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await el.updateComplete;

  expect(el.open).to.be.false;
  expect(document.activeElement, 'Escape must return focus to returnFocusTo').to.equal(returnTarget);
  returnTarget.remove();
});

it('does not throw on Escape after tooltip showAt() without returnFocusTo', async () => {
  const el = (await fixture(html`<lr-tooltip>Node info</lr-tooltip>`)) as LyraTooltip;
  el.showAt({ x: 50, y: 50 });
  await el.updateComplete;
  expect(el.open).to.be.true;

  expect(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  }, 'Escape with no returnFocusTo and no real trigger must not throw trying to call .focus()').to.not.throw();
  await el.updateComplete;

  expect(el.open).to.be.false;
});

it('routes a single Escape press to only the topmost of two nested showAt()-opened popovers', async () => {
  const outer = (await fixture(html`<lr-popover><p>Outer</p></lr-popover>`)) as LyraPopover;
  const inner = (await fixture(html`<lr-popover><p>Inner</p></lr-popover>`)) as LyraPopover;
  outer.showAt({ x: 10, y: 10 });
  await outer.updateComplete;
  inner.showAt({ x: 50, y: 50 });
  await inner.updateComplete;
  expect(outer.open).to.be.true;
  expect(inner.open).to.be.true;

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await outer.updateComplete;
  await inner.updateComplete;

  expect(inner.open, 'Escape must close the topmost (most recently activated) popover').to.be.false;
  expect(outer.open, 'a single Escape press must not also close the popover underneath').to.be.true;

  // A second Escape press then closes the next one down the stack.
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await outer.updateComplete;
  expect(outer.open, 'a second Escape press closes the next overlay down the stack').to.be.false;
});

it('routes a single Escape press to only the topmost of a showAt()-opened popover nested under a showAt()-opened tooltip', async () => {
  const tooltip = (await fixture(html`<lr-tooltip>Outer</lr-tooltip>`)) as LyraTooltip;
  const popover = (await fixture(html`<lr-popover><p>Inner</p></lr-popover>`)) as LyraPopover;
  tooltip.showAt({ x: 10, y: 10 });
  await tooltip.updateComplete;
  popover.showAt({ x: 50, y: 50 });
  await popover.updateComplete;
  expect(tooltip.open).to.be.true;
  expect(popover.open).to.be.true;

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await tooltip.updateComplete;
  await popover.updateComplete;

  expect(popover.open, 'Escape must close the topmost overlay (the popover opened second)').to.be.false;
  expect(tooltip.open, 'a single Escape press must not also close the tooltip underneath').to.be.true;
});

it('leaves normal slotted-trigger tooltip behavior unchanged when showAt() is never used', async () => {
  // Regression guard for the virtual-anchor widening, mirroring the popover one above.
  const el = (await fixture(
    html`<lr-tooltip delay="0">Helpful text<button slot="trigger">Help</button></lr-tooltip>`,
  )) as LyraTooltip;
  const trigger = el.querySelector('button') as HTMLButtonElement;
  trigger.focus();
  await el.updateComplete;
  expect(el.open).to.be.true;

  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await el.updateComplete;

  expect(el.open).to.be.false;
  expect(document.activeElement, 'Escape must not move focus off the trigger, as before').to.equal(trigger);
});

describe('lr-popover hide()', () => {
  it('closes the popover without moving focus by default', async () => {
    const el = (await fixture(
      html`<lr-popover open><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    await el.updateComplete;
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    try {
      el.hide();
      await el.updateComplete;
      expect(el.open).to.be.false;
      // Default hide() does not steal focus (matches a bare `el.open = false`).
      expect(document.activeElement).to.equal(outside);
    } finally {
      document.body.removeChild(outside);
    }
  });

  it('returns focus to the trigger when called with { focusTrigger: true }', async () => {
    const el = (await fixture(
      html`<lr-popover open><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    await el.updateComplete;
    const trigger = el.querySelector('button') as HTMLButtonElement;
    el.hide({ focusTrigger: true });
    await el.updateComplete;
    expect(el.open).to.be.false;
    expect(document.activeElement).to.equal(trigger);
  });

  it('is a no-op when already closed', async () => {
    const el = (await fixture(
      html`<lr-popover><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    await el.updateComplete;
    let hideCount = 0;
    el.addEventListener('lr-hide', () => hideCount++);
    el.hide({ focusTrigger: true });
    await el.updateComplete;
    expect(el.open).to.be.false;
    expect(hideCount).to.equal(0);
  });
});
