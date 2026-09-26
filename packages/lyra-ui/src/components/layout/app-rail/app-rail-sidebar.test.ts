import { expect, fixture, html, waitUntil, aTimeout } from '@open-wc/testing';
import { setForcedColors } from '../../../../test/wtr-media.js';
import { deepActiveElement } from '../../../internal/overlay-manager.js';
import type { LyraAppRail } from './app-rail.class.js';
import type { LyraAppRailItem } from './app-rail-item.class.js';
import type { LyraCommandPalette } from '../command-palette/command-palette.class.js';
import type { LyraPage } from '../page/page.class.js';
import { detectPlatform } from '../../../internal/platform.js';
import './app-rail.js';
import './app-rail-item.js';
import '../app-rail-group/app-rail-group.js';
import '../page/page.js';
import '../command-palette/command-palette.js';
import '../../forms/icon-button/icon-button.js';
import '../../forms/input/input.js';
import '../../utility/divider/divider.js';

function press(key = 'b', init: KeyboardEventInit = {}, target: EventTarget = window): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true, composed: true, cancelable: true, ...init });
  target.dispatchEvent(event); return event;
}
function mobile(rail: LyraAppRail): void {
  (rail as unknown as { onMobileChange(event: { matches: boolean }): void }).onMobileChange({ matches: true });
}
function base(rail: LyraAppRail): HTMLElement { return rail.shadowRoot!.querySelector<HTMLElement>('[part="base"], [part="panel"]')!; }
let originalMatchMedia: typeof window.matchMedia;

beforeEach(() => {
  originalMatchMedia = window.matchMedia;
  window.matchMedia = query => query.includes('max-width')
    ? { matches: false, media: query, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList
    : originalMatchMedia.call(window, query);
});
afterEach(() => { window.matchMedia = originalMatchMedia; });

describe('app rail sidebar frame', () => {
  it('preserves the unset flush rail and validates the opt-in frame', async () => {
    const el = await fixture<LyraAppRail>(html`<lr-app-rail></lr-app-rail>`);
    const style = getComputedStyle(base(el));
    expect(style.marginTop).to.equal('0px'); expect(style.boxShadow).to.equal('none');
    expect(parseFloat(style.borderInlineEndWidth)).to.be.greaterThan(0); expect(getComputedStyle(el).display).to.equal('block');
    el.setAttribute('frame', 'floating'); await el.updateComplete;
    expect(el.frame).to.equal(undefined); expect(el.hasAttribute('frame')).to.equal(false);
    (el as unknown as { frame: string }).frame = 'bogus'; await el.updateComplete; expect(el.hasAttribute('frame')).to.equal(false);
  });

  it('contains card margins and accepts gap, radius and shadow overrides', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div style="block-size:300px"><lr-app-rail frame="card" style="block-size:100%;--lr-app-rail-frame-gap:12px;--lr-app-rail-frame-radius:15px;--lr-app-rail-frame-shadow:0 0 0 3px rgb(10, 20, 30)"></lr-app-rail></div>`);
    const el = wrapper.querySelector<LyraAppRail>('lr-app-rail')!; const rect = el.getBoundingClientRect(); const inner = base(el).getBoundingClientRect();
    expect(getComputedStyle(el).display).to.equal('flow-root'); expect(getComputedStyle(base(el)).marginTop).to.equal('12px');
    expect(getComputedStyle(base(el)).borderRadius).to.equal('15px'); expect(getComputedStyle(base(el)).boxShadow).to.contain('rgb(10, 20, 30)');
    expect(Math.abs(rect.top - wrapper.getBoundingClientRect().top)).to.be.lessThan(0.6);
    expect(Math.abs(inner.top - rect.top - 12)).to.be.lessThan(0.6); expect(Math.abs(rect.bottom - inner.bottom - 12)).to.be.lessThan(0.6);
    expect(rect.bottom).to.be.at.most(wrapper.getBoundingClientRect().bottom + 0.5);
    el.style.setProperty('--lr-color-border-subtle', 'rgb(20, 40, 60)'); expect(getComputedStyle(base(el)).borderTopColor).to.equal('rgb(20, 40, 60)');
  });

  it('makes plain frames transparent with an explicit background override', async () => {
    const el = await fixture<LyraAppRail>(html`<lr-app-rail frame="plain"></lr-app-rail>`);
    expect(getComputedStyle(base(el)).backgroundColor).to.equal('rgba(0, 0, 0, 0)'); expect(getComputedStyle(base(el)).borderInlineEndWidth).to.equal('0px');
    el.style.setProperty('--lr-app-rail-background', 'rgb(12, 34, 56)'); expect(getComputedStyle(base(el)).backgroundColor).to.equal('rgb(12, 34, 56)');
  });

  for (const direction of ['ltr', 'rtl']) it(`aligns the resizer with the card edge in ${direction}`, async () => {
    const el = await fixture<LyraAppRail>(html`<lr-app-rail frame="card" resizable dir=${direction} style="block-size:300px"></lr-app-rail>`);
    const edge = base(el).getBoundingClientRect(); const resizer = el.shadowRoot!.querySelector('[part="resizer"]')!.getBoundingClientRect();
    expect(Math.abs((resizer.left + resizer.right) / 2 - (direction === 'ltr' ? edge.right : edge.left))).to.be.lessThan(1.1);
    el.forceMode = 'icon-only'; await el.updateComplete;
    await waitUntil(() => Math.abs(base(el).getBoundingClientRect().width - 64) < 0.5, 'icon-only rail width did not settle');
    expect(base(el).getBoundingClientRect().width).to.equal(64);
  });

  it('keeps card framing inert in closed and open mobile mode', async () => {
    const el = await fixture<LyraAppRail>(html`<lr-app-rail frame="card"><button>One</button></lr-app-rail>`);
    mobile(el); await el.updateComplete;
    expect(getComputedStyle(base(el)).marginTop).to.equal('0px'); expect(getComputedStyle(base(el)).boxShadow).to.equal('none');
    expect(getComputedStyle(el).display).to.equal('block'); el.open = true; await el.updateComplete;
    expect(getComputedStyle(base(el)).boxShadow).not.to.equal('none'); expect(getComputedStyle(base(el)).marginTop).to.equal('0px');
  });

  it('restores a plain boundary in forced colors and follows dark palette tokens', async function () {
    const el = await fixture<LyraAppRail>(html`<lr-app-rail frame="card"></lr-app-rail>`);
    const light = getComputedStyle(base(el)).borderTopColor; el.setAttribute('data-lr-theme', 'dark'); await el.updateComplete;
    expect(getComputedStyle(base(el)).borderTopColor).not.to.equal(light);
    try {
      await setForcedColors('active'); const honored = originalMatchMedia.call(window, '(forced-colors: active)').matches;
      if (!honored && !navigator.userAgent.includes('Chrome/')) this.skip();
      expect(honored).to.equal(true); el.frame = 'plain'; await el.updateComplete;
      expect(parseFloat(getComputedStyle(base(el)).borderInlineEndWidth)).to.be.greaterThan(0);
    } finally { await setForcedColors('none'); }
  });

  for (const frame of ['card', 'plain'] as const) it(`is accessible with populated ${frame} sidebar content`, async () => {
    const el = await fixture<LyraAppRail>(html`<lr-app-rail frame=${frame} label="Workspace"><lr-app-rail-group heading="Platform"><lr-app-rail-item current tooltip><span slot="icon">A</span>Account<span slot="meta">3</span><lr-app-rail-item slot="children">Profile</lr-app-rail-item></lr-app-rail-item></lr-app-rail-group></lr-app-rail>`);
    await expect(el).to.be.accessible(); el.forceMode = 'icon-only'; await el.updateComplete; await expect(el).to.be.accessible();
  });
});

describe('app rail sidebar toggle and trigger', () => {
  it('toggles inline mode, alternates a pinned preference and does nothing disconnected', async () => {
    const detached = document.createElement('lr-app-rail') as LyraAppRail; detached.toggle(); expect(detached.preferredMode).to.equal(undefined);
    const el = await fixture<LyraAppRail>(html`<lr-app-rail collapsible></lr-app-rail>`); let toggles = 0; const modes: string[] = [];
    el.addEventListener('lr-toggle', () => { toggles++; }); el.addEventListener('lr-mode-change', event => modes.push(event.detail.mode));
    el.toggle(); await el.updateComplete; expect(el.mode).to.equal('icon-only'); el.toggle(); await el.updateComplete; expect(el.mode).to.equal('full');
    expect(modes).to.deep.equal(['icon-only', 'full']); expect(toggles).to.equal(0);
    el.forceMode = 'full'; el.toggle(); await el.updateComplete; expect(el.preferredMode).to.equal('icon-only'); expect(el.mode).to.equal('full');
    el.toggle(); expect(el.preferredMode).to.equal('full');
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="collapse-toggle"]')!.click(); await el.updateComplete; expect(el.preferredMode).to.equal('icon-only');
    el.forceMode = 'auto'; await el.updateComplete; expect(el.mode).to.equal('icon-only');
  });

  it('preserves persisted restoration after a disconnected toggle and honors mobile vetoes', async () => {
    const storageKey = 'lr-app-rail:sidebar-detached'; const previous = localStorage.getItem(storageKey);
    try {
      localStorage.setItem(storageKey, JSON.stringify({ preferredMode: 'icon-only' }));
      const el = document.createElement('lr-app-rail') as LyraAppRail;
      el.toggle(); el.setAttribute('storage-key', 'sidebar-detached'); el.setAttribute('persist', 'preferred-mode');
      const wrapper = await fixture<HTMLDivElement>(html`<div></div>`); wrapper.append(el); await el.updateComplete;
      expect(el.mode).to.equal('icon-only'); mobile(el); await el.updateComplete;
      const veto = (event: Event) => event.preventDefault(); el.addEventListener('lr-toggle', veto); el.toggle(); await el.updateComplete; expect(el.open).to.equal(false);
      el.removeEventListener('lr-toggle', veto); el.toggle(); await el.updateComplete; expect(el.open).to.equal(true);
      el.toggle(); await el.updateComplete; expect(el.open).to.equal(false);
      let count = 0; el.addEventListener('lr-toggle', () => { count++; }); el.remove(); el.toggle(); expect(count).to.equal(0);
    } finally { if (previous === null) localStorage.removeItem(storageKey); else localStorage.setItem(storageKey, previous); }
  });

  it('recovers focus from a removed resizer for public and forced collapses', async () => {
    const el = await fixture<LyraAppRail>(html`<lr-app-rail resizable></lr-app-rail>`);
    for (const forced of [false, true]) {
      el.forceMode = 'auto'; el.preferredMode = 'full'; await el.updateComplete;
      el.shadowRoot!.querySelector<HTMLElement>('[part="resizer"]')!.focus();
      if (forced) el.forceMode = 'icon-only'; else el.toggle();
      await el.updateComplete; expect(deepActiveElement(document)?.getAttribute('part')).to.equal('base');
    }
  });

  it('leaves unset desktop associations alone, then manages and restores external ARIA', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div><button id="trigger" aria-keyshortcuts="Alt+N">Toggle</button><lr-app-rail for="trigger" collapsible></lr-app-rail></div>`);
    const el = wrapper.querySelector<LyraAppRail>('lr-app-rail')!; const trigger = wrapper.querySelector<HTMLButtonElement>('button')!;
    expect(trigger.hasAttribute('aria-expanded')).to.equal(false); el.triggerCollapses = true; el.hotkey = 'ctrl+b'; await el.updateComplete;
    expect(trigger.getAttribute('aria-expanded')).to.equal('true'); expect(trigger.getAttribute('aria-keyshortcuts')).to.equal('Control+B');
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="collapse-toggle"]')!.click(); await el.updateComplete;
    expect(trigger.getAttribute('aria-expanded')).to.equal('false');
    expect(el.shadowRoot!.querySelector('[part="collapse-toggle"]')!.getAttribute('aria-expanded')).to.equal('false');
    el.hotkey = ''; await el.updateComplete; expect(trigger.getAttribute('aria-keyshortcuts')).to.equal('Alt+N');
    el.triggerCollapses = false; await el.updateComplete; expect(trigger.hasAttribute('aria-expanded')).to.equal(false);
    el.triggerCollapses = true; await el.updateComplete; el.remove(); wrapper.append(el); await aTimeout(0);
    expect(trigger.getAttribute('aria-expanded')).to.equal('false');
  });

  it('projects shortcuts and disclosure state through an icon-button trigger', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div><lr-icon-button id="trigger" label="Toggle sidebar"></lr-icon-button><lr-app-rail for="trigger" trigger-collapses hotkey="ctrl+b"></lr-app-rail></div>`);
    const el = wrapper.querySelector<LyraAppRail>('lr-app-rail')!; const control = wrapper.querySelector('lr-icon-button')!.shadowRoot!.querySelector('button')!;
    await waitUntil(() => control.getAttribute('aria-keyshortcuts') === 'Control+B'); expect(control.getAttribute('aria-expanded')).to.equal('true');
    el.toggle(); await el.updateComplete; await waitUntil(() => control.getAttribute('aria-expanded') === 'false');
    mobile(el); await el.updateComplete; expect(control.getAttribute('aria-keyshortcuts')).to.equal('Control+B');
  });
});

describe('app rail sidebar hotkey', () => {
  it('is opt-in, requires a non-shift modifier and restores the empty default', async () => {
    const el = await fixture<LyraAppRail>(html`<lr-app-rail collapsible></lr-app-rail>`);
    expect(press().defaultPrevented).to.equal(false); expect(el.mode).to.equal('full');
    for (const chord of ['b', 'shift+b']) { el.hotkey = chord; await el.updateComplete; expect(press('b', { ctrlKey: false, shiftKey: chord.startsWith('shift') }).defaultPrevented).to.equal(false); }
    expect(el.shadowRoot!.querySelector('[part="collapse-toggle"]')!.hasAttribute('aria-keyshortcuts')).to.equal(false);
    el.setAttribute('hotkey', 'ctrl+b'); el.removeAttribute('hotkey'); await el.updateComplete; expect(el.hotkey).to.equal('');
  });

  it('toggles exactly once, supports layout fallback and publishes built-in shortcuts', async () => {
    const el = await fixture<LyraAppRail>(html`<lr-app-rail hotkey="ctrl+b" collapsible></lr-app-rail>`);
    expect(press().defaultPrevented).to.equal(true); await el.updateComplete; expect(el.mode).to.equal('icon-only');
    expect(press('и', { code: 'KeyB' }).defaultPrevented).to.equal(true); await el.updateComplete; expect(el.mode).to.equal('full');
    el.hotkey = 'alt+b'; expect(press('∫', { ctrlKey: false, altKey: true, code: 'KeyB' }).defaultPrevented).to.equal(true); await el.updateComplete;
    const parent = el.parentElement!; el.remove(); parent.append(el); await aTimeout(0);
    press('∫', { ctrlKey: false, altKey: true, code: 'KeyB' }); await el.updateComplete; expect(el.mode).to.equal('full');
    el.hotkey = 'mod+b'; await el.updateComplete;
    const expected = detectPlatform(navigator) === 'mac' ? 'Meta+B' : 'Control+B';
    for (const part of ['toggle', 'collapse-toggle']) expect(el.shadowRoot!.querySelector(`[part="${part}"]`)!.getAttribute('aria-keyshortcuts')).to.equal(expected);
    el.hotkey = ''; await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="toggle"]')!.hasAttribute('aria-keyshortcuts')).to.equal(false);
  });

  it('ignores composition, repeat, default-prevented and editable events', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div><lr-app-rail hotkey="ctrl+b"></lr-app-rail><input /><input type="checkbox" /><textarea></textarea><div contenteditable="true"></div><lr-input></lr-input></div>`);
    const el = wrapper.querySelector<LyraAppRail>('lr-app-rail')!;
    for (const init of [{ repeat: true }, { isComposing: true }, { keyCode: 229 }]) expect(press('b', init).defaultPrevented).to.equal(false);
    window.dispatchEvent(new Event('keydown'));
    const prevented = new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, cancelable: true }); prevented.preventDefault(); window.dispatchEvent(prevented);
    for (const target of [wrapper.querySelector('input')!, wrapper.querySelector('textarea')!, wrapper.querySelector('[contenteditable]')!, wrapper.querySelector('lr-input')!.shadowRoot!.querySelector('input')!]) expect(press('b', {}, target).defaultPrevented).to.equal(false);
    expect(el.mode).to.equal('full'); expect(press('b', {}, wrapper.querySelector('[type="checkbox"]')!).defaultPrevented).to.equal(true); await el.updateComplete; expect(el.mode).to.equal('icon-only');
  });

  it('gives one last eligible owner the chord, skipping hidden, inert and pinned rails', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div><lr-app-rail id="one" hotkey="ctrl+b"></lr-app-rail><section><lr-app-rail id="two" hotkey="ctrl+b"></lr-app-rail></section></div>`);
    const one = wrapper.querySelector<LyraAppRail>('#one')!; const two = wrapper.querySelector<LyraAppRail>('#two')!;
    press(); await two.updateComplete; expect(two.mode).to.equal('icon-only'); expect(one.mode).to.equal('full');
    two.hidden = true; press(); await one.updateComplete; expect(one.mode).to.equal('icon-only');
    two.hidden = false; two.parentElement!.inert = true; press(); await one.updateComplete; expect(one.mode).to.equal('full');
    two.parentElement!.inert = false; two.forceMode = 'full'; one.hidden = true; await two.updateComplete;
    expect(press().defaultPrevented).to.equal(false); expect(two.preferredMode).to.equal('icon-only');
  });

  for (const railLast of [false, true]) it(`shares palette chord ownership when rail connects ${railLast ? 'last' : 'first'}`, async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
    const rail = document.createElement('lr-app-rail') as LyraAppRail; rail.hotkey = 'ctrl+k';
    const palette = document.createElement('lr-command-palette') as LyraCommandPalette; palette.hotkey = 'ctrl+k';
    wrapper.append(...(railLast ? [palette, rail] : [rail, palette])); await rail.updateComplete; await palette.updateComplete;
    press('k'); await rail.updateComplete; await palette.updateComplete;
    expect(rail.mode).to.equal(railLast ? 'icon-only' : 'full'); expect(palette.open).to.equal(!railLast);
    if (railLast) { rail.hidden = true; press('k'); await palette.updateComplete; expect(palette.open).to.equal(true); }
  });

  it('opens and closes mobile through the shared vetoable toggle path', async () => {
    const el = await fixture<LyraAppRail>(html`<lr-app-rail hotkey="ctrl+b"><button id="first">First</button></lr-app-rail>`);
    mobile(el); await el.updateComplete; press(); await el.updateComplete; expect(el.open).to.equal(true); expect(document.activeElement?.id).to.equal('first');
    await expect(el).to.be.accessible(); press(); await el.updateComplete; expect(el.open).to.equal(false);
    el.addEventListener('lr-toggle', event => event.preventDefault()); press(); await el.updateComplete; expect(el.open).to.equal(false);
  });
});

describe('sidebar composition', () => {
  it('hides nested disclosure in icon-only, preserves expanded and recovers nested focus', async () => {
    const rail = await fixture<LyraAppRail>(html`<lr-app-rail><lr-app-rail-item id="parent" expanded><span slot="icon">A</span>Account<span slot="meta">3</span><lr-app-rail-item id="child" slot="children">Profile</lr-app-rail-item></lr-app-rail-item></lr-app-rail>`);
    const parent = rail.querySelector<LyraAppRailItem>('#parent')!; const child = rail.querySelector<LyraAppRailItem>('#child')!;
    for (const target of [parent.shadowRoot!.querySelector<HTMLElement>('[part="toggle"]')!, child.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!]) {
      rail.forceMode = 'full'; await rail.updateComplete; await parent.updateComplete; target.focus(); rail.forceMode = 'icon-only'; await rail.updateComplete;
      await waitUntil(() => deepActiveElement(document) === parent.shadowRoot!.querySelector('[part="base"]'));
      expect(getComputedStyle(parent.shadowRoot!.querySelector('[part="toggle"]')!).display).to.equal('none'); expect(getComputedStyle(parent.shadowRoot!.querySelector('[part="children"]')!).display).to.equal('none');
      expect(parent.expanded).to.equal(true); const row = parent.shadowRoot!.querySelector('.row')!.getBoundingClientRect(); const bounds = base(rail).getBoundingClientRect();
      expect(row.left).to.be.at.least(bounds.left - 0.5); expect(row.right).to.be.at.most(bounds.right + 0.5);
    }
    await expect(rail).to.be.accessible();
  });

  it('reserves width for end content and stretches a compact divider', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div><style>lr-app-rail lr-divider { align-self: stretch; }</style><lr-app-rail force-mode="icon-only" style="--lr-app-rail-icon-width:5.5rem"><lr-app-rail-item><span slot="icon">A</span>Account<span slot="end" style="inline-size:1.5rem">3</span></lr-app-rail-item><lr-divider></lr-divider></lr-app-rail></div>`);
    const rail = wrapper.querySelector<LyraAppRail>('lr-app-rail')!; const item = rail.querySelector<LyraAppRailItem>('lr-app-rail-item')!; await item.updateComplete;
    await waitUntil(() => base(rail).getBoundingClientRect().width >= 88, 'icon-only rail width did not settle');
    const end = item.shadowRoot!.querySelector('[part="end"]')!.getBoundingClientRect(); const bounds = base(rail).getBoundingClientRect(); expect(end.right).to.be.at.most(bounds.right + 0.5);
    expect(rail.querySelector('lr-divider')!.getBoundingClientRect().width).to.be.greaterThan(0);
  });

  it('uses one allocation-owned drawer and restores the inline preference when returning wide', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div style="inline-size:1200px;block-size:500px"><style>lr-page[view='mobile'] lr-app-rail::part(collapse-toggle) { display:none; }</style><lr-page><lr-app-rail slot="navigation" label="Workspace" frame="plain" mobile-breakpoint="0px" icon-only-breakpoint="0px" collapsible hotkey="ctrl+b"><lr-app-rail-item><span slot="icon">A</span>Account</lr-app-rail-item></lr-app-rail><p>Main content</p></lr-page></div>`);
    const page = wrapper.querySelector<LyraPage>('lr-page')!; const rail = wrapper.querySelector<LyraAppRail>('lr-app-rail')!;
    const sync = () => { rail.forceMode = page.view === 'mobile' ? 'full' : 'auto'; };
    const observer = new MutationObserver(sync); observer.observe(page, { attributes: true, attributeFilter: ['view'] }); sync();
    try {
      await waitUntil(() => page.view === 'desktop'); sync(); press(); await rail.updateComplete; expect(rail.mode).to.equal('icon-only');
      await expect(page).to.be.accessible(); wrapper.style.inlineSize = '600px'; await waitUntil(() => page.view === 'mobile' && rail.mode === 'full');
      expect(rail.shadowRoot!.querySelectorAll('[part="panel"]').length).to.equal(0); expect(press().defaultPrevented).to.equal(false);
      page.showNavigation(); await page.updateComplete; await rail.updateComplete;
      expect(page.shadowRoot!.querySelectorAll('[aria-modal="true"]').length + rail.shadowRoot!.querySelectorAll('[aria-modal="true"]').length).to.equal(1);
      expect(getComputedStyle(rail.shadowRoot!.querySelector('[part="collapse-toggle"]')!).display).to.equal('none'); expect(press().defaultPrevented).to.equal(false);
      await expect(page).to.be.accessible(); wrapper.style.inlineSize = '1200px'; await waitUntil(() => page.view === 'desktop' && rail.mode === 'icon-only');
    } finally { observer.disconnect(); }
  });
});
