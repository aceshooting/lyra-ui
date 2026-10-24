import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './time-input.js';
import type { LyraTimeInput } from './time-input.class.js';

function values(el: LyraTimeInput, segment: string): string[] {
  return [...el.shadowRoot!.querySelectorAll<HTMLElement>(`[data-column="${segment}"]`)]
    .map(option => option.dataset['value']!);
}

describe('time picker unrestricted and upper-bound choices', () => {
  for (const format of ['12', '24'] as const) {
    it(`renders the complete ${format}-hour unrestricted grid and commits its last minute`, async () => {
      const el = await fixture<LyraTimeInput>(html`
        <lr-time-input label="Start time" hour-format=${format} step="any" value="13:25"
          style="--lr-duration-base: 0ms"></lr-time-input>
      `);
      try {
        await el.show();
        expect(values(el, 'hour')).to.deep.equal(Array.from(
          { length: format === '12' ? 12 : 24 }, (_, index) => String(format === '12' ? index + 1 : index),
        ));
        expect(values(el, 'minute')).to.deep.equal(Array.from({ length: 60 }, (_, minute) => String(minute)));
        expect(values(el, 'dayPeriod')).to.deep.equal(format === '12' ? ['am', 'pm'] : []);
        await expect(el).to.be.accessible();
        const lastMinute = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-column="minute"][data-value="59"]')!;
        lastMinute.click();
        await el.updateComplete;
        expect(el.value).to.equal('13:59');
        expect(el.validity.stepMismatch).to.equal(false);
        const minute = el.shadowRoot!.querySelector('[data-segment="minute"]')!;
        await waitUntil(() => el.shadowRoot!.activeElement === minute, 'choosing a minute focuses that segment');
        await el.hide();
        const hour = el.shadowRoot!.querySelector('[data-segment="hour"]')!;
        await waitUntil(() => el.shadowRoot!.activeElement === hour, 'closing restores the original hour segment');
        expect(el.value).to.equal('13:59');
      } finally {
        await el.hide();
      }
    });
  }

  it('excludes hours and minutes beyond a lone maximum and accepts the exact upper boundary', async () => {
    const form = await fixture<HTMLFormElement>(html`
      <form><lr-time-input name="start" label="Start time" hour-format="24" max="02:30" step="1800"
        value="02:00" style="--lr-duration-base: 0ms"></lr-time-input></form>
    `);
    const el = form.querySelector<LyraTimeInput>('lr-time-input')!;
    try {
      await el.show();
      expect(values(el, 'hour')).to.deep.equal(['0', '1', '2']);
      expect(values(el, 'minute')).to.deep.equal(['0', '30']);
      el.shadowRoot!.querySelector<HTMLButtonElement>('[data-column="minute"][data-value="30"]')!.click();
      await el.updateComplete;
      expect(el.value).to.equal('02:30');
      expect(el.checkValidity()).to.equal(true);
      expect(new FormData(form).get('start')).to.equal('02:30');
      expect(el.shadowRoot!.querySelectorAll('[data-column="hour"][data-value="3"]').length).to.equal(0);
    } finally {
      await el.hide();
    }
  });

  it('keeps picker-to-segment focus return within one host focus session', async () => {
    const el = await fixture<LyraTimeInput>(html`
      <lr-time-input label="Start time" hour-format="24" value="13:25"
        style="--lr-duration-base: 0ms"></lr-time-input>
    `);
    try {
      await el.show();
      const option = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-column="minute"][data-value="59"]')!;
      option.click();
      const minute = el.shadowRoot!.querySelector('[data-segment="minute"]')!;
      await waitUntil(() => el.shadowRoot!.activeElement === minute);
      await focusByKeyboard(option);
      expect(el.shadowRoot!.activeElement === option).to.equal(true);
      let focusEvents = 0;
      el.addEventListener('focus', () => { focusEvents++; });
      await el.hide();
      const hour = el.shadowRoot!.querySelector('[data-segment="hour"]')!;
      await waitUntil(() => el.shadowRoot!.activeElement === hour);
      expect(focusEvents).to.equal(0);
      expect(el.value).to.equal('13:59');
    } finally {
      await el.hide();
    }
  });

  it('keeps the latest segment tab stop when a close-focus listener redirects focus elsewhere', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div><button>Continue</button><lr-time-input label="Start time" hour-format="24" value="13:25"
        style="--lr-duration-base: 0ms"></lr-time-input></div>
    `);
    const el = wrapper.querySelector<LyraTimeInput>('lr-time-input')!;
    const outside = wrapper.querySelector('button')!;
    let redirect: Promise<void> | undefined;
    try {
      await el.show();
      const option = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-column="minute"][data-value="59"]')!;
      option.click();
      const minute = el.shadowRoot!.querySelector<HTMLElement>('[data-segment="minute"]')!;
      const hour = el.shadowRoot!.querySelector('[data-segment="hour"]')!;
      await waitUntil(() => el.shadowRoot!.activeElement === minute);
      await focusByKeyboard(option);
      expect(el.shadowRoot!.activeElement === option).to.equal(true);
      hour.addEventListener('focus', () => {
        if (!redirect && el.shadowRoot!.activeElement === hour) redirect = focusByKeyboard(outside);
      });
      await el.hide();
      await waitUntil(() => redirect !== undefined, 'the consumer handles the restored-hour focus');
      await redirect;
      await el.updateComplete;
      expect(document.activeElement === outside).to.equal(true);
      expect([...el.shadowRoot!.querySelectorAll<HTMLElement>('[data-segment][tabindex="0"]')]
        .map(segment => segment.dataset['segment'])).to.deep.equal(['minute']);
      await focusByKeyboard(el);
      expect(el.shadowRoot!.activeElement === minute).to.equal(true);
      expect(el.value).to.equal('13:59');
    } finally {
      await el.hide();
    }
  });

  it('returns null from the UTC date view after clearing, then recovers an exact UTC roundtrip silently', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input label="Start time" value="08:30"></lr-time-input>`);
    const events: string[] = [];
    for (const name of ['input', 'change', 'lr-input', 'lr-change']) el.addEventListener(name, () => events.push(name));
    el.valueAsUTCDate = null;
    await el.updateComplete;
    expect(el.valueAsUTCDate).to.equal(null);
    expect(el.value).to.equal('');
    const date = new Date(Date.UTC(1970, 0, 1, 23, 45));
    el.valueAsUTCDate = date;
    await el.updateComplete;
    expect(el.valueAsUTCDate?.getTime()).to.equal(date.getTime());
    expect(el.value).to.equal('23:45');
    expect(events).to.deep.equal([]);
  });
});
