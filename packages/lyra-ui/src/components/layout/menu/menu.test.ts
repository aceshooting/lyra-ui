import { fixture, expect, oneEvent, html } from '@open-wc/testing';
import './menu.js';
import './menu-item.js';
import '../../forms/button/button.js';
import '../../forms/icon-button/icon-button.js';
import type { LyraMenu } from './menu.js';
import type { LyraMenuItem } from './menu-item.js';
import type { LyraButton } from '../../forms/button/button.js';
import type { LyraIconButton } from '../../forms/icon-button/icon-button.js';

const basic = () => html`
  <lr-menu label="Row actions">
    <button slot="trigger" aria-label="Row actions">⋮</button>
    <lr-menu-item value="rename">Rename</lr-menu-item>
    <lr-menu-item value="duplicate">Duplicate</lr-menu-item>
    <hr />
    <lr-menu-item value="delete" destructive>Delete</lr-menu-item>
  </lr-menu>
`;

function trigger(el: LyraMenu): HTMLButtonElement {
  return el.querySelector('button[slot="trigger"]') as HTMLButtonElement;
}

function items(el: LyraMenu): LyraMenuItem[] {
  return [...el.querySelectorAll('lr-menu-item')] as LyraMenuItem[];
}

function list(el: LyraMenu): HTMLElement {
  return el.shadowRoot!.querySelector('[part="list"]') as HTMLElement;
}

it('renders role="menu" around the default slot, and reflects open=false by default', async () => {
  const el = (await fixture(basic())) as LyraMenu;
  expect(el.open).to.be.false;
  expect(el.hasAttribute('open')).to.be.false;
  expect(list(el).getAttribute('role')).to.equal('menu');
  expect(items(el).length).to.equal(3);
});

it('sets aria-haspopup/aria-expanded/aria-controls on the assigned trigger element', async () => {
  const el = (await fixture(basic())) as LyraMenu;
  const btn = trigger(el);
  expect(el.id).to.not.equal('');
  expect(btn.getAttribute('aria-haspopup')).to.equal('menu');
  expect(btn.getAttribute('aria-expanded')).to.equal('false');
  expect(btn.getAttribute('aria-controls')).to.equal(el.id);
  if ('ariaControlsElements' in btn) {
    expect(btn.ariaControlsElements.length).to.equal(1);
    expect(btn.ariaControlsElements[0]?.id).to.equal(el.id);
  }

  btn.click();
  await el.updateComplete;
  expect(btn.getAttribute('aria-expanded')).to.equal('true');
});

it('preserves a consumer-supplied host id as the aria-controls target', async () => {
  const el = (await fixture(html`
    <lr-menu id="account-actions" label="Account actions">
      <button slot="trigger">Actions</button>
      <lr-menu-item value="profile">Profile</lr-menu-item>
    </lr-menu>
  `)) as LyraMenu;
  expect(el.id).to.equal('account-actions');
  expect(trigger(el).getAttribute('aria-controls')).to.equal('account-actions');
});

it('forwards menu trigger semantics to lr-button\'s focused native control', async () => {
  const el = (await fixture(html`
    <lr-menu label="Actions">
      <lr-button slot="trigger" aria-label="Actions">Actions</lr-button>
      <lr-menu-item value="rename">Rename</lr-menu-item>
    </lr-menu>
  `)) as LyraMenu;
  const triggerButton = el.querySelector('lr-button') as LyraButton;
  await triggerButton.updateComplete;
  const focusedControl = triggerButton.shadowRoot!.querySelector('button[part="base"]') as HTMLButtonElement;

  expect(triggerButton.getAttribute('aria-haspopup')).to.equal('menu');
  expect(triggerButton.getAttribute('aria-expanded')).to.equal('false');
  expect(focusedControl.getAttribute('aria-haspopup')).to.equal('menu');
  expect(focusedControl.getAttribute('aria-expanded')).to.equal('false');
  if ('ariaControlsElements' in focusedControl) {
    expect(focusedControl.ariaControlsElements.length).to.equal(1);
    expect(focusedControl.ariaControlsElements[0]?.id).to.equal(el.id);
  } else {
    expect(focusedControl.getAttribute('aria-controls')).to.equal(el.id);
  }

  triggerButton.click();
  await el.updateComplete;
  await triggerButton.updateComplete;
  expect(focusedControl.getAttribute('aria-expanded')).to.equal('true');
  await expect(el).to.be.accessible();
});

it('forwards menu trigger semantics to lr-icon-button\'s focused native control', async () => {
  const el = (await fixture(html`
    <lr-menu label="Actions">
      <lr-icon-button slot="trigger" icon="more-horizontal" aria-label="Actions"></lr-icon-button>
      <lr-menu-item value="rename">Rename</lr-menu-item>
    </lr-menu>
  `)) as LyraMenu;
  const triggerButton = el.querySelector('lr-icon-button') as LyraIconButton;
  await triggerButton.updateComplete;
  const focusedControl = triggerButton.shadowRoot!.querySelector('button[part="button"]') as HTMLButtonElement;

  expect(triggerButton.getAttribute('aria-haspopup')).to.equal('menu');
  expect(triggerButton.getAttribute('aria-expanded')).to.equal('false');
  expect(focusedControl.getAttribute('aria-haspopup')).to.equal('menu');
  expect(focusedControl.getAttribute('aria-expanded')).to.equal('false');
  if ('ariaControlsElements' in focusedControl) {
    expect(focusedControl.ariaControlsElements.length).to.equal(1);
    expect(focusedControl.ariaControlsElements[0]?.id).to.equal(el.id);
  } else {
    expect(focusedControl.getAttribute('aria-controls')).to.equal(el.id);
  }

  triggerButton.click();
  await el.updateComplete;
  await triggerButton.updateComplete;
  expect(focusedControl.getAttribute('aria-expanded')).to.equal('true');
  await expect(el).to.be.accessible();
});

it('opens on trigger click and moves focus to the first item', async () => {
  const el = (await fixture(basic())) as LyraMenu;
  trigger(el).click();
  await el.updateComplete;
  expect(el.open).to.be.true;
  expect(document.activeElement).to.equal(items(el)[0]);
});

it('closes on a second trigger click', async () => {
  const el = (await fixture(basic())) as LyraMenu;
  const btn = trigger(el);
  btn.click();
  await el.updateComplete;
  expect(el.open).to.be.true;

  btn.click();
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('opens with focus on the first item via ArrowDown on the trigger', async () => {
  const el = (await fixture(basic())) as LyraMenu;
  trigger(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(el.open).to.be.true;
  expect(document.activeElement).to.equal(items(el)[0]);
});

it('opens with focus on the last item via ArrowUp on the trigger', async () => {
  const el = (await fixture(basic())) as LyraMenu;
  trigger(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(el.open).to.be.true;
  expect(document.activeElement).to.equal(items(el)[2]);
});

it('gives the roving-focused item tabIndex 0 and every other item -1', async () => {
  const el = (await fixture(basic())) as LyraMenu;
  trigger(el).click();
  await el.updateComplete;
  const [first, second, third] = items(el);
  expect(first.tabIndex).to.equal(0);
  expect(second.tabIndex).to.equal(-1);
  expect(third.tabIndex).to.equal(-1);
});

it('moves the roving focus with ArrowDown/ArrowUp, wrapping past either end', async () => {
  const el = (await fixture(basic())) as LyraMenu;
  trigger(el).click();
  await el.updateComplete;
  const [first, second, third] = items(el);
  expect(document.activeElement).to.equal(first);

  (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(document.activeElement).to.equal(second);

  (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(document.activeElement).to.equal(third);

  // Wraps past the last item back to the first.
  (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(document.activeElement).to.equal(first);

  // Wraps backward past the first item to the last.
  (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(document.activeElement).to.equal(third);
});

it('Home/End jump to the first/last item', async () => {
  const el = (await fixture(basic())) as LyraMenu;
  trigger(el).click();
  await el.updateComplete;
  const [first, , third] = items(el);

  (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(document.activeElement).to.equal(third);

  (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(document.activeElement).to.equal(first);
});

it('selects the active item with Enter and closes, refocusing the trigger', async () => {
  const el = (await fixture(basic())) as LyraMenu;
  const btn = trigger(el);
  btn.click();
  await el.updateComplete;

  setTimeout(() =>
    (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })),
  );
  const ev = await oneEvent(el, 'lr-menu-select');
  expect(ev.detail).to.deep.equal({ value: 'rename' });
  expect(el.open).to.be.false;
  expect(document.activeElement).to.equal(btn);
});

it('selects the active item with Space, same as Enter', async () => {
  const el = (await fixture(basic())) as LyraMenu;
  trigger(el).click();
  await el.updateComplete;

  setTimeout(() =>
    (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })),
  );
  const ev = await oneEvent(el, 'lr-menu-select');
  expect(ev.detail).to.deep.equal({ value: 'rename' });
});

it('clicking an item fires the consolidated lr-menu-select and closes the menu', async () => {
  const el = (await fixture(basic())) as LyraMenu;
  trigger(el).click();
  await el.updateComplete;

  setTimeout(() => items(el)[1].shadowRoot!.querySelector('[part="base"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true })));
  const ev = await oneEvent(el, 'lr-menu-select');
  expect(ev.detail).to.deep.equal({ value: 'duplicate' });
  expect(el.open).to.be.false;
});

it('never leaks the item\'s own lr-menu-item-select past the menu alongside the consolidated lr-menu-select', async () => {
  const el = (await fixture(basic())) as LyraMenu;
  trigger(el).click();
  await el.updateComplete;

  const events: CustomEvent[] = [];
  el.addEventListener('lr-menu-item-select', (e) => events.push(e as CustomEvent));
  items(el)[1].shadowRoot!.querySelector('[part="base"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(
    events.length,
    'the item\'s own lr-menu-item-select must never reach a listener on <lr-menu> -- only the consolidated lr-menu-select is the documented contract',
  ).to.equal(0);
});

it('skips a disabled item during ArrowDown navigation', async () => {
  const el = (await fixture(html`
    <lr-menu>
      <button slot="trigger" aria-label="Actions">⋮</button>
      <lr-menu-item value="a">A</lr-menu-item>
      <lr-menu-item value="b" disabled>B</lr-menu-item>
      <lr-menu-item value="c">C</lr-menu-item>
    </lr-menu>
  `)) as LyraMenu;
  trigger(el).click();
  await el.updateComplete;
  const [a, , c] = items(el);
  expect(document.activeElement).to.equal(a);

  (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(document.activeElement).to.equal(c);
});

/**
 * The `expect(document.activeElement).to.equal(item)` idiom used elsewhere in this file is
 * unusable for a test that could plausibly assert against a *focus-loss* regression: on failure
 * the actual value would be `<body>`, and chai stringifies that actual value to build its
 * message, serializing the entire test page (mocha's own reporter DOM included) into one string.
 * That wedges the test runner into a 180s timeout instead of producing a failure. Comparing a
 * short stable identity keeps the failure readable ("expected 'body' to equal 'item:a'") and is
 * strictly more informative than an element-identity diff.
 */
function activeItemValue(): string {
  const active = document.activeElement as (HTMLElement & { value?: string }) | null;
  if (!active) return 'none';
  return active.tagName === 'LR-MENU-ITEM' ? `item:${active.value}` : active.tagName.toLowerCase();
}

it('moves roving focus when the active item becomes disabled or hidden', async () => {
  const el = (await fixture(html`
    <lr-menu>
      <button slot="trigger" aria-label="Actions">⋮</button>
      <lr-menu-item value="a">A</lr-menu-item>
      <lr-menu-item value="b">B</lr-menu-item>
      <lr-menu-item value="c">C</lr-menu-item>
    </lr-menu>
  `)) as LyraMenu;
  trigger(el).click();
  await el.updateComplete;
  const [a, b, c] = items(el);
  expect(activeItemValue()).to.equal('item:a');

  a.disabled = true;
  await a.updateComplete;
  await el.updateComplete;
  expect(activeItemValue()).to.equal('item:b');
  expect(b.tabIndex).to.equal(0);

  b.hidden = true;
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  await el.updateComplete;
  expect(activeItemValue()).to.equal('item:c');
  expect(c.tabIndex).to.equal(0);
});

// Dynamic *membership* changes (items added/removed/reordered while the menu
// is open), as distinct from the dynamic *attribute* state (disabled/hidden)
// the MutationObserver above covers. `activeIndex` is a positional index into
// an array rebuilt from scratch on every `slotchange`, so it must be
// re-resolved by *identity* -- a bounds check alone silently repoints it at a
// different item (or drops it entirely) whenever the list shifts underneath.
const abc = () => html`
  <lr-menu>
    <button slot="trigger" aria-label="Actions">⋮</button>
    <lr-menu-item value="a">A</lr-menu-item>
    <lr-menu-item value="b">B</lr-menu-item>
    <lr-menu-item value="c">C</lr-menu-item>
  </lr-menu>
`;

// slotchange is queued as a microtask, so it lands after `updateComplete`'s
// own microtask -- mirrors the `hidden` half of the disabled/hidden test above.
async function afterSlotChange(el: LyraMenu): Promise<void> {
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  await el.updateComplete;
}

it('keeps the roving focus on the active item when it is reordered while the menu is open', async () => {
  const el = (await fixture(abc())) as LyraMenu;
  trigger(el).click();
  await el.updateComplete;
  const [a, b] = items(el);
  expect(activeItemValue()).to.equal('item:a');

  // Moving the node re-inserts it (blurring it in the process) at the end.
  el.appendChild(a);
  await afterSlotChange(el);

  // `a` is still the user's position and still exists -- only its index moved.
  // Without identity re-resolution activeIndex stays 0 (which is now `b`), so
  // the `activeIndex === -1` catch-up never fires and nothing restores the
  // focus the move dropped: focus is left on <body> and the menu is
  // keyboard-dead -- ArrowDown can't even reach the list's keydown handler.
  expect(activeItemValue()).to.equal('item:a');
  expect(a.tabIndex).to.equal(0);
  expect(b.tabIndex).to.equal(-1);

  // Order is now B, C, A -- so ArrowDown from the last item wraps to B.
  (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(activeItemValue()).to.equal('item:b');
});

it('keeps the roving tabindex and Arrow nav aligned when an item is prepended above the active one while open', async () => {
  const el = (await fixture(abc())) as LyraMenu;
  trigger(el).click();
  await el.updateComplete;
  const [a] = items(el);
  expect(activeItemValue()).to.equal('item:a');

  const fresh = document.createElement('lr-menu-item');
  fresh.value = 'fresh';
  fresh.textContent = 'Fresh';
  el.insertBefore(fresh, a);
  await afterSlotChange(el);

  // Focus legitimately stays on `a` here (nothing moved it), but activeIndex
  // still reads 0 -- which is now `fresh`. That desyncs two things at once:
  // Tab would enter the menu at `fresh` rather than at the focused row...
  expect(activeItemValue()).to.equal('item:a');
  expect(a.tabIndex).to.equal(0);
  expect(fresh.tabIndex).to.equal(-1);

  // ...and ArrowDown computes its next item from `fresh`, landing back on `a`
  // and swallowing the keypress instead of advancing to `b`.
  (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(activeItemValue()).to.equal('item:b');
});

it('keeps the roving focus put when an item above the active one is removed while open', async () => {
  const el = (await fixture(abc())) as LyraMenu;
  trigger(el).click();
  await el.updateComplete;
  const [a, b, c] = items(el);

  (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(activeItemValue()).to.equal('item:c');

  a.remove();
  await afterSlotChange(el);

  // `c` still exists and is still where the user was. The bounds check alone
  // resets activeIndex to -1 (2 >= 2), which then re-runs the open-from-start
  // catch-up and yanks focus backward to the first item.
  expect(activeItemValue()).to.equal('item:c');
  expect(c.tabIndex).to.equal(0);
  expect(b.tabIndex).to.equal(-1);
});

it('falls back to the first item when the active item itself is removed while open', async () => {
  const el = (await fixture(abc())) as LyraMenu;
  trigger(el).click();
  await el.updateComplete;
  const [a, b] = items(el);
  expect(activeItemValue()).to.equal('item:a');

  a.remove();
  await afterSlotChange(el);

  // The mirror image of the three cases above: identity re-resolution finds
  // nothing, so the existing focusRoving() fallback must still apply. Today
  // the bounds check misses this too -- activeIndex 0 is still in range, so it
  // silently repoints at `b` without ever restoring the focus removal dropped,
  // leaving the menu just as keyboard-dead as the reorder case.
  expect(activeItemValue()).to.equal('item:b');
  expect(b.tabIndex).to.equal(0);
});

it('closes on Escape and returns focus to the trigger', async () => {
  const el = (await fixture(basic())) as LyraMenu;
  const btn = trigger(el);
  btn.click();
  await el.updateComplete;
  expect(el.open).to.be.true;

  (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(el.open).to.be.false;
  expect(document.activeElement).to.equal(btn);
});

it('closes on a pointerdown outside the trigger and popup, without refocusing the trigger', async () => {
  const el = (await fixture(basic())) as LyraMenu;
  el.open = true;
  await el.updateComplete;
  expect(el.open).to.be.true;

  document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('fires lr-show/lr-hide when `open` is set directly, bypassing click/keyboard', async () => {
  const el = (await fixture(basic())) as LyraMenu;
  await el.updateComplete;

  setTimeout(() => {
    el.open = true;
  });
  await oneEvent(el, 'lr-show');
  expect(el.open).to.be.true;

  setTimeout(() => {
    el.open = false;
  });
  await oneEvent(el, 'lr-hide');
  expect(el.open).to.be.false;
});

it('does not fire lr-show/lr-hide for markup that renders open from the start', async () => {
  const el = (await fixture(html`
    <lr-menu open>
      <button slot="trigger">⋮</button>
      <lr-menu-item value="a">A</lr-menu-item>
    </lr-menu>
  `)) as LyraMenu;
  let fired = false;
  el.addEventListener('lr-show', () => (fired = true));
  await el.updateComplete;
  expect(fired).to.be.false;
});

it('positions the popup and moves focus even when declared open from the start (trigger/item slotchange races Lit\'s first update)', async () => {
  const el = (await fixture(html`
    <lr-menu open>
      <button slot="trigger">⋮</button>
      <lr-menu-item value="a">A</lr-menu-item>
      <lr-menu-item value="b">B</lr-menu-item>
    </lr-menu>
  `)) as LyraMenu;
  const popup = el.shadowRoot!.querySelector('[part="popup"]') as HTMLElement;
  expect(popup.style.position).to.equal('fixed');
  expect(document.activeElement).to.equal(items(el)[0]);
});

it('positions the popup relative to the trigger element via place()', async () => {
  const el = (await fixture(basic())) as LyraMenu;
  trigger(el).click();
  await el.updateComplete;
  const popup = el.shadowRoot!.querySelector('[part="popup"]') as HTMLElement;
  expect(popup.style.position).to.equal('fixed');
});

async function waitFor<T>(read: () => T, until: (v: T) => boolean, timeoutMs = 2000): Promise<T> {
  const start = performance.now();
  for (;;) {
    const v = read();
    if (until(v)) return v;
    if (performance.now() - start > timeoutMs) throw new Error(`waitFor timed out after ${timeoutMs}ms`);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  }
}

it('resolves an explicit left/right placement through rtlAwarePlacement, mirroring under dir="rtl"', async () => {
  const rtlWrap = await fixture(html`
    <div dir="rtl" style="position: relative;">
      <lr-menu placement="left-start">
        <button slot="trigger" style="position:absolute; top:100px; left:100px;">⋮</button>
        <lr-menu-item value="a">A</lr-menu-item>
      </lr-menu>
    </div>
  `);
  const rtlEl = rtlWrap.querySelector('lr-menu') as LyraMenu;
  trigger(rtlEl).click();
  await rtlEl.updateComplete;
  const rtlPopup = rtlEl.shadowRoot!.querySelector('[part="popup"]') as HTMLElement;
  await waitFor(
    () => rtlPopup.style.left,
    (left) => left !== '',
  );

  const ltrWrap = await fixture(html`
    <div style="position: relative;">
      <lr-menu placement="right-start">
        <button slot="trigger" style="position:absolute; top:100px; left:100px;">⋮</button>
        <lr-menu-item value="a">A</lr-menu-item>
      </lr-menu>
    </div>
  `);
  const ltrEl = ltrWrap.querySelector('lr-menu') as LyraMenu;
  trigger(ltrEl).click();
  await ltrEl.updateComplete;
  const ltrPopup = ltrEl.shadowRoot!.querySelector('[part="popup"]') as HTMLElement;
  await waitFor(
    () => ltrPopup.style.left,
    (left) => left !== '',
  );

  expect(rtlPopup.style.left).to.equal(ltrPopup.style.left);
  expect(rtlPopup.style.top).to.equal(ltrPopup.style.top);
});

it('repositions the popup when placement changes while already open, instead of keeping the stale computePosition subscription', async () => {
  const wrap = await fixture(html`
    <div style="position: relative;">
      <lr-menu placement="bottom-start">
        <button slot="trigger" style="position:absolute; top:100px; left:100px;">⋮</button>
        <lr-menu-item value="a">A</lr-menu-item>
      </lr-menu>
    </div>
  `);
  const el = wrap.querySelector('lr-menu') as LyraMenu;
  trigger(el).click();
  await el.updateComplete;
  const popup = el.shadowRoot!.querySelector('[part="popup"]') as HTMLElement;
  await waitFor(
    () => popup.style.top,
    (top) => top !== '',
  );
  const bottomTop = popup.style.top;

  el.placement = 'top-start';
  await el.updateComplete;
  await waitFor(
    () => popup.style.top,
    (top) => top !== '' && top !== bottomTop,
  );

  expect(popup.style.top).to.not.equal(bottomTop);
});

it('resets `open` to false on disconnect, so a reconnect (drag-drop reparent) starts closed rather than stuck open', async () => {
  const el = (await fixture(basic())) as LyraMenu;
  trigger(el).click();
  await el.updateComplete;
  expect(el.open).to.be.true;

  const parent = el.parentElement!;
  el.remove();
  parent.appendChild(el);
  await el.updateComplete;
  // `disconnectedCallback()` resets `open` to `false` -- asserting that
  // directly is what actually distinguishes the fix from the pre-fix bug,
  // where `open` stayed `true` across the reconnect and a subsequent
  // document pointerdown no longer closed the (visually stuck-open) menu.
  expect(el.open).to.be.false;

  document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('resyncs the roving activeIndex when focus lands on an item outside setActiveItem (e.g. a disabled item via mousedown)', async () => {
  const el = (await fixture(html`
    <lr-menu>
      <button slot="trigger" aria-label="Actions">⋮</button>
      <lr-menu-item value="a">A</lr-menu-item>
      <lr-menu-item value="b" disabled>B</lr-menu-item>
      <lr-menu-item value="c">C</lr-menu-item>
    </lr-menu>
  `)) as LyraMenu;
  trigger(el).click();
  await el.updateComplete;
  const [a, b] = items(el);
  expect(document.activeElement).to.equal(a);

  // A real mousedown-driven focus lands directly on the disabled item --
  // tabIndex="-1" remains mouse-focusable per spec -- bypassing setActiveItem().
  b.focus();
  expect(document.activeElement).to.equal(b);
  await el.updateComplete;

  // Without the focusin resync, activeIndex would still be stuck on `a`'s
  // stale position, so ArrowDown here would jump to `c` instead of wrapping
  // back around to `a` (the only navigable item after the unresolvable `b`).
  (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(document.activeElement).to.equal(a);
});

it('closes on Tab without preventing the default focus-advance behavior', async () => {
  const el = (await fixture(basic())) as LyraMenu;
  trigger(el).click();
  await el.updateComplete;
  expect(el.open).to.be.true;

  const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  (document.activeElement as HTMLElement).dispatchEvent(ev);
  await el.updateComplete;
  expect(el.open).to.be.false;
  // Unlike Escape, Tab must NOT call e.preventDefault() -- the browser's own
  // native focus advance still has to run.
  expect(ev.defaultPrevented).to.be.false;
});

it('jumps the roving focus with type-ahead to the next non-disabled item whose text starts with the typed letter', async () => {
  const el = (await fixture(basic())) as LyraMenu;
  trigger(el).click();
  await el.updateComplete;
  const [, duplicate] = items(el); // Rename, Duplicate, Delete

  (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'd', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(document.activeElement).to.equal(duplicate);
});

it('accumulates the type-ahead buffer across quick keystrokes to narrow the match', async () => {
  const el = (await fixture(basic())) as LyraMenu;
  trigger(el).click();
  await el.updateComplete;
  const [, , destroy] = items(el); // Rename, Duplicate, Delete

  (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'd', bubbles: true, cancelable: true }));
  await el.updateComplete;
  (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(document.activeElement).to.equal(destroy);
});

it('skips a disabled item during type-ahead even when its text would otherwise match', async () => {
  const el = (await fixture(html`
    <lr-menu>
      <button slot="trigger" aria-label="Actions">⋮</button>
      <lr-menu-item value="a">Apple</lr-menu-item>
      <lr-menu-item value="b" disabled>Banana</lr-menu-item>
      <lr-menu-item value="c">Blueberry</lr-menu-item>
    </lr-menu>
  `)) as LyraMenu;
  trigger(el).click();
  await el.updateComplete;
  const [, , blueberry] = items(el);

  (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(document.activeElement).to.equal(blueberry);
});

it('skips a hidden or aria-hidden item during type-ahead even when its text would otherwise match', async () => {
  const el = (await fixture(html`
    <lr-menu>
      <button slot="trigger" aria-label="Actions">⋮</button>
      <lr-menu-item value="a">Apple</lr-menu-item>
      <lr-menu-item value="b" hidden>Banana</lr-menu-item>
      <lr-menu-item value="c" aria-hidden="true">Berry</lr-menu-item>
      <lr-menu-item value="d">Blueberry</lr-menu-item>
    </lr-menu>
  `)) as LyraMenu;
  trigger(el).click();
  await el.updateComplete;
  const [, , , blueberry] = items(el);

  (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(document.activeElement).to.equal(blueberry);
});

it('does not intercept Arrow/Home/End/Escape from a non-LyraMenuItem child slotted into the default slot', async () => {
  const el = (await fixture(html`
    <lr-menu label="Row actions">
      <button slot="trigger" aria-label="Row actions">⋮</button>
      <lr-menu-item value="rename">Rename</lr-menu-item>
      <lr-menu-item value="duplicate">Duplicate</lr-menu-item>
      <input type="text" />
    </lr-menu>
  `)) as LyraMenu;
  const input = el.querySelector('input') as HTMLInputElement;
  el.show();
  await el.updateComplete;
  input.focus();
  const before = (el as unknown as { activeIndex: number }).activeIndex;
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect((el as unknown as { activeIndex: number }).activeIndex).to.equal(before);
  expect(el.open).to.be.true; // Escape from this same non-item target is exercised separately below
});

it('still intercepts Arrow/Home/End/Escape from a real LyraMenuItem target (unchanged)', async () => {
  const el = (await fixture(html`
    <lr-menu label="Row actions">
      <button slot="trigger" aria-label="Row actions">⋮</button>
      <lr-menu-item value="rename">Rename</lr-menu-item>
      <lr-menu-item value="duplicate">Duplicate</lr-menu-item>
    </lr-menu>
  `)) as LyraMenu;
  el.show();
  await el.updateComplete;
  const menuItems = items(el);
  menuItems[0]!.focus();
  menuItems[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect((el as unknown as { activeIndex: number }).activeIndex).to.equal(1);
});

it('does not close on Escape from slotted non-item content when closeOnEscapeAnywhere is unset (default)', async () => {
  const el = (await fixture(html`
    <lr-menu label="Row actions">
      <button slot="trigger" aria-label="Row actions">⋮</button>
      <lr-menu-item value="rename">Rename</lr-menu-item>
      <input type="text" />
    </lr-menu>
  `)) as LyraMenu;
  const input = el.querySelector('input') as HTMLInputElement;
  el.open = true;
  await el.updateComplete;
  input.focus();

  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(el.open).to.be.true;
});

it('closes and refocuses the trigger on Escape from slotted non-item content when closeOnEscapeAnywhere is true', async () => {
  const el = (await fixture(html`
    <lr-menu label="Row actions" close-on-escape-anywhere>
      <button slot="trigger" aria-label="Row actions">⋮</button>
      <lr-menu-item value="rename">Rename</lr-menu-item>
      <input type="text" />
    </lr-menu>
  `)) as LyraMenu;
  const btn = trigger(el);
  const input = el.querySelector('input') as HTMLInputElement;
  el.open = true;
  await el.updateComplete;
  input.focus();

  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(el.open).to.be.false;
  expect(document.activeElement).to.equal(btn);
});

it('still gives Arrow/Home/End/Enter/Space full default behavior from slotted non-item content even when closeOnEscapeAnywhere is true', async () => {
  const el = (await fixture(html`
    <lr-menu label="Row actions" close-on-escape-anywhere>
      <button slot="trigger" aria-label="Row actions">⋮</button>
      <lr-menu-item value="rename">Rename</lr-menu-item>
      <lr-menu-item value="duplicate">Duplicate</lr-menu-item>
      <input type="text" />
    </lr-menu>
  `)) as LyraMenu;
  const input = el.querySelector('input') as HTMLInputElement;
  el.open = true;
  await el.updateComplete;
  input.focus();
  const before = (el as unknown as { activeIndex: number }).activeIndex;

  for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' ']) {
    input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  }
  await el.updateComplete;
  // Neither the roving focus nor the open state moved -- confirms Enter/Space
  // didn't reach current?.select() (which would also close the menu), and
  // Arrow/Home/End didn't reach setActiveItem() -- only the Escape path was
  // widened by closeOnEscapeAnywhere, not the instanceof LyraMenuItem guard.
  expect((el as unknown as { activeIndex: number }).activeIndex).to.equal(before);
  expect(el.open).to.be.true;
});

it('defaults the list accessible name to "Menu", overridable via label', async () => {
  const withoutLabel = (await fixture(html`
    <lr-menu>
      <button slot="trigger" aria-label="Actions">⋮</button>
      <lr-menu-item value="rename">Rename</lr-menu-item>
    </lr-menu>
  `)) as LyraMenu;
  expect(list(withoutLabel).getAttribute('aria-label')).to.equal('Menu');

  const el = (await fixture(basic())) as LyraMenu;
  expect(list(el).getAttribute('aria-label')).to.equal('Row actions');
});

it('honors a strings override for menuLabel while label is left at its default', async () => {
  const el = (await fixture(html`
    <lr-menu .strings=${{ menuLabel: 'Menú' }}>
      <button slot="trigger" aria-label="Actions">⋮</button>
      <lr-menu-item value="rename">Rename</lr-menu-item>
    </lr-menu>
  `)) as LyraMenu;
  expect(list(el).getAttribute('aria-label')).to.equal('Menú');
});

it('honors a host-level aria-label attribute over both the default and an explicit label prop', async () => {
  const withDefaultLabel = (await fixture(html`
    <lr-menu aria-label="Context menu">
      <button slot="trigger" aria-label="Actions">⋮</button>
      <lr-menu-item value="rename">Rename</lr-menu-item>
    </lr-menu>
  `)) as LyraMenu;
  expect(list(withDefaultLabel).getAttribute('aria-label')).to.equal('Context menu');

  const withExplicitLabel = (await fixture(html`
    <lr-menu label="Row actions" aria-label="Context menu">
      <button slot="trigger" aria-label="Actions">⋮</button>
      <lr-menu-item value="rename">Rename</lr-menu-item>
    </lr-menu>
  `)) as LyraMenu;
  expect(list(withExplicitLabel).getAttribute('aria-label')).to.equal('Context menu');
});

describe('public show()/hide()', () => {
  const withApply = () => html`
    <lr-menu label="Filters">
      <button slot="trigger" id="trig" aria-label="Filters">⋮</button>
      <lr-menu-item value="a">A</lr-menu-item>
      <lr-menu-item value="b">B</lr-menu-item>
      <button id="apply" type="button">Apply</button>
    </lr-menu>
  `;

  // Never compare two DOM nodes with expect().to.equal() here -- a failure serializes the whole
  // test page and wedges the runner. Compare a short stable id instead.
  const activeId = (): string => {
    const active = document.activeElement as HTMLElement | null;
    if (!active) return 'none';
    return active.id || `${active.tagName.toLowerCase()}:${(active as HTMLElement & { value?: string }).value ?? ''}`;
  };
  const tabIndexes = (el: LyraMenu): number[] => items(el).map((i) => i.tabIndex);
  const activeIndexOf = (el: LyraMenu): number => (el as unknown as { activeIndex: number }).activeIndex;

  it('hide({ focusTrigger: true }) from a slotted control closes, returns focus to the trigger, and leaves no stale tab stop', async () => {
    const el = (await fixture(withApply())) as LyraMenu;
    trigger(el).click();
    await el.updateComplete;
    const apply = el.querySelector('#apply') as HTMLButtonElement;
    apply.focus();
    expect(activeId()).to.equal('apply');

    el.hide({ focusTrigger: true });
    await el.updateComplete;

    expect(el.open).to.be.false;
    expect(activeId()).to.equal('trig');
    // No item may be left as a tab stop while the menu is closed.
    expect(activeIndexOf(el)).to.equal(-1);
    expect(tabIndexes(el)).to.deep.equal([-1, -1]);
  });

  it('hide() without options closes without moving focus', async () => {
    const el = (await fixture(withApply())) as LyraMenu;
    trigger(el).click();
    await el.updateComplete;
    const apply = el.querySelector('#apply') as HTMLButtonElement;
    apply.focus();

    el.hide();
    await el.updateComplete;
    expect(el.open).to.be.false;
    expect(activeId()).to.equal('apply');
  });

  it('a bare `open = false` resets activeIndex and the roving tabindex too', async () => {
    const el = (await fixture(basic())) as LyraMenu;
    trigger(el).click();
    await el.updateComplete;
    expect(tabIndexes(el)).to.deep.equal([0, -1, -1]);

    // The consumer-facing path that bypasses hide() entirely. Before this was centralized in
    // updated(), it left activeIndex pointing at the last active item and that item's tabIndex at
    // 0 -- a stale tab stop on a closed menu.
    el.open = false;
    await el.updateComplete;
    expect(activeIndexOf(el)).to.equal(-1);
    expect(tabIndexes(el)).to.deep.equal([-1, -1, -1]);

    // ...and reopening still lands the roving tab stop on a valid item.
    el.open = true;
    await el.updateComplete;
    expect(tabIndexes(el)).to.deep.equal([0, -1, -1]);
    expect(activeItemValue()).to.equal('item:rename');
  });

  it('show() is public and honors an explicit first/last focus target', async () => {
    const el = (await fixture(basic())) as LyraMenu;
    el.show('last');
    await el.updateComplete;
    expect(el.open).to.be.true;
    expect(activeItemValue()).to.equal('item:delete');

    el.hide();
    await el.updateComplete;
    el.show();
    await el.updateComplete;
    expect(activeItemValue()).to.equal('item:rename');
  });

  it('teardown does not steal focus: disconnecting an open menu leaves focus where it is', async () => {
    const el = (await fixture(basic())) as LyraMenu;
    trigger(el).click();
    await el.updateComplete;
    expect(el.open).to.be.true;

    const outside = document.createElement('button');
    outside.id = 'outside';
    document.body.appendChild(outside);
    outside.focus();
    expect(activeId()).to.equal('outside');

    // disconnectedCallback() sets `open = false` deliberately; that must never route through the
    // trigger-refocus path, or a teardown (route change, list re-render) yanks focus back.
    el.remove();
    await el.updateComplete;
    expect(el.open).to.be.false;
    expect(activeId()).to.equal('outside');
    outside.remove();
  });
});

describe('header/footer composed-content regions', () => {
  const composed = () => html`
    <lr-menu label="Filters">
      <button slot="trigger" id="trig" aria-label="Filters">⋮</button>
      <input slot="header" id="filter" type="text" aria-label="Filter" />
      <lr-menu-item value="a">A</lr-menu-item>
      <lr-menu-item value="b">B</lr-menu-item>
      <button slot="footer" id="apply" type="button">Apply</button>
    </lr-menu>
  `;

  const part = (el: LyraMenu, name: string): HTMLElement =>
    el.shadowRoot!.querySelector(`[part="${name}"]`) as HTMLElement;

  it('adds no box and no layout shift when neither the header nor the footer slot is filled', async () => {
    const el = (await fixture(basic())) as LyraMenu;
    el.open = true;
    await el.updateComplete;

    const popup = part(el, 'popup');
    const listEl = list(el);
    const header = part(el, 'header');
    const footer = part(el, 'footer');

    // The wrappers exist in the shadow tree but must collapse to nothing --
    // an uncollapsed wrapper would move every existing consumer's items.
    expect(getComputedStyle(header).display).to.equal('none');
    expect(getComputedStyle(footer).display).to.equal('none');
    expect(header.getBoundingClientRect().height).to.equal(0);
    expect(footer.getBoundingClientRect().height).to.equal(0);
    expect(header.getBoundingClientRect().width).to.equal(0);
    expect(footer.getBoundingClientRect().width).to.equal(0);

    // The popup's box is still exactly its own border plus the list's box, and
    // the list still starts immediately inside the popup's border edge.
    const popupRect = popup.getBoundingClientRect();
    const listRect = listEl.getBoundingClientRect();
    const border = parseFloat(getComputedStyle(popup).borderBlockStartWidth);
    expect(listRect.top - popupRect.top).to.be.closeTo(border, 0.05);
    expect(popupRect.height).to.be.closeTo(listRect.height + border * 2, 0.05);

    // [part='list'] itself is untouched: same role, same name, same slot content.
    expect(listEl.getAttribute('role')).to.equal('menu');
    expect(listEl.getAttribute('aria-label')).to.equal('Row actions');
    expect(items(el).length).to.equal(3);

    // ...and the host gains no attribute at all in the unfilled case.
    expect(el.hasAttribute('data-has-header')).to.be.false;
    expect(el.hasAttribute('data-has-footer')).to.be.false;
    expect(el.hasAttribute('data-list-empty')).to.be.false;
  });

  it('renders filled header/footer regions outside the role="menu" list', async () => {
    const el = (await fixture(composed())) as LyraMenu;
    el.open = true;
    await el.updateComplete;

    const header = part(el, 'header');
    const footer = part(el, 'footer');
    expect(getComputedStyle(header).display).to.not.equal('none');
    expect(getComputedStyle(footer).display).to.not.equal('none');
    expect(header.getBoundingClientRect().height).to.be.greaterThan(0);
    expect(footer.getBoundingClientRect().height).to.be.greaterThan(0);

    // Neither slotted control may end up inside role="menu".
    const input = el.querySelector('#filter') as HTMLInputElement;
    const apply = el.querySelector('#apply') as HTMLButtonElement;
    expect(input.assignedSlot?.getAttribute('name')).to.equal('header');
    expect(apply.assignedSlot?.getAttribute('name')).to.equal('footer');
    expect(list(el).contains(input)).to.be.false;
    expect(list(el).contains(apply)).to.be.false;
    expect(list(el).querySelectorAll('input, button').length).to.equal(0);

    // Header sits above the list, footer below it.
    expect(header.getBoundingClientRect().bottom).to.be.at.most(list(el).getBoundingClientRect().top + 0.05);
    expect(footer.getBoundingClientRect().top).to.be.at.least(list(el).getBoundingClientRect().bottom - 0.05);
  });

  it('leaves the default slot’s item discovery unaffected by header/footer content', async () => {
    const el = (await fixture(composed())) as LyraMenu;
    el.open = true;
    await el.updateComplete;

    const internals = el as unknown as { items: LyraMenuItem[] };
    expect(internals.items.length).to.equal(2);
    expect(internals.items.map((i) => i.value)).to.deep.equal(['a', 'b']);
    // Roving focus still lands on the first real item, not the header input.
    expect(activeItemValue()).to.equal('item:a');
    expect(internals.items.map((i) => i.tabIndex)).to.deep.equal([0, -1]);
  });
});

describe('Tab across the header/footer regions', () => {
  /** Walks every open shadow root -- `document.activeElement` stops at a shadow host. */
  const deepActive = (): HTMLElement | null => {
    let active = document.activeElement as HTMLElement | null;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement as HTMLElement;
    return active;
  };
  // Never compare two DOM nodes with expect().to.equal() here -- a failure serializes the whole
  // test page and wedges the runner. Compare a short stable id instead.
  const activeId = (): string => {
    const active = deepActive();
    if (!active) return 'none';
    return active.id || `${active.tagName.toLowerCase()}:${(active as HTMLElement & { value?: string }).value ?? ''}`;
  };
  const tab = (from: HTMLElement, shiftKey = false): KeyboardEvent => {
    const ev = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, composed: true, cancelable: true });
    from.dispatchEvent(ev);
    return ev;
  };

  const withRegions = () => html`
    <lr-menu label="Filters">
      <button slot="trigger" id="trig" aria-label="Filters">⋮</button>
      <input slot="header" id="filter" type="text" aria-label="Filter" />
      <lr-menu-item value="a">A</lr-menu-item>
      <lr-menu-item value="b">B</lr-menu-item>
      <button slot="footer" id="apply" type="button">Apply</button>
      <button slot="footer" id="reset" type="button">Reset</button>
    </lr-menu>
  `;

  it('stays open on Tab from an item when the footer holds a focusable, so focus can reach it', async () => {
    const el = (await fixture(withRegions())) as LyraMenu;
    trigger(el).click();
    await el.updateComplete;
    expect(activeId()).to.equal('lr-menu-item:a');

    const ev = tab(deepActive()!);
    await el.updateComplete;
    expect(el.open).to.be.true;
    // The browser's own Tab advance is what moves focus -- it must not be prevented.
    expect(ev.defaultPrevented).to.be.false;

    // A closed popup is `visibility: hidden`, which makes its content unfocusable
    // outright, so this focus() only lands while the menu really did stay open.
    const apply = el.querySelector('#apply') as HTMLButtonElement;
    apply.focus();
    expect(activeId()).to.equal('apply');
    expect(el.open).to.be.true;
  });

  it('stays open on Shift+Tab from an item when the header holds a focusable, so focus can reach it', async () => {
    const el = (await fixture(withRegions())) as LyraMenu;
    trigger(el).click();
    await el.updateComplete;

    const ev = tab(deepActive()!, true);
    await el.updateComplete;
    expect(el.open).to.be.true;
    expect(ev.defaultPrevented).to.be.false;

    const filter = el.querySelector('#filter') as HTMLInputElement;
    filter.focus();
    expect(activeId()).to.equal('filter');
    expect(el.open).to.be.true;
  });

  it('closes on Tab from an item when the header/footer hold no focusable element at all', async () => {
    const el = (await fixture(html`
      <lr-menu label="Filters">
        <button slot="trigger" id="trig" aria-label="Filters">⋮</button>
        <span slot="header">Filters</span>
        <lr-menu-item value="a">A</lr-menu-item>
        <span slot="footer">2 of 9 shown</span>
      </lr-menu>
    `)) as LyraMenu;
    trigger(el).click();
    await el.updateComplete;

    const ev = tab(deepActive()!);
    await el.updateComplete;
    expect(el.open).to.be.false;
    expect(ev.defaultPrevented).to.be.false;
  });

  it('moves between two focusables inside the same region without closing', async () => {
    const el = (await fixture(withRegions())) as LyraMenu;
    trigger(el).click();
    await el.updateComplete;
    const apply = el.querySelector('#apply') as HTMLButtonElement;
    apply.focus();
    expect(activeId()).to.equal('apply');

    const ev = tab(apply);
    await el.updateComplete;
    expect(el.open).to.be.true;
    expect(ev.defaultPrevented).to.be.false;
  });

  it('closes on Tab out of the last focusable in the footer, without preventing the default advance', async () => {
    const el = (await fixture(withRegions())) as LyraMenu;
    trigger(el).click();
    await el.updateComplete;
    const reset = el.querySelector('#reset') as HTMLButtonElement;
    reset.focus();
    expect(activeId()).to.equal('reset');

    const ev = tab(reset);
    await el.updateComplete;
    expect(el.open).to.be.false;
    expect(ev.defaultPrevented).to.be.false;
  });

  it('closes on Shift+Tab out of the first focusable in the header — the other end of the same dismissal hole', async () => {
    const el = (await fixture(withRegions())) as LyraMenu;
    trigger(el).click();
    await el.updateComplete;
    const filter = el.querySelector('#filter') as HTMLInputElement;
    filter.focus();

    const ev = tab(filter, true);
    await el.updateComplete;
    expect(el.open).to.be.false;
    expect(ev.defaultPrevented).to.be.false;
  });

  it('stays open on Tab from the header, whose next stop is the list itself', async () => {
    const el = (await fixture(withRegions())) as LyraMenu;
    trigger(el).click();
    await el.updateComplete;
    const filter = el.querySelector('#filter') as HTMLInputElement;
    filter.focus();

    tab(filter);
    await el.updateComplete;
    expect(el.open).to.be.true;
  });

  it('still closes on Tab from an item when only default-slot content follows it (the legacy shape)', async () => {
    const el = (await fixture(html`
      <lr-menu label="Filters">
        <button slot="trigger" id="trig" aria-label="Filters">⋮</button>
        <lr-menu-item value="a">A</lr-menu-item>
        <button id="legacy-apply" type="button">Apply</button>
      </lr-menu>
    `)) as LyraMenu;
    trigger(el).click();
    await el.updateComplete;

    const ev = tab(deepActive()!);
    await el.updateComplete;
    // Default-slot non-item content stays deliberately Tab-unreachable -- only
    // the header/footer regions carve out of the historical "Tab closes" rule.
    expect(el.open).to.be.false;
    expect(ev.defaultPrevented).to.be.false;
  });

  it('closes on Tab out of the last default-slot focusable, sealing the old dismissal hole', async () => {
    const el = (await fixture(html`
      <lr-menu label="Filters">
        <button slot="trigger" id="trig" aria-label="Filters">⋮</button>
        <lr-menu-item value="a">A</lr-menu-item>
        <button id="legacy-apply" type="button">Apply</button>
      </lr-menu>
    `)) as LyraMenu;
    trigger(el).click();
    await el.updateComplete;
    const legacy = el.querySelector('#legacy-apply') as HTMLButtonElement;
    legacy.focus();
    expect(activeId()).to.equal('legacy-apply');

    // Before this, Tab from non-item content was swallowed by the item-target
    // gate: focus walked out of the popup while the menu stayed open.
    const ev = tab(legacy);
    await el.updateComplete;
    expect(el.open).to.be.false;
    expect(ev.defaultPrevented).to.be.false;
  });
});

describe('Escape from the header/footer regions', () => {
  const withRegions = () => html`
    <lr-menu label="Filters">
      <button slot="trigger" id="trig" aria-label="Filters">⋮</button>
      <input slot="header" id="filter" type="text" aria-label="Filter" />
      <lr-menu-item value="a">A</lr-menu-item>
      <lr-menu-item value="b">B</lr-menu-item>
      <button slot="footer" id="apply" type="button">Apply</button>
    </lr-menu>
  `;
  const escape = (from: HTMLElement): KeyboardEvent => {
    const ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, cancelable: true });
    from.dispatchEvent(ev);
    return ev;
  };

  it('closes and refocuses the trigger on Escape from header content, with closeOnEscapeAnywhere unset', async () => {
    const el = (await fixture(withRegions())) as LyraMenu;
    expect(el.closeOnEscapeAnywhere).to.be.false;
    const btn = trigger(el);
    btn.click();
    await el.updateComplete;
    const filter = el.querySelector('#filter') as HTMLInputElement;
    filter.focus();

    escape(filter);
    await el.updateComplete;
    expect(el.open).to.be.false;
    expect((document.activeElement as HTMLElement | null)?.id).to.equal('trig');
  });

  it('closes and refocuses the trigger on Escape from footer content, with closeOnEscapeAnywhere unset', async () => {
    const el = (await fixture(withRegions())) as LyraMenu;
    const btn = trigger(el);
    btn.click();
    await el.updateComplete;
    const apply = el.querySelector('#apply') as HTMLButtonElement;
    apply.focus();

    escape(apply);
    await el.updateComplete;
    expect(el.open).to.be.false;
    expect((document.activeElement as HTMLElement | null)?.id).to.equal('trig');
  });

  it('leaves closeOnEscapeAnywhere governing only default-slot non-item content', async () => {
    const el = (await fixture(html`
      <lr-menu label="Filters">
        <button slot="trigger" id="trig" aria-label="Filters">⋮</button>
        <input slot="header" id="filter" type="text" aria-label="Filter" />
        <lr-menu-item value="a">A</lr-menu-item>
        <input id="legacy" type="text" aria-label="Legacy" />
      </lr-menu>
    `)) as LyraMenu;
    el.open = true;
    await el.updateComplete;

    // Default slot: still gated, still `false` by default.
    const legacy = el.querySelector('#legacy') as HTMLInputElement;
    legacy.focus();
    escape(legacy);
    await el.updateComplete;
    expect(el.open).to.be.true;

    // Header: never gated.
    const filter = el.querySelector('#filter') as HTMLInputElement;
    filter.focus();
    escape(filter);
    await el.updateComplete;
    expect(el.open).to.be.false;
  });

  it('gives Arrow/Home/End/Enter/Space from header/footer content their full native behavior', async () => {
    const el = (await fixture(withRegions())) as LyraMenu;
    trigger(el).click();
    await el.updateComplete;
    const filter = el.querySelector('#filter') as HTMLInputElement;
    const apply = el.querySelector('#apply') as HTMLButtonElement;
    const activeIndexOf = (): number => (el as unknown as { activeIndex: number }).activeIndex;
    const before = activeIndexOf();

    for (const source of [filter, apply]) {
      source.focus();
      for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' ']) {
        const ev = new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true });
        source.dispatchEvent(ev);
        // The item-target gate must not have been widened: nothing may be
        // prevented, so the native control keeps its own behavior.
        expect(ev.defaultPrevented, `${key} from #${source.id}`).to.be.false;
      }
    }
    await el.updateComplete;
    expect(activeIndexOf()).to.equal(before);
    expect(el.open).to.be.true;
  });
});

it('is accessible while closed', async () => {
  const el = (await fixture(basic())) as LyraMenu;
  await expect(el).to.be.accessible();
});

it('is accessible while open', async () => {
  const el = (await fixture(basic())) as LyraMenu;
  el.open = true;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('is accessible with a header input and a footer button — content role="menu" could not legally hold', async () => {
  const el = (await fixture(html`
    <lr-menu label="Filters">
      <button slot="trigger" aria-label="Filters">⋮</button>
      <input slot="header" id="filter" type="text" aria-label="Filter actions" />
      <lr-menu-item value="a">A</lr-menu-item>
      <lr-menu-item value="b">B</lr-menu-item>
      <button slot="footer" id="apply" type="button">Apply</button>
    </lr-menu>
  `)) as LyraMenu;
  el.open = true;
  await el.updateComplete;

  // Assert the populated state really rendered before trusting the axe pass:
  // both regions must be visible, and neither control may sit inside the list.
  const shadow = el.shadowRoot!;
  expect(getComputedStyle(shadow.querySelector('[part="header"]')!).display).to.not.equal('none');
  expect(getComputedStyle(shadow.querySelector('[part="footer"]')!).display).to.not.equal('none');
  expect(list(el).querySelectorAll('input, button').length).to.equal(0);
  expect(el.querySelectorAll('[slot="header"], [slot="footer"]').length).to.equal(2);

  // Inside role="menu" this same content is an aria-required-children violation.
  await expect(el).to.be.accessible();
});

/** Render the max-inline-size declared on `selector` (read off the element's own applied stylesheets)
 *  into the component's shadow scope with the viewport-clamp token pinned to a tiny value, returning
 *  its resolved computed value. If the site is wired to --lr-popover-viewport-clamp the min() collapses
 *  to that pinned value; a leftover 92vw/90vw literal would resolve to something else. */
function renderedClamp(el: HTMLElement, selector: string): string {
  const normalize = (text: string) => text.replace(/"/g, "'");
  let declared = '';
  for (const sheet of el.shadowRoot!.adoptedStyleSheets) {
    for (const rule of sheet.cssRules) {
      if (
        rule instanceof CSSStyleRule &&
        normalize(rule.selectorText) === normalize(selector) &&
        rule.style.maxInlineSize
      ) {
        declared = rule.style.maxInlineSize;
      }
    }
  }
  const probe = document.createElement('span');
  probe.style.display = 'block';
  probe.style.setProperty('--lr-popover-viewport-clamp', '10px');
  probe.style.maxInlineSize = declared;
  el.shadowRoot!.appendChild(probe);
  const value = getComputedStyle(probe).maxInlineSize;
  probe.remove();
  return value;
}

it('clamps the popup width through the shared popover-viewport-clamp token', async () => {
  const el = (await fixture(basic())) as LyraMenu;
  el.open = true;
  await el.updateComplete;
  expect(renderedClamp(el, "[part='popup']")).to.equal('10px');
});
