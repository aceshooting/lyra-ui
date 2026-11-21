import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sinkTexts } from '../../../../test/announcements.js';
import { columns, dataGrid, header, rows, type Person } from '../../../../test/data-grid.js';
import type { LyraPagination } from '../pagination/pagination.class.js';

it('publishes the accepted sort and selection through lr-sort-change and lr-row-select', async () => {
  const grid = await dataGrid(html`<lr-data-grid label="People" row-key="id" selection-mode="multiple"
    .columns=${columns} .data=${rows}></lr-data-grid>`);
  const sorts: unknown[] = [];
  const selections: unknown[] = [];
  grid.addEventListener('lr-sort-change', event => sorts.push((event as CustomEvent).detail));
  grid.addEventListener('lr-row-select', event => selections.push((event as CustomEvent).detail.selectedRowKeys));
  header(grid, 'name').click();
  expect(sorts).to.deep.equal([{ sort: [{ id: 'name', desc: false }] }]);
  grid.shadowRoot!.querySelector<HTMLInputElement>('[part="select-all-checkbox"]')!.click();
  expect(selections.length).to.equal(1);
  expect((selections[0] as number[]).slice().sort()).to.deep.equal([1, 2, 3]);
});

it('honors a row expansion veto before writing keys or notifying listeners', async () => {
  const grid = await dataGrid(html`<lr-data-grid label="People" row-key="id" .columns=${columns} .data=${rows}
    .rowDetail=${(row: Person) => row.name}></lr-data-grid>`);
  const button = grid.shadowRoot!.querySelector<HTMLButtonElement>('[part="expand-button"]')!;
  const requests: boolean[] = [];
  const commits: boolean[] = [];
  grid.addEventListener('lr-row-expand-request', event => {
    requests.push((event as CustomEvent).detail.expanded);
    event.preventDefault();
  }, { once: true });
  grid.addEventListener('lr-row-expand', () => commits.push(true));
  grid.addEventListener('lr-row-collapse', () => commits.push(false));
  button.click();
  expect(grid.expandedKeys).to.deep.equal([]);
  expect(requests).to.deep.equal([true]);
  expect(commits).to.deep.equal([]);
  button.click();
  button.click();
  expect(commits).to.deep.equal([true, false]);
});

it('adapts pager proposals, jumps and activation to zero-based grid pages', async () => {
  const grid = await dataGrid(html`<lr-data-grid label="People" paginate server total="200" page-size="10"
    page="3" .columns=${columns} .data=${rows}></lr-data-grid>`);
  const pager = grid.shadowRoot!.querySelector<LyraPagination>('lr-pagination');
  expect(Boolean(pager)).to.equal(true);
  await pager!.updateComplete;
  const root = pager!.shadowRoot!;
  expect(root.querySelector('[part~="page-current"]')!.textContent!.trim()).to.equal('4');
  const requested: number[] = [];
  grid.addEventListener('lr-before-page-change', event => {
    requested.push((event as CustomEvent).detail.page);
    event.preventDefault();
  }, { once: true });
  const next = root.querySelector<HTMLButtonElement>('[part~="next-button"]')!;
  next.click();
  expect(requested).to.deep.equal([4]);
  expect(grid.page).to.equal(3);
  const activated: number[] = [];
  grid.addEventListener('lr-activate', event => activated.push((event as CustomEvent).detail.value));
  next.click();
  expect(grid.page).to.equal(4);
  expect(activated).to.deep.equal([4]);
});

it('forwards native text attributes to the search and column filter editors', async () => {
  const grid = await dataGrid(html`<lr-data-grid label="People" with-search spellcheck="false" autocapitalize="words"
    autocorrect="off" .columns=${columns} .data=${rows}></lr-data-grid>`);
  grid.shadowRoot!.querySelector<HTMLButtonElement>('[part="filter-button"]')!.click();
  await grid.updateComplete;
  const inputs = [...grid.shadowRoot!.querySelectorAll<HTMLInputElement>('input[type="search"], [part="filter-input"], [part="filter"] input')];
  expect(inputs.length).to.equal(2);
  for (const input of inputs) {
    expect(input.getAttribute('spellcheck')).to.equal('false');
    expect(input.getAttribute('autocapitalize')).to.equal('words');
    expect(input.getAttribute('autocorrect')).to.equal('off');
  }
});

it('matches unaccented search and column filters and announces user search results', async () => {
  const grid = await dataGrid(html`<lr-data-grid label="People" with-search .columns=${columns}
    .data=${[{ ...rows[0], name: 'Café' }]} .strings=${{ viewerSearchMatchCount: { one: 'One matching row', other: '{count} matches' } }}></lr-data-grid>`);
  const search = grid.shadowRoot!.querySelector<HTMLInputElement>('[part="search"]')!;
  search.value = 'cafe';
  search.dispatchEvent(new Event('input'));
  expect(grid.getProcessedRows().length).to.equal(1);
  grid.filters = [{ id: 'name', value: 'cafe' }];
  expect(grid.getProcessedRows().length).to.equal(1);
  await waitUntil(() => sinkTexts().includes('One matching row'), 'filtered row count');
});

it('bounds iteration of duplicate or invalid row keys even when no new key is admitted', async () => {
  const grid = await dataGrid();
  let reads = 0;
  function* repeatedKeys() {
    while (reads < 100_002) { reads++; yield 'row'; }
  }
  Reflect.set(grid, 'expandedRowKeys', repeatedKeys());
  expect(grid.expandedRowKeys).to.deep.equal(['row']);
  expect(reads).to.be.lessThan(100_002);
});

it('has one sequential stop for grid navigation', async () => {
  const grid = await dataGrid(html`<lr-data-grid label="People" .columns=${columns} .data=${rows}></lr-data-grid>`);
  const root = grid.shadowRoot!;
  expect(root.querySelectorAll('[role="grid"] [tabindex="0"]').length).to.equal(1);
});

it('keeps the grid page controlled when a pager listener changes the query and supports an open-ended server', async () => {
  const grid = await dataGrid(html`<lr-data-grid label="People" server paginate unknown-total page="7" .columns=${columns} .data=${rows}></lr-data-grid>`);
  const pager = grid.shadowRoot!.querySelector<LyraPagination>('lr-pagination')!;
  await pager.updateComplete;
  const next = pager.shadowRoot!.querySelector<HTMLButtonElement>('[part~="next-button"]')!;
  grid.addEventListener('lr-before-page-change', () => { grid.page = 12; }, { once: true });
  next.click();
  expect(grid.page).to.equal(12);
  await grid.updateComplete;
  await pager.updateComplete;
  next.click();
  expect(grid.page).to.equal(13);
  grid.hasNext = false;
  await grid.updateComplete;
  await pager.updateComplete;
  expect(next.disabled).to.equal(true);
});

it('preserves numeric dates and set filters from an iframe', async () => {
  const frame = await fixture<HTMLIFrameElement>(html`<iframe title="Other realm"></iframe>`);
  const realm = frame.contentWindow as Window & typeof globalThis;
  const date = new realm.Date('2020-02-29T12:00:00Z');
  const tags = new realm.Set(['red', 'blue']);
  const grid = await dataGrid(html`<lr-data-grid label="Records" .columns=${[{ field: 'tags', filterType: 'set' }, { field: 'date', filterType: 'date-range' }]}
    .data=${[{ tags, date }]} .filters=${[{ id: 'tags', value: new realm.Set(['red']) }, { id: 'date', value: ['2020-02-29', '2020-02-29'] }]}></lr-data-grid>`);
  expect(grid.getProcessedRows().length).to.equal(1);
  tags.clear();
  grid.filters = [{ id: 'tags', value: new realm.Set(['absent']) }];
  expect(grid.getProcessedRows().length).to.equal(0);
});

it('leaves selection with the owner when a proposal is canceled or replaces the selected keys', async () => {
  const grid = await dataGrid(html`<lr-data-grid label="People" row-key="id" selection-mode="multiple" .columns=${columns} .data=${rows}></lr-data-grid>`);
  const all = grid.shadowRoot!.querySelector<HTMLInputElement>('[part="select-all-checkbox"]')!;
  let commits = 0;
  grid.addEventListener('lr-row-select', () => { commits++; });
  grid.addEventListener('lr-row-select-request', event => event.preventDefault(), { once: true });
  all.click();
  await grid.updateComplete;
  expect(all.checked).to.equal(false);
  expect(grid.selectedKeys).to.deep.equal([]);
  grid.addEventListener('lr-row-select-request', () => { grid.selectedRowKeys = [2]; }, { once: true });
  all.click();
  expect(grid.selectedKeys).to.deep.equal([2]);
  expect(commits).to.equal(0);
});

it('names the page selection and reports the exact final range in the pager summary', async () => {
  const grid = await dataGrid(html`<lr-data-grid label="People" selection-mode="multiple" paginate pagination-with-summary
    server total="23" page="2" page-size="10" .columns=${columns} .data=${rows}></lr-data-grid>`);
  expect(grid.shadowRoot!.querySelector('[part="select-all-checkbox"]')!.getAttribute('aria-label')).to.equal('Select all rows on this page');
  const pager = grid.shadowRoot!.querySelector<LyraPagination>('lr-pagination')!;
  await pager.updateComplete;
  expect(pager.total).to.equal(23);
  expect(pager.shadowRoot!.querySelector('[part="summary"]')!.textContent).to.include('23');
});

it('restores the page-size selector after a veto and respects a synchronous page override', async () => {
  const grid = await dataGrid(html`<lr-data-grid label="People" paginate page-size="10" server total="100" page="2"
    .columns=${columns} .data=${rows}></lr-data-grid>`);
  const select = grid.shadowRoot!.querySelector<HTMLSelectElement>('[part="page-size"]')!;
  grid.addEventListener('lr-before-page-change', event => event.preventDefault(), { once: true });
  select.value = '20';
  select.dispatchEvent(new Event('change'));
  expect([grid.page, grid.pageSize, select.value]).to.deep.equal([2, 10, '10']);
  let resetEvents = 0;
  grid.addEventListener('lr-page-change', () => { resetEvents++; });
  grid.addEventListener('lr-sort-change', () => { grid.page = 3; }, { once: true });
  header(grid, 'name').click();
  expect([grid.page, resetEvents]).to.deep.equal([3, 0]);
});

it('announces the accepted server match count after a search', async () => {
  const grid = await dataGrid(html`<lr-data-grid label="People" filter-debounce="0" .columns=${columns}
    .dataSource=${async () => ({ rows, total: 37 })}
    .strings=${{ viewerSearchMatchCount: 'Server returned {count}' }}></lr-data-grid>`);
  await waitUntil(() => grid.total === 37);
  expect(sinkTexts()).not.to.include('Server returned 37');
  grid.searchTerm = 'research';
  await waitUntil(() => sinkTexts().includes('Server returned 37'), 'accepted result total');
});

it('includes the row key in the constant disclosure name when the first visible value is blank', async () => {
  const grid = await dataGrid(html`<lr-data-grid label="People" row-key="id" .columns=${[{ field: 'name' }]}
    .data=${[{ id: 17, name: ' ' }]} .rowDetail=${() => 'Details'}></lr-data-grid>`);
  const button = grid.shadowRoot!.querySelector<HTMLButtonElement>('[part="expand-button"]')!;
  expect(button.getAttribute('aria-label')).to.equal('Toggle row 17');
  expect(button.getAttribute('aria-expanded')).to.equal('false');
  button.click();
  await grid.updateComplete;
  expect(button.getAttribute('aria-label')).to.equal('Toggle row 17');
  expect(button.getAttribute('aria-expanded')).to.equal('true');
});

it('publishes an empty sort when the final sorted column is cleared', async () => {
  const grid = await dataGrid(html`<lr-data-grid label="People" .columns=${columns} .data=${rows}></lr-data-grid>`);
  const details: unknown[] = [];
  grid.addEventListener('lr-sort-change', event => details.push((event as CustomEvent).detail));
  const column = header(grid, 'name');
  for (let click = 0; click < 3; click++) column.click();
  expect(details.at(-1)).to.deep.equal({ sort: [] });
});

it('ignores an obsolete filter clear and safely rejects a row array with an unreadable length', async () => {
  const grid = await dataGrid(html`<lr-data-grid label="People" .columns=${columns} .data=${rows}
    .filters=${[{ id: 'team', value: 'Compiler' }]}></lr-data-grid>`);
  grid.shadowRoot!.querySelector<HTMLButtonElement>('[part="filter-button"]')!.click();
  await grid.updateComplete;
  const clear = grid.shadowRoot!.querySelector<HTMLButtonElement>('[part="filter-panel-clear"]')!;
  let changes = 0;
  grid.addEventListener('lr-filter-change', () => { changes++; });
  clear.click();
  expect(changes).to.equal(1);
  grid.filters = [{ id: 'name', value: 'Ada' }];
  clear.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(changes).to.equal(1);
  expect(grid.filters).to.deep.equal([{ id: 'name', value: 'Ada' }]);
  grid.data = new Proxy([...rows], {
    getOwnPropertyDescriptor(target, key) {
      if (key === 'length') throw new Error('No length');
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  expect(grid.data.length).to.equal(0);
});

it('announces a listener-owned server result after the matching request settles', async () => {
  const grid = await dataGrid(html`<lr-data-grid label="People" server filter-debounce="0" .columns=${columns}
    .strings=${{ viewerSearchMatchCount: 'Listener returned {count}' }}></lr-data-grid>`);
  grid.addEventListener('lr-request', event => {
    if ((event as CustomEvent).detail.search === 'new') grid.total = 24;
  });
  grid.searchTerm = 'new';
  await waitUntil(() => sinkTexts().includes('Listener returned 24'), 'listener-owned count');
});
