// Focused interaction and event contracts cases. Test bodies and titles were moved intact from the prior suite.
import { fixture, expect, oneEvent, html } from "@open-wc/testing";
import "./date-input.js";
import "../button/button.js";
import type { LyraDateInput } from "./date-input.js";
import type { LyraDatePicker } from "./date-picker.js";
import { styles } from "./date-input.styles.js";
import { resetMouse, sendMouse } from "../../../../test/wtr-mouse.js";
import "../../../translations/ar/forms.js";
import "../../../translations/ar/shared.js";
import "../../../translations/fr/forms.js";
import "../../../translations/fr/shared.js";
import "../../../translations/fa/forms.js";
import "../../../translations/fa/shared.js";



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

it("propagates disable-past/disable-future/with-outside-days to the nested lr-date-picker", async () => {
  const el = (await fixture(
    html`<lr-date-input
      disable-past
      disable-future
      with-outside-days
    ></lr-date-input>`
  )) as LyraDateInput;
  await el.show();
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

it("clamps the popup to the viewport width like the combobox listbox", () => {
  expect(styles.cssText).to.match(
    /max-inline-size:\s*min\(\s*var\(--lr-popover-viewport-clamp\),\s*var\(--lr-size-28rem\)\s*\)/
  );
});

it("renders no calendar while disabled or readonly, and drops an open one once its forced close settles", async () => {
  const el = (await fixture(
    html`<lr-date-input value="2026-07-15" disabled></lr-date-input>`
  )) as LyraDateInput;
  await el.show();
  expect(el.shadowRoot!.querySelector("lr-date-picker") === null, "a disabled field never opens").to.equal(true);

  el.disabled = false;
  el.readonly = true;
  await el.show();
  expect(el.shadowRoot!.querySelector("lr-date-picker") === null, "a readonly field never opens").to.equal(true);

  el.readonly = false;
  await el.show();
  expect(el.shadowRoot!.querySelector("lr-date-picker") !== null, "an open field renders it").to.equal(true);
  const closed = new Promise((resolve) => el.addEventListener("lr-after-hide", resolve, { once: true }));
  el.disabled = true;
  await closed;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector("lr-date-picker") === null, "the settled close drops it").to.equal(true);
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

it("re-binds positioning when reopened after a disconnect+reconnect while open", async () => {
  const el = (await fixture(
    html`<lr-date-input open></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  const parent = el.parentElement!;
  el.remove();
  parent.appendChild(el);
  await el.updateComplete;
  await el.show();
  const popup = el.shadowRoot!.querySelector(
    '[part="popup"] [part="date-picker"]'
  )!;
  expect(popup != null).to.equal(true); // the reopened calendar renders and is positioned again
  expect(el.shadowRoot!.querySelector('[part="popup"]')!.hasAttribute("data-positioned")).to.equal(true);
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

it("restores the opener when the popup is closed by assigning open = false", async () => {
  // Escape and a finalized selection both close through `hide(true)`, which raises the private
  // restore flag. An application that closes the popup by assigning the property directly never
  // goes through `hide()` at all -- and the popup hides with `visibility: hidden`, which
  // force-blurs whatever was focused inside it. Without a live "focus is still inside the popup"
  // term, a keyboard user standing on a calendar day is dropped onto <body>.
  const el = (await fixture(
    html`<lr-date-input
      style="--show-duration: 0s; --hide-duration: 0s"
    ></lr-date-input>`
  )) as LyraDateInput;
  const expand = el.shadowRoot!.querySelector(
    '[part="expand-button"]'
  ) as HTMLButtonElement;
  expand.focus();
  await el.show();
  const picker = el.shadowRoot!.querySelector(
    "lr-date-picker"
  ) as LyraDatePicker;
  await picker.updateComplete;
  const day = picker.shadowRoot!.querySelector(
    '[part~="day"][tabindex="0"]'
  ) as HTMLButtonElement;
  day.focus();
  expect(
    picker.shadowRoot!.activeElement === day,
    "a calendar day must really hold focus before the popup closes"
  ).to.equal(true);

  el.open = false;
  await el.updateComplete;
  // The platform's force-blur for the now-hidden popup lands on a later rendering step, so give
  // it one before reading focus -- otherwise the unfixed component looks fine for one microtask.
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await new Promise((r) => requestAnimationFrame(() => r(null)));

  // Report the stranded host's tag name rather than a bare `undefined` when this regresses.
  const restored =
    el.shadowRoot!.activeElement?.getAttribute("part") ??
    document.activeElement?.localName;
  expect(
    restored,
    "a direct `open = false` must hand focus back to the trigger, not strand it on <body>"
  ).to.equal("expand-button");
  expect(document.activeElement?.localName).to.equal("lr-date-input");
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
    await new Promise<void>((resolve) => queueMicrotask(resolve));
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

  // Two simultaneously open date-inputs on one document, the lower one reconnected while open so
  // its overlay entry is registered through `reconnectOpenPopup()`'s own `panel` resolver rather
  // than `updated()`'s (see the previous test). `#outside` holds focus throughout, so it is also
  // the upper popup's captured focus-return target.
  async function stackAboveReconnectedDateInput(): Promise<{
    lower: LyraDateInput;
    upper: LyraDateInput;
    outside: HTMLButtonElement;
  }> {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div>
        <lr-date-input
          id="lower"
          style="--show-duration: 1ms; --hide-duration: 1ms"
        ></lr-date-input>
        <lr-date-input
          id="upper"
          style="--show-duration: 1ms; --hide-duration: 1ms"
        ></lr-date-input>
        <button id="outside">Outside</button>
      </div>
    `);
    const lower = wrapper.querySelector("#lower") as LyraDateInput;
    const upper = wrapper.querySelector("#upper") as LyraDateInput;
    const outside = wrapper.querySelector("#outside") as HTMLButtonElement;
    outside.focus();

    await lower.show();
    await lower.updateComplete;
    expect(lower.open).to.be.true;

    lower.remove();
    expect(lower.open, "disconnect resets open").to.be.false;
    (lower as unknown as { open: boolean }).open = true; // still-open state going into the reconnect
    wrapper.appendChild(lower);
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    await lower.updateComplete;
    expect(lower.open, "lower stays open across the reconnect").to.be.true;

    await upper.show();
    await upper.updateComplete;
    expect(upper.open, "upper stacks above the already-reconnected lower").to
      .be.true;
    return { lower, upper, outside };
  }

  it("hands focus to a reconnected instance's own popup resolver when a stacked overlay above it closes while holding focus", async () => {
    // The reconnect-sourced `panel` resolver is only ever invoked by the overlay manager itself:
    // when the entry stacked above it closes while holding focus and focus cannot return to where
    // it came from, focus falls through to whichever entry is now topmost. Focus is placed inside
    // the upper popup and its captured return target is removed, so closing it must exercise the
    // reconnected resolver instead of leaving it dead code.
    const { lower, upper, outside } = await stackAboveReconnectedDateInput();
    const picker = upper.shadowRoot!.querySelector(
      "lr-date-picker"
    ) as LyraDatePicker;
    await picker.updateComplete;
    const day = picker.shadowRoot!.querySelector(
      '[part~="day"][tabindex="0"]'
    ) as HTMLButtonElement;
    day.focus();
    expect(picker.shadowRoot!.activeElement === day).to.equal(true);
    outside.remove();

    const afterHide = oneEvent(upper, "lr-after-hide");
    void upper.hide();
    await upper.updateComplete;
    await afterHide;
    expect(upper.open, "the topmost stacked instance closed").to.be.false;
    expect(
      lower.open,
      "the reconnected instance underneath is untouched"
    ).to.be.true;
    expect(
      lower.shadowRoot!.activeElement?.tagName.toLowerCase(),
      "closing the entry above hands focus into the still-open reconnected popup"
    ).to.equal("lr-date-picker");
  });

  it("leaves outside focus alone when a stacked overlay above a still-open reconnected instance closes without holding it", async () => {
    // The overlay that closes never held focus, so the shared stack must not pull focus out of
    // an unrelated control and into the popup that happens to sit beneath it.
    const { lower, upper } = await stackAboveReconnectedDateInput();

    const afterHide = oneEvent(upper, "lr-after-hide");
    void upper.hide();
    await upper.updateComplete;
    await afterHide;
    expect(upper.open, "the topmost stacked instance closed").to.be.false;
    expect(
      lower.open,
      "the reconnected instance underneath is untouched"
    ).to.be.true;
    expect(
      document.activeElement?.id ?? document.activeElement?.localName ?? "none",
      "focus stays on the unrelated control"
    ).to.equal("outside");
    expect(
      lower.shadowRoot!.activeElement === null,
      "the popup beneath does not take focus"
    ).to.equal(true);
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

it('keeps date rows on the shared height ladder with calendar and clear targets of at least 24px', async () => {
  for (const [size, height] of [['2xs', 26], ['xs', 26], ['s', 32], ['m', 36], ['l', 40], ['xl', 56]] as const) {
    const el = await fixture<LyraDateInput>(html`<lr-date-input size=${size} value="2026-09-07" with-clear></lr-date-input>`);
    const row = el.shadowRoot!.querySelector<HTMLElement>('[part="input-wrapper"]')!;
    expect(row.getBoundingClientRect().height, size).to.be.closeTo(height, 0.1);
    for (const part of ['clear-button', 'expand-button']) {
      const rect = el.shadowRoot!.querySelector(`[part="${part}"]`)!.getBoundingClientRect();
      expect(rect.width, `${size} ${part}`).to.be.at.least(24);
      expect(rect.height, `${size} ${part}`).to.be.at.least(24);
      expect(rect.height, `${size} ${part}`).to.be.at.most(row.getBoundingClientRect().height);
    }
  }
});

describe('lr-date-input adornment allocation', () => {
  const part = (el: LyraDateInput, name: string) =>
    el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;
  const contentWidth = (node: Element) => {
    const style = getComputedStyle(node);
    return node.clientWidth - parseFloat(style.paddingInlineStart) - parseFloat(style.paddingInlineEnd);
  };
  const textWidth = (reference: Element, text: string) => {
    const style = getComputedStyle(reference);
    const probe = document.createElement('span');
    probe.textContent = text;
    probe.style.cssText = 'position: absolute; visibility: hidden; white-space: pre';
    for (const property of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing'] as const) {
      probe.style[property] = style[property];
    }
    document.body.append(probe);
    try {
      return probe.getBoundingClientRect().width;
    } finally {
      probe.remove();
    }
  };

  it('keeps a short end adornment whole while the date field shrinks first, mirrored under RTL', async () => {
    for (const direction of ['ltr', 'rtl'] as const) {
      const wrapper = await fixture<HTMLElement>(html`
        <div dir=${direction} style="inline-size: 180px">
          <lr-date-input value="2026-01-01" aria-label="Billing date"><span slot="end">UTC</span></lr-date-input>
        </div>
      `);
      const el = wrapper.querySelector('lr-date-input') as LyraDateInput;
      await el.updateComplete;
      const unit = el.querySelector('span')!;
      const end = part(el, 'end');
      const native = part(el, 'input');
      const row = part(el, 'input-wrapper');
      expect(unit.scrollWidth, `${direction}: the adornment text is clipped`).to.be.at.most(unit.clientWidth);
      expect(end.scrollWidth, `${direction}: the end part clips its adornment`).to.be.at.most(end.clientWidth);
      expect(contentWidth(native), `${direction}: the date field collapsed`).to.be.at.least(
        textWidth(native, '0000'),
      );
      expect(row.scrollWidth, `${direction}: the row overflows`).to.be.at.most(row.clientWidth);
      const endBox = end.getBoundingClientRect();
      const inputBox = native.getBoundingClientRect();
      if (direction === 'ltr') {
        expect(endBox.left, 'ltr: the adornment trails the field').to.be.at.least(inputBox.right - 0.5);
      } else {
        expect(endBox.right, 'rtl: the adornment trails the field on the left').to.be.at.most(inputBox.left + 0.5);
      }
    }
  });

  it('sizes a short adornment to its content instead of reserving 40% of a wide row', async () => {
    const el = await fixture<LyraDateInput>(html`
      <lr-date-input style="inline-size: 400px" value="2026-01-01" aria-label="Billing date"
        ><span slot="end">UTC</span></lr-date-input
      >
    `);
    const unit = el.querySelector('span')!;
    expect(part(el, 'end').getBoundingClientRect().width).to.be.closeTo(unit.getBoundingClientRect().width, 1);
  });

  it('caps a long adornment at 40% of the row', async () => {
    for (const slot of ['start', 'end'] as const) {
      const el = await fixture<LyraDateInput>(html`
        <lr-date-input style="inline-size: 240px" aria-label="Billing date"
          ><span slot=${slot}>Adornment text that is far too long.</span></lr-date-input
        >
      `);
      const row = part(el, 'input-wrapper');
      expect(part(el, slot).getBoundingClientRect().width, slot).to.be.at.most(contentWidth(row) * 0.4 + 0.5);
      expect(row.scrollWidth, `${slot}: the row overflows`).to.be.at.most(row.clientWidth);
    }
  });

  it('keeps a four-character field floor between two long adornments', async () => {
    const el = await fixture<LyraDateInput>(html`
      <lr-date-input style="inline-size: 240px" value="2026-01-01" aria-label="Billing date"
        ><span slot="start">VeryLongLeadingAdornment</span
        ><span slot="end">VeryLongTrailingAdornment</span></lr-date-input
      >
    `);
    const native = part(el, 'input');
    const row = part(el, 'input-wrapper');
    expect(native.getBoundingClientRect().width, 'the date field collapsed').to.be.at.least(
      textWidth(native, '0000') - 0.5,
    );
    expect(row.scrollWidth).to.be.at.most(row.clientWidth);
  });

  it('lets the date field of a row without adornments yield to its clear and calendar actions', async () => {
    // The field floor only protects against adornments: with none, the field is the only item that
    // can shrink, so a narrow row must still fit both fixed actions inside its border. The widths
    // clear the two actions' own minimum but not that minimum plus a 4-character floor.
    for (const width of [120, 130]) {
      for (const direction of ['ltr', 'rtl'] as const) {
        const wrapper = await fixture<HTMLElement>(html`
          <div dir=${direction} style=${`inline-size: ${width}px`}>
            <lr-date-input with-clear value="2026-01-01" aria-label="Billing date"></lr-date-input>
          </div>
        `);
        const el = wrapper.querySelector('lr-date-input') as LyraDateInput;
        await el.updateComplete;
        const row = part(el, 'input-wrapper');
        const rowBox = row.getBoundingClientRect();
        expect(row.scrollWidth, `${width}px ${direction}: the row overflows`).to.be.at.most(row.clientWidth);
        for (const action of ['clear-button', 'expand-button']) {
          const box = part(el, action).getBoundingClientRect();
          expect(box.left, `${width}px ${direction}: ${action} leaves the row`).to.be.at.least(rowBox.left - 0.5);
          expect(box.right, `${width}px ${direction}: ${action} leaves the row`).to.be.at.most(rowBox.right + 0.5);
        }
      }
    }
  });
});

it("accepts `clearable` as the library-wide spelling of `with-clear`", async () => {
  const el = (await fixture(html`<lr-date-input clearable value="2026-07-15"></lr-date-input>`)) as LyraDateInput;
  await el.updateComplete;
  expect(el.clearable).to.equal(true);
  const clear = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="clear-button"]');
  expect(clear, "the clear action renders").to.exist;
  clear!.click();
  await el.updateComplete;
  expect(el.value).to.equal("");
  el.clearable = false;
  el.value = "2026-07-15";
  await el.updateComplete;
  expect(el.hasAttribute("clearable")).to.equal(false);
  expect(el.shadowRoot!.querySelector('[part="clear-button"]') === null, "neither spelling set").to.equal(true);
});

it("closes on an outside press even when the pressed element stops pointerdown propagation", async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div>
    <lr-date-input value="2026-07-15"></lr-date-input>
    <button id="outside" style="margin-block-start: 400px">Outside</button>
  </div>`);
  const el = wrapper.querySelector("lr-date-input") as LyraDateInput;
  const outside = wrapper.querySelector<HTMLButtonElement>("#outside")!;
  outside.addEventListener("pointerdown", (event) => event.stopPropagation());
  await el.show();
  const rect = outside.getBoundingClientRect();
  try {
    await sendMouse({ type: "click", position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)] });
    await el.updateComplete;
    expect(el.open).to.equal(false);
  } finally {
    await resetMouse();
  }
});

it("returns focus to the field when its clear button empties it, unlike clear()", async () => {
  const el = (await fixture(html`<lr-date-input with-clear value="2026-07-15"></lr-date-input>`)) as LyraDateInput;
  await el.updateComplete;
  const order: string[] = [];
  for (const type of ["input", "change", "lr-clear"]) el.addEventListener(type, () => order.push(type));
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="clear-button"]')!.click();
  await el.updateComplete;
  expect(order).to.deep.equal(["input", "change", "lr-clear"]);
  expect(el.shadowRoot!.activeElement === el.shadowRoot!.querySelector('[part="input"]'), "focus returns to the field").to.equal(true);
});

it("reads and writes valueAsLocalDate (local midnight, like valueAsDate) and valueAsUTCDate (UTC midnight)", async () => {
  const el = (await fixture(html`<lr-date-input value="2026-10-06"></lr-date-input>`)) as LyraDateInput;
  expect(el.valueAsLocalDate!.getTime()).to.equal(el.valueAsDate!.getTime());
  expect(el.valueAsUTCDate!.toISOString()).to.equal("2026-10-06T00:00:00.000Z");
  el.valueAsUTCDate = new Date("2026-12-31T00:00:00Z");
  const utc = el.value;
  el.valueAsLocalDate = new Date(2027, 0, 2, 23, 30);
  expect([utc, el.value]).to.deep.equal(["2026-12-31", "2027-01-02"]);
  el.mode = "range";
  el.value = "2026-10-06/2026-10-09";
  expect([el.valueAsLocalDate, el.valueAsUTCDate]).to.deep.equal([null, null]);
});

it("renders its calendar only while the popup is open or settling", async () => {
  const el = (await fixture(html`<lr-date-input value="2026-07-15"></lr-date-input>`)) as LyraDateInput;
  const picker = () => el.shadowRoot!.querySelector("lr-date-picker");
  expect(picker() === null, "a closed field carries no calendar").to.equal(true);
  await el.show();
  expect(picker() !== null).to.equal(true);
  await el.hide();
  await el.updateComplete;
  expect(picker() === null, "the settled close drops it").to.equal(true);
});
