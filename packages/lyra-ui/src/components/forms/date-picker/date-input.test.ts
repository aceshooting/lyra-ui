import { fixture, expect, oneEvent, html, waitUntil } from "@open-wc/testing";
import "./date-input.js";
import "../button/button.js";
import type { LyraDateInput } from "./date-input.js";
import type { LyraDatePicker } from "./date-picker.js";
import { styles } from "./date-input.styles.js";
import { resetMouse, sendMouse } from "../../../../test/wtr-mouse.js";

it("renders inherited action hover/pressed hooks while direct host values still win", async () => {
  const wrapper = await fixture(html`
    <div
      style="--lr-date-input-action-hover-color: rgb(1, 2, 3); --lr-date-input-action-hover-bg: rgb(4, 5, 6); --lr-date-input-action-hover-radius: 11px; --lr-date-input-action-active-color: rgb(7, 8, 9); --lr-date-input-action-active-bg: rgb(10, 11, 12); --lr-date-input-action-active-radius: 13px"
    >
      <lr-date-input with-clear value="2026-07-15"></lr-date-input>
    </div>
  `);
  const el = wrapper.querySelector("lr-date-input") as LyraDateInput;
  const action = el.shadowRoot!.querySelector(
    '[part="clear-button"]'
  ) as HTMLButtonElement;
  const rect = action.getBoundingClientRect();
  const position: [number, number] = [
    Math.round(rect.left + rect.width / 2),
    Math.round(rect.top + rect.height / 2),
  ];

  try {
    await sendMouse({ type: "move", position });
    await waitUntil(
      () => getComputedStyle(action).backgroundColor === "rgb(4, 5, 6)"
    );
    expect(getComputedStyle(action).color).to.equal("rgb(1, 2, 3)");
    expect(getComputedStyle(action).borderRadius).to.equal("11px");

    el.style.setProperty("--lr-date-input-action-hover-bg", "rgb(13, 14, 15)");
    await waitUntil(
      () => getComputedStyle(action).backgroundColor === "rgb(13, 14, 15)"
    );

    await sendMouse({ type: "down" });
    await waitUntil(
      () => getComputedStyle(action).backgroundColor === "rgb(10, 11, 12)"
    );
    expect(getComputedStyle(action).color).to.equal("rgb(7, 8, 9)");
    expect(getComputedStyle(action).borderRadius).to.equal("13px");

    el.style.setProperty("--lr-date-input-action-active-radius", "17px");
    await waitUntil(() => getComputedStyle(action).borderRadius === "17px");
  } finally {
    await sendMouse({ type: "up" });
    await resetMouse();
  }
});

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

it("parses typed input into an ISO value and emits change", async () => {
  const el = (await fixture(
    html`<lr-date-input></lr-date-input>`
  )) as LyraDateInput;
  const input = el.shadowRoot!.querySelector(
    '[part="input"]'
  ) as HTMLInputElement;
  input.value = "2026-07-15";
  setTimeout(() => input.dispatchEvent(new Event("change")));
  await oneEvent(el, "change");
  expect(el.value).to.equal("2026-07-15");
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

it("blocks stale text input/change handlers when capture disables the control in the same task", async () => {
  for (const authority of ["own", "fieldset"] as const) {
    for (const type of ["input", "change"] as const) {
      const form = await fixture<HTMLFormElement>(html`
        <form>
          <fieldset>
            <lr-date-input value="2026-07-15"></lr-date-input>
          </fieldset>
        </form>
      `);
      const fieldset = form.querySelector("fieldset") as HTMLFieldSetElement;
      const el = form.querySelector("lr-date-input") as LyraDateInput;
      const input = el.shadowRoot!.querySelector(
        '[part="input"]'
      ) as HTMLInputElement;
      let captures = 0;
      let bubbles = 0;
      el.addEventListener(
        type,
        () => {
          captures++;
          if (authority === "own") el.disabled = true;
          else fieldset.disabled = true;
        },
        { capture: true }
      );
      form.addEventListener(type, () => bubbles++);

      input.value = "2026-07-20";
      const source =
        type === "input"
          ? new InputEvent("input", {
              bubbles: true,
              composed: true,
              data: "0",
              inputType: "insertText",
            })
          : new Event("change", { bubbles: true, composed: true });
      input.dispatchEvent(source);

      expect(
        captures,
        `${authority} ${type}: only the captured source is visible`
      ).to.equal(1);
      expect(
        bubbles,
        `${authority} ${type}: no raw or relayed event escapes`
      ).to.equal(0);
      expect(el.value, `${authority} ${type}: committed value`).to.equal(
        "2026-07-15"
      );
      expect(
        (el as unknown as { inputRelayedSinceCommit: boolean })
          .inputRelayedSinceCommit,
        `${authority} ${type}: relay bookkeeping`
      ).to.be.false;
    }
  }
});

it("blocks stale picker input/change handlers when capture disables the control in the same task", async () => {
  for (const authority of ["own", "fieldset"] as const) {
    for (const type of ["input", "change"] as const) {
      const form = await fixture<HTMLFormElement>(html`
        <form>
          <fieldset>
            <lr-date-input value="2026-07-15" open></lr-date-input>
          </fieldset>
        </form>
      `);
      const fieldset = form.querySelector("fieldset") as HTMLFieldSetElement;
      const el = form.querySelector("lr-date-input") as LyraDateInput;
      const picker = el.shadowRoot!.querySelector(
        "lr-date-picker"
      ) as LyraDatePicker;
      await picker.updateComplete;
      let captures = 0;
      let bubbles = 0;
      const restoreFocusRequests: boolean[] = [];
      const originalHide = el.hide;
      el.hide = (restoreFocus = false): Promise<void> => {
        restoreFocusRequests.push(restoreFocus);
        return Promise.resolve();
      };
      el.addEventListener(
        type,
        () => {
          captures++;
          if (authority === "own") el.disabled = true;
          else fieldset.disabled = true;
        },
        { capture: true }
      );
      form.addEventListener(type, () => bubbles++);

      picker.value = "2026-07-20";
      const source =
        type === "input"
          ? new InputEvent("input", { bubbles: true, composed: true })
          : new Event("change", { bubbles: true, composed: true });
      picker.dispatchEvent(source);
      el.hide = originalHide;

      expect(
        captures,
        `${authority} picker ${type}: only the captured source is visible`
      ).to.equal(1);
      expect(
        bubbles,
        `${authority} picker ${type}: no raw or relayed event escapes`
      ).to.equal(0);
      expect(el.value, `${authority} picker ${type}: committed value`).to.equal(
        "2026-07-15"
      );
      expect(
        restoreFocusRequests.includes(true),
        `${authority} picker ${type}: the stale picker handler did not request a focus-restoring close`
      ).to.be.false;
      expect(
        el.open,
        `${authority} picker ${type}: disable-close calls were observed without closing`
      ).to.be.true;
    }
  }
});

it("reverts an unparseable typed date to the last committed display text and flags badInput", async () => {
  const el = (await fixture(
    html`<lr-date-input value="2026-07-15"></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector(
    '[part="input"]'
  ) as HTMLInputElement;
  const committedDisplay = input.value;

  input.value = "not a date";
  input.dispatchEvent(new Event("change"));
  await el.updateComplete;

  expect(el.value).to.equal("2026-07-15"); // committed value untouched
  expect(input.value).to.equal(committedDisplay); // reverted, not left showing garbage
  expect(el.checkValidity()).to.be.false;
  expect(el.internals.validity.badInput).to.be.true;
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

it("opens the calendar and commits a picked date", async () => {
  const el = (await fixture(
    html`<lr-date-input value="2026-07-15"></lr-date-input>`
  )) as LyraDateInput;
  el.show();
  await el.updateComplete;
  expect(el.open).to.be.true;

  const picker = el.shadowRoot!.querySelector("lr-date-picker")!;
  await (picker as unknown as LyraDateInput).updateComplete;
  const day = picker.shadowRoot!.querySelector(
    '[data-date="2026-07-22"]'
  ) as HTMLButtonElement;
  setTimeout(() => day.click());
  await oneEvent(el, "change");
  expect(el.value).to.equal("2026-07-22");
  expect(el.open).to.be.false; // single mode closes on pick
});

it('defaults to size "m" and reflects a non-default size attribute', async () => {
  const defaultEl = (await fixture(
    html`<lr-date-input></lr-date-input>`
  )) as LyraDateInput;
  expect(defaultEl.size).to.equal("m");
  expect(defaultEl.getAttribute("size")).to.equal("m");
  const el = (await fixture(
    html`<lr-date-input size="s"></lr-date-input>`
  )) as LyraDateInput;
  expect(el.size).to.equal("s");
  expect(el.getAttribute("size")).to.equal("s");
});

it('supports size="2xs": tighter rendered padding/font-size than the default m tier', async () => {
  const compact = (await fixture(
    html`<lr-date-input size="2xs"></lr-date-input>`
  )) as LyraDateInput;
  const regular = (await fixture(
    html`<lr-date-input></lr-date-input>`
  )) as LyraDateInput;
  const compactWrapper = compact.shadowRoot!.querySelector(
    '[part="input-wrapper"]'
  ) as HTMLElement;
  const regularWrapper = regular.shadowRoot!.querySelector(
    '[part="input-wrapper"]'
  ) as HTMLElement;
  const compactInput = compact.shadowRoot!.querySelector(
    '[part="input"]'
  ) as HTMLElement;
  const regularInput = regular.shadowRoot!.querySelector(
    '[part="input"]'
  ) as HTMLElement;

  expect(
    Number.parseFloat(getComputedStyle(compactWrapper).paddingTop)
  ).to.be.lessThan(
    Number.parseFloat(getComputedStyle(regularWrapper).paddingTop)
  );
  expect(
    Number.parseFloat(getComputedStyle(compactInput).fontSize)
  ).to.be.lessThan(Number.parseFloat(getComputedStyle(regularInput).fontSize));
});

it("inherits the theme-wide form-control radius at a compact size tier", async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div style="--lr-theme-form-control-radius: 17px">
      <lr-date-input size="xs"></lr-date-input>
    </div>
  `);
  const el = wrapper.querySelector("lr-date-input") as LyraDateInput;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector(
    '[part="input-wrapper"]'
  ) as HTMLElement;
  expect(getComputedStyle(input).borderTopLeftRadius).to.equal("17px");
});

it("opens the calendar popover and commits a picked date at a non-default size, keeping the toggle buttons' touch target", async () => {
  // Exercises the popup/toggle at a non-default size tier: the field's own
  // padding/font-size shrink under size="s", but positioning, keyboard
  // interaction, and the accessible minimum hit area on the calendar-toggle
  // and clear buttons must all keep working exactly as at the default size.
  const el = (await fixture(
    html`<lr-date-input size="s" value="2026-07-15" with-clear></lr-date-input>`
  )) as LyraDateInput;
  expect(el.getAttribute("size")).to.equal("s");
  el.show();
  await el.updateComplete;
  expect(el.open).to.be.true;

  const picker = el.shadowRoot!.querySelector("lr-date-picker")!;
  await (picker as unknown as LyraDateInput).updateComplete;
  const day = picker.shadowRoot!.querySelector(
    '[data-date="2026-07-22"]'
  ) as HTMLButtonElement;
  setTimeout(() => day.click());
  await oneEvent(el, "change");
  expect(el.value).to.equal("2026-07-22");
  expect(el.open).to.be.false;

  const expandBtn = el.shadowRoot!.querySelector(
    '[part="expand-button"]'
  ) as HTMLElement;
  expect(expandBtn.getBoundingClientRect().height).to.be.greaterThan(24);
  expect(expandBtn.getBoundingClientRect().width).to.be.greaterThan(24);
  const clearBtn = el.shadowRoot!.querySelector(
    '[part="clear-button"]'
  ) as HTMLElement;
  expect(clearBtn.getBoundingClientRect().height).to.be.greaterThan(24);
  expect(clearBtn.getBoundingClientRect().width).to.be.greaterThan(24);
});

it('renders the unset default size identically to an explicit size="m"', async () => {
  const unset = (await fixture(
    html`<lr-date-input value="2026-07-15"></lr-date-input>`
  )) as LyraDateInput;
  const explicit = (await fixture(
    html`<lr-date-input size="m" value="2026-07-15"></lr-date-input>`
  )) as LyraDateInput;
  const unsetWrapper = unset.shadowRoot!.querySelector(
    '[part="input-wrapper"]'
  ) as HTMLElement;
  const explicitWrapper = explicit.shadowRoot!.querySelector(
    '[part="input-wrapper"]'
  ) as HTMLElement;
  expect(getComputedStyle(unsetWrapper).padding).to.equal(
    getComputedStyle(explicitWrapper).padding
  );
  const unsetInput = unset.shadowRoot!.querySelector(
    '[part="input"]'
  ) as HTMLElement;
  const explicitInput = explicit.shadowRoot!.querySelector(
    '[part="input"]'
  ) as HTMLElement;
  expect(getComputedStyle(unsetInput).fontSize).to.equal(
    getComputedStyle(explicitInput).fontSize
  );
});

it("fires exactly one input event per day pick, not two", async () => {
  // Regression test: the nested <lr-date-picker>'s own 'input' event
  // (LyraElement.emit always dispatches bubbles:true, composed:true) had no
  // listener wired on it in date-input's render(), so it bubbled straight
  // through the shadow boundary and fired a second, uncounted 'input' on
  // this host on top of onPickerChange's own explicit emit.
  const el = (await fixture(
    html`<lr-date-input value="2026-07-15"></lr-date-input>`
  )) as LyraDateInput;
  el.show();
  await el.updateComplete;
  const picker = el.shadowRoot!.querySelector("lr-date-picker")!;
  await (picker as unknown as LyraDateInput).updateComplete;

  let inputCount = 0;
  el.addEventListener("input", () => inputCount++);

  const day = picker.shadowRoot!.querySelector(
    '[data-date="2026-07-22"]'
  ) as HTMLButtonElement;
  setTimeout(() => day.click());
  await oneEvent(el, "change");
  expect(inputCount).to.equal(1);
});

it("fires exactly one input event per range click, and one change once the range completes", async () => {
  const el = (await fixture(
    html`<lr-date-input mode="range"></lr-date-input>`
  )) as LyraDateInput;
  el.show();
  await el.updateComplete;
  const picker = el.shadowRoot!.querySelector(
    "lr-date-picker"
  ) as LyraDatePicker;
  await picker.updateComplete;
  picker.goToDate("2026-07-01");
  await picker.updateComplete;

  let inputCount = 0;
  let changeCount = 0;
  el.addEventListener("input", () => inputCount++);
  el.addEventListener("change", () => changeCount++);

  (
    picker.shadowRoot!.querySelector(
      '[data-date="2026-07-05"]'
    ) as HTMLButtonElement
  ).click();
  await el.updateComplete;
  expect(
    inputCount,
    "the first click of a range should fire input once"
  ).to.equal(1);
  expect(changeCount).to.equal(0);

  setTimeout(() =>
    (
      picker.shadowRoot!.querySelector(
        '[data-date="2026-07-10"]'
      ) as HTMLButtonElement
    ).click()
  );
  await oneEvent(el, "change");
  expect(
    inputCount,
    "the second click of a range should fire input a second time, not a third"
  ).to.equal(2);
  expect(changeCount).to.equal(1);
});

it("does not flag badInput for the half-completed range value produced by the first click of a range pick", async () => {
  // Regression test: valueDates() required exactly 2 parts in range mode,
  // so the single-part value the picker commits after only the first click
  // of a range (a completely normal, transient state) tripped badInput
  // until the second click completed the pair.
  const el = (await fixture(
    html`<lr-date-input mode="range"></lr-date-input>`
  )) as LyraDateInput;
  el.show();
  await el.updateComplete;
  const picker = el.shadowRoot!.querySelector(
    "lr-date-picker"
  ) as LyraDatePicker;
  await picker.updateComplete;
  picker.goToDate("2026-07-01");
  await picker.updateComplete;

  (
    picker.shadowRoot!.querySelector(
      '[data-date="2026-07-05"]'
    ) as HTMLButtonElement
  ).click();
  await el.updateComplete;

  expect(el.value).to.equal("2026-07-05");
  expect(el.internals.validity.badInput).to.be.false;
  expect(el.checkValidity()).to.be.true;
});

it("flags a required half-completed range value as valueMissing, not badInput", async () => {
  const el = (await fixture(
    html`<lr-date-input mode="range" required></lr-date-input>`
  )) as LyraDateInput;
  el.value = "2026-07-05";

  expect(el.internals.validity.badInput).to.be.false;
  expect(el.internals.validity.valueMissing).to.be.true;
  expect(el.checkValidity()).to.be.false;

  el.value = "2026-07-05/2026-07-10";
  expect(el.internals.validity.valueMissing).to.be.false;
  expect(el.checkValidity()).to.be.true;
});

it("auto-closes the popover once a range selection is completed, not just in single mode", async () => {
  const el = (await fixture(
    html`<lr-date-input mode="range"></lr-date-input>`
  )) as LyraDateInput;
  el.show();
  await el.updateComplete;
  const picker = el.shadowRoot!.querySelector(
    "lr-date-picker"
  ) as LyraDatePicker;
  await picker.updateComplete;
  picker.goToDate("2026-07-01");
  await picker.updateComplete;

  (
    picker.shadowRoot!.querySelector(
      '[data-date="2026-07-05"]'
    ) as HTMLButtonElement
  ).click();
  await el.updateComplete;
  expect(el.open, "should stay open after the first click of a range").to.be
    .true;

  setTimeout(() =>
    (
      picker.shadowRoot!.querySelector(
        '[data-date="2026-07-10"]'
      ) as HTMLButtonElement
    ).click()
  );
  await oneEvent(el, "change");
  expect(el.open, "should close once the range selection is complete").to.be
    .false;
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

it("propagates disable-past/disable-future/with-outside-days to the nested lr-date-picker", async () => {
  const el = (await fixture(
    html`<lr-date-input
      disable-past
      disable-future
      with-outside-days
    ></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  const picker = el.shadowRoot!.querySelector(
    "lr-date-picker"
  ) as LyraDatePicker;
  await picker.updateComplete;
  expect(picker.disablePast).to.be.true;
  expect(picker.disableFuture).to.be.true;
  expect(picker.withOutsideDays).to.be.true;
});

it("links both popup-opening semantic owners to the dialog with explicit closed/open state", async () => {
  const el = (await fixture(
    html`<lr-date-input></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  const expandBtn = el.shadowRoot!.querySelector(
    '[part="expand-button"]'
  ) as HTMLElement;
  const input = el.shadowRoot!.querySelector(
    '[part="input"]'
  ) as HTMLInputElement;
  const popup = el.shadowRoot!.querySelector('[part="popup"]') as HTMLElement;
  expect(popup.id, "expected the popup to have an id").to.not.equal("");
  expect(expandBtn.getAttribute("aria-controls")).to.equal(popup.id);
  expect(input.getAttribute("role")).to.equal("combobox");
  expect(input.getAttribute("aria-controls")).to.equal(popup.id);
  expect(input.getAttribute("aria-haspopup")).to.equal("dialog");
  expect(input.getAttribute("aria-expanded")).to.equal("false");

  await el.show();
  await el.updateComplete;
  expect(input.getAttribute("aria-expanded")).to.equal("true");
});

it("shows a formatted display value", async () => {
  const el = (await fixture(
    html`<lr-date-input value="2026-07-15"></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector(
    '[part="input"]'
  ) as HTMLInputElement;
  expect(input.value).to.not.be.empty;
  expect(input.value).to.not.equal("2026-07-15"); // locale-formatted, not raw ISO
});

it("clears via the clear button", async () => {
  const el = (await fixture(
    html`<lr-date-input value="2026-07-15" with-clear></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  const clear = el.shadowRoot!.querySelector(
    '[part="clear-button"]'
  ) as HTMLButtonElement;
  setTimeout(() => clear.click());
  await oneEvent(el, "lr-clear");
  expect(el.value).to.equal("");
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

it("is accessible", async () => {
  const el = (await fixture(
    html`<lr-date-input label="Start date" value="2026-07-15"></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  await expect(el).to.be.accessible();
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
    expect(underflow.internals.validationMessage).to.contain(futureMin);

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
    expect(overflow.internals.validationMessage).to.contain(pastMax);
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

it("uses shared svg icons instead of literal glyphs for clear and calendar toggle", async () => {
  const el = (await fixture(
    html`<lr-date-input value="2026-07-15" with-clear></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;

  const clearBtn = el.shadowRoot!.querySelector(
    '[part="clear-button"]'
  ) as HTMLElement;
  expect(clearBtn.querySelector("svg") != null).to.equal(true);
  expect(clearBtn.textContent?.trim()).to.equal("");

  const expandIcon = el.shadowRoot!.querySelector(
    '[part="expand-icon"]'
  ) as HTMLElement;
  expect(expandIcon.querySelector("svg") != null).to.equal(true);
  expect(expandIcon.textContent?.trim()).to.equal("");
});

it("transitions the popup with the shared fast-transition token and respects reduced motion", () => {
  const css = styles.cssText;
  const popupBlock = /\[part=['"]?popup['"]?]\s*{([^}]*)}/.exec(css);
  expect(popupBlock, 'expected a base [part="popup"] rule').to.not.equal(null);
  expect(popupBlock![1]).to.include("var(--lr-transition-fast)");
  expect(css).to.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

it("gives the clear/expand buttons a real touch target instead of collapsing to bare glyph height", async () => {
  const css = styles.cssText;
  const btnBlock =
    /\[part=['"]?clear-button['"]?],\s*\[part=['"]?expand-button['"]?]\s*{([^}]*)}/.exec(
      css
    );
  expect(
    btnBlock,
    'expected a shared [part="clear-button"], [part="expand-button"] rule'
  ).to.not.equal(null);
  expect(btnBlock![1]).to.include("var(--lr-icon-button-size)");

  const el = (await fixture(
    html`<lr-date-input value="2026-07-15" with-clear></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  const expandBtn = el.shadowRoot!.querySelector(
    '[part="expand-button"]'
  ) as HTMLElement;
  expect(expandBtn.getBoundingClientRect().height).to.be.greaterThan(24);
  // WCAG 2.2 SC 2.5.8 requires a 24x24 CSS-px minimum target *in both
  // dimensions* — a tall-but-narrow button still fails it.
  expect(expandBtn.getBoundingClientRect().width).to.be.greaterThan(24);

  const clearBtn = el.shadowRoot!.querySelector(
    '[part="clear-button"]'
  ) as HTMLElement;
  expect(clearBtn.getBoundingClientRect().width).to.be.greaterThan(24);
});

it("hides the error and hint parts when empty, shows them once populated", async () => {
  const el = (await fixture(
    html`<lr-date-input></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;

  const errorPart = el.shadowRoot!.querySelector(
    '[part="error"]'
  ) as HTMLElement;
  const hintPart = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
  // Neither part can rely on `:empty` — each always contains a literal
  // `<slot>` child element, so `:empty` never matches regardless of
  // assigned/text content (same bug class fixed for lr-stat).
  expect(getComputedStyle(errorPart).display).to.equal("none");
  expect(getComputedStyle(hintPart).display).to.equal("none");

  el.errorText = "Invalid date";
  el.hint = "Use ISO format";
  await el.updateComplete;
  expect(getComputedStyle(errorPart).display).to.not.equal("none");
  expect(getComputedStyle(hintPart).display).to.not.equal("none");
});

it("renders errorText in var(--lr-color-danger), distinct from and alongside the hint", async () => {
  const el = (await fixture(
    html`<lr-date-input></lr-date-input>`
  )) as LyraDateInput;
  el.hint = "Use ISO format";
  el.errorText = "Invalid date";
  await el.updateComplete;

  const errorPart = el.shadowRoot!.querySelector(
    '[part="error"]'
  ) as HTMLElement;
  const hintPart = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
  expect(errorPart != null).to.equal(true);
  expect(errorPart.textContent).to.contain("Invalid date");
  expect(hintPart.textContent).to.contain("Use ISO format");
  expect(getComputedStyle(errorPart).color).to.not.equal(
    getComputedStyle(hintPart).color
  );
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

it("shows a required-field asterisk after the label", async () => {
  const el = (await fixture(
    html`<lr-date-input label="Start date" required></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector(
    '[part="form-control-label"]'
  ) as HTMLElement;
  const after = getComputedStyle(label, "::after");
  expect(after.content).to.contain("*");
});

it("does not render an orphaned asterisk when required but no label is provided", async () => {
  const el = (await fixture(
    html`<lr-date-input required></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;

  // The label box always contains a literal `<slot name="label">` child,
  // so `:empty` can never match it (same bug class already fixed for
  // hint/error) -- real emptiness must be tracked in JS and reflected via
  // `hidden`, or the required-asterisk `::after` (which attaches to this
  // box) renders a stray ' *' with nothing before it.
  const label = el.shadowRoot!.querySelector(
    '[part="form-control-label"]'
  ) as HTMLElement;
  expect(getComputedStyle(label).display).to.equal("none");
});

it("clamps the popup to the viewport width like the combobox listbox", () => {
  expect(styles.cssText).to.match(
    /max-inline-size:\s*min\(\s*var\(--lr-popover-viewport-clamp\),\s*var\(--lr-size-28rem\)\s*\)/
  );
});

it("propagates disabled/readonly to the nested lr-date-picker so its days actually stop being interactive", async () => {
  const el = (await fixture(
    html`<lr-date-input value="2026-07-15" disabled></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  const picker = el.shadowRoot!.querySelector(
    "lr-date-picker"
  ) as LyraDatePicker;
  await picker.updateComplete;
  expect(picker.disabled).to.be.true;

  el.disabled = false;
  el.readonly = true;
  await el.updateComplete;
  await picker.updateComplete;
  expect(picker.readonly).to.be.true;
});

it("shows a not-allowed cursor on the disabled input wrapper", async () => {
  const el = (await fixture(
    html`<lr-date-input disabled></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  const wrapper = el.shadowRoot!.querySelector(
    '[part="input-wrapper"]'
  ) as HTMLElement;
  expect(getComputedStyle(wrapper).cursor).to.equal("not-allowed");
});

it("pairs the form-control label with the date input via for/id so clicking the label focuses it", async () => {
  const el = (await fixture(
    html`<lr-date-input label="Start date" value="2026-07-15"></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector(
    '[part="form-control-label"]'
  ) as HTMLLabelElement;
  const input = el.shadowRoot!.querySelector(
    '[part="input"]'
  ) as HTMLInputElement;
  expect(label.htmlFor, "label should have a for attribute").to.not.equal("");
  expect(label.htmlFor).to.equal(input.id);
});

it("propagates locale, first-day-of-week and weekday-format to the nested lr-date-picker", async () => {
  const el = (await fixture(
    html`<lr-date-input
      locale="fr-FR"
      first-day-of-week="mon"
      weekday-format="narrow"
    ></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  const picker = el.shadowRoot!.querySelector(
    "lr-date-picker"
  ) as LyraDatePicker;
  await picker.updateComplete;
  expect(picker.locale).to.equal("fr-FR");
  expect(picker.firstDayOfWeek).to.equal("mon");
  expect(picker.weekdayFormat).to.equal("narrow");
});

it("normalizes invalid calendar count and weekday format attributes before propagation", async () => {
  const el = (await fixture(
    html`<lr-date-input months="999" weekday-format="bogus"></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
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

it("falls back to the default locale when a malformed locale is supplied", async () => {
  const el = (await fixture(
    html`<lr-date-input
      value="2026-07-15"
      locale="not_a_locale"
    ></lr-date-input>`
  )) as LyraDateInput;
  const input = el.shadowRoot!.querySelector(
    '[part="input"]'
  ) as HTMLInputElement;
  const picker = el.shadowRoot!.querySelector(
    "lr-date-picker"
  ) as LyraDatePicker;
  await picker.updateComplete;

  expect(input.value).to.equal(new Date(2026, 6, 15).toLocaleDateString());
  expect(
    picker.shadowRoot!.querySelectorAll('[part="weekday"]')
  ).to.have.length(7);
});

it("formats the displayed value using the locale property", async () => {
  const el = (await fixture(
    html`<lr-date-input value="2026-07-15" locale="fr-FR"></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector(
    '[part="input"]'
  ) as HTMLInputElement;
  expect(input.value).to.equal(
    new Date(2026, 6, 15).toLocaleDateString("fr-FR")
  );
});

it("round-trips its own localized Arabic digits and bidi marks as Gregorian ISO", async () => {
  const el = (await fixture(
    html`<lr-date-input value="2026-07-15" locale="ar-EG"></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector(
    '[part="input"]'
  ) as HTMLInputElement;
  const rendered = input.value;
  expect(rendered).to.match(/[٠-٩]/);
  el.value = "";
  await el.updateComplete;
  input.value = rendered;
  input.dispatchEvent(new Event("change"));
  expect(el.value).to.equal("2026-07-15");
});

it("uses locale formatRange and round-trips its Persian Gregorian range presentation", async () => {
  const el = (await fixture(
    html`<lr-date-input
      mode="range"
      value="2026-05-01/2026-05-15"
      locale="fa-IR"
    ></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector(
    '[part="input"]'
  ) as HTMLInputElement;
  const rendered = input.value;
  const expected = new Intl.DateTimeFormat("fa-IR", {
    calendar: "gregory",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatRange(new Date(2026, 4, 1), new Date(2026, 4, 15));
  expect(rendered).to.equal(expected);
  el.value = "";
  await el.updateComplete;
  input.value = rendered;
  input.dispatchEvent(new Event("change"));
  expect(el.value).to.equal("2026-05-01/2026-05-15");
});

it("derives the displayed value, the day/month/year parse order, and the nested picker locale from an inherited lang ancestor with no locale attribute set", async () => {
  // Regression test: displayText's formatter, localeDateOrder() (which
  // decides how an ambiguous typed date like "03/04/2026" is parsed), and the
  // `.locale=` binding forwarded to the nested <lr-date-picker> all used to
  // read the raw `locale` prop (default '') directly instead of
  // `effectiveLocale`, which also walks lang/locale ancestors -- so an
  // inherited <div lang="en-GB"> was silently ignored, both for display and
  // for day-first vs month-first parsing.
  const wrapper = await fixture(html`
    <div lang="en-GB"><lr-date-input value="2026-07-15"></lr-date-input></div>
  `);
  const el = wrapper.querySelector("lr-date-input") as LyraDateInput;
  await el.updateComplete;

  const input = el.shadowRoot!.querySelector(
    '[part="input"]'
  ) as HTMLInputElement;
  expect(input.value).to.equal(
    new Date(2026, 6, 15).toLocaleDateString("en-GB")
  );

  const picker = el.shadowRoot!.querySelector(
    "lr-date-picker"
  ) as LyraDatePicker;
  await picker.updateComplete;
  expect(picker.locale).to.equal("en-GB");

  // en-GB reads day/month/year, so "03/04/2026" is April 3rd, not March 4th.
  input.value = "03/04/2026";
  setTimeout(() => input.dispatchEvent(new Event("change")));
  await oneEvent(el, "change");
  expect(el.value).to.equal("2026-04-03");
});

it("applies the shared focus-ring tokens to the clear and expand buttons", () => {
  const css = styles.cssText;
  const focusBlock =
    /\[part=['"]?clear-button['"]?]:focus-visible,\s*\[part=['"]?expand-button['"]?]:focus-visible\s*{([^}]*)}/.exec(
      css
    );
  expect(
    focusBlock,
    "expected a shared clear/expand :focus-visible rule"
  ).to.not.equal(null);
  expect(focusBlock![1]).to.include("var(--lr-focus-ring-width)");
  expect(focusBlock![1]).to.include("var(--lr-focus-ring-color)");
});

it("round-trips a rendered range string typed back into the field", async () => {
  const el = (await fixture(
    html`<lr-date-input
      mode="range"
      value="2026-05-01/2026-05-15"
    ></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
  const rendered = input.value; // the actual locale-formatted range this component rendered
  expect(
    rendered,
    "expected the en-dash range separator in the rendered text"
  ).to.include(" – ");

  // Clear the committed value first so the assertion below can only pass if
  // parseRangeText actually recovers '2026-05-01/2026-05-15' from the typed
  // text -- a stale, never-reset `el.value` would otherwise make this pass
  // trivially even with completely broken parsing.
  el.value = "";
  await el.updateComplete;

  input.value = rendered; // re-type the exact displayed text
  input.dispatchEvent(new Event("change"));
  expect(el.value).to.equal("2026-05-01/2026-05-15");
});

it("also accepts a raw ISO range typed directly, as a convenience", async () => {
  const el = (await fixture(
    html`<lr-date-input mode="range"></lr-date-input>`
  )) as LyraDateInput;
  const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
  input.value = "2026-05-01/2026-05-15";
  input.dispatchEvent(new Event("change"));
  expect(el.value).to.equal("2026-05-01/2026-05-15");
});

it("retains a typed date outside min/max and reports rangeOverflow rather than badInput", async () => {
  const el = (await fixture(
    html`<lr-date-input min="2026-01-01" max="2026-12-31"></lr-date-input>`
  )) as LyraDateInput;
  const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
  input.value = "2027-01-01";
  input.dispatchEvent(new Event("change"));
  expect(el.value).to.equal("2027-01-01");
  expect(el.internals.validity.rangeOverflow).to.be.true;
  expect(el.internals.validity.badInput).to.be.false;
  expect(el.checkValidity()).to.be.false;
});

it("retains a typed date before disable-past's today floor and reports rangeUnderflow", async () => {
  const el = (await fixture(
    html`<lr-date-input disable-past></lr-date-input>`
  )) as LyraDateInput;
  const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
  input.value = "2000-01-01";
  input.dispatchEvent(new Event("change"));
  expect(el.value).to.equal("2000-01-01");
  expect(el.internals.validity.rangeUnderflow).to.be.true;
  expect(el.internals.validity.badInput).to.be.false;
  expect(el.checkValidity()).to.be.false;
});

it("keeps the clear button disabled while the control is disabled", async () => {
  const el = (await fixture(
    html`<lr-date-input disabled with-clear value="2026-01-01"></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  const clearBtn = el.shadowRoot!.querySelector(
    '[part="clear-button"]'
  ) as HTMLButtonElement | null;
  expect(clearBtn?.disabled).to.be.true;
});

it("keeps the clear button disabled while the control is readonly", async () => {
  const el = (await fixture(
    html`<lr-date-input readonly with-clear value="2026-01-01"></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  const clearBtn = el.shadowRoot!.querySelector(
    '[part="clear-button"]'
  ) as HTMLButtonElement | null;
  expect(clearBtn?.disabled).to.be.true;
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

it("re-binds positioning after a disconnect+reconnect while open", async () => {
  const el = (await fixture(
    html`<lr-date-input open></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  const parent = el.parentElement!;
  el.remove();
  parent.appendChild(el);
  await el.updateComplete;
  const popup = el.shadowRoot!.querySelector(
    '[part="popup"] [part="date-picker"]'
  )!;
  expect(popup != null).to.equal(true); // popup content still renders; positioning re-attached, not just left stale
});

it("resets `open` on disconnect so a later reconnect starts from a clean, re-bindable state", async () => {
  // Regression test: disconnectedCallback used to tear down the position
  // listener (cleanupFn) and the document pointerdown listener but never
  // reset `open` itself -- so `open` stayed stuck `true` across a
  // disconnect, and because `updated()` only rebinds positioning when
  // `open` *changes*, a reconnect while still nominally "open" would never
  // re-run `place()`.
  const el = (await fixture(
    html`<lr-date-input open></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  const parent = el.parentElement!;
  el.remove();
  expect(el.open, "disconnect should reset open").to.be.false;
  parent.appendChild(el);
});

it("does not override an explicit `label` slot with the fallback aria-label", async () => {
  const el = (await fixture(
    html`<lr-date-input><span slot="label">Start date</span></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
  expect(input.getAttribute("aria-label")).to.not.equal("Date");
});

it("wires aria-describedby to the visible hint/error text", async () => {
  const el = (await fixture(
    html`<lr-date-input
      hint="Pick a date"
      error-text="Required"
    ></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
  const describedBy = input.getAttribute("aria-describedby") ?? "";
  expect(describedBy).to.include("date-input-hint");
  expect(describedBy).to.include("date-input-error");
});

it("forwards its accessible name and required validity state to the inner input", async () => {
  const el = (await fixture(
    html`<lr-date-input
      aria-label="Departure date"
      label="Ignored label"
      required
    ></lr-date-input>`
  )) as LyraDateInput;
  const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;

  expect(input.getAttribute("aria-label")).to.equal("Departure date");
  expect(input.required).to.be.true;
  expect(input.getAttribute("aria-required")).to.equal("true");
  expect(input.getAttribute("aria-invalid")).to.equal("false");

  el.setAttribute("aria-label", "Return date");
  await el.updateComplete;
  expect(input.getAttribute("aria-label")).to.equal("Return date");

  el.removeAttribute("aria-label");
  await el.updateComplete;
  expect(input.hasAttribute("aria-label")).to.be.false;

  input.dispatchEvent(new FocusEvent("blur"));
  await el.updateComplete;
  expect(input.getAttribute("aria-invalid")).to.equal("true");

  el.value = "2026-07-15";
  await el.updateComplete;
  expect(input.getAttribute("aria-invalid")).to.equal("false");

  el.required = false;
  await el.updateComplete;
  expect(input.required).to.be.false;
  expect(input.getAttribute("aria-required")).to.equal("false");
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

it("parses an ambiguous dd/mm/yyyy-style date according to the locale, not Date.parse()'s bias", async () => {
  const el = (await fixture(
    html`<lr-date-input locale="en-GB"></lr-date-input>`
  )) as LyraDateInput;
  const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
  input.value = "15/07/2026"; // en-GB: 15 July 2026 -- Date.parse() would read this as invalid or mm/dd (month 15 -> invalid, or misparsed)
  input.dispatchEvent(new Event("change"));
  expect(el.value).to.equal("2026-07-15");
});

it("parses an ambiguous mm/dd/yyyy-style date according to an en-US locale", async () => {
  const el = (await fixture(
    html`<lr-date-input locale="en-US"></lr-date-input>`
  )) as LyraDateInput;
  const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
  input.value = "07/15/2026"; // en-US: July 15, 2026
  input.dispatchEvent(new Event("change"));
  expect(el.value).to.equal("2026-07-15");
});

it("normalizes a typed reversed range into from-before-to order", async () => {
  const el = (await fixture(
    html`<lr-date-input mode="range"></lr-date-input>`
  )) as LyraDateInput;
  const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
  input.value = "2026-05-15/2026-05-01";
  input.dispatchEvent(new Event("change"));
  expect(el.value).to.equal("2026-05-01/2026-05-15");
});

it("still parses a non-zero-padded, year-first ISO-ish date -- a 4-digit first group is unambiguously a year", async () => {
  // Regression test: parseOneDate used to route this through Date.parse()
  // directly and it parsed fine ("2026-7-15" -> July 15, 2026). Once the
  // ambiguous-date regex (\d{1,4} per group) was introduced to handle
  // genuinely ambiguous locale-ordered dates like "15/07/2026", this
  // non-padded-but-unambiguous year-first string started matching that same
  // regex too and got misrouted through localeDateOrder()'s day/month/year
  // guessing -- which, for a western field order, does not treat the first
  // group as the year, and rejects the date. A 4-digit first group is
  // unambiguously a year (this is exactly ISO 8601's own year-first
  // convention, just without zero-padding) regardless of locale/separator,
  // so it must be routed straight through parseISO() instead.
  const el = (await fixture(
    html`<lr-date-input></lr-date-input>`
  )) as LyraDateInput;
  const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
  input.value = "2026-7-15";
  input.dispatchEvent(new Event("change"));
  expect(el.value).to.equal("2026-07-15");
});

it("defaults the clear/expand/dialog labels to English but lets them be overridden for other locales", async () => {
  const el = (await fixture(
    html`<lr-date-input with-clear value="2026-07-15"></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;

  const clearBtn = () => el.shadowRoot!.querySelector('[part="clear-button"]')!;
  const expandBtn = () =>
    el.shadowRoot!.querySelector('[part="expand-button"]')!;
  const popup = () => el.shadowRoot!.querySelector('[part="popup"]')!;

  expect(clearBtn().getAttribute("aria-label")).to.equal("Clear");
  expect(expandBtn().getAttribute("aria-label")).to.equal("Open calendar");
  expect(popup().getAttribute("aria-label")).to.equal("Choose date");

  el.clearLabel = "Effacer";
  el.openLabel = "Ouvrir le calendrier";
  el.dialogLabel = "Choisir une date";
  await el.updateComplete;

  expect(clearBtn().getAttribute("aria-label")).to.equal("Effacer");
  expect(expandBtn().getAttribute("aria-label")).to.equal(
    "Ouvrir le calendrier"
  );
  expect(popup().getAttribute("aria-label")).to.equal("Choisir une date");
});

it("routes clear, expand, and dialog labels through .strings", async () => {
  const el = (await fixture(
    html`<lr-date-input with-clear value="2026-07-15"></lr-date-input>`
  )) as LyraDateInput;
  el.strings = {
    clear: "Effacer via strings",
    openCalendar: "Ouvrir via strings",
    chooseDate: "Choisir via strings",
  };
  await el.updateComplete;

  expect(
    el
      .shadowRoot!.querySelector('[part="clear-button"]')!
      .getAttribute("aria-label")
  ).to.equal("Effacer via strings");
  expect(
    el
      .shadowRoot!.querySelector('[part="expand-button"]')!
      .getAttribute("aria-label")
  ).to.equal("Ouvrir via strings");
  expect(
    el.shadowRoot!.querySelector('[part="popup"]')!.getAttribute("aria-label")
  ).to.equal("Choisir via strings");
});

it("themes the native placeholder through the component placeholder-color hook", async () => {
  const el = (await fixture(html`
    <lr-date-input
      placeholder="Choose a date"
      style="--lr-date-input-placeholder-color: rgb(12, 34, 56)"
    ></lr-date-input>
  `)) as LyraDateInput;
  const input = el.shadowRoot!.querySelector(
    '[part="input"]'
  ) as HTMLInputElement;
  expect(getComputedStyle(input, "::placeholder").color).to.equal(
    "rgb(12, 34, 56)"
  );
});

describe("spellcheck/autocapitalize/autocorrect passthrough", () => {
  it("spellcheck defaults to true", async () => {
    const el = (await fixture(
      html`<lr-date-input></lr-date-input>`
    )) as LyraDateInput;
    const input = el.shadowRoot!.querySelector(
      '[part="input"]'
    ) as HTMLInputElement;
    expect(input.spellcheck).to.be.true;
  });

  it("forwards spellcheck=false, autocapitalize, and autocorrect onto the native input", async () => {
    const el = (await fixture(html`
      <lr-date-input
        spellcheck="false"
        autocapitalize="off"
        autocorrect="off"
      ></lr-date-input>
    `)) as LyraDateInput;
    const input = el.shadowRoot!.querySelector(
      '[part="input"]'
    ) as HTMLInputElement;
    expect(input.spellcheck).to.be.false;
    expect(input.getAttribute("autocapitalize")).to.equal("off");
    expect(input.getAttribute("autocorrect")).to.equal("off");
  });

  it("forwards autocomplete, inputmode, and enterkeyhint onto the native input", async () => {
    const el = (await fixture(
      html`<lr-date-input
        autocomplete="bday"
        inputmode="numeric"
        enterkeyhint="next"
      ></lr-date-input>`
    )) as LyraDateInput;
    const input = el.shadowRoot!.querySelector(
      '[part="input"]'
    ) as HTMLInputElement;
    expect(input.getAttribute("autocomplete")).to.equal("bday");
    expect(input.getAttribute("inputmode")).to.equal("numeric");
    expect(input.getAttribute("enterkeyhint")).to.equal("next");
  });
});

describe("blur/focus bubbling", () => {
  it("re-dispatches a bubbling, composed blur event when the native input blurs", async () => {
    const el = (await fixture(
      html`<lr-date-input></lr-date-input>`
    )) as LyraDateInput;
    const input = el.shadowRoot!.querySelector(
      '[part="input"]'
    ) as HTMLInputElement;
    input.focus();
    const eventPromise = oneEvent(el, "blur");
    input.blur();
    const ev = await eventPromise;
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
  });

  it("re-dispatches a bubbling, composed focus event when the native input focuses", async () => {
    const el = (await fixture(
      html`<lr-date-input></lr-date-input>`
    )) as LyraDateInput;
    const input = el.shadowRoot!.querySelector(
      '[part="input"]'
    ) as HTMLInputElement;
    const eventPromise = oneEvent(el, "focus");
    input.focus();
    const ev = await eventPromise;
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
  });

  it("gives enabled clear/expand buttons a :hover treatment", () => {
    const css = styles.cssText.replace(/\s+/g, " ");
    expect(css).to.match(
      /\[part=["']clear-button["']\]:hover:not\(:disabled\),\s*\[part=["']expand-button["']\]:hover:not\(:disabled\)\s*\{[^}]+\}/
    );
  });
});

describe("touched state under disabled-forced blur", () => {
  // Regression test: the platform itself force-blurs a focused native control when it becomes
  // `disabled` (nothing to do with custom elements) -- that is not a real user interaction, and
  // marking `touched` for it could reenter an in-flight Lit update and trip Lit's dev-mode
  // "scheduled an update after an update completed" warning. Checks the private `touched` state
  // directly (not `aria-invalid`, which can lag a render behind and give false confidence).
  it("does not mark touched from a blur caused by the control itself becoming disabled", async () => {
    const el = (await fixture(
      html`<lr-date-input required></lr-date-input>`
    )) as LyraDateInput;
    const input = el.shadowRoot!.querySelector(
      '[part="input"]'
    ) as HTMLInputElement;
    input.focus();
    expect(
      el.shadowRoot!.activeElement === input,
      "input must be focused before it is disabled"
    ).to.be.true;

    el.disabled = true;
    await el.updateComplete;

    expect(
      (el as unknown as { touched: boolean }).touched,
      "a disable-forced blur must not mark the field touched"
    ).to.be.false;
  });

  it("still marks touched from a real blur while enabled", async () => {
    const el = (await fixture(
      html`<lr-date-input required></lr-date-input>`
    )) as LyraDateInput;
    const input = el.shadowRoot!.querySelector(
      '[part="input"]'
    ) as HTMLInputElement;
    input.focus();
    input.blur();
    await el.updateComplete;

    expect(
      (el as unknown as { touched: boolean }).touched,
      "a real user-driven blur must still mark the field touched"
    ).to.be.true;
  });
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

it("exposes accessibleLabel as a public property, not just the aria-label attribute", async () => {
  const el = (await fixture(
    html`<lr-date-input></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  expect(el.accessibleLabel).to.equal(null);

  // A JS property assignment (no cast needed since the property is public)
  // must reach the internal input's aria-label, the same as setting the
  // aria-label attribute already did.
  el.accessibleLabel = "Departure date";
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector(
    '[part="input"]'
  ) as HTMLInputElement;
  expect(input.getAttribute("aria-label")).to.equal("Departure date");
});

describe("start/end adornment slots", () => {
  const part = (el: LyraDateInput, name: string) =>
    el.shadowRoot!.querySelector(`[part="${name}"]`) as HTMLElement;

  it("renders a slotted glyph inside the input row, before the text field, with no consumer padding", async () => {
    const el = (await fixture(html`
      <lr-date-input size="s" label="Departure">
        <svg slot="start" width="12" height="12" aria-hidden="true">
          <circle cx="6" cy="6" r="5"></circle>
        </svg>
      </lr-date-input>
    `)) as LyraDateInput;
    await el.updateComplete;
    const start = part(el, "start");
    expect(start.hasAttribute("hidden")).to.be.false;
    const startRect = start.getBoundingClientRect();
    const rowRect = part(el, "input-wrapper").getBoundingClientRect();
    const inputRect = part(el, "input").getBoundingClientRect();
    expect(startRect.width).to.be.greaterThan(0);
    expect(startRect.left).to.be.at.least(rowRect.left);
    expect(startRect.right).to.be.at.most(inputRect.left + 1);
  });

  it("places the end adornment before the calendar toggle", async () => {
    const el = (await fixture(html`
      <lr-date-input label="Departure"><kbd slot="end">D</kbd></lr-date-input>
    `)) as LyraDateInput;
    await el.updateComplete;
    const end = part(el, "end");
    expect(end.hasAttribute("hidden")).to.be.false;
    expect(
      end.compareDocumentPosition(part(el, "expand-button")) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).to.be.greaterThan(0);
    expect(end.getBoundingClientRect().right).to.be.at.most(
      part(el, "expand-button").getBoundingClientRect().left + 1
    );
  });

  it("hides both wrappers when nothing is slotted", async () => {
    const el = (await fixture(
      html`<lr-date-input label="Departure"></lr-date-input>`
    )) as LyraDateInput;
    await el.updateComplete;
    expect(part(el, "start").hasAttribute("hidden")).to.be.true;
    expect(part(el, "end").hasAttribute("hidden")).to.be.true;
    expect(getComputedStyle(part(el, "start")).display).to.equal("none");
    expect(getComputedStyle(part(el, "end")).display).to.equal("none");
  });

  it("reveals the wrapper when an adornment is slotted in after first render", async () => {
    const el = (await fixture(
      html`<lr-date-input label="Departure"></lr-date-input>`
    )) as LyraDateInput;
    const glyph = document.createElement("span");
    glyph.slot = "end";
    glyph.textContent = "UTC";
    el.append(glyph);
    await el.updateComplete;
    await el.updateComplete;
    expect(part(el, "end").hasAttribute("hidden")).to.be.false;
  });

  it('places the start adornment on the inline-start under dir="rtl"', async () => {
    const root = await fixture(html`
      <div dir="rtl">
        <lr-date-input label="Departure"
          ><span slot="start">⌕</span></lr-date-input
        >
      </div>
    `);
    const el = root.querySelector("lr-date-input") as LyraDateInput;
    await el.updateComplete;
    expect(part(el, "start").getBoundingClientRect().left).to.be.greaterThan(
      part(el, "input").getBoundingClientRect().left
    );
  });

  it("is accessible with adornments slotted", async () => {
    const el = (await fixture(html`
      <lr-date-input label="Departure" with-clear value="2026-07-15">
        <span slot="start" aria-hidden="true">⌕</span>
        <kbd slot="end">D</kbd>
      </lr-date-input>
    `)) as LyraDateInput;
    await el.updateComplete;
    expect(part(el, "clear-button") != null).to.equal(true);
    await expect(el).to.be.accessible();
  });
});

describe("control min-height knob and exact-height hatch", () => {
  const wrapper = (el: LyraDateInput): HTMLElement =>
    el.shadowRoot!.querySelector('[part="input-wrapper"]') as HTMLElement;

  it("does NOT declare the --lr-date-input-control-height sentinel (guards the lr-select trap)", async () => {
    const el = (await fixture(
      html`<lr-date-input></lr-date-input>`
    )) as LyraDateInput;
    await el.updateComplete;
    expect(
      getComputedStyle(el)
        .getPropertyValue("--lr-date-input-control-height")
        .trim()
    ).to.equal("");
  });

  it("wires --lr-date-input-control-min-height per tier (rendered min-block-size)", async () => {
    const expected: Record<string, string> = {
      "2xs": "20px",
      xs: "24px",
      s: "30px",
      m: "40px",
      l: "48px",
      xl: "56px",
    };
    for (const [size, px] of Object.entries(expected)) {
      const el = (await fixture(
        html`<lr-date-input size=${size}></lr-date-input>`
      )) as LyraDateInput;
      await el.updateComplete;
      expect(
        getComputedStyle(wrapper(el)).minBlockSize,
        `size=${size}`
      ).to.equal(px);
    }
  });

  it("accepts the Web Awesome size spellings, rendering small/medium/large as s/m/l", async () => {
    const pairs: ReadonlyArray<readonly [string, string]> = [
      ["small", "s"],
      ["medium", "m"],
      ["large", "l"],
    ];
    for (const [alias, step] of pairs) {
      const aliasEl = (await fixture(
        html`<lr-date-input size=${alias}></lr-date-input>`
      )) as LyraDateInput;
      const stepEl = (await fixture(
        html`<lr-date-input size=${step}></lr-date-input>`
      )) as LyraDateInput;
      await aliasEl.updateComplete;
      await stepEl.updateComplete;
      expect(
        getComputedStyle(wrapper(aliasEl)).minBlockSize,
        `min-block-size for ${alias}`
      ).to.equal(getComputedStyle(wrapper(stepEl)).minBlockSize);
      expect(
        getComputedStyle(wrapper(aliasEl)).paddingBlockStart,
        `padding for ${alias}`
      ).to.equal(getComputedStyle(wrapper(stepEl)).paddingBlockStart);
      expect(
        wrapper(aliasEl).getBoundingClientRect().height,
        `laid-out height for ${alias}`
      ).to.equal(wrapper(stepEl).getBoundingClientRect().height);
    }
  });

  it("rounds the input row to a pill without a ::part() rule", async () => {
    const plain = (await fixture(
      html`<lr-date-input></lr-date-input>`
    )) as LyraDateInput;
    const pill = (await fixture(
      html`<lr-date-input pill></lr-date-input>`
    )) as LyraDateInput;
    await plain.updateComplete;
    await pill.updateComplete;
    expect(pill.pill).to.be.true;
    expect(pill.getAttribute("pill")).to.equal("");
    expect(
      Number.parseFloat(getComputedStyle(wrapper(pill)).borderStartStartRadius)
    ).to.be.greaterThan(
      Number.parseFloat(getComputedStyle(wrapper(plain)).borderStartStartRadius)
    );
  });

  it("leaves the rendered row height byte-identical when the height hatch is unset", async () => {
    const el = (await fixture(
      html`<lr-date-input value="2026-07-15"></lr-date-input>`
    )) as LyraDateInput;
    await el.updateComplete;
    const w = wrapper(el);
    const natural = getComputedStyle(w).blockSize;
    // The row height is pinned transitively by the un-gated 40px calendar toggle, well above the
    // per-tier min-height floor, so the floor is dead until raised -- byte-identical to today.
    expect(Number.parseFloat(natural)).to.be.greaterThan(
      Number.parseFloat(getComputedStyle(w).minBlockSize)
    );
    el.style.setProperty("--lr-date-input-control-height", "30px");
    await el.updateComplete;
    expect(getComputedStyle(w).blockSize).to.equal("30px");
    el.style.removeProperty("--lr-date-input-control-height");
    await el.updateComplete;
    expect(getComputedStyle(w).blockSize).to.equal(natural);
  });

  it("keeps the calendar toggle a >=24x24 target even when the height hatch crushes the row", async () => {
    // The exact-height cap does not crush the WCAG 2.2 SC 2.5.8 target: the expand button carries
    // its own un-gated --lr-icon-button-size floor, so it keeps 24x24 while overflowing a short row.
    const el = (await fixture(
      html`<lr-date-input value="2026-07-15" with-clear></lr-date-input>`
    )) as LyraDateInput;
    el.style.setProperty("--lr-date-input-control-height", "16px");
    await el.updateComplete;
    const expandBtn = el.shadowRoot!.querySelector(
      '[part="expand-button"]'
    ) as HTMLElement;
    expect(expandBtn.getBoundingClientRect().height).to.be.greaterThan(24);
    expect(expandBtn.getBoundingClientRect().width).to.be.greaterThan(24);
    const clearBtn = el.shadowRoot!.querySelector(
      '[part="clear-button"]'
    ) as HTMLElement;
    expect(clearBtn.getBoundingClientRect().height).to.be.greaterThan(24);
    expect(clearBtn.getBoundingClientRect().width).to.be.greaterThan(24);
  });

  it("lets a consumer raise --lr-date-input-control-min-height past the row content", async () => {
    const el = (await fixture(
      html`<lr-date-input></lr-date-input>`
    )) as LyraDateInput;
    await el.updateComplete;
    const w = wrapper(el);
    const natural = Number.parseFloat(getComputedStyle(w).blockSize);
    el.style.setProperty(
      "--lr-date-input-control-min-height",
      `${natural + 20}px`
    );
    await el.updateComplete;
    expect(Number.parseFloat(getComputedStyle(w).blockSize)).to.equal(
      natural + 20
    );
  });

  it("stays accessible with a pinned exact control height", async () => {
    const el = (await fixture(
      html`<lr-date-input
        value="2026-07-15"
        style="--lr-date-input-control-height: 44px;"
      ></lr-date-input>`
    )) as LyraDateInput;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});

/** Render the max-inline-size declared on `selector` (read off the element's own applied stylesheets)
 *  into the component's shadow scope with the viewport-clamp token pinned to a tiny value, returning
 *  its resolved computed value. Wired to --lr-popover-viewport-clamp the min() collapses to that
 *  pinned value; a leftover 92vw/90vw literal would resolve to something else. */
function renderedClamp(el: HTMLElement, selector: string): string {
  const normalize = (text: string) => text.replace(/"/g, "'");
  let declared = "";
  for (const sheet of el.shadowRoot!.adoptedStyleSheets) {
    for (const rule of sheet.cssRules) {
      if (
        rule instanceof CSSStyleRule &&
        normalize(rule.selectorText) === normalize(selector) &&
        rule.style.maxInlineSize
      ) {
        declared = rule.style.maxInlineSize;
      }
    }
  }
  const probe = document.createElement("span");
  probe.style.display = "block";
  probe.style.setProperty("--lr-popover-viewport-clamp", "10px");
  probe.style.maxInlineSize = declared;
  el.shadowRoot!.appendChild(probe);
  const value = getComputedStyle(probe).maxInlineSize;
  probe.remove();
  return value;
}

it("clamps its floating surface width through the shared popover-viewport-clamp token", async () => {
  const el = (await fixture(
    html`<lr-date-input></lr-date-input>`
  )) as HTMLElement;
  await (el as HTMLElement & { updateComplete?: Promise<unknown> })
    .updateComplete;
  expect(renderedClamp(el, "[part='popup']")).to.equal("10px");
});

// -- Locale-order fallback paths, selection accessors before
//    first render, setter edge cases, defensive validity guards, show/hide
//    no-ops, parse fallbacks, and range-text edge cases. ---------------------

describe("locale day/month/year order fallback", () => {
  it("falls back to the runtime default locale order when locale resolution is empty", async () => {
    const el = (await fixture(
      html`<lr-date-input></lr-date-input>`
    )) as LyraDateInput;
    Object.defineProperty(el, "effectiveLocale", {
      get: () => "",
      configurable: true,
    });
    const input = el.shadowRoot!.querySelector(
      '[part="input"]'
    ) as HTMLInputElement;
    input.value = "03/04/2026";
    input.dispatchEvent(new Event("change"));
    expect(el.value).to.match(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("falls back to month/day/year field order when Intl.DateTimeFormat rejects the locale outright", async () => {
    // "not_a_locale" is malformed enough that `new Intl.DateTimeFormat(...)` itself throws a
    // RangeError -- localeDateOrder()'s own try/catch must fall back to its hardcoded default
    // rather than letting that propagate out of a keystroke handler.
    const el = (await fixture(
      html`<lr-date-input locale="not_a_locale"></lr-date-input>`
    )) as LyraDateInput;
    const input = el.shadowRoot!.querySelector(
      '[part="input"]'
    ) as HTMLInputElement;
    input.value = "07/15/2026"; // month/day/year fallback order -> July 15, 2026
    input.dispatchEvent(new Event("change"));
    expect(el.value).to.equal("2026-07-15");
  });

  it("falls back to month/day/year field order when Intl reports fewer than three date fields", async () => {
    const original = Intl.DateTimeFormat.prototype.formatToParts;
    Intl.DateTimeFormat.prototype.formatToParts = function (
      ...args: Parameters<typeof original>
    ) {
      return original.apply(this, args).filter((p) => p.type !== "year");
    };
    try {
      const el = (await fixture(
        html`<lr-date-input></lr-date-input>`
      )) as LyraDateInput;
      const input = el.shadowRoot!.querySelector(
        '[part="input"]'
      ) as HTMLInputElement;
      input.value = "07/15/2026"; // month/day/year under the forced fallback -> July 15, 2026
      input.dispatchEvent(new Event("change"));
      expect(el.value).to.equal("2026-07-15");
    } finally {
      Intl.DateTimeFormat.prototype.formatToParts = original;
    }
  });

  it("expands a 2-digit year in an ambiguous locale-ordered date to the 2000s", async () => {
    const el = (await fixture(
      html`<lr-date-input locale="en-GB"></lr-date-input>`
    )) as LyraDateInput;
    const input = el.shadowRoot!.querySelector(
      '[part="input"]'
    ) as HTMLInputElement;
    input.value = "15/07/26"; // en-GB day/month/year -> 15 July, year 26 -> 2026
    input.dispatchEvent(new Event("change"));
    expect(el.value).to.equal("2026-07-15");
  });
});

describe("selection accessors before the internal input has rendered", () => {
  it("selectionStart/selectionEnd/selectionDirection getters all return null before the internal input exists", () => {
    const el = document.createElement("lr-date-input") as LyraDateInput;
    expect(el.selectionStart).to.equal(null);
    expect(el.selectionEnd).to.equal(null);
    expect(el.selectionDirection).to.equal(null);
  });

  it("setRangeText() no-ops when the internal input has not rendered yet", () => {
    const el = document.createElement("lr-date-input") as LyraDateInput;
    expect(() => el.setRangeText("x")).to.not.throw();
  });
});

it("selectionStart/selectionEnd/selectionDirection setters operate on the internal input", async () => {
  const el = (await fixture(
    html`<lr-date-input value="2026-07-15"></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  el.focus();

  el.selectionStart = 1;
  expect(el.input!.selectionStart).to.equal(1);

  el.selectionEnd = 3;
  expect(el.input!.selectionEnd).to.equal(3);

  el.selectionDirection = "backward";
  expect(el.selectionDirection).to.equal("backward");

  // Nullable range endpoints use the native zero default instead of leaving a
  // stale selection behind.
  el.selectionStart = null;
  el.selectionEnd = null;
  expect(el.input!.selectionStart).to.equal(0);
  expect(el.input!.selectionEnd).to.equal(0);

  // Native text inputs normalize their nullable "none" direction assignment to
  // their forward default. The important host contract is that the null write
  // reaches the input and clears the previous backward direction.
  el.selectionEnd = 2;
  el.selectionDirection = null;
  expect(el.selectionDirection).to.equal("forward");
});

it("setRangeText() with only a replacement string uses the single-argument native overload", async () => {
  const el = (await fixture(
    html`<lr-date-input value="2026-07-15"></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  el.focus();
  el.select(); // select the whole displayed text so a bare replacement covers it entirely
  const displayed = el.input!.value;
  const replaced = displayed.replace("15", "20");
  el.setRangeText(replaced);
  expect(el.value).to.equal("2026-07-20");
});

it("min/max setters tolerate a null assignment, normalizing to an empty string", async () => {
  const el = (await fixture(
    html`<lr-date-input
      value="2026-07-15"
      min="2026-01-01"
      max="2026-12-31"
    ></lr-date-input>`
  )) as LyraDateInput;
  (el as unknown as { min: string | null }).min = null;
  expect(el.min).to.equal("");
  (el as unknown as { max: string | null }).max = null;
  expect(el.max).to.equal("");
});

it("value setter tolerates a null assignment, normalizing to an empty string", async () => {
  const el = (await fixture(
    html`<lr-date-input value="2026-07-15"></lr-date-input>`
  )) as LyraDateInput;
  (el as unknown as { value: string | null }).value = null;
  expect(el.value).to.equal("");
});

it("normalizes a malformed value with more than two slash-separated parts to empty", async () => {
  const el = (await fixture(
    html`<lr-date-input
      value="2026-07-15/2026-07-20/2026-07-25"
    ></lr-date-input>`
  )) as LyraDateInput;
  expect(el.value).to.equal("");
});

it("flags badInput defensively if a committed value fails a later strict-ISO re-check", async () => {
  // valueDates() guards every part with parseStrictISO() again at validity-check time, even
  // though normalizeCommittedValue() already rejects a bad value before it is ever committed --
  // this proves that second guard actually does something if that invariant is ever violated.
  const el = (await fixture(
    html`<lr-date-input value="2026-07-15"></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  expect(el.checkValidity()).to.be.true;

  (el as unknown as { parseStrictISO(): null }).parseStrictISO = () => null;
  el.min = "2026-01-01"; // re-runs updateValidity() without re-normalizing `value`
  expect(el.internals.validity.badInput).to.be.true;
  expect(el.checkValidity()).to.be.false;
});

it("ignores a visibilitychange event while the document is hidden", async () => {
  const el = (await fixture(
    html`<lr-date-input value="2026-07-14" disable-past></lr-date-input>`
  )) as LyraDateInput;
  const clock = el as unknown as { now: () => Date };
  clock.now = () => new Date(2026, 6, 14, 23, 59);
  expect(el.checkValidity()).to.be.true;
  clock.now = () => new Date(2026, 6, 15, 0, 1);

  Object.defineProperty(el.ownerDocument, "visibilityState", {
    value: "hidden",
    configurable: true,
  });
  try {
    el.ownerDocument.dispatchEvent(new Event("visibilitychange"));
    await el.updateComplete;
    expect(el.internals.validity.rangeUnderflow).to.be.false;
  } finally {
    delete (el.ownerDocument as unknown as { visibilityState?: unknown })
      .visibilityState;
  }
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

it("show() no-ops while already open or readonly; hide() no-ops when already closed", async () => {
  const el = (await fixture(
    html`<lr-date-input></lr-date-input>`
  )) as LyraDateInput;
  expect(el.open).to.be.false;
  el.hide(); // already closed -- no-op
  expect(el.open).to.be.false;

  el.show();
  await el.updateComplete;
  expect(el.open).to.be.true;
  el.show(); // already open -- no-op
  expect(el.open).to.be.true;
  el.hide();
  await el.updateComplete;

  el.readonly = true;
  await el.updateComplete;
  el.show(); // readonly -- no-op
  expect(el.open).to.be.false;
});

it("commits an empty typed value once its trimmed text is blank", async () => {
  const el = (await fixture(
    html`<lr-date-input value="2026-07-15"></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector(
    '[part="input"]'
  ) as HTMLInputElement;
  input.value = "   "; // whitespace-only -- trims to empty
  setTimeout(() => input.dispatchEvent(new Event("change")));
  await oneEvent(el, "change");
  expect(el.value).to.equal("");
  expect(el.internals.validity.badInput).to.be.false;
});

it("parses a non-ambiguous, human-readable date string via Date.parse() as a last resort", async () => {
  const el = (await fixture(
    html`<lr-date-input></lr-date-input>`
  )) as LyraDateInput;
  const input = el.shadowRoot!.querySelector(
    '[part="input"]'
  ) as HTMLInputElement;
  input.value = "July 15, 2026";
  setTimeout(() => input.dispatchEvent(new Event("change")));
  await oneEvent(el, "change");
  expect(el.value).to.equal("2026-07-15");
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

// -- Outside dismissal and slotted supporting text --------------------------

it("closes an open calendar on an outside pointerdown but not one inside the host", async () => {
  const el = (await fixture(
    html`<lr-date-input></lr-date-input>`
  )) as LyraDateInput;
  el.open = true;
  await el.updateComplete;
  expect(el.open).to.be.true;

  el.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, composed: true })
  );
  await el.updateComplete;
  expect(el.open, "a pointerdown on the host keeps it open").to.be.true;

  document.body.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, composed: true })
  );
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it("tracks slotted hint and error content through slotchange", async () => {
  const el = (await fixture(html`
    <lr-date-input>
      <span slot="hint">Any date after today</span>
      <span slot="error">Required</span>
    </lr-date-input>
  `)) as LyraDateInput;
  await el.updateComplete;
  const flags = el as unknown as {
    hasHintSlot: boolean;
    hasErrorSlot: boolean;
  };
  expect(flags.hasHintSlot).to.be.true;
  expect(flags.hasErrorSlot).to.be.true;

  el.querySelector('[slot="hint"]')!.remove();
  el.querySelector('[slot="error"]')!.remove();
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await el.updateComplete;
  expect(flags.hasHintSlot).to.be.false;
  expect(flags.hasErrorSlot).to.be.false;
});

describe("lr-date-input implicit form submission", () => {
  const field = (el: LyraDateInput): HTMLInputElement =>
    el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
  const enterOn = (el: LyraDateInput, init: KeyboardEventInit = {}) =>
    field(el).dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        composed: true,
        cancelable: true,
        ...init,
      })
    );

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
    enterOn(el);
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
    enterOn(el);
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
    enterOn(el);
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
    enterOn(el);
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
    enterOn(el);
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
    enterOn(el);
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
    enterOn(el, { shiftKey: true });
    enterOn(el, { ctrlKey: true });
    enterOn(el, { altKey: true });
    enterOn(el, { metaKey: true });
    enterOn(el, { isComposing: true });
    expect(submits).to.equal(0);

    // Capture on the host runs before the internal input's own listener.
    const veto = (e: Event): void => e.preventDefault();
    el.addEventListener("keydown", veto, true);
    enterOn(el);
    el.removeEventListener("keydown", veto, true);
    expect(submits).to.equal(0);

    el.readonly = true;
    await el.updateComplete;
    enterOn(el);
    expect(submits, "a readonly field never submits").to.equal(0);

    el.readonly = false;
    await el.updateComplete;
    enterOn(el);
    expect(submits, "a bare Enter still submits").to.equal(1);
  });
});

describe("reviewed date-input parity surface", () => {
  it("exposes and reflects reviewed wrapper and delegated defaults", async () => {
    const el = (await fixture(
      html`<lr-date-input></lr-date-input>`
    )) as LyraDateInput;
    expect(el.appearance).to.equal("outlined");
    expect(el.assumeInteractionOn).to.deep.equal(["input"]);
    expect(el.disabledDates).to.equal("");
    expect(el.distance).to.equal(0);
    expect(el.maxRange).to.equal(0);
    expect(el.minRange).to.equal(0);
    expect(el.pageBy).to.equal("months");
    expect(el.placement).to.equal("bottom-start");
    expect(el.today).to.equal("");
    expect(el.validators).to.deep.equal([]);
    el.appearance = "filled";
    el.distance = 7;
    el.maxRange = 9;
    el.minRange = 2;
    el.pageBy = "single";
    el.today = "2026-07-04";
    el.withHint = true;
    el.withLabel = true;
    el.withWeekNumbers = true;
    await el.updateComplete;
    expect(el.getAttribute("appearance")).to.equal("filled");
    expect(el.getAttribute("distance")).to.equal("7");
    expect(el.getAttribute("max-range")).to.equal("9");
    expect(el.getAttribute("min-range")).to.equal("2");
    expect(el.getAttribute("page-by")).to.equal("single");
    expect(el.getAttribute("today")).to.equal("2026-07-04");
    expect(el.hasAttribute("with-week-numbers")).to.be.true;
  });

  it("round-trips Date IDLs and keeps an incomplete range out of FormData", async () => {
    const form = (await fixture(html`
      <form><lr-date-input name="period" mode="range"></lr-date-input></form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-date-input") as LyraDateInput;
    el.valueAsRange = {
      from: new Date(2026, 6, 10),
      to: new Date(2026, 6, 15),
    };
    expect(el.value).to.equal("2026-07-10/2026-07-15");
    expect(new FormData(form).get("period")).to.equal("2026-07-10/2026-07-15");
    el.value = "2026-07-10";
    expect(new FormData(form).get("period")).to.equal("");
    el.mode = "single";
    el.valueAsDate = new Date(2026, 6, 20);
    expect(el.value).to.equal("2026-07-20");
    expect(el.valueAsDate?.getDate()).to.equal(20);
  });

  it("accepts branded Date values from another realm for values, ranges, and disabled dates", async () => {
    const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
    const ForeignDate = frame.contentWindow!.Date;
    const el = (await fixture(
      html`<lr-date-input value="2026-07-15"></lr-date-input>`
    )) as LyraDateInput;

    const single = new ForeignDate(2026, 6, 12);
    expect(single instanceof Date).to.equal(false);
    el.valueAsDate = single;
    expect(el.value).to.equal("2026-07-12");

    el.mode = "range";
    el.valueAsRange = {
      from: new ForeignDate(2026, 6, 20),
      to: new ForeignDate(2026, 6, 10),
    };
    expect(el.value).to.equal("2026-07-10/2026-07-20");

    el.mode = "single";
    el.value = "2026-07-15";
    el.disabledDates = [new ForeignDate(2026, 6, 16)];
    el.show();
    await el.updateComplete;
    const picker = el.shadowRoot!.querySelector(
      "lr-date-picker"
    ) as LyraDatePicker;
    await picker.updateComplete;
    const disabledDay = picker.shadowRoot!.querySelector(
      '[data-date="2026-07-16"]'
    ) as HTMLButtonElement;
    expect(disabledDay.disabled).to.equal(true);
  });

  it("rejects structural Date lookalikes for values, ranges, and disabled dates", async () => {
    const forged = {
      getTime: () => new Date(2026, 6, 16).getTime(),
      getFullYear: () => 2026,
      getMonth: () => 6,
      getDate: () => 16,
      [Symbol.toStringTag]: "Date",
    } as unknown as Date;
    const el = (await fixture(
      html`<lr-date-input value="2026-07-15"></lr-date-input>`
    )) as LyraDateInput;

    el.valueAsDate = forged;
    expect(el.value).to.equal("");

    el.mode = "range";
    el.valueAsRange = { from: forged, to: new Date(2026, 6, 20) };
    expect(el.value).to.equal("");

    el.mode = "single";
    el.value = "2026-07-15";
    el.disabledDates = [forged];
    el.show();
    await el.updateComplete;
    const picker = el.shadowRoot!.querySelector(
      "lr-date-picker"
    ) as LyraDatePicker;
    await picker.updateComplete;
    const ordinaryDay = picker.shadowRoot!.querySelector(
      '[data-date="2026-07-16"]'
    ) as HTMLButtonElement;
    expect(ordinaryDay.disabled).to.equal(false);
  });

  it("makes clear() inert while blank, disabled, or readonly and emits the reviewed trio otherwise", async () => {
    const el = (await fixture(
      html`<lr-date-input value="2026-07-15"></lr-date-input>`
    )) as LyraDateInput;
    const events: Event[] = [];
    for (const name of ["lr-clear", "input", "change"])
      el.addEventListener(name, (event) => events.push(event));
    el.disabled = true;
    el.clear();
    expect(el.value).to.equal("2026-07-15");
    el.disabled = false;
    el.readonly = true;
    el.clear();
    expect(el.value).to.equal("2026-07-15");
    el.readonly = false;
    el.clear();
    expect(el.value).to.equal("");
    expect(events.map((event) => event.type)).to.deep.equal([
      "lr-clear",
      "input",
      "change",
    ]);
    expect(events[0] instanceof CustomEvent).to.be.true;
    expect(events[1] instanceof InputEvent).to.be.true;
    expect((events[1] as InputEvent).inputType).to.equal(
      "deleteContentBackward"
    );
    expect(events[2] instanceof CustomEvent).to.be.false;
    for (const event of events) {
      expect(event.target === el, event.type).to.be.true;
      expect(event.bubbles, event.type).to.be.true;
      expect(event.composed, event.type).to.be.true;
      expect(event.cancelable, event.type).to.be.false;
    }
    events.length = 0;
    el.clear();
    expect(events).to.deep.equal([]);
  });

  it("honors cancelable show/hide vetoes and emits after events only after a settled transition", async () => {
    const el = (await fixture(html`
      <lr-date-input
        style="--show-duration: 1ms; --hide-duration: 1ms"
      ></lr-date-input>
    `)) as LyraDateInput;
    let showRequest: Event | undefined;
    const vetoShow = (event: Event): void => {
      showRequest = event;
      event.preventDefault();
    };
    el.addEventListener("lr-show", vetoShow);
    await el.show();
    expect(showRequest?.cancelable).to.be.true;
    expect(el.open).to.be.false;
    el.removeEventListener("lr-show", vetoShow);

    const afterShow = oneEvent(el, "lr-after-show");
    await el.show();
    const shown = await afterShow;
    expect(shown.cancelable).to.be.false;
    expect(el.open).to.be.true;

    let hideRequest: Event | undefined;
    const vetoHide = (event: Event): void => {
      hideRequest = event;
      event.preventDefault();
    };
    el.addEventListener("lr-hide", vetoHide);
    await el.hide();
    expect(hideRequest?.cancelable).to.be.true;
    expect(el.open).to.be.true;
    el.removeEventListener("lr-hide", vetoHide);
    const afterHide = oneEvent(el, "lr-after-hide");
    await el.hide();
    const hidden = await afterHide;
    expect(hidden.cancelable).to.be.false;
    expect(el.open).to.be.false;
  });

  it("closes an open calendar with Escape and restores focus to the native date field", async () => {
    const el = (await fixture(html`
      <lr-date-input
        style="--show-duration: 1ms; --hide-duration: 1ms"
      ></lr-date-input>
    `)) as LyraDateInput;
    const input = el.input!;
    input.focus();

    await el.show();
    expect(el.open).to.be.true;

    const afterHide = oneEvent(el, "lr-after-hide");
    const escape = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    el.ownerDocument.dispatchEvent(escape);
    await afterHide;

    expect(escape.defaultPrevented).to.be.true;
    expect(el.open).to.be.false;
    expect(el.shadowRoot!.activeElement === input).to.equal(true);
  });

  it("repositions an open popup when placement or distance changes", async () => {
    const el = (await fixture(
      html`<lr-date-input open></lr-date-input>`
    )) as LyraDateInput;
    await el.updateComplete;
    const state = el as unknown as { cleanupFn?: () => void };
    const initialCleanup = state.cleanupFn;
    expect(initialCleanup).to.be.a("function");

    el.placement = "top-end";
    await el.updateComplete;
    const placementCleanup = state.cleanupFn;
    expect(placementCleanup).to.be.a("function").and.not.equal(initialCleanup);

    el.distance = 8;
    await el.updateComplete;
    expect(state.cleanupFn).to.be.a("function").and.not.equal(placementCleanup);
  });

  it("keeps blur/change/focus/input/clear non-cancelable", async () => {
    const el = (await fixture(
      html`<lr-date-input value="2026-07-15"></lr-date-input>`
    )) as LyraDateInput;
    const seen = new Map<string, Event>();
    // `lr-invalid` is deliberately absent: it aliases the native `invalid` event, which IS a real
    // veto point (cancelling it suppresses the browser's own validation UI), so it is emitted
    // cancelable — see the test below.
    const notifications = ["blur", "change", "focus", "input", "lr-clear"];
    for (const name of notifications) {
      el.addEventListener(name, (event) => seen.set(name, event));
    }
    el.focus();
    el.blur();
    el.clear();
    el.required = true;
    el.checkValidity();
    await el.updateComplete;
    for (const name of notifications) {
      expect(seen.get(name), `${name} fired`).to.exist;
      expect(seen.get(name)?.cancelable, name).to.be.false;
    }
  });

  it("emits lr-invalid cancelable and forwards its cancellation to the native invalid event", async () => {
    const el = (await fixture(
      html`<lr-date-input required></lr-date-input>`
    )) as LyraDateInput;
    await el.updateComplete;

    const seen: CustomEvent[] = [];
    el.addEventListener("lr-invalid", (event) =>
      seen.push(event as CustomEvent)
    );
    const natives: Event[] = [];
    el.addEventListener("invalid", (event) => natives.push(event));

    expect(el.reportValidity(), "a required-and-empty date input is invalid").to
      .be.false;
    expect(seen.length, "lr-invalid fired").to.equal(1);
    expect(seen[0]?.cancelable, "lr-invalid is cancelable").to.be.true;
    expect(natives.length, "the native invalid event fired too").to.equal(1);
    expect(natives[0]?.defaultPrevented, "nothing cancelled it").to.be.false;

    // Cancelling the alias must cancel the platform event it aliases — that is the whole point of
    // making it cancelable: an app rendering its own error banner suppresses the native bubble.
    const veto = (event: Event): void => event.preventDefault();
    el.addEventListener("lr-invalid", veto);
    el.reportValidity();
    el.removeEventListener("lr-invalid", veto);
    expect(natives.length, "a second invalid event fired").to.equal(2);
    expect(
      natives[1]?.defaultPrevented,
      "preventDefault() on the alias reached the native event"
    ).to.be.true;
  });

  it("relays typed input/change and focus/blur once with native constructors and payload", async () => {
    const wrapper = await fixture(html`
      <div>
        <button id="related">Related</button><lr-date-input></lr-date-input>
      </div>
    `);
    const el = wrapper.querySelector("lr-date-input") as LyraDateInput;
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector(
      '[part="input"]'
    ) as HTMLInputElement;
    const related = wrapper.querySelector("#related") as HTMLButtonElement;
    const valueEvents: Event[] = [];
    const focusEvents: FocusEvent[] = [];
    for (const name of ["input", "change"])
      el.addEventListener(name, (event) => valueEvents.push(event));
    for (const name of ["focus", "blur"]) {
      el.addEventListener(name, (event) =>
        focusEvents.push(event as FocusEvent)
      );
    }

    input.value = "2026-07-20";
    input.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        composed: true,
        data: "0",
        inputType: "insertText",
      })
    );
    input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    input.dispatchEvent(new FocusEvent("focus", { relatedTarget: related }));
    input.dispatchEvent(new FocusEvent("blur", { relatedTarget: related }));

    expect(el.value).to.equal("2026-07-20");
    expect(valueEvents.map((event) => event.type)).to.deep.equal([
      "input",
      "change",
    ]);
    expect(valueEvents[0] instanceof InputEvent).to.be.true;
    expect((valueEvents[0] as InputEvent).data).to.equal("0");
    expect((valueEvents[0] as InputEvent).inputType).to.equal("insertText");
    expect(valueEvents[1] instanceof CustomEvent).to.be.false;
    expect(focusEvents.map((event) => event.type)).to.deep.equal([
      "focus",
      "blur",
    ]);
    expect(focusEvents.every((event) => event instanceof FocusEvent)).to.be
      .true;
    expect(focusEvents.every((event) => event.relatedTarget === related)).to.be
      .true;
    for (const event of [...valueEvents, ...focusEvents]) {
      expect(event.target === el, event.type).to.be.true;
      expect(event.bubbles, event.type).to.be.true;
      expect(event.composed, event.type).to.be.true;
      expect(event.cancelable, event.type).to.be.false;
    }
  });

  it("relays the nested picker native input/change pair exactly once", async () => {
    const el = (await fixture(html`
      <lr-date-input value="2026-07-15" open></lr-date-input>
    `)) as LyraDateInput;
    await el.updateComplete;
    const picker = el.shadowRoot!.querySelector(
      "lr-date-picker"
    ) as LyraDatePicker;
    await picker.updateComplete;
    const seen: Event[] = [];
    for (const name of ["input", "change"])
      el.addEventListener(name, (event) => seen.push(event));

    (
      picker.shadowRoot!.querySelector(
        '[data-date="2026-07-20"]'
      ) as HTMLButtonElement
    ).click();

    expect(seen.map((event) => event.type)).to.deep.equal(["input", "change"]);
    expect(seen[0] instanceof InputEvent).to.be.true;
    expect(seen[1] instanceof CustomEvent).to.be.false;
    expect(seen.every((event) => event.target === el)).to.be.true;
  });

  it("forwards reviewed date constraints, callbacks, slots, and dynamic day slots", async () => {
    const el = (await fixture(html`
      <lr-date-input value="2026-07-15" with-clear with-week-numbers>
        <span slot="clear-icon">Clear it</span>
        <span slot="expand-icon">Open it</span>
        <span slot="previous-icon">Prev</span>
        <span slot="next-icon">Next</span>
        <span slot="footer">Footer</span>
        <span slot="day-2026-07-15">Payday</span>
      </lr-date-input>
    `)) as LyraDateInput;
    el.disabledDates = ["2026-07-16"];
    el.disabledDaysOfWeek = "sun";
    el.isDateDisabled = (date) => date.getDate() === 17;
    el.dayContent = (date) => (date.getDate() === 18 ? "Custom 18" : undefined);
    el.show();
    await el.updateComplete;
    const picker = el.shadowRoot!.querySelector(
      "lr-date-picker"
    ) as LyraDatePicker;
    await picker.updateComplete;
    expect(picker.disabledDates).to.equal(el.disabledDates);
    expect(picker.disabledDaysOfWeek).to.equal("sun");
    expect(picker.isDateDisabled).to.equal(el.isDateDisabled);
    expect(picker.withWeekNumbers).to.be.true;
    expect(
      picker
        .shadowRoot!.querySelector('[data-date="2026-07-16"]')!
        .getAttribute("part")
    ).to.include("day-disabled");
    const daySlot = picker.shadowRoot!.querySelector(
      '[data-date="2026-07-15"] slot[name="day-2026-07-15"]'
    ) as HTMLSlotElement;
    const forwardingSlot = daySlot.assignedElements()[0] as HTMLSlotElement;
    expect(forwardingSlot.assignedElements()[0]?.textContent).to.include(
      "Payday"
    );
    expect(
      picker.shadowRoot!.querySelector('[data-date="2026-07-18"]')!.textContent
    ).to.include("Custom 18");
  });

  it("publishes reviewed states and parts and supports SSR label/hint hints", async () => {
    const el = (await fixture(html`
      <lr-date-input mode="range" open with-label with-hint></lr-date-input>
    `)) as LyraDateInput;
    await el.updateComplete;
    for (const part of [
      "date-input",
      "base",
      "form-control",
      "form-control-input",
      "form-control-label",
      "label",
      "input-wrapper",
      "input",
      "range-separator",
      "segment",
      "segment-literal",
      "start",
      "end",
      "expand-button",
      "expand-icon",
      "popup",
      "date-picker",
      "hint",
    ]) {
      expect(el.shadowRoot!.querySelector(`[part~="${part}"]`), part).to.exist;
    }
    expect(el.internals.states.has("blank")).to.be.true;
    expect(el.internals.states.has("open")).to.be.true;
    expect(el.internals.states.has("range")).to.be.true;
    expect(el.internals.states.has("disabled")).to.be.false;
    expect(
      (
        el.shadowRoot!.querySelector(
          '[part~="form-control-label"]'
        ) as HTMLElement
      ).hidden
    ).to.be.false;
    expect(
      (el.shadowRoot!.querySelector('[part~="hint"]') as HTMLElement).hidden
    ).to.be.false;
  });

  it("exposes validationTarget/resetValidity and is accessible while open and populated", async () => {
    const el = (await fixture(html`
      <lr-date-input
        label="Reporting period"
        hint="Pick a start and end date"
        mode="range"
        value="2026-07-10/2026-07-15"
        open
        with-week-numbers
      ></lr-date-input>
    `)) as LyraDateInput;
    await el.updateComplete;
    expect(el.validationTarget?.localName).to.equal("input");
    el.setCustomValidity("No longer available");
    expect(el.validity.customError).to.be.true;
    el.resetValidity();
    expect(el.validity.customError).to.be.false;
    await expect(el).shadowDom.to.be.accessible();
  });
});

// A control barred from constraint validation is neither :valid nor :invalid natively -- a real
// `<input required disabled>` and `<input required readonly>` both match neither -- so a barred
// date input must publish no violation at all. This override used to guard only `readonly`, so a
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

// -- Locale-order construction failure, invalid placement fallback,
//    validator branches (function/object-validate/checkValidity/observedAttributes), a throwing
//    isDateDisabled predicate, min/max-range violations, validationTarget override, reading
//    valueAsRange, stale cross-document listener guards, popup reconnect-while-open, dropped
//    interaction listeners, adoptedCallback teardown, the Alt+ArrowDown shortcut, and a failed
//    Enter commit. -----------------------------------------------------------------------------

it("falls back to the hardcoded month/day/year order when Intl.DateTimeFormat.formatToParts throws", async () => {
  const el = (await fixture(
    html`<lr-date-input></lr-date-input>`
  )) as LyraDateInput;
  const input = el.shadowRoot!.querySelector(
    '[part="input"]'
  ) as HTMLInputElement;
  const original = Intl.DateTimeFormat.prototype.formatToParts;
  Intl.DateTimeFormat.prototype.formatToParts = function () {
    throw new RangeError("forced failure for coverage");
  };
  try {
    input.value = "07/15/2026"; // month/day/year fallback -> July 15, 2026
    input.dispatchEvent(new Event("change"));
  } finally {
    Intl.DateTimeFormat.prototype.formatToParts = original;
  }
  expect(el.value).to.equal("2026-07-15");
});

it("normalizes an invalid placement attribute to bottom-start", async () => {
  const el = (await fixture(
    html`<lr-date-input placement="nonsense"></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  expect(el.placement).to.equal("bottom-start");
  expect(el.getAttribute("placement")).to.equal("bottom-start");
});

it("setting validationTarget overrides the default input anchor", async () => {
  const el = (await fixture(
    html`<lr-date-input></lr-date-input>`
  )) as LyraDateInput;
  const anchor = document.createElement("span");
  expect(el.validationTarget === el.input).to.equal(true);
  el.validationTarget = anchor;
  expect(el.validationTarget === anchor).to.equal(true);
  el.validationTarget = undefined;
  expect(el.validationTarget === el.input).to.equal(true);
});

it("reads valueAsRange back in range mode and reports nulls outside it", async () => {
  const el = (await fixture(
    html`<lr-date-input
      mode="range"
      value="2026-07-10/2026-07-15"
    ></lr-date-input>`
  )) as LyraDateInput;
  expect(el.valueAsRange.from?.getDate()).to.equal(10);
  expect(el.valueAsRange.to?.getDate()).to.equal(15);
  el.mode = "single";
  expect(el.valueAsRange).to.deep.equal({ from: null, to: null });
});

it("normalizes reversed valueAsRange assignments and clears null endpoints", async () => {
  const el = (await fixture(
    html`<lr-date-input mode="range"></lr-date-input>`
  )) as LyraDateInput;

  el.valueAsRange = { from: new Date(2026, 6, 20), to: new Date(2026, 6, 10) };
  expect(el.value).to.equal("2026-07-10/2026-07-20");
  expect(el.valueAsRange.from?.getDate()).to.equal(10);
  expect(el.valueAsRange.to?.getDate()).to.equal(20);

  el.valueAsRange = { from: null, to: null };
  expect(el.value).to.equal("");
  expect(el.valueAsRange).to.deep.equal({ from: null, to: null });
});

it("treats a throwing isDateDisabled predicate as not-disabled rather than propagating", async () => {
  const el = (await fixture(
    html`<lr-date-input value="2026-07-15"></lr-date-input>`
  )) as LyraDateInput;
  el.isDateDisabled = () => {
    throw new Error("boom");
  };
  expect(() => el.checkValidity()).to.not.throw();
  expect(el.checkValidity()).to.be.true;
});

it("flags rangeUnderflow/rangeOverflow against minRange/maxRange", async () => {
  const short = (await fixture(html`
    <lr-date-input
      mode="range"
      value="2026-07-10/2026-07-11"
      min-range="5"
    ></lr-date-input>
  `)) as LyraDateInput;
  expect(short.checkValidity()).to.be.false;
  expect(short.internals.validity.rangeUnderflow).to.be.true;

  const long = (await fixture(html`
    <lr-date-input
      mode="range"
      value="2026-07-01/2026-07-31"
      max-range="5"
    ></lr-date-input>
  `)) as LyraDateInput;
  expect(long.checkValidity()).to.be.false;
  expect(long.internals.validity.rangeOverflow).to.be.true;
});

describe("lr-date-input custom validators", () => {
  it("runs a function/object-validate validator through every result shape", async () => {
    const el = (await fixture(
      html`<lr-date-input value="2026-07-15"></lr-date-input>`
    )) as LyraDateInput;

    el.validators = [() => true];
    expect(el.checkValidity(), "a true result passes").to.be.true;

    el.validators = [() => "Explicit message"];
    expect(el.checkValidity()).to.be.false;
    expect(el.internals.validity.customError).to.be.true;
    expect(el.internals.validationMessage).to.equal("Explicit message");

    el.validators = [() => false];
    expect(el.checkValidity()).to.be.false;
    expect(el.internals.validity.customError).to.be.true;
    expect(el.internals.validationMessage.length).to.be.greaterThan(0);

    el.validators = [() => ({ rangeOverflow: true })];
    expect(el.checkValidity()).to.be.false;
    expect(el.internals.validity.rangeOverflow).to.be.true;

    el.validators = [
      () => {
        throw new Error("boom");
      },
    ];
    expect(el.checkValidity()).to.be.false;
    expect(el.internals.validity.customError).to.be.true;

    el.validators = [{ validate: () => "Object-shaped validator message" }];
    expect(el.checkValidity()).to.be.false;
    expect(el.internals.validationMessage).to.equal(
      "Object-shaped validator message"
    );
  });

  it("supports an object checkValidity() validator, mapping invalidKeys and revalidating through observedAttributes", async () => {
    const el = (await fixture(
      html`<lr-date-input value="2026-07-15"></lr-date-input>`
    )) as LyraDateInput;
    let allowed = false;
    el.validators = [
      {
        observedAttributes: ["data-external-flag"],
        checkValidity: () =>
          allowed
            ? { isValid: true, invalidKeys: [], message: "" }
            : {
                isValid: false,
                invalidKeys: [
                  "rangeOverflow",
                  "not-a-real-key",
                ] as unknown as Exclude<keyof ValidityState, "valid">[],
                message: "External system rejected this date",
              },
      },
    ];
    await el.updateComplete;

    expect(el.checkValidity()).to.be.false;
    expect(el.internals.validity.rangeOverflow).to.be.true;
    expect(el.internals.validationMessage).to.equal(
      "External system rejected this date"
    );

    allowed = true;
    const priv = el as unknown as { validityRevision: number };
    const revisionBefore = priv.validityRevision;
    el.setAttribute("data-external-flag", "go");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(
      priv.validityRevision,
      "the MutationObserver-driven revalidation ran"
    ).to.be.greaterThan(revisionBefore);
    expect(
      el.internals.validity.rangeOverflow,
      "revalidated without an explicit checkValidity() call"
    ).to.be.false;
  });

  it("falls back through checkValidity()'s own message to the validator's static or function message, and synthesizes customError when invalidKeys maps to nothing", async () => {
    const el = (await fixture(
      html`<lr-date-input value="2026-07-15"></lr-date-input>`
    )) as LyraDateInput;

    el.validators = [
      {
        checkValidity: () => ({ isValid: false, invalidKeys: [], message: "" }),
        message: "Static object message",
      },
    ];
    expect(el.checkValidity()).to.be.false;
    expect(
      el.internals.validity.customError,
      "no mapped invalidKeys synthesizes customError"
    ).to.be.true;
    expect(el.internals.validationMessage).to.equal("Static object message");

    el.validators = [
      {
        checkValidity: () => ({ isValid: false, invalidKeys: [], message: "" }),
        message: () => "Function-derived object message",
      },
    ];
    expect(el.checkValidity()).to.be.false;
    expect(el.internals.validationMessage).to.equal(
      "Function-derived object message"
    );
  });

  it("falls back to the localized default message when neither checkValidity() nor the validator supplies one", async () => {
    const el = (await fixture(
      html`<lr-date-input value="2026-07-15"></lr-date-input>`
    )) as LyraDateInput;
    el.validators = [
      {
        checkValidity: () => ({
          isValid: false,
          invalidKeys: ["customError"] as unknown as Exclude<
            keyof ValidityState,
            "valid"
          >[],
          message: "",
        }),
      },
    ];
    expect(el.checkValidity()).to.be.false;
    expect(el.internals.validity.customError).to.be.true;
    expect(el.internals.validationMessage.length).to.be.greaterThan(0);
  });

  it("ignores a validator whose observedAttributes getter throws", async () => {
    const el = (await fixture(
      html`<lr-date-input value="2026-07-15"></lr-date-input>`
    )) as LyraDateInput;
    el.validators = [
      {
        get observedAttributes(): string[] {
          throw new Error("boom");
        },
        checkValidity: () => ({ isValid: true, invalidKeys: [], message: "" }),
      },
    ];
    await el.updateComplete;
    expect(el.checkValidity()).to.be.true;
  });

  it("disconnects the MutationObserver it just created if observe() itself throws", async () => {
    const el = (await fixture(
      html`<lr-date-input value="2026-07-15"></lr-date-input>`
    )) as LyraDateInput;
    const originalObserve = MutationObserver.prototype.observe;
    const originalDisconnect = MutationObserver.prototype.disconnect;
    let disconnectCalls = 0;
    MutationObserver.prototype.observe = function () {
      throw new Error("forced failure for coverage");
    };
    MutationObserver.prototype.disconnect = function (...args: []) {
      disconnectCalls += 1;
      return originalDisconnect.apply(this, args);
    };
    try {
      el.validators = [
        {
          observedAttributes: ["data-flag"],
          checkValidity: () => ({
            isValid: true,
            invalidKeys: [],
            message: "",
          }),
        },
      ];
      await el.updateComplete;
    } finally {
      MutationObserver.prototype.observe = originalObserve;
      MutationObserver.prototype.disconnect = originalDisconnect;
    }
    expect(
      disconnectCalls,
      "a failed observe() triggers a disconnect() cleanup"
    ).to.be.greaterThan(0);
  });
});

describe("lr-date-input cross-document and reconnect listener guards", () => {
  it("a stale visibilitychange listener whose tracked reference changed underneath it no-ops", async () => {
    const el = (await fixture(
      html`<lr-date-input value="2026-07-14" disable-past></lr-date-input>`
    )) as LyraDateInput;
    const priv = el as unknown as {
      now: () => Date;
      visibilityListener?: () => void;
    };
    priv.now = () => new Date(2026, 6, 14, 23, 59);
    expect(el.checkValidity()).to.be.true;
    priv.now = () => new Date(2026, 6, 15, 0, 1);

    expect(priv.visibilityListener).to.be.a("function");
    priv.visibilityListener = () => {};
    el.ownerDocument.dispatchEvent(new Event("visibilitychange"));
    await el.updateComplete;
    expect(
      el.internals.validity.rangeUnderflow,
      "the stale listener does not revalidate"
    ).to.be.false;
  });

  it("a stale pointerdown listener whose tracked reference changed underneath it no-ops", async () => {
    const el = (await fixture(
      html`<lr-date-input open></lr-date-input>`
    )) as LyraDateInput;
    await el.updateComplete;
    const priv = el as unknown as {
      pointerListener?: (e: PointerEvent) => void;
    };
    expect(priv.pointerListener).to.be.a("function");
    priv.pointerListener = () => {};
    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, composed: true })
    );
    expect(el.open, "the stale listener no-ops instead of hiding").to.be.true;
  });

  it("a reconnect that finds the popup already open repositions it and reactivates the overlay", async () => {
    const el = (await fixture(html`
      <lr-date-input
        open
        style="--show-duration: 1ms; --hide-duration: 1ms"
      ></lr-date-input>
    `)) as LyraDateInput;
    await el.updateComplete;
    expect(el.open).to.be.true;

    el.remove();
    expect(el.open, "disconnect resets open").to.be.false;
    el.open = true; // force a still-open state going into the reconnect

    document.body.appendChild(el);
    await new Promise((resolve) => queueMicrotask(resolve));
    await el.updateComplete;

    const priv = el as unknown as {
      cleanupFn?: () => void;
      overlayHandle?: unknown;
    };
    expect(priv.cleanupFn, "popup repositioned on reconnect").to.be.a(
      "function"
    );
    expect(priv.overlayHandle, "overlay reactivated on reconnect").to.exist;

    // Reconnection takes a separate overlay-activation path. Its replacement overlay must still
    // own Escape rather than leaving an open, keyboard-undismissable popup behind.
    const afterHide = oneEvent(el, "lr-after-hide");
    const escape = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    el.ownerDocument.dispatchEvent(escape);
    await afterHide;
    expect(escape.defaultPrevented).to.equal(true);
    expect(el.open).to.equal(false);

    el.remove();
  });

  it("adoptedCallback tears down positioning, the overlay, and cross-document listeners", async () => {
    const el = (await fixture(
      html`<lr-date-input open></lr-date-input>`
    )) as LyraDateInput;
    await el.updateComplete;
    const priv = el as unknown as {
      cleanupFn?: () => void;
      overlayHandle?: { deactivate: (opts: { restoreFocus: boolean }) => void };
      visibilityListenerDocument?: Document;
      pointerListenerDocument?: Document;
      adoptedCallback(): void;
    };
    expect(priv.cleanupFn, "positioned while open").to.be.a("function");
    expect(priv.overlayHandle, "overlay active while open").to.exist;
    expect(
      priv.visibilityListenerDocument != null,
      "visibility listener bound"
    ).to.equal(true);
    expect(
      priv.pointerListenerDocument != null,
      "pointer listener bound"
    ).to.equal(true);

    let deactivated = false;
    priv.overlayHandle!.deactivate = () => {
      deactivated = true;
    };

    priv.adoptedCallback();

    expect(deactivated, "the overlay handle was deactivated").to.be.true;
    expect(priv.cleanupFn, "positioning cleanup cleared").to.equal(undefined);
    expect(priv.overlayHandle, "overlay handle cleared").to.equal(undefined);
    expect(
      priv.visibilityListenerDocument === undefined,
      "visibility listener unbound"
    ).to.equal(true);
    expect(
      priv.pointerListenerDocument === undefined,
      "pointer listener unbound"
    ).to.equal(true);
  });
});

it("removes a previously-registered interaction listener when assumeInteractionOn drops it", async () => {
  const el = (await fixture(
    html`<lr-date-input></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  const priv = el as unknown as {
    interactionListeners: Map<string, EventListener>;
  };
  expect(priv.interactionListeners.has("input")).to.be.true;
  el.assumeInteractionOn = [];
  await el.updateComplete;
  expect(priv.interactionListeners.has("input")).to.be.false;
});

it("Alt+ArrowDown opens the calendar from the keyboard and prevents the default action", async () => {
  const el = (await fixture(
    html`<lr-date-input></lr-date-input>`
  )) as LyraDateInput;
  const input = el.shadowRoot!.querySelector(
    '[part="input"]'
  ) as HTMLInputElement;
  const event = new KeyboardEvent("keydown", {
    key: "ArrowDown",
    altKey: true,
    bubbles: true,
    composed: true,
    cancelable: true,
  });
  input.dispatchEvent(event);
  expect(event.defaultPrevented).to.be.true;
  expect(el.open).to.be.true;
});

it("does not commit or dispatch a native change when Enter is pressed over unparseable text", async () => {
  const el = (await fixture(
    html`<lr-date-input value="2026-07-15"></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector(
    '[part="input"]'
  ) as HTMLInputElement;
  const committedDisplay = input.value;
  input.value = "not a date";
  let changes = 0;
  el.addEventListener("change", () => {
    changes += 1;
  });
  input.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      composed: true,
      cancelable: true,
    })
  );
  expect(el.value).to.equal("2026-07-15");
  expect(input.value).to.equal(committedDisplay);
  expect(changes).to.equal(0);
  expect(el.internals.validity.badInput).to.be.true;
});

it("contains an unbroken end adornment in a 320px LTR or RTL allocation", async () => {
  const adornment = "LocalizedDateMetadata".repeat(64);
  for (const direction of ["ltr", "rtl"] as const) {
    const wrapper = await fixture<HTMLElement>(html`
      <div
        dir=${direction}
        style="inline-size: 320px; max-inline-size: 320px; overflow: auto"
      >
        <lr-date-input style="max-inline-size: 100%"
          ><span slot="end">${adornment}</span></lr-date-input
        >
      </div>
    `);
    const el = wrapper.querySelector("lr-date-input") as LyraDateInput;
    const inputWrapper = el.shadowRoot!.querySelector<HTMLElement>(
      '[part="input-wrapper"]'
    )!;
    expect(
      wrapper.scrollWidth,
      `${direction} wrapper scroll width`
    ).to.be.at.most(wrapper.clientWidth);
    expect(
      inputWrapper.scrollWidth,
      `${direction} input wrapper scroll width`
    ).to.be.at.most(inputWrapper.clientWidth);
  }
});
