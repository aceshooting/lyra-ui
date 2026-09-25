import { fixture, expect, html, oneEvent, waitUntil } from "@open-wc/testing";
import "./app-rail.js";
import {
  computeAppRailMode,
  type LyraAppRail,
  type LyraAppRailModeChangeDetail,
  type LyraAppRailToggleDetail,
} from "./app-rail.js";
import { resetMouse, sendMouse } from "../../../../test/wtr-mouse.js";
import { sendKeys } from '@web/test-runner-commands';

// Deterministic matchMedia stand-in -- avoids depending on the real test
// browser's viewport width (which @web/test-runner gives no control over)
// for every test below. Both queries start unmatched (mode resolves to
// 'full'); tests that need a specific mode either force it via the `mode`
// property or invoke the component's own private matchMedia listener
// directly with a fabricated event -- see computeAppRailMode's doc for why
// the breakpoint-response logic is a separately-testable pure function.
let originalMatchMedia: typeof window.matchMedia;

beforeEach(() => {
  originalMatchMedia = window.matchMedia;
  window.matchMedia = ((query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as MediaQueryList)) as typeof window.matchMedia;
});

it("restores breakpoint, persistence, width, and automatic mode defaults after attribute removal", async () => {
  const automatic = (await fixture(
    html`<lr-app-rail></lr-app-rail>`
  )) as LyraAppRail;
  const el = (await fixture(html`
    <lr-app-rail
      force-mode="icon-only"
      icon-only-breakpoint="1200px"
      mobile-breakpoint="800px"
      persist="width"
      min-rail-width-px="240"
      max-rail-width-px="600"
    ></lr-app-rail>
  `)) as LyraAppRail;
  for (const name of [
    'force-mode',
    "icon-only-breakpoint",
    "mobile-breakpoint",
    "persist",
    "min-rail-width-px",
    "max-rail-width-px",
  ])
    el.removeAttribute(name);
  await el.updateComplete;
  expect(el.iconOnlyBreakpoint).to.equal("960px");
  expect(el.mobileBreakpoint).to.equal("600px");
  expect(el.persist).to.equal("open width");
  expect(el.minRailWidthPx).to.equal(190);
  expect(el.maxRailWidthPx).to.equal(440);
  expect(el.forceMode).to.be.undefined;
  expect(el.mode).to.equal(automatic.mode);
});

it("honors inherited sizing and overlay hooks while direct-host values remain authoritative", async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div
      style="
      --lr-app-rail-width: 201px;
      --lr-app-rail-icon-width: 81px;
      --lr-app-rail-mobile-width: 221px;
      --lr-app-rail-overlay-color: rgb(1, 2, 3);
    "
    >
      <lr-app-rail id="full"></lr-app-rail>
      <lr-app-rail id="icon" force-mode="icon-only"></lr-app-rail>
      <lr-app-rail id="mobile" open></lr-app-rail>
      <lr-app-rail
        id="direct"
        open
        style="--lr-app-rail-mobile-width: 211px; --lr-app-rail-overlay-color: rgb(7, 8, 9);"
      ></lr-app-rail>
    </div>
  `);
  const full = wrapper.querySelector("#full") as LyraAppRail;
  const icon = wrapper.querySelector("#icon") as LyraAppRail;
  const mobile = wrapper.querySelector("#mobile") as LyraAppRail;
  const direct = wrapper.querySelector("#direct") as LyraAppRail;
  fireMobileChange(mobile, true);
  fireMobileChange(direct, true);
  await Promise.all([
    full.updateComplete,
    icon.updateComplete,
    mobile.updateComplete,
    direct.updateComplete,
  ]);

  expect(
    getComputedStyle(full.shadowRoot!.querySelector('[part="base"]')!)
      .inlineSize
  ).to.equal("201px");
  expect(
    getComputedStyle(icon.shadowRoot!.querySelector('[part="base"]')!)
      .inlineSize
  ).to.equal("81px");
  expect(
    getComputedStyle(mobile.shadowRoot!.querySelector('[part="panel"]')!)
      .inlineSize
  ).to.equal("221px");
  expect(
    getComputedStyle(mobile.shadowRoot!.querySelector('[part="backdrop"]')!)
      .backgroundColor
  ).to.equal("rgb(1, 2, 3)");
  expect(
    getComputedStyle(direct.shadowRoot!.querySelector('[part="panel"]')!)
      .inlineSize
  ).to.equal("211px");
  expect(
    getComputedStyle(direct.shadowRoot!.querySelector('[part="backdrop"]')!)
      .backgroundColor
  ).to.equal("rgb(7, 8, 9)");
});

it("inherits independent toggle and resizer hover/pressed paint from an ancestor", async function () {
  this.timeout(15_000);
  const mobileWrapper = await fixture<HTMLElement>(html`
    <div
      style="
      --lr-app-rail-toggle-hover-bg: rgb(1, 2, 3);
      --lr-app-rail-toggle-hover-color: rgb(4, 5, 6);
      --lr-app-rail-toggle-active-bg: rgb(7, 8, 9);
      --lr-app-rail-toggle-active-color: rgb(10, 11, 12);
    "
    >
      <lr-app-rail></lr-app-rail>
    </div>
  `);
  const mobile = mobileWrapper.querySelector("lr-app-rail") as LyraAppRail;
  fireMobileChange(mobile, true);
  await mobile.updateComplete;
  const toggle =
    mobile.shadowRoot!.querySelector<HTMLElement>('[part="toggle"]')!;
  toggle.scrollIntoView();
  let rect = toggle.getBoundingClientRect();
  try {
    await sendMouse({
      type: "move",
      position: [
        Math.round(rect.left + rect.width / 2),
        Math.round(rect.top + rect.height / 2),
      ],
    });
    await waitUntil(
      () =>
        getComputedStyle(toggle).backgroundColor === "rgb(1, 2, 3)" &&
        getComputedStyle(toggle).color === "rgb(4, 5, 6)",
      "toggle hover paint did not settle"
    );
    expect(getComputedStyle(toggle).backgroundColor).to.equal("rgb(1, 2, 3)");
    expect(getComputedStyle(toggle).color).to.equal("rgb(4, 5, 6)");
    await sendMouse({ type: "down" });
    await waitUntil(
      () =>
        getComputedStyle(toggle).backgroundColor === "rgb(7, 8, 9)" &&
        getComputedStyle(toggle).color === "rgb(10, 11, 12)",
      "toggle pressed paint did not settle"
    );
    expect(getComputedStyle(toggle).backgroundColor).to.equal("rgb(7, 8, 9)");
    expect(getComputedStyle(toggle).color).to.equal("rgb(10, 11, 12)");
  } finally {
    await resetMouse();
  }
  mobileWrapper.remove();

  const fullWrapper = await fixture<HTMLElement>(html`
    <div
      style="
      --lr-transition-fast: 0ms;
      --lr-app-rail-resizer-hover-bg: rgb(13, 14, 15);
      --lr-app-rail-resizer-active-bg: rgb(16, 17, 18);
    "
    >
      <lr-app-rail
        resizable
        style="inline-size: var(--lr-app-rail-width); block-size: var(--lr-size-10rem);"
      ></lr-app-rail>
    </div>
  `);
  const full = fullWrapper.querySelector("lr-app-rail") as LyraAppRail;
  full.style.setProperty("--lr-transition-fast", "0ms");
  const resizer =
    full.shadowRoot!.querySelector<HTMLElement>('[part="resizer"]')!;
  const track = full.shadowRoot!.querySelector<HTMLElement>(
    '[part="resizer-track"]'
  )!;
  resizer.scrollIntoView();
  rect = resizer.getBoundingClientRect();
  try {
    await sendMouse({
      type: "move",
      position: [
        Math.round(rect.left + 10),
        Math.round(rect.top + rect.height / 2),
      ],
    });
    await waitUntil(
      () => getComputedStyle(track).backgroundColor === "rgb(13, 14, 15)",
      "resizer hover paint did not settle"
    );
    expect(getComputedStyle(track).backgroundColor).to.equal("rgb(13, 14, 15)");
    await sendMouse({ type: "down" });
    await waitUntil(
      () => getComputedStyle(track).backgroundColor === "rgb(16, 17, 18)",
      "resizer pressed paint did not settle"
    );
    expect(getComputedStyle(track).backgroundColor).to.equal("rgb(16, 17, 18)");
  } finally {
    await resetMouse();
  }
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

type PrivateMediaListener = (e: { matches: boolean }) => void;
function fireIconOnlyChange(el: LyraAppRail, matches: boolean): void {
  (
    el as unknown as { onIconOnlyChange: PrivateMediaListener }
  ).onIconOnlyChange({ matches });
}
function fireMobileChange(el: LyraAppRail, matches: boolean): void {
  (el as unknown as { onMobileChange: PrivateMediaListener }).onMobileChange({
    matches,
  });
}

it("paints mobile panel elevation only while open in LTR and RTL", async () => {
  for (const direction of ["ltr", "rtl"] as const) {
    const el = (await fixture<LyraAppRail>(html`
      <lr-app-rail dir=${direction}></lr-app-rail>
    `)) as LyraAppRail;
    fireMobileChange(el, true);
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector<HTMLElement>('[part="panel"]')!;

    expect(getComputedStyle(panel).boxShadow, `${direction}: closed panel`)
      .to.equal("none");
    el.open = true;
    await el.updateComplete;
    expect(getComputedStyle(panel).boxShadow, `${direction}: open panel`)
      .not.to.equal("none");
    el.open = false;
    await el.updateComplete;
    expect(getComputedStyle(panel).boxShadow, `${direction}: closed again`)
      .to.equal("none");
  }
});

// Resolves what `declaration` computes to *inside this element's shadow root*, where the
// --lr-* design tokens the component's own hooks fall back to are declared -- used to assert an
// unset hook's rendered output byte-for-byte against the token it falls back to, mirroring
// lr-conversation-item's identical `resolvedInShadow` helper.
function resolvedInShadow(
  el: LyraAppRail,
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

// -- computeAppRailMode (pure) -----------------------------------------

it("computeAppRailMode resolves full when neither breakpoint matches", () => {
  expect(computeAppRailMode(false, false)).to.equal("full");
});

it("computeAppRailMode resolves icon-only when only the icon-only breakpoint matches", () => {
  expect(computeAppRailMode(true, false)).to.equal("icon-only");
});

it("computeAppRailMode resolves mobile when the mobile breakpoint matches", () => {
  expect(computeAppRailMode(false, true)).to.equal("mobile");
});

it("computeAppRailMode prefers mobile when both breakpoints match at once", () => {
  expect(computeAppRailMode(true, true)).to.equal("mobile");
});

// -- default state / reflection -----------------------------------------

it("defaults to full mode, reflected as an attribute, with the overlay closed", async () => {
  const el = (await fixture(
    html`<lr-app-rail><a href="/a">A</a></lr-app-rail>`
  )) as LyraAppRail;
  expect(el.mode).to.equal("full");
  expect(el.getAttribute("mode")).to.equal("full");
  expect(el.open).to.be.false;
  expect(
    el
      .shadowRoot!.querySelector('[part="base"], [part="panel"]')!
      .getAttribute("part")
  ).to.equal("base");
});

it("uses the label prop as the nav landmark accessible name", async () => {
  const el = (await fixture(
    html`<lr-app-rail label="Main"><a href="/a">A</a></lr-app-rail>`
  )) as LyraAppRail;
  expect(
    el
      .shadowRoot!.querySelector('[part="base"], [part="panel"]')!
      .getAttribute("aria-label")
  ).to.equal("Main");
});

it("honors every supplied label literally before consulting localization", async () => {
  const explicit = (await fixture(html`
    <lr-app-rail
      label="Navigation"
      .strings=${{ navigation: "Navigation localisée" }}
    ></lr-app-rail>
  `)) as LyraAppRail;
  expect(
    explicit
      .shadowRoot!.querySelector('[part="base"]')!
      .getAttribute("aria-label")
  ).to.equal("Navigation");

  const fallback = (await fixture(html`
    <lr-app-rail
      .strings=${{ navigation: "Navigation localisée" }}
    ></lr-app-rail>
  `)) as LyraAppRail;
  expect(
    fallback
      .shadowRoot!.querySelector('[part="base"]')!
      .getAttribute("aria-label")
  ).to.equal("Navigation localisée");

  fallback.setAttribute("aria-label", "");
  await fallback.updateComplete;
  expect(
    fallback
      .shadowRoot!.querySelector('[part="base"]')!
      .getAttribute("aria-label")
  ).to.equal("");
});

it("hides app-rail-item labels visually in icon-only mode while retaining their accessible names", async () => {
  const el = (await fixture(html`
    <lr-app-rail force-mode="icon-only">
      <lr-app-rail-item href="/inbox" aria-label="Inbox">
        <span slot="icon" aria-hidden="true">📥</span>Inbox with a long
        localized label
      </lr-app-rail-item>
    </lr-app-rail>
  `)) as LyraAppRail;
  const item = el.querySelector("lr-app-rail-item")! as HTMLElement & {
    updateComplete: Promise<unknown>;
  };
  await item.updateComplete;

  expect(item.hasAttribute("icon-only")).to.be.true;
  const label = item.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  expect(getComputedStyle(label).position).to.equal("absolute");
  expect(
    item.shadowRoot!.querySelector('[part="base"]')!.getAttribute("aria-label")
  ).to.equal("Inbox");

  el.forceMode = 'full';
  await el.updateComplete;
  await item.updateComplete;
  expect(item.hasAttribute("icon-only")).to.be.false;
  expect(getComputedStyle(label).position).to.not.equal("absolute");
});

it("suppresses a current item's indicator bar while the rail-driven icon-only attribute is set, and restores it when the rail returns to full", async () => {
  const el = (await fixture(html`
    <lr-app-rail force-mode="icon-only">
      <lr-app-rail-item href="/inbox" current aria-label="Inbox">
        <span slot="icon" aria-hidden="true">📥</span>Inbox
      </lr-app-rail-item>
    </lr-app-rail>
  `)) as LyraAppRail;
  const item = el.querySelector("lr-app-rail-item")! as HTMLElement & {
    updateComplete: Promise<unknown>;
  };
  await item.updateComplete;
  expect(item.hasAttribute("icon-only")).to.be.true;
  const indicator = item.shadowRoot!.querySelector(
    '[part="current-indicator"]'
  ) as HTMLElement;
  expect(getComputedStyle(indicator).display).to.equal("none");

  el.forceMode = "full";
  await el.updateComplete;
  await item.updateComplete;
  expect(item.hasAttribute("icon-only")).to.be.false;
  expect(getComputedStyle(indicator).display).to.not.equal("none");
});

it("releases parent-owned icon-only state when an item leaves the rail", async () => {
  const wrapper = (await fixture(html`
    <div>
      <lr-app-rail force-mode="icon-only">
        <lr-app-rail-item>Inbox</lr-app-rail-item>
      </lr-app-rail>
      <div id="outside"></div>
    </div>
  `)) as HTMLElement;
  const rail = wrapper.querySelector("lr-app-rail") as LyraAppRail;
  const item = wrapper.querySelector("lr-app-rail-item") as HTMLElement;
  expect(item.hasAttribute("icon-only")).to.be.true;

  const slot = rail.shadowRoot!.querySelector<HTMLSlotElement>('[part="nav"] > slot')!;
  const released = oneEvent(slot, 'slotchange');
  wrapper.querySelector("#outside")!.append(item);
  await released;
  await rail.updateComplete;

  expect(item.hasAttribute("icon-only")).to.be.false;
});

it('hands parent-owned icon-only state directly from one rail to another', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div>
      <lr-app-rail id="compact" force-mode="icon-only">
        <lr-app-rail-item>Inbox</lr-app-rail-item>
      </lr-app-rail>
      <lr-app-rail id="wide" force-mode="full"></lr-app-rail>
    </div>
  `);
  const compact = wrapper.querySelector<LyraAppRail>('#compact')!;
  const wide = wrapper.querySelector<LyraAppRail>('#wide')!;
  const item = compact.querySelector<HTMLElement>('lr-app-rail-item')!;
  expect(item.hasAttribute('icon-only')).to.equal(true);

  const compactSlot = compact.shadowRoot!.querySelector<HTMLSlotElement>('[part="nav"] > slot')!;
  const wideSlot = wide.shadowRoot!.querySelector<HTMLSlotElement>('[part="nav"] > slot')!;
  const released = oneEvent(compactSlot, 'slotchange');
  const assigned = oneEvent(wideSlot, 'slotchange');
  wide.append(item);
  await Promise.all([released, assigned]);
  await Promise.all([compact.updateComplete, wide.updateComplete]);

  expect(item.parentElement === wide).to.equal(true);
  expect(item.hasAttribute('icon-only')).to.equal(false);
});

it("manages destination-realm app-rail items structurally after adoption", async () => {
  const rail = (await fixture(
    html`<lr-app-rail force-mode="icon-only"></lr-app-rail>`
  )) as LyraAppRail;
  rail.remove();
  const frame = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
  const frameDocument = frame.contentDocument;
  if (!frameDocument) throw new Error("The iframe document was unavailable.");

  try {
    frameDocument.adoptNode(rail);
    frameDocument.body.append(rail);
    await rail.updateComplete;
    const slot = rail.shadowRoot!.querySelector<HTMLSlotElement>(
      '[part="nav"] > slot'
    )!;
    const item = frameDocument.createElement("lr-app-rail-item");
    item.textContent = "Destination item";
    const assigned = oneEvent(slot, "slotchange");
    rail.append(item);
    await assigned;
    await rail.updateComplete;

    expect(item.hasAttribute("icon-only")).to.be.true;

    const released = oneEvent(slot, "slotchange");
    frameDocument.body.append(item);
    await released;
    await rail.updateComplete;
    expect(item.hasAttribute("icon-only")).to.be.false;
    item.remove();
  } finally {
    rail.remove();
    frame.remove();
  }
});

// -- breakpoint-driven mode wiring ---------------------------------------

it('stays in the full fallback mode when matchMedia is unavailable', async () => {
  window.matchMedia = undefined as unknown as typeof window.matchMedia;
  const el = await fixture<LyraAppRail>(html`<lr-app-rail resizable></lr-app-rail>`);

  expect(el.mode).to.equal('full');
  expect(el.shadowRoot!.querySelector('[part="base"]')?.getAttribute('role')).to.equal('navigation');
  expect(el.shadowRoot!.querySelectorAll('[part="resizer"]').length).to.equal(1);
});

it("resolves the correct mode on the first rendered frame, before any matchMedia change event", async () => {
  // Regression guard mirroring split.test.ts's first-paint collapse-state test: `mode` is derived
  // from `matchMedia().matches` synchronously in connectedCallback -> setupMediaQueries (there is
  // no ResizeObserver on this element), so the VERY FIRST render must already land on the correct
  // mode -- not 'full' first and the real mode only after a change event/second frame. The stub's
  // add/removeEventListener are no-ops, so the only path to a non-'full' mode here is that initial
  // synchronous `.matches` read; pre-matching every `max-width` query makes both breakpoints match,
  // and computeAppRailMode(true, true) resolves to 'mobile'.
  const savedMatchMedia = window.matchMedia;
  window.matchMedia = ((query: string) =>
    ({
      matches: query.includes("max-width"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as MediaQueryList)) as typeof window.matchMedia;
  try {
    const el = (await fixture(
      html`<lr-app-rail><a href="/a">A</a></lr-app-rail>`
    )) as LyraAppRail;
    // Assert on the very first update -- no second `await el.updateComplete` and no manual
    // matchMedia change-event dispatch between fixture creation and this assertion.
    expect(el.mode).to.equal("mobile");
    expect(el.getAttribute("mode"), "first frame, not a second frame").to.equal(
      "mobile"
    );
  } finally {
    window.matchMedia = savedMatchMedia;
  }
});

it("switches to icon-only and emits lr-mode-change when the icon-only query starts matching", async () => {
  const el = (await fixture(
    html`<lr-app-rail><a href="/a">A</a></lr-app-rail>`
  )) as LyraAppRail;
  const promise = oneEvent(el, "lr-mode-change");
  fireIconOnlyChange(el, true);
  const ev = await promise;

  expect(el.mode).to.equal("icon-only");
  expect((ev.detail as LyraAppRailModeChangeDetail).mode).to.equal('icon-only');
  await el.updateComplete;
  // `mode` has no Lit-managed accessor at all (see its getter doc), so its attribute
  // reflection is entirely manual -- an explicit, change-gated `setAttribute('mode', ...)` call
  // inside `updated()`. This confirms that manual reflection actually fires for a live
  // breakpoint-driven transition, not just for an attribute a consumer set before upgrade.
  expect(el.getAttribute("mode")).to.equal("icon-only");
});

it("switches to mobile when the mobile query matches, overriding a matching icon-only query", async () => {
  const el = (await fixture(
    html`<lr-app-rail><a href="/a">A</a></lr-app-rail>`
  )) as LyraAppRail;
  fireIconOnlyChange(el, true);
  await el.updateComplete;
  fireMobileChange(el, true);
  await el.updateComplete;

  expect(el.mode).to.equal("mobile");
});

it("does not emit lr-mode-change for a redundant reassignment to the current mode", async () => {
  const el = (await fixture(
    html`<lr-app-rail><a href="/a">A</a></lr-app-rail>`
  )) as LyraAppRail;
  let count = 0;
  el.addEventListener("lr-mode-change", () => count++);

  el.forceMode = 'full';
  await el.updateComplete;

  expect(count).to.equal(0);
});

it("detaches the old MediaQueryList listener and attaches a new one when icon-only-breakpoint changes", async () => {
  const created: Array<{
    query: string;
    addCalls: number;
    removeCalls: number;
  }> = [];
  window.matchMedia = ((query: string) => {
    const entry = { query, addCalls: 0, removeCalls: 0 };
    created.push(entry);
    return {
      matches: false,
      media: query,
      addEventListener: () => entry.addCalls++,
      removeEventListener: () => entry.removeCalls++,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;

  const el = (await fixture(
    html`<lr-app-rail><a href="/a">A</a></lr-app-rail>`
  )) as LyraAppRail;
  // One MediaQueryList per breakpoint on initial connect.
  expect(created.length).to.equal(2);
  expect(created[0]!.addCalls).to.equal(1);

  el.iconOnlyBreakpoint = "1200px";
  await el.updateComplete;

  // Both old lists are torn down together (teardownMediaQueries has no
  // per-query granularity) and two fresh ones created for the new pair.
  expect(created.length).to.equal(4);
  expect(created[0]!.removeCalls).to.equal(1);
  expect(created[1]!.removeCalls).to.equal(1);
  expect(created[2]!.query).to.equal("(max-width: 1200px)");
});

it("does not arm breakpoint listeners for updates while detached and uses the latest values on reconnect", async () => {
  const created: Array<{
    query: string;
    addCalls: number;
    removeCalls: number;
  }> = [];
  window.matchMedia = ((query: string) => {
    const entry = { query, addCalls: 0, removeCalls: 0 };
    created.push(entry);
    return {
      matches: false,
      media: query,
      addEventListener: () => entry.addCalls++,
      removeEventListener: () => entry.removeCalls++,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;

  const el = (await fixture(html`<lr-app-rail></lr-app-rail>`)) as LyraAppRail;
  expect(created.length).to.equal(2);
  el.remove();
  expect(created[0]!.removeCalls).to.equal(1);
  expect(created[1]!.removeCalls).to.equal(1);

  el.iconOnlyBreakpoint = "777px";
  el.mobileBreakpoint = "333px";
  await el.updateComplete;
  expect(
    created.length,
    "a detached update must not bind ambient listeners"
  ).to.equal(2);

  document.body.append(el);
  await el.updateComplete;
  expect(created.map(({ query }) => query)).to.deep.equal([
    "(max-width: 960px)",
    "(max-width: 600px)",
    "(max-width: 777px)",
    "(max-width: 333px)",
  ]);
  expect(created[2]!.addCalls).to.equal(1);
  expect(created[3]!.addCalls).to.equal(1);
  el.remove();
});

it("ignores a queued old-owner media-query callback after adoption while current callbacks still apply", async () => {
  type MediaRecord = {
    query: string;
    listeners: Set<(event: MediaQueryListEvent) => void>;
  };
  const install = (
    owner: Window
  ): { records: MediaRecord[]; restore(): void } => {
    const original = owner.matchMedia;
    const records: MediaRecord[] = [];
    owner.matchMedia = ((query: string) => {
      const record: MediaRecord = { query, listeners: new Set() };
      records.push(record);
      return {
        matches: false,
        media: query,
        addEventListener: (
          _type: string,
          listener: (event: MediaQueryListEvent) => void
        ) => record.listeners.add(listener),
        removeEventListener: (
          _type: string,
          listener: (event: MediaQueryListEvent) => void
        ) => record.listeners.delete(listener),
      } as unknown as MediaQueryList;
    }) as typeof owner.matchMedia;
    return {
      records,
      restore(): void {
        owner.matchMedia = original;
      },
    };
  };

  const ambient = install(window);
  const frame = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
  const frameDocument = frame.contentDocument;
  const frameWindow = frame.contentWindow;
  if (!frameDocument || !frameWindow)
    throw new Error("The iframe realm was unavailable.");
  const destination = install(frameWindow);
  let el: LyraAppRail | undefined;

  try {
    el = (await fixture(html`<lr-app-rail></lr-app-rail>`)) as LyraAppRail;
    const stale = [...ambient.records[0]!.listeners][0]!;
    frameDocument.adoptNode(el);
    frameDocument.body.append(el);
    await el.updateComplete;
    expect(ambient.records[0]!.listeners.size).to.equal(0);
    expect(destination.records.length).to.equal(2);

    stale({
      matches: true,
      media: ambient.records[0]!.query,
    } as MediaQueryListEvent);
    await el.updateComplete;
    expect(
      el.mode,
      "a queued callback from the old owner must be inert"
    ).to.equal("full");

    const current = [...destination.records[0]!.listeners][0]!;
    current({
      matches: true,
      media: destination.records[0]!.query,
    } as MediaQueryListEvent);
    await el.updateComplete;
    expect(el.mode).to.equal("icon-only");

    const currentMobile = [...destination.records[1]!.listeners][0]!;
    currentMobile({
      matches: true,
      media: destination.records[1]!.query,
    } as MediaQueryListEvent);
    await el.updateComplete;
    expect(el.mode).to.equal("mobile");
  } finally {
    el?.remove();
    destination.restore();
    ambient.restore();
    frame.remove();
  }
});

// -- forcing / auto sentinel ----------------------------------------------

it("forcing mode stops it from responding to further matchMedia changes", async () => {
  const el = (await fixture(
    html`<lr-app-rail><a href="/a">A</a></lr-app-rail>`
  )) as LyraAppRail;
  el.forceMode = 'full';
  await el.updateComplete;

  fireMobileChange(el, true);
  await el.updateComplete;

  expect(el.mode).to.equal("full");
});

it('assigning "auto" releases a forced mode and re-syncs to the live breakpoint state', async () => {
  const el = (await fixture(
    html`<lr-app-rail><a href="/a">A</a></lr-app-rail>`
  )) as LyraAppRail;
  fireMobileChange(el, true);
  await el.updateComplete;
  expect(el.mode).to.equal("mobile");

  el.forceMode = 'full'; // force full despite the live mobile match
  await el.updateComplete;
  expect(el.mode).to.equal("full");

  el.forceMode = 'auto';
  await el.updateComplete;
  expect(el.mode).to.equal("mobile"); // resumes tracking, immediately re-reads the still-matching query
});

it('makes "currently auto-tracking" observable via forceMode, distinct from a pinned value', async () => {
  const el = (await fixture(
    html`<lr-app-rail></lr-app-rail>`
  )) as LyraAppRail;
  // Unset (never assigned) is auto-tracking.
  expect(el.forceMode).to.be.undefined;

  el.forceMode = 'icon-only';
  expect(el.forceMode).to.equal('icon-only');

  // Explicitly releasing the pin reads back as the literal "auto" sentinel, not just undefined --
  // this is the specific observable this accessor split was built for.
  el.forceMode = 'auto';
  expect(el.forceMode).to.equal('auto');
});

it('ignores an invalid forceMode assignment', async () => {
  const el = (await fixture(
    html`<lr-app-rail><a href="/a">A</a></lr-app-rail>`
  )) as LyraAppRail;
  (el as unknown as { forceMode: string }).forceMode = 'bogus';
  await el.updateComplete;
  expect(el.mode).to.equal("full");
  // The invalid assignment must not corrupt forceMode's own readback either -- it stays
  // undefined (still auto-tracking), not the literal rejected string. Assigning a valid pin
  // afterward must still work normally, proving the rejected write left no residue behind.
  expect(el.forceMode).to.be.undefined;
  el.forceMode = 'icon-only';
  await el.updateComplete;
  expect(el.forceMode).to.equal('icon-only');
  expect(el.mode).to.equal('icon-only');
});

it('leaves a previously-pinned forceMode value unchanged after a later invalid assignment', async () => {
  const el = (await fixture(
    html`<lr-app-rail><a href="/a">A</a></lr-app-rail>`
  )) as LyraAppRail;
  el.forceMode = 'icon-only';
  await el.updateComplete;
  expect(el.forceMode).to.equal('icon-only');

  (el as unknown as { forceMode: string }).forceMode = 'bogus';
  await el.updateComplete;

  expect(el.forceMode, 'an invalid write must not overwrite the prior pinned value').to.equal(
    'icon-only'
  );
  expect(el.mode).to.equal('icon-only');
});

it('does not rewrite the reflected mode attribute on an update where mode did not change', async () => {
  const el = (await fixture(
    html`<lr-app-rail><a href="/a">A</a></lr-app-rail>`
  )) as LyraAppRail;
  await el.updateComplete;
  expect(el.getAttribute('mode')).to.equal('full');

  const mutations: MutationRecord[] = [];
  const observer = new MutationObserver((records) => mutations.push(...records));
  observer.observe(el, { attributes: true, attributeFilter: ['mode'] });
  try {
    // Two updates that never touch `mode` -- a same-value `mode` attribute rewrite here would
    // also fire once per pointermove tick during an active resize drag, which the component
    // does not need to do.
    el.hideToggle = true;
    await el.updateComplete;
    el.hideToggle = false;
    await el.updateComplete;
  } finally {
    observer.disconnect();
  }

  expect(
    mutations.length,
    'mode must not be rewritten when its resolved value did not change'
  ).to.equal(0);
});

it("force-closes an open overlay and emits lr-toggle when mode leaves mobile, ignoring preventDefault", async () => {
  const el = (await fixture(
    html`<lr-app-rail><a href="/a">A</a></lr-app-rail>`
  )) as LyraAppRail;
  fireMobileChange(el, true);
  await el.updateComplete;
  el.open = true;
  await el.updateComplete;
  // Unlike a user-initiated close, leaving 'mobile' while open is a forced consistency fix-up
  // (documented: "closes the overlay as a side effect... rather than leaving a now-invisible
  // overlay primed to reappear") -- it must not be vetoable, or `open` could get stuck `true`
  // while `mode` is no longer `'mobile'`, where `open` is documented as meaningless.
  el.addEventListener("lr-toggle", (e) => e.preventDefault());

  const promise = oneEvent(el, "lr-toggle");
  el.forceMode = 'full';
  const ev = await promise;

  expect(el.open).to.be.false;
  expect((ev.detail as LyraAppRailToggleDetail).open).to.be.false;
  expect(ev.cancelable, "a forced mode-change close cannot be vetoed").to.be
    .false;
});

it("preserves a focused nav item when a responsive mode exit closes the mobile overlay", async () => {
  const el = (await fixture(
    html`<lr-app-rail><button>Inbox</button></lr-app-rail>`
  )) as LyraAppRail;
  const navItem = el.querySelector("button") as HTMLButtonElement;

  fireMobileChange(el, true);
  await el.updateComplete;
  const toggle = el.shadowRoot!.querySelector(
    '[part="toggle"]'
  ) as HTMLButtonElement;
  toggle.click();
  await el.updateComplete;
  expect(
    document.activeElement === navItem,
    "the open overlay focuses its surviving nav item"
  ).to.equal(true);

  fireMobileChange(el, false);
  await el.updateComplete;

  expect(el.mode).to.equal("full");
  expect(el.open).to.be.false;
  expect(getComputedStyle(toggle).display).to.equal("none");
  expect(
    document.activeElement === navItem,
    "focus must not return to the now-hidden mobile toggle"
  ).to.equal(true);
});

it("keeps the promoted navigation root focused when no nav item can receive focus after a responsive close", async () => {
  const el = (await fixture(
    html`<lr-app-rail><p>Navigation only</p></lr-app-rail>`
  )) as LyraAppRail;

  fireMobileChange(el, true);
  await el.updateComplete;
  const toggle = el.shadowRoot!.querySelector(
    '[part="toggle"]'
  ) as HTMLButtonElement;
  toggle.click();
  await el.updateComplete;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(el.shadowRoot!.activeElement?.id).to.equal(panel.id);

  fireMobileChange(el, false);
  await el.updateComplete;

  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(el.shadowRoot!.activeElement?.id).to.equal(base.id);
});

// -- mobile overlay: toggle button ----------------------------------------

it("the toggle button opens and closes the overlay, updating aria-expanded/aria-label", async () => {
  const el = (await fixture(
    html`<lr-app-rail><a href="/a">A</a></lr-app-rail>`
  )) as LyraAppRail;
  fireMobileChange(el, true);
  await el.updateComplete;
  const toggle = el.shadowRoot!.querySelector(
    '[part="toggle"]'
  ) as HTMLButtonElement;
  expect(toggle.getAttribute("aria-expanded")).to.equal("false");
  expect(toggle.getAttribute("aria-label")).to.equal("Open navigation");

  toggle.click();
  await el.updateComplete;
  expect(el.open).to.be.true;
  expect(toggle.getAttribute("aria-expanded")).to.equal("true");
  expect(toggle.getAttribute("aria-label")).to.equal("Close navigation");

  toggle.click();
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it("keeps the close toggle above the open mobile panel", async () => {
  // Renders both parts and reads their real, resolved z-index rather than regexing the
  // stylesheet's source text -- a regression that broke the actual stacking (e.g. the panel
  // ending up above the toggle) would go undetected by a source-text-only check.
  const el = (await fixture(
    html`<lr-app-rail open><a href="/a">A</a></lr-app-rail>`
  )) as LyraAppRail;
  fireMobileChange(el, true);
  await el.updateComplete;
  await el.updateComplete;
  const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  const toggleZ = Number(getComputedStyle(toggle).zIndex);
  const panelZ = Number(getComputedStyle(panel).zIndex);
  expect(Number.isNaN(toggleZ), "toggle must resolve to a real numeric z-index")
    .to.be.false;
  expect(Number.isNaN(panelZ), "panel must resolve to a real numeric z-index")
    .to.be.false;
  expect(toggleZ).to.be.greaterThan(panelZ);
});

it("reparents the toggle inside [part=panel] while open, and back to a sibling once closed", async () => {
  const el = (await fixture(
    html`<lr-app-rail><button>a</button></lr-app-rail>`
  )) as LyraAppRail;
  fireMobileChange(el, true);
  await el.updateComplete;
  const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
  const panel = el.shadowRoot!.querySelector(
    '[part="base"], [part="panel"]'
  ) as HTMLElement;
  expect(
    toggle.parentElement === panel,
    "closed: the toggle stays a sibling ahead of the panel, not its child"
  ).to.equal(false);

  el.open = true;
  await el.updateComplete;
  expect(
    toggle.parentElement === panel,
    "open: the toggle becomes the panel's own first child"
  ).to.equal(true);
  expect(
    panel.firstElementChild === toggle,
    "the toggle is the FIRST child, ahead of header/nav/footer"
  ).to.equal(true);

  el.open = false;
  await el.updateComplete;
  expect(
    toggle.parentElement === panel,
    "closed again: the toggle moves back out of the panel"
  ).to.equal(false);
});

it("reparents the same toggle node into an already-open panel on first mount", async () => {
  // A real matchMedia mobile match (rather than fireMobileChange's post-mount fabricated
  // callback) so the very first render already settles into mobile+open together -- exercising
  // placeToggle()'s updated() catch-up call, since its own willUpdate() call runs before this
  // component's very first render, when its @query refs aren't resolvable yet.
  window.matchMedia = ((query: string) =>
    ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as MediaQueryList)) as typeof window.matchMedia;
  const el = (await fixture(
    html`<lr-app-rail open><button>a</button></lr-app-rail>`
  )) as LyraAppRail;
  await el.updateComplete;
  expect(el.mode).to.equal("mobile");
  const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(toggle.parentElement === panel).to.equal(true);
});

it("reserves its own row ahead of the header slot instead of overlapping it", async () => {
  const el = (await fixture(html`
    <lr-app-rail open>
      <span slot="header" style="display:block;">Brand</span>
      <button>a</button>
    </lr-app-rail>
  `)) as LyraAppRail;
  fireMobileChange(el, true);
  await el.updateComplete;
  await el.updateComplete;
  const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
  const toggleRect = toggle.getBoundingClientRect();
  const headerRect = header.getBoundingClientRect();
  expect(
    toggleRect.bottom <= headerRect.top + 0.5,
    "the toggle occupies its own row above the header row, not an overlay on top of it"
  ).to.equal(true);
});

it("toggling emits lr-toggle with the new open state", async () => {
  const el = (await fixture(
    html`<lr-app-rail><a href="/a">A</a></lr-app-rail>`
  )) as LyraAppRail;
  fireMobileChange(el, true);
  await el.updateComplete;
  const toggle = el.shadowRoot!.querySelector(
    '[part="toggle"]'
  ) as HTMLButtonElement;

  const promise = oneEvent(el, "lr-toggle");
  toggle.click();
  const ev = await promise;

  expect((ev.detail as LyraAppRailToggleDetail).open).to.be.true;
});

it("fires lr-toggle as cancelable and keeps the overlay open when a host calls preventDefault()", async () => {
  const el = (await fixture(
    html`<lr-app-rail><a href="/a">A</a></lr-app-rail>`
  )) as LyraAppRail;
  fireMobileChange(el, true);
  await el.updateComplete;
  const toggle = el.shadowRoot!.querySelector(
    '[part="toggle"]'
  ) as HTMLButtonElement;
  el.addEventListener("lr-toggle", (e) => e.preventDefault());

  const listener = oneEvent(el, "lr-toggle");
  toggle.click();
  const ev = await listener;

  expect(ev.cancelable).to.be.true;
  expect(el.open).to.be.false;
});

it("keeps a re-entrant mode change from a cancelable lr-toggle listener closed", async () => {
  const el = (await fixture(
    html`<lr-app-rail><a href="/a">A</a></lr-app-rail>`
  )) as LyraAppRail;
  fireMobileChange(el, true);
  await el.updateComplete;
  const toggle = el.shadowRoot!.querySelector(
    '[part="toggle"]'
  ) as HTMLButtonElement;
  el.addEventListener("lr-toggle", () => {
    el.forceMode = 'full';
  });

  toggle.click();
  await el.updateComplete;

  expect(el.mode).to.equal("full");
  expect(el.open).to.be.false;
});

it("setting open directly does not emit lr-toggle (mirrors lr-dialog open/close split)", async () => {
  const el = (await fixture(
    html`<lr-app-rail><a href="/a">A</a></lr-app-rail>`
  )) as LyraAppRail;
  fireMobileChange(el, true);
  await el.updateComplete;
  let fired = false;
  el.addEventListener("lr-toggle", () => (fired = true));

  el.open = true;
  await el.updateComplete;

  expect(fired).to.be.false;
});

// -- RTL mobile panel offset ------------------------------------------------

it('flips the mobile panel\'s offscreen transform under dir="rtl", mirroring the LTR closed-state transform', async () => {
  // Reaching mobile mode now goes through fireMobileChange() (a post-connect breakpoint-match
  // mutation, since `mode` can no longer be forced via markup -- see forceMode's own doc) rather
  // than an initial `mode="mobile"` attribute, so the panel's part flips from "base" to "panel"
  // -- and its offscreen `transform` rule starts applying -- as a live style change on an
  // already-connected element. That makes the adjacent `transition: transform` rule engage,
  // same hazard the dir="rtl" rationale below already describes; zeroing the token keeps the
  // computed transform read below settled instead of mid-transition.
  const ltrEl = (await fixture(
    html`<lr-app-rail style="--lr-transition-base: 0ms;"><button>a</button></lr-app-rail>`
  )) as LyraAppRail;
  fireMobileChange(ltrEl, true);
  await ltrEl.updateComplete;
  await ltrEl.updateComplete;
  const ltrPanel = ltrEl.shadowRoot!.querySelector(
    '[part="panel"]'
  ) as HTMLElement;
  const ltrTransform = getComputedStyle(ltrPanel).transform;

  // dir="rtl" is set on the fixture markup itself (not mutated after
  // connection) so the RTL computed style is this element's very first
  // style resolution -- mutating it post-connect would instead trigger the
  // real transition on `transform` declared alongside these rules, making
  // an immediate getComputedStyle() read a mid-transition value rather than
  // the final one.
  const rtlEl = (await fixture(
    html`<lr-app-rail dir="rtl" style="--lr-transition-base: 0ms;"><button>a</button></lr-app-rail>`
  )) as LyraAppRail;
  fireMobileChange(rtlEl, true);
  await rtlEl.updateComplete;
  await rtlEl.updateComplete;
  const rtlPanel = rtlEl.shadowRoot!.querySelector(
    '[part="panel"]'
  ) as HTMLElement;
  const rtlTransform = getComputedStyle(rtlPanel).transform;

  expect(rtlPanel.matches(":dir(rtl)")).to.be.true;
  expect(rtlTransform).to.not.equal(ltrTransform);

  // Both resolve to a 2D matrix() whose tx component (m41) is the only
  // difference -- LTR slides fully offscreen to the left (negative), RTL's
  // :host(:dir(rtl)) override mirrors that to the right (positive), by the
  // exact same magnitude since only the sign of the translateX flips.
  const ltrTx = new DOMMatrixReadOnly(ltrTransform).m41;
  const rtlTx = new DOMMatrixReadOnly(rtlTransform).m41;
  expect(ltrTx).to.be.lessThan(0);
  expect(rtlTx).to.be.greaterThan(0);
  expect(rtlTx).to.equal(-ltrTx);
});

// -- mobile overlay: dismissal paths ---------------------------------------

it("closes on backdrop click", async () => {
  const el = (await fixture(
    html`<lr-app-rail open><a href="/a">A</a></lr-app-rail>`
  )) as LyraAppRail;
  fireMobileChange(el, true);
  await el.updateComplete;
  await el.updateComplete;
  (el.shadowRoot!.querySelector('[part="backdrop"]') as HTMLElement).click();
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it("closes on Escape while open, ignores Escape while closed", async () => {
  const el = (await fixture(
    html`<lr-app-rail open><a href="/a">A</a></lr-app-rail>`
  )) as LyraAppRail;
  fireMobileChange(el, true);
  await el.updateComplete;
  await el.updateComplete;
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  await el.updateComplete;
  expect(el.open).to.be.false;

  let fired = false;
  el.addEventListener("lr-toggle", () => (fired = true));
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  await el.updateComplete;
  expect(fired).to.be.false;
});

it("closes when a nav item is clicked while open, but not while closed", async () => {
  const el = (await fixture(
    html`<lr-app-rail><button>Item</button></lr-app-rail>`
  )) as LyraAppRail;
  fireMobileChange(el, true);
  await el.updateComplete;
  const item = el.querySelector("button") as HTMLButtonElement;

  item.click();
  await el.updateComplete;
  expect(el.open).to.be.false; // no-op while already closed

  el.open = true;
  await el.updateComplete;
  item.click();
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it("does not close on a click inside the header or footer slot while open", async () => {
  const el = (await fixture(
    html`<lr-app-rail open>
      <span slot="header"><button>header-btn</button></span>
      <button>nav-btn</button>
      <span slot="footer"><button>footer-btn</button></span>
    </lr-app-rail>`
  )) as LyraAppRail;
  fireMobileChange(el, true);
  await el.updateComplete;
  await el.updateComplete;
  (el.querySelector('[slot="header"] button') as HTMLButtonElement).click();
  await el.updateComplete;
  expect(el.open).to.be.true;
});

// -- focus trap -------------------------------------------------------------

it("moves focus to the first focusable nav item when the overlay opens", async () => {
  const el = (await fixture(
    html`<lr-app-rail
      ><button>first</button><button>second</button></lr-app-rail
    >`
  )) as LyraAppRail;
  fireMobileChange(el, true);
  await el.updateComplete;
  const first = el.querySelector("button") as HTMLButtonElement;

  el.open = true;
  await el.updateComplete;

  expect(document.activeElement === first).to.equal(true);
});

it("focuses the panel itself as a fallback when there is nothing focusable", async () => {
  const el = (await fixture(
    html`<lr-app-rail><p>no controls</p></lr-app-rail>`
  )) as LyraAppRail;
  fireMobileChange(el, true);
  await el.updateComplete;
  el.open = true;
  await el.updateComplete;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  const active = el.shadowRoot!.activeElement as HTMLElement | null;
  // Compared by id, not `.to.equal(panel)` -- a live-DOM-node equality failure would carry two
  // Elements into @web/test-runner-mocha's session-finished message, which structuredClone can't
  // serialize, silently hanging the whole file until the per-file watchdog kills it.
  expect(active !== null, "the panel must be the focused element").to.equal(
    true
  );
  expect(active!.id).to.equal(panel.id);
  expect(active!.getAttribute("part")).to.equal("panel");
});

it("traps Tab focus across the toggle, header, nav, and footer, wrapping last->first and first->last", async () => {
  // The toggle is reparented inside [part="panel"] as its first child while open (see
  // placeToggle()), so it is now the true first stop in the shared focus trap's Tab cycle --
  // ahead of the header slot -- and Tab from the last stop must cycle to IT, not to header-btn.
  const el = (await fixture(
    html`<lr-app-rail open>
      <span slot="header"><button>header-btn</button></span>
      <button>nav-btn</button>
      <span slot="footer"><button>footer-btn</button></span>
    </lr-app-rail>`
  )) as LyraAppRail;
  fireMobileChange(el, true);
  await el.updateComplete;
  await el.updateComplete;
  const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;
  const last = el.querySelector('[slot="footer"] button') as HTMLButtonElement;

  last.focus();
  const tabForward = new KeyboardEvent("keydown", {
    key: "Tab",
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(tabForward);
  expect(tabForward.defaultPrevented).to.be.true;
  expect(
    el.shadowRoot!.activeElement === toggle,
    "Tab from the last stop cycles to the in-panel close control, not header-btn"
  ).to.equal(true);

  const tabBackward = new KeyboardEvent("keydown", {
    key: "Tab",
    shiftKey: true,
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(tabBackward);
  expect(tabBackward.defaultPrevented).to.be.true;
  expect(document.activeElement === last).to.equal(true);
});

it("returns focus to the toggle button after closing", async () => {
  const el = (await fixture(
    html`<lr-app-rail><button>a</button></lr-app-rail>`
  )) as LyraAppRail;
  fireMobileChange(el, true);
  await el.updateComplete;
  const toggle = el.shadowRoot!.querySelector(
    '[part="toggle"]'
  ) as HTMLButtonElement;

  toggle.click();
  await el.updateComplete;
  toggle.click();
  await el.updateComplete;

  // The toggle button lives in this element's own shadow root (unlike the
  // slotted light-DOM nav items focused elsewhere in this file) -- focusing
  // it makes `document.activeElement` resolve to the *host*, not the button
  // itself, so the check has to look inside the shadow root directly.
  expect(el.shadowRoot!.activeElement === toggle).to.equal(true);
});

it("returns focus to whatever triggered it (via Escape) even when opened by setting `open` directly rather than clicking the built-in toggle", async () => {
  const el = (await fixture(
    html`<lr-app-rail><button>a</button></lr-app-rail>`
  )) as LyraAppRail;
  fireMobileChange(el, true);
  await el.updateComplete;
  const outsideTrigger = document.createElement("button");
  document.body.appendChild(outsideTrigger);
  outsideTrigger.focus();

  el.open = true;
  await el.updateComplete;
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  await el.updateComplete;

  expect(el.open).to.be.false;
  expect(document.activeElement === outsideTrigger).to.equal(true);
  outsideTrigger.remove();
});

// -- external trigger association (`trigger`/`for`) -------------------------

it("returns focus to a direct `trigger` reference on close, opened without any click", async () => {
  const el = (await fixture(
    html`<lr-app-rail hide-toggle><button>a</button></lr-app-rail>`
  )) as LyraAppRail;
  fireMobileChange(el, true);
  await el.updateComplete;
  const external = document.createElement("button");
  document.body.appendChild(external);
  el.trigger = external;

  el.open = true;
  await el.updateComplete;
  el.open = false;
  await el.updateComplete;

  expect(document.activeElement === external).to.equal(true);
  external.remove();
});

it("resolves an external trigger by id via `for`, the label/htmlFor-style alternative to `trigger`", async () => {
  const external = document.createElement("button");
  external.id = "open-rail";
  document.body.appendChild(external);
  const el = (await fixture(
    html`<lr-app-rail hide-toggle for="open-rail"><button>a</button></lr-app-rail>`
  )) as LyraAppRail;
  fireMobileChange(el, true);
  await el.updateComplete;

  el.open = true;
  await el.updateComplete;
  el.open = false;
  await el.updateComplete;

  expect(document.activeElement === external).to.equal(true);
  external.remove();
});

it("prefers a direct `trigger` over `for` when both resolve to different elements", async () => {
  const forTarget = document.createElement("button");
  forTarget.id = "open-rail-2";
  document.body.appendChild(forTarget);
  const direct = document.createElement("button");
  document.body.appendChild(direct);
  const el = (await fixture(
    html`<lr-app-rail hide-toggle for="open-rail-2"><button>a</button></lr-app-rail>`
  )) as LyraAppRail;
  fireMobileChange(el, true);
  await el.updateComplete;
  el.trigger = direct;

  el.open = true;
  await el.updateComplete;
  el.open = false;
  await el.updateComplete;

  expect(document.activeElement === direct).to.equal(true);
  forTarget.remove();
  direct.remove();
});

it("prefers the built-in toggle's own click over a configured `trigger` when it was the click that opened it", async () => {
  const el = (await fixture(
    html`<lr-app-rail><button>a</button></lr-app-rail>`
  )) as LyraAppRail;
  fireMobileChange(el, true);
  await el.updateComplete;
  const external = document.createElement("button");
  document.body.appendChild(external);
  el.trigger = external;
  const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;

  toggle.click();
  await el.updateComplete;
  toggle.click();
  await el.updateComplete;

  expect(el.shadowRoot!.activeElement === toggle).to.equal(true);
  external.remove();
});

// -- scroll lock --------------------------------------------------------

it("locks document scroll while the overlay is open and releases it on close", async () => {
  const el = (await fixture(
    html`<lr-app-rail><button>a</button></lr-app-rail>`
  )) as LyraAppRail;
  fireMobileChange(el, true);
  await el.updateComplete;
  el.open = true;
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal("hidden");

  el.open = false;
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal("");
});

it("releases the scroll lock on disconnect while the overlay is open", async () => {
  const el = (await fixture(
    html`<lr-app-rail open><button>a</button></lr-app-rail>`
  )) as LyraAppRail;
  fireMobileChange(el, true);
  await el.updateComplete;
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal("hidden");

  el.remove();

  expect(document.documentElement.style.overflow).to.equal("");
});

it("restores the scroll lock and keydown trap when reparented while the overlay is still open", async () => {
  // A real matchMedia mobile match (rather than fireMobileChange's fabricated callback) so the
  // mobile breakpoint keeps matching when the reparent below makes connectedCallback's
  // setupMediaQueries() re-derive mobileMatches from a freshly created MediaQueryList --
  // fireMobileChange's own {matches: true} would not survive that re-derivation, since it never
  // touched the (stubbed) matchMedia return value itself.
  window.matchMedia = ((query: string) =>
    ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as MediaQueryList)) as typeof window.matchMedia;
  const el = (await fixture(
    html`<lr-app-rail open><button>a</button></lr-app-rail>`
  )) as LyraAppRail;
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal("hidden");

  const otherContainer = document.createElement("div");
  document.body.appendChild(otherContainer);
  otherContainer.appendChild(el); // reparenting an already-connected node fires disconnectedCallback then connectedCallback synchronously
  expect(el.open).to.be.true;
  expect(document.documentElement.style.overflow).to.equal("hidden");

  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  await el.updateComplete;
  expect(el.open).to.be.false;
  expect(document.documentElement.style.overflow).to.equal("");

  otherContainer.remove();
});

// -- part swap / inert / aria semantics ------------------------------------

it('uses part="base" while inline and part="panel" while mobile -- never both', async () => {
  const el = (await fixture(
    html`<lr-app-rail><button>a</button></lr-app-rail>`
  )) as LyraAppRail;
  expect(
    el
      .shadowRoot!.querySelector('[part="base"], [part="panel"]')!
      .getAttribute("part")
  ).to.equal("base");

  fireMobileChange(el, true);
  await el.updateComplete;
  expect(
    el
      .shadowRoot!.querySelector('[part="base"], [part="panel"]')!
      .getAttribute("part")
  ).to.equal("panel");
});

it("marks the panel inert while mobile and closed, interactive once open", async () => {
  const el = (await fixture(
    html`<lr-app-rail><button>a</button></lr-app-rail>`
  )) as LyraAppRail;
  fireMobileChange(el, true);
  await el.updateComplete;
  const nav = el.shadowRoot!.querySelector(
    '[part="base"], [part="panel"]'
  ) as HTMLElement;
  expect(nav.inert).to.be.true;

  el.open = true;
  await el.updateComplete;
  expect(nav.inert).to.be.false;
});

it("is never inert outside mobile mode", async () => {
  const el = (await fixture(
    html`<lr-app-rail><button>a</button></lr-app-rail>`
  )) as LyraAppRail;
  expect(
    (
      el.shadowRoot!.querySelector(
        '[part="base"], [part="panel"]'
      ) as HTMLElement
    ).inert
  ).to.be.false;
});

it("only sets dialog role/aria-modal while the mobile overlay is actually open", async () => {
  const el = (await fixture(
    html`<lr-app-rail><button>a</button></lr-app-rail>`
  )) as LyraAppRail;
  fireMobileChange(el, true);
  await el.updateComplete;
  const nav = el.shadowRoot!.querySelector(
    '[part="base"], [part="panel"]'
  ) as HTMLElement;
  // A plain landmark role (not "dialog") while closed -- a literal <nav> tag
  // can't have its implicit role swapped for "dialog" without an
  // aria-allowed-role violation, so this is a <div role="navigation"> instead.
  expect(nav.getAttribute("role")).to.equal("navigation");
  expect(nav.hasAttribute("aria-modal")).to.be.false;

  el.open = true;
  await el.updateComplete;
  expect(nav.getAttribute("role")).to.equal("dialog");
  expect(nav.getAttribute("aria-modal")).to.equal("true");
});

// -- header/footer slot presence --------------------------------------------

it("hides the header/footer wrappers when nothing is slotted, shows them once slotted", async () => {
  const el = (await fixture(
    html`<lr-app-rail><button>a</button></lr-app-rail>`
  )) as LyraAppRail;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
  const footer = el.shadowRoot!.querySelector('[part="footer"]') as HTMLElement;
  expect(header.hasAttribute("hidden")).to.be.true;
  expect(footer.hasAttribute("hidden")).to.be.true;

  const logo = document.createElement("span");
  logo.slot = "header";
  el.appendChild(logo);
  el.shadowRoot!.querySelector('slot[name="header"]')!.dispatchEvent(
    new Event("slotchange")
  );
  await el.updateComplete;

  expect(header.hasAttribute("hidden")).to.be.false;
});

it("renders the header wrapper visible on first paint when header content is present before upgrade", async () => {
  const el = (await fixture(
    html`<lr-app-rail
      ><span slot="header">Brand</span><button>a</button></lr-app-rail
    >`
  )) as LyraAppRail;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
  expect(header.hasAttribute("hidden")).to.be.false;
});

// -- accessibility ------------------------------------------------------

it("is accessible in full mode, empty", async () => {
  const el = (await fixture(html`<lr-app-rail></lr-app-rail>`)) as LyraAppRail;
  await expect(el).to.be.accessible();
});

it("is accessible in full mode with header/nav/footer content", async () => {
  const el = (await fixture(html`
    <lr-app-rail>
      <span slot="header">Brand</span>
      <a href="/inbox" aria-label="Inbox">Inbox</a>
      <a href="/settings" aria-label="Settings">Settings</a>
      <span slot="footer">Account</span>
    </lr-app-rail>
  `)) as LyraAppRail;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it("is accessible with the mobile overlay open", async () => {
  const el = (await fixture(html`
    <lr-app-rail open>
      <span slot="header">Brand</span>
      <a href="/inbox" aria-label="Inbox">Inbox</a>
      <span slot="footer">Account</span>
    </lr-app-rail>
  `)) as LyraAppRail;
  fireMobileChange(el, true);
  await el.updateComplete;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

// -- toggle button i18n --------------------------------------------------

describe("toggle button i18n", () => {
  it('uses the openNavigation message key (not a hardcoded "Open" + " navigation" concatenation) when closed', async () => {
    const el = (await fixture(
      html`<lr-app-rail></lr-app-rail>`
    )) as LyraAppRail;
    fireMobileChange(el, true);
    await el.updateComplete;
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector('[part="toggle"]')!;
    expect(toggle.getAttribute("aria-label")).to.equal("Open navigation");
  });

  it("honors a strings override for openNavigation", async () => {
    const el = (await fixture(
      html`<lr-app-rail
        .strings=${{ openNavigation: "Ouvrir la navigation" }}
      ></lr-app-rail>`
    )) as LyraAppRail;
    fireMobileChange(el, true);
    await el.updateComplete;
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector('[part="toggle"]')!;
    expect(toggle.getAttribute("aria-label")).to.equal("Ouvrir la navigation");
  });

  it('inherits live host typography into the mobile toggle and its 1em glyph', async () => {
    const el = (await fixture(
      html`<lr-app-rail style="font: 20px/1 monospace"></lr-app-rail>`
    )) as LyraAppRail;
    fireMobileChange(el, true);
    await el.updateComplete;
    await el.updateComplete;

    const toggle = el.shadowRoot!.querySelector<HTMLElement>('[part="toggle"]')!;
    const glyph = toggle.querySelector<SVGElement>('svg')!;
    expect(getComputedStyle(toggle).fontSize).to.equal('20px');
    expect(getComputedStyle(toggle).fontFamily).to.equal(getComputedStyle(el).fontFamily);
    expect(getComputedStyle(glyph).width).to.equal('20px');
    expect(getComputedStyle(glyph).height).to.equal('20px');
  });
});

// -- preferredMode --------------------------------------------------------

describe("preferredMode", () => {
  it("computeAppRailMode: preferredMode wins over iconOnlyMatches, but mobileMatches always wins over preferredMode", () => {
    expect(computeAppRailMode(false, false, "icon-only")).to.equal("icon-only");
    expect(computeAppRailMode(true, false, "full")).to.equal("full");
    expect(computeAppRailMode(false, true, "full")).to.equal("mobile");
    expect(computeAppRailMode(false, false, null)).to.equal("full");
    expect(computeAppRailMode(true, false, undefined)).to.equal("icon-only");
  });

  it("applies preferredMode on the live element while unforced, and yields to the mobile breakpoint", async () => {
    const el = (await fixture(
      html`<lr-app-rail preferred-mode="icon-only"></lr-app-rail>`
    )) as LyraAppRail;
    await el.updateComplete;
    expect(el.mode).to.equal("icon-only");
  });

  it("does not override an explicitly forced mode", async () => {
    const el = (await fixture(
      html`<lr-app-rail preferred-mode="icon-only"></lr-app-rail>`
    )) as LyraAppRail;
    el.forceMode = 'full';
    await el.updateComplete;
    expect(el.mode).to.equal("full");
  });
});

// -- resizable --------------------------------------------------------------

describe("resizable", () => {
  it("renders no resizer when resizable is false (default)", async () => {
    const el = (await fixture(
      html`<lr-app-rail></lr-app-rail>`
    )) as LyraAppRail;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="resizer"]') == null).to.be.true;
  });

  it("renders a resizer with role=\"separator\" and correct aria bounds only in 'full' mode", async () => {
    const el = (await fixture(
      html`<lr-app-rail
        resizable
        rail-width-px="240"
        min-rail-width-px="190"
        max-rail-width-px="440"
      ></lr-app-rail>`
    )) as LyraAppRail;
    await el.updateComplete;
    const resizer = el.shadowRoot!.querySelector('[part="resizer"]')!;
    expect(resizer.getAttribute("role")).to.equal("separator");
    expect(resizer.getAttribute("aria-valuenow")).to.equal("240");
    expect(resizer.getAttribute("aria-valuemin")).to.equal("190");
    expect(resizer.getAttribute("aria-valuemax")).to.equal("440");
    expect(resizer.getAttribute("aria-label")).to.equal("Resize navigation");
  });

  it('localizes the resizer pixel value while retaining its numeric ARIA value', async () => {
    const el = (await fixture(
      html`<lr-app-rail
        lang="ar-EG"
        resizable
        rail-width-px="240"
        min-rail-width-px="190"
        max-rail-width-px="440"
        .strings=${{ resizeValuePixels: 'العرض {value} بكسل' }}
      ></lr-app-rail>`
    )) as LyraAppRail;
    await el.updateComplete;

    const resizer = el.shadowRoot!.querySelector<HTMLElement>('[part="resizer"]')!;
    expect(resizer.getAttribute('aria-valuenow')).to.equal('240');
    expect(resizer.getAttribute('aria-valuetext')).to.equal(
      `العرض ${new Intl.NumberFormat('ar-EG').format(240)} بكسل`
    );
  });

  it("gives the resizer hit target the shared minimum tappable size without inflating the visible drag line", async () => {
    const el = (await fixture(
      html`<lr-app-rail resizable></lr-app-rail>`
    )) as LyraAppRail;
    await el.updateComplete;
    const resizer = el.shadowRoot!.querySelector(
      '[part="resizer"]'
    ) as HTMLElement;
    const track = resizer.querySelector(
      '[part="resizer-track"]'
    ) as HTMLElement;
    expect(getComputedStyle(resizer).minInlineSize).to.equal("40px");
    expect(getComputedStyle(resizer).minBlockSize).to.equal("40px");
    // The visible drag line itself stays a slim 3px bar, not blown up to 40px -- the handle's own
    // box grows around it via flex centering instead.
    expect(getComputedStyle(track).inlineSize).to.equal("3px");
  });

  it("does not render a resizer in icon-only or mobile mode even when resizable", async () => {
    const el = (await fixture(
      html`<lr-app-rail resizable force-mode="icon-only"></lr-app-rail>`
    )) as LyraAppRail;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="resizer"]') == null).to.be.true;
  });

  it("emits a cancelable resize request before the existing non-cancelable committed resize event", async () => {
    const el = (await fixture(
      html`<lr-app-rail
        resizable
        rail-width-px="240"
        min-rail-width-px="190"
        max-rail-width-px="440"
      ></lr-app-rail>`
    )) as LyraAppRail;
    await el.updateComplete;
    const resizer = el.shadowRoot!.querySelector(
      '[part="resizer"]'
    ) as HTMLElement;
    let request:
      | { widthPx: number; cancelable: boolean; widthAtDispatch: number }
      | undefined;
    let committed:
      | { widthPx: number; cancelable: boolean; widthAtDispatch: number }
      | undefined;
    el.addEventListener("lr-rail-resize-request", (event) => {
      const resize = event as CustomEvent<{ widthPx: number }>;
      request = {
        widthPx: resize.detail.widthPx,
        cancelable: resize.cancelable,
        widthAtDispatch: el.railWidthPx ?? -1,
      };
    });
    el.addEventListener("lr-rail-resize", (event) => {
      const resize = event as CustomEvent<{ widthPx: number }>;
      committed = {
        widthPx: resize.detail.widthPx,
        cancelable: resize.cancelable,
        widthAtDispatch: el.railWidthPx ?? -1,
      };
    });

    resizer.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
    );
    expect(el.railWidthPx).to.equal(248);
    expect(request).to.deep.equal({
      widthPx: 248,
      cancelable: true,
      widthAtDispatch: 240,
    });
    expect(committed).to.deep.equal({
      widthPx: 248,
      cancelable: false,
      widthAtDispatch: 248,
    });

    el.railWidthPx = 438;
    resizer.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
    );
    expect(el.railWidthPx).to.equal(440); // clamped to maxRailWidthPx

    el.railWidthPx = 192;
    resizer.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })
    );
    expect(el.railWidthPx).to.equal(190); // clamped to minRailWidthPx
  });

  it("admits only a primary left-button resize and commits once on genuine pointerup", async () => {
    const el = (await fixture(
      html`<lr-app-rail
        resizable
        rail-width-px="240"
        min-rail-width-px="190"
        max-rail-width-px="440"
      ></lr-app-rail>`
    )) as LyraAppRail;
    const resizer = el.shadowRoot!.querySelector(
      '[part="resizer"]'
    ) as HTMLElement;
    resizer.setPointerCapture = () => {};
    const requests: number[] = [];
    const commits: number[] = [];
    el.addEventListener("lr-rail-resize-request", (event) =>
      requests.push(event.detail.widthPx)
    );
    el.addEventListener("lr-rail-resize", (event) =>
      commits.push(event.detail.widthPx)
    );

    resizer.dispatchEvent(
      new PointerEvent("pointerdown", {
        pointerId: 70,
        button: 2,
        buttons: 2,
        isPrimary: true,
        bubbles: true,
      })
    );
    resizer.dispatchEvent(
      new PointerEvent("pointerdown", {
        pointerId: 71,
        button: 0,
        buttons: 1,
        isPrimary: false,
        bubbles: true,
      })
    );
    expect(el.dragging).to.be.false;

    resizer.dispatchEvent(
      new PointerEvent("pointerdown", {
        pointerId: 72,
        button: 0,
        buttons: 1,
        isPrimary: true,
        clientX: 0,
        bubbles: true,
      })
    );
    window.dispatchEvent(
      new PointerEvent("pointermove", { pointerId: 72, clientX: 40 })
    );
    window.dispatchEvent(
      new PointerEvent("pointermove", { pointerId: 72, clientX: 40 })
    );
    expect(requests).to.deep.equal([280]);
    expect(commits).to.deep.equal([]);
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 72 }));
    expect(commits).to.deep.equal([280]);
    expect(el.dragging).to.be.false;

    resizer.dispatchEvent(
      new PointerEvent("pointerdown", {
        pointerId: 73,
        button: 0,
        buttons: 1,
        isPrimary: true,
        clientX: 0,
        bubbles: true,
      })
    );
    window.dispatchEvent(
      new PointerEvent("pointermove", { pointerId: 73, clientX: 20 })
    );
    window.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 73 }));
    expect(commits).to.deep.equal([280]);
  });

  it("does not consume or emit a boundary keyboard resize no-op", async () => {
    const el = (await fixture(
      html`<lr-app-rail
        resizable
        rail-width-px="440"
        min-rail-width-px="190"
        max-rail-width-px="440"
      ></lr-app-rail>`
    )) as LyraAppRail;
    const resizer = el.shadowRoot!.querySelector(
      '[part="resizer"]'
    ) as HTMLElement;
    let requests = 0;
    let commits = 0;
    el.addEventListener("lr-rail-resize-request", () => (requests += 1));
    el.addEventListener("lr-rail-resize", () => (commits += 1));
    const event = new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    });
    resizer.dispatchEvent(event);
    expect(event.defaultPrevented).to.be.false;
    expect(requests).to.equal(0);
    expect(commits).to.equal(0);
  });

  it("lets listeners veto proposed pointer and keyboard widths without committing or persisting them", async () => {
    const storageKey = "app-rail-vetoed-resize-request";
    const storageFullKey = `lr-app-rail:${storageKey}`;
    localStorage.removeItem(storageFullKey);
    const el = (await fixture(
      html`<lr-app-rail
        resizable
        rail-width-px="240"
        min-rail-width-px="190"
        max-rail-width-px="440"
        storage-key=${storageKey}
      ></lr-app-rail>`
    )) as LyraAppRail;
    const resizer = el.shadowRoot!.querySelector(
      '[part="resizer"]'
    ) as HTMLElement;
    const proposals: Array<{
      widthPx: number;
      cancelable: boolean;
      widthAtDispatch: number;
    }> = [];
    let committedEvents = 0;
    const veto = (event: Event): void => {
      const resize = event as CustomEvent<{ widthPx: number }>;
      proposals.push({
        widthPx: resize.detail.widthPx,
        cancelable: resize.cancelable,
        widthAtDispatch: el.railWidthPx ?? -1,
      });
      resize.preventDefault();
    };
    const countCommitted = (): void => {
      committedEvents += 1;
    };
    el.addEventListener("lr-rail-resize-request", veto);
    el.addEventListener("lr-rail-resize", countCommitted);
    // Synthetic PointerEvents do not establish native pointer capture in every engine.
    resizer.setPointerCapture = () => {};

    try {
      resizer.dispatchEvent(
        new PointerEvent("pointerdown", {
          pointerId: 86,
          clientX: 0,
          bubbles: true,
          isPrimary: true,
        })
      );
      window.dispatchEvent(
        new PointerEvent("pointermove", { pointerId: 86, clientX: 40 })
      );
      await el.updateComplete;
      expect(el.railWidthPx).to.equal(240);
      expect(el.dragging).to.be.true;

      const keydown = new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      });
      resizer.dispatchEvent(keydown);
      expect(keydown.defaultPrevented).to.be.true;
      expect(el.railWidthPx).to.equal(240);
      expect(committedEvents).to.equal(0);
      expect(localStorage.getItem(storageFullKey)).to.equal(null);
      expect(proposals).to.deep.equal([
        { widthPx: 280, cancelable: true, widthAtDispatch: 240 },
        { widthPx: 248, cancelable: true, widthAtDispatch: 240 },
      ]);
    } finally {
      window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 86 }));
      el.removeEventListener("lr-rail-resize-request", veto);
      el.removeEventListener("lr-rail-resize", countCommitted);
      localStorage.removeItem(storageFullKey);
    }
  });

  it("preserves a listener-owned replacement width from the post-commit resize event", async () => {
    const el = (await fixture(
      html`<lr-app-rail
        resizable
        rail-width-px="240"
        min-rail-width-px="190"
        max-rail-width-px="440"
      ></lr-app-rail>`
    )) as LyraAppRail;
    const resizer = el.shadowRoot!.querySelector(
      '[part="resizer"]'
    ) as HTMLElement;
    const replace = (): void => {
      el.railWidthPx = 320;
    };
    el.addEventListener("lr-rail-resize", replace);

    try {
      resizer.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
      );
      expect(el.railWidthPx).to.equal(320);
    } finally {
      el.removeEventListener("lr-rail-resize", replace);
    }
  });

  it("sets [part=base]'s inline-size from railWidthPx only while resizable and in 'full' mode", async () => {
    const el = (await fixture(
      html`<lr-app-rail resizable rail-width-px="300"></lr-app-rail>`
    )) as LyraAppRail;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.style.getPropertyValue("inline-size")).to.equal("300px");
    el.forceMode = 'icon-only';
    await el.updateComplete;
    expect(base.style.getPropertyValue("inline-size")).to.equal("");
  });

  it('clears a resized desktop inline size when the same surface becomes the mobile panel', async () => {
    const el = (await fixture(html`
      <lr-app-rail
        open
        resizable
        rail-width-px="420"
        style="--lr-app-rail-mobile-width: 211px"
      ></lr-app-rail>
    `)) as LyraAppRail;
    await el.updateComplete;
    expect(
      (el.shadowRoot!.querySelector('[part="base"]') as HTMLElement).style.getPropertyValue(
        'inline-size'
      )
    ).to.equal('420px');

    fireMobileChange(el, true);
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
    expect(panel.style.getPropertyValue('inline-size')).to.equal('');
    expect(getComputedStyle(panel).inlineSize).to.equal('211px');
  });

  it("reflects dragging=true only for the duration of a pointer-driven resize, and suppresses the base transition while true", async () => {
    const el = (await fixture(
      html`<lr-app-rail
        resizable
        rail-width-px="240"
        min-rail-width-px="190"
        max-rail-width-px="440"
      ></lr-app-rail>`
    )) as LyraAppRail;
    await el.updateComplete;
    const resizer = el.shadowRoot!.querySelector(
      '[part="resizer"]'
    ) as HTMLElement;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

    expect(el.dragging).to.be.false;
    expect(getComputedStyle(base).transitionProperty).to.not.equal("none");

    // Synthetic PointerEvents do not create a browser-owned active pointer, so Firefox correctly
    // throws InvalidPointerId from the native capture method. Pointer-capture behavior is covered
    // by real-pointer tests; this state/transition test stubs only that browser primitive.
    resizer.setPointerCapture = () => {};
    resizer.dispatchEvent(
      new PointerEvent("pointerdown", {
        pointerId: 1,
        clientX: 0,
        bubbles: true,
        isPrimary: true,
      })
    );
    await el.updateComplete;
    expect(el.dragging).to.be.true;
    expect(getComputedStyle(base).transitionProperty).to.equal("none");

    window.dispatchEvent(
      new PointerEvent("pointerup", { pointerId: 1, bubbles: true })
    );
    await el.updateComplete;
    expect(el.dragging).to.be.false;
    expect(getComputedStyle(base).transitionProperty).to.not.equal("none");
  });

  it("routes an adopted resizer gesture through its owner window and detaches from that window on adoption", async () => {
    const el = (await fixture(
      html`<lr-app-rail
        resizable
        rail-width-px="240"
        min-rail-width-px="190"
        max-rail-width-px="440"
      ></lr-app-rail>`
    )) as LyraAppRail;
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
      frameDocument.body.append(el);
      el.forceMode = 'full';
      await el.updateComplete;
      const resizer = el.shadowRoot!.querySelector(
        '[part="resizer"]'
      ) as HTMLElement;
      const resizerTrack = resizer.querySelector(
        '[part="resizer-track"]'
      ) as HTMLElement;
      resizer.setPointerCapture = () => {};
      resizerTrack.dispatchEvent(
        new frameWindow.PointerEvent("pointerdown", {
          pointerId: 71,
          clientX: 0,
          bubbles: true,
          isPrimary: true,
        })
      );

      window.dispatchEvent(
        new PointerEvent("pointermove", { pointerId: 71, clientX: 40 })
      );
      expect(
        el.railWidthPx,
        "the ambient window must not own the adopted drag"
      ).to.equal(240);

      frameWindow.dispatchEvent(
        new frameWindow.PointerEvent("pointermove", {
          pointerId: 71,
          clientX: 40,
        })
      );
      expect(el.railWidthPx).to.equal(280);
      expect(el.dragging).to.be.true;

      document.adoptNode(el);
      expect(el.dragging).to.be.false;
      expect([...new Set(removedPointerTypes)].sort()).to.deep.equal([
        "lostpointercapture",
        "pointercancel",
        "pointermove",
        "pointerup",
      ]);
      frameWindow.dispatchEvent(
        new frameWindow.PointerEvent("pointermove", {
          pointerId: 71,
          clientX: 80,
        })
      );
      expect(
        el.railWidthPx,
        "the old owner window listener must be removed"
      ).to.equal(280);
    } finally {
      if (el.ownerDocument !== document) document.adoptNode(el);
      frameWindow.removeEventListener = originalRemoveEventListener;
      el.remove();
      frame.remove();
    }
  });

  it("aborts an active pointer resize when resizable is revoked", async () => {
    const el = (await fixture(
      html`<lr-app-rail resizable rail-width-px="240"></lr-app-rail>`
    )) as LyraAppRail;
    const resizer = el.shadowRoot!.querySelector(
      '[part="resizer"]'
    ) as HTMLElement;
    resizer.setPointerCapture = () => {};
    let events = 0;
    el.addEventListener("lr-rail-resize", () => (events += 1));
    resizer.dispatchEvent(
      new PointerEvent("pointerdown", {
        pointerId: 41,
        clientX: 0,
        bubbles: true,
        isPrimary: true,
      })
    );

    el.resizable = false;
    window.dispatchEvent(
      new PointerEvent("pointermove", { pointerId: 41, clientX: 100 })
    );

    expect(el.railWidthPx).to.equal(240);
    expect(el.dragging).to.be.false;
    expect(events).to.equal(0);
  });

  it("aborts an active pointer resize when full mode is revoked", async () => {
    const el = (await fixture(
      html`<lr-app-rail resizable rail-width-px="240"></lr-app-rail>`
    )) as LyraAppRail;
    const resizer = el.shadowRoot!.querySelector(
      '[part="resizer"]'
    ) as HTMLElement;
    resizer.setPointerCapture = () => {};
    resizer.dispatchEvent(
      new PointerEvent("pointerdown", {
        pointerId: 42,
        clientX: 0,
        bubbles: true,
        isPrimary: true,
      })
    );

    el.forceMode = 'icon-only';
    window.dispatchEvent(
      new PointerEvent("pointermove", { pointerId: 42, clientX: 100 })
    );

    expect(el.railWidthPx).to.equal(240);
    expect(el.dragging).to.be.false;
  });

  it("does not toggle dragging for keyboard-driven resize steps", async () => {
    const el = (await fixture(
      html`<lr-app-rail
        resizable
        rail-width-px="240"
        min-rail-width-px="190"
        max-rail-width-px="440"
      ></lr-app-rail>`
    )) as LyraAppRail;
    await el.updateComplete;
    const resizer = el.shadowRoot!.querySelector(
      '[part="resizer"]'
    ) as HTMLElement;
    resizer.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
    );
    await el.updateComplete;
    expect(el.dragging).to.be.false;
  });

  it('has no public dragging setter -- assignment throws, the getter stays authoritative', async () => {
    const el = (await fixture(
      html`<lr-app-rail resizable></lr-app-rail>`
    )) as LyraAppRail;
    expect(el.dragging).to.be.false;
    expect(() => {
      (el as unknown as { dragging: boolean }).dragging = true;
    }).to.throw(TypeError);
    expect(el.dragging).to.be.false;
  });

  // -- numeric guard regressions (railWidthPx/minRailWidthPx/maxRailWidthPx) --

  it("clamps a NaN or negative railWidthPx to a sane in-bounds width instead of leaking through to layout", async () => {
    const el = (await fixture(
      html`<lr-app-rail
        resizable
        min-rail-width-px="190"
        max-rail-width-px="440"
      ></lr-app-rail>`
    )) as LyraAppRail;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const resizer = el.shadowRoot!.querySelector(
      '[part="resizer"]'
    ) as HTMLElement;

    el.railWidthPx = NaN;
    await el.updateComplete;
    expect(base.style.getPropertyValue("inline-size")).to.equal("190px");
    expect(resizer.getAttribute("aria-valuenow")).to.equal("190");

    el.railWidthPx = -999;
    await el.updateComplete;
    expect(base.style.getPropertyValue("inline-size")).to.equal("190px");
    expect(resizer.getAttribute("aria-valuenow")).to.equal("190");
  });

  it("sanitizes a NaN minRailWidthPx/maxRailWidthPx instead of letting it poison every clamp", async () => {
    const el = (await fixture(
      html`<lr-app-rail
        resizable
        rail-width-px="9999"
        min-rail-width-px="NaN"
        max-rail-width-px="NaN"
      ></lr-app-rail>`
    )) as LyraAppRail;
    await el.updateComplete;
    const resizer = el.shadowRoot!.querySelector(
      '[part="resizer"]'
    ) as HTMLElement;
    expect(resizer.getAttribute("aria-valuemin")).to.equal("190");
    expect(resizer.getAttribute("aria-valuemax")).to.equal("440");
    expect(resizer.getAttribute("aria-valuenow")).to.equal("440"); // clamped down into the sanitized bounds
  });

  it("keeps maxRailWidthPx from resolving below minRailWidthPx for an inverted pair", async () => {
    const el = (await fixture(
      html`<lr-app-rail
        resizable
        rail-width-px="240"
        min-rail-width-px="500"
        max-rail-width-px="100"
      ></lr-app-rail>`
    )) as LyraAppRail;
    await el.updateComplete;
    const resizer = el.shadowRoot!.querySelector(
      '[part="resizer"]'
    ) as HTMLElement;
    const min = Number(resizer.getAttribute("aria-valuemin"));
    const max = Number(resizer.getAttribute("aria-valuemax"));
    expect(min).to.equal(500);
    expect(max).to.be.at.least(min);
    expect(resizer.getAttribute("aria-valuenow")).to.equal("500"); // 240 clamped up into range
  });
});

describe("hideToggle", () => {
  it("hides [part=toggle] when set, in mobile mode", async () => {
    const el = (await fixture(
      html`<lr-app-rail hide-toggle></lr-app-rail>`
    )) as LyraAppRail;
    fireMobileChange(el, true);
    await el.updateComplete;
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector(
      '[part="toggle"]'
    ) as HTMLElement;
    expect(getComputedStyle(toggle).display).to.equal("none");
  });

  it("defaults to false, unchanged output", async () => {
    const el = (await fixture(
      html`<lr-app-rail></lr-app-rail>`
    )) as LyraAppRail;
    fireMobileChange(el, true);
    await el.updateComplete;
    await el.updateComplete;
    expect(el.hideToggle).to.be.false;
    const toggle = el.shadowRoot!.querySelector(
      '[part="toggle"]'
    ) as HTMLElement;
    expect(getComputedStyle(toggle).display).to.not.equal("none");
  });

  it("survives hide-toggle once reparented inside the open panel, as the only in-panel dismiss control", async () => {
    const el = (await fixture(
      html`<lr-app-rail hide-toggle><button>a</button></lr-app-rail>`
    )) as LyraAppRail;
    fireMobileChange(el, true);
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector(
      '[part="toggle"]'
    ) as HTMLButtonElement;
    expect(
      getComputedStyle(toggle).display,
      "closed: hide-toggle still hides the outside open trigger"
    ).to.equal("none");

    el.open = true;
    await el.updateComplete;
    expect(
      getComputedStyle(toggle).display,
      "open: the reparented toggle is the only in-panel close control, so it must stay visible"
    ).to.not.equal("none");

    // It remains a genuine, working close control -- not just visually present.
    toggle.click();
    await el.updateComplete;
    expect(el.open).to.be.false;
  });
});

describe("aria-label forwarding", () => {
  it("unset host aria-label reproduces today's exact localized-default/label-prop output", async () => {
    const withDefault = (await fixture(
      html`<lr-app-rail><a href="/a">A</a></lr-app-rail>`
    )) as LyraAppRail;
    expect(
      withDefault
        .shadowRoot!.querySelector('[part="base"], [part="panel"]')!
        .getAttribute("aria-label")
    ).to.equal("Navigation");

    const withLabel = (await fixture(
      html`<lr-app-rail label="Main"><a href="/a">A</a></lr-app-rail>`
    )) as LyraAppRail;
    expect(
      withLabel
        .shadowRoot!.querySelector('[part="base"], [part="panel"]')!
        .getAttribute("aria-label")
    ).to.equal("Main");
  });

  it("a host-level aria-label attribute overrides the label prop / localized default on the nav landmark", async () => {
    const el = (await fixture(
      html`<lr-app-rail label="Main" aria-label="Custom nav name"
        ><a href="/a">A</a></lr-app-rail
      >`
    )) as LyraAppRail;
    expect(
      el
        .shadowRoot!.querySelector('[part="base"], [part="panel"]')!
        .getAttribute("aria-label")
    ).to.equal("Custom nav name");
  });

  it("the host-level aria-label override also applies to the dialog role while the mobile overlay is open", async () => {
    const el = (await fixture(
      html`<lr-app-rail open aria-label="Custom nav name"
        ><a href="/a">A</a></lr-app-rail
      >`
    )) as LyraAppRail;
    fireMobileChange(el, true);
    await el.updateComplete;
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
    expect(panel.getAttribute("role")).to.equal("dialog");
    expect(panel.getAttribute("aria-label")).to.equal("Custom nav name");
  });
});

describe("storage-key persistence", () => {
  const keys: string[] = [];
  function uniqueKey(): string {
    const k = `test-${keys.length}-${window.location.pathname.length}`;
    keys.push(k);
    return k;
  }
  afterEach(() => {
    for (const k of keys) {
      try {
        localStorage.removeItem(`lr-app-rail:${k}`);
      } catch {
        /* ignore */
      }
    }
    keys.length = 0;
  });

  // A genuinely mobile-matching matchMedia, installed before the element is ever connected --
  // rather than fireMobileChange()'s post-mount fabricated callback -- so the mount's very first
  // update already settles into 'mobile', the one mode a persisted `open` is restorable onto.
  // Mirrors the "reparents the same toggle node into an already-open panel on first mount" stub;
  // the file-level afterEach puts the real matchMedia back.
  function matchMobileViewport(): void {
    window.matchMedia = ((query: string) =>
      ({
        matches: true,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      } as unknown as MediaQueryList)) as typeof window.matchMedia;
  }

  it("persists railWidthPx and restores it on a fresh mount", async () => {
    const key = uniqueKey();
    const el = (await fixture(
      html`<lr-app-rail resizable storage-key=${key}
        ><a href="/a">A</a></lr-app-rail
      >`
    )) as LyraAppRail;
    await el.updateComplete;
    el.railWidthPx = 260;
    await el.updateComplete;

    const el2 = (await fixture(
      html`<lr-app-rail resizable storage-key=${key}
        ><a href="/a">A</a></lr-app-rail
      >`
    )) as LyraAppRail;
    await el2.updateComplete;
    expect(el2.railWidthPx).to.equal(260);
  });

  it("lets an explicit railWidthPx binding win over stale persisted state on mount, with default persist", async () => {
    const key = uniqueKey();
    localStorage.setItem(
      `lr-app-rail:${key}`,
      JSON.stringify({ open: false, railWidthPx: 260 })
    );

    const el = (await fixture(
      html`<lr-app-rail resizable storage-key=${key} .railWidthPx=${240}
        ><a href="/a">A</a></lr-app-rail
      >`
    )) as LyraAppRail;
    await el.updateComplete;

    expect(el.railWidthPx).to.equal(240);
  });

  it("does not touch localStorage when storage-key is unset", async () => {
    const el = (await fixture(
      html`<lr-app-rail resizable><a href="/a">A</a></lr-app-rail>`
    )) as LyraAppRail;
    await el.updateComplete;
    const before = localStorage.length;
    el.railWidthPx = 300;
    await el.updateComplete;
    expect(localStorage.length).to.equal(before);
  });

  it("does not persist mode (breakpoint-derived), only open and railWidthPx", async () => {
    const key = uniqueKey();
    const el = (await fixture(
      html`<lr-app-rail resizable storage-key=${key}
        ><a href="/a">A</a></lr-app-rail
      >`
    )) as LyraAppRail;
    await el.updateComplete;
    el.railWidthPx = 220;
    await el.updateComplete;
    const stored = JSON.parse(
      localStorage.getItem(`lr-app-rail:${key}`)!
    ) as Record<string, unknown>;
    expect(Object.keys(stored).sort()).to.deep.equal(["open", "railWidthPx"]);
  });

  it("persists only the fields selected by persist, including preferredMode", async () => {
    const key = uniqueKey();
    const el = (await fixture(
      html`<lr-app-rail storage-key=${key} persist="width preferred-mode"
        ><a href="/a">A</a></lr-app-rail
      >`
    )) as LyraAppRail;
    await el.updateComplete;

    el.open = true;
    el.railWidthPx = 275;
    el.preferredMode = "icon-only";
    await el.updateComplete;

    const stored = JSON.parse(
      localStorage.getItem(`lr-app-rail:${key}`)!
    ) as Record<string, unknown>;
    expect(stored).to.deep.equal({
      railWidthPx: 275,
      preferredMode: "icon-only",
    });
  });

  it("does not restore controlled open state when persist excludes open", async () => {
    const key = uniqueKey();
    localStorage.setItem(
      `lr-app-rail:${key}`,
      JSON.stringify({
        open: true,
        railWidthPx: 260,
        preferredMode: "icon-only",
      })
    );

    const el = (await fixture(
      html`<lr-app-rail
        storage-key=${key}
        persist="width preferred-mode"
        .open=${false}
        ><a href="/a">A</a></lr-app-rail
      >`
    )) as LyraAppRail;
    await el.updateComplete;

    expect(el.open).to.be.false;
    expect(el.railWidthPx).to.equal(260);
    expect(el.preferredMode).to.equal("icon-only");
    expect(el.mode).to.equal("icon-only");
  });

  // Regression: willUpdate()'s persisted-mode restoration used to write `_mode` directly, bypassing
  // setEffectiveMode() entirely -- so a consumer syncing app chrome to the rail's mode never learned
  // a persisted preference had been restored on mount. `fixture()` isn't used here: it can resolve
  // after the element's own first update (and thus the event) has already fired, so the listener is
  // attached before the element is ever connected.
  it("fires exactly one lr-mode-change carrying a persisted preferred-mode restored on mount", async () => {
    const key = uniqueKey();
    localStorage.setItem(
      `lr-app-rail:${key}`,
      JSON.stringify({ preferredMode: "icon-only" })
    );

    const el = document.createElement("lr-app-rail") as LyraAppRail;
    el.setAttribute("storage-key", key);
    el.setAttribute("persist", "preferred-mode");
    el.innerHTML = '<a href="/a">A</a>';
    const events: LyraAppRailModeChangeDetail[] = [];
    el.addEventListener("lr-mode-change", (e) => {
      events.push((e as CustomEvent<LyraAppRailModeChangeDetail>).detail);
    });
    try {
      document.body.append(el);
      await el.updateComplete;
      expect(el.mode).to.equal("icon-only");
      expect(el.getAttribute("mode")).to.equal("icon-only");
      expect(events).to.deep.equal([{ mode: "icon-only" }]);
    } finally {
      el.remove();
    }
  });

  // Regression: connectedCallback() -> setupMediaQueries() -> applyComputedMode() ->
  // setEffectiveMode() used to run synchronously, before this same mount's willUpdate() had a
  // chance to restore a persisted `preferredMode` -- so a listener could observe a real
  // lr-mode-change carrying the pre-restore breakpoint mode, immediately followed by a second,
  // correct one once the restore landed. Pre-matches only the icon-only breakpoint (not the
  // mobile one), so the pre-restore mode ('icon-only', computed with no preferredMode yet loaded)
  // genuinely differs from the persisted, higher-priority preferredMode restored on mount
  // ('full'). `fixture()` isn't used here: it can resolve after the element's own first update
  // (and thus the event) has already fired, so the listener is attached before the element is
  // ever connected.
  it("emits exactly one lr-mode-change carrying the restored mode, never the pre-restore breakpoint mode", async () => {
    const key = uniqueKey();
    localStorage.setItem(
      `lr-app-rail:${key}`,
      JSON.stringify({ preferredMode: "full" })
    );
    const savedMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) =>
      ({
        matches: query.includes("960px"),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      } as unknown as MediaQueryList)) as typeof window.matchMedia;

    const el = document.createElement("lr-app-rail") as LyraAppRail;
    el.setAttribute("storage-key", key);
    el.setAttribute("persist", "preferred-mode");
    el.innerHTML = '<a href="/a">A</a>';
    const events: LyraAppRailModeChangeDetail[] = [];
    el.addEventListener("lr-mode-change", (e) => {
      events.push((e as CustomEvent<LyraAppRailModeChangeDetail>).detail);
    });
    try {
      document.body.append(el);
      await el.updateComplete;
      expect(el.mode).to.equal("full");
      expect(el.getAttribute("mode")).to.equal("full");
      expect(events).to.deep.equal([{ mode: "full" }]);
    } finally {
      el.remove();
      window.matchMedia = savedMatchMedia;
    }
  });

  it("fires no lr-mode-change on a mount with no persisted preferred mode", async () => {
    const key = uniqueKey(); // nothing ever written under this key

    const el = document.createElement("lr-app-rail") as LyraAppRail;
    el.setAttribute("storage-key", key);
    el.setAttribute("persist", "preferred-mode");
    el.innerHTML = '<a href="/a">A</a>';
    let count = 0;
    el.addEventListener("lr-mode-change", () => count++);
    try {
      document.body.append(el);
      await el.updateComplete;
      expect(el.mode).to.equal("full");
      expect(count).to.equal(0);
    } finally {
      el.remove();
    }
  });

  it("fires no lr-mode-change when the restored preferred mode equals the default mode", async () => {
    const key = uniqueKey();
    localStorage.setItem(
      `lr-app-rail:${key}`,
      JSON.stringify({ preferredMode: "full" })
    );

    const el = document.createElement("lr-app-rail") as LyraAppRail;
    el.setAttribute("storage-key", key);
    el.setAttribute("persist", "preferred-mode");
    el.innerHTML = '<a href="/a">A</a>';
    let count = 0;
    el.addEventListener("lr-mode-change", () => count++);
    try {
      document.body.append(el);
      await el.updateComplete;
      expect(el.mode).to.equal("full");
      expect(el.preferredMode).to.equal("full");
      expect(count).to.equal(0);
    } finally {
      el.remove();
    }
  });

  /**
   * Regression: the persisted `open` restore was guarded on `changed.has("open")`, which cannot
   * distinguish a consumer's binding from `open`'s own declared default -- Lit reports the default
   * in the very first batch too. The guard was therefore true on every mount, so a persisted
   * `open` was never restored at all, silently, for every consumer of the default `persist`
   * allowlist.
   */
  it("restores a persisted open state on a mobile mount that never binds open", async () => {
    const key = uniqueKey();
    localStorage.setItem(
      `lr-app-rail:${key}`,
      JSON.stringify({ open: true, railWidthPx: 260 })
    );
    matchMobileViewport();

    const el = (await fixture(
      html`<lr-app-rail resizable storage-key=${key}
        ><a href="/a">A</a></lr-app-rail
      >`
    )) as LyraAppRail;
    await el.updateComplete;

    // `open` is only meaningful here, so this is the mount the restore is for.
    expect(el.mode).to.equal("mobile");
    expect(el.open).to.be.true;
    // The restored value reflects, exactly as a directly assigned one does -- `[open]` is what
    // the mobile panel/toggle rules key off.
    expect(el.hasAttribute("open")).to.be.true;
    expect(el.railWidthPx).to.equal(260);
  });

  /**
   * Regression for the consequence of making the restore above actually run: it writes `open`
   * directly, bypassing `setOpen()`/`setEffectiveMode()`, and `setEffectiveMode()` -- the one
   * place that force-closes a non-mobile `open` -- has already run (silently, from
   * connectedCallback) by then and early-returns for an unchanged mode, so it never re-fires to
   * clean up after the restore. A stored `open: true` reopened at a desktop width would
   * otherwise sit `true` under `mode === 'full'`, the exact state `open`'s own doc says cannot
   * exist.
   */
  it("drops a persisted open state restored at a non-mobile breakpoint", async () => {
    const key = uniqueKey();
    localStorage.setItem(
      `lr-app-rail:${key}`,
      JSON.stringify({ open: true, railWidthPx: 260 })
    );

    const el = document.createElement("lr-app-rail") as LyraAppRail;
    el.setAttribute("storage-key", key);
    el.toggleAttribute("resizable", true);
    el.innerHTML = '<a href="/a">A</a>';
    let toggles = 0;
    el.addEventListener("lr-toggle", () => toggles++);
    try {
      document.body.append(el);
      await el.updateComplete;

      expect(el.mode).to.equal("full");
      expect(el.open).to.be.false;
      expect(el.hasAttribute("open")).to.be.false;
      // Only `open` carries the mobile-only invariant -- the width restore is untouched.
      expect(el.railWidthPx).to.equal(260);
      // Undoing a restore is as silent as the restore itself: neither is a user action.
      expect(toggles).to.equal(0);
      // Outside 'mobile' the landmark renders as [part="base"] (it becomes [part="panel"] only
      // in mobile) -- its presence is itself proof the rail did not render as an overlay.
      const nav = el.shadowRoot!.querySelector('[part="base"]')!;
      expect(nav.getAttribute("role")).to.equal("navigation");
      expect(nav.hasAttribute("aria-modal")).to.equal(false);
    } finally {
      el.remove();
    }
  });

  // The half of the same invariant that only shows up later: a dropped restore must stay dropped
  // when the viewport does reach the mobile breakpoint, because setEffectiveMode()'s force-close
  // is skipped on the way *into* 'mobile'. A surviving `open` would make willUpdate's overlay
  // branch activate a focus-trapping, scroll-locking modal with no user action at all.
  it("leaves the overlay closed when a mount that dropped a persisted open later narrows to mobile", async () => {
    const key = uniqueKey();
    localStorage.setItem(`lr-app-rail:${key}`, JSON.stringify({ open: true }));
    const outside = (await fixture(
      html`<button>outside</button>`
    )) as HTMLButtonElement;

    const el = document.createElement("lr-app-rail") as LyraAppRail;
    el.setAttribute("storage-key", key);
    el.innerHTML = '<a href="/a">A</a>';
    let toggles = 0;
    el.addEventListener("lr-toggle", () => toggles++);
    try {
      document.body.append(el);
      await el.updateComplete;
      outside.focus();
      expect(document.activeElement === outside).to.equal(true);

      fireMobileChange(el, true);
      await el.updateComplete;
      await el.updateComplete;

      expect(el.mode).to.equal("mobile");
      // Asserted before `open` itself: these are the user-visible harm -- a modal dialog role, a
      // focus trap and a scroll lock arriving with no user action at all.
      const panel = el.shadowRoot!.querySelector('[part="panel"]')!;
      expect(panel.getAttribute("role")).to.equal("navigation");
      expect(panel.hasAttribute("aria-modal")).to.equal(false);
      expect(
        document.activeElement === outside,
        "no overlay opened, so nothing pulled focus off the page"
      ).to.equal(true);
      expect(toggles).to.equal(0);
      expect(el.open).to.be.false;
    } finally {
      el.remove();
    }
  });

  // A restore is not a user dismissal/opening, so it announces nothing. `fixture()` isn't used
  // here: it can resolve after the element's first update has already run, so the listener is
  // attached before the element is ever connected.
  it("fires no lr-toggle for an open state restored on mount", async () => {
    const key = uniqueKey();
    localStorage.setItem(`lr-app-rail:${key}`, JSON.stringify({ open: true }));
    matchMobileViewport();

    const el = document.createElement("lr-app-rail") as LyraAppRail;
    el.setAttribute("storage-key", key);
    el.innerHTML = '<a href="/a">A</a>';
    let toggles = 0;
    el.addEventListener("lr-toggle", () => toggles++);
    try {
      document.body.append(el);
      await el.updateComplete;
      expect(el.open).to.be.true;
      expect(toggles).to.equal(0);
    } finally {
      el.remove();
    }
  });

  // The restored value must never win over a controlled binding -- including one that assigns
  // `open`'s own default value, which is exactly what a value-based ("still the default?") guard
  // cannot see.
  it("keeps an explicit open=false binding authoritative over a persisted open state", async () => {
    const key = uniqueKey();
    localStorage.setItem(
      `lr-app-rail:${key}`,
      JSON.stringify({ open: true, railWidthPx: 260 })
    );
    // Mobile, so the stored `open: true` is one the rail would otherwise genuinely apply -- at a
    // wider breakpoint it is dropped regardless, which would make this guard vacuous.
    matchMobileViewport();

    const el = (await fixture(
      html`<lr-app-rail resizable storage-key=${key} .open=${false}
        ><a href="/a">A</a></lr-app-rail
      >`
    )) as LyraAppRail;
    await el.updateComplete;

    expect(el.open).to.be.false;
    expect(el.railWidthPx).to.equal(260);
  });

  it("keeps a declared open attribute authoritative over a persisted closed state", async () => {
    const key = uniqueKey();
    localStorage.setItem(`lr-app-rail:${key}`, JSON.stringify({ open: false }));

    const el = (await fixture(
      html`<lr-app-rail storage-key=${key} open
        ><a href="/a">A</a></lr-app-rail
      >`
    )) as LyraAppRail;
    await el.updateComplete;

    // The non-mobile drop above is scoped to a value the restore itself wrote: a consumer's own
    // declared `open` is an explicit initial state for the overlay (the documented "mounts
    // directly into an already-open mobile overlay" pattern), not stale cross-session storage,
    // so it survives a mount at a wider breakpoint exactly as it always has.
    expect(el.mode).to.equal("full");
    expect(el.open).to.be.true;
  });

  // Reconnect: the restore belongs to the first update alone. Re-running it on every reconnect
  // would let storage written by another instance (or another tab) overwrite the live state a
  // user just chose, long after mount.
  it("does not re-apply persisted open state on reconnect", async () => {
    const key = uniqueKey();
    localStorage.setItem(`lr-app-rail:${key}`, JSON.stringify({ open: true }));
    matchMobileViewport();

    const el = (await fixture(
      html`<lr-app-rail storage-key=${key}><a href="/a">A</a></lr-app-rail>`
    )) as LyraAppRail;
    await el.updateComplete;
    expect(el.open).to.be.true;

    const parent = el.parentNode as ParentNode;
    el.open = false;
    await el.updateComplete;
    expect(el.hasAttribute("open")).to.be.false;
    // Re-arm storage behind the component's back, so a re-running restore would be visible.
    localStorage.setItem(`lr-app-rail:${key}`, JSON.stringify({ open: true }));

    el.remove();
    parent.append(el);
    await el.updateComplete;

    expect(el.open).to.be.false;
  });
});

describe("layout: resizer anchor, overflow, and mobile containing block", () => {
  it("anchors the resizer within the host, not the viewport", async () => {
    const el = (await fixture(
      html`<lr-app-rail resizable style="block-size: 300px;"
        ><a href="/a">A</a></lr-app-rail
      >`
    )) as LyraAppRail;
    await el.updateComplete;
    const resizer = el.shadowRoot!.querySelector(
      '[part="resizer"]'
    ) as HTMLElement;
    const hostRect = el.getBoundingClientRect();
    const resizerRect = resizer.getBoundingClientRect();
    // Before the fix (:host had no position) inset-block:0 resolved against the viewport, so the
    // resizer spanned the full viewport height -- far taller than the 300px host.
    expect(Math.round(resizerRect.height)).to.equal(
      Math.round(hostRect.height)
    );
  });

  it("sets overflow-x to clip on the scrollable base so no spurious horizontal scrollbar appears", async () => {
    const el = (await fixture(
      html`<lr-app-rail><a href="/a">A</a></lr-app-rail>`
    )) as LyraAppRail;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    // Chromium normalizes overflow-x:clip to 'hidden' when the cross axis is a scroll container;
    // either value pins the axis and prevents the auto-computed horizontal scrollbar. What matters
    // is that it is no longer 'visible'/'auto'.
    expect(["clip", "hidden"]).to.include(getComputedStyle(base).overflowX);
  });

  it("settles the open mobile panel at transform:none so fixed descendants are not trapped", async () => {
    const el = (await fixture(
      html`<lr-app-rail open><a href="/a">A</a></lr-app-rail>`
    )) as LyraAppRail;
    fireMobileChange(el, true);
    await el.updateComplete;
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
    // A non-none transform (even translateX(0) -> matrix(1,0,0,1,0,0)) establishes a containing
    // block for position:fixed. The open state must compute to 'none'.
    expect(getComputedStyle(panel).transform).to.equal("none");
  });

  it("contains long localized header, item, and footer content in an open 320px RTL mobile rail", async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div dir="rtl" style="inline-size: 320px; max-inline-size: 100%;">
        <lr-app-rail
          label="التنقل الرئيسي"
          open
          style="--lr-app-rail-mobile-width: 320px;"
        >
          <span slot="header"
            >عنوان-تطبيق-طويل-جداً-غير-قابل-للفصل-ويجب-أن-يلتف-داخل-اللوحة</span
          >
          <lr-app-rail-item href="#reports">
            <span slot="icon" aria-hidden="true">📊</span>
            تقرير-تحليلي-طويل-جداً-غير-قابل-للفصل
          </lr-app-rail-item>
          <span slot="footer">حساب-مستخدم-طويل-جداً-غير-قابل-للفصل</span>
        </lr-app-rail>
      </div>
    `);
    const el = wrapper.querySelector("lr-app-rail") as LyraAppRail;
    fireMobileChange(el, true);
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector<HTMLElement>('[part="panel"]')!;
    const header =
      el.shadowRoot!.querySelector<HTMLElement>('[part="header"]')!;
    const nav = el.shadowRoot!.querySelector<HTMLElement>('[part="nav"]')!;
    const footer =
      el.shadowRoot!.querySelector<HTMLElement>('[part="footer"]')!;

    expect(Math.ceil(panel.getBoundingClientRect().width)).to.be.at.most(320);
    expect(header.scrollWidth).to.be.at.most(header.clientWidth);
    expect(nav.scrollWidth).to.be.at.most(nav.clientWidth);
    expect(footer.scrollWidth).to.be.at.most(footer.clientWidth);
    expect(getComputedStyle(panel).direction).to.equal("rtl");
  });
});

describe("panel/backdrop inset, radius, overflow, and background hooks", () => {
  async function openMobile(extra = ""): Promise<LyraAppRail> {
    const el = (await fixture(
      html`<lr-app-rail open style=${extra}><button>a</button></lr-app-rail>`
    )) as LyraAppRail;
    fireMobileChange(el, true);
    await el.updateComplete;
    await el.updateComplete;
    return el;
  }

  it("renders --lr-app-rail-panel-inset-block-start byte-identical to 0 when unset", async () => {
    const el = await openMobile();
    const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
    const backdrop = el.shadowRoot!.querySelector(
      '[part="backdrop"]'
    ) as HTMLElement;
    expect(getComputedStyle(panel).top).to.equal("0px");
    expect(getComputedStyle(backdrop).top).to.equal("0px");
  });

  it("offsets both the panel and backdrop from a set --lr-app-rail-panel-inset-block-start", async () => {
    const el = await openMobile(
      "--lr-app-rail-panel-inset-block-start: 48px;"
    );
    const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
    const backdrop = el.shadowRoot!.querySelector(
      '[part="backdrop"]'
    ) as HTMLElement;
    expect(getComputedStyle(panel).top).to.equal("48px");
    expect(getComputedStyle(backdrop).top).to.equal("48px");
    expect(Math.round(panel.getBoundingClientRect().top)).to.equal(48);
  });

  it("renders --lr-app-rail-panel-radius byte-identical to 0 when unset", async () => {
    const el = await openMobile();
    const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
    expect(getComputedStyle(panel).borderTopLeftRadius).to.equal("0px");
    expect(getComputedStyle(panel).borderTopRightRadius).to.equal("0px");
  });

  it("rounds the panel's corners from a set --lr-app-rail-panel-radius", async () => {
    const el = await openMobile("--lr-app-rail-panel-radius: 12px;");
    const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
    expect(getComputedStyle(panel).borderTopLeftRadius).to.equal("12px");
  });

  it("renders the four per-corner panel radius tokens byte-identical to 0 when unset", async () => {
    const el = await openMobile();
    const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
    const computed = getComputedStyle(panel);
    expect(computed.borderTopLeftRadius).to.equal("0px");
    expect(computed.borderTopRightRadius).to.equal("0px");
    expect(computed.borderBottomLeftRadius).to.equal("0px");
    expect(computed.borderBottomRightRadius).to.equal("0px");
  });

  it("rounds only the two corners away from the flush inline-start edge from --lr-app-rail-panel-radius-start-end/-end-end", async () => {
    const el = await openMobile(
      "--lr-app-rail-panel-radius-start-end: 12px; --lr-app-rail-panel-radius-end-end: 12px;"
    );
    const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
    const computed = getComputedStyle(panel);
    // LTR: inline-start is physical left (the panel's own flush edge -- inset-inline-start: 0),
    // so the -end corner tokens (inline-end, physical right) are the ones set here.
    expect(computed.borderTopLeftRadius).to.equal("0px");
    expect(computed.borderBottomLeftRadius).to.equal("0px");
    expect(computed.borderTopRightRadius).to.equal("12px");
    expect(computed.borderBottomRightRadius).to.equal("12px");
  });

  it('mirrors the same free-corner tokens to the opposite physical side under dir="rtl", with no second rule', async () => {
    const el = (await fixture(
      html`<lr-app-rail
        dir="rtl"
        open
        style="--lr-app-rail-panel-radius-start-end: 12px; --lr-app-rail-panel-radius-end-end: 12px;"
        ><button>a</button></lr-app-rail
      >`
    )) as LyraAppRail;
    fireMobileChange(el, true);
    await el.updateComplete;
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
    const computed = getComputedStyle(panel);
    // RTL: inline-start (the panel's still-flush edge) is now physical right, so the same
    // -end corner tokens now paint the physical LEFT corners instead -- proving the mirror without
    // touching the tokens or adding a :host(:dir(rtl)) rule of our own.
    expect(computed.borderTopRightRadius).to.equal("0px");
    expect(computed.borderBottomRightRadius).to.equal("0px");
    expect(computed.borderTopLeftRadius).to.equal("12px");
    expect(computed.borderBottomLeftRadius).to.equal("12px");
  });

  it("lets a per-corner token win over the uniform --lr-app-rail-panel-radius for just that corner", async () => {
    const el = await openMobile(
      "--lr-app-rail-panel-radius: 4px; --lr-app-rail-panel-radius-start-start: 20px;"
    );
    const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
    const computed = getComputedStyle(panel);
    expect(computed.borderTopLeftRadius).to.equal("20px");
    expect(computed.borderTopRightRadius).to.equal("4px");
    expect(computed.borderBottomLeftRadius).to.equal("4px");
    expect(computed.borderBottomRightRadius).to.equal("4px");
  });

  it("renders --lr-app-rail-panel-overflow-inline/-block byte-identical to clip/auto when unset", async () => {
    const el = await openMobile();
    const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
    // Chromium normalizes overflow-x:clip to 'hidden' when the cross axis is a scroll container
    // (see the sibling [part="base"] test above) -- either value pins the axis.
    expect(["clip", "hidden"]).to.include(getComputedStyle(panel).overflowX);
    expect(getComputedStyle(panel).overflowY).to.equal("auto");
  });

  it("setting only --lr-app-rail-panel-overflow-inline to visible still clips (the CSS overflow spec computes a lone visible axis as auto when its paired axis isn't)", async () => {
    const el = await openMobile("--lr-app-rail-panel-overflow-inline: visible;");
    const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
    expect(getComputedStyle(panel).overflowX).to.equal("auto");
  });

  it("lets both --lr-app-rail-panel-overflow-inline and -block together opt a slotted fixed popup out of panel clipping", async () => {
    const el = await openMobile(
      "--lr-app-rail-panel-overflow-inline: visible; --lr-app-rail-panel-overflow-block: visible;"
    );
    const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
    expect(getComputedStyle(panel).overflowX).to.equal("visible");
    expect(getComputedStyle(panel).overflowY).to.equal("visible");
  });

  it("renders --lr-app-rail-background/--lr-app-rail-panel-background byte-identical to their prior tokens when unset", async () => {
    const el = (await fixture(
      html`<lr-app-rail><button>a</button></lr-app-rail>`
    )) as LyraAppRail;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(base).backgroundColor).to.equal(
      resolvedInShadow(el, "background: var(--lr-color-surface)", "background-color")
    );

    fireMobileChange(el, true);
    await el.updateComplete;
    el.open = true;
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
    expect(getComputedStyle(panel).backgroundColor).to.equal(
      resolvedInShadow(
        el,
        "background: var(--lr-color-surface-overlay)",
        "background-color"
      )
    );
  });

  it("recolors the base and panel surfaces independently via --lr-app-rail-background/--lr-app-rail-panel-background", async () => {
    const el = (await fixture(
      html`<lr-app-rail
        open
        style="--lr-app-rail-background: rgb(10, 20, 30); --lr-app-rail-panel-background: rgb(40, 50, 60);"
        ><button>a</button></lr-app-rail
      >`
    )) as LyraAppRail;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(base).backgroundColor).to.equal("rgb(10, 20, 30)");

    fireMobileChange(el, true);
    await el.updateComplete;
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
    expect(getComputedStyle(panel).backgroundColor).to.equal("rgb(40, 50, 60)");
  });

  it("renders --lr-app-rail-header-padding/--lr-app-rail-footer-padding byte-identical to --lr-space-m when unset", async () => {
    const el = (await fixture(html`
      <lr-app-rail>
        <span slot="header">Brand</span>
        <button>a</button>
        <span slot="footer">Account</span>
      </lr-app-rail>
    `)) as LyraAppRail;
    await el.updateComplete;
    const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
    const footer = el.shadowRoot!.querySelector('[part="footer"]') as HTMLElement;
    const expected = resolvedInShadow(el, "padding: var(--lr-space-m)", "padding");
    expect(getComputedStyle(header).padding).to.equal(expected);
    expect(getComputedStyle(footer).padding).to.equal(expected);
  });

  it("retunes header/footer padding independently via --lr-app-rail-header-padding/--lr-app-rail-footer-padding", async () => {
    const el = (await fixture(html`
      <lr-app-rail
        style="--lr-app-rail-header-padding: 4px; --lr-app-rail-footer-padding: 20px;"
      >
        <span slot="header">Brand</span>
        <button>a</button>
        <span slot="footer">Account</span>
      </lr-app-rail>
    `)) as LyraAppRail;
    await el.updateComplete;
    const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
    const footer = el.shadowRoot!.querySelector('[part="footer"]') as HTMLElement;
    expect(getComputedStyle(header).padding).to.equal("4px");
    expect(getComputedStyle(footer).padding).to.equal("20px");
  });

  it("renders --lr-app-rail-header-min-block-size byte-identical (auto) when not set", async () => {
    const el = (await fixture(html`
      <lr-app-rail>
        <span slot="header">Brand</span>
        <button>a</button>
      </lr-app-rail>
    `)) as LyraAppRail;
    await el.updateComplete;
    const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
    expect(getComputedStyle(header).minBlockSize).to.equal("auto");
  });

  it("reserves a minimum header block size via --lr-app-rail-header-min-block-size", async () => {
    const el = (await fixture(html`
      <lr-app-rail style="--lr-app-rail-header-min-block-size: 96px;">
        <span slot="header">Brand</span>
        <button>a</button>
      </lr-app-rail>
    `)) as LyraAppRail;
    await el.updateComplete;
    const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
    expect(getComputedStyle(header).minBlockSize).to.equal("96px");
  });

  it("renders [part=\"nav\"]'s padding/gap byte-identical to their prior hard-coded values when unset", async () => {
    const el = (await fixture(
      html`<lr-app-rail><button>a</button></lr-app-rail>`
    )) as LyraAppRail;
    await el.updateComplete;
    const nav = el.shadowRoot!.querySelector('[part="nav"]') as HTMLElement;
    expect(getComputedStyle(nav).padding).to.equal(
      resolvedInShadow(el, "padding: var(--lr-space-s)", "padding")
    );
    expect(getComputedStyle(nav).gap).to.equal(
      resolvedInShadow(el, "gap: var(--lr-space-xs)", "gap")
    );
  });

  it("retunes [part=\"nav\"]'s padding/gap from --lr-app-rail-nav-padding/--lr-app-rail-nav-gap", async () => {
    const el = (await fixture(html`
      <lr-app-rail
        style="--lr-app-rail-nav-padding: 20px; --lr-app-rail-nav-gap: 24px;"
      >
        <button>a</button>
      </lr-app-rail>
    `)) as LyraAppRail;
    await el.updateComplete;
    const nav = el.shadowRoot!.querySelector('[part="nav"]') as HTMLElement;
    expect(getComputedStyle(nav).padding).to.equal("20px");
    expect(getComputedStyle(nav).gap).to.equal("24px");
  });
});

// -- external trigger ARIA (aria-expanded / aria-controls) ------------------
// The resolved external trigger has to announce the overlay's expanded state and what it
// controls; `lr-popover` is the reference for the same association.

function expectControls(trigger: HTMLElement, rail: LyraAppRail, panel: HTMLElement): void {
  const reflected = trigger as HTMLElement & { ariaControlsElements?: Element[] | null };
  if (Reflect.has(reflected, 'ariaControlsElements')) {
    expect(reflected.ariaControlsElements?.length ?? 0).to.equal(
      1,
      'external trigger should control exactly one element'
    );
    // A light-DOM trigger cannot hold a raw reference into another element's shadow tree: the
    // engine retargets it to the nearest public shadow host, which is what `<lr-popover>`'s own
    // trigger wiring documents. Either resolution proves the relationship reached the trigger.
    const controlled = reflected.ariaControlsElements?.[0] ?? null;
    expect(controlled === rail || controlled === panel).to.equal(
      true,
      'external trigger should control the rail surface'
    );
    return;
  }
  expect(trigger.getAttribute('aria-controls')).to.equal(panel.id);
}

it('gives a direct `trigger` reference aria-expanded and aria-controls in mobile mode', async () => {
  const external = document.createElement('button');
  document.body.appendChild(external);
  const el = (await fixture(
    html`<lr-app-rail hide-toggle><button>a</button></lr-app-rail>`
  )) as LyraAppRail;
  el.trigger = external;
  fireMobileChange(el, true);
  await el.updateComplete;

  expect(external.getAttribute('aria-expanded')).to.equal('false');
  expectControls(external, el, el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement);

  el.open = true;
  await el.updateComplete;
  expect(external.getAttribute('aria-expanded')).to.equal('true');

  el.open = false;
  await el.updateComplete;
  expect(external.getAttribute('aria-expanded')).to.equal('false');
  external.remove();
});

it('gives a `for`-resolved trigger the same association', async () => {
  const external = document.createElement('button');
  external.id = 'rail-aria-for';
  document.body.appendChild(external);
  const el = (await fixture(
    html`<lr-app-rail hide-toggle for="rail-aria-for"><button>a</button></lr-app-rail>`
  )) as LyraAppRail;
  fireMobileChange(el, true);
  await el.updateComplete;

  expect(external.getAttribute('aria-expanded')).to.equal('false');
  expectControls(external, el, el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement);
  external.remove();
});

it('releases the external trigger ARIA when the rail leaves mobile mode', async () => {
  const external = document.createElement('button');
  document.body.appendChild(external);
  const el = (await fixture(
    html`<lr-app-rail hide-toggle><button>a</button></lr-app-rail>`
  )) as LyraAppRail;
  el.trigger = external;
  fireMobileChange(el, true);
  await el.updateComplete;
  expect(external.getAttribute('aria-expanded')).to.equal('false');

  fireMobileChange(el, false);
  await el.updateComplete;
  expect(external.hasAttribute('aria-expanded')).to.equal(
    false,
    'a rail with no overlay to open leaves no stale disclosure state behind'
  );
  external.remove();
});

it('releases the external trigger ARIA when the rail disconnects', async () => {
  const external = document.createElement('button');
  document.body.appendChild(external);
  const el = (await fixture(
    html`<lr-app-rail hide-toggle><button>a</button></lr-app-rail>`
  )) as LyraAppRail;
  el.trigger = external;
  fireMobileChange(el, true);
  await el.updateComplete;
  expect(external.getAttribute('aria-expanded')).to.equal('false');

  el.remove();
  await el.updateComplete;
  expect(external.hasAttribute('aria-expanded')).to.equal(false);
  expect(external.hasAttribute('aria-controls')).to.equal(false);
  external.remove();
});

// -- desktop collapse control ----------------------------------------------

it('renders no collapse toggle unless `collapsible` is set', async () => {
  const el = (await fixture(
    html`<lr-app-rail><button>a</button></lr-app-rail>`
  )) as LyraAppRail;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="collapse-toggle"]') === null).to.equal(true);
  expect(el.collapsible).to.equal(false);
});

it('flips preferredMode between full and icon-only from the collapse toggle', async () => {
  const el = (await fixture(
    html`<lr-app-rail collapsible><button>a</button></lr-app-rail>`
  )) as LyraAppRail;
  await el.updateComplete;
  const toggle = el.shadowRoot!.querySelector('[part="collapse-toggle"]') as HTMLButtonElement;
  expect(toggle.getAttribute('aria-expanded')).to.equal('true');

  toggle.click();
  await el.updateComplete;
  expect(el.preferredMode).to.equal('icon-only');
  expect(el.mode).to.equal('icon-only');
  const collapsed = el.shadowRoot!.querySelector('[part="collapse-toggle"]') as HTMLButtonElement;
  expect(collapsed.getAttribute('aria-expanded')).to.equal('false');

  collapsed.click();
  await el.updateComplete;
  expect(el.preferredMode).to.equal('full');
  expect(el.mode).to.equal('full');
});

it('points the collapse toggle at the nav list it re-presents, never at its own ancestor', async () => {
  const el = (await fixture(
    html`<lr-app-rail collapsible><button>a</button></lr-app-rail>`
  )) as LyraAppRail;
  await el.updateComplete;
  const toggle = el.shadowRoot!.querySelector('[part="collapse-toggle"]') as HTMLButtonElement;
  const controlled = toggle.getAttribute('aria-controls')!;
  const target = el.shadowRoot!.getElementById(controlled);
  // Ids, never the nodes themselves: a chai failure carrying a live DOM node hangs the whole file.
  expect(target === null).to.equal(false);
  expect(target!.getAttribute('part')).to.equal('nav');
  expect(target!.contains(toggle)).to.equal(false);
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(controlled === base.id).to.equal(false);
});

it('persists the collapse preference through storage-key and persist="preferred-mode"', async () => {
  localStorage.removeItem('lr-app-rail:collapse-pref');
  const el = (await fixture(html`
    <lr-app-rail collapsible storage-key="collapse-pref" persist="preferred-mode">
      <button>a</button>
    </lr-app-rail>
  `)) as LyraAppRail;
  await el.updateComplete;
  el.toggleCollapse();
  await el.updateComplete;
  expect(el.preferredMode).to.equal('icon-only');
  expect(localStorage.getItem('lr-app-rail:collapse-pref')).to.contain('icon-only');

  const restored = (await fixture(html`
    <lr-app-rail collapsible storage-key="collapse-pref" persist="preferred-mode">
      <button>a</button>
    </lr-app-rail>
  `)) as LyraAppRail;
  await restored.updateComplete;
  expect(restored.mode).to.equal('icon-only');
  localStorage.removeItem('lr-app-rail:collapse-pref');
});

it('renders no collapse toggle in mobile mode and `toggleCollapse()` is inert there', async () => {
  const el = (await fixture(
    html`<lr-app-rail collapsible><button>a</button></lr-app-rail>`
  )) as LyraAppRail;
  fireMobileChange(el, true);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="collapse-toggle"]') === null).to.equal(true);

  el.toggleCollapse();
  await el.updateComplete;
  expect(el.preferredMode == null).to.equal(true);
  expect(el.mode).to.equal('mobile');
});

it('honors a strings override for the collapse toggle name', async () => {
  const el = (await fixture(html`
    <lr-app-rail
      collapsible
      .strings=${{ appRailCollapse: 'Replier la navigation', appRailExpand: 'Déplier la navigation' }}
    >
      <button>a</button>
    </lr-app-rail>
  `)) as LyraAppRail;
  await el.updateComplete;
  const toggle = el.shadowRoot!.querySelector('[part="collapse-toggle"]') as HTMLButtonElement;
  expect(toggle.getAttribute('aria-label')).to.equal('Replier la navigation');

  el.toggleCollapse();
  await el.updateComplete;
  const collapsed = el.shadowRoot!.querySelector('[part="collapse-toggle"]') as HTMLButtonElement;
  expect(collapsed.getAttribute('aria-label')).to.equal('Déplier la navigation');
});

it('activates the collapse toggle from the keyboard when it holds focus', async () => {
  const el = (await fixture(
    html`<lr-app-rail collapsible><button>a</button></lr-app-rail>`
  )) as LyraAppRail;
  await el.updateComplete;
  const toggle = el.shadowRoot!.querySelector('[part="collapse-toggle"]') as HTMLButtonElement;
  toggle.focus();
  expect(el.shadowRoot!.activeElement === toggle).to.equal(true);
  // A real key press, and no programmatic .click(): a synthetic KeyboardEvent never produces a
  // native click, so a dispatch-then-click pair asserts nothing about the keyboard -- it would
  // still pass with this button replaced by a <div role="button"> carrying no key handler.
  await sendKeys({ press: 'Enter' });
  await waitUntil(
    () => el.mode === 'icon-only',
    'Enter on the focused collapse toggle collapses the rail'
  );
});

it('keeps the collapse toggle reachable and accessible in a populated rail', async () => {
  const el = (await fixture(html`
    <lr-app-rail collapsible>
      <span slot="header">Brand</span>
      <lr-app-rail-item href="/a">Alpha</lr-app-rail-item>
      <span slot="footer">Account</span>
    </lr-app-rail>
  `)) as LyraAppRail;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('points the collapse glyph the opposite way under dir="rtl"', async () => {
  // Every reading is captured as a string the moment it is taken: getComputedStyle() returns a
  // LIVE declaration, so holding one across the toggle below would silently re-read the new state.
  const glyphTransform = (el: LyraAppRail): string =>
    getComputedStyle(el.shadowRoot!.querySelector('[part="collapse-icon"]') as HTMLElement)
      .transform;
  const ltr = (await fixture(
    html`<lr-app-rail collapsible><button>a</button></lr-app-rail>`
  )) as LyraAppRail;
  const rtl = (await fixture(
    html`<lr-app-rail dir="rtl" collapsible><button>a</button></lr-app-rail>`
  )) as LyraAppRail;
  await ltr.updateComplete;
  await rtl.updateComplete;
  const ltrExpanded = glyphTransform(ltr);
  const rtlExpanded = glyphTransform(rtl);

  ltr.toggleCollapse();
  rtl.toggleCollapse();
  await ltr.updateComplete;
  await rtl.updateComplete;
  const ltrCollapsed = glyphTransform(ltr);
  const rtlCollapsed = glyphTransform(rtl);

  expect(ltrExpanded).to.not.equal(ltrCollapsed);
  expect(rtlExpanded).to.equal(ltrCollapsed);
  expect(rtlCollapsed).to.equal(ltrExpanded);
});

it('restores the external trigger ARIA after the rail reconnects at an unchanged mode', async () => {
  // The mobile query matches for the whole test, so the reconnect below lands on the mode the rail
  // already held -- setEffectiveMode() early-returns, no update is scheduled, and updated() (the
  // only other caller of syncExternalTriggerA11y) never runs. Nothing but connectedCallback's own
  // catch-up can bring the lease back, which is exactly the regression this guards.
  window.matchMedia = ((query: string) =>
    ({
      matches: query.includes('600px'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as MediaQueryList)) as typeof window.matchMedia;
  const external = document.createElement('button');
  document.body.appendChild(external);
  const el = (await fixture(
    html`<lr-app-rail hide-toggle><button>a</button></lr-app-rail>`
  )) as LyraAppRail;
  el.trigger = external;
  await el.updateComplete;
  expect(el.mode).to.equal('mobile');
  expect(external.getAttribute('aria-expanded')).to.equal('false');

  const parent = el.parentElement!;
  el.remove();
  await el.updateComplete;
  expect(external.hasAttribute('aria-expanded')).to.equal(false);

  parent.appendChild(el);
  await el.updateComplete;
  expect(el.mode).to.equal('mobile');
  await waitUntil(
    () => external.getAttribute('aria-expanded') === 'false',
    'the reconnected rail re-acquires the external trigger lease on its own'
  );
  external.remove();
});

it('re-acquires the external trigger ARIA when a reconnect is followed by a breakpoint change', async () => {
  const external = document.createElement('button');
  document.body.appendChild(external);
  const el = (await fixture(
    html`<lr-app-rail hide-toggle><button>a</button></lr-app-rail>`
  )) as LyraAppRail;
  el.trigger = external;
  fireMobileChange(el, true);
  await el.updateComplete;
  const parent = el.parentElement!;
  el.remove();
  await el.updateComplete;
  expect(external.hasAttribute('aria-expanded')).to.equal(false);

  // The default stub reports every query unmatched, so this reconnect genuinely leaves mobile
  // mode: the association must stay off until the rail is back in mobile.
  parent.appendChild(el);
  await el.updateComplete;
  expect(el.mode).to.equal('full');
  expect(external.hasAttribute('aria-expanded')).to.equal(false);
  fireMobileChange(el, true);
  await el.updateComplete;
  expect(external.getAttribute('aria-expanded')).to.equal('false');
  external.remove();
});
