import { expect, fixture, html } from '@open-wc/testing';
import './condition-builder.js';
import type { LyraConditionBuilder } from './condition-builder.class.js';

it('registers optional value editors only when a row needs them', async () => {
  const builder = await fixture<LyraConditionBuilder>(html`<lr-condition-builder .fields=${[
    { name: 'flag', label: 'Flag', type: 'boolean' },
    { name: 'text', label: 'Text', type: 'string' },
    { name: 'date', label: 'Date', type: 'date' },
    { name: 'enum', label: 'Enum', type: 'enum', options: [{ value: 'a', label: 'Alpha' }] },
  ]}></lr-condition-builder>`);
  const choose = async (field: string, operator: 'eq' | 'in', value: string | string[] | boolean) => {
    builder.value = { combinator: 'and', conditions: [{ id: 'row', field, operator, value }] };
    await builder.updateComplete;
    return builder.shadowRoot!.querySelector('[part="value"]');
  };
  expect((await choose('flag', 'eq', true))?.localName).to.equal('lr-select');
  expect(['lr-input', 'lr-date-input', 'lr-combobox'].map(name => Boolean(customElements.get(name))))
    .to.deep.equal([false, false, false]);
  for (const [field, operator, value, tag] of [
    ['text', 'eq', 'Hello', 'lr-input'],
    ['date', 'eq', '2026-01-01', 'lr-date-input'],
    ['enum', 'in', ['a'], 'lr-combobox'],
  ] as const) {
    const editor = await choose(field, operator, typeof value === 'string' ? value : [...value]);
    const Editor = customElements.get(tag);
    expect(Boolean(Editor && editor instanceof Editor)).to.equal(true);
    expect(editor?.localName).to.equal(tag);
    expect((editor as Element & { value: unknown }).value).to.deep.equal(value);
  }
});
