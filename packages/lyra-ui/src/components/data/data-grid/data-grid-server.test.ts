import { expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './data-grid.js';
import { type Person, columns, rows, dataGrid, delay, header } from '../../../../test/data-grid.js';


it("emits only the mirrored request event with an immutable snapshot and server paging", async () => {
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
  let prefixedRequests = 0;
  element.addEventListener("lr-data-request", () => { prefixedRequests += 1; });
  const requestEvent = oneEvent(element, "request");
  await element.reload();
  const request = await requestEvent;
  expect(request.detail.page).to.equal(2);
  expect(request.detail.pageSize).to.equal(5);
  expect(request.detail.sort).to.deep.equal([{ id: "name", desc: true }]);
  expect(request.detail.filters).to.deep.equal([
    { id: "team", value: "Runtime" },
  ]);
  expect(request.detail.search).to.equal("Lin");
  expect(() => {
    (element.sort[0] as { desc: boolean }).desc = false;
  }).to.throw(TypeError);
  expect(() => {
    (element.filters[0] as { value: unknown }).value = "Compiler";
  }).to.throw(TypeError);
  expect(request.detail.sort).to.deep.equal([{ id: "name", desc: true }]);
  expect(request.detail.filters).to.deep.equal([
    { id: "team", value: "Runtime" },
  ]);
  expect(Object.isFrozen(request.detail)).to.equal(true);
  expect(Object.isFrozen(request.detail.sort)).to.equal(true);
  expect(Object.isFrozen(request.detail.filters)).to.equal(true);
  expect(request.detail.signal).to.be.instanceOf(AbortSignal);
  expect(prefixedRequests).to.equal(0);
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
  expect(Object.isFrozen(event.detail)).to.equal(true);
  expect(Object.isFrozen(event.detail.request)).to.equal(true);
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
  }) as unknown as typeof window.setTimeout;
  window.clearTimeout = (() => undefined) as typeof window.clearTimeout;
  frameWindow.setTimeout = ((handler: TimerHandler) => {
    frameTimers++;
    if (typeof handler === "function") {
      oldTimerCallback = () => {
        Reflect.apply(handler, frameWindow, []);
      };
    }
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
      '[part="columns-menu"] lr-button'
    ) as HTMLElement
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
  expect(element.shadowRoot!.querySelector('[part="filter-panel"]') === null).to.be.true;
  expect((element.shadowRoot!.querySelector('[role="menu"]')) == null).to.be.true;
  // lr-popover suspends rather than closes on disconnect, so this grid closes the composed menu
  // itself -- a reattached grid must not come back with a menu the user never reopened.
  await waitUntil(
    () =>
      (
        element.shadowRoot!.querySelector('[part="columns-menu"]') as
          | (HTMLElement & { open: boolean })
          | null
      )?.open === false,
    "the composed columns dropdown reopens closed"
  );
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
  expect(element.getState().widths?.["name"]).to.be.undefined;
});

it('uses one page-local ARIA row model for client and server pagination', async () => {
  const pageRows: Person[] = [
    { id: 4, name: 'Margaret', team: 'Compiler', score: 8 },
    { id: 5, name: 'Edsger', team: 'Runtime', score: 6 },
  ];
  const client = await dataGrid(html`
    <lr-data-grid
      label="Client people"
      paginate
      page="1"
      page-size="2"
      .columns=${columns}
      .data=${[...rows, ...pageRows.slice(0, 1)]}
    ></lr-data-grid>
  `);
  const server = await dataGrid(html`
    <lr-data-grid
      label="Server people"
      server
      paginate
      page="7"
      page-size="2"
      total="50"
      .columns=${columns}
      .data=${pageRows}
    ></lr-data-grid>
  `);

  for (const [mode, element] of [
    ['client', client],
    ['server', server],
  ] as const) {
    const grid = element.shadowRoot!.querySelector<HTMLElement>('[part="table"]')!;
    const indexes = [
      ...element.shadowRoot!.querySelectorAll<HTMLElement>(
        '[part~="row"][aria-rowindex]',
      ),
    ].map((row) => row.getAttribute('aria-rowindex'));
    expect(grid.getAttribute('aria-rowcount'), `${mode} page row count`).to.equal('3');
    expect(indexes, `${mode} page row indexes`).to.deep.equal(['2', '3']);
  }
  expect(client.pageCount).to.equal(2);
  expect(server.pageCount).to.equal(25);
});

describe("ResizeObserver callback batching (perf)", () => {
  it("coalesces several synchronous ResizeObserver callback ticks into a single rAF-scheduled measurement pass", async () => {
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
      await dataGrid(html`
        <lr-data-grid label="People" .columns=${columns} .data=${rows}></lr-data-grid>
      `);
      expect(typeof capturedCallback, "the grid registers its own ResizeObserver").to.equal(
        "function"
      );
      rafCallCount = 0;
      // Simulate three ResizeObserver ticks firing back-to-back in the same frame -- exactly what
      // an animated/dragged ancestor resize does, once per animation frame.
      capturedCallback!([] as unknown as ResizeObserverEntry[], {} as ResizeObserver);
      capturedCallback!([] as unknown as ResizeObserverEntry[], {} as ResizeObserver);
      capturedCallback!([] as unknown as ResizeObserverEntry[], {} as ResizeObserver);
      expect(rafCallCount, "one rAF-scheduled pass per frame, not one per tick").to.equal(1);
      // ...and the very next tick after that frame settles schedules a fresh one (the id resets,
      // rather than getting stuck disabled after the first coalesced frame).
      await new Promise<void>((resolve) => originalRaf.call(window, () => resolve()));
      rafCallCount = 0;
      capturedCallback!([] as unknown as ResizeObserverEntry[], {} as ResizeObserver);
      expect(rafCallCount, "the next tick after the frame settles schedules a fresh pass").to.equal(
        1
      );
    } finally {
      window.ResizeObserver = originalResizeObserver;
      window.requestAnimationFrame = originalRaf;
    }
  });
});
