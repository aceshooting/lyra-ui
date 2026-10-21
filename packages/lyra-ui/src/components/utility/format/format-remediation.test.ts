import { expect, fixture, html } from '@open-wc/testing';
import './format-number.js';
import './format-date.js';
import type { LyraFormatDate } from './format-date.js';
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

it('uses USD for nonstring currency data without invoking string-like hooks', async () => {
  let calls = 0;
  const foreign = { trim() { calls += 1; throw new Error('trim denied'); } };
  const expected = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(12.5);
  for (const currency of [7, {}, [], foreign]) {
    const el = await fixture<LyraFormatNumber>(html`
      <lr-format-number lang="en-US" type="currency" value="12.5" .currency=${currency}></lr-format-number>
    `);
    expect(el.shadowRoot!.textContent?.trim()).to.equal(expected);
    expect(Object.is(el.currency, currency)).to.equal(true);
  }
  expect(calls).to.equal(0);
});

it('omits nonstring time-zone data while preserving local date formatting', async () => {
  let calls = 0;
  const foreign = { trim() { calls += 1; throw new Error('trim denied'); } };
  const date = new Date('2024-03-05T12:00:00Z');
  const expected = new Intl.DateTimeFormat('en-US').format(date);
  for (const timeZone of [7, {}, [], foreign]) {
    const el = await fixture<LyraFormatDate>(html`
      <lr-format-date lang="en-US" .date=${date} .timeZone=${timeZone}></lr-format-date>
    `);
    expect(el.shadowRoot!.textContent?.trim()).to.equal(expected);
    expect(Object.is(el.timeZone, timeZone)).to.equal(true);
  }
  expect(calls).to.equal(0);
});
