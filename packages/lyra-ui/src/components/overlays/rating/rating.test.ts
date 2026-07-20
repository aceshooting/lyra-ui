import { fixture, expect, html } from '@open-wc/testing';
import './rating.js';
import type { LyraRating } from './rating.js';
import { styles } from './rating.styles.js';

it('gives the star row hover feedback matching the keyboard focus-visible cue', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='base'\]:hover \[part='star'\]\s*\{[^}]*color:/);
});

it('exposes a keyboard-accessible rating slider', async () => {
  const el = (await fixture(html`<lr-rating value="2"></lr-rating>`)) as LyraRating;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('role')).to.equal('slider');
  expect(base.getAttribute('aria-valuenow')).to.equal('2');
  base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  expect(el.value).to.equal(3);
  await expect(el).to.be.accessible();
});

it('reverses horizontal value movement under RTL', async () => {
  const el = (await fixture(html`<div dir="rtl"><lr-rating value="2"></lr-rating></div>`)).querySelector('lr-rating') as LyraRating;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
  expect(el.value).to.equal(3);
  base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  expect(el.value).to.equal(2);
});

it('does not emit lr-change when the clamped value is unchanged', async () => {
  const el = (await fixture(html`<lr-rating value="5" max="5"></lr-rating>`)) as LyraRating;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  let changeCount = 0;
  el.addEventListener('lr-change', () => { changeCount++; });
  base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  expect(el.value).to.equal(5);
  expect(changeCount).to.equal(0);

  el.value = 0;
  changeCount = 0;
  base.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
  expect(changeCount).to.equal(0);
});

it('clamps a non-finite or oversized max to a safe, bounded star count', async () => {
  const nan = (await fixture(html`<lr-rating max="abc"></lr-rating>`)) as LyraRating;
  const nanBase = nan.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(nanBase.getAttribute('aria-valuemax')).to.equal('5');
  expect(nan.shadowRoot!.querySelectorAll('[part="star"]').length).to.equal(5);

  const huge = (await fixture(html`<lr-rating max="1000000"></lr-rating>`)) as LyraRating;
  expect(huge.shadowRoot!.querySelectorAll('[part="star"]').length).to.equal(100);
});

it('clamps an out-of-range or non-finite value to [0, max]', async () => {
  const negative = (await fixture(html`<lr-rating value="-10" max="5"></lr-rating>`)) as LyraRating;
  expect(negative.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-valuenow')).to.equal('0');

  const over = (await fixture(html`<lr-rating value="999" max="5"></lr-rating>`)) as LyraRating;
  expect(over.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-valuenow')).to.equal('5');

  const nan = (await fixture(html`<lr-rating max="5"></lr-rating>`)) as LyraRating;
  nan.value = NaN;
  await nan.updateComplete;
  expect(nan.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-valuenow')).to.equal('0');
});

it('falls back to a safe positive precision instead of throwing when precision is non-finite', async () => {
  const el = (await fixture(html`<lr-rating value="2" precision="abc"></lr-rating>`)) as LyraRating;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(() =>
    base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })),
  ).to.not.throw();
  expect(el.value).to.equal(3);
});

it('renders a distinct partial fill for a fractional value under a fractional precision', async () => {
  const el = (await fixture(html`<lr-rating value="3.5" precision="0.5" max="5"></lr-rating>`)) as LyraRating;
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
