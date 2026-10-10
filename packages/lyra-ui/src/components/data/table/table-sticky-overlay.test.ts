import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './table.js';
import '../../overlays/overlay/dropdown.js';
import type { LyraTable, TableColumn } from './table.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { installTableTestHooks } from '../../../../test/table.js';
installTableTestHooks();

interface ActionRow {
  id: string;
  name: string;
}

type Dropdown = HTMLElement & { show(): Promise<void>; hide(o?: { focusTrigger?: boolean }): Promise<void> };

const actionRows: ActionRow[] = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, name: `Row ${id}` }));
const ITEM_COUNT = 8;

function actionsCell(row: ActionRow) {
  return html`<lr-dropdown placement="bottom-start" style="--lr-transition-fast: 0ms"
    ><button slot="trigger" type="button" data-trigger=${row.id}>Actions ${row.id}</button>
    ${Array.from(
      { length: ITEM_COUNT },
      (_, i) => html`<button type="button" data-item=${i} style="display: block; block-size: 28px">Item ${i}</button>`,
    )}
  </lr-dropdown>`;
}

async function mountTable(sticky: 'start' | 'end', dir: 'ltr' | 'rtl') {
  const columns: TableColumn<ActionRow>[] =
    sticky === 'end'
      ? [
          { key: 'name', label: 'Name', cell: (r) => r.name },
          { key: 'actions', label: 'Actions', sticky: 'end', cell: actionsCell },
        ]
      : [
          { key: 'actions', label: 'Actions', sticky: 'start', cell: actionsCell },
          { key: 'name', label: 'Name', cell: (r) => r.name },
        ];
  const wrapper = await fixture<HTMLElement>(html`<div dir=${dir}>
    <lr-table aria-label="Row actions" .columns=${columns} .rows=${actionRows}></lr-table>
  </div>`);
  const table = wrapper.querySelector('lr-table') as LyraTable<ActionRow>;
  await table.updateComplete;
  const root = table.shadowRoot!;
  const rowEls = [...root.querySelectorAll<HTMLElement>('[part="row"]')];
  const cellOf = (row: HTMLElement) => row.querySelector<HTMLElement>('[part="cell"][data-sticky]')!;
  return { table, root, rowEls, cellOf };
}

function layer(el: HTMLElement, token: string): string {
  return getComputedStyle(el).getPropertyValue(token).trim();
}

for (const sticky of ['end', 'start'] as const) {
  for (const dir of ['ltr', 'rtl'] as const) {
    describe(`sticky '${sticky}' column overlays (${dir})`, () => {
      it('keeps a menu item hit-testable over the following rows while the dropdown is open', async () => {
        const { root, rowEls, cellOf } = await mountTable(sticky, dir);
        const dropdown = rowEls[0]!.querySelector<Dropdown>('lr-dropdown')!;
        await dropdown.show();
        const popup = dropdown.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
        await waitUntil(() => popup.style.left !== '' || popup.style.insetInlineStart !== '', 'the menu is placed');

        const third = rowEls[2]!.getBoundingClientRect();
        const items = [...dropdown.querySelectorAll<HTMLElement>('[data-item]')];
        const over = items.filter((item) => {
          const r = item.getBoundingClientRect();
          const mid = r.top + r.height / 2;
          return mid > third.top + 2 && mid < third.bottom - 2;
        });
        expect(over.length, 'the open menu extends over the third row').to.be.greaterThan(0);
        for (const item of over) {
          const r = item.getBoundingClientRect();
          const hit = root.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          expect(hit === item, `item ${item.dataset.item} is the topmost box at its centre`).to.equal(true);
        }
        expect(getComputedStyle(cellOf(rowEls[0]!)).zIndex).to.equal(layer(cellOf(rowEls[0]!), '--lr-layer-popover'));
        await dropdown.hide({ focusTrigger: false });
      });

      it('keeps the resting content z-index while no overlay is open', async () => {
        const { rowEls, cellOf } = await mountTable(sticky, dir);
        for (const row of rowEls) {
          const cell = cellOf(row);
          expect(getComputedStyle(cell).zIndex).to.equal(layer(cell, '--lr-layer-content'));
        }
        const dropdown = rowEls[0]!.querySelector<Dropdown>('lr-dropdown')!;
        await dropdown.show();
        await dropdown.hide({ focusTrigger: false });
        await waitUntil(() => !dropdown.hasAttribute('open'), 'the dropdown closed');
        const cell = cellOf(rowEls[0]!);
        expect(getComputedStyle(cell).zIndex).to.equal(layer(cell, '--lr-layer-content'));
      });

      it('lifts a sticky cell one step above content while focus is inside it', async () => {
        const { rowEls, cellOf } = await mountTable(sticky, dir);
        const cell = cellOf(rowEls[1]!);
        const trigger = cell.querySelector<HTMLElement>('[data-trigger]')!;
        await focusByKeyboard(trigger);
        expect(cell.matches(':focus-within')).to.equal(true);
        const content = Number(layer(cell, '--lr-layer-content'));
        expect(Number(getComputedStyle(cell).zIndex)).to.equal(content + 1);
        expect(getComputedStyle(cellOf(rowEls[2]!)).zIndex).to.equal(String(content));
        trigger.blur();
      });
    });
  }
}
