import { expect, html, nextFrame, waitUntil } from '@open-wc/testing';
import { dataGrid } from '../../../../test/data-grid.js';
import type { DataGridColumn } from './data-grid-types.js';

interface Row { id: number; name: string }

async function settle(element: { updateComplete: Promise<boolean> }): Promise<void> {
  for (let index = 0; index < 3; index += 1) { await element.updateComplete; await nextFrame(); }
}

it('keeps windowing columns by the real scroll position when the body reports unusable layout extents', async () => {
  const rows: Row[] = Array.from({ length: 40 }, (_, id) => ({ id, name: `Row ${id}` }));
  const columns: DataGridColumn<Row>[] = Array.from({ length: 200 }, (_, id) => ({ id: `c${id}`, width: 120, value: (row: Row) => row.id }));
  const grid = await dataGrid<Row>(html`<lr-data-grid label="Wide" style="width:600px" .columns=${columns} .data=${rows}></lr-data-grid>`);
  await settle(grid);
  const body = grid.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
  const header = (id: string) => grid.shadowRoot!.querySelector(`[part="header-cell"][data-column-id="${id}"]`) !== null;
  expect(header('c100')).to.equal(false);
  Object.defineProperty(body, 'scrollWidth', { configurable: true, get: () => Number.NaN });
  try {
    body.scrollLeft = 12_000;
    body.dispatchEvent(new Event('scroll'));
    await settle(grid);
    await waitUntil(() => header('c100'), 'the column window follows the scroll offset');
  } finally {
    delete (body as unknown as Record<string, unknown>)['scrollWidth'];
  }
});

it('scrolls a hidden virtualized grid to a row without throwing and lands there once shown', async () => {
  const rows: Row[] = Array.from({ length: 200 }, (_, id) => ({ id, name: `Row ${id}` }));
  const host = document.createElement('div');
  host.hidden = true;
  host.style.cssText = 'block-size:240px';
  document.body.append(host);
  try {
    const grid = await dataGrid<Row>(html`<lr-data-grid label="Hidden" row-key="id" style="block-size:240px"
      .columns=${[{ field: 'name', label: 'Name' }]} .data=${rows}></lr-data-grid>`);
    host.append(grid);
    await settle(grid);
    expect(() => grid.scrollToIndex(120, { align: 'center' })).not.to.throw();
    host.hidden = false;
    await settle(grid);
    grid.scrollToIndex(120, { align: 'start' });
    const body = grid.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
    await waitUntil(() => grid.shadowRoot!.querySelector('[data-virtual-item-key="row:number:120"]') !== null, 'row 120 mounts');
    expect(body.scrollTop).to.be.greaterThan(0);
  } finally {
    host.remove();
  }
});

it('re-measures wrapped rows after the visible set changes underneath a measurement pass', async () => {
  const rows: Row[] = Array.from({ length: 300 }, (_, id) => ({
    id,
    name: id % 3 === 0 ? `Wrapped ${id} ${'word '.repeat(40)}` : `Row ${id}`,
  }));
  const grid = await dataGrid<Row>(html`<lr-data-grid label="Varied" row-key="id" style="block-size:260px;inline-size:220px"
    .columns=${[{ field: 'name', label: 'Name' }]} .data=${rows}></lr-data-grid>`);
  await settle(grid);
  const body = grid.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
  body.scrollTop = 900;
  body.dispatchEvent(new Event('scroll'));
  grid.data = rows.filter((row) => row.id % 2 === 0);
  await settle(grid);
  grid.searchTerm = 'Wrapped';
  await settle(grid);
  const visible = grid.getVisibleRows();
  expect(visible.length).to.be.greaterThan(0);
  expect(visible.every((row) => row.name.startsWith('Wrapped'))).to.equal(true);
  grid.searchTerm = '';
  await settle(grid);
  expect(grid.getVisibleRows().length).to.equal(150);
});
