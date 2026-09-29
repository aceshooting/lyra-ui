// Focused native form lifecycle cases. Test bodies and titles were moved intact from the prior suite.
import { fixture, expect, html } from "@open-wc/testing";
import "./time-range.js";
import type { LyraTimeRange } from "./time-range.js";

function beginChangedStartDrag(el: LyraTimeRange, pointerId: number): void {
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const startHandle = el.shadowRoot!.querySelector<HTMLElement>(
    '[part="handle-start"]'
  )!;
  startHandle.setPointerCapture = () => {};
  base.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 200,
      bottom: 0,
      width: 200,
      height: 0,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    } as DOMRect);
  startHandle.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, pointerId, clientX: 40 })
  );
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId, clientX: 100 })
  );
  expect(el.start).to.equal(50);
}

const PRESETS = [
  { label: "Last 7 days", start: 0, end: 7 },
  { label: "Last 30 days", start: 0, end: 30 },
  { label: "Last 90 days", start: 0, end: 90 },
];

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

it("does not commit an already-changed drag when fieldset-disabled before pointerup", async () => {
  const form = (await fixture(html`
    <form>
      <fieldset>
        <lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const fieldset = form.querySelector("fieldset")!;
  const el = form.querySelector("lr-time-range") as LyraTimeRange;
  beginChangedStartDrag(el, 102);
  const changes: Array<{ start: number; end: number }> = [];
  el.addEventListener("lr-change", (event) => {
    changes.push((event as CustomEvent<{ start: number; end: number }>).detail);
  });

  fieldset.disabled = true;
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 102 }));
  expect(changes).to.deep.equal([]);
});

it("dims with opacity/not-allowed cursor when disabled purely via an ancestor fieldset, not just its own disabled attribute", async () => {
  const form = (await fixture(html`
    <form>
      <fieldset disabled>
        <lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-time-range") as LyraTimeRange;
  await el.updateComplete;
  expect((el as unknown as { effectiveDisabled: boolean }).effectiveDisabled).to
    .be.true;
  expect(
    el.hasAttribute("disabled"),
    "the own disabled attribute must stay unset"
  ).to.be.false;

  const hostStyle = getComputedStyle(el);
  expect(
    hostStyle.opacity,
    "fieldset-only disablement must still dim the host"
  ).to.equal("0.5");
  expect(hostStyle.cursor).to.equal("not-allowed");
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  expect(getComputedStyle(startHandle).cursor).to.equal("not-allowed");
});

describe("ElementInternals availability", () => {
  it("does not throw when constructed in an environment without a real ElementInternals implementation (e.g. a downstream Vitest + happy-dom suite)", () => {
    const original = HTMLElement.prototype.attachInternals;
    // @ts-expect-error -- simulating an environment that lacks ElementInternals entirely
    delete HTMLElement.prototype.attachInternals;
    try {
      let el: LyraTimeRange | undefined;
      expect(() => {
        el = document.createElement("lr-time-range") as LyraTimeRange;
      }).to.not.throw();
      expect(el!.disabled).to.be.false;
    } finally {
      HTMLElement.prototype.attachInternals = original;
    }
  });
});

it("rounds exponent-form steps without collapsing the nudge to zero", async () => {
  const el = (await fixture(
    html`<lr-time-range
      min="0"
      max="1"
      start="0"
      end="1"
      step="1e-7"
    ></lr-time-range>`
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  startHandle.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  await el.updateComplete;
  expect(el.start).to.equal(0.0000001);
});

it("is disabled by an ancestor <fieldset disabled> without mutating the disabled property, and re-enables when the fieldset does", async () => {
  const form = (await fixture(html`
    <form>
      <fieldset disabled>
        <lr-time-range
          min="0"
          max="100"
          start="20"
          end="80"
          step="5"
        ></lr-time-range>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-time-range") as LyraTimeRange;
  await el.updateComplete;

  // `el.disabled` (the consumer-facing IDL property/attribute) is never
  // mutated by fieldset cascading -- only the combined `effectiveDisabled`
  // reflects it (mirrors lr-combobox's/lr-slider's identical
  // `_fieldsetDisabled`/`effectiveDisabled` pattern).
  expect((el as unknown as { effectiveDisabled: boolean }).effectiveDisabled).to
    .be.true;
  expect(el.disabled).to.be.false;

  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  expect(startHandle.getAttribute("tabindex")).to.equal("-1");
  expect(startHandle.getAttribute("aria-disabled")).to.equal("true");

  // Before the fix, lr-time-range never became form-associated at all, so
  // an ancestor fieldset had no effect: the handle would stay focusable and
  // arrow keys would still move it.
  startHandle.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  expect(el.start).to.equal(20);

  const fieldset = form.querySelector("fieldset")!;
  fieldset.disabled = false;
  await el.updateComplete;
  expect((el as unknown as { effectiveDisabled: boolean }).effectiveDisabled).to
    .be.false;
  expect(startHandle.getAttribute("tabindex")).to.equal("0");
  startHandle.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  expect(el.start).to.equal(25);
});

it("disables preset buttons via an ancestor <fieldset disabled> too", async () => {
  const form = (await fixture(html`
    <form>
      <fieldset disabled>
        <lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-time-range") as LyraTimeRange;
  el.presets = PRESETS;
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector<HTMLButtonElement>(
    '[part="preset-button"]'
  )!;
  expect(button.disabled).to.be.true;
  button.click();
  await el.updateComplete;
  expect(el.start).to.equal(20);
  expect(el.end).to.equal(80);
});

it('preserves identity across reconnect but clears it when the owning form resets', async () => {
  const form = (await fixture(html`
    <form>
      <lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector<LyraTimeRange>('lr-time-range')!;
  el.presets = [{ label: 'Working window', start: 20, end: 80 }];
  await el.updateComplete;
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="preset-button"]')!.click();
  await el.updateComplete;
  const selected = el.appliedPreset;

  el.remove();
  form.append(el);
  await el.updateComplete;
  expect(el.appliedPreset, 'reconnection does not change the selected range').to.equal(selected);

  form.reset();
  await el.updateComplete;
  expect(el.start).to.equal(20);
  expect(el.end).to.equal(80);
  expect(el.appliedPreset, 'declared reset values did not come from a preset click').to.equal(
    undefined,
  );
  expect(
    el.shadowRoot!.querySelector('[part="preset-button"]')!.getAttribute('aria-pressed'),
    'reset also removes the rendered active state when the values were already defaults',
  ).to.equal('false');
});

describe("lr-time-range setCustomValidity()", () => {
  it('projects both aria-invalid polarities to the focusable range handles', async () => {
    const el = (await fixture(html`
      <lr-time-range
        aria-label="Booking window"
        min="0"
        max="100"
        start="20"
        end="80"
      ></lr-time-range>
    `)) as LyraTimeRange;
    const handles = [...el.shadowRoot!.querySelectorAll('[role="slider"]')] as HTMLElement[];
    expect(handles.map((handle) => handle.getAttribute('aria-invalid'))).to.deep.equal(['false', 'false']);

    el.setCustomValidity('That window is unavailable.');
    await el.updateComplete;
    expect(el.checkValidity()).to.equal(false);
    expect(handles.map((handle) => handle.getAttribute('aria-invalid'))).to.deep.equal(['true', 'true']);
    await expect(el).to.be.accessible();

    el.setCustomValidity('');
    await el.updateComplete;
    expect(handles.map((handle) => handle.getAttribute('aria-invalid'))).to.deep.equal(['false', 'false']);
  });

  it("exposes a reflected customError property that delegates to the native validity surface", async () => {
    const el = (await fixture(
      html`<lr-time-range
        min="0"
        max="100"
        start="20"
        end="80"
      ></lr-time-range>`
    )) as LyraTimeRange;

    el.customError = "That range is unavailable";
    expect(el.getAttribute("custom-error")).to.equal(
      "That range is unavailable"
    );
    expect(el.validationMessage).to.equal("That range is unavailable");
    expect(el.validity.customError).to.be.true;

    el.customError = null;
    expect(el.hasAttribute("custom-error")).to.be.false;
    expect(el.validationMessage).to.equal("");
    expect(el.validity.customError).to.be.false;
  });

  it("emits one cancelable lr-invalid alias and forwards cancellation to native invalid", async () => {
    const el = (await fixture(
      html`<lr-time-range
        min="0"
        max="100"
        start="20"
        end="80"
      ></lr-time-range>`
    )) as LyraTimeRange;
    const aliases: CustomEvent[] = [];
    el.addEventListener("lr-invalid", (event) => {
      aliases.push(event as CustomEvent);
      event.preventDefault();
    });
    const natives: Event[] = [];
    el.addEventListener("invalid", (event) => natives.push(event));
    el.setCustomValidity("That range is unavailable");

    expect(el.checkValidity()).to.be.false;
    expect(aliases).to.have.lengthOf(1);
    const alias = aliases[0];
    if (!alias) throw new Error('The invalid alias was not emitted.');
    expect(alias.bubbles && alias.composed && alias.cancelable).to.be.true;
    expect(natives).to.have.lengthOf(1);
    const native = natives[0];
    if (!native) throw new Error('The native invalid event was not emitted.');
    expect(native.defaultPrevented).to.be.true;
  });

  it("blocks form submission and becomes the validationMessage", async () => {
    const form = (await fixture(html`
      <form>
        <lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-time-range") as LyraTimeRange;
    let submits = 0;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submits += 1;
    });

    form.requestSubmit();
    expect(submits, "an otherwise-valid range submits").to.equal(1);

    el.setCustomValidity("That window overlaps an existing booking");
    expect(el.validationMessage).to.equal(
      "That window overlaps an existing booking"
    );
    expect(el.validity.customError, "customError").to.be.true;
    expect(el.checkValidity()).to.be.false;

    form.requestSubmit();
    expect(submits, "a custom error blocks submission").to.equal(1);
  });

  it("survives an intrinsic revalidation", async () => {
    const el = (await fixture(
      html`<lr-time-range
        min="0"
        max="100"
        start="20"
        end="80"
      ></lr-time-range>`
    )) as LyraTimeRange;
    el.setCustomValidity("Server says no");
    el.start = 30;
    await el.updateComplete;
    expect(el.validity.customError, "custom error survives a value change").to
      .be.true;
    expect(el.validationMessage).to.equal("Server says no");
  });

  // Native `setCustomValidity()` is sticky: `form.reset()` restores values, never the custom
  // error, which only another `setCustomValidity('')` clears. Matching that here.
  it("keeps the custom error across a form reset", async () => {
    const form = (await fixture(html`
      <form>
        <lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-time-range") as LyraTimeRange;
    el.setCustomValidity("Server says no");
    form.reset();
    await el.updateComplete;
    expect(el.validity.customError).to.be.true;
    expect(el.validationMessage).to.equal("Server says no");
  });

  // This control has no intrinsic constraints of its own (no `required`, no submitted value), so
  // "restore the computed validity" resolves to valid here -- the point being that clearing
  // republishes what the control itself computes rather than latching either answer.
  it("restores the computed validity when cleared", async () => {
    const el = (await fixture(
      html`<lr-time-range
        min="0"
        max="100"
        start="20"
        end="80"
      ></lr-time-range>`
    )) as LyraTimeRange;
    el.setCustomValidity("Server says no");
    expect(el.checkValidity()).to.be.false;
    el.setCustomValidity("");
    expect(el.validity.customError, "custom error cleared").to.be.false;
    expect(el.checkValidity()).to.be.true;
    expect(el.validationMessage).to.equal("");
  });

  it('treats a non-string (null/undefined) message the same as an empty string, for a caller that violates the TS signature', async () => {
    const el = (await fixture(
      html`<lr-time-range
        min="0"
        max="100"
        start="20"
        end="80"
      ></lr-time-range>`
    )) as LyraTimeRange;
    el.setCustomValidity("Server says no");
    expect(el.checkValidity()).to.be.false;

    (el.setCustomValidity as (message: unknown) => void)(null);
    expect(el.validity.customError, "a nullish message clears like ''").to.be
      .false;
    expect(el.checkValidity()).to.be.true;
    expect(el.validationMessage).to.equal("");
  });

  it('resolves a null validity anchor without throwing when setCustomValidity() runs before the first render', async () => {
    const el = document.createElement("lr-time-range") as LyraTimeRange;
    // Before the element is connected, render() has not run yet, so [VALIDITY_ANCHOR]() finds no
    // [part="handle-start"] in the (still-empty) shadow root and falls through to null.
    expect(() => el.setCustomValidity("Server says no")).to.not.throw();
    document.body.append(el);
    await el.updateComplete;
    try {
      expect(el.validationMessage).to.equal("Server says no");
      expect(el.validity.customError).to.be.true;
    } finally {
      el.remove();
    }
  });

  it("drives the valid/invalid custom states", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(
      html`<lr-time-range
        min="0"
        max="100"
        start="20"
        end="80"
      ></lr-time-range>`
    )) as LyraTimeRange;
    await el.updateComplete;
    expect(el.matches(":state(valid)"), "valid before").to.be.true;
    expect(el.matches(":state(optional)"), "no required constraint of its own")
      .to.be.true;
    expect(el.matches(":state(required)")).to.be.false;
    el.setCustomValidity("Server says no");
    expect(el.matches(":state(invalid)"), "invalid while a custom error is set")
      .to.be.true;
    expect(el.matches(":state(valid)")).to.be.false;
    el.setCustomValidity("");
    expect(el.matches(":state(valid)"), "valid again once cleared").to.be.true;
  });

  it("withholds user-invalid until the user has actually moved a handle", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(
      html`<lr-time-range
        min="0"
        max="100"
        start="20"
        end="80"
      ></lr-time-range>`
    )) as LyraTimeRange;
    await el.updateComplete;
    el.setCustomValidity("Server says no");
    expect(el.matches(":state(invalid)")).to.be.true;
    expect(
      el.matches(":state(user-invalid)"),
      "pristine control must not read as an error"
    ).to.be.false;

    const handle = el.shadowRoot!.querySelector(
      '[part="handle-start"]'
    ) as HTMLElement;
    handle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
    );
    await el.updateComplete;
    expect(el.start, "the arrow key moved the handle").to.equal(21);
    expect(
      el.matches(":state(user-invalid)"),
      "user-invalid after a real interaction"
    ).to.be.true;
  });
});

it("treats a blur as interaction for the user-* validity states", async function () {
  if (!supportsCustomStates || !supportsStateSelector) this.skip();
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`
  )) as LyraTimeRange;
  await el.updateComplete;
  el.setCustomValidity("Server says no");
  expect(el.matches(":state(user-invalid)"), "pristine").to.be.false;

  const handle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  handle.focus();
  handle.blur();
  expect(
    el.matches(":state(user-invalid)"),
    "focusout is the observable blur signal"
  ).to.be.true;
  expect(el.start, "blur alone must not move a handle").to.equal(20);
});

it("does not mark a pristine invalid range as user-invalid when disablement forces focusout", async function () {
  if (!supportsCustomStates || !supportsStateSelector) this.skip();
  const form = await fixture<HTMLFormElement>(html`
    <form>
      <fieldset>
        <lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>
      </fieldset>
    </form>
  `);
  const fieldset = form.querySelector("fieldset")!;
  const el = form.querySelector("lr-time-range") as LyraTimeRange;
  const handle = el.shadowRoot!.querySelector<HTMLElement>(
    '[part="handle-start"]'
  )!;
  el.setCustomValidity("That range is unavailable");
  handle.focus();

  fieldset.disabled = true;
  // Model the observed Chromium ordering explicitly: the selector is already live while the
  // callback-backed cache can still report its previous value when forced focusout arrives.
  el.formDisabledCallback(false);
  handle.dispatchEvent(
    new FocusEvent("focusout", { bubbles: true, composed: true })
  );
  fieldset.disabled = false;
  await el.updateComplete;

  expect(el.matches(":state(user-invalid)")).to.be.false;
  expect(
    el.matches(":state(invalid)"),
    "the custom error itself remains after re-enable"
  ).to.be.true;
});

describe("lr-time-range form reset", () => {
  it("restores the declared range", async () => {
    const form = (await fixture(html`
      <form>
        <lr-time-range
          min="0"
          max="100"
          start="20"
          end="80"
          step="5"
        ></lr-time-range>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-time-range") as LyraTimeRange;
    const handle = el.shadowRoot!.querySelector(
      '[part="handle-start"]'
    ) as HTMLElement;
    handle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
    );
    handle.dispatchEvent(
      new KeyboardEvent("keyup", { key: "ArrowRight", bubbles: true })
    );
    await el.updateComplete;
    expect(el.start, "the user moved the start handle").to.equal(25);

    form.reset();
    await el.updateComplete;
    expect(el.start, "reset restores the declared start").to.equal(20);
    expect(
      el.end,
      "reset leaves the untouched end at its declared value"
    ).to.equal(80);
    const range = el.shadowRoot!.querySelector('[part="range"]') as HTMLElement;
    expect(
      range.style.insetInlineStart,
      "and the restored range actually re-renders"
    ).to.equal("20%");
  });

  it("falls back to the domain bounds when no range was declared", async () => {
    const form = (await fixture(html`
      <form><lr-time-range min="10" max="20" step="1"></lr-time-range></form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-time-range") as LyraTimeRange;
    el.start = 14;
    el.end = 16;
    await el.updateComplete;

    form.reset();
    await el.updateComplete;
    expect(el.start).to.equal(10);
    expect(el.end).to.equal(20);
  });

  it("emits neither lr-input nor lr-change — a reset is not a user edit", async () => {
    const form = (await fixture(html`
      <form>
        <lr-time-range
          min="0"
          max="100"
          start="20"
          end="80"
          step="5"
        ></lr-time-range>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-time-range") as LyraTimeRange;
    el.start = 40;
    await el.updateComplete;
    const events: string[] = [];
    for (const type of ["input", "lr-input", "change", "lr-change"]) {
      el.addEventListener(type, () => events.push(type));
    }

    form.reset();
    await el.updateComplete;
    expect(el.start).to.equal(20);
    expect(events).to.deep.equal([]);
  });

  it("clears the interaction flag so :state(user-invalid) stops matching, without clearing the custom error", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const form = (await fixture(html`
      <form>
        <lr-time-range
          min="0"
          max="100"
          start="20"
          end="80"
          step="5"
        ></lr-time-range>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-time-range") as LyraTimeRange;
    el.setCustomValidity("Server says no");
    const handle = el.shadowRoot!.querySelector(
      '[part="handle-start"]'
    ) as HTMLElement;
    handle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
    );
    await el.updateComplete;
    expect(
      el.matches(":state(user-invalid)"),
      "user-invalid after a real interaction"
    ).to.be.true;

    form.reset();
    await el.updateComplete;
    // Native semantics, both halves: the reset clears the "user has interacted" flag, so the
    // control stops rendering as an error the user has not caused yet -- but a custom error is
    // sticky across a reset (only another setCustomValidity('') clears it), so the control is
    // still invalid and still blocks submission.
    expect(
      el.matches(":state(user-invalid)"),
      "a pristine control must not read as an error"
    ).to.be.false;
    expect(el.matches(":state(invalid)"), "the custom error itself survives").to
      .be.true;
    expect(el.validationMessage).to.equal("Server says no");
  });

  it("does not commit a pending keyboard step after the reset", async () => {
    const form = (await fixture(html`
      <form>
        <lr-time-range
          min="0"
          max="100"
          start="20"
          end="80"
          step="5"
        ></lr-time-range>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-time-range") as LyraTimeRange;
    const handle = el.shadowRoot!.querySelector(
      '[part="handle-start"]'
    ) as HTMLElement;
    handle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
    );
    await el.updateComplete;

    form.reset();
    await el.updateComplete;
    const changes: string[] = [];
    el.addEventListener("lr-change", () => changes.push("change"));
    handle.dispatchEvent(
      new KeyboardEvent("keyup", { key: "ArrowRight", bubbles: true })
    );
    expect(el.start, "the reset value stands").to.equal(20);
    expect(
      changes,
      "the in-flight keyboard gesture was dropped by the reset"
    ).to.deep.equal([]);
  });

  it("does not commit an already-changed drag after the reset restores its value", async () => {
    const form = (await fixture(html`
      <form>
        <lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-time-range") as LyraTimeRange;
    beginChangedStartDrag(el, 103);
    const changes: Array<{ start: number; end: number }> = [];
    el.addEventListener("lr-change", (event) => {
      changes.push(
        (event as CustomEvent<{ start: number; end: number }>).detail
      );
    });

    form.reset();
    await el.updateComplete;
    expect(el.start).to.equal(20);
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 103 }));
    expect(changes).to.deep.equal([]);
    expect(el.start).to.equal(20);
  });
});

it('reflects the writable `form` IDL through the `form` content attribute (string id, element, and null)', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`
  )) as LyraTimeRange;
  const otherForm = document.createElement("form");
  otherForm.id = "external-form";

  el.form = "external-form";
  expect(el.getAttribute("form")).to.equal("external-form");

  el.form = otherForm;
  expect(el.getAttribute("form")).to.equal("external-form");

  el.form = null;
  expect(el.hasAttribute("form")).to.be.false;
});

describe("ElementInternals fallback", () => {
  /** A consumer test environment such as happy-dom may not implement form association, but the
   * public range and validity APIs must still be safe to use. */
  const withoutAttachInternals = async (
    impl: undefined | (() => never),
    assertion: (el: LyraTimeRange) => void | Promise<void>
  ): Promise<void> => {
    const proto = HTMLElement.prototype as unknown as {
      attachInternals?: unknown;
    };
    const original = proto.attachInternals;
    if (impl === undefined) delete proto.attachInternals;
    else proto.attachInternals = impl;
    try {
      const el = (await fixture(html`
        <lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>
      `)) as LyraTimeRange;
      await el.updateComplete;
      await assertion(el);
    } finally {
      if (original === undefined) delete proto.attachInternals;
      else proto.attachInternals = original;
    }
  };

  it("keeps public value and validity APIs inert but usable when attachInternals is unavailable", async () => {
    await withoutAttachInternals(undefined, async (el) => {
      expect(el.form === null).to.equal(true);
      expect(el.willValidate).to.be.false;
      expect(el.validationMessage).to.equal("");
      expect(el.checkValidity()).to.be.true;
      expect(el.reportValidity()).to.be.true;

      expect(() => el.setCustomValidity("Server says no")).to.not.throw();
      el.start = 30;
      await el.updateComplete;
      expect(el.start).to.equal(30);
    });
  });

  it("uses the same safe public fallback when native attachInternals throws", async () => {
    await withoutAttachInternals(
      () => {
        throw new DOMException("unsupported");
      },
      (el) => {
        expect(el.willValidate).to.be.false;
        expect(el.checkValidity()).to.be.true;
        expect(el.reportValidity()).to.be.true;
      }
    );
  });
});

// error the user cannot even reach.
describe("lr-time-range barred from constraint validation", () => {
  it("withholds the valid/invalid states while disabled, without discarding the message", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(
      html`<lr-time-range
        min="0"
        max="100"
        start="20"
        end="80"
      ></lr-time-range>`
    )) as LyraTimeRange;
    await el.updateComplete;
    el.setCustomValidity("Server says no");
    expect(el.matches(":state(invalid)"), "invalid while enabled").to.be.true;

    el.disabled = true;
    await el.updateComplete;
    expect(el.matches(":state(invalid)"), "invalid while disabled").to.be.false;
    expect(el.matches(":state(valid)"), "a barred control is not valid either")
      .to.be.false;
    expect(el.matches(":state(user-invalid)"), "user-invalid while disabled").to
      .be.false;
    expect(el.validationMessage, "the message itself is untouched").to.equal(
      "Server says no"
    );

    el.disabled = false;
    await el.updateComplete;
    expect(el.matches(":state(invalid)"), "invalid again once enabled").to.be
      .true;
  });

  it("withholds them inside a disabled fieldset too", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const form = (await fixture(html`
      <form>
        <fieldset disabled>
          <lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>
        </fieldset>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-time-range") as LyraTimeRange;
    await el.updateComplete;
    el.setCustomValidity("Server says no");
    expect(el.matches(":state(invalid)"), "invalid inside a disabled fieldset")
      .to.be.false;
    expect(el.matches(":state(valid)"), "valid inside a disabled fieldset").to
      .be.false;
    expect(el.disabled, "the fieldset never mutates the own disabled IDL").to.be
      .false;
  });
});
