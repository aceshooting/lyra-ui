import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './menu-item.js';
import './dropdown-item.js';
import type { LyraMenuItem } from './menu-item.js';
import './menu.js';
import type { MenuFocusTarget } from './menu.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

// role="menuitem" requires a role="menu"/"menubar"/"group" ancestor to
// satisfy axe's aria-required-parent rule -- <lr-menu> normally supplies
// that; a plain wrapper stands in for it here since this file tests
// <lr-menu-item> in isolation, mirroring lr-conversation-item's
// identical fixtureInListbox helper for its own role="option".
async function fixtureInMenu(item: import('lit').TemplateResult): Promise<LyraMenuItem> {
  const wrapper = (await fixture(html`<div role="menu" aria-label="Actions">${item}</div>`)) as HTMLElement;
  return wrapper.querySelector('lr-menu-item') as LyraMenuItem;
}

class MenuItemLabelForwardWrapper extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <div role="menu" aria-label="Actions">
        <lr-menu-item id="item" value="share">
          <slot>Forwarded fallback</slot>
          <lr-menu id="panel" slot="submenu">
            <lr-menu-item value="email">Email</lr-menu-item>
          </lr-menu>
        </lr-menu-item>
      </div>
    `;
  }
}
if (!customElements.get('menu-item-label-forward-wrapper')) {
  customElements.define('menu-item-label-forward-wrapper', MenuItemLabelForwardWrapper);
}

it('defaults to value="", disabled=false, destructive=false, type="normal", checked=false', async () => {
  const el = (await fixture(html`<lr-menu-item>Rename</lr-menu-item>`)) as LyraMenuItem;
  expect(el.value).to.equal('');
  expect(el.disabled).to.be.false;
  expect(el.destructive).to.be.false;
  expect(el.type).to.equal('normal');
  expect(el.checked).to.be.false;
});

it('sets role="menuitem" on the host', async () => {
  const el = await fixtureInMenu(html`<lr-menu-item>Rename</lr-menu-item>`);
  expect(el.getAttribute('role')).to.equal('menuitem');
});

it('reflects disabled/destructive to attributes', async () => {
  const el = (await fixture(html`<lr-menu-item disabled destructive>Delete</lr-menu-item>`)) as LyraMenuItem;
  expect(el.hasAttribute('disabled')).to.be.true;
  expect(el.hasAttribute('destructive')).to.be.true;
  expect(el.getAttribute('aria-disabled')).to.equal('true');
});

it('normalizes variant="danger" with the legacy destructive treatment', async () => {
  const modern = (await fixture(html`<lr-menu-item variant="danger">Delete</lr-menu-item>`)) as LyraMenuItem;
  const legacy = (await fixture(html`<lr-menu-item destructive>Delete</lr-menu-item>`)) as LyraMenuItem;
  const modernBase = modern.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const legacyBase = legacy.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  expect(modern.variant).to.equal('danger');
  expect(getComputedStyle(modernBase).color).to.equal(getComputedStyle(legacyBase).color);
});

it('renders WA details and Shoelace prefix/suffix compatibility slots through named parts', async () => {
  const el = (await fixture(html`
    <lr-menu-item>
      <span slot="prefix">P</span>
      Rename
      <span slot="details">⌘R</span>
      <span slot="suffix">S</span>
    </lr-menu-item>
  `)) as LyraMenuItem;
  expect(el.shadowRoot!.querySelector('[part~="icon"] slot[name="prefix"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part~="details"] slot[name="details"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part~="suffix"] slot[name="suffix"]')).to.exist;
});

it('keeps every display slot decorative while the host retains the sole menuitem action', async () => {
  const wrapper = (await fixture(html`
    <div role="menu" aria-label="Actions">
      <lr-menu-item id="rename" value="rename" tabindex="0">
        <button id="icon" slot="icon" type="button">Icon action</button>
        <button id="prefix" slot="prefix" type="button">Prefix action</button>
        <button id="label" type="button">Rename</button>
        <button id="details" slot="details" type="button">Shortcut action</button>
        <button id="suffix" slot="suffix" type="button">Suffix action</button>
      </lr-menu-item>
    </div>
  `)) as HTMLElement;
  const item = wrapper.querySelector<LyraMenuItem>('#rename')!;
  const label = wrapper.querySelector<HTMLButtonElement>('#label')!;
  const displayControls = ['icon', 'prefix', 'label', 'details', 'suffix']
    .map((id) => wrapper.querySelector<HTMLButtonElement>(`#${id}`)!);
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await item.updateComplete;

  for (const control of displayControls) {
    control.focus();
    expect(
      item.ownerDocument.activeElement?.id,
      `${control.id} cannot become a second focus stop inside the menuitem`,
    ).to.not.equal(control.id);
    expect(
      control.assignedSlot?.closest<HTMLElement>('[inert]')?.getAttribute('aria-hidden'),
      `${control.id} is visual-only item chrome`,
    ).to.equal('true');
  }

  expect(item.getTextLabel()).to.equal('Rename');
  expect(item.getAttribute('aria-label')).to.equal('Rename');

  let slottedClicks = 0;
  let selections = 0;
  label.addEventListener('click', () => slottedClicks += 1);
  item.addEventListener('lr-menu-item-select', () => selections += 1);
  const rect = label.getBoundingClientRect();
  try {
    await sendMouse({
      type: 'click',
      position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
    });
  } finally {
    await resetMouse();
  }

  expect(slottedClicks).to.equal(0);
  expect(selections).to.equal(1);
  await expect(wrapper).to.be.accessible();
});

it('treats loading as interaction-disabled and renders the spinner parts', async () => {
  const el = (await fixture(html`<lr-menu-item loading>Saving</lr-menu-item>`)) as LyraMenuItem;
  let selected = false;
  el.addEventListener('lr-menu-item-select', () => {
    selected = true;
  });
  el.select();
  expect(el.getAttribute('aria-disabled')).to.equal('true');
  expect(el.shadowRoot!.querySelector('[part~="spinner"]')).to.exist;
  expect(selected).to.equal(false);
});

it('keeps loading opt-in and exposes the visible text through getTextLabel()', async () => {
  const el = (await fixture(html`
    <lr-menu-item><span slot="prefix">P</span>Rename</lr-menu-item>
  `)) as LyraMenuItem;
  expect(el.loading).to.equal(false);
  expect(el.hasAttribute('loading')).to.equal(false);
  expect(el.getAttribute('aria-disabled')).to.equal('false');
  expect(el.shadowRoot!.querySelector('[part~="spinner"]')).to.equal(null);
  expect(el.getTextLabel()).to.equal('Rename');
});

it('constructs native-state and label observers in the adopted owner document realm', async () => {
  const frame = document.createElement('iframe');
  const loaded = new Promise<void>((resolve) =>
    frame.addEventListener('load', () => resolve(), { once: true }),
  );
  document.body.append(frame);
  await loaded;
  const frameDocument = frame.contentDocument!;
  const frameWindow = frame.contentWindow!;
  const OriginalFrameObserver = frameWindow.MutationObserver;
  let frameObserverConstructions = 0;
  frameWindow.MutationObserver = function (callback: MutationCallback): MutationObserver {
    frameObserverConstructions += 1;
    return new OriginalFrameObserver(callback);
  } as unknown as typeof MutationObserver;
  let el: LyraMenuItem | undefined;
  let mainMenu: HTMLElement | undefined;

  try {
    el = document.createElement('lr-menu-item') as LyraMenuItem;
    const label = document.createElement('span');
    label.textContent = 'Before adoption';
    el.append(label);
    mainMenu = document.createElement('div');
    mainMenu.setAttribute('role', 'menu');
    mainMenu.setAttribute('aria-label', 'Actions');
    mainMenu.append(el);
    document.body.append(mainMenu);
    await el.updateComplete;

    const menu = frameDocument.createElement('div');
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Actions');
    frameDocument.body.append(menu);
    menu.append(el);
    await el.updateComplete;
    await Promise.resolve();

    label.textContent = 'After adoption';
    await Promise.resolve();
    await el.updateComplete;

    expect(frameObserverConstructions, 'both observers use the iframe constructor').to.be.at.least(2);
    expect(el.getTextLabel()).to.equal('After adoption');
  } finally {
    el?.remove();
    mainMenu?.remove();
    frameWindow.MutationObserver = OriginalFrameObserver;
    frame.remove();
  }
});

it('renders aria-disabled="false" when enabled', async () => {
  const el = (await fixture(html`<lr-menu-item>Rename</lr-menu-item>`)) as LyraMenuItem;
  expect(el.getAttribute('aria-disabled')).to.equal('false');
});

it('fires lr-menu-item-select on click', async () => {
  const el = (await fixture(html`<lr-menu-item value="rename">Rename</lr-menu-item>`)) as LyraMenuItem;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  setTimeout(() => base.click());
  const ev = await oneEvent(el, 'lr-menu-item-select');
  // emit() forwards `detail` verbatim to the CustomEvent constructor; an
  // omitted detail resolves to `null` there, not `undefined`.
  expect(ev.detail).to.be.null;
});

it('select() fires lr-menu-item-select directly, for a parent menu\'s own keyboard handling', async () => {
  const el = (await fixture(html`<lr-menu-item value="rename">Rename</lr-menu-item>`)) as LyraMenuItem;
  setTimeout(() => el.select());
  await oneEvent(el, 'lr-menu-item-select');
});

it('does not fire lr-menu-item-select on click or select() while disabled', async () => {
  const el = (await fixture(html`<lr-menu-item disabled>Delete</lr-menu-item>`)) as LyraMenuItem;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  let fired = false;
  el.addEventListener('lr-menu-item-select', () => (fired = true));
  base.click();
  el.select();
  expect(fired).to.be.false;
});

it('starts with tabIndex -1 before any parent menu manages roving focus', async () => {
  const el = (await fixture(html`<lr-menu-item>Rename</lr-menu-item>`)) as LyraMenuItem;
  expect(el.tabIndex).to.equal(-1);
});

it('forces tabIndex to -1 and blurs itself the moment disabled flips true while it holds real focus', async () => {
  const el = await fixtureInMenu(html`<lr-menu-item tabindex="0">Rename</lr-menu-item>`);
  el.focus();
  expect((document.activeElement) === (el)).to.equal(true);

  el.disabled = true;
  await el.updateComplete;
  expect(el.tabIndex).to.equal(-1);
  expect((document.activeElement) !== (el)).to.equal(true);
});

it('hides the icon part when the icon slot is empty, shows it once populated', async () => {
  const el = (await fixture(html`<lr-menu-item>Rename</lr-menu-item>`)) as LyraMenuItem;
  const iconPart = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
  expect(iconPart.hidden).to.be.true;

  const el2 = (await fixture(html`
    <lr-menu-item><span slot="icon">✏️</span>Rename</lr-menu-item>
  `)) as LyraMenuItem;
  const iconPart2 = el2.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
  expect(iconPart2.hidden).to.be.false;
});

it('type="checkbox" renders role="menuitemcheckbox" with aria-checked reflecting checked', async () => {
  const el = await fixtureInMenu(html`<lr-menu-item type="checkbox">Wrap text</lr-menu-item>`);
  expect(el.getAttribute('role')).to.equal('menuitemcheckbox');
  expect(el.getAttribute('aria-checked')).to.equal('false');

  el.checked = true;
  await el.updateComplete;
  expect(el.getAttribute('aria-checked')).to.equal('true');
});

it('clicking a type="checkbox" item toggles checked and fires lr-menu-item-change with { value, checked }, in addition to lr-menu-item-select', async () => {
  const el = (await fixture(
    html`<lr-menu-item type="checkbox" value="wrap">Wrap text</lr-menu-item>`,
  )) as LyraMenuItem;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  let selectFired = false;
  el.addEventListener('lr-menu-item-select', () => (selectFired = true));

  setTimeout(() => base.click());
  const ev = await oneEvent(el, 'lr-menu-item-change');
  expect(ev.detail).to.deep.equal({ value: 'wrap', checked: true });
  expect(el.checked).to.be.true;
  expect(el.getAttribute('aria-checked')).to.equal('true');
  expect(selectFired).to.be.true;

  setTimeout(() => base.click());
  const ev2 = await oneEvent(el, 'lr-menu-item-change');
  expect(ev2.detail).to.deep.equal({ value: 'wrap', checked: false });
  expect(el.checked).to.be.false;
});

it('select() toggles checked and fires lr-menu-item-change for type="checkbox" (Enter/Space, via a parent menu\'s own keydown handling)', async () => {
  const el = (await fixture(
    html`<lr-menu-item type="checkbox" value="wrap">Wrap text</lr-menu-item>`,
  )) as LyraMenuItem;

  setTimeout(() => el.select());
  const ev = await oneEvent(el, 'lr-menu-item-change');
  expect(ev.detail).to.deep.equal({ value: 'wrap', checked: true });

  setTimeout(() => el.select());
  const ev2 = await oneEvent(el, 'lr-menu-item-change');
  expect(ev2.detail).to.deep.equal({ value: 'wrap', checked: false });
});

it('does not toggle checked or fire lr-menu-item-change on click or select() while disabled', async () => {
  const el = (await fixture(
    html`<lr-menu-item type="checkbox" disabled value="wrap">Wrap text</lr-menu-item>`,
  )) as LyraMenuItem;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  let fired = false;
  el.addEventListener('lr-menu-item-change', () => (fired = true));
  base.click();
  el.select();
  expect(fired).to.be.false;
  expect(el.checked).to.be.false;
});

it('renders a checkmark glyph only when type="checkbox" and checked', async () => {
  const unchecked = (await fixture(
    html`<lr-menu-item type="checkbox" value="wrap">Wrap text</lr-menu-item>`,
  )) as LyraMenuItem;
  expect(unchecked.shadowRoot!.querySelector('[part="checkmark"]')).to.not.exist;

  const checked = (await fixture(
    html`<lr-menu-item type="checkbox" checked value="wrap">Wrap text</lr-menu-item>`,
  )) as LyraMenuItem;
  expect(checked.shadowRoot!.querySelector('[part="checkmark"]')).to.exist;
});

it('type="normal" (default, omitted) is completely unaffected -- same role, no aria-checked, no checkmark, no lr-menu-item-change event', async () => {
  const el = await fixtureInMenu(html`<lr-menu-item value="rename">Rename</lr-menu-item>`);
  expect(el.getAttribute('role')).to.equal('menuitem');
  expect(el.hasAttribute('aria-checked')).to.be.false;
  expect(el.shadowRoot!.querySelector('[part="checkmark"]')).to.not.exist;

  let changeFired = false;
  let selectFired = false;
  el.addEventListener('lr-menu-item-change', () => (changeFired = true));
  el.addEventListener('lr-menu-item-select', () => (selectFired = true));
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  base.click();
  expect(changeFired).to.be.false;
  expect(selectFired).to.be.true;
  expect(el.checked).to.be.false;
});

it('is accessible with type="checkbox", both unchecked and checked', async () => {
  const wrapper = (await fixture(html`
    <div role="menu" aria-label="View">
      <lr-menu-item type="checkbox" value="wrap">Wrap text</lr-menu-item>
      <lr-menu-item type="checkbox" checked value="minimap">Minimap</lr-menu-item>
    </div>
  `)) as HTMLElement;
  await expect(wrapper).to.be.accessible();
});

it('is accessible in the default state', async () => {
  const el = await fixtureInMenu(html`<lr-menu-item value="rename">Rename</lr-menu-item>`);
  await expect(el).to.be.accessible();
});

it('is accessible with an icon, disabled and destructive states', async () => {
  const wrapper = (await fixture(html`
    <div role="menu" aria-label="Actions">
      <lr-menu-item value="rename"><span slot="icon">✏️</span>Rename</lr-menu-item>
      <lr-menu-item value="archive" disabled>Archive</lr-menu-item>
      <lr-menu-item value="delete" destructive>Delete</lr-menu-item>
    </div>
  `)) as HTMLElement;
  await expect(wrapper).to.be.accessible();
});

describe('size', () => {
  const rowHeight = (el: LyraMenuItem): number =>
    (el.shadowRoot!.querySelector('[part="base"]') as HTMLElement).getBoundingClientRect().height;

  // Every assertion below measures the RENDERED row, never the stylesheet: the ladder reaches this
  // component through custom properties declared on :host by a shared sheet, so a wrong import
  // order or a shadowed knob shows up only in the resolved box.
  it('defaults to size="m", reflected, and renders identically to that tier restated', async () => {
    const implicit = (await fixture(html`<lr-menu-item>Rename</lr-menu-item>`)) as LyraMenuItem;
    const explicit = (await fixture(html`<lr-menu-item size="m">Rename</lr-menu-item>`)) as LyraMenuItem;
    expect(implicit.size).to.equal('m');
    expect(implicit.getAttribute('size')).to.equal('m');
    expect(rowHeight(implicit)).to.equal(rowHeight(explicit));
  });

  it('grows the rendered row measurably from size="s" through "m" to "l"', async () => {
    const small = (await fixture(html`<lr-menu-item size="s">Rename</lr-menu-item>`)) as LyraMenuItem;
    const medium = (await fixture(html`<lr-menu-item size="m">Rename</lr-menu-item>`)) as LyraMenuItem;
    const large = (await fixture(html`<lr-menu-item size="l">Rename</lr-menu-item>`)) as LyraMenuItem;
    expect(rowHeight(medium)).to.be.greaterThan(rowHeight(small));
    expect(rowHeight(large)).to.be.greaterThan(rowHeight(medium));
  });

  it('accepts the small/medium/large spellings at the same heights as s/m/l', async () => {
    for (const [alias, step] of [
      ['small', 's'],
      ['medium', 'm'],
      ['large', 'l'],
    ]) {
      const aliased = (await fixture(html`<lr-menu-item size=${alias}>Rename</lr-menu-item>`)) as LyraMenuItem;
      const stepped = (await fixture(html`<lr-menu-item size=${step}>Rename</lr-menu-item>`)) as LyraMenuItem;
      expect(rowHeight(aliased), alias).to.equal(rowHeight(stepped));
    }
  });

  // WCAG 2.2 SC 2.5.8 (Target Size (Minimum)). The bottom two tiers of the shared ladder resolve
  // below 24px on their own -- a menu row is a pointer target, so it floors there instead.
  it('keeps every tier at or above the 24px pointer-target floor', async () => {
    for (const size of ['2xs', 'xs', 's', 'm', 'l', 'xl']) {
      const el = (await fixture(html`<lr-menu-item size=${size}>Rename</lr-menu-item>`)) as LyraMenuItem;
      expect(rowHeight(el), size).to.be.at.least(24);
    }
  });

  it('leaves the submenu contract untouched at a non-default tier', async () => {
    const wrapper = (await fixture(html`
      <div role="menu" aria-label="Actions">
        <lr-menu-item size="s" value="share" id="sized-share">
          Share
          <lr-menu slot="submenu">
            <lr-menu-item value="email">Email</lr-menu-item>
          </lr-menu>
        </lr-menu-item>
      </div>
    `)) as HTMLElement;
    const item = wrapper.querySelector('#sized-share') as LyraMenuItem;
    await item.updateComplete;
    expect(item.hasSubmenu).to.be.true;
    expect(item.getAttribute('aria-haspopup')).to.equal('menu');
    expect(item.getAttribute('aria-expanded')).to.equal('false');
    item.openSubmenu('first');
    await item.updateComplete;
    expect(item.submenuOpen).to.be.true;
    expect(item.getAttribute('aria-expanded')).to.equal('true');
  });

  it('is accessible at the smallest and largest tiers', async () => {
    const smallest = await fixtureInMenu(html`<lr-menu-item size="2xs" value="rename">Rename</lr-menu-item>`);
    await expect(smallest).to.be.accessible();
    const largest = await fixtureInMenu(html`<lr-menu-item size="xl" value="rename">Rename</lr-menu-item>`);
    await expect(largest).to.be.accessible();
  });
});

describe('submenu parent', () => {
  const withSubmenu = () => html`
    <div role="menu" aria-label="Actions">
      <lr-menu-item value="share" id="share">
        Share
        <lr-menu slot="submenu" id="panel">
          <lr-menu-item value="email">Email</lr-menu-item>
        </lr-menu>
      </lr-menu-item>
    </div>
  `;

  const parentOf = async (): Promise<LyraMenuItem> => {
    const wrapper = (await fixture(withSubmenu())) as HTMLElement;
    const item = wrapper.querySelector('#share') as LyraMenuItem;
    await item.updateComplete;
    return item;
  };

  const panelOf = (item: LyraMenuItem): HTMLElement & { open: boolean } =>
    item.querySelector('#panel') as HTMLElement & { open: boolean };

  const popupOf = (item: LyraMenuItem): HTMLElement =>
    panelOf(item).shadowRoot!.querySelector('[part="popup"]') as HTMLElement;

  const settleLabel = async (item: LyraMenuItem): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await item.updateComplete;
  };

  const waitForPlacedPopup = async (popup: HTMLElement): Promise<HTMLElement> => {
    for (let frame = 0; frame < 120 && popup.style.left === ''; frame += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    expect(popup.style.left).to.not.equal('');
    return popup;
  };

  it('reports hasSubmenu and renders BOTH aria-expanded states, never omitting the attribute', async () => {
    const item = await parentOf();
    expect(item.hasSubmenu).to.equal(true);
    expect(item.getAttribute('aria-haspopup')).to.equal('menu');
    // Closed must render "false" -- a `?aria-expanded=` style omission is never
    // correct for a stateful role.
    expect(item.getAttribute('aria-expanded')).to.equal('false');

    item.openSubmenu('none');
    await item.updateComplete;
    expect(item.submenuOpen).to.equal(true);
    expect(item.getAttribute('aria-expanded')).to.equal('true');
    expect(panelOf(item).open).to.equal(true);

    item.closeSubmenu();
    await item.updateComplete;
    expect(item.submenuOpen).to.equal(false);
    expect(item.getAttribute('aria-expanded')).to.equal('false');
    expect(panelOf(item).open).to.equal(false);
  });

  it('returns promises from submenu methods and settles them after the reflected state', async () => {
    const item = await parentOf();
    const opening = item.openSubmenu('none');
    expect(opening).to.be.instanceOf(Promise);
    await opening;
    expect(item.submenuOpen).to.equal(true);
    expect(item.getAttribute('submenu-open')).to.equal('');

    const closing = item.closeSubmenu();
    expect(closing).to.be.instanceOf(Promise);
    await closing;
    expect(item.submenuOpen).to.equal(false);
    expect(item.hasAttribute('submenu-open')).to.equal(false);
  });

  it('renders the mapped --submenu-offset default and responds live to an override', async () => {
    const wrapper = (await fixture(html`
      <div
        role="menu"
        aria-label="Actions"
        style="position: fixed; inset-block-start: 8rem; inset-inline-start: 15rem; inline-size: 8rem;"
      >
        <lr-menu-item value="share" id="share">
          Share
          <lr-menu slot="submenu" id="panel">
            <lr-menu-item value="email">Email</lr-menu-item>
          </lr-menu>
        </lr-menu-item>
      </div>
    `)) as HTMLElement;
    const item = wrapper.querySelector('#share') as LyraMenuItem;
    await item.updateComplete;
    await item.openSubmenu('none');
    const popup = await waitForPlacedPopup(popupOf(item));
    const renderedOffset = (): number =>
      popup.getBoundingClientRect().left - item.getBoundingClientRect().right;

    expect(renderedOffset()).to.be.closeTo(-2, 1);

    item.style.setProperty('--submenu-offset', '12px');
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(renderedOffset()).to.be.closeTo(12, 1);
  });

  it('mirrors --submenu-offset under RTL so negative values still overlap', async () => {
    const wrapper = (await fixture(html`
      <div
        dir="rtl"
        role="menu"
        aria-label="Actions"
        style="position: fixed; inset-block-start: 8rem; inset-inline-start: 15rem; inline-size: 8rem;"
      >
        <lr-menu-item value="share" id="share">
          Share
          <lr-menu slot="submenu" id="panel">
            <lr-menu-item value="email">Email</lr-menu-item>
          </lr-menu>
        </lr-menu-item>
      </div>
    `)) as HTMLElement;
    const item = wrapper.querySelector('#share') as LyraMenuItem;
    await item.updateComplete;
    await item.openSubmenu('none');
    const popup = await waitForPlacedPopup(popupOf(item));
    const renderedOffset = (): number =>
      item.getBoundingClientRect().left - popup.getBoundingClientRect().right;

    expect(renderedOffset()).to.be.closeTo(-2, 1);

    item.style.setProperty('--submenu-offset', '12px');
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(renderedOffset()).to.be.closeTo(12, 1);
  });

  it('accepts direct dropdown items in the submenu slot as well as a nested lr-menu', async () => {
    const wrapper = (await fixture(html`
      <div role="menu" aria-label="Actions">
        <lr-menu-item id="share">
          Share
          <lr-dropdown-item slot="submenu" value="email">Email</lr-dropdown-item>
          <lr-dropdown-item slot="submenu" value="copy">Copy link</lr-dropdown-item>
        </lr-menu-item>
      </div>
    `)) as HTMLElement;
    const item = wrapper.querySelector('#share') as LyraMenuItem;
    await item.updateComplete;
    expect(item.hasSubmenu).to.equal(true);
    await item.openSubmenu('first');
    expect(item.submenuOpen).to.equal(true);
    expect((document.activeElement as HTMLElement).getAttribute('value')).to.equal('email');
    expect(item.shadowRoot!.querySelector('[part~="submenu"]')?.localName).to.equal('lr-menu');
  });

  it('applies --submenu-offset to the generated direct-item submenu too', async () => {
    const wrapper = (await fixture(html`
      <div
        role="menu"
        aria-label="Actions"
        style="position: fixed; inset-block-start: 8rem; inset-inline-start: 15rem; inline-size: 8rem;"
      >
        <lr-menu-item id="share">
          Share
          <lr-dropdown-item slot="submenu" value="email">Email</lr-dropdown-item>
        </lr-menu-item>
      </div>
    `)) as HTMLElement;
    const item = wrapper.querySelector('#share') as LyraMenuItem;
    await item.updateComplete;
    await item.openSubmenu('none');
    const panel = item.shadowRoot!.querySelector('[data-generated-submenu]') as HTMLElement;
    const popup = await waitForPlacedPopup(
      panel.shadowRoot!.querySelector('[part="popup"]') as HTMLElement,
    );

    expect(
      popup.getBoundingClientRect().left - item.getBoundingClientRect().right,
    ).to.be.closeTo(-2, 1);
  });

  it('leaves a plain item with no submenu ARIA at all', async () => {
    const el = (await fixture(html`<lr-menu-item value="rename">Rename</lr-menu-item>`)) as LyraMenuItem;
    expect(el.hasSubmenu).to.equal(false);
    expect(el.hasAttribute('aria-haspopup')).to.equal(false);
    expect(el.hasAttribute('aria-expanded')).to.equal(false);
    expect(el.shadowRoot!.querySelector('[part="submenu-icon"]')).to.equal(null);
  });

  it('renders the submenu chevron part only for a submenu parent', async () => {
    const item = await parentOf();
    expect(item.shadowRoot!.querySelector('[part="submenu-icon"]') === null).to.equal(false);
  });

  it('opens the submenu on activation instead of firing lr-menu-item-select', async () => {
    const item = await parentOf();
    let selects = 0;
    item.addEventListener('lr-menu-item-select', () => {
      selects += 1;
    });
    const base = item.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.click();
    await item.updateComplete;
    expect(selects).to.equal(0);
    expect(panelOf(item).open).to.equal(true);
  });

  it('names itself and its panel from its own label text, so an open submenu never leaks into the name', async () => {
    const item = await parentOf();
    // Without this, name-from-content walks into the (now visible) submenu and
    // the item announces "Share Email".
    expect(item.getAttribute('aria-label')).to.equal('Share');
    expect(panelOf(item).getAttribute('aria-label')).to.equal('Share');
  });

  it('keeps its typeahead, host name, and submenu name synchronized with an in-place label edit', async () => {
    const wrapper = (await fixture(html`
      <div role="menu" aria-label="Actions">
        <lr-menu-item value="share" id="share">
          <span id="label">Share</span>
          <lr-menu slot="submenu" id="panel">
            <lr-menu-item value="email">Email</lr-menu-item>
          </lr-menu>
        </lr-menu-item>
      </div>
    `)) as HTMLElement;
    const item = wrapper.querySelector('#share') as LyraMenuItem;
    const panel = wrapper.querySelector('#panel') as HTMLElement;
    await item.updateComplete;

    wrapper.querySelector('#label')!.textContent = 'Distribute';
    await Promise.resolve();
    await item.updateComplete;

    expect(item.getTextLabel()).to.equal('Distribute');
    expect(item.getAttribute('aria-label')).to.equal('Distribute');
    expect(panel.getAttribute('aria-label')).to.equal('Distribute');
  });

  it('keeps a consumer name on a plain item while its visual label stays live', async () => {
    const item = (await fixture(html`
      <lr-menu-item value="rename" aria-label="Rename document">
        <span id="label">Rename</span>
      </lr-menu-item>
    `)) as LyraMenuItem;
    const label = item.querySelector<HTMLElement>('#label')!;
    await item.updateComplete;

    expect(item.getAttribute('aria-label')).to.equal('Rename document');
    label.textContent = 'Rename copy';
    await settleLabel(item);

    expect(item.getTextLabel()).to.equal('Rename copy');
    expect(item.getAttribute('aria-label')).to.equal('Rename document');
  });

  it('keeps an authored aria-labelledby authoritative on a plain item', async () => {
    const wrapper = (await fixture(html`
      <div role="menu" aria-label="Actions">
        <span id="rename-document-name">Rename document</span>
        <lr-menu-item id="rename" value="rename"><span id="label">Rename</span></lr-menu-item>
      </div>
    `)) as HTMLElement;
    const item = wrapper.querySelector<LyraMenuItem>('#rename')!;
    const label = wrapper.querySelector<HTMLElement>('#label')!;
    await item.updateComplete;
    expect(item.getAttribute('aria-label')).to.equal('Rename');

    item.setAttribute('aria-labelledby', 'rename-document-name');
    await settleLabel(item);
    expect(item.hasAttribute('aria-label')).to.equal(false);
    expect(item.getTextLabel()).to.equal('Rename');

    label.textContent = 'Rename copy';
    await settleLabel(item);
    expect(item.getTextLabel()).to.equal('Rename copy');
    expect(item.hasAttribute('aria-label')).to.equal(false);

    item.removeAttribute('aria-labelledby');
    await settleLabel(item);
    expect(item.getAttribute('aria-label')).to.equal('Rename copy');
  });

  it('excludes accessibility-hidden label branches while retaining restored-visibility descendants', async () => {
    const wrapper = (await fixture(html`
      <div role="menu" aria-label="Actions" id="wrapper">
        <lr-menu-item value="share" id="share">
          <span id="decorative" aria-hidden=" TRUE ">Decorative</span>
          <span id="hidden" hidden>Hidden</span>
          <span id="css-hidden" style="display: none">CSS hidden</span>
          <span style="visibility: hidden">Invisible <span style="visibility: visible">Exposed</span></span>
          <span id="label">Share</span>
          <lr-menu slot="submenu" id="panel">
            <lr-menu-item value="email">Email</lr-menu-item>
          </lr-menu>
        </lr-menu-item>
      </div>
    `)) as HTMLElement;
    const item = wrapper.querySelector('#share') as LyraMenuItem;
    const panel = wrapper.querySelector('#panel') as HTMLElement;
    await item.updateComplete;

    expect(item.getTextLabel()).to.equal('Exposed Share');
    expect(item.getAttribute('aria-label')).to.equal('Exposed Share');
    expect(panel.getAttribute('aria-label')).to.equal('Exposed Share');

    wrapper.querySelector('#label')!.setAttribute('aria-hidden', 'true');
    await settleLabel(item);
    expect(item.getTextLabel()).to.equal('Exposed');
    expect(item.getAttribute('aria-label')).to.equal('Exposed');
    expect(panel.getAttribute('aria-label')).to.equal('Exposed');

    wrapper.querySelector('#hidden')!.removeAttribute('hidden');
    wrapper.querySelector<HTMLElement>('#css-hidden')!.style.removeProperty('display');
    await settleLabel(item);
    expect(item.getTextLabel()).to.equal('Hidden CSS hidden Exposed');
    expect(item.getAttribute('aria-label')).to.equal('Hidden CSS hidden Exposed');
    expect(panel.getAttribute('aria-label')).to.equal('Hidden CSS hidden Exposed');

    wrapper.style.display = 'none';
    await settleLabel(item);
    expect(item.getTextLabel()).to.equal('');
    expect(item.getAttribute('aria-label')).to.equal('');
    expect(panel.getAttribute('aria-label')).to.equal('');

    wrapper.style.removeProperty('display');
    await settleLabel(item);
    expect(item.getTextLabel()).to.equal('Hidden CSS hidden Exposed');
    expect(item.getAttribute('aria-label')).to.equal('Hidden CSS hidden Exposed');
    expect(panel.getAttribute('aria-label')).to.equal('Hidden CSS hidden Exposed');
  });

  it('observes flattened label text projected through a forwarding slot', async () => {
    const wrapper = (await fixture(html`
      <menu-item-label-forward-wrapper>
        <span id="label">Share</span>
      </menu-item-label-forward-wrapper>
    `)) as MenuItemLabelForwardWrapper;
    const item = wrapper.shadowRoot!.querySelector('#item') as LyraMenuItem;
    const panel = wrapper.shadowRoot!.querySelector('#panel') as HTMLElement;
    await item.updateComplete;
    await Promise.resolve();

    expect(item.getTextLabel()).to.equal('Share');
    expect(item.getAttribute('aria-label')).to.equal('Share');
    expect(panel.getAttribute('aria-label')).to.equal('Share');

    wrapper.querySelector('#label')!.textContent = 'Send';
    await Promise.resolve();
    await item.updateComplete;

    expect(item.getTextLabel()).to.equal('Send');
    expect(item.getAttribute('aria-label')).to.equal('Send');
    expect(panel.getAttribute('aria-label')).to.equal('Send');

    const replacement = document.createElement('span');
    replacement.textContent = 'Distribute';
    wrapper.querySelector('#label')!.replaceWith(replacement);
    await Promise.resolve();
    await item.updateComplete;

    expect(item.getTextLabel()).to.equal('Distribute');
    expect(item.getAttribute('aria-label')).to.equal('Distribute');
    expect(panel.getAttribute('aria-label')).to.equal('Distribute');

    replacement.setAttribute('aria-hidden', ' TRUE ');
    await settleLabel(item);
    expect(item.getTextLabel(), 'a hidden assignment does not expose the forwarding fallback').to.equal('');
    expect(item.getAttribute('aria-label')).to.equal('');
    expect(panel.getAttribute('aria-label')).to.equal('');

    replacement.removeAttribute('aria-hidden');
    await settleLabel(item);
    expect(item.getTextLabel()).to.equal('Distribute');

    const forwardingSlot = item.querySelector('slot')!;
    forwardingSlot.setAttribute('aria-hidden', 'true');
    await settleLabel(item);
    expect(item.getTextLabel()).to.equal('');
    expect(item.getAttribute('aria-label')).to.equal('');
    expect(panel.getAttribute('aria-label')).to.equal('');

    forwardingSlot.removeAttribute('aria-hidden');
    await settleLabel(item);
    expect(item.getTextLabel()).to.equal('Distribute');

    wrapper.style.display = 'none';
    await settleLabel(item);
    expect(item.getTextLabel()).to.equal('');
    wrapper.style.removeProperty('display');
    await settleLabel(item);
    expect(item.getTextLabel()).to.equal('Distribute');

    wrapper.replaceChildren();
    await settleLabel(item);
    expect(item.getTextLabel()).to.equal('Forwarded fallback');
    expect(item.getAttribute('aria-label')).to.equal('Forwarded fallback');
    expect(panel.getAttribute('aria-label')).to.equal('Forwarded fallback');
  });

  it('lets a consumer-supplied aria-label win over the computed one', async () => {
    const wrapper = (await fixture(html`
      <div role="menu" aria-label="Actions">
        <lr-menu-item value="share" id="share" aria-label="Share with someone">
          Share
          <lr-menu slot="submenu" id="panel"><lr-menu-item value="email">Email</lr-menu-item></lr-menu>
        </lr-menu-item>
      </div>
    `)) as HTMLElement;
    const item = wrapper.querySelector('#share') as LyraMenuItem;
    await item.updateComplete;
    expect(item.getAttribute('aria-label')).to.equal('Share with someone');
  });

  it('hands live computed-name ownership to later consumer item and panel labels', async () => {
    const wrapper = (await fixture(html`
      <div role="menu" aria-label="Actions">
        <lr-menu-item value="share" id="share">
          <span id="label">Share</span>
          <lr-menu slot="submenu" id="panel"><lr-menu-item value="email">Email</lr-menu-item></lr-menu>
        </lr-menu-item>
      </div>
    `)) as HTMLElement;
    const item = wrapper.querySelector('#share') as LyraMenuItem;
    const panel = wrapper.querySelector('#panel') as HTMLElement;
    await item.updateComplete;

    item.setAttribute('aria-label', 'Share with someone');
    panel.setAttribute('aria-label', 'Sharing actions');
    await settleLabel(item);
    wrapper.querySelector('#label')!.textContent = 'Send';
    await settleLabel(item);

    expect(item.getTextLabel()).to.equal('Send');
    expect(item.getAttribute('aria-label')).to.equal('Share with someone');
    expect(panel.getAttribute('aria-label')).to.equal('Sharing actions');

    item.removeAttribute('aria-label');
    panel.removeAttribute('aria-label');
    await settleLabel(item);
    expect(item.getAttribute('aria-label')).to.equal('Send');
    expect(panel.getAttribute('aria-label')).to.equal('Send');

    panel.setAttribute('label', 'Nested sharing actions');
    await settleLabel(item);
    expect(panel.hasAttribute('aria-label')).to.equal(false);
    wrapper.querySelector('#label')!.textContent = 'Distribute';
    await settleLabel(item);
    expect(panel.hasAttribute('aria-label')).to.equal(false);

    panel.removeAttribute('label');
    await settleLabel(item);
    expect(panel.getAttribute('aria-label')).to.equal('Distribute');
  });

  it('preserves an explicitly empty consumer aria-label while the visible label changes', async () => {
    const wrapper = (await fixture(html`
      <div role="menu" aria-label="Actions">
        <lr-menu-item value="share" id="share" aria-label="">
          <span id="label">Share</span>
          <lr-menu slot="submenu" id="panel"><lr-menu-item value="email">Email</lr-menu-item></lr-menu>
        </lr-menu-item>
      </div>
    `)) as HTMLElement;
    const item = wrapper.querySelector('#share') as LyraMenuItem;
    const panel = wrapper.querySelector('#panel') as HTMLElement;
    await item.updateComplete;
    expect(item.getAttribute('aria-label')).to.equal('');

    wrapper.querySelector('#label')!.textContent = 'Send';
    await Promise.resolve();
    await item.updateComplete;

    expect(item.getAttribute('aria-label')).to.equal('');
    expect(item.getTextLabel()).to.equal('Send');
    expect(panel.getAttribute('aria-label')).to.equal('Send');
  });

  it('preserves an explicitly empty consumer submenu aria-label while the visible label changes', async () => {
    const wrapper = (await fixture(html`
      <div role="menu" aria-label="Actions">
        <lr-menu-item value="share" id="share">
          <span id="label">Share</span>
          <lr-menu slot="submenu" id="panel" aria-label="">
            <lr-menu-item value="email">Email</lr-menu-item>
          </lr-menu>
        </lr-menu-item>
      </div>
    `)) as HTMLElement;
    const item = wrapper.querySelector('#share') as LyraMenuItem;
    const panel = wrapper.querySelector('#panel') as HTMLElement;
    await item.updateComplete;

    wrapper.querySelector('#label')!.textContent = 'Send';
    await Promise.resolve();
    await item.updateComplete;

    expect(item.getTextLabel()).to.equal('Send');
    expect(item.getAttribute('aria-label')).to.equal('Send');
    expect(panel.getAttribute('aria-label')).to.equal('');
  });

  it("honours the menu's own focus vocabulary: 'none' opens without taking focus, 'first' takes it", async () => {
    const item = await parentOf();
    const targets: MenuFocusTarget[] = ['none', 'first'];
    const outside = document.createElement('button');
    outside.id = 'outside';
    document.body.append(outside);
    outside.focus();

    item.openSubmenu(targets[0]);
    await item.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect((document.activeElement as HTMLElement).id).to.equal('outside');

    item.openSubmenu(targets[1]);
    await item.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect((document.activeElement as HTMLElement).tagName).to.equal('LR-MENU-ITEM');
    outside.remove();
  });

  it('resets the transient submenu-open state on disconnect', async () => {
    const item = await parentOf();
    item.openSubmenu('none');
    await item.updateComplete;
    expect(item.submenuOpen).to.equal(true);
    item.remove();
    await item.updateComplete;
    expect(item.submenuOpen).to.equal(false);
  });
});
