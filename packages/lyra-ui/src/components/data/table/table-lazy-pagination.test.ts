import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-table.js';
import type { LyraTable, TableColumn } from './table.class.js';
import type { LyraPagination } from '../pagination/pagination.class.js';

type Row = { id: number };
const columns: TableColumn<Row>[] = [{ key: 'id', label: 'Id', cell: (row) => String(row.id) }];
const rows: Row[] = Array.from({ length: 100 }, (_, id) => ({ id }));

// This file must not import lr-pagination: the table's own lazy registration defines it, so the
// pager first receives its bindings as a not-yet-upgraded element.
it('keeps the pager total the table assigned between the pager upgrade and its first update', async () => {
  expect(Boolean(customElements.get('lr-pagination'))).to.equal(false);
  let pagerUpdatedAtDefinition: boolean | undefined;
  // Settles after the upgrade but before the upgraded pager's first update runs.
  const rowsArrived = customElements.whenDefined('lr-pagination').then(() => {
    const table = document.querySelector<LyraTable<Row>>('lr-table[caption="Rows"]')!;
    const pager = table.shadowRoot!.querySelector<LyraPagination>('[part="pagination"]')!;
    pagerUpdatedAtDefinition = pager.hasUpdated;
    table.rows = rows;
    table.loading = false;
    // The table commits its new bindings before the pager's queued first update, as a host whose
    // own update lands in that window does.
    (table as unknown as { performUpdate(): void }).performUpdate();
  });
  // A skeleton load renders the pager (total 0) before any rows exist.
  const table = await fixture<LyraTable<Row>>(html`<lr-table caption="Rows" page-size="50" loading
    loading-appearance="skeleton" .columns=${columns} .rows=${[]}></lr-table>`);
  await rowsArrived;
  await table.updateComplete;
  const pager = table.shadowRoot!.querySelector<LyraPagination>('[part="pagination"]')!;
  await pager.updateComplete;
  expect(pagerUpdatedAtDefinition).to.equal(false);
  expect(pager.total).to.equal(100);
  expect(pager.pageSize).to.equal(50);
  expect(pager.totalPages).to.equal(2);
  const next = pager.shadowRoot!.querySelector<HTMLButtonElement>('[part~="next-button"]');
  expect(next?.disabled).to.equal(false);
});
