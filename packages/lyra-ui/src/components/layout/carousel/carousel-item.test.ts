import { expect, fixture, html } from '@open-wc/testing';
import './carousel-item.js';
import type { LyraCarouselItem } from './carousel-item.class.js';

describe('<lr-carousel-item>', () => {
  it('renders slotted content', async () => {
    const el = await fixture<LyraCarouselItem>(html`<lr-carousel-item>Slide content</lr-carousel-item>`);
    expect(el.shadowRoot!.querySelector('[part="base"]')).to.exist;
    expect(el.textContent).to.contain('Slide content');
  });

  it('inherits and applies the mapped --aspect-ratio property', async () => {
    const el = await fixture<LyraCarouselItem>(html`
      <lr-carousel-item style="inline-size: 300px; --aspect-ratio: 3 / 2">
        Slide content
      </lr-carousel-item>
    `);
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(base).aspectRatio).to.equal('3 / 2');
  });

  it('is accessible', async () => {
    const el = await fixture<LyraCarouselItem>(html`<lr-carousel-item>Slide content</lr-carousel-item>`);
    await expect(el).to.be.accessible();
  });
});
