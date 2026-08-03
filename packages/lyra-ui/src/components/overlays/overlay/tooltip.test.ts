import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import type { LyraTooltip } from './tooltip.class.js';
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

it('opens from keyboard focus and lets Escape dismiss it without moving focus', async () => {
  const el = (await fixture(html`
    <lr-tooltip show-delay="0">
      Keyboard help
      <button type="button" slot="trigger">Help</button>
    </lr-tooltip>
  `)) as LyraTooltip;
  const trigger = el.querySelector('button')!;

  trigger.focus();
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

it('recreates both mutation observers from the current owner window after iframe adoption', async () => {
  const el = (await fixture(html`
    <lr-tooltip manual>
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
    // LyraElement itself creates one owner-realm observer. Requiring three proves Tooltip also
    // recreated both its content observer and the trigger aria-describedby observer.
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
    trigger.dispatchEvent(new FocusEvent('focus'));
    expect(topSchedules).to.equal(1);
    frameDocument.body.append(el);
    await el.updateComplete;
    expect(topCancellations).to.equal(1);

    trigger.dispatchEvent(new frameWindow.FocusEvent('focus'));
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
