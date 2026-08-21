import { fixture, expect, html, oneEvent } from "@open-wc/testing";
import "./radio.js";
import "./radio-button.js";
import "./radio-group.js";
import type { LyraRadio } from "./radio.js";
import type { LyraRadioGroup } from "./radio-group.js";
import { resetMouse, sendMouse } from "../../../../test/wtr-mouse.js";

it("contains a horizontal button group with long content at 320px in LTR and RTL", async () => {
  const label =
    "InternationalizedRadioGroupLabelWithoutAnyNaturalBreakOpportunity";
  for (const direction of ["ltr", "rtl"] as const) {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div dir=${direction} style="inline-size: 320px; max-inline-size: 320px">
        <lr-radio-group orientation="horizontal" label=${label} hint=${label}>
          <lr-radio-button value="one">${label}One</lr-radio-button>
          <lr-radio-button value="two">${label}Two</lr-radio-button>
        </lr-radio-group>
      </div>
    `);
    expect(wrapper.scrollWidth, `dir=${direction}`).to.be.at.most(
      wrapper.clientWidth
    );
  }
});

it("restores radio and radio-group declared defaults after attribute removal", async () => {
  const wrapper = await fixture<HTMLDivElement>(html`
    <div>
      <lr-radio appearance="button" size="xl" value="custom">Radio</lr-radio>
      <lr-radio-button appearance="default" size="xs" value="custom"
        >Button</lr-radio-button
      >
      <lr-radio-group orientation="horizontal" size="xl"></lr-radio-group>
    </div>
  `);
  const radio = wrapper.querySelector("lr-radio") as LyraRadio;
  const button = wrapper.querySelector("lr-radio-button") as LyraRadio;
  const group = wrapper.querySelector("lr-radio-group") as LyraRadioGroup;
  for (const control of [radio, button]) {
    control.removeAttribute("appearance");
    control.removeAttribute("size");
    control.removeAttribute("value");
  }
  group.removeAttribute("orientation");
  group.removeAttribute("size");
  await Promise.all([
    radio.updateComplete,
    button.updateComplete,
    group.updateComplete,
  ]);
  expect(radio.appearance).to.equal("default");
  expect(radio.size).to.equal("m");
  expect(radio.value).to.equal("on");
  expect(button.appearance).to.equal("default");
  expect(button.size).to.equal("m");
  expect(button.value).to.equal("on");
  expect(group.orientation).to.equal("vertical");
  expect(group.size).to.equal("m");
});

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

it("treats missing ancestry discovery as standalone during nested SSR construction", () => {
  const radio = document.createElement("lr-radio") as LyraRadio;
  Object.defineProperty(radio, "closest", {
    configurable: true,
    value: undefined,
  });
  const internals = radio as unknown as {
    currentGroup(): unknown;
    syncFormState(): void;
  };
  expect(internals.currentGroup()).to.equal(null);
  expect(() => internals.syncFormState()).to.not.throw();
});

it("emits one cancelable group-owned lr-invalid alias when its aggregate validity fails a check", async () => {
  const group = (await fixture(html`
    <lr-radio-group required label="Choice">
      <lr-radio value="a">A</lr-radio>
      <lr-radio value="b">B</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  const radios = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
  await Promise.all(radios.map((radio) => radio.updateComplete));
  const aliases: CustomEvent[] = [];
  group.addEventListener("lr-invalid", (event) =>
    aliases.push(event as CustomEvent)
  );
  const natives: Event[] = [];
  group.addEventListener("invalid", (event) => natives.push(event));

  expect(group.checkValidity()).to.be.false;
  expect(aliases).to.have.lengthOf(1);
  expect(aliases[0].target === group).to.equal(true);
  expect(aliases[0].bubbles && aliases[0].composed).to.be.true;
  expect(aliases[0].cancelable).to.be.true;
  // Nothing cancelled it, so the browser's own validation UI stays enabled.
  expect(natives).to.have.lengthOf(1);
  expect(natives[0].defaultPrevented).to.be.false;
});

it("cancels the native invalid event when the group-owned lr-invalid alias is cancelled", async () => {
  const group = (await fixture(html`
    <lr-radio-group required label="Choice">
      <lr-radio value="a">A</lr-radio>
      <lr-radio value="b">B</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  const radios = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
  await Promise.all(radios.map((radio) => radio.updateComplete));
  group.addEventListener("lr-invalid", (event) => event.preventDefault());
  const natives: Event[] = [];
  group.addEventListener("invalid", (event) => natives.push(event));

  expect(group.checkValidity()).to.be.false;
  expect(natives).to.have.lengthOf(1);
  expect(natives[0].defaultPrevented).to.be.true;
});

it("recreates the group membership observer in the adopted owner realm and ignores its stale callback", async () => {
  const group = (await fixture(html`
    <lr-radio-group><lr-radio value="a">A</lr-radio></lr-radio-group>
  `)) as LyraRadioGroup;
  await group.updateComplete;
  group.remove();
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const frameDocument = frame.contentDocument;
  const frameWindow = frame.contentWindow;
  if (!frameDocument || !frameWindow) {
    frame.remove();
    throw new Error("The iframe realm was unavailable.");
  }
  const originalMutationObserver = frameWindow.MutationObserver;
  let groupCallback: MutationCallback | undefined;
  let groupObservations = 0;
  let groupDisconnects = 0;
  class OwnerMutationObserver implements MutationObserver {
    private readonly callback: MutationCallback;
    private observesGroup = false;
    constructor(callback: MutationCallback) {
      this.callback = callback;
    }
    observe(target: Node, options?: MutationObserverInit): void {
      if (target !== group || !options?.attributeFilter?.includes("checked"))
        return;
      this.observesGroup = true;
      groupObservations += 1;
      groupCallback = this.callback;
    }
    takeRecords(): MutationRecord[] {
      return [];
    }
    disconnect(): void {
      if (this.observesGroup) groupDisconnects += 1;
    }
  }
  frameWindow.MutationObserver = OwnerMutationObserver;

  try {
    frameDocument.adoptNode(group);
    expect(
      groupObservations,
      "detached adoption must not arm an observer"
    ).to.equal(0);
    frameDocument.body.append(group);
    await group.updateComplete;
    expect(
      groupObservations,
      "the destination window observes group membership"
    ).to.equal(1);
    expect(groupCallback).to.be.a("function");
    const staleCallback = groupCallback!;

    document.adoptNode(group);
    document.body.append(group);
    await group.updateComplete;
    await Promise.resolve();
    expect(
      groupDisconnects,
      "adoption disconnects the destination observer"
    ).to.equal(1);

    const internals = group as unknown as { syncRadios(): void };
    const syncRadios = internals.syncRadios.bind(group);
    let staleSyncs = 0;
    internals.syncRadios = () => {
      staleSyncs += 1;
      syncRadios();
    };
    staleCallback([], {} as MutationObserver);
    await Promise.resolve();
    await Promise.resolve();
    expect(
      staleSyncs,
      "a callback retained by the old realm is inert after reconnect"
    ).to.equal(0);
  } finally {
    frameWindow.MutationObserver = originalMutationObserver;
    if (group.ownerDocument !== document) document.adoptNode(group);
    group.remove();
    frame.remove();
  }
});

it("accepts an owned radio-shaped invalid target from another realm without instanceof", async () => {
  const group = (await fixture(
    html`<lr-radio-group></lr-radio-group>`
  )) as LyraRadioGroup;
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const frameDocument = frame.contentDocument;
  const frameWindow = frame.contentWindow;
  if (!frameDocument || !frameWindow) {
    frame.remove();
    throw new Error("The iframe realm was unavailable.");
  }
  const foreignRadio = frameDocument.createElement("lr-radio");
  const internals = group as unknown as {
    ownsRadio(target: Element): boolean;
    onInvalid(event: Event): void;
  };
  const ownsRadio = internals.ownsRadio.bind(group);
  internals.ownsRadio = (target) => target === foreignRadio;
  const invalid = new frameWindow.Event("invalid", { cancelable: true });
  Object.defineProperty(invalid, "target", {
    configurable: true,
    value: foreignRadio,
  });
  let aliases = 0;
  group.addEventListener("lr-invalid", () => {
    aliases += 1;
  });

  try {
    internals.onInvalid(invalid);
    expect(aliases).to.equal(1);
  } finally {
    internals.ownsRadio = ownsRadio;
    frame.remove();
  }
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
      delete (
        frameWindow as Window & { MutationObserver?: typeof MutationObserver }
      ).MutationObserver;
    }
    frame.remove();
  }
});

it("selects and emits the complete native and prefixed event pair exactly once", async () => {
  const el = (await fixture(
    html`<lr-radio value="a">A</lr-radio>`
  )) as LyraRadio;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const events: string[] = [];
  const nativeEvents: Event[] = [];
  const aliases: CustomEvent<{ checked: boolean; value: string }>[] = [];
  for (const name of ["input", "lr-input", "change", "lr-change"]) {
    el.addEventListener(name, (event) => {
      events.push(name);
      if (name === "input" || name === "change") nativeEvents.push(event);
      else
        aliases.push(event as CustomEvent<{ checked: boolean; value: string }>);
    });
  }
  base.click();
  expect(el.checked).to.be.true;
  expect(events).to.deep.equal(["input", "lr-input", "change", "lr-change"]);
  expect(nativeEvents.every((event) => event.constructor === Event)).to.be.true;
  expect(
    nativeEvents.every(
      (event) => event.target === el && event.bubbles && event.composed
    )
  ).to.be.true;
  expect(aliases.map((event) => event.detail)).to.deep.equal([
    { checked: true, value: "a" },
    { checked: true, value: "a" },
  ]);
});

it("reflects non-empty and empty name/value property writes without collapsing through an empty attribute", async () => {
  const el = (await fixture(html`<lr-radio>One</lr-radio>`)) as LyraRadio;

  el.name = "choice";
  el.value = "alpha";
  expect(el.name).to.equal("choice");
  expect(el.getAttribute("name")).to.equal("choice");
  expect(el.value).to.equal("alpha");
  expect(el.getAttribute("value")).to.equal("alpha");

  el.name = "";
  el.value = "";
  await el.updateComplete;
  expect(el.name).to.equal("");
  expect(el.hasAttribute("name")).to.be.false;
  expect(el.value).to.equal("");
  expect(el.getAttribute("value")).to.equal("");
});

it("canonicalizes a declarative empty name attribute to omission", async () => {
  const el = (await fixture(
    html`<lr-radio name="">One</lr-radio>`
  )) as LyraRadio;
  await el.updateComplete;

  expect(el.name).to.equal("");
  expect(el.hasAttribute("name")).to.be.false;

  el.setAttribute("name", "");
  await el.updateComplete;
  expect(el.name).to.equal("");
  expect(el.hasAttribute("name")).to.be.false;
});

it("relays exactly one native focus/blur pair, and never lr-focus/lr-blur", async () => {
  const el = (await fixture(html`<lr-radio>One</lr-radio>`)) as LyraRadio;
  const events: FocusEvent[] = [];
  const aliases: string[] = [];
  el.addEventListener("focus", (event) => events.push(event as FocusEvent));
  el.addEventListener("blur", (event) => events.push(event as FocusEvent));
  el.addEventListener("lr-focus", () => aliases.push("lr-focus"));
  el.addEventListener("lr-blur", () => aliases.push("lr-blur"));

  el.focus();
  el.blur();

  expect(events.map((event) => event.type)).to.deep.equal(["focus", "blur"]);
  expect(events.every((event) => event instanceof FocusEvent)).to.be.true;
  expect(events.every((event) => event.target === el)).to.be.true;
  expect(events.every((event) => event.bubbles && event.composed)).to.be.true;
  // v9 dropped the v8 lr-focus/lr-blur compatibility aliases -- only the native pair remains.
  expect(aliases).to.deep.equal([]);
});

it("forwards a host-level click() to the internal base control, like lr-button", async () => {
  // A generic form-submit helper, test utility, or automation script that calls
  // `.click()` on the host element (rather than clicking rendered pixels inside
  // its shadow DOM) must still toggle selection.
  const el = (await fixture(
    html`<lr-radio value="a">A</lr-radio>`
  )) as LyraRadio;
  await el.updateComplete;

  el.click();

  expect(el.checked).to.be.true;
});

it("moves selection and DOM focus when arrow navigation is used", async () => {
  const group = (await fixture(html`
    <lr-radio-group label="Choice">
      <lr-radio value="a">A</lr-radio>
      <lr-radio value="b">B</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  const radios = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
  const firstBase = radios[0].shadowRoot!.querySelector(
    '[part="base"]'
  ) as HTMLElement;
  const secondBase = radios[1].shadowRoot!.querySelector(
    '[part="base"]'
  ) as HTMLElement;
  radios[0].checked = true;
  firstBase.focus();
  const eventPromise = oneEvent(group, "lr-change");
  firstBase.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      composed: true,
      cancelable: true,
    })
  );
  const event = await eventPromise;
  expect(event.detail.value).to.equal("b");
  expect(radios[1].checked).to.be.true;
  expect(radios[1].shadowRoot!.activeElement === secondBase).to.be.true;
  await expect(group).to.be.accessible();
});

it('swaps ArrowLeft/ArrowRight under dir="rtl" so "forward" follows reading direction', async () => {
  const group = (await fixture(html`
    <lr-radio-group label="Choice" dir="rtl" orientation="horizontal">
      <lr-radio value="a">A</lr-radio>
      <lr-radio value="b">B</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  const radios = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
  const firstBase = radios[0].shadowRoot!.querySelector(
    '[part="base"]'
  ) as HTMLElement;
  const secondBase = radios[1].shadowRoot!.querySelector(
    '[part="base"]'
  ) as HTMLElement;
  radios[0].checked = true;
  firstBase.focus();

  // ArrowLeft is "forward" under RTL -- the mirror image of ArrowRight's LTR meaning
  // exercised above.
  const forwardEvent = oneEvent(group, "lr-change");
  firstBase.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowLeft",
      bubbles: true,
      composed: true,
      cancelable: true,
    })
  );
  expect((await forwardEvent).detail.value).to.equal("b");
  expect(radios[1].checked).to.be.true;
  expect(radios[1].shadowRoot!.activeElement === secondBase).to.be.true;

  // ArrowRight is "backward" under RTL, so it should return selection/focus to the first radio.
  const backwardEvent = oneEvent(group, "lr-change");
  secondBase.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      composed: true,
      cancelable: true,
    })
  );
  expect((await backwardEvent).detail.value).to.equal("a");
  expect(radios[0].checked).to.be.true;
  expect(radios[0].shadowRoot!.activeElement === firstBase).to.be.true;
});

it("uses roving tabindex: only the checked (or first enabled) radio is a Tab stop", async () => {
  const group = (await fixture(html`
    <lr-radio-group label="Choice">
      <lr-radio value="a">A</lr-radio>
      <lr-radio value="b">B</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  await group.updateComplete;
  const radios = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
  const base = (r: LyraRadio) =>
    r.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base(radios[0]).tabIndex).to.equal(0);
  expect(base(radios[1]).tabIndex).to.equal(-1);

  base(radios[1]).click();
  await group.updateComplete;
  expect(base(radios[0]).tabIndex).to.equal(-1);
  expect(base(radios[1]).tabIndex).to.equal(0);
});

it("keeps an enabled tab stop when the selected radio itself is disabled", async () => {
  const group = (await fixture(html`
    <lr-radio-group label="Choice">
      <lr-radio value="a" checked disabled>A</lr-radio>
      <lr-radio value="b">B</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  const [a, b] = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
  await Promise.all([group.updateComplete, a.updateComplete, b.updateComplete]);
  const base = (radio: LyraRadio) =>
    radio.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(a.checked).to.be.true;
  expect(base(a).tabIndex).to.equal(-1);
  expect(
    base(b).tabIndex,
    "the group must retain one enabled roving stop"
  ).to.equal(0);
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

it("restores the declarative default-checked state on form reset", async () => {
  const form = (await fixture(html`
    <form>
      <lr-radio name="choice" value="a" checked>A</lr-radio>
      <lr-radio name="choice" value="b">B</lr-radio>
    </form>
  `)) as HTMLFormElement;
  const [a, b] = [...form.querySelectorAll("lr-radio")] as LyraRadio[];
  expect(a.checked).to.be.true;

  b.checked = true;
  a.checked = false;
  expect(a.checked).to.be.false;
  expect(b.checked).to.be.true;

  form.reset();
  expect(a.checked, "a restores its declarative checked default").to.be.true;
  expect(b.checked, "b restores its (unchecked) declarative default").to.be
    .false;
});

it("exposes native form validity/focus APIs and restores serialized checked state", async () => {
  const form = (await fixture(html`
    <form><lr-radio name="choice" value="a" required>A</lr-radio></form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-radio") as LyraRadio;

  expect(el.form === form).to.equal(true);
  expect(el.validity.valueMissing).to.be.true;
  expect(el.validationMessage).to.equal("Please select an option.");
  expect(el.willValidate).to.be.true;

  el.formStateRestoreCallback("checked", "restore");
  await el.updateComplete;
  expect(el.checked).to.be.true;
  expect(el.validity.valid).to.be.true;
  expect(new FormData(form).get("choice")).to.equal("a");

  el.focus({ preventScroll: true });
  expect(el.shadowRoot!.activeElement?.getAttribute("part")).to.equal("base");
  el.blur();
  expect(el.shadowRoot!.activeElement === null).to.equal(true);

  el.formStateRestoreCallback("unchecked", "autocomplete");
  expect(el.checked).to.be.false;
});

it("leaves group-owned radio restoration to its owning group", async () => {
  const group = (await fixture(html`
    <lr-radio-group name="choice">
      <lr-radio value="a" checked>A</lr-radio>
      <lr-radio value="b">B</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  const [a, b] = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
  await Promise.all([group.updateComplete, a.updateComplete, b.updateComplete]);

  b.formStateRestoreCallback("checked", "restore");

  expect(
    group.value,
    "the aggregate group selection stays authoritative"
  ).to.equal("a");
  expect([a.checked, b.checked]).to.deep.equal([true, false]);
});

it("temporarily disables a bare radio through an ancestor fieldset without overwriting the author disabled state", async () => {
  const form = (await fixture(html`
    <form>
      <fieldset>
        <lr-radio value="a">A</lr-radio>
        <lr-radio value="b" disabled>B</lr-radio>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const [a, b] = [...form.querySelectorAll("lr-radio")] as LyraRadio[];
  const fieldset = form.querySelector("fieldset") as HTMLFieldSetElement;

  expect(a.effectiveDisabled).to.be.false;
  expect(b.disabled).to.be.true;

  // No `await` before these assertions: `formDisabledCallback` fires
  // synchronously when the fieldset's `disabled` property is set.
  fieldset.disabled = true;
  expect(a.effectiveDisabled, "an ancestor fieldset must reach a bare lr-radio")
    .to.be.true;
  expect(
    a.disabled,
    "fieldset state must never mutate the public disabled property"
  ).to.be.false;
  expect(
    a.hasAttribute("disabled"),
    "the host attribute must not be mutated either"
  ).to.be.false;
  expect(b.disabled, "an already-explicitly-disabled radio is unaffected").to.be
    .true;
  expect(b.effectiveDisabled).to.be.true;

  const aBase = a.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  let delegatedCalls = 0;
  aBase.click = () => {
    delegatedCalls += 1;
  };
  aBase.focus = () => {
    delegatedCalls += 1;
  };
  a.click();
  a.focus();
  expect(
    delegatedCalls,
    "fieldset disablement gates host click/focus delegation"
  ).to.equal(0);

  fieldset.disabled = false;
  expect(
    a.effectiveDisabled,
    "must not be permanently stuck disabled once the fieldset re-enables"
  ).to.be.false;
  expect(a.disabled).to.be.false;
  expect(b.disabled, "an explicit disabled state survives the fieldset cycle")
    .to.be.true;
  expect(b.effectiveDisabled).to.be.true;

  await Promise.all([a.updateComplete, b.updateComplete]);
  expect(aBase.getAttribute("aria-disabled")).to.equal("false");
  expect(aBase.getAttribute("tabindex")).to.equal("0");
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

it("cascades fieldset-disabled state down to radios nested inside a lr-radio-group", async () => {
  const form = (await fixture(html`
    <form>
      <fieldset>
        <lr-radio-group label="Choice">
          <lr-radio value="a">A</lr-radio>
          <lr-radio value="b">B</lr-radio>
        </lr-radio-group>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const group = form.querySelector("lr-radio-group") as LyraRadioGroup;
  const [a, b] = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
  const fieldset = form.querySelector("fieldset") as HTMLFieldSetElement;
  await group.updateComplete;

  expect(a.effectiveDisabled).to.be.false;
  expect(b.effectiveDisabled).to.be.false;

  fieldset.disabled = true;
  expect(
    a.effectiveDisabled,
    "fieldset state must reach radios nested inside a radio-group"
  ).to.be.true;
  expect(b.effectiveDisabled).to.be.true;
  expect(
    a.disabled,
    "fieldset state must never mutate the public disabled property"
  ).to.be.false;

  fieldset.disabled = false;
  expect(a.effectiveDisabled).to.be.false;
  expect(b.effectiveDisabled).to.be.false;
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

it("treats required as a group constraint that becomes valid when any owned radio is selected", async () => {
  const form = (await fixture(html`
    <form>
      <lr-radio-group name="choice" label="Choice" required>
        <lr-radio value="a">A</lr-radio>
        <lr-radio value="b">B</lr-radio>
      </lr-radio-group>
    </form>
  `)) as HTMLFormElement;
  const group = form.querySelector("lr-radio-group") as LyraRadioGroup;
  const radios = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
  const base = group.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  expect(base.getAttribute("aria-required")).to.equal("true");
  expect(form.checkValidity(), "an empty required group is invalid").to.be
    .false;

  radios[1].click();
  expect(radios[1].checked).to.be.true;
  expect(form.checkValidity(), "one checked option satisfies the whole group")
    .to.be.true;
  expect(radios.every((radio) => radio.validity.valid)).to.be.true;
});

describe("aggregate form ownership", () => {
  it("makes the group the only submitting FACE control while standalone radios still submit", async () => {
    const form = (await fixture(html`
      <form>
        <label for="choice">Choice</label>
        <lr-radio-group id="choice" name="choice" value="b">
          <lr-radio value="a">A</lr-radio>
          <lr-radio value="b">B</lr-radio>
        </lr-radio-group>
        <lr-radio name="standalone" value="yes" checked>Standalone</lr-radio>
      </form>
    `)) as HTMLFormElement;
    const group = form.querySelector("lr-radio-group") as LyraRadioGroup;
    const radios = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
    await group.updateComplete;

    expect(group.form === form).to.be.true;
    expect(group.getForm() === form).to.be.true;
    expect(group.labels.length).to.equal(1);
    expect([...form.elements].includes(group)).to.be.true;
    expect(group.value).to.equal("b");
    expect(radios.map((radio) => radio.checked)).to.deep.equal([false, true]);
    expect(
      new FormData(form).getAll("choice"),
      "owned radios must not duplicate the group entry"
    ).to.deep.equal(["b"]);
    expect(new FormData(form).getAll("standalone")).to.deep.equal(["yes"]);
  });

  it("submits through a writable external form owner", async () => {
    const root = await fixture(html`
      <div>
        <form id="external-radio-owner"></form>
        <lr-radio-group name="choice" value="a">
          <lr-radio value="a">A</lr-radio>
        </lr-radio-group>
      </div>
    `);
    const form = root.querySelector("form") as HTMLFormElement;
    const group = root.querySelector("lr-radio-group") as LyraRadioGroup;

    group.form = "external-radio-owner";

    expect(group.form === form).to.be.true;
    expect(group.getForm() === form).to.be.true;
    expect(new FormData(form).getAll("choice")).to.deep.equal(["a"]);
  });

  it("owns required and custom validity without leaving an invalid child control", async () => {
    const form = (await fixture(html`
      <form>
        <lr-radio-group name="choice" required>
          <lr-radio value="a">A</lr-radio>
          <lr-radio value="b">B</lr-radio>
        </lr-radio-group>
      </form>
    `)) as HTMLFormElement;
    const group = form.querySelector("lr-radio-group") as LyraRadioGroup;
    const radios = [...group.querySelectorAll("lr-radio")] as LyraRadio[];

    expect(group.validity.valueMissing).to.be.true;
    expect(
      radios.every((radio) => radio.validity.valid),
      "children are not aggregate proxies"
    ).to.be.true;
    expect(form.checkValidity()).to.be.false;

    group.value = "b";
    expect(group.validity.valid).to.be.true;
    expect(form.checkValidity()).to.be.true;

    group.setCustomValidity("Unavailable choice");
    expect(group.validity.customError).to.be.true;
    expect(group.validationMessage).to.equal("Unavailable choice");
    expect(form.checkValidity()).to.be.false;
    group.resetValidity();
    expect(group.validity.valid).to.be.true;

    group.setCustomValidity("Unavailable again");
    group.setCustomValidity();
    expect(
      group.validity.valid,
      "the published empty-message default also clears custom validity"
    ).to.be.true;
  });

  it("resets to the current child defaults and restores early state silently", async () => {
    const group = document.createElement("lr-radio-group") as LyraRadioGroup;
    group.name = "choice";
    const restored: string[] = [];
    group.addEventListener("change", () => restored.push("change"));
    group.formStateRestoreCallback("b", "restore");
    group.innerHTML = `
      <lr-radio value="a" checked>A</lr-radio>
      <lr-radio value="b">B</lr-radio>
    `;
    const form = document.createElement("form");
    form.append(group);
    document.body.append(form);
    try {
      await group.updateComplete;
      await new Promise((resolve) => setTimeout(resolve, 0));
      await group.updateComplete;
      const [a, b] = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
      expect(group.value).to.equal("b");
      expect([a.checked, b.checked]).to.deep.equal([false, true]);
      expect(restored).to.deep.equal([]);

      a.defaultChecked = false;
      b.defaultChecked = true;
      group.value = "a";
      form.reset();
      expect(group.value).to.equal("b");
      expect([a.checked, b.checked]).to.deep.equal([false, true]);
      expect(new FormData(form).getAll("choice")).to.deep.equal(["b"]);
    } finally {
      form.remove();
    }
  });
});

it("normalizes declarative, programmatic, restored, and reset state to one checked radio", async () => {
  const form = (await fixture(html`
    <form>
      <lr-radio-group name="choice">
        <lr-radio value="a" checked>A</lr-radio>
        <lr-radio value="b" checked>B</lr-radio>
      </lr-radio-group>
    </form>
  `)) as HTMLFormElement;
  const group = form.querySelector("lr-radio-group") as LyraRadioGroup;
  const [a, b] = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
  await group.updateComplete;

  expect(
    [a, b].filter((radio) => radio.checked).length,
    "declarative state"
  ).to.equal(1);

  a.checked = true;
  expect(a.checked, "the latest programmatic selection wins").to.be.true;
  expect(b.checked).to.be.false;

  group.formStateRestoreCallback("b", "restore");
  expect(a.checked).to.be.false;
  expect(b.checked, "restored state is normalized through the owner").to.be
    .true;

  form.reset();
  expect(
    [a, b].filter((radio) => radio.checked).length,
    "reset state"
  ).to.equal(1);
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

it("exposes exactly one aggregate lr-change shape when an owned radio is clicked or Space-activated", async () => {
  const group = (await fixture(html`
    <lr-radio-group label="Choice">
      <lr-radio value="a">A</lr-radio>
      <lr-radio value="b">B</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  const [a, b] = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
  const events: CustomEvent[] = [];
  group.addEventListener("lr-change", (event) =>
    events.push(event as CustomEvent)
  );

  a.click();
  (b.shadowRoot!.querySelector('[part="base"]') as HTMLElement).dispatchEvent(
    new KeyboardEvent("keydown", {
      key: " ",
      bubbles: true,
      composed: true,
      cancelable: true,
    })
  );

  expect(events.length).to.equal(2);
  expect(events.every((event) => event.target === group)).to.be.true;
  expect(events.map((event) => event.detail.value)).to.deep.equal(["a", "b"]);
  expect(events.map((event) => event.detail.radio)).to.deep.equal([a, b]);
  expect(events.every((event) => Object.isFrozen(event.detail))).to.be.true;
  expect(events[0]!.detail.radio === a).to.be.true;
  expect(events[1]!.detail.radio === b).to.be.true;
});

it("emits only the aggregate alias to a capture listener registered before group connect", async () => {
  const group = document.createElement("lr-radio-group") as LyraRadioGroup;
  const radio = document.createElement("lr-radio") as LyraRadio;
  radio.value = "a";
  radio.textContent = "A";
  group.append(radio);
  const events: CustomEvent[] = [];
  group.addEventListener(
    "lr-change",
    (event) => events.push(event as CustomEvent),
    {
      capture: true,
    }
  );
  const wrapper = await fixture(html`<div></div>`);
  wrapper.append(group);
  await group.updateComplete;
  const radioEvents: CustomEvent[] = [];
  radio.addEventListener("lr-change", (event) =>
    radioEvents.push(event as CustomEvent)
  );

  radio.click();

  expect(events).to.have.length(1);
  expect(events[0]!.target === group).to.equal(true);
  expect(events[0]!.detail).to.deep.equal({ value: "a", radio });
  expect(radioEvents).to.have.length(0);
});

it("switches between standalone and new-group lr-change ownership without waiting a microtask", async () => {
  const wrapper = await fixture(html`
    <div>
      <lr-radio-group id="source">
        <lr-radio value="a">A</lr-radio>
      </lr-radio-group>
      <lr-radio-group id="destination"></lr-radio-group>
    </div>
  `);
  const source = wrapper.querySelector("#source") as LyraRadioGroup;
  const destination = wrapper.querySelector("#destination") as LyraRadioGroup;
  const radio = source.querySelector("lr-radio") as LyraRadio;
  await Promise.all([source.updateComplete, destination.updateComplete]);
  const radioEvents: CustomEvent[] = [];
  const sourceEvents: CustomEvent[] = [];
  const destinationEvents: CustomEvent[] = [];
  radio.addEventListener("lr-change", (event) =>
    radioEvents.push(event as CustomEvent)
  );
  source.addEventListener("lr-change", (event) =>
    sourceEvents.push(event as CustomEvent)
  );
  destination.addEventListener("lr-change", (event) =>
    destinationEvents.push(event as CustomEvent)
  );

  radio.remove();
  radio.click();
  expect(radioEvents).to.have.length(1);
  expect(radioEvents[0]!.detail).to.deep.equal({ checked: true, value: "a" });
  expect(sourceEvents).to.have.length(0);

  radio.checked = false;
  destination.append(radio);
  radio.click();

  expect(radioEvents).to.have.length(1);
  expect(sourceEvents).to.have.length(0);
  expect(destinationEvents).to.have.length(1);
  expect(destinationEvents[0]!.target === destination).to.equal(true);
  expect(destinationEvents[0]!.detail).to.deep.equal({ value: "a", radio });
});

it("honors disabled-group membership and releases imposed state during synchronous reparenting", async () => {
  const wrapper = await fixture(html`
    <div>
      <lr-radio-group disabled></lr-radio-group>
      <lr-radio value="a">A</lr-radio>
    </div>
  `);
  const group = wrapper.querySelector("lr-radio-group") as LyraRadioGroup;
  const radio = wrapper.querySelector("lr-radio") as LyraRadio;
  const radioEvents: CustomEvent[] = [];
  const groupEvents: CustomEvent[] = [];
  radio.addEventListener("lr-change", (event) =>
    radioEvents.push(event as CustomEvent)
  );
  group.addEventListener("lr-change", (event) =>
    groupEvents.push(event as CustomEvent)
  );

  group.append(radio);
  expect(radio.effectiveDisabled).to.be.true;
  radio.click();
  expect(radio.checked).to.be.false;
  expect(radioEvents).to.have.length(0);
  expect(groupEvents).to.have.length(0);

  await new Promise((resolve) => queueMicrotask(resolve));
  await Promise.all([group.updateComplete, radio.updateComplete]);
  expect(radio.effectiveDisabled).to.be.true;

  radio.remove();
  expect(radio.effectiveDisabled).to.be.false;
  radio.click();
  expect(radio.checked).to.be.true;
  expect(radioEvents).to.have.length(1);
  expect(groupEvents).to.have.length(0);
});

it("synchronously reconciles both groups when a checked radio moves between named required groups", async () => {
  const form = (await fixture(html`
    <form>
      <lr-radio-group name="source" required>
        <lr-radio name="author-name" value="a" checked>A</lr-radio>
        <lr-radio value="b">B</lr-radio>
      </lr-radio-group>
      <lr-radio-group name="destination" required></lr-radio-group>
    </form>
  `)) as HTMLFormElement;
  const [source, destination] = [
    ...form.querySelectorAll("lr-radio-group"),
  ] as LyraRadioGroup[];
  const [moved, remaining] = [
    ...source.querySelectorAll("lr-radio"),
  ] as LyraRadio[];
  await Promise.all([source.updateComplete, destination.updateComplete]);
  expect(
    form.checkValidity(),
    "the empty destination group owns its required constraint"
  ).to.be.false;

  destination.append(moved);

  expect(moved.name).to.equal("author-name");
  expect(moved.effectiveName).to.equal("destination");
  expect(moved.effectiveRequired).to.be.true;
  expect(remaining.effectiveRequired).to.be.true;
  expect(
    remaining.validity.valid,
    "an owned child is not the group validity proxy"
  ).to.be.true;
  expect(source.validity.valueMissing).to.be.true;
  expect(form.checkValidity()).to.be.false;
  await Promise.all([
    source.updateComplete,
    destination.updateComplete,
    moved.updateComplete,
    remaining.updateComplete,
  ]);
  expect(
    remaining
      .shadowRoot!.querySelector('[part="base"]')!
      .getAttribute("aria-required")
  ).to.equal("true");
  expect(
    remaining
      .shadowRoot!.querySelector('[part="base"]')!
      .getAttribute("tabindex")
  ).to.equal("0");
});

it("releases group-imposed state while its group is disconnected and reapplies it on reconnect", async () => {
  const wrapper = await fixture(html`
    <div>
      <lr-radio-group name="group-name" disabled required>
        <lr-radio name="author-name" value="a">A</lr-radio>
      </lr-radio-group>
    </div>
  `);
  const group = wrapper.querySelector("lr-radio-group") as LyraRadioGroup;
  const radio = group.querySelector("lr-radio") as LyraRadio;
  await Promise.all([group.updateComplete, radio.updateComplete]);
  expect(radio.effectiveDisabled).to.be.true;
  expect(radio.name).to.equal("author-name");
  expect(radio.effectiveName).to.equal("group-name");

  group.remove();
  expect(radio.effectiveDisabled).to.be.false;
  expect(radio.effectiveRequired).to.be.false;
  expect(radio.name).to.equal("author-name");

  wrapper.append(group);
  expect(radio.effectiveDisabled).to.be.true;
  expect(radio.name).to.equal("author-name");
  expect(radio.effectiveName).to.equal("group-name");
});

it("preserves author-provided names while effective group authority changes", async () => {
  const group = (await fixture(html`
    <lr-radio-group name="group-name">
      <lr-radio name="author-name" value="a">A</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  const radio = group.querySelector("lr-radio") as LyraRadio;
  await group.updateComplete;
  expect(radio.name).to.equal("author-name");
  expect(radio.effectiveName).to.equal("group-name");

  group.name = "";
  await group.updateComplete;
  expect(radio.name).to.equal("author-name");
  expect(radio.getAttribute("name")).to.equal("author-name");
  expect(radio.effectiveName).to.equal("author-name");

  group.name = "second-group-name";
  await group.updateComplete;
  expect(radio.name).to.equal("author-name");
  expect(radio.effectiveName).to.equal("second-group-name");

  radio.remove();
  await new Promise((resolve) => queueMicrotask(resolve));
  await radio.updateComplete;
  expect(radio.name).to.equal("author-name");
  expect(radio.getAttribute("name")).to.equal("author-name");
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

it("keeps the author name through a direct move between already-connected named groups", async () => {
  const root = await fixture(html`
    <div>
      <lr-radio-group name="destination"></lr-radio-group>
      <lr-radio-group name="source">
        <lr-radio name="author-name" value="a">A</lr-radio>
      </lr-radio-group>
    </div>
  `);
  const [destination, source] = [
    ...root.querySelectorAll("lr-radio-group"),
  ] as LyraRadioGroup[];
  const radio = source.querySelector("lr-radio") as LyraRadio;
  destination.append(radio);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.all([
    destination.updateComplete,
    source.updateComplete,
    radio.updateComplete,
  ]);
  expect(radio.name).to.equal("author-name");
  expect(radio.effectiveName).to.equal("destination");

  destination.name = "";
  await destination.updateComplete;
  expect(radio.name).to.equal("author-name");
});

it("clears group-imposed disabled/required on every radio when turned back off", async () => {
  const group = (await fixture(html`
    <lr-radio-group label="Choice" disabled required>
      <lr-radio value="a">A</lr-radio>
      <lr-radio value="b">B</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  const radios = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
  expect(radios[0].effectiveDisabled).to.be.true;
  expect(
    radios.every((radio) => !radio.effectiveRequired),
    "disabled radios do not own an active form-validity constraint"
  ).to.be.true;
  const groupBase = group.shadowRoot!.querySelector(
    '[part="base"]'
  ) as HTMLElement;
  expect(groupBase.getAttribute("aria-required")).to.equal("true");
  expect(groupBase.getAttribute("aria-disabled")).to.equal("true");

  group.disabled = false;
  group.required = false;
  await group.updateComplete;
  await new Promise((resolve) => queueMicrotask(resolve));
  expect(radios[0].effectiveDisabled).to.be.false;
  expect(radios[1].effectiveDisabled).to.be.false;
  expect(radios[0].effectiveRequired).to.be.false;
  expect(radios[1].effectiveRequired).to.be.false;
  expect(groupBase.getAttribute("aria-disabled")).to.equal("false");
});

it("does not move or select from keyboard while the group or fieldset is disabled", async () => {
  const form = (await fixture(html`
    <form>
      <fieldset>
        <lr-radio-group label="Choice">
          <lr-radio value="a" checked>A</lr-radio>
          <lr-radio value="b">B</lr-radio>
        </lr-radio-group>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const group = form.querySelector("lr-radio-group") as LyraRadioGroup;
  const fieldset = form.querySelector("fieldset") as HTMLFieldSetElement;
  const [a, b] = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
  a.checked = true;

  group.disabled = true;
  await group.updateComplete;
  a.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      composed: true,
    })
  );
  expect(a.checked).to.be.true;
  expect(b.checked).to.be.false;

  group.disabled = false;
  fieldset.disabled = true;
  await group.updateComplete;
  await Promise.all([a.updateComplete, b.updateComplete]);
  expect(
    a.effectiveDisabled && b.effectiveDisabled,
    "group fieldset state reaches every option"
  ).to.be.true;
  expect(
    a.shadowRoot!.querySelector('[part~="base"]')!.getAttribute("aria-disabled")
  ).to.equal("true");
  a.dispatchEvent(
    new KeyboardEvent("keydown", { key: "End", bubbles: true, composed: true })
  );
  expect(a.checked).to.be.true;
  expect(b.checked).to.be.false;
});

it("reconciles appended and removed radios and releases group-imposed state", async () => {
  const group = (await fixture(html`
    <lr-radio-group name="choice" required disabled>
      <lr-radio value="a">A</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  group.name = "choice";
  const removed = group.querySelector("lr-radio") as LyraRadio;
  const added = document.createElement("lr-radio") as LyraRadio;
  added.value = "b";
  added.textContent = "B";
  const slot = group.shadowRoot!.querySelector(
    "slot:not([name])"
  ) as HTMLSlotElement;
  const appended = oneEvent(slot, "slotchange");
  group.append(added);
  await appended;
  await added.updateComplete;
  await group.updateComplete;

  expect(group.querySelectorAll("lr-radio").length).to.equal(2);
  expect(group.name).to.equal("choice");
  expect(group.getAttribute("name")).to.equal("choice");
  expect(added.effectiveDisabled).to.be.true;
  expect(
    added
      .shadowRoot!.querySelector('[part~="base"]')!
      .getAttribute("aria-required"),
    "disabled radios do not own the group validity constraint"
  ).to.equal("false");
  expect(
    added.shadowRoot!.querySelector('[part~="base"]')!.getAttribute("tabindex")
  ).to.equal("-1");

  const removedEvent = oneEvent(slot, "slotchange");
  removed.remove();
  await removedEvent;
  await removed.updateComplete;
  await group.updateComplete;
  expect(removed.effectiveDisabled).to.be.false;
  expect(
    removed
      .shadowRoot!.querySelector('[part="base"]')!
      .getAttribute("aria-required")
  ).to.equal("false");
  expect(
    removed.shadowRoot!.querySelector('[part="base"]')!.getAttribute("tabindex")
  ).to.equal("0");
});

it("floors the circle with min-* sizing instead of hard-sizing it, so the indicator can never overflow the tap target", async () => {
  const el = (await fixture(
    html`<lr-radio checked aria-label="One"></lr-radio>`
  )) as LyraRadio;
  await el.updateComplete;
  const circle = el.shadowRoot!.querySelector(
    '[part~="circle"]'
  ) as HTMLElement;

  // Default tokens at the default "m" tier:
  // min(--lr-icon-button-size 2.5rem, --lr-form-control-height 2.5rem * 0.7) === 1.75rem === 28px,
  // comfortably above the WCAG 2.2 SC 2.5.8 24x24 minimum. A label-less radio keeps the compact
  // circle inside its role owner's shared target floor.
  const floored = circle.getBoundingClientRect();
  expect(floored.width).to.be.closeTo(28, 0.5);
  expect(floored.height).to.be.closeTo(28, 0.5);

  // A hard `inline-size`/`block-size` cannot grow for its own content: enlarging the dot would clip
  // it and leave the circle at 28px. `min-inline-size`/`min-block-size` (the form <lr-checkbox>'s
  // [part='box'] already uses) is a floor, so the circle grows to contain the indicator instead.
  el.style.setProperty("--lr-radio-dot-size", "3rem");
  const grown = circle.getBoundingClientRect();
  expect(grown.width).to.be.at.least(48);
  expect(grown.height).to.be.at.least(48);
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
  expect(baseBounds.width).to.be.at.least(40);
  expect(baseBounds.height).to.be.at.least(40);
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
  function resolvedInShadow(
    el: LyraRadio,
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
  const rect = base.getBoundingClientRect();
  try {
    await sendMouse({
      type: "move",
      position: [
        Math.round(rect.left + rect.width / 2),
        Math.round(rect.top + rect.height / 2),
      ],
    });
    expect(getComputedStyle(circle).borderTopColor).to.equal("rgb(1, 2, 3)");
    await sendMouse({ type: "down" });
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

describe("lifecycle: attachInternals guard", () => {
  it("degrades gracefully instead of throwing when ElementInternals is unavailable", async () => {
    const original = (globalThis as { ElementInternals?: unknown })
      .ElementInternals;
    // Deliberately simulating an environment (e.g. happy-dom) with no ElementInternals
    // implementation at all.
    delete (globalThis as { ElementInternals?: unknown }).ElementInternals;
    try {
      expect(() => document.createElement("lr-radio")).to.not.throw();
      const el = (await fixture(
        html`<lr-radio value="a">A</lr-radio>`
      )) as LyraRadio;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelectorAll('[part="base"]').length).to.equal(
        1
      );
      expect(() => el.click()).to.not.throw();
    } finally {
      (globalThis as { ElementInternals?: unknown }).ElementInternals =
        original;
    }
  });

  it("degrades gracefully instead of throwing when the native attachInternals() call itself throws", async () => {
    // Scoped to just this tag -- default lyra-radio fixtures render no other
    // form-associated shadow children, but scope defensively anyway.
    const original = HTMLElement.prototype.attachInternals;
    HTMLElement.prototype.attachInternals = function (this: HTMLElement) {
      if (this.tagName.toLowerCase() === "lr-radio") {
        throw new DOMException(
          "attachInternals is not supported",
          "NotSupportedError"
        );
      }
      return original.call(this);
    };
    try {
      expect(() => document.createElement("lr-radio")).to.not.throw();
      const el = (await fixture(
        html`<lr-radio value="a">A</lr-radio>`
      )) as LyraRadio;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelectorAll('[part="base"]').length).to.equal(
        1
      );
      expect(() => el.click()).to.not.throw();
    } finally {
      HTMLElement.prototype.attachInternals = original;
    }
  });
});

describe("validationMessage localization", () => {
  it("defaults to the built-in English validationMessage for a required, unselected radio", async () => {
    const el = (await fixture(
      html`<lr-radio required value="a">A</lr-radio>`
    )) as LyraRadio;
    expect(el.validationMessage).to.equal("Please select an option.");
  });

  it("localizes the validationMessage via this.localize() when .strings overrides radioRequired", async () => {
    const el = (await fixture(html`
      <lr-radio
        required
        value="a"
        .strings=${{ radioRequired: "Veuillez sélectionner une option." }}
        >A</lr-radio
      >
    `)) as LyraRadio;
    expect(el.validationMessage).to.equal("Veuillez sélectionner une option.");

    el.checked = true;
    expect(el.validationMessage).to.equal("");
  });
});

// -- Degraded-DOM form-association fallback ---------------------------------

describe("inert ElementInternals fallback", () => {
  /** `<lr-radio>` guards on the *global* `ElementInternals` being defined at all, then on
   *  `attachInternals()` throwing -- a browser without form-association support, or a polyfill
   *  substitute. Both paths must yield inert internals rather than throwing at construction. */
  const withGlobalRemoved = async (
    assertion: (el: LyraRadio) => void
  ): Promise<void> => {
    const scope = globalThis as { ElementInternals?: unknown };
    const original = scope.ElementInternals;
    delete scope.ElementInternals;
    try {
      const el = (await fixture(
        html`<lr-radio value="a">A</lr-radio>`
      )) as LyraRadio;
      await el.updateComplete;
      assertion(el);
    } finally {
      scope.ElementInternals = original;
    }
  };

  it("falls back when the ElementInternals global is absent entirely", async () => {
    await withGlobalRemoved((el) => {
      const internals = (el as unknown as { internals: ElementInternals })
        .internals;
      expect(internals.form === null).to.equal(true);
      expect(internals.willValidate).to.be.false;
      expect(internals.validationMessage).to.equal("");
      expect(internals.checkValidity()).to.be.true;
      expect(internals.reportValidity()).to.be.true;
      expect(() => internals.setFormValue("a")).to.not.throw();
      expect(() => internals.setValidity({}, "")).to.not.throw();
    });
  });

  it("falls back when attachInternals throws", async () => {
    const proto = HTMLElement.prototype as unknown as {
      attachInternals?: unknown;
    };
    const original = proto.attachInternals;
    proto.attachInternals = () => {
      throw new DOMException("unsupported");
    };
    try {
      const el = (await fixture(
        html`<lr-radio value="a">A</lr-radio>`
      )) as LyraRadio;
      await el.updateComplete;
      const internals = (el as unknown as { internals: ElementInternals })
        .internals;
      expect(internals.checkValidity()).to.be.true;
      expect(internals.reportValidity()).to.be.true;
    } finally {
      proto.attachInternals = original;
    }
  });
});

it("fires input and change for arrow-key selection, matching click and Space", async () => {
  const group = (await fixture(html`
    <lr-radio-group label="Size">
      <lr-radio value="s">S</lr-radio>
      <lr-radio value="m">M</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  const radios = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
  const firstBase = radios[0]!.shadowRoot!.querySelector(
    '[part="base"]'
  ) as HTMLElement;
  radios[0]!.checked = true;
  firstBase.focus();

  const seen: Array<{ type: string; event: Event }> = [];
  for (const type of ["input", "lr-input", "change", "lr-change"]) {
    group.addEventListener(type, (event) => seen.push({ type, event }));
  }

  const pending = oneEvent(group, "lr-change");
  firstBase.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      composed: true,
      cancelable: true,
    })
  );
  await pending;

  expect(radios[1]!.checked, "arrow navigation moves the selection").to.be.true;
  // Native <input type=radio> fires input+change on arrow navigation; a consumer bound to the
  // native-mirroring events must not silently miss keyboard selection.
  expect(seen.map(({ type }) => type)).to.deep.equal([
    "input",
    "lr-input",
    "change",
    "lr-change",
  ]);
  expect(seen[0].event instanceof InputEvent).to.be.true;
  expect(seen[2].event.constructor === Event).to.be.true;
  expect(seen[0].event.target === group && seen[2].event.target === group).to.be
    .true;
  expect(seen[1].event instanceof CustomEvent).to.be.true;
  expect((seen[1].event as CustomEvent).detail.value).to.equal("m");
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

describe("pill", () => {
  it("defaults to false and reflects when set", async () => {
    const el = (await fixture(
      html`<lr-radio value="a">Alpha</lr-radio>`
    )) as LyraRadio;
    await el.updateComplete;
    expect(el.pill).to.equal(false);
    expect(el.hasAttribute("pill")).to.equal(false);
    el.pill = true;
    await el.updateComplete;
    expect(el.hasAttribute("pill")).to.equal(true);
  });

  it("leaves the indicator fully round, which it already is", async () => {
    const el = (await fixture(
      html`<lr-radio pill value="a">Alpha</lr-radio>`
    )) as LyraRadio;
    await el.updateComplete;
    const circle = el.shadowRoot!.querySelector(
      '[part~="circle"]'
    ) as HTMLElement;
    const radius = Number.parseFloat(
      getComputedStyle(circle).borderStartStartRadius
    );
    expect(radius).to.be.at.least(circle.getBoundingClientRect().width / 2);
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
      [...el.querySelectorAll("lr-radio, lr-radio-button")].map(
        (radio) => radio.updateComplete
      )
    );
    expect(
      [...el.querySelectorAll("lr-radio, lr-radio-button")].map(
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
  it("defaults vertical, exposes aria-orientation, and ignores horizontal arrows", async () => {
    const group = (await fixture(html`
      <lr-radio-group label="Choice">
        <lr-radio value="a" checked>A</lr-radio>
        <lr-radio value="b">B</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup & { orientation: "horizontal" | "vertical" };
    const [a, b] = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
    const aBase = a.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    const radiogroup = group.shadowRoot!.querySelector(
      '[role="radiogroup"]'
    ) as HTMLElement;
    expect(group.orientation).to.equal("vertical");
    expect(group.getAttribute("orientation")).to.equal("vertical");
    expect(radiogroup.getAttribute("aria-orientation")).to.equal("vertical");

    const ignored = new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    aBase.dispatchEvent(ignored);
    expect(ignored.defaultPrevented).to.be.false;
    expect(a.checked).to.be.true;

    const changed = oneEvent(group, "change");
    aBase.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
    await changed;
    expect(b.checked).to.be.true;
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

  it("focuses the selected option, or the first enabled option when empty", async () => {
    const group = (await fixture(html`
      <lr-radio-group label="Choice">
        <lr-radio value="a" disabled>A</lr-radio>
        <lr-radio value="b">B</lr-radio>
        <lr-radio value="c" checked>C</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    const [, b, c] = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
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

// `internals.states` (CustomStateSet) reached Chromium 125 / Safari 17.4 / Firefox 126, and the
// `:state()` SELECTOR landed separately from the API. Both are guarded because the helper no-ops
// where either is missing -- an unguarded assertion fails on WebKit rather than skipping.
const supportsCustomStates = (() => {
  try {
    return typeof CustomStateSet === "function";
  } catch {
    return false;
  }
})();
const supportsStateSelector = (() => {
  try {
    document.createElement("div").matches(":state(x)");
    return true;
  } catch {
    return false;
  }
})();

describe("lr-radio validity custom states", () => {
  it("publishes required/optional and valid/invalid from the first render", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(
      html`<lr-radio required value="a">One</lr-radio>`
    )) as LyraRadio;
    await el.updateComplete;
    expect(el.matches(":state(required)"), "required").to.be.true;
    expect(el.matches(":state(optional)"), "optional").to.be.false;
    expect(el.matches(":state(invalid)"), "invalid").to.be.true;
    expect(el.matches(":state(valid)"), "valid").to.be.false;

    const optional = (await fixture(
      html`<lr-radio value="a">One</lr-radio>`
    )) as LyraRadio;
    await optional.updateComplete;
    expect(optional.matches(":state(optional)")).to.be.true;
    expect(optional.matches(":state(valid)")).to.be.true;
  });

  it("reads an owning required group as required, not just its own attribute", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const group = (await fixture(html`
      <lr-radio-group required name="pick" label="Pick">
        <lr-radio value="a">One</lr-radio>
        <lr-radio value="b">Two</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    await group.updateComplete;
    const first = group.querySelector("lr-radio") as LyraRadio;
    expect(first.hasAttribute("required"), "no attribute of its own").to.be
      .false;
    expect(first.matches(":state(required)"), "required through the group").to
      .be.true;
    expect(first.matches(":state(optional)")).to.be.false;
  });

  it("withholds user-valid/user-invalid until the user has actually interacted", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(
      html`<lr-radio required value="a">One</lr-radio>`
    )) as LyraRadio;
    await el.updateComplete;
    expect(
      el.matches(":state(user-invalid)"),
      "pristine required must not read as an error"
    ).to.be.false;
    expect(el.matches(":state(user-valid)")).to.be.false;

    el.click();
    await el.updateComplete;
    expect(el.checked).to.be.true;
    expect(el.matches(":state(valid)")).to.be.true;
    expect(
      el.matches(":state(user-valid)"),
      "user-valid after a real selection"
    ).to.be.true;
  });

  it("marks a required standalone radio user-invalid when reportValidity runs", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(
      html`<lr-radio required value="a">One</lr-radio>`
    )) as LyraRadio;
    await el.updateComplete;
    expect(el.matches(":state(user-invalid)"), "pristine before reporting").to
      .be.false;

    expect(el.reportValidity()).to.be.false;
    await el.updateComplete;
    expect(
      el.matches(":state(user-invalid)"),
      "a validity report is user interaction"
    ).to.be.true;
  });

  it("does not turn a disabled blur into user interaction for either radio rendering", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const wrapper = await fixture<HTMLDivElement>(html`
      <div>
        <lr-radio required value="standard">Standard</lr-radio>
        <lr-radio-button required value="button">Button</lr-radio-button>
      </div>
    `);
    const radios = Array.from(
      wrapper.querySelectorAll("lr-radio, lr-radio-button")
    ) as LyraRadio[];

    for (const radio of radios) {
      const base = radio.shadowRoot!.querySelector(
        '[part~="base"]'
      ) as HTMLElement;
      radio.disabled = true;
      base.dispatchEvent(new FocusEvent("blur"));
      radio.disabled = false;
      await radio.updateComplete;
      expect(
        radio.matches(":state(user-invalid)"),
        `${radio.localName} stays pristine`
      ).to.be.false;
    }
  });

  it("goes pristine again after a form reset", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const form = await fixture<HTMLFormElement>(
      html`<form><lr-radio name="pick" required value="a">One</lr-radio></form>`
    );
    const el = form.querySelector("lr-radio") as LyraRadio;
    await el.updateComplete;
    el.click();
    await el.updateComplete;
    expect(el.matches(":state(user-valid)")).to.be.true;
    form.reset();
    await el.updateComplete;
    expect(
      el.matches(":state(user-valid)"),
      "reset returns the control to pristine"
    ).to.be.false;
    expect(el.matches(":state(user-invalid)")).to.be.false;
    expect(
      el.matches(":state(invalid)"),
      "unchecked again, so intrinsically invalid"
    ).to.be.true;
  });
});

describe("lr-radio setCustomValidity()", () => {
  it("blocks form submission and becomes the validationMessage", async () => {
    const form = (await fixture(html`
      <form><lr-radio name="plan" value="pro" checked>Pro</lr-radio></form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-radio") as LyraRadio;
    let submits = 0;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submits += 1;
    });

    form.requestSubmit();
    expect(submits, "an otherwise-valid radio submits").to.equal(1);

    el.setCustomValidity("That plan is no longer available");
    expect(el.validationMessage).to.equal("That plan is no longer available");
    expect(el.validity.customError, "customError").to.be.true;
    expect(el.checkValidity()).to.be.false;

    form.requestSubmit();
    expect(submits, "a custom error blocks submission").to.equal(1);
  });

  it("survives an intrinsic revalidation", async () => {
    const el = (await fixture(
      html`<lr-radio required value="pro">Pro</lr-radio>`
    )) as LyraRadio;
    el.setCustomValidity("Server says no");
    el.checked = true; // clears valueMissing and re-runs the intrinsic recompute
    expect(el.validity.valueMissing, "valueMissing cleared").to.be.false;
    expect(el.validity.customError, "custom error survives the recompute").to.be
      .true;
    expect(el.validationMessage).to.equal("Server says no");
  });

  // Native `setCustomValidity()` is sticky: `form.reset()` restores values, never the custom
  // error, which only another `setCustomValidity('')` clears. Matching that here.
  it("keeps the custom error across a form reset", async () => {
    const form = (await fixture(html`
      <form><lr-radio name="plan" value="pro">Pro</lr-radio></form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-radio") as LyraRadio;
    el.setCustomValidity("Server says no");
    form.reset();
    await el.updateComplete;
    expect(el.validity.customError).to.be.true;
    expect(el.validationMessage).to.equal("Server says no");
  });

  it("resetValidity() restores computed validity rather than forcing the control valid", async () => {
    const el = (await fixture(
      html`<lr-radio required value="pro">Pro</lr-radio>`
    )) as LyraRadio;
    el.setCustomValidity("Server says no");
    el.resetValidity();
    expect(el.validity.customError, "custom error cleared").to.be.false;
    expect(
      el.validity.valueMissing,
      "an empty custom error must not force a still-unchecked required control valid"
    ).to.be.true;
    expect(el.checkValidity()).to.be.false;
    expect(el.validationMessage).to.not.equal("");
    el.checked = true;
    expect(el.checkValidity()).to.be.true;
  });

  it("drives the valid/invalid custom states", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(
      html`<lr-radio value="pro">Pro</lr-radio>`
    )) as LyraRadio;
    await el.updateComplete;
    expect(el.matches(":state(valid)"), "valid before").to.be.true;
    el.setCustomValidity("Server says no");
    expect(el.matches(":state(invalid)"), "invalid while a custom error is set")
      .to.be.true;
    expect(el.matches(":state(valid)")).to.be.false;
    el.setCustomValidity("");
    expect(el.matches(":state(valid)"), "valid again once cleared").to.be.true;
  });

  it("routes custom validity through the aggregate group owner", async () => {
    const group = (await fixture(html`
      <lr-radio-group name="plan" label="Plan">
        <lr-radio value="pro">Pro</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    const radio = group.querySelector("lr-radio") as LyraRadio & {
      customError: string | null;
    };
    radio.customError = "Server says no";
    expect(group.validity.customError).to.be.true;
    expect(radio.validity.valid).to.be.true;
    expect(radio.customError).to.equal("Server says no");
    radio.customError = null;
    expect(group.validity.valid).to.be.true;
  });

  it("transfers a standalone custom error when a radio becomes group-owned", async () => {
    const form = (await fixture(html`
      <form><lr-radio-group name="plan" label="Plan"></lr-radio-group></form>
    `)) as HTMLFormElement;
    const group = form.querySelector("lr-radio-group") as LyraRadioGroup;
    const radio = document.createElement("lr-radio") as LyraRadio;
    radio.value = "pro";
    radio.checked = true;
    radio.setCustomValidity("Server says no");

    group.append(radio);
    await Promise.all([group.updateComplete, radio.updateComplete]);

    expect(
      radio.validity.valid,
      "the owned child no longer participates in validity"
    ).to.be.true;
    expect(
      group.validity.customError,
      "the aggregate owner retains the rejection"
    ).to.be.true;
    expect(group.validationMessage).to.equal("Server says no");
    expect(form.checkValidity()).to.be.false;
  });
});

it("exposes the group willValidate flag and reports validity on demand", async () => {
  const form = (await fixture(html`
    <form>
      <lr-radio-group name="choice" required label="Choice">
        <lr-radio value="a">A</lr-radio>
        <lr-radio value="b">B</lr-radio>
      </lr-radio-group>
    </form>
  `)) as HTMLFormElement;
  const group = form.querySelector("lr-radio-group") as LyraRadioGroup;
  await group.updateComplete;
  expect(group.willValidate).to.equal(true);
  expect(group.checkValidity()).to.equal(false);
  expect(group.reportValidity()).to.equal(false);
  await group.updateComplete;
  expect(group.matches(":state(user-invalid)")).to.equal(true);

  group.value = "a";
  await group.updateComplete;
  expect(group.reportValidity()).to.equal(true);
});

it("bars the group from constraint validation while disabled, like a native disabled control", async () => {
  const group = (await fixture(html`
    <lr-radio-group required disabled label="Choice">
      <lr-radio value="a">A</lr-radio>
      <lr-radio value="b">B</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  await group.updateComplete;
  expect(group.validity.valueMissing, "a barred group raises no violation").to
    .be.false;
  expect(group.checkValidity()).to.be.true;

  group.disabled = false;
  await group.updateComplete;
  expect(
    group.validity.valueMissing,
    "the violation returns once it is enforceable again"
  ).to.be.true;
});

it("bars a standalone radio from constraint validation while disabled", async () => {
  const el = (await fixture(
    html`<lr-radio required disabled value="a">A</lr-radio>`
  )) as LyraRadio;
  await el.updateComplete;
  expect(el.validity.valueMissing, "a barred radio raises no violation").to.be
    .false;
  expect(el.checkValidity()).to.be.true;

  el.disabled = false;
  await el.updateComplete;
  expect(
    el.validity.valueMissing,
    "the violation returns once it is enforceable again"
  ).to.be.true;
});

describe("lr-radio-group branch-coverage edge cases", () => {
  it("normalizes a null defaultValue write to empty, clearing the reflected value attribute", async () => {
    const group = (await fixture(html`
      <lr-radio-group value="a">
        <lr-radio value="a">A</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    await group.updateComplete;
    expect(group.hasAttribute("value")).to.be.true;

    // The public type is `string`, but the setter is written defensively against a raw `null`
    // write (e.g. from untyped JS or a lenient framework binding) -- exercise that directly.
    (group as unknown as { defaultValue: string }).defaultValue =
      null as unknown as string;
    expect(
      group.defaultValue,
      "a null write normalizes to empty, matching the public string contract"
    ).to.equal("");
    expect(
      group.hasAttribute("value"),
      "an empty default removes the reflected attribute rather than leaving it blank"
    ).to.be.false;
  });

  it("ignores an invalid event from a light-DOM descendant it does not own", async () => {
    const group = (await fixture(html`
      <lr-radio-group required label="Choice">
        <lr-radio value="a">A</lr-radio>
        <div slot="hint"><lr-radio value="helper">Helper</lr-radio></div>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    await group.updateComplete;
    const helper = group.querySelector('[slot="hint"] lr-radio') as LyraRadio;
    // `helper` is a standalone form participant (not group-owned) and installs its own native ->
    // `lr-invalid` alias, which legitimately bubbles up through the group -- that is unrelated to
    // the group's own aggregate alias, so only a `target === group` event would prove the group
    // mistakenly claimed ownership of an event it does not own.
    const groupOwnedAliases: CustomEvent[] = [];
    group.addEventListener("lr-invalid", (event) => {
      if (event.target === group) groupOwnedAliases.push(event as CustomEvent);
    });

    const invalid = new Event("invalid", { cancelable: true });
    helper.dispatchEvent(invalid);

    expect(
      groupOwnedAliases,
      "a support-slot radio is not group-owned, so the group never claims its invalid event as its own aggregate alias"
    ).to.have.lengthOf(0);
    expect(
      invalid.defaultPrevented,
      "the group must not veto an invalid event it does not own"
    ).to.be.false;
  });

  it("ignores an invalid event with no element target at all (defensive)", async () => {
    const group = (await fixture(
      html`<lr-radio-group></lr-radio-group>`
    )) as LyraRadioGroup;
    await group.updateComplete;
    const internals = group as unknown as { onInvalid(event: Event): void };
    const fakeEvent = { target: null, preventDefault() {} } as unknown as Event;
    let aliasCount = 0;
    group.addEventListener("lr-invalid", () => {
      aliasCount += 1;
    });

    expect(() => internals.onInvalid(fakeEvent)).to.not.throw();
    expect(aliasCount).to.equal(0);
  });

  it("no-ops arming the membership observer while disconnected", () => {
    const group = document.createElement("lr-radio-group") as LyraRadioGroup;
    const internals = group as unknown as {
      armMembershipObserver(): void;
      membershipObserver?: MutationObserver;
    };
    expect(() => internals.armMembershipObserver()).to.not.throw();
    expect(
      internals.membershipObserver,
      "a disconnected host never gets an observer"
    ).to.equal(undefined);
  });

  it("skips re-arming an already-current membership observer for the same owner document", async () => {
    const group = (await fixture(html`
      <lr-radio-group><lr-radio value="a">A</lr-radio></lr-radio-group>
    `)) as LyraRadioGroup;
    await group.updateComplete;
    const internals = group as unknown as {
      armMembershipObserver(): void;
      membershipObserver?: MutationObserver;
    };
    const first = internals.membershipObserver;
    expect(first, "connecting already armed one observer").to.exist;
    internals.armMembershipObserver();
    expect(
      internals.membershipObserver,
      "a redundant arm call in the same document is a no-op"
    ).to.equal(first);
  });

  it("drops the membership observer follow-up microtask once the group has since disconnected", async () => {
    const NativeMutationObserver = window.MutationObserver;
    let groupCallback: MutationCallback | undefined;
    let group!: LyraRadioGroup;
    // A fully fake (non-extending) stand-in, matching the pattern already used above for the
    // adopted-realm test -- `armMembershipObserver()` only needs a constructible `MutationObserver`
    // shape, and the outer callback is invoked directly below rather than through a real mutation.
    class TrackingMutationObserver implements MutationObserver {
      private readonly callback: MutationCallback;
      constructor(callback: MutationCallback) {
        this.callback = callback;
      }
      observe(target: Node, options?: MutationObserverInit): void {
        // Identified by its distinctive attributeFilter shape rather than `target === group`: the
        // outer `group` binding is only assigned once the `fixture()` promise resolves, which is
        // *after* the synchronous connect (and this synchronous `observe()` call) already ran.
        const filter = options?.attributeFilter;
        if (
          (target as Element)?.localName === "lr-radio-group" &&
          filter?.includes("checked") &&
          filter?.includes("slot")
        ) {
          groupCallback = this.callback;
        }
      }
      takeRecords(): MutationRecord[] {
        return [];
      }
      disconnect(): void {}
    }
    (window as unknown as { MutationObserver: unknown }).MutationObserver =
      TrackingMutationObserver;
    try {
      group = (await fixture(
        html`<lr-radio-group></lr-radio-group>`
      )) as LyraRadioGroup;
      await group.updateComplete;
      expect(groupCallback, "connecting arms the membership observer").to.be.a(
        "function"
      );
    } finally {
      window.MutationObserver = NativeMutationObserver;
    }

    const originalQueueMicrotask = window.queueMicrotask;
    let followUp: (() => void) | undefined;
    (
      window as unknown as { queueMicrotask: typeof window.queueMicrotask }
    ).queueMicrotask = ((fn: () => void) => {
      followUp = fn;
    }) as typeof window.queueMicrotask;
    const internals = group as unknown as { syncRadios(): void };
    const originalSyncRadios = internals.syncRadios.bind(group);
    const staleCalls: boolean[] = [];
    internals.syncRadios = () => {
      staleCalls.push(true);
      originalSyncRadios();
    };
    try {
      groupCallback!([], {} as MutationObserver);
      expect(
        followUp,
        "a passing outer guard queues its own follow-up microtask"
      ).to.be.a("function");

      group.remove();
      followUp!();

      expect(
        staleCalls,
        "the stale follow-up must bail before resyncing a disconnected group"
      ).to.deep.equal([]);
    } finally {
      window.queueMicrotask = originalQueueMicrotask;
      internals.syncRadios = originalSyncRadios;
    }
  });

  it("skips arming a membership observer and bails from onRadioSlotChange when the owner document reports no defaultView", async () => {
    const group = (await fixture(html`
      <lr-radio-group><lr-radio value="a">A</lr-radio></lr-radio-group>
    `)) as LyraRadioGroup;
    await group.updateComplete;
    const internals = group as unknown as {
      armMembershipObserver(): void;
      resetMembershipObserver(): void;
      onRadioSlotChange(): void;
      membershipObserver?: MutationObserver;
    };
    internals.resetMembershipObserver();
    expect(internals.membershipObserver).to.equal(undefined);

    // Same technique as elsewhere in this codebase (see theme-watcher.test.ts) for simulating a
    // defaultView-less owner document without actually adopting into one -- this component's real
    // shadow root uses adopted constructed stylesheets, which cannot themselves be adopted into a
    // document created via `DOMImplementation.createHTMLDocument()`, so faking just the getter
    // exercises the same guard without that unrelated stylesheet limitation.
    Object.defineProperty(group, "ownerDocument", {
      configurable: true,
      value: { defaultView: null },
    });
    try {
      expect(() => internals.armMembershipObserver()).to.not.throw();
      expect(
        internals.membershipObserver,
        "no window means no MutationObserver to construct"
      ).to.equal(undefined);
      expect(() => internals.onRadioSlotChange()).to.not.throw();
    } finally {
      delete (group as unknown as { ownerDocument?: unknown }).ownerDocument;
    }
  });

  it("treats a disconnected, never-owned radio as unowned across ownsRadio/reconcileRadio/releaseRadio", async () => {
    const group = (await fixture(html`
      <lr-radio-group><lr-radio value="a">A</lr-radio></lr-radio-group>
    `)) as LyraRadioGroup;
    await group.updateComplete;
    const bare = document.createElement("lr-radio") as LyraRadio;
    bare.value = "b";

    expect(
      group.ownsRadio(bare),
      "an element with no ancestor radio-group at all is never owned"
    ).to.be.false;
    expect(
      group.reconcileRadio(bare),
      "reconciling an unowned radio is a no-op that reports failure"
    ).to.be.false;
    expect(() => group.releaseRadio(bare)).to.not.throw();
  });

  it("refuses to select through a disabled group, a disabled radio, or an unowned radio", async () => {
    const group = (await fixture(html`
      <lr-radio-group disabled>
        <lr-radio value="a">A</lr-radio>
        <lr-radio value="b" disabled>B</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    await group.updateComplete;
    const [a, b] = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
    const bare = document.createElement("lr-radio") as LyraRadio;
    bare.value = "c";

    expect(group.selectRadio(a), "a disabled group refuses every selection").to
      .be.false;

    group.disabled = false;
    await group.updateComplete;
    expect(
      group.selectRadio(b),
      "a disabled radio refuses selection even in an enabled group"
    ).to.be.false;
    expect(group.selectRadio(bare), "an unowned radio is never selectable").to
      .be.false;
    expect(
      group.selectRadio(a),
      "the enabled owned radio still selects normally"
    ).to.be.true;
  });

  it("normalizes a null value write on the private selectValue helper the same as an empty string", async () => {
    const group = (await fixture(html`
      <lr-radio-group>
        <lr-radio value="a" checked>A</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    await group.updateComplete;
    const internals = group as unknown as {
      selectValue(next: string | null): void;
    };

    internals.selectValue(null);

    expect(group.value).to.equal("");
    expect((group.querySelector("lr-radio") as LyraRadio).checked).to.be.false;
  });

  it("clears the checked radio when a pending restored/reset selection matches nothing", async () => {
    const group = document.createElement("lr-radio-group") as LyraRadioGroup;
    group.formStateRestoreCallback("missing", "restore");
    group.innerHTML = `
      <lr-radio value="a">A</lr-radio>
      <lr-radio value="b">B</lr-radio>
    `;
    document.body.append(group);
    try {
      await group.updateComplete;
      await new Promise((resolve) => setTimeout(resolve, 0));
      await group.updateComplete;
      const radios = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
      expect(group.value).to.equal("");
      expect(radios.every((radio) => !radio.checked)).to.be.true;
    } finally {
      group.remove();
    }
  });

  it("reflects the customError property through the custom-error attribute", async () => {
    const group = (await fixture(
      html`<lr-radio-group></lr-radio-group>`
    )) as LyraRadioGroup;
    await group.updateComplete;

    group.customError = "Nope";
    expect(group.getAttribute("custom-error")).to.equal("Nope");
    expect(group.customError).to.equal("Nope");
    expect(group.validity.customError).to.be.true;

    group.customError = null;
    expect(
      group.hasAttribute("custom-error"),
      "a null customError removes the reflected attribute"
    ).to.be.false;
    expect(group.validity.customError).to.be.false;
  });

  it("keeps group validity methods and the reflected custom-error state atomic when clearing", async () => {
    const group = (await fixture(html`
      <lr-radio-group label="Plan">
        <lr-radio value="free">Free</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;

    group.setCustomValidity("Unavailable");
    expect(group.customError).to.equal("Unavailable");
    expect(group.getAttribute("custom-error")).to.equal("Unavailable");

    group.setCustomValidity("");
    expect(group.customError).to.equal(null);
    expect(group.hasAttribute("custom-error")).to.equal(false);

    group.customError = "Unavailable again";
    group.resetValidity();
    expect(group.customError).to.equal(null);
    expect(group.hasAttribute("custom-error")).to.equal(false);

    group.customError = "";
    expect(group.customError).to.equal(null);
    expect(group.hasAttribute("custom-error")).to.equal(false);
  });

  it("normalizes a null name/value property write to empty, matching the string contract", async () => {
    const group = (await fixture(html`
      <lr-radio-group name="choice" value="a">
        <lr-radio value="a">A</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    await group.updateComplete;

    group.name = null;
    expect(group.name).to.equal("");
    expect(group.hasAttribute("name")).to.be.false;

    group.value = null;
    expect(group.value).to.equal("");
    expect((group.querySelector("lr-radio") as LyraRadio).checked).to.be.false;
  });

  it("restores a standalone radio's native default value when its value is set to null", async () => {
    const radio = (await fixture(
      html`<lr-radio name="choice" value="custom" checked>Choice</lr-radio>`
    )) as LyraRadio;
    (radio as unknown as { value: string | null }).value = null;
    expect(radio.value).to.equal("on");
    expect(radio.hasAttribute("value")).to.equal(false);
    await radio.updateComplete;
    expect(radio.getAttribute("value")).to.equal("on");
  });

  it("does not move focus when a fieldset disables the radio group in the same task", async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div>
        <button type="button">Elsewhere</button>
        <fieldset>
          <lr-radio-group label="Choice">
            <lr-radio value="a">A</lr-radio>
          </lr-radio-group>
        </fieldset>
      </div>
    `);
    const button = wrapper.querySelector("button")!;
    const fieldset = wrapper.querySelector("fieldset")!;
    const group = wrapper.querySelector("lr-radio-group") as LyraRadioGroup;
    button.focus();
    fieldset.disabled = true;
    group.focus();
    expect(document.activeElement === button).to.equal(true);
  });

  it('navigates horizontally in plain LTR (no dir="rtl"), unlike the already-covered RTL case', async () => {
    const group = (await fixture(html`
      <lr-radio-group orientation="horizontal" label="Choice">
        <lr-radio value="a" checked>A</lr-radio>
        <lr-radio value="b">B</lr-radio>
        <lr-radio value="c">C</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    const [a, b, c] = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
    await group.updateComplete;
    const aBase = a.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;

    let changed = oneEvent(group, "change");
    aBase.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
    await changed;
    expect(b.checked, "ArrowRight moves forward under plain LTR").to.be.true;

    const bBase = b.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    changed = oneEvent(group, "change");
    bBase.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowLeft",
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
    await changed;
    expect(a.checked, "ArrowLeft moves backward under plain LTR").to.be.true;
    expect(c.checked).to.be.false;
  });

  it("moves selection to the first enabled option on Home and the last on End", async () => {
    const group = (await fixture(html`
      <lr-radio-group label="Choice">
        <lr-radio value="a">A</lr-radio>
        <lr-radio value="b" checked>B</lr-radio>
        <lr-radio value="c">C</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    const [a, b, c] = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
    await group.updateComplete;
    const bBase = b.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;

    let changed = oneEvent(group, "change");
    bBase.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Home",
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
    await changed;
    expect(a.checked, "Home selects the first enabled option").to.be.true;

    const aBase = a.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    changed = oneEvent(group, "change");
    aBase.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "End",
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
    await changed;
    expect(c.checked, "End selects the last enabled option").to.be.true;
  });

  it("ignores a keydown whose own dispatching radio is individually disabled", async () => {
    const group = (await fixture(html`
      <lr-radio-group label="Choice">
        <lr-radio value="a" checked>A</lr-radio>
        <lr-radio value="b" disabled>B</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    const [a, b] = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
    await group.updateComplete;

    // A disabled radio is never a real keyboard focus target, but a synthetic event dispatched
    // straight from it must still be rejected by the group's own defensive re-check.
    b.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        composed: true,
      })
    );
    expect(a.checked).to.be.true;
    expect(b.checked).to.be.false;
  });

  it("excludes hidden, inert, and aria-disabled ancestor subtrees from roving navigation", async () => {
    const group = (await fixture(html`
      <lr-radio-group label="Choice">
        <lr-radio value="a" checked>A</lr-radio>
        <span inert><lr-radio value="b">B</lr-radio></span>
        <span aria-hidden=" TRUE "><lr-radio value="c">C</lr-radio></span>
        <span aria-disabled=" true "><lr-radio value="d">D</lr-radio></span>
        <lr-radio value="e">E</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    const [a, b, c, d, e] = [
      ...group.querySelectorAll("lr-radio"),
    ] as LyraRadio[];
    await group.updateComplete;

    const changed = oneEvent(group, "change");
    a.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
    await changed;
    expect(e.checked).to.be.true;
    expect([b, c, d].every((radio) => !radio.checked)).to.be.true;
  });

  it("observes live ancestor availability changes and keeps exactly one available roving stop", async () => {
    const group = (await fixture(html`
      <lr-radio-group label="Choice">
        <span id="first-wrap"><lr-radio value="a" checked>A</lr-radio></span>
        <span id="second-wrap"><lr-radio value="b">B</lr-radio></span>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    const [a, b] = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
    const firstWrap = group.querySelector<HTMLElement>("#first-wrap")!;
    await group.updateComplete;

    firstWrap.setAttribute("aria-hidden", " TRUE ");
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    await group.updateComplete;
    const tabStops = [a, b].filter(
      (radio) =>
        radio.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!
          .tabIndex === 0
    );
    expect(tabStops.length).to.equal(1);
    expect(tabStops[0]?.value).to.equal("b");
  });

  it("ignores a composed keydown retargeted to a nested inner group that owns no radios itself", async () => {
    const outer = (await fixture(html`
      <lr-radio-group label="Outer">
        <lr-radio value="p" checked>P</lr-radio>
        <lr-radio-group label="Inner">
          <lr-radio value="x" checked>X</lr-radio>
        </lr-radio-group>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    await outer.updateComplete;
    const [p] = [...outer.querySelectorAll(":scope > lr-radio")] as LyraRadio[];
    // `:scope > lr-radio-group lr-radio` (not the ambiguous `lr-radio-group lr-radio`, which would
    // also match `p` itself as a descendant of the outer group) unambiguously reaches the inner
    // group's own radio.
    const innerGroup = outer.querySelector(
      ":scope > lr-radio-group"
    ) as LyraRadioGroup;
    const innerRadio = innerGroup.querySelector("lr-radio") as LyraRadio;
    await innerRadio.updateComplete;
    const innerBase = innerRadio.shadowRoot!.querySelector(
      '[part~="base"]'
    ) as HTMLElement;

    innerBase.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );

    expect(
      p.checked,
      "the outer group must not navigate based on an inner-group-owned keydown"
    ).to.be.true;
  });

  it("tracks label and error slot presence through live slotchange, showing each hidden part", async () => {
    const group = (await fixture(html`
      <lr-radio-group><lr-radio value="a">A</lr-radio></lr-radio-group>
    `)) as LyraRadioGroup;
    await group.updateComplete;
    const labelPart = group.shadowRoot!.querySelector(
      '[part~="label"]'
    ) as HTMLElement;
    const errorPart = group.shadowRoot!.querySelector(
      '[part="error"]'
    ) as HTMLElement;
    expect(labelPart.hidden).to.be.true;
    expect(errorPart.hidden).to.be.true;

    const labelSlot = group.shadowRoot!.querySelector(
      'slot[name="label"]'
    ) as HTMLSlotElement;
    const errorSlot = group.shadowRoot!.querySelector(
      'slot[name="error"]'
    ) as HTMLSlotElement;

    const labelChanged = oneEvent(labelSlot, "slotchange");
    const labelEl = document.createElement("span");
    labelEl.slot = "label";
    labelEl.textContent = "Choice";
    group.append(labelEl);
    await labelChanged;
    await group.updateComplete;
    expect(labelPart.hidden, "a slotted label element shows the label part").to
      .be.false;

    const errorChanged = oneEvent(errorSlot, "slotchange");
    const errorEl = document.createElement("span");
    errorEl.slot = "error";
    errorEl.textContent = "Required";
    group.append(errorEl);
    await errorChanged;
    await group.updateComplete;
    expect(errorPart.hidden, "a slotted error element shows the error part").to
      .be.false;
  });

  it("no-ops syncFormState/updateValidity when called before internals/validityController exist", async () => {
    const group = (await fixture(
      html`<lr-radio-group></lr-radio-group>`
    )) as LyraRadioGroup;
    await group.updateComplete;
    const internals = group as unknown as {
      internals?: ElementInternals;
      validityController?: unknown;
      syncFormState(): void;
      updateValidity(): void;
    };
    const savedInternals = internals.internals;
    const savedValidityController = internals.validityController;
    try {
      internals.internals = undefined;
      expect(() => internals.syncFormState()).to.not.throw();
      internals.validityController = undefined;
      expect(() => internals.updateValidity()).to.not.throw();
    } finally {
      internals.internals = savedInternals;
      internals.validityController = savedValidityController;
    }
  });

  it("treats an explicit null message the same as empty when clearing custom validity", async () => {
    const group = (await fixture(html`
      <lr-radio-group required>
        <lr-radio value="a">A</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    await group.updateComplete;
    group.setCustomValidity("Nope");
    expect(group.validity.customError).to.be.true;

    (group.setCustomValidity as (message?: string | null) => void)(null);
    expect(
      group.validity.customError,
      "a null message clears custom validity like an empty string"
    ).to.be.false;
  });

  it("restores the reflected default value on its own reset pass when no radio has a competing native default", async () => {
    const group = (await fixture(html`
      <lr-radio-group name="choice" value="a">
        <lr-radio value="a">A</lr-radio>
        <lr-radio value="b">B</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    const [a, b] = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
    await group.updateComplete;
    expect(a.checked).to.be.true;

    b.click();
    expect(b.checked).to.be.true;
    expect(group.value).to.equal("b");

    // Calls the group's own reset entry point directly -- exactly what a native `form.reset()`
    // invokes on it -- to isolate its own restoration logic from each *individually*
    // form-associated owned radio's own separate `formResetCallback()`. Under a real `form.reset()`,
    // each owned radio's native reset also fires and, when neither radio carries a matching
    // `checked` attribute, replaces this restored selection with an empty value. This assertion is
    // intentionally limited to the group's own restoration contract.
    group.formResetCallback();
    expect(
      group.value,
      "the group-level defaultValue wins its own reset pass when no radio has a competing default"
    ).to.equal("a");
    expect(a.checked).to.be.true;
    expect(b.checked).to.be.false;
  });

  it("lets the group remain the sole reset owner during a real form reset", async () => {
    const form = (await fixture(html`
      <form>
        <lr-radio-group name="choice" value="a">
          <lr-radio value="a">A</lr-radio>
          <lr-radio value="b">B</lr-radio>
        </lr-radio-group>
      </form>
    `)) as HTMLFormElement;
    const group = form.querySelector("lr-radio-group") as LyraRadioGroup;
    const [a, b] = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
    await group.updateComplete;

    b.click();
    expect(group.value).to.equal("b");
    form.reset();

    expect(group.value).to.equal("a");
    expect(a.checked).to.be.true;
    expect(b.checked).to.be.false;
    expect(new FormData(form).get("choice")).to.equal("a");
  });

  it("formStateRestoreCallback clears the selection for a non-string restored state", async () => {
    const group = (await fixture(html`
      <lr-radio-group>
        <lr-radio value="a" checked>A</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    await group.updateComplete;
    expect(group.value).to.equal("a");

    group.formStateRestoreCallback(null, "restore");
    await group.updateComplete;
    expect(
      group.value,
      "a non-string restored state clears the selection like an empty string"
    ).to.equal("");
    expect((group.querySelector("lr-radio") as LyraRadio).checked).to.be.false;
  });
});
