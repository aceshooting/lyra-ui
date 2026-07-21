import { fixture, expect, html } from '@open-wc/testing';
import './badge.js';
import './tag.js';
import type { LyraBadge } from './badge.js';
import { styles } from './badge.styles.js';

it('renders a themed badge and tag alias', async () => {
  const el = await fixture(html`<div><lr-badge variant="success">Ready</lr-badge><lr-tag>Tag</lr-tag></div>`);
  expect(el.querySelector('lr-badge')?.textContent).to.contain('Ready');
  expect(el.querySelector('lr-tag')).to.exist;
  await expect(el.querySelector('lr-badge')!).to.be.accessible();
});

it('defaults size to "m" and offers the same 2xs-xl scale as its sibling lr-chip', async () => {
  const el = (await fixture(html`<lr-badge>Default</lr-badge>`)) as LyraBadge;
  expect(el.size).to.equal('m');
  expect(getComputedStyle(el).getPropertyValue('--lr-badge-font-size').trim()).to.equal(
    getComputedStyle(el).getPropertyValue('--lr-font-size-sm').trim(),
  );
});

it('resizes the badge surface when size is set to a smaller or larger tier', async () => {
  const small = (await fixture(html`<lr-badge size="2xs">S</lr-badge>`)) as LyraBadge;
  const large = (await fixture(html`<lr-badge size="xl">L</lr-badge>`)) as LyraBadge;
  const smallBase = small.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const largeBase = large.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(parseFloat(getComputedStyle(smallBase).fontSize)).to.be.lessThan(
    parseFloat(getComputedStyle(largeBase).fontSize),
  );
  expect(parseFloat(getComputedStyle(smallBase).minBlockSize)).to.be.lessThan(
    parseFloat(getComputedStyle(largeBase).minBlockSize),
  );
});

it('exposes --lr-badge-radius, defaulting to the pre-existing pill radius', async () => {
  const el = (await fixture(html`<lr-badge>Go</lr-badge>`)) as LyraBadge;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(getComputedStyle(base).borderRadius).to.equal('999px');
});

it('retunes the corner radius via --lr-badge-radius with no ::part(base) rule', async () => {
  const el = (await fixture(html`<lr-badge>Go</lr-badge>`)) as LyraBadge;
  el.style.setProperty('--lr-badge-radius', '3px');
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(getComputedStyle(base).borderRadius).to.equal('3px');
});

it('declares --lr-badge-radius on :host and consumes it once on [part="base"]', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/:host \{[^}]*--lr-badge-radius: var\(--lr-radius-pill\);/);
  expect(css).to.include("border-radius: var(--lr-badge-radius);");
});
