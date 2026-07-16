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
  const el = await fixture(html`<div><lyra-format-number value="1234.5"></lyra-format-number><lyra-format-bytes value="1024"></lyra-format-bytes></div>`);
  expect(el.querySelector('lyra-format-number')?.shadowRoot?.textContent).to.contain('1,234.5');
  expect(el.querySelector('lyra-format-bytes')?.shadowRoot?.textContent).to.match(/1\s?kB/i);
});

it('formats dates and relative time', async () => {
  const el = await fixture(html`<div>
    <lyra-format-date date="2024-01-01T00:00:00Z" locale="en-US"></lyra-format-date>
    <lyra-relative-time date="2030-01-01T00:00:00Z" locale="en-US"></lyra-relative-time>
  </div>`);
  expect(el.querySelector('lyra-format-date')?.shadowRoot?.textContent).to.contain('January');
  expect(el.querySelector('lyra-relative-time')?.shadowRoot?.textContent).to.contain('in');
});

it('supports style-based date formatting without mixing Intl option families', async () => {
  const el = await fixture(html`<lyra-format-date date="2024-01-01T00:00:00Z" date-style="full"></lyra-format-date>`);
  expect(el.shadowRoot?.textContent).to.contain('Monday');
});

it('inherits locale from an ancestor when no explicit locale is set', async () => {
  const el = await fixture(html`<div lang="de-DE"><lyra-format-number value="1234.5"></lyra-format-number></div>`);
  expect(el.querySelector('lyra-format-number')?.shadowRoot?.textContent).to.contain('1.234,5');
});

it('is accessible', async () => {
  const el = await fixture(html`<lyra-format-number value="1234.5"></lyra-format-number>`);
  await expect(el).to.be.accessible();
});

it('falls back to slotted content instead of throwing when value is non-finite', async () => {
  const el = await fixture(html`<lyra-format-bytes value="abc">Unknown size</lyra-format-bytes>`);
  expect(el.shadowRoot?.textContent?.trim()).to.equal('');
  const slot = el.shadowRoot!.querySelector('slot') as HTMLSlotElement;
  expect(slot).to.exist;
  expect(el.textContent?.trim()).to.equal('Unknown size');
});

it('falls back gracefully when value is programmatically set to NaN', async () => {
  const el = (await fixture(html`<lyra-format-bytes></lyra-format-bytes>`)) as LyraFormatBytes;
  el.value = NaN;
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.equal('');
});

it('reflects the locale property back to the locale attribute (inherited LyraElement `reflect: true`)', async () => {
  const numberEl = (await fixture(html`<lyra-format-number value="1234.5"></lyra-format-number>`)) as LyraFormatNumber;
  const dateEl = (await fixture(html`<lyra-format-date date="2024-01-01T00:00:00Z"></lyra-format-date>`)) as LyraFormatDate;
  const bytesEl = (await fixture(html`<lyra-format-bytes value="1024"></lyra-format-bytes>`)) as LyraFormatBytes;
  const relativeEl = (await fixture(html`<lyra-relative-time date="2030-01-01T00:00:00Z"></lyra-relative-time>`)) as LyraRelativeTime;
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
