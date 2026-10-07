// Focused native form lifecycle cases. Test bodies and titles were moved intact from the prior suite.
import { fixture, expect, html } from "@open-wc/testing";
import { dispatchEnterKeyAndSettle } from '../../../../test/contracts/enter-submit.js';
import { sendKeys } from "@web/test-runner-commands";
import { focusByKeyboard } from "../../../../test/wtr-focus.js";
import "./date-input.js";
import "../button/button.js";
import type { LyraDateInput } from "./date-input.js";
import type { LyraDatePicker } from "./date-picker.js";
import "../../../translations/ar/forms.js";
import "../../../translations/ar/shared.js";
import "../../../translations/fr/forms.js";
import "../../../translations/fr/shared.js";
import "../../../translations/fa/forms.js";
import "../../../translations/fa/shared.js";



it("rejects direct open writes while readonly or synchronously fieldset-disabled", async () => {
  const fieldset = await fixture<HTMLFieldSetElement>(html`
    <fieldset><lr-date-input></lr-date-input></fieldset>
  `);
  const el = fieldset.querySelector("lr-date-input") as LyraDateInput;
  el.readonly = true;
  el.open = true;
  expect(el.open).to.be.false;
  expect(el.hasAttribute("open")).to.be.false;

  el.readonly = false;
  fieldset.disabled = true;
  el.setAttribute("open", "");
  await el.updateComplete;
  expect(el.open).to.be.false;
  expect(el.hasAttribute("open")).to.be.false;
});

it("forwards host actions and suppresses click/focus in a same-task fieldset disablement", async () => {
  const form = (await fixture(html`
    <form>
      <fieldset><lr-date-input></lr-date-input></fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-date-input") as LyraDateInput;
  const fieldset = form.querySelector("fieldset") as HTMLFieldSetElement;
  const input = el.shadowRoot!.querySelector(
    'input[part="input"]'
  ) as HTMLInputElement;
  let clicks = 0;
  input.addEventListener("click", () => clicks++);

  el.click();
  expect(clicks).to.equal(1);
  fieldset.disabled = true;
  el.click();
  el.focus();
  expect(clicks).to.equal(1);
  expect(el.shadowRoot!.activeElement === null).to.be.true;
});

it("flags an ISO-shaped but calendar-invalid typed date (e.g. Feb 30) as badInput instead of silently correcting it", async () => {
  // Regression test: parseISO used to accept "2026-02-30" via JS Date's
  // auto-rollover (returning March 2) instead of null, and Date.parse() has
  // the same rollover behavior for an ISO-shaped string -- so a mistyped day
  // used to silently commit a different date with no feedback at all.
  const el = (await fixture(
    html`<lr-date-input value="2026-07-15"></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector(
    '[part="input"]'
  ) as HTMLInputElement;
  const committedDisplay = input.value;

  input.value = "2026-02-30";
  input.dispatchEvent(new Event("change"));
  await el.updateComplete;

  expect(el.value).to.equal("2026-07-15"); // not silently rolled over to March 2
  expect(input.value).to.equal(committedDisplay);
  expect(el.checkValidity()).to.be.false;
  expect(el.internals.validity.badInput).to.be.true;
});

it("closes the popover on Escape from anywhere inside the form control", async () => {
  const el = (await fixture(
    html`<lr-date-input value="2026-07-15"></lr-date-input>`
  )) as LyraDateInput;
  el.show();
  await el.updateComplete;
  expect(el.open).to.be.true;

  const formControl = el.shadowRoot!.querySelector(
    '[part="form-control"]'
  ) as HTMLElement;
  formControl.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      composed: true,
    })
  );
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it("touches a required field on clear() so the resulting invalid state is surfaced immediately", async () => {
  // Regression test: clear() used to reset `value` without setting `touched`,
  // so a required-and-now-empty field kept looking valid (no data-invalid)
  // until some later, unrelated blur -- even though the field was just
  // emptied by an explicit, user-initiated action.
  const el = (await fixture(
    html`<lr-date-input with-clear required value="2026-07-15"></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  expect(el.hasAttribute("data-invalid")).to.be.false;

  el.clear();
  await el.updateComplete;
  expect(el.hasAttribute("data-invalid")).to.be.true;
});

it("participates in a form", async () => {
  const form = (await fixture(html`
    <form><lr-date-input name="d" value="2026-07-15"></lr-date-input></form>
  `)) as HTMLFormElement;
  expect(new FormData(form).get("d")).to.equal("2026-07-15");
});

it("blocks a required, empty date input from submitting the form", async () => {
  const form = (await fixture(
    html`<form><lr-date-input name="d" required></lr-date-input></form>`
  )) as HTMLFormElement;
  expect(form.reportValidity()).to.be.false;
});

it("focuses its input when typed bad-input validation fails directly or during form submission", async () => {
  const form = (await fixture(html`
    <form>
      <button type="button" id="sentinel">Before</button>
      <lr-date-input name="d" value="2026-07-15"></lr-date-input>
      <button type="submit">Submit</button>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-date-input") as LyraDateInput;
  const sentinel = form.querySelector("#sentinel") as HTMLButtonElement;
  await el.updateComplete;

  const input = el.shadowRoot!.querySelector(
    '[part="input"]'
  ) as HTMLInputElement;
  input.value = "not a date";
  input.dispatchEvent(new Event("change"));
  await el.updateComplete;
  expect(el.internals.validity.badInput).to.be.true;

  sentinel.focus();
  expect(document.activeElement?.id).to.equal("sentinel");
  expect(el.reportValidity()).to.be.false;
  expect(document.activeElement?.localName).to.equal("lr-date-input");
  expect(el.shadowRoot!.activeElement?.getAttribute("part")).to.equal("input");

  let submits = 0;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submits += 1;
  });
  sentinel.focus();
  expect(document.activeElement?.id).to.equal("sentinel");
  form.requestSubmit();
  expect(submits).to.equal(0);
  expect(document.activeElement?.localName).to.equal("lr-date-input");
  expect(el.shadowRoot!.activeElement?.getAttribute("part")).to.equal("input");
});

it("re-syncs ElementInternals validity when required is toggled after connection", async () => {
  const form = (await fixture(
    html`<form><lr-date-input name="d"></lr-date-input></form>`
  )) as HTMLFormElement;
  const el = form.querySelector("lr-date-input") as LyraDateInput;
  expect(form.reportValidity()).to.be.true;

  el.required = true;
  await el.updateComplete;
  expect(form.reportValidity()).to.be.false;

  el.value = "2026-07-15";
  await el.updateComplete;
  expect(form.reportValidity()).to.be.true;
});

describe("complete programmatic validity", () => {
  it("retains an out-of-range declarative value and reports its precise bound failure", async () => {
    const form = (await fixture(html`
      <form>
        <lr-date-input
          name="d"
          min="2026-01-01"
          max="2026-12-31"
          value="2027-01-01"
        ></lr-date-input>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-date-input") as LyraDateInput;

    expect(el.value).to.equal("2027-01-01");
    expect(new FormData(form).get("d")).to.equal("2027-01-01");
    expect(el.internals.validity.rangeOverflow).to.be.true;
    expect(el.checkValidity()).to.be.false;
  });

  it("recomputes min and max validity synchronously for property and attribute changes", async () => {
    const el = (await fixture(
      html`<lr-date-input value="2026-07-15"></lr-date-input>`
    )) as LyraDateInput;

    el.min = "2026-08-01";
    expect(el.internals.validity.rangeUnderflow).to.be.true;

    el.min = "";
    expect(el.checkValidity()).to.be.true;

    el.setAttribute("max", "2026-06-30");
    expect(el.internals.validity.rangeOverflow).to.be.true;

    el.removeAttribute("max");
    expect(el.checkValidity()).to.be.true;

    el.min = "not-a-date";
    el.max = "2026-99-99";
    expect(el.checkValidity()).to.be.true;
  });

  it("recomputes disable-past and disable-future validity synchronously", async () => {
    const el = (await fixture(
      html`<lr-date-input value="2000-01-01"></lr-date-input>`
    )) as LyraDateInput;

    el.setAttribute("disable-past", "");
    expect(el.internals.validity.rangeUnderflow).to.be.true;

    el.removeAttribute("disable-past");
    el.value = "2999-01-01";
    el.disableFuture = true;
    expect(el.internals.validity.rangeOverflow).to.be.true;

    el.disableFuture = false;
    expect(el.checkValidity()).to.be.true;
  });

  it("refreshes temporal validity when checkValidity crosses local midnight", async () => {
    const el = (await fixture(
      html`<lr-date-input value="2026-07-14" disable-past></lr-date-input>`
    )) as LyraDateInput;
    const clock = el as unknown as { now: () => Date };

    clock.now = () => new Date(2026, 6, 14, 23, 59);
    expect(el.checkValidity()).to.be.true;

    clock.now = () => new Date(2026, 6, 15, 0, 1);
    expect(el.checkValidity()).to.be.false;
    expect(el.internals.validity.rangeUnderflow).to.be.true;
  });

  it("refreshes temporal validity when the document becomes visible again", async () => {
    const el = (await fixture(
      html`<lr-date-input value="2026-07-14" disable-past></lr-date-input>`
    )) as LyraDateInput;
    const clock = el as unknown as { now: () => Date };

    clock.now = () => new Date(2026, 6, 14, 23, 59);
    expect(el.checkValidity()).to.be.true;
    clock.now = () => new Date(2026, 6, 15, 0, 1);

    el.ownerDocument.dispatchEvent(new Event("visibilitychange"));
    await el.updateComplete;
    expect(el.internals.validity.rangeUnderflow).to.be.true;
  });

  it("checks every range endpoint and can report underflow and overflow together", async () => {
    const el = (await fixture(html`
      <lr-date-input
        mode="range"
        value="2025-12-31/2027-01-01"
        min="2026-01-01"
        max="2026-12-31"
      ></lr-date-input>
    `)) as LyraDateInput;

    expect(el.internals.validity.rangeUnderflow).to.be.true;
    expect(el.internals.validity.rangeOverflow).to.be.true;
    expect(el.checkValidity()).to.be.false;
  });

  it("reports the explicit bound when it is stricter than a temporal bound", async () => {
    const year = new Date().getFullYear();
    // The bound is quoted the way the field displays dates (default en-US locale here).
    const shown = (iso: string) => {
      const [y, m, d] = iso.split("-").map(Number);
      return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "numeric", day: "numeric", calendar: "gregory" })
        .format(new Date(y!, m! - 1, d!));
    };
    const futureValue = `${year + 1}-01-01`;
    const futureMin = `${year + 2}-01-01`;
    const underflow = (await fixture(html`
      <lr-date-input
        disable-past
        value=${futureValue}
        min=${futureMin}
      ></lr-date-input>
    `)) as LyraDateInput;
    expect(underflow.internals.validity.rangeUnderflow).to.be.true;
    expect(underflow.internals.validationMessage).to.contain(shown(futureMin));

    const pastValue = `${year - 1}-01-01`;
    const pastMax = `${year - 2}-01-01`;
    const overflow = (await fixture(html`
      <lr-date-input
        disable-future
        value=${pastValue}
        max=${pastMax}
      ></lr-date-input>
    `)) as LyraDateInput;
    expect(overflow.internals.validity.rangeOverflow).to.be.true;
    expect(overflow.internals.validationMessage).to.contain(shown(pastMax));
  });

  it("sanitizes calendar-invalid declarative, IDL, and restored values to empty", async () => {
    const form = (await fixture(html`
      <form><lr-date-input name="d" value="2026-02-30"></lr-date-input></form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-date-input") as LyraDateInput;

    expect(el.value).to.equal("");
    expect(new FormData(form).get("d")).to.equal("");

    el.value = "not-an-iso-date";
    expect(el.value).to.equal("");
    expect(el.checkValidity()).to.be.true;

    el.required = true;
    el.value = "still-not-an-iso-date";
    expect(el.internals.validity.valueMissing).to.be.true;
    expect(el.internals.validity.badInput).to.be.false;

    (
      el as unknown as { formStateRestoreCallback(state: string): void }
    ).formStateRestoreCallback("2026-13-01");
    expect(el.value).to.equal("");
  });

  it("revalidates restored and reset values against the current constraints", async () => {
    const form = (await fixture(html`
      <form>
        <lr-date-input
          name="d"
          value="2026-07-15"
          max="2026-12-31"
        ></lr-date-input>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-date-input") as LyraDateInput;

    (
      el as unknown as { formStateRestoreCallback(state: string): void }
    ).formStateRestoreCallback("2027-01-01");
    expect(el.value).to.equal("2027-01-01");
    expect(el.internals.validity.rangeOverflow).to.be.true;

    el.max = "2026-06-30";
    form.reset();
    expect(el.value).to.equal("2026-07-15");
    expect(el.internals.validity.rangeOverflow).to.be.true;
  });

  it("bars required and bound validation while readonly, then restores it synchronously", async () => {
    const empty = (await fixture(
      html`<lr-date-input required></lr-date-input>`
    )) as LyraDateInput;
    expect(empty.checkValidity()).to.be.false;

    empty.readonly = true;
    expect(empty.checkValidity()).to.be.true;
    expect(empty.internals.willValidate).to.be.false;

    empty.readonly = false;
    expect(empty.internals.willValidate).to.be.true;
    expect(empty.internals.validity.valueMissing).to.be.true;

    const bounded = (await fixture(
      html`<lr-date-input value="2027-01-01" max="2026-12-31"></lr-date-input>`
    )) as LyraDateInput;
    expect(bounded.internals.validity.rangeOverflow).to.be.true;
    bounded.readonly = true;
    expect(bounded.checkValidity()).to.be.true;
  });

  it("revalidates the committed ISO shape when mode changes", async () => {
    const el = (await fixture(
      html`<lr-date-input value="2026-07-15"></lr-date-input>`
    )) as LyraDateInput;

    // A single-part value is a valid, incomplete range selection once in
    // range mode -- the same shape the picker's first range click commits --
    // not a malformed one.
    el.mode = "range";
    expect(el.internals.validity.badInput).to.be.false;
    expect(el.checkValidity()).to.be.true;

    // A two-part value genuinely is invalid back in single mode, and mode
    // changes must still revalidate to catch that.
    el.value = "2026-07-01/2026-07-15";
    el.mode = "single";
    expect(el.internals.validity.badInput).to.be.true;

    el.mode = "range";
    expect(el.checkValidity()).to.be.true;
  });

  it("normalizes a reversed programmatic range into canonical order", async () => {
    const el = (await fixture(
      html`<lr-date-input mode="range"></lr-date-input>`
    )) as LyraDateInput;

    el.value = "2026-07-20/2026-07-10";
    expect(el.value).to.equal("2026-07-10/2026-07-20");
    expect(el.checkValidity()).to.be.true;
  });

  it("preserves typed badInput across constraint changes and clears it on a committed value", async () => {
    const el = (await fixture(
      html`<lr-date-input value="2026-07-15"></lr-date-input>`
    )) as LyraDateInput;
    const input = el.shadowRoot!.querySelector(
      '[part="input"]'
    ) as HTMLInputElement;

    input.value = "not a date";
    input.dispatchEvent(new Event("change"));
    expect(el.internals.validity.badInput).to.be.true;

    el.max = "2026-12-31";
    expect(el.internals.validity.badInput).to.be.true;

    el.value = "2026-08-01";
    expect(el.checkValidity()).to.be.true;
    expect(el.internals.validity.badInput).to.be.false;
  });

  it("refreshes touched invalid styling after a constraint-only change", async () => {
    const el = (await fixture(
      html`<lr-date-input value="2026-07-15"></lr-date-input>`
    )) as LyraDateInput;
    const input = el.shadowRoot!.querySelector(
      '[part="input"]'
    ) as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("blur"));
    await el.updateComplete;
    expect(el.hasAttribute("data-invalid")).to.be.false;

    el.max = "2026-06-30";
    await el.updateComplete;
    expect(el.hasAttribute("data-invalid")).to.be.true;

    el.max = "";
    await el.updateComplete;
    expect(el.hasAttribute("data-invalid")).to.be.false;
  });

  it("refreshes touched invalid styling after a typed parse failure", async () => {
    const el = (await fixture(
      html`<lr-date-input value="2026-07-15"></lr-date-input>`
    )) as LyraDateInput;
    const input = el.shadowRoot!.querySelector(
      '[part="input"]'
    ) as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("blur"));
    await el.updateComplete;
    expect(el.hasAttribute("data-invalid")).to.be.false;

    input.value = "not a date";
    input.dispatchEvent(new Event("change"));
    await el.updateComplete;
    expect(el.hasAttribute("data-invalid")).to.be.true;
  });
});

it("restores the constructed value (not blank) on form.reset()", async () => {
  const form = (await fixture(html`
    <form><lr-date-input name="d" value="2026-07-15"></lr-date-input></form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-date-input") as LyraDateInput;
  el.value = "2026-08-01";
  form.reset();
  expect(el.value).to.equal("2026-07-15");
});

it("does not let a typed-in value become the reset default when there is no `value` attribute", async () => {
  // Regression test: previously the *first* assignment to `.value` after
  // construction — even a user's own first edit of a blank required field —
  // silently became the permanent reset default.
  const form = (await fixture(
    html`<form><lr-date-input name="d"></lr-date-input></form>`
  )) as HTMLFormElement;
  const el = form.querySelector("lr-date-input") as LyraDateInput;
  el.value = "first-user-edit";
  el.value = "second-user-edit";
  form.reset();
  expect(el.value).to.equal("");
});

it("reflects an invalid state only after the field has been interacted with once", async () => {
  const el = (await fixture(
    html`<lr-date-input required></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  expect(el.hasAttribute("data-invalid")).to.be.false;

  const input = el.shadowRoot!.querySelector(
    '[part="input"]'
  ) as HTMLInputElement;
  input.dispatchEvent(new FocusEvent("focus"));
  input.dispatchEvent(new FocusEvent("blur"));
  await el.updateComplete;
  expect(el.hasAttribute("data-invalid")).to.be.true;
});

it("normalizes invalid calendar count and weekday format attributes before propagation", async () => {
  const el = (await fixture(
    html`<lr-date-input months="999" weekday-format="bogus"></lr-date-input>`
  )) as LyraDateInput;
  await el.show();
  const picker = el.shadowRoot!.querySelector(
    "lr-date-picker"
  ) as LyraDatePicker;
  await picker.updateComplete;

  expect(el.months).to.equal(2);
  expect(el.weekdayFormat).to.equal("short");
  expect(picker.months).to.equal(2);
  expect(picker.weekdayFormat).to.equal("short");
  expect(picker.shadowRoot!.querySelectorAll('[part="month"]')).to.have.length(
    2
  );
});

it("tears down an open popover when disabled, fieldset-disabled, or made readonly", async () => {
  const form = (await fixture(html`
    <form>
      <fieldset><lr-date-input value="2026-01-01"></lr-date-input></fieldset>
    </form>
  `)) as HTMLFormElement;
  const fieldset = form.querySelector("fieldset") as HTMLFieldSetElement;
  const el = form.querySelector("lr-date-input") as LyraDateInput;
  const cleanupState = el as unknown as { cleanupFn?: () => void };
  let hides = 0;
  el.addEventListener("lr-hide", () => hides++);

  el.show();
  await el.updateComplete;
  expect(cleanupState.cleanupFn).to.be.a("function");
  el.disabled = true;
  await el.updateComplete;
  expect(el.open, "own disabled state closes the popup").to.be.false;
  expect(cleanupState.cleanupFn).to.equal(undefined);

  el.disabled = false;
  el.show();
  await el.updateComplete;
  fieldset.disabled = true;
  await el.updateComplete;
  expect(el.open, "fieldset-disabled state closes the popup").to.be.false;
  expect(cleanupState.cleanupFn).to.equal(undefined);

  fieldset.disabled = false;
  el.show();
  await el.updateComplete;
  el.readonly = true;
  await el.updateComplete;
  expect(el.open, "readonly closes the popup").to.be.false;
  expect(cleanupState.cleanupFn).to.equal(undefined);
  expect(hides).to.equal(3);
  expect(
    el
      .shadowRoot!.querySelector('[part="expand-button"]')!
      .getAttribute("aria-expanded")
  ).to.equal("false");
});

it("closes on disable, fieldset disable, and readonly even when an lr-hide listener vetoes", async () => {
  const form = (await fixture(html`
    <form>
      <fieldset><lr-date-input value="2026-01-01"></lr-date-input></fieldset>
    </form>
  `)) as HTMLFormElement;
  const fieldset = form.querySelector("fieldset") as HTMLFieldSetElement;
  const el = form.querySelector("lr-date-input") as LyraDateInput;
  const cancelable: boolean[] = [];
  el.addEventListener("lr-hide", (event) => {
    cancelable.push(event.cancelable);
    event.preventDefault();
  });
  const results: string[] = [];
  for (const [label, close, restore] of [
    ["disabled", () => (el.disabled = true), () => (el.disabled = false)],
    ["fieldset", () => (fieldset.disabled = true), () => (fieldset.disabled = false)],
    ["readonly", () => (el.readonly = true), () => (el.readonly = false)],
  ] as const) {
    await el.show();
    close();
    await el.updateComplete;
    results.push(`${label}: open=${el.open}`);
    restore();
    await el.updateComplete;
  }
  expect(results).to.deep.equal(["disabled: open=false", "fieldset: open=false", "readonly: open=false"]);
  expect(cancelable, "a close forced by policy cannot be vetoed").to.deep.equal([false, false, false]);

  await el.show();
  await el.hide();
  expect(el.open, "an ordinary close stays vetoable").to.equal(true);
});

it("reveals invalid state after validation and clears touched presentation on form reset", async () => {
  const form = (await fixture(html`
    <form><lr-date-input name="date" required></lr-date-input></form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-date-input") as LyraDateInput;
  const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;

  expect(input.getAttribute("aria-invalid")).to.equal("false");
  expect(form.reportValidity()).to.be.false;
  await el.updateComplete;
  expect(input.getAttribute("aria-invalid")).to.equal("true");

  form.reset();
  await el.updateComplete;
  expect(input.getAttribute("aria-invalid")).to.equal("false");
});

it("forwards custom bad-input validity to the inner input after it is touched", async () => {
  const el = (await fixture(
    html`<lr-date-input></lr-date-input>`
  )) as LyraDateInput;
  const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;

  input.value = "not a date";
  input.dispatchEvent(new Event("change"));
  input.dispatchEvent(new FocusEvent("blur"));
  await el.updateComplete;

  expect(el.internals.validity.badInput).to.be.true;
  expect(input.getAttribute("aria-invalid")).to.equal("true");
});

describe("native-wrapper focus/selection/editing surface", () => {
  it("exposes the internal date text input via a public getter", async () => {
    const el = (await fixture(
      html`<lr-date-input></lr-date-input>`
    )) as LyraDateInput;
    await el.updateComplete;
    expect(
      el.input === el.shadowRoot!.querySelector('[part="input"]')
    ).to.equal(true);
  });

  it("focus()/blur() delegate to the internal input instead of the host", async () => {
    const el = (await fixture(
      html`<lr-date-input></lr-date-input>`
    )) as LyraDateInput;
    await el.updateComplete;
    el.focus();
    expect(el.shadowRoot!.activeElement === el.input).to.equal(true);
    el.blur();
    expect(el.shadowRoot!.activeElement === null).to.equal(true);
  });

  it("select() and the selectionStart/selectionEnd accessors operate on the internal input", async () => {
    const el = (await fixture(
      html`<lr-date-input value="2026-07-15"></lr-date-input>`
    )) as LyraDateInput;
    await el.updateComplete;
    el.focus();
    el.select();
    expect(el.selectionStart).to.equal(0);
    expect(el.selectionEnd).to.equal(el.input!.value.length);

    el.setSelectionRange(1, 3);
    expect(el.selectionStart).to.equal(1);
    expect(el.selectionEnd).to.equal(3);
  });

  it("setRangeText() edits the field and re-parses it into a new value, keeping value/validity in sync", async () => {
    const el = (await fixture(
      html`<lr-date-input value="2026-07-15"></lr-date-input>`
    )) as LyraDateInput;
    await el.updateComplete;
    const displayed = el.input!.value; // e.g. "7/15/2026" under en-US
    const isoOfNext = new Date(2026, 6, 20);
    const replacement = displayed.replace("15", "20");

    el.setRangeText(replacement, 0, displayed.length);
    expect(
      el.value,
      "setRangeText should commit a parseable edit as the new value"
    ).to.equal("2026-07-20");
    expect(el.input!.value).to.equal(isoOfNext.toLocaleDateString());
  });

  it("setRangeText() reverts to the last committed display text and flags badInput for an unparseable edit", async () => {
    const el = (await fixture(
      html`<lr-date-input value="2026-07-15"></lr-date-input>`
    )) as LyraDateInput;
    await el.updateComplete;
    const committedDisplay = el.input!.value;

    el.setRangeText("not a date", 0, committedDisplay.length);
    expect(
      el.value,
      "an unparseable programmatic edit must not overwrite the committed value"
    ).to.equal("2026-07-15");
    expect(el.input!.value).to.equal(committedDisplay);
    expect(el.internals.validity.badInput).to.be.true;
  });
});

it("does not track a focus-restore target when nothing was focused when the popup opened", async () => {
  const el = (await fixture(
    html`<lr-date-input></lr-date-input>`
  )) as LyraDateInput;
  Object.defineProperty(document, "activeElement", {
    get: () => null,
    configurable: true,
  });
  try {
    el.show();
    await el.updateComplete;
    expect(el.open).to.be.true;
  } finally {
    delete (document as unknown as { activeElement?: unknown }).activeElement;
  }
});

describe("range-text edge cases", () => {
  // These three are rejected (unparseable) inputs -- applyTypedText() only emits
  // input/change when a value actually commits, so a rejected parse fires neither
  // event; awaiting oneEvent() here would hang forever. Dispatch synchronously
  // (matching the existing "reverts an unparseable typed date" test above) instead.
  it("rejects a raw ISO range containing a calendar-invalid date", async () => {
    const el = (await fixture(
      html`<lr-date-input mode="range"></lr-date-input>`
    )) as LyraDateInput;
    const input = el.shadowRoot!.querySelector(
      '[part="input"]'
    ) as HTMLInputElement;
    input.value = "2026-02-30/2026-07-15";
    input.dispatchEvent(new Event("change"));
    await el.updateComplete;
    expect(el.value).to.equal("");
    expect(el.internals.validity.badInput).to.be.true;
  });

  it("rejects a single date (no range separator) typed while in range mode", async () => {
    const el = (await fixture(
      html`<lr-date-input mode="range"></lr-date-input>`
    )) as LyraDateInput;
    const input = el.shadowRoot!.querySelector(
      '[part="input"]'
    ) as HTMLInputElement;
    input.value = "2026-07-15";
    input.dispatchEvent(new Event("change"));
    await el.updateComplete;
    expect(el.value).to.equal("");
    expect(el.internals.validity.badInput).to.be.true;
  });

  it("rejects a separator-joined range where one side fails to parse", async () => {
    const el = (await fixture(
      html`<lr-date-input mode="range"></lr-date-input>`
    )) as LyraDateInput;
    const input = el.shadowRoot!.querySelector(
      '[part="input"]'
    ) as HTMLInputElement;
    input.value = "not a date – 2026-07-15";
    input.dispatchEvent(new Event("change"));
    await el.updateComplete;
    expect(el.value).to.equal("");
    expect(el.internals.validity.badInput).to.be.true;
  });

  it("normalizes a reversed range typed using the displayed en-dash separator format", async () => {
    const el = (await fixture(
      html`<lr-date-input mode="range"></lr-date-input>`
    )) as LyraDateInput;
    const input = el.shadowRoot!.querySelector(
      '[part="input"]'
    ) as HTMLInputElement;
    input.value = "July 20, 2026 – July 10, 2026"; // reversed, human-readable -> the separator branch
    input.dispatchEvent(new Event("change"));
    expect(el.value).to.equal("2026-07-10/2026-07-20");
  });
});

it("formStateRestoreCallback clears the value for a non-string restored state", async () => {
  const el = (await fixture(
    html`<lr-date-input value="2026-07-15"></lr-date-input>`
  )) as LyraDateInput;
  (
    el as unknown as { formStateRestoreCallback(state: FormData | null): void }
  ).formStateRestoreCallback(new FormData());
  expect(el.value).to.equal("");
});

describe("lr-date-input implicit form submission", () => {
  const field = (el: LyraDateInput): HTMLInputElement =>
    el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
  const enterOn = (el: LyraDateInput, init: KeyboardEventInit = {}) =>
    dispatchEnterKeyAndSettle(field(el), init);

  it("submits the ancestor form when Enter is pressed in the date field", async () => {
    const form = (await fixture(html`
      <form>
        <lr-date-input name="when" value="2026-07-15"></lr-date-input>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-date-input") as LyraDateInput;
    await el.updateComplete;
    let submits = 0;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      submits += 1;
    });
    await enterOn(el);
    expect(submits).to.equal(1);
  });

  it("commits typed text before submitting, so the form carries what the user typed", async () => {
    const form = (await fixture(html`
      <form><lr-date-input name="when"></lr-date-input></form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-date-input") as LyraDateInput;
    await el.updateComplete;
    let submittedValue: string | null = null;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      submittedValue = new FormData(form).get("when") as string | null;
    });
    field(el).value = "2026-07-15";
    await enterOn(el);
    expect(el.value, "the typed text committed").to.equal("2026-07-15");
    expect(
      submittedValue,
      "the submitted entry is the freshly typed date"
    ).to.equal("2026-07-15");
  });

  it("emits input/change exactly once for an Enter commit, even when a native change follows", async () => {
    const el = (await fixture(
      html`<lr-date-input name="when"></lr-date-input>`
    )) as LyraDateInput;
    await el.updateComplete;
    let changes = 0;
    let inputs = 0;
    el.addEventListener("change", () => {
      changes += 1;
    });
    el.addEventListener("input", () => {
      inputs += 1;
    });
    field(el).value = "2026-07-15";
    await enterOn(el);
    // A real browser fires the native `change` for the same keystroke, right after the keydown.
    field(el).dispatchEvent(new Event("change", { bubbles: true }));
    expect(changes, "one change for one commit").to.equal(1);
    expect(inputs, "one input for one commit").to.equal(1);

    // ...and again after the re-render has replaced the typed text with the formatted display
    // text: blurring then fires a native `change` carrying that reformatted string, which is the
    // same commit wearing different clothes.
    await el.updateComplete;
    field(el).dispatchEvent(new Event("change", { bubbles: true }));
    expect(
      changes,
      "the reformatted follow-up change is still the same commit"
    ).to.equal(1);
    expect(inputs).to.equal(1);
  });

  it("still commits a genuinely new value typed after an Enter commit", async () => {
    const el = (await fixture(
      html`<lr-date-input name="when"></lr-date-input>`
    )) as LyraDateInput;
    await el.updateComplete;
    let changes = 0;
    el.addEventListener("change", () => {
      changes += 1;
    });
    field(el).value = "2026-07-15";
    await enterOn(el);
    await el.updateComplete;

    field(el).value = "2026-08-01";
    field(el).dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "1",
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
    field(el).dispatchEvent(new Event("change", { bubbles: true }));
    expect(el.value, "the new date committed").to.equal("2026-08-01");
    expect(changes, "two distinct commits emit two change events").to.equal(2);
  });

  it("does not re-emit change when focus leaves after an Enter commit", async () => {
    // Enter, then Tab away without typing: the keystroke that moves focus must not re-open the
    // commit path, and the blur `change` the browser fires carries the reformatted display text.
    const el = (await fixture(
      html`<lr-date-input name="when"></lr-date-input>`
    )) as LyraDateInput;
    await el.updateComplete;
    let changes = 0;
    el.addEventListener("change", () => {
      changes += 1;
    });
    field(el).value = "2026-07-15";
    await enterOn(el);
    await el.updateComplete;

    field(el).dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
    field(el).dispatchEvent(new Event("change", { bubbles: true }));
    expect(changes, "one commit, one change").to.equal(1);
    expect(el.value).to.equal("2026-07-15");
  });

  it("submits through an lr-button submitter, which requestSubmit() itself would reject", async () => {
    const form = (await fixture(html`
      <form>
        <lr-date-input name="when" value="2026-07-15"></lr-date-input>
        <lr-button type="submit" name="action" value="save">Go</lr-button>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-date-input") as LyraDateInput;
    await el.updateComplete;
    let submits = 0;
    let submitterName = "";
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      submits += 1;
      submitterName =
        ((e as SubmitEvent).submitter as HTMLButtonElement | null)?.name ?? "";
    });
    await enterOn(el);
    expect(submits).to.equal(1);
    expect(submitterName, "the lr-button was the submitter").to.equal("action");
  });

  it("never submits while readonly, on a held modifier, during IME composition, or after a veto", async () => {
    const form = (await fixture(html`
      <form>
        <lr-date-input name="when" value="2026-07-15"></lr-date-input>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-date-input") as LyraDateInput;
    await el.updateComplete;
    let submits = 0;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      submits += 1;
    });
    await enterOn(el, { shiftKey: true });
    await enterOn(el, { ctrlKey: true });
    await enterOn(el, { altKey: true });
    await enterOn(el, { metaKey: true });
    await enterOn(el, { isComposing: true });
    expect(submits).to.equal(0);

    // Capture on the host runs before the internal input's own listener.
    const veto = (e: Event): void => e.preventDefault();
    el.addEventListener("keydown", veto, true);
    await enterOn(el);
    el.removeEventListener("keydown", veto, true);
    expect(submits).to.equal(0);

    el.readonly = true;
    await el.updateComplete;
    await enterOn(el);
    expect(submits, "a readonly field never submits").to.equal(0);

    el.readonly = false;
    await el.updateComplete;
    await enterOn(el);
    expect(submits, "a bare Enter still submits").to.equal(1);
  });
});

describe("lr-date-input Enter commit after another write", () => {
  const field = (el: LyraDateInput): HTMLInputElement =>
    el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
  const enterOn = (el: LyraDateInput) =>
    dispatchEnterKeyAndSettle(field(el));

  it("shows the reset value when the submit handler resets the form, then commits the same date typed again", async () => {
    const form = (await fixture(html`
      <form><lr-date-input name="when"></lr-date-input></form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-date-input") as LyraDateInput;
    await el.updateComplete;
    let submits = 0;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submits += 1;
      form.reset();
    });
    const input = field(el);
    await focusByKeyboard(input);
    await sendKeys({ type: "7/15/2026" });
    await sendKeys({ press: "Enter" });
    await el.updateComplete;
    expect(submits).to.equal(1);
    expect(el.value, "the reset wins over the committed date").to.equal("");
    expect(input.value, "the field shows the reset value, not the stale typed text").to.equal("");

    await sendKeys({ type: "7/15/2026" });
    await sendKeys({ press: "Tab" });
    await el.updateComplete;
    expect(el.value, "the retyped date commits on blur").to.equal("2026-07-15");
  });

  it("commits text that matches an earlier Enter commit after a programmatic write replaced it", async () => {
    const el = (await fixture(html`<lr-date-input></lr-date-input>`)) as LyraDateInput;
    await el.updateComplete;
    let changes = 0;
    el.addEventListener("change", () => {
      changes += 1;
    });
    field(el).value = "2026-07-15";
    await enterOn(el);
    await el.updateComplete;
    el.value = "2026-08-01";
    await el.updateComplete;

    field(el).value = "2026-07-15";
    field(el).dispatchEvent(new Event("change", { bubbles: true }));
    expect(el.value).to.equal("2026-07-15");
    expect(changes).to.equal(2);
  });

  it("discards uncommitted typed text on form reset even when the value is unchanged", async () => {
    const form = (await fixture(html`
      <form><lr-date-input name="when" value="2026-07-15"></lr-date-input></form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-date-input") as LyraDateInput;
    await el.updateComplete;
    field(el).value = "7/20";
    form.reset();
    expect(el.value).to.equal("2026-07-15");
    expect(field(el).value).to.equal("7/15/2026");
  });

  it("commits text that matches an earlier Enter commit after a form reset", async () => {
    const form = (await fixture(html`
      <form><lr-date-input name="when"></lr-date-input></form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-date-input") as LyraDateInput;
    await el.updateComplete;
    form.addEventListener("submit", (event) => event.preventDefault());
    field(el).value = "2026-07-15";
    await enterOn(el);
    await el.updateComplete;
    form.reset();
    await el.updateComplete;

    field(el).value = "2026-07-15";
    field(el).dispatchEvent(new Event("change", { bubbles: true }));
    expect(el.value).to.equal("2026-07-15");
  });
});

// disabled required field kept `valueMissing` raised and `:state(invalid)` published.
describe("lr-date-input barred from constraint validation", () => {
  it("reports no violation while disabled, and restores it on re-enable", async () => {
    const el = (await fixture(
      html`<lr-date-input required disabled></lr-date-input>`
    )) as LyraDateInput;
    await el.updateComplete;
    expect(el.validity.valueMissing, "valueMissing while disabled").to.be.false;
    expect(el.validationMessage, "no message while disabled").to.equal("");

    el.disabled = false;
    await el.updateComplete;
    expect(el.validity.valueMissing, "valueMissing once enabled").to.be.true;
  });

  it("reports no range violation while disabled", async () => {
    const el = (await fixture(
      html`<lr-date-input
        value="2026-07-15"
        min="2026-08-01"
        disabled
      ></lr-date-input>`
    )) as LyraDateInput;
    await el.updateComplete;
    expect(el.validity.rangeUnderflow, "rangeUnderflow while disabled").to.be
      .false;
    expect(el.validity.valid, "valid while disabled").to.be.true;
  });

  it("reports no violation inside a disabled fieldset", async () => {
    const form = (await fixture(html`
      <form>
        <fieldset disabled><lr-date-input required></lr-date-input></fieldset>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-date-input") as LyraDateInput;
    await el.updateComplete;
    expect(el.validity.valueMissing, "valueMissing inside a disabled fieldset")
      .to.be.false;
    expect(el.checkValidity(), "checkValidity() inside a disabled fieldset").to
      .be.true;
  });

  it("still reports no violation while readonly", async () => {
    const el = (await fixture(
      html`<lr-date-input required readonly></lr-date-input>`
    )) as LyraDateInput;
    await el.updateComplete;
    expect(el.validity.valueMissing, "valueMissing while readonly").to.be.false;
  });
});

it("normalizes an invalid placement attribute to bottom-start", async () => {
  const el = (await fixture(
    html`<lr-date-input placement="nonsense"></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  expect(el.placement).to.equal("bottom-start");
  expect(el.getAttribute("placement")).to.equal("bottom-start");
});

// the 1st).
describe('applied preset readback', () => {
  const PRESETS = [
    { label: 'Last 7 days', start: '2026-08-13', end: '2026-08-19' },
    { label: 'This month', start: '2026-08-01', end: '2026-08-31' },
  ];

  const picker = (el: LyraDateInput): LyraDatePicker =>
    el.shadowRoot!.querySelector<LyraDatePicker>('[part~="date-picker"]')!;

  async function openedInput(): Promise<LyraDateInput> {
    const el = (await fixture(
      html`<lr-date-input mode="range"></lr-date-input>`,
    )) as LyraDateInput;
    el.presets = PRESETS;
    el.open = true;
    await el.updateComplete;
    await picker(el).updateComplete;
    return el;
  }

  const presetButtons = (el: LyraDateInput): HTMLButtonElement[] =>
    Array.from(
      picker(el).shadowRoot!.querySelectorAll<HTMLButtonElement>(
        '[part~="preset-button"]',
      ),
    );

  it('reports which preset produced the value, inside the change handler', async () => {
    const el = await openedInput();
    let seen: string | undefined = 'unset';
    el.addEventListener('change', () => {
      seen = el.appliedPreset?.label;
    });

    presetButtons(el)[0]!.click();
    await el.updateComplete;

    expect(seen, 'readable from the handler the commit itself dispatched').to.equal(
      'Last 7 days',
    );
    expect(el.appliedPreset?.label, 'and still readable afterwards').to.equal(
      'Last 7 days',
    );
  });

  it('mirrors the caller-supplied preset itself, not a copy of it', async () => {
    const el = await openedInput();

    presetButtons(el)[1]!.click();
    await el.updateComplete;

    expect(el.appliedPreset).to.equal(PRESETS[1]);
  });

  it('round-trips a caller-supplied id through the nested picker onto appliedPreset', async () => {
    const el = (await fixture(
      html`<lr-date-input mode="range"></lr-date-input>`,
    )) as LyraDateInput;
    el.presets = [
      { label: 'Last 7 days', start: '2026-08-13', end: '2026-08-19', id: 'last-7-days' },
      { label: 'This month', start: '2026-08-01', end: '2026-08-31', id: 'this-month' },
    ];
    el.open = true;
    await el.updateComplete;
    await picker(el).updateComplete;

    presetButtons(el)[1]!.click();
    await el.updateComplete;

    expect(el.appliedPreset?.id).to.equal('this-month');
  });

  it('reports the preset inside the input handler that precedes the change', async () => {
    const el = await openedInput();
    let seen: string | undefined = 'unset';
    el.addEventListener('input', () => {
      seen = el.appliedPreset?.label;
    });

    presetButtons(el)[0]!.click();
    await el.updateComplete;

    expect(seen).to.equal('Last 7 days');
  });

  it('reports no preset before the popover has ever been opened', async () => {
    const el = (await fixture(
      html`<lr-date-input
        mode="range"
        value="2026-08-13/2026-08-19"
      ></lr-date-input>`,
    )) as LyraDateInput;
    el.presets = PRESETS;
    await el.updateComplete;

    expect(
      el.appliedPreset,
      'a value equal to a preset pair was still not produced by its button',
    ).to.equal(undefined);
  });

  it('clears the applied preset when a day is picked by hand', async () => {
    const el = await openedInput();
    presetButtons(el)[0]!.click();
    await el.updateComplete;
    el.open = true;
    await el.updateComplete;
    await picker(el).updateComplete;

    picker(el)
      .shadowRoot!.querySelector<HTMLElement>('[part~="day"]:not(:disabled)')!
      .click();
    await el.updateComplete;

    expect(
      el.appliedPreset,
      'a hand-picked range did not come from a preset',
    ).to.equal(undefined);
  });

  it('clears the applied preset when a new range is typed by hand', async () => {
    const el = await openedInput();
    presetButtons(el)[0]!.click();
    await el.updateComplete;

    const input = el.input!;
    input.value = '2026-09-01/2026-09-30';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await el.updateComplete;

    expect(el.value, 'the typed range committed').to.equal(
      '2026-09-01/2026-09-30',
    );
    expect(el.appliedPreset).to.equal(undefined);
  });

  it('clears the applied preset when clear() empties the field', async () => {
    const el = await openedInput();
    presetButtons(el)[0]!.click();
    await el.updateComplete;

    el.clear();
    await el.updateComplete;

    expect(el.appliedPreset, 'nothing is selected, so no preset is applied').to.equal(
      undefined,
    );
  });

  it('clears the applied preset when the owning form resets', async () => {
    const form = await fixture<HTMLFormElement>(
      html`<form><lr-date-input mode="range" name="period"></lr-date-input></form>`,
    );
    const el = form.querySelector<LyraDateInput>('lr-date-input')!;
    el.presets = PRESETS;
    el.open = true;
    await el.updateComplete;
    await picker(el).updateComplete;
    presetButtons(el)[0]!.click();
    await el.updateComplete;

    form.reset();
    await el.updateComplete;

    expect(el.appliedPreset).to.equal(undefined);
  });
});

it("formats the min/max bound in its range messages the way the field displays dates", async () => {
  const format = (locale: string, iso: string) => {
    const [year, month, day] = iso.split("-").map(Number);
    return new Intl.DateTimeFormat(locale, { year: "numeric", month: "numeric", day: "numeric", calendar: "gregory" })
      .format(new Date(year!, month! - 1, day!));
  };
  const messages: string[] = [];
  for (const [locale, attributes] of [
    ["fr", { min: "2026-01-15", value: "2026-01-01" }],
    ["ar-EG", { max: "2026-01-15", value: "2026-02-01" }],
  ] as const) {
    const el = (await fixture(html`<lr-date-input
      locale=${locale}
      min=${"min" in attributes ? attributes.min : ""}
      max=${"max" in attributes ? attributes.max : ""}
      value=${attributes.value}
    ></lr-date-input>`)) as LyraDateInput;
    await el.updateComplete;
    const bound = "min" in attributes ? attributes.min : attributes.max;
    messages.push(`${el.validationMessage.includes(format(locale, bound))} ${el.validationMessage.includes(bound)}`);
  }
  expect(messages, "localized bound shown, ISO bound absent").to.deep.equal(["true false", "true false"]);
});

it("judges disabled dates with the calendar's own rules, including its 10,000-entry cap", async () => {
  // 10,000 earlier dates fill the cap, so the 10,001st entry (the value) is not disabled.
  const disabled: string[] = [];
  const first = new Date(2000, 0, 1);
  for (let index = 0; index < 10_000; index += 1) {
    const day = new Date(first.getFullYear(), first.getMonth(), first.getDate() + index);
    disabled.push(`${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`);
  }
  disabled.push("2040-06-15");
  const el = (await fixture(html`<lr-date-input value="2040-06-15"></lr-date-input>`)) as LyraDateInput;
  el.disabledDates = disabled;
  await el.updateComplete;
  expect(el.checkValidity(), "past the cap the date is selectable, as in the calendar").to.equal(true);
  el.disabledDates = ["2040-06-15"];
  await el.updateComplete;
  expect(el.checkValidity(), "within the cap it is blocked").to.equal(false);
  el.disabledDaysOfWeek = "fri";
  el.disabledDates = [];
  await el.updateComplete;
  expect(el.checkValidity(), "2040-06-15 is a Friday").to.equal(false);
});
