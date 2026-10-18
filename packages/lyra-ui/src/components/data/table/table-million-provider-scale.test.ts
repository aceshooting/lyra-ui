import { expect, fixture, html } from '@open-wc/testing';
import './table.js';
import type { LyraTable } from './table.js';
import { installTableTestHooks } from '../../../../test/table.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
installTableTestHooks();

it('renders first, middle and final host-provided pages of one million records', async () => {
  let cells = 0;
  const table = await fixture<LyraTable<{ id: number }>>(html`<lr-table caption="Million records"
    pagination-mode="server" sort-mode="server" total-items="1000000" page-size="20"
    .rowKey=${(row: { id: number }) => row.id}
    .columns=${[{ key: 'id', label: 'Identifier', cell: (row: { id: number }) => { cells++; return row.id; } }]}
  ></lr-table>`);
  table.selectedRowKeys = new Set([999999]);
  for (const page of [1, 25001, 50000]) {
    cells = 0;
    table.page = page;
    table.rows = Array.from({ length: 20 }, (_, index) => ({ id: (page - 1) * 20 + index }));
    await table.updateComplete;
    const mounted = table.shadowRoot!.querySelectorAll('tbody tr').length;
    expect(table.pageRows[0]?.id).to.equal((page - 1) * 20);
    expect(table.pageRows[19]?.id).to.equal(page * 20 - 1);
    expect(table.shadowRoot!.querySelector(`tbody tr[data-row-key="number:${page * 20 - 1}"]`) !== null).to.equal(true);
    expect(table.selectedRowKeys.has(999999)).to.equal(true);
    expect(mounted).to.equal(20);
    expect(cells).to.be.at.most(40);
    recordScaleMeasurement('lr-table', `n=1000000 page=${page}`, { pageRows: table.rows.length, cells, mountedRows: mounted });
  }
});
