import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './table.js';
import '../../forms/select/select.js';
import type { LyraTable, TableColumn } from './table.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
// Registers the real shipped `ar` catalog's `data` slice so the `lang="ar-EG"` resize-value
// test below (which only overrides `resizeValuePixels`) can render without tripping the
// dev-mode locale-fallback warning that strict-console platform lanes treat as fatal.
import '../../../translations/ar/data.js';
import { installTableTestHooks, sinkTexts, type Row, columns, rows, priorityColumns } from '../../../../test/table.js';
installTableTestHooks();

it('preserves the focused continuation and rows while loading more, suppressing duplicate activations', async () => {
  const el = (await fixture(html`<lr-table has-more></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="more-button"]')!;
  await focusByKeyboard(button);
  let requests = 0;
  el.addEventListener('lr-load-more', () => {
    requests++;
    el.setAttribute('loading-more', '');
  });
  await sendKeys({ press: 'Enter' });
  await el.updateComplete;
  expect(requests).to.equal(1);
  expect(el.shadowRoot!.querySelector('[part="more-button"]') === button).to.equal(true);
  expect(el.shadowRoot!.activeElement === button).to.equal(true);
  expect(button.disabled).to.equal(false);
  expect(button.getAttribute('aria-disabled')).to.equal('true');
  expect(button.getAttribute('aria-busy')).to.equal('true');
  expect(button.textContent!.trim()).to.equal('Loading more rows');
  expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(rows.length);
  button.click();
  const rect = button.getBoundingClientRect();
  await sendMouse({ type: 'click', position: [Math.round(rect.x + rect.width / 2), Math.round(rect.y + rect.height / 2)] });
  await sendKeys({ press: 'Enter' });
  await sendKeys({ press: 'Space' });
  expect(requests).to.equal(1);
  el.removeAttribute('loading-more');
  await el.updateComplete;
  expect(button.textContent!.trim()).to.equal('Load more');
  expect(button.hasAttribute('aria-disabled')).to.equal(false);
  expect(button.hasAttribute('aria-busy')).to.equal(false);
  expect(el.shadowRoot!.activeElement === button).to.equal(true);
  await sendKeys({ press: 'Enter' });
  expect(requests).to.equal(2);
});

it('leaves continuation markup and activation unchanged when loadingMore is unset', async () => {
  const el = (await fixture(html`<lr-table has-more></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="more-button"]')!;
  expect(el.loadingMore).to.equal(false);
  expect(el.hasAttribute('loading-more')).to.equal(false);
  expect(button.disabled).to.equal(false);
  expect(button.hasAttribute('aria-disabled')).to.equal(false);
  expect(button.hasAttribute('aria-busy')).to.equal(false);
  expect(button.textContent!.trim()).to.equal('Load more');
  let requests = 0;
  el.addEventListener('lr-load-more', (event) => {
    requests++;
    expect(event.detail).to.equal(null);
    expect(event.bubbles).to.equal(true);
    expect(event.composed).to.equal(true);
    expect(event.cancelable).to.equal(false);
  });
  button.click();
  button.click();
  expect(requests).to.equal(2);
  el.hasMore = false;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="more-button"]').length).to.equal(0);
});

it('guards another activation before the busy render commits', async () => {
  const el = (await fixture(html`<lr-table has-more></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="more-button"]')!;
  let requests = 0;
  el.addEventListener('lr-load-more', () => {
    requests++;
    el.loadingMore = true;
  });
  button.click();
  button.click();
  expect(requests).to.equal(1);
  await el.updateComplete;
  expect(el.hasAttribute('loading-more')).to.equal(true);
});

it('localizes incremental busy copy, preserves literal overrides, and stays accessible in RTL', async () => {
  const el = (await fixture(html`<lr-table has-more loading-more dir="rtl" aria-label="Scores"></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.strings = { tableLoadingMore: 'Chargement des lignes suivantes' };
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="more-button"]')!;
  expect(button.textContent!.trim()).to.equal('Chargement des lignes suivantes');
  expect(button.getAttribute('aria-busy')).to.equal('true');
  await expect(el).to.be.accessible();
  el.loadingMoreLabel = 'Loading more rows';
  await el.updateComplete;
  expect(button.textContent!.trim()).to.equal('Loading more rows');
  el.loadingMoreLabel = '';
  await el.updateComplete;
  expect(button.textContent!.trim()).to.equal('');
  el.loadingMoreLabel = undefined;
  await el.updateComplete;
  expect(button.textContent!.trim()).to.equal('Chargement des lignes suivantes');
});

it('announces repeated incremental loading only for a rendered post-mount continuation', async () => {
  const el = (await fixture(html`<lr-table has-more loading-more .columns=${columns} .rows=${rows}></lr-table>`)) as LyraTable<Row>;
  expect(sinkTexts()).to.deep.equal([]);
  el.loadingMore = false;
  await el.updateComplete;
  el.loadingMore = true;
  await el.updateComplete;
  await waitUntil(() => sinkTexts().length === 1);
  expect(sinkTexts()).to.deep.equal(['Loading more rows']);
  el.loadingMore = false;
  await el.updateComplete;
  el.loadingMore = true;
  await el.updateComplete;
  await waitUntil(() => sinkTexts().length === 2);
  expect(sinkTexts()).to.deep.equal(['Loading more rows', 'Loading more rows']);
  el.hasMore = false;
  el.loadingMore = false;
  await el.updateComplete;
  el.loadingMore = true;
  await el.updateComplete;
  expect(sinkTexts().length).to.equal(2);
  el.loadingMore = false;
  el.loading = true;
  await el.updateComplete;
  await waitUntil(() => sinkTexts().length === 3);
  el.hasMore = true;
  el.loadingMore = true;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(0);
  expect(el.shadowRoot!.querySelectorAll('[part="more-button"]').length).to.equal(0);
  expect(sinkTexts()).to.deep.equal(['Loading more rows', 'Loading more rows', 'Loading rows']);
});




it('renders header labels and a row per item, keyed by rowKey', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;
  const headers = [...el.shadowRoot!.querySelectorAll('[part="header-cell"]')].map((h) => h.textContent!.trim());
  expect(headers).to.deep.equal(['Name', 'Score']);
  expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(2);
});

it("rolls back a second drag's preview to the first drag's committed width (not the declared one) on pointercancel", async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = [
    {
      key: 'name',
      label: 'Name',
      width: '120px',
      minWidth: '80px',
      resizable: true,
      cell: (r) => r.name,
    },
  ];
  el.rows = rows;
  await el.updateComplete;
  const handle = el.shadowRoot!.querySelector('[part="resize-handle"]') as HTMLElement;
  handle.setPointerCapture = () => {};
  handle.releasePointerCapture = () => {};
  const col = (): HTMLElement => el.shadowRoot!.querySelector('col') as HTMLElement;

  // First drag commits normally (pointerup, no veto), establishing a resizedColumnWidths entry
  // distinct from the declared 120px -- the value a later cancel below must roll back to.
  handle.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      pointerId: 60,
      clientX: 100,
    })
  );
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 60, clientX: 150 }));
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 60, clientX: 150 }));
  await el.updateComplete;
  const committedWidth = col().style.inlineSize;
  expect(committedWidth).to.not.equal('120px');

  // Second drag previews a different width, then is interrupted by pointercancel -- it must roll
  // back to the first drag's committed width, not delete the entry back to the declared 120px.
  handle.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      pointerId: 61,
      clientX: 100,
    })
  );
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 61, clientX: 250 }));
  await el.updateComplete;
  expect(col().style.inlineSize).to.not.equal(committedWidth);
  window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 61 }));
  await el.updateComplete;
  expect(col().style.inlineSize).to.equal(committedWidth);
});

it("reverts to the first drag's committed width (not the declared one) when a second drag's pointerup commit is vetoed", async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = [
    {
      key: 'name',
      label: 'Name',
      width: '120px',
      minWidth: '80px',
      resizable: true,
      cell: (r) => r.name,
    },
  ];
  el.rows = rows;
  await el.updateComplete;
  const handle = el.shadowRoot!.querySelector('[part="resize-handle"]') as HTMLElement;
  handle.setPointerCapture = () => {};
  handle.releasePointerCapture = () => {};
  const col = (): HTMLElement => el.shadowRoot!.querySelector('col') as HTMLElement;

  // First drag commits normally (pointerup, no listener yet).
  handle.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      pointerId: 62,
      clientX: 100,
    })
  );
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 62, clientX: 150 }));
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 62, clientX: 150 }));
  await el.updateComplete;
  const committedWidth = col().style.inlineSize;
  expect(committedWidth).to.not.equal('120px');

  // Second drag's drag-end commit is vetoed.
  el.addEventListener('lr-column-resize-request', (event) => {
    const custom = event as CustomEvent<{ columnKey: string; width: number }>;
    if (custom.cancelable) custom.preventDefault();
  });
  handle.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      pointerId: 63,
      clientX: 100,
    })
  );
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 63, clientX: 250 }));
  await el.updateComplete;
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 63, clientX: 250 }));
  await el.updateComplete;
  expect(col().style.inlineSize).to.equal(committedWidth);
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

it('computes custom group rows in linear work', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = Array.from({ length: 120 }, (_, index) => ({
    id: String(index),
    name: `Row ${index}`,
    score: index,
  }));
  el.pageSize = 120;
  let groupByCalls = 0;
  el.groupBy = (row) => {
    groupByCalls++;
    return row.id;
  };
  el.groupLabel = (key, groupedRows) => `${key}:${groupedRows.length}`;
  await el.updateComplete;

  expect(groupByCalls).to.be.lessThan(500);
  expect(el.shadowRoot!.querySelectorAll('[part="group-row"]')).to.have.lengthOf(120);
});

it('excludes a row from grouping (no crash, no bogus bucket) when groupBy returns undefined for it', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows; // Alpha (score 3), Beta (score 1)
  el.rowKey = (r) => r.id;
  // A loosely-typed/misbehaving groupBy can return undefined for some rows at runtime even
  // though its declared return type forbids it -- this must not crash, and must not silently
  // fold those rows into whichever group happens to read the map next.
  el.groupBy = (r) => (r.name === 'Alpha' ? 'A' : (undefined as unknown as string));
  el.groupLabel = (key, groupedRows) => `${key}:${groupedRows.length}`;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(2);
  const groupRows = [...el.shadowRoot!.querySelectorAll('[part="group-row"]')];
  expect(groupRows.length).to.equal(2);
  // Alpha's own group has exactly 1 member -- Beta's undefined key was never folded into it.
  expect(groupRows[0]!.textContent).to.contain('A:1');
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

it('normalizes a non-finite pageSize to the bounded default instead of NaN math', async () => {
  const el = (await fixture(html`<lr-table page-size="1"></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(1);

  el.pageSize = NaN;
  await el.updateComplete;
  expect(el.pageSize).to.be.NaN;
  expect((el.shadowRoot!.querySelector('lr-pagination')) == null).to.be.true;
  expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(2);
});

it('renders a localized busy state before rows while loading', async () => {
  const el = (await fixture(html`<lr-table loading></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="loading"] lr-spinner')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-busy')).to.equal('true');
  expect(sinkTexts(), 'declarative loading state must stay silent on first mount').to.deep.equal([]);
  await expect(el).to.be.accessible();
});

it('gives loading precedence before a schema arrives and falls skeleton requests back to the spinner', async () => {
  for (const appearance of ['spinner', 'skeleton'] as const) {
    const el = (await fixture(
      html`<lr-table loading loading-appearance=${appearance}></lr-table>`
    )) as LyraTable<Row>;

    expect(el.shadowRoot!.querySelectorAll('[part="loading"] lr-spinner').length, appearance).to.equal(1);
    expect(el.shadowRoot!.querySelectorAll('lr-empty').length, appearance).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[data-skeleton-row]').length, appearance).to.equal(0);
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-busy'), appearance).to.equal('true');
  }
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
  expect(thead != null).to.equal(true);
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
  expect(el.shadowRoot!.querySelector('table') == null).to.equal(true);
});

it('swaps the reveal-columns-button label between revealColumnsLabel and columnsHideLabel on toggle', async () => {
  const el = (await fixture(html`<lr-table style="display: block; width: 300px;"></lr-table>`)) as LyraTable<Row>;
  el.columns = priorityColumns;
  el.rows = rows;
  await el.updateComplete;
  await waitUntil(() => el.hasHiddenPriorityColumns === true);

  const revealButton = el.shadowRoot!.querySelector('[part="reveal-columns-button"]') as HTMLElement;
  expect(revealButton.textContent!.trim()).to.equal('Show all columns');

  revealButton.click();
  await el.updateComplete;
  expect(revealButton.textContent!.trim()).to.equal('Show fewer columns');

  revealButton.click();
  await el.updateComplete;
  expect(revealButton.textContent!.trim()).to.equal('Show all columns');
});

it('honors custom revealColumnsLabel and columnsHideLabel property values', async () => {
  const el = (await fixture(html`<lr-table style="display: block; width: 300px;"></lr-table>`)) as LyraTable<Row>;
  el.columns = priorityColumns;
  el.rows = rows;
  el.revealColumnsLabel = 'More columns';
  el.columnsHideLabel = 'Fewer columns';
  await el.updateComplete;
  await waitUntil(() => el.hasHiddenPriorityColumns === true);

  const revealButton = el.shadowRoot!.querySelector('[part="reveal-columns-button"]') as HTMLElement;
  expect(revealButton.textContent!.trim()).to.equal('More columns');

  revealButton.click();
  await el.updateComplete;
  expect(revealButton.textContent!.trim()).to.equal('Fewer columns');
});

it('keeps the visibility toggle available while hasHiddenPriorityColumns reports the actual revealed state', async () => {
  const el = (await fixture(html`<lr-table style="display: block; width: 300px;"></lr-table>`)) as LyraTable<Row>;
  el.columns = priorityColumns;
  el.rows = rows;
  await el.updateComplete;
  await waitUntil(() => el.hasHiddenPriorityColumns === true);
  const revealButton = el.shadowRoot!.querySelector('[part="reveal-columns-button"]') as HTMLElement;
  revealButton.click();
  await el.updateComplete;

  const lowHeader = el.shadowRoot!.querySelector('[part="header-cell"][data-priority="low"]') as HTMLElement;
  expect(getComputedStyle(lowHeader).display).to.not.equal('none'); // force-visible actually un-hid it...
  expect(el.shadowRoot!.querySelector('[part="reveal-columns-button"]')).to.exist;
  await waitUntil(() => el.hasHiddenPriorityColumns === false);
  expect(el.hasAttribute('has-hidden-priority-columns')).to.be.false;
});

it('writes nothing to storage when storage-key is unset (unset-regression)', async () => {
  const before = localStorage.length;
  const el = await fixture<LyraTable<Row>>(html`<lr-table></lr-table>`);
  el.priorityColumnsVisible = true;
  await el.updateComplete;
  expect(localStorage.length).to.equal(before);
});

it('honors an override of --lr-table-cell-padding on header/body/row-total cells, defaulting to the historical --lr-space-s (unset-regression)', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowTotal = (r) => r.score;
  el.filterable = true;
  await el.updateComplete;

  const header = el.shadowRoot!.querySelector('[part="header-cell"]') as HTMLElement;
  const cell = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
  const rowTotalCell = el.shadowRoot!.querySelector('[part="row-total-cell"]') as HTMLElement;
  // [part='filter-label'] still declares the literal var(--lr-space-s) this library shipped
  // before the hook -- a stable, independent reference for the default value.
  const filterLabel = el.shadowRoot!.querySelector('[part="filter-label"]') as HTMLElement;
  const defaultPadding = getComputedStyle(filterLabel).paddingTop;

  for (const target of [header, cell, rowTotalCell]) {
    expect(getComputedStyle(target).paddingTop).to.equal(defaultPadding);
    expect(getComputedStyle(target).paddingLeft).to.equal(defaultPadding);
  }

  el.style.setProperty('--lr-table-cell-padding', '20px');
  await el.updateComplete;

  for (const target of [header, cell, rowTotalCell]) {
    expect(getComputedStyle(target).paddingTop).to.equal('20px');
    expect(getComputedStyle(target).paddingLeft).to.equal('20px');
  }
  // Unaffected: a part reading a different token never picks up this override.
  expect(getComputedStyle(filterLabel).paddingTop).to.equal(defaultPadding);
});

it('honors an override of --lr-table-font-size on the table, defaulting to the inherited font size (unset-regression)', async () => {
  const el = (await fixture(html`<lr-table style="font-size: 24px;"></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;

  const table = el.shadowRoot!.querySelector('[part="table"]') as HTMLElement;
  expect(getComputedStyle(table).fontSize).to.equal('24px');

  el.style.setProperty('--lr-table-font-size', '13px');
  await el.updateComplete;

  expect(getComputedStyle(table).fontSize).to.equal('13px');
  // Unaffected: only the table's own font-size changed, not the host's.
  expect(getComputedStyle(el).fontSize).to.equal('24px');
});

it('sets data-align="end" on the header cell and body cell for an end-aligned column, and "start" otherwise', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const [nameHeader, scoreHeader] = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="header-cell"]'),
  ] as [HTMLElement, HTMLElement];
  expect(nameHeader.getAttribute('data-align')).to.equal('start');
  expect(scoreHeader.getAttribute('data-align')).to.equal('end');
  const firstRowCells = el.shadowRoot!.querySelectorAll('[part="row"]')[0]!.querySelectorAll('[part="cell"]');
  expect(firstRowCells[0]!.getAttribute('data-align')).to.equal('start');
  expect(firstRowCells[1]!.getAttribute('data-align')).to.equal('end');
});

it('gives only the roving-tabindex header cell (default: the first column) a tabindex of 0, and the rest -1', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const [nameHeader, scoreHeader] = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="header-cell"]'),
  ] as [HTMLElement, HTMLElement];
  expect(nameHeader.getAttribute('tabindex')).to.equal('0');
  expect(scoreHeader.getAttribute('tabindex')).to.equal('-1');
});

it('gives only the roving-tabindex row (default: the first row) a tabindex of 0, and the rest -1', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;
  const [firstRow, secondRow] = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="row"]'),
  ] as [HTMLElement, HTMLElement];
  expect(firstRow.getAttribute('tabindex')).to.equal('0');
  expect(secondRow.getAttribute('tabindex')).to.equal('-1');
});

it('moves the roving tabindex between header cells with ArrowRight/ArrowLeft and Home/End', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const [nameHeader, scoreHeader] = [...el.shadowRoot!.querySelectorAll('[part="header-cell"]')] as [HTMLElement, HTMLElement];

  nameHeader.focus();
  nameHeader.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement === scoreHeader).to.equal(true);
  expect(scoreHeader.getAttribute('tabindex')).to.equal('0');
  expect(nameHeader.getAttribute('tabindex')).to.equal('-1');

  scoreHeader.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement === nameHeader).to.equal(true);

  nameHeader.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement === scoreHeader).to.equal(true);

  scoreHeader.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement === nameHeader).to.equal(true);
});

it('supports Home/End row navigation and ignores unknown keyboard commands', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;
  const [firstRow, secondRow] = [...el.shadowRoot!.querySelectorAll('[part="row"]')] as [HTMLElement, HTMLElement];

  secondRow.focus();
  secondRow.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement?.getAttribute('data-row-key')).to.equal(firstRow.dataset['rowKey']);

  firstRow.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement?.getAttribute('data-row-key')).to.equal(secondRow.dataset['rowKey']);

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
  expect(el.shadowRoot!.activeElement?.getAttribute('data-col-key')).to.equal(header.dataset['colKey']);
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
  el.addEventListener('lr-row-activate', () => activated++);

  for (const action of el.shadowRoot!.querySelectorAll<HTMLElement>(
    'tbody td [role="button"], tbody td [tabindex="0"]'
  )) {
    action.click();
  }

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
      html`<lr-table><div slot="empty" style="block-size: 40px">Nothing here</div></lr-table>`
    )) as LyraTable<Row>;
    el.columns = columns;
    el.rows = [];
    await el.updateComplete;
    const slot = el.shadowRoot!.querySelector('slot[name="empty"]') as HTMLSlotElement;
    expect(slot != null, 'expected an `empty` slot on the zero-rows branch').to.equal(true);
    expect(slot.assignedElements().map((node) => node.textContent)).to.deep.equal(['Nothing here']);
    // Slotted content replaces the fallback: the built-in <lr-empty> generates no boxes.
    const builtIn = el.shadowRoot!.querySelector('[part~="empty"]') as HTMLElement;
    expect(builtIn.getClientRects().length).to.equal(0);
  });

  it('replaces the built-in empty on the filtered-to-zero branch too', async () => {
    const el = (await fixture(
      html`<lr-table filterable><div slot="empty">Nothing here</div></lr-table>`
    )) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.filterText = 'nonexistent-xyz';
    await el.updateComplete;
    const slot = el.shadowRoot!.querySelector('slot[name="empty"]') as HTMLSlotElement;
    expect(slot != null, 'expected an `empty` slot on the filtered-to-zero branch').to.equal(true);
    expect(slot.assignedElements().length).to.equal(1);
    expect((el.shadowRoot!.querySelector('[part~="empty"]') as HTMLElement).getClientRects().length).to.equal(0);
  });

  it('keeps the distinct no-columns heading even when an `empty` node is slotted', async () => {
    const el = (await fixture(html`<lr-table><div slot="empty">Nothing here</div></lr-table>`)) as LyraTable<Row>;
    el.columns = [];
    el.rows = rows;
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('slot[name="empty"]') == null,
      'the no-columns branch is not slot-replaceable'
    ).to.be.true;
    const builtIn = el.shadowRoot!.querySelector('[part~="empty"]')!;
    expect(builtIn.getAttribute('heading')).to.equal('No columns configured');
    expect((builtIn as HTMLElement).getClientRects().length).to.be.greaterThan(0);
  });

  it('keeps each branch’s built-in compact default and lets emptySize override it', async () => {
    const wholeTable = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    wholeTable.columns = columns;
    wholeTable.rows = [];
    await wholeTable.updateComplete;
    expect(wholeTable.emptySize).to.be.undefined;
    expect(wholeTable.shadowRoot!.querySelector('[part~="empty"]')!.getAttribute('size') === 's').to.be.false;

    wholeTable.emptySize = 's';
    await wholeTable.updateComplete;
    expect(wholeTable.shadowRoot!.querySelector('[part~="empty"]')!.getAttribute('size') === 's').to.be.true;

    const filtered = (await fixture(html`<lr-table filterable></lr-table>`)) as LyraTable<Row>;
    filtered.columns = columns;
    filtered.rows = rows;
    filtered.rowKey = (r) => r.id;
    filtered.filterText = 'nonexistent-xyz';
    await filtered.updateComplete;
    expect(filtered.shadowRoot!.querySelector('[part~="empty"]')!.getAttribute('size') === 's').to.be.true;

    filtered.emptySize = 'm';
    await filtered.updateComplete;
    expect(filtered.shadowRoot!.querySelector('[part~="empty"]')!.getAttribute('size') === 's').to.be.false;
  });

  it('maps every size step onto the compact or spacious rendering and normalizes unknown values to unset', async () => {
    const compactFor = async (size: string): Promise<boolean> => {
      const el = (await fixture(html`<lr-table empty-size=${size}></lr-table>`)) as LyraTable<Row>;
      el.columns = columns;
      el.rows = [];
      await el.updateComplete;
      return el.shadowRoot!.querySelector('[part~="empty"]')!.getAttribute('size') === 's';
    };
    for (const size of ['2xs', 'xs', 's', 'small']) expect(await compactFor(size), size).to.be.true;
    for (const size of ['m', 'medium', 'l', 'large', 'xl']) expect(await compactFor(size), size).to.be.false;
    const unknown = (await fixture(html`<lr-table filterable empty-size="huge"></lr-table>`)) as LyraTable<Row>;
    expect(unknown.emptySize).to.be.undefined;
  });

  it('parses a removed empty-size attribute back to undefined, restoring each branch default', async () => {
    const el = (await fixture(html`<lr-table filterable empty-size="m"></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.filterText = 'nonexistent-xyz';
    await el.updateComplete;
    expect(el.emptySize).to.equal('m');
    expect(el.shadowRoot!.querySelector('[part~="empty"]')!.getAttribute('size') === 's').to.be.false;
    el.removeAttribute('empty-size');
    await el.updateComplete;
    expect(el.emptySize).to.be.undefined;
    expect(el.shadowRoot!.querySelector('[part~="empty"]')!.getAttribute('size') === 's').to.be.true;
  });

  it('is accessible with a slotted empty state', async () => {
    const el = (await fixture(
      html`<lr-table aria-label="Scores"><p slot="empty">No scores recorded yet.</p></lr-table>`
    )) as LyraTable<Row>;
    el.columns = columns;
    el.rows = [];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('slot[name="empty"]')).to.exist;
    await expect(el).to.be.accessible();
  });
});

describe('loadingAppearance="skeleton"', () => {
  const widthColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', width: '160px', cell: (r) => r.name },
    {
      key: 'score',
      label: 'Score',
      width: '80px',
      align: 'end',
      cell: (r) => r.score,
    },
  ];

  const skeletonRowsOf = (el: LyraTable<Row>): HTMLElement[] => [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('tbody tr[data-skeleton-row]'),
  ];

  it('keeps the header row and renders skeleton body rows instead of the spinner or the empty state', async () => {
    const el = (await fixture(html`<lr-table loading loading-appearance="skeleton"></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = []; // a cold load: no rows have arrived yet
    await el.updateComplete;

    expect(el.shadowRoot!.querySelectorAll('[part="table"]').length).to.equal(1);
    expect(
      [...el.shadowRoot!.querySelectorAll('[part="header-cell"]')].map((h) => h.textContent!.trim())
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
    const placeholders = [...el.shadowRoot!.querySelectorAll('lr-skeleton')];
    expect(placeholders.every((placeholder) => placeholder.getAttribute('shape') === 'rect')).to.equal(true);
    expect(placeholders.some((placeholder) => placeholder.hasAttribute('variant'))).to.equal(false);
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

  it('derives the placeholder row count and bounds explicit property and attribute overrides', async () => {
    const el = (await fixture(html`<lr-table loading loading-appearance="skeleton"></lr-table>`)) as LyraTable<Row>;
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
    expect(skeletonRowsOf(el).length, 'an explicit count wins within the bound').to.equal(2);

    el.skeletonRows = 500;
    await el.updateComplete;
    expect(skeletonRowsOf(el).length, 'a huge explicit property count is capped').to.equal(20);

    el.setAttribute('skeleton-rows', '1000000');
    await el.updateComplete;
    expect(skeletonRowsOf(el).length, 'a huge explicit attribute count is capped').to.equal(20);

    el.skeletonRows = -5;
    await el.updateComplete;
    expect(skeletonRowsOf(el).length, 'a nonsense count falls back to the derived one').to.equal(20);
  });

  it('keeps column geometry stable across the load', async () => {
    const el = (await fixture(
      html`<lr-table style="display: block; width: 400px;" loading-appearance="skeleton"></lr-table>`
    )) as LyraTable<Row>;
    el.columns = widthColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    const loaded = [...el.shadowRoot!.querySelectorAll('th[data-col-key]')].map(
      (th) => th.getBoundingClientRect().width
    );
    expect(loaded.length).to.equal(2);

    el.loading = true;
    el.rows = [];
    await el.updateComplete;
    expect(skeletonRowsOf(el).length).to.equal(3);
    const loadingWidths = [...el.shadowRoot!.querySelectorAll('th[data-col-key]')].map(
      (th) => th.getBoundingClientRect().width
    );
    expect(loadingWidths).to.deep.equal(loaded);
  });

  it('keeps a resized column at its resized width in skeleton mode', async () => {
    const el = (await fixture(
      html`<lr-table style="display: block; width: 400px;" loading-appearance="skeleton"></lr-table>`
    )) as LyraTable<Row>;
    el.columns = [
      {
        key: 'name',
        label: 'Name',
        width: '160px',
        minWidth: '80px',
        resizable: true,
        cell: (r) => r.name,
      },
      widthColumns[1]!,
    ];
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;

    const handle = el.shadowRoot!.querySelector('[part="resize-handle"]') as HTMLElement;
    handle.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    const resized = (el.shadowRoot!.querySelector('th[data-col-key="name"]') as HTMLElement).getBoundingClientRect()
      .width;

    el.loading = true;
    el.rows = [];
    await el.updateComplete;
    const cols = [...el.shadowRoot!.querySelectorAll<HTMLElement>('colgroup col')];
    expect(cols.length).to.equal(2);
    expect(cols[0]!.style.inlineSize, 'the resized width survives into the placeholder render').to.equal('170px');
    expect(
      (el.shadowRoot!.querySelector('th[data-col-key="name"]') as HTMLElement).getBoundingClientRect().width
    ).to.equal(resized);
  });

  it('exposes one aria-hidden loading mirror, not one live region per placeholder cell', async () => {
    const el = (await fixture(html`<lr-table loading loading-appearance="skeleton"></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = [];
    await el.updateComplete;

    expect(el.shadowRoot!.querySelectorAll('lr-skeleton').length).to.equal(6);
    expect(el.shadowRoot!.querySelectorAll('[role="status"], [aria-live]').length).to.equal(0);
    const status = el.shadowRoot!.querySelector('[part="loading"]') as HTMLElement;
    expect(status.getAttribute('aria-hidden')).to.equal('true');
    expect(status.textContent!.trim()).to.equal('Loading rows');
    expect(
      [...el.shadowRoot!.querySelectorAll('lr-skeleton')].filter((s) => s.hasAttribute('role')).length,
      'every placeholder opts out of its own announcement'
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
    expect(el.shadowRoot!.querySelectorAll('[role="status"], [aria-live]').length).to.equal(0);
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-busy')).to.equal('true');
  });

  it('gives a priority-hidden column no visible placeholder cell', async () => {
    const el = (await fixture(
      html`<lr-table style="display: block; width: 300px;" loading loading-appearance="skeleton"></lr-table>`
    )) as LyraTable<Row>;
    el.columns = priorityColumns;
    el.rows = [];
    await el.updateComplete;
    await waitUntil(() => el.hasHiddenPriorityColumns === true);

    const row = skeletonRowsOf(el)[0]!;
    const lowCell = row.querySelector('[part="cell"][data-priority="low"]') as HTMLElement;
    expect(getComputedStyle(lowCell).display).to.equal('none');
    const visibleCells = [...row.querySelectorAll<HTMLElement>('[part="cell"]')].filter(
      (cell) => cell.offsetParent !== null
    );
    const visibleHeaders = [...el.shadowRoot!.querySelectorAll<HTMLElement>('th[data-col-key]')].filter(
      (th) => th.offsetParent !== null
    );
    expect(visibleCells.length).to.equal(1);
    expect(visibleCells.length).to.equal(visibleHeaders.length);
  });

  it('keeps the filter field and the pagination footer in place while loading', async () => {
    const el = (await fixture(
      html`<lr-table filterable page-size="4" loading loading-appearance="skeleton"></lr-table>`
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
      ></lr-table>`
    )) as LyraTable<Row>;
    el.columns = columns;
    el.rows = [];
    await el.updateComplete;
    // Guards against passing against the spinner branch's own status node instead.
    expect(skeletonRowsOf(el).length).to.equal(3);
    expect(el.shadowRoot!.querySelector('[part="loading"]')!.textContent!.trim()).to.equal('Chargement des lignes');
  });

  it('is accessible in skeleton mode', async () => {
    const el = (await fixture(
      html`<lr-table aria-label="Scores" loading loading-appearance="skeleton"></lr-table>`
    )) as LyraTable<Row>;
    el.columns = columns;
    el.rows = [];
    await el.updateComplete;
    expect(skeletonRowsOf(el).length).to.equal(3);
    await expect(el).to.be.accessible();
  });
});

it("lets a consumer's own ::part(header-cell):hover override win over the internal hover arm", async () => {
  // Asserted as rendered computed style, not as stylesheet text: the internal arm is written at
  // full (0,3,0) specificity so it can out-rank the sticky-column rule, and a consumer override
  // still wins regardless, because a declaration from the outer encapsulation context beats one
  // from inside the shadow tree before specificity is ever consulted.
  const style = document.createElement('style');
  style.textContent = `lr-table::part(header-cell):hover { background: rgb(1, 2, 3); }`;
  document.head.appendChild(style);
  try {
    const el = (await fixture(html`
      <lr-table data-lr-theme-scope
        style="--lr-transition-fast: 0s"
        aria-label="Scores"
        .columns=${[{ key: 'name', label: 'Name', sortable: true, sticky: 'start', cell: (r: Row) => r.name }] as TableColumn<Row>[]}
        .rows=${rows}
      ></lr-table>
    `)) as LyraTable<Row>;
    await el.updateComplete;
    const header = el.shadowRoot!.querySelector("[part='header-cell'][data-sortable]") as HTMLElement;
    // Landed with `hoverUntilMatched`: `sendMouse` resolving is not proof the engine processed the
    // pointer event, so a single move can leave the poll below waiting on a hover that never was.
    await hoverUntilMatched(header, 'the sortable header cell never took the pointer');
    await waitUntil(
      () => getComputedStyle(header).backgroundColor === 'rgb(1, 2, 3)',
      'the consumer ::part(header-cell):hover override never reached the header cell'
    );
  } finally {
    await resetMouse();
    style.remove();
  }
});

describe('lifecycle super calls', () => {
  it('calls super.willUpdate() and super.updated() (regression guard: a future mixin layered under LyraTable must still run)', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    // The immediate prototype of a LyraTable instance is LyraElement.prototype -- the exact object
    // `super.willUpdate()`/`super.updated()` resolve against from inside LyraTable's own overrides.
    // Patching it (and restoring via `delete` below) spies on the real call without needing sinon.
    const proto = Object.getPrototypeOf(Object.getPrototypeOf(el)) as Record<string, unknown>;
    const originalWillUpdate = proto['willUpdate'] as ((changed: unknown) => void) | undefined;
    const originalUpdated = proto['updated'] as ((changed: unknown) => void) | undefined;
    let willUpdateCalls = 0;
    let updatedCalls = 0;
    proto['willUpdate'] = function (this: unknown, changed: unknown) {
      willUpdateCalls++;
      return originalWillUpdate?.call(this, changed);
    };
    proto['updated'] = function (this: unknown, changed: unknown) {
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
      delete proto['willUpdate'];
      delete proto['updated'];
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

  it('ignores a stale ResizeObserver callback left over from a disconnect/reconnect cycle', async () => {
    const originalResizeObserver = window.ResizeObserver;
    const callbacks: ResizeObserverCallback[] = [];
    class RecordingResizeObserver {
      constructor(cb: ResizeObserverCallback) {
        callbacks.push(cb);
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = RecordingResizeObserver;
    try {
      const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
      el.columns = columns;
      el.rows = rows;
      el.rowKey = (r) => r.id;
      await el.updateComplete;
      const staleCallback = callbacks[0]!;

      const parent = el.parentElement!;
      el.remove();
      parent.appendChild(el);
      await el.updateComplete;
      expect(callbacks.length, 'reconnect constructs a fresh observer').to.equal(2);
      const freshCallback = callbacks[1]!;

      let scheduleCalls = 0;
      (el as unknown as { scheduleLayoutSync: () => void }).scheduleLayoutSync = () => (scheduleCalls += 1);

      freshCallback([] as unknown as ResizeObserverEntry[], {} as ResizeObserver);
      expect(scheduleCalls, 'the current observer still schedules a layout sync').to.equal(1);

      staleCallback([] as unknown as ResizeObserverEntry[], {} as ResizeObserver);
      expect(scheduleCalls, 'a callback from the replaced observer is ignored').to.equal(1);
    } finally {
      window.ResizeObserver = originalResizeObserver;
    }
  });
});

it('renders grouped rows with per-group and grand totals', async () => {
  const el = (await fixture(html`
    <lr-table
      aria-label="Scores"
      .columns=${[
        {
          key: 'name',
          label: 'Name',
          cell: (r: Row) => r.name,
          footer: (all: Row[]) => `${all.length} rows`,
        },
        {
          key: 'score',
          label: 'Score',
          align: 'end',
          cell: (r: Row) => r.score,
        },
      ]}
      .rows=${[...rows, { id: 'c', name: 'Gamma', score: 5 }]}
      .groupBy=${(row: Row) => (row.score > 2 ? 'high' : 'low')}
      .groupLabel=${(groupKey: string | number) => `Group ${groupKey}`}
      .rowTotal=${(row: Row) => row.score}
      .grandTotal=${(all: readonly unknown[]) => all.length}
    ></lr-table>
  `)) as LyraTable<Row>;
  await el.updateComplete;
  const text = el.shadowRoot!.textContent ?? '';
  expect(text).to.include('Group high');
  expect(text).to.include('Group low');
  expect(el.shadowRoot!.querySelectorAll('[part="footer-cell"]').length).to.be.greaterThan(0);
});

it('moves the roving tabindex between body rows and back up into the header', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const bodyRows = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[data-row-key]')];
  expect(bodyRows.length).to.be.greaterThan(1);
  const headers = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="header-cell"]')];

  headers[0]!.focus();
  headers[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement === bodyRows[0]).to.equal(true);

  bodyRows[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement === bodyRows[1]).to.equal(true);

  bodyRows[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement === bodyRows[0]).to.equal(true);

  bodyRows[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement === headers[0]).to.equal(true);

  bodyRows[0]!.focus();
  bodyRows[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement === bodyRows.at(-1)).to.equal(true);

  bodyRows.at(-1)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement === bodyRows[0]).to.equal(true);

  // Keys the grid does not own are left entirely alone.
  const ignored = new KeyboardEvent('keydown', {
    key: 'x',
    bubbles: true,
    cancelable: true,
  });
  bodyRows[0]!.dispatchEvent(ignored);
  await el.updateComplete;
  expect(ignored.defaultPrevented).to.equal(false);
  expect(el.shadowRoot!.activeElement === bodyRows[0]).to.equal(true);
});
