import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-rubric-form.js';
import type { LyraRubricForm, RubricKey, RubricValue } from '../../lr-rubric-form.js';

describe('lr-rubric-form nullish values and option-less categories', () => {
  it('treats a nullish live value as an empty answer set', async () => {
    const keys: RubricKey[] = [{ key: 'note', type: 'comment' }];
    const form = await fixture<HTMLFormElement>(html`<form><lr-rubric-form name="answers" .keys=${keys}
      .value=${{ note: 'Draft' }}></lr-rubric-form></form>`);
    const el = form.querySelector<LyraRubricForm>('lr-rubric-form')!;
    await el.updateComplete;
    expect(el.value).to.deep.equal({ note: 'Draft' });

    el.value = null as unknown as RubricValue;
    await el.updateComplete;

    expect(el.value).to.deep.equal({});
    expect(new FormData(form).get('answers')).to.equal('{}');
  });

  it('renders a category without options as an empty choice and drops answers for it', async () => {
    const keys: RubricKey[] = [{ key: 'tone', type: 'category', label: 'Tone' }];
    const el = await fixture<LyraRubricForm>(html`<lr-rubric-form .keys=${keys} .value=${{ tone: 'warm' }}></lr-rubric-form>`);
    await el.updateComplete;
    expect(el.value).to.deep.equal({});
    const select = el.shadowRoot!.querySelector('lr-select');
    expect(select !== null, 'the category renders its select').to.equal(true);
    expect(select!.querySelectorAll('lr-option').length).to.equal(0);
  });
});
