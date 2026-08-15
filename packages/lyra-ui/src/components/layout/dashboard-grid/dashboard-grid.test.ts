import { fixture, expect, html } from "@open-wc/testing";
import { LitElement, type PropertyValues } from "lit";
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from "../../../internal/announcer.js";
import { tag } from "../../../internal/prefix.js";
import "./dashboard-grid.js";
import type { LyraDashboardGrid } from "./dashboard-grid.js";
import type { LyraDashboardCell } from "./layout.js";
import { styles } from "./dashboard-grid.styles.js";

function twoCells(): LyraDashboardCell[] {
  return [
    { cellId: "a", x: 0, y: 0, w: 2, h: 1, label: "Alpha" },
    { cellId: "b", x: 2, y: 0, w: 2, h: 1, label: "Beta" },
  ];
}

async function settleChildReconciliation(el: LyraDashboardGrid): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await el.updateComplete;
  await Promise.resolve();
}

function createRealmFrame(): {
  iframe: HTMLIFrameElement;
  frameDocument: Document;
  frameWindow: Window & typeof globalThis;
} {
  const iframe = document.createElement("iframe");
  document.body.append(iframe);
  const frameDocument = iframe.contentDocument;
  const frameWindow = iframe.contentWindow;
  if (!frameDocument || !frameWindow) {
    iframe.remove();
    throw new Error(
      "Could not create an iframe realm for the dashboard-grid test."
    );
  }
  return { iframe, frameDocument, frameWindow };
}

type CssEscapeHost = { escape?: (identifier: string) => string };

function replaceCssEscape(
  target: CssEscapeHost,
  replacement: CssEscapeHost["escape"]
): () => void {
  const previous = Object.getOwnPropertyDescriptor(target, "escape");
  Object.defineProperty(target, "escape", {
    configurable: true,
    writable: true,
    value: replacement,
  });
  return () => {
    if (previous) Object.defineProperty(target, "escape", previous);
    else Reflect.deleteProperty(target, "escape");
  };
}

it('defaults to an empty layout, 12 columns, 80px rows, 8px gap, and collision="reject"', async () => {
  const el = (await fixture(
    html`<lr-dashboard-grid></lr-dashboard-grid>`
  )) as LyraDashboardGrid;
  expect(el.layout).to.deep.equal([]);
  expect(el.columns).to.equal(12);
  expect(el.rowHeight).to.equal(80);
  expect(el.gap).to.equal(8);
  expect(el.collision).to.equal("reject");
  expect(el.cellsDraggable).to.be.false;
  expect(el.cellsResizable).to.be.false;
  expect(el.locked).to.be.false;
});

it("renders lr-empty with the noData message when layout is empty", async () => {
  const el = (await fixture(
    html`<lr-dashboard-grid></lr-dashboard-grid>`
  )) as LyraDashboardGrid;
  const empty = el.shadowRoot!.querySelector('[part="empty"]');
  expect(empty !== null).to.be.true;
  expect(empty!.tagName.toLowerCase()).to.equal("lr-empty");
  expect(empty!.getAttribute("heading")).to.equal("No data");
});

it("routes repeated announcements through a pre-mounted light-DOM sink and releases it", async () => {
  const el = (await fixture(
    html`<lr-dashboard-grid .layout=${twoCells()}></lr-dashboard-grid>`
  )) as LyraDashboardGrid;
  const selector = `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`;
  const sink = document.querySelector<HTMLElement>(selector)!;
  const mirror = el.shadowRoot!.querySelector<HTMLElement>(
    '[part="live-region"]'
  )!;

  expect(sink !== null, "the live region is mounted before interaction").to.be
    .true;
  expect(sink.childElementCount).to.equal(0);
  expect(mirror.getAttribute("aria-hidden")).to.equal("true");
  expect(mirror.hasAttribute("role")).to.be.false;
  expect(mirror.hasAttribute("aria-live")).to.be.false;

  const announcer = (
    el as unknown as {
      announcer: { announce(text: string, options: { force: boolean }): void };
    }
  ).announcer;
  announcer.announce("Alpha moved.", { force: true });
  announcer.announce("Alpha moved.", { force: true });
  await el.updateComplete;
  expect(Array.from(sink.children, (child) => child.textContent)).to.deep.equal(
    ["Alpha moved.", "Alpha moved."]
  );
  expect(mirror.textContent?.trim()).to.equal("Alpha moved.");

  el.remove();
  expect(document.querySelector(selector) === null).to.be.true;
  try {
    document.body.append(el);
    expect(
      document.querySelector<HTMLElement>(selector)?.childElementCount
    ).to.equal(0);
  } finally {
    el.remove();
  }
});

it("keeps keyboard-navigation feedback silent when the host or a composed ancestor is accessibility-excluded", async () => {
  const scenarios: Array<{
    label: string;
    exclude(host: LyraDashboardGrid, ancestor: HTMLElement): void;
  }> = [
    {
      label: "hidden host",
      exclude: (host) => {
        host.hidden = true;
      },
    },
    {
      label: "inert composed ancestor",
      exclude: (_host, ancestor) => {
        ancestor.setAttribute("inert", "");
      },
    },
    {
      label: "case-insensitive aria-hidden composed ancestor",
      exclude: (_host, ancestor) => {
        ancestor.setAttribute("aria-hidden", " TRUE ");
      },
    },
    {
      label: "display-none composed ancestor",
      exclude: (_host, ancestor) => {
        ancestor.style.display = "none";
      },
    },
  ];

  for (const scenario of scenarios) {
    const ancestor = document.createElement("div");
    const root = ancestor.attachShadow({ mode: "open" });
    root.append(document.createElement("slot"));
    const el = document.createElement("lr-dashboard-grid") as LyraDashboardGrid;
    el.layout = twoCells();
    ancestor.append(el);
    document.body.append(ancestor);

    try {
      await el.updateComplete;
      const sink = document.querySelector<HTMLElement>(
        `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`
      )!;
      const announcer = (
        el as unknown as {
          announcer: { throttleMs: number };
        }
      ).announcer;
      announcer.throttleMs = 0;
      scenario.exclude(el, ancestor);

      el.shadowRoot!.querySelector<HTMLElement>(
        '[data-cell-id="a"]'
      )!.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowRight",
          bubbles: true,
          cancelable: true,
        })
      );
      await new Promise<void>((resolve) => setTimeout(resolve, 20));

      expect(sink.childElementCount, scenario.label).to.equal(0);
    } finally {
      ancestor.remove();
    }
  }
});

it("is accessible in the empty state", async () => {
  const el = (await fixture(
    html`<lr-dashboard-grid></lr-dashboard-grid>`
  )) as LyraDashboardGrid;
  await expect(el).to.be.accessible();
});

describe("grid placement", () => {
  it("uses cellId as the public dashboard-cell identity", async () => {
    const el = await fixture<LyraDashboardGrid>(html`
      <lr-dashboard-grid></lr-dashboard-grid>
    `);
    el.layout = [
      { cellId: "revenue", x: 0, y: 0, w: 1, h: 1 },
    ] as unknown as LyraDashboardCell[];
    await el.updateComplete;

    expect(
      el.shadowRoot!.querySelector('[part="cell"]')?.getAttribute("data-cell-id")
    ).to.equal("revenue");
  });

  it("places a cell via grid-column/grid-row derived from x/y/w/h", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [{ cellId: "a", x: 1, y: 2, w: 3, h: 4 }];
    await el.updateComplete;
    const cellEl = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
    expect(cellEl.style.gridColumn).to.equal("2 / span 3");
    expect(cellEl.style.gridRow).to.equal("3 / span 4");
  });

  it("keeps computed geometry private so author-facing CSS properties retain cascade authority", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid
        columns="6"
        row-height="40"
        gap="4"
      ></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [{ cellId: "a", x: 0, y: 0, w: 1, h: 1 }];
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.style.getPropertyValue("--lr-dashboard-grid-columns")).to.equal(
      ""
    );
    expect(
      base.style.getPropertyValue("--lr-dashboard-grid-row-height")
    ).to.equal("");
    expect(base.style.getPropertyValue("--lr-dashboard-grid-gap")).to.equal("");
    expect(
      base.style.getPropertyValue("--_lr-dashboard-grid-computed-columns")
    ).to.equal("6");
    expect(
      base.style.getPropertyValue("--_lr-dashboard-grid-computed-row-height")
    ).to.equal("40px");
    expect(
      base.style.getPropertyValue("--_lr-dashboard-grid-computed-gap")
    ).to.equal("4px");

    el.style.setProperty("--lr-dashboard-grid-columns", "3");
    el.style.setProperty("--lr-dashboard-grid-row-height", "31px");
    el.style.setProperty("--lr-dashboard-grid-gap", "7px");
    const computed = getComputedStyle(base);
    expect(computed.gridTemplateColumns.split(" ")).to.have.length(3);
    expect(computed.gridAutoRows).to.equal("31px");
    expect(computed.gap).to.equal("7px");
  });

  it("renders cells in row-major order regardless of layout array order", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [
      { cellId: "second", x: 0, y: 1, w: 1, h: 1 },
      { cellId: "first", x: 0, y: 0, w: 1, h: 1 },
    ];
    await el.updateComplete;
    const ids = Array.from(
      el.shadowRoot!.querySelectorAll('[part="cell"]')
    ).map((c) => c.getAttribute("data-cell-id"));
    expect(ids).to.deep.equal(["first", "second"]);
  });

  it("normalizes non-finite public cell geometry before it reaches CSS layout", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [
      {
        cellId: "bad",
        x: Number.NaN,
        y: Number.POSITIVE_INFINITY,
        w: Number.NEGATIVE_INFINITY,
        h: Number.NaN,
      },
    ];
    await el.updateComplete;
    const cell = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
    expect(cell.style.gridColumn).to.equal("1 / span 1");
    expect(cell.style.gridRow).to.equal("1 / span 1");
    expect(cell.getAttribute("style")).to.not.include("NaN");
    expect(cell.getAttribute("style")).to.not.include("Infinity");
  });

  it("admits a bounded unique schema snapshot while retaining valid records around malformed input", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    const hostile = { cellId: "hostile", y: 1, w: 1, h: 1 };
    Object.defineProperty(hostile, "x", {
      get: () => {
        throw new Error("hostile x");
      },
    });
    (el as unknown as { layout: unknown }).layout = [
      { cellId: "a", x: 1, y: 0, w: 1, h: 1, label: "first" },
      null,
      { cellId: "a", x: 4, y: 4, w: 1, h: 1, label: "duplicate" },
      { cellId: 9, x: 0, y: 0, w: 1, h: 1 },
      hostile,
      { cellId: "tail", x: 2, y: 1, w: 1, h: 1 },
    ];
    await el.updateComplete;

    expect(el.layout.map((cell) => cell.cellId)).to.deep.equal(["a", "tail"]);
    expect(el.layout[0]).to.deep.include({ x: 1, label: "first" });
    expect(el.layout[1]).to.deep.include({ x: 2, y: 1 });
    expect(
      Array.from(el.shadowRoot!.querySelectorAll('[part="cell"]'), (cell) =>
        cell.getAttribute("data-cell-id")
      )
    ).to.deep.equal(["a", "tail"]);
    expect(el.querySelectorAll('[cell-id="a"]')).to.have.length(1);
  });

  it("normalizes foreign property and attribute collision values to reject", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid collision="push"></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    expect(el.collision).to.equal("push");

    (el as unknown as { collision: unknown }).collision = "pushy";
    expect(el.collision).to.equal("reject");
    el.setAttribute("collision", "foreign");
    await el.updateComplete;
    expect(el.collision).to.equal("reject");
  });

  it("normalizes non-finite geometry and constraints before placement events and layout snapshots", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid cells-draggable></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [
      {
        cellId: "bad",
        x: Number.NaN,
        y: Number.POSITIVE_INFINITY,
        w: Number.NaN,
        h: Number.NEGATIVE_INFINITY,
        minW: Number.NaN,
        maxW: Number.POSITIVE_INFINITY,
        minH: Number.NaN,
        maxH: Number.POSITIVE_INFINITY,
      },
    ];
    await el.updateComplete;
    const cell = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
    let move:
      | {
          position: { x: number; y: number };
          previous: { x: number; y: number };
        }
      | undefined;
    let snapshot: LyraDashboardCell[] | undefined;
    el.addEventListener(
      "lr-cell-move",
      (event) => (move = (event as CustomEvent).detail)
    );
    el.addEventListener(
      "lr-layout-change",
      (event) => (snapshot = (event as CustomEvent).detail.layout)
    );

    cell.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
    );

    expect(move).to.deep.equal({
      cellId: "bad",
      position: { x: 1, y: 0 },
      previous: { x: 0, y: 0 },
    });
    const proposed = snapshot![0]!;
    expect(
      [
        proposed.x,
        proposed.y,
        proposed.w,
        proposed.h,
        proposed.minW,
        proposed.maxW,
        proposed.minH,
        proposed.maxH,
      ].every((value) => value === undefined || Number.isFinite(value))
    ).to.be.true;
  });
});

describe("default cell composition", () => {
  it("adopts a default lr-widget/lr-widget-renderer pair for a layout entry with no matching child", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [
      {
        cellId: "a",
        x: 0,
        y: 0,
        w: 2,
        h: 1,
        label: "Users",
        widget: { type: "stat", props: { label: "Users", value: "12" } },
      },
    ];
    await el.updateComplete;
    const widget = el.querySelector('[cell-id="a"]') as HTMLElement;
    expect(widget !== null).to.be.true;
    expect(widget.tagName.toLowerCase()).to.equal("lr-widget");
    expect(widget.getAttribute("slot")).to.equal("cell-a");
    expect((widget as unknown as { label: string }).label).to.equal("Users");
    const renderer = widget.querySelector("lr-widget-renderer") as unknown as {
      document: { version: "2"; root: unknown } | null;
    } & Element;
    expect(renderer !== null).to.be.true;
    expect(renderer.document).to.deep.equal({
      version: "2",
      root: { type: "stat", props: { label: "Users", value: "12" } },
    });
    expect(Object.isFrozen(renderer.document)).to.be.true;
    await (renderer as unknown as { updateComplete: Promise<unknown> })
      .updateComplete;
    expect(renderer.shadowRoot!.querySelector("lr-stat") !== null).to.be.true;
  });

  it("creates default cells in the adopted grid's owner realm", async () => {
    const { iframe, frameDocument, frameWindow } = createRealmFrame();
    const FrameHTMLElement = frameWindow.HTMLElement;
    frameWindow.customElements.define(
      tag("widget"),
      class extends FrameHTMLElement {}
    );
    frameWindow.customElements.define(
      tag("widget-renderer"),
      class extends FrameHTMLElement {}
    );
    // Render once in the defining realm so Lit attaches its constructed stylesheets before the
    // normal custom-element adoption lifecycle moves the existing shadow root to another document.
    const el = (await fixture(
      html`<lr-dashboard-grid></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.remove();
    frameDocument.adoptNode(el);
    el.layout = [
      {
        cellId: "realm-cell",
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        widget: { type: "text", props: { text: "Realm content" } },
      },
    ];

    try {
      frameDocument.body.append(el);
      await el.updateComplete;

      const widget = el.querySelector<HTMLElement>('[cell-id="realm-cell"]');
      const renderer = widget?.querySelector<HTMLElement>(
        tag("widget-renderer")
      );
      expect(widget !== null).to.be.true;
      expect(renderer !== null && renderer !== undefined).to.be.true;
      expect(widget instanceof frameWindow.HTMLElement).to.be.true;
      expect(renderer instanceof frameWindow.HTMLElement).to.be.true;
      expect(widget?.ownerDocument === frameDocument).to.be.true;
      expect(renderer?.ownerDocument === frameDocument).to.be.true;
    } finally {
      iframe.remove();
    }
  });

  it("updates an already-adopted default cell in place when layout changes", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [{ cellId: "a", x: 0, y: 0, w: 1, h: 1, label: "First" }];
    await el.updateComplete;
    const widget = el.querySelector('[cell-id="a"]') as HTMLElement;
    el.layout = [{ cellId: "a", x: 0, y: 0, w: 1, h: 1, label: "Renamed" }];
    await el.updateComplete;
    expect(el.querySelectorAll('[cell-id="a"]').length).to.equal(1);
    expect(
      (el.querySelector('[cell-id="a"]') as unknown as { label: string }).label
    ).to.equal("Renamed");
    expect(el.querySelector('[cell-id="a"]') === widget).to.be.true;
  });

  it("routes a user-authored child into its wrapper by cell-id instead of creating a default cell", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid .layout=${[{ cellId: "a", x: 0, y: 0, w: 1, h: 1 }]}
        ><div cell-id="a">Custom</div></lr-dashboard-grid
      >`
    )) as LyraDashboardGrid;
    await el.updateComplete;
    const custom = el.querySelector('[cell-id="a"]') as HTMLElement;
    expect(custom.tagName.toLowerCase()).to.equal("div");
    expect(custom.getAttribute("slot")).to.equal("cell-a");
    expect(el.querySelectorAll('[cell-id="a"]').length).to.equal(1);
  });

  it("warns and leaves a stale user-authored child unslotted when its cell-id matches no layout entry", async () => {
    const originalWarn = console.warn;
    let warning: unknown[] | undefined;
    console.warn = (...args: unknown[]) => {
      warning = args;
    };
    const el = (await fixture(
      html`<lr-dashboard-grid
        ><div cell-id="ghost">Gone</div></lr-dashboard-grid
      >`
    )) as LyraDashboardGrid;
    try {
      el.layout = twoCells();
      await el.updateComplete;
    } finally {
      console.warn = originalWarn;
    }
    expect(warning?.join(" ")).to.include('cell-id="ghost"');
    expect(el.querySelector('[cell-id="ghost"]')!.getAttribute("slot")).to.be
      .null;
  });

  it("removes a default cell once its layout entry disappears", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [{ cellId: "a", x: 0, y: 0, w: 1, h: 1 }];
    await el.updateComplete;
    expect(el.querySelector('[cell-id="a"]') !== null).to.be.true;
    el.layout = [];
    await el.updateComplete;
    expect(el.querySelector('[cell-id="a"]') === null).to.be.true;
  });

  it("reconciles late authored insertion/removal and restores authored slot ownership across reconnect", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [{ cellId: "a", x: 0, y: 0, w: 1, h: 1 }];
    await el.updateComplete;
    const initialDefault = el.querySelector('[cell-id="a"]')!;

    const authored = document.createElement("div");
    authored.setAttribute("cell-id", "a");
    authored.setAttribute("slot", "author-slot");
    el.append(authored);
    await settleChildReconciliation(el);

    expect(el.querySelectorAll('[cell-id="a"]')).to.have.length(1);
    expect(el.querySelector('[cell-id="a"]') === authored).to.be.true;
    expect(authored.getAttribute("slot")).to.equal("cell-a");
    expect(initialDefault.isConnected).to.be.false;

    el.remove();
    expect(authored.getAttribute("slot")).to.equal("author-slot");
    document.body.append(el);
    await settleChildReconciliation(el);
    expect(el.querySelector('[cell-id="a"]') === authored).to.be.true;
    expect(authored.getAttribute("slot")).to.equal("cell-a");

    authored.remove();
    await settleChildReconciliation(el);
    const restoredDefault = el.querySelector('[cell-id="a"]')!;
    expect(restoredDefault !== null).to.be.true;
    expect(restoredDefault !== authored).to.be.true;
    expect(restoredDefault.hasAttribute("data-dashboard-grid-default-cell")).to
      .be.true;
    expect(authored.getAttribute("slot")).to.equal("author-slot");
    el.remove();
  });

  it("uses first-authored ownership, preserves duplicate identities, and ignores a forged default marker", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    const first = document.createElement("div");
    first.setAttribute("cell-id", "a");
    first.setAttribute("slot", "first-slot");
    first.setAttribute("data-dashboard-grid-default-cell", "");
    const second = document.createElement("div");
    second.setAttribute("cell-id", "a");
    second.setAttribute("slot", "second-slot");
    el.append(first, second);
    el.layout = [
      { cellId: "a", x: 0, y: 0, w: 1, h: 1 },
      { cellId: "b", x: 1, y: 0, w: 1, h: 1 },
    ];
    await settleChildReconciliation(el);

    expect(first.getAttribute("slot")).to.equal("cell-a");
    expect(second.getAttribute("slot")).to.equal("second-slot");
    expect(first.isConnected).to.be.true;
    expect(el.querySelectorAll('[cell-id="a"]')).to.have.length(2);

    first.remove();
    await settleChildReconciliation(el);
    expect(second.getAttribute("slot")).to.equal("cell-a");
    expect(first.getAttribute("slot")).to.equal("first-slot");

    second.setAttribute("cell-id", "b");
    await settleChildReconciliation(el);
    expect(second.getAttribute("slot")).to.equal("cell-b");
    expect(el.querySelector('[cell-id="b"]') === second).to.be.true;
    expect(
      el
        .querySelector('[cell-id="a"]')
        ?.hasAttribute("data-dashboard-grid-default-cell")
    ).to.be.true;
  });

  it("rebinds direct-child observation after cross-document adoption", async () => {
    const { iframe, frameDocument } = createRealmFrame();
    const el = (await fixture(
      html`<lr-dashboard-grid></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.remove();
    frameDocument.adoptNode(el);
    el.layout = [{ cellId: "a", x: 0, y: 0, w: 1, h: 1 }];

    try {
      frameDocument.body.append(el);
      await settleChildReconciliation(el);
      const defaultCell = el.querySelector('[cell-id="a"]')!;
      const authored = frameDocument.createElement("div");
      authored.setAttribute("cell-id", "a");
      el.append(authored);
      await settleChildReconciliation(el);

      expect(el.querySelector('[cell-id="a"]') === authored).to.be.true;
      expect(defaultCell.isConnected).to.be.false;
      expect(authored.ownerDocument === frameDocument).to.be.true;
    } finally {
      iframe.remove();
    }
  });
});

describe("owner-realm pointer interactions", () => {
  it("schedules and cancels announcement throttling in an adopted grid's owner window", async () => {
    const { iframe, frameDocument, frameWindow } = createRealmFrame();
    const scheduled = new Map<number, VoidFunction>();
    const delays: number[] = [];
    const cleared: number[] = [];
    let nextTimer = 700;
    const originalSetTimeout = frameWindow.setTimeout;
    const originalClearTimeout = frameWindow.clearTimeout;
    frameWindow.setTimeout = ((handler: TimerHandler, timeout = 0) => {
      if (typeof handler !== "function") {
        throw new TypeError(
          "The dashboard-grid test only accepts timer callbacks."
        );
      }
      const timer = nextTimer++;
      scheduled.set(timer, handler as VoidFunction);
      delays.push(timeout);
      return timer;
    }) as typeof frameWindow.setTimeout;
    frameWindow.clearTimeout = ((timer?: number) => {
      if (timer === undefined) return;
      cleared.push(timer);
      scheduled.delete(timer);
    }) as typeof frameWindow.clearTimeout;
    const el = (await fixture(
      html`<lr-dashboard-grid></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.remove();
    frameDocument.adoptNode(el);
    el.layout = twoCells();
    for (const cell of el.layout) {
      const content = frameDocument.createElement("div");
      content.setAttribute("cell-id", cell.cellId);
      el.append(content);
    }

    try {
      frameDocument.body.append(el);
      await el.updateComplete;
      el.shadowRoot!.querySelector<HTMLElement>(
        '[data-cell-id="a"]'
      )!.dispatchEvent(
        new frameWindow.KeyboardEvent("keydown", {
          key: "ArrowRight",
          bubbles: true,
          cancelable: true,
        })
      );

      expect(
        scheduled.size,
        "the frame schedules the pending announcement"
      ).to.equal(1);
      expect(delays).to.deep.equal([500]);
      const [timer] = scheduled.keys();
      el.remove();
      expect(
        cleared,
        "disconnect cancels through the same frame window"
      ).to.deep.equal([timer]);
    } finally {
      el.remove();
      frameWindow.setTimeout = originalSetTimeout;
      frameWindow.clearTimeout = originalClearTimeout;
      iframe.remove();
    }
  });

  it("listens for an adopted grid's gesture events on its owner window", async () => {
    const { iframe, frameDocument, frameWindow } = createRealmFrame();
    const el = (await fixture(
      html`<lr-dashboard-grid></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.remove();
    frameDocument.adoptNode(el);
    el.cellsDraggable = true;
    el.columns = 4;
    el.layout = [{ cellId: "a", x: 0, y: 0, w: 1, h: 1 }];
    const content = frameDocument.createElement("div");
    content.setAttribute("cell-id", "a");
    el.append(content);

    try {
      frameDocument.body.append(el);
      await el.updateComplete;
      const wrapper =
        el.shadowRoot!.querySelector<HTMLElement>('[part="cell"]')!;
      wrapper.setPointerCapture = () => {};
      let moveDetail: { position: { x: number; y: number } } | undefined;
      el.addEventListener("lr-cell-move", (event) => {
        moveDetail = (event as CustomEvent).detail;
      });

      wrapper.dispatchEvent(
        new frameWindow.PointerEvent("pointerdown", {
          isPrimary: true,
          pointerId: 17,
          button: 0,
          clientX: 0,
          clientY: 0,
          bubbles: true,
          composed: true,
        })
      );
      frameWindow.dispatchEvent(
        new frameWindow.PointerEvent("pointermove", {
          pointerId: 17,
          clientX: 10_000,
          clientY: 0,
        })
      );
      frameWindow.dispatchEvent(
        new frameWindow.PointerEvent("pointerup", {
          pointerId: 17,
          clientX: 10_000,
          clientY: 0,
        })
      );

      expect(moveDetail?.position).to.deep.equal({ x: 3, y: 0 });
    } finally {
      iframe.remove();
    }
  });

  it("does not start a drag from an iframe-realm interactive cell child", async () => {
    const { iframe, frameDocument, frameWindow } = createRealmFrame();
    const el = (await fixture(
      html`<lr-dashboard-grid></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.remove();
    frameDocument.adoptNode(el);
    el.cellsDraggable = true;
    el.layout = [{ cellId: "a", x: 0, y: 0, w: 1, h: 1 }];
    const button = frameDocument.createElement("button");
    button.setAttribute("cell-id", "a");
    el.append(button);

    try {
      frameDocument.body.append(el);
      await el.updateComplete;
      const wrapper =
        el.shadowRoot!.querySelector<HTMLElement>('[part="cell"]')!;
      wrapper.setPointerCapture = () => {};

      button.dispatchEvent(
        new frameWindow.PointerEvent("pointerdown", {
          isPrimary: true,
          pointerId: 23,
          button: 0,
          bubbles: true,
          composed: true,
        })
      );

      expect(wrapper.hasAttribute("data-dragging")).to.be.false;
    } finally {
      iframe.remove();
    }
  });

  it("listens for an adopted grid's resize events on its owner window", async () => {
    const { iframe, frameDocument, frameWindow } = createRealmFrame();
    const el = (await fixture(
      html`<lr-dashboard-grid></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.remove();
    frameDocument.adoptNode(el);
    el.cellsResizable = true;
    el.columns = 4;
    el.layout = [{ cellId: "a", x: 0, y: 0, w: 1, h: 1 }];
    const content = frameDocument.createElement("div");
    content.setAttribute("cell-id", "a");
    el.append(content);

    try {
      frameDocument.body.append(el);
      await el.updateComplete;
      const handle = el.shadowRoot!.querySelector<HTMLElement>(
        '[part="resize-handle"]'
      )!;
      handle.setPointerCapture = () => {};
      let resizeDetail: { size: { w: number; h: number } } | undefined;
      el.addEventListener("lr-cell-resize", (event) => {
        resizeDetail = (event as CustomEvent).detail;
      });

      handle.dispatchEvent(
        new frameWindow.PointerEvent("pointerdown", {
          isPrimary: true,
          pointerId: 29,
          button: 0,
          clientX: 0,
          clientY: 0,
          bubbles: true,
          composed: true,
        })
      );
      frameWindow.dispatchEvent(
        new frameWindow.PointerEvent("pointermove", {
          pointerId: 29,
          clientX: 10_000,
          clientY: 0,
        })
      );
      frameWindow.dispatchEvent(
        new frameWindow.PointerEvent("pointerup", {
          pointerId: 29,
          clientX: 10_000,
          clientY: 0,
        })
      );

      expect(resizeDetail?.size).to.deep.equal({ w: 4, h: 1 });
    } finally {
      iframe.remove();
    }
  });
});

describe("roving keyboard navigation", () => {
  it("moves the roving tabindex forward/backward through row-major order with arrow keys", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = twoCells();
    await el.updateComplete;
    const [a, b] = Array.from(
      el.shadowRoot!.querySelectorAll('[part="cell"]')
    ) as HTMLElement[];
    expect(a.getAttribute("tabindex")).to.equal("0");
    expect(b.getAttribute("tabindex")).to.equal("-1");
    a.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    expect(a.getAttribute("tabindex")).to.equal("-1");
    expect(b.getAttribute("tabindex")).to.equal("0");
    expect(el.shadowRoot!.activeElement === b).to.equal(true);
  });

  it("uses the adopted owner realm CSS escape when keyboard focus targets a special cell id", async () => {
    const specialId = 'target"] [data-cell-id="decoy';
    const layout: LyraDashboardCell[] = [
      { cellId: "start", x: 0, y: 0, w: 1, h: 1 },
      { cellId: specialId, x: 1, y: 0, w: 1, h: 1 },
      { cellId: "decoy", x: 2, y: 0, w: 1, h: 1 },
    ];
    const { iframe, frameDocument, frameWindow } = createRealmFrame();
    const el = (await fixture(
      html`<lr-dashboard-grid .layout=${layout}></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.remove();
    frameDocument.adoptNode(el);
    frameDocument.body.append(el);
    await el.updateComplete;

    const ownerEscape = frameWindow.CSS.escape.bind(frameWindow.CSS);
    let ownerCalls = 0;
    const restoreOwner = replaceCssEscape(frameWindow.CSS, (identifier) => {
      ownerCalls += 1;
      return ownerEscape(identifier);
    });
    const restoreAmbient = replaceCssEscape(CSS, () => "decoy");
    try {
      el.shadowRoot!.querySelector<HTMLElement>(
        '[data-cell-id="start"]'
      )!.dispatchEvent(
        new frameWindow.KeyboardEvent("keydown", {
          key: "ArrowRight",
          bubbles: true,
          cancelable: true,
        })
      );
      await el.updateComplete;
      await Promise.resolve();

      expect(ownerCalls).to.equal(1);
      expect(
        (el.shadowRoot!.activeElement as HTMLElement | null)?.dataset["cellId"]
      ).to.equal(specialId);
    } finally {
      restoreAmbient();
      restoreOwner();
      el.remove();
      iframe.remove();
    }
  });

  it("falls back to an exact cell-id scan when adopted owner CSS escape is missing or throws", async () => {
    const specialId = 'target"] [data-cell-id="decoy';
    const layout: LyraDashboardCell[] = [
      { cellId: "start", x: 0, y: 0, w: 1, h: 1 },
      { cellId: specialId, x: 1, y: 0, w: 1, h: 1 },
      { cellId: "decoy", x: 2, y: 0, w: 1, h: 1 },
    ];
    for (const mode of ["missing", "throwing"] as const) {
      const { iframe, frameDocument, frameWindow } = createRealmFrame();
      const el = (await fixture(
        html`<lr-dashboard-grid .layout=${layout}></lr-dashboard-grid>`
      )) as LyraDashboardGrid;
      el.remove();
      frameDocument.adoptNode(el);
      frameDocument.body.append(el);
      await el.updateComplete;

      let ownerCalls = 0;
      const restoreOwner = replaceCssEscape(
        frameWindow.CSS,
        mode === "missing"
          ? undefined
          : () => {
              ownerCalls += 1;
              throw new Error("owner CSS escape unavailable");
            }
      );
      const restoreAmbient = replaceCssEscape(CSS, () => "decoy");
      try {
        el.shadowRoot!.querySelector<HTMLElement>(
          '[data-cell-id="start"]'
        )!.dispatchEvent(
          new frameWindow.KeyboardEvent("keydown", {
            key: "ArrowRight",
            bubbles: true,
            cancelable: true,
          })
        );
        await el.updateComplete;
        await Promise.resolve();

        expect(
          (el.shadowRoot!.activeElement as HTMLElement | null)?.dataset[
            "cellId"
          ]
        ).to.equal(specialId);
        expect(ownerCalls).to.equal(mode === "throwing" ? 1 : 0);
      } finally {
        restoreAmbient();
        restoreOwner();
        el.remove();
        iframe.remove();
      }
    }
  });

  it("Home/End jump to the first/last cell", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [...twoCells(), { cellId: "c", x: 0, y: 1, w: 1, h: 1 }];
    await el.updateComplete;
    const cells = Array.from(
      el.shadowRoot!.querySelectorAll('[part="cell"]')
    ) as HTMLElement[];
    cells[0].dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "End",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    expect(cells[2].getAttribute("tabindex")).to.equal("0");
  });

  it("flips the forward-key direction under an RTL ancestor", async () => {
    const el = (
      await fixture(
        html`<div dir="rtl"><lr-dashboard-grid></lr-dashboard-grid></div>`
      )
    ).querySelector("lr-dashboard-grid") as LyraDashboardGrid;
    el.layout = twoCells();
    await el.updateComplete;
    const [a, b] = Array.from(
      el.shadowRoot!.querySelectorAll('[part="cell"]')
    ) as HTMLElement[];
    a.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowLeft",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    expect(b.getAttribute("tabindex")).to.equal("0");
  });

  it("keeps the active cell identity stable when the public layout is reordered", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = twoCells();
    await el.updateComplete;
    const first = el.shadowRoot!.querySelector(
      '[data-cell-id="a"]'
    ) as HTMLElement;
    first.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    expect(
      el
        .shadowRoot!.querySelector('[tabindex="0"]')!
        .getAttribute("data-cell-id")
    ).to.equal("b");

    el.layout = [
      { cellId: "b", x: 0, y: 0, w: 1, h: 1, label: "Beta" },
      { cellId: "a", x: 2, y: 0, w: 1, h: 1, label: "Alpha" },
    ];
    await el.updateComplete;
    expect(
      el
        .shadowRoot!.querySelector('[tabindex="0"]')!
        .getAttribute("data-cell-id")
    ).to.equal("b");
  });

  it("rehomes focus when the focused active cell is removed", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = twoCells();
    await el.updateComplete;
    const second = el.shadowRoot!.querySelector(
      '[data-cell-id="b"]'
    ) as HTMLElement;
    second.focus();
    el.layout = [twoCells()[0]!];
    await el.updateComplete;

    const focused = el.shadowRoot!.activeElement as HTMLElement | null;
    expect(focused?.dataset["cellId"]).to.equal("a");
    expect(focused?.tabIndex).to.equal(0);
  });

  it("leaves plain and modified arrow keys to a nested cell control", async () => {
    const el = (await fixture(html`
      <lr-dashboard-grid cells-draggable cells-resizable .layout=${twoCells()}>
        <div cell-id="a"><input aria-label="Cell editor" /></div>
        <div cell-id="b">Beta</div>
      </lr-dashboard-grid>
    `)) as LyraDashboardGrid;
    await el.updateComplete;
    const input = el.querySelector("input")!;
    let moves = 0;
    let resizes = 0;
    el.addEventListener("lr-cell-move", () => moves++);
    el.addEventListener("lr-cell-resize", () => resizes++);

    const plain = new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    input.dispatchEvent(plain);
    const modified = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    input.dispatchEvent(modified);
    await el.updateComplete;

    expect(plain.defaultPrevented).to.be.false;
    expect(modified.defaultPrevented).to.be.false;
    expect(moves).to.equal(0);
    expect(resizes).to.equal(0);
    expect(
      el
        .shadowRoot!.querySelector('[data-cell-id="a"]')!
        .getAttribute("tabindex")
    ).to.equal("0");
  });
});

describe("keyboard move (Ctrl/Cmd+Arrow)", () => {
  it("moves the focused cell by one grid unit and emits lr-cell-move + lr-layout-change", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid cells-draggable></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [{ cellId: "a", x: 2, y: 2, w: 1, h: 1 }];
    await el.updateComplete;
    const cellEl = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
    let moveDetail: unknown;
    let layoutDetail: { layout: LyraDashboardCell[] } | undefined;
    el.addEventListener(
      "lr-cell-move",
      (e) => (moveDetail = (e as CustomEvent).detail)
    );
    el.addEventListener(
      "lr-layout-change",
      (e) => (layoutDetail = (e as CustomEvent).detail)
    );
    cellEl.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
    expect(moveDetail).to.deep.equal({
      cellId: "a",
      position: { x: 3, y: 2 },
      previous: { x: 2, y: 2 },
    });
    expect(layoutDetail!.layout.find((c) => c.cellId === "a")).to.deep.include({
      x: 3,
      y: 2,
    });
    expect(Object.isFrozen(layoutDetail)).to.be.true;
    expect(Object.isFrozen(layoutDetail!.layout)).to.be.true;
    expect(Object.isFrozen(layoutDetail!.layout[0])).to.be.true;
    expect(Object.isFrozen(moveDetail)).to.be.true;
    expect(
      Object.isFrozen(
        (moveDetail as { position: object; previous: object }).position
      )
    ).to.be.true;
    expect(
      Object.isFrozen(
        (moveDetail as { position: object; previous: object }).previous
      )
    ).to.be.true;
    expect(Object.isFrozen(layoutDetail)).to.be.true;
    expect(Object.isFrozen(layoutDetail!.layout)).to.be.true;
    expect(Object.isFrozen(layoutDetail!.layout[0])).to.be.true;
  });

  it('announces successful move and resize only after the host applies each controlled layout request', async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid cells-draggable cells-resizable></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [
      { cellId: 'a', x: 0, y: 0, w: 1, h: 1, label: 'Alpha' },
    ];
    await el.updateComplete;

    const announcer = (
      el as unknown as { announcer: { throttleMs: number } }
    ).announcer;
    announcer.throttleMs = 0;
    const mirror = el.shadowRoot!.querySelector<HTMLElement>(
      '[part="live-region"]'
    )!;
    let proposedLayout: readonly LyraDashboardCell[] | undefined;
    el.addEventListener('lr-layout-change', (event) => {
      proposedLayout = event.detail.layout;
    });

    const cell = el.shadowRoot!.querySelector<HTMLElement>('[part="cell"]')!;
    cell.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    expect(el.layout[0]!.x).to.equal(0);
    expect(mirror.textContent?.trim()).to.equal('');

    el.layout = proposedLayout!;
    await el.updateComplete;
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    expect(mirror.textContent?.trim()).to.equal(
      'Alpha moved to column 2, row 1.'
    );

    proposedLayout = undefined;
    el.shadowRoot!.querySelector<HTMLElement>('[part="cell"]')!.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    expect(el.layout[0]!.w).to.equal(1);
    expect(mirror.textContent?.trim()).to.equal(
      'Alpha moved to column 2, row 1.'
    );

    el.layout = proposedLayout!;
    await el.updateComplete;
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    expect(mirror.textContent?.trim()).to.equal(
      'Alpha resized to width 2, height 1.'
    );
  });

  it("flips ArrowRight to decrease x under RTL, matching the roving-nav direction convention", async () => {
    const host = (await fixture(
      html`<div dir="rtl">
        <lr-dashboard-grid cells-draggable></lr-dashboard-grid>
      </div>`
    )) as HTMLElement;
    const el = host.querySelector("lr-dashboard-grid") as LyraDashboardGrid;
    el.layout = [{ cellId: "a", x: 2, y: 0, w: 1, h: 1 }];
    await el.updateComplete;
    const cellEl = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
    let detail: { position: { x: number; y: number } } | undefined;
    el.addEventListener(
      "lr-cell-move",
      (e) => (detail = (e as CustomEvent).detail)
    );
    cellEl.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
    expect(detail!.position.x).to.equal(1);
  });

  it("does nothing when cells-draggable is unset", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [{ cellId: "a", x: 2, y: 2, w: 1, h: 1 }];
    await el.updateComplete;
    const cellEl = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
    let fired = false;
    el.addEventListener("lr-cell-move", () => (fired = true));
    cellEl.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
    expect(fired).to.be.false;
  });

  it("does nothing for a locked cell", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid cells-draggable></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [{ cellId: "a", x: 2, y: 2, w: 1, h: 1, locked: true }];
    await el.updateComplete;
    const cellEl = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
    let fired = false;
    el.addEventListener("lr-cell-move", () => (fired = true));
    cellEl.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
    expect(fired).to.be.false;
  });
});

describe("keyboard resize (Ctrl/Cmd+Shift+Arrow)", () => {
  it("grows the focused cell by one column and emits lr-cell-resize + lr-layout-change", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid cells-resizable></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [{ cellId: "a", x: 0, y: 0, w: 2, h: 2 }];
    await el.updateComplete;
    const cellEl = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
    let resizeDetail: unknown;
    let layoutDetail: { layout: LyraDashboardCell[] } | undefined;
    el.addEventListener(
      "lr-cell-resize",
      (e) => (resizeDetail = (e as CustomEvent).detail)
    );
    el.addEventListener(
      "lr-layout-change",
      (e) => (layoutDetail = (e as CustomEvent).detail)
    );
    cellEl.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
    expect(resizeDetail).to.deep.equal({
      cellId: "a",
      size: { w: 3, h: 2 },
      previous: { w: 2, h: 2 },
    });
    expect(layoutDetail!.layout.find((c) => c.cellId === "a")).to.deep.include({
      w: 3,
      h: 2,
    });
  });

  it("shrinks but never below 1 column/row", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid cells-resizable></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [{ cellId: "a", x: 0, y: 0, w: 1, h: 1 }];
    await el.updateComplete;
    const cellEl = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
    let resizeDetail: { size: { w: number; h: number } } | undefined;
    el.addEventListener(
      "lr-cell-resize",
      (e) => (resizeDetail = (e as CustomEvent).detail)
    );
    cellEl.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowLeft",
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
    // Requested w=0 clamps to minW=1 -- an unchanged size never commits (no-op, not a spurious event).
    expect(resizeDetail).to.be.undefined;
  });

  it("keeps physical Right=grow and Left=shrink under RTL", async () => {
    const host = (await fixture(html`
      <div dir="rtl">
        <lr-dashboard-grid cells-resizable></lr-dashboard-grid>
      </div>
    `)) as HTMLElement;
    const el = host.querySelector("lr-dashboard-grid") as LyraDashboardGrid;
    el.layout = [{ cellId: "a", x: 0, y: 0, w: 2, h: 1 }];
    await el.updateComplete;
    const cell = el.shadowRoot!.querySelector('[part="cell"]')!;
    const widths: number[] = [];
    el.addEventListener("lr-cell-resize", (event) => {
      widths.push(
        (event as CustomEvent<{ size: { w: number } }>).detail.size.w
      );
    });

    cell.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
    cell.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowLeft",
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      })
    );

    expect(widths).to.deep.equal([3, 1]);
  });

  it("does nothing when cells-resizable is unset", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [{ cellId: "a", x: 0, y: 0, w: 2, h: 2 }];
    await el.updateComplete;
    const cellEl = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
    let fired = false;
    el.addEventListener("lr-cell-resize", () => (fired = true));
    cellEl.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
    expect(fired).to.be.false;
  });
});

describe("collision policy", () => {
  it("reject: blocks a move onto an occupied cell, fires lr-collision, and leaves layout untouched", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid
        cells-draggable
        collision="reject"
      ></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    const layout: LyraDashboardCell[] = [
      { cellId: "a", x: 0, y: 0, w: 1, h: 1 },
      { cellId: "b", x: 1, y: 0, w: 1, h: 1 },
    ];
    el.layout = layout;
    await el.updateComplete;
    const cellA = el.shadowRoot!.querySelector(
      '[data-cell-id="a"]'
    ) as HTMLElement;
    let moveFired = false;
    let collisionDetail:
      | { cellId: string; collidedCellIds: string[]; accepted: boolean }
      | undefined;
    el.addEventListener("lr-cell-move", () => (moveFired = true));
    el.addEventListener(
      "lr-collision",
      (e) => (collisionDetail = (e as CustomEvent).detail)
    );
    cellA.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
    expect(moveFired).to.be.false;
    expect(collisionDetail).to.deep.equal({
      cellId: "a",
      collidedCellIds: ["b"],
      policy: "reject",
      accepted: false,
    });
    expect(Object.isFrozen(collisionDetail)).to.be.true;
    expect(Object.isFrozen(collisionDetail!.collidedCellIds)).to.be.true;
    expect(
      Object.isFrozen(
        (collisionDetail as { collidedCellIds: readonly string[] }).collidedCellIds
      )
    ).to.be.true;
    expect(el.layout).to.not.equal(layout);
    expect(el.layout).to.deep.equal(layout);
  });

  it("push: displaces the occupying cell and reports the layout-change cascade", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid
        cells-draggable
        collision="push"
      ></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [
      { cellId: "a", x: 0, y: 0, w: 1, h: 1 },
      { cellId: "b", x: 1, y: 0, w: 1, h: 1 },
    ];
    await el.updateComplete;
    const cellA = el.shadowRoot!.querySelector(
      '[data-cell-id="a"]'
    ) as HTMLElement;
    let layoutDetail: { layout: LyraDashboardCell[] } | undefined;
    el.addEventListener(
      "lr-layout-change",
      (e) => (layoutDetail = (e as CustomEvent).detail)
    );
    cellA.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
    const a = layoutDetail!.layout.find((c) => c.cellId === "a")!;
    const b = layoutDetail!.layout.find((c) => c.cellId === "b")!;
    expect(a).to.deep.include({ x: 1, y: 0 });
    expect(b).to.deep.include({ x: 1, y: 1 });
  });

  it("overlap: allows a colliding move while still reporting lr-collision", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid
        cells-draggable
        collision="overlap"
      ></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [
      { cellId: "a", x: 0, y: 0, w: 1, h: 1 },
      { cellId: "b", x: 1, y: 0, w: 1, h: 1 },
    ];
    await el.updateComplete;
    const cellA = el.shadowRoot!.querySelector(
      '[data-cell-id="a"]'
    ) as HTMLElement;
    let moveDetail: { position: { x: number; y: number } } | undefined;
    let collisionDetail: { accepted: boolean } | undefined;
    el.addEventListener(
      "lr-cell-move",
      (e) => (moveDetail = (e as CustomEvent).detail)
    );
    el.addEventListener(
      "lr-collision",
      (e) => (collisionDetail = (e as CustomEvent).detail)
    );
    cellA.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
    expect(moveDetail!.position).to.deep.equal({ x: 1, y: 0 });
    expect(collisionDetail!.accepted).to.be.true;
  });
});

describe("pointer drag", () => {
  it("coalesces repeated pointermove previews into one owner-window animation frame", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid
        cells-draggable
        row-height="50"
        gap="8"
      ></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [{ cellId: "a", x: 0, y: 0, w: 1, h: 1 }];
    await el.updateComplete;
    const wrapper = el.shadowRoot!.querySelector(
      '[part="cell"]'
    ) as HTMLElement;
    wrapper.setPointerCapture = () => {};
    wrapper.releasePointerCapture = () => {};
    const originalRequest = window.requestAnimationFrame;
    const originalCancel = window.cancelAnimationFrame;
    const callbacks = new Map<number, FrameRequestCallback>();
    let nextFrame = 400;
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      const frame = nextFrame++;
      callbacks.set(frame, callback);
      return frame;
    }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((frame: number) => {
      callbacks.delete(frame);
    }) as typeof window.cancelAnimationFrame;

    try {
      const originalRow = wrapper.style.gridRow;
      wrapper.dispatchEvent(
        new PointerEvent("pointerdown", {
          isPrimary: true,
          pointerId: 301,
          button: 0,
          clientX: 0,
          clientY: 0,
          bubbles: true,
        })
      );
      for (const clientY of [58, 116, 174]) {
        window.dispatchEvent(
          new PointerEvent("pointermove", {
            pointerId: 301,
            clientX: 0,
            clientY,
          })
        );
      }

      expect(callbacks.size).to.equal(1);
      expect(wrapper.style.gridRow).to.equal(originalRow);
      const [callback] = callbacks.values();
      callbacks.clear();
      callback!(performance.now());
      expect(wrapper.style.gridRow).to.equal("4 / span 1");
      window.dispatchEvent(
        new PointerEvent("pointercancel", { pointerId: 301 })
      );
    } finally {
      window.requestAnimationFrame = originalRequest;
      window.cancelAnimationFrame = originalCancel;
    }
  });

  it("suppresses the synthetic click after movement but admits the next ordinary click", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid
        cells-draggable
        row-height="50"
        gap="8"
      ></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [{ cellId: "a", x: 0, y: 0, w: 1, h: 1 }];
    await el.updateComplete;
    const wrapper = el.shadowRoot!.querySelector(
      '[part="cell"]'
    ) as HTMLElement;
    wrapper.setPointerCapture = () => {};
    wrapper.releasePointerCapture = () => {};
    wrapper.dispatchEvent(
      new PointerEvent("pointerdown", {
        isPrimary: true,
        pointerId: 302,
        button: 0,
        clientX: 0,
        clientY: 0,
        bubbles: true,
      })
    );
    window.dispatchEvent(
      new PointerEvent("pointermove", {
        pointerId: 302,
        clientX: 0,
        clientY: 58,
      })
    );
    window.dispatchEvent(
      new PointerEvent("pointerup", {
        pointerId: 302,
        clientX: 0,
        clientY: 58,
      })
    );

    let bubbledClicks = 0;
    el.addEventListener("click", () => bubbledClicks++);
    const synthetic = new MouseEvent("click", {
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    expect(wrapper.dispatchEvent(synthetic)).to.be.false;
    expect(synthetic.defaultPrevented).to.be.true;
    expect(bubbledClicks).to.equal(0);

    wrapper.click();
    expect(bubbledClicks).to.equal(1);
  });

  it("drags a cell vertically (grid-snapped) and emits lr-cell-move on release", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid
        cells-draggable
        row-height="50"
        gap="8"
      ></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [{ cellId: "a", x: 0, y: 2, w: 1, h: 1 }];
    await el.updateComplete;
    const wrapper = el.shadowRoot!.querySelector(
      '[part="cell"]'
    ) as HTMLElement;
    wrapper.setPointerCapture = () => {};
    wrapper.dispatchEvent(
      new PointerEvent("pointerdown", {
        isPrimary: true,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        bubbles: true,
      })
    );
    // rowPitch = rowHeight(50) + gap(8) = 58px; two full rows down.
    window.dispatchEvent(
      new PointerEvent("pointermove", {
        pointerId: 1,
        clientX: 0,
        clientY: 116,
      })
    );
    let detail:
      | {
          cellId: string;
          position: { x: number; y: number };
          previous: { x: number; y: number };
        }
      | undefined;
    el.addEventListener(
      "lr-cell-move",
      (e) => (detail = (e as CustomEvent).detail)
    );
    window.dispatchEvent(
      new PointerEvent("pointerup", { pointerId: 1, clientX: 0, clientY: 116 })
    );
    expect(detail).to.deep.equal({
      cellId: "a",
      position: { x: 0, y: 4 },
      previous: { x: 0, y: 2 },
    });
  });

  it("rolls back the live move preview without terminal events when the gesture is canceled", async () => {
    for (const [index, endType] of (
      ["pointercancel", "lostpointercapture"] as const
    ).entries()) {
      const el = (await fixture(
        html`<lr-dashboard-grid
          cells-draggable
          row-height="50"
          gap="8"
        ></lr-dashboard-grid>`
      )) as LyraDashboardGrid;
      el.layout = [{ cellId: "a", x: 0, y: 0, w: 1, h: 1 }];
      await el.updateComplete;
      const wrapper = el.shadowRoot!.querySelector(
        '[part="cell"]'
      ) as HTMLElement;
      wrapper.setPointerCapture = () => {};
      wrapper.releasePointerCapture = () => {};
      const originalGridRow = wrapper.style.gridRow;
      let moves = 0;
      let layouts = 0;
      el.addEventListener("lr-cell-move", () => moves++);
      el.addEventListener("lr-layout-change", () => layouts++);
      const pointerId = 80 + index;

      wrapper.dispatchEvent(
        new PointerEvent("pointerdown", {
          isPrimary: true,
          pointerId,
          clientX: 0,
          clientY: 0,
          bubbles: true,
        })
      );
      window.dispatchEvent(
        new PointerEvent("pointermove", {
          pointerId,
          clientX: 0,
          clientY: 116,
        })
      );
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve())
      );
      expect(wrapper.style.gridRow, endType).to.not.equal(originalGridRow);

      window.dispatchEvent(new PointerEvent(endType, { pointerId }));
      await el.updateComplete;

      expect(moves, endType).to.equal(0);
      expect(layouts, endType).to.equal(0);
      expect(wrapper.style.gridRow, endType).to.equal(originalGridRow);
    }
  });

  it("clamps an extreme rightward drag to the last valid column", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid cells-draggable columns="4"></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [{ cellId: "a", x: 0, y: 0, w: 2, h: 1 }];
    await el.updateComplete;
    const wrapper = el.shadowRoot!.querySelector(
      '[part="cell"]'
    ) as HTMLElement;
    wrapper.setPointerCapture = () => {};
    wrapper.dispatchEvent(
      new PointerEvent("pointerdown", {
        isPrimary: true,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        bubbles: true,
      })
    );
    window.dispatchEvent(
      new PointerEvent("pointermove", {
        pointerId: 1,
        clientX: 999999,
        clientY: 0,
      })
    );
    let detail: { position: { x: number; y: number } } | undefined;
    el.addEventListener(
      "lr-cell-move",
      (e) => (detail = (e as CustomEvent).detail)
    );
    window.dispatchEvent(
      new PointerEvent("pointerup", {
        pointerId: 1,
        clientX: 999999,
        clientY: 0,
      })
    );
    // w=2 on a 4-column grid -- the furthest valid leading column is 2.
    expect(detail!.position.x).to.equal(2);
  });

  it("maps a physical leftward drag to increasing logical columns under RTL", async () => {
    const host = (await fixture(html`
      <div dir="rtl">
        <lr-dashboard-grid cells-draggable columns="4"></lr-dashboard-grid>
      </div>
    `)) as HTMLElement;
    const el = host.querySelector("lr-dashboard-grid") as LyraDashboardGrid;
    el.layout = [{ cellId: "a", x: 1, y: 0, w: 1, h: 1 }];
    await el.updateComplete;
    const wrapper = el.shadowRoot!.querySelector(
      '[part="cell"]'
    ) as HTMLElement;
    wrapper.setPointerCapture = () => {};
    let x: number | undefined;
    el.addEventListener("lr-cell-move", (event) => {
      x = (event as CustomEvent<{ position: { x: number } }>).detail.position.x;
    });
    wrapper.dispatchEvent(
      new PointerEvent("pointerdown", {
        isPrimary: true,
        pointerId: 303,
        button: 0,
        clientX: 0,
        clientY: 0,
        bubbles: true,
      })
    );
    window.dispatchEvent(
      new PointerEvent("pointermove", {
        pointerId: 303,
        clientX: -10_000,
        clientY: 0,
      })
    );
    window.dispatchEvent(
      new PointerEvent("pointerup", {
        pointerId: 303,
        clientX: -10_000,
        clientY: 0,
      })
    );

    expect(x).to.equal(3);
  });

  it("rejects the drop (and fires lr-collision, not lr-cell-move) when it would land on another cell", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid
        cells-draggable
        collision="reject"
        row-height="50"
        gap="8"
      ></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    const layout: LyraDashboardCell[] = [
      { cellId: "a", x: 0, y: 0, w: 1, h: 1 },
      { cellId: "b", x: 0, y: 2, w: 1, h: 1 },
    ];
    el.layout = layout;
    await el.updateComplete;
    const wrapper = el.shadowRoot!.querySelector(
      '[data-cell-id="a"]'
    ) as HTMLElement;
    wrapper.setPointerCapture = () => {};
    wrapper.dispatchEvent(
      new PointerEvent("pointerdown", {
        isPrimary: true,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        bubbles: true,
      })
    );
    window.dispatchEvent(
      new PointerEvent("pointermove", {
        pointerId: 1,
        clientX: 0,
        clientY: 116,
      })
    );
    let moveFired = false;
    let collisionDetail:
      | {
          cellId: string;
          collidedCellIds: string[];
          policy: string;
          accepted: boolean;
        }
      | undefined;
    el.addEventListener("lr-cell-move", () => (moveFired = true));
    el.addEventListener(
      "lr-collision",
      (e) => (collisionDetail = (e as CustomEvent).detail)
    );
    window.dispatchEvent(
      new PointerEvent("pointerup", { pointerId: 1, clientX: 0, clientY: 116 })
    );
    expect(moveFired).to.be.false;
    expect(collisionDetail).to.deep.equal({
      cellId: "a",
      collidedCellIds: ["b"],
      policy: "reject",
      accepted: false,
    });
    expect(el.layout).to.not.equal(layout);
    expect(el.layout).to.deep.equal(layout);
  });

  it("does not drag when cells-draggable is unset", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [{ cellId: "a", x: 0, y: 0, w: 1, h: 1 }];
    await el.updateComplete;
    const wrapper = el.shadowRoot!.querySelector(
      '[part="cell"]'
    ) as HTMLElement;
    wrapper.setPointerCapture = () => {};
    let fired = false;
    el.addEventListener("lr-cell-move", () => (fired = true));
    wrapper.dispatchEvent(
      new PointerEvent("pointerdown", {
        isPrimary: true,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        bubbles: true,
      })
    );
    window.dispatchEvent(
      new PointerEvent("pointermove", {
        pointerId: 1,
        clientX: 0,
        clientY: 200,
      })
    );
    window.dispatchEvent(
      new PointerEvent("pointerup", { pointerId: 1, clientX: 0, clientY: 200 })
    );
    expect(fired).to.be.false;
  });

  it("aborts an active drag when grid or per-cell capability is revoked", async () => {
    const cases: Array<{
      name: string;
      revoke: (el: LyraDashboardGrid) => void;
    }> = [
      {
        name: "cells-draggable",
        revoke: (el) => {
          el.cellsDraggable = false;
        },
      },
      {
        name: "grid lock",
        revoke: (el) => {
          el.locked = true;
        },
      },
      {
        name: "cell lock",
        revoke: (el) => {
          el.layout = [{ ...el.layout[0]!, locked: true }];
        },
      },
    ];

    for (const [index, testCase] of cases.entries()) {
      const el = (await fixture(
        html`<lr-dashboard-grid cells-draggable></lr-dashboard-grid>`
      )) as LyraDashboardGrid;
      el.layout = [{ cellId: "a", x: 0, y: 0, w: 1, h: 1 }];
      await el.updateComplete;
      const wrapper = el.shadowRoot!.querySelector(
        '[part="cell"]'
      ) as HTMLElement;
      wrapper.setPointerCapture = () => {};
      let releasedPointerId: number | undefined;
      wrapper.releasePointerCapture = (pointerId) => {
        releasedPointerId = pointerId;
      };
      let moves = 0;
      el.addEventListener("lr-cell-move", () => (moves += 1));
      const pointerId = 60 + index;
      wrapper.dispatchEvent(
        new PointerEvent("pointerdown", {
          isPrimary: true,
          pointerId,
          clientX: 0,
          clientY: 0,
          bubbles: true,
        })
      );

      testCase.revoke(el);
      window.dispatchEvent(
        new PointerEvent("pointermove", {
          pointerId,
          clientX: 100,
          clientY: 100,
        })
      );
      window.dispatchEvent(new PointerEvent("pointerup", { pointerId }));

      expect(moves, testCase.name).to.equal(0);
      expect(wrapper.hasAttribute("data-dragging"), testCase.name).to.be.false;
      expect(releasedPointerId, testCase.name).to.equal(pointerId);
    }
  });

  it("does not render a resize handle for a locked cell even when cells-resizable is set", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid cells-resizable></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [{ cellId: "a", x: 0, y: 0, w: 1, h: 1, locked: true }];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="resize-handle"]') === null).to
      .be.true;
  });
});

describe("pointer resize", () => {
  it("admits only primary-button primary pointers for both drag and resize", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid
        cells-draggable
        cells-resizable
      ></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [{ cellId: "a", x: 0, y: 0, w: 1, h: 1 }];
    await el.updateComplete;
    const wrapper = el.shadowRoot!.querySelector(
      '[part="cell"]'
    ) as HTMLElement;
    const handle = el.shadowRoot!.querySelector(
      '[part="resize-handle"]'
    ) as HTMLElement;
    wrapper.setPointerCapture = () => {};
    handle.setPointerCapture = () => {};

    for (const init of [
      { isPrimary: false, button: 0, pointerId: 311 },
      { isPrimary: true, button: 1, pointerId: 312 },
    ]) {
      wrapper.dispatchEvent(
        new PointerEvent("pointerdown", { ...init, bubbles: true })
      );
      expect(wrapper.hasAttribute("data-dragging")).to.be.false;

      handle.dispatchEvent(
        new PointerEvent("pointerdown", {
          ...init,
          pointerId: init.pointerId + 10,
          bubbles: true,
          composed: true,
        })
      );
      expect(wrapper.hasAttribute("data-resizing")).to.be.false;
    }
  });

  it("resizes a cell vertically (grid-snapped) and emits lr-cell-resize on release", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid
        cells-resizable
        row-height="50"
        gap="8"
      ></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [{ cellId: "a", x: 0, y: 0, w: 1, h: 1 }];
    await el.updateComplete;
    const handle = el.shadowRoot!.querySelector(
      '[part="resize-handle"]'
    ) as HTMLElement;
    handle.setPointerCapture = () => {};
    handle.dispatchEvent(
      new PointerEvent("pointerdown", {
        isPrimary: true,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        bubbles: true,
      })
    );
    // rowPitch = 50 + 8 = 58px; two full rows taller.
    window.dispatchEvent(
      new PointerEvent("pointermove", {
        pointerId: 1,
        clientX: 0,
        clientY: 116,
      })
    );
    let detail:
      | {
          cellId: string;
          size: { w: number; h: number };
          previous: { w: number; h: number };
        }
      | undefined;
    el.addEventListener(
      "lr-cell-resize",
      (e) => (detail = (e as CustomEvent).detail)
    );
    window.dispatchEvent(
      new PointerEvent("pointerup", { pointerId: 1, clientX: 0, clientY: 116 })
    );
    expect(detail).to.deep.equal({
      cellId: "a",
      size: { w: 1, h: 3 },
      previous: { w: 1, h: 1 },
    });
  });

  it("grows from the physical left-side inline-end handle under RTL", async () => {
    const host = (await fixture(html`
      <div dir="rtl">
        <lr-dashboard-grid cells-resizable columns="4"></lr-dashboard-grid>
      </div>
    `)) as HTMLElement;
    const el = host.querySelector("lr-dashboard-grid") as LyraDashboardGrid;
    el.layout = [{ cellId: "a", x: 0, y: 0, w: 1, h: 1 }];
    await el.updateComplete;
    const handle = el.shadowRoot!.querySelector(
      '[part="resize-handle"]'
    ) as HTMLElement;
    handle.setPointerCapture = () => {};
    let width: number | undefined;
    el.addEventListener("lr-cell-resize", (event) => {
      width = (event as CustomEvent<{ size: { w: number } }>).detail.size.w;
    });
    handle.dispatchEvent(
      new PointerEvent("pointerdown", {
        isPrimary: true,
        pointerId: 313,
        button: 0,
        clientX: 0,
        clientY: 0,
        bubbles: true,
      })
    );
    window.dispatchEvent(
      new PointerEvent("pointermove", {
        pointerId: 313,
        clientX: -10_000,
        clientY: 0,
      })
    );
    window.dispatchEvent(
      new PointerEvent("pointerup", {
        pointerId: 313,
        clientX: -10_000,
        clientY: 0,
      })
    );

    expect(width).to.equal(4);
  });

  it("rolls back the live resize preview without terminal events when the gesture is canceled", async () => {
    for (const [index, endType] of (
      ["pointercancel", "lostpointercapture"] as const
    ).entries()) {
      const el = (await fixture(
        html`<lr-dashboard-grid
          cells-resizable
          row-height="50"
          gap="8"
        ></lr-dashboard-grid>`
      )) as LyraDashboardGrid;
      el.layout = [{ cellId: "a", x: 0, y: 0, w: 1, h: 1 }];
      await el.updateComplete;
      const wrapper = el.shadowRoot!.querySelector(
        '[part="cell"]'
      ) as HTMLElement;
      const handle = el.shadowRoot!.querySelector(
        '[part="resize-handle"]'
      ) as HTMLElement;
      handle.setPointerCapture = () => {};
      handle.releasePointerCapture = () => {};
      const originalGridRow = wrapper.style.gridRow;
      let resizes = 0;
      let layouts = 0;
      el.addEventListener("lr-cell-resize", () => resizes++);
      el.addEventListener("lr-layout-change", () => layouts++);
      const pointerId = 90 + index;

      handle.dispatchEvent(
        new PointerEvent("pointerdown", {
          isPrimary: true,
          pointerId,
          clientX: 0,
          clientY: 0,
          bubbles: true,
        })
      );
      window.dispatchEvent(
        new PointerEvent("pointermove", {
          pointerId,
          clientX: 0,
          clientY: 116,
        })
      );
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve())
      );
      expect(wrapper.style.gridRow, endType).to.not.equal(originalGridRow);

      window.dispatchEvent(new PointerEvent(endType, { pointerId }));
      await el.updateComplete;

      expect(resizes, endType).to.equal(0);
      expect(layouts, endType).to.equal(0);
      expect(wrapper.style.gridRow, endType).to.equal(originalGridRow);
    }
  });

  it("aborts an active resize when grid or per-cell capability is revoked", async () => {
    const cases: Array<{
      name: string;
      revoke: (el: LyraDashboardGrid) => void;
    }> = [
      {
        name: "cells-resizable",
        revoke: (el) => {
          el.cellsResizable = false;
        },
      },
      {
        name: "grid lock",
        revoke: (el) => {
          el.locked = true;
        },
      },
      {
        name: "cell lock",
        revoke: (el) => {
          el.layout = [{ ...el.layout[0]!, locked: true }];
        },
      },
    ];

    for (const [index, testCase] of cases.entries()) {
      const el = (await fixture(
        html`<lr-dashboard-grid cells-resizable></lr-dashboard-grid>`
      )) as LyraDashboardGrid;
      el.layout = [{ cellId: "a", x: 0, y: 0, w: 1, h: 1 }];
      await el.updateComplete;
      const wrapper = el.shadowRoot!.querySelector(
        '[part="cell"]'
      ) as HTMLElement;
      const handle = el.shadowRoot!.querySelector(
        '[part="resize-handle"]'
      ) as HTMLElement;
      handle.setPointerCapture = () => {};
      let releasedPointerId: number | undefined;
      handle.releasePointerCapture = (pointerId) => {
        releasedPointerId = pointerId;
      };
      let resizes = 0;
      el.addEventListener("lr-cell-resize", () => (resizes += 1));
      const pointerId = 70 + index;
      handle.dispatchEvent(
        new PointerEvent("pointerdown", {
          isPrimary: true,
          pointerId,
          clientX: 0,
          clientY: 0,
          bubbles: true,
        })
      );

      testCase.revoke(el);
      window.dispatchEvent(
        new PointerEvent("pointermove", {
          pointerId,
          clientX: 100,
          clientY: 100,
        })
      );
      window.dispatchEvent(new PointerEvent("pointerup", { pointerId }));

      expect(resizes, testCase.name).to.equal(0);
      expect(wrapper.hasAttribute("data-resizing"), testCase.name).to.be.false;
      expect(releasedPointerId, testCase.name).to.equal(pointerId);
    }
  });
});

describe("narrow allocation", () => {
  it("switches to a single stacked column inside a 320px container", async () => {
    const container = document.createElement("div");
    container.style.inlineSize = "320px";
    const el = (await fixture(
      html`<lr-dashboard-grid .layout=${twoCells()}>
        <div cell-id="a">A</div>
        <div cell-id="b">B</div>
      </lr-dashboard-grid>`,
      { parentNode: container }
    )) as LyraDashboardGrid;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(base).display).to.equal("flex");
    expect(
      (el as unknown as HTMLElement).getBoundingClientRect().width
    ).to.be.at.most(320);
  });

  for (const direction of ["ltr", "rtl"] as const) {
    it(`keeps short resizable custom cells at least as tall as their 40px handle in ${direction.toUpperCase()}`, async () => {
      const wrapper = await fixture<HTMLElement>(html`
        <div
          dir=${direction}
          style="inline-size: 320px; max-inline-size: 100%;"
        >
          <lr-dashboard-grid
            cells-resizable
            style="inline-size: 100%;"
            .layout=${twoCells()}
          >
            <div cell-id="a">A</div>
            <div cell-id="b">B</div>
          </lr-dashboard-grid>
        </div>
      `);
      const el = wrapper.querySelector(
        "lr-dashboard-grid"
      ) as LyraDashboardGrid;
      await el.updateComplete;
      const cells = [
        ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="cell"]'),
      ];
      const handles = [
        ...el.shadowRoot!.querySelectorAll<HTMLElement>(
          '[part="resize-handle"]'
        ),
      ];

      expect(cells.length).to.equal(2);
      expect(handles.length).to.equal(2);
      for (let index = 0; index < cells.length; index += 1) {
        expect(cells[index]!.getBoundingClientRect().height).to.be.at.least(40);
        expect(cells[index]!.getBoundingClientRect().height).to.be.at.least(
          handles[index]!.getBoundingClientRect().height
        );
      }
      expect(cells[1]!.getBoundingClientRect().top).to.be.at.least(
        cells[0]!.getBoundingClientRect().bottom + el.gap - 1
      );
      expect(getComputedStyle(cells[0]!).direction).to.equal(direction);
    });

    it(`contains unbroken custom-cell text inside a 320px ${direction.toUpperCase()} stack`, async () => {
      const longText = "LocalizationWithoutBreakOpportunity".repeat(100);
      const wrapper = await fixture<HTMLElement>(html`
        <div
          dir=${direction}
          style="inline-size: 320px; max-inline-size: 100%;"
        >
          <lr-dashboard-grid style="inline-size: 100%;" .layout=${twoCells()}>
            <div cell-id="a">${longText}</div>
            <div cell-id="b">B</div>
          </lr-dashboard-grid>
        </div>
      `);
      const el = wrapper.querySelector(
        "lr-dashboard-grid"
      ) as LyraDashboardGrid;
      await el.updateComplete;
      const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
      const cells = [
        ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="cell"]'),
      ];
      const custom = el.querySelector<HTMLElement>('[cell-id="a"]')!;

      expect(wrapper.scrollWidth).to.be.at.most(wrapper.clientWidth);
      expect(el.scrollWidth).to.be.at.most(el.clientWidth);
      expect(base.scrollWidth).to.be.at.most(base.clientWidth);
      expect(custom.scrollWidth).to.be.at.most(custom.clientWidth);
      expect(
        cells.every((cell) => cell.scrollWidth <= cell.clientWidth)
      ).to.equal(true);
      expect(getComputedStyle(custom).direction).to.equal(direction);
    });
  }

  it("preserves an explicit custom-cell scrollport while containing it inside the stack", async () => {
    const longText = "ChildOwnedHorizontalScrollContent".repeat(100);
    const wrapper = await fixture<HTMLElement>(html`
      <div style="inline-size: 320px; max-inline-size: 100%;">
        <lr-dashboard-grid
          style="inline-size: 100%;"
          .layout=${[twoCells()[0]!]}
        >
          <div cell-id="a" style="overflow: auto; white-space: nowrap;">
            ${longText}
          </div>
        </lr-dashboard-grid>
      </div>
    `);
    const el = wrapper.querySelector("lr-dashboard-grid") as LyraDashboardGrid;
    await el.updateComplete;
    const custom = el.querySelector<HTMLElement>('[cell-id="a"]')!;

    expect(wrapper.scrollWidth).to.be.at.most(wrapper.clientWidth);
    expect(custom.scrollWidth).to.be.greaterThan(custom.clientWidth);
    expect(getComputedStyle(custom).overflowX).to.equal("auto");
  });
});

describe("accessibility", () => {
  it("is accessible with populated, draggable, and resizable cells", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid
        cells-draggable
        cells-resizable
      ></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [
      {
        cellId: "a",
        x: 0,
        y: 0,
        w: 2,
        h: 1,
        label: "Users",
        widget: { type: "stat", props: { label: "Users", value: "12" } },
      },
      {
        cellId: "b",
        x: 2,
        y: 0,
        w: 2,
        h: 1,
        label: "Errors",
        widget: { type: "stat", props: { label: "Errors", value: "0" } },
      },
    ];
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it("falls back to the localized default aria-label, overridable via a host aria-label", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [{ cellId: "a", x: 0, y: 0, w: 1, h: 1 }];
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('[part="base"]')!.getAttribute("aria-label")
    ).to.equal("Dashboard grid");
    el.accessibleLabel = "Ops overview";
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('[part="base"]')!.getAttribute("aria-label")
    ).to.equal("Ops overview");
  });

  it("preserves an explicitly empty host aria-label instead of replacing it with the fallback", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid aria-label=""></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [{ cellId: "a", x: 0, y: 0, w: 1, h: 1 }];
    await el.updateComplete;

    expect(
      el.shadowRoot!.querySelector('[part="base"]')!.getAttribute("aria-label")
    ).to.equal("");
  });
});

describe("localized strings", () => {
  it("routes the grid label through this.localize with a .strings override", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid
        .strings=${{ dashboardGridLabel: "Tableau de bord" }}
      ></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [{ cellId: "a", x: 0, y: 0, w: 1, h: 1 }];
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('[part="base"]')!.getAttribute("aria-label")
    ).to.equal("Tableau de bord");
  });

  it("routes the collision-rejected announcement through this.localize with a .strings override", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid
        cells-draggable
        collision="reject"
        .strings=${{ dashboardCellCollisionRejected: "{label} bloqué" }}
      ></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [
      { cellId: "a", x: 0, y: 0, w: 1, h: 1, label: "Alpha" },
      { cellId: "b", x: 1, y: 0, w: 1, h: 1 },
    ];
    await el.updateComplete;
    const cellA = el.shadowRoot!.querySelector(
      '[data-cell-id="a"]'
    ) as HTMLElement;
    cellA.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
    // The live-region text itself flushes on a throttled delay (see `Announcer`) -- rather than
    // wait out that timer, this asserts against the announcer's own synchronously-set pending
    // text, which `announce()` populates immediately regardless of when the throttle flushes it
    // into `liveText`/the DOM. Mirrors `lr-flow-canvas`'s choice to not test throttled live-region
    // text directly; this goes one step further to still prove the call site's key/interpolation.
    const announcer = (el as unknown as { announcer: { pendingText?: string } })
      .announcer;
    expect(announcer.pendingText).to.equal("Alpha bloqué");
  });

  it('provides English defaults for move, resize, and collision announcements', async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid
        cells-draggable
        cells-resizable
      ></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [
      { cellId: 'a', x: 0, y: 0, w: 1, h: 1, label: 'Alpha' },
      { cellId: 'b', x: 2, y: 0, w: 1, h: 1, label: 'Beta' },
    ];
    await el.updateComplete;
    const cellA = el.shadowRoot!.querySelector(
      '[data-cell-id="a"]'
    ) as HTMLElement;
    const announcer = (
      el as unknown as {
        announcer: { pendingText?: string };
      }
    ).announcer;
    let proposedLayout: readonly LyraDashboardCell[] | undefined;
    el.addEventListener('lr-layout-change', (event) => {
      proposedLayout = event.detail.layout;
    });

    cellA.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
    expect(announcer.pendingText).to.equal(undefined);
    el.layout = proposedLayout!;
    await el.updateComplete;
    expect(announcer.pendingText).to.equal('Alpha moved to column 2, row 1.');

    proposedLayout = undefined;
    cellA.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
    expect(announcer.pendingText).to.equal('Alpha moved to column 2, row 1.');
    el.layout = proposedLayout!;
    await el.updateComplete;
    expect(announcer.pendingText).to.equal(
      'Alpha resized to width 1, height 2.'
    );

    el.layout = [
      { cellId: 'a', x: 0, y: 0, w: 1, h: 1, label: 'Alpha' },
      { cellId: 'b', x: 1, y: 0, w: 1, h: 1, label: 'Beta' },
    ];
    await el.updateComplete;
    const updatedCellA = el.shadowRoot!.querySelector(
      '[data-cell-id="a"]'
    ) as HTMLElement;
    updatedCellA.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
    expect(announcer.pendingText).to.equal(
      'Alpha cannot be placed there because it overlaps another cell.'
    );
  });
});

it("gives resize-handle a hover state", () => {
  const css = styles.cssText.replace(/\s+/g, " ").replaceAll('"', "'");
  expect(css).to.match(/\[part='resize-handle'\]:hover/);
});

it("gives cell (a real focusable, draggable/resizable target) a hover state matching its own focus-visible ring", () => {
  const css = styles.cssText.replace(/\s+/g, " ").replaceAll('"', "'");
  expect(css).to.match(/\[part='cell'\]:hover\s*\{[^}]*outline:/);
});

it("themes the cell hover outline color via --lr-dashboard-grid-cell-hover-outline-color, falling back to --lr-color-border-strong", () => {
  const css = styles.cssText.replace(/\s+/g, " ").replaceAll('"', "'");
  const rule = css.match(/\[part='cell'\]:hover\s*\{([^}]+)\}/)?.[1] ?? "";
  expect(rule).to.match(
    /outline:[^;]*var\(\s*--lr-dashboard-grid-cell-hover-outline-color,\s*var\(--lr-color-border-strong\)\s*\)/
  );
});

it("themes collision state independently through --lr-dashboard-grid-collision-outline-color", () => {
  const css = styles.cssText.replace(/\s+/g, " ").replaceAll('"', "'");
  const rule =
    css.match(/\[part='cell'\]\[data-collision\]\s*\{([^}]+)\}/)?.[1] ?? "";
  expect(rule).to.include(
    "var(--lr-dashboard-grid-collision-outline-color, var(--lr-color-danger))"
  );
});

it('cascades --lr-dashboard-grid-cell-hover-outline-color onto [part="cell"]', async () => {
  const el = (await fixture(
    html`<lr-dashboard-grid .layout=${twoCells()}></lr-dashboard-grid>`
  )) as LyraDashboardGrid;
  await el.updateComplete;
  el.style.setProperty(
    "--lr-dashboard-grid-cell-hover-outline-color",
    "rgb(21, 43, 65)"
  );
  const cell = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
  expect(
    getComputedStyle(cell)
      .getPropertyValue("--lr-dashboard-grid-cell-hover-outline-color")
      .trim()
  ).to.equal("rgb(21, 43, 65)");
});

it("themes the live drag elevation through a component-scoped interaction-shadow hook", async () => {
  const el = (await fixture(
    html`<lr-dashboard-grid
      cells-draggable
      style="--lr-dashboard-grid-interaction-shadow: rgb(21, 43, 65) 0 0 0 7px"
      .layout=${twoCells()}
    ></lr-dashboard-grid>`
  )) as LyraDashboardGrid;
  const cell = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
  cell.setPointerCapture = () => {};
  cell.dispatchEvent(
    new PointerEvent("pointerdown", {
      isPrimary: true,
      pointerId: 91,
      clientX: 0,
      clientY: 0,
      bubbles: true,
    })
  );

  expect(getComputedStyle(cell).boxShadow).to.include("rgb(21, 43, 65)");

  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 91 }));
});

it("chains willUpdate() to super.willUpdate() so a mixin layered under LyraElement would still run", async () => {
  // No shared mixin actually overrides willUpdate() today, so the only way to prove the chain is
  // live (rather than grepping source text for the call) is to patch the base-class hook itself
  // -- the exact hook a future mixin would extend -- and confirm it actually fires.
  const hadOwn = Object.prototype.hasOwnProperty.call(
    LitElement.prototype,
    "willUpdate"
  );
  const original = (
    LitElement.prototype as unknown as {
      willUpdate?: (changed: PropertyValues) => void;
    }
  ).willUpdate;
  const calledBy = new Set<string>();
  (
    LitElement.prototype as unknown as {
      willUpdate: (changed: PropertyValues) => void;
    }
  ).willUpdate = function (this: LitElement, changed: PropertyValues) {
    calledBy.add((this as unknown as Element).localName);
    original?.call(this, changed);
  };
  try {
    const el = (await fixture(
      html`<lr-dashboard-grid .layout=${twoCells()}></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    await el.updateComplete;
    expect(calledBy.has("lr-dashboard-grid")).to.be.true;
  } finally {
    if (hadOwn) {
      (LitElement.prototype as unknown as { willUpdate: unknown }).willUpdate =
        original;
    } else {
      delete (LitElement.prototype as unknown as { willUpdate?: unknown })
        .willUpdate;
    }
  }
});

it('formats move and resize announcement coordinates with the effective locale', async () => {
  const el = (await fixture(
    html`<lr-dashboard-grid
      lang="ar-EG"
      cells-draggable
      cells-resizable
    ></lr-dashboard-grid>`
  )) as LyraDashboardGrid;
  el.layout = [{ cellId: 'a', x: 0, y: 0, w: 1, h: 1, label: 'Alpha' }];
  await el.updateComplete;
  const cell = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
  const announcer = (
    el as unknown as {
      announcer: { pendingText?: string };
    }
  ).announcer;
  const number = new Intl.NumberFormat('ar-EG');
  let proposedLayout: readonly LyraDashboardCell[] | undefined;
  el.addEventListener('lr-layout-change', (event) => {
    proposedLayout = event.detail.layout;
  });

  cell.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
  );
  el.layout = proposedLayout!;
  await el.updateComplete;
  expect(announcer.pendingText).to.include(number.format(2));
  expect(announcer.pendingText).to.include(number.format(1));

  proposedLayout = undefined;
  cell.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    })
  );
  el.layout = proposedLayout!;
  await el.updateComplete;
  expect(announcer.pendingText).to.include(number.format(2));
  expect(announcer.pendingText).to.include(number.format(1));
});

it("does not start a cell drag from a pointerdown on an interactive control inside the cell", async () => {
  // Cell content is *slotted* light DOM (`<slot name="cell-{id}">`) while the drag listener sits on
  // a `[part="cell"]` wrapper inside the shadow root. `wrapper.contains(lightDomButton)` is
  // therefore always false -- `contains()` walks the node tree, not the flat tree -- so the
  // "don't drag when the user grabbed a control" guard could never fire, and every button/input
  // click inside a dashboard cell started a drag instead of activating the control.
  const el = (await fixture(html`
    <lr-dashboard-grid
      cells-draggable
      row-height="50"
      gap="8"
      .layout=${[{ cellId: "a", x: 0, y: 2, w: 1, h: 1 }]}
    >
      <div cell-id="a"><button type="button">Refresh</button></div>
    </lr-dashboard-grid>
  `)) as LyraDashboardGrid;
  await el.updateComplete;

  const wrapper = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
  wrapper.setPointerCapture = () => {};
  const button = el.querySelector("button") as HTMLButtonElement;

  let moved = 0;
  el.addEventListener("lr-cell-move", () => moved++);

  // Composed + bubbling, exactly as a real pointerdown on the slotted button reaches the wrapper.
  button.dispatchEvent(
    new PointerEvent("pointerdown", {
      isPrimary: true,
      pointerId: 7,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      composed: true,
    })
  );
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 7, clientX: 0, clientY: 116 })
  );
  window.dispatchEvent(
    new PointerEvent("pointerup", { pointerId: 7, clientX: 0, clientY: 116 })
  );
  await el.updateComplete;

  expect(
    moved,
    "grabbing a button inside a cell must not drag the cell"
  ).to.equal(0);
});

it("rejects drag admission through labels, disabled controls, editable content, links, and nested shadow controls", async () => {
  const nestedTag = "x-dashboard-grid-shadow-control";
  if (!customElements.get(nestedTag)) {
    customElements.define(
      nestedTag,
      class extends HTMLElement {
        constructor() {
          super();
          const root = this.attachShadow({ mode: "open" });
          const button = document.createElement("button");
          button.textContent = "Nested action";
          root.append(button);
        }
      }
    );
  }
  const el = (await fixture(html`
    <lr-dashboard-grid
      cells-draggable
      .layout=${[{ cellId: "a", x: 0, y: 0, w: 1, h: 1 }]}
    >
      <div cell-id="a"></div>
    </lr-dashboard-grid>
  `)) as LyraDashboardGrid;
  await el.updateComplete;
  const content = el.querySelector('[cell-id="a"]')!;
  const label = document.createElement("label");
  label.textContent = "Label";
  const disabledButton = document.createElement("button");
  disabledButton.disabled = true;
  const editable = document.createElement("div");
  editable.setAttribute("contenteditable", "true");
  const link = document.createElement("a");
  link.href = "#target";
  const nested = document.createElement(nestedTag);
  content.append(label, disabledButton, editable, link, nested);
  const nestedButton = nested.shadowRoot!.querySelector("button")!;
  const wrapper = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
  wrapper.setPointerCapture = () => {};

  const targets: Array<[string, Element]> = [
    ["label", label],
    ["disabled button", disabledButton],
    ["contenteditable", editable],
    ["link", link],
    ["nested shadow button", nestedButton],
  ];
  for (const [index, [name, target]] of targets.entries()) {
    target.dispatchEvent(
      new PointerEvent("pointerdown", {
        isPrimary: true,
        pointerId: 500 + index,
        button: 0,
        bubbles: true,
        composed: true,
      })
    );
    expect(wrapper.hasAttribute("data-dragging"), name).to.be.false;
  }
});

describe("defensive edge cases", () => {
  it("cancels an active drag through willUpdate when locked flips true without a following pointer event", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid cells-draggable></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [{ cellId: "a", x: 0, y: 0, w: 1, h: 1 }];
    await el.updateComplete;
    const wrapper = el.shadowRoot!.querySelector(
      '[part="cell"]'
    ) as HTMLElement;
    wrapper.setPointerCapture = () => {};
    let releasedPointerId: number | undefined;
    wrapper.releasePointerCapture = (pointerId) => {
      releasedPointerId = pointerId;
    };
    wrapper.dispatchEvent(
      new PointerEvent("pointerdown", {
        isPrimary: true,
        pointerId: 42,
        clientX: 0,
        clientY: 0,
        bubbles: true,
      })
    );
    expect(wrapper.hasAttribute("data-dragging")).to.be.true;

    // No pointermove/pointerup ever follows -- only the property change and the resulting
    // update cycle. If willUpdate() didn't proactively cancel the gesture here, the drag state
    // (and its window-level listeners) would leak indefinitely.
    el.locked = true;
    await el.updateComplete;

    expect(
      wrapper.hasAttribute("data-dragging"),
      "canceled before any further pointer event"
    ).to.be.false;
    expect(releasedPointerId).to.equal(42);
  });

  it("cancels an active resize through willUpdate when locked flips true without a following pointer event", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid cells-resizable></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [{ cellId: "a", x: 0, y: 0, w: 2, h: 2 }];
    await el.updateComplete;
    const wrapper = el.shadowRoot!.querySelector(
      '[part="cell"]'
    ) as HTMLElement;
    const handle = el.shadowRoot!.querySelector(
      '[part="resize-handle"]'
    ) as HTMLElement;
    handle.setPointerCapture = () => {};
    let releasedPointerId: number | undefined;
    handle.releasePointerCapture = (pointerId) => {
      releasedPointerId = pointerId;
    };
    handle.dispatchEvent(
      new PointerEvent("pointerdown", {
        isPrimary: true,
        pointerId: 43,
        clientX: 0,
        clientY: 0,
        bubbles: true,
      })
    );
    expect(wrapper.hasAttribute("data-resizing")).to.be.true;

    el.locked = true;
    await el.updateComplete;

    expect(
      wrapper.hasAttribute("data-resizing"),
      "canceled before any further pointer event"
    ).to.be.false;
    expect(releasedPointerId).to.equal(43);
  });

  it("swallows a stale-pointer NotFoundError when releasing capture during a canceled drag", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid cells-draggable></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [{ cellId: "a", x: 0, y: 0, w: 1, h: 1 }];
    await el.updateComplete;
    const wrapper = el.shadowRoot!.querySelector(
      '[part="cell"]'
    ) as HTMLElement;
    wrapper.setPointerCapture = () => {};
    // A browser can report the capture as already gone (e.g. an implicit native release) by the
    // time cancellation runs; that must not surface as an uncaught error.
    wrapper.releasePointerCapture = () => {
      throw new DOMException("already released", "NotFoundError");
    };
    wrapper.dispatchEvent(
      new PointerEvent("pointerdown", {
        isPrimary: true,
        pointerId: 7,
        clientX: 0,
        clientY: 0,
        bubbles: true,
      })
    );
    expect(wrapper.hasAttribute("data-dragging")).to.be.true;

    expect(() =>
      window.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 7 }))
    ).to.not.throw();
    expect(wrapper.hasAttribute("data-dragging")).to.be.false;
  });

  it("ignores a light-DOM child with no cell-id attribute while syncing default cells", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid
        ><p>Just some decorative content</p></lr-dashboard-grid
      >`
    )) as LyraDashboardGrid;
    const plain = el.querySelector("p") as HTMLElement;
    el.layout = [{ cellId: "a", x: 0, y: 0, w: 1, h: 1 }];
    await el.updateComplete;

    expect(plain.hasAttribute("slot")).to.be.false;
    expect(plain.hasAttribute("cell-id")).to.be.false;
    expect(el.querySelector('[cell-id="a"]') !== null).to.be.true;
  });

  it("safely no-ops focusing a cell that disappears before its scheduled focus microtask runs", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = twoCells();
    await el.updateComplete;
    const first = el.shadowRoot!.querySelector(
      '[data-cell-id="a"]'
    ) as HTMLElement;

    // Roving-nav focus onto "b" schedules `this.cellElement("b")?.focus()` for after the next
    // update completes. Remove "b" from the public layout before that microtask runs.
    first.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      })
    );
    el.layout = [twoCells()[0]!];
    await el.updateComplete;
    await Promise.resolve();

    expect(
      el.shadowRoot!.querySelector('[data-cell-id="b"]') === null
    ).to.equal(true);
    expect(
      el.shadowRoot!.activeElement === null,
      'cellElement("b") found nothing, so the scheduled focus() was skipped'
    ).to.equal(true);
  });

  it("ignores a key that is neither an arrow, Home/End, nor part of a modified-arrow shortcut", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = twoCells();
    await el.updateComplete;
    const first = el.shadowRoot!.querySelector(
      '[data-cell-id="a"]'
    ) as HTMLElement;
    expect(first.getAttribute("tabindex")).to.equal("0");

    first.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;

    expect(first.getAttribute("tabindex")).to.equal("0");
    expect(el.shadowRoot!.activeElement === null).to.equal(true);
  });

  it("moves the focused cell for the remaining Ctrl+Arrow directions (left/down/up)", async () => {
    const cases: Array<{ key: string; expected: { x: number; y: number } }> = [
      { key: "ArrowLeft", expected: { x: 1, y: 2 } },
      { key: "ArrowDown", expected: { x: 2, y: 3 } },
      { key: "ArrowUp", expected: { x: 2, y: 1 } },
    ];
    for (const { key, expected } of cases) {
      const el = (await fixture(
        html`<lr-dashboard-grid cells-draggable></lr-dashboard-grid>`
      )) as LyraDashboardGrid;
      el.layout = [{ cellId: "a", x: 2, y: 2, w: 1, h: 1 }];
      await el.updateComplete;
      const cellEl = el.shadowRoot!.querySelector(
        '[part="cell"]'
      ) as HTMLElement;
      let detail: { position: { x: number; y: number } } | undefined;
      el.addEventListener(
        "lr-cell-move",
        (e) => (detail = (e as CustomEvent).detail)
      );
      cellEl.dispatchEvent(
        new KeyboardEvent("keydown", {
          key,
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        })
      );
      expect(detail?.position, key).to.deep.equal(expected);
    }
  });

  it("shrinks height via Ctrl+Shift+ArrowUp", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid cells-resizable></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    el.layout = [{ cellId: "a", x: 0, y: 0, w: 2, h: 2 }];
    await el.updateComplete;
    const cellEl = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
    let detail: { size: { w: number; h: number } } | undefined;
    el.addEventListener(
      "lr-cell-resize",
      (e) => (detail = (e as CustomEvent).detail)
    );
    cellEl.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowUp",
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
    expect(detail).to.deep.equal({
      cellId: "a",
      size: { w: 2, h: 1 },
      previous: { w: 2, h: 2 },
    });
  });

  it("isolates its immutable layout snapshot from caller mutation until a new value is assigned", async () => {
    const el = (await fixture(
      html`<lr-dashboard-grid></lr-dashboard-grid>`
    )) as LyraDashboardGrid;
    const authored = [
      { cellId: "a", x: 0, y: 0, w: 2, h: 1, label: "Alpha" },
      { cellId: "b", x: 2, y: 0, w: 2, h: 1, label: "Beta" },
    ];
    el.layout = authored;
    await el.updateComplete;
    const snapshot = el.layout;
    authored.splice(1, 1);
    authored[0]!.x = 9;
    el.columns = 6;
    await el.updateComplete;

    expect(el.layout).to.have.length(2);
    expect(el.layout[0]!.x).to.equal(0);
    expect(Object.isFrozen(snapshot)).to.be.true;
    expect(Object.isFrozen(snapshot[0])).to.be.true;

    el.layout = authored;
    await el.updateComplete;
    expect(el.layout).to.have.length(1);
    expect(el.layout[0]!.x).to.equal(4);
  });
});
