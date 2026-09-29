import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './table.js';
import '../../forms/select/select.js';
import type { LyraTable, TableColumn } from './table.js';
import { styles } from './table.styles.js';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import { setForcedColors } from '../../../../test/wtr-media.js';
// Registers the real shipped `ar` catalog's `data` slice so the `lang="ar-EG"` resize-value
// test below (which only overrides `resizeValuePixels`) can render without tripping the
// dev-mode locale-fallback warning that strict-console platform lanes treat as fatal.
import '../../../translations/ar/data.js';
import { installTableTestHooks, type Row, columns, editableColumns, rows } from '../../../../test/table.js';
installTableTestHooks();




it('reflects spellcheck=false when assigned as a property', async () => {
  const el = (await fixture(html`<lr-table filterable></lr-table>`)) as LyraTable<Row>;
  el.spellcheck = false;
  await el.updateComplete;
  const property = (
    el.constructor as unknown as {
      elementProperties: Map<string, { converter?: { toAttribute?: (value: boolean) => string | null } }>;
    }
  ).elementProperties.get('spellcheck');
  expect(property?.converter?.toAttribute?.(false)).to.equal('false');

  el.spellcheck = true;
  await el.updateComplete;
  expect(property?.converter?.toAttribute?.(true)).to.equal(null);
});

it('opens an editable cell on double-click and emits a typed edit intent', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = editableColumns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;

  const cell = el.shadowRoot!.querySelector('[part="row"] [part="cell"]') as HTMLElement;
  cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
  await el.updateComplete;
  const input = cell.querySelector('[part="cell-editor"]') as HTMLInputElement;
  expect(input != null).to.equal(true);
  input.value = 'Renamed';
  const eventPromise = oneEvent(el, 'lr-cell-edit');
  input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  const event = await eventPromise;

  expect(event.detail.columnKey).to.equal('name');
  expect(event.detail.value).to.equal('Renamed');
  expect(event.detail.row).to.deep.equal(rows[0]);
  await el.updateComplete;
  expect((el.shadowRoot!.querySelector('[part="cell-editor"]')) == null).to.be.true;
});

it('commits an inline edit with Enter', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = editableColumns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;

  const cell = el.shadowRoot!.querySelector('[part="row"] [part="cell"]') as HTMLElement;
  cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
  await el.updateComplete;
  const input = cell.querySelector('[part="cell-editor"]') as HTMLInputElement;
  input.value = 'Enter name';
  const eventPromise = oneEvent(el, 'lr-cell-edit');
  input.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      composed: true,
      cancelable: true,
    })
  );
  const event = await eventPromise;
  expect(event.detail.value).to.equal('Enter name');
  expect((el.shadowRoot!.querySelector('[part="cell-editor"]')) == null).to.be.true;
});

describe('keyboard entry into double-click cell editing (WCAG 2.1.1)', () => {
  /** The focus move on open (double-click/F2/Enter) and on close (commit/cancel) is deferred to a
   *  microtask inside `updated()` -- matching the double-click autofocus helper elsewhere in this
   *  file -- so a macrotask turn after `updateComplete` guarantees it has actually run. */
  const settle = async (el: LyraTable<Row>): Promise<void> => {
    await el.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 0));
  };

  it('opens the editor with F2 on a focused editable cell, commits with Enter, and returns focus to the cell', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = editableColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;

    const cell = el.shadowRoot!.querySelector('td[data-col-key="name"]') as HTMLElement;
    cell.focus();
    expect(el.shadowRoot!.activeElement === cell, 'the cell must actually be focused before F2').to.be.true;

    await sendKeys({ press: 'F2' });
    await settle(el);
    const input = cell.querySelector('[part="cell-editor"]') as HTMLInputElement | null;
    expect(input != null, 'F2 on a focused editable cell must open its editor').to.be.true;
    expect(el.shadowRoot!.activeElement === input, 'the opened editor must take focus').to.be.true;

    input!.value = 'Renamed';
    const eventPromise = oneEvent(el, 'lr-cell-edit');
    await sendKeys({ press: 'Enter' });
    const event = await eventPromise;
    expect(event.detail.value).to.equal('Renamed');

    await settle(el);
    expect(el.shadowRoot!.querySelectorAll('[part="cell-editor"]').length).to.equal(0);
    const restored = el.shadowRoot!.querySelector('td[data-col-key="name"]') as HTMLElement;
    expect(el.shadowRoot!.activeElement === restored, 'focus must return to the originating cell on commit').to.be
      .true;
  });

  it('opens the editor with Enter on a focused editable cell and cancels with Escape, restoring the prior value and focus', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = editableColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;

    const cell = el.shadowRoot!.querySelector('td[data-col-key="name"]') as HTMLElement;
    cell.focus();

    await sendKeys({ press: 'Enter' });
    await settle(el);
    const input = cell.querySelector('[part="cell-editor"]') as HTMLInputElement | null;
    expect(input != null, 'Enter on a focused editable cell must open its editor').to.be.true;

    input!.value = 'Should not commit';
    let emitted = false;
    el.addEventListener('lr-cell-edit', () => (emitted = true));
    await sendKeys({ press: 'Escape' });
    await settle(el);

    expect(emitted, 'Escape must not emit lr-cell-edit').to.be.false;
    expect(el.shadowRoot!.querySelectorAll('[part="cell-editor"]').length).to.equal(0);
    const restored = el.shadowRoot!.querySelector('td[data-col-key="name"]') as HTMLElement;
    expect(restored.textContent).to.contain('Alpha');
    expect(el.shadowRoot!.activeElement === restored, 'focus must return to the originating cell on cancel').to.be
      .true;
  });

  it('activates the row on Enter when focus is on the row itself, even with an editable column present', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = editableColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.selectionMode = 'single';
    await el.updateComplete;

    const row = el.shadowRoot!.querySelector('[part="row"]') as HTMLElement;
    row.focus();
    const clickPromise = oneEvent(el, 'lr-row-activate');
    await sendKeys({ press: 'Enter' });
    const event = await clickPromise;
    expect(event.detail.row).to.deep.equal(rows[0]);
    expect(
      el.shadowRoot!.querySelectorAll('[part="cell-editor"]').length,
      'Enter on the row itself must not open an editor'
    ).to.equal(0);
    expect([...el.selectedRowKeys]).to.deep.equal(['a']);
  });

  it('moves focus between the row and its editable cells with ArrowRight/ArrowLeft, without disturbing row navigation', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = editableColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;

    const row = el.shadowRoot!.querySelector('[part="row"]') as HTMLElement;
    const nameCell = el.shadowRoot!.querySelector('td[data-col-key="name"]') as HTMLElement;
    const scoreCell = el.shadowRoot!.querySelector('td[data-col-key="score"]') as HTMLElement;
    row.focus();

    await sendKeys({ press: 'ArrowRight' });
    expect(el.shadowRoot!.activeElement === nameCell, 'ArrowRight from the row enters the first editable cell').to.be
      .true;

    await sendKeys({ press: 'ArrowRight' });
    expect(el.shadowRoot!.activeElement === scoreCell, 'ArrowRight again moves to the next editable cell').to.be
      .true;

    await sendKeys({ press: 'ArrowLeft' });
    expect(el.shadowRoot!.activeElement === nameCell, 'ArrowLeft steps back to the previous editable cell').to.be
      .true;

    await sendKeys({ press: 'ArrowLeft' });
    expect(el.shadowRoot!.activeElement === row, 'ArrowLeft from the first editable cell returns focus to the row')
      .to.be.true;

    const bodyRows = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[data-row-key]')];
    await sendKeys({ press: 'ArrowDown' });
    expect(el.shadowRoot!.activeElement === bodyRows[1], 'ArrowDown still moves to the next row').to.be.true;
  });

  it('renders no tabindex or data-editable attribute on a body cell when no column declares editTrigger', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    const cell = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
    expect(cell.hasAttribute('tabindex')).to.be.false;
    expect(cell.hasAttribute('data-editable')).to.be.false;
  });

  it('passes axe with an editable cell open for editing', async () => {
    const el = (await fixture(html`<lr-table aria-label="Scores"></lr-table>`)) as LyraTable<Row>;
    el.columns = editableColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;

    const cell = el.shadowRoot!.querySelector('td[data-col-key="name"]') as HTMLElement;
    cell.focus();
    await sendKeys({ press: 'F2' });
    await settle(el);
    expect(
      el.shadowRoot!.querySelector('[part="cell-editor"]') != null,
      'the editor must actually be open before the axe check'
    ).to.be.true;
    await expect(el).to.be.accessible();
  });

  it('opens the always-on editor and moves focus into it via the public editCell method', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = [
      { key: 'name', label: 'Name', editTrigger: 'always', editValue: (r) => r.name },
      { key: 'score', label: 'Score', cell: (r) => r.score },
    ];
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;

    el.editCell('a', 'name');
    await settle(el);
    const editor = el.shadowRoot!.querySelector('td[data-col-key="name"] [part="cell-editor"]') as HTMLElement;
    expect(el.shadowRoot!.activeElement === editor, 'editCell() must focus the always-on editor').to.be.true;
  });

  it('opens a double-click editor via the public editCell method', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = editableColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;

    el.editCell('a', 'name');
    await settle(el);
    const editor = el.shadowRoot!.querySelector('td[data-col-key="name"] [part="cell-editor"]');
    expect(editor != null).to.be.true;
  });

  it('no-ops editCell for an unknown row, an unknown column, and a column with no editTrigger', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = [...editableColumns, { key: 'plain', label: 'Plain', cell: () => 'x' }];
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;

    el.editCell('does-not-exist', 'name');
    el.editCell('a', 'does-not-exist');
    el.editCell('a', 'plain');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="cell-editor"]').length).to.equal(0);
  });
});

it('shows a rendered hover affordance on the public cell editor', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = editableColumns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;

  const cell = el.shadowRoot!.querySelector('td[data-col-key="name"]') as HTMLElement;
  cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
  await el.updateComplete;
  const editor = el.shadowRoot!.querySelector('[part="cell-editor"]') as HTMLInputElement;
  const before = getComputedStyle(editor).backgroundColor;
  try {
    // Landed with `hoverUntilMatched` for the same reason as the filter control above: the move
    // command resolving is not proof the engine processed the pointer event it produced.
    await hoverUntilMatched(editor, 'the cell editor never took the pointer');
    await waitUntil(() => getComputedStyle(editor).backgroundColor !== before, 'cell editor hover fill never landed');
  } finally {
    await resetMouse();
  }
});

it('closes a transient editor when its same-key column becomes non-editable', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = editableColumns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;

  const cell = el.shadowRoot!.querySelector('td[data-col-key="name"]') as HTMLElement;
  cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="cell-editor"]')).to.have.lengthOf(1);

  el.columns = columns;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="cell-editor"]')).to.have.lengthOf(0);
});

it('does not restore a transient editor after its row disappears and later returns', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = editableColumns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;

  const cell = el.shadowRoot!.querySelector('td[data-col-key="name"]') as HTMLElement;
  cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="cell-editor"]')).to.have.lengthOf(1);

  el.rows = [rows[1]!];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="cell-editor"]')).to.have.lengthOf(0);

  el.rows = rows;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="cell-editor"]')).to.have.lengthOf(0);
});

it('clears editingCell (without emitting) instead of throwing when the transient edit target vanishes from rowsByKey before commit', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = editableColumns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;

  const cell = el.shadowRoot!.querySelector('td[data-col-key="name"]') as HTMLElement;
  cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('[part="cell-editor"]') as HTMLInputElement;
  expect(input != null).to.equal(true);

  // Simulate the row vanishing from the lookup map out of band -- with no reactive update in
  // between (so willUpdate() hasn't already cleared editingCell itself) -- the way it would if a
  // consumer mutated its own state without going through `rows`. commitEdit must still
  // gracefully no-op instead of emitting a stale lr-cell-edit for a row it can no longer resolve.
  (el as unknown as { rowsByKey: Map<string, unknown> }).rowsByKey.delete('string:a');
  let emitted = false;
  el.addEventListener('lr-cell-edit', () => (emitted = true));
  input.value = 'Changed';
  input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

  expect(emitted, 'no stale lr-cell-edit for an unresolvable row').to.be.false;
  expect((el as unknown as { editingCell: unknown }).editingCell).to.be.null;
});

it('forwards spellcheck/autocapitalize/autocorrect to the filter input', async () => {
  const el = (await fixture(html`
    <lr-table filterable spellcheck="false" autocapitalize="off" autocorrect="off"></lr-table>
  `)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;

  const input = el.shadowRoot!.querySelector('[part="filter"]') as HTMLInputElement;
  expect(input.spellcheck).to.be.false;
  expect(input.getAttribute('autocapitalize')).to.equal('off');
  expect(input.getAttribute('autocorrect')).to.equal('off');
});

it('defaults spellcheck to true on the filter input (matching the native element default)', async () => {
  const el = (await fixture(html`<lr-table filterable></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;

  const input = el.shadowRoot!.querySelector('[part="filter"]') as HTMLInputElement;
  expect(input.spellcheck).to.be.true;
  expect(input.hasAttribute('autocapitalize')).to.be.false;
  expect(input.hasAttribute('autocorrect')).to.be.false;
});

it('forwards spellcheck/autocapitalize/autocorrect to a text cell editor but not a number one', async () => {
  const el = (await fixture(html`
    <lr-table spellcheck="false" autocapitalize="off" autocorrect="off"></lr-table>
  `)) as LyraTable<Row>;
  el.columns = editableColumns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;

  const cells = [...el.shadowRoot!.querySelectorAll('[part="row"] [part="cell"]')] as HTMLElement[];

  cells[0]!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
  await el.updateComplete;
  const textInput = cells[0]!.querySelector('[part="cell-editor"]') as HTMLInputElement;
  expect(textInput.spellcheck).to.be.false;
  expect(textInput.getAttribute('autocapitalize')).to.equal('off');
  expect(textInput.getAttribute('autocorrect')).to.equal('off');
  textInput.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      composed: true,
    })
  );
  await el.updateComplete;

  cells[1]!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
  await el.updateComplete;
  const numberInput = cells[1]!.querySelector('[part="cell-editor"]') as HTMLInputElement;
  expect(numberInput.hasAttribute('spellcheck')).to.be.false;
  expect(numberInput.hasAttribute('autocapitalize')).to.be.false;
  expect(numberInput.hasAttribute('autocorrect')).to.be.false;
});

it("resets the native number-spinner chrome on the cell editor (editType: 'number')", () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='cell-editor'\]\[type='number'\]\s*\{[^}]*appearance:\s*textfield/);
  expect(css).to.match(/\[part='cell-editor'\]\[type='number'\]::-webkit-inner-spin-button/);
  expect(css).to.match(/\[part='cell-editor'\]\[type='number'\]::-webkit-outer-spin-button/);
});

describe("editTrigger: 'always'", () => {
  const alwaysColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', sortable: true, cell: (r) => r.name },
    {
      key: 'score',
      label: 'Score',
      editTrigger: 'always',
      editType: 'number',
      editValue: (r) => r.score,
      cell: (r) => r.score,
    },
  ];

  const alwaysTable = async (columnsForTest = alwaysColumns, rowsForTest = rows): Promise<LyraTable<Row>> => {
    const el = (await fixture(html`<lr-table aria-label="Scores"></lr-table>`)) as LyraTable<Row>;
    el.columns = columnsForTest;
    el.rows = rowsForTest;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    return el;
  };

  it('renders one persistent editor per body row of that column, from first paint', async () => {
    const el = await alwaysTable();
    expect(el.shadowRoot!.querySelectorAll('[part="cell-editor"]')).to.have.lengthOf(2);
    expect(el.shadowRoot!.querySelectorAll('td[data-col-key="score"] [part="cell-editor"]')).to.have.lengthOf(2);
    expect(el.shadowRoot!.querySelectorAll('td[data-col-key="name"] [part="cell-editor"]')).to.have.lengthOf(0);
    const values = [...el.shadowRoot!.querySelectorAll<HTMLInputElement>('[part="cell-editor"]')].map(
      (input) => input.value
    );
    expect(values).to.deep.equal(['3', '1']);
  });

  it('falls back to the same tableEditCell name for every row in the column when editLabel is unset', async () => {
    const el = await alwaysTable();
    const labels = [...el.shadowRoot!.querySelectorAll('[part="cell-editor"]')].map((input) =>
      input.getAttribute('aria-label')
    );
    // Column-only naming: both rows' editors read identically -- this is the gap `editLabel` exists
    // to close (see the next test), not a claim that these controls are distinguishable.
    expect(labels).to.deep.equal(['Edit Score', 'Edit Score']);
  });

  it('names each persistent editor individually per row when the column defines editLabel', async () => {
    const el = await alwaysTable([
      { key: 'name', label: 'Name', sortable: true, cell: (r) => r.name },
      {
        key: 'score',
        label: 'Score',
        editTrigger: 'always',
        editType: 'number',
        editValue: (r) => r.score,
        editLabel: (r) => `Edit score for ${r.name}`,
        cell: (r) => r.score,
      },
    ]);
    const labels = [...el.shadowRoot!.querySelectorAll('[part="cell-editor"]')].map((input) =>
      input.getAttribute('aria-label')
    );
    expect(labels).to.deep.equal(['Edit score for Alpha', 'Edit score for Beta']);
  });

  it('lets editLabel override a localized tableEditCell default for persistent editors', async () => {
    const el = (await fixture(
      html`<lr-table aria-label="Scores" .strings=${{ tableEditCell: 'Modifier {column}' }}></lr-table>`
    )) as LyraTable<Row>;
    el.columns = [
      { key: 'name', label: 'Name', sortable: true, cell: (r) => r.name },
      {
        key: 'score',
        label: 'Score',
        editTrigger: 'always',
        editType: 'number',
        editValue: (r) => r.score,
        editLabel: (r) => `Score for ${r.name}`,
        cell: (r) => r.score,
      },
    ];
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    const labels = [...el.shadowRoot!.querySelectorAll('[part="cell-editor"]')].map((input) =>
      input.getAttribute('aria-label')
    );
    // Neither the localized `tableEditCell` template nor its `{column}` interpolation appears --
    // editLabel replaces the whole name, it doesn't feed into it.
    expect(labels).to.deep.equal(['Score for Alpha', 'Score for Beta']);
  });

  it('honors editType on a persistent editor', async () => {
    const el = await alwaysTable();
    const input = el.shadowRoot!.querySelector('[part="cell-editor"]') as HTMLInputElement;
    expect(input.type).to.equal('number');
  });

  it("leaves an editTrigger: 'double-click' column closed until double-click", async () => {
    const el = await alwaysTable([
      {
        key: 'name',
        label: 'Name',
        editTrigger: 'double-click',
        editValue: (r) => r.name,
        cell: (r) => r.name,
      },
    ]);
    expect(el.shadowRoot!.querySelectorAll('[part="cell-editor"]')).to.have.lengthOf(0);
    const cell = el.shadowRoot!.querySelector('[part="row"] [part="cell"]') as HTMLElement;
    cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="cell-editor"]')).to.have.lengthOf(1);
  });

  it('does not open a second, double-click editor on an always-on cell', async () => {
    const el = await alwaysTable();
    const cell = el.shadowRoot!.querySelector('td[data-col-key="score"]') as HTMLElement;
    cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="cell-editor"]')).to.have.lengthOf(2);
    expect(cell.querySelectorAll('[part="cell-editor"]')).to.have.lengthOf(1);
  });

  it('gives persistent editors no tabindex attribute, exactly like the row-expand toggle', async () => {
    const el = await alwaysTable();
    const editors = [...el.shadowRoot!.querySelectorAll('[part="cell-editor"]')];
    expect(editors.filter((input) => input.hasAttribute('tabindex'))).to.have.lengthOf(0);
    // The roving model itself is untouched: the row keeps the tab stop, the cell stays unfocusable.
    const firstRow = el.shadowRoot!.querySelector('[part="row"]') as HTMLElement;
    expect(firstRow.getAttribute('tabindex')).to.equal('0');
    expect((el.shadowRoot!.querySelector('td[data-col-key="score"]') as HTMLElement).hasAttribute('tabindex')).to.be
      .false;
  });

  it('keeps a draft in a persistent editor when an unrelated row is updated in rows', async () => {
    const el = await alwaysTable();
    const input = el.shadowRoot!.querySelector('td[data-col-key="score"] [part="cell-editor"]') as HTMLInputElement;
    input.value = '99';
    el.rows = [rows[0]!, { ...rows[1]!, score: 7 }];
    await el.updateComplete;
    const after = el.shadowRoot!.querySelector('td[data-col-key="score"] [part="cell-editor"]') as HTMLInputElement;
    expect(after.value).to.equal('99');
  });

  it("keeps a draft in a persistent editor when that same cell's own value is updated out of band", async () => {
    const el = await alwaysTable();
    const input = el.shadowRoot!.querySelector('td[data-col-key="score"] [part="cell-editor"]') as HTMLInputElement;
    input.value = '99';
    el.rows = [{ ...rows[0]!, score: 7 }, rows[1]!];
    await el.updateComplete;
    const after = el.shadowRoot!.querySelector('td[data-col-key="score"] [part="cell-editor"]') as HTMLInputElement;
    expect(after.value).to.equal('99');
  });

  it('still picks up a new rows value in a persistent editor the user has not touched', async () => {
    const el = await alwaysTable();
    el.rows = [{ ...rows[0]!, score: 7 }, rows[1]!];
    await el.updateComplete;
    const after = el.shadowRoot!.querySelector('td[data-col-key="score"] [part="cell-editor"]') as HTMLInputElement;
    expect(after.value).to.equal('7');
  });

  it('keeps re-asserting the source value in a double-click editor (unchanged property binding)', async () => {
    const el = await alwaysTable([
      {
        key: 'name',
        label: 'Name',
        editTrigger: 'double-click',
        editValue: (r) => r.name,
        cell: (r) => r.name,
      },
    ]);
    const cell = el.shadowRoot!.querySelector('[part="row"] [part="cell"]') as HTMLElement;
    cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await el.updateComplete;
    const input = cell.querySelector('[part="cell-editor"]') as HTMLInputElement;
    expect(input.value).to.equal('Alpha');
    // A property binding, not an attribute one -- so no `value` content attribute is written.
    expect(input.hasAttribute('value')).to.be.false;
  });

  /** `"<encoded row key>/<column key>"` of the persistent editor that currently has focus, or
   *  `null` when focus is anywhere else. Deliberately a string, not the element itself: a failing
   *  assertion whose `actual` is a DOM node hangs the whole test file. */
  const focusedEditorCell = (el: LyraTable<Row>): string | null => {
    const active = el.shadowRoot!.activeElement as HTMLElement | null;
    if (!active || active.getAttribute('part') !== 'cell-editor') return null;
    const row = active.closest('[data-row-key]') as HTMLElement | null;
    const cell = active.closest('td[data-col-key]') as HTMLElement | null;
    return `${row?.dataset['rowKey']}/${cell?.dataset['colKey']}`;
  };

  it('keeps focus in the same logical cell when the rows are re-sorted underneath it', async () => {
    // Three rows, fully reversed: `repeat()` is keyed by row key, so this *moves* the focused
    // <input> node rather than recreating it -- and a DOM move drops focus on its own.
    const sortRows: Row[] = [...rows, { id: 'c', name: 'Gamma', score: 2 }];
    const el = await alwaysTable(alwaysColumns, sortRows);
    const editors = [...el.shadowRoot!.querySelectorAll<HTMLInputElement>('[part="cell-editor"]')];
    editors[1]!.focus();
    expect(focusedEditorCell(el)).to.equal('string:b/score');

    el.rows = [sortRows[2]!, sortRows[1]!, sortRows[0]!];
    await el.updateComplete;
    expect(focusedEditorCell(el)).to.equal('string:b/score');
    // The typed value rides along with the moved node, unaffected by the restore.
    expect((el.shadowRoot!.activeElement as HTMLInputElement).value).to.equal('1');
  });

  it('does not yank focus to an unrelated row when the focused row paginates away', async () => {
    const el = (await fixture(html`<lr-table page-size="1"></lr-table>`)) as LyraTable<Row>;
    el.columns = alwaysColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;

    const editor = el.shadowRoot!.querySelector('[part="cell-editor"]') as HTMLInputElement;
    editor.focus();
    expect(focusedEditorCell(el)).to.equal('string:a/score');

    el.page = 2;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="row"]')).to.have.lengthOf(1);
    expect(focusedEditorCell(el)).to.equal(null);
  });

  it('does not pull focus back into an editor the user has already left for another cell', async () => {
    const sortRows: Row[] = [...rows, { id: 'c', name: 'Gamma', score: 2 }];
    const el = await alwaysTable(alwaysColumns, sortRows);
    (el.shadowRoot!.querySelector('[part="cell-editor"]') as HTMLInputElement).focus();
    const header = el.shadowRoot!.querySelector('[part="header-cell"]') as HTMLElement;
    header.focus();

    el.rows = [sortRows[2]!, sortRows[1]!, sortRows[0]!];
    await el.updateComplete;
    expect(focusedEditorCell(el)).to.equal(null);
    expect((el.shadowRoot!.activeElement as HTMLElement | null)?.getAttribute('part')).to.equal('header-cell');
  });

  it('does not pull focus back into an editor the user has already left the table from', async () => {
    const sortRows: Row[] = [...rows, { id: 'c', name: 'Gamma', score: 2 }];
    const el = await alwaysTable(alwaysColumns, sortRows);
    const editor = el.shadowRoot!.querySelector('[part="cell-editor"]') as HTMLInputElement;
    editor.focus();
    editor.blur();
    expect(focusedEditorCell(el)).to.equal(null);

    el.rows = [sortRows[2]!, sortRows[1]!, sortRows[0]!];
    await el.updateComplete;
    expect(focusedEditorCell(el)).to.equal(null);
  });

  /** The double-click autofocus is deferred to a microtask inside `updated()`; a macrotask turn
   *  guarantees it has run. */
  const afterAutofocus = async (el: LyraTable<Row>): Promise<void> => {
    await el.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 0));
  };

  it('autofocuses the double-clicked cell, not the first always-on editor in the DOM', async () => {
    // The always-on column comes *first*, so an unqualified `[part="cell-editor"]` lookup would
    // land on row a's score editor instead of the cell that was actually double-clicked.
    const el = await alwaysTable([
      alwaysColumns[1]!,
      {
        key: 'name',
        label: 'Name',
        editTrigger: 'double-click',
        editValue: (r) => r.name,
        cell: (r) => r.name,
      },
    ]);
    const rowEls = [...el.shadowRoot!.querySelectorAll('[part="row"]')] as HTMLElement[];
    const target = rowEls[1]!.querySelector('td[data-col-key="name"]') as HTMLElement;
    target.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await afterAutofocus(el);
    expect(focusedEditorCell(el)).to.equal('string:b/name');
  });

  it('autofocuses the double-clicked cell when no always-on column exists (unchanged)', async () => {
    const el = await alwaysTable([
      {
        key: 'name',
        label: 'Name',
        editTrigger: 'double-click',
        editValue: (r) => r.name,
        cell: (r) => r.name,
      },
      { key: 'score', label: 'Score', cell: (r) => r.score },
    ]);
    const rowEls = [...el.shadowRoot!.querySelectorAll('[part="row"]')] as HTMLElement[];
    const target = rowEls[1]!.querySelector('td[data-col-key="name"]') as HTMLElement;
    target.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await afterAutofocus(el);
    expect(focusedEditorCell(el)).to.equal('string:b/name');
  });

  it('commits a persistent editor through change, emitting the typed value', async () => {
    const el = await alwaysTable();
    const input = el.shadowRoot!.querySelector('[part="cell-editor"]') as HTMLInputElement;
    input.value = '42';
    const eventPromise = oneEvent(el, 'lr-cell-edit');
    input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    const event = await eventPromise;
    expect(event.detail.columnKey).to.equal('score');
    expect(event.detail.value).to.equal(42);
    expect(event.detail.row).to.deep.equal(rows[0]);
    await el.updateComplete;
    // Nothing to close: the editor is still there afterwards.
    expect(el.shadowRoot!.querySelectorAll('[part="cell-editor"]')).to.have.lengthOf(2);
  });

  it('commits a persistent editor with Enter and keeps focus in the field', async () => {
    const el = await alwaysTable();
    const input = el.shadowRoot!.querySelector('[part="cell-editor"]') as HTMLInputElement;
    input.focus();
    input.value = '42';
    const eventPromise = oneEvent(el, 'lr-cell-edit');
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
    const event = await eventPromise;
    expect(event.detail.value).to.equal(42);
    await el.updateComplete;
    // There is no closed state to fall back to, so the editor stays open and keeps focus.
    expect(el.shadowRoot!.querySelectorAll('[part="cell-editor"]')).to.have.lengthOf(2);
    expect(focusedEditorCell(el)).to.equal('string:a/score');
  });

  it('leaves Escape uncancelled on a persistent editor, so an ancestor still sees it', async () => {
    const el = await alwaysTable();
    const input = el.shadowRoot!.querySelector('[part="cell-editor"]') as HTMLInputElement;
    input.focus();
    const notPrevented = input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    expect(notPrevented).to.be.true;
    // Nothing to cancel back to: the editor is unchanged and still focused.
    expect(el.shadowRoot!.querySelectorAll('[part="cell-editor"]')).to.have.lengthOf(2);
    expect(focusedEditorCell(el)).to.equal('string:a/score');
  });

  it('still cancels Escape on a double-click editor and closes it (regression)', async () => {
    const el = await alwaysTable([
      {
        key: 'name',
        label: 'Name',
        editTrigger: 'double-click',
        editValue: (r) => r.name,
        cell: (r) => r.name,
      },
    ]);
    const cell = el.shadowRoot!.querySelector('[part="row"] [part="cell"]') as HTMLElement;
    cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await el.updateComplete;
    const input = cell.querySelector('[part="cell-editor"]') as HTMLInputElement;
    const notPrevented = input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    expect(notPrevented).to.be.false;
    expect(el.shadowRoot!.querySelectorAll('[part="cell-editor"]')).to.have.lengthOf(0);
  });

  it('leaves arrow keys inside a persistent editor to the caret, not the grid', async () => {
    const el = await alwaysTable();
    const input = el.shadowRoot!.querySelector('[part="cell-editor"]') as HTMLInputElement;
    input.focus();
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        composed: true,
      })
    );
    await el.updateComplete;
    expect(focusedEditorCell(el)).to.equal('string:a/score');
  });

  it('does not activate the row when Enter is pressed inside a persistent editor', async () => {
    const el = await alwaysTable();
    let rowClicked = false;
    el.addEventListener('lr-row-activate', () => (rowClicked = true));
    const input = el.shadowRoot!.querySelector('[part="cell-editor"]') as HTMLInputElement;
    input.focus();
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    expect(rowClicked).to.be.false;
  });

  it('leaves roving header and row navigation untouched with an always-on column present', async () => {
    const el = await alwaysTable();
    const [nameHeader, scoreHeader] = [...el.shadowRoot!.querySelectorAll('[part="header-cell"]')] as [HTMLElement, HTMLElement];
    const [firstRow, secondRow] = [...el.shadowRoot!.querySelectorAll('[part="row"]')] as [HTMLElement, HTMLElement];

    nameHeader.focus();
    nameHeader.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement?.getAttribute('data-col-key')).to.equal('score');
    expect(scoreHeader.getAttribute('tabindex')).to.equal('0');

    scoreHeader.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement?.getAttribute('data-row-key')).to.equal('string:a');

    firstRow.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement?.getAttribute('data-row-key')).to.equal('string:b');
    expect(secondRow.getAttribute('tabindex')).to.equal('0');
    expect(firstRow.getAttribute('tabindex')).to.equal('-1');

    secondRow.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement?.getAttribute('data-row-key')).to.equal('string:a');

    firstRow.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement?.getAttribute('data-col-key')).to.equal('score');
  });

  it('still activates a row clicked in a non-editable column', async () => {
    const el = await alwaysTable();
    let clickedName: string | undefined;
    el.addEventListener('lr-row-activate', (event) => {
      clickedName = (event as CustomEvent<{ row: Row }>).detail.row.name;
    });
    const nameCell = el.shadowRoot!.querySelector('td[data-col-key="name"]') as HTMLElement;
    nameCell.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(clickedName).to.equal('Alpha');
  });

  it('is accessible with a column of persistent editors rendered', async () => {
    const el = await alwaysTable();
    expect(el.shadowRoot!.querySelectorAll('[part="cell-editor"]')).to.have.lengthOf(2);
    await expect(el).to.be.accessible();
  });

  it('localizes every persistent editor through a strings override', async () => {
    const el = (await fixture(
      html`<lr-table aria-label="Scores" .strings=${{ tableEditCell: 'Modifier {column}' }}></lr-table>`
    )) as LyraTable<Row>;
    el.columns = alwaysColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    const labels = [...el.shadowRoot!.querySelectorAll('[part="cell-editor"]')].map((input) =>
      input.getAttribute('aria-label')
    );
    expect(labels).to.deep.equal(['Modifier Score', 'Modifier Score']);
  });
});

describe("editType: 'select'", () => {
  const selectEditableColumns: TableColumn<Row>[] = [
    {
      key: 'name',
      label: 'Name',
      editTrigger: 'double-click',
      editType: 'select',
      editOptions: [
        { value: 'Alpha', label: 'Alpha' },
        { value: 'Beta', label: 'Beta' },
        { value: 'Gamma', label: 'Gamma' },
      ],
      editValue: (r) => r.name,
      cell: (r) => r.name,
    },
  ];

  const selectTable = async (
    columnsForTest = selectEditableColumns,
    rowsForTest = rows
  ): Promise<LyraTable<Row>> => {
    const el = (await fixture(html`<lr-table aria-label="People"></lr-table>`)) as LyraTable<Row>;
    el.columns = columnsForTest;
    el.rows = rowsForTest;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    return el;
  };

  it('renders the resting cell as plain text with no control mounted (performance contract)', async () => {
    const manyRows: Row[] = Array.from({ length: 5 }, (_, index) => ({
      id: `r${index}`,
      name: index % 2 === 0 ? 'Alpha' : 'Beta',
      score: index,
    }));
    const el = await selectTable(selectEditableColumns, manyRows);

    expect(el.shadowRoot!.querySelectorAll('select').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('input').length).to.equal(0);
    const cells = [...el.shadowRoot!.querySelectorAll('td[data-col-key="name"]')] as HTMLElement[];
    expect(cells.length).to.equal(5);
    expect(cells[0]!.textContent?.trim()).to.equal('Alpha');

    cells[0]!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('select[part="cell-editor"]').length).to.equal(1);
    expect(el.shadowRoot!.querySelectorAll('input[part="cell-editor"]').length).to.equal(0);
  });

  it('opens a select editor on double-click and not before', async () => {
    const el = await selectTable();
    const cell = el.shadowRoot!.querySelector('[part="row"] [part="cell"]') as HTMLElement;
    expect(cell.querySelector('select[part="cell-editor"]') == null).to.be.true;

    cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await el.updateComplete;
    const select = cell.querySelector('select[part="cell-editor"]') as HTMLSelectElement;
    expect(select.tagName).to.equal('SELECT');
    expect(select.value).to.equal('Alpha');
  });

  it('emits lr-cell-edit exactly once with the selected value when the select commits', async () => {
    const el = await selectTable();
    const cell = el.shadowRoot!.querySelector('[part="row"] [part="cell"]') as HTMLElement;
    cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await el.updateComplete;
    const select = cell.querySelector('select[part="cell-editor"]') as HTMLSelectElement;

    let edits = 0;
    el.addEventListener('lr-cell-edit', () => (edits += 1));
    const eventPromise = oneEvent(el, 'lr-cell-edit');
    select.value = 'Gamma';
    select.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    const event = await eventPromise;

    expect(event.detail.columnKey).to.equal('name');
    expect(event.detail.value).to.equal('Gamma');
    expect(event.detail.row).to.deep.equal(rows[0]);
    expect(edits).to.equal(1);
    await el.updateComplete;
    expect(cell.querySelector('select[part="cell-editor"]') == null).to.be.true;
  });

  it('cancels a select editor on Escape without emitting lr-cell-edit', async () => {
    const el = await selectTable();
    const cell = el.shadowRoot!.querySelector('[part="row"] [part="cell"]') as HTMLElement;
    cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await el.updateComplete;
    const select = cell.querySelector('select[part="cell-editor"]') as HTMLSelectElement;

    let emitted = false;
    el.addEventListener('lr-cell-edit', () => (emitted = true));
    const notPrevented = select.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, cancelable: true })
    );
    await el.updateComplete;

    expect(notPrevented).to.be.false;
    expect(emitted).to.be.false;
    expect(cell.querySelector('select[part="cell-editor"]') == null).to.be.true;
  });

  it('commits a select editor with Enter', async () => {
    const el = await selectTable();
    const cell = el.shadowRoot!.querySelector('[part="row"] [part="cell"]') as HTMLElement;
    cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await el.updateComplete;
    const select = cell.querySelector('select[part="cell-editor"]') as HTMLSelectElement;
    select.value = 'Beta';

    const eventPromise = oneEvent(el, 'lr-cell-edit');
    select.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true })
    );
    const event = await eventPromise;

    expect(event.detail.value).to.equal('Beta');
    await el.updateComplete;
    expect(cell.querySelector('select[part="cell-editor"]') == null).to.be.true;
  });

  it('moves focus into the select editor once it opens, so focus is never stranded', async () => {
    const el = await selectTable();
    const cell = el.shadowRoot!.querySelector('[part="row"] [part="cell"]') as HTMLElement;
    cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await el.updateComplete;
    const select = cell.querySelector('select[part="cell-editor"]') as HTMLSelectElement;
    await waitUntil(() => el.shadowRoot!.activeElement === select, 'focus never reached the select editor');
  });

  it('names the select editor through the tableEditCell key', async () => {
    const el = await selectTable();
    const cell = el.shadowRoot!.querySelector('[part="row"] [part="cell"]') as HTMLElement;
    cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await el.updateComplete;
    const select = cell.querySelector('select[part="cell-editor"]') as HTMLSelectElement;
    expect(select.getAttribute('aria-label')).to.equal('Edit Name');
  });

  it('names a select editor per row when the column defines editLabel', async () => {
    const perRowLabelColumns: TableColumn<Row>[] = [
      {
        key: 'name',
        label: 'Name',
        editTrigger: 'double-click',
        editType: 'select',
        editOptions: [
          { value: 'Alpha', label: 'Alpha' },
          { value: 'Beta', label: 'Beta' },
          { value: 'Gamma', label: 'Gamma' },
        ],
        editValue: (r) => r.name,
        editLabel: (r) => `Choose a name for ${r.id}`,
        cell: (r) => r.name,
      },
    ];
    const el = await selectTable(perRowLabelColumns);
    const cells = [...el.shadowRoot!.querySelectorAll('[part="row"] [part="cell"]')] as HTMLElement[];

    cells[0]!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(
      (cells[0]!.querySelector('select[part="cell-editor"]') as HTMLSelectElement).getAttribute('aria-label')
    ).to.equal('Choose a name for a');

    cells[1]!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(
      (cells[1]!.querySelector('select[part="cell-editor"]') as HTMLSelectElement).getAttribute('aria-label')
    ).to.equal('Choose a name for b');
  });

  it('degrades to an empty, valueless select instead of throwing when editOptions is omitted', async () => {
    const el = await selectTable([
      {
        key: 'name',
        label: 'Name',
        editTrigger: 'double-click',
        editType: 'select',
        editValue: (r) => r.name,
        cell: (r) => r.name,
      },
    ]);
    const cell = el.shadowRoot!.querySelector('[part="row"] [part="cell"]') as HTMLElement;
    cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await el.updateComplete;

    const select = cell.querySelector('select[part="cell-editor"]') as HTMLSelectElement;
    expect(select).to.not.equal(null);
    expect(select.options.length).to.equal(0);
    expect(select.value).to.equal('');
  });

  it('is accessible with a select cell editor open', async () => {
    const el = await selectTable();
    const cell = el.shadowRoot!.querySelector('[part="row"] [part="cell"]') as HTMLElement;
    cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('select[part="cell-editor"]').length).to.equal(1);
    await expect(el).to.be.accessible();
  });

  // `appearance: none` on the select cell-editor removed the native disclosure arrow with no
  // replacement, so an open select editor looked like a plain text field. A bare <select> is a
  // replaced form control -- it renders neither ::before/::after, nor could a `mask` apply
  // directly to it without clipping its own text -- so the glyph is painted on the enclosing
  // [part='cell'] instead, scoped with :has() to exactly the cell currently rendering a select
  // editor. Same mask + `background: currentColor` technique already shipped (and
  // forced-colors-verified) for the map attribution-toggle glyph in map.styles.ts.
  const withScoreColumn = (): TableColumn<Row>[] => [
    selectEditableColumns[0]!,
    {
      key: 'score',
      label: 'Score',
      editTrigger: 'double-click',
      editType: 'number',
      editValue: (r) => r.score,
      cell: (r) => r.score,
    },
  ];

  it('paints a themed disclosure chevron only on the cell hosting an open select editor', async () => {
    const el = await selectTable(withScoreColumn());
    const cells = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="row"] [part="cell"]')];
    const nameCell = cells[0]!;
    const scoreCell = cells[1]!;

    expect(getComputedStyle(nameCell, '::after').maskImage, 'a resting cell paints no chevron').to.equal('none');

    nameCell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await el.updateComplete;
    const glyph = getComputedStyle(nameCell, '::after');
    expect(glyph.maskImage, 'the open select editor cell paints a masked chevron').to.not.equal('none');
    expect(parseFloat(glyph.width), 'the chevron has a real rendered size').to.be.greaterThan(0);
    expect(glyph.backgroundColor, 'the glyph fill tracks its own token-driven color via currentColor').to.equal(
      glyph.color
    );

    // Opening the number editor closes the select editor (one open editor at a time) and must
    // never paint the same glyph on a plain numeric field.
    scoreCell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(getComputedStyle(nameCell, '::after').maskImage, 'the now-resting name cell paints no chevron').to.equal(
      'none'
    );
    expect(getComputedStyle(scoreCell, '::after').maskImage, 'a number editor cell paints no chevron').to.equal(
      'none'
    );
  });

  it('reserves inline-end padding on the select editor for the chevron without widening a text/number editor', async () => {
    const el = await selectTable(withScoreColumn());
    const cells = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="row"] [part="cell"]')];

    cells[0]!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await el.updateComplete;
    const select = cells[0]!.querySelector('select[part="cell-editor"]') as HTMLSelectElement;
    const selectPadding = parseFloat(getComputedStyle(select).paddingInlineEnd);

    cells[1]!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await el.updateComplete;
    const numberInput = cells[1]!.querySelector('input[part="cell-editor"]') as HTMLInputElement;
    const numberPadding = parseFloat(getComputedStyle(numberInput).paddingInlineEnd);

    expect(
      selectPadding,
      'the select reserves more inline-end space than a plain text/number editor, so its own value never runs under the glyph'
    ).to.be.greaterThan(numberPadding);
  });

  it('mirrors the chevron under dir="rtl" through a real logical inset, not a physical value', async () => {
    const ltr = await selectTable();
    const ltrCell = ltr.shadowRoot!.querySelector('[part="row"] [part="cell"]') as HTMLElement;
    ltrCell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await ltr.updateComplete;
    const ltrGlyph = getComputedStyle(ltrCell, '::after');

    const rtlEl = (await fixture(html`<lr-table dir="rtl" aria-label="People"></lr-table>`)) as LyraTable<Row>;
    rtlEl.columns = selectEditableColumns;
    rtlEl.rows = rows;
    rtlEl.rowKey = (r) => r.id;
    await rtlEl.updateComplete;
    const rtlCell = rtlEl.shadowRoot!.querySelector('[part="row"] [part="cell"]') as HTMLElement;
    rtlCell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await rtlEl.updateComplete;
    const rtlGlyph = getComputedStyle(rtlCell, '::after');

    // The authored offset is a logical property, so its own resolved value never changes with
    // direction...
    expect(rtlGlyph.insetInlineEnd).to.equal(ltrGlyph.insetInlineEnd);
    // ...while the physical side it resolves to underneath flips, proving the glyph actually moved
    // rather than merely reporting an unused logical alias. Chromium resolves BOTH physical inset
    // longhands to used-value pixel offsets on a positioned box (never 'auto'), so the mirror is
    // read from which side carries the small (near-edge) offset instead.
    expect(
      parseFloat(ltrGlyph.right),
      'ltr sits close to the right edge'
    ).to.be.lessThan(parseFloat(ltrGlyph.left));
    expect(
      parseFloat(rtlGlyph.left),
      'rtl sits close to the left edge instead'
    ).to.be.lessThan(parseFloat(rtlGlyph.right));
  });

  it('keeps the select editor chevron visible and self-consistent under forced-colors', async () => {
    if (!CSS.supports('forced-color-adjust', 'none')) return;
    await setForcedColors('active');
    try {
      if (matchMedia('(forced-colors: active)').matches) {
        const el = await selectTable();
        const cell = el.shadowRoot!.querySelector('[part="row"] [part="cell"]') as HTMLElement;
        cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
        await el.updateComplete;
        const glyph = getComputedStyle(cell, '::after');
        expect(glyph.maskImage, 'forced-colors must not strip the mask entirely').to.not.equal('none');
        expect(
          glyph.forcedColorAdjust,
          'forced-color-adjust: none is required to keep the custom mask/currentColor pairing alive'
        ).to.equal('none');
        expect(glyph.backgroundColor, 'the glyph fill still tracks its own forced system color').to.equal(
          glyph.color
        );
      }
    } finally {
      await setForcedColors('none');
    }
  });
});
