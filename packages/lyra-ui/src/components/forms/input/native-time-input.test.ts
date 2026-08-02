import { fixture, expect, html } from '@open-wc/testing';
import './native-time-input.js';
import type { LyraNativeTimeInput } from './native-time-input.class.js';

const nativeInput = (el: LyraNativeTimeInput): HTMLInputElement => el.shadowRoot!.querySelector('input')!;

it('preserves the Lyra 7 browser-native time control under lr-native-time-input', async () => {
  const el = await fixture<LyraNativeTimeInput>(
    html`<lr-native-time-input label="Start time" min="09:00" max="17:00" value="09:30"></lr-native-time-input>`,
  );
  expect(nativeInput(el).type).to.equal('time');
  expect(nativeInput(el).getAttribute('min')).to.equal('09:00');
  expect(nativeInput(el).getAttribute('max')).to.equal('17:00');
  expect(el.value).to.equal('09:30');
  await expect(el).to.be.accessible();
});

it('keeps seconds-precision bounds and native constraint validation', async () => {
  const el = await fixture<LyraNativeTimeInput>(
    html`<lr-native-time-input min="09:00:30" max="17:00" step="1"></lr-native-time-input>`,
  );
  expect(nativeInput(el).getAttribute('min')).to.equal('09:00:30');
  el.value = '08:00';
  expect(el.checkValidity()).to.equal(false);
});
