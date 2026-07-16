import { fixture, expect, html } from '@open-wc/testing';
import './rating.js';
import type { LyraRating } from './rating.js';

it('exposes a keyboard-accessible rating slider', async () => {
  const el = (await fixture(html`<lyra-rating value="2"></lyra-rating>`)) as LyraRating;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('role')).to.equal('slider');
  expect(base.getAttribute('aria-valuenow')).to.equal('2');
  base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  expect(el.value).to.equal(3);
  await expect(el).to.be.accessible();
});

it('reverses horizontal value movement under RTL', async () => {
  const el = (await fixture(html`<div dir="rtl"><lyra-rating value="2"></lyra-rating></div>`)).querySelector('lyra-rating') as LyraRating;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
  expect(el.value).to.equal(3);
  base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  expect(el.value).to.equal(2);
});

it('does not emit lyra-change when the clamped value is unchanged', async () => {
  const el = (await fixture(html`<lyra-rating value="5" max="5"></lyra-rating>`)) as LyraRating;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  let changeCount = 0;
  el.addEventListener('lyra-change', () => { changeCount++; });
  base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  expect(el.value).to.equal(5);
  expect(changeCount).to.equal(0);

  el.value = 0;
  changeCount = 0;
  base.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
  expect(changeCount).to.equal(0);
});

it('renders a distinct partial fill for a fractional value under a fractional precision', async () => {
  const el = (await fixture(html`<lyra-rating value="3.5" precision="0.5" max="5"></lyra-rating>`)) as LyraRating;
  const stars = el.shadowRoot!.querySelectorAll('[part="star"]');
  const thirdFill = stars[2].querySelector('[part="star-fill"]') as HTMLElement;
  const fourthFill = stars[3].querySelector('[part="star-fill"]') as HTMLElement;
  const fifthFill = stars[4].querySelector('[part="star-fill"]') as HTMLElement;
  expect(thirdFill.style.inlineSize, 'fully filled star').to.equal('100%');
  expect(fourthFill.style.inlineSize, 'half-filled star').to.equal('50%');
  expect(fifthFill.style.inlineSize, 'empty star').to.equal('0%');
  expect(stars[2].hasAttribute('data-filled')).to.be.true;
  expect(stars[3].hasAttribute('data-filled')).to.be.false;
});
