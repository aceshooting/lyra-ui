import { expect, fixture, html } from '@open-wc/testing';
import type { TemplateResult } from 'lit';
import './filter-bar.js';
import type { LyraFilterBar, LyraFilterBarCheckboxMenuDefinition, LyraFilterBarFieldValue, LyraFilterBarFilterDefinition } from './filter-bar.js';
import { getListFormat } from '../../../internal/intl-cache.js';
import { measureArrayMembership } from '../../../../test/array-membership-cost.js';

type ChoiceRendering = {
  effectiveLocale: string;
  displayValueFor(definition: LyraFilterBarFilterDefinition, value: LyraFilterBarFieldValue): string;
  renderCheckboxMenu(definition: LyraFilterBarCheckboxMenuDefinition, value: LyraFilterBarFieldValue, error: string): TemplateResult;
};

it('resolves a multiple-choice summary with linear option reads in selected order', async () => {
  const bar = await fixture<LyraFilterBar>(html`<lr-filter-bar></lr-filter-bar>`);
  const internal = bar as unknown as ChoiceRendering;
  const values = Array.from({ length: 128 }, (_, index) => `summary-cost-${index}`);
  let reads = 0;
  const definition: LyraFilterBarCheckboxMenuDefinition = {
    filterId: 'choices', label: 'Choices', type: 'checkbox-menu',
    options: values.map((value, index) => ({
      get value() { reads++; return value; },
      label: `Choice ${index}`,
    })),
  };
  const selected = [...values].reverse();
  const result = internal.displayValueFor(definition, selected);
  const expected = getListFormat(internal.effectiveLocale, { style: 'long', type: 'conjunction' })
    .format(values.map((_value, index) => `Choice ${index}`).reverse());
  expect(result).to.equal(expected);
  expect(reads).to.be.at.most(values.length * 2);
});

it('keeps first option labels, repeated selections and unmatched raw values in summaries', async () => {
  const bar = await fixture<LyraFilterBar>(html`<lr-filter-bar></lr-filter-bar>`);
  const internal = bar as unknown as ChoiceRendering;
  const definition: LyraFilterBarCheckboxMenuDefinition = {
    filterId: 'choices', label: 'Choices', type: 'checkbox-menu',
    options: [{ value: 'same', label: 'First' }, { value: 'same', label: 'Later' }, { value: '', label: 'Empty' }],
  };
  const expected = getListFormat(internal.effectiveLocale, { style: 'long', type: 'conjunction' })
    .format(['First', 'missing', 'First', 'Empty']);
  expect(internal.displayValueFor(definition, ['same', 'missing', 'same', ''])).to.equal(expected);
  expect(internal.displayValueFor(definition, 'same')).to.equal('First');
  expect(internal.displayValueFor(definition, [])).to.equal('');
});

it('projects checkbox-menu selection without searching the selected list per option', async () => {
  const bar = await fixture<LyraFilterBar>(html`<lr-filter-bar></lr-filter-bar>`);
  const internal = bar as unknown as ChoiceRendering;
  const values = Array.from({ length: 96 }, (_, index) => `menu-cost-${index}`);
  const definition: LyraFilterBarCheckboxMenuDefinition = {
    filterId: 'choices', label: 'Choices', type: 'checkbox-menu',
    options: values.map((value, index) => ({ value, label: `Choice ${index}` })),
  };
  const selected = values.filter((_value, index) => index % 2 === 0).reverse();
  const measured = measureArrayMembership('menu-cost-', () => internal.renderCheckboxMenu(definition, selected, ''));
  const rendered = await fixture<HTMLElement>(html`<div>${measured.value}</div>`);
  const options = [...rendered.querySelectorAll('[part="filter-control-option"]')];
  expect(options.map((option) => option.getAttribute('value'))).to.deep.equal(values);
  expect(options.map((option) => option.hasAttribute('checked'))).to.deep.equal(values.map((_value, index) => index % 2 === 0));
  expect(measured.comparisons).to.be.at.most(values.length * 2);
});
