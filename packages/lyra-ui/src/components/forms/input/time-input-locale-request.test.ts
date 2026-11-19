import { expect, fixture, html } from '@open-wc/testing';
import './time-input.js';
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
    expect(period, 'an Arabic twelve-hour field renders a day period segment').to.not.equal(null);
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
