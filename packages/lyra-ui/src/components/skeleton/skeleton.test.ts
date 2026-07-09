import { fixture, expect, html } from '@open-wc/testing';
import './skeleton.js';
import type { LyraSkeleton } from './skeleton.js';

it('defaults to a text variant with a status role', async () => {
  const el = (await fixture(html`<lyra-skeleton></lyra-skeleton>`)) as LyraSkeleton;
  expect(el.variant).to.equal('text');
  expect(el.getAttribute('role')).to.equal('status');
});

it('applies explicit width/height as inline custom properties', async () => {
  const el = (await fixture(
    html`<lyra-skeleton variant="circle" width="3rem" height="3rem"></lyra-skeleton>`,
  )) as LyraSkeleton;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.style.getPropertyValue('--lyra-skeleton-w')).to.equal('3rem');
  expect(base.style.getPropertyValue('--lyra-skeleton-h')).to.equal('3rem');
});

it('is accessible', async () => {
  const el = (await fixture(html`<lyra-skeleton></lyra-skeleton>`)) as LyraSkeleton;
  await expect(el).to.be.accessible();
});
