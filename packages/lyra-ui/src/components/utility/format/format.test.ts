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

it('supports the complete mapped number-format vocabulary and both grouping aliases', async () => {
  const percent = (await fixture(html`
    <lr-format-number value="0.25" type="percent" locale="en-US"></lr-format-number>
  `)) as LyraFormatNumber;
  expect(percent.shadowRoot?.textContent?.trim()).to.equal('25%');

  const currency = (await fixture(html`
    <lr-format-number
      value="1234.56"
      type="currency"
      currency="EUR"
      currency-display="code"
      without-grouping
      locale="en-US"
    ></lr-format-number>
  `)) as LyraFormatNumber;
  expect(currency.shadowRoot?.textContent?.trim()).to.equal('EUR\u00a01234.56');

  currency.withoutGrouping = false;
  currency.noGrouping = true;
  await currency.updateComplete;
  expect(currency.shadowRoot?.textContent?.trim()).to.equal('EUR\u00a01234.56');

  const digits = (await fixture(html`
    <lr-format-number
      value="12.3456"
      minimum-integer-digits="3"
      maximum-significant-digits="3"
      locale="en-US"
    ></lr-format-number>
  `)) as LyraFormatNumber;
  expect(digits.shadowRoot?.textContent?.trim()).to.equal('012.3');
});

it('formats dates and relative time', async () => {
  const el = await fixture(html`<div>
    <lr-format-date date="2024-01-01T00:00:00Z" locale="en-US"></lr-format-date>
    <lr-relative-time date="2030-01-01T00:00:00Z" locale="en-US"></lr-relative-time>
  </div>`);
  expect(el.querySelector('lr-format-date')?.shadowRoot?.textContent?.trim()).to.equal(
    new Intl.DateTimeFormat('en-US').format(new Date('2024-01-01T00:00:00Z')),
  );
  expect(el.querySelector('lr-relative-time')?.shadowRoot?.textContent).to.contain('in');
});

it('defaults date/relative-time to now and renders machine-readable semantic time elements', async () => {
  const before = Date.now();
  const date = (await fixture(html`<lr-format-date locale="en-US"></lr-format-date>`)) as LyraFormatDate;
  const relative = (await fixture(html`<lr-relative-time locale="en-US"></lr-relative-time>`)) as LyraRelativeTime;
  const after = Date.now();

  const dateTime = date.shadowRoot!.querySelector('time')!;
  const relativeTime = relative.shadowRoot!.querySelector('time')!;
  const dateInstant = new Date(dateTime.getAttribute('datetime')!).getTime();
  const relativeInstant = new Date(relativeTime.getAttribute('datetime')!).getTime();
  expect(dateInstant).to.be.within(before, after);
  expect(relativeInstant).to.be.within(before, after);
  expect(relativeTime.textContent?.trim()).to.not.equal('');
});

it('forwards the complete validated granular date/time vocabulary', async () => {
  const instant = new Date('2024-01-01T00:30:45Z');
  const el = (await fixture(html`
    <lr-format-date
      .date=${instant}
      locale="en-US"
      weekday="short"
      era="short"
      year="2-digit"
      month="2-digit"
      day="2-digit"
      hour="2-digit"
      minute="2-digit"
      second="2-digit"
      time-zone-name="short"
      time-zone="UTC"
      hour-format="24"
    ></lr-format-date>
  `)) as LyraFormatDate;
  const expected = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    era: 'short',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
    timeZone: 'UTC',
    hour12: false,
  }).format(instant);
  expect(el.shadowRoot?.querySelector('time')?.textContent).to.equal(expected);
});

it('uses mapped decimal byte scaling with byte/bit and display controls', async () => {
  const bytes = (await fixture(html`
    <lr-format-bytes value="1000" unit="byte" display="short" locale="en-US"></lr-format-bytes>
  `)) as LyraFormatBytes;
  expect(bytes.shadowRoot?.textContent?.trim()).to.match(/^1\s?kB$/i);

  const bits = (await fixture(html`
    <lr-format-bytes value="1000" unit="bit" display="long" locale="en-US"></lr-format-bytes>
  `)) as LyraFormatBytes;
  expect(bits.shadowRoot?.textContent?.trim()).to.match(/^1\s+kilobit$/i);
});

it('supports long/short/narrow relative-time output and machine-readable datetime', async () => {
  const target = new Date(Date.now() + 2 * 86_400_000);
  const el = (await fixture(html`
    <lr-relative-time .date=${target} unit="day" format="narrow" numeric="always" locale="en-US"></lr-relative-time>
  `)) as LyraRelativeTime;
  const expected = new Intl.RelativeTimeFormat('en-US', {
    numeric: 'always',
    style: 'narrow',
  }).format(2, 'day');
  const time = el.shadowRoot!.querySelector('time')!;
  expect(time.textContent).to.equal(expected);
  expect(time.getAttribute('datetime')).to.equal(target.toISOString());
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

it('falls back safely for invalid Intl number/date/relative-time option values', async () => {
  const number = (await fixture(html`<lr-format-number value="1234"></lr-format-number>`)) as LyraFormatNumber;
  number.notation = 'invalid' as Intl.NumberFormatOptions['notation'];
  number.type = 'currency';
  number.currency = 'not-a-currency';
  await number.updateComplete;
  expect(number.shadowRoot?.textContent?.trim()).to.not.equal('');

  const date = (await fixture(html`
    <lr-format-date date="2024-01-01T00:00:00Z"></lr-format-date>
  `)) as LyraFormatDate;
  date.year = 'invalid' as Intl.DateTimeFormatOptions['year'];
  date.dateStyle = 'invalid' as Intl.DateTimeFormatOptions['dateStyle'];
  await date.updateComplete;
  expect(date.shadowRoot?.textContent?.trim()).to.not.equal('');

  const relative = (await fixture(html`
    <lr-relative-time date="2030-01-01T00:00:00Z"></lr-relative-time>
  `)) as LyraRelativeTime;
  relative.unit = 'invalid' as LyraRelativeTime['unit'];
  relative.numeric = 'invalid' as LyraRelativeTime['numeric'];
  relative.format = 'invalid' as LyraRelativeTime['format'];
  await relative.updateComplete;
  expect(relative.shadowRoot?.textContent?.trim()).to.not.equal('');

  const bytes = (await fixture(html`<lr-format-bytes value="1000"></lr-format-bytes>`)) as LyraFormatBytes;
  bytes.unit = 'invalid' as LyraFormatBytes['unit'];
  bytes.display = 'invalid' as LyraFormatBytes['display'];
  await bytes.updateComplete;
  expect(bytes.shadowRoot?.textContent?.trim()).to.match(/^1\s?kB$/i);
});

it('falls back safely when an explicit locale is invalid', async () => {
  const el = (await fixture(html`
    <lr-format-number value="1234" locale="not_a_locale"></lr-format-number>
  `)) as LyraFormatNumber;
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.not.equal('');
});

it('formats negative sub-byte values without selecting a negative unit index', async () => {
  const el = (await fixture(html`
    <lr-format-bytes value="-0.5" locale="en-US"></lr-format-bytes>
  `)) as LyraFormatBytes;
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.match(/-0\.5\s*byte/i);
});

it('falls back safely when lr-format-bytes receives a malformed locale', async () => {
  const el = (await fixture(html`
    <lr-format-bytes value="1024" locale="not_a_locale"></lr-format-bytes>
  `)) as LyraFormatBytes;
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.match(/1\s?kB/i);
});

it('preserves a valid effective locale while discarding invalid number options', async () => {
  const el = (await fixture(html`
    <lr-format-number value="1234.5" locale="ar-EG"></lr-format-number>
  `)) as LyraFormatNumber;
  el.type = 'currency';
  el.currency = 'x';
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.match(/[٠-٩]/);
});

it('preserves a valid effective locale while discarding invalid date options', async () => {
  const el = (await fixture(html`
    <lr-format-date date="2024-01-01T00:00:00Z" locale="ar-EG" time-zone="UTC"></lr-format-date>
  `)) as LyraFormatDate;
  el.year = 'invalid' as Intl.DateTimeFormatOptions['year'];
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.match(/[\u0600-\u06ff]/);
});

it('inherits locale from an ancestor when no explicit locale is set', async () => {
  const el = await fixture(html`<div lang="de-DE"><lr-format-number value="1234.5"></lr-format-number></div>`);
  expect(el.querySelector('lr-format-number')?.shadowRoot?.textContent).to.contain('1.234,5');
});

it('reacts to a live locale switch', async () => {
  const el = (await fixture(html`
    <lr-format-number value="1234.5" locale="en-US"></lr-format-number>
  `)) as LyraFormatNumber;
  expect(el.shadowRoot?.textContent?.trim()).to.equal('1,234.5');
  el.locale = 'de-DE';
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.equal('1.234,5');
});

it('schedules sync relative-time at the next rounded unit boundary instead of fixed polling', async () => {
  const originalSetTimeout = window.setTimeout;
  const originalClearTimeout = window.clearTimeout;
  const delays: number[] = [];
  let timer = 0;
  window.setTimeout = ((_handler: TimerHandler, delay?: number) => {
    delays.push(Number(delay));
    timer += 1;
    return timer;
  }) as typeof window.setTimeout;
  window.clearTimeout = (() => {}) as typeof window.clearTimeout;
  try {
    const target = new Date(Date.now() + 100_000);
    const el = (await fixture(html`
      <lr-relative-time .date=${target} unit="minute" numeric="always" sync></lr-relative-time>
    `)) as LyraRelativeTime;
    await el.updateComplete;
    const scheduled = delays.at(-1)!;
    expect(scheduled).to.be.greaterThan(9_000);
    expect(scheduled).to.be.lessThan(11_000);
  } finally {
    window.setTimeout = originalSetTimeout;
    window.clearTimeout = originalClearTimeout;
  }
});

it('is accessible', async () => {
  const el = await fixture(html`<lr-format-number value="1234.5"></lr-format-number>`);
  await expect(el).to.be.accessible();
});

it('lr-format-date is accessible', async () => {
  const el = await fixture(html`<lr-format-date date="2024-01-01T00:00:00Z" locale="en-US"></lr-format-date>`);
  await expect(el).to.be.accessible();
});

it('lr-format-bytes is accessible', async () => {
  const el = await fixture(html`<lr-format-bytes value="1024"></lr-format-bytes>`);
  await expect(el).to.be.accessible();
});

it('lr-relative-time is accessible', async () => {
  const el = await fixture(html`<lr-relative-time date="2030-01-01T00:00:00Z" locale="en-US"></lr-relative-time>`);
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

it('clamps integer/significant digit options and orders crossed significant bounds', async () => {
  const el = (await fixture(html`<lr-format-number value="1234.567"></lr-format-number>`)) as LyraFormatNumber;

  el.minimumIntegerDigits = Number.NaN;
  el.minimumSignificantDigits = 500;
  el.maximumSignificantDigits = -1;
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.not.equal('');

  el.minimumIntegerDigits = 99;
  el.minimumSignificantDigits = 5;
  el.maximumSignificantDigits = 2;
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.not.equal('');
  expect(el.shadowRoot?.textContent).to.not.contain('NaN');
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
