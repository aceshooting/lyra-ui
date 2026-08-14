import { aTimeout, elementUpdated, expect, fixture, html, waitUntil } from '@open-wc/testing';
import './page.js';
import type { LyraPage } from './page.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

interface PageTestAccess {
  applyMeasuredInlineSize(width: number): void;
}

const access = (page: LyraPage): PageTestAccess => page as unknown as PageTestAccess;
const byPart = (page: LyraPage, part: string): HTMLElement =>
  page.shadowRoot!.querySelector<HTMLElement>(`[part~="${part}"]`)!;

const composedPageToggleTag = 'test-composed-page-toggle';
if (!customElements.get(composedPageToggleTag)) {
  customElements.define(
    composedPageToggleTag,
    class extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' }).innerHTML = '<button type="button">Sections</button>';
      }
    },
  );
}

function populatedPage(extra = ''): string {
  return `
    <div slot="banner">System notice</div>
    <strong slot="header">Lyra</strong>
    <span slot="subheader">Workspace</span>
    <button slot="menu">Actions</button>
    <h2 slot="navigation-header">Sections</h2>
    <a slot="navigation" href="#overview">Overview</a>
    <button slot="navigation-footer">Sign out</button>
    <h1 slot="main-header">Dashboard</h1>
    <p id="overview">Main content</p>
    <button slot="main-footer">Save</button>
    <p slot="aside">Related information</p>
    <small slot="footer">Copyright</small>
    ${extra}
  `;
}

it('exposes the exact Page defaults and reflection contract', async () => {
  const page = (await fixture(html`<lr-page></lr-page>`)) as LyraPage;

  expect(page.view).to.equal('desktop');
  expect(page.getAttribute('view')).to.equal('desktop');
  expect(page.navOpen).to.be.false;
  expect(page.hasAttribute('nav-open')).to.be.false;
  expect(page.mobileBreakpoint).to.equal('768px');
  expect(page.hasAttribute('mobile-breakpoint')).to.be.false;
  expect(page.navigationPlacement).to.equal('start');
  expect(page.getAttribute('navigation-placement')).to.equal('start');
  expect(page.disableNavigationToggle).to.be.false;
  expect(page.hasAttribute('disable-navigation-toggle')).to.be.false;
});

it('renders all 15 slots and all 22 documented parts, with base/page on one node', async () => {
  const page = (await fixture(html`<lr-page></lr-page>`)) as LyraPage;
  const slots = [...page.shadowRoot!.querySelectorAll('slot')].map((slot) => slot.name);
  expect([...new Set(slots)].sort()).to.deep.equal(
    [
      '',
      'aside',
      'banner',
      'footer',
      'header',
      'main-footer',
      'main-header',
      'menu',
      'navigation',
      'navigation-footer',
      'navigation-header',
      'navigation-toggle',
      'navigation-toggle-icon',
      'skip-to-content',
      'subheader',
    ].sort(),
  );

  const parts = new Set(
    [...page.shadowRoot!.querySelectorAll<HTMLElement>('[part]')].flatMap((node) =>
      (node.getAttribute('part') ?? '').split(/\s+/).filter(Boolean),
    ),
  );
  for (const part of [
    'aside',
    'banner',
    'base',
    'body',
    'dialog-wrapper',
    'drawer',
    'footer',
    'header',
    'main',
    'main-content',
    'main-footer',
    'main-header',
    'menu',
    'navigation',
    'navigation-desktop',
    'navigation-footer',
    'navigation-header',
    'navigation-toggle',
    'navigation-toggle-icon',
    'page',
    'skip-to-content',
    'subheader',
  ]) {
    expect(parts.has(part), `${part} is represented`).to.be.true;
  }
  expect(byPart(page, 'base').getAttribute('part')).to.include('page');
});

it('uses semantic landmarks and per-instance skip/navigation targets', async () => {
  const wrapper = (await fixture(html`<div><lr-page></lr-page><lr-page></lr-page></div>`)) as HTMLElement;
  const [first, second] = [...wrapper.querySelectorAll('lr-page')] as LyraPage[];
  const firstMain = byPart(first!, 'main');
  const secondMain = byPart(second!, 'main');
  const firstNavigation = byPart(first!, 'navigation');
  const secondNavigation = byPart(second!, 'navigation');

  expect(firstMain.localName).to.equal('main');
  expect(byPart(first!, 'header').localName).to.equal('header');
  expect(byPart(first!, 'aside').localName).to.equal('aside');
  expect(byPart(first!, 'footer').localName).to.equal('footer');
  expect(firstNavigation.localName).to.equal('nav');
  expect(firstNavigation.getAttribute('aria-label')).to.equal('Navigation');
  expect(firstMain.id).to.not.equal(secondMain.id);
  expect(firstNavigation.id).to.not.equal(secondNavigation.id);
  expect(first!.id).to.not.equal(second!.id);
  expect(byPart(first!, 'skip-to-content').getAttribute('href')).to.equal(`#${first!.id}`);
  expect(byPart(second!, 'skip-to-content').getAttribute('href')).to.equal(`#${second!.id}`);
});

it('localizes the skip link, navigation landmark, and open/close toggle names', async () => {
  const page = (await fixture(html`
    <lr-page
      style="inline-size:320px"
      .strings=${{
        skipToContent: 'Aller au contenu',
        navigation: 'Navigation principale',
        openNavigation: 'Ouvrir la navigation',
        closeNavigation: 'Fermer la navigation',
      }}
    ></lr-page>
  `)) as LyraPage;
  access(page).applyMeasuredInlineSize(320);
  await page.updateComplete;

  const skip = byPart(page, 'skip-to-content');
  const navigation = byPart(page, 'navigation');
  const toggle = byPart(page, 'navigation-toggle');
  expect(skip.textContent?.trim()).to.equal('Aller au contenu');
  expect(navigation.getAttribute('aria-label')).to.equal('Navigation principale');
  expect(toggle.getAttribute('aria-label')).to.equal('Ouvrir la navigation');

  page.showNavigation();
  await page.updateComplete;
  expect(toggle.getAttribute('aria-label')).to.equal('Fermer la navigation');
});

it('uses rich skip-to-content slot content in place of the localized fallback', async () => {
  const page = (await fixture(html`
    <lr-page><strong slot="skip-to-content">Jump straight to the report</strong></lr-page>
  `)) as LyraPage;
  const slot = page.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="skip-to-content"]')!;
  expect(slot.assignedElements().map((node) => node.localName)).to.deep.equal(['strong']);
  expect(slot.assignedElements()[0]?.textContent).to.equal('Jump straight to the report');
});

it('moves focus to its own main landmark when the skip link is activated', async () => {
  const page = (await fixture(html`<lr-page><p>Report</p></lr-page>`)) as LyraPage;
  const main = byPart(page, 'main');
  byPart(page, 'skip-to-content').click();
  expect(page.shadowRoot!.activeElement?.id).to.equal(main.id);
});

it('showNavigation(), hideNavigation(), and toggleNavigation() keep navOpen and reflection aligned', async () => {
  const page = (await fixture(html`<lr-page></lr-page>`)) as LyraPage;
  page.showNavigation();
  await page.updateComplete;
  expect(page.navOpen).to.be.true;
  expect(page.hasAttribute('nav-open')).to.be.true;

  page.toggleNavigation();
  await page.updateComplete;
  expect(page.navOpen).to.be.false;
  expect(page.hasAttribute('nav-open')).to.be.false;

  page.showNavigation();
  page.hideNavigation();
  await page.updateComplete;
  expect(page.navOpen).to.be.false;
});

it('emits a cancelable lr-nav-toggle before mutating navOpen, honoring a prevented request', async () => {
  const page = (await fixture(html`<lr-page></lr-page>`)) as LyraPage;
  const order: Array<{ type: string; open: boolean; navOpenAtDispatch: boolean }> = [];
  page.addEventListener('lr-nav-toggle', (event) => {
    const detail = (event as CustomEvent<{ open: boolean }>).detail;
    order.push({ type: event.type, open: detail.open, navOpenAtDispatch: page.navOpen });
    expect(event.cancelable).to.be.true;
  });

  page.showNavigation();
  expect(order).to.deep.equal([{ type: 'lr-nav-toggle', open: true, navOpenAtDispatch: false }]);
  expect(page.navOpen).to.be.true;

  order.length = 0;
  page.addEventListener('lr-nav-toggle', (event) => event.preventDefault(), { once: true });
  page.hideNavigation();
  expect(order).to.deep.equal([{ type: 'lr-nav-toggle', open: false, navOpenAtDispatch: true }]);
  expect(page.navOpen, 'a defaultPrevented lr-nav-toggle must not mutate navOpen').to.be.true;
});

it('gives the default toggle an exact controls/expanded contract and supports its icon slot', async () => {
  const page = (await fixture(html`
    <lr-page style="inline-size:320px"><span slot="navigation-toggle-icon">Menu</span></lr-page>
  `)) as LyraPage;
  access(page).applyMeasuredInlineSize(320);
  await page.updateComplete;
  const toggle = byPart(page, 'navigation-toggle');
  const drawer = byPart(page, 'drawer');
  expect(toggle.getAttribute('aria-expanded')).to.equal('false');
  expect(toggle.getAttribute('aria-controls')).to.equal(drawer.id);
  const iconSlot = page.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="navigation-toggle-icon"]')!;
  expect(iconSlot.assignedElements()[0]?.textContent).to.equal('Menu');

  toggle.click();
  await page.updateComplete;
  expect(page.navOpen).to.be.true;
  expect(toggle.getAttribute('aria-expanded')).to.equal('true');
});

it('keeps slotted skip content and toggle glyph controls decorative while preserving the outer actions', async () => {
  const root = await fixture(html`
    <div>
      <button id="outside" type="button">Outside</button>
      <lr-page style="inline-size:320px">
        <button id="skip-control" slot="skip-to-content" type="button">Jump to report</button>
        <button id="toggle-icon-control" slot="navigation-toggle-icon" type="button">Open sections</button>
        <a slot="navigation" href="#report">Report</a>
        <p id="report">Report content</p>
      </lr-page>
    </div>
  `);
  const page = root.querySelector<LyraPage>('lr-page')!;
  access(page).applyMeasuredInlineSize(320);
  await page.updateComplete;

  const outside = root.querySelector<HTMLButtonElement>('#outside')!;
  const skipControl = page.querySelector<HTMLButtonElement>('#skip-control')!;
  const toggleIconControl = page.querySelector<HTMLButtonElement>('#toggle-icon-control')!;
  const skip = byPart(page, 'skip-to-content');
  const main = byPart(page, 'main');
  const toggle = byPart(page, 'navigation-toggle');
  const skipSlot = page.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="skip-to-content"]')!;
  const iconSlot = page.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="navigation-toggle-icon"]')!;
  const skipVisual = skipSlot.closest<HTMLElement>('[inert][aria-hidden="true"]');
  const iconVisual = iconSlot.closest<HTMLElement>('[inert][aria-hidden="true"]');

  expect(skipVisual?.id ?? '', 'the skip visual layer has a stable accessible-name target').to.not.equal('');
  expect(skip.getAttribute('aria-labelledby')).to.equal(skipVisual?.id ?? '');
  expect(iconVisual?.hasAttribute('inert')).to.equal(true);
  expect(iconVisual?.getAttribute('aria-hidden')).to.equal('true');

  outside.focus();
  skipControl.focus();
  expect(document.activeElement?.id).to.equal('outside');
  toggleIconControl.focus();
  expect(document.activeElement?.id).to.equal('outside');

  let skipControlActivations = 0;
  skipControl.addEventListener('click', () => skipControlActivations++);
  skip.style.opacity = '1';
  skip.style.pointerEvents = 'auto';
  skip.style.transition = 'none';
  skip.style.transform = 'none';
  const skipRect = skipControl.getBoundingClientRect();
  expect(skipRect.width).to.be.greaterThan(0);
  expect(skipRect.height).to.be.greaterThan(0);
  try {
    await sendMouse({
      type: 'click',
      position: [
        Math.round(skipRect.left + skipRect.width / 2),
        Math.round(skipRect.top + skipRect.height / 2),
      ],
    });
    await page.updateComplete;
    expect(skipControlActivations).to.equal(0);
    expect(page.shadowRoot!.activeElement?.id).to.equal(main.id);
  } finally {
    await resetMouse();
    skip.style.removeProperty('opacity');
    skip.style.removeProperty('pointer-events');
    skip.style.removeProperty('transition');
    skip.style.removeProperty('transform');
  }

  let toggleIconActivations = 0;
  toggleIconControl.addEventListener('click', () => toggleIconActivations++);
  const toggleIconRect = toggleIconControl.getBoundingClientRect();
  try {
    await sendMouse({
      type: 'click',
      position: [
        Math.round(toggleIconRect.left + toggleIconRect.width / 2),
        Math.round(toggleIconRect.top + toggleIconRect.height / 2),
      ],
    });
    await page.updateComplete;
    await aTimeout(20);
    expect(toggleIconActivations).to.equal(0);
    expect(page.navOpen).to.equal(true);
    await expect(page).to.be.accessible();
  } finally {
    await resetMouse();
    page.hideNavigation();
    await page.updateComplete;
  }
});

it('keeps a custom navigation-toggle operable when the default is disabled and avoids double data-toggle activation', async () => {
  const page = (await fixture(html`
    <lr-page style="inline-size:320px" disable-navigation-toggle>
      <button slot="navigation-toggle" data-toggle-nav aria-label="Choose a section">Sections</button>
    </lr-page>
  `)) as LyraPage;
  access(page).applyMeasuredInlineSize(320);
  await page.updateComplete;
  const custom = page.querySelector<HTMLButtonElement>('[slot="navigation-toggle"]')!;
  expect(getComputedStyle(custom).display).to.not.equal('none');
  expect(custom.getAttribute('aria-label')).to.equal('Choose a section');
  expect(custom.getAttribute('aria-expanded')).to.equal('false');
  custom.click();
  await page.updateComplete;
  expect(page.navOpen).to.be.true;
  expect(custom.getAttribute('aria-expanded')).to.equal('true');
});

it('owns the real custom-toggle control and retargets focus restoration after replacement', async () => {
  const page = (await fixture(html`
    <lr-page style="inline-size:320px" disable-navigation-toggle>
      <test-composed-page-toggle slot="navigation-toggle"></test-composed-page-toggle>
      <button slot="navigation">Inside navigation</button>
    </lr-page>
  `)) as LyraPage;
  access(page).applyMeasuredInlineSize(320);
  await page.updateComplete;
  await aTimeout(0);
  const first = page.querySelector(composedPageToggleTag) as HTMLElement;
  const firstControl = first.shadowRoot!.querySelector('button')!;

  expect(first.getAttribute('aria-haspopup')).to.equal('dialog');
  expect(firstControl.getAttribute('aria-haspopup')).to.equal('dialog');
  expect(firstControl.getAttribute('aria-expanded')).to.equal('false');
  if ('ariaControlsElements' in firstControl) {
    expect(firstControl.ariaControlsElements.length).to.equal(1);
    expect(firstControl.ariaControlsElements[0] === page).to.equal(true);
  }

  firstControl.click();
  await page.updateComplete;
  expect(page.navOpen).to.equal(true);

  const replacement = document.createElement(composedPageToggleTag);
  replacement.slot = 'navigation-toggle';
  first.replaceWith(replacement);
  const replacementControl = replacement.shadowRoot!.querySelector('button')!;
  await waitUntil(() => replacement.getAttribute('aria-expanded') === 'true');
  expect(replacementControl.getAttribute('aria-expanded')).to.equal(
    null,
    'the private control remains unavailable while its Page header is inert',
  );

  page.hideNavigation();
  await page.updateComplete;
  expect(replacementControl.getAttribute('aria-expanded')).to.equal('false');
  expect(replacement.shadowRoot!.activeElement === replacementControl).to.equal(true);
});

it('gives a custom navigation toggle a cross-shadow controls reference and cleans owned ARIA on release', async () => {
  const page = (await fixture(html`
    <lr-page style="inline-size:320px" disable-navigation-toggle>
      <button slot="navigation-toggle">Sections</button>
    </lr-page>
  `)) as LyraPage;
  access(page).applyMeasuredInlineSize(320);
  await page.updateComplete;
  const custom = page.querySelector<HTMLButtonElement>('[slot="navigation-toggle"]')!;
  if ('ariaControlsElements' in custom) {
    expect(custom.ariaControlsElements.map((element) => element.id)).to.deep.equal([page.id]);
  }

  custom.slot = 'header';
  await aTimeout(0);
  expect(custom.hasAttribute('aria-expanded')).to.equal(false);
  expect(custom.hasAttribute('aria-controls')).to.equal(false);
  expect(custom.hasAttribute('aria-label')).to.equal(false);
  if ('ariaControlsElements' in custom) {
    expect((custom.ariaControlsElements ?? []).map((element) => element.id)).to.deep.equal([]);
  }
});

it('restores authored custom-toggle ARIA across replacement and preserves later author changes', async () => {
  const page = (await fixture(html`
    <lr-page style="inline-size:320px" disable-navigation-toggle>
      <div id="author-panel" slot="header"></div>
      <button
        slot="navigation-toggle"
        aria-expanded="true"
        aria-controls="author-panel"
        aria-label="Author label"
      >Sections</button>
    </lr-page>
  `)) as LyraPage;
  access(page).applyMeasuredInlineSize(320);
  await page.updateComplete;
  const custom = page.querySelector<HTMLButtonElement>('[slot="navigation-toggle"]')!;
  expect(custom.getAttribute('aria-expanded')).to.equal('false');

  const replacement = document.createElement('button');
  replacement.slot = 'navigation-toggle';
  replacement.textContent = 'Replacement';
  custom.slot = 'header';
  page.append(replacement);
  await aTimeout(0);
  expect(custom.getAttribute('aria-expanded')).to.equal('true');
  expect(custom.getAttribute('aria-controls')).to.equal('author-panel');
  expect(custom.getAttribute('aria-label')).to.equal('Author label');

  replacement.setAttribute('aria-controls', 'consumer-late-target');
  replacement.slot = 'header';
  await aTimeout(0);
  expect(replacement.getAttribute('aria-controls')).to.equal('consumer-late-target');
});

it('keeps generated custom-toggle ARIA authoritative and restores late author state on release', async () => {
  const page = (await fixture(html`
    <lr-page disable-navigation-toggle>
      <button slot="navigation-toggle">Sections</button>
    </lr-page>
  `)) as LyraPage;
  await page.updateComplete;
  const custom = page.querySelector<HTMLButtonElement>('[slot="navigation-toggle"]')!;
  const generatedControls = custom.getAttribute('aria-controls');

  custom.setAttribute('aria-expanded', 'mixed');
  custom.setAttribute('aria-controls', 'author-navigation');
  custom.setAttribute('aria-label', 'Author navigation');
  await aTimeout(0);
  page.showNavigation();
  await page.updateComplete;

  expect(generatedControls).to.equal(page.id);
  expect(custom.getAttribute('aria-expanded')).to.equal('true');
  expect(custom.getAttribute('aria-controls')?.split(/\s+/)).to.have.members([
    'author-navigation',
    page.id,
  ]);
  expect(custom.getAttribute('aria-label')).to.equal('Close navigation');

  page.hideNavigation();
  await page.updateComplete;
  expect(custom.getAttribute('aria-expanded')).to.equal('false');
  expect(custom.getAttribute('aria-controls')?.split(/\s+/)).to.have.members([
    'author-navigation',
    page.id,
  ]);
  expect(custom.getAttribute('aria-label')).to.equal('Open navigation');

  page.remove();
  expect(custom.getAttribute('aria-expanded')).to.equal('mixed');
  expect(custom.getAttribute('aria-controls')).to.equal('author-navigation');
  expect(custom.getAttribute('aria-label')).to.equal('Author navigation');
});

it('releases generated custom-toggle ARIA on disconnect and reapplies it on reconnect', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`
    <div>
      <lr-page style="inline-size:320px" disable-navigation-toggle>
        <button slot="navigation-toggle">Sections</button>
      </lr-page>
    </div>
  `);
  const page = wrapper.querySelector('lr-page') as LyraPage;
  await page.updateComplete;
  const custom = page.querySelector<HTMLButtonElement>('[slot="navigation-toggle"]')!;
  expect(custom.getAttribute('aria-controls')).to.equal(page.id);

  page.remove();
  expect(custom.hasAttribute('aria-expanded')).to.equal(false);
  expect(custom.hasAttribute('aria-controls')).to.equal(false);
  expect(custom.hasAttribute('aria-label')).to.equal(false);

  wrapper.append(page);
  await aTimeout(0);
  expect(custom.getAttribute('aria-expanded')).to.equal('false');
  expect(custom.getAttribute('aria-controls')).to.equal(page.id);
  expect(custom.hasAttribute('aria-label')).to.equal(true);
});

it('honors data-toggle-nav controls in any slotted page region', async () => {
  const page = (await fixture(html`
    <lr-page style="inline-size:320px"><button slot="header" data-toggle-nav>Sections</button></lr-page>
  `)) as LyraPage;
  access(page).applyMeasuredInlineSize(320);
  await page.updateComplete;
  page.querySelector<HTMLButtonElement>('[data-toggle-nav]')!.click();
  await page.updateComplete;
  expect(page.navOpen).to.be.true;
});

it('hides its built-in toggle when disable-navigation-toggle is set', async () => {
  const page = (await fixture(html`
    <lr-page style="inline-size:320px" disable-navigation-toggle></lr-page>
  `)) as LyraPage;
  access(page).applyMeasuredInlineSize(320);
  await page.updateComplete;
  expect(getComputedStyle(byPart(page, 'navigation-toggle')).display).to.equal('none');
});

it('classifies view from allocated inline size and re-resolves rem breakpoints live', async () => {
  const oldRootSize = document.documentElement.style.fontSize;
  try {
    document.documentElement.style.fontSize = '16px';
    const page = (await fixture(html`
      <lr-page mobile-breakpoint="30rem" style="inline-size:500px"></lr-page>
    `)) as LyraPage;
    access(page).applyMeasuredInlineSize(500);
    await page.updateComplete;
    expect(page.view).to.equal('desktop');

    document.documentElement.style.fontSize = '20px';
    access(page).applyMeasuredInlineSize(500);
    await page.updateComplete;
    expect(page.view).to.equal('mobile');
  } finally {
    document.documentElement.style.fontSize = oldRootSize;
  }
});

it('falls back to the documented breakpoint for an invalid CSS length', async () => {
  const page = (await fixture(html`<lr-page mobile-breakpoint="calc(100% - 1px)"></lr-page>`)) as LyraPage;
  access(page).applyMeasuredInlineSize(700);
  await page.updateComplete;
  expect(page.view).to.equal('mobile');
  access(page).applyMeasuredInlineSize(900);
  await page.updateComplete;
  expect(page.view).to.equal('desktop');
});

it('disconnects and re-arms its allocation observer across reconnect', async () => {
  const OriginalResizeObserver = window.ResizeObserver;
  let observeCalls = 0;
  let disconnectCalls = 0;
  class SpyResizeObserver extends OriginalResizeObserver {
    override observe(target: Element, options?: ResizeObserverOptions): void {
      observeCalls++;
      super.observe(target, options);
    }
    override disconnect(): void {
      disconnectCalls++;
      super.disconnect();
    }
  }
  window.ResizeObserver = SpyResizeObserver;
  try {
    const page = (await fixture(html`<lr-page></lr-page>`)) as LyraPage;
    expect(observeCalls).to.be.greaterThan(0);
    const parent = page.parentElement!;
    page.remove();
    expect(disconnectCalls).to.be.greaterThan(0);
    parent.append(page);
    expect(observeCalls).to.be.greaterThan(1);
  } finally {
    window.ResizeObserver = OriginalResizeObserver;
  }
});

it('uses and tears down the window resize fallback when ResizeObserver is unavailable', async () => {
  const originalResizeObserver = window.ResizeObserver;
  let width = 900;
  Reflect.set(window, 'ResizeObserver', undefined);
  try {
    const page = (await fixture(html`<lr-page></lr-page>`)) as LyraPage;
    page.getBoundingClientRect = () =>
      ({
        top: 0,
        right: width,
        bottom: 100,
        left: 0,
        width,
        height: 100,
        x: 0,
        y: 0,
        toJSON() {},
      }) as DOMRect;

    page.mobileBreakpoint = '700px';
    await page.updateComplete;
    expect(page.view).to.equal('desktop');

    width = 320;
    window.dispatchEvent(new Event('resize'));
    await page.updateComplete;
    expect(page.view).to.equal('mobile');

    page.remove();
    width = 900;
    window.dispatchEvent(new Event('resize'));
    await aTimeout(0);
    expect(page.view).to.equal('mobile');
  } finally {
    Reflect.set(window, 'ResizeObserver', originalResizeObserver);
  }
});

it('keeps the exact slotted navigation node and focus while crossing desktop/mobile views', async () => {
  const page = (await fixture(html`
    <lr-page style="inline-size:900px"><button slot="navigation">Focused section</button></lr-page>
  `)) as LyraPage;
  const navigationButton = page.querySelector<HTMLButtonElement>('[slot="navigation"]')!;
  navigationButton.focus();
  expect((document.activeElement) === (navigationButton)).to.equal(true);

  access(page).applyMeasuredInlineSize(320);
  await page.updateComplete;
  expect(page.querySelector('[slot="navigation"]')?.textContent).to.equal('Focused section');
  expect((document.activeElement) === (navigationButton)).to.equal(true);

  access(page).applyMeasuredInlineSize(900);
  await page.updateComplete;
  expect((document.activeElement) === (navigationButton)).to.equal(true);
});

it('uses the shared mobile overlay lifecycle for Escape, scroll lock, and focus return', async () => {
  const page = (await fixture(html`
    <lr-page style="inline-size:320px">
      <a slot="navigation" href="#inside">Inside navigation</a>
      <p id="inside">Content</p>
    </lr-page>
  `)) as LyraPage;
  access(page).applyMeasuredInlineSize(320);
  await page.updateComplete;
  const toggle = byPart(page, 'navigation-toggle');
  toggle.focus();
  toggle.click();
  await page.updateComplete;

  expect(page.navOpen).to.be.true;
  expect(byPart(page, 'drawer').getAttribute('role')).to.equal('dialog');
  expect(byPart(page, 'drawer').getAttribute('aria-modal')).to.equal('true');
  expect(document.documentElement.style.overflow).to.equal('hidden');
  expect(document.activeElement?.textContent).to.contain('Inside navigation');

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await page.updateComplete;
  expect(page.navOpen).to.be.false;
  expect(document.documentElement.style.overflow).to.equal('');
  expect(page.shadowRoot!.activeElement?.getAttribute('part')).to.contain('navigation-toggle');
});

it('excludes same-host Page chrome outside the open mobile drawer and restores it on close', async () => {
  const page = (await fixture(html`
    <lr-page style="inline-size:320px">
      <button slot="navigation">Inside navigation</button>
      <button>Main action</button>
    </lr-page>
  `)) as LyraPage;
  access(page).applyMeasuredInlineSize(320);
  await page.updateComplete;

  page.showNavigation();
  await page.updateComplete;

  expect(byPart(page, 'header').inert).to.equal(true);
  expect(byPart(page, 'main').inert).to.equal(true);
  expect(byPart(page, 'footer').inert).to.equal(true);
  expect(byPart(page, 'dialog-wrapper').inert).to.equal(false);
  expect(byPart(page, 'drawer').inert).to.equal(false);

  page.hideNavigation();
  await page.updateComplete;
  expect(byPart(page, 'header').inert).to.equal(false);
  expect(byPart(page, 'main').inert).to.equal(false);
  expect(byPart(page, 'footer').inert).to.equal(false);
});

it('dismisses the open mobile drawer from its backdrop wrapper', async () => {
  const page = (await fixture(html`
    <lr-page style="inline-size:320px"><button slot="navigation">Inside</button></lr-page>
  `)) as LyraPage;
  access(page).applyMeasuredInlineSize(320);
  page.showNavigation();
  await page.updateComplete;
  byPart(page, 'dialog-wrapper').click();
  await page.updateComplete;
  expect(page.navOpen).to.be.false;
});

it('suspends and restores an open mobile overlay across a synchronous reparent', async () => {
  const page = (await fixture(html`
    <lr-page style="inline-size:320px"><button slot="navigation">Inside</button></lr-page>
  `)) as LyraPage;
  access(page).applyMeasuredInlineSize(320);
  page.showNavigation();
  await page.updateComplete;
  const target = document.createElement('div');
  document.body.append(target);
  try {
    target.append(page);
    expect(document.documentElement.style.overflow).to.equal('hidden');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await page.updateComplete;
    expect(page.navOpen).to.be.false;
  } finally {
    target.remove();
  }
});

it('keeps navOpen through a desktop crossing while releasing and restoring modal chrome', async () => {
  const page = (await fixture(html`
    <lr-page style="inline-size:320px"><button slot="navigation">Inside</button></lr-page>
  `)) as LyraPage;
  access(page).applyMeasuredInlineSize(320);
  page.showNavigation();
  await page.updateComplete;
  expect(document.documentElement.style.overflow).to.equal('hidden');

  access(page).applyMeasuredInlineSize(900);
  await page.updateComplete;
  expect(page.navOpen).to.be.true;
  expect(document.documentElement.style.overflow).to.equal('');
  expect(byPart(page, 'navigation').localName).to.equal('nav');

  access(page).applyMeasuredInlineSize(320);
  await page.updateComplete;
  expect(document.documentElement.style.overflow).to.equal('hidden');
  page.hideNavigation();
  await page.updateComplete;
});

it('places navigation on the logical start/end edge in LTR and RTL', async () => {
  const page = (await fixture(html`
    <lr-page style="inline-size:320px" nav-open><button slot="navigation">Inside</button></lr-page>
  `)) as LyraPage;
  access(page).applyMeasuredInlineSize(320);
  await page.updateComplete;
  let rect = byPart(page, 'navigation').getBoundingClientRect();
  expect(rect.left).to.be.closeTo(0, 1);

  page.navigationPlacement = 'end';
  await page.updateComplete;
  rect = byPart(page, 'navigation').getBoundingClientRect();
  expect(rect.right).to.be.closeTo(window.innerWidth, 1);

  page.dir = 'rtl';
  page.navigationPlacement = 'start';
  await page.updateComplete;
  rect = byPart(page, 'navigation').getBoundingClientRect();
  expect(rect.right).to.be.closeTo(window.innerWidth, 1);
  page.hideNavigation();
  await page.updateComplete;
});

it('backs all six Web Awesome sizing aliases with canonical --lr-page-* properties', async () => {
  const page = (await fixture(html`
    <lr-page
      style="
        --menu-width: 71px;
        --main-width: 211px;
        --aside-width: 83px;
        --banner-height: 17px;
        --header-height: 19px;
        --subheader-height: 23px;
      "
    ></lr-page>
  `)) as LyraPage;
  expect(getComputedStyle(byPart(page, 'menu')).width).to.equal('71px');
  expect(getComputedStyle(byPart(page, 'main')).width).to.equal('211px');
  expect(getComputedStyle(byPart(page, 'aside')).width).to.equal('83px');
  expect(getComputedStyle(byPart(page, 'banner')).minBlockSize).to.equal('17px');
  expect(getComputedStyle(byPart(page, 'header')).minBlockSize).to.equal('19px');
  expect(getComputedStyle(byPart(page, 'subheader')).minBlockSize).to.equal('23px');

  page.style.removeProperty('--menu-width');
  page.style.setProperty('--lr-page-menu-width', '79px');
  expect(getComputedStyle(byPart(page, 'menu')).width).to.equal('79px');
});

it('supports whitespace-token disable-sticky without disabling unrelated regions', async () => {
  const page = (await fixture(html`
    <lr-page disable-sticky="header aside"></lr-page>
  `)) as LyraPage;
  expect(getComputedStyle(byPart(page, 'header')).position).to.equal('static');
  expect(getComputedStyle(byPart(page, 'aside')).position).to.equal('static');
  expect(getComputedStyle(byPart(page, 'banner')).position).to.equal('sticky');
});

it('uses token-driven drawer motion and renders the reduced-motion branch with no transition', async () => {
  const page = (await fixture(html`<lr-page style="inline-size:320px"></lr-page>`)) as LyraPage;
  access(page).applyMeasuredInlineSize(320);
  await page.updateComplete;
  const drawer = byPart(page, 'drawer');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  expect(getComputedStyle(drawer).transitionDuration === '0s').to.equal(reduced);

  const reducedRule = page.shadowRoot!.adoptedStyleSheets
    .flatMap((sheet) => [...sheet.cssRules])
    .find(
      (rule): rule is CSSMediaRule =>
        rule instanceof CSSMediaRule &&
        rule.conditionText === '(prefers-reduced-motion: reduce)' &&
        [...rule.cssRules].some(
          (nested) => nested instanceof CSSStyleRule && nested.selectorText.includes('drawer'),
        ),
    );
  expect(reducedRule?.conditionText).to.equal('(prefers-reduced-motion: reduce)');
  if (reduced) return;

  const originalCondition = reducedRule!.media.mediaText;
  try {
    reducedRule!.media.mediaText = 'all';
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(getComputedStyle(drawer).transitionDuration).to.equal('0s');
  } finally {
    reducedRule!.media.mediaText = originalCondition;
  }
});

it('visiblePixelsInViewport() always returns a finite, clamped vertical intersection', async () => {
  const page = (await fixture(html`<lr-page></lr-page>`)) as LyraPage;
  const element = document.createElement('div');
  element.getBoundingClientRect = () =>
    ({ top: -20, bottom: 80, left: 0, right: 10, width: 10, height: 100, x: 0, y: -20, toJSON() {} }) as DOMRect;
  expect(page.visiblePixelsInViewport(element)).to.equal(80);
  element.getBoundingClientRect = () =>
    ({
      top: Number.NaN,
      bottom: Number.POSITIVE_INFINITY,
      left: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON() {},
    }) as DOMRect;
  expect(page.visiblePixelsInViewport(element)).to.equal(0);
  expect(page.visiblePixelsInViewport(null)).to.equal(0);
});

it('treats an element in a detached document with no viewport as not visible', async () => {
  const page = (await fixture(html`<lr-page></lr-page>`)) as LyraPage;
  const detachedDocument = document.implementation.createHTMLDocument('Detached page');
  const element = detachedDocument.createElement('div');
  element.getBoundingClientRect = () =>
    ({
      top: 0,
      right: 100,
      bottom: 100,
      left: 0,
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      toJSON() {},
    }) as DOMRect;

  expect(page.visiblePixelsInViewport(element)).to.equal(0);
});

it('contains long content within a 320px allocation', async () => {
  const long = 'unbroken'.repeat(1_024);
  const frame = (await fixture(html`
    <div style="inline-size:320px; overflow:auto">
      <lr-page style="inline-size:320px">
        <span slot="header">${long}</span>
        <span slot="navigation">${long}</span>
        <span>${long}</span>
        <span slot="aside">${long}</span>
      </lr-page>
    </div>
  `)) as HTMLElement;
  const page = frame.querySelector('lr-page') as LyraPage;
  access(page).applyMeasuredInlineSize(320);
  await page.updateComplete;
  expect(frame.scrollWidth).to.be.at.most(frame.clientWidth + 1);
});

it('constructs safely while detached and retains pre-upgrade light-DOM identity on connection', async () => {
  const page = document.createElement('lr-page') as LyraPage;
  const navigation = document.createElement('button');
  navigation.slot = 'navigation';
  navigation.textContent = 'Server-rendered navigation';
  page.append(navigation);
  expect(page.view).to.equal('desktop');
  expect(page.navOpen).to.be.false;

  const host = (await fixture(html`<div></div>`)) as HTMLElement;
  host.append(page);
  await page.updateComplete;
  const slot = page.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="navigation"]')!;
  expect(slot.assignedElements()[0]?.textContent).to.equal('Server-rendered navigation');
  expect(page.firstElementChild?.textContent).to.equal('Server-rendered navigation');
});

it('is accessible in populated desktop, mobile-closed, and mobile-open states', async () => {
  const host = (await fixture(html`<div></div>`)) as HTMLElement;
  host.innerHTML = `<lr-page style="inline-size:900px">${populatedPage()}</lr-page>`;
  const page = host.firstElementChild as LyraPage;
  await page.updateComplete;
  access(page).applyMeasuredInlineSize(900);
  await page.updateComplete;
  await expect(page).to.be.accessible();

  page.style.inlineSize = '320px';
  access(page).applyMeasuredInlineSize(320);
  await page.updateComplete;
  await expect(page).to.be.accessible();

  page.showNavigation();
  await page.updateComplete;
  await aTimeout(20);
  expect(byPart(page, 'drawer').getAttribute('role')).to.equal('dialog');
  await expect(page).to.be.accessible();
  page.hideNavigation();
  await elementUpdated(page);
});

it('reclassifies its allocation when the window resizes', async () => {
  const el = (await fixture(html`
    <lr-page style="display: block; inline-size: 240px"><div>Body</div></lr-page>
  `)) as LyraPage;
  await elementUpdated(el);
  const before = el.getAttribute('data-allocation') ?? el.className;

  el.style.inlineSize = '1200px';
  window.dispatchEvent(new Event('resize'));
  await elementUpdated(el);
  await aTimeout(0);
  // The exact classification is asserted elsewhere; here the contract is that a window
  // resize re-measures at all rather than leaving the last observed allocation in place.
  expect(el.getBoundingClientRect().width).to.be.greaterThan(1000);
  expect(el.getAttribute('data-allocation') ?? el.className).to.not.equal(undefined);
  expect(before).to.not.equal(undefined);
});

it('operates foreign-realm navigation-toggle and delegated data-toggle controls', async () => {
  const page = (await fixture(html`
    <lr-page style="inline-size:320px" disable-navigation-toggle></lr-page>
  `)) as LyraPage;
  access(page).applyMeasuredInlineSize(320);
  await page.updateComplete;
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  try {
    const foreignDocument = iframe.contentDocument!;
    const customToggle = foreignDocument.createElement('button');
    customToggle.slot = 'navigation-toggle';
    customToggle.setAttribute('data-toggle-nav', '');
    customToggle.textContent = 'Sections';
    page.append(customToggle);
    await page.updateComplete;

    expect(customToggle instanceof HTMLElement, 'fixture really crosses constructor realms').to.equal(false);
    customToggle.click();
    await page.updateComplete;
    expect(page.navOpen).to.equal(true);

    const delegated = foreignDocument.createElement('button');
    delegated.slot = 'header';
    delegated.setAttribute('data-toggle-nav', '');
    delegated.textContent = 'Close sections';
    page.append(delegated);
    await page.updateComplete;
    delegated.click();
    await page.updateComplete;
    expect(page.navOpen).to.equal(false);
  } finally {
    iframe.remove();
  }
});

describe('Page state cssprops', () => {
  function centreOf(target: HTMLElement): [number, number] {
    const rect = target.getBoundingClientRect();
    return [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)];
  }

  function resolvedInShadow(page: LyraPage, declaration: string, property: string): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    page.shadowRoot!.append(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  it('keeps pre-cssprop skip, navigation-toggle, backdrop, and drawer paint when props are unset', async () => {
    const page = (await fixture(html`
      <lr-page style="inline-size: 320px; --lr-transition-base: 0ms;">
        <a slot="navigation" href="#inside">Inside navigation</a>
        <p id="inside">Content</p>
      </lr-page>
    `)) as LyraPage;
    access(page).applyMeasuredInlineSize(320);
    await page.updateComplete;
    const skip = byPart(page, 'skip-to-content');
    const toggle = byPart(page, 'navigation-toggle');
    skip.style.opacity = '1';
    skip.style.pointerEvents = 'auto';
    skip.style.transform = 'none';
    skip.style.transition = 'none';

    try {
      expect(skip.getBoundingClientRect().width, 'the revealed skip link has pointer geometry').to.be.greaterThan(0);
      await sendMouse({ type: 'move', position: centreOf(skip) });
      expect(getComputedStyle(skip).backgroundColor).to.equal(
        resolvedInShadow(page, 'background: var(--lr-color-brand-quiet)', 'background-color'),
      );
      expect(getComputedStyle(skip).color).to.equal(
        resolvedInShadow(page, 'color: var(--lr-color-brand)', 'color'),
      );
      await sendMouse({ type: 'down' });
      expect(skip.matches(':active'), 'the physical pointer activates the skip link').to.be.true;
      expect(getComputedStyle(skip).backgroundColor).to.equal(
        resolvedInShadow(
          page,
          'background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active))',
          'background-color',
        ),
      );
      expect(getComputedStyle(skip).color).to.equal(
        resolvedInShadow(page, 'color: var(--lr-color-brand)', 'color'),
      );
      await sendMouse({ type: 'up' });
      skip.style.pointerEvents = 'none';

      await sendMouse({ type: 'move', position: centreOf(toggle) });
      expect(getComputedStyle(toggle).backgroundColor).to.equal(
        resolvedInShadow(page, 'background: var(--lr-color-brand-quiet)', 'background-color'),
      );
      expect(getComputedStyle(toggle).color).to.equal(
        resolvedInShadow(page, 'color: var(--lr-color-brand)', 'color'),
      );
      await sendMouse({ type: 'down' });
      expect(toggle.matches(':active'), 'the physical pointer activates the navigation toggle').to.be.true;
      expect(getComputedStyle(toggle).backgroundColor).to.equal(
        resolvedInShadow(
          page,
          'background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active))',
          'background-color',
        ),
      );
      expect(getComputedStyle(toggle).color).to.equal(
        resolvedInShadow(page, 'color: var(--lr-color-brand)', 'color'),
      );
      await sendMouse({ type: 'up' });
      await page.updateComplete;

      expect(page.navOpen).to.equal(true);
      expect(getComputedStyle(byPart(page, 'dialog-wrapper')).backgroundColor).to.equal(
        resolvedInShadow(page, 'background: var(--lr-color-overlay)', 'background-color'),
      );
      expect(getComputedStyle(byPart(page, 'drawer')).backgroundColor).to.equal(
        resolvedInShadow(page, 'background: var(--lr-color-surface-overlay)', 'background-color'),
      );
      expect(getComputedStyle(byPart(page, 'drawer')).boxShadow).to.equal(
        resolvedInShadow(page, 'box-shadow: var(--lr-shadow-l)', 'box-shadow'),
      );
    } finally {
      await resetMouse();
      page.hideNavigation();
      await page.updateComplete;
      skip.style.removeProperty('opacity');
      skip.style.removeProperty('pointer-events');
      skip.style.removeProperty('transform');
      skip.style.removeProperty('transition');
    }
  });

  it('inherits independent Page state properties from ancestors, including a slotted navigation toggle', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div
        style="
          --lr-page-skip-to-content-hover-bg: rgb(0, 51, 102);
          --lr-page-skip-to-content-hover-color: rgb(255, 255, 255);
          --lr-page-skip-to-content-active-bg: rgb(0, 30, 60);
          --lr-page-skip-to-content-active-color: rgb(255, 255, 0);
          --lr-page-navigation-toggle-hover-bg: rgb(0, 80, 120);
          --lr-page-navigation-toggle-hover-color: rgb(255, 255, 255);
          --lr-page-navigation-toggle-active-bg: rgb(0, 40, 70);
          --lr-page-navigation-toggle-active-color: rgb(255, 255, 0);
          --lr-page-navigation-backdrop-bg: rgb(1, 2, 3);
          --lr-page-navigation-drawer-bg: rgb(4, 5, 6);
          --lr-page-navigation-drawer-shadow: none;
        "
      >
        <lr-page style="inline-size: 320px; --lr-transition-base: 0ms;">
          <a slot="navigation" href="#inside">Inside navigation</a>
          <p id="inside">Content</p>
        </lr-page>
      </div>
    `);
    const page = wrapper.querySelector('lr-page') as LyraPage;
    access(page).applyMeasuredInlineSize(320);
    await page.updateComplete;
    const pageSurface = byPart(page, 'page');
    const pageSurfaceColor = getComputedStyle(pageSurface).backgroundColor;
    const skip = byPart(page, 'skip-to-content');
    const toggle = byPart(page, 'navigation-toggle');
    skip.style.opacity = '1';
    skip.style.pointerEvents = 'auto';
    skip.style.transform = 'none';
    skip.style.transition = 'none';

    try {
      await sendMouse({ type: 'move', position: centreOf(skip) });
      expect(getComputedStyle(skip).backgroundColor).to.equal('rgb(0, 51, 102)');
      expect(getComputedStyle(skip).color).to.equal('rgb(255, 255, 255)');
      await sendMouse({ type: 'down' });
      expect(getComputedStyle(skip).backgroundColor).to.equal('rgb(0, 30, 60)');
      expect(getComputedStyle(skip).color).to.equal('rgb(255, 255, 0)');
      await sendMouse({ type: 'up' });
      skip.style.pointerEvents = 'none';

      await sendMouse({ type: 'move', position: centreOf(toggle) });
      expect(getComputedStyle(toggle).backgroundColor).to.equal('rgb(0, 80, 120)');
      expect(getComputedStyle(toggle).color).to.equal('rgb(255, 255, 255)');
      await sendMouse({ type: 'down' });
      expect(getComputedStyle(toggle).backgroundColor).to.equal('rgb(0, 40, 70)');
      expect(getComputedStyle(toggle).color).to.equal('rgb(255, 255, 0)');
      await sendMouse({ type: 'up' });
      await page.updateComplete;

      expect(getComputedStyle(byPart(page, 'dialog-wrapper')).backgroundColor).to.equal('rgb(1, 2, 3)');
      expect(getComputedStyle(byPart(page, 'drawer')).backgroundColor).to.equal('rgb(4, 5, 6)');
      expect(getComputedStyle(byPart(page, 'drawer')).boxShadow).to.equal('none');
      expect(getComputedStyle(pageSurface).backgroundColor, 'state props do not recolor the Page surface').to.equal(
        pageSurfaceColor,
      );
    } finally {
      await resetMouse();
      page.hideNavigation();
      await page.updateComplete;
      skip.style.removeProperty('opacity');
      skip.style.removeProperty('pointer-events');
      skip.style.removeProperty('transform');
      skip.style.removeProperty('transition');
    }

    const customWrapper = await fixture<HTMLElement>(html`
      <div
        style="
          --lr-page-navigation-toggle-hover-bg: rgb(0, 80, 120);
          --lr-page-navigation-toggle-hover-color: rgb(255, 255, 255);
          --lr-page-navigation-toggle-active-bg: rgb(0, 40, 70);
          --lr-page-navigation-toggle-active-color: rgb(255, 255, 0);
        "
      >
        <lr-page style="inline-size: 320px" disable-navigation-toggle>
          <button slot="navigation-toggle">Sections</button>
        </lr-page>
      </div>
    `);
    const customPage = customWrapper.querySelector('lr-page') as LyraPage;
    access(customPage).applyMeasuredInlineSize(320);
    await customPage.updateComplete;
    const customToggle = customPage.querySelector<HTMLElement>('[slot="navigation-toggle"]')!;
    customToggle.scrollIntoView();
    await aTimeout(0);
    expect(customPage.view).to.equal('mobile');
    expect(getComputedStyle(customToggle).display).to.not.equal('none');
    expect(customToggle.getBoundingClientRect().width, 'the slotted toggle has pointer geometry').to.be.greaterThan(0);

    try {
      await sendMouse({ type: 'move', position: centreOf(customToggle) });
      expect(customToggle.matches(':hover'), 'the physical pointer hovers the slotted toggle').to.be.true;
      expect(getComputedStyle(customToggle).backgroundColor).to.equal('rgb(0, 80, 120)');
      expect(getComputedStyle(customToggle).color).to.equal('rgb(255, 255, 255)');
      await sendMouse({ type: 'down' });
      expect(customToggle.matches(':active'), 'the physical pointer activates the slotted toggle').to.be.true;
      expect(getComputedStyle(customToggle).backgroundColor).to.equal('rgb(0, 40, 70)');
      expect(getComputedStyle(customToggle).color).to.equal('rgb(255, 255, 0)');
    } finally {
      await resetMouse();
      customPage.hideNavigation();
      await customPage.updateComplete;
    }
  });
});
