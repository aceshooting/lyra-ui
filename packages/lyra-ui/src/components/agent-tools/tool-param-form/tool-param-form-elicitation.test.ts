import { expect, fixture, html } from '@open-wc/testing';
import './tool-param-form.js';
import type { FlatToolParamSchema, LyraToolParamForm, ToolParamFormProperty } from './tool-param-form.class.js';

async function field(property: ToolParamFormProperty, value: unknown): Promise<LyraToolParamForm> {
  const schema: FlatToolParamSchema = { type: 'object', properties: { field: property } };
  return fixture<LyraToolParamForm>(html`<lr-tool-param-form .schema=${schema} .value=${{ field: value }}></lr-tool-param-form>`);
}

describe('lr-tool-param-form elicitation constraints', () => {
  it('enforces numeric bounds and Unicode code-point string lengths', async () => {
    const number = await field({ type: 'number', minimum: 2, maximum: 4 }, 1);
    expect(number.checkValidity()).to.equal(false);
    number.value = { field: 3 };
    expect(number.checkValidity()).to.equal(true);
    number.value = { field: 5 };
    expect(number.checkValidity()).to.equal(false);
    const text = await field({ type: 'string', minLength: 2, maxLength: 3 }, '🙂');
    expect(text.checkValidity()).to.equal(false);
    text.value = { field: '🙂🙂' };
    expect(text.checkValidity()).to.equal(true);
    text.value = { field: '🙂🙂🙂🙂' };
    expect(text.checkValidity()).to.equal(false);
  });

  it('validates email, URI, calendar dates and offset date-times', async () => {
    for (const [format, valid, invalid] of [
      ['email', 'a@example.com', 'bad email'],
      ['uri', 'mailto:a@example.com', '/relative'],
      ['date', '2024-02-29', '2023-02-29'],
      ['date-time', '2024-02-29T12:30:00+01:00', '2024-02-29T12:30:00'],
    ] as const) {
      const el = await field({ type: 'string', format }, invalid);
      expect(el.checkValidity(), format).to.equal(false);
      el.value = { field: valid };
      expect(el.checkValidity(), format).to.equal(true);
    }
  });

  it('renders titled and legacy enum labels while retaining exact values', async () => {
    const el = await field({ type: 'string', oneOf: [{ const: 'red', title: 'Red label' }, { const: 'blue', title: 'Blue label' }] }, 'red');
    expect(el.checkValidity()).to.equal(true);
    expect(el.shadowRoot!.textContent).to.include('Red label');
    el.value = { field: 'Red label' };
    expect(el.checkValidity()).to.equal(false);
    const legacy = await field({ type: 'string', enum: ['red'], enumNames: ['Legacy red'] }, 'red');
    expect(legacy.shadowRoot!.textContent).to.include('Legacy red');
  });

  it('renders multiple choices and validates items and selection counts', async () => {
    const el = await field({ type: 'array', minItems: 1, maxItems: 2, items: { anyOf: [{ const: 'a', title: 'Option A' }, { const: 'b', title: 'Option B' }, { const: 'c', title: 'Option C' }] } }, ['a']);
    expect(el.checkValidity()).to.equal(true);
    expect(el.shadowRoot!.querySelector('lr-select')?.hasAttribute('multiple')).to.equal(true);
    await expect(el).to.be.accessible();
    for (const value of [[], ['a', 'b', 'c'], ['unknown'], ['a', 'a']]) {
      el.value = { field: value };
      expect(el.checkValidity(), JSON.stringify(value)).to.equal(false);
    }
    el.value = { field: ['a', 'b'] };
    expect(el.checkValidity()).to.equal(true);
  });

  it('fails closed for invalid constraints even on an absent optional field', async () => {
    for (const property of [
      { type: 'number', minimum: Infinity },
      { type: 'number', minimum: 4, maximum: 2 },
      { type: 'string', minLength: -1 },
      { type: 'string', oneOf: new Array(1) },
      { type: 'string', enum: ['x'], enumNames: new Array(1) },
      { type: 'array', items: { anyOf: new Array(1) } },
      { type: 'array', items: { type: 'string', enum: new Array(1) } },
      { type: 'string', oneOf: [{ const: 'x', title: 'X' }, { const: 'x', title: 'Duplicate' }] },
      { type: 'array', items: { type: 'number' } },
    ] as unknown as ToolParamFormProperty[]) {
      const el = await field(property, undefined);
      expect(el.checkValidity()).to.equal(false);
    }
  });

  it('retains baseline behavior when constraints are absent', async () => {
    const el = await field({ type: 'string' }, '');
    expect(el.checkValidity()).to.equal(true);
    expect(el.shadowRoot!.querySelector('input')?.getAttribute('type')).to.equal('text');
  });
});
