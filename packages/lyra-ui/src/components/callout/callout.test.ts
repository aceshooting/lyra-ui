import { fixture, expect, html } from '@open-wc/testing';
import './callout.js';
import type { LyraCallout } from './callout.js';

it('renders status content and a localized close action', async () => {
  const el = (await fixture(html`<lyra-callout closable>Something happened</lyra-callout>`)) as LyraCallout;
  const button = el.shadowRoot!.querySelector('[part="close-button"]') as HTMLButtonElement;
  expect(button.getAttribute('aria-label')).to.equal('Close');
  expect(el.shadowRoot!.querySelector('[part="base"]')?.getAttribute('role')).to.equal('status');
  await expect(el).to.be.accessible();
});

it('allows close to be vetoed and otherwise hides', async () => {
  const el = (await fixture(html`<lyra-callout closable>Message</lyra-callout>`)) as LyraCallout;
  const button = el.shadowRoot!.querySelector('[part="close-button"]') as HTMLButtonElement;
  const veto = (event: Event) => event.preventDefault();
  el.addEventListener('lyra-close', veto);
  button.click();
  expect(el.open).to.be.true;
  el.removeEventListener('lyra-close', veto);
  const next = el.shadowRoot!.querySelector('[part="close-button"]') as HTMLButtonElement;
  next.click();
  expect(el.open).to.be.false;
});
