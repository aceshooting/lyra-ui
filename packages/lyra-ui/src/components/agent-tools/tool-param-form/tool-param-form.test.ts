import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './tool-param-form.js';
import type {
  LyraToolParamForm,
  FlatToolParamSchema,
  ToolParamFormProperty,
  ToolParamFormValue,
} from './tool-param-form.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

it('provides rendered hover feedback for native text and number controls', async () => {
  const el = await fixture<LyraToolParamForm>(html`
    <lr-tool-param-form
      style="--lr-color-brand: rgb(1, 2, 3)"
      .schema=${basicSchema}
    ></lr-tool-param-form>
  `);
  const input = el.shadowRoot!.querySelector('input.control') as HTMLInputElement;
  const rect = input.getBoundingClientRect();
  try {
    await sendMouse({
      type: 'move',
      position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
    });
    await waitUntil(() => input.matches(':hover'));
    expect(getComputedStyle(input).borderTopColor).to.equal('rgb(1, 2, 3)');
  } finally {
    await resetMouse();
  }
});

const basicSchema: FlatToolParamSchema = {
  type: 'object',
  properties: {
    city: { type: 'string', title: 'City', description: 'Where to look up the forecast.' },
    units: { type: 'string', enum: ['celsius', 'fahrenheit'], default: 'celsius' },
    days: { type: 'integer', default: 3 },
    notify: { type: 'boolean' },
  },
  required: ['city'],
};

function field(el: LyraToolParamForm, key: string): HTMLElement {
  return el.shadowRoot!.querySelector(`[part="field"][data-key="${key}"]`) as HTMLElement;
}

function assertiveSinkTexts(): string[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"] > div`),
    (node) => node.textContent ?? '',
  );
}

describe('ElementInternals availability', () => {
  it('does not throw when constructed in an environment without a real ElementInternals implementation (e.g. a downstream Vitest + happy-dom suite)', async () => {
    const original = HTMLElement.prototype.attachInternals;
    // @ts-expect-error -- simulating an environment that lacks ElementInternals entirely
    delete HTMLElement.prototype.attachInternals;
    try {
      let el: LyraToolParamForm | undefined;
      expect(() => {
        el = document.createElement('lr-tool-param-form') as LyraToolParamForm;
      }).to.not.throw();
      // Confirm the fallback keeps the rest of the public surface usable
      // rather than merely swallowing the constructor error.
      expect(el!.checkValidity()).to.be.true;
      expect((el!.form) === (null)).to.equal(true);
    } finally {
      HTMLElement.prototype.attachInternals = original;
    }
  });

  it('falls back to no-op internals (and a working reportValidity()) when attachInternals throws rather than being absent', async () => {
    const original = HTMLElement.prototype.attachInternals;
    HTMLElement.prototype.attachInternals = function (): ElementInternals {
      throw new Error('attachInternals not supported in this environment');
    };
    try {
      const el = document.createElement('lr-tool-param-form') as LyraToolParamForm;
      expect((el.form) === (null)).to.equal(true);
      expect(el.reportValidity()).to.be.true;
    } finally {
      HTMLElement.prototype.attachInternals = original;
    }
  });
});

it('renders one control per property, in schema key order, matched to its type', async () => {
  const el = (await fixture(html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`)) as LyraToolParamForm;
  const fields = el.shadowRoot!.querySelectorAll('[part="field"]');
  expect(fields.length).to.equal(4);
  expect(Array.from(fields).map((f) => (f as HTMLElement).dataset.key)).to.deep.equal([
    'city',
    'units',
    'days',
    'notify',
  ]);

  expect(field(el, 'city').querySelector('input[type="text"]')).to.exist;
  expect(field(el, 'units').querySelector('lr-select')).to.exist;
  expect(field(el, 'units').querySelectorAll('lr-option').length).to.equal(2);
  const daysInput = field(el, 'days').querySelector('input[type="number"]') as HTMLInputElement;
  expect((daysInput) != null).to.equal(true);
  expect(daysInput.step).to.equal('1');
  expect(field(el, 'notify').querySelector('lr-select')).to.exist;
});

it('exposes the string and number/integer native inputs as [part="control"] for external theming', async () => {
  const el = (await fixture(html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`)) as LyraToolParamForm;
  const textInput = field(el, 'city').querySelector('input[type="text"]') as HTMLInputElement;
  const numberInput = field(el, 'days').querySelector('input[type="number"]') as HTMLInputElement;
  expect(textInput.getAttribute('part')).to.equal('control');
  expect(numberInput.getAttribute('part')).to.equal('control');
});

it('uses schema.title as the label, falling back to the property key', async () => {
  const el = (await fixture(html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`)) as LyraToolParamForm;
  expect(field(el, 'city').querySelector('[part="label"]')!.textContent).to.equal('City');
  expect((field(el, 'units').querySelector('lr-select') as HTMLElement & { label: string }).label).to.equal('units');
});

it('renders schema.description as helper text under the field', async () => {
  const el = (await fixture(html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`)) as LyraToolParamForm;
  expect(field(el, 'city').querySelector('[part="description"]')!.textContent).to.equal(
    'Where to look up the forecast.',
  );
  expect((field(el, 'units').querySelector('[part="description"]')) === null).to.be.true;
});

it('marks a required field without applying HTML nonempty semantics to the inner control', async () => {
  const el = (await fixture(html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`)) as LyraToolParamForm;
  expect(field(el, 'city').hasAttribute('data-required')).to.be.true;
  expect(field(el, 'units').hasAttribute('data-required')).to.be.false;
  const input = field(el, 'city').querySelector('input') as HTMLInputElement;
  expect(input.required).to.be.false;
  expect(input.getAttribute('aria-required')).to.equal('true');
});

it('renders aria-required="false" (not omitted) on a non-required native input and a non-required lr-select', async () => {
  const el = (await fixture(html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`)) as LyraToolParamForm;
  const daysInput = field(el, 'days').querySelector('input') as HTMLInputElement;
  expect(daysInput.getAttribute('aria-required')).to.equal('false');
  const notifySelect = field(el, 'notify').querySelector('lr-select') as HTMLElement;
  expect(notifySelect.getAttribute('aria-required')).to.equal('false');
  const unitsSelect = field(el, 'units').querySelector('lr-select') as HTMLElement;
  expect(unitsSelect.getAttribute('aria-required')).to.equal('false');
});

it('marks a required nested lr-select through its composed control contract', async () => {
  const schema: FlatToolParamSchema = {
    type: 'object',
    properties: { mode: { type: 'string', enum: ['fast', 'careful'] } },
    required: ['mode'],
  };
  const el = (await fixture(html`<lr-tool-param-form .schema=${schema}></lr-tool-param-form>`)) as LyraToolParamForm;
  const select = field(el, 'mode').querySelector('lr-select') as HTMLElement & { required: boolean };
  expect(select.required).to.be.false;
  expect(select.getAttribute('aria-required')).to.equal('true');
});

it('renders aria-invalid="false" (not omitted) on a native input until touched with an error, then "true"', async () => {
  const el = (await fixture(html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`)) as LyraToolParamForm;
  const cityInput = field(el, 'city').querySelector('input') as HTMLInputElement;
  expect(cityInput.getAttribute('aria-invalid')).to.equal('false');

  field(el, 'city').dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(cityInput.getAttribute('aria-invalid')).to.equal('true');

  const daysInput = field(el, 'days').querySelector('input') as HTMLInputElement;
  expect(daysInput.getAttribute('aria-invalid')).to.equal('false');
});

it('falls back to schema default for a field missing from value, without mutating the value property', async () => {
  const el = (await fixture(html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`)) as LyraToolParamForm;
  const daysInput = field(el, 'days').querySelector('input') as HTMLInputElement;
  expect(daysInput.value).to.equal('3');
  expect(el.value.days).to.be.undefined;
  expect(el.effectiveValue.days).to.equal(3);
});

it('renders an explicit value over the schema default', async () => {
  const el = (await fixture(
    html`<lr-tool-param-form .schema=${basicSchema} .value=${{ days: 10 }}></lr-tool-param-form>`,
  )) as LyraToolParamForm;
  const daysInput = field(el, 'days').querySelector('input') as HTMLInputElement;
  expect(daysInput.value).to.equal('10');
});

it('emits lr-input with the full resolved value object on a text field edit', async () => {
  const el = (await fixture(html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`)) as LyraToolParamForm;
  const input = field(el, 'city').querySelector('input') as HTMLInputElement;

  setTimeout(() => {
    input.value = 'Paris';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const ev = await oneEvent(el, 'lr-input');
  expect(ev.detail.value.city).to.equal('Paris');
  // The full object, including defaults for fields never touched.
  expect(ev.detail.value.units).to.equal('celsius');
  expect(ev.detail.value.days).to.equal(3);
  expect(el.value).to.deep.equal({ city: 'Paris' });
});

it('emits lr-input on a number field edit, clearing to undefined on an empty input', async () => {
  const el = (await fixture(html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`)) as LyraToolParamForm;
  const input = field(el, 'days').querySelector('input') as HTMLInputElement;

  setTimeout(() => {
    input.value = '7';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  let ev = await oneEvent(el, 'lr-input');
  expect(ev.detail.value.days).to.equal(7);

  setTimeout(() => {
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  ev = await oneEvent(el, 'lr-input');
  expect(ev.detail.value.days).to.be.undefined;
});

it('emits lr-input on an explicit boolean selection', async () => {
  const el = (await fixture(html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`)) as LyraToolParamForm;
  const select = field(el, 'notify').querySelector('lr-select') as HTMLElement & { value: string };

  setTimeout(() => {
    select.value = 'true';
    select.dispatchEvent(new CustomEvent('lr-change', { bubbles: true, composed: true }));
  });
  const ev = await oneEvent(el, 'lr-input');
  expect(ev.detail.value.notify).to.be.true;
});

it('resets a boolean field to unset via its empty select option, removing it from value entirely', async () => {
  const el = (await fixture(
    html`<lr-tool-param-form .schema=${basicSchema} .value=${{ notify: true }}></lr-tool-param-form>`,
  )) as LyraToolParamForm;
  expect(el.value.notify).to.be.true;
  const select = field(el, 'notify').querySelector('lr-select') as HTMLElement & { value: string };

  setTimeout(() => {
    select.value = '';
    select.dispatchEvent(new CustomEvent('lr-change', { bubbles: true, composed: true }));
  });
  const ev = await oneEvent(el, 'lr-input');

  expect(Object.prototype.hasOwnProperty.call(ev.detail.value, 'notify')).to.be.false;
  expect(Object.prototype.hasOwnProperty.call(el.value, 'notify')).to.be.false;
});

it('ignores a boolean-select unset (empty-option) event while effectively disabled', async () => {
  const schema: FlatToolParamSchema = {
    type: 'object',
    properties: { confirm: { type: 'boolean' } },
  };
  const el = (await fixture(
    html`<lr-tool-param-form disabled .schema=${schema} .value=${{ confirm: true }}></lr-tool-param-form>`,
  )) as LyraToolParamForm;
  const select = field(el, 'confirm').querySelector('lr-select') as HTMLElement & { value: string };
  let inputFired = false;
  el.addEventListener('lr-input', () => (inputFired = true));

  select.value = '';
  select.dispatchEvent(new CustomEvent('lr-change', { bubbles: true, composed: true }));
  await el.updateComplete;

  expect(inputFired, 'the unset branch must no-op while effectively disabled').to.be.false;
  expect(el.value).to.deep.equal({ confirm: true });
});

it('bridges a string field\'s native focus/blur out through the shadow boundary as host focus/blur events', async () => {
  const el = (await fixture(html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`)) as LyraToolParamForm;
  const input = field(el, 'city').querySelector('input') as HTMLInputElement;

  const focusPromise = oneEvent(el, 'focus');
  input.dispatchEvent(new Event('focus'));
  await focusPromise;

  const blurPromise = oneEvent(el, 'blur');
  input.dispatchEvent(new Event('blur'));
  await blurPromise;
});

it('bridges a number field\'s native focus/blur out through the shadow boundary as host focus/blur events', async () => {
  const el = (await fixture(html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`)) as LyraToolParamForm;
  const input = field(el, 'days').querySelector('input') as HTMLInputElement;

  const focusPromise = oneEvent(el, 'focus');
  input.dispatchEvent(new Event('focus'));
  await focusPromise;

  const blurPromise = oneEvent(el, 'blur');
  input.dispatchEvent(new Event('blur'));
  await blurPromise;
});

it('emits lr-validity-change on mount with the initial validity', async () => {
  const el = document.createElement('lr-tool-param-form') as LyraToolParamForm;
  el.schema = basicSchema;
  const promise = oneEvent(el, 'lr-validity-change');
  document.body.appendChild(el);
  const ev = await promise;
  expect(ev.detail.valid).to.be.false;
  expect(ev.detail.errors).to.have.property('city');
  el.remove();
});

it('emits lr-validity-change again once the required field is filled, and not on unrelated edits', async () => {
  const el = (await fixture(html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`)) as LyraToolParamForm;
  await el.updateComplete;

  setTimeout(() => {
    el.value = { city: 'Paris' };
  });
  const ev = await oneEvent(el, 'lr-validity-change');
  expect(ev.detail.valid).to.be.true;
  expect(ev.detail.errors).to.deep.equal({});

  let fired = false;
  el.addEventListener('lr-validity-change', () => (fired = true));
  el.value = { city: 'Paris', days: 5 };
  await el.updateComplete;
  expect(fired, 'validity did not actually change, so the event must not re-fire').to.be.false;
});

it('publishes custom, own-disabled, and fieldset-disabled validity as frozen deduplicated snapshots', async () => {
  const fieldset = await fixture<HTMLFieldSetElement>(html`
    <fieldset>
      <lr-tool-param-form
        .schema=${basicSchema}
        .value=${{ city: 'Paris' }}
      ></lr-tool-param-form>
    </fieldset>
  `);
  const el = fieldset.querySelector('lr-tool-param-form') as LyraToolParamForm;
  await el.updateComplete;
  const snapshots: CustomEvent<{ valid: boolean; errors: Record<string, string> }>[] = [];
  el.addEventListener('lr-validity-change', (event) => snapshots.push(event));

  el.setCustomValidity('Rejected by policy.');
  expect(snapshots).to.have.lengthOf(1);
  expect(snapshots[0]!.detail).to.deep.equal({
    valid: false,
    errors: { base: 'Rejected by policy.' },
  });
  expect(Object.isFrozen(snapshots[0]!.detail)).to.equal(true);
  expect(Object.isFrozen(snapshots[0]!.detail.errors)).to.equal(true);
  expect(el.errors).to.deep.equal({ base: 'Rejected by policy.' });
  expect(Object.isFrozen(el.errors)).to.equal(true);

  el.setCustomValidity('Rejected by policy.');
  expect(snapshots, 'an identical effective snapshot is deduplicated').to.have.lengthOf(1);

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

it('emits a cancelable lr-invalid alias and forwards its veto to the native invalid event', async () => {
  const el = (await fixture(
    html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`,
  )) as LyraToolParamForm;
  let alias: CustomEvent | undefined;
  el.addEventListener('lr-invalid', (event) => {
    alias = event;
    event.preventDefault();
  });
  const native = new Event('invalid', { cancelable: true });

  expect(el.dispatchEvent(native)).to.equal(false);
  expect(alias?.cancelable).to.equal(true);
  expect(alias?.defaultPrevented).to.equal(true);
  expect(native.defaultPrevented).to.equal(true);
});

it('does not render an inline error until the field has been visited (focusout)', async () => {
  const el = (await fixture(html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`)) as LyraToolParamForm;
  expect((field(el, 'city').querySelector('[part="error"]')) === null).to.be.true;

  field(el, 'city').dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(field(el, 'city').querySelector('[part="error"]')!.textContent).to.equal('This field is required.');
});

it('joins description and touched-error ids into aria-describedby on a native control', async () => {
  const el = (await fixture(html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`)) as LyraToolParamForm;
  const cityField = field(el, 'city');
  const input = cityField.querySelector('input') as HTMLInputElement;
  expect(input.getAttribute('aria-describedby')).to.equal(`${input.id}-desc`);

  cityField.dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));
  await el.updateComplete;

  expect(input.getAttribute('aria-describedby')).to.equal(`${input.id}-desc ${input.id}-err`);
});

it('retints only an invalid native control border through its component CSS property and restores the resting border', async () => {
  const el = (await fixture(html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`)) as LyraToolParamForm;
  el.style.setProperty('--lr-tool-param-form-invalid-border-color', 'rgb(10, 20, 30)');
  el.style.setProperty('--lr-color-border', 'rgb(40, 50, 60)');
  const city = field(el, 'city').querySelector('input') as HTMLInputElement;

  expect(getComputedStyle(city).borderColor).to.equal('rgb(40, 50, 60)');

  field(el, 'city').dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(getComputedStyle(city).borderColor).to.equal('rgb(10, 20, 30)');

  city.value = 'Paris';
  city.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(getComputedStyle(city).borderColor).to.equal('rgb(40, 50, 60)');
});

it('announces newly visible validation errors once through the shared assertive light-DOM sink', async () => {
  const schema: FlatToolParamSchema = {
    type: 'object',
    properties: { city: { type: 'string', title: 'City' } },
    required: ['city'],
  };
  const el = (await fixture(
    html`<lr-tool-param-form .schema=${schema}></lr-tool-param-form>`,
  )) as LyraToolParamForm;
  expect(assertiveSinkTexts(), 'an untouched invalid field stays silent on mount').to.deep.equal([]);

  const cityField = field(el, 'city');
  cityField.dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));
  await el.updateComplete;
  const error = cityField.querySelector('[part="error"]')!;
  expect(error.getAttribute('role')).to.equal(null);
  expect(assertiveSinkTexts()).to.deep.equal(['This field is required.']);

  const input = cityField.querySelector('input') as HTMLInputElement;
  input.value = 'Paris';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await el.updateComplete;
  // An empty string is deliberately a present string value for this JSON-schema subset. Remove the
  // key entirely to create a second required-value transition after the valid spell.
  el.value = {};
  await el.updateComplete;
  expect(assertiveSinkTexts()).to.deep.equal(['This field is required.', 'This field is required.']);

  el.remove();
  expect(document.querySelectorAll(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`).length).to.equal(0);
});

it('reportValidity() reveals inline errors immediately and returns overall validity', async () => {
  const el = (await fixture(html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`)) as LyraToolParamForm;
  expect((field(el, 'city').querySelector('[part="error"]')) === null).to.be.true;

  expect(el.reportValidity()).to.be.false;
  await el.updateComplete;
  expect(field(el, 'city').querySelector('[part="error"]')).to.exist;

  el.value = { city: 'Paris' };
  await el.updateComplete;
  expect(el.reportValidity()).to.be.true;
});

it('focuses the first invalid nested or native field during direct and form validation', async () => {
  const focusSchema: FlatToolParamSchema = {
    type: 'object',
    properties: {
      mode: { type: 'string', enum: ['fast', 'careful'] },
      city: { type: 'string' },
      confirm: { type: 'boolean' },
    },
    required: ['mode', 'city', 'confirm'],
  };
  const form = (await fixture(html`
    <form>
      <button type="button" id="sentinel">Before</button>
      <lr-tool-param-form name="args" .schema=${focusSchema}></lr-tool-param-form>
      <button type="submit">Submit</button>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-tool-param-form') as LyraToolParamForm;
  const sentinel = form.querySelector('#sentinel') as HTMLButtonElement;
  const nestedSelect = field(el, 'mode').querySelector('lr-select') as HTMLElement & {
    updateComplete: Promise<unknown>;
  };
  await nestedSelect.updateComplete;

  sentinel.focus();
  expect(el.reportValidity()).to.be.false;
  expect(document.activeElement?.localName).to.equal('lr-tool-param-form');
  expect(el.shadowRoot!.activeElement?.localName).to.equal('lr-select');
  expect(nestedSelect.shadowRoot!.activeElement?.getAttribute('part')).to.equal('trigger');

  let submits = 0;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submits += 1;
  });
  sentinel.focus();
  form.requestSubmit();
  expect(submits).to.equal(0);
  expect(document.activeElement?.localName).to.equal('lr-tool-param-form');
  expect(el.shadowRoot!.activeElement?.localName).to.equal('lr-select');
  expect(nestedSelect.shadowRoot!.activeElement?.getAttribute('part')).to.equal('trigger');

  el.value = { mode: 'fast' };
  await el.updateComplete;
  const cityInput = field(el, 'city').querySelector('input') as HTMLInputElement;
  sentinel.focus();
  expect(el.reportValidity()).to.be.false;
  expect(document.activeElement?.localName).to.equal('lr-tool-param-form');
  expect(el.shadowRoot!.activeElement?.id).to.equal(cityInput.id);

  el.value = { mode: 'fast', city: 'Paris' };
  await el.updateComplete;
  const nestedBooleanSelect = field(el, 'confirm').querySelector('lr-select') as HTMLElement & {
    updateComplete: Promise<unknown>;
  };
  await nestedBooleanSelect.updateComplete;
  sentinel.focus();
  expect(el.reportValidity()).to.be.false;
  expect(document.activeElement?.localName).to.equal('lr-tool-param-form');
  expect(el.shadowRoot!.activeElement?.localName).to.equal('lr-select');
  expect(nestedBooleanSelect.shadowRoot!.activeElement?.getAttribute('part')).to.equal('trigger');
});

it('treats a required boolean as property presence, so false and true are both valid values', async () => {
  const requiredBoolSchema: FlatToolParamSchema = {
    type: 'object',
    properties: { confirm: { type: 'boolean' } },
    required: ['confirm'],
  };
  const el = (await fixture(
    html`<lr-tool-param-form .schema=${requiredBoolSchema}></lr-tool-param-form>`,
  )) as LyraToolParamForm;
  const booleanSelect = field(el, 'confirm').querySelector('lr-select') as HTMLElement & { required: boolean };
  expect(
    booleanSelect.required,
    'the outer schema validator owns presence rather than imposing nested select nonempty semantics',
  ).to.be.false;
  expect(booleanSelect.getAttribute('aria-required')).to.equal('true');
  expect(el.checkValidity()).to.be.false;

  el.value = { confirm: false };
  expect(el.checkValidity()).to.be.true;

  el.value = { confirm: true };
  expect(el.checkValidity()).to.be.true;

  el.schema = {
    ...requiredBoolSchema,
    properties: { confirm: { type: 'boolean', default: false } },
  };
  el.value = {};
  expect(el.effectiveValue.confirm).to.be.false;
  expect(el.checkValidity()).to.be.true;
});

it('accepts empty strings, zero, and false when their required properties are present', async () => {
  const schema: FlatToolParamSchema = {
    type: 'object',
    properties: {
      text: { type: 'string' },
      count: { type: 'number' },
      enabled: { type: 'boolean' },
    },
    required: ['text', 'count', 'enabled'],
  };
  const el = (await fixture(
    html`<lr-tool-param-form
      .schema=${schema}
      .value=${{ text: '', count: 0, enabled: false }}
    ></lr-tool-param-form>`,
  )) as LyraToolParamForm;

  expect(el.errors).to.deep.equal({});
  expect(el.checkValidity()).to.be.true;

  el.value = { text: undefined, count: 0, enabled: false };
  expect(el.errors.text).to.equal('This field is required.');
  expect(el.checkValidity()).to.be.false;
});

it('validates every supported property type and string enum even when fields are optional', async () => {
  const schema: FlatToolParamSchema = {
    type: 'object',
    properties: {
      text: { type: 'string' },
      amount: { type: 'number' },
      count: { type: 'integer' },
      enabled: { type: 'boolean' },
      mode: { type: 'string', enum: ['fast', 'safe'] },
    },
  };
  const el = (await fixture(
    html`<lr-tool-param-form
      .schema=${schema}
      .value=${{ text: 1, amount: '2', count: 2.5, enabled: 'false', mode: 'unknown' }}
    ></lr-tool-param-form>`,
  )) as LyraToolParamForm;

  expect(el.errors).to.have.keys(['text', 'amount', 'count', 'enabled', 'mode']);
  expect(el.errors.text).to.equal('Must be a string.');
  expect(el.errors.amount).to.equal('Must be a finite number.');
  expect(el.errors.count).to.equal('Must be a whole number.');
  expect(el.errors.enabled).to.equal('Must be a boolean.');
  expect(el.errors.mode).to.equal('Must be one of: fast or safe.');
  expect(el.internals.validity.typeMismatch).to.be.true;
  expect(el.internals.validity.stepMismatch).to.be.true;
  expect(el.internals.validity.customError).to.be.true;
  expect(el.checkValidity()).to.be.false;

  el.value = { text: '', amount: 0, count: 2, enabled: false, mode: 'fast' };
  expect(el.errors).to.deep.equal({});
  expect(el.checkValidity()).to.be.true;

  expect(Object.isFrozen(el.value)).to.equal(true);
  expect(() => {
    (el.value as Record<string, unknown>)['enabled'] = 'no';
  }).to.throw(TypeError);
  el.value = { ...el.value, enabled: 'no' };
  expect(el.checkValidity()).to.be.false;
  expect(el.errors.enabled).to.equal('Must be a boolean.');
});

it('localizes validation messages via .strings, leaving English default output unchanged elsewhere', async () => {
  const schema: FlatToolParamSchema = {
    type: 'object',
    properties: {
      text: { type: 'string' },
      amount: { type: 'number' },
      count: { type: 'integer' },
      enabled: { type: 'boolean' },
    },
  };
  const el = (await fixture(
    html`<lr-tool-param-form
      .schema=${schema}
      .value=${{ text: 1, amount: '2', count: 2.5, enabled: 'false' }}
      .strings=${{
        fieldMustBeString: 'Doit être une chaîne.',
        fieldMustBeNumber: 'Doit être un nombre fini.',
        fieldMustBeInteger: 'Doit être un nombre entier.',
        fieldMustBeBoolean: 'Doit être un booléen.',
      }}
    ></lr-tool-param-form>`,
  )) as LyraToolParamForm;

  expect(el.errors.text).to.equal('Doit être une chaîne.');
  expect(el.errors.amount).to.equal('Doit être un nombre fini.');
  expect(el.errors.count).to.equal('Doit être un nombre entier.');
  expect(el.errors.enabled).to.equal('Doit être un booléen.');
});

it('localizes the unsupported-field-type and schema-shape messages via .strings, with interpolation', async () => {
  const weirdSchema = {
    type: 'object',
    properties: { nested: { type: 'object' } },
  } as unknown as FlatToolParamSchema;
  const el = (await fixture(
    html`<lr-tool-param-form
      .schema=${weirdSchema}
      .strings=${{ unsupportedFieldType: 'Type de champ non pris en charge : "{type}".' }}
    ></lr-tool-param-form>`,
  )) as LyraToolParamForm;
  expect(el.errors.nested).to.equal('Type de champ non pris en charge : "object".');
  await el.updateComplete;
  expect(field(el, 'nested').querySelector('.unsupported')!.textContent).to.equal(
    'Type de champ non pris en charge : "object".',
  );

  const flatSchema = { type: 'object', properties: [] } as unknown as FlatToolParamSchema;
  const flatEl = (await fixture(
    html`<lr-tool-param-form
      .schema=${flatSchema}
      .strings=${{ schemaPropertiesMustBeFlat: 'Les propriétés du schéma doivent être un objet plat.' }}
    ></lr-tool-param-form>`,
  )) as LyraToolParamForm;
  expect(flatEl.formError).to.equal('Les propriétés du schéma doivent être un objet plat.');
});

it('falls back to the empty schema ({ type: "object", properties: {} }) when schema is set to null', async () => {
  const el = (await fixture(html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`)) as LyraToolParamForm;
  expect(el.shadowRoot!.querySelectorAll('[part="field"]').length).to.equal(4);

  el.schema = null as unknown as FlatToolParamSchema;
  await el.updateComplete;
  expect(el.schema).to.deep.equal({ type: 'object', properties: {} });
  expect(el.shadowRoot!.querySelector('[part="empty"]')).to.exist;
});

it('falls back to {} when value is set to null', async () => {
  const el = (await fixture(
    html`<lr-tool-param-form .schema=${basicSchema} .value=${{ city: 'Paris' }}></lr-tool-param-form>`,
  )) as LyraToolParamForm;
  expect(el.value).to.deep.equal({ city: 'Paris' });

  el.value = null as unknown as Record<string, unknown>;
  await el.updateComplete;
  expect(el.value).to.deep.equal({});
  expect(el.errors.city).to.equal('This field is required.');
});

it('flags a non-numeric value on an integer field as a type mismatch, not merely a step mismatch', async () => {
  const schema: FlatToolParamSchema = {
    type: 'object',
    properties: { count: { type: 'integer' } },
  };
  const el = (await fixture(
    html`<lr-tool-param-form .schema=${schema} .value=${{ count: 'not-a-number' }}></lr-tool-param-form>`,
  )) as LyraToolParamForm;
  expect(el.errors.count).to.equal('Must be a whole number.');
  expect(el.internals.validity.typeMismatch).to.be.true;
  expect(el.checkValidity()).to.be.false;
});

it('surfaces a form-level required error for a key listed in required but absent from properties (a dangling reference)', async () => {
  const schema: FlatToolParamSchema = {
    type: 'object',
    properties: { city: { type: 'string' } },
    required: ['city', 'ghost'],
  };
  const el = (await fixture(html`<lr-tool-param-form .schema=${schema}></lr-tool-param-form>`)) as LyraToolParamForm;
  // No rendered field exists for "ghost" -- it isn't a schema property -- yet it still blocks validity.
  expect((field(el, 'ghost')) === null).to.equal(true);
  expect(el.errors.ghost).to.equal('This field is required.');
  expect(el.checkValidity()).to.be.false;

  el.value = { city: 'Paris', ghost: 'anything' };
  expect(el.errors.ghost).to.be.undefined;
  expect(el.checkValidity()).to.be.true;
});

it('renders and focuses a localized error for an unmet required key that has no matching property', async () => {
  const schema: FlatToolParamSchema = {
    type: 'object',
    properties: {},
    required: ['ghost'],
  };
  const el = (await fixture(
    html`<lr-tool-param-form
      .schema=${schema}
      .strings=${{ toolParamMissingProperty: 'Missing schema property: {key}' }}
    ></lr-tool-param-form>`,
  )) as LyraToolParamForm;

  expect(el.reportValidity()).to.be.false;
  await el.updateComplete;
  await Promise.resolve();

  const error = el.shadowRoot!.querySelector<HTMLElement>('[part="error"][data-missing-property]');
  expect((error) != null).to.equal(true);
  expect(error!.textContent).to.equal('Missing schema property: ghost');
  expect(error!.tabIndex).to.equal(-1);
  expect((el.shadowRoot!.activeElement) === (error)).to.equal(true);
});

it('formStateRestoreCallback recovers to {} on invalid persisted JSON, and restores valid JSON normally', async () => {
  const el = (await fixture(html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`)) as LyraToolParamForm;

  el.formStateRestoreCallback('{not valid json', 'restore');
  await el.updateComplete;
  expect(el.value).to.deep.equal({});

  el.formStateRestoreCallback(JSON.stringify({ city: 'Rome' }), 'restore');
  await el.updateComplete;
  expect(el.value).to.deep.equal({ city: 'Rome' });
});

it('fails closed when a value key shadows toJSON such that JSON.stringify would return undefined', async () => {
  const el = (await fixture(html`<lr-tool-param-form></lr-tool-param-form>`)) as LyraToolParamForm;
  el.value = { toJSON: () => undefined } as unknown as Record<string, unknown>;
  await el.updateComplete;
  expect(el.formError).to.equal('Value must be JSON-serializable.');
  expect(el.checkValidity()).to.be.false;
});

it('ignores a boolean-select change event while effectively disabled', async () => {
  const schema: FlatToolParamSchema = {
    type: 'object',
    properties: { confirm: { type: 'boolean' } },
  };
  const el = (await fixture(
    html`<lr-tool-param-form disabled .schema=${schema}></lr-tool-param-form>`,
  )) as LyraToolParamForm;
  const select = field(el, 'confirm').querySelector('lr-select') as HTMLElement & { value: string };
  let inputFired = false;
  el.addEventListener('lr-input', () => (inputFired = true));

  select.value = 'true';
  select.dispatchEvent(new CustomEvent('lr-change', { bubbles: true, composed: true }));
  await el.updateComplete;

  expect(inputFired, 'setFieldValue must no-op while effectively disabled').to.be.false;
  expect(el.value).to.deep.equal({});
});

it("associates a touched select's error through the select's own form-control chrome", async () => {
  const schema: FlatToolParamSchema = {
    type: 'object',
    properties: { mode: { type: 'string', enum: ['fast', 'safe'], title: 'Mode' } },
  };
  const el = (await fixture(
    html`<lr-tool-param-form .schema=${schema} .value=${{ mode: 'unknown' }}></lr-tool-param-form>`,
  )) as LyraToolParamForm;
  const select = field(el, 'mode').querySelector('lr-select') as HTMLElement;
  expect((select as HTMLElement & { label: string }).label).to.equal('Mode');

  field(el, 'mode').dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect((select as HTMLElement & { errorText: string }).errorText).to.equal('Must be one of: fast or safe.');
  expect(select.shadowRoot!.querySelector('[part="trigger"]')!.getAttribute('aria-describedby')).to.equal('select-error');
});

it('emits lr-input on a select field change, driven by the selected option value', async () => {
  const el = (await fixture(html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`)) as LyraToolParamForm;
  const select = field(el, 'units').querySelector('lr-select') as HTMLElement & { value: string };

  setTimeout(() => {
    select.value = 'fahrenheit';
    select.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  });
  const ev = await oneEvent(el, 'lr-input');
  expect(ev.detail.value.units).to.equal('fahrenheit');
  expect(el.value).to.deep.equal({ units: 'fahrenheit' });
});

it('contains nested control input/change aliases and emits only the form-level lr-input contract', async () => {
  const schema: FlatToolParamSchema = {
    type: 'object',
    properties: {
      mode: { type: 'string', enum: ['fast', 'safe'] },
      confirm: { type: 'boolean' },
    },
  };
  const el = (await fixture(html`<lr-tool-param-form .schema=${schema}></lr-tool-param-form>`)) as LyraToolParamForm;
  const leaked = { input: 0, change: 0, lrChange: 0, lrShow: 0, lrHide: 0, lrOptionChange: 0 };
  let formInputs = 0;
  el.addEventListener('input', () => leaked.input++);
  el.addEventListener('change', () => leaked.change++);
  el.addEventListener('lr-change', () => leaked.lrChange++);
  el.addEventListener('lr-show', () => leaked.lrShow++);
  el.addEventListener('lr-hide', () => leaked.lrHide++);
  el.addEventListener('lr-option-change', () => leaked.lrOptionChange++);
  el.addEventListener('lr-input', () => formInputs++);

  const select = field(el, 'mode').querySelector('lr-select') as HTMLElement & { value: string };
  select.value = 'safe';
  select.dispatchEvent(new CustomEvent('input', { detail: { value: 'safe' }, bubbles: true, composed: true }));
  select.dispatchEvent(new CustomEvent('change', { detail: { value: 'safe' }, bubbles: true, composed: true }));
  select.dispatchEvent(new CustomEvent('lr-change', { detail: { value: 'safe' }, bubbles: true, composed: true }));
  select.dispatchEvent(new CustomEvent('lr-show', { bubbles: true, composed: true }));
  select.dispatchEvent(new CustomEvent('lr-hide', { bubbles: true, composed: true }));
  select.querySelector('lr-option')!.dispatchEvent(
    new CustomEvent('lr-option-change', { bubbles: true, composed: true }),
  );

  const booleanSelect = field(el, 'confirm').querySelector('lr-select') as HTMLElement & { value: string };
  booleanSelect.value = 'true';
  booleanSelect.dispatchEvent(new CustomEvent('lr-change', { bubbles: true, composed: true }));
  await el.updateComplete;

  expect(leaked).to.deep.equal({
    input: 0,
    change: 0,
    lrChange: 0,
    lrShow: 0,
    lrHide: 0,
    lrOptionChange: 0,
  });
  expect(formInputs).to.equal(2);
  expect(el.value).to.deep.equal({ mode: 'safe', confirm: true });
});

it('rejects non-finite numbers and schema defaults that do not match their declared type', async () => {
  const schema: FlatToolParamSchema = {
    type: 'object',
    properties: {
      amount: { type: 'number' },
      count: { type: 'integer', default: 1.5 },
    },
  };
  const el = (await fixture(
    html`<lr-tool-param-form .schema=${schema} .value=${{ amount: Infinity }}></lr-tool-param-form>`,
  )) as LyraToolParamForm;

  expect(el.errors.amount).to.equal('Must be a finite number.');
  expect(el.errors.count).to.equal('Must be a whole number.');

  el.value = { amount: Number.NaN, count: 2 };
  expect(el.errors.amount).to.equal('Must be a finite number.');
  expect(el.checkValidity()).to.be.false;
});

it('supports primitive const so a must-confirm boolean is distinct from required presence', async () => {
  const schema: FlatToolParamSchema = {
    type: 'object',
    properties: { confirm: { type: 'boolean', const: true, title: 'Confirm' } },
    required: ['confirm'],
  };
  const el = (await fixture(
    html`<lr-tool-param-form .schema=${schema} .value=${{ confirm: false }}></lr-tool-param-form>`,
  )) as LyraToolParamForm;

  expect(el.errors.confirm).to.equal('Must equal true.');
  expect(el.internals.validity.customError).to.be.true;
  expect(el.checkValidity()).to.be.false;
  await el.updateComplete;
  const booleanSelect = field(el, 'confirm').querySelector('lr-select') as HTMLElement & { required: boolean };
  expect(booleanSelect.required).to.be.false;
  expect(booleanSelect.getAttribute('aria-required')).to.equal('true');

  el.value = { confirm: true };
  expect(el.errors).to.deep.equal({});
  expect(el.checkValidity()).to.be.true;
});

it('handles circular and BigInt values without throwing, omits unsafe FormData, and recovers', async () => {
  const form = (await fixture(html`
    <form><lr-tool-param-form name="args"></lr-tool-param-form></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-tool-param-form') as LyraToolParamForm;
  const circular: Record<string, unknown> = {};
  circular.self = circular;

  expect(() => {
    el.value = circular;
  }).not.to.throw();
  expect(el.formError).to.equal('Value must be JSON-serializable.');
  expect(el.internals.validity.customError).to.be.true;
  expect(el.checkValidity()).to.be.false;
  expect(new FormData(form).has('args')).to.be.false;

  expect(() => {
    el.value = { amount: 1n };
  }).not.to.throw();
  expect(el.checkValidity()).to.be.false;
  expect(new FormData(form).has('args')).to.be.false;

  expect(el.reportValidity()).to.be.false;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('.form-error')?.textContent).to.equal('Value must be JSON-serializable.');

  el.value = { amount: 1 };
  expect(el.formError).to.equal('');
  expect(el.checkValidity()).to.be.true;
  expect(JSON.parse(new FormData(form).get('args') as string)).to.deep.equal({ amount: 1 });
});

it('publishes serialization-only validity under base without fabricating a field-key error', async () => {
  const el = (await fixture(html`<lr-tool-param-form></lr-tool-param-form>`)) as LyraToolParamForm;
  await el.updateComplete;
  const circular: Record<string, unknown> = {};
  circular.self = circular;

  let changed = oneEvent(el, 'lr-validity-change');
  el.value = circular;
  let event = await changed;
  expect(event.detail.valid).to.be.false;
  expect(event.detail.errors).to.deep.equal({ base: 'Value must be JSON-serializable.' });
  expect(el.formError).to.equal('Value must be JSON-serializable.');

  changed = oneEvent(el, 'lr-validity-change');
  el.value = {};
  event = await changed;
  expect(event.detail.valid).to.be.true;
  expect(event.detail.errors).to.deep.equal({});
});

it('fails closed for malformed root schemas without retaining form data', async () => {
  const form = (await fixture(html`
    <form><lr-tool-param-form name="args"></lr-tool-param-form></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-tool-param-form') as LyraToolParamForm;

  el.schema = { type: 'array', properties: {} } as unknown as FlatToolParamSchema;
  expect(el.formError).to.equal('Schema must describe an object.');
  expect(el.internals.validity.customError).to.be.true;
  expect(new FormData(form).has('args')).to.be.false;

  el.schema = { type: 'object' } as unknown as FlatToolParamSchema;
  expect(el.formError).to.equal('Schema properties must be a flat object.');
  expect(new FormData(form).has('args')).to.be.false;

  el.schema = { type: 'object', properties: null } as unknown as FlatToolParamSchema;
  expect(el.formError).to.equal('Schema properties must be a flat object.');
  expect(new FormData(form).has('args')).to.be.false;
});

it('treats a null property definition as a schema error without throwing or misreporting the value', async () => {
  const form = (await fixture(html`
    <form><lr-tool-param-form name="args"></lr-tool-param-form></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-tool-param-form') as LyraToolParamForm;
  const malformed = {
    type: 'object',
    properties: { broken: null },
  } as unknown as FlatToolParamSchema;

  expect(() => {
    el.schema = malformed;
  }).not.to.throw();
  expect(el.formError).to.equal('Schema properties must be a flat object.');
  expect(el.formError).to.not.equal('Value must be JSON-serializable.');
  expect(el.checkValidity()).to.be.false;
  expect(new FormData(form).has('args')).to.be.false;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="field"]')).to.have.length(0);
  expect(el.shadowRoot!.querySelector('[part="base"]')).to.exist;
});

it('bounds field and enum projections and fails oversized schemas closed with a localized message', async () => {
  const properties = Object.fromEntries(
    Array.from({ length: 101 }, (_, index) => [
      `field-${index}`,
      {
        type: 'string',
        enum: index === 0 ? Array.from({ length: 501 }, (__, option) => `option-${option}`) : undefined,
      },
    ]),
  );
  const schema = { type: 'object', properties } as FlatToolParamSchema;
  const form = (await fixture(html`
    <form>
      <lr-tool-param-form
        name="args"
        .schema=${schema}
        .strings=${{
          toolParamSchemaLimit: 'At most {fields} fields and {options} choices are supported.',
        }}
      ></lr-tool-param-form>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-tool-param-form') as LyraToolParamForm;

  expect(el.formError).to.equal('At most 100 fields and 500 choices are supported.');
  expect(el.checkValidity()).to.be.false;
  expect(new FormData(form).has('args')).to.be.false;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="field"]')).to.have.length(100);
  expect(field(el, 'field-0').querySelectorAll('lr-option')).to.have.length(500);
  expect(field(el, 'field-100') === null).to.be.true;
});

it('contains enumerable getter failures without throwing from value assignment or rendering', async () => {
  const el = (await fixture(html`<lr-tool-param-form></lr-tool-param-form>`)) as LyraToolParamForm;
  const hostile = Object.defineProperty({}, 'boom', {
    enumerable: true,
    get(): never {
      throw new Error('boom');
    },
  });

  expect(() => {
    el.value = hostile;
  }).not.to.throw();
  expect(el.formError).to.equal('Value must be JSON-serializable.');
  expect(el.checkValidity()).to.be.false;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="base"]')).to.exist;
});

it('renders a visible fallback note for an unsupported nested object property instead of dropping it', async () => {
  const weirdSchema = {
    type: 'object',
    properties: { nested: { type: 'object' } },
  } as unknown as FlatToolParamSchema;
  const el = (await fixture(html`<lr-tool-param-form .schema=${weirdSchema}></lr-tool-param-form>`)) as LyraToolParamForm;
  expect(field(el, 'nested').querySelector('.unsupported')).to.exist;
  expect(el.errors.nested).to.equal('Unsupported field type "object".');
  expect(el.internals.validity.customError).to.be.true;
  expect(el.checkValidity()).to.be.false;
});

it('gives the unsupported-type fallback an id matching its <label for>, instead of a dangling reference', async () => {
  const weirdSchema = {
    type: 'object',
    properties: { nested: { type: 'object' } },
  } as unknown as FlatToolParamSchema;
  const el = (await fixture(html`<lr-tool-param-form .schema=${weirdSchema}></lr-tool-param-form>`)) as LyraToolParamForm;
  const label = field(el, 'nested').querySelector('label') as HTMLLabelElement;
  const unsupported = field(el, 'nested').querySelector('.unsupported') as HTMLElement;
  expect(unsupported.id).to.not.equal('');
  expect(label.getAttribute('for')).to.equal(unsupported.id);
});

it('flags a fractional value on an integer field as invalid, independent of required', async () => {
  const el = (await fixture(
    html`<lr-tool-param-form .schema=${basicSchema} .value=${{ city: 'Paris' }}></lr-tool-param-form>`,
  )) as LyraToolParamForm;
  const daysInput = field(el, 'days').querySelector('input') as HTMLInputElement;

  setTimeout(() => {
    daysInput.value = '3.5';
    daysInput.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const ev = await oneEvent(el, 'lr-input');
  expect(ev.detail.value.days).to.equal(3.5);
  expect(el.errors.days).to.equal('Must be a whole number.');
  expect(el.checkValidity()).to.be.false;
  expect(el.reportValidity()).to.be.false;
});

it("associates a touched boolean select's error through its composed form-control chrome", async () => {
  const requiredBoolSchema: FlatToolParamSchema = {
    type: 'object',
    properties: { confirm: { type: 'boolean', title: 'Confirm' } },
    required: ['confirm'],
  };
  const el = (await fixture(
    html`<lr-tool-param-form .schema=${requiredBoolSchema}></lr-tool-param-form>`,
  )) as LyraToolParamForm;
  const select = field(el, 'confirm').querySelector('lr-select') as HTMLElement & { errorText: string };
  expect(select.errorText).to.equal('');

  field(el, 'confirm').dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(select.errorText).to.equal('This field is required.');
  expect(select.shadowRoot!.querySelector('[part="trigger"]')!.getAttribute('aria-describedby')).to.include('select-error');
});

it('participates in a form: submits the resolved value as JSON under name', async () => {
  const form = (await fixture(html`
    <form><lr-tool-param-form name="args" .schema=${basicSchema} .value=${{ city: 'Paris' }}></lr-tool-param-form></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-tool-param-form') as LyraToolParamForm;
  await el.updateComplete;
  const raw = new FormData(form).get('args') as string;
  expect(JSON.parse(raw)).to.deep.equal({ city: 'Paris', units: 'celsius', days: 3 });
});

it('synchronizes schema, value, FormData, and validity before the next render', async () => {
  const form = (await fixture(html`
    <form><lr-tool-param-form name="args"></lr-tool-param-form></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-tool-param-form') as LyraToolParamForm;

  el.schema = basicSchema;
  expect(el.errors).to.have.property('city');
  expect(el.checkValidity()).to.be.false;
  expect(el.reportValidity()).to.be.false;
  expect(JSON.parse(new FormData(form).get('args') as string)).to.deep.equal({
    units: 'celsius',
    days: 3,
  });

  el.value = { city: 'Paris' };
  expect(el.errors).to.deep.equal({});
  expect(el.checkValidity()).to.be.true;
  expect(form.checkValidity()).to.be.true;
  expect(JSON.parse(new FormData(form).get('args') as string)).to.deep.equal({
    city: 'Paris',
    units: 'celsius',
    days: 3,
  });
});

it('applies programmatic disabled state to native form APIs in the same tick', async () => {
  const form = (await fixture(html`
    <form><lr-tool-param-form name="args" .schema=${basicSchema}></lr-tool-param-form></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-tool-param-form') as LyraToolParamForm;
  expect(form.checkValidity()).to.be.false;
  expect(new FormData(form).has('args')).to.be.true;

  el.disabled = true;
  expect(el.hasAttribute('disabled')).to.be.true;
  expect(new FormData(form).has('args')).to.be.false;
  expect(form.checkValidity()).to.be.true;

  el.disabled = false;
  expect(el.hasAttribute('disabled')).to.be.false;
  expect(new FormData(form).has('args')).to.be.true;
  expect(form.checkValidity()).to.be.false;
});

it('submits under a programmatically assigned name in the same tick', async () => {
  const form = (await fixture(html`
    <form>
      <lr-tool-param-form
        .schema=${basicSchema}
        .value=${{ city: 'Paris' }}
      ></lr-tool-param-form>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-tool-param-form') as LyraToolParamForm;

  el.name = 'first';
  expect(el.getAttribute('name')).to.equal('first');
  expect(JSON.parse(new FormData(form).get('first') as string)).to.deep.equal({
    city: 'Paris',
    units: 'celsius',
    days: 3,
  });

  el.name = 'second';
  const renamed = new FormData(form);
  expect(renamed.has('first')).to.be.false;
  expect(JSON.parse(renamed.get('second') as string)).to.deep.equal({
    city: 'Paris',
    units: 'celsius',
    days: 3,
  });

  el.name = '';
  expect(el.hasAttribute('name')).to.be.false;
  expect(el.name).to.equal('');
  expect(new FormData(form).has('second')).to.be.false;

  el.setAttribute('name', 'from-attribute');
  expect(el.name).to.equal('from-attribute');
  expect(JSON.parse(new FormData(form).get('from-attribute') as string)).to.deep.equal({
    city: 'Paris',
    units: 'celsius',
    days: 3,
  });
  el.removeAttribute('name');
  expect(el.name).to.equal('');
  expect(new FormData(form).has('from-attribute')).to.be.false;
});

it('blocks form submission while a required field is empty', async () => {
  const form = (await fixture(html`
    <form><lr-tool-param-form name="args" .schema=${basicSchema}></lr-tool-param-form></form>
  `)) as HTMLFormElement;
  expect(form.reportValidity()).to.be.false;

  const el = form.querySelector('lr-tool-param-form') as LyraToolParamForm;
  el.value = { city: 'Paris' };
  await el.updateComplete;
  expect(form.reportValidity()).to.be.true;
});

it('formResetCallback restores a cloned initial value and native form state on form.reset()', async () => {
  const initialValue = { city: 'Paris' };
  const form = (await fixture(html`
    <form><lr-tool-param-form name="args" .schema=${basicSchema} .value=${initialValue}></lr-tool-param-form></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-tool-param-form') as LyraToolParamForm;
  await el.updateComplete;

  initialValue.city = 'Mutated after mount';
  el.value = { city: 'Berlin' };
  el.reportValidity();
  form.reset();
  expect(el.value).to.deep.equal({ city: 'Paris' });
  expect(el.value).to.not.equal(initialValue);
  expect(JSON.parse(new FormData(form).get('args') as string)).to.deep.equal({
    city: 'Paris',
    units: 'celsius',
    days: 3,
  });
  expect(form.checkValidity()).to.be.true;
});

it('temporarily disables every field through a fieldset without overwriting author state', async () => {
  const form = (await fixture(html`
    <form>
      <fieldset>
        <lr-tool-param-form
          name="args"
          .schema=${basicSchema}
          .value=${{ city: 'Paris' }}
        ></lr-tool-param-form>
        <lr-tool-param-form
          name="always-disabled"
          disabled
          .schema=${basicSchema}
          .value=${{ city: 'London' }}
        ></lr-tool-param-form>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-tool-param-form') as LyraToolParamForm;
  const explicitlyDisabled = form.querySelector('[name="always-disabled"]') as LyraToolParamForm;
  const fieldset = form.querySelector('fieldset') as HTMLFieldSetElement;
  await Promise.all([el.updateComplete, explicitlyDisabled.updateComplete]);
  expect(el.disabled).to.be.false;
  expect(el.effectiveDisabled).to.be.false;
  expect(new FormData(form).has('args')).to.be.true;

  fieldset.disabled = true;
  await Promise.all([el.updateComplete, explicitlyDisabled.updateComplete]);
  expect(el.disabled, 'fieldset state must not mutate the public property').to.be.false;
  expect(el.hasAttribute('disabled')).to.be.false;
  expect(el.effectiveDisabled).to.be.true;
  expect((field(el, 'city').querySelector('input') as HTMLInputElement).disabled).to.be.true;
  expect((field(el, 'units').querySelector('lr-select') as HTMLElement & { disabled: boolean }).disabled).to.be.true;
  expect((field(el, 'days').querySelector('input') as HTMLInputElement).disabled).to.be.true;
  expect(
    (field(el, 'notify').querySelector('lr-select') as HTMLElement & { disabled: boolean }).disabled,
  ).to.be.true;
  expect(new FormData(form).get('args')).to.equal(null);

  fieldset.disabled = false;
  await Promise.all([el.updateComplete, explicitlyDisabled.updateComplete]);
  expect(el.disabled).to.be.false;
  expect(el.effectiveDisabled).to.be.false;
  expect((field(el, 'city').querySelector('input') as HTMLInputElement).disabled).to.be.false;
  expect((field(el, 'units').querySelector('lr-select') as HTMLElement & { disabled: boolean }).disabled).to.be.false;
  expect((field(el, 'days').querySelector('input') as HTMLInputElement).disabled).to.be.false;
  expect(
    (field(el, 'notify').querySelector('lr-select') as HTMLElement & { disabled: boolean }).disabled,
  ).to.be.false;
  expect(new FormData(form).has('args')).to.be.true;

  expect(explicitlyDisabled.disabled, 'an explicit disabled state survives the fieldset cycle').to.be.true;
  expect(explicitlyDisabled.effectiveDisabled).to.be.true;
  expect(new FormData(form).get('always-disabled')).to.equal(null);
});

it('click() focuses the first enabled control, skips one force-disabled from outside, and no-ops while the whole form is disabled', async () => {
  const el = (await fixture(html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`)) as LyraToolParamForm;
  const cityInput = field(el, 'city').querySelector('input') as HTMLInputElement;
  const unitsSelect = field(el, 'units').querySelector('lr-select') as HTMLElement;

  cityInput.disabled = true;
  el.click();
  expect(el.shadowRoot!.activeElement === unitsSelect).to.be.true;

  unitsSelect.blur();
  cityInput.disabled = false;
  el.click();
  expect(el.shadowRoot!.activeElement === cityInput).to.be.true;

  // Not asserting that disabling force-blurs the focused control here: Firefox and WebKit don't
  // reliably blur a focus target on disablement the way Chromium does, so pin only what's stable
  // cross-engine -- click() must not move focus while the whole form is effectively disabled.
  el.disabled = true;
  await el.updateComplete;
  const activeElementWhileDisabled = el.shadowRoot!.activeElement;
  el.click();
  expect(
    el.shadowRoot!.activeElement === activeElementWhileDisabled,
    'click() must no-op while effectively disabled',
  ).to.be.true;
});

it('is accessible in the empty-schema default state', async () => {
  const el = (await fixture(html`<lr-tool-param-form></lr-tool-param-form>`)) as LyraToolParamForm;
  await expect(el).to.be.accessible();
});

it('shows a generic empty message for a schema with no properties, not table-scoped column copy', async () => {
  const el = (await fixture(html`<lr-tool-param-form></lr-tool-param-form>`)) as LyraToolParamForm;
  const empty = el.shadowRoot!.querySelector('[part="empty"]') as HTMLElement;
  expect(empty.textContent).to.equal('No data');
});

it('renders a .strings override for the empty-schema message', async () => {
  const el = (await fixture(
    html`<lr-tool-param-form .strings=${{ noData: 'Rien à configurer' }}></lr-tool-param-form>`,
  )) as LyraToolParamForm;
  const empty = el.shadowRoot!.querySelector('[part="empty"]') as HTMLElement;
  expect(empty.textContent).to.equal('Rien à configurer');
});

it('is accessible in a populated state with a required, unfilled field revealed', async () => {
  const el = (await fixture(html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`)) as LyraToolParamForm;
  el.reportValidity();
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('renders numeric controls with textfield chrome and no native spin buttons', async () => {
  const el = (await fixture(html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`)) as LyraToolParamForm;
  const input = field(el, 'days').querySelector<HTMLInputElement>('input.control')!;
  expect(input.type).to.equal('number');
  expect(getComputedStyle(input).appearance).to.equal('textfield');
  const bounds = input.getBoundingClientRect();
  try {
    await sendMouse({
      type: 'click',
      position: [Math.floor(bounds.right - 4), Math.floor(bounds.top + bounds.height / 4)],
    });
    expect(input.value).to.equal('3');
    expect(Object.hasOwn(el.value, 'days')).to.be.false;
  } finally {
    await resetMouse();
  }
});

it('associates enum and boolean descriptions/errors without imposing must-check semantics', async () => {
  const schema: FlatToolParamSchema = {
    type: 'object',
    properties: {
      mode: { type: 'string', enum: ['fast', 'safe'], description: 'Execution mode' },
      confirm: { type: 'boolean', description: 'Required confirmation' },
    },
    required: ['mode', 'confirm'],
  };
  const el = (await fixture(html`<lr-tool-param-form .schema=${schema}></lr-tool-param-form>`)) as LyraToolParamForm;
  el.reportValidity();
  await el.updateComplete;
  const select = field(el, 'mode').querySelector('lr-select')!;
  const booleanSelect = field(el, 'confirm').querySelector('lr-select')!;
  expect(select.shadowRoot!.querySelector('[part="trigger"]')!.getAttribute('aria-describedby')).to.equal('select-error select-hint');
  expect(booleanSelect.shadowRoot!.querySelector('[part="trigger"]')!.getAttribute('aria-describedby')).to.equal('select-error select-hint');
  expect((booleanSelect as HTMLElement & { required: boolean }).required).to.be.false;
  expect(booleanSelect.getAttribute('aria-required')).to.equal('true');
});

it('wraps long titles and descriptions without widening a 320px allocation', async () => {
  const longWord = 'customer_support_escalation_identifier_'.repeat(8);
  const schema: FlatToolParamSchema = {
    type: 'object',
    properties: {
      plain: { type: 'string', title: longWord, description: longWord },
      mode: { type: 'string', enum: ['fast', 'safe'], title: longWord, description: longWord },
      confirm: { type: 'boolean', title: longWord, description: longWord },
    },
  };
  const container = await fixture<HTMLDivElement>(html`
    <div style="inline-size: 320px">
      <lr-tool-param-form .schema=${schema}></lr-tool-param-form>
    </div>
  `);
  const el = container.querySelector('lr-tool-param-form') as LyraToolParamForm;
  await el.updateComplete;

  expect(container.scrollWidth).to.be.at.most(container.clientWidth);
});

it('forwards schema-defined native editing hints to generated text inputs', async () => {
  const schema = {
    type: 'object',
    properties: {
      email: {
        type: 'string',
        autocomplete: 'email',
        spellcheck: false,
        autocapitalize: 'off',
        autoCorrect: 'off',
        inputMode: 'email',
        enterKeyHint: 'send',
      },
    },
  } as FlatToolParamSchema;
  const el = (await fixture(html`<lr-tool-param-form .schema=${schema}></lr-tool-param-form>`)) as LyraToolParamForm;
  const input = field(el, 'email').querySelector('input')!;
  // Gecko normalizes the `autocomplete` IDL getter to `''` on a detached-form text input even
  // while the standards-facing content attribute is present. This contract is attribute
  // forwarding, so assert the wire values the browser actually consumes across engines.
  expect(input.getAttribute('autocomplete')).to.equal('email');
  expect(input.spellcheck).to.be.false;
  expect(input.getAttribute('inputmode')).to.equal('email');
  expect(input.getAttribute('enterkeyhint')).to.equal('send');
});

it('suppresses raw composed enum/boolean select changes and emits only aggregate lr-input', async () => {
  const el = (await fixture(html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`)) as LyraToolParamForm;
  let rawChanges = 0;
  let aggregate = 0;
  el.addEventListener('change', () => rawChanges++);
  el.addEventListener('lr-change', () => rawChanges++);
  el.addEventListener('lr-input', () => aggregate++);
  field(el, 'units').querySelector('lr-select')!.dispatchEvent(
    new Event('change', { bubbles: true, composed: true }),
  );
  const booleanSelect = field(el, 'notify').querySelector('lr-select') as HTMLElement & { value: string };
  booleanSelect.value = 'true';
  booleanSelect.dispatchEvent(new CustomEvent('lr-change', { bubbles: true, composed: true }));
  expect(rawChanges).to.equal(0);
  expect(aggregate).to.equal(2);
});

describe('validity custom states', () => {
  // Guarded exactly like internal/form-associated.test.ts's own pair: not every engine ships
  // CustomStateSet, and not every engine that does also parses the :state() selector, so an
  // unguarded assertion here would fail on WebKit rather than report a real defect.
  const supportsCustomStates = ((): boolean => {
    try {
      return typeof CustomStateSet === 'function';
    } catch {
      return false;
    }
  })();
  const supportsStateSelector = ((): boolean => {
    try {
      document.createElement('div').matches(':state(x)');
      return true;
    } catch {
      return false;
    }
  })();

  const states = (el: LyraToolParamForm): CustomStateSet =>
    (el as unknown as { internals: ElementInternals }).internals.states;

  it('publishes required/optional and valid/invalid, kept in sync with the schema', async function () {
    if (!supportsCustomStates) this.skip();
    const optionalSchema: FlatToolParamSchema = { type: 'object', properties: { city: { type: 'string' } } };
    const el = (await fixture(
      html`<lr-tool-param-form .schema=${optionalSchema}></lr-tool-param-form>`,
    )) as LyraToolParamForm;
    await el.updateComplete;
    expect(states(el).has('optional')).to.be.true;
    expect(states(el).has('required')).to.be.false;
    expect(states(el).has('valid')).to.be.true;
    expect(states(el).has('invalid')).to.be.false;

    el.schema = basicSchema;
    await el.updateComplete;
    expect(states(el).has('required')).to.be.true;
    expect(states(el).has('optional')).to.be.false;
    expect(states(el).has('invalid')).to.be.true;
    expect(states(el).has('valid')).to.be.false;

    el.value = { city: 'Paris' };
    await el.updateComplete;
    expect(states(el).has('valid')).to.be.true;
    expect(states(el).has('invalid')).to.be.false;
  });

  it('withholds user-valid/user-invalid until the user has actually interacted', async function () {
    if (!supportsCustomStates) this.skip();
    const el = (await fixture(
      html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`,
    )) as LyraToolParamForm;
    await el.updateComplete;
    expect(states(el).has('invalid')).to.be.true;
    expect(states(el).has('user-invalid'), 'pristine required field must not style itself red').to.be.false;
    expect(states(el).has('user-valid')).to.be.false;

    // A focusout on a field is interaction even when nothing was typed.
    field(el, 'city').dispatchEvent(new Event('focusout', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(states(el).has('user-invalid')).to.be.true;
    expect(states(el).has('user-valid')).to.be.false;

    const input = field(el, 'city').querySelector('input')!;
    input.value = 'Paris';
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(states(el).has('user-valid')).to.be.true;
    expect(states(el).has('user-invalid')).to.be.false;
  });

  it('counts a reportValidity() call — what a submit attempt runs — as interaction', async function () {
    if (!supportsCustomStates) this.skip();
    const el = (await fixture(
      html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`,
    )) as LyraToolParamForm;
    await el.updateComplete;
    expect(states(el).has('user-invalid')).to.be.false;
    el.reportValidity();
    await el.updateComplete;
    expect(states(el).has('user-invalid')).to.be.true;
  });

  it('goes pristine again after a form reset', async function () {
    if (!supportsCustomStates) this.skip();
    const form = await fixture<HTMLFormElement>(
      html`<form><lr-tool-param-form name="args" .schema=${basicSchema}></lr-tool-param-form></form>`,
    );
    const el = form.querySelector('lr-tool-param-form') as LyraToolParamForm;
    await el.updateComplete;
    el.reportValidity();
    expect(states(el).has('user-invalid')).to.be.true;
    form.reset();
    await el.updateComplete;
    expect(states(el).has('invalid'), 'still invalid — reset cleared the value, not the requirement').to.be
      .true;
    expect(states(el).has('user-invalid'), 'but pristine again, so nothing should be painted red').to.be
      .false;
  });

  it('publishes neither invalid nor user-invalid while disabled', async function () {
    if (!supportsCustomStates) this.skip();
    // A native `<input required disabled>` matches neither `:valid` nor `:invalid`. Publishing
    // `invalid`/`user-invalid` from a barred control is what painted every disabled required field
    // red under the documented `lr-tool-param-form:state(user-invalid) { ... }` rule.
    const el = (await fixture(
      html`<lr-tool-param-form .schema=${basicSchema} disabled></lr-tool-param-form>`,
    )) as LyraToolParamForm;
    await el.updateComplete;
    expect(el.checkValidity(), 'a barred control reports no violation').to.be.true;
    expect(el.validity.valueMissing).to.be.false;
    expect(states(el).has('invalid')).to.be.false;
    expect(states(el).has('valid'), 'barred matches neither half of the pair').to.be.false;
    expect(states(el).has('required'), 'requiredness describes the schema, not the outcome').to.be.true;
    el.reportValidity();
    await el.updateComplete;
    expect(states(el).has('user-invalid')).to.be.false;

    el.disabled = false;
    await el.updateComplete;
    expect(el.checkValidity(), 'the constraint returns with the control').to.be.false;
    expect(states(el).has('invalid')).to.be.true;
  });

  it('publishes neither invalid nor user-invalid inside a disabled fieldset', async function () {
    if (!supportsCustomStates) this.skip();
    const form = await fixture<HTMLFormElement>(html`
      <form>
        <fieldset disabled>
          <lr-tool-param-form name="args" .schema=${basicSchema}></lr-tool-param-form>
        </fieldset>
      </form>
    `);
    const el = form.querySelector('lr-tool-param-form') as LyraToolParamForm;
    await el.updateComplete;
    expect(el.disabled, 'a fieldset never mutates the control own disabled').to.be.false;
    expect(el.validity.valueMissing, 'fieldset-disabled bars validation exactly like own disabled').to.be
      .false;
    expect(states(el).has('invalid')).to.be.false;
    el.reportValidity();
    await el.updateComplete;
    expect(states(el).has('user-invalid')).to.be.false;
  });

  it('matches the states through a :state() selector, not just the CustomStateSet', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(
      html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`,
    )) as LyraToolParamForm;
    await el.updateComplete;
    const host = el as unknown as HTMLElement;
    expect(host.matches(':state(required)')).to.be.true;
    expect(host.matches(':state(invalid)')).to.be.true;
    expect(host.matches(':state(user-invalid)')).to.be.false;
    el.reportValidity();
    await el.updateComplete;
    expect(host.matches(':state(user-invalid)')).to.be.true;
  });
});

describe('setCustomValidity()', () => {
  // Guarded exactly like the validity-custom-states suite above (and internal/form-associated.test.ts):
  // not every engine ships CustomStateSet, and not every engine that does also parses `:state()`.
  const supportsCustomStates = ((): boolean => {
    try {
      return typeof CustomStateSet === 'function';
    } catch {
      return false;
    }
  })();
  const supportsStateSelector = ((): boolean => {
    try {
      document.createElement('div').matches(':state(x)');
      return true;
    } catch {
      return false;
    }
  })();

  const optionalSchema: FlatToolParamSchema = {
    type: 'object',
    properties: { city: { type: 'string' } },
  };

  it('blocks form submission with a consumer-supplied error, and reports it as validationMessage', async () => {
    const form = await fixture<HTMLFormElement>(
      html`<form><lr-tool-param-form name="args" .schema=${optionalSchema}></lr-tool-param-form></form>`,
    );
    const el = form.querySelector('lr-tool-param-form') as LyraToolParamForm;
    await el.updateComplete;
    let submits = 0;
    // Registered before any requestSubmit() below, so a successful submission can never navigate
    // the test page.
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits += 1;
    });
    expect(el.checkValidity(), 'valid before the custom error').to.be.true;

    el.setCustomValidity('The tool rejected these arguments.');
    expect(el.validity.customError).to.be.true;
    expect(el.checkValidity()).to.be.false;
    expect(el.validationMessage).to.equal('The tool rejected these arguments.');
    expect(form.checkValidity()).to.be.false;
    form.requestSubmit();
    expect(submits, 'a custom error blocks submission').to.equal(0);

    el.setCustomValidity('');
    expect(el.validity.customError).to.be.false;
    expect(el.validationMessage).to.equal('');
    form.requestSubmit();
    expect(submits, 'submission is unblocked once the custom error is cleared').to.equal(1);
  });

  it('keeps a custom error through an intrinsic revalidation', async () => {
    const el = (await fixture(
      html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`,
    )) as LyraToolParamForm;
    await el.updateComplete;
    el.setCustomValidity('Rejected by the server.');
    expect(el.validity.customError).to.be.true;

    // Filling the required field re-runs syncFormState() -- the traffic that would otherwise wipe
    // the consumer's error out on every keystroke.
    el.value = { city: 'Paris' };
    await el.updateComplete;
    expect(el.validity.valueMissing, 'the intrinsic error cleared').to.be.false;
    expect(el.validity.customError, 'the custom error survived the recomputation').to.be.true;
    expect(el.validationMessage).to.equal('Rejected by the server.');
    expect(el.checkValidity(), 'checkValidity() re-syncs and must not drop it either').to.be.false;
  });

  it('keeps a custom error across a form reset, matching native setCustomValidity semantics', async () => {
    // Native `form.reset()` restores a control's value and pristine-ness, but never clears a
    // consumer-set custom error -- only another `setCustomValidity('')` does. This control matches.
    const form = await fixture<HTMLFormElement>(
      html`<form><lr-tool-param-form name="args" .schema=${optionalSchema}></lr-tool-param-form></form>`,
    );
    const el = form.querySelector('lr-tool-param-form') as LyraToolParamForm;
    el.value = { city: 'Paris' };
    await el.updateComplete;
    el.setCustomValidity('That city is outside the tool’s coverage.');

    form.reset();
    await el.updateComplete;
    expect(el.value, 'the reset cleared the value').to.deep.equal({});
    expect(el.validity.customError, 'the custom error outlives the reset').to.be.true;
    expect(el.validationMessage).to.equal('That city is outside the tool’s coverage.');
  });

  it('restores the computed validity when a custom error is cleared, rather than forcing the control valid', async () => {
    const el = (await fixture(
      html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`,
    )) as LyraToolParamForm;
    await el.updateComplete;
    expect(el.validity.valueMissing, 'the required `city` is unset to begin with').to.be.true;

    el.setCustomValidity('Rejected by the server.');
    expect(el.validity.customError).to.be.true;

    el.setCustomValidity('');
    expect(el.validity.customError).to.be.false;
    expect(el.validity.valueMissing, 'the required field is still unset').to.be.true;
    expect(el.checkValidity(), 'clearing the custom error must not force the control valid').to.be.false;
    expect(el.validationMessage.length, 'the intrinsic message is republished').to.be.greaterThan(0);
  });

  it('does not clear the schema-shape customError this control raises on its own', async () => {
    // This control raises `customError` intrinsically too (a malformed schema, an unsupported field
    // type). A consumer's `setCustomValidity('')` must clear only the consumer's own layer.
    const el = (await fixture(
      html`<lr-tool-param-form .schema=${{ type: 'array' } as unknown as FlatToolParamSchema}></lr-tool-param-form>`,
    )) as LyraToolParamForm;
    await el.updateComplete;
    expect(el.validity.customError, 'the malformed schema is itself a customError').to.be.true;
    const schemaMessage = el.validationMessage;
    expect(schemaMessage.length).to.be.greaterThan(0);

    el.setCustomValidity('Rejected by the server.');
    expect(el.validationMessage, 'the consumer error takes over the message').to.equal('Rejected by the server.');

    el.setCustomValidity('');
    expect(el.validity.customError, 'the schema shape is still wrong').to.be.true;
    expect(el.validationMessage, 'the intrinsic schema message comes back').to.equal(schemaMessage);
    expect(el.checkValidity()).to.be.false;
  });

  it('publishes a custom error through the validity custom states', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(
      html`<lr-tool-param-form .schema=${optionalSchema}></lr-tool-param-form>`,
    )) as LyraToolParamForm;
    await el.updateComplete;
    const host = el as unknown as HTMLElement;
    expect(host.matches(':state(valid)'), 'valid before the custom error').to.be.true;

    el.setCustomValidity('Rejected by the server.');
    expect(host.matches(':state(invalid)'), 'synchronously, not on the next Lit update').to.be.true;
    expect(host.matches(':state(valid)')).to.be.false;
    expect(host.matches(':state(user-invalid)'), 'still pristine until the user has a turn').to.be.false;

    el.reportValidity();
    expect(host.matches(':state(user-invalid)'), 'a reported validation counts as interaction').to.be.true;

    el.setCustomValidity('');
    expect(host.matches(':state(valid)')).to.be.true;
    expect(host.matches(':state(user-valid)')).to.be.true;
    expect(host.matches(':state(user-invalid)')).to.be.false;
  });
});

describe('bounded hostile input snapshots', () => {
  it('fails closed for revoked value and schema proxies', async () => {
    const el = await fixture<LyraToolParamForm>(html`<lr-tool-param-form></lr-tool-param-form>`);
    const valueProxy = Proxy.revocable({}, {});
    valueProxy.revoke();
    el.value = valueProxy.proxy as ToolParamFormValue;
    expect(el.value).to.deep.equal({});
    expect(el.validity.customError).to.equal(true);

    const schemaProxy = Proxy.revocable({}, {});
    schemaProxy.revoke();
    el.schema = schemaProxy.proxy as FlatToolParamSchema;
    await el.updateComplete;
    expect(Object.keys(el.schema.properties)).to.deep.equal([]);
    expect(el.validity.customError).to.equal(true);
  });

  it('contains revoked and prototype-hostile nested values without invoking traps', () => {
    const el = document.createElement('lr-tool-param-form') as LyraToolParamForm;
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    let prototypeReads = 0;
    const prototypeHostile = new Proxy({}, {
      getPrototypeOf() {
        prototypeReads += 1;
        throw new Error('prototype denied');
      },
    });

    el.value = { revoked: revoked.proxy, prototypeHostile };

    expect(el.validity.customError).to.equal(true);
    expect(prototypeReads).to.equal(1);
    expect(el.value).to.have.property('prototypeHostile', prototypeHostile);
  });

  it('rejects array and primitive root values and descriptor-hostile schema roots', async () => {
    const el = await fixture<LyraToolParamForm>(html`<lr-tool-param-form></lr-tool-param-form>`);
    el.value = [] as unknown as ToolParamFormValue;
    expect(el.value).to.deep.equal({});
    expect(el.validity.customError).to.equal(true);

    el.value = 'invalid' as unknown as ToolParamFormValue;
    expect(el.value).to.deep.equal({});

    el.schema = [] as unknown as FlatToolParamSchema;
    expect(el.schema).to.deep.equal({ type: 'object', properties: {} });

    const hostileRoot = new Proxy({ type: 'object', properties: {} }, {
      ownKeys() {
        throw new Error('schema descriptors denied');
      },
    });
    el.schema = hostileRoot as FlatToolParamSchema;
    await el.updateComplete;
    expect(Object.keys(el.schema.properties)).to.deep.equal([]);
    expect(el.validity.customError).to.equal(true);
  });

  it('rejects hostile required descriptors and malformed property snapshots without getters', () => {
    const el = document.createElement('lr-tool-param-form') as LyraToolParamForm;
    const revokedRequired = Proxy.revocable([] as string[], {});
    revokedRequired.revoke();
    el.schema = {
      type: 'object',
      properties: { field: { type: 'string' } },
      required: revokedRequired.proxy,
    };
    expect(el.validity.customError).to.equal(true);

    const lengthHostile = new Proxy(['field'], {
      getOwnPropertyDescriptor(target, key) {
        if (key === 'length') throw new Error('required length denied');
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    el.schema = {
      type: 'object',
      properties: { field: { type: 'string' } },
      required: lengthHostile,
    };
    expect(el.schema.required).to.deep.equal([]);

    let requiredGetterCalls = 0;
    const accessorSchema = {
      type: 'object' as const,
      properties: { field: { type: 'string' as const } },
    } as FlatToolParamSchema;
    Object.defineProperty(accessorSchema, 'required', {
      enumerable: true,
      get() {
        requiredGetterCalls += 1;
        return ['field'];
      },
    });
    el.schema = accessorSchema;
    expect(requiredGetterCalls).to.equal(0);
    expect(el.validity.customError).to.equal(true);

    const revokedNested = Proxy.revocable({}, {});
    revokedNested.revoke();
    el.schema = {
      type: 'object',
      properties: {
        field: { type: 'string', nested: revokedNested.proxy } as ToolParamFormProperty,
      },
    };
    expect(el.validity.customError).to.equal(true);
  });

  it('bounds an object with more enumerable fields than the retained-entry ceiling', () => {
    const el = document.createElement('lr-tool-param-form') as LyraToolParamForm;
    const oversized = Object.fromEntries(
      Array.from({ length: 10_001 }, (_, index) => [`field-${index}`, index]),
    );

    el.value = { oversized };

    expect(el.validity.customError).to.equal(true);
    expect(Object.keys(el.value.oversized as object)).to.have.length(10_000);
  });

  it('bounds deeply nested and oversized array values without retaining live input', () => {
    const el = document.createElement('lr-tool-param-form') as LyraToolParamForm;
    let nested: unknown = 'leaf';
    for (let depth = 0; depth < 20; depth += 1) nested = { next: nested };
    el.value = { nested, oversized: new Array(10_001) };
    expect(Object.isFrozen(el.value)).to.equal(true);
    expect(el.validity.customError).to.equal(true);
  });

  it('rejects accessor and throwing array descriptors without invoking consumer getters', () => {
    const el = document.createElement('lr-tool-param-form') as LyraToolParamForm;
    let getterCalls = 0;
    const accessorArray: unknown[] = [];
    Object.defineProperty(accessorArray, '0', {
      enumerable: true,
      get() {
        getterCalls += 1;
        return 'unsafe';
      },
    });
    Object.defineProperty(accessorArray, 'length', { value: 1 });

    const indexTrap = new Proxy(['unsafe'], {
      getOwnPropertyDescriptor(target, key) {
        if (key === '0') throw new Error('index descriptor denied');
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    const lengthTrap = new Proxy(['unsafe'], {
      getOwnPropertyDescriptor(target, key) {
        if (key === 'length') throw new Error('length descriptor denied');
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });

    el.value = { accessorArray, indexTrap, lengthTrap };
    expect(getterCalls).to.equal(0);
    expect(el.validity.customError).to.equal(true);
  });

  it('fails closed when record or schema descriptor enumeration throws', async () => {
    const el = await fixture<LyraToolParamForm>(html`<lr-tool-param-form></lr-tool-param-form>`);
    const descriptorsDenied = new Proxy({}, {
      ownKeys() {
        throw new Error('descriptor enumeration denied');
      },
    });
    el.value = { nested: descriptorsDenied };
    expect(el.validity.customError).to.equal(true);

    el.schema = {
      type: 'object',
      properties: descriptorsDenied,
    } as FlatToolParamSchema;
    await el.updateComplete;
    expect(Object.keys(el.schema.properties)).to.deep.equal([]);
    expect(el.validity.customError).to.equal(true);
  });

  it('reads required arrays through data descriptors only', () => {
    const el = document.createElement('lr-tool-param-form') as LyraToolParamForm;
    let getterCalls = 0;
    const accessorRequired: string[] = [];
    Object.defineProperty(accessorRequired, '0', {
      enumerable: true,
      get() {
        getterCalls += 1;
        return 'field';
      },
    });
    Object.defineProperty(accessorRequired, 'length', { value: 1 });
    el.schema = {
      type: 'object',
      properties: { field: { type: 'string' } },
      required: accessorRequired,
    };
    expect(getterCalls).to.equal(0);
    expect(el.schema.required).to.deep.equal([]);

    const requiredWithIndexTrap = new Proxy(['field'], {
      getOwnPropertyDescriptor(target, key) {
        if (key === '0') throw new Error('required index denied');
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    el.schema = {
      type: 'object',
      properties: { field: { type: 'string' } },
      required: requiredWithIndexTrap,
    };
    expect(el.schema.required).to.deep.equal([]);
  });
});
