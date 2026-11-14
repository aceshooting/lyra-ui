import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './context-menu.js';
import '../../layout/menu/menu-item.js';
import '../../layout/menu/dropdown-item.js';
import '../overlay/dropdown.js';
import type { LyraContextMenu, LyraContextMenuShowDetail } from './context-menu.class.js';
import type { LyraDropdown } from '../overlay/dropdown.class.js';

(customElements.get('lr-context-menu') as unknown as { longPressDelayMs: number }).longPressDelayMs = 100;

function touch(type: string, target: Element, init: PointerEventInit = {}): PointerEvent {
  const rect = target.getBoundingClientRect();
  const event = new PointerEvent(type, {
    bubbles: true,
    composed: true,
    cancelable: true,
    pointerId: 7,
    pointerType: 'touch',
    isPrimary: true,
    button: type === 'pointerdown' ? 0 : -1,
    clientX: Math.round(rect.left + rect.width / 2),
    clientY: Math.round(rect.top + rect.height / 2),
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

function contextMenuAt(target: Element): boolean {
  const rect = target.getBoundingClientRect();
  return target.dispatchEvent(new MouseEvent('contextmenu', {
    bubbles: true,
    composed: true,
    cancelable: true,
    clientX: Math.round(rect.left + rect.width / 2),
    clientY: Math.round(rect.top + rect.height / 2),
  }));
}

function count(el: EventTarget, name: string): () => number {
  let total = 0;
  el.addEventListener(name, (event) => {
    if (event.target === el) total += 1;
  });
  return () => total;
}

async function basic(): Promise<LyraContextMenu> {
  const wrapper = await fixture<HTMLElement>(html`
    <div style="padding: 40px">
      <lr-context-menu style="--show-duration: 0ms; --hide-duration: 0ms" label="Row actions">
        <div slot="trigger" id="area" style="inline-size: 300px; block-size: 160px">
          <button id="btn">Row</button>
          <span id="plain">Plain text</span>
        </div>
        <lr-menu-item value="copy" id="copy">Copy</lr-menu-item>
        <lr-menu-item value="paste" id="paste">Paste</lr-menu-item>
      </lr-context-menu>
      <button id="outside">Outside</button>
    </div>
  `);
  const menu = wrapper.querySelector('lr-context-menu') as LyraContextMenu;
  await menu.updateComplete;
  return menu;
}

describe('lr-context-menu gesture and lifecycle edges', () => {
  it('reports closed and resolves hide() before the element has ever rendered', async () => {
    const el = document.createElement('lr-context-menu') as LyraContextMenu;
    expect(el.open).to.equal(false);
    let settled = false;
    await el.hide().then(() => {
      settled = true;
    });
    expect(settled).to.equal(true);
  });

  it('re-anchors an open menu onto a new context element and adopts a new return target', async () => {
    const el = await basic();
    const shows = count(el, 'lr-show');
    const shown = oneEvent(el, 'lr-after-show');
    el.showAt({ x: 60, y: 60 });
    await shown;
    const plain = el.querySelector<HTMLElement>('#plain')!;
    const outside = document.getElementById('outside') as HTMLButtonElement;
    el.showAt({ x: 80, y: 90, contextElement: plain }, { returnFocusTo: outside });
    expect(shows()).to.equal(1);
    expect(el.open).to.equal(true);
    // The new context element is now watched: removing it closes the menu.
    const hidden = oneEvent(el, 'lr-after-hide');
    plain.remove();
    window.dispatchEvent(new Event('resize'));
    await hidden;
    expect(el.open).to.equal(false);
  });

  it('reports only the context element itself when it is not inside the trigger region', async () => {
    const el = await basic();
    let detail: LyraContextMenuShowDetail | undefined;
    el.addEventListener('lr-show', (event) => {
      detail = (event as CustomEvent<LyraContextMenuShowDetail>).detail;
    });
    const shown = oneEvent(el, 'lr-after-show');
    const item = el.querySelector<HTMLElement>('#paste')!;
    el.showAt({ x: 50, y: 50, contextElement: item });
    await shown;
    expect(detail?.path.map((node) => node.id)).to.deep.equal(['paste']);
    expect(detail?.target === item).to.equal(true);
  });

  it('does not open when an lr-show listener disables the menu', async () => {
    const el = await basic();
    el.addEventListener('lr-show', () => {
      el.disabled = true;
    });
    const afterShows = count(el, 'lr-after-show');
    el.showAt({ x: 40, y: 40 });
    expect(el.open).to.equal(false);
    // wait-reason: proves no deferred open follows the refused request
    await aTimeout(50);
    expect(afterShows()).to.equal(0);
    expect(el.open).to.equal(false);
  });

  it('ignores pointer moves from another pointer while a long-press is pending', async () => {
    const el = await basic();
    const area = el.querySelector<HTMLElement>('#area')!;
    const shown = oneEvent(el, 'lr-show');
    touch('pointerdown', area);
    // A far-away move from a different pointer must not cancel the press.
    touch('pointermove', area, { pointerId: 99, clientX: 2000, clientY: 2000 });
    // A small jitter from the pressing pointer stays within the tolerance.
    const rect = area.getBoundingClientRect();
    touch('pointermove', area, { clientX: Math.round(rect.left + rect.width / 2) + 1, clientY: Math.round(rect.top + rect.height / 2) });
    const event = (await shown) as CustomEvent<LyraContextMenuShowDetail>;
    expect(event.detail.source).to.equal('long-press');
    touch('pointerup', area);
    await el.hide({ focusTrigger: false });
  });

  it('keeps refusing repeat contextmenu events that follow a vetoed long-press', async () => {
    const el = await basic();
    const area = el.querySelector<HTMLElement>('#area')!;
    const shows = count(el, 'lr-show');
    el.addEventListener('lr-show', (event) => event.preventDefault());
    const asked = oneEvent(el, 'lr-show');
    touch('pointerdown', area);
    await asked;
    expect(el.open).to.equal(false);
    // The platform's contextmenu for the vetoed press is consumed by the gesture record...
    expect(contextMenuAt(area)).to.equal(true);
    // ...and a repeat during the same decided press neither asks again nor opens the menu.
    expect(contextMenuAt(area)).to.equal(true);
    expect(shows()).to.equal(1);
    expect(el.open).to.equal(false);
    touch('pointerup', area);
  });

  it('clears an element-anchored selection created during a long-press', async () => {
    const el = await basic();
    const area = el.querySelector<HTMLElement>('#area')!;
    const selection = document.getSelection()!;
    selection.removeAllRanges();
    const shown = oneEvent(el, 'lr-after-show');
    touch('pointerdown', area);
    // The press grows an element-anchored (not text-anchored) selection inside the region.
    selection.setBaseAndExtent(area, 0, area, area.childNodes.length);
    expect(selection.isCollapsed).to.equal(false);
    await shown;
    expect(selection.rangeCount === 0 || selection.isCollapsed).to.equal(true);
    touch('pointerup', area);
    await el.hide({ focusTrigger: false });
  });

  it('ignores the context-menu key pressed inside an open dropdown in the region', async () => {
    const el = await fixture<LyraContextMenu>(html`
      <lr-context-menu style="--show-duration: 0ms; --hide-duration: 0ms">
        <div slot="trigger" style="padding: 8px">
          <lr-dropdown id="dd" style="--show-duration: 0ms; --hide-duration: 0ms">
            <button slot="trigger" id="dd-trigger">Menu</button>
            <lr-dropdown-item value="one" id="dd-row">One</lr-dropdown-item>
          </lr-dropdown>
        </div>
        <lr-menu-item value="a">Alpha</lr-menu-item>
      </lr-context-menu>
    `);
    const shows = count(el, 'lr-show');
    const dropdown = el.querySelector<LyraDropdown>('#dd')!;
    const opened = oneEvent(dropdown, 'lr-after-show');
    void dropdown.show();
    await opened;
    const row = el.querySelector<HTMLElement>('#dd-row')!;
    await waitUntil(() => {
      let active: Element | null = document.activeElement;
      while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
      return active !== null && active !== document.body;
    }, 'dropdown focused its row');
    row.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'F10', shiftKey: true, bubbles: true, composed: true, cancelable: true,
    }));
    expect(shows()).to.equal(0);
    expect(el.open).to.equal(false);
    expect(dropdown.open).to.equal(true);
    const closed = oneEvent(dropdown, 'lr-after-hide');
    void dropdown.hide();
    await closed;
  });

  it('lets a nested dropdown inside the menu run its own lifecycle without re-emitting the menu events', async () => {
    const el = await fixture<LyraContextMenu>(html`
      <lr-context-menu style="--show-duration: 0ms; --hide-duration: 0ms">
        <div slot="trigger" id="area" style="inline-size: 200px; block-size: 80px"></div>
        <lr-dropdown id="inner" style="--show-duration: 0ms; --hide-duration: 0ms">
          <button slot="trigger" id="inner-trigger">More</button>
          <lr-dropdown-item value="x">X</lr-dropdown-item>
        </lr-dropdown>
      </lr-context-menu>
    `);
    const outerShows = count(el, 'lr-show');
    const outerAfterShows = count(el, 'lr-after-show');
    const outerHides = count(el, 'lr-hide');
    const outerAfterHides = count(el, 'lr-after-hide');
    const shown = oneEvent(el, 'lr-after-show');
    el.showAt({ x: 30, y: 30 });
    await shown;
    const inner = el.querySelector<LyraDropdown>('#inner')!;
    const innerSeen: string[] = [];
    for (const name of ['lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide']) {
      document.addEventListener(name, (event) => {
        if (event.target === inner) innerSeen.push(name);
      }, { once: true });
    }
    const innerShown = oneEvent(inner, 'lr-after-show');
    void inner.show();
    await innerShown;
    expect(inner.open).to.equal(true);
    const innerHidden = oneEvent(inner, 'lr-after-hide');
    void inner.hide();
    await innerHidden;
    // The nested lifecycle events reach the document unchanged...
    expect(innerSeen).to.deep.equal(['lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide']);
    // ...and the context menu itself neither re-emitted nor closed.
    expect(outerShows()).to.equal(1);
    expect(outerAfterShows()).to.equal(1);
    expect(outerHides()).to.equal(0);
    expect(outerAfterHides()).to.equal(0);
    await el.hide({ focusTrigger: false });
  });
});
