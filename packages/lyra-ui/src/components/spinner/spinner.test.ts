import { fixture, expect, html } from '@open-wc/testing';
import './spinner.js';
import type { LyraSpinner } from './spinner.js';
import { styles } from './spinner.styles.js';

it('renders a localized busy status', async () => {
  const el = (await fixture(html`<lr-spinner></lr-spinner>`)) as LyraSpinner;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('role')).to.equal('status');
  expect(base.getAttribute('aria-label')).to.equal('Loading…');
  await expect(el).to.be.accessible();
});

it('lets a host aria-label override the localized default', async () => {
  const el = (await fixture(html`<lr-spinner aria-label="Loading users"></lr-spinner>`)) as LyraSpinner;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-label')).to.equal('Loading users');
});

it('keeps the slotted label sr-only when label-placement is "none" (default)', async () => {
  const el = (await fixture(html`<lr-spinner>Loading data</lr-spinner>`)) as LyraSpinner;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  expect(label.hidden).to.be.true;
});

it('shows the slotted label in flow when label-placement is "after"', async () => {
  const el = (await fixture(html`<lr-spinner label-placement="after">Loading data</lr-spinner>`)) as LyraSpinner;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  expect(label.hidden).to.be.false;
  const computed = getComputedStyle(label);
  expect(computed.position).to.not.equal('absolute');
  expect(computed.clipPath).to.not.equal('inset(50%)');
});

it('stops the spin animation under prefers-reduced-motion', () => {
  const css = styles.cssText;
  const reducedMotion = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*{\s*\[part=['"]?spinner['"]?]\s*{([^}]*)}/.exec(css);
  expect(reducedMotion, 'expected a reduced-motion override for [part="spinner"]').to.not.equal(null);
  expect(reducedMotion![1]).to.include('animation: none');
});
