import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './icon-button.js';

it('forwards its accessible label and click event', async () => {
  const el = await fixture(html`<lyra-icon-button icon="close" aria-label="Dismiss"></lyra-icon-button>`);
  expect(el.shadowRoot!.querySelector('button')!.getAttribute('aria-label')).to.equal('Dismiss');
  const event = oneEvent(el, 'click');
  el.shadowRoot!.querySelector('button')!.click();
  expect((await event).bubbles).to.be.true;
});

it('keeps the visual glyph independent from the icon button hit target', async () => {
  const el = await fixture(html`<lyra-icon-button icon="search" aria-label="Search"></lyra-icon-button>`);
  const icon = el.shadowRoot!.querySelector('lyra-icon')!;
  const button = el.shadowRoot!.querySelector('button')!;

  expect(getComputedStyle(button).inlineSize).to.equal('40px');
  expect(getComputedStyle(icon).inlineSize).to.equal('20px');
});

it('is accessible', async () => {
  const el = await fixture(html`<lyra-icon-button icon="close" aria-label="Dismiss"></lyra-icon-button>`);
  await expect(el).to.be.accessible();
});

it('is accessible while disabled', async () => {
  const el = await fixture(html`<lyra-icon-button icon="close" aria-label="Dismiss" disabled></lyra-icon-button>`);
  await expect(el).to.be.accessible();
});
