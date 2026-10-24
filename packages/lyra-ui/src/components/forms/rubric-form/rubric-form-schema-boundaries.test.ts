import { expect, fixture, html } from '@open-wc/testing';
import './rubric-form.js';
import type { LyraRubricForm, RubricKey } from './rubric-form.class.js';

const notes: RubricKey = { key: 'notes', type: 'comment', label: 'Notes' };
const choices: RubricKey = {
  key: 'choices', type: 'category', label: 'Choices', multiple: true,
  options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }],
};

function unavailableLength<T>(values: T[]): T[] {
  return new Proxy(values, {
    getOwnPropertyDescriptor(target, name) {
      if (name === 'length') throw new TypeError('Array metadata unavailable');
      return Reflect.getOwnPropertyDescriptor(target, name);
    },
  });
}

async function rubric(): Promise<{ form: HTMLFormElement; el: LyraRubricForm }> {
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-rubric-form name="review" label="Review" .keys=${[notes, choices]}></lr-rubric-form></form>
  `);
  const el = form.querySelector<LyraRubricForm>('lr-rubric-form')!;
  el.value = { notes: 'Keep this answer' };
  await el.updateComplete;
  return { form, el };
}

function submitted(form: HTMLFormElement): unknown {
  return JSON.parse(String(new FormData(form).get('review')));
}

describe('rubric schema admission preserves usable fields', () => {
  for (const [type, member] of [['score', 'min'], ['category', 'multiple'], ['comment', 'placeholder']] as const) {
    it(`rejects an accessor-backed ${type} ${member} without reading it or losing another answer`, async () => {
      const { el, form } = await rubric();
      let reads = 0;
      const rejected = { key: 'rejected', type };
      Object.defineProperty(rejected, member, { get() { reads++; return 'untrusted'; } });
      Reflect.set(el, 'keys', [rejected, notes]);
      await el.updateComplete;
      expect(reads).to.equal(0);
      expect(el.keys.map(key => key.key)).to.deep.equal(['notes']);
      expect(el.shadowRoot!.querySelectorAll('lr-textarea').length).to.equal(1);
      expect(el.value).to.deep.equal({ notes: 'Keep this answer' });
      expect(submitted(form)).to.deep.equal(el.value);
      expect(el.checkValidity()).to.equal(true);
      await expect(el).to.be.accessible();
    });
  }

  it('drops a non-string field discriminant and keeps a later valid field', async () => {
    const { el, form } = await rubric();
    Reflect.set(el, 'keys', [{ key: 'rejected', type: 12 }, notes]);
    await el.updateComplete;
    expect(el.keys.map(key => key.key)).to.deep.equal(['notes']);
    expect(submitted(form)).to.deep.equal({ notes: 'Keep this answer' });
    expect(el.shadowRoot!.querySelectorAll('lr-textarea').length).to.equal(1);
  });

  it('skips sparse and accessor-backed schema slots without invoking a row getter', async () => {
    const { el, form } = await rubric();
    let reads = 0;
    const schema: unknown[] = new Array(3);
    Object.defineProperty(schema, '1', { get() { reads++; return notes; } });
    schema[2] = notes;
    Reflect.set(el, 'keys', schema);
    await el.updateComplete;
    expect(reads).to.equal(0);
    expect(el.keys.map(key => key.key)).to.deep.equal(['notes']);
    expect(submitted(form)).to.deep.equal({ notes: 'Keep this answer' });
  });

  for (const [name, options] of [
    ['non-array', { value: 'yes' }],
    ['unavailable-length', unavailableLength([{ value: 'yes' }])],
  ] as const) {
    it(`retains a category with safe empty options after ${name} option input`, async () => {
      const { el, form } = await rubric();
      Reflect.set(el, 'keys', [notes, { key: 'choices', type: 'category', label: 'Choices', options }]);
      await el.updateComplete;
      expect(el.keys.map(key => key.key)).to.deep.equal(['notes', 'choices']);
      const category = el.keys[1]!;
      if (category.type !== 'category') throw new Error('Expected a category field');
      expect(category.options).to.deep.equal([]);
      expect(el.shadowRoot!.querySelectorAll('lr-select').length).to.equal(1);
      expect(submitted(form)).to.deep.equal({ notes: 'Keep this answer' });
    });
  }

  it('clears an uninspectable schema then recovers the live controls when a valid schema arrives', async () => {
    const { el, form } = await rubric();
    Reflect.set(el, 'keys', unavailableLength([notes]));
    await el.updateComplete;
    expect(el.keys).to.deep.equal([]);
    expect(el.shadowRoot!.querySelectorAll('lr-textarea').length).to.equal(0);
    expect(submitted(form)).to.deep.equal({});
    el.keys = [notes];
    el.value = { notes: 'Recovered answer' };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('lr-textarea').length).to.equal(1);
    expect(submitted(form)).to.deep.equal({ notes: 'Recovered answer' });
  });
});

describe('rubric multiple-choice answer admission', () => {
  it('ignores missing and accessor-backed selections while preserving a later allowed selection', async () => {
    const { el, form } = await rubric();
    let reads = 0;
    const answer: string[] = new Array(3);
    Object.defineProperty(answer, '1', { get() { reads++; return 'no'; } });
    answer[2] = 'yes';
    el.value = { notes: 'Keep this answer', choices: answer };
    await el.updateComplete;
    expect(reads).to.equal(0);
    expect(el.value).to.deep.equal({ notes: 'Keep this answer', choices: ['yes'] });
    expect(submitted(form)).to.deep.equal(el.value);
    const boxes = [...el.shadowRoot!.querySelectorAll<HTMLElement & { checked: boolean; updateComplete: Promise<boolean> }>('lr-checkbox')];
    await Promise.all(boxes.map(box => box.updateComplete));
    const selected = boxes.filter(box => box.checked).map(box => box.getAttribute('value'));
    expect(selected).to.deep.equal(['yes']);
  });

  for (const kind of ['unavailable-length', 'revoked'] as const) {
    it(`rejects a ${kind} selected array without discarding a valid comment`, async () => {
      const { el, form } = await rubric();
      const revoked = Proxy.revocable(['yes'], {});
      revoked.revoke();
      const selected = kind === 'revoked' ? revoked.proxy : unavailableLength(['yes']);
      el.value = { notes: 'Keep this answer', choices: selected };
      await el.updateComplete;
      expect(el.value).to.deep.equal({ notes: 'Keep this answer' });
      expect(submitted(form)).to.deep.equal(el.value);
      const boxes = [...el.shadowRoot!.querySelectorAll<HTMLElement & { checked: boolean; updateComplete: Promise<boolean> }>('lr-checkbox')];
      await Promise.all(boxes.map(box => box.updateComplete));
      expect(boxes.some(box => box.checked)).to.equal(false);
      expect(el.checkValidity()).to.equal(true);
    });
  }
});
