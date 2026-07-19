import { fixture, expect, html } from '@open-wc/testing';
import './time-input.js';
import './input.js';
import type { LyraTimeInput } from './time-input.class.js';
import type { LyraInput } from './input.class.js';

const nativeInput = (el: LyraInput): HTMLInputElement => el.shadowRoot!.querySelector('input')!;

it('forwards a time-shaped min/max attribute verbatim to the native time input', async () => {
  const el = await fixture<LyraTimeInput>(
    html`<lr-time-input label="Start time" min="09:00" max="17:00"></lr-time-input>`,
  );
  expect(el.min).to.equal('09:00');
  expect(el.max).to.equal('17:00');
  expect(nativeInput(el).getAttribute('min')).to.equal('09:00');
  expect(nativeInput(el).getAttribute('max')).to.equal('17:00');
  await expect(el).to.be.accessible();
});

it('keeps a seconds-precision time bound intact', async () => {
  const el = await fixture<LyraTimeInput>(html`<lr-time-input min="09:00:30" step="1"></lr-time-input>`);
  expect(nativeInput(el).getAttribute('min')).to.equal('09:00:30');
});

it('still accepts min/max as direct property assignments', async () => {
  const el = await fixture<LyraTimeInput>(html`<lr-time-input label="Start time"></lr-time-input>`);
  el.min = '09:00';
  el.max = '17:00';
  await el.updateComplete;
  expect(nativeInput(el).getAttribute('min')).to.equal('09:00');
  expect(nativeInput(el).getAttribute('max')).to.equal('17:00');
});

it('drops the native bound again when the attribute is removed', async () => {
  const el = await fixture<LyraTimeInput>(html`<lr-time-input min="09:00"></lr-time-input>`);
  el.removeAttribute('min');
  await el.updateComplete;
  expect(el.min).to.equal(undefined);
  expect(nativeInput(el).hasAttribute('min')).to.be.false;
});

it('renders no bound attributes at all when min/max are unset', async () => {
  const el = await fixture<LyraTimeInput>(html`<lr-time-input label="Start time"></lr-time-input>`);
  expect(nativeInput(el).hasAttribute('min')).to.be.false;
  expect(nativeInput(el).hasAttribute('max')).to.be.false;
  expect(el.checkValidity()).to.be.true;
});

it('lets the native time input range-validate against an attribute-declared bound', async () => {
  const el = await fixture<LyraTimeInput>(html`<lr-time-input min="09:00" max="17:00"></lr-time-input>`);
  el.value = '08:00';
  await el.updateComplete;
  expect(el.checkValidity()).to.be.false;
  el.value = '10:00';
  await el.updateComplete;
  expect(el.checkValidity()).to.be.true;
});

it('leaves lr-input type="number" min/max numeric', async () => {
  const el = await fixture<LyraInput>(html`<lr-input type="number" min="3" max="9"></lr-input>`);
  expect(el.min).to.equal(3);
  expect(el.max).to.equal(9);
  expect(typeof el.min).to.equal('number');
  expect(typeof el.max).to.equal('number');
  expect(nativeInput(el).getAttribute('min')).to.equal('3');
  expect(nativeInput(el).getAttribute('max')).to.equal('9');
  el.value = '20';
  await el.updateComplete;
  expect(el.checkValidity()).to.be.false;
});
