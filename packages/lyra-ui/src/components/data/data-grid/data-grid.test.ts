import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';
import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { toRgba } from '../../../../test/color-contrast.js';
import './data-grid.js';
import type { LyraDataGrid } from './data-grid.js';
import type { DataGridColumn } from './data-grid-types.js';
import { type Person, columns, rows, dataGrid, measurementAccess, delay, header, dataCells, valueGrid } from '../../../../test/data-grid.js';


expectLocaleFallback('fa', ['dataGridRowsPerPage', 'next', 'paginationFirstPage', 'paginationJumpToPage', 'paginationLabel', 'paginationLastPage', 'previous', 'tableFilterLabel']);

it('keeps each row-size baseline and measures the same minimum after inherited density and row-input changes', async () => {
  const densityResponse = await fetch(new URL('../../../density.css', import.meta.url));
  expect(densityResponse.ok).to.equal(true);
  const wrapper = await fixture<HTMLElement>(html`
    <div>
      <style>${await densityResponse.text()}</style>
      <section data-lr-density="comfortable">
        <lr-data-grid label="Rows" size="s" .columns=${columns} .data=${rows}></lr-data-grid>
      </section>
    </div>
  `);
  const scope = wrapper.querySelector<HTMLElement>('section')!;
  const element = scope.querySelector<LyraDataGrid<Person>>('lr-data-grid')!;
  await element.updateComplete;
  const row = () => element.shadowRoot!.querySelector<HTMLElement>('[part~="row"]')!;
  const minimum = () => Number.parseFloat(getComputedStyle(row()).minBlockSize);
  const state = measurementAccess(element);
  const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  for (const [size, expected] of [['xs', 2], ['s', 2.5], ['m', 3.5], ['l', 4], ['xl', 5]] as const) {
    element.size = size;
    await element.updateComplete;
    expect(minimum(), size).to.be.closeTo(expected * rem, 0.05);
  }
  element.size = 's';
  await element.updateComplete;
  scope.setAttribute('data-lr-density', 'compact');
  state.measuredItemHeights.set('row:number:offscreen', 120);
  state.measureRenderedItems();
  expect(minimum()).to.be.closeTo(Math.max(24, 2.5 * rem * 0.85), 0.05);
  expect(state.measurementRowHeight!).to.be.closeTo(minimum(), 0.05);
  expect(state.measuredItemHeights.has('row:number:offscreen')).to.equal(false);

  scope.setAttribute('data-lr-theme-scope', '');
  scope.style.setProperty('--lr-theme-table-row-height', '80px');
  state.measureRenderedItems();
  expect(minimum()).to.be.closeTo(68, 0.05);
  expect(state.measurementRowHeight!).to.be.closeTo(minimum(), 0.05);
  element.style.setProperty('--row-height', '31px');
  state.measureRenderedItems();
  expect(minimum()).to.equal(31);
  expect(state.measurementRowHeight).to.equal(31);
  element.style.setProperty('--row-height', '1px');
  state.measureRenderedItems();
  expect(minimum()).to.equal(24);
  expect(state.measurementRowHeight).to.equal(24);

  scope.setAttribute('data-lr-density', 'touch');
  state.measureRenderedItems();
  expect(minimum()).to.be.closeTo(Math.max(44, 2.75 * rem), 0.05);
  expect(state.measurementRowHeight!).to.be.closeTo(minimum(), 0.05);
  expect(row().getBoundingClientRect().height).to.be.at.least(minimum());

  element.style.removeProperty('--row-height');
  scope.style.removeProperty('--lr-theme-table-row-height');
  scope.setAttribute('data-lr-density', 'comfortable');
  state.measureRenderedItems();
  expect(minimum()).to.be.closeTo(2.5 * rem, 0.05);
  expect(state.measurementRowHeight!).to.be.closeTo(minimum(), 0.05);
});

it("themes formatter and row-detail links inside the grid shadow root", async () => {
  const linkedColumns: DataGridColumn<Person>[] = [
    {
      field: "name",
      label: "Name",
      formatter: (value) => html`<a href="#name">${value}</a>`,
    },
    {
      field: "team",
      label: "Team",
      formatter: (value) =>
        html`<a href="#team" style="color: rgb(9, 9, 9)">${value}</a>`,
    },
  ];
  const element = await dataGrid(html`
    <lr-data-grid
      label="Linked people"
      row-key="id"
      style="--lr-data-grid-cell-color: rgb(1, 2, 3); --lr-data-grid-cell-link-color: rgb(4, 5, 6); --lr-data-grid-cell-link-hover-color: rgb(7, 8, 9)"
      .columns=${linkedColumns}
      .data=${[rows[0]!]}
      .rowDetail=${(row: Person) =>
        html`<a href="#detail">Details for ${row.name}</a>`}
      .expandedKeys=${[1]}
    ></lr-data-grid>
  `);
  const cell = element.shadowRoot!.querySelector<HTMLElement>(
    '[part~="cell"][data-column-id="name"]'
  )!;
  const cellLink = cell.querySelector<HTMLAnchorElement>("a")!;
  const inlineLink = element.shadowRoot!.querySelector<HTMLAnchorElement>(
    '[part~="cell"][data-column-id="team"] a'
  )!;
  const detailLink = element.shadowRoot!.querySelector<HTMLAnchorElement>(
    '[part="row-detail"] a'
  )!;

  expect(getComputedStyle(cell).color).to.equal("rgb(1, 2, 3)");
  expect(getComputedStyle(cellLink).color).to.equal("rgb(4, 5, 6)");
  expect(getComputedStyle(detailLink).color).to.equal("rgb(4, 5, 6)");
  expect(getComputedStyle(inlineLink).color).to.equal("rgb(9, 9, 9)");

  cellLink.scrollIntoView();
  const rect = cellLink.getBoundingClientRect();
  try {
    await sendMouse({
      type: "move",
      position: [
        Math.round(rect.left + rect.width / 2),
        Math.round(rect.top + rect.height / 2),
      ],
    });
    await delay(20);
    expect(getComputedStyle(cellLink).color).to.equal("rgb(7, 8, 9)");
  } finally {
    await resetMouse();
  }
});

it("exposes the exact public defaults", async () => {
  const element = await dataGrid();
  expect(element.appearance).to.equal("outlined");
  expect(element.childRows).to.equal(null);
  expect(element.columnOrder).to.deep.equal([]);
  expect(element.columns).to.deep.equal([]);
  expect(element.data).to.deep.equal([]);
  expect(element.dataSource).to.equal(null);
  expect(element.expandedRowKeys).to.deep.equal([]);
  expect(element.expandedKeys).to.deep.equal([]);
  expect(element.filterDebounce).to.equal(250);
  expect(element.filteredCount).to.equal(0);
  expect(element.filterFromLeafRows).to.equal(false);
  expect(element.filters).to.deep.equal([]);
  expect(element.groupBy).to.equal(null);
  expect(element.loading).to.equal(false);
  expect(element.maxMultiSort).to.equal(0);
  expect(element.page).to.equal(0);
  expect(element.pageCount).to.equal(0);
  expect(element.pageSize).to.equal(20);
  expect(element.pageSizeOptions).to.deep.equal([10, 20, 50, 100]);
  expect(element.paginate).to.equal(false);
  expect(element.pinnable).to.equal(false);
  expect(element.reorderable).to.equal(false);
  expect(element.resizable).to.equal(false);
  expect(element.rowClass).to.equal(null);
  expect(element.rowDetail === null).to.equal(true);
  expect(element.rowKey).to.equal(null);
  expect(element.searchFn).to.equal(null);
  expect(element.searchTerm).to.equal("");
  expect(element.selectable).to.equal("none");
  expect(element.selectableRows).to.equal(null);
  expect(element.selectedRowKeys).to.deep.equal([]);
  expect(element.selectedKeys).to.deep.equal([]);
  expect(element.selectedRows).to.deep.equal([]);
  expect(element.server).to.equal(false);
  expect(element.size).to.equal("m");
  expect(element.sort).to.deep.equal([]);
  expect(element.sortDescFirst).to.equal(false);
  expect(element.striped).to.equal(false);
  expect(element.total).to.equal(-1);
  expect(element.withColumnMenu).to.equal(false);
  expect(element.withColumnsMenu).to.equal(false);
  expect(element.withoutSortRemoval).to.equal(false);
  expect(element.withSearch).to.equal(false);
});

it('treats a primitive (non-object, non-function) row as having no identity, without throwing', async () => {
  const element = await dataGrid();
  element.data = ['just a string', 42, true] as unknown as Person[];
  expect(() => element.getVisibleRows()).to.not.throw();
  expect(element.getVisibleRows().length).to.equal(0);
});

it('falls back to no identity when the rowKey path accessor throws on the row', async () => {
  const poisoned = {
    get id(): string {
      throw new Error('boom');
    },
    name: 'Poisoned',
    team: 'Runtime',
    score: 1,
  };
  const element = await dataGrid();
  element.rowKey = 'id';
  element.data = [poisoned as unknown as Person, rows[0]!];
  await element.updateComplete;
  expect(() => element.getVisibleRows()).to.not.throw();
  expect(element.getVisibleRows().map((row) => row.name)).to.deep.equal(['Ada']);
});

it("implements all 26 public methods", async () => {
  const element = await dataGrid();
  const methods = [
    "autoSizeColumn",
    "autoSizeColumns",
    "collapseAllRows",
    "collapseRow",
    "copySelectedRows",
    "expandAllRows",
    "expandRow",
    "exportDataAsCsv",
    "focus",
    "getColumnFacets",
    "getColumnPin",
    "getDataAsCsv",
    "getProcessedRows",
    "getState",
    "getVisibleRows",
    "handleColumnsChange",
    "handlePageChange",
    "handleSearchTermChange",
    "pinColumn",
    "reload",
    "resetColumns",
    "resetState",
    "scrollToIndex",
    "setState",
    "sizeColumnsToFit",
    "toggleColumn",
  ];
  for (const method of methods)
    expect(typeof element[method as keyof LyraDataGrid]).to.equal("function");
});

it("renders a named grid, populated cells, and an axe-clean empty state", async () => {
  const populated = await dataGrid(html`
    <lr-data-grid
      label="People"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const grid = populated.shadowRoot!.querySelector('[role="grid"]')!;
  expect(grid.getAttribute("aria-label")).to.equal("People");
  expect(populated.shadowRoot!.querySelectorAll('[role="row"]')).to.have.length(
    4
  );
  expect(populated.shadowRoot!.textContent).to.contain("Ada");
  await expect(populated).to.be.accessible();

  const empty = await dataGrid();
  expect(empty.shadowRoot!.querySelector('[part="empty"]')).to.exist;
  await expect(empty).to.be.accessible();
});

it("accepts foreign-realm event targets and ignores nested interactive activations", async () => {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const frameWindow = frame.contentWindow!;
  const interactiveColumns: DataGridColumn<Person>[] = [
    { field: "name", label: "Name", sortable: true, filterable: true },
  ];
  const element = await dataGrid(html`
    <lr-data-grid
      label="Foreign events"
      .columns=${interactiveColumns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const internals = element as unknown as {
    applySearchTermChange(value: string | Event): void;
    onPageSizeChange(event: Event): void;
    onBodyScroll(event: Event): void;
    onHeaderClick(event: MouseEvent, id: string): void;
    onCellClick(
      event: MouseEvent,
      item: unknown,
      column: DataGridColumn<Person>,
      columnIdValue: string,
      index: number
    ): void;
    processedClientRows: Array<{ kind: "row"; row: Person }>;
    bodyScrollTop: number;
  };

  try {
    const search = frameDocument.createElement("input");
    search.value = "foreign search";
    search.addEventListener("input", (event) =>
      internals.applySearchTermChange(event)
    );
    search.dispatchEvent(new frameWindow.Event("input"));
    expect(element.searchTerm).to.equal("foreign search");

    const pageSize = frameDocument.createElement("select");
    pageSize.append(new frameWindow.Option("1", "1"));
    pageSize.value = "1";
    pageSize.addEventListener("change", (event) =>
      internals.onPageSizeChange(event)
    );
    pageSize.dispatchEvent(new frameWindow.Event("change"));
    expect(element.pageSize).to.equal(1);

    const body = frameDocument.createElement("div");
    Object.defineProperties(body, {
      scrollTop: { configurable: true, value: 37 },
      clientHeight: { configurable: true, value: 90 },
    });
    body.addEventListener("scroll", (event) => internals.onBodyScroll(event));
    body.dispatchEvent(new frameWindow.Event("scroll"));
    expect(internals.bodyScrollTop).to.equal(37);

    const header = frameDocument.createElement("div");
    const filterButton = frameDocument.createElement("button");
    header.append(filterButton);
    header.addEventListener("click", (event) =>
      internals.onHeaderClick(event, "name")
    );
    filterButton.click();
    expect(element.sort).to.deep.equal([]);

    const cell = frameDocument.createElement("div");
    const nestedButton = frameDocument.createElement("button");
    cell.append(nestedButton);
    let cellEvents = 0;
    element.addEventListener("lr-cell-click", () => cellEvents++);
    const rowItem = internals.processedClientRows[0]!;
    cell.addEventListener("click", (event) => {
      internals.onCellClick(event, rowItem, interactiveColumns[0]!, 'name', 0);
    });
    nestedButton.click();
    expect(cellEvents).to.equal(0);
  } finally {
    element.remove();
    frame.remove();
  }
});

it("emits cell activation details and makes context-menu cancellation suppress native behavior", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="Cell events"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const cell = dataCells(element)[0]!;
  const clickEvent = oneEvent(element, "lr-cell-click");
  cell.click();
  const clicked = await clickEvent;
  expect(clicked.detail.row.id).to.equal(1);
  expect(clicked.detail.rowKey).to.equal('row-occurrence-1');
  expect(clicked.detail.columnId).to.equal('name');
  expect(clicked.detail.value).to.equal("Ada");
  expect(clicked.detail.index).to.equal(0);
  expect(clicked.bubbles).to.equal(true);
  expect(clicked.composed).to.equal(true);
  expect(clicked.cancelable).to.equal(false);

  let contextEvent: CustomEvent | undefined;
  element.addEventListener(
    "lr-cell-contextmenu",
    (event) => {
      contextEvent = event;
      event.preventDefault();
    },
    { once: true }
  );
  const nativeContext = new MouseEvent("contextmenu", {
    bubbles: true,
    composed: true,
    cancelable: true,
  });
  cell.dispatchEvent(nativeContext);
  expect(contextEvent?.cancelable).to.equal(true);
  expect(contextEvent?.bubbles).to.equal(true);
  expect(contextEvent?.composed).to.equal(true);
  expect(nativeContext.defaultPrevented).to.equal(true);

  const uncanceled = new MouseEvent("contextmenu", {
    bubbles: true,
    composed: true,
    cancelable: true,
  });
  cell.dispatchEvent(uncanceled);
  expect(uncanceled.defaultPrevented).to.equal(false);
});

it("uses host naming precedence, locale-aware labels/digits, and responsive rendered styles", async () => {
  const localized = await dataGrid(html`
    <lr-data-grid
      aria-label="Host wins"
      label="Property fallback"
      lang="fa"
      paginate
      page-size="1"
      .pageSizeOptions=${[1]}
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  expect(
    localized
      .shadowRoot!.querySelector('[role="grid"]')!
      .getAttribute("aria-label")
  ).to.equal("Host wins");
  const pageTexts = [
    ...localized.shadowRoot!.querySelectorAll<HTMLElement>('[part~="page"]'),
  ].map((button) => button.textContent?.trim());
  const localizedOne = new Intl.NumberFormat("fa", {
    maximumFractionDigits: 0,
  }).format(1);
  expect(localizedOne).to.not.equal("1");
  expect(pageTexts).to.include(localizedOne);

  const turkish = await dataGrid(html`
    <lr-data-grid
      label="Turkish"
      lang="tr"
      .columns=${[{ field: "istanbulName" }]}
      .data=${[{ istanbulName: "value" }]}
    ></lr-data-grid>
  `);
  expect(header(turkish, "istanbulName").textContent).to.contain(
    "İstanbul Name"
  );

  const wrapper = await fixture<HTMLDivElement>(html`
    <div style="inline-size: 300px">
      <lr-data-grid
        dir="rtl"
        label="Narrow"
        with-search
        .columns=${columns}
        .data=${[
          {
            ...rows[0]!,
            name: "A very long unbroken value that must stay inside the allocated grid",
          },
        ]}
      ></lr-data-grid>
    </div>
  `);
  const narrow = wrapper.querySelector("lr-data-grid") as unknown as LyraDataGrid<Person>;
  await narrow.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const toolbar = narrow.shadowRoot!.querySelector(
    '[part="toolbar"]'
  ) as HTMLElement;
  const body = narrow.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
  expect(getComputedStyle(toolbar).flexDirection).to.equal("column");
  expect(getComputedStyle(narrow).direction).to.equal("rtl");
  expect(narrow.getBoundingClientRect().width).to.be.at.most(
    wrapper.getBoundingClientRect().width + 1
  );
  expect(body.scrollWidth).to.be.at.least(body.clientWidth);
  const row = narrow.shadowRoot!.querySelector('[part~="row"]') as HTMLElement;
  const duration = getComputedStyle(row).transitionDuration;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches)
    expect(duration).to.equal("0s");
  else expect(duration).to.not.equal("0s");
  await expect(narrow).to.be.accessible();
});

it("stringifies object, array, date, and unserializable cell values", async () => {
  const circular: Record<string, unknown> = {};
  circular["self"] = circular;
  const element = await valueGrid([
    { id: 1, value: { a: 1 } },
    { id: 2, value: [1, "two"] },
    { id: 3, value: new Date(Date.UTC(2020, 0, 2)) },
    { id: 4, value: new Date(Number.NaN) },
    { id: 5, value: circular },
    { id: 6, value: { big: 10n } },
    { id: 7, value: undefined },
    { id: 8, value: { toJSON: () => undefined } },
  ]);
  expect(
    dataCells(element).map((cell) => cell.textContent!.trim())
  ).to.deep.equal([
    '{"a":1}',
    "1, two",
    "2020-01-02T00:00:00.000Z",
    "",
    "",
    '{"big":"10"}',
    "",
    "",
  ]);
});

it("re-applies the current page and search term through the public handlers", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      paginate
      page-size="2"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  element.page = 1;
  await element.updateComplete;
  const pageChange = oneEvent(element, "lr-page-change");
  element.handlePageChange();
  const { detail } = await pageChange;
  expect(detail.page).to.equal(1);
  expect(detail.pageSize).to.equal(2);

  element.searchTerm = "ada";
  element.page = 1;
  element.handleSearchTermChange();
  await element.updateComplete;
  expect(element.searchTerm).to.equal("ada");
  expect(element.page).to.equal(0);
});

it("derives the requested page from an input-like event's currentTarget value", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      paginate
      page-size="1"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const internals = element as unknown as {
    applyPageChange(value: number | Event): void;
  };
  const input = document.createElement("input");
  input.value = "2";
  const pageChange = oneEvent(element, "lr-page-change");
  internals.applyPageChange({ currentTarget: input } as unknown as Event);
  const { detail } = await pageChange;
  expect(detail.page).to.equal(2);
  expect(element.page).to.equal(2);
});

it("treats a bubbled text-node target and a non-element currentTarget as non-interactive", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const internals = element as unknown as {
    onBodyScroll(event: Event): void;
    bodyScrollTop: number;
  };

  const nameHeader = header(element, "name");
  const headerText = [...nameHeader.querySelector("span")!.childNodes].find(
    (node) => node.nodeType === Node.TEXT_NODE
  )!;
  const sorted = oneEvent(element, "lr-sort-change");
  headerText.dispatchEvent(
    new MouseEvent("click", { bubbles: true, composed: true })
  );
  expect((await sorted).detail.sort).to.deep.equal([
    { id: "name", desc: false },
  ]);

  const cell = dataCells(element)[0]!;
  const cellText = [...cell.childNodes].find(
    (node) => node.nodeType === Node.TEXT_NODE
  )!;
  const clicked = oneEvent(element, "lr-cell-click");
  cellText.dispatchEvent(
    new MouseEvent("click", { bubbles: true, composed: true })
  );
  expect((await clicked).detail.value).to.equal("Ada");

  const before = internals.bodyScrollTop;
  internals.onBodyScroll({ currentTarget: null } as unknown as Event);
  expect(
    internals.bodyScrollTop,
    "a non-element currentTarget must not update scroll state"
  ).to.equal(before);
});

it("omits an abort signal when the owner realm has no AbortController", async () => {
  const NativeAbortController = window.AbortController;
  let receivedSignal: AbortSignal | undefined = undefined;
  let sawRequest = false;
  const element = await dataGrid(
    html`<lr-data-grid label="People" .columns=${columns}></lr-data-grid>`
  );
  (
    window as unknown as { AbortController?: typeof AbortController }
  ).AbortController = undefined;
  try {
    element.dataSource = async (request) => {
      sawRequest = true;
      receivedSignal = request.signal;
      return { rows: [], total: 0 };
    };
    await element.updateComplete;
    await delay(10);
    expect(sawRequest).to.equal(true);
    expect(
      receivedSignal,
      "no AbortController means no signal is attached"
    ).to.equal(undefined);
  } finally {
    window.AbortController = NativeAbortController;
  }
});

it("applies a caller-supplied row class and falls back to an empty class for a null return", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      .rowClass=${(row: Person) => (row.score >= 9 ? "top" : null)}
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const rowEls = [...element.shadowRoot!.querySelectorAll('[part~="row"]')];
  expect(rowEls.map((rowEl) => rowEl.className)).to.deep.equal([
    "",
    "top",
    "top",
  ]);
});

it("renders no page-number buttons and disables navigation when there are zero pages", async () => {
  const element = await dataGrid(
    html`<lr-data-grid
      label="Empty"
      paginate
      .columns=${columns}
    ></lr-data-grid>`
  );
  expect(element.pageCount).to.equal(0);
  expect(element.shadowRoot!.querySelectorAll('[part~="page"]')).to.have.length(
    0
  );
  expect(
    (
      element.shadowRoot!.querySelector(
        '[part~="first-button"]'
      ) as HTMLButtonElement
    ).disabled
  ).to.equal(true);
});

it("reports zero pages rather than dividing by a zero page size", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      paginate
      page-size="0"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  expect(element.pageCount).to.equal(0);
});

it("distributes extreme finite flex values without overflowing the total", async () => {
  const extremeColumns: DataGridColumn<Person>[] = [
    { field: "name", label: "Name", flex: Number.MAX_VALUE },
    { field: "team", label: "Team", flex: Number.MAX_VALUE },
  ];
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      .columns=${extremeColumns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const body = element.shadowRoot!.querySelector(
    '[part="body"]'
  ) as HTMLElement;
  Object.defineProperty(body, "clientWidth", {
    configurable: true,
    value: 400,
  });

  element.sizeColumnsToFit();

  expect(element.getState().widths).to.deep.equal({ name: 200, team: 200 });
});

it("leaves loadServerData inert when the owner realm no longer matches", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      server
      .columns=${columns}
      .dataSource=${async () => ({ rows: [], total: 0 })}
    ></lr-data-grid>
  `);
  const before = element.data;
  const internals = element as unknown as {
    loadServerData(owner: Window): Promise<void>;
  };
  const foreignWindow = { document } as unknown as Window;
  await internals.loadServerData(foreignWindow);
  expect(
    element.data,
    "a mismatched owner window must not apply a response"
  ).to.equal(before);
});

it("falls back to an exact-scan and an empty computed token when CSS.escape or getComputedStyle throw", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      resizable
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  for (const cell of element.shadowRoot!.querySelectorAll(
    '[data-column-id="name"]'
  )) {
    Object.defineProperty(cell, "scrollWidth", {
      configurable: true,
      value: 190,
    });
  }
  const ambientEscape = window.CSS.escape;
  window.CSS.escape = () => {
    throw new Error("escape unsupported");
  };
  try {
    element.autoSizeColumn("name");
    expect(
      element.getState().widths?.["name"],
      "the exact-match scan still finds the column"
    ).to.equal(190);
  } finally {
    window.CSS.escape = ambientEscape;
  }

  const ambientGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = (() => {
    throw new Error("style access denied");
  }) as typeof window.getComputedStyle;
  try {
    element.requestUpdate();
    await element.updateComplete;
  } finally {
    window.getComputedStyle = ambientGetComputedStyle;
  }
  expect(
    element.shadowRoot!.querySelectorAll('[part~="row"]'),
    "a throwing getComputedStyle must not crash rendering"
  ).to.have.length.greaterThan(0);
});

it("returns an empty computed token when the owner window has no getComputedStyle function", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      style="--row-height: 40px"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const ambient = window.getComputedStyle;
  (
    window as unknown as { getComputedStyle?: typeof window.getComputedStyle }
  ).getComputedStyle = undefined;
  try {
    element.requestUpdate();
    await element.updateComplete;
  } finally {
    window.getComputedStyle = ambient;
  }
  expect(
    element.shadowRoot!.querySelectorAll('[part~="row"]'),
    "rendering must still succeed"
  ).to.have.length.greaterThan(0);
});

it("wires the size density ladder into rendered row/header height", async () => {
  const medium = await dataGrid(html`
    <lr-data-grid label="Medium" .columns=${columns} .data=${rows}></lr-data-grid>
  `);
  const small = await dataGrid(html`
    <lr-data-grid
      label="Small"
      size="s"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const large = await dataGrid(html`
    <lr-data-grid
      label="Large"
      size="l"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);

  const rowHeight = (element: LyraDataGrid<Person>): number =>
    (
      element.shadowRoot!.querySelector('[part~="row"]') as HTMLElement
    ).getBoundingClientRect().height;
  const headerHeight = (element: LyraDataGrid<Person>): number =>
    (
      element.shadowRoot!.querySelector('[part="header"]') as HTMLElement
    ).getBoundingClientRect().height;

  expect(rowHeight(small)).to.be.lessThan(rowHeight(medium));
  expect(rowHeight(large)).to.be.greaterThan(rowHeight(medium));
  expect(headerHeight(small)).to.be.lessThan(headerHeight(medium));
  expect(headerHeight(large)).to.be.greaterThan(headerHeight(medium));

  // The legacy "small"/"large" aliases wire in the same density as "s"/"l".
  const smallAlias = await dataGrid(html`
    <lr-data-grid
      label="Small alias"
      size="small"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const largeAlias = await dataGrid(html`
    <lr-data-grid
      label="Large alias"
      size="large"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  expect(rowHeight(smallAlias)).to.equal(rowHeight(small));
  expect(rowHeight(largeAlias)).to.equal(rowHeight(large));
});

describe("grid-line colour tier", () => {
  const themed =
    "--lr-theme-color-surface-border: rgb(10, 20, 30); --lr-theme-color-surface-border-subtle: rgb(7, 8, 9)";
  const lines = (element: LyraDataGrid<Person>): Record<string, string> => {
    const root = element.shadowRoot!;
    const part = (selector: string): CSSStyleDeclaration =>
      getComputedStyle(root.querySelector<HTMLElement>(selector)!);
    return {
      edge: part('[part="data-grid"]').borderTopColor,
      header: part('[part="header"]').borderBottomColor,
      cell: part('[part~="cell"]').borderInlineEndColor,
      row: part('[part~="row"]').borderBottomColor,
      pager: part('[part="pager"]').borderTopColor,
    };
  };
  const controls = (element: LyraDataGrid<Person>): Record<string, string> => {
    const root = element.shadowRoot!;
    const part = (selector: string): CSSStyleDeclaration =>
      getComputedStyle(root.querySelector<HTMLElement>(selector)!);
    return {
      search: part('[part="search"]').borderTopColor,
      pageSize: part('[part="page-size"]').borderTopColor,
    };
  };

  it("draws grid lines on the subtle tier and keeps control boundaries on the control tier", async () => {
    const element = await dataGrid(html`
      <lr-data-grid paginate with-search label="People" style=${themed} .columns=${columns} .data=${rows}></lr-data-grid>
    `);
    expect(Object.values(lines(element))).to.deep.equal(Array(5).fill("rgb(7, 8, 9)"));
    expect(Object.values(controls(element))).to.deep.equal(Array(2).fill("rgb(10, 20, 30)"));
  });

  it("lets --border-color recolour both, and --lr-data-grid-line-color only the grid lines", async () => {
    const element = await dataGrid(html`
      <lr-data-grid paginate with-search label="People" style=${`${themed}; --border-color: rgb(40, 50, 60)`} .columns=${columns} .data=${rows}></lr-data-grid>
    `);
    expect(Object.values(lines(element))).to.deep.equal(Array(5).fill("rgb(40, 50, 60)"));
    expect(Object.values(controls(element))).to.deep.equal(Array(2).fill("rgb(40, 50, 60)"));
    element.style.setProperty("--lr-data-grid-line-color", "rgb(70, 80, 90)");
    expect(Object.values(lines(element))).to.deep.equal(Array(5).fill("rgb(70, 80, 90)"));
    expect(Object.values(controls(element))).to.deep.equal(Array(2).fill("rgb(40, 50, 60)"));
  });

  it("uses the Shadcn subtle grid-line default independently of the control border", async () => {
    const element = await dataGrid(html`
      <lr-data-grid paginate with-search label="People" style="--lr-theme-color-surface-border: rgb(10, 20, 30)" .columns=${columns} .data=${rows}></lr-data-grid>
    `);
    expect(Object.values(lines(element)).map(toRgba)).to.deep.equal(Array(5).fill([229, 229, 229, 255]));
    expect(Object.values(controls(element)).map(toRgba)).to.deep.equal(Array(2).fill([10, 20, 30, 255]));
  });
});
