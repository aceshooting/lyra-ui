import { expect, fixture, html } from '@open-wc/testing';
import './format-number.js';
import type { LyraFormatNumber } from './format-number.js';

it('uses the declared USD fallback after currency attribute removal without changing readback', async () => {
  const viewer = await fixture<LyraFormatNumber>(html`<lr-format-number lang="en-US" type="currency" value="12.5" currency="EUR"></lr-format-number>`);
  const format = (currency: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(12.5);
  expect(viewer.shadowRoot!.textContent?.trim()).to.equal(format('EUR'));
  viewer.removeAttribute('currency');
  await viewer.updateComplete;
  expect(viewer.currency).to.equal(null);
  expect(viewer.shadowRoot!.textContent?.trim()).to.equal(format('USD'));
  viewer.setAttribute('currency', '');
  await viewer.updateComplete;
  expect(viewer.currency).to.equal('');
  expect(viewer.shadowRoot!.textContent?.trim()).to.equal(format('USD'));
  viewer.setAttribute('currency', 'JPY');
  await viewer.updateComplete;
  expect(viewer.shadowRoot!.textContent?.trim()).to.equal(format('JPY'));
});
