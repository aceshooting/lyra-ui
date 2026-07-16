import { fixture, html } from '@open-wc/testing';
import './known-date.js';
import type { LyraKnownDate } from './known-date.js';

function fieldFor(el: LyraKnownDate, name: 'day' | 'month' | 'year'): HTMLInputElement {
  return el.shadowRoot!.querySelector(`input[data-field="${name}"]`) as HTMLInputElement;
}

it('debug blur sequence', async () => {
  const el = (await fixture(html`<lyra-known-date locale="en-GB"></lyra-known-date>`)) as LyraKnownDate;
  await el.updateComplete;

  const day = fieldFor(el, 'day');
  const month = fieldFor(el, 'month');
  const year = fieldFor(el, 'year');

  let count = 0;
  el.addEventListener('blur', () => {
    count++;
    console.log('HOST BLUR EMIT #' + count, new Error().stack);
  });

  for (const input of [day, month, year]) {
    input.addEventListener('blur', (e) => {
      console.log('native blur on', (input as HTMLElement).dataset.field, 'relatedTarget=', (e as FocusEvent).relatedTarget && ((e as FocusEvent).relatedTarget as HTMLElement).dataset?.field, 'bubbles=', e.bubbles, 'composed=', e.composed);
    });
  }

  day.focus();
  console.log('--- focusing month ---');
  month.focus();
  await el.updateComplete;
  console.log('--- focusing year ---');
  year.focus();
  await el.updateComplete;
  console.log('count after day->month->year =', count);
  console.log('--- blurring year ---');
  year.blur();
  await new Promise((r) => setTimeout(r, 50));
  console.log('count after year.blur() =', count);
});
