import { expect, fixture, html } from '@open-wc/testing';
import './lightbox.js';
import type { LyraLightbox } from './lightbox.js';

const image = {
  src: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="8" height="8"%3E%3Crect width="8" height="8" fill="%230969da"/%3E%3C/svg%3E',
  alt: 'Blue square',
  caption: 'A blue square',
};

it('renders the image frame and exposes a dialog when opened', async () => {
  const el = (await fixture(html`<lyra-lightbox .images=${[image]}></lyra-lightbox>`)) as LyraLightbox;
  expect(el.shadowRoot!.querySelector('[part="frame"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="panel"]')!.getAttribute('role')).to.equal(null);

  el.open = true;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="panel"]')!.getAttribute('role')).to.equal('dialog');
  expect(el.shadowRoot!.querySelector('[part="caption"]')!.textContent).to.contain('A blue square');
  el.open = false;
});

it('is accessible while open', async () => {
  const el = (await fixture(html`<lyra-lightbox .images=${[image]} open></lyra-lightbox>`)) as LyraLightbox;
  await expect(el).to.be.accessible();
  el.open = false;
});
