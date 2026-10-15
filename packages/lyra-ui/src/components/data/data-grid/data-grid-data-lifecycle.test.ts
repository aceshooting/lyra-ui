import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import './data-grid.js';
import type { LyraDataGrid } from './data-grid.js';

interface Row {
  id: number;
  name: string;
}

it('settles a scroll request when a later filter removes its target row', async () => {
  const rows: Row[] = Array.from({ length: 120 }, (_, id) => ({ id, name: `Row ${id}` }));
  const grid = await fixture<LyraDataGrid<Row>>(html`<lr-data-grid
    style="block-size:180px"
    label="Rows" row-key="id"
    .columns=${[{ field: 'name', label: 'Name' }]}
    .data=${rows}
  ></lr-data-grid>`);
  await grid.updateComplete;
  const body = grid.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
  await waitUntil(() => body.clientHeight > 0 && grid.getVisibleRows().length === rows.length);

  grid.scrollToIndex(95, { align: 'start' });
  const requestedScrollTop = body.scrollTop;
  grid.searchTerm = 'Row 1';
  await grid.updateComplete;
  await nextFrame();
  await grid.updateComplete;

  const visibleRows = grid.getVisibleRows();
  expect(visibleRows.length).to.be.greaterThan(0);
  expect(visibleRows.every((row) => row.id !== 95)).to.equal(true);
  expect(grid.shadowRoot!.querySelector('[part~="row"][data-virtual-item-key="row:number:95"]') !== null)
    .to.equal(false);
  const filteredScrollTop = body.scrollTop;
  expect(filteredScrollTop).to.be.lessThan(requestedScrollTop / 2);

  grid.searchTerm = '';
  await grid.updateComplete;
  await nextFrame();
  await nextFrame();
  await grid.updateComplete;

  expect(grid.getVisibleRows()).to.have.length(rows.length);
  expect(body.scrollTop, 'restoring the removed row must not replay its old scroll request')
    .to.be.lessThan(requestedScrollTop / 2);
});
