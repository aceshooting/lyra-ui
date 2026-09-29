// Focused native form lifecycle cases. Test bodies and titles were moved intact from the prior suite.
import { expectStaleAttribute } from '../../../../test/expected-stale-attributes.js';
import { fixture, expect, html, elementUpdated } from "@open-wc/testing";
import "./slider.js";
import type { LyraSlider } from "./slider.js";
import { expectDeprecatedUsage } from "../../../../test/expected-deprecations.js";
import "../../../translations/ar/forms.js";

expectDeprecatedUsage("lr-slider", "property", "showValue");

expectStaleAttribute('lr-slider', 'show-value');

function handles(el: LyraSlider): HTMLElement[] {
  return Array.from(
    el.shadowRoot!.querySelectorAll('[part~="thumb"]')
  ) as HTMLElement[];
}

it("emits one cancelable lr-invalid alias when a validity check fails", async () => {
  const el = (await fixture(
    html`<lr-slider aria-label="Volume"></lr-slider>`
  )) as LyraSlider;
  const aliases: CustomEvent[] = [];
  el.addEventListener("lr-invalid", (event) =>
    aliases.push(event as CustomEvent)
  );
  // Registered after the component's own constructor-time relay, so it observes the native event
  // once the alias has had its turn at it.
  const natives: Event[] = [];
  el.addEventListener("invalid", (event) => natives.push(event));
  el.setCustomValidity("Choose another value.");

  expect(el.checkValidity()).to.be.false;
  expect(aliases).to.have.lengthOf(1);
  const alias = aliases[0];
  if (!alias) throw new Error("The invalid alias was not emitted.");
  expect(alias.target === el).to.equal(true);
  expect(alias.bubbles && alias.composed).to.be.true;
  expect(alias.cancelable).to.be.true;
  // Nothing cancelled it, so the browser's own validation UI stays enabled.
  expect(natives).to.have.lengthOf(1);
  const native = natives[0];
  if (!native) throw new Error("The native invalid event was not emitted.");
  expect(native.defaultPrevented).to.be.false;
});

it("cancels the native invalid event when the lr-invalid alias is cancelled", async () => {
  const el = (await fixture(
    html`<lr-slider aria-label="Volume"></lr-slider>`
  )) as LyraSlider;
  el.addEventListener("lr-invalid", (event) => event.preventDefault());
  const natives: Event[] = [];
  el.addEventListener("invalid", (event) => natives.push(event));
  el.setCustomValidity("Choose another value.");

  expect(el.checkValidity()).to.be.false;
  expect(natives).to.have.lengthOf(1);
  const native = natives[0];
  if (!native) throw new Error("The native invalid event was not emitted.");
  expect(native.defaultPrevented).to.be.true;
});

describe("mapped numeric and form contract", () => {
  it("exposes numeric value/defaultValue with an explicit string compatibility accessor", async () => {
    const el = (await fixture(html`<lr-slider></lr-slider>`)) as LyraSlider;
    expect(el.value).to.equal(0);
    expect(el.defaultValue).to.equal(0);
    expect(el.valueAsNumber).to.equal(0);
    expect(el.valueAsString).to.equal("0");

    el.step = 0.5;
    el.valueAsString = "23.5";
    await el.updateComplete;
    expect(el.value).to.equal(23.5);
    el.value = 17;
    expect(el.valueAsString).to.equal("17");
  });

  it("defaults a range to 0/50, hides the old readout, and submits two same-name entries", async () => {
    const form = (await fixture(html`
      <form><lr-slider range name="window"></lr-slider></form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-slider") as LyraSlider;
    expect(el.minValue).to.equal(0);
    expect(el.maxValue).to.equal(50);
    expect(el.withValue).to.be.false;
    expect(el.shadowRoot!.querySelectorAll('[part="value"]').length).to.equal(
      0
    );
    expect(new FormData(form).getAll("window")).to.deep.equal(["0", "50"]);
  });

  it("pushes the sibling handle when either handle crosses it", async () => {
    const el = (await fixture(html`
      <lr-slider
        range
        min="0"
        max="100"
        min-value="20"
        max-value="40"
      ></lr-slider>
    `)) as LyraSlider;
    el.minValue = 70;
    expect(el.minValue).to.equal(70);
    expect(el.maxValue).to.equal(70);
    el.maxValue = 10;
    expect(el.minValue).to.equal(10);
    expect(el.maxValue).to.equal(10);
  });

  it("implements silent stepUp/stepDown against the focused handle", async () => {
    const el = (await fixture(html`
      <lr-slider
        range
        min="0"
        max="100"
        step="5"
        min-value="20"
        max-value="60"
      ></lr-slider>
    `)) as LyraSlider;
    const maxThumb = el.shadowRoot!.querySelector(
      '[part~="thumb-max"]'
    ) as HTMLElement;
    maxThumb.focus();
    let events = 0;
    el.addEventListener("input", () => events++);
    el.addEventListener("change", () => events++);
    el.stepUp();
    expect(el.maxValue).to.equal(65);
    el.stepDown(2);
    expect(el.maxValue).to.equal(55);
    expect(events).to.equal(0);
  });

  it("saturates overflowing imperative steps in their requested direction", async () => {
    const el = (await fixture(html`<lr-slider></lr-slider>`)) as LyraSlider;
    el.min = -Number.MAX_VALUE;
    el.max = Number.MAX_VALUE;
    el.step = Number.MAX_VALUE;
    el.valueAsNumber = Number.MAX_VALUE;
    el.stepUp(2);
    expect(el.valueAsNumber).to.equal(Number.MAX_VALUE);

    el.valueAsNumber = -Number.MAX_VALUE;
    el.stepDown(2);
    expect(el.valueAsNumber).to.equal(-Number.MAX_VALUE);
  });

  it("supports external form ownership and exposes the validity surface", async () => {
    const wrapper = await fixture(html`
      <div>
        <form id="remote-slider-form"></form>
        <lr-slider name="gain" value="12"></lr-slider>
      </div>
    `);
    const el = wrapper.querySelector("lr-slider") as LyraSlider;
    el.form = "remote-slider-form";
    expect(el.getForm()?.id).to.equal("remote-slider-form");
    expect(new FormData(wrapper.querySelector("form")!).get("gain")).to.equal(
      "12"
    );
    el.setCustomValidity("Nope");
    expect(el.validity.customError).to.be.true;
    expect(el.validationMessage).to.equal("Nope");
    expect(el.checkValidity()).to.be.false;
    el.resetValidity();
    expect(el.reportValidity()).to.be.true;
  });

  it("exposes the implicit ancestor form through the form getter without an explicit override", async () => {
    const form = (await fixture(html`
      <form id="implicit-slider-form"><lr-slider name="gain"></lr-slider></form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-slider") as LyraSlider;
    expect(el.form?.id).to.equal("implicit-slider-form");
    expect(el.getForm()?.id).to.equal("implicit-slider-form");
  });

  it("publishes a WA-compatible static validators catalog observing the intrinsic constraint attributes", async () => {
    const el = (await fixture(
      html`<lr-slider aria-label="Volume" required></lr-slider>`
    )) as LyraSlider;
    const catalog = (customElements.get("lr-slider") as typeof LyraSlider)
      .validators;
    expect(catalog).to.have.lengthOf(1);
    const validator = catalog[0];
    if (!validator) throw new Error("The slider validator was not registered.");
    expect(validator.observedAttributes).to.deep.equal([
      "required",
      "disabled",
      "value",
      "min",
      "max",
      "step",
    ]);
    // The catalog entry's own checkValidity reads the live element's current
    // ValidityState, matching el.checkValidity()/el.validity exactly.
    expect(validator.checkValidity(el).isValid).to.equal(el.checkValidity());
    el.setCustomValidity("Nope");
    const result = validator.checkValidity(el);
    expect(result.isValid).to.be.false;
    expect(result.invalidKeys).to.deep.equal(["customError"]);
    expect(result.message).to.equal("Nope");
  });
});

it("clears a pending keyboard commit when own or fieldset disablement interrupts the key sequence", async () => {
  const form = (await fixture(html`
    <form>
      <fieldset>
        <lr-slider min="0" max="100" value="20" step="5"></lr-slider>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const fieldset = form.querySelector("fieldset") as HTMLFieldSetElement;
  const el = form.querySelector("lr-slider") as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  let changes = 0;
  el.addEventListener("lr-change", () => changes++);

  thumb.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  expect(el.valueAsNumber).to.equal(25);
  el.disabled = true;
  el.disabled = false;
  await el.updateComplete;
  thumb.dispatchEvent(
    new KeyboardEvent("keyup", { key: "ArrowRight", bubbles: true })
  );
  expect(
    changes,
    "re-enabling must not revive an own-disabled key sequence"
  ).to.equal(0);

  thumb.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  expect(el.valueAsNumber).to.equal(30);
  fieldset.disabled = true;
  fieldset.disabled = false;
  await el.updateComplete;
  thumb.dispatchEvent(
    new KeyboardEvent("keyup", { key: "ArrowRight", bubbles: true })
  );
  expect(
    changes,
    "re-enabling must not revive a fieldset-disabled key sequence"
  ).to.equal(0);
});

it("sanitizes value and form submission synchronously when the range changes", async () => {
  const form = (await fixture(html`
    <form>
      <lr-slider
        name="temperature"
        min="0"
        max="100"
        step="10"
        value="83"
      ></lr-slider>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-slider") as LyraSlider;
  expect(el.value).to.equal(80);
  expect(new FormData(form).get("temperature")).to.equal("80");

  el.max = 50;
  expect(el.value).to.equal(50);
  expect(el.valueAsNumber).to.equal(50);
  expect(new FormData(form).get("temperature")).to.equal("50");

  el.value = "NaN";
  expect(el.value).to.equal(0);
  expect(Number.isFinite(el.valueAsNumber)).to.be.true;
  expect(new FormData(form).get("temperature")).to.equal("0");
});

it("participates in a form: submits the string value under name", async () => {
  const form = (await fixture(html`
    <form><lr-slider name="temperature" value="70"></lr-slider></form>
  `)) as HTMLFormElement;
  expect(new FormData(form).get("temperature")).to.equal("70");
});

it("restores the declared default value on form.reset()", async () => {
  const form = (await fixture(html`
    <form><lr-slider name="temperature" value="70"></lr-slider></form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-slider") as LyraSlider;
  el.valueAsNumber = 10;
  await elementUpdated(el);
  expect(el.valueAsNumber).to.equal(10);

  form.reset();
  await elementUpdated(el);
  expect(el.value).to.equal(70);
});

it("re-defaults to zero on form.reset() when no default was declared", async () => {
  const form = (await fixture(html`
    <form><lr-slider name="temperature" min="0" max="100"></lr-slider></form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-slider") as LyraSlider;
  expect(el.valueAsNumber).to.equal(0);
  el.valueAsNumber = 90;
  await elementUpdated(el);

  form.reset();
  await elementUpdated(el);
  expect(el.valueAsNumber).to.equal(0);
});

it("restores and submits the implicit zero synchronously during form.reset()", async () => {
  const form = (await fixture(html`
    <form><lr-slider name="temperature" min="0" max="100"></lr-slider></form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-slider") as LyraSlider;
  el.valueAsNumber = 90;
  expect(new FormData(form).get("temperature")).to.equal("90");

  form.reset();
  expect(el.value).to.equal(0);
  expect(el.valueAsNumber).to.equal(0);
  expect(new FormData(form).get("temperature")).to.equal("0");
});

it("sanitizes and submits a declared default synchronously during form.reset()", async () => {
  const form = (await fixture(html`
    <form>
      <lr-slider
        name="temperature"
        min="0"
        max="100"
        step="10"
        value="83"
      ></lr-slider>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-slider") as LyraSlider;
  expect(el.valueAsNumber).to.equal(80);
  el.valueAsNumber = 20;
  expect(new FormData(form).get("temperature")).to.equal("20");

  form.reset();
  expect(el.value).to.equal(80);
  expect(el.valueAsNumber).to.equal(80);
  expect(new FormData(form).get("temperature")).to.equal("80");
});

it("clears the interacted flag but preserves a custom validity error across form.reset()", async function () {
  // formResetCallback() restores the declared default and clears the
  // dirty/interacted flags, but a setCustomValidity() error is a separate
  // consumer-supplied layer (AnchoredValidityController) that deliberately
  // survives a reset -- native reset semantics, matching every other
  // form-associated control in this library.
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
    <form><lr-slider name="gain" value="30"></lr-slider></form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-slider") as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;

  el.setCustomValidity("Rejected by server.");
  thumb.dispatchEvent(
    new FocusEvent("focusout", { bubbles: true, composed: true })
  );
  await elementUpdated(el);
  expect(
    el.matches(":state(user-invalid)"),
    "interacted while invalid marks user-invalid"
  ).to.be.true;

  el.valueAsNumber = 90;
  form.reset();
  await elementUpdated(el);

  expect(el.value, "value restores to the declared default").to.equal(30);
  expect(el.validity.customError, "the custom error survives the reset").to.be
    .true;
  expect(el.validationMessage).to.equal("Rejected by server.");
  expect(el.checkValidity()).to.be.false;
  expect(
    el.matches(":state(user-invalid)"),
    "the interacted flag is cleared by reset even though the error persists"
  ).to.be.false;
  expect(
    el.matches(":state(invalid)"),
    "still invalid -- just no longer counted as user-interacted-with"
  ).to.be.true;
});

it("formDisabledCallback disables the control via a fieldset", async () => {
  const form = (await fixture(html`
    <form>
      <fieldset disabled>
        <lr-slider name="temperature"></lr-slider>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-slider") as LyraSlider;
  // `el.disabled` (the consumer-facing IDL property/attribute) is never
  // mutated by fieldset cascading -- only the combined `effectiveDisabled`
  // reflects it (mirrors lr-combobox/lr-select's identical
  // `_fieldsetDisabled`/`effectiveDisabled` pattern).
  expect((el as unknown as { effectiveDisabled: boolean }).effectiveDisabled).to
    .be.true;
  expect(el.disabled).to.be.false;
  expect(getComputedStyle(el).opacity).to.equal("0.5");
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  expect(getComputedStyle(thumb).cursor).to.equal("not-allowed");
  let delegatedCalls = 0;
  thumb.click = () => {
    delegatedCalls += 1;
  };
  thumb.focus = () => {
    delegatedCalls += 1;
  };
  el.click();
  el.focus();
  expect(
    delegatedCalls,
    "fieldset disablement gates host click/focus delegation"
  ).to.equal(0);
});

it("restores declared min-value/max-value defaults on form.reset()", async () => {
  const form = (await fixture(html`
    <form>
      <lr-slider
        name="price"
        range
        min="0"
        max="100"
        min-value="20"
        max-value="80"
      ></lr-slider>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-slider") as LyraSlider;
  el.minValue = 45;
  el.maxValue = 55;
  await elementUpdated(el);

  form.reset();
  await elementUpdated(el);
  expect(el.minValue).to.equal(20);
  expect(el.maxValue).to.equal(80);
});

it("re-defaults removed min-value/max-value attributes to the range defaults on form.reset()", async () => {
  const form = (await fixture(html`
    <form>
      <lr-slider
        name="price"
        range
        min="0"
        max="100"
        min-value="20"
        max-value="80"
      ></lr-slider>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-slider") as LyraSlider;

  el.removeAttribute("min-value");
  el.removeAttribute("max-value");
  await elementUpdated(el);
  el.minValue = 30;
  el.maxValue = 40;

  form.reset();
  await elementUpdated(el);
  expect(el.minValue).to.equal(0);
  expect(el.maxValue).to.equal(50);
});

it("applies fractional range defaults on the final step grid before and after reset", async () => {
  const form = (await fixture(html`
    <form>
      <lr-slider
        name="price"
        range
        min="0"
        max="1"
        min-value="0.2"
        max-value="0.8"
        step="0.1"
      ></lr-slider>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-slider") as LyraSlider;
  expect(el.minValue).to.equal(0.2);
  expect(el.maxValue).to.equal(0.8);

  el.minValue = 0.3;
  el.maxValue = 0.7;
  form.reset();
  await elementUpdated(el);
  expect(el.minValue).to.equal(0.2);
  expect(el.maxValue).to.equal(0.8);
});

it("re-defaults the range handles to 0/50 on form.reset() when nothing was declared", async () => {
  const form = (await fixture(html`
    <form><lr-slider name="price" range min="0" max="100"></lr-slider></form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-slider") as LyraSlider;
  el.minValue = 40;
  el.maxValue = 60;
  await elementUpdated(el);

  form.reset();
  await elementUpdated(el);
  expect(el.minValue).to.equal(0);
  expect(el.maxValue).to.equal(50);
});

it("still cascades <fieldset disabled> to both range handles", async () => {
  const form = (await fixture(html`
    <form>
      <fieldset disabled><lr-slider range name="price"></lr-slider></fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-slider") as LyraSlider;
  await elementUpdated(el);
  for (const handle of handles(el)) {
    expect(handle.getAttribute("tabindex")).to.equal("-1");
    expect(handle.getAttribute("aria-disabled")).to.equal("true");
  }
});

it("restores single and range values from persisted form state", async () => {
  const el = (await fixture(
    html`<lr-slider name="level" min="0" max="100" value="10"></lr-slider>`
  )) as LyraSlider;
  el.formStateRestoreCallback("42", "restore");
  await elementUpdated(el);
  expect(el.value).to.equal(42);

  el.formStateRestoreCallback(null, "restore");
  await elementUpdated(el);
  expect(el.value).to.equal(10);

  const ranged = (await fixture(html`
    <lr-slider
      name="window"
      range
      min="0"
      max="100"
      min-value="10"
      max-value="90"
    ></lr-slider>
  `)) as LyraSlider;
  const state = new FormData();
  state.append("window", "25");
  state.append("window", "75");
  ranged.formStateRestoreCallback(state, "restore");
  await elementUpdated(ranged);
  expect(ranged.minValue).to.equal(25);
  expect(ranged.maxValue).to.equal(75);

  const partial = new FormData();
  partial.append("window", "5");
  ranged.formStateRestoreCallback(partial, "autocomplete");
  await elementUpdated(ranged);
  expect(ranged.minValue).to.equal(25);
  expect(ranged.maxValue).to.equal(75);
});

it("normalizes restored range values and ignores a partial state containing a file", async () => {
  const ranged = (await fixture(html`
    <lr-slider
      name="window"
      range
      min="10"
      max="90"
      step="10"
      min-value="20"
      max-value="80"
    ></lr-slider>
  `)) as LyraSlider;
  const restored = new FormData();
  restored.append("window", "-10");
  restored.append("window", "85");
  ranged.formStateRestoreCallback(restored, "restore");
  await elementUpdated(ranged);
  expect(
    [ranged.minValue, ranged.maxValue],
    "restored values use the live domain and step grid"
  ).to.deep.equal([10, 90]);

  const partial = new FormData();
  partial.append("window", "30");
  partial.append("window", new File(["state"], "window-state.bin"));
  ranged.formStateRestoreCallback(partial, "autocomplete");
  await elementUpdated(ranged);
  expect(
    [ranged.minValue, ranged.maxValue],
    "a non-string partial state cannot move one handle"
  ).to.deep.equal([10, 90]);
});

it("rejects spoofed FormData restoration values and ignores shadowed instance readers", async () => {
  const el = (await fixture(html`
    <lr-slider
      name="window"
      range
      min="0"
      max="100"
      min-value="20"
      max-value="80"
    ></lr-slider>
  `)) as LyraSlider;
  const spoof = {
    [Symbol.toStringTag]: "FormData",
    append() {},
    *values() {
      yield "0";
      yield "100";
    },
  } as unknown as FormData;
  el.formStateRestoreCallback(spoof, "restore");
  expect([el.minValue, el.maxValue]).to.deep.equal([20, 80]);

  const genuine = new FormData();
  genuine.append("window", "30");
  genuine.append("window", "70");
  Object.defineProperty(genuine, "values", {
    value: () => {
      throw new Error("shadowed reader");
    },
  });
  el.formStateRestoreCallback(genuine, "restore");
  expect([el.minValue, el.maxValue]).to.deep.equal([30, 70]);
});

it("constructs range submission and restore state with the adopted owner FormData", async () => {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const frameWindow = frame.contentWindow!;
  const globals = frameWindow as unknown as { FormData: typeof FormData };
  const NativeFormData = globals.FormData;
  let constructions = 0;
  const TrackingFormData = new Proxy(NativeFormData, {
    construct(target, args, newTarget) {
      constructions++;
      return Reflect.construct(target, args, newTarget);
    },
  }) as typeof FormData;
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
    globals.FormData = TrackingFormData;
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;
    constructions = 0;
    el.minValue = 25;
    expect(constructions).to.equal(2);
  } finally {
    el.remove();
    globals.FormData = NativeFormData;
    frame.remove();
  }
});

it("does not construct global FormData for a range in an ownerless document", () => {
  const inertDocument = document.implementation.createHTMLDocument("ownerless");
  const globals = globalThis as typeof globalThis & {
    FormData: typeof FormData;
  };
  const NativeFormData = globals.FormData;
  let constructions = 0;
  const TrackingFormData = new Proxy(NativeFormData, {
    construct(target, args, newTarget) {
      constructions++;
      return Reflect.construct(target, args, newTarget);
    },
  }) as typeof FormData;

  try {
    globals.FormData = TrackingFormData;
    const el = document.createElement("lr-slider") as LyraSlider;
    inertDocument.adoptNode(el);
    el.name = "window";
    el.range = true;
    expect(constructions).to.equal(0);
  } finally {
    globals.FormData = NativeFormData;
  }
});

it("defers range form state without an SSR owner document and resynchronizes on connect", async () => {
  const globals = globalThis as typeof globalThis & {
    FormData: typeof FormData;
  };
  const NativeFormData = globals.FormData;
  let ambientConstructions = 0;
  const TrackingFormData = new Proxy(NativeFormData, {
    construct(target, args, newTarget) {
      ambientConstructions++;
      return Reflect.construct(target, args, newTarget);
    },
  }) as typeof FormData;
  const form = document.createElement("form");
  const el = document.createElement("lr-slider") as LyraSlider;
  el.name = "window";
  Object.defineProperty(el, "ownerDocument", {
    configurable: true,
    value: undefined,
  });

  try {
    globals.FormData = TrackingFormData;
    expect(() => {
      el.range = true;
    }).not.to.throw();
    expect(ambientConstructions).to.equal(0);
  } finally {
    globals.FormData = NativeFormData;
    delete (el as unknown as { ownerDocument?: Document }).ownerDocument;
  }

  form.append(el);
  document.body.append(form);
  try {
    await el.updateComplete;
    el.minValue = 25;
    el.maxValue = 75;

    expect(new FormData(form).getAll("window")).to.deep.equal(["25", "75"]);
  } finally {
    form.remove();
  }
});

it("bars the validity custom states while readonly or disabled", async function () {
  // `internals.states` and the `:state()` selector shipped separately; skip where either is absent
  // rather than fail on an engine that cannot answer.
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
    html`<lr-slider aria-label="Volume" readonly></lr-slider>`
  )) as LyraSlider;
  el.setCustomValidity("Choose another value.");
  await elementUpdated(el);
  expect(
    el.matches(":state(invalid)"),
    "a readonly control is barred from validation"
  ).to.be.false;

  el.readonly = false;
  await elementUpdated(el);
  expect(
    el.matches(":state(invalid)"),
    "the state returns once it is enforceable again"
  ).to.be.true;

  el.disabled = true;
  await elementUpdated(el);
  expect(el.matches(":state(invalid)"), "a disabled control is barred too").to
    .be.false;
});

it("normalizes a nullish custom-validity message to an empty string", async () => {
  const el = await fixture<LyraSlider>(html`
    <lr-slider aria-label="Volume"></lr-slider>
  `);
  el.setCustomValidity("Blocked");
  expect(el.checkValidity()).to.be.false;

  el.setCustomValidity(null as unknown as string);

  expect(el.checkValidity()).to.be.true;
  expect(el.validationMessage).to.equal("");
});

it("falls back to its default when ownerless FormData restore state cannot be read", async () => {
  const inertDocument = document.implementation.createHTMLDocument("ownerless");
  const el = await fixture<LyraSlider>(html`
    <lr-slider value="25"></lr-slider>
  `);
  el.remove();
  inertDocument.adoptNode(el);

  el.formStateRestoreCallback(new FormData(), "restore");

  expect(el.valueAsNumber).to.equal(25);
});
