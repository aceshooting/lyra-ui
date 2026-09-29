import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './table.js';
import '../../forms/select/select.js';
import type { LyraTable, TableColumn } from './table.js';
import { captureDeprecationWarnings, } from '../../../../test/expected-deprecations.js';
// Registers the real shipped `ar` catalog's `data` slice so the `lang="ar-EG"` resize-value
// test below (which only overrides `resizeValuePixels`) can render without tripping the
// dev-mode locale-fallback warning that strict-console platform lanes treat as fatal.
import '../../../translations/ar/data.js';
import { installTableTestHooks, TableOpaqueControlElement, type Row, columns, rows, forcedWidthHeaderCell, hostileIterable } from '../../../../test/table.js';
installTableTestHooks();




it('uses the first unique nonempty column and row keys before counts, focus, actions, and events', async () => {
  const el = (await fixture(html`<lr-table aria-label="Identity-safe scores" pagination-mode="client" page-size="1"></lr-table>`)) as LyraTable<Row>;
  const first = { id: 'shared', name: 'First shared row', score: 10 };
  const duplicate = { id: 'shared', name: 'Later duplicate row', score: 99 };
  const other = { id: 'other', name: 'Other row', score: 20 };
  const filterCalls: string[] = [];
  el.columns = [
    { key: '', label: 'Blank', cell: (row) => row.name },
    { key: 'name', label: 'First name', cell: (row) => row.name },
    { key: 'name', label: 'Duplicate name', cell: (row) => `duplicate ${row.name}` },
    { key: 'score', label: 'Score', cell: (row) => row.score },
  ];
  el.rows = [
    { id: '', name: 'Blank row', score: 0 },
    { id: '   ', name: 'Whitespace row', score: 0 },
    first,
    duplicate,
    other,
  ];
  el.rowKey = (row) => row.id;
  el.filter = (row) => {
    filterCalls.push(row.name);
    return true;
  };
  el.filterText = 'include';
  await el.updateComplete;

  expect(el.columns.map((column) => column.label)).to.deep.equal(['First name', 'Score']);
  expect(filterCalls).to.deep.equal(['First shared row', 'Other row']);
  expect(el.shadowRoot!.querySelectorAll('[part="header-cell"]').length).to.equal(2);
  expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(1);
  expect(el.shadowRoot!.querySelectorAll('[part="row"][tabindex="0"]').length).to.equal(1);
  const pagination = el.shadowRoot!.querySelector('lr-pagination') as HTMLElement & { total: number };
  expect(pagination.total).to.equal(2);

  let clicked: Row | undefined;
  el.addEventListener('lr-row-activate', (event) => {
    clicked = event.detail.row;
  });
  (el.shadowRoot!.querySelector('[part="row"]') as HTMLElement).click();
  expect(clicked?.name).to.equal('First shared row');
});

it('lets an opaque custom control opt out of delegated row activation explicitly', async () => {
  const opaqueColumns: TableColumn<Row>[] = [
    {
      key: 'name',
      label: 'Name',
      cell: (row) => html`<table-opaque-control data-table-interactive>${row.name}</table-opaque-control>`,
    },
  ];
  const el = (await fixture(
    html`<lr-table .columns=${opaqueColumns} .rows=${rows} .rowKey=${(row: Row) => row.id}></lr-table>`
  )) as LyraTable<Row>;
  let activated = 0;
  el.addEventListener('lr-row-activate', () => activated++);

  (el.shadowRoot!.querySelector('table-opaque-control') as TableOpaqueControlElement).activate();

  expect(activated).to.equal(0);
});

describe('matching-entries memoization', () => {
  it('does not re-run row filtering for an unrelated reactive update (roving focus move)', async () => {
    const manyRows: Row[] = [
      { id: 'a', name: 'Alpha', score: 3 },
      { id: 'b', name: 'Beta', score: 1 },
      { id: 'c', name: 'Gamma', score: 2 },
    ];
    let filterCalls = 0;
    const el = (await fixture(html`<lr-table filterable></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = manyRows;
    el.rowKey = (r) => r.id;
    el.filter = (row, text) => {
      filterCalls += 1;
      return row.name.toLocaleLowerCase().includes(text.toLocaleLowerCase());
    };
    el.filterText = 'a';
    await el.updateComplete;
    expect(filterCalls).to.be.greaterThan(0);
    const callsAfterInitialRender = filterCalls;

    // An arrow-key focus move only changes the roving-tabindex position —
    // none of the inputs the row-matching computation reads — so it must not
    // re-run the filter predicate over the rows array.
    const firstRow = el.shadowRoot!.querySelector('[part="row"]') as HTMLElement;
    firstRow.focus();
    firstRow.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await el.updateComplete;

    expect(el.shadowRoot!.activeElement?.getAttribute('data-row-key')).to.equal('string:b');
    expect(filterCalls).to.equal(callsAfterInitialRender);
  });

  it('recomputes matches when rows is reassigned while a filter is active (default JSON filter)', async () => {
    const el = (await fixture(html`<lr-table filterable></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.filterText = 'alpha';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(1);

    el.rows = [...rows, { id: 'c', name: 'Alphaville', score: 9 }];
    await el.updateComplete;
    const rowEls = [...el.shadowRoot!.querySelectorAll('[part="row"]')];
    expect(rowEls.length).to.equal(2);
    expect(rowEls.map((r) => r.textContent).join(' ')).to.contain('Alphaville');
  });

  it('recomputes matches when the effective locale changes (locale-sensitive case-folding)', async () => {
    const el = (await fixture(html`<lr-table filterable></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = [
      { id: 'a', name: 'III', score: 1 },
      { id: 'b', name: 'beta', score: 2 },
    ];
    el.rowKey = (r) => r.id;
    el.filterText = 'iii';
    await el.updateComplete;
    // Default case-folding lowercases 'III' to 'iii' — one match.
    expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(1);

    // Turkish case-folding lowercases 'III' to dotless 'ııı', which no longer
    // contains 'iii' — the match set must follow the locale change.
    el.locale = 'tr';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(0);
  });
});

describe('v9 bounded and transactional contracts', () => {
  it('inspects only the first 10,000 column positions even when sparse entries are invalid', async () => {
    const sparse = new Array<TableColumn<Row>>(10_001);
    sparse[9_999] = columns[0]!;
    sparse[10_000] = columns[1]!;
    const el = await fixture<LyraTable<Row>>(html`<lr-table></lr-table>`);

    el.columns = sparse;

    expect(el.columns).to.deep.equal([columns[0]]);
    expect(el.columns[0] === columns[0]).to.equal(true);
    expect(Object.isFrozen(el.columns)).to.equal(true);
  });

  it('retains only the safe prefix already collected when the columns length descriptor itself throws', async () => {
    const target: TableColumn<Row>[] = [columns[0]!, columns[1]!];
    const hostile = new Proxy(target, {
      getOwnPropertyDescriptor(t, prop) {
        if (prop === 'length') throw new Error('boom');
        return Reflect.getOwnPropertyDescriptor(t, prop);
      },
    });
    const el = await fixture<LyraTable<Row>>(html`<lr-table></lr-table>`);

    el.columns = hostile;

    expect(el.columns).to.deep.equal([]);
  });

  it('skips one poisoned column position without losing the valid entries around it', async () => {
    const target: TableColumn<Row>[] = [columns[0]!, columns[1]!, { key: 'third', label: 'Third', cell: () => '' }];
    const hostile = new Proxy(target, {
      getOwnPropertyDescriptor(t, prop) {
        if (prop === '1') throw new Error('boom');
        return Reflect.getOwnPropertyDescriptor(t, prop);
      },
    });
    const el = await fixture<LyraTable<Row>>(html`<lr-table></lr-table>`);

    el.columns = hostile;

    expect(el.columns.map((c) => c.key)).to.deep.equal(['name', 'third']);
  });

  it('drops a column definition whose key accessor throws, keeping later valid definitions', async () => {
    const poisoned = {
      get key(): string {
        throw new Error('boom');
      },
      label: 'Poisoned',
      cell: () => '',
    };
    const el = await fixture<LyraTable<Row>>(html`<lr-table></lr-table>`);

    el.columns = [poisoned as unknown as TableColumn<Row>, columns[0]!];

    expect(el.columns.map((c) => c.key)).to.deep.equal(['name']);
  });

  it('retains only the safe prefix already collected when a custom rows iterator throws mid-iteration', async () => {
    const source: Row[] = [rows[0]!, rows[1]!, { id: 'c', name: 'Gamma', score: 2 }];
    const hostile: Row[] = [...source];
    let calls = 0;
    // Own-property override: still a real Array (Array.isArray stays true), but iterating it walks
    // a custom generator that throws after the first value instead of the real elements.
    Object.defineProperty(hostile, Symbol.iterator, {
      value: function* (): Generator<Row> {
        for (const row of source) {
          calls++;
          if (calls > 1) throw new Error('boom');
          yield row;
        }
      },
    });
    const el = await fixture<LyraTable<Row>>(html`<lr-table></lr-table>`);

    el.rows = hostile;

    expect(el.rows).to.deep.equal([rows[0]]);
    expect(Object.isFrozen(el.rows)).to.equal(true);
  });

  it('retains only the safe prefix already collected when a custom selectedRowKeys iterable throws mid-iteration', async () => {
    let calls = 0;
    const hostile = {
      [Symbol.iterator](): Iterator<string> {
        return {
          next(): IteratorResult<string> {
            calls++;
            if (calls > 1) throw new Error('boom');
            return { value: 'a', done: false };
          },
        };
      },
    };
    const el = await fixture<LyraTable<Row>>(html`<lr-table></lr-table>`);
    el.columns = columns;
    el.rows = rows;
    el.rowKey = (row) => row.id;

    el.selectedRowKeys = hostile as unknown as Set<string | number>;

    expect([...el.selectedRowKeys]).to.deep.equal(['a']);
  });

  it('exposes a standard Set-shaped forEach on the read facade returned by selectedRowKeys', async () => {
    const el = await fixture<LyraTable<Row>>(html`<lr-table></lr-table>`);
    el.columns = columns;
    el.rows = rows;
    el.rowKey = (row) => row.id;
    el.selectedRowKeys = new Set(['a', 'b']);

    const seen: Array<[unknown, unknown]> = [];
    el.selectedRowKeys.forEach((value, value2) => seen.push([value, value2]));

    expect(seen).to.deep.equal([
      ['a', 'a'],
      ['b', 'b'],
    ]);
  });

  it('clone-owns readonly collection inputs and returns detached selection snapshots', async () => {
    const inputColumns = [...columns];
    const inputRows = [...rows];
    const inputSelected = new Set<string | number>(['a']);
    const inputExpanded = new Set<string | number>(['a']);
    const el = (await fixture(html`<lr-table aria-label="Scores"></lr-table>`)) as LyraTable<Row>;
    el.columns = inputColumns;
    el.rows = inputRows;
    el.rowKey = (row) => row.id;
    el.selectionMode = 'multiple';
    el.selectedRowKeys = inputSelected;
    el.expandedRowKeys = inputExpanded;

    inputColumns.length = 0;
    inputRows.length = 0;
    inputSelected.clear();
    inputExpanded.clear();
    await el.updateComplete;

    expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(2);
    expect(Object.isFrozen(el.columns)).to.equal(true);
    expect(Object.isFrozen(el.rows)).to.equal(true);
    expect([...el.selectedRowKeys]).to.deep.equal(['a']);
    expect([...el.expandedRowKeys]).to.deep.equal(['a']);

    // The read facade (readonlyKeySet() in table.class.ts) is frozen and exposes no mutating
    // methods at all -- not even a no-op `clear()` -- so there's no reference through which a
    // caller could corrupt the table's controlled state.
    expect(Object.isFrozen(el.selectedRowKeys)).to.equal(true);
    expect(Object.isFrozen(el.expandedRowKeys)).to.equal(true);
    expect((el.selectedRowKeys as { clear?: unknown }).clear).to.equal(undefined);
    expect((el.expandedRowKeys as { clear?: unknown }).clear).to.equal(undefined);
    expect([...el.selectedRowKeys]).to.deep.equal(['a']);
    expect([...el.expandedRowKeys]).to.deep.equal(['a']);
  });

  it('contains native filter input/change events and emits only the table filter contract', async () => {
    const el = (await fixture(html`<lr-table filterable aria-label="Scores"></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    await el.updateComplete;

    let rawInputs = 0;
    let rawChanges = 0;
    let filterChanges = 0;
    el.addEventListener('input', () => rawInputs++);
    el.addEventListener('change', () => rawChanges++);
    el.addEventListener('lr-filter-change', () => filterChanges++);
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('[part="filter"]')!;
    input.value = 'alpha';
    input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

    expect(rawInputs).to.equal(0);
    expect(rawChanges).to.equal(0);
    expect(filterChanges).to.equal(1);
  });

  it('contains native cell-editor input/change events while publishing the committed edit', async () => {
    const el = (await fixture(html`<lr-table aria-label="Scores"></lr-table>`)) as LyraTable<Row>;
    el.columns = [{ key: 'name', label: 'Name', sortable: true, cell: (r: Row) => r.name, editTrigger: 'double-click' }];
    el.rows = rows;
    el.rowKey = (row) => row.id;
    await el.updateComplete;

    const cell = el.shadowRoot!.querySelector<HTMLElement>('[part="cell"]')!;
    cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await el.updateComplete;

    let rawInputs = 0;
    let rawChanges = 0;
    let edits = 0;
    el.addEventListener('input', () => rawInputs++);
    el.addEventListener('change', () => rawChanges++);
    el.addEventListener('lr-cell-edit', () => edits++);
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('[part="cell-editor"]')!;
    input.value = 'Renamed';
    input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

    expect(rawInputs).to.equal(0);
    expect(rawChanges).to.equal(0);
    expect(edits).to.equal(1);
  });

  it('emits a cancelable sort request followed by one readonly committed sort detail', async () => {
    const el = (await fixture(html`<lr-table aria-label="Scores"></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    await el.updateComplete;

    const details: Array<Record<string, unknown>> = [];
    el.addEventListener('lr-sort-request', (event) => details.push((event as CustomEvent).detail));
    el.addEventListener('lr-sort', (event) => details.push((event as CustomEvent).detail));
    (el.shadowRoot!.querySelectorAll('[part="header-cell"]')[1] as HTMLElement).click();

    expect(details).to.deep.equal([
      { phase: 'request', sortKey: 'score', sortDir: 'asc' },
      { phase: 'commit', sortKey: 'score', sortDir: 'asc' },
    ]);
    expect(details.every((detail) => Object.isFrozen(detail))).to.equal(true);
  });

  it('honors a vetoed sort request without mutating sort state or emitting a commit', async () => {
    const el = (await fixture(html`<lr-table aria-label="Scores"></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    await el.updateComplete;

    let commits = 0;
    el.addEventListener('lr-sort-request', (event) => event.preventDefault());
    el.addEventListener('lr-sort', () => commits++);
    (el.shadowRoot!.querySelectorAll('[part="header-cell"]')[1] as HTMLElement).click();

    expect(el.sortKey).to.equal('');
    expect(el.sortDir).to.equal('asc');
    expect(commits).to.equal(0);
  });

  it('uses one selectedRowKeys store in single mode and publishes a frozen snapshot', async () => {
    const el = (await fixture(html`<lr-table aria-label="Scores"></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    el.rowKey = (row) => row.id;
    el.selectionMode = 'single';
    await el.updateComplete;

    let detail: { selectedRowKeys: readonly (string | number)[] } | undefined;
    el.addEventListener('lr-selection-change', (event) => {
      detail = event.detail;
    });
    (el.shadowRoot!.querySelector('[part="row"]') as HTMLElement).click();

    expect([...el.selectedRowKeys]).to.deep.equal(['a']);
    expect('selectedKey' in el).to.equal(false);
    expect(detail?.selectedRowKeys).to.deep.equal(['a']);
    expect(Object.isFrozen(detail?.selectedRowKeys)).to.equal(true);
    expect(Object.isFrozen(detail)).to.equal(true);
  });

  it('bounds the default row projection and keeps every row reachable through pagination', async () => {
    const manyRows = Array.from({ length: 130 }, (_, index) => ({
      id: `row-${index}`,
      name: `Row ${index}`,
      score: index,
    }));
    const el = (await fixture(html`<lr-table aria-label="Scores"></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = manyRows;
    el.rowKey = (row) => row.id;
    await el.updateComplete;

    expect(el.pageSize).to.equal(100);
    expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(100);
    expect(el.shadowRoot!.querySelectorAll('lr-pagination').length).to.equal(1);

    const pagination = el.shadowRoot!.querySelector('lr-pagination')!;
    pagination.dispatchEvent(
      new CustomEvent('lr-page-change', { detail: { page: 2, pageSize: 100 }, bubbles: true, composed: true })
    );
    await el.updateComplete;
    expect(el.page).to.equal(2);
    expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(30);
  });

  it('gives an unbounded resize separator an explicit finite ARIA maximum', async () => {
    const el = (await fixture(html`<lr-table aria-label="Scores"></lr-table>`)) as LyraTable<Row>;
    el.columns = [{ ...columns[0]!, resizable: true, width: '240px' }];
    el.rows = rows;
    await el.updateComplete;
    const handle = el.shadowRoot!.querySelector('[part="resize-handle"]')!;
    expect(handle.getAttribute('aria-valuenow')).to.equal('240');
    expect(handle.getAttribute('aria-valuemax')).to.equal(String(Number.MAX_SAFE_INTEGER));
  });

  it('uses the explicit priority visibility axis and its single event', async () => {
    const container = document.createElement('div');
    container.style.inlineSize = '300px';
    const el = (await fixture(html`<lr-table aria-label="Scores"></lr-table>`, {
      parentNode: container,
    })) as LyraTable<Row>;
    el.columns = [
      columns[0]!,
      { ...columns[1]!, priority: 'low', headerCell: forcedWidthHeaderCell(350, 'Score') },
    ];
    el.rows = rows;
    await waitUntil(() => (el as unknown as { hasHiddenPriorityColumns: boolean }).hasHiddenPriorityColumns === true);

    let detail: unknown;
    el.addEventListener('lr-priority-columns-visibility-change', (event) => {
      detail = (event as CustomEvent).detail;
    });
    (el.shadowRoot!.querySelector('[part="reveal-columns-button"]') as HTMLElement).click();

    expect((el as unknown as { priorityColumnsVisible: boolean }).priorityColumnsVisible).to.equal(true);
    expect(detail).to.deep.equal({ visible: true });
    expect((el as unknown as { columnsHidden?: boolean }).columnsHidden).to.equal(undefined);
    expect((el as unknown as { showAllColumns?: boolean }).showAllColumns).to.equal(undefined);
  });

  it('accepts only explicit sticky and edit-trigger string axes', async () => {
    const el = (await fixture(html`<lr-table aria-label="Scores"></lr-table>`)) as LyraTable<Row>;
    el.columns = [
      {
        ...columns[0]!,
        sticky: true,
        editable: true,
        editValue: (row: Row) => row.name,
      } as unknown as TableColumn<Row>,
    ];
    el.rows = rows;
    await el.updateComplete;
    const legacyCell = el.shadowRoot!.querySelector<HTMLElement>('[part="cell"]')!;
    legacyCell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(legacyCell.hasAttribute('data-sticky')).to.equal(false);
    expect(el.shadowRoot!.querySelectorAll('[part="cell-editor"]').length).to.equal(0);

    el.columns = [
      {
        key: 'name',
        label: 'Name',
        sortable: true,
        cell: (row: Row) => row.name,
        sticky: 'start',
        editTrigger: 'double-click',
        editValue: (row: Row) => row.name,
      },
    ];
    await el.updateComplete;
    const explicitCell = el.shadowRoot!.querySelector<HTMLElement>('[part="cell"]')!;
    explicitCell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(explicitCell.getAttribute('data-sticky')).to.equal('start');
    expect(el.shadowRoot!.querySelectorAll('[part="cell-editor"]').length).to.equal(1);
  });
});

describe('coverage: hostile-input collection normalization', () => {
  it('selectedRowKeys setter: retains the safe prefix when the supplied iterable throws mid-iteration', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.selectedRowKeys = hostileIterable(['a', 'b', 'c'], 1) as never;
    await el.updateComplete;
    expect([...el.selectedRowKeys]).to.deep.equal(['a']);
  });

  it('selectedRowKeys facade forEach(): forwards (value, value, facade) and the given thisArg', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.selectedRowKeys = new Set(['a', 'b']);
    await el.updateComplete;
    const seen: unknown[][] = [];
    const thisArg = { tag: 'ctx' };
    el.selectedRowKeys.forEach(function (this: unknown, value, value2, set) {
      seen.push([value, value2, this]);
      expect(set.has(value)).to.equal(true);
    }, thisArg);
    expect(seen).to.deep.equal([
      ['a', 'a', thisArg],
      ['b', 'b', thisArg],
    ]);
  });

  it('rows setter: retains the safe prefix when a hostile indexed getter throws mid-iteration', async () => {
    const hostileRows: Row[] = [
      { id: 'a', name: 'Alpha', score: 1 },
      { id: 'b', name: 'Beta', score: 2 },
      { id: 'c', name: 'Gamma', score: 3 },
    ];
    Object.defineProperty(hostileRows, '1', {
      get(): Row {
        throw new Error('hostile row');
      },
    });
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.rows = hostileRows;
    await el.updateComplete;
    expect(el.rows.map((r) => r.id)).to.deep.equal(['a']);
  });

  it('columns setter: skips entirely when the array-like length itself is unreadable (hostile Proxy)', async () => {
    const real: TableColumn<Row>[] = [...columns];
    const hostile = new Proxy(real, {
      getOwnPropertyDescriptor(target, prop) {
        if (prop === 'length') throw new Error('hostile length');
        return Object.getOwnPropertyDescriptor(target, prop);
      },
    });
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = hostile as never;
    await el.updateComplete;
    expect(el.columns.length).to.equal(0);
  });

  it('columns setter: skips only the index whose own property descriptor is unreadable, keeping valid neighbors (hostile Proxy)', async () => {
    const real: TableColumn<Row>[] = [
      { key: 'a', label: 'A', cell: () => '' },
      { key: 'b', label: 'B', cell: () => '' },
      { key: 'c', label: 'C', cell: () => '' },
    ];
    const hostile = new Proxy(real, {
      getOwnPropertyDescriptor(target, prop) {
        if (prop === '1') throw new Error('hostile index');
        return Object.getOwnPropertyDescriptor(target, prop);
      },
    });
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = hostile as never;
    await el.updateComplete;
    expect(el.columns.map((c) => c.key)).to.deep.equal(['a', 'c']);
  });

  it('columns setter: skips a definition whose key getter throws, keeping valid neighbors', async () => {
    const hostileColumn = { label: 'Hostile' } as unknown as TableColumn<Row>;
    Object.defineProperty(hostileColumn, 'key', {
      get(): string {
        throw new Error('hostile key');
      },
    });
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = [{ key: 'a', label: 'A', cell: () => '' }, hostileColumn, { key: 'c', label: 'C', cell: () => '' }];
    await el.updateComplete;
    expect(el.columns.map((c) => c.key)).to.deep.equal(['a', 'c']);
  });

  it('keyOf(): omits a row entirely when the rowKey callback throws for it, keeping valid neighbors', async () => {
    const throwingRowKey = (row: Row): string => {
      if (row.id === 'b') throw new Error('hostile rowKey');
      return row.id;
    };
    const el = (await fixture(
      html`<lr-table .columns=${columns} .rows=${rows} .rowKey=${throwingRowKey}></lr-table>`
    )) as LyraTable<Row>;
    await el.updateComplete;
    const rowEls = [...el.shadowRoot!.querySelectorAll<HTMLElement>('tbody tr[data-row-key]')];
    // data-row-key is encodeKey()-encoded as `${typeof key}:${key}`.
    expect(rowEls.map((tr) => tr.dataset['rowKey'])).to.deep.equal(['string:a']);
  });

  it('eventInteractiveTarget(): skips a non-Element composed-path entry (e.g. an open shadow root) instead of throwing', async () => {
    // A click inside a nested OPEN-shadow custom control's own shadow tree puts that shadow root
    // itself (nodeType 11, no `.matches()`) in the composed path ahead of the control's host
    // element -- asElement() must skip it rather than throw, and the passive (non-interactive)
    // host must still leave the click on the row's own activation surface.
    class OpenPassiveElement extends HTMLElement {
      connectedCallback(): void {
        const root = this.attachShadow({ mode: 'open' });
        const span = document.createElement('span');
        span.textContent = this.textContent ?? '';
        root.append(span);
      }
    }
    if (!customElements.get('table-open-passive')) {
      customElements.define('table-open-passive', OpenPassiveElement);
    }
    const openColumns: TableColumn<Row>[] = [
      { key: 'name', label: 'Name', cell: (row) => html`<table-open-passive>${row.name}</table-open-passive>` },
    ];
    const el = (await fixture(
      html`<lr-table .columns=${openColumns} .rows=${rows} .rowKey=${(row: Row) => row.id}></lr-table>`
    )) as LyraTable<Row>;
    await el.updateComplete;
    const innerSpan = el.shadowRoot!.querySelector('table-open-passive')!.shadowRoot!.querySelector('span')!;
    let activated = 0;
    el.addEventListener('lr-row-activate', () => activated++);
    innerSpan.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(activated).to.equal(1);
  });

  it('retains the previously roving-focused row by key (not stale index) when a client-side sort reorders it', async () => {
    const el = (await fixture(
      html`<lr-table .columns=${columns} .rows=${rows} .rowKey=${(row: Row) => row.id}></lr-table>`
    )) as LyraTable<Row>;
    await el.updateComplete;
    const rowEls = () => [...el.shadowRoot!.querySelectorAll<HTMLElement>('tbody tr[data-row-key]')];
    // data-row-key is encodeKey()-encoded as `${typeof key}:${key}`.
    const [firstRow, secondRow] = rowEls();
    firstRow!.focus();
    firstRow!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement === secondRow).to.equal(true);
    expect(secondRow!.dataset['rowKey']).to.equal('string:b');
    expect(secondRow!.getAttribute('tabindex')).to.equal('0');

    el.sortKey = 'score';
    el.sortDir = 'asc';
    await el.updateComplete;

    const rowsAfter = rowEls();
    // score asc moves Beta (score: 1) ahead of Alpha (score: 3).
    expect(rowsAfter[0]!.dataset['rowKey']).to.equal('string:b');
    const focusedNow = rowsAfter.find((tr) => tr.getAttribute('tabindex') === '0')!;
    expect(focusedNow.dataset['rowKey']).to.equal('string:b');
  });
});

describe('a column missing its cell renderer', () => {
  it('renders the rest of the table instead of throwing out of lit repeat', async () => {
    const originalWarn = console.warn;
    const originalError = console.error;
    console.warn = () => {};
    console.error = () => {};
    try {
      const el = (await fixture(html`<lr-table aria-label="Test table"></lr-table>`)) as LyraTable;
      el.columns = [
        { key: 'ok', label: 'OK', cell: (row: { ok: string }) => row.ok },
        { key: 'broken', label: 'Broken' },
      ] as never;
      el.rows = [{ ok: 'value' }] as never;
      await el.updateComplete;

      expect(
        el.shadowRoot!.textContent?.includes('value'),
        'the well-formed column still renders',
      ).to.be.true;
    } finally {
      console.warn = originalWarn;
      console.error = originalError;
    }
  });

  it('uses one fixed dev-only warning without leaking caller data', async () => {
    const runtime = globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> };
    const originalIssuedWarnings = runtime.litIssuedWarnings;
    const originalError = console.error;
    const originalWarn = console.warn;
    const messages: string[] = [];
    runtime.litIssuedWarnings = new Set();
    console.error = () => {};
    console.warn = (...args: unknown[]) => messages.push(args.map(String).join(' '));
    try {
      const first = (await fixture(html`<lr-table aria-label="Test table"></lr-table>`)) as LyraTable;
      first.columns = [{ key: 'customer-42', label: 'Customer' }] as never;
      first.rows = [{ privateRecord: 'do-not-log' }] as never;
      await first.updateComplete;

      const second = (await fixture(html`<lr-table aria-label="Test table"></lr-table>`)) as LyraTable;
      second.columns = [{ key: 'account-99', label: 'Account' }] as never;
      second.rows = [{ privateRecord: 'also-do-not-log' }] as never;
      await second.updateComplete;

      expect(messages.length).to.equal(1);
      const diagnostic = messages.join('\n');
      expect(diagnostic).to.contain('lr-table');
      expect(diagnostic).to.contain('cell');
      expect(diagnostic).to.not.contain('customer-42');
      expect(diagnostic).to.not.contain('account-99');
      expect(diagnostic).to.not.contain('do-not-log');
    } finally {
      if (originalIssuedWarnings === undefined) delete runtime.litIssuedWarnings;
      else runtime.litIssuedWarnings = originalIssuedWarnings;
      console.warn = originalWarn;
      console.error = originalError;
    }
  });

  it('stays silent when Lit development diagnostics are disabled', async () => {
    const runtime = globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> };
    const originalIssuedWarnings = runtime.litIssuedWarnings;
    const originalError = console.error;
    const originalWarn = console.warn;
    const messages: string[] = [];
    delete runtime.litIssuedWarnings;
    console.error = (...args: unknown[]) => messages.push(args.map(String).join(' '));
    console.warn = (...args: unknown[]) => messages.push(args.map(String).join(' '));
    try {
      const el = (await fixture(html`<lr-table aria-label="Test table"></lr-table>`)) as LyraTable;
      el.columns = [{ key: 'customer-42', label: 'Customer' }] as never;
      el.rows = [{ a: 1 }, { a: 2 }, { a: 3 }, { a: 4 }] as never;
      await el.updateComplete;

      expect(messages.length).to.equal(0);
    } finally {
      if (originalIssuedWarnings === undefined) delete runtime.litIssuedWarnings;
      else runtime.litIssuedWarnings = originalIssuedWarnings;
      console.warn = originalWarn;
      console.error = originalError;
    }
  });

  it('sorts on a column missing its cell renderer instead of throwing out of sortedEntries', async () => {
    const originalWarn = console.warn;
    const originalError = console.error;
    console.warn = () => {};
    console.error = () => {};
    try {
      const el = (await fixture(html`<lr-table aria-label="Test table"></lr-table>`)) as LyraTable;
      el.columns = [
        { key: 'ok', label: 'OK', cell: (row: { ok: string }) => row.ok },
        { key: 'broken', label: 'Broken', sortable: true },
      ] as never;
      el.rows = [{ ok: 'a' }, { ok: 'b' }] as never;
      el.sortKey = 'broken';
      await el.updateComplete;

      expect(
        el.shadowRoot!.textContent?.includes('a'),
        'the well-formed column still renders while sorting on the broken column',
      ).to.be.true;
    } finally {
      console.warn = originalWarn;
      console.error = originalError;
    }
  });

  it('ignores truthy non-function optional column callbacks', async () => {
    for (const callback of ['sortValue', 'headerCell', 'cellStyle'] as const) {
      const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable;
      el.columns = [{
        key: 'value',
        label: 'Value',
        cell: (row: { value: string }) => row.value,
        sortable: true,
        [callback]: 'not-a-function',
      }] as never;
      el.rows = [{ value: 'kept' }] as never;
      if (callback === 'sortValue') el.sortKey = 'value';

      await el.updateComplete;

      expect(el.shadowRoot!.textContent).to.include('kept');
    }
  });
});

describe('deprecated lr-table aliases', () => {
  const populated = async (el: LyraTable<Row>): Promise<LyraTable<Row>> => {
    el.columns = columns;
    el.rows = rows;
    await el.updateComplete;
    return el;
  };
  it('emits only lr-row-activate with the activated row detail', async () => {
    const el = await populated((await fixture(html`<lr-table aria-label="Scores"></lr-table>`)) as LyraTable<Row>);
    const events: [string, CustomEvent][] = [];
    for (const type of ['lr-row-activate', 'lr-row-click']) {
      el.addEventListener(type, (event) => events.push([type, event as CustomEvent]));
    }
    const warnings = await captureDeprecationWarnings([], async () => {
      (el.shadowRoot!.querySelector('[part="row"]') as HTMLElement).click();
    });
    expect(events.map(([type]) => type)).to.deep.equal(['lr-row-activate']);
    expect(events[0]![1].detail.row).to.deep.equal(rows[0]);
    expect(events.map(([, event]) => [event.bubbles, event.composed, event.cancelable])).to.deep.equal([
      [true, true, false],
    ]);
    expect(warnings).to.deep.equal([]);
  });

});
