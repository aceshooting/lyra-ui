import { fixture, expect, oneEvent, html } from '@open-wc/testing';
import './menu.js';
import './menu-item.js';
import type { LyraMenu } from './menu.js';
import type { LyraMenuItem } from './menu-item.js';

const basic = () => html`
  <lyra-menu label="Row actions">
    <button slot="trigger" aria-label="Row actions">⋮</button>
    <lyra-menu-item value="rename">Rename</lyra-menu-item>
    <lyra-menu-item value="duplicate">Duplicate</lyra-menu-item>
    <hr />
    <lyra-menu-item value="delete" destructive>Delete</lyra-menu-item>
  </lyra-menu>
`;

function trigger(el: LyraMenu): HTMLButtonElement {
  return el.querySelector('button[slot="trigger"]') as HTMLButtonElement;
}

function items(el: LyraMenu): LyraMenuItem[] {
  return [...el.querySelectorAll('lyra-menu-item')] as LyraMenuItem[];
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
  expect(btn.getAttribute('aria-haspopup')).to.equal('menu');
  expect(btn.getAttribute('aria-expanded')).to.equal('false');
  expect(btn.getAttribute('aria-controls')).to.not.equal('');

  btn.click();
  await el.updateComplete;
  expect(btn.getAttribute('aria-expanded')).to.equal('true');
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
  const ev = await oneEvent(el, 'lyra-menu-select');
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
  const ev = await oneEvent(el, 'lyra-menu-select');
  expect(ev.detail).to.deep.equal({ value: 'rename' });
});

it('clicking an item fires the consolidated lyra-menu-select and closes the menu', async () => {
  const el = (await fixture(basic())) as LyraMenu;
  trigger(el).click();
  await el.updateComplete;

  setTimeout(() => items(el)[1].shadowRoot!.querySelector('[part="base"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true })));
  const ev = await oneEvent(el, 'lyra-menu-select');
  expect(ev.detail).to.deep.equal({ value: 'duplicate' });
  expect(el.open).to.be.false;
});

it('skips a disabled item during ArrowDown navigation', async () => {
  const el = (await fixture(html`
    <lyra-menu>
      <button slot="trigger" aria-label="Actions">⋮</button>
      <lyra-menu-item value="a">A</lyra-menu-item>
      <lyra-menu-item value="b" disabled>B</lyra-menu-item>
      <lyra-menu-item value="c">C</lyra-menu-item>
    </lyra-menu>
  `)) as LyraMenu;
  trigger(el).click();
  await el.updateComplete;
  const [a, , c] = items(el);
  expect(document.activeElement).to.equal(a);

  (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(document.activeElement).to.equal(c);
});

it('moves roving focus when the active item becomes disabled or hidden', async () => {
  const el = (await fixture(html`
    <lyra-menu>
      <button slot="trigger" aria-label="Actions">⋮</button>
      <lyra-menu-item value="a">A</lyra-menu-item>
      <lyra-menu-item value="b">B</lyra-menu-item>
      <lyra-menu-item value="c">C</lyra-menu-item>
    </lyra-menu>
  `)) as LyraMenu;
  trigger(el).click();
  await el.updateComplete;
  const [a, b, c] = items(el);
  expect(document.activeElement).to.equal(a);

  a.disabled = true;
  await a.updateComplete;
  await el.updateComplete;
  expect(document.activeElement).to.equal(b);
  expect(b.tabIndex).to.equal(0);

  b.hidden = true;
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  await el.updateComplete;
  expect(document.activeElement).to.equal(c);
  expect(c.tabIndex).to.equal(0);
});

// Dynamic *membership* changes (items added/removed/reordered while the menu
// is open), as distinct from the dynamic *attribute* state (disabled/hidden)
// the MutationObserver above covers. `activeIndex` is a positional index into
// an array rebuilt from scratch on every `slotchange`, so it must be
// re-resolved by *identity* -- a bounds check alone silently repoints it at a
// different item (or drops it entirely) whenever the list shifts underneath.
const abc = () => html`
  <lyra-menu>
    <button slot="trigger" aria-label="Actions">⋮</button>
    <lyra-menu-item value="a">A</lyra-menu-item>
    <lyra-menu-item value="b">B</lyra-menu-item>
    <lyra-menu-item value="c">C</lyra-menu-item>
  </lyra-menu>
`;

// slotchange is queued as a microtask, so it lands after `updateComplete`'s
// own microtask -- mirrors the `hidden` half of the disabled/hidden test above.
async function afterSlotChange(el: LyraMenu): Promise<void> {
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  await el.updateComplete;
}

/**
 * The `expect(document.activeElement).to.equal(item)` idiom used everywhere
 * above is unusable for the tests below. Every one of them asserts against a
 * *focus-loss* bug, so the failing actual value is `<body>` -- and chai
 * stringifies the actual value to build its message, serializing the entire
 * test page (mocha's own reporter DOM included) into one string. That wedges
 * the test runner into a timeout instead of producing a failure. Comparing a
 * short stable identity keeps the failure readable ("expected 'body' to equal
 * 'item:a'") and is strictly more informative than an element-identity diff.
 */
function activeItemValue(): string {
  const active = document.activeElement as (HTMLElement & { value?: string }) | null;
  if (!active) return 'none';
  return active.tagName === 'LYRA-MENU-ITEM' ? `item:${active.value}` : active.tagName.toLowerCase();
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

  const fresh = document.createElement('lyra-menu-item');
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

it('fires lyra-show/lyra-hide when `open` is set directly, bypassing click/keyboard', async () => {
  const el = (await fixture(basic())) as LyraMenu;
  await el.updateComplete;

  setTimeout(() => {
    el.open = true;
  });
  await oneEvent(el, 'lyra-show');
  expect(el.open).to.be.true;

  setTimeout(() => {
    el.open = false;
  });
  await oneEvent(el, 'lyra-hide');
  expect(el.open).to.be.false;
});

it('does not fire lyra-show/lyra-hide for markup that renders open from the start', async () => {
  const el = (await fixture(html`
    <lyra-menu open>
      <button slot="trigger">⋮</button>
      <lyra-menu-item value="a">A</lyra-menu-item>
    </lyra-menu>
  `)) as LyraMenu;
  let fired = false;
  el.addEventListener('lyra-show', () => (fired = true));
  await el.updateComplete;
  expect(fired).to.be.false;
});

it('positions the popup and moves focus even when declared open from the start (trigger/item slotchange races Lit\'s first update)', async () => {
  const el = (await fixture(html`
    <lyra-menu open>
      <button slot="trigger">⋮</button>
      <lyra-menu-item value="a">A</lyra-menu-item>
      <lyra-menu-item value="b">B</lyra-menu-item>
    </lyra-menu>
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
      <lyra-menu placement="left-start">
        <button slot="trigger" style="position:absolute; top:100px; left:100px;">⋮</button>
        <lyra-menu-item value="a">A</lyra-menu-item>
      </lyra-menu>
    </div>
  `);
  const rtlEl = rtlWrap.querySelector('lyra-menu') as LyraMenu;
  trigger(rtlEl).click();
  await rtlEl.updateComplete;
  const rtlPopup = rtlEl.shadowRoot!.querySelector('[part="popup"]') as HTMLElement;
  await waitFor(
    () => rtlPopup.style.left,
    (left) => left !== '',
  );

  const ltrWrap = await fixture(html`
    <div style="position: relative;">
      <lyra-menu placement="right-start">
        <button slot="trigger" style="position:absolute; top:100px; left:100px;">⋮</button>
        <lyra-menu-item value="a">A</lyra-menu-item>
      </lyra-menu>
    </div>
  `);
  const ltrEl = ltrWrap.querySelector('lyra-menu') as LyraMenu;
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
      <lyra-menu placement="bottom-start">
        <button slot="trigger" style="position:absolute; top:100px; left:100px;">⋮</button>
        <lyra-menu-item value="a">A</lyra-menu-item>
      </lyra-menu>
    </div>
  `);
  const el = wrap.querySelector('lyra-menu') as LyraMenu;
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
    <lyra-menu>
      <button slot="trigger" aria-label="Actions">⋮</button>
      <lyra-menu-item value="a">A</lyra-menu-item>
      <lyra-menu-item value="b" disabled>B</lyra-menu-item>
      <lyra-menu-item value="c">C</lyra-menu-item>
    </lyra-menu>
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
    <lyra-menu>
      <button slot="trigger" aria-label="Actions">⋮</button>
      <lyra-menu-item value="a">Apple</lyra-menu-item>
      <lyra-menu-item value="b" disabled>Banana</lyra-menu-item>
      <lyra-menu-item value="c">Blueberry</lyra-menu-item>
    </lyra-menu>
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
    <lyra-menu>
      <button slot="trigger" aria-label="Actions">⋮</button>
      <lyra-menu-item value="a">Apple</lyra-menu-item>
      <lyra-menu-item value="b" hidden>Banana</lyra-menu-item>
      <lyra-menu-item value="c" aria-hidden="true">Berry</lyra-menu-item>
      <lyra-menu-item value="d">Blueberry</lyra-menu-item>
    </lyra-menu>
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
    <lyra-menu label="Row actions">
      <button slot="trigger" aria-label="Row actions">⋮</button>
      <lyra-menu-item value="rename">Rename</lyra-menu-item>
      <lyra-menu-item value="duplicate">Duplicate</lyra-menu-item>
      <input type="text" />
    </lyra-menu>
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
    <lyra-menu label="Row actions">
      <button slot="trigger" aria-label="Row actions">⋮</button>
      <lyra-menu-item value="rename">Rename</lyra-menu-item>
      <lyra-menu-item value="duplicate">Duplicate</lyra-menu-item>
    </lyra-menu>
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
    <lyra-menu label="Row actions">
      <button slot="trigger" aria-label="Row actions">⋮</button>
      <lyra-menu-item value="rename">Rename</lyra-menu-item>
      <input type="text" />
    </lyra-menu>
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
    <lyra-menu label="Row actions" close-on-escape-anywhere>
      <button slot="trigger" aria-label="Row actions">⋮</button>
      <lyra-menu-item value="rename">Rename</lyra-menu-item>
      <input type="text" />
    </lyra-menu>
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
    <lyra-menu label="Row actions" close-on-escape-anywhere>
      <button slot="trigger" aria-label="Row actions">⋮</button>
      <lyra-menu-item value="rename">Rename</lyra-menu-item>
      <lyra-menu-item value="duplicate">Duplicate</lyra-menu-item>
      <input type="text" />
    </lyra-menu>
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
    <lyra-menu>
      <button slot="trigger" aria-label="Actions">⋮</button>
      <lyra-menu-item value="rename">Rename</lyra-menu-item>
    </lyra-menu>
  `)) as LyraMenu;
  expect(list(withoutLabel).getAttribute('aria-label')).to.equal('Menu');

  const el = (await fixture(basic())) as LyraMenu;
  expect(list(el).getAttribute('aria-label')).to.equal('Row actions');
});

it('honors a strings override for menuLabel while label is left at its default', async () => {
  const el = (await fixture(html`
    <lyra-menu .strings=${{ menuLabel: 'Menú' }}>
      <button slot="trigger" aria-label="Actions">⋮</button>
      <lyra-menu-item value="rename">Rename</lyra-menu-item>
    </lyra-menu>
  `)) as LyraMenu;
  expect(list(el).getAttribute('aria-label')).to.equal('Menú');
});

it('honors a host-level aria-label attribute over both the default and an explicit label prop', async () => {
  const withDefaultLabel = (await fixture(html`
    <lyra-menu aria-label="Context menu">
      <button slot="trigger" aria-label="Actions">⋮</button>
      <lyra-menu-item value="rename">Rename</lyra-menu-item>
    </lyra-menu>
  `)) as LyraMenu;
  expect(list(withDefaultLabel).getAttribute('aria-label')).to.equal('Context menu');

  const withExplicitLabel = (await fixture(html`
    <lyra-menu label="Row actions" aria-label="Context menu">
      <button slot="trigger" aria-label="Actions">⋮</button>
      <lyra-menu-item value="rename">Rename</lyra-menu-item>
    </lyra-menu>
  `)) as LyraMenu;
  expect(list(withExplicitLabel).getAttribute('aria-label')).to.equal('Context menu');
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
