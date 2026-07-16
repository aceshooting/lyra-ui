import { fixture, expect, html } from '@open-wc/testing';
import './breadcrumb-item.js';
import './breadcrumb.js';
import type { LyraBreadcrumbItem } from './breadcrumb-item.js';

it('renders a link with design-token color and no default UA underline', async () => {
  const el = (await fixture(html`<lyra-breadcrumb-item href="/">Home</lyra-breadcrumb-item>`)) as LyraBreadcrumbItem;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLAnchorElement;
  const style = getComputedStyle(base);
  // Browser default unvisited-link color is rgb(0, 0, 238); a token-styled link must not fall back to it.
  expect(style.color).to.not.equal('rgb(0, 0, 238)');
  expect(style.textDecorationLine).to.equal('none');
});

it('shows a focus ring on the link via :focus-visible', async () => {
  const el = (await fixture(html`<lyra-breadcrumb-item href="/">Home</lyra-breadcrumb-item>`)) as LyraBreadcrumbItem;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLAnchorElement;
  base.focus();
  await el.updateComplete;
  const style = getComputedStyle(base);
  expect(style.outlineWidth).to.equal('2px');
  expect(style.outlineOffset).to.equal('2px');
});

it('gives the current-page span a distinct font-weight from a plain link', async () => {
  const link = (await fixture(html`<lyra-breadcrumb-item href="/">Home</lyra-breadcrumb-item>`)) as LyraBreadcrumbItem;
  const current = (await fixture(html`<lyra-breadcrumb-item current>Reports</lyra-breadcrumb-item>`)) as LyraBreadcrumbItem;
  const linkBase = link.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const currentBase = current.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(getComputedStyle(currentBase).fontWeight).to.not.equal(getComputedStyle(linkBase).fontWeight);
});

it('is accessible', async () => {
  // Wrapped in <lyra-breadcrumb> so the item's self-applied role="listitem" has the
  // role="list" ancestor axe's aria-required-parent rule expects (breadcrumb.class.ts
  // renders that role on its own shadow-DOM [part="list"] wrapper).
  const el = await fixture(html`<lyra-breadcrumb><lyra-breadcrumb-item href="/">Home</lyra-breadcrumb-item></lyra-breadcrumb>`);
  await expect(el).to.be.accessible();
});
