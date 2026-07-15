import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './carousel.js';
import type { LyraCarousel } from './carousel.js';

async function carousel(template = html`
  <lyra-carousel>
    <div>One</div>
    <div>Two</div>
    <div>Three</div>
  </lyra-carousel>
`): Promise<LyraCarousel> {
  const el = (await fixture(template)) as LyraCarousel;
  await el.updateComplete;
  return el;
}

it('exposes one visible slide and localized navigation controls', async () => {
  const el = await carousel();
  const slides = [...el.children] as HTMLElement[];

  expect(slides[0].hidden).to.be.false;
  expect(slides[1].hidden).to.be.true;
  expect(slides[0].getAttribute('role')).to.equal('group');
  expect(slides[0].getAttribute('aria-roledescription')).to.equal('slide');
  expect(el.shadowRoot!.querySelectorAll('[part="indicator"]').length).to.equal(3);
});

it('emits slide changes and supports keyboard navigation', async () => {
  const el = await carousel();
  const next = el.shadowRoot!.querySelector('[part="next-button"]') as HTMLButtonElement;
  const eventPromise = oneEvent(el, 'lyra-slide-change');
  next.click();
  const event = await eventPromise;

  expect(event.detail).to.deep.equal({ index: 1 });
  expect(el.index).to.equal(1);

  const viewport = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
  viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  await el.updateComplete;
  expect(el.index).to.equal(0);
});

it('is accessible and supports a consumer supplied accessible label', async () => {
  const el = await carousel(html`
    <lyra-carousel aria-label="Product screenshots">
      <img alt="First screenshot" src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" />
      <img alt="Second screenshot" src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" />
    </lyra-carousel>
  `);
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
    'Product screenshots',
  );
  await expect(el).to.be.accessible();
});
