import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './table.js';
import type { LyraTable, TableColumn } from './table.js';

interface Row {
  id: string;
  name: string;
  score: number;
}

const columns: TableColumn<Row>[] = [
  { key: 'name', label: 'Name', sortable: true, cell: (r) => r.name },
  { key: 'score', label: 'Score', sortable: true, align: 'end', cell: (r) => r.score },
];
const rows: Row[] = [
  { id: 'a', name: 'Alpha', score: 3 },
  { id: 'b', name: 'Beta', score: 1 },
];

it('renders header labels and a row per item, keyed by rowKey', async () => {
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;
  const headers = [...el.shadowRoot!.querySelectorAll('[part="header-cell"]')].map(
    (h) => h.textContent!.trim(),
  );
  expect(headers).to.deep.equal(['Name', 'Score']);
  expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(2);
});

it('emits lyra-sort when a sortable header is clicked', async () => {
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const header = el.shadowRoot!.querySelectorAll('[part="header-cell"]')[1] as HTMLElement;
  setTimeout(() => header.click());
  const ev = await oneEvent(el, 'lyra-sort');
  expect(ev.detail.key).to.equal('score');
});

it('emits lyra-row-click with the row data', async () => {
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const row = el.shadowRoot!.querySelector('[part="row"]') as HTMLElement;
  setTimeout(() => row.click());
  const ev = await oneEvent(el, 'lyra-row-click');
  expect(ev.detail.row).to.deep.equal(rows[0]);
});

it('renders lyra-empty when rows is empty', async () => {
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = [];
  el.emptyHeading = 'No matches';
  await el.updateComplete;
  const empty = el.shadowRoot!.querySelector('lyra-empty');
  expect(empty).to.exist;
  expect(empty!.getAttribute('heading')).to.equal('No matches');
});

it('emits lyra-load-more when the "load more" button is clicked', async () => {
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.hasMore = true;
  await el.updateComplete;
  const btn = el.shadowRoot!.querySelector('[part="more-button"]') as HTMLElement;
  setTimeout(() => btn.click());
  await oneEvent(el, 'lyra-load-more');
});

it('is accessible', async () => {
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('has part="head" on the thead element', async () => {
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const thead = el.shadowRoot!.querySelector('[part="head"]');
  expect(thead).to.exist;
  expect(thead!.tagName).to.equal('THEAD');
});

it('renders lyra-empty when columns is empty, even with non-empty rows', async () => {
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = [];
  el.rows = rows;
  await el.updateComplete;
  const empty = el.shadowRoot!.querySelector('lyra-empty');
  expect(empty).to.exist;
  expect(empty!.getAttribute('heading')).to.equal('No columns configured');
  expect(el.shadowRoot!.querySelector('table')).to.not.exist;
});

it('emits lyra-sort via keydown (Enter) on a sortable header, not just click', async () => {
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const header = el.shadowRoot!.querySelectorAll('[part="header-cell"]')[1] as HTMLElement;
  header.focus();
  setTimeout(() => header.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  const ev = await oneEvent(el, 'lyra-sort');
  expect(ev.detail.key).to.equal('score');
});

it('resolves the correct row via delegated click after a re-render (sort) reorders rows', async () => {
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;
  // Re-render with rows reordered — the delegated handler must resolve the
  // *current* row object, not one captured in a stale per-render closure.
  el.rows = [...rows].reverse();
  await el.updateComplete;
  const firstRow = el.shadowRoot!.querySelector('[part="row"]') as HTMLElement;
  setTimeout(() => firstRow.click());
  const ev = await oneEvent(el, 'lyra-row-click');
  expect(ev.detail.row).to.deep.equal(rows[1]); // Beta, now first after reversing
});

it('renders a visual sort-direction chevron only in the active sort column, marked aria-hidden', async () => {
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.sortKey = 'score';
  el.sortDir = 'desc';
  await el.updateComplete;
  const [nameHeader, scoreHeader] = [...el.shadowRoot!.querySelectorAll('[part="header-cell"]')];
  expect(nameHeader.querySelector('[part="sort-icon"]')).to.not.exist;
  const icon = scoreHeader.querySelector('[part="sort-icon"]');
  expect(icon).to.exist;
  expect(icon!.getAttribute('aria-hidden')).to.equal('true');
  expect(icon!.getAttribute('data-dir')).to.equal('desc');
  expect(icon!.querySelector('svg')).to.exist;
});

it('flips the sort-icon rotation data-dir when sortDir changes from desc to asc', async () => {
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.sortKey = 'score';
  el.sortDir = 'asc';
  await el.updateComplete;
  const scoreHeader = el.shadowRoot!.querySelectorAll('[part="header-cell"]')[1];
  const icon = scoreHeader.querySelector('[part="sort-icon"]');
  expect(icon!.getAttribute('data-dir')).to.equal('asc');
});

it('rotates the wrapping [part="sort-icon"] element, not the inner svg, per the icons.ts rotation contract', async () => {
  // internal/icons.ts documents: "callers needing 'up'/'left'/'open' etc.
  // rotate the wrapping part element via CSS transform: rotate(...), not the svg."
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.sortKey = 'score';
  el.sortDir = 'desc';
  await el.updateComplete;
  const scoreHeader = el.shadowRoot!.querySelectorAll('[part="header-cell"]')[1];
  const icon = scoreHeader.querySelector('[part="sort-icon"]') as HTMLElement;
  const svgEl = icon.querySelector('svg') as unknown as HTMLElement;
  expect(getComputedStyle(icon).transform).to.not.equal('none');
  expect(getComputedStyle(svgEl).transform).to.equal('none');
});

it('applies the shared focus-ring outline to a sortable header cell, a row, and the more-button on :focus-visible', async () => {
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.hasMore = true;
  await el.updateComplete;

  const header = el.shadowRoot!.querySelectorAll('[part="header-cell"]')[0] as HTMLElement;
  header.focus();
  expect(getComputedStyle(header).outlineStyle).to.equal('solid');
  expect(getComputedStyle(header).outlineWidth).to.equal('2px');

  const row = el.shadowRoot!.querySelector('[part="row"]') as HTMLElement;
  row.focus();
  expect(getComputedStyle(row).outlineStyle).to.equal('solid');
  expect(getComputedStyle(row).outlineWidth).to.equal('2px');

  const moreButton = el.shadowRoot!.querySelector('[part="more-button"]') as HTMLElement;
  moreButton.focus();
  expect(getComputedStyle(moreButton).outlineStyle).to.equal('solid');
  expect(getComputedStyle(moreButton).outlineWidth).to.equal('2px');
});

const priorityColumns: TableColumn<Row>[] = [
  { key: 'name', label: 'Name', cell: (r) => r.name },
  { key: 'score', label: 'Score', align: 'end', priority: 'medium', cell: (r) => r.score },
  { key: 'id', label: 'Id', priority: 'low', cell: (r) => r.id },
];

it('renders [part="reveal-columns-button"] only when at least one column declares a priority', async () => {
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = columns; // no priority columns
  el.rows = rows;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="reveal-columns-button"]')).to.not.exist;

  el.columns = priorityColumns;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="reveal-columns-button"]')).to.exist;
});

it('hides low- and medium-priority columns in a narrow container, and reveals them via the toggle button', async () => {
  const el = (await fixture(
    html`<lyra-table style="display: block; width: 300px;"></lyra-table>`,
  )) as LyraTable<Row>;
  el.columns = priorityColumns;
  el.rows = rows;
  await el.updateComplete;

  const lowHeader = el.shadowRoot!.querySelector('[part="header-cell"][data-priority="low"]') as HTMLElement;
  const mediumHeader = el.shadowRoot!.querySelector(
    '[part="header-cell"][data-priority="medium"]',
  ) as HTMLElement;
  const lowCell = el.shadowRoot!.querySelector('[part="cell"][data-priority="low"]') as HTMLElement;
  expect(lowHeader).to.exist;
  expect(mediumHeader).to.exist;
  expect(getComputedStyle(lowHeader).display).to.equal('none');
  expect(getComputedStyle(mediumHeader).display).to.equal('none');
  expect(getComputedStyle(lowCell).display).to.equal('none');

  const revealButton = el.shadowRoot!.querySelector('[part="reveal-columns-button"]') as HTMLElement;
  expect(revealButton.getAttribute('aria-pressed')).to.equal('false');
  revealButton.click();
  await el.updateComplete;

  expect(revealButton.getAttribute('aria-pressed')).to.equal('true');
  expect(getComputedStyle(lowHeader).display).to.not.equal('none');
  expect(getComputedStyle(mediumHeader).display).to.not.equal('none');
  expect(getComputedStyle(lowCell).display).to.not.equal('none');

  // Toggling back re-hides them.
  revealButton.click();
  await el.updateComplete;
  expect(getComputedStyle(lowHeader).display).to.equal('none');
});

it('hides only the low-priority column (not medium) in a mid-width container', async () => {
  const el = (await fixture(
    html`<lyra-table style="display: block; width: 700px;"></lyra-table>`,
  )) as LyraTable<Row>;
  el.columns = priorityColumns;
  el.rows = rows;
  await el.updateComplete;

  const lowHeader = el.shadowRoot!.querySelector('[part="header-cell"][data-priority="low"]') as HTMLElement;
  const mediumHeader = el.shadowRoot!.querySelector(
    '[part="header-cell"][data-priority="medium"]',
  ) as HTMLElement;
  expect(getComputedStyle(lowHeader).display).to.equal('none');
  expect(getComputedStyle(mediumHeader).display).to.not.equal('none');
});

it('swaps the reveal-columns-button label between revealColumnsLabel and hideColumnsLabel on toggle', async () => {
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = priorityColumns;
  el.rows = rows;
  await el.updateComplete;

  const revealButton = el.shadowRoot!.querySelector('[part="reveal-columns-button"]') as HTMLElement;
  expect(revealButton.textContent!.trim()).to.equal('Show all columns');

  revealButton.click();
  await el.updateComplete;
  expect(revealButton.textContent!.trim()).to.equal('Show fewer columns');

  revealButton.click();
  await el.updateComplete;
  expect(revealButton.textContent!.trim()).to.equal('Show all columns');
});

it('honors custom revealColumnsLabel and hideColumnsLabel property values', async () => {
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = priorityColumns;
  el.rows = rows;
  el.revealColumnsLabel = 'More columns';
  el.hideColumnsLabel = 'Fewer columns';
  await el.updateComplete;

  const revealButton = el.shadowRoot!.querySelector('[part="reveal-columns-button"]') as HTMLElement;
  expect(revealButton.textContent!.trim()).to.equal('More columns');

  revealButton.click();
  await el.updateComplete;
  expect(revealButton.textContent!.trim()).to.equal('Fewer columns');
});

it('never hides a column with no priority declared', async () => {
  const el = (await fixture(
    html`<lyra-table style="display: block; width: 300px;"></lyra-table>`,
  )) as LyraTable<Row>;
  el.columns = priorityColumns;
  el.rows = rows;
  await el.updateComplete;
  const nameHeader = el.shadowRoot!.querySelector('[part="header-cell"]') as HTMLElement;
  expect(nameHeader.hasAttribute('data-priority')).to.be.false;
  expect(getComputedStyle(nameHeader).display).to.not.equal('none');
});

it("gives a sticky column's header and cell the sticky positioning attribute and styles", async () => {
  const stickyColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', sticky: true, cell: (r) => r.name },
    { key: 'score', label: 'Score', align: 'end', cell: (r) => r.score },
  ];
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = stickyColumns;
  el.rows = rows;
  await el.updateComplete;

  const stickyHeader = el.shadowRoot!.querySelector('[part="header-cell"]') as HTMLElement;
  const stickyCell = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
  const nonStickyHeader = el.shadowRoot!.querySelectorAll('[part="header-cell"]')[1] as HTMLElement;

  expect(stickyHeader.hasAttribute('data-sticky')).to.be.true;
  expect(stickyCell.hasAttribute('data-sticky')).to.be.true;
  expect(nonStickyHeader.hasAttribute('data-sticky')).to.be.false;

  expect(getComputedStyle(stickyHeader).position).to.equal('sticky');
  expect(getComputedStyle(stickyCell).position).to.equal('sticky');
  expect(getComputedStyle(stickyCell).insetInlineStart).to.equal('0px');
  expect(getComputedStyle(stickyCell).boxShadow).to.not.equal('none');
});

it('does not emit lyra-row-click and does not swallow the click when a button inside a cell() is clicked', async () => {
  const actionColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', cell: (r) => r.name },
    {
      key: 'actions',
      label: 'Actions',
      cell: () => html`<button type="button" data-action>Go</button>`,
    },
  ];
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = actionColumns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;

  let rowClicked = false;
  el.addEventListener('lyra-row-click', () => (rowClicked = true));

  let buttonClicked = false;
  const actionButton = el.shadowRoot!.querySelector('[data-action]') as HTMLButtonElement;
  actionButton.addEventListener('click', () => (buttonClicked = true));
  actionButton.click();
  await el.updateComplete;

  expect(buttonClicked).to.be.true;
  expect(rowClicked).to.be.false;
});

it('sets aria-selected="true" only on the row matching selectedKey', async () => {
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  el.selectedKey = 'b';
  await el.updateComplete;
  const [firstRow, secondRow] = [...el.shadowRoot!.querySelectorAll('[part="row"]')];
  expect(firstRow.getAttribute('aria-selected')).to.equal('false');
  expect(secondRow.getAttribute('aria-selected')).to.equal('true');
});

it('sets data-align="end" on the header cell and body cell for an end-aligned column, and "start" otherwise', async () => {
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const [nameHeader, scoreHeader] = [...el.shadowRoot!.querySelectorAll('[part="header-cell"]')];
  expect(nameHeader.getAttribute('data-align')).to.equal('start');
  expect(scoreHeader.getAttribute('data-align')).to.equal('end');
  const firstRowCells = el.shadowRoot!.querySelectorAll('[part="row"]')[0].querySelectorAll('[part="cell"]');
  expect(firstRowCells[0].getAttribute('data-align')).to.equal('start');
  expect(firstRowCells[1].getAttribute('data-align')).to.equal('end');
});

it('emits lyra-row-click via keydown (Enter and Space) on a focused row', async () => {
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;
  const row = el.shadowRoot!.querySelector('[part="row"]') as HTMLElement;

  setTimeout(() => row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  let ev = await oneEvent(el, 'lyra-row-click');
  expect(ev.detail.row).to.deep.equal(rows[0]);

  setTimeout(() => row.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })));
  ev = await oneEvent(el, 'lyra-row-click');
  expect(ev.detail.row).to.deep.equal(rows[0]);
});

it('does not emit lyra-sort when a non-sortable header is clicked or activated via keyboard', async () => {
  const mixedColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', cell: (r) => r.name },
    { key: 'score', label: 'Score', sortable: true, align: 'end', cell: (r) => r.score },
  ];
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = mixedColumns;
  el.rows = rows;
  await el.updateComplete;

  let sortCount = 0;
  el.addEventListener('lyra-sort', () => sortCount++);

  const nameHeader = el.shadowRoot!.querySelectorAll('[part="header-cell"]')[0] as HTMLElement;
  nameHeader.click();
  nameHeader.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await el.updateComplete;

  expect(sortCount).to.equal(0);
});

it('exposes aria-sort as ascending/descending on the active sortable column, "none" once deactivated, and omits it on non-sortable columns', async () => {
  const mixedColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', cell: (r) => r.name },
    { key: 'score', label: 'Score', sortable: true, align: 'end', cell: (r) => r.score },
  ];
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = mixedColumns;
  el.rows = rows;
  el.sortKey = 'score';
  el.sortDir = 'asc';
  await el.updateComplete;

  const [nameHeader, scoreHeader] = [...el.shadowRoot!.querySelectorAll('[part="header-cell"]')];
  expect(nameHeader.hasAttribute('aria-sort')).to.be.false;
  expect(scoreHeader.getAttribute('aria-sort')).to.equal('ascending');

  el.sortDir = 'desc';
  await el.updateComplete;
  expect(scoreHeader.getAttribute('aria-sort')).to.equal('descending');

  el.sortKey = '';
  await el.updateComplete;
  expect(scoreHeader.getAttribute('aria-sort')).to.equal('none');
});

it('gives only the roving-tabindex header cell (default: the first column) a tabindex of 0, and the rest -1', async () => {
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const [nameHeader, scoreHeader] = [...el.shadowRoot!.querySelectorAll('[part="header-cell"]')];
  expect(nameHeader.getAttribute('tabindex')).to.equal('0');
  expect(scoreHeader.getAttribute('tabindex')).to.equal('-1');
});

it('gives only the roving-tabindex row (default: the first row) a tabindex of 0, and the rest -1', async () => {
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;
  const [firstRow, secondRow] = [...el.shadowRoot!.querySelectorAll('[part="row"]')];
  expect(firstRow.getAttribute('tabindex')).to.equal('0');
  expect(secondRow.getAttribute('tabindex')).to.equal('-1');
});

it('uses selectedKey as the default roving-tabindex row when no row has been focused yet', async () => {
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  el.selectedKey = 'b';
  await el.updateComplete;
  const [firstRow, secondRow] = [...el.shadowRoot!.querySelectorAll('[part="row"]')];
  expect(firstRow.getAttribute('tabindex')).to.equal('-1');
  expect(secondRow.getAttribute('tabindex')).to.equal('0');
});

it('moves the roving tabindex between header cells with ArrowRight/ArrowLeft and Home/End', async () => {
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const [nameHeader, scoreHeader] = [
    ...el.shadowRoot!.querySelectorAll('[part="header-cell"]'),
  ] as HTMLElement[];

  nameHeader.focus();
  nameHeader.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement).to.equal(scoreHeader);
  expect(scoreHeader.getAttribute('tabindex')).to.equal('0');
  expect(nameHeader.getAttribute('tabindex')).to.equal('-1');

  scoreHeader.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement).to.equal(nameHeader);

  nameHeader.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement).to.equal(scoreHeader);

  scoreHeader.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement).to.equal(nameHeader);
});

it('moves the roving tabindex between rows with ArrowDown/ArrowUp, and ArrowUp from the first row returns focus to the header', async () => {
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;
  const [firstRow, secondRow] = [...el.shadowRoot!.querySelectorAll('[part="row"]')] as HTMLElement[];

  firstRow.focus();
  firstRow.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement).to.equal(secondRow);
  expect(secondRow.getAttribute('tabindex')).to.equal('0');
  expect(firstRow.getAttribute('tabindex')).to.equal('-1');

  secondRow.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement).to.equal(firstRow);

  firstRow.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  await el.updateComplete;
  const nameHeader = el.shadowRoot!.querySelector('[part="header-cell"]') as HTMLElement;
  expect(el.shadowRoot!.activeElement).to.equal(nameHeader);
});

it('skips a priority-hidden header cell when navigating with ArrowRight, instead of stranding focus on it', async () => {
  const skipColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', cell: (r) => r.name },
    { key: 'score', label: 'Score', priority: 'low', cell: (r) => r.score },
    { key: 'id', label: 'Id', cell: (r) => r.id },
  ];
  const el = (await fixture(
    html`<lyra-table style="display: block; width: 300px;"></lyra-table>`,
  )) as LyraTable<Row>;
  el.columns = skipColumns;
  el.rows = rows;
  await el.updateComplete;

  const [nameHeader, scoreHeader, idHeader] = [
    ...el.shadowRoot!.querySelectorAll('[part="header-cell"]'),
  ] as HTMLElement[];
  expect(getComputedStyle(scoreHeader).display).to.equal('none');

  nameHeader.focus();
  nameHeader.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement).to.equal(idHeader);
  expect(idHeader.getAttribute('tabindex')).to.equal('0');
});

it('moves focus from the header into the body row with ArrowDown', async () => {
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;
  const nameHeader = el.shadowRoot!.querySelector('[part="header-cell"]') as HTMLElement;
  nameHeader.focus();
  nameHeader.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  await el.updateComplete;
  const firstRow = el.shadowRoot!.querySelector('[part="row"]') as HTMLElement;
  expect(el.shadowRoot!.activeElement).to.equal(firstRow);
});

it('does not trigger row activation or preventDefault when Enter is pressed on a focused button inside a cell()', async () => {
  const actionColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', cell: (r) => r.name },
    {
      key: 'actions',
      label: 'Actions',
      cell: () => html`<button type="button" data-action>Go</button>`,
    },
  ];
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = actionColumns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;

  let rowClicked = false;
  el.addEventListener('lyra-row-click', () => (rowClicked = true));

  const actionButton = el.shadowRoot!.querySelector('[data-action]') as HTMLButtonElement;
  actionButton.focus();
  const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  const notPrevented = actionButton.dispatchEvent(event);

  expect(rowClicked).to.be.false;
  expect(notPrevented).to.be.true;
});
