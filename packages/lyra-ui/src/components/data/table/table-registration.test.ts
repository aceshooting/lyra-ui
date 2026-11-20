import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-table.js';
import type { LyraTable, TableColumn } from './table.class.js';

type Row = { name: string };
const columns: TableColumn<Row>[] = [{ key: 'name', label: 'Name', cell: (row) => row.name }];

it('registers the pager only when the table first has more than one page', async () => {
  const table = await fixture<LyraTable<Row>>(html`<lr-table caption="Rows" page-size="2" .columns=${columns}
    .rows=${[{ name: 'a' }]}></lr-table>`);
  expect(Boolean(customElements.get('lr-pagination'))).to.equal(false);
  expect(Boolean(customElements.get('lr-skeleton'))).to.equal(false);
  table.rows = [{ name: 'a' }, { name: 'b' }, { name: 'c' }];
  await table.updateComplete;
  const pager = table.shadowRoot!.querySelector('[part="pagination"]');
  const Pagination = customElements.get('lr-pagination');
  expect(Boolean(Pagination && pager instanceof Pagination)).to.equal(true);
});
