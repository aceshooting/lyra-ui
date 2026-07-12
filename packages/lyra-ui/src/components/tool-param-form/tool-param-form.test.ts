import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './tool-param-form.js';
import type { LyraToolParamForm, ToolParamFormSchema } from './tool-param-form.js';

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

it('renders one control per property, in schema key order, matched to its type', async () => {
  const el = (await fixture(html`<lyra-tool-param-form .schema=${basicSchema}></lyra-tool-param-form>`)) as LyraToolParamForm;
  const fields = el.shadowRoot!.querySelectorAll('[part="field"]');
  expect(fields.length).to.equal(4);
  expect(Array.from(fields).map((f) => (f as HTMLElement).dataset.key)).to.deep.equal([
    'city',
    'units',
    'days',
    'notify',
  ]);

  expect(field(el, 'city').querySelector('input[type="text"]')).to.exist;
  expect(field(el, 'units').querySelector('lyra-select')).to.exist;
  expect(field(el, 'units').querySelectorAll('lyra-option').length).to.equal(2);
  const daysInput = field(el, 'days').querySelector('input[type="number"]') as HTMLInputElement;
  expect(daysInput).to.exist;
  expect(daysInput.step).to.equal('1');
  expect(field(el, 'notify').querySelector('lyra-checkbox')).to.exist;
});

it('uses schema.title as the label, falling back to the property key', async () => {
  const el = (await fixture(html`<lyra-tool-param-form .schema=${basicSchema}></lyra-tool-param-form>`)) as LyraToolParamForm;
  expect(field(el, 'city').querySelector('[part="label"]')!.textContent).to.equal('City');
  expect(field(el, 'units').querySelector('[part="label"]')!.textContent).to.equal('units');
});

it('renders schema.description as helper text under the field', async () => {
  const el = (await fixture(html`<lyra-tool-param-form .schema=${basicSchema}></lyra-tool-param-form>`)) as LyraToolParamForm;
  expect(field(el, 'city').querySelector('[part="description"]')!.textContent).to.equal(
    'Where to look up the forecast.',
  );
  expect(field(el, 'units').querySelector('[part="description"]')).to.be.null;
});

it('marks a required field with data-required and aria-required/required on its control', async () => {
  const el = (await fixture(html`<lyra-tool-param-form .schema=${basicSchema}></lyra-tool-param-form>`)) as LyraToolParamForm;
  expect(field(el, 'city').hasAttribute('data-required')).to.be.true;
  expect(field(el, 'units').hasAttribute('data-required')).to.be.false;
  const input = field(el, 'city').querySelector('input') as HTMLInputElement;
  expect(input.required).to.be.true;
});

it('falls back to schema default for a field missing from value, without mutating the value property', async () => {
  const el = (await fixture(html`<lyra-tool-param-form .schema=${basicSchema}></lyra-tool-param-form>`)) as LyraToolParamForm;
  const daysInput = field(el, 'days').querySelector('input') as HTMLInputElement;
  expect(daysInput.value).to.equal('3');
  expect(el.value.days).to.be.undefined;
  expect(el.effectiveValue.days).to.equal(3);
});

it('renders an explicit value over the schema default', async () => {
  const el = (await fixture(
    html`<lyra-tool-param-form .schema=${basicSchema} .value=${{ days: 10 }}></lyra-tool-param-form>`,
  )) as LyraToolParamForm;
  const daysInput = field(el, 'days').querySelector('input') as HTMLInputElement;
  expect(daysInput.value).to.equal('10');
});

it('emits lyra-input with the full resolved value object on a text field edit', async () => {
  const el = (await fixture(html`<lyra-tool-param-form .schema=${basicSchema}></lyra-tool-param-form>`)) as LyraToolParamForm;
  const input = field(el, 'city').querySelector('input') as HTMLInputElement;

  setTimeout(() => {
    input.value = 'Paris';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const ev = await oneEvent(el, 'lyra-input');
  expect(ev.detail.value.city).to.equal('Paris');
  // The full object, including defaults for fields never touched.
  expect(ev.detail.value.units).to.equal('celsius');
  expect(ev.detail.value.days).to.equal(3);
  expect(el.value).to.deep.equal({ city: 'Paris' });
});

it('emits lyra-input on a number field edit, clearing to undefined on an empty input', async () => {
  const el = (await fixture(html`<lyra-tool-param-form .schema=${basicSchema}></lyra-tool-param-form>`)) as LyraToolParamForm;
  const input = field(el, 'days').querySelector('input') as HTMLInputElement;

  setTimeout(() => {
    input.value = '7';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  let ev = await oneEvent(el, 'lyra-input');
  expect(ev.detail.value.days).to.equal(7);

  setTimeout(() => {
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  ev = await oneEvent(el, 'lyra-input');
  expect(ev.detail.value.days).to.be.undefined;
});

it('emits lyra-input on a boolean field toggle', async () => {
  const el = (await fixture(html`<lyra-tool-param-form .schema=${basicSchema}></lyra-tool-param-form>`)) as LyraToolParamForm;
  const checkbox = field(el, 'notify').querySelector('lyra-checkbox') as HTMLElement & { checked: boolean };

  setTimeout(() => (checkbox.shadowRoot!.querySelector('[part="base"]') as HTMLElement).click());
  const ev = await oneEvent(el, 'lyra-input');
  expect(ev.detail.value.notify).to.be.true;
});

it('emits lyra-validity-change on mount with the initial validity', async () => {
  const el = document.createElement('lyra-tool-param-form') as LyraToolParamForm;
  el.schema = basicSchema;
  const promise = oneEvent(el, 'lyra-validity-change');
  document.body.appendChild(el);
  const ev = await promise;
  expect(ev.detail.valid).to.be.false;
  expect(ev.detail.errors).to.have.property('city');
  el.remove();
});

it('emits lyra-validity-change again once the required field is filled, and not on unrelated edits', async () => {
  const el = (await fixture(html`<lyra-tool-param-form .schema=${basicSchema}></lyra-tool-param-form>`)) as LyraToolParamForm;
  await el.updateComplete;

  setTimeout(() => {
    el.value = { city: 'Paris' };
  });
  const ev = await oneEvent(el, 'lyra-validity-change');
  expect(ev.detail.valid).to.be.true;
  expect(ev.detail.errors).to.deep.equal({});

  let fired = false;
  el.addEventListener('lyra-validity-change', () => (fired = true));
  el.value = { city: 'Paris', days: 5 };
  await el.updateComplete;
  expect(fired, 'validity did not actually change, so the event must not re-fire').to.be.false;
});

it('does not render an inline error until the field has been visited (focusout)', async () => {
  const el = (await fixture(html`<lyra-tool-param-form .schema=${basicSchema}></lyra-tool-param-form>`)) as LyraToolParamForm;
  expect(field(el, 'city').querySelector('[part="error"]')).to.be.null;

  field(el, 'city').dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(field(el, 'city').querySelector('[part="error"]')!.textContent).to.equal('This field is required.');
});

it('reportValidity() reveals inline errors immediately and returns overall validity', async () => {
  const el = (await fixture(html`<lyra-tool-param-form .schema=${basicSchema}></lyra-tool-param-form>`)) as LyraToolParamForm;
  expect(field(el, 'city').querySelector('[part="error"]')).to.be.null;

  expect(el.reportValidity()).to.be.false;
  await el.updateComplete;
  expect(field(el, 'city').querySelector('[part="error"]')).to.exist;

  el.value = { city: 'Paris' };
  await el.updateComplete;
  expect(el.reportValidity()).to.be.true;
});

it('renders a boolean value=true field as satisfying required (checked counts as filled)', async () => {
  const requiredBoolSchema: ToolParamFormSchema = {
    type: 'object',
    properties: { confirm: { type: 'boolean' } },
    required: ['confirm'],
  };
  const el = (await fixture(
    html`<lyra-tool-param-form .schema=${requiredBoolSchema}></lyra-tool-param-form>`,
  )) as LyraToolParamForm;
  expect(el.checkValidity()).to.be.false;

  el.value = { confirm: true };
  await el.updateComplete;
  expect(el.checkValidity()).to.be.true;
});

it('renders a visible fallback note for a property type outside this phase\'s scope, instead of dropping it', async () => {
  const weirdSchema = {
    type: 'object',
    properties: { nested: { type: 'object' } },
  } as unknown as ToolParamFormSchema;
  const el = (await fixture(html`<lyra-tool-param-form .schema=${weirdSchema}></lyra-tool-param-form>`)) as LyraToolParamForm;
  expect(field(el, 'nested').querySelector('.unsupported')).to.exist;
});

it('participates in a form: submits the resolved value as JSON under name', async () => {
  const form = (await fixture(html`
    <form><lyra-tool-param-form name="args" .schema=${basicSchema} .value=${{ city: 'Paris' }}></lyra-tool-param-form></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-tool-param-form') as LyraToolParamForm;
  await el.updateComplete;
  const raw = new FormData(form).get('args') as string;
  expect(JSON.parse(raw)).to.deep.equal({ city: 'Paris', units: 'celsius', days: 3 });
});

it('blocks form submission while a required field is empty', async () => {
  const form = (await fixture(html`
    <form><lyra-tool-param-form name="args" .schema=${basicSchema}></lyra-tool-param-form></form>
  `)) as HTMLFormElement;
  expect(form.reportValidity()).to.be.false;

  const el = form.querySelector('lyra-tool-param-form') as LyraToolParamForm;
  el.value = { city: 'Paris' };
  await el.updateComplete;
  expect(form.reportValidity()).to.be.true;
});

it('formResetCallback clears value back to {} on form.reset()', async () => {
  const form = (await fixture(html`
    <form><lyra-tool-param-form name="args" .schema=${basicSchema} .value=${{ city: 'Paris' }}></lyra-tool-param-form></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-tool-param-form') as LyraToolParamForm;
  await el.updateComplete;

  form.reset();
  await el.updateComplete;
  expect(el.value).to.deep.equal({});
});

it('temporarily disables every field through a fieldset without overwriting author state', async () => {
  const form = (await fixture(html`
    <form>
      <fieldset>
        <lyra-tool-param-form
          name="args"
          .schema=${basicSchema}
          .value=${{ city: 'Paris' }}
        ></lyra-tool-param-form>
        <lyra-tool-param-form
          name="always-disabled"
          disabled
          .schema=${basicSchema}
          .value=${{ city: 'London' }}
        ></lyra-tool-param-form>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-tool-param-form') as LyraToolParamForm;
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
  expect((field(el, 'units').querySelector('lyra-select') as HTMLElement & { disabled: boolean }).disabled).to.be.true;
  expect((field(el, 'days').querySelector('input') as HTMLInputElement).disabled).to.be.true;
  expect(
    (field(el, 'notify').querySelector('lyra-checkbox') as HTMLElement & { disabled: boolean }).disabled,
  ).to.be.true;
  expect(new FormData(form).get('args')).to.equal(null);

  fieldset.disabled = false;
  await Promise.all([el.updateComplete, explicitlyDisabled.updateComplete]);
  expect(el.disabled).to.be.false;
  expect(el.effectiveDisabled).to.be.false;
  expect((field(el, 'city').querySelector('input') as HTMLInputElement).disabled).to.be.false;
  expect((field(el, 'units').querySelector('lyra-select') as HTMLElement & { disabled: boolean }).disabled).to.be.false;
  expect((field(el, 'days').querySelector('input') as HTMLInputElement).disabled).to.be.false;
  expect(
    (field(el, 'notify').querySelector('lyra-checkbox') as HTMLElement & { disabled: boolean }).disabled,
  ).to.be.false;
  expect(new FormData(form).has('args')).to.be.true;

  expect(explicitlyDisabled.disabled, 'an explicit disabled state survives the fieldset cycle').to.be.true;
  expect(explicitlyDisabled.effectiveDisabled).to.be.true;
  expect(new FormData(form).get('always-disabled')).to.equal(null);
});

it('is accessible in the empty-schema default state', async () => {
  const el = (await fixture(html`<lyra-tool-param-form></lyra-tool-param-form>`)) as LyraToolParamForm;
  await expect(el).to.be.accessible();
});

it('is accessible in a populated state with a required, unfilled field revealed', async () => {
  const el = (await fixture(html`<lyra-tool-param-form .schema=${basicSchema}></lyra-tool-param-form>`)) as LyraToolParamForm;
  el.reportValidity();
  await el.updateComplete;
  await expect(el).to.be.accessible();
});
