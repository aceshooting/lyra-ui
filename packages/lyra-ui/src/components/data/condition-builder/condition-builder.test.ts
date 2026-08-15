import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './condition-builder.js';
import type { LyraConditionBuilder, ConditionBuilderField, ConditionBuilderValue } from './condition-builder.js';
import type { LyraSelect } from '../../forms/select/select.class.js';
import type { LyraCombobox } from '../../forms/combobox/combobox.class.js';
import type { LyraInput } from '../../forms/input/input.class.js';
import type { LyraDateInput } from '../../forms/date-picker/date-input.class.js';

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
    throw new Error('Could not create an iframe realm for the condition-builder test.');
  }
  return { iframe, frameDocument, frameWindow };
}

function replaceCssEscape(
  target: CssEscapeHost,
  replacement: CssEscapeHost['escape'],
): () => void {
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

const FIELDS: ConditionBuilderField[] = [
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

function conditionRow(el: LyraConditionBuilder, index: number): HTMLElement {
  return el.shadowRoot!.querySelectorAll('[part="condition"]')[index] as HTMLElement;
}

function setAndDispatch(target: HTMLElement, prop: string, value: unknown, eventName: string): void {
  (target as unknown as Record<string, unknown>)[prop] = value;
  target.dispatchEvent(new Event(eventName, { bubbles: true, composed: true }));
}

describe('lr-condition-builder v9 contract', () => {
  it('does not retain the removed lr-query-builder registration alias', () => {
    expect(typeof customElements.get('lr-condition-builder')).to.equal('function');
    expect(customElements.get('lr-query-builder')).to.be.undefined;
  });

  it('renders no conditions and no Add button when there are no fields', async () => {
    const el = (await fixture(html`<lr-condition-builder></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.include('No fields available.');
    expect((el.shadowRoot!.querySelector('[part="add-button"]')) == null).to.be.true;

    let emitted = false;
    el.addEventListener('lr-add-condition', () => (emitted = true));
    el.addCondition();
    expect(el.value.conditions).to.have.length(0);
    expect(emitted).to.equal(false);
  });

  it('renders an empty-conditions message and an Add button when fields exist but value has no conditions', async () => {
    const el = (await fixture(html`<lr-condition-builder .fields=${FIELDS}></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.include('No conditions yet.');
    expect(el.shadowRoot!.querySelector('[part="add-button"]')).to.exist;
  });

  it('addCondition() seeds the first available field and emits frozen snapshots', async () => {
    const el = (await fixture(html`<lr-condition-builder .fields=${FIELDS}></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;
    const addPromise = oneEvent(el, 'lr-add-condition');
    const inputPromise = oneEvent(el, 'lr-input');
    el.addCondition();
    const addEvent = await addPromise;
    const inputEvent = await inputPromise;
    expect(el.value.conditions.length).to.equal(1);
    expect(addEvent.detail.condition.field).to.equal('name');
    expect(addEvent.detail.condition.operator).to.equal('');
    expect(inputEvent.detail.value.conditions.length).to.equal(1);
    expect(Object.isFrozen(addEvent.detail)).to.equal(true);
    expect(Object.isFrozen(addEvent.detail.condition)).to.equal(true);
    expect(Object.isFrozen(inputEvent.detail)).to.equal(true);
    expect(Object.isFrozen(inputEvent.detail.value)).to.equal(true);
    expect(Object.isFrozen(inputEvent.detail.value.conditions)).to.equal(true);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="condition"]').length).to.equal(1);
  });

  it('clicking the Add button appends a row', async () => {
    const el = (await fixture(html`<lr-condition-builder .fields=${FIELDS}></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;
    const button = el.shadowRoot!.querySelector('[part="add-button"]') as HTMLElement;
    setTimeout(() => button.click());
    const ev = await oneEvent(el, 'lr-add-condition');
    expect(ev.detail.condition).to.exist;
  });

  it('renders one row per condition, field/operator selects reflecting current value', async () => {
    const value: ConditionBuilderValue = {
      combinator: 'and',
      conditions: [
        { id: 'c1', field: 'name', operator: 'contains', value: 'acme' },
        { id: 'c2', field: 'age', operator: 'gt', value: 21 },
      ],
    };
    const el = (await fixture(html`<lr-condition-builder .fields=${FIELDS} .value=${value}></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;
    const rows = el.shadowRoot!.querySelectorAll('[part="condition"]');
    expect(rows.length).to.equal(2);
    expect(el.shadowRoot!.querySelector('[part="conditions"]')!.getAttribute('role')).to.equal('list');
    expect(rows[0]!.getAttribute('role')).to.equal('listitem');
    expect(rows[1]!.getAttribute('role')).to.equal('listitem');
    const row0FieldSelect = rows[0].querySelector('[part="field-select"]') as LyraSelect;
    const row0OperatorSelect = rows[0].querySelector('[part="operator-select"]') as LyraSelect;
    expect(row0FieldSelect.value).to.equal('name');
    expect(row0OperatorSelect.value).to.equal('contains');
    const row0Value = rows[0].querySelector('[part="value"]') as LyraInput;
    expect(row0Value.tagName.toLowerCase()).to.equal('lr-input');
    expect(row0Value.value).to.equal('acme');
  });

  it('clone-owns bounded structured inputs, drops duplicate identities, and rejects hostile accessors', async () => {
    const fields: ConditionBuilderField[] = [
      { name: '', type: 'string' },
      { name: '   ', type: 'string' },
      { name: 'blank-options', type: 'enum', options: [{ value: '' }, { value: '   ' }] },
      { name: 'name', type: 'string', options: [{ value: 'a', label: 'A' }] },
      { name: 'name', type: 'number' },
    ];
    const value: ConditionBuilderValue = {
      combinator: 'and',
      conditions: [
        { id: '', field: 'name', operator: 'eq', value: 'missing' },
        { id: '   ', field: 'name', operator: 'eq', value: 'blank' },
        { id: 'same', field: 'name', operator: 'eq', value: 'first' },
        { id: 'same', field: 'name', operator: 'eq', value: 'second' },
      ],
    };
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostile, 'id', { get: () => { throw new Error('must not run'); } });
    (value.conditions as unknown as unknown[]).push(hostile);
    const el = (await fixture(html`<lr-condition-builder .fields=${fields} .value=${value}></lr-condition-builder>`)) as LyraConditionBuilder;

    (fields[3] as { name: string }).name = 'mutated';
    (value.conditions[2] as { field: string }).field = 'mutated';
    expect(el.fields.map((field) => field.name)).to.deep.equal(['blank-options', 'name']);
    expect(el.fields[0]!.options).to.deep.equal(undefined);
    expect(el.fields[1]!.name).to.equal('name');
    expect(el.value.conditions).to.have.length(1);
    expect(el.value.conditions[0]!.field).to.equal('name');
    expect(Object.isFrozen(el.fields)).to.equal(true);
    expect(Object.isFrozen(el.fields[0]!)).to.equal(true);
    expect(Object.isFrozen(el.value.conditions[0]!)).to.equal(true);
  });

  it('renders the correct value control per field type', async () => {
    const value: ConditionBuilderValue = {
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
    const el = (await fixture(html`<lr-condition-builder .fields=${FIELDS} .value=${value}></lr-condition-builder>`)) as LyraConditionBuilder;
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
    const value: ConditionBuilderValue = {
      combinator: 'and',
      conditions: [{ id: 'c1', field: 'name', operator: 'isEmpty' }],
    };
    const el = (await fixture(html`<lr-condition-builder .fields=${FIELDS} .value=${value}></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;
    const valueEl = el.shadowRoot!.querySelector('[part="condition"] [part="value"]')!;
    expect(valueEl.tagName.toLowerCase()).to.equal('span');
  });

  it('renders a placeholder value control for an incomplete row (no field/operator chosen yet)', async () => {
    const value: ConditionBuilderValue = { combinator: 'and', conditions: [{ id: 'c1', field: '', operator: '' }] };
    const el = (await fixture(html`<lr-condition-builder .fields=${FIELDS} .value=${value}></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;
    const row = conditionRow(el, 0);
    expect((row.querySelector('[part="operator-select"]') as LyraSelect).disabled).to.be.true;
    expect(row.querySelector('[part="value"]')!.tagName.toLowerCase()).to.equal('span');
  });

  it('offers only the field-declared operator set when a field overrides it', async () => {
    const fields: ConditionBuilderField[] = [{ name: 'notes', label: 'Notes', type: 'string', operators: ['contains'] }];
    const value: ConditionBuilderValue = { combinator: 'and', conditions: [{ id: 'c1', field: 'notes', operator: 'contains' }] };
    const el = (await fixture(html`<lr-condition-builder .fields=${fields} .value=${value}></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;
    const opSelect = conditionRow(el, 0).querySelector('[part="operator-select"]') as LyraSelect;
    const options = [...opSelect.querySelectorAll('lr-option')].map((o) => o.getAttribute('value'));
    expect(options).to.deep.equal(['contains']);
  });

  it('changing the field select resets operator and value, and emits lr-input', async () => {
    const value: ConditionBuilderValue = {
      combinator: 'and',
      conditions: [{ id: 'c1', field: 'name', operator: 'contains', value: 'acme' }],
    };
    const el = (await fixture(html`<lr-condition-builder .fields=${FIELDS} .value=${value}></lr-condition-builder>`)) as LyraConditionBuilder;
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
    const value: ConditionBuilderValue = {
      combinator: 'and',
      conditions: [{ id: 'c1', field: 'name', operator: 'contains', value: 'acme' }],
    };
    const el = (await fixture(html`<lr-condition-builder .fields=${FIELDS} .value=${value}></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;
    const opSelect = conditionRow(el, 0).querySelector('[part="operator-select"]') as LyraSelect;
    const promise = oneEvent(el, 'lr-input');
    setAndDispatch(opSelect, 'value', 'isEmpty', 'change');
    const ev = await promise;
    expect(ev.detail.value.conditions[0].operator).to.equal('isEmpty');
    expect(ev.detail.value.conditions[0].value).to.be.undefined;
  });

  it('changing the operator to a multi operator resets the value to an empty array', async () => {
    const value: ConditionBuilderValue = {
      combinator: 'and',
      conditions: [{ id: 'c1', field: 'status', operator: 'eq', value: 'open' }],
    };
    const el = (await fixture(html`<lr-condition-builder .fields=${FIELDS} .value=${value}></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;
    const opSelect = conditionRow(el, 0).querySelector('[part="operator-select"]') as LyraSelect;
    const promise = oneEvent(el, 'lr-input');
    setAndDispatch(opSelect, 'value', 'in', 'change');
    const ev = await promise;
    expect(ev.detail.value.conditions[0].operator).to.equal('in');
    expect(ev.detail.value.conditions[0].value).to.deep.equal([]);
  });

  it('editing a text value control updates the condition value live and emits lr-input', async () => {
    const value: ConditionBuilderValue = { combinator: 'and', conditions: [{ id: 'c1', field: 'name', operator: 'contains', value: '' }] };
    const el = (await fixture(html`<lr-condition-builder .fields=${FIELDS} .value=${value}></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;
    const input = conditionRow(el, 0).querySelector('[part="value"]') as LyraInput;
    const promise = oneEvent(el, 'lr-input');
    setAndDispatch(input, 'value', 'acme', 'lr-input');
    const ev = await promise;
    expect(ev.detail.value.conditions[0].value).to.equal('acme');
  });

  it('emits exactly one aggregate lr-input for one real nested text keystroke', async () => {
    const value: ConditionBuilderValue = {
      combinator: 'and',
      conditions: [{ id: 'c1', field: 'name', operator: 'contains', value: '' }],
    };
    const parent = await fixture(
      html`<div><lr-condition-builder .fields=${FIELDS} .value=${value}></lr-condition-builder></div>`,
    );
    const el = parent.querySelector('lr-condition-builder') as LyraConditionBuilder;
    await el.updateComplete;
    const input = conditionRow(el, 0).querySelector('[part="value"]') as LyraInput;
    const native = input.shadowRoot!.querySelector('input') as HTMLInputElement;
    const details: unknown[] = [];
    parent.addEventListener('lr-input', (event) => details.push((event as CustomEvent).detail));

    native.value = 'beta';
    native.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    await el.updateComplete;

    expect(details.length).to.equal(1);
    expect(details[0]).to.deep.equal({ value: el.value });
  });

  it('editing a number value control parses to a number, and an emptied field becomes undefined', async () => {
    const value: ConditionBuilderValue = { combinator: 'and', conditions: [{ id: 'c1', field: 'age', operator: 'eq', value: 5 }] };
    const el = (await fixture(html`<lr-condition-builder .fields=${FIELDS} .value=${value}></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;
    const input = conditionRow(el, 0).querySelector('[part="value"]') as LyraInput;
    let promise = oneEvent(el, 'lr-input');
    setAndDispatch(input, 'value', '42', 'lr-input');
    let ev = await promise;
    expect(ev.detail.value.conditions[0].value).to.equal(42);
    promise = oneEvent(el, 'lr-input');
    setAndDispatch(input, 'value', '', 'lr-input');
    ev = await promise;
    expect(ev.detail.value.conditions[0].value).to.be.undefined;
  });

  it('normalizes non-finite controlled number conditions when value or field metadata arrives', async () => {
    const el = (await fixture(html`
      <lr-condition-builder
        .fields=${FIELDS}
        .value=${{
          combinator: 'and',
          conditions: [
            { id: 'positive', field: 'age', operator: 'eq', value: Number.POSITIVE_INFINITY },
            { id: 'negative', field: 'age', operator: 'eq', value: Number.NEGATIVE_INFINITY },
          ],
        }}
      ></lr-condition-builder>
    `)) as LyraConditionBuilder;
    await el.updateComplete;
    expect(el.value.conditions.map((condition) => condition.value)).to.deep.equal([undefined, undefined]);
    expect(JSON.stringify(el.value).includes('null'), 'the normalized model never persists Infinity as JSON null').to.equal(false);

    const late = document.createElement('lr-condition-builder') as LyraConditionBuilder;
    late.value = {
      combinator: 'and',
      conditions: [{ id: 'late', field: 'age', operator: 'eq', value: Number.POSITIVE_INFINITY }],
    };
    late.fields = FIELDS;
    expect(late.value.conditions[0]?.value, 'late field metadata re-normalizes the controlled model').to.be.undefined;
  });

  it('selecting a boolean value control coerces to a real boolean', async () => {
    const value: ConditionBuilderValue = { combinator: 'and', conditions: [{ id: 'c1', field: 'active', operator: 'eq' }] };
    const el = (await fixture(html`<lr-condition-builder .fields=${FIELDS} .value=${value}></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;
    const select = conditionRow(el, 0).querySelector('[part="value"]') as LyraSelect;
    const promise = oneEvent(el, 'lr-input');
    setAndDispatch(select, 'value', 'false', 'change');
    const ev = await promise;
    expect(ev.detail.value.conditions[0].value).to.equal(false);
  });

  it('removeCondition() removes the row and emits lr-remove-condition and lr-input', async () => {
    const value: ConditionBuilderValue = {
      combinator: 'and',
      conditions: [
        { id: 'c1', field: 'name', operator: 'contains', value: 'a' },
        { id: 'c2', field: 'age', operator: 'eq', value: 1 },
      ],
    };
    const el = (await fixture(html`<lr-condition-builder .fields=${FIELDS} .value=${value}></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;
    const removePromise = oneEvent(el, 'lr-remove-condition');
    const inputPromise = oneEvent(el, 'lr-input');
    el.removeCondition('c1');
    const removeEvent = await removePromise;
    const inputEvent = await inputPromise;
    expect(removeEvent.detail.conditionId).to.equal('c1');
    expect(inputEvent.detail.value.conditions.map((c: { id: string }) => c.id)).to.deep.equal(['c2']);
  });

  it('clicking a row remove-button removes that row and moves focus to the Add button', async () => {
    const value: ConditionBuilderValue = {
      combinator: 'and',
      conditions: [{ id: 'c1', field: 'name', operator: 'contains', value: 'a' }],
    };
    const el = (await fixture(html`<lr-condition-builder .fields=${FIELDS} .value=${value}></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;
    const removeButton = conditionRow(el, 0).querySelector('[part="remove-button"]') as HTMLElement & { focus(): void };
    removeButton.focus();
    expect((el.shadowRoot!.activeElement) === (removeButton)).to.equal(true);
    setTimeout(() => removeButton.click());
    await oneEvent(el, 'lr-remove-condition');
    await el.updateComplete;
    expect(el.value.conditions.length).to.equal(0);
    expect((el.shadowRoot!.activeElement) === (el.shadowRoot!.querySelector('[part="add-button"]'))).to.equal(true);
  });

  it('uses the adopted owner realm CSS escape for public removal of a focused special-id row', async () => {
    const specialId = 'target\"] [data-id=\"decoy';
    const value: ConditionBuilderValue = {
      combinator: 'and',
      conditions: [
        { id: specialId, field: 'name', operator: 'contains', value: 'special' },
        { id: 'decoy', field: 'name', operator: 'contains', value: 'decoy' },
      ],
    };
    const { iframe, frameDocument, frameWindow } = createRealmFrame();
    const el = (await fixture(
      html`<lr-condition-builder .fields=${FIELDS} .value=${value}></lr-condition-builder>`,
    )) as LyraConditionBuilder;
    el.remove();
    frameDocument.adoptNode(el);
    frameDocument.body.append(el);
    await el.updateComplete;

    const specialRow = Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('[part="condition"]')).find(
      (row) => row.dataset['id'] === specialId,
    )!;
    (specialRow.querySelector('[part="remove-button"]') as HTMLElement).focus();
    const ownerEscape = frameWindow.CSS.escape.bind(frameWindow.CSS);
    let ownerCalls = 0;
    const restoreOwner = replaceCssEscape(frameWindow.CSS, (identifier) => {
      ownerCalls += 1;
      return ownerEscape(identifier);
    });
    const restoreAmbient = replaceCssEscape(CSS, () => 'decoy');
    try {
      el.removeCondition(specialId);
      await el.updateComplete;

      expect(ownerCalls).to.equal(1);
      expect(el.value.conditions.map((condition) => condition.id)).to.deep.equal(['decoy']);
      expect((el.shadowRoot!.activeElement as HTMLElement | null)?.getAttribute('part')).to.equal('add-button');
    } finally {
      restoreAmbient();
      restoreOwner();
      el.remove();
      iframe.remove();
    }
  });

  it('uses an exact condition-id scan when adopted owner CSS escape is missing or throws', async () => {
    const specialId = 'target\"] [data-id=\"decoy';
    for (const mode of ['missing', 'throwing'] as const) {
      const value: ConditionBuilderValue = {
        combinator: 'and',
        conditions: [
          { id: specialId, field: 'name', operator: 'contains', value: 'special' },
          { id: 'decoy', field: 'name', operator: 'contains', value: 'decoy' },
        ],
      };
      const { iframe, frameDocument, frameWindow } = createRealmFrame();
      const el = (await fixture(
        html`<lr-condition-builder .fields=${FIELDS} .value=${value}></lr-condition-builder>`,
      )) as LyraConditionBuilder;
      el.remove();
      frameDocument.adoptNode(el);
      frameDocument.body.append(el);
      await el.updateComplete;

      const specialRow = Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('[part="condition"]')).find(
        (row) => row.dataset['id'] === specialId,
      )!;
      (specialRow.querySelector('[part="remove-button"]') as HTMLElement).focus();
      let ownerCalls = 0;
      const restoreOwner = replaceCssEscape(
        frameWindow.CSS,
        mode === 'missing'
          ? undefined
          : () => {
              ownerCalls += 1;
              throw new Error('owner CSS escape unavailable');
            },
      );
      const restoreAmbient = replaceCssEscape(CSS, () => 'decoy');
      try {
        el.removeCondition(specialId);
        await el.updateComplete;

        expect(el.value.conditions.map((condition) => condition.id)).to.deep.equal(['decoy']);
        expect((el.shadowRoot!.activeElement as HTMLElement | null)?.getAttribute('part')).to.equal('add-button');
        expect(ownerCalls).to.equal(mode === 'throwing' ? 1 : 0);
      } finally {
        restoreAmbient();
        restoreOwner();
        el.remove();
        iframe.remove();
      }
    }
  });

  it('renders no combinator control with 0 or 1 conditions, and one with 2+', async () => {
    const el = (await fixture(html`<lr-condition-builder .fields=${FIELDS}></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="combinator"]')) == null).to.be.true;
    el.addCondition();
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="combinator"]')) == null).to.be.true;
    el.addCondition();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="combinator"]')).to.exist;
  });

  it('changing the combinator control commits and emits lr-input', async () => {
    const value: ConditionBuilderValue = {
      combinator: 'and',
      conditions: [
        { id: 'c1', field: 'name', operator: 'contains', value: 'a' },
        { id: 'c2', field: 'age', operator: 'eq', value: 1 },
      ],
    };
    const el = (await fixture(html`<lr-condition-builder .fields=${FIELDS} .value=${value}></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;
    const combinator = el.shadowRoot!.querySelector('[part="combinator"]') as LyraSelect;
    const promise = oneEvent(el, 'lr-input');
    setAndDispatch(combinator, 'value', 'or', 'change');
    const ev = await promise;
    expect(ev.detail.value.combinator).to.equal('or');
  });

  it('degrades gracefully when a condition references a field name no longer present', async () => {
    const value: ConditionBuilderValue = { combinator: 'and', conditions: [{ id: 'c1', field: 'ghost', operator: 'eq', value: 'x' }] };
    const el = (await fixture(html`<lr-condition-builder .fields=${FIELDS} .value=${value}></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;
    const row = conditionRow(el, 0);
    expect((row) != null).to.equal(true);
    expect((row.querySelector('[part="operator-select"]') as LyraSelect).disabled).to.be.true;
    expect(row.querySelector('[part="value"]')!.tagName.toLowerCase()).to.equal('span');
  });

  it('programmatic value/fields assignment stays silent (no lr-input)', async () => {
    const el = (await fixture(html`<lr-condition-builder></lr-condition-builder>`)) as LyraConditionBuilder;
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
    const value: ConditionBuilderValue = {
      combinator: 'and',
      conditions: [{ id: 'c1', field: 'name', operator: 'contains', value: 'a' }],
    };
    const parent = await fixture(html`<div><lr-condition-builder .fields=${FIELDS} .value=${value}></lr-condition-builder></div>`);
    const el = parent.querySelector('lr-condition-builder') as LyraConditionBuilder;
    await el.updateComplete;
    let rawInputs = 0;
    let rawChanges = 0;
    let wrapperInputs = 0;
    parent.addEventListener('input', () => rawInputs++);
    parent.addEventListener('change', () => rawChanges++);
    parent.addEventListener('lr-input', () => wrapperInputs++);

    const input = conditionRow(el, 0).querySelector('[part="value"]') as LyraInput;
    setAndDispatch(input, 'value', 'beta', 'lr-input');
    await el.updateComplete;
    const field = conditionRow(el, 0).querySelector('[part="field-select"]') as LyraSelect;
    setAndDispatch(field, 'value', 'age', 'change');

    expect(rawInputs).to.equal(0);
    expect(rawChanges).to.equal(0);
    expect(wrapperInputs).to.equal(2);
  });

  it('consumes the raw composed click event from the add/remove condition buttons before emitting its wrapper event', async () => {
    const value: ConditionBuilderValue = {
      combinator: 'and',
      conditions: [{ id: 'c1', field: 'name', operator: 'contains', value: 'a' }],
    };
    const parent = await fixture(html`<div><lr-condition-builder .fields=${FIELDS} .value=${value}></lr-condition-builder></div>`);
    const el = parent.querySelector('lr-condition-builder') as LyraConditionBuilder;
    await el.updateComplete;
    let rawClicks = 0;
    parent.addEventListener('click', () => rawClicks++);

    const removeButton = conditionRow(el, 0).querySelector('[part="remove-button"]') as HTMLElement;
    removeButton.click();
    await el.updateComplete;
    expect(rawClicks).to.equal(0);
    expect(el.value.conditions).to.have.length(0);

    const addButton = el.shadowRoot!.querySelector('[part="add-button"]') as HTMLElement;
    addButton.click();
    await el.updateComplete;
    expect(rawClicks).to.equal(0);
    expect(el.value.conditions).to.have.length(1);
  });

  it('disabled propagates to field/operator selects, value controls, and the add/remove buttons', async () => {
    const value: ConditionBuilderValue = { combinator: 'and', conditions: [{ id: 'c1', field: 'name', operator: 'contains', value: 'a' }] };
    const el = (await fixture(html`<lr-condition-builder disabled .fields=${FIELDS} .value=${value}></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;
    const row = conditionRow(el, 0);
    expect((row.querySelector('[part="field-select"]') as LyraSelect).disabled).to.be.true;
    expect((row.querySelector('[part="operator-select"]') as LyraSelect).disabled).to.be.true;
    expect((row.querySelector('[part="value"]') as LyraInput).disabled).to.be.true;
    expect((row.querySelector('[part="remove-button"]') as HTMLElement).hasAttribute('disabled')).to.be.true;
    expect((el.shadowRoot!.querySelector('[part="add-button"]') as HTMLElement).hasAttribute('disabled')).to.be.true;
  });

  it('renders the built-in English add-condition label with no locale registered', async () => {
    const el = (await fixture(html`<lr-condition-builder .fields=${FIELDS}></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="add-button"]')!.textContent).to.include('Add condition');
  });

  it('honors a .strings override for the add-condition label', async () => {
    const el = (await fixture(
      html`<lr-condition-builder .fields=${FIELDS} .strings=${{ queryBuilderAddCondition: 'Ajouter une condition' }}></lr-condition-builder>`,
    )) as LyraConditionBuilder;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="add-button"]')!.textContent).to.include('Ajouter une condition');
  });

  it('renders and functions the same under dir="rtl"', async () => {
    const value: ConditionBuilderValue = {
      combinator: 'and',
      conditions: [
        { id: 'c1', field: 'name', operator: 'contains', value: 'a' },
        { id: 'c2', field: 'age', operator: 'eq', value: 1 },
      ],
    };
    const el = (await fixture(
      html`<div dir="rtl"><lr-condition-builder .fields=${FIELDS} .value=${value}></lr-condition-builder></div>`,
    )) as HTMLElement;
    const qb = el.querySelector('lr-condition-builder') as LyraConditionBuilder;
    await qb.updateComplete;
    expect(qb.shadowRoot!.querySelectorAll('[part="condition"]').length).to.equal(2);
    expect(qb.shadowRoot!.querySelector('[part="combinator"]')).to.exist;
  });

  it('stacks a condition row into a column layout at a narrow (<=320px) allocation', async () => {
    const value: ConditionBuilderValue = { combinator: 'and', conditions: [{ id: 'c1', field: 'name', operator: 'contains', value: 'a' }] };
    const el = (await fixture(
      html`<lr-condition-builder style="inline-size: 260px" .fields=${FIELDS} .value=${value}></lr-condition-builder>`,
    )) as LyraConditionBuilder;
    await el.updateComplete;
    const row = conditionRow(el, 0);
    expect(getComputedStyle(row).flexDirection).to.equal('column');
  });

  it('contains long field and localized operator labels at exactly 320px in LTR and RTL', async () => {
    const longFieldLabel = `Field-${'unbroken'.repeat(60)}`;
    const longOperatorLabel = `Operator-${'localized'.repeat(60)}`;
    const fields: ConditionBuilderField[] = [
      { name: 'long-field', label: longFieldLabel, type: 'string', operators: ['contains'] },
    ];
    const value: ConditionBuilderValue = {
      combinator: 'and',
      conditions: [{ id: 'c1', field: 'long-field', operator: 'contains', value: 'needle' }],
    };

    for (const direction of ['ltr', 'rtl'] as const) {
      const wrapper = (await fixture(html`
        <div dir=${direction} style="inline-size: 320px; max-inline-size: 100%">
          <lr-condition-builder
            style="inline-size: 100%"
            .fields=${fields}
            .value=${value}
            .strings=${{ queryBuilderOperatorContains: longOperatorLabel }}
          ></lr-condition-builder>
        </div>
      `)) as HTMLElement;
      const el = wrapper.querySelector('lr-condition-builder') as LyraConditionBuilder;
      await el.updateComplete;
      const row = conditionRow(el, 0);

      expect(getComputedStyle(row).flexDirection, direction).to.equal('column');
      expect(wrapper.scrollWidth, `${direction} wrapper`).to.be.at.most(wrapper.clientWidth + 1);
      expect(el.scrollWidth, `${direction} host`).to.be.at.most(el.clientWidth + 1);
      expect(row.scrollWidth, `${direction} condition`).to.be.at.most(row.clientWidth + 1);
      for (const part of ['field-select', 'operator-select', 'value'] as const) {
        const control = row.querySelector(`[part="${part}"]`) as HTMLElement;
        expect(control.scrollWidth, `${direction} ${part}`).to.be.at.most(control.clientWidth + 1);
      }
    }
  });

  it('selectValue() narrows an event.target.value that widens to string[] (defensive fast-path guard)', async () => {
    const value: ConditionBuilderValue = {
      combinator: 'and',
      conditions: [{ id: 'c1', field: 'name', operator: 'contains', value: 'a' }],
    };
    const el = (await fixture(html`<lr-condition-builder .fields=${FIELDS} .value=${value}></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;
    const fieldSelect = conditionRow(el, 0).querySelector('[part="field-select"]') as LyraSelect;
    // The field-select this component renders is always single-select; force `multiple` here purely
    // to exercise selectValue()'s defensive Array.isArray narrowing of a widened event.target.value.
    fieldSelect.multiple = true;
    let promise = oneEvent(el, 'lr-input');
    setAndDispatch(fieldSelect, 'value', ['age'], 'change');
    let ev = await promise;
    expect(ev.detail.value.conditions[0].field).to.equal('age');

    promise = oneEvent(el, 'lr-input');
    setAndDispatch(fieldSelect, 'value', [], 'change');
    ev = await promise;
    expect(ev.detail.value.conditions[0].field).to.equal('');
  });

  it('assigning null to fields/value falls back to the empty defaults instead of throwing', async () => {
    const el = (await fixture(html`<lr-condition-builder .fields=${FIELDS}></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;

    (el as unknown as { fields: ConditionBuilderField[] | null }).fields = null;
    await el.updateComplete;
    expect(el.fields).to.deep.equal([]);
    expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.include('No fields available.');

    (el as unknown as { value: ConditionBuilderValue | null }).value = null;
    await el.updateComplete;
    expect(el.value).to.deep.equal({ combinator: 'and', conditions: [] });
  });

  it("defaultValueFor() resets to a type-appropriate default when the operator changes to a non-unary, non-multi one", async () => {
    const value: ConditionBuilderValue = {
      combinator: 'and',
      conditions: [
        { id: 'c-name', field: 'name', operator: 'isEmpty' },
        { id: 'c-age', field: 'age', operator: 'isEmpty' },
        { id: 'c-active', field: 'active', operator: 'eq', value: true },
        { id: 'c-date', field: 'createdAt', operator: 'isEmpty' },
      ],
    };
    const el = (await fixture(html`<lr-condition-builder .fields=${FIELDS} .value=${value}></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;

    // string field -> ''
    let opSelect = conditionRow(el, 0).querySelector('[part="operator-select"]') as LyraSelect;
    let promise = oneEvent(el, 'lr-input');
    setAndDispatch(opSelect, 'value', 'eq', 'change');
    let ev = await promise;
    expect(ev.detail.value.conditions[0].value).to.equal('');
    await el.updateComplete;

    // number field -> undefined
    opSelect = conditionRow(el, 1).querySelector('[part="operator-select"]') as LyraSelect;
    promise = oneEvent(el, 'lr-input');
    setAndDispatch(opSelect, 'value', 'gt', 'change');
    ev = await promise;
    expect(ev.detail.value.conditions[1].value).to.be.undefined;
    await el.updateComplete;

    // boolean field -> undefined
    opSelect = conditionRow(el, 2).querySelector('[part="operator-select"]') as LyraSelect;
    promise = oneEvent(el, 'lr-input');
    setAndDispatch(opSelect, 'value', 'neq', 'change');
    ev = await promise;
    expect(ev.detail.value.conditions[2].value).to.be.undefined;
    await el.updateComplete;

    // date field -> '' (same fallback as string; neither number nor boolean)
    opSelect = conditionRow(el, 3).querySelector('[part="operator-select"]') as LyraSelect;
    promise = oneEvent(el, 'lr-input');
    setAndDispatch(opSelect, 'value', 'gte', 'change');
    ev = await promise;
    expect(ev.detail.value.conditions[3].value).to.equal('');
  });

  it('every mutating action no-ops while disabled (addCondition, removeCondition, and each per-condition setter)', async () => {
    const value: ConditionBuilderValue = {
      combinator: 'and',
      conditions: [
        { id: 'c1', field: 'name', operator: 'contains', value: 'a' },
        { id: 'c2', field: 'age', operator: 'eq', value: 1 },
      ],
    };
    const el = (await fixture(
      html`<lr-condition-builder disabled .fields=${FIELDS} .value=${value}></lr-condition-builder>`,
    )) as LyraConditionBuilder;
    await el.updateComplete;
    let fired = false;
    el.addEventListener('lr-input', () => {
      fired = true;
    });
    el.addEventListener('lr-add-condition', () => {
      fired = true;
    });
    el.addEventListener('lr-remove-condition', () => {
      fired = true;
    });

    el.addCondition();
    expect(el.value.conditions.length).to.equal(2);

    el.removeCondition('c1');
    expect(el.value.conditions.length).to.equal(2);

    const fieldSelect = conditionRow(el, 0).querySelector('[part="field-select"]') as LyraSelect;
    setAndDispatch(fieldSelect, 'value', 'age', 'change');
    expect(el.value.conditions[0].field).to.equal('name');

    const opSelect = conditionRow(el, 0).querySelector('[part="operator-select"]') as LyraSelect;
    setAndDispatch(opSelect, 'value', 'isEmpty', 'change');
    expect(el.value.conditions[0].operator).to.equal('contains');

    const valueInput = conditionRow(el, 0).querySelector('[part="value"]') as LyraInput;
    setAndDispatch(valueInput, 'value', 'zzz', 'lr-input');
    expect(el.value.conditions[0].value).to.equal('a');

    const combinator = el.shadowRoot!.querySelector('[part="combinator"]') as LyraSelect;
    setAndDispatch(combinator, 'value', 'or', 'change');
    expect(el.value.combinator).to.equal('and');

    await el.updateComplete;
    expect(fired).to.be.false;
  });

  it('removeCondition() no-ops for an id that is not present', async () => {
    const value: ConditionBuilderValue = {
      combinator: 'and',
      conditions: [{ id: 'c1', field: 'name', operator: 'contains', value: 'a' }],
    };
    const el = (await fixture(html`<lr-condition-builder .fields=${FIELDS} .value=${value}></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;
    let fired = false;
    el.addEventListener('lr-remove-condition', () => {
      fired = true;
    });
    el.addEventListener('lr-input', () => {
      fired = true;
    });
    el.removeCondition('does-not-exist');
    expect(el.value.conditions.length).to.equal(1);
    expect(fired).to.be.false;
  });

  it('setting the combinator to its current value no-ops (no commit, no lr-input)', async () => {
    const value: ConditionBuilderValue = {
      combinator: 'and',
      conditions: [
        { id: 'c1', field: 'name', operator: 'contains', value: 'a' },
        { id: 'c2', field: 'age', operator: 'eq', value: 1 },
      ],
    };
    const el = (await fixture(html`<lr-condition-builder .fields=${FIELDS} .value=${value}></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;
    const combinator = el.shadowRoot!.querySelector('[part="combinator"]') as LyraSelect;
    let fired = false;
    el.addEventListener('lr-input', () => {
      fired = true;
    });
    setAndDispatch(combinator, 'value', 'and', 'change');
    expect(el.value.combinator).to.equal('and');
    expect(fired).to.be.false;
  });

  it('conditionElement() falls back to null when shadowRoot is unavailable (defensive guard)', async () => {
    const value: ConditionBuilderValue = {
      combinator: 'and',
      conditions: [{ id: 'c1', field: 'name', operator: 'contains', value: 'a' }],
    };
    const el = (await fixture(html`<lr-condition-builder .fields=${FIELDS} .value=${value}></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;
    const originalDescriptor = Object.getOwnPropertyDescriptor(el, 'shadowRoot');
    Object.defineProperty(el, 'shadowRoot', { configurable: true, get: () => null });
    try {
      const removePromise = oneEvent(el, 'lr-remove-condition');
      el.removeCondition('c1');
      await removePromise;
      expect(el.value.conditions.length).to.equal(0);
    } finally {
      if (originalDescriptor) Object.defineProperty(el, 'shadowRoot', originalDescriptor);
      else Reflect.deleteProperty(el, 'shadowRoot');
    }
  });

  it('removeCondition() tolerates a condition whose DOM row is already gone', async () => {
    const value: ConditionBuilderValue = {
      combinator: 'and',
      conditions: [{ id: 'c1', field: 'name', operator: 'contains', value: 'a' }],
    };
    const el = (await fixture(html`<lr-condition-builder .fields=${FIELDS} .value=${value}></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;
    conditionRow(el, 0).remove();
    const removePromise = oneEvent(el, 'lr-remove-condition');
    el.removeCondition('c1');
    await removePromise;
    expect(el.value.conditions.length).to.equal(0);
  });

  it('renders an empty multi-select when a stored value is not an array (defensive fallback)', async () => {
    const value: ConditionBuilderValue = { combinator: 'and', conditions: [{ id: 'c1', field: 'status', operator: 'in' }] };
    const el = (await fixture(html`<lr-condition-builder .fields=${FIELDS} .value=${value}></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;
    const combobox = conditionRow(el, 0).querySelector('[part="value"]') as LyraCombobox;
    expect(combobox.tagName.toLowerCase()).to.equal('lr-combobox');
    expect(combobox.value).to.deep.equal([]);
  });

  it('changing the multi-select (in/notIn) value control commits the new array and emits lr-input', async () => {
    const value: ConditionBuilderValue = {
      combinator: 'and',
      conditions: [{ id: 'c1', field: 'status', operator: 'in', value: ['open'] }],
    };
    const el = (await fixture(html`<lr-condition-builder .fields=${FIELDS} .value=${value}></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;
    const combobox = conditionRow(el, 0).querySelector('[part="value"]') as LyraCombobox;
    const promise = oneEvent(el, 'lr-input');
    setAndDispatch(combobox, 'value', ['open', 'closed'], 'change');
    const ev = await promise;
    expect(ev.detail.value.conditions[0].value).to.deep.equal(['open', 'closed']);
  });

  it('renders no options (rather than throwing) for an enum field with no options list, in both single- and multi-select value controls', async () => {
    const fields: ConditionBuilderField[] = [{ name: 'tag', label: 'Tag', type: 'enum' }];
    const value: ConditionBuilderValue = {
      combinator: 'and',
      conditions: [
        { id: 'c-eq', field: 'tag', operator: 'eq' },
        { id: 'c-in', field: 'tag', operator: 'in' },
      ],
    };
    const el = (await fixture(html`<lr-condition-builder .fields=${fields} .value=${value}></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;
    const eqControl = conditionRow(el, 0).querySelector('[part="value"]') as LyraSelect;
    const inControl = conditionRow(el, 1).querySelector('[part="value"]') as LyraCombobox;
    expect(eqControl.querySelectorAll('lr-option').length).to.equal(0);
    expect(inControl.querySelectorAll('lr-option').length).to.equal(0);
  });

  it("falls back to an option's value as its label when the field omits one, in both single- and multi-select value controls", async () => {
    const fields: ConditionBuilderField[] = [
      {
        name: 'priority',
        label: 'Priority',
        type: 'enum',
        options: [{ value: 'low' }, { value: 'high', label: 'High' }],
      },
    ];
    const value: ConditionBuilderValue = {
      combinator: 'and',
      conditions: [
        { id: 'c-eq', field: 'priority', operator: 'eq' },
        { id: 'c-in', field: 'priority', operator: 'in' },
      ],
    };
    const el = (await fixture(html`<lr-condition-builder .fields=${fields} .value=${value}></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;
    const eqControl = conditionRow(el, 0).querySelector('[part="value"]') as LyraSelect;
    const inControl = conditionRow(el, 1).querySelector('[part="value"]') as LyraCombobox;
    const eqOptionLabels = [...eqControl.querySelectorAll('lr-option')].map((o) => o.textContent?.trim());
    const inOptionLabels = [...inControl.querySelectorAll('lr-option')].map((o) => o.textContent?.trim());
    expect(eqOptionLabels).to.deep.equal(['low', 'High']);
    expect(inOptionLabels).to.deep.equal(['low', 'High']);
  });

  it('a date condition with no value yet renders an empty date-input, and changing it commits and emits lr-input', async () => {
    const value: ConditionBuilderValue = { combinator: 'and', conditions: [{ id: 'c1', field: 'createdAt', operator: 'gte' }] };
    const el = (await fixture(html`<lr-condition-builder .fields=${FIELDS} .value=${value}></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;
    const dateInput = conditionRow(el, 0).querySelector('[part="value"]') as LyraDateInput;
    expect(dateInput.value).to.equal('');
    const promise = oneEvent(el, 'lr-input');
    setAndDispatch(dateInput, 'value', '2026-03-03', 'change');
    const ev = await promise;
    expect(ev.detail.value.conditions[0].value).to.equal('2026-03-03');
  });

  it('an enum condition with no value yet renders an empty select, and changing it commits and emits lr-input', async () => {
    const value: ConditionBuilderValue = { combinator: 'and', conditions: [{ id: 'c1', field: 'status', operator: 'eq' }] };
    const el = (await fixture(html`<lr-condition-builder .fields=${FIELDS} .value=${value}></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;
    const select = conditionRow(el, 0).querySelector('[part="value"]') as LyraSelect;
    expect(select.value).to.equal('');
    const promise = oneEvent(el, 'lr-input');
    setAndDispatch(select, 'value', 'closed', 'change');
    const ev = await promise;
    expect(ev.detail.value.conditions[0].value).to.equal('closed');
  });

  it('a non-numeric number-field value commits undefined rather than NaN', async () => {
    const value: ConditionBuilderValue = { combinator: 'and', conditions: [{ id: 'c1', field: 'age', operator: 'eq', value: 5 }] };
    const el = (await fixture(html`<lr-condition-builder .fields=${FIELDS} .value=${value}></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;
    const input = conditionRow(el, 0).querySelector('[part="value"]') as LyraInput;
    const promise = oneEvent(el, 'lr-input');
    setAndDispatch(input, 'value', 'not-a-number', 'lr-input');
    const ev = await promise;
    expect(ev.detail.value.conditions[0].value).to.be.undefined;
  });

  it('commits undefined for positive and negative numeric overflow strings', async () => {
    const value: ConditionBuilderValue = { combinator: 'and', conditions: [{ id: 'c1', field: 'age', operator: 'eq', value: 5 }] };
    const el = (await fixture(html`<lr-condition-builder .fields=${FIELDS} .value=${value}></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;
    const input = conditionRow(el, 0).querySelector('[part="value"]') as LyraInput;
    for (const raw of ['1e309', '-1e309']) {
      const promise = oneEvent(el, 'lr-input');
      setAndDispatch(input, 'value', raw, 'lr-input');
      const event = await promise;
      expect(event.detail.value.conditions[0].value, `${raw} cannot enter the query model`).to.be.undefined;
    }
  });

  it('is accessible (empty state)', async () => {
    const el = (await fixture(html`<lr-condition-builder .fields=${FIELDS}></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it('is accessible with populated rows spanning every field type, including a unary and a multi operator', async () => {
    const value: ConditionBuilderValue = {
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
    const el = (await fixture(html`<lr-condition-builder .fields=${FIELDS} .value=${value}></lr-condition-builder>`)) as LyraConditionBuilder;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="condition"]').length).to.equal(6);
    expect(el.shadowRoot!.querySelector('[part="combinator"]')).to.exist;
    await expect(el).to.be.accessible();
  });
});
