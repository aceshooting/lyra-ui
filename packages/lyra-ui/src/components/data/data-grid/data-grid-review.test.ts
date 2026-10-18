import { expect, html, nextFrame } from '@open-wc/testing';
import { dataGrid } from '../../../../test/data-grid.js';
import type { DataGridColumn } from './data-grid-types.js';
async function settle(element: { updateComplete: Promise<boolean> }) {
  for (let index = 0; index < 4; index += 1) { await element.updateComplete; await nextFrame(); }
}
for (const dir of ['ltr', 'rtl']) it(`windows actual flexible track geometry in ${dir}`, async () => {
  const columns: DataGridColumn<{ id: number }>[] = Array.from({ length: 1000 }, (_, id) => ({ id: `c${id}`, minWidth: 40, value: () => '' }));
  const element = await dataGrid(html`<lr-data-grid label="Flexible" dir=${dir} style="width:600px;--cell-padding:0px" .columns=${columns} .data=${[{ id: 1 }]}></lr-data-grid>`);
  await settle(element);
  const body = element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
  body.scrollLeft = dir === 'rtl' ? -20000 : 20000; body.dispatchEvent(new Event('scroll')); await settle(element);
  const cell = element.shadowRoot!.querySelector<HTMLElement>('[part="cell"][data-column-id="c500"]');
  expect(cell !== null).equal(true);
  const viewport = body.getBoundingClientRect(); const rect = cell!.getBoundingClientRect();
  expect(Math.abs(dir === 'rtl' ? rect.right - viewport.right : rect.left - viewport.left)).lessThan(2);
  element.style.width = '900px'; await settle(element);
  const tail = element.shadowRoot!.querySelector<HTMLElement>('[part="cell"][data-column-id="c520"]');
  expect(tail !== null).equal(true);
});
it('releases footer caches for removed column schemas', async () => {
  const element = await dataGrid(html`<lr-data-grid label="Footers" .columns=${[{ id: 'old', value: () => '', footer: () => 'old' }]} .data=${[{ id: 1 }]}></lr-data-grid>`);
  await settle(element);
  element.columns = [{ id: 'new', value: () => '', footer: () => 'new' }]; await settle(element);
  const cache = (element as unknown as { pipelineMemo: Map<string, unknown> }).pipelineMemo;
  expect(cache.has('footer:old')).equal(false);
  expect(cache.has('footer:new')).equal(true);
});
it('uses expanded flexible tracks after an allocation change', async () => {
  const columns = Array.from({ length: 60 }, (_, id) => ({ id: `c${id}`, label: ' ', minWidth: 4, value: () => '' }));
  const element = await dataGrid(html`<lr-data-grid label="Growing tracks" style="width:600px;--cell-padding:0px" .columns=${columns} .data=${[{ id: 1 }]}></lr-data-grid>`);
  await settle(element);
  const body = element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
  const width = () => element.shadowRoot!.querySelector<HTMLElement>('[part="cell"][data-column-id="c0"]')!.getBoundingClientRect().width;
  const before = width();
  element.style.width = '1200px'; await settle(element);
  expect(width()).greaterThan(before);
  const last = element.shadowRoot!.querySelector<HTMLElement>('[part="cell"][data-column-id="c59"]');
  expect(last !== null).equal(true);
  expect(Math.abs(last!.getBoundingClientRect().right - body.getBoundingClientRect().right)).lessThan(2);
});
for (const dir of ['ltr', 'rtl']) it(`pins using resolved flexible widths in ${dir}`, async () => {
  const columns: DataGridColumn<{ id: number }>[] = Array.from({ length: 1000 }, (_, id) => ({
    id: `c${id}`, label: ' ', minWidth: 40, value: () => '', ...(id < 2 ? { pinned: 'start' as const } : {}),
  }));
  const element = await dataGrid(html`<lr-data-grid label="Flexible pins" dir=${dir} style="width:600px;--cell-padding:0px" .columns=${columns} .data=${[{ id: 1 }]}></lr-data-grid>`);
  await settle(element);
  const body = element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
  body.scrollLeft = dir === 'rtl' ? -20000 : 20000; body.dispatchEvent(new Event('scroll')); await settle(element);
  const first = element.shadowRoot!.querySelector<HTMLElement>('[part="cell"][data-column-id="c0"]')!.getBoundingClientRect();
  const second = element.shadowRoot!.querySelector<HTMLElement>('[part="cell"][data-column-id="c1"]')!.getBoundingClientRect();
  expect(Math.abs(dir === 'rtl' ? first.left - second.right : second.left - first.right)).lessThan(2);
});
for (const dir of ['ltr', 'rtl']) it(`keeps flexible column geometry stable as content windows change in ${dir}`, async () => {
  const columns = Array.from({ length: 1000 }, (_, id) => ({
    id: `c${id}`, label: ' ', minWidth: 40, ...(id < 2 ? { pinned: 'start' as const } : {}),
    value: (row: { id: number }) => row.id >= 50 || id === 500 ? 'X'.repeat(100) : 'X',
  }));
  const element = await dataGrid(html`<lr-data-grid label="Changing content" dir=${dir} style="width:600px;--cell-padding:0px" .columns=${columns} .data=${Array.from({ length: 100 }, (_, id) => ({ id }))}></lr-data-grid>`);
  await settle(element);
  const body = element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
  const firstWidth = element.shadowRoot!.querySelector<HTMLElement>('[part="cell"]')!.getBoundingClientRect().width;
  body.scrollTop = 2500;
  body.scrollLeft = dir === 'rtl' ? -20000 : 20000;
  body.dispatchEvent(new Event('scroll'));
  await settle(element);
  const cell = element.shadowRoot!.querySelector<HTMLElement>('[part="cell"][data-column-id="c500"]');
  expect(cell !== null).equal(true);
  expect(Math.abs(cell!.getBoundingClientRect().width - firstWidth)).lessThan(1);
  const viewport = body.getBoundingClientRect(); const rect = cell!.getBoundingClientRect();
  expect(Math.abs(dir === 'rtl' ? rect.right - viewport.right : rect.left - viewport.left)).lessThan(2);
  await settle(element);
  expect(element.shadowRoot!.querySelectorAll('[part="cell"]').length).lessThan(500);
  expect(Math.abs(cell!.getBoundingClientRect().width - firstWidth)).lessThan(1);
  for (const position of [0, 20000, 0, 20000]) {
    body.scrollTop = position ? 2500 : 0;
    body.scrollLeft = dir === 'rtl' ? -position : position;
    body.dispatchEvent(new Event('scroll')); await settle(element);
    const target = element.shadowRoot!.querySelector<HTMLElement>(`[part="cell"][data-column-id="c${position ? 500 : 0}"]`)!;
    expect(target !== null).equal(true);
    expect(Math.abs(target.getBoundingClientRect().width - firstWidth)).lessThan(1);
    const pinned = [0, 1].map(id => element.shadowRoot!.querySelector<HTMLElement>(`[part="cell"][data-column-id="c${id}"]`)!.getBoundingClientRect());
    expect(Math.abs(dir === 'rtl' ? pinned[0]!.left - pinned[1]!.right : pinned[0]!.right - pinned[1]!.left)).lessThan(2);
  }
});
