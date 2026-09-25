import { aTimeout, expect, fixture, html, nextFrame, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys, setViewport } from '@web/test-runner-commands';
import './context-menu.js';
import '../../layout/menu/dropdown-item.js';
import '../../layout/menu/menu-label.js';
import '../overlay/dropdown.js';
import '../dialog/dialog.js';
import '../../forms/button/button.js';
import type {
  LyraContextMenu,
  LyraContextMenuShowDetail,
} from './context-menu.class.js';
import type { LyraDropdown } from '../overlay/dropdown.class.js';
import type { LyraDialog } from '../dialog/dialog.class.js';
import type { LyraMenuItem } from '../../layout/menu/menu-item.class.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { setReducedMotion } from '../../../../test/wtr-media.js';

const GAP = 2;
const HOLD_MS = 650;

interface Recorder {
  readonly log: string[];
  readonly shows: LyraContextMenuShowDetail[];
  count(name: string): number;
}

function record(el: EventTarget): Recorder {
  const log: string[] = [];
  const shows: LyraContextMenuShowDetail[] = [];
  for (const name of ['lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide']) {
    el.addEventListener(name, (event) => {
      if (event.target !== el) return;
      log.push(name);
      if (name === 'lr-show') shows.push((event as CustomEvent<LyraContextMenuShowDetail>).detail);
    });
  }
  return { log, shows, count: (name) => log.filter((entry) => entry === name).length };
}

function shell(el: LyraContextMenu): LyraDropdown {
  return el.shadowRoot!.querySelector('.shell') as LyraDropdown;
}

function popup(el: LyraContextMenu): HTMLElement {
  return shell(el).shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
}

function deepActiveId(): string {
  let active: Element | null = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active?.id ?? '';
}

function byId<T extends HTMLElement = HTMLElement>(root: ParentNode, id: string): T {
  return root.querySelector(`#${id}`) as T;
}

function center(target: Element): [number, number] {
  const rect = target.getBoundingClientRect();
  return [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)];
}

async function rightClick(x: number, y: number): Promise<void> {
  await sendMouse({ type: 'click', position: [x, y], button: 'right' });
}

async function openByRightClick(el: LyraContextMenu, x: number, y: number): Promise<void> {
  const shown = oneEvent(el, 'lr-after-show');
  await rightClick(x, y);
  await shown;
}

function syntheticContextMenu(target: Element, x = 0, y = 0): boolean {
  return target.dispatchEvent(new MouseEvent('contextmenu', {
    bubbles: true,
    composed: true,
    cancelable: true,
    clientX: x,
    clientY: y,
  }));
}

function touch(
  type: string,
  target: Element,
  x: number,
  y: number,
  init: PointerEventInit = {},
): PointerEvent {
  const event = new PointerEvent(type, {
    bubbles: true,
    composed: true,
    cancelable: true,
    pointerId: 7,
    pointerType: 'touch',
    isPrimary: true,
    button: type === 'pointerdown' ? 0 : -1,
    clientX: x,
    clientY: y,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

async function hold(target: Element, init: PointerEventInit = {}): Promise<PointerEvent> {
  const [x, y] = center(target);
  const down = touch('pointerdown', target, x, y, init);
  await aTimeout(HOLD_MS);
  return down;
}

function release(target: Element): void {
  const [x, y] = center(target);
  touch('pointerup', target, x, y);
}

function near(actual: number, expected: number, tolerance = 2): boolean {
  return Math.abs(actual - expected) <= tolerance;
}

async function frames(): Promise<void> {
  await nextFrame();
  await nextFrame();
}

async function basic(extra: { label?: string; dir?: string } = {}): Promise<LyraContextMenu> {
  const el = await fixture<LyraContextMenu>(html`
    <div dir=${extra.dir ?? 'ltr'} style="padding: 40px">
      <lr-context-menu
        style="--show-duration: 0ms; --hide-duration: 0ms"
        label=${extra.label ?? 'Row actions'}
      >
        <div slot="trigger" id="area" style="inline-size: 300px; block-size: 160px; background: #eee">
          <button id="btn">Row</button>
          <span id="plain">Plain text</span>
        </div>
        <lr-menu-item value="copy" id="copy">Copy</lr-menu-item>
        <lr-menu-item value="paste" id="paste">Paste</lr-menu-item>
        <hr id="sep" />
        <lr-menu-item value="delete" id="delete" variant="danger">Delete</lr-menu-item>
      </lr-context-menu>
      <button id="after">After</button>
    </div>
  `);
  const menu = el.querySelector('lr-context-menu') as LyraContextMenu;
  await menu.updateComplete;
  return menu;
}

afterEach(async () => {
  await resetMouse();
});

describe('<lr-context-menu>', () => {
  describe('rendering and API', () => {
    it('is layout-transparent and hides the unused dropdown trigger wrapper', async () => {
      const wrapper = await fixture<HTMLElement>(html`
        <div style="display: flex; gap: 12px">
          <span style="inline-size: 40px">A</span>
          <lr-context-menu><span slot="trigger" id="with">B</span></lr-context-menu>
        </div>
      `);
      const reference = await fixture<HTMLElement>(html`
        <div style="display: flex; gap: 12px">
          <span style="inline-size: 40px">A</span>
          <span id="without">B</span>
        </div>
      `);
      const menu = wrapper.querySelector('lr-context-menu') as LyraContextMenu;
      await menu.updateComplete;
      const withLeft = byId(wrapper, 'with').getBoundingClientRect().left - wrapper.getBoundingClientRect().left;
      const withoutLeft = byId(reference, 'without').getBoundingClientRect().left - reference.getBoundingClientRect().left;
      expect(near(withLeft, withoutLeft, 0.5)).to.equal(true);
      const triggerPart = shell(menu).shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
      expect(getComputedStyle(triggerPart).display).to.equal('none');
    });

    it('has the documented defaults', async () => {
      const el = await fixture<LyraContextMenu>(html`<lr-context-menu></lr-context-menu>`);
      expect(el.disabled).to.equal(false);
      expect(el.size).to.equal('m');
      expect(el.label).to.equal(undefined);
      expect(el.open).to.equal(false);
      expect(el.matches(':state(open)')).to.equal(false);
    });
  });

  describe('pointer', () => {
    it('opens once beside the pointer on a native right-click and prevents the platform menu', async () => {
      const el = await basic();
      const events = record(el);
      let nativePrevented: boolean | undefined;
      const onNative = (event: Event): void => {
        nativePrevented = event.defaultPrevented;
      };
      window.addEventListener('contextmenu', onNative);
      try {
        const [x, y] = center(byId(el, 'plain'));
        await openByRightClick(el, x, y);
        expect(events.count('lr-show')).to.equal(1);
        expect(events.count('lr-after-show')).to.equal(1);
        const detail = events.shows[0]!;
        expect(detail.source).to.equal('pointer');
        expect(near(detail.clientX, x)).to.equal(true);
        expect(near(detail.clientY, y)).to.equal(true);
        expect(detail.target?.id).to.equal('plain');
        expect(detail.originalEvent?.type).to.equal('contextmenu');
        expect(nativePrevented).to.equal(true);
        const rect = popup(el).getBoundingClientRect();
        expect(near(rect.left, x + GAP)).to.equal(true);
        expect(near(rect.top, y)).to.equal(true);
        expect(el.open).to.equal(true);
        expect(el.matches(':state(open)')).to.equal(true);
      } finally {
        window.removeEventListener('contextmenu', onNative);
      }
    });

    it('mirrors to the inline-start side of the pointer under RTL', async () => {
      const el = await basic({ dir: 'rtl' });
      const [x, y] = center(byId(el, 'plain'));
      await openByRightClick(el, x, y);
      expect(near(popup(el).getBoundingClientRect().right, x - GAP)).to.equal(true);
    });

    it('flips at the viewport edges', async () => {
      const el = await fixture<LyraContextMenu>(html`
        <lr-context-menu style="--show-duration: 0ms; --hide-duration: 0ms">
          <div slot="trigger" id="area" style="position: fixed; inset: 0"></div>
          <lr-menu-item value="a">Alpha row with some width</lr-menu-item>
          <lr-menu-item value="b">Beta</lr-menu-item>
        </lr-context-menu>
      `);
      const x = window.innerWidth - 10;
      const y = window.innerHeight - 10;
      await openByRightClick(el, x, 40);
      expect(popup(el).getBoundingClientRect().right <= x - GAP + 1).to.equal(true);
      const hidden = oneEvent(el, 'lr-after-hide');
      void el.hide();
      await hidden;
      await openByRightClick(el, 40, y);
      expect(popup(el).getBoundingClientRect().bottom <= y + 1).to.equal(true);
    });

    it('leaves the platform menu alone when lr-show is vetoed', async () => {
      const el = await basic();
      const events = record(el);
      el.addEventListener('lr-show', (event) => event.preventDefault());
      let nativePrevented: boolean | undefined;
      const onNative = (event: Event): void => {
        nativePrevented = event.defaultPrevented;
      };
      window.addEventListener('contextmenu', onNative);
      try {
        const [x, y] = center(byId(el, 'plain'));
        await rightClick(x, y);
        await frames();
        expect(events.count('lr-show')).to.equal(1);
        expect(events.count('lr-after-show')).to.equal(0);
        expect(nativePrevented).to.equal(false);
        expect(el.open).to.equal(false);
      } finally {
        window.removeEventListener('contextmenu', onNative);
      }
    });

    it('ignores gestures while disabled and closes when disabled while open', async () => {
      const el = await basic();
      const events = record(el);
      el.disabled = true;
      await el.updateComplete;
      const area = byId(el, 'area');
      expect(syntheticContextMenu(area, ...center(area))).to.equal(true);
      expect(events.count('lr-show')).to.equal(0);
      el.disabled = false;
      await el.updateComplete;
      await openByRightClick(el, ...center(byId(el, 'plain')));
      const hidden = oneEvent(el, 'lr-after-hide');
      el.disabled = true;
      await hidden;
      expect(events.count('lr-hide')).to.equal(1);
      expect(el.open).to.equal(false);
    });

    it('ignores a contextmenu a descendant already prevented', async () => {
      const el = await basic();
      const events = record(el);
      const plain = byId(el, 'plain');
      plain.addEventListener('contextmenu', (event) => event.preventDefault());
      syntheticContextMenu(plain, ...center(plain));
      await frames();
      expect(events.count('lr-show')).to.equal(0);
    });

    it('claims surface right-clicks and keeps the native menu only for editable surface targets', async () => {
      const el = await fixture<LyraContextMenu>(html`
        <lr-context-menu style="--show-duration: 0ms; --hide-duration: 0ms">
          <div slot="trigger" id="area" style="inline-size: 300px; block-size: 120px"></div>
          <lr-menu label="Actions">
            <input slot="header" id="filter" aria-label="Filter" />
            <lr-menu-label id="label">Group</lr-menu-label>
            <lr-menu-item value="a" id="row">Alpha</lr-menu-item>
            <hr id="sep" />
            <lr-menu-item value="b">Beta</lr-menu-item>
          </lr-menu>
        </lr-context-menu>
      `);
      const events = record(el);
      await openByRightClick(el, 20, 20);
      for (const id of ['row', 'label', 'sep']) {
        const target = byId(el, id);
        expect(syntheticContextMenu(target, ...center(target)), id).to.equal(false);
      }
      const filter = byId(el, 'filter');
      expect(syntheticContextMenu(filter, ...center(filter))).to.equal(true);
      let paddingPrevented: boolean | undefined;
      const onNative = (event: Event): void => {
        paddingPrevented = event.defaultPrevented;
      };
      window.addEventListener('contextmenu', onNative);
      try {
        const rect = popup(el).getBoundingClientRect();
        await rightClick(Math.round(rect.right - 2), Math.round(rect.bottom - 2));
        await frames();
      } finally {
        window.removeEventListener('contextmenu', onNative);
      }
      expect(paddingPrevented).to.equal(true);
      expect(events.count('lr-show')).to.equal(1);
      expect(el.open).to.equal(true);
    });

    it('closes and reopens at the new point on a second right-click in the region', async () => {
      const el = await basic();
      const area = byId(el, 'area');
      const rect = area.getBoundingClientRect();
      await openByRightClick(el, Math.round(rect.left + 20), Math.round(rect.top + 20));
      const events = record(el);
      const x = Math.round(rect.left + 200);
      const y = Math.round(rect.top + 120);
      await openByRightClick(el, x, y);
      expect(events.count('lr-hide')).to.equal(1);
      expect(events.count('lr-show')).to.equal(1);
      expect(events.count('lr-after-show')).to.equal(1);
      const afterHide = events.log.indexOf('lr-after-hide');
      expect(events.count('lr-after-hide') <= 1).to.equal(true);
      if (afterHide !== -1) expect(afterHide < events.log.indexOf('lr-show')).to.equal(true);
      expect(near(events.shows[0]!.clientX, x)).to.equal(true);
      expect(near(popup(el).getBoundingClientRect().left, x + GAP)).to.equal(true);
      expect(el.open).to.equal(true);
    });

    it('closes on an outside primary click and lets the pointer keep its focus', async () => {
      const el = await basic();
      const events = record(el);
      await openByRightClick(el, ...center(byId(el, 'plain')));
      const hidden = oneEvent(el, 'lr-after-hide');
      await sendMouse({ type: 'click', position: center(document.getElementById('after')!) });
      await hidden;
      await frames();
      expect(el.open).to.equal(false);
      expect(events.count('lr-hide')).to.equal(1);
      expect(deepActiveId()).to.equal('after');
    });

    it('opens with a gap so the pointer never starts over the surface', async () => {
      const el = await fixture<LyraContextMenu>(html`
        <lr-context-menu style="--show-duration: 0ms; --hide-duration: 0ms">
          <div slot="trigger" id="area" style="inline-size: 300px; block-size: 160px"></div>
          <lr-menu-item value="more" id="parent">
            More
            <lr-menu-item slot="submenu" value="child">Child</lr-menu-item>
          </lr-menu-item>
          <lr-menu-item value="b">Beta</lr-menu-item>
        </lr-context-menu>
      `);
      const [x, y] = center(byId(el, 'area'));
      await openByRightClick(el, x, y);
      const hit = document.elementFromPoint(x, y);
      expect(hit?.id).to.equal('area');
      await aTimeout(250);
      const rows = [...el.querySelectorAll('lr-menu-item')];
      expect(rows.some((row) => row.matches(':hover'))).to.equal(false);
      expect((byId(el, 'parent') as LyraMenuItem).submenuOpen ?? false).to.equal(false);
    });
  });

  describe('keyboard', () => {
    it('opens below the focused element on Shift+F10 and focuses the first row', async () => {
      const el = await basic();
      const events = record(el);
      const button = byId(el, 'btn');
      button.focus();
      const shown = oneEvent(el, 'lr-after-show');
      await sendKeys({ press: 'Shift+F10' });
      await shown;
      await waitUntil(() => deepActiveId() === 'copy', 'first row focused');
      expect(events.count('lr-show')).to.equal(1);
      expect(events.shows[0]!.source).to.equal('keyboard');
      expect(events.shows[0]!.target?.id).to.equal('btn');
      const anchor = button.getBoundingClientRect();
      const rect = popup(el).getBoundingClientRect();
      expect(near(rect.top, anchor.bottom)).to.equal(true);
      expect(near(rect.left, anchor.left + GAP)).to.equal(true);
    });

    it('opens on the ContextMenu key', async () => {
      const el = await basic();
      const events = record(el);
      byId(el, 'btn').focus();
      const shown = oneEvent(el, 'lr-after-show');
      await sendKeys({ press: 'ContextMenu' });
      await shown;
      expect(events.shows[0]!.source).to.equal('keyboard');
      await waitUntil(() => deepActiveId() === 'copy', 'first row focused');
    });

    it('anchors at the inline-start edge of the focused element under RTL', async () => {
      const el = await basic({ dir: 'rtl' });
      const button = byId(el, 'btn');
      button.focus();
      const shown = oneEvent(el, 'lr-after-show');
      await sendKeys({ press: 'Shift+F10' });
      await shown;
      expect(near(popup(el).getBoundingClientRect().right, button.getBoundingClientRect().right - GAP))
        .to.equal(true);
    });

    it('dedupes the platform contextmenu that follows a keyboard gesture', async () => {
      const el = await basic();
      const events = record(el);
      const button = byId(el, 'btn');
      button.focus();
      const shown = oneEvent(el, 'lr-after-show');
      await sendKeys({ press: 'Shift+F10' });
      await shown;
      expect(syntheticContextMenu(button)).to.equal(false);
      expect(events.count('lr-show')).to.equal(1);
    });

    it('does not ask twice after a vetoed keyboard gesture, and asks again after a new key', async () => {
      const el = await basic();
      const events = record(el);
      el.addEventListener('lr-show', (event) => event.preventDefault());
      const button = byId(el, 'btn');
      button.focus();
      const natives: boolean[] = [];
      const onNative = (event: Event): void => {
        natives.push(event.defaultPrevented);
      };
      window.addEventListener('contextmenu', onNative);
      try {
        await sendKeys({ press: 'Shift+F10' });
        await frames();
        if (natives.length === 0) expect(syntheticContextMenu(button)).to.equal(true);
        else expect(natives.every((prevented) => !prevented)).to.equal(true);
        expect(events.count('lr-show')).to.equal(1);
        button.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, composed: true }));
        expect(syntheticContextMenu(button)).to.equal(true);
        expect(events.count('lr-show')).to.equal(2);
      } finally {
        window.removeEventListener('contextmenu', onNative);
      }
    });

    it('ignores modified, composing and already-prevented keys', async () => {
      const el = await basic();
      const events = record(el);
      const button = byId(el, 'btn');
      const key = (init: KeyboardEventInit): void => {
        button.dispatchEvent(new KeyboardEvent('keydown', {
          bubbles: true,
          composed: true,
          cancelable: true,
          ...init,
        }));
      };
      key({ key: 'F10', shiftKey: true, ctrlKey: true });
      key({ key: 'F10', shiftKey: true, altKey: true });
      key({ key: 'F10', shiftKey: true, metaKey: true });
      key({ key: 'ContextMenu', isComposing: true });
      const prevented = (event: Event): void => event.preventDefault();
      button.addEventListener('keydown', prevented);
      key({ key: 'ContextMenu' });
      button.removeEventListener('keydown', prevented);
      await frames();
      expect(events.count('lr-show')).to.equal(0);
    });

    it('silently re-anchors on Shift+F10 while open', async () => {
      const el = await fixture<LyraContextMenu>(html`
        <lr-context-menu style="--show-duration: 0ms; --hide-duration: 0ms">
          <div slot="trigger" style="padding: 8px"><button id="btn">Row</button></div>
          <lr-menu-item value="a" disabled>Only</lr-menu-item>
        </lr-context-menu>
      `);
      const events = record(el);
      const button = byId(el, 'btn');
      button.focus();
      const shown = oneEvent(el, 'lr-after-show');
      await sendKeys({ press: 'Shift+F10' });
      await shown;
      expect(deepActiveId()).to.equal('btn');
      button.style.marginTop = '40px';
      let prevented: boolean | undefined;
      const onKey = (event: KeyboardEvent): void => {
        if (event.key === 'F10') prevented = event.defaultPrevented;
      };
      window.addEventListener('keydown', onKey);
      try {
        await sendKeys({ press: 'Shift+F10' });
      } finally {
        window.removeEventListener('keydown', onKey);
      }
      await waitUntil(
        () => near(popup(el).getBoundingClientRect().top, button.getBoundingClientRect().bottom),
        'popup re-anchored below the moved button',
      );
      expect(prevented).to.equal(true);
      expect(events.count('lr-show')).to.equal(1);
      expect(events.count('lr-after-show')).to.equal(1);
      expect(el.open).to.equal(true);
    });
  });

  describe('focus return', () => {
    it('returns focus only to a target related to the gesture', async () => {
      const wrapper = await fixture<HTMLElement>(html`
        <div>
          <input id="outside" aria-label="Search" />
          <lr-context-menu style="--show-duration: 0ms; --hide-duration: 0ms">
            <div slot="trigger" id="area" style="inline-size: 200px; block-size: 80px">
              <button id="btn">Row</button>
            </div>
            <lr-menu-item value="a" id="first">Alpha</lr-menu-item>
          </lr-context-menu>
        </div>
      `);
      const el = wrapper.querySelector('lr-context-menu') as LyraContextMenu;
      const outside = byId<HTMLInputElement>(wrapper, 'outside');

      outside.focus();
      let shown = oneEvent(el, 'lr-after-show');
      const down = await hold(byId(el, 'area'));
      await shown;
      release(byId(el, 'area'));
      void down;
      await waitUntil(() => deepActiveId() === 'first', 'first row focused after long-press');
      let hidden = oneEvent(el, 'lr-after-hide');
      await sendKeys({ press: 'Enter' });
      await hidden;
      await frames();
      expect(deepActiveId()).to.not.equal('outside');

      byId(el, 'btn').focus();
      shown = oneEvent(el, 'lr-after-show');
      await sendKeys({ press: 'Shift+F10' });
      await shown;
      await waitUntil(() => deepActiveId() === 'first', 'first row focused after keyboard open');
      hidden = oneEvent(el, 'lr-after-hide');
      await sendKeys({ press: 'Escape' });
      await hidden;
      await waitUntil(() => deepActiveId() === 'btn', 'focus returned to the region button');

      outside.focus();
      shown = oneEvent(el, 'lr-after-show');
      el.showAt({ x: 50, y: 50 });
      await shown;
      hidden = oneEvent(el, 'lr-after-hide');
      await sendKeys({ press: 'Escape' });
      await hidden;
      await frames();
      expect(deepActiveId()).to.not.equal('outside');

      outside.focus();
      shown = oneEvent(el, 'lr-after-show');
      el.showAt({ x: 50, y: 50 }, { returnFocusTo: outside });
      await shown;
      await waitUntil(() => deepActiveId() === 'first', 'first row focused after showAt');
      hidden = oneEvent(el, 'lr-after-hide');
      await sendKeys({ press: 'Escape' });
      await hidden;
      await waitUntil(() => deepActiveId() === 'outside', 'explicit return target focused');
    });
  });

  describe('menu integration', () => {
    it('navigates rows and skips disabled and inert rows', async () => {
      const el = await fixture<LyraContextMenu>(html`
        <lr-context-menu style="--show-duration: 0ms; --hide-duration: 0ms">
          <div slot="trigger"><button id="btn">Row</button></div>
          <lr-menu-item value="a" id="a">Alpha</lr-menu-item>
          <lr-menu-item value="b" id="b" disabled>Bravo</lr-menu-item>
          <lr-menu-item value="c" id="c" inert>Charlie</lr-menu-item>
          <lr-menu-item value="d" id="d">Delta</lr-menu-item>
          <lr-menu-item value="e" id="e">Echo</lr-menu-item>
        </lr-context-menu>
      `);
      byId(el, 'btn').focus();
      const shown = oneEvent(el, 'lr-after-show');
      await sendKeys({ press: 'Shift+F10' });
      await shown;
      await waitUntil(() => deepActiveId() === 'a', 'first row focused');
      await sendKeys({ press: 'ArrowDown' });
      expect(deepActiveId()).to.equal('d');
      await sendKeys({ press: 'End' });
      expect(deepActiveId()).to.equal('e');
      await sendKeys({ press: 'Home' });
      expect(deepActiveId()).to.equal('a');
      await sendKeys({ press: 'e' });
      await waitUntil(() => deepActiveId() === 'e', 'type-ahead moves to Echo');
    });

    it('opens and closes submenus and returns focus after the final Escape', async () => {
      const el = await fixture<LyraContextMenu>(html`
        <lr-context-menu style="--show-duration: 0ms; --hide-duration: 0ms">
          <div slot="trigger"><button id="btn">Row</button></div>
          <lr-menu-item value="more" id="parent">
            More
            <lr-menu-item slot="submenu" value="child" id="child">Child</lr-menu-item>
          </lr-menu-item>
        </lr-context-menu>
      `);
      byId(el, 'btn').focus();
      const shown = oneEvent(el, 'lr-after-show');
      await sendKeys({ press: 'Shift+F10' });
      await shown;
      await waitUntil(() => deepActiveId() === 'parent', 'parent focused');
      await sendKeys({ press: 'ArrowRight' });
      await waitUntil(() => deepActiveId() === 'child', 'submenu opened');
      await sendKeys({ press: 'Escape' });
      await waitUntil(() => deepActiveId() === 'parent', 'submenu closed');
      expect(el.open).to.equal(true);
      const hidden = oneEvent(el, 'lr-after-hide');
      await sendKeys({ press: 'Escape' });
      await hidden;
      await waitUntil(() => deepActiveId() === 'btn', 'focus returned');
    });

    it('opens submenus with ArrowLeft under RTL', async () => {
      const wrapper = await fixture<HTMLElement>(html`
        <div dir="rtl">
          <lr-context-menu style="--show-duration: 0ms; --hide-duration: 0ms">
            <div slot="trigger"><button id="btn">Row</button></div>
            <lr-menu-item value="more" id="parent">
              More
              <lr-menu-item slot="submenu" value="child" id="child">Child</lr-menu-item>
            </lr-menu-item>
          </lr-context-menu>
        </div>
      `);
      const el = wrapper.querySelector('lr-context-menu') as LyraContextMenu;
      byId(el, 'btn').focus();
      const shown = oneEvent(el, 'lr-after-show');
      await sendKeys({ press: 'Shift+F10' });
      await shown;
      await waitUntil(() => deepActiveId() === 'parent', 'parent focused');
      await sendKeys({ press: 'ArrowLeft' });
      await waitUntil(() => deepActiveId() === 'child', 'submenu opened with ArrowLeft');
    });

    it('lets lr-select through once and keeps the menu open when it is prevented', async () => {
      const el = await basic();
      const selected: string[] = [];
      el.addEventListener('lr-select', (event) => {
        selected.push(((event as CustomEvent<{ item: LyraMenuItem }>).detail.item.value) ?? '');
      });
      const events = record(el);
      byId(el, 'btn').focus();
      let shown = oneEvent(el, 'lr-after-show');
      await sendKeys({ press: 'Shift+F10' });
      await shown;
      await waitUntil(() => deepActiveId() === 'copy', 'first row focused');
      const hidden = oneEvent(el, 'lr-after-hide');
      await sendKeys({ press: 'Enter' });
      await hidden;
      expect(selected).to.deep.equal(['copy']);
      expect(events.count('lr-hide')).to.equal(1);
      await waitUntil(() => deepActiveId() === 'btn', 'focus returned after activation');

      const veto = (event: Event): void => event.preventDefault();
      el.addEventListener('lr-select', veto);
      shown = oneEvent(el, 'lr-after-show');
      await sendKeys({ press: 'Shift+F10' });
      await shown;
      await waitUntil(() => deepActiveId() === 'copy', 'first row focused again');
      await sendKeys({ press: 'Enter' });
      await frames();
      expect(el.open).to.equal(true);
      el.removeEventListener('lr-select', veto);
    });

    it('stays open when lr-hide is vetoed on Escape', async () => {
      const el = await basic();
      byId(el, 'btn').focus();
      const shown = oneEvent(el, 'lr-after-show');
      await sendKeys({ press: 'Shift+F10' });
      await shown;
      await waitUntil(() => deepActiveId() === 'copy', 'first row focused');
      const veto = (event: Event): void => event.preventDefault();
      el.addEventListener('lr-hide', veto);
      await sendKeys({ press: 'Escape' });
      await frames();
      expect(el.open).to.equal(true);
      expect(el.matches(':state(open)')).to.equal(true);
      el.removeEventListener('lr-hide', veto);
    });

    it('closes without restoring focus when Tab leaves the surface', async () => {
      const el = await basic();
      const events = record(el);
      byId(el, 'btn').focus();
      const shown = oneEvent(el, 'lr-after-show');
      await sendKeys({ press: 'Shift+F10' });
      await shown;
      await waitUntil(() => deepActiveId() === 'copy', 'first row focused');
      const hidden = oneEvent(el, 'lr-after-hide');
      await sendKeys({ press: 'Tab' });
      await hidden;
      await frames();
      expect(events.count('lr-hide')).to.equal(1);
      expect(deepActiveId()).to.equal('after');
    });

    it('stays open while Tab moves between a consumer menu header, rows and footer', async () => {
      const el = await fixture<LyraContextMenu>(html`
        <lr-context-menu style="--show-duration: 0ms; --hide-duration: 0ms">
          <div slot="trigger"><button id="btn">Row</button></div>
          <lr-menu label="Actions">
            <input slot="header" id="filter" aria-label="Filter" />
            <lr-menu-item value="a" id="a">Alpha</lr-menu-item>
            <button slot="footer" id="footer">Manage</button>
          </lr-menu>
        </lr-context-menu>
      `);
      byId(el, 'btn').focus();
      const shown = oneEvent(el, 'lr-after-show');
      await sendKeys({ press: 'Shift+F10' });
      await shown;
      byId(el, 'filter').focus();
      await sendKeys({ press: 'Tab' });
      await sendKeys({ press: 'Tab' });
      await frames();
      expect(deepActiveId()).to.equal('footer');
      expect(el.open).to.equal(true);
    });

    it('propagates size to the rows', async () => {
      const el = await fixture<LyraContextMenu>(html`
        <lr-context-menu size="s">
          <div slot="trigger"><button>Row</button></div>
          <lr-menu-item value="a" id="a">Alpha</lr-menu-item>
        </lr-context-menu>
      `);
      await el.updateComplete;
      await shell(el).updateComplete;
      await waitUntil(() => (byId(el, 'a') as LyraMenuItem).size === 's', 'row size propagated');
    });
  });

  describe('long-press', () => {
    it('opens after a touch hold with the press point and path', async () => {
      const el = await basic();
      const events = record(el);
      const plain = byId(el, 'plain');
      const [x, y] = center(plain);
      const shown = oneEvent(el, 'lr-after-show');
      const down = await hold(plain);
      await shown;
      release(plain);
      expect(events.count('lr-show')).to.equal(1);
      const detail = events.shows[0]!;
      expect(detail.source).to.equal('long-press');
      expect(near(detail.clientX, x)).to.equal(true);
      expect(near(detail.clientY, y)).to.equal(true);
      expect(detail.originalEvent === down).to.equal(true);
      expect(detail.path[0]?.id).to.equal('plain');
    });

    it('does not open for moved, cancelled, short, multi-touch, mouse, barrel-button or disabled presses', async () => {
      const el = await basic();
      const events = record(el);
      const plain = byId(el, 'plain');
      const [x, y] = center(plain);

      touch('pointerdown', plain, x, y);
      touch('pointermove', plain, x + 20, y);
      await aTimeout(HOLD_MS);
      touch('pointerup', plain, x + 20, y);

      touch('pointerdown', plain, x, y);
      touch('pointercancel', plain, x, y);
      await aTimeout(HOLD_MS);

      touch('pointerdown', plain, x, y);
      await aTimeout(200);
      touch('pointerup', plain, x, y);
      await aTimeout(HOLD_MS - 200);

      touch('pointerdown', plain, x, y);
      touch('pointerdown', plain, x + 30, y, { pointerId: 8, isPrimary: false });
      await aTimeout(HOLD_MS);
      touch('pointerup', plain, x, y);
      touch('pointerup', plain, x + 30, y, { pointerId: 8, isPrimary: false });

      touch('pointerdown', plain, x, y, { pointerType: 'mouse' });
      await aTimeout(HOLD_MS);
      touch('pointerup', plain, x, y, { pointerType: 'mouse' });

      touch('pointerdown', plain, x, y, { pointerType: 'pen', button: 2 });
      await aTimeout(HOLD_MS);
      touch('pointerup', plain, x, y, { pointerType: 'pen' });

      touch('pointerdown', plain, x, y);
      await aTimeout(200);
      el.disabled = true;
      await aTimeout(HOLD_MS);
      touch('pointerup', plain, x, y);

      expect(events.count('lr-show')).to.equal(0);
    });

    it('swallows the click that ends the opening press, but not a later click', async () => {
      const el = await basic();
      const button = byId(el, 'btn');
      let clicks = 0;
      button.addEventListener('click', () => {
        clicks += 1;
      });
      const shown = oneEvent(el, 'lr-after-show');
      await hold(button);
      await shown;
      release(button);
      button.click();
      expect(clicks).to.equal(0);
      const [x, y] = center(button);
      touch('pointerdown', button, x, y);
      touch('pointerup', button, x, y);
      button.click();
      expect(clicks).to.equal(1);
    });

    it('dedupes the platform touch contextmenu in both orders', async () => {
      const el = await basic();
      const events = record(el);
      const plain = byId(el, 'plain');
      const [x, y] = center(plain);
      const platform = (): boolean => {
        const event = new PointerEvent('contextmenu', {
          bubbles: true,
          composed: true,
          cancelable: true,
          pointerType: 'touch',
          clientX: x,
          clientY: y,
        });
        return plain.dispatchEvent(event);
      };

      let shown = oneEvent(el, 'lr-after-show');
      await hold(plain);
      await shown;
      expect(platform()).to.equal(false);
      release(plain);
      expect(events.count('lr-show')).to.equal(1);
      let hidden = oneEvent(el, 'lr-after-hide');
      void el.hide();
      await hidden;

      const veto = (event: Event): void => event.preventDefault();
      el.addEventListener('lr-show', veto);
      await hold(plain);
      expect(platform()).to.equal(true);
      release(plain);
      expect(events.count('lr-show')).to.equal(2);
      el.removeEventListener('lr-show', veto);

      shown = oneEvent(el, 'lr-after-show');
      touch('pointerdown', plain, x, y);
      expect(platform()).to.equal(false);
      await shown;
      await aTimeout(HOLD_MS);
      release(plain);
      expect(events.count('lr-show')).to.equal(3);
      hidden = oneEvent(el, 'lr-after-hide');
      void el.hide();
      await hidden;
    });

    it('clears a selection the press created, but keeps pre-existing and editable selections', async function () {
      const el = await fixture<LyraContextMenu>(html`
        <lr-context-menu style="--show-duration: 0ms; --hide-duration: 0ms">
          <div slot="trigger">
            <p id="text">Some selectable words in the region</p>
            <input id="field" value="editable text" aria-label="Field" />
          </div>
          <lr-menu-item value="a">Alpha</lr-menu-item>
        </lr-context-menu>
      `);
      const text = byId(el, 'text');
      const selection = document.getSelection()!;
      // Read the selection in the microtask right after the opening press decides, before the
      // menu takes focus: some engines collapse the document selection on that focus move.
      const selectionAfterShow = (): Promise<string> => new Promise((resolve) => {
        el.addEventListener('lr-show', () => {
          queueMicrotask(() => resolve(selection.toString()));
        }, { once: true });
      });
      selection.removeAllRanges();
      const [x, y] = center(text);
      let shown = oneEvent(el, 'lr-after-show');
      let observed = selectionAfterShow();
      touch('pointerdown', text, x, y);
      const range = document.createRange();
      range.selectNodeContents(text);
      selection.addRange(range);
      if (selection.rangeCount === 0) this.skip();
      await aTimeout(HOLD_MS);
      await shown;
      release(text);
      expect(await observed).to.equal('');
      let hidden = oneEvent(el, 'lr-after-hide');
      void el.hide({ focusTrigger: false });
      await hidden;

      selection.removeAllRanges();
      const existing = document.createRange();
      existing.selectNodeContents(text);
      selection.addRange(existing);
      shown = oneEvent(el, 'lr-after-show');
      observed = selectionAfterShow();
      await hold(text);
      await shown;
      release(text);
      expect((await observed).length > 0).to.equal(true);
      hidden = oneEvent(el, 'lr-after-hide');
      void el.hide({ focusTrigger: false });
      await hidden;

      selection.removeAllRanges();
      const field = byId(el, 'field');
      const [fx, fy] = center(field);
      shown = oneEvent(el, 'lr-after-show');
      observed = selectionAfterShow();
      touch('pointerdown', field, fx, fy);
      const fieldRange = document.createRange();
      fieldRange.selectNodeContents(text);
      selection.addRange(fieldRange);
      await aTimeout(HOLD_MS);
      await shown;
      release(field);
      expect((await observed).length > 0).to.equal(true);
      selection.removeAllRanges();
    });

    it('suppresses the touch callout only while enabled and honours a consumer opt-back-in', async function () {
      if (!CSS.supports('-webkit-touch-callout', 'none')) this.skip();
      const el = await fixture<LyraContextMenu>(html`
        <lr-context-menu>
          <div slot="trigger" id="area">
            <a id="kept" href="#x" style="-webkit-touch-callout: default">Link</a>
          </div>
        </lr-context-menu>
      `);
      const area = byId(el, 'area');
      const callout = (target: Element): string =>
        getComputedStyle(target).getPropertyValue('-webkit-touch-callout');
      expect(callout(area)).to.equal('none');
      expect(callout(byId(el, 'kept'))).to.equal('default');
      el.disabled = true;
      await el.updateComplete;
      expect(callout(area)).to.equal('default');
    });

    it('closes and reopens on a long-press while open, unless the close is vetoed', async () => {
      const el = await basic();
      const area = byId(el, 'area');
      const rect = area.getBoundingClientRect();
      await openByRightClick(el, Math.round(rect.left + 20), Math.round(rect.top + 20));
      const events = record(el);
      const plain = byId(el, 'plain');
      const shown = oneEvent(el, 'lr-after-show');
      await hold(plain);
      await shown;
      release(plain);
      expect(events.count('lr-hide')).to.equal(1);
      expect(events.count('lr-show')).to.equal(1);
      expect(events.shows[0]!.source).to.equal('long-press');

      const veto = (event: Event): void => event.preventDefault();
      el.addEventListener('lr-hide', veto);
      await hold(byId(el, 'btn'));
      release(byId(el, 'btn'));
      expect(events.count('lr-hide')).to.equal(2);
      expect(events.count('lr-show')).to.equal(1);
      expect(el.open).to.equal(true);
      el.removeEventListener('lr-hide', veto);
    });
  });

  describe('nesting, surfaces and retargeting', () => {
    async function nested(): Promise<{ outer: LyraContextMenu; inner: LyraContextMenu }> {
      const outer = await fixture<LyraContextMenu>(html`
        <lr-context-menu id="outer" style="--show-duration: 0ms; --hide-duration: 0ms">
          <div slot="trigger" id="outer-area" style="padding: 16px">
            <lr-context-menu id="inner">
              <div slot="trigger" id="inner-area" style="inline-size: 200px; block-size: 80px">
                <button id="inner-btn">Inner</button>
              </div>
              <lr-menu label="Inner actions">
                <input slot="header" id="inner-filter" aria-label="Filter" />
                <lr-menu-item value="x" id="inner-row">Inner row</lr-menu-item>
              </lr-menu>
            </lr-context-menu>
          </div>
          <lr-menu-item value="o">Outer row</lr-menu-item>
        </lr-context-menu>
      `);
      const inner = outer.querySelector('#inner') as LyraContextMenu;
      await inner.updateComplete;
      return { outer, inner };
    }

    it('lets the innermost enabled region win and a veto claim the gesture', async () => {
      const { outer, inner } = await nested();
      const outerEvents = record(outer);
      const innerEvents = record(inner);
      const area = byId(inner, 'inner-area');
      expect(syntheticContextMenu(area, ...center(area))).to.equal(false);
      expect(innerEvents.count('lr-show')).to.equal(1);
      expect(outerEvents.count('lr-show')).to.equal(0);
      await inner.hide();

      inner.disabled = true;
      await inner.updateComplete;
      expect(syntheticContextMenu(area, ...center(area))).to.equal(false);
      expect(outerEvents.count('lr-show')).to.equal(1);
      await outer.hide();
      inner.disabled = false;
      await inner.updateComplete;

      inner.addEventListener('lr-show', (event) => event.preventDefault());
      expect(syntheticContextMenu(area, ...center(area))).to.equal(true);
      expect(outerEvents.count('lr-show')).to.equal(1);
    });

    it('lets only the inner region claim a nested long-press', async () => {
      const { outer, inner } = await nested();
      const outerEvents = record(outer);
      const innerEvents = record(inner);
      const area = byId(inner, 'inner-area');
      await hold(area);
      release(area);
      expect(innerEvents.count('lr-show')).to.equal(1);
      expect(outerEvents.count('lr-show')).to.equal(0);
    });

    it('never opens the outer menu from gestures inside the open inner menu', async () => {
      const { outer, inner } = await nested();
      const outerEvents = record(outer);
      const innerEvents = record(inner);
      byId(inner, 'inner-btn').focus();
      const shown = oneEvent(inner, 'lr-after-show');
      await sendKeys({ press: 'Shift+F10' });
      await shown;
      await waitUntil(() => deepActiveId() === 'inner-row', 'inner row focused');

      const filter = byId(inner, 'inner-filter');
      expect(syntheticContextMenu(filter, ...center(filter))).to.equal(true);
      const rect = popup(inner).getBoundingClientRect();
      await rightClick(Math.round(rect.right - 2), Math.round(rect.bottom - 2));
      await frames();
      let keyPrevented: boolean | undefined;
      const onKey = (event: KeyboardEvent): void => {
        if (event.key === 'F10') keyPrevented = event.defaultPrevented;
      };
      window.addEventListener('keydown', onKey);
      try {
        byId(inner, 'inner-row').focus();
        await sendKeys({ press: 'Shift+F10' });
      } finally {
        window.removeEventListener('keydown', onKey);
      }
      expect(keyPrevented).to.equal(true);
      await hold(byId(inner, 'inner-row'));
      release(byId(inner, 'inner-row'));
      expect(outerEvents.count('lr-show')).to.equal(0);
      expect(innerEvents.count('lr-show')).to.equal(1);
    });

    it('claims gestures on the inner surface while its close is still animating', async () => {
      const { outer, inner } = await nested();
      inner.style.setProperty('--hide-duration', '400ms');
      const outerEvents = record(outer);
      const area = byId(inner, 'inner-area');
      const shown = oneEvent(inner, 'lr-after-show');
      syntheticContextMenu(area, ...center(area));
      await shown;
      const hidden = oneEvent(inner, 'lr-after-hide');
      void inner.hide({ focusTrigger: false });
      // The close has committed (`open` is false), so only the surface's own claims keep an
      // enclosing region from treating gestures on the fading rows as its own.
      expect(inner.open).to.equal(false);
      const row = byId(inner, 'inner-row');
      expect(syntheticContextMenu(row, ...center(row))).to.equal(false);
      touch('pointerdown', row, ...center(row));
      await aTimeout(HOLD_MS);
      release(row);
      await hidden;
      expect(outerEvents.count('lr-show')).to.equal(0);
      expect(outer.open).to.equal(false);
    });

    it('leaves an open lr-dropdown surface in the region alone but opens from its trigger', async () => {
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
      const events = record(el);
      const dropdown = byId<LyraDropdown>(el, 'dd');
      const opened = oneEvent(dropdown, 'lr-after-show');
      void dropdown.show();
      await opened;
      const row = byId(el, 'dd-row');
      expect(syntheticContextMenu(row, ...center(row))).to.equal(true);
      expect(events.count('lr-show')).to.equal(0);
      const closed = oneEvent(dropdown, 'lr-after-hide');
      void dropdown.hide();
      await closed;
      const trigger = byId(el, 'dd-trigger');
      expect(syntheticContextMenu(trigger, ...center(trigger))).to.equal(false);
      expect(events.count('lr-show')).to.equal(1);
    });

    it('reports retargeted targets and a frozen composed path', async () => {
      const el = await fixture<LyraContextMenu>(html`
        <lr-context-menu style="--show-duration: 0ms; --hide-duration: 0ms">
          <div slot="trigger" id="region">
            <div id="open-host"></div>
            <div id="closed-host"></div>
            <div data-id="7"><lr-button id="lr-btn">Row</lr-button></div>
          </div>
          <lr-menu-item value="a">Alpha</lr-menu-item>
        </lr-context-menu>
      `);
      const openRoot = byId(el, 'open-host').attachShadow({ mode: 'open' });
      openRoot.innerHTML = '<span id="deep">Deep</span><slot></slot>';
      const closedRoot = byId(el, 'closed-host').attachShadow({ mode: 'closed' });
      closedRoot.innerHTML = '<span id="hidden-deep">Hidden</span>';
      const slotted = document.createElement('span');
      slotted.id = 'slotted';
      slotted.textContent = 'Slotted';
      byId(el, 'open-host').append(slotted);
      const events = record(el);

      syntheticContextMenu(openRoot.getElementById('deep')!, 1, 1);
      await el.hide({ focusTrigger: false });
      closedRoot.getElementById('hidden-deep')!.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true,
        composed: true,
        cancelable: true,
      }));
      await el.hide({ focusTrigger: false });
      syntheticContextMenu(slotted, 1, 1);
      await el.hide({ focusTrigger: false });
      const button = byId(el, 'lr-btn');
      await (button as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
      const inner = button.shadowRoot!.querySelector('button, [part~="base"]')!;
      syntheticContextMenu(inner, ...center(inner));

      expect(events.shows.map((detail) => detail.target?.id ?? detail.target?.localName)).to.deep.equal([
        'deep',
        'closed-host',
        'slotted',
        events.shows[3]!.target?.id ?? events.shows[3]!.target?.localName,
      ]);
      const last = events.shows[3]!;
      expect(last.target?.getRootNode() !== document).to.equal(true);
      expect(last.path.find((node) => node.matches('[data-id]'))?.getAttribute('data-id')).to.equal('7');
      expect(Object.isFrozen(last.path)).to.equal(true);
      expect(last.path[last.path.length - 1]?.id).to.equal('region');
    });

    it('closes only the menu on the first Escape inside a dialog', async () => {
      const dialog = await fixture<LyraDialog>(html`
        <lr-dialog label="Dialog" style="--show-duration: 0ms; --hide-duration: 0ms">
          <lr-context-menu style="--show-duration: 0ms; --hide-duration: 0ms">
            <div slot="trigger"><button id="btn">Row</button></div>
            <lr-menu-item value="a" id="a">Alpha</lr-menu-item>
          </lr-context-menu>
        </lr-dialog>
      `);
      const dialogShown = oneEvent(dialog, 'lr-after-show');
      void dialog.show();
      await dialogShown;
      const el = dialog.querySelector('lr-context-menu') as LyraContextMenu;
      byId(el, 'btn').focus();
      const shown = oneEvent(el, 'lr-after-show');
      await sendKeys({ press: 'Shift+F10' });
      await shown;
      await waitUntil(() => deepActiveId() === 'a', 'row focused');
      const hidden = oneEvent(el, 'lr-after-hide');
      await sendKeys({ press: 'Escape' });
      await hidden;
      expect(dialog.open).to.equal(true);
      await waitUntil(() => deepActiveId() === 'btn', 'focus returned inside the dialog');
      const dialogHidden = oneEvent(dialog, 'lr-after-hide');
      await sendKeys({ press: 'Escape' });
      await dialogHidden;
      expect(dialog.open).to.equal(false);
    });
  });

  describe('anchor movement', () => {
    async function scrolling(): Promise<{ scroller: HTMLElement; el: LyraContextMenu }> {
      const scroller = await fixture<HTMLElement>(html`
        <div id="scroller" style="block-size: 200px; overflow: auto">
          <lr-context-menu style="--show-duration: 0ms; --hide-duration: 0ms">
            <div slot="trigger" id="card" style="block-size: 80px"><button id="btn">Row</button></div>
            <lr-menu-item value="a" id="a">Alpha</lr-menu-item>
          </lr-context-menu>
          <div style="block-size: 1200px"></div>
        </div>
      `);
      return { scroller, el: scroller.querySelector('lr-context-menu') as LyraContextMenu };
    }

    it('closes when the anchor scrolls away, once even when the close is vetoed', async () => {
      const { scroller, el } = await scrolling();
      const events = record(el);
      await openByRightClick(el, ...center(byId(el, 'card')));
      const hidden = oneEvent(el, 'lr-after-hide');
      scroller.scrollTop += 40;
      await hidden;
      expect(events.count('lr-hide')).to.equal(1);
      expect(el.open).to.equal(false);

      scroller.scrollTop = 0;
      await frames();
      await openByRightClick(el, ...center(byId(el, 'card')));
      el.addEventListener('lr-hide', (event) => event.preventDefault());
      scroller.scrollTop += 40;
      await frames();
      scroller.scrollTop += 40;
      await frames();
      scroller.scrollTop += 40;
      await frames();
      expect(events.count('lr-hide')).to.equal(2);
      expect(el.open).to.equal(true);
    });

    it('closes when the anchor element is removed', async () => {
      const el = await basic();
      await openByRightClick(el, ...center(byId(el, 'btn')));
      const hidden = oneEvent(el, 'lr-after-hide');
      byId(el, 'btn').remove();
      await hidden;
      expect(el.open).to.equal(false);
    });

    it('stays open through hover lift, press spring-back, resize, layout shift and unrelated scrolls', async () => {
      const wrapper = await fixture<HTMLElement>(html`
        <div>
          <style>
            .lift:hover { transform: translateY(-4px); }
            .pressed { transform: scale(0.95); }
          </style>
          <div id="before"></div>
          <lr-context-menu style="--show-duration: 0ms; --hide-duration: 0ms">
            <div slot="trigger" id="card" class="lift" style="inline-size: 240px; block-size: 100px"></div>
            <lr-menu-item value="a" id="a">Alpha</lr-menu-item>
          </lr-context-menu>
          <div id="other" style="block-size: 100px; overflow: auto">
            <div style="block-size: 1000px"></div>
          </div>
        </div>
      `);
      const el = wrapper.querySelector('lr-context-menu') as LyraContextMenu;
      const events = record(el);
      const card = byId(wrapper, 'card');
      card.classList.add('pressed');
      await openByRightClick(el, ...center(card));
      card.classList.remove('pressed');
      await hoverUntilMatched(byId(el, 'a'), 'pointer reached the first row');
      await frames();
      card.style.padding = '8px';
      await frames();
      const spacer = document.createElement('div');
      spacer.style.blockSize = '30px';
      byId(wrapper, 'before').append(spacer);
      await frames();
      byId(wrapper, 'other').scrollTop = 200;
      await frames();
      await aTimeout(50);
      expect(events.count('lr-hide')).to.equal(0);
      expect(el.open).to.equal(true);
    });

    it('does not fight the scroll and returns focus without scrolling when focus was in the menu', async () => {
      const { scroller, el } = await scrolling();
      const events = record(el);
      const pageScroll = document.scrollingElement?.scrollTop ?? 0;
      byId(el, 'btn').focus();
      let shown = oneEvent(el, 'lr-after-show');
      await sendKeys({ press: 'Shift+F10' });
      await shown;
      await waitUntil(() => deepActiveId() === 'a', 'row focused');
      let hidden = oneEvent(el, 'lr-after-hide');
      scroller.scrollTop = 400;
      await hidden;
      await frames();
      expect(events.count('lr-hide')).to.equal(1);
      expect(near(scroller.scrollTop, 400, 1)).to.equal(true);
      expect(document.scrollingElement?.scrollTop ?? 0).to.equal(pageScroll);
      expect(deepActiveId()).to.equal('btn');

      scroller.scrollTop = 0;
      await frames();
      const elsewhere = document.createElement('div');
      elsewhere.tabIndex = -1;
      elsewhere.id = 'elsewhere';
      document.body.append(elsewhere);
      try {
        // With the only row disabled, focus stays on the region button, so moving it elsewhere
        // does not leave the menu surface and the menu stays open until the scroll closes it.
        (byId(el, 'a') as LyraMenuItem).disabled = true;
        byId(el, 'btn').focus();
        shown = oneEvent(el, 'lr-after-show');
        await sendKeys({ press: 'Shift+F10' });
        await shown;
        elsewhere.focus();
        await frames();
        expect(el.open, 'open before the scroll').to.equal(true);
        hidden = oneEvent(el, 'lr-after-hide');
        scroller.scrollTop = 400;
        await hidden;
        await frames();
        expect(events.count('lr-hide')).to.equal(2);
        expect(deepActiveId()).to.equal('elsewhere');
      } finally {
        elsewhere.remove();
      }
    });
  });

  describe('programmatic', () => {
    it('opens at a point with a programmatic detail', async () => {
      const el = await basic();
      const events = record(el);
      const shown = oneEvent(el, 'lr-after-show');
      el.showAt({ x: 60, y: 70 });
      await shown;
      const detail = events.shows[0]!;
      expect(detail.source).to.equal('programmatic');
      expect(detail.target === null).to.equal(true);
      expect(detail.path.length).to.equal(0);
      expect(detail.originalEvent === null).to.equal(true);
      expect(el.open).to.equal(true);
      await el.hide();
      const plain = byId(el, 'plain');
      el.showAt({ x: 60, y: 70, contextElement: plain });
      expect(events.shows[1]!.path.map((node) => node.id)).to.deep.equal(['plain', 'area']);
    });

    it('ignores non-finite points and a disabled instance', async () => {
      const el = await basic();
      const events = record(el);
      el.showAt({ x: Number.NaN, y: 10 });
      el.disabled = true;
      await el.updateComplete;
      el.showAt({ x: 10, y: 10 });
      expect(events.count('lr-show')).to.equal(0);
      expect(el.open).to.equal(false);
    });

    it('re-anchors silently while open and keeps the original return target', async () => {
      const el = await basic();
      const events = record(el);
      byId(el, 'btn').focus();
      const shown = oneEvent(el, 'lr-after-show');
      await sendKeys({ press: 'Shift+F10' });
      await shown;
      el.showAt({ x: 200, y: 300 });
      await waitUntil(() => near(popup(el).getBoundingClientRect().top, 300), 'popup moved');
      expect(events.count('lr-show')).to.equal(1);
      expect(events.count('lr-after-show')).to.equal(1);
      await waitUntil(() => deepActiveId() === 'copy', 'row focused after re-anchor');
      const hidden = oneEvent(el, 'lr-after-hide');
      await sendKeys({ press: 'Escape' });
      await hidden;
      await waitUntil(() => deepActiveId() === 'btn', 'retained return target focused');
    });

    it('hide() resolves after lr-after-hide and can leave focus alone', async () => {
      const el = await basic();
      const log: string[] = [];
      el.addEventListener('lr-after-hide', () => log.push('after-hide'));
      byId(el, 'btn').focus();
      let shown = oneEvent(el, 'lr-after-show');
      await sendKeys({ press: 'Shift+F10' });
      await shown;
      await el.hide();
      log.push('resolved');
      expect(log).to.deep.equal(['after-hide', 'resolved']);
      shown = oneEvent(el, 'lr-after-show');
      el.showAt({ x: 40, y: 40 });
      await shown;
      document.getElementById('after')!.focus();
      await el.hide({ focusTrigger: false });
      expect(deepActiveId()).to.equal('after');
    });
  });

  describe('lifecycle hygiene', () => {
    it('delivers each lifecycle event exactly once and never leaks the internal dropdown', async () => {
      const el = await basic();
      const hostEvents = record(el);
      const documentLog: string[] = [];
      let leaked = false;
      const names = ['lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide'];
      const onDocument = (event: Event): void => {
        if (event.composedPath()[0] === shell(el)) leaked = true;
        if (event.target === el) documentLog.push(event.type);
      };
      for (const name of names) document.addEventListener(name, onDocument);
      try {
        await openByRightClick(el, ...center(byId(el, 'plain')));
        const hidden = oneEvent(el, 'lr-after-hide');
        void el.hide();
        await hidden;
      } finally {
        for (const name of names) document.removeEventListener(name, onDocument);
      }
      expect(hostEvents.log).to.deep.equal(names);
      expect(documentLog).to.deep.equal(names);
      expect(leaked).to.equal(false);
    });

    it('resets open state across a reconnect and drops a pending press', async () => {
      const el = await basic();
      const parent = el.parentElement!;
      const events = record(el);
      await openByRightClick(el, ...center(byId(el, 'plain')));
      const before = events.log.length;
      el.remove();
      expect(el.matches(':state(open)')).to.equal(false);
      expect(el.open).to.equal(false);
      parent.append(el);
      await el.updateComplete;
      await frames();
      expect(el.matches(':state(open)')).to.equal(false);
      expect(el.open).to.equal(false);
      expect(events.log.slice(before)).to.deep.equal([]);

      const plain = byId(el, 'plain');
      const [x, y] = center(plain);
      touch('pointerdown', plain, x, y);
      el.remove();
      parent.append(el);
      await aTimeout(HOLD_MS);
      touch('pointerup', plain, x, y);
      expect(events.count('lr-show')).to.equal(1);

      await openByRightClick(el, ...center(byId(el, 'plain')));
      expect(el.open).to.equal(true);
    });

    it('focuses the new first row when rows are replaced in lr-show, and a consumer menu owns the name', async () => {
      const el = await basic();
      el.addEventListener('lr-show', () => {
        for (const row of [...el.querySelectorAll('lr-menu-item')]) row.remove();
        const row = document.createElement('lr-menu-item') as LyraMenuItem;
        row.id = 'fresh';
        row.value = 'fresh';
        row.textContent = 'Fresh';
        el.append(row);
      }, { once: true });
      byId(el, 'btn').focus();
      const shown = oneEvent(el, 'lr-after-show');
      await sendKeys({ press: 'Shift+F10' });
      await shown;
      await waitUntil(() => deepActiveId() === 'fresh', 'replacement row focused');
    });
  });

  describe('accessibility and localization', () => {
    async function populated(attrs: { label?: string; ariaLabel?: string; dir?: string } = {}): Promise<LyraContextMenu> {
      const wrapper = await fixture<HTMLElement>(html`
        <div dir=${attrs.dir ?? 'ltr'}>
          <lr-context-menu
            style="--show-duration: 0ms; --hide-duration: 0ms"
            label=${attrs.label ?? ''}
            aria-label=${attrs.ariaLabel ?? ''}
          >
            <div slot="trigger"><button id="btn">Row</button></div>
            <lr-menu-label>Edit</lr-menu-label>
            <lr-menu-item value="copy" id="copy">Copy<span slot="details">Ctrl+C</span></lr-menu-item>
            <lr-menu-item value="wrap" type="checkbox" checked>Wrap lines</lr-menu-item>
            <hr />
            <lr-menu-item value="list" type="radio" group="view" checked>List</lr-menu-item>
            <lr-menu-item value="grid" type="radio" group="view">Grid</lr-menu-item>
            <lr-menu-item value="more" id="more">
              More
              <lr-menu-item slot="submenu" value="child" id="child">Child</lr-menu-item>
            </lr-menu-item>
          </lr-context-menu>
        </div>
      `);
      const el = wrapper.querySelector('lr-context-menu') as LyraContextMenu;
      if (!attrs.ariaLabel) el.removeAttribute('aria-label');
      if (!attrs.label) el.removeAttribute('label');
      await el.updateComplete;
      return el;
    }

    async function openFromKeyboard(el: LyraContextMenu): Promise<void> {
      byId(el, 'btn').focus();
      const shown = oneEvent(el, 'lr-after-show');
      await sendKeys({ press: 'Shift+F10' });
      await shown;
      await waitUntil(() => deepActiveId() === 'copy', 'first row focused');
      expect(getComputedStyle(popup(el)).visibility).to.equal('visible');
    }

    it('passes axe while open, with a submenu open, in RTL and with a host aria-label', async () => {
      let el = await populated({ label: 'Row actions' });
      await openFromKeyboard(el);
      await expect(el).to.be.accessible();
      byId(el, 'more').focus();
      await sendKeys({ press: 'ArrowRight' });
      await waitUntil(() => deepActiveId() === 'child', 'submenu opened');
      await expect(el).to.be.accessible();
      await el.hide({ focusTrigger: false });

      el = await populated({ label: 'Row actions', dir: 'rtl' });
      await openFromKeyboard(el);
      await expect(el).to.be.accessible();
      await el.hide({ focusTrigger: false });

      el = await populated({ ariaLabel: 'Row actions' });
      await openFromKeyboard(el);
      await expect(el).to.be.accessible();
      await el.hide({ focusTrigger: false });
    });

    it('resolves the menu name with the documented precedence', async () => {
      const menuName = (el: LyraContextMenu): string | null => {
        const list = shell(el).shadowRoot!
          .querySelector('[part~="menu"]')
          ?.shadowRoot?.querySelector('[role="menu"]');
        return list?.getAttribute('aria-label') ?? null;
      };
      const settle = async (el: LyraContextMenu): Promise<void> => {
        await el.updateComplete;
        await shell(el).updateComplete;
        await frames();
      };

      let el = await populated();
      await settle(el);
      expect(menuName(el)).to.equal('Menu');

      el.strings = { menuLabel: 'Aktionen' };
      await settle(el);
      expect(menuName(el)).to.equal('Aktionen');

      el.label = '';
      await settle(el);
      expect(menuName(el)).to.equal('Aktionen');

      el.label = 'Row actions';
      await settle(el);
      expect(menuName(el)).to.equal('Row actions');

      el.setAttribute('aria-label', 'Zeilen');
      await settle(el);
      expect(menuName(el)).to.equal('Zeilen');

      el.setAttribute('aria-label', '');
      await settle(el);
      expect(menuName(el)).to.equal('Row actions');

      el = await fixture<LyraContextMenu>(html`
        <lr-context-menu label="Row actions" aria-label="Zeilen">
          <div slot="trigger"><button>Row</button></div>
          <lr-menu label="X"><lr-menu-item value="a">Alpha</lr-menu-item></lr-menu>
        </lr-context-menu>
      `);
      await settle(el);
      const consumer = el.querySelector('lr-menu')!;
      await (consumer as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
      expect(consumer.shadowRoot!.querySelector('[role="menu"]')?.getAttribute('aria-label')).to.equal('X');
    });
  });

  describe('motion and responsive layout', () => {
    it('flattens the registry motion under reduced motion and keeps both after-events', async () => {
      const originalAnimate = Element.prototype.animate;
      const durations: unknown[] = [];
      Element.prototype.animate = function animate(
        this: Element,
        keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
        options?: number | KeyframeAnimationOptions,
      ): Animation {
        if (this.matches('[part~="popup"]')) {
          durations.push(typeof options === 'number' ? options : options?.duration);
        }
        return originalAnimate.call(this, keyframes, options);
      };
      try {
        for (const preference of ['reduce', 'no-preference'] as const) {
          await setReducedMotion(preference);
          durations.length = 0;
          const el = await fixture<LyraContextMenu>(html`
            <lr-context-menu style="--show-duration: 200ms; --hide-duration: 200ms">
              <div slot="trigger"><button>Row</button></div>
              <lr-menu-item value="a">Alpha</lr-menu-item>
            </lr-context-menu>
          `);
          const shown = oneEvent(el, 'lr-after-show');
          el.showAt({ x: 40, y: 40 });
          await shown;
          const hidden = oneEvent(el, 'lr-after-hide');
          void el.hide();
          await hidden;
          const expected = preference === 'reduce' ? 0 : 200;
          expect(durations, preference).to.deep.equal([expected, expected]);
        }
      } finally {
        Element.prototype.animate = originalAnimate;
        await setReducedMotion('no-preference');
      }
    });

    it('keeps the menu inside a 320px viewport for pointer and keyboard opens', async () => {
      const original = { width: window.innerWidth, height: window.innerHeight };
      await setViewport({ width: 320, height: 640 });
      try {
        // Firefox applies the viewport change asynchronously; place nothing until it has settled.
        await waitUntil(
          () => window.innerWidth === 320 && document.documentElement.clientWidth <= 320,
          'viewport did not settle at 320px',
        );
        await frames();
        const el = await fixture<LyraContextMenu>(html`
          <lr-context-menu style="--show-duration: 0ms; --hide-duration: 0ms">
            <div slot="trigger" style="inline-size: 100%; block-size: 200px">
              <button id="btn" style="inline-size: 100%">Row</button>
            </div>
            <lr-menu-item value="a" id="long">
              A very long row label that has to wrap inside the narrow menu surface without overflowing it
            </lr-menu-item>
          </lr-context-menu>
        `);
        await openByRightClick(el, 310, 150);
        // Firefox can report one placement computed before the size cap applied; assert the
        // settled placement, which the positioner reaches within a few frames.
        await waitUntil(() => {
          const settled = popup(el).getBoundingClientRect();
          return settled.left >= 0 && settled.right <= 320;
        }, 'pointer open did not settle inside the viewport', { timeout: 1000 });
        let rect = popup(el).getBoundingClientRect();
        expect(rect.left, 'pointer popup left').to.be.at.least(0);
        expect(rect.right, 'pointer popup right').to.be.at.most(320);
        expect(byId(el, 'long').getBoundingClientRect().right, 'long row right').to.be.at.most(320);
        await el.hide({ focusTrigger: false });

        byId(el, 'btn').focus();
        const shown = oneEvent(el, 'lr-after-show');
        await sendKeys({ press: 'Shift+F10' });
        await shown;
        await waitUntil(() => {
          const settled = popup(el).getBoundingClientRect();
          return settled.left >= 0 && settled.right <= 320;
        }, 'keyboard open did not settle inside the viewport', { timeout: 1000 });
        rect = popup(el).getBoundingClientRect();
        expect(rect.left, 'keyboard popup left').to.be.at.least(0);
        expect(rect.right, 'keyboard popup right').to.be.at.most(320);
      } finally {
        await setViewport(original);
      }
    });
  });
});
