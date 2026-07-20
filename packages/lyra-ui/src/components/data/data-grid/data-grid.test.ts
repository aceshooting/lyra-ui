import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './data-grid.js';
import type { LyraDataGrid, DataGridColumn } from './data-grid.js';
import { styles } from './data-grid.styles.js';

it('renders rows and exposes grid semantics', async () => {
  const columns: DataGridColumn[] = [{ key: 'name', label: 'Name', sortable: true }, { key: 'count', label: 'Count' }];
  const el = (await fixture(html`<lr-data-grid .columns=${columns} .rows=${[{ name: 'Alpha', count: 2 }]} aria-label="Results"></lr-data-grid>`)) as LyraDataGrid;
  expect(el.shadowRoot!.querySelector('[role="grid"]')!.getAttribute('aria-label')).to.equal('Results');
  expect(el.shadowRoot!.querySelectorAll('[role="gridcell"]')).to.have.length(2);
});

it('is accessible', async () => {
  const el = await fixture(html`<lr-data-grid aria-label="Results"></lr-data-grid>`);
  await expect(el).to.be.accessible();
});

it('is accessible with populated rows, a sorted sortable column, and a selected row', async () => {
  // Populated-state axe check: the header buttons, aria-sort, gridcells, and the
  // aria-selected row only exist once data is present — the empty-state axe test above
  // exercises none of them. Assert the populated markers rendered before running axe.
  const columns: DataGridColumn[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'count', label: 'Count' },
  ];
  const rows = [
    { name: 'Alpha', count: 2 },
    { name: 'Beta', count: 5 },
  ];
  const el = (await fixture(
    html`<lr-data-grid
      .columns=${columns}
      .rows=${rows}
      .sortKey=${'name'}
      .sortDirection=${'descending'}
      .selectedKey=${1}
      aria-label="Results"
    ></lr-data-grid>`,
  )) as LyraDataGrid;
  expect(el.shadowRoot!.querySelectorAll('[role="gridcell"]')).to.have.length(4);
  expect(el.shadowRoot!.querySelector('[aria-sort="descending"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[aria-selected="true"]')).to.exist;
  await expect(el).to.be.accessible();
});

it('renders aria-selected="true"/"false" on rows matching the selected-state contract', async () => {
  const columns: DataGridColumn[] = [{ key: 'name', label: 'Name' }];
  const rows = [{ name: 'Alpha' }, { name: 'Beta' }];
  const el = (await fixture(
    html`<lr-data-grid .columns=${columns} .rows=${rows} .selectedKey=${1} aria-label="Results"></lr-data-grid>`,
  )) as LyraDataGrid;
  const trs = el.shadowRoot!.querySelectorAll('tbody tr');
  expect(trs[0].getAttribute('aria-selected')).to.equal('false');
  expect(trs[1].getAttribute('aria-selected')).to.equal('true');
});

it('activates a row on a single click, firing lr-row-click and lr-selection-change', async () => {
  const columns: DataGridColumn[] = [{ key: 'name', label: 'Name' }];
  const rows = [{ name: 'Alpha' }, { name: 'Beta' }];
  const el = (await fixture(
    html`<lr-data-grid .columns=${columns} .rows=${rows} aria-label="Results"></lr-data-grid>`,
  )) as LyraDataGrid;
  const rowClickListener = oneEvent(el, 'lr-row-click');
  const selectionListener = oneEvent(el, 'lr-selection-change');
  const row = el.shadowRoot!.querySelectorAll('tbody tr')[1] as HTMLElement;
  row.click();
  const rowClickEvent = await rowClickListener;
  const selectionEvent = await selectionListener;
  expect((rowClickEvent as CustomEvent).detail.row).to.deep.equal(rows[1]);
  expect((selectionEvent as CustomEvent).detail.row).to.deep.equal(rows[1]);
  expect(el.selectedKey).to.equal(1);
});

it('moves roving tabindex to a cell that receives focus via a mouse click, not just via keyboard nav', async () => {
  const columns: DataGridColumn[] = [{ key: 'name', label: 'Name' }, { key: 'count', label: 'Count' }];
  const rows = [{ name: 'Alpha', count: 1 }, { name: 'Beta', count: 2 }];
  const el = (await fixture(
    html`<lr-data-grid .columns=${columns} .rows=${rows} aria-label="Results"></lr-data-grid>`,
  )) as LyraDataGrid;
  const targetCell = el.shadowRoot!.querySelector('[data-row="1"][data-column="1"]') as HTMLElement;
  targetCell.focus();
  await el.updateComplete;
  expect(targetCell.getAttribute('tabindex')).to.equal('0');
  const otherCells = el.shadowRoot!.querySelectorAll('[role="gridcell"][tabindex="0"]');
  expect(otherCells).to.have.length(1);
  expect(otherCells[0]).to.equal(targetCell);
});

it('keeps exactly one body-cell tab stop after rows shrink below the focused row index', async () => {
  const columns: DataGridColumn[] = [{ key: 'name', label: 'Name' }, { key: 'count', label: 'Count' }];
  const rows = Array.from({ length: 10 }, (_, i) => ({ name: `Row ${i}`, count: i }));
  const el = (await fixture(
    html`<lr-data-grid .columns=${columns} .rows=${rows} aria-label="Results"></lr-data-grid>`,
  )) as LyraDataGrid;
  const targetCell = el.shadowRoot!.querySelector('[data-row="5"][data-column="1"]') as HTMLElement;
  targetCell.focus();
  await el.updateComplete;
  expect(targetCell.getAttribute('tabindex')).to.equal('0');
  el.rows = rows.slice(0, 3);
  await el.updateComplete;
  const stops = el.shadowRoot!.querySelectorAll('[role="gridcell"][tabindex="0"]');
  expect(stops).to.have.length(1);
  expect(stops[0].getAttribute('data-row')).to.equal('2');
  expect(stops[0].getAttribute('data-column')).to.equal('1');
});

it('keeps exactly one body-cell tab stop after columns shrink below the focused column index', async () => {
  const columns: DataGridColumn[] = [{ key: 'name', label: 'Name' }, { key: 'count', label: 'Count' }];
  const rows = [{ name: 'Alpha', count: 1 }, { name: 'Beta', count: 2 }];
  const el = (await fixture(
    html`<lr-data-grid .columns=${columns} .rows=${rows} aria-label="Results"></lr-data-grid>`,
  )) as LyraDataGrid;
  const targetCell = el.shadowRoot!.querySelector('[data-row="1"][data-column="1"]') as HTMLElement;
  targetCell.focus();
  await el.updateComplete;
  el.columns = columns.slice(0, 1);
  await el.updateComplete;
  const stops = el.shadowRoot!.querySelectorAll('[role="gridcell"][tabindex="0"]');
  expect(stops).to.have.length(1);
  expect(stops[0].getAttribute('data-row')).to.equal('1');
  expect(stops[0].getAttribute('data-column')).to.equal('0');
});

it('leaves header cells without tabindex so the sort button is the only header tab stop', async () => {
  const columns: DataGridColumn[] = [{ key: 'name', label: 'Name', sortable: true }, { key: 'count', label: 'Count' }];
  const el = (await fixture(
    html`<lr-data-grid .columns=${columns} .rows=${[{ name: 'Alpha', count: 1 }]} aria-label="Results"></lr-data-grid>`,
  )) as LyraDataGrid;
  const headers = el.shadowRoot!.querySelectorAll('th');
  expect(headers).to.have.length(2);
  for (const th of headers) expect(th.hasAttribute('tabindex'), 'th must not carry its own tab stop').to.be.false;
});

it('swaps ArrowLeft/ArrowRight under dir="rtl" for roving cell navigation', async () => {
  const columns: DataGridColumn[] = [{ key: 'name', label: 'Name' }, { key: 'count', label: 'Count' }];
  const rows = [{ name: 'Alpha', count: 1 }];
  const el = (await fixture(
    html`<lr-data-grid dir="rtl" .columns=${columns} .rows=${rows} aria-label="Results"></lr-data-grid>`,
  )) as LyraDataGrid;
  await el.updateComplete;
  const firstCell = el.shadowRoot!.querySelector('[data-row="0"][data-column="0"]') as HTMLElement;
  firstCell.focus();
  firstCell.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[data-row="0"][data-column="1"]')!.getAttribute('tabindex')).to.equal('0');
});

it('scrolls [part="viewport"] horizontally rather than overflowing a 320px container', async () => {
  // `parentNode` is an open-wc fixture option -- the fixture wrapper appends it under
  // `document.body` itself and the global afterEach fixtureCleanup removes it, so this
  // test must not append/remove it manually (that would double-remove the node).
  const container = document.createElement('div');
  container.style.inlineSize = '320px';
  const columns: DataGridColumn[] = [
    { key: 'name', label: 'Name', width: '10rem' },
    { key: 'role', label: 'Role', width: '10rem' },
    { key: 'location', label: 'Location', width: '10rem' },
    { key: 'email', label: 'Email', width: '14rem' },
  ];
  const el = (await fixture(
    html`<lr-data-grid
      aria-label="People"
      .columns=${columns}
      .rows=${[{ name: 'Ada Lovelace', role: 'Mathematician', location: 'London', email: 'ada@example.com' }]}
    ></lr-data-grid>`,
    { parentNode: container },
  )) as LyraDataGrid;
  await el.updateComplete;

  // The host's own box must not overflow the 320px allocation -- it can only stay
  // within it if the viewport scrolls instead of forcing the table to widen the host.
  expect((el as HTMLElement).getBoundingClientRect().width).to.be.at.most(320);
  const viewport = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
  expect(getComputedStyle(viewport).overflow).to.equal('auto');
  expect(viewport.scrollWidth).to.be.greaterThan(viewport.clientWidth);
});

it('wires the sort-header focus ring and hover state to the actual focusable button, not the inert th', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  // A <th role="columnheader"> with no tabindex can never itself receive focus -- only the
  // nested sort <button> can, so the ring must target that, not the <th>.
  expect(css).to.match(/th button:focus-visible[^{]*\{[^}]*outline:/);
  expect(css).to.not.match(/(?<!button )th:focus-visible/);
  expect(css).to.match(/th button:hover[^{]*\{[^}]*background:/);
});

describe('--lr-data-grid-row-selected-bg', () => {
  const columns: DataGridColumn[] = [{ key: 'name', label: 'Name' }];
  const rows = [{ name: 'Alpha' }, { name: 'Beta' }];
  const selectionFixture = async (): Promise<LyraDataGrid> =>
    (await fixture(
      html`<lr-data-grid .columns=${columns} .rows=${rows} .selectedKey=${1} aria-label="Results"></lr-data-grid>`,
    )) as LyraDataGrid;

  it('recolors only the selected row, leaving the unselected one alone', async () => {
    const el = await selectionFixture();
    el.style.setProperty('--lr-data-grid-row-selected-bg', 'rgb(10, 20, 30)');
    const trs = [...el.shadowRoot!.querySelectorAll('tbody tr')] as HTMLElement[];
    const cells = trs.map((tr) => tr.querySelector('td') as HTMLElement);
    expect(trs[1].getAttribute('aria-selected')).to.equal('true');
    expect(getComputedStyle(cells[1]).backgroundColor).to.equal('rgb(10, 20, 30)');
    expect(getComputedStyle(cells[0]).backgroundColor).to.not.equal('rgb(10, 20, 30)');
  });

  it('renders byte-identically to the brand-quiet token default when unset', async () => {
    const el = await selectionFixture();
    const selectedCell = el.shadowRoot!.querySelector('tr[data-selected="true"] td') as HTMLElement;
    const unset = getComputedStyle(selectedCell).backgroundColor;
    el.style.setProperty('--lr-data-grid-row-selected-bg', 'var(--lr-color-brand-quiet)');
    expect(getComputedStyle(selectedCell).backgroundColor).to.equal(unset);
  });
});
