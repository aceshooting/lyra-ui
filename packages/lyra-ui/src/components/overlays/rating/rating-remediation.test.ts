import { fixture, expect, html } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './rating.js';
import type { LyraRating } from './rating.js';

for (const custom of [false, true]) {
  it(`keeps readonly validity and aria-invalid synchronized${custom ? ' with a custom error' : ''}`, async () => {
    const el = await fixture<LyraRating>(html`<lr-rating required aria-label="Authored score"></lr-rating>`);
    if (custom) el.setCustomValidity('Try again');
    el.reportValidity();
    for (const readonly of [true, false, true, false]) {
      el.readonly = readonly;
      await el.updateComplete;
      expect(el.getAttribute('aria-invalid')).to.equal(el.validity.valid ? 'false' : 'true');
      expect(el.validity.customError).to.equal(custom);
      expect(el.getAttribute('aria-label')).to.equal('Authored score');
    }
  });
}

it('renders the form story with an explicit independent reset value of two', async () => {
  const { InAForm } = await import('./rating.stories.js');
  const render = InAForm.render;
  if (typeof render !== 'function') throw new Error('The form story must render its example');
  const form = await fixture<HTMLFormElement>(Reflect.apply(render, undefined, [{}, {}]));
  const rating = form.querySelector<LyraRating>('lr-rating')!;
  expect(rating.defaultValue).to.equal(2);
  rating.value = 5;
  form.reset();
  await rating.updateComplete;
  expect(rating.value).to.equal(2);
});

const press = (el: LyraRating, key: string): void => {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true }));
};

it('snaps a fractional precision without leaking floating-point noise', async () => {
  const el = await fixture<LyraRating>(html`<lr-rating precision="0.1" max="1" value="0.2" name="score"></lr-rating>`);
  press(el, 'ArrowRight');
  await el.updateComplete;
  expect(el.value).to.equal(0.3);
  expect(el.getAttribute('aria-valuenow')).to.equal('0.3');
});

it('exposes intrinsic invalidity only after the user has interacted', async () => {
  const el = await fixture<LyraRating>(html`<lr-rating required aria-label="Score"></lr-rating>`);
  expect(el.getAttribute('aria-invalid')).to.equal('false');
  el.reportValidity();
  await el.updateComplete;
  expect(el.getAttribute('aria-invalid')).to.equal('true');
});

it('does not count the blur a fieldset disable forces as interaction', async () => {
  const fieldset = await fixture<HTMLFieldSetElement>(html`<fieldset><lr-rating required aria-label="Score"></lr-rating></fieldset>`);
  const el = fieldset.querySelector('lr-rating')!;
  await focusByKeyboard(el);
  fieldset.disabled = true;
  fieldset.disabled = false;
  await el.updateComplete;
  expect(el.matches(':state(user-invalid)')).to.equal(false);
});

it('steps by ten precision units with PageUp and PageDown', async () => {
  const el = await fixture<LyraRating>(html`<lr-rating max="50" value="5"></lr-rating>`);
  press(el, 'PageUp');
  expect(el.value).to.equal(15);
  press(el, 'PageDown');
  expect(el.value).to.equal(5);
});

for (const size of ['2xs', 'xs', 's']) {
  it(`keeps adjacent ${size} symbol centres at least 24px apart`, async () => {
    const el = await fixture<LyraRating>(html`<lr-rating size=${size}></lr-rating>`);
    const [first, second] = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="star"]')].map((star) => star.getBoundingClientRect());
    expect(second!.left + second!.width / 2 - (first!.left + first!.width / 2)).to.be.at.least(23.5);
  });
}
