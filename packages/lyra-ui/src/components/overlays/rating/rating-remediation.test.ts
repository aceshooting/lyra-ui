import { fixture, expect, html } from '@open-wc/testing';
import './rating.js';
import type { LyraRating } from './rating.js';

for (const custom of [false, true]) {
  it(`keeps readonly validity and aria-invalid synchronized${custom ? ' with a custom error' : ''}`, async () => {
    const el = await fixture<LyraRating>(html`<lr-rating required aria-label="Authored score"></lr-rating>`);
    if (custom) el.setCustomValidity('Try again');
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
