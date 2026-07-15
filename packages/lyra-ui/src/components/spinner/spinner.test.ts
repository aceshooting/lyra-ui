import { fixture, expect, html } from '@open-wc/testing';
import './spinner.js';
import type { LyraSpinner } from './spinner.js';

it('renders a localized busy status', async () => {
  const el = (await fixture(html`<lyra-spinner></lyra-spinner>`)) as LyraSpinner;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('role')).to.equal('status');
  expect(base.getAttribute('aria-label')).to.equal('Loading…');
  await expect(el).to.be.accessible();
});
