import {
  fixture,
  expect,
  html,
  elementUpdated,
  oneEvent,
  waitUntil,
} from "@open-wc/testing";
import "./dock-panel.js";
import type {
  LyraDockPanel,
  LyraDockPanelResizeDetail,
  LyraDockPanelCollapseChangeDetail,
} from "./dock-panel.js";
import { resetMouse, sendMouse } from "../../../../test/wtr-mouse.js";
import { expectStaleAttribute } from '../../../../test/expected-stale-attributes.js';

// Removed-attribute regression tests below deliberately author these; see the helper.
expectStaleAttribute('lr-dock-panel', 'size');
expectStaleAttribute('lr-dock-panel', 'min-size');
expectStaleAttribute('lr-dock-panel', 'max-size');

async function dockedFixture(attrs = "", edge = "end"): Promise<LyraDockPanel> {
  const wrapper = (await fixture(
    `<div style="position: relative; height: 20rem; display: flex;">
      <div style="flex: 1;">main</div>
      <lr-dock-panel edge="${edge}" ${attrs}>panel body</lr-dock-panel>
    </div>`
  )) as HTMLDivElement;
  return wrapper.querySelector("lr-dock-panel") as LyraDockPanel;
}

function primaryPointer(
  pointerId: number,
  init: PointerEventInit = {}
): PointerEventInit {
  return {
    bubbles: true,
    pointerId,
    pointerType: "mouse",
    isPrimary: true,
    button: 0,
    ...init,
  };
}

it("renders with defaults: docked to the end edge, a resizable handle, no collapse toggle", async () => {
  const el = await dockedFixture();
  await elementUpdated(el);
  expect(el.edge).to.equal("end");
  expect(el.resizable).to.equal(true);
  expect(el.collapsible).to.equal(false);
  const handle = el.shadowRoot!.querySelector('[part="handle"]');
  expect(handle !== null).to.equal(true);
  expect(handle!.getAttribute("role")).to.equal("separator");
  expect(handle!.getAttribute("aria-orientation")).to.equal("vertical");
  expect(
    el.shadowRoot!.querySelector('[part="collapse-toggle"]') === null
  ).to.equal(true);
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
      <main style="flex:1 1 0;min-inline-size:0;overflow:auto">
        ${longText}
      </main>
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
    const baseRect = panel
      .shadowRoot!.querySelector<HTMLElement>('[part="base"]')!
      .getBoundingClientRect();
    const contentRect = panel
      .shadowRoot!.querySelector<HTMLElement>('[part="content"]')!
      .getBoundingClientRect();
    const containedRects: Array<readonly [string, DOMRect]> = [
      ["panel", panelRect],
      ["main", mainRect],
      ["base", baseRect],
    ];
    if (!panel.collapsed) containedRects.push(["content", contentRect]);
    for (const [label, rect] of containedRects) {
      expect(rect.left, `${label} left edge`).to.be.at.least(
        wrapperRect.left - 1
      );
      expect(rect.right, `${label} right edge`).to.be.at.most(
        wrapperRect.right + 1
      );
    }
    expect(
      panelRect.right,
      "RTL end panel stays physically before main"
    ).to.be.at.most(mainRect.left + 1);
    expect(wrapper.scrollWidth).to.be.at.most(wrapper.clientWidth);
  };

  expect(wrapper.clientWidth).to.equal(320);
  expect(panel.getBoundingClientRect().width).to.be.closeTo(240, 1);
  expect(main.scrollWidth).to.be.greaterThan(main.clientWidth);
  const content =
    panel.shadowRoot!.querySelector<HTMLElement>('[part="content"]')!;
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
  expect(el.shadowRoot!.querySelector('[part="handle"]') === null).to.equal(
    true
  );
});

it('honors the plain resizable="false" attribute form, not just a property binding', async () => {
  const el = await dockedFixture('resizable="false"');
  await elementUpdated(el);
  expect(el.resizable).to.equal(false);
  expect(el.shadowRoot!.querySelector('[part="handle"]') === null).to.equal(
    true
  );
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

it("inherits the collapsed rail size while a direct host value remains authoritative", async () => {
  const wrapper = (await fixture(html`
    <div
      style="position:relative;display:flex;inline-size:300px;--lr-dock-panel-collapsed-size:52px"
    >
      <main style="flex:1 1 0">main</main>
      <lr-dock-panel collapsible collapsed>panel body</lr-dock-panel>
    </div>
  `)) as HTMLElement;
  const el = wrapper.querySelector("lr-dock-panel") as LyraDockPanel;
  await elementUpdated(el);
  expect(el.getBoundingClientRect().width).to.be.closeTo(52, 1);

  el.style.setProperty("--lr-dock-panel-collapsed-size", "44px");
  expect(el.getBoundingClientRect().width).to.be.closeTo(44, 1);
});

it("applies and clamps block-size extent for a top/bottom edge", async () => {
  const el = await dockedFixture('extent="150px"', "top");
  await elementUpdated(el);
  expect(el.extent).to.equal("160px");
  expect(el.getBoundingClientRect().height).to.be.closeTo(160, 1);
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

it("treats each genuine keyboard step as a frozen input/change transaction", async () => {
  const el = await dockedFixture(
    'extent="300px" min-extent="100px" max-extent="500px"'
  );
  await elementUpdated(el);
  const handle = el.shadowRoot!.querySelector('[part="handle"]') as HTMLElement;

  const order: string[] = [];
  const details: LyraDockPanelResizeDetail[] = [];
  el.addEventListener("lr-resize-input", (event) => {
    order.push(event.type);
    details.push((event as CustomEvent<LyraDockPanelResizeDetail>).detail);
  });
  el.addEventListener("lr-resize-change", (event) => {
    order.push(event.type);
    details.push((event as CustomEvent<LyraDockPanelResizeDetail>).detail);
  });
  let legacyEvents = 0;
  el.addEventListener("lr-resize", () => (legacyEvents += 1));
  // edge="end" in LTR: the panel's right edge is pinned, so ArrowLeft (moving
  // the draggable left edge further left) grows it.
  handle.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })
  );
  await elementUpdated(el);
  expect(el.extent).to.equal("316px");
  expect(order).to.deep.equal(["lr-resize-input", "lr-resize-change"]);
  expect(details.map((detail) => detail.extent)).to.deep.equal([
    "316px",
    "316px",
  ]);
  expect(details[0]).to.not.equal(details[1]);
  expect(details.every((detail) => Object.isFrozen(detail))).to.equal(true);
  expect(legacyEvents).to.equal(0);

  handle.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  await elementUpdated(el);
  expect(el.extent).to.equal("300px");
  expect(order).to.deep.equal([
    "lr-resize-input",
    "lr-resize-change",
    "lr-resize-input",
    "lr-resize-change",
  ]);
});

it("proposes a keyboard step through the cancelable lr-resize-request veto before applying it", async () => {
  const el = await dockedFixture(
    'extent="300px" min-extent="100px" max-extent="500px"'
  );
  await elementUpdated(el);
  const handle = el.shadowRoot!.querySelector('[part="handle"]') as HTMLElement;

  const requested: LyraDockPanelResizeDetail[] = [];
  el.addEventListener("lr-resize-request", (event) => {
    requested.push((event as CustomEvent<LyraDockPanelResizeDetail>).detail);
    event.preventDefault();
  });
  let inputs = 0;
  let changes = 0;
  el.addEventListener("lr-resize-input", () => (inputs += 1));
  el.addEventListener("lr-resize-change", () => (changes += 1));

  handle.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })
  );
  await elementUpdated(el);

  expect(requested.map((detail) => detail.extent)).to.deep.equal(["316px"]);
  // A prevented request simply does not apply -- extent stays put and neither
  // lr-resize-input nor lr-resize-change fires for the rejected step.
  expect(el.extent).to.equal("300px");
  expect(inputs).to.equal(0);
  expect(changes).to.equal(0);
});

it("does not fire lr-resize-request per continuous pointer-drag tick, only on the drag's final settle", async () => {
  const el = await dockedFixture(
    'extent="300px" min-extent="100px" max-extent="500px"'
  );
  await elementUpdated(el);
  const handle = el.shadowRoot!.querySelector('[part="handle"]') as HTMLElement;
  handle.setPointerCapture = () => {};

  let requests = 0;
  el.addEventListener("lr-resize-request", () => (requests += 1));
  const input = oneEvent(el, "lr-resize-input");

  handle.dispatchEvent(
    new PointerEvent("pointerdown", primaryPointer(1, { clientX: 200 }))
  );
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 1, clientX: 150 })
  );
  await input;
  expect(el.extent).to.equal("350px");
  expect(requests, "a live drag tick must not fire the veto event").to.equal(0);

  const secondInput = oneEvent(el, "lr-resize-input");
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 1, clientX: 140 })
  );
  await secondInput;
  expect(requests, "still no veto event mid-drag").to.equal(0);

  const request = oneEvent(el, "lr-resize-request");
  window.dispatchEvent(new PointerEvent("pointerup", primaryPointer(1)));
  const requestDetail = (
    (await request) as CustomEvent<LyraDockPanelResizeDetail>
  ).detail;
  expect(requestDetail).to.deep.equal({ extent: "360px" });
  expect(requests, "exactly one veto event, for the final settle").to.equal(1);
});

it("snaps a rejected pointer-drag final settle back to the size the gesture started from", async () => {
  const el = await dockedFixture(
    'extent="300px" min-extent="100px" max-extent="500px"'
  );
  await elementUpdated(el);
  const handle = el.shadowRoot!.querySelector('[part="handle"]') as HTMLElement;
  handle.setPointerCapture = () => {};

  el.addEventListener("lr-resize-request", (event) => event.preventDefault());
  let changes = 0;
  el.addEventListener("lr-resize-change", () => (changes += 1));
  const input = oneEvent(el, "lr-resize-input");

  handle.dispatchEvent(
    new PointerEvent("pointerdown", primaryPointer(1, { clientX: 200 }))
  );
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 1, clientX: 150 })
  );
  await input;
  expect(el.extent).to.equal("350px");

  window.dispatchEvent(new PointerEvent("pointerup", primaryPointer(1)));
  await elementUpdated(el);
  expect(el.extent, "rejected final settle snaps back to the pre-drag size").to.equal("300px");
  expect(changes, "lr-resize-change must not fire for a rejected settle").to.equal(0);
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
      style="position: relative; height: 20rem; display: flex; flex-direction: column;"
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

it('grows bottom and start edges with their physical backward/forward keys', async () => {
  const bottom = await dockedFixture(
    'extent="150px" min-extent="80px" max-extent="300px"',
    'bottom',
  );
  await elementUpdated(bottom);
  bottom.shadowRoot!.querySelector<HTMLElement>('[part="handle"]')!.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
  );
  await elementUpdated(bottom);
  expect(bottom.extent).to.equal('166px');

  const start = await dockedFixture(
    'extent="200px" min-extent="80px" max-extent="300px"',
    'start',
  );
  await elementUpdated(start);
  start.shadowRoot!.querySelector<HTMLElement>('[part="handle"]')!.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
  );
  await elementUpdated(start);
  expect(start.extent).to.equal('216px');

  const rtlWrapper = await fixture<HTMLElement>(html`
    <div dir="rtl" style="position:relative;display:flex;inline-size:500px;block-size:200px">
      <lr-dock-panel
        edge="start"
        extent="200px"
        min-extent="80px"
        max-extent="300px"
      ></lr-dock-panel>
    </div>
  `);
  const rtlStart = rtlWrapper.querySelector<LyraDockPanel>('lr-dock-panel')!;
  await elementUpdated(rtlStart);
  rtlStart.shadowRoot!.querySelector<HTMLElement>('[part="handle"]')!.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
  );
  await elementUpdated(rtlStart);
  expect(rtlStart.extent).to.equal('216px');
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

it("emits live input on a pointer transition and one terminal change on genuine pointerup", async () => {
  const el = await dockedFixture(
    'extent="300px" min-extent="100px" max-extent="500px"'
  );
  await elementUpdated(el);
  const handle = el.shadowRoot!.querySelector('[part="handle"]') as HTMLElement;
  handle.setPointerCapture = () => {};

  const input = oneEvent(el, "lr-resize-input");
  let changes = 0;
  el.addEventListener("lr-resize-change", () => (changes += 1));
  handle.dispatchEvent(
    new PointerEvent("pointerdown", primaryPointer(1, { clientX: 200 }))
  );
  // edge="end" LTR: dragging left (toward more-negative clientX) grows it.
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 1, clientX: 150 })
  );
  const { detail } = (await input) as CustomEvent<LyraDockPanelResizeDetail>;
  expect(detail.extent).to.equal("350px");
  expect(Object.isFrozen(detail)).to.equal(true);
  expect(el.extent).to.equal("350px");
  expect(changes).to.equal(0);

  const secondInput = oneEvent(el, "lr-resize-input");
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 1, clientX: 140 })
  );
  expect(
    ((await secondInput) as CustomEvent<LyraDockPanelResizeDetail>).detail
      .extent
  ).to.equal("360px");
  expect(changes).to.equal(0);

  const change = oneEvent(el, "lr-resize-change");
  window.dispatchEvent(new PointerEvent("pointerup", primaryPointer(1)));
  const changeDetail = (
    (await change) as CustomEvent<LyraDockPanelResizeDetail>
  ).detail;
  expect(changeDetail).to.deep.equal({ extent: "360px" });
  expect(Object.isFrozen(changeDetail)).to.equal(true);
  expect(changes).to.equal(1);
});

it('mirrors the physical pointer growth direction for edge="end" under RTL', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`
    <div dir="rtl" style="display:flex;inline-size:600px;block-size:200px">
      <main style="flex:1 1 0;min-inline-size:0">main</main>
      <lr-dock-panel
        edge="end"
        extent="300px"
        min-extent="100px"
        max-extent="500px"
      ></lr-dock-panel>
    </div>
  `);
  const el = wrapper.querySelector("lr-dock-panel") as LyraDockPanel;
  await elementUpdated(el);
  const handle = el.shadowRoot!.querySelector('[part="handle"]') as HTMLElement;
  handle.setPointerCapture = () => {};
  const input = oneEvent(el, "lr-resize-input");

  handle.dispatchEvent(
    new PointerEvent("pointerdown", primaryPointer(9, { clientX: 200 }))
  );
  // RTL logical end is physically left, so moving its inner/right edge right grows it.
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 9, clientX: 250 })
  );

  expect(
    ((await input) as CustomEvent<LyraDockPanelResizeDetail>).detail.extent
  ).to.equal("350px");
  expect(el.extent).to.equal("350px");
  window.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 9 }));
});

it("admits only a primary pointer's primary button before capture or drag state", async () => {
  const el = await dockedFixture(
    'extent="300px" min-extent="100px" max-extent="500px"'
  );
  await elementUpdated(el);
  const handle = el.shadowRoot!.querySelector('[part="handle"]') as HTMLElement;
  const captured: number[] = [];
  handle.setPointerCapture = (pointerId) => captured.push(pointerId);
  let inputs = 0;
  let changes = 0;
  el.addEventListener("lr-resize-input", () => (inputs += 1));
  el.addEventListener("lr-resize-change", () => (changes += 1));

  for (const [pointerId, init] of [
    [11, { pointerType: "mouse", isPrimary: true, button: 2 }],
    [12, { pointerType: "mouse", isPrimary: true, button: 1 }],
    [13, { pointerType: "pen", isPrimary: true, button: 2 }],
    [14, { pointerType: "pen", isPrimary: true, button: 5 }],
    [15, { pointerType: "touch", isPrimary: false, button: 0 }],
  ] as const) {
    handle.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId,
        ...init,
        clientX: 200,
      })
    );
    window.dispatchEvent(
      new PointerEvent("pointermove", { pointerId, clientX: 150 })
    );
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId }));
  }

  expect(captured).to.deep.equal([]);
  expect(el.extent).to.equal("300px");
  expect(inputs).to.equal(0);
  expect(changes).to.equal(0);

  for (const [index, pointerType] of ["mouse", "pen", "touch"].entries()) {
    const pointerId = 20 + index;
    handle.dispatchEvent(
      new PointerEvent(
        "pointerdown",
        primaryPointer(pointerId, { pointerType, clientX: 200 })
      )
    );
    window.dispatchEvent(
      new PointerEvent("pointermove", { pointerId, clientX: 190 })
    );
    window.dispatchEvent(new PointerEvent("pointercancel", { pointerId }));
  }

  expect(captured).to.deep.equal([20, 21, 22]);
  expect(inputs).to.equal(3);
  expect(changes).to.equal(0);
});

it("emits nothing for no-movement and fully clamped pointer or keyboard attempts", async () => {
  const el = await dockedFixture(
    'extent="100px" min-extent="100px" max-extent="200px"'
  );
  await elementUpdated(el);
  const handle = el.shadowRoot!.querySelector('[part="handle"]') as HTMLElement;
  handle.setPointerCapture = () => {};
  const events: string[] = [];
  el.addEventListener("lr-resize-input", (event) => events.push(event.type));
  el.addEventListener("lr-resize-change", (event) => events.push(event.type));

  handle.dispatchEvent(
    new PointerEvent("pointerdown", primaryPointer(40, { clientX: 200 }))
  );
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 40 }));

  handle.dispatchEvent(
    new PointerEvent("pointerdown", primaryPointer(41, { clientX: 200 }))
  );
  // edge=end/LTR: moving right asks to shrink below the already-active minimum.
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 41, clientX: 250 })
  );
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 41 }));

  handle.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  await elementUpdated(el);

  expect(el.extent).to.equal("100px");
  expect(events).to.deep.equal([]);
});

it("keeps live input but excludes cancel and lost capture from terminal change", async () => {
  for (const [index, endType] of [
    "pointercancel",
    "lostpointercapture",
  ].entries()) {
    const el = await dockedFixture(
      'extent="300px" min-extent="100px" max-extent="500px"'
    );
    await elementUpdated(el);
    const handle = el.shadowRoot!.querySelector(
      '[part="handle"]'
    ) as HTMLElement;
    handle.setPointerCapture = () => {};
    let inputs = 0;
    let changes = 0;
    el.addEventListener("lr-resize-input", () => (inputs += 1));
    el.addEventListener("lr-resize-change", () => (changes += 1));
    const pointerId = 50 + index;

    handle.dispatchEvent(
      new PointerEvent(
        "pointerdown",
        primaryPointer(pointerId, { clientX: 200 })
      )
    );
    window.dispatchEvent(
      new PointerEvent("pointermove", { pointerId, clientX: 150 })
    );
    window.dispatchEvent(new PointerEvent(endType, { pointerId }));

    expect(el.extent, endType).to.equal("350px");
    expect(inputs, endType).to.equal(1);
    expect(changes, endType).to.equal(0);
  }
});

it("cancels a terminal resize when live edge, extent, direction, or bounds invalidate its snapshot", async () => {
  const cases = [
    {
      label: "edge",
      mutate: (el: LyraDockPanel) => (el.edge = "start"),
    },
    {
      label: "extent",
      mutate: (el: LyraDockPanel) => (el.extent = "275px"),
    },
    {
      label: "direction",
      mutate: (el: LyraDockPanel) => {
        el.parentElement!.dir = "rtl";
        void getComputedStyle(el).direction;
      },
    },
    {
      label: "bounds",
      mutate: (el: LyraDockPanel) => (el.maxExtent = "450px"),
    },
  ];

  for (const [index, scenario] of cases.entries()) {
    const el = await dockedFixture(
      'extent="300px" min-extent="100px" max-extent="500px"'
    );
    await elementUpdated(el);
    const handle = el.shadowRoot!.querySelector(
      '[part="handle"]'
    ) as HTMLElement;
    handle.setPointerCapture = () => {};
    let inputs = 0;
    let changes = 0;
    el.addEventListener("lr-resize-input", () => (inputs += 1));
    el.addEventListener("lr-resize-change", () => (changes += 1));
    const pointerId = 60 + index;

    handle.dispatchEvent(
      new PointerEvent(
        "pointerdown",
        primaryPointer(pointerId, { clientX: 200 })
      )
    );
    window.dispatchEvent(
      new PointerEvent("pointermove", { pointerId, clientX: 150 })
    );
    expect(inputs, scenario.label).to.equal(1);
    scenario.mutate(el);
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId }));

    expect(changes, scenario.label).to.equal(0);
  }
});

it("routes an adopted drag through its owner window and removes that realm's listeners on adoption", async () => {
  const el = await dockedFixture(
    'extent="300px" min-extent="100px" max-extent="500px"'
  );
  el.remove();
  const frame = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
  const frameDocument = frame.contentDocument;
  const frameWindow = frame.contentWindow;
  if (!frameDocument || !frameWindow)
    throw new Error("The iframe realm was unavailable.");
  const originalRemoveEventListener = frameWindow.removeEventListener;
  const removedPointerTypes: string[] = [];
  frameWindow.removeEventListener = ((
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions
  ) => {
    if (type.startsWith("pointer") || type === "lostpointercapture")
      removedPointerTypes.push(type);
    if (listener !== null)
      originalRemoveEventListener.call(frameWindow, type, listener, options);
  }) as typeof frameWindow.removeEventListener;

  try {
    frameDocument.adoptNode(el);
    const wrapper = frameDocument.createElement("div");
    wrapper.style.inlineSize = "600px";
    frameDocument.body.append(wrapper);
    wrapper.append(el);
    await elementUpdated(el);
    const handle = el.shadowRoot!.querySelector(
      '[part="handle"]'
    ) as HTMLElement;
    handle.setPointerCapture = () => {};
    const expectedExtent = `${Math.round(
      Math.min(500, Math.max(100, el.getBoundingClientRect().width + 50))
    )}px`;
    handle.dispatchEvent(
      new frameWindow.PointerEvent("pointerdown", {
        ...primaryPointer(72),
        clientX: 200,
      })
    );

    window.dispatchEvent(
      new PointerEvent("pointermove", { pointerId: 72, clientX: 150 })
    );
    expect(
      el.extent,
      "the ambient window must not own the adopted drag"
    ).to.equal("300px");

    frameWindow.dispatchEvent(
      new frameWindow.PointerEvent("pointermove", {
        pointerId: 72,
        clientX: 150,
      })
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
      new frameWindow.PointerEvent("pointermove", {
        pointerId: 72,
        clientX: 100,
      })
    );
    expect(el.extent, "the old owner window listener must be removed").to.equal(
      expectedExtent
    );
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
  if (!frameDocument || !frameWindow)
    throw new Error("The iframe realm was unavailable.");
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
  if (!frameDocument || !frameWindow)
    throw new Error("The iframe realm was unavailable.");
  const widthDescriptor = Object.getOwnPropertyDescriptor(
    frameWindow,
    "innerWidth"
  );
  const heightDescriptor = Object.getOwnPropertyDescriptor(
    frameWindow,
    "innerHeight"
  );

  try {
    Object.defineProperty(frameWindow, "innerWidth", {
      configurable: true,
      value: 321,
    });
    Object.defineProperty(frameWindow, "innerHeight", {
      configurable: true,
      value: 654,
    });
    frameDocument.adoptNode(el);
    const internals = el as unknown as { containerPx(): number };
    expect(internals.containerPx()).to.equal(321);
    el.edge = "top";
    expect(internals.containerPx()).to.equal(654);
  } finally {
    if (widthDescriptor)
      Object.defineProperty(frameWindow, "innerWidth", widthDescriptor);
    else delete (frameWindow as unknown as { innerWidth?: number }).innerWidth;
    if (heightDescriptor)
      Object.defineProperty(frameWindow, "innerHeight", heightDescriptor);
    else
      delete (frameWindow as unknown as { innerHeight?: number }).innerHeight;
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
    new PointerEvent("pointerdown", primaryPointer(1, { clientX: 200 }))
  );
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 2, clientX: 100 })
  );
  await elementUpdated(el);
  expect(el.extent).to.equal("300px");
  window.dispatchEvent(new PointerEvent("pointerup", primaryPointer(1)));
});

it("aborts an active pointer resize when collapsed is enabled mid-gesture", async () => {
  const el = await dockedFixture(
    'extent="300px" min-extent="100px" max-extent="500px" collapsible'
  );
  await elementUpdated(el);
  const handle = el.shadowRoot!.querySelector('[part="handle"]') as HTMLElement;
  handle.setPointerCapture = () => {};
  let events = 0;
  el.addEventListener("lr-resize-input", () => (events += 1));
  el.addEventListener("lr-resize-change", () => (events += 1));
  handle.dispatchEvent(
    new PointerEvent("pointerdown", primaryPointer(31, { clientX: 200 }))
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
    new PointerEvent("pointerdown", primaryPointer(32, { clientX: 200 }))
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
    new PointerEvent("pointerdown", primaryPointer(1, { clientX: 200 }))
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
  expect(toggle !== null).to.equal(true);
  expect(toggle.getAttribute("aria-expanded")).to.equal("true");

  let requestDetail: LyraDockPanelCollapseChangeDetail | undefined;
  let detail: LyraDockPanelCollapseChangeDetail | undefined;
  el.addEventListener(
    "lr-collapse-request",
    (e) =>
      (requestDetail = (e as CustomEvent<LyraDockPanelCollapseChangeDetail>)
        .detail)
  );
  el.addEventListener(
    "lr-collapse-change",
    (e) =>
      (detail = (e as CustomEvent<LyraDockPanelCollapseChangeDetail>).detail)
  );
  toggle.click();
  await elementUpdated(el);

  expect(el.collapsed).to.equal(true);
  expect(requestDetail).to.deep.equal({ collapsed: true });
  expect(detail).to.deep.equal({ collapsed: true });
  expect(requestDetail).to.not.equal(detail);
  expect(Object.isFrozen(requestDetail)).to.equal(true);
  expect(Object.isFrozen(detail)).to.equal(true);
  expect(toggle.getAttribute("aria-expanded")).to.equal("false");
  const content = el.shadowRoot!.querySelector(
    '[part="content"]'
  ) as HTMLElement;
  expect(content.hidden).to.equal(true);
  // No drag handle while collapsed -- nothing meaningful to resize.
  expect(el.shadowRoot!.querySelector('[part="handle"]') === null).to.equal(
    true
  );
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
    expect(
      el.collapsed,
      "collapsed must still be false while the request is pending"
    ).to.equal(false);
    e.preventDefault();
  });
  el.addEventListener("lr-collapse-change", () =>
    order.push("lr-collapse-change")
  );

  toggle.click();
  await elementUpdated(el);

  expect(
    order,
    "a prevented request must veto the mutation and skip lr-collapse-change"
  ).to.deep.equal(["lr-collapse-request"]);
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

it("atomically clamps an absolute panel on shrink without restoring or emitting on grow", async () => {
  const wrapper = (await fixture(
    `<div style="position: relative; width: 400px; height: 20rem;">
      <lr-dock-panel
        style="position:absolute;inset-block:0;inset-inline-end:0"
        edge="end"
        extent="350px"
        min-extent="50px"
      ></lr-dock-panel>
    </div>`
  )) as HTMLDivElement;
  const el = wrapper.querySelector("lr-dock-panel") as LyraDockPanel;
  await elementUpdated(el);
  const handle = () =>
    el.shadowRoot!.querySelector('[part="handle"]') as HTMLElement;
  const events: string[] = [];
  el.addEventListener("lr-resize-input", (event) => events.push(event.type));
  el.addEventListener("lr-resize-change", (event) => events.push(event.type));

  const expectRange = (expected: {
    min: number;
    now: number;
    max: number;
  }): void => {
    const values = {
      min: Number(handle().getAttribute("aria-valuemin")),
      now: Number(handle().getAttribute("aria-valuenow")),
      max: Number(handle().getAttribute("aria-valuemax")),
    };
    expect(values).to.deep.equal(expected);
    expect(values.min).to.be.at.most(values.now);
    expect(values.now).to.be.at.most(values.max);
  };

  expect(el.getBoundingClientRect().width).to.be.closeTo(350, 1);
  expectRange({ min: 50, now: 350, max: 400 });

  wrapper.style.width = "200px";
  await waitUntil(
    () =>
      el.extent === "200px" && handle().getAttribute("aria-valuemax") === "200",
    "the panel did not reconcile to the smaller containing block"
  );
  expect(el.getBoundingClientRect().width).to.be.closeTo(200, 1);
  expectRange({ min: 50, now: 200, max: 200 });

  wrapper.style.width = "400px";
  await waitUntil(
    () => handle().getAttribute("aria-valuemax") === "400",
    "the separator range did not follow the grown containing block"
  );
  expect(el.extent).to.equal("200px");
  expect(el.getBoundingClientRect().width).to.be.closeTo(200, 1);
  expectRange({ min: 50, now: 200, max: 400 });
  expect(events).to.deep.equal([]);
});

it("reconciles direct flex-layout writes, percentage/rem bounds, and inverted ranges silently", async () => {
  const wrapper = await fixture<HTMLDivElement>(html`
    <div style="display:flex;inline-size:400px;block-size:200px">
      <main style="flex:1 1 0;min-inline-size:0">main</main>
      <lr-dock-panel
        edge="end"
        extent="50%"
        min-extent="2rem"
        max-extent="90%"
      ></lr-dock-panel>
    </div>
  `);
  const el = wrapper.querySelector("lr-dock-panel") as LyraDockPanel;
  await elementUpdated(el);
  const handle = () =>
    el.shadowRoot!.querySelector('[part="handle"]') as HTMLElement;
  const rootFontPx = Number.parseFloat(
    getComputedStyle(document.documentElement).fontSize
  );
  let events = 0;
  el.addEventListener("lr-resize-input", () => (events += 1));
  el.addEventListener("lr-resize-change", () => (events += 1));

  expect(el.extent).to.equal("50%");
  expect(el.getBoundingClientRect().width).to.be.closeTo(200, 1);
  expect(Number(handle().getAttribute("aria-valuemin"))).to.equal(
    Math.round(2 * rootFontPx)
  );
  expect(handle().getAttribute("aria-valuenow")).to.equal("200");
  expect(handle().getAttribute("aria-valuemax")).to.equal("360");

  el.extent = "999px";
  await elementUpdated(el);
  expect(el.extent).to.equal("360px");
  expect(el.getBoundingClientRect().width).to.be.closeTo(360, 1);

  el.extent = "1px";
  await elementUpdated(el);
  expect(el.extent).to.equal(`${Math.round(2 * rootFontPx)}px`);

  el.minExtent = "500px";
  el.maxExtent = "200px";
  el.extent = "300px";
  await elementUpdated(el);
  expect(el.extent).to.equal("200px");
  expect(handle().getAttribute("aria-valuemin")).to.equal("200");
  expect(handle().getAttribute("aria-valuenow")).to.equal("200");
  expect(handle().getAttribute("aria-valuemax")).to.equal("200");
  expect(events).to.equal(0);
});

it("reconciles block-axis percentage, em, and viewport-unit bounds", async () => {
  const wrapper = await fixture<HTMLDivElement>(html`
    <div
      style="display:flex;flex-direction:column;inline-size:300px;block-size:300px"
    >
      <main style="flex:1 1 0;min-block-size:0">main</main>
      <lr-dock-panel
        style="font-size:10px"
        edge="bottom"
        extent="50%"
        min-extent="2em"
        max-extent="80%"
      ></lr-dock-panel>
    </div>
  `);
  const el = wrapper.querySelector("lr-dock-panel") as LyraDockPanel;
  await elementUpdated(el);
  const handle = () =>
    el.shadowRoot!.querySelector('[part="handle"]') as HTMLElement;

  expect(el.getBoundingClientRect().height).to.be.closeTo(150, 1);
  expect(handle().getAttribute("aria-valuemin")).to.equal("20");
  expect(handle().getAttribute("aria-valuenow")).to.equal("150");
  expect(handle().getAttribute("aria-valuemax")).to.equal("240");

  el.maxExtent = "10vh";
  el.extent = "999px";
  await elementUpdated(el);
  const expectedMax = Math.round(
    Math.min(wrapper.getBoundingClientRect().height, window.innerHeight * 0.1)
  );
  expect(el.extent).to.equal(`${expectedMax}px`);
  expect(handle().getAttribute("aria-valuemin")).to.equal(
    String(Math.min(20, expectedMax))
  );
  expect(handle().getAttribute("aria-valuenow")).to.equal(String(expectedMax));
  expect(handle().getAttribute("aria-valuemax")).to.equal(String(expectedMax));
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
  const el = await dockedFixture(
    'size="300px" min-size="24px" max-size="500px"'
  );
  await elementUpdated(el);
  // `size` was a CSS length on a property name the rest of the library reserves for a tier on the
  // six-step ladder; the rename is clean, with no alias, so the old spellings are inert.
  expect(el.extent).to.equal("280px");
  expect(el.minExtent).to.equal("160px");
  expect(el.maxExtent).to.equal("");
  expect(el.getBoundingClientRect().width).to.be.closeTo(280, 1);
});

describe("collapse-toggle/handle hover and pressed theming cssprops", () => {
  // [part="collapse-toggle"] (unlike [part="handle"]) animates background/color across
  // --lr-transition-fast (120ms by default); reading getComputedStyle() synchronously right
  // after the hover/press pointer event would still see the *starting* value mid-transition, not
  // the settled target -- real timer, margined well past the token default, never fake timers
  // (wtr does not support @sinonjs/fake-timers).
  const settleTransition = (): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, 200));

  it("lets --lr-dock-panel-collapse-toggle-hover-bg/-hover-color retint the collapse toggle on hover, and feeds the pressed state through color-mix()", async () => {
    const el = await fixture<HTMLDivElement>(html`
      <div style="position: relative; height: 20rem; display: flex;">
        <lr-dock-panel
          edge="end"
          extent="280px"
          collapsible
          style="--lr-dock-panel-collapse-toggle-hover-bg: rgb(10, 20, 30); --lr-dock-panel-collapse-toggle-hover-color: rgb(40, 50, 60);"
        ></lr-dock-panel>
      </div>
    `);
    const panel = el.querySelector("lr-dock-panel") as LyraDockPanel;
    await elementUpdated(panel);
    const toggle = panel.shadowRoot!.querySelector(
      '[part="collapse-toggle"]'
    ) as HTMLElement;
    const resting = getComputedStyle(toggle).backgroundColor;
    const rect = toggle.getBoundingClientRect();
    const position: [number, number] = [
      Math.round(rect.left + rect.width / 2),
      Math.round(rect.top + rect.height / 2),
    ];
    try {
      await sendMouse({ type: "move", position });
      await settleTransition();
      expect(getComputedStyle(toggle).backgroundColor).to.equal(
        "rgb(10, 20, 30)"
      );
      expect(getComputedStyle(toggle).color).to.equal("rgb(40, 50, 60)");
      await sendMouse({ type: "down" });
      await settleTransition();
      const pressedBg = getComputedStyle(toggle).backgroundColor;
      // The pressed state derives from the same hover-bg token via color-mix(), so an override
      // reaches it too -- but visibly mixed further toward --lr-color-mix-partner, not identical
      // to the flat hover override.
      expect(pressedBg).to.not.equal("rgb(10, 20, 30)");
      expect(pressedBg).to.not.equal(resting);
      expect(getComputedStyle(toggle).color).to.equal("rgb(40, 50, 60)");
      await sendMouse({ type: "up" });
    } finally {
      await resetMouse();
    }
  });

  it("defaults --lr-dock-panel-collapse-toggle-hover-bg/-hover-color to the previous hardcoded brand tokens, so hover repaints unchanged when unset", async () => {
    const el = await dockedFixture("collapsible");
    await elementUpdated(el);
    const toggle = el.shadowRoot!.querySelector(
      '[part="collapse-toggle"]'
    ) as HTMLElement;
    // A probe resolves what --lr-color-brand-quiet/--lr-color-brand actually paint as, so the
    // hovered/pressed colors below can be checked against the *exact* previous hardcoded values
    // rather than merely "changed from resting".
    const probe = document.createElement("div");
    probe.style.cssText =
      "background-color: var(--lr-color-brand-quiet); color: var(--lr-color-brand);";
    el.shadowRoot!.appendChild(probe);
    const expectedHoverBg = getComputedStyle(probe).backgroundColor;
    const expectedHoverColor = getComputedStyle(probe).color;
    probe.remove();

    const resting = getComputedStyle(toggle).backgroundColor;
    const rect = toggle.getBoundingClientRect();
    const position: [number, number] = [
      Math.round(rect.left + rect.width / 2),
      Math.round(rect.top + rect.height / 2),
    ];
    try {
      await sendMouse({ type: "move", position });
      await settleTransition();
      const hovered = getComputedStyle(toggle).backgroundColor;
      expect(hovered).to.not.equal(resting);
      expect(hovered).to.equal(expectedHoverBg);
      expect(getComputedStyle(toggle).color).to.equal(expectedHoverColor);
    } finally {
      await resetMouse();
    }
  });

  it("lets --lr-dock-panel-handle-hover-color/-active-color retint the resize handle independently of the collapse-toggle's own tokens", async () => {
    const el = await fixture<HTMLDivElement>(html`
      <div style="position: relative; height: 20rem; display: flex;">
        <lr-dock-panel
          edge="end"
          extent="280px"
          style="--lr-dock-panel-handle-hover-color: rgb(70, 80, 90); --lr-dock-panel-handle-active-color: rgb(100, 110, 120);"
        ></lr-dock-panel>
      </div>
    `);
    const panel = el.querySelector("lr-dock-panel") as LyraDockPanel;
    await elementUpdated(panel);
    const handle = panel.shadowRoot!.querySelector(
      '[part="handle"]'
    ) as HTMLElement;
    const resting = getComputedStyle(handle).backgroundColor;
    handle.setPointerCapture = () => {};
    const rect = handle.getBoundingClientRect();
    const position: [number, number] = [
      Math.round(rect.left + rect.width / 2),
      Math.round(rect.top + rect.height / 2),
    ];
    try {
      await sendMouse({ type: "move", position });
      expect(getComputedStyle(handle).backgroundColor).to.equal(
        "rgb(70, 80, 90)"
      );
      expect(getComputedStyle(handle).backgroundColor).to.not.equal(resting);
      await sendMouse({ type: "down" });
      expect(getComputedStyle(handle).backgroundColor).to.equal(
        "rgb(100, 110, 120)"
      );
      await sendMouse({ type: "up" });
    } finally {
      await resetMouse();
    }
  });

  it("derives the resize handle's pressed color from its own hover token via color-mix() when only the hover token is overridden", async () => {
    const el = await fixture<HTMLDivElement>(html`
      <div style="position: relative; height: 20rem; display: flex;">
        <lr-dock-panel
          edge="end"
          extent="280px"
          style="--lr-dock-panel-handle-hover-color: rgb(200, 0, 0);"
        ></lr-dock-panel>
      </div>
    `);
    const panel = el.querySelector("lr-dock-panel") as LyraDockPanel;
    await elementUpdated(panel);
    const handle = panel.shadowRoot!.querySelector(
      '[part="handle"]'
    ) as HTMLElement;
    handle.setPointerCapture = () => {};
    const rect = handle.getBoundingClientRect();
    const position: [number, number] = [
      Math.round(rect.left + rect.width / 2),
      Math.round(rect.top + rect.height / 2),
    ];
    try {
      await sendMouse({ type: "move", position });
      const hovered = getComputedStyle(handle).backgroundColor;
      expect(hovered).to.equal("rgb(200, 0, 0)");
      await sendMouse({ type: "down" });
      const pressed = getComputedStyle(handle).backgroundColor;
      // No --lr-dock-panel-handle-active-color override here, so the pressed color must be a
      // color-mix() of the *overridden* hover color, not the original default brand token.
      expect(pressed).to.not.equal(hovered);
      expect(pressed).to.not.equal("rgb(200, 0, 0)");
      await sendMouse({ type: "up" });
    } finally {
      await resetMouse();
    }
  });
});
