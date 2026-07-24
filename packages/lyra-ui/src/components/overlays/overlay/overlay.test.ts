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
  const el = await fixture(html`<lr-dropdown><button slot="trigger">Actions</button><button role="menuitem">Item</button></lr-dropdown>`);
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
  const el = await fixture(html`<lr-dropdown><button slot="trigger">Actions</button><button role="menuitem">Item</button></lr-dropdown>`);
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

it('promotes actionable tooltip content to a focus-persistent dialog surface', async () => {
  const outside = document.createElement('button');
  outside.textContent = 'Outside';
  document.body.appendChild(outside);
  try {
    const el = (await fixture(html`
      <lr-tooltip delay="0" .strings=${{ popover: 'Helpful actions' }}>
        <button slot="trigger">Help</button>
        <button>Learn more</button>
      </lr-tooltip>
    `)) as LyraTooltip;
    const trigger = el.querySelector('[slot="trigger"]') as HTMLButtonElement;
    const action = el.querySelector('button:not([slot])') as HTMLButtonElement;
    const popup = el.shadowRoot!.querySelector('[part="popup"]') as HTMLElement;
    trigger.focus();
    await el.updateComplete;
    expect(popup.getAttribute('role')).to.equal('dialog');
    expect(popup.getAttribute('aria-label')).to.equal('Helpful actions');
    action.focus();
    await el.updateComplete;
    expect(el.open, 'moving focus into actionable content must keep it available').to.be.true;
    outside.focus();
    await el.updateComplete;
    expect(el.open).to.be.false;
    await expect(el).to.be.accessible();
  } finally {
    outside.remove();
  }
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
  const el = await fixture(html`<lr-dropdown><button slot="trigger">Actions</button><button role="menuitem">Item</button></lr-dropdown>`);
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

it('preserves author trigger ARIA while a tooltip describes it and restores it on replacement', async () => {
  const el = (await fixture(html`
    <lr-tooltip delay="0">Info<button slot="trigger" aria-describedby="author-help">A</button></lr-tooltip>
  `)) as LyraTooltip;
  const oldTrigger = el.querySelector('button') as HTMLButtonElement;
  oldTrigger.focus();
  await el.updateComplete;
  expect(oldTrigger.getAttribute('aria-describedby')?.split(/\s+/)).to.include('author-help');
  expect(oldTrigger.getAttribute('aria-describedby')?.split(/\s+/).length).to.equal(2);

  oldTrigger.setAttribute('aria-describedby', 'late-help');
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  expect(oldTrigger.getAttribute('aria-describedby')?.split(/\s+/)).to.include('late-help');
  expect(oldTrigger.getAttribute('aria-describedby')?.split(/\s+/).length).to.equal(2);

  const replacement = document.createElement('button');
  replacement.slot = 'trigger';
  replacement.textContent = 'B';
  oldTrigger.replaceWith(replacement);
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  await el.updateComplete;
  expect(oldTrigger.getAttribute('aria-describedby')).to.equal('late-help');
});

it('restores author popover trigger ARIA when its trigger is replaced', async () => {
  const el = (await fixture(html`
    <lr-popover>
      <button slot="trigger" aria-haspopup="listbox" aria-controls="author-list" aria-expanded="mixed">A</button>
      <p>Content</p>
    </lr-popover>
  `)) as LyraPopover;
  const oldTrigger = el.querySelector('button') as HTMLButtonElement;
  oldTrigger.setAttribute('aria-controls', 'late-list');
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  expect(oldTrigger.getAttribute('aria-controls')?.split(/\s+/)).to.include('late-list');
  expect(oldTrigger.getAttribute('aria-controls')?.split(/\s+/).length).to.equal(2);

  const replacement = document.createElement('button');
  replacement.slot = 'trigger';
  replacement.textContent = 'B';
  oldTrigger.replaceWith(replacement);
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  await el.updateComplete;

  expect(oldTrigger.getAttribute('aria-haspopup')).to.equal('listbox');
  expect(oldTrigger.getAttribute('aria-controls')).to.equal('late-list');
  expect(oldTrigger.getAttribute('aria-expanded')).to.equal('mixed');
});

it('cancels a delayed tooltip open when manual mode, explicit close, or trigger ownership changes', async () => {
  const el = (await fixture(html`
    <lr-tooltip delay="40">Info<button slot="trigger">A</button></lr-tooltip>
  `)) as LyraTooltip;
  const trigger = el.querySelector('button') as HTMLButtonElement;

  trigger.dispatchEvent(new FocusEvent('focus'));
  el.manual = true;
  await el.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 80));
  expect(el.open).to.be.false;

  el.manual = false;
  trigger.dispatchEvent(new FocusEvent('focus'));
  el.open = false;
  await new Promise((resolve) => setTimeout(resolve, 80));
  expect(el.open).to.be.false;

  trigger.dispatchEvent(new FocusEvent('focus'));
  const replacement = document.createElement('button');
  replacement.slot = 'trigger';
  replacement.textContent = 'B';
  trigger.replaceWith(replacement);
  await new Promise((resolve) => setTimeout(resolve, 80));
  expect(el.open).to.be.false;
});

it('reschedules a pending tooltip immediately when its delay changes to zero', async () => {
  const el = (await fixture(html`
    <lr-tooltip delay="1000">Info<button slot="trigger">Help</button></lr-tooltip>
  `)) as LyraTooltip;
  const trigger = el.querySelector('button') as HTMLButtonElement;
  trigger.dispatchEvent(new FocusEvent('focus'));
  expect(el.open).to.be.false;

  el.delay = 0;
  await el.updateComplete;
  expect(el.open).to.be.true;
});

it('keeps interactive tooltip content open across pointer transitions and closes on true exit', async () => {
  const outside = document.createElement('button');
  document.body.appendChild(outside);
  try {
    const el = (await fixture(html`
      <lr-tooltip delay="0">
        <button slot="trigger">Help</button>
        <button id="action">Action</button>
      </lr-tooltip>
    `)) as LyraTooltip;
    const trigger = el.querySelector('[slot="trigger"]') as HTMLButtonElement;
    const action = el.querySelector('#action') as HTMLButtonElement;
    const popup = el.shadowRoot!.querySelector('[part="popup"]') as HTMLElement;
    await el.updateComplete;

    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    await el.updateComplete;
    expect(el.open).to.be.true;

    trigger.dispatchEvent(new MouseEvent('mouseleave', { relatedTarget: action }));
    popup.dispatchEvent(new MouseEvent('mouseenter'));
    await el.updateComplete;
    expect(el.open).to.be.true;

    popup.dispatchEvent(new MouseEvent('mouseleave', { relatedTarget: trigger }));
    await el.updateComplete;
    expect(el.open).to.be.true;

    popup.dispatchEvent(new MouseEvent('mouseleave', { relatedTarget: outside }));
    await el.updateComplete;
    expect(el.open).to.be.false;

    el.manual = true;
    popup.dispatchEvent(new MouseEvent('mouseenter'));
    expect(el.open).to.be.false;
  } finally {
    outside.remove();
  }
});

it('restores slotted-trigger and virtual-anchor tooltip ownership after reconnect', async () => {
  const slotted = (await fixture(html`
    <lr-tooltip open manual>Info<button slot="trigger">Help</button></lr-tooltip>
  `)) as LyraTooltip;
  const trigger = slotted.querySelector('button') as HTMLButtonElement;
  const slottedParent = slotted.parentElement!;
  slotted.remove();
  slottedParent.appendChild(slotted);
  await slotted.updateComplete;
  expect(trigger.getAttribute('aria-describedby')).to.not.equal(null);
  expect(slotted.open).to.be.true;

  const virtual = (await fixture(html`<lr-tooltip>Virtual info</lr-tooltip>`)) as LyraTooltip;
  virtual.showAt({ x: 20, y: 20 });
  await virtual.updateComplete;
  const virtualParent = virtual.parentElement!;
  virtual.remove();
  virtualParent.appendChild(virtual);
  await virtual.updateComplete;
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
  );
  await virtual.updateComplete;
  expect(virtual.open).to.be.false;
});

it('activates Escape ownership when showAt converts an already-open trigger overlay to a virtual anchor', async () => {
  const popover = (await fixture(
    html`<lr-popover open><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
  )) as LyraPopover;
  await popover.updateComplete;
  popover.showAt({ x: 30, y: 30 });
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await popover.updateComplete;
  expect(popover.open).to.be.false;

  const tooltip = (await fixture(
    html`<lr-tooltip open manual><button slot="trigger">Help</button>Info</lr-tooltip>`,
  )) as LyraTooltip;
  await tooltip.updateComplete;
  tooltip.showAt({ x: 30, y: 30 });
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await tooltip.updateComplete;
  expect(tooltip.open).to.be.false;
});

it('contains long tooltip content within a 320px allocation', async () => {
  const wrapper = (await fixture(html`
    <div style="inline-size:320px">
      <lr-tooltip open manual>${'unbroken'.repeat(150)}<button slot="trigger">Help</button></lr-tooltip>
    </div>
  `)) as HTMLElement;
  const el = wrapper.querySelector('lr-tooltip') as LyraTooltip;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const popup = el.shadowRoot!.querySelector('[part="popup"]') as HTMLElement;
  expect(popup.getBoundingClientRect().width).to.be.at.most(320);
  expect(popup.scrollWidth).to.be.at.most(popup.clientWidth);
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
  const internals = el as unknown as { cleanup?: () => void };
  const firstCleanup = internals.cleanup!;
  let cleanupCount = 0;
  internals.cleanup = () => {
    cleanupCount++;
    firstCleanup();
  };

  el.showAt({ x: 10, y: 400 });
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await new Promise((r) => requestAnimationFrame(() => r(null)));

  expect(el.open, 'showAt() called again while open must stay open, not toggle').to.be.true;
  expect(cleanupCount, 're-anchoring must stop the previous auto-update subscription').to.equal(1);
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

it('keeps slotted-trigger Escape focus return when showAt() is never used', async () => {
  // Regression guard for the virtual-anchor path: a popover that never calls showAt() restores
  // focus to its real trigger through the same manager-backed close policy.
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

it('keeps stack ownership and top-overlay focus when an underlying popover is re-anchored with showAt()', async () => {
  const wrapper = await fixture(html`
    <div>
      <lr-popover id="underlying"><button id="underlying-action">Underlying action</button></lr-popover>
      <lr-popover id="top"><button id="top-action">Top action</button></lr-popover>
    </div>
  `);
  const underlying = wrapper.querySelector('#underlying') as LyraPopover;
  const top = wrapper.querySelector('#top') as LyraPopover;
  underlying.showAt({ x: 10, y: 10 });
  await underlying.updateComplete;
  top.showAt({ x: 50, y: 50 });
  await top.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const topAction = top.querySelector('#top-action') as HTMLButtonElement;
  topAction.focus();
  expect(topAction.matches(':focus'), 'test precondition: focus starts within the top overlay').to.be.true;

  underlying.showAt({ x: 100, y: 100 });
  await underlying.updateComplete;

  expect(
    (document.activeElement as HTMLElement | null)?.id,
    're-anchoring an underlying popover must not disturb focus in the top overlay',
  ).to.equal(topAction.id);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await underlying.updateComplete;
  await top.updateComplete;
  expect(top.open, 're-anchoring must not promote the underlying popover to the top of the overlay stack').to.be.false;
  expect(underlying.open).to.be.true;
});

it('keeps stack ownership when an underlying open popover receives a replacement trigger', async () => {
  const wrapper = await fixture(html`
    <div>
      <lr-popover id="underlying">
        <button slot="trigger">Underlying trigger</button>
        <button id="underlying-action">Underlying action</button>
      </lr-popover>
      <lr-popover id="top">
        <button slot="trigger">Top trigger</button>
        <button id="top-action">Top action</button>
      </lr-popover>
    </div>
  `);
  const underlying = wrapper.querySelector('#underlying') as LyraPopover;
  const top = wrapper.querySelector('#top') as LyraPopover;
  (underlying.querySelector('[slot="trigger"]') as HTMLButtonElement).click();
  await underlying.updateComplete;
  (top.querySelector('[slot="trigger"]') as HTMLButtonElement).click();
  await top.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const topAction = top.querySelector('#top-action') as HTMLButtonElement;
  topAction.focus();
  expect(topAction.matches(':focus'), 'test precondition: focus starts within the top overlay').to.be.true;

  const replacement = document.createElement('button');
  replacement.slot = 'trigger';
  replacement.textContent = 'Replacement underlying trigger';
  underlying.querySelector('[slot="trigger"]')!.replaceWith(replacement);
  await new Promise<void>((resolve) => setTimeout(resolve));
  await underlying.updateComplete;

  expect(
    (document.activeElement as HTMLElement | null)?.id,
    'replacing an underlying trigger must preserve focus in the top overlay',
  ).to.equal(topAction.id);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await underlying.updateComplete;
  await top.updateComplete;
  expect(top.open, 'a trigger refresh must not promote the underlying popover to the top of the stack').to.be.false;
  expect(underlying.open).to.be.true;
});

it('does not transiently focus an underlying overlay when the top popover receives a replacement trigger', async () => {
  const wrapper = await fixture(html`
    <div>
      <lr-popover id="underlying">
        <button slot="trigger">Underlying trigger</button>
        <button id="underlying-action">Underlying action</button>
      </lr-popover>
      <lr-popover id="top">
        <button slot="trigger">Top trigger</button>
        <button id="top-action">Top action</button>
      </lr-popover>
    </div>
  `);
  const underlying = wrapper.querySelector('#underlying') as LyraPopover;
  const top = wrapper.querySelector('#top') as LyraPopover;
  (underlying.querySelector('[slot="trigger"]') as HTMLButtonElement).click();
  await underlying.updateComplete;
  (top.querySelector('[slot="trigger"]') as HTMLButtonElement).click();
  await top.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const underlyingAction = underlying.querySelector('#underlying-action') as HTMLButtonElement;
  const topAction = top.querySelector('#top-action') as HTMLButtonElement;
  topAction.focus();
  expect(topAction.matches(':focus'), 'test precondition: focus starts within the top overlay').to.be.true;
  let underlyingFocusCount = 0;
  underlyingAction.addEventListener('focus', () => underlyingFocusCount++);

  const replacement = document.createElement('button');
  replacement.slot = 'trigger';
  replacement.textContent = 'Replacement top trigger';
  top.querySelector('[slot="trigger"]')!.replaceWith(replacement);
  await new Promise<void>((resolve) => setTimeout(resolve));
  await top.updateComplete;

  expect(underlyingFocusCount, 'refreshing the top popover target must not focus the overlay underneath').to.equal(0);
  expect((document.activeElement as HTMLElement | null)?.id, 'the existing focus within the top popover must be preserved')
    .to.equal(topAction.id);
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

describe('lr-popover focus return', () => {
  async function setup(): Promise<{
    el: LyraPopover;
    trigger: HTMLButtonElement;
    action: HTMLButtonElement;
    outside: HTMLButtonElement;
  }> {
    const wrapper = await fixture(html`
      <div>
        <button id="outside">Outside</button>
        <lr-popover>
          <button slot="trigger">Open</button>
          <button id="action">Action</button>
        </lr-popover>
      </div>
    `);
    const el = wrapper.querySelector('lr-popover') as LyraPopover;
    const trigger = el.querySelector('[slot="trigger"]') as HTMLButtonElement;
    const action = el.querySelector('#action') as HTMLButtonElement;
    const outside = wrapper.querySelector('#outside') as HTMLButtonElement;
    trigger.click();
    await el.updateComplete;
    expect(el.open).to.be.true;
    return { el, trigger, action, outside };
  }

  it('returns focus to the trigger after light dismiss', async () => {
    const { el, trigger, action, outside } = await setup();
    action.focus();

    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    await el.updateComplete;

    expect(el.open).to.be.false;
    expect(document.activeElement).to.equal(trigger);
  });

  it('returns focus to the trigger after a programmatic open=false assignment', async () => {
    const { el, trigger, action } = await setup();
    action.focus();

    el.open = false;
    await el.updateComplete;

    expect(el.open).to.be.false;
    expect(document.activeElement).to.equal(trigger);
  });

  it('returns focus to the trigger after Escape on the trigger', async () => {
    const { el, trigger } = await setup();
    trigger.focus();

    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await el.updateComplete;

    expect(el.open).to.be.false;
    expect(document.activeElement).to.equal(trigger);
  });

  it('returns focus to the trigger after Escape in the popup', async () => {
    const { el, trigger, action } = await setup();
    action.focus();

    action.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await el.updateComplete;

    expect(el.open).to.be.false;
    expect(document.activeElement).to.equal(trigger);
  });
});

describe('lr-popover hide()', () => {
  it('returns focus to the trigger by default', async () => {
    const el = (await fixture(
      html`<lr-popover open><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    await el.updateComplete;
    const trigger = el.querySelector('button') as HTMLButtonElement;
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    try {
      el.hide();
      await el.updateComplete;
      expect(el.open).to.be.false;
      expect(document.activeElement).to.equal(trigger);
    } finally {
      document.body.removeChild(outside);
    }
  });

  it('preserves focus when called with { focusTrigger: false }', async () => {
    const el = (await fixture(
      html`<lr-popover open><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    await el.updateComplete;
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    try {
      el.hide({ focusTrigger: false });
      await el.updateComplete;
      expect(el.open).to.be.false;
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
