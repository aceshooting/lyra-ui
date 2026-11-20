import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-rating.js';
import type { LyraRating } from './rating.class.js';

describe('lr-rating default-value coercion', () => {
  it('coerces a non-number defaultValue and resets to it', async () => {
    const el = await fixture<LyraRating>(html`<lr-rating label="Score"></lr-rating>`);
    el.defaultValue = '3' as unknown as number;
    expect(el.defaultValue).to.equal(3);
    expect(el.getAttribute('default-value')).to.equal('3');
    el.value = 5;
    const form = document.createElement('form');
    el.before(form);
    form.append(el);
    form.reset();
    await el.updateComplete;
    expect(el.value).to.equal(3);
  });
});
