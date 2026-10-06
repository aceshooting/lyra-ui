import { expect, html, nextFrame, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './data-grid.js';
import type { LyraDataGrid } from './data-grid.js';
import { type Person, columns, dataGrid, rows } from '../../../../test/data-grid.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';

function cell(element: LyraDataGrid<Person>, row: number, column: number): HTMLElement {
  const found = element.shadowRoot!.querySelector<HTMLElement>(
    `[role="gridcell"][data-row-position="${row}"][data-column-position="${column}"]`,
  );
  if (!found) throw new Error(`Missing cell ${row}:${column}`);
  return found;
}

/** Row and column of the focused cell as a string, so no DOM node ever reaches chai. */
function focusedCell(element: LyraDataGrid<Person>): string {
  const active = element.shadowRoot!.activeElement;
  if (!active) return 'none';
  return `${active.getAttribute('data-row-position')}:${active.getAttribute('data-column-position')}`;
}

const treeRows: Person[] = [
  {
    id: 10,
    name: 'Parent',
    team: 'Tree',
    score: 1,
    children: [{ id: 11, name: 'Child', team: 'Tree', score: 2 }],
  },
  { id: 20, name: 'Other', team: 'Tree', score: 3 },
];

describe('data-grid keyboard disclosure', () => {
  it('expands and collapses tree rows from the first cell and steps back to the parent row', async () => {
    const element = await dataGrid(html`
      <lr-data-grid label="Tree" child-rows="children" row-key="id" .columns=${columns} .data=${treeRows}></lr-data-grid>
    `);
    await focusByKeyboard(cell(element, 0, 0));

    const expand = oneEvent(element, 'lr-row-expand');
    await sendKeys({ press: 'ArrowRight' });
    expect((await expand).detail.rowKey).to.equal(10);
    await element.updateComplete;
    expect(element.expandedKeys).to.deep.equal([10]);
    expect(focusedCell(element)).to.equal('0:0');

    await sendKeys({ press: 'ArrowRight' });
    await waitUntil(() => focusedCell(element) === '0:1', 'an expanded row moves on to the next cell');

    await sendKeys({ press: 'ArrowLeft' });
    await waitUntil(() => focusedCell(element) === '0:0');
    await sendKeys({ press: 'ArrowDown' });
    await waitUntil(() => focusedCell(element) === '1:0', 'the child row is reachable');
    await sendKeys({ press: 'ArrowLeft' });
    await waitUntil(() => focusedCell(element) === '0:0', 'a collapsed child steps back to its parent row');

    const collapse = oneEvent(element, 'lr-row-collapse');
    await sendKeys({ press: 'ArrowLeft' });
    expect((await collapse).detail.rowKey).to.equal(10);
    await element.updateComplete;
    expect(element.expandedKeys).to.deep.equal([]);
    expect(focusedCell(element)).to.equal('0:0');
  });

  it('swaps the disclosure arrows under RTL', async () => {
    const element = await dataGrid(html`
      <lr-data-grid dir="rtl" label="Tree" child-rows="children" row-key="id" .columns=${columns} .data=${treeRows}></lr-data-grid>
    `);
    await focusByKeyboard(cell(element, 0, 0));
    await sendKeys({ press: 'ArrowLeft' });
    await element.updateComplete;
    expect(element.expandedKeys).to.deep.equal([10]);
    await sendKeys({ press: 'ArrowRight' });
    await element.updateComplete;
    expect(element.expandedKeys).to.deep.equal([]);
  });

  it('opens and closes a row detail panel from the first cell', async () => {
    const element = await dataGrid(html`
      <lr-data-grid
        label="Details"
        row-key="id"
        .rowDetail=${(row: Person) => `Details for ${row.name}`}
        .columns=${columns}
        .data=${treeRows}
      ></lr-data-grid>
    `);
    await focusByKeyboard(cell(element, 0, 0));
    await sendKeys({ press: 'ArrowRight' });
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector('[part="row-detail"]')?.textContent?.trim()).to.equal(
      'Details for Parent',
    );
    expect(focusedCell(element)).to.equal('0:0');
    await sendKeys({ press: 'ArrowLeft' });
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector('[part="row-detail"]') === null).to.equal(true);
  });

  it('keeps plain arrow movement on rows that cannot expand', async () => {
    const element = await dataGrid(html`
      <lr-data-grid label="Flat" row-key="id" .columns=${columns} .data=${treeRows}></lr-data-grid>
    `);
    await focusByKeyboard(cell(element, 0, 0));
    await sendKeys({ press: 'ArrowRight' });
    await waitUntil(() => focusedCell(element) === '0:1');
    expect(element.expandedKeys).to.deep.equal([]);
  });
});

/** The text an `aria-labelledby` list resolves to, read from the referenced shadow-root nodes. */
function labelledByText(element: LyraDataGrid<Person>, control: Element): string {
  const ids = (control.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean);
  return ids
    .map((id) => element.shadowRoot!.getElementById(id)?.textContent?.replace(/\s+/g, ' ').trim() ?? `#${id}?`)
    .join(' ');
}

describe('data-grid selection semantics', () => {
  it('announces multiple selection on the grid and names each row control by its row', async () => {
    const element = await dataGrid(html`
      <lr-data-grid label="People" selectable="multiple" row-key="id" .columns=${columns} .data=${treeRows}></lr-data-grid>
    `);
    const grid = element.shadowRoot!.querySelector('[part="table"]')!;
    expect(grid.getAttribute('aria-multiselectable')).to.equal('true');
    const controls = [...element.shadowRoot!.querySelectorAll('[part~="row"] input[type="checkbox"]')];
    expect(controls.map((control) => labelledByText(element, control))).to.deep.equal([
      'Select Parent',
      'Select Other',
    ]);
    await expect(element).to.be.accessible();
  });

  it('names the single-selection column header and reports single selection', async () => {
    const element = await dataGrid(html`
      <lr-data-grid label="People" selectable="single" row-key="id" .columns=${columns} .data=${treeRows}></lr-data-grid>
    `);
    const grid = element.shadowRoot!.querySelector('[part="table"]')!;
    expect(grid.getAttribute('aria-multiselectable')).to.equal('false');
    const header = element.shadowRoot!.querySelector('[role="columnheader"][aria-colindex="1"]')!;
    expect(header.textContent?.trim()).to.equal('Select');
    const radio = element.shadowRoot!.querySelector('[part~="row"] input[type="radio"]')!;
    expect(labelledByText(element, radio)).to.equal('Select Parent');
  });
});

describe('data-grid tab stops', () => {
  it('keeps per-row selection controls out of the Tab order; Space on a cell still selects', async () => {
    const element = await dataGrid(html`
      <lr-data-grid label="People" selectable="multiple" row-key="id" .columns=${columns} .data=${treeRows}></lr-data-grid>
    `);
    const controls = [...element.shadowRoot!.querySelectorAll('[part~="row"] input')];
    expect(controls.map((control) => control.getAttribute('tabindex'))).to.deep.equal(['-1', '-1']);
    await focusByKeyboard(cell(element, 1, 0));
    await sendKeys({ press: ' ' });
    await element.updateComplete;
    expect(element.selectedKeys).to.deep.equal([20]);
  });

  it('keeps group-row controls out of the Tab order; Space selects and the arrows toggle the group', async () => {
    const grouped: Person[] = [
      { id: 1, name: 'Ada', team: 'Compiler', score: 7 },
      { id: 2, name: 'Lin', team: 'Runtime', score: 10 },
      { id: 3, name: 'Grace', team: 'Compiler', score: 9 },
    ];
    const element = await dataGrid(html`
      <lr-data-grid label="Teams" group-by="team" selectable="multiple" row-key="id" .columns=${columns} .data=${grouped}></lr-data-grid>
    `);
    const group = element.shadowRoot!.querySelector<HTMLElement>('[part="group-row"]')!;
    const groupControls = [...group.querySelectorAll('input, button')];
    expect(groupControls.map((control) => control.getAttribute('tabindex'))).to.deep.equal(['-1', '-1']);
    const groupCell = group.querySelector<HTMLElement>('[part="group-value"]')!;
    await focusByKeyboard(groupCell);
    await sendKeys({ press: ' ' });
    await element.updateComplete;
    expect([...element.selectedKeys].sort()).to.deep.equal([1, 3]);
    await sendKeys({ press: 'ArrowRight' });
    await element.updateComplete;
    expect(element.shadowRoot!.querySelectorAll('[part~="row"]').length).to.equal(2);
  });
});

class K05ShadowInput extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).innerHTML = '<input aria-label="Quantity">';
  }
  get input(): HTMLInputElement {
    return this.shadowRoot!.querySelector('input')!;
  }
}
if (!customElements.get('k05-shadow-input')) customElements.define('k05-shadow-input', K05ShadowInput);

describe('data-grid interactive cell content', () => {
  it('leaves keys typed into a shadow-hosted control inside a non-active cell to that control', async () => {
    const editable = [
      ...columns,
      { id: 'qty', label: 'Quantity', formatter: () => html`<k05-shadow-input></k05-shadow-input>` },
    ];
    const element = await dataGrid(html`
      <lr-data-grid label="People" selectable="multiple" row-key="id" .columns=${editable} .data=${treeRows}></lr-data-grid>
    `);
    const host = element.shadowRoot!.querySelector<K05ShadowInput>('[data-row-position="1"] k05-shadow-input')!;
    host.input.focus();
    let prevented = 0;
    host.input.addEventListener('keydown', (event) => {
      queueMicrotask(() => {
        if (event.defaultPrevented) prevented += 1;
      });
    });
    await sendKeys({ press: ' ' });
    await sendKeys({ press: 'Home' });
    await sendKeys({ press: 'Enter' });
    await element.updateComplete;
    expect(element.selectedKeys).to.deep.equal([]);
    expect(prevented).to.equal(0);
    expect(focusedCell(element)).to.equal('null:null');
  });
});

describe('data-grid keyboard column resize', () => {
  it('steps from the rendered width of an auto-sized column and reports it on the separator', async () => {
    const element = await dataGrid(html`
      <lr-data-grid style="inline-size: 640px" label="People" resizable row-key="id"
        .columns=${[{ id: 'name', field: 'name', label: 'Name' }]} .data=${treeRows}></lr-data-grid>
    `);
    await element.updateComplete;
    const header = element.shadowRoot!.querySelector<HTMLElement>('[role="columnheader"][data-column-id="name"]')!;
    const rendered = Math.round(header.getBoundingClientRect().width);
    expect(rendered).to.be.greaterThan(300);
    const handle = element.shadowRoot!.querySelector<HTMLElement>('[part="resize-handle"]')!;
    expect(Number(handle.getAttribute('aria-valuenow'))).to.be.closeTo(rendered, 1);

    await focusByKeyboard(handle);
    const resized = oneEvent(element, 'lr-column-resize');
    await sendKeys({ press: 'ArrowLeft' });
    const { width } = (await resized).detail;
    expect(width).to.be.closeTo(rendered - 10, 1);
  });
});

describe('data-grid roving focus across refreshes', () => {
  it('keeps focus on the same row when a refresh reorders the rows', async () => {
    const element = await dataGrid(html`
      <lr-data-grid label="People" row-key="id" .columns=${columns} .data=${rows}></lr-data-grid>
    `);
    await focusByKeyboard(cell(element, 0, 1));
    element.data = [...rows].reverse();
    await element.updateComplete;
    await nextFrame();
    expect(focusedCell(element)).to.equal('2:1');
    expect(cell(element, 2, 1).textContent?.trim()).to.equal('Compiler');
  });

  it('moves focus to the nearest surviving row when the focused row is removed', async () => {
    const element = await dataGrid(html`
      <lr-data-grid label="People" row-key="id" .columns=${columns} .data=${rows}></lr-data-grid>
    `);
    await focusByKeyboard(cell(element, 2, 0));
    element.data = rows.slice(0, 2);
    await element.updateComplete;
    await nextFrame();
    expect(focusedCell(element)).to.equal('1:0');
  });
});

describe('data-grid modified arrows', () => {
  it('leaves Alt+Arrow and Cmd+Arrow on a body cell to the browser', async () => {
    const element = await dataGrid(html`
      <lr-data-grid label="People" row-key="id" .columns=${columns} .data=${rows}></lr-data-grid>
    `);
    await focusByKeyboard(cell(element, 0, 0));
    for (const modifier of [{ altKey: true }, { metaKey: true }]) {
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true, cancelable: true, ...modifier });
      cell(element, 0, 0).dispatchEvent(event);
      await element.updateComplete;
      expect(event.defaultPrevented).to.equal(false);
      expect(focusedCell(element)).to.equal('0:0');
    }
  });
});

describe('data-grid built-in search', () => {
  it('reports user edits and clears of the search box with lr-search-change', async () => {
    const element = await dataGrid(html`
      <lr-data-grid label="People" with-search row-key="id" .columns=${columns} .data=${rows}></lr-data-grid>
    `);
    const terms: string[] = [];
    element.addEventListener('lr-search-change', (event) => terms.push(event.detail.searchTerm));
    const search = element.shadowRoot!.querySelector<HTMLInputElement>('[part="search"]')!;
    search.focus();
    await sendKeys({ type: 'gr' });
    await element.updateComplete;
    expect(element.searchTerm).to.equal('gr');
    element.shadowRoot!.querySelector<HTMLButtonElement>('[part="search-clear"]')!.click();
    await element.updateComplete;
    element.searchTerm = 'programmatic';
    await element.updateComplete;
    expect(terms).to.deep.equal(['g', 'gr', '']);
  });
});

describe('data-grid selection pruned by a data refresh', () => {
  it('reports keys a refresh removed from the controlled selection with lr-row-select', async () => {
    const element = await dataGrid(html`
      <lr-data-grid label="People" selectable="multiple" row-key="id" .columns=${columns} .data=${rows}
        .selectedRowKeys=${[1, 2]}></lr-data-grid>
    `);
    const events: unknown[][] = [];
    element.addEventListener('lr-row-select', (event) => events.push([...event.detail.selectedRowKeys]));
    element.data = rows.filter((row) => row.id !== 2);
    await element.updateComplete;
    expect([...element.selectedKeys]).to.deep.equal([1]);
    expect(events).to.deep.equal([[1]]);
    element.data = [...rows];
    await element.updateComplete;
    expect(events).to.deep.equal([[1]]);
  });
});

describe('data-grid pinned cells over row state fills', () => {
  it('keeps a pinned cell opaque while its row shows the translucent hover fill', async () => {
    const wide = [
      { id: 'name', field: 'name', label: 'Name', pinned: 'left' as const, width: 120 },
      ...Array.from({ length: 8 }, (_, index) => ({ id: `c${index}`, field: 'team', label: `Team ${index}`, width: 160 })),
    ];
    const element = await dataGrid(html`
      <lr-data-grid style="inline-size: 420px" label="People" pinnable row-key="id" .columns=${wide} .data=${rows}></lr-data-grid>
    `);
    const body = element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
    body.scrollLeft = 300;
    body.dispatchEvent(new Event('scroll'));
    await element.updateComplete;
    const row = element.shadowRoot!.querySelector<HTMLElement>('[part~="row"]')!;
    const pinned = row.querySelector<HTMLElement>('[data-pin="left"]')!;
    await hoverUntilMatched(pinned, 'the pinned cell never registered :hover');
    await waitUntil(() => row.matches(':hover'));
    // `rgba(r, g, b, a)`, `rgb(r g b / a)` or `color(srgb r g b / a)`: the alpha is the slash or
    // fourth comma component; none means opaque.
    const alpha = (color: string): number => {
      const inner = /\(([^)]*)\)/.exec(color)?.[1] ?? '';
      if (inner.includes('/')) return Number(inner.split('/')[1]!.trim());
      const commas = inner.split(',');
      return commas.length === 4 ? Number(commas[3]!.trim()) : 1;
    };
    // The row's fill change transitions; wait for it to reach its translucent hover value.
    await waitUntil(() => alpha(getComputedStyle(row).backgroundColor) < 1, 'the row fill never turned translucent');
    expect(alpha(getComputedStyle(pinned).backgroundColor)).to.equal(1);
    expect(getComputedStyle(pinned).backgroundImage).to.contain('gradient');
    await resetMouse();
  });
});

describe('data-grid column resize parity with lr-table', () => {
  const sized = [
    { id: 'name', field: 'name', label: 'Name', width: 200, minWidth: 80, maxWidth: 400 },
    { id: 'team', field: 'team', label: 'Team' },
  ];

  it('supports Shift, Home and End steps and reports columnKey alongside columnId', async () => {
    const element = await dataGrid(html`
      <lr-data-grid label="People" resizable row-key="id" .columns=${sized} .data=${rows}></lr-data-grid>
    `);
    const handle = element.shadowRoot!.querySelector<HTMLElement>('[role="columnheader"][data-column-id="name"] [part="resize-handle"]')!;
    const widths: Array<{ columnId: string; columnKey: string; width: number }> = [];
    element.addEventListener('lr-column-resize', (event) => {
      const { columnId, columnKey, width } = event.detail;
      widths.push({ columnId, columnKey, width });
    });
    await focusByKeyboard(handle);
    await sendKeys({ press: 'Shift+ArrowRight' });
    await sendKeys({ press: 'End' });
    await sendKeys({ press: 'Home' });
    expect(widths.map((entry) => entry.width)).to.deep.equal([250, 400, 80]);
    expect(widths.every((entry) => entry.columnId === 'name' && entry.columnKey === 'name')).to.equal(true);
  });

  it('lets a cancelable lr-column-resize-request veto a keyboard step', async () => {
    const element = await dataGrid(html`
      <lr-data-grid label="People" resizable row-key="id" .columns=${sized} .data=${rows}></lr-data-grid>
    `);
    const handle = element.shadowRoot!.querySelector<HTMLElement>('[role="columnheader"][data-column-id="name"] [part="resize-handle"]')!;
    const requests: number[] = [];
    element.addEventListener('lr-column-resize-request', (event) => {
      requests.push(event.detail.width);
      event.preventDefault();
    });
    let commits = 0;
    element.addEventListener('lr-column-resize', () => {
      commits += 1;
    });
    await focusByKeyboard(handle);
    await sendKeys({ press: 'ArrowRight' });
    await element.updateComplete;
    expect(requests).to.deep.equal([210]);
    expect(commits).to.equal(0);
    expect(element.getState().widths?.['name']).to.equal(undefined);
  });
});
