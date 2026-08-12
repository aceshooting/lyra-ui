import {
  fixture,
  expect,
  html,
  elementUpdated,
  oneEvent,
} from "@open-wc/testing";
import "./dock-panel.js";
import type {
  LyraDockPanel,
  DockPanelResizeDetail,
  DockPanelCollapseChangeDetail,
} from "./dock-panel.js";
import { parseLengthPx } from "./dock-panel.js";

async function dockedFixture(attrs = "", edge = "end"): Promise<LyraDockPanel> {
  const wrapper = (await fixture(
    `<div style="position: relative; height: 20rem; display: flex;">
      <div style="flex: 1;">main</div>
      <lr-dock-panel edge="${edge}" ${attrs}>panel body</lr-dock-panel>
    </div>`
  )) as HTMLDivElement;
  return wrapper.querySelector("lr-dock-panel") as LyraDockPanel;
}

describe("parseLengthPx", () => {
  it("parses px, bare numbers, and percentages", () => {
    expect(parseLengthPx("320px", 1000)).to.equal(320);
    expect(parseLengthPx("320", 1000)).to.equal(320);
    expect(parseLengthPx("25%", 1000)).to.equal(250);
  });

  it("returns undefined for empty or unparseable input", () => {
    expect(parseLengthPx("", 1000)).to.equal(undefined);
    expect(parseLengthPx("auto", 1000)).to.equal(undefined);
    for (const malformed of [
      ".",
      ".px",
      "1..2px",
      "12pxjunk",
      "1e",
      "1e999px",
    ]) {
      expect(parseLengthPx(malformed, 1000), malformed).to.equal(undefined);
    }
    expect(parseLengthPx(".5rem", 1000)).to.be.a("number");
    expect(parseLengthPx("1e2px", 1000)).to.equal(100);
  });

  it("resolves vw/vh against the viewport", () => {
    expect(parseLengthPx("10vw", 1000)).to.equal(window.innerWidth * 0.1);
    expect(parseLengthPx("10vh", 1000)).to.equal(window.innerHeight * 0.1);
  });

  it("resolves rem against the document root font size", () => {
    const rootPx = parseFloat(
      getComputedStyle(document.documentElement).fontSize
    );
    expect(parseLengthPx("2rem", 1000)).to.equal(2 * rootPx);
  });

  it("resolves viewport and root-font units through the supplied element's owner realm", async () => {
    const frame = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
    const frameDocument = frame.contentDocument;
    const frameWindow = frame.contentWindow;
    if (!frameDocument || !frameWindow) throw new Error("The iframe realm was unavailable.");
    const widthDescriptor = Object.getOwnPropertyDescriptor(frameWindow, "innerWidth");
    const heightDescriptor = Object.getOwnPropertyDescriptor(frameWindow, "innerHeight");
    const probe = frameDocument.createElement("div");
    frameDocument.body.append(probe);
    frameDocument.documentElement.style.fontSize = "10px";
    probe.style.fontSize = "12px";

    try {
      Object.defineProperty(frameWindow, "innerWidth", { configurable: true, value: 321 });
      Object.defineProperty(frameWindow, "innerHeight", { configurable: true, value: 654 });
      expect(parseLengthPx("10vw", 1000, probe)).to.equal(32.1);
      expect(parseLengthPx("10vh", 1000, probe)).to.equal(65.4);
      expect(parseLengthPx("2rem", 1000, probe)).to.equal(20);
      expect(parseLengthPx("2em", 1000, probe)).to.equal(24);
    } finally {
      if (widthDescriptor) Object.defineProperty(frameWindow, "innerWidth", widthDescriptor);
      else delete (frameWindow as unknown as { innerWidth?: number }).innerWidth;
      if (heightDescriptor) Object.defineProperty(frameWindow, "innerHeight", heightDescriptor);
      else delete (frameWindow as unknown as { innerHeight?: number }).innerHeight;
      frame.remove();
    }
  });
});

it("renders with defaults: docked to the end edge, a resizable handle, no collapse toggle", async () => {
  const el = await dockedFixture();
  await elementUpdated(el);
  expect(el.edge).to.equal("end");
  expect(el.resizable).to.equal(true);
  expect(el.collapsible).to.equal(false);
  const handle = el.shadowRoot!.querySelector('[part="handle"]');
  expect((handle) !== (null)).to.equal(true);
  expect(handle!.getAttribute("role")).to.equal("separator");
  expect(handle!.getAttribute("aria-orientation")).to.equal("vertical");
  expect(el.shadowRoot!.querySelector('[part="collapse-toggle"]')).to.equal(
    null
  );
});

it("floors the collapse toggle at the shared minimum hit target", async () => {
  const el = await dockedFixture("collapsible");
  await elementUpdated(el);
  const toggle = el.shadowRoot!.querySelector(
    '[part="collapse-toggle"]'
  ) as HTMLButtonElement;
  expect(toggle.getBoundingClientRect().width).to.be.at.least(40);
  expect(toggle.getBoundingClientRect().height).to.be.at.least(40);
});

it("contains long RTL dock and main content through collapse/expand in an exact 320px allocation", async () => {
  const longText = "UnbrokenLocalizedDockPanelContent".repeat(20);
  const wrapper = await fixture<HTMLElement>(html`
    <div
      dir="rtl"
      style="display:flex;inline-size:320px;max-inline-size:320px;block-size:12rem;overflow:hidden"
    >
      <main style="flex:1 1 0;min-inline-size:0;overflow:auto">${longText}</main>
      <lr-dock-panel
        edge="end"
        extent="240px"
        min-extent="160px"
        max-extent="280px"
        collapsible
      >
        <div style="white-space:nowrap">${longText}</div>
      </lr-dock-panel>
    </div>
  `);
  const panel = wrapper.querySelector("lr-dock-panel") as LyraDockPanel;
  await elementUpdated(panel);
  const main = wrapper.querySelector("main")!;
  const toggle = panel.shadowRoot!.querySelector<HTMLButtonElement>(
    '[part="collapse-toggle"]'
  )!;

  const assertContained = (): void => {
    const wrapperRect = wrapper.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const mainRect = main.getBoundingClientRect();
    const baseRect = panel.shadowRoot!
      .querySelector<HTMLElement>('[part="base"]')!
      .getBoundingClientRect();
    const contentRect = panel.shadowRoot!
      .querySelector<HTMLElement>('[part="content"]')!
      .getBoundingClientRect();
    const containedRects: Array<readonly [string, DOMRect]> = [
      ["panel", panelRect],
      ["main", mainRect],
      ["base", baseRect],
    ];
    if (!panel.collapsed) containedRects.push(["content", contentRect]);
    for (const [label, rect] of containedRects) {
      expect(rect.left, `${label} left edge`).to.be.at.least(wrapperRect.left - 1);
      expect(rect.right, `${label} right edge`).to.be.at.most(wrapperRect.right + 1);
    }
    expect(panelRect.right, "RTL end panel stays physically before main").to.be.at.most(
      mainRect.left + 1
    );
    expect(wrapper.scrollWidth).to.be.at.most(wrapper.clientWidth);
  };

  expect(wrapper.clientWidth).to.equal(320);
  expect(panel.getBoundingClientRect().width).to.be.closeTo(240, 1);
  expect(main.scrollWidth).to.be.greaterThan(main.clientWidth);
  const content = panel.shadowRoot!.querySelector<HTMLElement>('[part="content"]')!;
  expect(content.scrollWidth).to.be.greaterThan(content.clientWidth);
  assertContained();

  toggle.click();
  await elementUpdated(panel);
  expect(panel.collapsed).to.equal(true);
  expect(panel.getBoundingClientRect().width).to.be.closeTo(40, 1);
  assertContained();

  toggle.click();
  await elementUpdated(panel);
  expect(panel.collapsed).to.equal(false);
  expect(panel.getBoundingClientRect().width).to.be.closeTo(240, 1);
  assertContained();
});

it("renders no drag handle at all when resizable is false", async () => {
  const el = await dockedFixture();
  el.resizable = false;
  await elementUpdated(el);
  expect(el.shadowRoot!.querySelector('[part="handle"]')).to.equal(null);
});

it('honors the plain resizable="false" attribute form, not just a property binding', async () => {
  const el = await dockedFixture('resizable="false"');
  await elementUpdated(el);
  expect(el.resizable).to.equal(false);
  expect(el.shadowRoot!.querySelector('[part="handle"]')).to.equal(null);
});

it("sets aria-orientation to horizontal for a top/bottom-docked handle", async () => {
  const el = await dockedFixture("", "bottom");
  await elementUpdated(el);
  const handle = el.shadowRoot!.querySelector('[part="handle"]')!;
  expect(handle.getAttribute("aria-orientation")).to.equal("horizontal");
});

it("applies the extent property as the host inline-size for a start/end edge", async () => {
  const el = await dockedFixture('extent="300px"');
  await elementUpdated(el);
  expect(el.getBoundingClientRect().width).to.be.closeTo(300, 1);
});

it("applies the extent property as the host block-size for a top/bottom edge", async () => {
  const el = await dockedFixture('extent="150px"', "top");
  await elementUpdated(el);
  expect(el.getBoundingClientRect().height).to.be.closeTo(150, 1);
});

it("lets an explicit min-extent below the collapsed-rail token width render while expanded", async () => {
  // --lr-icon-button-size (the collapsed-rail token) is 2.5rem = 40px --
  // an unconditional CSS min-inline-size floor at that width used to win
  // over this smaller explicit extent/min-extent even though nothing here is
  // collapsed.
  const el = await dockedFixture(
    'extent="24px" min-extent="24px" max-extent="200px"'
  );
  await elementUpdated(el);
  expect(el.getBoundingClientRect().width).to.be.closeTo(24, 1);
});

it("resizes via keyboard and emits lr-resize with a px extent in the detail", async () => {
  const el = await dockedFixture(
    'extent="300px" min-extent="100px" max-extent="500px"'
  );
  await elementUpdated(el);
  const handle = el.shadowRoot!.querySelector('[part="handle"]') as HTMLElement;

  let detail: DockPanelResizeDetail | undefined;
  el.addEventListener(
    "lr-resize",
    (e) => (detail = (e as CustomEvent<DockPanelResizeDetail>).detail)
  );
  // edge="end" in LTR: the panel's right edge is pinned, so ArrowLeft (moving
  // the draggable left edge further left) grows it.
  handle.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })
  );
  await elementUpdated(el);
  expect(el.extent).to.equal("316px");
  expect(detail!.extent).to.equal("316px");

  handle.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  await elementUpdated(el);
  expect(el.extent).to.equal("300px");
});

it('swaps ArrowLeft/ArrowRight for edge="end" under dir="rtl"', async () => {
  const el = await fixture(
    html`<div
      dir="rtl"
      style="position: relative; height: 10rem; display: flex;"
    >
      <lr-dock-panel
        edge="end"
        extent="300px"
        min-extent="100px"
        max-extent="500px"
      ></lr-dock-panel>
    </div>`
  );
  const panel = el.querySelector("lr-dock-panel") as LyraDockPanel;
  await elementUpdated(panel);
  const handle = panel.shadowRoot!.querySelector(
    '[part="handle"]'
  ) as HTMLElement;

  // Under RTL, edge="end" is physically pinned to the left, so ArrowRight now
  // grows it (the mirror image of the LTR case above).
  handle.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  await elementUpdated(panel);
  expect(panel.extent).to.equal("316px");
});

it('does not swap ArrowUp/ArrowDown for a top/bottom edge under dir="rtl"', async () => {
  const el = await fixture(
    html`<div
      dir="rtl"
      style="position: relative; height: 10rem; display: flex; flex-direction: column;"
    >
      <lr-dock-panel
        edge="top"
        extent="150px"
        min-extent="80px"
        max-extent="300px"
      ></lr-dock-panel>
    </div>`
  );
  const panel = el.querySelector("lr-dock-panel") as LyraDockPanel;
  await elementUpdated(panel);
  const handle = panel.shadowRoot!.querySelector(
    '[part="handle"]'
  ) as HTMLElement;
  handle.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
  );
  await elementUpdated(panel);
  expect(panel.extent).to.equal("166px");
});

it("clamps keyboard resizing to min-extent and max-extent", async () => {
  const el = await dockedFixture(
    'extent="110px" min-extent="100px" max-extent="200px"'
  );
  await elementUpdated(el);
  const handle = el.shadowRoot!.querySelector('[part="handle"]') as HTMLElement;

  for (let i = 0; i < 10; i++) {
    handle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
    );
  }
  await elementUpdated(el);
  expect(el.extent).to.equal("100px");

  for (let i = 0; i < 10; i++) {
    handle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })
    );
  }
  await elementUpdated(el);
  expect(el.extent).to.equal("200px");
});

it('resizes via pointer drag and mirrors direction under dir="rtl"', async () => {
  const el = await dockedFixture(
    'extent="300px" min-extent="100px" max-extent="500px"'
  );
  await elementUpdated(el);
  const handle = el.shadowRoot!.querySelector('[part="handle"]') as HTMLElement;
  handle.setPointerCapture = () => {};

  const resized = oneEvent(el, "lr-resize");
  handle.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 1,
      clientX: 200,
    })
  );
  // edge="end" LTR: dragging left (toward more-negative clientX) grows it.
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 1, clientX: 150 })
  );
  const { detail } = (await resized) as CustomEvent<DockPanelResizeDetail>;
  expect(detail.extent).to.equal("350px");
  expect(el.extent).to.equal("350px");
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
});

it("routes an adopted drag through its owner window and removes that realm's listeners on adoption", async () => {
  const el = await dockedFixture(
    'extent="300px" min-extent="100px" max-extent="500px"'
  );
  el.remove();
  const frame = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
  const frameDocument = frame.contentDocument;
  const frameWindow = frame.contentWindow;
  if (!frameDocument || !frameWindow) throw new Error("The iframe realm was unavailable.");
  const originalRemoveEventListener = frameWindow.removeEventListener;
  const removedPointerTypes: string[] = [];
  frameWindow.removeEventListener = ((
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions
  ) => {
    if (type.startsWith("pointer") || type === "lostpointercapture") removedPointerTypes.push(type);
    originalRemoveEventListener.call(frameWindow, type, listener, options);
  }) as typeof frameWindow.removeEventListener;

  try {
    frameDocument.adoptNode(el);
    const wrapper = frameDocument.createElement("div");
    wrapper.style.inlineSize = "600px";
    frameDocument.body.append(wrapper);
    wrapper.append(el);
    await elementUpdated(el);
    const handle = el.shadowRoot!.querySelector('[part="handle"]') as HTMLElement;
    handle.setPointerCapture = () => {};
    const expectedExtent = `${Math.round(
      Math.min(500, Math.max(100, el.getBoundingClientRect().width + 50))
    )}px`;
    handle.dispatchEvent(
      new frameWindow.PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 72,
        clientX: 200,
      })
    );

    window.dispatchEvent(
      new PointerEvent("pointermove", { pointerId: 72, clientX: 150 })
    );
    expect(el.extent, "the ambient window must not own the adopted drag").to.equal("300px");

    frameWindow.dispatchEvent(
      new frameWindow.PointerEvent("pointermove", { pointerId: 72, clientX: 150 })
    );
    expect(el.extent).to.equal(expectedExtent);

    document.adoptNode(el);
    expect([...new Set(removedPointerTypes)].sort()).to.deep.equal([
      "lostpointercapture",
      "pointercancel",
      "pointermove",
      "pointerup",
    ]);
    frameWindow.dispatchEvent(
      new frameWindow.PointerEvent("pointermove", { pointerId: 72, clientX: 100 })
    );
    expect(el.extent, "the old owner window listener must be removed").to.equal(expectedExtent);
  } finally {
    if (el.ownerDocument !== document) document.adoptNode(el);
    frameWindow.removeEventListener = originalRemoveEventListener;
    el.remove();
    frame.remove();
  }
});

it("constructs its container observer in the adopted owner realm and disconnects it on adoption", async () => {
  const el = await dockedFixture();
  el.remove();
  const frame = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
  const frameDocument = frame.contentDocument;
  const frameWindow = frame.contentWindow;
  if (!frameDocument || !frameWindow) throw new Error("The iframe realm was unavailable.");
  const OriginalResizeObserver = frameWindow.ResizeObserver;
  let constructions = 0;
  let disconnects = 0;
  class OwnerResizeObserver implements ResizeObserver {
    constructor(_callback: ResizeObserverCallback) {
      constructions++;
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {
      disconnects++;
    }
  }
  frameWindow.ResizeObserver = OwnerResizeObserver;

  try {
    frameDocument.adoptNode(el);
    frameDocument.body.append(el);
    expect(constructions).to.equal(1);
    document.adoptNode(el);
    expect(disconnects).to.equal(1);
  } finally {
    frameWindow.ResizeObserver = OriginalResizeObserver;
    if (el.ownerDocument !== document) document.adoptNode(el);
    el.remove();
    frame.remove();
  }
});

it("falls back to its owner viewport when it has no containing element", async () => {
  const el = await dockedFixture();
  el.remove();
  const frame = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
  const frameDocument = frame.contentDocument;
  const frameWindow = frame.contentWindow;
  if (!frameDocument || !frameWindow) throw new Error("The iframe realm was unavailable.");
  const widthDescriptor = Object.getOwnPropertyDescriptor(frameWindow, "innerWidth");
  const heightDescriptor = Object.getOwnPropertyDescriptor(frameWindow, "innerHeight");

  try {
    Object.defineProperty(frameWindow, "innerWidth", { configurable: true, value: 321 });
    Object.defineProperty(frameWindow, "innerHeight", { configurable: true, value: 654 });
    frameDocument.adoptNode(el);
    const internals = el as unknown as { containerPx(): number };
    expect(internals.containerPx()).to.equal(321);
    el.edge = "top";
    expect(internals.containerPx()).to.equal(654);
  } finally {
    if (widthDescriptor) Object.defineProperty(frameWindow, "innerWidth", widthDescriptor);
    else delete (frameWindow as unknown as { innerWidth?: number }).innerWidth;
    if (heightDescriptor) Object.defineProperty(frameWindow, "innerHeight", heightDescriptor);
    else delete (frameWindow as unknown as { innerHeight?: number }).innerHeight;
    if (el.ownerDocument !== document) document.adoptNode(el);
    el.remove();
    frame.remove();
  }
});

it("ignores a pointermove/pointerup from an unrelated pointerId mid-drag", async () => {
  const el = await dockedFixture(
    'extent="300px" min-extent="100px" max-extent="500px"'
  );
  await elementUpdated(el);
  const handle = el.shadowRoot!.querySelector('[part="handle"]') as HTMLElement;
  handle.setPointerCapture = () => {};

  handle.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 1,
      clientX: 200,
    })
  );
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 2, clientX: 100 })
  );
  await elementUpdated(el);
  expect(el.extent).to.equal("300px");
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
});

it("aborts an active pointer resize when collapsed is enabled mid-gesture", async () => {
  const el = await dockedFixture(
    'extent="300px" min-extent="100px" max-extent="500px" collapsible'
  );
  await elementUpdated(el);
  const handle = el.shadowRoot!.querySelector('[part="handle"]') as HTMLElement;
  handle.setPointerCapture = () => {};
  let events = 0;
  el.addEventListener("lr-resize", () => (events += 1));
  handle.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 31,
      clientX: 200,
    })
  );

  el.collapsed = true;
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 31, clientX: 100 })
  );

  expect(el.extent).to.equal("300px");
  expect(events).to.equal(0);
});

it("aborts an active pointer resize when resizable is revoked mid-gesture", async () => {
  const el = await dockedFixture(
    'extent="300px" min-extent="100px" max-extent="500px"'
  );
  await elementUpdated(el);
  const handle = el.shadowRoot!.querySelector('[part="handle"]') as HTMLElement;
  handle.setPointerCapture = () => {};
  handle.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 32,
      clientX: 200,
    })
  );

  el.resizable = false;
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 32, clientX: 100 })
  );

  expect(el.extent).to.equal("300px");
});

it("does not throw on a stray pointermove/pointerup after disconnect mid-drag", async () => {
  const el = await dockedFixture('extent="300px"');
  await elementUpdated(el);
  const handle = el.shadowRoot!.querySelector('[part="handle"]') as HTMLElement;
  handle.setPointerCapture = () => {};
  handle.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 1,
      clientX: 200,
    })
  );

  el.remove();

  expect(() => {
    window.dispatchEvent(
      new PointerEvent("pointermove", { pointerId: 1, clientX: 50 })
    );
    window.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 1 }));
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
  }).to.not.throw();
});

it("toggles collapsed via the collapse-toggle button and emits lr-collapse-change", async () => {
  const el = await dockedFixture('extent="280px" collapsible');
  await elementUpdated(el);
  const toggle = el.shadowRoot!.querySelector(
    '[part="collapse-toggle"]'
  ) as HTMLElement;
  expect((toggle) !== (null)).to.equal(true);
  expect(toggle.getAttribute("aria-expanded")).to.equal("true");

  let detail: DockPanelCollapseChangeDetail | undefined;
  el.addEventListener(
    "lr-collapse-change",
    (e) => (detail = (e as CustomEvent<DockPanelCollapseChangeDetail>).detail)
  );
  toggle.click();
  await elementUpdated(el);

  expect(el.collapsed).to.equal(true);
  expect(detail).to.deep.equal({ collapsed: true });
  expect(toggle.getAttribute("aria-expanded")).to.equal("false");
  const content = el.shadowRoot!.querySelector(
    '[part="content"]'
  ) as HTMLElement;
  expect(content.hidden).to.equal(true);
  // No drag handle while collapsed -- nothing meaningful to resize.
  expect(el.shadowRoot!.querySelector('[part="handle"]')).to.equal(null);
});

it("emits a cancelable lr-collapse-request before lr-collapse-change, vetoing the mutation when prevented", async () => {
  const el = await dockedFixture('extent="280px" collapsible');
  await elementUpdated(el);
  const toggle = el.shadowRoot!.querySelector(
    '[part="collapse-toggle"]'
  ) as HTMLElement;

  const order: string[] = [];
  el.addEventListener("lr-collapse-request", (e) => {
    order.push("lr-collapse-request");
    expect((e as CustomEvent).cancelable).to.equal(true);
    expect(el.collapsed, "collapsed must still be false while the request is pending").to.equal(false);
    e.preventDefault();
  });
  el.addEventListener("lr-collapse-change", () => order.push("lr-collapse-change"));

  toggle.click();
  await elementUpdated(el);

  expect(order, "a prevented request must veto the mutation and skip lr-collapse-change").to.deep.equal([
    "lr-collapse-request",
  ]);
  expect(el.collapsed).to.equal(false);
});

it("preserves the last expanded extent across a collapse/expand round trip", async () => {
  const el = await dockedFixture('extent="280px" collapsible');
  await elementUpdated(el);
  expect(el.extent).to.equal("280px");

  const toggle = el.shadowRoot!.querySelector(
    '[part="collapse-toggle"]'
  ) as HTMLElement;
  toggle.click();
  await elementUpdated(el);
  expect(el.collapsed).to.equal(true);
  expect(el.extent).to.equal("280px"); // untouched while collapsed

  toggle.click();
  await elementUpdated(el);
  expect(el.collapsed).to.equal(false);
  expect(el.extent).to.equal("280px");
  expect(el.getBoundingClientRect().width).to.be.closeTo(280, 1);
});

it("rotates the collapse-toggle chevron toward the pinned edge when expanded, away when collapsed", async () => {
  // edge="end" in LTR is physically pinned to the right: expanded, the
  // chevron (which points right at 0deg by default) should point straight
  // at that pinned edge; collapsed, it should flip to point away (left).
  const endLtr = await dockedFixture("collapsible", "end");
  await elementUpdated(endLtr);
  const chevron = (el: LyraDockPanel) =>
    el.shadowRoot!.querySelector(
      '[part="collapse-toggle"] span'
    ) as HTMLElement;
  expect(chevron(endLtr).style.transform).to.equal("rotate(0deg)");
  endLtr.collapsed = true;
  await elementUpdated(endLtr);
  expect(chevron(endLtr).style.transform).to.equal("rotate(180deg)");

  // Mirrored case: edge="start" under dir="rtl" is *also* physically pinned
  // to the right (the inline-start side flips to the right under RTL), so
  // it must match the edge="end" LTR case exactly.
  const rtlWrapper = (await fixture(
    html`<div
      dir="rtl"
      style="position: relative; height: 10rem; display: flex;"
    >
      <lr-dock-panel edge="start" collapsible></lr-dock-panel>
    </div>`
  )) as HTMLDivElement;
  const startRtl = rtlWrapper.querySelector("lr-dock-panel") as LyraDockPanel;
  await elementUpdated(startRtl);
  expect(chevron(startRtl).style.transform).to.equal("rotate(0deg)");
  startRtl.collapsed = true;
  await elementUpdated(startRtl);
  expect(chevron(startRtl).style.transform).to.equal("rotate(180deg)");
});

it("points top and bottom collapse toggles toward their pinned edge until collapsed", async () => {
  for (const [edge, expanded, collapsed] of [
    ["top", -90, 90],
    ["bottom", 90, -90],
  ] as const) {
    const el = await dockedFixture("collapsible", edge);
    await elementUpdated(el);
    const chevron = el.shadowRoot!.querySelector(
      '[part="collapse-toggle"] span'
    ) as HTMLElement;

    expect(chevron.style.transform, `${edge} while expanded`).to.equal(
      `rotate(${expanded}deg)`
    );
    el.collapsed = true;
    await elementUpdated(el);
    expect(chevron.style.transform, `${edge} while collapsed`).to.equal(
      `rotate(${collapsed}deg)`
    );
  }
});

it('flips the top/bottom collapse-toggle centering translate under dir="rtl"', async () => {
  const toggleTranslateX = async (dirAttr: string): Promise<number> => {
    const wrapper = (await fixture(
      `<div dir="${dirAttr}" style="position: relative; height: 10rem;">
        <lr-dock-panel edge="top" collapsible>panel body</lr-dock-panel>
      </div>`
    )) as HTMLDivElement;
    const el = wrapper.querySelector("lr-dock-panel") as LyraDockPanel;
    await elementUpdated(el);
    const toggle = el.shadowRoot!.querySelector(
      '[part="collapse-toggle"]'
    ) as HTMLElement;
    return new DOMMatrixReadOnly(getComputedStyle(toggle).transform).m41;
  };
  // The top/bottom toggles center on inset-inline-start: 50%, which anchors to the physical
  // right edge under RTL -- the centering translateX must resolve leftward (negative) in LTR
  // and rightward (positive) in RTL to keep the toggle at the horizontal center.
  expect(await toggleTranslateX("ltr")).to.be.lessThan(0);
  expect(await toggleTranslateX("rtl")).to.be.greaterThan(0);
});

it("keeps aria-valuemax/aria-valuenow live against a passive container resize", async () => {
  const wrapper = (await fixture(
    `<div style="position: relative; width: 400px; height: 20rem; display: flex;">
      <div style="flex: 1;">main</div>
      <lr-dock-panel edge="end" extent="100px" min-extent="50px"></lr-dock-panel>
    </div>`
  )) as HTMLDivElement;
  const el = wrapper.querySelector("lr-dock-panel") as LyraDockPanel;
  await elementUpdated(el);
  const handle = () =>
    el.shadowRoot!.querySelector('[part="handle"]') as HTMLElement;
  const initialMax = handle().getAttribute("aria-valuemax");
  expect(initialMax).to.equal("400");

  // Grow the container without touching any property on the panel itself --
  // nothing here schedules a Lit re-render on its own, so this only reaches
  // aria-valuemax/aria-valuenow via the panel's own ResizeObserver on its
  // parent.
  wrapper.style.width = "800px";
  await new Promise<void>((resolve) => {
    const ro = new ResizeObserver(() => {
      ro.disconnect();
      resolve();
    });
    ro.observe(wrapper);
  });
  await elementUpdated(el);
  expect(handle().getAttribute("aria-valuemax")).to.equal("800");
});

it("is accessible in its default state (no collapsible, resizable handle only)", async () => {
  const el = await dockedFixture();
  await elementUpdated(el);
  await expect(el).to.be.accessible();
});

it("is accessible when collapsible and populated with content", async () => {
  const el = await dockedFixture('extent="280px" collapsible');
  await elementUpdated(el);
  await expect(el).to.be.accessible();
});

it("is accessible while collapsed", async () => {
  const el = await dockedFixture('extent="280px" collapsible collapsed');
  await elementUpdated(el);
  await expect(el).to.be.accessible();
});

describe("aria-label localization", () => {
  it("defaults to the built-in English aria-labels for handle and collapse-toggle", async () => {
    const el = await dockedFixture("collapsible");
    await elementUpdated(el);
    const handle = el.shadowRoot!.querySelector('[part="handle"]')!;
    const toggle = el.shadowRoot!.querySelector('[part="collapse-toggle"]')!;
    expect(handle.getAttribute("aria-label")).to.equal("Resize panel");
    expect(toggle.getAttribute("aria-label")).to.equal("Collapse panel");

    el.collapsed = true;
    await elementUpdated(el);
    expect(toggle.getAttribute("aria-label")).to.equal("Expand panel");
  });

  it("honors a strings override for dockPanelResize/dockPanelCollapse/dockPanelExpand", async () => {
    const wrapper = (await fixture(
      html`<div style="position: relative; height: 20rem; display: flex;">
        <lr-dock-panel
          collapsible
          .strings=${{
            dockPanelResize: "Redimensionner le panneau",
            dockPanelCollapse: "Réduire le panneau",
            dockPanelExpand: "Agrandir le panneau",
          }}
        ></lr-dock-panel>
      </div>`
    )) as HTMLDivElement;
    const el = wrapper.querySelector("lr-dock-panel") as LyraDockPanel;
    await elementUpdated(el);
    const handle = el.shadowRoot!.querySelector('[part="handle"]')!;
    const toggle = el.shadowRoot!.querySelector('[part="collapse-toggle"]')!;
    expect(handle.getAttribute("aria-label")).to.equal(
      "Redimensionner le panneau"
    );
    expect(toggle.getAttribute("aria-label")).to.equal("Réduire le panneau");

    el.collapsed = true;
    await elementUpdated(el);
    expect(toggle.getAttribute("aria-label")).to.equal("Agrandir le panneau");
  });
});

it("no longer answers to the pre-8.0.0 size/min-size/max-size attributes — extent replaced them outright", async () => {
  const el = await dockedFixture('size="300px" min-size="24px" max-size="500px"');
  await elementUpdated(el);
  // `size` was a CSS length on a property name the rest of the library reserves for a tier on the
  // six-step ladder; the rename is clean, with no alias, so the old spellings are inert.
  expect(el.extent).to.equal("280px");
  expect(el.minExtent).to.equal("160px");
  expect(el.maxExtent).to.equal("");
  expect(el.getBoundingClientRect().width).to.be.closeTo(280, 1);
});
