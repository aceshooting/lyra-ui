import { fixture, expect, html } from '@open-wc/testing';
import './progress-bar.js';
import './progress-ring.js';
import type { LyraProgressBar } from './progress-bar.js';

it('renders determinate progress with a bounded value', async () => {
  const el = (await fixture(html`<lyra-progress-bar value="25" max="50"></lyra-progress-bar>`)) as LyraProgressBar;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-valuenow')).to.equal('25');
  expect(base.querySelector('[part="indicator"]')?.getAttribute('style')).to.contain('50%');
  await expect(el).to.be.accessible();
});

it('omits aria-valuenow for indeterminate progress', async () => {
  const el = (await fixture(html`<lyra-progress-bar indeterminate></lyra-progress-bar>`)) as LyraProgressBar;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.hasAttribute('aria-valuenow')).to.be.false;
});

it('renders an accessible progress ring', async () => {
  const el = await fixture(html`<lyra-progress-ring value="40"></lyra-progress-ring>`);
  await expect(el).to.be.accessible();
});
