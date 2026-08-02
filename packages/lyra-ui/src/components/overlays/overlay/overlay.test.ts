import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import type { LyraPopover } from './popover.class.js';
import type { LyraTooltip } from './tooltip.class.js';
import type { LyraDropdown } from './dropdown.class.js';
import { setAnimation } from '../../../utilities/animation-registry.js';
import './popover.js';
import './tooltip.js';
import './dropdown.js';
import '../../forms/button/button.js';
import '../../forms/icon-button/icon-button.js';

it('opens a popover from its slotted trigger and wires dialog semantics', async () => {
  const el = await fixture(html`
    <lr-popover><button slot="trigger">Open</button><p>Details</p></lr-popover>
  `);
  const trigger = el.querySelector('button') as HTMLButtonElement;
  trigger.click();
  await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
  const popup = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
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
  expect(el.shadowRoot!.querySelector('[part~="popup"]')?.getAttribute('role')).to.equal('menu');
});

it('targets the public popover host from a native trigger aria-controls relationship', async () => {
  const el = await fixture(html`
    <lr-popover><button slot="trigger">Open</button><p>Details</p></lr-popover>
  `);
  const trigger = el.querySelector('button') as HTMLButtonElement;
  const controls = trigger.getAttribute('aria-controls');

  expect(el.id).to.not.equal('');
  expect(controls).to.equal(el.id);
  expect((el.getRootNode() as Document | ShadowRoot).getElementById(controls!)).to.equal(el);
});

it("resolves a popover host onto lr-button's focused internal control", async () => {
  const el = await fixture(html`
    <lr-popover><lr-button slot="trigger">Open</lr-button><p>Details</p></lr-popover>
  `);
  const trigger = el.querySelector('lr-button')!;
  await trigger.updateComplete;
  const focusedControl = trigger.shadowRoot!.querySelector('[part~="base"]') as HTMLButtonElement & {
    ariaControlsElements?: Element[];
  };

  expect(trigger.getAttribute('aria-controls')).to.equal(el.id);
  if ('ariaControlsElements' in focusedControl) {
    expect(focusedControl.ariaControlsElements?.length).to.equal(1);
    expect(focusedControl.ariaControlsElements?.[0]).to.equal(el);
    expect(focusedControl.getAttribute('aria-controls')).to.equal('');
  } else {
    expect(focusedControl.getAttribute('aria-controls')).to.equal(el.id);
  }
});

it("resolves a dropdown host onto lr-icon-button's focused internal control", async () => {
  const el = await fixture(html`
    <lr-dropdown>
      <lr-icon-button slot="trigger" icon="more" aria-label="Actions"></lr-icon-button>
      <button role="menuitem">Item</button>
    </lr-dropdown>
  `);
  const trigger = el.querySelector('lr-icon-button')!;
  await trigger.updateComplete;
  const focusedControl = trigger.shadowRoot!.querySelector('button') as HTMLButtonElement & {
    ariaControlsElements?: Element[];
  };

  expect(trigger.getAttribute('aria-controls')).to.equal(el.id);
  if ('ariaControlsElements' in focusedControl) {
    expect(focusedControl.ariaControlsElements?.length).to.equal(1);
    expect(focusedControl.ariaControlsElements?.[0]).to.equal(el);
    expect(focusedControl.getAttribute('aria-controls')).to.equal('');
  } else {
    expect(focusedControl.getAttribute('aria-controls')).to.equal(el.id);
  }
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
  // Regression: [part~='popup'] must be position:fixed even while closed -- if it were
  // position:static (the default), its content-sized box would inflate the host's own
  // inline-block box, spilling an invisible-but-hit-testable area over unrelated page content.
  const hostRect = (el as HTMLElement).getBoundingClientRect();
  expect(hostRect.width).to.be.lessThan(200);
  expect(hostRect.height).to.be.lessThan(200);
});

it('shows a tooltip after focus and describes the trigger', async () => {
  const el = await fixture(html`<lr-tooltip show-delay="0">Helpful text<button slot="trigger">Help</button></lr-tooltip>`);
  const trigger = el.querySelector('button') as HTMLButtonElement & {
    ariaDescribedByElements?: Element[];
  };
  trigger.focus();
  await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
  expect(el.hasAttribute('open')).to.be.true;
  const description = el.querySelector('[data-lyra-tooltip-description]')!;
  expect(description.textContent).to.equal('Helpful text');
  if ('ariaDescribedByElements' in trigger) {
    expect(trigger.ariaDescribedByElements?.length).to.equal(1);
    expect(trigger.ariaDescribedByElements?.[0]).to.equal(description);
    expect(trigger.getAttribute('aria-describedby')).to.equal(description.id);
  } else {
    expect(trigger.hasAttribute('aria-describedby')).to.be.true;
  }
  await expect(el).to.be.accessible();
});

it("resolves a tooltip popup onto lr-button's focused internal control", async () => {
  const el = await fixture(html`
    <lr-tooltip show-delay="0">
      Helpful text
      <lr-button slot="trigger">Help</lr-button>
    </lr-tooltip>
  `);
  const trigger = el.querySelector('lr-button')!;
  trigger.focus();
  await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
  await trigger.updateComplete;
  const focusedControl = trigger.shadowRoot!.querySelector('[part~="base"]') as HTMLButtonElement & {
    ariaDescribedByElements?: Element[];
  };
  const description = el.querySelector('[data-lyra-tooltip-description]')!;

  if ('ariaDescribedByElements' in focusedControl) {
    expect(focusedControl.ariaDescribedByElements?.length).to.equal(1);
    expect(focusedControl.ariaDescribedByElements?.[0]).to.equal(description);
    expect(focusedControl.getAttribute('aria-describedby')).to.equal('');
  } else {
    expect(focusedControl.hasAttribute('aria-describedby')).to.be.true;
  }
});

it("resolves a tooltip popup onto lr-icon-button's focused internal control", async () => {
  const el = await fixture(html`
    <lr-tooltip show-delay="0">
      Helpful text
      <lr-icon-button slot="trigger" icon="help" aria-label="Help"></lr-icon-button>
    </lr-tooltip>
  `);
  const trigger = el.querySelector('lr-icon-button')!;
  trigger.focus();
  await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
  await trigger.updateComplete;
  const focusedControl = trigger.shadowRoot!.querySelector('button') as HTMLButtonElement & {
    ariaDescribedByElements?: Element[];
  };
  const description = el.querySelector('[data-lyra-tooltip-description]')!;

  if ('ariaDescribedByElements' in focusedControl) {
    expect(focusedControl.ariaDescribedByElements?.length).to.equal(1);
    expect(focusedControl.ariaDescribedByElements?.[0]).to.equal(description);
    expect(focusedControl.getAttribute('aria-describedby')).to.equal('');
  } else {
    expect(focusedControl.hasAttribute('aria-describedby')).to.be.true;
  }
});

it('keeps the tooltip description proxy synchronized without including trigger text', async () => {
  const el = await fixture(html`
    <lr-tooltip show-delay="0">
      <span>Initial help</span>
      <button slot="trigger">Do not describe this trigger label</button>
    </lr-tooltip>
  `);
  const description = el.querySelector('[data-lyra-tooltip-description]')!;
  expect(description.textContent).to.equal('Initial help');

  const content = el.querySelector('span:not([data-lyra-tooltip-description])')!;
  content.textContent = 'Updated help';
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  expect(description.textContent).to.equal('Updated help');
});

it('promotes actionable tooltip content to a focus-persistent dialog surface', async () => {
  const outside = document.createElement('button');
  outside.textContent = 'Outside';
  document.body.appendChild(outside);
  try {
    const el = (await fixture(html`
      <lr-tooltip show-delay="0" .strings=${{ popover: 'Helpful actions' }}>
        <button slot="trigger">Help</button>
        <button>Learn more</button>
      </lr-tooltip>
    `)) as LyraTooltip;
    const trigger = el.querySelector('[slot="trigger"]') as HTMLButtonElement;
    const action = el.querySelector('button:not([slot])') as HTMLButtonElement;
    const popup = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
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
  const popup = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
  const triggerRect = trigger.getBoundingClientRect();
  const popupRect = popup.getBoundingClientRect();

  expect(Math.abs(popupRect.x + popupRect.width / 2 - (triggerRect.x + triggerRect.width / 2))).to.be.lessThan(2);
  expect(popupRect.bottom).to.be.at.most(triggerRect.top);
});

it('names a dropdown popup "Menu", not "Popover", since it inherits LyraPopover with popupRole=menu', async () => {
  const el = await fixture(html`<lr-dropdown><button slot="trigger">Actions</button><button role="menuitem">Item</button></lr-dropdown>`);
  const popup = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
  expect(popup.getAttribute('aria-label')).to.equal('Menu');
});

it('keeps a plain popover (popupRole=dialog) named "Popover"', async () => {
  const el = await fixture(html`<lr-popover><button slot="trigger">Open</button><p>Details</p></lr-popover>`);
  const popup = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
  expect(popup.getAttribute('aria-label')).to.equal('Popover');
});

it('honors a .strings override for the popover key, provably reaching the rendered popup', async () => {
  const el = await fixture(
    html`<lr-popover .strings=${{ popover: 'Détails supplémentaires' }}
      ><button slot="trigger">Open</button>
      <p>Details</p></lr-popover
    >`,
  );
  const popup = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
  expect(popup.getAttribute('aria-label')).to.equal('Détails supplémentaires');
});

it('dismisses an open tooltip on Escape while the trigger keeps focus', async () => {
  const el = (await fixture(
    html`<lr-tooltip show-delay="0">Helpful text<button slot="trigger">Help</button></lr-tooltip>`,
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
  const el = (await fixture(html`<lr-tooltip show-delay="0">Info<button slot="trigger">A</button></lr-tooltip>`)) as LyraTooltip;
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
    <lr-tooltip show-delay="0">Info<button slot="trigger" aria-describedby="author-help">A</button></lr-tooltip>
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
    <lr-tooltip show-delay="40">Info<button slot="trigger">A</button></lr-tooltip>
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
    <lr-tooltip show-delay="1000">Info<button slot="trigger">Help</button></lr-tooltip>
  `)) as LyraTooltip;
  const trigger = el.querySelector('button') as HTMLButtonElement;
  trigger.dispatchEvent(new FocusEvent('focus'));
  expect(el.open).to.be.false;

  el.showDelay = 0;
  await el.updateComplete;
  expect(el.open).to.be.true;
});

it('keeps interactive tooltip content open across pointer transitions and closes on true exit', async () => {
  const outside = document.createElement('button');
  document.body.appendChild(outside);
  try {
    const el = (await fixture(html`
      <lr-tooltip show-delay="0">
        <button slot="trigger">Help</button>
        <button id="action">Action</button>
      </lr-tooltip>
    `)) as LyraTooltip;
    const trigger = el.querySelector('[slot="trigger"]') as HTMLButtonElement;
    const action = el.querySelector('#action') as HTMLButtonElement;
    const popup = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
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
  const popup = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
  expect(popup.getBoundingClientRect().width).to.be.at.most(320);
  expect(popup.scrollWidth).to.be.at.most(popup.clientWidth);
});

it('lets a consumer retheme the popover popup width via --lr-overlay-max-inline-size', async () => {
  const el = (await fixture(
    html`<lr-popover><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
  )) as LyraPopover;
  await el.updateComplete;
  const popup = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
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
  const popoverPopup = popover.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
  expect(popoverPopup.style.left).to.not.include('NaN');
  expect(popoverPopup.style.top).to.not.include('NaN');

  const tooltip = (await fixture(
    html`<lr-tooltip show-delay="0" distance="not-a-number">Info<button slot="trigger">Help</button></lr-tooltip>`,
  )) as LyraTooltip;
  const trigger = tooltip.querySelector('button') as HTMLButtonElement;
  trigger.focus();
  await tooltip.updateComplete;
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  const tooltipPopup = tooltip.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
  expect(tooltipPopup.style.left).to.not.include('NaN');
  expect(tooltipPopup.style.top).to.not.include('NaN');
});

it('falls back to the default 150ms delay when delay is NaN, instead of opening instantly', async () => {
  const el = (await fixture(html`<lr-tooltip>Info<button slot="trigger">Help</button></lr-tooltip>`)) as LyraTooltip;
  el.showDelay = NaN;
  await el.updateComplete;
  const trigger = el.querySelector('button') as HTMLButtonElement;
  trigger.dispatchEvent(new FocusEvent('focus'));
  expect(el.open, 'must not open synchronously on an invalid delay').to.be.false;
  await new Promise((resolve) => setTimeout(resolve, 250));
  expect(el.open, 'must still open, via the normalized default delay').to.be.true;
});

it('lets a consumer retheme the tooltip via --lr-tooltip-max-inline-size/-background/-color', async () => {
  const el = (await fixture(html`<lr-tooltip show-delay="0">Info<button slot="trigger">Help</button></lr-tooltip>`)) as LyraTooltip;
  await el.updateComplete;
  const popup = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
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
  const afterShow = oneEvent(el, 'lr-after-show');
  el.showAt({ x: 120, y: 80 });
  await afterShow;
  await el.updateComplete;
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await new Promise((r) => requestAnimationFrame(() => r(null)));

  expect(el.open).to.be.true;
  const popup = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
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
  const popup = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
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
  const afterShow = oneEvent(el, 'lr-after-show');
  el.showAt({ x: 200, y: 150 });
  await afterShow;
  await el.updateComplete;
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await new Promise((r) => requestAnimationFrame(() => r(null)));

  expect(el.open).to.be.true;
  const popup = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
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
    html`<lr-tooltip show-delay="0">Helpful text<button slot="trigger">Help</button></lr-tooltip>`,
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

describe('overlay semantic and lifecycle regressions', () => {
  it('promotes actionable content inside an assigned custom element open shadow root', async () => {
    const tagName = 'lr-test-tooltip-shadow-action';
    if (!customElements.get(tagName)) {
      customElements.define(
        tagName,
        class extends HTMLElement {
          constructor() {
            super();
            const root = this.attachShadow({ mode: 'open' });
            const button = document.createElement('button');
            button.textContent = 'Shadow action';
            root.append(button);
          }
        },
      );
    }

    const el = (await fixture(html`
      <lr-tooltip show-delay="0">
        <button slot="trigger">Help</button>
        <lr-test-tooltip-shadow-action></lr-test-tooltip-shadow-action>
      </lr-tooltip>
    `)) as LyraTooltip;
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    await el.updateComplete;

    const popup = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
    expect(popup.getAttribute('role')).to.equal('dialog');

    const trigger = el.querySelector('[slot="trigger"]') as HTMLButtonElement;
    const customContent = el.querySelector(tagName)!;
    const action = customContent.shadowRoot!.querySelector('button') as HTMLButtonElement;
    trigger.focus();
    await el.updateComplete;
    action.focus();
    await el.updateComplete;
    expect(el.open, 'focus moving into an actionable open shadow root must keep the tooltip open').to.be.true;
  });

  it('promotes actionable open-shadow content attached after the tooltip is already open', async () => {
    const tagName = 'lr-test-tooltip-late-shadow-action';
    if (!customElements.get(tagName)) {
      customElements.define(
        tagName,
        class extends HTMLElement {
          attachAction(): HTMLButtonElement {
            const root = this.attachShadow({ mode: 'open' });
            const button = document.createElement('button');
            button.textContent = 'Late shadow action';
            root.append(button);
            return button;
          }
        },
      );
    }

    const el = (await fixture(html`
      <lr-tooltip show-delay="0">
        <button slot="trigger">Help</button>
        <lr-test-tooltip-late-shadow-action></lr-test-tooltip-late-shadow-action>
      </lr-tooltip>
    `)) as LyraTooltip;
    const trigger = el.querySelector('[slot="trigger"]') as HTMLButtonElement;
    trigger.focus();
    await el.updateComplete;
    expect(el.open).to.be.true;
    expect(el.shadowRoot!.querySelector('[part~="popup"]')?.getAttribute('role')).to.equal('tooltip');

    const content = el.querySelector(tagName) as HTMLElement & { attachAction(): HTMLButtonElement };
    const action = content.attachAction();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('[part~="popup"]')?.getAttribute('role')).to.equal('dialog');
    action.focus();
    await el.updateComplete;
    expect(el.open, 'late actionable content must remain reachable by keyboard focus').to.be.true;
  });

  it('stops probing a permanently rootless custom element after a bounded grace period', async () => {
    const tagName = 'lr-test-tooltip-rootless-content';
    if (!customElements.get(tagName)) customElements.define(tagName, class extends HTMLElement {});

    const el = (await fixture(html`
      <lr-tooltip open manual>
        <button slot="trigger">Help</button>
        <lr-test-tooltip-rootless-content></lr-test-tooltip-rootless-content>
      </lr-tooltip>
    `)) as LyraTooltip;

    for (let frame = 0; frame < 10; frame++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }

    expect(
      (el as unknown as { shadowContentScanFrame?: number }).shadowContentScanFrame,
      'a legitimate custom element without a shadow root must not cause perpetual frame work',
    ).to.equal(undefined);
  });

  it('lets Escape from interactive tooltip content dismiss and restore trigger focus', async () => {
    const el = (await fixture(html`
      <lr-tooltip show-delay="0">
        <button slot="trigger">Help</button>
        <button id="action">Action</button>
      </lr-tooltip>
    `)) as LyraTooltip;
    const trigger = el.querySelector('[slot="trigger"]') as HTMLButtonElement;
    const action = el.querySelector('#action') as HTMLButtonElement;
    trigger.focus();
    await el.updateComplete;
    action.focus();

    action.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    await el.updateComplete;

    expect(el.open).to.be.false;
    expect(document.activeElement).to.equal(trigger);

    trigger.blur();
    trigger.focus();
    await el.updateComplete;
    expect(el.open, 'only the synchronous focus-return event is suppressed').to.be.true;
  });

  it('light-dismisses only the topmost sibling popover', async () => {
    const wrapper = await fixture(html`
      <div>
        <lr-popover open><button slot="trigger">One</button><button id="one">One action</button></lr-popover>
        <lr-popover open><button slot="trigger">Two</button><button id="two">Two action</button></lr-popover>
      </div>
    `);
    const [underlying, top] = [...wrapper.querySelectorAll('lr-popover')] as LyraPopover[];
    await underlying.updateComplete;
    await top.updateComplete;

    top.querySelector('#two')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    await underlying.updateComplete;
    await top.updateComplete;
    expect(underlying.open, 'interacting in the top layer must not dismiss a sibling underneath').to.be.true;
    expect(top.open).to.be.true;

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    await underlying.updateComplete;
    await top.updateComplete;
    expect(top.open, 'an outside pointer must dismiss the topmost layer').to.be.false;
    expect(underlying.open, 'the same pointer must not cascade into the underlying layer').to.be.true;
  });

  it('updates trigger aria-haspopup when popupRole changes live', async () => {
    const el = (await fixture(
      html`<lr-popover><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    const trigger = el.querySelector('button') as HTMLButtonElement;

    el.popupRole = 'menu';
    await el.updateComplete;

    expect(trigger.getAttribute('aria-haspopup')).to.equal('menu');
    expect(el.shadowRoot!.querySelector('[part~="popup"]')?.getAttribute('role')).to.equal('menu');
  });

  it('treats non-finite showAt coordinates as a no-op', async () => {
    const popover = (await fixture(html`<lr-popover><p>Details</p></lr-popover>`)) as LyraPopover;
    popover.showAt({ x: Number.NaN, y: 10 });
    await popover.updateComplete;
    expect(popover.open).to.be.false;

    const tooltip = (await fixture(html`<lr-tooltip>Details</lr-tooltip>`)) as LyraTooltip;
    tooltip.showAt({ x: 10, y: Number.POSITIVE_INFINITY });
    await tooltip.updateComplete;
    expect(tooltip.open).to.be.false;
  });

  it('does not activate a detached popover until it reconnects', async () => {
    const el = (await fixture(
      html`<lr-popover><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    const parent = el.parentElement!;
    el.remove();
    el.open = true;
    await el.updateComplete;

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await el.updateComplete;
    expect(el.open, 'a detached open property must not register global Escape ownership').to.be.true;

    parent.append(el);
    await el.updateComplete;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await el.updateComplete;
    expect(el.open, 'reconnecting an open popover must activate it').to.be.false;
  });

  it('closes trigger-anchored overlays when their trigger is removed', async () => {
    const popover = (await fixture(
      html`<lr-popover open><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    popover.querySelector('[slot="trigger"]')!.remove();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    await popover.updateComplete;
    expect(popover.open).to.be.false;

    const tooltip = (await fixture(
      html`<lr-tooltip open manual><button slot="trigger">Help</button>Details</lr-tooltip>`,
    )) as LyraTooltip;
    tooltip.querySelector('[slot="trigger"]')!.remove();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    await tooltip.updateComplete;
    expect(tooltip.open).to.be.false;
  });

  it('listens for popover light dismiss in ownerDocument after adoption', async () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    try {
      const frameDocument = iframe.contentDocument!;
      const el = (await fixture(
        html`<lr-popover open><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
      )) as LyraPopover;
      frameDocument.body.append(el);
      await el.updateComplete;

      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
      await el.updateComplete;
      expect(el.open, 'the former document must no longer own light dismiss').to.be.true;

      frameDocument.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
      await el.updateComplete;
      expect(el.open, 'the adopted owner document must own light dismiss').to.be.false;
    } finally {
      iframe.remove();
    }
  });

  it('keeps the generated host id and trigger controls synchronized after live id edits', async () => {
    const el = (await fixture(
      html`<lr-popover><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    const trigger = el.querySelector('button') as HTMLButtonElement;
    const generatedId = el.id;

    el.id = 'consumer-popover-id';
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(trigger.getAttribute('aria-controls')?.split(/\s+/)).to.include('consumer-popover-id');

    el.removeAttribute('id');
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(el.id).to.equal(generatedId);
    expect(trigger.getAttribute('aria-controls')?.split(/\s+/)).to.include(generatedId);
    expect(trigger.getAttribute('aria-controls')?.split(/\s+/)).to.not.include('consumer-popover-id');
  });
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

describe('unified show/hide lifecycle', () => {
  it('emits lr-show before a popover opens and lr-after-show once the transition finishes', async () => {
    const el = (await fixture(
      html`<lr-popover><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    const order: string[] = [];
    let openWhenShowFired: boolean | undefined;
    el.addEventListener('lr-show', () => {
      order.push('lr-show');
      openWhenShowFired = el.open;
    });
    el.addEventListener('lr-after-show', () => order.push('lr-after-show'));

    const afterShow = oneEvent(el, 'lr-after-show');
    el.show();
    expect(el.open).to.be.true;
    await afterShow;

    expect(order).to.deep.equal(['lr-show', 'lr-after-show']);
    expect(openWhenShowFired, 'lr-show announces an impending open').to.be.false;
  });

  it('emits lr-hide before a popover closes and lr-after-hide once the transition finishes', async () => {
    const el = (await fixture(
      html`<lr-popover open><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    await el.updateComplete;
    const order: string[] = [];
    el.addEventListener('lr-hide', () => order.push('lr-hide'));
    el.addEventListener('lr-after-hide', () => order.push('lr-after-hide'));

    const afterHide = oneEvent(el, 'lr-after-hide');
    el.hide();
    expect(el.open).to.be.false;
    await afterHide;
    expect(order).to.deep.equal(['lr-hide', 'lr-after-hide']);
  });

  it('vetoing lr-show keeps a popover closed for the trigger click, show() and open=true alike', async () => {
    const el = (await fixture(
      html`<lr-popover><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    const trigger = el.querySelector('button') as HTMLButtonElement;
    let cancelable: boolean | undefined;
    el.addEventListener('lr-show', (event) => {
      cancelable = (event as Event).cancelable;
      (event as Event).preventDefault();
    });

    trigger.click();
    await el.updateComplete;
    expect(cancelable).to.be.true;
    expect(el.open, 'trigger click').to.be.false;

    el.show();
    await el.updateComplete;
    expect(el.open, 'show()').to.be.false;

    el.open = true;
    await el.updateComplete;
    expect(el.open, 'open = true').to.be.false;
    expect(el.hasAttribute('open')).to.be.false;
    expect(trigger.getAttribute('aria-expanded')).to.equal('false');
  });

  it('vetoing lr-hide keeps a popover open for every dismissal path', async () => {
    const el = (await fixture(
      html`<lr-popover open><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    await el.updateComplete;
    el.addEventListener('lr-hide', (event) => (event as Event).preventDefault());

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await el.updateComplete;
    expect(el.open, 'Escape').to.be.true;

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.open, 'light dismiss').to.be.true;

    el.hide();
    await el.updateComplete;
    expect(el.open, 'hide()').to.be.true;

    el.open = false;
    await el.updateComplete;
    expect(el.open, 'open = false').to.be.true;
    expect(el.hasAttribute('open')).to.be.true;
  });

  it('emits nothing for popover markup that renders open from the start', async () => {
    let fired = 0;
    const el = (await fixture(
      html`<lr-popover open><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    for (const name of ['lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide']) {
      el.addEventListener(name, () => fired++);
    }
    await el.updateComplete;
    expect(fired).to.equal(0);
  });

  it('runs the full lifecycle on a tooltip, including from the trigger', async () => {
    const el = (await fixture(
      html`<lr-tooltip show-delay="0" hide-delay="0">Info<button slot="trigger">Help</button></lr-tooltip>`,
    )) as LyraTooltip;
    const trigger = el.querySelector('button') as HTMLButtonElement;
    const order: string[] = [];
    for (const name of ['lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide']) {
      el.addEventListener(name, () => order.push(name));
    }

    const afterShow = oneEvent(el, 'lr-after-show');
    trigger.dispatchEvent(new FocusEvent('focus'));
    await afterShow;

    const afterHide = oneEvent(el, 'lr-after-hide');
    trigger.dispatchEvent(new FocusEvent('blur'));
    await afterHide;

    expect(order).to.deep.equal(['lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide']);
  });

  it('vetoing a tooltip lr-show keeps it closed', async () => {
    const el = (await fixture(
      html`<lr-tooltip show-delay="0">Info<button slot="trigger">Help</button></lr-tooltip>`,
    )) as LyraTooltip;
    const trigger = el.querySelector('button') as HTMLButtonElement;
    el.addEventListener('lr-show', (event) => (event as Event).preventDefault());
    trigger.dispatchEvent(new FocusEvent('focus'));
    await el.updateComplete;
    expect(el.open).to.be.false;
  });

  it('exposes the same show()/hide()/open surface on lr-dropdown', async () => {
    const el = (await fixture(
      html`<lr-dropdown><button slot="trigger">Menu</button><p>Items</p></lr-dropdown>`,
    )) as LyraPopover;
    const afterShow = oneEvent(el, 'lr-after-show');
    el.show();
    expect(el.open).to.be.true;
    await afterShow;
    const afterHide = oneEvent(el, 'lr-after-hide');
    el.hide();
    expect(el.open).to.be.false;
    await afterHide;
  });

  it('lr-after-show and lr-after-hide are not cancelable', async () => {
    const el = (await fixture(
      html`<lr-popover><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    const shown = oneEvent(el, 'lr-after-show');
    el.show();
    expect((await shown).cancelable).to.be.false;
    const hidden = oneEvent(el, 'lr-after-hide');
    el.hide();
    expect((await hidden).cancelable).to.be.false;
  });
});

describe('anchored-overlay arrows and external anchoring', () => {
  it('uses the mapped popover arrow default and supports without-arrow', async () => {
    const popover = (await fixture(
      html`<lr-popover open><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    await popover.updateComplete;
    expect(popover.arrow).to.be.true;
    expect(popover.arrowPlacement).to.equal('anchor');
    expect(popover.arrowPadding).to.equal(0);
    expect(popover.skidding).to.equal(0);
    expect(popover.for).to.equal('');
    expect(popover.shadowRoot!.querySelectorAll('[part~="arrow"]').length).to.equal(1);

    popover.withoutArrow = true;
    await popover.updateComplete;
    expect(popover.shadowRoot!.querySelectorAll('[part~="arrow"]').length).to.equal(0);
  });

  it('renders an arrow carrying the resolved side in its part name', async () => {
    const popover = (await fixture(
      html`<lr-popover open arrow placement="bottom"
        ><button slot="trigger">Open</button><p>Details</p></lr-popover
      >`,
    )) as LyraPopover;
    await popover.updateComplete;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const arrow = popover.shadowRoot!.querySelector('[part~="arrow"]') as HTMLElement;
    expect(arrow).to.exist;
    const parts = (arrow.getAttribute('part') ?? '').split(/\s+/);
    expect(parts).to.include('arrow');
    expect(parts.some((token) => ['arrow-top', 'arrow-bottom', 'arrow-left', 'arrow-right'].includes(token))).to
      .be.true;
    expect(getComputedStyle(arrow).position).to.equal('absolute');
  });

  it('centres the arrow along the popup edge for arrow-placement="center"', async () => {
    const popover = (await fixture(
      html`<lr-popover open arrow arrow-placement="center" placement="bottom"
        ><button slot="trigger">Open</button><p>Some reasonably wide popover body text</p></lr-popover
      >`,
    )) as LyraPopover;
    await popover.updateComplete;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const popup = popover.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
    const arrow = popover.shadowRoot!.querySelector('[part~="arrow"]') as HTMLElement;
    const popupBox = popup.getBoundingClientRect();
    const arrowBox = arrow.getBoundingClientRect();
    expect(Math.abs(arrowBox.left + arrowBox.width / 2 - (popupBox.left + popupBox.width / 2))).to.be.at.most(1.5);
  });

  it('keeps a start-placed arrow arrow-padding away from the popup corner', async () => {
    const popover = (await fixture(
      html`<lr-popover open arrow arrow-placement="start" arrow-padding="20" placement="bottom"
        ><button slot="trigger">Open</button><p>Some reasonably wide popover body text</p></lr-popover
      >`,
    )) as LyraPopover;
    await popover.updateComplete;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const popup = popover.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
    const arrow = popover.shadowRoot!.querySelector('[part~="arrow"]') as HTMLElement;
    expect(arrow.getBoundingClientRect().left - popup.getBoundingClientRect().left).to.be.closeTo(20, 1.5);
  });

  it('offsets the popup along the anchor edge by skidding', async () => {
    const popover = (await fixture(
      html`<lr-popover open placement="bottom-start"
        ><button slot="trigger">Open</button><p>Details</p></lr-popover
      >`,
    )) as LyraPopover;
    await popover.updateComplete;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const popup = popover.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
    const before = popup.getBoundingClientRect().left;

    popover.skidding = 24;
    await popover.updateComplete;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(popup.getBoundingClientRect().left - before).to.be.closeTo(24, 1.5);
  });

  it('anchors against the element named by `for` instead of the slotted trigger', async () => {
    const frame = (await fixture(html`
      <div>
        <button id="near" style="position: absolute; inset-block-start: 0; inset-inline-start: 0;">Near</button>
        <button id="far" style="position: absolute; inset-block-start: 300px; inset-inline-start: 320px;">
          Far
        </button>
        <lr-popover open for="far" placement="bottom-start"
          ><button slot="trigger">Open</button><p>Details</p></lr-popover
        >
      </div>
    `)) as HTMLElement;
    const popover = frame.querySelector('lr-popover') as LyraPopover;
    await popover.updateComplete;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const popup = popover.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
    const far = frame.querySelector('#far') as HTMLElement;
    expect(popup.getBoundingClientRect().left).to.be.closeTo(far.getBoundingClientRect().left, 2);
  });

  it('gives lr-tooltip the same arrow, skidding and `for` surface', async () => {
    const frame = (await fixture(html`
      <div>
        <button id="tip-anchor" style="position: absolute; inset-block-start: 280px; inset-inline-start: 300px;">
          Anchor
        </button>
        <lr-tooltip open manual arrow for="tip-anchor" placement="bottom-start" show-delay="0"
          >Info<button slot="trigger">Help</button></lr-tooltip
        >
      </div>
    `)) as HTMLElement;
    const tooltip = frame.querySelector('lr-tooltip') as LyraTooltip;
    await tooltip.updateComplete;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const popup = tooltip.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
    const anchor = frame.querySelector('#tip-anchor') as HTMLElement;
    expect(tooltip.shadowRoot!.querySelectorAll('[part~="arrow"]').length).to.equal(1);
    expect(popup.getBoundingClientRect().left).to.be.closeTo(anchor.getBoundingClientRect().left, 2);
  });

  it('is accessible with an arrow rendered', async () => {
    const popover = (await fixture(
      html`<lr-popover open arrow aria-label="Details"
        ><button slot="trigger">Open</button><p>Details</p></lr-popover
      >`,
    )) as LyraPopover;
    await popover.updateComplete;
    expect(popover.shadowRoot!.querySelectorAll('[part~="arrow"]').length).to.equal(1);
    await expect(popover).to.be.accessible();
  });
});

describe('lr-tooltip trigger and delays', () => {
  it('defaults to hover and focus, matching the previous behaviour', async () => {
    const el = (await fixture(
      html`<lr-tooltip show-delay="0">Info<button slot="trigger">Help</button></lr-tooltip>`,
    )) as LyraTooltip;
    // String()-wrapped: while `trigger` was still the private slotted-element state, a failing
    // assertion here would have handed chai a DOM node and hung the whole file (see
    // docs/agents/testing.md).
    expect(String(el.trigger)).to.equal('hover focus');
    const trigger = el.querySelector('button') as HTMLButtonElement;

    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    await el.updateComplete;
    expect(el.open, 'hover').to.be.true;
    trigger.dispatchEvent(new MouseEvent('mouseleave'));
    await el.updateComplete;
    expect(el.open).to.be.false;

    trigger.dispatchEvent(new FocusEvent('focus'));
    await el.updateComplete;
    expect(el.open, 'focus').to.be.true;
  });

  it('opens on click and only on click when trigger="click"', async () => {
    const el = (await fixture(
      html`<lr-tooltip trigger="click" show-delay="0">Info<button slot="trigger">Help</button></lr-tooltip>`,
    )) as LyraTooltip;
    const trigger = el.querySelector('button') as HTMLButtonElement;

    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    await el.updateComplete;
    expect(el.open, 'hover must not open a click tooltip').to.be.false;

    trigger.click();
    await el.updateComplete;
    expect(el.open).to.be.true;

    trigger.click();
    await el.updateComplete;
    expect(el.open, 'a second click closes it again').to.be.false;
  });

  it('honours a single trigger keyword, ignoring the other interaction', async () => {
    const el = (await fixture(
      html`<lr-tooltip trigger="focus" show-delay="0">Info<button slot="trigger">Help</button></lr-tooltip>`,
    )) as LyraTooltip;
    const trigger = el.querySelector('button') as HTMLButtonElement;

    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    await el.updateComplete;
    expect(el.open).to.be.false;

    trigger.dispatchEvent(new FocusEvent('focus'));
    await el.updateComplete;
    expect(el.open).to.be.true;
  });

  it('ignores every interaction under trigger="manual", exactly like the manual boolean', async () => {
    const el = (await fixture(
      html`<lr-tooltip trigger="manual" show-delay="0">Info<button slot="trigger">Help</button></lr-tooltip>`,
    )) as LyraTooltip;
    const trigger = el.querySelector('button') as HTMLButtonElement;
    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    trigger.dispatchEvent(new FocusEvent('focus'));
    trigger.click();
    await el.updateComplete;
    expect(el.open).to.be.false;

    el.show();
    await el.updateComplete;
    expect(el.open, 'manual still opens programmatically').to.be.true;
  });

  it('delays showing and hiding independently', async () => {
    const el = (await fixture(
      html`<lr-tooltip show-delay="60" hide-delay="120">Info<button slot="trigger">Help</button></lr-tooltip>`,
    )) as LyraTooltip;
    const trigger = el.querySelector('button') as HTMLButtonElement;

    trigger.dispatchEvent(new FocusEvent('focus'));
    await el.updateComplete;
    expect(el.open, 'show-delay has not elapsed yet').to.be.false;
    await new Promise((resolve) => setTimeout(resolve, 140));
    expect(el.open).to.be.true;

    trigger.dispatchEvent(new FocusEvent('blur'));
    await el.updateComplete;
    expect(el.open, 'hide-delay has not elapsed yet').to.be.true;
    await new Promise((resolve) => setTimeout(resolve, 260));
    expect(el.open).to.be.false;
  });

  it('defaults hide-delay to 0, so blur closes immediately as it did before', async () => {
    const el = (await fixture(
      html`<lr-tooltip show-delay="0">Info<button slot="trigger">Help</button></lr-tooltip>`,
    )) as LyraTooltip;
    expect(el.hideDelay).to.equal(0);
    expect(el.showDelay).to.equal(0);
    const trigger = el.querySelector('button') as HTMLButtonElement;
    trigger.dispatchEvent(new FocusEvent('focus'));
    await el.updateComplete;
    expect(el.open).to.be.true;
    trigger.dispatchEvent(new FocusEvent('blur'));
    await el.updateComplete;
    expect(el.open).to.be.false;
  });

  it('show() and hide() bypass both delays', async () => {
    const el = (await fixture(
      html`<lr-tooltip show-delay="5000" hide-delay="5000">Info<button slot="trigger">Help</button></lr-tooltip>`,
    )) as LyraTooltip;
    el.show();
    await el.updateComplete;
    expect(el.open).to.be.true;
    el.hide();
    await el.updateComplete;
    expect(el.open).to.be.false;
  });

  it('normalizes a non-finite hide-delay to the default instead of hanging open', async () => {
    const el = (await fixture(
      html`<lr-tooltip show-delay="0">Info<button slot="trigger">Help</button></lr-tooltip>`,
    )) as LyraTooltip;
    el.hideDelay = Number.NaN;
    const trigger = el.querySelector('button') as HTMLButtonElement;
    trigger.dispatchEvent(new FocusEvent('focus'));
    await el.updateComplete;
    expect(el.open).to.be.true;
    trigger.dispatchEvent(new FocusEvent('blur'));
    await el.updateComplete;
    expect(el.open).to.be.false;
  });
});

describe('mapped popover and tooltip compatibility', () => {
  it('publishes the mapped popover open custom state', async function () {
    try {
      document.createElement('div').matches(':state(open)');
    } catch {
      this.skip();
    }
    const el = (await fixture(
      html`<lr-popover><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    expect(el.matches(':state(open)')).to.equal(false);
    await el.show();
    expect(el.matches(':state(open)')).to.equal(true);
    await el.hide();
    expect(el.matches(':state(open)')).to.equal(false);
  });

  it('uses mapped defaults while dropdown keeps its action-menu defaults', async () => {
    const popover = (await fixture(
      html`<lr-popover><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    const tooltip = (await fixture(
      html`<lr-tooltip><button slot="trigger">Help</button>Helpful context</lr-tooltip>`,
    )) as LyraTooltip;
    const dropdown = (await fixture(
      html`<lr-dropdown><button slot="trigger">Menu</button><span>Item</span></lr-dropdown>`,
    )) as LyraDropdown;

    expect(popover.placement).to.equal('top');
    expect(popover.distance).to.equal(8);
    expect(popover.arrow).to.equal(true);
    expect(tooltip.placement).to.equal('top');
    expect(tooltip.distance).to.equal(8);
    expect(tooltip.arrow).to.equal(true);
    expect(dropdown.placement).to.equal('bottom-start');
    expect(dropdown.distance).to.equal(0);
    expect(dropdown.arrow).to.equal(false);
  });

  it('supports the Shoelace default-trigger plus content slot shape', async () => {
    const el = (await fixture(html`
      <lr-tooltip show-delay="0">
        <button id="default-trigger">Help</button>
        <span slot="content">Default-trigger help</span>
      </lr-tooltip>
    `)) as LyraTooltip;
    const trigger = el.querySelector('#default-trigger') as HTMLButtonElement;
    trigger.dispatchEvent(new FocusEvent('focus'));
    await el.updateComplete;

    const triggerSlot = el.shadowRoot!.querySelector('[part="trigger"] slot:not([name])') as HTMLSlotElement;
    const contentSlot = el.shadowRoot!.querySelector('[part="body"] slot[name="content"]') as HTMLSlotElement;
    expect(triggerSlot.assignedElements()).to.deep.equal([trigger]);
    expect(contentSlot.assignedElements()[0]?.textContent).to.equal('Default-trigger help');
    expect(el.open).to.equal(true);
    expect(trigger.getAttribute('aria-describedby')).to.not.equal(null);
  });

  it('retains the Web Awesome named-trigger plus default-content shape', async () => {
    const el = (await fixture(html`
      <lr-tooltip open manual>
        <button slot="trigger">Help</button>
        <span id="named-content">Named-trigger help</span>
      </lr-tooltip>
    `)) as LyraTooltip;
    await el.updateComplete;
    const contentSlot = el.shadowRoot!.querySelector('[part="body"] slot:not([name])') as HTMLSlotElement;
    expect(contentSlot.assignedElements()[0]?.id).to.equal('named-content');
    expect(el.shadowRoot!.querySelector('[part="trigger"] slot[name="trigger"]')).to.exist;
  });

  it('accepts content as an attribute fallback in default-trigger mode', async () => {
    const el = (await fixture(html`
      <lr-tooltip open manual content="Attribute help"><button>Help</button></lr-tooltip>
    `)) as LyraTooltip;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="body"]')?.textContent?.trim()).to.equal('Attribute help');
  });

  it('supports disabled, without-arrow, hoist, and their unset regressions', async () => {
    const el = (await fixture(html`
      <lr-tooltip disabled without-arrow hoist show-delay="0" content="Help"><button>Help</button></lr-tooltip>
    `)) as LyraTooltip;
    const trigger = el.querySelector('button') as HTMLButtonElement;
    trigger.dispatchEvent(new FocusEvent('focus'));
    await el.updateComplete;
    expect(el.open).to.equal(false);
    expect(el.shadowRoot!.querySelector('[part~="arrow"]')).to.equal(null);

    el.disabled = false;
    el.withoutArrow = false;
    el.hoist = false;
    await el.updateComplete;
    trigger.dispatchEvent(new FocusEvent('focus'));
    await el.updateComplete;
    expect(el.open).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part~="arrow"]')).to.exist;
    expect(getComputedStyle(el.shadowRoot!.querySelector('[part~="popup"]')!).position).to.equal('absolute');
  });

  it('positions against explicit anchor properties ahead of id aliases and triggers', async () => {
    const frame = await fixture<HTMLElement>(html`
      <div>
        <button id="near" style="position: fixed; inset-block-start: 20px; inset-inline-start: 20px;">Near</button>
        <button id="far" style="position: fixed; inset-block-start: 240px; inset-inline-start: 260px;">Far</button>
        <lr-popover open for="near" placement="bottom-start">
          <button slot="trigger">Open</button><p>Details</p>
        </lr-popover>
      </div>
    `);
    const popover = frame.querySelector('lr-popover') as LyraPopover;
    const far = frame.querySelector('#far') as HTMLElement;
    popover.anchor = far;
    await popover.updateComplete;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(
      (popover.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement).getBoundingClientRect().left,
    ).to.be.closeTo(far.getBoundingClientRect().left, 2);
  });

  it('publishes additive mapped parts without removing the stable popup/base/tooltip seams', async () => {
    const popover = (await fixture(
      html`<lr-popover open><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    const tooltip = (await fixture(
      html`<lr-tooltip open manual content="Help"><button>Help</button></lr-tooltip>`,
    )) as LyraTooltip;
    const popoverParts = popover.shadowRoot!.querySelector('[part~="popup"]')!.getAttribute('part')!.split(/\s+/);
    const tooltipParts = tooltip.shadowRoot!.querySelector('[part~="popup"]')!.getAttribute('part')!.split(/\s+/);
    expect(popoverParts).to.include.members(['popup', 'dialog', 'popup__popup']);
    expect(popover.shadowRoot!.querySelector('[part~="body"]')).to.exist;
    expect(popover.shadowRoot!.querySelector('[part~="popup__arrow"]')).to.exist;
    expect(tooltipParts).to.include.members(['popup', 'base', 'tooltip', 'base__popup']);
    expect(tooltip.shadowRoot!.querySelector('[part~="body"]')).to.exist;
    expect(tooltip.shadowRoot!.querySelector('[part~="base__arrow"]')).to.exist;
  });

  it('returns promises that settle after the matching tooltip after-event', async () => {
    const el = (await fixture(
      html`<lr-tooltip manual content="Help"><button>Help</button></lr-tooltip>`,
    )) as LyraTooltip;
    const order: string[] = [];
    el.addEventListener('lr-after-show', () => order.push('after-show'));
    el.addEventListener('lr-after-hide', () => order.push('after-hide'));
    const shown = el.show().then(() => order.push('show-promise'));
    await shown;
    const hidden = el.hide().then(() => order.push('hide-promise'));
    await hidden;
    expect(order).to.deep.equal(['after-show', 'show-promise', 'after-hide', 'hide-promise']);
  });
});

describe('public animation registry integration', () => {
  it('resolves the popover, tooltip, and dropdown namespaces and preserves lifecycle promises when motion is disabled', async () => {
    const cases = [
      {
        namespace: 'popover',
        element: (await fixture(
          html`<lr-popover><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
        )) as LyraPopover,
      },
      {
        namespace: 'tooltip',
        element: (await fixture(
          html`<lr-tooltip manual content="Help"><button>Help</button></lr-tooltip>`,
        )) as LyraTooltip,
      },
      {
        namespace: 'dropdown',
        element: (await fixture(
          html`<lr-dropdown><button slot="trigger">Actions</button><button role="menuitem">Item</button></lr-dropdown>`,
        )) as LyraDropdown,
      },
    ];

    for (const { namespace, element } of cases) {
      const showName = `${namespace}.show`;
      const hideName = `${namespace}.hide`;
      const releaseShow = setAnimation(element, showName, {
        keyframes: [{ opacity: 0.2 }, { opacity: 0.8 }],
        options: { duration: 10_000 },
      });
      const releaseHide = setAnimation(element, hideName, null);
      const order: string[] = [];
      element.addEventListener('lr-after-show', () => order.push('after-show'));
      element.addEventListener('lr-after-hide', () => order.push('after-hide'));
      try {
        const shown = element.show().then(() => order.push('show-promise'));
        await element.updateComplete;
        const popup = element.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
        const nativeAnimation = popup.getAnimations().find((animation) => animation.id === showName);
        expect(nativeAnimation?.id).to.equal(showName);
        expect(String(nativeAnimation?.effect?.getKeyframes()[0]?.opacity)).to.equal('0.2');
        nativeAnimation?.finish();
        await shown;

        await element.hide().then(() => order.push('hide-promise'));
        expect(order).to.deep.equal(['after-show', 'show-promise', 'after-hide', 'hide-promise']);
        expect(popup.getAnimations().some((animation) => animation.id === hideName)).to.equal(false);
      } finally {
        releaseHide();
        releaseShow();
      }
    }
  });
});
