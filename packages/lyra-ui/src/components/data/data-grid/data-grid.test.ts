import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './data-grid.js';
import type { LyraDataGrid } from './data-grid.js';
import type { DataGridColumn, DataGridState } from './data-grid-types.js';
import {
  aggregateValues,
  filterRows,
  matchesFilter,
  rowsAsDelimited,
  searchRows,
  sortRows,
} from './data-grid-processing.js';

interface Person {
  id: number;
  name: string;
  team: string;
  score: number;
  tags?: string[];
  children?: Person[];
}

const columns: DataGridColumn<Person>[] = [
  { field: 'name', label: 'Name' },
  { field: 'team', label: 'Team', filterable: true },
  { field: 'score', label: 'Score' },
];

const rows: Person[] = [
  { id: 1, name: 'Ada', team: 'Compiler', score: 7 },
  { id: 2, name: 'Lin', team: 'Runtime', score: 10 },
  { id: 3, name: 'Grace', team: 'Compiler', score: 9 },
];

async function dataGrid(
  template = html`<lr-data-grid label="People"></lr-data-grid>`,
): Promise<LyraDataGrid<Person>> {
  const element = (await fixture(template)) as LyraDataGrid<Person>;
  await element.updateComplete;
  return element;
}

const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function header(element: LyraDataGrid<unknown>, id: string): HTMLElement {
  const result = element.shadowRoot!.querySelector<HTMLElement>(
    `[part~="header-cell"][data-column-id="${id}"]`,
  );
  if (!result) throw new Error(`Missing ${id} header`);
  return result;
}

function dataCells(element: LyraDataGrid<unknown>): HTMLElement[] {
  return [...element.shadowRoot!.querySelectorAll<HTMLElement>('[part~="cell"][data-row-position]')];
}

it('exposes the exact public defaults', async () => {
  const element = await dataGrid();
  expect(element.appearance).to.equal('outlined');
  expect(element.childRows).to.equal(null);
  expect(element.columnOrder).to.deep.equal([]);
  expect(element.columns).to.deep.equal([]);
  expect(element.data).to.deep.equal([]);
  expect(element.dataSource).to.equal(null);
  expect(element.expandedKeys).to.deep.equal([]);
  expect(element.filterDebounce).to.equal(250);
  expect(element.filteredCount).to.equal(0);
  expect(element.filterFromLeafRows).to.equal(false);
  expect(element.filters).to.deep.equal([]);
  expect(element.groupBy).to.equal(null);
  expect(element.loading).to.equal(false);
  expect(element.maxMultiSort).to.equal(0);
  expect(element.page).to.equal(0);
  expect(element.pageCount).to.equal(0);
  expect(element.pageSize).to.equal(20);
  expect(element.pageSizeOptions).to.deep.equal([10, 20, 50, 100]);
  expect(element.paginate).to.equal(false);
  expect(element.pinnable).to.equal(false);
  expect(element.reorderable).to.equal(false);
  expect(element.resizable).to.equal(false);
  expect(element.rowClass).to.equal(null);
  expect(element.rowDetail).to.equal(null);
  expect(element.rowKey).to.equal(null);
  expect(element.searchFn).to.equal(null);
  expect(element.searchTerm).to.equal('');
  expect(element.selectable).to.equal('none');
  expect(element.selectableRows).to.equal(null);
  expect(element.selectedKeys).to.deep.equal([]);
  expect(element.selectedRows).to.deep.equal([]);
  expect(element.server).to.equal(false);
  expect(element.size).to.equal('m');
  expect(element.sort).to.deep.equal([]);
  expect(element.sortDescFirst).to.equal(false);
  expect(element.striped).to.equal(false);
  expect(element.total).to.equal(-1);
  expect(element.withColumnMenu).to.equal(false);
  expect(element.withColumnsMenu).to.equal(false);
  expect(element.withoutSortRemoval).to.equal(false);
  expect(element.withSearch).to.equal(false);
});

it('reflects the documented attribute surface and treats a bare selectable as multiple', async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      appearance="plain"
      filter-debounce="15"
      filter-from-leaf-rows
      group-by="team"
      loading
      max-multi-sort="2"
      page="3"
      page-size="5"
      paginate
      pinnable
      reorderable
      resizable
      row-key="id"
      selectable
      server
      size="large"
      sort-desc-first
      striped
      total="42"
      with-column-menu
      with-columns-menu
      without-sort-removal
      with-search
      label="People"
    ></lr-data-grid>
  `);

  expect(element.selectable).to.equal('multiple');
  expect(element.groupBy).to.equal('team');
  for (const attribute of [
    'filter-from-leaf-rows', 'loading', 'paginate', 'pinnable', 'reorderable', 'resizable',
    'server', 'sort-desc-first', 'striped', 'with-column-menu', 'with-columns-menu',
    'without-sort-removal', 'with-search',
  ]) expect(element.hasAttribute(attribute), attribute).to.equal(true);
});

it('implements all 26 public methods', async () => {
  const element = await dataGrid();
  const methods = [
    'autoSizeColumn', 'autoSizeColumns', 'collapseAllRows', 'collapseRow', 'copySelectedRows',
    'expandAllRows', 'expandRow', 'exportDataAsCsv', 'focus', 'getColumnFacets', 'getColumnPin',
    'getDataAsCsv', 'getProcessedRows', 'getState', 'getVisibleRows', 'handleColumnsChange',
    'handlePageChange', 'handleSearchTermChange', 'pinColumn', 'reload', 'resetColumns',
    'resetState', 'scrollToIndex', 'setState', 'sizeColumnsToFit', 'toggleColumn',
  ];
  for (const method of methods) expect(typeof element[method as keyof LyraDataGrid]).to.equal('function');
});

it('filters, searches, and stable-sorts client rows with locale-aware comparisons', () => {
  const filtered = filterRows(rows, columns, [{ id: 'team', value: 'compiler' }], 'en');
  expect(filtered.map((row) => row.name)).to.deep.equal(['Ada', 'Grace']);
  expect(searchRows(rows, columns, 'lin', 'en', null).map((row) => row.id)).to.deep.equal([2]);
  expect(sortRows(rows, columns, [{ id: 'score', desc: true }], 'en').map((row) => row.id)).to.deep.equal([2, 3, 1]);
});

it('supports every filter algorithm, computed search values, and custom matchers', () => {
  interface FilterRow extends Person { created: string; active: boolean }
  const filterRowsFixture: FilterRow[] = [
    { ...rows[0]!, created: '2026-01-01T12:00:00Z', active: true, tags: ['lit', 'types'] },
    { ...rows[1]!, created: '2026-01-02T12:00:00Z', active: false, tags: ['runtime'] },
    { ...rows[2]!, created: '2026-01-03T12:00:00Z', active: true, tags: ['lit', 'a11y'] },
  ];
  const byName: DataGridColumn<FilterRow> = { field: 'name', filterType: 'equals' };
  const byScore: DataGridColumn<FilterRow> = { field: 'score', filterType: 'number-range' };
  const byDate: DataGridColumn<FilterRow> = { field: 'created', filterType: 'date-range' };
  const byTeam: DataGridColumn<FilterRow> = { field: 'team', filterType: 'set' };
  const byAnyTag: DataGridColumn<FilterRow> = { field: 'tags', filterType: 'includes-any' };
  const byAllTags: DataGridColumn<FilterRow> = { field: 'tags', filterType: 'includes-all' };
  const custom: DataGridColumn<FilterRow> = {
    field: 'active',
    filterFn: (value, filter) => value === filter,
  };

  expect(matchesFilter(filterRowsFixture[0]!, byName, 'ADA', 'en')).to.equal(true);
  expect(filterRows(filterRowsFixture, [byScore], [{ id: 'score', value: [8, 10] }], 'en')
    .map((row) => row.id)).to.deep.equal([2, 3]);
  expect(filterRows(filterRowsFixture, [byDate], [{ id: 'created', value: ['2026-01-02', '2026-01-02'] }], 'en')
    .map((row) => row.id)).to.deep.equal([2]);
  expect(matchesFilter(filterRowsFixture[1]!, byTeam, new Set(['runtime']), 'en')).to.equal(true);
  expect(matchesFilter(filterRowsFixture[2]!, byAnyTag, ['runtime', 'a11y'], 'en')).to.equal(true);
  expect(matchesFilter(filterRowsFixture[0]!, byAllTags, ['types', 'lit'], 'en')).to.equal(true);
  expect(filterRows(filterRowsFixture, [custom], [{ id: 'active', value: true }], 'en')
    .map((row) => row.id)).to.deep.equal([1, 3]);

  const computed: DataGridColumn<FilterRow>[] = [
    { id: 'summary', value: (row) => `${row.team}:${row.score}` },
    { field: 'name', searchable: false },
  ];
  expect(searchRows(filterRowsFixture, computed, 'runtime:10', 'en', null).map((row) => row.id))
    .to.deep.equal([2]);
  expect(searchRows(filterRowsFixture, computed, 'COMPILER:9', 'en', (value, term) =>
    String(value).toLocaleLowerCase('en') === term.toLocaleLowerCase('en'),
  ).map((row) => row.id)).to.deep.equal([3]);
});

it('honors sort algorithms, undefined placement, custom comparators, multisort, and stability', () => {
  interface SortRow { id: number; primary?: number; text: string; date: string }
  const source: SortRow[] = [
    { id: 1, primary: 2, text: 'item 10', date: '2026-02-01' },
    { id: 2, text: 'item 2', date: '2026-01-01' },
    { id: 3, primary: 2, text: 'item 1', date: '2026-03-01' },
  ];
  const sortColumns: DataGridColumn<SortRow>[] = [
    { id: 'primary', field: 'primary', sortFn: 'basic', sortUndefined: 'first' },
    { id: 'text', field: 'text', sortFn: 'alphanumeric' },
    { id: 'date', field: 'date', sortFn: 'datetime' },
    { id: 'custom', value: (row) => row.id, comparator: (left, right) => Number(right) - Number(left) },
  ];
  expect(sortRows(source, sortColumns, [{ id: 'primary', desc: false }], 'en').map((row) => row.id))
    .to.deep.equal([2, 1, 3]);
  expect(sortRows(source, sortColumns, [{ id: 'primary', desc: true }], 'en').map((row) => row.id))
    .to.deep.equal([2, 1, 3]);
  expect(sortRows(source, sortColumns, [{ id: 'text', desc: false }], 'en').map((row) => row.id))
    .to.deep.equal([3, 2, 1]);
  expect(sortRows(source, sortColumns, [{ id: 'date', desc: true }], 'en').map((row) => row.id))
    .to.deep.equal([3, 1, 2]);
  expect(sortRows(source, sortColumns, [
    { id: 'primary', desc: false },
    { id: 'text', desc: false },
  ], 'en').map((row) => row.id)).to.deep.equal([2, 3, 1]);
  expect(sortRows(source, sortColumns, [{ id: 'custom', desc: false }], 'en').map((row) => row.id))
    .to.deep.equal([3, 2, 1]);
  expect(sortRows(source, sortColumns, [], 'en').map((row) => row.id)).to.deep.equal([1, 2, 3]);
});

it('cycles ascending, descending, and removed sorts and enforces additive sort caps', async () => {
  const element = await dataGrid(html`
    <lr-data-grid label="People" max-multi-sort="2" .columns=${columns} .data=${rows}></lr-data-grid>
  `);
  const name = header(element, 'name');
  name.click();
  await element.updateComplete;
  expect(element.sort).to.deep.equal([{ id: 'name', desc: false }]);
  name.click();
  await element.updateComplete;
  expect(element.sort).to.deep.equal([{ id: 'name', desc: true }]);
  name.click();
  await element.updateComplete;
  expect(element.sort).to.deep.equal([]);

  name.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, shiftKey: true }));
  header(element, 'team').dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, shiftKey: true }));
  header(element, 'score').dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, shiftKey: true }));
  await element.updateComplete;
  expect(element.sort).to.deep.equal([
    { id: 'team', desc: false },
    { id: 'score', desc: false },
  ]);

  element.sort = [];
  element.sortDescFirst = true;
  element.withoutSortRemoval = true;
  await element.updateComplete;
  name.click();
  await element.updateComplete;
  expect(element.sort).to.deep.equal([{ id: 'name', desc: true }]);
  name.click();
  name.click();
  await element.updateComplete;
  expect(element.sort).to.deep.equal([{ id: 'name', desc: true }]);
});

it('computes column facets after other filters but before the target filter', async () => {
  const element = await dataGrid(html`
    <lr-data-grid label="People" .columns=${columns} .data=${rows}></lr-data-grid>
  `);
  element.filters = [
    { id: 'team', value: 'compiler' },
    { id: 'score', value: '7' },
  ];
  const facets = element.getColumnFacets('score');
  expect([...facets.uniqueValues.entries()]).to.deep.equal([[7, 1], [9, 1]]);
  expect(facets.minMax).to.deep.equal([7, 9]);
  expect(element.getColumnFacets('missing').uniqueValues.size).to.equal(0);
});

it('supports aggregation and formula-safe CSV export', () => {
  expect(aggregateValues('sum', rows, rows.map((row) => row.score))).to.equal(26);
  const csv = rowsAsDelimited(
    [{ id: 1, name: '=danger', team: 'Compiler', score: 7 }],
    columns,
  );
  expect(csv).to.equal("Name,Team,Score\r\n'=danger,Compiler,7");
});

it('renders a named grid, populated cells, and an axe-clean empty state', async () => {
  const populated = await dataGrid(html`
    <lr-data-grid label="People" .columns=${columns} .data=${rows}></lr-data-grid>
  `);
  const grid = populated.shadowRoot!.querySelector('[role="grid"]')!;
  expect(grid.getAttribute('aria-label')).to.equal('People');
  expect(populated.shadowRoot!.querySelectorAll('[role="row"]')).to.have.length(4);
  expect(populated.shadowRoot!.textContent).to.contain('Ada');
  await expect(populated).to.be.accessible();

  const empty = await dataGrid();
  expect(empty.shadowRoot!.querySelector('[part="empty"]')).to.exist;
  await expect(empty).to.be.accessible();
});

it('sorts from the header and emits the public change event', async () => {
  const element = await dataGrid(html`
    <lr-data-grid label="People" .columns=${columns} .data=${rows}></lr-data-grid>
  `);
  const eventPromise = oneEvent(element, 'lr-sort-change');
  (element.shadowRoot!.querySelector('[part~="header-cell"]') as HTMLElement).click();
  const event = await eventPromise;
  expect(event.detail.sort).to.deep.equal([{ id: 'name', desc: false }]);
  expect(element.getProcessedRows().map((row) => row.name)).to.deep.equal(['Ada', 'Grace', 'Lin']);
});

it('sorts from the focused header with Enter and honors localized string overrides', async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      with-search
      .strings=${{ search: 'Find people' }}
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  expect((element.shadowRoot!.querySelector('[part="search"]') as HTMLInputElement).ariaLabel).to.equal('Find people');
  const header = element.shadowRoot!.querySelector('[part~="header-cell"]') as HTMLElement;
  const eventPromise = oneEvent(element, 'lr-sort-change');
  header.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
  const event = await eventPromise;
  expect(event.detail.sort).to.deep.equal([{ id: 'name', desc: false }]);
});

it('selects eligible rows, maintains selectedRows, and emits keys and rows', async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      selectable="multiple"
      row-key="id"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const eventPromise = oneEvent(element, 'lr-row-select');
  (element.shadowRoot!.querySelector('[part~="row"] input') as HTMLInputElement).click();
  const event = await eventPromise;
  expect(element.selectedKeys).to.deep.equal([1]);
  expect(element.selectedRows).to.deep.equal([rows[0]]);
  expect(event.detail.selectedKeys).to.deep.equal([1]);
});

it('paginates client rows, clamps navigation, and reports page-size changes', async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      paginate
      page="1"
      page-size="2"
      .pageSizeOptions=${[1, 2]}
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  expect(element.pageCount).to.equal(2);
  expect(element.getVisibleRows().map((row) => row.id)).to.deep.equal([3]);

  const previousEvent = oneEvent(element, 'lr-page-change');
  (element.shadowRoot!.querySelector('[part~="previous-button"]') as HTMLButtonElement).click();
  expect((await previousEvent).detail).to.deep.equal({ page: 0, pageSize: 2 });
  expect(element.getVisibleRows().map((row) => row.id)).to.deep.equal([1, 2]);

  const size = element.shadowRoot!.querySelector('[part="page-size"]') as HTMLSelectElement;
  size.value = '1';
  const sizeEvent = oneEvent(element, 'lr-page-change');
  size.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  expect((await sizeEvent).detail).to.deep.equal({ page: 0, pageSize: 1 });
  expect(element.pageCount).to.equal(3);
});

it('paginates top-level groups as units and renders aggregates and group selection', async () => {
  const groupedColumns: DataGridColumn<Person>[] = [
    ...columns.slice(0, 2),
    { field: 'score', label: 'Score', aggregation: 'sum' },
  ];
  const element = await dataGrid(html`
    <lr-data-grid
      label="People by team"
      group-by="team"
      paginate
      page-size="1"
      selectable="multiple"
      row-key="id"
      .columns=${groupedColumns}
      .data=${rows}
    ></lr-data-grid>
  `);
  expect(element.pageCount).to.equal(2);
  const group = element.shadowRoot!.querySelector<HTMLElement>('[part="group-row"]')!;
  expect(group.textContent).to.contain('Compiler');
  expect(group.textContent).to.contain('16');

  const selectEvent = oneEvent(element, 'lr-row-select');
  (group.querySelector('input') as HTMLInputElement).click();
  expect((await selectEvent).detail.selectedKeys).to.deep.equal([1, 3]);

  (group.querySelector('[part="expand-button"]') as HTMLButtonElement).click();
  await element.updateComplete;
  expect(element.shadowRoot!.querySelectorAll('[part~="row"]')).to.have.length(2);
  await expect(element).to.be.accessible();

  element.page = 1;
  await element.updateComplete;
  expect(element.shadowRoot!.querySelector('[part="group-row"]')!.textContent).to.contain('Runtime');
});

it('filters trees from leaves and separates programmatic from user expansion events', async () => {
  const treeRows: Person[] = [
    {
      id: 10,
      name: 'Parent',
      team: 'Tree',
      score: 1,
      children: [{ id: 11, name: 'Needle', team: 'Tree', score: 2 }],
    },
    { id: 20, name: 'Other', team: 'Tree', score: 3 },
  ];
  const element = await dataGrid(html`
    <lr-data-grid
      label="Tree people"
      child-rows="children"
      row-key="id"
      .rowDetail=${(row: Person) => `Details for ${row.name}`}
      .columns=${columns}
      .data=${treeRows}
    ></lr-data-grid>
  `);
  element.searchTerm = 'Needle';
  await element.updateComplete;
  expect(element.shadowRoot!.querySelectorAll('[part~="row"]')).to.have.length(0);

  element.filterFromLeafRows = true;
  await element.updateComplete;
  expect(element.shadowRoot!.querySelectorAll('[part~="row"]')).to.have.length(1);
  expect(element.shadowRoot!.textContent).to.contain('Parent');

  let userEvents = 0;
  element.addEventListener('lr-row-expand', () => { userEvents += 1; });
  element.addEventListener('lr-row-collapse', () => { userEvents += 1; });
  element.expandRow(10);
  await element.updateComplete;
  expect(userEvents).to.equal(0);
  expect(element.shadowRoot!.textContent).to.contain('Needle');
  expect(element.shadowRoot!.textContent).to.contain('Details for Parent');

  const collapse = oneEvent(element, 'lr-row-collapse');
  (element.shadowRoot!.querySelector('[part="expand-button"]') as HTMLButtonElement).click();
  expect((await collapse).detail.key).to.equal(10);
  const expand = oneEvent(element, 'lr-row-expand');
  (element.shadowRoot!.querySelector('[part="expand-button"]') as HTMLButtonElement).click();
  expect((await expand).detail.row.id).to.equal(10);
  element.collapseAllRows();
  expect(element.expandedKeys).to.deep.equal([]);
  element.expandAllRows();
  expect(element.expandedKeys).to.include.members([10, 11, 20]);
});

it('supports single selection and Ctrl+A skips ineligible rows and repairs shrunken data', async () => {
  const single = await dataGrid(html`
    <lr-data-grid label="Single" selectable="single" row-key="id" .columns=${columns} .data=${rows}></lr-data-grid>
  `);
  const radios = [...single.shadowRoot!.querySelectorAll<HTMLInputElement>('[part~="row"] input')];
  radios[0]!.click();
  radios[1]!.click();
  expect(single.selectedKeys).to.deep.equal([2]);

  const multiple = await dataGrid(html`
    <lr-data-grid
      label="Eligible"
      selectable="multiple"
      row-key="id"
      .selectableRows=${(row: Person) => row.score >= 9}
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const checks = [...multiple.shadowRoot!.querySelectorAll<HTMLInputElement>('[part~="row"] input')];
  expect(checks.map((input) => input.disabled)).to.deep.equal([true, false, false]);
  const selectEvent = oneEvent(multiple, 'lr-row-select');
  dataCells(multiple)[0]!.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'a', ctrlKey: true, bubbles: true, composed: true,
  }));
  expect((await selectEvent).detail.selectedKeys).to.deep.equal([2, 3]);

  multiple.data = [rows[0]!];
  await multiple.updateComplete;
  expect(multiple.selectedKeys).to.deep.equal([]);
  expect(multiple.selectedRows).to.deep.equal([]);
  expect(multiple.shadowRoot!.querySelectorAll('[tabindex="0"]')).to.have.length.greaterThan(0);
});

it('selects only the current page, preserves other-page keys, and cascades tree selection', async () => {
  const paged = await dataGrid(html`
    <lr-data-grid
      label="Paged selection"
      selectable="multiple"
      row-key="id"
      paginate
      page="1"
      page-size="1"
      .columns=${columns}
      .data=${rows}
      .selectedKeys=${[1]}
    ></lr-data-grid>
  `);
  dataCells(paged)[0]!.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'a', ctrlKey: true, bubbles: true, composed: true,
  }));
  expect(paged.selectedKeys).to.deep.equal([1, 2]);
  await paged.updateComplete;
  const selectAll = paged.shadowRoot!.querySelector('[part="select-all-checkbox"]') as HTMLInputElement;
  selectAll.click();
  expect(paged.selectedKeys).to.deep.equal([1]);

  const treeRows: Person[] = [{
    id: 10,
    name: 'Parent',
    team: 'Tree',
    score: 1,
    children: [{ id: 11, name: 'Child', team: 'Tree', score: 2 }],
  }];
  const tree = await dataGrid(html`
    <lr-data-grid
      label="Tree selection"
      selectable="multiple"
      row-key="id"
      child-rows="children"
      .columns=${columns}
      .data=${treeRows}
      .expandedKeys=${[10]}
    ></lr-data-grid>
  `);
  const treeChecks = [...tree.shadowRoot!.querySelectorAll<HTMLInputElement>('[part~="row"] input')];
  treeChecks[1]!.click();
  await tree.updateComplete;
  expect(tree.selectedKeys).to.deep.equal([11]);
  expect((tree.shadowRoot!.querySelector('[part~="row"] input') as HTMLInputElement).indeterminate)
    .to.equal(true);
  (tree.shadowRoot!.querySelector('[part~="row"] input') as HTMLInputElement).click();
  expect(tree.selectedKeys).to.have.members([10, 11]);
});

it('uses the three exact empty/loading/no-results slots', async () => {
  const element = await dataGrid(html`
    <lr-data-grid label="People" loading .columns=${columns} .data=${rows}>
      <span slot="empty">Empty custom</span>
      <span slot="loading">Loading custom</span>
      <span slot="no-results">No results custom</span>
    </lr-data-grid>
  `);
  expect(element.shadowRoot!.querySelector('slot[name="loading"]')).to.exist;
  element.loading = false;
  element.searchTerm = 'missing';
  await element.updateComplete;
  expect(element.shadowRoot!.querySelector('slot[name="no-results"]')).to.exist;
});

it('emits both server request events with immutable request snapshots and server paging', async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="Server people"
      server
      paginate
      page="2"
      page-size="5"
      total="21"
      .columns=${columns}
      .data=${[rows[0]!]}
    ></lr-data-grid>
  `);
  element.sort = [{ id: 'name', desc: true }];
  element.filters = [{ id: 'team', value: 'Runtime' }];
  element.searchTerm = 'Lin';
  const requestEvent = oneEvent(element, 'request');
  const dataRequestEvent = oneEvent(element, 'lr-data-request');
  await element.reload();
  const request = await requestEvent;
  const dataRequest = await dataRequestEvent;
  expect(request.detail.page).to.equal(2);
  expect(request.detail.pageSize).to.equal(5);
  expect(request.detail.sort).to.deep.equal([{ id: 'name', desc: true }]);
  expect(request.detail.filters).to.deep.equal([{ id: 'team', value: 'Runtime' }]);
  expect(request.detail.search).to.equal('Lin');
  element.sort[0]!.desc = false;
  element.filters[0]!.value = 'Compiler';
  expect(request.detail.sort).to.deep.equal([{ id: 'name', desc: true }]);
  expect(request.detail.filters).to.deep.equal([{ id: 'team', value: 'Runtime' }]);
  expect(request.detail.signal).to.be.instanceOf(AbortSignal);
  expect(dataRequest.detail).to.equal(request.detail);
  expect(request.bubbles).to.equal(true);
  expect(request.composed).to.equal(true);
  expect(request.cancelable).to.equal(false);
  expect(element.pageCount).to.equal(5);
  expect(element.getVisibleRows().map((row) => row.id)).to.deep.equal([1]);
});

it('keeps prior rows, clears loading, and emits a strict-console-safe server error', async () => {
  const failure = new Error('offline');
  const element = await dataGrid(html`
    <lr-data-grid
      label="Server error"
      server
      .columns=${columns}
      .data=${[rows[0]!]}
      .dataSource=${async () => { throw failure; }}
    ></lr-data-grid>
  `);
  const errorEvent = oneEvent(element, 'lr-data-error');
  await element.reload();
  const event = await errorEvent;
  expect(event.detail.error).to.equal(failure);
  expect(event.detail.request.signal.aborted).to.equal(false);
  expect(event.bubbles).to.equal(true);
  expect(event.composed).to.equal(true);
  expect(event.cancelable).to.equal(false);
  expect(element.data).to.deep.equal([rows[0]]);
  expect(element.loading).to.equal(false);
  expect(element.hasAttribute('loading')).to.equal(false);
});

it('debounces rapid server search updates into one latest request', async () => {
  const requests: string[] = [];
  const element = await dataGrid(html`
    <lr-data-grid
      label="Debounced server"
      filter-debounce="30"
      .columns=${columns}
      .dataSource=${async (request: { search: string }) => {
        requests.push(request.search);
        return { rows: [], total: 0 };
      }}
    ></lr-data-grid>
  `);
  await delay(50);
  const baseline = requests.length;
  for (const term of ['a', 'ad', 'ada']) {
    element.searchTerm = term;
    await element.updateComplete;
  }
  await delay(90);
  expect(requests.length).to.equal(baseline + 1);
  expect(requests.at(-1)).to.equal('ada');
});

it('filters from the column panel and reports the controlled filter state', async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="Filter people"
      page="2"
      with-search
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  (element.shadowRoot!.querySelector('[part="filter-button"]') as HTMLButtonElement).click();
  await element.updateComplete;
  const input = element.shadowRoot!.querySelector('[part="filter-panel"] input') as HTMLInputElement;
  input.value = 'compiler';
  const eventPromise = oneEvent(element, 'lr-filter-change');
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  const event = await eventPromise;
  expect(event.detail.filters).to.deep.equal([{ id: 'team', value: 'compiler' }]);
  expect(event.cancelable).to.equal(false);
  expect(element.page).to.equal(0);
  expect(element.getProcessedRows().map((row) => row.id)).to.deep.equal([1, 3]);

  const search = element.shadowRoot!.querySelector('[part="search"]') as HTMLInputElement;
  search.value = 'missing';
  search.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  await element.updateComplete;
  expect(element.shadowRoot!.querySelector('[part="no-results"]')).to.exist;
});

it('supports silent programmatic pin/visibility changes and user menu events', async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="Column controls"
      pinnable
      with-column-menu
      with-columns-menu
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  let programmaticEvents = 0;
  element.addEventListener('lr-column-pin', () => { programmaticEvents += 1; });
  element.addEventListener('lr-column-visibility-change', () => { programmaticEvents += 1; });
  element.pinColumn('name', 'left');
  element.toggleColumn('team', false);
  await element.updateComplete;
  expect(programmaticEvents).to.equal(0);
  expect(element.getColumnPin('name')).to.equal('left');
  expect(element.getColumnPin('missing')).to.equal(false);
  expect(header(element, 'name').dataset.pin).to.equal('left');
  expect(element.shadowRoot!.querySelector('[data-column-id="team"]')).to.not.exist;

  element.pinColumn('name', false);
  element.toggleColumn('team', true);
  await element.updateComplete;
  (header(element, 'name').querySelector('[part="column-menu-button"]') as HTMLButtonElement).click();
  await element.updateComplete;
  const pinEvent = oneEvent(element, 'lr-column-pin');
  (header(element, 'name').querySelector('[role="menuitem"]') as HTMLButtonElement).click();
  expect((await pinEvent).detail).to.deep.equal({ columnId: 'name', side: 'left' });

  const columnsMenu = element.shadowRoot!.querySelector('[part="columns-menu"]')!;
  (columnsMenu.querySelector('button') as HTMLButtonElement).click();
  await element.updateComplete;
  const visibilityInput = [...columnsMenu.querySelectorAll<HTMLInputElement>('input')][1]!;
  visibilityInput.checked = false;
  const visibilityEvent = oneEvent(element, 'lr-column-visibility-change');
  visibilityInput.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  expect((await visibilityEvent).detail).to.deep.equal({ columnId: 'team', visible: false });

  element.resetColumns();
  await element.updateComplete;
  expect(element.getColumnPin('name')).to.equal(false);
  expect(element.shadowRoot!.querySelector('[data-column-id="team"]')).to.exist;
});

it('resizes by keyboard and pointer through cancellation and reorders with finished events', async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="Movable people"
      resizable
      reorderable
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const resizeEvents: Array<{ columnId: string; width: number; finished: boolean }> = [];
  element.addEventListener('lr-column-resize', (event) => resizeEvents.push(event.detail));
  header(element, 'name').dispatchEvent(new KeyboardEvent('keydown', {
    key: 'ArrowRight', altKey: true, bubbles: true, composed: true,
  }));
  await element.updateComplete;
  expect(resizeEvents.at(-1)?.columnId).to.equal('name');
  expect(resizeEvents.at(-1)?.finished).to.equal(true);

  const handle = header(element, 'name').querySelector('[part="resize-handle"]') as HTMLElement;
  handle.dispatchEvent(new PointerEvent('pointerdown', {
    pointerId: 41, clientX: 100, bubbles: true, composed: true,
  }));
  handle.dispatchEvent(new PointerEvent('pointermove', {
    pointerId: 41, clientX: 140, bubbles: true, composed: true,
  }));
  handle.dispatchEvent(new PointerEvent('pointercancel', {
    pointerId: 41, clientX: 140, bubbles: true, composed: true,
  }));
  await element.updateComplete;
  expect(resizeEvents.slice(-2).map((detail) => detail.finished)).to.deep.equal([false, true]);

  const moveEvent = oneEvent(element, 'lr-column-move');
  header(element, 'name').dispatchEvent(new KeyboardEvent('keydown', {
    key: 'ArrowRight', shiftKey: true, bubbles: true, composed: true,
  }));
  const moved = await moveEvent;
  expect(moved.detail).to.deep.equal({
    columnOrder: ['team', 'name', 'score'],
    columnId: 'name',
    finished: true,
  });
  expect(moved.cancelable).to.equal(false);

  const rtl = await dataGrid(html`
    <lr-data-grid
      dir="rtl"
      label="RTL movable"
      reorderable
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  header(rtl, 'name').dispatchEvent(new KeyboardEvent('keydown', {
    key: 'ArrowLeft', shiftKey: true, bubbles: true, composed: true,
  }));
  await rtl.updateComplete;
  expect(rtl.columnOrder).to.deep.equal(['team', 'name', 'score']);
});

it('leaves disabled sort, resize, and movement capabilities inert', async () => {
  const inertColumns: DataGridColumn<Person>[] = [
    { field: 'name', sortable: false, resizable: false, movable: false },
    { field: 'team' },
  ];
  const element = await dataGrid(html`
    <lr-data-grid label="Inert columns" .columns=${inertColumns} .data=${rows}></lr-data-grid>
  `);
  let eventCount = 0;
  for (const name of ['lr-sort-change', 'lr-column-resize', 'lr-column-move'] as const) {
    element.addEventListener(name, () => { eventCount += 1; });
  }
  const name = header(element, 'name');
  name.click();
  for (const event of [
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }),
    new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true, composed: true }),
    new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true, composed: true }),
  ]) name.dispatchEvent(event);
  await element.updateComplete;
  expect(element.sort).to.deep.equal([]);
  expect(element.columnOrder).to.deep.equal([]);
  expect(element.getState().widths).to.deep.equal({});
  expect(eventCount).to.equal(0);
});

it('auto-sizes bounded columns and distributes body width by flex', async () => {
  const sizingColumns: DataGridColumn<Person>[] = [
    { field: 'name', label: 'Name', minWidth: 80, maxWidth: 150, flex: 1 },
    { field: 'team', label: 'Team', minWidth: 80, flex: 2 },
  ];
  const element = await dataGrid(html`
    <lr-data-grid label="Sized people" .columns=${sizingColumns} .data=${rows}></lr-data-grid>
  `);
  for (const cell of element.shadowRoot!.querySelectorAll<HTMLElement>('[data-column-id="name"]')) {
    Object.defineProperty(cell, 'scrollWidth', { configurable: true, value: 220 });
  }
  element.autoSizeColumn('name');
  expect(element.getState().widths).to.deep.include({ name: 150 });
  element.autoSizeColumn('missing');

  element.resetColumns();
  const body = element.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
  Object.defineProperty(body, 'clientWidth', { configurable: true, value: 600 });
  element.sizeColumnsToFit();
  const widths = element.getState().widths!;
  expect(widths.name).to.equal(150);
  expect(widths.team).to.equal(400);
  element.autoSizeColumns();
  expect(Object.keys(element.getState().widths!)).to.have.members(['name', 'team']);
});

it('serializes, validates, applies, and resets view state without losing page or selection', async () => {
  const element = await dataGrid(html`
    <lr-data-grid label="Stateful people" row-key="id" .columns=${columns} .data=${rows}></lr-data-grid>
  `);
  const hostile = {
    order: ['score', 'unknown', 'name'],
    widths: { score: 120, name: Number.NaN, unknown: 50 },
    visibility: { team: false, unknown: false },
    pinning: { score: 'right', name: 'invalid', unknown: 'left' },
    sort: [{ id: 'score', desc: 1 }, { id: 'unknown', desc: false }],
    filters: [{ id: 'team', value: 'Compiler' }, { id: 'unknown', value: true }],
    search: 'Ada',
    selectedKeys: [1, {}, Number.NaN],
    expandedKeys: [1, {}, Number.POSITIVE_INFINITY],
    page: Number.NaN,
    pageSize: Number.POSITIVE_INFINITY,
  } as unknown as DataGridState;
  element.setState(hostile);
  await element.updateComplete;
  const state = element.getState();
  expect(state.order).to.deep.equal(['score', 'name']);
  expect(state.widths).to.deep.equal({ score: 120, name: 0 });
  expect(state.visibility).to.deep.equal({ team: false });
  expect(state.pinning).to.deep.equal({ score: 'right', name: false });
  expect(state.sort).to.deep.equal([{ id: 'score', desc: true }]);
  expect(state.filters).to.deep.equal([{ id: 'team', value: 'Compiler' }]);
  expect(state.selectedKeys).to.deep.equal([1]);
  expect(state.expandedKeys).to.deep.equal([1]);
  expect(state.page).to.equal(0);
  expect(state.pageSize).to.equal(0);

  element.page = 2;
  element.pageSize = 10;
  element.selectedKeys = [1];
  element.resetState();
  expect(element.page).to.equal(2);
  expect(element.pageSize).to.equal(10);
  expect(element.selectedKeys).to.deep.equal([1]);
  expect(element.sort).to.deep.equal([]);
  expect(element.filters).to.deep.equal([]);
  expect(element.searchTerm).to.equal('');
  expect(element.getState().order).to.deep.equal([]);
});

it('virtualizes 80+ rows, scrolls to an index, and reconciles a dynamic shrink', async () => {
  const manyRows: Person[] = Array.from({ length: 100 }, (_value, index) => ({
    id: index,
    name: `Person ${index}`,
    team: 'Virtual',
    score: index,
  }));
  const element = await dataGrid(html`
    <lr-data-grid
      label="Virtual people"
      row-key="id"
      style="--row-height: 40px; --max-height: 200px"
      .columns=${columns}
      .data=${manyRows}
    ></lr-data-grid>
  `);
  const initialCount = element.shadowRoot!.querySelectorAll('[part~="row"]').length;
  expect(initialCount).to.be.greaterThan(0);
  expect(initialCount).to.be.lessThan(80);
  await expect(element).to.be.accessible();
  const body = element.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
  Object.defineProperty(body, 'clientHeight', { configurable: true, value: 200 });
  const originalScrollTo = Object.getOwnPropertyDescriptor(body, 'scrollTo');
  Object.defineProperty(body, 'scrollTo', {
    configurable: true,
    value: (options: ScrollToOptions) => {
      body.scrollTop = Number(options.top ?? 0);
      body.dispatchEvent(new Event('scroll'));
    },
  });
  try {
    element.scrollToIndex(90, { align: 'center' });
    await element.updateComplete;
    expect(element.shadowRoot!.textContent).to.contain('Person 90');

    element.data = manyRows.slice(0, 85);
    await element.updateComplete;
    expect(element.shadowRoot!.querySelectorAll('[part~="row"]').length).to.be.greaterThan(0);
    expect(element.shadowRoot!.textContent).to.contain('Person 84');

    element.style.setProperty('--max-height', 'none');
    element.requestUpdate();
    await element.updateComplete;
    expect(element.shadowRoot!.querySelectorAll('[part~="row"]')).to.have.length(85);
  } finally {
    if (originalScrollTo) Object.defineProperty(body, 'scrollTo', originalScrollTo);
    else Reflect.deleteProperty(body, 'scrollTo');
  }
});

it('honors exact CSV/copy/export options, compatibility aliases, and formula escaping', async () => {
  const exportColumns: DataGridColumn<Person>[] = [
    { field: 'name', label: 'Name' },
    { field: 'team', label: 'Team', formatter: (value) => String(value).toLocaleUpperCase('en') },
    { field: 'score', label: 'Score', formatter: (value) => html`<strong>${value}</strong>` },
  ];
  const dangerous: Person[] = [{ id: 1, name: '=1+1', team: '@compiler', score: 7 }];
  const element = await dataGrid(html`
    <lr-data-grid
      label="Export people"
      row-key="id"
      .columns=${exportColumns}
      .data=${dangerous}
      .selectedKeys=${[1]}
    ></lr-data-grid>
  `);
  expect(element.getDataAsCsv({
    columnIds: ['name', 'score'], includeHeaders: false, delimiter: ';',
  })).to.equal("'=1+1;7");
  expect(element.getDataAsCsv({
    columnIds: ['name'], includeHeaders: false, escapeFormulas: false,
  })).to.equal('=1+1');
  expect((element.getDataAsCsv as unknown as (options: { columns: string[] }) => string)({
    columns: ['team'],
  })).to.equal("Team\r\n'@COMPILER");

  let copied = '';
  const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async (value: string) => { copied = value; } },
  });
  try {
    expect(element.copySelectedRows({
      columnIds: ['name'], includeHeaders: false, format: 'csv',
    })).to.equal(1);
    await Promise.resolve();
    expect(copied).to.equal("'=1+1");
  } finally {
    if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
    else Reflect.deleteProperty(navigator, 'clipboard');
  }

  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  const originalAnchorClick = HTMLAnchorElement.prototype.click;
  let downloaded = '';
  URL.createObjectURL = () => 'blob:data-grid-test';
  URL.revokeObjectURL = () => undefined;
  HTMLAnchorElement.prototype.click = function click(): void { downloaded = this.download; };
  try {
    (element.exportDataAsCsv as unknown as (options: {
      filename: string; columns: string[];
    }) => void)({ filename: 'legacy.csv', columns: ['name'] });
    expect(downloaded).to.equal('legacy.csv');
  } finally {
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
    HTMLAnchorElement.prototype.click = originalAnchorClick;
  }
});

it('emits cell activation details and makes context-menu cancellation suppress native behavior', async () => {
  const element = await dataGrid(html`
    <lr-data-grid label="Cell events" .columns=${columns} .data=${rows}></lr-data-grid>
  `);
  const cell = dataCells(element)[0]!;
  const clickEvent = oneEvent(element, 'lr-cell-click');
  cell.click();
  const clicked = await clickEvent;
  expect(clicked.detail.row.id).to.equal(1);
  expect(clicked.detail.value).to.equal('Ada');
  expect(clicked.detail.index).to.equal(0);
  expect(clicked.bubbles).to.equal(true);
  expect(clicked.composed).to.equal(true);
  expect(clicked.cancelable).to.equal(false);

  let contextEvent: CustomEvent | undefined;
  element.addEventListener('lr-cell-contextmenu', (event) => {
    contextEvent = event;
    event.preventDefault();
  }, { once: true });
  const nativeContext = new MouseEvent('contextmenu', {
    bubbles: true, composed: true, cancelable: true,
  });
  cell.dispatchEvent(nativeContext);
  expect(contextEvent?.cancelable).to.equal(true);
  expect(contextEvent?.bubbles).to.equal(true);
  expect(contextEvent?.composed).to.equal(true);
  expect(nativeContext.defaultPrevented).to.equal(true);

  const uncanceled = new MouseEvent('contextmenu', {
    bubbles: true, composed: true, cancelable: true,
  });
  cell.dispatchEvent(uncanceled);
  expect(uncanceled.defaultPrevented).to.equal(false);
});

it('implements roving Home/End/Page/Ctrl navigation without hijacking interactive descendants', async () => {
  const element = await dataGrid(html`
    <lr-data-grid label="Keyboard people" page-size="2" .columns=${columns} .data=${rows}></lr-data-grid>
  `);
  const firstHeader = header(element, 'name');
  firstHeader.focus();
  firstHeader.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'ArrowDown', bubbles: true, composed: true,
  }));
  await delay(0);
  let active = element.shadowRoot!.activeElement as HTMLElement;
  expect(active.dataset.rowPosition).to.equal('0');
  expect(active.dataset.columnPosition).to.equal('0');

  active.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, composed: true }));
  await delay(0);
  active = element.shadowRoot!.activeElement as HTMLElement;
  expect(active.dataset.rowPosition).to.equal('0');
  expect(active.dataset.columnPosition).to.equal('2');

  active.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, composed: true }));
  await delay(0);
  active = element.shadowRoot!.activeElement as HTMLElement;
  expect(active.dataset.rowPosition).to.equal('2');

  active.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Home', ctrlKey: true, bubbles: true, composed: true,
  }));
  await delay(0);
  active = element.shadowRoot!.activeElement as HTMLElement;
  expect(active.getAttribute('role')).to.equal('columnheader');
  expect(active.dataset.columnPosition).to.equal('0');

  active.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'End', ctrlKey: true, bubbles: true, composed: true,
  }));
  await delay(0);
  active = element.shadowRoot!.activeElement as HTMLElement;
  expect(active.dataset.rowPosition).to.equal('2');
  expect(active.dataset.columnPosition).to.equal('2');

  const interactiveColumns: DataGridColumn<Person>[] = [
    { field: 'name', formatter: (value) => html`<button data-inner>${value}</button>` },
  ];
  const interactive = await dataGrid(html`
    <lr-data-grid label="Interactive cells" .columns=${interactiveColumns} .data=${rows}></lr-data-grid>
  `);
  const inner = interactive.shadowRoot!.querySelector('[data-inner]') as HTMLButtonElement;
  let cellClicks = 0;
  interactive.addEventListener('lr-cell-click', () => { cellClicks += 1; });
  const arrow = new KeyboardEvent('keydown', {
    key: 'ArrowRight', bubbles: true, composed: true, cancelable: true,
  });
  inner.dispatchEvent(arrow);
  inner.click();
  expect(arrow.defaultPrevented).to.equal(false);
  expect(cellClicks).to.equal(0);
});

it('uses host naming precedence, locale-aware labels/digits, and responsive rendered styles', async () => {
  const localized = await dataGrid(html`
    <lr-data-grid
      aria-label="Host wins"
      label="Property fallback"
      lang="fa"
      paginate
      page-size="1"
      .pageSizeOptions=${[1]}
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  expect(localized.shadowRoot!.querySelector('[role="grid"]')!.getAttribute('aria-label'))
    .to.equal('Host wins');
  const pageTexts = [...localized.shadowRoot!.querySelectorAll<HTMLElement>('[part~="page"]')]
    .map((button) => button.textContent?.trim());
  const localizedOne = new Intl.NumberFormat('fa', { maximumFractionDigits: 0 }).format(1);
  expect(localizedOne).to.not.equal('1');
  expect(pageTexts).to.include(localizedOne);

  const turkish = await dataGrid(html`
    <lr-data-grid
      label="Turkish"
      lang="tr"
      .columns=${[{ field: 'istanbulName' }]}
      .data=${[{ istanbulName: 'value' }]}
    ></lr-data-grid>
  `);
  expect(header(turkish, 'istanbulName').textContent).to.contain('İstanbul Name');

  const wrapper = await fixture<HTMLDivElement>(html`
    <div style="inline-size: 300px">
      <lr-data-grid
        dir="rtl"
        label="Narrow"
        with-search
        .columns=${columns}
        .data=${[{ ...rows[0]!, name: 'A very long unbroken value that must stay inside the allocated grid' }]}
      ></lr-data-grid>
    </div>
  `);
  const narrow = wrapper.querySelector('lr-data-grid') as LyraDataGrid<Person>;
  await narrow.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const toolbar = narrow.shadowRoot!.querySelector('[part="toolbar"]') as HTMLElement;
  const body = narrow.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
  expect(getComputedStyle(toolbar).flexDirection).to.equal('column');
  expect(getComputedStyle(narrow).direction).to.equal('rtl');
  expect(narrow.getBoundingClientRect().width).to.be.at.most(wrapper.getBoundingClientRect().width + 1);
  expect(body.scrollWidth).to.be.at.least(body.clientWidth);
  const row = narrow.shadowRoot!.querySelector('[part~="row"]') as HTMLElement;
  const duration = getComputedStyle(row).transitionDuration;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) expect(duration).to.equal('0s');
  else expect(duration).to.not.equal('0s');
  await expect(narrow).to.be.accessible();
});

it('aborts pending work and resets transient menus across disconnect and reconnect', async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="Reconnect people"
      with-column-menu
      with-columns-menu
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  (element.shadowRoot!.querySelector('[part="filter-button"]') as HTMLButtonElement).click();
  (element.shadowRoot!.querySelector('[part="columns-menu"] button') as HTMLButtonElement).click();
  (header(element, 'name').querySelector('[part="column-menu-button"]') as HTMLButtonElement).click();
  await element.updateComplete;

  let pendingSignal: AbortSignal | undefined;
  element.dataSource = (request) => {
    pendingSignal = request.signal;
    return new Promise(() => undefined);
  };
  await element.updateComplete;
  void element.reload();
  await delay(0);
  expect(element.loading).to.equal(true);
  const parent = element.parentElement!;
  element.remove();
  expect(pendingSignal?.aborted).to.equal(true);
  expect(element.loading).to.equal(false);
  element.dataSource = null;
  parent.append(element);
  await element.updateComplete;
  expect(element.shadowRoot!.querySelector('[part="filter-panel"]')).to.not.exist;
  expect(element.shadowRoot!.querySelector('[role="menu"]')).to.not.exist;
  expect(element.shadowRoot!.querySelector('[part="columns-menu"] [role="group"]')).to.not.exist;
  await expect(element).to.be.accessible();
});

it('aborts stale server requests and applies only the latest response', async () => {
  const requests: Array<{ signal?: AbortSignal }> = [];
  const resolvers: Array<(value: { rows: Person[]; total: number }) => void> = [];
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      server
      .columns=${columns}
      .dataSource=${(request: { signal?: AbortSignal }) => {
        requests.push(request);
        return new Promise((resolve) => resolvers.push(resolve));
      }}
    ></lr-data-grid>
  `);
  element.searchTerm = 'a';
  const first = element.reload();
  const firstResolver = resolvers.at(-1)!;
  const firstRequest = requests.at(-1)!;
  element.searchTerm = 'g';
  const latest = element.reload();
  const latestResolver = resolvers.at(-1)!;
  latestResolver({ rows: [rows[2]!], total: 1 });
  await latest;
  firstResolver({ rows: [rows[0]!], total: 1 });
  await first;
  expect(firstRequest.signal?.aborted).to.equal(true);
  expect(element.data).to.deep.equal([rows[2]]);
});
