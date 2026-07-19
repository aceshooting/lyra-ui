import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './drawer.js';
import type { LyraDrawer } from './drawer.js';

it('renders an open drawer with the requested placement and accessible panel', async () => {
  const el = (await fixture(html`
    <lr-drawer open placement="end" heading="Filters">
      <p>Filter controls</p>
    </lr-drawer>
  `)) as LyraDrawer;
  await el.updateComplete;

  const panel = el.shadowRoot!.querySelector('[part="panel"]')!;
  expect(el.getAttribute('placement')).to.equal('end');
  expect(panel.getAttribute('role')).to.equal('dialog');
  expect(panel.getAttribute('aria-modal')).to.equal('true');
  expect(panel.getAttribute('aria-labelledby')).to.match(/^lr-dialog-heading-/);
});

it('closes through the inherited cancelable close contract', async () => {
  const el = (await fixture(html`
    <lr-drawer open heading="Details" closable></lr-drawer>
  `)) as LyraDrawer;
  await el.updateComplete;

  const button = el.shadowRoot!.querySelector('[part="close-button"]') as HTMLButtonElement;
  const eventPromise = oneEvent(el, 'lr-dialog-close');
  button.click();
  const event = await eventPromise;

  expect(event.detail).to.equal('close-button');
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('is accessible while open', async () => {
  const el = (await fixture(html`
    <lr-drawer open aria-label="Navigation drawer"><p>Navigation</p></lr-drawer>
  `)) as LyraDrawer;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('flips the enter-animation offset under RTL to match the mirrored resting edge', async () => {
  const rtlStartWrapper = (await fixture(html`
    <div dir="rtl"><lr-drawer open heading="Filters"><p>Filter controls</p></lr-drawer></div>
  `)) as HTMLElement;
  const startDrawer = rtlStartWrapper.querySelector('lr-drawer') as LyraDrawer;
  await startDrawer.updateComplete;
  const startPanel = startDrawer.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  // A 'start' drawer rests at the physical right edge under RTL, so it must enter
  // from further right -- the same positive offset an LTR 'end' drawer uses.
  expect(getComputedStyle(startPanel).getPropertyValue('--lr-drawer-enter-x').trim()).to.equal('1rem');

  const rtlEndWrapper = (await fixture(html`
    <div dir="rtl"><lr-drawer open placement="end" heading="Filters"><p>Filter controls</p></lr-drawer></div>
  `)) as HTMLElement;
  const endDrawer = rtlEndWrapper.querySelector('lr-drawer') as LyraDrawer;
  await endDrawer.updateComplete;
  const endPanel = endDrawer.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  // An 'end' drawer rests at the physical left edge under RTL -- the mirror image,
  // so it must enter from further left, same as an LTR 'start' (default) drawer.
  expect(getComputedStyle(endPanel).getPropertyValue('--lr-drawer-enter-x').trim()).to.equal('calc(-1 * 1rem)');
});
