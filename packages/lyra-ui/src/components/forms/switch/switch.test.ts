import { fixture, expect, html, oneEvent, waitUntil } from "@open-wc/testing";
import type { PropertyValues } from "lit";
import "./switch.js";
import type { LyraSwitch } from "./switch.js";
import { resetMouse, sendMouse } from "../../../../test/wtr-mouse.js";
import { LyraElement } from "../../../internal/lyra-element.js";

it("contains long label and hint content at 320px in LTR and RTL", async () => {
  const label = "InternationalizedSwitchLabelWithoutAnyNaturalBreakOpportunity";
  for (const direction of ["ltr", "rtl"] as const) {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div dir=${direction} style="inline-size: 320px; max-inline-size: 320px">
        <lr-switch hint=${label}>${label}</lr-switch>
      </div>
    `);
    expect(wrapper.scrollWidth, `dir=${direction}`).to.be.at.most(
      wrapper.clientWidth
    );
  }
});

it('protects a two-word label from an outer flex row squeezing it below its longest word, avoiding a mid-syllable break', async () => {
  // Regression test for the reported defect: overflow-wrap: anywhere collapsed the
  // label's min-content contribution to near nothing, so when lr-switch sits as a
  // flex item in an outer row next to a non-shrinking sibling (the report's own
  // repro: a settings panel row), the outer flex-shrink algorithm dumped nearly the
  // entire deficit onto the switch -- squeezing its label well below the width of
  // its own longest word ("Streaming", ~68px unconstrained) and forcing a
  // mid-syllable break.
  //
  // [part="label"] is a flex item, so it is blockified to display: block --
  // getClientRects() always returns exactly one rect for a block box no matter how
  // many internal text lines it wraps to (unlike an inline box, which contributes
  // one rect per line fragment), so line count has to be read from height instead,
  // against a dynamically measured single-line reference (never a hardcoded pixel
  // count).
  const label = 'Streaming enabled';

  const reference = (await fixture(html`
    <lr-switch style="inline-size: 400px;">${label}</lr-switch>
  `)) as LyraSwitch;
  await reference.updateComplete;
  const lineHeight = reference.shadowRoot!
    .querySelector<HTMLElement>('[part="label"]')!
    .getBoundingClientRect().height;

  // A 250px outer flex row with a non-shrinking 150px sibling leaves the switch
  // only ~100px of "fair share" -- well below what its longest word needs. A fix
  // that keeps the switch's automatic minimum content-based (rather than 0) makes
  // it refuse to shrink past that point, at the cost of a little row overflow, so
  // the label still wraps cleanly at the space (2 lines) instead of splitting a
  // word across 3+ lines.
  const wrapper = (await fixture(html`
    <div style="display: flex; inline-size: 250px;">
      <lr-switch>${label}</lr-switch>
      <div style="flex: 0 0 150px;">sibling</div>
    </div>
  `)) as HTMLDivElement;
  const el = wrapper.querySelector('lr-switch') as LyraSwitch;
  await el.updateComplete;
  const labelPart = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  const lineCount = Math.round(labelPart.getBoundingClientRect().height / lineHeight);

  expect(
    lineCount,
    'wraps at the space between the two words, not mid-syllable inside one'
  ).to.equal(2);
});

it("themes the track-to-label gap through a component-scoped hook", async () => {
  const el = (await fixture(html`
    <lr-switch style="--lr-switch-gap: 13px">Label</lr-switch>
  `)) as LyraSwitch;
  const layout = el.shadowRoot!.querySelector<HTMLElement>(".switch-layout")!;
  expect(getComputedStyle(layout).columnGap).to.equal("13px");
});

it("emits one cancelable lr-invalid alias when a validity check fails", async () => {
  const el = (await fixture(
    html`<lr-switch required>Enable</lr-switch>`
  )) as LyraSwitch;
  const aliases: CustomEvent[] = [];
  el.addEventListener("lr-invalid", (event) =>
    aliases.push(event as CustomEvent)
  );
  // Registered after the component's own constructor-time relay, so it observes the native event
  // once the alias has had its turn at it.
  const natives: Event[] = [];
  el.addEventListener("invalid", (event) => natives.push(event));

  expect(el.checkValidity()).to.be.false;
  expect(aliases).to.have.lengthOf(1);
  expect(aliases[0].target === el).to.equal(true);
  expect(aliases[0].bubbles && aliases[0].composed).to.be.true;
  expect(aliases[0].cancelable).to.be.true;
  // Nothing cancelled it, so the browser's own validation UI stays enabled.
  expect(natives).to.have.lengthOf(1);
  expect(natives[0].defaultPrevented).to.be.false;
});

it("cancels the native invalid event when the lr-invalid alias is cancelled", async () => {
  const el = (await fixture(
    html`<lr-switch required>Enable</lr-switch>`
  )) as LyraSwitch;
  el.addEventListener("lr-invalid", (event) => event.preventDefault());
  const natives: Event[] = [];
  el.addEventListener("invalid", (event) => natives.push(event));

  expect(el.checkValidity()).to.be.false;
  expect(natives).to.have.lengthOf(1);
  expect(natives[0].defaultPrevented).to.be.true;
});

it("reflects the pinned Web Awesome value property", async () => {
  const el = (await fixture(html`<lr-switch>Enable</lr-switch>`)) as LyraSwitch;
  el.value = "enabled";
  await el.updateComplete;
  expect(el.getAttribute("value")).to.equal("enabled");
});

it("inherits namespaced geometry hooks while a direct host value remains authoritative", async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div
      style="--lr-switch-track-inline-size: 50px; --lr-switch-track-block-size: 20px; --lr-switch-thumb-offset: 3px"
    >
      <lr-switch style="--lr-switch-track-inline-size: 54px">Label</lr-switch>
    </div>
  `);
  const el = wrapper.querySelector("lr-switch") as LyraSwitch;
  const track = el.shadowRoot!.querySelector('[part~="track"]') as HTMLElement;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  expect(getComputedStyle(track).inlineSize).to.equal("54px");
  expect(getComputedStyle(track).blockSize).to.equal("20px");
  expect(getComputedStyle(thumb).insetInlineStart).to.equal("3px");

  const computed = getComputedStyle(el);
  expect(computed.getPropertyValue("--track-inline-size").trim()).to.equal("");
  expect(computed.getPropertyValue("--track-block-size").trim()).to.equal("");
  expect(computed.getPropertyValue("--thumb-offset").trim()).to.equal("");
});

it("keeps the thumb clearance symmetric when a consumer adds a border to the track part", async () => {
  // Regression test: box-sizing: border-box (the library-wide
  // default) makes an author-added ::part(track) border eat into the padding box the thumb is
  // absolutely positioned against, but the thumb's own size/travel math is derived from the
  // track's DECLARED (border-box) dimensions -- so a border shrank the padding box the thumb sits
  // in without the thumb shrinking to match, breaking symmetric clearance on the far edge in both
  // the unchecked and checked states.
  function clearancesFor(track: HTMLElement, thumb: HTMLElement) {
    const trackRect = track.getBoundingClientRect();
    const thumbRect = thumb.getBoundingClientRect();
    return {
      top: thumbRect.top - trackRect.top,
      bottom: trackRect.bottom - thumbRect.bottom,
      start: thumbRect.left - trackRect.left,
      end: trackRect.right - thumbRect.right,
    };
  }

  const frame = (await fixture(html`
    <div>
      <style>
        lr-switch::part(track) {
          border: 1px solid black;
        }
      </style>
      <lr-switch style="--lr-transition-fast: 0s">Enable</lr-switch>
    </div>
  `)) as HTMLElement;
  const el = frame.querySelector("lr-switch") as LyraSwitch;
  const track = el.shadowRoot!.querySelector('[part~="track"]') as HTMLElement;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;

  // Vertical: the thumb never moves, so top/bottom clearance must match in both states.
  const unchecked = clearancesFor(track, thumb);
  expect(unchecked.top, "unchecked top").to.be.closeTo(unchecked.bottom, 0.5);

  el.checked = true;
  await el.updateComplete;
  const checked = clearancesFor(track, thumb);
  expect(checked.top, "checked top").to.be.closeTo(checked.bottom, 0.5);

  // Horizontal: the thumb travels from a resting clearance on the start edge to the same
  // clearance on the end edge -- with border added consistently on all four sides, the two
  // should still match each other (a border-box bug would only widen the far edge, not the near
  // one, so this only holds once both sides are measured against the padding box the same way).
  expect(checked.end, "checked end vs unchecked start").to.be.closeTo(
    unchecked.start,
    0.5
  );
});

it("gives the switch track hover and press feedback matching the keyboard focus-visible cue", async () => {
  // Rendered results, not stylesheet text. This shipped as a filter: brightness() lift on
  // [part~='base'] -- which faded the LABEL along with the track, because a filter applies to the
  // whole subtree -- and a source match could not tell the difference.
  // --lr-transition-fast is zeroed: the track transitions its background, so reading
  // getComputedStyle one frame after the pointer arrives would otherwise catch the INTERPOLATED
  // colour -- still the resting one at t=0 -- and report a working hover as broken.
  const el = (await fixture(
    html`<lr-switch style="--lr-transition-fast: 0s">Label</lr-switch>`
  )) as LyraSwitch;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  const track = el.shadowRoot!.querySelector('[part~="track"]') as HTMLElement;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  const restingTrack = getComputedStyle(track).backgroundColor;
  const restingLabel = getComputedStyle(label).color;
  const rect = base.getBoundingClientRect();
  const position: [number, number] = [
    Math.round(rect.left + rect.width / 2),
    Math.round(rect.top + rect.height / 2),
  ];
  try {
    await sendMouse({ type: "move", position });
    const hovered = getComputedStyle(track).backgroundColor;
    expect(hovered, "hovered track vs resting").to.not.equal(restingTrack);
    expect(getComputedStyle(base).filter, "no subtree filter").to.equal("none");
    expect(
      getComputedStyle(label).color,
      "the label must not move with the track"
    ).to.equal(restingLabel);
    await sendMouse({ type: "down" });
    expect(
      getComputedStyle(track).backgroundColor,
      "pressed vs hovered"
    ).to.not.equal(hovered);
  } finally {
    await sendMouse({ type: "up" });
    await resetMouse();
  }
});

it("moves the checked track under the pointer too, away from its own brand fill", async () => {
  const el = (await fixture(
    html`<lr-switch checked style="--lr-transition-fast: 0s">Label</lr-switch>`
  )) as LyraSwitch;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  const track = el.shadowRoot!.querySelector('[part~="track"]') as HTMLElement;
  const resting = getComputedStyle(track).backgroundColor;
  const rect = base.getBoundingClientRect();
  try {
    await sendMouse({
      type: "move",
      position: [
        Math.round(rect.left + rect.width / 2),
        Math.round(rect.top + rect.height / 2),
      ],
    });
    expect(
      getComputedStyle(track).backgroundColor,
      "checked hover vs checked resting"
    ).to.not.equal(resting);
  } finally {
    await resetMouse();
  }
});

it("themes checked track, thumb, hover, and pressed paint through component hooks", async () => {
  const el = (await fixture(html`
    <lr-switch
      checked
      style="
        --lr-transition-fast: 0s;
        --lr-switch-checked-track-fill: rgb(1, 2, 3);
        --lr-switch-thumb-fill: rgb(4, 5, 6);
        --lr-switch-track-hover-fill: rgb(7, 8, 9);
        --lr-switch-track-active-fill: rgb(10, 11, 12);
      "
      >Label</lr-switch
    >
  `)) as LyraSwitch;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
  const track = el.shadowRoot!.querySelector<HTMLElement>('[part~="track"]')!;
  const thumb = el.shadowRoot!.querySelector<HTMLElement>('[part="thumb"]')!;
  expect(getComputedStyle(track).backgroundColor).to.equal("rgb(1, 2, 3)");
  expect(getComputedStyle(thumb).backgroundColor).to.equal("rgb(4, 5, 6)");
  const rect = base.getBoundingClientRect();
  try {
    await sendMouse({
      type: "move",
      position: [
        Math.round(rect.left + rect.width / 2),
        Math.round(rect.top + rect.height / 2),
      ],
    });
    expect(getComputedStyle(track).backgroundColor).to.equal("rgb(7, 8, 9)");
    await sendMouse({ type: "down" });
    expect(getComputedStyle(track).backgroundColor).to.equal("rgb(10, 11, 12)");
  } finally {
    await sendMouse({ type: "up" });
    await resetMouse();
  }
});

it("forwards host click() to the internal control, toggling checked", async () => {
  const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
  expect(el.checked).to.be.false;

  const event = oneEvent(el, "lr-change");
  el.click();
  const result = await event;
  expect(result.detail.checked).to.be.true;
  expect(el.checked).to.be.true;
});

it("does not toggle on host click() while disabled", async () => {
  const el = (await fixture(
    html`<lr-switch disabled>Label</lr-switch>`
  )) as LyraSwitch;
  el.click();
  expect(el.checked).to.be.false;
});

describe("ElementInternals availability", () => {
  it("does not throw when constructed in an environment without a real ElementInternals implementation (e.g. a downstream Vitest + happy-dom suite)", () => {
    const original = HTMLElement.prototype.attachInternals;
    // @ts-expect-error -- simulating an environment that lacks ElementInternals entirely
    delete HTMLElement.prototype.attachInternals;
    try {
      let el: LyraSwitch | undefined;
      expect(() => {
        el = document.createElement("lr-switch") as LyraSwitch;
      }).to.not.throw();
      // Confirm the fallback keeps the rest of the public surface usable rather than merely
      // swallowing the constructor error.
      expect(el!.checkValidity()).to.be.true;
      expect(el!.form === null).to.equal(true);
    } finally {
      HTMLElement.prototype.attachInternals = original;
    }
  });
});

it("calls super.willUpdate so a future LyraElement/mixin lifecycle hook stays wired in", async () => {
  // Monkey-patch LyraElement.prototype.willUpdate (the established pattern, e.g. checkbox.test.ts)
  // to prove LyraSwitch's own willUpdate() override actually calls super.willUpdate(...) rather
  // than shadowing it silently.
  const proto = LyraElement.prototype as unknown as {
    willUpdate: (changed: PropertyValues) => void;
  };
  const original = proto.willUpdate;
  let called = false;
  proto.willUpdate = function (
    this: LyraElement,
    changed: PropertyValues
  ): void {
    called = true;
    original.call(this, changed);
  };
  try {
    const el = (await fixture(
      html`<lr-switch>Label</lr-switch>`
    )) as LyraSwitch;
    await el.updateComplete;
    expect(called).to.be.true;
  } finally {
    proto.willUpdate = original;
  }
});

it('defaults to unchecked with role="switch" and aria-checked="false"', async () => {
  const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(el.checked).to.be.false;
  expect(base.getAttribute("role")).to.equal("switch");
  expect(base.getAttribute("aria-checked")).to.equal("false");
});

it("keeps live checked out of the default attribute while updating aria-checked", async () => {
  const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
  el.checked = true;
  await el.updateComplete;
  expect(el.hasAttribute("checked")).to.be.false;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.getAttribute("aria-checked")).to.equal("true");
});

it("toggles and emits lr-change with detail.checked on click", async () => {
  const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;

  setTimeout(() => base.click());
  let ev = await oneEvent(el, "lr-change");
  expect(ev.detail.checked).to.be.true;
  expect(el.checked).to.be.true;

  setTimeout(() => base.click());
  ev = await oneEvent(el, "lr-change");
  expect(ev.detail.checked).to.be.false;
  expect(el.checked).to.be.false;
});

describe("native form event contract", () => {
  /** Records the complete ordered native/prefixed pair a single activation produces. */
  const recordSequence = (
    el: LyraSwitch
  ): Array<{ type: string; event: Event }> => {
    const seen: Array<{ type: string; event: Event }> = [];
    for (const name of ["input", "lr-input", "change", "lr-change"]) {
      el.addEventListener(name, (event) =>
        seen.push({ type: event.type, event })
      );
    }
    return seen;
  };

  it("emits exactly one native event pair and one typed alias pair on a pointer click", async () => {
    const el = (await fixture(
      html`<lr-switch>Label</lr-switch>`
    )) as LyraSwitch;
    const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    const seen = recordSequence(el);

    base.click();
    expect(seen.map(({ type }) => type)).to.deep.equal([
      "input",
      "lr-input",
      "change",
      "lr-change",
    ]);
    expect(seen[0].event instanceof InputEvent).to.be.true;
    expect(seen[2].event.constructor === Event).to.be.true;
    expect(seen[0].event.target === el && seen[2].event.target === el).to.be
      .true;
    expect(seen[1].event instanceof CustomEvent).to.be.true;
    expect((seen[1].event as CustomEvent).detail).to.deep.equal({
      checked: true,
    });
    expect(el.checked).to.be.true;
  });

  it("emits input and change on Space while leaving Enter to the surrounding form", async () => {
    const el = (await fixture(
      html`<lr-switch>Label</lr-switch>`
    )) as LyraSwitch;
    const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    const seen = recordSequence(el);

    base.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: " ",
        bubbles: true,
        cancelable: true,
      })
    );
    expect(seen.map(({ type }) => type)).to.deep.equal([
      "input",
      "lr-input",
      "change",
      "lr-change",
    ]);

    const enter = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    base.dispatchEvent(enter);
    expect(seen.map(({ type }) => type)).to.deep.equal([
      "input",
      "lr-input",
      "change",
      "lr-change",
    ]);
    expect(enter.defaultPrevented).to.be.false;
    expect(el.checked).to.be.true;
  });

  it("emits input and change from the programmatic host click() activation path", async () => {
    const el = (await fixture(
      html`<lr-switch>Label</lr-switch>`
    )) as LyraSwitch;
    const seen = recordSequence(el);

    el.click();
    expect(seen.map(({ type }) => type)).to.deep.equal([
      "input",
      "lr-input",
      "change",
      "lr-change",
    ]);
  });

  it("makes input and change bubbling, composed and non-cancelable", async () => {
    const el = (await fixture(
      html`<lr-switch>Label</lr-switch>`
    )) as LyraSwitch;

    const inputPromise = oneEvent(el, "input");
    el.click();
    const inputEvent = await inputPromise;
    expect(inputEvent.bubbles).to.be.true;
    expect(inputEvent.composed).to.be.true;
    expect(inputEvent.cancelable).to.be.false;

    const changePromise = oneEvent(el, "change");
    el.click();
    const changeEvent = await changePromise;
    expect(changeEvent.bubbles).to.be.true;
    expect(changeEvent.composed).to.be.true;
    expect(changeEvent.cancelable).to.be.false;
  });

  it("emits neither input nor change while disabled, nor for a programmatic .checked assignment", async () => {
    const el = (await fixture(
      html`<lr-switch disabled>Label</lr-switch>`
    )) as LyraSwitch;
    const seen = recordSequence(el);

    el.click();
    el.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: " ",
        bubbles: true,
        cancelable: true,
      })
    );
    expect(seen).to.have.lengthOf(0);

    el.disabled = false;
    await el.updateComplete;
    el.checked = true;
    await el.updateComplete;
    expect(seen).to.have.lengthOf(0);
  });

  it("emits neither input nor change from form.reset() or session-state restoration", async () => {
    const form = (await fixture(html`
      <form><lr-switch name="notify" checked>Notify me</lr-switch></form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-switch") as LyraSwitch;
    const seen = recordSequence(el);

    form.reset();
    el.formStateRestoreCallback("checked", "restore");
    expect(seen).to.have.lengthOf(0);
  });
});

it("toggles on Space but not Enter keydown", async () => {
  const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;

  setTimeout(() =>
    base.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: " ",
        bubbles: true,
        cancelable: true,
      })
    )
  );
  let ev = await oneEvent(el, "lr-change");
  expect(ev.detail.checked).to.be.true;

  let changes = 0;
  el.addEventListener("lr-change", () => changes++);
  const enter = new KeyboardEvent("keydown", {
    key: "Enter",
    bubbles: true,
    cancelable: true,
  });
  base.dispatchEvent(enter);
  expect(changes).to.equal(0);
  expect(enter.defaultPrevented).to.be.false;
  expect(el.checked).to.be.true;
});

it("uses logical ArrowLeft/ArrowRight off/on semantics in LTR and RTL", async () => {
  for (const [dir, onKey, offKey] of [
    ["ltr", "ArrowRight", "ArrowLeft"],
    ["rtl", "ArrowLeft", "ArrowRight"],
  ] as const) {
    const el = (await fixture(
      html`<lr-switch dir=${dir}>Choice</lr-switch>`
    )) as LyraSwitch;
    const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    const events: string[] = [];
    el.addEventListener("input", () => events.push("input"));
    el.addEventListener("change", () => events.push("change"));

    const on = new KeyboardEvent("keydown", {
      key: onKey,
      bubbles: true,
      cancelable: true,
    });
    base.dispatchEvent(on);
    expect(on.defaultPrevented, `${dir} on key`).to.be.true;
    expect(el.checked, `${dir} on state`).to.be.true;
    expect(events).to.deep.equal(["input", "change"]);

    base.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: onKey,
        bubbles: true,
        cancelable: true,
      })
    );
    expect(events, `${dir} repeated on is silent`).to.deep.equal([
      "input",
      "change",
    ]);

    const off = new KeyboardEvent("keydown", {
      key: offKey,
      bubbles: true,
      cancelable: true,
    });
    base.dispatchEvent(off);
    expect(off.defaultPrevented, `${dir} off key`).to.be.true;
    expect(el.checked, `${dir} off state`).to.be.false;
    expect(events).to.deep.equal(["input", "change", "input", "change"]);
  }
});

it("exports wrapper/control and help-text aliases without replacing Lyra part names", async () => {
  const el = (await fixture(html`
    <lr-switch help-text="Supporting text">Choice</lr-switch>
  `)) as LyraSwitch & { helpText: string };
  await el.updateComplete;
  const baseParts = el
    .shadowRoot!.querySelector('[part~="base"]')!
    .getAttribute("part")!
    .split(/\s+/);
  const controlParts = el
    .shadowRoot!.querySelector('[part~="control"]')!
    .getAttribute("part")!
    .split(/\s+/);
  const hintParts = el
    .shadowRoot!.querySelector('[part~="hint"]')!
    .getAttribute("part")!
    .split(/\s+/);
  expect(baseParts).to.include.members(["base", "switch", "wrapper"]);
  expect(controlParts).to.include.members(["track", "control"]);
  expect(hintParts).to.include.members(["hint", "form-control-help-text"]);
  expect(
    (el.shadowRoot!.querySelector('[part~="hint"]') as HTMLElement).textContent
  ).to.contain("Supporting text");
  await expect(el).to.be.accessible();
});

it("accepts a Shoelace help-text slot but ignores fictional default-checked", async () => {
  const form = (await fixture(html`
    <form>
      <lr-switch default-checked>
        Choice
        <span slot="help-text">Slotted help</span>
      </lr-switch>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-switch") as LyraSwitch;
  await el.updateComplete;
  expect(el.checked).to.be.false;
  expect(el.defaultChecked).to.be.false;
  const helpSlot = el.shadowRoot!.querySelector(
    'slot[name="help-text"]'
  ) as HTMLSlotElement;
  expect(
    helpSlot
      .assignedNodes({ flatten: true })
      .map((node) => node.textContent)
      .join("")
  ).to.contain("Slotted help");
  el.checked = true;
  form.reset();
  expect(el.checked).to.be.false;
});

it("accepts the WA with-hint SSR presence hint before slot assignment is observable", async () => {
  const el = (await fixture(html`
    <lr-switch with-hint aria-label="Choice"></lr-switch>
  `)) as LyraSwitch & { withHint: boolean };
  await el.updateComplete;
  expect(el.withHint).to.be.true;
  expect(el.shadowRoot!.querySelector('[part~="hint"]')!.hasAttribute("hidden"))
    .to.be.false;
  expect(
    (
      el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement
    ).getAttribute("aria-describedby")
  ).to.equal("switch-hint");
});

it("preventDefault()s the Space keydown so the page does not scroll", async () => {
  const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  const ev = new KeyboardEvent("keydown", {
    key: " ",
    bubbles: true,
    cancelable: true,
  });
  base.dispatchEvent(ev);
  expect(ev.defaultPrevented).to.be.true;
});

it("ignores click and keydown activation while disabled, and is not focusable", async () => {
  const el = (await fixture(
    html`<lr-switch disabled>Label</lr-switch>`
  )) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.getAttribute("tabindex")).to.equal("-1");
  expect(base.getAttribute("aria-disabled")).to.equal("true");

  let fired = false;
  el.addEventListener("lr-change", () => (fired = true));
  base.click();
  base.dispatchEvent(
    new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true })
  );
  expect(fired).to.be.false;
  expect(el.checked).to.be.false;
});

it("is focusable (tabindex 0) when enabled", async () => {
  const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.getAttribute("tabindex")).to.equal("0");
});

it("exposes explicit false aria-required/aria-disabled states by default", async () => {
  const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.getAttribute("aria-required")).to.equal("false");
  expect(base.getAttribute("aria-disabled")).to.equal("false");
});

it("sets aria-required when required", async () => {
  const el = (await fixture(
    html`<lr-switch required>Label</lr-switch>`
  )) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.getAttribute("aria-required")).to.equal("true");
});

it("forwards focus() and blur() to the internal switch control", async () => {
  const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;

  el.focus();
  expect(el.shadowRoot!.activeElement === base).to.be.true;
  el.blur();
  expect(el.shadowRoot!.activeElement === null).to.equal(true);
});

it("suppresses host focus/click in the same task that fieldset disablement starts", async () => {
  const fieldset = await fixture<HTMLFieldSetElement>(html`
    <fieldset><lr-switch>Label</lr-switch></fieldset>
  `);
  const el = fieldset.querySelector("lr-switch") as LyraSwitch;
  fieldset.disabled = true;
  el.focus();
  el.click();
  expect(el.shadowRoot!.activeElement === null).to.be.true;
  expect(el.checked).to.be.false;
});

it("relays exactly one native focus/blur pair, and never lr-focus/lr-blur", async () => {
  const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
  const nativeEvents: FocusEvent[] = [];
  const aliases: string[] = [];
  el.addEventListener("focus", (event) =>
    nativeEvents.push(event as FocusEvent)
  );
  el.addEventListener("blur", (event) =>
    nativeEvents.push(event as FocusEvent)
  );
  el.addEventListener("lr-focus", () => aliases.push("lr-focus"));
  el.addEventListener("lr-blur", () => aliases.push("lr-blur"));

  el.focus();
  expect(
    el.shadowRoot!.activeElement?.getAttribute("part")?.split(/\s+/)
  ).to.include.members(["base", "switch", "wrapper"]);
  el.blur();
  expect(el.shadowRoot!.activeElement === null).to.equal(true);
  expect(nativeEvents.map((event) => event.type)).to.deep.equal([
    "focus",
    "blur",
  ]);
  expect(nativeEvents.every((event) => event instanceof FocusEvent)).to.be.true;
  expect(
    nativeEvents.every(
      (event) => event.target === el && event.bubbles && event.composed
    )
  ).to.be.true;
  // v9 dropped the v8 lr-focus/lr-blur compatibility aliases -- only the native pair remains.
  expect(aliases).to.deep.equal([]);
});

it("reflects aria-invalid on the inner switch only after the field has been interacted with once", async () => {
  const el = (await fixture(
    html`<lr-switch required>Label</lr-switch>`
  )) as LyraSwitch;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.getAttribute("aria-invalid")).to.equal("false");

  base.dispatchEvent(new FocusEvent("blur"));
  await el.updateComplete;
  expect(base.getAttribute("aria-invalid")).to.equal("true");

  el.checked = true;
  await el.updateComplete;
  expect(base.getAttribute("aria-invalid")).to.equal("false");
});

it("does not mark touched from a blur the browser forces when the control becomes disabled while focused", async () => {
  // Regression test for the same underlying hazard as <lr-input>'s onBlur fix. It is reached
  // through a different mechanism here: <lr-switch> is
  // form-associated (`static formAssociated = true`), so setting its `disabled` attribute makes
  // the browser's own form-associated-custom-element machinery treat the host as "actually
  // disabled" and run unfocusing steps against whatever inside the shadow tree currently holds
  // focus -- firing a real `blur` on the internal `[part~="base"]` span, *before* Lit's own async
  // re-render has even reached the span's `tabindex` attribute (confirmed on Chromium: the forced
  // blur lands synchronously inside the `disabled` setter, while `tabIndex` is still `0`, not yet
  // flipped to `-1`). Whether Firefox/WebKit force-blur this shape at all is not asserted as a
  // precondition here (unlike lr-checkbox's equivalent test, confirmed to eventually blur on
  // every engine) -- only the regression contract: whichever way an engine behaves, `touched`
  // must not end up true from it. That is not a user interaction: onBlur() unconditionally
  // marking `touched = true` for it was capable of reentering an in-flight Lit update and
  // tripping Lit's dev-mode "scheduled an update after an update completed" warning, and would
  // otherwise let a later re-enable flash `user-invalid` styling for an interaction the user
  // never actually had a chance to make.
  const el = (await fixture(
    html`<lr-switch required>Label</lr-switch>`
  )) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  const isTouched = () => (el as unknown as { touched: boolean }).touched;

  el.focus();
  expect(el.shadowRoot!.activeElement === base).to.be.true;

  el.disabled = true;
  expect(
    base.tabIndex,
    "the forced blur precedes the async re-render that flips tabindex"
  ).to.equal(0);
  // Give a real, engine-forced blur every reasonable chance to land before checking the
  // regression contract below -- but do not fail the test merely because this engine never fires
  // one for this shape (see comment above).
  try {
    await waitUntil(() => el.shadowRoot!.activeElement !== base, undefined, {
      timeout: 1000,
    });
  } catch {
    /* This engine does not force-blur this shape; touched staying false is still the assertion that matters. */
  }

  expect(
    isTouched(),
    "a disable-forced blur (if this engine fires one) must not mark touched"
  ).to.be.false;

  await el.updateComplete;
  el.disabled = false;
  await el.updateComplete;
  expect(isTouched(), "still not touched after re-enabling").to.be.false;

  // A genuine user-driven blur (not caused by disablement) still marks touched, unchanged.
  base.dispatchEvent(new FocusEvent("blur"));
  expect(isTouched(), "a real blur still marks touched").to.be.true;
});

it("hides the label part when the default slot has no real content", async () => {
  const el = (await fixture(html`<lr-switch></lr-switch>`)) as LyraSwitch;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  expect(label.hidden).to.be.true;
});

it("shows the label part for plain slotted text (a text node, not an element)", async () => {
  const el = (await fixture(
    html`<lr-switch>Enable notifications</lr-switch>`
  )) as LyraSwitch;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  expect(label.hidden).to.be.false;
});

it("reproduces server-first slot state before adopting browser-only light DOM after hydration", async () => {
  const container = (await fixture(html`<div></div>`)) as HTMLDivElement;
  const el = container.ownerDocument.createElement("lr-switch") as LyraSwitch;
  el.setAttribute("aria-label", "Notification preference");
  // A pre-existing shadow root is the cross-engine equivalent of what the declarative-shadow-DOM
  // parser supplies before a server-rendered custom element's first connectedCallback().
  el.attachShadow({ mode: "open" });
  el.append(
    container.ownerDocument.createTextNode("Enable notifications"),
    Object.assign(container.ownerDocument.createElement("span"), {
      slot: "hint",
      textContent: "You can change this later.",
    }),
    Object.assign(container.ownerDocument.createElement("span"), {
      slot: "error",
      textContent: "Choose a notification preference.",
    })
  );
  container.append(el);

  await el.updateComplete;
  const firstBase = el.shadowRoot!.querySelector('[part~="base"]');
  expect((el.shadowRoot!.querySelector('[part="label"]') as HTMLElement).hidden)
    .to.be.true;
  expect((el.shadowRoot!.querySelector('[part~="hint"]') as HTMLElement).hidden)
    .to.be.true;
  expect((el.shadowRoot!.querySelector('[part="error"]') as HTMLElement).hidden)
    .to.be.true;

  await el.updateComplete;
  expect((el.shadowRoot!.querySelector('[part="label"]') as HTMLElement).hidden)
    .to.be.false;
  expect((el.shadowRoot!.querySelector('[part~="hint"]') as HTMLElement).hidden)
    .to.be.false;
  expect((el.shadowRoot!.querySelector('[part="error"]') as HTMLElement).hidden)
    .to.be.false;
  expect(el.shadowRoot!.querySelector('[part~="base"]') === firstBase).to.be
    .true;
});

it("refreshes label presence immediately when reconnected with changed light DOM", async () => {
  const container = (await fixture(html`
    <div><lr-switch>Enable notifications</lr-switch></div>
  `)) as HTMLDivElement;
  const el = container.querySelector("lr-switch") as LyraSwitch;
  const labelText = el.firstChild as Text;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  expect(label.hidden).to.be.false;

  el.remove();
  labelText.data = " ";
  container.append(el);
  await el.updateComplete;
  expect(label.hidden).to.be.true;

  el.remove();
  labelText.data = "Enable alerts";
  container.append(el);
  await el.updateComplete;
  expect(label.hidden).to.be.false;
});

it("refreshes every named-slot cache on reconnect after detached mutations", async () => {
  const container = (await fixture(html`
    <div>
      <lr-switch aria-label="Notification preference">
        <span slot="hint">Original hint</span>
      </lr-switch>
    </div>
  `)) as HTMLDivElement;
  const el = container.querySelector("lr-switch") as LyraSwitch;
  const namedContent = el.querySelector("span")!;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  const hint = el.shadowRoot!.querySelector('[part~="hint"]') as HTMLElement;
  const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  expect(hint.hidden).to.be.false;
  expect(error.hidden).to.be.true;
  expect(base.getAttribute("aria-describedby")).to.equal("switch-hint");

  el.remove();
  namedContent.slot = "error";
  container.append(el);
  await el.updateComplete;
  expect(hint.hidden).to.be.true;
  expect(error.hidden).to.be.false;
  expect(base.getAttribute("aria-describedby")).to.equal("switch-error");

  el.remove();
  namedContent.slot = "help-text";
  container.append(el);
  await el.updateComplete;
  expect(hint.hidden).to.be.false;
  expect(error.hidden).to.be.true;
  expect(base.getAttribute("aria-describedby")).to.equal("switch-hint");

  el.remove();
  namedContent.remove();
  container.append(el);
  await el.updateComplete;
  expect(hint.hidden).to.be.true;
  expect(error.hidden).to.be.true;
  expect(base.hasAttribute("aria-describedby")).to.be.false;
});

it("updates label presence when a direct slotted descendant mutates in place", async () => {
  const el = (await fixture(html`<lr-switch></lr-switch>`)) as LyraSwitch;
  const assigned = el.ownerDocument.createTextNode(" ");
  el.append(assigned);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  expect(label.hidden).to.be.true;

  assigned.data = "Enable notifications";
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
    <lr-switch aria-label="Explicit switch name">
      <slot><span>Unrendered fallback</span></slot>
    </lr-switch>
  `;
  const el = root.querySelector("lr-switch") as LyraSwitch;
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
  expect(base.getAttribute("aria-label")).to.equal("Explicit switch name");

  assigned.data = "Forwarded switch label";
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
  visual.setAttribute("aria-hidden", "true");
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
  ).to.equal("Explicit switch name");
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
  let adoptedTarget: LyraSwitch | undefined;
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
    html`<lr-switch><span>Parent label</span></lr-switch>`
  )) as LyraSwitch;
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

it('forwards a host aria-label onto the inner role="switch" element', async () => {
  const el = (await fixture(
    html`<lr-switch aria-label="Enable notifications"></lr-switch>`
  )) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.getAttribute("aria-label")).to.equal("Enable notifications");
});

it("does not set an empty aria-label on the inner element when the host has none", async () => {
  const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.hasAttribute("aria-label")).to.be.false;
});

it("preserves an explicitly empty host aria-label on the internal switch role", async () => {
  const el = (await fixture(
    html`<lr-switch aria-label="">Visible label</lr-switch>`
  )) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.hasAttribute("aria-label")).to.be.true;
  expect(base.getAttribute("aria-label")).to.equal("");
});

it("participates in a form: submits value under name only when checked", async () => {
  const form = (await fixture(html`
    <form><lr-switch name="notify" value="yes">Notify me</lr-switch></form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-switch") as LyraSwitch;

  expect(new FormData(form).get("notify")).to.equal(null);

  el.checked = true;
  await el.updateComplete;
  expect(new FormData(form).get("notify")).to.equal("yes");

  el.checked = false;
  await el.updateComplete;
  expect(new FormData(form).get("notify")).to.equal(null);
});

it("updates form value and validity synchronously when checked changes", async () => {
  const form = (await fixture(html`
    <form>
      <lr-switch name="notify" value="yes" required>Notify me</lr-switch>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-switch") as LyraSwitch;

  expect(el.checkValidity()).to.be.false;

  el.checked = true;
  expect(new FormData(form).get("notify")).to.equal("yes");
  expect(el.checkValidity()).to.be.true;

  el.checked = false;
  expect(new FormData(form).get("notify")).to.equal(null);
  expect(el.checkValidity()).to.be.false;
});

it("updates the submitted value synchronously when value changes", async () => {
  const form = (await fixture(html`
    <form>
      <lr-switch name="notify" value="yes" checked>Notify me</lr-switch>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-switch") as LyraSwitch;

  el.value = "updated";
  expect(new FormData(form).get("notify")).to.equal("updated");
});

it("updates validity synchronously when required changes", async () => {
  const el = (await fixture(html`
    <lr-switch name="terms">Agree</lr-switch>
  `)) as LyraSwitch;

  expect(el.checkValidity()).to.be.true;
  el.required = true;
  expect(el.checkValidity()).to.be.false;
  el.required = false;
  expect(el.checkValidity()).to.be.true;
});

describe("validationMessage localization", () => {
  it("defaults to the built-in English validationMessage for a required, unchecked control", async () => {
    const el = (await fixture(
      html`<lr-switch required>Agree</lr-switch>`
    )) as LyraSwitch;
    expect(el.validationMessage).to.equal("Please turn this on.");
  });

  it("localizes the validationMessage via this.localize() when .strings overrides switchRequired", async () => {
    const el = (await fixture(html`
      <lr-switch
        required
        .strings=${{ switchRequired: "Veuillez activer ceci." }}
        >Agree</lr-switch
      >
    `)) as LyraSwitch;
    expect(el.validationMessage).to.equal("Veuillez activer ceci.");

    el.checked = true;
    expect(el.validationMessage).to.equal("");
  });
});

it("submits under a programmatically assigned name in the same tick", async () => {
  const form = (await fixture(html`
    <form><lr-switch value="yes" checked>Notify me</lr-switch></form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-switch") as LyraSwitch;

  el.name = "first";
  expect(el.getAttribute("name")).to.equal("first");
  expect(new FormData(form).get("first")).to.equal("yes");

  el.name = "second";
  const renamed = new FormData(form);
  expect(renamed.has("first")).to.be.false;
  expect(renamed.get("second")).to.equal("yes");

  el.name = "";
  expect(el.hasAttribute("name")).to.be.false;
  expect(el.name).to.equal("");
  expect(new FormData(form).has("second")).to.be.false;

  el.setAttribute("name", "from-attribute");
  expect(el.name).to.equal("from-attribute");
  expect(new FormData(form).get("from-attribute")).to.equal("yes");
  el.removeAttribute("name");
  expect(el.name).to.equal("");
  expect(new FormData(form).has("from-attribute")).to.be.false;
});

it('uses "on" as the default form value', async () => {
  const form = (await fixture(html`
    <form><lr-switch name="notify" checked>Notify me</lr-switch></form>
  `)) as HTMLFormElement;
  expect(new FormData(form).get("notify")).to.equal("on");
});

it("blocks a required, unchecked switch from submitting the form", async () => {
  const form = (await fixture(html`
    <form><lr-switch name="terms" required>Agree</lr-switch></form>
  `)) as HTMLFormElement;
  expect(form.reportValidity()).to.be.false;

  const el = form.querySelector("lr-switch") as LyraSwitch;
  el.checked = true;
  await el.updateComplete;
  expect(form.reportValidity()).to.be.true;
});

it("focuses the inner switch after direct and submit-driven validity reporting", async () => {
  const form = (await fixture(html`
    <form>
      <button type="button">Before switch</button>
      <lr-switch name="terms" required>Agree</lr-switch>
    </form>
  `)) as HTMLFormElement;
  const sentinel = form.querySelector("button") as HTMLButtonElement;
  const el = form.querySelector("lr-switch") as LyraSwitch;
  let submitCount = 0;
  form.addEventListener("submit", (event) => {
    submitCount += 1;
    event.preventDefault();
  });

  sentinel.focus();
  expect(el.reportValidity()).to.be.false;
  expect(document.activeElement?.localName).to.equal("lr-switch");
  expect(
    el.shadowRoot!.activeElement?.getAttribute("part")?.split(/\s+/)
  ).to.include.members(["base", "switch", "wrapper"]);

  sentinel.focus();
  form.requestSubmit();
  expect(submitCount).to.equal(0);
  expect(document.activeElement?.localName).to.equal("lr-switch");
  expect(
    el.shadowRoot!.activeElement?.getAttribute("part")?.split(/\s+/)
  ).to.include.members(["base", "switch", "wrapper"]);
});

it("applies and removes explicit disabled form state synchronously", async () => {
  const form = (await fixture(html`
    <form>
      <lr-switch id="submitted" name="notify" value="yes" checked
        >Notify me</lr-switch
      >
      <lr-switch id="invalid" name="terms" required>Agree</lr-switch>
    </form>
  `)) as HTMLFormElement;
  const submitted = form.querySelector("#submitted") as LyraSwitch;
  const invalid = form.querySelector("#invalid") as LyraSwitch;

  expect(new FormData(form).get("notify")).to.equal("yes");
  expect(invalid.checkValidity()).to.be.false;

  submitted.disabled = true;
  invalid.disabled = true;
  expect(submitted.hasAttribute("disabled")).to.be.true;
  expect(invalid.hasAttribute("disabled")).to.be.true;
  expect(new FormData(form).has("notify")).to.be.false;
  expect(invalid.checkValidity()).to.be.true;

  submitted.disabled = false;
  invalid.disabled = false;
  expect(submitted.hasAttribute("disabled")).to.be.false;
  expect(invalid.hasAttribute("disabled")).to.be.false;
  expect(new FormData(form).get("notify")).to.equal("yes");
  expect(invalid.checkValidity()).to.be.false;
});

it("restores the declared default checked state on form.reset()", async () => {
  const form = (await fixture(html`
    <form>
      <lr-switch name="notify" value="yes" checked required
        >Notify me</lr-switch
      >
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-switch") as LyraSwitch;
  expect(el.checked).to.be.true;

  el.checked = false;
  await el.updateComplete;
  expect(el.checked).to.be.false;
  expect(new FormData(form).get("notify")).to.equal(null);
  expect(el.checkValidity()).to.be.false;

  form.reset();
  expect(el.checked, "reset must restore the declared default, not blank/false")
    .to.be.true;
  expect(new FormData(form).get("notify")).to.equal("yes");
  expect(el.checkValidity()).to.be.true;
});

it("resets to unchecked via form.reset() when no default was declared", async () => {
  const form = (await fixture(html`
    <form><lr-switch name="notify">Notify me</lr-switch></form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-switch") as LyraSwitch;
  el.checked = true;
  await el.updateComplete;
  expect(new FormData(form).get("notify")).to.equal("on");

  form.reset();
  expect(el.checked).to.be.false;
  expect(new FormData(form).get("notify")).to.equal(null);
});

it("does not turn a pre-connect checked property assignment into the reset default", async () => {
  const form = document.createElement("form");
  const el = document.createElement("lr-switch") as LyraSwitch;
  el.checked = true;
  form.append(el);
  document.body.append(form);
  await el.updateComplete;

  form.reset();
  expect(el.checked).to.be.false;
  form.remove();
});

it("temporarily disables through a fieldset without overwriting the author disabled state", async () => {
  const form = (await fixture(html`
    <form>
      <fieldset>
        <lr-switch name="notify" value="yes" checked>Notify me</lr-switch>
        <lr-switch name="always-disabled" value="yes" checked disabled
          >Always disabled</lr-switch
        >
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-switch") as LyraSwitch;
  const explicitlyDisabled = form.querySelector(
    '[name="always-disabled"]'
  ) as LyraSwitch;
  const fieldset = form.querySelector("fieldset") as HTMLFieldSetElement;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;

  expect(el.disabled).to.be.false;
  expect(el.effectiveDisabled).to.be.false;
  expect(new FormData(form).get("notify")).to.equal("yes");

  fieldset.disabled = true;
  await Promise.all([el.updateComplete, explicitlyDisabled.updateComplete]);
  expect(el.disabled, "fieldset state must not mutate the public property").to
    .be.false;
  expect(el.hasAttribute("disabled")).to.be.false;
  expect(el.effectiveDisabled).to.be.true;
  expect(base.getAttribute("tabindex")).to.equal("-1");
  expect(base.getAttribute("aria-disabled")).to.equal("true");
  expect(getComputedStyle(base).cursor).to.equal("not-allowed");
  expect(new FormData(form).get("notify")).to.equal(null);

  base.click();
  expect(el.checked, "inherited disabled state blocks activation").to.be.true;

  fieldset.disabled = false;
  await Promise.all([el.updateComplete, explicitlyDisabled.updateComplete]);
  expect(el.disabled).to.be.false;
  expect(el.effectiveDisabled).to.be.false;
  expect(base.getAttribute("tabindex")).to.equal("0");
  expect(base.getAttribute("aria-disabled")).to.equal("false");
  expect(new FormData(form).get("notify")).to.equal("yes");

  expect(
    explicitlyDisabled.disabled,
    "an explicit disabled state survives the fieldset cycle"
  ).to.be.true;
  expect(explicitlyDisabled.effectiveDisabled).to.be.true;
  expect(new FormData(form).get("always-disabled")).to.equal(null);
});

it("is accessible in the default (unchecked, unlabeled) state", async () => {
  const el = (await fixture(
    html`<lr-switch aria-label="Enable notifications"></lr-switch>`
  )) as LyraSwitch;
  await expect(el).to.be.accessible();
});

it("is accessible in a checked, labeled, required state", async () => {
  const el = (await fixture(
    html`<lr-switch checked required>Enable notifications</lr-switch>`
  )) as LyraSwitch;
  await expect(el).to.be.accessible();
});

it("keeps interactive label content outside the switch and does not toggle through it", async () => {
  const el = (await fixture(html`
    <lr-switch
      >Enable notifications <button type="button">Configure</button></lr-switch
    >
  `)) as LyraSwitch;
  const button = el.querySelector("button")!;
  let buttonClicks = 0;
  button.addEventListener("click", () => {
    buttonClicks += 1;
  });

  await expect(el).to.be.accessible();
  button.click();
  expect(buttonClicks).to.equal(1);
  expect(el.checked).to.be.false;

  (el.shadowRoot!.querySelector('[part="label"]') as HTMLElement).click();
  expect(el.checked).to.be.true;
});

it("ignores repeated Space keydowns after the initial keyboard activation", async () => {
  const el = (await fixture(
    html`<lr-switch>Notifications</lr-switch>`
  )) as LyraSwitch;
  const owner = el.shadowRoot!.querySelector('[role="switch"]') as HTMLElement;
  owner.dispatchEvent(
    new KeyboardEvent("keydown", { key: " ", bubbles: true })
  );
  owner.dispatchEvent(
    new KeyboardEvent("keydown", { key: " ", bubbles: true, repeat: true })
  );
  expect(el.checked).to.be.true;
});

it("is accessible with a populated hint/errorText (the parts never rendered by the cases above)", async () => {
  const el = (await fixture(
    html`<lr-switch
      hint="You can change this later"
      error-text="Required"
      required
      >Enable notifications</lr-switch
    >`
  )) as LyraSwitch;
  await expect(el).to.be.accessible();
});

describe("hint/error chrome", () => {
  it("renders no hint/error chrome when hint/errorText are unset (today's exact bare output)", async () => {
    const el = (await fixture(
      html`<lr-switch>Enable notifications</lr-switch>`
    )) as LyraSwitch;
    const hint = el.shadowRoot!.querySelector('[part~="hint"]') as HTMLElement;
    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(hint.hidden).to.be.true;
    expect(error.hidden).to.be.true;
    const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    expect(base.hasAttribute("aria-describedby")).to.be.false;
  });

  it("renders hint/errorText text and un-hides the matching parts", async () => {
    const el = (await fixture(
      html`<lr-switch hint="You can change this later" error-text="Required"
        >Enable notifications</lr-switch
      >`
    )) as LyraSwitch;
    const hint = el.shadowRoot!.querySelector('[part~="hint"]') as HTMLElement;
    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(hint.hidden).to.be.false;
    expect(hint.textContent).to.contain("You can change this later");
    expect(error.hidden).to.be.false;
    expect(error.textContent).to.contain("Required");
  });

  it("wires aria-describedby on the inner switch to the rendered error/hint ids", async () => {
    const el = (await fixture(
      html`<lr-switch hint="Hint text" error-text="Err text"
        >Enable notifications</lr-switch
      >`
    )) as LyraSwitch;
    const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    expect(base.getAttribute("aria-describedby")).to.equal(
      "switch-error switch-hint"
    );
  });

  it("supports slotted hint/error content in place of the text props, without disturbing the default-slot label", async () => {
    const el = (await fixture(html`
      <lr-switch>
        Enable notifications
        <span slot="hint">Slotted hint</span>
        <span slot="error">Slotted error</span>
      </lr-switch>
    `)) as LyraSwitch;
    const hint = el.shadowRoot!.querySelector('[part~="hint"]') as HTMLElement;
    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
    expect(hint.hidden).to.be.false;
    expect(error.hidden).to.be.false;
    expect(label.hidden).to.be.false;
  });

  it("does not treat a slotted hint/error-only switch (no default-slot text) as having a label", async () => {
    const el = (await fixture(html`
      <lr-switch>
        <span slot="hint">Slotted hint</span>
      </lr-switch>
    `)) as LyraSwitch;
    const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
    expect(label.hidden).to.be.true;
  });
});

it("exposes checkValidity()/reportValidity() through ElementInternals", async () => {
  const el = (await fixture(
    html`<lr-switch required>Label</lr-switch>`
  )) as LyraSwitch;
  await el.updateComplete;
  expect(el.checkValidity(), "required and unchecked is invalid").to.be.false;
  expect(el.reportValidity()).to.be.false;
  el.checked = true;
  await el.updateComplete;
  expect(el.checkValidity()).to.be.true;
  expect(el.reportValidity()).to.be.true;
});

// -- Degraded-DOM form-association fallback ---------------------------------

describe("ElementInternals fallback (lr-switch)", () => {
  /** Mirrors a DOM implementation without form-association support (a consumer's happy-dom/Vitest
   *  suite). `attachInternals()` is browser-only, so the component swaps in inert no-op internals
   *  rather than throwing at construction -- every member has to answer, and value changes must
   *  still work with form participation simply unavailable. */
  const withoutAttachInternals = async (
    impl: undefined | (() => never),
    assertion: (el: LyraSwitch) => void | Promise<void>
  ): Promise<void> => {
    const proto = HTMLElement.prototype as unknown as {
      attachInternals?: unknown;
    };
    const original = proto.attachInternals;
    if (impl === undefined) delete proto.attachInternals;
    else proto.attachInternals = impl;
    try {
      const el = (await fixture(
        html`<lr-switch>Label</lr-switch>`
      )) as LyraSwitch;
      await el.updateComplete;
      await assertion(el);
    } finally {
      proto.attachInternals = original;
    }
  };

  it("answers inertly when attachInternals is missing", async () => {
    await withoutAttachInternals(undefined, async (el) => {
      const internals = (el as unknown as { internals: ElementInternals })
        .internals;
      expect(internals.form === null).to.equal(true);
      expect(internals.willValidate).to.be.false;
      expect(internals.validationMessage).to.equal("");
      expect(internals.checkValidity()).to.be.true;
      expect(internals.reportValidity()).to.be.true;
      expect(() => internals.setFormValue("x")).to.not.throw();
      expect(() => internals.setValidity({}, "")).to.not.throw();
      el.checked = true;
      await el.updateComplete;
    });
  });

  it("answers inertly when attachInternals throws", async () => {
    await withoutAttachInternals(
      () => {
        throw new DOMException("unsupported");
      },
      (el) => {
        const internals = (el as unknown as { internals: ElementInternals })
          .internals;
        expect(internals.willValidate).to.be.false;
        expect(internals.reportValidity()).to.be.true;
        expect(internals.checkValidity()).to.be.true;
      }
    );
  });
});

describe("size", () => {
  async function trackOf(markup: unknown): Promise<DOMRect> {
    const el = (await fixture(markup as never)) as LyraSwitch;
    await el.updateComplete;
    const track = el.shadowRoot!.querySelector(
      '[part~="track"]'
    ) as HTMLElement;
    return track.getBoundingClientRect();
  }

  it('defaults to the "m" tier and reflects it', async () => {
    const el = (await fixture(
      html`<lr-switch>Label</lr-switch>`
    )) as LyraSwitch;
    await el.updateComplete;
    expect(el.size).to.equal("m");
    expect(el.getAttribute("size")).to.equal("m");
  });

  it("keeps the 2xs label-less switch role owner at the shared target floor while centering the compact track", async () => {
    const el = (await fixture(
      html`<lr-switch size="2xs" aria-label="Notifications"></lr-switch>`
    )) as LyraSwitch;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    const track = el.shadowRoot!.querySelector(
      '[part~="track"]'
    ) as HTMLElement;
    const baseBounds = base.getBoundingClientRect();
    const trackBounds = track.getBoundingClientRect();

    expect(base.getAttribute("role")).to.equal("switch");
    expect(baseBounds.width).to.be.at.least(40);
    expect(baseBounds.height).to.be.at.least(40);
    expect(trackBounds.width).to.be.closeTo(18, 0.5);
    expect(trackBounds.height).to.be.closeTo(10, 0.5);
    expect(trackBounds.left + trackBounds.width / 2).to.be.closeTo(
      baseBounds.left + baseBounds.width / 2,
      0.5
    );
    expect(trackBounds.top + trackBounds.height / 2).to.be.closeTo(
      baseBounds.top + baseBounds.height / 2,
      0.5
    );
  });

  it('grows the rendered track from size="s" to size="l"', async () => {
    const small = await trackOf(html`<lr-switch size="s">Label</lr-switch>`);
    const large = await trackOf(html`<lr-switch size="l">Label</lr-switch>`);
    expect(large.width).to.be.greaterThan(small.width);
    expect(large.height).to.be.greaterThan(small.height);
  });

  it('renders "small"/"large" at the same geometry as "s"/"l"', async () => {
    const s = await trackOf(html`<lr-switch size="s">Label</lr-switch>`);
    const small = await trackOf(
      html`<lr-switch size="small">Label</lr-switch>`
    );
    const l = await trackOf(html`<lr-switch size="l">Label</lr-switch>`);
    const large = await trackOf(
      html`<lr-switch size="large">Label</lr-switch>`
    );
    expect(small.width).to.be.closeTo(s.width, 0.5);
    expect(large.width).to.be.closeTo(l.width, 0.5);
  });

  it("keeps the thumb inside the track and travelling its full width at every tier", async () => {
    let previous = 0;
    for (const size of ["2xs", "xs", "s", "m", "l", "xl"] as const) {
      const el = (await fixture(
        html`<lr-switch size=${size} checked>Label</lr-switch>`
      )) as LyraSwitch;
      await el.updateComplete;
      const track = (
        el.shadowRoot!.querySelector('[part~="track"]') as HTMLElement
      ).getBoundingClientRect();
      const thumb = (
        el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement
      ).getBoundingClientRect();
      expect(thumb.height, `${size} thumb fits`).to.be.lessThan(track.height);
      expect(thumb.right, `${size} thumb stays inside`).to.be.at.most(
        track.right + 0.5
      );
      expect(
        track.width,
        `${size} track grows with the tier`
      ).to.be.greaterThan(previous);
      previous = track.width;
    }
  });

  it("is accessible at a non-default tier", async () => {
    const el = (await fixture(
      html`<lr-switch size="l">Label</lr-switch>`
    )) as LyraSwitch;
    await el.updateComplete;
    await expect(el).to.be.accessible();
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

describe("lr-switch validity custom states", () => {
  it("publishes required/optional and valid/invalid from the first render", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(
      html`<lr-switch required>Notifications</lr-switch>`
    )) as LyraSwitch;
    await el.updateComplete;
    expect(el.matches(":state(required)"), "required").to.be.true;
    expect(el.matches(":state(optional)"), "optional").to.be.false;
    expect(el.matches(":state(invalid)"), "invalid").to.be.true;
    expect(el.matches(":state(valid)"), "valid").to.be.false;

    const optional = (await fixture(
      html`<lr-switch>Notifications</lr-switch>`
    )) as LyraSwitch;
    await optional.updateComplete;
    expect(optional.matches(":state(optional)")).to.be.true;
    expect(optional.matches(":state(valid)")).to.be.true;
  });

  it("withholds user-valid/user-invalid until the user has actually interacted", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(
      html`<lr-switch required>Notifications</lr-switch>`
    )) as LyraSwitch;
    await el.updateComplete;
    expect(
      el.matches(":state(user-invalid)"),
      "pristine required must not read as an error"
    ).to.be.false;

    el.click();
    await el.updateComplete;
    expect(el.checked).to.be.true;
    expect(el.matches(":state(valid)")).to.be.true;
    expect(el.matches(":state(user-valid)"), "user-valid after a real toggle")
      .to.be.true;
  });

  it("does not turn a disabled blur into user interaction after re-enabling", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(
      html`<lr-switch required>Notifications</lr-switch>`
    )) as LyraSwitch;
    const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;

    el.disabled = true;
    base.dispatchEvent(new FocusEvent("blur"));
    el.disabled = false;
    await el.updateComplete;

    expect(
      el.matches(":state(user-invalid)"),
      "a disable-forced blur leaves the control pristine"
    ).to.be.false;
  });

  it("counts a reportValidity() call -- what a submit attempt runs -- as interaction", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(
      html`<lr-switch required>Notifications</lr-switch>`
    )) as LyraSwitch;
    await el.updateComplete;
    expect(el.matches(":state(user-invalid)")).to.be.false;
    el.reportValidity();
    expect(el.matches(":state(user-invalid)")).to.be.true;
  });

  it("goes pristine again after a form reset", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const form = await fixture<HTMLFormElement>(
      html`<form>
        <lr-switch name="notify" required>Notifications</lr-switch>
      </form>`
    );
    const el = form.querySelector("lr-switch") as LyraSwitch;
    await el.updateComplete;
    el.reportValidity();
    expect(el.matches(":state(user-invalid)")).to.be.true;
    form.reset();
    await el.updateComplete;
    expect(
      el.matches(":state(user-invalid)"),
      "reset returns the control to pristine"
    ).to.be.false;
    expect(el.matches(":state(invalid)")).to.be.true;
  });
});

describe("lr-switch setCustomValidity()", () => {
  it("blocks form submission and becomes the validationMessage", async () => {
    const form = (await fixture(html`
      <form>
        <lr-switch name="notify" value="yes" checked>Notify me</lr-switch>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-switch") as LyraSwitch;
    let submits = 0;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submits += 1;
    });

    form.requestSubmit();
    expect(submits, "an otherwise-valid switch submits").to.equal(1);

    el.setCustomValidity("Notifications are disabled for your plan");
    expect(el.validationMessage).to.equal(
      "Notifications are disabled for your plan"
    );
    expect(el.validity.customError, "customError").to.be.true;
    expect(el.checkValidity()).to.be.false;

    form.requestSubmit();
    expect(submits, "a custom error blocks submission").to.equal(1);
  });

  it("survives an intrinsic revalidation", async () => {
    const el = (await fixture(
      html`<lr-switch required>Agree</lr-switch>`
    )) as LyraSwitch;
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
      <form><lr-switch name="notify">Notify me</lr-switch></form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-switch") as LyraSwitch;
    el.setCustomValidity("Server says no");
    form.reset();
    await el.updateComplete;
    expect(el.validity.customError).to.be.true;
    expect(el.validationMessage).to.equal("Server says no");
  });

  it("resetValidity() restores computed validity rather than forcing the control valid", async () => {
    const el = (await fixture(
      html`<lr-switch required>Agree</lr-switch>`
    )) as LyraSwitch;
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
      html`<lr-switch>Notify me</lr-switch>`
    )) as LyraSwitch;
    await el.updateComplete;
    expect(el.matches(":state(valid)"), "valid before").to.be.true;
    el.setCustomValidity("Server says no");
    expect(el.matches(":state(invalid)"), "invalid while a custom error is set")
      .to.be.true;
    expect(el.matches(":state(valid)")).to.be.false;
    el.setCustomValidity("");
    expect(el.matches(":state(valid)"), "valid again once cleared").to.be.true;
  });
});

it("bars constraint validation while disabled, like a native disabled required control", async () => {
  const el = (await fixture(
    html`<lr-switch required disabled>Enable</lr-switch>`
  )) as LyraSwitch;
  await el.updateComplete;
  expect(el.validity.valueMissing, "a barred control raises no violation").to.be
    .false;
  expect(el.checkValidity()).to.be.true;

  el.disabled = false;
  await el.updateComplete;
  expect(
    el.validity.valueMissing,
    "the violation returns once it is enforceable again"
  ).to.be.true;
});

it('exposes the row wrapper that holds the switch owner and label as a part, so a column of switches can be aligned', async () => {
  const el = (await fixture(
    html`<lr-switch>Enable notifications</lr-switch>`
  )) as LyraSwitch;
  await el.updateComplete;

  const row = el.shadowRoot!.querySelector<HTMLElement>('[part~="row"]');
  expect(row, 'the row wrapper carries a part of its own').to.exist;

  // The reported defect was not "no part anywhere" but "the part named `base` is the track box,
  // a SIBLING of the label, so nothing selects the node that actually wraps the row". Assert the
  // structural relationship rather than just the attribute, or a part added to the wrong node
  // would still pass.
  const owner = el.shadowRoot!.querySelector<HTMLElement>('[part~="switch"]')!;
  const label = el.shadowRoot!.querySelector<HTMLElement>('[part~="label"]')!;
  // Compared as booleans, never as nodes: a failing chai assertion carrying a DOM node as
  // actual/expected hangs the whole file until the per-file watchdog.
  expect(owner.parentElement === row, 'the switch owner is a child of the row').to.be.true;
  expect(label.parentElement === row, 'the label is a child of the same row').to.be.true;
});

it('lets ::part(row) stretch the switch across its container, which a shrink-to-fit wrapper made impossible', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`
    <div style="inline-size: 300px">
      <style>
        lr-switch::part(row) {
          display: flex;
          inline-size: 100%;
          justify-content: space-between;
        }
      </style>
      <lr-switch style="display: block">Enable notifications</lr-switch>
    </div>
  `);
  const el = wrapper.querySelector<LyraSwitch>('lr-switch')!;
  await el.updateComplete;

  const row = el.shadowRoot!.querySelector<HTMLElement>('[part~="row"]')!;
  expect(row.getBoundingClientRect().width, 'the row fills the 300px container').to.be.closeTo(300, 1);
});
