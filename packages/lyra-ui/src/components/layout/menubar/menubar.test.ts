import { expect, fixture, html, waitUntil, aTimeout } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { setReducedMotion, setForcedColors } from '../../../../test/wtr-media.js';
import { activateNonmodalOverlay, deepActiveElement } from '../../../internal/nonmodal-overlay-manager.js';
import type { LyraMenubar } from './menubar.class.js';
import type { LyraMenubarItem } from './menubar-item.class.js';
import type { LyraMenuItem } from '../menu/menu-item.class.js';
import './menubar.js';
import '../menu/menu-label.js';
import '../../overlays/kbd/kbd.js';

function item(bar: Element, id: string): LyraMenubarItem {
  return bar.querySelector<LyraMenubarItem>(`#${id}`)!;
}
function key(target: HTMLElement, value: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: value, bubbles: true, composed: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}
function active(): string { return deepActiveElement(document)?.id ?? ''; }
function surface(target: LyraMenubarItem): HTMLElement {
  return target.querySelector('lr-menu')!.shadowRoot!.querySelector<HTMLElement>('.submenu-surface')!;
}
async function opened(target: LyraMenubarItem): Promise<void> {
  await waitUntil(() => target.getAttribute('aria-expanded') === 'true' && getComputedStyle(surface(target)).visibility === 'visible');
}
async function sample(direction = 'ltr'): Promise<LyraMenubar> {
  const bar = await fixture<LyraMenubar>(html`
    <lr-menubar label="Application" dir=${direction} style="--lr-transition-fast:0ms">
      <lr-menubar-item id="file">File<lr-menu slot="menu"><input id="filter" slot="header" aria-label="Filter" /><lr-menu-item id="new" value="new" aria-keyshortcuts="Control+T Meta+T">New tab<lr-kbd slot="details" keys="mod+t"></lr-kbd></lr-menu-item><lr-menu-item id="share">Share<lr-menu slot="submenu"><lr-menu-item id="email">Email</lr-menu-item></lr-menu></lr-menu-item><lr-menu-label>Options</lr-menu-label><hr /><lr-menu-item id="check" type="checkbox">Show toolbar</lr-menu-item><lr-menu-item type="radio" group="profile" checked>Personal</lr-menu-item><lr-menu-item id="last" type="radio" group="profile">Work</lr-menu-item></lr-menu></lr-menubar-item>
      <lr-menubar-item id="edit">Edit<lr-menu slot="menu"><lr-menu-item id="undo">Undo</lr-menu-item></lr-menu></lr-menubar-item>
      <lr-menubar-item id="view">View<lr-menu slot="menu"><lr-menu-item>Zoom</lr-menu-item></lr-menu></lr-menubar-item>
      <lr-menubar-item id="disabled" disabled>Disabled</lr-menubar-item>
      <lr-menubar-item id="help">Help</lr-menubar-item>
    </lr-menubar>`);
  await waitUntil(() => item(bar, 'file').hasMenu && item(bar, 'file').tabIndex === 0);
  return bar;
}
async function click(target: HTMLElement): Promise<void> {
  const rect = target.getBoundingClientRect();
  await sendMouse({ type: 'click', position: [Math.round(rect.x + rect.width / 2), Math.round(rect.y + rect.height / 2)] });
}

describe('lr-menubar', () => {
  afterEach(async () => { await resetMouse(); });

  it('renders the menubar role, literal disclosure states and one roving stop', async () => {
    const bar = await sample();
    expect(bar.shadowRoot!.querySelector('[part="base"]')!.getAttribute('role')).to.equal('menubar');
    expect(item(bar, 'file').getAttribute('role')).to.equal('menuitem');
    expect(item(bar, 'file').getAttribute('aria-haspopup')).to.equal('menu');
    expect(item(bar, 'file').getAttribute('aria-expanded')).to.equal('false');
    expect(item(bar, 'file').getAttribute('aria-disabled')).to.equal('false');
    expect(Array.from(bar.children).filter(node => (node as HTMLElement).tabIndex === 0).length).to.equal(1);
  });

  it('preserves absent and explicitly empty accessible names with host precedence', async () => {
    const bar = await fixture<LyraMenubar>(html`<lr-menubar><lr-menubar-item>Help</lr-menubar-item></lr-menubar>`);
    const base = bar.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.hasAttribute('aria-label')).to.equal(false);
    bar.label = 'App'; await bar.updateComplete;
    expect(base.getAttribute('aria-label')).to.equal('App');
    bar.label = ''; await bar.updateComplete;
    expect(base.getAttribute('aria-label')).to.equal('');
    bar.label = 'App'; bar.setAttribute('aria-label', 'Host'); await bar.updateComplete;
    expect(base.getAttribute('aria-label')).to.equal('Host');
    bar.setAttribute('aria-label', ''); await bar.updateComplete;
    expect(base.getAttribute('aria-label')).to.equal('');
  });

  it('names items and menus without leaking menu content, and tracks label edits', async () => {
    const bar = await sample(); const file = item(bar, 'file');
    file.click(); await opened(file);
    const menu = file.querySelector('lr-menu')!;
    expect(file.getAttribute('aria-label')).to.equal('File');
    expect(menu.shadowRoot!.querySelector('[role="menu"]')!.getAttribute('aria-label')).to.equal('File');
    file.firstChild!.textContent = 'Archive';
    await waitUntil(() => file.getAttribute('aria-label') === 'Archive' && menu.getAttribute('aria-label') === 'Archive');
    file.setAttribute('aria-label', 'Documents'); menu.setAttribute('label', 'Commands');
    await waitUntil(() => menu.shadowRoot!.querySelector('[role="menu"]')!.getAttribute('aria-label') === 'Commands');
    expect(file.getAttribute('aria-label')).to.equal('Documents');
    file.firstChild!.textContent = 'Ignored'; await aTimeout(0);
    expect(file.getAttribute('aria-label')).to.equal('Documents');
  });

  it('keeps the localized menu fallback for an empty item label', async () => {
    const bar = await fixture<LyraMenubar>(html`<lr-menubar label="App"><lr-menubar-item><lr-menu slot="menu" .strings=${{ menuLabel: 'Commandes' }}><lr-menu-item>New</lr-menu-item></lr-menu></lr-menubar-item></lr-menubar>`);
    const file = bar.querySelector<LyraMenubarItem>('lr-menubar-item')!;
    await waitUntil(() => file.hasMenu);
    expect(file.hasAttribute('aria-label')).to.equal(false);
    expect(file.querySelector('lr-menu')!.shadowRoot!.querySelector('[role="menu"]')!.getAttribute('aria-label')).to.equal('Commandes');
  });

  it('is accessible collapsed and populated with an open nested submenu and shortcut', async () => {
    const el = await sample();
    await expect(el).to.be.accessible();
    item(el, 'file').click(); await opened(item(el, 'file'));
    const share = el.querySelector<LyraMenuItem>('#share')!;
    await share.openSubmenu('first');
    expect(item(el, 'file').getAttribute('aria-expanded')).to.equal('true');
    expect(getComputedStyle(surface(item(el, 'file'))).visibility).to.equal('visible');
    const details = el.querySelector('#new')!.shadowRoot!.querySelector<HTMLElement>('[part="details"]')!;
    expect(details.hidden).to.equal(false); expect(details.offsetWidth).to.be.greaterThan(0);
    await expect(el).to.be.accessible();
  });

  for (const direction of ['ltr', 'rtl']) {
    it(`wraps arrow traversal and carries open menus in ${direction}`, async () => {
      const bar = await sample(direction); const file = item(bar, 'file'); file.focus();
      const next = direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
      const previous = direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
      expect(key(file, previous).defaultPrevented).to.equal(true); expect(active()).to.equal('help');
      key(item(bar, 'help'), next); expect(active()).to.equal('file');
      file.click(); await opened(file);
      key(file, next); await opened(item(bar, 'edit'));
      expect(active()).to.equal('edit'); expect(file.menuOpen).to.equal(false);
      expect(bar.querySelectorAll('[aria-expanded="true"]').length).to.equal(1);
      key(item(bar, 'edit'), 'Home'); await opened(file); expect(active()).to.equal('file');
      key(file, 'End'); expect(active()).to.equal('help');
      await waitUntil(() => !file.menuOpen);
      key(item(bar, 'help'), next); expect(active()).to.equal('file'); expect(file.menuOpen).to.equal(false);
    });
    it(`carries menu leaves but leaves header fields and nested out-keys alone in ${direction}`, async () => {
      const bar = await sample(direction); const file = item(bar, 'file');
      const next = direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
      const previous = direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
      file.click(); await opened(file);
      const filter = bar.querySelector<HTMLInputElement>('#filter')!; filter.focus();
      expect(key(filter, next).defaultPrevented).to.equal(false);
      expect(key(filter, previous).defaultPrevented).to.equal(false);
      expect(active()).to.equal('filter'); expect(file.menuOpen).to.equal(true);
      const row = bar.querySelector<LyraMenuItem>('#new')!; row.focus();
      expect(key(row, next).defaultPrevented).to.equal(true);
      await opened(item(bar, 'edit')); expect(active()).to.equal('edit');
      key(item(bar, 'edit'), 'ArrowDown'); await waitUntil(() => active() === 'undo');
      key(bar.querySelector<HTMLElement>('#undo')!, previous); await opened(file); expect(active()).to.equal('file');
      const share = bar.querySelector<LyraMenuItem>('#share')!;
      await share.openSubmenu('first');
      expect(key(bar.querySelector<HTMLElement>('#email')!, previous).defaultPrevented).to.equal(true);
      expect(file.menuOpen).to.equal(true); expect(active()).to.equal('share');
      await share.openSubmenu('first');
      key(bar.querySelector<HTMLElement>('#email')!, next); await opened(item(bar, 'edit'));
      expect(share.submenuOpen).to.equal(false); expect(active()).to.equal('edit');
    });
  }

  for (const [value, expected] of [['ArrowDown', 'new'], ['Enter', 'new'], [' ', 'new'], ['ArrowUp', 'last']]) {
    it(`${JSON.stringify(value)} opens and focuses ${expected}`, async () => {
      const bar = await sample(); const file = item(bar, 'file'); file.focus();
      expect(key(file, value!).defaultPrevented).to.equal(true);
      await waitUntil(() => active() === expected);
    });
  }

  it('activates action items exactly once and leaves unhandled keys alone', async () => {
    const bar = await sample(); const help = item(bar, 'help'); let clicks = 0;
    help.addEventListener('click', () => { clicks++; }); help.focus();
    expect(key(help, 'Enter').defaultPrevented).to.equal(true); expect(clicks).to.equal(1);
    expect(key(help, ' ').defaultPrevented).to.equal(true); expect(clicks).to.equal(2);
    expect(key(help, 'ArrowDown').defaultPrevented).to.equal(false);
    expect(key(help, 'ArrowUp').defaultPrevented).to.equal(false);
    expect(key(help, 'ArrowLeft', { ctrlKey: true }).defaultPrevented).to.equal(false);
    expect(key(help, 'ArrowLeft', { isComposing: true }).defaultPrevented).to.equal(false);
    expect(key(help, 'Escape').defaultPrevented).to.equal(false);
  });

  it('prevents handled keys from scrolling a page with room to scroll', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div style="min-height:250vh;padding-top:50vh"><div id="scroll-bar"></div></div>`);
    const bar = await sample(); wrapper.querySelector('#scroll-bar')!.append(bar);
    const before = window.scrollY;
    try {
      window.scrollTo(0, 100); await aTimeout(0);
      for (const [press, value] of [['Space', ' '], ['ArrowDown', 'ArrowDown'], ['Home', 'Home'], ['End', 'End']]) {
        const file = item(bar, 'file'); file.focus({ preventScroll: true });
        const scroll = window.scrollY; let prevented = false;
        const listener = (event: KeyboardEvent): void => { if (event.key === value) prevented = event.defaultPrevented; };
        bar.addEventListener('keydown', listener);
        await sendKeys({ press: press! }); await aTimeout(0);
        bar.removeEventListener('keydown', listener);
        expect(prevented).to.equal(true); expect(window.scrollY).to.equal(scroll);
        if (file.menuOpen) { key(file, 'Escape'); await aTimeout(0); }
      }
    } finally { window.scrollTo(0, before); }
  });

  it('matches buffered, case-insensitive typeahead and carries the menu', async () => {
    const bar = await sample(); item(bar, 'file').focus();
    expect(key(item(bar, 'file'), 'E').defaultPrevented).to.equal(true); expect(active()).to.equal('edit');
    await aTimeout(700);
    item(bar, 'edit').click(); await opened(item(bar, 'edit'));
    expect(key(item(bar, 'edit'), 'v').defaultPrevented).to.equal(true);
    expect(key(item(bar, 'view'), 'i').defaultPrevented).to.equal(true);
    await opened(item(bar, 'view')); expect(active()).to.equal('view');
    await aTimeout(700);
    expect(key(item(bar, 'view'), 'x').defaultPrevented).to.equal(false);
  });

  it('skips every non-navigable state and preserves the stop on disabled pointer presses', async () => {
    const bar = await sample(); const file = item(bar, 'file');
    item(bar, 'edit').hidden = true; item(bar, 'view').setAttribute('aria-hidden', 'true');
    const help = item(bar, 'help'); help.inert = true; await aTimeout(0); file.focus();
    key(file, 'ArrowRight'); expect(active()).to.equal('file');
    await click(item(bar, 'disabled')); expect(active()).to.equal('file'); expect(file.tabIndex).to.equal(0);
    help.inert = false; await aTimeout(0); key(file, 'ArrowRight'); expect(active()).to.equal('help');
    bar.inert = true; expect(key(help, 'ArrowLeft').defaultPrevented).to.equal(false);
  });

  it('toggles clicks, ignores menu clicks, and suppresses disabled action clicks', async () => {
    const bar = await sample(); const file = item(bar, 'file');
    await click(file); await opened(file); expect(active()).to.equal('file');
    await click(file); await waitUntil(() => !file.menuOpen);
    const disabled = item(bar, 'disabled'); let own = 0; let parent = 0;
    disabled.addEventListener('click', () => { own++; });
    bar.addEventListener('click', () => { parent++; });
    await click(disabled); disabled.click(); expect(own).to.equal(0); expect(parent).to.equal(0);
    disabled.disabled = false; await disabled.updateComplete;
    await click(disabled); disabled.click(); expect(own).to.equal(2); expect(parent).to.equal(2);
    file.click(); await opened(file);
    const row = bar.querySelector<LyraMenuItem>('#new')!;
    bar.addEventListener('lr-select', event => event.preventDefault());
    row.click(); await aTimeout(0); expect(file.menuOpen).to.equal(true);
  });

  it('switches only enabled menu titles on non-touch hover, then toggles the hovered title', async () => {
    const bar = await sample(); const file = item(bar, 'file'); const edit = item(bar, 'edit');
    await hoverUntilMatched(edit, 'Edit title should be hovered'); expect(edit.menuOpen).to.equal(false);
    file.click(); await opened(file);
    edit.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, composed: true, pointerType: 'touch' }));
    expect(file.menuOpen).to.equal(true);
    await hoverUntilMatched(item(bar, 'help'), 'Help title should be hovered'); expect(file.menuOpen).to.equal(true);
    await hoverUntilMatched(item(bar, 'disabled'), 'Disabled title should be hovered'); expect(file.menuOpen).to.equal(true);
    await hoverUntilMatched(edit, 'Edit title should be hovered'); await opened(edit); expect(file.menuOpen).to.equal(false); expect(active()).to.equal('edit');
    await click(edit); await waitUntil(() => !edit.menuOpen); expect(active()).to.equal('edit');
  });

  it('selection bubbles once, returns focus, and checkbox changes bubble', async () => {
    const bar = await sample(); const file = item(bar, 'file'); let selected = ''; let count = 0; let changes = 0;
    bar.addEventListener('lr-select', event => { selected = event.detail.item.id; count++; });
    bar.addEventListener('lr-menu-item-change', () => { changes++; });
    key(file, 'ArrowDown'); await waitUntil(() => active() === 'new');
    bar.querySelector<LyraMenuItem>('#new')!.click();
    await waitUntil(() => !file.menuOpen); expect(selected).to.equal('new'); expect(count).to.equal(1); expect(active()).to.equal('file');
    file.click(); await opened(file); bar.querySelector<LyraMenuItem>('#check')!.click();
    expect(changes).to.equal(1); expect(bar.querySelector<LyraMenuItem>('#check')!.checked).to.equal(true);
  });

  it('Escape closes from the menu or bar and preserves focus', async () => {
    const bar = await sample(); const file = item(bar, 'file');
    key(file, 'ArrowDown'); await waitUntil(() => active() === 'new');
    expect(key(bar.querySelector<HTMLElement>('#new')!, 'Escape').defaultPrevented).to.equal(true);
    await waitUntil(() => !file.menuOpen); expect(active()).to.equal('file');
    file.click(); await opened(file); expect(key(file, 'Escape').defaultPrevented).to.equal(true);
    await waitUntil(() => !file.menuOpen); expect(active()).to.equal('file');
    expect(key(file, 'Escape').defaultPrevented).to.equal(false);
  });

  it('outside pointers and focus leaving collapse without stealing focus; blur alone does not', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div><button id="outside">Outside</button></div>`);
    const bar = await sample(); const file = item(bar, 'file'); file.click(); await opened(file);
    file.blur(); await aTimeout(0); expect(file.menuOpen).to.equal(true);
    wrapper.querySelector<HTMLButtonElement>('button')!.focus(); await waitUntil(() => !file.menuOpen); expect(active()).to.equal('outside');
    file.click(); await opened(file);
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    await waitUntil(() => !file.menuOpen); expect(active()).to.equal('file');
  });

  for (const mode of ['menu-tab', 'menu-shift-tab', 'bar-tab', 'action', 'menu-escape', 'bar-escape']) {
    it(`retains native focus for ${mode} with an unrelated overlay beneath`, async () => {
      const wrapper = await fixture<HTMLDivElement>(html`<div><div id="lower"><button id="lower-btn">Lower</button></div><div id="bar-mount"></div><button id="after">After</button></div>`);
      const bar = await sample(); wrapper.querySelector('#bar-mount')!.append(bar);
      bar.style.removeProperty('--lr-transition-fast');
      bar.querySelector('#filter')!.remove();
      await aTimeout(0);
      const lower = wrapper.querySelector<HTMLElement>('#lower')!; let lowerFocus = 0;
      const handle = activateNonmodalOverlay({ host: lower, panel: () => lower, onEscape: () => {} });
      lower.addEventListener('focusin', () => { lowerFocus++; });
      try {
        const file = item(bar, 'file'); const help = item(bar, 'help');
        if (mode.startsWith('menu-')) {
          key(file, 'ArrowUp'); await waitUntil(() => active() === 'last');
        } else { file.click(); await opened(file); }
        if (mode.includes('escape')) await sendKeys({ press: 'Escape' });
        else if (mode === 'action') key(file, 'End');
        else await sendKeys({ press: mode === 'menu-shift-tab' ? 'Shift+Tab' : 'Tab' });
        await waitUntil(() => !file.menuOpen);
        const expected = mode === 'action' ? help.id : mode.includes('escape') || mode === 'menu-shift-tab' ? file.id : 'after';
        await waitUntil(() => active() === expected);
        expect(lowerFocus).to.equal(0);
      } finally { handle.deactivate({ restoreFocus: false }); }
    });
  }

  it('reconnects collapsed with the same roving stop and releases an item moved to another bar', async () => {
    const bar = await sample(); const edit = item(bar, 'edit'); edit.click(); await opened(edit);
    const parent = bar.parentElement!; bar.remove(); parent.append(bar); await aTimeout(0);
    expect(edit.menuOpen).to.equal(false); expect(edit.tabIndex).to.equal(0); expect(key(edit, 'Escape').defaultPrevented).to.equal(false);
    await waitUntil(() => surface(edit).hidden);
    const other = await fixture<LyraMenubar>(html`<lr-menubar label="Other"></lr-menubar>`);
    other.append(edit); await aTimeout(0); edit.click(); await opened(edit);
    expect(other.querySelectorAll('[aria-expanded="true"]').length).to.equal(1);
    expect(bar.querySelectorAll('[aria-expanded="true"]').length).to.equal(0);
  });

  it('preserves active identity on insertion and rehomes removed or disabled focused items', async () => {
    const bar = await sample(); const edit = item(bar, 'edit'); edit.focus();
    const first = document.createElement('lr-menubar-item'); first.textContent = 'First';
    bar.prepend(first); await aTimeout(0); expect(edit.tabIndex).to.equal(0);
    edit.remove(); await waitUntil(() => active() === 'view');
    const view = item(bar, 'view'); view.click(); await opened(view); view.disabled = true;
    await waitUntil(() => !view.menuOpen && active() === 'help');
    item(bar, 'help').remove(); await aTimeout(0); expect(first.tabIndex).to.equal(-1); expect(item(bar, 'file').tabIndex).to.equal(0);
    bar.replaceChildren(); await aTimeout(0); expect(bar.querySelectorAll('[tabindex="0"]').length).to.equal(0);
  });

  it('attaches replacement menus and becomes an action when the menu is removed', async () => {
    const bar = await sample(); const file = item(bar, 'file'); file.click(); await opened(file);
    const menu = file.querySelector('lr-menu')!; menu.remove();
    await waitUntil(() => !file.hasMenu);
    expect(file.hasAttribute('aria-haspopup')).to.equal(false); expect(file.hasAttribute('aria-expanded')).to.equal(false);
    file.append(menu); await waitUntil(() => file.hasMenu); file.click(); await opened(file);
  });

  for (const direction of ['ltr', 'rtl']) it(`places below and aligns to inline-start in ${direction}`, async () => {
    const bar = await sample(direction); const file = item(bar, 'file'); file.click(); await opened(file);
    await waitUntil(() => surface(file).getBoundingClientRect().top >= file.getBoundingClientRect().bottom - 1);
    const anchor = file.getBoundingClientRect(); const popup = surface(file).getBoundingClientRect();
    expect(Math.abs(direction === 'rtl' ? popup.right - anchor.right : popup.left - anchor.left)).to.be.lessThan(1.1);
  });

  it('uses the subtle border token and preserves geometry with a plain frame', async () => {
    const bar = await sample(); const base = bar.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    bar.style.setProperty('--lr-color-border-subtle', 'rgb(12, 34, 56)');
    expect(getComputedStyle(base).borderTopColor).to.equal('rgb(12, 34, 56)');
    const height = base.offsetHeight; bar.frame = 'plain'; await bar.updateComplete;
    expect(getComputedStyle(base).backgroundColor).to.equal('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(base).borderTopColor).to.equal('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(base).boxShadow).to.equal('none'); expect(base.offsetHeight).to.equal(height);
  });

  it('tracks size ladder height, font and padding with a 24px target floor', async () => {
    const bar = await sample(); const file = item(bar, 'file'); const fonts: string[] = []; const paddings: string[] = [];
    for (const size of ['xs', 's', 'm', 'l'] as const) {
      bar.size = size; await bar.updateComplete;
      const base = bar.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
      const row = file.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
      const probe = document.createElement('div');
      probe.style.cssText = 'height:var(--lr-form-control-height);padding-block:var(--lr-form-control-padding-block);border:var(--lr-border-width-thin) solid;box-sizing:content-box;font-size:var(--lr-form-control-font-size);padding-inline:var(--lr-form-control-padding-inline)';
      bar.shadowRoot!.append(probe); const resolved = getComputedStyle(probe); const computed = getComputedStyle(row);
      const expected = Math.max(parseFloat(resolved.height), 24) +
        2 * parseFloat(resolved.paddingTop) + 2 * parseFloat(resolved.borderTopWidth);
      expect(Math.abs(base.getBoundingClientRect().height - expected)).to.be.lessThan(0.6);
      expect(computed.fontSize).to.equal(resolved.fontSize); expect(computed.paddingInlineStart).to.equal(resolved.paddingInlineStart);
      expect(file.getBoundingClientRect().height).to.be.at.least(24); expect(file.getBoundingClientRect().width).to.be.at.least(24);
      fonts.push(computed.fontSize); paddings.push(computed.paddingInlineStart); probe.remove();
    }
    expect(fonts[1]).not.to.equal(fonts[3]); expect(paddings[1]).not.to.equal(paddings[3]);
  });

  it('wraps within a 320px allocation and ellipsizes long labels without losing names', async () => {
    const label = 'A very long application command with a complete accessible name';
    const wrapper = await fixture<HTMLDivElement>(html`<div style="width:320px"><lr-menubar label="App"><lr-menubar-item>File</lr-menubar-item><lr-menubar-item>Edit</lr-menubar-item><lr-menubar-item>View</lr-menubar-item><lr-menubar-item>Profiles</lr-menubar-item><lr-menubar-item>Help</lr-menubar-item><lr-menubar-item>${label}</lr-menubar-item></lr-menubar></div>`);
    const bar = wrapper.querySelector<LyraMenubar>('lr-menubar')!;
    await aTimeout(0); expect(wrapper.scrollWidth).to.be.at.most(wrapper.clientWidth);
    const bounds = bar.getBoundingClientRect();
    for (const child of Array.from(bar.children)) {
      const rect = child.getBoundingClientRect(); expect(rect.left).to.be.at.least(bounds.left); expect(rect.right).to.be.at.most(bounds.right);
    }
    const last = bar.lastElementChild!; expect(last.getAttribute('aria-label')).to.equal(label);
    expect(getComputedStyle(last.shadowRoot!.querySelector('[part="label"]')!).textOverflow).to.equal('ellipsis');
  });

  it('keeps intrinsic width in a centered grid', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div style="display:grid;place-items:center"><lr-menubar label="App"><lr-menubar-item>File</lr-menubar-item><lr-menubar-item>Edit</lr-menubar-item></lr-menubar></div>`);
    const bar = wrapper.querySelector('lr-menubar')!; expect(bar.getBoundingClientRect().width).to.be.greaterThan(0);
    expect(bar.firstElementChild!.getBoundingClientRect().top).to.equal(bar.lastElementChild!.getBoundingClientRect().top);
  });

  it('paints hover, open and pressed states through inherited hooks', async () => {
    const bar = await sample(); const file = item(bar, 'file');
    bar.style.setProperty('--lr-menubar-item-hover-bg', 'rgb(12, 34, 56)');
    bar.style.setProperty('--lr-menubar-item-active-bg', 'rgb(65, 43, 21)');
    const base = file.shadowRoot!.querySelector('[part="base"]')!;
    await hoverUntilMatched(file, 'File title should be hovered'); await waitUntil(() => getComputedStyle(base).backgroundColor === 'rgb(12, 34, 56)');
    file.click(); await opened(file); await resetMouse(); expect(getComputedStyle(base).backgroundColor).to.equal('rgb(12, 34, 56)');
    await hoverUntilMatched(file, 'File title should be hovered');
    try {
      await sendMouse({ type: 'down' });
      await waitUntil(() => getComputedStyle(base).backgroundColor === 'rgb(65, 43, 21)');
    } finally { await sendMouse({ type: 'up' }); }
  });

  it('paints keyboard focus through the hover hook and derives an unconfigured pressed step', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div><button id="before">Before</button><div id="focus-bar"></div></div>`);
    const bar = await sample(); wrapper.querySelector('#focus-bar')!.append(bar);
    const file = item(bar, 'file'); const base = file.shadowRoot!.querySelector('[part="base"]')!;
    bar.style.setProperty('--lr-menubar-item-hover-bg', 'rgb(70, 100, 140)');
    wrapper.querySelector<HTMLButtonElement>('button')!.focus(); await sendKeys({ press: 'Tab' });
    expect(active()).to.equal('file'); expect(file.matches(':focus-visible')).to.equal(true);
    await waitUntil(() => getComputedStyle(base).backgroundColor === 'rgb(70, 100, 140)', 'keyboard focus paint did not settle');
    expect(getComputedStyle(base).backgroundColor).to.equal('rgb(70, 100, 140)');
    await hoverUntilMatched(file, 'File title should be hovered');
    const hover = getComputedStyle(base).backgroundColor;
    try {
      await sendMouse({ type: 'down' });
      await waitUntil(() => getComputedStyle(base).backgroundColor !== hover);
    } finally { await sendMouse({ type: 'up' }); }
  });

  it('reduces item and popup motion under the real preference', async () => {
    await setReducedMotion('no-preference');
    try {
      const bar = await sample(); bar.style.removeProperty('--lr-transition-fast');
      const file = item(bar, 'file'); const base = file.shadowRoot!.querySelector('[part="base"]')!;
      expect(getComputedStyle(base).transitionDuration.split(',').some(value => parseFloat(value) > 0)).to.equal(true);
      await setReducedMotion('reduce'); expect(matchMedia('(prefers-reduced-motion: reduce)').matches).to.equal(true);
      expect(getComputedStyle(base).transitionDuration.split(',').every(value => parseFloat(value) <= 0.00001)).to.equal(true);
      file.click(); await opened(file); expect(getComputedStyle(surface(file)).transitionDuration).to.equal('0s');
    } finally { await setReducedMotion('no-preference'); }
  });

  it('outlines an open item in forced colors', async function () {
    try {
      await setForcedColors('active'); if (!matchMedia('(forced-colors: active)').matches) this.skip();
      const bar = await sample(); const file = item(bar, 'file'); file.click(); await opened(file);
      const base = file.shadowRoot!.querySelector('[part="base"]')!;
      expect(getComputedStyle(base).outlineStyle).to.equal('solid'); expect(parseFloat(getComputedStyle(base).outlineWidth)).to.be.greaterThan(0);
      expect(getComputedStyle(item(bar, 'edit').shadowRoot!.querySelector('[part="base"]')!).outlineStyle).to.equal('none');
    } finally { await setForcedColors('none'); }
  });

  it('makes a closing menu inert immediately outside it, defers inside it, and clears on reopening', async () => {
    const bar = await sample(); const file = item(bar, 'file');
    const wrapper = file.shadowRoot!.querySelector<HTMLElement>('.menu')!;
    expect(wrapper.inert).to.equal(true);
    file.click(); await opened(file); expect(wrapper.inert).to.equal(false);
    key(file, 'Escape'); expect(wrapper.inert).to.equal(true);
    key(file, 'ArrowDown'); await waitUntil(() => active() === 'new'); expect(wrapper.inert).to.equal(false);
    key(bar.querySelector<HTMLElement>('#new')!, 'Tab'); expect(wrapper.inert).to.equal(false);
    file.focus(); await waitUntil(() => wrapper.inert);
  });
});
