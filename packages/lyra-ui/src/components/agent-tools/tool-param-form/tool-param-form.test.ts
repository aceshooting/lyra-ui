import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './tool-param-form.js';
import type { LyraToolParamForm, ToolParamFormSchema } from './tool-param-form.js';
import { styles } from './tool-param-form.styles.js';

const basicSchema: ToolParamFormSchema = {
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
      expect(el!.form).to.equal(null);
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
  expect(daysInput).to.exist;
  expect(daysInput.step).to.equal('1');
  expect(field(el, 'notify').querySelector('lr-checkbox')).to.exist;
});

it('uses schema.title as the label, falling back to the property key', async () => {
  const el = (await fixture(html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`)) as LyraToolParamForm;
  expect(field(el, 'city').querySelector('[part="label"]')!.textContent).to.equal('City');
  expect(field(el, 'units').querySelector('[part="label"]')!.textContent).to.equal('units');
});

it('renders schema.description as helper text under the field', async () => {
  const el = (await fixture(html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`)) as LyraToolParamForm;
  expect(field(el, 'city').querySelector('[part="description"]')!.textContent).to.equal(
    'Where to look up the forecast.',
  );
  expect(field(el, 'units').querySelector('[part="description"]')).to.be.null;
});

it('marks a required field without applying HTML nonempty semantics to the inner control', async () => {
  const el = (await fixture(html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`)) as LyraToolParamForm;
  expect(field(el, 'city').hasAttribute('data-required')).to.be.true;
  expect(field(el, 'units').hasAttribute('data-required')).to.be.false;
  const input = field(el, 'city').querySelector('input') as HTMLInputElement;
  expect(input.required).to.be.false;
  expect(input.getAttribute('aria-required')).to.equal('true');
});

it('marks a required nested lr-select via aria-required without taking over its own validity', async () => {
  const schema: ToolParamFormSchema = {
    type: 'object',
    properties: { mode: { type: 'string', enum: ['fast', 'careful'] } },
    required: ['mode'],
  };
  const el = (await fixture(html`<lr-tool-param-form .schema=${schema}></lr-tool-param-form>`)) as LyraToolParamForm;
  const select = field(el, 'mode').querySelector('lr-select') as HTMLElement & { required: boolean };
  expect(select.getAttribute('aria-required')).to.equal('true');
  expect(select.required).to.be.false;
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

it('emits lr-input on a boolean field toggle', async () => {
  const el = (await fixture(html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`)) as LyraToolParamForm;
  const checkbox = field(el, 'notify').querySelector('lr-checkbox') as HTMLElement & { checked: boolean };

  setTimeout(() => (checkbox.shadowRoot!.querySelector('[part="base"]') as HTMLElement).click());
  const ev = await oneEvent(el, 'lr-input');
  expect(ev.detail.value.notify).to.be.true;
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

it('does not render an inline error until the field has been visited (focusout)', async () => {
  const el = (await fixture(html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`)) as LyraToolParamForm;
  expect(field(el, 'city').querySelector('[part="error"]')).to.be.null;

  field(el, 'city').dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(field(el, 'city').querySelector('[part="error"]')!.textContent).to.equal('This field is required.');
});

it('reportValidity() reveals inline errors immediately and returns overall validity', async () => {
  const el = (await fixture(html`<lr-tool-param-form .schema=${basicSchema}></lr-tool-param-form>`)) as LyraToolParamForm;
  expect(field(el, 'city').querySelector('[part="error"]')).to.be.null;

  expect(el.reportValidity()).to.be.false;
  await el.updateComplete;
  expect(field(el, 'city').querySelector('[part="error"]')).to.exist;

  el.value = { city: 'Paris' };
  await el.updateComplete;
  expect(el.reportValidity()).to.be.true;
});

it('focuses the first invalid nested or native field during direct and form validation', async () => {
  const focusSchema: ToolParamFormSchema = {
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
  const nestedCheckbox = field(el, 'confirm').querySelector('lr-checkbox') as HTMLElement & {
    updateComplete: Promise<unknown>;
  };
  await nestedCheckbox.updateComplete;
  sentinel.focus();
  expect(el.reportValidity()).to.be.false;
  expect(document.activeElement?.localName).to.equal('lr-tool-param-form');
  expect(el.shadowRoot!.activeElement?.localName).to.equal('lr-checkbox');
  expect(nestedCheckbox.shadowRoot!.activeElement?.getAttribute('part')).to.equal('base');
});

it('treats a required boolean as property presence, so false and true are both valid values', async () => {
  const requiredBoolSchema: ToolParamFormSchema = {
    type: 'object',
    properties: { confirm: { type: 'boolean' } },
    required: ['confirm'],
  };
  const el = (await fixture(
    html`<lr-tool-param-form .schema=${requiredBoolSchema}></lr-tool-param-form>`,
  )) as LyraToolParamForm;
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
  const schema: ToolParamFormSchema = {
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
  const schema: ToolParamFormSchema = {
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
  expect(el.errors.mode).to.equal('Must be one of: fast, safe.');
  expect(el.internals.validity.typeMismatch).to.be.true;
  expect(el.internals.validity.stepMismatch).to.be.true;
  expect(el.internals.validity.customError).to.be.true;
  expect(el.checkValidity()).to.be.false;

  el.value = { text: '', amount: 0, count: 2, enabled: false, mode: 'fast' };
  expect(el.errors).to.deep.equal({});
  expect(el.checkValidity()).to.be.true;

  el.value.enabled = 'no';
  expect(el.checkValidity()).to.be.false;
  expect(el.errors.enabled).to.equal('Must be a boolean.');
});

it('localizes validation messages via .strings, leaving English default output unchanged elsewhere', async () => {
  const schema: ToolParamFormSchema = {
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
  } as unknown as ToolParamFormSchema;
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

  const flatSchema = { type: 'object', properties: [] } as unknown as ToolParamFormSchema;
  const flatEl = (await fixture(
    html`<lr-tool-param-form
      .schema=${flatSchema}
      .strings=${{ schemaPropertiesMustBeFlat: 'Les propriétés du schéma doivent être un objet plat.' }}
    ></lr-tool-param-form>`,
  )) as LyraToolParamForm;
  expect(flatEl.formError).to.equal('Les propriétés du schéma doivent être un objet plat.');
});

it('rejects non-finite numbers and schema defaults that do not match their declared type', async () => {
  const schema: ToolParamFormSchema = {
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
  const schema: ToolParamFormSchema = {
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
  expect((field(el, 'confirm').querySelector('lr-checkbox') as HTMLElement & { required: boolean }).required).to.be.false;

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

it('emits serialization-only validity transitions without fabricating a field error', async () => {
  const el = (await fixture(html`<lr-tool-param-form></lr-tool-param-form>`)) as LyraToolParamForm;
  await el.updateComplete;
  const circular: Record<string, unknown> = {};
  circular.self = circular;

  let changed = oneEvent(el, 'lr-validity-change');
  el.value = circular;
  let event = await changed;
  expect(event.detail.valid).to.be.false;
  expect(event.detail.errors).to.deep.equal({});
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

  el.schema = { type: 'array', properties: {} } as unknown as ToolParamFormSchema;
  expect(el.formError).to.equal('Schema must describe an object.');
  expect(el.internals.validity.customError).to.be.true;
  expect(new FormData(form).has('args')).to.be.false;

  el.schema = { type: 'object', properties: null } as unknown as ToolParamFormSchema;
  expect(el.formError).to.equal('Schema properties must be a flat object.');
  expect(new FormData(form).has('args')).to.be.false;
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

it('renders a visible fallback note for a property type outside this phase\'s scope, instead of dropping it', async () => {
  const weirdSchema = {
    type: 'object',
    properties: { nested: { type: 'object' } },
  } as unknown as ToolParamFormSchema;
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
  } as unknown as ToolParamFormSchema;
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

it('folds the error into the checkbox\'s aria-label once touched and invalid, leaving it unset otherwise', async () => {
  const requiredBoolSchema: ToolParamFormSchema = {
    type: 'object',
    properties: { confirm: { type: 'boolean', title: 'Confirm' } },
    required: ['confirm'],
  };
  const el = (await fixture(
    html`<lr-tool-param-form .schema=${requiredBoolSchema}></lr-tool-param-form>`,
  )) as LyraToolParamForm;
  const checkbox = field(el, 'confirm').querySelector('lr-checkbox') as HTMLElement;
  expect(checkbox.hasAttribute('aria-label')).to.be.false;

  field(el, 'confirm').dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(checkbox.getAttribute('aria-label')).to.equal('Confirm. This field is required.');
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

it('formResetCallback clears value back to {} on form.reset()', async () => {
  const form = (await fixture(html`
    <form><lr-tool-param-form name="args" .schema=${basicSchema} .value=${{ city: 'Paris' }}></lr-tool-param-form></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-tool-param-form') as LyraToolParamForm;
  await el.updateComplete;

  form.reset();
  expect(el.value).to.deep.equal({});
  expect(JSON.parse(new FormData(form).get('args') as string)).to.deep.equal({
    units: 'celsius',
    days: 3,
  });
  expect(form.checkValidity()).to.be.false;
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
    (field(el, 'notify').querySelector('lr-checkbox') as HTMLElement & { disabled: boolean }).disabled,
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
    (field(el, 'notify').querySelector('lr-checkbox') as HTMLElement & { disabled: boolean }).disabled,
  ).to.be.false;
  expect(new FormData(form).has('args')).to.be.true;

  expect(explicitlyDisabled.disabled, 'an explicit disabled state survives the fieldset cycle').to.be.true;
  expect(explicitlyDisabled.effectiveDisabled).to.be.true;
  expect(new FormData(form).get('always-disabled')).to.equal(null);
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

it('resets the native number spin-button on numeric control fields', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/input\.control\s*\{[^}]*appearance:\s*textfield/);
  expect(css).to.match(/input\.control::-webkit-inner-spin-button/);
});
