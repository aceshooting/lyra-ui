import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './table.js';
import type { LyraTable, TableColumn } from './table.js';
import { forcedWidthHeaderCell, installTableTestHooks, type Row, columns, rows } from '../../../../test/table.js';
installTableTestHooks();

async function table(configure: (el: LyraTable<Row>) => void): Promise<LyraTable<Row>> {
  const el = (await fixture(html`<lr-table caption="People"></lr-table>`)) as LyraTable<Row>;
  el.rowKey = (r) => r.id;
  configure(el);
  await el.updateComplete;
  return el;
}

function bodyRowKeys(el: LyraTable<Row>): string[] {
  return [...el.shadowRoot!.querySelectorAll<HTMLElement>('tbody tr[data-row-key]')].map((tr) => (tr.dataset['rowKey'] ?? '').replace(/^string:/u, ''));
}

const three: Row[] = [...rows, { id: 'c', name: 'Gamma', score: 2 }];

describe('lr-table interaction edges', () => {
  it('treats re-assigning the same max-rows limit as a no-op', async () => {
    const el = await table((t) => {
      t.columns = columns;
      t.rows = three;
      t.maxRows = 2;
    });
    expect(bodyRowKeys(el)).to.deep.equal(['a', 'b']);
    el.maxRows = 2;
    expect(el.isUpdatePending).to.equal(false);
    el.maxRows = 3;
    await el.updateComplete;
    expect(bodyRowKeys(el)).to.deep.equal(['a', 'b', 'c']);
  });

  it('toggles an already selected row off when it is activated again in multiple mode', async () => {
    const el = await table((t) => {
      t.columns = columns;
      t.rows = rows;
      t.selectionMode = 'multiple';
    });
    const changes: string[][] = [];
    el.addEventListener('lr-selection-change', (event) =>
      changes.push([...(event as CustomEvent<{ selectedRowKeys: string[] }>).detail.selectedRowKeys].map(String)));
    const firstCell = () => el.shadowRoot!.querySelector<HTMLElement>('tbody tr[data-row-key="string:a"] td')!;
    firstCell().click();
    await el.updateComplete;
    firstCell().click();
    await el.updateComplete;
    expect(changes).to.deep.equal([['a'], []]);
    expect([...el.selectedRowKeys]).to.deep.equal([]);
  });

  it('coerces a multi-key selection assigned while selection-mode is already single', async () => {
    const el = await table((t) => {
      t.columns = columns;
      t.rows = three;
      t.selectionMode = 'single';
    });
    const changes: string[][] = [];
    el.addEventListener('lr-selection-change', (event) =>
      changes.push([...(event as CustomEvent<{ selectedRowKeys: string[] }>).detail.selectedRowKeys].map(String)));
    el.selectedRowKeys = new Set(['b', 'c']);
    await el.updateComplete;
    expect([...el.selectedRowKeys]).to.deep.equal(['b']);
    expect(changes).to.deep.equal([['b']]);
  });

  it('coerces a multi-key expansion assigned while expansion-mode is already single', async () => {
    const el = await table((t) => {
      t.columns = columns;
      t.rows = three;
      t.expansionMode = 'single';
      t.rowDetail = (r: Row) => html`<p>${r.name} detail</p>`;
    });
    el.expandedRowKeys = new Set(['c', 'a']);
    await el.updateComplete;
    expect([...el.expandedRowKeys]).to.deep.equal(['c']);
  });

  it('paints no heat tint when no heat value is numeric', async () => {
    const heatColumns: TableColumn<Row>[] = [
      columns[0]!,
      { key: 'score', label: 'Score', cell: (r) => r.score, heatValue: () => null },
    ];
    const el = await table((t) => {
      t.columns = heatColumns;
      t.rows = rows;
    });
    const cells = [...el.shadowRoot!.querySelectorAll<HTMLElement>('tbody td[data-col-key="score"]')];
    expect(cells.length).to.equal(2);
    expect(cells.map((cell) => cell.style.getPropertyValue('--_heat-mix'))).to.deep.equal(['', '']);
    expect(cells.map((cell) => cell.hasAttribute('data-heat'))).to.deep.equal([false, false]);
    // A half-specified domain cannot be completed from data that has no numeric value either.
    el.heatTintScale = { min: 0 };
    await el.updateComplete;
    expect(cells.map((cell) => cell.hasAttribute('data-heat'))).to.deep.equal([false, false]);
  });

  it('sorts a column whose cell renders nothing for some rows as empty text', async () => {
    const sparse: TableColumn<Row>[] = [
      { key: 'name', label: 'Name', sortable: true, cell: (r) => (r.id === 'b' ? undefined : r.name) as unknown as string },
    ];
    const el = await table((t) => {
      t.columns = sparse;
      t.rows = three;
    });
    el.shadowRoot!.querySelector<HTMLElement>('th[data-col-key="name"]')!.click();
    await el.updateComplete;
    expect(bodyRowKeys(el)).to.deep.equal(['b', 'a', 'c']);
  });

  it('seeds an editor with an empty value when neither editValue nor the row field exists', async () => {
    const editColumns: TableColumn<Row>[] = [
      { key: 'nickname', label: 'Nickname', editTrigger: 'double-click', cell: () => '' },
    ];
    const el = await table((t) => {
      t.columns = editColumns;
      t.rows = rows;
    });
    const cell = el.shadowRoot!.querySelector<HTMLElement>('[part="row"] [part="cell"]')!;
    cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await el.updateComplete;
    const input = cell.querySelector<HTMLInputElement>('[part="cell-editor"]');
    expect(input?.value).to.equal('');
  });
});

describe('lr-table row keys and editor triggers', () => {
  it('omits rows whose rowKey is neither a string nor a number', async () => {
    const el = await table((t) => {
      t.columns = columns;
      t.rows = three;
      t.rowKey = ((r: Row) => (r.id === 'b' ? { id: r.id } : r.id)) as unknown as (r: Row) => string;
    });
    expect(bodyRowKeys(el)).to.deep.equal(['a', 'c']);
  });

  it('does not open an editor when the double-click lands on an interactive control in the cell', async () => {
    const editColumns: TableColumn<Row>[] = [
      { key: 'name', label: 'Name', editTrigger: 'double-click', editValue: (r) => r.name, cell: (r) => html`<button type="button">${r.name}</button>` },
    ];
    const el = await table((t) => {
      t.columns = editColumns;
      t.rows = rows;
    });
    const cell = el.shadowRoot!.querySelector<HTMLElement>('[part="row"] [part="cell"]')!;
    cell.querySelector('button')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(cell.querySelector('[part="cell-editor"]')).to.equal(null);
    cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(cell.querySelector<HTMLInputElement>('[part="cell-editor"]')?.value).to.equal('Alpha');
  });
});

describe('lr-table column resize edges', () => {
  const resizeColumns = (minWidth = '80px'): TableColumn<Row>[] => [
    { key: 'name', label: 'Name', width: '120px', minWidth, resizable: true, cell: (r) => r.name },
    columns[1]!,
  ];

  function handleOf(el: LyraTable<Row>): HTMLElement {
    const handle = el.shadowRoot!.querySelector<HTMLElement>('[part="resize-handle"]')!;
    // Synthetic pointers carry no browser-owned pointer; Firefox rejects native capture for them.
    handle.setPointerCapture = () => {};
    handle.releasePointerCapture = () => {};
    return handle;
  }

  function key(handle: HTMLElement, name: string): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key: name, bubbles: true, composed: true, cancelable: true });
    handle.dispatchEvent(event);
    return event;
  }

  it('ignores keys that are not resize steps and stops proposing once the minimum is reached', async () => {
    const el = await table((t) => {
      t.columns = resizeColumns();
      t.rows = rows;
    });
    const handle = handleOf(el);
    const requests: number[] = [];
    el.addEventListener('lr-column-resize-request', (event) => requests.push((event as CustomEvent).detail.width));
    expect(key(handle, 'a').defaultPrevented).to.equal(false);
    expect(requests).to.deep.equal([]);
    key(handle, 'Home');
    await el.updateComplete;
    expect(requests).to.deep.equal([80]);
    key(handle, 'Home');
    key(handle, 'ArrowLeft');
    await el.updateComplete;
    expect(requests).to.deep.equal([80]);
  });

  it('falls back to the theme minimum when the authored min-width is not a usable pixel length', async () => {
    const el = await table((t) => {
      t.columns = resizeColumns('NaNpx');
      t.rows = rows;
    });
    const valid = await table((t) => {
      t.columns = [{ ...resizeColumns()[0]!, minWidth: undefined }, columns[1]!];
      t.rows = rows;
    });
    expect(handleOf(el).getAttribute('aria-valuemin')).to.equal(handleOf(valid).getAttribute('aria-valuemin'));
  });

  it('only follows the pointer that started the drag and skips moves that do not change the width', async () => {
    const el = await table((t) => {
      t.columns = resizeColumns();
      t.rows = rows;
    });
    const handle = handleOf(el);
    const widths: number[] = [];
    el.addEventListener('lr-column-resize', (event) => widths.push((event as CustomEvent).detail.width));
    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 100 }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 2, clientX: 200 }));
    expect(widths).to.deep.equal([]);
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 140 }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 140 }));
    expect(widths.length).to.equal(1);
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2, clientX: 140 }));
    expect(handle.hasAttribute('data-resizing')).to.equal(true);
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 140 }));
    expect(handle.hasAttribute('data-resizing')).to.equal(false);
    await el.updateComplete;
  });
});

describe('lr-table medium-only priority columns', () => {
  it('hides a medium-priority column when no low-priority tier exists to shed first', async () => {
    const mediumOnly: TableColumn<Row>[] = [
      { key: 'name', label: 'Name', cell: (r) => r.name },
      { key: 'score', label: 'Score', priority: 'medium', headerCell: forcedWidthHeaderCell(400, 'Score'), cell: (r) => r.score },
    ];
    const el = (await fixture(html`<lr-table caption="People" style="inline-size: 300px" .rows=${rows} .columns=${mediumOnly} .rowKey=${(r: Row) => r.id}></lr-table>`)) as LyraTable<Row>;
    const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    await waitUntil(() => base.hasAttribute('data-hide-priority-medium'), 'the medium tier hides', { timeout: 3000 });
    expect(base.hasAttribute('data-hide-priority-low')).to.equal(false);
    const scoreCells = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[data-col-key="score"]')].filter((cell) => cell.matches('th,td'));
    expect(scoreCells.map((cell) => getComputedStyle(cell).display)).to.deep.equal(Array(scoreCells.length).fill('none'));
  });
});
