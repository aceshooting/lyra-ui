import { aTimeout, expect, fixture, nextFrame, waitUntil } from '@open-wc/testing';
import { hoverUntilMatched, resetMouse, sendMouse, settlePointer } from '../../../../test/wtr-mouse.js';
import { focusAfterPointer, focusByKeyboard } from '../../../../test/wtr-focus.js';
import { sendKeys } from '@web/test-runner-commands';
import './popover.js';
import './dropdown.js';
import type { LyraPopover } from './popover.js';
import type { LyraDropdown } from './dropdown.js';

const build = (attrs: string, body = '<span>Body</span>') =>
  fixture<LyraPopover>(`<lr-popover ${attrs} style="--lr-duration-base: 0ms">
    <button slot="trigger">Trigger</button>
    ${body}
  </lr-popover>`);

const triggerOf = (el: LyraPopover): HTMLButtonElement =>
  el.querySelector<HTMLButtonElement>('button[slot="trigger"]')!;

const popupOf = (el: LyraPopover): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;

/** The `for=` shape: the trigger is a real element OUTSIDE the host, resolved by id from the
 *  shared root, so nothing it dispatches bubbles to a host-level listener. */
const buildFor = async (
  attrs: string
): Promise<{ el: LyraPopover; trigger: HTMLButtonElement; outside: HTMLButtonElement }> => {
  const wrapper = await fixture<HTMLDivElement>(`<div>
    <button id="external-popover-trigger">Trigger</button>
    <button id="external-popover-outside">Elsewhere</button>
    <lr-popover for="external-popover-trigger" ${attrs} style="--lr-duration-base: 0ms">
      <button>Inside</button>
    </lr-popover>
  </div>`);
  const el = wrapper.querySelector<LyraPopover>('lr-popover')!;
  await el.updateComplete;
  return {
    el,
    trigger: wrapper.querySelector<HTMLButtonElement>('#external-popover-trigger')!,
    outside: wrapper.querySelector<HTMLButtonElement>('#external-popover-outside')!,
  };
};

/** `mouseenter`/`mouseleave` do not bubble, so a synthetic one is dispatched on the exact node the
 *  component listens on. The pointer-driven path is covered separately with a real mouse. */
const enter = (node: Element, relatedTarget: Element | null = null): void => {
  node.dispatchEvent(new MouseEvent('mouseenter', { relatedTarget, composed: true }));
};
const leave = (node: Element, relatedTarget: Element | null = null): void => {
  node.dispatchEvent(new MouseEvent('mouseleave', { relatedTarget, composed: true }));
};

describe('lr-popover trigger modes', () => {
  it('defaults to click and keeps today’s toggle behaviour', async () => {
    const el = await build('');
    expect(el.trigger).to.equal('click');
    expect(el.showDelay).to.equal(0);
    expect(el.hideDelay).to.equal(0);
    expect(el.hoverBridge).to.equal(false);
    triggerOf(el).click();
    await waitUntil(() => el.open, 'a click opens the default popover');
    triggerOf(el).click();
    await waitUntil(() => !el.open, 'a second click closes it');
  });

  it('ignores hover and focus while the trigger mode is click', async () => {
    const el = await build('');
    enter(triggerOf(el));
    await focusByKeyboard(triggerOf(el));
    await settlePointer();
    expect(el.open).to.equal(false);
  });

  it('opens on hover and closes when the pointer leaves', async () => {
    const el = await build('trigger="hover"');
    enter(triggerOf(el));
    await waitUntil(() => el.open, 'hovering the trigger opens it');
    leave(triggerOf(el));
    await waitUntil(() => !el.open, 'leaving the trigger closes it');
  });

  it('stays open while the pointer moves from the trigger into the popup', async () => {
    const el = await build('trigger="hover"');
    enter(triggerOf(el));
    await waitUntil(() => el.open, 'hovering the trigger opens it');
    leave(triggerOf(el), popupOf(el));
    enter(popupOf(el));
    await settlePointer();
    expect(el.open).to.equal(true);
    leave(popupOf(el));
    await waitUntil(() => !el.open, 'leaving the popup closes it');
  });

  it('opens on a real pointer landing on the trigger', async () => {
    const el = await build('trigger="hover"');
    try {
      await hoverUntilMatched(triggerOf(el), 'the pointer lands on the trigger');
      await waitUntil(() => el.open, 'a real hover opens the popover');
    } finally {
      await resetMouse();
    }
  });

  it('never moves focus into a hover-opened popover, but does on a click-open', async () => {
    const el = await build('trigger="hover"', '<button autofocus>Inside</button>');
    const outside = document.createElement('button');
    el.parentElement!.append(outside);
    outside.focus();
    enter(triggerOf(el));
    await waitUntil(() => el.open, 'hovering opens it');
    await settlePointer();
    expect(document.activeElement === outside).to.equal(true, 'focus stayed outside');
    leave(triggerOf(el));
    await waitUntil(() => !el.open, 'leaving closes it');
    outside.focus();
    triggerOf(el).click();
    await waitUntil(
      () => el.contains(document.activeElement),
      'a click-pin open still honours autofocus'
    );
    outside.remove();
  });

  it('pins a hover-opened popover on click and unpins on the next click', async () => {
    const el = await build('trigger="hover"');
    enter(triggerOf(el));
    await waitUntil(() => el.open, 'hovering opens it');
    triggerOf(el).click();
    leave(triggerOf(el));
    await settlePointer();
    expect(el.open).to.equal(true, 'a pinned popover survives the pointer leaving');
    triggerOf(el).click();
    await waitUntil(() => !el.open, 'the next click unpins and closes it');
  });

  it('opens on focus and retains focus-within while focus moves into the popup', async () => {
    const el = await build('trigger="focus"', '<button>Inside</button>');
    const outside = document.createElement('button');
    el.parentElement!.append(outside);
    const inside = () => el.querySelector<HTMLButtonElement>('button:not([slot])')!;
    await focusByKeyboard(triggerOf(el));
    await waitUntil(() => el.open, 'focusing the trigger opens it');
    inside().focus();
    await settlePointer();
    expect(el.open).to.equal(true, 'focus inside the popover retains it');
    outside.focus();
    await waitUntil(() => !el.open, 'focus leaving the whole surface closes it');
    outside.remove();
  });

  it('leaves a manual popover entirely under programmatic control', async () => {
    const el = await build('trigger="manual"');
    triggerOf(el).click();
    enter(triggerOf(el));
    await focusByKeyboard(triggerOf(el));
    await settlePointer();
    expect(el.open).to.equal(false);
    await el.show();
    expect(el.open).to.equal(true);
    await el.hide();
  });

  it('honours the show delay before opening', async () => {
    const el = await build('trigger="hover" show-delay="120"');
    enter(triggerOf(el));
    await settlePointer();
    expect(el.open).to.equal(false, 'the delay has not elapsed yet');
    await waitUntil(() => el.open, 'the delayed open still lands', { timeout: 2000 });
  });

  it('honours the hide delay before closing', async () => {
    const el = await build('trigger="hover" hide-delay="120"');
    enter(triggerOf(el));
    await waitUntil(() => el.open, 'hovering opens it');
    leave(triggerOf(el));
    await settlePointer();
    expect(el.open).to.equal(true, 'the hide delay has not elapsed yet');
    await waitUntil(() => !el.open, 'the delayed close still lands', { timeout: 2000 });
  });

  it('re-entering the trigger cancels a pending close', async () => {
    const el = await build('trigger="hover" hide-delay="150"');
    enter(triggerOf(el));
    await waitUntil(() => el.open, 'hovering opens it');
    leave(triggerOf(el));
    enter(triggerOf(el));
    await settlePointer();
    // wait-reason: hide-delay (150ms) must elapse to prove the cancelled close never ran
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(el.open).to.equal(true, 'the cancelled close never ran');
  });

  it('renders the hover bridge only while a hover popover is open', async () => {
    const el = await build('trigger="hover" hover-bridge');
    expect(el.shadowRoot!.querySelector('[part~="hover-bridge"]') === null).to.equal(
      true,
      'no bridge while closed'
    );
    enter(triggerOf(el));
    await waitUntil(() => el.open, 'hovering opens it');
    await el.updateComplete;
    const bridge = el.shadowRoot!.querySelector<HTMLElement>('[part~="hover-bridge"]');
    expect(bridge === null).to.equal(false, 'the bridge renders while open');
    await waitUntil(
      () =>
        bridge!.style.getPropertyValue('--lr-positioner-hover-bridge-top-left-x').length > 0,
      'the positioner writes the bridge quad'
    );
  });

  it('drops pinned hover state when the popover is disconnected', async () => {
    const el = await build('trigger="hover"');
    const parent = el.parentElement!;
    enter(triggerOf(el));
    await waitUntil(() => el.open, 'hovering opens it');
    triggerOf(el).click();
    el.remove();
    parent.append(el);
    await el.updateComplete;
    el.open = false;
    await el.updateComplete;
    enter(triggerOf(el));
    await waitUntil(() => el.open, 'hovering opens it again');
    leave(triggerOf(el));
    await waitUntil(() => !el.open, 'the stale pin did not survive the reconnect');
  });

  it('still emits the cancelable lifecycle from a hover open', async () => {
    const el = await build('trigger="hover"');
    // Not oneEvent(): a regression here means the event never fires, which would hang the whole
    // file until the per-file watchdog instead of failing this one assertion.
    let cancelable: boolean | undefined;
    el.addEventListener('lr-show', (event) => {
      cancelable = event.cancelable;
    });
    enter(triggerOf(el));
    await waitUntil(() => cancelable !== undefined, 'a hover open emits lr-show');
    expect(cancelable).to.equal(true);
    await waitUntil(() => el.open, 'the unvetoed hover open commits');
  });

  it('keeps keyboard activation working from the focused trigger under click mode', async () => {
    const el = await build('');
    triggerOf(el).focus();
    // A real key press, and no programmatic .click(): a synthetic KeyboardEvent never produces a
    // native click, so a dispatch-then-click pair asserts nothing about the keyboard.
    await sendKeys({ press: 'Enter' });
    await waitUntil(() => el.open, 'Enter on the focused trigger opens it');
  });

  it('normalizes an unsupported trigger value back to click', async () => {
    const el = await build('trigger="sideways"');
    expect(el.trigger).to.equal('click');
  });

  it('refuses every interaction while disabled', async () => {
    const el = await build('trigger="hover" disabled');
    enter(triggerOf(el));
    await settlePointer();
    expect(el.open).to.equal(false);
    el.trigger = 'focus';
    await el.updateComplete;
    await focusByKeyboard(triggerOf(el));
    await settlePointer();
    expect(el.open).to.equal(false);
  });

  it('opens on hover under RTL exactly as it does under LTR', async () => {
    const el = await build('trigger="hover" dir="rtl"');
    // The rendered direction, not the protected `effectiveDirection` accessor: reading a protected
    // member fails the strict test-tree type check `pnpm lint` runs.
    expect(getComputedStyle(el).direction).to.equal('rtl');
    enter(triggerOf(el));
    await waitUntil(() => el.open, 'hovering opens it under RTL');
    leave(triggerOf(el));
    await waitUntil(() => !el.open, 'leaving closes it under RTL');
  });

  it('carries the whole contract down to lr-dropdown, focus included', async () => {
    const el = await fixture<LyraDropdown>(`<lr-dropdown trigger="hover" hover-bridge
      style="--lr-duration-base: 0ms">
      <button slot="trigger">Menu</button>
      <lr-dropdown-item>One</lr-dropdown-item>
    </lr-dropdown>`);
    expect(el.trigger).to.equal('hover');
    const outside = document.createElement('button');
    el.parentElement!.append(outside);
    outside.focus();
    enter(triggerOf(el));
    await waitUntil(() => el.open, 'hovering opens the dropdown');
    await settlePointer();
    expect(document.activeElement === outside).to.equal(
      true,
      'a hover-opened dropdown never pulls focus into its menu'
    );
    expect(el.shadowRoot!.querySelector('[part~="hover-bridge"]') === null).to.equal(false);
    leave(triggerOf(el));
    await waitUntil(() => !el.open, 'leaving closes it');
    outside.remove();
  });

  it('opens a for-anchored popover on focus, exactly like a slotted one', async () => {
    const { el, trigger, outside } = await buildFor('trigger="focus"');
    await focusByKeyboard(trigger);
    await waitUntil(() => el.open, 'focusing an external for-trigger opens the popover');
    outside.focus();
    await waitUntil(() => !el.open, 'focus leaving the whole surface closes it');
  });

  it('retains a for-anchored focus popover while focus moves into the popup', async () => {
    const { el, trigger, outside } = await buildFor('trigger="focus"');
    await focusByKeyboard(trigger);
    await waitUntil(() => el.open, 'focusing the external trigger opens it');
    el.querySelector<HTMLButtonElement>('button')!.focus();
    await settlePointer();
    expect(el.open).to.equal(true, 'focus inside the popover retains it');
    outside.focus();
    await waitUntil(() => !el.open, 'focus leaving closes it');
  });

  it('opens a for-anchored popover on hover', async () => {
    const { el, trigger } = await buildFor('trigger="hover"');
    enter(trigger);
    await waitUntil(() => el.open, 'hovering an external for-trigger opens the popover');
    leave(trigger);
    await waitUntil(() => !el.open, 'leaving it closes the popover');
  });

  it('never double-fires the focus path for a slotted trigger', async () => {
    const el = await build('trigger="focus"');
    let shows = 0;
    el.addEventListener('lr-show', () => {
      shows += 1;
    });
    await focusByKeyboard(triggerOf(el));
    await waitUntil(() => el.open, 'focusing the slotted trigger opens it');
    await settlePointer();
    expect(shows).to.equal(1, 'the host listener is the only one that ran');
  });

  it('accepts the tooltip’s space-separated trigger list', async () => {
    const el = await build('trigger="hover focus"');
    expect(el.trigger).to.equal('hover focus');
    const outside = document.createElement('button');
    el.parentElement!.append(outside);
    // Focus first, while the trigger provably does not already hold it: a close hands focus BACK
    // to the trigger, so the focus keyword has to be exercised before the hover keyword.
    outside.focus();
    await focusByKeyboard(triggerOf(el));
    await waitUntil(() => el.open, 'the focus keyword opens it');
    outside.focus();
    await waitUntil(() => !el.open, 'focus leaving the surface closes it');
    enter(triggerOf(el));
    await waitUntil(() => el.open, 'the hover keyword opens it too');
    leave(triggerOf(el));
    await waitUntil(() => !el.open, 'leaving closes it');
    outside.remove();
  });

  it('drops unsupported keywords and lets manual win over the rest', async () => {
    const el = await build('trigger="hover sideways"');
    expect(el.trigger).to.equal('hover', 'the unsupported keyword is dropped');
    el.trigger = 'hover manual';
    await el.updateComplete;
    expect(el.trigger).to.equal('hover manual');
    enter(triggerOf(el));
    triggerOf(el).click();
    await settlePointer();
    expect(el.open).to.equal(false, 'manual refuses every interaction beside it');
    el.removeAttribute('trigger');
    await el.updateComplete;
    expect(el.trigger).to.equal('click', 'removing the attribute restores the default');
    triggerOf(el).click();
    await waitUntil(() => el.open, 'the restored default toggles on click again');
  });

  it('re-arms a shortened delay without writing open from inside the update', async () => {
    const el = await build('trigger="hover" show-delay="400"');
    enter(triggerOf(el));
    await settlePointer();
    expect(el.open).to.equal(false, 'the long delay has not elapsed');
    el.showDelay = 0;
    // Lit resolves `updateComplete` to false when the update it just finished scheduled another
    // one -- exactly what a `show()` committed from inside `updated()` would do.
    const settled = await el.updateComplete;
    expect(settled).to.equal(true, 'the re-armed commit ran off the update cycle');
    await waitUntil(() => el.open, 'the re-armed zero-delay open still lands');
  });

  it('renders no hover bridge when hover-bridge was never authored', async () => {
    const el = await build('trigger="hover"');
    expect(el.hoverBridge).to.equal(false);
    enter(triggerOf(el));
    await waitUntil(() => el.open, 'hovering opens it');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part~="hover-bridge"]') === null).to.equal(
      true,
      'the fixed full-viewport bridge only exists when asked for'
    );
  });

  it('passes an accessibility audit while hover-opened with the bridge rendered', async () => {
    const el = await build('trigger="hover" hover-bridge', '<p>Details</p>');
    enter(triggerOf(el));
    await waitUntil(() => el.open, 'hovering opens it');
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it('keeps focus inside the popup retaining a hover surface nested in open shadow roots', async () => {
    const host = await fixture<HTMLDivElement>('<div></div>');
    const outerRoot = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('div');
    outerRoot.append(inner);
    const innerRoot = inner.attachShadow({ mode: 'open' });
    innerRoot.innerHTML = `<lr-popover trigger="hover" style="--lr-duration-base: 0ms">
      <button slot="trigger">Trigger</button>
      <a href="#details">Details</a>
    </lr-popover>`;
    const el = innerRoot.querySelector<LyraPopover>('lr-popover')!;
    await el.updateComplete;
    const link = el.querySelector<HTMLAnchorElement>('a')!;
    enter(triggerOf(el));
    await waitUntil(() => el.open, 'hovering opens it');
    await waitUntil(() => {
      link.focus();
      return innerRoot.activeElement === link;
    }, 'focus moves into the popup content');
    leave(triggerOf(el));
    await settlePointer();
    // wait-reason: asserting the popup stays open after the pointer leaves
    await aTimeout(30);
    expect(el.open).to.equal(true, 'focus inside the popup retains it after the pointer leaves');
    link.blur();
    await el.hide();
  });

  it('keeps focus inside the popup retaining a document-level hover surface', async () => {
    const el = await build('trigger="hover"', '<a href="#details">Details</a>');
    const link = el.querySelector<HTMLAnchorElement>('a')!;
    enter(triggerOf(el));
    await waitUntil(() => el.open, 'hovering opens it');
    await waitUntil(() => {
      link.focus();
      return document.activeElement === link;
    }, 'focus moves into the popup content');
    leave(triggerOf(el));
    await settlePointer();
    // wait-reason: asserting the popup stays open after the pointer leaves
    await aTimeout(30);
    expect(el.open).to.equal(true, 'focus inside the popup retains it after the pointer leaves');
    link.blur();
    await el.hide();
  });
});

// The render tree carries two independent slots (the named `trigger` slot and the default
// content slot), each firing its OWN initial `slotchange` in a real browser, in no order this
// suite should rely on. A capture-phase listener scoped only to "the first slotchange of any
// kind" could swallow the content slot's event and let the trigger slot's real one through
// unsuppressed, which would still pass without proving the fix. Filtering on `e.target`'s slot
// name targets exactly the slot this test is about.
const isTriggerSlot = (event: Event): boolean =>
  (event.target as HTMLSlotElement | null)?.getAttribute('name') === 'trigger';

describe('collecting an already-slotted trigger without relying on the initial slotchange', () => {
  // `click` is deliberately NOT the probe here: `[part="trigger"]` carries its own
  // `@click=${this.onTriggerClick}` binding (see `render()` above), which a slotted trigger's
  // click reaches through ordinary event bubbling regardless of whether `slottedTrigger` was ever
  // resolved -- so a click-based assertion cannot tell this fix apart from doing nothing.
  // `mouseenter`/`mouseleave` do NOT bubble (see `bindTriggerInteractions()`'s own comment), so a
  // "hover" trigger opening is proof that the listener was bound directly to the real slotted
  // element, which only happens once `syncInteractionTrigger()` has resolved `slottedTrigger`.
  it('binds hover interactions to the slotted trigger when its initial slotchange is suppressed (simulating happy-dom)', async () => {
    // happy-dom (through at least 20.14.5) never fires `slotchange` for a slot's INITIAL
    // assignment. This suite runs in a real browser, which DOES fire it -- so to reproduce the
    // happy-dom condition deterministically here, swallow that one event with a capture-phase
    // listener on the render root: capture-phase fires on the way down to the <slot> itself,
    // before the slot's own bubble-phase `@slotchange` binding (`onTriggerSlotChange`) ever sees
    // it.
    const button = document.createElement('button');
    button.slot = 'trigger';
    button.textContent = 'Trigger';
    const body = document.createElement('span');
    body.textContent = 'Body';
    const el = document.createElement('lr-popover') as LyraPopover;
    el.setAttribute('trigger', 'hover');
    el.setAttribute('style', '--lr-duration-base: 0ms');
    el.append(button, body);
    document.body.append(el);
    // Synchronously after connect: `renderRoot` already exists (created in the constructor,
    // before the first render), well before the browser can dispatch the initial event.
    let intercepted = 0;
    el.renderRoot!.addEventListener(
      'slotchange',
      (e) => {
        if (!isTriggerSlot(e)) return;
        intercepted++;
        e.stopImmediatePropagation();
      },
      { capture: true }
    );
    try {
      await el.updateComplete;
      // Give a real initial slotchange (queued around slot assignment) time to arrive and be
      // swallowed, so the assertions below only see whatever `firstUpdated()` alone collected.
      await waitUntil(() => intercepted > 0, 'the initial trigger slotchange arrived');
      await nextFrame();
      expect(
        intercepted,
        "a real browser does fire the trigger slot's initial slotchange -- this test suppresses it to reproduce happy-dom, which never fires it at all"
      ).to.equal(1);
      enter(button);
      await waitUntil(
        () => el.open,
        "firstUpdated() bound the slotted trigger's hover interaction, with no slotchange ever reaching the component's own listener"
      );
    } finally {
      el.remove();
    }
  });

  it('is idempotent: a real slotchange landing on top of the firstUpdated() collection does not double-bind the trigger', async () => {
    // No interception here -- both `firstUpdated()`'s own call and the real, un-suppressed
    // initial `slotchange` fire for the same assignment. The diagnostic listener below proves the
    // second (real) firing actually happened, so this test exercises the double-invocation path
    // it claims to, rather than accidentally passing because the browser only fired the event
    // once.
    const button = document.createElement('button');
    button.slot = 'trigger';
    button.textContent = 'Trigger';
    const body = document.createElement('span');
    body.textContent = 'Body';
    const el = document.createElement('lr-popover') as LyraPopover;
    el.setAttribute('trigger', 'hover');
    el.setAttribute('style', '--lr-duration-base: 0ms');
    el.append(button, body);
    document.body.append(el);
    let realTriggerSlotchangeCount = 0;
    el.renderRoot!.addEventListener(
      'slotchange',
      (e) => {
        if (isTriggerSlot(e)) realTriggerSlotchangeCount++;
      },
      { capture: true }
    );
    try {
      await el.updateComplete;
      await waitUntil(() => realTriggerSlotchangeCount > 0, 'the initial trigger slotchange arrived');
      expect(
        realTriggerSlotchangeCount,
        'the real initial slotchange must actually have fired for this to prove anything about double-invocation'
      ).to.be.greaterThan(0);
      // A double-bound `mouseenter`/`mouseleave` pair would still open and close correctly (both
      // handlers run the same idempotent transition request), so what a double-bind would
      // actually break is `unbindTriggerInteractions()` on close leaving one copy still attached
      // -- proven by a clean second open/close cycle finding the trigger in the same working
      // state as the first.
      enter(button);
      await waitUntil(() => el.open, 'hovering opens it');
      leave(button);
      await waitUntil(() => !el.open, 'leaving closes it');
      enter(button);
      await waitUntil(() => el.open, 'hovering opens it again identically on a second cycle');
      leave(button);
      await waitUntil(() => !el.open, 'leaving closes it again');
    } finally {
      el.remove();
    }
  });
});

/** Records pointer modality without an outside press that would light-dismiss an open surface:
 *  the recorder listens on the window, which a document-level dismissal listener never sees. */
const recordPointerPress = (): void => {
  window.dispatchEvent(new PointerEvent('pointerdown'));
};

const clickCenter = async (target: Element): Promise<void> => {
  const rect = target.getBoundingClientRect();
  await sendMouse({
    type: 'click',
    position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
  });
  await resetMouse();
};

describe('lr-popover focus keyword follows keyboard focus', () => {
  afterEach(async () => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    await resetMouse();
  });

  it('P1 opens on Tab without pulling focus, refuses pointer focus, and click-pins with autofocus', async () => {
    const el = await build('trigger="focus"', '<input autofocus aria-label="Inside field" />');
    const input = el.querySelector<HTMLInputElement>('input')!;
    await focusByKeyboard(triggerOf(el));
    await waitUntil(() => el.open, 'Tab opens it');
    await settlePointer();
    expect(document.activeElement === triggerOf(el)).to.equal(true, 'a focus open pulls no focus');
    (document.activeElement as HTMLElement).blur();
    await waitUntil(() => !el.open, 'blur closes it');

    await focusAfterPointer(triggerOf(el));
    await settlePointer();
    expect(el.open).to.equal(false, 'pointer-then-script focus does not open');
    triggerOf(el).blur();

    await clickCenter(triggerOf(el));
    await waitUntil(() => el.open, 'a real click opens it');
    await waitUntil(() => document.activeElement === input, 'the click-pinned open pulls [autofocus]');
    await el.hide();
  });

  it('P2 applies the same gate to a for-anchored trigger', async () => {
    const { el, trigger } = await buildFor('trigger="focus"');
    await focusByKeyboard(trigger);
    await waitUntil(() => el.open, 'Tab opens it');
    trigger.blur();
    await waitUntil(() => !el.open, 'blur closes it');
    await focusAfterPointer(trigger);
    await settlePointer();
    expect(el.open).to.equal(false, 'pointer-then-script focus does not open');
  });

  it('P3 keeps pointer focus inside open popup content retaining the surface', async () => {
    const el = await build('trigger="focus"', '<button>Inside</button>');
    await focusByKeyboard(triggerOf(el));
    await waitUntil(() => el.open, 'Tab opens it');
    recordPointerPress();
    el.querySelector<HTMLButtonElement>('button:not([slot])')!.focus();
    await settlePointer();
    expect(el.open).to.equal(true, 'content focus of any modality retains it');
  });

  it('P4 restores focus on a keyboard Escape without reopening', async () => {
    const el = await build('trigger="focus"');
    await focusByKeyboard(triggerOf(el));
    await waitUntil(() => el.open, 'Tab opens it');
    await sendKeys({ press: 'Escape' });
    await waitUntil(() => !el.open, 'Escape closes it');
    await settlePointer();
    // wait-reason: asserting focus restore does not reopen the popover
    await aTimeout(30);
    expect(document.activeElement === triggerOf(el)).to.equal(true, 'focus stays on the trigger');
    expect(el.open).to.equal(false, 'the restore does not reopen it');
  });

  it('P5 gates lr-dropdown the same way and click-opens with menu focus', async () => {
    const el = await fixture<LyraDropdown>(`<lr-dropdown trigger="focus" style="--lr-duration-base: 0ms">
      <button slot="trigger">Menu</button>
      <lr-dropdown-item>One</lr-dropdown-item>
    </lr-dropdown>`);
    const trigger = triggerOf(el as unknown as LyraPopover);
    const item = el.querySelector('lr-dropdown-item')!;
    await focusAfterPointer(trigger);
    await settlePointer();
    expect(el.open).to.equal(false, 'pointer-then-script focus does not open');
    trigger.blur();

    await focusByKeyboard(trigger);
    await waitUntil(() => el.open, 'Tab opens it');
    await settlePointer();
    expect(document.activeElement === trigger).to.equal(true, 'a focus open pulls no focus');
    trigger.blur();
    await waitUntil(() => !el.open, 'blur closes it');

    await clickCenter(trigger);
    await waitUntil(() => el.open, 'a real click opens it');
    await waitUntil(
      () => document.activeElement === item || item.contains(document.activeElement),
      'the click-pinned open focuses the active menu item'
    );
    await el.hide();
  });

  it('P6 does not let pointer focus cancel a pending hover close', async () => {
    const el = await build('trigger="hover focus" hide-delay="150"');
    enter(triggerOf(el));
    await waitUntil(() => el.open, 'hovering opens it');
    leave(triggerOf(el));
    recordPointerPress();
    triggerOf(el).focus();
    await waitUntil(() => !el.open, 'the pending close still ran', { timeout: 2000 });
    expect(el.open).to.equal(false, 'the pending close still ran');
  });
});

describe('mixed transient and click popover triggers', () => {
  for (const mode of ['hover click', 'click hover', 'focus click', 'click focus', 'hover focus click', 'click focus hover']) {
    for (const ownership of ['slotted', 'external']) {
      it(`${mode} ${ownership} pins a transient reveal without hiding or moving focus`, async () => {
        const external = ownership === 'external' ? await buildFor(`trigger="${mode}"`) : undefined;
        const el = external?.el ?? await build(`trigger="${mode}"`, '<button autofocus>Inside</button>');
        const button = external?.trigger ?? triggerOf(el);
        const outside = external?.outside ?? document.createElement('button');
        if (!external) el.parentElement!.append(outside);
        try {
          await focusByKeyboard(outside);
          if (mode.includes('hover')) enter(button);
          else await focusByKeyboard(button);
          await waitUntil(() => el.open, 'the transient interaction reveals the surface');
          const focusBefore = document.activeElement;
          let hides = 0;
          el.addEventListener('lr-hide', () => { hides += 1; });
          button.click();
          await settlePointer();
          expect(hides).to.equal(0, 'clicking transient content pins it without a hide lifecycle');
          expect(document.activeElement === focusBefore).to.equal(true, 'pinning does not steal focus');
          leave(button);
          await focusByKeyboard(outside);
          await settlePointer();
          expect(el.open).to.equal(true, 'the pin survives pointer leave and focus departure');
          button.click();
          await waitUntil(() => !el.open, 'the second click closes the pinned surface');
          expect(hides).to.equal(1);
        } finally {
          if (!external) outside.remove();
        }
      });
    }
  }

  it('a click opening a closed mixed surface survives pointer leave and focus departure', async () => {
    const { el, trigger, outside } = await buildFor('trigger="hover focus click"');
    trigger.click();
    await waitUntil(() => el.open, 'the click opens it');
    leave(trigger);
    await focusByKeyboard(outside);
    await settlePointer();
    expect(el.open).to.equal(true);
    trigger.click();
    await waitUntil(() => !el.open, 'the next click closes it');
  });

  it('pinning cancels a hide already waiting for its delay', async () => {
    const el = await build('trigger="hover click" hide-delay="100"');
    enter(triggerOf(el));
    await waitUntil(() => el.open, 'hover opens it');
    leave(triggerOf(el));
    triggerOf(el).click();
    // wait-reason: hide-delay (100ms) must elapse to prove the pin canceled the hide
    await aTimeout(180);
    expect(el.open).to.equal(true, 'the delayed hide was canceled by the explicit pin');
  });

  for (const refusal of ['veto', 'disabled']) {
    it(`a ${refusal} click opening does not pin the next transient reveal`, async () => {
      const el = await build(`trigger="hover" ${refusal === 'disabled' ? 'disabled' : ''}`);
      const veto = (event: Event): void => { event.preventDefault(); };
      if (refusal === 'veto') el.addEventListener('lr-show', veto);
      triggerOf(el).click();
      await settlePointer();
      expect(el.open).to.equal(false);
      el.removeEventListener('lr-show', veto);
      el.disabled = false;
      await el.updateComplete;
      enter(triggerOf(el));
      await waitUntil(() => el.open, 'a later hover successfully opens');
      leave(triggerOf(el));
      await waitUntil(() => !el.open, 'that unpinned reveal closes when the pointer leaves');
    });
  }

  it('a vetoed hide keeps the existing pin until a later dismissal succeeds', async () => {
    const el = await build('trigger="hover click"');
    const veto = (event: Event): void => { event.preventDefault(); };
    triggerOf(el).click();
    await waitUntil(() => el.open, 'click opens pinned');
    el.addEventListener('lr-hide', veto);
    triggerOf(el).click();
    await settlePointer();
    expect(el.open).to.equal(true);
    el.removeEventListener('lr-hide', veto);
    leave(triggerOf(el));
    await settlePointer();
    expect(el.open).to.equal(true, 'refusing to close preserves explicit pin ownership');
    triggerOf(el).click();
    await waitUntil(() => !el.open, 'the next allowed click dismisses it');
  });

  it('a mixed dropdown focus reveal pins without moving focus to its menu', async () => {
    const el = await fixture<LyraDropdown>(`<lr-dropdown trigger="focus click" style="--lr-duration-base: 0ms">
      <button slot="trigger">Trigger</button><lr-menu><lr-menu-item>Item</lr-menu-item></lr-menu>
    </lr-dropdown>`);
    const button = triggerOf(el);
    await focusByKeyboard(button);
    await waitUntil(() => el.open, 'focus reveals the dropdown');
    button.click();
    await settlePointer();
    expect(el.open).to.equal(true);
    expect(document.activeElement === button).to.equal(true, 'pinning retains trigger focus');
    button.click();
    await waitUntil(() => !el.open, 'another click dismisses the dropdown');
  });
});

describe('mixed pinned popover dismissal', () => {
  it('Escape dismisses a pinned focus/click surface without reopening on restored focus', async () => {
    const el = await build('trigger="focus click"');
    await focusByKeyboard(triggerOf(el));
    await waitUntil(() => el.open, 'keyboard focus reveals it');
    triggerOf(el).click();
    await sendKeys({ press: 'Escape' });
    await waitUntil(() => !el.open, 'Escape dismisses the pinned surface');
    await settlePointer();
    expect(el.open).to.equal(false);
    expect(document.activeElement === triggerOf(el)).to.equal(true);
  });

  it('an outside pointer press dismisses a pinned mixed surface', async () => {
    const { el, trigger, outside } = await buildFor('trigger="hover focus click"');
    enter(trigger);
    await waitUntil(() => el.open, 'hover reveals it');
    trigger.click();
    try {
      const rect = outside.getBoundingClientRect();
      await sendMouse({ type: 'click', position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)] });
      await waitUntil(() => !el.open, 'an outside click dismisses the pinned surface');
    } finally {
      await resetMouse();
    }
  });
});

it('a real hover/click gesture pins mixed popover content without focusing its autofocus target', async () => {
  const el = await build('trigger="hover focus click"', '<button autofocus>Inside</button>');
  const button = triggerOf(el);
  const inside = el.querySelector<HTMLButtonElement>('button[autofocus]')!;
  let hides = 0;
  el.addEventListener('lr-hide', () => { hides += 1; });
  try {
    await hoverUntilMatched(button, 'the real pointer opens the mixed surface');
    await waitUntil(() => el.open, 'hover reveals content');
    const rect = button.getBoundingClientRect();
    await sendMouse({ type: 'click', position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)] });
    await settlePointer();
    expect(el.open).to.equal(true);
    expect(hides).to.equal(0);
    expect(document.activeElement === inside).to.equal(false, 'pinning does not run pending autofocus');
    await sendMouse({ type: 'move', position: [0, 0] });
    await settlePointer();
    expect(el.open).to.equal(true, 'the explicit pin survives real pointer departure');
    button.click();
    await waitUntil(() => !el.open, 'the next activation dismisses it');
  } finally {
    await resetMouse();
  }
});

it('ignores unrelated document mutations for an unchanged for trigger', async () => {
  const wrapper = await fixture<HTMLElement>(
    '<div><button id="idle-identity-popover-trigger">Open</button><lr-popover for="idle-identity-popover-trigger">Details</lr-popover></div>',
  );
  const el = wrapper.querySelector('lr-popover') as LyraPopover;
  await el.updateComplete;
  const internals = el as unknown as { syncTriggerA11y(): void };
  const original = internals.syncTriggerA11y;
  let syncs = 0;
  internals.syncTriggerA11y = function (this: LyraPopover) {
    syncs += 1;
    original.call(this);
  };
  wrapper.append(document.createElement('span'));
  await new Promise((resolve) => requestAnimationFrame(resolve));
  expect(syncs).to.equal(0);
});

it('closes a hover-opened popover when a re-render replaces its for trigger away from the pointer', async () => {
  const wrapper = await fixture<HTMLElement>(
    '<div><button id="recycled-popover-trigger">Profile</button><lr-popover for="recycled-popover-trigger" trigger="hover" show-delay="0" hide-delay="0" style="--lr-duration-base: 0ms">Card</lr-popover></div>',
  );
  const popover = wrapper.querySelector('lr-popover') as LyraPopover;
  const trigger = wrapper.querySelector<HTMLButtonElement>('#recycled-popover-trigger')!;
  await popover.updateComplete;
  try {
    const box = trigger.getBoundingClientRect();
    await sendMouse({ type: 'move', position: [Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2)] });
    await waitUntil(() => popover.open, 'the popover opens on hover');
    const fresh = document.createElement('button');
    fresh.id = 'recycled-popover-trigger';
    fresh.textContent = 'Profile';
    fresh.style.marginBlockStart = '300px';
    trigger.replaceWith(fresh);
    await waitUntil(() => !popover.open, 'the popover closes when its trigger is swapped away', { timeout: 2000 });
  } finally {
    await resetMouse();
  }
});
