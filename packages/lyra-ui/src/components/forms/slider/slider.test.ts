import { assertNativeFocusBlurPair } from '../../../../test/contracts/native-focus-blur.js';
// Focused interaction and event contracts cases. Test bodies and titles were moved intact from the prior suite.
import { expectStaleAttribute } from '../../../../test/expected-stale-attributes.js';
import { aTimeout, fixture, expect, html, elementUpdated, oneEvent } from "@open-wc/testing";
import "./slider.js";
import type { LyraSlider } from "./slider.js";
import { styles } from "./slider.styles.js";
import { captureDeprecationWarnings, expectDeprecatedUsage, type DeprecatedUsage } from "../../../../test/expected-deprecations.js";
import "../../../translations/ar/forms.js";

expectDeprecatedUsage("lr-slider", "property", "showValue");

expectStaleAttribute('lr-slider', 'show-value');

function mockTrackWidth(el: LyraSlider, width: number): void {
  const track = el.shadowRoot!.querySelector('[part="track"]') as HTMLElement;
  track.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: width,
      bottom: 0,
      width,
      height: 0,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    } as DOMRect);
}

function mockTrackHeight(el: LyraSlider, height: number): void {
  const track = el.shadowRoot!.querySelector('[part="track"]') as HTMLElement;
  track.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 0,
      bottom: height,
      width: 0,
      height,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    } as DOMRect);
}

function handles(el: LyraSlider): HTMLElement[] {
  return Array.from(
    el.shadowRoot!.querySelectorAll('[part~="thumb"]')
  ) as HTMLElement[];
}

function stubPointerCapture(el: LyraSlider): void {
  for (const handle of handles(el)) handle.setPointerCapture = () => {};
}

it("themes the row gap through a component-scoped hook", async () => {
  const el = (await fixture(html`
    <lr-slider aria-label="Volume" style="--lr-slider-gap: 13px"></lr-slider>
  `)) as LyraSlider;
  expect(getComputedStyle(el).columnGap).to.equal("13px");
  expect(getComputedStyle(el).rowGap).to.equal("13px");
});

it("defaults min=0, max=100, step=1, and starts at zero", async () => {
  const el = (await fixture(html`<lr-slider></lr-slider>`)) as LyraSlider;
  expect(el.min).to.equal(0);
  expect(el.max).to.equal(100);
  expect(el.step).to.equal(1);
  expect(el.value).to.equal(0);
  expect(el.valueAsNumber).to.equal(0);
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  expect(thumb.getAttribute("role")).to.equal("slider");
  expect(thumb.getAttribute("aria-valuemin")).to.equal("0");
  expect(thumb.getAttribute("aria-valuemax")).to.equal("100");
  expect(thumb.getAttribute("aria-valuenow")).to.equal("0");
});

it("keeps extreme finite domains and tiny steps finite instead of overflowing rounding math", async () => {
  const el = (await fixture(html`<lr-slider></lr-slider>`)) as LyraSlider;
  el.min = -Number.MAX_VALUE;
  el.max = Number.MAX_VALUE;
  el.step = Number.MIN_VALUE;
  el.valueAsNumber = 0;
  await el.updateComplete;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  await el.updateComplete;

  expect(Number.isFinite(el.valueAsNumber)).to.be.true;
  expect(thumb.getAttribute("style")).to.not.contain("NaN");
  expect(thumb.getAttribute("style")).to.not.contain("Infinity");
});

it("keeps the zero default finite and pointer-maps the full finite number range", async () => {
  const defaulted = (await fixture(html`
    <lr-slider
      min=${-Number.MAX_VALUE}
      max=${Number.MAX_VALUE}
      step="0"
    ></lr-slider>
  `)) as LyraSlider;
  expect(defaulted.valueAsNumber).to.equal(0);

  const dragged = (await fixture(html`
    <lr-slider
      min=${-Number.MAX_VALUE}
      max=${Number.MAX_VALUE}
      step="0"
      value=${-Number.MAX_VALUE}
    ></lr-slider>
  `)) as LyraSlider;
  const thumb = dragged.shadowRoot!.querySelector(
    '[part="thumb"]'
  ) as HTMLElement;
  thumb.setPointerCapture = () => {};
  mockTrackWidth(dragged, 200);
  thumb.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 70,
      clientX: 0,
    })
  );
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 70, clientX: 100 })
  );
  expect(dragged.valueAsNumber).to.equal(0);
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 70 }));
});

it("honors a declared numeric value attribute instead of the zero default", async () => {
  const el = (await fixture(
    html`<lr-slider value="70"></lr-slider>`
  )) as LyraSlider;
  expect(el.value).to.equal(70);
  expect(el.valueAsNumber).to.equal(70);
});

it("keeps numeric value and valueAsNumber in sync while accepting compatible string writes", async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="1" step="0.1"></lr-slider>`
  )) as LyraSlider;
  el.valueAsNumber = 0.7;
  await elementUpdated(el);
  expect(el.value).to.equal(0.7);

  el.value = "0.3";
  await elementUpdated(el);
  expect(el.valueAsNumber).to.equal(0.3);
});

it('omits the value readout from a plain HTML with-value="false" content attribute too, not just the .withValue property binding', async () => {
  // Regression guard for trueDefaultBooleanConverter: Lit's default presence-based `type:
  // Boolean` converter can never be turned back off from a plain-HTML attribute once the
  // property's own default is `true` -- a bare with-value="false" string would otherwise still
  // parse as truthy (only presence matters to the default converter).
  const el = (await fixture(
    html`<lr-slider value="42" with-value="false"></lr-slider>`
  )) as LyraSlider;
  expect(el.withValue).to.be.false;
  expect(el.shadowRoot!.querySelector('[part="value"]') === null).to.equal(
    true
  );

  // Removing the attribute (never setting it at all) restores the false default, the other half of
  // the same converter's contract.
  const defaulted = (await fixture(
    html`<lr-slider value="42"></lr-slider>`
  )) as LyraSlider;
  expect(defaulted.withValue).to.be.false;
});

it("moves by one step on ArrowRight/ArrowUp and emits lr-input on keydown, lr-change on keyup", async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="100" value="20" step="5"></lr-slider>`
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;

  const sequence: Array<{ type: string; event: Event }> = [];
  for (const type of ["input", "lr-input", "change", "lr-change"]) {
    el.addEventListener(type, (event) => sequence.push({ type, event }));
  }

  let inputDetail: { value: number } | undefined;
  el.addEventListener(
    "lr-input",
    (e) => (inputDetail = (e as CustomEvent).detail)
  );
  thumb.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  expect(inputDetail!.value).to.equal(25);
  expect(el.valueAsNumber).to.equal(25);

  let changeDetail: { value: number } | undefined;
  el.addEventListener(
    "lr-change",
    (e) => (changeDetail = (e as CustomEvent).detail)
  );
  thumb.dispatchEvent(
    new KeyboardEvent("keyup", { key: "ArrowRight", bubbles: true })
  );
  expect(changeDetail!.value).to.equal(25);
  expect(sequence.map(({ type }) => type)).to.deep.equal([
    "input",
    "lr-input",
    "change",
    "lr-change",
  ]);
  const [nativeInput, aliasInput, nativeChange] = sequence;
  if (!nativeInput || !aliasInput || !nativeChange) {
    throw new Error("The slider event sequence was incomplete.");
  }
  expect(nativeInput.event instanceof InputEvent).to.be.true;
  expect(nativeChange.event.constructor === Event).to.be.true;
  expect(nativeInput.event.target === el && nativeChange.event.target === el).to
    .be.true;
  expect(aliasInput.event instanceof CustomEvent).to.be.true;
  expect((aliasInput.event as CustomEvent).detail.handle).to.equal("value");
});

it("moves by one step on ArrowLeft/ArrowDown", async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="100" value="20" step="5"></lr-slider>`
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })
  );
  expect(el.valueAsNumber).to.equal(15);
  thumb.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
  );
  expect(el.valueAsNumber).to.equal(10);
});

it("does not emit input or change when a keyboard step is clamped to the current value", async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="100" value="100" step="5"></lr-slider>`
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  let inputCount = 0;
  let changeCount = 0;
  el.addEventListener("lr-input", () => inputCount++);
  el.addEventListener("lr-change", () => changeCount++);

  thumb.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  thumb.dispatchEvent(
    new KeyboardEvent("keyup", { key: "ArrowRight", bubbles: true })
  );

  expect(inputCount).to.equal(0);
  expect(changeCount).to.equal(0);
  expect(el.value).to.equal(100);
});

it("jumps to min/max with Home/End", async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="100" value="20"></lr-slider>`
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.dispatchEvent(
    new KeyboardEvent("keydown", { key: "End", bubbles: true })
  );
  expect(el.valueAsNumber).to.equal(100);
  thumb.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Home", bubbles: true })
  );
  expect(el.valueAsNumber).to.equal(0);
});

it("moves by a larger increment with PageUp/PageDown than a single ArrowUp/ArrowDown step", async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="100" value="20" step="2"></lr-slider>`
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.dispatchEvent(
    new KeyboardEvent("keydown", { key: "PageUp", bubbles: true })
  );
  expect(el.valueAsNumber).to.equal(40);
  thumb.dispatchEvent(
    new KeyboardEvent("keydown", { key: "PageDown", bubbles: true })
  );
  expect(el.valueAsNumber).to.equal(20);
});

it("does not emit lr-change on keyup of a non-slider key", async () => {
  const el = (await fixture(
    html`<lr-slider value="20"></lr-slider>`
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  let changeFired = false;
  el.addEventListener("lr-change", () => (changeFired = true));
  thumb.dispatchEvent(
    new KeyboardEvent("keyup", { key: "Tab", bubbles: true })
  );
  expect(changeFired).to.be.false;
});

it('mirrors ArrowRight/ArrowLeft under dir="rtl", matching lr-time-range/lr-multi-split', async () => {
  const el = (await fixture(
    html`<lr-slider dir="rtl" min="0" max="100" value="20"></lr-slider>`
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  expect(el.valueAsNumber).to.equal(19);
  thumb.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })
  );
  expect(el.valueAsNumber).to.equal(20);
});

it('does not swap ArrowUp/ArrowDown under dir="rtl" (direction only affects the horizontal inline axis)', async () => {
  const el = (await fixture(
    html`<lr-slider dir="rtl" min="0" max="100" value="20"></lr-slider>`
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })
  );
  expect(el.valueAsNumber).to.equal(21);
});

it("drags the thumb with pointer events and emits lr-input then lr-change on release", async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="100" value="20" step="1"></lr-slider>`
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.setPointerCapture = () => {};
  mockTrackWidth(el, 200);

  let inputDetail: { value: number } | undefined;
  el.addEventListener(
    "lr-input",
    (e) => (inputDetail = (e as CustomEvent).detail)
  );
  thumb.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 1,
      clientX: 40,
    })
  );
  // Midpoint of a 200px-wide track -> ratio 0.5 -> value 50 on a [0,100] domain.
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 1, clientX: 100 })
  );
  expect(inputDetail!.value).to.equal(50);
  expect(el.valueAsNumber).to.equal(50);

  let changeDetail: { value: number } | undefined;
  el.addEventListener(
    "lr-change",
    (e) => (changeDetail = (e as CustomEvent).detail)
  );
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
  expect(changeDetail!.value).to.equal(50);
});

it("moves owned focus between the scalar thumb and range handles when range mode changes", async () => {
  const el = (await fixture(
    html`<lr-slider
      min="0"
      max="100"
      value="30"
      min-value="20"
      max-value="80"
    ></lr-slider>`
  )) as LyraSlider;
  const scalar = el.shadowRoot!.querySelector<HTMLElement>('[part~="thumb"]')!;
  scalar.focus();

  el.range = true;
  await el.updateComplete;
  await aTimeout(0);
  const minThumb = el.shadowRoot!.querySelector<HTMLElement>(
    '[part~="thumb-min"]'
  )!;
  const maxThumb = el.shadowRoot!.querySelector<HTMLElement>(
    '[part~="thumb-max"]'
  )!;
  expect(el.shadowRoot!.activeElement === minThumb).to.equal(true);

  maxThumb.focus();
  el.range = false;
  await el.updateComplete;
  await aTimeout(0);
  const restoredScalar =
    el.shadowRoot!.querySelector<HTMLElement>('[part~="thumb"]')!;
  expect(el.shadowRoot!.activeElement === restoredScalar).to.equal(true);
});

it("does not move external focus when range mode changes", async () => {
  const wrapper = await fixture<HTMLDivElement>(html`
    <div>
      <button id="outside-slider-mode">Outside</button>
      <lr-slider></lr-slider>
    </div>
  `);
  const el = wrapper.querySelector("lr-slider") as LyraSlider;
  const outside = wrapper.querySelector<HTMLButtonElement>(
    "#outside-slider-mode"
  )!;
  outside.focus();

  el.range = true;
  await el.updateComplete;
  await aTimeout(0);
  expect(el.ownerDocument.activeElement?.id).to.equal("outside-slider-mode");

  el.range = false;
  await el.updateComplete;
  await aTimeout(0);
  expect(el.ownerDocument.activeElement?.id).to.equal("outside-slider-mode");
});

it("aborts pointer capture and window drag listeners when range mode replaces the active handle", async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="100" value="20" step="1"></lr-slider>`
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector<HTMLElement>('[part~="thumb"]')!;
  let releases = 0;
  thumb.setPointerCapture = () => {};
  thumb.hasPointerCapture = () => true;
  thumb.releasePointerCapture = () => {
    releases++;
  };
  mockTrackWidth(el, 200);
  let inputs = 0;
  let changes = 0;
  el.addEventListener("lr-input", () => inputs++);
  el.addEventListener("lr-change", () => changes++);

  thumb.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 144,
      clientX: 40,
    })
  );
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 144, clientX: 100 })
  );
  expect(inputs).to.equal(1);
  el.range = true;
  await el.updateComplete;

  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 144, clientX: 180 })
  );
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 144 }));
  expect(releases).to.equal(1);
  expect(
    inputs,
    "the retired scalar drag cannot mutate either range handle"
  ).to.equal(1);
  expect(
    changes,
    "a structural mode change does not commit the aborted gesture"
  ).to.equal(0);
});

it("keeps an adopted iframe drag on its owner window and releases that window on readoption", async () => {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const frameWindow = frame.contentWindow!;
  const el = (await fixture(
    html`<lr-slider min="0" max="100" value="20" step="1"></lr-slider>`
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.setPointerCapture = () => {};
  mockTrackWidth(el, 200);

  try {
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;
    thumb.dispatchEvent(
      new frameWindow.PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 82,
        clientX: 40,
      })
    );
    frameWindow.dispatchEvent(
      new frameWindow.PointerEvent("pointermove", {
        pointerId: 82,
        clientX: 100,
      })
    );
    expect(el.valueAsNumber).to.equal(50);

    document.body.append(document.adoptNode(el));
    await el.updateComplete;
    const adoptedValue = el.valueAsNumber;
    frameWindow.dispatchEvent(
      new frameWindow.PointerEvent("pointermove", {
        pointerId: 82,
        clientX: 180,
      })
    );
    expect(
      el.valueAsNumber,
      "the retired iframe listener must be gone"
    ).to.equal(adoptedValue);
  } finally {
    el.remove();
    frame.remove();
  }
});

it("does not arm a drag while disconnected in an ownerless document", async () => {
  const inertDocument = document.implementation.createHTMLDocument("ownerless");
  const el = (await fixture(
    html`<lr-slider min="0" max="100" value="20" step="1"></lr-slider>`
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.setPointerCapture = () => {};
  mockTrackWidth(el, 200);

  try {
    el.remove();
    inertDocument.adoptNode(el);
    thumb.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 86,
        clientX: 40,
      })
    );

    document.body.append(document.adoptNode(el));
    await el.updateComplete;
    thumb.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 87,
        clientX: 40,
      })
    );
    window.dispatchEvent(
      new PointerEvent("pointermove", { pointerId: 87, clientX: 100 })
    );
    expect(el.valueAsNumber).to.equal(50);
    window.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 87 }));
  } finally {
    el.remove();
  }
});

it("ignores a detached track gesture after its rendered base becomes stale", async () => {
  const el = await fixture<LyraSlider>(html`
    <lr-slider min="0" max="100" value="20"></lr-slider>
  `);
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  const thumb = el.shadowRoot!.querySelector('[part~="thumb"]') as HTMLElement;
  let captures = 0;
  thumb.setPointerCapture = () => {
    captures += 1;
  };
  mockTrackWidth(el, 200);
  el.remove();

  base.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 860,
      clientX: 160,
    })
  );

  expect(captures).to.equal(0);
  expect(el.valueAsNumber).to.equal(20);
});

it("ignores unrelated pointer traffic while another pointer owns the drag", async () => {
  const el = await fixture<LyraSlider>(html`
    <lr-slider min="0" max="100" value="20"></lr-slider>
  `);
  const thumb = el.shadowRoot!.querySelector('[part~="thumb"]') as HTMLElement;
  thumb.setPointerCapture = () => {};
  thumb.releasePointerCapture = () => {};
  mockTrackWidth(el, 200);
  thumb.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 861,
      clientX: 40,
    })
  );
  const before = el.valueAsNumber;

  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 999, clientX: 180 })
  );
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 999 }));

  expect(el.valueAsNumber).to.equal(before);
  window.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 861 }));
});

it("retains one iframe owner listener until both concurrent range drags end", async () => {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const frameWindow = frame.contentWindow!;
  const el = (await fixture(html`
    <lr-slider
      range
      min="0"
      max="100"
      min-value="20"
      max-value="80"
      step="1"
    ></lr-slider>
  `)) as LyraSlider;
  const minThumb = el.shadowRoot!.querySelector(
    '[part~="thumb-min"]'
  ) as HTMLElement;
  const maxThumb = el.shadowRoot!.querySelector(
    '[part~="thumb-max"]'
  ) as HTMLElement;
  minThumb.setPointerCapture = () => {};
  maxThumb.setPointerCapture = () => {};
  mockTrackWidth(el, 200);

  try {
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;
    minThumb.dispatchEvent(
      new frameWindow.PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 88,
        clientX: 40,
      })
    );
    maxThumb.dispatchEvent(
      new frameWindow.PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 89,
        clientX: 160,
      })
    );
    frameWindow.dispatchEvent(
      new frameWindow.PointerEvent("pointermove", {
        pointerId: 88,
        clientX: 60,
      })
    );
    expect(el.minValue).to.equal(30);
    frameWindow.dispatchEvent(
      new frameWindow.PointerEvent("pointerup", { pointerId: 88 })
    );
    frameWindow.dispatchEvent(
      new frameWindow.PointerEvent("pointermove", {
        pointerId: 89,
        clientX: 140,
      })
    );
    expect(el.maxValue).to.equal(70);
    frameWindow.dispatchEvent(
      new frameWindow.PointerEvent("pointerup", { pointerId: 89 })
    );
    frameWindow.dispatchEvent(
      new frameWindow.PointerEvent("pointermove", {
        pointerId: 89,
        clientX: 120,
      })
    );
    expect(el.maxValue).to.equal(70);
  } finally {
    el.remove();
    frame.remove();
  }
});

it("clicking the track (not the thumb) jumps the thumb to that point and continues the drag", async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="100" value="20" step="1"></lr-slider>`
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  const track = el.shadowRoot!.querySelector('[part="track"]') as HTMLElement;
  thumb.setPointerCapture = () => {};
  mockTrackWidth(el, 200);

  let inputDetail: { value: number } | undefined;
  el.addEventListener(
    "lr-input",
    (e) => (inputDetail = (e as CustomEvent).detail)
  );
  // Clicking directly on the track at x=150 (75% across a 200px track) should
  // immediately jump the thumb there, matching native <input type=range>'s
  // click-to-seek, which this component previously lacked entirely (only the
  // 16px thumb itself had a pointerdown handler).
  track.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 2,
      clientX: 150,
    })
  );
  expect(inputDetail!.value).to.equal(75);
  expect(el.valueAsNumber).to.equal(75);

  // The same gesture continues as a drag from the jumped-to point.
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 2, clientX: 100 })
  );
  expect(el.valueAsNumber).to.equal(50);

  let changeDetail: { value: number } | undefined;
  el.addEventListener(
    "lr-change",
    (e) => (changeDetail = (e as CustomEvent).detail)
  );
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 2 }));
  expect(changeDetail!.value).to.equal(50);
});

it("still begins a continuable drag from a track click that lands exactly on the current value", async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="100" value="50" step="1"></lr-slider>`
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  const track = el.shadowRoot!.querySelector('[part="track"]') as HTMLElement;
  thumb.setPointerCapture = () => {};
  mockTrackWidth(el, 200);

  let inputs = 0;
  el.addEventListener("lr-input", () => inputs++);
  // x=100 on a 200px track is exactly the current value's own 50% position,
  // so the jump-to-click assignment is a no-op (setValueFor returns false,
  // emitting no lr-input) -- but the drag itself must still arm so the
  // gesture can continue seamlessly as soon as the pointer actually moves.
  track.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 3,
      clientX: 100,
    })
  );
  expect(inputs).to.equal(0);
  expect(el.valueAsNumber).to.equal(50);

  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 3, clientX: 150 })
  );
  expect(inputs).to.equal(1);
  expect(el.valueAsNumber).to.equal(75);
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 3 }));
});

it("maps zero-area track geometry to stable domain endpoints", async () => {
  const horizontal = (await fixture(
    html`<lr-slider min="0" max="100" value="55" step="1"></lr-slider>`
  )) as LyraSlider;
  const horizontalTrack = horizontal.shadowRoot!.querySelector(
    '[part="track"]'
  ) as HTMLElement;
  stubPointerCapture(horizontal);
  mockTrackWidth(horizontal, 0);
  horizontalTrack.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 31,
      clientX: 999,
    })
  );
  expect(
    horizontal.valueAsNumber,
    "a zero-width LTR track resolves to its minimum"
  ).to.equal(0);
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 31 }));

  const vertical = (await fixture(
    html`<lr-slider
      orientation="vertical"
      min="0"
      max="100"
      value="45"
      step="1"
    ></lr-slider>`
  )) as LyraSlider;
  const verticalTrack = vertical.shadowRoot!.querySelector(
    '[part="track"]'
  ) as HTMLElement;
  stubPointerCapture(vertical);
  mockTrackHeight(vertical, 0);
  verticalTrack.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 32,
      clientY: 999,
    })
  );
  expect(
    vertical.valueAsNumber,
    "a zero-height vertical track resolves to its maximum"
  ).to.equal(100);
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 32 }));
});

it("chooses the range handle that can travel toward an equidistant track click", async () => {
  const towardMinimum = (await fixture(html`
    <lr-slider
      range
      min="0"
      max="100"
      min-value="50"
      max-value="50"
    ></lr-slider>
  `)) as LyraSlider;
  const minimumTrack = towardMinimum.shadowRoot!.querySelector(
    '[part="track"]'
  ) as HTMLElement;
  stubPointerCapture(towardMinimum);
  mockTrackWidth(towardMinimum, 200);
  minimumTrack.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 33,
      clientX: 0,
    })
  );
  expect([towardMinimum.minValue, towardMinimum.maxValue]).to.deep.equal([
    0, 50,
  ]);
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 33 }));

  const towardMaximum = (await fixture(html`
    <lr-slider
      range
      min="0"
      max="100"
      min-value="50"
      max-value="50"
    ></lr-slider>
  `)) as LyraSlider;
  const maximumTrack = towardMaximum.shadowRoot!.querySelector(
    '[part="track"]'
  ) as HTMLElement;
  stubPointerCapture(towardMaximum);
  mockTrackWidth(towardMaximum, 200);
  maximumTrack.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 34,
      clientX: 200,
    })
  );
  expect([towardMaximum.minValue, towardMaximum.maxValue]).to.deep.equal([
    50, 100,
  ]);
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 34 }));
});

it("does not double-jump when the pointerdown originates on the thumb itself", async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="100" value="20" step="1"></lr-slider>`
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.setPointerCapture = () => {};
  mockTrackWidth(el, 200);

  thumb.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 3,
      clientX: 40,
    })
  );
  // A pointerdown on the thumb itself (which bubbles up to [part~="base"])
  // must not be treated as a separate track click and jump the value out
  // from under the thumb-only pointerdown handler.
  expect(el.valueAsNumber).to.equal(20);
});

it("focuses the thumb after a track click so keyboard interaction can continue seamlessly", async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="100" value="20" step="1"></lr-slider>`
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  const track = el.shadowRoot!.querySelector('[part="track"]') as HTMLElement;
  thumb.setPointerCapture = () => {};
  mockTrackWidth(el, 200);
  track.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 4,
      clientX: 100,
    })
  );
  // Compared as a boolean rather than `expect(...).to.equal(thumb)` -- on
  // failure, chai's default assertion-message formatting walks live DOM
  // nodes (parentNode/ownerDocument/etc. all hold circular back-references),
  // which can make a *failing* comparison of two elements pathologically
  // slow in this browser test environment.
  expect(el.shadowRoot!.activeElement === thumb).to.be.true;
});

it("ignores a track click while disabled", async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="100" value="20" disabled></lr-slider>`
  )) as LyraSlider;
  const track = el.shadowRoot!.querySelector('[part="track"]') as HTMLElement;
  mockTrackWidth(el, 200);
  track.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 5,
      clientX: 150,
    })
  );
  expect(el.valueAsNumber).to.equal(20);
});

it('mirrors the drag ratio under dir="rtl", since the track is positioned with inset-inline-start', async () => {
  const el = (await fixture(
    html`<lr-slider
      dir="rtl"
      min="0"
      max="100"
      value="20"
      step="1"
    ></lr-slider>`
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.setPointerCapture = () => {};
  mockTrackWidth(el, 200);

  let inputDetail: { value: number } | undefined;
  el.addEventListener(
    "lr-input",
    (e) => (inputDetail = (e as CustomEvent).detail)
  );
  thumb.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 1,
      clientX: 40,
    })
  );
  // Pointer at physical x=40 on a 200px track under RTL: raw=0.2, mirrored
  // to ratio 0.8 -> value 80 on a [0,100] domain.
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 1, clientX: 40 })
  );
  expect(inputDetail!.value).to.equal(80);
});

it("keeps live values but suppresses lr-change and tears down on pointercancel/lostpointercapture", async () => {
  for (const [index, endType] of (
    ["pointercancel", "lostpointercapture"] as const
  ).entries()) {
    const el = (await fixture(
      html`<lr-slider min="0" max="100" value="20" step="1"></lr-slider>`
    )) as LyraSlider;
    const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
    thumb.setPointerCapture = () => {};
    mockTrackWidth(el, 200);
    let inputs = 0;
    let changes = 0;
    el.addEventListener("lr-input", () => inputs++);
    el.addEventListener("lr-change", () => changes++);
    const pointerId = 50 + index;

    thumb.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, pointerId, clientX: 40 })
    );
    window.dispatchEvent(
      new PointerEvent("pointermove", { pointerId, clientX: 100 })
    );
    expect(el.valueAsNumber, endType).to.equal(50);
    expect(inputs, endType).to.equal(1);

    window.dispatchEvent(new PointerEvent(endType, { pointerId }));
    expect(changes, endType).to.equal(0);
    window.dispatchEvent(
      new PointerEvent("pointermove", { pointerId, clientX: 180 })
    );
    expect(inputs, endType).to.equal(1);
    expect(el.valueAsNumber, endType).to.equal(50);
  }
});

it("removes the window pointermove/pointerup listeners on disconnect so a detached drag cannot leak", async () => {
  const el = (await fixture(
    html`<lr-slider value="20" step="1"></lr-slider>`
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.setPointerCapture = () => {};

  thumb.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 1,
      clientX: 40,
    })
  );
  const before = el.valueAsNumber;
  el.remove();

  let inputFired = false;
  el.addEventListener("lr-input", () => (inputFired = true));
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 1, clientX: 180 })
  );
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
  expect(inputFired).to.be.false;
  expect(el.valueAsNumber).to.equal(before);
});

it("tolerates releasePointerCapture throwing while aborting a drag on disconnect", async () => {
  // A real UA can already have released capture on its own (element removed,
  // gesture interrupted) by the time abortActiveDrags() gets to call
  // releasePointerCapture() itself -- that call is documented (see the
  // catch's own comment in the source) as allowed to throw, and must not
  // prevent the rest of teardown from completing.
  const el = (await fixture(
    html`<lr-slider value="20" step="1"></lr-slider>`
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.setPointerCapture = () => {};
  thumb.hasPointerCapture = () => true;
  thumb.releasePointerCapture = () => {
    throw new DOMException("already released", "InvalidStateError");
  };

  thumb.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 1,
      clientX: 40,
    })
  );
  expect(() => el.remove()).to.not.throw();

  // Teardown still completed: a stray pointermove for the aborted gesture's
  // id no longer moves the (now-detached) value.
  const before = el.valueAsNumber;
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 1, clientX: 180 })
  );
  expect(el.valueAsNumber).to.equal(before);
});

it("stops an in-progress drag without mutating value once disabled mid-drag", async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="100" value="20" step="1"></lr-slider>`
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.setPointerCapture = () => {};
  mockTrackWidth(el, 200);

  thumb.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 1,
      clientX: 40,
    })
  );
  el.disabled = true;

  let inputFired = false;
  let changeFired = false;
  el.addEventListener("lr-input", () => (inputFired = true));
  el.addEventListener("lr-change", () => (changeFired = true));
  const before = el.valueAsNumber;
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 1, clientX: 100 })
  );
  expect(inputFired).to.be.false;
  expect(el.valueAsNumber).to.equal(before);

  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
  expect(changeFired).to.be.false;
});

it("ignores click and keydown activation while disabled, and is not focusable", async () => {
  const el = (await fixture(
    html`<lr-slider value="20" disabled></lr-slider>`
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  expect(thumb.getAttribute("tabindex")).to.equal("-1");
  expect(thumb.getAttribute("aria-disabled")).to.equal("true");

  let fired = false;
  el.addEventListener("lr-input", () => (fired = true));
  thumb.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  expect(fired).to.be.false;
  expect(el.valueAsNumber).to.equal(20);
});

it("forwards host focus()/blur() to the internal thumb control", async () => {
  const el = (await fixture(html`<lr-slider></lr-slider>`)) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  el.focus();
  expect(el.shadowRoot!.activeElement === thumb).to.be.true;
  el.blur();
  expect(el.shadowRoot!.activeElement === null).to.equal(true);
});

it("keeps public focus, blur, click, and step methods safe before first connection", async () => {
  const el = document.createElement("lr-slider") as LyraSlider;
  expect(() => {
    el.focus();
    el.blur();
    el.click();
    el.stepUp();
    el.stepDown();
  }).to.not.throw();
  expect(el.shadowRoot === null).to.equal(true);
});

it("blurs the active range thumb and relays exactly one native pair, never lr-focus/lr-blur", async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div><lr-slider range min-value="20" max-value="80"></lr-slider></div>
  `);
  const el = wrapper.querySelector("lr-slider") as LyraSlider;
  const maxThumb = el.shadowRoot!.querySelector(
    '[part~="thumb-max"]'
  ) as HTMLElement;
  const nativeEvents: FocusEvent[] = [];
  const aliases: string[] = [];
  wrapper.addEventListener("focus", (event) =>
    nativeEvents.push(event as FocusEvent)
  );
  wrapper.addEventListener("blur", (event) =>
    nativeEvents.push(event as FocusEvent)
  );
  wrapper.addEventListener("lr-focus", () => aliases.push("lr-focus"));
  wrapper.addEventListener("lr-blur", () => aliases.push("lr-blur"));

  maxThumb.focus();
  expect(el.shadowRoot!.activeElement === maxThumb).to.be.true;
  el.blur();

  expect(el.shadowRoot!.activeElement === null).to.equal(true);
  assertNativeFocusBlurPair(el, nativeEvents, aliases);
});

it("forwards host click() to the internal thumb control", async () => {
  const el = (await fixture(html`<lr-slider></lr-slider>`)) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  let clicked = false;
  thumb.addEventListener("click", () => (clicked = true));
  el.click();
  expect(clicked).to.be.true;
});

it("re-clamps value into a narrower domain when min/max change after mount", async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="100" value="80"></lr-slider>`
  )) as LyraSlider;
  el.max = 50;
  await elementUpdated(el);
  expect(el.valueAsNumber).to.equal(50);
  expect(el.value).to.equal(50);
});

it("rounds a non-integer step to its own decimal precision instead of accumulating float drift", async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="1" value="0.2" step="0.1"></lr-slider>`
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  expect(el.valueAsNumber).to.equal(0.3);
  thumb.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  expect(el.valueAsNumber).to.equal(0.4);
});

it("does not poison value with NaN when step is 0", async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="100" value="20" step="0"></lr-slider>`
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  expect(Number.isNaN(el.valueAsNumber)).to.be.false;
  expect(el.valueAsNumber).to.equal(21);
});

it("restores the mapped step default when the step attribute is removed", async () => {
  const el = (await fixture(
    html`<lr-slider step="0.25"></lr-slider>`
  )) as LyraSlider;
  expect(el.step).to.equal(0.25);
  el.removeAttribute("step");
  await elementUpdated(el);
  expect(el.step).to.equal(1);
});

it('does not poison the submitted value with the literal string "NaN" when valueAsNumber is written NaN', async () => {
  const form = (await fixture(html`
    <form>
      <lr-slider name="temperature" min="0" max="100" value="20"></lr-slider>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-slider") as LyraSlider;
  el.valueAsNumber = NaN;
  await elementUpdated(el);
  // Before the fix, clampValue(NaN) propagated NaN straight through
  // Math.max/Math.min, so `value` became the literal string "NaN" and stayed
  // that way, including in FormData.
  expect(el.value).to.not.equal("NaN");
  expect(Number.isFinite(el.valueAsNumber)).to.be.true;
  expect(new FormData(form).get("temperature")).to.not.equal("NaN");
});

it("resyncs a post-mount non-numeric value string instead of submitting it as-is", async () => {
  const form = (await fixture(html`
    <form><lr-slider name="temperature" min="0" max="100"></lr-slider></form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-slider") as LyraSlider;
  el.value = "not-a-number";
  await elementUpdated(el);
  // Invalid compatibility string writes must not leak into the numeric IDL or submitted value.
  expect(el.value).to.not.equal("not-a-number");
  expect(Number.isFinite(Number(el.value))).to.be.true;
  expect(new FormData(form).get("temperature")).to.not.equal("not-a-number");
});

it('uses one snap-then-final-clamp path for assignments, keyboard events, and later bounds', async () => {
  const form = (await fixture(html`
    <form>
      <lr-slider name="temperature" min="0" max="1" step="0.7" value="0"></lr-slider>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-slider') as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;

  el.valueAsNumber = 1.1;
  await elementUpdated(el);
  expect(el.valueAsNumber).to.equal(1);
  expect(new FormData(form).get('temperature')).to.equal('1');

  el.valueAsNumber = 0.7;
  await elementUpdated(el);
  const input = oneEvent(el, 'lr-input');
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect((await input as CustomEvent<{ value: number }>).detail.value).to.equal(1);
  expect(el.valueAsNumber).to.equal(1);

  const change = oneEvent(el, 'lr-change');
  thumb.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }));
  expect((await change as CustomEvent<{ value: number }>).detail.value).to.equal(1);

  el.max = 1.2;
  await elementUpdated(el);
  el.valueAsNumber = 1.1;
  await elementUpdated(el);
  expect(el.valueAsNumber).to.equal(1.2);
  el.max = 1;
  await elementUpdated(el);
  expect(el.valueAsNumber).to.equal(1);
});

it('preserves the fractional low-end anchor through direct and keyboard slider updates', async () => {
  const form = (await fixture(html`
    <form>
      <lr-slider name="temperature" .min=${0.5} .max=${10} .step=${1} .valueAsNumber=${1.5}></lr-slider>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-slider') as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;

  expect(el.valueAsNumber).to.equal(1.5);
  expect(new FormData(form).get('temperature')).to.equal('1.5');
  expect(thumb.getAttribute('aria-valuenow')).to.equal('1.5');

  const input = oneEvent(el, 'lr-input');
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect((await input as CustomEvent<{ value: number }>).detail.value).to.equal(2.5);
  expect(el.valueAsNumber).to.equal(2.5);
  expect(new FormData(form).get('temperature')).to.equal('2.5');

  el.min = 0.07;
  el.max = 1;
  el.step = 0.1;
  el.valueAsNumber = 0.17;
  await elementUpdated(el);
  expect(el.valueAsNumber).to.equal(0.17);
  expect(thumb.getAttribute('aria-valuenow')).to.equal('0.17');
});

it("rounds exponential step values without collapsing them to zero", async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="1" value="0" step="1e-7"></lr-slider>`
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  expect(el.valueAsNumber).to.equal(0.0000001);
  expect(el.value).to.equal(1e-7);
});

it("retains a huge finite value when a tiny step grid cannot be represented", async () => {
  // A 5e-15 grid cannot be represented reliably across this 1e300 domain.
  // The finite value must remain usable rather than becoming Infinity or NaN.
  const form = (await fixture(html`
    <form>
      <lr-slider name="huge" min="0" max="1e300" step="5e-15"></lr-slider>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-slider") as LyraSlider;
  el.valueAsNumber = 5e293;
  await elementUpdated(el);
  expect(Number.isFinite(el.valueAsNumber)).to.be.true;
  expect(el.valueAsNumber).to.be.closeTo(5e293, 1e280);
  const submitted = new FormData(form).get("huge") as string;
  expect(submitted).to.not.equal("Infinity");
  expect(submitted).to.not.equal("NaN");
  expect(Number.isFinite(Number(submitted))).to.be.true;
});

it("marks a blocked native submission attempt as interaction, but never a bare checkValidity() call", async function () {
  let supported = false;
  try {
    supported =
      typeof CustomStateSet === "function" &&
      document.createElement("div").matches(":state(x)") === false;
  } catch {
    supported = false;
  }
  if (!supported) this.skip();

  const form = (await fixture(html`
    <form><lr-slider name="gain"></lr-slider></form>
  `)) as HTMLFormElement;
  // Defensive only: a truly invalid slider never reaches the `submit` event at all -- the
  // platform's interactive validation aborts submission before it is dispatched.
  form.addEventListener("submit", (event) => event.preventDefault());
  const el = form.querySelector("lr-slider") as LyraSlider;
  await elementUpdated(el);
  // A slider always has a numeric value, so `required` alone never makes it invalid --
  // `setCustomValidity()` is the one channel that does, exactly like the reset test above.
  el.setCustomValidity("Rejected by server.");
  await elementUpdated(el);

  expect(el.checkValidity(), "checkValidity() itself").to.be.false;
  expect(
    el.matches(":state(user-invalid)"),
    "a silent checkValidity() must not mark interaction, however invalid the slider already is"
  ).to.be.false;

  form.requestSubmit();
  await elementUpdated(el);
  expect(
    el.matches(":state(user-invalid)"),
    "a blocked submission attempt counts as interaction, even though it never calls reportValidity()"
  ).to.be.true;
});

it("widens the thumb hit/drag area past the visible dot via a transparent ::before", async () => {
  const el = (await fixture(
    html`<lr-slider value="20"></lr-slider>`
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  expect(parseFloat(getComputedStyle(thumb).width)).to.be.closeTo(14.4, 0.1);
  const before = getComputedStyle(thumb, "::before");
  expect(before.content).to.not.equal("none");
  expect(before.width).to.equal("28px");
  expect(before.height).to.equal("28px");
});

it("keeps every range handle above the 24px WCAG 2.5.8 target floor, in both orientations", async () => {
  for (const orientation of ["horizontal", "vertical"] as const) {
    const el = (await fixture(html`
      <lr-slider
        range
        orientation=${orientation}
        min-value="20"
        max-value="80"
      ></lr-slider>
    `)) as LyraSlider;
    expect(handles(el).length, orientation).to.equal(2);
    for (const handle of handles(el)) {
      const hitArea = getComputedStyle(handle, "::before");
      expect(Number.parseFloat(hitArea.width), orientation).to.be.at.least(24);
      expect(Number.parseFloat(hitArea.height), orientation).to.be.at.least(24);
    }
  }
});

it("references the shared focus-ring tokens on the thumb focus-visible outline", () => {
  expect(styles.cssText).to.include(
    "outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color)"
  );
  expect(styles.cssText).to.include(
    "outline-offset: var(--lr-focus-ring-offset)"
  );
});

it("keeps the full domain reachable because a crossing handle pushes its sibling", async () => {
  const el = (await fixture(html`
    <lr-slider
      range
      min="0"
      max="100"
      min-value="20"
      max-value="80"
    ></lr-slider>
  `)) as LyraSlider;
  const minThumb = el.shadowRoot!.querySelector(
    '[part~="thumb-min"]'
  ) as HTMLElement;
  const maxThumb = el.shadowRoot!.querySelector(
    '[part~="thumb-max"]'
  ) as HTMLElement;

  expect(minThumb.getAttribute("aria-valuenow")).to.equal("20");
  expect(minThumb.getAttribute("aria-valuemin")).to.equal("0");
  expect(minThumb.getAttribute("aria-valuemax")).to.equal("100");
  expect(maxThumb.getAttribute("aria-valuenow")).to.equal("80");
  expect(maxThumb.getAttribute("aria-valuemin")).to.equal("0");
  expect(maxThumb.getAttribute("aria-valuemax")).to.equal("100");
  expect(minThumb.getAttribute("aria-valuetext")).to.equal("20");
  expect(maxThumb.getAttribute("aria-valuetext")).to.equal("80");
});

it("resolves both range handle names through the strings override", async () => {
  const el = (await fixture(html`
    <lr-slider
      range
      .strings=${{ rangeStart: "Début", rangeEnd: "Fin" }}
    ></lr-slider>
  `)) as LyraSlider;
  expect(
    (
      el.shadowRoot!.querySelector('[part~="thumb-min"]') as HTMLElement
    ).getAttribute("aria-label")
  ).to.equal("Début");
  expect(
    (
      el.shadowRoot!.querySelector('[part~="thumb-max"]') as HTMLElement
    ).getAttribute("aria-label")
  ).to.equal("Fin");
});

it("clamps the fixed 0/50 range defaults into a narrower domain", async () => {
  const el = (await fixture(
    html`<lr-slider range min="10" max="30"></lr-slider>`
  )) as LyraSlider;
  expect(el.minValue).to.equal(10);
  expect(el.maxValue).to.equal(30);
});

it("pushes the sibling when keyboard movement crosses it", async () => {
  const el = (await fixture(html`
    <lr-slider
      range
      min="0"
      max="100"
      step="10"
      min-value="40"
      max-value="60"
    ></lr-slider>
  `)) as LyraSlider;
  const minThumb = el.shadowRoot!.querySelector(
    '[part~="thumb-min"]'
  ) as HTMLElement;

  minThumb.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  minThumb.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  expect(el.minValue).to.equal(60);
  // Crossing pushes the upper handle so the active thumb remains under the user's key gesture.
  minThumb.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  expect(el.minValue).to.equal(70);
  expect(el.maxValue).to.equal(70);

  await elementUpdated(el);
  const indicator = el.shadowRoot!.querySelector(
    '[part="indicator"]'
  ) as HTMLElement;
  expect(indicator.style.inlineSize).to.equal("0%");

  // Both handles can still travel away from the meeting point.
  minThumb.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })
  );
  expect(el.minValue).to.equal(60);
  expect(el.maxValue).to.equal(70);
});

it("pulls the sibling handle along instead of crossing when a value is assigned past it", async () => {
  const el = (await fixture(html`
    <lr-slider
      range
      min="0"
      max="100"
      min-value="20"
      max-value="80"
    ></lr-slider>
  `)) as LyraSlider;
  el.minValue = 95;
  expect(el.minValue).to.equal(95);
  expect(el.maxValue).to.equal(95);

  el.maxValue = 10;
  expect(el.minValue).to.equal(10);
  expect(el.maxValue).to.equal(10);
});

it("steps each range handle independently with Arrow/Page/Home/End keys", async () => {
  const el = (await fixture(html`
    <lr-slider
      range
      min="0"
      max="100"
      step="2"
      min-value="20"
      max-value="80"
    ></lr-slider>
  `)) as LyraSlider;
  const minThumb = el.shadowRoot!.querySelector(
    '[part~="thumb-min"]'
  ) as HTMLElement;
  const maxThumb = el.shadowRoot!.querySelector(
    '[part~="thumb-max"]'
  ) as HTMLElement;

  minThumb.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  expect(el.minValue).to.equal(22);
  expect(el.maxValue).to.equal(80);

  maxThumb.dispatchEvent(
    new KeyboardEvent("keydown", { key: "PageDown", bubbles: true })
  );
  expect(el.maxValue).to.equal(60);
  expect(el.minValue).to.equal(22);

  // Home/End use the full domain and push the sibling when they cross it.
  maxThumb.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Home", bubbles: true })
  );
  expect(el.minValue).to.equal(0);
  expect(el.maxValue).to.equal(0);
  maxThumb.dispatchEvent(
    new KeyboardEvent("keydown", { key: "End", bubbles: true })
  );
  expect(el.maxValue).to.equal(100);
  minThumb.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Home", bubbles: true })
  );
  expect(el.minValue).to.equal(0);
});

it("emits lr-input/lr-change carrying both handle values and which handle moved", async () => {
  const el = (await fixture(html`
    <lr-slider
      range
      min="0"
      max="100"
      step="5"
      min-value="20"
      max-value="80"
    ></lr-slider>
  `)) as LyraSlider;
  const maxThumb = el.shadowRoot!.querySelector(
    '[part~="thumb-max"]'
  ) as HTMLElement;

  let inputDetail:
    | { value: number; minValue: number; maxValue: number; handle: string }
    | undefined;
  el.addEventListener(
    "lr-input",
    (e) => (inputDetail = (e as CustomEvent).detail)
  );
  let changeDetail: typeof inputDetail;
  el.addEventListener(
    "lr-change",
    (e) => (changeDetail = (e as CustomEvent).detail)
  );

  maxThumb.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })
  );
  expect(inputDetail!.handle).to.equal("max");
  expect(inputDetail!.value).to.equal(75);
  expect(inputDetail!.minValue).to.equal(20);
  expect(inputDetail!.maxValue).to.equal(75);

  maxThumb.dispatchEvent(
    new KeyboardEvent("keyup", { key: "ArrowLeft", bubbles: true })
  );
  expect(changeDetail!.handle).to.equal("max");
  expect(changeDetail!.maxValue).to.equal(75);
});

it('emits handle "value" details in single-handle mode', async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="100" value="20"></lr-slider>`
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  let detail: { value: number; handle: string } | undefined;
  el.addEventListener("lr-input", (e) => (detail = (e as CustomEvent).detail));
  thumb.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  expect(detail!.handle).to.equal("value");
  expect(detail!.value).to.equal(21);
});

it("drags the nearer handle when the track itself is clicked in range mode", async () => {
  const el = (await fixture(html`
    <lr-slider
      range
      min="0"
      max="100"
      step="1"
      min-value="20"
      max-value="80"
    ></lr-slider>
  `)) as LyraSlider;
  const track = el.shadowRoot!.querySelector('[part="track"]') as HTMLElement;
  stubPointerCapture(el);
  mockTrackWidth(el, 200);

  // x=60 of 200 -> 30%, nearer the min handle (20) than the max handle (80).
  track.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 11,
      clientX: 60,
    })
  );
  expect(el.minValue).to.equal(30);
  expect(el.maxValue).to.equal(80);
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 11, clientX: 20 })
  );
  expect(el.minValue).to.equal(10);
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 11 }));

  // x=180 of 200 -> 90%, nearer the max handle.
  track.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 12,
      clientX: 180,
    })
  );
  expect(el.maxValue).to.equal(90);
  expect(el.minValue).to.equal(10);
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 12 }));
});

it("keeps a range drag on its own handle and tears down cleanly on pointercancel", async () => {
  const el = (await fixture(html`
    <lr-slider
      range
      min="0"
      max="100"
      step="1"
      min-value="20"
      max-value="80"
    ></lr-slider>
  `)) as LyraSlider;
  const minThumb = el.shadowRoot!.querySelector(
    '[part~="thumb-min"]'
  ) as HTMLElement;
  stubPointerCapture(el);
  mockTrackWidth(el, 200);
  let changes = 0;
  el.addEventListener("lr-change", () => changes++);

  minThumb.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 13,
      clientX: 40,
    })
  );
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 13, clientX: 60 })
  );
  expect(el.minValue).to.equal(30);
  expect(el.maxValue).to.equal(80);

  window.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 13 }));
  expect(changes).to.equal(0);
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 13, clientX: 120 })
  );
  expect(el.minValue).to.equal(30);
});

it('mirrors range arrow keys under dir="rtl"', async () => {
  const el = (await fixture(html`
    <lr-slider
      dir="rtl"
      range
      min="0"
      max="100"
      min-value="20"
      max-value="80"
    ></lr-slider>
  `)) as LyraSlider;
  const minThumb = el.shadowRoot!.querySelector(
    '[part~="thumb-min"]'
  ) as HTMLElement;
  minThumb.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  expect(el.minValue).to.equal(19);
  minThumb.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })
  );
  expect(el.minValue).to.equal(20);
});

it("passes the handle identity to valueFormatter in range mode", async () => {
  const el = (await fixture(html`
    <lr-slider
      range
      min="0"
      max="100"
      min-value="20"
      max-value="80"
      .valueFormatter=${(value: number, handle: string) => `${handle}:${value}`}
    ></lr-slider>
  `)) as LyraSlider;
  expect(
    (
      el.shadowRoot!.querySelector('[part~="thumb-min"]') as HTMLElement
    ).getAttribute("aria-valuetext")
  ).to.equal("min:20");
  expect(
    (
      el.shadowRoot!.querySelector('[part~="thumb-max"]') as HTMLElement
    ).getAttribute("aria-valuetext")
  ).to.equal("max:80");
});

// ---------------------------------------------------------------------------
it("submits two same-name entries in range mode and rejoins as a scalar when range is off", async () => {
  const form = (await fixture(html`
    <form><lr-slider name="temperature" value="70"></lr-slider></form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-slider") as LyraSlider;
  expect(new FormData(form).get("temperature")).to.equal("70");

  el.range = true;
  expect(new FormData(form).getAll("temperature")).to.deep.equal(["0", "50"]);

  el.range = false;
  expect(new FormData(form).get("temperature")).to.equal("70");
});

it("positions a vertical slider along the block axis with the domain floor at the bottom", async () => {
  const el = (await fixture(html`
    <lr-slider orientation="vertical" min="0" max="100" value="25"></lr-slider>
  `)) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  const indicator = el.shadowRoot!.querySelector(
    '[part="indicator"]'
  ) as HTMLElement;
  expect(thumb.style.insetBlockEnd).to.equal("25%");
  expect(thumb.style.insetInlineStart).to.equal("");
  expect(indicator.style.blockSize).to.equal("25%");
  expect(indicator.style.insetBlockEnd).to.equal("0%");
});

it("maps a vertical drag to the block axis, upward being an increasing value", async () => {
  const el = (await fixture(html`
    <lr-slider
      orientation="vertical"
      min="0"
      max="100"
      step="1"
      value="20"
    ></lr-slider>
  `)) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  stubPointerCapture(el);
  mockTrackHeight(el, 200);

  let inputDetail: { value: number } | undefined;
  el.addEventListener(
    "lr-input",
    (e) => (inputDetail = (e as CustomEvent).detail)
  );
  thumb.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 21,
      clientY: 160,
    })
  );
  // y=50 of a 200px-tall track -> 25% down from the top -> 75% of the domain.
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 21, clientY: 50 })
  );
  expect(inputDetail!.value).to.equal(75);
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 21 }));
});

it('does not mirror the vertical drag axis under dir="rtl"', async () => {
  const el = (await fixture(html`
    <lr-slider
      dir="rtl"
      orientation="vertical"
      min="0"
      max="100"
      step="1"
      value="20"
    ></lr-slider>
  `)) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  stubPointerCapture(el);
  mockTrackHeight(el, 200);
  thumb.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 22,
      clientY: 160,
    })
  );
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 22, clientY: 50 })
  );
  expect(el.valueAsNumber).to.equal(75);
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 22 }));
});

it("keeps ArrowUp/ArrowDown as the primary vertical keys", async () => {
  const el = (await fixture(html`
    <lr-slider
      orientation="vertical"
      min="0"
      max="100"
      step="5"
      value="20"
    ></lr-slider>
  `)) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })
  );
  expect(el.valueAsNumber).to.equal(25);
  thumb.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
  );
  expect(el.valueAsNumber).to.equal(20);
});

it("lays a vertical slider out along the block axis", async () => {
  const el = (await fixture(html`
    <lr-slider
      orientation="vertical"
      style="--lr-slider-track-length: 120px;"
    ></lr-slider>
  `)) as LyraSlider;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.getBoundingClientRect().height).to.equal(120);
  expect(base.getBoundingClientRect().width).to.be.lessThan(120);
});

it("keeps a readonly slider focusable but refuses every value change", async () => {
  const el = (await fixture(html`
    <lr-slider readonly min="0" max="100" step="5" value="20"></lr-slider>
  `)) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  const track = el.shadowRoot!.querySelector('[part="track"]') as HTMLElement;
  stubPointerCapture(el);
  mockTrackWidth(el, 200);
  let events = 0;
  el.addEventListener("lr-input", () => events++);
  el.addEventListener("lr-change", () => events++);

  // Unlike `disabled`, a readonly slider is still reachable and announced.
  expect(thumb.getAttribute("tabindex")).to.equal("0");
  expect(thumb.getAttribute("aria-disabled")).to.equal("false");

  thumb.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  thumb.dispatchEvent(
    new KeyboardEvent("keyup", { key: "ArrowRight", bubbles: true })
  );
  track.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 31,
      clientX: 150,
    })
  );
  thumb.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 32,
      clientX: 40,
    })
  );
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 32, clientX: 100 })
  );
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 32 }));

  expect(el.valueAsNumber).to.equal(20);
  expect(events).to.equal(0);
});

it("refuses range handle changes while readonly", async () => {
  const el = (await fixture(html`
    <lr-slider
      readonly
      range
      min="0"
      max="100"
      min-value="20"
      max-value="80"
    ></lr-slider>
  `)) as LyraSlider;
  const minThumb = el.shadowRoot!.querySelector(
    '[part~="thumb-min"]'
  ) as HTMLElement;
  minThumb.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  expect(el.minValue).to.equal(20);
});

it("positions markers at reachable values for a non-divisible domain", async () => {
  const el = (await fixture(html`
    <lr-slider with-markers min="0" max="10" step="3"></lr-slider>
  `)) as LyraSlider;
  const positions = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="marker"]'),
  ].map((marker) => marker.style.insetInlineStart);
  expect(positions).to.deep.equal(["0%", "30%", "60%", "90%"]);
});

it("positions markers along the block axis in a vertical slider", async () => {
  const el = (await fixture(html`
    <lr-slider
      with-markers
      orientation="vertical"
      min="0"
      max="100"
      step="50"
    ></lr-slider>
  `)) as LyraSlider;
  const markers = el.shadowRoot!.querySelectorAll('[part="marker"]');
  expect(markers.length).to.equal(3);
  expect((markers[1] as HTMLElement).style.insetBlockEnd).to.equal("50%");
});

it("omits markers entirely for an unstepped or impossibly dense step grid", async () => {
  const unstepped = (await fixture(html`
    <lr-slider with-markers min="0" max="100" step="0"></lr-slider>
  `)) as LyraSlider;
  expect(
    unstepped.shadowRoot!.querySelectorAll('[part="marker"]').length
  ).to.equal(0);
  expect(
    unstepped.shadowRoot!.querySelectorAll('[part="markers"]').length
  ).to.equal(0);

  // A 1e-7 step over [0, 1] is ten million ticks -- rendering them would hang
  // the page, so the grid is dropped rather than drawn.
  const dense = (await fixture(html`
    <lr-slider with-markers min="0" max="1" step="1e-7"></lr-slider>
  `)) as LyraSlider;
  expect(dense.shadowRoot!.querySelectorAll('[part="marker"]').length).to.equal(
    0
  );
});

it("hides error chrome and removes its description when errorText is cleared", async () => {
  const el = (await fixture(
    html`<lr-slider error-text="Resolve this value"></lr-slider>`
  )) as LyraSlider;
  const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  expect(error.hasAttribute("hidden")).to.equal(false);
  expect(handles(el)[0]!.getAttribute("aria-describedby")).to.equal(
    "slider-error"
  );

  el.errorText = "";
  await elementUpdated(el);
  expect(error.hasAttribute("hidden")).to.equal(true);
  expect(handles(el)[0]!.hasAttribute("aria-describedby")).to.equal(false);
});

// ---------------------------------------------------------------------------
it("leaves the single-handle contract unchanged when none of the new properties are set", async () => {
  const el = (await fixture(
    html`<lr-slider value="42"></lr-slider>`
  )) as LyraSlider;
  expect(el.range).to.be.false;
  expect(el.readonly).to.be.false;
  expect(el.withMarkers).to.be.false;
  expect(el.withTooltip).to.be.false;
  expect(el.tooltip).to.equal("none");
  expect(el.withValue).to.be.false;
  expect(el.orientation).to.equal("horizontal");
  expect(el.hint).to.equal("");

  expect(handles(el).length).to.equal(1);
  expect(el.shadowRoot!.querySelectorAll('[part="thumb"]').length).to.equal(1);
  expect(el.shadowRoot!.querySelectorAll('[part="markers"]').length).to.equal(
    0
  );
  expect(el.shadowRoot!.querySelectorAll('[part~="tooltip"]').length).to.equal(
    0
  );
  expect(
    (
      el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement
    ).hasAttribute("role")
  ).to.be.false;
  expect(el.shadowRoot!.querySelector('[part="value"]') === null).to.equal(
    true
  );
});

it("keeps a range slider finite when min > max, step is 0, and the handles start outside the domain", async () => {
  const el = (await fixture(html`
    <lr-slider
      range
      min="100"
      max="0"
      step="0"
      min-value="-500"
      max-value="500"
    ></lr-slider>
  `)) as LyraSlider;
  expect(el.minValue).to.equal(0);
  expect(el.maxValue).to.equal(100);
  for (const handle of handles(el)) {
    expect(handle.style.insetInlineStart).to.match(/^-?\d+(\.\d+)?%$/);
    expect(Number.isFinite(Number(handle.getAttribute("aria-valuenow")))).to.be
      .true;
  }
  const indicator = el.shadowRoot!.querySelector(
    '[part="indicator"]'
  ) as HTMLElement;
  expect(indicator.style.inlineSize).to.equal("100%");
});

it("re-clamps both range handles into a narrowed domain", async () => {
  const el = (await fixture(html`
    <lr-slider
      range
      min="0"
      max="100"
      min-value="20"
      max-value="80"
    ></lr-slider>
  `)) as LyraSlider;
  el.max = 50;
  await elementUpdated(el);
  expect(el.minValue).to.equal(20);
  expect(el.maxValue).to.equal(50);
});

it("mirrors range mode through the upstream isRange alias", async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="100" value="30"></lr-slider>`
  )) as LyraSlider;
  expect(el.isRange).to.equal(false);
  el.range = true;
  await elementUpdated(el);
  expect(el.isRange).to.equal(true);
});

it("restores range state supplied by its adopted iframe realm", async () => {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const frameWindow = frame.contentWindow!;
  const el = (await fixture(html`
    <lr-slider
      name="window"
      range
      min="0"
      max="100"
      min-value="10"
      max-value="90"
    ></lr-slider>
  `)) as LyraSlider;

  try {
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;
    const state = new frameWindow.FormData();
    state.append("window", "25");
    state.append("window", "75");
    el.formStateRestoreCallback(state, "restore");
    await elementUpdated(el);

    expect(el.minValue).to.equal(25);
    expect(el.maxValue).to.equal(75);
  } finally {
    el.remove();
    frame.remove();
  }
});

it("treats a null defaultValue or name as unset", async () => {
  const el = (await fixture(
    html`<lr-slider name="level" value="30"></lr-slider>`
  )) as LyraSlider;
  expect(el.defaultValue).to.equal(30);

  el.defaultValue = null;
  expect(
    el.hasAttribute("value"),
    "a null default drops the declarative value attribute"
  ).to.equal(false);
  await elementUpdated(el);
  expect(el.defaultValue).to.equal(0);

  el.defaultValue = "15";
  await elementUpdated(el);
  expect(el.defaultValue).to.equal(15);
  expect(el.getAttribute("value")).to.equal("15");

  el.name = null;
  await elementUpdated(el);
  expect(el.name).to.equal(null);
  expect(el.hasAttribute("name")).to.equal(false);

  el.name = "";
  await elementUpdated(el);
  expect(el.name).to.equal(null);
});

it("steps silently through the native stepUp/stepDown IDL", async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="100" step="5" value="50"></lr-slider>`
  )) as LyraSlider;
  let events = 0;
  el.addEventListener("lr-input", () => {
    events += 1;
  });
  el.addEventListener("lr-change", () => {
    events += 1;
  });

  el.stepUp();
  await elementUpdated(el);
  expect(el.value).to.equal(55);

  el.stepDown(3);
  await elementUpdated(el);
  expect(el.value).to.equal(40);

  el.stepUp(0);
  await elementUpdated(el);
  expect(el.value).to.equal(40);

  el.stepUp(Number.NaN);
  await elementUpdated(el);
  expect(el.value).to.equal(45);

  expect(events, "the native IDL steps are event-silent").to.equal(0);

  const disabled = (await fixture(
    html`<lr-slider disabled min="0" max="100" step="5" value="50"></lr-slider>`
  )) as LyraSlider;
  disabled.stepUp();
  await elementUpdated(disabled);
  expect(disabled.value).to.equal(50);

  const unstepped = (await fixture(
    html`<lr-slider min="0" max="100" step="0" value="50"></lr-slider>`
  )) as LyraSlider;
  unstepped.stepUp();
  await elementUpdated(unstepped);
  expect(unstepped.value).to.equal(50);
});

it("steps the low handle of a range and blurs whichever thumb has focus", async () => {
  const el = (await fixture(html`
    <lr-slider
      range
      min="0"
      max="100"
      step="10"
      min-value="20"
      max-value="80"
    ></lr-slider>
  `)) as LyraSlider;
  el.stepUp();
  await elementUpdated(el);
  expect(el.minValue).to.equal(30);
  expect(el.maxValue).to.equal(80);

  el.focus();
  await elementUpdated(el);
  expect(el.shadowRoot!.activeElement != null).to.equal(true);
  el.blur();
  await elementUpdated(el);
  expect(el.shadowRoot!.activeElement === null).to.equal(true);

  // Blurring again with nothing focused falls back to the first thumb and stays a no-op.
  el.blur();
  expect(el.shadowRoot!.activeElement === null).to.equal(true);
});

it("does not turn disabled focusout into user interaction after re-enabling", async function () {
  let supported = false;
  try {
    supported =
      typeof CustomStateSet === "function" &&
      document.createElement("div").matches(":state(x)") === false;
  } catch {
    supported = false;
  }
  if (!supported) this.skip();

  const el = (await fixture(
    html`<lr-slider required aria-label="Volume"></lr-slider>`
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;

  el.disabled = true;
  thumb.dispatchEvent(
    new FocusEvent("focusout", { bubbles: true, composed: true })
  );
  el.disabled = false;
  await elementUpdated(el);

  expect(
    el.matches(":state(user-valid)"),
    "a disable-forced focusout leaves the control pristine"
  ).to.be.false;
});

it("saturates when a finite step overflows only after it is added to the current value", async () => {
  const el = await fixture<LyraSlider>(html` <lr-slider></lr-slider> `);
  el.min = -Number.MAX_VALUE;
  el.max = Number.MAX_VALUE;
  el.step = Number.MAX_VALUE;

  el.valueAsNumber = Number.MAX_VALUE;
  el.stepUp();
  expect(el.valueAsNumber).to.equal(Number.MAX_VALUE);

  el.valueAsNumber = -Number.MAX_VALUE;
  el.stepDown();
  expect(el.valueAsNumber).to.equal(-Number.MAX_VALUE);
});

it('formats both live range values while committing only on key release', async () => {
  const el = await fixture<LyraSlider>(html`<lr-slider range label="Hours" min-value="2" max-value="8"
    with-value value-display="formatted" value-placement="label"
    .valueFormatter=${(value: number, handle: string) => `${handle}:${value} h`}></lr-slider>`);
  const events: string[] = [];
  el.addEventListener('lr-input', () => events.push('input'));
  el.addEventListener('lr-change', () => events.push('change'));
  const thumb = el.shadowRoot!.querySelector<HTMLElement>('[part~="thumb-min"]')!;
  thumb.focus();
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await el.updateComplete;
  expect(events).to.deep.equal(['input']);
  expect(el.shadowRoot!.querySelector('[part="value"]')!.textContent).to.equal('min:3 h–max:8 h');
  expect(thumb.getAttribute('aria-valuetext')).to.equal('min:3 h');
  thumb.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }));
  expect(events).to.deep.equal(['input', 'change']);
  el.valueDisplay = 'numeric';
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="value"]')!.textContent).to.equal('3–8');
});

it('preserves an authored fraction when value is bound before its domain and step', async () => {
  const el = await fixture<LyraSlider>(html`<lr-slider .value=${0.55} .min=${0} .max=${1} .step=${0.05}
    with-value value-display="formatted" .valueFormatter=${(value: number) => `${Math.round(value * 100)}%`}></lr-slider>`);
  expect(el.value).to.equal(0.55);
  expect(el.shadowRoot!.querySelector('[part~="thumb"]')!.getAttribute('aria-valuenow')).to.equal('0.55');
  expect(el.shadowRoot!.querySelector('[part="value"]')!.textContent).to.equal('55%');
  el.value = 0.5;
  el.min = 0.1;
  el.max = 3;
  el.step = 0.1;
  await el.updateComplete;
  expect(el.value).to.equal(0.5);
});

it('preserves a domain batch snapshot and controlled range endpoints without emitting changes', async () => {
  const el = await fixture<LyraSlider>(html`<lr-slider range .minValue=${0.25} .maxValue=${0.75}
    .min=${0} .max=${1} .step=${0.05}></lr-slider>`);
  expect(el.minValue).to.equal(0.25);
  expect(el.maxValue).to.equal(0.75);
  let changes = 0;
  el.addEventListener('lr-change', () => changes++);
  el.minValue = 12.5;
  el.maxValue = 17.5;
  el.min = 10;
  el.max = 20;
  el.step = 0.5;
  await el.updateComplete;
  expect(el.minValue).to.equal(12.5);
  expect(el.maxValue).to.equal(17.5);
  el.value = 18;
  await el.updateComplete;
  el.max = 5;
  el.min = 0;
  el.max = 20;
  await el.updateComplete;
  expect(el.value).to.equal(18);
  expect(changes).to.equal(0);
});

describe("deprecated show-value alias", () => {
  const usage: readonly DeprecatedUsage[] = [
    { tag: "lr-slider", kind: "property", name: "showValue" },
  ];
  const readout = (el: LyraSlider) =>
    el.shadowRoot!.querySelector<HTMLElement>('[part="value"]');

  it("does not warn for the canonical with-value or an unset alias", async () => {
    const warnings = await captureDeprecationWarnings(usage, async () => {
      await fixture<LyraSlider>(html`<lr-slider value="42" with-value></lr-slider>`);
      await fixture<LyraSlider>(html`<lr-slider value="42"></lr-slider>`);
    });
    expect(warnings).to.have.length(0);
  });

  it("uses only with-value in either attribute order", async () => {
    let shown: LyraSlider | undefined;
    let hidden: LyraSlider | undefined;
    let aliasLast: LyraSlider | undefined;
    await captureDeprecationWarnings(usage, async () => {
      shown = await fixture<LyraSlider>(
        html`<lr-slider value="42" show-value="false" with-value></lr-slider>`
      );
      hidden = await fixture<LyraSlider>(
        html`<lr-slider value="42" show-value with-value="false"></lr-slider>`
      );
      aliasLast = await fixture<LyraSlider>(
        html`<lr-slider value="42" with-value show-value="false"></lr-slider>`
      );
    });
    expect(readout(shown!) !== null).to.equal(true);
    expect(readout(hidden!) === null).to.equal(true);
    expect(aliasLast!.withValue).to.equal(true);
    expect(readout(aliasLast!) !== null).to.equal(true);
  });
});
