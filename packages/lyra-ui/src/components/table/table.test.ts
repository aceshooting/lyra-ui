import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './table.js';
import '../select/select.js';
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

const editableColumns: TableColumn<Row>[] = [
  { key: 'name', label: 'Name', editable: true, editValue: (r) => r.name, cell: (r) => r.name },
  { key: 'score', label: 'Score', editable: true, editType: 'number', editValue: (r) => r.score, cell: (r) => r.score },
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

it('opens an editable cell on double-click and emits a typed edit intent', async () => {
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = editableColumns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;

  const cell = el.shadowRoot!.querySelector('[part="row"] [part="cell"]') as HTMLElement;
  cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
  await el.updateComplete;
  const input = cell.querySelector('[part="cell-editor"]') as HTMLInputElement;
  expect(input).to.exist;
  input.value = 'Renamed';
  const eventPromise = oneEvent(el, 'lyra-cell-edit');
  input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  const event = await eventPromise;

  expect(event.detail.key).to.equal('name');
  expect(event.detail.value).to.equal('Renamed');
  expect(event.detail.row).to.deep.equal(rows[0]);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="cell-editor"]')).to.not.exist;
});

it('renders grouped row sections without making group headers focus stops', async () => {
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = [rows[0], rows[1], { id: 'c', name: 'Gamma', score: 2 }];
  el.rowKey = (r) => r.id;
  el.groupBy = (r) => (r.score > 2 ? 'Passing' : 'Needs review');
  await el.updateComplete;

  const groups = [...el.shadowRoot!.querySelectorAll('[part="group-row"]')];
  expect(groups.length).to.equal(2);
  expect(groups[0].textContent).to.contain('Passing');
  expect(groups[1].textContent).to.contain('Needs review');
  expect(groups[0].getAttribute('tabindex')).to.equal(null);
  expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(3);
});

it('filters rows through the built-in filter field and emits the requested text', async () => {
  const el = (await fixture(html`<lyra-table filterable></lyra-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;

  const input = el.shadowRoot!.querySelector('[part="filter"]') as HTMLInputElement;
  const eventPromise = oneEvent(el, 'lyra-filter-change');
  input.value = 'beta';
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  const event = await eventPromise;
  await el.updateComplete;

  expect(event.detail).to.deep.equal({ text: 'beta' });
  expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(1);
  expect(el.shadowRoot!.querySelector('[part="row"]')!.textContent).to.contain('Beta');
});

it('paginates client-side rows and emits controlled page requests', async () => {
  const el = (await fixture(html`<lyra-table page-size="1"></lyra-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(1);
  expect(el.shadowRoot!.querySelector('[part="row"]')!.textContent).to.contain('Alpha');

  const next = el.shadowRoot!.querySelector('lyra-pagination')!.shadowRoot!.querySelector(
    '[part="next-button"]',
  ) as HTMLButtonElement;
  const eventPromise = oneEvent(el, 'lyra-page-change');
  next.click();
  const event = await eventPromise;
  expect(event.detail).to.deep.equal({ page: 2 });
  expect(el.page).to.equal(1);

  el.page = 2;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="row"]')!.textContent).to.contain('Beta');
});

it('renders a localized busy state before rows while loading', async () => {
  const el = (await fixture(html`<lyra-table loading></lyra-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="loading"] lyra-spinner')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-busy')).to.equal('true');
  await expect(el).to.be.accessible();
});

it('supports opt-in multiple row selection without changing the default presentational mode', async () => {
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (row) => row.id;
  el.selectionMode = 'multiple';
  await el.updateComplete;
  const row = el.shadowRoot!.querySelector('[part="row"]') as HTMLElement;
  const eventPromise = oneEvent(el, 'lyra-selection-change');
  row.click();
  const event = await eventPromise;
  expect(event.detail.keys).to.deep.equal(['a']);
  expect(el.selectedKeys.has('a')).to.be.true;
  expect(row.getAttribute('aria-selected')).to.equal('true');
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

it('renders [part="reveal-columns-button"] only when at least one column declares a priority and a priority column is actually hidden', async () => {
  const el = (await fixture(
    html`<lyra-table style="display: block; width: 300px;"></lyra-table>`,
  )) as LyraTable<Row>;
  el.columns = columns; // no priority columns
  el.rows = rows;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="reveal-columns-button"]')).to.not.exist;

  el.columns = priorityColumns;
  await el.updateComplete;
  // columnsHidden is measured from the DOM inside updated(), one render cycle
  // after the columns change lands — wait for that settled state rather than
  // assuming a single updateComplete covers the resulting cascaded update.
  await waitUntil(() => el.shadowRoot!.querySelector('[part="reveal-columns-button"]') !== null);
  expect(el.shadowRoot!.querySelector('[part="reveal-columns-button"]')).to.exist;
});

it('hides low- and medium-priority columns in a narrow container, and reveals them via the toggle button', async () => {
  const el = (await fixture(
    html`<lyra-table style="display: block; width: 300px;"></lyra-table>`,
  )) as LyraTable<Row>;
  el.columns = priorityColumns;
  el.rows = rows;
  await el.updateComplete;
  await waitUntil(() => el.columnsHidden === true);

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
  const el = (await fixture(
    html`<lyra-table style="display: block; width: 300px;"></lyra-table>`,
  )) as LyraTable<Row>;
  el.columns = priorityColumns;
  el.rows = rows;
  await el.updateComplete;
  await waitUntil(() => el.columnsHidden === true);

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
  const el = (await fixture(
    html`<lyra-table style="display: block; width: 300px;"></lyra-table>`,
  )) as LyraTable<Row>;
  el.columns = priorityColumns;
  el.rows = rows;
  el.revealColumnsLabel = 'More columns';
  el.hideColumnsLabel = 'Fewer columns';
  await el.updateComplete;
  await waitUntil(() => el.columnsHidden === true);

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

it('does not render [part="reveal-columns-button"] and keeps columnsHidden false (no event) when a priority column is configured but a wide container never actually hides it', async () => {
  const el = (await fixture(
    html`<lyra-table style="display: block; width: 1000px;"></lyra-table>`,
  )) as LyraTable<Row>;
  const events: unknown[] = [];
  el.addEventListener('lyra-columns-hidden-change', (e) => events.push(e));
  el.columns = priorityColumns;
  el.rows = rows;
  await el.updateComplete;

  const lowHeader = el.shadowRoot!.querySelector('[part="header-cell"][data-priority="low"]') as HTMLElement;
  expect(getComputedStyle(lowHeader).display).to.not.equal('none');
  expect(el.shadowRoot!.querySelector('[part="reveal-columns-button"]')).to.not.exist;
  expect(el.columnsHidden).to.be.false;
  expect(el.hasAttribute('columns-hidden')).to.be.false;
  expect(events).to.deep.equal([]);
});

it('renders [part="reveal-columns-button"], sets columnsHidden=true, and fires lyra-columns-hidden-change once when a priority column is actually hidden by a narrow container', async () => {
  const el = (await fixture(
    html`<lyra-table style="display: block; width: 300px;"></lyra-table>`,
  )) as LyraTable<Row>;
  const events: boolean[] = [];
  el.addEventListener('lyra-columns-hidden-change', (e) => events.push((e as CustomEvent).detail.hidden));
  el.columns = priorityColumns;
  el.rows = rows;
  await el.updateComplete;
  // The real hidden-state is measured (offsetParent) after render, in
  // updated() — self-corrects a frame later than the initial paint, mirroring
  // lite-chart.ts's plotWidth/plotHeight ResizeObserver settle pattern, so
  // poll for the settled state instead of assuming a single updateComplete
  // covers the resulting cascaded update.
  await waitUntil(() => el.columnsHidden === true);

  expect(el.shadowRoot!.querySelector('[part="reveal-columns-button"]')).to.exist;
  expect(el.hasAttribute('columns-hidden')).to.be.true;
  expect(events).to.deep.equal([true]);
});

it('keeps [part="reveal-columns-button"] visible and columnsHidden=true (no extra event) when showAllColumns force-visible mode is toggled on while narrow', async () => {
  const el = (await fixture(
    html`<lyra-table style="display: block; width: 300px;"></lyra-table>`,
  )) as LyraTable<Row>;
  el.columns = priorityColumns;
  el.rows = rows;
  await el.updateComplete;
  await waitUntil(() => el.columnsHidden === true);

  const events: boolean[] = [];
  el.addEventListener('lyra-columns-hidden-change', (e) => events.push((e as CustomEvent).detail.hidden));
  const revealButton = el.shadowRoot!.querySelector('[part="reveal-columns-button"]') as HTMLElement;
  revealButton.click();
  await el.updateComplete;

  const lowHeader = el.shadowRoot!.querySelector('[part="header-cell"][data-priority="low"]') as HTMLElement;
  expect(getComputedStyle(lowHeader).display).to.not.equal('none'); // force-visible actually un-hid it...
  expect(el.shadowRoot!.querySelector('[part="reveal-columns-button"]')).to.exist;
  expect(el.columnsHidden).to.be.true; // ...but columnsHidden stays true (force-visible clause)
  expect(events).to.deep.equal([]); // true -> true is not a real transition
});

it('showAllColumns is a public, reflected property that stays in sync with the reveal button', async () => {
  const el = (await fixture(
    html`<lyra-table style="display: block; width: 300px;"></lyra-table>`,
  )) as LyraTable<Row>;
  el.columns = priorityColumns;
  el.rows = rows;
  await el.updateComplete;
  await waitUntil(() => el.columnsHidden === true);

  expect(el.showAllColumns).to.be.false;
  expect(el.hasAttribute('show-all-columns')).to.be.false;

  const revealButton = el.shadowRoot!.querySelector('[part="reveal-columns-button"]') as HTMLElement;
  revealButton.click();
  await el.updateComplete;
  expect(el.showAllColumns).to.be.true;
  expect(el.hasAttribute('show-all-columns')).to.be.true;

  revealButton.click();
  await el.updateComplete;
  expect(el.showAllColumns).to.be.false;
  expect(el.hasAttribute('show-all-columns')).to.be.false;
});

it('emits lyra-columns-revealed with the new state whenever the reveal button is toggled', async () => {
  const el = (await fixture(
    html`<lyra-table style="display: block; width: 300px;"></lyra-table>`,
  )) as LyraTable<Row>;
  el.columns = priorityColumns;
  el.rows = rows;
  await el.updateComplete;
  await waitUntil(() => el.columnsHidden === true);

  const events: boolean[] = [];
  el.addEventListener('lyra-columns-revealed', (e) => events.push((e as CustomEvent).detail.revealed));
  const revealButton = el.shadowRoot!.querySelector('[part="reveal-columns-button"]') as HTMLElement;
  revealButton.click();
  await el.updateComplete;
  revealButton.click();
  await el.updateComplete;

  expect(events).to.deep.equal([true, false]);
});

it('restores a previously-persisted showAllColumns preference from the initial property/attribute', async () => {
  const el = (await fixture(
    html`<lyra-table style="display: block; width: 300px;" show-all-columns></lyra-table>`,
  )) as LyraTable<Row>;
  el.columns = priorityColumns;
  el.rows = rows;
  await el.updateComplete;

  expect(el.showAllColumns).to.be.true;
  const lowHeader = el.shadowRoot!.querySelector('[part="header-cell"][data-priority="low"]') as HTMLElement;
  expect(getComputedStyle(lowHeader).display).to.not.equal('none');

  await waitUntil(() => el.shadowRoot!.querySelector('[part="reveal-columns-button"]') !== null);
  const revealButton = el.shadowRoot!.querySelector('[part="reveal-columns-button"]') as HTMLElement;
  expect(revealButton.getAttribute('aria-pressed')).to.equal('true');
});

it('never renders [part="reveal-columns-button"] and keeps columnsHidden false regardless of container width when no column declares a priority (regression)', async () => {
  const el = (await fixture(
    html`<lyra-table style="display: block; width: 300px;"></lyra-table>`,
  )) as LyraTable<Row>;
  const events: unknown[] = [];
  el.addEventListener('lyra-columns-hidden-change', (e) => events.push(e));
  el.columns = columns; // no priority columns
  el.rows = rows;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="reveal-columns-button"]')).to.not.exist;
  expect(el.columnsHidden).to.be.false;
  expect(events).to.deep.equal([]);
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

it("normalizes the legacy sticky: true to data-sticky='start' for backward compatibility", async () => {
  const stickyColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', sticky: true, cell: (r) => r.name },
  ];
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = stickyColumns;
  el.rows = rows;
  await el.updateComplete;
  const stickyHeader = el.shadowRoot!.querySelector('[part="header-cell"]') as HTMLElement;
  expect(stickyHeader.getAttribute('data-sticky')).to.equal('start');
});

it("pins a sticky: 'end' column's header and cell to the inline-end edge instead of inline-start", async () => {
  const stickyEndColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', cell: (r) => r.name },
    { key: 'score', label: 'Score', align: 'end', sticky: 'end', cell: (r) => r.score },
  ];
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = stickyEndColumns;
  el.rows = rows;
  await el.updateComplete;

  const stickyHeader = el.shadowRoot!.querySelectorAll('[part="header-cell"]')[1] as HTMLElement;
  const stickyCell = el.shadowRoot!.querySelectorAll('[part="cell"]')[1] as HTMLElement;

  expect(stickyHeader.getAttribute('data-sticky')).to.equal('end');
  expect(getComputedStyle(stickyHeader).position).to.equal('sticky');
  expect(getComputedStyle(stickyCell).insetInlineEnd).to.equal('0px');
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

it('swaps ArrowLeft/ArrowRight header navigation under dir="rtl", matching a native table\'s own mirrored column order', async () => {
  const el = (await fixture(
    html`<lyra-table dir="rtl"></lyra-table>`,
  )) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const [nameHeader, scoreHeader] = [
    ...el.shadowRoot!.querySelectorAll('[part="header-cell"]'),
  ] as HTMLElement[];

  // Under RTL, ArrowRight moves toward the *start* of DOM order (the visual
  // right edge, since the table mirrors columns) -- the opposite of LTR.
  nameHeader.focus();
  nameHeader.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement).to.equal(nameHeader);

  nameHeader.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement).to.equal(scoreHeader);

  scoreHeader.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement).to.equal(nameHeader);
});

it('does not swap ArrowUp/ArrowDown row navigation under dir="rtl" (direction only affects the horizontal column axis)', async () => {
  const el = (await fixture(
    html`<lyra-table dir="rtl"></lyra-table>`,
  )) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;
  const [firstRow, secondRow] = [...el.shadowRoot!.querySelectorAll('[part="row"]')] as HTMLElement[];

  firstRow.focus();
  firstRow.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement).to.equal(secondRow);

  secondRow.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement).to.equal(firstRow);
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

it('offsets a second sticky column past the first instead of overlapping at inset 0', async () => {
  const stickyColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', sticky: true, cell: (r) => r.name },
    { key: 'score', label: 'Score', sticky: true, cell: (r) => r.score },
  ];
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = stickyColumns;
  el.rows = rows;
  await el.updateComplete;
  const cells = el.shadowRoot!.querySelectorAll('[part="header-cell"][data-sticky]');
  const first = getComputedStyle(cells[0]).insetInlineStart;
  const second = getComputedStyle(cells[1]).insetInlineStart;
  expect(first).to.not.equal(second);
});

it('does not treat a custom interactive element inside a cell as a row-activation target', async () => {
  const actionColumns: TableColumn<Row>[] = [
    ...columns,
    { key: 'actions', label: '', cell: () => html`<lyra-select data-testid="cell-select"></lyra-select>` },
  ];
  let rowClicked = false;
  const el = (await fixture(
    html`<lyra-table
      .columns=${actionColumns}
      .rows=${rows}
      @lyra-row-click=${() => (rowClicked = true)}
    ></lyra-table>`,
  )) as LyraTable<Row>;
  await el.updateComplete;
  const select = el.shadowRoot!.querySelector('lyra-select')!;
  select.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  expect(rowClicked).to.be.false;
});

it('keeps a numeric-key row and a string-key row distinct instead of colliding', async () => {
  const mixedRows = [
    { id: 1, name: 'Numeric', email: 'n@example.com' },
    { id: '1', name: 'String', email: 's@example.com' },
  ];
  const mixedColumns: TableColumn<(typeof mixedRows)[number]>[] = [
    { key: 'name', label: 'Name', cell: (r) => r.name },
  ];
  const el = (await fixture(
    html`<lyra-table
      .columns=${mixedColumns}
      .rows=${mixedRows}
      .rowKey=${(r: (typeof mixedRows)[number]) => r.id}
    ></lyra-table>`,
  )) as LyraTable<(typeof mixedRows)[number]>;
  await el.updateComplete;
  const rowEls = el.shadowRoot!.querySelectorAll('[data-row-key]');
  const keys = new Set(Array.from(rowEls).map((r) => r.getAttribute('data-row-key')));
  expect(keys.size).to.equal(2);
});

it('forwards a host aria-label into the shadow-DOM grid element', async () => {
  const el = (await fixture(
    html`<lyra-table aria-label="Scores"></lyra-table>`,
  )) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const grid = el.shadowRoot!.querySelector('[part="table"]') as HTMLElement;
  expect(grid.getAttribute('aria-label')).to.equal('Scores');
});

it('omits aria-label on the shadow-DOM grid element when the host has none', async () => {
  const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const grid = el.shadowRoot!.querySelector('[part="table"]') as HTMLElement;
  expect(grid.hasAttribute('aria-label')).to.be.false;
});

it('does not trigger a Lit "scheduled an update after an update completed" dev warning when a priority column transitions to actually-hidden', async () => {
  // Reset Lit's own dedupe set first so this doesn't silently pass just
  // because an earlier test in this file (or another file in the same
  // browser session) already tripped -- and thus suppressed -- the exact
  // same warning string. Same guard chip-group.test.ts's/toast-item.test.ts's
  // equivalent tests use.
  const globalWarnings = (globalThis as { litIssuedWarnings?: Set<string> }).litIssuedWarnings;
  if (globalWarnings) {
    [...globalWarnings]
      .filter((w) => w.includes('scheduled an update'))
      .forEach((w) => globalWarnings.delete(w));
  }

  const originalWarn = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => calls.push(args);
  try {
    const el = (await fixture(
      html`<lyra-table style="display: block; width: 300px;"></lyra-table>`,
    )) as LyraTable<Row>;
    el.columns = priorityColumns;
    el.rows = rows;
    await el.updateComplete;
    // recomputeColumnsHidden() runs a frame after the initial paint (see the
    // sibling columnsHidden tests above) -- wait for the settled state so the
    // synchronous-mutation-inside-updated() warning (if any) has had a chance
    // to fire before asserting on it.
    await waitUntil(() => el.columnsHidden === true);
  } finally {
    console.warn = originalWarn;
  }

  const messages = calls.flat().map(String);
  expect(messages.some((m) => m.includes('scheduled an update'))).to.be.false;
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

describe('footer column hook', () => {
  it('renders a real tfoot when any column has a footer hook', async () => {
    const withFooter: TableColumn<Row>[] = [
      ...columns,
      { key: 'total', label: 'Total', footer: (rs) => rs.reduce((sum, r) => sum + r.score, 0), cell: () => '' },
    ];
    const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
    el.columns = withFooter;
    el.rows = rows;
    await el.updateComplete;
    const foot = el.shadowRoot!.querySelector('tfoot[part="foot"]');
    expect(foot).to.exist;
    const footerCells = [...foot!.querySelectorAll('[part="footer-cell"]')];
    expect(footerCells).to.have.length(withFooter.length);
    expect(footerCells[footerCells.length - 1]!.textContent!.trim()).to.equal('4');
  });

  it('renders no tfoot when no column has a footer hook (unchanged default)', async () => {
    const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('tfoot')).to.not.exist;
  });
});

describe('cellStyle column hook', () => {
  it('applies cellStyle to the generated td via styleMap', async () => {
    const withStyle: TableColumn<Row>[] = [
      { key: 'name', label: 'Name', cell: (r) => r.name, cellStyle: (r) => ({ background: r.score > 2 ? 'red' : 'blue' }) },
    ];
    const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
    el.columns = withStyle;
    el.rows = rows;
    await el.updateComplete;
    const cells = [...el.shadowRoot!.querySelectorAll('[part="cell"]')] as HTMLElement[];
    expect(cells[0]!.style.background).to.equal('red'); // Alpha, score 3
    expect(cells[1]!.style.background).to.equal('blue'); // Beta, score 1
  });

  it('coexists with sticky-column offset styling without clobbering it', async () => {
    const withBoth: TableColumn<Row>[] = [
      { key: 'name', label: 'Name', sticky: true, cellStyle: () => ({ background: 'green' }), cell: (r) => r.name },
    ];
    const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
    el.columns = withBoth;
    el.rows = rows;
    await el.updateComplete;
    const cell = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
    expect(cell.style.background).to.equal('green');
    expect(cell.style.getPropertyValue('--lyra-table-sticky-offset')).to.not.equal('');
  });
});

describe('headerCell', () => {
  it('renders col.label by default when headerCell is unset', async () => {
    const columns: TableColumn<{ id: number }>[] = [{ key: 'id', label: 'ID', cell: (row) => row.id }];
    const el = (await fixture(html`<lyra-table .columns=${columns} .rows=${[{ id: 1 }]}></lyra-table>`)) as LyraTable;
    const th = el.shadowRoot!.querySelector('th[data-col-key="id"]')!;
    expect(th.textContent).to.contain('ID');
  });

  it('renders headerCell(column) instead of the plain label when set', async () => {
    const columns: TableColumn<{ id: number }>[] = [
      {
        key: 'id',
        label: 'ID',
        headerCell: (col) => html`<strong class="custom">${col.label}!</strong>`,
        cell: (row) => row.id,
      },
    ];
    const el = (await fixture(html`<lyra-table .columns=${columns} .rows=${[{ id: 1 }]}></lyra-table>`)) as LyraTable;
    const th = el.shadowRoot!.querySelector('th[data-col-key="id"]')!;
    expect(th.querySelector('.custom')).to.exist;
    expect(th.textContent).to.contain('ID!');
  });
});

describe('column width', () => {
  it('does not set table-layout: fixed when no column defines width', async () => {
    const columns: TableColumn<{ id: number }>[] = [{ key: 'id', label: 'ID', cell: (row) => row.id }];
    const el = (await fixture(html`<lyra-table .columns=${columns} .rows=${[{ id: 1 }]}></lyra-table>`)) as LyraTable;
    const table = el.shadowRoot!.querySelector('[part="table"]') as HTMLElement;
    expect(getComputedStyle(table).tableLayout).to.equal('auto');
  });

  it('sets table-layout: fixed and applies <col> widths when a column defines width', async () => {
    const columns: TableColumn<{ id: number }>[] = [
      { key: 'id', label: 'ID', width: '120px', cell: (row) => row.id },
      { key: 'name', label: 'Name', cell: () => 'x' },
    ];
    const el = (await fixture(html`<lyra-table .columns=${columns} .rows=${[{ id: 1 }]}></lyra-table>`)) as LyraTable;
    const table = el.shadowRoot!.querySelector('[part="table"]') as HTMLElement;
    expect(getComputedStyle(table).tableLayout).to.equal('fixed');
    const cols = el.shadowRoot!.querySelectorAll('colgroup col');
    expect(cols).to.have.lengthOf(2);
    expect((cols[0] as HTMLElement).style.getPropertyValue('inline-size')).to.equal('120px');
  });
});

describe('expandable rows', () => {
  it('exposes expandedKeys defaulting to an empty Set', async () => {
    const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
    expect(el.expandedKeys).to.be.instanceOf(Set);
    expect(el.expandedKeys.size).to.equal(0);
  });

  const expandableColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', cell: (r) => r.name },
    { key: 'score', label: 'Score', align: 'end', cell: (r) => r.score },
  ];

  it('renders no leading toggle cell when expandedContent is unset (unchanged default)', async () => {
    const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
    el.columns = expandableColumns;
    el.rows = rows;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="expand-toggle-cell"]')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[data-row-expand-toggle]')).to.not.exist;
  });

  it('renders a leading toggle cell on the header and every row when expandedContent is set', async () => {
    const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
    el.columns = expandableColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.expandedContent = (r) => html`<p>${r.name} details</p>`;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-row-expand-toggle]')).to.exist;
    const toggleCells = el.shadowRoot!.querySelectorAll('[part="expand-toggle-cell"]');
    expect(toggleCells.length).to.equal(rows.length);
    expect(toggleCells[0].querySelector('button')).to.exist;
  });

  it('renders an empty, non-interactive toggle cell for a row that fails canExpand', async () => {
    const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
    el.columns = expandableColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.expandedContent = (r) => html`<p>${r.name} details</p>`;
    el.canExpand = (r) => r.id !== 'a';
    await el.updateComplete;
    const toggleCells = [...el.shadowRoot!.querySelectorAll('[part="expand-toggle-cell"]')];
    expect(toggleCells[0].querySelector('button')).to.not.exist; // row 'a' (Alpha) opted out
    expect(toggleCells[1].querySelector('button')).to.exist; // row 'b' (Beta)
  });

  it('emits lyra-row-expand-toggle with { row, key } when the chevron button is clicked, and does not also emit lyra-row-click', async () => {
    const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
    el.columns = expandableColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.expandedContent = (r) => html`<p>${r.name} details</p>`;
    await el.updateComplete;

    let rowClicked = false;
    el.addEventListener('lyra-row-click', () => (rowClicked = true));

    const firstToggleButton = el.shadowRoot!.querySelector('[part="expand-toggle-cell"] button') as HTMLButtonElement;
    setTimeout(() => firstToggleButton.click());
    const ev = await oneEvent(el, 'lyra-row-expand-toggle');
    expect(ev.detail.row).to.deep.equal(rows[0]);
    expect(ev.detail.key).to.equal('a');
    expect(rowClicked).to.be.false;
  });

  it('still emits lyra-row-click when clicking elsewhere in an expandable row', async () => {
    const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
    el.columns = expandableColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.expandedContent = (r) => html`<p>${r.name} details</p>`;
    await el.updateComplete;

    let toggleFired = false;
    el.addEventListener('lyra-row-expand-toggle', () => (toggleFired = true));

    const nameCell = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
    setTimeout(() => nameCell.click());
    const ev = await oneEvent(el, 'lyra-row-click');
    expect(ev.detail.row).to.deep.equal(rows[0]);
    expect(toggleFired).to.be.false;
  });

  it('renders the expanded panel row with the correct colspan when a row key is in expandedKeys', async () => {
    const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
    el.columns = expandableColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.expandedContent = (r) => html`<p class="panel">${r.name} details</p>`;
    el.expandedKeys = new Set(['a']);
    await el.updateComplete;

    const expandedRow = el.shadowRoot!.querySelector('[part="expanded-row"]');
    expect(expandedRow).to.exist;
    const expandedCell = expandedRow!.querySelector('[part="expanded-cell"]') as HTMLElement;
    expect(expandedCell.getAttribute('colspan')).to.equal('3'); // 2 columns + 1 toggle column
    expect(expandedCell.querySelector('.panel')!.textContent).to.equal('Alpha details');

    // Only one row is in expandedKeys — only one expanded-row renders.
    expect(el.shadowRoot!.querySelectorAll('[part="expanded-row"]').length).to.equal(1);
  });

  it('removes the expanded panel row when its key is removed from expandedKeys', async () => {
    const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
    el.columns = expandableColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.expandedContent = (r) => html`<p>${r.name} details</p>`;
    el.expandedKeys = new Set(['a']);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="expanded-row"]')).to.exist;

    el.expandedKeys = new Set();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="expanded-row"]')).to.not.exist;
  });

  it('does not render an expanded panel row for a row that fails canExpand, even if its key is in expandedKeys', async () => {
    const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
    el.columns = expandableColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.expandedContent = (r) => html`<p>${r.name} details</p>`;
    el.canExpand = (r) => r.id !== 'a';
    el.expandedKeys = new Set(['a', 'b']);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="expanded-row"]').length).to.equal(1); // only 'b'
  });

  it('activates the chevron toggle via native button keydown (Enter) without triggering row activation or preventDefault', async () => {
    const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
    el.columns = expandableColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.expandedContent = (r) => html`<p>${r.name} details</p>`;
    await el.updateComplete;

    let rowClicked = false;
    el.addEventListener('lyra-row-click', () => (rowClicked = true));

    const toggleButton = el.shadowRoot!.querySelector('[part="row-expand-toggle"]') as HTMLButtonElement;
    toggleButton.focus();
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    const notPrevented = toggleButton.dispatchEvent(event);

    expect(rowClicked).to.be.false;
    expect(notPrevented).to.be.true;
  });

  it('is accessible with expandedContent and an open row', async () => {
    const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
    el.columns = expandableColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.expandedContent = (r) => html`<p>${r.name} details</p>`;
    el.expandedKeys = new Set(['a']);
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it('grows a matching leading spacer cell in the footer row when combined with a footer column, keeping real footer cells aligned', async () => {
    const withFooter: TableColumn<Row>[] = [
      ...expandableColumns,
      { key: 'total', label: 'Total', footer: (rs) => rs.reduce((sum, r) => sum + r.score, 0), cell: () => '' },
    ];
    const el = (await fixture(html`<lyra-table></lyra-table>`)) as LyraTable<Row>;
    el.columns = withFooter;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.expandedContent = (r) => html`<p>${r.name} details</p>`;
    await el.updateComplete;

    const foot = el.shadowRoot!.querySelector('tfoot[part="foot"]');
    expect(foot).to.exist;
    const footerCells = [...foot!.querySelectorAll('[part="footer-cell"]')] as HTMLElement[];
    // 3 real columns + 1 leading spacer cell for the expand-toggle column.
    expect(footerCells).to.have.length(withFooter.length + 1);

    const spacerCell = footerCells[0]!;
    expect(spacerCell.hasAttribute('data-col-key')).to.be.false;
    expect(spacerCell.getAttribute('aria-hidden')).to.equal('true');
    expect(spacerCell.textContent!.trim()).to.equal('');

    // The real footer cells still line up with their own columns -- not
    // shifted left into the spacer's place.
    expect(footerCells[footerCells.length - 1]!.textContent!.trim()).to.equal('4');
  });
});
