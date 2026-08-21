import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import './dropdown.js';
import '../../layout/menu/dropdown-item.js';
import '../../layout/menu/menu.js';
import { LyraDropdown } from './dropdown.class.js';
import type { LyraDropdownItem } from '../../layout/menu/dropdown-item.class.js';
import type { LyraMenu } from '../../layout/menu/menu.class.js';

function trigger(el: LyraDropdown): HTMLButtonElement {
  return el.querySelector('[slot="trigger"]') as HTMLButtonElement;
}

function items(el: LyraDropdown): LyraDropdownItem[] {
  return [...el.querySelectorAll(':scope > lr-dropdown-item')] as LyraDropdownItem[];
}

async function basic(extra = ''): Promise<LyraDropdown> {
  return fixture(html`
    <lr-dropdown aria-label="Row actions">
      <button slot="trigger">Actions</button>
      <lr-dropdown-item value="rename">Rename</lr-dropdown-item>
      <lr-dropdown-item value="archive" ?disabled=${extra === 'disabled'}>Archive</lr-dropdown-item>
      <lr-dropdown-item value="delete" variant="danger">Delete</lr-dropdown-item>
    </lr-dropdown>
  `) as Promise<LyraDropdown>;
}

it('keeps menu and trigger imperative helpers inert on a hydration-shaped pre-render root', () => {
  const el = document.createElement('lr-dropdown') as LyraDropdown;
  const hydrationState = el as unknown as {
    createRenderRoot(): ShadowRoot;
    renderRoot: ShadowRoot;
  };
  hydrationState.renderRoot = hydrationState.createRenderRoot();

  expect(el.getMenu() === null).to.equal(true);
  expect(() => {
    el.focusOnTrigger({ preventScroll: true });
    el.reposition();
  }).to.not.throw();
});

it('keeps the positioning shell neutral while the generated menu owns role and name', async () => {
  const el = await basic();
  const popup = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
  const engine = el.shadowRoot!.querySelector('lr-menu[part~="menu"]') as LyraMenu | null;
  const menuRole = engine?.shadowRoot?.querySelector('[role="menu"]');

  expect(popup.getAttribute('role')).to.equal(null);
  expect(popup.getAttribute('aria-label')).to.equal(null);
  expect(popup.getAttribute('part')?.split(/\s+/)).to.include.members([
    'popup',
    'base',
    'base__popup',
    'panel',
  ]);
  expect(engine?.localName).to.equal('lr-menu');
  expect(menuRole?.getAttribute('role')).to.equal('menu');
  expect(menuRole?.getAttribute('aria-label')).to.equal('Row actions');
});

it('normalizes the additive inherited popup-role instead of corrupting dropdown semantics', async () => {
  const el = (await fixture(html`
    <lr-dropdown popup-role="dialog" aria-label="Actions dialog">
      <button slot="trigger">Actions</button>
      <lr-dropdown-item value="rename">Rename</lr-dropdown-item>
    </lr-dropdown>
  `)) as LyraDropdown;
  const popup = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
  const engine = el.shadowRoot!.querySelector('lr-menu[part~="menu"]') as LyraMenu;
  const triggerButton = el.querySelector('button')!;
  const menuRole = engine.shadowRoot!.querySelector('[role="menu"]')!;

  expect(el.popupRole).to.equal('menu');
  expect(el.getAttribute('popup-role')).to.equal('menu');
  expect(popup.getAttribute('role')).to.equal(null);
  expect(popup.getAttribute('aria-label')).to.equal(null);
  expect(triggerButton.getAttribute('aria-haspopup')).to.equal('menu');
  expect(menuRole.getAttribute('aria-label')).to.equal('Actions dialog');
  await expect(el).to.be.accessible();
});

it('releases a live consumer menu structurally without standalone lifecycle events', async () => {
  const el = (await fixture(html`
    <lr-dropdown>
      <button slot="trigger">Actions</button>
      <lr-menu label="Actions">
        <lr-dropdown-item value="rename">Rename</lr-dropdown-item>
      </lr-menu>
    </lr-dropdown>
  `)) as LyraDropdown;
  const menu = el.querySelector('lr-menu') as LyraMenu;
  await el.show();
  await menu.updateComplete;
  const events: string[] = [];
  menu.addEventListener('lr-show', () => events.push('show'));
  menu.addEventListener('lr-hide', () => events.push('hide'));

  menu.slot = 'retired';
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  await menu.updateComplete;

  expect(menu.dropdownOpen).to.equal(false);
  expect(events).to.deep.equal([]);
});

it('restores every author-owned consumer-menu field when containment ends', async () => {
  const el = document.createElement('lr-dropdown') as LyraDropdown;
  const button = document.createElement('button');
  button.slot = 'trigger';
  button.textContent = 'Actions';
  const menu = document.createElement('lr-menu') as LyraMenu;
  menu.dropdownContained = true;
  menu.dropdownRendersMenuRole = true;
  menu.dropdownStayOpenOnSelect = true;
  menu.dropdownSize = 'large';
  menu.dropdownLabel = 'Original fallback';
  menu.dropdownOpen = true;
  el.append(button, menu);
  document.body.append(el);
  try {
    await el.updateComplete;
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(menu.dropdownOwner === el).to.equal(true);
    expect(menu.dropdownSize).to.equal('m');
    expect(menu.dropdownLabel).to.equal('Menu');
    expect(menu.dropdownOpen).to.equal(false);

    menu.slot = 'retired';
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    await menu.updateComplete;
    expect(menu.dropdownOwner).to.equal(null);
    expect(menu.dropdownContained).to.equal(true);
    expect(menu.dropdownRendersMenuRole).to.equal(true);
    expect(menu.dropdownStayOpenOnSelect).to.equal(true);
    expect(menu.dropdownSize).to.equal('large');
    expect(menu.dropdownLabel).to.equal('Original fallback');
    expect(menu.dropdownOpen).to.equal(true);
  } finally {
    el.remove();
  }
});

it('exposes the current menu and an imperative trigger focus method across reconnect', async () => {
  const el = await basic();
  const engine = el.shadowRoot!.querySelector('lr-menu[part~="menu"]') as LyraMenu;
  expect(el.getMenu() === engine).to.equal(true);
  el.focusOnTrigger();
  expect(document.activeElement === trigger(el)).to.equal(true);
  const parent = el.parentElement!;
  el.remove();
  parent.append(el);
  await el.updateComplete;
  expect(el.getMenu() === engine).to.equal(true);
  el.focusOnTrigger({ preventScroll: true });
  expect(document.activeElement === trigger(el)).to.equal(true);
});

it('uses the mapped distance=0 default without changing an explicit distance', async () => {
  const implicit = await basic();
  expect(implicit.distance).to.equal(0);

  const explicit = (await fixture(html`
    <lr-dropdown distance="12">
      <button slot="trigger">Actions</button>
      <lr-dropdown-item>Rename</lr-dropdown-item>
    </lr-dropdown>
  `)) as LyraDropdown;
  expect(explicit.distance).to.equal(12);
});

it('returns lifecycle promises that settle after the matching after-event', async () => {
  const el = await basic();
  let afterShow = false;
  let afterHide = false;
  el.addEventListener('lr-after-show', () => {
    afterShow = true;
  });
  el.addEventListener('lr-after-hide', () => {
    afterHide = true;
  });

  const showing = el.show();
  expect(showing).to.be.instanceOf(Promise);
  await showing;
  expect(afterShow).to.equal(true);

  const hiding = el.hide();
  expect(hiding).to.be.instanceOf(Promise);
  await hiding;
  expect(afterHide).to.equal(true);
});

it('opens from ArrowDown/ArrowUp and reuses disabled-skipping roving focus', async () => {
  const el = await basic('disabled');
  const [first, , last] = items(el);

  trigger(el).dispatchEvent(new KeyboardEvent('keydown', {
    key: 'ArrowDown',
    bubbles: true,
    cancelable: true,
  }));
  await el.updateComplete;
  expect(el.open).to.equal(true);
  await waitUntil(
    () => document.activeElement === first,
    'the first enabled item receives focus once initial placement makes the popup visible',
  );
  expect((document.activeElement as HTMLElement).getAttribute('value')).to.equal(first?.value);

  el.hide();
  await el.updateComplete;
  trigger(el).dispatchEvent(new KeyboardEvent('keydown', {
    key: 'ArrowUp',
    bubbles: true,
    cancelable: true,
  }));
  await el.updateComplete;
  await waitUntil(
    () => document.activeElement === last,
    'the last enabled item receives focus once initial placement makes the popup visible',
  );
  expect((document.activeElement as HTMLElement).getAttribute('value')).to.equal(last?.value);
});

it('emits one cancelable lr-select with detail.item, closes, and returns focus', async () => {
  const el = await basic();
  trigger(el).click();
  await el.updateComplete;
  let count = 0;
  let legacyAliasCount = 0;
  let event: CustomEvent<{ item: LyraDropdownItem }> | undefined;
  el.addEventListener('lr-select', (received) => {
    count += 1;
    event = received as CustomEvent<{ item: LyraDropdownItem }>;
  });
  el.addEventListener('lr-menu-select', () => {
    legacyAliasCount += 1;
  });

  const selected = items(el)[1]!;
  selected.select();
  await el.updateComplete;

  expect(event?.cancelable).to.equal(true);
  expect(event?.detail.item.localName).to.equal('lr-dropdown-item');
  expect(event?.detail.item.value).to.equal('archive');
  expect(count).to.equal(1);
  expect(legacyAliasCount).to.equal(0);
  expect(el.open).to.equal(false);
  expect((document.activeElement as HTMLElement).localName).to.equal('button');
});

it('keeps the dropdown open when lr-select is prevented or stay-open-on-select is set', async () => {
  const prevented = await basic();
  prevented.addEventListener('lr-select', (event) => event.preventDefault());
  trigger(prevented).click();
  await prevented.updateComplete;
  items(prevented)[0]!.select();
  await prevented.updateComplete;
  expect(prevented.open).to.equal(true);

  const persistent = (await fixture(html`
    <lr-dropdown stay-open-on-select>
      <button slot="trigger">Actions</button>
      <lr-dropdown-item value="rename">Rename</lr-dropdown-item>
    </lr-dropdown>
  `)) as LyraDropdown;
  trigger(persistent).click();
  await persistent.updateComplete;
  (persistent.querySelector('lr-dropdown-item') as LyraDropdownItem).select();
  await persistent.updateComplete;
  expect(persistent.open).to.equal(true);
});

it('disabled blocks pointer and keyboard opening and closes an already-open dropdown', async () => {
  const el = await basic();
  el.disabled = true;
  await el.updateComplete;
  trigger(el).click();
  trigger(el).dispatchEvent(new KeyboardEvent('keydown', {
    key: 'ArrowDown',
    bubbles: true,
    cancelable: true,
  }));
  await el.updateComplete;
  expect(el.open).to.equal(false);

  el.disabled = false;
  el.show();
  await el.updateComplete;
  expect(el.open).to.equal(true);
  el.disabled = true;
  await el.updateComplete;
  expect(el.open).to.equal(false);
});

it('normalizes disabled plus open initial markup to closed in either attribute order', async () => {
  const cases = [
    html`<lr-dropdown disabled open>
      <button slot="trigger">Actions</button>
      <lr-dropdown-item value="rename">Rename</lr-dropdown-item>
    </lr-dropdown>`,
    html`<lr-dropdown open disabled>
      <button slot="trigger">Actions</button>
      <lr-dropdown-item value="rename">Rename</lr-dropdown-item>
    </lr-dropdown>`,
  ];
  for (const [index, template] of cases.entries()) {
    const el = (await fixture(template)) as LyraDropdown;
    await el.updateComplete;
    const popup = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
    const engine = el.shadowRoot!.querySelector('lr-menu[part~="menu"]') as LyraMenu;
    expect(el.open, `case ${index}`).to.equal(false);
    expect(el.hasAttribute('open'), `case ${index}`).to.equal(false);
    expect(popup.hasAttribute('data-hidden'), `case ${index}`).to.equal(true);
    expect(engine.dropdownOpen, `case ${index}`).to.equal(false);
  }
});

it('normalizes disabled plus open property writes made before custom-element upgrade', async () => {
  const localName = `lr-test-dropdown-disabled-${Math.random().toString(36).slice(2)}`;
  const first = document.createElement(localName) as HTMLElement & {
    open: boolean;
    disabled: boolean;
    updateComplete: Promise<unknown>;
  };
  const second = document.createElement(localName) as typeof first;
  first.open = true;
  first.disabled = true;
  second.disabled = true;
  second.open = true;
  document.body.append(first, second);
  customElements.define(localName, class extends LyraDropdown {});
  await Promise.all([first.updateComplete, second.updateComplete]);
  try {
    for (const el of [first, second]) {
      expect(el.open).to.equal(false);
      expect(el.hasAttribute('open')).to.equal(false);
      expect(el.disabled).to.equal(true);
    }
  } finally {
    first.remove();
    second.remove();
  }
});

it('propagates the dropdown size to mapped items without changing the shared item ladder', async () => {
  const el = (await fixture(html`
    <lr-dropdown size="small">
      <button slot="trigger">Actions</button>
      <lr-dropdown-item value="rename">Rename</lr-dropdown-item>
    </lr-dropdown>
  `)) as LyraDropdown;
  await el.updateComplete;
  const item = el.querySelector('lr-dropdown-item') as LyraDropdownItem;
  expect(el.size).to.equal('small');
  expect(item.size).to.equal('small');
});

it('accepts a consumer-supplied lr-menu as the sole menu role owner', async () => {
  const el = (await fixture(html`
    <lr-dropdown>
      <button slot="trigger">Actions</button>
      <lr-menu label="Actions">
        <lr-dropdown-item value="rename">Rename</lr-dropdown-item>
        <lr-dropdown-item value="archive">Archive</lr-dropdown-item>
      </lr-menu>
    </lr-dropdown>
  `)) as LyraDropdown;
  const supplied = el.querySelector('lr-menu') as LyraMenu;
  trigger(el).click();
  await el.updateComplete;
  await supplied.updateComplete;

  let selectCount = 0;
  let legacyAliasCount = 0;
  el.addEventListener('lr-select', () => {
    selectCount += 1;
  });
  el.addEventListener('lr-menu-select', () => {
    legacyAliasCount += 1;
  });
  (supplied.querySelector('[value="rename"]') as LyraDropdownItem).select();
  await el.updateComplete;

  expect(el.shadowRoot!.querySelectorAll('lr-menu[part~="menu"]').length).to.equal(0);
  expect(supplied.shadowRoot!.querySelector('[role="menu"]')?.getAttribute('aria-label')).to.equal('Actions');
  expect(selectCount).to.equal(1);
  expect(legacyAliasCount).to.equal(0);
});

it('preserves a consumer menu header/list/footer, live regions, focus order, and supplied name', async () => {
  const el = (await fixture(html`
    <lr-dropdown aria-label="Dropdown fallback" style="--show-duration:0ms;--hide-duration:0ms">
      <button id="actions-trigger" slot="trigger">Actions</button>
      <lr-menu label="Filter actions">
        <input id="filter" slot="header" aria-label="Filter actions" />
        <lr-dropdown-item value="rename">Rename</lr-dropdown-item>
        <button id="apply" slot="footer">Apply</button>
      </lr-menu>
    </lr-dropdown>
  `)) as LyraDropdown;
  const supplied = el.querySelector('lr-menu') as LyraMenu;
  await el.show();
  await supplied.updateComplete;
  const popup = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
  await waitUntil(
    () => !popup.hasAttribute('data-hidden'),
    'the contained menu becomes focusable after placement',
  );
  const list = supplied.shadowRoot!.querySelector('[part="list"]') as HTMLElement;
  const header = supplied.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
  const footer = supplied.shadowRoot!.querySelector('[part="footer"]') as HTMLElement;
  const filter = supplied.querySelector('#filter') as HTMLInputElement;
  const apply = supplied.querySelector('#apply') as HTMLButtonElement;

  expect(popup.getAttribute('role')).to.equal(null);
  expect(list.getAttribute('role')).to.equal('menu');
  expect(list.getAttribute('aria-label')).to.equal('Filter actions');
  expect(filter.assignedSlot?.name).to.equal('header');
  expect(apply.assignedSlot?.name).to.equal('footer');
  expect(getComputedStyle(header).display).to.not.equal('none');
  expect(getComputedStyle(footer).display).to.not.equal('none');

  const item = supplied.querySelector('lr-dropdown-item') as LyraDropdownItem;
  expect(item.getAttribute('aria-label')).to.equal('Rename');
  item.focus();
  expect(document.activeElement?.getAttribute('value')).to.equal('rename');
  const tab = new KeyboardEvent('keydown', {
    key: 'Tab',
    bubbles: true,
    composed: true,
    cancelable: true,
  });
  item.dispatchEvent(tab);
  await supplied.updateComplete;
  expect(tab.defaultPrevented).to.equal(false);
  expect(el.open).to.equal(true);
  apply.focus();
  expect(document.activeElement?.id).to.equal('apply');

  filter.slot = 'retired';
  const replacement = document.createElement('input');
  replacement.id = 'replacement-filter';
  replacement.slot = 'header';
  replacement.setAttribute('aria-label', 'Replacement filter');
  supplied.append(replacement);
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  await supplied.updateComplete;
  expect(item.getAttribute('aria-label')).to.equal('Rename');
  expect(replacement.assignedSlot?.name).to.equal('header');
  expect(filter.assignedSlot?.name ?? null).to.equal(null);
  await expect(el).to.be.accessible();
});

it('uses the dropdown label only as a consumer menu fallback', async () => {
  const el = (await fixture(html`
    <lr-dropdown aria-label="Dropdown actions">
      <button slot="trigger">Actions</button>
      <lr-menu><lr-dropdown-item value="rename">Rename</lr-dropdown-item></lr-menu>
    </lr-dropdown>
  `)) as LyraDropdown;
  const supplied = el.querySelector('lr-menu') as LyraMenu;
  await el.updateComplete;
  await supplied.updateComplete;
  const list = supplied.shadowRoot!.querySelector('[role="menu"]')!;
  expect(list.getAttribute('aria-label')).to.equal('Dropdown actions');

  supplied.label = 'Supplied actions';
  await supplied.updateComplete;
  expect(list.getAttribute('aria-label')).to.equal('Supplied actions');
  supplied.setAttribute('aria-label', 'Host-owned actions');
  await supplied.updateComplete;
  expect(list.getAttribute('aria-label')).to.equal('Host-owned actions');
});

it('rejoins the contained menu engine after an open dropdown is reparented', async () => {
  const el = await basic();
  const fixtureParent = el.parentElement!;
  trigger(el).click();
  await el.updateComplete;
  const engine = el.shadowRoot!.querySelector('lr-menu[part~="menu"]') as LyraMenu;
  await engine.updateComplete;
  expect(engine.dropdownOpen).to.equal(true);

  el.remove();
  expect(engine.dropdownOpen).to.equal(false);
  fixtureParent.append(el);
  await el.updateComplete;
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  await engine.updateComplete;

  expect(el.open).to.equal(true);
  expect(engine.dropdownOpen).to.equal(true);
  engine.focusContained('last');
  await waitUntil(
    () => document.activeElement?.getAttribute('value') === 'delete',
    'the reconnected popup restores its selected roving item after placement',
  );
  expect((document.activeElement as HTMLElement).getAttribute('value')).to.equal('delete');
});

it('uses the direct-item WA submenu shape for nested keyboard selection and one outer lr-select', async () => {
  const el = (await fixture(html`
    <lr-dropdown>
      <button slot="trigger">Actions</button>
      <lr-dropdown-item id="share">
        Share
        <lr-dropdown-item slot="submenu" value="email">Email</lr-dropdown-item>
        <lr-dropdown-item slot="submenu" value="copy">Copy link</lr-dropdown-item>
      </lr-dropdown-item>
      <lr-dropdown-item value="move">Move</lr-dropdown-item>
    </lr-dropdown>
  `)) as LyraDropdown;
  const parent = el.querySelector('#share') as LyraDropdownItem;
  trigger(el).click();
  await el.updateComplete;
  await parent.updateComplete;

  parent.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'ArrowRight',
    bubbles: true,
    composed: true,
    cancelable: true,
  }));
  await parent.updateComplete;
  expect(parent.submenuOpen).to.equal(true);
  expect((document.activeElement as HTMLElement).getAttribute('value')).to.equal('email');

  let selectedValue = '';
  let selectCount = 0;
  let legacyAliasCount = 0;
  el.addEventListener('lr-select', (event) => {
    selectedValue = event.detail.item.value;
    selectCount += 1;
  });
  el.addEventListener('lr-menu-select', () => {
    legacyAliasCount += 1;
  });
  (document.activeElement as LyraDropdownItem).select();
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  await el.updateComplete;
  expect(selectedValue).to.equal('email');
  expect(selectCount).to.equal(1);
  expect(legacyAliasCount).to.equal(0);
  expect(el.open).to.equal(false);
  expect((document.activeElement as HTMLElement).textContent).to.equal('Actions');
});

it('mirrors submenu arrows and preserves the safe pointer corridor under RTL', async () => {
  const el = (await fixture(html`
    <lr-dropdown dir="rtl">
      <button slot="trigger">Actions</button>
      <lr-dropdown-item id="share">
        Share
        <lr-dropdown-item slot="submenu" value="email">Email</lr-dropdown-item>
      </lr-dropdown-item>
      <lr-dropdown-item value="move">Move</lr-dropdown-item>
    </lr-dropdown>
  `)) as LyraDropdown;
  const parent = el.querySelector('#share') as LyraDropdownItem;
  trigger(el).click();
  await el.updateComplete;
  await parent.updateComplete;

  parent.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'ArrowLeft',
    bubbles: true,
    composed: true,
    cancelable: true,
  }));
  await parent.updateComplete;
  expect(parent.submenuOpen).to.equal(true);
  expect((document.activeElement as HTMLElement).getAttribute('value')).to.equal('email');

  (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', {
    key: 'ArrowRight',
    bubbles: true,
    composed: true,
    cancelable: true,
  }));
  await parent.updateComplete;
  expect(parent.submenuOpen).to.equal(false);
  await waitUntil(
    () => (document.activeElement as HTMLElement | null)?.id === 'share',
    'submenu focus returns once its outer dropdown has completed placement',
  );
  expect((document.activeElement as HTMLElement).id).to.equal('share');

  // Pointer intent opens after 150ms. Leaving the outer list schedules a 300ms close; reaching
  // the submenu before that deadline cancels it, which is the safe-corridor behavior.
  parent.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, composed: true }));
  await new Promise((resolve) => setTimeout(resolve, 180));
  expect(parent.submenuOpen).to.equal(true);
  const engine = el.shadowRoot!.querySelector('lr-menu[part~="menu"]') as LyraMenu;
  const engineSlot = engine.shadowRoot!.querySelector('slot') as HTMLSlotElement;
  engineSlot.dispatchEvent(new PointerEvent('pointerleave'));
  const nestedItem = parent.querySelector('[slot="submenu"]') as LyraDropdownItem;
  nestedItem.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, composed: true }));
  await new Promise((resolve) => setTimeout(resolve, 330));
  expect(parent.submenuOpen).to.equal(true);
  await expect(el).to.be.accessible();
});

it('maps hoist and sync into positioning and exposes an immediate reposition method', async () => {
  const el = (await fixture(html`
    <lr-dropdown hoist sync="width">
      <button slot="trigger" style="inline-size: 180px">Actions</button>
      <lr-dropdown-item>Rename</lr-dropdown-item>
    </lr-dropdown>
  `)) as LyraDropdown;
  el.show();
  await el.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const popup = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
  expect(popup.style.position).to.equal('fixed');
  expect(Math.round(popup.getBoundingClientRect().width)).to.equal(
    Math.round(trigger(el).getBoundingClientRect().width),
  );
  expect(() => el.reposition()).not.to.throw();
});

it('uses absolute positioning by default and treats containingElement as inside light dismiss', async () => {
  const containing = document.createElement('div');
  const inside = document.createElement('button');
  inside.textContent = 'Inside containing element';
  containing.append(inside);
  document.body.append(containing);
  try {
    const el = await basic();
    el.containingElement = containing;
    el.show();
    await el.updateComplete;
    const popup = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
    expect(popup.style.position).to.equal('absolute');

    inside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.open).to.equal(true);

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.open).to.equal(false);
  } finally {
    containing.remove();
  }
});

it('uses an external `for` anchor while keeping the slotted trigger as the focus-return owner', async () => {
  const wrapper = await fixture(html`
    <div style="position: relative">
      <button id="external" style="position: absolute; inset-inline-start: 240px">Anchor</button>
      <lr-dropdown for="external">
        <button slot="trigger">Actions</button>
        <lr-dropdown-item value="rename">Rename</lr-dropdown-item>
      </lr-dropdown>
    </div>
  `);
  const el = wrapper.querySelector('lr-dropdown') as LyraDropdown;
  el.show();
  await el.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const popup = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
  expect(Math.abs(popup.getBoundingClientRect().left - wrapper.querySelector('#external')!.getBoundingClientRect().left)).to.be.lessThan(2);

  (el.querySelector('lr-dropdown-item') as LyraDropdownItem).select();
  await el.updateComplete;
  expect((document.activeElement as HTMLElement).textContent).to.equal('Actions');
});

it('is accessible populated and open with mapped items', async () => {
  const el = await basic('disabled');
  await expect(el).to.be.accessible();
  trigger(el).click();
  await el.updateComplete;
  // LyraDropdown extends LyraPopover, so opening it starts the inherited WAAPI fade
  // (animateRegistered() on its own `[part~="popup"]`), still running right after the click
  // settles. Left running, axe's color-contrast check factors in the popup's current
  // (transitional) opacity, so sampling mid-fade blends its text and background toward each other
  // and reports a false "serious" violation. Finishing it outright matches the idiom
  // overlay.test.ts already uses for this same kind of reveal animation.
  el.shadowRoot!.querySelector('[part~="popup"]')?.getAnimations().forEach((animation) => animation.finish());
  await expect(el).to.be.accessible();
});

// Lit resolves `updateComplete` to `false` when a render scheduled another render. Closing an
// overlay used to do exactly that: the paint-gating `anchorPositioned` state was cleared from
// `updated()`, after the update had completed, costing an extra render that changed nothing
// visible and emitting Lit's change-in-update warning to every consumer on a dev build.
// Asserting the boolean measures the wasted render directly, rather than a console message Lit
// only ever emits once per tag per page.
it('settles closing in a single render, scheduling no follow-up update', async () => {
  const el = await basic();
  el.open = true;
  await el.updateComplete;
  await aTimeout(120);

  el.open = false;
  expect(await el.updateComplete, 'closing scheduled a second render').to.be.true;
});
