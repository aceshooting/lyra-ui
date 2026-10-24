import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import './selection-toolbar.js';
import type { LyraSelectionToolbar } from './selection-toolbar.class.js';

function key(target: EventTarget, name: string): boolean {
  const event = new KeyboardEvent('keydown', { key: name, bubbles: true, composed: true, cancelable: true });
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('selection toolbar action ownership', () => {
  /** The native control inside a built-in action, which is what the roving group manages. */
  const nativeControl = (el: LyraSelectionToolbar, action: string): HTMLElement =>
    el.shadowRoot!.querySelector(`lr-button[data-action="${action}"]`)!.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;

  it('treats a slotted composite widget as one stop and leaves its items to that widget', async () => {
    const el = await fixture<LyraSelectionToolbar>(html`
      <lr-selection-toolbar open text="selected">
        <button slot="actions" id="plain" type="button">Plain</button>
        <div slot="actions" id="menu" role="menu"><button id="menu-item" role="menuitem" type="button">Item</button></div>
      </lr-selection-toolbar>
    `);
    const plain = el.querySelector<HTMLButtonElement>('#plain')!;
    const menu = el.querySelector<HTMLElement>('#menu')!;
    const menuItem = el.querySelector<HTMLButtonElement>('#menu-item')!;
    await waitUntil(() => plain.getAttribute('tabindex') === '-1');

    expect(menuItem.hasAttribute('tabindex'), 'the menu keeps its own roving focus').to.equal(false);
    el.shadowRoot!.querySelector('[part="toolbar"]')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', bubbles: true, composed: true })
    );
    await waitUntil(() => el.ownerDocument.activeElement === menu);
    expect(el.ownerDocument.activeElement === menuItem, 'focus never enters the menu item').to.equal(false);
  });

  it('does not consume keys the roving group does not own', async () => {
    const el = await fixture<LyraSelectionToolbar>(html`
      <lr-selection-toolbar open text="selected">
        <span slot="actions" id="decoration">Decoration</span>
      </lr-selection-toolbar>
    `);
    const ask = nativeControl(el, 'ask');
    await waitUntil(() => ask.getAttribute('tabindex') === '0');

    expect(key(ask, 'x'), 'a key no roving move maps to').to.equal(false);
    expect(key(el.querySelector('#decoration')!, 'ArrowRight'), 'a key that starts outside every action').to.equal(false);
    expect(key(ask, 'ArrowRight'), 'a roving move from an action').to.equal(true);

    el.actions = [];
    await el.updateComplete;
    await aTimeout(0);
    const toolbar = el.shadowRoot!.querySelector('[part="toolbar"]')!;
    expect(key(toolbar, 'ArrowRight'), 'a toolbar with only a decorative slotted child').to.equal(false);
  });
});

describe('selection toolbar lifecycle boundaries', () => {
  it('ignores an Escape that arrives after the host closed but before the overlay was released', async () => {
    const el = await fixture<LyraSelectionToolbar>(
      html`<lr-selection-toolbar open text="selected"></lr-selection-toolbar>`
    );
    let dismissals = 0;
    el.addEventListener('lr-dismiss', () => dismissals++);

    el.open = false;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(dismissals, 'no dismissal for a toolbar the host already closed').to.equal(0);
    await el.updateComplete;

    el.open = true;
    await el.updateComplete;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(dismissals, 'an open toolbar still dismisses').to.equal(1);
    expect(el.open).to.equal(false);
  });

  it('keeps an adopted open toolbar positioned and working in an owner window that has no ResizeObserver', async () => {
    const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
    const frameDocument = frame.contentDocument!;
    const frameWindow = frame.contentWindow!;
    const original = Object.getOwnPropertyDescriptor(frameWindow, 'ResizeObserver');
    const el = await fixture<LyraSelectionToolbar>(html`
      <lr-selection-toolbar open text="selected">
        <button slot="actions" id="translate" type="button">Translate</button>
      </lr-selection-toolbar>
    `);
    // The roving group is reconciled asynchronously; adopt only once its observer is live.
    await waitUntil(() => el.querySelector('#translate')!.getAttribute('tabindex') !== null);
    try {
      Object.defineProperty(frameWindow, 'ResizeObserver', { configurable: true, value: undefined });
      frameDocument.body.append(frameDocument.adoptNode(el));
      el.requestUpdate();
      await el.updateComplete;

      const toolbar = el.shadowRoot!.querySelector<HTMLElement>('[part="toolbar"]')!;
      await waitUntil(() => toolbar.hasAttribute('data-positioned'));
      expect(toolbar.ownerDocument === frameDocument).to.equal(true);
    } finally {
      el.remove();
      if (original) Object.defineProperty(frameWindow, 'ResizeObserver', original);
      else Reflect.deleteProperty(frameWindow, 'ResizeObserver');
    }
  });
});

describe('selection toolbar top layer', () => {
  it('keeps a promoted toolbar in the top layer and positioned across rect updates', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="transform: translateY(0); overflow: hidden; block-size: 20px; margin-block-start: 300px">
        <lr-selection-toolbar open text="selected passage" .rect=${new DOMRect(40, 140, 120, 20)}></lr-selection-toolbar>
      </div>
    `);
    const el = wrapper.querySelector('lr-selection-toolbar') as LyraSelectionToolbar;
    await el.updateComplete;
    const toolbar = el.shadowRoot!.querySelector<HTMLElement>('[part="toolbar"]')!;
    await waitUntil(() => toolbar.matches(':popover-open'), 'the trapped toolbar is promoted');

    el.rect = new DOMRect(90, 160, 100, 20);
    await el.updateComplete;

    expect(toolbar.matches(':popover-open')).to.equal(true);
    expect(toolbar.hasAttribute('data-positioned')).to.equal(true);
  });
});
