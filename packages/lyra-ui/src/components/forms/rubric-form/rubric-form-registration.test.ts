import { expect, fixture, html } from '@open-wc/testing';
import { tag } from '../../../internal/prefix.js';
import '../../lr-rubric-form.js';
import type { LyraRubricForm, RubricKey } from './rubric-form.class.js';

const defined = (name: string): boolean => Boolean(customElements.get(tag(name)));

it('registers the category controls only when a category key first renders', async () => {
  const scoreAndComment: RubricKey[] = [
    { key: 'quality', type: 'score', min: 1, max: 5 },
    { key: 'notes', type: 'comment' },
  ];
  const el = await fixture<LyraRubricForm>(html`<lr-rubric-form .keys=${scoreAndComment}></lr-rubric-form>`);
  expect(defined('segmented') || defined('slider')).to.equal(true);
  expect(defined('textarea')).to.equal(true);
  expect(['select', 'option', 'checkbox', 'checkbox-group'].filter(defined)).to.deep.equal([]);

  el.keys = [
    ...scoreAndComment,
    { key: 'tone', type: 'category', options: [{ value: 'calm' }, { value: 'tense' }] },
    { key: 'tags', type: 'category', multiple: true, options: [{ value: 'a' }, { value: 'b' }] },
  ];
  await el.updateComplete;
  const select = el.shadowRoot!.querySelector(tag('select'))!;
  const group = el.shadowRoot!.querySelector(tag('checkbox-group'))!;
  expect(select.matches(':defined')).to.equal(true);
  expect(group.matches(':defined')).to.equal(true);
  expect(Array.from(el.shadowRoot!.querySelectorAll(`${tag('option')}, ${tag('checkbox')}`), node => node.matches(':defined')))
    .to.deep.equal([true, true, true, true]);
});
