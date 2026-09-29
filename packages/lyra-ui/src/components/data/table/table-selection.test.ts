import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './table.js';
import '../../forms/select/select.js';
import type { LyraTable, TableColumn } from './table.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { setForcedColors } from '../../../../test/wtr-media.js';
// Registers the real shipped `ar` catalog's `data` slice so the `lang="ar-EG"` resize-value
// test below (which only overrides `resizeValuePixels`) can render without tripping the
// dev-mode locale-fallback warning that strict-console platform lanes treat as fatal.
import '../../../translations/ar/data.js';
import { installTableTestHooks, type Row, columns, rows } from '../../../../test/table.js';
installTableTestHooks();




it('supports opt-in multiple row selection without changing the default presentational mode', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (row) => row.id;
  el.selectionMode = 'multiple';
  await el.updateComplete;
  const row = el.shadowRoot!.querySelector('[part="row"]') as HTMLElement;
  const eventPromise = oneEvent(el, 'lr-selection-change');
  row.click();
  const event = await eventPromise;
  expect(event.detail.selectedRowKeys).to.deep.equal(['a']);
  expect(el.selectedRowKeys.has('a')).to.be.true;
  expect(row.getAttribute('aria-selected')).to.equal('true');
});

it('omits blank controlled keys while retaining valid off-page selection identities', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (row) => row.id;
  el.selectionMode = 'multiple';
  el.selectedRowKeys = new Set(['   ', null, false, {}, 'a'] as unknown as Array<string | number>);
  el.expandedRowKeys = new Set(['', '   ', undefined, true, [], 'off-page'] as unknown as Array<string | number>);
  await el.updateComplete;

  expect([...el.selectedRowKeys]).to.deep.equal(['a']);
  expect([...el.expandedRowKeys]).to.deep.equal(['off-page']);
  const pending = oneEvent(el, 'lr-selection-change');
  el.shadowRoot!.querySelectorAll<HTMLElement>('[part=row]')[1]!.click();
  expect((await pending).detail.selectedRowKeys).to.deep.equal(['a', 'b']);
  expect([...el.selectedRowKeys]).to.deep.equal(['a', 'b']);
});

it('supports single row selection and emits the selected key', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (row) => row.id;
  el.selectionMode = 'single';
  await el.updateComplete;

  const row = el.shadowRoot!.querySelector('[part="row"]') as HTMLElement;
  const eventPromise = oneEvent(el, 'lr-selection-change');
  row.click();
  const event = await eventPromise;
  expect(event.detail.selectedRowKeys).to.deep.equal(['a']);
  expect([...el.selectedRowKeys]).to.deep.equal(['a']);
});

it('enforces single cardinality when a populated multiple selection switches modes live', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (row) => row.id;
  el.selectionMode = 'multiple';
  el.selectedRowKeys = new Set(['a', 'b']);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="row"][aria-selected="true"]').length).to.equal(2);

  el.selectionMode = 'single';
  await el.updateComplete;

  expect([...el.selectedRowKeys]).to.deep.equal(['a']);
  expect(el.shadowRoot!.querySelectorAll('[part="row"][aria-selected="true"]').length).to.equal(1);
  expect(el.shadowRoot!.querySelector('[part="row"][aria-selected="true"]')!.getAttribute('data-row-key')).to.equal(
    'string:a'
  );

  el.selectionMode = 'multiple';
  el.selectedRowKeys = new Set(['b']);
  await el.updateComplete;
  expect([...el.selectedRowKeys]).to.deep.equal(['b']);
  expect(el.shadowRoot!.querySelectorAll('[part="row"][aria-selected="true"]').length).to.equal(1);
});

it('states aria-multiselectable="false" explicitly for non-multiple selection modes, not merely its absence', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (row) => row.id;
  await el.updateComplete;
  const table = el.shadowRoot!.querySelector('[part="table"]') as HTMLElement;

  expect(el.selectionMode).to.equal('none');
  expect(table.getAttribute('aria-multiselectable')).to.equal('false');

  el.selectionMode = 'single';
  await el.updateComplete;
  expect(table.getAttribute('aria-multiselectable')).to.equal('false');

  el.selectionMode = 'multiple';
  await el.updateComplete;
  expect(table.getAttribute('aria-multiselectable')).to.equal('true');
});

it('emits lr-selection-change when a selectionMode flip silently coerces an over-large selection', async () => {
  // The interactive click/keyboard selection paths already emit lr-selection-change; this is the
  // *other* mutation site, the willUpdate() coercion that clamps a multi-row selection down to one
  // key when selectionMode flips to 'single'. A host mirroring "selected rows" purely from the
  // event must hear about this mutation too, not just re-read the property after the fact.
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (row) => row.id;
  el.selectionMode = 'multiple';
  el.selectedRowKeys = new Set(['a', 'b']);
  await el.updateComplete;

  const eventPromise = oneEvent(el, 'lr-selection-change');
  el.selectionMode = 'single';
  const event = await eventPromise;
  expect(event.detail.selectedRowKeys).to.deep.equal(['a']);
  expect(event.cancelable, 'a consistency fix-up is not a veto point').to.equal(false);
  expect([...el.selectedRowKeys]).to.deep.equal(['a']);
});

it('does not emit lr-selection-change when the initial mount already combines selectionMode="single" with an over-large selectedRowKeys', async () => {
  // Lit's first `changed` map lists every set property, so a consumer mounting with an
  // already-inconsistent selectionMode/selectedRowKeys combination must not be treated as a live
  // transition -- the initial coerced state is the starting point, not a change from anything.
  const el = document.createElement('lr-table') as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (row) => row.id;
  el.selectionMode = 'single';
  el.selectedRowKeys = new Set(['a', 'b']);
  let emitted = 0;
  el.addEventListener('lr-selection-change', () => {
    emitted += 1;
  });
  document.body.append(el);
  await el.updateComplete;
  expect([...el.selectedRowKeys]).to.deep.equal(['a']);
  expect(emitted, 'the initial mount is not a transition').to.equal(0);
  el.remove();
});

it('does not trigger a Lit "scheduled an update after an update completed" dev warning when a selectionMode flip coerces the selection', async () => {
  // Reset Lit's own dedupe set first so this doesn't silently pass just because an earlier test in
  // this file (or another file in the same browser session) already tripped -- and thus
  // suppressed -- the exact same warning string. Same guard as the priority-column-hiding warning
  // test above.
  const globalWarnings = (globalThis as { litIssuedWarnings?: Set<string> }).litIssuedWarnings;
  if (globalWarnings) {
    [...globalWarnings].filter((w) => w.includes('scheduled an update')).forEach((w) => globalWarnings.delete(w));
  }

  const originalWarn = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => calls.push(args);
  try {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    el.rowKey = (row) => row.id;
    el.selectionMode = 'multiple';
    el.selectedRowKeys = new Set(['a', 'b']);
    await el.updateComplete;
    el.selectionMode = 'single';
    await el.updateComplete;
  } finally {
    console.warn = originalWarn;
  }

  const messages = calls.flat().map(String);
  expect(messages.some((m) => m.includes('scheduled an update'))).to.be.false;
});

it("gives a sticky cell in a selected row the row's selected background instead of the flat surface color", async () => {
  const stickyColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', sticky: 'start', cell: (r) => r.name },
    { key: 'score', label: 'Score', align: 'end', cell: (r) => r.score },
  ];
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = stickyColumns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  el.selectionMode = 'single';
  // Selects the un-striped row ('b') to isolate the selected-state effect from the stripe one.
  el.selectedRowKeys = new Set(['b']);
  await el.updateComplete;

  const selectedRow = el.shadowRoot!.querySelector('[part="row"][aria-selected="true"]') as HTMLElement;
  const stickyCell = selectedRow.querySelector('[part="cell"][data-sticky]') as HTMLElement;
  const plainHeader = el.shadowRoot!.querySelectorAll('[part="header-cell"]')[1] as HTMLElement;
  const surfaceBg = getComputedStyle(plainHeader).backgroundColor;
  const rowBg = getComputedStyle(selectedRow).backgroundColor;

  expect(rowBg).to.not.equal(surfaceBg);
  expect(getComputedStyle(stickyCell).backgroundColor).to.equal(rowBg);
});

it('sets aria-selected="true" only on the row matching selectedRowKeys', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  el.selectionMode = 'single';
  el.selectedRowKeys = new Set(['b']);
  await el.updateComplete;
  const [firstRow, secondRow] = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="row"]'),
  ] as [HTMLElement, HTMLElement];
  expect(firstRow.getAttribute('aria-selected')).to.equal('false');
  expect(secondRow.getAttribute('aria-selected')).to.equal('true');
});

it('omits aria-selected when row selection is disabled', async () => {
  const el = (await fixture(html`<lr-table selection-mode="none"></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;

  for (const row of el.shadowRoot!.querySelectorAll('[part="row"]')) {
    expect(row.hasAttribute('aria-selected')).to.be.false;
  }
});

it('uses selectedRowKeys as the default roving-tabindex row when no row has been focused yet', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  el.selectedRowKeys = new Set(['b']);
  await el.updateComplete;
  const [firstRow, secondRow] = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="row"]'),
  ] as [HTMLElement, HTMLElement];
  expect(firstRow.getAttribute('tabindex')).to.equal('-1');
  expect(secondRow.getAttribute('tabindex')).to.equal('0');
});

describe('expandable rows', () => {
  it('exposes expandedRowKeys defaulting to an empty, Set-like read-only facade', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    // Not a literal `instanceof Set` -- the getter returns a frozen facade (see the
    // `readonlyKeySet()` JSDoc above `expandedRowKeys` in table.class.ts), so assert the
    // documented Set-like contract instead of the class identity.
    expect(el.expandedRowKeys.size).to.equal(0);
    expect([...el.expandedRowKeys]).to.deep.equal([]);
    expect(el.expandedRowKeys.has('anything')).to.equal(false);
  });

  const expandableColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', cell: (r) => r.name },
    { key: 'score', label: 'Score', align: 'end', cell: (r) => r.score },
  ];

  it('renders no leading toggle cell when expandedContent is unset (unchanged default)', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = expandableColumns;
    el.rows = rows;
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="expand-toggle-cell"]')) == null).to.be.true;
    expect((el.shadowRoot!.querySelector('[data-row-expand-toggle]')) == null).to.be.true;
  });

  it('renders a leading toggle cell on the header and every row when expandedContent is set', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = expandableColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.expandedContent = (r) => html`<p>${r.name} details</p>`;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-row-expand-toggle]')).to.exist;
    const toggleCells = el.shadowRoot!.querySelectorAll('[part="expand-toggle-cell"]');
    expect(toggleCells.length).to.equal(rows.length);
    expect(toggleCells[0]!.querySelector('button') != null).to.equal(true);
  });

  it('gives the row-expand toggle button the shared minimum hit area', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = expandableColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.expandedContent = (r) => html`<p>${r.name} details</p>`;
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector('[part="row-expand-toggle"]') as HTMLElement;
    expect(getComputedStyle(toggle).minInlineSize).to.equal('40px');
    expect(getComputedStyle(toggle).minBlockSize).to.equal('40px');
  });

  it('inherits a live host font size into the row-expand toggle and its 1em glyph', async () => {
    const el = (await fixture(
      html`<lr-table style="font: 20px/1 monospace"></lr-table>`
    )) as LyraTable<Row>;
    el.columns = expandableColumns;
    el.rows = rows;
    el.rowKey = (row) => row.id;
    el.expandedContent = (row) => html`<p>${row.name} details</p>`;
    await el.updateComplete;

    const table = el.shadowRoot!.querySelector<HTMLElement>('[part="table"]')!;
    const toggle = el.shadowRoot!.querySelector<HTMLElement>('[part="row-expand-toggle"]')!;
    const glyph = toggle.querySelector<SVGElement>('[part="row-expand-icon"] svg')!;
    expect(getComputedStyle(table).fontSize).to.equal('20px');
    expect(getComputedStyle(toggle).fontSize).to.equal('20px');
    expect(getComputedStyle(toggle).fontFamily).to.equal(getComputedStyle(table).fontFamily);
    expect(getComputedStyle(glyph).width).to.equal('20px');
    expect(getComputedStyle(glyph).height).to.equal('20px');
  });

  it('renders an empty, non-interactive toggle cell for a row that fails canExpand', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = expandableColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.expandedContent = (r) => html`<p>${r.name} details</p>`;
    el.canExpand = (r) => r.id !== 'a';
    await el.updateComplete;
    const toggleCells = [...el.shadowRoot!.querySelectorAll('[part="expand-toggle-cell"]')];
    expect(toggleCells[0]!.querySelector('button') == null).to.equal(true); // row 'a' (Alpha) opted out
    expect(toggleCells[1]!.querySelector('button') != null).to.equal(true); // row 'b' (Beta)
  });

  it('emits lr-row-expand-toggle with { row, rowKey } when the chevron button is clicked, and does not also emit lr-row-activate', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = expandableColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.expandedContent = (r) => html`<p>${r.name} details</p>`;
    await el.updateComplete;

    let rowClicked = false;
    el.addEventListener('lr-row-activate', () => (rowClicked = true));

    const firstToggleButton = el.shadowRoot!.querySelector('[part="expand-toggle-cell"] button') as HTMLButtonElement;
    setTimeout(() => firstToggleButton.click());
    const ev = await oneEvent(el, 'lr-row-expand-toggle');
    expect(ev.detail.row).to.deep.equal(rows[0]);
    expect(ev.detail.rowKey).to.equal('a');
    expect(rowClicked).to.be.false;
  });

  it('still emits lr-row-activate when clicking elsewhere in an expandable row', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = expandableColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.expandedContent = (r) => html`<p>${r.name} details</p>`;
    await el.updateComplete;

    let toggleFired = false;
    el.addEventListener('lr-row-expand-toggle', () => (toggleFired = true));

    const nameCell = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
    setTimeout(() => nameCell.click());
    const ev = await oneEvent(el, 'lr-row-activate');
    expect(ev.detail.row).to.deep.equal(rows[0]);
    expect(toggleFired).to.be.false;
  });

  it('renders the expanded panel row with the correct colspan when a row key is in expandedRowKeys', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = expandableColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.expandedContent = (r) => html`<p class="panel">${r.name} details</p>`;
    el.expandedRowKeys = new Set(['a']);
    await el.updateComplete;

    const expandedRow = el.shadowRoot!.querySelector('[part="expanded-row"]');
    expect(expandedRow != null).to.equal(true);
    const expandedCell = expandedRow!.querySelector('[part="expanded-cell"]') as HTMLElement;
    expect(expandedCell.getAttribute('colspan')).to.equal('3'); // 2 columns + 1 toggle column
    expect(expandedCell.querySelector('.panel')!.textContent).to.equal('Alpha details');

    // Only one row is in expandedRowKeys — only one expanded-row renders.
    expect(el.shadowRoot!.querySelectorAll('[part="expanded-row"]').length).to.equal(1);
  });

  it('removes the expanded panel row when its key is removed from expandedRowKeys', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = expandableColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.expandedContent = (r) => html`<p>${r.name} details</p>`;
    el.expandedRowKeys = new Set(['a']);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="expanded-row"]')).to.exist;

    el.expandedRowKeys = new Set();
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="expanded-row"]')) == null).to.be.true;
  });

  it('does not render an expanded panel row for a row that fails canExpand, even if its key is in expandedRowKeys', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = expandableColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.expandedContent = (r) => html`<p>${r.name} details</p>`;
    el.canExpand = (r) => r.id !== 'a';
    el.expandedRowKeys = new Set(['a', 'b']);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="expanded-row"]').length).to.equal(1); // only 'b'
  });

  it('activates the chevron toggle via native button keydown (Enter) without triggering row activation or preventDefault', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = expandableColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.expandedContent = (r) => html`<p>${r.name} details</p>`;
    await el.updateComplete;

    let rowClicked = false;
    el.addEventListener('lr-row-activate', () => (rowClicked = true));

    const toggleButton = el.shadowRoot!.querySelector('[part="row-expand-toggle"]') as HTMLButtonElement;
    toggleButton.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    const notPrevented = toggleButton.dispatchEvent(event);

    expect(rowClicked).to.be.false;
    expect(notPrevented).to.be.true;
  });

  it('is accessible with expandedContent and an open row', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = expandableColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.expandedContent = (r) => html`<p>${r.name} details</p>`;
    el.expandedRowKeys = new Set(['a']);
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it('grows a matching leading spacer cell in the footer row when combined with a footer column, keeping real footer cells aligned', async () => {
    const withFooter: TableColumn<Row>[] = [
      ...expandableColumns,
      {
        key: 'total',
        label: 'Total',
        footer: (rs) => rs.reduce((sum, r) => sum + r.score, 0),
        cell: () => '',
      },
    ];
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = withFooter;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.expandedContent = (r) => html`<p>${r.name} details</p>`;
    await el.updateComplete;

    const foot = el.shadowRoot!.querySelector('tfoot[part="foot"]');
    expect(foot != null).to.equal(true);
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

  it('leaves expandedRowKeys untouched on click under the default expansionMode="none" (unset-regression)', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = expandableColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.expandedContent = (r) => html`<p>${r.name} details</p>`;
    await el.updateComplete;
    expect(el.expansionMode).to.equal('none');

    let requestFired = false;
    el.addEventListener('lr-row-expand-request', () => (requestFired = true));
    const firstToggleButton = el.shadowRoot!.querySelector('[part="expand-toggle-cell"] button') as HTMLButtonElement;
    setTimeout(() => firstToggleButton.click());
    const ev = await oneEvent(el, 'lr-row-expand-toggle');
    expect(ev.detail.expanded).to.equal(true);
    expect(requestFired, 'lr-row-expand-request is only emitted under a self-managed mode').to.be.false;
    expect(el.expandedRowKeys.size, 'the default mode never writes expandedRowKeys itself').to.equal(0);
  });

  it('self-manages expandedRowKeys under expansionMode="multiple" with no host-side handler', async () => {
    const el = (await fixture(html`<lr-table expansion-mode="multiple"></lr-table>`)) as LyraTable<Row>;
    el.columns = expandableColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.expandedContent = (r) => html`<p>${r.name} details</p>`;
    await el.updateComplete;

    const firstToggleButton = el.shadowRoot!.querySelector('[part="expand-toggle-cell"] button') as HTMLButtonElement;
    setTimeout(() => firstToggleButton.click());
    const opened = await oneEvent(el, 'lr-row-expand-toggle');
    expect(opened.detail).to.deep.equal({ row: rows[0], rowKey: 'a', expanded: true });
    expect(Object.isFrozen(opened.detail)).to.equal(true);
    expect([...el.expandedRowKeys]).to.deep.equal(['a']);
    expect(el.shadowRoot!.querySelector('[part="expanded-row"]')).to.exist;

    // Clicking the same toggle again collapses it -- still with no host handler.
    setTimeout(() => firstToggleButton.click());
    const closed = await oneEvent(el, 'lr-row-expand-toggle');
    expect(closed.detail).to.deep.equal({ row: rows[0], rowKey: 'a', expanded: false });
    expect(el.expandedRowKeys.size).to.equal(0);
    expect((el.shadowRoot!.querySelector('[part="expanded-row"]')) == null).to.be.true;
  });

  it('honors a vetoed lr-row-expand-request under a self-managed mode, leaving expandedRowKeys untouched', async () => {
    const el = (await fixture(html`<lr-table expansion-mode="multiple"></lr-table>`)) as LyraTable<Row>;
    el.columns = expandableColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.expandedContent = (r) => html`<p>${r.name} details</p>`;
    await el.updateComplete;

    let toggles = 0;
    el.addEventListener('lr-row-expand-request', (event) => {
      expect((event as CustomEvent).detail).to.deep.equal({ row: rows[0], rowKey: 'a', expanded: true });
      expect(event.cancelable).to.equal(true);
      event.preventDefault();
    });
    el.addEventListener('lr-row-expand-toggle', () => toggles++);

    const firstToggleButton = el.shadowRoot!.querySelector('[part="expand-toggle-cell"] button') as HTMLButtonElement;
    firstToggleButton.click();
    await el.updateComplete;

    expect(el.expandedRowKeys.size, 'a vetoed request must not write expandedRowKeys').to.equal(0);
    expect(toggles, 'a vetoed request must not announce a commit either').to.equal(0);
    expect((el.shadowRoot!.querySelector('[part="expanded-row"]')) == null).to.be.true;
  });

  it('keeps at most one row open under expansionMode="single", reporting the displaced row before the accepted one', async () => {
    const el = (await fixture(html`<lr-table expansion-mode="single"></lr-table>`)) as LyraTable<Row>;
    el.columns = expandableColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.expandedContent = (r) => html`<p>${r.name} details</p>`;
    await el.updateComplete;

    const [firstToggleButton, secondToggleButton] = [
      ...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="expand-toggle-cell"] button'),
    ];
    setTimeout(() => firstToggleButton!.click());
    await oneEvent(el, 'lr-row-expand-toggle');
    expect([...el.expandedRowKeys]).to.deep.equal(['a']);

    const details: Array<{ row: Row; rowKey: string; expanded: boolean }> = [];
    el.addEventListener('lr-row-expand-toggle', (event) => details.push((event as CustomEvent).detail));
    secondToggleButton!.click();
    await el.updateComplete;

    expect(details).to.deep.equal([
      { row: rows[0], rowKey: 'a', expanded: false },
      { row: rows[1], rowKey: 'b', expanded: true },
    ]);
    expect([...el.expandedRowKeys]).to.deep.equal(['b']);
  });

  it('coerces an already-larger expandedRowKeys down to its first key when expansionMode becomes "single"', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = expandableColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.expandedContent = (r) => html`<p>${r.name} details</p>`;
    el.expansionMode = 'multiple';
    el.expandedRowKeys = new Set(['a', 'b']);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="expanded-row"]').length).to.equal(2);

    el.expansionMode = 'single';
    await el.updateComplete;

    expect([...el.expandedRowKeys]).to.deep.equal(['a']);
    expect(el.shadowRoot!.querySelectorAll('[part="expanded-row"]').length).to.equal(1);
  });
});

describe('rowElement / cellElement / expandedContentElement', () => {
  it('resolves the rendered row and cell for a present (rowKey, columnKey) pair after updateComplete', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;

    const row = el.rowElement('a');
    expect(row !== null, 'a rendered row resolves').to.equal(true);
    expect(row?.getAttribute('part')).to.equal('row');
    const cell = el.cellElement('a', 'name');
    expect(cell !== null, 'a rendered cell resolves').to.equal(true);
    expect(cell?.textContent?.trim()).to.equal('Alpha');
  });

  it('returns null for a rowKey never present, and for a columnKey not in columns', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;

    expect(el.rowElement('never-existed') === null, 'an unknown rowKey resolves to null').to.equal(
      true
    );
    expect(
      el.cellElement('a', 'never-a-column') === null,
      'an unknown columnKey resolves to null'
    ).to.equal(true);
  });

  it('returns null for a rowKey paginated away, resolving once its page is shown', async () => {
    const el = (await fixture(html`<lr-table page-size="1" page="1"></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    expect(el.rowElement('a') !== null, 'row a is on page 1').to.equal(true);
    expect(el.rowElement('b') === null, 'row b is paginated away on page 1').to.equal(true);

    el.page = 2;
    await el.updateComplete;
    expect(el.rowElement('b') !== null, 'row b is shown once its page is current').to.equal(true);
    expect(el.rowElement('a') === null, 'row a is now paginated away').to.equal(true);
  });

  it('returns null for a rowKey filtered out by filterText, resolving once the filter clears', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.filterText = 'Alpha';
    await el.updateComplete;
    expect(el.rowElement('a') !== null, 'row a matches the filter').to.equal(true);
    expect(el.rowElement('b') === null, 'row b is filtered out').to.equal(true);

    el.filterText = '';
    await el.updateComplete;
    expect(el.rowElement('b') !== null, 'row b is shown again once the filter clears').to.equal(
      true
    );
  });

  it('resolves the correct row/cell by walking rather than interpolating a consumer-supplied key unsafe for a CSS selector', async () => {
    const unsafeRows: Row[] = [
      { id: 'safe', name: 'Safe', score: 1 },
      { id: '"][data-row-key="safe', name: 'Unsafe', score: 2 },
    ];
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = unsafeRows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;

    const unsafeCell = el.cellElement('"][data-row-key="safe', 'name');
    expect(unsafeCell !== null, 'the unsafe key still resolves its own row').to.equal(true);
    expect(unsafeCell?.textContent?.trim()).to.equal('Unsafe');
    expect(el.cellElement('safe', 'name')?.textContent?.trim()).to.equal('Safe');
  });

  it('resolves the expanded panel only while the row is actually expanded, and null otherwise', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.expandedContent = (r) => html`<p>${r.name} details</p>`;
    await el.updateComplete;
    expect(el.expandedContentElement('a') === null, 'not expanded yet').to.equal(true);

    el.expandedRowKeys = new Set(['a']);
    await el.updateComplete;
    const panel = el.expandedContentElement('a');
    expect(panel !== null, 'the expanded panel resolves').to.equal(true);
    expect(panel?.getAttribute('part')).to.equal('expanded-cell');
    expect(panel?.textContent?.trim()).to.equal('Alpha details');

    // rowElement deliberately does not reach the expanded panel -- it is a sibling <tr>, not a
    // descendant of the data row.
    expect(
      el.rowElement('a')?.querySelector('[part="expanded-cell"]') === null,
      'the expanded panel is not nested inside the data row'
    ).to.equal(true);

    el.expandedRowKeys = new Set();
    await el.updateComplete;
    expect(el.expandedContentElement('a') === null, 'null again once collapsed').to.equal(true);
  });
});

describe('rowTotal / grandTotal', () => {
  const totalsColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', cell: (r) => r.name },
    {
      key: 'score',
      label: 'Score',
      align: 'end',
      footer: (rs) => rs.reduce((sum, r) => sum + r.score, 0),
      cell: (r) => r.score,
    },
  ];

  it('renders no trailing column when rowTotal is unset (unchanged default)', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="row-total-cell"]')) == null).to.be.true;
    expect((el.shadowRoot!.querySelector('[data-row-total]')) == null).to.be.true;
  });

  it('renders a trailing row-total cell on the header and every row when rowTotal is set', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.rowTotal = (r) => r.score * 2;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-row-total]')).to.exist;
    const cells = [...el.shadowRoot!.querySelectorAll('[part="row-total-cell"]')];
    expect(cells.length).to.equal(rows.length);
    expect(cells[0]!.textContent!.trim()).to.equal('6'); // Alpha score 3 * 2
    expect(cells[1]!.textContent!.trim()).to.equal('2'); // Beta score 1 * 2
  });

  it('renders grandTotal in the footer row only when a column also defines footer', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = totalsColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.rowTotal = (r) => r.score;
    el.grandTotal = (rs) => rs.reduce((sum, r) => sum + r.score, 0);
    await el.updateComplete;
    const foot = el.shadowRoot!.querySelector('[part="foot"]');
    expect(foot != null).to.equal(true);
    const footerCells = [...foot!.querySelectorAll('[part="footer-cell"]')];
    expect(footerCells[footerCells.length - 1]!.textContent!.trim()).to.equal('4'); // 3 + 1
  });

  it('renders an empty grand-total cell (not "undefined") when rowTotal/footer are set but grandTotal is not', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = totalsColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.rowTotal = (r) => r.score;
    // grandTotal deliberately left unset.
    await el.updateComplete;
    const foot = el.shadowRoot!.querySelector('[part="foot"]');
    expect(foot != null).to.equal(true);
    const footerCells = [...foot!.querySelectorAll('[part="footer-cell"]')];
    expect(footerCells[footerCells.length - 1]!.textContent!.trim()).to.equal('');
  });

  it('aligns the grand-total footer cell with the end-aligned row-total column', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = totalsColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.rowTotal = (r) => r.score;
    el.grandTotal = (rs) => rs.reduce((sum, r) => sum + r.score, 0);
    await el.updateComplete;
    const foot = el.shadowRoot!.querySelector('[part="foot"]');
    const footerCells = [...foot!.querySelectorAll('[part="footer-cell"]')] as HTMLElement[];
    const grandTotalCell = footerCells[footerCells.length - 1]!;
    // `[part='row-total-cell']` is unconditionally end-aligned (table.styles.ts); its footer-row
    // counterpart needs the matching `data-align="end"` or the grand total renders start-aligned,
    // misaligned against every row's total above it.
    expect(grandTotalCell.getAttribute('data-align')).to.equal('end');
  });

  it('renders no footer row at all when grandTotal is set but no column defines footer', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = columns; // no column has `footer`
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.rowTotal = (r) => r.score;
    el.grandTotal = (rs) => rs.reduce((sum, r) => sum + r.score, 0);
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="foot"]')) == null).to.be.true;
  });

  it('extends the expanded-row and group-row colspan to include the new trailing column', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.rowTotal = (r) => r.score;
    el.expandedContent = (r) => html`<p>${r.name} details</p>`;
    el.expandedRowKeys = new Set(['a']);
    await el.updateComplete;
    const expandedCell = el.shadowRoot!.querySelector('[part="expanded-cell"]') as HTMLElement;
    // 2 data columns + 1 leading expand-toggle column + 1 trailing row-total column
    expect(expandedCell.getAttribute('colspan')).to.equal('4');
  });
});

describe('--lr-table-row-selected-bg', () => {
  const selectionFixture = async (): Promise<LyraTable<Row>> => {
    const el = (await fixture(html`<lr-table selection-mode="single"></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.selectedRowKeys = new Set(['a']);
    await el.updateComplete;
    return el;
  };

  it('recolors only the selected row', async () => {
    const el = await selectionFixture();
    el.style.setProperty('--lr-table-row-selected-bg', 'rgb(10, 20, 30)');
    const rowEls = [...el.shadowRoot!.querySelectorAll('[part="row"]')] as HTMLElement[];
    expect(rowEls[0]!.getAttribute('aria-selected')).to.equal('true');
    expect(getComputedStyle(rowEls[0]!).backgroundColor).to.equal('rgb(10, 20, 30)');
    expect(getComputedStyle(rowEls[1]!).backgroundColor).to.not.equal('rgb(10, 20, 30)');
  });

  it('renders identically to the brand-quiet token when unset', async () => {
    const el = await selectionFixture();
    const selected = el.shadowRoot!.querySelector('[part="row"][aria-selected="true"]') as HTMLElement;
    const unset = getComputedStyle(selected).backgroundColor;
    el.style.setProperty('--lr-table-row-selected-bg', 'var(--lr-color-brand-quiet)');
    expect(getComputedStyle(selected).backgroundColor).to.equal(unset);
  });

  // [part='row']:active and [part='row'][aria-selected='true'] are both (0,2,0), so only source
  // order makes the pressed fill win -- and the selected row is precisely the one a user presses to
  // deselect. Nothing but a rendered assertion catches a reordering of those two rules.
  it('shows a pressed fill on an already-selected row', async () => {
    const el = await selectionFixture();
    const selected = el.shadowRoot!.querySelector('[part="row"][aria-selected="true"]') as HTMLElement;
    const resting = getComputedStyle(selected).backgroundColor;
    try {
      // The press only means anything once the pointer is provably on the row: `sendMouse`
      // resolves when the synthesized command completes, not when the engine has processed the
      // pointer event, so a `down` sent straight after a single move can land on nothing.
      // `hoverUntilMatched` scrolls the row into view, re-reads its rect and re-dispatches until
      // `:hover` actually matches.
      await hoverUntilMatched(selected, 'the selected row never took the pointer');
      await sendMouse({ type: 'down' });
      await waitUntil(() => getComputedStyle(selected).backgroundColor !== resting, 'selected background color never moved off resting');
    } finally {
      await sendMouse({ type: 'up' });
      await resetMouse();
    }
  });

  // [part='row']:hover and [part='row'][aria-selected='true'] are both (0,2,0), so only source
  // order decides which one wins -- and until now that was the selected rule, making a hover on an
  // already-selected row a visual no-op. Rendered assertion only: the selector is exactly the kind
  // of thing that reads correct and matches nothing.
  it('shows a hover fill on an already-selected row, distinct from the resting selected fill', async () => {
    const el = await selectionFixture();
    const selected = el.shadowRoot!.querySelector('[part="row"][aria-selected="true"]') as HTMLElement;
    const resting = getComputedStyle(selected).backgroundColor;
    try {
      // Landed with `hoverUntilMatched` so the poll below waits on the fill, never on a hover the
      // engine never processed from a single already-dispatched move.
      await hoverUntilMatched(selected, 'the selected row never took the pointer');
      await waitUntil(() => getComputedStyle(selected).backgroundColor !== resting, 'already-selected row hover fill never landed');
    } finally {
      await resetMouse();
    }
  });

  it('keeps selected, ordinary, and hovered rows distinguishable in forced-colors mode', async () => {
    await setForcedColors('active');
    try {
      const el = await selectionFixture();
      const rowEls = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="row"]')];
      const selected = rowEls[0]!;
      const ordinary = rowEls[1]!;
      expect(getComputedStyle(selected).outlineStyle).to.equal('solid');
      expect(getComputedStyle(ordinary).outlineStyle).to.equal('none');

      try {
        // Forced colors changes nothing about the pointer race: a single move resolves before the
        // engine has necessarily processed the pointer event, so land the hover first.
        await hoverUntilMatched(ordinary, 'the ordinary row never took the pointer');
        await waitUntil(() => getComputedStyle(ordinary).outlineStyle === 'dashed');
        expect(getComputedStyle(selected).outlineStyle).to.equal('solid');
        expect(getComputedStyle(selected).outlineWidth).to.not.equal(getComputedStyle(ordinary).outlineWidth);
      } finally {
        await resetMouse();
      }
    } finally {
      await setForcedColors('none');
    }
  });
});

it('renders the row-expand-toggle hover treatment shared by the sibling icon controls', async () => {
  const el = (await fixture(html`
    <lr-table style="--lr-color-brand-quiet: rgb(1, 2, 3)"></lr-table>
  `)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (row) => row.id;
  el.expandedContent = (row) => html`<p>${row.name} details</p>`;
  await el.updateComplete;
  const toggle = el.shadowRoot!.querySelector<HTMLElement>('[part="row-expand-toggle"]')!;
  try {
    // `hoverUntilMatched` does the scroll-into-view, re-reads the rect afterwards and re-dispatches
    // until `:hover` matches -- a single move computed from a pre-scroll rect can miss the toggle
    // entirely, and `sendMouse` resolving never meant the engine processed the pointer event.
    await hoverUntilMatched(toggle, 'the row-expand toggle never took the pointer');
    await waitUntil(
      () => getComputedStyle(toggle).backgroundColor === 'rgb(1, 2, 3)',
      'the rendered row-expand-toggle hover background never appeared',
    );
  } finally {
    await resetMouse();
  }
});

it('skeleton rows keep column parity with expand toggles and row totals', async () => {
  const el = (await fixture(html`
    <lr-table
      aria-label="Scores"
      .columns=${columns}
      .rows=${rows}
      .expandedContent=${(row: Row) => html`<span>${row.name}</span>`}
      .rowTotal=${(row: Row) => row.score}
      loading
      loading-appearance="skeleton"
      skeleton-rows="3"
    ></lr-table>
  `)) as LyraTable<Row>;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="expand-toggle-cell"]').length).to.equal(3);
  expect(el.shadowRoot!.querySelectorAll('[part="row-total-cell"]').length).to.equal(3);
});

describe('row expand toggle accessible name', () => {
  const expandNameColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', cell: (r) => r.name },
  ];

  async function expandableTable(): Promise<LyraTable<Row>> {
    const el = (await fixture(html`<lr-table aria-label="People"></lr-table>`)) as LyraTable<Row>;
    el.columns = expandNameColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.expandedContent = (r) => html`<p>${r.name} details</p>`;
    await el.updateComplete;
    return el;
  }

  const toggleNames = (el: LyraTable<Row>): string[] =>
    [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="row-expand-toggle"]')].map(
      (button) => button.getAttribute('aria-label') ?? '',
    );

  it('shares one localized name across rows when rowExpandLabel is unset', async () => {
    const el = await expandableTable();
    const names = toggleNames(el);
    expect(names.length).to.equal(rows.length);
    expect(new Set(names).size, 'the default name carries no row context').to.equal(1);
    expect(names[0]).to.not.equal('');
  });

  it('names each row its own way when rowExpandLabel is set', async () => {
    const el = await expandableTable();
    el.rowExpandLabel = (row) => `Show details for ${row.name}`;
    await el.updateComplete;
    expect(toggleNames(el)).to.deep.equal([
      'Show details for Alpha',
      'Show details for Beta',
    ]);
  });

  it('passes the row expanded state so the name can describe the action', async () => {
    const el = await expandableTable();
    el.rowExpandLabel = (row, expanded) =>
      `${expanded ? 'Collapse' : 'Expand'} ${row.name}`;
    el.expandedRowKeys = new Set(['a']);
    await el.updateComplete;
    expect(toggleNames(el)).to.deep.equal(['Collapse Alpha', 'Expand Beta']);
  });
});
