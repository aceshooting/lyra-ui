import { expect, fixture, html } from '@open-wc/testing';
import { LyraFormatDate } from './format-date.js';
import { LyraRelativeTime } from './relative-time.js';

it('renders the authored fallback for an invalid native Date and recovers without calling subclass hooks', async () => {
  let calls = 0;
  class NativeDate extends Date {
    override getTime(): number { calls++; throw new Error('getTime must not be invoked'); }
    override [Symbol.toPrimitive](): never { calls++; throw new Error('conversion must not be invoked'); }
  }
  const el = await fixture<LyraFormatDate>(html`<lr-format-date lang="en-US" time-zone="UTC" .date=${new NativeDate(NaN)}>Unknown date</lr-format-date>`);
  expect(el.shadowRoot!.querySelector('time') === null).to.equal(true);
  expect(el.shadowRoot!.querySelector('slot')?.assignedNodes().map(node => node.textContent).join('')).to.equal('Unknown date');
  const epoch = Date.UTC(2024, 3, 5);
  el.date = new NativeDate(epoch);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('time')?.dateTime).to.equal('2024-04-05T00:00:00.000Z');
  expect(el.shadowRoot!.querySelector('time')?.textContent).to.equal(new Intl.DateTimeFormat('en-US', { timeZone: 'UTC' }).format(epoch));
  expect(calls).to.equal(0);
});

it('clears stale relative-time semantics for an invalid native Date and renders a later valid value', async () => {
  const date = new Date(Date.now() + 3_600_000);
  const el = await fixture<LyraRelativeTime>(html`<lr-relative-time lang="en-US" unit="hour" numeric="always" .date=${date}></lr-relative-time>`);
  expect(el.shadowRoot!.querySelector('time')?.textContent).to.equal(new Intl.RelativeTimeFormat('en-US', { numeric: 'always' }).format(1, 'hour'));
  el.date = new Date(NaN);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('time') === null).to.equal(true);
  expect(el.shadowRoot!.textContent?.trim()).to.equal('');
  el.date = date;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('time')?.dateTime).to.equal(date.toISOString());
  expect(el.shadowRoot!.querySelector('time')?.textContent).to.equal(new Intl.RelativeTimeFormat('en-US', { numeric: 'always' }).format(1, 'hour'));
});
