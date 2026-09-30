import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';
import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './data-grid.js';
import type { LyraDataGrid } from './data-grid.js';
import type { DataGridColumn } from './data-grid-types.js';
import { registerLyraLocale } from '../../../internal/localization.js';
import { type Person, columns, rows, dataGrid, access, header, dataCells } from '../../../../test/data-grid.js';


expectLocaleFallback('de-DE', ['resizeColumn']);

it('canonicalizes row and column identities while retaining mirrored state aliases', async () => {
  type IdentityRow = { readonly id: string; readonly name: string };
  const first = { id: 'a', name: 'First' };
  const duplicate = { id: 'a', name: 'Later duplicate' };
  const tail = { id: 'b', name: 'Tail' };
  const actionColumn: DataGridColumn<IdentityRow> = {
    label: 'Action',
    formatter: (_value, row) => row.name,
  };
  const element = (await fixture(
    html`<lr-data-grid label="Identity rows" selectable="multiple"></lr-data-grid>`
  )) as LyraDataGrid<IdentityRow>;
  element.rowKey = 'id';
  element.columns = [
    null,
    { id: '   ', label: 'Blank' },
    { id: 'name', field: 'name', label: 'Name' },
    { id: 'name', field: 'name', label: 'Later duplicate' },
    actionColumn,
  ] as unknown as readonly DataGridColumn<IdentityRow>[];
  element.data = [
    null,
    { id: '   ', name: 'Blank' },
    first,
    duplicate,
    tail,
  ] as unknown as readonly IdentityRow[];
  element.selectedRowKeys = ['   ', 'a', 'a'];
  element.expandedRowKeys = ['   ', 'a', 'a'];
  await element.updateComplete;

  const columnIds = [
    ...element.shadowRoot!.querySelectorAll<HTMLElement>(
      '[part~="header-cell"][data-column-id]'
    ),
  ].map((cell) => cell.dataset['columnId']);
  expect(columnIds.length).to.equal(2);
  expect(columnIds[0]).to.equal('name');
  expect(columnIds[1]?.startsWith('column-occurrence-')).to.equal(true);
  expect(element.shadowRoot!.textContent).to.contain('First');
  expect(element.shadowRoot!.textContent).to.contain('Tail');
  expect(element.shadowRoot!.textContent).not.to.contain('Later duplicate');
  expect(element.shadowRoot!.textContent).not.to.contain('Blank');
  expect(element.selectedRowKeys).to.deep.equal(['a']);
  expect(element.selectedKeys).to.deep.equal(['a']);
  expect(element.expandedRowKeys).to.deep.equal(['a']);
  expect(element.expandedKeys).to.deep.equal(['a']);

  const eventPromise = oneEvent(element, 'lr-row-select');
  (
    element.shadowRoot!.querySelector('[part~="row"] input') as HTMLInputElement
  ).click();
  const detail = (await eventPromise).detail;
  expect(detail.selectedRowKeys).to.deep.equal([]);
  expect(detail.selectedKeys).to.deep.equal([]);

  const actionIdentity = columnIds[1];
  element.columns = [actionColumn, { id: 'name', field: 'name', label: 'Name' }];
  element.data = [tail, first];
  await element.updateComplete;
  const reorderedIds = [
    ...element.shadowRoot!.querySelectorAll<HTMLElement>(
      '[part~="header-cell"][data-column-id]'
    ),
  ].map((cell) => cell.dataset['columnId']);
  expect(reorderedIds[0]).to.equal(actionIdentity);
});

it('skips a column definition whose id accessor throws, keeping valid neighbors', async () => {
  const poisoned = {
    get id(): string {
      throw new Error('boom');
    },
    label: 'Poisoned',
  };
  const element = await dataGrid();
  element.columns = [
    { field: 'name', label: 'Name' },
    poisoned as unknown as DataGridColumn<Person>,
    { field: 'team', label: 'Team' },
  ];
  await element.updateComplete;
  const columnIds = [
    ...element.shadowRoot!.querySelectorAll<HTMLElement>(
      '[part~="header-cell"][data-column-id]'
    ),
  ].map((cell) => cell.dataset['columnId']);
  expect(columnIds).to.deep.equal(['name', 'team']);
});

it('treats a blank column label as absent and falls back to the humanized field name', async () => {
  const element = await dataGrid();
  element.columns = [
    { field: 'name', label: 'Name' },
    { field: 'team', label: '' },
  ];
  await element.updateComplete;
  const cell = header(element, 'team');
  expect(cell.textContent?.trim()).to.equal('Team');
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

/**
 * Regression: unlike lr-table's lr-sort-request/lr-sort veto-then-commit contract, data-grid's
 * lr-sort-change fired only after the fact with no cancelable predecessor, so a consumer had no
 * way to intercept/reject a user-initiated sort.
 */
it("lets a listener veto a proposed sort via the cancelable lr-sort-request event", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  let changeEvents = 0;
  element.addEventListener("lr-sort-change", () => changeEvents++);
  const requestPromise = oneEvent(element, "lr-sort-request");
  element.addEventListener(
    "lr-sort-request",
    (event) => event.preventDefault(),
    { once: true }
  );
  (
    element.shadowRoot!.querySelector('[part~="header-cell"]') as HTMLElement
  ).click();
  const requestEvent = await requestPromise;

  expect(requestEvent.cancelable).to.equal(true);
  expect(requestEvent.detail.sort).to.deep.equal([{ id: "name", desc: false }]);
  expect(element.sort).to.deep.equal([]);
  expect(changeEvents).to.equal(0);
  expect(element.getProcessedRows().map((row) => row.name)).to.deep.equal(
    rows.map((row) => row.name)
  );
});

it('renders aria-sort="none" (not omitted) on an unsorted sortable header, then tracks ascending/descending, and omits it entirely on a non-sortable column', async () => {
  const mixedColumns: DataGridColumn<Person>[] = [
    { field: "name", label: "Name" },
    { field: "team", label: "Team", sortable: false },
  ];
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      .columns=${mixedColumns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const headerCells = element.shadowRoot!.querySelectorAll('[part~="header-cell"]');
  const nameHeader = headerCells[0] as HTMLElement;
  const teamHeader = headerCells[1] as HTMLElement;

  expect(nameHeader.getAttribute("aria-sort")).to.equal("none");
  expect(teamHeader.hasAttribute("aria-sort"), "a non-sortable column carries no aria-sort at all").to.be.false;

  let sorted = oneEvent(element, "lr-sort-change");
  nameHeader.click();
  await sorted;
  await element.updateComplete;
  expect(nameHeader.getAttribute("aria-sort")).to.equal("ascending");

  sorted = oneEvent(element, "lr-sort-change");
  nameHeader.click();
  await sorted;
  await element.updateComplete;
  expect(nameHeader.getAttribute("aria-sort")).to.equal("descending");
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
  expect(header(element, "name").dataset['pin']).to.equal("left");
  expect(element.shadowRoot!.querySelector('[data-column-id="team"]') === null).to.be.true;

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
      '[data-column-action="pin-start"]'
    ) as HTMLButtonElement
  ).click();
  expect((await pinEvent).detail).to.deep.equal({
    columnId: "name",
    side: "left",
  });

  const columnsMenu = element.shadowRoot!.querySelector(
    '[part="columns-menu"]'
  )!;
  (columnsMenu.querySelector("lr-button") as HTMLElement).click();
  await element.updateComplete;
  const visibilityRow = [
    ...columnsMenu.querySelectorAll("lr-dropdown-item"),
  ][1]! as unknown as { select: () => void };
  const visibilityEvent = oneEvent(element, "lr-column-visibility-change");
  visibilityRow.select();
  expect((await visibilityEvent).detail).to.deep.equal({
    columnId: "team",
    visible: false,
  });

  element.resetColumns();
  await element.updateComplete;
  expect(element.getColumnPin("name")).to.equal(false);
  expect(element.shadowRoot!.querySelector('[data-column-id="team"]')).to.exist;
});

it("gives the resize-handle the shared minimum hit area", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      resizable
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const handle = header(element, "name").querySelector(
    '[part="resize-handle"]'
  ) as HTMLElement;
  expect(getComputedStyle(handle).minInlineSize).to.equal("36px");
  expect(getComputedStyle(handle).minBlockSize).to.equal("36px");
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
    ].filter((candidate) => candidate.dataset['columnId'] === columnId);
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
    ].find((candidate) => candidate.dataset['columnId'] === columnId);
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

it("falls back to declaration order when columnOrder is assigned a non-array value", async () => {
  const element = await dataGrid(html`
    <lr-data-grid label="People" .columns=${columns} .data=${rows}></lr-data-grid>
  `);
  element.columnOrder = "not-an-array" as unknown as readonly string[];
  await element.updateComplete;
  expect(element.getState().order).to.deep.equal([]);
});

it("falls back to null for a filter value that cannot be serialized (circular reference)", async () => {
  const circular: Record<string, unknown> = { name: "self" };
  circular["self"] = circular;
  const element = await dataGrid(html`
    <lr-data-grid label="People" .columns=${columns} .data=${rows}></lr-data-grid>
  `);
  element.filters = [{ id: "team", value: circular }];
  await element.updateComplete;
  expect(element.getState().filters).to.deep.equal([{ id: "team", value: null }]);
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
  expect((element.shadowRoot!.querySelector('[part="drag-ghost"]')) == null).to.be.true;
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
  expect((element.shadowRoot!.querySelector('[part="drag-ghost"]')) == null).to.be.true;
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
  expect((element.shadowRoot!.querySelector('[part="drag-ghost"]')) == null).to.be.true;
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
  expect((element.shadowRoot!.querySelector('[part="drag-ghost"]')) == null).to.be.true;
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
      '[data-column-action]'
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
    '[data-column-visibility] input'
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
    (element.shadowRoot!.querySelector(
      '[part~="header-cell"][data-column-id="name"]'
    )) == null
  ).to.be.true;
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
  expect((header(element, "name").querySelector('[data-column-visibility]')) == null).to.be.true;
  expect(header(element, "name").querySelector('[data-column-action]') === null).to.be.true;
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
  // (id, width, emit, finished?) -- the two-argument call this replaces left `emit` undefined,
  // i.e. exactly the `emit: false` the other call sites in this file spell out.
  access(element).setColumnWidth("score", 320, false);
  await element.updateComplete;
  expect(element.getColumnPin("score")).to.equal("left");

  element.columns = [{ field: "name", label: "Name" }];
  await element.updateComplete;
  expect(element.columnOrder).to.deep.equal(["name"]);
  expect(element.getColumnPin("score")).to.equal(false);
  expect(element.getState().widths).to.deep.equal({});
  expect(element.getState().visibility).to.deep.equal({});
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

it("leaves sizeColumnsToFit inert before first render, with no columns, and with no flexible columns", async () => {
  const unrendered = document.createElement(
    "lr-data-grid"
  ) as unknown as LyraDataGrid<Person>;
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

it("ignores a resize width write for a column id that no longer exists", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      resizable
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  access(element).setColumnWidth("does-not-exist", 250, false);
  expect(element.getState().widths).to.deep.equal({});
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
  access(element).setColumnWidth("name", 200, false);
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
  expect(access(element).pinOffset("does-not-exist", "left")).to.equal(0);
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
  ].map((cellEl) => (cellEl as HTMLElement).dataset['columnId']);
  expect(
    naturalOrder,
    "columns absent from a partial columnOrder keep their natural relative order"
  ).to.deep.equal(["score", "name", "team"]);

  element.pinColumn("name", "left");
  element.pinColumn("score", "right");
  await element.updateComplete;
  const pinnedOrder = [
    ...element.shadowRoot!.querySelectorAll('[part~="header-cell"]'),
  ].map((cellEl) => (cellEl as HTMLElement).dataset['columnId']);
  expect(pinnedOrder).to.deep.equal(["name", "team", "score"]);
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
  expect(resizes, "a focused separator resizes with an unmodified arrow key").to.equal(1);

  const startEvent = {
    clientX: 0,
    pointerId: 1,
    currentTarget: { setPointerCapture() {} },
  } as unknown as PointerEvent;
  internals.onResizeStart(startEvent, "does-not-exist");
  expect(
    resizes,
    "starting a resize on an unknown column id does nothing"
  ).to.equal(1);
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
  expect(element.getState().widths?.["name"]).to.be.undefined;
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
  ].map((cellEl) => (cellEl as HTMLElement).dataset['columnId']);
  expect(order).to.deep.equal(["name", "score"]);
});

it("ignores autoSizeColumn once its column id has fallen out of the live column definitions", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const staleId = header(element, "name").dataset['columnId']!;
  element.columns = [{ field: "team", label: "Team" }];
  expect(() => element.autoSizeColumn(staleId)).to.not.throw();
  expect(element.getState().widths).to.deep.equal({});
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

it('preserves widths when every column resolves to fixed zero flex', async () => {
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
    'effective zero-flex columns retain the all-fixed no-op contract'
  ).to.deep.equal({});
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

it("round-trips 'start'/'end' pinning through setState/getState", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="Pin state"
      pinnable
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  element.setState({ pinning: { name: "start", score: "end" } });
  await element.updateComplete;
  expect(element.getColumnPin("name")).to.equal("start");
  expect(element.getColumnPin("score")).to.equal("end");
  expect(element.getState().pinning).to.deep.equal({
    name: "start",
    score: "end",
  });
});

it("uses a 0px grid-template minimum for an unsized column that only declares a maxWidth", async () => {
  const boundedColumns: DataGridColumn<Person>[] = [
    { field: "name", label: "Name", maxWidth: 100 },
  ];
  const element = await dataGrid(html`
    <lr-data-grid label="People" .columns=${boundedColumns} .data=${rows}></lr-data-grid>
  `);
  expect(
    element.shadowRoot!.querySelector<HTMLElement>('[part="header"]')!.style
      .getPropertyValue("--data-grid-columns")
  ).to.contain("minmax(0px, 100px)");
});

it("cancels an active resize on the very next pointermove once its column can no longer resize, without waiting for pointerup", async () => {
  const element = await dataGrid(html`
    <lr-data-grid label="People" resizable .columns=${columns} .data=${rows}></lr-data-grid>
  `);
  const handle = element.shadowRoot!.querySelector<HTMLElement>(
    '[part="resize-handle"]'
  )!;
  const details: Array<{ width: number; finished: boolean }> = [];
  element.addEventListener("lr-column-resize", (event) => {
    details.push((event as CustomEvent).detail);
  });
  handle.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 900, clientX: 10, bubbles: true }));
  handle.dispatchEvent(new PointerEvent("pointermove", { pointerId: 900, clientX: 40, bubbles: true }));
  expect(details.length).to.be.greaterThan(0);
  const movesBeforeRevoke = details.length;

  element.resizable = false;
  // No await here -- the resize session's own columnCanResize() re-check on the very next
  // pointermove must retire it immediately, before Lit's willUpdate ever runs. Retiring an
  // already-moved session emits one more rollback event (always finished: false, like every
  // resize rollback) and reverts the width.
  handle.dispatchEvent(new PointerEvent("pointermove", { pointerId: 900, clientX: 70, bubbles: true }));
  expect(details.length).to.equal(movesBeforeRevoke + 1);
  expect(details.at(-1)?.finished).to.equal(false);
  expect(element.getState().widths).to.deep.equal({});

  // A further pointermove after the session has been retired must be a true no-op.
  const countAfterRevoke = details.length;
  handle.dispatchEvent(new PointerEvent("pointermove", { pointerId: 900, clientX: 100, bubbles: true }));
  expect(details.length).to.equal(countAfterRevoke);

  handle.dispatchEvent(new PointerEvent("pointerup", { pointerId: 900, clientX: 100, bubbles: true }));
  await element.updateComplete;
  expect(details.length).to.equal(countAfterRevoke);
});

it("requires an owned drag token and revalidates movement policy at drop", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      reorderable
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  let moves = 0;
  element.addEventListener("lr-column-move", () => { moves += 1; });
  const external = new DataTransfer();
  external.setData("text/plain", "name");
  header(element, "score").dispatchEvent(
    new DragEvent("drop", {
      bubbles: true,
      cancelable: true,
      dataTransfer: external,
    })
  );
  expect(moves).to.equal(0);
  expect(element.columnOrder).to.deep.equal([]);

  const owned = new DataTransfer();
  header(element, "name").dispatchEvent(
    new DragEvent("dragstart", {
      bubbles: true,
      cancelable: true,
      dataTransfer: owned,
    })
  );
  element.reorderable = false;
  header(element, "score").dispatchEvent(
    new DragEvent("drop", {
      bubbles: true,
      cancelable: true,
      dataTransfer: owned,
    })
  );
  await element.updateComplete;
  expect(moves).to.equal(0);
  expect(element.columnOrder).to.deep.equal([]);
  expect(element.shadowRoot!.querySelector('[part="drag-ghost"]') === null).to.be.true;
});

it("rolls back an active resize when its governing capability is revoked", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      resizable
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const handle = element.shadowRoot!.querySelector<HTMLElement>(
    '[part="resize-handle"]'
  )!;
  const details: Array<{ width: number; finished: boolean }> = [];
  element.addEventListener("lr-column-resize", (event) => {
    details.push(event.detail);
  });
  handle.dispatchEvent(new PointerEvent("pointerdown", {
    pointerId: 811,
    clientX: 10,
    bubbles: true,
  }));
  handle.dispatchEvent(new PointerEvent("pointermove", {
    pointerId: 811,
    clientX: 40,
    bubbles: true,
  }));
  element.resizable = false;
  handle.dispatchEvent(new PointerEvent("pointerup", {
    pointerId: 811,
    clientX: 40,
    bubbles: true,
  }));
  await element.updateComplete;
  expect(details.some((detail) => detail.finished)).to.equal(false);
  expect(details.at(-1)?.finished).to.equal(false);
  expect(element.getState().widths).to.deep.equal({});
});

it("rolls back an active resize when the resized column itself is removed from a reassigned columns collection", async () => {
  const element = await dataGrid(html`
    <lr-data-grid label="People" resizable .columns=${columns} .data=${rows}></lr-data-grid>
  `);
  const handle = element.shadowRoot!.querySelector<HTMLElement>(
    '[part="resize-handle"]'
  )!;
  const details: Array<{ width: number; finished: boolean }> = [];
  element.addEventListener("lr-column-resize", (event) => {
    details.push((event as CustomEvent).detail);
  });
  handle.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 812, clientX: 10, bubbles: true }));
  handle.dispatchEvent(new PointerEvent("pointermove", { pointerId: 812, clientX: 40, bubbles: true }));
  expect(details.some((detail) => detail.finished)).to.equal(false);
  const movesBeforeRemoval = details.length;

  // Reassigning columns (not resizable/reorderable) while a resize is mid-gesture must be caught by
  // willUpdate's own cleanup, since the gesture never gets a pointerup to trigger the direct path.
  // The rollback emits one more event (always finished: false, like every resize rollback).
  element.columns = columns.filter((column) => column.field !== "name");
  await element.updateComplete;
  expect(details.length).to.equal(movesBeforeRemoval + 1);
  expect(details.at(-1)?.finished).to.equal(false);
  expect(element.getState().widths).to.deep.equal({});

  handle.dispatchEvent(new PointerEvent("pointerup", { pointerId: 812, clientX: 70, bubbles: true }));
  await element.updateComplete;
  expect(element.getState().widths).to.deep.equal({});
});

it("retires an active column drag when the dragged column itself is removed from a reassigned columns collection", async () => {
  const element = await dataGrid(html`
    <lr-data-grid label="People" reorderable .columns=${columns} .data=${rows}></lr-data-grid>
  `);
  const nameHeader = element.shadowRoot!.querySelector<HTMLElement>(
    '[data-column-id="name"]'
  )!;
  const dataTransfer = new DataTransfer();
  nameHeader.dispatchEvent(
    new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer })
  );
  await element.updateComplete;
  expect(element.shadowRoot!.querySelector('[part="drag-ghost"]') === null).to.equal(false);

  element.columns = columns.filter((column) => column.field !== "name");
  await element.updateComplete;
  expect(element.shadowRoot!.querySelector('[part="drag-ghost"]') === null).to.equal(true);

  const teamHeader = element.shadowRoot!.querySelector<HTMLElement>(
    '[data-column-id="team"]'
  )!;
  const over = new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer });
  teamHeader.dispatchEvent(over);
  expect(over.defaultPrevented, "the drag session was cleared, so nothing allows this drop").to.equal(false);
});

it('contains hostile proxy descriptors while preserving valid column neighbors', async () => {
  const source: DataGridColumn<Person>[] = [
    { id: 'first', field: 'name' },
    { id: 'hostile', field: 'score' },
    { id: 'later', field: 'team' },
  ];
  const hostile = new Proxy(source, {
    getOwnPropertyDescriptor(target, property) {
      if (property === '1') throw new Error('hostile column descriptor');
      return Reflect.getOwnPropertyDescriptor(target, property);
    },
  });
  const element = await dataGrid<Person>();

  expect(() => {
    element.columns = hostile;
  }).not.to.throw();
  await element.updateComplete;
  expect(element.columns.map((column) => column.id)).to.deep.equal([
    'first',
    'later',
  ]);
});

it('localizes resize pixel values through .strings and the effective locale', async () => {
  const locale = 'de-DE';
  registerLyraLocale(locale, { resizeValuePixels: 'Breite {value} Punkte' });
  const resizeColumns: DataGridColumn<Person>[] = [
    { field: 'name', label: 'Name', width: 1234 },
  ];
  const element = await dataGrid(html`
    <lr-data-grid
      label="Localized resize"
      resizable
      .strings=${{ resizeValuePixels: 'Custom width: {value}' }}
      .columns=${resizeColumns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const handle = element.shadowRoot!.querySelector<HTMLElement>(
    '[part="resize-handle"]'
  )!;

  expect(handle.getAttribute('aria-valuetext')).to.equal('Custom width: 1,234');

  element.strings = {};
  element.setAttribute('lang', locale);
  await element.updateComplete;
  expect(handle.getAttribute('aria-valuetext')).to.equal(
    `Breite ${new Intl.NumberFormat(locale).format(1234)} Punkte`
  );
});

describe("all-columns visibility menu (lr-dropdown + checkbox items)", () => {
  const menuGrid = (): Promise<LyraDataGrid<Person>> =>
    dataGrid(html`
      <lr-data-grid
        label="People"
        with-columns-menu
        .columns=${[
          ...columns,
          { field: "id", label: "Id", hideable: false },
        ] as DataGridColumn<Person>[]}
        .data=${rows}
      ></lr-data-grid>
    `);

  const menu = (
    element: LyraDataGrid<Person>,
  ): HTMLElement & { open: boolean; updateComplete: Promise<boolean> } =>
    element.shadowRoot!.querySelector('[part="columns-menu"]') as HTMLElement & {
      open: boolean;
      updateComplete: Promise<boolean>;
    };

  const trigger = (element: LyraDataGrid<Person>): HTMLElement =>
    menu(element).querySelector("lr-button") as HTMLElement;

  const menuItems = (
    element: LyraDataGrid<Person>
  ): (HTMLElement & { value: string; checked: boolean; select: () => void })[] =>
    [...menu(element).querySelectorAll("lr-dropdown-item")] as unknown as (HTMLElement & {
      value: string;
      checked: boolean;
      select: () => void;
    })[];

  it("composes lr-dropdown with one menuitemcheckbox row per column", async () => {
    const element = await menuGrid();
    expect(menu(element).localName).to.equal("lr-dropdown");
    const items = menuItems(element);
    expect(items.map((item) => item.value)).to.deep.equal([
      "name",
      "team",
      "score",
      "id",
    ]);
    expect(items.map((item) => item.getAttribute("role"))).to.deep.equal([
      "menuitemcheckbox",
      "menuitemcheckbox",
      "menuitemcheckbox",
      "menuitemcheckbox",
    ]);
    expect(items.map((item) => item.checked)).to.deep.equal([
      true,
      true,
      true,
      true,
    ]);
    expect(
      items[3]!.hasAttribute("disabled"),
      "a hideable:false column cannot be toggled"
    ).to.equal(true);
  });

  it("toggles a column and emits lr-column-visibility-change from a menu row", async () => {
    const element = await menuGrid();
    const event = oneEvent(element, "lr-column-visibility-change");
    menuItems(element)[1]!.select();
    expect((await event).detail).to.deep.equal({
      columnId: "team",
      visible: false,
    });
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector('[data-column-id="team"]') === null).to.be
      .true;
    expect(menuItems(element).map((item) => item.checked)).to.deep.equal([
      true,
      false,
      true,
      true,
    ]);
  });

  it("stays open across successive toggles, unlike a select-and-close action menu", async () => {
    const element = await menuGrid();
    trigger(element).click();
    await element.updateComplete;
    await menu(element).updateComplete;
    expect(menu(element).open).to.equal(true);

    menuItems(element)[1]!.select();
    await element.updateComplete;
    await menu(element).updateComplete;
    expect(menu(element).open, "the menu survives the first toggle").to.equal(true);

    menuItems(element)[2]!.select();
    await element.updateComplete;
    await menu(element).updateComplete;
    expect(menu(element).open, "and the second").to.equal(true);
    expect(element.shadowRoot!.querySelectorAll('[role="columnheader"]').length).to.be.greaterThan(
      0
    );
  });
});

describe("controlled re-binds of filters and sort", () => {
  async function serverGrid(): Promise<{
    element: LyraDataGrid<Person>;
    requests: () => number;
  }> {
    let requests = 0;
    const element = await dataGrid(html`
      <lr-data-grid
        label="Controlled rebind"
        server
        filter-debounce="60"
        .columns=${columns}
        .data=${rows}
        .dataSource=${async () => {
          requests += 1;
          return { rows, total: rows.length };
        }}
      ></lr-data-grid>
    `);
    await waitUntil(() => requests > 0, "the grid never made its initial request");
    return { element, requests: () => requests };
  }

  it("does not reschedule a server request when filters are re-bound unchanged", async () => {
    const { element, requests } = await serverGrid();
    const initial = requests();

    // The controlled pattern: hand back an equal-but-new array on every render.
    for (let index = 0; index < 5; index += 1) {
      element.filters = [{ id: "name", value: "ada" }];
      await element.updateComplete;
    }
    // The first write is a real change, so exactly one more request may settle.
    await waitUntil(() => requests() === initial + 1, "the real change never requested");
    const afterRealChange = requests();

    for (let index = 0; index < 5; index += 1) {
      element.filters = [{ id: "name", value: "ada" }];
      await element.updateComplete;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(
      requests(),
      "an unchanged re-bind must not restart the request debounce"
    ).to.equal(afterRealChange);
  });

  it("still requests when a filter value actually changes", async () => {
    const { element, requests } = await serverGrid();
    element.filters = [{ id: "name", value: "ada" }];
    await element.updateComplete;
    await waitUntil(() => requests() >= 2, "the first change never requested");
    const before = requests();

    element.filters = [{ id: "name", value: "grace" }];
    await element.updateComplete;
    await waitUntil(
      () => requests() > before,
      "a genuinely different filter value must request again"
    );
  });

  it("does not reschedule when sort is re-bound unchanged, but does when it changes", async () => {
    const { element, requests } = await serverGrid();
    element.sort = [{ id: "name", desc: false }];
    await element.updateComplete;
    await waitUntil(() => requests() >= 2, "the first sort never requested");
    const before = requests();

    for (let index = 0; index < 5; index += 1) {
      element.sort = [{ id: "name", desc: false }];
      await element.updateComplete;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(requests(), "an unchanged sort re-bind must not request").to.equal(before);

    element.sort = [{ id: "name", desc: true }];
    await element.updateComplete;
    await waitUntil(
      () => requests() > before,
      "a real sort change must request again"
    );
  });

  it("keeps the previous frozen reference when an unchanged collection is re-bound", async () => {
    const element = await dataGrid(html`
      <lr-data-grid label="Reference stability" .columns=${columns} .data=${rows}></lr-data-grid>
    `);
    element.filters = [{ id: "name", value: ["ada", "grace"] }];
    await element.updateComplete;
    const firstFilters = element.filters;
    element.filters = [{ id: "name", value: ["ada", "grace"] }];
    await element.updateComplete;
    expect(element.filters, "an equal re-bind keeps the held value").to.equal(firstFilters);

    element.filters = [{ id: "name", value: ["ada"] }];
    await element.updateComplete;
    expect(element.filters, "a different array length is a real change").to.not.equal(firstFilters);
  });
});
