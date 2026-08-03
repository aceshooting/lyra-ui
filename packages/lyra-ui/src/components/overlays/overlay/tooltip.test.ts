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

it('deactivates the overlay when open interactive content stops being actionable without closing', async () => {
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

  // The overlay manager entry was torn down along with the promotion, so a document-level
  // Escape (as opposed to one dispatched on a focused trigger) no longer owns dismissal here.
  const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  document.dispatchEvent(escape);
  await el.updateComplete;
  expect(el.open).to.be.true;
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
  trigger.dispatchEvent(new FocusEvent('focus'));
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
  trigger.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 150));
  expect(el.open).to.be.true;

  el.remove();
});
