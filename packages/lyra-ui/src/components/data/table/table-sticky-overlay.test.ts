import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import { render, type TemplateResult } from 'lit';
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
  return html`<lr-dropdown data-lr-theme-scope placement="bottom-start" style="--lr-transition-fast: 0ms"
    ><button slot="trigger" type="button" data-trigger=${row.id}>Actions ${row.id}</button>
    ${Array.from(
      { length: ITEM_COUNT },
      (_, i) => html`<button type="button" data-item=${i} style="display: block; block-size: 28px">Item ${i}</button>`,
    )}
  </lr-dropdown>`;
}

class ShadowActions extends HTMLElement {
  private root = this.attachShadow({ mode: 'open' });
  set content(value: TemplateResult) { render(value, this.root); }
}
if (!customElements.get('table-shadow-actions')) customElements.define('table-shadow-actions', ShadowActions);

function wrappedActionsCell(row: ActionRow) {
  return html`<table-shadow-actions .content=${html`<table-shadow-actions
    .content=${html`${actionsCell(row)}${actionsCell(row)}`}></table-shadow-actions>`}></table-shadow-actions>`;
}

function wrappedDropdowns(cell: HTMLElement): Dropdown[] {
  const outer = cell.querySelector('table-shadow-actions')!;
  const inner = outer.shadowRoot!.querySelector('table-shadow-actions')!;
  return [...inner.shadowRoot!.querySelectorAll<Dropdown>('lr-dropdown')];
}

async function mountTable(sticky: 'start' | 'end', dir: 'ltr' | 'rtl', wrapped = false) {
  const renderActions = wrapped ? wrappedActionsCell : actionsCell;
  const columns: TableColumn<ActionRow>[] =
    sticky === 'end'
      ? [
          { key: 'name', label: 'Name', cell: (r) => r.name },
          { key: 'actions', label: 'Actions', sticky: 'end', cell: renderActions },
        ]
      : [
          { key: 'actions', label: 'Actions', sticky: 'start', cell: renderActions },
          { key: 'name', label: 'Name', cell: (r) => r.name },
        ];
  const wrapper = await fixture<HTMLElement>(html`<div dir=${dir} style=${wrapped ? 'inline-size: 320px' : ''}>
    <button data-outside type="button">Outside</button>
    <lr-table aria-label="Row actions" .columns=${columns} .rows=${actionRows}></lr-table>
  </div>`);
  const table = wrapper.querySelector('lr-table') as LyraTable<ActionRow>;
  await table.updateComplete;
  const root = table.shadowRoot!;
  const rowEls = [...root.querySelectorAll<HTMLElement>('[part="row"]')];
  const cellOf = (row: HTMLElement) => row.querySelector<HTMLElement>('[part="cell"][data-sticky]')!;
  return { table, root, rowEls, cellOf, outside: wrapper.querySelector<HTMLButtonElement>('[data-outside]')! };
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
          expect(hit === item, `item ${item.dataset['item']} is the topmost box at its centre`).to.equal(true);
        }
        expect(getComputedStyle(cellOf(rowEls[0]!)).zIndex).to.equal(layer(cellOf(rowEls[0]!), '--lr-layer-popover'));
        await dropdown.hide({ focusTrigger: false });
      });

      it('raises a shadow-wrapped programmatic menu without focus and releases shared ownership', async () => {
        const { root, rowEls, cellOf, outside } = await mountTable(sticky, dir, true);
        const firstCell = cellOf(rowEls[0]!);
        const [dropdown, other] = wrappedDropdowns(firstCell) as [Dropdown, Dropdown];
        const wrapper = firstCell.querySelector<HTMLElement>('table-shadow-actions')!;
        await focusByKeyboard(outside);
        await dropdown.show();
        // Programmatic show focuses the first menu control. Move keyboard focus back outside
        // without dismissing this click-triggered surface, so focus-within cannot mask stacking.
        await focusByKeyboard(outside);
        expect(dropdown.hasAttribute('open'), 'the programmatically opened menu remains open').to.equal(true);
        expect(firstCell.matches(':focus-within'), 'the menu is open without focus inside its cell').to.equal(false);
        const popup = dropdown.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
        await waitUntil(() => popup.style.left !== '' || popup.style.insetInlineStart !== '', 'the wrapped menu is placed');
        const third = rowEls[2]!.getBoundingClientRect();
        const items = [...dropdown.querySelectorAll<HTMLElement>('[data-item]')];
        const over = items.filter(item => {
          const box = item.getBoundingClientRect();
          return box.top + box.height / 2 > third.top + 2 && box.top + box.height / 2 < third.bottom - 2;
        });
        expect(over.length, 'the wrapped panel crosses the following rows').to.be.greaterThan(0);
        for (const item of over) {
          const box = item.getBoundingClientRect();
          let hit = root.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
          while (hit?.shadowRoot) {
            const inner = hit.shadowRoot.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
            if (!inner || inner === hit) break;
            hit = inner;
          }
          expect(hit === item, 'the wrapped menu item receives the hit').to.equal(true);
        }
        const isRaised = () => getComputedStyle(firstCell).zIndex === layer(firstCell, '--lr-layer-popover');
        const isResting = () => getComputedStyle(firstCell).zIndex === layer(firstCell, '--lr-layer-content');
        expect(isRaised()).to.equal(true);
        await other.show();
        await focusByKeyboard(outside);
        await dropdown.hide({ focusTrigger: false });
        expect(isRaised(), 'one remaining overlay retains the cell layer').to.equal(true);
        await other.hide({ focusTrigger: false });
        expect(isResting(), 'the last close releases the cell layer').to.equal(true);
        await dropdown.show();
        await focusByKeyboard(outside);
        expect(isRaised(), 'reopening restores the layer').to.equal(true);
        wrapper.remove();
        expect(isResting(), 'disconnecting releases the former cell').to.equal(true);
        const nextCell = cellOf(rowEls[1]!);
        nextCell.append(wrapper);
        await waitUntil(() => getComputedStyle(nextCell).zIndex === layer(nextCell, '--lr-layer-popover'), 'reparented open menu raises its new cell');
        expect(isResting(), 'the former cell remains released').to.equal(true);
        await dropdown.hide({ focusTrigger: false });
        expect(getComputedStyle(nextCell).zIndex).to.equal(layer(nextCell, '--lr-layer-content'));
      });

      it('keeps the resting content z-index while no overlay is open', async () => {
        const { root, rowEls, cellOf } = await mountTable(sticky, dir);
        for (const row of rowEls) {
          const cell = cellOf(row);
          expect(getComputedStyle(cell).zIndex).to.equal(layer(cell, '--lr-layer-content'));
        }
        const dropdown = rowEls[0]!.querySelector<Dropdown>('lr-dropdown')!;
        await dropdown.show();
        await dropdown.hide({ focusTrigger: false });
        await waitUntil(() => !dropdown.hasAttribute('open'), 'the dropdown closed');
        // Closing leaves focus on a control inside the cell, which is the focus-within state below.
        (root.activeElement as HTMLElement | null)?.blur();
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
