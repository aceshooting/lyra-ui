// Focused interaction and event contracts cases. Test bodies and titles were moved intact from the prior suite.
import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';
import { fixture, expect, oneEvent, html, waitUntil } from "@open-wc/testing";
import { LitElement, type PropertyValues } from "lit";
import "./date-picker.js";
import type { LyraDatePicker } from "./date-picker.js";
import { hoverUntilMatched, resetMouse, settlePointer } from "../../../../test/wtr-mouse.js";
import { setForcedColors } from "../../../../test/wtr-media.js";

const requiredItem = <T>(items: ArrayLike<T>, index: number, description: string): T => {
  const item = items[index];
  if (item === undefined) throw new Error(`Missing ${description} at index ${index}.`);
  return item;
};

expectLocaleFallback('fa-IR', ['nextMonth', 'previousMonth']);

expectLocaleFallback('fr', ['nextMonth', 'previousMonth']);

expectLocaleFallback('fr-FR', ['nextMonth', 'previousMonth']);

expectLocaleFallback('not-a-locale', ['nextMonth', 'previousMonth']);

const pad = (n: number) => String(n).padStart(2, "0");

const iso = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function dispatchGridKey(el: LyraDatePicker, key: string): void {
  const grid = el.shadowRoot!.querySelector('[part="grid"]') as HTMLElement;
  grid.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

async function settle(): Promise<void> {
  await new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  );
}

it("lets a consumer retint day and selection-view states independently", async () => {
  const el = (await fixture(html`
    <lr-date-picker
      value="2026-07-15"
      style="--lr-date-picker-day-hover-bg: rgb(1, 2, 3); --lr-date-picker-selected-bg: rgb(4, 5, 6); --lr-date-picker-selected-color: rgb(7, 8, 9); --lr-date-picker-view-selected-bg: rgb(10, 11, 12); --lr-date-picker-view-selected-color: rgb(13, 14, 15)"
    ></lr-date-picker>
  `)) as LyraDatePicker;
  const selected = el.shadowRoot!.querySelector(
    '[part~="day-selected"]'
  ) as HTMLElement;
  expect(getComputedStyle(selected).backgroundColor).to.equal("rgb(4, 5, 6)");
  expect(getComputedStyle(selected).color).to.equal("rgb(7, 8, 9)");

  const day = el.shadowRoot!.querySelector(
    '[part~="day"]:not([part~="day-selected"]):not([part~="day-outside"])'
  ) as HTMLElement;
  try {
    await hoverUntilMatched(day, "day cell never reported :hover");
    await waitUntil(
      () => getComputedStyle(day).backgroundColor === "rgb(1, 2, 3)",
      "day cell background never eased to the configured colour"
    );
  } finally {
    await resetMouse();
  }

  el.view = "months";
  await el.updateComplete;
  const selectedView = el.shadowRoot!.querySelector(
    '[part~="view-item-selected"]'
  ) as HTMLElement;
  expect(getComputedStyle(selectedView).backgroundColor).to.equal(
    "rgb(10, 11, 12)"
  );
  expect(getComputedStyle(selectedView).color).to.equal("rgb(13, 14, 15)");
});

for (const [name, style] of [
  ["canonical --lr-date-picker-cell-size", "--lr-date-picker-cell-size: 44px"],
  ["deprecated --lr-cell-size alias", "--lr-cell-size: 44px"],
  ["canonical property over the alias", "--lr-date-picker-cell-size: 44px; --lr-cell-size: 30px"],
] as const) {
  it(`checks geometry reach for ${name}`, async () => {
    const el = (await fixture(html`
      <lr-date-picker value="2026-07-15" style=${style}></lr-date-picker>
    `)) as LyraDatePicker;
    const day = el.shadowRoot!.querySelector('[part~="day"]') as HTMLElement;
    const grid = el.shadowRoot!.querySelector('[part="grid"]') as HTMLElement;

    expect(getComputedStyle(day).inlineSize === "44px").to.equal(!name.startsWith('deprecated'));
    expect(getComputedStyle(day).blockSize === "44px").to.equal(!name.startsWith('deprecated'));
    expect(getComputedStyle(grid).gridTemplateColumns.split(" ").length).to.equal(
      7
    );
    expect(
      getComputedStyle(grid)
        .gridTemplateColumns.split(" ")
        .every((track) => track === "44px")
    ).to.equal(!name.startsWith('deprecated'));
  });
}

it("selects a day and emits change with an ISO value", async () => {
  const el = (await fixture(
    html`<lr-date-picker value="2026-07-15"></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;

  const day = el.shadowRoot!.querySelector(
    '[data-date="2026-07-20"]'
  ) as HTMLButtonElement;
  setTimeout(() => day.click());
  await oneEvent(el, "change");
  expect(el.value).to.equal("2026-07-20");
  expect(el.valueAsDate?.getDate()).to.equal(20);
});

it("marks the selected day", async () => {
  const el = (await fixture(
    html`<lr-date-picker value="2026-07-15"></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;
  const sel = el.shadowRoot!.querySelector(
    '[part~="day-selected"]'
  ) as HTMLButtonElement;
  expect(sel.getAttribute("data-date")).to.equal("2026-07-15");
});

it("selects a range across two clicks", async () => {
  const el = (await fixture(
    html`<lr-date-picker mode="range"></lr-date-picker>`
  )) as LyraDatePicker;
  el.goToDate("2026-07-01");
  await el.updateComplete;

  (
    el.shadowRoot!.querySelector(
      '[data-date="2026-07-05"]'
    ) as HTMLButtonElement
  ).click();
  await el.updateComplete;
  setTimeout(() =>
    (
      el.shadowRoot!.querySelector(
        '[data-date="2026-07-10"]'
      ) as HTMLButtonElement
    ).click()
  );
  await oneEvent(el, "change");
  expect(el.value).to.equal("2026-07-05/2026-07-10");
  expect(
    el.shadowRoot!.querySelectorAll('[part~="day-range-inner"]').length
  ).to.equal(4);
});

it("normalizes a hand-picked range when its second endpoint is earlier", async () => {
  const el = (await fixture(
    html`<lr-date-picker mode="range"></lr-date-picker>`
  )) as LyraDatePicker;
  el.goToDate("2026-07-01");
  await el.updateComplete;

  (
    el.shadowRoot!.querySelector(
      '[data-date="2026-07-10"]'
    ) as HTMLButtonElement
  ).click();
  await el.updateComplete;
  const changed = oneEvent(el, "change");
  (
    el.shadowRoot!.querySelector(
      '[data-date="2026-07-05"]'
    ) as HTMLButtonElement
  ).click();
  await changed;

  expect(el.value).to.equal("2026-07-05/2026-07-10");
});

it("keeps viewing the month the user navigated to after completing a cross-month range pick", async () => {
  // Regression test: willUpdate() used to unconditionally resync viewDate to
  // selection.from's month on every `value` change, including the component's
  // own commit() -- so completing a range in a later month than the range's
  // start snapped the view straight back to the start month.
  const el = (await fixture(
    html`<lr-date-picker mode="range"></lr-date-picker>`
  )) as LyraDatePicker;
  el.goToDate("2026-07-01");
  await el.updateComplete;

  (
    el.shadowRoot!.querySelector(
      '[data-date="2026-07-25"]'
    ) as HTMLButtonElement
  ).click();
  await el.updateComplete;

  (el.shadowRoot!.querySelector('[part="next"]') as HTMLButtonElement).click();
  await el.updateComplete;
  const title = () =>
    el
      .shadowRoot!.querySelector('[part="title"]')!
      .textContent!.trim()
      .toLowerCase();
  expect(title()).to.contain("august");

  setTimeout(() =>
    (
      el.shadowRoot!.querySelector(
        '[data-date="2026-08-05"]'
      ) as HTMLButtonElement
    ).click()
  );
  await oneEvent(el, "change");
  expect(el.value).to.equal("2026-07-25/2026-08-05");
  expect(
    title(),
    "the view should stay on the month the user navigated to, not snap back to the range-start month"
  ).to.contain("august");
  expect(
    el.shadowRoot!.querySelector('[data-date="2026-08-05"]'),
    "the day just picked should still be rendered"
  ).to.exist;
});

it("still syncs the view to an externally-assigned value (not just to its own commits)", async () => {
  const el = (await fixture(
    html`<lr-date-picker value="2026-01-15"></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;

  el.value = "2026-09-10";
  await el.updateComplete;
  const title = el
    .shadowRoot!.querySelector('[part="title"]')!
    .textContent!.trim()
    .toLowerCase();
  expect(title).to.contain("september");
});

it("honors min/max by disabling out-of-range days", async () => {
  const el = (await fixture(
    html`<lr-date-picker
      value="2026-07-15"
      min="2026-07-10"
      max="2026-07-20"
    ></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;
  const before = el.shadowRoot!.querySelector(
    '[data-date="2026-07-05"]'
  ) as HTMLButtonElement;
  const inside = el.shadowRoot!.querySelector(
    '[data-date="2026-07-15"]'
  ) as HTMLButtonElement;
  expect(before.disabled).to.be.true;
  expect(inside.disabled).to.be.false;
});

it("defensively ignores a synthetic click dispatched directly on a disabled day", async () => {
  const el = (await fixture(
    html`<lr-date-picker min="2026-07-10"></lr-date-picker>`
  )) as LyraDatePicker;
  el.goToDate("2026-07-10");
  await el.updateComplete;
  const disabledDay = el.shadowRoot!.querySelector(
    '[data-date="2026-07-05"]'
  ) as HTMLButtonElement;
  let changes = 0;
  el.addEventListener("change", () => changes++);

  disabledDay.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await el.updateComplete;

  expect(disabledDay.disabled).to.equal(true);
  expect(el.value).to.equal("");
  expect(changes).to.equal(0);
});

it("disables days before today when disable-past is set", async () => {
  const el = (await fixture(
    html`<lr-date-picker disable-past></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;
  const today = new Date();

  const todayCell = el.shadowRoot!.querySelector(
    `[data-date="${iso(today)}"]`
  ) as HTMLButtonElement;
  expect(todayCell.disabled, "today itself should remain selectable").to.be
    .false;

  if (today.getDate() > 1) {
    const yesterday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - 1
    );
    const pastCell = el.shadowRoot!.querySelector(
      `[data-date="${iso(yesterday)}"]`
    ) as HTMLButtonElement;
    expect(pastCell.disabled, "a day before today should be disabled").to.be
      .true;
  }
});

it("disables days after today when disable-future is set", async () => {
  const el = (await fixture(
    html`<lr-date-picker disable-future></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;
  const today = new Date();

  const todayCell = el.shadowRoot!.querySelector(
    `[data-date="${iso(today)}"]`
  ) as HTMLButtonElement;
  expect(todayCell.disabled, "today itself should remain selectable").to.be
    .false;

  const lastOfMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0
  ).getDate();
  if (lastOfMonth > today.getDate()) {
    const tomorrow = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1
    );
    const futureCell = el.shadowRoot!.querySelector(
      `[data-date="${iso(tomorrow)}"]`
    ) as HTMLButtonElement;
    expect(futureCell.disabled, "a day after today should be disabled").to.be
      .true;
  }
});

it("navigates months with the next/previous buttons", async () => {
  const el = (await fixture(
    html`<lr-date-picker value="2026-07-15"></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;
  const title = () =>
    el.shadowRoot!.querySelector('[part="title"]')!.textContent!.trim();
  expect(title()).to.contain("2026");
  (el.shadowRoot!.querySelector('[part="next"]') as HTMLButtonElement).click();
  await el.updateComplete;
  expect(title().toLowerCase()).to.contain("august");
});

it("moves the roving focus into the newly visible month after navigation", async () => {
  const el = (await fixture(
    html`<lr-date-picker value="2026-07-15"></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;

  (el.shadowRoot!.querySelector('[part="next"]') as HTMLButtonElement).click();
  await el.updateComplete;

  const focusable = el.shadowRoot!.querySelectorAll(
    '[part~="day"][tabindex="0"]'
  );
  expect(focusable.length).to.equal(1);
  const focused = requiredItem(focusable, 0, 'focusable day') as HTMLButtonElement;
  expect(focused.dataset['date']).to.equal(
    "2026-08-01"
  );
  expect((focusable[0] as HTMLButtonElement).disabled).to.be.false;
});

it("does not steal DOM focus off the next/previous button when navigating months", async () => {
  // Regression test: willUpdate() used to unconditionally call
  // normalizeFocusedDate() on every update, including one caused purely by
  // nav() moving viewDate -- since the previously-focused/selected anchor is
  // no longer inside the newly-visible month, that armed focusPending and
  // updated() yanked real DOM focus onto a day cell, off whatever the
  // keyboard user was actually operating (the nav button itself).
  const el = (await fixture(
    html`<lr-date-picker value="2026-07-15"></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;

  const next = el.shadowRoot!.querySelector(
    '[part="next"]'
  ) as HTMLButtonElement;
  next.focus();
  expect(el.shadowRoot!.activeElement === next).to.be.true;

  next.click();
  await el.updateComplete;

  expect(
    el.shadowRoot!.activeElement === next,
    "DOM focus should stay on the next button, not jump to a day cell"
  ).to.be.true;
  // The roving tabindex should still have re-anchored into the new month.
  const focusable = el.shadowRoot!.querySelectorAll(
    '[part~="day"][tabindex="0"]'
  );
  expect(focusable.length).to.equal(1);
  const focused = requiredItem(focusable, 0, 'focusable day') as HTMLButtonElement;
  expect(focused.dataset['date']).to.equal(
    "2026-08-01"
  );
});

it("clamps runtime month attributes and direct property writes to at most two calendars", async () => {
  const el = (await fixture(
    html`<lr-date-picker months="3"></lr-date-picker>`
  )) as LyraDatePicker;
  expect(el.months).to.equal(2);
  expect(el.shadowRoot!.querySelectorAll('[part="month"]')).to.have.length(2);

  el.months = 99 as LyraDatePicker["months"];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="month"]')).to.have.length(2);

  el.months = Number.POSITIVE_INFINITY as LyraDatePicker["months"];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="month"]')).to.have.length(1);
});

it("normalizes invalid mode and weekday-format attributes without throwing", async () => {
  const el = (await fixture(html`
    <lr-date-picker
      mode="bogus"
      weekday-format="bogus"
      locale="not_a_locale"
    ></lr-date-picker>
  `)) as LyraDatePicker;

  expect(el.mode).to.equal("single");
  expect(el.weekdayFormat).to.equal("short");
  expect(el.shadowRoot!.querySelectorAll('[part="weekday"]')).to.have.length(7);
  expect(el.shadowRoot!.querySelectorAll('[part="month"]')).to.have.length(1);
});

it("ignores an invalid Date passed to goToDate instead of poisoning the calendar view", async () => {
  const el = (await fixture(
    html`<lr-date-picker value="2026-07-15"></lr-date-picker>`
  )) as LyraDatePicker;
  const title = el.shadowRoot!.querySelector('[part="title"]')!.textContent;

  el.goToDate(new Date(Number.NaN));
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="title"]')!.textContent).to.equal(
    title
  );
  expect(el.shadowRoot!.querySelectorAll('[part="month"]')).to.have.length(1);
});

it("leaves the two-month view alone when ArrowRight moves into a date already visible in the second grid", async () => {
  // Regression test: onGridKey used to always recenter the view as if the
  // focused cell belonged to the first (offset 0) calendar, so crossing into
  // the already-visible second month discarded the first month from view.
  const el = (await fixture(
    html`<lr-date-picker months="2"></lr-date-picker>`
  )) as LyraDatePicker;
  el.goToDate("2026-07-31");
  await el.updateComplete;

  const grids = el.shadowRoot!.querySelectorAll('[part="grid"]');
  requiredItem(grids, 0, 'first month grid').dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  await el.updateComplete;

  const titles = Array.from(
    el.shadowRoot!.querySelectorAll('[part="title"]')
  ).map((t) => t.textContent!.trim().toLowerCase());
  expect(
    titles[0],
    "July should stay visible -- it was never scrolled past"
  ).to.contain("july");
  expect(titles[1]).to.contain("august");

  const focused = el.shadowRoot!.querySelector(
    '[data-date="2026-08-01"]'
  ) as HTMLButtonElement;
  expect(
    focused != null,
    "August 1 was already showing in the second grid"
  ).to.equal(true);
  expect(focused.getAttribute("tabindex")).to.equal("0");
  expect(el.shadowRoot!.activeElement === focused).to.be.true;
});

it("slides the two-month view by exactly one month once a keypress moves past the last visible month", async () => {
  const el = (await fixture(
    html`<lr-date-picker months="2"></lr-date-picker>`
  )) as LyraDatePicker;
  el.goToDate("2026-07-31");
  await el.updateComplete;
  const grids = () => el.shadowRoot!.querySelectorAll('[part="grid"]');
  const titles = () =>
    Array.from(el.shadowRoot!.querySelectorAll('[part="title"]')).map((t) =>
      t.textContent!.trim().toLowerCase()
    );

  // PageDown from July 31 lands on Aug 31, already visible in the second grid.
  requiredItem(grids(), 0, 'first month grid').dispatchEvent(
    new KeyboardEvent("keydown", { key: "PageDown", bubbles: true })
  );
  await el.updateComplete;
  expect(titles()[0]).to.contain("july");
  expect(titles()[1]).to.contain("august");

  // One more day forward crosses past the visible window (Sep 1 isn't shown yet).
  requiredItem(grids(), 1, 'second month grid').dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  await el.updateComplete;
  expect(
    titles()[0],
    "August should slide into the first grid, not be discarded from view"
  ).to.contain("august");
  expect(titles()[1]).to.contain("september");

  const focused = el.shadowRoot!.querySelector(
    '[data-date="2026-09-01"]'
  ) as HTMLButtonElement;
  expect(focused != null).to.equal(true);
  expect(el.shadowRoot!.activeElement === focused).to.be.true;
});

it("disables every day button and dims the host when the picker itself is disabled", async () => {
  const el = (await fixture(
    html`<lr-date-picker value="2026-07-15" disabled></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;

  const days = el.shadowRoot!.querySelectorAll(
    '[part~="day"]'
  ) as NodeListOf<HTMLButtonElement>;
  expect(days.length).to.be.greaterThan(0);
  for (const day of days) expect(day.disabled).to.be.true;

  expect(getComputedStyle(el).pointerEvents).to.equal("none");
});

it("keeps a readonly calendar reachable on the selected day while selection stays inert", async () => {
  const el = (await fixture(
    html`<lr-date-picker value="2026-07-15" readonly></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;

  const days = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="day"]')];
  expect(days.length).to.be.greaterThan(0);
  expect(days.every((day) => !day.disabled), "readonly disables no day").to.be.true;
  expect(
    days.filter((day) => day.tabIndex === 0).map((day) => day.dataset["date"]),
    "one roving stop, on the selected day"
  ).to.deep.equal(["2026-07-15"]);
  expect(el.shadowRoot!.querySelector('[part="grid"]')!.getAttribute("aria-readonly")).to.equal("true");

  let events = 0;
  el.addEventListener("input", () => events++);
  el.addEventListener("change", () => events++);
  el.shadowRoot!.querySelector<HTMLButtonElement>('[data-date="2026-07-20"]')!.click();
  dispatchGridKey(el, "Enter");
  await el.updateComplete;
  expect(el.value).to.equal("2026-07-15");
  expect(events).to.equal(0);
});

it("moves roving focus one day left/right with ArrowLeft/ArrowRight", async () => {
  const el = (await fixture(
    html`<lr-date-picker value="2026-07-15"></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;

  dispatchGridKey(el, "ArrowRight");
  await el.updateComplete;
  let focused = el.shadowRoot!.querySelector(
    '[data-date="2026-07-16"]'
  ) as HTMLButtonElement;
  expect(focused.getAttribute("tabindex")).to.equal("0");
  expect(el.shadowRoot!.activeElement === focused).to.be.true;

  dispatchGridKey(el, "ArrowLeft");
  await el.updateComplete;
  focused = el.shadowRoot!.querySelector(
    '[data-date="2026-07-15"]'
  ) as HTMLButtonElement;
  expect(focused.getAttribute("tabindex")).to.equal("0");
  expect(el.shadowRoot!.activeElement === focused).to.be.true;
});

it('does not swap ArrowUp/ArrowDown under dir="rtl" (direction only affects the horizontal inline axis)', async () => {
  const el = (await fixture(
    html`<lr-date-picker dir="rtl" value="2026-07-15"></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;

  dispatchGridKey(el, "ArrowDown");
  await el.updateComplete;
  expect(
    (
      el.shadowRoot!.querySelector(
        '[data-date="2026-07-22"]'
      ) as HTMLButtonElement
    ).getAttribute("tabindex")
  ).to.equal("0");

  dispatchGridKey(el, "ArrowUp");
  await el.updateComplete;
  expect(
    (
      el.shadowRoot!.querySelector(
        '[data-date="2026-07-15"]'
      ) as HTMLButtonElement
    ).getAttribute("tabindex")
  ).to.equal("0");
});

it("moves roving focus one week up/down with ArrowUp/ArrowDown", async () => {
  const el = (await fixture(
    html`<lr-date-picker value="2026-07-15"></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;

  dispatchGridKey(el, "ArrowDown");
  await el.updateComplete;
  expect(
    (
      el.shadowRoot!.querySelector(
        '[data-date="2026-07-22"]'
      ) as HTMLButtonElement
    ).getAttribute("tabindex")
  ).to.equal("0");

  dispatchGridKey(el, "ArrowUp");
  await el.updateComplete;
  expect(
    (
      el.shadowRoot!.querySelector(
        '[data-date="2026-07-15"]'
      ) as HTMLButtonElement
    ).getAttribute("tabindex")
  ).to.equal("0");
});

it("clamps the day-of-month on PageDown instead of rolling over into the wrong month", async () => {
  // Regression test: PageUp/PageDown used to build the target date via plain
  // `new Date(year, month+1, current.getDate())` construction, which the
  // Date constructor silently overflows into the *following* month when the
  // current day-of-month doesn't exist there. From Jan 31, adding one month
  // that way lands on Mar 3 (Feb only has 28 days in 2026), skipping
  // February's grid entirely instead of landing inside it.
  const el = (await fixture(
    html`<lr-date-picker value="2026-01-31"></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;
  const title = () =>
    el
      .shadowRoot!.querySelector('[part="title"]')!
      .textContent!.trim()
      .toLowerCase();

  dispatchGridKey(el, "PageDown");
  await el.updateComplete;
  expect(title()).to.contain("february");
  const focused = el.shadowRoot!.querySelector(
    '[data-date="2026-02-28"]'
  ) as HTMLButtonElement;
  expect(
    focused != null,
    "expected Jan 31 + 1 month to clamp to Feb 28"
  ).to.equal(true);
  expect(focused.getAttribute("tabindex")).to.equal("0");
  expect(el.shadowRoot!.activeElement === focused).to.be.true;
});

it("moves focus to the first/last day of the month with Home/End", async () => {
  const el = (await fixture(
    html`<lr-date-picker value="2026-07-15"></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;

  dispatchGridKey(el, "Home");
  await el.updateComplete;
  expect(
    (
      el.shadowRoot!.querySelector(
        '[data-date="2026-07-01"]'
      ) as HTMLButtonElement
    ).getAttribute("tabindex")
  ).to.equal("0");

  dispatchGridKey(el, "End");
  await el.updateComplete;
  expect(
    (
      el.shadowRoot!.querySelector(
        '[data-date="2026-07-31"]'
      ) as HTMLButtonElement
    ).getAttribute("tabindex")
  ).to.equal("0");
});

it("commits the currently-focused day with Enter or Space", async () => {
  const el = (await fixture(
    html`<lr-date-picker value="2026-07-15"></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;

  dispatchGridKey(el, "ArrowRight"); // focus moves to 2026-07-16, nothing committed yet
  await el.updateComplete;
  expect(el.value).to.equal("2026-07-15");

  setTimeout(() => dispatchGridKey(el, "Enter"));
  await oneEvent(el, "change");
  expect(el.value).to.equal("2026-07-16");

  dispatchGridKey(el, "ArrowLeft"); // focus moves to 2026-07-15
  await el.updateComplete;
  setTimeout(() => dispatchGridKey(el, " ")); // Space also commits
  await oneEvent(el, "change");
  expect(el.value).to.equal("2026-07-15");
});

it("keeps exactly one grid cell in the roving tab order after moving focus", async () => {
  const el = (await fixture(
    html`<lr-date-picker value="2026-07-15"></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;

  dispatchGridKey(el, "ArrowRight");
  await el.updateComplete;

  const inTabOrder = el.shadowRoot!.querySelectorAll(
    '[part~="day"][tabindex="0"]'
  );
  expect(inTabOrder.length).to.equal(1);
  expect(
    (requiredItem(inTabOrder, 0, 'roving day') as HTMLElement).dataset['date'],
  ).to.equal("2026-07-16");
});

it("crosses a month boundary when ArrowRight moves past the last day of the month", async () => {
  const el = (await fixture(
    html`<lr-date-picker value="2026-07-31"></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;

  dispatchGridKey(el, "ArrowRight");
  await el.updateComplete;

  const title = el
    .shadowRoot!.querySelector('[part="title"]')!
    .textContent!.trim()
    .toLowerCase();
  expect(title).to.contain("august");
  const focused = el.shadowRoot!.querySelector(
    '[data-date="2026-08-01"]'
  ) as HTMLButtonElement;
  expect(
    focused != null,
    "expected the next day, in August, to be rendered"
  ).to.equal(true);
  expect(focused.getAttribute("tabindex")).to.equal("0");
  expect(el.shadowRoot!.activeElement === focused).to.be.true;
});

it("crosses a month boundary backwards when ArrowLeft moves before the first day of the month", async () => {
  const el = (await fixture(
    html`<lr-date-picker value="2026-07-01"></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;

  dispatchGridKey(el, "ArrowLeft");
  await el.updateComplete;

  const title = el
    .shadowRoot!.querySelector('[part="title"]')!
    .textContent!.trim()
    .toLowerCase();
  expect(title).to.contain("june");
  const focused = el.shadowRoot!.querySelector(
    '[data-date="2026-06-30"]'
  ) as HTMLButtonElement;
  expect(
    focused != null,
    "expected the previous day, in June, to be rendered"
  ).to.equal(true);
  expect(focused.getAttribute("tabindex")).to.equal("0");
});

it("defaults the nav-button labels to English but lets them be overridden for other locales", async () => {
  const el = (await fixture(
    html`<lr-date-picker value="2026-07-15"></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;
  expect(
    el
      .shadowRoot!.querySelector('[part="previous"]')!
      .getAttribute("aria-label")
  ).to.equal("Previous month");
  expect(
    el.shadowRoot!.querySelector('[part="next"]')!.getAttribute("aria-label")
  ).to.equal("Next month");

  el.previousLabel = "Mois précédent";
  el.nextLabel = "Mois suivant";
  await el.updateComplete;
  expect(
    el
      .shadowRoot!.querySelector('[part="previous"]')!
      .getAttribute("aria-label")
  ).to.equal("Mois précédent");
  expect(
    el.shadowRoot!.querySelector('[part="next"]')!.getAttribute("aria-label")
  ).to.equal("Mois suivant");
});

it("keeps the ISO model Gregorian while localizing visible Persian digits", async () => {
  const el = (await fixture(
    html`<lr-date-picker
      value="2026-07-01"
      locale="fa-IR"
      with-week-numbers
    ></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;
  const cell = el.shadowRoot!.querySelector(
    '[data-date="2026-07-01"]'
  ) as HTMLButtonElement;
  const expectedDay = new Intl.NumberFormat("fa-IR").format(1);
  const expectedLabel = new Intl.DateTimeFormat("fa-IR", {
    calendar: "gregory",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(2026, 6, 1));
  expect(cell.textContent?.trim()).to.equal(expectedDay);
  expect(cell.getAttribute("aria-label")).to.equal(expectedLabel);
  expect(el.shadowRoot!.querySelector('[part="title"]')!.textContent).to.equal(
    new Intl.DateTimeFormat("fa-IR", {
      calendar: "gregory",
      month: "long",
      year: "numeric",
    }).format(new Date(2026, 6, 1))
  );
  expect(
    el.shadowRoot!.querySelector('[part="weeknumber"]')!.textContent
  ).to.match(/[۰-۹]+/);
});

it("focuses the real (non-outside) copy of a date duplicated between two with-outside-days grids, not the greyed one", async () => {
  // Regression test: with with-outside-days + months="2", a date near the
  // seam between the two visible months renders twice -- once as a trailing
  // outside day of month 1's grid, once as a real day of month 2's grid (or
  // the mirror case at the leading edge). Both copies used to be eligible to
  // compute focused=true, producing two tabindex="0" cells for the same
  // date and leaving updated()'s post-navigation `.focus()` query to grab
  // whichever copy came first in DOM order -- the greyed-out outside one.
  const el = (await fixture(html`
    <lr-date-picker
      months="2"
      with-outside-days
      first-day-of-week="mon"
    ></lr-date-picker>
  `)) as LyraDatePicker;
  el.goToDate("2026-07-01");
  await el.updateComplete;

  // July's grid (Mon-first) runs Jun 29 - Aug 9, so Aug 5 also renders as a
  // trailing outside day there, in addition to being a real day in August's
  // own grid -- two [data-date="2026-08-05"] cells while both months stay
  // on screen throughout (Jul 1 + 5 * 7 days = Aug 5, always inside the
  // already-visible July/August window).
  const grid = el.shadowRoot!.querySelector('[part="grid"]') as HTMLElement;
  for (let i = 0; i < 5; i++) {
    grid.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        composed: true,
      })
    );
  }
  await el.updateComplete;

  const copies = el.shadowRoot!.querySelectorAll('[data-date="2026-08-05"]');
  expect(
    copies,
    "expected the duplicated date to render in both month grids"
  ).to.have.length(2);

  const focusable = el.shadowRoot!.querySelectorAll(
    '[data-date="2026-08-05"][tabindex="0"]'
  );
  expect(
    focusable,
    "expected exactly one focusable copy of the duplicated date"
  ).to.have.length(1);

  const realCopy = focusable[0] as HTMLButtonElement;
  expect(
    realCopy.getAttribute("part"),
    "the focusable copy must be the real, non-outside day"
  ).to.not.contain("day-outside");
  expect(
    el.shadowRoot!.activeElement === realCopy,
    "DOM focus should land on the real copy, not the greyed outside one"
  ).to.be.true;
});

it("clear() resets the value and emits input + change", async () => {
  const el = (await fixture(
    html`<lr-date-picker value="2026-07-15"></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;
  setTimeout(() => el.clear());
  await oneEvent(el, "change");
  expect(el.value).to.equal("");
});

it("goToToday() navigates the view to the current month and focuses today", async () => {
  const el = (await fixture(
    html`<lr-date-picker value="2026-01-01"></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;
  el.goToToday();
  await el.updateComplete;

  const today = new Date();
  const cell = el.shadowRoot!.querySelector(
    `[data-date="${iso(today)}"]`
  ) as HTMLButtonElement;
  expect(
    cell != null,
    "expected today to be rendered after goToToday()"
  ).to.equal(true);
  expect(cell.getAttribute("tabindex")).to.equal("0");
  expect(el.shadowRoot!.activeElement === cell).to.be.true;
});

it("goToToday() focuses today itself, not yesterday, when disable-future is set", async () => {
  // Regression test: goToDate()/goToToday() kept the passed Date's
  // time-of-day (goToToday() passes `new Date()`, whose hours/minutes are
  // whatever the wall clock happens to be) while isDisabled() compares
  // against a midnight-normalized `today` -- so any time after midnight
  // made `focusedDate > today` true, misclassifying today itself as a
  // disabled future date and bumping the roving focus back to yesterday.
  const el = (await fixture(
    html`<lr-date-picker disable-future></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;
  el.goToToday();
  await el.updateComplete;

  const today = new Date();
  const cell = el.shadowRoot!.querySelector(
    `[data-date="${iso(today)}"]`
  ) as HTMLButtonElement;
  expect(
    cell != null,
    "expected today to be rendered after goToToday()"
  ).to.equal(true);
  expect(
    cell.disabled,
    "today itself must remain selectable under disable-future"
  ).to.be.false;
  expect(cell.getAttribute("tabindex")).to.equal("0");
  expect(el.shadowRoot!.activeElement === cell).to.be.true;
});

it("goToDate() normalizes a Date argument carrying a time-of-day to local midnight", async () => {
  const el = (await fixture(
    html`<lr-date-picker disable-future></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;
  const now = new Date();
  const withTimeOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59
  );
  el.goToDate(withTimeOfDay);
  await el.updateComplete;

  const cell = el.shadowRoot!.querySelector(
    `[data-date="${iso(now)}"]`
  ) as HTMLButtonElement;
  expect(cell.disabled).to.be.false;
  expect(el.shadowRoot!.activeElement === cell).to.be.true;
});

it("pairs overflow-y with overflow-x on each month's horizontal scroll region, mirroring lr-stepper/lr-widget (avoids a phantom vertical scrollbar)", async () => {
  const el = (await fixture(
    html`<lr-date-picker value="2026-07-15"></lr-date-picker>`
  )) as LyraDatePicker;
  const region = el.shadowRoot!.querySelector(".calendar-scroll") as HTMLElement;
  const computed = getComputedStyle(region);
  expect(computed.overflowX).to.equal("auto");
  expect(computed.overflowY).to.equal("hidden");
});

it("leaves a single month that fits its allocation completely unmasked (regression)", async () => {
  const el = (await fixture(
    html`<lr-date-picker value="2026-07-15"></lr-date-picker>`
  )) as LyraDatePicker;
  await settle();
  const region = el.shadowRoot!.querySelector(".calendar-scroll") as HTMLElement;
  expect(region.scrollWidth - region.clientWidth).to.be.at.most(1);
  const computed = getComputedStyle(region);
  const maskImage =
    computed.getPropertyValue("mask-image") ||
    computed.getPropertyValue("-webkit-mask-image");
  expect(maskImage).to.equal("none");
});

it("shows a mask-image edge fade on a month's scroll region once it overflows, matching lr-stepper/lr-widget", async () => {
  const wrapper = (await fixture(html`
    <div style="inline-size: 320px; max-inline-size: 100%; overflow: auto">
      <lr-date-picker
        value="2026-07-15"
        size="xl"
        style="inline-size: 100%; max-inline-size: 100%"
      ></lr-date-picker>
    </div>
  `)) as HTMLElement;
  const el = wrapper.querySelector("lr-date-picker") as LyraDatePicker;
  await el.updateComplete;
  await settle();
  const region = el.shadowRoot!.querySelector(".calendar-scroll") as HTMLElement;
  expect(region.scrollWidth).to.be.greaterThan(region.clientWidth);
  const computed = getComputedStyle(region);
  const maskImage =
    computed.getPropertyValue("mask-image") ||
    computed.getPropertyValue("-webkit-mask-image");
  expect(maskImage).to.not.equal("none");
  expect(maskImage).to.contain("gradient");
});

it('uses distinct logical start, middle, and end masks in LTR and RTL', async () => {
  const maskImage = (region: HTMLElement): string =>
    getComputedStyle(region).getPropertyValue('mask-image') ||
    getComputedStyle(region).getPropertyValue('-webkit-mask-image');
  const setEdges = (
    region: HTMLElement,
    start: boolean,
    end: boolean,
  ): string => {
    region.toggleAttribute('data-scroll-overflow', true);
    region.toggleAttribute('data-scroll-start', start);
    region.toggleAttribute('data-scroll-end', end);
    return maskImage(region);
  };

  const ltr = (await fixture(html`
    <div style="inline-size: 320px">
      <lr-date-picker
        size="xl"
        value="2026-07-15"
        style="inline-size: 100%; --lr-mask-opaque: rgb(1, 2, 3)"
      ></lr-date-picker>
    </div>
  `)) as HTMLElement;
  const rtl = (await fixture(html`
    <div dir="rtl" style="inline-size: 320px">
      <lr-date-picker
        size="xl"
        value="2026-07-15"
        style="inline-size: 100%; --lr-mask-opaque: rgb(1, 2, 3)"
      ></lr-date-picker>
    </div>
  `)) as HTMLElement;
  const ltrRegion = ltr.querySelector<LyraDatePicker>('lr-date-picker')!
    .shadowRoot!.querySelector<HTMLElement>('.calendar-scroll')!;
  const rtlRegion = rtl.querySelector<LyraDatePicker>('lr-date-picker')!
    .shadowRoot!.querySelector<HTMLElement>('.calendar-scroll')!;

  const ltrStart = setEdges(ltrRegion, true, false);
  const ltrMiddle = setEdges(ltrRegion, true, true);
  const ltrEnd = setEdges(ltrRegion, false, true);
  const rtlStart = setEdges(rtlRegion, true, false);
  const rtlMiddle = setEdges(rtlRegion, true, true);
  const rtlEnd = setEdges(rtlRegion, false, true);

  expect(ltrStart, 'one obscured LTR start edge').to.not.equal(ltrMiddle);
  expect(ltrEnd, 'one obscured LTR end edge').to.not.equal(ltrMiddle);
  expect(ltrStart, 'the two LTR edge directions differ').to.not.equal(ltrEnd);
  expect(rtlStart, 'one obscured RTL start edge').to.not.equal(rtlMiddle);
  expect(rtlEnd, 'one obscured RTL end edge').to.not.equal(rtlMiddle);
  expect(rtlStart, 'the two RTL edge directions differ').to.not.equal(rtlEnd);
  expect(rtlStart, 'RTL swaps the logical start fade physically').to.equal(ltrEnd);
  expect(rtlEnd, 'RTL swaps the logical end fade physically').to.equal(ltrStart);
});

it('removes every one-sided date-picker overflow mask under forced colors in both directions', async () => {
  try {
    await setForcedColors('active');
    for (const direction of ['ltr', 'rtl'] as const) {
      const wrapper = (await fixture(html`
        <div dir=${direction} style="inline-size: 320px">
          <lr-date-picker size="xl" value="2026-07-15"></lr-date-picker>
        </div>
      `)) as HTMLElement;
      const region = wrapper.querySelector<LyraDatePicker>('lr-date-picker')!
        .shadowRoot!.querySelector<HTMLElement>('.calendar-scroll')!;
      region.toggleAttribute('data-scroll-overflow', true);
      region.toggleAttribute('data-scroll-end', true);
      const mask =
        getComputedStyle(region).getPropertyValue('mask-image') ||
        getComputedStyle(region).getPropertyValue('-webkit-mask-image');
      expect(mask, `${direction} forced-colors overflow mask`).to.equal('none');
    }
  } finally {
    await setForcedColors('none');
  }
});

it('keeps the selected preset background independent from its border and foreground hooks', async () => {
  const el = (await fixture(html`
    <lr-date-picker
      mode="range"
      value="2026-08-13/2026-08-19"
      style="
        --lr-date-picker-preset-selected-bg: rgb(1, 2, 3);
        --lr-date-picker-preset-selected-border: rgb(4, 5, 6);
        --lr-date-picker-preset-selected-color: rgb(7, 8, 9);
      "
    ></lr-date-picker>
  `)) as LyraDatePicker;
  el.presets = [{ label: 'Last week', start: '2026-08-13', end: '2026-08-19' }];
  await el.updateComplete;

  const preset = el.shadowRoot!.querySelector<HTMLElement>('[part~="preset-button"]')!;
  expect(getComputedStyle(preset).backgroundColor).to.equal('rgb(1, 2, 3)');
  expect(getComputedStyle(preset).borderColor).to.equal('rgb(4, 5, 6)');
  expect(getComputedStyle(preset).color).to.equal('rgb(7, 8, 9)');
});

it("lets the component-scoped disabled opacity override the shared fallback", async () => {
  const el = (await fixture(html`
    <lr-date-picker
      value="2026-07-15"
      disabled
      style="--lr-opacity-disabled: 0.42; --lr-date-picker-disabled-opacity: 0.63"
    ></lr-date-picker>
  `)) as LyraDatePicker;
  const day = el.shadowRoot!.querySelector(
    '[part~="day"]'
  ) as HTMLButtonElement;
  expect(day.disabled).to.be.true;
  expect(getComputedStyle(day).opacity).to.equal("0.63");
});

it("clamps goToDate() to min/max instead of navigating to an out-of-range date", async () => {
  const el = (await fixture(
    html`<lr-date-picker min="2026-07-10" max="2026-07-20"></lr-date-picker>`
  )) as LyraDatePicker;
  el.goToDate("2026-08-05");
  await el.updateComplete;

  const title = el
    .shadowRoot!.querySelector('[part="title"]')!
    .textContent!.trim()
    .toLowerCase();
  expect(
    title,
    "expected the view to clamp into July instead of jumping to August"
  ).to.contain("july");
  const focused = el.shadowRoot!.querySelector(
    '[data-date="2026-07-20"]'
  ) as HTMLButtonElement;
  expect(focused != null, "expected the view to clamp to max").to.equal(true);
  expect(el.shadowRoot!.activeElement === focused).to.be.true;
});

it("has at least one focusable day cell when nothing is selected yet", async () => {
  const el = (await fixture(
    html`<lr-date-picker></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;
  const focusable = el.shadowRoot!.querySelectorAll(
    '[part~="day"][tabindex="0"]'
  );
  expect(focusable.length).to.be.at.least(1);
});

it("does not let the empty-grid fallback focus land on a disabled day 1", async () => {
  // Regression test: renderDay()'s fallback focus calculation, when there's
  // no focusedDate and no selection, used to unconditionally fall back to
  // "day 1 of the currently-shown month" as the sole tabindex="0" cell, with
  // no isDisabled() check at all. A realistic `disable-past` picker opened on
  // any day other than the 1st has day 1 disabled while today is enabled --
  // yet the old fallback still assigned tabindex="0" to disabled day 1.
  // `min` is set a few days past the 1st of the current month so day 1 is
  // guaranteed out-of-range regardless of which day of the month the test
  // actually runs on (no system-clock mocking needed).
  const today = new Date();
  const min = new Date(today.getFullYear(), today.getMonth(), 1);
  min.setDate(min.getDate() + 3);
  const el = (await fixture(
    html`<lr-date-picker disable-past min=${iso(min)}></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;

  const focusable = el.shadowRoot!.querySelectorAll(
    '[part~="day"][tabindex="0"]'
  );
  expect(focusable.length, "expected exactly one focusable day cell").to.equal(
    1
  );
  const focused = focusable[0] as HTMLButtonElement;
  expect(
    focused.disabled,
    "the fallback focus must never land on a disabled day"
  ).to.be.false;
});

it("renormalizes the roving date when a dynamic minimum disables the selected day", async () => {
  const el = (await fixture(
    html`<lr-date-picker value="2026-07-15" min="2026-07-01"></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;

  el.min = "2026-07-20";
  await el.updateComplete;

  const focusable = el.shadowRoot!.querySelectorAll(
    '[part~="day"][tabindex="0"]'
  );
  expect(
    focusable.length,
    "expected one roving focus target after the constraint update"
  ).to.equal(1);
  const focused = requiredItem(focusable, 0, 'focusable day') as HTMLButtonElement;
  expect(
    focused.dataset['date'],
    "expected focus to move to the nearest enabled day"
  ).to.equal("2026-07-20");
  expect(focused.disabled, "the roving focus target must be enabled").to.be
    .false;
});

it("never lands keyboard focus on a disabled day", async () => {
  const el = (await fixture(
    html`<lr-date-picker min="2026-01-15" value="2026-01-15"></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;
  const grid = el.shadowRoot!.querySelector('[part="grid"]') as HTMLElement;
  grid.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })
  );
  await el.updateComplete;
  const focused = el.shadowRoot!.querySelector(
    '[part~="day"][tabindex="0"]'
  ) as HTMLButtonElement;
  expect(focused.disabled).to.be.false;
});

it("skips over a run of disabled days to find the next enabled one", async () => {
  const el = (await fixture(
    html`<lr-date-picker min="2026-01-10" value="2026-01-10"></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;
  const grid = el.shadowRoot!.querySelector('[part="grid"]') as HTMLElement;
  // From Jan 10 (the min), ArrowLeft would naively land on Jan 9 -- and every
  // day before the 10th is disabled -- so focus must skip clear past all of
  // them to the closest enabled day in that direction, if any exists; here
  // none exists in January, so focus should not move onto a disabled cell.
  grid.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })
  );
  await el.updateComplete;
  const focused = el.shadowRoot!.querySelector(
    '[part~="day"][tabindex="0"]'
  ) as HTMLButtonElement;
  expect(focused.disabled).to.be.false;
});

it("disables the prev/next nav buttons when the picker itself is disabled", async () => {
  const el = (await fixture(
    html`<lr-date-picker disabled></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;
  const prev = el.shadowRoot!.querySelector(
    '[part="previous"]'
  ) as HTMLButtonElement;
  const next = el.shadowRoot!.querySelector(
    '[part="next"]'
  ) as HTMLButtonElement;
  expect(prev.disabled).to.be.true;
  expect(next.disabled).to.be.true;
});

it("keeps month navigation available while the picker is readonly", async () => {
  const el = (await fixture(
    html`<lr-date-picker readonly value="2026-07-15"></lr-date-picker>`
  )) as LyraDatePicker;
  await el.updateComplete;
  const prev = el.shadowRoot!.querySelector(
    '[part="previous"]'
  ) as HTMLButtonElement;
  const next = el.shadowRoot!.querySelector(
    '[part="next"]'
  ) as HTMLButtonElement;
  expect(prev.disabled).to.be.false;
  expect(next.disabled).to.be.false;
  next.click();
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[data-date="2026-08-15"]'), "browsing reaches August").to.exist;
  expect(el.value, "browsing never changes the value").to.equal("2026-07-15");
});

// -- Lifecycle super calls ---------------------------------------------------
it("chains willUpdate() to super.willUpdate() so a mixin layered under LyraElement would still run", async () => {
  // No shared mixin actually overrides willUpdate() today, so the only way to prove the chain is
  // live (rather than grepping source text for the call) is to patch the base-class hook itself
  // -- the exact hook a future mixin would extend -- and confirm it actually fires.
  const hadOwn = Object.prototype.hasOwnProperty.call(
    LitElement.prototype,
    "willUpdate"
  );
  const original = (
    LitElement.prototype as unknown as {
      willUpdate?: (changed: PropertyValues) => void;
    }
  ).willUpdate;
  let called = false;
  (
    LitElement.prototype as unknown as {
      willUpdate: (changed: PropertyValues) => void;
    }
  ).willUpdate = function (this: LitElement, changed: PropertyValues) {
    called = true;
    original?.call(this, changed);
  };
  try {
    const el = (await fixture(
      html`<lr-date-picker></lr-date-picker>`
    )) as LyraDatePicker;
    await el.updateComplete;
    expect(called).to.be.true;
  } finally {
    if (hadOwn) {
      (LitElement.prototype as unknown as { willUpdate: unknown }).willUpdate =
        original;
    } else {
      delete (LitElement.prototype as unknown as { willUpdate?: unknown })
        .willUpdate;
    }
  }
});

it("chains updated() to super.updated() so a mixin layered under LyraElement would still run", async () => {
  const hadOwn = Object.prototype.hasOwnProperty.call(
    LitElement.prototype,
    "updated"
  );
  const original = (
    LitElement.prototype as unknown as {
      updated?: (changed: PropertyValues) => void;
    }
  ).updated;
  let called = false;
  (
    LitElement.prototype as unknown as {
      updated: (changed: PropertyValues) => void;
    }
  ).updated = function (this: LitElement, changed: PropertyValues) {
    called = true;
    original?.call(this, changed);
  };
  try {
    const el = (await fixture(
      html`<lr-date-picker></lr-date-picker>`
    )) as LyraDatePicker;
    await el.updateComplete;
    expect(called).to.be.true;
  } finally {
    if (hadOwn) {
      (LitElement.prototype as unknown as { updated: unknown }).updated =
        original;
    } else {
      delete (LitElement.prototype as unknown as { updated?: unknown }).updated;
    }
  }
});

describe("date-picker coverage gaps", () => {
  it("clears the value when valueAsDate is set to null or an invalid Date", async () => {
    const el = (await fixture(
      html`<lr-date-picker value="2026-07-15"></lr-date-picker>`
    )) as LyraDatePicker;
    el.valueAsDate = null;
    expect(el.value).to.equal("");

    el.value = "2026-07-15";
    el.valueAsDate = new Date(NaN);
    expect(el.value).to.equal("");
  });

  it("treats a throwing isDateDisabled predicate as advisory, not fatal", async () => {
    const el = (await fixture(
      html`<lr-date-picker value="2026-07-15"></lr-date-picker>`
    )) as LyraDatePicker;
    el.isDateDisabled = () => {
      throw new Error("boom");
    };
    await el.updateComplete;
    const day = el.shadowRoot!.querySelector(
      '[data-date="2026-07-20"]'
    ) as HTMLButtonElement;
    expect(day.disabled).to.be.false;
    setTimeout(() => day.click());
    await oneEvent(el, "change");
    expect(el.value).to.equal("2026-07-20");
  });

  it("focus() moves DOM focus to the roving day cell", async () => {
    const el = (await fixture(
      html`<lr-date-picker value="2026-07-15"></lr-date-picker>`
    )) as LyraDatePicker;
    await el.updateComplete;
    el.focus();
    const day = el.shadowRoot!.querySelector(
      '[data-date="2026-07-15"]'
    ) as HTMLButtonElement;
    expect(el.shadowRoot!.activeElement === day).to.be.true;
  });

  it("focus() moves DOM focus to the roving selection-view item when not showing days", async () => {
    const el = (await fixture(
      html`<lr-date-picker value="2026-07-15" view="months"></lr-date-picker>`
    )) as LyraDatePicker;
    await el.updateComplete;
    el.focus();
    const item = el.shadowRoot!.querySelector(
      '[part~="view-item"][tabindex="0"]'
    ) as HTMLButtonElement;
    expect(el.shadowRoot!.activeElement === item).to.be.true;
  });

  it("blur() forwards to the roving day cell, since the host itself never took focus", async () => {
    const el = (await fixture(
      html`<lr-date-picker value="2026-07-15"></lr-date-picker>`
    )) as LyraDatePicker;
    await el.updateComplete;
    el.focus();
    const day = el.shadowRoot!.querySelector(
      '[data-date="2026-07-15"]'
    ) as HTMLButtonElement;
    expect(el.shadowRoot!.activeElement === day).to.be.true;
    el.blur();
    expect(el.shadowRoot!.activeElement === null).to.be.true;
  });

  it("click() forwards to and activates the roving day cell", async () => {
    const el = (await fixture(
      html`<lr-date-picker value="2026-07-15"></lr-date-picker>`
    )) as LyraDatePicker;
    await el.updateComplete;
    let clicks = 0;
    const day = el.shadowRoot!.querySelector(
      '[data-date="2026-07-15"]'
    ) as HTMLButtonElement;
    day.addEventListener("click", () => clicks++);
    el.click();
    expect(clicks).to.equal(1);
  });

  const viewItems = (el: LyraDatePicker): HTMLButtonElement[] =>
    Array.from(
      el.shadowRoot!.querySelectorAll('[part~="view-item"]')
    ) as HTMLButtonElement[];

  const activeViewItemIndex = (el: LyraDatePicker): number =>
    viewItems(el).findIndex((item) => item.tabIndex === 0);

  const focusedViewItemIndex = (el: LyraDatePicker): number =>
    viewItems(el).indexOf(el.shadowRoot!.activeElement as HTMLButtonElement);

  const dispatchViewGridKey = (
    el: LyraDatePicker,
    key: string
  ): KeyboardEvent => {
    const event = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    viewItems(el)[activeViewItemIndex(el)]!.dispatchEvent(event);
    return event;
  };

  it("gives every selection view one roving tab stop on its selected period", async () => {
    for (const view of ["months", "years", "decades"] as const) {
      const el = (await fixture(html`
        <lr-date-picker view=${view} value="2026-06-15"></lr-date-picker>
      `)) as LyraDatePicker;
      await el.updateComplete;

      const items = viewItems(el);
      const selectedIndex = items.findIndex((item) =>
        item.getAttribute("part")!.includes("view-item-selected")
      );
      expect(selectedIndex, view).to.be.greaterThan(-1);
      expect(items.filter((item) => item.tabIndex === 0).length, view).to.equal(
        1
      );
      expect(items[selectedIndex]!.tabIndex, view).to.equal(0);
      expect(
        items.every(
          (item, index) => index === selectedIndex || item.tabIndex === -1
        ),
        view
      ).to.equal(true);
      await expect(el).shadowDom.to.be.accessible();
    }
  });

  it("names each selection grid from its localized title", async () => {
    for (const view of ["months", "years", "decades"] as const) {
      const el = (await fixture(html`
        <lr-date-picker view=${view} value="2026-06-15"></lr-date-picker>
      `)) as LyraDatePicker;
      await el.updateComplete;

      const title = el.shadowRoot!.querySelector(
        '[part="title"]'
      ) as HTMLButtonElement;
      const grid = el.shadowRoot!.querySelector(
        '[part="view-grid"]'
      ) as HTMLElement;
      expect(grid.getAttribute("aria-label"), view).to.equal(
        title.textContent!.trim()
      );
    }
  });

  it("keeps a selection grid named when a header slot replaces its navigation title", async () => {
    const el = (await fixture(html`
      <lr-date-picker view="months" value="2026-06-15">
        <span slot="header">Custom calendar header</span>
      </lr-date-picker>
    `)) as LyraDatePicker;
    await el.updateComplete;

    const grid = el.shadowRoot!.querySelector(
      '[part="view-grid"]'
    ) as HTMLElement;
    expect(grid.getAttribute("aria-label")).to.equal("2026");
    expect(grid.hasAttribute("aria-labelledby")).to.equal(false);
  });

  it("restores focus into each selection grid when the title advances the view", async () => {
    const el = (await fixture(html`
      <lr-date-picker value="2026-06-15"></lr-date-picker>
    `)) as LyraDatePicker;

    for (const [view, expectedStart] of [
      ["months", "2026-06-01"],
      ["years", "2026-01-01"],
      ["decades", "2020-01-01"],
    ] as const) {
      await el.updateComplete;
      const title = el.shadowRoot!.querySelector(
        '[part="title"]'
      ) as HTMLButtonElement;
      title.focus();
      title.click();
      await el.updateComplete;

      const active = viewItems(el)[activeViewItemIndex(el)]!;
      expect(el.view).to.equal(view);
      expect(active.getAttribute("data-view-start")).to.equal(expectedStart);
      expect(focusedViewItemIndex(el)).to.equal(activeViewItemIndex(el));
    }
  });

  it("moves selection-view focus by its visual 4-column grid and mirrors horizontal keys in RTL", async () => {
    const el = (await fixture(html`
      <lr-date-picker view="months" value="2026-06-15"></lr-date-picker>
    `)) as LyraDatePicker;
    await el.updateComplete;
    viewItems(el)[activeViewItemIndex(el)]!.focus();

    const right = dispatchViewGridKey(el, "ArrowRight");
    await el.updateComplete;
    expect(right.defaultPrevented).to.equal(true);
    expect(activeViewItemIndex(el)).to.equal(6);
    expect(focusedViewItemIndex(el)).to.equal(6);

    dispatchViewGridKey(el, "ArrowLeft");
    await el.updateComplete;
    expect(activeViewItemIndex(el)).to.equal(5);
    expect(focusedViewItemIndex(el)).to.equal(5);

    dispatchViewGridKey(el, "ArrowUp");
    await el.updateComplete;
    expect(activeViewItemIndex(el)).to.equal(1);
    expect(focusedViewItemIndex(el)).to.equal(1);

    dispatchViewGridKey(el, "ArrowDown");
    await el.updateComplete;
    expect(activeViewItemIndex(el)).to.equal(5);
    expect(focusedViewItemIndex(el)).to.equal(5);

    dispatchViewGridKey(el, "Home");
    await el.updateComplete;
    expect(activeViewItemIndex(el)).to.equal(0);

    dispatchViewGridKey(el, "End");
    await el.updateComplete;
    expect(activeViewItemIndex(el)).to.equal(11);

    const unrelated = dispatchViewGridKey(el, "Tab");
    await el.updateComplete;
    expect(unrelated.defaultPrevented).to.equal(false);
    expect(activeViewItemIndex(el)).to.equal(11);

    const rtl = (await fixture(html`
      <lr-date-picker
        dir="rtl"
        view="months"
        value="2026-06-15"
      ></lr-date-picker>
    `)) as LyraDatePicker;
    await rtl.updateComplete;
    viewItems(rtl)[activeViewItemIndex(rtl)]!.focus();
    dispatchViewGridKey(rtl, "ArrowLeft");
    await rtl.updateComplete;
    expect(activeViewItemIndex(rtl)).to.equal(6);
    expect(focusedViewItemIndex(rtl)).to.equal(6);
  });

  it("uses period-sized horizontal movement in year and decade selection views", async () => {
    for (const [view, expectedStart] of [
      ["years", "2027-01-01"],
      ["decades", "2030-01-01"],
    ] as const) {
      const el = (await fixture(html`
        <lr-date-picker view=${view} value="2026-06-15"></lr-date-picker>
      `)) as LyraDatePicker;
      await el.updateComplete;
      viewItems(el)[activeViewItemIndex(el)]!.focus();

      const right = dispatchViewGridKey(el, "ArrowRight");
      await el.updateComplete;
      const active = viewItems(el)[activeViewItemIndex(el)]!;
      expect(right.defaultPrevented, view).to.equal(true);
      expect(active.getAttribute("data-view-start"), view).to.equal(
        expectedStart
      );
      expect(focusedViewItemIndex(el), view).to.equal(activeViewItemIndex(el));
    }
  });

  it("keeps view-grid roving focus out of disabled periods and moves it across a page boundary", async () => {
    const constrained = (await fixture(html`
      <lr-date-picker
        view="months"
        value="2026-03-15"
        min="2026-03-01"
      ></lr-date-picker>
    `)) as LyraDatePicker;
    await constrained.updateComplete;
    expect(activeViewItemIndex(constrained)).to.equal(2);
    viewItems(constrained)[2]!.focus();
    const home = dispatchViewGridKey(constrained, "Home");
    await constrained.updateComplete;
    expect(home.defaultPrevented).to.equal(true);
    expect(activeViewItemIndex(constrained)).to.equal(2);
    expect(focusedViewItemIndex(constrained)).to.equal(2);

    const boundary = (await fixture(html`
      <lr-date-picker view="months" value="2026-12-15"></lr-date-picker>
    `)) as LyraDatePicker;
    await boundary.updateComplete;
    viewItems(boundary)[activeViewItemIndex(boundary)]!.focus();
    dispatchViewGridKey(boundary, "ArrowRight");
    await boundary.updateComplete;
    const active = viewItems(boundary)[activeViewItemIndex(boundary)]!;
    expect(active.getAttribute("data-view-start")).to.equal("2027-01-01");
    expect(focusedViewItemIndex(boundary)).to.equal(
      activeViewItemIndex(boundary)
    );
  });

  it("clamps an entirely out-of-range initial selection page to an enabled period", async () => {
    const year = new Date().getFullYear() + 5;
    const el = (await fixture(html`
      <lr-date-picker view="months" min=${`${year}-01-01`}></lr-date-picker>
    `)) as LyraDatePicker;
    await el.updateComplete;

    const active = viewItems(el)[activeViewItemIndex(el)]!;
    expect(active.getAttribute("data-view-start")).to.equal(`${year}-01-01`);
    expect(active.disabled).to.equal(false);
  });

  it("re-homes focus onto an enabled page when a live bound disables every current period", async () => {
    const year = new Date().getFullYear() - 5;
    const el = (await fixture(
      html`<lr-date-picker view="months"></lr-date-picker>`
    )) as LyraDatePicker;
    await el.updateComplete;
    viewItems(el)[activeViewItemIndex(el)]!.focus();
    await el.updateComplete;

    el.max = `${year}-12-31`;
    await el.updateComplete;
    const active = viewItems(el)[activeViewItemIndex(el)]!;
    expect(active.getAttribute("data-view-start")).to.equal(`${year}-12-01`);
    expect(active.disabled).to.equal(false);
    expect(focusedViewItemIndex(el)).to.equal(activeViewItemIndex(el));
  });

  it("re-homes focused selection-view DOM focus when a live bound disables its period", async () => {
    const el = (await fixture(html`
      <lr-date-picker view="months" value="2026-06-15"></lr-date-picker>
    `)) as LyraDatePicker;
    await el.updateComplete;
    viewItems(el)[activeViewItemIndex(el)]!.focus();
    await el.updateComplete;

    el.max = "2026-05-31";
    await el.updateComplete;
    expect(activeViewItemIndex(el)).to.equal(4);
    expect(focusedViewItemIndex(el)).to.equal(4);
  });

  it("activates selection-view roving targets with Enter and Space, restoring focus in the destination view", async () => {
    const months = (await fixture(html`
      <lr-date-picker view="months" value="2026-06-15"></lr-date-picker>
    `)) as LyraDatePicker;
    await months.updateComplete;
    viewItems(months)[activeViewItemIndex(months)]!.focus();
    const enter = dispatchViewGridKey(months, "Enter");
    await months.updateComplete;
    expect(enter.defaultPrevented).to.equal(true);
    expect(months.view).to.equal("days");
    const day = months.shadowRoot!.querySelector(
      '[part~="day"][tabindex="0"]'
    ) as HTMLButtonElement | null;
    expect(day !== null).to.equal(true);
    expect(months.shadowRoot!.activeElement === day).to.equal(true);

    const years = (await fixture(html`
      <lr-date-picker
        view="years"
        value="2026-06-15"
        style="--lr-transition-fast: 0s"
      ></lr-date-picker>
    `)) as LyraDatePicker;
    await years.updateComplete;
    viewItems(years)[activeViewItemIndex(years)]!.focus();
    const space = dispatchViewGridKey(years, " ");
    await years.updateComplete;
    expect(space.defaultPrevented).to.equal(true);
    expect(years.view).to.equal("months");
    expect(focusedViewItemIndex(years)).to.equal(activeViewItemIndex(years));
    // The destination view's roving-target/selected items repaint through the same eased
    // background-color transition as hover/press; even zeroed, a transition still renders one
    // interpolated (partial-contrast) frame in the same tick, which is exactly what a synchronous
    // axe color-contrast check right after updateComplete can catch. Settle two frames first so
    // the accessibility snapshot reads the real, final theme colours.
    await settlePointer();
    await expect(years).shadowDom.to.be.accessible();
  });

  it("falls back to the current view month instead of throwing when every day is disabled and there is no focus or selection yet", async () => {
    const el = (await fixture(html`
      <lr-date-picker
        disabled-days-of-week="sun,mon,tue,wed,thu,fri,sat"
      ></lr-date-picker>
    `)) as LyraDatePicker;
    await el.updateComplete;
    const grid = el.shadowRoot!.querySelector('[part="grid"]') as HTMLElement;
    expect(() =>
      grid.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
      )
    ).to.not.throw();
    expect(el.focusedDate).to.equal("");
  });

  it("previews the pending range while hovering a day after picking the first endpoint, in either direction", async () => {
    const el = (await fixture(
      html`<lr-date-picker mode="range"></lr-date-picker>`
    )) as LyraDatePicker;
    el.goToDate("2026-07-01");
    await el.updateComplete;
    (
      el.shadowRoot!.querySelector(
        '[data-date="2026-07-10"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;

    // Hovering after the picked endpoint.
    (
      el.shadowRoot!.querySelector(
        '[data-date="2026-07-15"]'
      ) as HTMLButtonElement
    ).dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    await el.updateComplete;
    let preview = Array.from(
      el.shadowRoot!.querySelectorAll('[part~="day-range-preview"]')
    ).map((node) => (node as HTMLElement).getAttribute("data-date"));
    expect(preview).to.deep.equal([
      "2026-07-11",
      "2026-07-12",
      "2026-07-13",
      "2026-07-14",
      "2026-07-15",
    ]);

    // Hovering before the picked endpoint.
    (
      el.shadowRoot!.querySelector(
        '[data-date="2026-07-05"]'
      ) as HTMLButtonElement
    ).dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    await el.updateComplete;
    preview = Array.from(
      el.shadowRoot!.querySelectorAll('[part~="day-range-preview"]')
    ).map((node) => (node as HTMLElement).getAttribute("data-date"));
    expect(preview).to.deep.equal([
      "2026-07-05",
      "2026-07-06",
      "2026-07-07",
      "2026-07-08",
      "2026-07-09",
    ]);
  });

  it("falls back to the plain day number when dayContent throws", async () => {
    const el = (await fixture(
      html`<lr-date-picker value="2026-07-15"></lr-date-picker>`
    )) as LyraDatePicker;
    el.dayContent = () => {
      throw new Error("boom");
    };
    await el.updateComplete;
    const day = el.shadowRoot!.querySelector(
      '[data-date="2026-07-20"]'
    ) as HTMLButtonElement;
    expect(day.textContent!.trim()).to.equal("20");
  });

  it("disables every selection-view item while the picker itself is disabled", async () => {
    const el = (await fixture(
      html`<lr-date-picker
        value="2026-06-15"
        view="months"
        disabled
      ></lr-date-picker>`
    )) as LyraDatePicker;
    await el.updateComplete;
    const items = Array.from(
      el.shadowRoot!.querySelectorAll('[part~="view-item"]')
    ) as HTMLButtonElement[];
    expect(items.length).to.be.greaterThan(0);
    for (const item of items) {
      expect(item.disabled).to.be.true;
      expect(item.getAttribute("part")).to.include("view-item-disabled");
    }
    items[0]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await el.updateComplete;
    expect(el.view).to.equal("months");
  });

  it("disables only the out-of-range months in the month-selection view when min applies", async () => {
    const el = (await fixture(
      html`<lr-date-picker
        value="2026-06-15"
        min="2026-03-01"
      ></lr-date-picker>`
    )) as LyraDatePicker;
    el.view = "months";
    await el.updateComplete;
    const items = Array.from(
      el.shadowRoot!.querySelectorAll('[part~="view-item"]')
    ) as HTMLButtonElement[];
    expect(requiredItem(items, 0, 'January').disabled, "January is entirely before the March minimum").to
      .be.true; // January
    expect(requiredItem(items, 5, 'June').disabled, "June is on/after the March minimum").to.be.false; // June
  });

  it("disables selection periods that contain no selectable day under past-date constraints", async () => {
    const el = (await fixture(html`
      <lr-date-picker
        view="months"
        value="2026-07-15"
        today="2026-07-15"
        disable-past
      ></lr-date-picker>
    `)) as LyraDatePicker;
    await el.updateComplete;

    const items = viewItems(el);
    expect(
      items[5]!.disabled,
      "June contains only dates before the configured today"
    ).to.equal(true);
    expect(
      items[6]!.disabled,
      "July still contains selectable dates on and after today"
    ).to.equal(false);

    (el as unknown as { pickViewItem(date: Date): void }).pickViewItem(
      new Date(2026, 5, 1)
    );
    await el.updateComplete;
    expect(
      el.view,
      "an unavailable period remains unavailable to programmatic activation"
    ).to.equal("months");
  });

  it("refreshes selection-period availability after live constraints change", async () => {
    const el = (await fixture(html`
      <lr-date-picker
        view="months"
        value="2026-07-15"
        today="2026-07-15"
        disable-future
      ></lr-date-picker>
    `)) as LyraDatePicker;
    await el.updateComplete;
    expect(
      viewItems(el)[6]!.disabled,
      "July initially contains dates through the configured today"
    ).to.equal(false);

    el.today = "2026-06-30";
    await el.updateComplete;
    expect(
      viewItems(el)[6]!.disabled,
      "July becomes unavailable after the live today change"
    ).to.equal(true);
  });

  it("clamps an all-unavailable selection page to a page with an enabled period", async () => {
    const el = (await fixture(
      html`<lr-date-picker view="months"></lr-date-picker>`
    )) as LyraDatePicker;
    await el.updateComplete;
    (el as unknown as { viewDate: Date }).viewDate = new Date(2026, 0, 1);
    el.isDateDisabled = (date) => date.getFullYear() === 2026;
    await el.updateComplete;

    const first = viewItems(el)[0]!;
    expect(first.getAttribute("data-view-start")).to.equal("2027-01-01");
    expect(first.disabled).to.equal(false);
  });

  it("uses disabled date lists and predicates for selection-period availability", async () => {
    const el = (await fixture(html`
      <lr-date-picker view="months" value="2026-07-15"></lr-date-picker>
    `)) as LyraDatePicker;
    el.disabledDates = Array.from(
      { length: 31 },
      (_, index) => new Date(2026, 6, index + 1)
    );
    el.isDateDisabled = (date) => date.getMonth() === 7;
    await el.updateComplete;

    const items = viewItems(el);
    expect(
      items[6]!.disabled,
      "every July date comes from disabledDates"
    ).to.equal(true);
    expect(
      items[7]!.disabled,
      "the predicate makes every August date unavailable"
    ).to.equal(true);
    expect(items[8]!.disabled, "September remains selectable").to.equal(false);
  });

  it("uses a pending range constraint for selection-view focus and keyboard navigation", async () => {
    const el = (await fixture(html`
      <lr-date-picker
        mode="range"
        view="months"
        value="2026-07-10"
        min-range="3"
        max-range="5"
      ></lr-date-picker>
    `)) as LyraDatePicker;
    await el.updateComplete;

    const items = viewItems(el);
    expect(
      items[5]!.disabled,
      "June falls outside the pending range limit"
    ).to.equal(true);
    expect(
      items[6]!.disabled,
      "July still contains valid second endpoints"
    ).to.equal(false);
    expect(
      items[7]!.disabled,
      "August falls outside the pending range limit"
    ).to.equal(true);
    expect(activeViewItemIndex(el)).to.equal(6);

    viewItems(el)[6]!.focus();
    const next = dispatchViewGridKey(el, "ArrowRight");
    await el.updateComplete;
    expect(next.defaultPrevented).to.equal(true);
    expect(
      activeViewItemIndex(el),
      "keyboard navigation does not enter an unavailable month"
    ).to.equal(6);
    expect(focusedViewItemIndex(el)).to.equal(6);
  });

  it("marks every selection period unavailable when every weekday is disabled", async () => {
    const el = (await fixture(html`
      <lr-date-picker
        view="months"
        value="2026-07-15"
        disabled-days-of-week="sun,mon,tue,wed,thu,fri,sat"
      ></lr-date-picker>
    `)) as LyraDatePicker;
    await el.updateComplete;

    expect(viewItems(el).every((item) => item.disabled)).to.equal(true);
  });

  it("drills into the day grid after picking a month from the month-selection view", async () => {
    const el = (await fixture(
      html`<lr-date-picker value="2026-06-15"></lr-date-picker>`
    )) as LyraDatePicker;
    el.view = "months";
    await el.updateComplete;
    const items = el.shadowRoot!.querySelectorAll('[part~="view-item"]');
    (items[8] as HTMLButtonElement).click(); // September
    await el.updateComplete;
    expect(el.view).to.equal("days");
    const title = el
      .shadowRoot!.querySelector('[part="title"]')!
      .textContent!.trim()
      .toLowerCase();
    expect(title).to.contain("september");
  });

  it("drills from decades through years and months down to the day grid", async () => {
    const el = (await fixture(
      html`<lr-date-picker value="2026-06-15"></lr-date-picker>`
    )) as LyraDatePicker;
    el.view = "decades";
    await el.updateComplete;

    let items = el.shadowRoot!.querySelectorAll('[part~="view-item"]');
    (items[0] as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.view).to.equal("years");

    items = el.shadowRoot!.querySelectorAll('[part~="view-item"]');
    (items[0] as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.view).to.equal("months");

    items = el.shadowRoot!.querySelectorAll('[part~="view-item"]');
    (items[0] as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.view).to.equal("days");
  });

  it("navigates by year/decade/century with the previous/next buttons in each selection-view granularity", async () => {
    const el = (await fixture(
      html`<lr-date-picker value="2026-06-15"></lr-date-picker>`
    )) as LyraDatePicker;
    const title = () =>
      el.shadowRoot!.querySelector('[part="title"]')!.textContent!.trim();

    el.view = "months";
    await el.updateComplete;
    expect(title()).to.equal("2026");
    (
      el.shadowRoot!.querySelector('[part="next"]') as HTMLButtonElement
    ).click();
    await el.updateComplete;
    expect(title()).to.equal("2027");
    (
      el.shadowRoot!.querySelector('[part="previous"]') as HTMLButtonElement
    ).click();
    await el.updateComplete;
    expect(title()).to.equal("2026");

    el.view = "years";
    await el.updateComplete;
    const yearsBefore = title();
    (
      el.shadowRoot!.querySelector('[part="next"]') as HTMLButtonElement
    ).click();
    await el.updateComplete;
    expect(title()).to.not.equal(yearsBefore);
    (
      el.shadowRoot!.querySelector('[part="previous"]') as HTMLButtonElement
    ).click();
    await el.updateComplete;
    expect(title()).to.equal(yearsBefore);

    el.view = "decades";
    await el.updateComplete;
    const decadesBefore = title();
    (
      el.shadowRoot!.querySelector('[part="next"]') as HTMLButtonElement
    ).click();
    await el.updateComplete;
    expect(title()).to.not.equal(decadesBefore);
    (
      el.shadowRoot!.querySelector('[part="previous"]') as HTMLButtonElement
    ).click();
    await el.updateComplete;
    expect(title()).to.equal(decadesBefore);
  });

  it("slides the view to a directly-assigned focusedDate that is not currently visible", async () => {
    const el = (await fixture(
      html`<lr-date-picker value="2026-07-15"></lr-date-picker>`
    )) as LyraDatePicker;
    await el.updateComplete;
    el.focusedDate = "2026-09-10";
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-date="2026-09-10"]')).to.exist;
  });

  it("clear() resets a range-mode value and emits input + change", async () => {
    const el = (await fixture(
      html`<lr-date-picker
        mode="range"
        value="2026-07-05/2026-07-10"
      ></lr-date-picker>`
    )) as LyraDatePicker;
    await el.updateComplete;
    setTimeout(() => el.clear());
    await oneEvent(el, "change");
    expect(el.value).to.equal("");
  });

  it("ignores keys other than the roving-navigation set on the calendar grid", async () => {
    const el = (await fixture(
      html`<lr-date-picker value="2026-07-15"></lr-date-picker>`
    )) as LyraDatePicker;
    await el.updateComplete;
    const grid = el.shadowRoot!.querySelector('[part="grid"]') as HTMLElement;
    const before = el.focusedDate;
    grid.dispatchEvent(
      new KeyboardEvent("keydown", { key: "a", bubbles: true })
    );
    await el.updateComplete;
    expect(el.focusedDate).to.equal(before);
  });

  it("applies custom previous/next labels to the nav buttons in the selection views (months/years/decades), not just the day grid", async () => {
    const el = (await fixture(html`
      <lr-date-picker
        value="2026-06-15"
        view="months"
        previous-label="Prev year"
        next-label="Next year"
      ></lr-date-picker>
    `)) as LyraDatePicker;
    await el.updateComplete;
    expect(
      (
        el.shadowRoot!.querySelector('[part="previous"]') as HTMLButtonElement
      ).getAttribute("aria-label")
    ).to.equal("Prev year");
    expect(
      (
        el.shadowRoot!.querySelector('[part="next"]') as HTMLButtonElement
      ).getAttribute("aria-label")
    ).to.equal("Next year");
  });
});

// Follow-up defects in the 11.0.0 presets feature, both reported from a real dashboard filter.
describe('range preset identity and open bounds', () => {
  async function pickerWith(
    presets: unknown[],
    attrs: Record<string, string> = {},
  ): Promise<LyraDatePicker> {
    const el = (await fixture(
      html`<lr-date-picker mode="range"></lr-date-picker>`,
    )) as LyraDatePicker;
    for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
    el.presets = presets as never;
    await el.updateComplete;
    return el;
  }

  const buttons = (el: LyraDatePicker): HTMLButtonElement[] =>
    Array.from(el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="preset-button"]'));

  it('projects preset fields once from own data descriptors, skips unsafe siblings, and retains only source identity', async () => {
    const target = {
      label: 'Safe range',
      start: '2026-08-13',
      end: '2026-08-19',
    };
    let descriptorReads = 0;
    const source = new Proxy(target, {
      get(): never {
        throw new Error('the source preset must not be read after projection');
      },
      getOwnPropertyDescriptor(value, key): PropertyDescriptor | undefined {
        descriptorReads += 1;
        return Reflect.getOwnPropertyDescriptor(value, key);
      },
    });
    const unsafe = Object.defineProperty({}, 'label', {
      enumerable: true,
      get(): never {
        throw new Error('unsafe preset accessor');
      },
    });
    const el = await pickerWith([
      unsafe,
      source,
    ]);

    expect(buttons(el).map((button) => button.textContent?.trim())).to.deep.equal([
      'Safe range',
    ]);
    expect(descriptorReads, 'one closed-field descriptor read per admitted preset field').to.equal(3);

    target.label = 'Mutated after assignment';
    el.today = '2026-08-15';
    await el.updateComplete;
    expect(buttons(el)[0]!.textContent?.trim()).to.equal('Safe range');

    buttons(el)[0]!.click();
    await el.updateComplete;
    expect(el.appliedPreset).to.equal(source);
  });

  it('omits a revoked preset proxy while retaining a later valid preset and its source identity', async () => {
    const { proxy: revoked, revoke } = Proxy.revocable(
      { label: 'Revoked preset', start: '2026-08-13', end: '2026-08-19' },
      {},
    );
    revoke();
    const source = { label: 'Safe preset', start: '2026-08-13', end: '2026-08-19' };

    const el = await pickerWith([revoked, source]);

    expect(buttons(el).map((button) => button.textContent?.trim())).to.deep.equal([
      'Safe preset',
    ]);
    buttons(el)[0]!.click();
    await el.updateComplete;
    expect(el.appliedPreset).to.equal(source);
  });

  it('admits a live preset-array proxy through bounded descriptors and retains its later valid source', async () => {
    const values: unknown[] = [];
    Object.defineProperty(values, '0', {
      configurable: true,
      enumerable: true,
      get(): never {
        throw new Error('unsafe preset entry');
      },
    });
    const source = { label: 'Safe proxy preset', start: '2026-08-13', end: '2026-08-19' };
    values[1] = source;
    const liveProxy = new Proxy(values, {
      get(): never {
        throw new Error('preset projection must not iterate a live array proxy');
      },
    });

    const el = await pickerWith(liveProxy as unknown as unknown[]);

    expect(buttons(el).map((button) => button.textContent?.trim())).to.deep.equal([
      'Safe proxy preset',
    ]);
    buttons(el)[0]!.click();
    await el.updateComplete;
    expect(el.appliedPreset).to.equal(source);
  });

  // "Last 7 days" has to stay RELATIVE across a reload, so a consumer must persist which preset was
  // applied, not the pair it froze to. Re-deriving it by string-matching the value is exactly the
  // mapping table the feature set out to delete, and it is ambiguous besides: Today and This month
  // coincide on the 1st, and a manual selection can equal a preset's pair by construction.
  it('reports which preset produced the value', async () => {
    const el = await pickerWith([
      { label: 'Last 7 days', start: '2026-08-13', end: '2026-08-19' },
    ]);
    let seen: unknown = 'unset';
    el.addEventListener('change', () => {
      seen = (el as unknown as { appliedPreset?: { label: string } }).appliedPreset;
    });

    buttons(el)[0]!.click();
    await el.updateComplete;

    expect((seen as { label?: string })?.label).to.equal('Last 7 days');
  });

  it('reports no preset for a manual selection', async () => {
    const el = await pickerWith([
      { label: 'Last 7 days', start: '2026-08-13', end: '2026-08-19' },
    ]);
    buttons(el)[0]!.click();
    await el.updateComplete;

    const day = el.shadowRoot!.querySelector<HTMLElement>('[part~="day"]:not(:disabled)')!;
    day.click();
    await el.updateComplete;

    expect(
      (el as unknown as { appliedPreset?: unknown }).appliedPreset,
      'a hand-picked range did not come from a preset',
    ).to.equal(undefined);
  });

  // The changelog and the `presets` doc comment both advertised "All time", but both bounds were
  // required and applyPreset bailed on an unparseable one -- so that button rendered and did nothing.
  it('resolves an omitted start/end against min/max, making "All time" expressible', async () => {
    const el = await pickerWith(
      [{ label: 'All time' }],
      { min: '2020-01-01', max: '2030-12-31' },
    );

    buttons(el)[0]!.click();
    await el.updateComplete;

    expect(el.value).to.equal('2020-01-01/2030-12-31');
  });

  it('disables an unbounded preset rather than rendering a button that does nothing', async () => {
    const el = await pickerWith([{ label: 'All time' }]);

    expect(
      buttons(el)[0]!.disabled,
      'with no min/max there is nothing to resolve an open bound to',
    ).to.be.true;
  });

  it('echoes a caller-supplied id on appliedPreset, unread by the component itself', async () => {
    const source = { label: 'Last 7 days', start: '2026-08-13', end: '2026-08-19', id: 'last-7-days' };
    const el = await pickerWith([source]);

    buttons(el)[0]!.click();
    await el.updateComplete;

    expect(el.appliedPreset).to.equal(source);
    expect(el.appliedPreset?.id).to.equal('last-7-days');
  });
});

it("keeps single and partial range date views mode-correct", async () => {
  const el = await fixture<LyraDatePicker>(html`
    <lr-date-picker value="2026-07-10"></lr-date-picker>
  `);

  expect(el.valueAsRange.from).to.equal(null);
  expect(el.valueAsRange.to).to.equal(null);

  el.mode = "range";
  await el.updateComplete;
  expect(el.valueAsDate).to.equal(null);
  expect(el.valueAsRange.from?.getDate()).to.equal(10);
  expect(el.valueAsRange.to).to.equal(null);

  el.valueAsRange = { from: new Date(2026, 6, 12), to: null };
  expect(el.value).to.equal("2026-07-12");

  el.valueAsRange = { from: null, to: new Date(2026, 6, 20) };
  expect(el.value).to.equal("");

  el.valueAsRange = { from: new Date(NaN), to: new Date(2026, 6, 20) };
  expect(el.value).to.equal("");
});

it("pages a two-month calendar by one month when page-by is single", async () => {
  const el = await fixture<LyraDatePicker>(html`
    <lr-date-picker
      value="2026-07-15"
      months="2"
      page-by="single"
    ></lr-date-picker>
  `);
  const titles = (): string[] =>
    Array.from(
      el.shadowRoot!.querySelectorAll<HTMLElement>('[part="month-label"]'),
      (title) => title.textContent!.trim()
    );
  const before = titles();

  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="next"]')!.click();
  await el.updateComplete;

  const after = titles();
  expect(after[0]).to.equal(before[1]);
});

it("leaves the decade view unchanged when its title cannot advance farther", async () => {
  const el = await fixture<LyraDatePicker>(html`
    <lr-date-picker view="decades" value="2026-07-15"></lr-date-picker>
  `);
  let changes = 0;
  el.addEventListener("lr-view-change", () => changes++);

  el.shadowRoot!
    .querySelector<HTMLButtonElement>('[part="title"]')!
    .dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await el.updateComplete;

  expect(el.view).to.equal("decades");
  expect(changes).to.equal(0);
});
