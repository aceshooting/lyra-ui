import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import './data-grid.js';
import type { LyraDataGrid } from './data-grid.js';
import type { DataGridColumn } from './data-grid-types.js';
import { activateNonmodalOverlay } from '../../../internal/nonmodal-overlay-manager.js';
import { type Person, columns, rows, dataGrid, delay, sinkElement, sinkTexts, header, expectInteractionTokens } from '../../../../test/data-grid.js';


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
  const element = wrapper.querySelector("lr-data-grid") as unknown as LyraDataGrid<Person>;
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

it("renders a localized, keyboard-reachable clear button once the toolbar search has a value, and hides it again once empty", async () => {
  const element = await dataGrid(html`
    <lr-data-grid with-search label="People" .columns=${columns} .data=${rows}></lr-data-grid>
  `);
  const search =
    element.shadowRoot!.querySelector<HTMLInputElement>('[part="search"]')!;

  expect(element.shadowRoot!.querySelector('[part="search-clear"]') === null).to.be.true;

  search.value = "ada";
  search.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
  await element.updateComplete;

  const clearButton =
    element.shadowRoot!.querySelector<HTMLButtonElement>('[part="search-clear"]');
  expect(clearButton).to.not.equal(null);
  expect(clearButton!.tagName).to.equal("BUTTON");
  expect(clearButton!.getAttribute("type")).to.equal("button");
  expect(clearButton!.getAttribute("aria-label")).to.equal("Clear");
  expect(clearButton!.tabIndex).to.equal(0);

  clearButton!.click();
  await element.updateComplete;

  expect(search.value).to.equal("");
  expect(element.searchTerm).to.equal("");
  expect(element.shadowRoot!.activeElement === search).to.be.true;
  expect(element.shadowRoot!.querySelector('[part="search-clear"]') === null).to.be.true;
});

it("renders a localized, keyboard-reachable clear button on the per-column filter panel once it has a value", async () => {
  const element = await dataGrid(html`
    <lr-data-grid label="People" .columns=${columns} .data=${rows}></lr-data-grid>
  `);
  const filterButton =
    element.shadowRoot!.querySelector<HTMLButtonElement>('[part~="filter-button"]')!;
  filterButton.click();
  await element.updateComplete;
  const filter = element.shadowRoot!.querySelector<HTMLInputElement>(
    '[part="filter-panel"] input[type="search"]'
  )!;

  expect(
    element.shadowRoot!.querySelector('[part="filter-panel"] [part~="filter-panel-clear"]') ===
      null
  ).to.be.true;

  filter.value = "compiler";
  filter.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
  await element.updateComplete;

  const clearButton = element.shadowRoot!.querySelector<HTMLButtonElement>(
    '[part="filter-panel"] [part~="filter-panel-clear"]'
  );
  expect(clearButton).to.not.equal(null);
  expect(clearButton!.tagName).to.equal("BUTTON");
  expect(clearButton!.getAttribute("type")).to.equal("button");
  expect(clearButton!.getAttribute("aria-label")).to.equal("Clear");

  const eventPromise = oneEvent(element, "lr-filter-change");
  clearButton!.click();
  const event = await eventPromise;
  await element.updateComplete;

  expect(event.detail.filters).to.deep.equal([]);
  expect(filter.value).to.equal("");
  expect(element.shadowRoot!.activeElement === filter).to.be.true;
  expect(
    element.shadowRoot!.querySelector('[part="filter-panel"] [part~="filter-panel-clear"]') ===
      null
  ).to.be.true;
});

it("normalizes search and page-size native chrome against the grid palette, replacing the suppressed search-cancel glyph with the component's own clear buttons", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      paginate
      with-search
      label="People"
      style="--lr-color-surface: rgb(1, 2, 3); --lr-color-text: rgb(4, 5, 6)"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const search =
    element.shadowRoot!.querySelector<HTMLInputElement>('[part="search"]')!;
  const pageSize =
    element.shadowRoot!.querySelector<HTMLSelectElement>('[part="page-size"]')!;
  const filterButton =
    element.shadowRoot!.querySelector<HTMLButtonElement>('[part~="filter-button"]')!;

  filterButton.click();
  await element.updateComplete;
  const filter = element.shadowRoot!.querySelector<HTMLInputElement>(
    '[part="filter-panel"] input[type="search"]'
  )!;

  expect(search !== null).to.equal(true);
  expect(filter !== null).to.equal(true);
  expect(pageSize !== null).to.equal(true);
  if (CSS.supports("selector(input::-webkit-search-cancel-button)")) {
    const nativeDecoration = document.createElement("style");
    nativeDecoration.textContent = `
      [part='search']::-webkit-search-cancel-button,
      [part='filter-panel'] input[type='search']::-webkit-search-cancel-button {
        appearance: auto !important;
        -webkit-appearance: searchfield-cancel-button !important;
        display: block !important;
        opacity: 1 !important;
        pointer-events: auto !important;
      }
    `;
    element.shadowRoot!.append(nativeDecoration);

    const assertNativeCancelReset = async (input: HTMLInputElement): Promise<void> => {
      input.focus();
      let cancelPosition: [number, number] | undefined;
      for (let offset = 2; offset <= 48; offset += 2) {
        input.value = "clear me";
        input.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        // Captured fresh each iteration (not once, up front): the sibling `[part='search-clear']`/
        // `[part='filter-panel-clear']` this component now renders once the field is non-empty
        // shrinks the input's own box, so a rect taken before that button ever mounted would place
        // candidates past the input's real right edge -- inside the *new* button's box instead of
        // the native glyph's zone the input itself paints. Re-measuring keeps every candidate
        // inside the input, which is the surface under test here.
        const rect = input.getBoundingClientRect();
        const candidate: [number, number] = [
          Math.round(rect.right - offset),
          Math.round(rect.top + rect.height / 2),
        ];
        await sendMouse({ type: "click", position: candidate });
        if (input.value === "") {
          cancelPosition = candidate;
          break;
        }
      }
      expect(
        cancelPosition !== undefined,
        "positive control exposes the native clear action"
      ).to.equal(true);

      input.value = "keep me";
      input.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      return new Promise<void>((resolve) => {
        nativeDecoration.remove();
        requestAnimationFrame(() => resolve());
      }).then(async () => {
        await sendMouse({ type: "click", position: cancelPosition! });
        expect(input.value, "component styling removes the native clear action").to.equal("keep me");
        element.shadowRoot!.append(nativeDecoration);
      });
    };

    try {
      await assertNativeCancelReset(search);
      await assertNativeCancelReset(filter);
    } finally {
      nativeDecoration.remove();
      await resetMouse();
    }
  }
  expect(getComputedStyle(pageSize).appearance).to.equal("none");
  expect(pageSize.closest('.page-size-wrapper') !== null).to.equal(true);
  expect(pageSize.closest('.page-size-wrapper')!.querySelector('.page-size-chevron svg') !== null).to.equal(true);
  expect(getComputedStyle(pageSize.options[0]!).backgroundColor).to.equal(
    "rgb(1, 2, 3)"
  );
  expect(getComputedStyle(pageSize.options[0]!).color).to.equal("rgb(4, 5, 6)");
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
  const element = wrapper.querySelector("lr-data-grid") as unknown as LyraDataGrid<Person>;
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

/**
 * Unset-regression: extensive positive coverage elsewhere proves these opt-in toggles work when
 * explicitly enabled, but nothing proved the inverse -- that a grid left at its documented
 * defaults renders no column-menu button, no columns-menu toggle, and no search box. A regression
 * making any of them render unconditionally would previously go uncaught.
 */
it("renders no toolbar, search box, columns-menu, or per-column menu button at defaults", async () => {
  const element = await dataGrid(
    html`<lr-data-grid label="People" row-key="id" .columns=${columns} .data=${rows}></lr-data-grid>`
  );
  expect(element.shadowRoot!.querySelector('[part="toolbar"]') === null).to.be.true;
  expect(element.shadowRoot!.querySelector('[part="search"]') === null).to.be.true;
  expect(element.shadowRoot!.querySelector('[part="columns-menu"]') === null).to.be.true;
  expect(element.shadowRoot!.querySelector('[part="column-menu-button"]') === null).to.be.true;
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

it("dismisses the column filter panel with Escape through the shared overlay router", async () => {
  const element = await dataGrid(html`
    <lr-data-grid label="People" .columns=${columns} .data=${rows}></lr-data-grid>
  `);
  const trigger = header(element, "team").querySelector<HTMLButtonElement>(
    '[part="filter-button"]'
  )!;
  trigger.focus();
  trigger.click();
  await element.updateComplete;
  const input = element.shadowRoot!.querySelector<HTMLInputElement>(
    '[part="filter-panel"] input'
  )!;
  input.focus();
  await sendKeys({ press: "Escape" });
  await element.updateComplete;

  expect(element.shadowRoot!.querySelector('[part="filter-panel"]') === null).to.be.true;
  expect(element.shadowRoot!.activeElement === trigger).to.be.true;
});

it("dismisses the all-columns panel with Escape through the shared overlay router", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      with-columns-menu
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  // The panel is now an <lr-dropdown>, which routes Escape and focus return through the shared
  // overlay manager itself -- this grid no longer activates a managed overlay of its own for it.
  const menu = element.shadowRoot!.querySelector('[part="columns-menu"]') as HTMLElement & {
    open: boolean;
    updateComplete: Promise<unknown>;
  };
  const trigger = menu.querySelector("lr-button") as HTMLElement;
  trigger.focus();
  trigger.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      composed: true,
      cancelable: true,
    })
  );
  await element.updateComplete;
  await menu.updateComplete;
  expect(menu.open, "the menu opened from the keyboard contract").to.equal(true);

  await sendKeys({ press: "Escape" });
  await element.updateComplete;
  await menu.updateComplete;
  await waitUntil(() => menu.open === false, "the menu closes on Escape");
  expect(element.shadowRoot!.activeElement === trigger, "focus returns to the trigger").to.be
    .true;
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
  const widthBeforePointer = element.getState().widths?.["name"];

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
  expect(element.getState().widths?.["name"]).to.equal(widthBeforePointer);

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
  const before = element.getState().widths?.["name"];
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
    active.dataset['rowPosition'],
    "a plain Home stays on the same row"
  ).to.equal("1");
  expect(active.dataset['columnPosition']).to.equal("0");

  active.dispatchEvent(
    new KeyboardEvent("keydown", { key: "End", bubbles: true, composed: true })
  );
  await delay(0);
  active = element.shadowRoot!.activeElement as HTMLElement;
  expect(
    active.dataset['rowPosition'],
    "a plain End stays on the same row"
  ).to.equal("1");
  expect(active.dataset['columnPosition']).to.equal("2");
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
  const before = element.getState().widths?.["name"];
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

it("treats pinning's 'start'/'end' spelling as an alias of the RTL-relative 'left'/'right' spelling", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="Pin aliases"
      pinnable
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  element.pinColumn("name", "start");
  element.pinColumn("score", "end");
  await element.updateComplete;

  // getColumnPin() echoes back exactly what was set -- 'start'/'end' round-trip unchanged, just
  // like 'left'/'right' already do.
  expect(element.getColumnPin("name")).to.equal("start");
  expect(element.getColumnPin("score")).to.equal("end");

  // ...but rendering normalizes 'start' onto the same edge as the existing 'left' spelling, and
  // 'end' onto the same edge as 'right' -- both attributes and layout stay driven by the existing
  // 'left'/'right'-keyed CSS.
  const nameHeader = header(element, "name");
  const scoreHeader = header(element, "score");
  expect(nameHeader.dataset['pin']).to.equal("left");
  expect(scoreHeader.dataset['pin']).to.equal("right");
  expect(getComputedStyle(nameHeader).position).to.equal("sticky");
  expect(getComputedStyle(scoreHeader).position).to.equal("sticky");

  // A 'start'-pinned column sorts to the front exactly like a 'left'-pinned one would -- 'score' is
  // declared last but jumps ahead of the unpinned 'team' column once pinned 'start'.
  const ids = [
    ...element.shadowRoot!.querySelectorAll<HTMLElement>('[part~="header-cell"]'),
  ].map((cell) => cell.dataset['columnId']);
  expect(ids[0]).to.equal("name");
  expect(ids.at(-1)).to.equal("score");
});

it('keys a "left"-pinned column to inset-inline-start, which resolves to the physical right edge under dir="rtl" -- "left" is RTL-relative, not physical', async () => {
  const ltr = await dataGrid(html`
    <lr-data-grid
      label="LTR pin"
      pinnable
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  ltr.pinColumn("name", "left");
  await ltr.updateComplete;
  const ltrCell = header(ltr, "name");
  expect(getComputedStyle(ltrCell).left).to.not.equal("auto");
  expect(getComputedStyle(ltrCell).right).to.equal("auto");

  const rtl = await dataGrid(html`
    <lr-data-grid
      dir="rtl"
      label="RTL pin"
      pinnable
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  rtl.pinColumn("name", "left");
  await rtl.updateComplete;
  const rtlCell = header(rtl, "name");
  expect(getComputedStyle(rtlCell).right).to.not.equal("auto");
  expect(getComputedStyle(rtlCell).left).to.equal("auto");

  // 'start' is a spelling alias for the same RTL-relative edge -- identical resolved physical side
  // as 'left' under the same direction.
  rtl.pinColumn("name", "start");
  await rtl.updateComplete;
  expect(getComputedStyle(rtlCell).right).to.not.equal("auto");
  expect(getComputedStyle(rtlCell).left).to.equal("auto");
});

it("mirrors the pager first/previous/next/last icons under dir=\"rtl\" via chevronIcon(), not a static glyph", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="Pager glyphs"
      paginate
      page-size="1"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const firstIcon = element.shadowRoot!.querySelector(
    '[part="first-icon"]'
  ) as HTMLElement;
  const previousIcon = element.shadowRoot!.querySelector(
    '[part="previous-icon"]'
  ) as HTMLElement;
  const nextIcon = element.shadowRoot!.querySelector(
    '[part="next-icon"]'
  ) as HTMLElement;
  const lastIcon = element.shadowRoot!.querySelector(
    '[part="last-icon"]'
  ) as HTMLElement;

  // Every glyph is a real chevronIcon() SVG now, not literal «/‹/›/» text.
  expect(firstIcon.querySelectorAll("svg").length).to.equal(2);
  expect(lastIcon.querySelectorAll("svg").length).to.equal(2);
  expect(previousIcon.querySelectorAll("svg").length).to.equal(1);
  expect(nextIcon.querySelectorAll("svg").length).to.equal(1);
  expect(firstIcon.textContent?.trim()).to.equal("");
  expect(previousIcon.textContent?.trim()).to.equal("");

  // first/previous mirror each other, next/last mirror each other, and the two pairs are rotated
  // opposite of one another in LTR.
  const firstTransform = getComputedStyle(firstIcon).transform;
  const previousTransform = getComputedStyle(previousIcon).transform;
  const nextTransform = getComputedStyle(nextIcon).transform;
  const lastTransform = getComputedStyle(lastIcon).transform;
  expect(firstTransform).to.equal(previousTransform);
  expect(nextTransform).to.equal(lastTransform);
  expect(firstTransform).to.not.equal(nextTransform);

  const rtl = await dataGrid(html`
    <lr-data-grid
      dir="rtl"
      label="Pager glyphs RTL"
      paginate
      page-size="1"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const rtlFirstIcon = rtl.shadowRoot!.querySelector(
    '[part="first-icon"]'
  ) as HTMLElement;
  const rtlNextIcon = rtl.shadowRoot!.querySelector(
    '[part="next-icon"]'
  ) as HTMLElement;

  // Under RTL the two pairs swap rotations relative to their LTR selves.
  expect(getComputedStyle(rtlFirstIcon).transform).to.equal(nextTransform);
  expect(getComputedStyle(rtlNextIcon).transform).to.equal(firstTransform);
});

it("keys the narrow-toolbar layout to the container's max-inline-size, not physical max-width", async () => {
  const narrowWrapper = await fixture<HTMLDivElement>(html`
    <div style="inline-size: 300px">
      <lr-data-grid
        label="Narrow"
        with-search
        .columns=${columns}
        .data=${rows}
      ></lr-data-grid>
    </div>
  `);
  const narrow = narrowWrapper.querySelector(
    "lr-data-grid"
  ) as unknown as LyraDataGrid<Person>;
  await narrow.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const narrowToolbar = narrow.shadowRoot!.querySelector(
    '[part="toolbar"]'
  ) as HTMLElement;
  const narrowSearch = narrow.shadowRoot!.querySelector(
    '[part="search"]'
  ) as HTMLElement;
  expect(getComputedStyle(narrowToolbar).flexDirection).to.equal("column");
  expect(getComputedStyle(narrowSearch).inlineSize).to.not.equal("auto");
  expect(
    getComputedStyle(narrowSearch).flexBasis,
    "the wide-layout inline-size basis must not become a 12rem block-size in column flow"
  ).to.equal("auto");

  const wideWrapper = await fixture<HTMLDivElement>(html`
    <div style="inline-size: 600px">
      <lr-data-grid
        label="Wide"
        with-search
        .columns=${columns}
        .data=${rows}
      ></lr-data-grid>
    </div>
  `);
  const wide = wideWrapper.querySelector("lr-data-grid") as unknown as LyraDataGrid<Person>;
  await wide.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const wideToolbar = wide.shadowRoot!.querySelector(
    '[part="toolbar"]'
  ) as HTMLElement;
  expect(getComputedStyle(wideToolbar).flexDirection).to.not.equal("column");
});

it("defers Escape to a genuinely topmost overlay instead of always closing the per-column menu", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      with-column-menu
      pinnable
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const trigger = header(element, "name").querySelector<HTMLButtonElement>(
    '[part="column-menu-button"]'
  )!;
  trigger.click();
  await element.updateComplete;

  const group = header(element, "name").querySelector<HTMLElement>(
    '[part="column-menu"] [role="group"]'
  )!;
  const action = group.querySelector<HTMLButtonElement>("button")!;
  action.focus();

  // A second nonmodal overlay opens on top of the still-open column menu without stealing
  // keyboard focus away from it -- the shared stack, not DOM focus location, decides who owns
  // Escape.
  const outerPanel = document.createElement("div");
  outerPanel.tabIndex = -1;
  document.body.append(outerPanel);
  const dismissed: string[] = [];
  const outerHandle = activateNonmodalOverlay({
    host: outerPanel,
    panel: () => outerPanel,
    onEscape: () => dismissed.push("outer"),
  });

  try {
    await sendKeys({ press: "Escape" });
    await element.updateComplete;

    expect(dismissed, "the truly topmost overlay's Escape handler runs").to.deep.equal([
      "outer",
    ]);
    expect(
      header(element, "name").querySelector('[role="group"]') === null,
      "the non-topmost per-column menu stays open"
    ).to.be.false;
  } finally {
    outerHandle.deactivate({ restoreFocus: false });
    outerPanel.remove();
  }
});

it("exposes a complete keyboard-adjustable separator and normalizes inverted width bounds", async () => {
  const boundedColumns: DataGridColumn<Person>[] = [
    { field: "name", label: "Name", minWidth: 200, maxWidth: 100 },
  ];
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      resizable
      .columns=${boundedColumns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const handle = element.shadowRoot!.querySelector<HTMLElement>(
    '[part="resize-handle"]'
  )!;
  expect(handle.tabIndex).to.equal(0);
  expect(handle.getAttribute("aria-valuemin")).to.equal("200");
  expect(handle.getAttribute("aria-valuemax")).to.equal("200");
  expect(handle.getAttribute("aria-valuenow")).to.equal("200");
  expect(
    element.shadowRoot!.querySelector<HTMLElement>('[part="header"]')!.style
      .getPropertyValue("--data-grid-columns")
  ).to.contain("minmax(200px, 200px)");

  const resized = oneEvent(element, "lr-column-resize");
  handle.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    })
  );
  const event = await resized;
  expect(event.detail).to.deep.equal({
    columnId: "name",
    width: 200,
    finished: true,
  });
  expect(Object.isFrozen(event.detail)).to.equal(true);
  await expect(element).to.be.accessible();
});

it("allows a drop by preventing default on dragover only while both the dragged and hovered columns remain movable", async () => {
  const element = await dataGrid(html`
    <lr-data-grid label="People" reorderable .columns=${columns} .data=${rows}></lr-data-grid>
  `);
  const nameHeader = element.shadowRoot!.querySelector<HTMLElement>(
    '[data-column-id="name"]'
  )!;
  const teamHeader = element.shadowRoot!.querySelector<HTMLElement>(
    '[data-column-id="team"]'
  )!;
  const dataTransfer = new DataTransfer();
  nameHeader.dispatchEvent(
    new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer })
  );
  const over = new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer });
  teamHeader.dispatchEvent(over);
  expect(over.defaultPrevented).to.equal(true);

  nameHeader.dispatchEvent(new DragEvent("dragend", { bubbles: true }));
  const overAfterEnd = new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer });
  teamHeader.dispatchEvent(overAfterEnd);
  expect(overAfterEnd.defaultPrevented, "no active drag session left to allow a drop").to.equal(false);
});

it("gives the page-size control a distinct localized purpose and represents an unlisted current size", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      paginate
      page-size="7"
      .strings=${{ dataGridRowsPerPage: "Visible rows per page" }}
      .pageSizeOptions=${[10, 20]}
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const select = element.shadowRoot!.querySelector<HTMLSelectElement>(
    '[part="page-size"]'
  )!;
  expect(select.getAttribute("aria-label")).to.equal("Visible rows per page");
  expect(select.value).to.equal("7");
  expect([...select.options].map((option) => option.value)).to.deep.equal([
    "7",
    "10",
    "20",
  ]);
});

it("uses one effective page across synchronous rows, state, and pager rendering", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      paginate
      page-size="1"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  element.page = 999;
  expect(element.getVisibleRows().map((row) => row.id)).to.deep.equal([3]);
  expect(element.getState().page).to.equal(2);
  await element.updateComplete;
  expect(
    element.shadowRoot!.querySelector('[part~="page-current"]')?.textContent?.trim()
  ).to.equal("3");
});

it('uses the separate row, control, sortable-header, and page-size interaction tokens live', async () => {
  await expectInteractionTokens(
    '--transition-duration: 0s; --row-hover-background: rgb(1, 2, 3); --lr-data-grid-row-active-bg: rgb(4, 5, 6); --lr-data-grid-control-hover-bg: rgb(7, 8, 9); --lr-data-grid-control-active-bg: rgb(10, 11, 12); --lr-data-grid-sortable-header-hover-bg: rgb(13, 14, 15); --lr-data-grid-sortable-header-active-bg: rgb(16, 17, 18); --lr-data-grid-page-size-active-bg: rgb(19, 20, 21)'
  );
});

it('ignores all retired -background interaction tokens', async () => {
  await expectInteractionTokens(
    '--transition-duration: 0s; --row-hover-background: rgb(1, 2, 3); --lr-data-grid-row-active-background: rgb(4, 5, 6); --lr-data-grid-control-hover-background: rgb(7, 8, 9); --lr-data-grid-control-active-background: rgb(10, 11, 12); --lr-data-grid-sortable-header-hover-background: rgb(13, 14, 15); --lr-data-grid-sortable-header-active-background: rgb(16, 17, 18); --lr-data-grid-page-size-active-background: rgb(19, 20, 21)', true
  );
});

it('retains the hover-strength fallback for a pressed page-size selector', async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="Page-size active fallback"
      paginate
      style="--transition-duration: 0s; --accent-color: rgb(200, 0, 0); --lr-color-mix-hover: 10%; --lr-color-mix-active: 60%"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const pageSize = element.shadowRoot!.querySelector<HTMLElement>(
    '[part="page-size"]'
  )!;
  const expected = document.createElement('div');
  expected.style.background =
    'color-mix(in srgb, var(--accent-color) var(--lr-color-mix-hover), transparent)';
  element.shadowRoot!.append(expected);

  try {
    await hoverUntilMatched(pageSize, 'the page-size control never registered :hover');
    await sendMouse({ type: 'down' });
    await waitUntil(
      () =>
        getComputedStyle(pageSize).backgroundColor ===
        getComputedStyle(expected).backgroundColor,
      'the page-size control never retained its hover-strength fallback color'
    );
  } finally {
    await sendMouse({ type: 'up' });
    await resetMouse();
    expected.remove();
  }
});

describe("explicitly empty host aria-label", () => {
  it("keeps the grid explicitly unnamed instead of falling back to the label property", async () => {
    const explicit = await dataGrid(
      html`<lr-data-grid label="People" aria-label=""></lr-data-grid>`
    );
    const table = explicit.shadowRoot!.querySelector('[part="table"]')!;
    expect(table.hasAttribute("aria-label")).to.equal(true);
    expect(table.getAttribute("aria-label")).to.equal("");

    const omitted = await dataGrid();
    expect(
      omitted.shadowRoot!.querySelector('[part="table"]')!.getAttribute("aria-label")
    ).to.equal("People");
  });
});
