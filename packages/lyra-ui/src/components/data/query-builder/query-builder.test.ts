import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './query-builder.js';
import type { LyraQueryBuilder, QueryBuilderField, QueryBuilderValue } from './query-builder.js';
import type { LyraSelect } from '../../forms/select/select.class.js';
import type { LyraCombobox } from '../../forms/combobox/combobox.class.js';
import type { LyraInput } from '../../forms/input/input.class.js';
import type { LyraDateInput } from '../../forms/date-picker/date-input.class.js';

const FIELDS: QueryBuilderField[] = [
  { name: 'name', label: 'Name', type: 'string', placeholder: 'e.g. Acme' },
  { name: 'age', label: 'Age', type: 'number' },
  { name: 'active', label: 'Active', type: 'boolean' },
  { name: 'createdAt', label: 'Created', type: 'date' },
  {
    name: 'status',
    label: 'Status',
    type: 'enum',
    options: [
      { value: 'open', label: 'Open' },
      { value: 'closed', label: 'Closed' },
    ],
  },
];

function conditionRow(el: LyraQueryBuilder, index: number): HTMLElement {
  return el.shadowRoot!.querySelectorAll('[part="condition"]')[index] as HTMLElement;
}

function setAndDispatch(target: HTMLElement, prop: string, value: unknown, eventName: string): void {
  (target as unknown as Record<string, unknown>)[prop] = value;
  target.dispatchEvent(new Event(eventName, { bubbles: true, composed: true }));
}

describe('lr-query-builder', () => {
  it('renders no conditions and no Add button when there are no fields', async () => {
    const el = (await fixture(html`<lr-query-builder></lr-query-builder>`)) as LyraQueryBuilder;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.include('No fields available.');
    expect(el.shadowRoot!.querySelector('[part="add-button"]')).to.not.exist;
  });

  it('renders an empty-conditions message and an Add button when fields exist but value has no conditions', async () => {
    const el = (await fixture(html`<lr-query-builder .fields=${FIELDS}></lr-query-builder>`)) as LyraQueryBuilder;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.include('No conditions yet.');
    expect(el.shadowRoot!.querySelector('[part="add-button"]')).to.exist;
  });

  it('addCondition() appends a blank row and emits lr-add-condition and lr-input', async () => {
    const el = (await fixture(html`<lr-query-builder .fields=${FIELDS}></lr-query-builder>`)) as LyraQueryBuilder;
    await el.updateComplete;
    const addPromise = oneEvent(el, 'lr-add-condition');
    const inputPromise = oneEvent(el, 'lr-input');
    el.addCondition();
    const addEvent = await addPromise;
    const inputEvent = await inputPromise;
    expect(el.value.conditions.length).to.equal(1);
    expect(addEvent.detail.condition.field).to.equal('');
    expect(addEvent.detail.condition.operator).to.equal('');
    expect(inputEvent.detail.value.conditions.length).to.equal(1);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="condition"]').length).to.equal(1);
  });

  it('clicking the Add button appends a row', async () => {
    const el = (await fixture(html`<lr-query-builder .fields=${FIELDS}></lr-query-builder>`)) as LyraQueryBuilder;
    await el.updateComplete;
    const button = el.shadowRoot!.querySelector('[part="add-button"]') as HTMLElement;
    setTimeout(() => button.click());
    const ev = await oneEvent(el, 'lr-add-condition');
    expect(ev.detail.condition).to.exist;
  });

  it('renders one row per condition, field/operator selects reflecting current value', async () => {
    const value: QueryBuilderValue = {
      combinator: 'and',
      conditions: [
        { id: 'c1', field: 'name', operator: 'contains', value: 'acme' },
        { id: 'c2', field: 'age', operator: 'gt', value: 21 },
      ],
    };
    const el = (await fixture(html`<lr-query-builder .fields=${FIELDS} .value=${value}></lr-query-builder>`)) as LyraQueryBuilder;
    await el.updateComplete;
    const rows = el.shadowRoot!.querySelectorAll('[part="condition"]');
    expect(rows.length).to.equal(2);
    const row0FieldSelect = rows[0].querySelector('[part="field-select"]') as LyraSelect;
    const row0OperatorSelect = rows[0].querySelector('[part="operator-select"]') as LyraSelect;
    expect(row0FieldSelect.value).to.equal('name');
    expect(row0OperatorSelect.value).to.equal('contains');
    const row0Value = rows[0].querySelector('[part="value"]') as LyraInput;
    expect(row0Value.tagName.toLowerCase()).to.equal('lr-input');
    expect(row0Value.value).to.equal('acme');
  });

  it('renders the correct value control per field type', async () => {
    const value: QueryBuilderValue = {
      combinator: 'and',
      conditions: [
        { id: 'c-string', field: 'name', operator: 'eq', value: 'a' },
        { id: 'c-number', field: 'age', operator: 'eq', value: 1 },
        { id: 'c-boolean', field: 'active', operator: 'eq', value: true },
        { id: 'c-date', field: 'createdAt', operator: 'eq', value: '2026-01-01' },
        { id: 'c-enum', field: 'status', operator: 'eq', value: 'open' },
        { id: 'c-enum-multi', field: 'status', operator: 'in', value: ['open'] },
      ],
    };
    const el = (await fixture(html`<lr-query-builder .fields=${FIELDS} .value=${value}></lr-query-builder>`)) as LyraQueryBuilder;
    await el.updateComplete;
    const rows = el.shadowRoot!.querySelectorAll('[part="condition"]');
    const tag = (i: number) => rows[i].querySelector('[part="value"]')!.tagName.toLowerCase();
    expect(tag(0)).to.equal('lr-input'); // string
    expect((rows[0].querySelector('[part="value"]') as LyraInput).type).to.equal('text');
    expect(tag(1)).to.equal('lr-input'); // number
    expect((rows[1].querySelector('[part="value"]') as LyraInput).type).to.equal('number');
    expect(tag(2)).to.equal('lr-select'); // boolean
    expect(tag(3)).to.equal('lr-date-input'); // date
    expect((rows[3].querySelector('[part="value"]') as LyraDateInput).value).to.equal('2026-01-01');
    expect(tag(4)).to.equal('lr-select'); // enum, eq
    expect(tag(5)).to.equal('lr-combobox'); // enum, in
    expect((rows[5].querySelector('[part="value"]') as LyraCombobox).multiple).to.be.true;
  });

  it('renders no value control (a placeholder) for a unary operator', async () => {
    const value: QueryBuilderValue = {
      combinator: 'and',
      conditions: [{ id: 'c1', field: 'name', operator: 'isEmpty' }],
    };
    const el = (await fixture(html`<lr-query-builder .fields=${FIELDS} .value=${value}></lr-query-builder>`)) as LyraQueryBuilder;
    await el.updateComplete;
    const valueEl = el.shadowRoot!.querySelector('[part="condition"] [part="value"]')!;
    expect(valueEl.tagName.toLowerCase()).to.equal('span');
  });

  it('renders a placeholder value control for an incomplete row (no field/operator chosen yet)', async () => {
    const value: QueryBuilderValue = { combinator: 'and', conditions: [{ id: 'c1', field: '', operator: '' }] };
    const el = (await fixture(html`<lr-query-builder .fields=${FIELDS} .value=${value}></lr-query-builder>`)) as LyraQueryBuilder;
    await el.updateComplete;
    const row = conditionRow(el, 0);
    expect((row.querySelector('[part="operator-select"]') as LyraSelect).disabled).to.be.true;
    expect(row.querySelector('[part="value"]')!.tagName.toLowerCase()).to.equal('span');
  });

  it('offers only the field-declared operator set when a field overrides it', async () => {
    const fields: QueryBuilderField[] = [{ name: 'notes', label: 'Notes', type: 'string', operators: ['contains'] }];
    const value: QueryBuilderValue = { combinator: 'and', conditions: [{ id: 'c1', field: 'notes', operator: 'contains' }] };
    const el = (await fixture(html`<lr-query-builder .fields=${fields} .value=${value}></lr-query-builder>`)) as LyraQueryBuilder;
    await el.updateComplete;
    const opSelect = conditionRow(el, 0).querySelector('[part="operator-select"]') as LyraSelect;
    const options = [...opSelect.querySelectorAll('lr-option')].map((o) => o.getAttribute('value'));
    expect(options).to.deep.equal(['contains']);
  });

  it('changing the field select resets operator and value, and emits lr-input', async () => {
    const value: QueryBuilderValue = {
      combinator: 'and',
      conditions: [{ id: 'c1', field: 'name', operator: 'contains', value: 'acme' }],
    };
    const el = (await fixture(html`<lr-query-builder .fields=${FIELDS} .value=${value}></lr-query-builder>`)) as LyraQueryBuilder;
    await el.updateComplete;
    const fieldSelect = conditionRow(el, 0).querySelector('[part="field-select"]') as LyraSelect;
    const promise = oneEvent(el, 'lr-input');
    setAndDispatch(fieldSelect, 'value', 'age', 'change');
    const ev = await promise;
    expect(ev.detail.value.conditions[0].field).to.equal('age');
    expect(ev.detail.value.conditions[0].operator).to.equal('');
    expect(ev.detail.value.conditions[0].value).to.be.undefined;
  });

  it('changing the operator to a unary operator clears the value', async () => {
    const value: QueryBuilderValue = {
      combinator: 'and',
      conditions: [{ id: 'c1', field: 'name', operator: 'contains', value: 'acme' }],
    };
    const el = (await fixture(html`<lr-query-builder .fields=${FIELDS} .value=${value}></lr-query-builder>`)) as LyraQueryBuilder;
    await el.updateComplete;
    const opSelect = conditionRow(el, 0).querySelector('[part="operator-select"]') as LyraSelect;
    const promise = oneEvent(el, 'lr-input');
    setAndDispatch(opSelect, 'value', 'isEmpty', 'change');
    const ev = await promise;
    expect(ev.detail.value.conditions[0].operator).to.equal('isEmpty');
    expect(ev.detail.value.conditions[0].value).to.be.undefined;
  });

  it('changing the operator to a multi operator resets the value to an empty array', async () => {
    const value: QueryBuilderValue = {
      combinator: 'and',
      conditions: [{ id: 'c1', field: 'status', operator: 'eq', value: 'open' }],
    };
    const el = (await fixture(html`<lr-query-builder .fields=${FIELDS} .value=${value}></lr-query-builder>`)) as LyraQueryBuilder;
    await el.updateComplete;
    const opSelect = conditionRow(el, 0).querySelector('[part="operator-select"]') as LyraSelect;
    const promise = oneEvent(el, 'lr-input');
    setAndDispatch(opSelect, 'value', 'in', 'change');
    const ev = await promise;
    expect(ev.detail.value.conditions[0].operator).to.equal('in');
    expect(ev.detail.value.conditions[0].value).to.deep.equal([]);
  });

  it('editing a text value control updates the condition value live and emits lr-input', async () => {
    const value: QueryBuilderValue = { combinator: 'and', conditions: [{ id: 'c1', field: 'name', operator: 'contains', value: '' }] };
    const el = (await fixture(html`<lr-query-builder .fields=${FIELDS} .value=${value}></lr-query-builder>`)) as LyraQueryBuilder;
    await el.updateComplete;
    const input = conditionRow(el, 0).querySelector('[part="value"]') as LyraInput;
    const promise = oneEvent(el, 'lr-input');
    setAndDispatch(input, 'value', 'acme', 'input');
    const ev = await promise;
    expect(ev.detail.value.conditions[0].value).to.equal('acme');
  });

  it('editing a number value control parses to a number, and an emptied field becomes undefined', async () => {
    const value: QueryBuilderValue = { combinator: 'and', conditions: [{ id: 'c1', field: 'age', operator: 'eq', value: 5 }] };
    const el = (await fixture(html`<lr-query-builder .fields=${FIELDS} .value=${value}></lr-query-builder>`)) as LyraQueryBuilder;
    await el.updateComplete;
    const input = conditionRow(el, 0).querySelector('[part="value"]') as LyraInput;
    let promise = oneEvent(el, 'lr-input');
    setAndDispatch(input, 'value', '42', 'input');
    let ev = await promise;
    expect(ev.detail.value.conditions[0].value).to.equal(42);
    promise = oneEvent(el, 'lr-input');
    setAndDispatch(input, 'value', '', 'input');
    ev = await promise;
    expect(ev.detail.value.conditions[0].value).to.be.undefined;
  });

  it('selecting a boolean value control coerces to a real boolean', async () => {
    const value: QueryBuilderValue = { combinator: 'and', conditions: [{ id: 'c1', field: 'active', operator: 'eq' }] };
    const el = (await fixture(html`<lr-query-builder .fields=${FIELDS} .value=${value}></lr-query-builder>`)) as LyraQueryBuilder;
    await el.updateComplete;
    const select = conditionRow(el, 0).querySelector('[part="value"]') as LyraSelect;
    const promise = oneEvent(el, 'lr-input');
    setAndDispatch(select, 'value', 'false', 'change');
    const ev = await promise;
    expect(ev.detail.value.conditions[0].value).to.equal(false);
  });

  it('removeCondition() removes the row and emits lr-remove-condition and lr-input', async () => {
    const value: QueryBuilderValue = {
      combinator: 'and',
      conditions: [
        { id: 'c1', field: 'name', operator: 'contains', value: 'a' },
        { id: 'c2', field: 'age', operator: 'eq', value: 1 },
      ],
    };
    const el = (await fixture(html`<lr-query-builder .fields=${FIELDS} .value=${value}></lr-query-builder>`)) as LyraQueryBuilder;
    await el.updateComplete;
    const removePromise = oneEvent(el, 'lr-remove-condition');
    const inputPromise = oneEvent(el, 'lr-input');
    el.removeCondition('c1');
    const removeEvent = await removePromise;
    const inputEvent = await inputPromise;
    expect(removeEvent.detail.id).to.equal('c1');
    expect(inputEvent.detail.value.conditions.map((c: { id: string }) => c.id)).to.deep.equal(['c2']);
  });

  it('clicking a row remove-button removes that row and moves focus to the Add button', async () => {
    const value: QueryBuilderValue = {
      combinator: 'and',
      conditions: [{ id: 'c1', field: 'name', operator: 'contains', value: 'a' }],
    };
    const el = (await fixture(html`<lr-query-builder .fields=${FIELDS} .value=${value}></lr-query-builder>`)) as LyraQueryBuilder;
    await el.updateComplete;
    const removeButton = conditionRow(el, 0).querySelector('[part="remove-button"]') as HTMLElement & { focus(): void };
    removeButton.focus();
    expect(el.shadowRoot!.activeElement).to.equal(removeButton);
    setTimeout(() => removeButton.click());
    await oneEvent(el, 'lr-remove-condition');
    await el.updateComplete;
    expect(el.value.conditions.length).to.equal(0);
    expect(el.shadowRoot!.activeElement).to.equal(el.shadowRoot!.querySelector('[part="add-button"]'));
  });

  it('renders no combinator control with 0 or 1 conditions, and one with 2+', async () => {
    const el = (await fixture(html`<lr-query-builder .fields=${FIELDS}></lr-query-builder>`)) as LyraQueryBuilder;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="combinator"]')).to.not.exist;
    el.addCondition();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="combinator"]')).to.not.exist;
    el.addCondition();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="combinator"]')).to.exist;
  });

  it('changing the combinator control commits and emits lr-input', async () => {
    const value: QueryBuilderValue = {
      combinator: 'and',
      conditions: [
        { id: 'c1', field: 'name', operator: 'contains', value: 'a' },
        { id: 'c2', field: 'age', operator: 'eq', value: 1 },
      ],
    };
    const el = (await fixture(html`<lr-query-builder .fields=${FIELDS} .value=${value}></lr-query-builder>`)) as LyraQueryBuilder;
    await el.updateComplete;
    const combinator = el.shadowRoot!.querySelector('[part="combinator"]') as LyraSelect;
    const promise = oneEvent(el, 'lr-input');
    setAndDispatch(combinator, 'value', 'or', 'change');
    const ev = await promise;
    expect(ev.detail.value.combinator).to.equal('or');
  });

  it('degrades gracefully when a condition references a field name no longer present', async () => {
    const value: QueryBuilderValue = { combinator: 'and', conditions: [{ id: 'c1', field: 'ghost', operator: 'eq', value: 'x' }] };
    const el = (await fixture(html`<lr-query-builder .fields=${FIELDS} .value=${value}></lr-query-builder>`)) as LyraQueryBuilder;
    await el.updateComplete;
    const row = conditionRow(el, 0);
    expect(row).to.exist;
    expect((row.querySelector('[part="operator-select"]') as LyraSelect).disabled).to.be.true;
    expect(row.querySelector('[part="value"]')!.tagName.toLowerCase()).to.equal('span');
  });

  it('programmatic value/fields assignment stays silent (no lr-input)', async () => {
    const el = (await fixture(html`<lr-query-builder></lr-query-builder>`)) as LyraQueryBuilder;
    await el.updateComplete;
    let fired = false;
    el.addEventListener('lr-input', () => {
      fired = true;
    });
    el.fields = FIELDS;
    el.value = { combinator: 'and', conditions: [{ id: 'c1', field: 'name', operator: 'contains', value: 'a' }] };
    await el.updateComplete;
    expect(fired).to.be.false;
  });

  it('consumes raw composed child input/change events before emitting its wrapper event', async () => {
    const value: QueryBuilderValue = {
      combinator: 'and',
      conditions: [{ id: 'c1', field: 'name', operator: 'contains', value: 'a' }],
    };
    const parent = await fixture(html`<div><lr-query-builder .fields=${FIELDS} .value=${value}></lr-query-builder></div>`);
    const el = parent.querySelector('lr-query-builder') as LyraQueryBuilder;
    await el.updateComplete;
    let rawInputs = 0;
    let rawChanges = 0;
    let wrapperInputs = 0;
    parent.addEventListener('input', () => rawInputs++);
    parent.addEventListener('change', () => rawChanges++);
    parent.addEventListener('lr-input', () => wrapperInputs++);

    const input = conditionRow(el, 0).querySelector('[part="value"]') as LyraInput;
    setAndDispatch(input, 'value', 'beta', 'input');
    await el.updateComplete;
    const field = conditionRow(el, 0).querySelector('[part="field-select"]') as LyraSelect;
    setAndDispatch(field, 'value', 'age', 'change');

    expect(rawInputs).to.equal(0);
    expect(rawChanges).to.equal(0);
    expect(wrapperInputs).to.equal(2);
  });

  it('disabled propagates to field/operator selects, value controls, and the add/remove buttons', async () => {
    const value: QueryBuilderValue = { combinator: 'and', conditions: [{ id: 'c1', field: 'name', operator: 'contains', value: 'a' }] };
    const el = (await fixture(html`<lr-query-builder disabled .fields=${FIELDS} .value=${value}></lr-query-builder>`)) as LyraQueryBuilder;
    await el.updateComplete;
    const row = conditionRow(el, 0);
    expect((row.querySelector('[part="field-select"]') as LyraSelect).disabled).to.be.true;
    expect((row.querySelector('[part="operator-select"]') as LyraSelect).disabled).to.be.true;
    expect((row.querySelector('[part="value"]') as LyraInput).disabled).to.be.true;
    expect((row.querySelector('[part="remove-button"]') as HTMLElement).hasAttribute('disabled')).to.be.true;
    expect((el.shadowRoot!.querySelector('[part="add-button"]') as HTMLElement).hasAttribute('disabled')).to.be.true;
  });

  it('renders the built-in English add-condition label with no locale registered', async () => {
    const el = (await fixture(html`<lr-query-builder .fields=${FIELDS}></lr-query-builder>`)) as LyraQueryBuilder;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="add-button"]')!.textContent).to.include('Add condition');
  });

  it('honors a .strings override for the add-condition label', async () => {
    const el = (await fixture(
      html`<lr-query-builder .fields=${FIELDS} .strings=${{ queryBuilderAddCondition: 'Ajouter une condition' }}></lr-query-builder>`,
    )) as LyraQueryBuilder;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="add-button"]')!.textContent).to.include('Ajouter une condition');
  });

  it('renders and functions the same under dir="rtl"', async () => {
    const value: QueryBuilderValue = {
      combinator: 'and',
      conditions: [
        { id: 'c1', field: 'name', operator: 'contains', value: 'a' },
        { id: 'c2', field: 'age', operator: 'eq', value: 1 },
      ],
    };
    const el = (await fixture(
      html`<div dir="rtl"><lr-query-builder .fields=${FIELDS} .value=${value}></lr-query-builder></div>`,
    )) as HTMLElement;
    const qb = el.querySelector('lr-query-builder') as LyraQueryBuilder;
    await qb.updateComplete;
    expect(qb.shadowRoot!.querySelectorAll('[part="condition"]').length).to.equal(2);
    expect(qb.shadowRoot!.querySelector('[part="combinator"]')).to.exist;
  });

  it('stacks a condition row into a column layout at a narrow (<=320px) allocation', async () => {
    const value: QueryBuilderValue = { combinator: 'and', conditions: [{ id: 'c1', field: 'name', operator: 'contains', value: 'a' }] };
    const el = (await fixture(
      html`<lr-query-builder style="inline-size: 260px" .fields=${FIELDS} .value=${value}></lr-query-builder>`,
    )) as LyraQueryBuilder;
    await el.updateComplete;
    const row = conditionRow(el, 0);
    expect(getComputedStyle(row).flexDirection).to.equal('column');
  });

  it('is accessible (empty state)', async () => {
    const el = (await fixture(html`<lr-query-builder .fields=${FIELDS}></lr-query-builder>`)) as LyraQueryBuilder;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it('is accessible with populated rows spanning every field type, including a unary and a multi operator', async () => {
    const value: QueryBuilderValue = {
      combinator: 'and',
      conditions: [
        { id: 'c-string', field: 'name', operator: 'contains', value: 'acme' },
        { id: 'c-number', field: 'age', operator: 'gt', value: 21 },
        { id: 'c-boolean', field: 'active', operator: 'eq', value: true },
        { id: 'c-date', field: 'createdAt', operator: 'gte', value: '2026-01-01' },
        { id: 'c-enum', field: 'status', operator: 'in', value: ['open'] },
        { id: 'c-unary', field: 'name', operator: 'isEmpty' },
      ],
    };
    const el = (await fixture(html`<lr-query-builder .fields=${FIELDS} .value=${value}></lr-query-builder>`)) as LyraQueryBuilder;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="condition"]').length).to.equal(6);
    expect(el.shadowRoot!.querySelector('[part="combinator"]')).to.exist;
    await expect(el).to.be.accessible();
  });
});
