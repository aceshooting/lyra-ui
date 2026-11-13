import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { priorityColumns, rows, type Row } from '../../../../test/table.js';
import type { LyraTable, TableColumn } from './table.js';
import './table.js';

interface ScoreRow {
  readonly id: string;
  readonly group: string;
  readonly score: number | null | undefined;
}

const scoreColumns: TableColumn<ScoreRow>[] = [
  { key: 'id', label: 'Entry', cell: row => row.id },
  { key: 'score', label: 'Score', sortable: true, sortValue: row => row.score,
    cell: row => typeof row.score === 'number' && Number.isFinite(row.score) ? row.score : 'Missing' },
];
const samples = [
  ['three-first', 3], ['null', null], ['undefined', undefined], ['nan', Number.NaN],
  ['infinity', Number.POSITIVE_INFINITY], ['one', 1], ['negative-infinity', Number.NEGATIVE_INFINITY], ['three-second', 3],
] as const;

for (const grouped of [false, true]) {
  it(`keeps missing scores last and stable in both directions${grouped ? ' within interleaved groups' : ''}`, async () => {
    const groups = grouped ? ['second', 'first'] : ['only'];
    const source = Object.freeze(samples.flatMap(([id, score]) => groups.map(group => Object.freeze({ id: `${group}:${id}`, group, score }))));
    const originalIds = source.map(row => row.id);
    const table = await fixture<LyraTable<ScoreRow>>(html`<lr-table aria-label="Scores"
      .columns=${scoreColumns} .rows=${source} .rowKey=${(row: ScoreRow) => row.id}
      .groupBy=${grouped ? (row: ScoreRow) => row.group : undefined} sort-key="score"
    ></lr-table>`);
    let sortEvents = 0;
    table.addEventListener('lr-sort-change', () => sortEvents++);
    for (const direction of ['asc', 'desc', 'asc'] as const) {
      table.sortDir = direction;
      await table.updateComplete;
      const finite = direction === 'asc' ? ['one', 'three-first', 'three-second'] : ['three-first', 'three-second', 'one'];
      const missing = ['null', 'undefined', 'nan', 'infinity', 'negative-infinity'];
      const expected = groups.flatMap(group => [...finite, ...missing].map(id => `${group}:${id}`));
      const rendered = [...table.shadowRoot!.querySelectorAll<HTMLElement>('tbody tr[data-row-key] td[data-col-key="id"]')]
        .map(cell => cell.textContent!.trim());
      expect(rendered).to.deep.equal(expected);
      expect(table.shadowRoot!.querySelector('th[data-col-key="score"]')!.getAttribute('aria-sort'))
        .to.equal(direction === 'asc' ? 'ascending' : 'descending');
      expect(source.map(row => row.id)).to.deep.equal(originalIds);
      expect(sortEvents).to.equal(0);
    }
  });
}

for (const revealed of [false, true]) {
  it(`clears obsolete responsive columns and restores the ${revealed ? 'revealed' : 'collapsed'} preference after a schema replacement`, async () => {
    const table = await fixture<LyraTable<Row>>(html`<lr-table aria-label="Results"
      style="display:block;inline-size:300px" .columns=${priorityColumns} .rows=${rows}
    ></lr-table>`);
    await waitUntil(() => table.hasHiddenPriorityColumns);
    const toggle = (): HTMLButtonElement | null => table.shadowRoot!.querySelector('[part="reveal-columns-button"]');
    if (revealed) {
      toggle()!.click();
      await table.updateComplete;
      await waitUntil(() => !table.hasHiddenPriorityColumns);
    }
    const name = table.shadowRoot!.querySelector<HTMLElement>('th[data-col-key="name"]')!;
    await focusByKeyboard(name);
    const diagnostic = '<lr-table>: `priorityColumnsVisible` has no effect unless at least one column declares `priority`.';
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      if (args.length === 1 && args[0] === diagnostic) warnings.push(diagnostic);
      else originalWarn(...args);
    };
    try {
      table.columns = [priorityColumns[0]!];
      await table.updateComplete;
      await waitUntil(() => !table.hasHiddenPriorityColumns && toggle() === null);
    } finally {
      console.warn = originalWarn;
    }
    expect(warnings).to.deep.equal(revealed ? [diagnostic] : []);
    const base = table.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.hasAttribute('data-hide-priority-low')).to.equal(false);
    expect(base.hasAttribute('data-hide-priority-medium')).to.equal(false);
    expect(table.shadowRoot!.activeElement?.getAttribute('data-col-key')).to.equal('name');
    expect(table.priorityColumnsVisible).to.equal(revealed);
    expect([...table.shadowRoot!.querySelectorAll<HTMLElement>('th[data-col-key]')]
      .filter(header => header.getBoundingClientRect().width > 0).map(header => header.dataset['colKey']))
      .to.deep.equal(['name']);
    table.columns = priorityColumns;
    await table.updateComplete;
    await waitUntil(() => toggle() !== null && table.hasHiddenPriorityColumns === !revealed);
    expect(toggle()!.textContent!.trim()).to.equal(revealed ? 'Show fewer columns' : 'Show all columns');
    const low = table.shadowRoot!.querySelector<HTMLElement>('th[data-col-key="id"]')!;
    expect(getComputedStyle(low).display === 'none').to.equal(!revealed);
    expect(table.shadowRoot!.activeElement?.getAttribute('data-col-key')).to.equal('name');
  });
}
