import { expect, fixture, html } from '@open-wc/testing';
import './table.js';
import type { LyraTable, TableColumn } from './table.js';
import { installTableTestHooks } from '../../../../test/table.js';
installTableTestHooks();

async function table(): Promise<LyraTable<number>> {
  const el = await fixture<LyraTable<number>>(html`<lr-table caption="Totals" selection-mode="multiple" expansion-mode="multiple"></lr-table>`);
  el.rows = [1, 2, 3];
  return el;
}

it('preserves footer and grand-total callback receivers while reusing results', async () => {
  const el = await table();
  let footerCalls = 0, totalCalls = 0;
  let footerReceiver: unknown, totalReceiver: unknown;
  const column: TableColumn<number> = {
    key: 'value', label: 'Values', cell: row => row,
    footer(this: TableColumn<number>) { footerCalls++; footerReceiver = this; return this?.label ?? 'Missing footer'; },
  };
  el.columns = [column];
  el.rowTotal = row => row;
  el.grandTotal = function (this: LyraTable<number>) { totalCalls++; totalReceiver = this; return this?.caption ?? 'Missing total'; };
  await el.updateComplete;
  expect(footerReceiver === column).to.equal(true);
  expect(totalReceiver === el).to.equal(true);
  expect(el.shadowRoot!.querySelector('tfoot')?.textContent).to.contain('Values');
  expect(el.shadowRoot!.querySelector('tfoot')?.textContent).to.contain('Totals');
  el.selectedRowKeys = new Set([1]);
  await el.updateComplete;
  expect(footerCalls).to.equal(1);
  expect(totalCalls).to.equal(1);
});

for (const end of ['cancel', 'veto', 'reconnect', 'replacement'] as const) {
  it(`restores widthless automatic layout after same-task resize ${end}`, async () => {
    const el = await table();
    el.columns = [{ key: 'value', label: 'Value', resizable: true, cell: row => row }];
    await el.updateComplete;
    const parent = el.parentNode!;
    const handle = el.shadowRoot!.querySelector<HTMLElement>('[part="resize-handle"]')!;
    if (end === 'veto') el.addEventListener('lr-column-resize-request', event => event.preventDefault());
    handle.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 801, clientX: 100, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 801, clientX: 150 }));
    if (end === 'replacement') {
      handle.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 802, clientX: 100, bubbles: true }));
      window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 802 }));
    } else if (end === 'reconnect') { el.remove(); parent.appendChild(el); }
    else window.dispatchEvent(new PointerEvent(end === 'cancel' ? 'pointercancel' : 'pointerup', { pointerId: 801, clientX: 150 }));
    await el.updateComplete;
    const grid = el.shadowRoot!.querySelector<HTMLElement>('table')!;
    expect(grid.getAttribute('data-layout')).to.equal('auto');
    expect(grid.hasAttribute('data-has-column-widths')).to.equal(false);
    expect(getComputedStyle(grid).tableLayout).to.equal('auto');
    expect(el.shadowRoot!.querySelector<HTMLElement>('col')!.style.inlineSize).to.equal('');
  });
}

it('lowers both controlled-key caps and permits a subsequent controlled rebind', async () => {
  const el = await table();
  el.columns = [{ key: 'value', label: 'Value', cell: row => row }];
  el.maxRows = 4;
  const selected = new Set([1, 2, 3]), expanded = new Set([1, 2, 3]);
  el.selectedRowKeys = selected;
  el.expandedRowKeys = expanded;
  await el.updateComplete;
  let events = 0;
  el.addEventListener('lr-selection-change', () => events++);
  el.addEventListener('lr-row-expand-toggle', () => events++);
  el.maxRows = 1;
  await el.updateComplete;
  expect(events).to.equal(0);
  expect(el.selectedRowKeys.size).to.equal(1);
  expect(el.expandedRowKeys.size).to.equal(1);
  el.maxRows = 4;
  el.selectedRowKeys = selected;
  el.expandedRowKeys = expanded;
  await el.updateComplete;
  expect(el.selectedRowKeys.size).to.equal(3);
  expect(el.expandedRowKeys.size).to.equal(3);
});

for (const mutation of ['grow', 'shrink'] as const) {
  it(`refreshes source length when a cap change rereads a ${mutation}ing source`, async () => {
    const el = await table();
    el.columns = [{ key: 'value', label: 'Value', cell: row => row }];
    el.maxRows = 1;
    const rows = [1, 2];
    el.rows = rows;
    await el.updateComplete;
    if (mutation === 'grow') rows.push(3);
    else rows.length = 1;
    el.maxRows = 2;
    await el.updateComplete;
    expect(el.rowsTruncated).to.equal(mutation === 'grow');
    if (mutation === 'grow') expect(el.shadowRoot!.querySelector('[part="row-limit"]')?.textContent).to.contain('2');
    else expect(el.shadowRoot!.querySelector('[part="row-limit"]') === null).to.equal(true);
  });
}

it('keeps internal selection within a cap already occupied by an off-page key', async () => {
  const el = await table();
  el.maxRows = 1;
  el.rowKey = row => row;
  el.rows = [1];
  el.columns = [{ key: 'value', label: 'Value', cell: row => row }];
  el.selectedRowKeys = new Set([99]);
  const reported: number[][] = [];
  el.addEventListener('lr-selection-change', event => reported.push([...event.detail.selectedRowKeys] as number[]));
  await el.updateComplete;
  el.shadowRoot!.querySelector<HTMLElement>('tbody tr')!.click();
  await el.updateComplete;
  expect(el.selectedRowKeys.size).to.equal(1);
  expect(reported).to.deep.equal([[...el.selectedRowKeys]]);
});

it('keeps internal expansion within the cap and reports the committed state', async () => {
  const el = await table();
  el.maxRows = 1;
  el.rowKey = row => row;
  el.rows = [1];
  el.columns = [{ key: 'value', label: 'Value', cell: row => row }];
  el.expandedContent = row => String(row);
  el.expandedRowKeys = new Set([99]);
  const reported: boolean[] = [];
  el.addEventListener('lr-row-expand-toggle', event => reported.push(event.detail.expanded));
  await el.updateComplete;
  el.shadowRoot!.querySelector<HTMLElement>('[part="row-expand-toggle"]')!.click();
  await el.updateComplete;
  expect(el.expandedRowKeys.size).to.equal(1);
  expect(reported).to.deep.equal([el.expandedRowKeys.has(1)]);
});
