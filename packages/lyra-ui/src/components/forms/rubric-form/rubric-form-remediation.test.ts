import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './rubric-form.js';
import type { LyraRubricForm, RubricKey } from './rubric-form.js';
import type { LyraCheckbox } from '../checkbox/checkbox.js';
import type { LyraCheckboxGroup } from '../checkbox-group/checkbox-group.js';

const keys: RubricKey[] = [{ key: 'tags', type: 'category', label: 'Tags', description: 'Field guidance', multiple: true, options: [{ value: 'a' }, { value: 'b' }] }];

function owner(field: LyraRubricForm): HTMLElement {
  return field.shadowRoot!.querySelector<HTMLElement>('[part="base"][role="group"]')!;
}

describe('rubric controlled checked values', () => {
  for (const settleUserEdit of [false, true]) {
    it(`reconciles child checked/group/submission after parent replacement (settled=${settleUserEdit})`, async () => {
      const form = await fixture<HTMLFormElement>(html`<form><lr-rubric-form name="review" .keys=${keys} .value=${{ tags: ['a'] }}></lr-rubric-form></form>`);
      const field = form.querySelector('lr-rubric-form')!;
      const group = field.shadowRoot!.querySelector<LyraCheckboxGroup>('lr-checkbox-group')!;
      const boxes = Array.from(group.querySelectorAll<LyraCheckbox>('lr-checkbox'));
      await Promise.all(boxes.map((box) => box.updateComplete));
      boxes[1]!.click();
      expect(boxes[1]!.checked).to.equal(true);
      expect(field.value).to.deep.equal({ tags: ['a', 'b'] });
      if (settleUserEdit) await field.updateComplete;
      let changes = 0;
      for (const name of ['input', 'change', 'lr-input', 'lr-change']) field.addEventListener(name, () => changes++);
      field.value = { tags: ['a'] };
      await field.updateComplete;
      await Promise.all(boxes.map((box) => box.updateComplete));
      expect(field.value).to.deep.equal({ tags: ['a'] });
      expect(boxes.map((box) => box.checked)).to.deep.equal([true, false]);
      await waitUntil(() => group.value.length === 1 && group.value[0] === 'a');
      expect(JSON.parse(String(new FormData(form).get('review')))).to.deep.equal({ tags: ['a'] });
      expect(changes).to.equal(0);
      field.value = { tags: ['b'] };
      await field.updateComplete;
      await Promise.all(boxes.map((box) => box.updateComplete));
      expect(boxes.map((box) => box.checked)).to.deep.equal([false, true]);
      await waitUntil(() => group.value.length === 1 && group.value[0] === 'b');
      expect(changes).to.equal(0);
      const checked = boxes[1]!;
      checked.defaultChecked = false;
      checked.setAttribute('checked', '');
      checked.removeAttribute('checked');
      expect(checked.checked).to.equal(true);
    });
  }
});

describe('rubric removable aggregate copy', () => {
  for (const [attribute, selector] of [['label', '[part~="aggregate-label"]'], ['hint', '[part~="aggregate-hint"]']] as const) {
    it(`safely removes ${attribute}, preserving null readback and recovery`, async () => {
      const field = await fixture<LyraRubricForm>(html`<lr-rubric-form .keys=${keys}></lr-rubric-form>`);
      field.setAttribute(attribute, 'Guidance');
      await field.updateComplete;
      expect(field.shadowRoot!.querySelector<HTMLElement>(selector)!.hidden).to.equal(false);
      field.removeAttribute(attribute);
      const error = await field.updateComplete.then(() => '', (reason: Error) => reason.message);
      expect(error).to.equal('');
      expect(field[attribute]).to.equal(null);
      expect(field.shadowRoot!.querySelector<HTMLElement>(selector)!.hidden).to.equal(true);
      field.setAttribute(attribute, '');
      await field.updateComplete;
      expect(field[attribute]).to.equal('');
      field.setAttribute(attribute, 'Restored');
      await field.updateComplete;
      expect(field.shadowRoot!.querySelector(selector)!.textContent).to.include('Restored');
    });
  }
});

describe('rubric aggregate external descriptions', () => {
  it('keeps external-first aggregate guidance live without copying it to child fields', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div><span id="rubric-external">External</span><lr-rubric-form .keys=${keys} aria-describedby="rubric-external missing rubric-external" hint="Hint" error-text="Error"></lr-rubric-form></div>`);
    const field = wrapper.querySelector('lr-rubric-form')!;
    const source = wrapper.querySelector('span')!;
    const refs = (): readonly Element[] => owner(field).ariaDescribedByElements ?? [];
    const hint = field.shadowRoot!.querySelector<HTMLElement>('[part~="aggregate-hint"]')!;
    const error = field.shadowRoot!.querySelector<HTMLElement>('[part~="aggregate-error"]')!;
    await waitUntil(() => refs()[0] === source);
    expect(refs().map((node) => node.id)).to.deep.equal([source.id, hint.id, error.id]);
    const group = field.shadowRoot!.querySelector<LyraCheckboxGroup>('lr-checkbox-group')!;
    expect(group.getAttribute('aria-describedby')).to.equal(null);
    expect(group.hint).to.equal('');
    expect(group.querySelector('[slot="hint"]')!.textContent).to.equal('Field guidance');
    const replacement = document.createElement('span');
    replacement.id = source.id;
    source.replaceWith(replacement);
    await waitUntil(() => refs()[0] === replacement);
    replacement.textContent = 'Replacement';
    expect(refs()[0]?.textContent).to.equal('Replacement');
    replacement.remove();
    await waitUntil(() => refs().length === 2);
    wrapper.prepend(replacement);
    await waitUntil(() => refs()[0] === replacement);
    replacement.id = 'rubric-renamed';
    await waitUntil(() => refs().length === 2);
    field.setAttribute('aria-describedby', replacement.id);
    await waitUntil(() => refs()[0] === replacement);
    field.hint = '';
    await field.updateComplete;
    await waitUntil(() => refs().length === 2);
    expect(refs().map((node) => node.id)).to.deep.equal([replacement.id, error.id]);
    field.removeAttribute('aria-describedby');
    await waitUntil(() => refs().length === 1);
    field.remove();
    field.setAttribute('aria-describedby', replacement.id);
    wrapper.append(field);
    await waitUntil(() => refs()[0] === replacement);
  });

  it('resolves within the host shadow root and newly adopted document', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div><iframe></iframe></div>`);
    const scope = document.createElement('div');
    wrapper.append(scope);
    const root = scope.attachShadow({ mode: 'open' });
    root.innerHTML = '<span id="rubric-scoped">Scoped</span><lr-rubric-form aria-describedby="rubric-scoped"></lr-rubric-form>';
    const field = root.querySelector('lr-rubric-form')!;
    await field.updateComplete;
    const refs = (): readonly Element[] => owner(field).ariaDescribedByElements ?? [];
    await waitUntil(() => refs()[0] === root.querySelector('span'));
    const targetDocument = wrapper.querySelector('iframe')!.contentDocument!;
    const target = targetDocument.createElement('span');
    target.id = 'rubric-scoped';
    targetDocument.body.append(target, field);
    await waitUntil(() => refs()[0] === target);
  });
});
