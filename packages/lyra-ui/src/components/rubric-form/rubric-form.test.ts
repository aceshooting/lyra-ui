import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './rubric-form.js';
import type { LyraRubricForm, RubricKey } from './rubric-form.js';

const KEYS: RubricKey[] = [
  { key: 'accuracy', type: 'score', label: 'Accuracy', min: 0, max: 5, step: 1, required: true },
  {
    key: 'category',
    type: 'category',
    label: 'Issue category',
    options: [
      { value: 'hallucination', label: 'Hallucination' },
      { value: 'tone', label: 'Tone' },
    ],
  },
  { key: 'comment', type: 'comment', label: 'Notes', placeholder: 'Optional notes' },
];

describe('lyra-rubric-form', () => {
  it('renders one control per key, in array order', async () => {
    const el = (await fixture(html`<lyra-rubric-form .keys=${KEYS}></lyra-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    const fields = [...el.shadowRoot!.querySelectorAll('[part="field"]')].map((f) => f.getAttribute('data-key'));
    expect(fields).to.deep.equal(['accuracy', 'category', 'comment']);
    expect(el.shadowRoot!.querySelector('[data-key="accuracy"] lyra-segmented')).to.exist;
    expect(el.shadowRoot!.querySelector('[data-key="category"] lyra-select')).to.exist;
    expect(el.shadowRoot!.querySelector('[data-key="comment"] lyra-textarea')).to.exist;
  });

  it('renders a score field with >10 discrete steps as lyra-slider instead of lyra-segmented', async () => {
    const keys: RubricKey[] = [{ key: 'score', type: 'score', min: 0, max: 100, step: 1 }];
    const el = (await fixture(html`<lyra-rubric-form .keys=${keys}></lyra-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-key="score"] lyra-slider')).to.exist;
    expect(el.shadowRoot!.querySelector('[data-key="score"] lyra-segmented')).to.not.exist;
  });

  it('renders a multiple category field as lyra-checkbox-group with slotted lyra-checkbox options', async () => {
    const keys: RubricKey[] = [
      { key: 'tags', type: 'category', multiple: true, options: [{ value: 'a' }, { value: 'b' }] },
    ];
    const el = (await fixture(html`<lyra-rubric-form .keys=${keys}></lyra-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    const group = el.shadowRoot!.querySelector('[data-key="tags"] lyra-checkbox-group') as HTMLElement;
    expect(group).to.exist;
    expect(group.querySelectorAll('lyra-checkbox').length).to.equal(2);
  });

  it('emits lyra-input with the full value object when a score control changes', async () => {
    const el = (await fixture(html`<lyra-rubric-form .keys=${KEYS}></lyra-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    const segmented = el.shadowRoot!.querySelector('[data-key="accuracy"] lyra-segmented') as HTMLElement;
    setTimeout(() => segmented.dispatchEvent(new CustomEvent('lyra-change', { detail: { value: '4' } })));
    const ev = await oneEvent(el, 'lyra-input');
    expect(ev.detail.value.accuracy).to.equal(4);
  });

  it('emits lyra-input with the full value object when a multiple category control changes', async () => {
    const keys: RubricKey[] = [
      { key: 'tags', type: 'category', multiple: true, options: [{ value: 'a' }, { value: 'b' }] },
    ];
    const el = (await fixture(html`<lyra-rubric-form .keys=${keys}></lyra-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    const group = el.shadowRoot!.querySelector('[data-key="tags"] lyra-checkbox-group') as HTMLElement;
    setTimeout(() => group.dispatchEvent(new CustomEvent('lyra-change', { detail: { value: ['a', 'b'] } })));
    const ev = await oneEvent(el, 'lyra-input');
    expect(ev.detail.value.tags).to.deep.equal(['a', 'b']);
  });

  it('emits lyra-validity-change on mount and again once a required field is filled', async () => {
    const el = (await fixture(html`<lyra-rubric-form .keys=${KEYS}></lyra-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    expect(el.checkValidity()).to.be.false;
    setTimeout(() => {
      el.value = { ...el.value, accuracy: 3 };
    });
    const ev = await oneEvent(el, 'lyra-validity-change');
    expect(ev.detail.valid).to.be.true;
  });

  it('emits lyra-submit with the value and itemId only after validity passes', async () => {
    const el = (await fixture(
      html`<lyra-rubric-form .keys=${KEYS} item-id="item-1" .value=${{ accuracy: 5 }}></lyra-rubric-form>`,
    )) as LyraRubricForm;
    await el.updateComplete;
    const submit = el.shadowRoot!.querySelector('[part="submit"]') as HTMLElement;
    setTimeout(() => submit.click());
    const ev = await oneEvent(el, 'lyra-submit');
    expect(ev.detail).to.deep.equal({ value: { accuracy: 5 }, itemId: 'item-1' });
  });

  it('does not emit lyra-submit when validity fails, and reveals the error', async () => {
    const el = (await fixture(html`<lyra-rubric-form .keys=${KEYS} item-id="item-1"></lyra-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    const submit = el.shadowRoot!.querySelector('[part="submit"]') as HTMLElement;
    let fired = false;
    el.addEventListener('lyra-submit', () => (fired = true));
    submit.click();
    await el.updateComplete;
    expect(fired).to.be.false;
    expect(el.shadowRoot!.querySelector('[data-key="accuracy"] [part="error"]')).to.exist;
  });

  it('switches the submit label between rubricSubmit and rubricSubmitAndNext based on has-next', async () => {
    const el = (await fixture(html`<lyra-rubric-form .keys=${KEYS} has-next></lyra-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="submit"]')!.textContent!.trim()).to.equal('Submit and next');
  });

  it('emits lyra-skip without validating when skippable', async () => {
    const el = (await fixture(
      html`<lyra-rubric-form .keys=${KEYS} item-id="item-1" skippable></lyra-rubric-form>`,
    )) as LyraRubricForm;
    await el.updateComplete;
    const skip = el.shadowRoot!.querySelector('[part="skip"]') as HTMLElement;
    setTimeout(() => skip.click());
    const ev = await oneEvent(el, 'lyra-skip');
    expect(ev.detail).to.deep.equal({ itemId: 'item-1' });
  });

  it('resets touched/error-reveal state when itemId changes', async () => {
    const el = (await fixture(html`<lyra-rubric-form .keys=${KEYS} item-id="item-1"></lyra-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    el.reportValidity();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-key="accuracy"] [part="error"]')).to.exist;
    el.itemId = 'item-2';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-key="accuracy"] [part="error"]')).to.not.exist;
  });

  it('renders a visible unsupported-field note for a key outside the three types and marks the form invalid', async () => {
    const keys = [{ key: 'x', type: 'bogus' }] as unknown as RubricKey[];
    const el = (await fixture(html`<lyra-rubric-form .keys=${keys}></lyra-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="unsupported"]')).to.exist;
    expect(el.checkValidity()).to.be.false;
  });

  it('participates in a form: submits the value as JSON under name', async () => {
    const form = (await fixture(html`
      <form>
        <lyra-rubric-form name="rubric" .keys=${KEYS} .value=${{ accuracy: 3 }}></lyra-rubric-form>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lyra-rubric-form') as LyraRubricForm;
    await el.updateComplete;
    const data = new FormData(form);
    expect(JSON.parse(data.get('rubric') as string).accuracy).to.equal(3);
  });

  it('renders noData when keys is empty', async () => {
    const el = (await fixture(html`<lyra-rubric-form></lyra-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.equal('No data');
  });

  it('registers every sibling control as a side effect of importing rubric-form.js (regression)', async () => {
    // Importing the *.class.js module alone never calls defineElement -- only the barrel (*.js)
    // does. A component that imports a composed control via its .class.js path renders an
    // un-upgraded, plain HTMLElement for it, silently breaking anything that calls a method on
    // that control.
    expect(customElements.get('lyra-segmented')).to.exist;
    expect(customElements.get('lyra-slider')).to.exist;
    expect(customElements.get('lyra-select')).to.exist;
    expect(customElements.get('lyra-option')).to.exist;
    expect(customElements.get('lyra-checkbox')).to.exist;
    expect(customElements.get('lyra-checkbox-group')).to.exist;
    expect(customElements.get('lyra-textarea')).to.exist;
  });

  it('is accessible', async () => {
    const el = (await fixture(html`<lyra-rubric-form .keys=${KEYS} skippable has-next></lyra-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});
