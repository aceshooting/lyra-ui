import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './table.js';
import '../../forms/select/select.js';
import type { LyraTable, TableColumn } from './table.js';
import { styles } from './table.styles.js';

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

it('renders header labels and a row per item, keyed by rowKey', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
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

it('resizes a resizable column through its native pointer handle and emits live widths', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = [
    { key: 'name', label: 'Name', width: '120px', minWidth: '80px', resizable: true, cell: (r) => r.name },
    columns[1]!,
  ];
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;

  const handle = el.shadowRoot!.querySelector('[part="resize-handle"]') as HTMLElement;
  expect(handle.getAttribute('aria-label')).to.equal('Resize Name column');
  // Synthetic PointerEvents do not carry a browser-owned pointer, so Firefox
  // rejects native pointer capture for this fixture. The gesture behavior is
  // exercised through the dispatched move/up events below.
  handle.setPointerCapture = () => {};
  handle.releasePointerCapture = () => {};
  let detail: { key: string; width: number } | undefined;
  el.addEventListener('lr-column-resize', (event) => (detail = (event as CustomEvent).detail));

  handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 100 }));
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 140 }));
  await el.updateComplete;
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 140 }));

  expect(detail?.key).to.equal('name');
  expect(detail?.width).to.be.greaterThan(80);
  expect((el.shadowRoot!.querySelector('col') as HTMLElement).style.inlineSize).to.equal(`${detail!.width}px`);
});

it('uses the themed minimum width when a resizable column has no explicit minimum', async () => {
  const el = (await fixture(
    html`<lr-table style="--lr-table-resize-min-width:90px"></lr-table>`,
  )) as LyraTable<Row>;
  el.columns = [{ key: 'name', label: 'Name', width: '120px', resizable: true, cell: (r) => r.name }];
  el.rows = rows;
  await el.updateComplete;

  const handle = el.shadowRoot!.querySelector('[part="resize-handle"]') as HTMLElement;
  handle.setPointerCapture = () => {};
  handle.releasePointerCapture = () => {};
  handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 2, clientX: 100 }));
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 2, clientX: -10000 }));

  expect((el as unknown as { resizedColumnWidths: Map<string, number> }).resizedColumnWidths.get('name')).to.equal(90);
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2, clientX: -10000 }));
});

it('resolves a rem-unit themed minimum width against the root font size', async () => {
  const el = (await fixture(
    html`<lr-table style="--lr-table-resize-min-width:5rem"></lr-table>`,
  )) as LyraTable<Row>;
  el.columns = [{ key: 'name', label: 'Name', width: '400px', resizable: true, cell: (r) => r.name }];
  el.rows = rows;
  await el.updateComplete;

  const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  const handle = el.shadowRoot!.querySelector('[part="resize-handle"]') as HTMLElement;
  handle.setPointerCapture = () => {};
  handle.releasePointerCapture = () => {};
  handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 3, clientX: 100 }));
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 3, clientX: -10000 }));

  expect((el as unknown as { resizedColumnWidths: Map<string, number> }).resizedColumnWidths.get('name')).to.equal(
    5 * rootFontSize,
  );
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 3, clientX: -10000 }));
});

it('resolves an em-unit themed minimum width against the table\'s own font size', async () => {
  const el = (await fixture(
    html`<lr-table style="--lr-table-resize-min-width:3em"></lr-table>`,
  )) as LyraTable<Row>;
  el.columns = [{ key: 'name', label: 'Name', width: '400px', resizable: true, cell: (r) => r.name }];
  el.rows = rows;
  await el.updateComplete;

  const ownFontSize = Number.parseFloat(getComputedStyle(el).fontSize);
  const handle = el.shadowRoot!.querySelector('[part="resize-handle"]') as HTMLElement;
  handle.setPointerCapture = () => {};
  handle.releasePointerCapture = () => {};
  handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 4, clientX: 100 }));
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 4, clientX: -10000 }));

  expect((el as unknown as { resizedColumnWidths: Map<string, number> }).resizedColumnWidths.get('name')).to.equal(
    3 * ownFontSize,
  );
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 4, clientX: -10000 }));
});

it('exposes focusable separator state and resizes by keyboard without sorting the header', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = [
    {
      key: 'name',
      label: 'Name',
      width: '120px',
      minWidth: '80px',
      maxWidth: '160px',
      resizable: true,
      sortable: true,
      cell: (row) => row.name,
    },
  ];
  el.rows = rows;
  await el.updateComplete;

  const handle = el.shadowRoot!.querySelector('[part="resize-handle"]') as HTMLElement;
  expect(handle.getAttribute('tabindex')).to.equal('0');
  expect(handle.getAttribute('role')).to.equal('separator');
  expect(handle.getAttribute('aria-valuemin')).to.equal('80');
  expect(handle.getAttribute('aria-valuenow')).to.equal('120');
  expect(handle.getAttribute('aria-valuemax')).to.equal('160');
  handle.focus();
  expect((el.shadowRoot!.activeElement as HTMLElement | null)?.getAttribute('part')).to.equal('resize-handle');

  const widths: number[] = [];
  el.addEventListener('lr-column-resize', (event) => widths.push(event.detail.width));
  const press = async (key: string, shiftKey = false): Promise<KeyboardEvent> => {
    const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, composed: true, cancelable: true });
    handle.dispatchEvent(event);
    await el.updateComplete;
    return event;
  };

  expect((await press('ArrowRight')).defaultPrevented).to.be.true;
  expect(handle.getAttribute('aria-valuenow')).to.equal('130');
  expect(el.sortKey).to.equal('');
  await press('ArrowLeft', true);
  expect(handle.getAttribute('aria-valuenow')).to.equal('80');
  await press('End');
  expect(handle.getAttribute('aria-valuenow')).to.equal('160');
  await press('Home');
  expect(handle.getAttribute('aria-valuenow')).to.equal('80');
  expect(widths).to.deep.equal([130, 80, 160, 80]);
});

it('mirrors resize ArrowLeft/ArrowRight under RTL and passes axe populated', async () => {
  const el = (await fixture(html`<lr-table dir="rtl"></lr-table>`)) as LyraTable<Row>;
  el.columns = [
    { key: 'name', label: 'Name', width: '120px', minWidth: '80px', resizable: true, cell: (row) => row.name },
  ];
  el.rows = rows;
  await el.updateComplete;
  const handle = el.shadowRoot!.querySelector('[part="resize-handle"]') as HTMLElement;

  handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(handle.getAttribute('aria-valuenow')).to.equal('110');
  handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(handle.getAttribute('aria-valuenow')).to.equal('120');
  await expect(el).to.be.accessible();
});

it('announces the rendered width when a resizable column has no pixel width', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = [{ key: 'name', label: 'Name', width: '12rem', resizable: true, cell: (row) => row.name }];
  el.rows = rows;
  await el.updateComplete;

  const header = el.shadowRoot!.querySelector('th[data-col-key="name"]') as HTMLElement;
  header.getBoundingClientRect = () => ({ width: 192 }) as DOMRect;
  el.requestUpdate();
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="resize-handle"]')!.getAttribute('aria-valuenow')).to.equal('192');
});

it('starts a keyboard resize from the live rendered width when a column has no pixel width yet', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = [{ key: 'name', label: 'Name', width: '12rem', resizable: true, cell: (row) => row.name }];
  el.rows = rows;
  await el.updateComplete;

  const header = el.shadowRoot!.querySelector('th[data-col-key="name"]') as HTMLElement;
  header.getBoundingClientRect = () => ({ width: 192 }) as DOMRect;
  const handle = el.shadowRoot!.querySelector('[part="resize-handle"]') as HTMLElement;
  handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  await el.updateComplete;

  // 192 (the live rendered width, not the 12rem CSS length nor minimumResizeWidth's fallback) + the 10px step.
  expect(handle.getAttribute('aria-valuenow')).to.equal('202');
});

it('reflects spellcheck=false when assigned as a property', async () => {
  const el = (await fixture(html`<lr-table filterable></lr-table>`)) as LyraTable<Row>;
  el.spellcheck = false;
  await el.updateComplete;
  const property = (el.constructor as typeof LyraTable & {
    elementProperties: Map<string, { converter?: { toAttribute?: (value: boolean) => string | null } }>;
  }).elementProperties.get('spellcheck');
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
  expect(input).to.exist;
  input.value = 'Renamed';
  const eventPromise = oneEvent(el, 'lr-cell-edit');
  input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  const event = await eventPromise;

  expect(event.detail.key).to.equal('name');
  expect(event.detail.value).to.equal('Renamed');
  expect(event.detail.row).to.deep.equal(rows[0]);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="cell-editor"]')).to.not.exist;
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
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true }));
  const event = await eventPromise;
  expect(event.detail.value).to.equal('Enter name');
  expect(el.shadowRoot!.querySelector('[part="cell-editor"]')).to.not.exist;
});

it('renders grouped row sections without making group headers focus stops', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
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

it('uses groupLabel to render custom group header content', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.groupBy = (r) => (r.score > 2 ? 'Passing' : 'Needs review');
  el.groupLabel = (key, groupedRows) => html`<strong>${key}:${groupedRows.length}</strong>`;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="group-cell"]')!.textContent).to.contain('Passing:1');
});

it('filters rows through the built-in filter field and emits the requested text', async () => {
  const el = (await fixture(html`<lr-table filterable></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;

  const input = el.shadowRoot!.querySelector('[part="filter"]') as HTMLInputElement;
  const eventPromise = oneEvent(el, 'lr-filter-change');
  input.value = 'beta';
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  const event = await eventPromise;
  await el.updateComplete;

  expect(event.detail).to.deep.equal({ text: 'beta' });
  expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(1);
  expect(el.shadowRoot!.querySelector('[part="row"]')!.textContent).to.contain('Beta');
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

  cells[0].dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
  await el.updateComplete;
  const textInput = cells[0].querySelector('[part="cell-editor"]') as HTMLInputElement;
  expect(textInput.spellcheck).to.be.false;
  expect(textInput.getAttribute('autocapitalize')).to.equal('off');
  expect(textInput.getAttribute('autocorrect')).to.equal('off');
  textInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
  await el.updateComplete;

  cells[1].dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
  await el.updateComplete;
  const numberInput = cells[1].querySelector('[part="cell-editor"]') as HTMLInputElement;
  expect(numberInput.hasAttribute('spellcheck')).to.be.false;
  expect(numberInput.hasAttribute('autocapitalize')).to.be.false;
  expect(numberInput.hasAttribute('autocorrect')).to.be.false;
});

it('filters without throwing over rows containing a circular reference or a BigInt', async () => {
  const cyclic: Record<string, unknown> = { id: 'c', name: 'Circular', score: 5n as unknown as number };
  cyclic.self = cyclic;
  const el = (await fixture(html`<lr-table filterable></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = [...rows, cyclic as unknown as Row];
  el.rowKey = (r) => r.id;
  await el.updateComplete;

  const input = el.shadowRoot!.querySelector('[part="filter"]') as HTMLInputElement;
  input.value = 'beta';
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  await el.updateComplete;

  expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(1);
  expect(el.shadowRoot!.querySelector('[part="row"]')!.textContent).to.contain('Beta');
});

it('does not throw when the default filter encounters a row with a throwing toJSON method', async () => {
  const hostile = { id: 'bad', name: 'Hostile', score: 0, toJSON: () => { throw new Error('nope'); } };
  const el = (await fixture(html`<lr-table filterable></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = [...rows, hostile as unknown as Row];
  await el.updateComplete;

  const input = el.shadowRoot!.querySelector('[part="filter"]') as HTMLInputElement;
  input.value = 'hostile';
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="row"]')).to.have.length(0);
});

it('paginates client-side rows and emits controlled page requests', async () => {
  const el = (await fixture(html`<lr-table page-size="1"></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(1);
  expect(el.shadowRoot!.querySelector('[part="row"]')!.textContent).to.contain('Alpha');

  const next = el.shadowRoot!.querySelector('lr-pagination')!.shadowRoot!.querySelector(
    '[part="next-button"]',
  ) as HTMLButtonElement;
  const eventPromise = oneEvent(el, 'lr-page-change');
  next.click();
  const event = await eventPromise;
  expect(event.detail).to.deep.equal({ page: 2 });
  expect(el.page).to.equal(1);

  el.page = 2;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="row"]')!.textContent).to.contain('Beta');
});

it('clamps an oversized or NaN page to a valid page instead of NaN/out-of-range', async () => {
  const el = (await fixture(html`<lr-table page-size="1"></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;

  el.page = 9999;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="row"]')!.textContent).to.contain('Beta'); // clamped to the last page

  el.page = NaN;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="row"]')!.textContent).to.contain('Alpha'); // falls back to the first page
});

it('treats a non-finite pageSize as "no pagination" (renders every row) instead of NaN math', async () => {
  const el = (await fixture(html`<lr-table page-size="1"></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(1);

  el.pageSize = NaN;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('lr-pagination')).to.not.exist;
  expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(2);
});

it('renders a localized busy state before rows while loading', async () => {
  const el = (await fixture(html`<lr-table loading></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="loading"] lr-spinner')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-busy')).to.equal('true');
  await expect(el).to.be.accessible();
});

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
  expect(event.detail.keys).to.deep.equal(['a']);
  expect(el.selectedKeys.has('a')).to.be.true;
  expect(row.getAttribute('aria-selected')).to.equal('true');
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
  expect(event.detail.keys).to.deep.equal(['a']);
  expect(el.selectedKey).to.equal('a');
});

it('emits lr-sort when a sortable header is clicked', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const header = el.shadowRoot!.querySelectorAll('[part="header-cell"]')[1] as HTMLElement;
  setTimeout(() => header.click());
  const ev = await oneEvent(el, 'lr-sort');
  expect(ev.detail.key).to.equal('score');
});

it('emits lr-row-click with the row data', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const row = el.shadowRoot!.querySelector('[part="row"]') as HTMLElement;
  setTimeout(() => row.click());
  const ev = await oneEvent(el, 'lr-row-click');
  expect(ev.detail.row).to.deep.equal(rows[0]);
});

it('renders lr-empty when rows is empty', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = [];
  el.emptyHeading = 'No matches';
  await el.updateComplete;
  const empty = el.shadowRoot!.querySelector('lr-empty');
  expect(empty).to.exist;
  expect(empty!.getAttribute('heading')).to.equal('No matches');
});

it('emits lr-load-more when the "load more" button is clicked', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.hasMore = true;
  await el.updateComplete;
  const btn = el.shadowRoot!.querySelector('[part="more-button"]') as HTMLElement;
  setTimeout(() => btn.click());
  await oneEvent(el, 'lr-load-more');
});

it('is accessible', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('has part="head" on the thead element', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const thead = el.shadowRoot!.querySelector('[part="head"]');
  expect(thead).to.exist;
  expect(thead!.tagName).to.equal('THEAD');
});

it('renders lr-empty when columns is empty, even with non-empty rows', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = [];
  el.rows = rows;
  await el.updateComplete;
  const empty = el.shadowRoot!.querySelector('lr-empty');
  expect(empty).to.exist;
  expect(empty!.getAttribute('heading')).to.equal('No columns configured');
  expect(el.shadowRoot!.querySelector('table')).to.not.exist;
});

it('emits lr-sort via keydown (Enter) on a sortable header, not just click', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const header = el.shadowRoot!.querySelectorAll('[part="header-cell"]')[1] as HTMLElement;
  header.focus();
  setTimeout(() => header.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  const ev = await oneEvent(el, 'lr-sort');
  expect(ev.detail.key).to.equal('score');
});

it('resolves the correct row via delegated click after a re-render (sort) reorders rows', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
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
  const ev = await oneEvent(el, 'lr-row-click');
  expect(ev.detail.row).to.deep.equal(rows[1]); // Beta, now first after reversing
});

it('renders a visual sort-direction chevron only in the active sort column, marked aria-hidden', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
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
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
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
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
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
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
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
    html`<lr-table style="display: block; width: 300px;"></lr-table>`,
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
    html`<lr-table style="display: block; width: 300px;"></lr-table>`,
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
    html`<lr-table style="display: block; width: 700px;"></lr-table>`,
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
    html`<lr-table style="display: block; width: 300px;"></lr-table>`,
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
    html`<lr-table style="display: block; width: 300px;"></lr-table>`,
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
    html`<lr-table style="display: block; width: 300px;"></lr-table>`,
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
    html`<lr-table style="display: block; width: 1000px;"></lr-table>`,
  )) as LyraTable<Row>;
  const events: unknown[] = [];
  el.addEventListener('lr-columns-hidden-change', (e) => events.push(e));
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

it('renders [part="reveal-columns-button"], sets columnsHidden=true, and fires lr-columns-hidden-change once when a priority column is actually hidden by a narrow container', async () => {
  const el = (await fixture(
    html`<lr-table style="display: block; width: 300px;"></lr-table>`,
  )) as LyraTable<Row>;
  const events: boolean[] = [];
  el.addEventListener('lr-columns-hidden-change', (e) => events.push((e as CustomEvent).detail.hidden));
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
    html`<lr-table style="display: block; width: 300px;"></lr-table>`,
  )) as LyraTable<Row>;
  el.columns = priorityColumns;
  el.rows = rows;
  await el.updateComplete;
  await waitUntil(() => el.columnsHidden === true);

  const events: boolean[] = [];
  el.addEventListener('lr-columns-hidden-change', (e) => events.push((e as CustomEvent).detail.hidden));
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
    html`<lr-table style="display: block; width: 300px;"></lr-table>`,
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

it('emits lr-columns-revealed with the new state whenever the reveal button is toggled', async () => {
  const el = (await fixture(
    html`<lr-table style="display: block; width: 300px;"></lr-table>`,
  )) as LyraTable<Row>;
  el.columns = priorityColumns;
  el.rows = rows;
  await el.updateComplete;
  await waitUntil(() => el.columnsHidden === true);

  const events: boolean[] = [];
  el.addEventListener('lr-columns-revealed', (e) => events.push((e as CustomEvent).detail.revealed));
  const revealButton = el.shadowRoot!.querySelector('[part="reveal-columns-button"]') as HTMLElement;
  revealButton.click();
  await el.updateComplete;
  revealButton.click();
  await el.updateComplete;

  expect(events).to.deep.equal([true, false]);
});

it('restores a previously-persisted showAllColumns preference from the initial property/attribute', async () => {
  const el = (await fixture(
    html`<lr-table style="display: block; width: 300px;" show-all-columns></lr-table>`,
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

it('persists and restores showAllColumns via storage-key', async () => {
  const key = `lr-test-table-${Math.random()}`;
  const fullKey = `lr-table:${key}`;
  localStorage.removeItem(fullKey);
  try {
    const el = await fixture<LyraTable<Row>>(html`<lr-table storage-key=${key}></lr-table>`);
    // The first `updated()` pass only flips the `persistReady` gate; the write happens on the
    // *next* pass. Set the property, then wait until the value has actually landed in storage
    // before remounting -- asserting the write flushed removes any dependence on update timing
    // (this test previously never reached its body under strict console, so the race was hidden).
    el.showAllColumns = true;
    await el.updateComplete;
    await waitUntil(() => localStorage.getItem(fullKey) !== null, 'showAllColumns was never persisted');
    el.remove();

    const restored = await fixture<LyraTable<Row>>(html`<lr-table storage-key=${key}></lr-table>`);
    expect(restored.showAllColumns).to.be.true;
  } finally {
    localStorage.removeItem(fullKey);
  }
});

it('writes nothing to storage when storage-key is unset (unset-regression)', async () => {
  const before = localStorage.length;
  const el = await fixture<LyraTable<Row>>(html`<lr-table></lr-table>`);
  el.showAllColumns = true;
  await el.updateComplete;
  expect(localStorage.length).to.equal(before);
});

it('never renders [part="reveal-columns-button"] and keeps columnsHidden false regardless of container width when no column declares a priority (regression)', async () => {
  const el = (await fixture(
    html`<lr-table style="display: block; width: 300px;"></lr-table>`,
  )) as LyraTable<Row>;
  const events: unknown[] = [];
  el.addEventListener('lr-columns-hidden-change', (e) => events.push(e));
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
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
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
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
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
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = stickyEndColumns;
  el.rows = rows;
  await el.updateComplete;

  const stickyHeader = el.shadowRoot!.querySelectorAll('[part="header-cell"]')[1] as HTMLElement;
  const stickyCell = el.shadowRoot!.querySelectorAll('[part="cell"]')[1] as HTMLElement;

  expect(stickyHeader.getAttribute('data-sticky')).to.equal('end');
  expect(getComputedStyle(stickyHeader).position).to.equal('sticky');
  expect(getComputedStyle(stickyCell).insetInlineEnd).to.equal('0px');
});

it('does not emit lr-row-click and does not swallow the click when a button inside a cell() is clicked', async () => {
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

  let buttonClicked = false;
  const actionButton = el.shadowRoot!.querySelector('[data-action]') as HTMLButtonElement;
  actionButton.addEventListener('click', () => (buttonClicked = true));
  actionButton.click();
  await el.updateComplete;

  expect(buttonClicked).to.be.true;
  expect(rowClicked).to.be.false;
});

it('sets aria-selected="true" only on the row matching selectedKey', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
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
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
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

it('emits lr-row-click via keydown (Enter and Space) on a focused row', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;
  const row = el.shadowRoot!.querySelector('[part="row"]') as HTMLElement;

  setTimeout(() => row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  let ev = await oneEvent(el, 'lr-row-click');
  expect(ev.detail.row).to.deep.equal(rows[0]);

  setTimeout(() => row.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })));
  ev = await oneEvent(el, 'lr-row-click');
  expect(ev.detail.row).to.deep.equal(rows[0]);
});

it('does not emit lr-sort when a non-sortable header is clicked or activated via keyboard', async () => {
  const mixedColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', cell: (r) => r.name },
    { key: 'score', label: 'Score', sortable: true, align: 'end', cell: (r) => r.score },
  ];
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = mixedColumns;
  el.rows = rows;
  await el.updateComplete;

  let sortCount = 0;
  el.addEventListener('lr-sort', () => sortCount++);

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
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
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
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const [nameHeader, scoreHeader] = [...el.shadowRoot!.querySelectorAll('[part="header-cell"]')];
  expect(nameHeader.getAttribute('tabindex')).to.equal('0');
  expect(scoreHeader.getAttribute('tabindex')).to.equal('-1');
});

it('gives only the roving-tabindex row (default: the first row) a tabindex of 0, and the rest -1', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;
  const [firstRow, secondRow] = [...el.shadowRoot!.querySelectorAll('[part="row"]')];
  expect(firstRow.getAttribute('tabindex')).to.equal('0');
  expect(secondRow.getAttribute('tabindex')).to.equal('-1');
});

it('uses selectedKey as the default roving-tabindex row when no row has been focused yet', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
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
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
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
    html`<lr-table dir="rtl"></lr-table>`,
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
    html`<lr-table dir="rtl"></lr-table>`,
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
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
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
  const el = (await fixture(
    html`<lr-table style="display: block; width: 300px;"></lr-table>`,
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

it('rehomes the active column when its priority-hidden header is no longer visible', async () => {
  const priorityColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', cell: (r) => r.name },
    { key: 'score', label: 'Score', priority: 'low', cell: (r) => r.score },
  ];
  const el = (await fixture(html`<lr-table style="display:block;width:300px"></lr-table>`)) as LyraTable<Row>;
  el.columns = priorityColumns;
  el.rows = rows;
  await el.updateComplete;
  (el as unknown as { activeColKey: string | null }).activeColKey = 'score';
  el.rows = [...rows];
  await el.updateComplete;

  expect((el as unknown as { activeColKey: string | null }).activeColKey).to.equal('name');
});

it('stops observing removed sticky headers when sticky columns are replaced', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = [
    { key: 'name', label: 'Name', sticky: true, cell: (r) => r.name },
    { key: 'score', label: 'Score', sticky: true, cell: (r) => r.score },
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
  expect(el.shadowRoot!.activeElement).to.equal(firstRow);
});

it('offsets a second sticky column past the first instead of overlapping at inset 0', async () => {
  const stickyColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', sticky: true, cell: (r) => r.name },
    { key: 'score', label: 'Score', sticky: true, cell: (r) => r.score },
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
    { key: 'actions', label: '', cell: () => html`<lr-select data-testid="cell-select"></lr-select>` },
  ];
  let rowClicked = false;
  const el = (await fixture(
    html`<lr-table
      .columns=${actionColumns}
      .rows=${rows}
      @lr-row-click=${() => (rowClicked = true)}
    ></lr-table>`,
  )) as LyraTable<Row>;
  await el.updateComplete;
  const select = el.shadowRoot!.querySelector('lr-select')!;
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
    html`<lr-table
      .columns=${mixedColumns}
      .rows=${mixedRows}
      .rowKey=${(r: (typeof mixedRows)[number]) => r.id}
    ></lr-table>`,
  )) as LyraTable<(typeof mixedRows)[number]>;
  await el.updateComplete;
  const rowEls = el.shadowRoot!.querySelectorAll('[data-row-key]');
  const keys = new Set(Array.from(rowEls).map((r) => r.getAttribute('data-row-key')));
  expect(keys.size).to.equal(2);
});

it('forwards a host aria-label into the shadow-DOM grid element', async () => {
  const el = (await fixture(
    html`<lr-table aria-label="Scores"></lr-table>`,
  )) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const grid = el.shadowRoot!.querySelector('[part="table"]') as HTMLElement;
  expect(grid.getAttribute('aria-label')).to.equal('Scores');
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
    expect(cap).to.exist;
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
    [...globalWarnings]
      .filter((w) => w.includes('scheduled an update'))
      .forEach((w) => globalWarnings.delete(w));
  }

  const originalWarn = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => calls.push(args);
  try {
    const el = (await fixture(
      html`<lr-table style="display: block; width: 300px;"></lr-table>`,
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
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = actionColumns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;

  let rowClicked = false;
  el.addEventListener('lr-row-click', () => (rowClicked = true));

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
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
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
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
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
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
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
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = withBoth;
    el.rows = rows;
    await el.updateComplete;
    const cell = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
    expect(cell.style.background).to.equal('green');
    expect(cell.style.getPropertyValue('--lr-table-sticky-offset')).to.not.equal('');
  });
});

describe('headerCell', () => {
  it('renders col.label by default when headerCell is unset', async () => {
    const columns: TableColumn<{ id: number }>[] = [{ key: 'id', label: 'ID', cell: (row) => row.id }];
    const el = (await fixture(html`<lr-table .columns=${columns} .rows=${[{ id: 1 }]}></lr-table>`)) as LyraTable;
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
    const el = (await fixture(html`<lr-table .columns=${columns} .rows=${[{ id: 1 }]}></lr-table>`)) as LyraTable;
    const th = el.shadowRoot!.querySelector('th[data-col-key="id"]')!;
    expect(th.querySelector('.custom')).to.exist;
    expect(th.textContent).to.contain('ID!');
  });
});

describe('column width', () => {
  it('does not set table-layout: fixed when no column defines width', async () => {
    const columns: TableColumn<{ id: number }>[] = [{ key: 'id', label: 'ID', cell: (row) => row.id }];
    const el = (await fixture(html`<lr-table .columns=${columns} .rows=${[{ id: 1 }]}></lr-table>`)) as LyraTable;
    const table = el.shadowRoot!.querySelector('[part="table"]') as HTMLElement;
    expect(getComputedStyle(table).tableLayout).to.equal('auto');
  });

  it('sets table-layout: fixed and applies <col> widths when a column defines width', async () => {
    const columns: TableColumn<{ id: number }>[] = [
      { key: 'id', label: 'ID', width: '120px', cell: (row) => row.id },
      { key: 'name', label: 'Name', cell: () => 'x' },
    ];
    const el = (await fixture(html`<lr-table .columns=${columns} .rows=${[{ id: 1 }]}></lr-table>`)) as LyraTable;
    const table = el.shadowRoot!.querySelector('[part="table"]') as HTMLElement;
    expect(getComputedStyle(table).tableLayout).to.equal('fixed');
    const cols = el.shadowRoot!.querySelectorAll('colgroup col');
    expect(cols).to.have.lengthOf(2);
    expect((cols[0] as HTMLElement).style.getPropertyValue('inline-size')).to.equal('120px');
  });
});

describe('expandable rows', () => {
  it('exposes expandedKeys defaulting to an empty Set', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    expect(el.expandedKeys).to.be.instanceOf(Set);
    expect(el.expandedKeys.size).to.equal(0);
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
    expect(el.shadowRoot!.querySelector('[part="expand-toggle-cell"]')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[data-row-expand-toggle]')).to.not.exist;
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
    expect(toggleCells[0].querySelector('button')).to.exist;
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

  it('renders an empty, non-interactive toggle cell for a row that fails canExpand', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
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

  it('emits lr-row-expand-toggle with { row, key } when the chevron button is clicked, and does not also emit lr-row-click', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = expandableColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.expandedContent = (r) => html`<p>${r.name} details</p>`;
    await el.updateComplete;

    let rowClicked = false;
    el.addEventListener('lr-row-click', () => (rowClicked = true));

    const firstToggleButton = el.shadowRoot!.querySelector('[part="expand-toggle-cell"] button') as HTMLButtonElement;
    setTimeout(() => firstToggleButton.click());
    const ev = await oneEvent(el, 'lr-row-expand-toggle');
    expect(ev.detail.row).to.deep.equal(rows[0]);
    expect(ev.detail.key).to.equal('a');
    expect(rowClicked).to.be.false;
  });

  it('still emits lr-row-click when clicking elsewhere in an expandable row', async () => {
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
    const ev = await oneEvent(el, 'lr-row-click');
    expect(ev.detail.row).to.deep.equal(rows[0]);
    expect(toggleFired).to.be.false;
  });

  it('renders the expanded panel row with the correct colspan when a row key is in expandedKeys', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
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
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
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
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
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
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = expandableColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.expandedContent = (r) => html`<p>${r.name} details</p>`;
    await el.updateComplete;

    let rowClicked = false;
    el.addEventListener('lr-row-click', () => (rowClicked = true));

    const toggleButton = el.shadowRoot!.querySelector('[part="row-expand-toggle"]') as HTMLButtonElement;
    toggleButton.focus();
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
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
    el.expandedKeys = new Set(['a']);
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it('grows a matching leading spacer cell in the footer row when combined with a footer column, keeping real footer cells aligned', async () => {
    const withFooter: TableColumn<Row>[] = [
      ...expandableColumns,
      { key: 'total', label: 'Total', footer: (rs) => rs.reduce((sum, r) => sum + r.score, 0), cell: () => '' },
    ];
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
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

// Proves each localize()-routed key actually reaches its rendered DOM node under a
// `.strings` override -- a key existing in DEFAULT_STRINGS doesn't by itself prove the
// call site is wired up correctly (see AGENTS.md's i18n testing convention).
describe('localization', () => {
  it('localizes the no-columns empty-state heading', async () => {
    const el = (await fixture(
      html`<lr-table .strings=${{ noColumns: 'Aucune colonne' }}></lr-table>`,
    )) as LyraTable<Row>;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('lr-empty')!.getAttribute('heading')).to.equal('Aucune colonne');
  });

  it('localizes the loading spinner label', async () => {
    const el = (await fixture(
      html`<lr-table loading .strings=${{ tableLoading: 'Chargement des lignes' }}></lr-table>`,
    )) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    await el.updateComplete;
    const spinner = el.shadowRoot!.querySelector('[part="loading"] lr-spinner')!;
    expect(spinner.getAttribute('accessible-label')).to.equal('Chargement des lignes');
    expect(spinner.textContent).to.contain('Chargement des lignes');
  });

  it('localizes the no-data empty-state heading (both the whole-table and filtered-to-empty variants)', async () => {
    const whole = (await fixture(
      html`<lr-table .strings=${{ noData: 'Aucune donnée' }}></lr-table>`,
    )) as LyraTable<Row>;
    whole.columns = columns; // rows left empty -- exercises the whole-table (not no-columns) empty state
    await whole.updateComplete;
    expect(whole.shadowRoot!.querySelector('lr-empty')!.getAttribute('heading')).to.equal('Aucune donnée');

    const filtered = (await fixture(
      html`<lr-table filterable .strings=${{ noData: 'Aucune correspondance' }}></lr-table>`,
    )) as LyraTable<Row>;
    filtered.columns = columns;
    filtered.rows = rows;
    filtered.rowKey = (r) => r.id;
    await filtered.updateComplete;
    filtered.filterText = 'nonexistent-xyz';
    await filtered.updateComplete;
    expect(filtered.shadowRoot!.querySelector('lr-empty')!.getAttribute('heading')).to.equal(
      'Aucune correspondance',
    );
  });

  it('localizes the filter label and placeholder', async () => {
    const el = (await fixture(
      html`<lr-table
        filterable
        .strings=${{ tableFilterLabel: 'Filtrer', tableFilterPlaceholder: 'Rechercher…' }}
      ></lr-table>`,
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
      html`<lr-table .strings=${{ expand: 'Développer', collapse: 'Réduire' }}></lr-table>`,
    )) as LyraTable<Row>;
    el.columns = expandableColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.expandedContent = (r) => html`<p>${r.name} details</p>`;
    await el.updateComplete;

    const toggle = el.shadowRoot!.querySelector('[part="row-expand-toggle"]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-label')).to.equal('Développer');

    // `expandedKeys` is a controlled prop -- the toggle button only emits
    // lr-row-expand-toggle, it doesn't mutate state itself (see the
    // `emits lr-row-expand-toggle` test above).
    el.expandedKeys = new Set(['a']);
    await el.updateComplete;
    expect(toggle.getAttribute('aria-label')).to.equal('Réduire');
  });

  it('localizes the inline cell editor aria-label, interpolating the column label', async () => {
    const el = (await fixture(
      html`<lr-table .strings=${{ tableEditCell: 'Modifier {column}' }}></lr-table>`,
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

  it('localizes the reveal/hide-columns button label', async () => {
    const priorityColumns: TableColumn<Row>[] = [
      { key: 'name', label: 'Name', cell: (r) => r.name },
      { key: 'score', label: 'Score', align: 'end', priority: 'medium', cell: (r) => r.score },
      { key: 'id', label: 'Id', priority: 'low', cell: (r) => r.id },
    ];
    const el = (await fixture(
      html`<lr-table
        style="display: block; width: 300px;"
        .strings=${{ showAllColumns: 'Tout afficher', showFewerColumns: 'Afficher moins' }}
      ></lr-table>`,
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
    const el = (await fixture(
      html`<lr-table .strings=${{ loadMore: 'Charger plus' }}></lr-table>`,
    )) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    el.hasMore = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="more-button"]')!.textContent).to.contain('Charger plus');
  });
});

describe('heat-tint mode', () => {
  const heatColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', cell: (r) => r.name },
    { key: 'score', label: 'Score', align: 'end', heatValue: (r) => r.score, cell: (r) => r.score },
  ];

  it('renders no data-heat cells when no column defines heatValue (unchanged default)', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[data-heat]').length).to.equal(0);
  });

  it('does not add a style attribute to a plain cell with no cellStyle and no heatValue (regression: styleMap({}) previously left a stray style="")', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    const cells = [...el.shadowRoot!.querySelectorAll('[part="cell"]')] as HTMLElement[];
    expect(cells.length).to.be.greaterThan(0);
    expect(cells.every((c) => !c.hasAttribute('style'))).to.be.true;
  });

  it('computes --lr-table-heat-t from the auto-derived min/max across all heatValue columns', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = heatColumns;
    el.rows = rows; // Alpha score 3, Beta score 1 -> auto domain [1, 3]
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    const scoreCells = [...el.shadowRoot!.querySelectorAll('[part="cell"][data-col-key="score"]')] as HTMLElement[];
    expect(scoreCells.length).to.equal(2);
    expect(scoreCells[0].style.getPropertyValue('--lr-table-heat-t')).to.equal('100.00%'); // Alpha: (3-1)/(3-1)
    expect(scoreCells[1].style.getPropertyValue('--lr-table-heat-t')).to.equal('0.00%'); // Beta: (1-1)/2
    expect(scoreCells.every((c) => c.hasAttribute('data-heat'))).to.be.true;
    const nameCells = [...el.shadowRoot!.querySelectorAll('[part="cell"][data-col-key="name"]')] as HTMLElement[];
    expect(nameCells.every((c) => !c.hasAttribute('data-heat'))).to.be.true;
  });

  it('overrides the auto-derived domain with heatTintScale', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = heatColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.heatTintScale = { min: 0, max: 10 };
    await el.updateComplete;
    const scoreCells = [...el.shadowRoot!.querySelectorAll('[part="cell"][data-col-key="score"]')] as HTMLElement[];
    expect(scoreCells[0].style.getPropertyValue('--lr-table-heat-t')).to.equal('30.00%'); // Alpha: 3/10
    expect(scoreCells[1].style.getPropertyValue('--lr-table-heat-t')).to.equal('10.00%'); // Beta: 1/10
  });

  it('skips tinting a cell whose heatValue returns null (not clamped to 0)', async () => {
    interface RowN {
      id: string;
      name: string;
      score: number | null;
    }
    const nullRows: RowN[] = [
      { id: 'a', name: 'Alpha', score: 3 },
      { id: 'b', name: 'Beta', score: null },
    ];
    const nullCols: TableColumn<RowN>[] = [
      { key: 'name', label: 'Name', cell: (r) => r.name },
      { key: 'score', label: 'Score', heatValue: (r) => r.score, cell: (r) => r.score ?? '' },
    ];
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<RowN>;
    el.columns = nullCols;
    el.rows = nullRows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    const scoreCells = [...el.shadowRoot!.querySelectorAll('[part="cell"][data-col-key="score"]')] as HTMLElement[];
    expect(scoreCells[0].hasAttribute('data-heat')).to.be.true;
    expect(scoreCells[1].hasAttribute('data-heat')).to.be.false;
  });

  it('declares the heat-tint ramp CSS with retheme-able tokens matching lr-heatmap defaults', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.include('--lr-table-heat-tint-lo: var(--lr-color-brand-quiet);');
    expect(css).to.include('--lr-table-heat-tint-hi: var(--lr-color-brand);');
    expect(css).to.match(/\[part='cell'\]\[data-heat\]\s*\{[^}]*color-mix\(/);
  });

  it('actually paints the color-mix() background on a rendered heat-tinted cell (not just present in the stylesheet source)', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = heatColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    const tintedCell = el.shadowRoot!.querySelector('[part="cell"][data-col-key="score"]') as HTMLElement;
    const untintedCell = el.shadowRoot!.querySelector('[part="cell"][data-col-key="name"]') as HTMLElement;
    // A drifted [part='cell'][data-heat] selector or --lr-table-heat-t/-lo/-hi property name would
    // leave this rendering exactly like the untinted column's own (transparent) background while
    // the cssText-regex test above kept passing -- this proves the rule reaches a live cell.
    expect(tintedCell.hasAttribute('data-heat')).to.be.true;
    const tintedBackground = getComputedStyle(tintedCell).backgroundColor;
    const untintedBackground = getComputedStyle(untintedCell).backgroundColor;
    expect(tintedBackground).to.not.equal(untintedBackground);
    expect(tintedBackground).to.not.equal('rgba(0, 0, 0, 0)');
  });

  it('applies both cellStyle and the heat-tint custom property to the same cell when both are set', async () => {
    const bothColumns: TableColumn<Row>[] = [
      { key: 'name', label: 'Name', cell: (r) => r.name },
      {
        key: 'score',
        label: 'Score',
        heatValue: (r) => r.score,
        cellStyle: () => ({ 'font-style': 'italic' }),
        cell: (r) => r.score,
      },
    ];
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = bothColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    const cell = el.shadowRoot!.querySelector('[part="cell"][data-col-key="score"]') as HTMLElement;
    expect(cell.style.fontStyle).to.equal('italic');
    expect(cell.hasAttribute('data-heat')).to.be.true;
    expect(cell.style.getPropertyValue('--lr-table-heat-t')).to.not.equal('');
  });

  it('lets a cellStyle background silently win over the heat-tint background (documents the inline-style-vs-stylesheet-rule precedence)', async () => {
    const conflictColumns: TableColumn<Row>[] = [
      { key: 'name', label: 'Name', cell: (r) => r.name },
      {
        key: 'score',
        label: 'Score',
        heatValue: (r) => r.score,
        cellStyle: () => ({ background: 'rgb(1, 2, 3)' }),
        cell: (r) => r.score,
      },
    ];
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = conflictColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    const cell = el.shadowRoot!.querySelector('[part="cell"][data-col-key="score"]') as HTMLElement;
    // The cell is still marked/measured as heat-tinted...
    expect(cell.hasAttribute('data-heat')).to.be.true;
    expect(cell.style.getPropertyValue('--lr-table-heat-t')).to.not.equal('');
    // ...but the actually-rendered background is cellStyle's inline color, not the heat-tint ramp:
    // an inline style= attribute always wins the cascade over table.styles.ts's
    // [part='cell'][data-heat] stylesheet rule regardless of specificity.
    expect(getComputedStyle(cell).backgroundColor).to.equal('rgb(1, 2, 3)');
  });
});

describe('rowTotal / grandTotal', () => {
  const totalsColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', cell: (r) => r.name },
    { key: 'score', label: 'Score', align: 'end', footer: (rs) => rs.reduce((sum, r) => sum + r.score, 0), cell: (r) => r.score },
  ];

  it('renders no trailing column when rowTotal is unset (unchanged default)', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="row-total-cell"]')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[data-row-total]')).to.not.exist;
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
    expect(cells[0].textContent!.trim()).to.equal('6'); // Alpha score 3 * 2
    expect(cells[1].textContent!.trim()).to.equal('2'); // Beta score 1 * 2
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
    expect(foot).to.exist;
    const footerCells = [...foot!.querySelectorAll('[part="footer-cell"]')];
    expect(footerCells[footerCells.length - 1].textContent!.trim()).to.equal('4'); // 3 + 1
  });

  it('renders no footer row at all when grandTotal is set but no column defines footer', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = columns; // no column has `footer`
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.rowTotal = (r) => r.score;
    el.grandTotal = (rs) => rs.reduce((sum, r) => sum + r.score, 0);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="foot"]')).to.not.exist;
  });

  it('extends the expanded-row and group-row colspan to include the new trailing column', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.rowTotal = (r) => r.score;
    el.expandedContent = (r) => html`<p>${r.name} details</p>`;
    el.expandedKeys = new Set(['a']);
    await el.updateComplete;
    const expandedCell = el.shadowRoot!.querySelector('[part="expanded-cell"]') as HTMLElement;
    // 2 data columns + 1 leading expand-toggle column + 1 trailing row-total column
    expect(expandedCell.getAttribute('colspan')).to.equal('4');
  });
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

describe('sticky-offset observation across reconnect', () => {
  it('keeps tracking a header resize after the table is detached and re-attached', async () => {
    const stickyColumns: TableColumn<Row>[] = [
      { key: 'name', label: 'Name', sticky: true, cell: (r) => r.name },
      { key: 'score', label: 'Score', sticky: true, cell: (r) => r.score },
    ];
    const el = (await fixture(
      html`<lr-table style="inline-size: 600px"></lr-table>`,
    )) as LyraTable<Row>;
    el.columns = stickyColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;

    const headers = () => el.shadowRoot!.querySelectorAll<HTMLElement>('th[data-col-key]');
    await waitUntil(
      () => headers()[1].style.getPropertyValue('--lr-table-sticky-offset') !== '',
      'expected an initial sticky offset on the second sticky column',
    );
    const initialOffset = headers()[1].style.getPropertyValue('--lr-table-sticky-offset');

    // A pure DOM move never runs the Lit update lifecycle, so only the
    // reconnect path itself can restore the per-header resize observations.
    const parent = el.parentElement!;
    el.remove();
    parent.appendChild(el);
    await el.updateComplete;
    // The reconnect-created ResizeObserver delivers an initial size for every
    // newly-observed element one rendering frame after observe(); let that
    // delivery settle first so the header resize below is only observable
    // through a live per-header observation, not the initial delivery.
    const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await nextFrame();
    await nextFrame();

    const first = headers()[0];
    first.style.inlineSize = '100px';
    await waitUntil(
      () => {
        const offset = headers()[1].style.getPropertyValue('--lr-table-sticky-offset');
        return offset === `${first.offsetWidth}px` && offset !== initialOffset;
      },
      'expected the second sticky column offset to track the resized first header after reconnect',
      { timeout: 2000 },
    );
  });
});

describe('empty-state addressability', () => {
  it('exposes part="empty" on the built-in empty in all three empty states', async () => {
    const noColumns = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    noColumns.columns = [];
    noColumns.rows = rows;
    await noColumns.updateComplete;
    expect(noColumns.shadowRoot!.querySelector('[part~="empty"]')!.tagName.toLowerCase()).to.equal('lr-empty');

    const noRows = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    noRows.columns = columns;
    noRows.rows = [];
    await noRows.updateComplete;
    expect(noRows.shadowRoot!.querySelector('[part~="empty"]')!.tagName.toLowerCase()).to.equal('lr-empty');

    const filtered = (await fixture(html`<lr-table filterable></lr-table>`)) as LyraTable<Row>;
    filtered.columns = columns;
    filtered.rows = rows;
    filtered.rowKey = (r) => r.id;
    filtered.filterText = 'nonexistent-xyz';
    await filtered.updateComplete;
    expect(filtered.shadowRoot!.querySelector('[part~="empty"]')!.tagName.toLowerCase()).to.equal('lr-empty');
  });

  it('lets an outer-tree ::part(empty) rule actually style the built-in empty', async () => {
    const styleEl = document.createElement('style');
    styleEl.textContent = 'lr-table::part(empty) { outline: 3px dotted rgb(1, 2, 3); }';
    document.head.append(styleEl);
    try {
      const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
      el.columns = columns;
      el.rows = [];
      await el.updateComplete;
      const empty = el.shadowRoot!.querySelector('[part~="empty"]') as HTMLElement;
      expect(getComputedStyle(empty).outlineColor).to.equal('rgb(1, 2, 3)');
    } finally {
      styleEl.remove();
    }
  });

  it('re-exports the empty state’s inner parts under empty-* aliases', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = [];
    await el.updateComplete;
    const exported = el.shadowRoot!.querySelector('[part~="empty"]')!.getAttribute('exportparts') ?? '';
    expect(exported).to.contain('heading:empty-heading');
    expect(exported).to.contain('description:empty-description');
    expect(exported).to.contain('icon:empty-icon');
  });

  it('replaces the built-in empty with an `empty`-slotted node on the data-empty branches', async () => {
    const el = (await fixture(
      html`<lr-table><div slot="empty" style="block-size: 40px">Nothing here</div></lr-table>`,
    )) as LyraTable<Row>;
    el.columns = columns;
    el.rows = [];
    await el.updateComplete;
    const slot = el.shadowRoot!.querySelector('slot[name="empty"]') as HTMLSlotElement;
    expect(slot, 'expected an `empty` slot on the zero-rows branch').to.exist;
    expect(slot.assignedElements().map((node) => node.textContent)).to.deep.equal(['Nothing here']);
    // Slotted content replaces the fallback: the built-in <lr-empty> generates no boxes.
    const builtIn = el.shadowRoot!.querySelector('[part~="empty"]') as HTMLElement;
    expect(builtIn.getClientRects().length).to.equal(0);
  });

  it('replaces the built-in empty on the filtered-to-zero branch too', async () => {
    const el = (await fixture(
      html`<lr-table filterable><div slot="empty">Nothing here</div></lr-table>`,
    )) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.filterText = 'nonexistent-xyz';
    await el.updateComplete;
    const slot = el.shadowRoot!.querySelector('slot[name="empty"]') as HTMLSlotElement;
    expect(slot, 'expected an `empty` slot on the filtered-to-zero branch').to.exist;
    expect(slot.assignedElements().length).to.equal(1);
    expect((el.shadowRoot!.querySelector('[part~="empty"]') as HTMLElement).getClientRects().length).to.equal(0);
  });

  it('keeps the distinct no-columns heading even when an `empty` node is slotted', async () => {
    const el = (await fixture(
      html`<lr-table><div slot="empty">Nothing here</div></lr-table>`,
    )) as LyraTable<Row>;
    el.columns = [];
    el.rows = rows;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('slot[name="empty"]'), 'the no-columns branch is not slot-replaceable').to
      .not.exist;
    const builtIn = el.shadowRoot!.querySelector('[part~="empty"]')!;
    expect(builtIn.getAttribute('heading')).to.equal('No columns configured');
    expect((builtIn as HTMLElement).getClientRects().length).to.be.greaterThan(0);
  });

  it('keeps each branch’s built-in compact default and lets emptyCompact override it', async () => {
    const wholeTable = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    wholeTable.columns = columns;
    wholeTable.rows = [];
    await wholeTable.updateComplete;
    expect(wholeTable.shadowRoot!.querySelector('[part~="empty"]')!.hasAttribute('compact')).to.be.false;

    wholeTable.emptyCompact = true;
    await wholeTable.updateComplete;
    expect(wholeTable.shadowRoot!.querySelector('[part~="empty"]')!.hasAttribute('compact')).to.be.true;

    const filtered = (await fixture(html`<lr-table filterable></lr-table>`)) as LyraTable<Row>;
    filtered.columns = columns;
    filtered.rows = rows;
    filtered.rowKey = (r) => r.id;
    filtered.filterText = 'nonexistent-xyz';
    await filtered.updateComplete;
    expect(filtered.shadowRoot!.querySelector('[part~="empty"]')!.hasAttribute('compact')).to.be.true;

    filtered.emptyCompact = false;
    await filtered.updateComplete;
    expect(filtered.shadowRoot!.querySelector('[part~="empty"]')!.hasAttribute('compact')).to.be.false;
  });

  it('parses the literal empty-compact="false" attribute as false, not as mere presence', async () => {
    const el = (await fixture(
      html`<lr-table filterable empty-compact="false"></lr-table>`,
    )) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.filterText = 'nonexistent-xyz';
    await el.updateComplete;
    expect(el.emptyCompact).to.be.false;
    // This branch's own default is compact -- an attribute reading "false" must beat it.
    expect(el.shadowRoot!.querySelector('[part~="empty"]')!.hasAttribute('compact')).to.be.false;
  });

  it('is accessible with a slotted empty state', async () => {
    const el = (await fixture(
      html`<lr-table aria-label="Scores"><p slot="empty">No scores recorded yet.</p></lr-table>`,
    )) as LyraTable<Row>;
    el.columns = columns;
    el.rows = [];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('slot[name="empty"]')).to.exist;
    await expect(el).to.be.accessible();
  });
});

describe('TableColumn.cellTitle', () => {
  const titledColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', cellTitle: (r) => `Full name: ${r.name}`, cell: (r) => r.name },
    { key: 'score', label: 'Score', cell: (r) => r.score },
  ];

  it('renders the native title on the cells of a column that defines cellTitle', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = titledColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    const titled = el.shadowRoot!.querySelector('td[data-col-key="name"]')!;
    expect(titled.getAttribute('title')).to.equal('Full name: Alpha');
  });

  it('renders no title attribute at all for a column without cellTitle, or an empty return', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = [
      ...titledColumns,
      { key: 'blank', label: 'Blank', cellTitle: () => '', cell: () => 'x' },
      { key: 'undef', label: 'Undef', cellTitle: () => undefined, cell: () => 'x' },
    ];
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    // An empty `title=""` would suppress an ancestor's tooltip, so it must be absent entirely.
    expect(el.shadowRoot!.querySelector('td[data-col-key="score"]')!.hasAttribute('title')).to.be.false;
    expect(el.shadowRoot!.querySelector('td[data-col-key="blank"]')!.hasAttribute('title')).to.be.false;
    expect(el.shadowRoot!.querySelector('td[data-col-key="undef"]')!.hasAttribute('title')).to.be.false;
  });

  it('suppresses the cell title while that cell is in edit mode', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = [{ ...titledColumns[0]!, editable: true, editValue: (r) => r.name }, titledColumns[1]!];
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    const cell = el.shadowRoot!.querySelector('td[data-col-key="name"]') as HTMLElement;
    expect(cell.getAttribute('title')).to.equal('Full name: Alpha');
    cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await el.updateComplete;
    const editing = el.shadowRoot!.querySelector('td[data-col-key="name"]') as HTMLElement;
    expect(editing.querySelector('[part="cell-editor"]'), 'expected the editor to have opened').to.exist;
    expect(editing.hasAttribute('title')).to.be.false;
    // Every other cell in that column keeps its title.
    const others = [...el.shadowRoot!.querySelectorAll('td[data-col-key="name"]')].slice(1);
    expect(others.map((td) => td.getAttribute('title'))).to.deep.equal(['Full name: Beta']);
  });

  it('is accessible with cell titles rendered', async () => {
    const el = (await fixture(html`<lr-table aria-label="Scores"></lr-table>`)) as LyraTable<Row>;
    el.columns = titledColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('td[data-col-key="name"]')!.hasAttribute('title')).to.be.true;
    await expect(el).to.be.accessible();
  });
});

describe('layout', () => {
  const plainColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', cell: (r) => r.name },
    { key: 'score', label: 'Score', cell: (r) => r.score },
  ];

  it('defaults to auto and reflects the attribute', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = plainColumns;
    el.rows = rows;
    await el.updateComplete;
    expect(el.layout).to.equal('auto');
    expect(el.getAttribute('layout')).to.equal('auto');
    const table = el.shadowRoot!.querySelector('[part="table"]') as HTMLElement;
    expect(table.getAttribute('data-layout')).to.equal('auto');
    expect(getComputedStyle(table).tableLayout).to.equal('auto');
  });

  it('computes table-layout: fixed with layout="fixed" and no column widths', async () => {
    const el = (await fixture(html`<lr-table layout="fixed"></lr-table>`)) as LyraTable<Row>;
    el.columns = plainColumns;
    el.rows = rows;
    await el.updateComplete;
    const table = el.shadowRoot!.querySelector('[part="table"]') as HTMLElement;
    expect(table.getAttribute('data-layout')).to.equal('fixed');
    expect(getComputedStyle(table).tableLayout).to.equal('fixed');
    // `layout` is a floor, not the <colgroup>-carries-real-widths signal.
    expect(table.hasAttribute('data-has-column-widths')).to.be.false;
  });

  it('stays fixed under layout="auto" when a column declares a width', async () => {
    const el = (await fixture(html`<lr-table layout="auto"></lr-table>`)) as LyraTable<Row>;
    el.columns = [{ ...plainColumns[0]!, width: '120px' }, plainColumns[1]!];
    el.rows = rows;
    await el.updateComplete;
    const table = el.shadowRoot!.querySelector('[part="table"]') as HTMLElement;
    expect(table.getAttribute('data-layout')).to.equal('fixed');
    expect(getComputedStyle(table).tableLayout).to.equal('fixed');
  });

  it('stays fixed under layout="auto" through an active drag-resize', async () => {
    const el = (await fixture(html`<lr-table layout="auto"></lr-table>`)) as LyraTable<Row>;
    el.columns = [{ ...plainColumns[0]!, resizable: true }, plainColumns[1]!];
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    const handle = el.shadowRoot!.querySelector('[part="resize-handle"]') as HTMLElement;
    handle.setPointerCapture = () => {};
    handle.releasePointerCapture = () => {};
    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, clientX: 100 }));
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 7, clientX: 180 }));
    await el.updateComplete;
    const table = el.shadowRoot!.querySelector('[part="table"]') as HTMLElement;
    expect(getComputedStyle(table).tableLayout, 'resizing does not work without table-layout: fixed').to.equal(
      'fixed',
    );
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7, clientX: 180 }));
  });
});

describe('--lr-table-row-selected-bg', () => {
  const selectionFixture = async (): Promise<LyraTable<Row>> => {
    const el = (await fixture(html`<lr-table selection-mode="single"></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.selectedKey = 'a';
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
});

describe('loadingAppearance="skeleton"', () => {
  const widthColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', width: '160px', cell: (r) => r.name },
    { key: 'score', label: 'Score', width: '80px', align: 'end', cell: (r) => r.score },
  ];

  const skeletonRowsOf = (el: LyraTable<Row>): HTMLElement[] => [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('tbody tr[data-skeleton-row]'),
  ];

  it('keeps the header row and renders skeleton body rows instead of the spinner or the empty state', async () => {
    const el = (await fixture(
      html`<lr-table loading loading-appearance="skeleton"></lr-table>`,
    )) as LyraTable<Row>;
    el.columns = columns;
    el.rows = []; // a cold load: no rows have arrived yet
    await el.updateComplete;

    expect(el.shadowRoot!.querySelectorAll('[part="table"]').length).to.equal(1);
    expect(
      [...el.shadowRoot!.querySelectorAll('[part="header-cell"]')].map((h) => h.textContent!.trim()),
    ).to.deep.equal(['Name', 'Score']);
    expect(el.shadowRoot!.querySelectorAll('[part="loading"] lr-spinner').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('lr-empty').length).to.equal(0);
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-busy')).to.equal('true');

    const skeletonRows = skeletonRowsOf(el);
    expect(skeletonRows.length).to.equal(3);
    for (const row of skeletonRows) {
      expect(row.querySelectorAll('[part="cell"]').length).to.equal(2);
      expect(row.querySelectorAll('lr-skeleton[part="skeleton"]').length).to.equal(2);
    }
    // Placeholder rows are not data rows: no row identity, no roving tab stop.
    expect(el.shadowRoot!.querySelectorAll('tbody [data-row-key]').length).to.equal(0);
    expect(skeletonRows.filter((row) => row.hasAttribute('tabindex')).length).to.equal(0);
  });

  it('renders real rows once loading clears, and renders none of this while loading is false', async () => {
    const el = (await fixture(html`<lr-table loading-appearance="skeleton"></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    expect(skeletonRowsOf(el).length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(2);

    el.loading = true;
    el.rows = [];
    await el.updateComplete;
    expect(skeletonRowsOf(el).length).to.equal(3);

    el.loading = false;
    el.rows = rows;
    await el.updateComplete;
    expect(skeletonRowsOf(el).length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(2);
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-busy')).to.equal('false');
  });

  it('derives the placeholder row count from pageSize and lets skeletonRows override it', async () => {
    const el = (await fixture(
      html`<lr-table loading loading-appearance="skeleton"></lr-table>`,
    )) as LyraTable<Row>;
    el.columns = columns;
    el.rows = [];
    await el.updateComplete;
    expect(el.skeletonRows).to.equal(0);
    expect(skeletonRowsOf(el).length, 'pagination off -> the built-in default').to.equal(3);

    el.pageSize = 8;
    await el.updateComplete;
    expect(skeletonRowsOf(el).length).to.equal(8);

    el.pageSize = 500;
    await el.updateComplete;
    expect(skeletonRowsOf(el).length, 'a huge page size is capped').to.equal(20);

    el.skeletonRows = 2;
    await el.updateComplete;
    expect(skeletonRowsOf(el).length, 'an explicit count wins verbatim').to.equal(2);

    el.skeletonRows = -5;
    await el.updateComplete;
    expect(skeletonRowsOf(el).length, 'a nonsense count falls back to the derived one').to.equal(20);
  });

  it('keeps column geometry stable across the load', async () => {
    const el = (await fixture(
      html`<lr-table style="display: block; width: 400px;" loading-appearance="skeleton"></lr-table>`,
    )) as LyraTable<Row>;
    el.columns = widthColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    const loaded = [...el.shadowRoot!.querySelectorAll('th[data-col-key]')].map(
      (th) => th.getBoundingClientRect().width,
    );
    expect(loaded.length).to.equal(2);

    el.loading = true;
    el.rows = [];
    await el.updateComplete;
    expect(skeletonRowsOf(el).length).to.equal(3);
    const loadingWidths = [...el.shadowRoot!.querySelectorAll('th[data-col-key]')].map(
      (th) => th.getBoundingClientRect().width,
    );
    expect(loadingWidths).to.deep.equal(loaded);
  });

  it('keeps a resized column at its resized width in skeleton mode', async () => {
    const el = (await fixture(
      html`<lr-table style="display: block; width: 400px;" loading-appearance="skeleton"></lr-table>`,
    )) as LyraTable<Row>;
    el.columns = [
      { key: 'name', label: 'Name', width: '160px', minWidth: '80px', resizable: true, cell: (r) => r.name },
      widthColumns[1]!,
    ];
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;

    const handle = el.shadowRoot!.querySelector('[part="resize-handle"]') as HTMLElement;
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await el.updateComplete;
    const resized = (el.shadowRoot!.querySelector('th[data-col-key="name"]') as HTMLElement)
      .getBoundingClientRect().width;

    el.loading = true;
    el.rows = [];
    await el.updateComplete;
    const cols = [...el.shadowRoot!.querySelectorAll<HTMLElement>('colgroup col')];
    expect(cols.length).to.equal(2);
    expect(cols[0]!.style.inlineSize, 'the resized width survives into the placeholder render').to.equal(
      '170px',
    );
    expect(
      (el.shadowRoot!.querySelector('th[data-col-key="name"]') as HTMLElement).getBoundingClientRect().width,
    ).to.equal(resized);
  });

  it('exposes exactly one polite status region, not one per placeholder cell', async () => {
    const el = (await fixture(
      html`<lr-table loading loading-appearance="skeleton"></lr-table>`,
    )) as LyraTable<Row>;
    el.columns = columns;
    el.rows = [];
    await el.updateComplete;

    expect(el.shadowRoot!.querySelectorAll('lr-skeleton').length).to.equal(6);
    expect(el.shadowRoot!.querySelectorAll('[role="status"]').length).to.equal(1);
    const status = el.shadowRoot!.querySelector('[role="status"]') as HTMLElement;
    expect(status.getAttribute('aria-live')).to.equal('polite');
    expect(status.textContent!.trim()).to.equal('Loading rows');
    expect(
      [...el.shadowRoot!.querySelectorAll('lr-skeleton')].filter((s) => s.hasAttribute('role')).length,
      'every placeholder opts out of its own announcement',
    ).to.equal(0);
  });

  it('leaves the default spinner appearance unchanged', async () => {
    const el = (await fixture(html`<lr-table loading></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    await el.updateComplete;

    expect(el.loadingAppearance).to.equal('spinner');
    expect(el.shadowRoot!.querySelectorAll('[part="loading"] lr-spinner').length).to.equal(1);
    expect(el.shadowRoot!.querySelectorAll('[part="table"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('lr-skeleton').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[role="status"]').length).to.equal(1);
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-busy')).to.equal('true');
  });

  it('gives a priority-hidden column no visible placeholder cell', async () => {
    const el = (await fixture(
      html`<lr-table style="display: block; width: 300px;" loading loading-appearance="skeleton"></lr-table>`,
    )) as LyraTable<Row>;
    el.columns = priorityColumns;
    el.rows = [];
    await el.updateComplete;
    await waitUntil(() => el.columnsHidden === true);

    const row = skeletonRowsOf(el)[0]!;
    const lowCell = row.querySelector('[part="cell"][data-priority="low"]') as HTMLElement;
    expect(getComputedStyle(lowCell).display).to.equal('none');
    const visibleCells = [...row.querySelectorAll<HTMLElement>('[part="cell"]')].filter(
      (cell) => cell.offsetParent !== null,
    );
    const visibleHeaders = [...el.shadowRoot!.querySelectorAll<HTMLElement>('th[data-col-key]')].filter(
      (th) => th.offsetParent !== null,
    );
    expect(visibleCells.length).to.equal(1);
    expect(visibleCells.length).to.equal(visibleHeaders.length);
  });

  it('keeps the filter field and the pagination footer in place while loading', async () => {
    const el = (await fixture(
      html`<lr-table filterable page-size="4" loading loading-appearance="skeleton"></lr-table>`,
    )) as LyraTable<Row>;
    el.columns = columns;
    el.rows = [];
    await el.updateComplete;

    expect(el.shadowRoot!.querySelectorAll('[part="filter"]').length).to.equal(1);
    expect(el.shadowRoot!.querySelectorAll('lr-pagination').length).to.equal(1);
    expect(skeletonRowsOf(el).length).to.equal(4);
  });

  it('localizes the placeholder status label', async () => {
    const el = (await fixture(
      html`<lr-table
        loading
        loading-appearance="skeleton"
        .strings=${{ tableLoading: 'Chargement des lignes' }}
      ></lr-table>`,
    )) as LyraTable<Row>;
    el.columns = columns;
    el.rows = [];
    await el.updateComplete;
    // Guards against passing against the spinner branch's own status node instead.
    expect(skeletonRowsOf(el).length).to.equal(3);
    expect(el.shadowRoot!.querySelector('[role="status"]')!.textContent!.trim()).to.equal(
      'Chargement des lignes',
    );
  });

  it('is accessible in skeleton mode', async () => {
    const el = (await fixture(
      html`<lr-table aria-label="Scores" loading loading-appearance="skeleton"></lr-table>`,
    )) as LyraTable<Row>;
    el.columns = columns;
    el.rows = [];
    await el.updateComplete;
    expect(skeletonRowsOf(el).length).to.equal(3);
    await expect(el).to.be.accessible();
  });
});

it("colors the filter's placeholder and undoes Firefox's reduced default opacity", () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='filter'\]::placeholder\s*\{[^}]*color:\s*var\(--lr-color-text-quiet\)[^}]*opacity:\s*1/);
});

it('resets the native search-cancel glyph on the filter field (matches lr-input\'s own unconditional reset)', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='filter'\]\[type='search'\]::-webkit-search-cancel-button/);
  expect(css).to.match(/\[part='filter'\]\[type='search'\]::-webkit-search-decoration/);
});

it('resets the native number-spinner chrome on the cell editor (editType: \'number\')', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='cell-editor'\]\[type='number'\]\s*\{[^}]*appearance:\s*textfield/);
  expect(css).to.match(/\[part='cell-editor'\]\[type='number'\]::-webkit-inner-spin-button/);
  expect(css).to.match(/\[part='cell-editor'\]\[type='number'\]::-webkit-outer-spin-button/);
});

it('wraps the sortable-header hover selector in :where() so a consumer ::part(header-cell):hover can win without !important', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(
    /:where\(\[part='header-cell'\]\[data-sortable\]\):hover\s*\{[^}]*background:\s*var\(--lr-color-brand-quiet\)/,
  );
  // The old over-specific, unwrapped shape must be gone, not merely joined by the new one.
  expect(css).to.not.include("[part='header-cell'][data-sortable]:hover {");
});

it('gives the row-expand-toggle a :hover treatment, like its sibling icon controls (resize-handle/more-button/reveal-columns-button)', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='row-expand-toggle'\]:hover\s*\{[^}]*background/);
});

describe("editable: 'always'", () => {
  const alwaysColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', sortable: true, cell: (r) => r.name },
    {
      key: 'score',
      label: 'Score',
      editable: 'always',
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
      (input) => input.value,
    );
    expect(values).to.deep.equal(['3', '1']);
  });

  it('names every persistent editor individually through the tableEditCell key', async () => {
    const el = await alwaysTable();
    const labels = [...el.shadowRoot!.querySelectorAll('[part="cell-editor"]')].map((input) =>
      input.getAttribute('aria-label'),
    );
    expect(labels).to.deep.equal(['Edit Score', 'Edit Score']);
  });

  it('honors editType on a persistent editor', async () => {
    const el = await alwaysTable();
    const input = el.shadowRoot!.querySelector('[part="cell-editor"]') as HTMLInputElement;
    expect(input.type).to.equal('number');
  });

  it('leaves an editable: true column closed until double-click (regression)', async () => {
    const el = await alwaysTable([
      { key: 'name', label: 'Name', editable: true, editValue: (r) => r.name, cell: (r) => r.name },
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
      { key: 'name', label: 'Name', editable: true, editValue: (r) => r.name, cell: (r) => r.name },
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
    return `${row?.dataset.rowKey}/${cell?.dataset.colKey}`;
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
      { key: 'name', label: 'Name', editable: true, editValue: (r) => r.name, cell: (r) => r.name },
    ]);
    const rowEls = [...el.shadowRoot!.querySelectorAll('[part="row"]')] as HTMLElement[];
    const target = rowEls[1]!.querySelector('td[data-col-key="name"]') as HTMLElement;
    target.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await afterAutofocus(el);
    expect(focusedEditorCell(el)).to.equal('string:b/name');
  });

  it('autofocuses the double-clicked cell when no always-on column exists (unchanged)', async () => {
    const el = await alwaysTable([
      { key: 'name', label: 'Name', editable: true, editValue: (r) => r.name, cell: (r) => r.name },
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
    expect(event.detail.key).to.equal('score');
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
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true }),
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
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, cancelable: true }),
    );
    await el.updateComplete;
    expect(notPrevented).to.be.true;
    // Nothing to cancel back to: the editor is unchanged and still focused.
    expect(el.shadowRoot!.querySelectorAll('[part="cell-editor"]')).to.have.lengthOf(2);
    expect(focusedEditorCell(el)).to.equal('string:a/score');
  });

  it('still cancels Escape on a double-click editor and closes it (regression)', async () => {
    const el = await alwaysTable([
      { key: 'name', label: 'Name', editable: true, editValue: (r) => r.name, cell: (r) => r.name },
    ]);
    const cell = el.shadowRoot!.querySelector('[part="row"] [part="cell"]') as HTMLElement;
    cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await el.updateComplete;
    const input = cell.querySelector('[part="cell-editor"]') as HTMLInputElement;
    const notPrevented = input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, cancelable: true }),
    );
    await el.updateComplete;
    expect(notPrevented).to.be.false;
    expect(el.shadowRoot!.querySelectorAll('[part="cell-editor"]')).to.have.lengthOf(0);
  });

  it('leaves arrow keys inside a persistent editor to the caret, not the grid', async () => {
    const el = await alwaysTable();
    const input = el.shadowRoot!.querySelector('[part="cell-editor"]') as HTMLInputElement;
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
    await el.updateComplete;
    expect(focusedEditorCell(el)).to.equal('string:a/score');
  });

  it('does not activate the row when Enter is pressed inside a persistent editor', async () => {
    const el = await alwaysTable();
    let rowClicked = false;
    el.addEventListener('lr-row-click', () => (rowClicked = true));
    const input = el.shadowRoot!.querySelector('[part="cell-editor"]') as HTMLInputElement;
    input.focus();
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true }),
    );
    await el.updateComplete;
    expect(rowClicked).to.be.false;
  });

  it('leaves roving header and row navigation untouched with an always-on column present', async () => {
    const el = await alwaysTable();
    const [nameHeader, scoreHeader] = [
      ...el.shadowRoot!.querySelectorAll('[part="header-cell"]'),
    ] as HTMLElement[];
    const [firstRow, secondRow] = [...el.shadowRoot!.querySelectorAll('[part="row"]')] as HTMLElement[];

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
    el.addEventListener('lr-row-click', (event) => {
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
      html`<lr-table aria-label="Scores" .strings=${{ tableEditCell: 'Modifier {column}' }}></lr-table>`,
    )) as LyraTable<Row>;
    el.columns = alwaysColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    const labels = [...el.shadowRoot!.querySelectorAll('[part="cell-editor"]')].map((input) =>
      input.getAttribute('aria-label'),
    );
    expect(labels).to.deep.equal(['Modifier Score', 'Modifier Score']);
  });
});

describe('lifecycle super calls', () => {
  it('calls super.willUpdate() and super.updated() (regression guard: a future mixin layered under LyraTable must still run)', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    // The immediate prototype of a LyraTable instance is LyraElement.prototype -- the exact object
    // `super.willUpdate()`/`super.updated()` resolve against from inside LyraTable's own overrides.
    // Patching it (and restoring via `delete` below) spies on the real call without needing sinon.
    const proto = Object.getPrototypeOf(Object.getPrototypeOf(el)) as Record<string, unknown>;
    const originalWillUpdate = proto.willUpdate as ((changed: unknown) => void) | undefined;
    const originalUpdated = proto.updated as ((changed: unknown) => void) | undefined;
    let willUpdateCalls = 0;
    let updatedCalls = 0;
    proto.willUpdate = function (this: unknown, changed: unknown) {
      willUpdateCalls++;
      return originalWillUpdate?.call(this, changed);
    };
    proto.updated = function (this: unknown, changed: unknown) {
      updatedCalls++;
      return originalUpdated?.call(this, changed);
    };
    try {
      el.columns = columns;
      el.rows = rows;
      el.rowKey = (r) => r.id;
      await el.updateComplete;
      expect(willUpdateCalls).to.be.greaterThan(0);
      expect(updatedCalls).to.be.greaterThan(0);
    } finally {
      delete proto.willUpdate;
      delete proto.updated;
    }
  });
});

describe('ResizeObserver callback batching (perf)', () => {
  it('coalesces several synchronous ResizeObserver callback ticks into a single rAF-scheduled layout pass', async () => {
    const originalResizeObserver = window.ResizeObserver;
    const originalRaf = window.requestAnimationFrame;
    let capturedCallback: ResizeObserverCallback | undefined;
    let rafCallCount = 0;
    class FakeResizeObserver {
      constructor(cb: ResizeObserverCallback) {
        capturedCallback = cb;
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = FakeResizeObserver;
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      rafCallCount++;
      return originalRaf.call(window, cb);
    }) as typeof window.requestAnimationFrame;
    try {
      const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
      el.columns = columns;
      el.rows = rows;
      el.rowKey = (r) => r.id;
      await el.updateComplete;
      expect(typeof capturedCallback).to.equal('function');
      rafCallCount = 0;
      // Simulate three ResizeObserver ticks firing back-to-back in the same frame -- exactly what
      // an animated/dragged ancestor resize does, once per animation frame.
      capturedCallback!([] as unknown as ResizeObserverEntry[], {} as ResizeObserver);
      capturedCallback!([] as unknown as ResizeObserverEntry[], {} as ResizeObserver);
      capturedCallback!([] as unknown as ResizeObserverEntry[], {} as ResizeObserver);
      expect(rafCallCount).to.equal(1);
      // ...and the very next tick after that frame settles schedules a fresh one (the id resets,
      // rather than getting stuck disabled after the first coalesced frame).
      await new Promise<void>((resolve) => originalRaf.call(window, () => resolve()));
      rafCallCount = 0;
      capturedCallback!([] as unknown as ResizeObserverEntry[], {} as ResizeObserver);
      expect(rafCallCount).to.equal(1);
    } finally {
      window.ResizeObserver = originalResizeObserver;
      window.requestAnimationFrame = originalRaf;
    }
  });
});

describe('lr-table sorted-header theming and specificity', () => {
  it('honours --lr-table-header-sorted-bg on the currently-sorted header cell only', async () => {
    const el = (await fixture(html`
      <lr-table style="--lr-table-header-sorted-bg: rgb(7, 8, 9);"></lr-table>
    `)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    el.sortKey = 'score';
    el.sortDir = 'asc';
    await el.updateComplete;
    const [nameHeader, scoreHeader] = [...el.shadowRoot!.querySelectorAll('[part="header-cell"]')] as HTMLElement[];
    expect(getComputedStyle(scoreHeader).backgroundColor).to.equal('rgb(7, 8, 9)');
    // The unsorted header must NOT pick up the token.
    expect(getComputedStyle(nameHeader).backgroundColor).to.not.equal('rgb(7, 8, 9)');
  });

  it('leaves the sorted header transparent when the token is unset (regression)', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    el.sortKey = 'score';
    await el.updateComplete;
    const scoreHeader = el.shadowRoot!.querySelectorAll('[part="header-cell"]')[1] as HTMLElement;
    expect(getComputedStyle(scoreHeader).backgroundColor).to.equal('rgba(0, 0, 0, 0)');
  });

  it('lets a consumer ::part(header-cell) cursor override win over the internal sort/cursor rule', async () => {
    const el = (await fixture(html`
      <lr-table></lr-table>
    `)) as LyraTable<Row>;
    // Consumer stylesheet targeting the part from the light DOM.
    const consumerStyle = document.createElement('style');
    consumerStyle.textContent = `lr-table::part(header-cell) { cursor: text; }`;
    document.head.appendChild(consumerStyle);
    try {
      el.columns = columns;
      el.rows = rows;
      el.sortKey = 'score';
      await el.updateComplete;
      const scoreHeader = el.shadowRoot!.querySelectorAll('[part="header-cell"]')[1] as HTMLElement;
      // Without the :where() specificity fix the internal (0,3,0) rule would keep cursor: pointer.
      expect(getComputedStyle(scoreHeader).cursor).to.equal('text');
    } finally {
      document.head.removeChild(consumerStyle);
    }
  });
});
