import { expect, fixture, html } from '@open-wc/testing';
import './carousel-item.js';
import type { LyraCarouselItem } from './carousel-item.class.js';

describe('<lr-carousel-item>', () => {
  it('renders slotted content', async () => {
    const el = await fixture<LyraCarouselItem>(html`<lr-carousel-item>Slide content</lr-carousel-item>`);
    expect(el.shadowRoot!.querySelector('[part="base"]')).to.exist;
    expect(el.textContent).to.contain('Slide content');
  });

  it('is accessible', async () => {
    const el = await fixture<LyraCarouselItem>(html`<lr-carousel-item>Slide content</lr-carousel-item>`);
    await expect(el).to.be.accessible();
  });
});
