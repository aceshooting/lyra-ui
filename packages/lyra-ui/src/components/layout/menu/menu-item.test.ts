import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './menu-item.js';
import type { LyraMenuItem } from './menu-item.js';
import './menu.js';
import type { MenuFocusTarget } from './menu.js';

// role="menuitem" requires a role="menu"/"menubar"/"group" ancestor to
// satisfy axe's aria-required-parent rule -- <lr-menu> normally supplies
// that; a plain wrapper stands in for it here since this file tests
// <lr-menu-item> in isolation, mirroring lr-conversation-item's
// identical fixtureInListbox helper for its own role="option".
async function fixtureInMenu(item: import('lit').TemplateResult): Promise<LyraMenuItem> {
  const wrapper = (await fixture(html`<div role="menu" aria-label="Actions">${item}</div>`)) as HTMLElement;
  return wrapper.querySelector('lr-menu-item') as LyraMenuItem;
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
  expect(document.activeElement).to.equal(el);

  el.disabled = true;
  await el.updateComplete;
  expect(el.tabIndex).to.equal(-1);
  expect(document.activeElement).to.not.equal(el);
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
