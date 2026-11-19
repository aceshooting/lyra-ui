import { expect, fixture, html } from '@open-wc/testing';
import './time-input.js';
import '../time-range/time-range.js';
import '../otp-input/otp-input.js';
import '../token-input/token-input.js';
import type { LyraTimeInput } from './time-input.class.js';
import type { LyraTimeRange } from '../time-range/time-range.class.js';
import type { LyraOtpInput } from '../otp-input/otp-input.class.js';
import type { LyraTokenInput } from '../token-input/token-input.class.js';

function press(target: Element, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

const MODIFIERS: KeyboardEventInit[] = [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { isComposing: true }];

describe('text controls leave modified and composing keys to the browser', () => {
  it('lr-time-input segments neither act on nor cancel them', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input value="10:30"></lr-time-input>`);
    const hour = el.shadowRoot!.querySelector<HTMLElement>('[data-segment="hour"]')!;
    const dayPeriod = el.shadowRoot!.querySelector<HTMLElement>('[data-segment="dayPeriod"]');
    for (const init of MODIFIERS) {
      for (const key of ['ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Backspace', 'Delete']) {
        if (init.altKey && key === 'ArrowDown') continue;
        const before = el.value;
        const event = press(hour, key, init);
        expect(event.defaultPrevented, `${key} ${JSON.stringify(init)}`).to.equal(false);
        expect(el.value).to.equal(before);
      }
      if (dayPeriod) expect(press(dayPeriod, 'a', init).defaultPrevented).to.equal(false);
    }
    expect(press(hour, 'ArrowUp').defaultPrevented).to.equal(true);
  });

  it('lr-time-range handles ignore them', async () => {
    const el = await fixture<LyraTimeRange>(
      html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`
    );
    const handle = el.shadowRoot!.querySelector<HTMLElement>('[part="handle-start"]')!;
    for (const init of MODIFIERS) {
      for (const key of ['ArrowRight', 'ArrowLeft', 'PageUp', 'Home', 'End']) {
        expect(press(handle, key, init).defaultPrevented, `${key} ${JSON.stringify(init)}`).to.equal(false);
      }
    }
    expect(el.start).to.equal(20);
    expect(press(handle, 'ArrowRight').defaultPrevented).to.equal(true);
  });

  it('lr-otp-input segments ignore them', async () => {
    const el = await fixture<LyraOtpInput>(html`<lr-otp-input length="4"></lr-otp-input>`);
    const control = el.shadowRoot!.querySelector<HTMLElement>('[part="control"]')!;
    for (const init of MODIFIERS) {
      for (const key of ['ArrowLeft', 'ArrowRight', 'Backspace', 'Delete']) {
        expect(press(control, key, init).defaultPrevented, `${key} ${JSON.stringify(init)}`).to.equal(false);
      }
    }
    expect(press(control, 'ArrowRight').defaultPrevented).to.equal(true);
  });

  it('lr-token-input token buttons ignore them', async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input editable .value=${['alpha', 'beta']}></lr-token-input>`);
    const token = el.shadowRoot!.querySelector<HTMLElement>('[part="token-label"]')!;
    for (const init of MODIFIERS) {
      for (const key of ['Enter', ' ', 'F2', 'ArrowRight', 'ArrowLeft', 'Home', 'End']) {
        expect(press(token, key, init).defaultPrevented, `${key} ${JSON.stringify(init)}`).to.equal(false);
      }
    }
    expect(el.shadowRoot!.querySelector('[part="token-editor"]') === null, 'token editor stays closed').to.equal(true);
    expect(press(token, 'ArrowRight').defaultPrevented).to.equal(true);
  });
});
