import { fixture, expect, html } from '@open-wc/testing';
import './tag.js';
import type { LyraTag } from './tag.js';

// `<lr-tag>` is a semantic alias for `<lr-badge>` (see tag.class.ts) with no behavior of its own,
// but it is still its own registered custom element (`lr-tag` in the manifest) -- badge.test.ts
// mounts one in passing but only ever runs an axe accessibility check against `lr-badge`, never
// against an `lr-tag` instance itself, which is the per-tag a11y contract every public custom
// element is expected to carry.

it('renders content and inherits the badge variant styling contract', async () => {
  const el = (await fixture(html`<lr-tag variant="success">Ready</lr-tag>`)) as LyraTag;
  expect(el.textContent).to.contain('Ready');
  expect(el.variant).to.equal('success');
  const base = el.shadowRoot!.querySelector('[part="base"]');
  expect(base?.tagName).to.equal('SPAN');
});

it('is accessible in its own right, not merely via lr-badge', async () => {
  const el = (await fixture(html`<lr-tag>Tag</lr-tag>`)) as LyraTag;
  await expect(el).to.be.accessible();
});

it('inherits the size property/scale from lr-badge', async () => {
  const el = (await fixture(html`<lr-tag size="l">Big tag</lr-tag>`)) as LyraTag;
  expect(el.size).to.equal('l');
  expect(el.getAttribute('size')).to.equal('l');
});
