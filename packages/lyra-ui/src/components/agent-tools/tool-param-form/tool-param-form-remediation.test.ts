import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import { render } from 'lit';
import '../../lr-tool-param-form.js';
import type { LyraToolParamForm } from '../../lr-tool-param-form.js';
import type { LyraSelect } from '../../lr-select.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';

for (const key of ['enabled', '__proto__']) {
  for (const defaultValue of [true, false]) {
    it(`keeps explicit ${key} Boolean Unset distinct from the ${defaultValue} schema default`, async () => {
      const schema = { type: 'object' as const, properties: { [key]: { type: 'boolean' as const, default: defaultValue } } };
      const el = await fixture<LyraToolParamForm>(html`<lr-tool-param-form .schema=${schema}></lr-tool-param-form>`);
      expect(el.effectiveValue[key]).to.equal(defaultValue);
      const select = el.shadowRoot!.querySelector<LyraSelect>('lr-select')!;
      select.value = '';
      const changed = oneEvent(el, 'lr-input');
      select.dispatchEvent(new CustomEvent('lr-change', { bubbles: true, composed: true }));
      const event = await changed;
      await el.updateComplete;
      await select.updateComplete;
      expect(Object.hasOwn(el.value, key)).to.equal(true);
      expect(Object.hasOwn(el.effectiveValue, key)).to.equal(true);
      expect(el.effectiveValue[key]).to.equal(undefined);
      expect(Object.hasOwn(event.detail.value, key)).to.equal(true);
      expect(event.detail.value[key]).to.equal(undefined);
      expect(select.value).to.equal('');
      el.value = {};
      await el.updateComplete;
      expect(el.effectiveValue[key]).to.equal(defaultValue);
    });
  }
}

it('keeps an uncontrolled edit when a parent re-renders with the same schema and value references', async () => {
  const schema = { type: 'object' as const, properties: { title: { type: 'string' as const } } };
  const args = { title: 'Agent draft' };
  const host = document.createElement('div');
  document.body.append(host);
  try {
    const renderParent = (status: string, value: Record<string, unknown> = args): void => {
      render(html`<p>${status}</p><lr-tool-param-form .schema=${schema} .value=${value}></lr-tool-param-form>`, host);
    };
    renderParent('running');
    const el = host.querySelector('lr-tool-param-form') as LyraToolParamForm;
    await el.updateComplete;
    const schemaSnapshot = el.schema;
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('input.control')!;
    input.value = 'User correction';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;

    renderParent('streaming');
    await el.updateComplete;
    expect(el.value['title']).to.equal('User correction');
    expect(input.value).to.equal('User correction');
    expect(el.schema === schemaSnapshot, 'an identical schema rebind keeps the snapshot').to.be.true;

    // A new object is still a new controlled value.
    renderParent('replaced', { title: 'Replacement' });
    expect(host.querySelector('lr-tool-param-form') === el).to.be.true;
    await el.updateComplete;
    expect(el.value['title']).to.equal('Replacement');
  } finally {
    render(html``, host);
    host.remove();
  }
});

function paramField(el: LyraToolParamForm, key: string): HTMLElement {
  return el.shadowRoot!.querySelector(`[part="field"][data-key="${key}"]`) as HTMLElement;
}

function assertiveAnnouncements(): string[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"] > div`),
    (node) => node.textContent ?? '',
  );
}

it('announces newly visible errors of number, enum and boolean fields, not only text fields', async () => {
  const schema = {
    type: 'object' as const,
    properties: {
      limit: { type: 'integer' as const, title: 'Limit' },
      mode: { type: 'string' as const, enum: ['fast', 'safe'] },
      hourly: { type: 'boolean' as const },
    },
    required: ['limit', 'mode', 'hourly'],
  };
  const el = await fixture<LyraToolParamForm>(html`<lr-tool-param-form .schema=${schema}></lr-tool-param-form>`);
  const before = assertiveAnnouncements().length;
  paramField(el, 'limit').dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(assertiveAnnouncements().slice(before)).to.deep.equal(['This field is required.']);

  el.value = { limit: 3, mode: 'unknown' };
  await el.updateComplete;
  expect(el.reportValidity()).to.equal(false);
  await el.updateComplete;
  expect(assertiveAnnouncements().slice(before + 1)).to.deep.equal(['Must be one of: fast or safe. This field is required.']);
});

it('focus() and click() reach a leading number field', async () => {
  const schema = {
    type: 'object' as const,
    properties: { limit: { type: 'integer' as const }, query: { type: 'string' as const } },
  };
  const el = await fixture<LyraToolParamForm>(html`<lr-tool-param-form .schema=${schema}></lr-tool-param-form>`);
  el.focus();
  expect(el.shadowRoot!.activeElement === paramField(el, 'limit').querySelector('lr-number-input')).to.be.true;
  const clicked = await fixture<LyraToolParamForm>(html`<lr-tool-param-form .schema=${schema}></lr-tool-param-form>`);
  clicked.click();
  expect(clicked.shadowRoot!.activeElement === paramField(clicked, 'limit').querySelector('lr-number-input')).to.be.true;

  const numericOnly = await fixture<LyraToolParamForm>(html`<lr-tool-param-form .schema=${{ type: 'object', properties: { days: { type: 'number' } } }}></lr-tool-param-form>`);
  numericOnly.focus();
  expect(numericOnly.shadowRoot!.activeElement?.localName).to.equal('lr-number-input');
});

it('renders a boolean field description and error once, inside the composed select', async () => {
  const schema = {
    type: 'object' as const,
    properties: { includeHourly: { type: 'boolean' as const, description: 'Include hourly breakdown' } },
    required: ['includeHourly'],
  };
  const el = await fixture<LyraToolParamForm>(html`<lr-tool-param-form .schema=${schema}></lr-tool-param-form>`);
  const booleanField = paramField(el, 'includeHourly');
  booleanField.dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(booleanField.querySelectorAll('[part="description"]').length).to.equal(0);
  expect(booleanField.querySelectorAll('[part="error"]').length).to.equal(0);
  const select = booleanField.querySelector<LyraSelect>('lr-select')!;
  expect(select.hint).to.equal('Include hourly breakdown');
  expect(select.errorText).to.equal('This field is required.');
});

it('never shows an inherited Object.prototype member as a field error', async () => {
  const properties = { toString: { type: 'string' }, constructor: { type: 'string' }, valueOf: { type: 'string' } };
  const el = await fixture<LyraToolParamForm>(html`<lr-tool-param-form .schema=${{ type: 'object', properties }}></lr-tool-param-form>`);
  for (const key of ['toString', 'constructor', 'valueOf']) {
    paramField(el, key).dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));
  }
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
  expect(el.shadowRoot!.querySelectorAll('[aria-invalid="true"]').length).to.equal(0);
  expect(el.checkValidity()).to.equal(true);
});

it('names a short choice list by its displayed labels and keeps long lists to one short message', async () => {
  const cities = Array.from({ length: 300 }, (_, index) => `city-${index}`);
  const el = await fixture<LyraToolParamForm>(html`<lr-tool-param-form
    .schema=${{
      type: 'object',
      properties: {
        unit: { type: 'string', enum: ['c', 'f'], enumNames: ['Celsius', 'Fahrenheit'] },
        speed: { type: 'string', oneOf: [{ const: 'fast', title: 'Fast' }, { const: 'safe', title: 'Safe' }] },
        city: { type: 'string', enum: cities },
      },
    }}
    .value=${{ unit: 'k', speed: 'slow', city: 'atlantis' }}
  ></lr-tool-param-form>`);
  expect(el.errors['unit']).to.equal('Must be one of: Celsius or Fahrenheit.');
  expect(el.errors['speed']).to.equal('Must be one of: Fast or Safe.');
  expect(el.errors['city']).to.equal('Select only available options, without duplicates.');
  expect(el.validationMessage).to.not.contain('city-299');
});

it('hands out its frozen effective value without re-cloning it on every read', async () => {
  const el = await fixture<LyraToolParamForm>(html`<lr-tool-param-form
    .schema=${{ type: 'object', properties: { days: { type: 'integer', default: 3 } } }}
  ></lr-tool-param-form>`);
  const first = el.effectiveValue;
  expect(Object.isFrozen(first)).to.equal(true);
  expect(el.effectiveValue === first).to.equal(true);
  expect(first['days']).to.equal(3);
});

it('associates with a form by id through the form property and clears the association', async () => {
  const host = await fixture<HTMLDivElement>(html`<div><form id="tool-form-owner"></form><lr-tool-param-form .schema=${{ type: 'object', properties: { q: { type: 'string' } } }}></lr-tool-param-form></div>`);
  const el = host.querySelector('lr-tool-param-form')!;
  const form = host.querySelector('form')!;
  expect(el.form === null).to.equal(true);
  el.form = 'tool-form-owner';
  expect(el.getAttribute('form')).to.equal('tool-form-owner');
  expect(el.form === form).to.equal(true);
  el.form = null;
  expect(el.hasAttribute('form')).to.equal(false);
  expect(el.form).to.equal(null);
});

it('does not repeat a visible error announcement when the form is moved to another parent', async () => {
  const schema = { type: 'object' as const, properties: { limit: { type: 'integer' as const } }, required: ['limit'] };
  const host = await fixture<HTMLDivElement>(html`<div><section></section><lr-tool-param-form .schema=${schema}></lr-tool-param-form></div>`);
  const el = host.querySelector('lr-tool-param-form')!;
  const before = assertiveAnnouncements().length;
  paramField(el, 'limit').dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(assertiveAnnouncements().slice(before)).to.deep.equal(['This field is required.']);
  host.querySelector('section')!.append(el);
  await el.updateComplete;
  expect(el.checkValidity()).to.equal(false);
  expect(assertiveAnnouncements(), 'the still-visible error is resting content after the move').not.to.include('This field is required.');
  el.value = { limit: 1.5 };
  await el.updateComplete;
  el.reportValidity();
  await el.updateComplete;
  expect(assertiveAnnouncements().length, 'a fresh error is still announced after the move').to.be.greaterThan(0);
});

it('clears a custom error when setCustomValidity receives a nullish message', async () => {
  const el = await fixture<LyraToolParamForm>(html`<lr-tool-param-form .schema=${{ type: 'object', properties: { q: { type: 'string' } } }}></lr-tool-param-form>`);
  el.setCustomValidity('Rejected by the server');
  expect(el.checkValidity()).to.equal(false);
  el.setCustomValidity(null as unknown as string);
  expect(el.checkValidity()).to.equal(true);
  expect(el.validationMessage).to.equal('');
});

it('treats focus() and blur() before the first connection as no-ops', () => {
  const el = document.createElement('lr-tool-param-form');
  el.focus();
  el.blur();
  expect(el.isConnected).to.equal(false);
  expect(document.activeElement === el).to.equal(false);
});

it('announces fresh errors in the document it was moved into', async () => {
  const schema = { type: 'object' as const, properties: { limit: { type: 'integer' as const } }, required: ['limit'] };
  const el = await fixture<LyraToolParamForm>(html`<lr-tool-param-form .schema=${schema}></lr-tool-param-form>`);
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const destination = frame.contentDocument!;
  try {
    destination.body.append(destination.adoptNode(el));
    await el.updateComplete;
    paramField(el, 'limit').dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));
    await el.updateComplete;
    const announced = [...destination.querySelectorAll<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"] > div`)].map((node) => node.textContent);
    expect(announced).to.deep.equal(['This field is required.']);
  } finally {
    document.adoptNode(el);
    el.remove();
    frame.remove();
  }
});

describe('required marker and aria-required reach the nested control role owner', () => {
  const schema = {
    type: 'object' as const,
    properties: {
      mode: { type: 'string' as const, enum: ['fast', 'careful'] },
      tags: { type: 'array' as const, items: { type: 'string' as const, enum: ['a', 'b'] } },
      armed: { type: 'boolean' as const },
      count: { type: 'integer' as const },
      free: { type: 'string' as const },
    },
    required: ['mode', 'tags', 'armed', 'count', 'free'],
  };
  const optionalSchema = { ...schema, required: [] as string[] };

  async function roleOwner(el: LyraToolParamForm, key: string): Promise<HTMLElement> {
    const host = el.shadowRoot!.querySelector(`[part="field"][data-key="${key}"] > :is(lr-select, lr-number-input)`) as
      (HTMLElement & { updateComplete: Promise<unknown> });
    await host.updateComplete;
    const owner = host.shadowRoot!.querySelector('[role="combobox"], input[type="text"], input[type="number"], input');
    return owner as HTMLElement;
  }

  for (const key of ['mode', 'tags', 'armed', 'count']) {
    it(`marks the ${key} control required for assistive tech and paints the asterisk`, async () => {
      const el = await fixture<LyraToolParamForm>(html`<lr-tool-param-form .schema=${schema}></lr-tool-param-form>`);
      const owner = await roleOwner(el, key);
      expect(owner.getAttribute('aria-required'), 'inner role owner').to.equal('true');
      const host = el.shadowRoot!.querySelector(`[part="field"][data-key="${key}"] > :is(lr-select, lr-number-input)`)!;
      const label = host.shadowRoot!.querySelector('[part~="form-control-label"]')!;
      expect(getComputedStyle(label, '::after').content).to.contain('*');
    });

    it(`keeps the ${key} control unmarked when the schema does not require it`, async () => {
      const el = await fixture<LyraToolParamForm>(html`<lr-tool-param-form .schema=${optionalSchema}></lr-tool-param-form>`);
      const owner = await roleOwner(el, key);
      expect(owner.getAttribute('aria-required')).to.equal('false');
    });
  }
});

it('falls back to the property key when a schema title is blank', async () => {
  const schema = {
    type: 'object' as const,
    properties: { city: { type: 'string' as const, title: '   ' }, mode: { type: 'string' as const, enum: ['a', 'b'], title: '' } },
  };
  const el = await fixture<LyraToolParamForm>(html`<lr-tool-param-form .schema=${schema}></lr-tool-param-form>`);
  expect(el.shadowRoot!.querySelector('[data-key="city"] [part="label"]')!.textContent!.trim()).to.equal('city');
  expect((el.shadowRoot!.querySelector('[data-key="mode"] lr-select') as HTMLElement & { label: string }).label).to.equal('mode');
});
