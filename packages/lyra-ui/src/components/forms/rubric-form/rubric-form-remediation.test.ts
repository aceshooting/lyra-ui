import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import '../../lr-rubric-form.js';
import type { LyraRubricForm, RubricKey } from '../../lr-rubric-form.js';
import type { LyraCheckbox } from '../../lr-checkbox.js';
import type { LyraCheckboxGroup } from '../../lr-checkbox-group.js';
import '../../../translations/fr/forms.js';
import '../../../translations/fr/shared.js';

const keys: RubricKey[] = [{ key: 'tags', type: 'category', label: 'Tags', description: 'Field guidance', multiple: true, options: [{ value: 'a' }, { value: 'b' }] }];

function owner(field: LyraRubricForm): HTMLElement {
  return field.shadowRoot!.querySelector<HTMLElement>('[part="base"][role="group"]')!;
}

describe('rubric controlled checked values', () => {
  it('reuses score choices when another field is edited and relabels them on locale changes', async () => {
    const schema: RubricKey[] = [{ key: 'score', type: 'score', min: 1000, max: 1002 },
      { key: 'comment', type: 'comment' }];
    const field = await fixture<LyraRubricForm>(html`<lr-rubric-form lang="en"
      .keys=${schema} .value=${{ score: 1001 }}></lr-rubric-form>`);
    const score = field.shadowRoot!.querySelector('lr-segmented')!;
    const items = score.items;
    expect(items.map(item => item.label)).to.deep.equal(['1,000', '1,001', '1,002']);
    field.value = { score: 1001, comment: 'Edited' };
    await field.updateComplete;
    expect(score.items === items).to.equal(true);
    field.lang = 'fr';
    await field.updateComplete;
    expect(score.items.map(item => item.label)).to.deep.equal(['1 000', '1 001', '1 002']);
  });

  for (const settleUserEdit of [false, true]) {
    it(`reconciles child checked/group/submission after parent replacement (settled=${settleUserEdit})`, async () => {
      const form = await fixture<HTMLFormElement>(html`<form><lr-rubric-form name="review" .keys=${keys} .value=${{ tags: ['a'] }}></lr-rubric-form></form>`);
      const field = form.querySelector('lr-rubric-form')!;
      await field.updateComplete;
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
    expect(refs().map((node) => node.id)).to.deep.equal([source.id, error.id, hint.id]);
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

describe('rubric same-object rebinds', () => {
  it('keeps the reviewer edits when a parent rebinds the same keys and value, and still takes a new object', async () => {
    const saved = { tags: ['a'] };
    const field = await fixture<LyraRubricForm>(html`<lr-rubric-form .keys=${keys} .value=${saved}></lr-rubric-form>`);
    const boxes = Array.from(field.shadowRoot!.querySelectorAll<LyraCheckbox>('lr-checkbox'));
    await Promise.all(boxes.map((box) => box.updateComplete));
    boxes[1]!.click();
    expect(field.value).to.deep.equal({ tags: ['a', 'b'] });
    field.keys = keys;
    field.value = saved;
    await field.updateComplete;
    expect(field.value).to.deep.equal({ tags: ['a', 'b'] });
    field.value = { tags: ['a'] };
    expect(field.value).to.deep.equal({ tags: ['a'] });
  });
});

describe('rubric submit pointer paint', () => {
  it('mixes hover from the resting accent fill it paints', async () => {
    const comment: RubricKey[] = [{ key: 'comment', type: 'comment', label: 'Comment' }];
    const hoverBg = async (style: string): Promise<string> => {
      const el = await fixture<LyraRubricForm>(html`<lr-rubric-form .keys=${comment} style=${style}></lr-rubric-form>`);
      const submit = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="submit"]')!;
      try {
        await hoverUntilMatched(submit, 'the pointer never hovered submit');
        return getComputedStyle(submit).backgroundColor;
      } finally {
        await resetMouse();
        el.remove();
      }
    };
    const viaAccent = await hoverBg('--lr-transition-fast: 0s; --lr-color-brand: rgb(0, 0, 200); --lr-button-accent-fill: rgb(10, 120, 30)');
    const viaOwn = await hoverBg('--lr-transition-fast: 0s; --lr-color-brand: rgb(0, 0, 200); --lr-rubric-form-submit-bg: rgb(10, 120, 30)');
    expect(viaAccent).to.equal(viaOwn);
  });
});
