import { expect, html } from '@open-wc/testing';
import { columns, dataGrid, rows, type Person } from '../../../../test/data-grid.js';
import type { DataGridColumn, DataGridFilter } from './data-grid-types.js';
import './data-grid.js';

it('exports nested filter values as detached frozen JSON-safe state and restores normal rendering', async () => {
  const element = await dataGrid(html`<lr-data-grid label="People" .columns=${columns} .data=${rows}></lr-data-grid>`);
  const value = { count: 9007199254740993n, range: [Infinity, -Infinity, NaN], tags: new Set(['Compiler', 'Runtime']), absent: undefined };
  element.filters = [{ id: 'team', value }];
  const state = element.getState();
  element.filters = [];
  await element.updateComplete;
  value.range[0] = 7;
  value.tags.add('Later');
  const expected = [{ id: 'team', value: { count: '9007199254740993', range: [null, null, null], tags: ['Compiler', 'Runtime'] } }];
  expect(state.filters).to.deep.equal(expected);
  expect(JSON.parse(JSON.stringify(state)).filters).to.deep.equal(expected);
  const snapshot = state.filters?.[0]?.value;
  expect(Object.isFrozen(snapshot)).to.equal(true);
  expect(snapshot !== null && typeof snapshot === 'object' && Object.isFrozen(Reflect.get(snapshot, 'range'))).to.equal(true);
  expect(snapshot !== null && typeof snapshot === 'object' && Object.isFrozen(Reflect.get(snapshot, 'tags'))).to.equal(true);
  expect(element.filteredCount).to.equal(rows.length);
  expect(element.shadowRoot!.textContent).to.include('Ada');
});

it('serializes an unset controlled filter as null without retaining an undefined object member', async () => {
  const element = await dataGrid(html`<lr-data-grid label="People" .columns=${columns} .data=${rows}></lr-data-grid>`);
  element.filters = [{ id: 'team', value: undefined }];
  const state = element.getState();
  expect(state.filters).to.deep.equal([{ id: 'team', value: null }]);
  element.setState(state);
  await element.updateComplete;
  expect(element.getState().filters).to.deep.equal([{ id: 'team', value: null }]);
  expect(element.filteredCount).to.equal(rows.length);
  expect(element.shadowRoot!.textContent).to.include('Grace');
});

it('applies scalar, array, and changed-column controlled filters while preserving equal-value snapshots', async () => {
  const filterColumns: DataGridColumn<Person>[] = [{ field: 'name', filterType: 'set' }, { field: 'team', filterType: 'set' }];
  const element = await dataGrid(html`<lr-data-grid label="People" .columns=${filterColumns} .data=${rows}></lr-data-grid>`);
  for (const [filters, names] of [
    [[{ id: 'name', value: 'Ada' }], ['Ada']],
    [[{ id: 'name', value: ['Lin', 'Grace'] }], ['Lin', 'Grace']],
    [[{ id: 'name', value: 'Grace' }], ['Grace']],
    [[{ id: 'team', value: 'Compiler' }], ['Ada', 'Grace']],
  ] as const) {
    element.filters = filters;
    await element.updateComplete;
    expect(element.filteredCount).to.equal(names.length);
    const rendered = [...element.shadowRoot!.querySelectorAll('[part~="row"]')].map(row => row.textContent ?? '');
    expect(rendered.length).to.equal(names.length);
    for (const name of names) expect(rendered.some(text => text.includes(name))).to.equal(true);
    const held = element.filters;
    element.filters = filters.map(filter => ({ ...filter })) as readonly DataGridFilter[];
    expect(element.filters === held).to.equal(true);
    expect(element.getState().filters).to.deep.equal(filters);
  }
});
