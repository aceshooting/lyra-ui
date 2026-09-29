// Focused interaction and event contracts cases. Test bodies and titles were moved intact from the prior suite.
import { fixture, expect, html, oneEvent } from "@open-wc/testing";
import "./radio.js";
import "./radio-button.js";
import "./radio-group.js";
import type { LyraRadio } from "./radio.js";
import type { LyraRadioGroup } from "./radio-group.js";

function requiredItem<T>(
  items: ArrayLike<T>,
  index: number,
  description: string
): T {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`Expected ${description} at index ${index}.`);
  }
  return item;
}

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
  const first = requiredItem(radios, 0, "first arrow-navigation radio");
  const second = requiredItem(radios, 1, "second arrow-navigation radio");
  const firstBase = first.shadowRoot!.querySelector(
    '[part="base"]'
  ) as HTMLElement;
  const secondBase = second.shadowRoot!.querySelector(
    '[part="base"]'
  ) as HTMLElement;
  first.checked = true;
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
  expect(second.checked).to.be.true;
  expect(second.shadowRoot!.activeElement === secondBase).to.be.true;
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
  const first = requiredItem(radios, 0, "first RTL radio");
  const second = requiredItem(radios, 1, "second RTL radio");
  const firstBase = first.shadowRoot!.querySelector(
    '[part="base"]'
  ) as HTMLElement;
  const secondBase = second.shadowRoot!.querySelector(
    '[part="base"]'
  ) as HTMLElement;
  first.checked = true;
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
  expect(second.checked).to.be.true;
  expect(second.shadowRoot!.activeElement === secondBase).to.be.true;

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
  expect(first.checked).to.be.true;
  expect(first.shadowRoot!.activeElement === firstBase).to.be.true;
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
  const first = requiredItem(radios, 0, "first roving-tabindex radio");
  const second = requiredItem(radios, 1, "second roving-tabindex radio");
  expect(base(first).tabIndex).to.equal(0);
  expect(base(second).tabIndex).to.equal(-1);

  base(second).click();
  await group.updateComplete;
  expect(base(first).tabIndex).to.equal(-1);
  expect(base(second).tabIndex).to.equal(0);
});

it("keeps an enabled tab stop when the selected radio itself is disabled", async () => {
  const group = (await fixture(html`
    <lr-radio-group label="Choice">
      <lr-radio value="a" checked disabled>A</lr-radio>
      <lr-radio value="b">B</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  const [a, b] = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
  if (!a || !b) throw new Error("Expected both selected-disabled radios.");
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

it("leaves group-owned radio restoration to its owning group", async () => {
  const group = (await fixture(html`
    <lr-radio-group name="choice">
      <lr-radio value="a" checked>A</lr-radio>
      <lr-radio value="b">B</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  const [a, b] = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
  if (!a || !b) throw new Error("Expected both group-restoration radios.");
  await Promise.all([group.updateComplete, a.updateComplete, b.updateComplete]);

  b.formStateRestoreCallback("checked", "restore");

  expect(
    group.value,
    "the aggregate group selection stays authoritative"
  ).to.equal("a");
  expect([a.checked, b.checked]).to.deep.equal([true, false]);
});

it("exposes exactly one aggregate lr-change shape when an owned radio is clicked or Space-activated", async () => {
  const group = (await fixture(html`
    <lr-radio-group label="Choice">
      <lr-radio value="a">A</lr-radio>
      <lr-radio value="b">B</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  const [a, b] = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
  if (!a || !b) throw new Error("Expected both aggregate-event radios.");
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

  await new Promise<void>((resolve) => queueMicrotask(resolve));
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
  if (!source || !destination)
    throw new Error("Expected both reparenting radio groups.");
  const [moved, remaining] = [
    ...source.querySelectorAll("lr-radio"),
  ] as LyraRadio[];
  if (!moved || !remaining) throw new Error("Expected both source radios.");
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
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  await radio.updateComplete;
  expect(radio.name).to.equal("author-name");
  expect(radio.getAttribute("name")).to.equal("author-name");
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
  if (!destination || !source)
    throw new Error("Expected both connected radio groups.");
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
  const first = requiredItem(radios, 0, "first group-authority radio");
  const second = requiredItem(radios, 1, "second group-authority radio");
  expect(first.effectiveDisabled).to.be.true;
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
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  expect(first.effectiveDisabled).to.be.false;
  expect(second.effectiveDisabled).to.be.false;
  expect(first.effectiveRequired).to.be.false;
  expect(second.effectiveRequired).to.be.false;
  expect(groupBase.getAttribute("aria-disabled")).to.equal("false");
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

it("fires input and change for arrow-key selection, matching click and Space", async () => {
  const group = (await fixture(html`
    <lr-radio-group label="Size">
      <lr-radio value="s">S</lr-radio>
      <lr-radio value="m">M</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  const radios = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
  const first = requiredItem(radios, 0, "first arrow-event radio");
  const second = requiredItem(radios, 1, "second arrow-event radio");
  const firstBase = first.shadowRoot!.querySelector(
    '[part="base"]'
  ) as HTMLElement;
  first.checked = true;
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

  expect(second.checked, "arrow navigation moves the selection").to.be.true;
  // Native <input type=radio> fires input+change on arrow navigation; a consumer bound to the
  // native-mirroring events must not silently miss keyboard selection.
  expect(seen.map(({ type }) => type)).to.deep.equal([
    "input",
    "lr-input",
    "change",
    "lr-change",
  ]);
  const nativeInput = requiredItem(seen, 0, "native arrow input event");
  const inputAlias = requiredItem(seen, 1, "arrow input alias");
  const nativeChange = requiredItem(seen, 2, "native arrow change event");
  expect(nativeInput.event instanceof InputEvent).to.be.true;
  expect(nativeChange.event.constructor === Event).to.be.true;
  expect(
    nativeInput.event.target === group && nativeChange.event.target === group
  ).to.be.true;
  expect(inputAlias.event instanceof CustomEvent).to.be.true;
  expect((inputAlias.event as CustomEvent).detail.value).to.equal("m");
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
