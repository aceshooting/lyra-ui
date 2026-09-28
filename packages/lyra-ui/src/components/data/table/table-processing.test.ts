import { expectDeprecatedUsage } from '../../../../test/expected-deprecations.js';
import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './table.js';
import '../../forms/select/select.js';
import type { LyraTable, TableColumn } from './table.js';
import { styles } from './table.styles.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { setForcedColors } from '../../../../test/wtr-media.js';
// Registers the real shipped `ar` catalog's `data` slice so the `lang="ar-EG"` resize-value
// test below (which only overrides `resizeValuePixels`) can render without tripping the
// dev-mode locale-fallback warning that strict-console platform lanes treat as fatal.
import '../../../translations/ar/data.js';
import { installTableTestHooks, type Row, columns, rows } from '../../../../test/table.js';
installTableTestHooks();


expectDeprecatedUsage('lr-table', 'attribute', 'accessible-label');
expectDeprecatedUsage('lr-table', 'property', 'accessibleLabel');


it('shows a rendered hover affordance on the public filter control', async () => {
  const el = (await fixture(html`<lr-table filterable></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;

  const filter = el.shadowRoot!.querySelector('[part="filter"]') as HTMLInputElement;
  const before = getComputedStyle(filter).backgroundColor;
  try {
    // A single `sendMouse` move resolves before the engine has necessarily processed the pointer
    // event it synthesized, so the poll below would be waiting on a hover that never arrived.
    await hoverUntilMatched(filter, 'the filter control never took the pointer');
    await waitUntil(() => getComputedStyle(filter).backgroundColor !== before, 'filter control hover fill never landed');
  } finally {
    await resetMouse();
  }
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

  expect(event.detail).to.deep.equal({ filterText: 'beta' });
  expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(1);
  expect(el.shadowRoot!.querySelector('[part="row"]')!.textContent).to.contain('Beta');
});

it('renders a localized, keyboard-reachable clear button once the filter field has a value, and hides it again once empty', async () => {
  const el = (await fixture(html`<lr-table filterable></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="filter-clear"]') === null).to.equal(true);

  const input = el.shadowRoot!.querySelector('[part="filter"]') as HTMLInputElement;
  input.value = 'beta';
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  await el.updateComplete;

  const clearButton = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="filter-clear"]');
  expect(clearButton).to.not.equal(null);
  expect(clearButton!.tagName).to.equal('BUTTON');
  expect(clearButton!.getAttribute('type')).to.equal('button');
  expect(clearButton!.getAttribute('aria-label')).to.equal('Clear');
  expect(clearButton!.tabIndex).to.equal(0);

  const eventPromise = oneEvent(el, 'lr-filter-change');
  clearButton!.click();
  const event = await eventPromise;
  await el.updateComplete;

  expect(event.detail).to.deep.equal({ filterText: '' });
  expect(el.filterText).to.equal('');
  expect(el.shadowRoot!.activeElement === input).to.equal(true);
  expect(el.shadowRoot!.querySelector('[part="filter-clear"]') === null).to.equal(true);
});

it('re-emits one focus and blur event for the internal filter instead of leaking duplicates', async () => {
  const el = (await fixture(html`<lr-table filterable></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('[part="filter"]') as HTMLInputElement;
  let focusCount = 0;
  let blurCount = 0;
  el.addEventListener('focus', () => focusCount++);
  el.addEventListener('blur', () => blurCount++);

  input.focus();
  input.blur();

  expect(focusCount).to.equal(1);
  expect(blurCount).to.equal(1);
});

it('filters without throwing over rows containing a circular reference or a BigInt', async () => {
  const cyclic: Record<string, unknown> = {
    id: 'c',
    name: 'Circular',
    score: 5n as unknown as number,
  };
  cyclic['self'] = cyclic;
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
  const hostile = {
    id: 'bad',
    name: 'Hostile',
    score: 0,
    toJSON: () => {
      throw new Error('nope');
    },
  };
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

it('folds a JSON.stringify undefined result (e.g. an undefined row) to the empty string in the default filter', async () => {
  const el = (await fixture(html`<lr-table filterable></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  // `JSON.stringify(undefined, replacer)` itself returns `undefined`, not a string -- the
  // default filter's `?? ''` fallback must fold that to the empty string instead of matching
  // everything (or throwing) when the row itself is `undefined`.
  el.rows = [...rows, undefined as unknown as Row];
  el.filterText = 'alpha';
  await el.updateComplete;

  expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(1);
  expect(el.shadowRoot!.querySelector('[part="row"]')!.textContent).to.contain('Alpha');
});

it('paginates client-side rows, updates its page, and emits page changes', async () => {
  const el = (await fixture(html`<lr-table page-size="1"></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(1);
  expect(el.shadowRoot!.querySelector('[part="row"]')!.textContent).to.contain('Alpha');

  const next = el
    .shadowRoot!.querySelector('lr-pagination')!
    .shadowRoot!.querySelector('[part~="next-button"]') as HTMLButtonElement;
  const eventPromise = oneEvent(el, 'lr-page-change');
  next.click();
  const event = await eventPromise;
  expect(event.detail).to.deep.equal({ page: 2 });
  expect(el.page).to.equal(2);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="row"]')!.textContent).to.contain('Beta');
});

it('forwards unknown-total server pagination into the nested pagination as its own indeterminate mode', async () => {
  const el = (await fixture(
    html`<lr-table pagination-mode="server" unknown-total page-size="1" total-items="-1"></lr-table>`
  )) as LyraTable<Row>;
  el.columns = columns;
  el.rows = [rows[0]!];
  el.rowKey = (r) => r.id;
  el.page = 1;
  await el.updateComplete;

  const nested = el.shadowRoot!.querySelector('lr-pagination')!;
  expect(nested, 'the footer stays mounted with no computable page count').to.exist;
  expect(nested.total).to.equal(-1);
  const previousButton = nested.shadowRoot!.querySelector(
    '[part~="previous-button"]'
  ) as HTMLButtonElement;
  const nextButton = nested.shadowRoot!.querySelector('[part~="next-button"]') as HTMLButtonElement;
  expect(previousButton.disabled, 'previous is disabled at page 1').to.equal(true);
  expect(nextButton.disabled, 'next stays enabled while has-next defaults true').to.equal(false);
});

it('disables next once has-next is false under unknown-total server pagination', async () => {
  const el = (await fixture(
    html`<lr-table pagination-mode="server" unknown-total .hasNext=${false} page-size="1" total-items="-1"></lr-table>`
  )) as LyraTable<Row>;
  el.columns = columns;
  el.rows = [rows[0]!];
  el.rowKey = (r) => r.id;
  el.page = 2;
  await el.updateComplete;

  const nested = el.shadowRoot!.querySelector('lr-pagination')!;
  const nextButton = nested.shadowRoot!.querySelector('[part~="next-button"]') as HTMLButtonElement;
  expect(nextButton.disabled).to.equal(true);
});

it('accepts has-next="false" as a plain-HTML attribute string, not just a property binding', async () => {
  const el = (await fixture(
    html`<lr-table pagination-mode="server" unknown-total has-next="false" page-size="1" total-items="-1"></lr-table>`
  )) as LyraTable<Row>;
  el.columns = columns;
  el.rows = [rows[0]!];
  el.rowKey = (r) => r.id;
  el.page = 2;
  await el.updateComplete;

  expect(el.hasNext).to.equal(false);
  const nested = el.shadowRoot!.querySelector('lr-pagination')!;
  const nextButton = nested.shadowRoot!.querySelector('[part~="next-button"]') as HTMLButtonElement;
  expect(nextButton.disabled).to.equal(true);
});

it('re-emits lr-page-change with the same { page } contract under unknown-total server pagination', async () => {
  const el = (await fixture(
    html`<lr-table pagination-mode="server" unknown-total page-size="1" total-items="-1"></lr-table>`
  )) as LyraTable<Row>;
  el.columns = columns;
  el.rows = [rows[0]!];
  el.rowKey = (r) => r.id;
  el.page = 1;
  await el.updateComplete;

  const nested = el.shadowRoot!.querySelector('lr-pagination')!;
  const nextButton = nested.shadowRoot!.querySelector('[part~="next-button"]') as HTMLButtonElement;
  const eventPromise = oneEvent(el, 'lr-page-change');
  nextButton.click();
  const event = await eventPromise;
  expect(event.detail).to.deep.equal({ page: 2 });
  // Server mode leaves `page` controlled -- the table never mutates it itself.
  expect(el.page).to.equal(1);
});

it('ignores unknown-total outside server pagination mode', async () => {
  const el = (await fixture(
    html`<lr-table unknown-total page-size="1"></lr-table>`
  )) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;

  const nested = el.shadowRoot!.querySelector('lr-pagination')!;
  expect(nested.total).to.equal(2); // client mode still derives a real total from the rows given
});

it('emits lr-sort when a sortable header is clicked', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const header = el.shadowRoot!.querySelectorAll('[part="header-cell"]')[1] as HTMLElement;
  setTimeout(() => header.click());
  const ev = await oneEvent(el, 'lr-sort');
  expect(ev.detail.sortKey).to.equal('score');
  expect(ev.detail.sortDir).to.equal('asc');
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
  expect(ev.detail.sortKey).to.equal('score');
  expect(ev.detail.sortDir).to.equal('asc');
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
  const ev = await oneEvent(el, 'lr-row-activate');
  expect(ev.detail.row).to.deep.equal(rows[1]); // Beta, now first after reversing
});

it('renders a visual sort-direction chevron only in the active sort column, marked aria-hidden', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.sortKey = 'score';
  el.sortDir = 'desc';
  await el.updateComplete;
  const [nameHeader, scoreHeader] = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="header-cell"]'),
  ] as [HTMLElement, HTMLElement];
  expect((nameHeader.querySelector('[part~="sort-icon"]')) == null).to.be.true;
  const icon = scoreHeader.querySelector('[part~="sort-icon"]');
  expect(icon != null).to.equal(true);
  expect(icon!.getAttribute('aria-hidden')).to.equal('true');
  expect(icon!.getAttribute('data-dir')).to.equal('desc');
  expect(icon!.querySelector('svg') != null).to.equal(true);
});

it('optionally keeps inactive sortable headers discoverable without changing sort semantics or geometry', async () => {
  const el = await fixture<LyraTable<Row>>(html`<lr-table sort-indicators="all" accessible-label="Results"
    .columns=${columns.map((column) => ({ ...column, sortable: true }))} .rows=${rows}></lr-table>`);
  const headers = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="header-cell"]')];
  const before = headers.map((header) => header.getBoundingClientRect().width);
  const icons = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="sort-icon-inactive"]')];
  expect(icons.length).to.equal(2);
  expect(headers.map((header) => header.getAttribute('aria-sort'))).to.deep.equal(['none', 'none']);
  expect(icons.every((icon) => icon.getAttribute('aria-hidden') === 'true' && icon.querySelector('svg'))).to.equal(true);
  expect(icons.every((icon) => icon.getBoundingClientRect().width > 0)).to.equal(true);
  headers[1]!.focus();
  await sendKeys({ press: 'Enter' });
  await el.updateComplete;
  expect(el.sortKey).to.equal('score');
  expect(headers[1]!.getAttribute('aria-sort')).to.equal('ascending');
  expect(el.shadowRoot!.querySelectorAll('[part~="sort-icon-active"]').length).to.equal(1);
  expect(headers.map((header) => header.getBoundingClientRect().width)).to.deep.equal(before);
  el.removeAttribute('sort-indicators');
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part~="sort-icon-inactive"]').length).to.equal(0);
  await expect(el).to.be.accessible();
});

it('retains server sort proposals, RTL placement and public inactive-icon styling', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div>
    <style>lr-table.sort-affordance::part(sort-icon-inactive) { color: rgb(17, 85, 153); }</style>
    <lr-table class="sort-affordance" dir="rtl" sort-mode="server" sort-indicators="all"
      accessible-label="Results" .columns=${columns.map((column) => ({ ...column, sortable: true }))}
      .rows=${rows}></lr-table>
  </div>`);
  const el = wrapper.querySelector<LyraTable<Row>>('lr-table')!;
  await el.updateComplete;
  const icon = el.shadowRoot!.querySelector<HTMLElement>('[part~="sort-icon-inactive"]')!;
  expect(icon !== null).to.equal(true);
  expect(getComputedStyle(icon).color).to.equal('rgb(17, 85, 153)');
  expect(parseFloat(getComputedStyle(icon).marginRight)).to.be.greaterThan(0);
  const header = el.shadowRoot!.querySelector<HTMLElement>('[part="header-cell"]')!;
  const proposal = oneEvent(el, 'lr-sort-request');
  header.click();
  const event = await proposal;
  expect(event.detail.sortKey).to.equal('name');
  expect(el.sortKey).to.equal('');
  expect(header.getAttribute('aria-sort')).to.equal('none');
  await setForcedColors('active');
  try {
    if (matchMedia('(forced-colors: active)').matches) {
      expect(getComputedStyle(icon).color).to.equal(getComputedStyle(header).color);
    }
  } finally { await setForcedColors('none'); }
});

it('flips the sort-icon rotation data-dir when sortDir changes from desc to asc', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.sortKey = 'score';
  el.sortDir = 'asc';
  await el.updateComplete;
  const scoreHeader = el.shadowRoot!.querySelectorAll('[part="header-cell"]')[1]!;
  const icon = scoreHeader.querySelector('[part~="sort-icon"]');
  expect(icon!.getAttribute('data-dir')).to.equal('asc');
});

it('rotates the wrapping [part~="sort-icon"] element, not the inner svg, per the icons.ts rotation contract', async () => {
  // internal/icons.ts documents: "callers needing 'up'/'left'/'open' etc.
  // rotate the wrapping part element via CSS transform: rotate(...), not the svg."
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.sortKey = 'score';
  el.sortDir = 'desc';
  await el.updateComplete;
  const scoreHeader = el.shadowRoot!.querySelectorAll('[part="header-cell"]')[1]!;
  const icon = scoreHeader.querySelector('[part~="sort-icon"]') as HTMLElement;
  const svgEl = icon.querySelector('svg') as unknown as HTMLElement;
  expect(getComputedStyle(icon).transform).to.not.equal('none');
  expect(getComputedStyle(svgEl).transform).to.equal('none');
});

it('applies the shared focus-ring outline to a sortable header cell, a row, and the more-button on :focus-visible', async () => {
  const wrapper = (await fixture(html`
    <div>
      <button type="button">before table</button>
      <lr-table></lr-table>
    </div>
  `)) as HTMLElement;
  const el = wrapper.querySelector('lr-table') as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  el.hasMore = true;
  await el.updateComplete;

  const header = el.shadowRoot!.querySelectorAll('[part="header-cell"]')[0] as HTMLElement;
  const row = el.shadowRoot!.querySelector('[part="row"]') as HTMLElement;
  const moreButton = el.shadowRoot!.querySelector('[part="more-button"]') as HTMLElement;
  const beforeTable = wrapper.querySelector('button') as HTMLButtonElement;
  beforeTable.focus();

  // :focus-visible is input-modality dependent. A programmatic focus happens to inherit the
  // keyboard state in Chromium, but Firefox correctly declines it after a mouse-oriented test.
  // Move through the real tab order so this assertion tests the rendered keyboard affordance in
  // every engine rather than the browser's last-modality heuristic.
  const tabTo = async (target: HTMLElement): Promise<void> => {
    for (let attempt = 0; attempt < 8; attempt++) {
      await sendKeys({ press: 'Tab' });
      if (el.shadowRoot!.activeElement === target) return;
    }
    expect(el.shadowRoot!.activeElement === target, 'Tab must reach the expected table stop').to.equal(true);
  };

  await tabTo(header);
  expect(getComputedStyle(header).outlineStyle).to.equal('solid');
  expect(getComputedStyle(header).outlineWidth).to.equal('2px');

  await tabTo(row);
  expect(getComputedStyle(row).outlineStyle).to.equal('solid');
  expect(getComputedStyle(row).outlineWidth).to.equal('2px');

  await tabTo(moreButton);
  expect(getComputedStyle(moreButton).outlineStyle).to.equal('solid');
  expect(getComputedStyle(moreButton).outlineWidth).to.equal('2px');
});

it('does not emit lr-sort when a non-sortable header is clicked or activated via keyboard', async () => {
  const mixedColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', cell: (r) => r.name },
    {
      key: 'score',
      label: 'Score',
      sortable: true,
      align: 'end',
      cell: (r) => r.score,
    },
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
    {
      key: 'score',
      label: 'Score',
      sortable: true,
      align: 'end',
      cell: (r) => r.score,
    },
  ];
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = mixedColumns;
  el.rows = rows;
  el.sortKey = 'score';
  el.sortDir = 'asc';
  await el.updateComplete;

  const [nameHeader, scoreHeader] = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="header-cell"]'),
  ] as [HTMLElement, HTMLElement];
  expect(nameHeader.hasAttribute('aria-sort')).to.be.false;
  expect(scoreHeader.getAttribute('aria-sort')).to.equal('ascending');

  el.sortDir = 'desc';
  await el.updateComplete;
  expect(scoreHeader.getAttribute('aria-sort')).to.equal('descending');

  el.sortKey = '';
  await el.updateComplete;
  expect(scoreHeader.getAttribute('aria-sort')).to.equal('none');
});

it("renders the filter placeholder color and undoes Firefox's reduced default opacity", async () => {
  const el = (await fixture(html`
    <lr-table filterable style="--lr-color-text-quiet: rgb(1, 2, 3)"></lr-table>
  `)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const filter = el.shadowRoot!.querySelector<HTMLInputElement>('[part="filter"]')!;
  const placeholder = getComputedStyle(filter, '::placeholder');
  expect(placeholder.color).to.equal('rgb(1, 2, 3)');
  expect(placeholder.opacity).to.equal('1');
});

it("resets the native search-cancel glyph on the filter field (matches lr-input's own unconditional reset)", () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='filter'\]\[type='search'\]::-webkit-search-cancel-button/);
  expect(css).to.match(/\[part='filter'\]\[type='search'\]::-webkit-search-decoration/);
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
    const [nameHeader, scoreHeader] = [...el.shadowRoot!.querySelectorAll('[part="header-cell"]')] as [HTMLElement, HTMLElement];
    expect(getComputedStyle(scoreHeader).backgroundColor).to.equal('rgb(7, 8, 9)');
    // The unsorted header must NOT pick up the token.
    expect(getComputedStyle(nameHeader).backgroundColor).to.not.equal('rgb(7, 8, 9)');
  });

  it('keeps the sorted header opaque so sticky rows cannot scroll through it (regression)', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    el.sortKey = 'score';
    await el.updateComplete;
    const scoreHeader = el.shadowRoot!.querySelectorAll('[part="header-cell"]')[1] as HTMLElement;
    // This cell is position: sticky. A transparent default let body rows scroll visibly through
    // the sorted column's header in any height-capped table; the untinted default must still be
    // an opaque surface fill.
    expect(getComputedStyle(scoreHeader).backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');

    el.style.setProperty('--lr-table-header-sorted-bg', 'rgb(1, 2, 3)');
    await el.updateComplete;
    expect(getComputedStyle(scoreHeader).backgroundColor).to.equal('rgb(1, 2, 3)');
  });

  it("gives a sorted, sticky header cell the sorted-header background instead of the sticky column's flat surface color (regression)", async () => {
    const stickyColumns: TableColumn<Row>[] = [
      { key: 'name', label: 'Name', sticky: 'start', sortable: true, cell: (r) => r.name },
      { key: 'score', label: 'Score', sortable: true, align: 'end', cell: (r) => r.score },
    ];
    const el = (await fixture(html`
      <lr-table style="--lr-table-header-sorted-bg: rgb(200, 0, 0);"></lr-table>
    `)) as LyraTable<Row>;
    el.columns = stickyColumns;
    el.rows = rows;
    el.sortKey = 'name';
    el.sortDir = 'asc';
    await el.updateComplete;

    const stickyHeader = el.shadowRoot!.querySelector('[part="header-cell"][data-sticky]') as HTMLElement;
    expect(stickyHeader.getAttribute('aria-sort'), 'the sticky column is the one under test').to.equal('ascending');
    // Before the fix, [part='header-cell'][data-sticky]'s opaque background: var(--lr-color-surface)
    // out-specifies the sorted rule ((0,2,0) vs (0,1,0)) regardless of source order, so this always
    // painted the plain surface color instead of the token above.
    expect(getComputedStyle(stickyHeader).backgroundColor).to.equal('rgb(200, 0, 0)');
  });

  it('lets a consumer ::part(header-cell) cursor override win over the internal sort/cursor rule', async () => {
    const el = (await fixture(html` <lr-table></lr-table> `)) as LyraTable<Row>;
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

describe('lr-table client-side sorting', () => {
  interface SortRow {
    id: string;
    name: string;
    score: number | null;
  }

  const sortColumns: TableColumn<SortRow>[] = [
    { key: 'name', label: 'Name', sortable: true, cell: (r) => r.name },
    {
      key: 'score',
      label: 'Score',
      sortable: true,
      sortValue: (r) => r.score,
      cell: (r) => r.score,
    },
  ];

  const sortRows: SortRow[] = [
    { id: 'bea', name: 'Bea', score: 2 },
    { id: 'amy', name: 'Amy', score: 3 },
    { id: 'cy', name: 'Cy', score: 1 },
  ];

  const sortTable = async (): Promise<LyraTable<SortRow>> => {
    const el = (await fixture(html`<lr-table accessible-label="Scores"></lr-table>`)) as LyraTable<SortRow>;
    el.columns = sortColumns;
    el.rows = sortRows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    return el;
  };

  const columnText = (el: LyraTable<SortRow>, key: string): string[] =>
    [...el.shadowRoot!.querySelectorAll(`tbody [data-col-key="${key}"]`)].map((cell) => cell.textContent!.trim());

  it('sorts rows client-side by the active column when sortMode is client', async () => {
    const el = await sortTable();
    el.sortMode = 'client';
    el.sortKey = 'score';
    el.sortDir = 'asc';
    await el.updateComplete;
    expect(columnText(el, 'name')).to.deep.equal(['Cy', 'Bea', 'Amy']);
  });

  it('reverses the client-side order when sortDir is desc', async () => {
    const el = await sortTable();
    el.sortKey = 'score';
    el.sortDir = 'desc';
    await el.updateComplete;
    expect(columnText(el, 'name')).to.deep.equal(['Amy', 'Bea', 'Cy']);
  });

  it('leaves row order untouched in server sort mode', async () => {
    const el = await sortTable();
    el.sortMode = 'server';
    el.sortKey = 'score';
    el.sortDir = 'desc';
    await el.updateComplete;
    expect(columnText(el, 'name')).to.deep.equal(['Bea', 'Amy', 'Cy']);
  });

  it('falls back to a locale-aware numeric string collator when a column has no sortValue', async () => {
    const el = (await fixture(html`<lr-table accessible-label="Scores"></lr-table>`)) as LyraTable<SortRow>;
    el.columns = [{ key: 'name', label: 'Name', sortable: true, cell: (r) => r.name }];
    el.rows = [
      { id: '10', name: 'item10', score: 0 },
      { id: '2', name: 'item2', score: 0 },
    ];
    el.rowKey = (r) => r.id;
    el.sortKey = 'name';
    el.sortDir = 'asc';
    await el.updateComplete;
    // A plain lexicographic compare would order item10 before item2.
    expect(columnText(el, 'name')).to.deep.equal(['item2', 'item10']);
  });

  it('sorts null/undefined sortValue results last regardless of direction', async () => {
    const el = (await fixture(html`<lr-table accessible-label="Scores"></lr-table>`)) as LyraTable<SortRow>;
    el.columns = sortColumns;
    el.rows = [
      { id: 'a', name: 'A', score: null },
      { id: 'b', name: 'B', score: 1 },
    ];
    el.rowKey = (r) => r.id;
    el.sortKey = 'score';
    el.sortDir = 'desc';
    await el.updateComplete;
    expect(columnText(el, 'name')).to.deep.equal(['B', 'A']);
    el.sortDir = 'asc';
    await el.updateComplete;
    expect(columnText(el, 'name')).to.deep.equal(['B', 'A']);
  });

  it('never sorts by a column that is not marked sortable', async () => {
    const el = (await fixture(html`<lr-table accessible-label="Scores"></lr-table>`)) as LyraTable<SortRow>;
    el.columns = [
      { key: 'name', label: 'Name', cell: (r) => r.name },
      {
        key: 'score',
        label: 'Score',
        sortValue: (r) => r.score,
        cell: (r) => r.score,
      },
    ];
    el.rows = sortRows;
    el.rowKey = (r) => r.id;
    el.sortKey = 'score';
    el.sortDir = 'asc';
    await el.updateComplete;
    expect(columnText(el, 'name')).to.deep.equal(['Bea', 'Amy', 'Cy']);
  });

  it('applies defaultSortDir when header activation switches to a different column, then toggles', async () => {
    const el = await sortTable();
    el.defaultSortDir = 'desc';
    await el.updateComplete;
    const scoreHeader = el.shadowRoot!.querySelectorAll('[part="header-cell"]')[1] as HTMLElement;
    scoreHeader.click();
    await el.updateComplete;
    expect(el.sortKey).to.equal('score');
    expect(el.sortDir).to.equal('desc');
    expect(columnText(el, 'name')).to.deep.equal(['Amy', 'Bea', 'Cy']);

    // Re-activating the already-sorted column toggles instead of re-seeding.
    scoreHeader.click();
    await el.updateComplete;
    expect(el.sortDir).to.equal('asc');
    expect(columnText(el, 'name')).to.deep.equal(['Cy', 'Bea', 'Amy']);

    // Switching to a different column re-applies defaultSortDir.
    const nameHeader = el.shadowRoot!.querySelectorAll('[part="header-cell"]')[0] as HTMLElement;
    nameHeader.click();
    await el.updateComplete;
    expect(el.sortKey).to.equal('name');
    expect(el.sortDir).to.equal('desc');
    expect(columnText(el, 'name')).to.deep.equal(['Cy', 'Bea', 'Amy']);
  });

  it('resolves the clicked row against the post-sort order (rowsByKey stays in step)', async () => {
    const el = await sortTable();
    el.sortKey = 'score';
    el.sortDir = 'asc';
    await el.updateComplete;
    const firstRow = el.shadowRoot!.querySelector('[part="row"]') as HTMLElement;
    setTimeout(() => firstRow.click());
    const ev = await oneEvent(el, 'lr-row-activate');
    expect(ev.detail.row.id).to.equal('cy');
  });

  it('sorts the current page from the whole matching set, not just the page slice', async () => {
    const el = await sortTable();
    el.pageSize = 2;
    el.page = 1;
    el.sortKey = 'score';
    el.sortDir = 'asc';
    await el.updateComplete;
    expect(columnText(el, 'name')).to.deep.equal(['Cy', 'Bea']);
  });

  it('keeps row identity across a client sort with no rowKey set', async () => {
    // keyOf() falls back to the row's index in `rows`, and the sort permutes entries while each
    // entry keeps that original index -- so identity survives a re-sort even without rowKey.
    const el = (await fixture(html`<lr-table accessible-label="Scores"></lr-table>`)) as LyraTable<SortRow>;
    el.columns = sortColumns;
    el.rows = sortRows;
    el.selectionMode = 'single';
    el.sortKey = 'score';
    el.sortDir = 'asc';
    await el.updateComplete;
    const firstRow = el.shadowRoot!.querySelector('[part="row"]') as HTMLElement;
    setTimeout(() => firstRow.click());
    const ev = await oneEvent(el, 'lr-row-activate');
    expect(ev.detail.row.id).to.equal('cy');
    await el.updateComplete;
    // 'cy' is index 2 in `rows`, so the index-based fallback key must be 2, not its sorted slot 0.
    expect([...el.selectedRowKeys]).to.deep.equal([2]);
    expect(firstRow.getAttribute('aria-selected')).to.equal('true');
  });

  it('collates through effectiveLocale, not a hardcoded locale', async () => {
    const localeRows: SortRow[] = [
      { id: 'z', name: 'zebra', score: 0 },
      { id: 'a', name: '\u00e4pple', score: 0 },
    ];
    const localeTable = async (locale: string): Promise<LyraTable<SortRow>> => {
      const el = (await fixture(html`<lr-table accessible-label="Scores"></lr-table>`)) as LyraTable<SortRow>;
      el.columns = [{ key: 'name', label: 'Name', sortable: true, cell: (r) => r.name }];
      el.rows = localeRows;
      el.rowKey = (r) => r.id;
      el.locale = locale;
      el.sortKey = 'name';
      await el.updateComplete;
      return el;
    };
    // German collates 'a-umlaut' alongside 'a'; Swedish collates it after 'z'. A hardcoded 'en'
    // (or a bare `undefined`) would produce the German order for both.
    expect(columnText(await localeTable('de'), 'name')).to.deep.equal(['\u00e4pple', 'zebra']);
    expect(columnText(await localeTable('sv'), 'name')).to.deep.equal(['zebra', '\u00e4pple']);
  });

  it('is accessible while client-sorted', async () => {
    const el = await sortTable();
    el.sortKey = 'score';
    el.sortDir = 'desc';
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it('leaves row order and sort state untouched with sortMode/defaultSortDir/sortValue unset (regression)', async () => {
    const el = (await fixture(html`<lr-table accessible-label="Scores"></lr-table>`)) as LyraTable<SortRow>;
    el.columns = [
      { key: 'name', label: 'Name', sortable: true, cell: (r) => r.name },
      { key: 'score', label: 'Score', sortable: true, cell: (r) => r.score },
    ];
    el.rows = sortRows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    // Defaults: sortMode 'client', but no sortKey => the input order is preserved verbatim.
    expect(el.sortKey).to.equal('');
    expect(el.sortDir).to.equal('asc');
    expect(el.sortMode).to.equal('client');
    expect(el.defaultSortDir).to.equal('asc');
    expect(columnText(el, 'name')).to.deep.equal(['Bea', 'Amy', 'Cy']);
    expect(columnText(el, 'score')).to.deep.equal(['2', '3', '1']);
  });
});

describe('lr-table client-side sorting with groupBy', () => {
  interface GroupSortRow {
    id: string;
    name: string;
    score: number;
    team: string;
  }

  const groupSortColumns: TableColumn<GroupSortRow>[] = [
    { key: 'name', label: 'Name', sortable: true, cell: (r) => r.name },
    {
      key: 'score',
      label: 'Score',
      sortable: true,
      sortValue: (r) => r.score,
      cell: (r) => r.score,
    },
  ];

  // Groups are contiguous in input order, and 'Zeta' appears before 'Alpha' so a group ordering
  // derived by collating the group keys is distinguishable from one that follows first appearance.
  const groupSortRows: GroupSortRow[] = [
    { id: 'a', name: 'Alpha', score: 3, team: 'Zeta' },
    { id: 'b', name: 'Bravo', score: 1, team: 'Zeta' },
    { id: 'c', name: 'Cody', score: 4, team: 'Alpha' },
    { id: 'd', name: 'Dana', score: 2, team: 'Alpha' },
  ];

  const groupedTable = async (): Promise<LyraTable<GroupSortRow>> => {
    const el = (await fixture(html`<lr-table accessible-label="Scores"></lr-table>`)) as LyraTable<GroupSortRow>;
    el.columns = groupSortColumns;
    el.rows = groupSortRows;
    el.rowKey = (r) => r.id;
    el.groupBy = (r) => r.team;
    await el.updateComplete;
    return el;
  };

  const nameText = (el: LyraTable<GroupSortRow>): string[] =>
    [...el.shadowRoot!.querySelectorAll('tbody [data-col-key="name"]')].map((cell) => cell.textContent!.trim());
  const groupText = (el: LyraTable<GroupSortRow>): string[] =>
    [...el.shadowRoot!.querySelectorAll('[part="group-cell"]')].map((cell) => cell.textContent!.trim());

  it('keeps each group contiguous when client-sorting on a non-group column', async () => {
    const el = await groupedTable();
    el.sortKey = 'score';
    el.sortDir = 'asc';
    await el.updateComplete;
    // A flat global sort would interleave the teams (Bravo/Zeta, Dana/Alpha, Alpha/Zeta,
    // Cody/Alpha) and emit a group header before nearly every row.
    expect(groupText(el)).to.have.lengthOf(2);
    expect(nameText(el)).to.deep.equal(['Bravo', 'Alpha', 'Dana', 'Cody']);
  });

  it('orders groups by first appearance in rows, not by collating the group key', async () => {
    const el = await groupedTable();
    el.sortKey = 'score';
    el.sortDir = 'asc';
    await el.updateComplete;
    expect(groupText(el)).to.deep.equal(['Zeta', 'Alpha']);
  });

  it('sorts within groups in desc as well', async () => {
    const el = await groupedTable();
    el.sortKey = 'score';
    el.sortDir = 'desc';
    await el.updateComplete;
    expect(groupText(el)).to.deep.equal(['Zeta', 'Alpha']);
    expect(nameText(el)).to.deep.equal(['Alpha', 'Bravo', 'Cody', 'Dana']);
  });

  it('leaves a grouped table untouched with no sortKey (regression)', async () => {
    const el = await groupedTable();
    expect(groupText(el)).to.deep.equal(['Zeta', 'Alpha']);
    expect(nameText(el)).to.deep.equal(['Alpha', 'Bravo', 'Cody', 'Dana']);
  });

  it('does not group-partition in server sort mode', async () => {
    const el = await groupedTable();
    el.sortMode = 'server';
    el.sortKey = 'score';
    el.sortDir = 'asc';
    await el.updateComplete;
    expect(nameText(el)).to.deep.equal(['Alpha', 'Bravo', 'Cody', 'Dana']);
  });

  it('is accessible while client-sorted inside groups', async () => {
    const el = await groupedTable();
    el.sortKey = 'score';
    el.sortDir = 'asc';
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  // A column whose value never varies inside a group (the group column itself being the obvious
  // case) makes the within-group sort provably inert -- every comparison ties. Sorting only the
  // rows would leave `aria-sort`/the chevron announcing an ordering the table never applied, so
  // the groups themselves have to move instead.
  const teamColumns: TableColumn<GroupSortRow>[] = [
    ...groupSortColumns,
    { key: 'team', label: 'Team', sortable: true, cell: (r) => r.team },
  ];
  const ariaSortFor = (el: LyraTable<GroupSortRow>, key: string): string | null =>
    el.shadowRoot!.querySelector(`thead [data-col-key="${key}"]`)!.getAttribute('aria-sort');

  it('reorders the groups when the active sort column is constant within every group', async () => {
    const el = await groupedTable();
    el.columns = teamColumns;
    el.sortKey = 'team';
    el.sortDir = 'asc';
    await el.updateComplete;
    // Input order is Zeta then Alpha; an ascending sort on the group column must actually move it.
    expect(groupText(el)).to.deep.equal(['Alpha', 'Zeta']);
    expect(nameText(el)).to.deep.equal(['Cody', 'Dana', 'Alpha', 'Bravo']);
    // ... and the announced ordering must now be one the table genuinely applied.
    expect(ariaSortFor(el, 'team')).to.equal('ascending');
  });

  it('flips the group order when a group-constant sort is descending', async () => {
    const el = await groupedTable();
    el.columns = teamColumns;
    el.sortKey = 'team';
    el.sortDir = 'desc';
    await el.updateComplete;
    expect(groupText(el)).to.deep.equal(['Zeta', 'Alpha']);
    expect(nameText(el)).to.deep.equal(['Alpha', 'Bravo', 'Cody', 'Dana']);
    expect(ariaSortFor(el, 'team')).to.equal('descending');
  });

  it('keeps group order by first appearance when the sort column varies within a group', async () => {
    const el = await groupedTable();
    el.columns = teamColumns;
    el.sortKey = 'score';
    el.sortDir = 'asc';
    await el.updateComplete;
    // `score` varies inside both teams, so the within-group sort is real and the groups must not
    // be reordered -- the pre-existing first-appearance contract still holds.
    expect(groupText(el)).to.deep.equal(['Zeta', 'Alpha']);
    expect(nameText(el)).to.deep.equal(['Bravo', 'Alpha', 'Dana', 'Cody']);
  });
});

describe('sticky + sortable header pointer feedback', () => {
  // columns[].sticky and columns[].sortable are both public options and compose freely, so a
  // pinned sort column is ordinary usage, not a corner case.
  const stickySortableColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', sortable: true, sticky: 'start', cell: (r) => r.name },
    { key: 'score', label: 'Score', sortable: true, cell: (r) => r.score },
  ];

  /** Resolves what a `declaration` computes to *inside this component's shadow root*, where the
   *  `--lr-*` design tokens live. */
  function resolvedInShadow(el: LyraTable<Row>, declaration: string, property: string): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    el.shadowRoot!.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  async function stickyTable(): Promise<LyraTable<Row>> {
    const el = (await fixture(html`
      <lr-table
        style="--lr-transition-fast: 0s"
        accessible-label="Scores"
        .columns=${stickySortableColumns}
        .rows=${rows}
      ></lr-table>
    `)) as LyraTable<Row>;
    await el.updateComplete;
    return el;
  }

  function stickyHeader(el: LyraTable<Row>): HTMLElement {
    return el.shadowRoot!.querySelector(
      "[part='header-cell'][data-sortable][data-sticky]"
    ) as HTMLElement;
  }

  /** Land the pointer on `target` and wait until the engine has actually applied `:hover` to it.
   *  A single `sendMouse` move resolves when the synthesized command completes, which is not when
   *  the browser has processed the resulting native pointer event -- and a pinned header can settle
   *  out from under an already-dispatched position. `hoverUntilMatched` scrolls, re-reads the rect
   *  and re-dispatches until `:hover` really matches. */
  async function landPointerOn(target: HTMLElement): Promise<void> {
    await hoverUntilMatched(target, 'the pinned sortable header never took the pointer');
  }

  it('tints a pinned sortable header while it is hovered', async function () {
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) this.skip();
    const el = await stickyTable();
    const header = stickyHeader(el);
    expect(header != null, 'expected a sticky sortable header cell').to.equal(true);
    const hovered = resolvedInShadow(el, 'background: var(--lr-color-brand-quiet)', 'background-color');
    expect(getComputedStyle(header).backgroundColor).to.not.equal(hovered);

    try {
      await resetMouse();
      await landPointerOn(header);
      await waitUntil(
        () => getComputedStyle(header).backgroundColor === hovered,
        'the hovered sticky sortable header kept its opaque surface fill'
      );
    } finally {
      await resetMouse();
    }
  });

  it('deepens a pinned sortable header while it is held', async function () {
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) this.skip();
    const el = await stickyTable();
    const header = stickyHeader(el);
    const held = resolvedInShadow(
      el,
      'background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active))',
      'background-color'
    );
    expect(getComputedStyle(header).backgroundColor).to.not.equal(held);

    try {
      await resetMouse();
      await landPointerOn(header);
      await sendMouse({ type: 'down' });
      await waitUntil(
        () => getComputedStyle(header).backgroundColor === held,
        'the held sticky sortable header kept its opaque surface fill'
      );
    } finally {
      await sendMouse({ type: 'up' });
      await resetMouse();
    }
  });

  it('restores the opaque surface fill once the pointer leaves, so body rows cannot scroll through it', async function () {
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) this.skip();
    const el = await stickyTable();
    const header = stickyHeader(el);
    const surface = resolvedInShadow(el, 'background: var(--lr-color-surface)', 'background-color');
    expect(getComputedStyle(header).backgroundColor).to.equal(surface);

    try {
      await resetMouse();
      await landPointerOn(header);
      await waitUntil(
        () => getComputedStyle(header).backgroundColor !== surface,
        'the hovered sticky sortable header kept its opaque surface fill'
      );
    } finally {
      await resetMouse();
    }
    await waitUntil(
      () => getComputedStyle(header).backgroundColor === surface,
      'the sticky sortable header never returned to its opaque surface fill'
    );
  });
});

describe("lr-table contains the composed lr-pagination's lr-activate", () => {
  it('swallows it on a re-request of the page already shown, like every other pagination event', async () => {
    const el = (await fixture(html`<lr-table page-size="1"></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;

    const pagination = el.shadowRoot!.querySelector('lr-pagination') as HTMLElement & {
      readonly updateComplete: Promise<boolean>;
    };
    await pagination.updateComplete;
    const pageInput = pagination.shadowRoot!.querySelector<HTMLInputElement>('[part="page-input"]');
    expect(pageInput, 'the compact footer renders the page-jump input').to.exist;

    let escaped = 0;
    let onChild = 0;
    let pageChanges = 0;
    const escapedListener = (): void => {
      escaped++;
    };
    // Added AFTER the template's own `@lr-activate` binding, on the same node: `stopPropagation()`
    // does not silence a same-node listener, so this proves the child really emitted rather than
    // the assertion passing because nothing fired at all.
    const childListener = (): void => {
      onChild++;
    };
    const pageChangeListener = (): void => {
      pageChanges++;
    };
    document.addEventListener('lr-activate', escapedListener);
    pagination.addEventListener('lr-activate', childListener);
    el.addEventListener('lr-page-change', pageChangeListener);
    try {
      pageInput!.value = '1';
      pageInput!.dispatchEvent(new Event('change', { bubbles: true }));
      await el.updateComplete;
    } finally {
      document.removeEventListener('lr-activate', escapedListener);
      pagination.removeEventListener('lr-activate', childListener);
      el.removeEventListener('lr-page-change', pageChangeListener);
    }

    expect(onChild, 'the composed pagination did report the re-request').to.equal(1);
    expect(pageChanges, 'a re-request of the current page moves nothing').to.equal(0);
    expect(el.page, 'the re-request changed nothing').to.equal(1);
    expect(
      escaped,
      "lr-table's documented event surface is lr-page-change; the child's raw event never escapes",
    ).to.equal(0);
  });
});

describe("lr-table contains the composed lr-pagination's lr-before-page-change", () => {
  async function pagedTable(): Promise<{
    el: LyraTable<Row>;
    pagination: HTMLElement & { readonly updateComplete: Promise<boolean> };
  }> {
    const el = (await fixture(html`<lr-table page-size="1"></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    const pagination = el.shadowRoot!.querySelector('lr-pagination') as HTMLElement & {
      readonly updateComplete: Promise<boolean>;
    };
    await pagination.updateComplete;
    return { el, pagination };
  }

  it('keeps the proposal inside the table for native pointer and keyboard activation while lr-page-change still reports', async () => {
    const { el, pagination } = await pagedTable();
    const nextButton = pagination.shadowRoot!.querySelector<HTMLButtonElement>('[part~="next-button"]')!;
    const previousButton = pagination.shadowRoot!.querySelector<HTMLButtonElement>(
      '[part~="previous-button"]',
    )!;
    const leaked: string[] = [];
    const onHost = (event: Event): void => {
      leaked.push(`host:${event.type}`);
    };
    const onDocument = (event: Event): void => {
      leaked.push(`document:${event.type}`);
    };
    const proposals: CustomEvent<{ page: number }>[] = [];
    const pageChanges: number[] = [];
    const onProposal = (event: Event): void => {
      proposals.push(event as CustomEvent<{ page: number }>);
    };
    const onPageChange = (event: Event): void => {
      pageChanges.push((event as CustomEvent<{ page: number }>).detail.page);
    };
    pagination.addEventListener('lr-before-page-change', onProposal);
    el.addEventListener('lr-page-change', onPageChange);
    el.addEventListener('lr-before-page-change', onHost);
    document.addEventListener('lr-before-page-change', onDocument);
    try {
      await resetMouse();
      nextButton.scrollIntoView({ block: 'center', inline: 'center' });
      const rect = nextButton.getBoundingClientRect();
      await sendMouse({
        type: 'click',
        position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      });
      await waitUntil(() => el.page === 2, 'native pointer activation did not move the page');
      await pagination.updateComplete;

      previousButton.focus();
      await sendKeys({ press: 'Enter' });
      await waitUntil(() => el.page === 1, 'keyboard activation did not move the page');
    } finally {
      await resetMouse();
      pagination.removeEventListener('lr-before-page-change', onProposal);
      el.removeEventListener('lr-page-change', onPageChange);
      el.removeEventListener('lr-before-page-change', onHost);
      document.removeEventListener('lr-before-page-change', onDocument);
    }

    expect(leaked).to.deep.equal([]);
    expect(proposals.map((event) => event.detail.page)).to.deep.equal([2, 1]);
    expect(
      proposals.map((event) => event.defaultPrevented),
      'containment never cancels the child proposal',
    ).to.deep.equal([false, false]);
    expect(pageChanges).to.deep.equal([2, 1]);
  });

  it('keeps a pagination-level veto authoritative while containing the proposal', async () => {
    const { el, pagination } = await pagedTable();
    const nextButton = pagination.shadowRoot!.querySelector<HTMLButtonElement>('[part~="next-button"]')!;
    const leaked: string[] = [];
    const onHost = (event: Event): void => {
      leaked.push(`host:${event.type}`);
    };
    const onDocument = (event: Event): void => {
      leaked.push(`document:${event.type}`);
    };
    const vetoes: boolean[] = [];
    let pageChanges = 0;
    const onProposal = (event: Event): void => {
      event.preventDefault();
      vetoes.push(event.defaultPrevented);
    };
    const onPageChange = (): void => {
      pageChanges += 1;
    };
    pagination.addEventListener('lr-before-page-change', onProposal);
    el.addEventListener('lr-page-change', onPageChange);
    el.addEventListener('lr-before-page-change', onHost);
    document.addEventListener('lr-before-page-change', onDocument);
    try {
      nextButton.focus();
      await sendKeys({ press: 'Enter' });
      await waitUntil(() => vetoes.length === 1, 'keyboard activation did not propose a page');
      await el.updateComplete;
    } finally {
      pagination.removeEventListener('lr-before-page-change', onProposal);
      el.removeEventListener('lr-page-change', onPageChange);
      el.removeEventListener('lr-before-page-change', onHost);
      document.removeEventListener('lr-before-page-change', onDocument);
    }

    expect(vetoes).to.deep.equal([true]);
    expect(leaked).to.deep.equal([]);
    expect(pageChanges).to.equal(0);
    expect(el.page).to.equal(1);
  });
});
