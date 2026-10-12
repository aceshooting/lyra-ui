import { expect, fixture, html } from '@open-wc/testing';
import type { TemplateResult } from 'lit';
import './graph-query-builder.js';
import type { LyraGraphQueryBuilder, GraphQueryTypeOption } from './graph-query-builder.js';
import { measureArrayMembership } from '../../../../test/array-membership-cost.js';

type TypeRendering = {
  renderTypeFilter(kind: 'relationship' | 'node-type', options: readonly GraphQueryTypeOption[], selected: readonly string[], add: (type: string) => void, remove: (type: string) => void, disabled: boolean): TemplateResult;
};

it('projects available types and selected labels with linear lookup work', async () => {
  const builder = await fixture<LyraGraphQueryBuilder>(html`<lr-graph-query-builder></lr-graph-query-builder>`);
  const values = Array.from({ length: 96 }, (_, index) => `type-cost-${index}`);
  let reads = 0;
  const options: GraphQueryTypeOption[] = values.map((value, index) => ({
    get value() { reads++; return value; },
    label: `Type ${index}`,
  }));
  const selected = values.filter((_value, index) => index % 2 === 0).reverse();
  const internal = builder as unknown as TypeRendering;
  const measured = measureArrayMembership('type-cost-', () =>
    internal.renderTypeFilter('relationship', options, selected, () => {}, () => {}, false));
  const optionReads = reads;
  const rendered = await fixture<HTMLElement>(html`<div>${measured.value}</div>`);
  const available = [...rendered.querySelectorAll('[part="relationship-picker"] > lr-option')];
  const chips = [...rendered.querySelectorAll('[part="relationship-chips"] > lr-chip')];
  expect(available.map((option) => option.getAttribute('value'))).to.deep.equal(values.filter((_value, index) => index % 2 !== 0));
  expect(chips.map((chip) => chip.getAttribute('value'))).to.deep.equal(selected);
  expect(chips.map((chip) => chip.textContent?.trim())).to.deep.equal(selected.map((value) => `Type ${values.indexOf(value)}`));
  expect(optionReads).to.be.at.most(values.length * 4);
  expect(measured.comparisons).to.be.at.most(values.length * 2);
});

it('retains canonical first type labels, unknown chips and selected order', async () => {
  const builder = await fixture<LyraGraphQueryBuilder>(html`<lr-graph-query-builder></lr-graph-query-builder>`);
  const options: GraphQueryTypeOption[] = [
    { value: 'same', label: 'First' }, { value: 'same', label: 'Later' },
    { value: 'raw' }, { value: 'raw', label: 'Unused' }, { value: 'available', label: 'Available' },
  ];
  const selected = ['same', 'missing', 'raw', 'same'];
  builder.nodeTypeOptions = options;
  builder.value = { startId: 'start', endId: '', relationshipTypes: [], nodeTypes: selected, direction: 'both', minHops: 1, maxHops: 1 };
  await builder.updateComplete;
  const chips = [...builder.shadowRoot!.querySelectorAll('[part="node-type-chips"] > lr-chip')];
  expect(chips.map((chip) => chip.textContent?.trim())).to.deep.equal(['First', 'missing', 'raw']);
  expect(builder.value.nodeTypes).to.deep.equal(['same', 'missing', 'raw']);
  expect([...builder.shadowRoot!.querySelectorAll('[part="node-type-picker"] > lr-option')].map((option) => option.getAttribute('value'))).to.deep.equal(['available']);
});
