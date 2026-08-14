import { fixture, expect, html, oneEvent } from "@open-wc/testing";
import "./responsive-panel.js";
import type {
  LyraResponsivePanel,
  LyraResponsivePanelModeChangeDetail,
} from "./responsive-panel.js";
import { resolveResponsivePanelEffectiveMode } from "./responsive-panel.js";

it("pads an open bottom sheet with the --lr-safe-area-bottom token, not a hardcoded value", async () => {
  // Reads the real rendered/computed padding instead of substring-matching the exported
  // stylesheet source, which would still pass even if the declaration lived on a selector that
  // never actually matched the rendered panel. `--lr-safe-area-bottom` is unconditionally
  // re-declared (from env(safe-area-inset-bottom)) on this component's own :host in the shared
  // tokens stylesheet, so an *ancestor* override can't reach it -- only a same-element inline
  // style (higher priority than any shadow-DOM :host rule) can prove the panel genuinely consumes
  // the token rather than a coincidental 0px from a broken/missing reference.
  const el = (await fixture(html`
    <lr-responsive-panel
      mode="overlay"
      variant="bottom-sheet"
      open
      label="Actions"
      style="--lr-safe-area-bottom: 24px"
      ><button>Share</button></lr-responsive-panel
    >
  `)) as LyraResponsivePanel;
  await el.updateComplete;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(getComputedStyle(panel).paddingBlockEnd).to.equal("24px");
});

it("caps an open bottom sheet at 85% of the dynamic viewport by default", async () => {
  const el = (await fixture(
    html`<lr-responsive-panel
      mode="overlay"
      variant="bottom-sheet"
      open
      label="Actions"
      ><button>Share</button></lr-responsive-panel
    >`
  )) as LyraResponsivePanel;
  await el.updateComplete;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  const resolved = Number.parseFloat(getComputedStyle(panel).maxBlockSize);
  expect(Math.abs(resolved - window.innerHeight * 0.85)).to.be.lessThan(1);
});

it("lets a host override the bottom-sheet height through --lr-responsive-panel-sheet-max-block-size", async () => {
  const wrapper = (await fixture(html`
    <div style="--lr-responsive-panel-sheet-max-block-size: 120px">
      <lr-responsive-panel
        mode="overlay"
        variant="bottom-sheet"
        open
        label="Actions"
      >
        <button>Share</button>
      </lr-responsive-panel>
    </div>
  `)) as HTMLElement;
  const el = wrapper.querySelector(
    "lr-responsive-panel"
  ) as LyraResponsivePanel;
  await el.updateComplete;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(getComputedStyle(panel).maxBlockSize).to.equal("120px");
});

// A stand-in for a slotted component (e.g. lr-combobox) whose real
// focusable target lives inside its own shadow root rather than the host
// tag's light-DOM subtree. Mirrors lr-dialog's identical test fixture,
// under a distinct tag name so both test files can register their own copy
// in the same browser context.
class ResponsivePanelTestShadowInput extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const input = document.createElement("input");
    input.type = "text";
    root.appendChild(input);
  }
}
customElements.define(
  "responsive-panel-test-shadow-input",
  ResponsivePanelTestShadowInput
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asAny(el: LyraResponsivePanel): any {
  return el;
}

function applyAllocation(el: LyraResponsivePanel, inlineSize: number): void {
  el.style.inlineSize = `${inlineSize}px`;
  asAny(el).applyMeasuredInlineSize(inlineSize);
}

describe("resolveResponsivePanelEffectiveMode", () => {
  it("returns the forced mode regardless of breakpoint when mode is inline or overlay", () => {
    expect(resolveResponsivePanelEffectiveMode("inline", true)).to.equal("inline");
    expect(resolveResponsivePanelEffectiveMode("inline", false)).to.equal("inline");
    expect(resolveResponsivePanelEffectiveMode("overlay", true)).to.equal("overlay");
    expect(resolveResponsivePanelEffectiveMode("overlay", false)).to.equal("overlay");
  });

  it("tracks the breakpoint when mode is auto", () => {
    expect(resolveResponsivePanelEffectiveMode("auto", true)).to.equal("overlay");
    expect(resolveResponsivePanelEffectiveMode("auto", false)).to.equal("inline");
  });
});

it('defaults to mode="auto", variant="fullscreen", closed, overlay-breakpoint="768px"', async () => {
  const el = (await fixture(
    html`<lr-responsive-panel>body</lr-responsive-panel>`
  )) as LyraResponsivePanel;
  expect(el.mode).to.equal("auto");
  expect(el.getAttribute("mode")).to.equal("auto");
  expect(el.variant).to.equal("fullscreen");
  expect(el.open).to.be.false;
  expect(el.overlayBreakpoint).to.equal("768px");
  expect(el.effectiveMode).to.equal("inline");
});

it('resolves to inline in mode="auto" on a viewport wider than the breakpoint (the default jsdom/browser test width)', async () => {
  const el = (await fixture(
    html`<lr-responsive-panel open>body</lr-responsive-panel>`
  )) as LyraResponsivePanel;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.hasAttribute("role")).to.be.false;
  expect((el.shadowRoot!.querySelector('[part="backdrop"]')) == null).to.be.true;
});

it('forces the overlay presentation regardless of viewport width when mode="overlay"', async () => {
  const el = (await fixture(
    html`<lr-responsive-panel mode="overlay" open label="Settings"
      >body</lr-responsive-panel
    >`
  )) as LyraResponsivePanel;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.getAttribute("role")).to.equal("dialog");
  expect(panel.getAttribute("aria-modal")).to.equal("true");
  expect(panel.getAttribute("aria-label")).to.equal("Settings");
  expect(el.shadowRoot!.querySelector('[part="backdrop"]')).to.exist;
});

it("gives an otherwise unnamed overlay panel a localized fallback name", async () => {
  const el = (await fixture(html`
    <lr-responsive-panel mode="overlay" open></lr-responsive-panel>
  `)) as LyraResponsivePanel;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;

  expect(panel.getAttribute("aria-label")).to.equal("Panel");

  el.strings = { responsivePanel: "Paneel" };
  await el.updateComplete;
  expect(panel.getAttribute("aria-label")).to.equal("Paneel");
});

it("keeps an explicit empty host aria-label ahead of the fallback", async () => {
  const el = (await fixture(html`
    <lr-responsive-panel mode="overlay" open aria-label=""></lr-responsive-panel>
  `)) as LyraResponsivePanel;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.getAttribute("aria-label")).to.equal("");
});

it("forces the inline presentation even at a breakpoint that would otherwise resolve to overlay", async () => {
  const el = (await fixture(
    html`<lr-responsive-panel mode="inline" overlay-breakpoint="99999px" open
      >body</lr-responsive-panel
    >`
  )) as LyraResponsivePanel;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.hasAttribute("role")).to.be.false;
  expect((el.shadowRoot!.querySelector('[part="backdrop"]')) == null).to.be.true;
});

it("resolves auto mode from the component allocation rather than the viewport", async () => {
  const el = (await fixture(html`
    <lr-responsive-panel overlay-breakpoint="600px" open>body</lr-responsive-panel>
  `)) as LyraResponsivePanel;
  applyAllocation(el, 500);
  await el.updateComplete;
  expect(el.effectiveMode).to.equal("overlay");
  expect((el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement).getAttribute("role")).to.equal(
    "dialog"
  );

  applyAllocation(el, 900);
  await el.updateComplete;
  expect(el.effectiveMode).to.equal("inline");
  expect((el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement).hasAttribute("role")).to.equal(
    false
  );
});

it('re-evaluates a live overlay-breakpoint write against the same allocation', async () => {
  const el = (await fixture(html`
    <lr-responsive-panel overlay-breakpoint="400px" open>body</lr-responsive-panel>
  `)) as LyraResponsivePanel;
  el.style.inlineSize = "500px";
  applyAllocation(el, 500);
  await el.updateComplete;
  expect(el.effectiveMode).to.equal("inline");

  el.overlayBreakpoint = "600px";
  await el.updateComplete;
  expect(el.effectiveMode).to.equal("overlay");
});

it("normalizes invalid allocation and breakpoint inputs without leaving the closed union", async () => {
  const el = (await fixture(html`
    <lr-responsive-panel overlay-breakpoint="garbage" open>body</lr-responsive-panel>
  `)) as LyraResponsivePanel;
  asAny(el).applyMeasuredInlineSize(Number.NaN);
  await el.updateComplete;
  expect(el.effectiveMode).to.equal("inline");
  applyAllocation(el, 320);
  await el.updateComplete;
  expect(el.effectiveMode).to.equal("overlay");
});

it('hides [part="base"] entirely while closed, in both presentations', async () => {
  const inline = (await fixture(
    html`<lr-responsive-panel mode="inline">body</lr-responsive-panel>`
  )) as LyraResponsivePanel;
  const overlay = (await fixture(
    html`<lr-responsive-panel mode="overlay">body</lr-responsive-panel>`
  )) as LyraResponsivePanel;
  expect(
    getComputedStyle(inline.shadowRoot!.querySelector('[part="base"]')!).display
  ).to.equal("none");
  expect(
    getComputedStyle(overlay.shadowRoot!.querySelector('[part="base"]')!)
      .display
  ).to.equal("none");
});

it("applying an allocation measurement updates the effective presentation without a viewport resize", async () => {
  const el = (await fixture(
    html`<lr-responsive-panel open>body</lr-responsive-panel>`
  )) as LyraResponsivePanel;
  await el.updateComplete;
  let panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.hasAttribute("role"), "starts inline on a wide test viewport").to
    .be.false;

  applyAllocation(el, 320);
  await el.updateComplete;
  panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.getAttribute("role")).to.equal("dialog");

  applyAllocation(el, 1200);
  await el.updateComplete;
  panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.hasAttribute("role")).to.be.false;
});

it("emits lr-mode-change with the new effective mode when the breakpoint is crossed, but not on initial render", async () => {
  const el = (await fixture(
    html`<lr-responsive-panel open>body</lr-responsive-panel>`
  )) as LyraResponsivePanel;
  await el.updateComplete;
  let fired = false;
  el.addEventListener("lr-mode-change", () => (fired = true));

  const listener = oneEvent(el, "lr-mode-change");
  applyAllocation(el, 320);
  const event = await listener;
  expect(fired).to.be.true;
  expect((event.detail as LyraResponsivePanelModeChangeDetail).mode).to.equal(
    "overlay"
  );
});

it("does not emit lr-mode-change when the breakpoint state is reported without actually changing the effective mode", async () => {
  const el = (await fixture(
    html`<lr-responsive-panel mode="inline" open>body</lr-responsive-panel>`
  )) as LyraResponsivePanel;
  await el.updateComplete;
  let count = 0;
  el.addEventListener("lr-mode-change", () => count++);

  applyAllocation(el, 320); // mode is forced inline, so this can't change the effective mode
  await el.updateComplete;

  expect(count).to.equal(0);
});

it("a live breakpoint crossing while already open in overlay mode engages scroll-lock/focus-trap without closing the content", async () => {
  const el = (await fixture(
    html`<lr-responsive-panel open
      ><button>inside</button></lr-responsive-panel
    >`
  )) as LyraResponsivePanel;
  await el.updateComplete;
  expect(el.open, "stays open through the transition").to.be.true;
  expect(document.documentElement.style.overflow).to.equal("");

  applyAllocation(el, 320);
  await el.updateComplete;

  expect(el.open).to.be.true;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.getAttribute("role")).to.equal("dialog");
  expect(document.documentElement.style.overflow).to.equal("hidden");

  // Crossing back releases it again.
  applyAllocation(el, 1200);
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal("");
});

it("moves outside focus into the panel when a breakpoint crossing makes it modal", async () => {
  const outside = document.createElement("button");
  outside.textContent = "outside";
  document.body.appendChild(outside);
  outside.focus();

  const el = (await fixture(
    html`<lr-responsive-panel mode="inline" open
      ><button>inside</button></lr-responsive-panel
    >`
  )) as LyraResponsivePanel;
  await el.updateComplete;

  el.mode = "auto";
  applyAllocation(el, 320);
  await el.updateComplete;

  expect(document.activeElement?.textContent).to.equal("inside");
  outside.remove();
});

it("preserves panel focus when an open overlay becomes inline", async () => {
  const outside = document.createElement("button");
  outside.textContent = "outside";
  document.body.appendChild(outside);
  outside.focus();

  const el = (await fixture(
    html`<lr-responsive-panel mode="overlay" open
      ><button>inside</button></lr-responsive-panel
    >`
  )) as LyraResponsivePanel;
  await el.updateComplete;
  expect(document.activeElement?.textContent).to.equal("inside");

  el.mode = "inline";
  await el.updateComplete;

  expect(document.activeElement?.textContent).to.equal("inside");
  outside.remove();
});

it('closes on backdrop click and emits lr-close with reason "backdrop"', async () => {
  const el = (await fixture(
    html`<lr-responsive-panel mode="overlay" open>body</lr-responsive-panel>`
  )) as LyraResponsivePanel;
  const listener = oneEvent(el, "lr-close");
  (el.shadowRoot!.querySelector('[part="backdrop"]') as HTMLElement).click();
  const event = await listener;

  expect(el.open).to.be.false;
  expect(event.detail).to.equal("backdrop");
});

it('closes on Escape and emits lr-close with reason "escape"', async () => {
  const el = (await fixture(
    html`<lr-responsive-panel mode="overlay" open>body</lr-responsive-panel>`
  )) as LyraResponsivePanel;
  const listener = oneEvent(el, "lr-close");
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  const event = await listener;

  expect(el.open).to.be.false;
  expect(event.detail).to.equal("escape");
});

it("does not respond to Escape while inline (no document keydown trap is wired up)", async () => {
  const el = (await fixture(
    html`<lr-responsive-panel mode="inline" open>body</lr-responsive-panel>`
  )) as LyraResponsivePanel;
  let fired = false;
  el.addEventListener("lr-close", () => (fired = true));

  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  await el.updateComplete;

  expect(fired).to.be.false;
  expect(el.open).to.be.true;
});

it('close() fires lr-close with reason "api" in the inline presentation too (documented single-event simplification)', async () => {
  const el = (await fixture(
    html`<lr-responsive-panel mode="inline" open>body</lr-responsive-panel>`
  )) as LyraResponsivePanel;
  const listener = oneEvent(el, "lr-close");
  el.close();
  const event = await listener;

  expect(el.open).to.be.false;
  expect(event.detail).to.equal("api");
});

it("makes lr-close a cancelable pre-mutation veto for close(), Escape, and backdrop dismissal", async () => {
  const opener = document.createElement("button");
  opener.textContent = "Open responsive panel";
  document.body.appendChild(opener);
  opener.focus();

  const el = (await fixture(
    html`<lr-responsive-panel mode="overlay" label="Actions"
      ><button>Inside panel</button></lr-responsive-panel
    >`
  )) as LyraResponsivePanel;
  el.open = true;
  await el.updateComplete;
  const inside = el.querySelector("button") as HTMLButtonElement;
  const closeEvents: Array<{
    reason: string;
    cancelable: boolean;
    openDuringEvent: boolean;
    openAttributeDuringEvent: boolean;
    scrollLockDuringEvent: string;
  }> = [];
  el.addEventListener("lr-close", (event) => {
    const closeEvent = event as CustomEvent<string>;
    closeEvents.push({
      reason: closeEvent.detail,
      cancelable: closeEvent.cancelable,
      openDuringEvent: el.open,
      openAttributeDuringEvent: el.hasAttribute("open"),
      scrollLockDuringEvent: document.documentElement.style.overflow,
    });
    closeEvent.preventDefault();
  });

  el.close();
  await el.updateComplete;

  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  await el.updateComplete;

  (el.shadowRoot!.querySelector('[part="backdrop"]') as HTMLElement).click();
  await el.updateComplete;

  expect(closeEvents.map(({ reason }) => reason)).to.deep.equal([
    "api",
    "escape",
    "backdrop",
  ]);
  expect(
    closeEvents.every(
      ({
        cancelable,
        openDuringEvent,
        openAttributeDuringEvent,
        scrollLockDuringEvent,
      }) =>
        cancelable &&
        openDuringEvent &&
        openAttributeDuringEvent &&
        scrollLockDuringEvent === "hidden"
    )
  ).to.be.true;
  expect(el.open).to.be.true;
  expect(document.documentElement.style.overflow).to.equal("hidden");
  expect((document.activeElement) === (inside)).to.equal(true);

  // Keep this vetoed overlay from leaking into the following test's document-level stack.
  el.open = false;
  await el.updateComplete;
  opener.remove();
});

it("runs overlay cleanup and focus return after an allowed pre-mutation lr-close event", async () => {
  const opener = document.createElement("button");
  opener.textContent = "Open responsive panel";
  document.body.appendChild(opener);
  opener.focus();

  const el = (await fixture(
    html`<lr-responsive-panel mode="overlay" label="Actions"
      ><button>Inside panel</button></lr-responsive-panel
    >`
  )) as LyraResponsivePanel;
  el.open = true;
  await el.updateComplete;

  let openDuringEvent = false;
  el.addEventListener("lr-close", () => {
    openDuringEvent = el.open;
  });
  const listener = oneEvent(el, "lr-close");
  el.close();
  const event = await listener;
  await el.updateComplete;

  expect((event as Event).cancelable).to.be.true;
  expect(openDuringEvent).to.be.true;
  expect(el.open).to.be.false;
  expect(document.documentElement.style.overflow).to.equal("");
  expect((document.activeElement) === (opener)).to.equal(true);

  opener.remove();
});

it("close() is a no-op when already closed (no duplicate event, no error)", async () => {
  const el = (await fixture(
    html`<lr-responsive-panel mode="overlay">body</lr-responsive-panel>`
  )) as LyraResponsivePanel;
  let count = 0;
  el.addEventListener("lr-close", () => count++);

  el.close();
  el.close();
  await el.updateComplete;

  expect(count).to.equal(0);
});

it("a plain open = false property write does not fire lr-close", async () => {
  const el = (await fixture(
    html`<lr-responsive-panel mode="overlay" open>body</lr-responsive-panel>`
  )) as LyraResponsivePanel;
  let fired = false;
  el.addEventListener("lr-close", () => (fired = true));

  el.open = false;
  await el.updateComplete;

  expect(fired).to.be.false;
});

it("locks document scroll while open in the overlay presentation and releases it on close", async () => {
  const el = (await fixture(
    html`<lr-responsive-panel mode="overlay">body</lr-responsive-panel>`
  )) as LyraResponsivePanel;
  el.open = true;
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal("hidden");

  el.close();
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal("");
});

it("does not lock document scroll for the inline presentation", async () => {
  const el = (await fixture(
    html`<lr-responsive-panel mode="inline">body</lr-responsive-panel>`
  )) as LyraResponsivePanel;
  el.open = true;
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal("");
});

it("releases the scroll lock on disconnect while open in the overlay presentation", async () => {
  const el = (await fixture(
    html`<lr-responsive-panel mode="overlay" open>body</lr-responsive-panel>`
  )) as LyraResponsivePanel;
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal("hidden");

  el.remove();

  expect(document.documentElement.style.overflow).to.equal("");
});

it("restores the scroll lock and keydown trap when reparented while still open in the overlay presentation", async () => {
  const el = (await fixture(
    html`<lr-responsive-panel mode="overlay" open>body</lr-responsive-panel>`
  )) as LyraResponsivePanel;
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

it("moves focus into the panel to the first focusable element when opened in the overlay presentation", async () => {
  const el = (await fixture(
    html`<lr-responsive-panel mode="overlay"
      ><button>first</button><button>second</button></lr-responsive-panel
    >`
  )) as LyraResponsivePanel;
  const first = el.querySelector("button") as HTMLButtonElement;

  el.open = true;
  await el.updateComplete;

  expect((document.activeElement) === (first)).to.equal(true);
});

it("does not move focus for the inline presentation when opened", async () => {
  const outside = document.createElement("button");
  outside.textContent = "outside";
  document.body.appendChild(outside);
  outside.focus();

  const el = (await fixture(
    html`<lr-responsive-panel mode="inline"
      ><button>inside</button></lr-responsive-panel
    >`
  )) as LyraResponsivePanel;
  el.open = true;
  await el.updateComplete;

  expect((document.activeElement) === (outside)).to.equal(true);
  outside.remove();
});

it("traps Tab focus inside the panel while overlay chrome is active, wrapping last->first and first->last", async () => {
  const el = (await fixture(
    html`<lr-responsive-panel mode="overlay" open
      ><button>first</button>
      <div slot="footer"><button>last</button></div></lr-responsive-panel
    >`
  )) as LyraResponsivePanel;
  await el.updateComplete;
  const first = el.querySelector("button") as HTMLButtonElement;
  const last = el.querySelector('[slot="footer"] button') as HTMLButtonElement;

  last.focus();
  const tabForward = new KeyboardEvent("keydown", {
    key: "Tab",
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(tabForward);
  expect(tabForward.defaultPrevented).to.be.true;
  expect((document.activeElement) === (first)).to.equal(true);

  const tabBackward = new KeyboardEvent("keydown", {
    key: "Tab",
    shiftKey: true,
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(tabBackward);
  expect(tabBackward.defaultPrevented).to.be.true;
  expect((document.activeElement) === (last)).to.equal(true);
});

it("traps Tab/Shift+Tab at a slotted element whose focusable target lives in its own shadow root", async () => {
  const el = (await fixture(
    html`<lr-responsive-panel mode="overlay" open
      ><responsive-panel-test-shadow-input></responsive-panel-test-shadow-input>
      <div slot="footer"><button>last</button></div></lr-responsive-panel
    >`
  )) as LyraResponsivePanel;
  await el.updateComplete;
  const shadowHost = el.querySelector(
    "responsive-panel-test-shadow-input"
  ) as ResponsivePanelTestShadowInput;
  const input = shadowHost.shadowRoot!.querySelector(
    "input"
  ) as HTMLInputElement;
  const last = el.querySelector('[slot="footer"] button') as HTMLButtonElement;

  expect((shadowHost.shadowRoot!.activeElement) === (input)).to.equal(true);

  const shiftTab = new KeyboardEvent("keydown", {
    key: "Tab",
    shiftKey: true,
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(shiftTab);
  expect(shiftTab.defaultPrevented).to.be.true;
  expect((document.activeElement) === (last)).to.equal(true);
});

it("hides the header/footer wrappers when nothing is slotted into them, shows them once slotted", async () => {
  const el = (await fixture(
    html`<lr-responsive-panel mode="inline" open>body</lr-responsive-panel>`
  )) as LyraResponsivePanel;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
  const footer = el.shadowRoot!.querySelector('[part="footer"]') as HTMLElement;
  expect(header.hasAttribute("hidden")).to.be.true;
  expect(footer.hasAttribute("hidden")).to.be.true;

  const h = document.createElement("span");
  h.slot = "header";
  el.appendChild(h);
  el.shadowRoot!.querySelector('slot[name="header"]')!.dispatchEvent(
    new Event("slotchange")
  );
  const f = document.createElement("span");
  f.slot = "footer";
  el.appendChild(f);
  el.shadowRoot!.querySelector('slot[name="footer"]')!.dispatchEvent(
    new Event("slotchange")
  );
  await el.updateComplete;

  expect(header.hasAttribute("hidden")).to.be.false;
  expect(footer.hasAttribute("hidden")).to.be.false;
});

it("renders the header/footer wrappers visible on first paint when content is present before upgrade", async () => {
  const el = (await fixture(
    html`<lr-responsive-panel mode="inline" open
      ><span slot="header">Title</span>body<span slot="footer"
        >OK</span
      ></lr-responsive-panel
    >`
  )) as LyraResponsivePanel;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
  const footer = el.shadowRoot!.querySelector('[part="footer"]') as HTMLElement;
  expect(header.hasAttribute("hidden")).to.be.false;
  expect(footer.hasAttribute("hidden")).to.be.false;
});

it("reflects the variant attribute", async () => {
  const el = (await fixture(
    html`<lr-responsive-panel variant="bottom-sheet">body</lr-responsive-panel>`
  )) as LyraResponsivePanel;
  expect(el.getAttribute("variant")).to.equal("bottom-sheet");
});

it("is accessible while closed (empty/default state)", async () => {
  const el = (await fixture(
    html`<lr-responsive-panel></lr-responsive-panel>`
  )) as LyraResponsivePanel;
  await expect(el).to.be.accessible();
});

it("is accessible while open in the inline presentation with header/body/footer content", async () => {
  const el = (await fixture(
    html`<lr-responsive-panel mode="inline" open
      ><span slot="header">Filters</span>
      <p>Filter controls go here.</p>
      <div slot="footer"><button>Apply</button></div></lr-responsive-panel
    >`
  )) as LyraResponsivePanel;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it("is accessible while open in the overlay presentation with a label", async () => {
  const el = (await fixture(
    html`<lr-responsive-panel mode="overlay" open label="Conversation history"
      ><p>History items go here.</p>
      <div slot="footer"><button>Close</button></div></lr-responsive-panel
    >`
  )) as LyraResponsivePanel;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it("falls back to the header slot content as aria-label when label is unset", async () => {
  const el = (await fixture(
    html`<lr-responsive-panel mode="overlay" open
      ><span slot="header">Filters</span>
      <p>Filter controls go here.</p></lr-responsive-panel
    >`
  )) as LyraResponsivePanel;
  await el.updateComplete;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.getAttribute("aria-label")).to.equal("Filters");
});

it("updates the dialog name when text inside an assigned header mutates", async () => {
  const el = (await fixture(
    html`<lr-responsive-panel mode="overlay" open
      ><h2 slot="header">Original heading</h2></lr-responsive-panel
    >`
  )) as LyraResponsivePanel;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.getAttribute("aria-label")).to.equal("Original heading");

  (el.querySelector('[slot="header"]') as HTMLElement).textContent =
    "Updated heading";
  await new Promise((resolve) => setTimeout(resolve, 0));
  await el.updateComplete;
  expect(panel.getAttribute("aria-label")).to.equal("Updated heading");
});

it("restores header text observation after reconnect", async () => {
  const container = await fixture(html`<div>
    <lr-responsive-panel mode="overlay" open
      ><span slot="header">Before reconnect</span></lr-responsive-panel
    >
  </div>`);
  const el = container.querySelector(
    "lr-responsive-panel"
  ) as LyraResponsivePanel;
  el.remove();
  container.append(el);
  await new Promise((resolve) => setTimeout(resolve, 0));

  (el.querySelector('[slot="header"]') as HTMLElement).textContent =
    "After reconnect";
  await new Promise((resolve) => setTimeout(resolve, 0));
  await el.updateComplete;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.getAttribute("aria-label")).to.equal("After reconnect");
});

it("recreates its header observer in the adopted owner realm", async () => {
  const el = (await fixture(
    html`<lr-responsive-panel mode="overlay" open><span slot="header">Owner heading</span></lr-responsive-panel>`,
  )) as LyraResponsivePanel;
  await el.updateComplete;
  const heading = el.querySelector('[slot="header"]')!;
  el.remove();
  const iframe = document.createElement("iframe");
  document.body.append(iframe);
  const frameDocument = iframe.contentDocument;
  const frameWindow = iframe.contentWindow;
  if (!frameDocument || !frameWindow) {
    iframe.remove();
    throw new Error("The iframe realm was unavailable.");
  }
  const originalMutationObserver = frameWindow.MutationObserver;
  let observations = 0;
  let disconnects = 0;
  class OwnerMutationObserver implements MutationObserver {
    private observesHeading = false;
    constructor(_callback: MutationCallback) {}
    observe(target: Node): void {
      if (target === heading) {
        this.observesHeading = true;
        observations += 1;
      }
    }
    takeRecords(): MutationRecord[] { return []; }
    disconnect(): void { if (this.observesHeading) disconnects += 1; }
  }
  frameWindow.MutationObserver = OwnerMutationObserver;

  try {
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;
    await Promise.resolve();
    expect(observations, "the destination window observes the slotted header").to.be.greaterThan(0);
    document.adoptNode(el);
    expect(disconnects, "adoption disconnects the old header observer").to.be.greaterThan(0);
  } finally {
    frameWindow.MutationObserver = originalMutationObserver;
    if (el.ownerDocument !== document) document.adoptNode(el);
    el.remove();
    iframe.remove();
  }
});

it("prefers a heading element within the header slot over its full text when both are present", async () => {
  const el = (await fixture(
    html`<lr-responsive-panel mode="overlay" open
      ><h2 slot="header">Filters</h2>
      <button slot="header">Reset</button>
      <p>Filter controls go here.</p></lr-responsive-panel
    >`
  )) as LyraResponsivePanel;
  await el.updateComplete;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.getAttribute("aria-label")).to.equal("Filters");
});

it("prefers an explicit label over the header slot fallback", async () => {
  const el = (await fixture(
    html`<lr-responsive-panel mode="overlay" open label="Explicit label"
      ><span slot="header">Header text</span></lr-responsive-panel
    >`
  )) as LyraResponsivePanel;
  await el.updateComplete;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.getAttribute("aria-label")).to.equal("Explicit label");
});

it("forwards a host-level aria-label attribute to the panel, winning over label and the header-slot fallback", async () => {
  const el = (await fixture(
    html`<lr-responsive-panel
      mode="overlay"
      open
      label="Explicit label"
      aria-label="Host override"
      ><span slot="header">Header text</span></lr-responsive-panel
    >`
  )) as LyraResponsivePanel;
  await el.updateComplete;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.getAttribute("aria-label")).to.equal("Host override");
});

it("is accessible while open in the overlay presentation with header-slot content but no label", async () => {
  const el = (await fixture(
    html`<lr-responsive-panel mode="overlay" open
      ><span slot="header">Conversation history</span>
      <p>History items go here.</p>
      <div slot="footer"><button>Close</button></div></lr-responsive-panel
    >`
  )) as LyraResponsivePanel;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it("captures lastTrigger only on a genuine open transition, so it survives a later breakpoint crossing into overlay and close() returns focus to the true original trigger (not something focused inside the panel meanwhile)", async () => {
  const outsideTrigger = document.createElement("button");
  outsideTrigger.textContent = "outside trigger";
  document.body.appendChild(outsideTrigger);
  outsideTrigger.focus();

  const el = (await fixture(
    html`<lr-responsive-panel mode="inline" open
      ><button id="inside">inside</button></lr-responsive-panel
    >`
  )) as LyraResponsivePanel;
  await el.updateComplete;

  // The user then interacts with something inside the (currently inline/docked) panel.
  const inside = el.querySelector("#inside") as HTMLButtonElement;
  inside.focus();

  // Crossing into overlay while still open must not re-capture "inside" as
  // the trigger, even though the overlay-chrome-engage branch fires here.
  el.mode = "auto";
  applyAllocation(el, 320);
  await el.updateComplete;
  expect(el.open, "stays open through the transition").to.be.true;

  el.close("escape");
  await el.updateComplete;

  expect((document.activeElement) === (outsideTrigger)).to.equal(true);
  outsideTrigger.remove();
});

it("is accessible while open in the bottom-sheet overlay variant", async () => {
  const el = (await fixture(
    html`<lr-responsive-panel
      mode="overlay"
      variant="bottom-sheet"
      open
      label="Actions"
      ><button>Share</button></lr-responsive-panel
    >`
  )) as LyraResponsivePanel;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it("contains unbroken header, body, and footer content in 320px LTR/RTL inline and overlay allocations", async () => {
  for (const direction of ["ltr", "rtl"] as const) {
    for (const mode of ["inline", "overlay"] as const) {
      const wrapper = await fixture<HTMLElement>(html`
        <div dir=${direction} style="inline-size: 320px; max-inline-size: 100%;">
          <lr-responsive-panel mode=${mode} open label="Long content">
            <span slot="header">InternationalizedResponsivePanelHeaderWithoutAnyNaturalBreakOpportunity</span>
            InternationalizedResponsivePanelBodyWithoutAnyNaturalBreakOpportunity
            <button slot="footer" type="button"
              >InternationalizedResponsivePanelFooterActionWithoutAnyNaturalBreakOpportunity</button
            >
          </lr-responsive-panel>
        </div>
      `);
      const el = wrapper.querySelector("lr-responsive-panel") as LyraResponsivePanel;
      await el.updateComplete;
      const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
      const panel = el.shadowRoot!.querySelector<HTMLElement>('[part="panel"]')!;
      const header = el.shadowRoot!.querySelector<HTMLElement>('[part="header"]')!;
      const body = el.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
      const footer = el.shadowRoot!.querySelector<HTMLElement>('[part="footer"]')!;

      // The overlay base is intentionally viewport-fixed, so give the same
      // rendered panel the 320px allocation as the inline case before
      // measuring its internal wrappers.
      if (mode === "overlay") {
        base.style.inlineSize = "320px";
        base.style.insetInlineEnd = "auto";
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }

      expect(Math.ceil(panel.getBoundingClientRect().width)).to.be.at.most(320);
      expect(header.scrollWidth).to.be.at.most(header.clientWidth + 1);
      expect(body.scrollWidth).to.be.at.most(body.clientWidth + 1);
      expect(footer.scrollWidth).to.be.at.most(footer.clientWidth + 1);
      expect(getComputedStyle(panel).direction).to.equal(direction);

      el.open = false;
      await el.updateComplete;
    }
  }
});

it("keeps deliberate wide widgets scrollable inside the responsive-panel body", async () => {
  const el = (await fixture(html`
    <lr-responsive-panel mode="inline" open style="inline-size: 320px;">
      <div style="inline-size: 640px;">Intentionally wide widget</div>
    </lr-responsive-panel>
  `)) as LyraResponsivePanel;
  await el.updateComplete;
  const body = el.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;

  expect(body.scrollWidth).to.be.greaterThan(body.clientWidth);
  expect(getComputedStyle(body).overflowX).to.equal("auto");
});

describe("overlay state cssprops", () => {
  function resolvedInShadow(
    el: LyraResponsivePanel,
    declaration: string,
    property: string
  ): string {
    const probe = document.createElement("span");
    probe.setAttribute("style", declaration);
    el.shadowRoot!.append(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  it("keeps the pre-cssprop scrim and overlay-surface treatment when the props are unset", async () => {
    const el = (await fixture(
      html`<lr-responsive-panel mode="overlay" variant="bottom-sheet" open label="Actions"
        ><button>Share</button></lr-responsive-panel
      >`
    )) as LyraResponsivePanel;
    await el.updateComplete;
    const backdrop = el.shadowRoot!.querySelector<HTMLElement>('[part="backdrop"]')!;
    const panel = el.shadowRoot!.querySelector<HTMLElement>('[part="panel"]')!;

    try {
      expect(getComputedStyle(backdrop).backgroundColor).to.equal(
        resolvedInShadow(el, "background: var(--lr-color-overlay)", "background-color")
      );
      expect(getComputedStyle(panel).backgroundColor).to.equal(
        resolvedInShadow(el, "background: var(--lr-color-surface-overlay)", "background-color")
      );
      expect(getComputedStyle(panel).boxShadow).to.equal(
        resolvedInShadow(el, "box-shadow: var(--lr-shadow-l)", "box-shadow")
      );
    } finally {
      el.open = false;
      await el.updateComplete;
    }
  });

  it("inherits overlay state props from an ancestor and confines them to the overlay panel", async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div
        style="
          --lr-responsive-panel-overlay-color: rgb(0, 51, 102);
          --lr-responsive-panel-overlay-panel-bg: rgb(255, 255, 255);
          --lr-responsive-panel-overlay-panel-shadow: none;
        "
      >
        <lr-responsive-panel mode="overlay" variant="bottom-sheet" open label="Actions"
          ><button>Share</button></lr-responsive-panel
        >
      </div>
    `);
    const el = wrapper.querySelector("lr-responsive-panel") as LyraResponsivePanel;
    await el.updateComplete;
    const backdrop = el.shadowRoot!.querySelector<HTMLElement>('[part="backdrop"]')!;
    const panel = el.shadowRoot!.querySelector<HTMLElement>('[part="panel"]')!;

    try {
      expect(getComputedStyle(backdrop).backgroundColor).to.equal("rgb(0, 51, 102)");
      expect(getComputedStyle(panel).backgroundColor).to.equal("rgb(255, 255, 255)");
      expect(getComputedStyle(panel).boxShadow).to.equal("none");
    } finally {
      el.open = false;
      await el.updateComplete;
    }

    const inlineWrapper = await fixture<HTMLElement>(html`
      <div
        style="
          --lr-responsive-panel-overlay-color: rgb(0, 51, 102);
          --lr-responsive-panel-overlay-panel-bg: rgb(255, 255, 255);
          --lr-responsive-panel-overlay-panel-shadow: none;
        "
      >
        <lr-responsive-panel mode="inline" open><button>Share</button></lr-responsive-panel>
      </div>
    `);
    const inline = inlineWrapper.querySelector("lr-responsive-panel") as LyraResponsivePanel;
    await inline.updateComplete;
    const inlinePanel = inline.shadowRoot!.querySelector<HTMLElement>('[part="panel"]')!;

    expect(getComputedStyle(inlinePanel).backgroundColor).to.equal(
      resolvedInShadow(inline, "background: var(--lr-color-surface)", "background-color")
    );
    expect(getComputedStyle(inlinePanel).boxShadow).to.equal("none");
  });
});
