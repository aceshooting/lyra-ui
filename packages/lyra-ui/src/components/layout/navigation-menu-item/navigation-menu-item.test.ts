import { aTimeout, expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import { ignoreResizeObserverLoopErrors } from '../../../../test/resize-observer-noise.js';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import type {
  LyraNavigationMenuItem,
  LyraNavigationMenuToggleDetail,
} from './navigation-menu-item.class.js';
import './navigation-menu-item.js';

ignoreResizeObserverLoopErrors('collapse toggles host block size');

function base(item: LyraNavigationMenuItem): HTMLElement {
  return item.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
}

function panel(item: LyraNavigationMenuItem): HTMLElement {
  return item.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')!;
}

function part(item: LyraNavigationMenuItem, name: string): HTMLElement {
  return item.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;
}

function recordToggles(item: LyraNavigationMenuItem): LyraNavigationMenuToggleDetail[] {
  const events: LyraNavigationMenuToggleDetail[] = [];
  item.addEventListener('lr-toggle', (event) => {
    if (event.target !== item) return;
    events.push((event as CustomEvent<LyraNavigationMenuToggleDetail>).detail);
  });
  return events;
}

async function settle(item: LyraNavigationMenuItem): Promise<void> {
  await item.updateComplete;
  await nextFrame();
  await item.updateComplete;
}

describe('<lr-navigation-menu-item>', () => {
  it('renders a link item as a native anchor with aria-current page or false', async () => {
    const current = await fixture<LyraNavigationMenuItem>(
      html`<lr-navigation-menu-item href="/docs" current>Docs</lr-navigation-menu-item>`,
    );
    await settle(current);
    expect(base(current).localName).to.equal('a');
    expect(base(current).getAttribute('href')).to.equal('/docs');
    expect(base(current).getAttribute('aria-current')).to.equal('page');
    expect(base(current).getAttribute('part')).to.equal('base base-current');

    const other = await fixture<LyraNavigationMenuItem>(
      html`<lr-navigation-menu-item href="/blog">Blog</lr-navigation-menu-item>`,
    );
    await settle(other);
    expect(base(other).getAttribute('aria-current')).to.equal('false');
    expect(base(other).getAttribute('part')).to.equal('base');
  });

  it('renders an unsafe javascript href as a button', async () => {
    const el = await fixture<LyraNavigationMenuItem>(
      html`<lr-navigation-menu-item href="javascript:alert(1)">Unsafe</lr-navigation-menu-item>`,
    );
    await settle(el);
    expect(base(el).localName).to.equal('button');
    expect(base(el).hasAttribute('href')).to.equal(false);
  });

  it('merges rel through the shared guard', async () => {
    const cases: Array<[string | null, string | null, string | null]> = [
      [null, '_blank', 'noopener noreferrer'],
      ['nofollow OPENER', '_blank', 'nofollow noopener noreferrer'],
      ['me', null, 'me'],
      [null, null, null],
    ];
    for (const [rel, target, expected] of cases) {
      const el = await fixture<LyraNavigationMenuItem>(
        html`<lr-navigation-menu-item href="https://example.com/">External</lr-navigation-menu-item>`,
      );
      if (rel !== null) el.rel = rel;
      if (target !== null) el.target = target;
      await settle(el);
      expect(base(el).getAttribute('rel'), `rel=${rel} target=${target}`).to.equal(expected);
      expect(base(el).getAttribute('target')).to.equal(target);
    }
  });

  it('never displays a link item panel and refuses open without announcing it', async () => {
    const el = await fixture<LyraNavigationMenuItem>(html`
      <lr-navigation-menu-item href="/products">
        Products
        <div slot="panel"><a href="/a">A</a></div>
      </lr-navigation-menu-item>
    `);
    await settle(el);
    const events = recordToggles(el);
    expect(base(el).localName).to.equal('a');
    el.open = true;
    await settle(el);
    expect(el.open).to.equal(false);
    expect(el.hasAttribute('open')).to.equal(false);
    expect(panel(el).hidden).to.equal(true);
    el.setAttribute('open', '');
    await settle(el);
    expect(el.open).to.equal(false);
    expect(el.hasAttribute('open')).to.equal(false);
    await aTimeout(20);
    expect(events).to.have.length(0);
  });

  it('renders a plain button with no disclosure state when the panel slot is empty', async () => {
    const el = await fixture<LyraNavigationMenuItem>(
      html`<lr-navigation-menu-item>Sign in</lr-navigation-menu-item>`,
    );
    await settle(el);
    expect(base(el).localName).to.equal('button');
    expect(base(el).hasAttribute('aria-expanded')).to.equal(false);
    expect(base(el).hasAttribute('aria-controls')).to.equal(false);
    expect(base(el).hasAttribute('aria-current')).to.equal(false);
    expect(part(el, 'expand-icon').hidden).to.equal(true);
    el.open = true;
    await settle(el);
    expect(el.open).to.equal(false);
  });

  it('keeps a trigger current state visual only', async () => {
    const el = await fixture<LyraNavigationMenuItem>(html`
      <lr-navigation-menu-item current>Products<div slot="panel"><a href="/a">A</a></div></lr-navigation-menu-item>
    `);
    await settle(el);
    expect(base(el).hasAttribute('aria-current')).to.equal(false);
    expect(base(el).getAttribute('part')).to.equal('base base-current');
    expect(base(el).getAttribute('aria-expanded')).to.equal('false');
  });

  it('forwards a host aria-label by presence, including an empty value', async () => {
    const named = await fixture<LyraNavigationMenuItem>(
      html`<lr-navigation-menu-item aria-label="Home page" href="/">Home</lr-navigation-menu-item>`,
    );
    await settle(named);
    expect(base(named).getAttribute('aria-label')).to.equal('Home page');

    const empty = await fixture<LyraNavigationMenuItem>(
      html`<lr-navigation-menu-item aria-label="">Menu</lr-navigation-menu-item>`,
    );
    await settle(empty);
    expect(base(empty).hasAttribute('aria-label')).to.equal(true);
    expect(base(empty).getAttribute('aria-label')).to.equal('');

    const unset = await fixture<LyraNavigationMenuItem>(
      html`<lr-navigation-menu-item>Menu</lr-navigation-menu-item>`,
    );
    await settle(unset);
    expect(base(unset).hasAttribute('aria-label')).to.equal(false);
  });

  it('forwards focus() and click() to the base', async () => {
    const el = await fixture<LyraNavigationMenuItem>(html`
      <lr-navigation-menu-item>Products<div slot="panel"><a href="/a">A</a></div></lr-navigation-menu-item>
    `);
    await settle(el);
    el.focus();
    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.contain('base');
    el.click();
    await settle(el);
    expect(el.open).to.equal(true);
    el.click();
    await settle(el);
    expect(el.open).to.equal(false);
  });

  it('keeps the caret wrapper inert and aria-hidden and renders a slotted replacement', async () => {
    const el = await fixture<LyraNavigationMenuItem>(html`
      <lr-navigation-menu-item
        >Products<span slot="expand-icon" id="custom-caret">v</span
        ><div slot="panel"><a href="/a">A</a></div></lr-navigation-menu-item
      >
    `);
    await settle(el);
    const wrapper = part(el, 'expand-icon');
    expect(wrapper.getAttribute('aria-hidden')).to.equal('true');
    expect(wrapper.hasAttribute('inert')).to.equal(true);
    expect(wrapper.hidden).to.equal(false);
    const slot = wrapper.querySelector('slot')!;
    expect(slot.assignedElements().map((node) => node.id)).to.deep.equal(['custom-caret']);
    const custom = el.querySelector<HTMLElement>('#custom-caret')!;
    expect(custom.getBoundingClientRect().width).to.be.greaterThan(0);
  });

  it('opens in flow when unowned, without positioning or hover, and passes axe while open', async () => {
    const el = await fixture<LyraNavigationMenuItem>(html`
      <lr-navigation-menu-item>
        Products
        <ul slot="panel"><li><a href="/a">Analytics</a></li><li><a href="/b">Billing</a></li></ul>
      </lr-navigation-menu-item>
    `);
    await settle(el);
    const events = recordToggles(el);
    try {
      await hoverUntilMatched(base(el), 'the pointer never reached the unowned trigger');
      await aTimeout(300);
      expect(el.open, 'an unowned item never opens on hover').to.equal(false);
    } finally {
      await resetMouse();
    }
    base(el).click();
    await settle(el);
    expect(el.open).to.equal(true);
    expect(events).to.deep.equal([{ open: true, source: 'user' }]);
    const surface = panel(el);
    expect(surface.hidden).to.equal(false);
    expect(surface.getBoundingClientRect().height).to.be.greaterThan(0);
    expect(getComputedStyle(surface).position).to.equal('static');
    expect(surface.style.left).to.equal('');
    expect(base(el).getAttribute('aria-expanded')).to.equal('true');
    expect(base(el).getAttribute('aria-controls')).to.equal(surface.id);
    expect(base(el).getAttribute('part')).to.equal('base base-open');
    await expect(el).to.be.accessible();
    base(el).click();
    await settle(el);
    expect(el.open).to.equal(false);
    expect(surface.hidden).to.equal(true);
    expect(events).to.deep.equal([
      { open: true, source: 'user' },
      { open: false, source: 'user' },
    ]);
  });

  it('emits no lr-toggle for initial open markup and announces programmatic writes', async () => {
    const container = await fixture<HTMLDivElement>(html`<div></div>`);
    const el = document.createElement('lr-navigation-menu-item') as LyraNavigationMenuItem;
    el.innerHTML = 'Products<div slot="panel"><a href="/a">A</a></div>';
    el.setAttribute('open', '');
    const events = recordToggles(el);
    container.append(el);
    await settle(el);
    expect(el.open).to.equal(true);
    expect(panel(el).hidden).to.equal(false);
    await aTimeout(20);
    expect(events).to.have.length(0);
    el.open = false;
    await settle(el);
    expect(events).to.deep.equal([{ open: false, source: 'programmatic' }]);
  });

  it('follows focus to the new base when href is set on a focused trigger', async () => {
    const el = await fixture<LyraNavigationMenuItem>(html`
      <lr-navigation-menu-item>Products<div slot="panel"><a href="/a">A</a></div></lr-navigation-menu-item>
    `);
    await settle(el);
    base(el).focus();
    expect(el.shadowRoot!.activeElement?.localName).to.equal('button');
    el.href = '/products';
    await settle(el);
    await waitUntil(
      () => el.shadowRoot!.activeElement?.localName === 'a',
      'focus did not follow the base from button to link',
    );
  });

  it('floors the unowned base hit area at the icon-button size', async () => {
    const el = await fixture<LyraNavigationMenuItem>(
      html`<lr-navigation-menu-item>A</lr-navigation-menu-item>`,
    );
    await settle(el);
    const probe = document.createElement('div');
    probe.style.inlineSize = 'var(--lr-icon-button-size)';
    el.shadowRoot!.append(probe);
    const floor = probe.getBoundingClientRect().width;
    probe.remove();
    const style = getComputedStyle(base(el));
    expect(floor).to.be.at.least(40);
    expect(Number.parseFloat(style.minBlockSize)).to.be.at.least(floor - 0.5);
    expect(Number.parseFloat(style.minInlineSize)).to.be.at.least(floor - 0.5);
    const rect = base(el).getBoundingClientRect();
    expect(rect.height).to.be.at.least(floor - 0.5);
    expect(rect.width).to.be.at.least(floor - 0.5);
  });
});
