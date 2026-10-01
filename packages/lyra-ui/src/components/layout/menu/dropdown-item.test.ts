import { sendKeys } from '@web/test-runner-commands';
import type { LyraDropdown } from '../../overlays/overlay/dropdown.class.js';
import { aTimeout, expect, fixture, html, nextFrame, oneEvent, waitUntil } from '@open-wc/testing';
import './dropdown-item.js';
import './menu.js';
import { LyraDropdownItem } from './dropdown-item.class.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { setReducedMotion } from '../../../../test/wtr-media.js';
import '../../overlays/overlay/dropdown.js';

async function submenuParent(): Promise<LyraDropdownItem> {
  const wrapper = (await fixture(html`
    <div role="menu" aria-label="Share actions">
      <lr-dropdown-item id="share">
        Share
        <lr-dropdown-item slot="submenu" value="email">Email</lr-dropdown-item>
      </lr-dropdown-item>
    </div>
  `)) as HTMLElement;
  const item = wrapper.querySelector('#share') as LyraDropdownItem;
  for (let frame = 0; frame < 20 && !item.hasSubmenu; frame += 1) {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve())
    );
    await item.updateComplete;
  }
  expect(item.hasSubmenu).to.equal(true);
  return item;
}

async function waitForSubmenuState(
  item: LyraDropdownItem,
  open: boolean
): Promise<void> {
  for (let frame = 0; frame < 20 && item.submenuOpen !== open; frame += 1) {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve())
    );
    await item.updateComplete;
  }
  await item.updateComplete;
  const panel = item.shadowRoot?.querySelector<TestSubmenuPanel>(
    '[data-generated-submenu]'
  );
  if (panel) await panel.updateComplete;
  await nextFrame();
  await item.updateComplete;
  if (panel) await panel.updateComplete;
}

interface TestSubmenuPanel extends HTMLElement {
  updateComplete: Promise<boolean>;
}

function expectSubmenuReflection(item: LyraDropdownItem, open: boolean): void {
  expect(item.submenuOpen).to.equal(open);
  expect(item.hasAttribute('submenu-open')).to.equal(open);
  expect(item.hasAttribute('submenuopen')).to.equal(open);
}

async function openFromUpstreamAlias(item: LyraDropdownItem): Promise<void> {
  item.setAttribute('submenuopen', '');
  await waitForSubmenuState(item, true);
  expectSubmenuReflection(item, true);
}

describe('<lr-dropdown-item>', () => {
  it('uses the menu-item behavior and role', async () => {
    const menu = await fixture(html`
      <lr-menu label="Actions"
        ><lr-dropdown-item value="archive">Archive</lr-dropdown-item></lr-menu
      >
    `);
    const el = menu.querySelector('lr-dropdown-item') as LyraDropdownItem;
    expect(el.getAttribute('role')).to.equal('menuitem');
    expect(el.tabIndex).to.equal(0);
  });

  it('inherits host click() forwarding from lr-menu-item', async () => {
    const menu = await fixture<HTMLElement>(html`
      <lr-menu label="Actions"
        ><lr-dropdown-item value="archive">Archive</lr-dropdown-item></lr-menu
      >
    `);
    const el = menu.querySelector<LyraDropdownItem>('lr-dropdown-item')!;
    await nextFrame();
    const base = el.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
    let baseClicks = 0;
    let selections = 0;
    let selected: LyraDropdownItem | undefined;
    base.addEventListener('click', () => {
      baseClicks += 1;
    });
    menu.addEventListener('lr-select', (event) => {
      selections += 1;
      selected = (event as CustomEvent<{ item: LyraDropdownItem }>).detail.item;
    });

    el.click();

    expect(baseClicks).to.equal(1);
    expect(selections).to.equal(1);
    expect(selected === el).to.equal(true);
  });

  it('inherits the cancelable checkbox change proposal while preserving selection', async () => {
    const menu = await fixture<HTMLElement>(html`
      <lr-menu label="Actions">
        <lr-dropdown-item type="checkbox" value="wrap"
          >Wrap text</lr-dropdown-item
        >
      </lr-menu>
    `);
    const item = menu.querySelector<LyraDropdownItem>('lr-dropdown-item')!;
    await nextFrame();
    let checkedDuringChange = true;
    let changeCancelable = false;
    let selections = 0;
    item.addEventListener('lr-menu-item-change-request', (event) => {
      checkedDuringChange = item.checked;
      changeCancelable = event.cancelable;
      event.preventDefault();
    });
    menu.addEventListener('lr-select', () => {
      selections += 1;
    });

    item.click();

    expect(changeCancelable).to.be.true;
    expect(checkedDuringChange).to.be.false;
    expect(item.checked).to.be.false;
    expect(selections).to.equal(1);
  });

  it('inherits type="radio" exclusive-choice semantics from lr-menu-item', async () => {
    const menu = await fixture<HTMLElement>(html`
      <lr-menu label="Currency">
        <lr-dropdown-item type="radio" checked value="usd"
          >USD</lr-dropdown-item
        >
        <lr-dropdown-item type="radio" value="eur">EUR</lr-dropdown-item>
      </lr-menu>
    `);
    const [usdItem, eurItem] = Array.from(
      menu.querySelectorAll<LyraDropdownItem>('lr-dropdown-item')
    );
    await nextFrame();

    eurItem!.select();

    expect(eurItem!.checked).to.be.true;
    expect(usdItem!.checked).to.be.false;
    expect(eurItem!.getAttribute('role')).to.equal('menuitemradio');
  });

  it('inherits menu-item row chrome defaults and fallback hooks from an ancestor', async () => {
    const defaultItem = await fixture<LyraDropdownItem>(
      html`<lr-dropdown-item>Archive</lr-dropdown-item>`
    );
    const defaultBase =
      defaultItem.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
    const defaultChrome = getComputedStyle(defaultBase);
    expect(defaultChrome.gap).to.equal('4px');
    expect(defaultChrome.borderRadius).to.equal('8px');
    expect(getComputedStyle(defaultItem).borderRadius).to.equal('8px');

    const wrapper = (await fixture(html`
      <div style="--lr-menu-item-gap: 12px; --lr-menu-item-radius: 3px;">
        <lr-dropdown-item>Archive</lr-dropdown-item>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-dropdown-item') as LyraDropdownItem;
    const base = el.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
    const chrome = getComputedStyle(base);

    expect(chrome.gap).to.equal('12px');
    expect(chrome.borderRadius).to.equal('3px');
    expect(getComputedStyle(el).borderRadius).to.equal('3px');
  });

  it('reflects the pinned Web Awesome type property', async () => {
    const el = await fixture<LyraDropdownItem>(
      html`<lr-dropdown-item>Archive</lr-dropdown-item>`
    );
    el.type = 'checkbox';
    await el.updateComplete;
    expect(el.getAttribute('type')).to.equal('checkbox');
  });

  it('is accessible', async () => {
    const menu = await fixture(html`
      <lr-menu label="Actions"
        ><lr-dropdown-item value="archive">Archive</lr-dropdown-item></lr-menu
      >
    `);
    await expect(menu).to.be.accessible();
  });

  it('inherits decorative display-slot isolation without losing its host label or action', async () => {
    const wrapper = (await fixture(html`
      <lr-menu label="Actions">
        <lr-dropdown-item id="archive" value="archive" tabindex="0">
          <button id="label" type="button">Archive</button>
          <button id="details" slot="details" type="button">
            Shortcut action
          </button>
        </lr-dropdown-item>
      </lr-menu>
    `)) as HTMLElement;
    const item = wrapper.querySelector<LyraDropdownItem>('#archive')!;
    const label = wrapper.querySelector<HTMLButtonElement>('#label')!;
    const details = wrapper.querySelector<HTMLButtonElement>('#details')!;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve())
    );
    await item.updateComplete;

    for (const control of [label, details]) {
      control.focus();
      expect(
        item.ownerDocument.activeElement?.id,
        `${control.id} cannot become a second focus stop inside the menuitem`
      ).to.not.equal(control.id);
      expect(
        control.assignedSlot
          ?.closest<HTMLElement>('[inert]')
          ?.getAttribute('aria-hidden'),
        `${control.id} is visual-only item chrome`
      ).to.equal('true');
    }

    expect(item.getTextLabel()).to.equal('Archive');
    expect(item.getAttribute('aria-label')).to.equal('Archive');

    let slottedClicks = 0;
    let selections = 0;
    label.addEventListener('click', () => (slottedClicks += 1));
    wrapper.addEventListener('lr-select', () => (selections += 1));
    const rect = label.getBoundingClientRect();
    try {
      await sendMouse({
        type: 'click',
        position: [
          Math.round(rect.left + rect.width / 2),
          Math.round(rect.top + rect.height / 2),
        ],
      });
    } finally {
      await resetMouse();
    }

    expect(slottedClicks).to.equal(0);
    expect(selections).to.equal(1);
    await expect(wrapper).to.be.accessible();
  });

  it('exposes submenu-open as a reflected, controllable state with a false default', async () => {
    const item = await submenuParent();
    expectSubmenuReflection(item, false);

    // Repeating the default is an idempotent close request and must also clear both aliases.
    item.submenuOpen = false;
    await item.updateComplete;
    expectSubmenuReflection(item, false);

    item.submenuOpen = true;
    await waitForSubmenuState(item, true);
    expectSubmenuReflection(item, true);

    item.submenuOpen = false;
    await waitForSubmenuState(item, false);
    expectSubmenuReflection(item, false);

    item.setAttribute('submenu-open', '');
    await waitForSubmenuState(item, true);
    expectSubmenuReflection(item, true);
    item.removeAttribute('submenu-open');
    await waitForSubmenuState(item, false);
    expectSubmenuReflection(item, false);
  });

  it('accepts the normalized upstream submenuopen attribute as a synchronized alias', async () => {
    const authored = (
      await fixture(html`
        <div role="menu" aria-label="Share actions">
          <lr-dropdown-item submenuOpen>
            Share
            <lr-dropdown-item slot="submenu" value="email"
              >Email</lr-dropdown-item
            >
          </lr-dropdown-item>
        </div>
      `)
    ).querySelector('lr-dropdown-item') as LyraDropdownItem;
    for (let frame = 0; frame < 20 && !authored.hasSubmenu; frame += 1) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve())
      );
      await authored.updateComplete;
    }
    await waitForSubmenuState(authored, true);
    expect(authored.submenuOpen).to.equal(true);
    expect(authored.hasAttribute('submenuopen')).to.equal(true);
    expect(authored.hasAttribute('submenu-open')).to.equal(true);

    const item = await submenuParent();

    item.setAttribute('submenuopen', '');
    await waitForSubmenuState(item, true);
    expectSubmenuReflection(item, true);

    item.removeAttribute('submenuopen');
    await waitForSubmenuState(item, false);
    expectSubmenuReflection(item, false);

    item.setAttribute('submenuopen', '');
    await waitForSubmenuState(item, true);
    item.removeAttribute('submenu-open');
    await waitForSubmenuState(item, false);
    expectSubmenuReflection(item, false);

    item.setAttribute('submenu-open', '');
    await waitForSubmenuState(item, true);
    expectSubmenuReflection(item, true);
    item.removeAttribute('submenuopen');
    await waitForSubmenuState(item, false);
    expectSubmenuReflection(item, false);
  });

  it('clears both reflected spellings after closeSubmenu() dismisses an alias-opened submenu', async () => {
    const item = await submenuParent();
    await openFromUpstreamAlias(item);

    await item.closeSubmenu();
    await waitForSubmenuState(item, false);

    expectSubmenuReflection(item, false);
  });

  it('clears both reflected spellings after Escape dismisses an alias-opened submenu', async () => {
    const item = await submenuParent();
    await openFromUpstreamAlias(item);
    const child = item.querySelector<LyraDropdownItem>('[slot="submenu"]')!;
    child.focus();

    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    child.dispatchEvent(event);
    await waitForSubmenuState(item, false);

    expect(event.defaultPrevented).to.equal(true);
    expectSubmenuReflection(item, false);
  });

  it('clears both reflected spellings after an outside pointer dismissal', async () => {
    const item = await submenuParent();
    await openFromUpstreamAlias(item);

    document.body.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, composed: true })
    );
    await waitForSubmenuState(item, false);

    expectSubmenuReflection(item, false);
  });

  it('clears both reflected spellings after submenu selection', async () => {
    const item = await submenuParent();
    await openFromUpstreamAlias(item);
    const child = item.querySelector<LyraDropdownItem>('[slot="submenu"]')!;

    child.select();
    await waitForSubmenuState(item, false);

    expectSubmenuReflection(item, false);
  });

  it('does not resurrect alias-opened transient state after disconnect and reconnect', async () => {
    const item = await submenuParent();
    await openFromUpstreamAlias(item);
    const parent = item.parentElement!;

    item.remove();
    parent.append(item);
    await waitForSubmenuState(item, false);

    expectSubmenuReflection(item, false);
  });

  it('declares the mapped submenu methods on this class and preserves their promise settlement', async () => {
    expect(Object.hasOwn(LyraDropdownItem.prototype, 'openSubmenu')).to.equal(
      true
    );
    expect(Object.hasOwn(LyraDropdownItem.prototype, 'closeSubmenu')).to.equal(
      true
    );
    const item = await submenuParent();

    const opening = item.openSubmenu();
    expect(opening).to.be.instanceOf(Promise);
    await opening;
    expectSubmenuReflection(item, true);

    const closing = item.closeSubmenu();
    expect(closing).to.be.instanceOf(Promise);
    await closing;
    expectSubmenuReflection(item, false);
  });

  it('uses the host native focus and blur events without translating or re-emitting them', async () => {
    const item = (
      await fixture(html`
        <div role="menu" aria-label="Actions">
          <lr-dropdown-item>Archive</lr-dropdown-item>
        </div>
      `)
    ).querySelector('lr-dropdown-item') as LyraDropdownItem;
    let translatedEvents = 0;
    item.addEventListener('lr-focus', () => {
      translatedEvents += 1;
    });
    item.addEventListener('lr-blur', () => {
      translatedEvents += 1;
    });

    const focused = oneEvent(item, 'focus');
    item.focus();
    const focusEvent = await focused;
    expect(focusEvent).to.be.instanceOf(FocusEvent);
    expect(focusEvent.target === item).to.equal(true);
    expect(focusEvent.bubbles).to.equal(false);
    expect(focusEvent.cancelable).to.equal(false);

    const blurred = oneEvent(item, 'blur');
    item.blur();
    const blurEvent = await blurred;
    expect(blurEvent).to.be.instanceOf(FocusEvent);
    expect(blurEvent.target === item).to.equal(true);
    expect(blurEvent.bubbles).to.equal(false);
    expect(blurEvent.cancelable).to.equal(false);
    expect(translatedEvents).to.equal(0);
  });

  it('is accessible with its reflected submenu state open', async () => {
    const item = await submenuParent();
    await item.openSubmenu('none');
    await expect(item.parentElement!).to.be.accessible();
  });

  // Asserted against this tag rather than <lr-menu-item>: the ladder arrives through the
  // superclass's `static styles`, which a subclass silently loses the moment it declares its own.
  describe('size', () => {
    const rowHeight = (el: LyraDropdownItem): number =>
      (
        el.shadowRoot!.querySelector('[part="base"]') as HTMLElement
      ).getBoundingClientRect().height;

    it('defaults to size="m", reflected', async () => {
      const el = (await fixture(
        html`<lr-dropdown-item>Archive</lr-dropdown-item>`
      )) as LyraDropdownItem;
      expect(el.size).to.equal('m');
      expect(el.getAttribute('size')).to.equal('m');
    });

    it('grows the rendered row measurably from size="s" to size="l"', async () => {
      const small = (await fixture(
        html`<lr-dropdown-item size="s">Archive</lr-dropdown-item>`
      )) as LyraDropdownItem;
      const large = (await fixture(
        html`<lr-dropdown-item size="l">Archive</lr-dropdown-item>`
      )) as LyraDropdownItem;
      expect(rowHeight(large)).to.be.greaterThan(rowHeight(small));
    });

    it('keeps every tier at or above the 24px pointer-target floor', async () => {
      for (const size of ['2xs', 'xs', 's', 'm', 'l', 'xl']) {
        const el = (await fixture(
          html`<lr-dropdown-item size=${size}>Archive</lr-dropdown-item>`
        )) as LyraDropdownItem;
        expect(rowHeight(el), size).to.be.at.least(24);
      }
    });
  });
});

/**
 * Regression: a dropdown that is already `open` on its first render used to leave every row at
 * `aria-label=""` permanently. The overlay popup is
 * `visibility: hidden` until it opens, which zeroed the computed name, and the empty result was
 * written back as an authoritative attribute. The motion preference only changed the timing that
 * exposed it, so both branches are covered.
 */
describe('lr-dropdown-item accessible names do not depend on display state', () => {
  const frames = async (count = 10): Promise<void> => {
    for (let index = 0; index < count; index += 1) await nextFrame();
  };

  afterEach(async () => {
    await setReducedMotion('no-preference');
  });

  for (const preference of ['reduce', 'no-preference'] as const) {
    it(`names rows of a dropdown opened at first render with prefers-reduced-motion: ${preference}`, async () => {
      await setReducedMotion(preference);
      const el = (await fixture(html`
        <lr-dropdown open>
          <button slot="trigger">Open</button>
          <lr-dropdown-item value="a">Alpha</lr-dropdown-item>
          <lr-dropdown-item value="b"><span>Beta</span></lr-dropdown-item>
        </lr-dropdown>
      `)) as HTMLElement;
      await frames();

      const items = [...el.querySelectorAll<LyraDropdownItem>('lr-dropdown-item')];
      expect(items.map((item) => item.getAttribute('aria-label'))).to.deep.equal([
        'Alpha',
        'Beta',
      ]);
      expect(items.map((item) => item.getTextLabel())).to.deep.equal([
        'Alpha',
        'Beta',
      ]);
    });
  }

  it('names rows of a closed dropdown', async () => {
    const el = (await fixture(html`
      <lr-dropdown>
        <button slot="trigger">Open</button>
        <lr-dropdown-item value="a">Alpha</lr-dropdown-item>
        <lr-dropdown-item value="b"><span>Beta</span></lr-dropdown-item>
      </lr-dropdown>
    `)) as HTMLElement;
    await frames();

    const items = [...el.querySelectorAll<LyraDropdownItem>('lr-dropdown-item')];
    expect(items.map((item) => item.getAttribute('aria-label'))).to.deep.equal([
      'Alpha',
      'Beta',
    ]);
  });
});

for (const direction of ['ltr', 'rtl']) {
  for (const [width, height] of [[390, 600], [320, 240]] as const) {
    for (const shape of ['mapped', 'authored']) {
      it(`keeps ${shape} submenu labels usable in a ${width}×${height} ${direction} viewport`, async () => {
        const frame = await fixture<HTMLIFrameElement>(html`
          <iframe title="Submenu viewport" style=${`width:${width}px;height:${height}px;border:0`}></iframe>
        `);
        const loaded = new Promise<void>(resolve => {
          const onLoad = () => {
            if (frame.contentDocument?.body.id !== 'submenu-document') return;
            frame.removeEventListener('load', onLoad);
            resolve();
          };
          frame.addEventListener('load', onLoad);
        });
        frame.srcdoc = '<!doctype html><html><body id="submenu-document"></body></html>';
        await loaded;
        const doc = frame.contentDocument!;
        const view = doc.defaultView!;
        doc.documentElement.dir = direction;
        const module = doc.createElement('script');
        module.type = 'module';
        module.textContent = `await Promise.all([
          import(${JSON.stringify(new URL('../../overlays/overlay/dropdown.ts', import.meta.url).href)}),
          import(${JSON.stringify(new URL('./dropdown-item.ts', import.meta.url).href)}),
          import(${JSON.stringify(new URL('./menu.ts', import.meta.url).href)})
        ]); document.body.dataset.ready = 'true';`;
        doc.head.append(module);
        await waitUntil(() => doc.body.dataset['ready'] === 'true', 'frame components did not register');
        doc.head.insertAdjacentHTML('beforeend', `<style>
          body { margin: 0; font: 16px sans-serif; }
          lr-dropdown { position: absolute; top: 16px; inset-inline-end: 12px; }
          lr-dropdown::part(panel) { inline-size: min(320px, calc(100vw - 24px)); }
        </style>`);
        const options = ['English', 'Français', 'Português', 'Deutsch', 'العربية', '日本語', 'Español'].map((label, index) => `<lr-dropdown-item ${shape === 'mapped' ? 'slot="submenu"' : ''} type="checkbox" data-choice="${index}">${label}</lr-dropdown-item>`).join('');
        doc.body.insertAdjacentHTML('beforeend', `<lr-dropdown top-layer placement="bottom-end">
          <button slot="trigger">Settings</button>
          <lr-menu label="Settings"><lr-dropdown-item id="languages">Language
            ${shape === 'mapped' ? options : `<lr-menu slot="submenu" label="Languages">${options}</lr-menu>`}
          </lr-dropdown-item></lr-menu>
        </lr-dropdown>`);
        const dropdown = doc.querySelector<LyraDropdown>('lr-dropdown')!;
        await dropdown.updateComplete;
        await dropdown.show();
        const parent = doc.querySelector<LyraDropdownItem>('#languages')!;
        await waitUntil(() => parent.hasSubmenu, 'mapped submenu did not initialize');
        await parent.openSubmenu('first');
        const submenu = shape === 'mapped'
          ? parent.shadowRoot!.querySelector<HTMLElement>('[data-generated-submenu]')!
          : parent.querySelector<HTMLElement>('lr-menu[slot="submenu"]')!;
        const surface = submenu.shadowRoot!.querySelector<HTMLElement>('.submenu-surface')!;
        await waitUntil(() => view.getComputedStyle(surface).visibility === 'visible', 'submenu did not become visible');
        await new Promise<void>(resolve => view.requestAnimationFrame(() => view.requestAnimationFrame(() => resolve())));
        const bounds = surface.getBoundingClientRect();
        const parentBounds = parent.getBoundingClientRect();
        const portuguese = parent.querySelector<LyraDropdownItem>('[data-choice="2"]')!;
        const label = portuguese.shadowRoot!.querySelector<HTMLElement>('[part="label"]')!;
        expect(bounds.width, 'the submenu must retain its 10rem minimum when the viewport can fit it').to.be.at.least(160);
        expect(bounds.left).to.be.at.least(-1);
        expect(bounds.right).to.be.at.most(width + 1);
        expect(bounds.top).to.be.at.least(-1);
        expect(bounds.bottom).to.be.at.most(height + 1);
        expect(bounds.top >= parentBounds.bottom - 1 || bounds.bottom <= parentBounds.top + 1, 'the submenu must use a vertical fallback when neither side fits').to.equal(true);
        expect(label.clientWidth, 'the language label must have room to render').to.be.at.least(label.scrollWidth);
        expect(doc.activeElement === parent.querySelector('[data-choice="0"]'), 'opening from the keyboard must focus the first submenu item').to.equal(true);
        if (height === 240) {
          await sendKeys({ press: 'End' });
          const last = parent.querySelector<HTMLElement>('[data-choice="6"]')!;
          const list = submenu.shadowRoot!.querySelector<HTMLElement>('[part="list"]')!;
          await waitUntil(() => doc.activeElement === last, 'End did not focus the last choice');
          expect(list.scrollHeight, 'the short submenu must exercise scrolling').to.be.greaterThan(list.clientHeight);
          await waitUntil(() => list.scrollTop > 0, 'the final choice did not scroll into view');
          const lastBounds = last.getBoundingClientRect();
          const listBounds = list.getBoundingClientRect();
          expect(lastBounds.bottom).to.be.at.most(listBounds.bottom + 1);
          expect(lastBounds.top).to.be.at.least(listBounds.top - 1);
        }
        await sendKeys({ press: 'Escape' });
        await waitUntil(() => !parent.submenuOpen, 'Escape did not close the submenu');
        expect(dropdown.open, 'Escape closes the submenu before the root dropdown').to.equal(true);
        expect(doc.activeElement === parent, 'Escape must return focus to the parent row').to.equal(true);
        if (shape === 'mapped' && direction === 'ltr' && width === 390) {
          const point = (target: HTMLElement): [number, number] => {
            const rect = target.getBoundingClientRect();
            const frameRect = frame.getBoundingClientRect();
            return [Math.round(frameRect.left + rect.left + rect.width / 2), Math.round(frameRect.top + rect.top + rect.height / 2)];
          };
          try {
            await sendMouse({ type: 'move', position: point(parent) });
            await waitUntil(() => parent.submenuOpen, 'pointer intent did not open the submenu');
            await waitUntil(() => view.getComputedStyle(surface).visibility === 'visible');
            expect(doc.activeElement === parent, 'pointer opening must leave focus outside the submenu').to.equal(true);
            await sendMouse({ type: 'move', position: point(portuguese) });
            await waitUntil(() => portuguese.matches(':hover'), 'the pointer did not reach the submenu choice');
            await aTimeout(400);
            expect(parent.submenuOpen, 'transferring the pointer into the vertical submenu must keep it open').to.equal(true);
          } finally {
            await resetMouse();
          }
        }
        await dropdown.hide();
      });
    }
  }
}
