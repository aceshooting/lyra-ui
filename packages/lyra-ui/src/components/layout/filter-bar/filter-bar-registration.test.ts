import { expect, fixture, html } from '@open-wc/testing';
import './filter-bar.js';
import type { LyraFilterBar, LyraFilterBarFilterDefinition } from './filter-bar.class.js';

const defined = (names: readonly string[]) => names.map(name => Boolean(customElements.get(name)));

it('registers each filter control only when a bar first renders its filter type', async () => {
  const optional = ['lr-select', 'lr-combobox', 'lr-date-input', 'lr-input', 'lr-dropdown', 'lr-spinner'];
  const bar = await fixture<LyraFilterBar>(html`<lr-filter-bar></lr-filter-bar>`);
  expect(defined(['lr-button', 'lr-chip', 'lr-chip-group'])).to.deep.equal([true, true, true]);
  expect(defined(optional)).to.deep.equal([false, false, false, false, false, false]);
  const steps: readonly [LyraFilterBarFilterDefinition, string][] = [
    [{ filterId: 'q', label: 'Search', type: 'text' }, 'lr-input'],
    [{ filterId: 's', label: 'State', type: 'select', options: [{ value: 'a', label: 'A' }] }, 'lr-select'],
    [{ filterId: 'c', label: 'Tags', type: 'combobox', options: [{ value: 'a', label: 'A' }] }, 'lr-combobox'],
    [{ filterId: 'd', label: 'Day', type: 'date' }, 'lr-date-input'],
  ];
  const filters: LyraFilterBarFilterDefinition[] = [];
  for (const [filter, tag] of steps) {
    filters.push(filter);
    bar.filters = [...filters];
    await bar.updateComplete;
    const control = bar.shadowRoot!.querySelector(`${tag}[data-filter-id="${filter.filterId}"]`) ?? bar.shadowRoot!.querySelector(tag);
    const Control = customElements.get(tag);
    expect(Boolean(Control && control instanceof Control), tag).to.equal(true);
  }
  expect(defined(['lr-dropdown', 'lr-spinner'])).to.deep.equal([false, false]);
  bar.loading = true;
  await bar.updateComplete;
  expect(Boolean(customElements.get('lr-spinner'))).to.equal(true);
});
