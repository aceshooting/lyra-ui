import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import { render } from 'lit';
import './rubric-form.js';
import type { LyraRubricForm, RubricKey } from './rubric-form.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';

it('contains long field and action content at 320px in LTR and RTL', async () => {
  const label = 'InternationalizedRubricContentWithoutAnyNaturalBreakOpportunity';
  const keys: RubricKey[] = [
    { key: 'comment', type: 'comment', label, description: label, placeholder: label },
  ];
  for (const direction of ['ltr', 'rtl'] as const) {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div dir=${direction} style="inline-size: 320px; max-inline-size: 320px">
        <lr-rubric-form
          skippable
          .keys=${keys}
          .strings=${{ rubricSubmit: label, rubricSkip: label }}
        ></lr-rubric-form>
      </div>
    `);
    expect(wrapper.scrollWidth, `dir=${direction}`).to.be.at.most(wrapper.clientWidth);
  }
});

type CssEscapeHost = { escape?: (identifier: string) => string };

function createRealmFrame(): {
  iframe: HTMLIFrameElement;
  frameDocument: Document;
  frameWindow: Window & typeof globalThis;
} {
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const frameDocument = iframe.contentDocument;
  const frameWindow = iframe.contentWindow;
  if (!frameDocument || !frameWindow) {
    iframe.remove();
    throw new Error('Could not create an iframe realm for the rubric-form test.');
  }
  return { iframe, frameDocument, frameWindow };
}

function replaceCssEscape(target: CssEscapeHost, replacement: CssEscapeHost['escape']): () => void {
  const previous = Object.getOwnPropertyDescriptor(target, 'escape');
  Object.defineProperty(target, 'escape', {
    configurable: true,
    writable: true,
    value: replacement,
  });
  return () => {
    if (previous) Object.defineProperty(target, 'escape', previous);
    else Reflect.deleteProperty(target, 'escape');
  };
}

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

  it('uses one shared required marker for owned and child labels', async () => {
    const markerKeys: RubricKey[] = [
      { key: 'score', type: 'score', label: 'Score', required: true },
      {
        key: 'category',
        type: 'category',
        label: 'Category',
        required: true,
        options: [{ value: 'one', label: 'One' }],
      },
      {
        key: 'categories',
        type: 'category',
        label: 'Categories',
        required: true,
        multiple: true,
        options: [{ value: 'one', label: 'One' }],
      },
      { key: 'comment', type: 'comment', label: 'Comment', required: true },
      { key: 'unsupported', type: 'unsupported', label: 'Unsupported', required: true } as unknown as RubricKey,
    ];
    const el = (await fixture(html`
      <lr-rubric-form
        style="--lr-form-control-required-content: ' (required)'"
        .keys=${markerKeys}
      ></lr-rubric-form>
    `)) as LyraRubricForm;
    await el.updateComplete;

    for (const key of ['score', 'unsupported']) {
      const field = el.shadowRoot!.querySelector(`[data-key="${key}"]`) as HTMLElement;
      const label = field.querySelector('[part="label"]') as HTMLElement;
      expect(field.hasAttribute('data-required'), `${key} field owns its label`).to.be.true;
      expect(label.querySelectorAll('span[aria-hidden]').length, `${key} has no literal marker`).to.equal(0);
      expect(getComputedStyle(label, '::after').content, `${key} shared marker`).to.contain('required');
    }

    for (const key of ['category', 'categories']) {
      const categoryField = el.shadowRoot!.querySelector(`[data-key="${key}"]`) as HTMLElement;
      const category = categoryField.querySelector('lr-select, lr-checkbox-group') as HTMLElement & {
        updateComplete: Promise<boolean>;
      };
      await category.updateComplete;
      const categoryLabel = category.shadowRoot!.querySelector('[part~="form-control-label"]') as HTMLElement;
      expect(categoryField.hasAttribute('data-required'), `${key} label stays child-owned`).to.be.false;
      expect(category.querySelectorAll('span[aria-hidden]').length, `${key} has no literal marker`).to.equal(0);
      expect(getComputedStyle(categoryLabel, '::after').content, `${key} shared marker`).to.contain('required');
    }

    const commentField = el.shadowRoot!.querySelector('[data-key="comment"]') as HTMLElement;
    const comment = commentField.querySelector('lr-textarea') as HTMLElement & { updateComplete: Promise<boolean> };
    await comment.updateComplete;
    const commentLabel = comment.shadowRoot!.querySelector('[part~="form-control-label"]') as HTMLElement;
    expect(commentField.hasAttribute('data-required'), 'comment label stays child-owned').to.be.false;
    expect(comment.querySelectorAll('span[aria-hidden]').length, 'comment has no literal marker').to.equal(0);
    expect(getComputedStyle(commentLabel, '::after').content, 'comment shared marker').to.contain('required');
  });

  it('renders a score field with >10 discrete steps as lr-slider instead of lr-segmented', async () => {
    const keys: RubricKey[] = [{ key: 'score', type: 'score', min: 0, max: 100, step: 1 }];
    const el = (await fixture(html`<lr-rubric-form .keys=${keys}></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-key="score"] lr-slider')).to.exist;
    expect((el.shadowRoot!.querySelector('[data-key="score"] lr-segmented')) == null).to.be.true;
  });

  it('localizes visible segmented scores like slider scores while preserving raw values', async () => {
    const keys: RubricKey[] = [
      { key: 'compact', type: 'score', min: 0, max: 2, step: 1 },
      { key: 'wide', type: 'score', min: 0, max: 2000, step: 1 },
    ];
    const el = (await fixture(html`
      <lr-rubric-form locale="ar-EG" .keys=${keys} .value=${{ compact: 1, wide: 1234 }}></lr-rubric-form>
    `)) as LyraRubricForm;
    await el.updateComplete;
    const segmented = el.shadowRoot!.querySelector('[data-key="compact"] lr-segmented') as HTMLElement & {
      items: Array<{ value: string; label: string }>;
      updateComplete: Promise<boolean>;
    };
    const slider = el.shadowRoot!.querySelector('[data-key="wide"] lr-slider') as HTMLElement & {
      shadowRoot: ShadowRoot;
      updateComplete: Promise<boolean>;
    };
    await segmented.updateComplete;
    await slider.updateComplete;

    const formatter = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 20 });
    expect(segmented.items.map((item) => item.value)).to.deep.equal(['0', '1', '2']);
    expect(segmented.items.map((item) => item.label)).to.deep.equal([0, 1, 2].map((value) => formatter.format(value)));
    expect(slider.shadowRoot.querySelector('[part="value"]')!.textContent).to.equal(formatter.format(1234));
    expect(el.value).to.deep.equal({ compact: 1, wide: 1234 });
  });

  it('enumerates a single-point extreme score domain without a non-advancing loop', async () => {
    const key: RubricKey = {
      key: 'score',
      type: 'score',
      min: Number.MAX_VALUE,
      max: Number.MAX_VALUE,
      step: 1,
    };
    const detached = document.createElement('lr-rubric-form') as LyraRubricForm;
    const values = (
      detached as unknown as {
        scoreValues(candidate: RubricKey): number[];
      }
    ).scoreValues(key);
    expect(values).to.deep.equal([Number.MAX_VALUE]);

    const el = (await fixture(html`<lr-rubric-form .keys=${[key]}></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    const segmented = el.shadowRoot!.querySelector('[data-key="score"] lr-segmented') as
      | (HTMLElement & { items: Array<{ value: string }> })
      | null;
    expect(segmented !== null).to.be.true;
    expect(segmented!.items.map((item) => item.value)).to.deep.equal([String(Number.MAX_VALUE)]);
  });

  it('renders a multiple category field as lr-checkbox-group with slotted lr-checkbox options', async () => {
    const keys: RubricKey[] = [
      { key: 'tags', type: 'category', multiple: true, options: [{ value: 'a' }, { value: 'b' }] },
    ];
    const el = (await fixture(html`<lr-rubric-form .keys=${keys}></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    const group = el.shadowRoot!.querySelector('[data-key="tags"] lr-checkbox-group') as HTMLElement;
    expect(group != null).to.equal(true);
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
    expect(Object.isFrozen(ev.detail)).to.equal(true);
    expect(Object.isFrozen(ev.detail.value)).to.equal(true);
    expect(Object.isFrozen(ev.detail.value.tags)).to.equal(true);
  });

  it('emits one host lr-input event for one bubbling comment-field lr-input event', async () => {
    const el = (await fixture(html`<lr-rubric-form .keys=${KEYS}></lr-rubric-form>`)) as LyraRubricForm;
    const textarea = el.shadowRoot!.querySelector('[data-key="comment"] lr-textarea') as HTMLElement;
    let count = 0;
    el.addEventListener('lr-input', () => count++);

    textarea.dispatchEvent(
      new CustomEvent('lr-input', {
        detail: { value: 'Clear and accurate' },
        bubbles: true,
        composed: true,
      })
    );
    await el.updateComplete;

    expect(count).to.equal(1);
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
      html`<lr-rubric-form .keys=${KEYS} item-id="item-1" .value=${{ accuracy: 5 }}></lr-rubric-form>`
    )) as LyraRubricForm;
    await el.updateComplete;
    const submit = el.shadowRoot!.querySelector('[part="submit"]') as HTMLElement;
    setTimeout(() => submit.click());
    const ev = await oneEvent(el, 'lr-submit');
    expect(ev.detail).to.deep.equal({ value: { accuracy: 5 }, itemId: 'item-1' });
    expect(Object.isFrozen(ev.detail)).to.equal(true);
    expect(Object.isFrozen(ev.detail.value)).to.equal(true);
  });

  it('returns fresh deeply frozen value snapshots without exposing owned arrays', async () => {
    const el = (await fixture(html`
      <lr-rubric-form
        .keys=${[
          { key: 'tags', type: 'category', multiple: true, options: [{ value: 'a' }] },
        ]}
        .value=${{ tags: ['a'] }}
      ></lr-rubric-form>
    `)) as LyraRubricForm;
    const first = el.value;
    const second = el.value;

    expect(first).to.deep.equal({ tags: ['a'] });
    expect(Object.isFrozen(first)).to.equal(true);
    expect(Object.isFrozen(first.tags)).to.equal(true);
    expect(first === second).to.equal(false);
    expect(first.tags === second.tags).to.equal(false);
  });

  it('does not emit lr-submit when validity fails, and reveals the error', async () => {
    const el = (await fixture(
      html`<lr-rubric-form .keys=${KEYS} item-id="item-1"></lr-rubric-form>`
    )) as LyraRubricForm;
    await el.updateComplete;
    const submit = el.shadowRoot!.querySelector('[part="submit"]') as HTMLElement;
    let fired = false;
    el.addEventListener('lr-submit', () => (fired = true));
    submit.click();
    await el.updateComplete;
    expect(fired).to.be.false;
    const error = el.shadowRoot!.querySelector('[data-key="accuracy"] [part="error"]')!;
    expect(error.textContent?.trim().length).to.be.greaterThan(0);
    expect(error.getAttribute('role')).to.equal(null);
    expect(el.shadowRoot!.querySelectorAll('[role="alert"], [role="status"], [aria-live]').length).to.equal(0);
    const score = el.shadowRoot!.querySelector('[data-key="accuracy"] .control')!;
    expect(score.getAttribute('label') ?? score.getAttribute('aria-label')).to.contain(error.textContent?.trim());
  });

  it('switches the submit label between rubricSubmit and rubricSubmitAndNext based on has-next', async () => {
    const el = (await fixture(html`<lr-rubric-form .keys=${KEYS} has-next></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="submit"]')!.textContent!.trim()).to.equal('Submit and next');
  });

  it('emits lr-skip without validating when skippable', async () => {
    const el = (await fixture(
      html`<lr-rubric-form .keys=${KEYS} item-id="item-1" skippable></lr-rubric-form>`
    )) as LyraRubricForm;
    await el.updateComplete;
    const skip = el.shadowRoot!.querySelector('[part="skip"]') as HTMLElement;
    setTimeout(() => skip.click());
    const ev = await oneEvent(el, 'lr-skip');
    expect(ev.detail).to.deep.equal({ itemId: 'item-1' });
  });

  it('resets touched/error-reveal state when itemId changes', async () => {
    const el = (await fixture(
      html`<lr-rubric-form .keys=${KEYS} item-id="item-1"></lr-rubric-form>`
    )) as LyraRubricForm;
    await el.updateComplete;
    el.reportValidity();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-key="accuracy"] [part="error"]')).to.exist;
    el.itemId = 'item-2';
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[data-key="accuracy"] [part="error"]')) == null).to.be.true;
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
    const select = el.shadowRoot!.querySelector('[data-key="category"] lr-select') as HTMLElement & {
      required: boolean;
    };
    const optionalSelect = el.shadowRoot!.querySelector('[data-key="optionalCategory"] lr-select') as HTMLElement & {
      required: boolean;
    };
    const group = el.shadowRoot!.querySelector('[data-key="tags"] lr-checkbox-group') as HTMLElement & {
      required: boolean;
    };
    const textarea = el.shadowRoot!.querySelector('[data-key="comment"] lr-textarea') as HTMLElement & {
      required: boolean;
    };
    expect(select.required).to.be.true;
    expect(optionalSelect.required).to.be.false;
    expect(group.required).to.be.true;
    expect(textarea.required).to.be.true;
  });

  it('does not steal focus when item-id is set directly in initial markup (mount, not a real transition)', async () => {
    const el = (await fixture(
      html`<lr-rubric-form item-id="item-1" .keys=${KEYS}></lr-rubric-form>`
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

  it("publishes custom, own-disabled, and fieldset-disabled validity as frozen deduplicated snapshots", async () => {
    const fieldset = await fixture<HTMLFieldSetElement>(html`
      <fieldset>
        <lr-rubric-form
          .keys=${KEYS}
          .value=${{ accuracy: 3 }}
        ></lr-rubric-form>
      </fieldset>
    `);
    const el = fieldset.querySelector("lr-rubric-form") as LyraRubricForm;
    await el.updateComplete;
    const snapshots: CustomEvent<{
      valid: boolean;
      errors: Record<string, string>;
    }>[] = [];
    el.addEventListener("lr-validity-change", (event) =>
      snapshots.push(event)
    );

    el.setCustomValidity("Rejected by policy.");
    expect(snapshots).to.have.lengthOf(1);
    expect(snapshots[0]!.detail).to.deep.equal({
      valid: false,
      errors: { base: "Rejected by policy." },
    });
    expect(Object.isFrozen(snapshots[0]!.detail)).to.equal(true);
    expect(Object.isFrozen(snapshots[0]!.detail.errors)).to.equal(true);
    expect(el.errors).to.deep.equal({ base: "Rejected by policy." });

    el.setCustomValidity("Rejected by policy.");
    expect(
      snapshots,
      "an identical effective snapshot is deduplicated"
    ).to.have.lengthOf(1);

    el.disabled = true;
    expect(snapshots[1]!.detail).to.deep.equal({ valid: true, errors: {} });
    expect(el.willValidate).to.equal(false);
    el.disabled = false;
    expect(snapshots[2]!.detail.valid).to.equal(false);

    fieldset.disabled = true;
    await el.updateComplete;
    expect(snapshots[3]!.detail).to.deep.equal({ valid: true, errors: {} });
    expect(el.willValidate).to.equal(false);
    fieldset.disabled = false;
    await el.updateComplete;
    expect(snapshots[4]!.detail.valid).to.equal(false);
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

  it('uses the adopted owner realm CSS escape to resolve a special-key validity anchor', async () => {
    const specialKey = 'target"] [data-key="decoy';
    const keys: RubricKey[] = [
      { key: specialKey, type: 'comment', required: true },
      { key: 'decoy', type: 'comment', required: true },
    ];
    const { iframe, frameDocument, frameWindow } = createRealmFrame();
    const el = (await fixture(html`<lr-rubric-form .keys=${keys}></lr-rubric-form>`)) as LyraRubricForm;
    el.remove();
    frameDocument.adoptNode(el);
    frameDocument.body.append(el);
    await el.updateComplete;

    const ownerEscape = frameWindow.CSS.escape.bind(frameWindow.CSS);
    let ownerCalls = 0;
    const restoreOwner = replaceCssEscape(frameWindow.CSS, (identifier) => {
      ownerCalls += 1;
      return ownerEscape(identifier);
    });
    const restoreAmbient = replaceCssEscape(CSS, () => 'decoy');
    try {
      const anchor = el[VALIDITY_ANCHOR]();
      expect(ownerCalls).to.equal(1);
      expect(anchor?.closest('[data-key]')?.getAttribute('data-key')).to.equal(specialKey);
    } finally {
      restoreAmbient();
      restoreOwner();
      el.remove();
      iframe.remove();
    }
  });

  it('uses an exact key scan for adopted initial focus when owner CSS escape is missing or throws', async () => {
    const specialKey = 'target"] [data-key="decoy';
    const keys: RubricKey[] = [
      { key: specialKey, type: 'comment' },
      { key: 'decoy', type: 'comment' },
    ];
    for (const mode of ['missing', 'throwing'] as const) {
      const { iframe, frameDocument, frameWindow } = createRealmFrame();
      const el = (await fixture(html`<lr-rubric-form .keys=${keys}></lr-rubric-form>`)) as LyraRubricForm;
      el.remove();
      frameDocument.adoptNode(el);
      frameDocument.body.append(el);
      await el.updateComplete;

      let ownerCalls = 0;
      const restoreOwner = replaceCssEscape(
        frameWindow.CSS,
        mode === 'missing'
          ? undefined
          : () => {
              ownerCalls += 1;
              throw new Error('owner CSS escape unavailable');
            }
      );
      const restoreAmbient = replaceCssEscape(CSS, () => 'decoy');
      try {
        el.itemId = `item-${mode}`;
        await el.updateComplete;

        const active = el.shadowRoot!.activeElement as HTMLElement | null;
        expect(active?.closest('[data-key]')?.getAttribute('data-key')).to.equal(specialKey);
        expect(ownerCalls).to.equal(mode === 'throwing' ? 1 : 0);
      } finally {
        restoreAmbient();
        restoreOwner();
        el.remove();
        iframe.remove();
      }
    }
  });

  it('renders a .strings override for the empty-keys message', async () => {
    const el = (await fixture(
      html`<lr-rubric-form .strings=${{ noData: 'Rien à évaluer' }}></lr-rubric-form>`
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
      ></lr-rubric-form>`
    )) as LyraRubricForm;
    await el.updateComplete;
    el.reportValidity();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-key="accuracy"] [part="error"]')!.textContent).to.equal(
      'Ce champ est requis.'
    );
    expect(el.shadowRoot!.querySelector('[part="unsupported"]')!.textContent).to.equal(
      'Type de champ non pris en charge : "bogus".'
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
      ></lr-rubric-form>`
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
    const el = (await fixture(
      html`<lr-rubric-form .keys=${KEYS} skippable has-next></lr-rubric-form>`
    )) as LyraRubricForm;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it('renders aggregate label, hint, and error chrome with same-shadow ARIA links', async () => {
    const el = (await fixture(html`
      <lr-rubric-form
        label="Review rubric"
        hint="Score every dimension"
        error-text="Review could not be saved"
        .keys=${KEYS}
      >
        <span slot="label">for this response</span>
        <span slot="hint">before submitting</span>
        <span slot="error">Try again</span>
      </lr-rubric-form>
    `)) as LyraRubricForm;
    const group = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const label = el.shadowRoot!.querySelector('[part~="aggregate-label"]') as HTMLElement;
    const hint = el.shadowRoot!.querySelector('[part~="aggregate-hint"]') as HTMLElement;
    const error = el.shadowRoot!.querySelector('[part~="aggregate-error"]') as HTMLElement;

    expect(label.textContent).to.contain('Review rubric');
    expect(label.querySelector('slot')!.assignedElements()[0]?.textContent).to.contain('for this response');
    expect(hint.textContent).to.contain('Score every dimension');
    expect(hint.querySelector('slot[name="hint"]')!.assignedElements()[0]?.textContent).to.contain(
      'before submitting',
    );
    expect(error.textContent).to.contain('Review could not be saved');
    expect(error.querySelector('slot')!.assignedElements()[0]?.textContent).to.contain('Try again');
    expect(group.getAttribute('aria-labelledby')).to.equal(label.id);
    expect(group.getAttribute('aria-describedby')?.split(/\s+/)).to.deep.equal([hint.id, error.id]);

    el.setAttribute('aria-label', '');
    await el.updateComplete;
    expect(group.hasAttribute('aria-label')).to.equal(true);
    expect(group.getAttribute('aria-label')).to.equal('');
    expect(group.hasAttribute('aria-labelledby')).to.equal(false);
  });

  it('renders a blocking aggregate custom error when no errorText or error slot is supplied', async () => {
    const el = (await fixture(html`
      <lr-rubric-form label="Review rubric" .keys=${KEYS}></lr-rubric-form>
    `)) as LyraRubricForm;
    el.setCustomValidity('This response was already reviewed');
    await el.updateComplete;
    const group = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const error = el.shadowRoot!.querySelector('[part~="aggregate-error"]') as HTMLElement;
    expect(error.hidden).to.equal(false);
    expect(error.textContent).to.contain('This response was already reviewed');
    expect(group.getAttribute('aria-describedby')?.split(/\s+/)).to.include(error.id);

    el.setCustomValidity('');
    await el.updateComplete;
    expect(error.hidden).to.equal(true);
    expect(group.hasAttribute('aria-describedby')).to.equal(false);
  });

  it('honors and can unset aggregate label/hint SSR presence hints', async () => {
    const el = (await fixture(html`
      <lr-rubric-form with-label with-hint hint="Supporting context"></lr-rubric-form>
    `)) as LyraRubricForm;
    const label = el.shadowRoot!.querySelector('[part~="aggregate-label"]') as HTMLElement;
    const hint = el.shadowRoot!.querySelector('[part~="aggregate-hint"]') as HTMLElement;
    expect(label.hidden).to.equal(false);
    expect(hint.hidden).to.equal(false);
    expect(hint.textContent).to.contain('Supporting context');

    el.withLabel = false;
    el.withHint = false;
    el.hint = '';
    await el.updateComplete;
    expect(label.hidden).to.equal(true);
    expect(hint.hidden).to.equal(true);
  });

  it('exposes ElementInternals-backed getters: form, validity, validationMessage, willValidate', async () => {
    const form = (await fixture(html`
      <form>
        <lr-rubric-form name="rubric" .keys=${KEYS}></lr-rubric-form>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-rubric-form') as LyraRubricForm;
    await el.updateComplete;
    // Assert `labels.length` (a number), never the NodeList itself: a *failing* chai assertion whose
    // `actual` is a DOM node/NodeList hangs the whole wtr session, because @web/test-runner-mocha
    // ships `err.actual` verbatim in the `wtr-session-finished` message and @web/dev-server-core
    // serializes that message via `structuredClone()`, which throws DataCloneError on DOM values.
    // The run then reports `0 passed, 0 failed` only when the per-file watchdog expires.
    expect(el.labels.length).to.equal(0);
    expect(el.form === form).to.equal(true);
    expect(el.validity.valid).to.be.false;
    expect(el.validationMessage).to.be.a('string');
    expect(el.willValidate).to.be.true;
  });

  it('exposes a frozen snapshot of the current per-key errors via the errors getter', async () => {
    const el = (await fixture(html`<lr-rubric-form .keys=${KEYS}></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    el.reportValidity();
    await el.updateComplete;
    expect(el.errors).to.deep.equal({ accuracy: 'This field is required.' });
    const snapshot = el.errors;
    expect(Object.isFrozen(snapshot)).to.equal(true);
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
    const el = (await fixture(
      html`<lr-rubric-form .keys=${KEYS} item-id="item-1"></lr-rubric-form>`
    )) as LyraRubricForm;
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
      expect((el.shadowRoot!.querySelector(`[data-key="${k.key}"] lr-segmented`)) == null, `${k.key} should not be lr-segmented`).to.be.true;
    }
  });

  it('applies the full default score domain (min 0, max 5, step 1) when a score key omits all three, rendering it as segmented', async () => {
    const keys: RubricKey[] = [{ key: 'bare', type: 'score' }];
    const el = (await fixture(html`<lr-rubric-form .keys=${keys}></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    const segmented = el.shadowRoot!.querySelector('[data-key="bare"] lr-segmented') as HTMLElement & {
      items: { value: string }[];
    };
    expect(segmented != null).to.equal(true);
    expect(segmented.items.map((i) => i.value)).to.deep.equal(['0', '1', '2', '3', '4', '5']);
  });

  it('applies default min/step (0/1) to a slider score field and reflects a preset numeric value', async () => {
    const keys: RubricKey[] = [{ key: 's2', type: 'score', max: 100 }];
    const el = (await fixture(
      html`<lr-rubric-form .keys=${keys} .value=${{ s2: 42 }}></lr-rubric-form>`
    )) as LyraRubricForm;
    await el.updateComplete;
    const slider = el.shadowRoot!.querySelector('[data-key="s2"] lr-slider') as HTMLElement & { value: number };
    expect(slider != null).to.equal(true);
    expect(slider.value).to.equal(42);
  });

  it('defaults to an empty option list for a category field with no options, and reflects a preset string value in a single-select', async () => {
    const keys: RubricKey[] = [
      { key: 'catNoOpts', type: 'category' },
      { key: 'category', type: 'category', options: [{ value: 'hallucination' }, { value: 'tone' }] },
    ];
    const el = (await fixture(
      html`<lr-rubric-form .keys=${keys} .value=${{ category: 'tone' }}></lr-rubric-form>`
    )) as LyraRubricForm;
    await el.updateComplete;
    const emptySelect = el.shadowRoot!.querySelector('[data-key="catNoOpts"] lr-select') as HTMLElement;
    expect(emptySelect != null).to.equal(true);
    expect(emptySelect.querySelectorAll('lr-option').length).to.equal(0);
    const select = el.shadowRoot!.querySelector('[data-key="category"] lr-select') as HTMLElement & { value: string };
    expect(select.value).to.equal('tone');
  });

  it('renders the description paragraph for a key that has one', async () => {
    const keys: RubricKey[] = [
      {
        key: 'accuracy',
        type: 'score',
        min: 0,
        max: 5,
        step: 1,
        description: 'How factually accurate is the response?',
      },
    ];
    const el = (await fixture(html`<lr-rubric-form .keys=${keys}></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    const desc = el.shadowRoot!.querySelector('[data-key="accuracy"] [part="description"]');
    expect(desc != null).to.equal(true);
    expect(desc!.textContent).to.equal('How factually accurate is the response?');
  });

  it("reflects a preset string value in a comment field's textarea", async () => {
    const keys: RubricKey[] = [{ key: 'comment', type: 'comment' }];
    const el = (await fixture(
      html`<lr-rubric-form .keys=${keys} .value=${{ comment: 'Looks correct.' }}></lr-rubric-form>`
    )) as LyraRubricForm;
    await el.updateComplete;
    const textarea = el.shadowRoot!.querySelector('[data-key="comment"] lr-textarea') as HTMLElement & {
      value: string;
    };
    expect(textarea.value).to.equal('Looks correct.');
  });

  it('drops undeclared circular data before the canonical value reaches FormData', async () => {
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
    expect(data.get('rubric')).to.equal('{}');
  });

  it('resets value and touched/error-reveal state when the owning form is reset (formResetCallback)', async () => {
    const initialValue = { accuracy: 5 };
    const form = (await fixture(html`
      <form>
        <lr-rubric-form name="rubric" .keys=${KEYS} .defaultValue=${initialValue}></lr-rubric-form>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-rubric-form') as LyraRubricForm;
    await el.updateComplete;
    el.value = {};
    el.reportValidity();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-key="accuracy"] [part="error"]')).to.exist;
    initialValue.accuracy = 2;
    form.reset();
    await el.updateComplete;
    expect(el.value).to.deep.equal({ accuracy: 5 });
    expect(el.value === initialValue).to.equal(false);
    expect((el.shadowRoot!.querySelector('[data-key="accuracy"] [part="error"]')) == null).to.be.true;

    expect(() => {
      (el.value as Record<string, number>).accuracy = 1;
    }).to.throw(TypeError);
    form.reset();
    await el.updateComplete;
    expect(el.value).to.deep.equal({ accuracy: 5 });
  });

  it('formStateRestoreCallback canonicalizes a valid JSON object, and falls back to {} for malformed state', async () => {
    const el = (await fixture(html`<lr-rubric-form .keys=${KEYS}></lr-rubric-form>`)) as LyraRubricForm;
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
      html`<lr-rubric-form .keys=${KEYS} item-id="item-1"></lr-rubric-form>`
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
      html`<lr-rubric-form .keys=${KEYS} .value=${{ accuracy: 5 }} disabled></lr-rubric-form>`
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
      html`<lr-rubric-form .keys=${KEYS} skippable disabled></lr-rubric-form>`
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

  it('dims the disabled submit/skip buttons through the shared disabled-opacity token', async () => {
    const wrapper = (await fixture(
      html`<div style="--lr-theme-opacity-disabled: 0.25">
        <lr-rubric-form .keys=${KEYS} skippable disabled></lr-rubric-form>
      </div>`
    )) as HTMLElement;
    const el = wrapper.querySelector('lr-rubric-form') as LyraRubricForm;
    await el.updateComplete;
    const submit = el.shadowRoot!.querySelector('[part="submit"]') as HTMLButtonElement;
    const skip = el.shadowRoot!.querySelector('[part="skip"]') as HTMLButtonElement;
    expect(submit.disabled).to.be.true;
    expect(skip.disabled).to.be.true;
    expect(getComputedStyle(submit).opacity).to.equal('0.25');
    expect(getComputedStyle(skip).opacity).to.equal('0.25');
  });

  it('keeps disabled submit and skip paint unchanged on hover and press', async () => {
    const el = (await fixture(html`
      <lr-rubric-form
        .keys=${KEYS}
        skippable
        disabled
        style="
          --lr-rubric-form-submit-hover-bg:rgb(1,2,3);
          --lr-rubric-form-submit-active-bg:rgb(4,5,6);
          --lr-rubric-form-skip-hover-bg:rgb(7,8,9);
          --lr-rubric-form-skip-active-bg:rgb(10,11,12)
        "
      ></lr-rubric-form>
    `)) as LyraRubricForm;
    await el.updateComplete;
    for (const part of ['submit', 'skip'] as const) {
      const button = el.shadowRoot!.querySelector<HTMLElement>(`[part="${part}"]`)!;
      const rest = getComputedStyle(button).backgroundColor;
      const rect = button.getBoundingClientRect();
      try {
        await sendMouse({
          type: 'move',
          position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
        });
        expect(getComputedStyle(button).backgroundColor, `${part} hover`).to.equal(rest);
        await sendMouse({ type: 'down' });
        expect(getComputedStyle(button).backgroundColor, `${part} press`).to.equal(rest);
      } finally {
        await sendMouse({ type: 'up' });
        await resetMouse();
      }
    }
  });

  it('submits on Ctrl/Cmd+Enter, but not on a plain Enter or an unmodified other key (onFormKeyDown)', async () => {
    const el = (await fixture(
      html`<lr-rubric-form .keys=${KEYS} item-id="item-1" .value=${{ accuracy: 5 }}></lr-rubric-form>`
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

  // Driven through the real pointer rather than the stylesheet text: a `filter: brightness()`
  // hover (what these two buttons used to ship) also matches a "has a hover rule" text assertion
  // while doing nothing whatsoever on a theme whose brand colour is pure white or pure black, and
  // while dragging the button's own label along with its background. Reading the painted
  // background back at each stage is the only assertion that can tell those apart. Colour STRINGS
  // are compared, never elements — a DOM node as chai's actual/expected hangs the whole file.
  for (const part of ['submit', 'skip'] as const) {
    it(`moves ${part}'s painted background on hover, and further again while pressed`, async () => {
      const el = (await fixture(
        html`<lr-rubric-form .keys=${KEYS} item-id="item-1" skippable></lr-rubric-form>`
      )) as LyraRubricForm;
      await el.updateComplete;
      const button = el.shadowRoot!.querySelector(`[part="${part}"]`) as HTMLButtonElement;
      const rect = button.getBoundingClientRect();
      const centre: [number, number] = [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)];
      const rest = getComputedStyle(button).backgroundColor;
      try {
        await sendMouse({ type: 'move', position: centre });
        const hovered = getComputedStyle(button).backgroundColor;
        await sendMouse({ type: 'down' });
        const pressed = getComputedStyle(button).backgroundColor;
        await sendMouse({ type: 'up' });
        expect(hovered, 'hover must move the fill off its resting colour').to.not.equal(rest);
        expect(pressed, 'pressed must be visibly stronger than hover, not identical to it').to.not.equal(hovered);
        expect(pressed).to.not.equal(rest);
      } finally {
        await resetMouse();
      }
    });
  }

  it('themes submit and skip rest, hover, and pressed paint through component hooks', async () => {
    const el = (await fixture(html`
      <lr-rubric-form
        .keys=${KEYS}
        .value=${{ accuracy: 5 }}
        item-id="item-1"
        skippable
        style="
          --lr-rubric-form-submit-bg: rgb(1, 2, 3);
          --lr-rubric-form-submit-border-color: rgb(4, 5, 6);
          --lr-rubric-form-submit-color: rgb(7, 8, 9);
          --lr-rubric-form-submit-hover-bg: rgb(10, 11, 12);
          --lr-rubric-form-submit-active-bg: rgb(13, 14, 15);
          --lr-rubric-form-skip-hover-bg: rgb(16, 17, 18);
          --lr-rubric-form-skip-active-bg: rgb(19, 20, 21);
        "
      ></lr-rubric-form>
    `)) as LyraRubricForm;
    await el.updateComplete;
    const submit = el.shadowRoot!.querySelector<HTMLElement>('[part="submit"]')!;
    const skip = el.shadowRoot!.querySelector<HTMLElement>('[part="skip"]')!;
    expect(getComputedStyle(submit).backgroundColor).to.equal('rgb(1, 2, 3)');
    expect(getComputedStyle(submit).borderTopColor).to.equal('rgb(4, 5, 6)');
    expect(getComputedStyle(submit).color).to.equal('rgb(7, 8, 9)');
    for (const [button, hover, active] of [
      [submit, 'rgb(10, 11, 12)', 'rgb(13, 14, 15)'],
      [skip, 'rgb(16, 17, 18)', 'rgb(19, 20, 21)'],
    ] as const) {
      const rect = button.getBoundingClientRect();
      try {
        await sendMouse({
          type: 'move',
          position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
        });
        expect(getComputedStyle(button).backgroundColor).to.equal(hover);
        await sendMouse({ type: 'down' });
        expect(getComputedStyle(button).backgroundColor).to.equal(active);
      } finally {
        await sendMouse({ type: 'up' });
        await resetMouse();
      }
    }
  });

  describe('lifecycle: attachInternals guard', () => {
    it('degrades gracefully instead of throwing when ElementInternals is unavailable', async () => {
      const original = (globalThis as { ElementInternals?: unknown }).ElementInternals;
      // Deliberately simulating an environment (e.g. happy-dom) with no ElementInternals
      // implementation at all.
      delete (globalThis as { ElementInternals?: unknown }).ElementInternals;
      try {
        expect(() => document.createElement('lr-rubric-form')).to.not.throw();
        const el = (await fixture(html`<lr-rubric-form .keys=${KEYS}></lr-rubric-form>`)) as LyraRubricForm;
        await el.updateComplete;
        expect(el.shadowRoot!.querySelectorAll('[part="field"]').length).to.equal(KEYS.length);
        expect(() => el.checkValidity()).to.not.throw();
        expect(() => el.reportValidity()).to.not.throw();
      } finally {
        (globalThis as { ElementInternals?: unknown }).ElementInternals = original;
      }
    });

    it('degrades gracefully instead of throwing when the native attachInternals() call itself throws', async () => {
      // Scoped to just this tag -- the shadow tree can render other form-associated
      // sibling controls (lr-select, lr-checkbox, ...) whose own constructors are out of this
      // bucket's scope to fix, so a blanket stub would break unrelated children instead of
      // isolating this component's own guard.
      const original = HTMLElement.prototype.attachInternals;
      HTMLElement.prototype.attachInternals = function (this: HTMLElement) {
        if (this.tagName.toLowerCase() === 'lr-rubric-form') {
          throw new DOMException('attachInternals is not supported', 'NotSupportedError');
        }
        return original.call(this);
      };
      try {
        expect(() => document.createElement('lr-rubric-form')).to.not.throw();
        const el = (await fixture(html`<lr-rubric-form .keys=${KEYS}></lr-rubric-form>`)) as LyraRubricForm;
        await el.updateComplete;
        expect(el.shadowRoot!.querySelectorAll('[part="field"]').length).to.equal(KEYS.length);
        expect(() => el.checkValidity()).to.not.throw();
        expect(() => el.reportValidity()).to.not.throw();
      } finally {
        HTMLElement.prototype.attachInternals = original;
      }
    });
  });
});

it('forwards field labels, descriptions, errors, and option descriptions to composed semantic owners', async () => {
  const keys: RubricKey[] = [
    {
      key: 'score',
      type: 'score',
      label: 'Accuracy',
      description: 'Judge factual correctness',
      min: 0,
      max: 5,
      step: 1,
    },
    {
      key: 'scoreWide',
      type: 'score',
      label: 'Confidence',
      description: 'Use the full confidence range',
      min: 0,
      max: 100,
      step: 1,
    },
    {
      key: 'single',
      type: 'category',
      label: 'Quality',
      description: 'Choose the closest match',
      required: true,
      options: [{ value: 'good', label: 'Good', description: 'Meets every requirement' }],
    },
    {
      key: 'multiple',
      type: 'category',
      label: 'Flags',
      multiple: true,
      options: [{ value: 'unsafe', label: 'Unsafe', description: 'Contains unsafe material' }],
    },
    {
      key: 'notes',
      type: 'comment',
      label: 'Notes',
      description: 'Explain your decision',
    },
  ];
  const el = (await fixture(html`<lr-rubric-form .keys=${keys}></lr-rubric-form>`)) as LyraRubricForm;
  const segmented = el.shadowRoot!.querySelector<HTMLElement & { label: string }>('[data-key="score"] lr-segmented')!;
  const slider = el.shadowRoot!.querySelector<HTMLElement & { label: string; updateComplete: Promise<unknown> }>(
    '[data-key="scoreWide"] lr-slider'
  )!;
  await slider.updateComplete;
  expect(segmented.label).to.contain('Accuracy');
  expect(segmented.label).to.contain('Judge factual correctness');
  expect(slider.label).to.equal('');
  const sliderThumb = slider.shadowRoot!.querySelector('[part~="thumb"]') as HTMLElement;
  expect(sliderThumb.getAttribute('aria-label')).to.contain('Confidence');
  expect(sliderThumb.getAttribute('aria-label')).to.contain('Use the full confidence range');

  const select = el.shadowRoot!.querySelector('lr-select')!;
  const selectTrigger = select.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
  const selectLabel = select.shadowRoot!.querySelector(`label[for="${selectTrigger.id}"]`) as HTMLElement;
  const assignedLabel = selectLabel.querySelector('slot')!.assignedElements({ flatten: true })[0]!;
  expect(assignedLabel.textContent).to.contain('Quality');
  expect(selectTrigger.getAttribute('aria-describedby')).to.not.equal(null);
  expect(select.querySelector('lr-option')!.sub).to.equal('Meets every requirement');

  const checkbox = el.shadowRoot!.querySelector('lr-checkbox')!;
  expect(checkbox.textContent).to.contain('Contains unsafe material');

  const textarea = el.shadowRoot!.querySelector('lr-textarea')!;
  const nativeTextarea = textarea.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
  expect(nativeTextarea.getAttribute('aria-label')).to.equal(null);
  expect(nativeTextarea.getAttribute('aria-describedby')).to.not.equal(null);
});

it('consumes nested control aliases and exposes only the documented aggregate input event', async () => {
  const keys: RubricKey[] = [{ key: 'notes', type: 'comment', label: 'Notes' }];
  const el = (await fixture(html`<lr-rubric-form .keys=${keys}></lr-rubric-form>`)) as LyraRubricForm;
  const events: string[] = [];
  for (const type of ['input', 'change', 'lr-change', 'lr-input']) {
    el.addEventListener(type, () => events.push(type));
  }
  const textarea = el.shadowRoot!.querySelector('lr-textarea')!;
  const native = textarea.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
  native.value = 'Updated';
  native.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));

  expect(events).to.deep.equal(['lr-input']);
});

it('keeps each keyed composed control with its logical field across reorder', async () => {
  const a: RubricKey = { key: 'a', type: 'comment', label: 'A' };
  const b: RubricKey = { key: 'b', type: 'comment', label: 'B' };
  const el = (await fixture(html`<lr-rubric-form .keys=${[a, b]}></lr-rubric-form>`)) as LyraRubricForm;
  const originalA = el.shadowRoot!.querySelector('[data-key="a"] lr-textarea');
  const originalB = el.shadowRoot!.querySelector('[data-key="b"] lr-textarea');

  el.keys = [b, a];
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[data-key="a"] lr-textarea') === originalA).to.be.true;
  expect(el.shadowRoot!.querySelector('[data-key="b"] lr-textarea') === originalB).to.be.true;
});

it('resolves the submit action foreground from the on-brand token', async () => {
  const el = (await fixture(html`
    <lr-rubric-form
      .keys=${KEYS}
      style="--lr-color-on-brand: rgb(7, 19, 31);"
    ></lr-rubric-form>
  `)) as LyraRubricForm;
  const submit = el.shadowRoot!.querySelector<HTMLElement>('[part="submit"]')!;

  expect(getComputedStyle(submit).color).to.equal('rgb(7, 19, 31)');
});

it('reportValidity() reveals current field errors and answers overall validity', async () => {
  const el = (await fixture(html`<lr-rubric-form .keys=${KEYS}></lr-rubric-form>`)) as LyraRubricForm;
  await el.updateComplete;
  const initial = el.reportValidity();
  await el.updateComplete;
  expect(typeof initial, 'reportValidity answers a boolean').to.equal('boolean');

  el.value = { accuracy: 4 };
  await el.updateComplete;
  expect(el.reportValidity(), 'a satisfied rubric reports valid').to.be.true;
});

it('emits a cancelable lr-invalid alias whose cancellation cancels the native invalid event', async () => {
  const el = (await fixture(html`<lr-rubric-form .keys=${KEYS}></lr-rubric-form>`)) as LyraRubricForm;
  await el.updateComplete;
  const aliases: CustomEvent[] = [];
  const nativePrevented: boolean[] = [];
  el.addEventListener('lr-invalid', (event) => aliases.push(event as CustomEvent));
  // Registered after the alias relay's constructor-installed listener, so it observes the native
  // event after the relay has had the opportunity to forward a cancellation.
  el.addEventListener('invalid', (event) => nativePrevented.push(event.defaultPrevented));

  expect(el.checkValidity()).to.equal(false);
  expect(aliases).to.have.lengthOf(1);
  expect(aliases[0]!.cancelable, 'lr-invalid is a real veto point').to.equal(true);
  expect(nativePrevented).to.deep.equal([false]);

  el.addEventListener('lr-invalid', (event) => event.preventDefault(), { once: true });
  expect(el.checkValidity()).to.equal(false);
  expect(
    nativePrevented,
    'preventDefault() on lr-invalid suppresses the native validation bubble',
  ).to.deep.equal([false, true]);
});

// `CustomStateSet` and the `:state()` selector ship separately from each other and from the rest
// of `ElementInternals` -- these two guards are why the same block passes on WebKit, where a
// missing `CustomStateSet` would otherwise throw on the very first assertion.
const supportsCustomStates = (() => {
  try {
    return typeof CustomStateSet === 'function';
  } catch {
    return false;
  }
})();
const supportsStateSelector = (() => {
  try {
    document.createElement('div').matches(':state(x)');
    return true;
  } catch {
    return false;
  }
})();

describe('validity custom states', () => {
  it('publishes required/optional from the keys, and valid/invalid from the answers', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(html`<lr-rubric-form .keys=${KEYS} name="rubric"></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    // `required` is a per-key flag here, not a host property: KEYS has one required key.
    expect(el.matches(':state(required)'), 'required').to.be.true;
    expect(el.matches(':state(optional)'), 'optional').to.be.false;
    expect(el.matches(':state(invalid)'), 'invalid').to.be.true;
    expect(el.matches(':state(valid)'), 'valid').to.be.false;

    el.value = { accuracy: 5 };
    await el.updateComplete;
    expect(el.matches(':state(valid)'), 'valid once the required key is answered').to.be.true;
    expect(el.matches(':state(invalid)'), 'invalid once the required key is answered').to.be.false;

    el.keys = KEYS.map((key) => ({ ...key, required: false }));
    await el.updateComplete;
    expect(el.matches(':state(optional)'), 'optional once no key is required').to.be.true;
    expect(el.matches(':state(required)'), 'required once no key is required').to.be.false;
  });

  it('keeps user-valid/user-invalid off a pristine rubric until reportValidity() reveals the errors', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const form = (await fixture(html`
      <form><lr-rubric-form .keys=${KEYS} name="rubric"></lr-rubric-form></form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-rubric-form') as LyraRubricForm;
    await el.updateComplete;
    expect(el.matches(':state(invalid)'), 'invalid while pristine').to.be.true;
    expect(el.matches(':state(user-invalid)'), 'user-invalid while pristine').to.be.false;
    expect(el.matches(':state(user-valid)'), 'user-valid while pristine').to.be.false;

    el.reportValidity();
    await el.updateComplete;
    expect(el.matches(':state(user-invalid)'), 'user-invalid after reporting').to.be.true;

    el.value = { accuracy: 5 };
    await el.updateComplete;
    expect(el.matches(':state(user-valid)'), 'user-valid once satisfied').to.be.true;
    expect(el.matches(':state(user-invalid)'), 'user-invalid once satisfied').to.be.false;

    form.reset();
    await el.updateComplete;
    expect(el.matches(':state(user-invalid)'), 'user-invalid after reset').to.be.false;
    expect(el.matches(':state(user-valid)'), 'user-valid after reset').to.be.false;
    expect(el.matches(':state(invalid)'), 'invalid after reset').to.be.true;
  });

  it('does not turn a disabled field focusout into user interaction after re-enabling', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(html`<lr-rubric-form .keys=${KEYS} name="rubric"></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    const field = el.shadowRoot!.querySelector('[data-key="accuracy"]') as HTMLElement;

    el.disabled = true;
    field.dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));
    el.disabled = false;
    await el.updateComplete;

    expect(el.matches(':state(user-invalid)'), 'a disable-forced focusout leaves the rubric pristine').to.be
      .false;
  });

  it('publishes neither invalid nor user-invalid while disabled', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    // A native `<input required disabled>` matches neither `:valid` nor `:invalid`. Publishing
    // `invalid`/`user-invalid` from a barred control is what painted every disabled required field
    // red under the documented `lr-rubric-form:state(user-invalid) { ... }` rule.
    const el = (await fixture(
      html`<lr-rubric-form .keys=${KEYS} name="rubric" disabled></lr-rubric-form>`
    )) as LyraRubricForm;
    await el.updateComplete;
    expect(el.checkValidity(), 'a barred control reports no violation').to.be.true;
    expect(el.validity.valueMissing).to.be.false;
    expect(el.matches(':state(invalid)'), 'invalid while disabled').to.be.false;
    expect(el.matches(':state(valid)'), 'barred matches neither half of the pair').to.be.false;
    expect(el.matches(':state(required)'), 'requiredness describes the keys, not the outcome').to.be.true;
    el.reportValidity();
    await el.updateComplete;
    expect(el.matches(':state(user-invalid)'), 'user-invalid while disabled').to.be.false;

    el.disabled = false;
    await el.updateComplete;
    expect(el.checkValidity(), 'the constraint returns with the control').to.be.false;
    expect(el.matches(':state(invalid)'), 'invalid once enabled again').to.be.true;
  });

  it('publishes neither invalid nor user-invalid inside a disabled fieldset', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const form = (await fixture(html`
      <form>
        <fieldset disabled><lr-rubric-form .keys=${KEYS} name="rubric"></lr-rubric-form></fieldset>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-rubric-form') as LyraRubricForm;
    await el.updateComplete;
    expect(el.disabled, 'a fieldset never mutates the control own disabled').to.be.false;
    expect(el.validity.valueMissing, 'fieldset-disabled bars validation exactly like own disabled').to.be.false;
    expect(el.matches(':state(invalid)')).to.be.false;
    el.reportValidity();
    await el.updateComplete;
    expect(el.matches(':state(user-invalid)')).to.be.false;
  });
});

describe('lr-rubric-form setCustomValidity()', () => {
  const optionalKeys: RubricKey[] = [{ key: 'comment', type: 'comment', label: 'Comment' }];
  const requiredKeys: RubricKey[] = [{ key: 'comment', type: 'comment', label: 'Comment', required: true }];

  it('blocks form submission and becomes the validationMessage', async () => {
    const form = (await fixture(html`
      <form><lr-rubric-form name="rubric"></lr-rubric-form></form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-rubric-form') as LyraRubricForm;
    el.keys = optionalKeys;
    await el.updateComplete;
    let submits = 0;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits += 1;
    });

    form.requestSubmit();
    expect(submits, 'an otherwise-valid rubric submits').to.equal(1);

    el.setCustomValidity('This item was already annotated by someone else');
    expect(el.validationMessage).to.equal('This item was already annotated by someone else');
    expect(el.validity.customError, 'customError').to.be.true;
    expect(el.checkValidity()).to.be.false;

    form.requestSubmit();
    expect(submits, 'a custom error blocks submission').to.equal(1);
  });

  it('survives an intrinsic revalidation', async () => {
    const el = (await fixture(html`<lr-rubric-form></lr-rubric-form>`)) as LyraRubricForm;
    el.keys = requiredKeys;
    await el.updateComplete;
    el.setCustomValidity('Server says no');
    el.value = { comment: 'looks good' }; // clears valueMissing and re-runs the intrinsic recompute
    await el.updateComplete;
    expect(el.validity.valueMissing, 'valueMissing cleared').to.be.false;
    expect(el.validity.customError, 'custom error survives the recompute').to.be.true;
    expect(el.validationMessage).to.equal('Server says no');
  });

  // Native `setCustomValidity()` is sticky: `form.reset()` restores values, never the custom
  // error, which only another `setCustomValidity('')` clears. Matching that here.
  it('keeps the custom error across a form reset', async () => {
    const form = (await fixture(html`
      <form><lr-rubric-form name="rubric"></lr-rubric-form></form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-rubric-form') as LyraRubricForm;
    el.keys = optionalKeys;
    await el.updateComplete;
    el.setCustomValidity('Server says no');
    form.reset();
    await el.updateComplete;
    expect(el.validity.customError).to.be.true;
    expect(el.validationMessage).to.equal('Server says no');
  });

  it('restores the computed validity when cleared, rather than forcing the rubric valid', async () => {
    const el = (await fixture(html`<lr-rubric-form></lr-rubric-form>`)) as LyraRubricForm;
    el.keys = requiredKeys;
    await el.updateComplete;
    el.setCustomValidity('Server says no');
    el.setCustomValidity('');
    expect(el.validity.customError, 'custom error cleared').to.be.false;
    expect(
      el.validity.valueMissing,
      'an empty custom error must not force a rubric with unanswered required keys valid'
    ).to.be.true;
    expect(el.checkValidity()).to.be.false;
    expect(el.validationMessage).to.not.equal('');
    el.value = { comment: 'looks good' };
    await el.updateComplete;
    expect(el.checkValidity()).to.be.true;
  });

  it('drives the valid/invalid custom states', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(html`<lr-rubric-form></lr-rubric-form>`)) as LyraRubricForm;
    el.keys = optionalKeys;
    await el.updateComplete;
    expect(el.matches(':state(valid)'), 'valid before').to.be.true;
    el.setCustomValidity('Server says no');
    expect(el.matches(':state(invalid)'), 'invalid while a custom error is set').to.be.true;
    expect(el.matches(':state(valid)')).to.be.false;
    el.setCustomValidity('');
    expect(el.matches(':state(valid)'), 'valid again once cleared').to.be.true;
  });
});

describe('canonical rubric schema/value model', () => {
  const canonicalKeys: RubricKey[] = [
    { key: 'bounded', type: 'score', min: 0, max: 100, step: 5, required: true },
    { key: 'nonfinite', type: 'score', min: 0, max: 10, required: true },
    {
      key: 'category',
      type: 'category',
      required: true,
      options: [{ value: 'known' }, { value: 'other' }],
    },
    {
      key: 'tags',
      type: 'category',
      multiple: true,
      options: [{ value: 'a' }, { value: 'b' }],
    },
    { key: 'comment', type: 'comment' },
  ];

  it('omits blank rubric keys without rewriting retained identity spelling', async () => {
    const el = await fixture<LyraRubricForm>(html`<lr-rubric-form></lr-rubric-form>`);
    el.keys = [
      { key: '', type: 'comment' },
      { key: '   ', type: 'comment' },
      { key: ' padded ', type: 'comment' },
    ];
    await el.updateComplete;

    expect(el.keys.map((key) => key.key)).to.deep.equal([' padded ']);
  });

  it('normalizes every external write once before render, validity, readout, and FormData', async () => {
    const form = (await fixture(html`
      <form>
        <lr-rubric-form
          name="rubric"
          .keys=${canonicalKeys}
          .value=${{
            bounded: 999,
            nonfinite: Infinity,
            category: 'unknown',
            tags: ['a', 'unknown', 'b', 'a'],
            comment: 42,
            undeclared: 'drop me',
          } as unknown as Record<string, unknown>}
        ></lr-rubric-form>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-rubric-form') as LyraRubricForm;
    await el.updateComplete;

    expect(el.value).to.deep.equal({ bounded: 100, tags: ['a', 'b'] });
    expect(el.validity.valueMissing).to.equal(true);
    const slider = el.shadowRoot!.querySelector<HTMLElement & { value: number }>('[data-key="bounded"] lr-slider')!;
    const select = el.shadowRoot!.querySelector<HTMLElement & { value: string }>('[data-key="category"] lr-select')!;
    expect(slider.value).to.equal(100);
    expect(select.value).to.equal('');
    expect(new FormData(form).get('rubric')).to.equal('{"bounded":100,"tags":["a","b"]}');

    const snapshot = el.value;
    expect(() => (snapshot.tags as string[]).push('mutated')).to.throw(TypeError);
    expect(Object.isFrozen(snapshot.tags)).to.equal(true);
    expect(el.value).to.deep.equal({ bounded: 100, tags: ['a', 'b'] });
  });

  it('renormalizes live/default/restored values when the schema changes and resets explicitly', async () => {
    const form = (await fixture(html`
      <form>
        <lr-rubric-form
          name="rubric"
          .keys=${canonicalKeys}
          .defaultValue=${{ bounded: 24, nonfinite: 3, category: 'known' }}
        ></lr-rubric-form>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-rubric-form') as LyraRubricForm;
    await el.updateComplete;
    expect(el.value).to.deep.equal({ bounded: 25, nonfinite: 3, category: 'known' });

    el.value = { bounded: 73, nonfinite: 8, category: 'other', undeclared: 'drop' } as never;
    expect(el.value).to.deep.equal({ bounded: 75, nonfinite: 8, category: 'other' });
    el.keys = [
      { key: 'bounded', type: 'score', min: 0, max: 50, step: 10, required: true },
      { key: 'category', type: 'category', options: [{ value: 'known' }] },
    ];
    expect(el.value).to.deep.equal({ bounded: 50 });

    el.formStateRestoreCallback('{"bounded":37,"category":"unknown","extra":1}', 'restore');
    expect(el.value).to.deep.equal({ bounded: 40 });
    form.reset();
    expect(el.value).to.deep.equal({ bounded: 30, category: 'known' });
    expect(el.defaultValue).to.deep.equal({ bounded: 30, category: 'known' });
  });

  it('republishes user validity atomically when item identity clears interaction', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(html`
      <lr-rubric-form item-id="first" .keys=${canonicalKeys}></lr-rubric-form>
    `)) as LyraRubricForm;
    await el.updateComplete;
    el.reportValidity();
    expect(el.matches(':state(user-invalid)')).to.equal(true);

    el.itemId = 'second';
    expect(el.matches(':state(user-invalid)'), 'new item is pristine synchronously').to.equal(false);
    expect(el.matches(':state(invalid)'), 'intrinsic requiredness remains').to.equal(true);
  });

  it('drops a non-array keys assignment to the safe empty list', async () => {
    const el = await fixture<LyraRubricForm>(html`<lr-rubric-form .keys=${KEYS}></lr-rubric-form>`);
    await el.updateComplete;
    el.keys = 'not-an-array' as unknown as RubricKey[];
    await el.updateComplete;
    expect(el.keys).to.deep.equal([]);
  });

  it('drops null, non-object, and array candidates from a keys array before validating fields', async () => {
    const el = await fixture<LyraRubricForm>(html`<lr-rubric-form></lr-rubric-form>`);
    el.keys = [null, 'not-an-object', ['nested-array'], { key: 'ok', type: 'comment' }] as unknown as RubricKey[];
    await el.updateComplete;
    expect(el.keys.map((k) => k.key)).to.deep.equal(['ok']);
  });

  it('drops a candidate whose key field is missing or non-string', async () => {
    const el = await fixture<LyraRubricForm>(html`<lr-rubric-form></lr-rubric-form>`);
    el.keys = [{ type: 'comment' }, { key: 42, type: 'comment' }, { key: 'ok', type: 'comment' }] as unknown as RubricKey[];
    await el.updateComplete;
    expect(el.keys.map((k) => k.key)).to.deep.equal(['ok']);
  });

  it('keeps only the first occurrence of a duplicate key', async () => {
    const el = await fixture<LyraRubricForm>(html`<lr-rubric-form></lr-rubric-form>`);
    el.keys = [
      { key: 'dup', type: 'comment', label: 'First' },
      { key: 'dup', type: 'comment', label: 'Second' },
    ];
    await el.updateComplete;
    expect(el.keys).to.have.lengthOf(1);
    expect(el.keys[0]!.label).to.equal('First');
  });

  it('drops null, non-object, array, and missing-value option entries from a category key', async () => {
    const el = await fixture<LyraRubricForm>(html`<lr-rubric-form></lr-rubric-form>`);
    el.keys = [
      {
        key: 'category',
        type: 'category',
        options: [null, 'not-an-object', ['nested'], { label: 'no value field' }, { value: 'kept' }],
      },
    ] as unknown as RubricKey[];
    await el.updateComplete;
    const category = el.keys[0] as unknown as { options: { value: string }[] };
    expect(category.options.map((o) => o.value)).to.deep.equal(['kept']);
  });

  it('falls back to an empty type string for a runtime key with no type property at all', async () => {
    const el = (await fixture(
      html`<lr-rubric-form .strings=${{ unsupportedFieldType: 'Type: "{type}".' }}></lr-rubric-form>`
    )) as LyraRubricForm;
    el.keys = [{ key: 'x' }] as unknown as RubricKey[];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="unsupported"]')!.textContent).to.equal('Type: "".');
  });

  it('normalizes a non-object (string or array) value assignment to the safe empty value', async () => {
    const el = (await fixture(html`<lr-rubric-form .keys=${KEYS}></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    el.value = 'not-an-object' as unknown as typeof el.value;
    expect(el.value).to.deep.equal({});
    el.value = [1, 2, 3] as unknown as typeof el.value;
    expect(el.value).to.deep.equal({});
  });

  it('skips a value field whose access throws instead of propagating', async () => {
    const el = (await fixture(html`<lr-rubric-form .keys=${KEYS}></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    const throwing: Record<string, unknown> = {};
    Object.defineProperty(throwing, 'accuracy', {
      enumerable: true,
      get(): number {
        throw new Error('boom');
      },
    });
    expect(() => {
      el.value = throwing as unknown as typeof el.value;
    }).to.not.throw();
    expect(el.value).to.deep.equal({});
  });

  // `normalizeRubricKeys` always fills in `options: []` for a category key (never leaves it
  // `undefined`), so `normalizeRubricValue`'s own `key.options ?? []` fallback is unreachable
  // through the public `.keys`/`.value` setters -- this proves the *behavior* (no options means
  // no selection survives normalization), not that literal fallback branch.
  it('retains no selections for a multiple-category value when the key declares no options', async () => {
    const el = (await fixture(html`
      <lr-rubric-form
        .keys=${[{ key: 'tags', type: 'category', multiple: true }] as RubricKey[]}
        .value=${{ tags: ['a', 'b'] }}
      ></lr-rubric-form>
    `)) as LyraRubricForm;
    await el.updateComplete;
    expect(el.value).to.deep.equal({ tags: [] });
  });

  it('drops a multiple-category value that is not an array', async () => {
    const keys: RubricKey[] = [{ key: 'tags', type: 'category', multiple: true, options: [{ value: 'a' }] }];
    const el = (await fixture(html`
      <lr-rubric-form .keys=${keys} .value=${{ tags: 'oops' } as unknown as Record<string, unknown>}></lr-rubric-form>
    `)) as LyraRubricForm;
    await el.updateComplete;
    expect(el.value).to.deep.equal({});
  });

  it('drops non-string candidates from a multiple-category array value', async () => {
    const keys: RubricKey[] = [
      { key: 'tags', type: 'category', multiple: true, options: [{ value: 'a' }, { value: 'b' }] },
    ];
    const el = (await fixture(html`
      <lr-rubric-form
        .keys=${keys}
        .value=${{ tags: ['a', 42, null, 'b'] } as unknown as Record<string, unknown>}
      ></lr-rubric-form>
    `)) as LyraRubricForm;
    await el.updateComplete;
    expect(el.value).to.deep.equal({ tags: ['a', 'b'] });
  });

  it('set defaultValue does not overwrite an already-dirtied live value', async () => {
    const el = (await fixture(html`
      <lr-rubric-form .keys=${KEYS} .defaultValue=${{ accuracy: 1 }}></lr-rubric-form>
    `)) as LyraRubricForm;
    await el.updateComplete;
    el.value = { accuracy: 5 };
    await el.updateComplete;
    el.defaultValue = { accuracy: 3 };
    await el.updateComplete;
    expect(el.value, 'live value stays at the explicit write').to.deep.equal({ accuracy: 5 });
    expect(el.defaultValue, 'defaultValue itself still updates').to.deep.equal({ accuracy: 3 });
  });

  it('normalizes a nullish defaultValue assignment to the safe empty value', async () => {
    const el = (await fixture(
      html`<lr-rubric-form .keys=${KEYS} .defaultValue=${{ accuracy: 2 }}></lr-rubric-form>`
    )) as LyraRubricForm;
    await el.updateComplete;
    el.defaultValue = null as unknown as typeof el.defaultValue;
    await el.updateComplete;
    expect(el.defaultValue).to.deep.equal({});
    expect(el.value, 'a pristine live value follows the reset default').to.deep.equal({});
  });

  it('setCustomValidity treats a nullish message the same as an empty string (runtime safety)', async () => {
    const el = (await fixture(html`<lr-rubric-form .keys=${KEYS}></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    el.setCustomValidity('Blocked');
    expect(el.validity.customError).to.be.true;
    (el.setCustomValidity as (message: string) => void)(null as unknown as string);
    expect(el.validity.customError).to.be.false;
  });

  it('scoreValues() called directly for a non-segmented score key returns an empty array', () => {
    const detached = document.createElement('lr-rubric-form') as LyraRubricForm;
    const values = (
      detached as unknown as { scoreValues(candidate: RubricKey): number[] }
    ).scoreValues({ key: 'score', type: 'score', min: 0, max: 5, step: 0 });
    expect(values).to.deep.equal([]);
  });
});

describe('lr-rubric-form remaining public accessors and interaction paths', () => {
  it('click() forwards focus to the first control (host click forwarding)', async () => {
    const el = (await fixture(html`<lr-rubric-form .keys=${KEYS}></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    const segmented = el.shadowRoot!.querySelector('[data-key="accuracy"] lr-segmented');
    el.click();
    expect(el.shadowRoot!.activeElement === segmented).to.be.true;
  });

  it('click() no-ops while disabled (host click forwarding guard)', async () => {
    const el = (await fixture(html`<lr-rubric-form .keys=${KEYS} disabled></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    el.click();
    expect(el.shadowRoot!.activeElement === null).to.be.true;
  });

  it('getForm() delegates to the same ElementInternals form owner as the form getter', async () => {
    const form = (await fixture(html`
      <form><lr-rubric-form name="rubric" .keys=${KEYS}></lr-rubric-form></form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-rubric-form') as LyraRubricForm;
    await el.updateComplete;
    expect(el.getForm() === form).to.equal(true);
    expect(el.getForm() === el.form).to.equal(true);
  });

  it('the form setter reflects a string id or an element id onto the form attribute, and clears it for null', async () => {
    const el = (await fixture(html`<lr-rubric-form .keys=${KEYS}></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    el.form = 'external-form';
    expect(el.getAttribute('form')).to.equal('external-form');

    const namedForm = document.createElement('form');
    namedForm.id = 'named-form';
    document.body.append(namedForm);
    try {
      el.form = namedForm;
      expect(el.getAttribute('form')).to.equal('named-form');
      el.form = null;
      expect(el.hasAttribute('form')).to.equal(false);
    } finally {
      namedForm.remove();
    }
  });

  it('emits lr-input with the full value object when a non-segmented (slider) score control changes', async () => {
    const keys: RubricKey[] = [{ key: 'wide', type: 'score', min: 0, max: 100, step: 1 }];
    const el = (await fixture(html`<lr-rubric-form .keys=${keys}></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    const slider = el.shadowRoot!.querySelector('[data-key="wide"] lr-slider') as HTMLElement;
    setTimeout(() => slider.dispatchEvent(new CustomEvent('lr-change', { detail: { value: 42 } })));
    const ev = await oneEvent(el, 'lr-input');
    expect(ev.detail.value.wide).to.equal(42);
  });

  it('emits lr-input with the full value object when a single-select category control changes', async () => {
    const keys: RubricKey[] = [
      { key: 'category', type: 'category', options: [{ value: 'hallucination' }, { value: 'tone' }] },
    ];
    const el = (await fixture(html`<lr-rubric-form .keys=${keys}></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    const select = el.shadowRoot!.querySelector('[data-key="category"] lr-select') as HTMLElement & {
      value: string;
    };
    select.value = 'tone';
    setTimeout(() => select.dispatchEvent(new Event('change')));
    const ev = await oneEvent(el, 'lr-input');
    expect(ev.detail.value.category).to.equal('tone');
  });

  it('renders the inline error span for a required comment field once revealed', async () => {
    const keys: RubricKey[] = [{ key: 'comment', type: 'comment', label: 'Notes', required: true }];
    const el = (await fixture(html`<lr-rubric-form .keys=${keys}></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    el.reportValidity();
    await el.updateComplete;
    const errorSpan = el.shadowRoot!.querySelector('[data-key="comment"] lr-textarea span[slot="error"]');
    expect(errorSpan).to.exist;
    expect(errorSpan!.textContent).to.equal(el.errors.comment);
  });

  it('renders the inline error span for a required category field (single and multiple) once revealed', async () => {
    const keys: RubricKey[] = [
      { key: 'single', type: 'category', required: true, options: [{ value: 'a' }] },
      { key: 'multi', type: 'category', multiple: true, required: true, options: [{ value: 'a' }] },
    ];
    const el = (await fixture(html`<lr-rubric-form .keys=${keys}></lr-rubric-form>`)) as LyraRubricForm;
    await el.updateComplete;
    el.reportValidity();
    await el.updateComplete;
    for (const key of ['single', 'multi']) {
      const errorSpan = el.shadowRoot!.querySelector(`[data-key="${key}"] [slot="error"]`);
      expect(errorSpan, key).to.exist;
    }
  });
});
