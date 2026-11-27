import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { ifDefined } from 'lit/directives/if-defined.js';
import { __setAnchoredOverlayRuntimeLoaderForTesting } from '../../../internal/anchored-overlay-runtime.js';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { twoFrames } from '../../../../test/frames.js';
import type { LyraTabGroup, LyraTabGroupSelectRequestDetail } from '../../lr-tab-group.js';
import '../../lr-tab-group.js';
import '../../lr-tab.js';
import '../../lr-tab-panel.js';

const names = ['Overview', 'Activity', 'Artifacts', 'History', 'Settings', 'Reports', 'Exports'];
const shown = (element: HTMLElement) => element.getClientRects().length > 0;
const text = (element: HTMLElement) => element.textContent!.trim();
const parts = (el: LyraTabGroup, selector: string) =>
  [...el.shadowRoot!.querySelectorAll<HTMLElement>(selector)].filter(shown);
const strip = (el: LyraTabGroup) => parts(el, '[role="tab"][data-slot]');
const trigger = (el: LyraTabGroup) => parts(el, '[part~="overflow-trigger"]')[0];
const menu = (el: LyraTabGroup) => parts(el, '[role="menu"]')[0];
const items = (el: LyraTabGroup) => parts(el, '[role="menuitemradio"]');
const focused = (el: LyraTabGroup) => el.shadowRoot!.activeElement as HTMLElement | null;

async function mount(options: { menu?: boolean; rtl?: boolean } = {}) {
  const el = await fixture<LyraTabGroup>(html`
    <lr-tab-group label="Sections" dir=${options.rtl ? 'rtl' : 'ltr'}
      overflow=${ifDefined(options.menu === false ? undefined : 'menu')}
      style="display: block; width: 360px; --lr-tab-group-tab-padding: 6px 12px; font: 16px monospace">
      ${names.map(name => html`<lr-tab panel=${name} ?disabled=${name === 'Reports'}>${name}</lr-tab>`)}
      <lr-tab panel="private" hidden>Unlisted</lr-tab>
      ${[...names, 'private'].map(name => html`<lr-tab-panel name=${name}>${name} content</lr-tab-panel>`)}
    </lr-tab-group>`);
  await el.updateComplete;
  await twoFrames();
  return el;
}

async function open(el: LyraTabGroup) {
  const button = trigger(el);
  expect(Boolean(button), 'overflow trigger is visible').to.equal(true);
  button!.click();
  await waitUntil(() => Boolean(menu(el)) && items(el).includes(focused(el)!), 'menu opens and focuses a choice');
}

describe('lr-tab-group menu overflow', () => {
  it('keeps outside focus when a pointer dismisses More before its menu runtime loads', async () => {
    const el = await mount();
    const outside = await fixture<HTMLButtonElement>(html`<button>Outside</button>`);
    await focusByKeyboard(outside);
    trigger(el)!.click();
    // Dispatch in the same turn so even a cached dynamic import has not resumed the open.
    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    await import('./tab-group-overflow-menu.js');
    await twoFrames();
    expect(Boolean(menu(el))).to.equal(false);
    expect(trigger(el)!.getAttribute('aria-expanded')).to.equal('false');
    expect(document.activeElement === outside).to.equal(true);
    await open(el);
  });

  it('retains scroll controls by default and uses ordinary vertical navigation in menu mode', async () => {
    const el = await mount({ menu: false });
    expect(el.overflow).to.equal('scroll');
    expect(parts(el, '[part~="scroll-button"]').length).to.be.greaterThan(0);
    expect(Boolean(trigger(el))).to.equal(false);
    el.placement = 'start';
    el.overflow = 'menu';
    await el.updateComplete;
    await twoFrames();
    expect(Boolean(trigger(el))).to.equal(false);
    expect(strip(el).map(text)).to.deep.equal(names);
  });

  it('partitions the measured row in source order and restores every tab after expansion', async () => {
    const el = await mount();
    const prefix = strip(el).map(text);
    expect(prefix.length).to.be.within(1, names.length - 1);
    expect(prefix).to.deep.equal(names.slice(0, prefix.length));
    expect(parts(el, '[part~="scroll-button"]').length).to.equal(0);
    const list = parts(el, '[role="tablist"]')[0]!;
    expect(list.scrollWidth).to.be.at.most(list.clientWidth + 1);
    expect(text(trigger(el)!)).to.equal('More');
    await open(el);
    expect(items(el).map(text)).to.deep.equal(names.slice(prefix.length));
    expect(items(el).find(item => text(item) === 'Reports')?.getAttribute('aria-disabled')).to.equal('true');
    await expect(el).to.be.accessible();
    el.style.width = '1200px';
    await waitUntil(() => strip(el).length === names.length && !trigger(el), 'all tabs fit after widening');
    expect(Boolean(menu(el))).to.equal(false);
    el.style.width = '260px';
    await waitUntil(() => Boolean(trigger(el)) && strip(el).length < prefix.length, 'fewer tabs fit after narrowing');
    expect(strip(el).map(text)).to.deep.equal(names.slice(0, strip(el).length));
  });

  it('represents a selected overflow panel on More and transfers its indicator when it fits again', async () => {
    const el = await mount();
    el.show('Exports');
    await el.updateComplete;
    const more = trigger(el);
    expect(Boolean(more)).to.equal(true);
    expect(more!.getAttribute('aria-selected')).to.equal('true');
    expect(more!.tabIndex).to.equal(0);
    expect(parts(el, '[role="tab"][tabindex="0"]').length).to.equal(1);
    expect(Boolean(more!.querySelector('[part~="active-tab-indicator"]'))).to.equal(true);
    const panel = parts(el, '[role="tabpanel"]')[0]!;
    expect(panel.querySelector('slot')?.name).to.equal('Exports');
    await open(el);
    expect(items(el).filter(item => item.getAttribute('aria-checked') === 'true').map(text)).to.deep.equal(['Exports']);
    el.style.width = '1200px';
    await waitUntil(() => !trigger(el), 'the active tab fits on the strip');
    expect(el.active).to.equal('Exports');
    const selected = strip(el).find(tab => tab.getAttribute('aria-selected') === 'true');
    expect(text(selected!)).to.equal('Exports');
    expect(selected!.tabIndex).to.equal(0);
    expect(Boolean(selected!.querySelector('[part~="active-tab-indicator"]'))).to.equal(true);
  });

  it('supports a veto and commits the same tab request and panel events from a menu item', async () => {
    const el = await mount();
    await open(el);
    const log: string[] = [];
    const requests: LyraTabGroupSelectRequestDetail[] = [];
    let veto = true;
    el.addEventListener('lr-tab-group-select-request', event => {
      requests.push({ ...event.detail });
      if (veto) event.preventDefault();
    });
    for (const type of ['lr-tab-hide', 'lr-tab-show', 'lr-activate']) {
      el.addEventListener(type, () => log.push(type));
    }
    items(el).find(item => text(item) === 'Reports')!.click();
    expect(requests.length).to.equal(0);
    items(el).find(item => text(item) === 'Exports')!.click();
    await el.updateComplete;
    expect(el.active).to.equal('Overview');
    expect(Boolean(menu(el))).to.equal(true);
    expect(log).to.deep.equal([]);
    veto = false;
    items(el).find(item => text(item) === 'Exports')!.click();
    await waitUntil(() => el.active === 'Exports' && !menu(el), 'accepted item selects its panel');
    expect(requests).to.deep.equal(Array.from({ length: 2 }, () => ({ value: 'Exports', previousValue: 'Overview' })));
    expect(log).to.deep.equal(['lr-tab-hide', 'lr-tab-show', 'lr-activate']);
    expect(focused(el) === trigger(el)).to.equal(true);
  });

  for (const rtl of [false, true]) {
    it(`navigates More and its items by keyboard in ${rtl ? 'RTL' : 'LTR'}`, async () => {
      const el = await mount({ rtl });
      const more = trigger(el)!;
      expect(Boolean(more)).to.equal(true);
      const last = strip(el).at(-1)!;
      await focusByKeyboard(last);
      const previous = el.active;
      await sendKeys({ press: rtl ? 'ArrowLeft' : 'ArrowRight' });
      expect(focused(el) === more).to.equal(true);
      expect(el.active).to.equal(previous);
      await sendKeys({ press: 'ArrowDown' });
      await waitUntil(() => items(el).includes(focused(el)!), 'keyboard opens More and focuses a choice');
      expect(more.getAttribute('aria-expanded')).to.equal('true');
      expect(items(el).includes(focused(el)!)).to.equal(true);
      await sendKeys({ press: 'End' });
      expect(text(focused(el)!)).to.equal('Exports');
      await sendKeys({ press: 'ArrowUp' });
      expect(text(focused(el)!)).to.equal('Settings');
      await sendKeys({ press: 'Escape' });
      await waitUntil(() => !menu(el) && focused(el) === more, 'Escape returns to More');
      expect(more.getAttribute('aria-expanded')).to.equal('false');
      await sendKeys({ press: 'Enter' });
      await waitUntil(() => items(el).includes(focused(el)!), 'Enter reopens More and focuses a choice');
      await sendKeys({ press: 'End' });
      await sendKeys({ press: 'Enter' });
      await waitUntil(() => el.active === 'Exports' && !menu(el), 'Enter selects the focused item');
      expect(focused(el) === more).to.equal(true);
    });
  }

  it('returns focus to More on positioning failure and retries successfully', async () => {
    const el = await mount();
    const more = trigger(el)!;
    await focusByKeyboard(more);
    let attempts = 0;
    __setAnchoredOverlayRuntimeLoaderForTesting(() => {
      attempts++;
      return Promise.reject(new Error('Positioning unavailable'));
    });
    try {
      more.click();
      await waitUntil(() => attempts === 1 && !menu(el), 'unpositioned menu closes');
      expect(more.getAttribute('aria-expanded')).to.equal('false');
      expect(focused(el) === more).to.equal(true);
      expect(el.active).to.equal('Overview');
    } finally {
      __setAnchoredOverlayRuntimeLoaderForTesting(undefined);
    }
    await open(el);
    expect(items(el).map(text)).to.include('Exports');
  });

  it('opens at the last available item with ArrowUp and lets Tab proceed into the active panel', async () => {
    const el = await mount();
    el.placement = 'bottom';
    await el.updateComplete;
    const more = trigger(el)!;
    await focusByKeyboard(more);
    await sendKeys({ press: 'ArrowUp' });
    await waitUntil(() => focused(el)?.getAttribute('data-slot') === 'Exports', 'last menu item receives focus');
    await sendKeys({ press: 'Home' });
    expect(focused(el) === items(el)[0]).to.equal(true);
    await sendKeys({ press: 'Tab' });
    await waitUntil(() => !menu(el), 'Tab dismisses the menu');
    expect(focused(el)?.getAttribute('role')).to.equal('tabpanel');
    expect(el.active).to.equal('Overview');
  });

  it('closes an open menu on an outside press and can reopen after disconnecting', async () => {
    const el = await mount();
    await open(el);
    const outside = document.createElement('button');
    const parent = el.parentElement!;
    el.after(outside);
    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    await waitUntil(() => !menu(el), 'outside press dismisses the menu');
    await open(el);
    el.remove();
    parent.append(el);
    await el.updateComplete;
    expect(Boolean(menu(el))).to.equal(false);
    await open(el);
    expect(el.active).to.equal('Overview');
    expect(trigger(el)!.getAttribute('aria-expanded')).to.equal('true');
  });

  it('routes Delete on a collapsed closable tab through its descriptor without activating it', async () => {
    const el = await mount();
    const descriptor = el.querySelector<HTMLElement>('lr-tab[panel="Exports"]')!;
    descriptor.setAttribute('closable', '');
    await open(el);
    const item = items(el).find(candidate => text(candidate) === 'Exports')!;
    expect(item.getAttribute('aria-keyshortcuts')).to.equal('Delete');
    const closed: EventTarget[] = [];
    el.addEventListener('lr-close', event => closed.push(event.target!));
    await focusByKeyboard(item);
    await sendKeys({ press: 'Delete' });
    expect(closed.length).to.equal(1);
    expect(closed[0] === descriptor).to.equal(true);
    expect(el.active).to.equal('Overview');
    expect(descriptor.parentElement === el).to.equal(true);
  });

  it('keeps keyboard focus reachable if the focused menu item becomes disabled', async () => {
    const el = await mount();
    await open(el);
    const selected = items(el).find(item => text(item) === 'Settings')!;
    await focusByKeyboard(selected);
    const descriptor = el.querySelector<HTMLElement>('lr-tab[panel="Settings"]')!;
    descriptor.setAttribute('disabled', '');
    await waitUntil(() => selected.getAttribute('aria-disabled') === 'true', 'disabled descriptor updates its menu choice');
    await twoFrames();
    const current = focused(el);
    expect(Boolean(current && (current === trigger(el) ||
      (items(el).includes(current) && current.getAttribute('aria-disabled') !== 'true')))).to.equal(true);
    expect(el.active).to.equal('Overview');
  });

  it('uses the localized More label and drops hidden descriptors from an open menu', async () => {
    const el = await mount();
    el.strings = { tabGroupMore: 'Weitere' };
    await el.updateComplete;
    const more = trigger(el)!;
    expect(Boolean(more)).to.equal(true);
    expect(text(more)).to.equal('Weitere');
    await open(el);
    expect(items(el).map(text)).to.include('Settings');
    el.querySelector<HTMLElement>('lr-tab[panel="Settings"]')!.hidden = true;
    await waitUntil(() => !items(el).some(item => text(item) === 'Settings'), 'hidden descriptor leaves the menu');
    expect(items(el).map(text)).to.include('Exports');
    await expect(el).to.be.accessible();
  });
});
