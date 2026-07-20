import { fixture, expect, html } from '@open-wc/testing';
import './badge.js';
import './tag.js';
import type { LyraBadge } from './badge.js';

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
