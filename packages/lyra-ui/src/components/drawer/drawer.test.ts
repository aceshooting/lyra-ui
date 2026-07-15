import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './drawer.js';
import type { LyraDrawer } from './drawer.js';

it('renders an open drawer with the requested placement and accessible panel', async () => {
  const el = (await fixture(html`
    <lyra-drawer open placement="end" heading="Filters">
      <p>Filter controls</p>
    </lyra-drawer>
  `)) as LyraDrawer;
  await el.updateComplete;

  const panel = el.shadowRoot!.querySelector('[part="panel"]')!;
  expect(el.getAttribute('placement')).to.equal('end');
  expect(panel.getAttribute('role')).to.equal('dialog');
  expect(panel.getAttribute('aria-modal')).to.equal('true');
  expect(panel.getAttribute('aria-labelledby')).to.match(/^lyra-dialog-heading-/);
});

it('closes through the inherited cancelable close contract', async () => {
  const el = (await fixture(html`
    <lyra-drawer open heading="Details" closable></lyra-drawer>
  `)) as LyraDrawer;
  await el.updateComplete;

  const button = el.shadowRoot!.querySelector('[part="close-button"]') as HTMLButtonElement;
  const eventPromise = oneEvent(el, 'lyra-dialog-close');
  button.click();
  const event = await eventPromise;

  expect(event.detail).to.equal('close-button');
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('is accessible while open', async () => {
  const el = (await fixture(html`
    <lyra-drawer open aria-label="Navigation drawer"><p>Navigation</p></lyra-drawer>
  `)) as LyraDrawer;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});
