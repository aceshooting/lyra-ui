import { toRgba } from '../../../../test/color-contrast.js';
import { aTimeout, expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import type { TemplateResult } from 'lit';
import { ignoreResizeObserverLoopErrors } from '../../../../test/resize-observer-noise.js';
import { setForcedColors, setReducedMotion } from '../../../../test/wtr-media.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { setAnimation } from '../../../utilities/animation-registry.js';
import type { LyraPopover } from '../../overlays/overlay/popover.class.js';
import '../../overlays/overlay/popover.js';
import type {
  LyraNavigationMenuItem,
  LyraNavigationMenuToggleDetail,
} from '../navigation-menu-item/navigation-menu-item.class.js';
import type {
  LyraNavigationMenu,
  LyraNavigationMenuExpandedChangeDetail,
} from './navigation-menu.class.js';
import './navigation-menu.js';

ignoreResizeObserverLoopErrors('collapse toggles host block size');

it('releases ownership when a disconnected menu item is reparented outside the menu', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div><lr-navigation-menu>
    <lr-navigation-menu-item>Products<ul slot="panel"><li><a href="#product">Product</a></li></ul></lr-navigation-menu-item>
  </lr-navigation-menu></div>`);
  const menu = wrapper.querySelector<LyraNavigationMenu>('lr-navigation-menu')!;
  const child = menu.querySelector<LyraNavigationMenuItem>('lr-navigation-menu-item')!;
  await menu.updateComplete;
  await child.updateComplete;
  await waitUntil(() => child.getAttribute('role') === 'listitem');
  menu.remove();
  wrapper.append(child);
  await child.updateComplete;
  expect(child.hasAttribute('role'), 'the detached owner releases its list role').to.equal(false);
  base(child).click();
  await child.updateComplete;
  await waitUntil(() => child.open);
  expect(getComputedStyle(panel(child)).position, 'unowned disclosures stay in flow').to.equal('static');

  menu.append(child);
  wrapper.append(menu);
  await menu.updateComplete;
  await child.updateComplete;
  await waitUntil(() => child.getAttribute('role') === 'listitem', 'reconnected menu did not reacquire its item');
});

const userAgent = navigator.userAgent;
const isWebKit = /AppleWebKit/.test(userAgent) && !/Chrome|Chromium/.test(userAgent);

interface RecordedToggle extends LyraNavigationMenuToggleDetail {
  id: string;
}

function items(prefix = ''): TemplateResult {
  return html`
    <lr-navigation-menu-item id="${prefix}products"
      >Products<ul slot="panel" style="inline-size: 12rem; margin: 0"
        ><li><a id="${prefix}products-a" href="#analytics">Analytics</a></li
        ><li><a id="${prefix}products-b" href="#billing">Billing</a></li></ul
      ></lr-navigation-menu-item
    >
    <lr-navigation-menu-item id="${prefix}resources"
      >Resources<ul slot="panel" style="inline-size: 26rem; margin: 0"
        ><li><a id="${prefix}resources-a" href="#guides">Guides</a></li
        ><li><a id="${prefix}resources-b" href="#posts">Posts</a></li
        ><li><a id="${prefix}resources-c" href="#community">Community</a></li></ul
      ></lr-navigation-menu-item
    >
    <lr-navigation-menu-item id="${prefix}docs" href="#docs" current>Docs</lr-navigation-menu-item>
    <lr-navigation-menu-item id="${prefix}pricing" href="#pricing">Pricing</lr-navigation-menu-item>
  `;
}

function itemsOf(menu: LyraNavigationMenu): LyraNavigationMenuItem[] {
  return [...menu.querySelectorAll<LyraNavigationMenuItem>('lr-navigation-menu-item')];
}

function item(menu: Element, id: string): LyraNavigationMenuItem {
  return menu.querySelector<LyraNavigationMenuItem>(`#${id}`)!;
}

function base(target: LyraNavigationMenuItem): HTMLElement {
  return target.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
}

function panel(target: LyraNavigationMenuItem): HTMLElement {
  return target.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')!;
}

function content(target: LyraNavigationMenuItem): HTMLElement {
  return target.shadowRoot!.querySelector<HTMLElement>('.panel-content')!;
}

function part(menu: LyraNavigationMenu, name: string): HTMLElement | null {
  return menu.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`);
}

function deepActive(): Element | null {
  let active: Element | null = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}

function activePart(target: LyraNavigationMenuItem): string {
  return target.shadowRoot!.activeElement?.getAttribute('part') ?? '';
}

async function settle(menu: LyraNavigationMenu): Promise<void> {
  await menu.updateComplete;
  for (const entry of itemsOf(menu)) await entry.updateComplete;
  await nextFrame();
  await menu.updateComplete;
  for (const entry of itemsOf(menu)) await entry.updateComplete;
}

async function menuFixture(template: TemplateResult): Promise<LyraNavigationMenu> {
  const root = await fixture<HTMLElement>(template);
  const menu = (root.localName === 'lr-navigation-menu'
    ? root
    : root.querySelector('lr-navigation-menu')) as LyraNavigationMenu;
  await settle(menu);
  return menu;
}

async function waitPlaced(target: LyraNavigationMenuItem, message = 'panel never became visible'): Promise<void> {
  await waitUntil(() => {
    const surface = panel(target);
    const rect = surface.getBoundingClientRect();
    return (
      target.open &&
      !surface.hidden &&
      rect.width > 0 &&
      rect.height > 0 &&
      getComputedStyle(surface).visibility !== 'hidden'
    );
  }, message);
  // Geometry assertions read the settled box, not one mid-way through the opening animation.
  const running = [panel(target), content(target)].flatMap((element) => element.getAnimations());
  await Promise.all(running.map((animation) => animation.finished.catch(() => undefined)));
}

function recordToggles(menu: LyraNavigationMenu): RecordedToggle[] {
  const events: RecordedToggle[] = [];
  menu.addEventListener('lr-toggle', (event) => {
    const target = event.target as Element;
    if (target.localName !== 'lr-navigation-menu-item') return;
    events.push({ id: target.id, ...(event as CustomEvent<LyraNavigationMenuToggleDetail>).detail });
  });
  return events;
}

function recordExpanded(menu: LyraNavigationMenu): LyraNavigationMenuExpandedChangeDetail[] {
  const events: LyraNavigationMenuExpandedChangeDetail[] = [];
  menu.addEventListener('lr-expanded-change', (event) => {
    events.push((event as CustomEvent<LyraNavigationMenuExpandedChangeDetail>).detail);
  });
  return events;
}

function pointer(target: Element, type: string, init: PointerEventInit = {}): void {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      composed: true,
      cancelable: true,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      ...init,
    }),
  );
}

function hoverSynthetic(target: LyraNavigationMenuItem): void {
  pointer(base(target), 'pointerover');
}

function leaveSynthetic(target: LyraNavigationMenuItem): void {
  pointer(base(target), 'pointerout', { relatedTarget: document.body });
}

function center(element: Element): [number, number] {
  const rect = element.getBoundingClientRect();
  return [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)];
}

function farPoint(): [number, number] {
  return [Math.max(0, window.innerWidth - 4), Math.max(0, window.innerHeight - 4)];
}

async function clickAt(element: Element): Promise<void> {
  await sendMouse({ type: 'click', position: center(element) });
}

/** Records whether keydowns reaching the document were already handled. */
function keyLog(): { prevented: boolean[]; stop(): void } {
  const prevented: boolean[] = [];
  const listener = (event: KeyboardEvent): void => {
    prevented.push(event.defaultPrevented);
  };
  document.addEventListener('keydown', listener);
  return {
    prevented,
    stop: () => document.removeEventListener('keydown', listener),
  };
}

function parseTimes(value: string): number[] {
  return value.split(',').map((entry) => {
    const match = /^\s*(-?[\d.e+-]+)(ms|s)\s*$/i.exec(entry);
    if (!match) return Number.NaN;
    const amount = Number(match[1]);
    return match[2]?.toLowerCase() === 's' ? amount * 1000 : amount;
  });
}

async function enterForcedColors(): Promise<boolean> {
  try {
    await setForcedColors('active');
  } catch {
    return false;
  }
  if (matchMedia('(forced-colors: active)').matches) return true;
  await setForcedColors('none');
  return false;
}

afterEach(async () => {
  await resetMouse();
});

describe('<lr-navigation-menu> structure and ARIA', () => {
  it('renders a named nav landmark with a list of listitem hosts and passes axe closed', async () => {
    const menu = await menuFixture(html`<lr-navigation-menu>${items()}</lr-navigation-menu>`);
    const nav = part(menu, 'base')!;
    const list = part(menu, 'list')!;
    expect(nav.localName).to.equal('nav');
    expect(nav.getAttribute('aria-label')).to.equal('Navigation');
    expect(list.getAttribute('role')).to.equal('list');
    expect(list.parentElement?.getAttribute('part')).to.equal('base');
    expect(itemsOf(menu).map((entry) => entry.getAttribute('role'))).to.deep.equal([
      'listitem',
      'listitem',
      'listitem',
      'listitem',
    ]);
    expect(part(menu, 'toggle') === null).to.equal(true);
    await expect(menu).to.be.accessible();
  });

  it('passes axe with a panel open', async () => {
    const menu = await menuFixture(html`<lr-navigation-menu>${items()}</lr-navigation-menu>`);
    const products = item(menu, 'products');
    base(products).click();
    await waitPlaced(products);
    expect(panel(products).hidden).to.equal(false);
    await expect(menu).to.be.accessible();
  });

  it('passes axe collapsed and expanded with an item open in flow', async () => {
    const menu = await menuFixture(html`
      <div style="inline-size: 320px">
        <lr-navigation-menu mobile-breakpoint="40rem" expanded>${items()}</lr-navigation-menu>
      </div>
    `);
    await waitUntil(() => menu.collapsed, 'menu never collapsed');
    await settle(menu);
    const products = item(menu, 'products');
    products.open = true;
    await settle(menu);
    expect(panel(products).hidden).to.equal(false);
    expect(panel(products).getBoundingClientRect().height).to.be.greaterThan(0);
    await expect(menu).to.be.accessible();
  });

  it('names the nav from the host label, the localized default, or an explicit empty label', async () => {
    const named = await menuFixture(
      html`<lr-navigation-menu aria-label="Primary">${items()}</lr-navigation-menu>`,
    );
    expect(part(named, 'base')!.getAttribute('aria-label')).to.equal('Primary');

    const empty = await menuFixture(
      html`<lr-navigation-menu aria-label="">${items('e-')}</lr-navigation-menu>`,
    );
    expect(part(empty, 'base')!.hasAttribute('aria-label')).to.equal(true);
    expect(part(empty, 'base')!.getAttribute('aria-label')).to.equal('');

    const overridden = await menuFixture(
      html`<lr-navigation-menu .strings=${{ navigation: 'Site' }}>${items('s-')}</lr-navigation-menu>`,
    );
    expect(part(overridden, 'base')!.getAttribute('aria-label')).to.equal('Site');

    const property = await menuFixture(html`<lr-navigation-menu>${items('p-')}</lr-navigation-menu>`);
    property.accessibleLabel = 'Main';
    await settle(property);
    expect(part(property, 'base')!.getAttribute('aria-label')).to.equal('Main');
  });

  it('passes landmark-unique with two distinctly labelled menus', async () => {
    const container = await fixture<HTMLElement>(html`
      <div>
        <lr-navigation-menu aria-label="Primary">${items('a-')}</lr-navigation-menu>
        <lr-navigation-menu aria-label="Footer">${items('b-')}</lr-navigation-menu>
      </div>
    `);
    for (const menu of container.querySelectorAll<LyraNavigationMenu>('lr-navigation-menu')) {
      await settle(menu);
    }
    await expect(container).to.be.accessible();
  });

  it('warns once in dev mode about a non-item child', async () => {
    const originalWarn = console.warn;
    const runtime = globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> };
    const originalIssued = runtime.litIssuedWarnings;
    const calls: string[] = [];
    console.warn = (...args: unknown[]) => {
      calls.push(args.map(String).join(' '));
    };
    runtime.litIssuedWarnings = new Set();
    try {
      await menuFixture(
        html`<lr-navigation-menu><a href="#logo">Logo</a>${items()}</lr-navigation-menu>`,
      );
      await nextFrame();
      const own = calls.filter((message) => message.includes('lr-navigation-menu'));
      expect(own).to.have.length(1);
      expect(own[0]).to.contain('<a>');
      await menuFixture(
        html`<lr-navigation-menu><span>Search</span>${items('w-')}</lr-navigation-menu>`,
      );
      // wait-reason: negative assertion, no second warning may be issued
      await aTimeout(20);
      expect(calls.filter((message) => message.includes('lr-navigation-menu'))).to.have.length(1);
    } finally {
      console.warn = originalWarn;
      runtime.litIssuedWarnings = originalIssued;
    }
  });

  it('wires trigger ARIA with both expanded values and no menu semantics', async () => {
    const menu = await menuFixture(html`<lr-navigation-menu>${items()}</lr-navigation-menu>`);
    const products = item(menu, 'products');
    const trigger = base(products);
    expect(trigger.localName).to.equal('button');
    expect(trigger.getAttribute('aria-expanded')).to.equal('false');
    const controls = trigger.getAttribute('aria-controls')!;
    expect(products.shadowRoot!.getElementById(controls)?.getAttribute('part')).to.equal('panel');
    expect(trigger.hasAttribute('aria-haspopup')).to.equal(false);
    trigger.click();
    await settle(menu);
    expect(trigger.getAttribute('aria-expanded')).to.equal('true');
    const roots: ParentNode[] = [menu, menu.shadowRoot!, ...itemsOf(menu).map((entry) => entry.shadowRoot!)];
    for (const root of roots) {
      expect(root.querySelectorAll('[role="menu"], [role="menuitem"], [role="menubar"]').length).to.equal(0);
    }
    const docs = item(menu, 'docs');
    expect(base(docs).localName).to.equal('a');
    expect(base(docs).getAttribute('aria-current')).to.equal('page');
    expect(base(item(menu, 'pricing')).getAttribute('aria-current')).to.equal('false');
  });

  it('keeps the toggle glyph wrapper inert and aria-hidden and renders a slotted replacement', async () => {
    const menu = await menuFixture(html`
      <div style="inline-size: 320px">
        <lr-navigation-menu mobile-breakpoint="40rem"
          ><span slot="toggle-icon" id="custom-toggle-icon">=</span>${items()}</lr-navigation-menu
        >
      </div>
    `);
    await waitUntil(() => part(menu, 'toggle') !== null, 'toggle never rendered');
    const wrapper = part(menu, 'toggle-icon')!;
    expect(wrapper.getAttribute('aria-hidden')).to.equal('true');
    expect(wrapper.hasAttribute('inert')).to.equal(true);
    const slot = wrapper.querySelector('slot')!;
    expect(slot.assignedElements().map((node) => node.id)).to.deep.equal(['custom-toggle-icon']);
    expect(menu.querySelector('#custom-toggle-icon')!.getBoundingClientRect().width).to.be.greaterThan(0);
    const caret = item(menu, 'products').shadowRoot!.querySelector('[part~="expand-icon"]')!;
    expect(caret.getAttribute('aria-hidden')).to.equal('true');
    expect(caret.hasAttribute('inert')).to.equal(true);
  });
});

describe('<lr-navigation-menu> click and keyboard', () => {
  it('opens on click, keeps focus on the trigger, and closes on a second click', async () => {
    const menu = await menuFixture(html`<lr-navigation-menu>${items()}</lr-navigation-menu>`);
    const products = item(menu, 'products');
    const events = recordToggles(menu);
    base(products).focus();
    base(products).click();
    await settle(menu);
    expect(products.open).to.equal(true);
    expect(activePart(products)).to.contain('base');
    expect(events).to.deep.equal([{ id: 'products', expanded: true, source: 'user' }]);
    base(products).click();
    await settle(menu);
    expect(products.open).to.equal(false);
    expect(events.at(-1)).to.deep.equal({ id: 'products', expanded: false, source: 'user' });
  });

  it('acts on the focused trigger for Enter and Space while the pointer hovers another', async () => {
    const menu = await menuFixture(
      html`<lr-navigation-menu show-delay="0" hide-delay="0">${items()}</lr-navigation-menu>`,
    );
    const products = item(menu, 'products');
    const resources = item(menu, 'resources');
    base(products).focus();
    await hoverUntilMatched(base(resources), 'pointer never reached resources');
    await waitUntil(() => resources.open, 'resources never hover-opened');
    base(products).focus();
    await sendKeys({ press: 'Enter' });
    await settle(menu);
    expect(products.open).to.equal(true);
    expect(resources.open).to.equal(false);
    await sendKeys({ press: 'Space' });
    await settle(menu);
    expect(products.open).to.equal(false);
  });

  it('announces the peer close before the new open and keeps one item open', async () => {
    const menu = await menuFixture(html`<lr-navigation-menu>${items()}</lr-navigation-menu>`);
    const products = item(menu, 'products');
    const resources = item(menu, 'resources');
    base(products).click();
    await waitPlaced(products);
    const events = recordToggles(menu);
    base(resources).click();
    await settle(menu);
    await nextFrame();
    expect(events).to.deep.equal([
      { id: 'products', expanded: false, source: 'peer' },
      { id: 'resources', expanded: true, source: 'user' },
    ]);
    expect(menu.querySelectorAll('lr-navigation-menu-item[open]').length).to.equal(1);
  });

  it('closes on Escape from inside a panel and returns focus to the trigger', async () => {
    const menu = await menuFixture(html`<lr-navigation-menu>${items()}</lr-navigation-menu>`);
    const products = item(menu, 'products');
    base(products).click();
    await waitPlaced(products);
    menu.querySelector<HTMLElement>('#products-a')!.focus();
    await sendKeys({ press: 'Escape' });
    await settle(menu);
    expect(products.open).to.equal(false);
    expect(activePart(products)).to.contain('base');
  });

  it('closes a hover-opened panel on Escape without taking focus from an outside field', async () => {
    const container = await fixture<HTMLElement>(html`
      <div>
        <lr-navigation-menu show-delay="0" hide-delay="100000">${items()}</lr-navigation-menu>
        <input id="outside" aria-label="Search" />
      </div>
    `);
    const menu = container.querySelector<LyraNavigationMenu>('lr-navigation-menu')!;
    await settle(menu);
    const products = item(menu, 'products');
    container.querySelector<HTMLInputElement>('#outside')!.focus();
    hoverSynthetic(products);
    await waitPlaced(products);
    await sendKeys({ press: 'Escape' });
    await settle(menu);
    expect(products.open).to.equal(false);
    expect(deepActive()?.id).to.equal('outside');
  });

  it('tabs from an open trigger into its panel and closes when focus leaves the item', async () => {
    const menu = await menuFixture(
      isWebKit
        ? html`<lr-navigation-menu>
            <lr-navigation-menu-item id="products"
              >Products<div slot="panel"
                ><button id="products-a">Analytics</button><button id="products-b">Billing</button></div
              ></lr-navigation-menu-item
            >
            <lr-navigation-menu-item id="resources">Resources</lr-navigation-menu-item>
          </lr-navigation-menu>`
        : html`<lr-navigation-menu>${items()}</lr-navigation-menu>`,
    );
    const products = item(menu, 'products');
    const events = recordToggles(menu);
    base(products).focus();
    base(products).click();
    await waitPlaced(products);
    await sendKeys({ press: 'Tab' });
    expect(deepActive()?.id).to.equal('products-a');
    await sendKeys({ press: 'Tab' });
    expect(deepActive()?.id).to.equal('products-b');
    await sendKeys({ press: 'Tab' });
    await settle(menu);
    expect(products.open).to.equal(false);
    expect(events.at(-1)).to.deep.equal({ id: 'products', expanded: false, source: 'user' });
    expect(activePart(item(menu, 'resources'))).to.contain('base');
  });

  it('moves between navigable top-level bases with arrows, Home and End, without wrapping', async () => {
    const menu = await menuFixture(html`
      <lr-navigation-menu>
        <lr-navigation-menu-item id="one">One<div slot="panel"><a href="#a">A</a></div></lr-navigation-menu-item>
        <lr-navigation-menu-item id="two" hidden>Two</lr-navigation-menu-item>
        <lr-navigation-menu-item id="three" inert>Three</lr-navigation-menu-item>
        <lr-navigation-menu-item id="four" aria-hidden="true">Four</lr-navigation-menu-item>
        <lr-navigation-menu-item id="five" href="#five">Five</lr-navigation-menu-item>
        <lr-navigation-menu-item id="six">Six</lr-navigation-menu-item>
      </lr-navigation-menu>
    `);
    const log = keyLog();
    try {
      base(item(menu, 'one')).focus();
      await sendKeys({ press: 'ArrowLeft' });
      expect(activePart(item(menu, 'one'))).to.contain('base');
      await sendKeys({ press: 'ArrowRight' });
      expect(activePart(item(menu, 'five'))).to.contain('base');
      await sendKeys({ press: 'ArrowRight' });
      expect(activePart(item(menu, 'six'))).to.contain('base');
      await sendKeys({ press: 'ArrowRight' });
      expect(activePart(item(menu, 'six'))).to.contain('base');
      await sendKeys({ press: 'Home' });
      expect(activePart(item(menu, 'one'))).to.contain('base');
      await sendKeys({ press: 'End' });
      expect(activePart(item(menu, 'six'))).to.contain('base');
      await sendKeys({ press: 'ArrowLeft' });
      expect(activePart(item(menu, 'five'))).to.contain('base');
      expect(log.prevented.slice(1)).to.deep.equal([true, true, true, true, true, true]);
      expect(item(menu, 'one').open).to.equal(false);
    } finally {
      log.stop();
    }
  });

  it('swaps ArrowLeft and ArrowRight under RTL', async () => {
    const menu = await menuFixture(html`<lr-navigation-menu dir="rtl">${items()}</lr-navigation-menu>`);
    base(item(menu, 'products')).focus();
    await sendKeys({ press: 'ArrowLeft' });
    expect(activePart(item(menu, 'resources'))).to.contain('base');
    await sendKeys({ press: 'ArrowLeft' });
    expect(activePart(item(menu, 'docs'))).to.contain('base');
    await sendKeys({ press: 'ArrowRight' });
    expect(activePart(item(menu, 'resources'))).to.contain('base');
  });

  it('enters an open panel with ArrowDown and moves within it, ignoring closed triggers and fields', async () => {
    const menu = await menuFixture(html`
      <lr-navigation-menu show-delay="0">
        ${items()}
        <lr-navigation-menu-item id="search"
          >Search<div slot="panel"><input id="field" aria-label="Query" /><a id="after" href="#x">X</a></div
        ></lr-navigation-menu-item>
      </lr-navigation-menu>
    `);
    const products = item(menu, 'products');
    const log = keyLog();
    try {
      base(products).focus();
      await sendKeys({ press: 'ArrowDown' });
      expect(log.prevented.at(-1)).to.equal(false);
      expect(products.open).to.equal(false);
      expect(activePart(products)).to.contain('base');

      products.open = true;
      await sendKeys({ press: 'ArrowDown' });
      await waitUntil(() => deepActive()?.id === 'products-a', 'ArrowDown did not enter the open panel');
      expect(log.prevented.at(-1)).to.equal(true);
      await sendKeys({ press: 'ArrowDown' });
      expect(deepActive()?.id).to.equal('products-b');
      await sendKeys({ press: 'ArrowDown' });
      expect(deepActive()?.id).to.equal('products-b');
      await sendKeys({ press: 'ArrowUp' });
      expect(deepActive()?.id).to.equal('products-a');
      await sendKeys({ press: 'ArrowUp' });
      expect(deepActive()?.id).to.equal('products-a');
      await sendKeys({ press: 'End' });
      expect(deepActive()?.id).to.equal('products-b');
      await sendKeys({ press: 'Home' });
      expect(deepActive()?.id).to.equal('products-a');

      const search = item(menu, 'search');
      search.open = true;
      await waitPlaced(search);
      menu.querySelector<HTMLInputElement>('#field')!.focus();
      const before = log.prevented.length;
      await sendKeys({ press: 'ArrowDown' });
      expect(log.prevented.slice(before)).to.deep.equal([false]);
      expect(deepActive()?.id).to.equal('field');
    } finally {
      log.stop();
    }
  });

  it('ignores modified arrows and arrows in the stacked layout', async () => {
    const menu = await menuFixture(html`<lr-navigation-menu>${items()}</lr-navigation-menu>`);
    const log = keyLog();
    try {
      base(item(menu, 'products')).focus();
      await sendKeys({ press: 'Alt+ArrowRight' });
      expect(log.prevented.at(-1)).to.equal(false);
      expect(activePart(item(menu, 'products'))).to.contain('base');
    } finally {
      log.stop();
    }
    const stacked = await menuFixture(html`
      <div style="inline-size: 320px">
        <lr-navigation-menu mobile-breakpoint="40rem" expanded>${items('st-')}</lr-navigation-menu>
      </div>
    `);
    await waitUntil(() => stacked.collapsed, 'menu never collapsed');
    await settle(stacked);
    const stackedLog = keyLog();
    try {
      base(item(stacked, 'st-products')).focus();
      await sendKeys({ press: 'ArrowRight' });
      await sendKeys({ press: 'ArrowDown' });
      expect(stackedLog.prevented).to.deep.equal([false, false]);
      expect(activePart(item(stacked, 'st-products'))).to.contain('base');
    } finally {
      stackedLog.stop();
    }
  });
});

describe('<lr-navigation-menu> hover', () => {
  it('opens on hover and closes on leave with zero delays', async () => {
    const menu = await menuFixture(
      html`<lr-navigation-menu show-delay="0" hide-delay="0">${items()}</lr-navigation-menu>`,
    );
    const products = item(menu, 'products');
    const events = recordToggles(menu);
    await hoverUntilMatched(base(products), 'pointer never reached products');
    await waitUntil(() => products.open, 'hover did not open');
    await sendMouse({ type: 'move', position: farPoint() });
    await waitUntil(() => !products.open, 'leaving did not close');
    expect(events).to.deep.equal([
      { id: 'products', expanded: true, source: 'user' },
      { id: 'products', expanded: false, source: 'user' },
    ]);
  });

  it('waits for show-delay before a hover opens', async () => {
    const menu = await menuFixture(
      html`<lr-navigation-menu show-delay="300" skip-delay="0">${items()}</lr-navigation-menu>`,
    );
    const products = item(menu, 'products');
    hoverSynthetic(products);
    // wait-reason: negative assertion, the hover must not open before show-delay elapses
    await aTimeout(50);
    expect(products.open).to.equal(false);
    await waitUntil(() => products.open, 'delayed hover never opened');
  });

  it('switches immediately when another panel is open', async () => {
    const menu = await menuFixture(
      html`<lr-navigation-menu show-delay="300">${items()}</lr-navigation-menu>`,
    );
    const products = item(menu, 'products');
    const resources = item(menu, 'resources');
    base(products).click();
    await waitPlaced(products);
    hoverSynthetic(resources);
    expect(resources.open).to.equal(true);
    expect(products.open).to.equal(false);
  });

  it('pins a hover-opened panel on click and keeps programmatic panels open on leave', async () => {
    const menu = await menuFixture(
      html`<lr-navigation-menu show-delay="0" hide-delay="0">${items()}</lr-navigation-menu>`,
    );
    const products = item(menu, 'products');
    await hoverUntilMatched(base(products), 'pointer never reached products');
    await waitUntil(() => products.open, 'hover did not open');
    await clickAt(base(products));
    await sendMouse({ type: 'move', position: farPoint() });
    // wait-reason: negative assertion, a pinned panel must not close on pointer leave
    await aTimeout(200);
    expect(products.open, 'a pinned panel closed on leave').to.equal(true);
    await clickAt(base(products));
    await waitUntil(() => !products.open, 'second click did not close the pinned panel');

    const resources = item(menu, 'resources');
    resources.open = true;
    await waitPlaced(resources);
    hoverSynthetic(resources);
    leaveSynthetic(resources);
    // wait-reason: negative assertion, pointer-leave must not close a programmatic panel
    await aTimeout(100);
    expect(resources.open, 'pointer-leave closed a programmatic panel').to.equal(true);
    base(resources).click();
    await settle(menu);
    expect(resources.open).to.equal(false);
  });

  it('keeps the panel open while the pointer crosses the gap through the hover bridge', async () => {
    const menu = await menuFixture(
      html`<lr-navigation-menu show-delay="0" hide-delay="0" distance="40">${items()}</lr-navigation-menu>`,
    );
    const products = item(menu, 'products');
    await hoverUntilMatched(base(products), 'pointer never reached products');
    await waitPlaced(products);
    await waitUntil(
      () => products.shadowRoot!.querySelector('.hover-bridge') !== null,
      'hover bridge never rendered',
    );
    const trigger = base(products).getBoundingClientRect();
    const list = part(menu, 'list')!.getBoundingClientRect();
    const surface = panel(products).getBoundingClientRect();
    const x = Math.round(trigger.left + trigger.width / 2);
    await sendMouse({ type: 'move', position: [x, Math.round(list.bottom + 10)] });
    await sendMouse({ type: 'move', position: [x, Math.round(list.bottom + 30)] });
    await sendMouse({ type: 'move', position: [Math.round(surface.left + 10), Math.round(surface.top + 10)] });
    // wait-reason: negative assertion, the panel must stay open while the pointer crosses the hover bridge
    await aTimeout(100);
    expect(products.open).to.equal(true);
  });

  it('keeps a hover-opened panel open while focus is inside it', async () => {
    const menu = await menuFixture(
      html`<lr-navigation-menu show-delay="0" hide-delay="0">${items()}</lr-navigation-menu>`,
    );
    const products = item(menu, 'products');
    hoverSynthetic(products);
    await waitPlaced(products);
    menu.querySelector<HTMLElement>('#products-a')!.focus();
    leaveSynthetic(products);
    // wait-reason: negative assertion, leaving must not close a panel that holds focus
    await aTimeout(100);
    expect(products.open).to.equal(true);
  });

  it('does not switch away from a panel that holds focus', async () => {
    const menu = await menuFixture(html`<lr-navigation-menu>${items()}</lr-navigation-menu>`);
    const products = item(menu, 'products');
    const resources = item(menu, 'resources');
    base(products).click();
    await waitPlaced(products);
    menu.querySelector<HTMLElement>('#products-a')!.focus();
    await hoverUntilMatched(base(resources), 'pointer never reached resources');
    // wait-reason: negative assertion, hover must not switch away from a focused panel
    await aTimeout(350);
    expect(products.open).to.equal(true);
    expect(resources.open).to.equal(false);
    expect(deepActive()?.id).to.equal('products-a');
  });

  it('never opens on a touch pointerover', async () => {
    const menu = await menuFixture(
      html`<lr-navigation-menu show-delay="0">${items()}</lr-navigation-menu>`,
    );
    const products = item(menu, 'products');
    pointer(base(products), 'pointerover', { pointerType: 'touch' });
    pointer(base(products), 'pointerover', { pointerType: 'pen' });
    // wait-reason: negative assertion, touch and pen pointerover must never open
    await aTimeout(50);
    expect(products.open).to.equal(false);
  });

  it('opens immediately inside the skip-delay window and not after it', async () => {
    const menu = await menuFixture(
      html`<lr-navigation-menu show-delay="400" hide-delay="0">${items()}</lr-navigation-menu>`,
    );
    const products = item(menu, 'products');
    const resources = item(menu, 'resources');
    hoverSynthetic(products);
    await waitUntil(() => products.open, 'first hover never opened');
    leaveSynthetic(products);
    expect(products.open).to.equal(false);
    // wait-reason: real timing semantics, stay inside the skip-delay grace window
    await aTimeout(50);
    hoverSynthetic(resources);
    expect(resources.open, 'a hover inside the grace window waited').to.equal(true);
    leaveSynthetic(resources);
    // wait-reason: real timing semantics, skip-delay grace window
    await aTimeout(500);
    hoverSynthetic(products);
    // wait-reason: negative assertion, a hover after the grace window must not open early
    await aTimeout(100);
    expect(products.open, 'a hover after the grace window opened early').to.equal(false);
    leaveSynthetic(products);

    menu.skipDelay = 0;
    await settle(menu);
    hoverSynthetic(products);
    await waitUntil(() => products.open, 'hover never opened');
    leaveSynthetic(products);
    hoverSynthetic(resources);
    // wait-reason: negative assertion, skip-delay=0 must not skip the show delay
    await aTimeout(100);
    expect(resources.open, 'skip-delay=0 still skipped the delay').to.equal(false);
  });
});

describe('<lr-navigation-menu> dismissal', () => {
  it('light-dismisses on an outside press without moving focus, but not on another trigger', async () => {
    const container = await fixture<HTMLElement>(html`
      <div>
        <lr-navigation-menu>${items()}</lr-navigation-menu>
        <div id="outside" style="block-size: 40px">Outside</div>
      </div>
    `);
    const menu = container.querySelector<LyraNavigationMenu>('lr-navigation-menu')!;
    await settle(menu);
    const products = item(menu, 'products');
    base(products).focus();
    base(products).click();
    await waitPlaced(products);
    pointer(base(item(menu, 'resources')), 'pointerdown');
    pointer(document.body, 'pointerup');
    // wait-reason: negative assertion, a press on another trigger must not light-dismiss
    await aTimeout(10);
    expect(products.open, 'a press on another trigger light-dismissed').to.equal(true);
    pointer(container.querySelector('#outside')!, 'pointerdown');
    await settle(menu);
    expect(products.open).to.equal(false);
    expect(activePart(products)).to.contain('base');
  });

  it('closes on a plain-button press and on a press in the list gap', async () => {
    const menu = await menuFixture(html`
      <lr-navigation-menu style="--lr-navigation-menu-gap: 4rem">
        ${items()}
        <lr-navigation-menu-item id="plain">Sign in</lr-navigation-menu-item>
      </lr-navigation-menu>
    `);
    const products = item(menu, 'products');
    const events = recordToggles(menu);
    base(products).click();
    await waitPlaced(products);
    await clickAt(base(item(menu, 'plain')));
    await settle(menu);
    expect(products.open).to.equal(false);
    expect(base(products).getAttribute('aria-expanded')).to.equal('false');
    expect(events.at(-1)).to.deep.equal({ id: 'products', expanded: false, source: 'user' });

    base(products).click();
    await waitPlaced(products);
    const first = base(products).getBoundingClientRect();
    const second = base(item(menu, 'resources')).getBoundingClientRect();
    const gapX = Math.round((first.right + second.left) / 2);
    const gapY = Math.round(first.top + first.height / 2);
    await sendMouse({ type: 'move', position: [gapX, gapY] });
    await sendMouse({ type: 'down' });
    await sendMouse({ type: 'up' });
    await settle(menu);
    expect(products.open).to.equal(false);
    expect(events.at(-1)).to.deep.equal({ id: 'products', expanded: false, source: 'user' });
  });

  it('lets a nested popover close first on an outside press', async () => {
    const menu = await menuFixture(html`
      <lr-navigation-menu>
        <lr-navigation-menu-item id="products"
          >Products<div slot="panel">
            <lr-popover id="nested"
              ><button slot="trigger" id="nested-trigger">More</button>
              <p>Nested content</p></lr-popover
            >
          </div></lr-navigation-menu-item
        >
      </lr-navigation-menu>
    `);
    const products = item(menu, 'products');
    base(products).click();
    await waitPlaced(products);
    const nested = menu.querySelector<LyraPopover>('#nested')!;
    await clickAt(menu.querySelector('#nested-trigger')!);
    await waitUntil(() => nested.open, 'nested popover never opened');
    await sendMouse({ type: 'click', position: farPoint() });
    await waitUntil(() => !nested.open, 'nested popover did not close');
    await settle(menu);
    expect(products.open, 'the panel closed together with the nested popover').to.equal(true);
    await sendMouse({ type: 'click', position: farPoint() });
    await waitUntil(() => !products.open, 'second outside press did not close the panel');
  });

  it('suppresses the focus-leaving close during a press inside the menu', async () => {
    const menu = await menuFixture(html`<lr-navigation-menu>${items()}</lr-navigation-menu>`);
    const products = item(menu, 'products');
    const resources = item(menu, 'resources');
    const events = recordToggles(menu);
    base(products).click();
    await waitPlaced(products);
    menu.querySelector<HTMLElement>('#products-a')!.focus();
    await clickAt(base(resources));
    await settle(menu);
    await nextFrame();
    expect(resources.open).to.equal(true);
    expect(events.filter((event) => event.id === 'products').at(-1)).to.deep.equal({
      id: 'products',
      expanded: false,
      source: 'peer',
    });

    base(products).click();
    await waitPlaced(products);
    const inside = menu.querySelector<HTMLElement>('#products-b')!;
    inside.focus();
    pointer(inside, 'pointerdown');
    pointer(document.body, 'pointercancel');
    // wait-reason: negative assertion, pointercancel must not close the panel
    await aTimeout(10);
    expect(products.open).to.equal(true);
    await sendKeys({ press: 'Tab' });
    await settle(menu);
    expect(products.open, 'Tab away after pointercancel did not close').to.equal(false);
  });

  it('closes one task after a press that left focus outside the open item without a click', async function () {
    // WebKit never focuses a button on press, so focus stays inside the panel and the spec keeps it
    // open there; the release path under test needs focus to land on the pressed control.
    if (isWebKit) this.skip();
    const menu = await menuFixture(html`<lr-navigation-menu>${items()}</lr-navigation-menu>`);
    const products = item(menu, 'products');
    base(products).click();
    await waitPlaced(products);
    // Focus inside the panel stops the hover switch, so the press is the only thing that happens.
    menu.querySelector<HTMLElement>('#products-a')!.focus();
    await sendMouse({ type: 'move', position: center(base(item(menu, 'resources'))) });
    await sendMouse({ type: 'down' });
    await sendMouse({ type: 'move', position: farPoint() });
    await sendMouse({ type: 'up' });
    await waitUntil(() => !products.open, 'the abandoned press never closed the panel');
    expect(item(menu, 'resources').open).to.equal(false);
  });

  it('closes on link activation, honouring modifiers and prevented router clicks', async () => {
    const menu = await menuFixture(html`<lr-navigation-menu>${items()}</lr-navigation-menu>`);
    const products = item(menu, 'products');
    const prevent = (event: Event): void => event.preventDefault();
    document.addEventListener('click', prevent, true);
    try {
      base(products).click();
      await waitPlaced(products);
      const link = menu.querySelector<HTMLAnchorElement>('#products-a')!;
      link.focus();
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, ctrlKey: true }));
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, metaKey: true }));
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, button: 1 }));
      await settle(menu);
      expect(products.open, 'a modified click closed the panel').to.equal(true);
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));
      await settle(menu);
      expect(products.open).to.equal(false);
      expect(activePart(products)).to.contain('base');
    } finally {
      document.removeEventListener('click', prevent, true);
    }
  });

  it('collapses the stacked list on link activation and focuses the toggle', async () => {
    const menu = await menuFixture(html`
      <div style="inline-size: 320px">
        <lr-navigation-menu mobile-breakpoint="40rem" expanded>${items()}</lr-navigation-menu>
      </div>
    `);
    await waitUntil(() => menu.collapsed, 'menu never collapsed');
    await settle(menu);
    const products = item(menu, 'products');
    const prevent = (event: Event): void => event.preventDefault();
    document.addEventListener('click', prevent, true);
    try {
      base(products).click();
      await settle(menu);
      const link = menu.querySelector<HTMLAnchorElement>('#products-a')!;
      link.focus();
      link.click();
      await settle(menu);
      expect(products.open).to.equal(false);
      expect(menu.expanded).to.equal(false);
      expect(menu.shadowRoot!.activeElement?.getAttribute('part')).to.equal('toggle');
    } finally {
      document.removeEventListener('click', prevent, true);
    }
  });

  it('close() repairs focus only when the close would hide it', async () => {
    const container = await fixture<HTMLElement>(html`
      <div>
        <lr-navigation-menu>${items()}</lr-navigation-menu>
        <input id="outside" aria-label="Search" />
      </div>
    `);
    const menu = container.querySelector<LyraNavigationMenu>('lr-navigation-menu')!;
    await settle(menu);
    const products = item(menu, 'products');
    base(products).click();
    await waitPlaced(products);
    menu.querySelector<HTMLElement>('#products-a')!.focus();
    menu.close();
    await settle(menu);
    expect(products.open).to.equal(false);
    expect(activePart(products)).to.contain('base');

    base(products).click();
    await waitPlaced(products);
    container.querySelector<HTMLInputElement>('#outside')!.focus();
    menu.close();
    await settle(menu);
    expect(deepActive()?.id).to.equal('outside');

    const stacked = await menuFixture(html`
      <div style="inline-size: 320px">
        <lr-navigation-menu mobile-breakpoint="40rem" expanded>${items('c-')}</lr-navigation-menu>
      </div>
    `);
    await waitUntil(() => stacked.collapsed, 'menu never collapsed');
    await settle(stacked);
    base(item(stacked, 'c-docs')).focus();
    stacked.close();
    await settle(stacked);
    expect(stacked.expanded).to.equal(false);
    expect(stacked.shadowRoot!.activeElement?.getAttribute('part')).to.equal('toggle');
  });

  it('leaves focus and an unrelated popover alone when a hover panel closes', async () => {
    const container = await fixture<HTMLElement>(html`
      <div>
        <lr-navigation-menu show-delay="0" hide-delay="0">${items()}</lr-navigation-menu>
        <lr-popover id="page-popover"
          ><button slot="trigger" id="page-trigger">Account</button><button>Sign out</button></lr-popover
        >
        <input id="outside" aria-label="Search" />
      </div>
    `);
    const menu = container.querySelector<LyraNavigationMenu>('lr-navigation-menu')!;
    await settle(menu);
    const popover = container.querySelector<LyraPopover>('#page-popover')!;
    container.querySelector<HTMLElement>('#page-trigger')!.click();
    await waitUntil(() => popover.open, 'page popover never opened');
    container.querySelector<HTMLInputElement>('#outside')!.focus();
    const products = item(menu, 'products');
    hoverSynthetic(products);
    await waitPlaced(products);
    leaveSynthetic(products);
    await settle(menu);
    expect(products.open).to.equal(false);
    expect(deepActive()?.id).to.equal('outside');
    expect(popover.open).to.equal(true);
  });
});

describe('<lr-navigation-menu> positioning and indicator', () => {
  it('anchors every panel to the list start edge, and to its end edge under RTL', async () => {
    const menu = await menuFixture(html`<lr-navigation-menu>${items()}</lr-navigation-menu>`);
    const list = part(menu, 'list')!;
    for (const id of ['products', 'resources']) {
      const target = item(menu, id);
      target.open = true;
      await waitPlaced(target);
      await waitUntil(
        () => Math.abs(panel(target).getBoundingClientRect().left - list.getBoundingClientRect().left) <= 1,
        `${id} panel is not aligned with the list start`,
      );
    }
    const rtl = await menuFixture(html`<lr-navigation-menu dir="rtl">${items('r-')}</lr-navigation-menu>`);
    const rtlList = part(rtl, 'list')!;
    const resources = item(rtl, 'r-resources');
    resources.open = true;
    await waitPlaced(resources);
    await waitUntil(
      () => Math.abs(panel(resources).getBoundingClientRect().right - rtlList.getBoundingClientRect().right) <= 1,
      'RTL panel is not aligned with the list end',
    );
  });

  it('anchors to the trigger with panel-anchor=item and normalizes unsupported writes', async () => {
    const menu = await menuFixture(
      html`<lr-navigation-menu panel-anchor="item">${items()}</lr-navigation-menu>`,
    );
    const resources = item(menu, 'resources');
    resources.open = true;
    await waitPlaced(resources);
    await waitUntil(
      () => Math.abs(panel(resources).getBoundingClientRect().left - base(resources).getBoundingClientRect().left) <= 1,
      'panel is not aligned with its trigger',
    );
    (menu as unknown as { panelAnchor: string }).panelAnchor = 'banana';
    await settle(menu);
    expect(menu.panelAnchor).to.equal('menu');
    expect(menu.getAttribute('panel-anchor')).to.equal('menu');
  });

  it('escapes an overflow:hidden ancestor with the default fixed strategy', async () => {
    const menu = await menuFixture(html`
      <div style="overflow: hidden; block-size: 3.5rem">
        <lr-navigation-menu>${items()}</lr-navigation-menu>
      </div>
    `);
    const products = item(menu, 'products');
    products.open = true;
    await waitPlaced(products);
    const [x, y] = center(panel(products));
    const hit = document.elementFromPoint(x, y);
    expect(hit !== null && (hit === products || products.contains(hit))).to.equal(true);
  });

  it('honours an inherited --lr-positioning-strategy', async () => {
    const menu = await menuFixture(html`
      <div style="--lr-positioning-strategy: absolute">
        <lr-navigation-menu>${items()}</lr-navigation-menu>
      </div>
    `);
    const products = item(menu, 'products');
    products.open = true;
    await waitPlaced(products);
    expect(panel(products).style.position).to.equal('absolute');
  });

  it('keeps unset defaults unchanged', async () => {
    const menu = await menuFixture(html`
      <div style="inline-size: 320px"><lr-navigation-menu>${items()}</lr-navigation-menu></div>
    `);
    // wait-reason: negative assertion, no indicator may render under unset defaults
    await aTimeout(50);
    expect(part(menu, 'indicator') === null).to.equal(true);
    expect(menu.panelAnchor).to.equal('menu');
    expect(menu.indicator).to.equal(false);
    expect(menu.expanded).to.equal(false);
    expect(menu.mobileBreakpoint).to.equal(undefined);
    expect(menu.collapsed).to.equal(false);
    expect(part(menu, 'toggle') === null).to.equal(true);
    const list = part(menu, 'list')!;
    expect(list.scrollWidth).to.be.at.most(list.clientWidth + 1);
    expect([menu.showDelay, menu.hideDelay, menu.skipDelay, menu.distance]).to.deep.equal([200, 150, 300, 6]);
    const products = item(menu, 'products');
    products.open = true;
    await waitPlaced(products);
    const gap = panel(products).getBoundingClientRect().top - list.getBoundingClientRect().bottom;
    expect(Math.abs(gap - 6)).to.be.at.most(1);
  });

  it('guards every numeric property against junk', async () => {
    for (const value of ['banana', 'NaN', '-1', 'Infinity']) {
      const attributeMenu = await menuFixture(
        html`<lr-navigation-menu distance=${value}>${items(`d${value.length}-`)}</lr-navigation-menu>`,
      );
      const propertyMenu = await menuFixture(html`<lr-navigation-menu>${items(`q${value.length}-`)}</lr-navigation-menu>`);
      propertyMenu.distance = Number(value);
      await settle(propertyMenu);
      for (const menu of [attributeMenu, propertyMenu]) {
        const target = itemsOf(menu)[0]!;
        target.open = true;
        await waitPlaced(target);
        const expected = value === '-1' ? 0 : 6;
        await waitUntil(() => {
          const gap = panel(target).getBoundingClientRect().top - part(menu, 'list')!.getBoundingClientRect().bottom;
          return Math.abs(gap - expected) <= 1;
        }, `distance=${value} did not resolve to ${expected}px`);
        target.open = false;
        await settle(menu);
      }
    }
    for (const value of ['banana', 'NaN', 'Infinity', '-1']) {
      const attributeMenu = await menuFixture(
        html`<lr-navigation-menu show-delay=${value} skip-delay="0">${items(`s${value.length}-`)}</lr-navigation-menu>`,
      );
      const propertyMenu = await menuFixture(
        html`<lr-navigation-menu skip-delay="0">${items(`t${value.length}-`)}</lr-navigation-menu>`,
      );
      propertyMenu.showDelay = (value === 'banana' ? value : Number(value)) as unknown as number;
      await settle(propertyMenu);
      for (const target of [itemsOf(attributeMenu)[0]!, itemsOf(propertyMenu)[0]!]) {
        hoverSynthetic(target);
        if (value === '-1') {
          expect(target.open, 'show-delay=-1 did not behave like 0').to.equal(true);
        } else {
          // wait-reason: negative assertion, the hover must not open before the invalid show-delay falls back to the default
          await aTimeout(50);
          expect(target.open, `show-delay=${value} did not behave like the default`).to.equal(false);
          await waitUntil(() => target.open, `show-delay=${value} never opened`);
        }
      }
    }
    for (const value of ['banana', 'NaN', 'Infinity']) {
      const menu = await menuFixture(
        html`<lr-navigation-menu show-delay="0" hide-delay=${value} skip-delay=${value}>${items(`h${value.length}-`)}</lr-navigation-menu>`,
      );
      const [first, second] = itemsOf(menu);
      hoverSynthetic(first!);
      expect(first!.open).to.equal(true);
      leaveSynthetic(first!);
      // wait-reason: negative assertion, an invalid hide-delay must not close before the default delay
      await aTimeout(50);
      expect(first!.open, `hide-delay=${value} did not behave like the default`).to.equal(true);
      await waitUntil(() => !first!.open, `hide-delay=${value} never closed`);
      menu.showDelay = 400;
      await settle(menu);
      hoverSynthetic(second!);
      expect(second!.open, `skip-delay=${value} did not behave like the default`).to.equal(true);
    }
  });

  it('tracks the open trigger with the indicator, in both directions', async () => {
    const menu = await menuFixture(html`<lr-navigation-menu indicator>${items()}</lr-navigation-menu>`);
    const indicator = part(menu, 'indicator')!;
    expect(indicator.getAttribute('aria-hidden')).to.equal('true');
    expect(Number(getComputedStyle(indicator).opacity)).to.equal(0);
    for (const id of ['products', 'resources']) {
      const target = item(menu, id);
      base(target).click();
      await waitPlaced(target);
      await waitUntil(() => {
        const rect = indicator.getBoundingClientRect();
        const trigger = base(target).getBoundingClientRect();
        return (
          Math.abs(rect.left - trigger.left) <= 1 &&
          Math.abs(rect.width - trigger.width) <= 1 &&
          Number(getComputedStyle(indicator).opacity) === 1
        );
      }, `indicator did not follow ${id}`);
    }
    const rtl = await menuFixture(html`<lr-navigation-menu indicator dir="rtl">${items('r-')}</lr-navigation-menu>`);
    const rtlIndicator = part(rtl, 'indicator')!;
    const resources = item(rtl, 'r-resources');
    resources.open = true;
    await waitPlaced(resources);
    await waitUntil(() => {
      const rect = rtlIndicator.getBoundingClientRect();
      const trigger = base(resources).getBoundingClientRect();
      return Math.abs(rect.right - trigger.right) <= 1 && Math.abs(rect.width - trigger.width) <= 1;
    }, 'RTL indicator did not match its trigger');
  });

  for (const direction of ['ltr', 'rtl'] as const) {
    it(`keeps the indicator aligned when a preceding sibling resizes in ${direction}`, async () => {
      const menu = await menuFixture(html`<lr-navigation-menu indicator dir=${direction}
        style="inline-size: 900px">${items()}</lr-navigation-menu>`);
      const preceding = item(menu, 'products');
      const target = item(menu, 'resources');
      const indicator = part(menu, 'indicator')!;
      const list = part(menu, 'list')!;
      target.open = true;
      await waitPlaced(target);
      const aligned = (): boolean => {
        const actual = indicator.getBoundingClientRect();
        const trigger = base(target).getBoundingClientRect();
        return Math.abs(actual.left - trigger.left) <= 1 && Math.abs(actual.width - trigger.width) <= 1;
      };
      await waitUntil(aligned, 'the initial indicator did not align');
      await nextFrame();
      await nextFrame();
      const previousTrigger = base(target).getBoundingClientRect();
      const previousList = list.getBoundingClientRect();
      const previousHost = menu.getBoundingClientRect();
      const previousTarget = target.getBoundingClientRect();

      preceding.style.inlineSize = `${preceding.getBoundingClientRect().width + 70}px`;
      await waitUntil(() => Math.abs(base(target).getBoundingClientRect().left - previousTrigger.left) > 32,
        'the sibling resize did not move the open trigger');
      // None of the previously observed boxes resized: only a sibling reports this movement.
      for (const [element, previous] of [[menu, previousHost], [list, previousList], [target, previousTarget]] as const) {
        const current = element.getBoundingClientRect();
        expect(current.width).to.be.closeTo(previous.width, 1);
        expect(current.height).to.be.closeTo(previous.height, 1);
      }
      await waitUntil(aligned, 'the indicator kept the offset from before its sibling resized');
    });
  }
});

describe('<lr-navigation-menu> motion', () => {
  it('animates a switch between panels', async () => {
    const menu = await menuFixture(html`<lr-navigation-menu>${items()}</lr-navigation-menu>`);
    const products = item(menu, 'products');
    const resources = item(menu, 'resources');
    base(products).click();
    await waitPlaced(products);
    await waitUntil(() => [panel(products), content(products)].every((element) => element.getAnimations().every((animation) => animation.playState === 'finished')), 'the show animation never finished');
    base(resources).click();
    await waitUntil(
      () => [panel(resources), content(resources)].some((element) => element.getAnimations().length > 0),
      'a switch ran no animation or transition',
    );
  });

  it('flattens motion under reduced motion', async () => {
    await setReducedMotion('reduce');
    try {
      // WebKit applies the emulated preference on the next rendering update.
      await nextFrame();
      const menu = await menuFixture(html`<lr-navigation-menu indicator>${items()}</lr-navigation-menu>`);
      const products = item(menu, 'products');
      const resources = item(menu, 'resources');
      const caret = products.shadowRoot!.querySelector<HTMLElement>('[part~="expand-icon"]')!;
      const flattened = (element: Element): boolean =>
        parseTimes(getComputedStyle(element).transitionDuration).every((duration) => duration <= 0.001);
      // WebKit does not re-evaluate the token sheet's media rule for a constructed stylesheet that
      // an earlier test already adopted, so an emulated preference change never reaches the shared
      // duration tokens there. The script-driven assertions below still run on every engine.
      const tokensCollapsed =
        getComputedStyle(menu).getPropertyValue('--lr-duration-base').trim() === '0.001ms';
      if (tokensCollapsed || !isWebKit) {
        await waitUntil(() => flattened(caret), `caret transition ${getComputedStyle(caret).transitionDuration}`);
        await waitUntil(() => flattened(part(menu, 'indicator')!), 'indicator transition was not flattened');
      }
      base(products).click();
      await waitPlaced(products);
      base(resources).click();
      await waitPlaced(resources);
      // wait-reason: negative assertion, no inline size may be set after the switch
      await aTimeout(50);
      expect(panel(resources).style.inlineSize).to.equal('');
      expect(panel(resources).style.blockSize).to.equal('');
      for (const element of [panel(resources), content(resources)]) {
        for (const animation of element.getAnimations()) {
          const duration = Number(animation.effect?.getComputedTiming().duration ?? 0);
          expect(duration).to.be.at.most(1);
        }
      }
      const collapsed = await menuFixture(html`
        <div style="inline-size: 320px">
          <lr-navigation-menu mobile-breakpoint="40rem">${items('m-')}</lr-navigation-menu>
        </div>
      `);
      await waitUntil(() => part(collapsed, 'toggle') !== null, 'toggle never rendered');
      if (tokensCollapsed || !isWebKit) {
        await waitUntil(() => flattened(part(collapsed, 'toggle')!), 'toggle transition was not flattened');
      }
    } finally {
      await setReducedMotion('no-preference');
    }
  });

  it('times the resize from the duration token alone', async () => {
    const menu = await menuFixture(html`
      <div data-lr-theme-scope style="--lr-theme-duration-normal: 400ms">
        <lr-navigation-menu>${items()}</lr-navigation-menu>
      </div>
    `);
    const products = item(menu, 'products');
    const resources = item(menu, 'resources');
    base(products).click();
    await waitPlaced(products);
    await waitUntil(() => [panel(products), content(products)].every((element) => element.getAnimations().every((animation) => animation.playState === 'finished')), 'the show animation never finished');
    base(resources).click();
    await waitUntil(() => panel(resources).style.inlineSize !== '', 'the resize never started');
    // wait-reason: real timing semantics, the resize must still be running within the token duration
    await aTimeout(150);
    expect(panel(resources).style.inlineSize, 'the resize ended before the token duration').to.not.equal('');
    await waitUntil(() => panel(resources).style.inlineSize === '', 'the resize never cleaned up', {
      timeout: 800,
    });
    expect(panel(resources).hasAttribute('data-morphing')).to.equal(false);
  });

  it('opens with no animation when the show animation is disabled, and still announces', async () => {
    const menu = await menuFixture(html`<lr-navigation-menu>${items()}</lr-navigation-menu>`);
    const release = setAnimation(menu, 'navigation-menu.show', null);
    try {
      const products = item(menu, 'products');
      const events = recordToggles(menu);
      base(products).click();
      await waitPlaced(products);
      // wait-reason: negative assertion, no animation may run when show is disabled
      await aTimeout(20);
      expect(panel(products).getAnimations().length).to.equal(0);
      expect(events).to.deep.equal([{ id: 'products', expanded: true, source: 'user' }]);
    } finally {
      release();
    }
  });
});

describe('<lr-navigation-menu> collapse', () => {
  it('collapses at or below the breakpoint with a named toggle controlling the hidden list', async () => {
    const menu = await menuFixture(html`
      <div style="inline-size: 320px">
        <lr-navigation-menu mobile-breakpoint="40rem">${items()}</lr-navigation-menu>
      </div>
    `);
    await waitUntil(() => menu.collapsed, 'menu never collapsed');
    await settle(menu);
    if (CSS.supports('selector(:state(collapsed))')) {
      expect(menu.matches(':state(collapsed)')).to.equal(true);
    }
    const toggle = part(menu, 'toggle')!;
    const list = part(menu, 'list')!;
    expect(toggle.getAttribute('aria-expanded')).to.equal('false');
    expect(toggle.getAttribute('aria-controls')).to.equal(list.id);
    expect(list.hidden).to.equal(true);
    expect(toggle.hasAttribute('aria-haspopup')).to.equal(false);
  });

  it('treats a content box equal to the breakpoint as collapsed', async () => {
    const exact = await menuFixture(html`
      <div style="inline-size: 400px"><lr-navigation-menu mobile-breakpoint="400px">${items()}</lr-navigation-menu></div>
    `);
    await waitUntil(() => exact.collapsed, 'an equal allocation did not collapse');
    const wider = await menuFixture(html`
      <div style="inline-size: 401px"><lr-navigation-menu mobile-breakpoint="400px">${items('w-')}</lr-navigation-menu></div>
    `);
    // wait-reason: negative assertion, a wider allocation must not collapse
    await aTimeout(50);
    expect(wider.collapsed).to.equal(false);
  });

  it('expands from the toggle into full-width in-flow items that ignore hover', async () => {
    const menu = await menuFixture(html`
      <div style="inline-size: 320px">
        <lr-navigation-menu mobile-breakpoint="40rem" show-delay="0">${items()}</lr-navigation-menu>
      </div>
    `);
    await waitUntil(() => part(menu, 'toggle') !== null, 'toggle never rendered');
    const expanded = recordExpanded(menu);
    const ownToggles: string[] = [];
    menu.addEventListener('lr-toggle', (event) => {
      if (event.target === menu) ownToggles.push('menu');
    });
    part(menu, 'toggle')!.click();
    await settle(menu);
    expect(expanded).to.deep.equal([{ expanded: true, source: 'user' }]);
    expect(ownToggles).to.have.length(1);
    expect(part(menu, 'toggle')!.getAttribute('aria-expanded')).to.equal('true');
    const listWidth = part(menu, 'list')!.getBoundingClientRect().width;
    for (const entry of itemsOf(menu)) {
      expect(Math.abs(entry.getBoundingClientRect().width - listWidth)).to.be.at.most(1);
      // The control itself fills the row, not just its host.
      expect(Math.abs(base(entry).getBoundingClientRect().width - listWidth)).to.be.at.most(1);
    }
    const products = item(menu, 'products');
    const caret = products.shadowRoot!.querySelector('[part="expand-icon"]')!.getBoundingClientRect();
    const productsBase = base(products).getBoundingClientRect();
    expect(Math.abs(productsBase.right - caret.right)).to.be.at.most(
      Number.parseFloat(getComputedStyle(base(products)).paddingInlineEnd) + 1,
    );
    base(products).click();
    await settle(menu);
    expect(getComputedStyle(panel(products)).position).to.equal('static');
    const resources = item(menu, 'resources');
    hoverSynthetic(resources);
    // wait-reason: negative assertion, hover must not open an item in collapsed mode
    await aTimeout(30);
    expect(resources.open).to.equal(false);
  });

  it('vetoes the canonical list toggle request without suppressing child item toggle events', async () => {
    const menu = await menuFixture(html`<div style="inline-size: 320px"><lr-navigation-menu mobile-breakpoint="40rem" show-delay="0">${items()}</lr-navigation-menu></div>`);
    await waitUntil(() => part(menu, 'toggle') !== null);
    let requests = 0;
    menu.addEventListener('lr-toggle-request', (event) => {
      if (event.target !== menu) return;
      requests += 1;
      event.preventDefault();
    });
    part(menu, 'toggle')!.click();
    await settle(menu);
    expect(menu.expanded).to.equal(false);
    expect(requests).to.equal(1);
    menu.show();
    await settle(menu);
    expect(menu.expanded).to.equal(true);
    menu.hide();
    await settle(menu);
    expect(menu.expanded).to.equal(false);
  });

  it('respects identical host writes and drops superseded queued toggle notifications', async () => {
    const menu = await menuFixture(html`<div style="inline-size: 320px"><lr-navigation-menu mobile-breakpoint="40rem">${items()}</lr-navigation-menu></div>`);
    await waitUntil(() => part(menu, 'toggle') !== null);
    const accepted: boolean[] = [];
    menu.addEventListener('lr-toggle', (event) => {
      if (event.target === menu) accepted.push((event as CustomEvent<{ expanded: boolean }>).detail.expanded);
    });
    const resolve = () => { menu.expanded = false; };
    menu.addEventListener('lr-toggle-request', resolve);
    part(menu, 'toggle')!.click();
    await settle(menu);
    expect(menu.expanded).to.equal(false);
    expect(accepted).to.deep.equal([]);
    menu.removeEventListener('lr-toggle-request', resolve);
    menu.show();
    menu.hide();
    await settle(menu);
    expect(menu.expanded).to.equal(false);
    expect(accepted).to.deep.equal([false]);
  });

  it('closes and repairs focus when the allocation crosses the breakpoint both ways', async () => {
    const container = await fixture<HTMLElement>(html`
      <div style="inline-size: 800px">
        <lr-navigation-menu mobile-breakpoint="40rem">${items()}</lr-navigation-menu>
      </div>
    `);
    const menu = container.querySelector<LyraNavigationMenu>('lr-navigation-menu')!;
    await settle(menu);
    const products = item(menu, 'products');
    const events = recordToggles(menu);
    const expanded = recordExpanded(menu);
    base(products).click();
    await waitPlaced(products);
    menu.querySelector<HTMLElement>('#products-a')!.focus();
    container.style.inlineSize = '320px';
    await waitUntil(() => menu.collapsed, 'never collapsed');
    await settle(menu);
    expect(products.open).to.equal(false);
    expect(events.at(-1)).to.deep.equal({ id: 'products', expanded: false, source: 'programmatic' });
    expect(menu.shadowRoot!.activeElement?.getAttribute('part')).to.equal('toggle');
    part(menu, 'toggle')!.click();
    await settle(menu);
    expect(menu.expanded).to.equal(true);
    container.style.inlineSize = '800px';
    await waitUntil(() => !menu.collapsed, 'never uncollapsed');
    await settle(menu);
    expect(part(menu, 'toggle') === null).to.equal(true);
    expect(activePart(products)).to.contain('base');
    expect(menu.expanded).to.equal(false);
    expect(expanded).to.deep.equal([
      { expanded: true, source: 'user' },
      { expanded: false, source: 'programmatic' },
    ]);
  });

  it('never collapses with an unresolvable breakpoint', async () => {
    const menu = await menuFixture(html`
      <div style="inline-size: 320px">
        <lr-navigation-menu mobile-breakpoint="banana">${items()}</lr-navigation-menu>
      </div>
    `);
    // wait-reason: negative assertion, an unresolvable breakpoint must not collapse
    await aTimeout(50);
    expect(menu.collapsed).to.equal(false);
    expect(part(menu, 'toggle') === null).to.equal(true);
  });

  it('does not latch collapsed inside a space-between flex header', async () => {
    const header = await fixture<HTMLElement>(html`
      <header style="display: flex; justify-content: space-between; inline-size: 900px">
        <span>Logo</span>
        <lr-navigation-menu mobile-breakpoint="30rem">${items()}</lr-navigation-menu>
        <span>Actions</span>
      </header>
    `);
    const menu = header.querySelector<LyraNavigationMenu>('lr-navigation-menu')!;
    await settle(menu);
    // wait-reason: negative assertion, a wide header must not collapse
    await aTimeout(30);
    expect(menu.collapsed).to.equal(false);
    header.style.inlineSize = '400px';
    await waitUntil(() => menu.collapsed, 'narrow header did not collapse');
    header.style.inlineSize = '900px';
    await waitUntil(() => !menu.collapsed, 'the collapsed menu latched');
    await settle(menu);
    expect(part(menu, 'toggle') === null).to.equal(true);
  });

  it('handles stacked Escape from the open panel first, then the list', async () => {
    const menu = await menuFixture(html`
      <div style="inline-size: 320px">
        <lr-navigation-menu mobile-breakpoint="40rem" expanded>${items()}</lr-navigation-menu>
      </div>
    `);
    await waitUntil(() => menu.collapsed, 'menu never collapsed');
    await settle(menu);
    const products = item(menu, 'products');
    base(products).click();
    await settle(menu);
    menu.querySelector<HTMLElement>('#products-a')!.focus();
    await sendKeys({ press: 'Escape' });
    await settle(menu);
    expect(products.open).to.equal(false);
    expect(menu.expanded).to.equal(true);
    expect(activePart(products)).to.contain('base');
    await sendKeys({ press: 'Escape' });
    await settle(menu);
    expect(menu.expanded).to.equal(false);
    expect(menu.shadowRoot!.activeElement?.getAttribute('part')).to.equal('toggle');
  });

  it('renders the English toggle label and honours a strings override', async () => {
    const menu = await menuFixture(html`
      <div style="inline-size: 320px">
        <lr-navigation-menu mobile-breakpoint="40rem">${items()}</lr-navigation-menu>
      </div>
    `);
    await waitUntil(() => part(menu, 'toggle-label') !== null, 'toggle never rendered');
    expect(part(menu, 'toggle-label')!.textContent?.trim()).to.equal('Menu');
    menu.strings = { menuLabel: 'Sections' };
    await settle(menu);
    expect(part(menu, 'toggle-label')!.textContent?.trim()).to.equal('Sections');
  });
});

describe('<lr-navigation-menu> lifecycle', () => {
  it('re-measures after the root is re-appended and tolerates later document presses', async () => {
    const container = await fixture<HTMLElement>(html`
      <div style="inline-size: 320px">
        <lr-navigation-menu mobile-breakpoint="40rem">${items()}</lr-navigation-menu>
      </div>
    `);
    const menu = container.querySelector<LyraNavigationMenu>('lr-navigation-menu')!;
    await waitUntil(() => menu.collapsed, 'never collapsed');
    menu.remove();
    container.style.inlineSize = '800px';
    container.append(menu);
    await waitUntil(() => !menu.collapsed, 'did not re-measure after re-append');
    const errors: string[] = [];
    const onError = (event: ErrorEvent): void => {
      errors.push(event.message);
    };
    window.addEventListener('error', onError);
    try {
      pointer(document.body, 'pointerdown');
      pointer(document.body, 'pointerup');
      // wait-reason: negative assertion, no error may be raised by the pointer events
      await aTimeout(10);
    } finally {
      window.removeEventListener('error', onError);
    }
    expect(errors).to.deep.equal([]);
  });

  it('drops a hover open across a detach but keeps a pinned one', async () => {
    const menu = await menuFixture(
      html`<lr-navigation-menu show-delay="0" hide-delay="0">${items()}</lr-navigation-menu>`,
    );
    const products = item(menu, 'products');
    hoverSynthetic(products);
    await waitPlaced(products);
    const next = products.nextElementSibling;
    products.remove();
    menu.insertBefore(products, next);
    await settle(menu);
    expect(products.open).to.equal(false);
    // The dropped hover open must not linger as the menu's open item: hovering it opens it again.
    hoverSynthetic(products);
    await waitPlaced(products, 'a reattached item never hover-opened again');
    leaveSynthetic(products);
    await waitUntil(() => !products.open, 'the re-hovered panel never closed on leave');

    base(products).click();
    await waitPlaced(products);
    products.remove();
    await nextFrame();
    menu.insertBefore(products, next);
    await settle(menu);
    expect(products.open).to.equal(true);
    await waitPlaced(products);
    leaveSynthetic(products);
    // wait-reason: negative assertion, pointer-leave must not close a reattached panel
    await aTimeout(50);
    expect(products.open, 'pointer-leave closed a reattached panel').to.equal(true);
    base(products).click();
    await settle(menu);
    expect(products.open).to.equal(false);
    products.open = true;
    await waitPlaced(products);
    await sendKeys({ press: 'Escape' });
    await settle(menu);
    expect(products.open).to.equal(false);
  });

  it('hides the indicator when the open item is removed and navigates to appended items', async () => {
    const menu = await menuFixture(html`<lr-navigation-menu indicator>${items()}</lr-navigation-menu>`);
    const products = item(menu, 'products');
    base(products).click();
    await waitPlaced(products);
    const indicator = part(menu, 'indicator')!;
    await waitUntil(() => Number(getComputedStyle(indicator).opacity) === 1, 'indicator never showed');
    products.remove();
    await settle(menu);
    await waitUntil(() => Number(getComputedStyle(indicator).opacity) === 0, 'indicator stayed visible');
    const appended = document.createElement('lr-navigation-menu-item') as LyraNavigationMenuItem;
    appended.id = 'appended';
    appended.textContent = 'Appended';
    menu.append(appended);
    await settle(menu);
    base(item(menu, 'pricing')).focus();
    await sendKeys({ press: 'ArrowRight' });
    expect(activePart(appended)).to.contain('base');
    expect(appended.getAttribute('role')).to.equal('listitem');
  });

  it('keeps only the first open item from initial markup, silently', async () => {
    const container = await fixture<HTMLElement>(html`<div></div>`);
    const events: string[] = [];
    container.addEventListener('lr-toggle', () => events.push('toggle'));
    container.innerHTML = `
      <lr-navigation-menu>
        <lr-navigation-menu-item id="first" open>First<div slot="panel"><a href="#a">A</a></div></lr-navigation-menu-item>
        <lr-navigation-menu-item id="second" open>Second<div slot="panel"><a href="#b">B</a></div></lr-navigation-menu-item>
      </lr-navigation-menu>`;
    const menu = container.querySelector<LyraNavigationMenu>('lr-navigation-menu')!;
    await settle(menu);
    await waitPlaced(item(menu, 'first'));
    expect(item(menu, 'second').open).to.equal(false);
    expect(panel(item(menu, 'second')).hidden).to.equal(true);
    // wait-reason: negative assertion, no toggle event may fire for the repaired open items
    await aTimeout(20);
    expect(events).to.have.length(0);
  });

  it('closes an open item whose panel content is removed and repairs focus', async () => {
    const menu = await menuFixture(html`<lr-navigation-menu>${items()}</lr-navigation-menu>`);
    const products = item(menu, 'products');
    base(products).click();
    await waitPlaced(products);
    const events = recordToggles(menu);
    menu.querySelector<HTMLElement>('#products-a')!.focus();
    products.querySelector('[slot="panel"]')!.remove();
    await waitUntil(() => !products.open, 'removing the panel content did not close');
    await settle(menu);
    expect(events.at(-1)).to.deep.equal({ id: 'products', expanded: false, source: 'programmatic' });
    expect(activePart(products)).to.contain('base');
  });

  it('announces programmatic opens and closes everything from close()', async () => {
    const menu = await menuFixture(html`
      <div style="inline-size: 320px">
        <lr-navigation-menu mobile-breakpoint="40rem" expanded>${items()}</lr-navigation-menu>
      </div>
    `);
    await waitUntil(() => menu.collapsed, 'menu never collapsed');
    await settle(menu);
    const events = recordToggles(menu);
    const expanded = recordExpanded(menu);
    const products = item(menu, 'products');
    products.open = true;
    await settle(menu);
    expect(events).to.deep.equal([{ id: 'products', expanded: true, source: 'programmatic' }]);
    menu.close();
    await settle(menu);
    expect(products.open).to.equal(false);
    expect(menu.expanded).to.equal(false);
    expect(events.at(-1)).to.deep.equal({ id: 'products', expanded: false, source: 'programmatic' });
    expect(expanded).to.deep.equal([{ expanded: false, source: 'programmatic' }]);
  });
});

describe('<lr-navigation-menu> styling', () => {
  it('declares a hover state and an interactive transition on the trigger, link and toggle', async () => {
    const container = await fixture<HTMLElement>(html`
      <div data-lr-theme-scope style="--lr-theme-transition-fast: 0s linear">
        <lr-navigation-menu show-delay="100000">${items()}</lr-navigation-menu>
        <div style="inline-size: 320px">
          <lr-navigation-menu id="collapsed" mobile-breakpoint="40rem">${items('t-')}</lr-navigation-menu>
        </div>
      </div>
    `);
    const menu = container.querySelector<LyraNavigationMenu>('lr-navigation-menu')!;
    const collapsed = container.querySelector<LyraNavigationMenu>('#collapsed')!;
    await settle(menu);
    await waitUntil(() => part(collapsed, 'toggle') !== null, 'toggle never rendered');
    const targets = [base(item(menu, 'products')), base(item(menu, 'pricing')), part(collapsed, 'toggle')!];
    for (const target of targets) {
      const resting = getComputedStyle(target).backgroundColor;
      expect(getComputedStyle(target).transitionProperty).to.contain('background-color');
      await hoverUntilMatched(target, `pointer never reached ${target.getAttribute('part')}`);
      await waitUntil(
        () => getComputedStyle(target).backgroundColor !== resting,
        `${target.getAttribute('part')} has no hover background`,
      );
      await resetMouse();
    }
  });

  it('floors the owned base hit area at the icon-button size', async () => {
    const menu = await menuFixture(html`<lr-navigation-menu>${items()}</lr-navigation-menu>`);
    const probe = document.createElement('div');
    probe.style.inlineSize = 'var(--lr-icon-button-size)';
    menu.shadowRoot!.append(probe);
    const floor = probe.getBoundingClientRect().width;
    probe.remove();
    expect(floor).to.be.at.least(36);
    for (const entry of itemsOf(menu)) {
      const style = getComputedStyle(base(entry));
      expect(Number.parseFloat(style.minBlockSize)).to.be.at.least(floor - 0.5);
      expect(Number.parseFloat(style.minInlineSize)).to.be.at.least(floor - 0.5);
    }
  });

  it('keeps a non-colour current cue and a system panel edge in forced colors', async function () {
    const menu = await menuFixture(html`<lr-navigation-menu>${items()}</lr-navigation-menu>`);
    const products = item(menu, 'products');
    products.open = true;
    await waitPlaced(products);
    if (!(await enterForcedColors())) this.skip();
    try {
      await nextFrame();
      expect(getComputedStyle(base(item(menu, 'docs'))).textDecorationLine).to.contain('underline');
      const probe = document.createElement('div');
      probe.style.color = 'CanvasText';
      document.body.append(probe);
      const canvasText = getComputedStyle(probe).color;
      probe.remove();
      expect(getComputedStyle(panel(products)).borderTopColor).to.equal(canvasText);
    } finally {
      await setForcedColors('none');
    }
  });

  it('paints the floating panel with the dark overlay surface', async () => {
    const menu = await menuFixture(html`
      <lr-navigation-menu>
        <lr-navigation-menu-item id="dark" data-lr-theme="dark"
          >Dark<div slot="panel"><a href="#a">A</a></div></lr-navigation-menu-item
        >
      </lr-navigation-menu>
    `);
    const dark = item(menu, 'dark');
    dark.open = true;
    await waitPlaced(dark);
    const probe = document.createElement('div');
    probe.style.background = 'var(--lr-color-surface-overlay)';
    dark.shadowRoot!.append(probe);
    const expected = getComputedStyle(probe).backgroundColor;
    probe.remove();
    expect(toRgba(getComputedStyle(panel(dark)).backgroundColor)).to.deep.equal(toRgba(expected));
  });
});

describe('<lr-navigation-menu> top-layer escape', () => {
  it('promotes a trapped bar panel and releases it when the bar collapses', async () => {
    const menu = await menuFixture(html`
      <div id="trap" style="transform: translateY(0); overflow: hidden; block-size: 48px; inline-size: 900px">
        <lr-navigation-menu mobile-breakpoint="40rem" expanded>${items('tl-')}</lr-navigation-menu>
      </div>
    `);
    const trap = menu.parentElement as HTMLElement;
    const products = item(menu, 'tl-products');
    base(products).click();
    await waitPlaced(products);
    await waitUntil(() => panel(products).matches(':popover-open'), 'the trapped bar panel is promoted');

    trap.style.inlineSize = '320px';
    trap.style.blockSize = 'auto';
    await waitUntil(() => menu.collapsed, 'menu never collapsed');
    await settle(menu);
    await waitUntil(() => !panel(products).matches(':popover-open'), 'crossing into flow releases the top layer');
    expect(panel(products).hasAttribute('data-lr-top-layer')).to.equal(false);
    expect(panel(products).hasAttribute('popover')).to.equal(false);

    products.open = true;
    await settle(menu);
    expect(panel(products).hidden).to.equal(false);
    expect(panel(products).matches(':popover-open'), 'a collapsed-layout panel is never promoted').to.equal(false);
    const panelRect = panel(products).getBoundingClientRect();
    const triggerRect = base(products).getBoundingClientRect();
    expect(panelRect.top, 'the panel renders in flow below its trigger').to.be.at.least(triggerRect.bottom - 1);
  });

  it('releases a promoted panel that stays open when its item leaves the menu', async () => {
    const menu = await menuFixture(html`
      <div style="transform: translateY(0); overflow: hidden; block-size: 48px; inline-size: 900px">
        <lr-navigation-menu>${items('lo-')}</lr-navigation-menu>
      </div>
    `);
    const products = item(menu, 'lo-products');
    base(products).click();
    await waitPlaced(products);
    await waitUntil(() => panel(products).matches(':popover-open'), 'the trapped bar panel is promoted');
    const outside = document.createElement('div');
    menu.parentElement!.after(outside);
    outside.append(products);
    await products.updateComplete;
    await nextFrame();
    await waitUntil(() => !panel(products).hasAttribute('data-lr-top-layer'), 'the unowned panel is released');
    expect(panel(products).matches(':popover-open')).to.equal(false);
    expect(products.open, 'the moved item keeps its panel open').to.equal(true);
    expect(panel(products).hidden).to.equal(false);
    expect(getComputedStyle(panel(products)).position, 'an unowned open panel is in flow').to.equal('static');
    outside.remove();
  });
});

describe('navigation menu label and glass foregrounds', () => {
  it('names the nav from label, with the host aria-label winning and an empty label literal', async () => {
    const labelled = await menuFixture(html`<lr-navigation-menu label="Main">${items('l-')}</lr-navigation-menu>`);
    expect(part(labelled, 'base')!.getAttribute('aria-label')).to.equal('Main');
    const empty = await menuFixture(html`<lr-navigation-menu label="">${items('m-')}</lr-navigation-menu>`);
    expect(part(empty, 'base')!.getAttribute('aria-label')).to.equal('');
    const both = await menuFixture(html`<lr-navigation-menu label="Main" aria-label="Primary">${items('b-')}</lr-navigation-menu>`);
    expect(part(both, 'base')!.getAttribute('aria-label')).to.equal('Primary');
  });

  it('qualifies bar-item hover, current and collapsed-toggle foregrounds for a glass surface', async () => {
    const menu = await menuFixture(html`
      <div data-lr-theme-scope style="inline-size: 320px; --_lr-glass-foreground-weight: 100%; --lr-theme-color-text-normal: rgb(1, 2, 3); --lr-theme-transition-fast: 0s">
        <lr-navigation-menu mobile-breakpoint="40rem">${items('g-')}</lr-navigation-menu>
      </div>
    `);
    await waitUntil(() => menu.collapsed, 'menu never collapsed');
    await settle(menu);
    const isText = (target: Element): boolean =>
      toRgba(getComputedStyle(target).color).slice(0, 3).every((channel, index) => Math.abs(channel - [1, 2, 3][index]!) <= 1);
    try {
      const toggle = part(menu, 'toggle')!;
      await hoverUntilMatched(toggle, 'the collapsed toggle receives the pointer');
      await waitUntil(() => isText(toggle), 'toggle hover foreground follows the glass token');
      menu.expanded = true;
      await settle(menu);
      const current = base(item(menu, 'g-docs'));
      await waitUntil(() => isText(current), 'the current item foreground follows the glass token');
      const pricing = base(item(menu, 'g-pricing'));
      await hoverUntilMatched(pricing, 'the item receives the pointer');
      await waitUntil(() => isText(pricing), 'item hover foreground follows the glass token');
    } finally {
      await resetMouse();
    }
  });
});
