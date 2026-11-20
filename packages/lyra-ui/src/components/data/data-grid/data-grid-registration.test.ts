import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-data-grid.js';
import type { LyraDataGrid } from './data-grid.class.js';

const columns = [{ id: 'name', field: 'name', label: 'Name' }];

it('registers the pager only when the grid first paginates', async () => {
  const grid = await fixture<LyraDataGrid>(html`<lr-data-grid label="Rows" .columns=${columns}
    .data=${[{ name: 'a' }]}></lr-data-grid>`);
  expect(Boolean(customElements.get('lr-pagination'))).to.equal(false);
  grid.paginate = true;
  await grid.updateComplete;
  const pager = grid.shadowRoot!.querySelector('lr-pagination');
  const Pagination = customElements.get('lr-pagination');
  expect(Boolean(Pagination && pager instanceof Pagination)).to.equal(true);
});
