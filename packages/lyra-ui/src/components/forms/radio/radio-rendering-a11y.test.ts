import { resolvedInShadow } from '../../../../test/shadow-style.js';
// Focused rendering and accessibility cases. Test bodies and titles were moved intact from the prior suite.
import { fixture, expect, html, oneEvent, waitUntil } from "@open-wc/testing";
import "./radio.js";
import "./radio-button.js";
import "./radio-group.js";
import type { LyraRadio } from "./radio.js";
import type { LyraRadioGroup } from "./radio-group.js";
import { hoverUntilMatched, resetMouse, sendMouse } from "../../../../test/wtr-mouse.js";

it("contains a standalone unbroken label at 320px in LTR and RTL", async () => {
  const label =
    "InternationalizedStandaloneRadioLabelWithoutAnyNaturalBreakOpportunity";
  for (const direction of ["ltr", "rtl"] as const) {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div dir=${direction} style="inline-size: 320px; max-inline-size: 320px">
        <lr-radio value="choice">${label}</lr-radio>
      </div>
    `);
    const radio = wrapper.querySelector("lr-radio")!;
    expect(wrapper.scrollWidth, `dir=${direction} wrapper`).to.be.at.most(
      wrapper.clientWidth
    );
    expect(
      radio.getBoundingClientRect().width,
      `dir=${direction} host`
    ).to.be.at.most(wrapper.getBoundingClientRect().width);
  }
});

it("applies group required and disabled states when server rendering provides no light-DOM query API", () => {
  const group = document.createElement("lr-radio-group") as LyraRadioGroup;
  let requiredError = "";
  let disabledError = "";
  let wasMissing = false;
  let wasBarred = false;

  Object.defineProperty(group, "querySelectorAll", {
    configurable: true,
    value: undefined,
  });
  try {
    try {
      group.required = true;
    } catch (error) {
      requiredError = error instanceof Error ? error.message : String(error);
    }
    wasMissing = group.validity.valueMissing;

    try {
      group.disabled = true;
    } catch (error) {
      disabledError = error instanceof Error ? error.message : String(error);
    }
    wasBarred = !group.validity.valueMissing;
  } finally {
    delete (
      group as unknown as { querySelectorAll?: ParentNode["querySelectorAll"] }
    ).querySelectorAll;
  }

  expect(
    requiredError,
    "the required setter must not require browser light-DOM traversal"
  ).to.equal("");
  expect(
    disabledError,
    "the disabled setter must not require browser light-DOM traversal"
  ).to.equal("");
  expect(wasMissing, "required still computes the empty-group violation").to.be
    .true;
  expect(wasBarred, "disabled still bars the required violation").to.be.true;
});

it("renders radio semantics and explicit false states", async () => {
  const el = (await fixture(html`<lr-radio>One</lr-radio>`)) as LyraRadio;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.getAttribute("role")).to.equal("radio");
  expect(base.getAttribute("aria-checked")).to.equal("false");
  expect(base.getAttribute("aria-disabled")).to.equal("false");
  expect(base.getAttribute("aria-required")).to.equal("false");
  await expect(el).to.be.accessible();
});

it("preserves an explicitly empty host aria-label on both internal radio appearances", async () => {
  for (const appearance of ["default", "button"] as const) {
    const el = (await fixture(html`
      <lr-radio aria-label="" appearance=${appearance}>Visible label</lr-radio>
    `)) as LyraRadio;
    const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    expect(base.hasAttribute("aria-label"), appearance).to.be.true;
    expect(base.getAttribute("aria-label"), appearance).to.equal("");
  }
});

it('accepts appearance="button" on lr-radio and exports both WA and Shoelace parts', async () => {
  const el = (await fixture(html`
    <lr-radio appearance="button" value="pro" checked>Pro</lr-radio>
  `)) as LyraRadio & { appearance: "default" | "button" };
  const button = el.shadowRoot!.querySelector(
    '[part~="button"]'
  ) as HTMLElement;
  expect(el.appearance).to.equal("button");
  expect(button.getAttribute("role")).to.equal("radio");
  expect(button.getAttribute("aria-checked")).to.equal("true");
  expect(button.getAttribute("part")!.split(/\s+/)).to.include.members([
    "base",
    "button",
    "button--checked",
    "control",
  ]);
  expect(el.shadowRoot!.querySelector('[part~="circle"]') === null).to.equal(
    true
  );
  await expect(el).to.be.accessible();
});

it("renders disabled and required button-radio states on its interactive surface", async () => {
  const el = (await fixture(html`
    <lr-radio appearance="button" disabled required>Pro</lr-radio>
  `)) as LyraRadio & { appearance: "default" | "button" };
  const button = el.shadowRoot!.querySelector(
    '[part~="button"]'
  ) as HTMLElement;

  expect(button.getAttribute("part")!.split(/\s+/)).to.include.members([
    "base",
    "button",
    "control",
    "disabled",
  ]);
  expect(button.getAttribute("tabindex")).to.equal("-1");
  expect(button.getAttribute("aria-checked")).to.equal("false");
  expect(button.getAttribute("aria-disabled")).to.equal("true");
  expect(button.getAttribute("aria-required")).to.equal("true");
});

it("exports control/checked-icon aliases in the default radio appearance", async () => {
  const el = (await fixture(
    html`<lr-radio checked>Choice</lr-radio>`
  )) as LyraRadio;
  const control = el.shadowRoot!.querySelector(
    '[part~="control"]'
  ) as HTMLElement;
  const icon = el.shadowRoot!.querySelector(
    '[part~="checked-icon"]'
  ) as HTMLElement;
  expect(control.getAttribute("part")!.split(/\s+/)).to.include.members([
    "circle",
    "control",
    "control--checked",
  ]);
  expect(icon.getAttribute("part")!.split(/\s+/)).to.include.members([
    "dot",
    "checked-icon",
  ]);
});

it("updates label presence when a direct slotted descendant mutates in place", async () => {
  const el = (await fixture(html`<lr-radio></lr-radio>`)) as LyraRadio;
  const assigned = el.ownerDocument.createTextNode(" ");
  el.append(assigned);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  expect(label.hidden).to.be.true;

  assigned.data = "Direct radio label";
  await new Promise((resolve) => setTimeout(resolve, 0));
  await el.updateComplete;
  expect(label.hidden).to.be.false;
});

it("tracks visual label presence through a forwarding slot without exposing its fallback", async () => {
  const wrapper = (await fixture(html`<div></div>`)) as HTMLDivElement;
  const assigned = wrapper.ownerDocument.createTextNode(" ");
  wrapper.append(assigned);
  const root = wrapper.attachShadow({ mode: "open" });
  root.innerHTML = `
    <lr-radio aria-label="Explicit radio name">
      <slot><span>Unrendered fallback</span></slot>
    </lr-radio>
  `;
  const el = root.querySelector("lr-radio") as LyraRadio;
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  const settle = async (): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;
  };

  await settle();
  expect(
    label.hidden,
    "an empty assignment suppresses both itself and slot fallback"
  ).to.be.true;
  expect(base.getAttribute("aria-label")).to.equal("Explicit radio name");

  assigned.data = "Forwarded radio label";
  await settle();
  expect(label.hidden).to.be.false;

  assigned.data = " ";
  await settle();
  expect(label.hidden).to.be.true;

  const visual = wrapper.ownerDocument.createElement("span");
  visual.setAttribute("aria-label", "Screen-reader override");
  assigned.replaceWith(visual);
  await settle();
  expect(
    label.hidden,
    "an element-only visual such as an icon keeps the wrapper"
  ).to.be.false;

  visual.textContent = "Decorative visual glyph";
  visual.setAttribute("aria-hidden", " TRUE ");
  await settle();
  expect(label.hidden, "aria-hidden content can still be intentionally visual")
    .to.be.false;

  visual.removeAttribute("aria-hidden");
  visual.style.display = "none";
  await settle();
  expect(label.hidden).to.be.false;

  visual.style.removeProperty("display");
  visual.hidden = true;
  await settle();
  expect(label.hidden).to.be.false;

  visual.hidden = false;
  await settle();
  expect(label.hidden).to.be.false;
  expect(
    base.getAttribute("aria-label"),
    "consumer host naming remains authoritative"
  ).to.equal("Explicit radio name");
});

it("constructs its label observer in the adopted owner realm", async () => {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const frameWindow = frame.contentWindow!;
  const frameDocument = frame.contentDocument!;
  const observerDescriptor = Object.getOwnPropertyDescriptor(
    frameWindow,
    "MutationObserver"
  );
  const NativeMutationObserver = frameWindow.MutationObserver;
  let constructions = 0;
  let adoptedTarget: LyraRadio | undefined;
  let labelHostObservations = 0;
  class TrackingMutationObserver extends NativeMutationObserver {
    constructor(callback: MutationCallback) {
      super(callback);
      constructions += 1;
    }
    override observe(target: Node, options?: MutationObserverInit): void {
      if (
        target === adoptedTarget &&
        options?.childList &&
        options.characterData &&
        options.subtree
      )
        labelHostObservations += 1;
      super.observe(target, options);
    }
  }
  Object.defineProperty(frameWindow, "MutationObserver", {
    configurable: true,
    value: TrackingMutationObserver,
  });
  const el = (await fixture(
    html`<lr-radio><span>Parent label</span></lr-radio>`
  )) as LyraRadio;
  adoptedTarget = el;
  el.remove();
  try {
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;
    expect(constructions).to.be.greaterThan(1);
    expect(labelHostObservations).to.be.greaterThan(0);
    expect(
      (el.shadowRoot!.querySelector('[part="label"]') as HTMLElement).hidden
    ).to.be.false;
  } finally {
    el.remove();
    if (observerDescriptor) {
      Object.defineProperty(
        frameWindow,
        "MutationObserver",
        observerDescriptor
      );
    } else {
      Reflect.deleteProperty(frameWindow, "MutationObserver");
    }
    frame.remove();
  }
});

it("exposes an accessible name for the radiogroup from its visible label", async () => {
  const group = (await fixture(html`
    <lr-radio-group label="Choice">
      <lr-radio value="a">A</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  const base = group.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const labelId = base.getAttribute("aria-labelledby");
  expect(labelId).to.be.ok;
  expect(group.shadowRoot!.getElementById(labelId!)?.textContent).to.contain(
    "Choice"
  );
});

it("preserves an explicitly empty host aria-label instead of restoring the visible group label", async () => {
  const group = (await fixture(html`
    <lr-radio-group aria-label="" label="Choice">
      <lr-radio value="a">A</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  const base = group.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.hasAttribute("aria-label")).to.equal(true);
  expect(base.getAttribute("aria-label")).to.equal("");
  expect(base.hasAttribute("aria-labelledby")).to.equal(false);
});

it("dims the base part via the :disabled pseudo-class when disabled only through an ancestor fieldset", async () => {
  // effectiveDisabled correctly gates the internal control's functional
  // disabling even when disabled purely by fieldset cascading (see the test
  // above), but that alone doesn't prove the *visual* treatment follows --
  // the base part's opacity/cursor styling is keyed off a CSS selector
  // (:host(:disabled)), not effectiveDisabled, so it needs its own
  // assertion. Mirrors lr-checkbox's identical fieldset/computed-style
  // coverage.
  const form = (await fixture(html`
    <form>
      <fieldset disabled>
        <lr-radio value="a">A</lr-radio>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-radio") as LyraRadio;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;

  expect(el.disabled).to.be.false;
  expect(el.effectiveDisabled).to.be.true;
  expect(getComputedStyle(base).opacity).to.equal("0.5");
  expect(getComputedStyle(base).cursor).to.equal("not-allowed");
});

it("wires hint/error text to aria-describedby on the radiogroup", async () => {
  const group = (await fixture(html`
    <lr-radio-group label="Choice">
      <lr-radio value="a">A</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  const base = group.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.hasAttribute("aria-describedby")).to.be.false;

  group.hint = "Pick one";
  await group.updateComplete;
  const hintId = group.shadowRoot!.querySelector('[part~="hint"]')!.id;
  expect(hintId).to.be.ok;
  expect(base.getAttribute("aria-describedby")).to.equal(hintId);

  group.errorText = "Selection required";
  await group.updateComplete;
  const errorId = group.shadowRoot!.querySelector('[part="error"]')!.id;
  expect(errorId).to.be.ok;
  expect(base.getAttribute("aria-invalid")).to.equal("true");
  expect(base.getAttribute("aria-describedby")).to.equal(
    `${hintId} ${errorId}`
  );
});

it("renders a required-asterisk on the radiogroup label", async () => {
  const group = (await fixture(html`
    <lr-radio-group label="Choice" required>
      <lr-radio value="a">A</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  const label = group.shadowRoot!.querySelector(
    '[part~="label"]'
  ) as HTMLElement;
  const after = getComputedStyle(label, "::after");
  expect(after.content).to.contain("*");
});

it("owns only radios in its default option slot, excluding support subtrees and nested groups", async () => {
  const outer = (await fixture(html`
    <lr-radio-group name="outer" disabled required>
      <lr-radio value="outer" name="author">Outer</lr-radio>
      <div slot="hint">
        <lr-radio value="helper" name="helper-name">Helper</lr-radio>
      </div>
      <lr-radio-group name="inner">
        <lr-radio value="inner" name="inner-name">Inner</lr-radio>
      </lr-radio-group>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  const outerRadio = outer.querySelector(":scope > lr-radio") as LyraRadio;
  const helper = outer.querySelector('[slot="hint"] lr-radio') as LyraRadio;
  const inner = outer.querySelector(
    ":scope > lr-radio-group lr-radio"
  ) as LyraRadio;
  await outer.updateComplete;

  expect(outerRadio.effectiveDisabled).to.be.true;
  expect(outerRadio.name).to.equal("author");
  expect(outerRadio.effectiveName).to.equal("outer");
  expect(helper.effectiveDisabled, "a support-slot control remains standalone")
    .to.be.false;
  expect(helper.name).to.equal("helper-name");
  expect(inner.effectiveDisabled, "a nested group owns its own radio").to.be
    .false;
  expect(inner.name).to.equal("inner-name");
  expect(inner.effectiveName).to.equal("inner");

  helper.click();
  expect(helper.checked, "an excluded support radio still selects itself").to.be
    .true;
});

it("projects effective group name and size without overwriting late authored child state", async () => {
  const wrapper = await fixture(html`
    <div>
      <lr-radio-group name="aggregate" size="l">
        <lr-radio name="author" size="s" value="a">A</lr-radio>
      </lr-radio-group>
    </div>
  `);
  const group = wrapper.querySelector("lr-radio-group") as LyraRadioGroup;
  const radio = group.querySelector("lr-radio") as LyraRadio;
  await Promise.all([group.updateComplete, radio.updateComplete]);
  expect(radio.name).to.equal("author");
  expect(radio.size).to.equal("s");
  expect(radio.effectiveName).to.equal("aggregate");
  expect(radio.effectiveSize).to.equal("l");

  radio.name = "late-author";
  radio.size = "xs";
  await Promise.all([group.updateComplete, radio.updateComplete]);
  expect(radio.name).to.equal("late-author");
  expect(radio.size).to.equal("xs");
  expect(radio.effectiveName).to.equal("aggregate");
  expect(radio.effectiveSize).to.equal("l");

  wrapper.append(radio);
  await radio.updateComplete;
  expect(radio.effectiveName).to.equal("late-author");
  expect(radio.effectiveSize).to.equal("xs");
});

it("keeps the 2xs label-less radio role owner at the shared target floor while centering the compact circle", async () => {
  const el = (await fixture(
    html`<lr-radio size="2xs" aria-label="Select option"></lr-radio>`
  )) as LyraRadio;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const circle = el.shadowRoot!.querySelector(
    '[part~="circle"]'
  ) as HTMLElement;
  const baseBounds = base.getBoundingClientRect();
  const circleBounds = circle.getBoundingClientRect();

  expect(base.getAttribute("role")).to.equal("radio");
  expect(baseBounds.width).to.be.at.least(36);
  expect(baseBounds.height).to.be.at.least(36);
  expect(circleBounds.width).to.be.closeTo(14, 0.5);
  expect(circleBounds.height).to.be.closeTo(14, 0.5);
  expect(circleBounds.left + circleBounds.width / 2).to.be.closeTo(
    baseBounds.left + baseBounds.width / 2,
    0.5
  );
  expect(circleBounds.top + circleBounds.height / 2).to.be.closeTo(
    baseBounds.top + baseBounds.height / 2,
    0.5
  );
});

it("inherits --lr-radio-label-indent and lets a direct host value remain authoritative", async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div style="--lr-radio-label-indent: 3rem">
      <lr-radio value="a">A</lr-radio>
    </div>
  `);
  const el = wrapper.querySelector("lr-radio") as LyraRadio;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;

  expect(
    label.getBoundingClientRect().left - base.getBoundingClientRect().left
  ).to.be.closeTo(48, 0.5);

  // A component-local value has normal cascade priority over the inherited theme hook.
  el.style.setProperty("--lr-radio-label-indent", "4rem");
  expect(
    label.getBoundingClientRect().left - base.getBoundingClientRect().left
  ).to.be.closeTo(64, 0.5);
});

describe("checked-state cssprop escape hatch", () => {
  // Same probe idiom as lr-checkbox's/lr-source-picker's identical checked-state cssprop test:
  // resolve a raw declaration inside the same shadow root so the comparison format (rgb(...))
  // always matches getComputedStyle's, rather than comparing a raw custom-property string
  // against it.

  it("renders byte-identical to --lr-color-brand when --lr-radio-checked-border-color/-dot-color are unset", async () => {
    const el = (await fixture(
      html`<lr-radio checked>A</lr-radio>`
    )) as LyraRadio;
    const circle = el.shadowRoot!.querySelector(
      '[part~="circle"]'
    ) as HTMLElement;
    const dot = el.shadowRoot!.querySelector('[part~="dot"]') as HTMLElement;
    expect(getComputedStyle(circle).borderTopColor).to.equal(
      resolvedInShadow(
        el,
        "border-color: var(--lr-color-brand)",
        "border-top-color"
      )
    );
    expect(getComputedStyle(dot).backgroundColor).to.equal(
      resolvedInShadow(
        el,
        "background: var(--lr-color-brand)",
        "background-color"
      )
    );
  });

  it("retints just the checked border/dot fill through --lr-radio-checked-border-color/-dot-color instead of the shared --lr-color-brand token", async () => {
    const el = (await fixture(
      html`<lr-radio
        checked
        style="--lr-radio-checked-border-color: rgb(4, 5, 6); --lr-radio-checked-dot-color: rgb(1, 2, 3);"
        >A</lr-radio
      >`
    )) as LyraRadio;
    const circle = el.shadowRoot!.querySelector(
      '[part~="circle"]'
    ) as HTMLElement;
    const dot = el.shadowRoot!.querySelector('[part~="dot"]') as HTMLElement;
    expect(getComputedStyle(circle).borderTopColor).to.equal("rgb(4, 5, 6)");
    expect(getComputedStyle(dot).backgroundColor).to.equal("rgb(1, 2, 3)");
  });
});

it("themes radio hover and pressed border/ring paint through component hooks", async () => {
  const el = (await fixture(html`
    <lr-radio
      style="
        --lr-transition-fast: 0s;
        --lr-radio-hover-border-color: rgb(1, 2, 3);
        --lr-radio-active-border-color: rgb(4, 5, 6);
        --lr-radio-active-ring-color: rgb(7, 8, 9);
      "
      >Choice</lr-radio
    >
  `)) as LyraRadio;
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const circle = el.shadowRoot!.querySelector<HTMLElement>('[part~="circle"]')!;
  try {
    // The circle repaints through `[part~="base"]:hover|:active` -- a pointer-driven state, so
    // land the pointer with hoverUntilMatched() (it re-reads the rect and re-dispatches until
    // :hover really matches) and poll the rendered colour. Reading either paint straight after
    // sendMouse samples before the browser processed the native pointer event.
    await hoverUntilMatched(base, "the radio base never reported :hover");
    await waitUntil(
      () => getComputedStyle(circle).borderTopColor === "rgb(1, 2, 3)",
      "hovering the radio never repainted the circle border to its hover hook"
    );
    expect(getComputedStyle(circle).borderTopColor).to.equal("rgb(1, 2, 3)");
    await sendMouse({ type: "down" });
    await waitUntil(
      () => getComputedStyle(circle).borderTopColor === "rgb(4, 5, 6)",
      "pressing the radio never repainted the circle border to its active hook"
    );
    const pressed = getComputedStyle(circle);
    expect(pressed.borderTopColor).to.equal("rgb(4, 5, 6)");
    expect(pressed.boxShadow).to.contain("rgb(7, 8, 9)");
  } finally {
    await sendMouse({ type: "up" });
    await resetMouse();
  }
});

it("is accessible as a label-less radio named only by aria-label", async () => {
  const el = (await fixture(
    html`<lr-radio checked aria-label="Only option"></lr-radio>`
  )) as LyraRadio;
  await expect(el).to.be.accessible();
});

it("retains the base flex layout when disabled state adds a second part token", async () => {
  const el = (await fixture(
    html`<lr-radio disabled>Disabled option</lr-radio>`
  )) as LyraRadio;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;

  expect(base.part.contains("disabled")).to.be.true;
  expect(getComputedStyle(base).display).to.equal("inline-flex");
  expect(getComputedStyle(base).alignItems).to.equal("center");
});

it("does not select either radio rendering from nested native or authored actions", async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div>
      <lr-radio value="plain">
        Plain
        <details><summary>More details</summary></details>
        <span tabindex="0">Focusable detail</span>
      </lr-radio>
      <lr-radio-button value="button">
        Button
        <details><summary>More details</summary></details>
        <span tabindex="0">Focusable detail</span>
      </lr-radio-button>
    </div>
  `);
  const radios = [
    ...wrapper.querySelectorAll("lr-radio, lr-radio-button"),
  ] as LyraRadio[];

  for (const radio of radios) radio.querySelector("summary")!.click();
  const mouseSelections = radios.map((radio) => radio.checked);

  const keySelections: boolean[] = [];
  const keyCancellations: boolean[] = [];
  for (const radio of radios) {
    radio.checked = false;
    await radio.updateComplete;
    const event = new KeyboardEvent("keydown", {
      key: " ",
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    radio.querySelector<HTMLElement>('[tabindex="0"]')!.dispatchEvent(event);
    keySelections.push(radio.checked);
    keyCancellations.push(event.defaultPrevented);
  }

  expect(mouseSelections, "clicking nested summary actions").to.deep.equal([
    false,
    false,
  ]);
  expect(keySelections, "Space on nested authored tab stops").to.deep.equal([
    false,
    false,
  ]);
  expect(
    keyCancellations,
    "the outer radio does not consume the nested key action"
  ).to.deep.equal([false, false]);
});

describe("size", () => {
  async function circleOf(markup: unknown): Promise<DOMRect> {
    const el = (await fixture(markup as never)) as LyraRadio;
    await el.updateComplete;
    const circle = el.shadowRoot!.querySelector(
      '[part~="circle"]'
    ) as HTMLElement;
    return circle.getBoundingClientRect();
  }

  it('defaults to the "m" tier and reflects it', async () => {
    const el = (await fixture(
      html`<lr-radio value="a">Alpha</lr-radio>`
    )) as LyraRadio;
    await el.updateComplete;
    expect(el.size).to.equal("m");
    expect(el.getAttribute("size")).to.equal("m");
  });

  it('grows the rendered circle from size="s" to size="l"', async () => {
    const small = await circleOf(
      html`<lr-radio size="s" value="a">Alpha</lr-radio>`
    );
    const large = await circleOf(
      html`<lr-radio size="l" value="a">Alpha</lr-radio>`
    );
    expect(large.width).to.be.greaterThan(small.width);
    expect(large.height).to.be.greaterThan(small.height);
  });

  it('renders "small"/"large" at the same geometry as "s"/"l"', async () => {
    const s = await circleOf(
      html`<lr-radio size="s" value="a">Alpha</lr-radio>`
    );
    const small = await circleOf(
      html`<lr-radio size="small" value="a">Alpha</lr-radio>`
    );
    const l = await circleOf(
      html`<lr-radio size="l" value="a">Alpha</lr-radio>`
    );
    const large = await circleOf(
      html`<lr-radio size="large" value="a">Alpha</lr-radio>`
    );
    expect(small.width).to.be.closeTo(s.width, 0.5);
    expect(large.width).to.be.closeTo(l.width, 0.5);
  });

  it("keeps the selected dot inside the circle at every tier", async () => {
    let previousCircle = 0;
    for (const size of ["2xs", "xs", "s", "m", "l", "xl"] as const) {
      const el = (await fixture(
        html`<lr-radio size=${size} value="a" checked>Alpha</lr-radio>`
      )) as LyraRadio;
      await el.updateComplete;
      const circle = (
        el.shadowRoot!.querySelector('[part~="circle"]') as HTMLElement
      ).getBoundingClientRect();
      const dot = (
        el.shadowRoot!.querySelector('[part~="dot"]') as HTMLElement
      ).getBoundingClientRect();
      expect(dot.width, `${size} dot fits`).to.be.lessThan(circle.width);
      expect(dot.width, `${size} dot visible`).to.be.greaterThan(0);
      expect(
        circle.width,
        `${size} circle grows with the tier`
      ).to.be.greaterThan(previousCircle);
      previousCircle = circle.width;
    }
  });

  it("is accessible at a non-default tier", async () => {
    const el = (await fixture(
      html`<lr-radio size="l" value="a">Alpha</lr-radio>`
    )) as LyraRadio;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});

describe("lr-radio-group size", () => {
  async function group(size: string): Promise<LyraRadioGroup> {
    const el = (await fixture(html`
      <lr-radio-group name="plan" label="Plan" size=${size}>
        <lr-radio value="a">Alpha</lr-radio>
        <lr-radio value="b">Bravo</lr-radio>
        <lr-radio value="c">Charlie</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    await el.updateComplete;
    return el;
  }

  it('defaults to the "m" tier and reflects it', async () => {
    const el = (await fixture(
      html`<lr-radio-group name="plan" label="Plan"></lr-radio-group>`
    )) as LyraRadioGroup;
    await el.updateComplete;
    expect(el.size).to.equal("m");
    expect(el.getAttribute("size")).to.equal("m");
  });

  it('grows the rendered group box from size="s" to size="l"', async () => {
    const small = await group("s");
    const large = await group("l");
    expect(large.getBoundingClientRect().height).to.be.greaterThan(
      small.getBoundingClientRect().height
    );
  });

  it("projects effective size to plain/button options and updates dynamic children", async () => {
    const el = (await fixture(html`
      <lr-radio-group name="plan" label="Plan" size="l">
        <lr-radio value="a">Alpha</lr-radio>
        <lr-radio-button value="b">Bravo</lr-radio-button>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    await el.updateComplete;
    const options = [
      ...el.querySelectorAll("lr-radio, lr-radio-button"),
    ] as LyraRadio[];
    expect(options.map((radio) => radio.size)).to.deep.equal(["m", "m"]);
    expect(options.map((radio) => radio.effectiveSize)).to.deep.equal([
      "l",
      "l",
    ]);

    const added = document.createElement("lr-radio") as LyraRadio;
    added.value = "c";
    added.textContent = "Charlie";
    el.append(added);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await added.updateComplete;
    expect(added.size).to.equal("m");
    expect(added.effectiveSize).to.equal("l");

    el.size = "s";
    await el.updateComplete;
    await Promise.all(
      [...el.querySelectorAll<LyraRadio>("lr-radio, lr-radio-button")].map(
        (radio) => radio.updateComplete
      )
    );
    expect(
      [...el.querySelectorAll<LyraRadio>("lr-radio, lr-radio-button")].map(
        (radio) => radio.effectiveSize
      )
    ).to.deep.equal(["s", "s", "s"]);
  });

  it('renders "small"/"large" at the same geometry as "s"/"l"', async () => {
    const s = await group("s");
    const small = await group("small");
    const l = await group("l");
    const large = await group("large");
    expect(small.getBoundingClientRect().height).to.be.closeTo(
      s.getBoundingClientRect().height,
      0.5
    );
    expect(large.getBoundingClientRect().height).to.be.closeTo(
      l.getBoundingClientRect().height,
      0.5
    );
  });

  it("keeps group size authoritative over an option-level size", async () => {
    const el = (await fixture(html`
      <lr-radio-group name="plan" label="Plan" size="l">
        <lr-radio value="a" size="s">Alpha</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    await el.updateComplete;
    const option = el.querySelector("lr-radio") as LyraRadio;
    expect(option.size).to.equal("s");
    expect(option.effectiveSize).to.equal("l");
  });

  it("preserves a late authored size while the group remains visually authoritative", async () => {
    const el = (await fixture(html`
      <lr-radio-group name="plan" label="Plan" size="l">
        <lr-radio value="a">Alpha</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    const option = el.querySelector("lr-radio") as LyraRadio;
    option.size = "s";
    await new Promise((resolve) => setTimeout(resolve, 0));
    await option.updateComplete;
    expect(option.size).to.equal("s");
    expect(option.effectiveSize).to.equal("l");
  });

  it("is accessible at a non-default tier", async () => {
    const el = await group("l");
    await expect(el).to.be.accessible();
  });
});

describe("lr-radio-group orientation, focus, and compatibility aliases", () => {
  it("defaults vertical, exposes aria-orientation, and accepts both arrow pairs", async () => {
    const group = (await fixture(html`
      <lr-radio-group label="Choice">
        <lr-radio value="a" checked>A</lr-radio>
        <lr-radio value="b">B</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup & { orientation: "horizontal" | "vertical" };
    const [a, b] = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
    if (!a || !b) throw new Error("Expected both vertical-orientation radios.");
    const aBase = a.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    const radiogroup = group.shadowRoot!.querySelector(
      '[role="radiogroup"]'
    ) as HTMLElement;
    expect(group.orientation).to.equal("vertical");
    expect(group.getAttribute("orientation")).to.equal("vertical");
    expect(radiogroup.getAttribute("aria-orientation")).to.equal("vertical");

    const changed = oneEvent(group, "change");
    aBase.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
    await changed;
    expect(b.checked).to.be.true;

    const back = oneEvent(group, "change");
    (b.shadowRoot!.querySelector('[part~="base"]') as HTMLElement).dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowUp",
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
    await back;
    expect(a.checked).to.be.true;
  });

  it("uses horizontal RTL arrows and skips disabled options", async () => {
    const group = (await fixture(html`
      <lr-radio-group orientation="horizontal" dir="rtl" label="Choice">
        <lr-radio value="a" checked>A</lr-radio>
        <lr-radio value="b" disabled>B</lr-radio>
        <lr-radio value="c">C</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    const [a, , c] = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
    if (!a || !c) throw new Error("Expected the enabled horizontal radios.");
    const changed = oneEvent(group, "change");
    (
      a.shadowRoot!.querySelector('[part~="base"]') as HTMLElement
    ).dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowLeft",
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
    await changed;
    expect(c.checked).to.be.true;
    expect(
      (
        group.shadowRoot!.querySelector('[role="radiogroup"]') as HTMLElement
      ).getAttribute("aria-orientation")
    ).to.equal("horizontal");
  });

  it("clamps an out-of-vocabulary orientation attribute to the declared default instead of forwarding it to aria-orientation", async () => {
    const group = (await fixture(html`
      <lr-radio-group orientation="diagonal" label="Choice">
        <lr-radio value="a" checked>A</lr-radio>
        <lr-radio value="b">B</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    const radiogroup = group.shadowRoot!.querySelector(
      '[role="radiogroup"]'
    ) as HTMLElement;
    expect(group.orientation).to.equal("vertical");
    expect(group.getAttribute("orientation")).to.equal("vertical");
    expect(radiogroup.getAttribute("aria-orientation")).to.equal("vertical");
  });

  it("clamps an out-of-vocabulary orientation set directly on the property instead of forwarding it to aria-orientation", async () => {
    const group = (await fixture(html`
      <lr-radio-group label="Choice">
        <lr-radio value="a" checked>A</lr-radio>
        <lr-radio value="b">B</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    (group as unknown as { orientation: string }).orientation = "diagonal";
    await group.updateComplete;
    const radiogroup = group.shadowRoot!.querySelector(
      '[role="radiogroup"]'
    ) as HTMLElement;
    expect(radiogroup.getAttribute("aria-orientation")).to.equal("vertical");
  });

  it("focuses the selected option, or the first enabled option when empty", async () => {
    const group = (await fixture(html`
      <lr-radio-group label="Choice">
        <lr-radio value="a" disabled>A</lr-radio>
        <lr-radio value="b">B</lr-radio>
        <lr-radio value="c" checked>C</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    const [, b, c] = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
    if (!b || !c) throw new Error("Expected the enabled focus-target radios.");
    group.focus();
    expect(
      c.shadowRoot!.activeElement ===
        c.shadowRoot!.querySelector('[part~="base"]')
    ).to.equal(true);

    c.checked = false;
    await group.updateComplete;
    group.focus();
    expect(
      b.shadowRoot!.activeElement ===
        b.shadowRoot!.querySelector('[part~="base"]')
    ).to.equal(true);
  });

  it("blurs the currently focused owned option even when it is not the selection target", async () => {
    const group = (await fixture(html`
      <lr-radio-group label="Choice">
        <lr-radio value="a" checked>A</lr-radio>
        <lr-radio value="b">B</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    const [, b] = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
    if (!b) throw new Error("Expected the non-selected focused radio.");

    b.focus();
    expect(
      b.shadowRoot!.activeElement?.getAttribute("part")?.split(" ")
    ).to.include("base");
    group.blur();
    expect(b.shadowRoot!.activeElement === null).to.be.true;
  });

  it("activates the selected or first enabled option through the group host click", async () => {
    const group = (await fixture(html`
      <lr-radio-group label="Choice">
        <lr-radio value="a">A</lr-radio>
        <lr-radio value="b" checked>B</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    const [a, b] = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
    if (!a || !b) throw new Error("Expected both host-activation radios.");
    await Promise.all([
      group.updateComplete,
      a.updateComplete,
      b.updateComplete,
    ]);

    group.click();
    expect(
      [a.checked, b.checked],
      "a selected option remains the activation target"
    ).to.deep.equal([false, true]);

    group.value = "";
    await group.updateComplete;
    group.click();
    expect(
      [a.checked, b.checked],
      "an empty group activates its first enabled option"
    ).to.deep.equal([true, false]);

    group.disabled = true;
    group.click();
    expect(
      [a.checked, b.checked],
      "a disabled group host click is inert"
    ).to.deep.equal([true, false]);
  });

  it("keeps the WA default name empty and exports WA/Shoelace form-control aliases", async () => {
    const group = (await fixture(html`
      <lr-radio-group label="Choice" help-text="Supporting text">
        <lr-radio value="a">A</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup & { helpText: string };
    await group.updateComplete;
    expect(group.name).to.equal("");
    expect(group.hasAttribute("name")).to.be.false;
    expect(group.querySelector("lr-radio")!.hasAttribute("name")).to.be.false;

    const formControl = group.shadowRoot!.querySelector(
      '[part~="form-control"]'
    ) as HTMLElement;
    const input = group.shadowRoot!.querySelector(
      '[part~="form-control-input"]'
    ) as HTMLElement;
    const label = group.shadowRoot!.querySelector(
      '[part~="form-control-label"]'
    ) as HTMLElement;
    const hint = group.shadowRoot!.querySelector(
      '[part~="form-control-help-text"]'
    ) as HTMLElement;
    expect(formControl != null).to.equal(true);
    expect(input.getAttribute("part")!.split(/\s+/)).to.include.members([
      "radios",
      "form-control-input",
      "button-group",
      "button-group__base",
    ]);
    expect(label.getAttribute("part")!.split(/\s+/)).to.include("label");
    expect(hint.getAttribute("part")!.split(/\s+/)).to.include("hint");
    expect(hint.textContent).to.contain("Supporting text");
    await expect(group).to.be.accessible();
  });

  it("accepts Shoelace default-value and help-text slots plus WA SSR presence hints", async () => {
    const group = (await fixture(html`
      <lr-radio-group default-value="b" with-label with-hint>
        <lr-radio value="a">A</lr-radio>
        <lr-radio value="b">B</lr-radio>
        <span slot="help-text">Slotted help</span>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    await group.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(group.defaultValue).to.equal("b");
    expect(group.value).to.equal("b");
    expect((group.querySelector('lr-radio[value="b"]') as LyraRadio).checked).to
      .be.true;
    expect(
      (
        group.shadowRoot!.querySelector(
          '[part~="form-control-label"]'
        ) as HTMLElement
      ).hidden
    ).to.be.false;
    const hint = group.shadowRoot!.querySelector(
      '[part~="form-control-help-text"]'
    ) as HTMLElement;
    expect(hint.hidden).to.be.false;
    const helpSlot = hint.querySelector(
      'slot[name="help-text"]'
    ) as HTMLSlotElement;
    expect(
      helpSlot
        .assignedNodes({ flatten: true })
        .map((node) => node.textContent)
        .join("")
    ).to.contain("Slotted help");
  });
});

it("keeps pristine required group ARIA neutral until validation is revealed", async () => {
  const group = (await fixture(html`
    <lr-radio-group required label="Choice">
      <lr-radio value="a">A</lr-radio>
      <lr-radio value="b">B</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  await group.updateComplete;
  const radiogroup = group.shadowRoot!.querySelector('[role="radiogroup"]')!;

  expect(group.validity.valueMissing).to.be.true;
  expect(radiogroup.getAttribute("aria-invalid")).to.equal("false");

  // A silent checkValidity() query must never reveal anything -- it is the one validity path
  // that deliberately does not count as interaction.
  expect(group.checkValidity()).to.equal(false);
  await group.updateComplete;
  expect(radiogroup.getAttribute("aria-invalid")).to.equal("false");

  // reportValidity() is interactive validation, so it is what reveals it.
  expect(group.reportValidity()).to.equal(false);
  await group.updateComplete;
  expect(radiogroup.getAttribute("aria-invalid")).to.equal("true");

  group.value = "a";
  await group.updateComplete;
  expect(radiogroup.getAttribute("aria-invalid")).to.equal("false");
});

it("reveals aggregate ARIA through native form validation exactly once and remains barred in a disabled fieldset", async () => {
  const form = (await fixture(html`
    <form>
      <fieldset>
        <lr-radio-group required label="Choice">
          <lr-radio value="a">A</lr-radio>
          <lr-radio value="b">B</lr-radio>
        </lr-radio-group>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const fieldset = form.querySelector("fieldset")!;
  const group = form.querySelector("lr-radio-group") as LyraRadioGroup;
  await group.updateComplete;
  const radiogroup = group.shadowRoot!.querySelector('[role="radiogroup"]')!;
  let aliases = 0;
  group.addEventListener("lr-invalid", (event) => {
    if (event.target === group) aliases += 1;
  });

  expect(radiogroup.getAttribute("aria-invalid")).to.equal("false");
  expect(form.reportValidity()).to.equal(false);
  await group.updateComplete;
  expect(radiogroup.getAttribute("aria-invalid")).to.equal("true");
  expect(aliases).to.equal(1);

  form.reset();
  fieldset.disabled = true;
  await group.updateComplete;
  expect(radiogroup.getAttribute("aria-invalid")).to.equal("false");
  expect(form.reportValidity()).to.equal(true);
  await group.updateComplete;
  expect(aliases).to.equal(1);
  expect(radiogroup.getAttribute("aria-invalid")).to.equal("false");
});

// brand default under the pointer. Unset hover/active hooks now fall back to the checked border.
it("keeps --lr-radio-checked-border-color while checked and hovered or pressed", async () => {
  const el = (await fixture(html`
    <lr-radio
      checked
      style="--lr-transition-fast: 0s; --lr-radio-checked-border-color: rgb(10, 20, 30);"
      >Choice</lr-radio
    >
  `)) as LyraRadio;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
  const circle = el.shadowRoot!.querySelector<HTMLElement>('[part~="circle"]')!;
  expect(getComputedStyle(circle).borderTopColor, "resting").to.equal("rgb(10, 20, 30)");
  try {
    await hoverUntilMatched(base, "the radio base never reported :hover");
    await waitUntil(
      () => getComputedStyle(circle).borderTopColor === "rgb(10, 20, 30)",
      "hovering replaced the themed checked border"
    );
    await sendMouse({ type: "down" });
    await waitUntil(() => base.matches(":active"), "the radio never reported :active");
    await waitUntil(
      () => getComputedStyle(circle).borderTopColor === "rgb(10, 20, 30)",
      "pressing replaced the themed checked border"
    );
  } finally {
    await sendMouse({ type: "up" });
    await resetMouse();
  }
});
