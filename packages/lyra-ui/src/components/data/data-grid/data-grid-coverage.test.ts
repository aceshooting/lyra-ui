import { expect, html, oneEvent } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { columns, rows, dataGrid } from '../../../../test/data-grid.js';
import type { LyraDropdown } from '../../overlays/overlay/dropdown.js';

it('retains the valid unique prefix when an untyped key iterable fails mid-stream', async () => {
  const grid = await dataGrid(html`<lr-data-grid label="People" row-key="id" selectable .columns=${columns} .data=${rows}></lr-data-grid>`);
  function* keys() {
    yield 2;
    yield 2;
    yield '';
    yield 1;
    throw new Error('Key stream unavailable');
  }
  Reflect.set(grid, 'selectedKeys', keys());
  Reflect.set(grid, 'expandedKeys', keys());
  await grid.updateComplete;
  expect(grid.selectedKeys).to.deep.equal([2, 1]);
  expect(grid.expandedKeys).to.deep.equal([2, 1]);
  expect(Object.isFrozen(grid.selectedKeys)).to.equal(true);
  expect(grid.selectedRows.map((row) => row.id)).to.deep.equal([1, 2]);
  grid.selectedKeys = [3];
  await grid.updateComplete;
  expect(grid.selectedRows.map((row) => row.id)).to.deep.equal([3]);
});

it('settles the columns menu after Escape and reopens it through its trigger', async () => {
  const grid = await dataGrid(html`<lr-data-grid label="People" with-columns-menu .columns=${columns} .data=${rows}></lr-data-grid>`);
  const dropdown = grid.shadowRoot!.querySelector<LyraDropdown>('[part="columns-menu"]')!;
  const trigger = dropdown.querySelector<HTMLElement>('[slot="trigger"]')!;
  await focusByKeyboard(trigger);
  const shown = oneEvent(dropdown, 'lr-after-show');
  await sendKeys({ press: 'Enter' });
  await shown;
  expect(dropdown.open).to.equal(true);
  const hidden = oneEvent(dropdown, 'lr-after-hide');
  await sendKeys({ press: 'Escape' });
  await hidden;
  await grid.updateComplete;
  expect(dropdown.open).to.equal(false);
  const reopened = oneEvent(dropdown, 'lr-after-show');
  await sendKeys({ press: 'Enter' });
  await reopened;
  expect(dropdown.open).to.equal(true);
  expect(grid.getVisibleRows().length).to.equal(3);
});

it('preserves callable row identity through tree filtering and descendant selection', async () => {
  interface CallableRow {
    (): void;
    id: string;
    title: string;
    children: CallableRow[];
  }
  const child: CallableRow = Object.assign(() => {}, { id: 'child', title: 'Needle', children: [] });
  const parent: CallableRow = Object.assign(() => {}, { id: 'parent', title: 'Parent', children: [child] });
  const grid = await dataGrid<CallableRow>(html`<lr-data-grid
    label="Callable rows" selectable="multiple" filter-from-leaf-rows
    .rowKey=${(row: CallableRow) => row.id}
    .childRows=${(row: CallableRow) => row.children}
    .columns=${[{ id: 'title', label: 'Title', value: (row: CallableRow) => row.title }]}
    .data=${[parent]} .expandedKeys=${['parent']}
  ></lr-data-grid>`);
  expect(grid.shadowRoot!.querySelectorAll('[part~="row"]').length).to.equal(2);
  const parentRow = grid.shadowRoot!.querySelector<HTMLElement>('[part~="row"]')!;
  parentRow.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
  await grid.updateComplete;
  expect(grid.selectedKeys).to.deep.equal(['parent', 'child']);
  expect(grid.selectedRows[0] === parent).to.equal(true);
  expect(grid.selectedRows[1] === child).to.equal(true);
  grid.searchTerm = 'Needle';
  await grid.updateComplete;
  expect(grid.getVisibleRows().length).to.equal(1);
  expect(grid.getVisibleRows()[0] === parent).to.equal(true);
  expect(grid.shadowRoot!.textContent).to.contain('Needle');
  grid.shadowRoot!.querySelector<HTMLInputElement>('[part="select-all-checkbox"]')!.click();
  await grid.updateComplete;
  expect(grid.selectedKeys).to.deep.equal([]);
});
