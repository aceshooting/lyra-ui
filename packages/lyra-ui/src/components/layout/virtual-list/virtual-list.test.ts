import {
  fixture,
  expect,
  html,
  oneEvent,
  aTimeout,
  waitUntil,
} from "@open-wc/testing";
import "./virtual-list.js";
import {
  MAX_OVERSCAN_ROWS,
  VIRTUAL_LIST_ROW_ATTRIBUTE,
  VIRTUAL_LIST_STICKY_ATTRIBUTE,
  type LyraVirtualList,
  type LyraVirtualListIndexedSource,
} from "./virtual-list.js";
import { styles } from "./virtual-list.styles.js";
import {
  hoverUntilMatched,
  resetMouse,
  sendMouse,
  settlePointer,
} from "../../../../test/wtr-mouse.js";
import { readScrollbarWidth } from "../../../../test/scrollbar-reporting.js";

/** Waits two animation frames -- enough for the component's rAF-coalesced
 *  scroll handler *and* a queued ResizeObserver callback to have run. */
async function nextFrame(): Promise<void> {
  await new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r()))
  );
}

/** Sentinel for "emit no row-projection attribute at all", distinguishing the unset state from
 *  an explicit `row-projection="shadow"` in the byte-identity regression below. */
const nothingAttribute = Symbol('no row-projection attribute');

const numberKey = (item: unknown) => item as number;
const stringKey = (item: unknown) => item as string;
const renderText = (item: unknown, index: number) =>
  html`item ${item}#${index}`;

/** Resolves a declaration against the component's inherited token layer, rather than the test
 * document's light DOM where those tokens are intentionally absent. */
function resolvedInShadow(
  el: LyraVirtualList,
  declaration: string,
  property: string
): string {
  const probe = document.createElement("span");
  probe.setAttribute("style", declaration);
  el.shadowRoot!.appendChild(probe);
  const value = getComputedStyle(probe).getPropertyValue(property);
  probe.remove();
  return value;
}

it("does not schedule a Lit update from the initial container measurement", async () => {
  const globalWarnings = (globalThis as { litIssuedWarnings?: Set<string> })
    .litIssuedWarnings;
  globalWarnings?.forEach((warning) => {
    if (warning.includes("scheduled an update")) globalWarnings.delete(warning);
  });
  const originalWarn = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => calls.push(args);
  try {
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:200px"
        row-height="40"
        .items=${[1, 2, 3]}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lr-virtual-list>`
    )) as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();
  } finally {
    console.warn = originalWarn;
  }
  expect(
    calls
      .flat()
      .map(String)
      .some((message) => message.includes("scheduled an update"))
  ).to.be.false;
});

it('normalizes only group metadata through own data descriptors without changing generic row identity', async () => {
  let groupReads = 0;
  const accessorBacked: Record<string, unknown> = { label: 'Accessor-backed group' };
  Object.defineProperty(accessorBacked, 'startIndex', {
    enumerable: true,
    get(): never {
      groupReads += 1;
      throw new Error('do not invoke group accessors');
    },
  });
  const group: Record<string, unknown> = { key: 'safe', startIndex: 0, label: 'Safe group' };
  const item = { opaque: true };
  const el = (await fixture(html`
    <lr-virtual-list
      style="--lr-virtual-list-height: 200px"
      row-height="40"
      .items=${[item]}
      .groups=${[accessorBacked, group]}
      .renderItem=${(value: unknown) => html`${value === item ? 'identity preserved' : 'changed'}`}
    ></lr-virtual-list>
  `)) as LyraVirtualList;
  await nextFrame();

  expect(groupReads).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="group"]')?.textContent?.trim()).to.equal('Safe group');
  expect(el.shadowRoot!.querySelector('[part="row"]')?.textContent).to.contain('identity preserved');
});

it("is accessible with an empty items array", async () => {
  const el = (await fixture(
    html`<lr-virtual-list
      .items=${[]}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it("reads the theme-level scrollbar hook on the base viewport, defaulting to auto", async () => {
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      .items=${[1, 2, 3]}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const computed = getComputedStyle(base);
  expect(readScrollbarWidth(base, '[part="base"]')).to.equal("auto");
  expect(computed.scrollbarGutter).to.equal("auto");
});

it("lets a --lr-theme-scrollbar-width/-gutter ancestor override retune the base viewport", async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div style="--lr-theme-scrollbar-width: thin; --lr-theme-scrollbar-gutter: stable">
      <lr-virtual-list
        style="--lr-virtual-list-height:200px"
        row-height="40"
        .items=${[1, 2, 3]}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lr-virtual-list>
    </div>
  `);
  const el = wrapper.querySelector("lr-virtual-list") as LyraVirtualList;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const computed = getComputedStyle(base);
  expect(readScrollbarWidth(base, '[part="base"]')).to.equal("thin");
  expect(computed.scrollbarGutter).to.equal("stable");
});

it("is accessible with a populated, windowed item list", async () => {
  const items = Array.from({ length: 200 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  await expect(el).to.be.accessible();
});

it("accepts a readonly array through source while preserving items as the unset fallback", async () => {
  const el = (await fixture(html`
    <lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      .items=${["items fallback"]}
      .source=${["source row"] as const}
      .renderItem=${renderText}
    ></lr-virtual-list>
  `)) as LyraVirtualList;
  await nextFrame();
  expect(el.shadowRoot!.querySelector('[part="row"]')?.textContent).to.contain(
    "source row"
  );

  el.source = undefined;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="row"]')?.textContent).to.contain(
    "items fallback"
  );
});

it("keeps a 100,000-row indexed source sparse across ordinary state updates", async () => {
  let itemReads = 0;
  let keyReads = 0;
  const source: LyraVirtualListIndexedSource<number> = {
    count: 100_000,
    itemAt(index) {
      itemReads++;
      return index + 1;
    },
    keyAt(index) {
      keyReads++;
      return index + 1;
    },
  };
  const el = (await fixture(html`
    <lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      .source=${source}
      .renderItem=${renderText}
    ></lr-virtual-list>
  `)) as LyraVirtualList;
  await nextFrame();
  await el.updateComplete;

  const firstReadCount = itemReads;
  const internals = el as unknown as {
    offsets: number[];
    rowIdentities: string[];
  };
  expect(
    el.shadowRoot!.querySelector('[part="spacer"]')?.getAttribute("style")
  ).to.contain("4000000px");
  expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.be.lessThan(
    40
  );
  expect(itemReads).to.be.lessThan(40);
  expect(keyReads).to.be.lessThan(80);
  expect(internals.offsets).to.have.lengthOf(1);
  expect(internals.rowIdentities).to.have.lengthOf(0);

  el.loading = true;
  await el.updateComplete;
  expect(itemReads - firstReadCount).to.be.lessThan(40);
  expect(internals.offsets).to.have.lengthOf(1);
  expect(internals.rowIdentities).to.have.lengthOf(0);
});

it('uses an indexed source\'s reverse-key lookup for active-item-id without scanning the collection', async () => {
  let reads = 0;
  let reverseLookups = 0;
  const source: LyraVirtualListIndexedSource<number> = {
    count: 100_000,
    itemAt(index) {
      reads++;
      return index + 1;
    },
    keyAt(index) {
      return index + 1;
    },
    indexOfKey(key) {
      reverseLookups++;
      return typeof key === "number" ? key - 1 : -1;
    },
  };
  const el = await fixture<LyraVirtualList>(html`
    <lr-virtual-list
      row-height="40"
      .source=${source}
      .activeItemId=${99_999}
      .renderItem=${(item: unknown) => String(item)}
    ></lr-virtual-list>
  `);
  await el.updateComplete;

  expect(reverseLookups).to.equal(1);
  expect(reads).to.be.lessThan(30);
});

it('does not scan an indexed source\'s declared count when active-item-id has no reverse lookup', async () => {
  let reads = 0;
  let keyReads = 0;
  const source: LyraVirtualListIndexedSource<number> = {
    count: 1_000_000_000,
    itemAt(index) {
      reads++;
      return index;
    },
    keyAt(index) {
      keyReads++;
      return index;
    },
  };
  const el = await fixture<LyraVirtualList>(html`
    <lr-virtual-list
      row-height="40"
      .source=${source}
      .activeItemId=${999_999_999}
      .renderItem=${(item: unknown) => String(item)}
    ></lr-virtual-list>
  `);
  await el.updateComplete;

  expect(reads).to.be.lessThan(100);
  expect(keyReads).to.be.lessThan(100);
  expect(
    el.shadowRoot!.querySelector('[aria-current="true"]') === null
  ).to.equal(true);
});

it("normalizes an invalid indexed count to an empty collection without reading it", async () => {
  let reads = 0;
  const el = (await fixture(html`
    <lr-virtual-list
      .source=${{
        count: Number.NaN,
        itemAt: () => {
          reads++;
          return "bad";
        },
      }}
      .renderItem=${renderText}
    ></lr-virtual-list>
  `)) as LyraVirtualList;
  await el.updateComplete;
  expect(reads).to.equal(0);
  expect(el.renderedRows).to.have.lengthOf(0);
  expect(el.indexAtOffset(0)).to.equal(-1);
});

it("renders only a small window of DOM rows for a large items array, not every item", async () => {
  const items = Array.from({ length: 2000 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  const rows = el.shadowRoot!.querySelectorAll('[part="row"]');
  expect(rows.length).to.be.greaterThan(0);
  expect(rows.length).to.be.lessThan(50);
});

it("normalizes invalid and excessive overscan attributes to bounded whole-row values", async () => {
  const cases = [
    { value: "Infinity", expected: 6 },
    { value: "NaN", expected: 6 },
    { value: "-20", expected: 0 },
    { value: "12.9", expected: 12 },
    { value: "1000000000", expected: MAX_OVERSCAN_ROWS },
  ];
  const items = Array.from({ length: 1000 }, (_, i) => i);

  for (const testCase of cases) {
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:200px"
        row-height="40"
        overscan=${testCase.value}
        .items=${items}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lr-virtual-list>`
    )) as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();

    const rowCount = el.shadowRoot!.querySelectorAll('[part="row"]').length;
    expect(el.overscan, testCase.value).to.equal(testCase.expected);
    expect(rowCount, testCase.value).to.be.greaterThan(0);
    expect(rowCount, testCase.value).to.be.lessThan(250);
  }
});

it("uses the same bounded overscan fallback for direct property assignments", async () => {
  const items = Array.from({ length: 1000 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();

  for (const overscan of [Infinity, NaN, -20, 1_000_000_000]) {
    el.overscan = overscan;
    await el.updateComplete;
    const rowCount = el.shadowRoot!.querySelectorAll('[part="row"]').length;
    expect(rowCount, String(overscan)).to.be.greaterThan(0);
    expect(rowCount, String(overscan)).to.be.lessThan(250);
  }
});

it('restores overscan and row-height defaults when their attributes are removed', async () => {
  const el = await fixture<LyraVirtualList>(html`
    <lr-virtual-list
      overscan="2"
      row-height="40"
      .items=${[1, 2, 3]}
      .renderItem=${renderText}
    ></lr-virtual-list>
  `);
  el.removeAttribute('overscan');
  el.removeAttribute('row-height');
  await el.updateComplete;

  expect(el.overscan).to.equal(6);
  expect(el.rowHeight).to.equal('auto');
});

it('computes a bounded first window before a viewport can be measured', () => {
  const el = document.createElement('lr-virtual-list') as LyraVirtualList;
  el.items = Array.from({ length: 20 }, (_, index) => index);
  el.overscan = 3;
  const internals = el as unknown as {
    viewportHeight: number;
    renderUnmeasuredWindow: boolean;
    recomputeOffsets(): void;
    computeRange(): void;
    visibleStart: number;
    visibleEnd: number;
    renderStart: number;
    renderEnd: number;
  };
  internals.viewportHeight = 0;
  internals.renderUnmeasuredWindow = true;
  internals.recomputeOffsets();
  internals.computeRange();

  expect([
    internals.visibleStart,
    internals.visibleEnd,
    internals.renderStart,
    internals.renderEnd,
  ]).to.deep.equal([0, 0, 0, 3]);
});

it('uses role="list"/"listitem" (not listbox/option) and reflects the real item index via aria-setsize/aria-posinset', async () => {
  const items = Array.from({ length: 100 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      overscan="0"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();

  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute("role")).to.equal("list");

  const rowsBefore = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="row"]'),
  ];
  expect(rowsBefore.length).to.be.greaterThan(0);
  rowsBefore.forEach((r) =>
    expect(r.getAttribute("role")).to.equal("listitem")
  );
  // Full-array size, not the rendered-window size.
  expect(rowsBefore[0]!.getAttribute("aria-setsize")).to.equal("100");
  expect(rowsBefore[0]!.getAttribute("aria-posinset")).to.equal("1");

  // Scroll 10 rows down (400px / 40px per row) -- the *first rendered* row's
  // posinset must reflect its real index (11), not "1st DOM node".
  base.scrollTop = 400;
  base.dispatchEvent(new Event("scroll"));
  await nextFrame();
  await el.updateComplete;

  const rowsAfter = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="row"]'),
  ];
  expect(rowsAfter[0]!.getAttribute("aria-posinset")).to.equal("11");
  expect(rowsAfter[0]!.getAttribute("aria-setsize")).to.equal("100");
});

it("positions rows via translateY using exact cumulative offsets in fixed row-height mode", async () => {
  const items = Array.from({ length: 50 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:120px"
      row-height="40"
      overscan="0"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();

  const rows = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="row"]'),
  ];
  expect(rows[0]!.style.transform).to.equal("translateY(0px)");
  expect(rows[1]!.style.transform).to.equal("translateY(40px)");
  expect(rows[2]!.style.transform).to.equal("translateY(80px)");

  const spacer = el.shadowRoot!.querySelector('[part="spacer"]') as HTMLElement;
  expect(spacer.style.height).to.equal("2000px"); // 50 * 40
});

it("falls back to the item's index as the row key when keyFunction is omitted", async () => {
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      .items=${["a", "b", "c"]}
      .renderItem=${renderText}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  const rows = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="row"]'),
  ];
  expect(rows.map((r) => r.dataset['rowKey'])).to.deep.equal([
    "number:0",
    "number:1",
    "number:2",
  ]);
});

it("keeps NaN and negative zero keys distinct in their DOM tokens", async () => {
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      .items=${[NaN, -0]}
      .renderItem=${renderText}
      .keyFunction=${(item: unknown) => item as number}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();

  const rows = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="row"]'),
  ];
  expect(rows.map((row) => row.dataset['rowKey'])).to.deep.equal([
    "number:NaN",
    "number:-0",
  ]);
});

it("measures each row's real height via ResizeObserver in row-height='auto' mode instead of only using the fallback estimate", async () => {
  const tallRender = () =>
    html`<div style="block-size:100px;box-sizing:border-box;">row</div>`;
  const items = Array.from({ length: 5 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:600px"
      .items=${items}
      .renderItem=${tallRender}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  await nextFrame();
  await el.updateComplete;

  const spacer = el.shadowRoot!.querySelector('[part="spacer"]') as HTMLElement;
  const measuredTotal = parseFloat(spacer.style.height);
  // 5 * 100px measured vs. 5 * 48px (DEFAULT_ROW_ESTIMATE_PX) if measurement
  // never kicked in -- assert well above the estimate-only figure.
  expect(measuredTotal).to.be.greaterThan(400);
});

it("uses a row's rendered height when a ResizeObserver entry omits borderBoxSize", async () => {
  interface ResizeRecord {
    callback: ResizeObserverCallback;
    observer: ResizeObserver;
  }

  const originalResizeObserver = window.ResizeObserver;
  const records: ResizeRecord[] = [];
  class TestResizeObserver {
    readonly record: ResizeRecord;

    constructor(callback: ResizeObserverCallback) {
      this.record = {
        callback,
        observer: this as unknown as ResizeObserver,
      };
      records.push(this.record);
    }

    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (
    window as unknown as { ResizeObserver: typeof ResizeObserver }
  ).ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;

  try {
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:200px"
        .items=${[1]}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lr-virtual-list>`
    )) as LyraVirtualList;
    await nextFrame();
    await el.updateComplete;
    const row = el.renderedRows[0]!;
    Object.defineProperty(row, "getBoundingClientRect", {
      configurable: true,
      value: () => new DOMRect(0, 0, 0, 96),
    });
    const rowObserver = (
      el as unknown as {
        rowResizeObserver?: ResizeObserver;
      }
    ).rowResizeObserver;
    const record = records.find(
      (candidate) => candidate.observer === rowObserver
    );
    expect(
      record !== undefined,
      "row measurement observer is present"
    ).to.equal(true);

    record!.callback(
      [{ target: row } as unknown as ResizeObserverEntry],
      record!.observer
    );
    await el.updateComplete;

    expect(el.offsetForIndex(1)).to.equal(96);
  } finally {
    (
      window as unknown as { ResizeObserver: typeof ResizeObserver }
    ).ResizeObserver = originalResizeObserver;
  }
});

it("uses a group marker's rendered height when a ResizeObserver entry omits borderBoxSize", async () => {
  interface ResizeRecord {
    callback: ResizeObserverCallback;
    observer: ResizeObserver;
  }

  const originalResizeObserver = window.ResizeObserver;
  const records: ResizeRecord[] = [];
  class TestResizeObserver {
    readonly record: ResizeRecord;

    constructor(callback: ResizeObserverCallback) {
      this.record = {
        callback,
        observer: this as unknown as ResizeObserver,
      };
      records.push(this.record);
    }

    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (
    window as unknown as { ResizeObserver: typeof ResizeObserver }
  ).ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;

  try {
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:200px"
        row-height="40"
        .items=${["a", "b"]}
        .groups=${[{ key: "first", label: "First", startIndex: 0 }]}
        .renderItem=${renderText}
      ></lr-virtual-list>`
    )) as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();
    const marker = el.shadowRoot!.querySelector(
      '[part="group"]'
    ) as HTMLElement;
    expect(marker !== null, "group marker is present").to.equal(true);
    Object.defineProperty(marker, "getBoundingClientRect", {
      configurable: true,
      value: () => new DOMRect(0, 0, 0, 64),
    });
    const groupObserver = (
      el as unknown as { groupResizeObserver?: ResizeObserver }
    ).groupResizeObserver;
    const record = records.find(
      (candidate) => candidate.observer === groupObserver
    );
    expect(
      record !== undefined,
      "group measurement observer is present"
    ).to.equal(true);

    record!.callback(
      [{ target: marker } as unknown as ResizeObserverEntry],
      record!.observer
    );
    await el.updateComplete;

    // Fixed row-height=40 for row 0, plus the group marker's own measured height (64, replacing
    // the DEFAULT_GROUP_ESTIMATE_PX=32 estimate) contributed ahead of it.
    expect(el.offsetForIndex(1)).to.equal(64 + 40);
  } finally {
    (
      window as unknown as { ResizeObserver: typeof ResizeObserver }
    ).ResizeObserver = originalResizeObserver;
  }
});

it("keeps a measured group height when a fresh-but-content-identical groups array is reassigned", async () => {
  interface ResizeRecord {
    callback: ResizeObserverCallback;
    observer: ResizeObserver;
  }

  const originalResizeObserver = window.ResizeObserver;
  const records: ResizeRecord[] = [];
  class TestResizeObserver {
    readonly record: ResizeRecord;

    constructor(callback: ResizeObserverCallback) {
      this.record = {
        callback,
        observer: this as unknown as ResizeObserver,
      };
      records.push(this.record);
    }

    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (
    window as unknown as { ResizeObserver: typeof ResizeObserver }
  ).ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;

  try {
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:200px"
        row-height="40"
        .items=${["a", "b"]}
        .groups=${[{ key: "first", label: "First", startIndex: 0 }]}
        .renderItem=${renderText}
      ></lr-virtual-list>`
    )) as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();
    const marker = el.shadowRoot!.querySelector(
      '[part="group"]'
    ) as HTMLElement;
    Object.defineProperty(marker, "getBoundingClientRect", {
      configurable: true,
      value: () => new DOMRect(0, 0, 0, 64),
    });
    const groupObserver = (
      el as unknown as { groupResizeObserver?: ResizeObserver }
    ).groupResizeObserver;
    const record = records.find(
      (candidate) => candidate.observer === groupObserver
    );
    record!.callback(
      [{ target: marker } as unknown as ResizeObserverEntry],
      record!.observer
    );
    await el.updateComplete;
    expect(el.offsetForIndex(1)).to.equal(64 + 40);

    // A fresh array reference with identical group content (same key/label/startIndex) -- the
    // shape an unrelated parent re-render commonly rebinds. The measured height must survive
    // since nothing about the groups actually changed.
    el.groups = [{ key: "first", label: "First", startIndex: 0 }];
    await el.updateComplete;
    expect(el.offsetForIndex(1)).to.equal(64 + 40);
  } finally {
    (
      window as unknown as { ResizeObserver: typeof ResizeObserver }
    ).ResizeObserver = originalResizeObserver;
  }
});

it("adjusts an indexed source's offset by real measured deltas from earlier auto-height rows", async () => {
  interface ResizeRecord {
    callback: ResizeObserverCallback;
    observer: ResizeObserver;
  }

  const originalResizeObserver = window.ResizeObserver;
  const records: ResizeRecord[] = [];
  class TestResizeObserver {
    readonly record: ResizeRecord;

    constructor(callback: ResizeObserverCallback) {
      this.record = {
        callback,
        observer: this as unknown as ResizeObserver,
      };
      records.push(this.record);
    }

    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (
    window as unknown as { ResizeObserver: typeof ResizeObserver }
  ).ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;

  try {
    const source: LyraVirtualListIndexedSource<number> = {
      count: 10,
      itemAt: (index) => index,
      keyAt: (index) => index,
    };
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:200px"
        .source=${source}
        .renderItem=${renderText}
      ></lr-virtual-list>`
    )) as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();
    const beforeOffset = el.offsetForIndex(5);

    const row = el.renderedRows[0]!;
    Object.defineProperty(row, "getBoundingClientRect", {
      configurable: true,
      value: () => new DOMRect(0, 0, 0, 96),
    });
    const rowObserver = (
      el as unknown as { rowResizeObserver?: ResizeObserver }
    ).rowResizeObserver;
    const record = records.find(
      (candidate) => candidate.observer === rowObserver
    );
    expect(
      record !== undefined,
      "row measurement observer is present"
    ).to.equal(true);

    record!.callback(
      [{ target: row } as unknown as ResizeObserverEntry],
      record!.observer
    );
    await el.updateComplete;

    const afterOffset = el.offsetForIndex(5);
    // Row 0 grew from the DEFAULT_ROW_ESTIMATE_PX=48 estimate to a real measured 96px, and every
    // later index's offset must fold in exactly that delta.
    expect(afterOffset - beforeOffset).to.equal(96 - 48);
  } finally {
    (
      window as unknown as { ResizeObserver: typeof ResizeObserver }
    ).ResizeObserver = originalResizeObserver;
  }
});

it("wraps ordinary long row content and measures its auto height at 320px in LTR and RTL", async () => {
  const longToken = "x".repeat(128);

  for (const direction of ["ltr", "rtl"] as const) {
    const el = (await fixture(
      html`<lr-virtual-list
        dir=${direction}
        style="inline-size:320px; --lr-virtual-list-height:200px"
        .items=${[longToken]}
        .renderItem=${(item: unknown) =>
          html`<div style="display:flex"><span>${String(item)}</span></div>`}
        .keyFunction=${stringKey}
      ></lr-virtual-list>`
    )) as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();
    await nextFrame();
    await el.updateComplete;

    const base = el.scrollContainer!;
    const row = el.renderedRows[0]!;
    const spacer =
      el.shadowRoot!.querySelector<HTMLElement>("[part='spacer']")!;

    expect(
      row.scrollWidth,
      `${direction} row content stays contained`
    ).to.be.at.most(row.clientWidth);
    expect(
      row.getBoundingClientRect().height,
      `${direction} row wraps onto more than one line`
    ).to.be.greaterThan(48);
    expect(
      parseFloat(spacer.style.height),
      `${direction} auto-height measurement catches the wrapped row`
    ).to.be.greaterThan(48);
    expect(
      base.clientWidth,
      `${direction} list has a real narrow allocation`
    ).to.be.at.most(320);
  }
});

it("keeps an explicit consumer nowrap row horizontally scrollable", async () => {
  const longToken = "x".repeat(128);
  const el = (await fixture(
    html`<lr-virtual-list
      style="inline-size:320px; --lr-virtual-list-height:200px"
      .items=${[longToken]}
      .renderItem=${(item: unknown) =>
        html`<span style="white-space:nowrap">${String(item)}</span>`}
      .keyFunction=${stringKey}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();

  const base = el.scrollContainer!;
  const row = el.renderedRows[0]!;
  expect(getComputedStyle(base).overflowX).to.equal("auto");
  expect(row.scrollWidth).to.be.greaterThan(row.clientWidth);
  expect(base.scrollWidth).to.be.greaterThan(base.clientWidth);

  base.scrollLeft = 24;
  expect(base.scrollLeft).to.equal(24);
});

it('marks the row matching active-item-id with aria-current="true", not aria-selected', async () => {
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      active-item-id="b"
      .items=${["a", "b", "c"]}
      .renderItem=${renderText}
      .keyFunction=${stringKey}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  const rows = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="row"]'),
  ];
  const active = rows.find((r) => r.dataset['rowKey'] === "string:b")!;
  expect(active.getAttribute("aria-current")).to.equal("true");
  expect(active.hasAttribute("aria-selected")).to.be.false;
  const others = rows.filter((r) => r.dataset['rowKey'] !== "string:b");
  others.forEach((r) =>
    expect(r.getAttribute("aria-current")).to.equal("false")
  );
});

it('does not scroll on initial mount even when active-item-id targets a row far outside the viewport', async () => {
  const items = Array.from({ length: 50 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      .activeItemId=${40}
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.scrollTop).to.equal(0);
});

it('scrolls the matching row into view once active-item-id changes after mount', async () => {
  const originalMatchMedia = window.matchMedia;
  // Forces the reduced-motion branch so the scroll lands synchronously
  // instead of needing to wait out a real smooth-scroll animation.
  window.matchMedia = ((query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)",
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;

  try {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:200px"
        row-height="40"
        overscan="0"
        .items=${items}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lr-virtual-list>`
    )) as LyraVirtualList;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.scrollTop).to.equal(0);

    el.activeItemId = 40; // row 40's top edge is 40*40=1600px, well past the 200px viewport
    await el.updateComplete;
    await nextFrame();

    expect(base.scrollTop).to.be.greaterThan(1000);
  } finally {
    window.matchMedia = originalMatchMedia;
  }
});

describe("aria-label forwarding", () => {
  it('forwards a host-level aria-label onto the internal role="list" element', async () => {
    const el = (await fixture(
      html`<lr-virtual-list
        aria-label="Recent activity"
        .items=${[1, 2, 3]}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lr-virtual-list>`
    )) as LyraVirtualList;
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('[part="base"]')!.getAttribute("aria-label")
    ).to.equal("Recent activity");
  });

  it("preserves an explicitly empty host aria-label and removes it from the semantic owner when cleared", async () => {
    const el = (await fixture(
      html`<lr-virtual-list
        aria-label="Recent activity"
        .items=${[1, 2, 3]}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lr-virtual-list>`
    )) as LyraVirtualList;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    expect(base.getAttribute("aria-label")).to.equal("Recent activity");

    el.setAttribute("aria-label", "");
    await el.updateComplete;
    expect(base.getAttribute("aria-label")).to.equal("");

    el.removeAttribute("aria-label");
    await el.updateComplete;
    expect(base.hasAttribute("aria-label")).to.be.false;
  });

  it("has no aria-label on the internal element when the host has none", async () => {
    const el = (await fixture(
      html`<lr-virtual-list
        .items=${[1, 2, 3]}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lr-virtual-list>`
    )) as LyraVirtualList;
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('[part="base"]')!.hasAttribute("aria-label")
    ).to.be.false;
  });
});

it("scrollToIndex scrolls a fixed-row-height list to the requested row, honoring align", async () => {
  const items = Array.from({ length: 50 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      overscan="0"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  el.scrollToIndex(20, { align: "start", behavior: "auto" });
  await nextFrame();
  expect(base.scrollTop).to.equal(800); // row 20's top edge: 20 * 40

  el.scrollToIndex(0, { align: "start", behavior: "auto" });
  await nextFrame();
  el.scrollToIndex(20, { align: "end", behavior: "auto" });
  await nextFrame();
  // row 20's bottom edge (840) flush with the 200px viewport bottom.
  expect(base.scrollTop).to.equal(640);
});

it('scrollToIndex with align "auto" only scrolls the minimal distance (no-op when already visible)', async () => {
  const items = Array.from({ length: 50 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      overscan="0"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  el.scrollToIndex(2, { behavior: "auto" }); // row 2's top (80px) is already within the 200px viewport
  await nextFrame();
  expect(base.scrollTop).to.equal(0);
});

it("scrollToIndex clamps an out-of-range index instead of throwing", async () => {
  const items = Array.from({ length: 10 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  expect(() => el.scrollToIndex(999, { behavior: "auto" })).to.not.throw();
  expect(() => el.scrollToIndex(-5, { behavior: "auto" })).to.not.throw();
});

it("scrollToIndex is a no-op against an empty items array", async () => {
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      .items=${[]}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  expect(() => el.scrollToIndex(0)).to.not.throw();
});

it('forces behavior "auto" under prefers-reduced-motion even when "smooth" is requested', async () => {
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)",
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;

  try {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:200px"
        row-height="40"
        overscan="0"
        .items=${items}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lr-virtual-list>`
    )) as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

    el.scrollToIndex(20, { align: "start", behavior: "smooth" });
    await nextFrame();
    // Reduced motion forces an immediate jump -- scrollTop already landed
    // synchronously rather than animating over several frames.
    expect(base.scrollTop).to.equal(800);
  } finally {
    window.matchMedia = originalMatchMedia;
  }
});

it("in row-height='auto' mode, issues one corrective re-scroll once the target row's real height arrives", async () => {
  const tallRender = () =>
    html`<div style="block-size:100px;box-sizing:border-box;">row</div>`;
  const items = Array.from({ length: 30 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      overscan="0"
      .items=${items}
      .renderItem=${tallRender}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  await nextFrame();
  await el.updateComplete;

  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  // Row 25 is far outside both the currently-rendered window and any
  // measured offsets -- its estimate-based offset (DEFAULT_ROW_ESTIMATE_PX
  // per row) undershoots its real 100px-tall offset substantially. `'end'`
  // alignment is used because it targets the row's *bottom* edge
  // (offsets[index + 1]), which is exactly the value that shifts once this
  // row's own real height is measured -- unlike `'start'`, whose target is
  // the row's top edge and depends only on the (here, never-rendered and so
  // never re-measured) rows before it.
  el.scrollToIndex(25, { align: "end", behavior: "auto" });
  const estimateBasedTop = base.scrollTop;
  await nextFrame();
  await nextFrame();
  await el.updateComplete;

  // Once row 25 actually renders and gets measured at 100px, the corrective
  // re-scroll lands well past the estimate-based guess.
  expect(base.scrollTop).to.be.greaterThan(estimateBasedTop);
});

it('keeps an active-item-id target visible while tall preceding rows replace their estimates', async () => {
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)",
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  try {
    const items = Array.from({ length: 50 }, (_, index) => index);
    const el = await fixture<LyraVirtualList>(html`
      <lr-virtual-list
        style="--lr-virtual-list-height:200px"
        overscan="3"
        .items=${items}
        .renderItem=${(_item: unknown, index: number) => html`
          <div
            style="block-size:${index >= 20 && index < 25 ? 220 : 40}px"
          ></div>
        `}
        .keyFunction=${numberKey}
      ></lr-virtual-list>
    `);
    await nextFrame();
    el.activeItemId = 25;
    await el.updateComplete;

    await waitUntil(
      () => {
        const row = el.shadowRoot!.querySelector<HTMLElement>(
          '[part="row"][data-row-index="25"]'
        );
        if (!row) return false;
        const rowRect = row.getBoundingClientRect();
        const viewportRect = el.scrollContainer!.getBoundingClientRect();
        return (
          rowRect.top >= viewportRect.top - 0.5 &&
          rowRect.bottom <= viewportRect.bottom + 0.5
        );
      },
      "active row remains inside the viewport after measurement correction",
      {
        timeout: 4000,
        interval: 20,
      }
    );
  } finally {
    window.matchMedia = originalMatchMedia;
  }
});

it("cancels an estimate correction on manual scroll intent and source replacement", async () => {
  const el = await fixture<LyraVirtualList>(html`
    <lr-virtual-list
      style="--lr-virtual-list-height:200px"
      .items=${Array.from({ length: 50 }, (_, index) => index)}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>
  `);
  await nextFrame();
  const internals = el as unknown as { pendingScrollCorrection?: unknown };
  el.scrollToIndex(25, { align: "end", behavior: "auto" });
  expect(internals.pendingScrollCorrection === undefined).to.equal(false);
  el.scrollContainer!.dispatchEvent(new WheelEvent("wheel"));
  expect(internals.pendingScrollCorrection === undefined).to.equal(true);

  el.scrollToIndex(25, { align: "end", behavior: "auto" });
  expect(internals.pendingScrollCorrection === undefined).to.equal(false);
  el.scrollContainer!.dispatchEvent(
    new KeyboardEvent("keydown", { key: "PageDown" })
  );
  expect(internals.pendingScrollCorrection === undefined).to.equal(true);

  el.scrollToIndex(25, { align: "end", behavior: "auto" });
  expect(internals.pendingScrollCorrection === undefined).to.equal(false);
  el.items = Array.from({ length: 50 }, (_, index) => index + 100);
  await el.updateComplete;
  expect(internals.pendingScrollCorrection === undefined).to.equal(true);
});

it("emits lr-visible-range-change once the container is measured after mount", async () => {
  const el = document.createElement("lr-virtual-list") as LyraVirtualList;
  el.setAttribute("style", "--lr-virtual-list-height:200px");
  el.setAttribute("row-height", "40");
  el.items = Array.from({ length: 30 }, (_, i) => i);
  el.renderItem = renderText;
  el.keyFunction = numberKey;

  const eventPromise = oneEvent(el, "lr-visible-range-change");
  document.body.appendChild(el);
  const ev = await eventPromise;
  expect(ev.detail.start).to.equal(0);
  expect(ev.detail.end).to.be.greaterThan(0);
  el.remove();
});

it("re-emits a populated range after an empty transition restores the same window", async () => {
  const items = Array.from({ length: 30 }, (_, i) => i);
  const el = document.createElement("lr-virtual-list") as LyraVirtualList;
  el.setAttribute("style", "--lr-virtual-list-height:200px");
  el.setAttribute("row-height", "40");
  el.items = items;
  el.renderItem = renderText;
  el.keyFunction = numberKey;

  const initialRange = oneEvent(el, "lr-visible-range-change");
  document.body.appendChild(el);
  try {
    const initial = await initialRange;
    const ranges: Array<{ start: number; end: number }> = [];
    el.addEventListener("lr-visible-range-change", (event) => {
      const { start, end } = (
        event as CustomEvent<{ start: number; end: number }>
      ).detail;
      ranges.push({ start, end });
    });

    el.items = [];
    await el.updateComplete;
    expect(ranges.length).to.equal(0);

    el.items = items;
    await el.updateComplete;
    expect(ranges.length).to.equal(1);
    expect(ranges[0]?.start).to.equal(initial.detail.start);
    expect(ranges[0]?.end).to.equal(initial.detail.end);
  } finally {
    el.remove();
  }
});

it("coalesces rapid scroll events into a single visible-range recompute per animation frame", async () => {
  const items = Array.from({ length: 100 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      overscan="0"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();

  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  let count = 0;
  el.addEventListener("lr-visible-range-change", () => count++);

  base.scrollTop = 100;
  base.dispatchEvent(new Event("scroll"));
  base.scrollTop = 200;
  base.dispatchEvent(new Event("scroll"));
  base.scrollTop = 400;
  base.dispatchEvent(new Event("scroll"));
  await nextFrame();
  await el.updateComplete;

  expect(
    count,
    "three rapid scroll events should coalesce to one recompute"
  ).to.equal(1);
});

it("cancels a pending scroll frame when disconnected before it runs", async () => {
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      .items=${Array.from({ length: 30 }, (_, i) => i)}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();

  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  base.scrollTop = 200;
  base.dispatchEvent(new Event("scroll"));
  el.remove();
  await nextFrame();
});

it("binds observers and frames to the adopted owner and rejects retired callbacks", async () => {
  interface ResizeRecord {
    callback: ResizeObserverCallback;
    disconnects: number;
  }
  interface MutationRecordState {
    callback: MutationCallback;
    disconnects: number;
    instance: MutationObserver;
  }
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      .items=${Array.from({ length: 30 }, (_, i) => i)}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  el.remove();

  const frame = document.createElement("iframe");
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const frameWindow = frame.contentWindow!;
  const originalResizeObserver = frameWindow.ResizeObserver;
  const originalMutationObserver = frameWindow.MutationObserver;
  const originalRequestAnimationFrame = frameWindow.requestAnimationFrame;
  const originalCancelAnimationFrame = frameWindow.cancelAnimationFrame;
  const resizeRecords: ResizeRecord[] = [];
  const mutationRecords: MutationRecordState[] = [];
  const frameCallbacks = new Map<number, FrameRequestCallback>();
  const retiredFrameCallbacks: FrameRequestCallback[] = [];
  const cancelledFrames: number[] = [];
  let nextHandle = 70;
  class OwnerResizeObserver implements ResizeObserver {
    private readonly record: ResizeRecord;
    constructor(callback: ResizeObserverCallback) {
      this.record = { callback, disconnects: 0 };
      resizeRecords.push(this.record);
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {
      this.record.disconnects += 1;
    }
  }
  class OwnerMutationObserver implements MutationObserver {
    private readonly record: MutationRecordState;
    constructor(callback: MutationCallback) {
      this.record = { callback, disconnects: 0, instance: this };
      mutationRecords.push(this.record);
    }
    observe(): void {}
    takeRecords(): MutationRecord[] {
      return [];
    }
    disconnect(): void {
      this.record.disconnects += 1;
    }
  }
  frameWindow.ResizeObserver = OwnerResizeObserver;
  frameWindow.MutationObserver = OwnerMutationObserver;
  frameWindow.requestAnimationFrame = ((
    callback: FrameRequestCallback
  ): number => {
    const handle = nextHandle++;
    frameCallbacks.set(handle, callback);
    retiredFrameCallbacks.push(callback);
    return handle;
  }) as typeof frameWindow.requestAnimationFrame;
  frameWindow.cancelAnimationFrame = ((handle: number): void => {
    cancelledFrames.push(handle);
    frameCallbacks.delete(handle);
  }) as typeof frameWindow.cancelAnimationFrame;

  try {
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;
    expect(
      resizeRecords.length,
      "row, group, sticky, and container observers use the owner window"
    ).to.equal(4);
    expect(
      "stickyFocusObserver" in (el as unknown as Record<string, unknown>),
      "inert sticky copies install no caller-subtree traversal observer"
    ).to.equal(false);

    resizeRecords[0]!.callback([], {} as ResizeObserver);
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.scrollTop = 120;
    base.dispatchEvent(new frameWindow.Event("scroll"));
    expect(
      frameCallbacks.size,
      "resize and scroll work schedule through the owner window"
    ).to.equal(2);

    let scrollEvents = 0;
    el.addEventListener("lr-virtual-scroll", () => {
      scrollEvents += 1;
    });
    document.adoptNode(el);
    expect(
      cancelledFrames.length,
      "adoption cancels both owner-window frames"
    ).to.equal(2);
    expect(resizeRecords.every((record) => record.disconnects > 0)).to.equal(
      true
    );

    resizeRecords.forEach((record) =>
      record.callback([], {} as ResizeObserver)
    );
    retiredFrameCallbacks.forEach((callback) => callback(0));
    expect(
      scrollEvents,
      "retired observer/frame work cannot emit after adoption"
    ).to.equal(0);
    expect(
      frameCallbacks.size,
      "retired callbacks cannot schedule new owner work"
    ).to.equal(0);
  } finally {
    frameWindow.ResizeObserver = originalResizeObserver;
    frameWindow.MutationObserver = originalMutationObserver;
    frameWindow.requestAnimationFrame = originalRequestAnimationFrame;
    frameWindow.cancelAnimationFrame = originalCancelAnimationFrame;
    if (el.ownerDocument !== document) document.adoptNode(el);
    el.remove();
    frame.remove();
  }
});

it("fails closed when an adopted owner lacks observer capabilities", async () => {
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      .items=${[1, 2, 3]}
      .renderItem=${renderText}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  el.remove();
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const frameWindow = frame.contentWindow!;
  const originalResizeObserver = frameWindow.ResizeObserver;
  const originalMutationObserver = frameWindow.MutationObserver;
  Object.defineProperty(frameWindow, "ResizeObserver", {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(frameWindow, "MutationObserver", {
    configurable: true,
    value: undefined,
  });
  try {
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;
    expect(
      (el as unknown as { rowResizeObserver?: ResizeObserver })
        .rowResizeObserver === undefined
    ).to.be.true;
  } finally {
    el.remove();
    Object.defineProperty(frameWindow, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: originalResizeObserver,
    });
    Object.defineProperty(frameWindow, "MutationObserver", {
      configurable: true,
      writable: true,
      value: originalMutationObserver,
    });
    if (el.ownerDocument !== document) document.adoptNode(el);
    frame.remove();
  }
});

it("keeps the scroll position anchored when a measured row above the viewport grows", async () => {
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      overscan="100"
      .items=${Array.from({ length: 20 }, (_, i) => i)}
      .renderItem=${() =>
        html`<div style="block-size:48px;box-sizing:border-box">row</div>`}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  await nextFrame();

  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  base.scrollTop = 400;
  const before = base.scrollTop;
  const firstRow = el.shadowRoot!.querySelector('[part="row"]') as HTMLElement;
  (firstRow.firstElementChild as HTMLElement).style.blockSize = "100px";
  await nextFrame();
  await nextFrame();

  expect(base.scrollTop).to.be.greaterThan(before);
});

it("fires lr-load-more once when scrolling near the bottom while has-more is true and loading is false", async () => {
  const items = Array.from({ length: 20 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      has-more
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();

  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const eventPromise = oneEvent(el, "lr-load-more");
  base.scrollTop = base.scrollHeight; // jump to the bottom
  base.dispatchEvent(new Event("scroll"));
  await eventPromise; // resolves iff lr-load-more fires
});

it("does not refire lr-load-more while already loading, and re-arms after scrolling away and back", async () => {
  const items = Array.from({ length: 20 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      has-more
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();

  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  let count = 0;
  el.addEventListener("lr-load-more", () => count++);

  base.scrollTop = base.scrollHeight;
  base.dispatchEvent(new Event("scroll"));
  await nextFrame();
  await el.updateComplete;
  expect(count).to.equal(1);

  // Still at the bottom, and loading -- must not refire.
  el.loading = true;
  base.dispatchEvent(new Event("scroll"));
  await nextFrame();
  await el.updateComplete;
  expect(count, "should not refire while loading").to.equal(1);

  el.loading = false;
  base.dispatchEvent(new Event("scroll"));
  await nextFrame();
  await el.updateComplete;
  expect(
    count,
    "should not refire just because loading finished while still at the same bottom approach"
  ).to.equal(1);

  // Scroll away from the bottom, then back -- a fresh approach re-arms it.
  base.scrollTop = 0;
  base.dispatchEvent(new Event("scroll"));
  await nextFrame();
  await el.updateComplete;

  base.scrollTop = base.scrollHeight;
  base.dispatchEvent(new Event("scroll"));
  await nextFrame();
  await el.updateComplete;
  expect(
    count,
    "re-approaching the bottom after leaving it should fire again"
  ).to.equal(2);
});

it("never fires lr-load-more when has-more is false", async () => {
  const items = Array.from({ length: 20 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();

  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  let fired = false;
  el.addEventListener("lr-load-more", () => (fired = true));

  base.scrollTop = base.scrollHeight;
  base.dispatchEvent(new Event("scroll"));
  await aTimeout(100);
  expect(fired).to.be.false;
});

it("reflects loading via the loading attribute and aria-busy on the scroll container", async () => {
  const el = (await fixture(
    html`<lr-virtual-list
      loading
      .items=${[]}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  expect(el.hasAttribute("loading")).to.be.true;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute("aria-busy")).to.equal("true");
  el.loading = false;
  await el.updateComplete;
  expect(base.getAttribute("aria-busy")).to.equal("false");
});

it('falls back to auto (measured) mode when row-height is neither "auto" nor a valid positive number', async () => {
  const items = Array.from({ length: 5 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="not-a-number"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  const spacer = el.shadowRoot!.querySelector('[part="spacer"]') as HTMLElement;
  const height = parseFloat(spacer.style.height);
  expect(height).to.be.greaterThan(0);
  expect(Number.isNaN(height)).to.be.false;
  expect(el.rowHeight).to.equal("auto");
});

it("parses numeric row-height markup as a number and accepts numeric property writes", async () => {
  const el = await fixture<LyraVirtualList>(html`
    <lr-virtual-list
      row-height="40"
      .items=${["a", "b", "c"]}
      .renderItem=${renderText}
    ></lr-virtual-list>
  `);
  await el.updateComplete;
  expect(el.rowHeight).to.equal(40);
  expect(el.offsetForIndex(3)).to.equal(120);

  el.rowHeight = 28;
  await el.updateComplete;
  expect(el.offsetForIndex(3)).to.equal(84);
});

it("renders row positions from the public offset coordinate rather than a padding proxy", async () => {
  const el = (await fixture(html`
    <lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      .items=${["first", "second", "third"]}
      .renderItem=${renderText}
    ></lr-virtual-list>
  `)) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  const spacer = el.shadowRoot!.querySelector('[part="spacer"]') as HTMLElement;
  const row = el.shadowRoot!.querySelector('[part="row"][data-row-index="1"]') as HTMLElement;

  expect(getComputedStyle(row).position).to.equal("absolute");
  expect(getComputedStyle(row).transform).to.not.equal("none");
  expect(getComputedStyle(spacer).paddingBlockStart).to.equal("0px");
  expect(row.getBoundingClientRect().top - spacer.getBoundingClientRect().top).to.be.closeTo(
    el.offsetForIndex(1),
    0.5
  );
});

it('gives the always-focusable [part="base"] scroll region a :hover state, matching its own :focus-visible affordance', () => {
  const css = styles.cssText.replace(/"/g, "'").replace(/\s+/g, " ");
  expect(css).to.match(/\[part='base'\]:hover\s*\{[^}]+\}/);
});

describe("hover-outline cssprops", () => {
  async function themed(style = ""): Promise<{
    el: LyraVirtualList;
    base: HTMLElement;
  }> {
    const wrapper = (await fixture(
      html`<div style=${style}>
        <lr-virtual-list
          style="--lr-virtual-list-height:200px"
          .items=${[1, 2, 3]}
          .renderItem=${renderText}
          .keyFunction=${numberKey}
        ></lr-virtual-list>
      </div>`
    )) as HTMLElement;
    const el = wrapper.querySelector("lr-virtual-list") as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();
    return {
      el,
      base: el.shadowRoot!.querySelector('[part="base"]') as HTMLElement,
    };
  }

  // Both tests below land the pointer with hoverUntilMatched() instead of computing a position and
  // dispatching one move: `sendMouse` resolves when the synthesized command completes, not when
  // the browser processed the resulting native pointer event, and a windowed list whose rows settle
  // late moves the viewport out from under an already-dispatched position. hoverUntilMatched()
  // re-reads the rect and re-dispatches until `:hover` really matches (docs/agents/testing.md).

  it("keeps the pre-hook hover outline when each scoped property is unset", async () => {
    const { el, base } = await themed();
    const expectedWidth = resolvedInShadow(
      el,
      "outline-width: var(--lr-border-width-thin)",
      "outline-width"
    );
    const expectedColor = resolvedInShadow(
      el,
      "outline-color: var(--lr-color-border-strong)",
      "outline-color"
    );
    const expectedOffset = resolvedInShadow(
      el,
      "outline-offset: calc(-1 * var(--lr-border-width-thin))",
      "outline-offset"
    );

    try {
      await hoverUntilMatched(
        base,
        "the list viewport never took the pointer"
      );
      await waitUntil(
        () => getComputedStyle(base).outlineStyle === "solid",
        "the hovered list viewport never painted its outline"
      );
      const hovered = getComputedStyle(base);
      expect(hovered.outlineWidth).to.equal(expectedWidth);
      expect(hovered.outlineStyle).to.equal("solid");
      expect(hovered.outlineColor).to.equal(expectedColor);
      expect(hovered.outlineOffset).to.equal(expectedOffset);
    } finally {
      await resetMouse();
    }
  });

  it("inherits independent hover outline longhands and keeps that preview unchanged while pressed", async () => {
    const { base } = await themed(
      "--lr-virtual-list-hover-outline-width: 3px;" +
        "--lr-virtual-list-hover-outline-style: dashed;" +
        "--lr-virtual-list-hover-outline-color: rgb(12, 34, 56);" +
        "--lr-virtual-list-hover-outline-offset: -2px;"
    );

    try {
      await hoverUntilMatched(
        base,
        "the list viewport never took the pointer"
      );
      await waitUntil(
        () => getComputedStyle(base).outlineWidth === "3px",
        "the hovered list viewport never took the scoped outline width"
      );
      const hovered = getComputedStyle(base);
      expect(hovered.outlineWidth).to.equal("3px");
      expect(hovered.outlineStyle).to.equal("dashed");
      expect(hovered.outlineColor).to.equal("rgb(12, 34, 56)");
      expect(hovered.outlineOffset).to.equal("-2px");

      await sendMouse({ type: "down" });
      // The press must leave that preview UNCHANGED, and an unchanged paint has nothing to poll
      // for -- settle two frames so the read cannot pass simply because the press has not been
      // processed yet (test/wtr-mouse.ts).
      await settlePointer();
      const pressed = getComputedStyle(base);
      expect(pressed.outlineWidth).to.equal("3px");
      expect(pressed.outlineStyle).to.equal("dashed");
      expect(pressed.outlineColor).to.equal("rgb(12, 34, 56)");
      expect(pressed.outlineOffset).to.equal("-2px");
    } finally {
      await resetMouse();
    }
  });
});

it('does not rebuild the offsets array on a pure scroll-position update in row-height="auto" mode', async () => {
  const items = Array.from({ length: 300 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  // Let the initial measurement pass (and any offsets rebuild it triggers)
  // fully settle before taking the "before" snapshot.
  await nextFrame();
  await nextFrame();
  await el.updateComplete;

  const offsetsBefore = (el as unknown as { offsets: number[] }).offsets;

  // A tiny scroll delta that doesn't move the rendered window at all (rows
  // are ~48px tall by default) -- a pure scroll-position tick with no
  // items/rowHeight/keyFunction change and no new row entering view to be
  // measured for the first time.
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  base.scrollTop = 5;
  base.dispatchEvent(new Event("scroll"));
  await nextFrame();
  await el.updateComplete;

  const offsetsAfter = (el as unknown as { offsets: number[] }).offsets;
  expect(
    offsetsAfter,
    "offsets should be the same array instance -- recomputeOffsets() must not have run"
  ).to.equal(offsetsBefore);
});

it("keeps watching already-rendered rows for height changes after a disconnect/reconnect that changes no other property", async () => {
  const resizableRender = () =>
    html`<div style="block-size:48px;box-sizing:border-box;">row</div>`;
  const items = Array.from({ length: 5 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:600px"
      .items=${items}
      .renderItem=${resizableRender}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  await nextFrame();
  await el.updateComplete;

  const spacerBefore = el.shadowRoot!.querySelector(
    '[part="spacer"]'
  ) as HTMLElement;
  const heightBefore = parseFloat(spacerBefore.style.height);

  // Detach/reattach without touching any other property -- simulates the
  // reparenting-drag scenario the class doc calls out. No reactive property
  // changes here, so a Lit re-render must not be the only thing that keeps
  // row-height measurement alive.
  const parent = el.parentElement!;
  parent.removeChild(el);
  parent.appendChild(el);
  await el.updateComplete;

  const row = el.shadowRoot!.querySelector('[part="row"]') as HTMLElement;
  const content = row.firstElementChild as HTMLElement;
  content.style.blockSize = "300px";
  await nextFrame();
  await nextFrame();
  await el.updateComplete;

  const spacerAfter = el.shadowRoot!.querySelector(
    '[part="spacer"]'
  ) as HTMLElement;
  const heightAfter = parseFloat(spacerAfter.style.height);
  expect(
    heightAfter,
    "a mutated row height should still reach the spacer after reconnect"
  ).to.be.greaterThan(heightBefore);
});

it("prunes stale measuredHeights entries once items changes to a wholly different set of keys", async () => {
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      .items=${["a", "b", "c"]}
      .renderItem=${renderText}
      .keyFunction=${stringKey}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  await nextFrame();
  await el.updateComplete;

  const state = el as unknown as {
    measuredHeights: Map<string, number>;
    rowIdentities: string[];
  };
  const measuredHeights = state.measuredHeights;
  const staleIdentities = [...state.rowIdentities];
  staleIdentities.forEach(
    (identity) => expect(measuredHeights.has(identity)).to.be.true
  );

  el.items = ["x", "y"];
  await el.updateComplete;
  await nextFrame();
  await nextFrame();
  await el.updateComplete;

  staleIdentities.forEach((identity) => {
    expect(
      measuredHeights.has(identity),
      `stale identity "${identity}" should have been pruned`
    ).to.be.false;
  });
});

it("bounds indexed-source auto-height measurements to a multiple of the rendered window", async function () {
  this.timeout(15_000);
  const source: LyraVirtualListIndexedSource<number> = {
    count: 100_000,
    itemAt: (index) => index,
    keyAt: (index) => index,
  };
  const el = (await fixture(html`
    <lr-virtual-list
      style="--lr-virtual-list-height:200px"
      .source=${source}
      .renderItem=${renderText}
    ></lr-virtual-list>
  `)) as LyraVirtualList;
  await nextFrame();
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  for (let window = 1; window <= 100; window++) {
    base.scrollTop = window * 400;
    base.dispatchEvent(new Event("scroll"));
    await nextFrame();
    await el.updateComplete;
  }

  const state = el as unknown as {
    measuredHeights: Map<string, number>;
    measuredIndices: Map<string, number>;
  };
  const renderedCount = el.renderedRows.length;
  const retentionLimit = Math.max(64, renderedCount * 8);
  expect(state.measuredHeights.size).to.be.at.most(retentionLimit);
  expect(state.measuredIndices.size).to.be.at.most(retentionLimit);
});

it("prunes measuredIndices together with measuredHeights when array items are replaced", async () => {
  const el = (await fixture(html`
    <lr-virtual-list
      style="--lr-virtual-list-height:200px"
      .items=${Array.from({ length: 80 }, (_, index) => index)}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>
  `)) as LyraVirtualList;
  await nextFrame();
  await nextFrame();
  await el.updateComplete;
  const state = el as unknown as {
    measuredHeights: Map<string, number>;
    measuredIndices: Map<string, number>;
  };
  expect(state.measuredIndices.size).to.be.greaterThan(0);

  el.items = [1000, 1001];
  await el.updateComplete;
  await nextFrame();
  await nextFrame();
  await el.updateComplete;

  expect(state.measuredHeights.size).to.be.at.most(2);
  expect(state.measuredIndices.size).to.equal(state.measuredHeights.size);
});

it("keeps numeric and string keys distinct in internal measurements and DOM identity", async () => {
  const items = [1, "1"];
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="auto"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${(item: unknown) => item as string | number}
      .activeItemId=${1}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  await nextFrame();
  const rows = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="row"]'),
  ];
  expect(rows.map((row) => row.dataset['rowKey'])).to.deep.equal([
    "number:1",
    "string:1",
  ]);
  expect(rows[0]!.getAttribute("aria-current")).to.equal("true");
  expect(rows[1]!.getAttribute("aria-current")).to.equal("false");
});

it("keeps duplicate public keys as distinct occurrence-owned rows and activates only the first", async () => {
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="auto"
      .items=${["first", "duplicate", "other"]}
      .renderItem=${renderText}
      .keyFunction=${() => "same"}
      active-item-id="same"
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  const rows = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="row"]'),
  ];
  expect(rows).to.have.length(3);
  expect(
    rows.filter((row) => row.getAttribute("aria-current") === "true")
  ).to.have.length(1);
  expect(
    (el as unknown as { observedRows: Map<string, HTMLElement> }).observedRows
      .size,
    "each duplicate occurrence has independent observation state"
  ).to.equal(3);
});

it("measures group markers as virtual entries before their indexed rows", async () => {
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      .items=${["a", "b", "c"]}
      .groups=${[
        { key: "first", label: "First", startIndex: 0 },
        { key: "second", label: "Second", startIndex: 2 },
        { key: "invalid", startIndex: 99 },
      ]}
      .renderItem=${renderText}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  const groups = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="group"]'),
  ];
  expect(groups.map((group) => group.textContent?.trim())).to.deep.equal([
    "First",
    "Second",
  ]);
  const firstHeight = groups[0]!.getBoundingClientRect().height;
  const secondHeight = groups[1]!.getBoundingClientRect().height;
  const rows = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="row"]'),
  ];
  expect(
    parseFloat(rows[0]!.style.transform.replace(/[^\d.-]/g, ""))
  ).to.be.closeTo(firstHeight, 1);
  expect(
    parseFloat(groups[1]!.style.transform.replace(/[^\d.-]/g, ""))
  ).to.be.closeTo(firstHeight + 80, 1);
  expect(
    parseFloat(rows[2]!.style.transform.replace(/[^\d.-]/g, ""))
  ).to.be.closeTo(firstHeight + 80 + secondHeight, 1);
  expect(el.offsetForIndex(3)).to.be.closeTo(
    120 + firstHeight + secondHeight,
    1
  );
  expect(rows[2]!.getBoundingClientRect().top).to.be.gte(
    groups[1]!.getBoundingClientRect().bottom - 0.5
  );
});

it("stops observing a group marker once its group is removed from groups", async () => {
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      .items=${["a", "b", "c"]}
      .groups=${[{ key: "g", label: "Group", startIndex: 0 }]}
      .renderItem=${renderText}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  expect(el.shadowRoot!.querySelectorAll('[part="group"]').length).to.equal(
    1
  );
  const internals = el as unknown as {
    observedGroups: Map<number, HTMLElement>;
  };
  expect(internals.observedGroups.size).to.equal(1);

  el.groups = [];
  await el.updateComplete;
  await nextFrame();

  expect(el.shadowRoot!.querySelectorAll('[part="group"]').length).to.equal(
    0
  );
  expect(internals.observedGroups.size).to.equal(0);
});

it("keeps a pending scroll correction alive in fixed-row-height mode while an unmeasured group precedes the target", async () => {
  // A stub ResizeObserver that never delivers keeps the group marker permanently unmeasured --
  // the real ResizeObserver would otherwise race this assertion by measuring it before the
  // synchronous scrollToIndex() call below runs.
  const originalResizeObserver = window.ResizeObserver;
  class NonDeliveringResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (
    window as unknown as { ResizeObserver: typeof ResizeObserver }
  ).ResizeObserver =
    NonDeliveringResizeObserver as unknown as typeof ResizeObserver;

  try {
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:200px"
        row-height="40"
        .items=${Array.from({ length: 20 }, (_, i) => i)}
        .groups=${[{ key: "g", label: "Group", startIndex: 0 }]}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lr-virtual-list>`
    )) as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();
    const internals = el as unknown as { pendingScrollCorrection?: unknown };
    el.scrollToIndex(15, { align: "start", behavior: "auto" });
    // Row heights are fixed, but the group marker ahead of index 15 has never been measured, so
    // the correction transaction must stay armed until a real group-marker measurement arrives.
    expect(internals.pendingScrollCorrection === undefined).to.equal(false);
  } finally {
    (
      window as unknown as { ResizeObserver: typeof ResizeObserver }
    ).ResizeObserver = originalResizeObserver;
  }
});

it("reflows variable-height group markers without covering their first rows", async () => {
  const el = await fixture<LyraVirtualList>(html`
    <lr-virtual-list
      style="--lr-virtual-list-height:240px"
      row-height="40"
      .items=${["a", "b", "c", "d"]}
      .groups=${[
        { key: "a", label: "Tall", startIndex: 0 },
        { key: "b", label: "Short", startIndex: 2 },
      ]}
      .renderItem=${renderText}
    ></lr-virtual-list>
  `);
  await nextFrame();
  const markers = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="group"]'),
  ];
  markers[0]!.style.blockSize = "72px";
  markers[0]!.style.boxSizing = "border-box";
  markers[1]!.style.blockSize = "24px";
  markers[1]!.style.boxSizing = "border-box";
  await nextFrame();
  await el.updateComplete;
  await nextFrame();

  for (const marker of markers) {
    const index = Number(marker.dataset["groupIndex"]);
    const row = el.shadowRoot!.querySelector<HTMLElement>(
      `[part="row"][data-row-index="${index}"]`
    )!;
    expect(row.getBoundingClientRect().top).to.be.gte(
      marker.getBoundingClientRect().bottom - 0.5
    );
  }
  expect(el.offsetForIndex(4)).to.be.closeTo(72 + 24 + 4 * 40, 1);
});

it("keeps an empty-label position anchor size-free", async () => {
  const el = await fixture<LyraVirtualList>(html`
    <lr-virtual-list
      row-height="40"
      .items=${["a", "b"]}
      .groups=${[{ key: "anchor", label: "", startIndex: 0 }]}
      .renderItem=${renderText}
    ></lr-virtual-list>
  `);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="group"]') === null).to.equal(
    true
  );
  expect(el.offsetForIndex(0)).to.equal(0);
  expect(el.offsetForIndex(2)).to.equal(80);
});

it("falls back to a group key when a group has no explicit label", async () => {
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      .items=${["a", "b"]}
      .groups=${[{ key: "Ungrouped", startIndex: 0 }]}
      .renderItem=${renderText}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();

  expect(
    el.shadowRoot!.querySelector('[part="group"]')!.textContent?.trim()
  ).to.equal("Ungrouped");
});

it('ignores null and malformed group entries while retaining valid group markers', async () => {
  const el = await fixture<LyraVirtualList>(html`
    <lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      .items=${['a', 'b']}
      .groups=${[
        null,
        { key: 'Valid', startIndex: 0 },
        undefined,
        'not-a-group',
      ] as unknown as readonly { key: string; startIndex: number }[]}
      .renderItem=${renderText}
    ></lr-virtual-list>
  `);
  await el.updateComplete;
  await nextFrame();

  const markers = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="group"]')];
  expect(markers.map((marker) => marker.textContent?.trim())).to.deep.equal(['Valid']);
  expect(el.offsetForIndex(0)).to.be.greaterThan(0);
});

it("locale-formats a numeric group key when no explicit label is supplied", async () => {
  const el = (await fixture(
    html`<lr-virtual-list
      lang="ar"
      style="--lr-virtual-list-height:200px"
      row-height="40"
      .items=${["a"]}
      .groups=${[{ key: 1234, startIndex: 0 }]}
      .renderItem=${renderText}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  expect(
    el.shadowRoot!.querySelector('[part="group"]')!.textContent?.trim()
  ).to.equal(new Intl.NumberFormat(el.lang).format(1234));
});

it("windows one-group-per-row markers instead of materializing the full catalog", async () => {
  const items = Array.from({ length: 5000 }, (_, index) => index);
  const groups = items.map((index) => ({ key: index, startIndex: index }));
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      .items=${items}
      .groups=${groups}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  await el.updateComplete;

  expect(
    el.shadowRoot!.querySelectorAll('[part="group"]').length
  ).to.be.at.most(20);
  expect(
    (el as unknown as { normalizedGroups: Array<{ startIndex: number }> })
      .normalizedGroups.length
  ).to.equal(5000);
});

describe("itemRole / rowIndexOffset", () => {
  it("defaults to listitem/list roles (unchanged from today)", async () => {
    const el = (await fixture(
      html`<lr-virtual-list style="height:100px"></lr-virtual-list>`
    )) as LyraVirtualList;
    el.items = ["a", "b"];
    el.renderItem = (item: unknown) => html`<span>${item}</span>`;
    await el.updateComplete;
    await aTimeout(0);
    expect(
      el.shadowRoot!.querySelector('[part="base"]')!.getAttribute("role")
    ).to.equal("list");
    expect(
      el.shadowRoot!.querySelector('[part="row"]')!.getAttribute("role")
    ).to.equal("listitem");
  });

  it('maps to table roles when item-role="row"', async () => {
    const el = (await fixture(
      html`<lr-virtual-list
        style="height:100px"
        item-role="row"
        row-index-offset="1"
      ></lr-virtual-list>`
    )) as LyraVirtualList;
    el.items = ["a", "b"];
    el.renderItem = (item: unknown) => html`<span>${item}</span>`;
    await el.updateComplete;
    await aTimeout(0);
    expect(
      el.shadowRoot!.querySelector('[part="base"]')!.getAttribute("role")
    ).to.equal("rowgroup");
    const firstRow = el.shadowRoot!.querySelector('[part="row"]')!;
    expect(firstRow.getAttribute("role")).to.equal("row");
    expect(firstRow.getAttribute("aria-rowindex")).to.equal("2"); // index 0 + 1 (1-based) + offset 1
    expect(firstRow.hasAttribute("aria-setsize")).to.be.false;
    expect(firstRow.hasAttribute("aria-posinset")).to.be.false;
    expect(
      el.shadowRoot!.querySelector('[part="spacer"]')!.getAttribute("role")
    ).to.equal("presentation");
  });

  it('keeps [part="base"] focusable (tabindex 0) in row mode', async () => {
    const el = (await fixture(
      html`<lr-virtual-list
        style="height:100px"
        item-role="row"
      ></lr-virtual-list>`
    )) as LyraVirtualList;
    el.items = ["a"];
    el.renderItem = (item: unknown) => html`<span>${item}</span>`;
    await el.updateComplete;
    await aTimeout(0);
    expect(
      el.shadowRoot!.querySelector('[part="base"]')!.getAttribute("tabindex")
    ).to.equal("0");
  });

  it("resize-driven row observation still works in row mode (data-row-index, not aria-posinset)", async () => {
    const el = (await fixture(
      html`<lr-virtual-list
        style="height:60px"
        item-role="row"
        row-height="auto"
      ></lr-virtual-list>`
    )) as LyraVirtualList;
    el.items = ["a", "b", "c"];
    el.renderItem = (item: unknown) => html`<span>${item}</span>`;
    await el.updateComplete;
    await aTimeout(50); // allow ResizeObserver to report real row heights and trigger a re-render
    expect(
      el.shadowRoot!.querySelectorAll('[part="row"]').length
    ).to.be.greaterThan(0);
  });

  it('sanitizes an invalid row-index-offset instead of producing aria-rowindex="NaN"', async () => {
    const cases = [
      { value: "NaN", expected: 0 },
      { value: "Infinity", expected: 0 },
      { value: "-20", expected: 0 },
      { value: "2.9", expected: 2 },
    ];
    for (const { value, expected } of cases) {
      const el = (await fixture(
        html`<lr-virtual-list
          style="height:100px"
          item-role="row"
          row-index-offset=${value}
        ></lr-virtual-list>`
      )) as LyraVirtualList;
      el.items = ["a"];
      el.renderItem = (item: unknown) => html`<span>${item}</span>`;
      await el.updateComplete;
      await aTimeout(0);
      const firstRow = el.shadowRoot!.querySelector('[part="row"]')!;
      expect(firstRow.getAttribute("aria-rowindex"), value).to.equal(
        String(1 + expected)
      );
    }
  });

  it("uses the same sanitized fallback for a direct out-of-range rowIndexOffset property assignment", async () => {
    const el = (await fixture(
      html`<lr-virtual-list
        style="height:100px"
        item-role="row"
      ></lr-virtual-list>`
    )) as LyraVirtualList;
    el.items = ["a"];
    el.renderItem = (item: unknown) => html`<span>${item}</span>`;
    el.rowIndexOffset = NaN;
    await el.updateComplete;
    await aTimeout(0);
    const firstRow = el.shadowRoot!.querySelector('[part="row"]')!;
    expect(firstRow.getAttribute("aria-rowindex")).to.equal("1");

    el.rowIndexOffset = Number.MAX_SAFE_INTEGER;
    await el.updateComplete;
    expect(firstRow.getAttribute("aria-rowindex")).to.equal(
      String(Number.MAX_SAFE_INTEGER)
    );
  });
});

describe("public offset/index queries", () => {
  /** The pixel top a row is actually rendered at, read back from its own box rather than from the
   *  component's internal state -- `[part="row"]` is absolutely positioned inside `[part="spacer"]`
   *  and shifted by `translateY(offset)`, so this difference *is* the rendered offset. */
  function renderedTop(el: LyraVirtualList, index: number): number {
    const spacer = el.shadowRoot!.querySelector(
      '[part="spacer"]'
    ) as HTMLElement;
    const row = el.shadowRoot!.querySelector<HTMLElement>(
      `[part="row"][data-row-index="${index}"]`
    )!;
    return row.getBoundingClientRect().top - spacer.getBoundingClientRect().top;
  }

  it("offsetForIndex matches the pixel top a row renders at in fixed row-height mode", async () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:200px"
        row-height="40"
        overscan="2"
        .items=${items}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lr-virtual-list>`
    )) as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();

    for (const index of [0, 1, 3]) {
      expect(el.offsetForIndex(index), `row ${index}`).to.equal(index * 40);
      expect(renderedTop(el, index), `rendered row ${index}`).to.be.closeTo(
        el.offsetForIndex(index),
        0.5
      );
    }
    // offsetForIndex(items.length) is the total content height -- the spacer's own height.
    const spacer = el.shadowRoot!.querySelector(
      '[part="spacer"]'
    ) as HTMLElement;
    expect(el.offsetForIndex(items.length)).to.equal(
      parseFloat(spacer.style.height)
    );
  });

  it('offsetForIndex matches the pixel top a row renders at in row-height="auto" mode', async () => {
    const heights = [30, 90, 55, 120, 45, 70];
    const items = heights.map((h, i) => ({ id: i, h }));
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:600px"
        .items=${items}
        .renderItem=${(item: unknown) =>
          html`<div
            style="block-size:${(item as { h: number })
              .h}px;box-sizing:border-box"
          >
            row
          </div>`}
        .keyFunction=${(item: unknown) => (item as { id: number }).id}
      ></lr-virtual-list>`
    )) as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();
    await nextFrame();
    await el.updateComplete;

    for (let i = 0; i < heights.length; i++) {
      expect(renderedTop(el, i), `rendered row ${i}`).to.be.closeTo(
        el.offsetForIndex(i),
        0.5
      );
    }
    expect(el.offsetForIndex(heights.length)).to.be.closeTo(
      heights.reduce((a, b) => a + b, 0),
      1
    );
  });

  it("clamps offsetForIndex to 0…items.length and returns 0 for an empty list", async () => {
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:200px"
        row-height="40"
        .items=${[1, 2, 3]}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lr-virtual-list>`
    )) as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();
    expect(el.offsetForIndex(-10)).to.equal(0);
    expect(el.offsetForIndex(999)).to.equal(120); // clamped to items.length -> total height
    expect(el.offsetForIndex(NaN)).to.equal(0);

    el.items = [];
    await el.updateComplete;
    expect(el.offsetForIndex(0)).to.equal(0);
  });

  it("saturates cumulative fixed-row offsets instead of serializing Infinitypx", async () => {
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:200px"
        row-height=${Number.MAX_VALUE}
        .items=${[1, 2, 3]}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lr-virtual-list>`
    )) as LyraVirtualList;
    await el.updateComplete;

    const offsets = [0, 1, 2, 3].map((index) => el.offsetForIndex(index));
    expect(offsets.every(Number.isFinite)).to.be.true;
    expect(offsets).to.deep.equal([
      0,
      Number.MAX_VALUE,
      Number.MAX_VALUE,
      Number.MAX_VALUE,
    ]);
    const spacer = el.shadowRoot!.querySelector(
      '[part="spacer"]'
    ) as HTMLElement;
    expect(spacer.getAttribute("style")).to.not.contain("Infinity");
  });

  it("indexAtOffset round-trips offsetForIndex for every index in a mixed-height list", async () => {
    const heights = [30, 90, 55, 120, 45, 70];
    const items = heights.map((h, i) => ({ id: i, h }));
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:600px"
        .items=${items}
        .renderItem=${(item: unknown) =>
          html`<div
            style="block-size:${(item as { h: number })
              .h}px;box-sizing:border-box"
          >
            row
          </div>`}
        .keyFunction=${(item: unknown) => (item as { id: number }).id}
      ></lr-virtual-list>`
    )) as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();
    await nextFrame();
    await el.updateComplete;

    for (let i = 0; i < heights.length; i++) {
      expect(
        el.indexAtOffset(el.offsetForIndex(i)),
        `round trip ${i}`
      ).to.equal(i);
      // A point strictly inside the row's box resolves to the same row.
      expect(
        el.indexAtOffset(el.offsetForIndex(i) + 1),
        `inside ${i}`
      ).to.equal(i);
    }
  });

  it("clears auto-height measurements when keyFunction changes row identities", async () => {
    const items = [
      { id: "first", height: 30 },
      { id: "second", height: 90 },
    ];
    const renderMeasured = (item: unknown) => {
      const value = item as (typeof items)[number];
      return html`<div style="block-size:${value.height}px;box-sizing:border-box">
        row
      </div>`;
    };
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:200px"
        .items=${items}
        .renderItem=${renderMeasured}
        .keyFunction=${(item: unknown) => (item as (typeof items)[number]).id}
      ></lr-virtual-list>`
    )) as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();
    await nextFrame();
    await el.updateComplete;

    const measuredHeights = (
      el as unknown as { measuredHeights: Map<string, number> }
    ).measuredHeights;
    expect(measuredHeights.size).to.be.greaterThan(0);

    // Reuse the old second-row key for the first row. Without invalidation, its 90px measurement
    // is applied to the first row even though the new key function identifies a different row.
    el.keyFunction = (item: unknown) =>
      (item as (typeof items)[number]).id === "first" ? "second" : "third";
    await el.updateComplete;

    expect(measuredHeights.size).to.equal(0);
  });

  it("clamps indexAtOffset and reports -1 for an empty list", async () => {
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:200px"
        row-height="40"
        .items=${[1, 2, 3]}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lr-virtual-list>`
    )) as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();
    expect(el.indexAtOffset(-500)).to.equal(0);
    expect(el.indexAtOffset(99999)).to.equal(2);
    expect(el.indexAtOffset(Infinity)).to.equal(2);
    expect(el.indexAtOffset(NaN)).to.equal(0);

    el.items = [];
    await el.updateComplete;
    expect(el.indexAtOffset(0)).to.equal(-1);
  });
});

describe("public scroll container and lr-virtual-scroll", () => {
  async function scrollFixture(): Promise<LyraVirtualList> {
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:200px"
        row-height="40"
        overscan="0"
        .items=${Array.from({ length: 100 }, (_, i) => i)}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lr-virtual-list>`
    )) as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();
    return el;
  }

  it('exposes [part="base"] as the public scrollContainer', async () => {
    const el = await scrollFixture();
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    // Compared as a boolean: a failing DOM-node assertion hangs the whole file under wtr.
    expect(
      el.scrollContainer === base,
      'scrollContainer should be the [part="base"] element'
    ).to.be.true;
    expect(el.scrollContainer!.getAttribute("part")).to.equal("base");
  });

  it("reports scrollContainer as undefined before the first render", () => {
    const el = document.createElement("lr-virtual-list") as LyraVirtualList;
    expect(
      el.scrollContainer === undefined,
      "no scroll container exists before first render"
    ).to.be.true;
  });

  it("coalesces a burst of scroll events within one frame into exactly one lr-virtual-scroll", async () => {
    const el = await scrollFixture();
    const base = el.scrollContainer!;
    const details: { scrollTop: number; viewportHeight: number }[] = [];
    let legacyEvents = 0;
    el.addEventListener("lr-virtual-scroll", (e) =>
      details.push((e as CustomEvent).detail)
    );
    el.addEventListener("lr-scroll", () => legacyEvents++);

    base.scrollTop = 100;
    base.dispatchEvent(new Event("scroll"));
    base.scrollTop = 260;
    base.dispatchEvent(new Event("scroll"));
    base.scrollTop = 375;
    base.dispatchEvent(new Event("scroll"));
    await nextFrame();
    await el.updateComplete;

    expect(
      details.length,
      "three scroll events in one frame produce one lr-virtual-scroll"
    ).to.equal(1);
    expect(details[0]!.scrollTop).to.equal(base.scrollTop);
    expect(details[0]!.scrollTop).to.equal(375);
    expect(details[0]!.viewportHeight).to.be.closeTo(base.clientHeight, 1);
    expect(legacyEvents, "the scroller event name is not aliased").to.equal(0);
  });

  it("reports sub-row scroll deltas that never change the visible index range", async () => {
    // 210px viewport over 40px rows: both the top and the bottom edge sit strictly inside a row's
    // box, so a few pixels of movement cannot pull a new row into the visible range.
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:210px"
        row-height="40"
        overscan="0"
        .items=${Array.from({ length: 100 }, (_, i) => i)}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lr-virtual-list>`
    )) as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();
    const base = el.scrollContainer!;
    let scrollEvents = 0;
    let rangeEvents = 0;
    el.addEventListener("lr-virtual-scroll", () => scrollEvents++);
    el.addEventListener("lr-visible-range-change", () => rangeEvents++);

    // 3px: far less than the 40px row height, so the rendered index range cannot change.
    base.scrollTop = 3;
    base.dispatchEvent(new Event("scroll"));
    await nextFrame();
    await el.updateComplete;

    expect(scrollEvents, "lr-virtual-scroll tracks sub-row movement").to.equal(
      1
    );
    expect(
      rangeEvents,
      "lr-visible-range-change is not a substitute"
    ).to.equal(0);
  });

  it("does not fire lr-virtual-scroll when nothing actually scrolled", async () => {
    const el = await scrollFixture();
    const base = el.scrollContainer!;
    let count = 0;
    el.addEventListener("lr-virtual-scroll", () => count++);

    base.dispatchEvent(new Event("scroll")); // scrollTop still 0
    await nextFrame();
    await el.updateComplete;
    expect(count).to.equal(0);

    base.scrollTop = 120;
    base.dispatchEvent(new Event("scroll"));
    await nextFrame();
    await el.updateComplete;
    expect(count).to.equal(1);

    base.dispatchEvent(new Event("scroll")); // same position again
    await nextFrame();
    await el.updateComplete;
    expect(
      count,
      "a repeat scroll event at an unchanged position is not a scroll"
    ).to.equal(1);
  });
});

describe("renderedRows", () => {
  it("returns the currently-rendered row wrappers in item order, and never the sticky overlay", async () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:200px"
        row-height="40"
        overscan="0"
        .items=${items}
        .groups=${[{ key: "g", label: "", startIndex: 0 }]}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
        .renderStickyGroup=${() => html`<div>pinned</div>`}
      ></lr-virtual-list>`
    )) as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();

    const rows = el.renderedRows;
    expect(rows.length).to.equal(
      el.shadowRoot!.querySelectorAll('[part="row"]').length
    );
    expect(rows.length).to.be.greaterThan(1);
    expect(rows.every((row) => row.getAttribute("part") === "row")).to.be.true;
    expect(rows.map((row) => Number(row.dataset['rowIndex']))).to.deep.equal(
      rows.map((_, i) => i + Number(rows[0]!.dataset['rowIndex']))
    );

    // Windowed, not the whole collection -- and it tracks the window as it moves.
    expect(rows.length).to.be.lessThan(items.length);
    el.scrollContainer!.scrollTop = 1600;
    el.scrollContainer!.dispatchEvent(new Event("scroll"));
    await nextFrame();
    await el.updateComplete;
    expect(Number(el.renderedRows[0]!.dataset['rowIndex'])).to.equal(40);
  });

  it("is empty before the first render", () => {
    const el = document.createElement("lr-virtual-list") as LyraVirtualList;
    expect(el.renderedRows.length).to.equal(0);
  });
});

describe("sticky group overlay", () => {
  const STICKY_HEIGHT = 32;
  const ROW = 40;
  const groups = [
    { key: "Group A", label: "", startIndex: 5 },
    { key: "Group B", label: "", startIndex: 20 },
    { key: "Group C", label: "", startIndex: 40 },
  ];
  const items = Array.from({ length: 60 }, (_, i) => i);

  // Mirrors what a real consumer does: the group header is an ordinary row that owns the heading
  // semantics, and the sticky copy repeats the same markup.
  const renderGroupAwareRow = (item: unknown, index: number) =>
    groups.some((group) => group.startIndex === index)
      ? html`<div
          role="heading"
          aria-level="2"
          style="block-size:${ROW}px;box-sizing:border-box"
        >
          ${groups.find((group) => group.startIndex === index)!.key}
        </div>`
      : html`item ${item}#${index}`;

  /** A row whose height is explicit, so `row-height="auto"` measurement settles in one pass. */
  const measuredRow = (item: unknown, index: number) =>
    html`<div style="block-size:${ROW}px;box-sizing:border-box">
      item ${item}#${index}
    </div>`;

  const renderSticky = (group: {
    key: string | number;
    label?: string;
  }) => html`
    <div
      class="sticky-copy"
      role="heading"
      aria-level="2"
      style="block-size:${STICKY_HEIGHT}px;box-sizing:border-box;background:var(--lr-color-surface)"
    >
      <button type="button" class="sticky-button">
        ${group.label || group.key}
      </button>
    </div>
  `;

  async function mount(
    sticky: boolean,
    extra: {
      rowHeight?: string;
      groups?: typeof groups;
      items?: unknown[];
      renderItem?: (item: unknown, index: number) => unknown;
      renderStickyGroup?: (group: (typeof groups)[number]) => unknown;
    } = {}
  ): Promise<LyraVirtualList> {
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:200px"
        row-height=${extra.rowHeight ?? String(ROW)}
        overscan="0"
        .items=${extra.items ?? items}
        .groups=${extra.groups ?? groups}
        .renderItem=${extra.renderItem ?? renderGroupAwareRow}
        .keyFunction=${numberKey}
        .renderStickyGroup=${extra.renderStickyGroup ??
        (sticky ? renderSticky : undefined)}
      ></lr-virtual-list>`
    )) as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();
    await nextFrame();
    await el.updateComplete;
    return el;
  }

  async function scrollTo(el: LyraVirtualList, top: number): Promise<void> {
    const base = el.scrollContainer!;
    base.scrollTop = top;
    base.dispatchEvent(new Event("scroll"));
    await nextFrame();
    await el.updateComplete;
    await nextFrame();
    await el.updateComplete;
  }

  function overlay(el: LyraVirtualList): HTMLElement | null {
    return el.shadowRoot!.querySelector<HTMLElement>('[part~="sticky-group"]');
  }

  /** Every element in the shadow tree, as `tag[sorted attributes]` -- a byte-level record of the
   *  rendered output that a shifted row transform or a stray attribute would change. */
  function elementOutline(el: LyraVirtualList): string[] {
    return [...el.shadowRoot!.querySelectorAll("*")].map(
      (node) =>
        `${node.localName}[${[...node.attributes]
          .map((attr) => `${attr.name}="${attr.value}"`)
          .sort()
          .join(" ")}]`
    );
  }

  /** The scroll inset on `[part="base"]` is the one documented, deliberate difference the sticky
   *  layer makes outside its own subtree; it is asserted on its own, so it is normalized away here. */
  function withoutScrollInset(outline: string[]): string[] {
    return outline.map((entry) =>
      entry.replace(/ ?style="scroll-padding-block-start:[^"]*"/, "")
    );
  }

  it("renders no sticky layer or scroll inset when only renderStickyGroup is configured", async () => {
    const el = await mount(true, { groups: [] });

    expect(overlay(el) === null).to.be.true;
    expect(el.scrollContainer!.style.scrollPaddingBlockStart).to.equal("");
  });

  it("renders no overlay at all, and output identical to the no-callback render, while renderStickyGroup is unset", async () => {
    const plain = await mount(false);
    const withSticky = await mount(true);
    // Same scroll position for both, deep inside Group A, so the overlay is definitely rendered in
    // the second one and the two are otherwise in exactly the same state.
    await scrollTo(plain, 10 * ROW);
    await scrollTo(withSticky, 10 * ROW);

    expect(
      overlay(plain) === null,
      "no overlay element without renderStickyGroup"
    ).to.be.true;
    expect(
      plain.shadowRoot!.querySelectorAll('[part~="sticky-group"]').length
    ).to.equal(0);

    const plainOutline = elementOutline(plain);
    const stickyOutline = elementOutline(withSticky);
    // The *only* difference the overlay makes is the overlay subtree itself: every other element,
    // attribute, and row transform is byte-identical.
    const stickyIds = new Set<number>();
    stickyOutline.forEach((entry, i) => {
      if (
        entry.includes("sticky-group") ||
        entry.includes("sticky-copy") ||
        entry.includes("sticky-button")
      ) {
        stickyIds.add(i);
      }
    });
    expect(stickyIds.size, "overlay renders exactly its own subtree").to.equal(
      3
    );
    expect(
      withoutScrollInset(stickyOutline.filter((_, i) => !stickyIds.has(i)))
    ).to.deep.equal(withoutScrollInset(plainOutline));
    expect(
      plain.scrollContainer!.hasAttribute("style"),
      "no inline style without the sticky layer"
    ).to.be.false;
    expect(withSticky.scrollContainer!.getAttribute("style")).to.equal(
      `scroll-padding-block-start:${STICKY_HEIGHT}px`
    );
  });

  it('keeps total content height identical with and without the overlay in row-height="auto" mode', async () => {
    // Group A starts at row 0 so the overlay is pinned from the very first frame -- no scrolling,
    // and therefore no interleaving of measurement with window changes.
    const autoGroups = [{ key: "a", label: "Group A", startIndex: 0 }];
    const autoItems = Array.from({ length: 20 }, (_, i) => i);
    // Explicit-height row content so measurement converges in a single pass instead of cascading.
    const autoRow = {
      rowHeight: "auto",
      groups: autoGroups,
      items: autoItems,
      renderItem: measuredRow,
    };
    const plain = await mount(false, autoRow);
    const withSticky = await mount(true, autoRow);
    expect(
      overlay(withSticky) === null,
      "overlay is rendered for this assertion to mean anything"
    ).to.be.false;

    // The overlay is a *copy* of a header that also exists as a real row. If it were measured, or
    // counted in offsets, the content height would grow by its own height.
    expect(withSticky.offsetForIndex(autoItems.length)).to.equal(
      plain.offsetForIndex(autoItems.length)
    );
    const spacer = withSticky.shadowRoot!.querySelector(
      '[part="spacer"]'
    ) as HTMLElement;
    expect(parseFloat(spacer.style.height)).to.equal(
      plain.offsetForIndex(autoItems.length)
    );
  });

  it("never hands the overlay to the row ResizeObserver", async () => {
    const el = await mount(true, {
      rowHeight: "auto",
      groups: [{ key: "a", label: "Group A", startIndex: 0 }],
      items: Array.from({ length: 20 }, (_, i) => i),
      renderItem: measuredRow,
    });
    expect(overlay(el) === null, "overlay is present").to.be.false;
    const observed = (
      el as unknown as { observedRows: Map<unknown, HTMLElement> }
    ).observedRows;
    const rows = el.shadowRoot!.querySelectorAll('[part="row"]').length;
    expect(rows).to.be.greaterThan(0);
    expect(observed.size).to.equal(rows);
    expect(
      [...observed.values()].some((node) =>
        node.getAttribute("part")?.includes("sticky")
      )
    ).to.be.false;
  });

  it("pins the group whose header has scrolled past the top, and swaps it at the next group", async () => {
    const el = await mount(true);
    const base = el.scrollContainer!;

    // Above the first group's start index -- nothing is pinned yet, so nothing is shown. The band
    // element itself stays mounted (hidden) purely so its height remains measurable.
    await scrollTo(el, 0);
    expect(
      getComputedStyle(overlay(el)!).visibility,
      "no sticky header above the first group"
    ).to.equal("hidden");

    // Inside Group A (rows 5..19).
    await scrollTo(el, 10 * ROW);
    expect(getComputedStyle(overlay(el)!).visibility).to.equal("visible");
    expect(overlay(el)!.textContent).to.contain("Group A");
    expect(overlay(el)!.getBoundingClientRect().top).to.be.closeTo(
      base.getBoundingClientRect().top,
      1
    );

    // Still inside Group A, much further down: still pinned to the viewport top.
    await scrollTo(el, 18 * ROW);
    expect(overlay(el)!.textContent).to.contain("Group A");
    expect(overlay(el)!.getBoundingClientRect().top).to.be.closeTo(
      base.getBoundingClientRect().top,
      1
    );

    // Into Group B (rows 20..39).
    await scrollTo(el, 25 * ROW);
    expect(overlay(el)!.textContent).to.contain("Group B");

    await scrollTo(el, 45 * ROW);
    expect(overlay(el)!.textContent).to.contain("Group C");
  });

  it("pushes the pinned header off as the next group header arrives, instead of swapping abruptly", async () => {
    const el = await mount(true);
    const base = el.scrollContainer!;
    const viewportTop = () => base.getBoundingClientRect().top;

    // Group B starts at row 20 (offset 800). Scroll so its header row is 8px below the viewport
    // top -- less than the 32px sticky band, so Group A's pinned header must be riding up.
    await scrollTo(el, 20 * ROW - 8);
    const pushed = overlay(el)!;
    expect(pushed.textContent).to.contain("Group A");
    const pushedTop = pushed.getBoundingClientRect().top - viewportTop();
    expect(pushedTop, "pushed up by the overlap").to.be.closeTo(
      8 - STICKY_HEIGHT,
      1.5
    );

    // Halfway through the push-off it is less displaced.
    await scrollTo(el, 20 * ROW - 24);
    const partly = overlay(el)!.getBoundingClientRect().top - viewportTop();
    expect(partly).to.be.greaterThan(pushedTop);
    expect(partly).to.be.closeTo(24 - STICKY_HEIGHT, 1.5);

    // Far enough above the next group and there is no push at all.
    await scrollTo(el, 15 * ROW);
    expect(
      overlay(el)!.getBoundingClientRect().top - viewportTop()
    ).to.be.closeTo(0, 1);
  });

  it("is aria-hidden and inert without mutating caller focus metadata", async () => {
    const el = await mount(true);
    // Group A's real header row sits exactly at the viewport top here, so the real header and the
    // pinned copy are both in the DOM at once -- the only state in which a duplicate heading or a
    // duplicate tab stop can exist at all.
    await scrollTo(el, 5 * ROW);

    const copy = overlay(el)!;
    expect(copy.getAttribute("aria-hidden")).to.equal("true");
    expect(copy.hasAttribute("inert")).to.equal(true);

    // `inert` owns focus exclusion without rewriting the consumer callback's button contract.
    const stickyButton = copy.querySelector<HTMLElement>(".sticky-button")!;
    expect(stickyButton.tabIndex).to.equal(0);
    stickyButton.focus();
    expect(el.shadowRoot!.activeElement === stickyButton).to.equal(false);

    const headings = [...el.shadowRoot!.querySelectorAll('[role="heading"]')];
    expect(
      headings.length,
      "both the real header row and the copy carry heading markup"
    ).to.equal(2);
    // ...but only the real row's is exposed: the copy is out of the accessibility tree entirely.
    expect(
      headings.filter((node) => node.closest('[aria-hidden="true"]') === null)
        .length
    ).to.equal(1);
    expect(
      copy.closest('[aria-hidden="true"]') === copy,
      "the copy itself carries the aria-hidden"
    ).to.be.true;
  });

  it("makes an open-shadow control inert without traversing or rewriting its tabindex", async () => {
    const tagName = "test-sticky-shadow-control";
    if (!customElements.get(tagName)) {
      customElements.define(
        tagName,
        class extends HTMLElement {
          constructor() {
            super();
            const root = this.attachShadow({
              mode: "open",
              delegatesFocus: true,
            });
            root.innerHTML = '<button type="button">Shadow action</button>';
          }
        }
      );
    }

    const el = await mount(true, {
      renderStickyGroup: (group) =>
        html`<div
          role="heading"
          aria-level="2"
          style="block-size:${STICKY_HEIGHT}px"
        >
          ${group.label}<test-sticky-shadow-control
          ></test-sticky-shadow-control>
        </div>`,
    });
    await scrollTo(el, 10 * ROW);

    const customControl = overlay(el)!.querySelector<HTMLElement>(tagName)!;
    const shadowButton =
      customControl.shadowRoot!.querySelector<HTMLButtonElement>("button")!;
    expect(shadowButton.tabIndex).to.equal(0);
    shadowButton.focus();
    expect(customControl.shadowRoot!.activeElement === shadowButton).to.equal(
      false
    );
  });

  it("keeps later shadow content inert without observing or mutating it", async () => {
    const tagName = "test-async-sticky-shadow-control";
    if (!customElements.get(tagName)) {
      customElements.define(
        tagName,
        class extends HTMLElement {
          constructor() {
            super();
            this.attachShadow({ mode: "open", delegatesFocus: true });
          }

          connectedCallback(): void {
            queueMicrotask(() => this.renderAction("Initial action"));
          }

          renderAction(label: string): void {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = label;
            this.shadowRoot!.replaceChildren(button);
          }
        }
      );
    }

    const el = await mount(true, {
      renderStickyGroup: (group) =>
        html`<div
          role="heading"
          aria-level="2"
          style="block-size:${STICKY_HEIGHT}px"
        >
          ${group.label}<test-async-sticky-shadow-control
          ></test-async-sticky-shadow-control>
        </div>`,
    });
    await scrollTo(el, 10 * ROW);
    await aTimeout(0);

    const customControl = overlay(el)!.querySelector<HTMLElement>(
      tagName
    ) as HTMLElement & { renderAction(label: string): void };
    const firstButton =
      customControl.shadowRoot!.querySelector<HTMLButtonElement>("button")!;
    expect(firstButton.tabIndex).to.equal(0);

    customControl.renderAction("Replacement action");
    await aTimeout(0);
    const replacementButton =
      customControl.shadowRoot!.querySelector<HTMLButtonElement>("button")!;
    expect(replacementButton !== firstButton).to.equal(true);
    expect(replacementButton.tabIndex).to.equal(0);
    replacementButton.focus();
    expect(
      customControl.shadowRoot!.activeElement === replacementButton
    ).to.equal(false);
  });

  it("is pointer-transparent and inert even if a part rule changes its paint hit-testing", async () => {
    const el = await mount(true);
    await scrollTo(el, 10 * ROW);
    const copy = overlay(el)!;
    expect(getComputedStyle(copy).pointerEvents).to.equal("none");

    const rect = copy.getBoundingClientRect();
    const hitDefault = el.shadowRoot!.elementFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2
    );
    expect(
      hitDefault?.closest('[part~="sticky-group"]') === null,
      "clicks pass through by default"
    ).to.be.true;

    const style = document.createElement("style");
    style.textContent =
      "lr-virtual-list::part(sticky-group) { pointer-events: auto; }";
    document.head.append(style);
    try {
      expect(getComputedStyle(copy).pointerEvents).to.equal("auto");
      let activations = 0;
      const stickyButton = copy.querySelector<HTMLButtonElement>("button")!;
      stickyButton.addEventListener("click", () => activations++);
      await sendMouse({
        type: "click",
        position: [
          Math.round(rect.left + rect.width / 2),
          Math.round(rect.top + rect.height / 2),
        ],
      });
      // `sendMouse` resolves when the synthesized click command completes, not when the browser
      // delivered the native events it produces -- so a click that DID activate the inert copy
      // would read as zero here too. Settle two frames first (test/wtr-mouse.ts).
      await settlePointer();
      expect(
        activations,
        "inert suppresses activation without mutating the button"
      ).to.equal(0);
    } finally {
      style.remove();
      await resetMouse();
    }
  });

  it("treats an empty group label as a position anchor: no marker, but it still drives the overlay", async () => {
    const anchorGroups = [
      { key: "a", label: "", startIndex: 5 },
      { key: "b", label: "", startIndex: 20 },
    ];
    const el = await mount(true, { groups: anchorGroups });
    expect(
      el.shadowRoot!.querySelectorAll('[part="group"]').length,
      "no duplicate marker"
    ).to.equal(0);

    await scrollTo(el, 10 * ROW);
    const copy = overlay(el);
    expect(copy === null, "the anchor still pins a sticky header").to.be.false;
    expect(copy!.getBoundingClientRect().top).to.be.closeTo(
      el.scrollContainer!.getBoundingClientRect().top,
      1
    );

    // An omitted label still falls back to the key, exactly as before.
    el.groups = [{ key: "Ungrouped", startIndex: 5 }];
    await el.updateComplete;
    await scrollTo(el, 5 * ROW);
    expect(
      el.shadowRoot!.querySelector('[part="group"]')!.textContent?.trim()
    ).to.equal("Ungrouped");
  });

  describe("scroll inset for the sticky band", () => {
    let originalMatchMedia: typeof window.matchMedia;

    beforeEach(() => {
      originalMatchMedia = window.matchMedia;
      // Reduced motion forces every scroll to land synchronously instead of animating.
      window.matchMedia = ((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      })) as unknown as typeof window.matchMedia;
    });

    afterEach(() => {
      window.matchMedia = originalMatchMedia;
    });

    it('lands an active-item-id row below the sticky band instead of behind it', async () => {
      const el = await mount(true);
      const base = el.scrollContainer!;
      expect(getComputedStyle(base).scrollPaddingBlockStart).to.equal(
        `${STICKY_HEIGHT}px`
      );

      // Start below the target so the scroll-into-view runs *upward*: that is the direction that
      // aligns the row's top edge, and therefore the one the band can hide it behind.
      await scrollTo(el, 900);
      el.activeItemId = 20; // Group B's first row, offset 800
      await el.updateComplete;
      await nextFrame();
      await el.updateComplete;
      await nextFrame();

      const band = overlay(el)!;
      const row = el.shadowRoot!.querySelector<HTMLElement>(
        '[part="row"][data-row-index="20"]'
      )!;
      expect(
        base.scrollTop,
        "the inset is subtracted from the top-aligned target"
      ).to.equal(20 * ROW - STICKY_HEIGHT);
      expect(row.getBoundingClientRect().top).to.be.gte(
        band.getBoundingClientRect().bottom - 0.5
      );
    });

    it("applies the same inset to scrollToIndex", async () => {
      const el = await mount(true);
      const base = el.scrollContainer!;
      el.scrollToIndex(20, { align: "start", behavior: "auto" });
      await nextFrame();
      expect(base.scrollTop).to.equal(20 * ROW - STICKY_HEIGHT);

      // `align: 'end'` targets the bottom edge, which the top band does not obscure.
      el.scrollToIndex(0, { align: "start", behavior: "auto" });
      await nextFrame();
      el.scrollToIndex(20, { align: "end", behavior: "auto" });
      await nextFrame();
      expect(base.scrollTop).to.equal(21 * ROW - 200);
    });

    it("leaves both scroll paths exactly as they are when renderStickyGroup is unset", async () => {
      const el = await mount(false);
      const base = el.scrollContainer!;
      expect(
        getComputedStyle(base).scrollPaddingBlockStart,
        "the initial value, untouched"
      ).to.equal("auto");
      expect(
        base.hasAttribute("style"),
        "no inline style at all without the sticky layer"
      ).to.be.false;

      el.scrollToIndex(20, { align: "start", behavior: "auto" });
      await nextFrame();
      expect(base.scrollTop).to.equal(20 * ROW);

      await scrollTo(el, 900);
      el.activeItemId = 20;
      await el.updateComplete;
      await nextFrame();
      expect(
        base.scrollTop,
        "the row lands flush with the viewport top, exactly as before"
      ).to.equal(20 * ROW);
    });
  });

  it("is accessible with the overlay present", async () => {
    const el = await mount(true);
    await scrollTo(el, 10 * ROW);
    expect(overlay(el) === null, "overlay is present for the axe run").to.be
      .false;
    await expect(el).to.be.accessible();
  });
});

describe("row stacking context", () => {
  // Every [part="row"] is its own stacking context (`will-change: transform`), so a popup opened
  // from inside a row -- an lr-menu dropdown at z-index 900, say -- can never paint above a *later*
  // row: 900 only orders siblings inside the row's own context, and rows themselves paint in DOM
  // order at z-index auto. The failure is invisible in a small fixture because the last row has
  // nothing painting after it, so these fixtures deliberately probe an *earlier* row.
  const ROW_HEIGHT = 40;
  const POPUP_TOP = 30;
  const POPUP_HEIGHT = 30;
  // 10px below row N's own bottom edge, i.e. inside row N+1's box and inside row N's popup.
  const PROBE_OFFSET = ROW_HEIGHT + 10;

  /** A row that owns a focusable control plus an absolutely-positioned overlay (a stand-in for a
   *  menu/tooltip popup) that deliberately overflows down into the following row's box. */
  const renderPopupRow = (item: unknown) => html`
    <button
      id="btn-${item}"
      type="button"
      style="display:block;box-sizing:border-box;margin:0;padding:0;inline-size:100%;block-size:${ROW_HEIGHT}px"
    >
      row ${item}
    </button>
    <div
      id="popup-${item}"
      style="position:absolute;inset-inline-start:0;inset-block-start:${POPUP_TOP}px;inline-size:100%;block-size:${POPUP_HEIGHT}px;background:#123456"
    ></div>
  `;

  async function popupListFixture(): Promise<LyraVirtualList> {
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:200px"
        row-height=${ROW_HEIGHT}
        .items=${["1", "2", "3", "4"]}
        .renderItem=${renderPopupRow}
        .keyFunction=${stringKey}
      ></lr-virtual-list>`
    )) as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();
    return el;
  }

  /** The id of the top-most element at a point, resolved inside the list's own shadow tree.
   *  Deliberately returns a string, never the node: a failed `expect(node).to.equal(node)` hangs
   *  the whole file under wtr. */
  function topmostIdAt(el: LyraVirtualList, offsetFromListTop: number): string {
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    const rect = base.getBoundingClientRect();
    const hit = el.shadowRoot!.elementFromPoint(
      rect.left + rect.width / 2,
      rect.top + offsetFromListTop
    );
    return (
      hit?.id || (hit as HTMLElement | null)?.getAttribute?.("part") || "none"
    );
  }

  it("paints a focused row's overflowing popup above the following rows", async () => {
    const el = await popupListFixture();
    // Baseline: nothing focused, so row 2 legitimately paints over row 1's overlay.
    expect(topmostIdAt(el, PROBE_OFFSET)).to.equal("btn-2");

    const firstButton =
      el.shadowRoot!.querySelector<HTMLButtonElement>("#btn-1")!;
    firstButton.focus();
    expect(el.shadowRoot!.activeElement?.id).to.equal("btn-1");
    await el.updateComplete;

    expect(topmostIdAt(el, PROBE_OFFSET)).to.equal("popup-1");
  });

  it("lifts only the focused row, leaving every other row at the default layer", async () => {
    const el = await popupListFixture();
    const rows = [
      ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="row"]'),
    ];
    expect(rows.length).to.be.greaterThan(2);
    for (const row of rows)
      expect(getComputedStyle(row).zIndex).to.equal("auto");

    el.shadowRoot!.querySelector<HTMLButtonElement>("#btn-1")!.focus();
    await el.updateComplete;

    expect(getComputedStyle(rows[0]!).zIndex).to.equal("1");
    for (const row of rows.slice(1))
      expect(getComputedStyle(row).zIndex).to.equal("auto");
  });

  it("puts a focused row on the same layer as a group header, not above or below it", async () => {
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:200px"
        row-height=${ROW_HEIGHT}
        .items=${["1", "2", "3", "4"]}
        .renderItem=${renderPopupRow}
        .keyFunction=${stringKey}
        .groups=${[{ key: "g", label: "Group", startIndex: 0 }]}
      ></lr-virtual-list>`
    )) as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();

    el.shadowRoot!.querySelector<HTMLButtonElement>("#btn-1")!.focus();
    await el.updateComplete;

    const group = el.shadowRoot!.querySelector<HTMLElement>('[part="group"]')!;
    const focusedRow =
      el.shadowRoot!.querySelector<HTMLElement>('[part="row"]')!;
    expect(getComputedStyle(focusedRow).zIndex).to.equal(
      getComputedStyle(group).zIndex
    );
  });
});

it("clamps a non-finite scrollToIndex instead of silently discarding the scroll position", async () => {
  const items = Array.from({ length: 50 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      overscan="0"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  el.scrollToIndex(20, { align: "start", behavior: "auto" });
  await nextFrame();
  expect(base.scrollTop).to.equal(800);

  // NaN passes a range-only clamp -- both comparisons are false -- so an unguarded implementation
  // resolves offsets[NaN] to 0 and scrolls the list back to the very top, discarding the user's
  // position, while parking a pendingScrollCorrection whose identity can never resolve.
  el.scrollToIndex(Number.NaN, { align: "start", behavior: "auto" });
  await nextFrame();
  expect(base.scrollTop, "NaN clamps to index 0, not to a NaN offset").to.equal(
    0
  );
  expect(Number.isFinite(base.scrollTop)).to.be.true;
});

it('does not rescan the whole items array for active-item-id on every scroll frame', async () => {
  // `activeItemId` resolves to an index by scanning `items` with `keyOf`. `render()` re-runs on every
  // scroll frame (`listScrollTop` is reactive state), so an unmemoized scan is O(items) per frame
  // -- on a 50k-row list that is 50k `keyFunction` calls per frame, in 10 consumer components.
  let keyCalls = 0;
  const countingKey = (item: unknown) => {
    keyCalls++;
    return item as number;
  };
  const items = Array.from({ length: 5000 }, (_, i) => i);
  // Fixed `row-height` + `overscan="0"`: no dynamic row measurement, so this stays off the
  // ResizeObserver-loop path a 5000-row auto-measured list would otherwise trip.
  const el = (await fixture(html`
    <lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      overscan="0"
      active-item-id="4900"
      .items=${items}
      .keyFunction=${countingKey}
      .renderItem=${renderText}
    ></lr-virtual-list>
  `)) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();

  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  keyCalls = 0;

  // Ten scroll frames. Neither `items` nor `activeItemId` changes, so the resolved index cannot have
  // changed either -- the scan must not repeat.
  for (let frame = 0; frame < 10; frame++) {
    base.scrollTop = 100 + frame * 40;
    base.dispatchEvent(new Event("scroll"));
    await nextFrame();
    await el.updateComplete;
  }

  // Rendering the visible window legitimately calls keyOf per *rendered* row (a few dozen), so
  // this is a generous ceiling that still fails hard on a full 5000-row rescan per frame.
  expect(
    keyCalls,
    `keyFunction ran ${keyCalls} times across 10 scroll frames of a 5000-item list`
  ).to.be.lessThan(2000);
});

it("never trips Chromium's resize-observation loop guard while measuring rows and re-windowing", async () => {
  // Measuring a row rebuilds `offsets` and re-renders synchronously (from the microtask the row
  // ResizeObserver callback's `requestUpdate()` queues), which moves the window and therefore
  // `observe()`s the rows that just entered it. A brand-new observation is always active, and the
  // resize-observation loop has already broadcast that DOM depth for this frame, so the browser
  // marks it skipped and dispatches an uncaught `ErrorEvent` reading "ResizeObserver loop completed
  // with undelivered notifications". The harness turns any uncaught page error into a failure of
  // whichever test happens to be running, which is why this surfaced as unattributable flake across
  // this component's consumers rather than as a failure here.
  const roErrors: string[] = [];
  const captureRoError = (e: ErrorEvent): void => {
    if (
      typeof e.message === "string" &&
      e.message.includes("ResizeObserver loop")
    ) {
      roErrors.push(e.message);
      // Kept from failing an unrelated concurrently-running test either way; the assertion below
      // is what actually reports it.
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };
  window.addEventListener("error", captureRoError, true);
  try {
    const items = Array.from({ length: 400 }, (_, i) => i);
    // Real heights spread far from DEFAULT_ROW_ESTIMATE_PX, so every measurement genuinely moves
    // the offsets and the window with them.
    const renderTall = (item: unknown, index: number) =>
      html`<div style="padding:${(index % 7) * 9}px">
        ${"row ".repeat((index % 11) + 1)}${item}
      </div>`;
    const el = (await fixture(html`
      <lr-virtual-list
        style="--lr-virtual-list-height:200px;width:300px"
        .items=${items}
        .renderItem=${renderTall}
        .keyFunction=${numberKey}
      ></lr-virtual-list>
    `)) as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();

    const base = el.scrollContainer!;
    // Scroll *and* mutate `items` in the same tick, then advance exactly *one* frame -- the
    // component's own two-frame settling budget (`nextFrame()`) is precisely what hides this, so
    // waiting it out here would test the quiescent case instead of the contended one this
    // reproduces.
    const oneFrame = () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    for (let step = 0; step < 15; step++) {
      base.scrollTop = 3000 + step * 500;
      base.dispatchEvent(new Event("scroll"));
      el.items = items.slice(0, 400 - step);
      await el.updateComplete;
      await oneFrame();
    }
    await nextFrame();

    expect(
      roErrors.length,
      `dispatched ${roErrors.length} "ResizeObserver loop" errors while measuring and re-windowing`
    ).to.equal(0);
  } finally {
    window.removeEventListener("error", captureRoError, true);
  }
});

it("renders nothing per row until a renderItem callback is supplied", async () => {
  const el = (await fixture(html`
    <lr-virtual-list
      style="block-size: 200px"
      .items=${[1, 2, 3]}
    ></lr-virtual-list>
  `)) as LyraVirtualList;
  await el.updateComplete;
  const rows = el.shadowRoot!.querySelectorAll('[part="row"]');
  expect(rows.length).to.be.greaterThan(0);
  for (const row of rows) expect(row.textContent!.trim()).to.equal("");

  el.renderItem = (item) => `Row ${String(item)}`;
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="row"]')!.textContent!.trim()
  ).to.equal("Row 1");
});

/* --- external scroll element (`scrollElement`) --------------------------------------------- */

const EXTERNAL_SCROLLER_HEIGHT = 200;
const EXTERNAL_LEAD_IN_HEIGHT = 40;
/** A lead-in taller than the scrollport, so at `scroller.scrollTop === 0` the scroller sits
 *  entirely ABOVE the list: the list's true position in its own offset space is -600, which
 *  windowing clamps to 0 and every coordinate conversion must not. */
const EXTERNAL_TALL_LEAD_IN_HEIGHT = 600;
const EXTERNAL_ROW_HEIGHT = 40;

/** The shape a consumer builds when an ancestor -- not the list -- owns the scrollbar: a bounded
 *  scrollport, some lead-in content above the list, then the list itself. */
async function externalScrollFixture(
  direction: "ltr" | "rtl" = "ltr",
  leadIn: number = EXTERNAL_LEAD_IN_HEIGHT
): Promise<{ scroller: HTMLElement; el: LyraVirtualList }> {
  const items = Array.from({ length: 500 }, (_, i) => i);
  const scroller = (await fixture(html`
    <div
      dir=${direction}
      style="block-size:${EXTERNAL_SCROLLER_HEIGHT}px;overflow:auto"
    >
      <div style="block-size:${leadIn}px"></div>
      <lr-virtual-list
        row-height=${EXTERNAL_ROW_HEIGHT}
        overscan="0"
        .items=${items}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lr-virtual-list>
    </div>
  `)) as HTMLElement;
  const el = scroller.querySelector("lr-virtual-list") as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  return { scroller, el };
}

function renderedIndices(el: LyraVirtualList): number[] {
  return el.renderedRows.map((row) =>
    Number(row.getAttribute("data-row-index"))
  );
}

it("virtualizes against an external scrollElement instead of its own viewport", async () => {
  const { scroller, el } = await externalScrollFixture();
  el.scrollElement = scroller;
  await el.updateComplete;
  await nextFrame();
  const base = el.scrollContainer!;

  // The component's own viewport stops being a scrollport ...
  expect(
    getComputedStyle(base).overflowY,
    "own viewport overflow-y once an external scrollElement is set"
  ).to.equal("visible");
  // ... and so has no independent scroll extent left of its own.
  expect(
    base.scrollHeight - base.clientHeight,
    "own viewport scrollable extent once an external scrollElement is set"
  ).to.be.at.most(1);

  expect(
    Math.min(...renderedIndices(el)),
    "first windowed row before scrolling the ancestor"
  ).to.equal(0);

  scroller.scrollTop = 4000;
  scroller.dispatchEvent(new Event("scroll"));
  await nextFrame();
  await el.updateComplete;

  // 4000px of ancestor scroll less the 40px lead-in above the list = 3960px into the list's own
  // offset space, which is row 99 at the top of the band.
  expect(
    Math.min(...renderedIndices(el)),
    "first windowed row after scrolling the ancestor"
  ).to.be.within(98, 100);
  expect(
    Math.max(...renderedIndices(el)),
    "last windowed row after scrolling the ancestor"
  ).to.be.at.least(103);
  await expect(el).to.be.accessible();
});

it("detaches its external scroll listeners on disconnect and re-attaches them on reconnect", async () => {
  const { scroller, el } = await externalScrollFixture();
  const added: string[] = [];
  const removed: string[] = [];
  const realAdd = scroller.addEventListener;
  const realRemove = scroller.removeEventListener;
  const countScroll = (types: string[]): number =>
    types.filter((type) => type === "scroll").length;
  scroller.addEventListener = function (this: HTMLElement, ...args: unknown[]) {
    added.push(String(args[0]));
    return (realAdd as (...a: unknown[]) => void).apply(this, args);
  } as typeof scroller.addEventListener;
  scroller.removeEventListener = function (
    this: HTMLElement,
    ...args: unknown[]
  ) {
    removed.push(String(args[0]));
    return (realRemove as (...a: unknown[]) => void).apply(this, args);
  } as typeof scroller.removeEventListener;
  try {
    el.scrollElement = scroller;
    await el.updateComplete;
    await nextFrame();
    expect(
      countScroll(added),
      "scroll listeners attached to the external scroller"
    ).to.equal(1);

    const parent = el.parentNode as ParentNode;
    el.remove();
    await nextFrame();
    expect(
      countScroll(removed),
      "scroll listeners removed from the external scroller on disconnect"
    ).to.equal(1);

    parent.appendChild(el);
    await el.updateComplete;
    await nextFrame();
    expect(
      countScroll(added),
      "scroll listeners re-attached to the external scroller on reconnect"
    ).to.equal(2);

    scroller.scrollTop = 4000;
    scroller.dispatchEvent(new Event("scroll"));
    await nextFrame();
    await el.updateComplete;
    expect(
      Math.min(...renderedIndices(el)),
      "first windowed row after reconnecting and scrolling the ancestor"
    ).to.be.within(98, 100);
  } finally {
    scroller.addEventListener = realAdd;
    scroller.removeEventListener = realRemove;
  }
});

it("keeps its own viewport scrolling while scrollElement is unset, and round-trips back to it", async () => {
  const { scroller, el } = await externalScrollFixture();
  const base = el.scrollContainer!;
  expect(
    el.scrollElement === undefined,
    "scrollElement defaults to no external scroller"
  ).to.be.true;
  expect(
    getComputedStyle(base).overflowY,
    "own viewport overflow-y by default"
  ).to.equal("auto");
  expect(
    base.getAttribute("tabindex"),
    "own viewport tab stop by default"
  ).to.equal("0");

  el.scrollElement = scroller;
  await el.updateComplete;
  await nextFrame();
  expect(
    getComputedStyle(base).overflowY,
    "own viewport overflow-y while an external scrollElement is set"
  ).to.equal("visible");
  expect(
    base.getAttribute("tabindex"),
    "own viewport tab stop while an external scrollElement is set"
  ).to.equal(null);

  el.scrollElement = undefined;
  await el.updateComplete;
  await nextFrame();
  expect(
    getComputedStyle(base).overflowY,
    "own viewport overflow-y after clearing scrollElement"
  ).to.equal("auto");
  expect(
    base.getAttribute("tabindex"),
    "own viewport tab stop after clearing scrollElement"
  ).to.equal("0");

  base.scrollTop = 4000;
  base.dispatchEvent(new Event("scroll"));
  await nextFrame();
  await el.updateComplete;
  expect(
    Math.min(...renderedIndices(el)),
    "first windowed row after scrolling its own viewport again"
  ).to.equal(100);

  // Neither an Element nor a Window: ignored, rather than throwing or half-disabling the viewport.
  (el as unknown as { scrollElement: unknown }).scrollElement = "scroller";
  await el.updateComplete;
  await nextFrame();
  expect(
    getComputedStyle(base).overflowY,
    "own viewport overflow-y for a non-element scrollElement value"
  ).to.equal("auto");
});

it("hands the inline axis to the external scrollElement under dir=rtl", async () => {
  // Rows that opted out of wrapping are the only way the inline axis is observable at all, and RTL
  // is the direction where that axis overflows towards the *start* edge -- so this fixture asserts
  // the documented handover ("horizontal scrolling becomes the external scroller's job") on the
  // side a physical-property mistake would get wrong, instead of repeating the LTR block-axis
  // assertion under a dir attribute that nothing on the path reads.
  const items = Array.from({ length: 500 }, (_, i) => i);
  const wideRow = (item: unknown) =>
    html`<div style="inline-size:900px;white-space:nowrap">row ${item}</div>`;
  const scroller = (await fixture(html`
    <div
      dir="rtl"
      style="block-size:${EXTERNAL_SCROLLER_HEIGHT}px;inline-size:300px;overflow:auto"
    >
      <div style="block-size:${EXTERNAL_LEAD_IN_HEIGHT}px"></div>
      <lr-virtual-list
        row-height=${EXTERNAL_ROW_HEIGHT}
        overscan="0"
        .items=${items}
        .renderItem=${wideRow}
        .keyFunction=${numberKey}
      ></lr-virtual-list>
    </div>
  `)) as HTMLElement;
  const el = scroller.querySelector("lr-virtual-list") as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  const base = el.scrollContainer!;

  expect(
    getComputedStyle(base).direction,
    "the exercised path is genuinely RTL"
  ).to.equal("rtl");
  expect(
    getComputedStyle(base).overflowX,
    "inline overflow while the list still owns its scrollport"
  ).to.equal("auto");
  expect(
    base.scrollWidth - base.clientWidth,
    "the list's own inline scroll extent before the handover"
  ).to.be.greaterThan(100);
  expect(
    scroller.scrollWidth - scroller.clientWidth,
    "the ancestor's inline scroll extent before the handover"
  ).to.be.at.most(1);

  el.scrollElement = scroller;
  await el.updateComplete;
  await nextFrame();

  expect(
    getComputedStyle(base).overflowX,
    "inline overflow once the ancestor owns the scrollport"
  ).to.equal("visible");
  expect(
    scroller.scrollWidth - scroller.clientWidth,
    "the ancestor's inline scroll extent after the handover"
  ).to.be.greaterThan(100);
  // RTL puts the inline start at the right edge, so a row begins there -- not at the left.
  const rowRight = el.renderedRows[0]!.getBoundingClientRect().right;
  expect(
    rowRight,
    "a row's inline-start edge under RTL"
  ).to.be.closeTo(base.getBoundingClientRect().right, 2);

  scroller.scrollTop = 2000;
  scroller.dispatchEvent(new Event("scroll"));
  await nextFrame();
  await el.updateComplete;

  expect(
    Math.min(...renderedIndices(el)),
    "first windowed row after scrolling the RTL ancestor"
  ).to.be.within(48, 50);
});

it("virtualizes against the window when scrollElement is the window", async () => {
  // Deliberately NOT the nested-scroller fixture above: the page itself has to be the scrollport,
  // so the list must sit directly in it rather than inside a 200px-tall ancestor that clips it.
  const items = Array.from({ length: 500 }, (_, i) => i);
  const el = (await fixture(html`
    <lr-virtual-list
      row-height=${EXTERNAL_ROW_HEIGHT}
      overscan="0"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>
  `)) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();

  const previousScrollY = window.scrollY;
  try {
    el.scrollElement = window;
    await el.updateComplete;
    await nextFrame();

    window.scrollTo({ top: 4000 });
    window.dispatchEvent(new Event("scroll"));
    await nextFrame();
    await el.updateComplete;

    // Read back the geometry the page scroll actually produced rather than assuming where the
    // fixture sits: what matters is that the list windowed to it at all.
    const spacer = el.shadowRoot!.querySelector(
      '[part="spacer"]'
    ) as HTMLElement;
    const localTop = Math.max(0, -spacer.getBoundingClientRect().top);
    expect(localTop, "the page scrolled past the top of the list").to.be.greaterThan(1000);
    expect(
      Math.min(...renderedIndices(el)),
      "first windowed row after scrolling the page"
    ).to.equal(Math.floor(localTop / EXTERNAL_ROW_HEIGHT));
  } finally {
    window.scrollTo({ top: previousScrollY });
  }
});

it("drops its own viewport hover outline while an external scrollElement drives it", async () => {
  const { scroller, el } = await externalScrollFixture();
  const base = el.scrollContainer!;
  try {
    await hoverUntilMatched(
      scroller,
      "pointer never landed on the list's own scroll viewport"
    );
    await waitUntil(
      () => getComputedStyle(base).outlineStyle === "solid",
      "the list's own scroll viewport never took its hover outline"
    );

    el.scrollElement = scroller;
    await el.updateComplete;
    await nextFrame();
    await hoverUntilMatched(
      scroller,
      "pointer never landed on the externally-scrolled viewport"
    );
    await waitUntil(
      () => getComputedStyle(base).outlineStyle === "none",
      "the externally-scrolled viewport kept a hover outline it can no longer honour"
    );
  } finally {
    await resetMouse();
  }
});

/* The list-coordinate contract under an external scroller: every public position API keeps
   answering in the list's own offsets, and the component converts. The regression these guard is
   converting through the ZERO-CLAMPED position: while the scroller still sits above the list, the
   true list-space position is negative, and measuring a conversion from the clamp lands every
   absolute target short by exactly the distance the scroller has yet to travel. */

it("scrollToIndex lands the row at the band's top while the external scroller is above the list", async () => {
  const { scroller, el } = await externalScrollFixture(
    "ltr",
    EXTERNAL_TALL_LEAD_IN_HEIGHT
  );
  el.scrollElement = scroller;
  await el.updateComplete;
  await nextFrame();

  expect(
    scroller.scrollTop,
    "the external scroller starts parked above the list"
  ).to.equal(0);
  expect(
    el.indexAtOffset(0),
    "the window is pinned to the first row before any scrolling"
  ).to.equal(0);

  el.scrollToIndex(100, { align: "start", behavior: "auto" });
  scroller.dispatchEvent(new Event("scroll"));
  await nextFrame();
  await el.updateComplete;

  // 600px of lead-in + 100 rows x 40px. Deriving the move from the clamped 0 instead of the real
  // -600 stops 600px (15 rows) short, at row 85.
  expect(
    scroller.scrollTop,
    "external scroller position that puts row 100 at the top of the band"
  ).to.be.closeTo(EXTERNAL_TALL_LEAD_IN_HEIGHT + 100 * EXTERNAL_ROW_HEIGHT, 1);
  expect(
    Math.min(...renderedIndices(el)),
    "first windowed row after scrollToIndex(100)"
  ).to.equal(100);
});

it("keeps offsetForIndex/indexAtOffset in the list's own offsets under an external scrollElement", async () => {
  const { scroller, el } = await externalScrollFixture(
    "ltr",
    EXTERNAL_TALL_LEAD_IN_HEIGHT
  );
  el.scrollElement = scroller;
  await el.updateComplete;
  await nextFrame();

  const offset = el.offsetForIndex(100);
  expect(
    offset,
    "offsetForIndex measures from the top of the list, not the top of the scroller"
  ).to.equal(100 * EXTERNAL_ROW_HEIGHT);
  expect(
    el.indexAtOffset(offset),
    "indexAtOffset round-trips offsetForIndex while the scroller is above the list"
  ).to.equal(100);

  scroller.scrollTop = EXTERNAL_TALL_LEAD_IN_HEIGHT + 3000;
  scroller.dispatchEvent(new Event("scroll"));
  await nextFrame();
  await el.updateComplete;

  expect(
    el.offsetForIndex(100),
    "offsetForIndex is unchanged by the external scroller's position"
  ).to.equal(offset);
  expect(
    el.indexAtOffset(offset),
    "indexAtOffset is unchanged by the external scroller's position"
  ).to.equal(100);
  expect(
    Math.min(...renderedIndices(el)),
    "first windowed row for 3000px into the list's own offset space"
  ).to.equal(75);
});

it("reports lr-virtual-scroll in list offsets, not the external scroller's own position", async () => {
  const { scroller, el } = await externalScrollFixture(
    "ltr",
    EXTERNAL_TALL_LEAD_IN_HEIGHT
  );
  el.scrollElement = scroller;
  await el.updateComplete;
  await nextFrame();
  const details: { scrollTop: number; viewportHeight: number }[] = [];
  el.addEventListener("lr-virtual-scroll", (e) =>
    details.push((e as CustomEvent).detail)
  );

  scroller.scrollTop = EXTERNAL_TALL_LEAD_IN_HEIGHT + 1000;
  scroller.dispatchEvent(new Event("scroll"));
  await nextFrame();
  await el.updateComplete;

  expect(
    details.length,
    "one lr-virtual-scroll per frame of external scrolling"
  ).to.equal(1);
  expect(
    details[0]!.scrollTop,
    "detail.scrollTop is how far the list has scrolled, not the scroller's own position"
  ).to.be.closeTo(1000, 1);
  expect(
    details[0]!.viewportHeight,
    "detail.viewportHeight is the external scroller's band"
  ).to.be.closeTo(EXTERNAL_SCROLLER_HEIGHT, 1);
});

it("aligns an early row to the bottom of the band the external scroller has not reached yet", async () => {
  // The same clamp, one call site over: a list offset below zero is meaningless for this
  // component's own viewport but legal under an external scroller, and `align: "end"` on row 0
  // genuinely asks for one (row 0's bottom is 40px into a 200px band, so the band's top belongs
  // 160px ABOVE the list).
  const { scroller, el } = await externalScrollFixture(
    "ltr",
    EXTERNAL_TALL_LEAD_IN_HEIGHT
  );
  el.scrollElement = scroller;
  await el.updateComplete;
  await nextFrame();

  el.scrollToIndex(0, { align: "end", behavior: "auto" });
  scroller.dispatchEvent(new Event("scroll"));
  await nextFrame();
  await el.updateComplete;

  expect(
    scroller.scrollTop,
    "external scroller position that puts row 0's bottom at the band's bottom"
  ).to.be.closeTo(
    EXTERNAL_TALL_LEAD_IN_HEIGHT +
      EXTERNAL_ROW_HEIGHT -
      EXTERNAL_SCROLLER_HEIGHT,
    1.5
  );
  // Measured from [part="spacer"], the origin of the list's offset space -- a row's own box is
  // content-sized in fixed row-height mode, so its rect is not the bottom of its 40px slot.
  const spacerTop = (
    el.shadowRoot!.querySelector('[part="spacer"]') as HTMLElement
  ).getBoundingClientRect().top;
  expect(
    spacerTop + EXTERNAL_ROW_HEIGHT,
    "the bottom of row 0's slot against the external scrollport's bottom edge"
  ).to.be.closeTo(scroller.getBoundingClientRect().bottom, 2);
});

/* --- auto-height measurement inside the browser's resize-observation loop ------------------- */

/** Real row heights deliberately far from the 48px estimate an unmeasured row contributes, so the
 *  first measurement of a freshly revealed window really does move the list's own extent -- the
 *  write that must not land while the browser is delivering resize observations. */
const AUTO_ROW_HEIGHTS = [96, 72, 120, 84];
const autoRowHeight = (index: number): number =>
  AUTO_ROW_HEIGHTS[index % AUTO_ROW_HEIGHTS.length]!;
const renderAutoHeightRow = (item: unknown, index: number) =>
  html`<div style="block-size:${autoRowHeight(index)}px">item ${item}</div>`;
const AUTO_HEIGHT_ITEM_COUNT = 300;

/**
 * Runs `body` with every uncaught window error recorded, through both delivery paths -- an `error`
 * listener and the `onerror` handler property -- restoring both afterwards. A ResizeObserver loop
 * notice is never a thrown exception in any of this component's own frames: the browser fires it at
 * the window, so only a window-level handler can observe it at all.
 */
async function recordWindowErrors(
  body: () => Promise<void>
): Promise<string[]> {
  const messages: string[] = [];
  const listener = (event: ErrorEvent): void => {
    messages.push(event.message);
  };
  const previousOnError = window.onerror;
  window.addEventListener('error', listener);
  window.onerror = (event, source, lineno, colno, error) => {
    messages.push(
      typeof event === 'string' ? event : (event as ErrorEvent).message
    );
    return previousOnError
      ? previousOnError.call(window, event, source, lineno, colno, error)
      : false;
  };
  try {
    await body();
  } finally {
    window.removeEventListener('error', listener);
    window.onerror = previousOnError;
  }
  return [...new Set(messages)];
}

/** The reported shape: `row-height="auto"` rows inside a consumer-owned scrollport. */
async function externalAutoHeightFixture(
  projection: 'shadow' | 'light'
): Promise<{ scroller: HTMLElement; el: LyraVirtualList }> {
  const items = Array.from(
    { length: AUTO_HEIGHT_ITEM_COUNT },
    (_, index) => index
  );
  const scroller = (await fixture(html`
    <div style="block-size:${EXTERNAL_SCROLLER_HEIGHT}px;overflow:auto">
      <div style="block-size:${EXTERNAL_LEAD_IN_HEIGHT}px"></div>
      <lr-virtual-list
        row-height="auto"
        row-projection=${projection}
        .items=${items}
        .renderItem=${renderAutoHeightRow}
        .keyFunction=${numberKey}
      ></lr-virtual-list>
    </div>
  `)) as HTMLElement;
  const el = scroller.querySelector('lr-virtual-list') as LyraVirtualList;
  el.scrollElement = scroller;
  await el.updateComplete;
  await nextFrame();
  return { scroller, el };
}

for (const projection of ['shadow', 'light'] as const) {
  it(`measures a window revealed by an external jump to the end without a ResizeObserver loop error (row-projection="${projection}")`, async () => {
    const { scroller, el } = await externalAutoHeightFixture(projection);
    /** The window has caught up with the scroll position, and every row in it contributes its own
     *  measured height to the offsets rather than the unmeasured-row estimate. */
    const settled = (): boolean => {
      const indices = renderedIndices(el);
      if (indices.length === 0) return false;
      const anchor = el.indexAtOffset(
        scroller.scrollTop - EXTERNAL_LEAD_IN_HEIGHT
      );
      if (!indices.includes(anchor)) return false;
      return indices.every(
        (index) =>
          Math.abs(
            el.offsetForIndex(index + 1) -
              el.offsetForIndex(index) -
              autoRowHeight(index)
          ) <= 1
      );
    };

    const errors = await recordWindowErrors(async () => {
      scroller.scrollTop = scroller.scrollHeight;
      scroller.dispatchEvent(new Event('scroll'));
      await waitUntil(settled, 'the revealed window measured and settled', {
        timeout: 3000,
        interval: 30,
      });
      await el.updateComplete;
      await nextFrame();
      await nextFrame();
    });

    expect(
      errors.join(' | '),
      'uncaught window errors raised while the revealed window measured'
    ).to.equal('');

    // Error-free is only half of it: the extent has to be the one the measurements imply, and the
    // rendered rows have to sit where the offsets say they do.
    const indices = renderedIndices(el);
    expect(indices.length, 'rows windowed after the jump').to.be.greaterThan(0);
    for (const index of indices) {
      expect(
        el.offsetForIndex(index + 1) - el.offsetForIndex(index),
        `measured height folded into the offsets for row ${index}`
      ).to.be.closeTo(autoRowHeight(index), 1);
    }
    const spacer = el.shadowRoot!.querySelector(
      '[part="spacer"]'
    ) as HTMLElement;
    expect(
      spacer.getBoundingClientRect().height,
      "the rendered extent against the list's own offset space"
    ).to.be.closeTo(el.offsetForIndex(AUTO_HEIGHT_ITEM_COUNT), 1);
    expect(
      el.renderedRows[0]!.getBoundingClientRect().top -
        spacer.getBoundingClientRect().top,
      'the first windowed row against its own offset'
    ).to.be.closeTo(el.offsetForIndex(indices[0]!), 1.5);
  });
}

it('settles a render held out of a resize delivery when the list disconnects before the flush', async () => {
  const { el } = await externalAutoHeightFixture('shadow');
  const internals = el as unknown as {
    onRowsResized(entries: ResizeObserverEntry[]): void;
    deliveryHeldUpdates: (() => void)[];
  };
  const row = el.renderedRows[0]!;
  // One delivery by hand, reported at a height nowhere near the row's real one so the measurement
  // really does request a render. The browser would run this from its own resize-observation loop.
  internals.onRowsResized([
    {
      target: row,
      borderBoxSize: [{ blockSize: 250, inlineSize: 100 }],
    } as unknown as ResizeObserverEntry,
  ]);
  // Lit reaches scheduleUpdate() one microtask after requestUpdate(), which is where the render is
  // held -- so this is the state a disconnect has to release rather than strand.
  await Promise.resolve();
  await Promise.resolve();
  expect(
    internals.deliveryHeldUpdates.length,
    'renders held out of the in-flight delivery'
  ).to.be.greaterThan(0);

  el.remove();
  const outcome = await Promise.race([
    el.updateComplete.then(() => 'settled'),
    new Promise<string>((resolve) => setTimeout(() => resolve('stranded'), 500)),
  ]);
  expect(
    outcome,
    'the held render resolves once the disconnect cancels the frame that would have flushed it'
  ).to.equal('settled');
  expect(
    internals.deliveryHeldUpdates.length,
    'held renders left behind by the disconnect'
  ).to.equal(0);
});

describe('light-DOM projection -- platform characterization', () => {
  /** Injects a document-scope stylesheet and hands back its teardown. The design's whole premise is
   *  that the DOCUMENT cascade reaches projected rows, so these rules deliberately live outside any
   *  shadow root. */
  function withDocumentStyles(cssText: string): () => void {
    const style = document.createElement('style');
    style.textContent = cssText;
    document.head.append(style);
    return () => style.remove();
  }

  /** The mechanism under test, stripped to its bones: an absolutely positioned, transform-offset
   *  shadow wrapper whose only child is a named <slot>, fed from the host's own light DOM. No
   *  custom element is registered -- a plain <div> accepts a shadow root, so this characterizes the
   *  platform rather than any component. */
  async function spikeFixture(options: {
    shadowCss?: string;
    lightMarkup: string;
  }): Promise<{
    host: HTMLDivElement;
    root: ShadowRoot;
    viewport: HTMLElement;
    wrapper: HTMLElement;
    slot: HTMLSlotElement;
  }> {
    const host = (await fixture(html`<div></div>`)) as HTMLDivElement;
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { display: block; }
        .viewport { position: relative; }
        .wrapper {
          position: absolute;
          inset-inline-start: 0;
          inset-block-start: 0;
          inline-size: 100%;
          transform: translateY(120px);
        }
        ${options.shadowCss ?? ''}
      </style>
      <div class="viewport"><div class="wrapper"><slot name="probe"></slot></div></div>
    `;
    host.innerHTML = options.lightMarkup;
    await nextFrame();
    return {
      host,
      root,
      viewport: root.querySelector('.viewport') as HTMLElement,
      wrapper: root.querySelector('.wrapper') as HTMLElement,
      slot: root.querySelector('slot') as HTMLSlotElement,
    };
  }

  it('lays a slotted light node out at the shadow wrapper it is assigned into', async () => {
    const { host, viewport, wrapper, slot } = await spikeFixture({
      lightMarkup: '<div class="probe" slot="probe" style="block-size:40px">row body</div>',
    });
    const probe = host.querySelector('.probe') as HTMLElement;

    expect(slot.assignedNodes({ flatten: false }).length, 'assigned node count').to.equal(1);
    expect(
      Math.round(wrapper.getBoundingClientRect().top - viewport.getBoundingClientRect().top),
      'the shadow wrapper sits at its own translateY offset'
    ).to.equal(120);
    expect(
      Math.round(probe.getBoundingClientRect().top - wrapper.getBoundingClientRect().top),
      'the slotted light node is laid out inside that transformed wrapper, not at its own DOM position'
    ).to.equal(0);
    expect(
      Math.round(probe.getBoundingClientRect().width - wrapper.getBoundingClientRect().width),
      'the slotted node inherits the wrapper box width'
    ).to.equal(0);
  });

  it('lets the document cascade beat ::slotted() on the slotted node and reach its descendants', async () => {
    const removeStyles = withDocumentStyles(`
      /* Same specificity as ::slotted(.probe) (0,1,1) -- the outer tree must still win. */
      div.doc-probe { color: rgb(255, 0, 0); }
      /* One-word element selector, far LOWER specificity -- the outer tree must still win. */
      div { background-color: rgb(0, 128, 0); }
      .doc-probe-child { color: rgb(255, 255, 0); }
    `);
    try {
      const { host } = await spikeFixture({
        shadowCss: `
          ::slotted(.doc-probe) {
            color: rgb(0, 0, 255);
            background-color: rgb(0, 0, 255);
          }
        `,
        lightMarkup:
          '<div class="doc-probe" slot="probe"><span class="doc-probe-child">inner</span></div>',
      });
      const probe = host.querySelector('.doc-probe') as HTMLElement;
      const child = host.querySelector('.doc-probe-child') as HTMLElement;

      expect(
        getComputedStyle(probe).color,
        'a same-specificity document rule beats ::slotted()'
      ).to.equal('rgb(255, 0, 0)');
      expect(
        getComputedStyle(probe).backgroundColor,
        'even a lower-specificity document rule beats ::slotted() (outer tree wins, regardless of specificity)'
      ).to.equal('rgb(0, 128, 0)');
      expect(
        getComputedStyle(child).color,
        'the document cascade reaches descendants of the slotted node, which ::slotted() cannot'
      ).to.equal('rgb(255, 255, 0)');
    } finally {
      removeStyles();
    }
  });

  it('inherits from the shadow wrapper through the flat tree into slotted content', async () => {
    const { host } = await spikeFixture({
      shadowCss: '.wrapper { overflow-wrap: anywhere; }',
      lightMarkup: '<div class="inherit-probe" slot="probe">body</div>',
    });
    const probe = host.querySelector('.inherit-probe') as HTMLElement;
    expect(
      getComputedStyle(probe).overflowWrap,
      'inherited properties flow across the slot boundary from the shadow wrapper'
    ).to.equal('anywhere');
  });

  it('measures slotted content through a ResizeObserver on the absolutely positioned shadow wrapper', async () => {
    const { host, wrapper } = await spikeFixture({
      lightMarkup: '<div class="size-probe" slot="probe" style="block-size:40px">body</div>',
    });
    const probe = host.querySelector('.size-probe') as HTMLElement;
    const sizes: number[] = [];
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        sizes.push(entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height);
      }
    });
    try {
      observer.observe(wrapper);
      await waitUntil(() => sizes.length > 0, 'the wrapper reports an initial size');
      expect(sizes.at(-1), 'the wrapper box takes its height from the slotted content').to.be.closeTo(
        40,
        1
      );
      expect(
        Math.round(wrapper.getBoundingClientRect().height),
        'the wrapper rect agrees with the observed box'
      ).to.equal(40);

      const before = sizes.length;
      probe.style.blockSize = '90px';
      await waitUntil(() => sizes.length > before, 'a slotted content growth is reported');
      expect(sizes.at(-1), 'a slotted growth resizes the shadow wrapper').to.be.closeTo(90, 1);
    } finally {
      observer.disconnect();
    }
  });

  it('renders nothing for a light child whose slot name matches no slot', async () => {
    const { host, slot } = await spikeFixture({
      lightMarkup:
        '<div class="orphan" slot="no-such-slot" style="block-size:40px">orphan</div>',
    });
    const orphan = host.querySelector('.orphan') as HTMLElement;

    expect(orphan.assignedSlot === null, 'an unmatched name is assigned to no slot').to.be.true;
    expect(slot.assignedNodes({ flatten: false }).length, 'the named slot stays empty').to.equal(0);
    const rect = orphan.getBoundingClientRect();
    expect(Math.round(rect.width), 'unassigned light children generate no box (width)').to.equal(0);
    expect(Math.round(rect.height), 'unassigned light children generate no box (height)').to.equal(0);
    expect(orphan.offsetParent === null, 'unassigned light children are not laid out').to.be.true;
  });

  it('blocks focus of a button inside an inert, aria-hidden LIGHT wrapper that is slotted', async () => {
    const { host } = await spikeFixture({
      lightMarkup:
        '<div class="band" slot="probe" inert aria-hidden="true" style="pointer-events:none"><button type="button" class="band-button">Press</button></div>',
    });
    const button = host.querySelector('.band-button') as HTMLButtonElement;
    const outside = (await fixture(html`<button type="button">outside</button>`)) as HTMLButtonElement;
    outside.focus();
    expect(document.activeElement === outside, 'the control outside the band focuses normally').to.be
      .true;

    button.focus();
    expect(document.activeElement === button, 'an inert light wrapper refuses focus for its subtree')
      .to.be.false;
    expect(button.matches(':focus'), 'and the button never matches :focus').to.be.false;
    expect(
      getComputedStyle(button).pointerEvents,
      'pointer-events: none on the light wrapper inherits to its subtree'
    ).to.equal('none');
  });
});

describe('rowProjection property surface', () => {
  const SAMPLE = Array.from({ length: 200 }, (_, index) => index);

  async function projectionFixture(markup: unknown): Promise<LyraVirtualList> {
    const el = (await fixture(markup as never)) as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();
    return el;
  }

  it('defaults to shadow and normalizes unsupported attributes and untyped property writes', async () => {
    const unset = await projectionFixture(html`
      <lr-virtual-list
        style="--lr-virtual-list-height:200px"
        row-height="40"
        .items=${SAMPLE}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lr-virtual-list>
    `);
    expect(unset.rowProjection, 'unset default').to.equal('shadow');

    const light = await projectionFixture(html`
      <lr-virtual-list
        row-projection="light"
        style="--lr-virtual-list-height:200px"
        row-height="40"
        .items=${SAMPLE}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lr-virtual-list>
    `);
    expect(light.rowProjection, 'row-projection="light" parses').to.equal('light');

    const bogus = await projectionFixture(html`
      <lr-virtual-list
        row-projection="deep"
        style="--lr-virtual-list-height:200px"
        row-height="40"
        .items=${SAMPLE}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lr-virtual-list>
    `);
    expect(bogus.rowProjection, 'an unsupported attribute normalizes back').to.equal('shadow');
    expect(bogus.childNodes.length, 'and it projects nothing').to.equal(0);

    (light as unknown as Record<string, unknown>)['rowProjection'] = 'deep';
    await light.updateComplete;
    await nextFrame();
    expect(light.rowProjection, 'an untyped property write normalizes back').to.equal('shadow');
    expect(light.childNodes.length, 'and the light DOM is emptied again').to.equal(0);
  });

  it('exports the reserved light-DOM attribute names', () => {
    expect(VIRTUAL_LIST_ROW_ATTRIBUTE).to.equal('data-lr-virtual-list-row');
    expect(VIRTUAL_LIST_STICKY_ATTRIBUTE).to.equal('data-lr-virtual-list-sticky');
  });

  it('exposes an empty projectedRows while the property is unset', async () => {
    const el = await projectionFixture(html`
      <lr-virtual-list
        style="--lr-virtual-list-height:200px"
        row-height="40"
        .items=${SAMPLE}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lr-virtual-list>
    `);
    expect(el.projectedRows.length, 'no projected rows in shadow mode').to.equal(0);
    expect(el.renderedRows.length, 'while the shadow window is populated').to.be.greaterThan(0);
  });

  it('renders byte-identically with row-projection unset and row-projection="shadow"', async () => {
    const build = (projection: string | typeof nothingAttribute) =>
      projection === nothingAttribute
        ? html`
            <lr-virtual-list
              style="--lr-virtual-list-height:200px"
              row-height="40"
              .items=${SAMPLE}
              .renderItem=${renderText}
              .keyFunction=${numberKey}
            ></lr-virtual-list>
          `
        : html`
            <lr-virtual-list
              row-projection="shadow"
              style="--lr-virtual-list-height:200px"
              row-height="40"
              .items=${SAMPLE}
              .renderItem=${renderText}
              .keyFunction=${numberKey}
            ></lr-virtual-list>
          `;

    const unset = await projectionFixture(build(nothingAttribute));
    const explicit = await projectionFixture(build('shadow'));

    const compare = async (stage: string) => {
      await Promise.all([unset.updateComplete, explicit.updateComplete]);
      await nextFrame();
      expect(unset.shadowRoot!.innerHTML, `shadow markup after ${stage}`).to.equal(
        explicit.shadowRoot!.innerHTML
      );
      expect(unset.shadowRoot!.querySelectorAll('slot').length, `no slots after ${stage}`).to.equal(
        0
      );
      expect(unset.childNodes.length, `unset host light DOM after ${stage}`).to.equal(0);
      expect(explicit.childNodes.length, `explicit host light DOM after ${stage}`).to.equal(0);
    };

    await compare('mount');

    for (const el of [unset, explicit]) el.scrollContainer!.scrollTop = 1200;
    for (const el of [unset, explicit])
      el.scrollContainer!.dispatchEvent(new Event('scroll'));
    await compare('a scroll');

    const replacement = Array.from({ length: 140 }, (_, index) => index + 1000);
    for (const el of [unset, explicit]) el.items = replacement;
    await compare('an items reassignment');

    for (const el of [unset, explicit]) el.rowHeight = 24;
    await compare('a row-height change');

    for (const el of [unset, explicit]) el.rowHeight = 'auto';
    await compare('a switch to auto row height');

    unset.remove();
    explicit.remove();
    expect(unset.childNodes.length, 'unset host light DOM after remove()').to.equal(0);
    expect(explicit.childNodes.length, 'explicit host light DOM after remove()').to.equal(0);
  });
});

describe('light-DOM projection -- shadow side', () => {
  const SAMPLE = Array.from({ length: 200 }, (_, index) => index);
  const renderBody = (item: unknown, index: number) =>
    html`<span class="row-body">item ${item}#${index}</span>`;

  /** Attribute snapshot of a row wrapper, order-independent, children excluded -- so a projection
   *  run can be compared against a shadow run without the slot/content difference drowning it. */
  function attributeSnapshot(el: Element): string {
    return [...el.attributes]
      .map((attribute) => `${attribute.name}=${attribute.value}`)
      .sort()
      .join('|');
  }

  async function mountPair(extra: {
    itemRole?: string;
    rowIndexOffset?: string;
    activeItemId?: number;
  }): Promise<{ shadowMode: LyraVirtualList; lightMode: LyraVirtualList }> {
    const build = (projection: 'shadow' | 'light') => {
      const el = document.createElement('lr-virtual-list') as LyraVirtualList;
      el.setAttribute('style', '--lr-virtual-list-height:200px');
      el.setAttribute('row-height', '40');
      el.setAttribute('row-projection', projection);
      if (extra.itemRole) el.setAttribute('item-role', extra.itemRole);
      if (extra.rowIndexOffset) el.setAttribute('row-index-offset', extra.rowIndexOffset);
      // A numeric key needs the property: an attribute value is always a string, and the typed
      // comparison against `keyFunction`'s number result would never match.
      if (extra.activeItemId !== undefined) el.activeItemId = extra.activeItemId;
      el.items = SAMPLE;
      el.renderItem = renderBody;
      el.keyFunction = numberKey;
      return el;
    };
    const host = (await fixture(html`<div></div>`)) as HTMLDivElement;
    const shadowMode = build('shadow');
    const lightMode = build('light');
    host.append(shadowMode, lightMode);
    await Promise.all([shadowMode.updateComplete, lightMode.updateComplete]);
    await nextFrame();
    return { shadowMode, lightMode };
  }

  it('replaces each row body with exactly one uniquely named slot and no consumer markup', async () => {
    const { lightMode } = await mountPair({});
    const rows = lightMode.renderedRows;
    expect(rows.length, 'a populated window').to.be.greaterThan(1);

    const names = new Set<string>();
    for (const row of rows) {
      const slots = row.querySelectorAll('slot');
      expect(slots.length, `exactly one slot in row ${row.getAttribute('data-row-index')}`).to.equal(
        1
      );
      const name = slots[0]!.getAttribute('name') ?? '';
      expect(name.length, 'the slot name is never empty').to.be.greaterThan(0);
      names.add(name);
      expect(
        row.querySelector('.row-body') === null,
        'no consumer markup is stamped in the shadow root'
      ).to.be.true;
    }
    expect(names.size, 'one distinct slot name per windowed row').to.equal(rows.length);
    expect(
      lightMode.shadowRoot!.querySelectorAll('slot:not([name])').length,
      'no unnamed slot anywhere -- an unmatched projected row must stay invisible'
    ).to.equal(0);
  });

  it('keeps every row attribute identical to shadow mode', async () => {
    const listitem = await mountPair({ activeItemId: 3 });
    const listitemShadow = listitem.shadowMode.renderedRows.map(attributeSnapshot);
    const listitemLight = listitem.lightMode.renderedRows.map(attributeSnapshot);
    expect(listitemLight, 'listitem-mode row attributes').to.deep.equal(listitemShadow);
    expect(
      listitemLight.some((snapshot) => snapshot.includes('aria-current=true')),
      'the active row still carries aria-current'
    ).to.be.true;

    const rowMode = await mountPair({ itemRole: 'row', rowIndexOffset: '1' });
    expect(
      rowMode.lightMode.renderedRows.map(attributeSnapshot),
      'row-mode row attributes incl. aria-rowindex + row-index-offset'
    ).to.deep.equal(rowMode.shadowMode.renderedRows.map(attributeSnapshot));
    expect(
      rowMode.lightMode.renderedRows[0]!.getAttribute('aria-rowindex'),
      'aria-rowindex still honors row-index-offset'
    ).to.equal('2');
  });

  it('still matches lr-virtual-list::part(row) in projection mode', async () => {
    const style = document.createElement('style');
    style.textContent = 'lr-virtual-list::part(row) { padding-inline-start: 7px; }';
    document.head.append(style);
    try {
      const { shadowMode, lightMode } = await mountPair({});
      expect(
        getComputedStyle(shadowMode.renderedRows[0]!).paddingInlineStart,
        '::part(row) in shadow mode'
      ).to.equal('7px');
      expect(
        getComputedStyle(lightMode.renderedRows[0]!).paddingInlineStart,
        '::part(row) in projection mode -- the positioning wrapper never leaves the shadow root'
      ).to.equal('7px');
    } finally {
      style.remove();
    }
  });
});

describe('light-DOM projection -- the light render root', () => {
  const BIG = Array.from({ length: 1000 }, (_, index) => index);
  const renderBody = (item: unknown, index: number) =>
    html`<span class="projected-body">item ${item}#${index}</span>`;

  async function projected(
    overrides: Partial<{
      items: readonly unknown[];
      renderItem: (item: unknown, index: number) => unknown;
      rowHeight: string;
    }> = {}
  ): Promise<LyraVirtualList> {
    const el = document.createElement('lr-virtual-list') as LyraVirtualList;
    el.setAttribute('style', '--lr-virtual-list-height:200px');
    el.setAttribute('row-height', overrides.rowHeight ?? '40');
    el.setAttribute('row-projection', 'light');
    el.items = overrides.items ?? BIG;
    el.renderItem = overrides.renderItem ?? renderBody;
    el.keyFunction = numberKey;
    const host = (await fixture(html`<div></div>`)) as HTMLDivElement;
    host.append(el);
    await el.updateComplete;
    await nextFrame();
    return el;
  }

  /** Every slot name the shadow window is asking for, and every name the light window supplies. */
  function slotNames(el: LyraVirtualList): { wanted: string[]; supplied: string[] } {
    return {
      wanted: [...el.shadowRoot!.querySelectorAll('slot')].map(
        (slot) => slot.getAttribute('name') ?? ''
      ),
      supplied: el.projectedRows.map((row) => row.getAttribute('slot') ?? ''),
    };
  }

  it('projects one light child per windowed row, carrying the reserved attributes', async () => {
    const el = await projected();
    const rows = el.projectedRows;
    expect(rows.length, 'a populated projected window').to.be.greaterThan(1);
    expect(rows.length, 'exactly one projected row per shadow row').to.equal(
      el.renderedRows.length
    );

    const shadowRows = el.renderedRows;
    rows.forEach((row, position) => {
      const shadowRow = shadowRows[position]!;
      expect(row.hasAttribute(VIRTUAL_LIST_ROW_ATTRIBUTE), 'reserved attribute').to.be.true;
      expect(row.getAttribute('data-row-index'), 'mirrored data-row-index').to.equal(
        shadowRow.getAttribute('data-row-index')
      );
      expect(row.getAttribute('data-row-key'), 'mirrored data-row-key').to.equal(
        shadowRow.getAttribute('data-row-key')
      );
      expect(row.hasAttribute('part'), 'a light node must never claim a part').to.be.false;
      expect(row.hasAttribute('role'), 'the shadow wrapper owns semantics').to.be.false;
      expect(row.querySelector('.projected-body') !== null, 'consumer markup inside').to.be.true;
      expect(
        row.assignedSlot?.getAttribute('name') ?? null,
        'assigned into its own shadow row wrapper'
      ).to.equal(shadowRow.querySelector('slot')!.getAttribute('name'));
    });

    const { wanted, supplied } = slotNames(el);
    expect(supplied, 'the two sides key on the same identities').to.deep.equal(wanted);
  });

  it('calls renderItem exactly once per windowed row per update', async () => {
    let calls = 0;
    const counting = (item: unknown, index: number) => {
      calls += 1;
      return renderBody(item, index);
    };
    const el = await projected({ renderItem: counting });
    const windowSize = el.renderedRows.length;
    expect(windowSize).to.be.greaterThan(1);

    calls = 0;
    el.requestUpdate();
    await el.updateComplete;
    expect(calls, 'the slot path does not double-render consumer content').to.equal(windowSize);
  });

  it('lets a document stylesheet reach projected row content', async () => {
    const style = document.createElement('style');
    style.textContent = '.projected-body { letter-spacing: 3px; font-style: italic; }';
    document.head.append(style);
    try {
      const el = await projected();
      const body = el.projectedRows[0]!.querySelector('.projected-body') as HTMLElement;
      expect(getComputedStyle(body).letterSpacing, 'document rule reaches row content').to.equal(
        '3px'
      );
      expect(getComputedStyle(body).fontStyle).to.equal('italic');
    } finally {
      style.remove();
    }
  });

  it('stays bounded and stale-free across a long scroll', async () => {
    const el = await projected();
    const initial = el.projectedRows.length;
    const container = el.scrollContainer!;
    for (let step = 0; step < 120; step += 1) {
      container.scrollTop = step * 320;
      container.dispatchEvent(new Event('scroll'));
      await nextFrame();
      await el.updateComplete;
      expect(el.projectedRows.length, `projected rows at step ${step}`).to.equal(
        el.renderedRows.length
      );
    }
    await nextFrame();
    expect(el.projectedRows.length, 'window stays bounded').to.be.lessThan(initial * 3);
    const { wanted, supplied } = slotNames(el);
    expect(supplied, 'no stale slot names survive scrolling').to.deep.equal(wanted);
    // Element children only: lit-html's own marker comments live between them, and the disconnect
    // test below is what proves none of them survive teardown.
    expect(
      el.children.length,
      'the projected rows are the host\'s only element children'
    ).to.equal(el.projectedRows.length);
  });

  it('leaves no orphan light rows after an items reassignment', async () => {
    const el = await projected();
    el.keyFunction = stringKey;
    el.items = Array.from({ length: 50 }, (_, index) => `fresh-${index}`);
    await el.updateComplete;
    await nextFrame();

    expect(el.projectedRows.length).to.equal(el.renderedRows.length);
    const { wanted, supplied } = slotNames(el);
    expect(supplied, 'the new keyed set replaced the old one wholesale').to.deep.equal(wanted);
    expect(
      el.projectedRows.every((row) => (row.textContent ?? '').includes('fresh-')),
      'no row from the previous source survived'
    ).to.be.true;
  });

  it('empties the host light DOM completely on disconnect', async () => {
    const el = await projected();
    expect(el.childNodes.length).to.be.greaterThan(1);
    el.remove();
    expect(el.childNodes.length, 'no rows, no lit marker, no anchor').to.equal(0);
    expect(el.projectedRows.length).to.equal(0);
  });

  it('re-projects on reconnect with no reactive property change', async () => {
    const el = await projected();
    const host = el.parentElement!;
    const before = el.renderedRows.map((row) => row.getAttribute('data-row-index'));
    el.remove();
    expect(el.childNodes.length).to.equal(0);

    host.append(el);
    expect(el.projectedRows.length, 'reconnect re-projects synchronously').to.equal(
      el.renderedRows.length
    );
    expect(
      el.renderedRows.map((row) => row.getAttribute('data-row-index')),
      'the same window is restored'
    ).to.deep.equal(before);
    const { wanted, supplied } = slotNames(el);
    expect(supplied, 'renderedRows and projectedRows pair up 1:1 again').to.deep.equal(wanted);
  });

  it('switches the mode off and back on cleanly', async () => {
    const el = await projected();
    expect(el.projectedRows.length).to.be.greaterThan(0);

    el.rowProjection = 'shadow';
    await el.updateComplete;
    await nextFrame();
    expect(el.childNodes.length, 'every light child and the anchor are removed').to.equal(0);
    expect(
      el.renderedRows[0]!.querySelector('.projected-body') !== null,
      'shadow-rendered row content is restored'
    ).to.be.true;
    expect(el.shadowRoot!.querySelectorAll('slot').length, 'and no slots remain').to.equal(0);

    el.rowProjection = 'light';
    await el.updateComplete;
    await nextFrame();
    expect(el.projectedRows.length, 're-projects').to.equal(el.renderedRows.length);
    expect(
      el.renderedRows[0]!.querySelector('.projected-body') === null,
      'the shadow root stops stamping consumer content again'
    ).to.be.true;
  });

  it('preserves consumer light children added before and after the first projection', async () => {
    const el = document.createElement('lr-virtual-list') as LyraVirtualList;
    el.setAttribute('style', '--lr-virtual-list-height:200px');
    el.setAttribute('row-height', '40');
    el.setAttribute('row-projection', 'light');
    el.items = BIG;
    el.renderItem = renderBody;
    el.keyFunction = numberKey;
    const early = document.createElement('span');
    early.id = 'consumer-early';
    el.append(early);

    const host = (await fixture(html`<div></div>`)) as HTMLDivElement;
    host.append(el);
    await el.updateComplete;
    await nextFrame();

    const late = document.createElement('span');
    late.id = 'consumer-late';
    el.append(late);
    el.requestUpdate();
    await el.updateComplete;
    await nextFrame();

    expect(el.querySelector('#consumer-early') !== null, 'pre-projection child survives').to.be.true;
    expect(el.querySelector('#consumer-late') !== null, 'post-projection child survives').to.be.true;
    expect(early.parentNode === el && late.parentNode === el, 'both stay direct children').to.be
      .true;
    expect(
      el.projectedRows.length,
      'consumer children are not mistaken for projected rows'
    ).to.equal(el.renderedRows.length);

    el.remove();
    expect(el.querySelector('#consumer-early') !== null, 'teardown keeps consumer children').to.be
      .true;
    expect(el.querySelector('#consumer-late') !== null).to.be.true;
    expect(el.childNodes.length, 'and removes exactly its own nodes').to.equal(2);
  });

  it('re-creates projected rows in the adopted owner document', async () => {
    const el = await projected();
    const originalAnchor = [...el.childNodes].find((node) => node.nodeType === Node.COMMENT_NODE)!;
    expect(originalAnchor.ownerDocument === document, 'anchor starts in this document').to.be.true;

    const frame = document.createElement('iframe');
    document.body.append(frame);
    try {
      const frameDocument = frame.contentDocument!;
      el.remove();
      frameDocument.body.append(frameDocument.adoptNode(el));
      await el.updateComplete;
      await nextFrame();

      expect(el.projectedRows.length, 're-projected in the new realm').to.equal(
        el.renderedRows.length
      );
      expect(
        el.projectedRows.every((row) => row.ownerDocument === frameDocument),
        'every projected row belongs to the adopted owner document'
      ).to.be.true;
      expect(
        originalAnchor.parentNode === el,
        'the anchor from the previous realm is gone'
      ).to.be.false;
    } finally {
      if (el.ownerDocument !== document) document.adoptNode(el);
      el.remove();
      frame.remove();
    }
  });
});

describe('light-DOM projection -- SSR and hydration', () => {
  const SERVER_SHADOW = '<template shadowrootmode="open"></template>';
  const SAMPLE = Array.from({ length: 300 }, (_, index) => index);
  const renderBody = (item: unknown, index: number) =>
    html`<span class="hydration-body">item ${item}#${index}</span>`;

  /** `renderItemOverride` is assigned in the SAME synchronous block as the element's upgrade, not
   *  after an `await`. `setHTMLUnsafe` upgrades the element synchronously, so its
   *  `connectedCallback` schedules the first update as a microtask -- any `await` between the
   *  upgrade and the assignment lets that first update run with whatever `renderItem` was set at
   *  upgrade time. Firefox reliably lands that microtask during the caller's `await`, Chromium and
   *  WebKit happened not to, which is how a test that reassigned `renderItem` afterwards passed on
   *  two engines and failed on the third. */
  async function mountServerShaped(
    attributes: string,
    renderItemOverride?: (item: unknown, index: number) => unknown,
  ): Promise<LyraVirtualList> {
    const container = (await fixture(html`<div></div>`)) as HTMLDivElement & {
      setHTMLUnsafe(value: string): void;
    };
    container.setHTMLUnsafe(
      `<lr-virtual-list ${attributes}>${SERVER_SHADOW}</lr-virtual-list>`
    );
    const el = container.firstElementChild as LyraVirtualList;
    el.items = SAMPLE;
    el.renderItem = (renderItemOverride ?? renderBody) as LyraVirtualList['renderItem'];
    el.keyFunction = numberKey;
    return el;
  }

  it('projects from the very first render on a browser-only mount', async () => {
    const host = (await fixture(html`<div></div>`)) as HTMLDivElement;
    const el = document.createElement('lr-virtual-list') as LyraVirtualList;
    el.setAttribute('style', '--lr-virtual-list-height:200px');
    el.setAttribute('row-height', '40');
    el.setAttribute('row-projection', 'light');
    el.items = SAMPLE;
    el.renderItem = renderBody;
    el.keyFunction = numberKey;

    host.append(el);
    let stamped = false;
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (
            node instanceof Element &&
            (node.matches('.hydration-body') || node.querySelector('.hydration-body') !== null)
          )
            stamped = true;
        }
      }
    });
    try {
      observer.observe(el.shadowRoot!, { subtree: true, childList: true });
      await el.updateComplete;
      await nextFrame();
      await el.updateComplete;

      expect(el.projectedRows.length, 'rows land in the light DOM').to.be.greaterThan(0);
      expect(
        stamped,
        'consumer content is never stamped into the shadow root -- no flash of shadow-rendered rows'
      ).to.be.false;
    } finally {
      observer.disconnect();
    }
  });

  it('defers projection by one task on a server-shaped mount, then moves the rows', async () => {
    const el = await mountServerShaped(
      'style="--lr-virtual-list-height:200px" row-height="40" row-projection="light"'
    );

    await el.updateComplete;
    expect(el.projectedRows.length, 'the first render reproduces the server window').to.equal(0);
    expect(el.renderedRows.length, 'and that window is populated, not empty').to.be.greaterThan(0);
    expect(
      el.shadowRoot!.querySelector('.hydration-body') !== null,
      'consumer content is briefly shadow-rendered, exactly as the server serialized it'
    ).to.be.true;
    expect(el.shadowRoot!.querySelectorAll('slot').length, 'and no slots yet').to.equal(0);

    await aTimeout(0);
    await el.updateComplete;
    await nextFrame();
    await el.updateComplete;

    expect(el.projectedRows.length, 'one task later the rows have moved').to.be.greaterThan(0);
    expect(
      el.shadowRoot!.querySelector('.hydration-body') === null,
      'and the shadow root stops stamping consumer content'
    ).to.be.true;
  });

  it('recovers projection after a server-shaped first update throws', async () => {
    let shouldThrow = true;
    // Handed to the mount rather than assigned after it, so the throw is guaranteed to land on the
    // FIRST update on every engine -- see mountServerShaped's own note.
    const el = await mountServerShaped(
      'style="--lr-virtual-list-height:200px" row-height="40" row-projection="light"',
      (item: unknown, index: number) => {
        if (shouldThrow) throw new Error('first update fails');
        return renderBody(item, index);
      },
    );

    // Lit deliberately re-fires a failed update's error as a fresh unhandled rejection the moment
    // the NEXT update is enqueued (ReactiveElement.__enqueueUpdate), so the recovery below cannot
    // avoid one. The test runner's uncaught-error logger reports it through console.error and does
    // not honour preventDefault(), so both are captured here and restored afterwards -- otherwise
    // this test alone would fail the strict-console CI lanes.
    const suppress = (event: PromiseRejectionEvent) => event.preventDefault();
    const originalError = console.error;
    const errors: unknown[][] = [];
    console.error = (...args: unknown[]) => errors.push(args);
    window.addEventListener('unhandledrejection', suppress);
    try {
      let threw = false;
      await el.updateComplete.catch(() => {
        threw = true;
      });
      expect(threw, 'the first update really did fail').to.be.true;

      shouldThrow = false;
      el.requestUpdate();
      await el.updateComplete;
      await nextFrame();
      await el.updateComplete;

      expect(
        el.projectedRows.length,
        'projection is not deferred forever by a failed first update'
      ).to.be.greaterThan(0);
      // Let the re-fired rejection land while the capture is still installed.
      await aTimeout(50);
    } finally {
      console.error = originalError;
      window.removeEventListener('unhandledrejection', suppress);
    }
    expect(
      errors.flat().map(String).some((message) => message.includes('first update fails')),
      'the captured noise is the expected re-fired update error, not something unrelated'
    ).to.be.true;
  });
});
