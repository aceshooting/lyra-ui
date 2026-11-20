import { expect, fixture, html } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import '../../lr-data-grid.js';
import type { LyraDataGrid } from '../../lr-data-grid.js';
import type { DataGridColumn } from './data-grid-types.js';
import { type Person, columns, rows, dataGrid, header } from '../../../../test/data-grid.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

function focusedCell(element: LyraDataGrid<Person>): string {
  const active = element.shadowRoot!.activeElement;
  if (!active) return 'none';
  return `${active.getAttribute('data-row-position')}:${active.getAttribute('data-column-position')}`;
}

describe('data-grid header panel toggles', () => {
  it('closes the filter panel when its own filter button is pressed again', async () => {
    const element = await dataGrid(html`<lr-data-grid label="People" .columns=${columns} .data=${rows}></lr-data-grid>`);
    const button = header(element, 'team').querySelector<HTMLButtonElement>('[part="filter-button"]')!;
    button.click();
    await element.updateComplete;
    expect(button.getAttribute('aria-expanded')).to.equal('true');
    expect(element.shadowRoot!.querySelectorAll('[part="filter-panel"]').length).to.equal(1);
    button.click();
    await element.updateComplete;
    expect(button.getAttribute('aria-expanded')).to.equal('false');
    expect(element.shadowRoot!.querySelectorAll('[part="filter-panel"]').length).to.equal(0);
  });

  it('closes a column menu when its own menu button is pressed again, and swaps menus between columns', async () => {
    const element = await dataGrid(html`<lr-data-grid label="People" with-column-menu .columns=${columns} .data=${rows}></lr-data-grid>`);
    const nameMenu = header(element, 'name').querySelector<HTMLButtonElement>('[part="column-menu-button"]')!;
    const scoreMenu = header(element, 'score').querySelector<HTMLButtonElement>('[part="column-menu-button"]')!;
    nameMenu.click();
    await element.updateComplete;
    expect(nameMenu.getAttribute('aria-expanded')).to.equal('true');
    scoreMenu.click();
    await element.updateComplete;
    expect([nameMenu, scoreMenu].map((button) => button.getAttribute('aria-expanded'))).to.deep.equal(['false', 'true']);
    scoreMenu.click();
    await element.updateComplete;
    expect([nameMenu, scoreMenu].map((button) => button.getAttribute('aria-expanded'))).to.deep.equal(['false', 'false']);
  });
});

describe('data-grid group disclosure keys', () => {
  it('moves between cells when the arrow already matches the group state', async () => {
    const element = await dataGrid(html`
      <lr-data-grid label="Teams" group-by="team" row-key="id" .columns=${columns} .data=${rows}></lr-data-grid>
    `);
    const groupCell = element.shadowRoot!.querySelector<HTMLElement>('[part="group-row"] [part="group-value"]')!;
    await focusByKeyboard(groupCell);
    const groupPosition = groupCell.closest<HTMLElement>('[data-row-position]')?.getAttribute('data-row-position')
      ?? groupCell.getAttribute('data-row-position');
    // Collapsed: ArrowLeft has nothing to collapse and does not expand the group.
    await sendKeys({ press: 'ArrowLeft' });
    await element.updateComplete;
    expect(element.shadowRoot!.querySelectorAll('[part~="row"]').length).to.equal(0);
    await sendKeys({ press: 'ArrowRight' });
    await element.updateComplete;
    expect(element.shadowRoot!.querySelectorAll('[part~="row"]').length).to.equal(2);
    // Expanded: a second ArrowRight leaves the group open.
    await sendKeys({ press: 'ArrowRight' });
    await element.updateComplete;
    expect(element.shadowRoot!.querySelectorAll('[part~="row"]').length).to.equal(2);
    expect(groupPosition).to.not.equal(null);
  });
});

describe('data-grid page keys without pagination', () => {
  it('pages ten rows at a time when page-size is zero', async () => {
    const many: Person[] = Array.from({ length: 25 }, (_, index) => ({ id: index + 1, name: `P${index + 1}`, team: 'T', score: index }));
    const element = (await fixture(html`
      <lr-data-grid label="People" page-size="0" row-key="id" style="block-size: 2000px" .columns=${columns} .data=${many}></lr-data-grid>
    `)) as unknown as LyraDataGrid<Person>;
    await element.updateComplete;
    const first = element.shadowRoot!.querySelector<HTMLElement>('[role="gridcell"][data-row-position="0"][data-column-position="0"]')!;
    await focusByKeyboard(first);
    await sendKeys({ press: 'PageDown' });
    await element.updateComplete;
    expect(focusedCell(element)).to.equal('10:0');
    await sendKeys({ press: 'PageUp' });
    await element.updateComplete;
    expect(focusedCell(element)).to.equal('0:0');
  });
});

describe('data-grid resize sessions', () => {
  const resizable: DataGridColumn<Person>[] = [
    { field: 'name', label: 'Name', width: 160, minWidth: 40 },
    { field: 'score', label: 'Score' },
  ];

  function pointer(type: string, pointerId: number, clientX: number): PointerEvent {
    return new PointerEvent(type, { pointerId, clientX, bubbles: true, composed: true, cancelable: true });
  }

  it('ignores a cancel from another pointer and restores the start width on its own cancel', async () => {
    const element = await dataGrid(html`<lr-data-grid label="People" resizable .columns=${resizable} .data=${rows}></lr-data-grid>`);
    const widths: Array<{ width: number; finished: boolean }> = [];
    element.addEventListener('lr-column-resize', (event) => widths.push((event as CustomEvent).detail));
    const handle = header(element, 'name').querySelector<HTMLElement>('[part="resize-handle"]')!;
    const start = header(element, 'name').getBoundingClientRect().width;
    handle.dispatchEvent(pointer('pointerdown', 4, 100));
    handle.dispatchEvent(pointer('pointermove', 4, 140));
    handle.dispatchEvent(pointer('pointercancel', 9, 140));
    await element.updateComplete;
    expect(element.getState().widths?.['name']).to.be.closeTo(start + 40, 1);
    handle.dispatchEvent(pointer('pointercancel', 4, 140));
    await element.updateComplete;
    expect(element.getState().widths?.['name']).to.equal(undefined);
    expect(widths.at(-1)?.finished).to.equal(false);
    expect(widths.at(-1)?.width).to.be.closeTo(start, 1);
  });

  it('restores a moved session when a second press starts a new one', async () => {
    const element = await dataGrid(html`<lr-data-grid label="People" resizable .columns=${resizable} .data=${rows}></lr-data-grid>`);
    const widths: number[] = [];
    element.addEventListener('lr-column-resize', (event) => widths.push((event as CustomEvent).detail.width));
    const handle = header(element, 'name').querySelector<HTMLElement>('[part="resize-handle"]')!;
    const start = header(element, 'name').getBoundingClientRect().width;
    handle.dispatchEvent(pointer('pointerdown', 5, 100));
    handle.dispatchEvent(pointer('pointermove', 5, 160));
    handle.dispatchEvent(pointer('pointerdown', 6, 100));
    await element.updateComplete;
    // The abandoned preview is rolled back and reported before the new session starts.
    expect(element.getState().widths?.['name']).to.equal(undefined);
    expect(widths.at(-1)).to.be.closeTo(start, 1);
    handle.dispatchEvent(pointer('pointerup', 6, 100));
  });

  it('discards the live preview when the final width request is vetoed', async () => {
    const element = await dataGrid(html`<lr-data-grid label="People" resizable .columns=${resizable} .data=${rows}></lr-data-grid>`);
    element.addEventListener('lr-column-resize-request', (event) => event.preventDefault());
    const finished: boolean[] = [];
    element.addEventListener('lr-column-resize', (event) => finished.push((event as CustomEvent).detail.finished));
    const handle = header(element, 'name').querySelector<HTMLElement>('[part="resize-handle"]')!;
    handle.dispatchEvent(pointer('pointerdown', 7, 100));
    handle.dispatchEvent(pointer('pointermove', 7, 180));
    handle.dispatchEvent(pointer('pointerup', 7, 180));
    await element.updateComplete;
    expect(element.getState().widths?.['name']).to.equal(undefined);
    expect(finished).to.not.include(true);
  });

  it('steps a keyboard resize from the estimate when the header has no rendered width', async () => {
    const wrapper = (await fixture(html`<div>
      <lr-data-grid label="People" resizable .columns=${[{ field: 'name', label: 'Name', minWidth: 40 }, { field: 'score', label: 'Score' }]} .data=${rows}></lr-data-grid>
    </div>`)) as HTMLElement;
    const element = wrapper.querySelector('lr-data-grid') as unknown as LyraDataGrid<Person>;
    await element.updateComplete;
    const requested: number[] = [];
    element.addEventListener('lr-column-resize-request', (event) => requested.push((event as CustomEvent).detail.width));
    const handle = header(element, 'name').querySelector<HTMLElement>('[part="resize-handle"]')!;
    wrapper.style.display = 'none';
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true, cancelable: true }));
    await element.updateComplete;
    wrapper.style.display = '';
    expect(requested.length).to.equal(1);
    expect(Number.isFinite(requested[0])).to.equal(true);
    expect(requested[0]).to.be.greaterThan(40);
  });
});

describe('data-grid collection normalization', () => {
  it('drops blank, duplicate and non-string ids from an assigned column order', async () => {
    const element = await dataGrid(html`<lr-data-grid label="People" .columns=${columns} .data=${rows}></lr-data-grid>`);
    element.columnOrder = ['score', '', '  ', 'score', 42, 'name'] as unknown as readonly string[];
    await element.updateComplete;
    expect([...element.columnOrder]).to.deep.equal(['score', 'name']);
    const headers = [...element.shadowRoot!.querySelectorAll<HTMLElement>('[role="columnheader"][data-column-id]')]
      .map((cell) => cell.dataset['columnId']);
    expect(headers).to.deep.equal(['score', 'name', 'team']);
  });

  it('treats a non-array page-size-options value as no options', async () => {
    const element = await dataGrid(html`<lr-data-grid label="People" page-size="2" .pageSizeOptions=${[1, 2]} .columns=${columns} .data=${rows}></lr-data-grid>`);
    element.pageSizeOptions = 'ten' as unknown as readonly number[];
    await element.updateComplete;
    expect([...element.pageSizeOptions]).to.deep.equal([]);
  });
});

describe('data-grid footer and wide layouts', () => {
  it('renders string, computed and absent footers side by side', async () => {
    const footed: DataGridColumn<Person>[] = [
      { field: 'name', label: 'Name', footer: 'Total' },
      { field: 'team', label: 'Team' },
      { field: 'score', label: 'Score', footer: (all) => all.reduce((sum, row) => sum + row.score, 0) },
    ];
    const element = await dataGrid(html`<lr-data-grid label="People" .columns=${footed} .data=${rows}></lr-data-grid>`);
    const footers = [...element.shadowRoot!.querySelectorAll<HTMLElement>('[part="footer-cell"]')].map((cell) => cell.textContent!.trim());
    expect(footers).to.deep.equal(['Total', '', '26']);
  });

  it('windows more than fifty columns while loading, even over an error, but not for a settled error', async () => {
    const wide: DataGridColumn<Person>[] = Array.from({ length: 51 }, (_, index) => ({ id: `c${index}`, label: `C${index}`, value: (row: Person) => `${row.name}${index}` }));
    const element = await dataGrid(html`<lr-data-grid label="Wide" .columns=${wide} .data=${rows}></lr-data-grid>`);
    const body = () => element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
    expect(body().classList.contains('column-windowed')).to.equal(true);
    element.error = true;
    element.loading = true;
    await element.updateComplete;
    expect(body().classList.contains('column-windowed')).to.equal(true);
    element.loading = false;
    await element.updateComplete;
    expect(body().classList.contains('column-windowed')).to.equal(false);
  });
});

describe('data-grid scrollToIndex', () => {
  it('leaves the viewport alone for a processed row hidden inside a collapsed group', async () => {
    const element = await dataGrid(html`
      <lr-data-grid label="Teams" group-by="team" row-key="id" style="block-size: 120px" .columns=${columns} .data=${rows}></lr-data-grid>
    `);
    const body = element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
    expect(element.getVisibleRows().length).to.equal(3);
    element.scrollToIndex(2, { align: 'start' });
    await element.updateComplete;
    expect(body.scrollTop).to.equal(0);
    expect(element.shadowRoot!.querySelectorAll('[part~="row"]').length).to.equal(0);
  });
});

describe('data-grid source projection', () => {
  it('skips primitive entries and repeated row objects in client data', async () => {
    const [ada, lin] = rows;
    const mixed = [ada, 5, null, 'text', ada, lin] as unknown as Person[];
    const element = await dataGrid(html`<lr-data-grid label="People" row-key="id" .columns=${columns} .data=${mixed}></lr-data-grid>`);
    const names = [...element.shadowRoot!.querySelectorAll<HTMLElement>('[part~="row"]')]
      .map((row) => row.querySelector('[role="gridcell"]')?.textContent?.trim());
    expect(names).to.deep.equal(['Ada', 'Lin']);
    expect(element.dataTruncated).to.equal(false);
  });

  it('reports a truncated tree when max-rows is reached with nested rows still pending', async () => {
    const tree: Person[] = [
      {
        id: 1, name: 'Root', team: 'T', score: 1,
        children: [
          { id: 2, name: 'One', team: 'T', score: 2 },
          { id: 3, name: 'Two', team: 'T', score: 3 },
          { id: 4, name: 'Three', team: 'T', score: 4 },
        ],
      },
    ];
    const element = await dataGrid(html`<lr-data-grid label="Tree" row-key="id" child-rows="children" max-rows="2" .columns=${columns} .data=${tree}></lr-data-grid>`);
    expect(element.dataTruncated).to.equal(true);
    expect(element.shadowRoot!.querySelector('[part="tree-limit"]')).to.not.equal(null);
  });

  it('lists a child object repeated under one parent only once', async () => {
    const child: Person = { id: 2, name: 'Child', team: 'T', score: 2 };
    const tree: Person[] = [{ id: 1, name: 'Root', team: 'T', score: 1, children: [child, child] }];
    const element = await dataGrid(html`<lr-data-grid label="Tree" row-key="id" child-rows="children" .expandedRowKeys=${[1]} .columns=${columns} .data=${tree}></lr-data-grid>`);
    const names = [...element.shadowRoot!.querySelectorAll<HTMLElement>('[part~="row"]')]
      .map((row) => row.querySelector('[role="gridcell"]')?.textContent?.trim());
    expect(names).to.deep.equal(['Root', 'Child']);
  });
});
