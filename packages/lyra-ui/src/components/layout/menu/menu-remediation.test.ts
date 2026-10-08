import { aTimeout, expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import './menu.js';
import './menu-item.js';
import './menu-label.js';
import type { LyraMenuItem } from './menu-item.class.js';
import type { LyraMenu } from './menu.class.js';

for (const change of ['disable', 'remove'] as const) {
  for (const focus of ['outside', 'header', 'footer', 'item'] as const) {
    it(`repairs ${change} roving state while preserving ${focus} focus`, async () => {
      const root = await fixture<HTMLElement>(html`<div>
        <button id="outside">Outside</button>
        <lr-menu>
          <button id="header" slot="header">Header</button>
          <lr-menu-label>Caption</lr-menu-label>
          <lr-menu-item id="first">First</lr-menu-item>
          <lr-menu-item id="middle">Middle</lr-menu-item>
          <lr-menu-item id="last">Last</lr-menu-item>
          <button id="footer" slot="footer">Footer</button>
        </lr-menu>
      </div>`);
      const item = root.querySelector<LyraMenuItem>('#middle')!;
      item.focus();
      await waitUntil(() => item.tabIndex === 0);
      if (focus !== 'item') root.querySelector<HTMLElement>(`#${focus}`)!.focus();
      if (change === 'disable') item.disabled = true;
      else item.remove();
      await waitUntil(() => [...root.querySelectorAll<LyraMenuItem>('lr-menu-item')].some(candidate => candidate.id !== 'middle' && candidate.tabIndex === 0));
      const stop = root.querySelector<LyraMenuItem>('lr-menu-item[tabindex="0"]')!;
      expect(stop.interactionDisabled).to.equal(false);
      if (focus === 'item') expect(document.activeElement?.id).to.equal(stop.id);
      else expect(document.activeElement?.id).to.equal(focus);
      expect(root.querySelectorAll('lr-menu-item[tabindex="0"]').length).to.equal(1);
    });
  }
}

/**
 * Regression: ARIA idrefs do not cross a shadow boundary -- a host-authored `aria-describedby`
 * never reached `[part="list"]`'s own `role="menu"`, which is the element that actually owns the
 * accessible description.
 */
describe('lr-menu host aria-describedby reflection', () => {
  it('merges a host-authored aria-describedby onto the list description', async () => {
    const root = await fixture<HTMLElement>(html`<div>
      <p id="extra-context">Extra context for the menu.</p>
      <lr-menu label="Actions" aria-describedby="extra-context">
        <lr-menu-item value="rename">Rename</lr-menu-item>
      </lr-menu>
    </div>`);
    const menu = root.querySelector('lr-menu') as LyraMenu;
    await menu.updateComplete;

    const list = menu.shadowRoot!.querySelector('[part="list"]') as HTMLElement & {
      ariaDescribedByElements?: Element[] | null;
    };
    const extra = root.querySelector('#extra-context') as HTMLElement;
    if (Reflect.has(list, 'ariaDescribedByElements')) {
      expect(list.ariaDescribedByElements ?? [], 'reflected description').to.include(extra);
    } else {
      expect(list.getAttribute('aria-describedby') ?? '', 'fallback description').to.contain(
        'extra-context'
      );
    }
  });
});

describe('menu type-ahead reset debounce', () => {
  const menuFixture = (): Promise<LyraMenu> =>
    fixture<LyraMenu>(html`<lr-menu>
      <lr-menu-item>Delete</lr-menu-item>
      <lr-menu-item>Details</lr-menu-item>
      <lr-menu-item>Export</lr-menu-item>
    </lr-menu>`);
  const bufferOf = (el: LyraMenu): string =>
    (el as unknown as { typeBuffer: { text: string } }).typeBuffer.text;
  const typeAhead = (el: LyraMenu, char: string): void => {
    (el as unknown as { typeAhead(char: string): void }).typeAhead(char);
  };

  it('restarts the reset on every keystroke instead of clearing a buffer a later one owns', async () => {
    const el = await menuFixture();
    typeAhead(el, 'd');
    expect(bufferOf(el)).to.equal('d');
    // wait-reason: real type-ahead reset timing; the buffer resets on its own schedule
    await aTimeout(300);
    typeAhead(el, 'e');
    expect(bufferOf(el), 'a second keystroke extends the buffer').to.equal('de');
    // wait-reason: real type-ahead reset timing; negative assertion that the superseded reset does not fire
    await aTimeout(350);
    expect(bufferOf(el), 'the superseded reset must not clear it').to.equal('de');
    // wait-reason: real type-ahead reset timing; the surviving reset fires on its own schedule
    await aTimeout(400);
    expect(bufferOf(el), 'the surviving reset still fires on its own schedule').to.equal('');
  });

  it('still resets its buffer after a disconnect and reconnect', async () => {
    // The reset runs on the shared DebounceController. Teardown must `cancel()` it, never
    // `dispose()` it: a disconnect here may be a re-parent, and a disposed controller silently
    // refuses every later push, leaving a reconnected menu with a buffer that never clears.
    const el = await menuFixture();
    const parent = el.parentElement!;
    el.remove();
    parent.append(el);
    await el.updateComplete;
    typeAhead(el, 'e');
    expect(bufferOf(el), 'a reconnected menu still accumulates').to.equal('e');
    // wait-reason: real type-ahead reset timing after reconnect
    await aTimeout(700);
    expect(bufferOf(el), 'and its reset still fires').to.equal('');
  });
});

describe('menu keys, disabled press, type-ahead and label observation', () => {
  const press = (target: HTMLElement, key: string, init: KeyboardEventInit = {}): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
  };

  it('leaves modified and composing keys to the browser', async () => {
    const menu = await fixture<LyraMenu>(html`<lr-menu><lr-menu-item id="a">A</lr-menu-item><lr-menu-item id="b">B</lr-menu-item></lr-menu>`);
    const a = menu.querySelector<LyraMenuItem>('#a')!;
    a.focus();
    await waitUntil(() => a.tabIndex === 0);
    let selected = 0;
    menu.addEventListener('lr-select', () => selected++);
    for (const init of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }, { isComposing: true }]) {
      for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' ']) {
        expect(press(a, key, init).defaultPrevented, `${key} with ${Object.keys(init)[0]}`).to.equal(false);
      }
    }
    expect(selected).to.equal(0);
    expect(document.activeElement?.id).to.equal('a');
  });

  it('keeps the roving stop when a disabled item is pressed with the mouse or focused by script', async () => {
    const menu = await fixture<LyraMenu>(html`<lr-menu><lr-menu-item id="a">A</lr-menu-item><lr-menu-item id="b" disabled>B</lr-menu-item><lr-menu-item id="c">C</lr-menu-item></lr-menu>`);
    const [a, b, c] = ['a', 'b', 'c'].map((id) => menu.querySelector<LyraMenuItem>(`#${id}`)!);
    a!.focus();
    await waitUntil(() => a!.tabIndex === 0);
    try {
      const rect = b!.getBoundingClientRect();
      await sendMouse({ type: 'click', position: [Math.round(rect.x + rect.width / 2), Math.round(rect.y + rect.height / 2)] });
    } finally {
      await resetMouse();
    }
    expect(document.activeElement?.id, 'the press leaves focus where it was').to.equal('a');
    b!.focus();
    await nextFrame();
    expect([a!.tabIndex, b!.tabIndex, c!.tabIndex]).to.deep.equal([0, -1, -1]);
    a!.focus();
    press(a!, 'ArrowDown');
    expect(document.activeElement?.id).to.equal('c');
  });

  it('matches type-ahead against cached labels without reading styles', async () => {
    const root = await fixture<HTMLElement>(html`<div><div><div><div><lr-menu>
      ${Array.from({ length: 24 }, (_, index) => html`<lr-menu-item id=${`i${index}`}>Row ${index}</lr-menu-item>`)}
      <lr-menu-item id="zeta">Zeta</lr-menu-item>
    </lr-menu></div></div></div></div>`);
    const first = root.querySelector<LyraMenuItem>('#i0')!;
    first.focus();
    await waitUntil(() => first.tabIndex === 0);
    await nextFrame();
    const original = window.getComputedStyle;
    let reads = 0;
    window.getComputedStyle = ((element: Element, pseudo?: string | null) => {
      reads += 1;
      return original.call(window, element, pseudo);
    }) as typeof window.getComputedStyle;
    try {
      press(first, 'z');
    } finally {
      window.getComputedStyle = original;
    }
    expect(document.activeElement?.id).to.equal('zeta');
    expect(reads).to.be.at.most(10);
  });

  it('ignores ancestor writes that cannot change an item name but follows an ancestor that hides and shows it', async () => {
    const wrap = await fixture<HTMLElement>(html`<div><lr-menu><lr-menu-item id="item"><span><b style="display: var(--menu-test-label-display, inline)">Beta</b></span></lr-menu-item></lr-menu></div>`);
    const item = wrap.querySelector<LyraMenuItem>('#item')!;
    await waitUntil(() => item.getAttribute('aria-label') === 'Beta');
    wrap.style.width = '10px';
    await nextFrame();
    const access = item as unknown as { readSlottedLabel: (...args: unknown[]) => string };
    const read = access.readSlottedLabel.bind(item);
    let reads = 0;
    access.readSlottedLabel = (...args: unknown[]) => {
      reads += 1;
      return read(...args);
    };
    wrap.style.left = '12px';
    wrap.style.top = '4px';
    wrap.className = 'moved';
    // wait-reason: negative assertion; ancestor writes must not trigger a label re-read
    await aTimeout(50);
    expect(reads).to.equal(0);
    wrap.style.setProperty('--menu-test-label-display', 'none');
    await waitUntil(() => !item.hasAttribute('aria-label'));
    wrap.style.removeProperty('--menu-test-label-display');
    await waitUntil(() => item.getAttribute('aria-label') === 'Beta');
    wrap.style.display = 'none';
    await waitUntil(() => !item.hasAttribute('aria-label'));
    wrap.style.display = '';
    await waitUntil(() => item.getAttribute('aria-label') === 'Beta');
  });
});

describe('submenu pointer handling', () => {
  it('handles one pointerover once inside an open submenu', async () => {
    const menu = await fixture<LyraMenu>(html`<lr-menu label="Actions">
      <lr-menu-item id="share">Share
        <lr-menu slot="submenu" id="share-menu"><lr-menu-item id="email">Email</lr-menu-item></lr-menu>
      </lr-menu-item>
    </lr-menu>`);
    const share = menu.querySelector<LyraMenuItem>('#share')!;
    const child = menu.querySelector<LyraMenu>('#share-menu')!;
    const email = child.querySelector<HTMLElement>('#email')!;
    share.focus();
    share.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true, cancelable: true }));
    await waitUntil(() => share.submenuOpen, 'the submenu did not open');
    await child.updateComplete;
    const internals = child as unknown as { openSubmenuItem: () => unknown };
    const original = internals.openSubmenuItem;
    let calls = 0;
    internals.openSubmenuItem = function (this: unknown) {
      calls += 1;
      return original.call(this);
    };
    try {
      email.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, composed: true }));
    } finally {
      internals.openSubmenuItem = original;
    }
    expect(calls).to.equal(1);
  });
});
