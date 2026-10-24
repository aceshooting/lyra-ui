import { expect, html } from '@open-wc/testing';
import './data-grid.js';
import type { DataGridColumn, DataGridKey } from './data-grid-types.js';
import { type Person, columns, dataGrid, rows } from '../../../../test/data-grid.js';

describe('lr-data-grid untrusted column input', () => {
  it('admits a column with an own undefined member or a numeric undefined-sort policy and drops unusable ones', async () => {
    const grid = await dataGrid(html`<lr-data-grid label="People" .data=${rows}></lr-data-grid>`);
    grid.columns = [
      { field: 'name', label: undefined },
      { field: 'team', sortUndefined: 1 },
      { field: 'score', sortUndefined: -1 },
      { id: 'policy', field: 'id', sortUndefined: 0 },
      { field: 5 },
      { id: '   ', field: 'name' },
      null,
      'name',
      [],
    ] as unknown as DataGridColumn<Person>[];
    const admitted = grid.columns;
    expect(admitted.map((column) => column.id ?? column.field)).to.deep.equal(['name', 'team', 'score', 'policy']);
    expect(admitted[0]!.label).to.equal(undefined);
    expect(admitted[1]!.sortUndefined).to.equal(1);
    expect(admitted[2]!.sortUndefined).to.equal(-1);
    expect(admitted[3]!.sortUndefined, 'an unknown policy is dropped while the column stays').to.equal(undefined);
  });

  it('treats columns that are not a list as no columns and recovers when a list is assigned', async () => {
    const grid = await dataGrid(html`<lr-data-grid label="People" .columns=${columns} .data=${rows}></lr-data-grid>`);
    expect(grid.columns.length).to.equal(columns.length);
    for (const value of [null, 5, 'name', { length: 1, 0: { field: 'name' } }]) {
      grid.columns = value as unknown as DataGridColumn<Person>[];
      expect(grid.columns.length, String(value)).to.equal(0);
    }
    grid.columns = columns;
    expect(grid.columns.length).to.equal(columns.length);
  });
});

describe('lr-data-grid selected key snapshots', () => {
  it('reads keys from any iterable, skipping unusable ones, and clears them for a value that is not iterable', async () => {
    const grid = await dataGrid(html`<lr-data-grid label="People" .columns=${columns} .data=${rows}></lr-data-grid>`);
    grid.selectedRowKeys = new Set<unknown>([2, 'x', 2, '', '   ', Number.NaN, null, {}]) as unknown as DataGridKey[];
    expect([...grid.selectedRowKeys]).to.deep.equal([2, 'x']);
    for (const value of [5, null, undefined, {}, 'text']) {
      grid.selectedRowKeys = [2, 'x'];
      expect([...grid.selectedRowKeys], 'primed').to.deep.equal([2, 'x']);
      grid.selectedRowKeys = value as unknown as DataGridKey[];
      expect([...grid.selectedRowKeys], String(value)).to.deep.equal([]);
    }
  });
});
