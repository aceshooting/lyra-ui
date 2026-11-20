import { aTimeout, expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import type { TemplateResult } from 'lit';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { ignoreResizeObserverLoopErrors } from '../../../../test/resize-observer-noise.js';
import type {
  LyraNavigationMenuItem,
  LyraNavigationMenuToggleDetail,
} from '../navigation-menu-item/navigation-menu-item.class.js';
import type { LyraNavigationMenu } from './navigation-menu.class.js';
import '../../lr-navigation-menu.js';

ignoreResizeObserverLoopErrors('collapse toggles host block size');

function items(): TemplateResult {
  return html`
    <lr-navigation-menu-item id="products"
      >Products<ul slot="panel" style="inline-size: 12rem; margin: 0"
        ><li><a id="products-a" href="#analytics">Analytics</a></li
        ><li><a id="products-b" href="#billing">Billing</a></li></ul
      ></lr-navigation-menu-item
    >
    <lr-navigation-menu-item id="resources"
      >Resources<ul slot="panel" style="inline-size: 14rem; margin: 0"
        ><li><a id="resources-a" href="#guides">Guides</a></li></ul
      ></lr-navigation-menu-item
    >
    <lr-navigation-menu-item id="plain">Plain action</lr-navigation-menu-item>
    <lr-navigation-menu-item id="docs" href="#docs">Docs</lr-navigation-menu-item>
  `;
}

function item(menu: Element, id: string): LyraNavigationMenuItem {
  return menu.querySelector<LyraNavigationMenuItem>(`#${id}`)!;
}

function base(target: LyraNavigationMenuItem): HTMLElement {
  return target.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
}

function part(menu: LyraNavigationMenu, name: string): HTMLElement | null {
  return menu.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`);
}

function deepActiveId(): string {
  let active: Element | null = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active?.id || active?.getAttribute('part') || active?.localName || '';
}

async function settle(menu: LyraNavigationMenu): Promise<void> {
  await menu.updateComplete;
  for (const entry of menu.querySelectorAll<LyraNavigationMenuItem>('lr-navigation-menu-item')) {
    await entry.updateComplete;
  }
  await nextFrame();
  await menu.updateComplete;
}

async function menuFixture(template: TemplateResult): Promise<LyraNavigationMenu> {
  const root = await fixture<HTMLElement>(template);
  const menu = (root.localName === 'lr-navigation-menu'
    ? root
    : root.querySelector('lr-navigation-menu')) as LyraNavigationMenu;
  await settle(menu);
  return menu;
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

function recordToggles(menu: LyraNavigationMenu): string[] {
  const events: string[] = [];
  menu.addEventListener('lr-toggle', (event) => {
    const target = event.target as Element;
    if (target.localName !== 'lr-navigation-menu-item') return;
    const detail = (event as CustomEvent<LyraNavigationMenuToggleDetail>).detail;
    events.push(`${target.id}:${detail.expanded ? 'open' : 'close'}:${detail.source}`);
  });
  return events;
}

describe('<lr-navigation-menu> pending hover intent', () => {
  it('starts one show timer for repeated hovers over the same trigger', async () => {
    const menu = await menuFixture(
      html`<lr-navigation-menu show-delay="150" skip-delay="0">${items()}</lr-navigation-menu>`,
    );
    const products = item(menu, 'products');
    const events = recordToggles(menu);
    pointer(base(products), 'pointerover');
    // wait-reason: real timing semantics, a repeat hover partway through show-delay must not restart it
    await aTimeout(90);
    pointer(base(products), 'pointerover');
    // wait-reason: real timing semantics, the first timer's deadline passes before a restarted one would
    await aTimeout(110);
    expect(products.open, 'the repeat hover restarted the show delay').to.equal(true);
    await settle(menu);
    expect(events).to.deep.equal(['products:open:user']);
  });

  it('drops a pending hover open when another item opens programmatically first', async () => {
    const menu = await menuFixture(
      html`<lr-navigation-menu show-delay="150" skip-delay="0">${items()}</lr-navigation-menu>`,
    );
    const products = item(menu, 'products');
    const resources = item(menu, 'resources');
    pointer(base(products), 'pointerover');
    resources.open = true;
    await settle(menu);
    // wait-reason: negative assertion, the cancelled hover timer must never open its item
    await aTimeout(250);
    expect(resources.open).to.equal(true);
    expect(products.open, 'the superseded hover still opened').to.equal(false);
  });

  it('closes a hover-opened panel when the pointer reaches a plain item', async () => {
    const menu = await menuFixture(
      html`<lr-navigation-menu show-delay="0" hide-delay="0">${items()}</lr-navigation-menu>`,
    );
    const products = item(menu, 'products');
    pointer(base(products), 'pointerover');
    await waitUntil(() => products.open, 'hover never opened');
    pointer(base(item(menu, 'plain')), 'pointerover');
    await waitUntil(() => !products.open, 'hovering a plain item did not close the hover panel');
  });

  it('cancels a scheduled hover close when the panel is closed programmatically', async () => {
    const menu = await menuFixture(
      html`<lr-navigation-menu show-delay="0" hide-delay="150">${items()}</lr-navigation-menu>`,
    );
    const products = item(menu, 'products');
    const events = recordToggles(menu);
    pointer(base(products), 'pointerover');
    await waitUntil(() => products.open, 'hover never opened');
    pointer(base(products), 'pointerout', { relatedTarget: document.body });
    products.open = false;
    await settle(menu);
    products.open = true;
    await settle(menu);
    // wait-reason: negative assertion, the retired hide timer must not close the reopened panel
    await aTimeout(250);
    expect(products.open, 'a retired hide timer closed the reopened panel').to.equal(true);
    expect(events).to.deep.equal([
      'products:open:user',
      'products:close:programmatic',
      'products:open:programmatic',
    ]);
  });
});

describe('<lr-navigation-menu> keyboard edges', () => {
  it('keeps focus on the trigger when its panel closes before ArrowDown can enter it', async () => {
    const menu = await menuFixture(html`<lr-navigation-menu>${items()}</lr-navigation-menu>`);
    const products = item(menu, 'products');
    await focusByKeyboard(base(products));
    products.open = true;
    await settle(menu);
    base(products).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true, cancelable: true }),
    );
    products.open = false;
    await settle(menu);
    await nextFrame();
    expect(products.open).to.equal(false);
    expect(deepActiveId(), 'focus moved into a closed panel').to.not.equal('products-a');
  });

  it('activating a plain item closes the open panel', async () => {
    const menu = await menuFixture(html`<lr-navigation-menu>${items()}</lr-navigation-menu>`);
    const products = item(menu, 'products');
    base(products).click();
    await settle(menu);
    expect(products.open).to.equal(true);
    base(item(menu, 'plain')).click();
    await settle(menu);
    expect(products.open).to.equal(false);
  });
});

describe('<lr-navigation-menu> stacked list', () => {
  async function collapsedMenu(): Promise<LyraNavigationMenu> {
    const menu = await menuFixture(html`<div style="inline-size: 320px"
      ><lr-navigation-menu mobile-breakpoint="40rem">${items()}</lr-navigation-menu></div>`);
    await waitUntil(() => menu.collapsed && part(menu, 'toggle') !== null, 'menu never collapsed');
    await settle(menu);
    return menu;
  }

  it('collapses the list when a plain item is activated', async () => {
    const menu = await collapsedMenu();
    part(menu, 'toggle')!.click();
    await settle(menu);
    expect(menu.expanded).to.equal(true);
    base(item(menu, 'plain')).click();
    await settle(menu);
    expect(menu.expanded, 'activating a plain item left the stacked list open').to.equal(false);
  });

  it('ignores Escape on the toggle while the list is already collapsed', async () => {
    const menu = await collapsedMenu();
    let requests = 0;
    menu.addEventListener('lr-toggle-request', (event) => {
      if (event.target === menu) requests += 1;
    });
    const toggle = part(menu, 'toggle')!;
    await focusByKeyboard(toggle);
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, cancelable: true });
    toggle.dispatchEvent(escape);
    await settle(menu);
    expect(escape.defaultPrevented, 'Escape was consumed with nothing to close').to.equal(false);
    expect(requests).to.equal(0);
    expect(menu.expanded).to.equal(false);
  });

  it('ignores a re-entrant toggle press made from inside the expansion request', async () => {
    const menu = await collapsedMenu();
    const toggle = part(menu, 'toggle')!;
    let requests = 0;
    menu.addEventListener('lr-toggle-request', (event) => {
      if (event.target !== menu) return;
      requests += 1;
      // HTMLElement.click() refuses to nest inside its own click, so dispatch a fresh press.
      toggle.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    });
    toggle.click();
    await settle(menu);
    expect(requests, 'the nested press issued a second request').to.equal(1);
    expect(menu.expanded).to.equal(true);
  });

  it('closes the open panel through Escape on its trigger, then collapses on a second Escape', async () => {
    const menu = await collapsedMenu();
    part(menu, 'toggle')!.click();
    await settle(menu);
    const products = item(menu, 'products');
    await focusByKeyboard(base(products));
    await sendKeys({ press: 'Enter' });
    await settle(menu);
    expect(products.open).to.equal(true);
    await sendKeys({ press: 'Escape' });
    await settle(menu);
    expect(products.open).to.equal(false);
    expect(menu.expanded).to.equal(true);
    await sendKeys({ press: 'Escape' });
    await settle(menu);
    expect(menu.expanded).to.equal(false);
  });
});

describe('<lr-navigation-menu> item-anchored indicator', () => {
  it('aligns the indicator with the trigger when panels anchor to items', async () => {
    const menu = await menuFixture(
      html`<lr-navigation-menu indicator panel-anchor="item">${items()}</lr-navigation-menu>`,
    );
    const indicator = part(menu, 'indicator')!;
    const resources = item(menu, 'resources');
    base(resources).click();
    await settle(menu);
    await waitUntil(() => {
      const rect = indicator.getBoundingClientRect();
      const trigger = base(resources).getBoundingClientRect();
      return (
        Math.abs(rect.left - trigger.left) <= 1 &&
        Math.abs(rect.width - trigger.width) <= 1 &&
        Number(getComputedStyle(indicator).opacity) === 1
      );
    }, 'the item-anchored indicator did not follow its trigger');
  });
});

describe('<lr-navigation-menu> interrupted panel morph', () => {
  it('removes the in-flight morph sizing when the new panel closes before the morph frame', async () => {
    const menu = await menuFixture(html`<lr-navigation-menu>${items()}</lr-navigation-menu>`);
    const products = item(menu, 'products');
    const resources = item(menu, 'resources');
    base(products).click();
    await settle(menu);
    await waitUntil(() => {
      const rect = products.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')!.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }, 'the first panel never laid out');
    const surface = resources.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')!;
    let morphing = false;
    // A MutationObserver callback runs as a microtask, before the morph's own animation frame.
    const observer = new MutationObserver(() => {
      if (!surface.hasAttribute('data-morphing') || morphing) return;
      morphing = true;
      resources.open = false;
    });
    observer.observe(surface, { attributes: true, attributeFilter: ['data-morphing'] });
    try {
      base(resources).click();
      await waitUntil(() => morphing, 'the switch never started a size morph');
      await settle(menu);
    } finally {
      observer.disconnect();
    }
    expect(resources.open).to.equal(false);
    expect(surface.hasAttribute('data-morphing'), 'a cancelled morph left its marker').to.equal(false);
    expect(surface.style.inlineSize, 'a cancelled morph left its inline size').to.equal('');
    expect(surface.style.blockSize, 'a cancelled morph left its block size').to.equal('');
  });
});

describe('unowned <lr-navigation-menu-item>', () => {
  it('ignores activation of a plain item with no panel or link', async () => {
    const plain = await fixture<LyraNavigationMenuItem>(
      html`<lr-navigation-menu-item>Standalone</lr-navigation-menu-item>`,
    );
    let toggles = 0;
    plain.addEventListener('lr-toggle', () => { toggles += 1; });
    base(plain).click();
    await plain.updateComplete;
    expect(plain.open).to.equal(false);
    expect(toggles).to.equal(0);
  });
});

describe('<lr-navigation-menu> pointer exits outside items', () => {
  it('keeps a hover panel open for a pointerout that starts outside every item', async () => {
    const menu = await menuFixture(
      html`<lr-navigation-menu show-delay="0" hide-delay="0">${items()}</lr-navigation-menu>`,
    );
    const products = item(menu, 'products');
    pointer(base(products), 'pointerover');
    await waitUntil(() => products.open, 'hover never opened');
    pointer(part(menu, 'list')!, 'pointerout', { relatedTarget: document.body });
    await settle(menu);
    expect(products.open, 'a pointerout from the bare list closed the panel').to.equal(true);
  });
});

describe('<lr-navigation-menu> collapsed indicator', () => {
  it('keeps the indicator hidden while an item opens in the collapsed list', async () => {
    const menu = await menuFixture(html`<div style="inline-size: 320px"
      ><lr-navigation-menu indicator mobile-breakpoint="40rem">${items()}</lr-navigation-menu></div>`);
    await waitUntil(() => menu.collapsed && part(menu, 'toggle') !== null, 'menu never collapsed');
    part(menu, 'toggle')!.click();
    await settle(menu);
    const products = item(menu, 'products');
    base(products).click();
    await settle(menu);
    await nextFrame();
    expect(products.open).to.equal(true);
    const indicator = part(menu, 'indicator');
    expect(indicator === null || Number(getComputedStyle(indicator).opacity) === 0,
      'the collapsed list showed the bar indicator').to.equal(true);
  });
});
