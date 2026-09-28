import { expectDeprecatedUsage } from '../../../../test/expected-deprecations.js';
import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './table.js';
import '../../forms/select/select.js';
import type { LyraTable, TableColumn } from './table.js';
// Registers the real shipped `ar` catalog's `data` slice so the `lang="ar-EG"` resize-value
// test below (which only overrides `resizeValuePixels`) can render without tripping the
// dev-mode locale-fallback warning that strict-console platform lanes treat as fatal.
import '../../../translations/ar/data.js';
import { installTableTestHooks, TableOpenShellElement, sinkElement, sinkTexts, type Row, columns, editableColumns, rows, forcedWidthHeaderCell, priorityColumns } from '../../../../test/table.js';
installTableTestHooks();


expectDeprecatedUsage('lr-table', 'attribute', 'accessible-label');
expectDeprecatedUsage('lr-table', 'property', 'accessibleLabel');


it('renders grouped row sections without making group headers focus stops', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = [rows[0]!, rows[1]!, { id: 'c', name: 'Gamma', score: 2 }];
  el.rowKey = (r) => r.id;
  el.groupBy = (r) => (r.score > 2 ? 'Passing' : 'Needs review');
  await el.updateComplete;

  const groups = [...el.shadowRoot!.querySelectorAll('[part="group-row"]')];
  expect(groups.length).to.equal(2);
  expect(groups[0]!.textContent).to.contain('Passing');
  expect(groups[1]!.textContent).to.contain('Needs review');
  expect(groups[0]!.getAttribute('tabindex')).to.equal(null);
  expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(3);
});

it('announces a post-mount loading transition even while columns are still unresolved', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;

  el.loading = true;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelectorAll('[part="loading"] lr-spinner').length).to.equal(1);
  expect(sinkTexts()).to.deep.equal(['Loading rows']);
});

it('announces each post-mount loading transition as a separate light-DOM addition', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;

  for (let i = 0; i < 2; i++) {
    el.loading = true;
    await el.updateComplete;
    const loading = el.shadowRoot!.querySelector('[part="loading"]') as HTMLElement;
    expect(loading.getAttribute('aria-hidden')).to.equal('true');
    expect(loading.getAttribute('role')).to.equal(null);
    expect(loading.getAttribute('aria-live')).to.equal(null);
    el.loading = false;
    await el.updateComplete;
  }
  expect(sinkTexts()).to.deep.equal(['Loading rows', 'Loading rows']);
});

it('re-targets loading announcements after adoption into another document', async () => {
  // Render the spinner before adoption. Constructed stylesheets cannot be shared into a second
  // document when a nested Lit element creates its shadow root there, so this fixture deliberately
  // tests the table's sink lifecycle without manufacturing a new nested spinner inside the frame.
  const el = (await fixture(html`<lr-table loading></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const frameDocument = iframe.contentDocument!;
  try {
    frameDocument.body.append(el);
    await el.updateComplete;
    expect(sinkElement() === null, 'the original document must release the adopted table').to.be.true;
    expect(sinkElement(frameDocument)?.getAttribute('aria-live')).to.equal('polite');
    expect(sinkTexts(frameDocument), 'adoption must not announce an already-active loading state').to.deep.equal([]);
  } finally {
    el.remove();
    iframe.remove();
  }
});

it('emits lr-row-activate with the row data', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const row = el.shadowRoot!.querySelector('[part="row"]') as HTMLElement;
  setTimeout(() => row.click());
  const ev = await oneEvent(el, 'lr-row-activate');
  expect(ev.detail.row).to.deep.equal(rows[0]);
});

it('does not emit lr-row-activate and does not swallow the click when a button inside a cell() is clicked', async () => {
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
  el.addEventListener('lr-row-activate', () => (rowClicked = true));

  let buttonClicked = false;
  const actionButton = el.shadowRoot!.querySelector('[data-action]') as HTMLButtonElement;
  actionButton.addEventListener('click', () => (buttonClicked = true));
  actionButton.click();
  await el.updateComplete;

  expect(buttonClicked).to.be.true;
  expect(rowClicked).to.be.false;
});

it('emits lr-row-activate via keydown (Enter and Space) on a focused row', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;
  const row = el.shadowRoot!.querySelector('[part="row"]') as HTMLElement;

  setTimeout(() => row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  let ev = await oneEvent(el, 'lr-row-activate');
  expect(ev.detail.row).to.deep.equal(rows[0]);

  setTimeout(() => row.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })));
  ev = await oneEvent(el, 'lr-row-activate');
  expect(ev.detail.row).to.deep.equal(rows[0]);
});

it('keeps focus in the grid when controlled rows shrink past the focused row', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (row) => row.id;
  await el.updateComplete;

  const renderedRows = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="row"]')];
  renderedRows[1]!.focus();
  el.rows = [rows[0]!];
  await el.updateComplete;

  expect(el.shadowRoot!.activeElement?.getAttribute('data-row-key')).to.equal('string:a');
  expect(el.shadowRoot!.activeElement?.getAttribute('tabindex')).to.equal('0');
});

it('keeps focus in the grid when controlled columns shrink past the focused header', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;

  const headers = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="header-cell"]')];
  headers[1]!.focus();
  el.columns = [columns[0]!];
  await el.updateComplete;

  expect(el.shadowRoot!.activeElement?.getAttribute('data-col-key')).to.equal('name');
  expect(el.shadowRoot!.activeElement?.getAttribute('tabindex')).to.equal('0');
});

it('does not restore controlled-collection focus after the user moves focus outside the table', async () => {
  const wrapper = await fixture(html`
    <div>
      <button id="outside" type="button">Outside</button>
      <lr-table></lr-table>
    </div>
  `);
  const el = wrapper.querySelector('lr-table') as LyraTable<Row>;
  const outside = wrapper.querySelector<HTMLButtonElement>('#outside')!;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (row) => row.id;
  await el.updateComplete;

  const renderedRows = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="row"]')];
  renderedRows[1]!.focus();
  el.rows = [rows[0]!];
  outside.focus();
  await el.updateComplete;

  expect(el.ownerDocument.activeElement?.id).to.equal('outside');
});

it('swaps ArrowLeft/ArrowRight header navigation under dir="rtl", matching a native table\'s own mirrored column order', async () => {
  const el = (await fixture(html`<lr-table dir="rtl"></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const [nameHeader, scoreHeader] = [...el.shadowRoot!.querySelectorAll('[part="header-cell"]')] as [HTMLElement, HTMLElement];

  // Under RTL, ArrowRight moves toward the *start* of DOM order (the visual
  // right edge, since the table mirrors columns) -- the opposite of LTR.
  nameHeader.focus();
  nameHeader.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement === nameHeader).to.equal(true);

  nameHeader.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement === scoreHeader).to.equal(true);

  scoreHeader.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement === nameHeader).to.equal(true);
});

it('does not swap ArrowUp/ArrowDown row navigation under dir="rtl" (direction only affects the horizontal column axis)', async () => {
  const el = (await fixture(html`<lr-table dir="rtl"></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;
  const [firstRow, secondRow] = [...el.shadowRoot!.querySelectorAll('[part="row"]')] as [HTMLElement, HTMLElement];

  firstRow.focus();
  firstRow.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement === secondRow).to.equal(true);

  secondRow.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement === firstRow).to.equal(true);
});

it('moves the roving tabindex between rows with ArrowDown/ArrowUp, and ArrowUp from the first row returns focus to the header', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;
  const [firstRow, secondRow] = [...el.shadowRoot!.querySelectorAll('[part="row"]')] as [HTMLElement, HTMLElement];

  firstRow.focus();
  firstRow.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement === secondRow).to.equal(true);
  expect(secondRow.getAttribute('tabindex')).to.equal('0');
  expect(firstRow.getAttribute('tabindex')).to.equal('-1');

  secondRow.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement === firstRow).to.equal(true);

  firstRow.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  await el.updateComplete;
  const nameHeader = el.shadowRoot!.querySelector('[part="header-cell"]') as HTMLElement;
  expect(el.shadowRoot!.activeElement === nameHeader).to.equal(true);
});

it('skips a priority-hidden header cell when navigating with ArrowRight, instead of stranding focus on it', async () => {
  const skipColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', cell: (r) => r.name },
    { key: 'score', label: 'Score', priority: 'low', headerCell: forcedWidthHeaderCell(350, 'Score'), cell: (r) => r.score },
    { key: 'id', label: 'Id', cell: (r) => r.id },
  ];
  const el = (await fixture(html`<lr-table style="display: block; width: 300px;"></lr-table>`)) as LyraTable<Row>;
  el.columns = skipColumns;
  el.rows = rows;
  await el.updateComplete;
  await waitUntil(() => el.hasHiddenPriorityColumns === true);

  const [nameHeader, scoreHeader, idHeader] = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="header-cell"]'),
  ] as [HTMLElement, HTMLElement, HTMLElement];
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
    { key: 'score', label: 'Score', priority: 'low', headerCell: forcedWidthHeaderCell(350, 'Score'), cell: (r) => r.score },
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
    html`<lr-table .columns=${actionColumns} .rows=${rows} @lr-row-activate=${() => (rowClicked = true)}></lr-table>`
  )) as LyraTable<Row>;
  await el.updateComplete;
  const select = el.shadowRoot!.querySelector('lr-select')!;
  const trigger = select.shadowRoot!.querySelector('[part~="trigger"]') as HTMLButtonElement;
  trigger.click();
  expect(rowClicked).to.be.false;
});

it('falls back to the column key for a blank header label\'s accessible name, leaving the visible header blank', async () => {
  const blankLabelColumns: TableColumn<Row>[] = [
    ...columns,
    {
      key: 'actions',
      label: '',
      cell: () => html`<lr-select data-testid="cell-select"></lr-select>`,
    },
  ];
  const el = (await fixture(
    html`<lr-table .columns=${blankLabelColumns} .rows=${rows}></lr-table>`
  )) as LyraTable<Row>;
  await el.updateComplete;
  const th = el.shadowRoot!.querySelector('[part="header-cell"][data-col-key="actions"]') as HTMLElement;
  expect(th.getAttribute('aria-label')).to.equal('actions');
  expect(th.textContent?.trim()).to.equal('');
});

it('lets a per-column ariaLabel override a blank header\'s accessible name', async () => {
  const ariaLabelColumns: TableColumn<Row>[] = [
    ...columns,
    {
      key: 'actions',
      label: '',
      ariaLabel: 'Row actions',
      cell: () => html`<lr-select data-testid="cell-select"></lr-select>`,
    },
  ];
  const el = (await fixture(
    html`<lr-table .columns=${ariaLabelColumns} .rows=${rows}></lr-table>`
  )) as LyraTable<Row>;
  await el.updateComplete;
  const th = el.shadowRoot!.querySelector('[part="header-cell"][data-col-key="actions"]') as HTMLElement;
  expect(th.getAttribute('aria-label')).to.equal('Row actions');
  expect(th.textContent?.trim()).to.equal('');
});

it('leaves a non-blank header label without an aria-label when ariaLabel is unset', async () => {
  const el = (await fixture(html`<lr-table .columns=${columns} .rows=${rows}></lr-table>`)) as LyraTable<Row>;
  await el.updateComplete;
  const th = el.shadowRoot!.querySelector('[part="header-cell"][data-col-key="name"]') as HTMLElement;
  expect(th.hasAttribute('aria-label')).to.be.false;
  expect(th.textContent?.trim()).to.equal('Name');
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
  el.addEventListener('lr-row-activate', () => activated++);

  (el.shadowRoot!.querySelector('table-passive-label') as HTMLElement).click();

  expect(activated).to.equal(1);
});

it('activates a row on a click from inside a non-interactive open-shadow custom element, skipping its ShadowRoot in the composed path', async () => {
  const openShellColumns: TableColumn<Row>[] = [
    {
      key: 'name',
      label: 'Name',
      cell: (row) => html`<table-open-shell>${row.name}</table-open-shell>`,
    },
  ];
  const el = (await fixture(
    html`<lr-table .columns=${openShellColumns} .rows=${rows} .rowKey=${(row: Row) => row.id}></lr-table>`
  )) as LyraTable<Row>;
  let activated = 0;
  el.addEventListener('lr-row-activate', () => activated++);

  const shell = el.shadowRoot!.querySelector('table-open-shell') as TableOpenShellElement;
  shell.innerSpan.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

  expect(activated).to.equal(1);
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
  let originalIssuedWarnings: Set<string> | undefined;
  let warnings: unknown[][];
  beforeEach(() => {
    originalWarn = console.warn;
    warnings = [];
    console.warn = (...args: unknown[]) => warnings.push(args);
    const runtime = globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> };
    originalIssuedWarnings = runtime.litIssuedWarnings;
    runtime.litIssuedWarnings = new Set();
    expectDeprecatedUsage('lr-table', 'attribute', 'accessible-label');
    expectDeprecatedUsage('lr-table', 'property', 'accessibleLabel');
  });
  afterEach(() => {
    console.warn = originalWarn;
    const runtime = globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> };
    if (originalIssuedWarnings === undefined) delete runtime.litIssuedWarnings;
    else runtime.litIssuedWarnings = originalIssuedWarnings;
  });

  it('names the grid from accessibleLabel and only warns about the deprecated spelling', async () => {
    const el = (await fixture(html`<lr-table accessible-label="Match scores"></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    await el.updateComplete;
    const grid = el.shadowRoot!.querySelector('[part="table"]') as HTMLElement;
    expect(grid.getAttribute('aria-label')).to.equal('Match scores');
    expect(warnings.filter(args => !String(args[0]).includes('deprecated')).length).to.equal(0);
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
    expect(warnings.filter(args => !String(args[0]).includes('deprecated')).length).to.equal(0);
  });

  it('warns once per page when grids have no accessible name', async () => {
    const first = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    first.columns = columns;
    first.rows = rows;
    await first.updateComplete;
    const second = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    second.columns = columns;
    second.rows = rows;
    await second.updateComplete;
    // Force another render — the shared diagnostic must not repeat.
    first.rows = [...rows];
    await first.updateComplete;
    expect(warnings.length).to.equal(1);
    expect(String(warnings[0]![0])).to.include('no accessible name');
  });

  it('does not warn when Lit development diagnostics are disabled', async () => {
    const runtime = globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> };
    delete runtime.litIssuedWarnings;
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    await el.updateComplete;
    expect(warnings.filter(args => !String(args[0]).includes('deprecated')).length).to.equal(0);
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

  it('treats an explicitly empty accessibleLabel as a real override, distinct from an omitted one', async () => {
    // An explicit empty override renders a genuinely blank aria-label and still suppresses the
    // caption aria-labelledby fallback -- unlike an omitted accessibleLabel, which lets caption
    // name the grid instead.
    const el = (await fixture(
      html`<lr-table accessible-label="" caption="Quarterly results"></lr-table>`,
    )) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    await el.updateComplete;
    const grid = el.shadowRoot!.querySelector('[part="table"]') as HTMLElement;
    expect(grid.getAttribute('aria-label')).to.equal('');
    expect(grid.hasAttribute('aria-labelledby')).to.be.false;
  });

  it('keeps the host aria-label ahead of the compatibility property, including after attribute changes', async () => {
    const el = (await fixture(
      html`<lr-table accessible-label="Primary" aria-label="Host"></lr-table>`,
    )) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    await el.updateComplete;
    const grid = el.shadowRoot!.querySelector('[part="table"]') as HTMLElement;
    expect(grid.getAttribute('aria-label')).to.equal('Host');

    el.accessibleLabel = 'Typed';
    await el.updateComplete;
    el.setAttribute('aria-label', 'Changed host');
    await el.updateComplete;
    expect(el.accessibleLabel).to.equal('Typed');
    expect(grid.getAttribute('aria-label')).to.equal('Changed host');

    el.accessibleLabel = undefined;
    await el.updateComplete;
    expect(grid.getAttribute('aria-label')).to.equal('Changed host');
    expect(warnings.filter(args => !String(args[0]).includes('deprecated')).length).to.equal(0);
  });
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
  el.addEventListener('lr-row-activate', () => (rowClicked = true));

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

// Proves each localize()-routed key actually reaches its rendered DOM node under a
// `.strings` override -- a key existing in DEFAULT_STRINGS doesn't by itself prove the
// call site is wired up correctly (see AGENTS.md's i18n testing convention).
describe('localization', () => {
  it('localizes the no-columns empty-state heading', async () => {
    const el = (await fixture(
      html`<lr-table .strings=${{ noColumns: 'Aucune colonne' }}></lr-table>`
    )) as LyraTable<Row>;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('lr-empty')!.getAttribute('heading')).to.equal('Aucune colonne');
  });

  it('localizes the loading spinner label', async () => {
    const el = (await fixture(
      html`<lr-table loading .strings=${{ tableLoading: 'Chargement des lignes' }}></lr-table>`
    )) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    await el.updateComplete;
    const spinner = el.shadowRoot!.querySelector(
      '[part="loading"] lr-spinner'
    )!;
    expect(spinner.getAttribute("aria-label")).to.equal(
      "Chargement des lignes"
    );
    expect(spinner.hasAttribute("accessible-label")).to.be.false;
    expect(spinner.textContent).to.contain("Chargement des lignes");
  });

  it('localizes the no-data empty-state heading (both the whole-table and filtered-to-empty variants)', async () => {
    const whole = (await fixture(
      html`<lr-table .strings=${{ noData: 'Aucune donnée' }}></lr-table>`
    )) as LyraTable<Row>;
    whole.columns = columns; // rows left empty -- exercises the whole-table (not no-columns) empty state
    await whole.updateComplete;
    expect(whole.shadowRoot!.querySelector('lr-empty')!.getAttribute('heading')).to.equal('Aucune donnée');

    const filtered = (await fixture(
      html`<lr-table filterable .strings=${{ noData: 'Aucune correspondance' }}></lr-table>`
    )) as LyraTable<Row>;
    filtered.columns = columns;
    filtered.rows = rows;
    filtered.rowKey = (r) => r.id;
    await filtered.updateComplete;
    filtered.filterText = 'nonexistent-xyz';
    await filtered.updateComplete;
    expect(filtered.shadowRoot!.querySelector('lr-empty')!.getAttribute('heading')).to.equal('Aucune correspondance');
  });

  it('localizes the filter label and placeholder', async () => {
    const el = (await fixture(
      html`<lr-table
        filterable
        .strings=${{
          tableFilterLabel: 'Filtrer',
          tableFilterPlaceholder: 'Rechercher…',
        }}
      ></lr-table>`
    )) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    await el.updateComplete;
    const label = el.shadowRoot!.querySelector('[part="filter-label"]')!;
    const input = el.shadowRoot!.querySelector('[part="filter"]') as HTMLInputElement;
    expect(label.textContent).to.contain('Filtrer');
    expect(input.getAttribute('aria-label')).to.equal('Filtrer');
    expect(input.getAttribute('placeholder')).to.equal('Rechercher…');
  });

  it('localizes the row expand/collapse toggle aria-label', async () => {
    const expandableColumns: TableColumn<Row>[] = [
      { key: 'name', label: 'Name', cell: (r) => r.name },
      { key: 'score', label: 'Score', align: 'end', cell: (r) => r.score },
    ];
    const el = (await fixture(
      html`<lr-table .strings=${{ expand: 'Développer', collapse: 'Réduire' }}></lr-table>`
    )) as LyraTable<Row>;
    el.columns = expandableColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.expandedContent = (r) => html`<p>${r.name} details</p>`;
    await el.updateComplete;

    const toggle = el.shadowRoot!.querySelector('[part="row-expand-toggle"]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-label')).to.equal('Développer');

    // `expandedRowKeys` is a controlled prop -- the toggle button only emits
    // lr-row-expand-toggle, it doesn't mutate state itself (see the
    // `emits lr-row-expand-toggle` test above).
    el.expandedRowKeys = new Set(['a']);
    await el.updateComplete;
    expect(toggle.getAttribute('aria-label')).to.equal('Réduire');
  });

  it('localizes the inline cell editor aria-label, interpolating the column label', async () => {
    const el = (await fixture(
      html`<lr-table .strings=${{ tableEditCell: 'Modifier {column}' }}></lr-table>`
    )) as LyraTable<Row>;
    el.columns = editableColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;

    const cell = el.shadowRoot!.querySelector('[part="row"] [part="cell"]') as HTMLElement;
    cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await el.updateComplete;
    const input = cell.querySelector('[part="cell-editor"]') as HTMLInputElement;
    expect(input.getAttribute('aria-label')).to.equal('Modifier Name');
  });

  it('gives a double-click cell editor a per-row accessible name when the column defines editLabel', async () => {
    const perRowLabelColumns: TableColumn<Row>[] = [
      {
        key: 'name',
        label: 'Name',
        editTrigger: 'double-click',
        editValue: (r) => r.name,
        editLabel: (r) => `Edit name for ${r.name}`,
        cell: (r) => r.name,
      },
    ];
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = perRowLabelColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;

    // One editor is open at a time for editTrigger: 'double-click' -- open each row's in turn and
    // confirm the name tracks the row, not just the column.
    const cells = [...el.shadowRoot!.querySelectorAll('[part="row"] [part="cell"]')] as HTMLElement[];
    cells[0]!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect((cells[0]!.querySelector('[part="cell-editor"]') as HTMLElement).getAttribute('aria-label')).to.equal(
      'Edit name for Alpha'
    );

    cells[1]!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect((cells[1]!.querySelector('[part="cell-editor"]') as HTMLElement).getAttribute('aria-label')).to.equal(
      'Edit name for Beta'
    );
  });

  it('localizes the reveal/hide-columns button label', async () => {
    const el = (await fixture(
      html`<lr-table
        style="display: block; width: 300px;"
        .strings=${{
          showAllColumns: 'Tout afficher',
          showFewerColumns: 'Afficher moins',
        }}
      ></lr-table>`
    )) as LyraTable<Row>;
    el.columns = priorityColumns;
    el.rows = rows;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="reveal-columns-button"]') !== null);

    const button = el.shadowRoot!.querySelector('[part="reveal-columns-button"]') as HTMLButtonElement;
    expect(button.textContent).to.contain('Tout afficher');
    button.click();
    await el.updateComplete;
    expect(button.textContent).to.contain('Afficher moins');
  });

  it('localizes the load-more button label', async () => {
    const el = (await fixture(html`<lr-table .strings=${{ loadMore: 'Charger plus' }}></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    el.hasMore = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="more-button"]')!.textContent).to.contain('Charger plus');
  });

  async function affectedOverrideTexts(overrides: {
    filterLabel: string;
    filterPlaceholder: string;
    loadingLabel: string;
    moreLabel: string;
    emptyHeading: string;
    emptyColumnsHeading: string;
    revealColumnsLabel: string;
    columnsHideLabel: string;
  }): Promise<string[]> {
    const strings = {
      tableFilterLabel: 'Filtrer',
      tableFilterPlaceholder: 'Rechercher…',
      tableLoading: 'Chargement',
      loadMore: 'Charger plus',
      noData: 'Aucune donnée',
      noColumns: 'Aucune colonne',
      showAllColumns: 'Tout afficher',
      showFewerColumns: 'Afficher moins',
    };
    const main = (await fixture(
      html`<lr-table
        filterable
        has-more
        style="display: block; width: 300px;"
        .strings=${strings}
      ></lr-table>`
    )) as LyraTable<Row>;
    Object.assign(main, overrides);
    main.columns = priorityColumns;
    main.rows = rows;
    await main.updateComplete;
    await waitUntil(() => main.hasHiddenPriorityColumns === true);
    const reveal = main.shadowRoot!.querySelector('[part="reveal-columns-button"]') as HTMLButtonElement;
    const revealText = reveal.textContent!.trim();
    reveal.click();
    await main.updateComplete;
    const hideText = reveal.textContent!.trim();

    const loading = (await fixture(
      html`<lr-table loading .strings=${strings}></lr-table>`
    )) as LyraTable<Row>;
    Object.assign(loading, overrides);
    // `priorityColumns`, not `columns`: these fixtures carry the reveal/hide label overrides, and
    // those labels are inert (and warn) unless at least one column declares `priority`. A stray
    // console.warn here is not cosmetic -- the strict-console runner trips once per file, so one
    // leaked warning disarms the detection for every later test in this file.
    loading.columns = priorityColumns;
    await loading.updateComplete;

    const empty = (await fixture(html`<lr-table .strings=${strings}></lr-table>`)) as LyraTable<Row>;
    Object.assign(empty, overrides);
    empty.columns = priorityColumns;
    await empty.updateComplete;

    const noColumns = (await fixture(html`<lr-table .strings=${strings}></lr-table>`)) as LyraTable<Row>;
    Object.assign(noColumns, overrides);
    await noColumns.updateComplete;

    const filter = main.shadowRoot!.querySelector('[part="filter"]') as HTMLInputElement;
    return [
      main.shadowRoot!.querySelector('[part="filter-label"]')!.textContent!.trim(),
      filter.getAttribute('placeholder') ?? 'missing',
      loading.shadowRoot!.querySelector('[part="loading"] lr-spinner')!.getAttribute('aria-label') ?? 'missing',
      main.shadowRoot!.querySelector('[part="more-button"]')!.textContent!.trim(),
      empty.shadowRoot!.querySelector('lr-empty')!.getAttribute('heading') ?? 'missing',
      noColumns.shadowRoot!.querySelector('lr-empty')!.getAttribute('heading') ?? 'missing',
      revealText,
      hideText,
    ];
  }

  it('keeps explicit built-in table label values ahead of .strings overrides', async () => {
    expect(
      await affectedOverrideTexts({
        filterLabel: 'Filter rows',
        filterPlaceholder: 'Filter rows',
        loadingLabel: 'Loading rows',
        moreLabel: 'Load more',
        emptyHeading: 'No data',
        emptyColumnsHeading: 'No columns configured',
        revealColumnsLabel: 'Show all columns',
        columnsHideLabel: 'Show fewer columns',
      })
    ).to.deep.equal([
      'Filter rows',
      'Filter rows',
      'Loading rows',
      'Load more',
      'No data',
      'No columns configured',
      'Show all columns',
      'Show fewer columns',
    ]);
  });

  it('keeps explicit empty table label values empty', async () => {
    expect(
      await affectedOverrideTexts({
        filterLabel: '',
        filterPlaceholder: '',
        loadingLabel: '',
        moreLabel: '',
        emptyHeading: '',
        emptyColumnsHeading: '',
        revealColumnsLabel: '',
        columnsHideLabel: '',
      })
    ).to.deep.equal(['', '', '', '', '', '', '', '']);
  });
});

describe('announcement sink lifecycle', () => {
  it('releases (does not acquire) the announcement sink when synced while disconnected', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    await el.updateComplete;
    expect((el as unknown as { announcementSink?: unknown }).announcementSink).to.exist;

    el.remove();
    expect((el as unknown as { announcementSink?: unknown }).announcementSink, 'disconnect already released it').to.be
      .undefined;
    // syncAnnouncementSink is only ever invoked from connectedCallback in normal operation; calling
    // it directly here exercises its own "not connected" guard without re-entering the full public
    // lifecycle (which would also re-subscribe locale/ResizeObserver machinery with no matching
    // teardown, since the element is never reconnected).
    (el as unknown as { syncAnnouncementSink(): void }).syncAnnouncementSink();
    expect((el as unknown as { announcementSink?: unknown }).announcementSink).to.be.undefined;
  });

  it('does not release/reacquire the announcement sink when synced again while still connected to the same document', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    await el.updateComplete;
    const before = (el as unknown as { announcementSink?: unknown }).announcementSink;
    expect(before).to.exist;

    // Same rationale as above: calling the private sync method directly (instead of re-entering
    // connectedCallback) exercises its own "already have a sink for this document" shortcut in
    // isolation.
    (el as unknown as { syncAnnouncementSink(): void }).syncAnnouncementSink();
    // Compared as a boolean, not passed to chai directly: the sink object carries a DOM element
    // reference, and a failing node/object identity assertion can hang chai's diff output.
    expect((el as unknown as { announcementSink?: unknown }).announcementSink === before).to.be.true;
  });
});

// -- Grid roving-focus edges, skeleton column parity, grouped totals ---------

describe('grid keyboard navigation edges', () => {
  const grid = async (dir = 'ltr'): Promise<LyraTable<Row>> => {
    const wrapper = (await fixture(html`
      <div dir=${dir}>
        <lr-table accessible-label="Scores" .columns=${columns} .rows=${rows}></lr-table>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-table') as LyraTable<Row>;
    await el.updateComplete;
    return el;
  };
  const headers = (el: LyraTable<Row>): HTMLElement[] => [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('th[data-col-key]'),
  ];
  const bodyRows = (el: LyraTable<Row>): HTMLElement[] => [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[data-row-key]'),
  ];
  const key = async (el: LyraTable<Row>, target: HTMLElement, k: string): Promise<KeyboardEvent> => {
    const event = new KeyboardEvent('keydown', {
      key: k,
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(event);
    await el.updateComplete;
    return event;
  };

  it('clamps a lost roving row stop to the same list position, then to null once rows are fully empty', async () => {
    const el = (await fixture(html`<lr-table accessible-label="Scores"></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = [
      { id: 'a', name: 'Alpha', score: 1 },
      { id: 'b', name: 'Beta', score: 2 },
      { id: 'c', name: 'Gamma', score: 3 },
    ];
    el.rowKey = (row) => row.id;
    await el.updateComplete;
    const beta = el.shadowRoot!.querySelector<HTMLElement>('[data-row-key="string:b"]')!;
    beta.focus();
    expect(el.shadowRoot!.activeElement === beta).to.be.true;

    // 'b' still exists after this reorder, so the roving stop must stay pinned to its own identity
    // rather than its old numeric position (which now belongs to 'c').
    el.rows = [
      { id: 'c', name: 'Gamma', score: 3 },
      { id: 'b', name: 'Beta', score: 2 },
      { id: 'a', name: 'Alpha', score: 1 },
    ];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector<HTMLElement>('[data-row-key="string:b"]')!.getAttribute('tabindex')).to.equal(
      '0',
    );

    // 'b' (previously at position 1) is gone; 'd' now occupies that same array position. The roving
    // stop must clamp to the position, landing on 'd', rather than defaulting back to the first row.
    el.rows = [
      { id: 'a', name: 'Alpha', score: 1 },
      { id: 'd', name: 'Delta', score: 4 },
    ];
    await el.updateComplete;

    const delta = el.shadowRoot!.querySelector<HTMLElement>('[data-row-key="string:d"]')!;
    expect(delta.getAttribute('tabindex')).to.equal('0');
    expect(el.shadowRoot!.querySelectorAll('[data-row-key][tabindex="0"]').length).to.equal(1);

    el.rows = [];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[data-row-key]').length).to.equal(0);
  });

  it('clamps header ArrowLeft at the first column and ArrowRight at the last', async () => {
    const el = await grid();
    const th = headers(el);
    await key(el, th[0]!, 'ArrowLeft');
    expect(th[0]!.getAttribute('tabindex'), 'ArrowLeft on the first header stays put').to.equal('0');
    await key(el, th[th.length - 1]!, 'ArrowRight');
    expect(th[th.length - 1]!.getAttribute('tabindex')).to.equal('0');
  });

  it('clamps mirrored header arrows under dir="rtl"', async () => {
    const el = await grid('rtl');
    const th = headers(el);
    await key(el, th[th.length - 1]!, 'ArrowLeft');
    expect(th[th.length - 1]!.getAttribute('tabindex')).to.equal('0');
    await key(el, th[0]!, 'ArrowRight');
    expect(th[0]!.getAttribute('tabindex')).to.equal('0');
  });

  it('moves through middle headers in the visual direction under inherited RTL', async () => {
    const threeColumns: TableColumn<Row>[] = [
      { key: 'name', label: 'Name', cell: (row) => row.name },
      { key: 'score', label: 'Score', cell: (row) => row.score },
      { key: 'id', label: 'ID', cell: (row) => row.id },
    ];
    const wrapper = (await fixture(html`
      <div dir="rtl">
        <lr-table accessible-label="Scores" .columns=${threeColumns} .rows=${rows}></lr-table>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-table') as LyraTable<Row>;
    await el.updateComplete;
    const [name, score, id] = headers(el);

    name!.focus();
    const toMiddle = await key(el, name!, 'ArrowLeft');
    expect(toMiddle.defaultPrevented).to.be.true;
    expect(el.shadowRoot!.activeElement === score).to.be.true;
    expect(score!.getAttribute('tabindex')).to.equal('0');

    const forward = await key(el, score!, 'ArrowLeft');
    expect(forward.defaultPrevented).to.be.true;
    expect(el.shadowRoot!.activeElement === id).to.be.true;
    expect(id!.getAttribute('tabindex')).to.equal('0');

    const backward = await key(el, id!, 'ArrowRight');
    expect(backward.defaultPrevented).to.be.true;
    expect(el.shadowRoot!.activeElement === score).to.be.true;
    expect(name!.getAttribute('tabindex')).to.equal('-1');
  });

  it('ArrowDown from a header enters the body and ArrowUp from the first row returns to it', async () => {
    const el = await grid();
    const th = headers(el);
    const down = await key(el, th[0]!, 'ArrowDown');
    expect(down.defaultPrevented).to.be.true;
    expect(bodyRows(el)[0]!.getAttribute('tabindex')).to.equal('0');

    const up = await key(el, bodyRows(el)[0]!, 'ArrowUp');
    expect(up.defaultPrevented).to.be.true;
    expect(headers(el)[0]!.getAttribute('tabindex'), 'ArrowUp from row 0 lands back on a header').to.equal('0');
  });

  it('walks rows with ArrowDown/ArrowUp and clamps at both ends', async () => {
    const el = await grid();
    const rowEls = bodyRows(el);
    await key(el, rowEls[0]!, 'ArrowDown');
    expect(bodyRows(el)[1]!.getAttribute('tabindex')).to.equal('0');
    await key(el, bodyRows(el)[1]!, 'ArrowDown');
    expect(bodyRows(el)[1]!.getAttribute('tabindex'), 'clamps on the last row').to.equal('0');
    await key(el, bodyRows(el)[1]!, 'ArrowUp');
    expect(bodyRows(el)[0]!.getAttribute('tabindex')).to.equal('0');
  });

  it('keeps an RTL row stop at its page-relative index when a controlled page changes', async () => {
    const pagedRows: Row[] = [
      ...rows,
      { id: 'c', name: 'Gamma', score: 2 },
      { id: 'd', name: 'Delta', score: 4 },
    ];
    const wrapper = (await fixture(html`
      <div dir="rtl">
        <lr-table accessible-label="Scores" page-size="2" page="2"></lr-table>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-table') as LyraTable<Row>;
    el.columns = columns;
    el.rows = pagedRows;
    el.rowKey = (row) => row.id;
    await el.updateComplete;
    const [gamma, delta] = bodyRows(el);

    gamma!.focus();
    const down = await key(el, gamma!, 'ArrowDown');
    expect(down.defaultPrevented).to.be.true;
    expect(el.shadowRoot!.activeElement === delta).to.be.true;

    el.page = 1;
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement?.getAttribute('data-row-key')).to.equal('string:b');
    expect(el.shadowRoot!.activeElement?.getAttribute('tabindex')).to.equal('0');
  });

  it('clears an RTL roving row stop when a controlled filter removes every match', async () => {
    const wrapper = (await fixture(html`
      <div dir="rtl"><lr-table accessible-label="Scores" filterable></lr-table></div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-table') as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    el.rowKey = (row) => row.id;
    await el.updateComplete;
    const alpha = el.shadowRoot!.querySelector<HTMLElement>('[data-row-key="string:a"]')!;
    const beta = el.shadowRoot!.querySelector<HTMLElement>('[data-row-key="string:b"]')!;

    alpha.focus();
    const down = await key(el, alpha, 'ArrowDown');
    expect(down.defaultPrevented).to.be.true;
    expect(el.shadowRoot!.activeElement === beta).to.be.true;
    expect(beta.getAttribute('tabindex')).to.equal('0');

    el.filterText = 'no matching row';
    await el.updateComplete;

    expect(el.shadowRoot!.querySelectorAll('[data-row-key]').length).to.equal(0);
    expect(el.shadowRoot!.querySelector('lr-empty')?.localName).to.equal('lr-empty');
    expect(el.shadowRoot!.querySelectorAll('[data-row-key][tabindex="0"]').length).to.equal(0);
    expect(el.shadowRoot!.activeElement === null).to.be.true;
  });

  it('Home and End jump to the first and last row and header', async () => {
    const el = await grid();
    await key(el, bodyRows(el)[0]!, 'End');
    expect(bodyRows(el).at(-1)!.getAttribute('tabindex')).to.equal('0');
    await key(el, bodyRows(el).at(-1)!, 'Home');
    expect(bodyRows(el)[0]!.getAttribute('tabindex')).to.equal('0');

    await key(el, headers(el)[0]!, 'End');
    expect(headers(el).at(-1)!.getAttribute('tabindex')).to.equal('0');
    await key(el, headers(el).at(-1)!, 'Home');
    expect(headers(el)[0]!.getAttribute('tabindex')).to.equal('0');
  });

  it('ignores an unhandled key on both a header and a row', async () => {
    const el = await grid();
    const onHeader = await key(el, headers(el)[0]!, 'PageDown');
    const onRow = await key(el, bodyRows(el)[0]!, 'PageDown');
    expect(onHeader.defaultPrevented).to.be.false;
    expect(onRow.defaultPrevented).to.be.false;
  });

  it('ignores keys on a header or row that is no longer part of the rendered grid', async () => {
    const el = await grid();
    const detachedHeader = headers(el)[0]!;
    const detachedRow = bodyRows(el)[0]!;
    el.columns = [];
    el.rows = [];
    await el.updateComplete;
    const h = await key(el, detachedHeader, 'ArrowRight');
    const r = await key(el, detachedRow, 'ArrowDown');
    expect(h.defaultPrevented, 'a detached header is inert').to.be.false;
    expect(r.defaultPrevented, 'a detached row is inert').to.be.false;
  });

  it('renders the no-columns empty state instead of throwing when columns is emptied with rows still present', async () => {
    const el = await grid();
    el.columns = [];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('th[data-col-key]').length).to.equal(0);
    expect(el.shadowRoot!.querySelector('lr-empty')?.localName).to.equal('lr-empty');
  });

  it('excludes a row whose rowKey callback throws instead of failing the whole render', async () => {
    const el = (await fixture(html`<lr-table accessible-label="Scores"></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = [
      { id: 'a', name: 'Alpha', score: 1 },
      { id: 'poison', name: 'Poison', score: 2 },
    ];
    el.rowKey = (row) => {
      if (row.id === 'poison') throw new Error('boom');
      return row.id;
    };
    await el.updateComplete;

    const keys = [...el.shadowRoot!.querySelectorAll('[data-row-key]')].map((r) =>
      r.getAttribute('data-row-key'),
    );
    expect(keys).to.deep.equal(['string:a']);
  });

  it('does not move focus (no crash) on ArrowDown from a header when there are no real body rows yet (skeleton loading)', async () => {
    const wrapper = (await fixture(html`
      <div>
        <lr-table
          accessible-label="Scores"
          loading
          loading-appearance="skeleton"
          .columns=${columns}
          .rows=${[]}
        ></lr-table>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-table') as LyraTable<Row>;
    await el.updateComplete;
    const th = headers(el);
    expect(
      el.shadowRoot!.querySelectorAll('[data-row-key]').length,
      'skeleton placeholders carry no data-row-key'
    ).to.equal(0);

    th[0]!.focus();
    const down = await key(el, th[0]!, 'ArrowDown');
    expect(down.defaultPrevented).to.be.true;
    // No real row exists to move focus to -- the header keeps it. Compared as a boolean, not
    // passed to chai directly, since a failing DOM-node identity assertion can hang chai's diff.
    expect(el.shadowRoot!.activeElement === th[0]).to.be.true;
  });

  it('does not move focus (no crash) on ArrowUp from the first row when every column is priority-hidden', async () => {
    const el = (await fixture(
      html`<lr-table accessible-label="Scores" style="display:block;width:300px;"></lr-table>`
    )) as LyraTable<Row>;
    el.columns = [
      {
        key: 'name',
        label: 'Name',
        priority: 'low',
        headerCell: forcedWidthHeaderCell(350, 'Name'),
        cell: (r: Row) => r.name,
      },
      {
        key: 'score',
        label: 'Score',
        priority: 'medium',
        headerCell: forcedWidthHeaderCell(350, 'Score'),
        cell: (r: Row) => r.score,
      },
    ];
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    await waitUntil(() =>
      [...el.shadowRoot!.querySelectorAll<HTMLElement>('th[data-col-key]')].every((h) => h.offsetParent === null)
    );

    const row = bodyRows(el)[0]!;
    row.focus();
    const up = await key(el, row, 'ArrowUp');
    expect(up.defaultPrevented).to.be.true;
    // No visible header to move focus to -- the row keeps it. Compared as a boolean, not passed
    // to chai directly, since a failing DOM-node identity assertion can hang chai's diff.
    expect(el.shadowRoot!.activeElement === row).to.be.true;
  });
});

it('activates the focused row from Enter and Space', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const first = el.shadowRoot!.querySelector<HTMLElement>('[data-row-key]')!;
  first.focus();

  const activated = oneEvent(el, 'lr-row-activate');
  first.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
  );
  expect((await activated).detail.row.id).to.equal(rows[0]!.id);

  const spaceActivated = oneEvent(el, 'lr-row-activate');
  first.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
  expect((await spaceActivated).detail.row.id).to.equal(rows[0]!.id);
});

it('gives host aria-label precedence over the compatibility name and caption', async () => {
  const el = await fixture<LyraTable<Row>>(html`<lr-table aria-label="Host name" accessible-label="Old name" caption="Caption" .columns=${columns} .rows=${rows}></lr-table>`);
  const owner = () => el.shadowRoot!.querySelector('[role="grid"]')!;
  expect(owner().getAttribute('aria-label')).to.equal('Host name');
  el.ariaLabel = '';
  await el.updateComplete;
  expect(owner().getAttribute('aria-label')).to.equal('');
  expect(owner().hasAttribute('aria-labelledby')).to.equal(false);
  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(owner().getAttribute('aria-label')).to.equal('Old name');
});
