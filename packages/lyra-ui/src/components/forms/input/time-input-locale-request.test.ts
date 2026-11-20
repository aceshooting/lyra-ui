import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-time-input.js';
import '../../../translations/ar/shared.js';
import '../../../translations/ar/forms.js';
import type { LyraTimeInput } from './time-input.class.js';

function press(target: Element, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

describe('lr-time-input day period typing', () => {
  it('accepts the first letter of the displayed localized labels as well as Latin a/p', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input lang="ar" value="10:30"></lr-time-input>`);
    const period = el.shadowRoot!.querySelector<HTMLElement>('[data-segment="dayPeriod"]');
    expect(period !== null, 'an Arabic twelve-hour field renders a day period segment').to.equal(true);
    const [am, pm] = [1, 13].map((hour) =>
      new Intl.DateTimeFormat('ar', { hour: 'numeric', hour12: true, timeZone: 'UTC' })
        .formatToParts(new Date(Date.UTC(2020, 0, 1, hour)))
        .find((part) => part.type === 'dayPeriod')!.value,
    );
    expect(press(period!, Array.from(pm!)[0]!).defaultPrevented).to.equal(true);
    await el.updateComplete;
    expect(el.value).to.equal('22:30');
    expect(press(period!, Array.from(am!)[0]!).defaultPrevented).to.equal(true);
    await el.updateComplete;
    expect(el.value).to.equal('10:30');
    press(period!, 'p');
    await el.updateComplete;
    expect(el.value).to.equal('22:30');
  });
});

it('shares a locale pattern across fields and releases older patterns as new locales arrive', async () => {
  const host = await fixture<HTMLElement>(html`<div></div>`);
  const original = Intl.DateTimeFormat.prototype.formatToParts;
  let calls = 0;
  Intl.DateTimeFormat.prototype.formatToParts = function (...args: Parameters<typeof original>) {
    calls++;
    return original.apply(this, args);
  };
  const mount = async (locale: string) => {
    const field = document.createElement('lr-time-input');
    field.lang = locale;
    field.hourFormat = '24';
    host.replaceChildren(field);
    await field.updateComplete;
    return field;
  };
  try {
    const firstLocale = 'en-x-time0';
    await mount(firstLocale);
    const initial = calls;
    expect(initial).to.be.greaterThan(0);
    const second = await mount(firstLocale);
    expect(second.shadowRoot!.querySelectorAll('[data-segment]').length).to.equal(2);
    expect(calls).to.equal(initial);
    for (let n = 1; n <= 65; n++) await mount(`en-x-time${n}`);
    const before = calls;
    await mount(firstLocale);
    expect(calls).to.be.greaterThan(before);
  } finally {
    Intl.DateTimeFormat.prototype.formatToParts = original;
  }
});

describe('lr-time-input show request', () => {
  it('does not open when the lr-show listener disabled it', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input></lr-time-input>`);
    el.addEventListener('lr-show', () => {
      el.disabled = true;
    });
    await el.show();
    expect(el.open).to.equal(false);
  });
});
