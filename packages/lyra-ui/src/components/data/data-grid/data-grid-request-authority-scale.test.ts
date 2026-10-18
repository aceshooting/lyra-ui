import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './data-grid.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import type { LyraDataGrid } from './data-grid.js';
import type { DataGridRequest, DataGridResponse } from './data-grid-types.js';

it('revokes an obsolete request before its debounced replacement starts', async () => {
  const pending: { request: DataGridRequest; resolve(value: DataGridResponse): void }[] = [];
  const grid = await fixture<LyraDataGrid>(html`<lr-data-grid label="Records" paginate .filterDebounce=${20}
    .columns=${[{ id: 'id', field: 'id' }]}
    .dataSource=${(request: DataGridRequest) => new Promise<DataGridResponse>(resolve => pending.push({ request, resolve }))}
  ></lr-data-grid>`);
  await waitUntil(() => pending.length === 1);
  grid.filterDebounce = 100;
  grid.searchTerm = 'new query';
  await grid.updateComplete;
  const old = pending[0]!;
  old.resolve({ rows: [{ id: 'obsolete' }], total: 1000000 });
  await new Promise(resolve => setTimeout(resolve, 20));
  await grid.updateComplete;
  expect(old.request.signal!.aborted).to.equal(true);
  expect(grid.data.some(row => row['id'] === 'obsolete')).to.equal(false);
  await waitUntil(() => pending.length === 2);
  expect(pending[1]!.request.search).to.equal('new query');
  pending[1]!.resolve({ rows: [{ id: 'current' }], total: 1000000 });
  await waitUntil(() => grid.data[0]?.['id'] === 'current');
  expect(grid.loading).to.equal(false);
});

it('accepts only the replacement loader and aborts work on disconnect', async () => {
  const pending: { request: DataGridRequest; resolve(value: DataGridResponse): void }[] = [];
  const loader = (request: DataGridRequest) => new Promise<DataGridResponse>(resolve => pending.push({ request, resolve }));
  const grid = await fixture<LyraDataGrid>(html`<lr-data-grid label="Records" paginate .dataSource=${loader} .columns=${[{ field: 'id' }]}></lr-data-grid>`);
  await waitUntil(() => pending.length === 1);
  grid.dataSource = async () => ({ rows: [{ id: 'current' }], total: 1000000 });
  await waitUntil(() => grid.data[0]?.['id'] === 'current');
  expect(pending[0]!.request.signal!.aborted).to.equal(true);
  pending[0]!.resolve({ rows: [{ id: 'obsolete' }], total: 1 });
  await new Promise(resolve => setTimeout(resolve, 20));
  expect(grid.data[0]?.['id']).to.equal('current');
  grid.dataSource = loader;
  await waitUntil(() => pending.length === 2);
  grid.remove();
  expect(pending[1]!.request.signal!.aborted).to.equal(true);
  pending[1]!.resolve({ rows: [{ id: 'detached' }], total: 1 });
  await new Promise(resolve => setTimeout(resolve, 20));
  expect(grid.data[0]?.['id']).to.equal('current');
});

it('loads first, middle and final pages from one million logical records', async () => {
  let allocated = 0;
  const requests: DataGridRequest[] = [];
  const grid = await fixture<LyraDataGrid>(html`<lr-data-grid label="Million records" paginate page-size="20" row-key="id"
    .columns=${[{ id: 'id', field: 'id' }]}
    .dataSource=${async (request: DataGridRequest) => {
      requests.push(request);
      return { total: 1000000, rows: Array.from({ length: request.pageSize }, (_, index) => { allocated++; return { id: request.page * request.pageSize + index }; }) };
    }}
  ></lr-data-grid>`);
  for (const page of [0, 25000, 49999]) {
    allocated = 0;
    grid.page = page;
    await waitUntil(() => grid.data[0]?.['id'] === page * 20);
    await grid.updateComplete;
    const mounted = grid.shadowRoot!.querySelectorAll('[part="row"]').length;
    expect(grid.data[19]?.['id']).to.equal(page * 20 + 19);
    expect(mounted).to.be.at.most(20);
    expect(allocated).to.be.at.most(20);
    recordScaleMeasurement('lr-data-grid', `n=1000000 page=${page}`, { pageRows: grid.data.length, allocated, mountedRows: mounted });
  }
  grid.searchTerm = 'needle';
  grid.sort = [{ id: 'id', desc: true }];
  await waitUntil(() => requests.at(-1)?.search === 'needle');
  expect(requests.at(-1)!.sort).to.deep.equal([{ id: 'id', desc: true }]);
});
