import { expect, fixture, html } from '@open-wc/testing';
import './carousel-item.js';
import type { LyraCarouselItem } from './carousel-item.class.js';

describe('<lyra-carousel-item>', () => {
  it('renders slotted content', async () => {
    const el = await fixture<LyraCarouselItem>(html`<lyra-carousel-item>Slide content</lyra-carousel-item>`);
    expect(el.shadowRoot!.querySelector('[part="base"]')).to.exist;
    expect(el.textContent).to.contain('Slide content');
  });

  it('is accessible', async () => {
    const el = await fixture<LyraCarouselItem>(html`<lyra-carousel-item>Slide content</lyra-carousel-item>`);
    await expect(el).to.be.accessible();
  });
});
