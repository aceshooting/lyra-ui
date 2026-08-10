import { expect, fixture, html, oneEvent } from "@open-wc/testing";
import "./data-grid.js";
import type { LyraDataGrid } from "./data-grid.js";
import type { DataGridColumn, DataGridState } from "./data-grid-types.js";
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from "../../../internal/announcer.js";
import {
  aggregateValues,
  columnId,
  columnValue,
  filterRows,
  matchesFilter,
  pathValue,
  rowsAsDelimited,
  searchRows,
  sortRows,
} from "./data-grid-processing.js";

interface Person {
  id: number;
  name: string;
  team: string;
  score: number;
  tags?: string[];
  children?: Person[];
}

const columns: DataGridColumn<Person>[] = [
  { field: "name", label: "Name" },
  { field: "team", label: "Team", filterable: true },
  { field: "score", label: "Score" },
];

const rows: Person[] = [
  { id: 1, name: "Ada", team: "Compiler", score: 7 },
  { id: 2, name: "Lin", team: "Runtime", score: 10 },
  { id: 3, name: "Grace", team: "Compiler", score: 9 },
];

async function dataGrid(
  template = html`<lr-data-grid label="People"></lr-data-grid>`
): Promise<LyraDataGrid<Person>> {
  const element = (await fixture(template)) as LyraDataGrid<Person>;
  await element.updateComplete;
  return element;
}

const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function sinkElement(
  politeness: "polite" | "assertive",
  doc: Document = document
): HTMLElement | null {
  return doc.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="${politeness}"]`
  );
}

function sinkTexts(
  politeness: "polite" | "assertive",
  doc: Document = document
): string[] {
  const element = sinkElement(politeness, doc);
  return element
    ? Array.from(element.children).map((child) => child.textContent ?? "")
    : [];
}

it("relays toolbar-search focus and blur once as bubbling composed native events", async () => {
  const wrapper = (await fixture(html`
    <div>
      <lr-data-grid
        with-search
        label="People"
        .columns=${columns}
        .data=${rows}
      ></lr-data-grid>
      <button type="button">Outside</button>
    </div>
  `)) as HTMLElement;
  const element = wrapper.querySelector("lr-data-grid") as LyraDataGrid<Person>;
  const outside = wrapper.querySelector("button")!;
  const observed: FocusEvent[] = [];
  wrapper.addEventListener("focus", (event) =>
    observed.push(event as FocusEvent)
  );
  wrapper.addEventListener("blur", (event) =>
    observed.push(event as FocusEvent)
  );

  const search =
    element.shadowRoot!.querySelector<HTMLInputElement>('[part="search"]')!;
  search.focus();
  outside.focus();

  expect(observed.length).to.equal(2);
  expect(observed.map((event) => event.type)).to.deep.equal(["focus", "blur"]);
  expect(observed.every((event) => event instanceof FocusEvent)).to.be.true;
  expect(observed.every((event) => event.bubbles && event.composed)).to.be.true;
  expect(observed.every((event) => event.target === element)).to.be.true;
  expect(observed[1]?.relatedTarget === outside).to.be.true;
});

it("resolves the toolbar search placeholder from the inherited quiet-text token", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      with-search
      label="People"
      style="--lr-color-text-quiet: rgb(1, 2, 3)"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const search =
    element.shadowRoot!.querySelector<HTMLInputElement>('[part="search"]')!;

  expect(getComputedStyle(search, "::placeholder").color).to.equal(
    "rgb(1, 2, 3)"
  );
});

it("relays a column-filter editor focus and blur once through the grid host", async () => {
  const wrapper = (await fixture(html`
    <div>
      <lr-data-grid
        label="People"
        .columns=${columns}
        .data=${rows}
      ></lr-data-grid>
      <button type="button">Outside</button>
    </div>
  `)) as HTMLElement;
  const element = wrapper.querySelector("lr-data-grid") as LyraDataGrid<Person>;
  const outside = wrapper.querySelector("button")!;
  const filterButton = element.shadowRoot!.querySelector<HTMLButtonElement>(
    '[part="filter-button"]'
  )!;
  filterButton.click();
  await element.updateComplete;

  const observed: FocusEvent[] = [];
  wrapper.addEventListener("focus", (event) =>
    observed.push(event as FocusEvent)
  );
  wrapper.addEventListener("blur", (event) =>
    observed.push(event as FocusEvent)
  );
  const filter = element.shadowRoot!.querySelector<HTMLInputElement>(
    '[part="filter-panel"] input'
  )!;
  filter.focus();
  outside.focus();

  expect(observed.length).to.equal(2);
  expect(observed.map((event) => event.type)).to.deep.equal(["focus", "blur"]);
  expect(observed.every((event) => event instanceof FocusEvent)).to.be.true;
  expect(observed.every((event) => event.bubbles && event.composed)).to.be.true;
  expect(observed.every((event) => event.target === element)).to.be.true;
  expect(observed[1]?.relatedTarget === outside).to.be.true;
});

it("routes the copy announcement into the shared light-DOM sink, leaving the shadow part a mirror", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  expect(
    sinkTexts("polite"),
    "mounting must not announce a resting state"
  ).to.deep.equal([]);

  element.copySelectedRows({ includeHeaders: false });
  await element.updateComplete;
  expect(sinkTexts("polite")).to.deep.equal(["Copied!"]);

  const region = element.shadowRoot!.querySelector('[part="live-region"]')!;
  // The retained part is a styling/inspection mirror only -- a live region inside a shadow root is
  // not reliably announced, and leaving it live would double-announce where it *is* honored.
  expect(region.getAttribute("role")).to.equal(null);
  expect(region.getAttribute("aria-live")).to.equal(null);
  expect(region.getAttribute("aria-hidden")).to.equal("true");
  expect(region.textContent).to.equal("Copied!");
});

it("announces a second identical copy again instead of silently rewriting one text node", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  element.copySelectedRows({ includeHeaders: false });
  await element.updateComplete;
  element.copySelectedRows({ includeHeaders: false });
  await element.updateComplete;
  expect(
    sinkTexts("polite"),
    "an identical repeat must be a second addition so assistive tech reads it again"
  ).to.deep.equal(["Copied!", "Copied!"]);
});

it("keeps declarative loading silent and makes the visible shadow overlay non-live", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      loading
      label="People"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const overlay = element.shadowRoot!.querySelector(
    '[part="loading-overlay"]'
  ) as HTMLElement;
  expect(
    sinkTexts("polite"),
    "initial loading must not announce during mount"
  ).to.deep.equal([]);
  expect(overlay.getAttribute("role")).to.equal(null);
  expect(overlay.getAttribute("aria-live")).to.equal(null);
  expect(
    element
      .shadowRoot!.querySelector('[part="table"]')!
      .getAttribute("aria-busy")
  ).to.equal("true");
});

it("announces every post-mount transition into loading as a new light-DOM addition", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  for (let cycle = 0; cycle < 2; cycle++) {
    element.loading = true;
    await element.updateComplete;
    element.loading = false;
    await element.updateComplete;
  }
  expect(sinkTexts("polite")).to.deep.equal(["Loading…", "Loading…"]);
  expect(
    element.shadowRoot!.querySelector('[part="live-region"]')!.textContent
  ).to.equal("Loading…");
});

it("re-targets loading announcements after cross-document adoption", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const iframe = document.createElement("iframe");
  document.body.append(iframe);
  const frameDocument = iframe.contentDocument!;
  try {
    frameDocument.body.append(element);
    element.loading = true;
    await element.updateComplete;
    expect(
      sinkElement("polite") === null,
      "the old document releases the adopted grid"
    ).to.be.true;
    expect(sinkTexts("polite", frameDocument)).to.deep.equal(["Loading…"]);
  } finally {
    element.remove();
    iframe.remove();
  }
});

it("ref-counts the shared sink away once the last grid disconnects", async () => {
  const first = await dataGrid();
  const second = await dataGrid();
  expect(sinkElement("polite") !== null, "a connected grid holds the sink").to
    .be.true;
  first.remove();
  expect(
    sinkElement("polite") !== null,
    "a still-connected grid keeps it mounted"
  ).to.be.true;
  second.remove();
  expect(sinkElement("polite") === null, "the last disconnect unmounts it").to
    .be.true;
});

function header(element: LyraDataGrid<unknown>, id: string): HTMLElement {
  const result = element.shadowRoot!.querySelector<HTMLElement>(
    `[part~="header-cell"][data-column-id="${id}"]`
  );
  if (!result) throw new Error(`Missing ${id} header`);
  return result;
}

function dataCells(element: LyraDataGrid<unknown>): HTMLElement[] {
  return [
    ...element.shadowRoot!.querySelectorAll<HTMLElement>(
      '[part~="cell"][data-row-position]'
    ),
  ];
}

it("exposes the exact public defaults", async () => {
  const element = await dataGrid();
  expect(element.appearance).to.equal("outlined");
  expect(element.childRows).to.equal(null);
  expect(element.columnOrder).to.deep.equal([]);
  expect(element.columns).to.deep.equal([]);
  expect(element.data).to.deep.equal([]);
  expect(element.dataSource).to.equal(null);
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

it("maps writable selectedRows onto current source-row keys", async () => {
  const rows = [
    { id: 1, name: "Ada", team: "Compiler", score: 7 },
    { id: 2, name: "Grace", team: "Compiler", score: 9 },
  ];
  const element = await dataGrid(
    html`<lr-data-grid row-key="id" .data=${rows}></lr-data-grid>`
  );

  element.selectedRows = [
    rows[1]!,
    { id: 99, name: "Detached", team: "None", score: 0 },
  ];
  await element.updateComplete;
  expect(element.selectedKeys).to.deep.equal([2]);
  expect(element.selectedRows).to.deep.equal([rows[1]]);

  element.selectable = "single";
  element.selectedRows = [rows[0]!, rows[1]!];
  await element.updateComplete;
  expect(element.selectedKeys).to.deep.equal([1]);
  expect(element.selectedRows).to.deep.equal([rows[0]]);
});

it("reflects the documented attribute surface and treats a bare selectable as multiple", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      appearance="plain"
      filter-debounce="15"
      filter-from-leaf-rows
      group-by="team"
      loading
      max-multi-sort="2"
      page="3"
      page-size="5"
      paginate
      pinnable
      reorderable
      resizable
      row-key="id"
      selectable
      server
      size="large"
      sort-desc-first
      striped
      total="42"
      with-column-menu
      with-columns-menu
      without-sort-removal
      with-search
      label="People"
    ></lr-data-grid>
  `);

  expect(element.selectable).to.equal("multiple");
  expect(element.groupBy).to.equal("team");
  for (const attribute of [
    "filter-from-leaf-rows",
    "loading",
    "paginate",
    "pinnable",
    "reorderable",
    "resizable",
    "server",
    "sort-desc-first",
    "striped",
    "with-column-menu",
    "with-columns-menu",
    "without-sort-removal",
    "with-search",
  ])
    expect(element.hasAttribute(attribute), attribute).to.equal(true);
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

it("filters, searches, and stable-sorts client rows with locale-aware comparisons", () => {
  const filtered = filterRows(
    rows,
    columns,
    [{ id: "team", value: "compiler" }],
    "en"
  );
  expect(filtered.map((row) => row.name)).to.deep.equal(["Ada", "Grace"]);
  expect(
    searchRows(rows, columns, "lin", "en", null).map((row) => row.id)
  ).to.deep.equal([2]);
  expect(
    sortRows(rows, columns, [{ id: "score", desc: true }], "en").map(
      (row) => row.id
    )
  ).to.deep.equal([2, 3, 1]);
});

it("supports every filter algorithm, computed search values, and custom matchers", () => {
  interface FilterRow extends Person {
    created: string;
    active: boolean;
  }
  const filterRowsFixture: FilterRow[] = [
    {
      ...rows[0]!,
      created: "2026-01-01T12:00:00Z",
      active: true,
      tags: ["lit", "types"],
    },
    {
      ...rows[1]!,
      created: "2026-01-02T12:00:00Z",
      active: false,
      tags: ["runtime"],
    },
    {
      ...rows[2]!,
      created: "2026-01-03T12:00:00Z",
      active: true,
      tags: ["lit", "a11y"],
    },
  ];
  const byName: DataGridColumn<FilterRow> = {
    field: "name",
    filterType: "equals",
  };
  const byScore: DataGridColumn<FilterRow> = {
    field: "score",
    filterType: "number-range",
  };
  const byDate: DataGridColumn<FilterRow> = {
    field: "created",
    filterType: "date-range",
  };
  const byTeam: DataGridColumn<FilterRow> = {
    field: "team",
    filterType: "set",
  };
  const byAnyTag: DataGridColumn<FilterRow> = {
    field: "tags",
    filterType: "includes-any",
  };
  const byAllTags: DataGridColumn<FilterRow> = {
    field: "tags",
    filterType: "includes-all",
  };
  const custom: DataGridColumn<FilterRow> = {
    field: "active",
    filterFn: (value, filter) => value === filter,
  };

  expect(matchesFilter(filterRowsFixture[0]!, byName, "ADA", "en")).to.equal(
    true
  );
  expect(
    filterRows(
      filterRowsFixture,
      [byScore],
      [{ id: "score", value: [8, 10] }],
      "en"
    ).map((row) => row.id)
  ).to.deep.equal([2, 3]);
  expect(
    filterRows(
      filterRowsFixture,
      [byDate],
      [{ id: "created", value: ["2026-01-02", "2026-01-02"] }],
      "en"
    ).map((row) => row.id)
  ).to.deep.equal([2]);
  expect(
    matchesFilter(filterRowsFixture[1]!, byTeam, new Set(["runtime"]), "en")
  ).to.equal(true);
  expect(
    matchesFilter(filterRowsFixture[2]!, byAnyTag, ["runtime", "a11y"], "en")
  ).to.equal(true);
  expect(
    matchesFilter(filterRowsFixture[0]!, byAllTags, ["types", "lit"], "en")
  ).to.equal(true);
  expect(
    filterRows(
      filterRowsFixture,
      [custom],
      [{ id: "active", value: true }],
      "en"
    ).map((row) => row.id)
  ).to.deep.equal([1, 3]);

  const computed: DataGridColumn<FilterRow>[] = [
    { id: "summary", value: (row) => `${row.team}:${row.score}` },
    { field: "name", searchable: false },
  ];
  expect(
    searchRows(filterRowsFixture, computed, "runtime:10", "en", null).map(
      (row) => row.id
    )
  ).to.deep.equal([2]);
  expect(
    searchRows(
      filterRowsFixture,
      computed,
      "COMPILER:9",
      "en",
      (value, term) =>
        String(value).toLocaleLowerCase("en") === term.toLocaleLowerCase("en")
    ).map((row) => row.id)
  ).to.deep.equal([3]);
});

it("honors sort algorithms, undefined placement, custom comparators, multisort, and stability", () => {
  interface SortRow {
    id: number;
    primary?: number;
    text: string;
    date: string;
  }
  const source: SortRow[] = [
    { id: 1, primary: 2, text: "item 10", date: "2026-02-01" },
    { id: 2, text: "item 2", date: "2026-01-01" },
    { id: 3, primary: 2, text: "item 1", date: "2026-03-01" },
  ];
  const sortColumns: DataGridColumn<SortRow>[] = [
    {
      id: "primary",
      field: "primary",
      sortFn: "basic",
      sortUndefined: "first",
    },
    { id: "text", field: "text", sortFn: "alphanumeric" },
    { id: "date", field: "date", sortFn: "datetime" },
    {
      id: "custom",
      value: (row) => row.id,
      comparator: (left, right) => Number(right) - Number(left),
    },
  ];
  expect(
    sortRows(source, sortColumns, [{ id: "primary", desc: false }], "en").map(
      (row) => row.id
    )
  ).to.deep.equal([2, 1, 3]);
  expect(
    sortRows(source, sortColumns, [{ id: "primary", desc: true }], "en").map(
      (row) => row.id
    )
  ).to.deep.equal([2, 1, 3]);
  expect(
    sortRows(source, sortColumns, [{ id: "text", desc: false }], "en").map(
      (row) => row.id
    )
  ).to.deep.equal([3, 2, 1]);
  expect(
    sortRows(source, sortColumns, [{ id: "date", desc: true }], "en").map(
      (row) => row.id
    )
  ).to.deep.equal([3, 1, 2]);
  expect(
    sortRows(
      source,
      sortColumns,
      [
        { id: "primary", desc: false },
        { id: "text", desc: false },
      ],
      "en"
    ).map((row) => row.id)
  ).to.deep.equal([2, 3, 1]);
  expect(
    sortRows(source, sortColumns, [{ id: "custom", desc: false }], "en").map(
      (row) => row.id
    )
  ).to.deep.equal([3, 2, 1]);
  expect(
    sortRows(source, sortColumns, [], "en").map((row) => row.id)
  ).to.deep.equal([1, 2, 3]);
});

it("cycles ascending, descending, and removed sorts and enforces additive sort caps", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      max-multi-sort="2"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const name = header(element, "name");
  name.click();
  await element.updateComplete;
  expect(element.sort).to.deep.equal([{ id: "name", desc: false }]);
  name.click();
  await element.updateComplete;
  expect(element.sort).to.deep.equal([{ id: "name", desc: true }]);
  name.click();
  await element.updateComplete;
  expect(element.sort).to.deep.equal([]);

  name.dispatchEvent(
    new MouseEvent("click", { bubbles: true, composed: true, shiftKey: true })
  );
  header(element, "team").dispatchEvent(
    new MouseEvent("click", { bubbles: true, composed: true, shiftKey: true })
  );
  header(element, "score").dispatchEvent(
    new MouseEvent("click", { bubbles: true, composed: true, shiftKey: true })
  );
  await element.updateComplete;
  expect(element.sort).to.deep.equal([
    { id: "team", desc: false },
    { id: "score", desc: false },
  ]);

  element.sort = [];
  element.sortDescFirst = true;
  element.withoutSortRemoval = true;
  await element.updateComplete;
  name.click();
  await element.updateComplete;
  expect(element.sort).to.deep.equal([{ id: "name", desc: true }]);
  name.click();
  name.click();
  await element.updateComplete;
  expect(element.sort).to.deep.equal([{ id: "name", desc: true }]);
});

it("computes column facets after other filters but before the target filter", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  element.filters = [
    { id: "team", value: "compiler" },
    { id: "score", value: "7" },
  ];
  const facets = element.getColumnFacets("score");
  expect([...facets.uniqueValues.entries()]).to.deep.equal([
    [7, 1],
    [9, 1],
  ]);
  expect(facets.minMax).to.deep.equal([7, 9]);
  expect(element.getColumnFacets("missing").uniqueValues.size).to.equal(0);
});

it("supports aggregation and formula-safe CSV export", () => {
  expect(
    aggregateValues(
      "sum",
      rows,
      rows.map((row) => row.score)
    )
  ).to.equal(26);
  const csv = rowsAsDelimited(
    [{ id: 1, name: "=danger", team: "Compiler", score: 7 }],
    columns
  );
  expect(csv).to.equal("Name,Team,Score\r\n'=danger,Compiler,7");
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

it("sorts from the header and emits the public change event", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const eventPromise = oneEvent(element, "lr-sort-change");
  (
    element.shadowRoot!.querySelector('[part~="header-cell"]') as HTMLElement
  ).click();
  const event = await eventPromise;
  expect(event.detail.sort).to.deep.equal([{ id: "name", desc: false }]);
  expect(element.getProcessedRows().map((row) => row.name)).to.deep.equal([
    "Ada",
    "Grace",
    "Lin",
  ]);
});

it("sorts from the focused header with Enter and honors localized string overrides", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      with-search
      .strings=${{ search: "Find people" }}
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  expect(
    (element.shadowRoot!.querySelector('[part="search"]') as HTMLInputElement)
      .ariaLabel
  ).to.equal("Find people");
  const header = element.shadowRoot!.querySelector(
    '[part~="header-cell"]'
  ) as HTMLElement;
  const eventPromise = oneEvent(element, "lr-sort-change");
  header.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      composed: true,
    })
  );
  const event = await eventPromise;
  expect(event.detail.sort).to.deep.equal([{ id: "name", desc: false }]);
});

it("selects eligible rows, maintains selectedRows, and emits keys and rows", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      selectable="multiple"
      row-key="id"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const eventPromise = oneEvent(element, "lr-row-select");
  (
    element.shadowRoot!.querySelector('[part~="row"] input') as HTMLInputElement
  ).click();
  const event = await eventPromise;
  expect(element.selectedKeys).to.deep.equal([1]);
  expect(element.selectedRows).to.deep.equal([rows[0]]);
  expect(event.detail.selectedKeys).to.deep.equal([1]);
});

it("paginates client rows, clamps navigation, and reports page-size changes", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      paginate
      page="1"
      page-size="2"
      .pageSizeOptions=${[1, 2]}
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  expect(element.pageCount).to.equal(2);
  expect(element.getVisibleRows().map((row) => row.id)).to.deep.equal([3]);

  const previousEvent = oneEvent(element, "lr-page-change");
  (
    element.shadowRoot!.querySelector(
      '[part~="previous-button"]'
    ) as HTMLButtonElement
  ).click();
  expect((await previousEvent).detail).to.deep.equal({ page: 0, pageSize: 2 });
  expect(element.getVisibleRows().map((row) => row.id)).to.deep.equal([1, 2]);

  const size = element.shadowRoot!.querySelector(
    '[part="page-size"]'
  ) as HTMLSelectElement;
  size.value = "1";
  const sizeEvent = oneEvent(element, "lr-page-change");
  size.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  expect((await sizeEvent).detail).to.deep.equal({ page: 0, pageSize: 1 });
  expect(element.pageCount).to.equal(3);
});

it("paginates top-level groups as units and renders aggregates and group selection", async () => {
  const groupedColumns: DataGridColumn<Person>[] = [
    ...columns.slice(0, 2),
    { field: "score", label: "Score", aggregation: "sum" },
  ];
  const element = await dataGrid(html`
    <lr-data-grid
      label="People by team"
      group-by="team"
      paginate
      page-size="1"
      selectable="multiple"
      row-key="id"
      .columns=${groupedColumns}
      .data=${rows}
    ></lr-data-grid>
  `);
  expect(element.pageCount).to.equal(2);
  const group =
    element.shadowRoot!.querySelector<HTMLElement>('[part="group-row"]')!;
  expect(group.textContent).to.contain("Compiler");
  expect(group.textContent).to.contain("16");

  const selectEvent = oneEvent(element, "lr-row-select");
  (group.querySelector("input") as HTMLInputElement).click();
  expect((await selectEvent).detail.selectedKeys).to.deep.equal([1, 3]);

  (group.querySelector('[part="expand-button"]') as HTMLButtonElement).click();
  await element.updateComplete;
  expect(element.shadowRoot!.querySelectorAll('[part~="row"]')).to.have.length(
    2
  );
  await expect(element).to.be.accessible();

  element.page = 1;
  await element.updateComplete;
  expect(
    element.shadowRoot!.querySelector('[part="group-row"]')!.textContent
  ).to.contain("Runtime");
});

it("filters trees from leaves and separates programmatic from user expansion events", async () => {
  const treeRows: Person[] = [
    {
      id: 10,
      name: "Parent",
      team: "Tree",
      score: 1,
      children: [{ id: 11, name: "Needle", team: "Tree", score: 2 }],
    },
    { id: 20, name: "Other", team: "Tree", score: 3 },
  ];
  const element = await dataGrid(html`
    <lr-data-grid
      label="Tree people"
      child-rows="children"
      row-key="id"
      .rowDetail=${(row: Person) => `Details for ${row.name}`}
      .columns=${columns}
      .data=${treeRows}
    ></lr-data-grid>
  `);
  element.searchTerm = "Needle";
  await element.updateComplete;
  expect(element.shadowRoot!.querySelectorAll('[part~="row"]')).to.have.length(
    0
  );

  element.filterFromLeafRows = true;
  await element.updateComplete;
  expect(element.shadowRoot!.querySelectorAll('[part~="row"]')).to.have.length(
    1
  );
  expect(element.shadowRoot!.textContent).to.contain("Parent");

  let userEvents = 0;
  element.addEventListener("lr-row-expand", () => {
    userEvents += 1;
  });
  element.addEventListener("lr-row-collapse", () => {
    userEvents += 1;
  });
  element.expandRow(10);
  await element.updateComplete;
  expect(userEvents).to.equal(0);
  expect(element.shadowRoot!.textContent).to.contain("Needle");
  expect(element.shadowRoot!.textContent).to.contain("Details for Parent");

  const collapse = oneEvent(element, "lr-row-collapse");
  (
    element.shadowRoot!.querySelector(
      '[part="expand-button"]'
    ) as HTMLButtonElement
  ).click();
  expect((await collapse).detail.key).to.equal(10);
  const expand = oneEvent(element, "lr-row-expand");
  (
    element.shadowRoot!.querySelector(
      '[part="expand-button"]'
    ) as HTMLButtonElement
  ).click();
  expect((await expand).detail.row.id).to.equal(10);
  element.collapseAllRows();
  expect(element.expandedKeys).to.deep.equal([]);
  element.expandAllRows();
  expect(element.expandedKeys).to.include.members([10, 11, 20]);
});

it("supports single selection and Ctrl+A skips ineligible rows and repairs shrunken data", async () => {
  const single = await dataGrid(html`
    <lr-data-grid
      label="Single"
      selectable="single"
      row-key="id"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const radios = [
    ...single.shadowRoot!.querySelectorAll<HTMLInputElement>(
      '[part~="row"] input'
    ),
  ];
  radios[0]!.click();
  radios[1]!.click();
  expect(single.selectedKeys).to.deep.equal([2]);

  const multiple = await dataGrid(html`
    <lr-data-grid
      label="Eligible"
      selectable="multiple"
      row-key="id"
      .selectableRows=${(row: Person) => row.score >= 9}
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const checks = [
    ...multiple.shadowRoot!.querySelectorAll<HTMLInputElement>(
      '[part~="row"] input'
    ),
  ];
  expect(checks.map((input) => input.disabled)).to.deep.equal([
    true,
    false,
    false,
  ]);
  checks[0]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await multiple.updateComplete;
  expect(
    multiple.selectedKeys,
    "a click on a disabled row checkbox is ignored"
  ).to.deep.equal([]);
  const selectEvent = oneEvent(multiple, "lr-row-select");
  dataCells(multiple)[0]!.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "a",
      ctrlKey: true,
      bubbles: true,
      composed: true,
    })
  );
  expect((await selectEvent).detail.selectedKeys).to.deep.equal([2, 3]);

  multiple.data = [rows[0]!];
  await multiple.updateComplete;
  expect(multiple.selectedKeys).to.deep.equal([]);
  expect(multiple.selectedRows).to.deep.equal([]);
  expect(
    multiple.shadowRoot!.querySelectorAll('[tabindex="0"]')
  ).to.have.length.greaterThan(0);
});

it("selects only the current page, preserves other-page keys, and cascades tree selection", async () => {
  const paged = await dataGrid(html`
    <lr-data-grid
      label="Paged selection"
      selectable="multiple"
      row-key="id"
      paginate
      page="1"
      page-size="1"
      .columns=${columns}
      .data=${rows}
      .selectedKeys=${[1]}
    ></lr-data-grid>
  `);
  dataCells(paged)[0]!.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "a",
      ctrlKey: true,
      bubbles: true,
      composed: true,
    })
  );
  expect(paged.selectedKeys).to.deep.equal([1, 2]);
  await paged.updateComplete;
  const selectAll = paged.shadowRoot!.querySelector(
    '[part="select-all-checkbox"]'
  ) as HTMLInputElement;
  selectAll.click();
  expect(paged.selectedKeys).to.deep.equal([1]);

  const treeRows: Person[] = [
    {
      id: 10,
      name: "Parent",
      team: "Tree",
      score: 1,
      children: [{ id: 11, name: "Child", team: "Tree", score: 2 }],
    },
  ];
  const tree = await dataGrid(html`
    <lr-data-grid
      label="Tree selection"
      selectable="multiple"
      row-key="id"
      child-rows="children"
      .columns=${columns}
      .data=${treeRows}
      .expandedKeys=${[10]}
    ></lr-data-grid>
  `);
  const treeChecks = [
    ...tree.shadowRoot!.querySelectorAll<HTMLInputElement>(
      '[part~="row"] input'
    ),
  ];
  treeChecks[1]!.click();
  await tree.updateComplete;
  expect(tree.selectedKeys).to.deep.equal([11]);
  expect(
    (tree.shadowRoot!.querySelector('[part~="row"] input') as HTMLInputElement)
      .indeterminate
  ).to.equal(true);
  (
    tree.shadowRoot!.querySelector('[part~="row"] input') as HTMLInputElement
  ).click();
  expect(tree.selectedKeys).to.have.members([10, 11]);
});

it("uses the three exact empty/loading/no-results slots", async () => {
  const element = await dataGrid(html`
    <lr-data-grid label="People" loading .columns=${columns} .data=${rows}>
      <span slot="empty">Empty custom</span>
      <span slot="loading">Loading custom</span>
      <span slot="no-results">No results custom</span>
    </lr-data-grid>
  `);
  expect(element.shadowRoot!.querySelector('slot[name="loading"]')).to.exist;
  element.loading = false;
  element.searchTerm = "missing";
  await element.updateComplete;
  expect(element.shadowRoot!.querySelector('slot[name="no-results"]')).to.exist;
});

it("emits both server request events with immutable request snapshots and server paging", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="Server people"
      server
      paginate
      page="2"
      page-size="5"
      total="21"
      .columns=${columns}
      .data=${[rows[0]!]}
    ></lr-data-grid>
  `);
  element.sort = [{ id: "name", desc: true }];
  element.filters = [{ id: "team", value: "Runtime" }];
  element.searchTerm = "Lin";
  const requestEvent = oneEvent(element, "request");
  const dataRequestEvent = oneEvent(element, "lr-data-request");
  await element.reload();
  const request = await requestEvent;
  const dataRequest = await dataRequestEvent;
  expect(request.detail.page).to.equal(2);
  expect(request.detail.pageSize).to.equal(5);
  expect(request.detail.sort).to.deep.equal([{ id: "name", desc: true }]);
  expect(request.detail.filters).to.deep.equal([
    { id: "team", value: "Runtime" },
  ]);
  expect(request.detail.search).to.equal("Lin");
  element.sort[0]!.desc = false;
  element.filters[0]!.value = "Compiler";
  expect(request.detail.sort).to.deep.equal([{ id: "name", desc: true }]);
  expect(request.detail.filters).to.deep.equal([
    { id: "team", value: "Runtime" },
  ]);
  expect(request.detail.signal).to.be.instanceOf(AbortSignal);
  expect(dataRequest.detail).to.equal(request.detail);
  expect(request.bubbles).to.equal(true);
  expect(request.composed).to.equal(true);
  expect(request.cancelable).to.equal(false);
  expect(element.pageCount).to.equal(5);
  expect(element.getVisibleRows().map((row) => row.id)).to.deep.equal([1]);
});

it("keeps prior rows, clears loading, and emits a strict-console-safe server error", async () => {
  const failure = new Error("offline");
  const element = await dataGrid(html`
    <lr-data-grid
      label="Server error"
      server
      .columns=${columns}
      .data=${[rows[0]!]}
      .dataSource=${async () => {
        throw failure;
      }}
    ></lr-data-grid>
  `);
  const errorEvent = oneEvent(element, "lr-data-error");
  await element.reload();
  const event = await errorEvent;
  expect(event.detail.error).to.equal(failure);
  expect(event.detail.request.signal.aborted).to.equal(false);
  expect(event.bubbles).to.equal(true);
  expect(event.composed).to.equal(true);
  expect(event.cancelable).to.equal(false);
  expect(element.data).to.deep.equal([rows[0]]);
  expect(element.loading).to.equal(false);
  expect(element.hasAttribute("loading")).to.equal(false);
});

it("debounces rapid server search updates into one latest request", async () => {
  const requests: string[] = [];
  const element = await dataGrid(html`
    <lr-data-grid
      label="Debounced server"
      filter-debounce="30"
      .columns=${columns}
      .dataSource=${async (request: { search: string }) => {
        requests.push(request.search);
        return { rows: [], total: 0 };
      }}
    ></lr-data-grid>
  `);
  await delay(50);
  const baseline = requests.length;
  for (const term of ["a", "ad", "ada"]) {
    element.searchTerm = term;
    await element.updateComplete;
  }
  await delay(90);
  expect(requests.length).to.equal(baseline + 1);
  expect(requests.at(-1)).to.equal("ada");
});

it("filters from the column panel and reports the controlled filter state", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="Filter people"
      page="2"
      with-search
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  (
    element.shadowRoot!.querySelector(
      '[part="filter-button"]'
    ) as HTMLButtonElement
  ).click();
  await element.updateComplete;
  const input = element.shadowRoot!.querySelector(
    '[part="filter-panel"] input'
  ) as HTMLInputElement;
  input.value = "compiler";
  const eventPromise = oneEvent(element, "lr-filter-change");
  input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  const event = await eventPromise;
  expect(event.detail.filters).to.deep.equal([
    { id: "team", value: "compiler" },
  ]);
  expect(event.cancelable).to.equal(false);
  expect(element.page).to.equal(0);
  expect(element.getProcessedRows().map((row) => row.id)).to.deep.equal([1, 3]);

  const search = element.shadowRoot!.querySelector(
    '[part="search"]'
  ) as HTMLInputElement;
  search.value = "missing";
  search.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  await element.updateComplete;
  expect(element.shadowRoot!.querySelector('[part="no-results"]')).to.exist;
});

it("supports silent programmatic pin/visibility changes and user menu events", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="Column controls"
      pinnable
      with-column-menu
      with-columns-menu
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  let programmaticEvents = 0;
  element.addEventListener("lr-column-pin", () => {
    programmaticEvents += 1;
  });
  element.addEventListener("lr-column-visibility-change", () => {
    programmaticEvents += 1;
  });
  element.pinColumn("name", "left");
  element.toggleColumn("team", false);
  await element.updateComplete;
  expect(programmaticEvents).to.equal(0);
  expect(element.getColumnPin("name")).to.equal("left");
  expect(element.getColumnPin("missing")).to.equal(false);
  expect(header(element, "name").dataset.pin).to.equal("left");
  expect(element.shadowRoot!.querySelector('[data-column-id="team"]')).to.not
    .exist;

  element.pinColumn("name", false);
  element.toggleColumn("team", true);
  await element.updateComplete;
  (
    header(element, "name").querySelector(
      '[part="column-menu-button"]'
    ) as HTMLButtonElement
  ).click();
  await element.updateComplete;
  const pinEvent = oneEvent(element, "lr-column-pin");
  (
    header(element, "name").querySelector(
      '[role="menuitem"]'
    ) as HTMLButtonElement
  ).click();
  expect((await pinEvent).detail).to.deep.equal({
    columnId: "name",
    side: "left",
  });

  const columnsMenu = element.shadowRoot!.querySelector(
    '[part="columns-menu"]'
  )!;
  (columnsMenu.querySelector("button") as HTMLButtonElement).click();
  await element.updateComplete;
  const visibilityInput = [
    ...columnsMenu.querySelectorAll<HTMLInputElement>("input"),
  ][1]!;
  visibilityInput.checked = false;
  const visibilityEvent = oneEvent(element, "lr-column-visibility-change");
  visibilityInput.dispatchEvent(
    new Event("change", { bubbles: true, composed: true })
  );
  expect((await visibilityEvent).detail).to.deep.equal({
    columnId: "team",
    visible: false,
  });

  element.resetColumns();
  await element.updateComplete;
  expect(element.getColumnPin("name")).to.equal(false);
  expect(element.shadowRoot!.querySelector('[data-column-id="team"]')).to.exist;
});

it("commits keyboard resize, rolls back pointer cancellation, and reorders with finished events", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="Movable people"
      resizable
      reorderable
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const resizeEvents: Array<{
    columnId: string;
    width: number;
    finished: boolean;
  }> = [];
  element.addEventListener("lr-column-resize", (event) =>
    resizeEvents.push(event.detail)
  );
  header(element, "name").dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowRight",
      altKey: true,
      bubbles: true,
      composed: true,
    })
  );
  await element.updateComplete;
  expect(resizeEvents.at(-1)?.columnId).to.equal("name");
  expect(resizeEvents.at(-1)?.finished).to.equal(true);
  const widthBeforePointer = element.getState().widths.name;

  const handle = header(element, "name").querySelector(
    '[part="resize-handle"]'
  ) as HTMLElement;
  handle.dispatchEvent(
    new PointerEvent("pointerdown", {
      pointerId: 41,
      clientX: 100,
      bubbles: true,
      composed: true,
    })
  );
  handle.dispatchEvent(
    new PointerEvent("pointermove", {
      pointerId: 41,
      clientX: 140,
      bubbles: true,
      composed: true,
    })
  );
  handle.dispatchEvent(
    new PointerEvent("pointercancel", {
      pointerId: 41,
      clientX: 140,
      bubbles: true,
      composed: true,
    })
  );
  await element.updateComplete;
  expect(resizeEvents.slice(-2).map((detail) => detail.finished)).to.deep.equal(
    [false, false]
  );
  expect(element.getState().widths.name).to.equal(widthBeforePointer);

  const moveEvent = oneEvent(element, "lr-column-move");
  header(element, "name").dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowRight",
      shiftKey: true,
      bubbles: true,
      composed: true,
    })
  );
  const moved = await moveEvent;
  expect(moved.detail).to.deep.equal({
    columnOrder: ["team", "name", "score"],
    columnId: "name",
    finished: true,
  });
  expect(moved.cancelable).to.equal(false);

  const rtl = await dataGrid(html`
    <lr-data-grid
      dir="rtl"
      label="RTL movable"
      reorderable
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  header(rtl, "name").dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowLeft",
      shiftKey: true,
      bubbles: true,
      composed: true,
    })
  );
  await rtl.updateComplete;
  expect(rtl.columnOrder).to.deep.equal(["team", "name", "score"]);
});

it("leaves disabled sort, resize, and movement capabilities inert", async () => {
  const inertColumns: DataGridColumn<Person>[] = [
    { field: "name", sortable: false, resizable: false, movable: false },
    { field: "team" },
  ];
  const element = await dataGrid(html`
    <lr-data-grid
      label="Inert columns"
      .columns=${inertColumns}
      .data=${rows}
    ></lr-data-grid>
  `);
  let eventCount = 0;
  for (const name of [
    "lr-sort-change",
    "lr-column-resize",
    "lr-column-move",
  ] as const) {
    element.addEventListener(name, () => {
      eventCount += 1;
    });
  }
  const name = header(element, "name");
  name.click();
  for (const event of [
    new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      composed: true,
    }),
    new KeyboardEvent("keydown", {
      key: "ArrowRight",
      altKey: true,
      bubbles: true,
      composed: true,
    }),
    new KeyboardEvent("keydown", {
      key: "ArrowRight",
      shiftKey: true,
      bubbles: true,
      composed: true,
    }),
  ])
    name.dispatchEvent(event);
  await element.updateComplete;
  expect(element.sort).to.deep.equal([]);
  expect(element.columnOrder).to.deep.equal([]);
  expect(element.getState().widths).to.deep.equal({});
  expect(eventCount).to.equal(0);
});

it("auto-sizes bounded columns and distributes body width by flex", async () => {
  const sizingColumns: DataGridColumn<Person>[] = [
    { field: "name", label: "Name", minWidth: 80, maxWidth: 150, flex: 1 },
    { field: "team", label: "Team", minWidth: 80, flex: 2 },
  ];
  const element = await dataGrid(html`
    <lr-data-grid
      label="Sized people"
      .columns=${sizingColumns}
      .data=${rows}
    ></lr-data-grid>
  `);
  for (const cell of element.shadowRoot!.querySelectorAll<HTMLElement>(
    '[data-column-id="name"]'
  )) {
    Object.defineProperty(cell, "scrollWidth", {
      configurable: true,
      value: 220,
    });
  }
  element.autoSizeColumn("name");
  expect(element.getState().widths).to.deep.include({ name: 150 });
  element.autoSizeColumn("missing");

  element.resetColumns();
  const body = element.shadowRoot!.querySelector(
    '[part="body"]'
  ) as HTMLElement;
  Object.defineProperty(body, "clientWidth", {
    configurable: true,
    value: 600,
  });
  element.sizeColumnsToFit();
  const widths = element.getState().widths!;
  expect(widths.name).to.equal(150);
  expect(widths.team).to.equal(400);
  element.autoSizeColumns();
  expect(Object.keys(element.getState().widths!)).to.have.members([
    "name",
    "team",
  ]);
});

it("resolves sizing and virtualization styles through the adopted owner window", async () => {
  const manyRows: Person[] = Array.from({ length: 100 }, (_value, index) => ({
    id: index,
    name: `Owner ${index}`,
    team: "Realm",
    score: index,
  }));
  const sizingColumns: DataGridColumn<Person>[] = [
    { id: "name", field: "name", label: "Name", flex: 1 },
    { id: "team", field: "team", label: "Team", flex: 1 },
  ];
  const element = await dataGrid();
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const frameDocument = frame.contentDocument;
  const frameWindow = frame.contentWindow;
  if (!frameDocument || !frameWindow)
    throw new Error("The iframe realm was unavailable.");

  element.remove();
  frameDocument.adoptNode(element);
  element.columns = sizingColumns;
  element.data = manyRows;
  element.rowKey = "id";
  element.selectable = "multiple";
  element.setState({ pinning: { name: "left", team: "left" } });
  frameDocument.documentElement.style.fontSize = "10px";

  const ambientGetComputedStyle = window.getComputedStyle;
  const ownerGetComputedStyle = frameWindow.getComputedStyle;
  let ambientStyleReads = 0;
  let ownerStyleReads = 0;
  let maxHeight = "200px";
  window.getComputedStyle = (() => {
    ambientStyleReads += 1;
    throw new Error(
      "ambient getComputedStyle must not inspect an adopted data grid"
    );
  }) as typeof window.getComputedStyle;
  frameWindow.getComputedStyle = ((
    target: Element,
    pseudoElement?: string | null
  ) => {
    ownerStyleReads += 1;
    const style = ownerGetComputedStyle.call(
      frameWindow,
      target,
      pseudoElement
    );
    if (target !== element) return style;
    return new Proxy(style, {
      get(cssStyle, property) {
        if (property === "getPropertyValue") {
          return (name: string): string => {
            if (name === "--lr-icon-button-size") return "2rem";
            if (name === "--row-height") return "2rem";
            if (name === "--max-height") return maxHeight;
            if (name === "--lr-size-7rem") return "7rem";
            return cssStyle.getPropertyValue(name);
          };
        }
        const value = Reflect.get(cssStyle, property, cssStyle) as unknown;
        return typeof value === "function" ? value.bind(cssStyle) : value;
      },
    });
  }) as typeof frameWindow.getComputedStyle;

  try {
    frameDocument.body.append(element);
    await element.updateComplete;

    const pinnedTeam = header(element, "team");
    expect(pinnedTeam.style.getPropertyValue("--pin-offset")).to.equal("70px");
    expect(
      element.shadowRoot!.querySelectorAll('[part~="row"][data-visible-index]')
        .length
    ).to.be.lessThan(80);

    const body = element.shadowRoot!.querySelector(
      '[part="body"]'
    ) as HTMLElement;
    Object.defineProperty(body, "clientWidth", {
      configurable: true,
      value: 600,
    });
    Object.defineProperty(body, "clientHeight", {
      configurable: true,
      value: 100,
    });
    let scrollTop = -1;
    Object.defineProperty(body, "scrollTo", {
      configurable: true,
      value: (options: ScrollToOptions) => {
        scrollTop = Number(options.top ?? 0);
      },
    });

    element.sizeColumnsToFit();
    expect(element.getState().widths).to.deep.equal({ name: 290, team: 290 });
    element.scrollToIndex(90, { align: "start" });
    expect(scrollTop).to.equal(1800);

    maxHeight = "none";
    element.requestUpdate();
    await element.updateComplete;
    expect(
      element.shadowRoot!.querySelectorAll('[part~="row"][data-visible-index]')
        .length
    ).to.equal(100);
    expect(ownerStyleReads).to.be.greaterThan(0);
    expect(ambientStyleReads).to.equal(0);

    element.remove();
    const ownerlessDocument =
      frameDocument.implementation.createHTMLDocument("ownerless grid");
    ownerlessDocument.adoptNode(element);
    element.resetColumns();
    expect(() => element.sizeColumnsToFit()).to.not.throw();
    expect(element.getState().widths).to.deep.equal({ name: 300, team: 300 });
    element.resetColumns();
    const internals = element as unknown as {
      readonly resolvedRowHeight: number;
      readonly virtualWindow: { items: unknown[] };
      estimatedColumnWidth(column: DataGridColumn<Person>, id: string): number;
    };
    expect(internals.resolvedRowHeight).to.equal(56);
    expect(internals.estimatedColumnWidth(sizingColumns[0]!, "name")).to.equal(
      112
    );
    expect(() => internals.virtualWindow.items.length).to.not.throw();
    expect(
      ambientStyleReads,
      "an ownerless grid must not borrow the ambient style realm"
    ).to.equal(0);
  } finally {
    element.remove();
    window.getComputedStyle = ambientGetComputedStyle;
    frameWindow.getComputedStyle = ownerGetComputedStyle;
    frame.remove();
  }
});

it("uses owner CSS escaping and an exact-id fallback for adopted column sizing and resize", async () => {
  const columnId = 'name"] [data-column-id="other';
  const element = await dataGrid(html`
    <lr-data-grid
      label="Adopted sizing"
      resizable
      .columns=${[{ id: columnId, field: "name", label: "Name" }]}
      .data=${rows}
    ></lr-data-grid>
  `);
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const frameDocument = frame.contentDocument;
  const frameWindow = frame.contentWindow;
  if (!frameDocument || !frameWindow)
    throw new Error("The iframe realm was unavailable.");
  const ambientEscape = window.CSS.escape;
  const ownerEscape = frameWindow.CSS.escape;
  let ownerEscapeCalls = 0;

  try {
    frameDocument.body.append(frameDocument.adoptNode(element));
    await element.updateComplete;
    window.CSS.escape = () => {
      throw new Error("ambient CSS.escape must not be used");
    };
    frameWindow.CSS.escape = (value: string): string => {
      ownerEscapeCalls += 1;
      return ownerEscape.call(frameWindow.CSS, value);
    };

    const matching = [
      ...element.shadowRoot!.querySelectorAll<HTMLElement>("[data-column-id]"),
    ].filter((candidate) => candidate.dataset.columnId === columnId);
    for (const cell of matching) {
      Object.defineProperty(cell, "scrollWidth", {
        configurable: true,
        value: 173,
      });
    }
    element.autoSizeColumn(columnId);
    expect(ownerEscapeCalls).to.be.greaterThan(0);
    expect(element.getState().widths?.[columnId]).to.equal(173);

    (frameWindow.CSS as unknown as { escape?: typeof CSS.escape }).escape =
      undefined;
    element.resetColumns();
    element.autoSizeColumn(columnId);
    expect(element.getState().widths?.[columnId]).to.equal(173);

    const ownerHeader = [
      ...element.shadowRoot!.querySelectorAll<HTMLElement>(
        '[role="columnheader"]'
      ),
    ].find((candidate) => candidate.dataset.columnId === columnId);
    if (!ownerHeader)
      throw new Error("The adopted column header was unavailable.");
    ownerHeader.getBoundingClientRect = () =>
      new frameWindow.DOMRect(0, 0, 125, 20);
    const handle = ownerHeader.querySelector(
      '[part="resize-handle"]'
    ) as HTMLElement;
    handle.dispatchEvent(
      new frameWindow.PointerEvent("pointerdown", {
        pointerId: 71,
        clientX: 10,
        bubbles: true,
        composed: true,
      })
    );
    handle.dispatchEvent(
      new frameWindow.PointerEvent("pointermove", {
        pointerId: 71,
        clientX: 20,
        bubbles: true,
        composed: true,
      })
    );
    expect(element.getState().widths?.[columnId]).to.equal(135);
  } finally {
    frameWindow.CSS.escape = ownerEscape;
    window.CSS.escape = ambientEscape;
    element.remove();
    frame.remove();
  }
});

it("serializes, validates, applies, and resets view state without losing page or selection", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="Stateful people"
      row-key="id"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const hostile = {
    order: ["score", "unknown", "name"],
    widths: { score: 120, name: Number.NaN, unknown: 50 },
    visibility: { team: false, unknown: false },
    pinning: { score: "right", name: "invalid", unknown: "left" },
    sort: [
      { id: "score", desc: 1 },
      { id: "unknown", desc: false },
    ],
    filters: [
      { id: "team", value: "Compiler" },
      { id: "unknown", value: true },
    ],
    search: "Ada",
    selectedKeys: [1, {}, Number.NaN],
    expandedKeys: [1, {}, Number.POSITIVE_INFINITY],
    page: Number.NaN,
    pageSize: Number.POSITIVE_INFINITY,
  } as unknown as DataGridState;
  element.setState(hostile);
  await element.updateComplete;
  const state = element.getState();
  expect(state.order).to.deep.equal(["score", "name"]);
  expect(state.widths).to.deep.equal({ score: 120, name: 0 });
  expect(state.visibility).to.deep.equal({ team: false });
  expect(state.pinning).to.deep.equal({ score: "right", name: false });
  expect(state.sort).to.deep.equal([{ id: "score", desc: true }]);
  expect(state.filters).to.deep.equal([{ id: "team", value: "Compiler" }]);
  expect(state.selectedKeys).to.deep.equal([1]);
  expect(state.expandedKeys).to.deep.equal([1]);
  expect(state.page).to.equal(0);
  expect(state.pageSize).to.equal(0);

  element.page = 2;
  element.pageSize = 10;
  element.selectedKeys = [1];
  element.resetState();
  expect(element.page).to.equal(2);
  expect(element.pageSize).to.equal(10);
  expect(element.selectedKeys).to.deep.equal([1]);
  expect(element.sort).to.deep.equal([]);
  expect(element.filters).to.deep.equal([]);
  expect(element.searchTerm).to.equal("");
  expect(element.getState().order).to.deep.equal([]);
});

it("virtualizes 80+ rows, scrolls to an index, and reconciles a dynamic shrink", async () => {
  const manyRows: Person[] = Array.from({ length: 100 }, (_value, index) => ({
    id: index,
    name: `Person ${index}`,
    team: "Virtual",
    score: index,
  }));
  const element = await dataGrid(html`
    <lr-data-grid
      label="Virtual people"
      row-key="id"
      style="--row-height: 40px; --max-height: 200px"
      .columns=${columns}
      .data=${manyRows}
    ></lr-data-grid>
  `);
  const initialCount =
    element.shadowRoot!.querySelectorAll('[part~="row"]').length;
  expect(initialCount).to.be.greaterThan(0);
  expect(initialCount).to.be.lessThan(80);
  await expect(element).to.be.accessible();
  const body = element.shadowRoot!.querySelector(
    '[part="body"]'
  ) as HTMLElement;
  Object.defineProperty(body, "clientHeight", {
    configurable: true,
    value: 200,
  });
  const originalScrollTo = Object.getOwnPropertyDescriptor(body, "scrollTo");
  Object.defineProperty(body, "scrollTo", {
    configurable: true,
    value: (options: ScrollToOptions) => {
      body.scrollTop = Number(options.top ?? 0);
      body.dispatchEvent(new Event("scroll"));
    },
  });
  try {
    element.scrollToIndex(90, { align: "center" });
    await element.updateComplete;
    expect(element.shadowRoot!.textContent).to.contain("Person 90");

    element.data = manyRows.slice(0, 85);
    await element.updateComplete;
    expect(
      element.shadowRoot!.querySelectorAll('[part~="row"]').length
    ).to.be.greaterThan(0);
    expect(element.shadowRoot!.textContent).to.contain("Person 84");

    element.style.setProperty("--max-height", "none");
    element.requestUpdate();
    await element.updateComplete;
    expect(
      element.shadowRoot!.querySelectorAll('[part~="row"]')
    ).to.have.length(85);
  } finally {
    if (originalScrollTo)
      Object.defineProperty(body, "scrollTo", originalScrollTo);
    else Reflect.deleteProperty(body, "scrollTo");
  }
});

it("honors exact CSV/copy/export options, compatibility aliases, and formula escaping", async () => {
  const exportColumns: DataGridColumn<Person>[] = [
    { field: "name", label: "Name" },
    {
      field: "team",
      label: "Team",
      formatter: (value) => String(value).toLocaleUpperCase("en"),
    },
    {
      field: "score",
      label: "Score",
      formatter: (value) => html`<strong>${value}</strong>`,
    },
  ];
  const dangerous: Person[] = [
    { id: 1, name: "=1+1", team: "@compiler", score: 7 },
  ];
  const element = await dataGrid(html`
    <lr-data-grid
      label="Export people"
      row-key="id"
      .columns=${exportColumns}
      .data=${dangerous}
      .selectedKeys=${[1]}
    ></lr-data-grid>
  `);
  expect(
    element.getDataAsCsv({
      columnIds: ["name", "score"],
      includeHeaders: false,
      delimiter: ";",
    })
  ).to.equal("'=1+1;7");
  expect(
    element.getDataAsCsv({
      columnIds: ["name"],
      includeHeaders: false,
      escapeFormulas: false,
    })
  ).to.equal("=1+1");
  expect(element.getDataAsCsv({ columns: ["team"] })).to.equal(
    "Team\r\n'@COMPILER"
  );

  let copied = "";
  const clipboardDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    "clipboard"
  );
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (value: string) => {
        copied = value;
      },
    },
  });
  try {
    expect(
      element.copySelectedRows({
        columnIds: ["name"],
        includeHeaders: false,
        format: "csv",
      })
    ).to.equal(1);
    await Promise.resolve();
    expect(copied).to.equal("'=1+1");
  } finally {
    if (clipboardDescriptor)
      Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
    else Reflect.deleteProperty(navigator, "clipboard");
  }

  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  const originalAnchorClick = HTMLAnchorElement.prototype.click;
  let downloaded = "";
  URL.createObjectURL = () => "blob:data-grid-test";
  URL.revokeObjectURL = () => undefined;
  HTMLAnchorElement.prototype.click = function click(): void {
    downloaded = this.download;
  };
  try {
    element.exportDataAsCsv({ filename: "legacy.csv", columns: ["name"] });
    expect(downloaded).to.equal("legacy.csv");
  } finally {
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
    HTMLAnchorElement.prototype.click = originalAnchorClick;
  }
});

it("honors an explicit copy delimiter over the format default", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="Copy people"
      row-key="id"
      .columns=${columns}
      .data=${rows}
      .selectedKeys=${[1]}
    ></lr-data-grid>
  `);
  let copied = "";
  const clipboardDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    "clipboard"
  );
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (value: string) => {
        copied = value;
      },
    },
  });
  try {
    expect(
      element.copySelectedRows({
        columnIds: ["name", "score"],
        includeHeaders: false,
        format: "csv",
        delimiter: ";",
      })
    ).to.equal(1);
    await Promise.resolve();
    expect(copied).to.equal("Ada;7");
  } finally {
    if (clipboardDescriptor)
      Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
    else Reflect.deleteProperty(navigator, "clipboard");
  }
});

it("uses the adopted owner realm for clipboard, fallback DOM, Blob, URL, and download anchor", async () => {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const frameWindow = frame.contentWindow!;
  const element = await dataGrid(html`
    <lr-data-grid
      label="Owner export"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const mainClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  const frameClipboard = Object.getOwnPropertyDescriptor(
    frameWindow.navigator,
    "clipboard"
  );
  const originalMainCreate = URL.createObjectURL;
  const originalMainRevoke = URL.revokeObjectURL;
  const originalFrameCreate = frameWindow.URL.createObjectURL;
  const originalFrameRevoke = frameWindow.URL.revokeObjectURL;
  const originalFrameBlob = frameWindow.Blob;
  const originalFrameClick = frameWindow.HTMLAnchorElement.prototype.click;
  const originalMainExec = document.execCommand;
  const originalFrameExec = frameDocument.execCommand;
  let mainWrites = 0;
  const frameWrites: string[] = [];
  let frameBlobConstructions = 0;
  let mainObjectUrls = 0;
  let frameObjectUrls = 0;
  let revoked = "";
  let downloaded = "";
  let fallbackText = "";

  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: () => {
        mainWrites++;
        return Promise.resolve();
      },
    },
  });
  Object.defineProperty(frameWindow.navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (text: string) => {
        frameWrites.push(text);
        return Promise.resolve();
      },
    },
  });
  URL.createObjectURL = () => {
    mainObjectUrls++;
    return "blob:wrong-realm";
  };
  URL.revokeObjectURL = () => undefined;
  frameWindow.Blob = new Proxy(originalFrameBlob, {
    construct(target, args, newTarget) {
      frameBlobConstructions++;
      return Reflect.construct(target, args, newTarget);
    },
  }) as typeof Blob;
  frameWindow.URL.createObjectURL = () => {
    frameObjectUrls++;
    return "blob:owner-data-grid";
  };
  frameWindow.URL.revokeObjectURL = (url: string) => {
    revoked = url;
  };
  frameWindow.HTMLAnchorElement.prototype.click = function click(): void {
    downloaded = `${this.ownerDocument === frameDocument ? "owner" : "wrong"}:${
      this.download
    }`;
  };

  try {
    frameDocument.body.append(frameDocument.adoptNode(element));
    await element.updateComplete;
    element.copySelectedRows({ includeHeaders: false });
    await Promise.resolve();
    expect(mainWrites).to.equal(0);
    expect(frameWrites).to.have.length(1);

    element.exportDataAsCsv({ fileName: "owner.csv" });
    expect(mainObjectUrls).to.equal(0);
    expect(frameObjectUrls).to.equal(1);
    expect(frameBlobConstructions).to.equal(1);
    expect(downloaded).to.equal("owner:owner.csv");
    expect(revoked).to.equal("blob:owner-data-grid");

    Object.defineProperty(frameWindow.navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    document.execCommand = (() => {
      throw new Error("ambient document used");
    }) as typeof document.execCommand;
    frameDocument.execCommand = ((command: string): boolean => {
      if (command === "copy") {
        fallbackText =
          frameDocument.body.querySelector<HTMLTextAreaElement>(
            ":scope > textarea"
          )?.value ?? "";
      }
      return true;
    }) as typeof frameDocument.execCommand;
    element.copySelectedRows({ includeHeaders: false });
    expect(fallbackText).to.include("Ada\tCompiler\t7");
    expect(
      frameDocument.body.querySelector(":scope > textarea") === null
    ).to.equal(true);
  } finally {
    element.remove();
    if (mainClipboard)
      Object.defineProperty(navigator, "clipboard", mainClipboard);
    else Reflect.deleteProperty(navigator, "clipboard");
    if (frameClipboard)
      Object.defineProperty(frameWindow.navigator, "clipboard", frameClipboard);
    else Reflect.deleteProperty(frameWindow.navigator, "clipboard");
    URL.createObjectURL = originalMainCreate;
    URL.revokeObjectURL = originalMainRevoke;
    frameWindow.URL.createObjectURL = originalFrameCreate;
    frameWindow.URL.revokeObjectURL = originalFrameRevoke;
    frameWindow.Blob = originalFrameBlob;
    frameWindow.HTMLAnchorElement.prototype.click = originalFrameClick;
    document.execCommand = originalMainExec;
    frameDocument.execCommand = originalFrameExec;
    frame.remove();
  }
});

it("does not use ambient clipboard or object URLs from an ownerless document", () => {
  const ownerlessDocument =
    document.implementation.createHTMLDocument("ownerless");
  const clipboardDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    "clipboard"
  );
  const originalCreateObjectUrl = URL.createObjectURL;
  let writes = 0;
  let objectUrls = 0;
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: () => {
        writes++;
        return Promise.resolve();
      },
    },
  });
  URL.createObjectURL = () => {
    objectUrls++;
    return "blob:ambient";
  };
  try {
    const element = document.createElement(
      "lr-data-grid"
    ) as LyraDataGrid<Person>;
    ownerlessDocument.adoptNode(element);
    element.columns = columns;
    element.data = rows;
    element.copySelectedRows({ includeHeaders: false });
    element.exportDataAsCsv();
    expect(writes).to.equal(0);
    expect(objectUrls).to.equal(0);
  } finally {
    if (clipboardDescriptor)
      Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
    else Reflect.deleteProperty(navigator, "clipboard");
    URL.createObjectURL = originalCreateObjectUrl;
  }
});

it("uses exact owner timers and AbortController for server work and retires them on adoption", async () => {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const frameWindow = frame.contentWindow!;
  const element = await dataGrid(html`
    <lr-data-grid label="Owner server" .columns=${columns}></lr-data-grid>
  `);
  const nativeMainSet = window.setTimeout;
  const nativeMainClear = window.clearTimeout;
  const nativeFrameSet = frameWindow.setTimeout;
  const nativeFrameClear = frameWindow.clearTimeout;
  const NativeMainAbort = window.AbortController;
  const NativeFrameAbort = frameWindow.AbortController;
  let mainTimers = 0;
  let frameTimers = 0;
  let mainControllers = 0;
  let frameControllers = 0;
  const frameCancelled: number[] = [];
  let oldTimerCallback: (() => void) | undefined;
  const timerHandle = 9137;
  let requests = 0;
  let requestSignal: AbortSignal | undefined;

  window.setTimeout = (() => {
    mainTimers++;
    return 7137;
  }) as typeof window.setTimeout;
  window.clearTimeout = (() => undefined) as typeof window.clearTimeout;
  frameWindow.setTimeout = ((handler: TimerHandler) => {
    frameTimers++;
    if (typeof handler === "function") oldTimerCallback = handler;
    return timerHandle;
  }) as typeof frameWindow.setTimeout;
  frameWindow.clearTimeout = ((handle?: number) => {
    if (handle !== undefined) frameCancelled.push(handle);
  }) as typeof frameWindow.clearTimeout;
  window.AbortController = new Proxy(NativeMainAbort, {
    construct(target, args, newTarget) {
      mainControllers++;
      return Reflect.construct(target, args, newTarget);
    },
  }) as typeof AbortController;
  frameWindow.AbortController = new Proxy(NativeFrameAbort, {
    construct(target, args, newTarget) {
      frameControllers++;
      return Reflect.construct(target, args, newTarget);
    },
  }) as typeof AbortController;

  try {
    frameDocument.body.append(frameDocument.adoptNode(element));
    await element.updateComplete;
    element.dataSource = (request) => {
      requests++;
      requestSignal = request.signal;
      return new Promise(() => undefined);
    };
    await element.updateComplete;
    expect(mainTimers).to.equal(0);
    expect(frameTimers).to.equal(1);

    void element.reload();
    expect(frameCancelled).to.include(timerHandle);
    expect(mainControllers).to.equal(0);
    expect(frameControllers).to.equal(1);
    expect(requestSignal instanceof frameWindow.AbortSignal).to.be.true;
    expect(requests).to.equal(1);

    document.body.append(document.adoptNode(element));
    expect(requestSignal!.aborted).to.be.true;
    oldTimerCallback?.();
    await Promise.resolve();
    expect(
      requests,
      "the retired owner callback must not start another request"
    ).to.equal(1);
  } finally {
    element.remove();
    window.setTimeout = nativeMainSet;
    window.clearTimeout = nativeMainClear;
    frameWindow.setTimeout = nativeFrameSet;
    frameWindow.clearTimeout = nativeFrameClear;
    window.AbortController = NativeMainAbort;
    frameWindow.AbortController = NativeFrameAbort;
    frame.remove();
  }
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
      internals.onCellClick(event, rowItem, interactiveColumns[0]!, 0);
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

it("implements roving Home/End/Page/Ctrl navigation without hijacking interactive descendants", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="Keyboard people"
      page-size="2"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const firstHeader = header(element, "name");
  firstHeader.focus();
  firstHeader.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      composed: true,
    })
  );
  await delay(0);
  let active = element.shadowRoot!.activeElement as HTMLElement;
  expect(active.dataset.rowPosition).to.equal("0");
  expect(active.dataset.columnPosition).to.equal("0");

  active.dispatchEvent(
    new KeyboardEvent("keydown", { key: "End", bubbles: true, composed: true })
  );
  await delay(0);
  active = element.shadowRoot!.activeElement as HTMLElement;
  expect(active.dataset.rowPosition).to.equal("0");
  expect(active.dataset.columnPosition).to.equal("2");

  active.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "PageDown",
      bubbles: true,
      composed: true,
    })
  );
  await delay(0);
  active = element.shadowRoot!.activeElement as HTMLElement;
  expect(active.dataset.rowPosition).to.equal("2");

  active.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Home",
      ctrlKey: true,
      bubbles: true,
      composed: true,
    })
  );
  await delay(0);
  active = element.shadowRoot!.activeElement as HTMLElement;
  expect(active.getAttribute("role")).to.equal("columnheader");
  expect(active.dataset.columnPosition).to.equal("0");

  active.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "End",
      ctrlKey: true,
      bubbles: true,
      composed: true,
    })
  );
  await delay(0);
  active = element.shadowRoot!.activeElement as HTMLElement;
  expect(active.dataset.rowPosition).to.equal("2");
  expect(active.dataset.columnPosition).to.equal("2");

  const interactiveColumns: DataGridColumn<Person>[] = [
    {
      field: "name",
      formatter: (value) => html`<button data-inner>${value}</button>`,
    },
  ];
  const interactive = await dataGrid(html`
    <lr-data-grid
      label="Interactive cells"
      .columns=${interactiveColumns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const inner = interactive.shadowRoot!.querySelector(
    "[data-inner]"
  ) as HTMLButtonElement;
  let cellClicks = 0;
  interactive.addEventListener("lr-cell-click", () => {
    cellClicks += 1;
  });
  const arrow = new KeyboardEvent("keydown", {
    key: "ArrowRight",
    bubbles: true,
    composed: true,
    cancelable: true,
  });
  inner.dispatchEvent(arrow);
  inner.click();
  expect(arrow.defaultPrevented).to.equal(false);
  expect(cellClicks).to.equal(0);
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
  const narrow = wrapper.querySelector("lr-data-grid") as LyraDataGrid<Person>;
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

it("aborts pending work and resets transient menus across disconnect and reconnect", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="Reconnect people"
      with-column-menu
      with-columns-menu
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  (
    element.shadowRoot!.querySelector(
      '[part="filter-button"]'
    ) as HTMLButtonElement
  ).click();
  (
    element.shadowRoot!.querySelector(
      '[part="columns-menu"] button'
    ) as HTMLButtonElement
  ).click();
  (
    header(element, "name").querySelector(
      '[part="column-menu-button"]'
    ) as HTMLButtonElement
  ).click();
  await element.updateComplete;

  let pendingSignal: AbortSignal | undefined;
  element.dataSource = (request) => {
    pendingSignal = request.signal;
    return new Promise(() => undefined);
  };
  await element.updateComplete;
  void element.reload();
  await delay(0);
  expect(element.loading).to.equal(true);
  const parent = element.parentElement!;
  element.remove();
  expect(pendingSignal?.aborted).to.equal(true);
  expect(element.loading).to.equal(false);
  element.dataSource = null;
  parent.append(element);
  await element.updateComplete;
  expect(element.shadowRoot!.querySelector('[part="filter-panel"]')).to.not
    .exist;
  expect(element.shadowRoot!.querySelector('[role="menu"]')).to.not.exist;
  expect(
    element.shadowRoot!.querySelector('[part="columns-menu"] [role="group"]')
  ).to.not.exist;
  await expect(element).to.be.accessible();
});

it("aborts stale server requests and applies only the latest response", async () => {
  const requests: Array<{ signal?: AbortSignal }> = [];
  const resolvers: Array<(value: { rows: Person[]; total: number }) => void> =
    [];
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      server
      .columns=${columns}
      .dataSource=${(request: { signal?: AbortSignal }) => {
        requests.push(request);
        return new Promise((resolve) => resolvers.push(resolve));
      }}
    ></lr-data-grid>
  `);
  element.searchTerm = "a";
  const first = element.reload();
  const firstResolver = resolvers.at(-1)!;
  const firstRequest = requests.at(-1)!;
  element.searchTerm = "g";
  const latest = element.reload();
  const latestResolver = resolvers.at(-1)!;
  latestResolver({ rows: [rows[2]!], total: 1 });
  await latest;
  firstResolver({ rows: [rows[0]!], total: 1 });
  await first;
  expect(firstRequest.signal?.aborted).to.equal(true);
  expect(element.data).to.deep.equal([rows[2]]);
});

interface CellValueRow {
  id: number;
  value: unknown;
}

async function valueGrid(
  data: CellValueRow[]
): Promise<LyraDataGrid<CellValueRow>> {
  const valueColumns: DataGridColumn<CellValueRow>[] = [
    { field: "value", label: "Value" },
  ];
  const element = (await fixture(html`
    <lr-data-grid
      label="Values"
      .columns=${valueColumns}
      .data=${data}
    ></lr-data-grid>
  `)) as LyraDataGrid<CellValueRow>;
  await element.updateComplete;
  return element;
}

it("stringifies object, array, date, and unserializable cell values", async () => {
  const circular: Record<string, unknown> = {};
  circular.self = circular;
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

it("reorders columns through header drag and drop", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      reorderable
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const transfer = new DataTransfer();
  header(element, "name").dispatchEvent(
    new DragEvent("dragstart", {
      bubbles: true,
      cancelable: true,
      dataTransfer: transfer,
    })
  );
  await element.updateComplete;
  expect(
    element
      .shadowRoot!.querySelector('[part="drag-ghost"]')
      ?.textContent?.trim()
  ).to.equal("Name");

  const moved = oneEvent(element, "lr-column-move");
  header(element, "score").dispatchEvent(
    new DragEvent("drop", {
      bubbles: true,
      cancelable: true,
      dataTransfer: transfer,
    })
  );
  const { detail } = await moved;
  expect(detail.columnOrder).to.deep.equal(["team", "score", "name"]);
  expect(detail.finished).to.equal(true);
  await element.updateComplete;
  expect(element.shadowRoot!.querySelector('[part="drag-ghost"]')).to.not.exist;
});

it("refuses to start a header drag for a column that cannot move", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const dragStart = new DragEvent("dragstart", {
    bubbles: true,
    cancelable: true,
    dataTransfer: new DataTransfer(),
  });
  header(element, "name").dispatchEvent(dragStart);
  await element.updateComplete;
  expect(dragStart.defaultPrevented).to.equal(true);
  expect(element.shadowRoot!.querySelector('[part="drag-ghost"]')).to.not.exist;
});

it("ignores a header drop onto the same column or from an unknown source", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      reorderable
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  let moves = 0;
  element.addEventListener("lr-column-move", () => {
    moves += 1;
  });

  const empty = new DataTransfer();
  header(element, "name").dispatchEvent(
    new DragEvent("drop", {
      bubbles: true,
      cancelable: true,
      dataTransfer: empty,
    })
  );

  const same = new DataTransfer();
  header(element, "name").dispatchEvent(
    new DragEvent("dragstart", {
      bubbles: true,
      cancelable: true,
      dataTransfer: same,
    })
  );
  await element.updateComplete;
  header(element, "name").dispatchEvent(
    new DragEvent("drop", {
      bubbles: true,
      cancelable: true,
      dataTransfer: same,
    })
  );
  await element.updateComplete;

  expect(moves).to.equal(0);
  expect(element.columnOrder).to.deep.equal([]);
  expect(element.shadowRoot!.querySelector('[part="drag-ghost"]')).to.not.exist;
});

it("clears the drag ghost when a header drag ends without a drop", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      reorderable
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  header(element, "name").dispatchEvent(
    new DragEvent("dragstart", {
      bubbles: true,
      cancelable: true,
      dataTransfer: new DataTransfer(),
    })
  );
  await element.updateComplete;
  expect(element.shadowRoot!.querySelector('[part="drag-ghost"]')).to.exist;
  header(element, "name").dispatchEvent(
    new DragEvent("dragend", { bubbles: true })
  );
  await element.updateComplete;
  expect(element.shadowRoot!.querySelector('[part="drag-ghost"]')).to.not.exist;
});

it("renders grouped rows with aggregates and group-level selection", async () => {
  const groupColumns: DataGridColumn<Person>[] = [
    { field: "name", label: "Name" },
    { field: "team", label: "Team" },
    { field: "score", label: "Score", aggregation: "sum" },
  ];
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      group-by="team"
      selectable="multiple"
      .columns=${groupColumns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const groupRows = [
    ...element.shadowRoot!.querySelectorAll('[part~="group-row"]'),
  ];
  expect(groupRows.length).to.equal(2);
  expect(groupRows[0]!.textContent).to.contain("Compiler");
  expect(groupRows[0]!.textContent).to.contain("16");
  expect(groupRows[1]!.textContent).to.contain("10");

  const groupCheckbox = groupRows[0]!.querySelector<HTMLInputElement>(
    'input[type="checkbox"]'
  )!;
  const selection = oneEvent(element, "lr-row-select");
  groupCheckbox.checked = true;
  groupCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
  await selection;
  expect(element.selectedRows.map((row) => row.name)).to.deep.equal([
    "Ada",
    "Grace",
  ]);

  groupCheckbox.checked = false;
  groupCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
  await element.updateComplete;
  expect(element.selectedRows).to.deep.equal([]);

  element.expandAllRows();
  await element.updateComplete;
  expect(
    element.expandedKeys.every((key) => String(key).startsWith("group:"))
  ).to.equal(true);
  expect(element.expandedKeys.length).to.equal(2);
  await expect(element).to.be.accessible();
});

it("applies a caller-supplied aggregated formatter to a group row", async () => {
  const groupColumns: DataGridColumn<Person>[] = [
    { field: "team", label: "Team" },
    {
      field: "score",
      label: "Score",
      aggregation: "mean",
      aggregatedFormatter: (value) => `avg ${Number(value).toFixed(1)}`,
    },
  ];
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      group-by="team"
      .columns=${groupColumns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const groupRows = [
    ...element.shadowRoot!.querySelectorAll('[part~="group-row"]'),
  ];
  expect(groupRows[0]!.textContent).to.contain("avg 8.0");
});

it("renders a footer row from string and function column footers", async () => {
  const footerColumns: DataGridColumn<Person>[] = [
    { field: "name", label: "Name", footer: "Total" },
    { field: "team", label: "Team" },
    {
      field: "score",
      label: "Score",
      footer: (footerRows) =>
        String(footerRows.reduce((sum, row) => sum + row.score, 0)),
    },
  ];
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      .columns=${footerColumns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const footerCells = [
    ...element.shadowRoot!.querySelectorAll('[part="footer-cell"]'),
  ].map((cell) => cell.textContent!.trim());
  expect(footerCells).to.deep.equal(["Total", "", "26"]);
});

it("falls back to a temporary textarea when the async clipboard is unavailable", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const clipboardDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    "clipboard"
  );
  const originalExecCommand = document.execCommand;
  let copied: string | null = null;
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: undefined,
  });
  document.execCommand = ((command: string): boolean => {
    if (command === "copy") {
      copied =
        document.body.querySelector<HTMLTextAreaElement>(":scope > textarea")
          ?.value ?? null;
    }
    return true;
  }) as typeof document.execCommand;
  try {
    expect(element.copySelectedRows({ includeHeaders: false })).to.equal(3);
  } finally {
    document.execCommand = originalExecCommand;
    if (clipboardDescriptor)
      Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
    else Reflect.deleteProperty(navigator, "clipboard");
  }
  expect(copied).to.equal(
    "Ada\tCompiler\t7\nLin\tRuntime\t10\nGrace\tCompiler\t9"
  );
  expect(document.body.querySelector(":scope > textarea")).to.not.exist;
});

it("copies and raises a context menu from the grid keyboard contract", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const clipboardDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    "clipboard"
  );
  let written = "";
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (text: string) => {
        written = text;
        return Promise.resolve();
      },
    },
  });
  try {
    const cell = dataCells(element)[0]!;
    const copy = new KeyboardEvent("keydown", {
      key: "c",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    cell.dispatchEvent(copy);
    expect(copy.defaultPrevented).to.equal(true);
    expect(written.split("\r\n")).to.deep.equal([
      "Name\tTeam\tScore",
      "Ada\tCompiler\t7",
      "Lin\tRuntime\t10",
      "Grace\tCompiler\t9",
    ]);
  } finally {
    if (clipboardDescriptor)
      Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
    else Reflect.deleteProperty(navigator, "clipboard");
  }

  const menu = oneEvent(element, "lr-cell-contextmenu");
  dataCells(element)[0]!.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "F10",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    })
  );
  const { detail } = await menu;
  expect(detail.index).to.equal(0);
  expect(detail.value).to.equal("Ada");
});

it("moves and resizes a column from the header keyboard contract", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      reorderable
      resizable
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const moved = oneEvent(element, "lr-column-move");
  const move = new KeyboardEvent("keydown", {
    key: "ArrowRight",
    shiftKey: true,
    bubbles: true,
    cancelable: true,
  });
  header(element, "name").dispatchEvent(move);
  const moveDetail = (await moved).detail;
  expect(moveDetail.columnOrder).to.deep.equal(["team", "name", "score"]);
  expect(move.defaultPrevented).to.equal(true);
  await element.updateComplete;

  const resized = oneEvent(element, "lr-column-resize");
  const resize = new KeyboardEvent("keydown", {
    key: "ArrowRight",
    altKey: true,
    bubbles: true,
    cancelable: true,
  });
  header(element, "name").dispatchEvent(resize);
  const resizeDetail = (await resized).detail;
  expect(resizeDetail.columnId).to.equal("name");
  expect(resizeDetail.finished).to.equal(true);
  expect(resize.defaultPrevented).to.equal(true);
});

it("scrolls a virtualized focus target into the body viewport", async () => {
  const many: Person[] = Array.from({ length: 300 }, (_value, index) => ({
    id: index,
    name: `Person ${index}`,
    team: index % 2 === 0 ? "Compiler" : "Runtime",
    score: index,
  }));
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      style="height: 240px"
      .columns=${columns}
      .data=${many}
    ></lr-data-grid>
  `);
  const body = element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
  expect(body.scrollTop).to.equal(0);
  const end = new KeyboardEvent("keydown", {
    key: "End",
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  dataCells(element)[0]!.dispatchEvent(end);
  await element.updateComplete;
  expect(end.defaultPrevented).to.equal(true);
  expect(body.scrollTop).to.be.greaterThan(0);
});

it("pins, unpins, and hides a column from the per-column menu", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      with-column-menu
      pinnable
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const menuButton = header(element, "name").querySelector<HTMLButtonElement>(
    '[part="column-menu-button"]'
  )!;
  menuButton.click();
  await element.updateComplete;
  const items = [
    ...header(element, "name").querySelectorAll<HTMLButtonElement>(
      '[role="menuitem"]'
    ),
  ];
  expect(items.length).to.equal(3);

  const pinned = oneEvent(element, "lr-column-pin");
  items[1]!.click();
  expect((await pinned).detail.side).to.equal("right");
  await element.updateComplete;
  expect(element.getColumnPin("name")).to.equal("right");

  items[0]!.click();
  await element.updateComplete;
  expect(element.getColumnPin("name")).to.equal("left");

  items[2]!.click();
  await element.updateComplete;
  expect(element.getColumnPin("name")).to.equal(false);

  const checkbox = header(element, "name").querySelector<HTMLInputElement>(
    '[role="menuitemcheckbox"] input'
  )!;
  expect(checkbox.checked).to.equal(true);
  const visibility = oneEvent(element, "lr-column-visibility-change");
  checkbox.checked = false;
  checkbox.dispatchEvent(new Event("change", { bubbles: true }));
  expect((await visibility).detail).to.deep.equal({
    columnId: "name",
    visible: false,
  });
  await element.updateComplete;
  expect(
    element.shadowRoot!.querySelector(
      '[part~="header-cell"][data-column-id="name"]'
    )
  ).to.not.exist;
});

it("omits the visibility checkbox for a column that cannot be hidden", async () => {
  const lockedColumns: DataGridColumn<Person>[] = [
    { field: "name", label: "Name", hideable: false },
    { field: "team", label: "Team" },
  ];
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      with-column-menu
      .columns=${lockedColumns}
      .data=${rows}
    ></lr-data-grid>
  `);
  header(element, "name")
    .querySelector<HTMLButtonElement>('[part="column-menu-button"]')!
    .click();
  await element.updateComplete;
  expect(header(element, "name").querySelector('[role="menuitemcheckbox"]')).to
    .not.exist;
  expect(header(element, "name").querySelector('[role="menuitem"]')).to.not
    .exist;
});

it("selects a range of descendant rows with a shift-click", async () => {
  const tree: Person[] = [
    {
      id: 1,
      name: "Ada",
      team: "Compiler",
      score: 7,
      children: [{ id: 11, name: "Ada Jr", team: "Compiler", score: 1 }],
    },
    { id: 2, name: "Lin", team: "Runtime", score: 10 },
    { id: 3, name: "Grace", team: "Compiler", score: 9 },
  ];
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      selectable="multiple"
      child-rows="children"
      row-key="id"
      .columns=${columns}
      .data=${tree}
    ></lr-data-grid>
  `);
  const checkboxes = [
    ...element.shadowRoot!.querySelectorAll<HTMLInputElement>(
      '[part~="row"] input[type="checkbox"]'
    ),
  ];
  // Dispatching a click on a checkbox runs its activation behavior, which is what flips
  // `checked` before the listener reads it -- pre-assigning `checked` here would be undone.
  checkboxes[0]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await element.updateComplete;
  const last = [
    ...element.shadowRoot!.querySelectorAll<HTMLInputElement>(
      '[part~="row"] input[type="checkbox"]'
    ),
  ].at(-1)!;
  last.dispatchEvent(
    new MouseEvent("click", { bubbles: true, shiftKey: true })
  );
  await element.updateComplete;
  // The shift range covers every visible row, and multi-select cascades to collapsed descendants.
  expect(element.selectedRows.map((row) => row.id)).to.deep.equal([
    1, 11, 2, 3,
  ]);
  expect(element.selectedKeys).to.contain(11);
});

it("walks the grid with every supported navigation key", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      paginate
      page-size="2"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const focused = (): string =>
    element
      .shadowRoot!.querySelector('[data-focus-cell][tabindex="0"]')
      ?.getAttribute("data-row-position") ?? "header";
  const press = (key: string, init: KeyboardEventInit = {}): KeyboardEvent => {
    const event = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      ...init,
    });
    element
      .shadowRoot!.querySelector<HTMLElement>(
        '[data-focus-cell][tabindex="0"]'
      )!
      .dispatchEvent(event);
    return event;
  };

  header(element, "name").focus();
  await element.updateComplete;
  expect(focused()).to.equal("header");

  expect(press("ArrowDown").defaultPrevented).to.equal(true);
  await element.updateComplete;
  expect(focused()).to.equal("0");

  press("ArrowRight");
  await element.updateComplete;
  press("ArrowDown");
  await element.updateComplete;
  expect(focused()).to.equal("1");

  press("ArrowUp");
  await element.updateComplete;
  expect(focused()).to.equal("0");

  press("ArrowLeft");
  await element.updateComplete;
  press("PageDown");
  await element.updateComplete;
  expect(focused()).to.equal("1");

  // A page step of two rows from row 1 clamps past row 0 onto the header row.
  press("PageUp");
  await element.updateComplete;
  expect(focused()).to.equal("header");

  press("End");
  await element.updateComplete;
  expect(
    element
      .shadowRoot!.querySelector('[data-focus-cell][tabindex="0"]')!
      .getAttribute("data-column-position")
  ).to.equal("2");

  press("Home", { ctrlKey: true });
  await element.updateComplete;
  expect(focused()).to.equal("header");

  const sorted = oneEvent(element, "lr-sort-change");
  press("Enter");
  expect((await sorted).detail.sort).to.deep.equal([
    { id: "name", desc: false },
  ]);

  press("End", { ctrlKey: true });
  await element.updateComplete;
  const clicked = oneEvent(element, "lr-cell-click");
  press("Enter");
  expect((await clicked).detail.index).to.equal(1);
});

it("toggles row selection with the space key", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      selectable="multiple"
      row-key="id"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const cell = dataCells(element)[0]!;
  cell.focus();
  const selected = oneEvent(element, "lr-row-select");
  const press = new KeyboardEvent("keydown", {
    key: " ",
    bubbles: true,
    cancelable: true,
  });
  cell.dispatchEvent(press);
  expect((await selected).detail.selectedKeys).to.deep.equal([1]);
  expect(press.defaultPrevented).to.equal(true);

  await element.updateComplete;
  dataCells(element)[0]!.dispatchEvent(
    new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true })
  );
  expect(element.selectedKeys).to.deep.equal([]);
});

it("aligns a programmatic scroll to the start, center, and end of the viewport", async () => {
  const many: Person[] = Array.from({ length: 400 }, (_value, index) => ({
    id: index,
    name: `Person ${index}`,
    team: "Compiler",
    score: index,
  }));
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      style="height: 240px"
      .columns=${columns}
      .data=${many}
    ></lr-data-grid>
  `);
  const body = element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;

  element.scrollToIndex(300, { align: "end" });
  await element.updateComplete;
  const atEnd = body.scrollTop;
  expect(atEnd).to.be.greaterThan(0);

  element.scrollToIndex(300, { align: "center" });
  await element.updateComplete;
  expect(body.scrollTop).to.be.greaterThan(atEnd);

  element.scrollToIndex(0, { align: "start" });
  await element.updateComplete;
  expect(body.scrollTop).to.equal(0);

  element.scrollToIndex(Number.NaN);
  await element.updateComplete;
  expect(body.scrollTop).to.equal(0);
});

it("reads the page and search term from their own pager and toolbar controls", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      paginate
      with-search
      page-size="1"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const search =
    element.shadowRoot!.querySelector<HTMLInputElement>('[part="search"]')!;
  search.value = "compiler";
  search.dispatchEvent(new Event("input", { bubbles: true }));
  await element.updateComplete;
  expect(element.searchTerm).to.equal("compiler");
  expect(element.page).to.equal(0);

  const sizeSelect =
    element.shadowRoot!.querySelector<HTMLSelectElement>('[part="page-size"]')!;
  const resized = oneEvent(element, "lr-page-change");
  sizeSelect.value = "10";
  sizeSelect.dispatchEvent(new Event("change", { bubbles: true }));
  expect((await resized).detail.pageSize).to.equal(10);
  expect(element.page).to.equal(0);
});

it("navigates a grouped grid from a group row that names no column", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      group-by="team"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const groupCell = element.shadowRoot!.querySelector<HTMLElement>(
    '[part="group-value"]'
  )!;
  const down = new KeyboardEvent("keydown", {
    key: "ArrowDown",
    bubbles: true,
    cancelable: true,
  });
  groupCell.dispatchEvent(down);
  await element.updateComplete;
  expect(down.defaultPrevented).to.equal(true);
  expect(
    element
      .shadowRoot!.querySelector('[data-focus-cell][tabindex="0"]')!
      .getAttribute("data-row-position")
  ).to.equal("1");
});

it("drops per-column state for columns that disappear", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      pinnable
      resizable
      with-column-menu
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  element.columnOrder = ["score", "name", "team"];
  element.pinColumn("score", "left");
  element.toggleColumn("team", false);
  element.setColumnWidth("score", 320);
  await element.updateComplete;
  expect(element.getColumnPin("score")).to.equal("left");

  element.columns = [{ field: "name", label: "Name" }];
  await element.updateComplete;
  expect(element.columnOrder).to.deep.equal(["name"]);
  expect(element.getColumnPin("score")).to.equal(false);
  expect(element.getState().widths).to.deep.equal({});
  expect(element.getState().visibility).to.deep.equal({});
});

it("resolves child rows from a callback and filters from leaf matches", async () => {
  const tree: Person[] = [
    {
      id: 1,
      name: "Parent",
      team: "Compiler",
      score: 1,
      children: [{ id: 2, name: "Needle", team: "Runtime", score: 2 }],
    },
    { id: 3, name: "Other", team: "Runtime", score: 3 },
  ];
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      row-key="id"
      filter-from-leaf-rows
      .childRows=${(row: Person) => row.children ?? []}
      .columns=${columns}
      .data=${tree}
      .expandedKeys=${[1]}
    ></lr-data-grid>
  `);
  expect(dataCells(element).length).to.be.greaterThan(0);

  element.searchTerm = "Needle";
  await element.updateComplete;
  const names = [
    ...element.shadowRoot!.querySelectorAll(
      '[part~="cell"][data-column-id="name"]'
    ),
  ].map((cell) => cell.textContent!.trim());
  expect(names).to.deep.equal(["Parent", "Needle"]);
});

it("reports facets without a range for a non-numeric column", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const teams = element.getColumnFacets("team");
  expect([...teams.uniqueValues.keys()]).to.deep.equal(["Compiler", "Runtime"]);
  expect(teams.minMax).to.equal(undefined);
  expect(element.getColumnFacets("score").minMax).to.deep.equal([7, 10]);
  expect([...element.getColumnFacets("missing").uniqueValues]).to.deep.equal(
    []
  );
});

it("renders plain rows when a grouped field names no column", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      group-by="missing"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  expect(element.shadowRoot!.querySelector('[part~="group-row"]')).to.not.exist;
  expect(dataCells(element).length).to.equal(9);
  element.expandAllRows();
  await element.updateComplete;
  expect(element.expandedKeys).to.deep.equal([]);
});

it("abandons an in-flight server request when the data source is replaced", async () => {
  let firstSignal: AbortSignal | undefined;
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      server
      .columns=${columns}
      .dataSource=${(request: { signal?: AbortSignal }) => {
        firstSignal = request.signal;
        return new Promise<never>(() => undefined);
      }}
    ></lr-data-grid>
  `);
  void element.reload();
  await delay(0);
  expect(element.loading).to.equal(true);

  element.dataSource = () => Promise.resolve({ rows: [rows[0]!], total: 1 });
  await element.updateComplete;
  expect(firstSignal?.aborted).to.equal(true);
  expect(element.loading).to.equal(false);
});

it("parses the selectable attribute converters removed and invalid-value branches", async () => {
  const element = await dataGrid(
    html`<lr-data-grid selectable="single" label="People"></lr-data-grid>`
  );
  expect(element.selectable).to.equal("single");
  element.setAttribute("selectable", "bogus");
  await element.updateComplete;
  expect(
    element.selectable,
    "an unrecognized attribute value falls back to none"
  ).to.equal("none");
  element.removeAttribute("selectable");
  await element.updateComplete;
  expect(
    element.selectable,
    "a removed attribute is treated as none, not multiple"
  ).to.equal("none");
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

it("ignores search and filter inputs, or a select-all checkbox, whose native property is not the expected primitive type", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      with-search
      selectable="multiple"
      row-key="id"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const search = element.shadowRoot!.querySelector(
    '[part="search"]'
  ) as HTMLInputElement;
  Object.defineProperty(search, "value", {
    configurable: true,
    get: () => 42 as unknown as string,
  });
  search.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  await element.updateComplete;
  expect(
    element.searchTerm,
    "a non-string .value falls back to the current search term"
  ).to.equal("");

  (
    header(element, "team").querySelector(
      '[part="filter-button"]'
    ) as HTMLButtonElement
  ).click();
  await element.updateComplete;
  const filterInput = element.shadowRoot!.querySelector(
    '[part="filter-panel"] input'
  ) as HTMLInputElement;
  Object.defineProperty(filterInput, "value", {
    configurable: true,
    get: () => 7 as unknown as string,
  });
  filterInput.dispatchEvent(
    new Event("input", { bubbles: true, composed: true })
  );
  await element.updateComplete;
  expect(
    element.filters,
    "a non-string filter value is ignored rather than applied"
  ).to.deep.equal([]);

  const selectAll = element.shadowRoot!.querySelector(
    '[part="select-all-checkbox"]'
  ) as HTMLInputElement;
  Object.defineProperty(selectAll, "checked", {
    configurable: true,
    get: () => "yes" as unknown as boolean,
  });
  selectAll.dispatchEvent(new Event("change", { bubbles: true }));
  await element.updateComplete;
  expect(
    element.selectedKeys,
    "a non-boolean .checked getter is treated as no control at all"
  ).to.deep.equal([]);
});

it("accepts an array-form groupBy and supports multi-level grouping", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      .groupBy=${["team", "score"]}
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const topGroups = [
    ...element.shadowRoot!.querySelectorAll(
      '[part~="group-row"][aria-level="1"]'
    ),
  ];
  expect(topGroups.length).to.equal(2);
  element.expandAllRows();
  await element.updateComplete;
  const nestedGroups = [
    ...element.shadowRoot!.querySelectorAll(
      '[part~="group-row"][aria-level="2"]'
    ),
  ];
  expect(nestedGroups.length).to.be.greaterThan(0);
});

it("skips client-side grouping and filtering math entirely in server mode", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="Server grouped"
      server
      paginate
      group-by="team"
      total="30"
      page-size="5"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  expect(element.pageCount).to.equal(6);
  expect(element.getColumnFacets("team").uniqueValues.size).to.equal(0);
});

it("reports zero grouped pages when a paginated groupBy names no column", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      paginate
      group-by="missing"
      page-size="2"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  expect(element.pageCount).to.equal(0);
  expect(element.getVisibleRows()).to.deep.equal([]);
});

it("treats a non-array assignment to selectedRows as empty rather than throwing", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      row-key="id"
      selectable="multiple"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  element.selectedRows = [rows[0]!];
  await element.updateComplete;
  expect(element.selectedKeys).to.deep.equal([1]);
  (element as unknown as { selectedRows: unknown }).selectedRows =
    "not-an-array";
  await element.updateComplete;
  expect(
    element.selectedKeys,
    "a non-array value resolves to no selection"
  ).to.deep.equal([]);
});

it("leaves reload inert while disconnected or without a server data source", async () => {
  let calls = 0;
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  await element.reload();
  expect(calls, "a client-only grid ignores reload").to.equal(0);

  const parent = element.parentElement!;
  element.dataSource = async () => {
    calls += 1;
    return { rows: [], total: 0 };
  };
  element.remove();
  await element.reload();
  expect(
    calls,
    "a disconnected grid ignores reload even with a data source"
  ).to.equal(0);
  parent.append(element);
});

it("ignores scrollToIndex when there are no rows to scroll to", async () => {
  const element = await dataGrid(
    html`<lr-data-grid label="Empty" .columns=${columns}></lr-data-grid>`
  );
  expect(() => element.scrollToIndex(0)).to.not.throw();
});

it("leaves sizeColumnsToFit inert before first render, with no columns, and with no flexible columns", async () => {
  const unrendered = document.createElement(
    "lr-data-grid"
  ) as LyraDataGrid<Person>;
  expect(() => unrendered.sizeColumnsToFit()).to.not.throw();

  const empty = await dataGrid();
  expect(() => empty.sizeColumnsToFit()).to.not.throw();

  const fixedColumns: DataGridColumn<Person>[] = [
    { field: "name", label: "Name", flex: 0 },
    { field: "team", label: "Team", flex: 0 },
  ];
  const fixed = await dataGrid(html`
    <lr-data-grid
      label="Fixed"
      .columns=${fixedColumns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const body = fixed.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
  Object.defineProperty(body, "clientWidth", {
    configurable: true,
    value: 600,
  });
  fixed.sizeColumnsToFit();
  expect(
    fixed.getState().widths,
    "flex:0 columns are never auto-sized"
  ).to.deep.equal({});
});

it("falls back to the textarea copy path when reading navigator.clipboard throws", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const clipboardDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    "clipboard"
  );
  const originalExecCommand = document.execCommand;
  let copied: string | null = null;
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    get() {
      throw new Error("denied by permissions policy");
    },
  });
  document.execCommand = ((command: string): boolean => {
    if (command === "copy") {
      copied =
        document.body.querySelector<HTMLTextAreaElement>(":scope > textarea")
          ?.value ?? null;
    }
    return true;
  }) as typeof document.execCommand;
  try {
    expect(element.copySelectedRows({ includeHeaders: false })).to.equal(3);
  } finally {
    document.execCommand = originalExecCommand;
    if (clipboardDescriptor)
      Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
    else Reflect.deleteProperty(navigator, "clipboard");
  }
  expect(copied).to.equal(
    "Ada\tCompiler\t7\nLin\tRuntime\t10\nGrace\tCompiler\t9"
  );
});

it("ignores a resize width write for a column id that no longer exists", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      resizable
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  element.setColumnWidth("does-not-exist", 250, false);
  expect(element.getState().widths).to.deep.equal({});
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

it("keeps a non-matching child that has its own matching descendant when filtering from leaf rows", async () => {
  const treeRows: Person[] = [
    {
      id: 1,
      name: "Grandparent",
      team: "Tree",
      score: 1,
      children: [
        {
          id: 2,
          name: "Parent",
          team: "Tree",
          score: 2,
          children: [{ id: 3, name: "Needle", team: "Tree", score: 3 }],
        },
      ],
    },
  ];
  const element = await dataGrid(html`
    <lr-data-grid
      label="Deep tree"
      child-rows="children"
      row-key="id"
      filter-from-leaf-rows
      .columns=${columns}
      .data=${treeRows}
      .expandedKeys=${[1, 2]}
    ></lr-data-grid>
  `);
  element.searchTerm = "Needle";
  await element.updateComplete;
  const names = [
    ...element.shadowRoot!.querySelectorAll(
      '[part~="cell"][data-column-id="name"]'
    ),
  ].map((cell) => cell.textContent!.trim());
  expect(names).to.deep.equal(["Grandparent", "Parent", "Needle"]);
});

it("resolves descendant selection state when a childRows callback returns a freshly constructed row each call", async () => {
  const parent: Person = { id: 1, name: "Parent", team: "Tree", score: 1 };
  const childRowsCallback = (row: Person): Person[] =>
    row.id === 1 ? [{ id: 2, name: "Child", team: "Tree", score: 2 }] : [];
  const element = await dataGrid(html`
    <lr-data-grid
      label="Dangling children"
      selectable="multiple"
      row-key="id"
      .childRows=${childRowsCallback}
      .columns=${columns}
      .data=${[parent]}
      .expandedKeys=${[1]}
    ></lr-data-grid>
  `);
  const checkboxes = [
    ...element.shadowRoot!.querySelectorAll<HTMLInputElement>(
      '[part~="row"] input[type="checkbox"]'
    ),
  ];
  expect(checkboxes).to.have.length(2);
  const selected = oneEvent(element, "lr-row-select");
  checkboxes[0]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  const { detail } = await selected;
  expect(
    detail.selectedKeys,
    "the recomputed child key is resolved by value, not by reference"
  ).to.have.members([1, 2]);

  const cascade = oneEvent(element, "lr-row-select");
  dataCells(element)[0]!.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "a",
      ctrlKey: true,
      bubbles: true,
      composed: true,
    })
  );
  expect((await cascade).detail.selectedKeys).to.include(1);
});

it("counts a child row shared by two parents only once toward selectable descendants", async () => {
  const sharedChild: Person = { id: 3, name: "Shared", team: "Tree", score: 3 };
  const parentA: Person = {
    id: 1,
    name: "A",
    team: "Tree",
    score: 1,
    children: [sharedChild],
  };
  const parentB: Person = {
    id: 2,
    name: "B",
    team: "Tree",
    score: 2,
    children: [sharedChild],
  };
  const element = await dataGrid(html`
    <lr-data-grid
      label="Shared child"
      selectable="multiple"
      row-key="id"
      child-rows="children"
      .columns=${columns}
      .data=${[parentA, parentB]}
      .expandedKeys=${[1, 2]}
    ></lr-data-grid>
  `);
  const selected = oneEvent(element, "lr-row-select");
  dataCells(element)[0]!.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "a",
      ctrlKey: true,
      bubbles: true,
      composed: true,
    })
  );
  const { detail } = await selected;
  expect(
    detail.selectedKeys,
    "a child shared by two parents is only counted once"
  ).to.have.members([1, 2, 3]);
  expect(
    detail.selectedKeys,
    "the shared child key appears only a single time"
  ).to.have.length(3);
});

it("drops the authored-width custom property once a column has an explicit resized width", async () => {
  const sizedColumns: DataGridColumn<Person>[] = [
    { field: "name", label: "Name", width: 120 },
    ...columns.slice(1),
  ];
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      resizable
      .columns=${sizedColumns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const cellBefore = dataCells(element)[0]!;
  expect(cellBefore.style.getPropertyValue("--column-authored-width")).to.equal(
    "120px"
  );
  element.setColumnWidth("name", 200, false);
  await element.updateComplete;
  const cellAfter = dataCells(element)[0]!;
  expect(cellAfter.style.getPropertyValue("--column-authored-width")).to.equal(
    ""
  );
});

it("never lets a non-finite column.width reach the styleMap-bound authored-width custom property", async () => {
  // `width` is typed `number`, but TS cannot enforce that across a caller-supplied columns array
  // at runtime -- mirrors the existing `Number.isFinite` guard the sibling `gridTemplate` getter
  // already has for this same field. A truthy-but-unsafe string (unlike `NaN`, which JS treats as
  // falsy and so never even reaches the ternary's true branch) is what actually proves the gap:
  // `styleMap()`'s first commit serializes the whole `style` value as one string, so an
  // unvalidated `;` here could break out of the custom-property declaration.
  const badColumns: DataGridColumn<Person>[] = [
    {
      field: "name",
      label: "Name",
      width: "1;background:red" as unknown as number,
    },
    ...columns.slice(1),
  ];
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      .columns=${badColumns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const cell = dataCells(element)[0]!;
  expect(cell.style.getPropertyValue("--column-authored-width")).to.equal("");
  expect(cell.style.background).to.equal("");
});

it("returns a zero pin offset for a column id that is not currently visible", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      pinnable
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  expect(element.pinOffset("does-not-exist", "left")).to.equal(0);
});

it("orders unpinned columns by natural index and sorts every left/right pin combination", async () => {
  const threeColumns: DataGridColumn<Person>[] = [
    { field: "name", label: "Name" },
    { field: "team", label: "Team" },
    { field: "score", label: "Score" },
  ];
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      pinnable
      .columns=${threeColumns}
      .data=${rows}
    ></lr-data-grid>
  `);
  element.columnOrder = ["score"];
  await element.updateComplete;
  const naturalOrder = [
    ...element.shadowRoot!.querySelectorAll('[part~="header-cell"]'),
  ].map((cellEl) => (cellEl as HTMLElement).dataset.columnId);
  expect(
    naturalOrder,
    "columns absent from a partial columnOrder keep their natural relative order"
  ).to.deep.equal(["score", "name", "team"]);

  element.pinColumn("name", "left");
  element.pinColumn("score", "right");
  await element.updateComplete;
  const pinnedOrder = [
    ...element.shadowRoot!.querySelectorAll('[part~="header-cell"]'),
  ].map((cellEl) => (cellEl as HTMLElement).dataset.columnId);
  expect(pinnedOrder).to.deep.equal(["name", "team", "score"]);
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

it("reserves an empty footer cell for the selection column", async () => {
  const footerColumns: DataGridColumn<Person>[] = [
    { field: "name", label: "Name", footer: "Total" },
    { field: "team", label: "Team" },
  ];
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      selectable="multiple"
      .columns=${footerColumns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const footerRow = element.shadowRoot!.querySelector('[part="footer-row"]')!;
  expect(
    footerRow.children.length,
    "selection column plus name and team"
  ).to.equal(3);
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

it("sizes an unflagged column using the default flex share", async () => {
  const mixedColumns: DataGridColumn<Person>[] = [
    { field: "name", label: "Name" },
    { field: "team", label: "Team", flex: 1 },
  ];
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      .columns=${mixedColumns}
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

it("toggles a group row collapsed after it has been expanded", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      group-by="team"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const groupButton = element.shadowRoot!.querySelector(
    '[part="group-row"] [part="expand-button"]'
  ) as HTMLButtonElement;
  groupButton.click();
  await element.updateComplete;
  expect(element.expandedKeys.length).to.equal(1);
  groupButton.click();
  await element.updateComplete;
  expect(
    element.expandedKeys,
    "a second click collapses an already-expanded group"
  ).to.deep.equal([]);
});

it("ignores column-move and resize requests for a column id that is no longer known", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      reorderable
      resizable
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const internals = element as unknown as {
    moveColumn(id: string, delta: number, emitUserEvent: boolean): void;
    onResizeStart(event: PointerEvent, id: string): void;
    onResizeKey(event: KeyboardEvent, id: string): void;
  };
  let moves = 0;
  let resizes = 0;
  element.addEventListener("lr-column-move", () => {
    moves += 1;
  });
  element.addEventListener("lr-column-resize", () => {
    resizes += 1;
  });

  internals.moveColumn("does-not-exist", 1, true);
  expect(moves, "an unknown column id is ignored").to.equal(0);
  expect(element.columnOrder).to.deep.equal([]);

  const noopKey = {
    altKey: true,
    key: "ArrowRight",
    preventDefault() {},
  } as unknown as KeyboardEvent;
  internals.onResizeKey(noopKey, "does-not-exist");
  expect(resizes, "a resize key on an unknown column id does nothing").to.equal(
    0
  );

  const notAltKey = {
    altKey: false,
    key: "ArrowRight",
    preventDefault() {},
  } as unknown as KeyboardEvent;
  internals.onResizeKey(notAltKey, "name");
  expect(resizes, "a resize key without Alt does nothing").to.equal(0);

  const startEvent = {
    clientX: 0,
    pointerId: 1,
    currentTarget: { setPointerCapture() {} },
  } as unknown as PointerEvent;
  internals.onResizeStart(startEvent, "does-not-exist");
  expect(
    resizes,
    "starting a resize on an unknown column id does nothing"
  ).to.equal(0);
});

it("refuses to reorder the first column further left", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      reorderable
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  let moves = 0;
  element.addEventListener("lr-column-move", () => {
    moves += 1;
  });
  header(element, "name").dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowLeft",
      shiftKey: true,
      bubbles: true,
      composed: true,
    })
  );
  await element.updateComplete;
  expect(moves, "the first column cannot move further left").to.equal(0);
  expect(element.columnOrder).to.deep.equal([]);
});

it("falls back to the estimated width and ignores stray pointer moves without an active resize session", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      resizable
      with-column-menu
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  element.toggleColumn("name", false);
  await element.updateComplete;
  const internals = element as unknown as {
    onResizeStart(event: PointerEvent, id: string): void;
    onResizeMove(event: PointerEvent): void;
    onResizeEnd(event: PointerEvent): void;
    resizeSession?: { columnId: string; startWidth: number; pointerId: number };
  };
  const startEvent = {
    clientX: 0,
    pointerId: 5,
    currentTarget: { setPointerCapture() {} },
    preventDefault() {},
  } as unknown as PointerEvent;
  internals.onResizeStart(startEvent, "name");
  expect(
    internals.resizeSession?.startWidth,
    "a hidden columns header falls back to an estimated width"
  ).to.be.greaterThan(0);

  let resizeEvents = 0;
  element.addEventListener("lr-column-resize", () => {
    resizeEvents += 1;
  });
  internals.onResizeMove({
    pointerId: 999,
    clientX: 10,
  } as unknown as PointerEvent);
  internals.onResizeEnd({ pointerId: 999 } as unknown as PointerEvent);
  expect(
    resizeEvents,
    "a pointer id that does not match the active session is ignored"
  ).to.equal(0);

  internals.resizeSession = undefined;
  expect(() =>
    internals.onResizeMove({
      pointerId: 1,
      clientX: 10,
    } as unknown as PointerEvent)
  ).to.not.throw();
  expect(() =>
    internals.onResizeEnd({ pointerId: 1 } as unknown as PointerEvent)
  ).to.not.throw();
  expect(
    resizeEvents,
    "a pointer move or end without any active session does nothing"
  ).to.equal(0);
});

it("leaves width state and events unchanged when pointercancel arrives before any pointermove", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      resizable
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const resizeEvents: Array<{ width: number; finished: boolean }> = [];
  element.addEventListener("lr-column-resize", (event) =>
    resizeEvents.push(event.detail)
  );
  const handle = header(element, "name").querySelector(
    '[part="resize-handle"]'
  ) as HTMLElement;
  handle.dispatchEvent(
    new PointerEvent("pointerdown", {
      pointerId: 3,
      clientX: 50,
      bubbles: true,
      composed: true,
    })
  );
  handle.dispatchEvent(
    new PointerEvent("pointercancel", {
      pointerId: 3,
      clientX: 50,
      bubbles: true,
      composed: true,
    })
  );
  await element.updateComplete;
  expect(resizeEvents.length).to.equal(0);
  expect(element.getState().widths.name).to.be.undefined;
});

it("rolls back an in-flight pointer resize when pointer capture is lost", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      resizable
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const resizeEvents: Array<{ width: number; finished: boolean }> = [];
  element.addEventListener("lr-column-resize", (event) =>
    resizeEvents.push(event.detail)
  );
  const handle = header(element, "name").querySelector(
    '[part="resize-handle"]'
  ) as HTMLElement;
  handle.dispatchEvent(
    new PointerEvent("pointerdown", {
      pointerId: 6,
      clientX: 80,
      bubbles: true,
      composed: true,
    })
  );
  handle.dispatchEvent(
    new PointerEvent("pointermove", {
      pointerId: 6,
      clientX: 120,
      bubbles: true,
      composed: true,
    })
  );
  handle.dispatchEvent(
    new PointerEvent("lostpointercapture", {
      pointerId: 6,
      bubbles: true,
      composed: true,
    })
  );
  await element.updateComplete;

  expect(resizeEvents.map((detail) => detail.finished)).to.deep.equal([
    false,
    false,
  ]);
  expect(resizeEvents.at(-1)!.width).to.be.lessThan(resizeEvents[0]!.width);
  expect(element.getState().widths.name).to.be.undefined;
});

it("resizes a column in the RTL-appropriate direction by pointer and by keyboard", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      dir="rtl"
      label="RTL resize"
      resizable
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const before = element.getState().widths.name;
  const keyResized = oneEvent(element, "lr-column-resize");
  header(element, "name").dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowRight",
      altKey: true,
      bubbles: true,
      composed: true,
    })
  );
  const keyDetail = (await keyResized).detail;
  expect(
    keyDetail.width,
    "RTL treats ArrowRight as a logical decrease"
  ).to.be.lessThan(before ?? keyDetail.width + 1);

  const handle = header(element, "name").querySelector(
    '[part="resize-handle"]'
  ) as HTMLElement;
  const pointerResized = oneEvent(element, "lr-column-resize");
  handle.dispatchEvent(
    new PointerEvent("pointerdown", {
      pointerId: 8,
      clientX: 100,
      bubbles: true,
      composed: true,
    })
  );
  handle.dispatchEvent(
    new PointerEvent("pointermove", {
      pointerId: 8,
      clientX: 140,
      bubbles: true,
      composed: true,
    })
  );
  handle.dispatchEvent(
    new PointerEvent("pointerup", {
      pointerId: 8,
      bubbles: true,
      composed: true,
    })
  );
  const pointerDetail = (await pointerResized).detail;
  expect(
    pointerDetail.width,
    "dragging right shrinks the column under RTL"
  ).to.be.lessThan(keyDetail.width);
});

it("sorts an unpinned column before a right-pinned one", async () => {
  const twoColumns: DataGridColumn<Person>[] = [
    { field: "name", label: "Name" },
    { field: "score", label: "Score" },
  ];
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      pinnable
      .columns=${twoColumns}
      .data=${rows}
    ></lr-data-grid>
  `);
  element.pinColumn("score", "right");
  await element.updateComplete;
  const order = [
    ...element.shadowRoot!.querySelectorAll('[part~="header-cell"]'),
  ].map((cellEl) => (cellEl as HTMLElement).dataset.columnId);
  expect(order).to.deep.equal(["name", "score"]);
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
      element.getState().widths?.name,
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

it("ignores a page-size select whose value getter is not a usable primitive", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      paginate
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const sizeSelect = element.shadowRoot!.querySelector(
    '[part="page-size"]'
  ) as HTMLSelectElement;
  Object.defineProperty(sizeSelect, "value", {
    configurable: true,
    get: () => undefined as unknown as string,
  });
  sizeSelect.dispatchEvent(new Event("change", { bubbles: true }));
  await element.updateComplete;
  expect(
    element.pageSize,
    "a control the guard rejects leaves pageSize untouched"
  ).to.equal(20);
});

it("moves plain Home and End focus within the current row rather than to the header or grid edges", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const secondCell = element.shadowRoot!.querySelector(
    '[role="gridcell"][data-row-position="1"][data-column-position="1"]'
  ) as HTMLElement;
  secondCell.focus();
  secondCell.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Home", bubbles: true, composed: true })
  );
  await delay(0);
  let active = element.shadowRoot!.activeElement as HTMLElement;
  expect(
    active.dataset.rowPosition,
    "a plain Home stays on the same row"
  ).to.equal("1");
  expect(active.dataset.columnPosition).to.equal("0");

  active.dispatchEvent(
    new KeyboardEvent("keydown", { key: "End", bubbles: true, composed: true })
  );
  await delay(0);
  active = element.shadowRoot!.activeElement as HTMLElement;
  expect(
    active.dataset.rowPosition,
    "a plain End stays on the same row"
  ).to.equal("1");
  expect(active.dataset.columnPosition).to.equal("2");
});

it("resizes a column left by keyboard without Alt+ArrowRight", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      resizable
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const before = element.getState().widths.name;
  const resized = oneEvent(element, "lr-column-resize");
  header(element, "name").dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowLeft",
      altKey: true,
      bubbles: true,
      composed: true,
    })
  );
  const { detail } = await resized;
  expect(detail.width, "Alt+ArrowLeft narrows the column").to.be.lessThan(
    before ?? detail.width + 1
  );
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

it("ignores autoSizeColumn once its column id has fallen out of the live column definitions", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const staleId = header(element, "name").dataset.columnId!;
  element.columns = [{ field: "team", label: "Team" }];
  expect(() => element.autoSizeColumn(staleId)).to.not.throw();
  expect(element.getState().widths).to.deep.equal({});
});

it("downloads a CSV export with the default file name when none is supplied", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  const originalAnchorClick = HTMLAnchorElement.prototype.click;
  let downloaded = "";
  URL.createObjectURL = () => "blob:default-name";
  URL.revokeObjectURL = () => undefined;
  HTMLAnchorElement.prototype.click = function click(): void {
    downloaded = this.download;
  };
  try {
    element.exportDataAsCsv();
    expect(downloaded).to.equal("data.csv");
  } finally {
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
    HTMLAnchorElement.prototype.click = originalAnchorClick;
  }
});

it("ignores pinColumn and toggleColumn for a column id that does not exist", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      pinnable
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  element.pinColumn("does-not-exist", "left");
  element.toggleColumn("does-not-exist", false);
  expect(element.getState().pinning).to.deep.equal({});
  expect(element.getState().visibility).to.deep.equal({});
});

it("ignores scrollToIndex before the body element has ever been rendered", () => {
  const element = document.createElement(
    "lr-data-grid"
  ) as LyraDataGrid<Person>;
  element.columns = columns;
  element.data = rows;
  expect(() => element.scrollToIndex(0)).to.not.throw();
});

it("avoids dividing by zero when every flexible column resolves to zero flex", async () => {
  const invalidFlexColumns: DataGridColumn<Person>[] = [
    { field: "name", label: "Name", flex: -1 },
    { field: "team", label: "Team", flex: -1 },
  ];
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      .columns=${invalidFlexColumns}
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
  expect(() => element.sizeColumnsToFit()).to.not.throw();
  expect(
    element.getState().widths,
    "a zero-flex total falls back to the column count instead of NaN"
  ).to.deep.equal({ name: 0, team: 0 });
});

it("copies with a fallback textarea even when the owner document has no body", async () => {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  frameDocument.body.remove();
  const clipboardDescriptor = Object.getOwnPropertyDescriptor(
    frame.contentWindow!.navigator,
    "clipboard"
  );
  Object.defineProperty(frame.contentWindow!.navigator, "clipboard", {
    configurable: true,
    value: undefined,
  });
  try {
    const element = document.createElement(
      "lr-data-grid"
    ) as LyraDataGrid<Person>;
    frameDocument.adoptNode(element);
    element.columns = columns;
    element.data = rows;
    expect(() =>
      element.copySelectedRows({ includeHeaders: false })
    ).to.not.throw();
  } finally {
    if (clipboardDescriptor)
      Object.defineProperty(
        frame.contentWindow!.navigator,
        "clipboard",
        clipboardDescriptor
      );
    else Reflect.deleteProperty(frame.contentWindow!.navigator, "clipboard");
    frame.remove();
  }
});

it("ignores a header drop whose payload names an unknown source column", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      reorderable
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  let moves = 0;
  element.addEventListener("lr-column-move", () => {
    moves += 1;
  });
  const transfer = new DataTransfer();
  transfer.setData("text/plain", "unknown-column");
  header(element, "team").dispatchEvent(
    new DragEvent("drop", {
      bubbles: true,
      cancelable: true,
      dataTransfer: transfer,
    })
  );
  await element.updateComplete;
  expect(moves, "an unknown source column id is ignored").to.equal(0);
  expect(element.columnOrder).to.deep.equal([]);
});

describe("data-grid processing helpers", () => {
  const locale = "en";

  it("derives a column id from id, field, then position", () => {
    expect(columnId({ id: "explicit", field: "name" }, 0)).to.equal("explicit");
    expect(columnId({ field: "name" }, 0)).to.equal("name");
    expect(columnId({}, 2)).to.equal("column-3");
  });

  it("reads dot paths defensively", () => {
    expect(pathValue({ a: { b: 1 } }, "a.b")).to.equal(1);
    expect(pathValue({ a: { b: 1 } }, "")).to.equal(undefined);
    expect(pathValue({ a: 1 }, "a.b")).to.equal(undefined);
    expect(pathValue(null, "a")).to.equal(undefined);
  });

  it("prefers a column value callback over its field path", () => {
    const row = { name: "Ada" };
    expect(
      columnValue({ value: () => "computed", field: "name" }, row)
    ).to.equal("computed");
    expect(columnValue({ field: "name" }, row)).to.equal("Ada");
    expect(columnValue({}, row)).to.equal(undefined);
  });

  it("compares number and date ranges, including an inclusive end day", () => {
    const numberColumn: DataGridColumn<{ v: unknown }> = {
      field: "v",
      filterType: "number-range",
    };
    expect(
      matchesFilter({ v: 5 }, numberColumn, "not-an-array", locale)
    ).to.equal(true);
    expect(matchesFilter({ v: 5 }, numberColumn, [1, 10], locale)).to.equal(
      true
    );
    expect(matchesFilter({ v: 0 }, numberColumn, [1, 10], locale)).to.equal(
      false
    );
    expect(matchesFilter({ v: 20 }, numberColumn, [1, 10], locale)).to.equal(
      false
    );
    expect(
      matchesFilter({ v: 20 }, numberColumn, [1, undefined], locale)
    ).to.equal(true);
    expect(matchesFilter({ v: "" }, numberColumn, [1, 10], locale)).to.equal(
      false
    );
    expect(matchesFilter({ v: "x" }, numberColumn, [1, 10], locale)).to.equal(
      false
    );

    const dateColumn: DataGridColumn<{ v: unknown }> = {
      field: "v",
      filterType: "date-range",
    };
    const start = new Date(2024, 0, 1);
    const end = new Date(2024, 0, 31);
    expect(
      matchesFilter(
        { v: new Date(2024, 0, 31, 23, 30) },
        dateColumn,
        [start, end],
        locale
      )
    ).to.equal(true);
    expect(
      matchesFilter(
        { v: new Date(2024, 1, 1) },
        dateColumn,
        [start, end],
        locale
      )
    ).to.equal(false);
    expect(
      matchesFilter({ v: "2024-01-15" }, dateColumn, [start, end], locale)
    ).to.equal(true);
    expect(
      matchesFilter(
        { v: new Date(Number.NaN) },
        dateColumn,
        [start, end],
        locale
      )
    ).to.equal(false);
    expect(
      matchesFilter({ v: { nested: true } }, dateColumn, [start, end], locale)
    ).to.equal(false);
  });

  it("matches equality, set, includes-any, includes-all, and free-text filters", () => {
    const row = { tags: ["alpha", "beta"], name: "Ada" };
    const tags = (
      filterType: DataGridFilterType
    ): DataGridColumn<typeof row> => ({ field: "tags", filterType });

    expect(
      matchesFilter(row, { field: "name", filterType: "equals" }, "ada", locale)
    ).to.equal(true);
    expect(
      matchesFilter(row, { field: "name", filterType: "equals" }, "lin", locale)
    ).to.equal(false);

    expect(matchesFilter(row, tags("set"), [], locale)).to.equal(true);
    expect(matchesFilter(row, tags("set"), new Set(["beta"]), locale)).to.equal(
      true
    );
    expect(
      matchesFilter(row, tags("includes-any"), ["gamma", "beta"], locale)
    ).to.equal(true);
    expect(
      matchesFilter(row, tags("includes-all"), ["alpha", "beta"], locale)
    ).to.equal(true);
    expect(
      matchesFilter(row, tags("includes-all"), ["alpha", "gamma"], locale)
    ).to.equal(false);

    expect(matchesFilter(row, { field: "name" }, "AD", locale)).to.equal(true);
    expect(matchesFilter(row, { field: "name" }, "zz", locale)).to.equal(false);
    expect(
      matchesFilter(
        row,
        { field: "name", filterFn: () => true },
        "ignored",
        locale
      )
    ).to.equal(true);

    const scalar = { value: new Set(["x"]) };
    expect(
      matchesFilter(scalar, { field: "value", filterType: "set" }, "x", locale)
    ).to.equal(true);
  });

  it("stringifies exotic values consistently for text comparison and CSV", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const exotic = [
      { v: new Date(Date.UTC(2024, 0, 2)) },
      { v: new Date(Number.NaN) },
      { v: ["a", "b"] },
      { v: { big: 7n } },
      { v: circular },
      { v: null },
    ];
    const csv = rowsAsDelimited(exotic, [{ field: "v", label: "V" }], {
      includeHeaders: false,
    });
    expect(csv.split("\r\n")).to.deep.equal([
      "2024-01-02T00:00:00.000Z",
      "",
      "a b",
      '"{""big"":""7""}"',
      "",
      "",
    ]);
  });

  it("ranks missing values by the sortUndefined policy", () => {
    const withHoles = [{ v: 2 }, { v: null }, { v: 1 }];
    const ids = (
      policy: DataGridColumn<{ v: unknown }>["sortUndefined"],
      desc: boolean
    ): unknown[] =>
      sortRows(
        withHoles,
        [{ id: "v", field: "v", sortUndefined: policy }],
        [{ id: "v", desc }],
        locale
      ).map((row) => row.v);

    expect(ids("last", false)).to.deep.equal([1, 2, null]);
    expect(ids("first", false)).to.deep.equal([null, 1, 2]);
    expect(ids(-1, false)).to.deep.equal([null, 1, 2]);
    expect(ids(1, false)).to.deep.equal([1, 2, null]);
    // A numeric policy is direction-aware; the string spellings pin the hole to one end.
    expect(ids(1, true)).to.deep.equal([null, 2, 1]);
    expect(ids("last", true)).to.deep.equal([2, 1, null]);
    expect(
      sortRows(
        withHoles,
        [{ field: "v" }],
        [{ id: "missing", desc: false }],
        locale
      )
    ).to.deep.equal(withHoles);
  });

  it("honors every sort algorithm and a custom comparator", () => {
    const dated = [{ v: "2024-03-01" }, { v: "2024-01-01" }];
    expect(
      sortRows(
        dated,
        [{ id: "v", field: "v", sortFn: "datetime" }],
        [{ id: "v", desc: false }],
        locale
      )
    ).to.deep.equal([{ v: "2024-01-01" }, { v: "2024-03-01" }]);

    const basic = [{ v: 10 }, { v: 2 }];
    expect(
      sortRows(
        basic,
        [{ id: "v", field: "v", sortFn: "basic" }],
        [{ id: "v", desc: false }],
        locale
      )
    ).to.deep.equal([{ v: 2 }, { v: 10 }]);

    const mixedCase = [{ v: "b" }, { v: "A" }];
    expect(
      sortRows(
        mixedCase,
        [{ id: "v", field: "v", sortFn: "textCaseSensitive" }],
        [{ id: "v", desc: false }],
        locale
      ).map((row) => row.v)
    ).to.deep.equal(["A", "b"]);
    expect(
      sortRows(
        [{ v: "item10" }, { v: "item2" }],
        [{ id: "v", field: "v", sortFn: "alphanumericCaseSensitive" }],
        [{ id: "v", desc: false }],
        locale
      ).map((row) => row.v)
    ).to.deep.equal(["item2", "item10"]);

    expect(
      sortRows(
        [{ v: 1 }, { v: 3 }],
        [
          {
            id: "v",
            field: "v",
            comparator: (left, right) => Number(right) - Number(left),
          },
        ],
        [{ id: "v", desc: false }],
        locale
      ).map((row) => row.v)
    ).to.deep.equal([3, 1]);

    // Non-parsable datetimes fall through to the collator rather than producing NaN ordering.
    expect(
      sortRows(
        [{ v: "zeta" }, { v: "alpha" }],
        [{ id: "v", field: "v", sortFn: "datetime" }],
        [{ id: "v", desc: false }],
        locale
      ).map((row) => row.v)
    ).to.deep.equal(["alpha", "zeta"]);
  });

  it("computes every named aggregation and its empty-input fallbacks", () => {
    const numbers = [1, 2, 3, 4];
    const asRows = numbers.map((value) => ({ value }));
    expect(aggregateValues("count", asRows, numbers)).to.equal(4);
    expect(aggregateValues("sum", asRows, numbers)).to.equal(10);
    expect(aggregateValues("min", asRows, numbers)).to.equal(1);
    expect(aggregateValues("max", asRows, numbers)).to.equal(4);
    expect(aggregateValues("mean", asRows, numbers)).to.equal(2.5);
    expect(aggregateValues("median", asRows, numbers)).to.equal(2.5);
    expect(aggregateValues("median", asRows.slice(0, 3), [1, 2, 3])).to.equal(
      2
    );
    expect(aggregateValues("extent", asRows, numbers)).to.deep.equal([1, 4]);
    expect(aggregateValues("unique", asRows, [1, 1, 2])).to.deep.equal([1, 2]);
    expect(aggregateValues("uniqueCount", asRows, [1, 1, 2])).to.equal(2);
    expect(
      aggregateValues((rows) => rows.length * 2, asRows, numbers)
    ).to.equal(8);

    expect(aggregateValues("sum", [], [])).to.equal(undefined);
    expect(aggregateValues("extent", [], [])).to.deep.equal([]);
    expect(aggregateValues("unique", [], [null, undefined])).to.deep.equal([]);
  });

  it("escapes formulas, delimiters, and quotes when serializing rows", () => {
    const tricky = [
      { text: "=cmd()", other: "a,b", quoted: 'say "hi"', amount: -5 },
    ];
    const cols: DataGridColumn<(typeof tricky)[number]>[] = [
      { field: "text", label: "Text" },
      { field: "other", label: "Other" },
      { field: "quoted", label: "Quoted" },
      { field: "amount", label: "Amount" },
    ];
    expect(rowsAsDelimited(tricky, cols, { includeHeaders: false })).to.equal(
      `'=cmd(),"a,b","say ""hi""",-5`
    );
    expect(
      rowsAsDelimited(tricky, cols, {
        includeHeaders: false,
        escapeFormulas: false,
      })
    ).to.equal(`=cmd(),"a,b","say ""hi""",-5`);
    expect(rowsAsDelimited(tricky, cols, { columnIds: ["other"] })).to.equal(
      'Other\r\n"a,b"'
    );
    expect(
      rowsAsDelimited(tricky, cols, { columns: ["amount"], delimiter: "\t" })
    ).to.equal("Amount\r\n-5");
    expect(
      rowsAsDelimited(
        tricky,
        [...cols.slice(0, 1), { field: "other", label: "Other", hidden: true }],
        {}
      )
    ).to.equal(`Text\r\n'=cmd()`);
  });
});
