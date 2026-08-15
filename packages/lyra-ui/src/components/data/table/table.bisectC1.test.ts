import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './table.js';
import '../../forms/select/select.js';
import type { LyraTable, TableColumn } from './table.js';
import { styles } from './table.styles.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { setForcedColors } from '../../../../test/wtr-media.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';

class TableOpaqueControlElement extends HTMLElement {
  private readonly control: HTMLButtonElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'closed' });
    this.control = document.createElement('button');
    this.control.type = 'button';
    root.append(this.control);
  }

  connectedCallback(): void {
    this.control.textContent = this.textContent ?? '';
  }

  activate(): void {
    this.control.click();
  }
}

if (!customElements.get('table-opaque-control')) {
  customElements.define('table-opaque-control', TableOpaqueControlElement);
}

function sinkElement(doc: Document = document): HTMLElement | null {
  return doc.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`);
}

function sinkTexts(doc: Document = document): string[] {
  const sink = sinkElement(doc);
  return sink ? Array.from(sink.children, (child) => child.textContent ?? '') : [];
}

interface Row {
  id: string;
  name: string;
  score: number;
}

const columns: TableColumn<Row>[] = [
  { key: 'name', label: 'Name', sortable: true, cell: (r) => r.name },
  {
    key: 'score',
    label: 'Score',
    sortable: true,
    align: 'end',
    cell: (r) => r.score,
  },
];

const editableColumns: TableColumn<Row>[] = [
  {
    key: 'name',
    label: 'Name',
    editTrigger: 'double-click',
    editValue: (r) => r.name,
    cell: (r) => r.name,
  },
  {
    key: 'score',
    label: 'Score',
    editTrigger: 'double-click',
    editType: 'number',
    editValue: (r) => r.score,
    cell: (r) => r.score,
  },
];
const rows: Row[] = [
  { id: 'a', name: 'Alpha', score: 3 },
  { id: 'b', name: 'Beta', score: 1 },
];

// Most fixtures in this file render a bare <lr-table> with no accessibleLabel /
// caption / host aria-label, which trips firstUpdated()'s intentional
// "no accessible name" dev warning. Under CI's WTR_STRICT_CONSOLE guard an
// unexpected console.warn is thrown as a test failure, so swallow *only* that
// one expected message here while still re-throwing every other warning
// (delegating to whatever console.warn the harness installed). The dedicated
// "accessible name" describe block below installs its own console.warn stub in
// a nested beforeEach, so its assertions on the warning are unaffected.
let previousWarn: typeof console.warn;
beforeEach(() => {
  previousWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('no accessible name')) return;
    return previousWarn(...args);
  };
});
afterEach(() => {
  console.warn = previousWarn;
});

it('supports Home/End row navigation and ignores unknown keyboard commands', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;
  const [firstRow, secondRow] = [...el.shadowRoot!.querySelectorAll('[part="row"]')] as HTMLElement[];

  secondRow.focus();
  secondRow.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement?.getAttribute('data-row-key')).to.equal(firstRow.dataset.rowKey);

  firstRow.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement?.getAttribute('data-row-key')).to.equal(secondRow.dataset.rowKey);

  const before = el.shadowRoot!.activeElement?.getAttribute('data-row-key');
  secondRow.dispatchEvent(new KeyboardEvent('keydown', { key: 'Unrelated', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement?.getAttribute('data-row-key')).to.equal(before);
});

it('ignores unknown keyboard commands on a header', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const header = el.shadowRoot!.querySelector('[part="header-cell"]') as HTMLElement;
  header.focus();
  header.dispatchEvent(new KeyboardEvent('keydown', { key: 'Unrelated', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement?.getAttribute('data-col-key')).to.equal(header.dataset.colKey);
});

it('skips a priority-hidden header cell when navigating with ArrowRight, instead of stranding focus on it', async () => {
  const skipColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', cell: (r) => r.name },
    { key: 'score', label: 'Score', priority: 'low', cell: (r) => r.score },
    { key: 'id', label: 'Id', cell: (r) => r.id },
  ];
  const el = (await fixture(html`<lr-table style="display: block; width: 300px;"></lr-table>`)) as LyraTable<Row>;
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
  expect(el.shadowRoot!.activeElement === idHeader).to.equal(true);
  expect(idHeader.getAttribute('tabindex')).to.equal('0');
});

it('rehomes the active column through the public reveal-columns state when a priority header hides in RTL', async () => {
  const priorityColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', cell: (r) => r.name },
    { key: 'score', label: 'Score', priority: 'low', cell: (r) => r.score },
  ];
  const wrapper = (await fixture(html`
    <div dir="rtl">
      <lr-table accessible-label="Scores" priority-columns-visible style="display:block;width:300px"></lr-table>
    </div>
  `)) as HTMLElement;
  const el = wrapper.querySelector('lr-table') as LyraTable<Row>;
  el.columns = priorityColumns;
  el.rows = rows;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('[part="reveal-columns-button"]') !== null);
  const [nameHeader, scoreHeader] = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="header-cell"]'),
  ];
  expect(getComputedStyle(scoreHeader!).display).to.not.equal('none');

  nameHeader!.focus();
  const toScore = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true });
  nameHeader!.dispatchEvent(toScore);
  await el.updateComplete;
  expect(toScore.defaultPrevented).to.be.true;
  expect(el.shadowRoot!.activeElement === scoreHeader).to.be.true;

  (el.shadowRoot!.querySelector('[part="reveal-columns-button"]') as HTMLButtonElement).click();
  await waitUntil(() =>
    getComputedStyle(scoreHeader!).display === 'none' && nameHeader!.getAttribute('tabindex') === '0'
  );

  expect(scoreHeader!.getAttribute('tabindex')).to.equal('-1');
});

it('stops observing removed sticky headers when sticky columns are replaced', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = [
    { key: 'name', label: 'Name', sticky: 'start', cell: (r) => r.name },
    { key: 'score', label: 'Score', sticky: 'start', cell: (r) => r.score },
  ];
  el.rows = rows;
  await el.updateComplete;
  el.columns = columns;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('th[data-col-key]').length).to.equal(2);
});

it('moves focus from the header into the body row with ArrowDown', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;
  const nameHeader = el.shadowRoot!.querySelector('[part="header-cell"]') as HTMLElement;
  nameHeader.focus();
  nameHeader.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  await el.updateComplete;
  const firstRow = el.shadowRoot!.querySelector('[part="row"]') as HTMLElement;
  expect(el.shadowRoot!.activeElement === firstRow).to.equal(true);
});

it('offsets a second sticky column past the first instead of overlapping at inset 0', async () => {
  const stickyColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', sticky: 'start', cell: (r) => r.name },
    { key: 'score', label: 'Score', sticky: 'start', cell: (r) => r.score },
  ];
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
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
    {
      key: 'actions',
      label: '',
      cell: () => html`<lr-select data-testid="cell-select"></lr-select>`,
    },
  ];
  let rowClicked = false;
  const el = (await fixture(
    html`<lr-table .columns=${actionColumns} .rows=${rows} @lr-row-click=${() => (rowClicked = true)}></lr-table>`
  )) as LyraTable<Row>;
  await el.updateComplete;
  const select = el.shadowRoot!.querySelector('lr-select')!;
  const trigger = select.shadowRoot!.querySelector('[part~="trigger"]') as HTMLButtonElement;
  trigger.click();
  expect(rowClicked).to.be.false;
});

it('leaves role- and tabindex-declared cell actions to their semantic owners', async () => {
  const semanticColumns: TableColumn<Row>[] = [
    { key: 'role', label: 'Role action', cell: () => html`<span role="button">Role action</span>` },
    { key: 'tab', label: 'Tab action', cell: () => html`<span tabindex="0">Tab action</span>` },
  ];
  const el = (await fixture(
    html`<lr-table .columns=${semanticColumns} .rows=${rows.slice(0, 1)}></lr-table>`
  )) as LyraTable<Row>;
  let activated = 0;
  el.addEventListener('lr-row-click', () => activated++);

  for (const action of el.shadowRoot!.querySelectorAll<HTMLElement>(
    'tbody td [role="button"], tbody td [tabindex="0"]'
  )) {
    action.click();
  }

  expect(activated).to.equal(0);
});

it('keeps passive custom-element content inside the row activation surface', async () => {
  const passiveColumns: TableColumn<Row>[] = [
    {
      key: 'name',
      label: 'Name',
      cell: (row) => html`<table-passive-label>${row.name}</table-passive-label>`,
    },
  ];
  const el = (await fixture(
    html`<lr-table .columns=${passiveColumns} .rows=${rows} .rowKey=${(row: Row) => row.id}></lr-table>`
  )) as LyraTable<Row>;
  let activated = 0;
  el.addEventListener('lr-row-click', () => activated++);

  (el.shadowRoot!.querySelector('table-passive-label') as HTMLElement).click();

  expect(activated).to.equal(1);
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
  el.addEventListener('lr-row-click', () => activated++);

  (el.shadowRoot!.querySelector('table-opaque-control') as TableOpaqueControlElement).activate();

  expect(activated).to.equal(0);
});

it('keeps a numeric-key row and a string-key row distinct instead of colliding', async () => {
  const mixedRows = [
    { id: 1, name: 'Numeric', email: 'n@example.com' },
    { id: '1', name: 'String', email: 's@example.com' },
  ];
  const mixedColumns: TableColumn<(typeof mixedRows)[number]>[] = [{ key: 'name', label: 'Name', cell: (r) => r.name }];
  const el = (await fixture(
    html`<lr-table
      .columns=${mixedColumns}
      .rows=${mixedRows}
      .rowKey=${(r: (typeof mixedRows)[number]) => r.id}
    ></lr-table>`
  )) as LyraTable<(typeof mixedRows)[number]>;
  await el.updateComplete;
  const rowEls = el.shadowRoot!.querySelectorAll('[data-row-key]');
  const keys = new Set(Array.from(rowEls).map((r) => r.getAttribute('data-row-key')));
  expect(keys.size).to.equal(2);
});

it('forwards a host aria-label into the shadow-DOM grid element', async () => {
  const el = (await fixture(html`<lr-table aria-label="Scores"></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const grid = el.shadowRoot!.querySelector('[part="table"]') as HTMLElement;
  expect(grid.getAttribute('aria-label')).to.equal('Scores');
});

it('preserves an explicitly empty host aria-label on the grid and restores caption naming after removal', async () => {
  const el = (await fixture(
    html`<lr-table aria-label="Author grid" caption="Quarterly results"></lr-table>`,
  )) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const grid = el.shadowRoot!.querySelector<HTMLElement>('[part="table"]')!;
  const caption = el.shadowRoot!.querySelector<HTMLElement>('[part="caption"]')!;
  expect(grid.getAttribute('aria-label')).to.equal('Author grid');
  expect(grid.hasAttribute('aria-labelledby')).to.be.false;

  el.setAttribute('aria-label', '');
  await el.updateComplete;
  expect(grid.getAttribute('aria-label')).to.equal('');
  expect(grid.hasAttribute('aria-labelledby')).to.be.false;

  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(grid.hasAttribute('aria-label')).to.be.false;
  expect(grid.getAttribute('aria-labelledby')).to.equal(caption.id);
});

it('omits aria-label on the shadow-DOM grid element when the host has none', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const grid = el.shadowRoot!.querySelector('[part="table"]') as HTMLElement;
  expect(grid.hasAttribute('aria-label')).to.be.false;
});

describe('accessible name (accessibleLabel / caption / dev warning)', () => {
  let originalWarn: typeof console.warn;
  let warnings: unknown[][];
  let originalProcess: unknown;
  beforeEach(() => {
    originalWarn = console.warn;
    warnings = [];
    console.warn = (...args: unknown[]) => warnings.push(args);
    const runtime = globalThis as typeof globalThis & { process?: unknown };
    originalProcess = runtime.process;
    runtime.process = { env: { NODE_ENV: 'development' } };
  });
  afterEach(() => {
    console.warn = originalWarn;
    const runtime = globalThis as typeof globalThis & { process?: unknown };
    if (originalProcess === undefined) delete runtime.process;
    else runtime.process = originalProcess;
  });

  it('names the grid from accessibleLabel and does not warn', async () => {
    const el = (await fixture(html`<lr-table accessible-label="Match scores"></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    await el.updateComplete;
    const grid = el.shadowRoot!.querySelector('[part="table"]') as HTMLElement;
    expect(grid.getAttribute('aria-label')).to.equal('Match scores');
    expect(warnings.length).to.equal(0);
  });

  it('renders a caption and points the grid at it via aria-labelledby when no other name exists', async () => {
    // Set at construction so the caption is present on the first render (firstUpdated's warning
    // check runs then); a property assigned after fixture() would arrive too late.
    const el = (await fixture(html`<lr-table caption="Quarterly results"></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    await el.updateComplete;
    const grid = el.shadowRoot!.querySelector('[part="table"]') as HTMLElement;
    const cap = el.shadowRoot!.querySelector('[part="caption"]') as HTMLElement;
    expect(cap != null).to.equal(true);
    expect(cap.textContent).to.equal('Quarterly results');
    expect(grid.getAttribute('aria-labelledby')).to.equal(cap.id);
    expect(warnings.length).to.equal(0);
  });

  it('warns exactly once when the grid has no accessible name', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    await el.updateComplete;
    // Force additional renders — the warning must not repeat.
    el.rows = [...rows];
    await el.updateComplete;
    expect(warnings.length).to.equal(1);
    expect(String(warnings[0]![0])).to.include('no accessible name');
  });

  it('does not warn in a production runtime', async () => {
    (globalThis as typeof globalThis & { process?: unknown }).process = {
      env: { NODE_ENV: 'production' },
    };
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    await el.updateComplete;
    expect(warnings.length).to.equal(0);
  });

  it('prefers accessibleLabel over caption for the name (no aria-labelledby)', async () => {
    const el = (await fixture(html`<lr-table accessible-label="Primary"></lr-table>`)) as LyraTable<Row>;
    el.caption = 'Secondary';
    el.columns = columns;
    el.rows = rows;
    await el.updateComplete;
    const grid = el.shadowRoot!.querySelector('[part="table"]') as HTMLElement;
    expect(grid.getAttribute('aria-label')).to.equal('Primary');
    expect(grid.hasAttribute('aria-labelledby')).to.be.false;
  });
});

it('does not trigger a Lit "scheduled an update after an update completed" dev warning when a priority column transitions to actually-hidden', async () => {
  // Reset Lit's own dedupe set first so this doesn't silently pass just
  // because an earlier test in this file (or another file in the same
  // browser session) already tripped -- and thus suppressed -- the exact
  // same warning string. Same guard chip-group.test.ts's/toast-item.test.ts's
  // equivalent tests use.
  const globalWarnings = (globalThis as { litIssuedWarnings?: Set<string> }).litIssuedWarnings;
  if (globalWarnings) {
    [...globalWarnings].filter((w) => w.includes('scheduled an update')).forEach((w) => globalWarnings.delete(w));
  }

  const originalWarn = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => calls.push(args);
  try {
    const el = (await fixture(html`<lr-table style="display: block; width: 300px;"></lr-table>`)) as LyraTable<Row>;
    el.columns = priorityColumns;
    el.rows = rows;
    await el.updateComplete;
    // recomputeColumnsHidden() runs a frame after the initial paint (see the
    // sibling hidden-priority tests above) -- wait for the settled state so the
    // synchronous-mutation-inside-updated() warning (if any) has had a chance
    // to fire before asserting on it.
    await waitUntil(() => el.hasHiddenPriorityColumns === true);
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
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = actionColumns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;

  let rowClicked = false;
  el.addEventListener('lr-row-click', () => (rowClicked = true));

  const actionButton = el.shadowRoot!.querySelector('[data-action]') as HTMLButtonElement;
  actionButton.focus();
  const event = new KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    cancelable: true,
  });
  const notPrevented = actionButton.dispatchEvent(event);

  expect(rowClicked).to.be.false;
  expect(notPrevented).to.be.true;
});

