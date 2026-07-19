import { fixture, expect, html } from '@open-wc/testing';
import './format-number.js';
import './format-date.js';
import './format-bytes.js';
import './relative-time.js';
import type { LyraFormatBytes } from './format-bytes.class.js';
import type { LyraFormatDate } from './format-date.class.js';
import type { LyraFormatNumber } from './format-number.class.js';
import type { LyraRelativeTime } from './relative-time.class.js';

it('formats numbers and bytes through Intl', async () => {
  const el = await fixture(html`<div><lr-format-number value="1234.5"></lr-format-number><lr-format-bytes value="1024"></lr-format-bytes></div>`);
  expect(el.querySelector('lr-format-number')?.shadowRoot?.textContent).to.contain('1,234.5');
  expect(el.querySelector('lr-format-bytes')?.shadowRoot?.textContent).to.match(/1\s?kB/i);
});

it('formats dates and relative time', async () => {
  const el = await fixture(html`<div>
    <lr-format-date date="2024-01-01T00:00:00Z" locale="en-US"></lr-format-date>
    <lr-relative-time date="2030-01-01T00:00:00Z" locale="en-US"></lr-relative-time>
  </div>`);
  expect(el.querySelector('lr-format-date')?.shadowRoot?.textContent).to.contain('January');
  expect(el.querySelector('lr-relative-time')?.shadowRoot?.textContent).to.contain('in');
});

it('supports style-based date formatting without mixing Intl option families', async () => {
  const el = await fixture(html`<lr-format-date date="2024-01-01T00:00:00Z" date-style="full"></lr-format-date>`);
  expect(el.shadowRoot?.textContent).to.contain('Monday');
});

it('forwards time-zone through granular and style-based date formatting', async () => {
  const instant = '2024-01-01T00:30:00Z';
  const granular = (await fixture(html`
    <lr-format-date
      date=${instant}
      locale="en-US"
      year="numeric"
      month="long"
      day="numeric"
      time-zone="UTC"
    ></lr-format-date>
  `)) as LyraFormatDate;
  expect(granular.timeZone).to.equal('UTC');
  expect(granular.shadowRoot?.textContent).to.contain('January 1, 2024');

  const styled = (await fixture(html`
    <lr-format-date
      date=${instant}
      locale="en-US"
      date-style="full"
      time-zone="America/Los_Angeles"
    ></lr-format-date>
  `)) as LyraFormatDate;
  expect(styled.shadowRoot?.textContent).to.contain('Sunday, December 31, 2023');

  styled.timeZone = 'UTC';
  await styled.updateComplete;
  expect(styled.shadowRoot?.textContent).to.contain('Monday, January 1, 2024');
});

it('falls back to the browser time zone when time-zone is invalid instead of throwing', async () => {
  const el = await fixture(html`
    <lr-format-date date="2024-01-01T00:30:00Z" locale="en-US" time-zone="Not/AZone"></lr-format-date>
  `);
  expect(el.shadowRoot?.textContent?.trim()).to.not.equal('');
});

it('inherits locale from an ancestor when no explicit locale is set', async () => {
  const el = await fixture(html`<div lang="de-DE"><lr-format-number value="1234.5"></lr-format-number></div>`);
  expect(el.querySelector('lr-format-number')?.shadowRoot?.textContent).to.contain('1.234,5');
});

it('is accessible', async () => {
  const el = await fixture(html`<lr-format-number value="1234.5"></lr-format-number>`);
  await expect(el).to.be.accessible();
});

it('falls back to slotted content instead of throwing when value is non-finite', async () => {
  const el = await fixture(html`<lr-format-bytes value="abc">Unknown size</lr-format-bytes>`);
  expect(el.shadowRoot?.textContent?.trim()).to.equal('');
  const slot = el.shadowRoot!.querySelector('slot') as HTMLSlotElement;
  expect(slot).to.exist;
  expect(el.textContent?.trim()).to.equal('Unknown size');
});

it('falls back gracefully when value is programmatically set to NaN', async () => {
  const el = (await fixture(html`<lr-format-bytes></lr-format-bytes>`)) as LyraFormatBytes;
  el.value = NaN;
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.equal('');
});

it('clamps an out-of-range decimals instead of letting Intl.NumberFormat throw a RangeError (crash regression)', async () => {
  // Intl.NumberFormat's maximumFractionDigits only accepts [0, 100] and throws a RangeError
  // outside that (or for a non-finite value) -- decimals reaches it unguarded pre-fix.
  const el = (await fixture(html`<lr-format-bytes value="123456"></lr-format-bytes>`)) as LyraFormatBytes;

  el.decimals = -1;
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.not.equal('');
  expect(el.shadowRoot?.textContent).to.not.contain('NaN');

  el.decimals = 500;
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.not.equal('');

  el.decimals = NaN;
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.not.equal('');
});

it('falls back to a safe default unit-step instead of dividing by Math.log(1) === 0 (crash regression)', async () => {
  const el = (await fixture(html`<lr-format-bytes value="123456"></lr-format-bytes>`)) as LyraFormatBytes;
  el.unitStep = 1;
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.not.equal('');
  expect(el.shadowRoot?.textContent).to.not.contain('NaN');

  el.unitStep = NaN;
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.not.equal('');
});

it('clamps out-of-range minimum/maximumFractionDigits instead of letting Intl.NumberFormat throw a RangeError (crash regression)', async () => {
  // Both minimumFractionDigits and maximumFractionDigits throw a RangeError outside [0, 100],
  // and throw even when each is individually in range if minimum > maximum -- unguarded pre-fix.
  const el = (await fixture(html`<lr-format-number value="1234.5"></lr-format-number>`)) as LyraFormatNumber;

  el.maximumFractionDigits = -1;
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.not.equal('');

  el.maximumFractionDigits = 500;
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.not.equal('');

  el.minimumFractionDigits = NaN;
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.not.equal('');

  // Individually in-range, but inverted -- reordered rather than left to throw.
  el.minimumFractionDigits = 5;
  el.maximumFractionDigits = 2;
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.not.equal('');
});

it('reflects the locale property back to the locale attribute (inherited LyraElement `reflect: true`)', async () => {
  const numberEl = (await fixture(html`<lr-format-number value="1234.5"></lr-format-number>`)) as LyraFormatNumber;
  const dateEl = (await fixture(html`<lr-format-date date="2024-01-01T00:00:00Z"></lr-format-date>`)) as LyraFormatDate;
  const bytesEl = (await fixture(html`<lr-format-bytes value="1024"></lr-format-bytes>`)) as LyraFormatBytes;
  const relativeEl = (await fixture(html`<lr-relative-time date="2030-01-01T00:00:00Z"></lr-relative-time>`)) as LyraRelativeTime;
  numberEl.locale = 'de-DE';
  dateEl.locale = 'de-DE';
  bytesEl.locale = 'de-DE';
  relativeEl.locale = 'de-DE';
  await Promise.all([numberEl.updateComplete, dateEl.updateComplete, bytesEl.updateComplete, relativeEl.updateComplete]);
  expect(numberEl.getAttribute('locale')).to.equal('de-DE');
  expect(dateEl.getAttribute('locale')).to.equal('de-DE');
  expect(bytesEl.getAttribute('locale')).to.equal('de-DE');
  expect(relativeEl.getAttribute('locale')).to.equal('de-DE');
});
