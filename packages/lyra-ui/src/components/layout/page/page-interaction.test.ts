import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-page.js';
import type { LyraPage } from '../../lr-page.js';

const part = (el: LyraPage, name: string): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;

describe('lr-page interactions', () => {
  it('gives the sticky menu and aside an opaque default background', async () => {
    const el = await fixture<LyraPage>(html`<lr-page><nav slot="menu">M</nav><p slot="aside">A</p>Main</lr-page>`);
    expect(getComputedStyle(part(el, 'menu')).backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(part(el, 'aside')).backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
  });

  it('retints the sticky menu and aside through public tokens', async () => {
    const el = await fixture<LyraPage>(html`<lr-page
      style="--lr-page-menu-bg: rgb(1, 2, 3); --lr-page-aside-bg: rgb(4, 5, 6)"
      ><nav slot="menu">M</nav><p slot="aside">A</p>Main</lr-page
    >`);
    expect(getComputedStyle(part(el, 'menu')).backgroundColor).to.equal('rgb(1, 2, 3)');
    expect(getComputedStyle(part(el, 'aside')).backgroundColor).to.equal('rgb(4, 5, 6)');
  });

  it('leaves the background unpainted when sticky is disabled for the region', async () => {
    const el = await fixture<LyraPage>(html`<lr-page disable-sticky="menu"><nav slot="menu">M</nav>Main</lr-page>`);
    expect(getComputedStyle(part(el, 'menu')).backgroundColor).to.equal('rgba(0, 0, 0, 0)');
  });

  it('renders no aside or footer landmark while their slots are empty', async () => {
    const el = await fixture<LyraPage>(html`<lr-page>Main</lr-page>`);
    for (const name of ['aside', 'footer']) {
      expect(part(el, name).hidden, `${name} hidden`).to.equal(true);
      expect(getComputedStyle(part(el, name)).display).to.equal('none');
    }
  });

  it('renders the aside and footer once their slots have content', async () => {
    const el = await fixture<LyraPage>(html`<lr-page><p slot="aside">A</p><p slot="footer">F</p>Main</lr-page>`);
    for (const name of ['aside', 'footer']) {
      expect(part(el, name).hidden, `${name} hidden`).to.equal(false);
      expect(getComputedStyle(part(el, name)).display).to.not.equal('none');
    }
    el.querySelector('[slot="aside"]')!.remove();
    await el.updateComplete;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await el.updateComplete;
    expect(part(el, 'aside').hidden).to.equal(true);
  });
});

it('preserves an explicit navOpen write by a request listener', async () => {
  const el = await fixture<LyraPage>(html`<lr-page>Body</lr-page>`);
  let commits = 0;
  el.addEventListener('lr-nav-toggle-request', () => { el.navOpen = false; });
  el.addEventListener('lr-nav-open-change', () => commits++);
  el.showNavigation();
  await el.updateComplete;
  expect(el.navOpen).to.equal(false);
  expect(commits).to.equal(0);
});

it('classifies a scaled container by its layout width before observer delivery', async () => {
  const saved = window.ResizeObserver;
  Reflect.set(window, 'ResizeObserver', undefined);
  try {
    const wrapper = await fixture<HTMLElement>(html`<div style="transform: scale(0.5)">
      <lr-page style="inline-size: 900px">Content</lr-page>
    </div>`);
    const el = wrapper.querySelector('lr-page')!;
    await el.updateComplete;
    expect(el.view).to.equal('desktop');
  } finally {
    Reflect.set(window, 'ResizeObserver', saved);
  }
});

it('accepts a programmatic accessibleLabel on the navigation', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-page']>(html`<lr-page >Body</lr-page>`);
  el.accessibleLabel = 'Quarterly results';
  await el.updateComplete;
  const owner = el.shadowRoot!.querySelector('[part~="navigation"]')!;
  expect(owner.getAttribute('aria-label')).to.equal('Quarterly results');
});

it('exposes the header landmark only when the header has content or a mobile toggle', async () => {
  const el = await fixture<LyraPage>(html`<lr-page style="inline-size:1200px">Body</lr-page>`);
  const header = part(el, 'header');
  expect(header.getAttribute('role')).to.equal('presentation');
  const heading = document.createElement('h1');
  heading.slot = 'header';
  heading.textContent = 'Projects';
  el.append(heading);
  await waitUntil(() => header.getAttribute('role') === null, 'the slotted header becomes a landmark');
  heading.remove();
  el.style.inlineSize = '320px';
  await waitUntil(() => el.view === 'mobile', 'mobile navigation appears');
  expect(header.getAttribute('role')).to.equal(null);
});
