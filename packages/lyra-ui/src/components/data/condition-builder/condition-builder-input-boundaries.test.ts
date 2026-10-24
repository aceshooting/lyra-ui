import { expect, fixture, html } from '@open-wc/testing';
import './condition-builder.js';
import type { ConditionBuilderField, ConditionBuilderValue, LyraConditionBuilder } from './condition-builder.js';

function conditionRow(el: LyraConditionBuilder, index: number): HTMLElement {
  return el.shadowRoot!.querySelectorAll('[part="condition"]')[index] as HTMLElement;
}

describe('lr-condition-builder untrusted field input', () => {
  it('keeps only record fields that carry a distinct, non-blank name and a known type', async () => {
    const el = await fixture<LyraConditionBuilder>(html`<lr-condition-builder></lr-condition-builder>`);
    el.fields = [
      null, 4, [], 'text',
      { name: 'ok', type: 'string' },
      { name: '   ', type: 'string' },
      { name: 'dup', type: 'string' },
      { name: 'dup', type: 'number' },
      { name: 'unknown', type: 'bogus' },
    ] as unknown as readonly ConditionBuilderField[];
    expect(el.fields.map((field) => [field.name, field.type])).to.deep.equal([['ok', 'string'], ['dup', 'string']]);
  });

  it('ignores a non-positive step and an operator list without any known operator', async () => {
    const el = await fixture<LyraConditionBuilder>(html`<lr-condition-builder></lr-condition-builder>`);
    el.fields = [
      { name: 'zero', type: 'number', step: 0 },
      { name: 'negative', type: 'number', step: -2 },
      { name: 'valid', type: 'number', step: 5 },
      { name: 'unknownOperators', type: 'string', operators: ['bogus', 'nonsense'] },
      { name: 'mixedOperators', type: 'string', operators: ['bogus', 'eq', 'eq', 'neq'] },
    ] as unknown as readonly ConditionBuilderField[];
    const byName = (name: string) => el.fields.find((field) => field.name === name)!;
    expect(byName('zero').step).to.equal(undefined);
    expect(byName('negative').step).to.equal(undefined);
    expect(byName('valid').step).to.equal(5);
    expect(byName('unknownOperators').operators).to.equal(undefined);
    expect(byName('mixedOperators').operators).to.deep.equal(['eq', 'neq']);
  });
});

describe('lr-condition-builder untrusted value input', () => {
  it('keeps only record conditions with a distinct, non-blank id', async () => {
    const el = await fixture<LyraConditionBuilder>(html`<lr-condition-builder></lr-condition-builder>`);
    el.value = {
      combinator: 'or',
      conditions: [
        null, 3, [], 'text',
        { id: 'first', field: 'name', operator: 'eq', value: 'x' },
        { id: '   ', field: 'name', operator: 'eq', value: 'y' },
        { id: 'first', field: 'name', operator: 'eq', value: 'z' },
        { id: 'second', field: 'name', operator: 'neq', value: 'w' },
      ],
    } as unknown as ConditionBuilderValue;
    expect(el.value.combinator).to.equal('or');
    expect(el.value.conditions.map((condition) => condition.id)).to.deep.equal(['first', 'second']);
  });

  it('flags a text, date or enum field whose value is not text and focuses the first offending row', async () => {
    const fields: ConditionBuilderField[] = [
      { name: 'title', type: 'string' },
      { name: 'created', type: 'date' },
      { name: 'status', type: 'enum', options: [{ value: 'open', label: 'Open' }] },
    ];
    const value = {
      combinator: 'and',
      conditions: [
        { id: 'text', field: 'title', operator: 'eq', value: 5 },
        { id: 'day', field: 'created', operator: 'eq', value: true },
        { id: 'choice', field: 'status', operator: 'eq', value: 3 },
        { id: 'fine', field: 'title', operator: 'eq', value: 'plain' },
      ],
    } as unknown as ConditionBuilderValue;
    const el = await fixture<LyraConditionBuilder>(html`<lr-condition-builder .fields=${fields} .value=${value}></lr-condition-builder>`);
    await el.updateComplete;
    expect(el.validationIssues).to.deep.equal([
      { conditionId: 'text', code: 'value-type' },
      { conditionId: 'day', code: 'value-type' },
      { conditionId: 'choice', code: 'value-type' },
    ]);
    expect(el.reportValidity()).to.equal(false);
    const active = el.shadowRoot!.activeElement;
    expect(active !== null && conditionRow(el, 0).contains(active)).to.equal(true);
    el.value = { combinator: 'and', conditions: [{ id: 'fine', field: 'title', operator: 'eq', value: 'plain' }] };
    await el.updateComplete;
    expect(el.checkValidity()).to.equal(true);
  });

  it('focuses the operator control when the offending value belongs to an operator that takes none', async () => {
    const fields: ConditionBuilderField[] = [{ name: 'title', type: 'string' }];
    const value: ConditionBuilderValue = {
      combinator: 'and',
      conditions: [{ id: 'unary', field: 'title', operator: 'isEmpty', value: 'unexpected' }],
    };
    const el = await fixture<LyraConditionBuilder>(html`<lr-condition-builder .fields=${fields} .value=${value}></lr-condition-builder>`);
    await el.updateComplete;
    expect(el.validationIssues).to.deep.equal([{ conditionId: 'unary', code: 'operator-arity' }]);
    expect(el.reportValidity()).to.equal(false);
    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('operator-select');
  });
});
