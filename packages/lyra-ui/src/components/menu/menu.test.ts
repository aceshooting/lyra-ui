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

  list(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(document.activeElement).to.equal(second);

  list(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(document.activeElement).to.equal(third);

  // Wraps past the last item back to the first.
  list(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(document.activeElement).to.equal(first);

  // Wraps backward past the first item to the last.
  list(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(document.activeElement).to.equal(third);
});

it('Home/End jump to the first/last item', async () => {
  const el = (await fixture(basic())) as LyraMenu;
  trigger(el).click();
  await el.updateComplete;
  const [first, , third] = items(el);

  list(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(document.activeElement).to.equal(third);

  list(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(document.activeElement).to.equal(first);
});

it('selects the active item with Enter and closes, refocusing the trigger', async () => {
  const el = (await fixture(basic())) as LyraMenu;
  const btn = trigger(el);
  btn.click();
  await el.updateComplete;

  setTimeout(() =>
    list(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })),
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
    list(el).dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })),
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

  list(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(document.activeElement).to.equal(c);
});

it('closes on Escape and returns focus to the trigger', async () => {
  const el = (await fixture(basic())) as LyraMenu;
  const btn = trigger(el);
  btn.click();
  await el.updateComplete;
  expect(el.open).to.be.true;

  list(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
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
  list(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(document.activeElement).to.equal(a);
});

it('closes on Tab without preventing the default focus-advance behavior', async () => {
  const el = (await fixture(basic())) as LyraMenu;
  trigger(el).click();
  await el.updateComplete;
  expect(el.open).to.be.true;

  const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  list(el).dispatchEvent(ev);
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

  list(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'd', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(document.activeElement).to.equal(duplicate);
});

it('accumulates the type-ahead buffer across quick keystrokes to narrow the match', async () => {
  const el = (await fixture(basic())) as LyraMenu;
  trigger(el).click();
  await el.updateComplete;
  const [, , destroy] = items(el); // Rename, Duplicate, Delete

  list(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'd', bubbles: true, cancelable: true }));
  await el.updateComplete;
  list(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true, cancelable: true }));
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

  list(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(document.activeElement).to.equal(blueberry);
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
