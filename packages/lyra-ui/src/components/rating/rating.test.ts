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
