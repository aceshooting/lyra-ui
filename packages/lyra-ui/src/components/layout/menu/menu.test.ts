import {
  expect,
  fixture,
  html,
  nextFrame,
  oneEvent,
  waitUntil,
} from '@open-wc/testing';
import { setReducedMotion } from '../../../../test/wtr-media.js';
import './menu.js';
import './menu-item.js';
import './menu-label.js';
import type { LyraMenu } from './menu.js';
import type { LyraMenuItem } from './menu-item.js';
import type { ContainedMenuOwner } from './menu-shared.js';

const basic = () => html`
  <lr-menu label="Row actions">
    <lr-menu-item value="rename">Rename</lr-menu-item>
    <lr-menu-item value="duplicate">Duplicate</lr-menu-item>
    <hr />
    <lr-menu-item value="delete" variant="danger">Delete</lr-menu-item>
  </lr-menu>
`;

function ownItems(menu: LyraMenu): LyraMenuItem[] {
  return [...menu.querySelectorAll(':scope > lr-menu-item')] as LyraMenuItem[];
}

function list(menu: LyraMenu): HTMLElement {
  return menu.shadowRoot!.querySelector('[part="list"]') as HTMLElement;
}

function press(
  target: HTMLElement,
  key: string,
  options: KeyboardEventInit = {}
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    composed: true,
    cancelable: true,
    ...options,
  });
  target.dispatchEvent(event);
  return event;
}

async function settle(...elements: LyraMenu[]): Promise<void> {
  for (const element of elements) await element.updateComplete;
  await nextFrame();
}

function byId<T extends HTMLElement = HTMLElement>(
  root: ParentNode,
  id: string
): T {
  return root.querySelector(`#${id}`) as T;
}

function submenuSurface(menu: LyraMenu): HTMLElement {
  return menu.shadowRoot!.querySelector('.submenu-surface') as HTMLElement;
}

const nested = () => html`
  <lr-menu label="Row actions">
    <lr-menu-item value="rename" id="rename">Rename</lr-menu-item>
    <lr-menu-item value="share" id="share">
      Share
      <lr-menu slot="submenu" id="share-menu">
        <lr-menu-item value="email" id="email">Email</lr-menu-item>
        <lr-menu-item value="link" id="link">Copy link</lr-menu-item>
      </lr-menu>
    </lr-menu-item>
    <lr-menu-item value="move" id="move">
      Move
      <lr-menu slot="submenu" id="move-menu">
        <lr-menu-item value="up" id="up">Up</lr-menu-item>
      </lr-menu>
    </lr-menu-item>
  </lr-menu>
`;

it('collects a same-origin foreign-realm menu item without instanceof', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameWindow = frame.contentWindow;
  const frameDocument = frame.contentDocument;
  if (!frameWindow || !frameDocument)
    throw new Error('Foreign realm unavailable');

  class ForeignMenuItem extends frameWindow.HTMLElement {
    interactionDisabled = false;
    submenuOpen = false;
    hasSubmenu = false;
    size = 'medium';
    value = 'foreign';
    closeSubmenu(): void {}
  }
  frameWindow.customElements.define('lr-menu-item', ForeignMenuItem);
  const foreign = frameDocument.createElement('lr-menu-item');
  foreign.textContent = 'Foreign item';
  const menu = await fixture<LyraMenu>(
    html`<lr-menu label="Foreign actions"></lr-menu>`
  );
  try {
    const LocalMenuItem = customElements.get('lr-menu-item')!;
    expect(foreign instanceof LocalMenuItem).to.equal(false);
    menu.append(document.adoptNode(foreign));
    await nextFrame();
    await menu.updateComplete;
    expect(foreign.tabIndex).to.equal(0);
  } finally {
    frame.remove();
  }
});

it('is an inline mapped menu with no additive root-overlay API', async () => {
  const menu = await fixture<LyraMenu>(basic());
  expect(list(menu).getAttribute('role')).to.equal('menu');
  expect(ownItems(menu).length).to.equal(3);
  for (const member of [
    'open',
    'placement',
    'anchor',
    'closeOnEscapeAnywhere',
    'show',
    'hide',
  ]) {
    expect(member in menu, `${member} must be absent`).to.equal(false);
  }
  expect(menu.shadowRoot!.querySelector('[part="trigger"]') === null).to.equal(
    true
  );
  expect(menu.shadowRoot!.querySelector('[part="popup"]') === null).to.equal(
    true
  );
  expect(getComputedStyle(menu).display).to.equal('flex');
});

it('renders one roving tab stop and wraps Arrow navigation', async () => {
  const menu = await fixture<LyraMenu>(basic());
  const [first, second, third] = ownItems(menu);
  expect([first.tabIndex, second.tabIndex, third.tabIndex]).to.deep.equal([
    0, -1, -1,
  ]);
  first.focus();
  press(first, 'ArrowUp');
  expect(document.activeElement === third).to.equal(true);
  press(third, 'ArrowDown');
  expect(document.activeElement === first).to.equal(true);
  press(first, 'End');
  expect(document.activeElement === third).to.equal(true);
  press(third, 'Home');
  expect(document.activeElement === first).to.equal(true);
});

it('activates the focused item with Enter and Space through the menu controller', async () => {
  const menu = await fixture<LyraMenu>(basic());
  const [first, second] = ownItems(menu);
  const selected: string[] = [];
  menu.addEventListener('lr-select', (event) => {
    selected.push((event as CustomEvent<{ item: LyraMenuItem }>).detail.item.value);
  });

  first.focus();
  const enter = press(first, 'Enter');
  second.focus();
  const space = press(second, ' ');

  expect(enter.defaultPrevented).to.be.true;
  expect(space.defaultPrevented).to.be.true;
  expect(selected).to.deep.equal(['rename', 'duplicate']);
});

it('treats Enter on a submenu parent as disclosure activation rather than selection', async () => {
  const menu = await fixture<LyraMenu>(nested());
  const share = byId<LyraMenuItem>(menu, 'share');
  const child = byId<LyraMenu>(menu, 'share-menu');
  let selections = 0;
  menu.addEventListener('lr-select', () => {
    selections += 1;
  });

  share.focus();
  const enter = press(share, 'Enter');
  await settle(menu, child);

  expect(enter.defaultPrevented).to.be.true;
  expect(share.submenuOpen).to.be.true;
  expect(document.activeElement?.id).to.equal('email');
  expect(selections).to.equal(0);
});

it('skips disabled, hidden, aria-hidden, and inert items', async () => {
  const menu = await fixture<LyraMenu>(html`
    <lr-menu label="Actions">
      <lr-menu-item id="a" value="a">A</lr-menu-item>
      <lr-menu-item id="disabled" disabled value="disabled"
        >Disabled</lr-menu-item
      >
      <lr-menu-item id="hidden" hidden value="hidden">Hidden</lr-menu-item>
      <lr-menu-item id="aria-hidden" aria-hidden="true" value="aria-hidden"
        >Hidden</lr-menu-item
      >
      <lr-menu-item id="inert" inert value="inert">Inert</lr-menu-item>
      <lr-menu-item id="b" value="b">B</lr-menu-item>
    </lr-menu>
  `);
  byId(menu, 'a').focus();
  press(byId(menu, 'a'), 'ArrowDown');
  expect(document.activeElement?.id).to.equal('b');
  press(byId(menu, 'b'), 'ArrowDown');
  expect(document.activeElement?.id).to.equal('a');
});

it('rehomes the roving stop when the active item becomes unavailable', async () => {
  const menu = await fixture<LyraMenu>(basic());
  const [first, second, third] = ownItems(menu);
  second.focus();
  second.disabled = true;
  await second.updateComplete;
  await menu.updateComplete;
  expect(document.activeElement === third).to.equal(true);
  third.hidden = true;
  await nextFrame();
  expect(document.activeElement === first).to.equal(true);
});

it('contains private item-state events while still repairing roving focus', async () => {
  const menu = await fixture<LyraMenu>(html`
    <lr-menu label="Actions">
      <lr-menu-item value="a">A</lr-menu-item>
      <lr-menu-item value="b">B</lr-menu-item>
    </lr-menu>
  `);
  const [first, second] = ownItems(menu);
  first.focus();
  let leaked = 0;
  menu.addEventListener('lr-menu-item-state-change', () => leaked++);

  first.disabled = true;
  await first.updateComplete;
  await menu.updateComplete;

  expect(leaked).to.equal(0);
  expect(second.tabIndex).to.equal(0);
});

it('preserves active identity across reorder and repairs removal', async () => {
  const menu = await fixture<LyraMenu>(basic());
  const [first, second] = ownItems(menu);
  second.focus();
  menu.prepend(second);
  await nextFrame();
  expect(document.activeElement === second).to.equal(true);
  expect(second.tabIndex).to.equal(0);
  second.remove();
  await nextFrame();
  expect(document.activeElement === first).to.equal(true);
  expect(first.tabIndex).to.equal(0);
});

it('emits only canonical cancelable lr-select with the complete item', async () => {
  const menu = await fixture<LyraMenu>(basic());
  const item = ownItems(menu)[0];
  let canonical = 0;
  let menuAlias = 0;
  let childAlias = 0;
  menu.addEventListener('lr-select', () => (canonical += 1));
  menu.addEventListener('lr-menu-select', () => (menuAlias += 1));
  menu.addEventListener('lr-menu-item-select', () => (childAlias += 1));
  const pending = oneEvent(menu, 'lr-select');
  item.select();
  const event = (await pending) as CustomEvent<{ item: LyraMenuItem }>;
  expect(event.detail.item === item).to.equal(true);
  expect(Object.isFrozen(event.detail)).to.equal(true);
  expect(event.cancelable).to.equal(true);
  expect([canonical, menuAlias, childAlias]).to.deep.equal([1, 0, 0]);
});

it('honors preventDefault on lr-select without duplicating activation', async () => {
  const menu = await fixture<LyraMenu>(basic());
  const item = ownItems(menu)[0];
  let count = 0;
  menu.addEventListener('lr-select', (event) => {
    count += 1;
    event.preventDefault();
  });
  item.select();
  expect(count).to.equal(1);
  expect(item.tabIndex).to.equal(0);
});

it('orders checkbox proposal before the single menu selection', async () => {
  const menu = await fixture<LyraMenu>(html`
    <lr-menu label="View options">
      <lr-menu-item id="wrap" type="checkbox" value="wrap"
        >Wrap text</lr-menu-item
      >
    </lr-menu>
  `);
  const item = byId<LyraMenuItem>(menu, 'wrap');
  const order: string[] = [];
  item.addEventListener('lr-menu-item-change', (event) => {
    order.push('change');
    event.preventDefault();
  });
  menu.addEventListener('lr-select', () => order.push('select'));
  item.select();
  expect(order).to.deep.equal(['change', 'select']);
  expect(item.checked).to.equal(false);
});

it('keeps non-item default-slot controls native and untouched', async () => {
  const menu = await fixture<LyraMenu>(html`
    <lr-menu label="Filtered actions">
      <input id="filter" />
      <lr-menu-item value="rename">Rename</lr-menu-item>
    </lr-menu>
  `);
  const input = byId<HTMLInputElement>(menu, 'filter');
  for (const key of ['ArrowDown', 'Home', 'End', 'Escape', 'Enter', ' ']) {
    const event = press(input, key);
    expect(event.defaultPrevented, key).to.equal(false);
  }
});

it('supports localized typeahead and skips unavailable matches', async () => {
  const menu = await fixture<LyraMenu>(html`
    <lr-menu label="Actions" locale="tr">
      <lr-menu-item id="istanbul" value="istanbul">İstanbul</lr-menu-item>
      <lr-menu-item id="izmir" value="izmir" disabled>İzmir</lr-menu-item>
      <lr-menu-item id="ankara" value="ankara">Ankara</lr-menu-item>
    </lr-menu>
  `);
  byId(menu, 'ankara').focus();
  press(byId(menu, 'ankara'), 'i');
  expect(document.activeElement?.id).to.equal('istanbul');
});

it('uses host aria-label, explicit label, dropdown fallback, then localized Menu', async () => {
  const menu = await fixture<LyraMenu>(html`<lr-menu></lr-menu>`);
  expect(list(menu).getAttribute('aria-label')).to.equal('Menu');
  menu.strings = { menuLabel: 'Aktionen' };
  await menu.updateComplete;
  expect(list(menu).getAttribute('aria-label')).to.equal('Aktionen');
  menu.dropdownLabel = 'Dropdown actions';
  await menu.updateComplete;
  expect(list(menu).getAttribute('aria-label')).to.equal('Dropdown actions');
  menu.label = 'Explicit';
  await menu.updateComplete;
  expect(list(menu).getAttribute('aria-label')).to.equal('Explicit');
  menu.setAttribute('aria-label', 'Host');
  await menu.updateComplete;
  expect(list(menu).getAttribute('aria-label')).to.equal('Host');
  menu.setAttribute('aria-label', '');
  await menu.updateComplete;
  expect(list(menu).getAttribute('aria-label')).to.equal('');
});

it('treats every supplied label literally, including the former English default and empty string', async () => {
  const menu = await fixture<LyraMenu>(html`
    <lr-menu label="Menu" .strings=${{ menuLabel: 'Aktionen' }}></lr-menu>
  `);
  expect(list(menu).getAttribute('aria-label')).to.equal('Menu');

  menu.label = '';
  await menu.updateComplete;
  expect(list(menu).getAttribute('aria-label')).to.equal('');

  menu.label = undefined;
  await menu.updateComplete;
  expect(list(menu).getAttribute('aria-label')).to.equal('Aktionen');
});

it('retains header/list/footer composition without a popup wrapper', async () => {
  const menu = await fixture<LyraMenu>(html`
    <lr-menu label="Filters">
      <input slot="header" aria-label="Filter actions" />
      <lr-menu-item value="rename">Rename</lr-menu-item>
      <button slot="footer" type="button">Apply</button>
    </lr-menu>
  `);
  const header =
    menu.shadowRoot!.querySelector<HTMLElement>('[part="header"]')!;
  const footer =
    menu.shadowRoot!.querySelector<HTMLElement>('[part="footer"]')!;
  expect(getComputedStyle(header).display).to.not.equal('none');
  expect(getComputedStyle(footer).display).to.not.equal('none');
  expect(menu.shadowRoot!.querySelector('[part="popup"]') === null).to.equal(
    true
  );
  await expect(menu).to.be.accessible();
});

it('collapses unfilled header/footer regions and restores them after slot removal', async () => {
  const menu = await fixture<LyraMenu>(html`
    <lr-menu label="Actions"><lr-menu-item value="a">A</lr-menu-item></lr-menu>
  `);
  const header =
    menu.shadowRoot!.querySelector<HTMLElement>('[part="header"]')!;
  const footer =
    menu.shadowRoot!.querySelector<HTMLElement>('[part="footer"]')!;
  expect([
    getComputedStyle(header).display,
    getComputedStyle(footer).display,
  ]).to.deep.equal(['none', 'none']);
  const button = document.createElement('button');
  button.slot = 'footer';
  menu.append(button);
  await nextFrame();
  expect(getComputedStyle(footer).display).to.not.equal('none');
  button.remove();
  await nextFrame();
  expect(getComputedStyle(footer).display).to.equal('none');
});

it('keeps the contained dropdown semantic owner and every composition region', async () => {
  const menu = await fixture<LyraMenu>(html`
    <lr-menu
      label="Filters"
      .dropdownContained=${true}
      .dropdownOpen=${true}
      .dropdownRendersMenuRole=${true}
    >
      <input slot="header" aria-label="Filter actions" />
      <lr-menu-item value="rename">Rename</lr-menu-item>
      <button slot="footer">Apply</button>
    </lr-menu>
  `);
  expect(menu.shadowRoot!.querySelector('[part="popup"]') === null).to.equal(
    true
  );
  expect(list(menu).getAttribute('role')).to.equal('menu');
  expect(
    menu.shadowRoot!.querySelector('slot[name="header"]') !== null
  ).to.equal(true);
  expect(
    menu.shadowRoot!.querySelector('slot[name="footer"]') !== null
  ).to.equal(true);
  await expect(menu).to.be.accessible();
});

it('names submenu parents and renders both aria-expanded states', async () => {
  const menu = await fixture<LyraMenu>(nested());
  const share = byId<LyraMenuItem>(menu, 'share');
  expect(share.getAttribute('aria-haspopup')).to.equal('menu');
  expect(share.getAttribute('aria-expanded')).to.equal('false');
  expect(byId(menu, 'rename').hasAttribute('aria-haspopup')).to.equal(false);
  await share.openSubmenu('none');
  expect(share.getAttribute('aria-expanded')).to.equal('true');
  await share.closeSubmenu();
  expect(share.getAttribute('aria-expanded')).to.equal('false');
});

it('opens and closes a submenu with logical arrow keys in LTR', async () => {
  const menu = await fixture<LyraMenu>(nested());
  const share = byId<LyraMenuItem>(menu, 'share');
  const child = byId<LyraMenu>(menu, 'share-menu');
  share.focus();
  expect(press(share, 'ArrowRight').defaultPrevented).to.equal(true);
  await settle(menu, child);
  expect(share.submenuOpen).to.equal(true);
  expect(document.activeElement?.id).to.equal('email');
  expect(press(byId(child, 'email'), 'ArrowLeft').defaultPrevented).to.equal(
    true
  );
  await settle(menu, child);
  expect(share.submenuOpen).to.equal(false);
  expect(document.activeElement === share).to.equal(true);
});

it('mirrors submenu arrow keys in RTL', async () => {
  const wrapper = await fixture<HTMLElement>(
    html`<div dir="rtl">${nested()}</div>`
  );
  const menu = wrapper.querySelector('lr-menu') as LyraMenu;
  const share = byId<LyraMenuItem>(menu, 'share');
  const child = byId<LyraMenu>(menu, 'share-menu');
  share.focus();
  press(share, 'ArrowRight');
  await settle(menu, child);
  expect(share.submenuOpen).to.equal(false);
  press(share, 'ArrowLeft');
  await settle(menu, child);
  expect(share.submenuOpen).to.equal(true);
  press(byId(child, 'email'), 'ArrowRight');
  await settle(menu, child);
  expect(share.submenuOpen).to.equal(false);
});

it('Escape and outside pointer dismissal close only the submenu', async () => {
  const menu = await fixture<LyraMenu>(nested());
  const share = byId<LyraMenuItem>(menu, 'share');
  const child = byId<LyraMenu>(menu, 'share-menu');
  await share.openSubmenu('first');
  press(byId(child, 'email'), 'Escape');
  await settle(menu, child);
  expect(share.submenuOpen).to.equal(false);
  expect(document.activeElement === share).to.equal(true);

  await share.openSubmenu('none');
  document.body.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, composed: true })
  );
  await settle(menu, child);
  expect(share.submenuOpen).to.equal(false);
});

it('keeps at most one submenu open per menu level', async () => {
  const menu = await fixture<LyraMenu>(nested());
  const share = byId<LyraMenuItem>(menu, 'share');
  const move = byId<LyraMenuItem>(menu, 'move');
  await share.openSubmenu('none');
  expect(share.submenuOpen).to.equal(true);
  move.focus();
  press(move, 'ArrowRight');
  await settle(menu, byId(menu, 'share-menu'), byId(menu, 'move-menu'));
  expect([share.submenuOpen, move.submenuOpen]).to.deep.equal([false, true]);
});

it('opens a submenu only after pointer intent and never steals focus', async () => {
  const menu = await fixture<LyraMenu>(nested());
  const share = byId<LyraMenuItem>(menu, 'share');
  byId(menu, 'rename').focus();
  share.dispatchEvent(
    new PointerEvent('pointerover', { bubbles: true, composed: true })
  );
  expect(share.submenuOpen).to.equal(false);
  await new Promise((resolve) => setTimeout(resolve, 220));
  await settle(menu, byId(menu, 'share-menu'));
  expect(share.submenuOpen).to.equal(true);
  expect(document.activeElement?.id).to.equal('rename');
});

it('carries a nested selection out as exactly one canonical lr-select', async () => {
  const menu = await fixture<LyraMenu>(nested());
  const share = byId<LyraMenuItem>(menu, 'share');
  const child = byId<LyraMenu>(menu, 'share-menu');
  await share.openSubmenu('first');
  let canonical = 0;
  let alias = 0;
  menu.addEventListener('lr-select', () => (canonical += 1));
  menu.addEventListener('lr-menu-select', () => (alias += 1));
  const pending = oneEvent(menu, 'lr-select');
  byId<LyraMenuItem>(child, 'email').select();
  const event = (await pending) as CustomEvent<{ item: LyraMenuItem }>;
  await settle(menu, child);
  expect(event.detail.item.value).to.equal('email');
  expect([canonical, alias]).to.deep.equal([1, 0]);
  expect(share.submenuOpen).to.equal(false);
});

it('preserves a veto through nested selection and keeps the branch open', async () => {
  const menu = await fixture<LyraMenu>(nested());
  const share = byId<LyraMenuItem>(menu, 'share');
  const child = byId<LyraMenu>(menu, 'share-menu');
  await share.openSubmenu('first');
  menu.addEventListener('lr-select', (event) => event.preventDefault(), {
    once: true,
  });
  byId<LyraMenuItem>(child, 'email').select();
  await Promise.resolve();
  await settle(menu, child);
  expect(share.submenuOpen).to.equal(true);
});

it('closes every submenu in a three-level selection without re-emitting', async () => {
  const menu = await fixture<LyraMenu>(html`
    <lr-menu label="Actions">
      <lr-menu-item id="share" value="share"
        >Share
        <lr-menu slot="submenu" id="level-2">
          <lr-menu-item id="more" value="more"
            >More
            <lr-menu slot="submenu" id="level-3">
              <lr-menu-item id="embed" value="embed">Embed</lr-menu-item>
            </lr-menu>
          </lr-menu-item>
        </lr-menu>
      </lr-menu-item>
    </lr-menu>
  `);
  const share = byId<LyraMenuItem>(menu, 'share');
  const more = byId<LyraMenuItem>(menu, 'more');
  await share.openSubmenu('first');
  await more.openSubmenu('first');
  let count = 0;
  menu.addEventListener('lr-select', () => (count += 1));
  byId<LyraMenuItem>(menu, 'embed').select();
  await Promise.resolve();
  await settle(menu, byId(menu, 'level-2'), byId(menu, 'level-3'));
  expect(count).to.equal(1);
  expect([share.submenuOpen, more.submenuOpen]).to.deep.equal([false, false]);
});

it('positions the private submenu surface on logical inline-end', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div
      style="position: fixed; inset-block-start: 8px; inset-inline-start: 50vw;"
    >
      ${nested()}
    </div>
  `);
  const menu = wrapper.querySelector('lr-menu') as LyraMenu;
  const share = byId<LyraMenuItem>(menu, 'share');
  const child = byId<LyraMenu>(menu, 'share-menu');
  await share.openSubmenu('none');
  await settle(menu, child);
  const surface = submenuSurface(child);
  await waitUntil(
    () => surface.style.left !== '',
    'submenu was never positioned'
  );
  expect(getComputedStyle(surface).position).to.equal('fixed');
  const rowRect = share.getBoundingClientRect();
  const surfaceRect = surface.getBoundingClientRect();
  expect(
    surfaceRect.left + surfaceRect.width / 2 > rowRect.left + rowRect.width / 2
  ).to.equal(true);
});

it('keeps submenu motion token-driven and disables it for reduced motion', async () => {
  await setReducedMotion('no-preference');
  try {
    const menu = await fixture<LyraMenu>(nested());
    const share = byId<LyraMenuItem>(menu, 'share');
    const child = byId<LyraMenu>(menu, 'share-menu');
    await share.openSubmenu('none');
    const surface = submenuSurface(child);
    expect(getComputedStyle(surface).transitionProperty).to.contain('opacity');
    await setReducedMotion('reduce');
    await nextFrame();
    expect(getComputedStyle(surface).transitionProperty).to.equal('none');
  } finally {
    await setReducedMotion('no-preference');
  }
});

it('contains long localized items at exactly 320px in LTR and RTL', async () => {
  for (const direction of ['ltr', 'rtl'] as const) {
    const wrapper = await fixture<HTMLElement>(html`
      <div dir=${direction} style="inline-size: 320px; max-inline-size: 320px;">
        <lr-menu
          label="Actions"
          style="inline-size: 100%; max-inline-size: 100%;"
        >
          <lr-menu-item value="long"
            >A-very-long-unbroken-localized-action-name-that-must-not-expand-the-allocation</lr-menu-item
          >
        </lr-menu>
      </div>
    `);
    const menu = wrapper.querySelector('lr-menu') as LyraMenu;
    expect(menu.getBoundingClientRect().width <= 320).to.equal(true);
    expect(list(menu).scrollWidth <= list(menu).clientWidth).to.equal(true);
  }
});

it('is accessible in populated and nested-open states', async () => {
  const menu = await fixture<LyraMenu>(nested());
  await expect(menu).to.be.accessible();
  await byId<LyraMenuItem>(menu, 'share').openSubmenu('first');
  await expect(menu).to.be.accessible();
});

it('no-ops Arrow/Home/End navigation when every item is disabled', async () => {
  const menu = await fixture<LyraMenu>(html`
    <lr-menu label="Actions">
      <lr-menu-item id="a" value="a" disabled>A</lr-menu-item>
      <lr-menu-item id="b" value="b" disabled>B</lr-menu-item>
    </lr-menu>
  `);
  const [first, second] = ownItems(menu);
  expect([first.tabIndex, second.tabIndex]).to.deep.equal([-1, -1]);
  for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End']) {
    const event = press(first, key);
    expect(event.defaultPrevented, key).to.equal(true);
  }
  expect([first.tabIndex, second.tabIndex]).to.deep.equal([-1, -1]);
});

it('closes the private submenu surface when Tab leaves it with nothing following', async () => {
  const menu = await fixture<LyraMenu>(nested());
  const share = byId<LyraMenuItem>(menu, 'share');
  const child = byId<LyraMenu>(menu, 'share-menu');
  await share.openSubmenu('first');
  const email = byId<LyraMenuItem>(child, 'email');
  email.focus();
  press(email, 'Tab');
  await settle(menu, child);
  expect(share.submenuOpen).to.equal(false);
});

it('keeps the private submenu open when Tab moves forward into a present footer', async () => {
  const menu = await fixture<LyraMenu>(html`
    <lr-menu label="Actions">
      <lr-menu-item id="share" value="share">
        Share
        <lr-menu slot="submenu" id="share-menu">
          <lr-menu-item id="email" value="email">Email</lr-menu-item>
          <button slot="footer" type="button">Apply</button>
        </lr-menu>
      </lr-menu-item>
    </lr-menu>
  `);
  const share = byId<LyraMenuItem>(menu, 'share');
  const child = byId<LyraMenu>(menu, 'share-menu');
  await share.openSubmenu('first');
  const email = byId<LyraMenuItem>(child, 'email');
  email.focus();
  press(email, 'Tab');
  await settle(menu, child);
  expect(share.submenuOpen).to.equal(true);
});

it('keeps the private submenu open when Shift+Tab moves backward into a present header', async () => {
  const menu = await fixture<LyraMenu>(html`
    <lr-menu label="Actions">
      <lr-menu-item id="share" value="share">
        Share
        <lr-menu slot="submenu" id="share-menu">
          <input slot="header" aria-label="Filter" />
          <lr-menu-item id="email" value="email">Email</lr-menu-item>
        </lr-menu>
      </lr-menu-item>
    </lr-menu>
  `);
  const share = byId<LyraMenuItem>(menu, 'share');
  const child = byId<LyraMenu>(menu, 'share-menu');
  await share.openSubmenu('first');
  const email = byId<LyraMenuItem>(child, 'email');
  email.focus();
  press(email, 'Tab', { shiftKey: true });
  await settle(menu, child);
  expect(share.submenuOpen).to.equal(true);
});

it('closes the private submenu when Shift+Tab moves backward out of an empty header', async () => {
  const menu = await fixture<LyraMenu>(nested());
  const share = byId<LyraMenuItem>(menu, 'share');
  const child = byId<LyraMenu>(menu, 'share-menu');
  await share.openSubmenu('first');
  const email = byId<LyraMenuItem>(child, 'email');
  email.focus();
  press(email, 'Tab', { shiftKey: true });
  await settle(menu, child);
  expect(share.submenuOpen).to.equal(false);
});

it('always closes when Tab moves forward out of the last footer stop', async () => {
  const menu = await fixture<LyraMenu>(html`
    <lr-menu label="Actions">
      <lr-menu-item id="share" value="share">
        Share
        <lr-menu slot="submenu" id="share-menu">
          <lr-menu-item id="email" value="email">Email</lr-menu-item>
          <button id="apply" slot="footer" type="button">Apply</button>
        </lr-menu>
      </lr-menu-item>
    </lr-menu>
  `);
  const share = byId<LyraMenuItem>(menu, 'share');
  const child = byId<LyraMenu>(menu, 'share-menu');
  await share.openSubmenu('first');
  const apply = byId<HTMLButtonElement>(child, 'apply');
  apply.focus();
  press(apply, 'Tab');
  await settle(menu, child);
  expect(share.submenuOpen).to.equal(false);
});

it('always closes when Shift+Tab moves backward out of the first header stop', async () => {
  const menu = await fixture<LyraMenu>(html`
    <lr-menu label="Actions">
      <lr-menu-item id="share" value="share">
        Share
        <lr-menu slot="submenu" id="share-menu">
          <input id="filter" slot="header" aria-label="Filter" />
          <lr-menu-item id="email" value="email">Email</lr-menu-item>
        </lr-menu>
      </lr-menu-item>
    </lr-menu>
  `);
  const share = byId<LyraMenuItem>(menu, 'share');
  const child = byId<LyraMenu>(menu, 'share-menu');
  await share.openSubmenu('first');
  const filter = byId<HTMLInputElement>(child, 'filter');
  filter.focus();
  press(filter, 'Tab', { shiftKey: true });
  await settle(menu, child);
  expect(share.submenuOpen).to.equal(false);
});

it('drives a contained dropdown owner through focus, escape, and selection dismissal', async () => {
  const events: string[] = [];
  const owner: ContainedMenuOwner = {
    open: false,
    show(): void {
      events.push('show');
      owner.open = true;
    },
    hide(options?: { focusTrigger?: boolean }): void {
      events.push(`hide:${options?.focusTrigger ?? false}`);
      owner.open = false;
    },
  };
  const menu = await fixture<LyraMenu>(html`
    <lr-menu
      label="Actions"
      .dropdownContained=${true}
      .dropdownOwner=${owner}
    >
      <lr-menu-item id="a" value="a">A</lr-menu-item>
      <lr-menu-item id="b" value="b">B</lr-menu-item>
    </lr-menu>
  `);

  menu.focusContained('first');
  expect(events).to.deep.equal(['show']);

  menu.focusContained('first');
  expect(events).to.deep.equal(['show']);
  expect(byId<LyraMenuItem>(menu, 'a').tabIndex).to.equal(0);

  press(byId(menu, 'a'), 'Escape');
  expect(events).to.deep.equal(['show', 'hide:true']);

  byId<LyraMenuItem>(menu, 'a').select();
  expect(events).to.deep.equal(['show', 'hide:true', 'hide:true']);
});

it('leaves a contained dropdown open on select when dropdownStayOpenOnSelect is set', async () => {
  const events: string[] = [];
  const owner: ContainedMenuOwner = {
    open: true,
    show(): void {
      events.push('show');
    },
    hide(options?: { focusTrigger?: boolean }): void {
      events.push(`hide:${options?.focusTrigger ?? false}`);
    },
  };
  const menu = await fixture<LyraMenu>(html`
    <lr-menu
      label="Actions"
      .dropdownContained=${true}
      .dropdownOwner=${owner}
      .dropdownOpen=${true}
      .dropdownStayOpenOnSelect=${true}
    >
      <lr-menu-item id="a" value="a">A</lr-menu-item>
    </lr-menu>
  `);
  byId<LyraMenuItem>(menu, 'a').select();
  expect(events).to.deep.equal([]);
});

it('rehomes zero-survivor focus through a contained dropdown owner', async () => {
  const events: string[] = [];
  const owner: ContainedMenuOwner = {
    open: true,
    show(): void {
      events.push('show');
    },
    hide(options?: { focusTrigger?: boolean }): void {
      events.push(`hide:${options?.focusTrigger ?? false}`);
    },
  };
  const menu = await fixture<LyraMenu>(html`
    <lr-menu
      label="Actions"
      .dropdownContained=${true}
      .dropdownOwner=${owner}
      .dropdownOpen=${true}
    >
      <lr-menu-item id="a" value="a">A</lr-menu-item>
    </lr-menu>
  `);
  const item = byId<LyraMenuItem>(menu, 'a');
  expect(document.activeElement === item).to.equal(true);
  item.disabled = true;
  await item.updateComplete;
  await menu.updateComplete;
  expect(events).to.deep.equal(['hide:true']);
});

it('parks focus on the list itself when the last navigable item is removed while open', async () => {
  const menu = await fixture<LyraMenu>(html`
    <lr-menu label="Actions">
      <lr-menu-item id="a" value="a">A</lr-menu-item>
    </lr-menu>
  `);
  const item = byId<LyraMenuItem>(menu, 'a');
  item.focus();
  item.remove();
  await nextFrame();
  const listPart = list(menu);
  expect(menu.shadowRoot!.activeElement === listPart).to.equal(true);
  expect(listPart.tabIndex).to.equal(-1);
});

it('propagates dropdownSize to owned items, including ones added after mount', async () => {
  const menu = await fixture<LyraMenu>(html`
    <lr-menu label="Actions" .dropdownSize=${'small'}>
      <lr-menu-item id="a" value="a">A</lr-menu-item>
    </lr-menu>
  `);
  expect(byId<LyraMenuItem>(menu, 'a').size).to.equal('small');
  const extra = document.createElement('lr-menu-item') as LyraMenuItem;
  extra.id = 'b';
  extra.value = 'b';
  extra.textContent = 'B';
  menu.append(extra);
  await nextFrame();
  expect(byId<LyraMenuItem>(menu, 'b').size).to.equal('small');
});

it('resets the typeahead buffer after the timeout so a repeated key searches fresh', async () => {
  const menu = await fixture<LyraMenu>(html`
    <lr-menu label="Actions">
      <lr-menu-item id="apple" value="apple">Apple</lr-menu-item>
      <lr-menu-item id="apricot" value="apricot">Apricot</lr-menu-item>
      <lr-menu-item id="banana" value="banana">Banana</lr-menu-item>
    </lr-menu>
  `);
  byId(menu, 'banana').focus();
  press(byId(menu, 'banana'), 'a');
  expect(document.activeElement?.id).to.equal('apple');
  await new Promise((resolve) => setTimeout(resolve, 600));
  press(byId(menu, 'apple'), 'a');
  expect(document.activeElement?.id).to.equal('apricot');
});

it('resyncs items from the slot on reconnect when membership changed while detached', async () => {
  const menu = await fixture<LyraMenu>(basic());
  const parent = menu.parentNode!;
  menu.remove();
  const extra = document.createElement('lr-menu-item') as LyraMenuItem;
  extra.id = 'extra';
  extra.value = 'extra';
  extra.textContent = 'Extra';
  menu.append(extra);
  parent.appendChild(menu);
  expect(ownItems(menu).length).to.equal(4);
  await nextFrame();
  expect(byId<LyraMenuItem>(menu, 'extra').tabIndex).to.equal(-1);
});

it('keeps a nested branch open when dropdownStayOpenOnSelect is set on the root', async () => {
  const menu = await fixture<LyraMenu>(nested());
  menu.dropdownStayOpenOnSelect = true;
  await menu.updateComplete;
  const share = byId<LyraMenuItem>(menu, 'share');
  const child = byId<LyraMenu>(menu, 'share-menu');
  await share.openSubmenu('first');
  byId<LyraMenuItem>(child, 'email').select();
  await Promise.resolve();
  await settle(menu, child);
  expect(share.submenuOpen).to.equal(true);
});

it('keeps an open submenu when the pointer leaves but keyboard focus is still inside it', async () => {
  const menu = await fixture<LyraMenu>(html`
    <lr-menu label="Actions">
      <lr-menu-item id="share" value="share"
        >Share
        <lr-menu slot="submenu" id="level-2">
          <lr-menu-item id="more" value="more"
            >More
            <lr-menu slot="submenu" id="level-3">
              <lr-menu-item id="embed" value="embed">Embed</lr-menu-item>
            </lr-menu>
          </lr-menu-item>
        </lr-menu>
      </lr-menu-item>
    </lr-menu>
  `);
  const more = byId<LyraMenuItem>(menu, 'more');
  const level2 = byId<LyraMenu>(menu, 'level-2');
  await byId<LyraMenuItem>(menu, 'share').openSubmenu('first');
  await more.openSubmenu('first');
  expect(document.activeElement?.id).to.equal('embed');

  submenuSurface(level2).dispatchEvent(
    new PointerEvent('pointerleave', { bubbles: true, composed: true })
  );
  await new Promise((resolve) => setTimeout(resolve, 380));
  await settle(menu, level2, byId(menu, 'level-3'));
  expect(more.submenuOpen).to.equal(true);
});

it('closes a submenu after a pointerleave delay once focus has moved elsewhere', async () => {
  const menu = await fixture<LyraMenu>(html`
    <lr-menu label="Actions">
      <lr-menu-item id="share" value="share"
        >Share
        <lr-menu slot="submenu" id="level-2">
          <lr-menu-item id="more" value="more"
            >More
            <lr-menu slot="submenu" id="level-3">
              <lr-menu-item id="embed" value="embed">Embed</lr-menu-item>
            </lr-menu>
          </lr-menu-item>
        </lr-menu>
      </lr-menu-item>
    </lr-menu>
  `);
  const more = byId<LyraMenuItem>(menu, 'more');
  const level2 = byId<LyraMenu>(menu, 'level-2');
  await byId<LyraMenuItem>(menu, 'share').openSubmenu('first');
  await more.openSubmenu('first');

  const outside = document.createElement('button');
  document.body.append(outside);
  try {
    outside.focus();
    submenuSurface(level2).dispatchEvent(
      new PointerEvent('pointerleave', { bubbles: true, composed: true })
    );
    await waitUntil(
      () => more.submenuOpen === false,
      'submenu never closed after pointerleave',
      { timeout: 1000 }
    );
  } finally {
    outside.remove();
  }
});
