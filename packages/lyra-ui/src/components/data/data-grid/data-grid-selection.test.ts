import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import './data-grid.js';
import type { LyraDataGrid } from './data-grid.js';
import type { DataGridColumn, DataGridState } from './data-grid-types.js';
import { type Person, columns, rows, dataGrid, delay, header, dataCells } from '../../../../test/data-grid.js';


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

/**
 * Regression: a template binding `.selectedRows=${…}` before `.data=${…}` (Lit commits property
 * bindings in source order) previously resolved `selectedRows` against the still-default empty
 * `data`, dropping the initial selection permanently -- `willUpdate()`'s own pruning pass only ever
 * removes now-invalid keys, it never re-derives them from the originally-assigned candidate rows.
 */
it('resolves an initial selectedRows binding set before data in the same template', async () => {
  const initialRows = [rows[1]!];
  const element = await dataGrid(
    html`<lr-data-grid row-key="id" .selectedRows=${initialRows} .data=${rows}></lr-data-grid>`
  );

  expect(element.selectedKeys).to.deep.equal([2]);
  expect(element.selectedRows).to.deep.equal([rows[1]]);
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

it("keeps selectable empty-state spans coherent with the grid's ARIA column count", async () => {
  for (const selectable of ["single", "multiple"] as const) {
    const element = await dataGrid(html`
      <lr-data-grid
        label="People"
        selectable=${selectable}
        .columns=${columns}
        .data=${[]}
      ></lr-data-grid>
    `);
    const grid = element.shadowRoot!.querySelector<HTMLElement>('[role="grid"]')!;
    const empty = element.shadowRoot!.querySelector<HTMLElement>('[part="empty"]')!;
    expect(grid.getAttribute("aria-colcount"), `${selectable} empty grid`).to.equal("4");
    expect(empty.getAttribute("aria-colspan"), `${selectable} empty span`).to.equal("4");

    element.data = rows;
    element.searchTerm = "not-present";
    await element.updateComplete;
    const noResults = element.shadowRoot!.querySelector<HTMLElement>('[part="no-results"]')!;
    expect(grid.getAttribute("aria-colcount"), `${selectable} filtered grid`).to.equal("4");
    expect(noResults.getAttribute("aria-colspan"), `${selectable} filtered span`).to.equal("4");
  }
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
  expect(event.detail.selectedRowKeys).to.deep.equal([1]);
  expect(event.detail.selectedKeys).to.deep.equal([1]);
  expect(event.detail.selectedRows[0] === rows[0]).to.equal(true);
  expect(Object.isFrozen(event.detail)).to.equal(true);
  expect(Object.isFrozen(event.detail.selectedKeys)).to.equal(true);
  expect(Object.isFrozen(event.detail.selectedRowKeys)).to.equal(true);
  expect(Object.isFrozen(event.detail.selectedRows)).to.equal(true);
});

// [part~='row']:hover and [part~='row'][aria-selected='true'] are both (0,2,0), so only source
// order decides which one wins -- and until now that was the selected rule, making a hover on an
// already-selected row a visual no-op. Rendered assertion only: the selector is exactly the kind
// of thing that reads correct and matches nothing. The row's background-color transitions (120ms
// default), so each read waits out a margined settle time rather than sampling mid-transition.
it("shows a hover fill on an already-selected row, distinct from the resting selected fill", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      selectable="single"
      row-key="id"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  element.selectedRows = [rows[0]!];
  await element.updateComplete;
  const selected = element.shadowRoot!.querySelector(
    '[part~="row"][aria-selected="true"]'
  ) as HTMLElement;
  selected.scrollIntoView();
  await delay(200);
  const resting = getComputedStyle(selected).backgroundColor;
  try {
    await hoverUntilMatched(selected, "already-selected row is hovered");
    await waitUntil(
      () => getComputedStyle(selected).backgroundColor !== resting,
      "hovered selected row never painted its distinct hover fill",
    );
  } finally {
    await resetMouse();
  }
});

// [part~='row']:active and [part~='row'][aria-selected='true'] are both (0,2,0), so only source
// order makes the pressed fill win -- and the selected row is precisely the one a user presses to
// deselect. Nothing but a rendered assertion catches a reordering of those two rules. The row's
// background-color transitions (120ms default), so each read waits out a margined settle time
// rather than sampling mid-transition.
it("shows a pressed fill on an already-selected row", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      selectable="single"
      row-key="id"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  element.selectedRows = [rows[0]!];
  await element.updateComplete;
  const selected = element.shadowRoot!.querySelector(
    '[part~="row"][aria-selected="true"]'
  ) as HTMLElement;
  selected.scrollIntoView();
  await delay(200);
  const resting = getComputedStyle(selected).backgroundColor;
  try {
    await hoverUntilMatched(selected, "already-selected row is hovered");
    await sendMouse({ type: "down" });
    await waitUntil(() => getComputedStyle(selected).backgroundColor !== resting, 'selected background color never moved off resting');
  } finally {
    await sendMouse({ type: "up" });
    await resetMouse();
  }
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
  const collapseDetail = (await collapse).detail;
  expect(collapseDetail.rowKey).to.equal(10);
  expect(collapseDetail.key).to.equal(10);
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

it("renders a selected tree parent as selected in single-selection mode", async () => {
  const treeRows: Person[] = [
    {
      id: 10,
      name: "Parent",
      team: "Tree",
      score: 1,
      children: [{ id: 11, name: "Child", team: "Tree", score: 2 }],
    },
  ];
  const element = await dataGrid(html`
    <lr-data-grid
      label="Single tree selection"
      selectable="single"
      row-key="id"
      child-rows="children"
      .columns=${columns}
      .data=${treeRows}
      .expandedKeys=${[10]}
    ></lr-data-grid>
  `);
  element.shadowRoot!.querySelector<HTMLInputElement>(
    '[part~="row"] input[type="radio"]'
  )!.click();
  await element.updateComplete;

  const parentRow = element.shadowRoot!.querySelector<HTMLElement>(
    '[part~="row"]'
  )!;
  const parentRadio = parentRow.querySelector<HTMLInputElement>(
    'input[type="radio"]'
  )!;
  expect(element.selectedKeys).to.deep.equal([10]);
  expect(parentRadio.checked).to.equal(true);
  expect(parentRadio.indeterminate).to.equal(false);
  expect(parentRow.getAttribute("aria-selected")).to.equal("true");
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
  expect(state.selectedRowKeys).to.deep.equal([1]);
  expect(state.expandedRowKeys).to.deep.equal([1]);
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

it("falls back to no grouping when groupBy is assigned neither a string nor an array", async () => {
  const element = await dataGrid(html`
    <lr-data-grid label="People" .columns=${columns} .data=${rows}></lr-data-grid>
  `);
  element.groupBy = 42 as unknown as string;
  await element.updateComplete;
  expect(element.groupBy).to.equal(null);
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
  expect(active.dataset['rowPosition']).to.equal("0");
  expect(active.dataset['columnPosition']).to.equal("0");

  active.dispatchEvent(
    new KeyboardEvent("keydown", { key: "End", bubbles: true, composed: true })
  );
  await delay(0);
  active = element.shadowRoot!.activeElement as HTMLElement;
  expect(active.dataset['rowPosition']).to.equal("0");
  expect(active.dataset['columnPosition']).to.equal("2");

  active.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "PageDown",
      bubbles: true,
      composed: true,
    })
  );
  await delay(0);
  active = element.shadowRoot!.activeElement as HTMLElement;
  expect(active.dataset['rowPosition']).to.equal("2");

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
  expect(active.dataset['columnPosition']).to.equal("0");

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
  expect(active.dataset['rowPosition']).to.equal("2");
  expect(active.dataset['columnPosition']).to.equal("2");

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

it("renders plain rows when a grouped field names no column", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      group-by="missing"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  expect((element.shadowRoot!.querySelector('[part~="group-row"]')) == null).to.be.true;
  expect(dataCells(element).length).to.equal(9);
  element.expandAllRows();
  await element.updateComplete;
  expect(element.expandedKeys).to.deep.equal([]);
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

it("treats a row as childless instead of throwing when the childRows callback itself throws", async () => {
  const parent: Person = { id: 1, name: "Parent", team: "Tree", score: 1 };
  const element = await dataGrid(html`
    <lr-data-grid
      label="Hostile children"
      row-key="id"
      .childRows=${() => {
        throw new Error("boom");
      }}
      .columns=${columns}
      .data=${[parent]}
      .expandedKeys=${[1]}
    ></lr-data-grid>
  `);
  expect(() => element.shadowRoot!.textContent).to.not.throw();
  expect(element.shadowRoot!.textContent).to.contain("Parent");
  const toggles = element.shadowRoot!.querySelectorAll('[part~="row"] [aria-expanded]');
  expect(toggles.length).to.equal(0);
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
  const collapsed = oneEvent(element, "lr-group-collapse");
  groupButton.click();
  const collapseEvent = await collapsed;
  await element.updateComplete;
  expect(
    element.expandedKeys,
    "a second click collapses an already-expanded group"
  ).to.deep.equal([]);
  expect(collapseEvent.detail.columnId).to.equal("team");
  expect(collapseEvent.detail.rows).to.have.lengthOf(2);
  expect(Object.isFrozen(collapseEvent.detail)).to.equal(true);
});

it("keeps computed object-valued group keys stable across render projections", async () => {
  interface ComputedGroupRow {
    id: number;
    name: string;
    team: string;
  }
  const computedRows: ComputedGroupRow[] = [
    { id: 1, name: "Ada", team: "Compiler" },
    { id: 2, name: "Lin", team: "Runtime" },
  ];
  const computedColumns: DataGridColumn<ComputedGroupRow>[] = [
    {
      id: "computed-team",
      label: "Team",
      value: (row) => ({ team: row.team }),
    },
    { field: "name", label: "Name" },
  ];
  const element = (await fixture(html`
    <lr-data-grid
      label="Computed groups"
      group-by="computed-team"
      row-key="id"
      .columns=${computedColumns}
      .data=${computedRows}
    ></lr-data-grid>
  `)) as LyraDataGrid<ComputedGroupRow>;
  await element.updateComplete;

  element.shadowRoot!.querySelector<HTMLButtonElement>(
    '[part="group-row"] [part="expand-button"]'
  )!.click();
  await element.updateComplete;

  const groupRows = [
    ...element.shadowRoot!.querySelectorAll<HTMLElement>(
      '[part~="group-row"]'
    ),
  ];
  expect(groupRows.map((row) => row.getAttribute("aria-expanded"))).to.deep.equal([
    "true",
    "false",
  ]);
  expect(
    element.shadowRoot!.querySelectorAll('[part~="row"]:not([part~="group-row"])')
  ).to.have.length(1);
});

it("preserves one distinct expanded object group across equivalent data replacement", async () => {
  interface ObjectGroupRow {
    id: number;
    name: string;
    bucket: { label: string };
  }
  const objectColumns: DataGridColumn<ObjectGroupRow>[] = [
    { field: "bucket", label: "Bucket" },
    { field: "name", label: "Name" },
  ];
  const source: ObjectGroupRow[] = [
    { id: 1, name: "First", bucket: { label: "same" } },
    { id: 2, name: "Second", bucket: { label: "same" } },
  ];
  const element = (await fixture(html`
    <lr-data-grid
      label="Object groups"
      group-by="bucket"
      row-key="id"
      .columns=${objectColumns}
      .data=${source}
    ></lr-data-grid>
  `)) as LyraDataGrid<ObjectGroupRow>;
  await element.updateComplete;
  expect(
    element.shadowRoot!.querySelectorAll('[part~="group-row"]')
  ).to.have.length(2);

  element.shadowRoot!.querySelector<HTMLButtonElement>(
    '[part="group-row"] [part="expand-button"]'
  )!.click();
  await element.updateComplete;
  const replacement = source.map((row) => ({
    ...row,
    bucket: { label: row.bucket.label },
  }));
  element.data = replacement;
  await element.updateComplete;

  const renderedGroups = (): HTMLElement[] => [
    ...element.shadowRoot!.querySelectorAll<HTMLElement>('[part~="group-row"]'),
  ];
  let groupRows = renderedGroups();
  expect(groupRows).to.have.length(2);
  expect(groupRows.map((row) => row.getAttribute("aria-expanded"))).to.deep.equal([
    "true",
    "false",
  ]);
  expect(
    element.shadowRoot!.querySelectorAll('[part~="row"]:not([part~="group-row"])')
  ).to.have.length(1);

  replacement[0]!.bucket.label = "changed";
  element.data = [...replacement];
  await element.updateComplete;
  groupRows = renderedGroups();
  expect(groupRows.map((row) => row.getAttribute("aria-expanded"))).to.deep.equal([
    "true",
    "false",
  ]);
});

it("renders an honest native column-control group with distinct localized actions", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      with-column-menu
      pinnable
      .strings=${{
        dataGridColumnMenu: "Actions for {label}",
        dataGridPinStart: "Start-pin {label}",
        dataGridPinEnd: "End-pin {label}",
        dataGridUnpin: "Remove pin from {label}",
      }}
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const trigger = header(element, "name").querySelector<HTMLButtonElement>(
    '[part="column-menu-button"]'
  )!;
  expect(trigger.getAttribute("aria-label")).to.equal("Actions for Name");
  trigger.click();
  await element.updateComplete;

  const group = header(element, "name").querySelector<HTMLElement>(
    '[part="column-menu"] [role="group"]'
  )!;
  expect(trigger.getAttribute("aria-controls")).to.equal(group.id);
  expect(group.querySelectorAll('[role="menuitem"]').length).to.equal(0);
  expect(group.querySelectorAll('[role="menuitemcheckbox"]').length).to.equal(0);
  expect(
    [...group.querySelectorAll<HTMLButtonElement>("button")].map((button) =>
      button.textContent?.trim()
    )
  ).to.deep.equal([
    "Start-pin Name",
    "End-pin Name",
    "Remove pin from Name",
  ]);
  expect(group.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').length).to.equal(1);
  await expect(element).to.be.accessible();

  const action = group.querySelector<HTMLButtonElement>("button")!;
  action.focus();
  await sendKeys({ press: "Escape" });
  await element.updateComplete;
  expect(header(element, "name").querySelector('[role="group"]') === null).to.be.true;
  expect(element.shadowRoot!.activeElement === trigger).to.be.true;
});

it("bounds deep and cyclic public tree models without rejecting the update", async () => {
  interface DeepRow {
    id: number;
    children?: DeepRow[];
  }
  let root: DeepRow = { id: 5_999 };
  for (let id = 5_998; id >= 0; id -= 1) root = { id, children: [root] };
  const element = await dataGrid<DeepRow>(html`
    <lr-data-grid
      label="Deep tree"
      row-key="id"
      child-rows="children"
      .expandedKeys=${Array.from({ length: 6_000 }, (_value, id) => id)}
      .columns=${[{ field: "id", label: "ID" }]}
      .data=${[root]}
    ></lr-data-grid>
  `);
  expect(element.shadowRoot!.querySelectorAll('[part~="row"]').length).to.be.at.most(65);
  expect(element.shadowRoot!.querySelector('[part="tree-limit"]')).to.exist;
  expect(
    element.shadowRoot!.querySelector('[part="table"]')!.getAttribute(
      "data-tree-truncated"
    )
  ).to.equal("true");

  const cyclic: DeepRow = { id: 1 };
  cyclic.children = [cyclic];
  element.data = [cyclic];
  element.expandedKeys = [1];
  await element.updateComplete;
  expect(element.shadowRoot!.querySelectorAll('[part~="row"]').length).to.equal(1);
});

it("keeps ineligible descendants out of parent selection cascades", async () => {
  const tree: Person[] = [{
    id: 1,
    name: "Parent",
    team: "Compiler",
    score: 10,
    children: [{ id: 2, name: "Blocked child", team: "Compiler", score: 0 }],
  }];
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      row-key="id"
      child-rows="children"
      selectable="multiple"
      .selectableRows=${(row: Person) => row.score > 0}
      .columns=${columns}
      .data=${tree}
    ></lr-data-grid>
  `);
  const selected = oneEvent(element, "lr-row-select");
  element.shadowRoot!.querySelector<HTMLInputElement>(
    '[part~="row"] input[type="checkbox"]'
  )!.click();
  const event = await selected;
  expect(event.detail.selectedKeys).to.deep.equal([1]);
  expect(element.selectedKeys).to.deep.equal([1]);
  expect(Object.isFrozen(event.detail)).to.equal(true);
  expect(Object.isFrozen(event.detail.selectedKeys)).to.equal(true);
});

it("emits a frozen group expansion snapshot", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      group-by="team"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const expanded = oneEvent(element, "lr-group-expand");
  element.shadowRoot!.querySelector<HTMLButtonElement>(
    '[part="group-row"] [part="expand-button"]'
  )!.click();
  const event = await expanded;
  expect(event.detail.columnId).to.equal("team");
  expect(event.detail.rows.length).to.be.greaterThan(0);
  expect(event.detail.rows.every((row: Person) => rows.includes(row))).to.equal(true);
  expect(Object.isFrozen(event.detail)).to.equal(true);
  expect(Object.isFrozen(event.detail.rows)).to.equal(true);
});

it("accounts for expanded detail rows in aria-rowindex and aria-rowcount", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      row-key="id"
      .rowDetail=${(row: Person) => `Details for ${row.name}`}
      .expandedKeys=${[1]}
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const indexes = [
    ...element.shadowRoot!.querySelectorAll<HTMLElement>(
      '[role="row"][aria-rowindex]'
    ),
  ].map((row) => Number(row.getAttribute("aria-rowindex")));
  expect(indexes).to.deep.equal([2, 3, 4, 5]);
  expect(
    element.shadowRoot!.querySelector('[part="table"]')!.getAttribute(
      "aria-rowcount"
    )
  ).to.equal("5");
});
