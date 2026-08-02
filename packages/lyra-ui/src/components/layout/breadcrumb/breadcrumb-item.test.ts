import { fixture, expect, html } from '@open-wc/testing';
import './breadcrumb-item.js';
import './breadcrumb.js';
import type { LyraBreadcrumbItem } from './breadcrumb-item.js';

it('renders a link with design-token color and no default UA underline', async () => {
  const el = (await fixture(html`<lr-breadcrumb-item href="/">Home</lr-breadcrumb-item>`)) as LyraBreadcrumbItem;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLAnchorElement;
  const style = getComputedStyle(base);
  // Browser default unvisited-link color is rgb(0, 0, 238); a token-styled link must not fall back to it.
  expect(style.color).to.not.equal('rgb(0, 0, 238)');
  expect(style.textDecorationLine).to.equal('none');
  expect(base.getAttribute('aria-current')).to.equal('false');
});

it('renders a native button when a non-current item has no href', async () => {
  const breadcrumb = await fixture(html`
    <lr-breadcrumb><lr-breadcrumb-item>Open menu</lr-breadcrumb-item></lr-breadcrumb>
  `);
  const el = breadcrumb.querySelector('lr-breadcrumb-item') as LyraBreadcrumbItem;
  const button = el.shadowRoot!.querySelector<HTMLButtonElement>('button[part="base"]');
  expect(button).to.exist;
  expect(button!.type).to.equal('button');
  expect(button!.getAttribute('aria-current')).to.equal('false');
  await expect(breadcrumb).to.be.accessible();
});

it('supports both upstream adornment vocabularies and part aliases', async () => {
  const el = (await fixture(html`
    <lr-breadcrumb-item href="/reports">
      <span slot="start">S</span><span slot="prefix">P</span>
      Reports
      <span slot="end">E</span><span slot="suffix">X</span>
      <span slot="separator">→</span>
    </lr-breadcrumb-item>
  `)) as LyraBreadcrumbItem;
  expect(el.shadowRoot!.querySelector('[part="base"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="label"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part~="start"][part~="prefix"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part~="end"][part~="suffix"]')).to.exist;
  for (const name of ['start', 'prefix', 'end', 'suffix', 'separator']) {
    const slot = el.shadowRoot!.querySelector<HTMLSlotElement>(`slot[name="${name}"]`)!;
    expect(slot.assignedNodes({ flatten: true }).length, name).to.be.greaterThan(0);
  }
});

it('forwards target and derives a safe rel without exposing an independent rel property', async () => {
  const el = (await fixture(html`
    <lr-breadcrumb-item href="https://example.com" target="_blank">Example</lr-breadcrumb-item>
  `)) as LyraBreadcrumbItem;
  const anchor = el.shadowRoot!.querySelector('a')!;
  expect(anchor.getAttribute('target')).to.equal('_blank');
  expect(anchor.getAttribute('rel')).to.equal('noopener noreferrer');
  expect('rel' in el).to.be.false;
});

it('shows a focus ring on the link via :focus-visible', async () => {
  const el = (await fixture(html`<lr-breadcrumb-item href="/">Home</lr-breadcrumb-item>`)) as LyraBreadcrumbItem;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLAnchorElement;
  base.focus();
  await el.updateComplete;
  const style = getComputedStyle(base);
  expect(style.outlineWidth).to.equal('2px');
  expect(style.outlineOffset).to.equal('2px');
});

it('gives the current-page span a distinct font-weight from a plain link', async () => {
  const link = (await fixture(html`<lr-breadcrumb-item href="/">Home</lr-breadcrumb-item>`)) as LyraBreadcrumbItem;
  const current = (await fixture(html`<lr-breadcrumb-item current>Reports</lr-breadcrumb-item>`)) as LyraBreadcrumbItem;
  const linkBase = link.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const currentBase = current.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(getComputedStyle(currentBase).fontWeight).to.not.equal(getComputedStyle(linkBase).fontWeight);
  expect(currentBase.getAttribute('aria-current')).to.equal('page');
});

it('is accessible', async () => {
  // Wrapped in <lr-breadcrumb> so the item's self-applied role="listitem" has the
  // role="list" ancestor axe's aria-required-parent rule expects (breadcrumb.class.ts
  // renders that role on its own shadow-DOM [part="list"] wrapper).
  const el = await fixture(html`<lr-breadcrumb><lr-breadcrumb-item href="/">Home</lr-breadcrumb-item></lr-breadcrumb>`);
  await expect(el).to.be.accessible();
});

describe('current-state cssprop', () => {
  /** Resolves what a `declaration` would compute to *inside this component's shadow root*, where the
   *  `--lr-*` design tokens actually live. Used to assert the unset default byte-for-byte against
   *  the token it falls back to. */
  function resolvedInShadow(el: LyraBreadcrumbItem, declaration: string, property: string): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    el.shadowRoot!.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  async function themedItem(style: string): Promise<LyraBreadcrumbItem> {
    const wrapper = (await fixture(html`
      <div style=${style}>
        <lr-breadcrumb><lr-breadcrumb-item current>Reports</lr-breadcrumb-item></lr-breadcrumb>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-breadcrumb-item') as LyraBreadcrumbItem;
    await el.updateComplete;
    return el;
  }

  it('recolors the current-page item from an ancestor, not a :host-declared prop', async () => {
    const el = await themedItem('--lr-breadcrumb-current-color: rgb(0, 51, 102);');
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('aria-current')).to.equal('page');
    expect(getComputedStyle(base).color).to.equal('rgb(0, 51, 102)');
  });

  it('renders byte-identically to the pre-cssprop output when the prop is unset', async () => {
    const el = await themedItem('');
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(base).color).to.equal(
      resolvedInShadow(el, 'color: var(--lr-color-text-quiet)', 'color'),
    );
  });

  it('is accessible with the current-state prop themed', async () => {
    const el = await fixture(html`
      <div style="--lr-breadcrumb-current-color: rgb(0, 51, 102);">
        <lr-breadcrumb>
          <lr-breadcrumb-item href="/">Home</lr-breadcrumb-item>
          <lr-breadcrumb-item current>Reports</lr-breadcrumb-item>
        </lr-breadcrumb>
      </div>
    `);
    await expect(el.querySelector('lr-breadcrumb')!).to.be.accessible();
  });
});
