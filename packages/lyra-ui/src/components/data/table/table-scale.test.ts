import { expect, fixture, html } from '@open-wc/testing';
import './table.js';
import type { LyraTable } from './table.js';
import { installTableTestHooks } from '../../../../test/table.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
installTableTestHooks();

interface Row { id: number; name: string }
async function table(): Promise<LyraTable<Row>> {
  const el = await fixture<LyraTable<Row>>(html`<lr-table caption="Records" filterable></lr-table>`);
  el.rowKey = row => row.id;
  el.rows = Array.from({ length: 10_000 }, (_, id) => Object.freeze({ id, name: `Row ${id}` }));
  return el;
}

it('keeps row navigation independent of the 10000-row projection', async () => {
  const el = await table();
  let cells = 0, footers = 0;
  el.columns = [{ key: 'name', label: 'Name', cell: row => { cells++; return row.name; }, footer: rows => { footers++; return rows.length; } }];
  await el.updateComplete;
  cells = 0; footers = 0;
  const row = el.shadowRoot!.querySelector('tbody tr')!;
  row.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  await el.updateComplete;
  expect(cells).to.equal(0);
  expect(footers).to.equal(0);
  expect(el.shadowRoot!.querySelector('tbody tr[tabindex="0"]')?.getAttribute('data-row-key')).to.equal('number:1');
  recordScaleMeasurement('lr-table', '10000 rows ArrowDown', { cells, footers });
});

it('reuses immutable public projections and aggregates across unrelated updates', async () => {
  const el = await table();
  let footers = 0;
  el.columns = [{ key: 'name', label: 'Name', cell: row => row.name, footer: rows => { footers++; return rows.length; } }];
  await el.updateComplete;
  const view = el.viewRows, page = el.pageRows;
  footers = 0;
  el.caption = 'Changed';
  await el.updateComplete;
  expect(footers).to.equal(0);
  expect(el.viewRows === view).to.equal(true);
  expect(el.pageRows === page).to.equal(true);
  recordScaleMeasurement('lr-table', '10000 rows unrelated update', { footers });
});

it('does not resort the canonical collection on each filter query', async () => {
  const el = await table();
  let sorts = 0;
  el.columns = [{ key: 'name', label: 'Name', sortable: true, cell: row => row.name, sortValue: row => { sorts++; return row.id; } }];
  el.sortKey = 'name';
  await el.updateComplete;
  sorts = 0;
  el.filterText = 'Row 1'; await el.updateComplete;
  el.filterText = 'Row 12'; await el.updateComplete;
  expect(sorts).to.equal(0);
  expect(el.viewRows[0]?.id).to.equal(12);
  recordScaleMeasurement('lr-table', '10000 rows two filter queries', { sortValues: sorts });
});

it('previews a column resize without reevaluating cells for 10000 rows', async () => {
  const el = await table();
  let cells = 0;
  el.columns = [{ key: 'name', label: 'Name', width: '120px', resizable: true, cell: row => { cells++; return row.name; } }];
  await el.updateComplete;
  cells = 0;
  const handle = el.shadowRoot!.querySelector('[part="resize-handle"]')!;
  handle.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 40, clientX: 100, bubbles: true }));
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 40, clientX: 140 }));
  await el.updateComplete;
  const previewCells = cells;
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 40, clientX: 140 }));
  await el.updateComplete;
  expect(previewCells).to.equal(0);
  recordScaleMeasurement('lr-table', '10000 rows resize preview', { cells: previewCells });
});

it('does not measure resize handles on a selection-only update', async () => {
  const el = await table();
  el.columns = [{ key: 'name', label: 'Name', resizable: true, cell: row => row.name }];
  await el.updateComplete;
  const seam = el as unknown as { syncResizeHandleValues(writes: (() => void)[]): void };
  const original = seam.syncResizeHandleValues;
  let passes = 0;
  seam.syncResizeHandleValues = writes => { passes++; original.call(el, writes); };
  try {
    el.selectedRowKeys = new Set([1]);
    await el.updateComplete;
  } finally { seam.syncResizeHandleValues = original; }
  expect(passes).to.equal(0);
  recordScaleMeasurement('lr-table', '10000 rows selection layout', { resizePasses: passes });
});

it('serializes frozen scalar rows only once across two search queries', async () => {
  const el = await table();
  el.columns = [{ key: 'name', label: 'Name', cell: row => row.name }];
  await el.updateComplete;
  el.filterText = 'Row 1'; await el.updateComplete;
  const original = JSON.stringify;
  let serializations = 0;
  try {
    JSON.stringify = ((value: unknown, ...args: unknown[]) => {
      if (value && typeof value === 'object' && Object.hasOwn(value, 'name') && Object.hasOwn(value, 'id')) serializations++;
      return Reflect.apply(original, JSON, [value, ...args]);
    }) as typeof JSON.stringify;
    el.filterText = 'Row 12'; await el.updateComplete;
  } finally { JSON.stringify = original; }
  expect(serializations).to.equal(0);
  recordScaleMeasurement('lr-table', '10000 frozen rows second query', { serializations });
});

it('avoids empty per-cell style projections', async () => {
  const el = await table();
  el.columns = [{ key: 'name', label: 'Name', cell: row => row.name }];
  await el.updateComplete;
  const original = Object.entries;
  let emptyProjections = 0;
  try {
    Object.entries = ((value: object) => {
      const result = original(value);
      if (result.length === 0 && Object.getPrototypeOf(value) === Object.prototype) emptyProjections++;
      return result;
    }) as typeof Object.entries;
    el.caption = 'Changed'; await el.updateComplete;
  } finally { Object.entries = original; }
  expect(emptyProjections).to.equal(0);
  recordScaleMeasurement('lr-table', '10000 rows unstyled cells', { emptyProjections });
});

it('commits internal selection without re-admitting the already validated keys', async () => {
  const el = await table();
  el.columns = [{ key: 'name', label: 'Name', cell: row => row.name }];
  el.selectionMode = 'multiple';
  await el.updateComplete;
  let admissions = 0;
  const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'selectedRowKeys')!;
  Object.defineProperty(el, 'selectedRowKeys', {
    configurable: true,
    get: () => descriptor.get!.call(el),
    set: value => { admissions++; descriptor.set!.call(el, value); },
  });
  try {
    el.shadowRoot!.querySelector<HTMLElement>('tbody tr')!.click();
    await el.updateComplete;
  } finally { Reflect.deleteProperty(el, 'selectedRowKeys'); }
  expect(admissions).to.equal(0);
  expect(el.selectedRowKeys.has(0)).to.equal(true);
  recordScaleMeasurement('lr-table', '10000 rows selection commit', { admissions });
});

it('reads resize geometry before writing sticky offsets in a layout pass', async () => {
  const el = await table();
  el.columns = [{ key: 'name', label: 'Name', sticky: 'start', resizable: true, cell: row => row.name }];
  await el.updateComplete;
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  const header = el.shadowRoot!.querySelector<HTMLElement>('th[data-col-key]')!;
  const originalRead = header.getBoundingClientRect.bind(header);
  const originalWrite = header.style.setProperty.bind(header.style);
  const actions: string[] = [];
  header.getBoundingClientRect = () => { actions.push('read'); return originalRead(); };
  header.style.setProperty = (name, value, priority) => { actions.push('write'); originalWrite(name, value, priority); };
  const seam = el as unknown as { scheduleLayoutSync(): void };
  try {
    seam.scheduleLayoutSync();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  } finally {
    Reflect.deleteProperty(header, 'getBoundingClientRect');
    Reflect.deleteProperty(header.style, 'setProperty');
  }
  expect(actions.indexOf('read')).to.be.lessThan(actions.indexOf('write'));
  recordScaleMeasurement('lr-table', '10000 rows layout read-write phases', { reads: actions.filter(action => action === 'read').length });
});
