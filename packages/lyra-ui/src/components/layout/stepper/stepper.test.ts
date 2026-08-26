import {
  fixture,
  expect,
  html,
  oneEvent,
  elementUpdated,
  waitUntil,
} from "@open-wc/testing";
import "./stepper.js";
import type { LyraStepper } from "./stepper.js";
import { styles } from "./stepper.styles.js";
import { resetMouse, sendMouse } from "../../../../test/wtr-mouse.js";
import { setForcedColors } from "../../../../test/wtr-media.js";

const steps = () => [
  { stepId: "basics", label: "Basics", state: "completed" as const },
  { stepId: "inputs", label: "Inputs", state: "current" as const },
  { stepId: "review", label: "Review", state: "pending" as const },
];

function stepButtons(el: LyraStepper): HTMLButtonElement[] {
  return [
    ...el.shadowRoot!.querySelectorAll('[part="step"]'),
  ] as HTMLButtonElement[];
}

/** Spies on the real `ResizeObserver` constructor so a test can manually drive a component's
 *  effective-orientation callback with a synthetic width -- same technique split.test.ts's own
 *  collapse-state tests use for their identically-shaped `ResizeObserver`. Restore in a `finally`.
 *
 *  `inert` additionally makes `observe()` a no-op, so *only* synthetic widths ever reach the
 *  component. Needed by any test that mutates layout mid-test (e.g. the root font size): a real
 *  observation would otherwise deliver the fixture's actual width right after the synthetic one and
 *  overwrite the state under assertion -- and re-entrant real deliveries surface as the browser's
 *  "ResizeObserver loop completed with undelivered notifications" error. */
function installResizeObserverSpy({
  inert = false,
}: { inert?: boolean } = {}): {
  callbacks: ResizeObserverCallback[];
  restore: () => void;
} {
  const callbacks: ResizeObserverCallback[] = [];
  const OriginalRO = window.ResizeObserver;
  class SpyResizeObserver extends OriginalRO {
    constructor(callback: ResizeObserverCallback) {
      super(callback);
      callbacks.push(callback);
    }
    override observe(target: Element, options?: ResizeObserverOptions): void {
      if (!inert) super.observe(target, options);
    }
  }
  (
    window as unknown as { ResizeObserver: typeof ResizeObserver }
  ).ResizeObserver = SpyResizeObserver;
  return {
    callbacks,
    restore: () => {
      (
        window as unknown as { ResizeObserver: typeof ResizeObserver }
      ).ResizeObserver = OriginalRO;
    },
  };
}

/** Every `lr-stepper` arms one `ResizeObserver` of its own regardless of the `orientationBreakpoint`
 *  feature: the scroll-overflow gate deciding whether the horizontal edge fade paints (see
 *  `ScrollOverflowController`). So a spy that counts constructions sees this one on top of any
 *  breakpoint observation, and every count below is expressed relative to it. */
const BASELINE_OBSERVERS = 1;

/** Drives a synthetic width through *every* callback the element armed, instead of indexing one by
 *  construction order (which is an implementation detail, and wrong the moment a second observer
 *  is added). Safe to over-deliver: the scroll-overflow callback ignores its entries entirely and
 *  just re-measures its own track. */
function fireResizeAll(
  callbacks: ResizeObserverCallback[],
  width: number
): void {
  for (const callback of callbacks) fireResize(callback, width);
}

function fireResize(callback: ResizeObserverCallback, width: number): void {
  callback(
    [
      {
        contentBoxSize: [{ inlineSize: width, blockSize: 0 }],
      } as unknown as ResizeObserverEntry,
    ],
    {} as ResizeObserver
  );
}

function installOwnerMatchMediaStub(
  owner: Window,
  width: number
): {
  queries: string[];
  removed: string[];
  restore(): void;
} {
  const original = owner.matchMedia;
  const queries: string[] = [];
  const removed: string[] = [];
  owner.matchMedia = ((query: string) => {
    queries.push(query);
    const max = Number.parseFloat(
      /max-width:\s*([\d.]+)px/.exec(query)?.[1] ?? "NaN"
    );
    return {
      media: query,
      matches: width <= max,
      addEventListener: () => {},
      removeEventListener: () => removed.push(query),
    } as unknown as MediaQueryList;
  }) as typeof owner.matchMedia;
  return {
    queries,
    removed,
    restore(): void {
      owner.matchMedia = original;
    },
  };
}

describe("lr-stepper", () => {
  it("uses stepId as the public step identity", async () => {
    const el = await fixture<LyraStepper>(html`
      <lr-stepper
        .steps=${[
          { stepId: "account", label: "Account", state: "current" as const },
        ] as unknown as LyraStepper["steps"]}
      ></lr-stepper>
    `);
    await el.updateComplete;

    expect(stepButtons(el)[0]?.dataset["stepId"]).to.equal("account");
  });

  it("renders one step per entry with the right state-driven part/attribute", async () => {
    const el = (await fixture(
      html`<lr-stepper .steps=${steps()}></lr-stepper>`
    )) as LyraStepper;
    const buttons = stepButtons(el);
    expect(buttons).to.have.length(3);
    expect(buttons[0]!.getAttribute("data-state")).to.equal("completed");
    expect(buttons[1]!.getAttribute("data-state")).to.equal("current");
    expect(buttons[1]!.getAttribute("aria-current")).to.equal("step");
    expect(buttons[2]!.getAttribute("data-state")).to.equal("pending");
    expect(buttons[0]!.getAttribute("aria-current")).to.equal("false");
    expect(buttons[2]!.getAttribute("aria-current")).to.equal("false");
  });

  it("uses a bounded immutable realm-neutral schema snapshot and skips hostile records", async () => {
    const frame = document.createElement("iframe");
    document.body.append(frame);
    const foreignArray = new frame.contentWindow!.Array();
    const hostile = {};
    Object.defineProperty(hostile, "stepId", {
      get(): never {
        throw new Error("hostile id");
      },
    });
    const source = { stepId: "safe", label: "Safe", state: "current" as const };
    foreignArray.push(
      hostile,
      { stepId: "", label: "Missing id", state: "pending" },
      source,
      { stepId: "later", label: "Later", state: "completed" }
    );
    const el = (await fixture(
      html`<lr-stepper .steps=${foreignArray}></lr-stepper>`
    )) as LyraStepper;
    frame.remove();

    source.label = "Caller mutation";
    expect(stepButtons(el).map((button) => button.dataset["stepId"])).to.deep.equal(
      ["safe", "later"]
    );
    expect(el.steps[0]!.label).to.equal("Safe");
    expect(Object.isFrozen(el.steps)).to.be.true;
    expect(Object.isFrozen(el.steps[0])).to.be.true;

    const oversized = Array.from({ length: 260 }, (_, index) => ({
      stepId: `step-${index}`,
      label: `Step ${index}`,
      state: "pending" as const,
    }));
    el.steps = oversized;
    await el.updateComplete;
    expect(el.steps).to.have.length(256);
    expect(stepButtons(el)).to.have.length(256);
  });

  it('drops steps with empty or whitespace-only labels while retaining an accessible valid step', async () => {
    const el = (await fixture(html`
      <lr-stepper
        .steps=${[
          { stepId: 'empty', label: '', state: 'completed' },
          { stepId: 'blank', label: '   ', state: 'current' },
          { stepId: 'review', label: 'Review', state: 'current' },
        ]}
      ></lr-stepper>
    `)) as LyraStepper;

    expect(el.steps.length).to.equal(1);
    expect(stepButtons(el).length).to.equal(1);
    expect(stepButtons(el)[0]!.textContent?.trim()).to.include('Review');
    await expect(el).to.be.accessible();
  });

  it("uses list/progress semantics instead of tabs without tabpanels", async () => {
    const el = (await fixture(
      html`<lr-stepper .steps=${steps()}></lr-stepper>`
    )) as LyraStepper;
    const buttons = stepButtons(el);
    expect(
      el.shadowRoot!.querySelector('[part="base"]')!.getAttribute("role")
    ).to.equal("list");
    expect(
      el.shadowRoot!.querySelectorAll('[role="listitem"]').length
    ).to.equal(3);
    expect(buttons.every((button) => !button.hasAttribute("role"))).to.be.true;
    expect(buttons.every((button) => !button.hasAttribute("aria-selected"))).to
      .be.true;
  });

  it('gives exactly one step tabindex="0" when a step is current, and it is the current one', async () => {
    const el = (await fixture(
      html`<lr-stepper .steps=${steps()}></lr-stepper>`
    )) as LyraStepper;
    const buttons = stepButtons(el);
    expect(buttons.map((b) => b.getAttribute("tabindex"))).to.deep.equal([
      "-1",
      "0",
      "-1",
    ]);
  });

  it("uses the first duplicate current step as the single ARIA current and promotes the next when it is removed", async () => {
    const firstCurrent = {
      stepId: "account",
      label: "Account",
      state: "current" as const,
    };
    const secondCurrent = {
      stepId: "details",
      label: "Details",
      state: "current" as const,
    };
    const pending = {
      stepId: "review",
      label: "Review",
      state: "pending" as const,
    };
    const el = (await fixture(
      html`<lr-stepper
        .steps=${[firstCurrent, secondCurrent, pending]}
      ></lr-stepper>`
    )) as LyraStepper;

    let buttons = stepButtons(el);
    expect(
      buttons.map((button) => button.getAttribute("aria-current"))
    ).to.deep.equal(["step", "false", "false"]);
    expect(
      buttons.map((button) => button.getAttribute("tabindex"))
    ).to.deep.equal(["0", "-1", "-1"]);

    el.steps = [secondCurrent, pending];
    await el.updateComplete;

    buttons = stepButtons(el);
    expect(
      buttons.map((button) => button.getAttribute("aria-current"))
    ).to.deep.equal(["step", "false"]);
    expect(
      buttons.map((button) => button.getAttribute("tabindex"))
    ).to.deep.equal(["0", "-1"]);
  });

  it("falls back roving tabindex to the first non-disabled step when no step is current (all-completed)", async () => {
    const el = (await fixture(
      html`<lr-stepper
        .steps=${[
          { stepId: "basics", label: "Basics", state: "completed" as const },
          { stepId: "inputs", label: "Inputs", state: "completed" as const },
          { stepId: "review", label: "Review", state: "completed" as const },
        ]}
      ></lr-stepper>`
    )) as LyraStepper;
    const buttons = stepButtons(el);
    expect(buttons.map((b) => b.getAttribute("tabindex"))).to.deep.equal([
      "0",
      "-1",
      "-1",
    ]);
  });

  it("falls back roving tabindex to the first non-disabled step when no step is current (all-pending)", async () => {
    const el = (await fixture(
      html`<lr-stepper
        .steps=${[
          { stepId: "basics", label: "Basics", state: "pending" as const },
          { stepId: "inputs", label: "Inputs", state: "pending" as const },
        ]}
      ></lr-stepper>`
    )) as LyraStepper;
    const buttons = stepButtons(el);
    expect(buttons.map((b) => b.getAttribute("tabindex"))).to.deep.equal([
      "0",
      "-1",
    ]);
  });

  it("skips a leading disabled step when falling back roving tabindex", async () => {
    const el = (await fixture(
      html`<lr-stepper
        .steps=${[
          {
            stepId: "basics",
            label: "Basics",
            state: "completed" as const,
            disabled: true,
          },
          { stepId: "inputs", label: "Inputs", state: "pending" as const },
        ]}
      ></lr-stepper>`
    )) as LyraStepper;
    const buttons = stepButtons(el);
    expect(buttons.map((b) => b.getAttribute("tabindex"))).to.deep.equal([
      "-1",
      "0",
    ]);
  });

  it("rehomes focus to the roving fallback when the focused current step becomes disabled", async () => {
    const mutableSteps = steps();
    const el = (await fixture(
      html`<lr-stepper .steps=${mutableSteps}></lr-stepper>`
    )) as LyraStepper;
    stepButtons(el)[1]!.focus();
    const disabledSteps = mutableSteps.map((step, index) =>
      index === 1 ? { ...step, disabled: true } : step
    );
    el.steps = disabledSteps;
    await el.updateComplete;

    const focused = el.shadowRoot!.activeElement as HTMLElement | null;
    expect(focused?.dataset["stepId"]).to.equal("basics");
    expect(focused?.tabIndex).to.equal(0);
  });

  it("rehomes focus to the roving fallback when the focused current step is removed", async () => {
    const mutableSteps = steps();
    const el = (await fixture(
      html`<lr-stepper .steps=${mutableSteps}></lr-stepper>`
    )) as LyraStepper;
    stepButtons(el)[1]!.focus();
    el.steps = [mutableSteps[0]!, mutableSteps[2]!];
    await el.updateComplete;

    const focused = el.shadowRoot!.activeElement as HTMLElement | null;
    expect(focused?.dataset["stepId"]).to.equal("basics");
    expect(focused?.tabIndex).to.equal(0);
  });

  it("keeps focus on the roving current step when steps are reordered", async () => {
    const mutableSteps = steps();
    const el = (await fixture(
      html`<lr-stepper .steps=${mutableSteps}></lr-stepper>`
    )) as LyraStepper;
    stepButtons(el)[1]!.focus();
    el.steps = [mutableSteps[2]!, mutableSteps[0]!, mutableSteps[1]!];
    await el.updateComplete;

    const focused = el.shadowRoot!.activeElement as HTMLElement | null;
    expect(focused?.dataset["stepId"]).to.equal("inputs");
    expect(focused?.tabIndex).to.equal(0);
  });

  it("preserves focus on a surviving enabled non-current step when steps refresh", async () => {
    const mutableSteps = steps();
    const el = (await fixture(
      html`<lr-stepper .steps=${mutableSteps}></lr-stepper>`
    )) as LyraStepper;
    stepButtons(el)[2]!.focus();
    el.steps = [
      { ...mutableSteps[2]!, label: "Final review" },
      mutableSteps[0]!,
      mutableSteps[1]!,
    ];
    await el.updateComplete;

    const focused = el.shadowRoot!.activeElement as HTMLElement | null;
    expect(focused?.dataset["stepId"]).to.equal("review");
    expect(focused?.tabIndex).to.equal(-1);
  });

  it("fires a non-cancelable lr-step-select on click, without mutating steps itself", async () => {
    const el = (await fixture(
      html`<lr-stepper .steps=${steps()}></lr-stepper>`
    )) as LyraStepper;
    const buttons = stepButtons(el);
    setTimeout(() => buttons[2]!.click());
    const ev = await oneEvent(el, "lr-step-select");
    expect(ev.detail).to.deep.equal({ stepId: "review", index: 2 });
    // Not cancelable: this component is fully controlled (mirrors lr-table's columns/rows
    // contract) and never takes a default action of its own on selection, so there is no real
    // veto point for `preventDefault()` to gate -- see AGENTS.md's event convention.
    expect(ev.cancelable).to.be.false;
    expect(el.steps[1]!.state).to.equal("current"); // unchanged -- this component never self-mutates
  });

  it("renders a title attribute on a step that provides one", async () => {
    const el = (await fixture(
      html`<lr-stepper
        .steps=${[
          { stepId: "basics", label: "Basics", state: "completed" as const },
          {
            stepId: "inputs",
            label: "Inputs",
            state: "pending" as const,
            disabled: true,
            title: "Complete Basics first",
          },
        ]}
      ></lr-stepper>`
    )) as LyraStepper;
    const buttons = stepButtons(el);
    expect(buttons[1]!.getAttribute("title")).to.equal("Complete Basics first");
  });

  it("renders no title attribute for a step that omits one", async () => {
    const el = (await fixture(
      html`<lr-stepper .steps=${steps()}></lr-stepper>`
    )) as LyraStepper;
    const buttons = stepButtons(el);
    expect(buttons[0]!.hasAttribute("title")).to.be.false;
  });

  it("renders a step-icon part, additionally to the state chip/checkmark, for a step that provides an icon", async () => {
    const el = (await fixture(
      html`<lr-stepper
        .steps=${[
          {
            stepId: "payment",
            label: "Payment",
            state: "current" as const,
            icon: "\u{1F4B3}",
          },
          {
            stepId: "shipping",
            label: "Shipping",
            state: "completed" as const,
            icon: "\u{1F4E6}",
          },
          { stepId: "review", label: "Review", state: "pending" as const },
        ]}
      ></lr-stepper>`
    )) as LyraStepper;
    const buttons = stepButtons(el);

    const paymentIcon = buttons[0]!.querySelector('[part="step-icon"]');
    expect(
      paymentIcon !== null,
      "expected a step-icon part for the icon-bearing current step"
    ).to.equal(true);
    expect(paymentIcon!.textContent).to.equal("\u{1F4B3}");
    expect(paymentIcon!.getAttribute("aria-hidden")).to.equal("true");
    // The state chip still renders alongside the icon -- the icon identifies the topic, the chip
    // identifies the state.
    expect(buttons[0]!.querySelector('[part="step-index"]')).to.not.equal(null);

    const shippingIcon = buttons[1]!.querySelector('[part="step-icon"]');
    expect(
      shippingIcon !== null,
      "expected a step-icon part for the icon-bearing completed step"
    ).to.equal(true);
    expect(buttons[1]!.querySelector('[part="step-check"]')).to.not.equal(null);

    // No icon field at all -- no step-icon part rendered, byte-for-byte unaffected.
    expect(buttons[2]!.querySelector('[part="step-icon"]') === null).to.equal(
      true
    );
  });

  it("keeps rich step icons inert so the step button remains the only action", async () => {
    const el = (await fixture(
      html`<lr-stepper
        .steps=${[
          {
            stepId: "payment",
            label: "Payment",
            state: "current" as const,
            icon: html`<button id="step-icon-control" type="button">
              Payment graphic
            </button>`,
          },
        ]}
      ></lr-stepper>`
    )) as LyraStepper;
    const step = stepButtons(el)[0]!;
    const icon = step.querySelector<HTMLElement>('[part="step-icon"]');
    const iconControl =
      step.querySelector<HTMLButtonElement>("#step-icon-control");

    expect(icon !== null, "expected the rich icon wrapper").to.equal(true);
    expect(iconControl !== null, "expected the rich icon control").to.equal(
      true
    );
    expect(icon!.inert).to.equal(true);
    expect(icon!.getAttribute("aria-hidden")).to.equal("true");

    step.focus();
    iconControl!.focus();
    expect(el.shadowRoot!.activeElement?.getAttribute("data-step-id")).to.equal(
      "payment"
    );

    const selection = oneEvent(el, "lr-step-select");
    step.click();
    expect((await selection).detail).to.deep.equal({
      stepId: "payment",
      index: 0,
    });
    await expect(el).to.be.accessible();
  });

  it("does not fire lr-step-select for a disabled step", async () => {
    const el = (await fixture(
      html`<lr-stepper
        .steps=${[
          ...steps().slice(0, 2),
          {
            stepId: "review",
            label: "Review",
            state: "pending" as const,
            disabled: true,
          },
        ]}
      ></lr-stepper>`
    )) as LyraStepper;
    const buttons = stepButtons(el);
    let fired = false;
    el.addEventListener("lr-step-select", () => (fired = true));
    buttons[2]!.click();
    await el.updateComplete;
    expect(fired).to.be.false;
    expect(buttons[2]!.getAttribute("data-state")).to.equal("pending");
    expect(buttons[2]!.getAttribute("aria-disabled")).to.equal("true");
  });

  it("keeps current progress while independently disabling activation", async () => {
    const el = (await fixture(html`
      <lr-stepper
        .steps=${[
          {
            stepId: "current-locked",
            label: "Current but locked",
            state: "current" as const,
            disabled: true,
          },
          { stepId: "next", label: "Next", state: "pending" as const },
        ]}
      ></lr-stepper>
    `)) as LyraStepper;
    const buttons = stepButtons(el);
    expect(buttons[0]!.getAttribute("aria-current")).to.equal("step");
    expect(buttons[0]!.getAttribute("aria-disabled")).to.equal("true");
    expect(buttons[0]!.tabIndex).to.equal(-1);
    expect(buttons[1]!.tabIndex).to.equal(0);
  });

  it("supports ArrowRight/ArrowLeft/Home/End among non-disabled steps, clamped (not cyclic)", async () => {
    const el = (await fixture(
      html`<lr-stepper .steps=${steps()}></lr-stepper>`
    )) as LyraStepper;
    const buttons = stepButtons(el);
    buttons[1]!.focus();
    buttons[1]!.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "End",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    expect(
      (document.activeElement === el || el.shadowRoot!.activeElement) != null
    ).to.equal(true);
  });

  it("uses Up and Down to skip disabled steps in a vertical stepper, then selects the focused step", async () => {
    const el = (await fixture(html`
      <lr-stepper
        orientation="vertical"
        .steps=${[
          { stepId: "account", label: "Account", state: "completed" as const },
          { stepId: "details", label: "Details", state: "current" as const },
          {
            stepId: "locked",
            label: "Locked",
            state: "error" as const,
            disabled: true,
          },
          { stepId: "review", label: "Review", state: "pending" as const },
        ]}
      ></lr-stepper>
    `)) as LyraStepper;
    const buttons = stepButtons(el);

    buttons[1]!.focus();
    buttons[1]!.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        cancelable: true,
      })
    );
    expect(el.shadowRoot!.activeElement === buttons[3]).to.equal(true);

    buttons[3]!.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowUp",
        bubbles: true,
        cancelable: true,
      })
    );
    expect(el.shadowRoot!.activeElement === buttons[1]).to.equal(true);

    const selection = oneEvent(el, "lr-step-select");
    buttons[1]!.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      })
    );
    expect((await selection).detail).to.deep.equal({
      stepId: "details",
      index: 1,
    });
  });

  it("mirrors horizontal arrow navigation under RTL", async () => {
    const el = (await fixture(html`
      <lr-stepper
        dir="rtl"
        .steps=${[
          { stepId: "account", label: "Account", state: "current" as const },
          { stepId: "details", label: "Details", state: "pending" as const },
          { stepId: "review", label: "Review", state: "pending" as const },
        ]}
      ></lr-stepper>
    `)) as LyraStepper;
    const buttons = stepButtons(el);

    buttons[0]!.focus();
    buttons[0]!.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowLeft",
        bubbles: true,
        cancelable: true,
      })
    );
    expect(el.shadowRoot!.activeElement === buttons[1]).to.equal(true);

    buttons[1]!.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      })
    );
    expect(el.shadowRoot!.activeElement === buttons[0]).to.equal(true);
  });

  it("navigates to a step whose id contains characters that would break an unescaped CSS attribute selector", async () => {
    const el = (await fixture(
      html`<lr-stepper
        .steps=${[
          { stepId: "basics", label: "Basics", state: "current" as const },
          { stepId: 'inputs"]', label: "Inputs", state: "pending" as const },
        ]}
      ></lr-stepper>`
    )) as LyraStepper;
    const buttons = stepButtons(el);
    buttons[0]!.focus();
    expect(() =>
      buttons[0]!.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowRight",
          bubbles: true,
          cancelable: true,
        })
      )
    ).not.to.throw();
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement === buttons[1]).to.equal(true);
  });

  it("is accessible", async () => {
    const el = (await fixture(
      html`<lr-stepper .steps=${steps()}></lr-stepper>`
    )) as LyraStepper;
    await expect(el).to.be.accessible();
  });

  it("keeps labels single-line by default, and wraps them only for an opted-in vertical axis", async () => {
    const el = (await fixture(
      html`<lr-stepper orientation="vertical" .steps=${steps()}></lr-stepper>`
    )) as LyraStepper;
    const label = stepButtons(el)[0]!.querySelector('[part="step-label"]')!;
    expect(el.wrapLabels).to.be.false;
    expect(getComputedStyle(label).whiteSpace).to.equal("nowrap");

    el.wrapLabels = true;
    await el.updateComplete;
    expect(el.hasAttribute("wrap-labels")).to.be.true;
    expect(getComputedStyle(label).whiteSpace).to.equal("normal");
    expect(getComputedStyle(label).minInlineSize).to.equal("0px");
    expect(getComputedStyle(label).overflowWrap).to.equal("anywhere");

    el.orientation = "horizontal";
    await el.updateComplete;
    expect(getComputedStyle(label).whiteSpace).to.equal("nowrap");
  });

  it("follows the effective responsive axis when wrapping labels", async () => {
    const el = (await fixture(
      html`<lr-stepper
        wrap-labels
        orientation="horizontal"
        orientation-breakpoint="99999px"
        orientation-breakpoint-basis="viewport"
        .steps=${steps()}
      ></lr-stepper>`
    )) as LyraStepper;
    const label = stepButtons(el)[0]!.querySelector('[part="step-label"]')!;
    await el.updateComplete;
    expect(el.effectiveOrientation).to.equal("vertical");
    expect(getComputedStyle(label).whiteSpace).to.equal("normal");

    el.orientationBreakpoint = "1px";
    await el.updateComplete;
    expect(el.effectiveOrientation).to.equal("horizontal");
    expect(getComputedStyle(label).whiteSpace).to.equal("nowrap");
  });

  it("contains long unbroken vertical labels at an exact 320px allocation in LTR and RTL", async () => {
    const longLabel =
      "AnExtremelyLongUnbrokenLocalizedStepperLabelThatMustRemainContained".repeat(
        4
      );

    for (const direction of ["ltr", "rtl"] as const) {
      const wrapper = await fixture<HTMLElement>(html`
        <div
          dir=${direction}
          style="inline-size: 320px; max-inline-size: 100%;"
        >
          <lr-stepper
            orientation="vertical"
            wrap-labels
            style="inline-size: 100%;"
            .steps=${[
              { stepId: "account", label: longLabel, state: "completed" as const },
              { stepId: "review", label: longLabel, state: "current" as const },
            ]}
          ></lr-stepper>
        </div>
      `);
      const el = wrapper.querySelector("lr-stepper") as LyraStepper;
      await el.updateComplete;
      const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
      const baseBounds = base.getBoundingClientRect();

      expect(
        Math.round(el.getBoundingClientRect().width),
        `${direction} host width`
      ).to.equal(320);
      expect(
        base.scrollWidth,
        `${direction} base horizontal overflow`
      ).to.be.at.most(base.clientWidth + 1);
      for (const step of stepButtons(el)) {
        const label = step.querySelector('[part="step-label"]') as HTMLElement;
        const bounds = label.getBoundingClientRect();
        expect(
          label.scrollWidth,
          `${direction} label horizontal overflow`
        ).to.be.at.most(label.clientWidth + 1);
        expect(bounds.left, `${direction} label start`).to.be.at.least(
          baseBounds.left - 1
        );
        expect(bounds.right, `${direction} label end`).to.be.at.most(
          baseBounds.right + 1
        );
      }
    }
  });

  it('forwards a host aria-label to the role="list" element, and omits the attribute when unset', async () => {
    const el = (await fixture(
      html`<lr-stepper .steps=${steps()}></lr-stepper>`
    )) as LyraStepper;
    const list = el.shadowRoot!.querySelector('[role="list"]')!;
    expect(list.hasAttribute("aria-label")).to.be.false;

    el.setAttribute("aria-label", "Signup progress");
    await el.updateComplete;
    expect(el.accessibleLabel).to.equal("Signup progress");
    expect(list.getAttribute("aria-label")).to.equal("Signup progress");

    el.setAttribute("aria-label", "");
    await el.updateComplete;
    expect(list.hasAttribute("aria-label")).to.be.true;
    expect(list.getAttribute("aria-label")).to.equal("");
  });

  it("keeps exactly one roving stop and navigates by occurrence when step IDs are duplicated", async () => {
    const el = (await fixture(html`
      <lr-stepper
        .steps=${[
          { stepId: "same", label: "First", state: "current" as const },
          { stepId: "same", label: "Second", state: "pending" as const },
          { stepId: "other", label: "Third", state: "pending" as const },
        ]}
      ></lr-stepper>
    `)) as LyraStepper;
    let buttons = stepButtons(el);
    expect(buttons).to.have.length(3);
    expect(buttons.filter((button) => button.tabIndex === 0)).to.have.length(1);
    buttons[0]!.focus();
    buttons[0]!.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    buttons = stepButtons(el);
    expect(el.shadowRoot!.activeElement === buttons[1]).to.equal(true);
  });

  it("preserves focus on the same duplicate occurrence when steps refresh", async () => {
    const el = await fixture<LyraStepper>(html`
      <lr-stepper
        .steps=${[
          { stepId: "same", label: "First", state: "current" as const },
          { stepId: "same", label: "Second", state: "pending" as const },
          { stepId: "other", label: "Third", state: "pending" as const },
        ]}
      ></lr-stepper>
    `);
    stepButtons(el)[1]!.focus();

    el.steps = [
      { stepId: "same", label: "First refreshed", state: "current" },
      { stepId: "same", label: "Second refreshed", state: "pending" },
      { stepId: "other", label: "Third refreshed", state: "pending" },
    ];
    await el.updateComplete;

    expect(
      (el.shadowRoot!.activeElement as HTMLElement | null)?.dataset["index"]
    ).to.equal("1");
  });

  it("formats numbered step chips with the effective locale", async () => {
    const el = (await fixture(
      html`<lr-stepper locale="ar-EG" .steps=${steps()}></lr-stepper>`
    )) as LyraStepper;
    const index = stepButtons(el)[1]!.querySelector('[part="step-index"]')!;
    expect(index.textContent).to.equal(
      new Intl.NumberFormat("ar-EG").format(2)
    );
  });

  it("gives a non-disabled step a :hover treatment, matching the click-to-jump affordance", () => {
    const css = styles.cssText.replace(/\s+/g, " ").replaceAll('"', "'");
    // :where()-wrapped (see the "step hover specificity" describe block below) -- still targets
    // [part="step"]:hover, excluding aria-disabled="true" steps, just at zeroed specificity.
    expect(css).to.match(
      /:where\(\[part='step'\]\):hover:where\(:not\(\[aria-disabled='true'\]\)\)\s*\{[^}]+\}/
    );
  });

  it("switches the navigation axis from its own inline-size breakpoint and reports the effective orientation", async () => {
    const spy = installResizeObserverSpy();
    try {
      const el = (await fixture(
        html`<lr-stepper
          orientation-breakpoint="500"
          narrow-orientation="vertical"
          .steps=${steps()}
        ></lr-stepper>`
      )) as LyraStepper;
      await elementUpdated(el);
      expect(spy.callbacks.length).to.equal(BASELINE_OBSERVERS + 1);
      expect(el.effectiveOrientation).to.equal("horizontal"); // unmeasured yet -- assumes wide

      fireResizeAll(spy.callbacks, 320);
      await elementUpdated(el);
      expect(el.effectiveOrientation).to.equal("vertical");
      expect(el.getAttribute("data-effective-orientation")).to.equal(
        "vertical"
      );
      const list = el.shadowRoot!.querySelector('[role="list"]')!;
      expect(list.hasAttribute("aria-orientation")).to.be.false;
      const buttons = stepButtons(el);
      buttons[1]!.focus();
      buttons[1]!.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowDown",
          bubbles: true,
          cancelable: true,
        })
      );
      await elementUpdated(el);
      expect(el.shadowRoot!.activeElement === buttons[2]).to.equal(true);

      const changed = oneEvent(el, "lr-stepper-orientation-change");
      fireResizeAll(spy.callbacks, 700);
      expect((await changed).detail).to.deep.equal({
        orientation: "horizontal",
      });
      await elementUpdated(el);
      expect(el.effectiveOrientation).to.equal("horizontal");
      expect(list.hasAttribute("aria-orientation")).to.be.false;
    } finally {
      spy.restore();
    }
  });

  it("classifies effectiveOrientation correctly on the very first render under the default container basis, with no ResizeObserver round-trip needed", async () => {
    // Real (unmocked) width: [part="base"] is a block-level flex container with no width of its
    // own, so it fills this narrow inline style -- applied before the element ever connects, no
    // fireResize needed to prove the FIRST render already lands on 'vertical', not the
    // sentinel-derived 'horizontal'.
    const el = (await fixture(
      html`<lr-stepper
        orientation-breakpoint="500"
        narrow-orientation="vertical"
        style="display: block; inline-size: 300px"
        .steps=${steps()}
      ></lr-stepper>`
    )) as LyraStepper;
    await elementUpdated(el);
    expect(el.effectiveOrientation).to.equal("vertical");
    expect(el.getAttribute("data-effective-orientation")).to.equal("vertical");
  });

  it("keeps the authored orientation and no effective marker when no breakpoint is configured", async () => {
    const el = (await fixture(
      html`<lr-stepper orientation="vertical" .steps=${steps()}></lr-stepper>`
    )) as LyraStepper;
    await elementUpdated(el);
    expect(el.effectiveOrientation).to.equal("vertical");
    expect(el.hasAttribute("data-effective-orientation")).to.be.false;
  });

  it("exposes the resolved container-basis orientation breakpoint in pixels via the private accessor", async () => {
    const el = (await fixture(
      html`<lr-stepper
        orientation-breakpoint="500"
        .steps=${steps()}
      ></lr-stepper>`
    )) as LyraStepper;
    await elementUpdated(el);
    expect(
      (
        el as unknown as {
          orientationBreakpoints: { resolved: number | undefined };
        }
      ).orientationBreakpoints.resolved
    ).to.equal(500);

    el.orientationBreakpoint = "abc"; // unresolvable
    await elementUpdated(el);
    expect(
      (
        el as unknown as {
          orientationBreakpoints: { resolved: number | undefined };
        }
      ).orientationBreakpoints.resolved
    ).to.equal(undefined);
  });

  describe("orientationBreakpoint as a CSS length", () => {
    afterEach(() => {
      document.documentElement.style.fontSize = "";
    });

    /** Mounts a stepper with the given breakpoint and hands back the `ResizeObserver` callback it
     *  armed (or `undefined` when it armed none), so a test can drive synthetic widths. */
    async function mount(
      spy: ReturnType<typeof installResizeObserverSpy>,
      breakpoint: number | string
    ): Promise<{ el: LyraStepper; callbacks: ResizeObserverCallback[] }> {
      const before = spy.callbacks.length;
      const el = (await fixture(
        html`<lr-stepper
          orientation-breakpoint=${breakpoint}
          narrow-orientation="vertical"
          .steps=${steps()}
        ></lr-stepper>`
      )) as LyraStepper;
      await elementUpdated(el);
      return { el, callbacks: spy.callbacks.slice(before) };
    }

    it("crosses at the same measured width for a rem breakpoint as for the equivalent px number", async () => {
      document.documentElement.style.fontSize = "16px";
      const spy = installResizeObserverSpy({ inert: true });
      try {
        const rem = await mount(spy, "31.25rem"); // 31.25rem @ 16px root === 500px
        const px = await mount(spy, 500);
        expect(
          rem.callbacks.length,
          "a rem breakpoint must arm the resize observer"
        ).to.be.greaterThan(BASELINE_OBSERVERS);
        expect(px.callbacks.length).to.be.greaterThan(BASELINE_OBSERVERS);

        for (const { el, callbacks } of [rem, px]) {
          fireResizeAll(callbacks, 499);
          await elementUpdated(el);
          expect(el.effectiveOrientation).to.equal("vertical");
          expect(el.getAttribute("data-effective-orientation")).to.equal(
            "vertical"
          );

          fireResizeAll(callbacks, 500);
          await elementUpdated(el);
          expect(el.effectiveOrientation).to.equal("horizontal");
          expect(el.getAttribute("data-effective-orientation")).to.equal(
            "horizontal"
          );
        }
      } finally {
        spy.restore();
      }
    });

    it("keeps the bare-number form working identically, as an attribute and as a property", async () => {
      const spy = installResizeObserverSpy({ inert: true });
      try {
        const attr = await mount(spy, 500);

        const before = spy.callbacks.length;
        const prop = (await fixture(
          html`<lr-stepper
            narrow-orientation="vertical"
            .steps=${steps()}
          ></lr-stepper>`
        )) as LyraStepper;
        prop.orientationBreakpoint = 500;
        await elementUpdated(prop);
        const propCallbacks = spy.callbacks.slice(before);
        expect(
          propCallbacks.length,
          "a numeric property must arm the resize observer"
        ).to.be.greaterThan(BASELINE_OBSERVERS);

        for (const { el, callbacks } of [
          attr,
          { el: prop, callbacks: propCallbacks },
        ]) {
          fireResizeAll(callbacks, 320);
          await elementUpdated(el);
          expect(el.effectiveOrientation).to.equal("vertical");

          fireResizeAll(callbacks, 700);
          await elementUpdated(el);
          expect(el.effectiveOrientation).to.equal("horizontal");
        }
      } finally {
        spy.restore();
      }
    });

    it("moves the crossing width when the root font size changes, for a rem breakpoint", async () => {
      document.documentElement.style.fontSize = "16px";
      const spy = installResizeObserverSpy({ inert: true });
      try {
        const { el, callbacks } = await mount(spy, "31.25rem"); // 500px @ 16px root
        fireResizeAll(callbacks, 600);
        await elementUpdated(el);
        expect(el.effectiveOrientation).to.equal("horizontal"); // 600 >= 500

        document.documentElement.style.fontSize = "20px"; // 31.25rem is now 625px
        fireResizeAll(callbacks, 600);
        await elementUpdated(el);
        expect(el.effectiveOrientation).to.equal("vertical"); // 600 < 625 -- re-read, not frozen
      } finally {
        spy.restore();
      }
    });

    it("treats an unparseable breakpoint exactly as unset -- no observation, no effective marker", async () => {
      const spy = installResizeObserverSpy({ inert: true });
      try {
        const el = (await fixture(
          html`<lr-stepper
            orientation="horizontal"
            orientation-breakpoint="abc"
            narrow-orientation="vertical"
            .steps=${steps()}
          ></lr-stepper>`
        )) as LyraStepper;
        await elementUpdated(el);
        expect(
          spy.callbacks.length,
          "no responsive observation may be armed beyond the always-on overflow gate"
        ).to.equal(BASELINE_OBSERVERS);
        expect(el.effectiveOrientation).to.equal("horizontal");
        expect(el.hasAttribute("data-effective-orientation")).to.be.false;
      } finally {
        spy.restore();
      }
    });
  });

  describe("orientationBreakpointBasis", () => {
    it('defaults to "container", leaving committed behavior unchanged', async () => {
      const el = (await fixture(
        html`<lr-stepper .steps=${steps()}></lr-stepper>`
      )) as LyraStepper;
      expect(el.orientationBreakpointBasis).to.equal("container");
      expect(el.effectiveOrientation).to.equal("horizontal");
      expect(el.hasAttribute("data-effective-orientation")).to.be.false;
    });

    it("reflects the basis to an attribute", async () => {
      const el = (await fixture(html`
        <lr-stepper
          orientation-breakpoint="1px"
          orientation-breakpoint-basis="viewport"
          .steps=${steps()}
        ></lr-stepper>
      `)) as LyraStepper;
      await elementUpdated(el);
      expect(el.getAttribute("orientation-breakpoint-basis")).to.equal(
        "viewport"
      );
    });

    it('goes narrow under basis="viewport" when an absurdly large breakpoint always matches', async () => {
      const el = (await fixture(html`
        <lr-stepper
          orientation-breakpoint="99999px"
          orientation-breakpoint-basis="viewport"
          .steps=${steps()}
        ></lr-stepper>
      `)) as LyraStepper;
      await elementUpdated(el);
      expect(el.effectiveOrientation).to.equal("vertical");
      expect(el.getAttribute("data-effective-orientation")).to.equal(
        "vertical"
      );
    });

    it('ignores its own width entirely under basis="viewport"', async () => {
      // A stepper given a fixed narrow width in a row is exactly the filed case: its own
      // width never tracks the viewport, so only the media query can drive the flip.
      const wrapper = (await fixture(html`
        <div style="inline-size: 120px">
          <lr-stepper
            orientation-breakpoint="1px"
            orientation-breakpoint-basis="viewport"
            .steps=${steps()}
          ></lr-stepper>
        </div>
      `)) as HTMLElement;
      const stepper = wrapper.querySelector("lr-stepper") as LyraStepper;
      await elementUpdated(stepper);
      expect(stepper.effectiveOrientation).to.equal("horizontal");
    });

    it("re-queries matchMedia when the breakpoint changes at runtime", async () => {
      const el = (await fixture(html`
        <lr-stepper
          orientation-breakpoint="1px"
          orientation-breakpoint-basis="viewport"
          .steps=${steps()}
        ></lr-stepper>
      `)) as LyraStepper;
      await elementUpdated(el);
      expect(el.effectiveOrientation).to.equal("horizontal");
      el.orientationBreakpoint = "99999px";
      await elementUpdated(el);
      expect(
        el.effectiveOrientation,
        "a stale MediaQueryList would leave this horizontal"
      ).to.equal("vertical");
    });

    it("switches observation strategy when the basis changes at runtime", async () => {
      const el = (await fixture(html`
        <lr-stepper
          orientation-breakpoint="99999px"
          orientation-breakpoint-basis="viewport"
          .steps=${steps()}
        ></lr-stepper>
      `)) as LyraStepper;
      await elementUpdated(el);
      expect(el.effectiveOrientation).to.equal("vertical");
      el.orientationBreakpointBasis = "container";
      el.orientationBreakpoint = "1px";
      await elementUpdated(el);
      expect(
        el.effectiveOrientation,
        "container basis must consult the measured width"
      ).to.equal("horizontal");
    });

    it("emits lr-stepper-orientation-change when a viewport-basis change flips the axis", async () => {
      const el = (await fixture(html`
        <lr-stepper
          orientation-breakpoint="1px"
          orientation-breakpoint-basis="viewport"
          .steps=${steps()}
        ></lr-stepper>
      `)) as LyraStepper;
      await elementUpdated(el);
      setTimeout(() => {
        el.orientationBreakpoint = "99999px";
      });
      const event = await oneEvent(el, "lr-stepper-orientation-change");
      expect(event.detail.orientation).to.equal("vertical");
    });

    it('treats an unresolvable breakpoint as unset under basis="viewport"', async () => {
      const el = (await fixture(html`
        <lr-stepper
          orientation-breakpoint="80vw"
          orientation-breakpoint-basis="viewport"
          .steps=${steps()}
        ></lr-stepper>
      `)) as LyraStepper;
      await elementUpdated(el);
      expect(el.effectiveOrientation).to.equal("horizontal");
      expect(el.hasAttribute("data-effective-orientation")).to.be.false;
    });

    it("re-arms the media query after a disconnect/reconnect cycle", async () => {
      const el = (await fixture(html`
        <lr-stepper
          orientation-breakpoint="1px"
          orientation-breakpoint-basis="viewport"
          .steps=${steps()}
        ></lr-stepper>
      `)) as LyraStepper;
      await elementUpdated(el);
      el.remove();
      document.body.append(el);
      await elementUpdated(el);
      el.orientationBreakpoint = "99999px";
      await elementUpdated(el);
      expect(el.effectiveOrientation).to.equal("vertical");
      el.remove();
    });

    it("rebinds viewport breakpoints to the destination owner after adoption", async () => {
      const frame = (await fixture(
        html`<iframe></iframe>`
      )) as HTMLIFrameElement;
      const frameDocument = frame.contentDocument;
      const frameWindow = frame.contentWindow;
      if (!frameDocument || !frameWindow)
        throw new Error("The iframe realm was unavailable.");
      const ambient = installOwnerMatchMediaStub(window, 1000);
      const destination = installOwnerMatchMediaStub(frameWindow, 500);
      let el: LyraStepper | undefined;

      try {
        el = (await fixture(html`
          <lr-stepper
            orientation-breakpoint="600px"
            orientation-breakpoint-basis="viewport"
            .steps=${steps()}
          ></lr-stepper>
        `)) as LyraStepper;
        await elementUpdated(el);
        expect(el.effectiveOrientation).to.equal("horizontal");
        expect(ambient.queries).to.deep.equal(["(max-width: 600px)"]);

        frameDocument.adoptNode(el);
        frameDocument.body.append(el);
        await elementUpdated(el);
        expect(ambient.removed).to.deep.equal(["(max-width: 600px)"]);
        expect(destination.queries).to.deep.equal(["(max-width: 600px)"]);
        expect(el.effectiveOrientation).to.equal("vertical");
      } finally {
        el?.remove();
        destination.restore();
        ambient.restore();
        frame.remove();
      }
    });

    it("is accessible with a viewport-basis breakpoint set", async () => {
      const el = (await fixture(html`
        <lr-stepper
          orientation-breakpoint="99999px"
          orientation-breakpoint-basis="viewport"
          .steps=${steps()}
        ></lr-stepper>
      `)) as LyraStepper;
      await elementUpdated(el);
      await expect(el).to.be.accessible();
    });
  });
});

describe("horizontal step row overflow", () => {
  it("removes both decorative masks in forced-colors mode", () => {
    const css = styles.cssText.replace(/\s+/g, " ");
    expect(css).to.contain("@media (forced-colors: active)");
    const forcedColors = css.slice(
      css.indexOf("@media (forced-colors: active)")
    );
    expect(forcedColors).to.contain("-webkit-mask-image: none");
    expect(forcedColors).to.contain("mask-image: none");
  });

  it("pairs overflow-y with overflow-x on the horizontal (default) axis to avoid a phantom vertical scrollbar", async () => {
    const el = (await fixture(
      html`<lr-stepper .steps=${steps()}></lr-stepper>`
    )) as LyraStepper;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const computed = getComputedStyle(base);
    expect(computed.overflowX).to.equal("auto");
    expect(computed.overflowY).to.equal("hidden");
  });

  it('leaves overflow-x/-y both visible under orientation="vertical", with no leftover horizontal mask', async () => {
    const el = (await fixture(
      html`<lr-stepper orientation="vertical" .steps=${steps()}></lr-stepper>`
    )) as LyraStepper;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const computed = getComputedStyle(base);
    expect(computed.overflowX).to.equal("visible");
    expect(computed.overflowY).to.equal("visible");
    const maskImage =
      computed.getPropertyValue("mask-image") ||
      computed.getPropertyValue("-webkit-mask-image");
    expect(maskImage).to.equal("none");
  });

  it("shows a mask-image edge fade on the horizontally-scrolling step row once it overflows, matching lr-tab-group/lr-segmented", async () => {
    const el = (await fixture(
      html`<lr-stepper
        style="display: block; max-inline-size: 90px"
        .steps=${steps()}
      ></lr-stepper>`
    )) as LyraStepper;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
    expect(base.scrollWidth).to.be.greaterThan(base.clientWidth);
    const computed = getComputedStyle(base);
    const maskImage =
      computed.getPropertyValue("mask-image") ||
      computed.getPropertyValue("-webkit-mask-image");
    expect(maskImage).to.not.equal("none");
    expect(maskImage).to.contain("gradient");
  });

  it("keeps the edge fade opaque when a consumer themes the shadow color translucent", async () => {
    // The regression this guards: the mask's opaque stops used to be var(--lr-color-shadow), a
    // documented consumer theming input. A mask reads alpha only, so a translucent shadow theme
    // dropped mask alpha across the whole step row rather than just its edges.
    const el = (await fixture(
      html`<lr-stepper
        style="display: block; max-inline-size: 90px; --lr-theme-color-shadow: rgb(0 0 0 / 0.25)"
        .steps=${steps()}
      ></lr-stepper>`
    )) as LyraStepper;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
    const computed = getComputedStyle(base);
    const maskImage =
      computed.getPropertyValue("mask-image") ||
      computed.getPropertyValue("-webkit-mask-image");
    expect(maskImage).to.contain("gradient");
    expect(maskImage).to.not.contain("0.25");
  });

  it("leaves a horizontal step row that fits completely unmasked", async () => {
    // The regression this guards: the fade used to be painted unconditionally, dimming the first
    // and last step of a row with nothing to scroll to.
    const el = (await fixture(
      html`<lr-stepper .steps=${steps()}></lr-stepper>`
    )) as LyraStepper;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
    expect(base.scrollWidth - base.clientWidth).to.be.at.most(1);
    const computed = getComputedStyle(base);
    const maskImage =
      computed.getPropertyValue("mask-image") ||
      computed.getPropertyValue("-webkit-mask-image");
    expect(maskImage).to.equal("none");
  });

  it("flips the edge fade on once a step's own content grows, without any host update or [part=\"base\"] resize/scroll", async () => {
    // The gap this guards: ScrollOverflowController's plain ResizeObserver only watches
    // [part="base"]'s own border box. A step's content (a long localized label swapped in, a web
    // font finishing its swap, an icon loading) can grow scrollWidth without base's own box
    // changing at all -- [part="base"] is a block-level flex container with no width of its own
    // (see stepper.styles.ts), so `max-inline-size` genuinely pins its own border box regardless
    // of content, unlike a shrink-to-fit `inline-flex` box that would just grow along with it.
    // `scrollbar-width: none` additionally removes the classic scrollbar's own reserved
    // block-axis space, so the fits -> overflows transition itself cannot change base's
    // clientHeight and spuriously re-trigger the existing plain ResizeObserver for an unrelated
    // reason. Leaving `scrollLeft` untouched at its default `0` avoids Chromium re-firing a
    // genuine native `scroll` event whenever an overflowing track's `scrollWidth` changes while
    // scrolled away from position `0` -- itself a real, useful side effect of this fix's new
    // scroll listener, but not the one this test targets. Growing the step via an explicit
    // flex-basis (rather than appending text, which [part="step"]'s `flex: 0 0 auto` already
    // resists but a nested label span might not) gives a deterministic box growth, matching
    // `<lr-timeline-item style="flex: 0 0 200px">` in timeline.test.ts. Setting it directly on
    // the rendered step (bypassing the `steps` property, so no Lit re-render/hostUpdated() run
    // happens either) isolates the ResizeObserver path from the synchronous hostUpdated()
    // measurement.
    const el = (await fixture(
      html`<lr-stepper
        style="display: block; max-inline-size: 280px"
        .steps=${steps()}
      ></lr-stepper>`
    )) as LyraStepper;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.style.scrollbarWidth = "none";
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
    expect(
      base.scrollWidth - base.clientWidth,
      "sanity check: the row must fit before the content grows"
    ).to.be.at.most(1);
    expect(base.hasAttribute("data-scroll-overflow")).to.be.false;

    const clientWidthBefore = base.clientWidth;
    const clientHeightBefore = base.clientHeight;

    const lastStep = stepButtons(el).at(-1)!;
    lastStep.style.flex = "0 0 400px";
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );

    expect(
      base.clientWidth,
      "sanity check: base's own inline border box must not have changed"
    ).to.equal(clientWidthBefore);
    expect(
      base.clientHeight,
      "sanity check: base's own block border box must not have changed either"
    ).to.equal(clientHeightBefore);
    expect(base.scrollLeft, "sanity check: never programmatically scrolled").to.equal(0);
    expect(base.scrollWidth).to.be.greaterThan(base.clientWidth);
    expect(base.hasAttribute("data-scroll-overflow")).to.be.true;
    const computed = getComputedStyle(base);
    const maskImage =
      computed.getPropertyValue("mask-image") ||
      computed.getPropertyValue("-webkit-mask-image");
    expect(maskImage).to.contain("gradient");
  });

  it("fades only the reachable logical edge, RTL-aware, instead of dimming an edge already fully in view", async () => {
    for (const direction of ["ltr", "rtl"] as const) {
      const el = (await fixture(
        html`<lr-stepper
          dir=${direction}
          style="display: block; max-inline-size: 90px"
          .steps=${steps()}
        ></lr-stepper>`
      )) as LyraStepper;
      const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      );
      expect(base.scrollWidth, `${direction} sanity: must overflow`).to.be.greaterThan(
        base.clientWidth
      );
      expect(base.hasAttribute("data-scroll-start"), `${direction} initial start`).to.be
        .false;
      expect(base.hasAttribute("data-scroll-end"), `${direction} initial end`).to.be.true;

      const maximum = base.scrollWidth - base.clientWidth;
      base.scrollLeft = direction === "rtl" ? -maximum : maximum;
      base.dispatchEvent(new Event("scroll"));
      expect(base.hasAttribute("data-scroll-start"), `${direction} final start`).to.be
        .true;
      expect(base.hasAttribute("data-scroll-end"), `${direction} final end`).to.be.false;
    }
  });

  it("actually renders no mask under forced colors, in both LTR and RTL, while only one logical edge is reachable", async () => {
    // Stylesheet-text substring checks (the test above) cannot catch a specificity regression:
    // the one-sided mask rules use more attribute selectors (higher specificity) than the
    // forced-colors override's plain [data-scroll-overflow] selector, so without the
    // :where()-wrapping that keeps their specificity pinned to that baseline, the gradient mask
    // would keep winning the cascade even under forced-colors. Assert the real computed style.
    try {
      await setForcedColors("active");
      for (const direction of ["ltr", "rtl"] as const) {
        const el = (await fixture(
          html`<lr-stepper
            dir=${direction}
            style="display: block; max-inline-size: 90px"
            .steps=${steps()}
          ></lr-stepper>`
        )) as LyraStepper;
        const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve))
        );
        expect(base.hasAttribute("data-scroll-overflow"), `${direction} sanity: overflowing`)
          .to.be.true;
        expect(base.hasAttribute("data-scroll-end"), `${direction} sanity: one-sided state`)
          .to.be.true;
        const computed = getComputedStyle(base);
        const maskImage =
          computed.getPropertyValue("mask-image") ||
          computed.getPropertyValue("-webkit-mask-image");
        expect(maskImage, `${direction} forced-colors mask`).to.equal("none");
      }
    } finally {
      await setForcedColors("none");
    }
  });
});

describe("step hover specificity", () => {
  it('the internal [part="step"]:hover rule is :where()-wrapped, so a consumer ::part(step):hover override wins without needing !important', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div>
        <style>
          lr-stepper::part(step):hover {
            background-color: rgb(7, 8, 9);
          }
        </style>
        <lr-stepper
          style="--lr-transition-fast: 0ms"
          .steps=${steps()}
        ></lr-stepper>
      </div>
    `);
    const el = wrapper.querySelector("lr-stepper") as LyraStepper;
    const target = stepButtons(el)[2]!;
    const rect = target.getBoundingClientRect();
    try {
      await resetMouse();
      await sendMouse({
        type: "move",
        position: [
          Math.round(rect.left + rect.width / 2),
          Math.round(rect.top + rect.height / 2),
        ],
      });
      await waitUntil(
        () => getComputedStyle(target).backgroundColor === "rgb(7, 8, 9)",
        "consumer step hover background did not win"
      );
      expect(getComputedStyle(target).backgroundColor).to.equal("rgb(7, 8, 9)");
    } finally {
      await resetMouse();
    }
  });
});

describe("state-styling cssprops", () => {
  /** Resolves what a `declaration` would compute to *inside this component's shadow root*, where the
   *  `--lr-*` design tokens actually live. Used to assert the unset defaults byte-for-byte against
   *  the tokens they fall back to. */
  function resolvedInShadow(
    el: LyraStepper,
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

  const themedSteps = () => [
    { stepId: "basics", label: "Basics", state: "completed" as const },
    { stepId: "inputs", label: "Inputs", state: "current" as const },
    { stepId: "oops", label: "Oops", state: "error" as const },
    { stepId: "review", label: "Review", state: "pending" as const },
  ];

  const overrides =
    "--lr-stepper-current-color: rgb(0, 51, 102);" +
    "--lr-stepper-current-font-weight: 900;" +
    "--lr-stepper-error-color: rgb(102, 0, 0);" +
    "--lr-stepper-current-index-bg: rgb(10, 20, 30);" +
    "--lr-stepper-current-index-color: rgb(200, 210, 220);";

  async function themed(style: string): Promise<LyraStepper> {
    const wrapper = (await fixture(
      html`<div style=${style}>
        <lr-stepper .steps=${themedSteps()}></lr-stepper>
      </div>`
    )) as HTMLElement;
    const el = wrapper.querySelector("lr-stepper") as LyraStepper;
    await el.updateComplete;
    return el;
  }

  function stepEl(el: LyraStepper, state: string): HTMLElement {
    return el.shadowRoot!.querySelector(
      `[part="step"][data-state="${state}"]`
    ) as HTMLElement;
  }

  it("recolors current/error steps and the current index chip from an ancestor, not a :host-declared prop", async () => {
    const el = await themed(overrides);
    const current = stepEl(el, "current");
    const error = stepEl(el, "error");
    const currentIndex = current.querySelector('[part="step-index"]')!;
    expect(getComputedStyle(current).color).to.equal("rgb(0, 51, 102)");
    // The current step's font-weight has its own dedicated cssprop, decoupled from the shared
    // --lr-font-weight-semibold token every other semibold-weighted element in the page also
    // reads -- retheming it must not repaint any of those.
    expect(getComputedStyle(current).fontWeight).to.equal("900");
    expect(getComputedStyle(error).color).to.equal("rgb(102, 0, 0)");
    expect(getComputedStyle(currentIndex).backgroundColor).to.equal(
      "rgb(10, 20, 30)"
    );
    expect(getComputedStyle(currentIndex).color).to.equal("rgb(200, 210, 220)");
  });

  it("renders byte-identically to the pre-cssprop output when the props are unset", async () => {
    const el = await themed("");
    const current = stepEl(el, "current");
    const error = stepEl(el, "error");
    const currentIndex = current.querySelector('[part="step-index"]')!;
    expect(getComputedStyle(current).color).to.equal(
      resolvedInShadow(el, "color: var(--lr-color-text)", "color")
    );
    expect(getComputedStyle(current).fontWeight).to.equal(
      resolvedInShadow(
        el,
        "font-weight: var(--lr-font-weight-semibold)",
        "font-weight"
      )
    );
    expect(getComputedStyle(error).color).to.equal(
      resolvedInShadow(el, "color: var(--lr-color-danger)", "color")
    );
    expect(getComputedStyle(currentIndex).backgroundColor).to.equal(
      resolvedInShadow(
        el,
        "background: var(--lr-color-brand)",
        "background-color"
      )
    );
    expect(getComputedStyle(currentIndex).color).to.equal(
      resolvedInShadow(el, "color: var(--lr-color-on-brand)", "color")
    );
  });

  it("inherits independent hover and active longhands from an ancestor without recoloring stateful siblings", async () => {
    const el = await themed(
      "--lr-stepper-hover-bg: rgb(1, 2, 3);" +
        "--lr-stepper-hover-color: rgb(4, 5, 6);" +
        "--lr-stepper-active-bg: rgb(7, 8, 9);" +
        "--lr-stepper-active-color: rgb(10, 11, 12);"
    );
    const hovered = stepEl(el, "completed");
    const current = stepEl(el, "current");
    const error = stepEl(el, "error");

    hovered.scrollIntoView();
    const rect = hovered.getBoundingClientRect();
    try {
      await resetMouse();
      await sendMouse({
        type: "move",
        position: [
          Math.round(rect.left + rect.width / 2),
          Math.round(rect.top + rect.height / 2),
        ],
      });
      expect(getComputedStyle(hovered).backgroundColor).to.equal(
        "rgb(1, 2, 3)"
      );
      expect(getComputedStyle(hovered).color).to.equal("rgb(4, 5, 6)");

      await sendMouse({ type: "down" });
      await waitUntil(() => getComputedStyle(hovered).backgroundColor === "rgb(7, 8, 9)", 'hovered background color never reached "rgb(7, 8, 9)"');
      expect(getComputedStyle(hovered).color).to.equal("rgb(10, 11, 12)");
      expect(getComputedStyle(current).backgroundColor).to.equal(
        "rgba(0, 0, 0, 0)"
      );
      expect(getComputedStyle(current).color).to.equal(
        resolvedInShadow(el, "color: var(--lr-color-text)", "color")
      );
      expect(getComputedStyle(error).color).to.equal(
        resolvedInShadow(el, "color: var(--lr-color-danger)", "color")
      );
    } finally {
      await resetMouse();
    }
  });

  it("retains the existing hover and active renderings when the new props are unset", async () => {
    const el = await themed("");
    const interactive = stepEl(el, "completed");

    interactive.scrollIntoView();
    const rect = interactive.getBoundingClientRect();
    try {
      await resetMouse();
      await sendMouse({
        type: "move",
        position: [
          Math.round(rect.left + rect.width / 2),
          Math.round(rect.top + rect.height / 2),
        ],
      });
      expect(getComputedStyle(interactive).backgroundColor).to.equal(
        resolvedInShadow(
          el,
          "background: var(--lr-color-brand-quiet)",
          "background-color"
        )
      );
      expect(getComputedStyle(interactive).color).to.equal(
        resolvedInShadow(el, "color: var(--lr-color-text)", "color")
      );

      await sendMouse({ type: "down" });
      await waitUntil(() => getComputedStyle(interactive).backgroundColor === resolvedInShadow( el, "background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active))", "background-color" ), 'interactive background color never reached its pressed value');
      expect(getComputedStyle(interactive).color).to.equal(
        resolvedInShadow(el, "color: var(--lr-color-text)", "color")
      );
    } finally {
      await resetMouse();
    }
  });

  it("is accessible with the state-styling props themed", async () => {
    const el = await themed(overrides);
    await expect(el).to.be.accessible();
  });
});
