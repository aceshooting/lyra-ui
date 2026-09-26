import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { focusAfterPointer, focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraTooltip } from './tooltip.class.js';
import '../../forms/button/button.js';
import '../../forms/icon-button/icon-button.js';
import '../drawer/drawer.js';
import './tooltip.js';

const FORWARDER_TAG = 'test-tooltip-content-forwarder';

class TooltipContentForwarder extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).innerHTML = `
      <lr-tooltip manual>
        <button type="button" slot="trigger">Help</button>
        <slot>Fallback help</slot>
      </lr-tooltip>
    `;
  }

  get tooltip(): LyraTooltip {
    return this.shadowRoot!.querySelector('lr-tooltip') as LyraTooltip;
  }
}

if (!customElements.get(FORWARDER_TAG)) {
  customElements.define(FORWARDER_TAG, TooltipContentForwarder);
}

function descriptionProxy(el: LyraTooltip): HTMLSpanElement {
  return el.querySelector('[data-lyra-tooltip-description]') as HTMLSpanElement;
}

function popup(el: LyraTooltip): HTMLElement {
  return el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
}

it('tracks flattened forwarded text and actionability through mutation, reassignment, and fallback', async () => {
  const wrapper = (await fixture(html`
    <test-tooltip-content-forwarder>
      <span id="source">Initial forwarded help</span>
    </test-tooltip-content-forwarder>
  `)) as TooltipContentForwarder;
  const el = wrapper.tooltip;
  await el.updateComplete;
  await waitUntil(() => descriptionProxy(el).textContent === 'Initial forwarded help');
  expect(popup(el).getAttribute('role')).to.equal('tooltip');

  const source = wrapper.querySelector('#source') as HTMLElement;
  source.hidden = true;
  await waitUntil(() => descriptionProxy(el).textContent === '');
  expect(popup(el).getAttribute('role')).to.equal('tooltip');

  source.hidden = false;
  await waitUntil(() => descriptionProxy(el).textContent === 'Initial forwarded help');
  source.setAttribute('aria-hidden', ' TRUE ');
  await waitUntil(() => descriptionProxy(el).textContent === '');
  expect(popup(el).getAttribute('role')).to.equal('tooltip');

  source.removeAttribute('aria-hidden');
  await waitUntil(() => descriptionProxy(el).textContent === 'Initial forwarded help');
  wrapper.style.display = 'none';
  await waitUntil(() => descriptionProxy(el).textContent === '');

  wrapper.style.removeProperty('display');
  await waitUntil(() => descriptionProxy(el).textContent === 'Initial forwarded help');
  source.textContent = 'Updated forwarded help';
  await waitUntil(() => descriptionProxy(el).textContent === 'Updated forwarded help');

  const action = document.createElement('button');
  action.type = 'button';
  action.textContent = 'Forwarded action';
  source.replaceChildren(action);
  await waitUntil(() => popup(el).getAttribute('role') === 'dialog');
  await waitUntil(() => descriptionProxy(el).textContent === 'Forwarded action');

  const forwardingSlot = el.querySelector('slot') as HTMLSlotElement;
  const replacement = document.createElement('a');
  replacement.href = '#replacement';
  replacement.textContent = 'Replacement action';
  const reassigned = oneEvent(forwardingSlot, 'slotchange');
  source.replaceWith(replacement);
  await reassigned;
  await waitUntil(() => descriptionProxy(el).textContent === 'Replacement action');
  expect(popup(el).getAttribute('role')).to.equal('dialog');

  replacement.textContent = 'Renamed replacement action';
  await waitUntil(() => descriptionProxy(el).textContent === 'Renamed replacement action');

  const fallbackRestored = oneEvent(forwardingSlot, 'slotchange');
  wrapper.replaceChildren();
  await fallbackRestored;
  await waitUntil(() => descriptionProxy(el).textContent === 'Fallback help');
  expect(popup(el).getAttribute('role')).to.equal('tooltip');
});

it('contains a throwing owner activeElement getter while deciding Escape focus restoration', async () => {
  const el = (await fixture(html`<lr-tooltip manual>Tip</lr-tooltip>`)) as LyraTooltip;
  const prior = Object.getOwnPropertyDescriptor(document, 'activeElement');
  let unavailable = true;
  Object.defineProperty(document, 'activeElement', {
      configurable: true,
      get(): Element {
        if (unavailable) throw new TypeError('active element unavailable');
        return { nodeType: 1 } as Element;
      },
  });
  try {
    const internals = el as unknown as { shouldRestoreFocusAfterEscape(): boolean };
    expect(internals.shouldRestoreFocusAfterEscape()).to.equal(false);
    unavailable = false;
    expect(internals.shouldRestoreFocusAfterEscape()).to.equal(false);
  } finally {
    if (prior) Object.defineProperty(document, 'activeElement', prior);
    else delete (document as unknown as { activeElement?: unknown }).activeElement;
  }
});

it('contains a structural activeElement lookalike while deciding whether a trigger holds focus', async () => {
  const el = (await fixture(html`<lr-tooltip manual>Tip</lr-tooltip>`)) as LyraTooltip;
  const prior = Object.getOwnPropertyDescriptor(document, 'activeElement');
  Object.defineProperty(document, 'activeElement', {
    configurable: true,
    get(): Element {
      return { nodeType: 1 } as Element;
    },
  });
  try {
    const internals = el as unknown as {
      isTriggerHeld(trigger: HTMLElement): boolean;
    };
    expect(internals.isTriggerHeld(document.createElement('button'))).to.equal(false);
  } finally {
    if (prior) Object.defineProperty(document, 'activeElement', prior);
    else delete (document as unknown as { activeElement?: unknown }).activeElement;
  }
});

it('gives an explicitly empty host aria-label presence precedence without disabling unlabeled fallbacks', async () => {
  const explicitEmpty = (await fixture(html`
    <lr-tooltip manual aria-label="">
      <button type="button" slot="trigger">Help</button>
      <button type="button">Action text</button>
    </lr-tooltip>
  `)) as LyraTooltip;
  await waitUntil(() => popup(explicitEmpty).getAttribute('role') === 'dialog');
  expect(descriptionProxy(explicitEmpty).textContent).to.equal('');
  expect(popup(explicitEmpty).hasAttribute('aria-label')).to.be.true;
  expect(popup(explicitEmpty).getAttribute('aria-label')).to.equal('');

  explicitEmpty.removeAttribute('aria-label');
  await explicitEmpty.updateComplete;
  expect(descriptionProxy(explicitEmpty).textContent).to.equal('Action text');
  expect(popup(explicitEmpty).getAttribute('aria-label')).to.equal('Popover');

  explicitEmpty.setAttribute('aria-label', 'Helpful actions');
  await explicitEmpty.updateComplete;
  expect(descriptionProxy(explicitEmpty).textContent).to.equal('Helpful actions');
  expect(popup(explicitEmpty).getAttribute('aria-label')).to.equal('Helpful actions');

  const fallback = (await fixture(html`
    <lr-tooltip manual .strings=${{ popover: 'Localized actions' }}>
      <button type="button" slot="trigger">Help</button>
      <button type="button">Action text</button>
    </lr-tooltip>
  `)) as LyraTooltip;
  await waitUntil(() => popup(fallback).getAttribute('role') === 'dialog');
  expect(descriptionProxy(fallback).textContent).to.equal('Action text');
  expect(popup(fallback).getAttribute('aria-label')).to.equal('Localized actions');
});

it('classifies closed actionable content without ignoring consumer accessibility visibility', async () => {
  const el = (await fixture(html`
    <lr-tooltip manual>
      <button type="button" slot="trigger">Help</button>
      <button type="button" id="action">Closed action</button>
    </lr-tooltip>
  `)) as LyraTooltip;
  const action = el.querySelector('#action') as HTMLButtonElement;

  expect(el.open).to.be.false;
  await waitUntil(() => popup(el).getAttribute('role') === 'dialog');
  expect(descriptionProxy(el).textContent).to.equal('Closed action');

  action.style.visibility = 'hidden';
  await waitUntil(() => popup(el).getAttribute('role') === 'tooltip');
  expect(descriptionProxy(el).textContent).to.equal('');

  action.style.visibility = 'visible';
  await waitUntil(() => popup(el).getAttribute('role') === 'dialog');
  expect(descriptionProxy(el).textContent).to.equal('Closed action');

  action.setAttribute('aria-hidden', 'true');
  await waitUntil(() => popup(el).getAttribute('role') === 'tooltip');
  expect(descriptionProxy(el).textContent).to.equal('');
});

it('restores an authored inline popup visibility and priority after closed-content inspection', async () => {
  const el = (await fixture(html`
    <lr-tooltip manual>
      <button type="button" slot="trigger">Help</button>
      <span id="content">Initial help</span>
    </lr-tooltip>
  `)) as LyraTooltip;
  const popupElement = popup(el);
  popupElement.style.setProperty('visibility', 'collapse', 'important');

  el.querySelector('#content')!.textContent = 'Updated help';
  await waitUntil(() => descriptionProxy(el).textContent === 'Updated help');

  expect(popupElement.style.getPropertyValue('visibility')).to.equal('collapse');
  expect(popupElement.style.getPropertyPriority('visibility')).to.equal('important');
});

it('opens from keyboard focus and lets Escape dismiss it without moving focus', async () => {
  const el = (await fixture(html`
    <lr-tooltip show-delay="0">
      Keyboard help
      <button type="button" slot="trigger">Help</button>
    </lr-tooltip>
  `)) as LyraTooltip;
  const trigger = el.querySelector('button')!;

  await focusByKeyboard(trigger);
  await el.updateComplete;
  expect(el.open).to.be.true;
  expect(trigger.ownerDocument.activeElement === trigger).to.be.true;

  const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  trigger.dispatchEvent(escape);
  await el.updateComplete;
  expect(escape.defaultPrevented).to.be.true;
  expect(el.open).to.be.false;
  expect(trigger.ownerDocument.activeElement === trigger).to.be.true;
});

/** Lets a `show-delay="0"` tooltip act on a focus event before a "stays closed" assertion. */
async function settle(el: LyraTooltip): Promise<void> {
  await el.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  await new Promise((resolve) => setTimeout(resolve, 20));
}

function describesWithProxy(el: LyraTooltip, node: HTMLElement): boolean {
  const proxy = descriptionProxy(el);
  const reflected = (node as HTMLElement & { ariaDescribedByElements?: Element[] | null })
    .ariaDescribedByElements;
  if (reflected?.includes(proxy)) return true;
  return (node.getAttribute('aria-describedby') ?? '').split(/\s+/).includes(proxy.id);
}

async function clickCenter(target: Element): Promise<void> {
  const rect = target.getBoundingClientRect();
  await sendMouse({
    type: 'click',
    position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
  });
  await resetMouse();
}

function blurActive(): void {
  (document.activeElement as HTMLElement | null)?.blur?.();
}

describe('keyboard-only focus activation', () => {
  afterEach(async () => {
    blurActive();
    await resetMouse();
  });

  it('T1 opens on Tab onto the slotted trigger with the default trigger, described and accessible', async () => {
    const el = await fixture<LyraTooltip>(html`
      <lr-tooltip show-delay="0">Keyboard help<button type="button" slot="trigger">Help</button></lr-tooltip>
    `);
    const trigger = el.querySelector('button')!;
    await focusByKeyboard(trigger);
    await waitUntil(() => el.open, 'keyboard focus opens the tooltip');
    expect(describesWithProxy(el, trigger)).to.equal(true);
    await expect(el).to.be.accessible();
  });

  it('T2 does not open on a real pointer click with trigger="focus"', async () => {
    const el = await fixture<LyraTooltip>(html`
      <lr-tooltip trigger="focus" show-delay="0">Help<button type="button" slot="trigger">Help</button></lr-tooltip>
    `);
    let shows = 0;
    el.addEventListener('lr-show', () => shows++);
    await clickCenter(el.querySelector('button')!);
    await settle(el);
    expect(el.open).to.equal(false);
    expect(shows).to.equal(0);
  });

  it('T3/T3b keeps closed when a click handler moves focus onto the trigger', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div>
        <button type="button" id="still" @mousedown=${(event: Event) => event.preventDefault()}>Open</button>
        <button type="button" id="plain">Open</button>
        <lr-tooltip show-delay="0">Help<button type="button" slot="trigger">Help</button></lr-tooltip>
      </div>
    `);
    const el = wrapper.querySelector<LyraTooltip>('lr-tooltip')!;
    const trigger = el.querySelector('button')!;
    const still = wrapper.querySelector<HTMLButtonElement>('#still')!;
    const plain = wrapper.querySelector<HTMLButtonElement>('#plain')!;
    still.addEventListener('click', () => trigger.focus());
    plain.addEventListener('click', () => trigger.focus());

    // The opener that takes no focus (the Safari/macOS-Firefox shape): the engine can still
    // report the ring on the script focus that follows, so only the recorded press refuses it.
    await focusByKeyboard(still);
    await clickCenter(still);
    await settle(el);
    expect(document.activeElement === trigger, 'the handler focused the trigger').to.equal(true);
    expect(el.open, 'a pointer-initiated script focus does not open').to.equal(false);

    blurActive();
    await clickCenter(plain);
    await settle(el);
    expect(document.activeElement === trigger, 'the handler focused the trigger').to.equal(true);
    expect(el.open, 'a focusing opener behaves the same').to.equal(false);
  });

  it('T4 opens when Enter on an opener moves focus onto the trigger', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div>
        <button type="button" id="opener">Open</button>
        <lr-tooltip show-delay="0">Help<button type="button" slot="trigger">Help</button></lr-tooltip>
      </div>
    `);
    const el = wrapper.querySelector<LyraTooltip>('lr-tooltip')!;
    const trigger = el.querySelector('button')!;
    const opener = wrapper.querySelector<HTMLButtonElement>('#opener')!;
    opener.addEventListener('click', () => trigger.focus());
    await focusByKeyboard(opener);
    await sendKeys({ press: 'Enter' });
    await waitUntil(() => el.open, 'Enter-driven focus opens the tooltip');
  });

  it('T4b follows a drawer opened by pointer (closed) or by Enter (open) onto its initial focus', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div>
        <lr-button id="opener">Open drawer</lr-button>
        <lr-drawer label="Panel">
          <lr-tooltip show-delay="0">
            Close panel
            <lr-icon-button slot="trigger" icon="more" aria-label="More"></lr-icon-button>
          </lr-tooltip>
        </lr-drawer>
      </div>
    `);
    const opener = wrapper.querySelector<HTMLElement>('#opener')!;
    const drawer = wrapper.querySelector('lr-drawer') as HTMLElement & { open: boolean; updateComplete: Promise<unknown> };
    const el = wrapper.querySelector<LyraTooltip>('lr-tooltip')!;
    const iconButton = el.querySelector<HTMLElement>('lr-icon-button')!;
    opener.addEventListener('click', () => {
      drawer.open = true;
    });
    const focusedInside = () => {
      const active = document.activeElement;
      return active === iconButton || iconButton.contains(active);
    };

    await clickCenter(opener);
    await waitUntil(focusedInside, 'the drawer moved initial focus onto the trigger');
    await settle(el);
    expect(el.open, 'tap-opened drawer initial focus does not open the tooltip').to.equal(false);
    expect(describesWithProxy(el, iconButton.shadowRoot!.querySelector('button')!), 'still described').to.equal(true);

    drawer.open = false;
    await waitUntil(() => !focusedInside(), 'the drawer closed');
    await focusByKeyboard(opener);
    await sendKeys({ press: 'Enter' });
    await waitUntil(focusedInside, 'the drawer moved initial focus onto the trigger');
    await waitUntil(() => el.open, 'Enter-opened drawer initial focus opens the tooltip');
    drawer.open = false;
    await drawer.updateComplete;
  });

  it('T4c opens after another overlay\'s Escape restores focus onto the trigger', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div>
        <lr-tooltip show-delay="0" hide-delay="0">
          Opens the panel
          <lr-button slot="trigger">Open drawer</lr-button>
        </lr-tooltip>
        <lr-drawer label="Panel"><button type="button">Inside</button></lr-drawer>
      </div>
    `);
    const el = wrapper.querySelector<LyraTooltip>('lr-tooltip')!;
    const opener = el.querySelector<HTMLElement>('lr-button')!;
    const drawer = wrapper.querySelector('lr-drawer') as HTMLElement & { open: boolean };
    opener.addEventListener('click', () => {
      drawer.open = true;
    });
    const openerFocused = () => document.activeElement === opener;

    await focusByKeyboard(opener);
    await sendKeys({ press: 'Enter' });
    await waitUntil(() => drawer.open && !openerFocused() && !el.open, 'the drawer took focus');
    await sendKeys({ press: 'Escape' });
    await waitUntil(() => !drawer.open && openerFocused(), 'Escape restored focus to the opener');
    await waitUntil(() => el.open, 'keyboard-only restore opens the tooltip');

    if (navigator.userAgent.includes('Firefox')) return; // Firefox reports no ring for this restore.
    await el.hide();
    blurActive();
    await clickCenter(opener);
    await waitUntil(() => drawer.open && !openerFocused(), 'the drawer took focus');
    await sendKeys({ press: 'Escape' });
    await waitUntil(() => !drawer.open && openerFocused(), 'Escape restored focus to the opener');
    await waitUntil(() => el.open, 'the restore follows the engine ring');
  });

  it('T5 evaluates the deepest focused control inside a shadow trigger', async () => {
    const el = await fixture<LyraTooltip>(html`
      <lr-tooltip show-delay="0" hide-delay="0">
        Shadow help
        <lr-icon-button slot="trigger" icon="more" aria-label="More"></lr-icon-button>
      </lr-tooltip>
    `);
    const iconButton = el.querySelector<HTMLElement>('lr-icon-button')!;
    await focusByKeyboard(iconButton);
    await waitUntil(() => el.open, 'Tab into the inner control opens');
    blurActive();
    await waitUntil(() => !el.open, 'blur closes');
    await focusAfterPointer(iconButton);
    await settle(el);
    expect(el.open).to.equal(false);
  });

  it('T6 applies the same gate to a for= trigger', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div>
        <button type="button" id="for-trigger">Help</button>
        <lr-tooltip for="for-trigger" show-delay="0" hide-delay="0">Help</lr-tooltip>
      </div>
    `);
    const el = wrapper.querySelector<LyraTooltip>('lr-tooltip')!;
    const trigger = wrapper.querySelector<HTMLButtonElement>('#for-trigger')!;
    await focusByKeyboard(trigger);
    await waitUntil(() => el.open, 'keyboard focus opens');
    blurActive();
    await waitUntil(() => !el.open, 'blur closes');
    await focusAfterPointer(trigger);
    await settle(el);
    expect(el.open).to.equal(false);
  });

  it('T7 leaves hover independent of pointer focus', async () => {
    const el = await fixture<LyraTooltip>(html`
      <lr-tooltip show-delay="0" hide-delay="0">Help<button type="button" slot="trigger">Help</button></lr-tooltip>
    `);
    const trigger = el.querySelector('button')!;
    await focusAfterPointer(trigger);
    await settle(el);
    expect(el.open).to.equal(false);
    await hoverUntilMatched(trigger, 'the pointer reached the trigger');
    await waitUntil(() => el.open, 'hover opens');
    await resetMouse();
    await waitUntil(() => !el.open, 'mouseleave closes despite pointer focus');
    expect(document.activeElement === trigger, 'focus stayed on the trigger').to.equal(true);
  });

  it('T8 does not reopen after Escape from actionable content restores focus', async () => {
    const el = await fixture<LyraTooltip>(html`
      <lr-tooltip show-delay="0" hide-delay="0">
        <button type="button" slot="trigger">Help</button>
        <button type="button" id="action">Action</button>
      </lr-tooltip>
    `);
    const trigger = el.querySelector<HTMLButtonElement>('[slot="trigger"]')!;
    const action = el.querySelector<HTMLButtonElement>('#action')!;
    await focusByKeyboard(trigger);
    await waitUntil(() => el.open, 'keyboard focus opens');
    action.focus();
    await el.updateComplete;
    expect(el.open, 'focus inside interactive content retains it').to.equal(true);
    await sendKeys({ press: 'Escape' });
    await waitUntil(() => !el.open && document.activeElement === trigger, 'Escape closes and restores');
    await settle(el);
    expect(el.open, 'the restore does not reopen').to.equal(false);
  });

  it('T9 keeps the hover focus default', async () => {
    const el = await fixture<LyraTooltip>(html`<lr-tooltip></lr-tooltip>`);
    expect(el.trigger).to.equal('hover focus');
  });

  it('T10 keeps the gate across a reconnect', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div><lr-tooltip show-delay="0" hide-delay="0">Help<button type="button" slot="trigger">Help</button></lr-tooltip></div>
    `);
    const el = wrapper.querySelector<LyraTooltip>('lr-tooltip')!;
    const trigger = el.querySelector('button')!;
    await focusByKeyboard(trigger);
    await waitUntil(() => el.open);
    blurActive();
    await waitUntil(() => !el.open);
    el.remove();
    wrapper.append(el);
    await el.updateComplete;
    await focusByKeyboard(trigger);
    await waitUntil(() => el.open, 'keyboard focus opens after reconnect');
    blurActive();
    await waitUntil(() => !el.open);
    await focusAfterPointer(trigger);
    await settle(el);
    expect(el.open).to.equal(false);
  });

  it('T11 opens when Tab re-enters the document from a child frame after a pointer press', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div>
        <button type="button" id="before">Before</button>
        <iframe srcdoc="<button>in</button>" style="block-size: 60px"></iframe>
        <lr-tooltip show-delay="0">Help<button type="button" slot="trigger">Help</button></lr-tooltip>
      </div>
    `);
    const frame = wrapper.querySelector('iframe')!;
    await waitUntil(() => frame.contentDocument?.querySelector('button'), 'the frame loaded');
    const el = wrapper.querySelector<LyraTooltip>('lr-tooltip')!;
    const trigger = el.querySelector('button')!;
    await clickCenter(wrapper.querySelector('#before')!);
    const inner = frame.contentDocument!.querySelector('button')!;
    const frameRect = frame.getBoundingClientRect();
    const innerRect = inner.getBoundingClientRect();
    await sendMouse({
      type: 'click',
      position: [
        Math.round(frameRect.left + innerRect.left + innerRect.width / 2),
        Math.round(frameRect.top + innerRect.top + innerRect.height / 2),
      ],
    });
    await resetMouse();
    for (let press = 0; press < 3 && document.activeElement !== trigger; press++) {
      await sendKeys({ press: 'Tab' });
    }
    expect(document.activeElement === trigger, 'Tab left the frame onto the trigger').to.equal(true);
    await waitUntil(() => el.open, 're-entry is judged by the engine ring');
  });

  it('T12 pointer focus cancels no pending hide; keyboard focus does', async () => {
    const el = await fixture<LyraTooltip>(html`
      <lr-tooltip show-delay="0" hide-delay="200">Help<button type="button" slot="trigger">Help</button></lr-tooltip>
    `);
    const trigger = el.querySelector('button')!;
    await hoverUntilMatched(trigger, 'the pointer reached the trigger');
    await waitUntil(() => el.open, 'hover opens');
    await resetMouse();
    await focusAfterPointer(trigger);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(el.open, 'pointer focus did not cancel the pending hide').to.equal(false);

    blurActive();
    await hoverUntilMatched(trigger, 'the pointer reached the trigger');
    await waitUntil(() => el.open, 'hover opens');
    await resetMouse();
    await focusByKeyboard(trigger);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(el.open, 'keyboard focus holds it open').to.equal(true);
  });

  it('T13 describes the trigger on any focus without opening it', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div>
        <button type="button" id="outside">Outside</button>
        <lr-tooltip show-delay="0" hide-delay="0">Help<button type="button" slot="trigger">Help</button></lr-tooltip>
        <lr-tooltip trigger="hover" show-delay="0" hide-delay="0">Hover<button type="button" slot="trigger">Hover</button></lr-tooltip>
      </div>
    `);
    const [el, hoverOnly] = Array.from(wrapper.querySelectorAll<LyraTooltip>('lr-tooltip'));
    const trigger = el!.querySelector('button')!;
    const outside = wrapper.querySelector<HTMLButtonElement>('#outside')!;

    await focusAfterPointer(trigger);
    await settle(el!);
    expect(el!.open).to.equal(false);
    expect(describesWithProxy(el!, trigger), 'pointer focus describes').to.equal(true);
    await expect(wrapper).to.be.accessible();
    outside.focus();
    await el!.updateComplete;
    expect(describesWithProxy(el!, trigger), 'leaving the trigger releases').to.equal(false);

    await focusByKeyboard(trigger);
    await waitUntil(() => el!.open, 'keyboard focus opens');
    await sendKeys({ press: 'Escape' });
    await waitUntil(() => !el!.open, 'Escape closes');
    expect(document.activeElement === trigger).to.equal(true);
    expect(describesWithProxy(el!, trigger), 'the description stays while focused').to.equal(true);

    const hoverTrigger = hoverOnly!.querySelector('button')!;
    await focusAfterPointer(hoverTrigger);
    await settle(hoverOnly!);
    expect(describesWithProxy(hoverOnly!, hoverTrigger), 'hover-only pointer focus').to.equal(false);
    await focusByKeyboard(hoverTrigger);
    await settle(hoverOnly!);
    expect(describesWithProxy(hoverOnly!, hoverTrigger), 'hover-only keyboard focus').to.equal(false);
  });

  it('clears a focus description when the tooltip becomes disabled', async () => {
    const el = await fixture<LyraTooltip>(html`
      <lr-tooltip show-delay="0">Help<button type="button" slot="trigger">Help</button></lr-tooltip>
    `);
    const trigger = el.querySelector('button')!;
    await focusAfterPointer(trigger);
    await settle(el);
    expect(describesWithProxy(el, trigger)).to.equal(true);
    el.disabled = true;
    await el.updateComplete;
    expect(describesWithProxy(el, trigger)).to.equal(false);
  });
});

it('keeps composed trigger and actionable-popup focus transitions inside the interaction', async () => {
  const tagName = 'test-tooltip-composed-focus-trigger';
  if (!customElements.get(tagName)) customElements.define(tagName, class extends HTMLElement {});
  const outside = document.createElement('button');
  outside.textContent = 'Outside';
  document.body.append(outside);
  const el = (await fixture(html`
    <lr-tooltip show-delay="0">
      <test-tooltip-composed-focus-trigger slot="trigger">
        <button id="first-trigger-action">First</button>
        <button id="second-trigger-action">Second</button>
      </test-tooltip-composed-focus-trigger>
      <button id="tooltip-action">Tooltip action</button>
    </lr-tooltip>
  `)) as LyraTooltip;
  const first = el.querySelector<HTMLButtonElement>('#first-trigger-action')!;
  const second = el.querySelector<HTMLButtonElement>('#second-trigger-action')!;
  const action = el.querySelector<HTMLButtonElement>('#tooltip-action')!;

  await focusByKeyboard(first);
  await waitUntil(() => el.open);
  second.focus();
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  expect(el.open, 'moving within a composed trigger must not schedule a close').to.equal(true);

  action.focus();
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  expect(el.open, 'moving from the trigger into actionable tooltip content keeps it open').to.equal(true);

  outside.focus();
  await waitUntil(() => !el.open);
  outside.remove();
});

it('recognizes the shared native and ARIA-widget action vocabulary', async () => {
  const el = (await fixture(html`
    <lr-tooltip manual>
      <button type="button" slot="trigger">Help</button>
      <span role="switch">Toggle setting</span>
    </lr-tooltip>
  `)) as LyraTooltip;

  await waitUntil(() => popup(el).getAttribute('role') === 'dialog');
  expect(descriptionProxy(el).textContent).to.equal('Toggle setting');
});

it('treats an authored sequential focus stop as actionable content', async () => {
  const el = (await fixture(html`
    <lr-tooltip manual>
      <button type="button" slot="trigger">Help</button>
      <span tabindex="0">Focusable details</span>
    </lr-tooltip>
  `)) as LyraTooltip;

  await waitUntil(() => popup(el).getAttribute('role') === 'dialog');
  expect(descriptionProxy(el).textContent).to.equal('Focusable details');
});

it('bounds deep composed-content inspection and fails closed beyond the shared depth budget', async () => {
  const el = (await fixture(html`
    <lr-tooltip manual>
      <button type="button" slot="trigger">Help</button>
    </lr-tooltip>
  `)) as LyraTooltip;
  let branch: HTMLElement = document.createElement('span');
  const root = branch;
  for (let depth = 0; depth < 300; depth += 1) {
    const child = document.createElement('span');
    branch.append(child);
    branch = child;
  }
  branch.innerHTML = '<button type="button">Past the traversal ceiling</button>';

  el.append(root);
  await waitUntil(() => descriptionProxy(el).textContent === '');
  expect(popup(el).getAttribute('role')).to.equal('tooltip');
});

it('recreates content and generated-description observers from the current owner window after iframe adoption', async () => {
  const el = (await fixture(html`
    <lr-tooltip manual open>
      Helpful text
      <button type="button" slot="trigger">Help</button>
    </lr-tooltip>
  `)) as LyraTooltip;
  await el.updateComplete;

  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameWindow = frame.contentWindow;
  const frameDocument = frame.contentDocument;
  if (!frameWindow || !frameDocument) {
    frame.remove();
    throw new Error('The iframe realm was unavailable.');
  }
  const OriginalMutationObserver = frameWindow.MutationObserver;
  let constructions = 0;
  frameWindow.MutationObserver = class extends OriginalMutationObserver {
    constructor(callback: MutationCallback) {
      super(callback);
      constructions++;
    }
  } as typeof frameWindow.MutationObserver;

  try {
    frameDocument.body.append(el);
    await el.updateComplete;
    expect(el.ownerDocument === frameDocument).to.be.true;
    // Adoption can connect before the new realm has redistributed the trigger slot. Wait for the
    // actual relationship instead of letting an unrelated overlay observer satisfy this count.
    await waitUntil(() => {
      const adoptedTrigger = el.querySelector<HTMLElement>('[slot="trigger"]');
      const reflected = (adoptedTrigger as (HTMLElement & { ariaDescribedByElements?: Element[] }) | null)
        ?.ariaDescribedByElements;
      return (
        adoptedTrigger?.getAttribute('aria-describedby')?.includes(descriptionProxy(el).id) === true ||
        reflected?.includes(descriptionProxy(el)) === true
      );
    });
    // LyraElement itself creates one owner-realm observer. Requiring three then proves Tooltip also
    // recreated its content observer and the active shared description-ownership observer.
    expect(constructions).to.be.at.least(3);
  } finally {
    frameWindow.MutationObserver = OriginalMutationObserver;
    el.remove();
    frame.remove();
  }
});

it('cancels a delayed transition in its scheduling window and uses the adopted owner window next', async () => {
  const el = (await fixture(html`
    <lr-tooltip show-delay="50">
      Helpful text
      <button type="button" slot="trigger">Help</button>
    </lr-tooltip>
  `)) as LyraTooltip;
  const trigger = el.querySelector('button')!;
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameWindow = frame.contentWindow;
  const frameDocument = frame.contentDocument;
  if (!frameWindow || !frameDocument) {
    frame.remove();
    throw new Error('The iframe realm was unavailable.');
  }

  const originalSetTimeout = window.setTimeout;
  const originalClearTimeout = window.clearTimeout;
  const originalFrameSetTimeout = frameWindow.setTimeout;
  const originalFrameClearTimeout = frameWindow.clearTimeout;
  const topTimers = new Map<number, TimerHandler>();
  const frameTimers = new Map<number, TimerHandler>();
  let nextHandle = 0;
  let topSchedules = 0;
  let topCancellations = 0;
  let frameSchedules = 0;

  // The subject is timers and realms, not focus modality, so the ungated hover path drives it.
  window.setTimeout = ((handler: TimerHandler): number => {
    topSchedules++;
    const handle = ++nextHandle;
    topTimers.set(handle, handler);
    return handle;
  }) as typeof window.setTimeout;
  window.clearTimeout = ((handle?: number): void => {
    if (handle !== undefined && topTimers.delete(handle)) topCancellations++;
  }) as typeof window.clearTimeout;
  frameWindow.setTimeout = ((handler: TimerHandler): number => {
    frameSchedules++;
    const handle = ++nextHandle;
    frameTimers.set(handle, handler);
    return handle;
  }) as typeof frameWindow.setTimeout;
  frameWindow.clearTimeout = ((handle?: number): void => {
    if (handle !== undefined) frameTimers.delete(handle);
  }) as typeof frameWindow.clearTimeout;

  try {
    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    expect(topSchedules).to.equal(1);
    frameDocument.body.append(el);
    await el.updateComplete;
    expect(topCancellations).to.equal(1);

    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    expect(frameSchedules + topSchedules).to.equal(2);
    for (const [handle, callback] of [...frameTimers, ...topTimers]) {
      frameTimers.delete(handle);
      topTimers.delete(handle);
      if (typeof callback === 'function') callback();
    }
    await el.updateComplete;

    expect(topSchedules).to.equal(1);
    expect(frameSchedules).to.equal(1);
    expect(el.open).to.be.true;
  } finally {
    window.setTimeout = originalSetTimeout;
    window.clearTimeout = originalClearTimeout;
    frameWindow.setTimeout = originalFrameSetTimeout;
    frameWindow.clearTimeout = originalFrameClearTimeout;
    el.remove();
    frame.remove();
  }
});

it('closes a tooltip that starts both open and disabled before its very first update runs', async () => {
  const el = (await fixture(html`<lr-tooltip open disabled manual></lr-tooltip>`)) as LyraTooltip;
  await el.updateComplete;
  expect(el.open).to.be.false;
  expect(el.hasAttribute('open')).to.be.false;
});

it('closes an already-rendered open tooltip immediately when disabled is set afterward', async () => {
  const el = (await fixture(html`<lr-tooltip manual></lr-tooltip>`)) as LyraTooltip;
  el.open = true;
  await el.updateComplete;
  expect(el.open).to.be.true;

  el.disabled = true;
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('keeps Escape ownership when open interactive content stops being actionable', async () => {
  const el = (await fixture(html`
    <lr-tooltip manual>
      <button type="button" slot="trigger">Help</button>
      <button type="button" id="action">Do the thing</button>
    </lr-tooltip>
  `)) as LyraTooltip;
  await waitUntil(() => popup(el).getAttribute('role') === 'dialog');
  el.open = true;
  await el.updateComplete;
  expect(popup(el).getAttribute('role')).to.equal('dialog');

  const action = el.querySelector('#action') as HTMLButtonElement;
  action.setAttribute('aria-hidden', 'true');
  await waitUntil(() => popup(el).getAttribute('role') === 'tooltip');
  expect(el.open).to.be.true;

  const unrelated = document.createElement('button');
  unrelated.textContent = 'Unrelated focus';
  document.body.append(unrelated);
  unrelated.focus();
  const escape = new KeyboardEvent('keydown', {
    key: 'Escape',
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(escape);
  await el.updateComplete;
  expect(el.open).to.be.false;
  expect(document.activeElement?.textContent).to.equal('Unrelated focus');
  unrelated.remove();
});

it('keeps the tooltip open when lr-hide is prevented', async () => {
  const el = (await fixture(html`<lr-tooltip manual></lr-tooltip>`)) as LyraTooltip;
  el.open = true;
  await el.updateComplete;
  expect(el.open).to.be.true;

  el.addEventListener('lr-hide', (event) => event.preventDefault());
  await el.hide();
  expect(el.open).to.be.true;
  expect(el.hasAttribute('open')).to.be.true;
});

it('resolves show-delay from the --show-delay custom property when no attribute or property override applies', async () => {
  const el = (await fixture(html`
    <lr-tooltip style="--show-delay: 30ms">
      Custom delay help
      <button type="button" slot="trigger">Help</button>
    </lr-tooltip>
  `)) as LyraTooltip;
  expect(el.hasAttribute('show-delay')).to.be.false;
  expect(el.showDelay).to.equal(150);

  const trigger = el.querySelector('button')!;
  await focusByKeyboard(trigger);
  await waitUntil(() => el.open, 'should open well before the 150ms default show-delay', {
    interval: 5,
    timeout: 120,
  });
});

it('uses a nested element aria-label instead of its own text when computing the tooltip description', async () => {
  const el = (await fixture(html`
    <lr-tooltip manual>
      <button type="button" slot="trigger">Help</button>
      <div aria-label="Custom accessible label">Nested text that should not appear</div>
    </lr-tooltip>
  `)) as LyraTooltip;
  await waitUntil(() => descriptionProxy(el).textContent === 'Custom accessible label');
  expect(descriptionProxy(el).textContent).to.equal('Custom accessible label');
});

it('tracks image alternatives, labeling references, and collapsed details in its description', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div>
      <span id="diagram-label" hidden>Architecture diagram</span>
      <lr-tooltip manual>
        <button type="button" slot="trigger">Help</button>
        <img id="diagram" alt="Fallback diagram" aria-labelledby="diagram-label" />
        <details id="details">
          <summary>More context</summary>
          <span>Hidden details</span>
        </details>
      </lr-tooltip>
    </div>
  `);
  const el = wrapper.querySelector<LyraTooltip>('lr-tooltip')!;
  const label = wrapper.querySelector('#diagram-label')!;
  const image = el.querySelector('#diagram')!;
  const details = el.querySelector<HTMLDetailsElement>('#details')!;

  await waitUntil(() => descriptionProxy(el).textContent === 'Architecture diagram More context');

  label.removeAttribute('id');
  await waitUntil(() => descriptionProxy(el).textContent === 'Fallback diagram More context');
  label.id = 'diagram-label';
  await waitUntil(() => descriptionProxy(el).textContent === 'Architecture diagram More context');
  label.id = 'renamed-diagram-label';
  await waitUntil(() => descriptionProxy(el).textContent === 'Fallback diagram More context');
  image.setAttribute('aria-labelledby', 'renamed-diagram-label');
  await waitUntil(() => descriptionProxy(el).textContent === 'Architecture diagram More context');

  label.textContent = 'Updated architecture diagram';
  await waitUntil(
    () => descriptionProxy(el).textContent === 'Updated architecture diagram More context'
  );

  image.removeAttribute('aria-labelledby');
  image.setAttribute('alt', 'Updated fallback diagram');
  details.open = true;
  await waitUntil(
    () =>
      descriptionProxy(el).textContent === 'Updated fallback diagram More context Hidden details'
  );
});

it('tracks missing, inserted, replaced, removed, and cyclic external labeling targets', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div>
      <lr-tooltip manual>
        <button type="button" slot="trigger">Help</button>
        <img id="late-image" alt="Fallback image" aria-labelledby="late-label" />
      </lr-tooltip>
    </div>
  `);
  const el = wrapper.querySelector<LyraTooltip>('lr-tooltip')!;
  const image = el.querySelector('#late-image')!;
  await waitUntil(() => descriptionProxy(el).textContent === 'Fallback image');

  const inserted = document.createElement('span');
  inserted.id = 'late-label';
  inserted.hidden = true;
  inserted.textContent = 'Inserted label';
  wrapper.prepend(inserted);
  await waitUntil(() => descriptionProxy(el).textContent === 'Inserted label');

  const replacement = document.createElement('span');
  replacement.id = 'late-label';
  replacement.hidden = true;
  replacement.textContent = 'Replacement label';
  inserted.replaceWith(replacement);
  await waitUntil(() => descriptionProxy(el).textContent === 'Replacement label');

  replacement.remove();
  await waitUntil(() => descriptionProxy(el).textContent === 'Fallback image');

  const first = document.createElement('span');
  const second = document.createElement('span');
  first.id = 'cycle-label-a';
  first.hidden = true;
  first.setAttribute('aria-labelledby', 'cycle-label-b');
  second.id = 'cycle-label-b';
  second.hidden = true;
  second.setAttribute('aria-labelledby', 'cycle-label-a');
  wrapper.prepend(first, second);
  image.setAttribute('aria-labelledby', 'cycle-label-a');
  await waitUntil(() => descriptionProxy(el).textContent === '');
  expect(descriptionProxy(el).textContent?.length).to.equal(0);
});

it('does not expose fallback description text when an empty node is assigned', async () => {
  const el = (await fixture(html`
    <lr-tooltip manual content="Fallback help">
      <button type="button" slot="trigger">Help</button>
      <span id="assigned"></span>
    </lr-tooltip>
  `)) as LyraTooltip;

  await waitUntil(() => descriptionProxy(el).textContent === '');
  expect(descriptionProxy(el).textContent).to.equal('');

  for (const child of [...el.childNodes]) {
    const element = child.nodeType === Node.ELEMENT_NODE ? (child as Element) : null;
    if (
      element?.getAttribute('slot') !== 'trigger' &&
      !element?.hasAttribute('data-lyra-tooltip-description')
    ) {
      child.remove();
    }
  }
  await waitUntil(() => descriptionProxy(el).textContent === 'Fallback help');
});

it('force-closes after losing its sole trigger even when lr-hide is vetoed', async () => {
  const el = (await fixture(html`
    <lr-tooltip manual open>
      <button type="button" slot="trigger">Help</button>
      Helpful text
    </lr-tooltip>
  `)) as LyraTooltip;
  await el.updateComplete;
  el.addEventListener('lr-hide', (event) => event.preventDefault());

  el.querySelector('[slot="trigger"]')!.remove();
  await waitUntil(() => !el.open);
  expect(el.hasAttribute('open')).to.equal(false);
});

it('rolls back a vetoed showAt anchor before a later ordinary open', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div>
      <button id="return">Virtual return</button>
      <lr-tooltip manual>
        <button type="button" slot="trigger">Help</button>
        Helpful text
      </lr-tooltip>
    </div>
  `);
  const el = wrapper.querySelector<LyraTooltip>('lr-tooltip')!;
  const trigger = el.querySelector<HTMLButtonElement>('[slot="trigger"]')!;
  const virtualReturn = wrapper.querySelector<HTMLButtonElement>('#return')!;
  el.addEventListener('lr-show', (event) => event.preventDefault(), {
    once: true,
  });
  el.showAt({ x: 200, y: 200 }, { returnFocusTo: virtualReturn });
  expect(el.open).to.equal(false);

  trigger.focus();
  await el.show();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await el.updateComplete;
  expect(document.activeElement?.textContent).to.equal('Help');
});

it('reuses the active overlay handle when re-anchoring an already-open virtual-anchor tooltip', async () => {
  const el = (await fixture(html`<lr-tooltip manual></lr-tooltip>`)) as LyraTooltip;
  el.showAt({ x: 10, y: 10, width: 0, height: 0 });
  await el.updateComplete;
  expect(el.open).to.be.true;

  const returnTarget = document.createElement('button');
  returnTarget.type = 'button';
  returnTarget.textContent = 'Return target';
  document.body.append(returnTarget);

  try {
    el.showAt({ x: 50, y: 50, width: 0, height: 0 }, { returnFocusTo: returnTarget });
    await el.updateComplete;
    expect(el.open).to.be.true;

    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(escape);
    await el.updateComplete;
    expect(el.open).to.be.false;
    expect(returnTarget.ownerDocument.activeElement === returnTarget).to.be.true;
  } finally {
    returnTarget.remove();
  }
});

it('releases the previous positioner subscription before virtual re-anchoring', async () => {
  const viewport = window.visualViewport;
  if (!viewport) return;
  const originalAdd = viewport.addEventListener.bind(viewport);
  const originalRemove = viewport.removeEventListener.bind(viewport);
  let removals = 0;
  viewport.addEventListener = ((...args: Parameters<typeof viewport.addEventListener>) =>
    originalAdd(...args)) as typeof viewport.addEventListener;
  viewport.removeEventListener = ((...args: Parameters<typeof viewport.removeEventListener>) => {
    if (args[0] === 'resize' || args[0] === 'scroll') removals++;
    return originalRemove(...args);
  }) as typeof viewport.removeEventListener;
  const el = (await fixture(html`<lr-tooltip manual></lr-tooltip>`)) as LyraTooltip;
  try {
    el.showAt({ x: 10, y: 10 });
    await el.updateComplete;
    removals = 0;
    el.showAt({ x: 30, y: 30 });
    expect(removals).to.be.at.least(2);
  } finally {
    viewport.addEventListener = originalAdd;
    viewport.removeEventListener = originalRemove;
    el.remove();
  }
});

it('reactivates a fresh overlay on reconnect once the suspended one already deactivated itself', async () => {
  const el = (await fixture(html`<lr-tooltip manual></lr-tooltip>`)) as LyraTooltip;
  el.showAt({ x: 5, y: 5, width: 0, height: 0 });
  await el.updateComplete;
  expect(el.open).to.be.true;

  const parent = el.parentElement!;
  el.remove();
  // Let the overlay manager's own disconnect-cleanup microtask run before reconnecting, so the
  // suspended entry has already fully deactivated itself by the time connectedCallback re-checks it.
  await Promise.resolve();
  await Promise.resolve();

  parent.append(el);
  await el.updateComplete;
  expect(el.open).to.be.true;

  const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  document.dispatchEvent(escape);
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('resumes the still-active suspended overlay on an immediate, same-tick reconnect', async () => {
  const el = (await fixture(html`<lr-tooltip manual></lr-tooltip>`)) as LyraTooltip;
  el.showAt({ x: 5, y: 5, width: 0, height: 0 });
  await el.updateComplete;
  expect(el.open).to.be.true;

  const parent = el.parentElement!;
  // No microtask gap here, unlike the sibling reconnect test above -- the overlay manager's own
  // disconnect-cleanup microtask has not run yet, so the suspended handle is still active and
  // connectedCallback should resume it in place rather than creating a fresh one.
  el.remove();
  parent.append(el);
  await el.updateComplete;
  expect(el.open).to.be.true;

  const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  document.dispatchEvent(escape);
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('degrades open-content scheduling and observation gracefully after adoption into a windowless document', async () => {
  const el = (await fixture(html`
    <lr-tooltip hide-delay="50">
      Help text
      <button type="button" slot="trigger">Help</button>
      <test-tooltip-unregistered-widget>Nested</test-tooltip-unregistered-widget>
    </lr-tooltip>
  `)) as LyraTooltip;
  const trigger = el.querySelector('button')!;
  el.open = true;
  await el.updateComplete;
  expect(el.open).to.be.true;

  const detachedDocument = document.implementation.createHTMLDocument('');
  expect(detachedDocument.defaultView).to.be.null;

  detachedDocument.body.append(el);
  await el.updateComplete;
  expect(el.open).to.be.true;

  // A hide-delay timer has nothing to schedule against without an owner window, so the leave
  // interaction is dropped rather than throwing or eventually closing the tooltip.
  trigger.dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));
  await new Promise((resolve) => setTimeout(resolve, 150));
  expect(el.open).to.be.true;

  el.remove();
});

it('closes a hover-opened tooltip when a re-render replaces its trigger with a fresh node', async () => {
  // Regression test for the reported defect. In a transcript/log view that re-renders, a row is
  // replaced rather than moved: the hovered trigger is detached (so it never fires the mouseleave
  // that would close the tooltip) and a fresh node takes its place under the same id. The tooltip
  // adopted the new node but kept inheriting the outgoing one's open state, so it hung open over a
  // trigger nobody was pointing at -- several at once, per the report.
  const wrapper = await fixture<HTMLDivElement>(html`
    <div>
      <button id="recycled">Copy</button>
      <lr-tooltip for="recycled" content="Copy to clipboard" show-delay="0" hide-delay="0"></lr-tooltip>
    </div>
  `);
  const tooltip = wrapper.querySelector<LyraTooltip>('lr-tooltip')!;
  const trigger = wrapper.querySelector<HTMLButtonElement>('#recycled')!;
  await tooltip.updateComplete;

  const box = trigger.getBoundingClientRect();
  await sendMouse({
    type: 'move',
    position: [Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2)],
  });
  await waitUntil(() => tooltip.open, 'the tooltip opens on hover');

  // Recycle the row: same id, new node, positioned away from the pointer.
  const fresh = document.createElement('button');
  fresh.id = 'recycled';
  fresh.textContent = 'Copy';
  fresh.style.marginBlockStart = '300px';
  trigger.replaceWith(fresh);

  await waitUntil(() => !tooltip.open, 'the tooltip closes when its trigger is swapped away', {
    timeout: 2000,
  });

  await resetMouse();
});

it('keeps the tooltip open when the replacement trigger is itself under the pointer', async () => {
  // The close above must key on "is the incoming trigger actually held", not merely "a swap
  // happened" -- re-rendering a row the pointer still rests on has to leave the tooltip alone.
  const wrapper = await fixture<HTMLDivElement>(html`
    <div>
      <button id="held" style="inline-size: 200px; block-size: 60px">Copy</button>
      <lr-tooltip for="held" content="Copy to clipboard" show-delay="0" hide-delay="0"></lr-tooltip>
    </div>
  `);
  const tooltip = wrapper.querySelector<LyraTooltip>('lr-tooltip')!;
  const trigger = wrapper.querySelector<HTMLButtonElement>('#held')!;
  await tooltip.updateComplete;

  const box = trigger.getBoundingClientRect();
  await sendMouse({
    type: 'move',
    position: [Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2)],
  });
  await waitUntil(() => tooltip.open, 'the tooltip opens on hover');

  // Replace it in place, occupying the same box, so the pointer still rests over the new node.
  const fresh = document.createElement('button');
  fresh.id = 'held';
  fresh.textContent = 'Copy';
  fresh.style.inlineSize = '200px';
  fresh.style.blockSize = '60px';
  trigger.replaceWith(fresh);

  await new Promise((resolve) => setTimeout(resolve, 250));
  expect(tooltip.open, 'the pointer still rests on the replacement, so it stays open').to.be.true;

  await resetMouse();
});

it('leaves a focus-opened tooltip alone when its anchor moves, since no pointer holds it', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`
    <div style="block-size: 120px; overflow: auto">
      <button id="focus-trigger">Copy</button>
      <lr-tooltip for="focus-trigger" content="Copy" show-delay="0" hide-delay="0"></lr-tooltip>
      <div style="block-size: 600px"></div>
    </div>
  `);
  const tooltip = wrapper.querySelector<LyraTooltip>('lr-tooltip')!;
  const trigger = wrapper.querySelector<HTMLButtonElement>('#focus-trigger')!;
  await tooltip.updateComplete;

  await focusByKeyboard(trigger);
  await waitUntil(() => tooltip.open, 'the tooltip opens on focus');

  wrapper.scrollTop = 400;
  await new Promise((resolve) => setTimeout(resolve, 200));
  expect(tooltip.open, 'focus still holds it open after the anchor moved').to.be.true;
});

// Lit resolves `updateComplete` to `false` when a render scheduled another render. Closing an
// overlay used to do exactly that: the paint-gating `anchorPositioned` state was cleared from
// `updated()`, after the update had completed, costing an extra render that changed nothing
// visible and emitting Lit's change-in-update warning to every consumer on a dev build.
// Asserting the boolean measures the wasted render directly, rather than a console message Lit
// only ever emits once per tag per page.
it('settles closing in a single render, scheduling no follow-up update', async () => {
  const el = await fixture<LyraTooltip>(html`
    <lr-tooltip manual open><button type="button" slot="trigger">Help</button>Tip</lr-tooltip>
  `);
  await waitUntil(() => el.open);

  el.open = false;
  expect(await el.updateComplete, 'closing scheduled a second render').to.be.true;

  el.open = true;
  expect(await el.updateComplete, 'reopening scheduled a second render').to.be.true;
});

it('settles an anchor swap in a single render too', async () => {
  const host = await fixture(html`
    <div>
      <button id="t1">T1</button><button id="t2">T2</button>
      <lr-tooltip manual open>Tip</lr-tooltip>
    </div>
  `);
  const el = host.querySelector('lr-tooltip') as LyraTooltip;
  el.anchor = host.querySelector('#t1') as HTMLElement;
  await el.updateComplete;

  el.anchor = host.querySelector('#t2') as HTMLElement;
  expect(await el.updateComplete, 'swapping the anchor scheduled a second render').to.be.true;
});
