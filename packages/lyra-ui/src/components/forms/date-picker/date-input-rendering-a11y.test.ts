// Focused rendering and accessibility cases. Test bodies and titles were moved intact from the prior suite.
import { fixture, expect, oneEvent, html, waitUntil } from "@open-wc/testing";
import "./date-input.js";
import "../button/button.js";
import type { LyraDateInput } from "./date-input.js";
import type { LyraDatePicker } from "./date-picker.js";
import { styles } from "./date-input.styles.js";
import { resetMouse, sendMouse } from "../../../../test/wtr-mouse.js";
import { setReducedMotion } from "../../../../test/wtr-media.js";
import "../../../translations/ar/forms.js";
import "../../../translations/ar/shared.js";
import "../../../translations/fr/forms.js";
import "../../../translations/fr/shared.js";
import "../../../translations/fa/forms.js";
import "../../../translations/fa/shared.js";

interface WindowWithDate extends Window {
  Date: DateConstructor;
}

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
  const compactInput = compact.shadowRoot!.querySelector(
    '[part="input"]'
  ) as HTMLElement;
  const regularInput = regular.shadowRoot!.querySelector(
    '[part="input"]'
  ) as HTMLElement;

  expect(
    Number.parseFloat(getComputedStyle(compactInput).paddingTop)
  ).to.be.lessThan(
    Number.parseFloat(getComputedStyle(regularInput).paddingTop)
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

it("is accessible", async () => {
  const el = (await fixture(
    html`<lr-date-input label="Start date" value="2026-07-15"></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it("transitions the popup with the shared fast-transition token and respects reduced motion", async () => {
  const css = styles.cssText;
  const popupBlock = /\[part=['"]?popup['"]?]\s*{([^}]*)}/.exec(css);
  expect(popupBlock, 'expected a base [part="popup"] rule').to.not.equal(null);
  expect(popupBlock![1]).to.include("var(--lr-transition-fast)");
  expect(css).to.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);

  try {
    await setReducedMotion("no-preference");
    const el = (await fixture(
      html`<lr-date-input style="--lr-transition-fast: 2s"></lr-date-input>`
    )) as LyraDateInput;
    const popup = el.shadowRoot!.querySelector<HTMLElement>('[part="popup"]')!;
    expect(getComputedStyle(popup).transitionDuration).to.equal("2s");

    await setReducedMotion("reduce");
    await waitUntil(
      () => getComputedStyle(popup).transitionDuration === "0s",
      "date-input popup transition did not stop under reduced motion"
    );
  } finally {
    await setReducedMotion("no-preference");
  }
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

it("falls back to the default locale when a malformed locale is supplied", async () => {
  // A malformed locale can never have a registered catalog, so this intentionally exercises
  // the dev-mode locale-fallback warning path -- swallow it rather than letting it reach
  // strict-console lanes.
  const originalWarn = console.warn;
  console.warn = () => {};
  let input: HTMLInputElement;
  let picker: LyraDatePicker;
  try {
    const el = (await fixture(
      html`<lr-date-input
        value="2026-07-15"
        locale="not_a_locale"
      ></lr-date-input>`
    )) as LyraDateInput;
    input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
    picker = el.shadowRoot!.querySelector("lr-date-picker") as LyraDatePicker;
    await picker.updateComplete;
  } finally {
    console.warn = originalWarn;
  }

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

it("does not override an explicit `label` slot with the fallback aria-label", async () => {
  const el = (await fixture(
    html`<lr-date-input><span slot="label">Start date</span></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
  expect(input.getAttribute("aria-label")).to.not.equal("Date");
});

it("reports aria-invalid=true for an author-supplied error-text even before the field is touched", async () => {
  const el = (await fixture(
    html`<lr-date-input error-text="Required"></lr-date-input>`
  )) as LyraDateInput;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
  expect(input.getAttribute("aria-invalid")).to.equal("true");

  el.errorText = "";
  await el.updateComplete;
  expect(input.getAttribute("aria-invalid")).to.equal("false");
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

  it('returns to the shared row height when the exact-height override is removed', async () => {
    const el = (await fixture(
      html`<lr-date-input value="2026-07-15"></lr-date-input>`
    )) as LyraDateInput;
    await el.updateComplete;
    const w = wrapper(el);
    const natural = getComputedStyle(w).blockSize;
    expect(Number.parseFloat(natural)).to.equal(
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

it("clamps its open floating surface width through the shared popover-viewport-clamp token", async () => {
  const el = (await fixture(
    html`<lr-date-input style="--lr-popover-viewport-clamp: 10px"></lr-date-input>`
  )) as LyraDateInput;
  await el.show();
  await el.updateComplete;
  const popup = el.shadowRoot!.querySelector<HTMLElement>('[part="popup"]')!;
  await waitUntil(
    () => popup.getAttribute('aria-hidden') === 'false',
    'the opened date input did not expose its popup'
  );

  expect(getComputedStyle(popup).maxInlineSize).to.equal('10px');
});

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
    // rather than letting that propagate out of a keystroke handler. It can also never have a
    // registered catalog, so this intentionally exercises the dev-mode locale-fallback warning
    // path too -- swallow it rather than letting it reach strict-console lanes.
    const originalWarn = console.warn;
    console.warn = () => {};
    let el: LyraDateInput;
    try {
      el = (await fixture(
        html`<lr-date-input locale="not_a_locale"></lr-date-input>`
      )) as LyraDateInput;
    } finally {
      console.warn = originalWarn;
    }
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

it("leaves focus on the newly pressed target when an outside pointer closes the popup", async () => {
  // The companion of the `open = false` restore below: an outside press closes through
  // `hide(false)` and must still settle on whatever the user pressed, never on the trigger. Real
  // mouse input, because the press's own focus default action is what settles it, and that runs
  // after the close renders.
  const wrapper = await fixture(html`
    <div>
      <lr-date-input
        style="--show-duration: 0s; --hide-duration: 0s"
      ></lr-date-input>
      <button id="outside" style="margin-block-start: 30rem">Outside</button>
    </div>
  `);
  const el = wrapper.querySelector("lr-date-input") as LyraDateInput;
  const outside = wrapper.querySelector("#outside") as HTMLButtonElement;
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
  expect(picker.shadowRoot!.activeElement === day).to.equal(true);

  try {
    const rect = outside.getBoundingClientRect();
    await sendMouse({
      type: "click",
      position: [
        Math.round(rect.left + rect.width / 2),
        Math.round(rect.top + rect.height / 2),
      ],
    });
    await el.updateComplete;
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    expect(el.open, "the outside press closed the popup").to.equal(false);
    expect(
      document.activeElement?.id ?? document.activeElement?.localName ?? "none",
      "an outside press keeps focus on its own target rather than restoring the trigger"
    ).to.equal("outside");
  } finally {
    await resetMouse();
  }
});

describe("focus indicator per appearance", () => {
  for (const appearance of [
    "outlined",
    "filled",
    "filled-outlined",
    "accent",
    "plain",
  ] as const) {
    it(`retints the ${appearance} input row's border while focus is inside it (WCAG 2.4.7)`, async () => {
      const el = (await fixture(html`
        <lr-date-input
          appearance=${appearance}
          style="--lr-transition-fast: 0s; --lr-date-input-focus-border-color: rgb(1, 2, 3);"
        ></lr-date-input>
      `)) as LyraDateInput;
      await el.updateComplete;
      const wrapper = el.shadowRoot!.querySelector<HTMLElement>(
        '[part="input-wrapper"]'
      )!;
      const field = el.shadowRoot!.querySelector<HTMLInputElement>(
        '[part="input"]'
      )!;
      const resting = getComputedStyle(wrapper).borderTopColor;
      field.focus();
      await el.updateComplete;
      const focused = getComputedStyle(wrapper).borderTopColor;
      expect(focused, `${appearance} focus-within border`).to.equal(
        "rgb(1, 2, 3)"
      );
      expect(focused, `${appearance} focus vs resting border`).to.not.equal(
        resting
      );
      field.blur();
    });
  }
});

describe("appearance renders the full shared vocabulary", () => {
  it("renders accent distinctly from the outlined default", async () => {
    const outlined = (await fixture(
      html`<lr-date-input appearance="outlined"></lr-date-input>`
    )) as LyraDateInput;
    const accent = (await fixture(
      html`<lr-date-input appearance="accent"></lr-date-input>`
    )) as LyraDateInput;
    await outlined.updateComplete;
    await accent.updateComplete;
    expect(accent.appearance).to.equal("accent");
    expect(accent.getAttribute("appearance")).to.equal("accent");
    const outlinedWrapper = outlined.shadowRoot!.querySelector<HTMLElement>(
      '[part="input-wrapper"]'
    )!;
    const accentWrapper = accent.shadowRoot!.querySelector<HTMLElement>(
      '[part="input-wrapper"]'
    )!;
    expect(
      getComputedStyle(accentWrapper).backgroundColor,
      "accent vs outlined background"
    ).to.not.equal(getComputedStyle(outlinedWrapper).backgroundColor);
  });

  it("renders plain distinctly from the outlined default", async () => {
    const outlined = (await fixture(
      html`<lr-date-input appearance="outlined"></lr-date-input>`
    )) as LyraDateInput;
    const plain = (await fixture(
      html`<lr-date-input appearance="plain"></lr-date-input>`
    )) as LyraDateInput;
    await outlined.updateComplete;
    await plain.updateComplete;
    expect(plain.appearance).to.equal("plain");
    expect(plain.getAttribute("appearance")).to.equal("plain");
    const outlinedWrapper = outlined.shadowRoot!.querySelector<HTMLElement>(
      '[part="input-wrapper"]'
    )!;
    const plainWrapper = plain.shadowRoot!.querySelector<HTMLElement>(
      '[part="input-wrapper"]'
    )!;
    expect(
      getComputedStyle(plainWrapper).borderTopColor,
      "plain vs outlined border"
    ).to.not.equal(getComputedStyle(outlinedWrapper).borderTopColor);
  });

  it("clamps a genuinely unknown attribute set at first parse to the default", async () => {
    const el = (await fixture(
      html`<lr-date-input appearance="bogus"></lr-date-input>`
    )) as LyraDateInput;
    await el.updateComplete;
    expect(el.appearance).to.equal("outlined");
    expect(el.getAttribute("appearance")).to.equal("outlined");
  });

  it("clamps a genuinely unknown attribute written later, repairing the raw attribute", async () => {
    const el = (await fixture(
      html`<lr-date-input></lr-date-input>`
    )) as LyraDateInput;
    el.setAttribute("appearance", "bogus");
    await el.updateComplete;
    expect(el.appearance).to.equal("outlined");
    expect(el.getAttribute("appearance")).to.equal("outlined");
  });

  it("keeps every documented value unchanged", async () => {
    for (const appearance of [
      "outlined",
      "filled",
      "filled-outlined",
      "accent",
      "plain",
    ] as const) {
      const el = (await fixture(
        html`<lr-date-input></lr-date-input>`
      )) as LyraDateInput;
      el.setAttribute("appearance", appearance);
      await el.updateComplete;
      expect(el.appearance).to.equal(appearance);
      expect(el.getAttribute("appearance")).to.equal(appearance);
    }
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
    const frameWindow = frame.contentWindow as WindowWithDate | null;
    if (!frameWindow) throw new Error('The iframe window was unavailable.');
    const ForeignDate = frameWindow.Date;
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

describe('coverage-gap fixes', () => {
  it('clears the touched/data-invalid state on form.reset()', async () => {
    const form = (await fixture(html`
      <form><lr-date-input name="d" required value="2026-07-15"></lr-date-input></form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-date-input") as LyraDateInput;
    const input = el.shadowRoot!.querySelector(
      '[part="input"]'
    ) as HTMLInputElement;
    el.value = "";
    input.dispatchEvent(new FocusEvent("blur"));
    await el.updateComplete;
    expect(el.hasAttribute("data-invalid"), "blank required field is invalid and touched").to.be.true;

    form.reset();
    await el.updateComplete;
    expect(el.value).to.equal("2026-07-15");
    expect(
      el.hasAttribute("data-invalid"),
      "reset clears the touched flag along with restoring the default value"
    ).to.be.false;
  });

  it('preserves a setCustomValidity() message across form.reset()', async () => {
    const form = (await fixture(html`
      <form><lr-date-input name="d" value="2026-07-15"></lr-date-input></form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-date-input") as LyraDateInput;
    el.setCustomValidity("No longer available");
    expect(el.validity.customError).to.be.true;

    el.value = "2026-08-01";
    form.reset();
    await el.updateComplete;
    expect(el.value).to.equal("2026-07-15");
    expect(
      el.validity.customError,
      "a custom validity error survives a native reset"
    ).to.be.true;
    expect(el.validationMessage).to.equal("No longer available");
  });

  it('recovers from a malformed runtime locale instead of throwing while normalizing typed digits', async () => {
    // A malformed locale can never have a registered catalog, and the nested lr-date-picker's
    // own calendar strings resolve on a later update than this outer fixture() await -- so this
    // intentionally exercises the dev-mode locale-fallback warning path for the whole test body,
    // swallowing it rather than letting it reach strict-console lanes.
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      const el = (await fixture(
        html`<lr-date-input locale="!!not-a-locale!!"></lr-date-input>`
      )) as LyraDateInput;
      const input = el.shadowRoot!.querySelector(
        '[part="input"]'
      ) as HTMLInputElement;
      input.value = "2026-07-15";
      setTimeout(() => input.dispatchEvent(new Event("change")));
      await oneEvent(el, "change");
      expect(el.value).to.equal("2026-07-15");
    } finally {
      console.warn = originalWarn;
    }
  });

  it('recovers when the locale-digit number formatter itself throws while normalizing typed text', async () => {
    // The previous test proves a malformed `locale` attribute never reaches the formatter (it
    // gets sanitized to a valid tag first). This one forces the formatter construction itself to
    // throw, which is the only way to actually reach `normalizeLocalizedDateText()`'s own catch
    // -- the same technique the sibling `Intl.DateTimeFormat` stubs below already use.
    const el = (await fixture(
      html`<lr-date-input></lr-date-input>`
    )) as LyraDateInput;
    const input = el.shadowRoot!.querySelector(
      '[part="input"]'
    ) as HTMLInputElement;
    const original = Object.getOwnPropertyDescriptor(
      Intl.NumberFormat.prototype,
      "format"
    )!;
    try {
      Object.defineProperty(Intl.NumberFormat.prototype, "format", {
        configurable: true,
        get() {
          return () => {
            throw new Error("boom");
          };
        },
      });
      input.value = "2026-07-15";
      setTimeout(() => input.dispatchEvent(new Event("change")));
      await oneEvent(el, "change");
      expect(
        el.value,
        "ASCII digits still parse when locale-digit normalization itself throws"
      ).to.equal("2026-07-15");
    } finally {
      Object.defineProperty(Intl.NumberFormat.prototype, "format", original);
    }
  });

  it('commits a single-endpoint valueAsRange assignment as a plain (non-range-separator) ISO value', async () => {
    const el = (await fixture(
      html`<lr-date-input mode="range"></lr-date-input>`
    )) as LyraDateInput;
    el.valueAsRange = { from: new Date(2026, 6, 20), to: null };
    expect(el.value).to.equal("2026-07-20");
  });

  it('reports a null valueAsDate while in range mode', async () => {
    const el = (await fixture(
      html`<lr-date-input mode="range" value="2026-07-10/2026-07-15"></lr-date-input>`
    )) as LyraDateInput;
    expect(el.valueAsDate).to.equal(null);
  });

  it('disables a date solely through a numeric disabled-days-of-week token', async () => {
    const el = (await fixture(
      html`<lr-date-input value="2026-07-15"></lr-date-input>`
    )) as LyraDateInput;
    const weekday = new Date(2026, 6, 15).getDay();
    el.disabledDaysOfWeek = String(weekday);
    await el.updateComplete;
    expect(
      el.validity.customError,
      "the numeric weekday token disables the committed date"
    ).to.be.true;
  });

  it('raises customError from isDateDisabled alone, with no disabledDates/disabledDaysOfWeek configured', async () => {
    const el = (await fixture(
      html`<lr-date-input value="2026-07-15"></lr-date-input>`
    )) as LyraDateInput;
    el.isDateDisabled = (date) => date.getDate() === 15;
    await el.updateComplete;
    expect(el.validity.customError).to.be.true;
  });

  it('falls back to a manual dash-joined display when Intl formatRange itself throws', async () => {
    const el = (await fixture(
      html`<lr-date-input mode="range" value="2026-07-10/2026-07-15"></lr-date-input>`
    )) as LyraDateInput;
    const input = el.shadowRoot!.querySelector(
      '[part="input"]'
    ) as HTMLInputElement;
    const original = Intl.DateTimeFormat.prototype.formatRange;
    try {
      Intl.DateTimeFormat.prototype.formatRange = () => {
        throw new Error("boom");
      };
      el.value = "2026-07-10/2026-07-16";
      await el.updateComplete;
      expect(input.value).to.include("–");
    } finally {
      Intl.DateTimeFormat.prototype.formatRange = original;
    }
  });

  it('falls back to a dash range separator when Intl formatRangeToParts throws while parsing typed range text', async () => {
    const el = (await fixture(
      html`<lr-date-input mode="range"></lr-date-input>`
    )) as LyraDateInput;
    const input = el.shadowRoot!.querySelector(
      '[part="input"]'
    ) as HTMLInputElement;
    const original = Intl.DateTimeFormat.prototype.formatRangeToParts;
    try {
      Intl.DateTimeFormat.prototype.formatRangeToParts = () => {
        throw new Error("boom");
      };
      input.value = "7/10/2026 – 7/15/2026";
      setTimeout(() => input.dispatchEvent(new Event("change")));
      await oneEvent(el, "change");
      expect(el.value).to.equal("2026-07-10/2026-07-15");
    } finally {
      Intl.DateTimeFormat.prototype.formatRangeToParts = original;
    }
  });

  it('falls back to a dash range separator when Intl formatRangeToParts reports no literal text between the two dates', async () => {
    // A distinct gap from the throw-based fallback above: here `formatRangeToParts()` succeeds,
    // but its parts contain nothing between the last `startRange` part and the first `endRange`
    // part, so the computed separator is the empty string and the `|| '–'` fallback (not the
    // catch block) is what has to supply the dash.
    const el = (await fixture(
      html`<lr-date-input mode="range"></lr-date-input>`
    )) as LyraDateInput;
    const input = el.shadowRoot!.querySelector(
      '[part="input"]'
    ) as HTMLInputElement;
    const original = Intl.DateTimeFormat.prototype.formatRangeToParts;
    try {
      Intl.DateTimeFormat.prototype.formatRangeToParts = () =>
        [
          { type: 'day', value: '10', source: 'startRange' },
          { type: 'day', value: '15', source: 'endRange' },
        ] as Intl.DateTimeRangeFormatPart[];
      input.value = "7/10/2026–7/15/2026";
      setTimeout(() => input.dispatchEvent(new Event("change")));
      await oneEvent(el, "change");
      expect(el.value).to.equal("2026-07-10/2026-07-15");
    } finally {
      Intl.DateTimeFormat.prototype.formatRangeToParts = original;
    }
  });

  it('re-commits the identical displayed range text as-is without reparsing it', async () => {
    const el = (await fixture(
      html`<lr-date-input mode="range" value="2026-07-10/2026-07-15"></lr-date-input>`
    )) as LyraDateInput;
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector(
      '[part="input"]'
    ) as HTMLInputElement;
    const displayed = input.value;
    // Re-type the exact same displayed text (a no-op edit) and commit it via
    // blur/change rather than Enter, so it goes through onInputChange -> applyTypedText
    // -> parseRangeText's own-text fast path instead of the enterCommittedText guard.
    input.value = displayed;
    input.dispatchEvent(new Event("change"));
    await el.updateComplete;
    expect(el.value).to.equal("2026-07-10/2026-07-15");
  });

  it('swallows a focus event that races the control becoming disabled', async () => {
    const el = (await fixture(
      html`<lr-date-input></lr-date-input>`
    )) as LyraDateInput;
    const input = el.shadowRoot!.querySelector(
      '[part="input"]'
    ) as HTMLInputElement;
    el.disabled = true;
    await el.updateComplete;
    let focusEvents = 0;
    el.addEventListener("focus", () => {
      focusEvents++;
    });
    input.dispatchEvent(
      new FocusEvent("focus", { bubbles: true, composed: true })
    );
    expect(
      focusEvents,
      "a disabled control must not relay a raced focus event"
    ).to.equal(0);
  });

  it('closes the popup when the expand button is clicked again while already open', async () => {
    const el = (await fixture(
      html`<lr-date-input style="--show-duration: 1ms; --hide-duration: 1ms"></lr-date-input>`
    )) as LyraDateInput;
    const expandButton = el.shadowRoot!.querySelector(
      '[part="expand-button"]'
    ) as HTMLButtonElement;
    expandButton.click();
    await el.updateComplete;
    expect(el.open).to.be.true;

    const afterHide = oneEvent(el, "lr-after-hide");
    expandButton.click();
    await afterHide;
    expect(el.open).to.be.false;
  });

  it('supersedes an in-flight show() transition when hide() is called before it settles', async () => {
    const el = (await fixture(
      html`<lr-date-input style="--show-duration: 1ms; --hide-duration: 1ms"></lr-date-input>`
    )) as LyraDateInput;
    const afterHide = oneEvent(el, "lr-after-hide");
    const showPromise = el.show();
    const hidePromise = el.hide();
    await Promise.all([showPromise, hidePromise]);
    await afterHide;
    expect(el.open, "the later hide() call wins over the superseded show()").to.be.false;
  });

  it('drops the pending lr-after-show emission when hide() supersedes it while the open transition is still animating', async () => {
    // The previous test supersedes show() before its settleTransition() even reaches its own
    // animation-await phase (the stale-token check right after `updateComplete` already catches
    // it). This one lets the show transition actually start animating first, so the *later*
    // stale-token check -- taken only after `Promise.all(animations...)` settles -- is the one
    // that has to catch it instead.
    const el = (await fixture(
      html`<lr-date-input style="--show-duration: 150ms; --hide-duration: 50ms"></lr-date-input>`
    )) as LyraDateInput;
    const popup = el.shadowRoot!.querySelector('[part="popup"]') as HTMLElement;
    let afterShowFired = false;
    el.addEventListener('lr-after-show', () => {
      afterShowFired = true;
    });

    const afterHide = oneEvent(el, 'lr-after-hide');
    const showPromise = el.show();
    await waitUntil(
      () => popup.getAnimations({ subtree: true }).length > 0,
      'the show transition must start animating',
      { timeout: 1000 }
    );
    const hidePromise = el.hide();
    await Promise.all([showPromise, hidePromise]);
    await afterHide;
    expect(
      afterShowFired,
      'a later hide() must supersede the show transition even once its animation has already begun'
    ).to.be.false;
  });

  it('does not double-bind the visibilitychange listener when connectedCallback re-fires while still connected', async () => {
    const el = (await fixture(
      html`<lr-date-input value="2026-07-14" disable-past></lr-date-input>`
    )) as LyraDateInput;
    const priv = el as unknown as {
      connectedCallback(): void;
      validityRevision: number;
    };
    const before = priv.validityRevision;
    priv.connectedCallback();
    el.ownerDocument.dispatchEvent(new Event("visibilitychange"));
    await el.updateComplete;
    expect(
      priv.validityRevision,
      "a redundant connect must not create a second listener that double-fires"
    ).to.equal(before + 1);
  });

  it('ignores a non-array assumeInteractionOn from an untyped JS caller instead of throwing', async () => {
    const el = (await fixture(
      html`<lr-date-input></lr-date-input>`
    )) as LyraDateInput;
    await el.updateComplete;
    const priv = el as unknown as {
      interactionListeners: Map<string, EventListener>;
    };
    expect(priv.interactionListeners.has("input")).to.be.true;
    el.assumeInteractionOn = null as unknown as string[];
    await el.updateComplete;
    expect(priv.interactionListeners.size).to.equal(0);
  });

  it('ignores a non-array validators value from an untyped JS caller instead of throwing', async () => {
    const el = (await fixture(
      html`<lr-date-input value="2026-07-15"></lr-date-input>`
    )) as LyraDateInput;
    el.validators = null as unknown as LyraDateInput["validators"];
    await el.updateComplete;
    expect(el.checkValidity()).to.be.true;
  });

  it('skips wiring an observedAttributes MutationObserver while disconnected', async () => {
    const el = (await fixture(
      html`<lr-date-input></lr-date-input>`
    )) as LyraDateInput;
    el.remove();
    el.validators = [
      {
        checkValidity: () => ({ isValid: true, invalidKeys: [], message: "" }),
        observedAttributes: ["data-flag"],
      },
    ];
    await el.updateComplete;
    const priv = el as unknown as { validatorAttributeObserver?: unknown };
    expect(
      priv.validatorAttributeObserver,
      "no observer is created for a disconnected control"
    ).to.equal(undefined);
  });

  it('tolerates a non-array invalidKeys and a non-string message from an untyped checkValidity() result', async () => {
    const el = (await fixture(
      html`<lr-date-input value="2026-07-15"></lr-date-input>`
    )) as LyraDateInput;
    el.validators = [
      {
        checkValidity: () => ({
          isValid: false,
          invalidKeys: undefined as unknown as Exclude<
            keyof ValidityState,
            "valid"
          >[],
          message: undefined as unknown as string,
        }),
        message: "Fallback static message",
      },
    ];
    expect(el.checkValidity()).to.be.false;
    expect(
      el.internals.validity.customError,
      "no mapped invalidKeys synthesizes customError"
    ).to.be.true;
    expect(el.internals.validationMessage).to.equal("Fallback static message");
  });

  it('ignores a stale observedAttributes MutationObserver callback whose tracked binding changed underneath it', async () => {
    const el = (await fixture(
      html`<lr-date-input value="2026-07-15"></lr-date-input>`
    )) as LyraDateInput;
    el.validators = [
      {
        checkValidity: () => ({ isValid: true, invalidKeys: [], message: "" }),
        observedAttributes: ["data-flag"],
      },
    ];
    await el.updateComplete;
    const priv = el as unknown as {
      validatorAttributeObserver?: unknown;
      validityRevision: number;
    };
    expect(priv.validatorAttributeObserver).to.not.equal(undefined);
    const revisionBefore = priv.validityRevision;
    // A differently-identitied binding with a real (no-op) observer, so the
    // guard's `!==` check trips while fixture cleanup can still safely call
    // `.observer.disconnect()` on it afterwards.
    priv.validatorAttributeObserver = { observer: { disconnect() {} } };
    el.setAttribute("data-flag", "go");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(
      priv.validityRevision,
      "a stale observer callback must not revalidate"
    ).to.equal(revisionBefore);
  });

  it('bindVisibilityListener no-ops when invoked while disconnected', async () => {
    const el = (await fixture(
      html`<lr-date-input></lr-date-input>`
    )) as LyraDateInput;
    el.remove();
    const priv = el as unknown as {
      connectedCallback(): void;
      visibilityListenerDocument?: Document;
    };
    priv.connectedCallback();
    expect(
      priv.visibilityListenerDocument == null,
      "no visibility listener bound while disconnected"
    ).to.be.true;
  });

  it('bindDocumentPointer no-ops when invoked while disconnected', async () => {
    const el = (await fixture(
      html`<lr-date-input></lr-date-input>`
    )) as LyraDateInput;
    el.remove();
    const priv = el as unknown as {
      bindDocumentPointer(): void;
      pointerListenerDocument?: Document;
    };
    priv.bindDocumentPointer();
    expect(
      priv.pointerListenerDocument == null,
      "no pointer listener bound while disconnected"
    ).to.be.true;
  });

  it('reconnectOpenPopup no-ops when invoked while disconnected or already closed', async () => {
    const el = (await fixture(
      html`<lr-date-input></lr-date-input>`
    )) as LyraDateInput;
    const priv = el as unknown as {
      reconnectOpenPopup(): void;
      cleanupFn?: () => void;
    };
    // Closed, but still connected: the `!this.open` half of the guard.
    priv.reconnectOpenPopup();
    expect(priv.cleanupFn, "no reposition while closed").to.equal(undefined);

    el.remove();
    (el as unknown as { open: boolean }).open = true;
    priv.reconnectOpenPopup();
    expect(priv.cleanupFn, "no reposition while disconnected").to.equal(
      undefined
    );
  });

  it("reconnectOpenPopup no-ops when the popup/anchor parts have not rendered yet", async () => {
    // Connected and open both pass, but this calls straight through to `reconnectOpenPopup()`
    // before Lit's own microtask-scheduled first update has populated the shadow root, so
    // `renderRoot.querySelector('[part=\"popup\"]')`/`'[part=\"input-wrapper\"]'` both still
    // resolve to null. Under real usage this can never happen (the only caller,
    // `connectedCallback()`, gates on `hasUpdated` first), so it is exercised the same
    // direct-invocation way as the guard above.
    const el = document.createElement('lr-date-input') as LyraDateInput;
    const priv = el as unknown as {
      reconnectOpenPopup(): void;
      cleanupFn?: () => void;
    };
    document.body.appendChild(el);
    (el as unknown as { open: boolean }).open = true;
    priv.reconnectOpenPopup();
    expect(
      priv.cleanupFn,
      "no reposition when the popup/anchor parts do not exist in the render root yet"
    ).to.equal(undefined);
    el.remove();
  });
});

// root, and a CSS part cannot set a JS property.
describe('range presets forwarding', () => {
  const PRESETS = [
    { label: 'Last 7 days', start: '2026-08-13', end: '2026-08-19' },
    { label: 'This month', start: '2026-08-01', end: '2026-08-31' },
  ];

  async function openedInput(): Promise<LyraDateInput> {
    const el = (await fixture(
      html`<lr-date-input mode="range"></lr-date-input>`,
    )) as LyraDateInput;
    el.presets = PRESETS;
    el.open = true;
    await el.updateComplete;
    return el;
  }

  const picker = (el: LyraDateInput): HTMLElement =>
    el.shadowRoot!.querySelector<HTMLElement>('[part~="date-picker"]')!;

  it('forwards presets to the internal date picker', async () => {
    const el = await openedInput();
    const inner = picker(el) as HTMLElement & { presets?: readonly { label: string }[] };
    await (inner as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    expect(inner.presets?.length, 'the inner picker received the list').to.equal(2);
    expect(inner.presets?.[0]?.label).to.equal('Last 7 days');
  });

  it('renders the preset row through the forwarded property', async () => {
    const el = await openedInput();
    const inner = picker(el);
    await (inner as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    const buttons = inner.shadowRoot!.querySelectorAll('[part~="preset-button"]');

    expect(buttons.length, 'the row renders inside the popover').to.equal(2);
  });

  it('forwards only descriptor-safe preset projections while preserving the selected source identity', async () => {
    const target = {
      label: 'Safe range',
      start: '2026-08-13',
      end: '2026-08-19',
    };
    const source = new Proxy(target, {
      get(): never {
        throw new Error('the nested picker must not read the preset source');
      },
      getOwnPropertyDescriptor(value, key): PropertyDescriptor | undefined {
        return Reflect.getOwnPropertyDescriptor(value, key);
      },
    });
    const unsafe = Object.defineProperty({}, 'label', {
      enumerable: true,
      get(): never {
        throw new Error('unsafe preset accessor');
      },
    });
    const el = (await fixture(
      html`<lr-date-input mode="range" open></lr-date-input>`,
    )) as LyraDateInput;

    el.presets = [unsafe, source] as unknown as typeof PRESETS;
    await el.updateComplete;
    const inner = picker(el) as LyraDatePicker;
    await inner.updateComplete;
    const buttons = Array.from(
      inner.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="preset-button"]'),
    );
    expect(buttons.map((button) => button.textContent?.trim())).to.deep.equal([
      'Safe range',
    ]);

    buttons[0]!.click();
    await inner.updateComplete;
    expect(inner.appliedPreset).to.equal(source);
  });

  it('keeps the forwarded picker renderable for malformed runtime collections', async () => {
    const el = (await fixture(
      html`<lr-date-input mode="range" open></lr-date-input>`,
    )) as LyraDateInput;

    el.presets = null as unknown as typeof PRESETS;
    await el.updateComplete;
    let inner = picker(el) as LyraDatePicker;
    await inner.updateComplete;
    expect(inner.shadowRoot!.querySelectorAll('[part~="preset-button"]')).to.have.lengthOf(0);

    el.presets = [null, PRESETS[0]] as unknown as typeof PRESETS;
    await el.updateComplete;
    inner = picker(el) as LyraDatePicker;
    await inner.updateComplete;
    expect(inner.shadowRoot!.querySelectorAll('[part~="preset-button"]')).to.have.lengthOf(1);
  });

  it('exposes the presets and preset-button parts through exportparts', async () => {
    const el = await openedInput();
    const exported = picker(el).getAttribute('exportparts') ?? '';

    expect(exported, 'presets must be reachable from outside').to.contain('presets');
    expect(exported, 'preset-button must be reachable from outside').to.contain('preset-button');
  });
});

it('exposes --lr-date-input-fill/--lr-date-input-border-color as retheme knobs without a ::part() rule', async () => {
  const el = await fixture<LyraDateInput>(html`<lr-date-input value="2026-09-07"></lr-date-input>`);
  el.style.setProperty('--lr-date-input-fill', 'rgb(1, 2, 3)');
  el.style.setProperty('--lr-date-input-border-color', 'rgb(4, 5, 6)');
  await el.updateComplete;
  const row = el.shadowRoot!.querySelector<HTMLElement>('[part="input-wrapper"]')!;
  const cs = getComputedStyle(row);
  expect(cs.backgroundColor).to.equal('rgb(1, 2, 3)');
  expect(cs.borderTopColor).to.equal('rgb(4, 5, 6)');
});

it('tracks inherited theme heights at small and large sizes without extra action padding', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div style="--lr-theme-form-control-height-s:36px;--lr-theme-form-control-height-l:60px">
    <lr-date-input size="small" value="2026-09-07" with-clear></lr-date-input>
  </div>`);
  const el = wrapper.querySelector<LyraDateInput>('lr-date-input')!;
  const row = () => el.shadowRoot!.querySelector<HTMLElement>('[part="input-wrapper"]')!;
  expect(row().getBoundingClientRect().height).to.equal(36);
  el.size = 'large';
  await el.updateComplete;
  expect(row().getBoundingClientRect().height).to.equal(60);
  wrapper.style.setProperty('--lr-theme-form-control-height-l', '52px');
  expect(row().getBoundingClientRect().height).to.equal(52);
  await expect(el).to.be.accessible();
});

// The start/end parts are inline-flex, so the part's own ellipsis never fired on slotted text.
describe("lr-date-input slotted adornment truncation", () => {
  const LONG = "Adornment text that is far too long.";

  for (const slot of ["start", "end"] as const) {
    it(`truncates a long slotted ${slot} text adornment with an ellipsis`, async () => {
      const el = (await fixture(html`
        <lr-date-input style="inline-size: 240px"
          ><span slot=${slot} id="adornment">${LONG}</span></lr-date-input
        >
      `)) as LyraDateInput;
      await el.updateComplete;
      const part = el.shadowRoot!.querySelector(`[part~="${slot}"]`) as HTMLElement;
      const adornment = el.querySelector("#adornment") as HTMLElement;
      const box = adornment.getBoundingClientRect();
      const partBox = part.getBoundingClientRect();
      expect(box.left, "start edge stays inside the part").to.be.at.least(partBox.left - 0.5);
      expect(box.right, "end edge stays inside the part").to.be.at.most(partBox.right + 0.5);
      expect(getComputedStyle(adornment).textOverflow).to.equal("ellipsis");
      expect(adornment.scrollWidth > adornment.clientWidth, "text overflows its box").to.equal(true);
    });
  }
});

describe("--lr-date-input-color and its deprecated --lr-date-input-text-color alias", () => {
  for (const [name, style] of [
    ["canonical", "--lr-date-input-color: rgb(1, 2, 3)"],
    ["deprecated", "--lr-date-input-text-color: rgb(1, 2, 3)"],
    ["canonical over deprecated", "--lr-date-input-color: rgb(1, 2, 3); --lr-date-input-text-color: rgb(9, 9, 9)"],
  ] as const) {
    it(`checks trigger color reach for ${name}`, async () => {
      const el = (await fixture(
        html`<lr-date-input style=${style}></lr-date-input>`
      )) as LyraDateInput;
      await el.updateComplete;
      const wrapper = el.shadowRoot!.querySelector<HTMLElement>('[part="input-wrapper"]')!;
      expect(getComputedStyle(wrapper).color === "rgb(1, 2, 3)").to.equal(!name.startsWith('deprecated'));
    });
  }
});
