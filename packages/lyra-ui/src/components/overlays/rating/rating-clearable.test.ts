import { expect, fixture, html } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { LyraRating } from '../../lr-rating.js';

describe('lr-rating clearable', () => {
  it('clears a repeated fractional selection through the normal form and veto contract', async () => {
    const form = await fixture<HTMLFormElement>(html`<form><lr-rating name="score" value="2.5"
      precision="0.5" clearable required></lr-rating></form>`);
    const rating = form.querySelector<LyraRating>('lr-rating')!;
    const symbol = rating.shadowRoot!.querySelector<HTMLElement>('[data-value="3"]')!;
    const rect = symbol.getBoundingClientRect();
    const click = () => symbol.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: rect.left + rect.width / 4 }));
    const values: number[] = [];
    rating.addEventListener('lr-change', event => values.push(event.detail.value));
    rating.addEventListener('lr-change-request', event => event.preventDefault(), { once: true });
    click();
    expect(rating.value).to.equal(2.5);
    click();
    expect(values).to.deep.equal([0]);
    expect(new FormData(form).get('score')).to.equal('0');
    expect(rating.validity.valueMissing).to.equal(true);
  });

  it('supports Delete and Backspace only while clearing is enabled and the slider is editable', async () => {
    const rating = await fixture<LyraRating>(html`<lr-rating value="2"></lr-rating>`);
    await focusByKeyboard(rating);
    await sendKeys({ press: 'Backspace' });
    expect(rating.value).to.equal(2);
    rating.clearable = true;
    for (const key of ['Backspace', 'Delete']) {
      rating.value = 2;
      await sendKeys({ press: key });
      expect(rating.value).to.equal(0);
    }
    rating.value = 2;
    rating.readonly = true;
    await sendKeys({ press: 'Delete' });
    expect(rating.value).to.equal(2);
  });

  it('keeps a disabled fieldset silent and restores the filter default on form reset', async () => {
    const form = await fixture<HTMLFormElement>(html`<form><fieldset disabled>
      <lr-rating name="minimum" value="4" default-value="3" clearable></lr-rating>
    </fieldset></form>`);
    const rating = form.querySelector<LyraRating>('lr-rating')!;
    const changes: number[] = [];
    rating.addEventListener('lr-change', event => changes.push(event.detail.value));

    rating.shadowRoot!.querySelector<HTMLElement>('[data-value="4"]')!.click();
    expect(rating.value).to.equal(4);
    expect(new FormData(form).has('minimum')).to.equal(false);
    form.querySelector('fieldset')!.disabled = false;
    await rating.updateComplete;
    await focusByKeyboard(rating);
    await sendKeys({ press: 'Delete' });
    expect(new FormData(form).get('minimum')).to.equal('0');
    form.reset();
    expect(new FormData(form).get('minimum')).to.equal('3');
    expect(changes).to.deep.equal([0]);
  });

  it('shows the supplied label on request and preserves an explicit accessible name', async () => {
    const rating = await fixture<LyraRating>(html`<lr-rating label="Minimum stars" aria-label="Filter by stars"></lr-rating>`);
    const visibleLabel = () => rating.shadowRoot!.querySelector('[part="label"]')?.textContent;
    expect(visibleLabel()).to.be.undefined;
    rating.withLabel = true;
    await rating.updateComplete;
    expect(visibleLabel()).to.equal('Minimum stars');
    expect(rating.getAttribute('aria-label')).to.equal('Filter by stars');
  });
});
