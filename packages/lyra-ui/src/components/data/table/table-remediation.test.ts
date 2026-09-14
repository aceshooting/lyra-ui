import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './table.js';
import type { LyraTable, TableColumn } from './table.js';

type Row = { id: string; name: string };
const rows: Row[] = [{ id: 'ä', name: 'ä' }, { id: 'z', name: 'z' }];
const columns: TableColumn<Row>[] = [{ key: 'name', label: 'Name', sortable: true, editTrigger: 'double-click', editValue: (row) => row.name, cell: (row) => row.name }];
const rowKey = (row: Row) => row.id;

describe('table live derived rows and responsive bands', () => {
  it('treats removed filter-text as absence and recovers without changing null readback', async () => {
    const element = await fixture<LyraTable<Row>>(html`<lr-table caption="Names" filter-text="ä" .rows=${rows} .columns=${columns} .rowKey=${rowKey}></lr-table>`);
    expect(element.shadowRoot!.querySelectorAll('tbody tr[data-row-key]').length).to.equal(1);
    element.removeAttribute('filter-text');
    await element.updateComplete;
    expect(element.filterText as unknown).to.equal(null);
    expect(element.shadowRoot!.querySelectorAll('tbody tr[data-row-key]').length).to.equal(2);
    element.setAttribute('filter-text', 'z');
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector('tbody tr[data-row-key]')?.textContent).to.contain('z');
    element.setAttribute('filter-text', '');
    await element.updateComplete;
    expect(element.filterText).to.equal('');
    expect(element.shadowRoot!.querySelectorAll('tbody tr[data-row-key]').length).to.equal(2);
  });

  for (const inherited of [false, true]) {
    it(`refreshes activation and focused page identity after ${inherited ? 'inherited' : 'own'} locale recollation`, async () => {
      const wrapper = await fixture<HTMLDivElement>(html`<div lang="de"><lr-table caption="Names"
        .rows=${rows} .columns=${columns} .rowKey=${rowKey} sort-key="name" .pageSize=${1}
      ></lr-table></div>`);
      const element = wrapper.querySelector<LyraTable<Row>>('lr-table')!;
      if (!inherited) element.lang = 'de';
      await element.updateComplete;
      const displayed = () => element.shadowRoot!.querySelector<HTMLElement>('tbody tr[data-row-key]')!;
      expect(displayed().textContent).to.contain('ä');
      const activated: Row[] = [];
      element.addEventListener('lr-row-click', (event) => activated.push((event as CustomEvent<{ row: Row }>).detail.row));
      displayed().click();
      expect(activated[0] === rows[0]).to.equal(true);
      displayed().focus();
      (inherited ? wrapper : element).lang = 'sv';
      await waitUntil(() => displayed().textContent?.includes('z') === true);
      expect(activated.length).to.equal(1);
      expect(element.shadowRoot!.activeElement?.getAttribute('data-row-key')).to.equal(displayed().getAttribute('data-row-key'));
      await sendKeys({ press: 'Enter' });
      expect(activated[1] === rows[1]).to.equal(true);
      displayed().click();
      expect(activated[2] === rows[1]).to.equal(true);
      const cell = displayed().querySelector<HTMLElement>('[part="cell"]')!;
      cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
      await element.updateComplete;
      const editor = cell.querySelector<HTMLInputElement>('[part="cell-editor"]');
      expect(editor?.value).to.equal('z');
      const edits: Row[] = [];
      element.addEventListener('lr-cell-edit', (event) => edits.push((event as CustomEvent<{ row: Row }>).detail.row));
      editor!.value = 'Renamed';
      editor!.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      expect(edits[0] === rows[1]).to.equal(true);
    });
  }

  for (const direction of ['ltr', 'rtl']) {
    for (const width of [320, 700, 1000]) {
      it(`aligns footer priorities with header and body at ${width}px in ${direction}`, async () => {
        const priorityColumns: TableColumn<Row>[] = ['high', 'medium', 'low'].map((priority) => ({
          key: priority, label: priority, priority: priority === 'high' ? undefined : priority as 'medium' | 'low', cell: (row: Row) => row.name, footer: () => 'Total',
        }));
        const element = await fixture<LyraTable<Row>>(html`<lr-table caption="Names"
          style=${`inline-size: ${width}px`} dir=${direction} .rows=${rows} .columns=${priorityColumns}
          .rowKey=${rowKey} .expandedContent=${() => html`Details`}
        ></lr-table>`);
        await waitUntil(() => element.getBoundingClientRect().width === width);
        for (const priority of ['high', 'medium', 'low']) {
          const cells = [...element.shadowRoot!.querySelectorAll<HTMLElement>(`[data-col-key="${priority}"]`)].filter((cell) => cell.matches('th,td'));
          const expected = priority === 'low' && width < 900 || priority === 'medium' && width < 640 ? 'none' : 'table-cell';
          expect(cells.map((cell) => getComputedStyle(cell).display)).to.deep.equal(Array(cells.length).fill(expected));
          expect(cells.some((cell) => cell.getAttribute('part') === 'footer-cell')).to.equal(true);
        }
        expect([...element.shadowRoot!.querySelectorAll<HTMLElement>('tfoot td:not([data-col-key])')].map((cell) => getComputedStyle(cell).display)).to.deep.equal(['table-cell']);
        element.priorityColumnsVisible = true;
        await element.updateComplete;
        expect([...element.shadowRoot!.querySelectorAll<HTMLElement>('th[data-col-key],td[data-col-key]')].every((cell) => getComputedStyle(cell).display === 'table-cell')).to.equal(true);
      });
    }
  }
});

interface ScoreRow {
  id: string;
  name: string;
  score: number;
}

const scoreRows: ScoreRow[] = [
  { id: 'a', name: 'Alpha', score: 30 },
  { id: 'b', name: 'Beta', score: 10 },
  { id: 'c', name: 'Gamma', score: 20 },
];

const scoreColumns: TableColumn<ScoreRow>[] = [
  { key: 'name', label: 'Name', sortable: true, sortValue: (row) => row.name, cell: (row) => row.name },
  {
    key: 'score',
    label: 'Score',
    sortable: true,
    align: 'end',
    sortValue: (row) => row.score,
    cell: (row) => row.score,
  },
];

describe('viewRows / pageRows', () => {
  it('reflect filtering and sorting while ignoring pagination, and pageRows reflects only the current page', async () => {
    const element = await fixture<LyraTable<ScoreRow>>(html`<lr-table
      caption="Scores"
      .rows=${scoreRows}
      .columns=${scoreColumns}
      .rowKey=${(row: ScoreRow) => row.id}
      sort-key="score"
      sort-dir="asc"
      page-size="1"
    ></lr-table>`);
    await element.updateComplete;
    // Sorted ascending by score (10, 20, 30) regardless of pageSize=1.
    expect(element.viewRows.map((row) => row.id)).to.deep.equal(['b', 'c', 'a']);
    expect(element.pageRows.map((row) => row.id)).to.deep.equal(['b']);

    element.page = 2;
    await element.updateComplete;
    expect(element.pageRows.map((row) => row.id)).to.deep.equal(['c']);
    // Pagination never affects viewRows.
    expect(element.viewRows.map((row) => row.id)).to.deep.equal(['b', 'c', 'a']);

    element.filterText = 'Gamma';
    await element.updateComplete;
    expect(element.viewRows.map((row) => row.id)).to.deep.equal(['c']);
    expect(element.pageRows.map((row) => row.id)).to.deep.equal(['c']);
  });

  it('return frozen defensive copies that cannot corrupt internal state', async () => {
    const element = await fixture<LyraTable<ScoreRow>>(html`<lr-table
      caption="Scores"
      .rows=${scoreRows}
      .columns=${scoreColumns}
      .rowKey=${(row: ScoreRow) => row.id}
    ></lr-table>`);
    await element.updateComplete;

    const view = element.viewRows;
    expect(Object.isFrozen(view)).to.equal(true);
    expect(() => {
      (view as ScoreRow[])[0] = scoreRows[1]!;
    }).to.throw();
    expect(() => {
      (view as unknown as ScoreRow[]).push(scoreRows[0]!);
    }).to.throw();

    const page = element.pageRows;
    expect(Object.isFrozen(page)).to.equal(true);
    expect(() => {
      (page as ScoreRow[])[0] = scoreRows[1]!;
    }).to.throw();

    // The failed mutation attempts above must not have reached the table's own state -- a fresh
    // read still reports the untouched, unsorted (no sortKey set) input order.
    expect(element.viewRows.map((row) => row.id)).to.deep.equal(['a', 'b', 'c']);
    expect(element.pageRows.map((row) => row.id)).to.deep.equal(['a', 'b', 'c']);
    expect(element.rows).to.deep.equal(scoreRows);
  });
});

interface MixedSortRow {
  id: string;
  label: string;
  updated: number;
}

const mixedSortRows: MixedSortRow[] = [
  { id: 'a', label: 'Bravo', updated: 2 },
  { id: 'b', label: 'Alpha', updated: 1 },
];

const mixedSortColumns: TableColumn<MixedSortRow>[] = [
  { key: 'label', label: 'Label', sortable: true, sortValue: (row) => row.label, cell: (row) => row.label },
  {
    key: 'updated',
    label: 'Updated',
    sortable: true,
    // Opts this one numeric column into a descending first activation while every other column
    // (and the element-level default below) stays ascending.
    defaultSortDir: 'desc',
    sortValue: (row) => row.updated,
    cell: (row) => row.updated,
  },
];

describe('columns[].defaultSortDir', () => {
  it('wins over the element-level defaultSortDir the first time the column becomes active', async () => {
    const element = await fixture<LyraTable<MixedSortRow>>(html`<lr-table
      caption="Mixed"
      .rows=${mixedSortRows}
      .columns=${mixedSortColumns}
      .rowKey=${(row: MixedSortRow) => row.id}
      default-sort-dir="asc"
    ></lr-table>`);
    await element.updateComplete;
    const header = element.shadowRoot!.querySelector<HTMLElement>('th[data-col-key="updated"]')!;
    header.click();
    await element.updateComplete;
    expect(element.sortKey).to.equal('updated');
    expect(element.sortDir).to.equal('desc');
  });

  it('falls back to the element-level defaultSortDir for a column that omits its own', async () => {
    const element = await fixture<LyraTable<MixedSortRow>>(html`<lr-table
      caption="Mixed"
      .rows=${mixedSortRows}
      .columns=${mixedSortColumns}
      .rowKey=${(row: MixedSortRow) => row.id}
      default-sort-dir="desc"
    ></lr-table>`);
    await element.updateComplete;
    const header = element.shadowRoot!.querySelector<HTMLElement>('th[data-col-key="label"]')!;
    header.click();
    await element.updateComplete;
    expect(element.sortKey).to.equal('label');
    expect(element.sortDir).to.equal('desc');
  });

  it('leaves repeat-activation toggle behavior on the same column unchanged', async () => {
    const element = await fixture<LyraTable<MixedSortRow>>(html`<lr-table
      caption="Mixed"
      .rows=${mixedSortRows}
      .columns=${mixedSortColumns}
      .rowKey=${(row: MixedSortRow) => row.id}
      default-sort-dir="asc"
    ></lr-table>`);
    await element.updateComplete;
    const header = element.shadowRoot!.querySelector<HTMLElement>('th[data-col-key="updated"]')!;
    header.click();
    await element.updateComplete;
    expect(element.sortDir).to.equal('desc'); // column-level default on first activation
    header.click();
    await element.updateComplete;
    expect(element.sortDir).to.equal('asc'); // plain toggle, ignoring defaultSortDir entirely
    header.click();
    await element.updateComplete;
    expect(element.sortDir).to.equal('desc'); // toggles back
  });
});

const plainInertLabelColumns: TableColumn<Row>[] = [{ key: 'name', label: 'Name', cell: (row) => row.name }];
const priorityInertLabelColumns: TableColumn<Row>[] = [
  { key: 'name', label: 'Name', cell: (row) => row.name },
  { key: 'id', label: 'Id', priority: 'low', cell: (row) => row.id },
];

describe('inert revealColumnsLabel/hideColumnsLabel dev warning', () => {
  let originalWarn: typeof console.warn;
  let originalIssuedWarnings: Set<string> | undefined;
  let warnings: unknown[][];
  beforeEach(() => {
    originalWarn = console.warn;
    warnings = [];
    console.warn = (...args: unknown[]) => warnings.push(args);
    const runtime = globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> };
    originalIssuedWarnings = runtime.litIssuedWarnings;
    runtime.litIssuedWarnings = new Set();
  });
  afterEach(() => {
    console.warn = originalWarn;
    const runtime = globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> };
    if (originalIssuedWarnings === undefined) delete runtime.litIssuedWarnings;
    else runtime.litIssuedWarnings = originalIssuedWarnings;
  });

  it('warns once when the labels are set but no column declares priority', async () => {
    const element = await fixture<LyraTable<Row>>(html`<lr-table
      caption="Names"
      reveal-columns-label="Show columns"
      hide-columns-label="Hide columns"
      .rows=${rows}
      .columns=${plainInertLabelColumns}
      .rowKey=${rowKey}
    ></lr-table>`);
    await element.updateComplete;
    expect(warnings.length).to.equal(1);
    expect(String(warnings[0]![0])).to.include('revealColumnsLabel');
    expect(String(warnings[0]![0])).to.include('priority');

    // A later, unrelated render must not repeat the page-bounded warning.
    element.rows = [...rows];
    await element.updateComplete;
    expect(warnings.length).to.equal(1);
  });

  it('does not warn when a priority column exists', async () => {
    const element = await fixture<LyraTable<Row>>(html`<lr-table
      caption="Names"
      reveal-columns-label="Show columns"
      hide-columns-label="Hide columns"
      .rows=${rows}
      .columns=${priorityInertLabelColumns}
      .rowKey=${rowKey}
    ></lr-table>`);
    await element.updateComplete;
    expect(warnings.length).to.equal(0);
  });

  it('does not warn when neither label is set, even with no priority column', async () => {
    const element = await fixture<LyraTable<Row>>(html`<lr-table
      caption="Names"
      .rows=${rows}
      .columns=${plainInertLabelColumns}
      .rowKey=${rowKey}
    ></lr-table>`);
    await element.updateComplete;
    expect(warnings.length).to.equal(0);
  });
});

// Regression: willUpdate()'s persisted priorityColumnsVisible restore used to run with no guard at
// all, so a storage-key mount silently clobbered an explicit priority-columns-visible/
// .priorityColumnsVisible=${true} declaration with stale localStorage state.
describe('storage-key persistence of priorityColumnsVisible', () => {
  it('keeps an explicitly declared priority-columns-visible over a conflicting persisted value', async () => {
    const key = 'table-priority-columns-explicit-attr';
    localStorage.setItem(`lr-table:${key}`, JSON.stringify({ priorityColumnsVisible: false }));
    try {
      const element = await fixture<LyraTable<Row>>(html`<lr-table
        caption="Names"
        storage-key=${key}
        priority-columns-visible
        .rows=${rows}
        .columns=${columns}
        .rowKey=${rowKey}
      ></lr-table>`);
      expect(element.priorityColumnsVisible).to.equal(true);
    } finally {
      localStorage.removeItem(`lr-table:${key}`);
    }
  });

  it('keeps an explicit .priorityColumnsVisible property binding over a conflicting persisted value', async () => {
    const key = 'table-priority-columns-explicit-prop';
    localStorage.setItem(`lr-table:${key}`, JSON.stringify({ priorityColumnsVisible: false }));
    try {
      const element = await fixture<LyraTable<Row>>(html`<lr-table
        caption="Names"
        storage-key=${key}
        .priorityColumnsVisible=${true}
        .rows=${rows}
        .columns=${columns}
        .rowKey=${rowKey}
      ></lr-table>`);
      expect(element.priorityColumnsVisible).to.equal(true);
    } finally {
      localStorage.removeItem(`lr-table:${key}`);
    }
  });

  it('restores a persisted priority-columns-visible when the consumer declares nothing', async () => {
    const key = 'table-priority-columns-restore';
    localStorage.setItem(`lr-table:${key}`, JSON.stringify({ priorityColumnsVisible: true }));
    try {
      const element = await fixture<LyraTable<Row>>(html`<lr-table
        caption="Names"
        storage-key=${key}
        .rows=${rows}
        .columns=${columns}
        .rowKey=${rowKey}
      ></lr-table>`);
      expect(element.priorityColumnsVisible).to.equal(true);
    } finally {
      localStorage.removeItem(`lr-table:${key}`);
    }
  });
});
