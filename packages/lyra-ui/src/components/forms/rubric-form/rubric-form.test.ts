import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import { render } from 'lit';
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

describe('lr-rubric-form', () => {
  it('renders one control per key, in array order', async () => {
    const el = (await fixture(html`<lr-rubric-form .keys=${KEYS}></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    const fields = [...el.shadowRoot!.querySelectorAll('[part="field"]')].map((f) => f.getAttribute('data-key'));
    expect(fields).to.deep.equal(['accuracy', 'category', 'comment']);
    expect(el.shadowRoot!.querySelector('[data-key="accuracy"] lr-segmented')).to.exist;
    expect(el.shadowRoot!.querySelector('[data-key="category"] lr-select')).to.exist;
    expect(el.shadowRoot!.querySelector('[data-key="comment"] lr-textarea')).to.exist;
  });

  it('renders a score field with >10 discrete steps as lr-slider instead of lr-segmented', async () => {
    const keys: RubricKey[] = [{ key: 'score', type: 'score', min: 0, max: 100, step: 1 }];
    const el = (await fixture(html`<lr-rubric-form .keys=${keys}></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-key="score"] lr-slider')).to.exist;
    expect(el.shadowRoot!.querySelector('[data-key="score"] lr-segmented')).to.not.exist;
  });

  it('renders a multiple category field as lr-checkbox-group with slotted lr-checkbox options', async () => {
    const keys: RubricKey[] = [
      { key: 'tags', type: 'category', multiple: true, options: [{ value: 'a' }, { value: 'b' }] },
    ];
    const el = (await fixture(html`<lr-rubric-form .keys=${keys}></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    const group = el.shadowRoot!.querySelector('[data-key="tags"] lr-checkbox-group') as HTMLElement;
    expect(group).to.exist;
    expect(group.querySelectorAll('lr-checkbox').length).to.equal(2);
  });

  it('emits lr-input with the full value object when a score control changes', async () => {
    const el = (await fixture(html`<lr-rubric-form .keys=${KEYS}></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    const segmented = el.shadowRoot!.querySelector('[data-key="accuracy"] lr-segmented') as HTMLElement;
    setTimeout(() => segmented.dispatchEvent(new CustomEvent('lr-change', { detail: { value: '4' } })));
    const ev = await oneEvent(el, 'lr-input');
    expect(ev.detail.value.accuracy).to.equal(4);
  });

  it('emits lr-input with the full value object when a multiple category control changes', async () => {
    const keys: RubricKey[] = [
      { key: 'tags', type: 'category', multiple: true, options: [{ value: 'a' }, { value: 'b' }] },
    ];
    const el = (await fixture(html`<lr-rubric-form .keys=${keys}></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    const group = el.shadowRoot!.querySelector('[data-key="tags"] lr-checkbox-group') as HTMLElement;
    setTimeout(() => group.dispatchEvent(new CustomEvent('lr-change', { detail: { value: ['a', 'b'] } })));
    const ev = await oneEvent(el, 'lr-input');
    expect(ev.detail.value.tags).to.deep.equal(['a', 'b']);
  });

  it('emits lr-validity-change on mount and again once a required field is filled', async () => {
    const el = (await fixture(html`<lr-rubric-form .keys=${KEYS}></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    expect(el.checkValidity()).to.be.false;
    setTimeout(() => {
      el.value = { ...el.value, accuracy: 3 };
    });
    const ev = await oneEvent(el, 'lr-validity-change');
    expect(ev.detail.valid).to.be.true;
  });

  it('emits lr-submit with the value and itemId only after validity passes', async () => {
    const el = (await fixture(
      html`<lr-rubric-form .keys=${KEYS} item-id="item-1" .value=${{ accuracy: 5 }}></lr-rubric-form>`,
    )) as LyraRubricForm;
    await el.updateComplete;
    const submit = el.shadowRoot!.querySelector('[part="submit"]') as HTMLElement;
    setTimeout(() => submit.click());
    const ev = await oneEvent(el, 'lr-submit');
    expect(ev.detail).to.deep.equal({ value: { accuracy: 5 }, itemId: 'item-1' });
  });

  it('does not emit lr-submit when validity fails, and reveals the error', async () => {
    const el = (await fixture(html`<lr-rubric-form .keys=${KEYS} item-id="item-1"></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    const submit = el.shadowRoot!.querySelector('[part="submit"]') as HTMLElement;
    let fired = false;
    el.addEventListener('lr-submit', () => (fired = true));
    submit.click();
    await el.updateComplete;
    expect(fired).to.be.false;
    expect(el.shadowRoot!.querySelector('[data-key="accuracy"] [part="error"]')).to.exist;
  });

  it('switches the submit label between rubricSubmit and rubricSubmitAndNext based on has-next', async () => {
    const el = (await fixture(html`<lr-rubric-form .keys=${KEYS} has-next></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="submit"]')!.textContent!.trim()).to.equal('Submit and next');
  });

  it('emits lr-skip without validating when skippable', async () => {
    const el = (await fixture(
      html`<lr-rubric-form .keys=${KEYS} item-id="item-1" skippable></lr-rubric-form>`,
    )) as LyraRubricForm;
    await el.updateComplete;
    const skip = el.shadowRoot!.querySelector('[part="skip"]') as HTMLElement;
    setTimeout(() => skip.click());
    const ev = await oneEvent(el, 'lr-skip');
    expect(ev.detail).to.deep.equal({ itemId: 'item-1' });
  });

  it('resets touched/error-reveal state when itemId changes', async () => {
    const el = (await fixture(html`<lr-rubric-form .keys=${KEYS} item-id="item-1"></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    el.reportValidity();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-key="accuracy"] [part="error"]')).to.exist;
    el.itemId = 'item-2';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-key="accuracy"] [part="error"]')).to.not.exist;
  });

  it('forwards required to lr-select, lr-checkbox-group, and lr-textarea, matching each sibling’s own required-driven aria state', async () => {
    const keys: RubricKey[] = [
      { key: 'category', type: 'category', required: true, options: [{ value: 'a' }] },
      { key: 'optionalCategory', type: 'category', options: [{ value: 'a' }] },
      { key: 'tags', type: 'category', multiple: true, required: true, options: [{ value: 'a' }, { value: 'b' }] },
      { key: 'comment', type: 'comment', required: true },
    ];
    const el = (await fixture(html`<lr-rubric-form .keys=${keys}></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    const select = el.shadowRoot!.querySelector('[data-key="category"] lr-select') as HTMLElement & { required: boolean };
    const optionalSelect = el.shadowRoot!.querySelector('[data-key="optionalCategory"] lr-select') as HTMLElement & {
      required: boolean;
    };
    const group = el.shadowRoot!.querySelector('[data-key="tags"] lr-checkbox-group') as HTMLElement & { required: boolean };
    const textarea = el.shadowRoot!.querySelector('[data-key="comment"] lr-textarea') as HTMLElement & { required: boolean };
    expect(select.required).to.be.true;
    expect(optionalSelect.required).to.be.false;
    expect(group.required).to.be.true;
    expect(textarea.required).to.be.true;
  });

  it('does not steal focus when item-id is set directly in initial markup (mount, not a real transition)', async () => {
    const el = (await fixture(
      html`<lr-rubric-form item-id="item-1" .keys=${KEYS}></lr-rubric-form>`,
    )) as LyraRubricForm;
    await el.updateComplete;
    // `=== null` (rather than a direct chai `.to.equal(node)` on a real
    // element) throughout this focus-assertion block on purpose: comparing
    // first to a plain boolean sidesteps chai ever needing to format a live
    // custom element into a failure message.
    expect(el.shadowRoot!.activeElement === null).to.be.true;
  });

  it('does not arm the mount-time auto-focus for a property set before the component has ever updated (regression)', () => {
    // The DOM-focus assertion above can't, by itself, distinguish "correctly
    // skipped" from an unrelated, unavoidable one-tick gap: every sibling
    // control this component renders (segmented/slider/select/textarea/
    // checkbox-group) forwards `.focus()` into its own shadow DOM, which
    // can't exist before that control's own first, async Lit update runs --
    // so a focus *attempt* made at true first-render time is always a no-op
    // regardless of this bug. Inspecting the private flag `set itemId()`
    // uses to arm `focusFirstControl()` gives a direct, synchronous,
    // race-free signal instead: it must still be `false` right after
    // upgrade with `item-id` set in markup, before this component's first
    // update has ever run.
    const container = document.createElement('div');
    document.body.appendChild(container);
    try {
      render(html`<lr-rubric-form item-id="item-1" .keys=${KEYS}></lr-rubric-form>`, container);
      const el = container.querySelector('lr-rubric-form') as unknown as { pendingFocusFirst: boolean };
      expect(el.pendingFocusFirst).to.be.false;
    } finally {
      container.remove();
    }
  });

  it('still focuses the first control on a genuine itemId transition after mount', async () => {
    const el = (await fixture(html`<lr-rubric-form .keys=${KEYS}></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    el.itemId = 'item-1';
    await el.updateComplete;
    const segmented = el.shadowRoot!.querySelector('[data-key="accuracy"] lr-segmented');
    expect(el.shadowRoot!.activeElement === segmented).to.be.true;
    el.itemId = 'item-2';
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement === segmented).to.be.true;
  });

  it('renders a .strings override for the empty-keys message', async () => {
    const el = (await fixture(
      html`<lr-rubric-form .strings=${{ noData: 'Rien à évaluer' }}></lr-rubric-form>`,
    )) as LyraRubricForm;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.equal('Rien à évaluer');
  });

  it('localizes the required-field and unsupported-field-type messages via .strings, reaching the DOM', async () => {
    const keys = [
      { key: 'accuracy', type: 'score', min: 0, max: 5, step: 1, required: true },
      { key: 'x', type: 'bogus' },
    ] as unknown as RubricKey[];
    const el = (await fixture(
      html`<lr-rubric-form
        .keys=${keys}
        .strings=${{
          fieldRequired: 'Ce champ est requis.',
          unsupportedFieldType: 'Type de champ non pris en charge : "{type}".',
        }}
      ></lr-rubric-form>`,
    )) as LyraRubricForm;
    await el.updateComplete;
    el.reportValidity();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-key="accuracy"] [part="error"]')!.textContent).to.equal(
      'Ce champ est requis.',
    );
    expect(el.shadowRoot!.querySelector('[part="unsupported"]')!.textContent).to.equal(
      'Type de champ non pris en charge : "bogus".',
    );
  });

  it('localizes the submit/submit-and-next/skip button labels via .strings', async () => {
    const el = (await fixture(
      html`<lr-rubric-form
        .keys=${KEYS}
        skippable
        .strings=${{
          rubricSubmit: 'Envoyer',
          rubricSubmitAndNext: 'Envoyer et suivant',
          rubricSkip: 'Passer',
        }}
      ></lr-rubric-form>`,
    )) as LyraRubricForm;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="submit"]')!.textContent!.trim()).to.equal('Envoyer');
    expect(el.shadowRoot!.querySelector('[part="skip"]')!.textContent!.trim()).to.equal('Passer');
    el.hasNext = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="submit"]')!.textContent!.trim()).to.equal('Envoyer et suivant');
  });

  it('renders a visible unsupported-field note for a key outside the three types and marks the form invalid', async () => {
    const keys = [{ key: 'x', type: 'bogus' }] as unknown as RubricKey[];
    const el = (await fixture(html`<lr-rubric-form .keys=${keys}></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="unsupported"]')).to.exist;
    expect(el.checkValidity()).to.be.false;
  });

  it('participates in a form: submits the value as JSON under name', async () => {
    const form = (await fixture(html`
      <form>
        <lr-rubric-form name="rubric" .keys=${KEYS} .value=${{ accuracy: 3 }}></lr-rubric-form>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-rubric-form') as LyraRubricForm;
    await el.updateComplete;
    const data = new FormData(form);
    expect(JSON.parse(data.get('rubric') as string).accuracy).to.equal(3);
  });

  it('renders noData when keys is empty', async () => {
    const el = (await fixture(html`<lr-rubric-form></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.equal('No data');
  });

  it('registers every sibling control as a side effect of importing rubric-form.js (regression)', async () => {
    // Importing the *.class.js module alone never calls defineElement -- only the barrel (*.js)
    // does. A component that imports a composed control via its .class.js path renders an
    // un-upgraded, plain HTMLElement for it, silently breaking anything that calls a method on
    // that control.
    expect(customElements.get('lr-segmented')).to.exist;
    expect(customElements.get('lr-slider')).to.exist;
    expect(customElements.get('lr-select')).to.exist;
    expect(customElements.get('lr-option')).to.exist;
    expect(customElements.get('lr-checkbox')).to.exist;
    expect(customElements.get('lr-checkbox-group')).to.exist;
    expect(customElements.get('lr-textarea')).to.exist;
  });

  it('is accessible', async () => {
    const el = (await fixture(html`<lr-rubric-form .keys=${KEYS} skippable has-next></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it('exposes ElementInternals-backed getters: form, validity, validationMessage, willValidate', async () => {
    const form = (await fixture(html`
      <form>
        <lr-rubric-form name="rubric" .keys=${KEYS}></lr-rubric-form>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-rubric-form') as LyraRubricForm;
    await el.updateComplete;
    expect(el.form).to.equal(form);
    expect(el.validity.valid).to.be.false;
    expect(el.validationMessage).to.be.a('string');
    expect(el.willValidate).to.be.true;
  });

  it('exposes a snapshot copy of the current per-key errors via the errors getter', async () => {
    const el = (await fixture(html`<lr-rubric-form .keys=${KEYS}></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    el.reportValidity();
    await el.updateComplete;
    expect(el.errors).to.deep.equal({ accuracy: 'This field is required.' });
    // Mutating the returned object must not leak into internal state -- it's a copy.
    const snapshot = el.errors;
    snapshot.accuracy = 'mutated';
    expect(el.errors.accuracy).to.equal('This field is required.');
  });

  it('normalizes a nullish keys/value assignment to the safe empty defaults', async () => {
    const el = (await fixture(html`<lr-rubric-form .keys=${KEYS}></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    el.keys = null as unknown as RubricKey[];
    el.value = undefined as unknown as typeof el.value;
    await el.updateComplete;
    expect(el.keys).to.deep.equal([]);
    expect(el.value).to.deep.equal({});
    expect(el.shadowRoot!.querySelector('[part="empty"]')).to.exist;
  });

  it('normalizes a nullish itemId to an empty string and removes the item-id attribute', async () => {
    const el = (await fixture(html`<lr-rubric-form .keys=${KEYS} item-id="item-1"></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    expect(el.hasAttribute('item-id')).to.be.true;
    el.itemId = null as unknown as string;
    expect(el.itemId).to.equal('');
    // Asserted synchronously, before the pending update flushes: `itemId` is declared
    // `reflect: true` in `static properties`, so Lit's own generic reflect-on-update pass
    // would otherwise immediately re-add the attribute as `""` (any non-nullish string
    // reflects), masking the explicit `removeAttribute` branch this test targets.
    expect(el.hasAttribute('item-id')).to.be.false;
    await el.updateComplete;
  });

  it('toggles the name attribute on and off as the name property changes', async () => {
    const el = (await fixture(html`<lr-rubric-form .keys=${KEYS}></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    el.name = 'rubric';
    await el.updateComplete;
    expect(el.getAttribute('name')).to.equal('rubric');
    el.name = '';
    // Asserted synchronously, before the pending update flushes: `name` is declared
    // `reflect: true`, so Lit's own generic reflect-on-update pass would otherwise
    // immediately re-add the attribute as `""`, masking the explicit
    // `removeAttribute` branch this test targets. (Not asserting attribute-absence
    // at mount above, on purpose: `name`'s accessor is hand-written --
    // `noAccessor: true` -- which Lit treats as a "wrapped" property and force-
    // reflects once on the element's first update even though its value never
    // changed, so a never-set `name` also picks up a stray `name=""` after mount.)
    expect(el.hasAttribute('name')).to.be.false;
    await el.updateComplete;
  });

  it('renders a slider (not segmented) for score keys with a non-positive step, a fractional bound, a fractional step count, or a negative step count', async () => {
    const keys: RubricKey[] = [
      { key: 'zeroStep', type: 'score', min: 0, max: 5, step: 0 },
      { key: 'fracMin', type: 'score', min: 0.5, max: 5, step: 1 },
      { key: 'fracCount', type: 'score', min: 0, max: 5, step: 2 },
      { key: 'negCount', type: 'score', min: 5, max: 0, step: 1 },
    ];
    const el = (await fixture(html`<lr-rubric-form .keys=${keys}></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    for (const k of keys) {
      expect(el.shadowRoot!.querySelector(`[data-key="${k.key}"] lr-slider`), `${k.key} should be lr-slider`).to.exist;
      expect(el.shadowRoot!.querySelector(`[data-key="${k.key}"] lr-segmented`), `${k.key} should not be lr-segmented`).to
        .not.exist;
    }
  });

  it('applies the full default score domain (min 0, max 5, step 1) when a score key omits all three, rendering it as segmented', async () => {
    const keys: RubricKey[] = [{ key: 'bare', type: 'score' }];
    const el = (await fixture(html`<lr-rubric-form .keys=${keys}></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    const segmented = el.shadowRoot!.querySelector('[data-key="bare"] lr-segmented') as HTMLElement & {
      items: { value: string }[];
    };
    expect(segmented).to.exist;
    expect(segmented.items.map((i) => i.value)).to.deep.equal(['0', '1', '2', '3', '4', '5']);
  });

  it('applies default min/step (0/1) to a slider score field and reflects a preset numeric value', async () => {
    const keys: RubricKey[] = [{ key: 's2', type: 'score', max: 100 }];
    const el = (await fixture(
      html`<lr-rubric-form .keys=${keys} .value=${{ s2: 42 }}></lr-rubric-form>`,
    )) as LyraRubricForm;
    await el.updateComplete;
    const slider = el.shadowRoot!.querySelector('[data-key="s2"] lr-slider') as HTMLElement & { value: string };
    expect(slider).to.exist;
    expect(slider.value).to.equal('42');
  });

  it('defaults to an empty option list for a category field with no options, and reflects a preset string value in a single-select', async () => {
    const keys: RubricKey[] = [
      { key: 'catNoOpts', type: 'category' },
      { key: 'category', type: 'category', options: [{ value: 'hallucination' }, { value: 'tone' }] },
    ];
    const el = (await fixture(
      html`<lr-rubric-form .keys=${keys} .value=${{ category: 'tone' }}></lr-rubric-form>`,
    )) as LyraRubricForm;
    await el.updateComplete;
    const emptySelect = el.shadowRoot!.querySelector('[data-key="catNoOpts"] lr-select') as HTMLElement;
    expect(emptySelect).to.exist;
    expect(emptySelect.querySelectorAll('lr-option').length).to.equal(0);
    const select = el.shadowRoot!.querySelector('[data-key="category"] lr-select') as HTMLElement & { value: string };
    expect(select.value).to.equal('tone');
  });

  it('renders the description paragraph for a key that has one', async () => {
    const keys: RubricKey[] = [
      { key: 'accuracy', type: 'score', min: 0, max: 5, step: 1, description: 'How factually accurate is the response?' },
    ];
    const el = (await fixture(html`<lr-rubric-form .keys=${keys}></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    const desc = el.shadowRoot!.querySelector('[data-key="accuracy"] [part="description"]');
    expect(desc).to.exist;
    expect(desc!.textContent).to.equal('How factually accurate is the response?');
  });

  it('reflects a preset string value in a comment field\'s textarea', async () => {
    const keys: RubricKey[] = [{ key: 'comment', type: 'comment' }];
    const el = (await fixture(
      html`<lr-rubric-form .keys=${keys} .value=${{ comment: 'Looks correct.' }}></lr-rubric-form>`,
    )) as LyraRubricForm;
    await el.updateComplete;
    const textarea = el.shadowRoot!.querySelector('[data-key="comment"] lr-textarea') as HTMLElement & {
      value: string;
    };
    expect(textarea.value).to.equal('Looks correct.');
  });

  it('falls back to a null form value when the current value cannot be JSON-stringified (regression)', async () => {
    const form = (await fixture(html`
      <form>
        <lr-rubric-form name="rubric" .keys=${KEYS}></lr-rubric-form>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-rubric-form') as LyraRubricForm;
    await el.updateComplete;
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => {
      el.value = circular as unknown as typeof el.value;
    }).to.not.throw();
    await el.updateComplete;
    const data = new FormData(form);
    expect(data.get('rubric')).to.equal(null);
  });

  it('resets value and touched/error-reveal state when the owning form is reset (formResetCallback)', async () => {
    const form = (await fixture(html`
      <form>
        <lr-rubric-form name="rubric" .keys=${KEYS} .value=${{ accuracy: 5 }}></lr-rubric-form>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-rubric-form') as LyraRubricForm;
    await el.updateComplete;
    el.value = {};
    el.reportValidity();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-key="accuracy"] [part="error"]')).to.exist;
    form.reset();
    await el.updateComplete;
    expect(el.value).to.deep.equal({});
    expect(el.shadowRoot!.querySelector('[data-key="accuracy"] [part="error"]')).to.not.exist;
  });

  it('formStateRestoreCallback restores a valid JSON object state, and falls back to {} for invalid JSON, an array, or a non-string state', async () => {
    const el = (await fixture(html`<lr-rubric-form></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    el.formStateRestoreCallback('{"accuracy":4}', 'restore');
    expect(el.value).to.deep.equal({ accuracy: 4 });
    el.formStateRestoreCallback('not valid json', 'restore');
    expect(el.value).to.deep.equal({});
    el.formStateRestoreCallback('[1,2,3]', 'restore');
    expect(el.value).to.deep.equal({});
    el.formStateRestoreCallback(null, 'restore');
    expect(el.value).to.deep.equal({});
  });

  it('ignores control-change events while disabled (setFieldValue guard)', async () => {
    const el = (await fixture(html`<lr-rubric-form .keys=${KEYS} disabled></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    const segmented = el.shadowRoot!.querySelector('[data-key="accuracy"] lr-segmented') as HTMLElement;
    let fired = false;
    el.addEventListener('lr-input', () => (fired = true));
    segmented.dispatchEvent(new CustomEvent('lr-change', { detail: { value: '4' } }));
    await el.updateComplete;
    expect(fired).to.be.false;
    expect(el.value).to.deep.equal({});
  });

  it('does not recreate the touched-fields set when a field is already touched (markTouched guard)', async () => {
    const el = (await fixture(
      html`<lr-rubric-form .keys=${KEYS} item-id="item-1"></lr-rubric-form>`,
    )) as LyraRubricForm;
    await el.updateComplete;
    const field = el.shadowRoot!.querySelector('[data-key="accuracy"]') as HTMLElement;
    field.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await el.updateComplete;
    const touchedAfterFirst = (el as unknown as { touchedFields: Set<string> }).touchedFields;
    field.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await el.updateComplete;
    const touchedAfterSecond = (el as unknown as { touchedFields: Set<string> }).touchedFields;
    // Identity equality proves the guard returned early instead of building a new Set.
    expect(touchedAfterSecond).to.equal(touchedAfterFirst);
  });

  it('does not emit lr-submit when disabled, even with a valid value (submit guard)', async () => {
    const el = (await fixture(
      html`<lr-rubric-form .keys=${KEYS} .value=${{ accuracy: 5 }} disabled></lr-rubric-form>`,
    )) as LyraRubricForm;
    await el.updateComplete;
    let fired = false;
    el.addEventListener('lr-submit', () => (fired = true));
    (el as unknown as { submit: () => void }).submit();
    await el.updateComplete;
    expect(fired).to.be.false;
  });

  it('does not emit lr-skip when disabled (skip guard)', async () => {
    const el = (await fixture(
      html`<lr-rubric-form .keys=${KEYS} skippable disabled></lr-rubric-form>`,
    )) as LyraRubricForm;
    await el.updateComplete;
    let fired = false;
    el.addEventListener('lr-skip', () => (fired = true));
    (el as unknown as { skip: () => void }).skip();
    await el.updateComplete;
    expect(fired).to.be.false;
  });

  it('focusFirstControl no-ops (no throw) when keys is empty during an itemId transition', async () => {
    const el = (await fixture(html`<lr-rubric-form .keys=${[]}></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    el.itemId = 'item-1';
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement === null).to.be.true;
  });

  it('focusFirstControl no-ops when the first key has no matching .control element (unsupported type)', async () => {
    const keys = [{ key: 'x', type: 'bogus' }] as unknown as RubricKey[];
    const el = (await fixture(html`<lr-rubric-form .keys=${keys}></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    el.itemId = 'item-1';
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement === null).to.be.true;
  });

  it('focuses the slider thumb when the first key is a non-segmented score, on a genuine itemId transition', async () => {
    const keys: RubricKey[] = [{ key: 'score', type: 'score', min: 0, max: 100, step: 1 }];
    const el = (await fixture(html`<lr-rubric-form .keys=${keys}></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    el.itemId = 'item-1';
    await el.updateComplete;
    const slider = el.shadowRoot!.querySelector('[data-key="score"] lr-slider');
    expect(el.shadowRoot!.activeElement === slider).to.be.true;
  });

  it('focuses the first lr-checkbox when the first key is a multiple category, on a genuine itemId transition', async () => {
    const keys: RubricKey[] = [
      { key: 'tags', type: 'category', multiple: true, options: [{ value: 'a' }, { value: 'b' }] },
    ];
    const el = (await fixture(html`<lr-rubric-form .keys=${keys}></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    el.itemId = 'item-1';
    await el.updateComplete;
    const firstCheckbox = el.shadowRoot!.querySelector('[data-key="tags"] lr-checkbox');
    expect(el.shadowRoot!.activeElement === firstCheckbox).to.be.true;
  });

  it('focuses the control directly when the first key is a comment field, on a genuine itemId transition', async () => {
    const keys: RubricKey[] = [{ key: 'comment', type: 'comment' }];
    const el = (await fixture(html`<lr-rubric-form .keys=${keys}></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    el.itemId = 'item-1';
    await el.updateComplete;
    const textarea = el.shadowRoot!.querySelector('[data-key="comment"] lr-textarea');
    expect(el.shadowRoot!.activeElement === textarea).to.be.true;
  });

  it('submits on Ctrl/Cmd+Enter, but not on a plain Enter or an unmodified other key (onFormKeyDown)', async () => {
    const el = (await fixture(
      html`<lr-rubric-form .keys=${KEYS} item-id="item-1" .value=${{ accuracy: 5 }}></lr-rubric-form>`,
    )) as LyraRubricForm;
    await el.updateComplete;
    let fired = false;
    el.addEventListener('lr-submit', () => (fired = true));
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await el.updateComplete;
    expect(fired).to.be.false;
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }));
    await el.updateComplete;
    expect(fired).to.be.false;
    setTimeout(() => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true })));
    const ev = await oneEvent(el, 'lr-submit');
    expect(ev.detail).to.deep.equal({ value: { accuracy: 5 }, itemId: 'item-1' });
  });
});
